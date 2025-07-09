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

    // Get KPI totals
    const [kpiRows] = await db.execute(`
      SELECT 
        SUM(orders_total) as total_orders,
        SUM(orders_breached) as sla_breached,
        SUM(orders_on_risk) as on_risk,
        SUM(orders_on_time) as completed
      FROM sla_daily_summary 
      WHERE ${whereClause}
    `, params);

    // Get chart data by stage
    const [chartRows] = await db.execute(`
      SELECT 
        stage,
        SUM(orders_on_time) as on_time,
        SUM(orders_on_risk) as on_risk,
        SUM(orders_breached) as breached
      FROM sla_daily_summary 
      WHERE ${whereClause}
      GROUP BY stage
      ORDER BY FIELD(stage, 'Processed', 'Shipped', 'Delivered')
    `, params);

    // Get stage breakdown with average delay
    const [breakdownRows] = await db.execute(`
      SELECT 
        stage,
        SUM(orders_on_time) as on_time,
        SUM(orders_breached) as breached,
        SUM(orders_on_risk) as on_risk,
        CASE 
          WHEN SUM(orders_total) > 0 
          THEN ROUND(SUM(avg_delay_sec * orders_total) / SUM(orders_total) / 3600, 2)
          ELSE 0 
        END as avg_delay_hours
      FROM sla_daily_summary 
      WHERE ${whereClause}
      GROUP BY stage
      ORDER BY FIELD(stage, 'Processed', 'Shipped', 'Delivered')
    `, params);

    const kpi = (kpiRows as Record<string, number>[])[0] || {
      total_orders: 0,
      sla_breached: 0,
      on_risk: 0,
      completed: 0
    };

    const summary: DashboardSummary = {
      total_orders: kpi.total_orders || 0,
      sla_breached: kpi.sla_breached || 0,
      on_risk: kpi.on_risk || 0,
      completed: kpi.completed || 0,
      chart_data: (chartRows as Record<string, string | number>[]).map(row => ({
        stage: String(row.stage),
        on_time: Number(row.on_time) || 0,
        on_risk: Number(row.on_risk) || 0,
        breached: Number(row.breached) || 0,
      })),
      stage_breakdown: (breakdownRows as Record<string, string | number>[]).map(row => ({
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