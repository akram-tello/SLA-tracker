import { getMasterDb, getAnalyticsDb } from './db';
import { Connection } from 'mysql2/promise';
import { parseTimeStringToMinutes, calculateRiskThreshold } from './utils';

export interface ETLResult {
  brand: string;
  country: string;
  success: boolean;
  processed: number;
  error?: string;
}

export interface ETLSummary {
  total_jobs: number;
  successful_jobs: number;
  failed_jobs: number;
  total_processed: number;
  results: ETLResult[];
}

export interface TableInfo {
  table_name: string;
  record_count: number;
  exists_in_target: boolean;
}

export class ETLService {
  private masterDb: Connection | null = null;
  private analyticsDb: Connection | null = null;

  private async getMasterConnection(): Promise<Connection> {
    if (!this.masterDb) {
      this.masterDb = await getMasterDb();
    }
    return this.masterDb;
  }

  private async getAnalyticsConnection(): Promise<Connection> {
    if (!this.analyticsDb) {
      this.analyticsDb = await getAnalyticsDb();
    }
    return this.analyticsDb;
  }

  /**
   * Get list of available source tables with their status
   */
  async getAvailableTables(): Promise<TableInfo[]> {
    const masterDb = await this.getMasterConnection();
    const analyticsDb = await this.getAnalyticsConnection();

    // Find all source tables
    const [tables] = await masterDb.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME REGEXP '_[a-z]{2}_orders$'
      ORDER BY TABLE_NAME
    `);

    const sourceTableNames = (tables as { TABLE_NAME: string }[]).map(row => row.TABLE_NAME);
    const tableInfo: TableInfo[] = [];

    for (const tableName of sourceTableNames) {
      try {
        // Get record count
        const [countResult] = await masterDb.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
        const count = (countResult as { count: number }[])[0].count;
        
        // Check if target table exists
        const existsInTarget = await this.checkTargetTableExists(tableName, analyticsDb);
        
        tableInfo.push({
          table_name: tableName,
          record_count: count,
          exists_in_target: existsInTarget
        });
      } catch (error) {
        console.warn(`Could not analyze table ${tableName}:`, error);
        tableInfo.push({
          table_name: tableName,
          record_count: 0,
          exists_in_target: false
        });
      }
    }

    return tableInfo;
  }

  /**
   * Sync all available tables
   */
  async syncAll(): Promise<ETLSummary> {
    return this.sync();
  }

  /**
   * Sync specific brand and country
   */
  async syncSpecific(brandCode: string, countryCode: string): Promise<ETLSummary> {
    return this.sync(brandCode, countryCode);
  }

  /**
   * Main sync method - handles both all and specific syncing
   */
  private async sync(brandFilter?: string, countryFilter?: string): Promise<ETLSummary> {
    const masterDb = await this.getMasterConnection();
    const analyticsDb = await this.getAnalyticsConnection();

    // Discover all available source tables
    const [tables] = await masterDb.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME REGEXP '_[a-z]{2}_orders$'
      ORDER BY TABLE_NAME
    `);

    const sourceTableNames = (tables as { TABLE_NAME: string }[]).map(row => row.TABLE_NAME);
    console.log('Found source tables:', sourceTableNames);

    if (sourceTableNames.length === 0) {
      throw new Error('No source tables found matching pattern *_[country]_orders');
    }

    const results: ETLResult[] = [];

    // Process each table
    for (const sourceTable of sourceTableNames) {
      const tableResult = await this.syncTable(sourceTable, masterDb, analyticsDb, brandFilter, countryFilter);
      if (tableResult) {
        results.push(tableResult);
      }
    }

    return {
      total_jobs: results.length,
      successful_jobs: results.filter(r => r.success).length,
      failed_jobs: results.filter(r => !r.success).length,
      total_processed: results.reduce((sum, r) => sum + r.processed, 0),
      results
    };
  }

  /**
   * Sync a single table
   */
  private async syncTable(
    sourceTable: string, 
    masterDb: Connection, 
    analyticsDb: Connection,
    brandFilter?: string,
    countryFilter?: string
  ): Promise<ETLResult | null> {
    // Extract brand and country from table name
    const match = sourceTable.match(/^(.+)_([a-z]{2})_orders$/);
    if (!match) return null;
    
    const [, brandPart, country] = match;
    
    // Map brand part to brand code
    const brand = this.mapBrandCode(brandPart);
    
    // Apply filters
    if (brandFilter && brand !== brandFilter.toLowerCase()) return null;
    if (countryFilter && country !== countryFilter.toLowerCase()) return null;

    try {
      console.log(`Processing table: ${sourceTable}`);
      
      const targetTable = `orders_${brand}_${country}`;
      
      // Create target table if needed
      await this.ensureTargetTable(targetTable, analyticsDb);
      
      // Get available columns
      const availableColumns = await this.getTableColumns(sourceTable, masterDb);
      console.log(`Available columns in ${sourceTable}:`, availableColumns);
      
      // Get related tables for payment and shipment data
      const { paymentTable, shipmentTable } = await this.getRelatedTables(brand, country, masterDb);
      
      console.log(`Related tables found - Payment: ${paymentTable}, Shipment: ${shipmentTable}`);
      
      // Get total count
      const [countResult] = await masterDb.execute(`SELECT COUNT(*) as total FROM ${sourceTable}`);
      const totalRecords = (countResult as { total: number }[])[0].total;
      
      console.log(`Total records in ${sourceTable}: ${totalRecords}`);

      if (totalRecords === 0) {
        return { brand, country, success: true, processed: 0 };
      }

      // Process in batches with new join-based approach
      const processed = await this.processBatchesWithJoins(
        sourceTable,
        targetTable,
        brand,
        country,
        paymentTable,
        shipmentTable,
        totalRecords,
        masterDb,
        analyticsDb
      );

             console.log(`Successfully processed ${processed} records for ${brand}_${country}`);
       
       // Generate daily summary for dashboard
       await this.generateDailySummary(targetTable, brand, country, analyticsDb);
       
       return { brand, country, success: true, processed };

    } catch (error) {
      console.error(`Error processing ${sourceTable}:`, error);
      return {
        brand: brandPart,
        country,
        success: false,
        processed: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Map brand part from table name to brand code
   */
  private mapBrandCode(brandPart: string): string {
    if (brandPart.includes('victoriasecret') || brandPart.includes('vs')) {
      return 'vs';
    } else if (brandPart.includes('bbw')) {
      return 'bbw';
    } else if (brandPart.includes('rituals')) {
      return 'rituals';
    }
    return 'unknown';
  }

  /**
   * Check if target table exists
   */
  private async checkTargetTableExists(sourceTable: string, analyticsDb: Connection): Promise<boolean> {
    const match = sourceTable.match(/^(.+)_([a-z]{2})_orders$/);
    if (!match) return false;
    
    const [, brandPart, country] = match;
    const brand = this.mapBrandCode(brandPart);
    const targetTable = `orders_${brand}_${country}`;
    
    const [targetExists] = await analyticsDb.execute(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = ?
    `, [targetTable]);
    
    return (targetExists as { count: number }[])[0].count > 0;
  }

  /**
   * Ensure target table exists, create if needed
   */
  private async ensureTargetTable(targetTable: string, analyticsDb: Connection): Promise<void> {
    await analyticsDb.execute(`
      CREATE TABLE IF NOT EXISTS ${targetTable} (
        order_no VARCHAR(100) NOT NULL PRIMARY KEY,
        order_status VARCHAR(50),
        shipping_status VARCHAR(50),
        confirmation_status VARCHAR(50),
        placed_time DATETIME,
        processed_time DATETIME,
        shipped_time DATETIME,
        delivered_time DATETIME,
        processed_tat VARCHAR(20) COMMENT 'Formatted time string (e.g., "2h 30m")',
        shipped_tat VARCHAR(20) COMMENT 'Formatted time string (e.g., "2d 5h")',
        delivered_tat VARCHAR(20) COMMENT 'Formatted time string (e.g., "7d 12h")',
        currency VARCHAR(10),
        invoice_no VARCHAR(100),
        brand_name VARCHAR(100),
        country_code VARCHAR(10),
        -- Payment table fields
        card_type VARCHAR(50),
        amount DECIMAL(10,2),
        transactionid VARCHAR(100),
        -- Shipment table fields
        shipmentid VARCHAR(191),
        shipping_method VARCHAR(191),
        carrier VARCHAR(191),
        tracking_url VARCHAR(191),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_order_date (placed_time),
        INDEX idx_brand_country (brand_name, country_code),
        INDEX idx_processed_time (processed_time),
        INDEX idx_shipped_time (shipped_time),
        INDEX idx_delivered_time (delivered_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  /**
   * Get available columns for a table
   */
  private async getTableColumns(tableName: string, masterDb: Connection): Promise<string[]> {
    const [columns] = await masterDb.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `, [tableName]);

    return (columns as { COLUMN_NAME: string }[]).map(row => row.COLUMN_NAME);
  }

  /**
   * Build select fields with joins for payment and shipment data
   */
  private buildSelectFieldsWithJoins(
    brand: string, 
    country: string,
    orderTable: string,
    paymentTable: string | null,
    shipmentTable: string | null
  ): string {
    const brandName = this.getBrandName(brand);
    const escapedBrandName = brandName.replace(/'/g, "''");

    const selectFields = [
      // From orders table
      'o.order_no',
      'o.order_status',
      'o.shipping_status', 
      'o.confirmation_status',
      'o.order_created_date_time as placed_time',
      'o.processed_time',
      'o.shipped_time',
      'o.delivered_time',
      'o.processed_tat',
      'o.shipped_tat', 
      'o.delivered_tat',
      'o.currency',
      'o.invoice_no',
      `'${escapedBrandName}' as brand_name`,
      `UPPER('${country}') as country_code`,
      
      // From payment table (if exists)
      paymentTable ? 'p.card_type' : 'NULL as card_type',
      paymentTable ? 'p.amount' : 'NULL as amount',
      paymentTable ? 'p.transactionid' : 'NULL as transactionid',
      
      // From shipment table (if exists)
      shipmentTable ? 's.shipmentid' : 'NULL as shipmentid',
      shipmentTable ? 's.shipping_method' : 'NULL as shipping_method',
      shipmentTable ? 's.carrier' : 'NULL as carrier',
      shipmentTable ? 's.tracking_url' : 'NULL as tracking_url',
      
      'NOW() as updated_at'
    ];

    return selectFields.join(', ');
  }

  /**
   * Build JOIN clauses for payment and shipment tables
   */
  private buildJoinClauses(
    orderTable: string,
    paymentTable: string | null,
    shipmentTable: string | null
  ): string {
    let joinClauses = `FROM ${orderTable} o`;
    
    if (paymentTable) {
      joinClauses += ` LEFT JOIN ${paymentTable} p ON o.order_no = p.order_no`;
    }
    
    if (shipmentTable) {
      joinClauses += ` LEFT JOIN ${shipmentTable} s ON o.order_no = s.order_no`;
    }
    
    return joinClauses;
  }

  /**
   * Check if related tables exist for payment and shipment data
   */
  private async getRelatedTables(brand: string, country: string, masterDb: Connection): Promise<{
    paymentTable: string | null;
    shipmentTable: string | null;
  }> {
    const brandPart = this.getBrandTableName(brand);
    const paymentTableName = `${brandPart}_${country}_payments`;
    const shipmentTableName = `${brandPart}_${country}_shipments`;
    
    // Check if payment table exists
    const [paymentExists] = await masterDb.execute(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = ?
    `, [paymentTableName]);
    
    // Check if shipment table exists
    const [shipmentExists] = await masterDb.execute(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = ?
    `, [shipmentTableName]);
    
    return {
      paymentTable: (paymentExists as { count: number }[])[0].count > 0 ? paymentTableName : null,
      shipmentTable: (shipmentExists as { count: number }[])[0].count > 0 ? shipmentTableName : null
    };
  }

  /**
   * Get brand table name part for master DB table naming
   */
  private getBrandTableName(brandCode: string): string {
    switch (brandCode) {
      case 'vs': return 'victoriasecret';
      case 'bbw': return 'bbw';
      case 'rituals': return 'rituals';
      default: return brandCode;
    }
  }

  /**
   * Get brand display name from code
   */
  private getBrandName(brandCode: string): string {
    switch (brandCode) {
      case 'vs': return "Victoria's Secret";
      case 'bbw': return 'Bath & Body Works';
      case 'rituals': return 'Rituals';
      default: return 'Unknown';
    }
  }

  /**
   * Process data in batches with joins for payment and shipment data
   */
  private async processBatchesWithJoins(
    sourceTable: string,
    targetTable: string,
    brand: string,
    country: string,
    paymentTable: string | null,
    shipmentTable: string | null,
    totalRecords: number,
    masterDb: Connection,
    analyticsDb: Connection
  ): Promise<number> {
    const batchSize = 1000;
    let processed = 0;
    let offset = 0;

    while (offset < totalRecords) {
      // Build the complete query with joins
      const selectFields = this.buildSelectFieldsWithJoins(brand, country, sourceTable, paymentTable, shipmentTable);
      const joinClauses = this.buildJoinClauses(sourceTable, paymentTable, shipmentTable);
      
      const batchQuery = `
        SELECT ${selectFields}
        ${joinClauses}
        ORDER BY o.order_created_date_time DESC
        LIMIT ${batchSize} OFFSET ${offset}
      `;

      console.log(`Processing batch ${Math.floor(offset/batchSize) + 1}/${Math.ceil(totalRecords/batchSize)} for ${sourceTable}`);
      
      const [sourceRows] = await masterDb.execute(batchQuery);
      const rows = sourceRows as Record<string, string | number | Date | null>[];

      if (rows.length === 0) break;

      // Insert batch data
      for (const row of rows) {
        try {
          const columns = Object.keys(row);
          const values = Object.values(row);
          const placeholders = columns.map(() => '?').join(', ');
          
          const upsertQuery = `
            INSERT INTO ${targetTable} (${columns.join(', ')})
            VALUES (${placeholders})
            ON DUPLICATE KEY UPDATE
            ${columns.filter(col => col !== 'order_no').map(col => `${col} = VALUES(${col})`).join(', ')}
          `;

          await analyticsDb.execute(upsertQuery, values);
          processed++;
        } catch (error) {
          console.warn(`Failed to insert row for ${row.order_no}:`, error);
        }
      }

      offset += batchSize;
      
      // Small delay to prevent overwhelming the database
      if (offset < totalRecords) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return processed;
  }

  /**
   * Generate daily summary data for dashboard
   */
  private async generateDailySummary(targetTable: string, brand: string, country: string, analyticsDb: Connection): Promise<void> {
    try {
      const brandName = this.getBrandName(brand);
      
      // Get TAT configuration for this brand/country combination
      const [tatConfigRows] = await analyticsDb.execute(`
        SELECT processed_tat, shipped_tat, delivered_tat, risk_pct
        FROM tat_config 
        WHERE brand_name = ? AND country_code = ?
      `, [brandName, country.toUpperCase()]);
      
      const tatConfigArray = tatConfigRows as Record<string, string | number>[];
      
      // Enhanced validation with fallback defaults
      let tatConfig: Record<string, string | number>;
      if (tatConfigArray.length === 0) {
        console.warn(`No TAT config found for ${brandName}/${country.toUpperCase()}, using fallback defaults`);
        
        // Fallback TAT configuration
        tatConfig = {
          processed_tat: '2h',      // 2 hours default
          shipped_tat: '2d',        // 2 days default  
          delivered_tat: '7d',      // 7 days default
          risk_pct: 80              // 80% risk threshold default
        };
        
        // Log the fallback usage for monitoring
        console.log(`Applied fallback TAT config for ${brandName}/${country.toUpperCase()}:`, tatConfig);
      } else {
        tatConfig = tatConfigArray[0];
      }
      
      const { processed_tat, shipped_tat, delivered_tat, risk_pct } = tatConfig;
      
      // Validate TAT values before processing
      try {
        // Convert TAT values to minutes and calculate risk thresholds
        const processedTATMinutes = parseTimeStringToMinutes(String(processed_tat));
        const shippedTATMinutes = parseTimeStringToMinutes(String(shipped_tat));
        const deliveredTATMinutes = parseTimeStringToMinutes(String(delivered_tat));
        
        const processedRiskThreshold = parseTimeStringToMinutes(calculateRiskThreshold(String(processed_tat), Number(risk_pct)));
        const shippedRiskThreshold = parseTimeStringToMinutes(calculateRiskThreshold(String(shipped_tat), Number(risk_pct)));
        const deliveredRiskThreshold = parseTimeStringToMinutes(calculateRiskThreshold(String(delivered_tat), Number(risk_pct)));

        // Validate converted values
        if (processedTATMinutes <= 0 || shippedTATMinutes <= 0 || deliveredTATMinutes <= 0) {
          throw new Error(`Invalid TAT values: processed=${processed_tat}, shipped=${shipped_tat}, delivered=${delivered_tat}`);
        }

        console.log(`TAT Configuration for ${brandName}/${country.toUpperCase()}:`, {
          processed: `${processed_tat} (${processedTATMinutes}min)`,
          shipped: `${shipped_tat} (${shippedTATMinutes}min)`,
          delivered: `${delivered_tat} (${deliveredTATMinutes}min)`,
          risk_pct: `${risk_pct}%`
        });

        // Validate target table exists before processing
        const [tableCheck] = await analyticsDb.execute(`
          SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
        `, [targetTable]);
        
        const tableExists = (tableCheck as { count: number }[])[0].count > 0;
        if (!tableExists) {
          throw new Error(`Target table ${targetTable} does not exist`);
        }

        // Check if target table has any data
        const [dataCheck] = await analyticsDb.execute(`SELECT COUNT(*) as count FROM ${targetTable}`);
        const recordCount = (dataCheck as { count: number }[])[0].count;
        
        if (recordCount === 0) {
          console.warn(`Target table ${targetTable} is empty, skipping summary generation`);
          return;
        }

        console.log(`Processing ${recordCount} records from ${targetTable}`);

        // First, clear existing summaries for this brand/country to avoid duplicates
        await analyticsDb.execute(`
          DELETE FROM sla_daily_summary 
          WHERE brand_name = ? AND country_code = ?
        `, [brandName, country.toUpperCase()]);

        // Enhanced summary query with better stage handling
        const summaryQuery = `
          INSERT INTO sla_daily_summary (
            summary_date, brand_name, brand_code, country_code, stage,
            orders_total, orders_on_time, orders_on_risk, orders_breached, avg_delay_sec
          )
          SELECT 
            DATE(placed_time) as summary_date,
            brand_name,
            '${brand}' as brand_code,
            country_code,
            CASE 
              -- Order is in Not Processed stage if confirmation_status = 'NOTCONFIRMED'
              WHEN confirmation_status = 'NOTCONFIRMED' THEN 'Not Processed'
              -- Order is in Delivered stage if it has delivered_time
              WHEN delivered_time IS NOT NULL THEN 'Delivered'
              -- Order is in Shipped stage if it has shipped_time but no delivered_time
              WHEN shipped_time IS NOT NULL AND delivered_time IS NULL THEN 'Shipped'
              -- Order is in Processed stage if it has processed_time but no shipped_time
              WHEN processed_time IS NOT NULL AND shipped_time IS NULL THEN 'Processed'
              -- Fallback for edge cases - orders with placed_time but no clear stage
              WHEN placed_time IS NOT NULL THEN 'Not Processed'
              ELSE 'Unknown'
            END as current_stage,
            COUNT(*) as orders_total,
            
            -- Calculate SLA performance based on the CURRENT stage
            SUM(CASE 
              WHEN delivered_time IS NOT NULL THEN
                -- For delivered orders, calculate actual time from placed to delivered and compare with SLA
                CASE WHEN TIMESTAMPDIFF(MINUTE, placed_time, delivered_time) <= ${deliveredTATMinutes} 
                     THEN 1 ELSE 0 END
              
              WHEN shipped_time IS NOT NULL AND delivered_time IS NULL THEN
                -- For shipped (not delivered) orders, calculate actual time from placed to shipped and compare with SLA
                CASE WHEN TIMESTAMPDIFF(MINUTE, placed_time, shipped_time) <= ${shippedTATMinutes}
                     THEN 1 ELSE 0 END
                
              WHEN processed_time IS NOT NULL AND shipped_time IS NULL THEN
                -- For processed (not shipped) orders, calculate actual time from placed to processed and compare with SLA
                CASE WHEN TIMESTAMPDIFF(MINUTE, placed_time, processed_time) <= ${processedTATMinutes} 
                     THEN 1 ELSE 0 END
                
              WHEN confirmation_status = 'NOTCONFIRMED' THEN
                -- For not processed orders, they are not yet in SLA workflow, so not counted as on-time
                0
                
              ELSE 0 -- Default case for edge scenarios
            END) as orders_on_time,
            
            -- Calculate on-risk orders (between risk threshold and SLA threshold)
            SUM(CASE 
              WHEN delivered_time IS NOT NULL THEN
                -- For delivered orders, check if actual time is between risk threshold and SLA threshold
                CASE WHEN TIMESTAMPDIFF(MINUTE, placed_time, delivered_time) > ${deliveredRiskThreshold} 
                          AND TIMESTAMPDIFF(MINUTE, placed_time, delivered_time) <= ${deliveredTATMinutes}
                     THEN 1 ELSE 0 END
                
              WHEN shipped_time IS NOT NULL AND delivered_time IS NULL THEN
                -- For shipped orders, check if actual time is between risk threshold and SLA threshold  
                CASE WHEN TIMESTAMPDIFF(MINUTE, placed_time, shipped_time) > ${shippedRiskThreshold} 
                          AND TIMESTAMPDIFF(MINUTE, placed_time, shipped_time) <= ${shippedTATMinutes}
                     THEN 1 ELSE 0 END
                
              WHEN processed_time IS NOT NULL AND shipped_time IS NULL THEN
                -- For processed orders, check if actual time is between risk threshold and SLA threshold
                CASE WHEN TIMESTAMPDIFF(MINUTE, placed_time, processed_time) > ${processedRiskThreshold}
                          AND TIMESTAMPDIFF(MINUTE, placed_time, processed_time) <= ${processedTATMinutes}
                     THEN 1 ELSE 0 END
                
              WHEN confirmation_status = 'NOTCONFIRMED' THEN
                -- For not processed orders, they are not yet in SLA workflow, so not counted as on-risk
                0
                
              ELSE 0
            END) as orders_on_risk,
            
            -- Calculate breached orders (exceeded SLA threshold)
            SUM(CASE 
              WHEN delivered_time IS NOT NULL THEN
                -- For delivered orders, check if actual time exceeds SLA threshold
                CASE WHEN TIMESTAMPDIFF(MINUTE, placed_time, delivered_time) > ${deliveredTATMinutes} 
                     THEN 1 ELSE 0 END
                
              WHEN shipped_time IS NOT NULL AND delivered_time IS NULL THEN
                -- For shipped orders, check if actual time exceeds SLA threshold
                CASE WHEN TIMESTAMPDIFF(MINUTE, placed_time, shipped_time) > ${shippedTATMinutes} 
                     THEN 1 ELSE 0 END
                
              WHEN processed_time IS NOT NULL AND shipped_time IS NULL THEN
                -- For processed orders, check if actual time exceeds SLA threshold
                CASE WHEN TIMESTAMPDIFF(MINUTE, placed_time, processed_time) > ${processedTATMinutes} 
                     THEN 1 ELSE 0 END
                
              WHEN confirmation_status = 'NOTCONFIRMED' THEN
                -- For not processed orders, they are not yet in SLA workflow, so not counted as breached
                0
                
              ELSE 0
            END) as orders_breached,
            
            -- Calculate average delay for breached orders only (in seconds)
            COALESCE(AVG(CASE 
              WHEN delivered_time IS NOT NULL THEN
                -- For delivered orders that are breached, calculate excess time beyond SLA
                CASE WHEN TIMESTAMPDIFF(MINUTE, placed_time, delivered_time) > ${deliveredTATMinutes}
                     THEN TIMESTAMPDIFF(SECOND, placed_time, delivered_time) 
                     ELSE NULL END
                
              WHEN shipped_time IS NOT NULL AND delivered_time IS NULL THEN
                -- For shipped orders that are breached, calculate excess time beyond SLA
                CASE WHEN TIMESTAMPDIFF(MINUTE, placed_time, shipped_time) > ${shippedTATMinutes}
                     THEN TIMESTAMPDIFF(SECOND, placed_time, shipped_time) 
                     ELSE NULL END
                
              WHEN processed_time IS NOT NULL AND shipped_time IS NULL THEN
                -- For processed orders that are breached, calculate excess time beyond SLA
                CASE WHEN TIMESTAMPDIFF(MINUTE, placed_time, processed_time) > ${processedTATMinutes}
                     THEN TIMESTAMPDIFF(SECOND, placed_time, processed_time) 
                     ELSE NULL END
                     
              ELSE NULL
            END), 0) as avg_delay_sec
          FROM ${targetTable} o
          WHERE placed_time IS NOT NULL
            AND (
              delivered_time IS NOT NULL OR 
              shipped_time IS NOT NULL OR 
              processed_time IS NOT NULL OR
              confirmation_status = 'NOTCONFIRMED'
            )
          GROUP BY DATE(placed_time), brand_name, country_code, current_stage
          HAVING current_stage IS NOT NULL AND current_stage != 'Unknown'
          ORDER BY DATE(placed_time), current_stage
        `;

        // Execute summary generation with error handling
        const result = await analyticsDb.execute(summaryQuery);
        const affectedRows = (result as [{ affectedRows?: number }, unknown])[0]?.affectedRows || 0;
        
        console.log(`Successfully generated daily summary for ${brand}_${country}: ${affectedRows} summary records created`);
        
        // Log summary statistics for validation
        const [summaryStats] = await analyticsDb.execute(`
          SELECT 
            COUNT(DISTINCT summary_date) as date_count,
            COUNT(DISTINCT stage) as stage_count,
            SUM(orders_total) as total_orders,
            MIN(summary_date) as min_date,
            MAX(summary_date) as max_date
          FROM sla_daily_summary 
          WHERE brand_name = ? AND country_code = ?
        `, [brandName, country.toUpperCase()]);
        
        console.log(`Summary statistics for ${brandName}/${country.toUpperCase()}:`, summaryStats);
        
      } catch (tatError) {
        console.error(`TAT configuration error for ${brandName}/${country.toUpperCase()}:`, tatError);
        throw new Error(`Invalid TAT configuration: ${tatError instanceof Error ? tatError.message : 'Unknown TAT error'}`);
      }
      
    } catch (error) {
      console.error(`Failed to generate daily summary for ${brand}_${country}:`, error);
      
      // Enhanced error logging with context
      const errorContext = {
        brand,
        country,
        targetTable,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      console.error('Daily summary generation error context:', errorContext);
      
      // Don't throw the error to prevent ETL failure - log and continue
      // This allows other brand/country combinations to succeed
    }
  }

  /**
   * Detect and cleanup orphaned data in sla_daily_summary
   * Returns summary of orphaned records found and cleaned
   */
  async cleanupOrphanedSummaryData(): Promise<{
    orphaned_records: Array<{
      brand_name: string;
      country_code: string;
      brand_code: string;
      missing_table: string;
      record_count: number;
    }>;
    total_orphaned: number;
    cleanup_performed: boolean;
  }> {
    const analyticsDb = await this.getAnalyticsConnection();
    
    try {
      // Get all unique brand/country combinations from sla_daily_summary
      const [summaryBrands] = await analyticsDb.execute(`
        SELECT DISTINCT brand_name, country_code, brand_code
        FROM sla_daily_summary
        ORDER BY brand_name, country_code
      `);
      
      const summaryData = summaryBrands as Array<{
        brand_name: string;
        country_code: string;
        brand_code: string;
      }>;
      
      console.log(`Found ${summaryData.length} unique brand/country combinations in sla_daily_summary`);
      
      const orphanedRecords = [];
      
      // Check each combination to see if corresponding order table exists
      for (const record of summaryData) {
        const { brand_name, country_code, brand_code } = record;
        const expectedTableName = `orders_${brand_code}_${country_code.toLowerCase()}`;
        
        // Check if the expected order table exists
        const [tableCheck] = await analyticsDb.execute(`
          SELECT COUNT(*) as count 
          FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = ?
        `, [expectedTableName]);
        
        const tableExists = (tableCheck as { count: number }[])[0].count > 0;
        
        if (!tableExists) {
          // Count orphaned records for this brand/country
          const [countResult] = await analyticsDb.execute(`
            SELECT COUNT(*) as count 
            FROM sla_daily_summary 
            WHERE brand_name = ? AND country_code = ?
          `, [brand_name, country_code]);
          
          const recordCount = (countResult as { count: number }[])[0].count;
          
          orphanedRecords.push({
            brand_name,
            country_code,
            brand_code,
            missing_table: expectedTableName,
            record_count: recordCount
          });
          
          console.warn(`Found ${recordCount} orphaned records for ${brand_name}/${country_code} - missing table: ${expectedTableName}`);
        }
      }
      
      const totalOrphaned = orphanedRecords.reduce((sum, record) => sum + record.record_count, 0);
      
      if (orphanedRecords.length === 0) {
        console.log('No orphaned data found in sla_daily_summary');
        return {
          orphaned_records: [],
          total_orphaned: 0,
          cleanup_performed: false
        };
      }
      
      console.log(`Found ${totalOrphaned} total orphaned records across ${orphanedRecords.length} brand/country combinations`);
      
      // Perform cleanup - remove orphaned records
      let cleanupPerformed = false;
      
      for (const record of orphanedRecords) {
        const { brand_name, country_code, record_count } = record;
        
        try {
          await analyticsDb.execute(`
            DELETE FROM sla_daily_summary 
            WHERE brand_name = ? AND country_code = ?
          `, [brand_name, country_code]);
          
          console.log(`Cleaned up ${record_count} orphaned records for ${brand_name}/${country_code}`);
          cleanupPerformed = true;
          
        } catch (deleteError) {
          console.error(`Failed to cleanup orphaned records for ${brand_name}/${country_code}:`, deleteError);
        }
      }
      
      return {
        orphaned_records: orphanedRecords,
        total_orphaned: totalOrphaned,
        cleanup_performed: cleanupPerformed
      };
      
    } catch (error) {
      console.error('Error during orphaned data cleanup:', error);
      throw new Error(`Orphaned data cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate data integrity across the system
   * Checks for missing TAT configs, orphaned data, and table consistency
   */
  async validateDataIntegrity(): Promise<{
    tat_config_issues: Array<{
      brand_name: string;
      country_code: string;
      issue: string;
    }>;
         orphaned_summary_data: {
       orphaned_records: Array<{
         brand_name: string;
         country_code: string;
         brand_code: string;
         missing_table: string;
         record_count: number;
       }>;
       total_orphaned: number;
       cleanup_performed: boolean;
     };
    missing_order_tables: Array<{
      expected_table: string;
      source_pattern: string;
      issue: string;
    }>;
    summary: {
      total_issues: number;
      tat_issues: number;
      orphaned_records: number;
      missing_tables: number;
    };
  }> {
    const analyticsDb = await this.getAnalyticsConnection();
    
    try {
      console.log('Starting comprehensive data integrity validation...');
      
      // 1. Check for missing TAT configurations
      const tatConfigIssues = [];
      const [summaryBrands] = await analyticsDb.execute(`
        SELECT DISTINCT brand_name, country_code 
        FROM sla_daily_summary
      `);
      
      const brands = summaryBrands as Array<{ brand_name: string; country_code: string }>;
      
      for (const { brand_name, country_code } of brands) {
        const [tatCheck] = await analyticsDb.execute(`
          SELECT COUNT(*) as count 
          FROM tat_config 
          WHERE brand_name = ? AND country_code = ?
        `, [brand_name, country_code]);
        
        const hasConfig = (tatCheck as { count: number }[])[0].count > 0;
        
        if (!hasConfig) {
          tatConfigIssues.push({
            brand_name,
            country_code,
            issue: 'Missing TAT configuration - will use fallback defaults'
          });
        }
      }
      
      // 2. Check for orphaned summary data
      const orphanedData = await this.cleanupOrphanedSummaryData();
      
      // 3. Check for expected order tables that might be missing
      const missingTables = [];
      
      // This would typically check against a master list or discovery service
      // For now, we'll check if we have summary data without corresponding tables
      for (const record of orphanedData.orphaned_records) {
        missingTables.push({
          expected_table: record.missing_table,
          source_pattern: `${record.brand_code}_${record.country_code}_orders`,
          issue: `Order table missing but summary data exists`
        });
      }
      
      const totalIssues = tatConfigIssues.length + orphanedData.total_orphaned + missingTables.length;
      
      console.log(`Data integrity validation completed. Found ${totalIssues} total issues.`);
      
      return {
        tat_config_issues: tatConfigIssues,
        orphaned_summary_data: orphanedData,
        missing_order_tables: missingTables,
        summary: {
          total_issues: totalIssues,
          tat_issues: tatConfigIssues.length,
          orphaned_records: orphanedData.total_orphaned,
          missing_tables: missingTables.length
        }
      };
      
    } catch (error) {
      console.error('Data integrity validation failed:', error);
      throw new Error(`Data integrity validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 