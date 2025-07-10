import { NextRequest, NextResponse } from 'next/server';
import { ETLService } from '@/lib/etl';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brandCode = searchParams.get('brand') || 'all';
    const countryCode = searchParams.get('country') || 'all';

    const etlService = new ETLService();
    let summary;

    if (brandCode === 'all' && countryCode === 'all') {
      // Sync all tables
      summary = await etlService.syncAll();
    } else {
      // Sync specific brand/country
      summary = await etlService.syncSpecific(brandCode, countryCode);
    }

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
    const etlService = new ETLService();
    const tableInfo = await etlService.getAvailableTables();

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