import { NextResponse } from 'next/server';
import { ETLService } from '@/lib/etl';

export async function GET() {
  try {
    const etlService = new ETLService();
    const currentTime = new Date();
    
    // Get available tables information
    const availableTables = await etlService.getAvailableTables();
    
    // Run comprehensive data integrity validation
    const integrityReport = await etlService.validateDataIntegrity();
    
    // Note: Orphaned data report is included in integrityReport.orphaned_summary_data
    
    // Determine ETL system health
    let systemHealth = 'healthy';
    const issues = [];
    
    if (integrityReport.summary.total_issues > 0) {
      if (integrityReport.summary.orphaned_records > 0 || integrityReport.summary.missing_tables > 0) {
        systemHealth = 'critical';
        issues.push(`${integrityReport.summary.orphaned_records} orphaned records and ${integrityReport.summary.missing_tables} missing tables`);
      } else {
        systemHealth = 'warning';
        issues.push(`${integrityReport.summary.tat_issues} TAT configuration issues detected`);
      }
    }
    
    const response = {
      status: systemHealth,
      timestamp: currentTime.toISOString(),
      summary: {
        system_health: systemHealth,
        total_issues: integrityReport.summary.total_issues,
        available_source_tables: availableTables.length,
        orphaned_records: integrityReport.summary.orphaned_records,
        missing_tables: integrityReport.summary.missing_tables,
        tat_config_issues: integrityReport.summary.tat_issues
      },
      issues: issues,
      available_tables: availableTables,
      data_integrity: integrityReport,
      actions: {
        sync_all: {
          endpoint: 'POST /api/v1/etl/sync',
          description: 'Synchronize all available tables'
        },
        sync_specific: {
          endpoint: 'POST /api/v1/etl/sync?brand={brand}&country={country}',
          description: 'Synchronize specific brand/country combination'
        },
        generate_summary: {
          endpoint: 'POST /api/v1/etl/generate-summary',
          description: 'Generate SLA summaries from existing data (without sync)'
        },
        generate_summary_specific: {
          endpoint: 'POST /api/v1/etl/generate-summary?brand={brand}&country={country}',
          description: 'Generate summaries for specific brand/country from existing data'
        },
        cleanup_orphaned: {
          endpoint: 'POST /api/v1/etl/cleanup',
          description: 'Clean up orphaned summary data'
        },
        discover_tables: {
          endpoint: 'GET /api/v1/etl/discover',
          description: 'Discover available source tables'
        },
        create_tables: {
          endpoint: 'POST /api/v1/etl/discover',
          description: 'Create missing target tables'
        }
      },
      recommendations: generateETLRecommendations(systemHealth, integrityReport)
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('ETL status check failed:', error);
    
    return NextResponse.json(
      {
        status: 'critical',
        timestamp: new Date().toISOString(),
        error: 'ETL status check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        summary: {
          system_health: 'critical',
          total_issues: 1,
          available_source_tables: null,
          orphaned_records: null,
          missing_tables: null,
          tat_config_issues: null
        },
        issues: ['ETL status API failed to execute'],
        recommendations: ['Check ETL service and database connectivity']
      },
      { status: 500 }
    );
  }
}

function generateETLRecommendations(
  systemHealth: string,
  integrityReport: {
    summary: {
      total_issues: number;
      tat_issues: number;
      orphaned_records: number;
      missing_tables: number;
    };
    tat_config_issues: Array<{ brand_name: string; country_code: string; issue: string }>;
    missing_order_tables: Array<{ expected_table: string; source_pattern: string; issue: string }>;
  }
): string[] {
  const recommendations = [];
  
  if (systemHealth === 'critical') {
    recommendations.push('CRITICAL ETL ISSUES DETECTED');
  }
  
  if (integrityReport.summary.missing_tables > 0) {
    recommendations.push('Missing order tables detected:');
    integrityReport.missing_order_tables.forEach(table => {
      recommendations.push(`  - Check source table: ${table.source_pattern}`);
    });
    recommendations.push('Run table discovery: GET /api/v1/etl/discover');
  }
  
  if (integrityReport.summary.orphaned_records > 0) {
    recommendations.push('🧹 Orphaned summary data found:');
    recommendations.push(`  - ${integrityReport.summary.orphaned_records} records need cleanup`);
    recommendations.push('Run cleanup: POST /api/v1/etl/cleanup');
  }
  
  if (integrityReport.summary.tat_issues > 0) {
    recommendations.push('⚙️ TAT Configuration issues:');
    integrityReport.tat_config_issues.forEach(issue => {
      recommendations.push(`  - ${issue.brand_name}/${issue.country_code}: ${issue.issue}`);
    });
    recommendations.push('Add missing TAT configurations to tat_config table');
  }
  
  if (systemHealth === 'healthy') {
    recommendations.push('✅ ETL system is operating normally');
    recommendations.push('Regular sync schedule recommended');
    recommendations.push('Monitor data freshness via: GET /api/v1/dashboard/health');
  } else {
    recommendations.push('🔄 Run full ETL sync after resolving issues: POST /api/v1/etl/sync');
  }
  
  return recommendations;
} 