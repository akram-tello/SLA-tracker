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

    // Get available order tables
    const [tableRows] = await db.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'orders_%'
    `);

    let tables = (tableRows as { TABLE_NAME: string }[]).map(row => row.TABLE_NAME);
    
    // Apply brand/country filters to table selection  
    if (brand || country) {
      tables = tables.filter(tableName => {
        const parts = tableName.replace('orders_', '').split('_');
        if (parts.length < 2) return false;
        
        const brandCode = parts.slice(0, -1).join('_');
        const countryCode = parts[parts.length - 1];

    if (brand) {
          // Map brand filter to brand code
          let expectedBrand = '';
          if (brand.toLowerCase().includes('victoria') || brand.toLowerCase() === 'vs') {
            expectedBrand = 'vs';
          } else if (brand.toLowerCase().includes('bbw') || brand.toLowerCase().includes('bath')) {
            expectedBrand = 'bbw';
          } else if (brand.toLowerCase().includes('rituals')) {
            expectedBrand = 'rituals';
          } else {
            expectedBrand = brand.toLowerCase();
          }
          
          if (expectedBrand && brandCode !== expectedBrand) {
            return false;
          }
    }

        if (country && countryCode.toLowerCase() !== country.toLowerCase()) {
          return false;
        }
        
        return true;
      });
    }

    if (tables.length === 0) {
      return NextResponse.json({
        kpis: {
          total_orders: 0,
          on_time_orders: 0,
          on_risk_orders: 0,
          breached_orders: 0,
          action_required_breached_processed: 0,
          action_required_breached_shipped: 0,
          action_required_breached_delivered: 0,
          action_required_at_risk_processed: 0,
          action_required_at_risk_shipped: 0,
          action_required_at_risk_delivered: 0,
          action_required_on_time_processed: 0,
          action_required_on_time_shipped: 0,
          action_required_on_time_delivered: 0,
          fulfilled_orders: 0,
          fulfilled_breached_orders: 0,
          completion_rate: 0,
          pending_orders: 0,
          at_risk_pending_orders: 0,
          breached_pending_orders: 0,
          avg_delay_seconds: 0,
          avg_pending_hours: 0,
          pending_rate: 0,
          last_refresh: null
        },
        stage_breakdown: [],
        chart_data: [],
        stage_kpis: []
      });
    }

    // Build WHERE conditions  
    const whereConditions: string[] = [];
    const params: (string | number)[] = [];

    if (fromDate && toDate) {
      whereConditions.push('DATE(placed_time) BETWEEN ? AND ?');
      params.push(fromDate, toDate);
    }

    // Only include CONFIRMED orders by default  
    whereConditions.push('confirmation_status = ?');
    params.push('CONFIRMED');

    // Filter out "Not Processed" orders   
    whereConditions.push('NOT (processed_time IS NULL AND shipped_time IS NULL AND delivered_time IS NULL)');

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Helper function for parsing TAT strings to minutes  
    const parseTATToMinutes = (tatField: string) => `
      COALESCE(
        CASE WHEN ${tatField} REGEXP '[0-9]+[ ]*d' THEN 
          CAST(REGEXP_SUBSTR(${tatField}, '[0-9]+') AS UNSIGNED) * 1440 
        ELSE 0 END +
        CASE WHEN ${tatField} REGEXP '[0-9]+[ ]*h' THEN 
          CAST(REGEXP_SUBSTR(REGEXP_SUBSTR(${tatField}, '[0-9]+[ ]*h'), '[0-9]+') AS UNSIGNED) * 60 
        ELSE 0 END +
        CASE WHEN ${tatField} REGEXP '[0-9]+[ ]*m' THEN 
          CAST(REGEXP_SUBSTR(REGEXP_SUBSTR(${tatField}, '[0-9]+[ ]*m'), '[0-9]+') AS UNSIGNED)
        ELSE 0 END, 0
      )
    `;

    // SLA Status calculation  
    const getSLAStatusCase = () => {
      return `
        CASE
          -- For delivered orders, check if delivery was on time
          WHEN o.delivered_time IS NOT NULL AND o.delivered_tat IS NOT NULL THEN
            CASE 
              WHEN ${parseTATToMinutes('o.delivered_tat')} > ${parseTATToMinutes('tc.delivered_tat')} THEN 'Breached'
              WHEN ${parseTATToMinutes('o.delivered_tat')} > (${parseTATToMinutes('tc.delivered_tat')} * tc.risk_pct / 100) THEN 'At Risk'
              ELSE 'On Time'
            END
          
          -- For shipped but not delivered orders, check CURRENT status: should it be delivered by now?
          WHEN o.shipped_time IS NOT NULL AND o.delivered_time IS NULL THEN
            CASE 
              -- If it's past the delivery deadline, it's breached regardless of past performance
              WHEN TIMESTAMPDIFF(MINUTE, o.placed_time, NOW()) > ${parseTATToMinutes('tc.delivered_tat')} THEN 'Breached'
              WHEN TIMESTAMPDIFF(MINUTE, o.placed_time, NOW()) > (${parseTATToMinutes('tc.delivered_tat')} * tc.risk_pct / 100) THEN 'At Risk'
              ELSE 'On Time'
            END
          
          -- For processed but not shipped orders, check CURRENT status: should it be shipped by now?
          WHEN o.processed_time IS NOT NULL AND o.shipped_time IS NULL THEN
            CASE 
              -- If it's past the shipping deadline, it's breached regardless of how fast processing was
              WHEN TIMESTAMPDIFF(MINUTE, o.placed_time, NOW()) > ${parseTATToMinutes('tc.shipped_tat')} THEN 'Breached'
              WHEN TIMESTAMPDIFF(MINUTE, o.placed_time, NOW()) > (${parseTATToMinutes('tc.shipped_tat')} * tc.risk_pct / 100) THEN 'At Risk'
              ELSE 'On Time'
            END
          
          -- For orders not yet processed, check if they should be processed by now
          WHEN o.processed_time IS NULL AND o.shipped_time IS NULL AND o.delivered_time IS NULL THEN
            CASE 
              WHEN TIMESTAMPDIFF(MINUTE, o.placed_time, NOW()) > ${parseTATToMinutes('tc.processed_tat')} THEN 'Breached'
              WHEN TIMESTAMPDIFF(MINUTE, o.placed_time, NOW()) > (${parseTATToMinutes('tc.processed_tat')} * tc.risk_pct / 100) THEN 'At Risk'
              ELSE 'On Time'
            END
            
          -- For orders that skip processed stage (go straight from placed to shipped)
          WHEN o.processed_time IS NULL AND o.shipped_time IS NOT NULL THEN
            CASE 
              -- Check if it should be delivered by now
              WHEN TIMESTAMPDIFF(MINUTE, o.placed_time, NOW()) > ${parseTATToMinutes('tc.delivered_tat')} THEN 'Breached'
              WHEN TIMESTAMPDIFF(MINUTE, o.placed_time, NOW()) > (${parseTATToMinutes('tc.delivered_tat')} * tc.risk_pct / 100) THEN 'At Risk'
              ELSE 'On Time'
            END
            
          -- Default case for edge scenarios
          ELSE 'Unknown'
        END
    `;
    };

    const slaStatusCase = getSLAStatusCase();

    // Pending status calculation  
    const getPendingStatusCase = () => {
      return `
        CASE 
          -- For orders not yet processed (no processed_time)
          WHEN o.processed_time IS NULL AND o.shipped_time IS NULL AND o.delivered_time IS NULL
               AND TIMESTAMPDIFF(MINUTE, o.placed_time, NOW()) > (${parseTATToMinutes('tc.pending_not_processed_time')}) 
               THEN 'pending'
          
          -- For orders processed but not shipped (normal flow)
          WHEN o.processed_time IS NOT NULL 
               AND o.shipped_time IS NULL 
               AND TIMESTAMPDIFF(MINUTE, o.processed_time, NOW()) > (${parseTATToMinutes('tc.pending_processed_time')}) 
               THEN 'pending'
          
          -- For orders shipped but not delivered (either from processed or direct from placed)
          WHEN o.shipped_time IS NOT NULL 
               AND o.delivered_time IS NULL 
               AND TIMESTAMPDIFF(MINUTE, o.shipped_time, NOW()) > (${parseTATToMinutes('tc.pending_shipped_time')}) 
               THEN 'pending'
          
          -- For orders that are confirmed but stuck in processing phase 
          WHEN o.processed_time IS NULL 
               AND o.shipped_time IS NULL 
               AND o.delivered_time IS NULL
               AND TIMESTAMPDIFF(MINUTE, o.placed_time, NOW()) > (${parseTATToMinutes('tc.pending_processed_time')}) 
               THEN 'pending'
          
          ELSE 'normal'
        END
    `;
    };

    const pendingStatusCase = getPendingStatusCase();

    // Build unified query to get all aggregated data from orders tables
    const buildAggregationQuery = () => {
      const baseSelect = `
        o.order_no,
        o.brand_name,
        o.country_code,
        DATE(o.placed_time) as order_date,
        CASE 
          WHEN o.delivered_time IS NOT NULL THEN 'Delivered'
          WHEN o.shipped_time IS NOT NULL AND o.delivered_time IS NULL THEN 'Shipped'
          WHEN o.processed_time IS NOT NULL AND o.shipped_time IS NULL THEN 'Processed'
          WHEN o.processed_time IS NULL AND o.shipped_time IS NULL AND o.delivered_time IS NULL THEN 'Not Processed'
          ELSE 'Processing'
        END as current_stage,
        ${slaStatusCase} as sla_status,
        ${pendingStatusCase} as pending_status
      `;
      
      const tableQueries = tables.map(table => `
        SELECT ${baseSelect}
        FROM ${table} o
        LEFT JOIN tat_config tc ON o.brand_name COLLATE utf8mb4_unicode_ci = tc.brand_name COLLATE utf8mb4_unicode_ci 
                                 AND o.country_code COLLATE utf8mb4_unicode_ci = tc.country_code COLLATE utf8mb4_unicode_ci
      ${whereClause}
      `);
    
      return tableQueries.join(' UNION ALL ');
    };

    // Get all order data
    const aggregationQuery = buildAggregationQuery();
    
    const aggregationParams: (string | number)[] = [];
    tables.forEach(() => {
      aggregationParams.push(...params);
    });

    console.log('Executing aggregation query from orders tables...');
    const [aggregationRows] = await db.execute(aggregationQuery, aggregationParams);
    const orderData = aggregationRows as Array<{
      order_no: string;
      brand_name: string;
      country_code: string;
      order_date: string;
      current_stage: string;
      sla_status: string;
      pending_status: string;
    }>;

    console.log(`Retrieved ${orderData.length} orders from ${tables.length} tables`);

    // Calculate KPIs from real-time data
    const totalOrders = orderData.length;
    const onTimeOrders = orderData.filter(o => o.sla_status === 'On Time').length;
    const onRiskOrders = orderData.filter(o => o.sla_status === 'At Risk').length;
    const breachedOrders = orderData.filter(o => o.sla_status === 'Breached').length;
    
    // NEW: Calculate Action Required + SLA + Stage combinations
    const actionRequiredOrders = orderData.filter(o => o.pending_status === 'pending');
    
    const actionRequiredBreachedProcessed = actionRequiredOrders.filter(o => 
      o.sla_status === 'Breached' && o.current_stage === 'Processed'
    ).length;
    
    const actionRequiredBreachedShipped = actionRequiredOrders.filter(o => 
      o.sla_status === 'Breached' && o.current_stage === 'Shipped'
    ).length;
    
    const actionRequiredBreachedDelivered = actionRequiredOrders.filter(o => 
      o.sla_status === 'Breached' && o.current_stage === 'Delivered'
    ).length;
    
    const actionRequiredAtRiskProcessed = actionRequiredOrders.filter(o => 
      o.sla_status === 'At Risk' && o.current_stage === 'Processed'
    ).length;
    
    const actionRequiredAtRiskShipped = actionRequiredOrders.filter(o => 
      o.sla_status === 'At Risk' && o.current_stage === 'Shipped'
    ).length;
    
    const actionRequiredAtRiskDelivered = actionRequiredOrders.filter(o => 
      o.sla_status === 'At Risk' && o.current_stage === 'Delivered'
    ).length;
    
    const actionRequiredOnTimeProcessed = actionRequiredOrders.filter(o => 
      o.sla_status === 'On Time' && o.current_stage === 'Processed'
    ).length;
    
    const actionRequiredOnTimeShipped = actionRequiredOrders.filter(o => 
      o.sla_status === 'On Time' && o.current_stage === 'Shipped'
    ).length;
    
    const actionRequiredOnTimeDelivered = actionRequiredOrders.filter(o => 
      o.sla_status === 'On Time' && o.current_stage === 'Delivered'
    ).length;
    
    // Calculate fulfilled orders by SLA status
    const fulfilledOnTimeOrders = orderData.filter(o => 
      o.current_stage === 'Delivered' && o.sla_status === 'On Time'
    ).length;
    
    const fulfilledAtRiskOrders = orderData.filter(o => 
      o.current_stage === 'Delivered' && o.sla_status === 'At Risk'
    ).length;
    
    const fulfilledBreachedOrders = orderData.filter(o => 
      o.current_stage === 'Delivered' && o.sla_status === 'Breached'
    ).length;
    
    // Fulfilled orders that are on time or at risk (excluding breached)
    const fulfilledOnTimeAndAtRiskOrders = fulfilledOnTimeOrders + fulfilledAtRiskOrders;
    
    const pendingOrders = orderData.filter(o => o.pending_status === 'pending').length;

    // Calculate stage breakdown
    const stageBreakdown = ['Not Processed', 'Processed', 'Shipped', 'Delivered'].map(stage => {
      const stageOrders = orderData.filter(o => o.current_stage === stage);
      const stageTotal = stageOrders.length;
      const stageOnTime = stageOrders.filter(o => o.sla_status === 'On Time').length;
      const stageOnRisk = stageOrders.filter(o => o.sla_status === 'At Risk').length;
      const stageBreached = stageOrders.filter(o => o.sla_status === 'Breached').length;
      
      return {
        stage,
        total: stageTotal,
        on_time: stageOnTime,
        on_risk: stageOnRisk,
        breached: stageBreached,
        completion_rate: stageTotal > 0 ? Math.round((stageOnTime / stageTotal) * 100 * 10) / 10 : 0
      };
    }).filter(stage => stage.total > 0); // Only include stages with orders

    // Calculate chart data (group by date)
    const chartDataMap = new Map<string, {
      date: string;
      total_orders: number;
      on_time_orders: number;
      on_risk_orders: number;
      breached_orders: number;
      completion_rate: number;
    }>();

    orderData.forEach(order => {
      const date = order.order_date;
      if (!chartDataMap.has(date)) {
        chartDataMap.set(date, {
          date,
          total_orders: 0,
          on_time_orders: 0,
          on_risk_orders: 0,
          breached_orders: 0,
          completion_rate: 0
        });
      }
      
      const dayData = chartDataMap.get(date)!;
      dayData.total_orders++;
      
      if (order.sla_status === 'On Time') {
        dayData.on_time_orders++;
      } else if (order.sla_status === 'At Risk') {
        dayData.on_risk_orders++;
      } else if (order.sla_status === 'Breached') {
        dayData.breached_orders++;
      }
      
      dayData.completion_rate = dayData.total_orders > 0 ? 
        Math.round((dayData.on_time_orders / dayData.total_orders) * 100 * 10) / 10 : 0;
    });

    const chartData = Array.from(chartDataMap.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate stage KPIs (same as stage breakdown but formatted differently)
    const stageKpis = stageBreakdown.map(stage => ({
      stage: stage.stage,
      total_orders: stage.total,
      on_time_orders: stage.on_time,
      on_risk_orders: stage.on_risk,
      breached_orders: stage.breached,
      completion_rate: stage.completion_rate,
      avg_delay_seconds: 0 // Would need complex calculation, keeping simple for now
    }));

    const response = {
      kpis: {
        total_orders: totalOrders,
        on_time_orders: onTimeOrders,
        on_risk_orders: onRiskOrders,
        breached_orders: breachedOrders,
        // NEW: Action Required combinations
        action_required_breached_processed: actionRequiredBreachedProcessed,
        action_required_breached_shipped: actionRequiredBreachedShipped,
        action_required_breached_delivered: actionRequiredBreachedDelivered,
        action_required_at_risk_processed: actionRequiredAtRiskProcessed,
        action_required_at_risk_shipped: actionRequiredAtRiskShipped,
        action_required_at_risk_delivered: actionRequiredAtRiskDelivered,
        action_required_on_time_processed: actionRequiredOnTimeProcessed,
        action_required_on_time_shipped: actionRequiredOnTimeShipped,
        action_required_on_time_delivered: actionRequiredOnTimeDelivered,
        fulfilled_orders: fulfilledOnTimeAndAtRiskOrders, // Only on time and at risk fulfilled orders
        fulfilled_breached_orders: fulfilledBreachedOrders,
        completion_rate: totalOrders > 0 ? Math.round((onTimeOrders / totalOrders) * 100 * 10) / 10 : 0,
        pending_orders: pendingOrders,
        at_risk_pending_orders: orderData.filter(o => o.pending_status === 'pending' && o.sla_status === 'At Risk').length,
        breached_pending_orders: orderData.filter(o => o.pending_status === 'pending' && o.sla_status === 'Breached').length,
        avg_delay_seconds: 0, // Would need complex calculation
        avg_pending_hours: 0, // Would need complex calculation
        pending_rate: totalOrders > 0 ? Math.round((pendingOrders / totalOrders) * 100 * 10) / 10 : 0,
        last_refresh: new Date().toISOString()
      },
      stage_breakdown: stageBreakdown,
      chart_data: chartData,
      stage_kpis: stageKpis
    };

    console.log('Dashboard API response summary:', {
      total_orders: response.kpis.total_orders,
      on_time_orders: response.kpis.on_time_orders,
      on_risk_orders: response.kpis.on_risk_orders,
      breached_orders: response.kpis.breached_orders,
      tables_used: tables.length,
      stage_count: response.stage_breakdown.length,
      chart_points: response.chart_data.length
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