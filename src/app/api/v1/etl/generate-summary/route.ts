import { NextRequest, NextResponse } from 'next/server';
import { ETLService } from '@/lib/etl';
import { getAnalyticsDb } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brandCode = searchParams.get('brand');
    const countryCode = searchParams.get('country');
    const force = searchParams.get('force') === 'true'; // Force regeneration even if data exists

    const db = await getAnalyticsDb();
    const etlService = new ETLService();
    
    // Get all existing order tables in analytics DB
    const [tableRows] = await db.execute(`
      SELECT TABLE_NAME, TABLE_ROWS as estimated_rows
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME LIKE 'orders_%'
      AND TABLE_NAME REGEXP '^orders_[a-z]+_[a-z]{2}$'
      ORDER BY TABLE_NAME
    `);

    let orderTables = tableRows as Array<{ TABLE_NAME: string; estimated_rows: number }>;
    
    // Filter tables based on brand/country if specified
    if (brandCode || countryCode) {
      orderTables = orderTables.filter(table => {
        const tableName = table.TABLE_NAME;
        const match = tableName.match(/^orders_([a-z]+)_([a-z]{2})$/);
        if (!match) return false;
        
        const [, brand, country] = match;
        
        if (brandCode && brand !== brandCode.toLowerCase()) return false;
        if (countryCode && country !== countryCode.toLowerCase()) return false;
        
        return true;
      });
    }

    if (orderTables.length === 0) {
      return NextResponse.json({
        message: 'No matching order tables found',
        filters: { brand: brandCode, country: countryCode },
        available_tables: [],
        summary_generation_results: []
      });
    }

    console.log(`Found ${orderTables.length} order tables to process summary generation`);

    const results = [];
    let totalProcessed = 0;
    let successCount = 0;
    let errorCount = 0;

    // Process each order table
    for (const tableInfo of orderTables) {
      const tableName = tableInfo.TABLE_NAME;
      const estimatedRows = tableInfo.estimated_rows;
      
      // Extract brand and country from table name
      const match = tableName.match(/^orders_([a-z]+)_([a-z]{2})$/);
      if (!match) {
        console.warn(`Skipping table with invalid name format: ${tableName}`);
        continue;
      }
      
      const [, brand, country] = match;
      
      try {
        console.log(`Generating summary for ${tableName} (${estimatedRows} estimated rows)`);
        
        // Check if table has data
        const [dataCheck] = await db.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
        const actualRows = (dataCheck as { count: number }[])[0].count;
        
        if (actualRows === 0) {
          results.push({
            table_name: tableName,
            brand,
            country,
            success: true,
            message: 'Table is empty, skipped summary generation',
            records_processed: 0,
            summary_records_generated: 0
          });
          continue;
        }

        // Check if summary data already exists (unless force=true)
        if (!force) {
          const brandName = getBrandName(brand);
          const [existingCheck] = await db.execute(`
            SELECT COUNT(*) as count 
            FROM sla_daily_summary 
            WHERE brand_name = ? AND country_code = ?
          `, [brandName, country.toUpperCase()]);
          
          const existingSummaryCount = (existingCheck as { count: number }[])[0].count;
          
          if (existingSummaryCount > 0) {
            results.push({
              table_name: tableName,
              brand,
              country,
              success: true,
              message: `Summary data already exists (${existingSummaryCount} records). Use force=true to regenerate.`,
              records_processed: actualRows,
              summary_records_generated: existingSummaryCount,
              skipped: true
            });
            continue;
          }
        }

        // Generate summary using ETLService method
        await etlService.generateDailySummaryForTable(tableName, brand, country);
        
        // Count generated summary records
        const brandName = getBrandName(brand);
        const [summaryCheck] = await db.execute(`
          SELECT COUNT(*) as count 
          FROM sla_daily_summary 
          WHERE brand_name = ? AND country_code = ?
        `, [brandName, country.toUpperCase()]);
        
        const summaryRecordsGenerated = (summaryCheck as { count: number }[])[0].count;
        
        results.push({
          table_name: tableName,
          brand,
          country,
          success: true,
          message: 'Summary generated successfully',
          records_processed: actualRows,
          summary_records_generated: summaryRecordsGenerated
        });
        
        totalProcessed += actualRows;
        successCount++;
        
      } catch (error) {
        console.error(`Failed to generate summary for ${tableName}:`, error);
        
        results.push({
          table_name: tableName,
          brand,
          country,
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error',
          records_processed: 0,
          summary_records_generated: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        errorCount++;
      }
    }

    // Generate overall summary
    const summary = {
      total_tables_processed: orderTables.length,
      successful_generations: successCount,
      failed_generations: errorCount,
      total_records_processed: totalProcessed,
      total_summary_records: results.reduce((sum, r) => sum + (r.summary_records_generated || 0), 0)
    };

    const response = {
      message: 'Summary generation completed',
      timestamp: new Date().toISOString(),
      filters: {
        brand: brandCode || 'all',
        country: countryCode || 'all',
        force_regeneration: force
      },
      summary,
      results,
      usage: {
        generate_all: 'POST /api/v1/etl/generate-summary',
        generate_specific: 'POST /api/v1/etl/generate-summary?brand=vs&country=my',
        force_regenerate: 'POST /api/v1/etl/generate-summary?force=true',
        check_tables: 'GET /api/v1/etl/generate-summary'
      }
    };

    console.log('Summary generation completed:', summary);
    
    if (errorCount > 0) {
      return NextResponse.json(response, { status: 207 }); // Multi-status
    }
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('Summary generation API error:', error);
    return NextResponse.json(
      { 
        error: 'Summary generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// GET endpoint to preview what tables would be processed
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brandCode = searchParams.get('brand');
    const countryCode = searchParams.get('country');

    const db = await getAnalyticsDb();
    
    // Get all existing order tables
    const [tableRows] = await db.execute(`
      SELECT 
        TABLE_NAME, 
        TABLE_ROWS as estimated_rows,
        ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) as size_mb
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME LIKE 'orders_%'
      AND TABLE_NAME REGEXP '^orders_[a-z]+_[a-z]{2}$'
      ORDER BY TABLE_NAME
    `);

    const orderTables = tableRows as Array<{ 
      TABLE_NAME: string; 
      estimated_rows: number;
      size_mb: number;
    }>;
    
    // Filter and enrich table information
    const tableInfo = [];
    
    for (const table of orderTables) {
      const tableName = table.TABLE_NAME;
      const match = tableName.match(/^orders_([a-z]+)_([a-z]{2})$/);
      if (!match) continue;
      
      const [, brand, country] = match;
      
      // Apply filters
      if (brandCode && brand !== brandCode.toLowerCase()) continue;
      if (countryCode && country !== countryCode.toLowerCase()) continue;
      
      // Check actual row count and existing summary data
      const [actualCountResult] = await db.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
      const actualRows = (actualCountResult as { count: number }[])[0].count;
      
      const brandName = getBrandName(brand);
      const [summaryCountResult] = await db.execute(`
        SELECT COUNT(*) as count 
        FROM sla_daily_summary 
        WHERE brand_name = ? AND country_code = ?
      `, [brandName, country.toUpperCase()]);
      const existingSummaryRecords = (summaryCountResult as { count: number }[])[0].count;
      
      tableInfo.push({
        table_name: tableName,
        brand_code: brand,
        brand_name: brandName,
        country_code: country.toUpperCase(),
        estimated_rows: table.estimated_rows,
        actual_rows: actualRows,
        size_mb: table.size_mb,
        existing_summary_records: existingSummaryRecords,
        has_summary_data: existingSummaryRecords > 0,
        will_be_processed: actualRows > 0
      });
    }

    const summary = {
      total_tables_found: tableInfo.length,
      tables_with_data: tableInfo.filter(t => t.actual_rows > 0).length,
      tables_with_existing_summaries: tableInfo.filter(t => t.has_summary_data).length,
      total_order_records: tableInfo.reduce((sum, t) => sum + t.actual_rows, 0),
      total_existing_summary_records: tableInfo.reduce((sum, t) => sum + t.existing_summary_records, 0)
    };

    return NextResponse.json({
      message: 'Summary generation preview',
      timestamp: new Date().toISOString(),
      filters: {
        brand: brandCode || 'all',
        country: countryCode || 'all'
      },
      summary,
      tables: tableInfo,
      actions: {
        generate_summaries: 'POST /api/v1/etl/generate-summary',
        generate_specific: 'POST /api/v1/etl/generate-summary?brand=vs&country=my',
        force_regenerate: 'POST /api/v1/etl/generate-summary?force=true'
      }
    });

  } catch (error) {
    console.error('Summary generation preview error:', error);
    return NextResponse.json(
      { 
        error: 'Preview failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper function to get brand display name
function getBrandName(brandCode: string): string {
  switch (brandCode) {
    case 'vs': return "Victoria's Secret";
    case 'bbw': return 'Bath & Body Works';
    case 'rituals': return 'Rituals';
    default: return 'Unknown';
  }
} 