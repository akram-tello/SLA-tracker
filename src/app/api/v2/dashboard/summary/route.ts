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

    console.log(`[${new Date().toISOString()}] Dashboard V2 API called with params:`, { brand, country, fromDate, toDate });

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
          placed_orders: 0,
          breached_pending_orders: 0,
          fulfilled_orders: 0,
          fulfilled_breached_orders: 0,
          at_risk_pending_orders: 0,
          at_risk_orders: 0,
          total_urgent_orders: 0,
          total_critical_orders: 0,
          completion_rate: 0,
          fulfillment_rate: 0,
          last_refresh: null
        },
        stage_breakdown: [],
        historical_stage_breakdown: []
      });
    }

    // Parameters for timeline events queries (for historical stage breakdown)
    const useDateRange = fromDate && toDate;

    // Build WHERE conditions for Total Orders (placed_time filter)
    const totalOrdersWhereConditions: string[] = [];
    const totalOrdersParams: (string | number)[] = [];

    if (fromDate && toDate) {
      totalOrdersWhereConditions.push('DATE(placed_time) BETWEEN ? AND ?');
      totalOrdersParams.push(fromDate, toDate);
    }

    // Only include CONFIRMED orders by default  
    totalOrdersWhereConditions.push('confirmation_status = ?');
    totalOrdersParams.push('CONFIRMED');

    const totalOrdersWhereClause = totalOrdersWhereConditions.length > 0 ? `WHERE ${totalOrdersWhereConditions.join(' AND ')}` : '';

    // Build WHERE conditions for Status-based KPIs (status events within date range)
    const statusWhereConditions: string[] = [];
    const statusParams: (string | number)[] = [];

    if (fromDate && toDate) {
      // ALL orders placed within the date range
      statusWhereConditions.push(`DATE(placed_time) BETWEEN ? AND ?`);
      statusParams.push(fromDate, toDate);
    }

    // Only include CONFIRMED orders by default  
    statusWhereConditions.push('confirmation_status = ?');
    statusParams.push('CONFIRMED');

    const statusWhereClause = statusWhereConditions.length > 0 ? `WHERE ${statusWhereConditions.join(' AND ')}` : '';

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

    // Breach severity classification based on urgent_pct and critical_pct thresholds
    const breachSeverityCase = () => {
      return `
        CASE
          -- Shipped (not delivered): placed->NOW against delivered_tat
          WHEN o.shipped_time IS NOT NULL AND o.delivered_time IS NULL THEN
            CASE
              WHEN TIMESTAMPDIFF(MINUTE, o.placed_time, NOW()) > (${parseTATToMinutes('tc.delivered_tat')} * tc.critical_pct / 100) THEN 'Critical'
              WHEN TIMESTAMPDIFF(MINUTE, o.placed_time, NOW()) > (${parseTATToMinutes('tc.delivered_tat')} * tc.urgent_pct / 100) THEN 'Urgent'
              ELSE 'None'
            END
          -- Processed (not shipped): placed->NOW against shipped_tat
          WHEN o.processed_time IS NOT NULL AND o.shipped_time IS NULL THEN
            CASE
              WHEN TIMESTAMPDIFF(MINUTE, o.placed_time, NOW()) > (${parseTATToMinutes('tc.shipped_tat')} * tc.critical_pct / 100) THEN 'Critical'
              WHEN TIMESTAMPDIFF(MINUTE, o.placed_time, NOW()) > (${parseTATToMinutes('tc.shipped_tat')} * tc.urgent_pct / 100) THEN 'Urgent'
              ELSE 'None'
            END
          -- Not Processed: placed->now against processed_tat
          WHEN o.processed_time IS NULL AND o.shipped_time IS NULL AND o.delivered_time IS NULL THEN
            CASE
              WHEN TIMESTAMPDIFF(MINUTE, o.placed_time, NOW()) > (${parseTATToMinutes('tc.processed_tat')} * tc.critical_pct / 100) THEN 'Critical'
              WHEN TIMESTAMPDIFF(MINUTE, o.placed_time, NOW()) > (${parseTATToMinutes('tc.processed_tat')} * tc.urgent_pct / 100) THEN 'Urgent'
              ELSE 'None'
            END
          ELSE 'None'
        END
      `;
    };
    const breachSeverity = breachSeverityCase();

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

    // Build query for Total Orders (placed_time filter)
    const buildTotalOrdersQuery = () => {
      const baseSelect = `COUNT(*) as total_count`;
      
      const tableQueries = tables.map(table => `
        SELECT ${baseSelect}
        FROM ${table} o
        LEFT JOIN tat_config tc ON o.brand_name COLLATE utf8mb4_unicode_ci = tc.brand_name COLLATE utf8mb4_unicode_ci 
                                 AND o.country_code COLLATE utf8mb4_unicode_ci = tc.country_code COLLATE utf8mb4_unicode_ci
        ${totalOrdersWhereClause}
      `);
    
      return tableQueries.join(' UNION ALL ');
    };

    // Build query for Status-based KPIs (status events within date range)
    const buildStatusKPIsQuery = () => {
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
          ELSE 'OMS Sync'
        END as current_stage,
        ${slaStatusCase} as sla_status,
        ${pendingStatusCase} as pending_status,
        ${breachSeverity} as breach_severity
      `;
      
      const tableQueries = tables.map(table => `
        SELECT ${baseSelect}
        FROM ${table} o
        LEFT JOIN tat_config tc ON o.brand_name COLLATE utf8mb4_unicode_ci = tc.brand_name COLLATE utf8mb4_unicode_ci 
                                 AND o.country_code COLLATE utf8mb4_unicode_ci = tc.country_code COLLATE utf8mb4_unicode_ci
        ${statusWhereClause}
      `);
    
      return tableQueries.join(' UNION ALL ');
    };

    // Build query for Timeline Events (for historical stage breakdown)
    const buildTimelineEventsQuery = () => {
      const tableQueries = tables.map(table => `
        -- Processed events
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
          END as sla_status
        FROM ${table} o
        LEFT JOIN tat_config tc ON o.brand_name COLLATE utf8mb4_unicode_ci = tc.brand_name COLLATE utf8mb4_unicode_ci 
                                 AND o.country_code COLLATE utf8mb4_unicode_ci = tc.country_code COLLATE utf8mb4_unicode_ci
        WHERE o.processed_time IS NOT NULL 
          ${useDateRange ? 'AND DATE(o.processed_time) BETWEEN ? AND ?' : ''}
          AND o.confirmation_status = ?
        
        UNION ALL
        
        -- Shipped events
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
          END as sla_status
        FROM ${table} o
        LEFT JOIN tat_config tc ON o.brand_name COLLATE utf8mb4_unicode_ci = tc.brand_name COLLATE utf8mb4_unicode_ci 
                                 AND o.country_code COLLATE utf8mb4_unicode_ci = tc.country_code COLLATE utf8mb4_unicode_ci
        WHERE o.shipped_time IS NOT NULL 
          ${useDateRange ? 'AND DATE(o.shipped_time) BETWEEN ? AND ?' : ''}
          AND o.confirmation_status = ?
        
        UNION ALL
        
        -- Delivered events
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
          END as sla_status
        FROM ${table} o
        LEFT JOIN tat_config tc ON o.brand_name COLLATE utf8mb4_unicode_ci = tc.brand_name COLLATE utf8mb4_unicode_ci 
                                 AND o.country_code COLLATE utf8mb4_unicode_ci = tc.country_code COLLATE utf8mb4_unicode_ci
        WHERE o.delivered_time IS NOT NULL 
          ${useDateRange ? 'AND DATE(o.delivered_time) BETWEEN ? AND ?' : ''}
          AND o.confirmation_status = ?
      `);
    
      return tableQueries.join(' UNION ALL ');
    };

    // Get Total Orders count (placed within date range)
    const totalOrdersQuery = buildTotalOrdersQuery();
    
    const totalOrdersQueryParams: (string | number)[] = [];
    tables.forEach(() => {
      totalOrdersQueryParams.push(...totalOrdersParams);
    });

    console.log('Executing total orders query...');
    const [totalOrdersRows] = await db.execute(totalOrdersQuery, totalOrdersQueryParams);
    const totalOrdersCounts = totalOrdersRows as Array<{ total_count: number }>;
    const totalOrders = totalOrdersCounts.reduce((sum, row) => sum + row.total_count, 0);

    // Get Status-based KPI data (status events within date range)
    const statusKPIsQuery = buildStatusKPIsQuery();
    
    const statusKPIsQueryParams: (string | number)[] = [];
    tables.forEach(() => {
      statusKPIsQueryParams.push(...statusParams);
    });

    console.log('Executing status KPIs query...');
    const [statusKPIsRows] = await db.execute(statusKPIsQuery, statusKPIsQueryParams);
    const orderData = statusKPIsRows as Array<{
      order_no: string;
      brand_name: string;
      country_code: string;
      order_date: string;
      current_stage: string;
      sla_status: string;
      pending_status: string;
      breach_severity: string;
    }>;

    // Get Timeline Events data for historical stage breakdown
    const timelineEventsQuery = buildTimelineEventsQuery();
    
    const timelineQueryParams: (string | number)[] = [];
    tables.forEach(() => {
      // Each table needs the confirmation status for each of the 3 events (processed, shipped, delivered)
      if (useDateRange) {
        // Add date range parameters for each event
        timelineQueryParams.push(fromDate!, toDate!, 'CONFIRMED'); // Processed events
        timelineQueryParams.push(fromDate!, toDate!, 'CONFIRMED'); // Shipped events  
        timelineQueryParams.push(fromDate!, toDate!, 'CONFIRMED'); // Delivered events
      } else {
        // Only add confirmation status parameter
        timelineQueryParams.push('CONFIRMED'); // Processed events
        timelineQueryParams.push('CONFIRMED'); // Shipped events  
        timelineQueryParams.push('CONFIRMED'); // Delivered events
      }
    });

    console.log('Executing timeline events query for historical breakdown...');
    const [timelineRows] = await db.execute(timelineEventsQuery, timelineQueryParams);
    const timelineData = timelineRows as Array<{
      order_no: string;
      brand_name: string;
      country_code: string;
      event_date: string;
      timeline_stage: string;
      sla_status: string;
    }>;

    // Get last sync time from the most recent updated_at across all tables
    let lastSyncTime: string | null = null;
    if (tables.length > 0) {
      try {
        const lastSyncQuery = `
          SELECT MAX(updated_at) as last_sync
          FROM (
            ${tables.map(table => `SELECT MAX(updated_at) as updated_at FROM ${table}`).join(' UNION ALL ')}
          ) as all_tables
        `;
        const [lastSyncResult] = await db.execute(lastSyncQuery);
        const lastSync = (lastSyncResult as Array<{ last_sync: string | null }>)[0];
        lastSyncTime = lastSync?.last_sync || null;
      } catch (error) {
        console.warn('Could not get last sync time:', error);
      }
    }

    // Get TAT configuration for selected brands and countries
    let tatConfigs: Array<{
      brand_name: string;
      brand_code: string;
      country_code: string;
      processed_tat: string;
      shipped_tat: string;
      delivered_tat: string;
      risk_pct: number;
    }> = [];

    if (tables.length > 0) {
      try {
        // Extract unique brand/country combinations from tables
        const brandCountryCombinations = new Set<string>();
        
        tables.forEach(tableName => {
          const parts = tableName.replace('orders_', '').split('_');
          if (parts.length >= 2) {
            const brandCode = parts.slice(0, -1).join('_');
            const countryCode = parts[parts.length - 1].toUpperCase();
            brandCountryCombinations.add(`${brandCode}_${countryCode}`);
          }
        });

        // Get TAT configs for all brand/country combinations
        const tatConfigQuery = `
          SELECT 
            brand_name,
            brand_code,
            country_code,
            processed_tat,
            shipped_tat,
            delivered_tat,
            risk_pct
          FROM tat_config 
          WHERE (brand_code, country_code) IN (
            ${Array.from(brandCountryCombinations).map(combo => {
              const [brandCode, countryCode] = combo.split('_');
              return `('${brandCode}', '${countryCode}')`;
            }).join(', ')}
          )
          ORDER BY brand_name, country_code
        `;

        const [tatConfigRows] = await db.execute(tatConfigQuery);
        tatConfigs = tatConfigRows as Array<{
          brand_name: string;
          brand_code: string;
          country_code: string;
          processed_tat: string;
          shipped_tat: string;
          delivered_tat: string;
          risk_pct: number;
        }>;

      } catch (error) {
        console.warn('Could not get TAT configurations:', error);
      }
    }

    // Calculate KPIs for v2 (simplified)
    const onTimeOrders = orderData.filter(o => o.sla_status === 'On Time').length;
    
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

    // Calculate at risk order not delivered
    const atRiskOrdersNotDelivered = orderData.filter(o => 
      o.current_stage !== 'Delivered' && o.sla_status === 'At Risk'
    ).length;
    
    // Fulfilled orders that are on time or at risk (excluding breached)
    const fulfilledOnTimeAndAtRiskOrders = fulfilledOnTimeOrders + fulfilledAtRiskOrders;
    
    const breachedPendingOrders = orderData.filter(o => o.pending_status === 'pending' && o.sla_status === 'Breached').length;
    const atRiskPendingOrders = orderData.filter(o => o.pending_status === 'pending' && o.sla_status === 'At Risk').length;

    // Calculate stage breakdown (current state)
    const stageBreakdown = ['Not Processed', 'Processed', 'Shipped', 'Delivered'].map(stage => {
      const stageOrders = orderData.filter(o => o.current_stage === stage);
      const stageTotal = stageOrders.length;
      const stageOnTime = stageOrders.filter(o => o.sla_status === 'On Time').length;
      const stageOnRisk = stageOrders.filter(o => o.sla_status === 'At Risk').length;
      const stageBreached = stageOrders.filter(o => o.sla_status === 'Breached').length;
      const stageUrgent = stageOrders.filter(o => o.breach_severity === 'Urgent').length;
      const stageCritical = stageOrders.filter(o => o.breach_severity === 'Critical').length;
      
      return {
        stage,
        total: stageTotal,
        on_time: stageOnTime,
        on_risk: stageOnRisk,
        breached: stageBreached,
        urgent: stageUrgent,
        critical: stageCritical,
        completion_rate: stageTotal > 0 ? Math.round((stageOnTime / stageTotal) * 100 * 10) / 10 : 0,
        fulfillment_rate: stageTotal > 0 ? Math.round((stageOnTime / stageBreached) * 100 * 10) / 10 : 0
      };
    });

    // Totals for urgent and critical across all stages
    const totalUrgentOrders = orderData.filter(o => o.breach_severity === 'Urgent').length;
    const totalCriticalOrders = orderData.filter(o => o.breach_severity === 'Critical').length;

    // Calculate historical stage breakdown (from timeline events)
    const historicalStageBreakdown = ['Processed', 'Shipped', 'Delivered'].map(stage => {
      const stageEvents = timelineData.filter(o => o.timeline_stage === stage);
      const stageTotal = stageEvents.length;
      const stageOnTime = stageEvents.filter(o => o.sla_status === 'On Time').length;
      const stageOnRisk = stageEvents.filter(o => o.sla_status === 'At Risk').length;
      const stageBreached = stageEvents.filter(o => o.sla_status === 'Breached').length;
      
      return {
        stage,
        total: stageTotal,
        on_time: stageOnTime,
        on_risk: stageOnRisk,
        breached: stageBreached,
        completion_rate: stageTotal > 0 ? Math.round((stageOnTime / stageTotal) * 100 * 10) / 10 : 0,
        fulfillment_rate: stageTotal > 0 ? Math.round((stageOnTime / stageBreached) * 100 * 10) / 10 : 0
      };
    });

    const response = {
      tat_configs: tatConfigs,
      kpis: {
        placed_orders: totalOrders,
        breached_pending_orders: breachedPendingOrders,
        fulfilled_orders: fulfilledOnTimeAndAtRiskOrders,
        fulfilled_breached_orders: fulfilledBreachedOrders,
        at_risk_pending_orders: atRiskPendingOrders,
        at_risk_orders: atRiskOrdersNotDelivered,
        total_urgent_orders: totalUrgentOrders,
        total_critical_orders: totalCriticalOrders,
        completion_rate: totalOrders > 0 ? Math.round((onTimeOrders / totalOrders) * 100 * 10) / 10 : 0,
        fulfillment_rate: totalOrders > 0? Math.round((100- (fulfilledBreachedOrders / (fulfilledOnTimeAndAtRiskOrders + fulfilledBreachedOrders)) * 100) * 10) / 10 : 0,
        last_refresh: lastSyncTime || new Date().toISOString()
      },
      stage_breakdown: stageBreakdown,
      historical_stage_breakdown: historicalStageBreakdown
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Dashboard V2 API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
