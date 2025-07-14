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
      if (tatConfigArray.length === 0) {
        console.warn(`No TAT config found for ${brandName}/${country.toUpperCase()}, skipping summary generation`);
        return;
      }
      
      const tatConfig = tatConfigArray[0];
      const { processed_tat, shipped_tat, delivered_tat, risk_pct } = tatConfig;
      
      // Calculate risk thresholds using formatted time strings
      const processedRiskThreshold = calculateRiskThreshold(String(processed_tat), Number(risk_pct));
      const shippedRiskThreshold = calculateRiskThreshold(String(shipped_tat), Number(risk_pct));
      const deliveredRiskThreshold = calculateRiskThreshold(String(delivered_tat), Number(risk_pct));

      // First, clear existing summaries for this brand/country to avoid duplicates
      await analyticsDb.execute(`
        DELETE FROM sla_daily_summary 
        WHERE brand_name = ? AND country_code = ?
      `, [brandName, country.toUpperCase()]);

      // Generate summary with proper stage assignment based on current order status
      // Each order appears in ONLY ONE stage based on its current status
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
            -- Order is in Delivered stage if it has delivered_time
            WHEN delivered_time IS NOT NULL THEN 'Delivered'
            -- Order is in Shipped stage if it has shipped_time but no delivered_time
            WHEN shipped_time IS NOT NULL AND delivered_time IS NULL THEN 'Shipped'
            -- Order is in Processed stage if it has processed_time but no shipped_time
            WHEN processed_time IS NOT NULL AND shipped_time IS NULL THEN 'Processed'
            ELSE NULL
          END as current_stage,
          COUNT(*) as orders_total,
          
          -- Calculate SLA performance based on the CURRENT stage
          SUM(CASE 
            WHEN delivered_time IS NOT NULL THEN
              -- For delivered orders, check delivered_tat against delivered SLA
              CASE WHEN (
                COALESCE(
                  CASE WHEN delivered_tat REGEXP '[0-9]+d' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(delivered_tat, 'd', 1), ' ', -1) AS UNSIGNED) * 1440 
                  ELSE 0 END +
                  CASE WHEN delivered_tat REGEXP '[0-9]+h' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(delivered_tat, 'h', 1), ' ', -1) AS UNSIGNED) * 60 
                  ELSE 0 END +
                  CASE WHEN delivered_tat REGEXP '[0-9]+m' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(delivered_tat, 'm', 1), ' ', -1) AS UNSIGNED)
                  ELSE 0 END, 0
                ) <= ${parseTimeStringToMinutes(String(delivered_tat))}
              ) THEN 1 ELSE 0 END
            
            WHEN shipped_time IS NOT NULL AND delivered_time IS NULL THEN
              -- For shipped (not delivered) orders, check shipped_tat against shipped SLA
              CASE WHEN (
                COALESCE(
                  CASE WHEN shipped_tat REGEXP '[0-9]+d' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(shipped_tat, 'd', 1), ' ', -1) AS UNSIGNED) * 1440 
                  ELSE 0 END +
                  CASE WHEN shipped_tat REGEXP '[0-9]+h' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(shipped_tat, 'h', 1), ' ', -1) AS UNSIGNED) * 60 
                  ELSE 0 END +
                  CASE WHEN shipped_tat REGEXP '[0-9]+m' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(shipped_tat, 'm', 1), ' ', -1) AS UNSIGNED)
                  ELSE 0 END, 0
                ) <= ${parseTimeStringToMinutes(String(shipped_tat))}
              ) THEN 1 ELSE 0 END
              
            WHEN processed_time IS NOT NULL AND shipped_time IS NULL THEN
              -- For processed (not shipped) orders, check processed_tat against processed SLA
              CASE WHEN (
                COALESCE(
                  CASE WHEN processed_tat REGEXP '[0-9]+d' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(processed_tat, 'd', 1), ' ', -1) AS UNSIGNED) * 1440 
                  ELSE 0 END +
                  CASE WHEN processed_tat REGEXP '[0-9]+h' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(processed_tat, 'h', 1), ' ', -1) AS UNSIGNED) * 60 
                  ELSE 0 END +
                  CASE WHEN processed_tat REGEXP '[0-9]+m' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(processed_tat, 'm', 1), ' ', -1) AS UNSIGNED)
                  ELSE 0 END, 0
                ) <= ${parseTimeStringToMinutes(String(processed_tat))}
              ) THEN 1 ELSE 0 END
              
            ELSE 1 -- Orders still processing are considered on-time for now
          END) as orders_on_time,
          
          -- Calculate on-risk orders (between risk threshold and SLA threshold)
          SUM(CASE 
            WHEN delivered_time IS NOT NULL THEN
              CASE WHEN (
                COALESCE(
                  CASE WHEN delivered_tat REGEXP '[0-9]+d' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(delivered_tat, 'd', 1), ' ', -1) AS UNSIGNED) * 1440 
                  ELSE 0 END +
                  CASE WHEN delivered_tat REGEXP '[0-9]+h' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(delivered_tat, 'h', 1), ' ', -1) AS UNSIGNED) * 60 
                  ELSE 0 END +
                  CASE WHEN delivered_tat REGEXP '[0-9]+m' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(delivered_tat, 'm', 1), ' ', -1) AS UNSIGNED)
                  ELSE 0 END, 0
                ) > ${parseTimeStringToMinutes(deliveredRiskThreshold)} AND 
                COALESCE(
                  CASE WHEN delivered_tat REGEXP '[0-9]+d' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(delivered_tat, 'd', 1), ' ', -1) AS UNSIGNED) * 1440 
                  ELSE 0 END +
                  CASE WHEN delivered_tat REGEXP '[0-9]+h' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(delivered_tat, 'h', 1), ' ', -1) AS UNSIGNED) * 60 
                  ELSE 0 END +
                  CASE WHEN delivered_tat REGEXP '[0-9]+m' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(delivered_tat, 'm', 1), ' ', -1) AS UNSIGNED)
                  ELSE 0 END, 0
                ) <= ${parseTimeStringToMinutes(String(delivered_tat))}
              ) THEN 1 ELSE 0 END
              
            WHEN shipped_time IS NOT NULL AND delivered_time IS NULL THEN
              CASE WHEN (
                COALESCE(
                  CASE WHEN shipped_tat REGEXP '[0-9]+d' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(shipped_tat, 'd', 1), ' ', -1) AS UNSIGNED) * 1440 
                  ELSE 0 END +
                  CASE WHEN shipped_tat REGEXP '[0-9]+h' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(shipped_tat, 'h', 1), ' ', -1) AS UNSIGNED) * 60 
                  ELSE 0 END +
                  CASE WHEN shipped_tat REGEXP '[0-9]+m' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(shipped_tat, 'm', 1), ' ', -1) AS UNSIGNED)
                  ELSE 0 END, 0
                ) > ${parseTimeStringToMinutes(shippedRiskThreshold)} AND 
                COALESCE(
                  CASE WHEN shipped_tat REGEXP '[0-9]+d' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(shipped_tat, 'd', 1), ' ', -1) AS UNSIGNED) * 1440 
                  ELSE 0 END +
                  CASE WHEN shipped_tat REGEXP '[0-9]+h' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(shipped_tat, 'h', 1), ' ', -1) AS UNSIGNED) * 60 
                  ELSE 0 END +
                  CASE WHEN shipped_tat REGEXP '[0-9]+m' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(shipped_tat, 'm', 1), ' ', -1) AS UNSIGNED)
                  ELSE 0 END, 0
                ) <= ${parseTimeStringToMinutes(String(shipped_tat))}
              ) THEN 1 ELSE 0 END
              
            WHEN processed_time IS NOT NULL AND shipped_time IS NULL THEN
              CASE WHEN (
                COALESCE(
                  CASE WHEN processed_tat REGEXP '[0-9]+d' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(processed_tat, 'd', 1), ' ', -1) AS UNSIGNED) * 1440 
                  ELSE 0 END +
                  CASE WHEN processed_tat REGEXP '[0-9]+h' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(processed_tat, 'h', 1), ' ', -1) AS UNSIGNED) * 60 
                  ELSE 0 END +
                  CASE WHEN processed_tat REGEXP '[0-9]+m' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(processed_tat, 'm', 1), ' ', -1) AS UNSIGNED)
                  ELSE 0 END, 0
                ) > ${parseTimeStringToMinutes(processedRiskThreshold)} AND 
                COALESCE(
                  CASE WHEN processed_tat REGEXP '[0-9]+d' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(processed_tat, 'd', 1), ' ', -1) AS UNSIGNED) * 1440 
                  ELSE 0 END +
                  CASE WHEN processed_tat REGEXP '[0-9]+h' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(processed_tat, 'h', 1), ' ', -1) AS UNSIGNED) * 60 
                  ELSE 0 END +
                  CASE WHEN processed_tat REGEXP '[0-9]+m' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(processed_tat, 'm', 1), ' ', -1) AS UNSIGNED)
                  ELSE 0 END, 0
                ) <= ${parseTimeStringToMinutes(String(processed_tat))}
              ) THEN 1 ELSE 0 END
              
            ELSE 0
          END) as orders_on_risk,
          
          -- Calculate breached orders (exceeded SLA threshold)
          SUM(CASE 
            WHEN delivered_time IS NOT NULL THEN
              CASE WHEN (
                COALESCE(
                  CASE WHEN delivered_tat REGEXP '[0-9]+d' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(delivered_tat, 'd', 1), ' ', -1) AS UNSIGNED) * 1440 
                  ELSE 0 END +
                  CASE WHEN delivered_tat REGEXP '[0-9]+h' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(delivered_tat, 'h', 1), ' ', -1) AS UNSIGNED) * 60 
                  ELSE 0 END +
                  CASE WHEN delivered_tat REGEXP '[0-9]+m' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(delivered_tat, 'm', 1), ' ', -1) AS UNSIGNED)
                  ELSE 0 END, 0
                ) > ${parseTimeStringToMinutes(String(delivered_tat))}
              ) THEN 1 ELSE 0 END
              
            WHEN shipped_time IS NOT NULL AND delivered_time IS NULL THEN
              CASE WHEN (
                COALESCE(
                  CASE WHEN shipped_tat REGEXP '[0-9]+d' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(shipped_tat, 'd', 1), ' ', -1) AS UNSIGNED) * 1440 
                  ELSE 0 END +
                  CASE WHEN shipped_tat REGEXP '[0-9]+h' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(shipped_tat, 'h', 1), ' ', -1) AS UNSIGNED) * 60 
                  ELSE 0 END +
                  CASE WHEN shipped_tat REGEXP '[0-9]+m' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(shipped_tat, 'm', 1), ' ', -1) AS UNSIGNED)
                  ELSE 0 END, 0
                ) > ${parseTimeStringToMinutes(String(shipped_tat))}
              ) THEN 1 ELSE 0 END
              
            WHEN processed_time IS NOT NULL AND shipped_time IS NULL THEN
              CASE WHEN (
                COALESCE(
                  CASE WHEN processed_tat REGEXP '[0-9]+d' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(processed_tat, 'd', 1), ' ', -1) AS UNSIGNED) * 1440 
                  ELSE 0 END +
                  CASE WHEN processed_tat REGEXP '[0-9]+h' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(processed_tat, 'h', 1), ' ', -1) AS UNSIGNED) * 60 
                  ELSE 0 END +
                  CASE WHEN processed_tat REGEXP '[0-9]+m' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(processed_tat, 'm', 1), ' ', -1) AS UNSIGNED)
                  ELSE 0 END, 0
                ) > ${parseTimeStringToMinutes(String(processed_tat))}
              ) THEN 1 ELSE 0 END
              
            ELSE 0
          END) as orders_breached,
          
          -- Calculate average delay for breached orders only, default to 0 if no breached orders
          COALESCE(AVG(CASE 
            WHEN delivered_time IS NOT NULL THEN
              CASE WHEN (
                COALESCE(
                  CASE WHEN delivered_tat REGEXP '[0-9]+d' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(delivered_tat, 'd', 1), ' ', -1) AS UNSIGNED) * 1440 
                  ELSE 0 END +
                  CASE WHEN delivered_tat REGEXP '[0-9]+h' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(delivered_tat, 'h', 1), ' ', -1) AS UNSIGNED) * 60 
                  ELSE 0 END +
                  CASE WHEN delivered_tat REGEXP '[0-9]+m' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(delivered_tat, 'm', 1), ' ', -1) AS UNSIGNED)
                  ELSE 0 END, 0
                ) > ${parseTimeStringToMinutes(String(delivered_tat))}
              ) THEN (
                COALESCE(
                  CASE WHEN delivered_tat REGEXP '[0-9]+d' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(delivered_tat, 'd', 1), ' ', -1) AS UNSIGNED) * 1440 
                  ELSE 0 END +
                  CASE WHEN delivered_tat REGEXP '[0-9]+h' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(delivered_tat, 'h', 1), ' ', -1) AS UNSIGNED) * 60 
                  ELSE 0 END +
                  CASE WHEN delivered_tat REGEXP '[0-9]+m' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(delivered_tat, 'm', 1), ' ', -1) AS UNSIGNED)
                  ELSE 0 END, 0
                ) * 60 -- Convert minutes to seconds
              ) ELSE NULL END
              
            WHEN shipped_time IS NOT NULL AND delivered_time IS NULL THEN
              CASE WHEN (
                COALESCE(
                  CASE WHEN shipped_tat REGEXP '[0-9]+d' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(shipped_tat, 'd', 1), ' ', -1) AS UNSIGNED) * 1440 
                  ELSE 0 END +
                  CASE WHEN shipped_tat REGEXP '[0-9]+h' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(shipped_tat, 'h', 1), ' ', -1) AS UNSIGNED) * 60 
                  ELSE 0 END +
                  CASE WHEN shipped_tat REGEXP '[0-9]+m' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(shipped_tat, 'm', 1), ' ', -1) AS UNSIGNED)
                  ELSE 0 END, 0
                ) > ${parseTimeStringToMinutes(String(shipped_tat))}
              ) THEN (
                COALESCE(
                  CASE WHEN shipped_tat REGEXP '[0-9]+d' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(shipped_tat, 'd', 1), ' ', -1) AS UNSIGNED) * 1440 
                  ELSE 0 END +
                  CASE WHEN shipped_tat REGEXP '[0-9]+h' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(shipped_tat, 'h', 1), ' ', -1) AS UNSIGNED) * 60 
                  ELSE 0 END +
                  CASE WHEN shipped_tat REGEXP '[0-9]+m' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(shipped_tat, 'm', 1), ' ', -1) AS UNSIGNED)
                  ELSE 0 END, 0
                ) * 60 -- Convert minutes to seconds
              )               ELSE NULL END
              
            WHEN processed_time IS NOT NULL AND shipped_time IS NULL THEN
              CASE WHEN (
                COALESCE(
                  CASE WHEN processed_tat REGEXP '[0-9]+d' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(processed_tat, 'd', 1), ' ', -1) AS UNSIGNED) * 1440 
                  ELSE 0 END +
                  CASE WHEN processed_tat REGEXP '[0-9]+h' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(processed_tat, 'h', 1), ' ', -1) AS UNSIGNED) * 60 
                  ELSE 0 END +
                  CASE WHEN processed_tat REGEXP '[0-9]+m' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(processed_tat, 'm', 1), ' ', -1) AS UNSIGNED)
                  ELSE 0 END, 0
                ) > ${parseTimeStringToMinutes(String(processed_tat))}
              ) THEN (
                COALESCE(
                  CASE WHEN processed_tat REGEXP '[0-9]+d' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(processed_tat, 'd', 1), ' ', -1) AS UNSIGNED) * 1440 
                  ELSE 0 END +
                  CASE WHEN processed_tat REGEXP '[0-9]+h' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(processed_tat, 'h', 1), ' ', -1) AS UNSIGNED) * 60 
                  ELSE 0 END +
                  CASE WHEN processed_tat REGEXP '[0-9]+m' THEN 
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(processed_tat, 'm', 1), ' ', -1) AS UNSIGNED)
                  ELSE 0 END, 0
                ) * 60 -- Convert minutes to seconds
              ) ELSE NULL END
              
            ELSE NULL
          END), 0) as avg_delay_sec
        FROM ${targetTable} o
        WHERE placed_time IS NOT NULL
          AND (
            delivered_time IS NOT NULL OR 
            shipped_time IS NOT NULL OR 
            processed_time IS NOT NULL
          )
                  GROUP BY DATE(placed_time), brand_name, country_code, current_stage
          HAVING current_stage IS NOT NULL
          ORDER BY DATE(placed_time), current_stage
      `;

      await analyticsDb.execute(summaryQuery);
      
      console.log(`Generated daily summary with proper stage assignment: ${brand}_${country}`);
    } catch (error) {
      console.warn(`Failed to generate daily summary for ${brand}_${country}:`, error);
    }
  }
} 