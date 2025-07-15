import { NextResponse } from 'next/server';
import { getAnalyticsDb } from '@/lib/db';

export async function GET() {
  try {
    const db = await getAnalyticsDb();
    const currentTime = new Date();
    
    // 1. Check data freshness - how recent is the most recent data
    const [freshnessCheck] = await db.execute(`
      SELECT 
        MAX(refreshed_at) as last_refresh,
        TIMESTAMPDIFF(HOUR, MAX(refreshed_at), NOW()) as hours_stale,
        COUNT(DISTINCT CONCAT(brand_name, '_', country_code)) as brand_country_combinations,
        COUNT(DISTINCT summary_date) as date_range_days,
        MIN(summary_date) as earliest_date,
        MAX(summary_date) as latest_date
      FROM sla_daily_summary
    `);
    
    const freshness = (freshnessCheck as Array<{
      last_refresh: string | null;
      hours_stale: number | null;
      brand_country_combinations: number;
      date_range_days: number;
      earliest_date: string | null;
      latest_date: string | null;
    }>)[0];
    
    // 2. Check for missing data - gaps in expected daily summaries
    const [missingDataCheck] = await db.execute(`
      SELECT 
        brand_name,
        country_code,
        COUNT(DISTINCT summary_date) as days_with_data,
        MIN(summary_date) as first_date,
        MAX(summary_date) as last_date,
        DATEDIFF(MAX(summary_date), MIN(summary_date)) + 1 as expected_days
      FROM sla_daily_summary
      WHERE summary_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY brand_name, country_code
      HAVING days_with_data < expected_days
    `);
    
    // 3. Check stage completeness - ensure all expected stages are present
    const [stageCompletenessCheck] = await db.execute(`
      SELECT 
        brand_name,
        country_code,
        summary_date,
        GROUP_CONCAT(DISTINCT stage ORDER BY stage) as present_stages,
        COUNT(DISTINCT stage) as stage_count
      FROM sla_daily_summary 
      WHERE summary_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY brand_name, country_code, summary_date
      HAVING stage_count < 4
      ORDER BY summary_date DESC
      LIMIT 10
    `);
    
    // 4. Check for data anomalies - unusual patterns
    const [anomalyCheck] = await db.execute(`
      SELECT 
        brand_name,
        country_code,
        summary_date,
        stage,
        orders_total,
        CASE 
          WHEN orders_total = 0 THEN 'Zero orders'
          WHEN orders_on_time > orders_total THEN 'On-time exceeds total'
          WHEN orders_on_risk > orders_total THEN 'On-risk exceeds total'
          WHEN orders_breached > orders_total THEN 'Breached exceeds total'
          WHEN (orders_on_time + orders_on_risk + orders_breached) > orders_total THEN 'Sum exceeds total'
          ELSE 'Normal'
        END as anomaly_type
      FROM sla_daily_summary 
      WHERE summary_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      HAVING anomaly_type != 'Normal'
      ORDER BY summary_date DESC
      LIMIT 20
    `);
    
    // 5. Check table sizes and performance metrics
    const [performanceCheck] = await db.execute(`
      SELECT 
        TABLE_NAME,
        TABLE_ROWS as estimated_rows,
        ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) as size_mb,
        ROUND((INDEX_LENGTH / 1024 / 1024), 2) as index_size_mb
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'sla_daily_summary'
    `);
    
    // Determine overall health status
    const hoursStale = freshness.hours_stale || 0;
    const missingDataCount = (missingDataCheck as Array<Record<string, unknown>>).length;
    const incompleteStagesCount = (stageCompletenessCheck as Array<Record<string, unknown>>).length;
    const anomalyCount = (anomalyCheck as Array<Record<string, unknown>>).length;
    
    let healthStatus = 'healthy';
    const issues = [];
    
    if (hoursStale > 24) {
      healthStatus = 'critical';
      issues.push(`Data is ${hoursStale} hours stale (threshold: 24 hours)`);
    } else if (hoursStale > 6) {
      healthStatus = 'warning';
      issues.push(`Data is ${hoursStale} hours stale (threshold: 6 hours)`);
    }
    
    if (missingDataCount > 0) {
      healthStatus = healthStatus === 'critical' ? 'critical' : 'warning';
      issues.push(`${missingDataCount} brand/country combinations have missing daily data`);
    }
    
    if (incompleteStagesCount > 0) {
      healthStatus = healthStatus === 'critical' ? 'critical' : 'warning';
      issues.push(`${incompleteStagesCount} recent summaries have incomplete stage data`);
    }
    
    if (anomalyCount > 0) {
      healthStatus = healthStatus === 'critical' ? 'critical' : 'warning';
      issues.push(`${anomalyCount} data anomalies detected in recent data`);
    }
    
    const response = {
      status: healthStatus,
      timestamp: currentTime.toISOString(),
      summary: {
        overall_health: healthStatus,
        total_issues: issues.length,
        data_freshness_hours: hoursStale,
        brand_country_combinations: freshness.brand_country_combinations,
        date_coverage_days: freshness.date_range_days
      },
      issues: issues,
      details: {
        data_freshness: {
          last_refresh: freshness.last_refresh,
          hours_stale: hoursStale,
          earliest_date: freshness.earliest_date,
          latest_date: freshness.latest_date,
          total_combinations: freshness.brand_country_combinations
        },
        missing_data: missingDataCheck,
        incomplete_stages: stageCompletenessCheck,
        anomalies: anomalyCheck,
        performance: performanceCheck
      },
      recommendations: generateHealthRecommendations(healthStatus, issues, hoursStale, missingDataCount, anomalyCount)
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json(
      {
        status: 'critical',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        summary: {
          overall_health: 'critical',
          total_issues: 1,
          data_freshness_hours: null,
          brand_country_combinations: null,
          date_coverage_days: null
        },
        issues: ['Health check API failed to execute'],
        recommendations: ['Check database connectivity and API logs']
      },
      { status: 500 }
    );
  }
}

function generateHealthRecommendations(
  status: string, 
  issues: string[], 
  hoursStale: number, 
  missingDataCount: number, 
  anomalyCount: number
): string[] {
  const recommendations = [];
  
  if (status === 'critical') {
    recommendations.push('🚨 IMMEDIATE ACTION REQUIRED');
  }
  
  if (hoursStale > 24) {
    recommendations.push('Run ETL sync immediately: POST /api/v1/etl/sync');
    recommendations.push('Check ETL service logs for errors');
    recommendations.push('Verify source database connectivity');
  } else if (hoursStale > 6) {
    recommendations.push('Schedule ETL sync soon: POST /api/v1/etl/sync');
    recommendations.push('Consider implementing automated scheduled syncs');
  }
  
  if (missingDataCount > 0) {
    recommendations.push('Check for deleted source tables or ETL failures');
    recommendations.push('Run data integrity validation: GET /api/v1/etl/validate');
    recommendations.push('Verify TAT configuration completeness');
  }
  
  if (anomalyCount > 0) {
    recommendations.push('Review data anomalies in the details section');
    recommendations.push('Check source data quality and ETL logic');
    recommendations.push('Validate stage calculation logic');
  }
  
  if (status === 'healthy') {
    recommendations.push('✅ System is operating normally');
    recommendations.push('Continue regular monitoring');
  }
  
  return recommendations;
} 