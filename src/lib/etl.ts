import { getMasterDb, getAnalyticsDb } from './db';

export interface ETLJobResult {
  success: boolean;
  processed: number;
  errors: string[];
  duration: number;
}

export class ETLService {
  async syncOrderData(brandCode: string, countryCode: string, sourceTable?: string): Promise<ETLJobResult> {
    const startTime = Date.now();
    const result: ETLJobResult = {
      success: false,
      processed: 0,
      errors: [],
      duration: 0,
    };

    try {
      const masterDb = await getMasterDb();
      const analyticsDb = await getAnalyticsDb();

      // Use provided source table or determine from brand code
      let actualSourceTable: string;
      if (sourceTable) {
        actualSourceTable = sourceTable;
      } else {
        // Fallback: try to determine source table from brand code
        if (brandCode === 'VS') {
          actualSourceTable = `victoriasecret_${countryCode.toLowerCase()}_orders`;
        } else if (brandCode === 'BBW') {
          actualSourceTable = `bbw_${countryCode.toLowerCase()}_orders`;
        } else {
          actualSourceTable = `${brandCode.toLowerCase()}_${countryCode.toLowerCase()}_orders`;
        }
      }
      
      // Target table pattern: orders_{brand_code}_{country_code}
      const targetTable = `orders_${brandCode}_${countryCode}`;

      // Get last sync timestamp (for future incremental sync)
      const [lastSyncRows] = await analyticsDb.execute(
        `SELECT MAX(updated_at) as last_sync FROM ${targetTable}`
      );
      
      const lastSync = (lastSyncRows as Record<string, string | null>[])[0]?.last_sync || '1970-01-01 00:00:00';
      console.log(`Last sync for ${targetTable}: ${lastSync}`);

      // Fetch new/updated records from master DB
      const [sourceRows] = await masterDb.execute(`
        SELECT 
          order_no, order_status, shipping_status, confirmation_status,
          processed_time as processing_time, shipped_time, delivered_time,
          CASE 
            WHEN processed_time IS NOT NULL AND order_created_date_time IS NOT NULL 
            THEN TIMESTAMPDIFF(MINUTE, order_created_date_time, processed_time)
            ELSE NULL 
          END as processed_tat,
          CASE 
            WHEN shipped_time IS NOT NULL AND processed_time IS NOT NULL 
            THEN DATEDIFF(shipped_time, processed_time)
            ELSE NULL 
          END as shipped_tat,
          CASE 
            WHEN delivered_time IS NOT NULL AND shipped_time IS NOT NULL 
            THEN DATEDIFF(delivered_time, shipped_time)
            ELSE NULL 
          END as delivered_tat,
          DATE(order_created_date_time) as order_date, 
          CASE 
            WHEN '${actualSourceTable}' LIKE 'bbw_%' THEN 'Bath & Body Works'
            WHEN '${actualSourceTable}' LIKE 'victoriasecret_%' THEN 'Victoria\\'s Secret'
            ELSE 'Unknown Brand'
          END as brand_name,
          UPPER(country_code) as country_code, 
          NOW() as updated_at
        FROM ${actualSourceTable}
        WHERE order_created_date_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        ORDER BY order_created_date_time DESC
        LIMIT 1000
      `);

      const rows = sourceRows as Record<string, string | number | Date | null>[];
      
      if (rows.length === 0) {
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }

      // Upsert records into analytics DB
      const upsertQuery = `
        INSERT INTO ${targetTable} (
          order_no, order_status, shipping_status, confirmation_status,
          processing_time, shipped_time, delivered_time,
          processed_tat, shipped_tat, delivered_tat,
          order_date, brand_name, country_code, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          order_status = VALUES(order_status),
          shipping_status = VALUES(shipping_status),
          confirmation_status = VALUES(confirmation_status),
          processing_time = VALUES(processing_time),
          shipped_time = VALUES(shipped_time),
          delivered_time = VALUES(delivered_time),
          processed_tat = VALUES(processed_tat),
          shipped_tat = VALUES(shipped_tat),
          delivered_tat = VALUES(delivered_tat),
          updated_at = VALUES(updated_at)
      `;

      for (const row of rows) {
        try {
          await analyticsDb.execute(upsertQuery, [
            row.order_no, row.order_status, row.shipping_status, row.confirmation_status,
            row.processing_time, row.shipped_time, row.delivered_time,
            row.processed_tat, row.shipped_tat, row.delivered_tat,
            row.order_date, row.brand_name, row.country_code, row.updated_at
          ]);
          result.processed++;
        } catch (error) {
          result.errors.push(`Failed to upsert order ${row.order_no}: ${error}`);
        }
      }

      // Refresh daily summary after sync
      await this.refreshDailySummary(brandCode, countryCode);

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
    const targetTable = `orders_${brandCode}_${countryCode}`;

    // This would be implemented as a stored procedure in production
    // For now, we'll use a simplified approach
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
    const analyticsDb = await getAnalyticsDb();
    
    const [rows] = await analyticsDb.execute(`
      SELECT DISTINCT brand_name, country_code 
      FROM tat_config
    `);

    return (rows as Record<string, string>[]).map(row => {
      // Map brand names to correct codes and source tables
      let brand_code: string;
      let source_table: string;
      
      if (row.brand_name === "Victoria's Secret") {
        brand_code = "VS";
        source_table = `victoriasecret_${row.country_code.toLowerCase()}_orders`;
      } else if (row.brand_name === "Bath & Body Works") {
        brand_code = "BBW";
        source_table = `bbw_${row.country_code.toLowerCase()}_orders`;
      } else {
        // Fallback for other brands
        brand_code = row.brand_name.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase();
        source_table = `${row.brand_name.toLowerCase().replace(/[^a-z]/g, '')}_${row.country_code.toLowerCase()}_orders`;
      }
      
      return {
        brand_code,
        country_code: row.country_code,
        source_table
      };
    });
  }
} 