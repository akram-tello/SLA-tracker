import { NextResponse } from 'next/server';
import { ETLService } from '@/lib/etl';

export async function GET() {
  try {
    const etlService = new ETLService();
    
    // Run comprehensive data integrity validation
    const integrityReport = await etlService.validateDataIntegrity();
    
    const response = {
      message: 'Data integrity validation completed',
      timestamp: new Date().toISOString(),
      validation_results: integrityReport,
      recommendations: generateValidationRecommendations(integrityReport)
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Data integrity validation failed:', error);
    
    return NextResponse.json(
      {
        error: 'Validation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

function generateValidationRecommendations(
  integrityReport: {
    summary: {
      total_issues: number;
      tat_issues: number;
      orphaned_records: number;
      missing_tables: number;
    };
    tat_config_issues: Array<{ brand_name: string; country_code: string; issue: string }>;
    missing_order_tables: Array<{ expected_table: string; source_pattern: string; issue: string }>;
    orphaned_summary_data: {
      orphaned_records: Array<{
        brand_name: string;
        country_code: string;
        brand_code: string;
        missing_table: string;
        record_count: number;
      }>;
      total_orphaned: number;
      cleanup_performed: boolean;
    };
  }
): string[] {
  const recommendations = [];
  
  if (integrityReport.summary.total_issues === 0) {
    recommendations.push('✅ All data integrity checks passed');
    recommendations.push('🎯 System is operating optimally');
    recommendations.push('📊 Regular monitoring recommended');
    return recommendations;
  }
  
  recommendations.push(`⚠️ Found ${integrityReport.summary.total_issues} data integrity issues`);
  
  // TAT Configuration Issues
  if (integrityReport.summary.tat_issues > 0) {
    recommendations.push('');
    recommendations.push('🔧 TAT Configuration Issues:');
    integrityReport.tat_config_issues.forEach(issue => {
      recommendations.push(`  ❌ ${issue.brand_name}/${issue.country_code}: ${issue.issue}`);
    });
    recommendations.push('  💡 Add missing configurations to tat_config table');
    recommendations.push('  💡 Or system will use fallback defaults (2h/2d/7d)');
  }
  
  // Missing Order Tables
  if (integrityReport.summary.missing_tables > 0) {
    recommendations.push('');
    recommendations.push('📋 Missing Order Tables:');
    integrityReport.missing_order_tables.forEach(table => {
      recommendations.push(`  ❌ Expected: ${table.expected_table}`);
      recommendations.push(`     Source pattern: ${table.source_pattern}`);
    });
    recommendations.push('  💡 Check source database for deleted tables');
    recommendations.push('  💡 Run table discovery: GET /api/v1/etl/discover');
  }
  
  // Orphaned Summary Data
  if (integrityReport.summary.orphaned_records > 0) {
    recommendations.push('');
    recommendations.push('🧹 Orphaned Summary Data:');
    integrityReport.orphaned_summary_data.orphaned_records.forEach(record => {
      recommendations.push(`  ❌ ${record.brand_name}/${record.country_code}: ${record.record_count} orphaned records`);
      recommendations.push(`     Missing table: ${record.missing_table}`);
    });
    recommendations.push('  💡 Run cleanup: POST /api/v1/etl/cleanup');
    recommendations.push('  💡 Or preview cleanup: GET /api/v1/etl/cleanup');
  }
  
  // Action Items
  recommendations.push('');
  recommendations.push('🚀 Recommended Actions (in order):');
  
  if (integrityReport.summary.orphaned_records > 0) {
    recommendations.push('  1️⃣ Clean up orphaned data: POST /api/v1/etl/cleanup');
  }
  
  if (integrityReport.summary.missing_tables > 0) {
    recommendations.push('  2️⃣ Investigate missing source tables in master database');
    recommendations.push('  3️⃣ Run table discovery: GET /api/v1/etl/discover');
  }
  
  if (integrityReport.summary.tat_issues > 0) {
    recommendations.push('  4️⃣ Add missing TAT configurations to tat_config table');
  }
  
  recommendations.push('  5️⃣ Run full ETL sync: POST /api/v1/etl/sync');
  recommendations.push('  6️⃣ Verify health status: GET /api/v1/dashboard/health');
  
  return recommendations;
} 