import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const db = await getAnalyticsDb();
    
    const { searchParams } = new URL(request.url);
    
    const brand = searchParams.get('brand');
    const country = searchParams.get('country');
    const fromDate = searchParams.get('from_date');
    const toDate = searchParams.get('to_date');

    console.log('Dashboard API params:', { brand, country, fromDate, toDate });

    // Build WHERE clause dynamically
    const whereConditions = [];
    const queryParams = [];

    if (brand) {
      whereConditions.push('brand_code = ?');
      queryParams.push(brand);
    }

    if (country) {
      whereConditions.push('country_code = ?');
      queryParams.push(country.toUpperCase());
    }

    if (fromDate && toDate) {
      whereConditions.push('summary_date BETWEEN ? AND ?');
      queryParams.push(fromDate, toDate);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // ========== ENHANCED: KPI Calculations with Pending Metrics ==========
    // Sum totals across all stages including new pending metrics
    const kpiQuery = `
      SELECT 
        SUM(orders_total) as total_orders,
        SUM(orders_on_time) as on_time_orders,
        SUM(orders_on_risk) as on_risk_orders,
        SUM(orders_breached) as breached_orders,
        SUM(orders_pending_total) as pending_orders,
        SUM(orders_at_risk_pending) as at_risk_pending_orders,
        SUM(orders_breached_pending) as breached_pending_orders,
        ROUND(AVG(avg_delay_sec), 0) as avg_delay_seconds,
        ROUND(AVG(avg_pending_hours), 1) as avg_pending_hours,
        -- Calculate completion rate based on actual unique orders
        ROUND(
          (SUM(orders_on_time) * 100.0) / 
          NULLIF(SUM(orders_total), 0), 
          1
        ) as completion_rate,
        -- Calculate pending rate
        ROUND(
          (SUM(orders_pending_total) * 100.0) / 
          NULLIF(SUM(orders_total), 0), 
          1
        ) as pending_rate
      FROM sla_daily_summary 
      ${whereClause}
    `;

    console.log('Executing KPI query:', kpiQuery);
    console.log('With params:', queryParams);

    const [kpiRows] = await db.execute(kpiQuery, queryParams);
    const kpiData = (kpiRows as Record<string, string | number>[])[0];

    // ========== ENHANCED: Stage Breakdown with Pending Metrics ==========
    // Show distribution of orders across their CURRENT stages including pending status
    const stageQuery = `
      SELECT 
        stage,
        SUM(orders_total) as total,
        SUM(orders_on_time) as on_time,
        SUM(orders_on_risk) as on_risk,
        SUM(orders_breached) as breached,
        SUM(orders_pending_total) as pending,
        SUM(orders_at_risk_pending) as at_risk_pending,
        SUM(orders_breached_pending) as breached_pending,
        ROUND(AVG(avg_pending_hours), 1) as avg_pending_hours,
        ROUND(
          (SUM(orders_on_time) * 100.0) / 
          NULLIF(SUM(orders_total), 0), 
          1
        ) as completion_rate,
        ROUND(
          (SUM(orders_pending_total) * 100.0) / 
          NULLIF(SUM(orders_total), 0), 
          1
        ) as pending_rate
      FROM sla_daily_summary 
      ${whereClause}
      GROUP BY stage
      ORDER BY 
        CASE stage 
          WHEN 'Not Processed' THEN 1
          WHEN 'Processed' THEN 2
          WHEN 'Shipped' THEN 3
          WHEN 'Delivered' THEN 4
          ELSE 5
        END
    `;

    console.log('Executing stage query:', stageQuery);
    
    const [stageRows] = await db.execute(stageQuery, queryParams);

    // ========== ENHANCED: Chart Data with Pending Trends ==========
    // Aggregate daily totals properly including pending metrics
    const chartQuery = `
      SELECT 
        summary_date as date,
        SUM(orders_total) as total_orders,
        SUM(orders_on_time) as on_time_orders,
        SUM(orders_breached) as breached_orders,
        SUM(orders_pending_total) as pending_orders,
        SUM(orders_breached_pending) as breached_pending_orders,
        ROUND(
          (SUM(orders_on_time) * 100.0) / 
          NULLIF(SUM(orders_total), 0), 
          1
        ) as completion_rate,
        ROUND(
          (SUM(orders_pending_total) * 100.0) / 
          NULLIF(SUM(orders_total), 0), 
          1
        ) as pending_rate
      FROM sla_daily_summary 
      ${whereClause}
      GROUP BY summary_date
      ORDER BY summary_date
    `;

    console.log('Executing chart query:', chartQuery);
    
    const [chartRows] = await db.execute(chartQuery, queryParams);

    // ========== ENHANCED: Stage KPI Cards with Pending Metrics ==========
    // Show performance metrics for each stage individually including pending status
    const stageKpiQuery = `
      SELECT 
        stage,
        SUM(orders_total) as total_orders,
        SUM(orders_on_time) as on_time_orders,
        SUM(orders_on_risk) as on_risk_orders,
        SUM(orders_breached) as breached_orders,
        SUM(orders_pending_total) as pending_orders,
        SUM(orders_at_risk_pending) as at_risk_pending_orders,
        SUM(orders_breached_pending) as breached_pending_orders,
        ROUND(AVG(avg_pending_hours), 1) as avg_pending_hours,
        ROUND(
          (SUM(orders_on_time) * 100.0) / 
          NULLIF(SUM(orders_total), 0), 
          1
        ) as completion_rate,
        ROUND(
          (SUM(orders_pending_total) * 100.0) / 
          NULLIF(SUM(orders_total), 0), 
          1
        ) as pending_rate,
        ROUND(AVG(avg_delay_sec), 0) as avg_delay_seconds
      FROM sla_daily_summary 
      ${whereClause}
      GROUP BY stage
      ORDER BY 
        CASE stage 
          WHEN 'Not Processed' THEN 1
          WHEN 'Processed' THEN 2
          WHEN 'Shipped' THEN 3
          WHEN 'Delivered' THEN 4
          ELSE 5
        END
    `;

    console.log('Executing stage KPI query:', stageKpiQuery);
    
    const [stageKpiRows] = await db.execute(stageKpiQuery, queryParams);

    // ========== Response Structure ==========
    const response = {
      kpis: {
        total_orders: Number(kpiData.total_orders) || 0,
        on_time_orders: Number(kpiData.on_time_orders) || 0,
        on_risk_orders: Number(kpiData.on_risk_orders) || 0,
        breached_orders: Number(kpiData.breached_orders) || 0,
        completion_rate: Number(kpiData.completion_rate) || 0,
        avg_delay_seconds: Number(kpiData.avg_delay_seconds) || 0
      },
      stage_breakdown: (stageRows as Record<string, string | number>[]).map(row => ({
        stage: String(row.stage),
        total: Number(row.total),
        on_time: Number(row.on_time),
        on_risk: Number(row.on_risk),
        breached: Number(row.breached),
        completion_rate: Number(row.completion_rate) || 0
      })),
      chart_data: (chartRows as Record<string, string | number>[]).map(row => ({
        date: String(row.date),
        total_orders: Number(row.total_orders),
        on_time_orders: Number(row.on_time_orders),
        breached_orders: Number(row.breached_orders),
        completion_rate: Number(row.completion_rate) || 0
      })),
      stage_kpis: (stageKpiRows as Record<string, string | number>[]).map(row => ({
        stage: String(row.stage),
        total_orders: Number(row.total_orders),
        on_time_orders: Number(row.on_time_orders),
        on_risk_orders: Number(row.on_risk_orders),
        breached_orders: Number(row.breached_orders),
        completion_rate: Number(row.completion_rate) || 0,
        avg_delay_seconds: Number(row.avg_delay_seconds) || 0
      }))
    };

    console.log('Dashboard API response summary:', {
      total_orders: response.kpis.total_orders,
      stage_count: response.stage_breakdown.length,
      chart_points: response.chart_data.length,
      stage_kpis_count: response.stage_kpis.length
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 