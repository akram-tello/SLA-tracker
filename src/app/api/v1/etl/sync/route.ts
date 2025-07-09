import { NextRequest, NextResponse } from 'next/server';
import { ETLService } from '@/lib/etl';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brandCode = searchParams.get('brand') || 'all';
    const countryCode = searchParams.get('country') || 'all';

    const etlService = new ETLService();

    const results: Array<{ 
      brand: string; 
      country: string; 
      result: Awaited<ReturnType<typeof etlService.syncOrderData>>; 
    }> = [];

    if (brandCode === 'all' || countryCode === 'all') {
      // Sync all brand-country combinations
      const combinations = await etlService.getAllBrandCountryCombinations();
      
      for (const combo of combinations) {
        console.log(`Starting ETL sync for ${combo.brand_code}_${combo.country_code} from ${combo.source_table}`);
        const result = await etlService.syncOrderData(combo.brand_code, combo.country_code, combo.source_table);
        results.push({
          brand: combo.brand_code,
          country: combo.country_code,
          result
        });
      }
    } else {
      // Sync specific brand-country combination
      console.log(`Starting ETL sync for ${brandCode}_${countryCode}`);
      const result = await etlService.syncOrderData(brandCode, countryCode, undefined);
      results.push({
        brand: brandCode,
        country: countryCode,
        result
      });
    }

    // Calculate summary statistics
    const summary = {
      total_jobs: results.length,
      successful_jobs: results.filter(r => r.result.success).length,
      failed_jobs: results.filter(r => !r.result.success).length,
      total_processed: results.reduce((sum, r) => sum + r.result.processed, 0),
      total_duration: results.reduce((sum, r) => sum + r.result.duration, 0),
      pagination_summary: {
        jobs_with_more_data: results.filter(r => r.result.pagination?.has_more).length,
        total_batches_processed: results.reduce((sum, r) => sum + (r.result.pagination?.current_batch || 0), 0),
        total_batches_remaining: results.reduce((sum, r) => {
          const pagination = r.result.pagination;
          return sum + (pagination ? pagination.total_batches - pagination.current_batch : 0);
        }, 0)
      },
      results: results.map(r => ({
        brand_country: `${r.brand}_${r.country}`,
        success: r.result.success,
        processed: r.result.processed,
        duration_ms: r.result.duration,
        pagination: r.result.pagination,
        errors: r.result.errors
      }))
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

// GET endpoint to check ETL status and available combinations
export async function GET() {
  try {
    const etlService = new ETLService();
    const combinations = await etlService.getAllBrandCountryCombinations();
    // const discoveries = await etlService.discoverTables();

    return NextResponse.json({
      message: 'ETL service status',
      available_combinations: combinations,
      // discovered_tables: discoveries,
      usage: {
        sync_all: 'POST /api/v1/etl/sync',
        sync_specific: 'POST /api/v1/etl/sync?brand=vs&country=my',
        discover_tables: 'GET /api/v1/etl/discover',
        prepare_tables: 'POST /api/v1/etl/discover'
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