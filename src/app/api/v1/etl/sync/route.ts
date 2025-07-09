import { NextRequest, NextResponse } from 'next/server';
import { getMasterDb, getAnalyticsDb } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brandCode = searchParams.get('brand') || 'all';
    const countryCode = searchParams.get('country') || 'all';

    const masterDb = await getMasterDb();
    const analyticsDb = await getAnalyticsDb();

    const results: Array<{ 
      brand: string; 
      country: string; 
      success: boolean;
      processed: number;
      error?: string;
    }> = [];

    // Simple approach: discover all available source tables first
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
      return NextResponse.json({
        message: 'No source tables found',
        error: 'No tables matching pattern *_[country]_orders found in master database'
      }, { status: 404 });
    }

    // Process each table
    for (const sourceTable of sourceTableNames) {
      // Extract brand and country from table name
      const match = sourceTable.match(/^(.+)_([a-z]{2})_orders$/);
      if (!match) continue;
      
      const [, brandPart, country] = match;
      
             // Map brand part to brand code first
       let brand = 'unknown';
       if (brandPart.includes('victoriasecret') || brandPart.includes('vs')) {
         brand = 'vs';
       } else if (brandPart.includes('bbw')) {
         brand = 'bbw';
       } else if (brandPart.includes('rituals')) {
         brand = 'rituals';
       }

       // Skip if filtering by specific brand/country
       if (brandCode !== 'all' && brand !== brandCode.toLowerCase()) continue;
       if (countryCode !== 'all' && country !== countryCode.toLowerCase()) continue;

      try {
                 console.log(`Processing table: ${sourceTable}`);

        const targetTable = `orders_${brand}_${country}`;
        
        // Create target table if it doesn't exist
        await analyticsDb.execute(`
          CREATE TABLE IF NOT EXISTS ${targetTable} (
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
            INDEX idx_brand_country (brand_name, country_code)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Get a sample of available columns from source table
        const [columns] = await masterDb.execute(`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = ?
          ORDER BY ORDINAL_POSITION
        `, [sourceTable]);

        const availableColumns = (columns as { COLUMN_NAME: string }[]).map(row => row.COLUMN_NAME);
        console.log(`Available columns in ${sourceTable}:`, availableColumns);

        // Build a simple query with only columns that exist
        const selectFields: string[] = [];
        
        // Required field - order_no (try different variations)
        if (availableColumns.includes('order_no')) {
          selectFields.push('order_no');
        } else if (availableColumns.includes('order_number')) {
          selectFields.push('order_number as order_no');
        } else if (availableColumns.includes('orderid')) {
          selectFields.push('orderid as order_no');
        } else {
          throw new Error('No order identifier column found');
        }

        // Optional fields - add if they exist
        if (availableColumns.includes('order_status')) selectFields.push('order_status');
        if (availableColumns.includes('shipping_status')) selectFields.push('shipping_status');
        if (availableColumns.includes('confirmation_status')) selectFields.push('confirmation_status');
        if (availableColumns.includes('processed_time')) selectFields.push('processed_time as processing_time');
        if (availableColumns.includes('shipped_time')) selectFields.push('shipped_time');
        if (availableColumns.includes('delivered_time')) selectFields.push('delivered_time');
        
        // Date fields
        if (availableColumns.includes('order_created_date_time')) {
          selectFields.push('DATE(order_created_date_time) as order_date');
        } else if (availableColumns.includes('created_at')) {
          selectFields.push('DATE(created_at) as order_date');
        } else if (availableColumns.includes('order_date')) {
          selectFields.push('order_date');
        }

        // Add brand and country
        const brandName = brand === 'vs' ? "Victoria's Secret" : 
                          brand === 'bbw' ? 'Bath & Body Works' : 
                          brand === 'rituals' ? 'Rituals' : 'Unknown';
        
        // Escape single quotes in brand name for SQL
        const escapedBrandName = brandName.replace(/'/g, "''");
        selectFields.push(`'${escapedBrandName}' as brand_name`);
        selectFields.push(`UPPER('${country}') as country_code`);
        selectFields.push('NOW() as updated_at');

        // Simple query - get all records
        const query = `
          SELECT ${selectFields.join(', ')}
          FROM ${sourceTable}
          ORDER BY ${availableColumns.includes('order_created_date_time') ? 'order_created_date_time' : 
                      availableColumns.includes('created_at') ? 'created_at' : '1'} DESC
        `;

        console.log(`Executing query for ${sourceTable}:`, query);
        const [sourceRows] = await masterDb.execute(query);
        const rows = sourceRows as Record<string, string | number | Date | null>[];

        console.log(`Found ${rows.length} rows in ${sourceTable}`);

        if (rows.length === 0) {
          results.push({
            brand,
            country,
            success: true,
            processed: 0
          });
          continue;
        }

        // Insert the data
        let processed = 0;
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

        results.push({
          brand,
          country,
          success: true,
          processed
        });

        console.log(`Successfully processed ${processed} records for ${brand}_${country}`);

      } catch (error) {
        console.error(`Error processing ${sourceTable}:`, error);
        results.push({
          brand: brandPart,
          country,
          success: false,
          processed: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const summary = {
      total_jobs: results.length,
      successful_jobs: results.filter(r => r.success).length,
      failed_jobs: results.filter(r => !r.success).length,
      total_processed: results.reduce((sum, r) => sum + r.processed, 0),
      results
    };

    console.log('ETL Sync Summary:', summary);

    return NextResponse.json({
      message: 'ETL sync completed',
      summary,
      usage: {
        sync_all: 'POST /api/v1/etl/sync',
        sync_specific: 'POST /api/v1/etl/sync?brand=vs&country=my'
      }
    });

  } catch (error) {
    console.error('ETL sync API error:', error);
    return NextResponse.json(
      { 
        error: 'ETL sync failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check available tables
export async function GET() {
  try {
    const masterDb = await getMasterDb();
    
    // Check available source tables
    const [tables] = await masterDb.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME REGEXP '_[a-z]{2}_orders$'
      ORDER BY TABLE_NAME
    `);

    const sourceTableNames = (tables as { TABLE_NAME: string }[]).map(row => row.TABLE_NAME);

    // For each table, get basic info
    const tableInfo = [];
    for (const tableName of sourceTableNames) {
      try {
        const [countResult] = await masterDb.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
        const count = (countResult as { count: number }[])[0].count;
        
        const [columns] = await masterDb.execute(`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = ?
          ORDER BY ORDINAL_POSITION
        `, [tableName]);

        const columnNames = (columns as { COLUMN_NAME: string }[]).map(row => row.COLUMN_NAME);

        tableInfo.push({
          table_name: tableName,
          record_count: count,
          columns: columnNames
        });
      } catch (error) {
        console.warn(`Could not analyze table ${tableName}:`, error);
        tableInfo.push({
          table_name: tableName,
          record_count: 0,
          error: 'Access denied or table does not exist'
        });
      }
    }

    return NextResponse.json({
      message: 'ETL service status',
      available_tables: tableInfo,
      usage: {
        sync_all: 'POST /api/v1/etl/sync',
        sync_specific: 'POST /api/v1/etl/sync?brand=vs&country=my',
        discover_tables: 'GET /api/v1/etl/discover'
      }
    });

  } catch (error) {
    console.error('ETL status API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get ETL status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 