import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsDb } from '@/lib/db';
import { dashboardFiltersSchema } from '@/lib/validation';
import { DashboardSummary } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = dashboardFiltersSchema.parse({
      from_date: searchParams.get('from_date'),
      to_date: searchParams.get('to_date'),
      brand: searchParams.get('brand') || undefined,
      country: searchParams.get('country') || undefined,
    });

    const db = await getAnalyticsDb();
    
    // Build dynamic WHERE clause
    const whereConditions = ['summary_date BETWEEN ? AND ?'];
    const params: (string | number)[] = [filters.from_date, filters.to_date];
    
    if (filters.brand) {
      whereConditions.push('brand_name = ?');
      params.push(filters.brand);
    }
    
    if (filters.country) {
      whereConditions.push('country_code = ?');
      params.push(filters.country);
    }
    
    const whereClause = whereConditions.join(' AND ');

    // Execute all queries in parallel for better performance
    const [stageKpiRows, chartRows, breakdownRows] = await Promise.all([
      // Get KPI totals by stage
      db.execute(`
        SELECT 
          stage,
          SUM(orders_total) as total_orders,
          SUM(orders_breached) as sla_breached,
          SUM(orders_on_risk) as on_risk,
          SUM(orders_on_time) as completed
        FROM sla_daily_summary 
        WHERE ${whereClause}
        GROUP BY stage
        ORDER BY FIELD(stage, 'Processed', 'Shipped', 'Delivered')
      `, params),

      // Get chart data by stage
      db.execute(`
        SELECT 
          stage,
          SUM(orders_on_time) as on_time,
          SUM(orders_on_risk) as on_risk,
          SUM(orders_breached) as breached
        FROM sla_daily_summary 
        WHERE ${whereClause}
        GROUP BY stage
        ORDER BY FIELD(stage, 'Processed', 'Shipped', 'Delivered')
      `, params),

      // Get stage breakdown with average delay (only for breached orders)
      db.execute(`
        SELECT 
          stage,
          SUM(orders_on_time) as on_time,
          SUM(orders_breached) as breached,
          SUM(orders_on_risk) as on_risk,
          CASE 
            WHEN SUM(orders_breached) > 0 
            THEN ROUND(SUM(CASE WHEN orders_breached > 0 THEN avg_delay_sec * orders_breached ELSE 0 END) / SUM(orders_breached) / 3600, 2)
            ELSE 0 
          END as avg_delay_hours
        FROM sla_daily_summary 
        WHERE ${whereClause}
        GROUP BY stage
        ORDER BY FIELD(stage, 'Processed', 'Shipped', 'Delivered')
      `, params)
    ]);

    // Transform stage KPI data
    const stageKpis = (stageKpiRows[0] as Record<string, string | number>[]).map(row => ({
      stage: String(row.stage),
      total_orders: Number(row.total_orders) || 0,
      sla_breached: Number(row.sla_breached) || 0,
      on_risk: Number(row.on_risk) || 0,
      completed: Number(row.completed) || 0,
    }));

    // Calculate overall totals for backwards compatibility if needed
    const overallTotals = stageKpis.reduce((acc, stage) => ({
      total_orders: acc.total_orders + stage.total_orders,
      sla_breached: acc.sla_breached + stage.sla_breached,
      on_risk: acc.on_risk + stage.on_risk,
      completed: acc.completed + stage.completed,
    }), { total_orders: 0, sla_breached: 0, on_risk: 0, completed: 0 });

    const summary: DashboardSummary = {
      total_orders: overallTotals.total_orders,
      sla_breached: overallTotals.sla_breached,
      on_risk: overallTotals.on_risk,
      completed: overallTotals.completed,
      stage_kpis: stageKpis,
      chart_data: (chartRows[0] as Record<string, string | number>[]).map(row => ({
        stage: String(row.stage),
        on_time: Number(row.on_time) || 0,
        on_risk: Number(row.on_risk) || 0,
        breached: Number(row.breached) || 0,
      })),
      stage_breakdown: (breakdownRows[0] as Record<string, string | number>[]).map(row => ({
        stage: String(row.stage),
        on_time: Number(row.on_time) || 0,
        breached: Number(row.breached) || 0,
        on_risk: Number(row.on_risk) || 0,
        avg_delay: `${Number(row.avg_delay_hours) || 0}h`,
      })),
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 