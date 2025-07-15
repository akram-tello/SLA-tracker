import { NextResponse } from 'next/server';
import { ETLService } from '@/lib/etl';

export async function POST() {
  try {
    const etlService = new ETLService();
    
    // Run orphaned data cleanup
    const cleanupResult = await etlService.cleanupOrphanedSummaryData();
    
    // Run full data integrity validation after cleanup
    const integrityReport = await etlService.validateDataIntegrity();
    
    const response = {
      message: 'Cleanup completed',
      timestamp: new Date().toISOString(),
      cleanup_results: cleanupResult,
      post_cleanup_integrity: integrityReport.summary,
      recommendations: generateCleanupRecommendations(cleanupResult, integrityReport)
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Cleanup operation failed:', error);
    
    return NextResponse.json(
      {
        error: 'Cleanup failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const etlService = new ETLService();
    
    // Preview what would be cleaned up without actually cleaning
    const previewResult = await etlService.cleanupOrphanedSummaryData();
    
    const response = {
      message: 'Cleanup preview (no changes made)',
      timestamp: new Date().toISOString(),
      preview: previewResult,
      actions: {
        run_cleanup: {
          endpoint: 'POST /api/v1/etl/cleanup',
          description: 'Execute the cleanup operation'
        }
      }
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Cleanup preview failed:', error);
    
    return NextResponse.json(
      {
        error: 'Cleanup preview failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

function generateCleanupRecommendations(
  cleanupResult: {
    orphaned_records: Array<{
      brand_name: string;
      country_code: string;
      brand_code: string;
      missing_table: string;
      record_count: number;
    }>;
    total_orphaned: number;
    cleanup_performed: boolean;
  },
  integrityReport: {
    summary: {
      total_issues: number;
      tat_issues: number;
      orphaned_records: number;
      missing_tables: number;
    };
  }
): string[] {
  const recommendations = [];
  
  if (cleanupResult.cleanup_performed && cleanupResult.total_orphaned > 0) {
    recommendations.push(`✅ Successfully cleaned up ${cleanupResult.total_orphaned} orphaned records`);
    
    if (cleanupResult.orphaned_records.length > 0) {
      recommendations.push('📋 Cleaned up data for:');
      cleanupResult.orphaned_records.forEach(record => {
        recommendations.push(`  - ${record.brand_name}/${record.country_code} (${record.record_count} records)`);
        recommendations.push(`    Missing table: ${record.missing_table}`);
      });
    }
  } else if (cleanupResult.total_orphaned === 0) {
    recommendations.push('✅ No orphaned data found - system is clean');
  }
  
  if (integrityReport.summary.total_issues > 0) {
    recommendations.push('⚠️ Remaining data integrity issues:');
    
    if (integrityReport.summary.tat_issues > 0) {
      recommendations.push(`  - ${integrityReport.summary.tat_issues} TAT configuration issues`);
      recommendations.push('    Add missing TAT configurations to resolve');
    }
    
    if (integrityReport.summary.missing_tables > 0) {
      recommendations.push(`  - ${integrityReport.summary.missing_tables} missing order tables`);
      recommendations.push('    Check source database for missing tables');
    }
  }
  
  recommendations.push('🔄 Next steps:');
  recommendations.push('  - Run ETL sync to refresh data: POST /api/v1/etl/sync');
  recommendations.push('  - Monitor data health: GET /api/v1/dashboard/health');
  recommendations.push('  - Check ETL status: GET /api/v1/etl/status');
  
  return recommendations;
} 