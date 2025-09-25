import { NextResponse } from 'next/server';
import { getMasterDb, getAnalyticsDb } from '@/lib/db';
import { TableDiscovery, BrandConfig } from '@/lib/types';

// Brand configurations with table patterns
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

// Shared discovery logic
async function discoverTables(): Promise<TableDiscovery[]> {
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
    // Extract brand_code and country_code from table name
    const match = sourceTable.match(/^(.+)_([a-z]{2})_orders$/);
    if (!match) continue;
    
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
    
    // Get record count from source table (master DB)
    let masterRecordCount = 0;
    try {
      const [countResult] = await masterDb.execute(`SELECT COUNT(*) as count FROM ${sourceTable} WHERE confirmation_status = 'CONFIRMED'`);
      masterRecordCount = (countResult as { count: number }[])[0].count;
    } catch (error) {
      console.warn(`Could not get record count for ${sourceTable}:`, error);
    }
    
    // Get record count from target table (SLA DB) and last sync time
    let slaRecordCount = 0;
    let lastSync: Date | undefined;
    if (existsInTarget) {
      try {
        const [syncResult] = await analyticsDb.execute(`
          SELECT 
            MAX(updated_at) as last_sync,
            COUNT(*) as count
          FROM ${targetTable}
        `);
        const result = (syncResult as { last_sync: string | null; count: number }[])[0];
        
        if (result?.last_sync) {
          lastSync = new Date(result.last_sync);
        }
        slaRecordCount = result?.count || 0;
      } catch (error) {
        console.warn(`Could not get sync info for ${targetTable}:`, error);
      }
    }
    
    discoveries.push({
      source_table: sourceTable,
      target_table: targetTable,
      brand_code: brandConfig.brand_code,
      country_code: countryCode,
      brand_name: brandConfig.brand_name,
      exists_in_target: existsInTarget,
      last_sync: lastSync,
      master_record_count: masterRecordCount,
      sla_record_count: slaRecordCount
    });
  }
  
  return discoveries;
}

export async function GET() {
  try {
    const discoveries = await discoverTables();
    
    return NextResponse.json({
      message: 'Table discovery completed',
      discovered_tables: discoveries.length,
      tables: discoveries,
      summary: {
        total_discovered: discoveries.length,
        existing_targets: discoveries.filter(d => d.exists_in_target).length,
        missing_targets: discoveries.filter(d => !d.exists_in_target).length,
        total_master_records: discoveries.reduce((sum, d) => sum + (d.master_record_count || 0), 0),
        total_sla_records: discoveries.reduce((sum, d) => sum + (d.sla_record_count || 0), 0)
      }
    });
    
  } catch (error) {
    console.error('Table discovery error:', error);
    return NextResponse.json(
      { 
        error: 'Table discovery failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const analyticsDb = await getAnalyticsDb();
    
    // Get discovered tables using shared function
    const discoveries = await discoverTables();
    const createdTables: string[] = [];
    const errors: string[] = [];
    
    console.log(`Found ${discoveries.length} tables to process`);
    console.log('Tables needing creation:', discoveries.filter(d => !d.exists_in_target).map(d => d.target_table));
    
    // Create missing target tables
    for (const discovery of discoveries) {
      if (!discovery.exists_in_target) {
        try {
          console.log(`Creating table: ${discovery.target_table}`);
          
          const createTableQuery = `
            CREATE TABLE IF NOT EXISTS ${discovery.target_table} (
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
          createdTables.push(discovery.target_table);
          console.log(`Successfully created table: ${discovery.target_table}`);
          
        } catch (error) {
          const errorMsg = `Failed to create table ${discovery.target_table}: ${error}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }
    }
    
    return NextResponse.json({
      message: 'Table preparation completed',
      created_tables: createdTables,
      errors: errors,
      summary: {
        total_tables: discoveries.length,
        created: createdTables.length,
        already_existed: discoveries.filter(d => d.exists_in_target).length,
        errors: errors.length
      }
    });
    
  } catch (error) {
    console.error('Table preparation error:', error);
    return NextResponse.json(
      { 
        error: 'Table preparation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 