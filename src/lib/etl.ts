import { getMasterDb, getAnalyticsDb } from './db';
import { 
  ETLJobResult, 
  TableDiscovery, 
  ColumnMapping, 
  ETLJobOptions, 
  ETLPaginationResult,
  BrandConfig 
} from './types';

// Default column mappings for order tables
const DEFAULT_COLUMN_MAPPINGS: ColumnMapping[] = [
  { source_column: 'order_no', target_column: 'order_no', data_type: 'VARCHAR(100)', is_required: true },
  { source_column: 'order_status', target_column: 'order_status', data_type: 'VARCHAR(50)', is_required: false },
  { source_column: 'shipping_status', target_column: 'shipping_status', data_type: 'VARCHAR(50)', is_required: false },
  { source_column: 'confirmation_status', target_column: 'confirmation_status', data_type: 'VARCHAR(50)', is_required: false },
  { source_column: 'processed_time', target_column: 'processing_time', data_type: 'DATETIME', is_required: false },
  { source_column: 'shipped_time', target_column: 'shipped_time', data_type: 'DATETIME', is_required: false },
  { source_column: 'delivered_time', target_column: 'delivered_time', data_type: 'DATETIME', is_required: false },
  { 
    source_column: 'processed_tat', 
    target_column: 'processed_tat', 
    data_type: 'INT', 
    is_required: false,
    transformation: 'CASE WHEN processed_time IS NOT NULL AND order_created_date_time IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, order_created_date_time, processed_time) ELSE NULL END'
  },
  { 
    source_column: 'shipped_tat', 
    target_column: 'shipped_tat', 
    data_type: 'INT', 
    is_required: false,
    transformation: 'CASE WHEN shipped_time IS NOT NULL AND processed_time IS NOT NULL THEN DATEDIFF(shipped_time, processed_time) ELSE NULL END'
  },
  { 
    source_column: 'delivered_tat', 
    target_column: 'delivered_tat', 
    data_type: 'INT', 
    is_required: false,
    transformation: 'CASE WHEN delivered_time IS NOT NULL AND shipped_time IS NOT NULL THEN DATEDIFF(delivered_time, shipped_time) ELSE NULL END'
  },
  { 
    source_column: 'order_date', 
    target_column: 'order_date', 
    data_type: 'DATE', 
    is_required: false,
    transformation: 'DATE(order_created_date_time)'
  },
  { source_column: 'country_code', target_column: 'country_code', data_type: 'VARCHAR(10)', is_required: false, transformation: 'UPPER(country_code)' },
  { source_column: 'updated_at', target_column: 'updated_at', data_type: 'TIMESTAMP', is_required: false, transformation: 'NOW()' }
];

// Brand configurations with table patterns maintained
const BRAND_CONFIGS: BrandConfig[] = [
  {
    brand_code: 'vs',
    brand_name: "Victoria's Secret",
    source_table_pattern: 'victoriasecret_%_orders',
    target_table_pattern: 'orders_vs_%'
  },
  {
    brand_code: 'bbw',
    brand_name: 'Bath & Body Works',
    source_table_pattern: 'bbw_%_orders',
    target_table_pattern: 'orders_bbw_%'
  },
  {
    brand_code: 'rituals',
    brand_name: 'Rituals',
    source_table_pattern: 'rituals_%_orders',
    target_table_pattern: 'orders_rituals_%'
  }
];

export class ETLService {
  private defaultOptions: ETLJobOptions = {
    batch_size: 1000,
    sync_strategy: 'incremental',
    sync_window_days: 30
  };

  async discoverTables(): Promise<TableDiscovery[]> {
    const masterDb = await getMasterDb();
    const analyticsDb = await getAnalyticsDb();
    
    const discoveries: TableDiscovery[] = [];
    
    // Discover tables matching our patterns
    const [tables] = await masterDb.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME REGEXP '_[a-z]{2}_orders$'
      ORDER BY TABLE_NAME
    `);
    
    const sourceTableNames = (tables as { TABLE_NAME: string }[]).map(row => row.TABLE_NAME);
    
    for (const sourceTable of sourceTableNames) {
      const discovery = await this.analyzeTable(sourceTable, masterDb, analyticsDb);
      if (discovery) {
        discoveries.push(discovery);
      }
    }
    
    return discoveries;
  }

  private async analyzeTable(sourceTable: string, masterDb: any, analyticsDb: any): Promise<TableDiscovery | null> {
    // Extract brand_code and country_code from table name
    const match = sourceTable.match(/^(.+)_([a-z]{2})_orders$/);
    if (!match) return null;
    
    const [, brandPart, countryCode] = match;
    
    // Find matching brand config or create generic one
    let brandConfig = BRAND_CONFIGS.find(config => 
      sourceTable.startsWith(config.brand_code === 'vs' ? 'victoriasecret' : config.brand_code)
    );
    
    if (!brandConfig) {
      // Generic brand config for unknown brands
      brandConfig = {
        brand_code: brandPart.substring(0, 3),
        brand_name: brandPart.charAt(0).toUpperCase() + brandPart.slice(1),
        source_table_pattern: `${brandPart}_%_orders`,
        target_table_pattern: `orders_${brandPart.substring(0, 3)}_%`
      };
    }
    
    const targetTable = `orders_${brandConfig.brand_code}_${countryCode}`;
    
    // Check if target table exists
    const [targetExists] = await analyticsDb.execute(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = ?
    `, [targetTable]);
    
    const existsInTarget = (targetExists as { count: number }[])[0].count > 0;
    
    // Get record count and last sync
    let recordCount = 0;
    let lastSync: Date | undefined;
    
    try {
      const [countResult] = await masterDb.execute(`SELECT COUNT(*) as count FROM ${sourceTable}`);
      recordCount = (countResult as { count: number }[])[0].count;
    } catch (error) {
      console.warn(`Could not get record count for ${sourceTable}:`, error);
    }
    
    if (existsInTarget) {
      try {
        const [syncResult] = await analyticsDb.execute(`
          SELECT MAX(updated_at) as last_sync FROM ${targetTable}
        `);
        const syncTime = (syncResult as { last_sync: string | null }[])[0]?.last_sync;
        if (syncTime) {
          lastSync = new Date(syncTime);
        }
      } catch (error) {
        console.warn(`Could not get last sync for ${targetTable}:`, error);
      }
    }
    
    return {
      source_table: sourceTable,
      target_table: targetTable,
      brand_code: brandConfig.brand_code,
      country_code: countryCode,
      brand_name: brandConfig.brand_name,
      exists_in_target: existsInTarget,
      last_sync: lastSync,
      record_count: recordCount
    };
  }

  async ensureTargetTableExists(targetTable: string): Promise<void> {
    const analyticsDb = await getAnalyticsDb();
    
    // Check if table exists
    const [exists] = await analyticsDb.execute(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = ?
    `, [targetTable]);
    
    if ((exists as { count: number }[])[0].count === 0) {
      // Create table with proper schema
      const createTableQuery = `
        CREATE TABLE ${targetTable} (
          order_no VARCHAR(100) NOT NULL PRIMARY KEY,
          order_status VARCHAR(50),
          shipping_status VARCHAR(50),
          confirmation_status VARCHAR(50),
          processing_time DATETIME,
          shipped_time DATETIME,
          delivered_time DATETIME,
          processed_tat INT,
          shipped_tat INT,
          delivered_tat INT,
          order_date DATE,
          brand_name VARCHAR(100),
          country_code VARCHAR(10),
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_order_date (order_date),
          INDEX idx_brand_country (brand_name, country_code),
          INDEX idx_updated_at (updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `;
      
      await analyticsDb.execute(createTableQuery);
      console.log(`Created target table: ${targetTable}`);
    }
  }

  private buildSelectQuery(sourceTable: string, brandName: string, columnMappings: ColumnMapping[]): string {
    const selectFields = columnMappings.map(mapping => {
      if (mapping.transformation) {
        return `${mapping.transformation} as ${mapping.target_column}`;
      }
      return `${mapping.source_column} as ${mapping.target_column}`;
    });

    // Add brand_name field with proper mapping
    const brandNameMapping = `'${brandName}' as brand_name`;
    selectFields.push(brandNameMapping);

    return `
      SELECT ${selectFields.join(', ')}
      FROM ${sourceTable}
    `;
  }

  async syncOrderData(
    brandCode: string, 
    countryCode: string, 
    sourceTable?: string, 
    options?: ETLJobOptions
  ): Promise<ETLJobResult & { pagination?: ETLPaginationResult }> {
    const startTime = Date.now();
    const opts = { ...this.defaultOptions, ...options };
    const result: ETLJobResult & { pagination?: ETLPaginationResult } = {
      success: false,
      processed: 0,
      errors: [],
      duration: 0,
    };

    try {
      const masterDb = await getMasterDb();
      const analyticsDb = await getAnalyticsDb();

      // Get table discovery info
      let discovery: TableDiscovery;
      
      if (sourceTable) {
        // Analyze provided source table
        const analyzedTable = await this.analyzeTable(sourceTable, masterDb, analyticsDb);
        if (!analyzedTable) {
          throw new Error(`Invalid source table: ${sourceTable}`);
        }
        discovery = analyzedTable;
      } else {
        // Find discovery by brand and country
        const discoveries = await this.discoverTables();
        const foundDiscovery = discoveries.find(d => 
          d.brand_code === brandCode.toLowerCase() && 
          d.country_code === countryCode.toLowerCase()
        );
        
        if (!foundDiscovery) {
          throw new Error(`No table found for brand: ${brandCode}, country: ${countryCode}`);
        }
        discovery = foundDiscovery;
      }

      // Ensure target table exists - create if needed
      if (!discovery.exists_in_target) {
        console.log(`Target table ${discovery.target_table} does not exist, creating...`);
        await this.ensureTargetTableExists(discovery.target_table);
        
        // Update discovery status after creating table
        discovery.exists_in_target = true;
      }

      // Get column mappings (can be customized per table in the future)
      const columnMappings = DEFAULT_COLUMN_MAPPINGS;

      // Build dynamic select query
      const baseQuery = this.buildSelectQuery(discovery.source_table, discovery.brand_name, columnMappings);

      // Add filtering and pagination
      let whereClause = '';
      const queryParams: any[] = [];

      if (opts.sync_strategy === 'incremental' && discovery.last_sync) {
        whereClause = 'WHERE order_created_date_time > ?';
        queryParams.push(discovery.last_sync);
      } else if (opts.sync_window_days) {
        whereClause = 'WHERE order_created_date_time >= DATE_SUB(NOW(), INTERVAL ? DAY)';
        queryParams.push(opts.sync_window_days);
      }

      // Get total count for pagination
      const countQuery = `SELECT COUNT(*) as total FROM ${discovery.source_table} ${whereClause}`;
      const [countResult] = await masterDb.execute(countQuery, queryParams);
      const totalRecords = (countResult as { total: number }[])[0].total;

      const totalBatches = Math.ceil(totalRecords / opts.batch_size!);
      let currentBatch = 0;
      let totalProcessed = 0;

      // Process in batches
      while (currentBatch < totalBatches && (!opts.max_records || totalProcessed < opts.max_records)) {
        const offset = currentBatch * opts.batch_size!;
        const limit = Math.min(opts.batch_size!, (opts.max_records || Infinity) - totalProcessed);

        const paginatedQuery = `
          ${baseQuery}
          ${whereClause}
          ORDER BY order_created_date_time DESC
          LIMIT ? OFFSET ?
        `;

        const paginationParams = [...queryParams, limit, offset];
        const [sourceRows] = await masterDb.execute(paginatedQuery, paginationParams);
        const rows = sourceRows as Record<string, string | number | Date | null>[];

        if (rows.length === 0) break;

        // Build upsert query
        const targetColumns = columnMappings.map(m => m.target_column);
        targetColumns.push('brand_name'); // Add brand_name column
        
        const placeholders = targetColumns.map(() => '?').join(', ');
        const updateClause = targetColumns
          .filter(col => col !== 'order_no') // Don't update primary key
          .map(col => `${col} = VALUES(${col})`)
          .join(', ');

        const upsertQuery = `
          INSERT INTO ${discovery.target_table} (${targetColumns.join(', ')})
          VALUES (${placeholders})
          ON DUPLICATE KEY UPDATE ${updateClause}
        `;

        // Insert batch
        for (const row of rows) {
          try {
            const values = targetColumns.map(col => row[col]);
            await analyticsDb.execute(upsertQuery, values);
            totalProcessed++;
          } catch (error) {
            result.errors.push(`Failed to upsert order ${row.order_no}: ${error}`);
          }
        }

        currentBatch++;
        console.log(`Processed batch ${currentBatch}/${totalBatches} (${rows.length} records)`);
      }

      // Set pagination info
      result.pagination = {
        current_batch: currentBatch,
        total_batches: totalBatches,
        records_processed: totalProcessed,
        has_more: currentBatch < totalBatches
      };

      result.processed = totalProcessed;

      // Refresh daily summary after sync
      await this.refreshDailySummary(discovery.brand_code, discovery.country_code);

      result.success = result.errors.length === 0;
      result.duration = Date.now() - startTime;

    } catch (error) {
      result.errors.push(`ETL job failed: ${error}`);
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  async refreshDailySummary(brandCode: string, countryCode: string): Promise<void> {
    const analyticsDb = await getAnalyticsDb();
    const targetTable = `orders_${brandCode.toLowerCase()}_${countryCode.toLowerCase()}`;

    // This would be implemented as a stored procedure in production
    const refreshQuery = `
      INSERT INTO sla_daily_summary (
        summary_date, brand_name, country_code, stage,
        orders_total, orders_on_time, orders_on_risk, orders_breached, avg_delay_sec
      )
      SELECT 
        order_date,
        brand_name,
        country_code,
        'Processed' as stage,
        COUNT(*) as orders_total,
        SUM(CASE WHEN processed_tat <= (SELECT processed_tat FROM tat_config t WHERE t.brand_name = o.brand_name AND t.country_code = o.country_code) THEN 1 ELSE 0 END) as orders_on_time,
        SUM(CASE WHEN processed_tat > (SELECT processed_tat * risk_pct / 100 FROM tat_config t WHERE t.brand_name = o.brand_name AND t.country_code = o.country_code) AND processed_tat <= (SELECT processed_tat FROM tat_config t WHERE t.brand_name = o.brand_name AND t.country_code = o.country_code) THEN 1 ELSE 0 END) as orders_on_risk,
        SUM(CASE WHEN processed_tat > (SELECT processed_tat FROM tat_config t WHERE t.brand_name = o.brand_name AND t.country_code = o.country_code) THEN 1 ELSE 0 END) as orders_breached,
        AVG(CASE WHEN processed_tat IS NOT NULL THEN processed_tat * 60 ELSE 0 END) as avg_delay_sec
      FROM ${targetTable} o
      WHERE processing_time IS NOT NULL
      GROUP BY order_date, brand_name, country_code
      ON DUPLICATE KEY UPDATE
        orders_total = VALUES(orders_total),
        orders_on_time = VALUES(orders_on_time),
        orders_on_risk = VALUES(orders_on_risk),
        orders_breached = VALUES(orders_breached),
        avg_delay_sec = VALUES(avg_delay_sec),
        refreshed_at = CURRENT_TIMESTAMP
    `;

    await analyticsDb.execute(refreshQuery);
  }

  async getAllBrandCountryCombinations(): Promise<Array<{brand_code: string, country_code: string, source_table: string}>> {
    const discoveries = await this.discoverTables();
    return discoveries.map(d => ({
      brand_code: d.brand_code,
      country_code: d.country_code,
      source_table: d.source_table
    }));
  }
} 