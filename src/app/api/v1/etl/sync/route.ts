import { NextRequest, NextResponse } from 'next/server';
import { ETLService, ETLJobResult } from '@/lib/etl';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brandCode = searchParams.get('brand') || 'all';
    const countryCode = searchParams.get('country') || 'all';

    const etlService = new ETLService();
    const results: Array<{ brand: string; country: string; result: ETLJobResult }> = [];

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
      const result = await etlService.syncOrderData(brandCode, countryCode);
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
      results: results.map(r => ({
        brand_country: `${r.brand}_${r.country}`,
        success: r.result.success,
        processed: r.result.processed,
        duration_ms: r.result.duration,
        errors: r.result.errors
      }))
    };

    console.log('ETL Sync Summary:', summary);

    return NextResponse.json({
      message: 'ETL sync completed',
      summary
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

    return NextResponse.json({
      message: 'ETL service status',
      available_combinations: combinations,
      usage: {
        sync_all: 'POST /api/v1/etl/sync',
        sync_specific: 'POST /api/v1/etl/sync?brand=VS&country=MY'
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