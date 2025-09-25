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

    console.log('New Dashboard API params:', { brand, country, fromDate, toDate });

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

    // Parameters for timeline events queries
    if (!fromDate || !toDate) {
      return NextResponse.json({
        error: 'Date range is required for timeline-based filtering'
      }, { status: 400 });
    }

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

    // Build query for Timeline Events (each event is tracked separately)
    const buildTimelineEventsQuery = () => {
      const tableQueries = tables.map(table => `
        -- Processed events within date range
        SELECT 
          o.order_no,
          o.brand_name,
          o.country_code,
          DATE(o.processed_time) as event_date,
          'Processed' as timeline_stage,
          -- SLA status at the time of processing
          CASE 
            WHEN ${parseTATToMinutes('o.processed_tat')} > ${parseTATToMinutes('tc.processed_tat')} THEN 'Breached'
            WHEN ${parseTATToMinutes('o.processed_tat')} > (${parseTATToMinutes('tc.processed_tat')} * tc.risk_pct / 100) THEN 'At Risk'
            ELSE 'On Time'
          END as sla_status,
          ${pendingStatusCase} as pending_status
        FROM ${table} o
        LEFT JOIN tat_config tc ON o.brand_name COLLATE utf8mb4_unicode_ci = tc.brand_name COLLATE utf8mb4_unicode_ci 
                                 AND o.country_code COLLATE utf8mb4_unicode_ci = tc.country_code COLLATE utf8mb4_unicode_ci
        WHERE o.processed_time IS NOT NULL 
          AND DATE(o.processed_time) BETWEEN ? AND ?
          AND o.confirmation_status = ?
        
        UNION ALL
        
        -- Shipped events within date range  
        SELECT 
          o.order_no,
          o.brand_name,
          o.country_code,
          DATE(o.shipped_time) as event_date,
          'Shipped' as timeline_stage,
          -- SLA status at the time of shipping
          CASE 
            WHEN ${parseTATToMinutes('o.shipped_tat')} > ${parseTATToMinutes('tc.shipped_tat')} THEN 'Breached'
            WHEN ${parseTATToMinutes('o.shipped_tat')} > (${parseTATToMinutes('tc.shipped_tat')} * tc.risk_pct / 100) THEN 'At Risk'
            ELSE 'On Time'
          END as sla_status,
          ${pendingStatusCase} as pending_status
        FROM ${table} o
        LEFT JOIN tat_config tc ON o.brand_name COLLATE utf8mb4_unicode_ci = tc.brand_name COLLATE utf8mb4_unicode_ci 
                                 AND o.country_code COLLATE utf8mb4_unicode_ci = tc.country_code COLLATE utf8mb4_unicode_ci
        WHERE o.shipped_time IS NOT NULL 
          AND DATE(o.shipped_time) BETWEEN ? AND ?
          AND o.confirmation_status = ?
        
        UNION ALL
        
        -- Delivered events within date range
        SELECT 
          o.order_no,
          o.brand_name,
          o.country_code,
          DATE(o.delivered_time) as event_date,
          'Delivered' as timeline_stage,
          -- SLA status at the time of delivery
          CASE 
            WHEN ${parseTATToMinutes('o.delivered_tat')} > ${parseTATToMinutes('tc.delivered_tat')} THEN 'Breached'
            WHEN ${parseTATToMinutes('o.delivered_tat')} > (${parseTATToMinutes('tc.delivered_tat')} * tc.risk_pct / 100) THEN 'At Risk'
            ELSE 'On Time'
          END as sla_status,
          ${pendingStatusCase} as pending_status
        FROM ${table} o
        LEFT JOIN tat_config tc ON o.brand_name COLLATE utf8mb4_unicode_ci = tc.brand_name COLLATE utf8mb4_unicode_ci 
                                 AND o.country_code COLLATE utf8mb4_unicode_ci = tc.country_code COLLATE utf8mb4_unicode_ci
        WHERE o.delivered_time IS NOT NULL 
          AND DATE(o.delivered_time) BETWEEN ? AND ?
          AND o.confirmation_status = ?
      `);
    
      return tableQueries.join(' UNION ALL ');
    };

    // Get Timeline Events data  
    const timelineEventsQuery = buildTimelineEventsQuery();
    
    const timelineQueryParams: (string | number)[] = [];
    tables.forEach(() => {
      // Each table needs the date range and confirmation status for each of the 3 events (processed, shipped, delivered)
      timelineQueryParams.push(fromDate, toDate, 'CONFIRMED'); // Processed events
      timelineQueryParams.push(fromDate, toDate, 'CONFIRMED'); // Shipped events  
      timelineQueryParams.push(fromDate, toDate, 'CONFIRMED'); // Delivered events
    });

    console.log('=== TIMELINE EVENTS QUERY DEBUG ===');
    console.log('Query Parameters:', { fromDate, toDate, brand, country });
    console.log('Tables found:', tables);
    
    // First, let's check what data actually exists in the table
    console.log('\n=== DATABASE DIAGNOSTICS ===');
    
    // Check table structure
    console.log('Checking table structure...');
    const [columnsResult] = await db.execute(`DESCRIBE ${tables[0]}`);
    console.log('Table columns:', columnsResult);
    
    // Check total row count
    const [countResult] = await db.execute(`SELECT COUNT(*) as total_rows FROM ${tables[0]}`);
    console.log('Total rows in table:', countResult);
    
    // Check sample data - first 3 rows
    const [sampleResult] = await db.execute(`
      SELECT order_no, placed_time, processed_time, shipped_time, delivered_time, 
             confirmation_status, brand_name, country_code 
      FROM ${tables[0]} 
      LIMIT 3
    `);
    console.log('Sample data (first 3 rows):', sampleResult);
    
    // Check date ranges in the data
    const [dateRangeResult] = await db.execute(`
      SELECT 
        MIN(DATE(placed_time)) as min_placed_date,
        MAX(DATE(placed_time)) as max_placed_date,
        MIN(DATE(processed_time)) as min_processed_date,
        MAX(DATE(processed_time)) as max_processed_date,
        MIN(DATE(shipped_time)) as min_shipped_date,
        MAX(DATE(shipped_time)) as max_shipped_date,
        MIN(DATE(delivered_time)) as min_delivered_date,
        MAX(DATE(delivered_time)) as max_delivered_date
      FROM ${tables[0]}
      WHERE processed_time IS NOT NULL OR shipped_time IS NOT NULL OR delivered_time IS NOT NULL
    `);
    console.log('Date ranges in data:', dateRangeResult);
    
    // Check confirmation_status values
    const [statusResult] = await db.execute(`
      SELECT confirmation_status, COUNT(*) as count 
      FROM ${tables[0]} 
      GROUP BY confirmation_status
    `);
    console.log('Confirmation status distribution:', statusResult);
    
    console.log('=== END DIAGNOSTICS ===\n');
    
    console.log('Full SQL Query:');
    console.log(timelineEventsQuery);
    console.log('Query Parameters Array:', timelineQueryParams);
    
    console.log('Executing timeline events query...');
    const [timelineRows] = await db.execute(timelineEventsQuery, timelineQueryParams);
    const orderData = timelineRows as Array<{
      order_no: string;
      brand_name: string;
      country_code: string;
      event_date: string;
      timeline_stage: string;
      sla_status: string;
      pending_status: string;
    }>;

    console.log('=== RAW QUERY RESULTS ===');
    console.log(`Total events retrieved: ${orderData.length}`);
    
    // Group by timeline_stage for debugging
    const groupedByStage = orderData.reduce((acc, order) => {
      if (!acc[order.timeline_stage]) {
        acc[order.timeline_stage] = [];
      }
      acc[order.timeline_stage].push(order);
      return acc;
    }, {} as Record<string, typeof orderData>);
    
    console.log('Events by Stage:');
    Object.entries(groupedByStage).forEach(([stage, events]) => {
      console.log(`\n--- ${stage} Events (${events.length} total) ---`);
      
      const slaBreakdown = events.reduce((acc, event) => {
        acc[event.sla_status] = (acc[event.sla_status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('SLA Status breakdown:', slaBreakdown);
      
      // Show ALL events for Processed stage to debug the missing order
      if (stage === 'Processed') {
        console.log('ALL PROCESSED EVENTS:');
        events.forEach((event, index) => {
          console.log(`  ${index + 1}. Order ${event.order_no}: ${event.sla_status} on ${event.event_date} (${event.brand_name}, ${event.country_code})`);
        });
      } else {
        // Show first few examples for other stages
        events.slice(0, 3).forEach(event => {
          console.log(`  Order ${event.order_no}: ${event.sla_status} on ${event.event_date}`);
        });
        
        if (events.length > 3) {
          console.log(`  ... and ${events.length - 3} more`);
        }
      }
    });

    console.log(`\n=== EXPECTED vs ACTUAL ===`);
    const processedEvents = orderData.filter(o => o.timeline_stage === 'Processed');
    const processedBreached = processedEvents.filter(o => o.sla_status === 'Breached');
    const processedAtRisk = processedEvents.filter(o => o.sla_status === 'At Risk');
    
    console.log(`Processed events: ${processedEvents.length} (expected: 14)`);
    console.log(`Processed + Breached: ${processedBreached.length} (expected: 4)`);
    console.log(`Processed + At Risk: ${processedAtRisk.length} (expected: 0)`);
    
    console.log('=== END DEBUG ===\n');
    
    const totalOrders = orderData.length;
    const onTimeOrders = orderData.filter(o => o.sla_status === 'On Time').length;
    const onRiskOrders = orderData.filter(o => o.sla_status === 'At Risk').length;
    const breachedOrders = orderData.filter(o => o.sla_status === 'Breached').length;
    
    // Calculate Action Required + SLA + Stage combinations
    const actionRequiredOrders = orderData.filter(o => o.pending_status === 'pending');
    
    const actionRequiredBreachedProcessed = actionRequiredOrders.filter(o => 
      o.sla_status === 'Breached' && o.timeline_stage === 'Processed'
    ).length;
    
    const actionRequiredBreachedShipped = actionRequiredOrders.filter(o => 
      o.sla_status === 'Breached' && o.timeline_stage === 'Shipped'
    ).length;
    
    const actionRequiredBreachedDelivered = actionRequiredOrders.filter(o => 
      o.sla_status === 'Breached' && o.timeline_stage === 'Delivered'
    ).length;
    
    const actionRequiredAtRiskProcessed = actionRequiredOrders.filter(o => 
      o.sla_status === 'At Risk' && o.timeline_stage === 'Processed'
    ).length;
    
    const actionRequiredAtRiskShipped = actionRequiredOrders.filter(o => 
      o.sla_status === 'At Risk' && o.timeline_stage === 'Shipped'
    ).length;
    
    const actionRequiredAtRiskDelivered = actionRequiredOrders.filter(o => 
      o.sla_status === 'At Risk' && o.timeline_stage === 'Delivered'
    ).length;
    
    const actionRequiredOnTimeProcessed = actionRequiredOrders.filter(o => 
      o.sla_status === 'On Time' && o.timeline_stage === 'Processed'
    ).length;
    
    const actionRequiredOnTimeShipped = actionRequiredOrders.filter(o => 
      o.sla_status === 'On Time' && o.timeline_stage === 'Shipped'
    ).length;
    
    const actionRequiredOnTimeDelivered = actionRequiredOrders.filter(o => 
      o.sla_status === 'On Time' && o.timeline_stage === 'Delivered'
    ).length;
    
    // Calculate fulfilled orders by SLA status
    const fulfilledOnTimeOrders = orderData.filter(o => 
      o.timeline_stage === 'Delivered' && o.sla_status === 'On Time'
    ).length;
    
    const fulfilledAtRiskOrders = orderData.filter(o => 
      o.timeline_stage === 'Delivered' && o.sla_status === 'At Risk'
    ).length;
    
    const fulfilledBreachedOrders = orderData.filter(o => 
      o.timeline_stage === 'Delivered' && o.sla_status === 'Breached'
    ).length;
    
    // Fulfilled orders that are on time or at risk (excluding breached)
    const fulfilledOnTimeAndAtRiskOrders = fulfilledOnTimeOrders + fulfilledAtRiskOrders;
    
    const pendingOrders = orderData.filter(o => o.pending_status === 'pending').length;

    // Calculate stage breakdown based on timeline events
    const stageBreakdown = ['Processed', 'Shipped', 'Delivered'].map(stage => {
      const stageEvents = orderData.filter(o => o.timeline_stage === stage);
      const stageTotal = stageEvents.length;
      const stageOnTime = stageEvents.filter(o => o.sla_status === 'On Time').length;
      const stageOnRisk = stageEvents.filter(o => o.sla_status === 'At Risk').length;
      const stageBreached = stageEvents.filter(o => o.sla_status === 'Breached').length;
      
      // Debug logging for stage breakdown calculation
      if (stage === 'Processed') {
        console.log(`\n=== STAGE BREAKDOWN CALCULATION FOR ${stage} ===`);
        console.log(`Stage events found: ${stageTotal}`);
        console.log(`On Time events: ${stageOnTime}`);
        console.log(`At Risk events: ${stageOnRisk}`);
        console.log(`Breached events: ${stageBreached}`);
        console.log(`Total check: ${stageOnTime + stageOnRisk + stageBreached} = ${stageTotal}?`);
        
        // Show detailed breakdown
        const onTimeOrders = stageEvents.filter(o => o.sla_status === 'On Time');
        const atRiskOrders = stageEvents.filter(o => o.sla_status === 'At Risk');
        const breachedOrders = stageEvents.filter(o => o.sla_status === 'Breached');
        
        console.log('On Time Orders:', onTimeOrders.map(o => o.order_no));
        console.log('At Risk Orders:', atRiskOrders.map(o => o.order_no));
        console.log('Breached Orders:', breachedOrders.map(o => o.order_no));
      }
      
      return {
        stage,
        total: stageTotal,
        on_time: stageOnTime,
        on_risk: stageOnRisk,
        breached: stageBreached,
        completion_rate: stageTotal > 0 ? Math.round((stageOnTime / stageTotal) * 100 * 10) / 10 : 0
      };
    }); // Always include all stages
    
    console.log('\n=== FINAL STAGE BREAKDOWN ===');
    stageBreakdown.forEach(stage => {
      console.log(`${stage.stage}: Total=${stage.total}, OnTime=${stage.on_time}, AtRisk=${stage.on_risk}, Breached=${stage.breached}`);
    });

    // Calculate chart data (group by date using the timeline event date)
    const chartDataMap = new Map<string, {
      date: string;
      total_orders: number;
      on_time_orders: number;
      on_risk_orders: number;
      breached_orders: number;
      completion_rate: number;
    }>();

    orderData.forEach(order => {
      const date = order.event_date;
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
        // Action Required combinations
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

    console.log('New Dashboard API response summary:', {
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
    console.error('New Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch new dashboard data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 