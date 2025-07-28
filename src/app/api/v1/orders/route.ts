import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsDb } from '@/lib/db';
import { orderFiltersSchema } from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = orderFiltersSchema.parse({
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      order_status: searchParams.get('order_status') || undefined,
      risk_flag: searchParams.get('risk_flag') || undefined,
      order_no: searchParams.get('order_no') || undefined,
      brand: searchParams.get('brand') || undefined,
      country: searchParams.get('country') || undefined,
      sla_status: searchParams.get('sla_status') || undefined,
      stage: searchParams.get('stage') || undefined,
      pending_status: searchParams.get('pending_status') || undefined,
      from_date: searchParams.get('from_date') || undefined,
      to_date: searchParams.get('to_date') || undefined,
      confirmation_status: searchParams.get('confirmation_status') || undefined,
      fulfilment_status: searchParams.get('fulfilment_status') || undefined,
      kpi_mode: searchParams.get('kpi_mode') || undefined,
    });

    const db = await getAnalyticsDb();
    
    // Get available order tables
    const [tableRows] = await db.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'orders_%'
    `);

    let tables = (tableRows as { TABLE_NAME: string }[]).map(row => row.TABLE_NAME);
    
    // Apply brand/country filters to table selection
    if (filters.brand || filters.country) {
      tables = tables.filter(tableName => {
        const parts = tableName.replace('orders_', '').split('_');
        if (parts.length < 2) return false;
        
        const brandCode = parts.slice(0, -1).join('_');
        const countryCode = parts[parts.length - 1];
        
        if (filters.brand) {
          // Map brand filter to brand code
          let expectedBrand = '';
          if (filters.brand.toLowerCase().includes('victoria') || filters.brand.toLowerCase() === 'vs') {
            expectedBrand = 'vs';
          } else if (filters.brand.toLowerCase().includes('bbw') || filters.brand.toLowerCase().includes('bath')) {
            expectedBrand = 'bbw';
          } else if (filters.brand.toLowerCase().includes('rituals')) {
            expectedBrand = 'rituals';
          }
          
          if (expectedBrand && brandCode !== expectedBrand) {
            return false;
          }
        }
        
        if (filters.country && countryCode.toLowerCase() !== filters.country.toLowerCase()) {
          return false;
        }
        
        return true;
      });
    }

    if (tables.length === 0) {
      return NextResponse.json({
        orders: [],
        total: 0,
        page: filters.page,
        limit: filters.limit,
        total_pages: 0,
      });
    }

    // Build WHERE conditions
    const whereConditions: string[] = [];
    const params: (string | number)[] = [];

    if (filters.order_status) {
      whereConditions.push('order_status = ?');
      params.push(filters.order_status);
    }

    if (filters.order_no) {
      whereConditions.push('order_no LIKE ?');
      params.push(`%${filters.order_no}%`);
    }

    if (filters.from_date && filters.to_date) {
      if (filters.kpi_mode) {
        // KPI mode: Filter by status events within date range (same logic as dashboard)
        whereConditions.push(`(
          (processed_time IS NOT NULL AND DATE(processed_time) BETWEEN ? AND ?) OR 
          (shipped_time IS NOT NULL AND DATE(shipped_time) BETWEEN ? AND ?) OR 
          (delivered_time IS NOT NULL AND DATE(delivered_time) BETWEEN ? AND ?)
        )`);
        params.push(filters.from_date, filters.to_date, filters.from_date, filters.to_date, filters.from_date, filters.to_date);
      } else {
        // Normal mode: Filter by placed_time (existing logic)
        whereConditions.push('DATE(placed_time) BETWEEN ? AND ?');
        params.push(filters.from_date, filters.to_date);
      }
    }

    // only include CONFIRMED orders by default
    if (filters.confirmation_status) {
      whereConditions.push('confirmation_status = ?');
      params.push(filters.confirmation_status);
    } else {
      whereConditions.push('confirmation_status = ?');
      params.push('CONFIRMED');
    }

    // Filter out "Not Processed" orders from UI unless explicitly requested
    // if (filters.stage !== 'Not Processed') {
    //   whereConditions.push('NOT (processed_time IS NULL AND shipped_time IS NULL AND delivered_time IS NULL)');
    // }

    // Add fulfilment_status filtering (for KPI compatibility)
    if (filters.fulfilment_status) {
      if (filters.fulfilment_status === 'fulfilled') {
        // Fulfilled orders are those that are delivered
        whereConditions.push('delivered_time IS NOT NULL');
      }
    }

    // Add stage filtering based on current stage of orders
    if (filters.stage) {
      if (filters.stage === 'Delivered') {
        whereConditions.push('delivered_time IS NOT NULL');
      } else if (filters.stage === 'Shipped') {
        whereConditions.push('shipped_time IS NOT NULL AND delivered_time IS NULL');
      } else if (filters.stage === 'Processed') {
        whereConditions.push('processed_time IS NOT NULL AND shipped_time IS NULL');
      } else if (filters.stage === 'Not Processed') {
        whereConditions.push('processed_time IS NULL AND shipped_time IS NULL AND delivered_time IS NULL');
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Build stage-specific SLA status calculation for formatted TAT strings
    const getSLAStatusCase = () => {
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

      // Calculate SLA status based on the order's CURRENT status and where it should be by now
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

    // Build pending status calculation
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

    // Query ALL tables using UNION to get complete data set
    const buildUnionQuery = (queryType: 'count' | 'data', limit?: number, offset?: number) => {
      const baseSelectFields = queryType === 'count' ? 'COUNT(*) as count' : `
        o.order_no, o.order_status, o.shipping_status, o.confirmation_status,
        o.placed_time as order_date,
        o.processed_time, o.shipped_time, o.delivered_time,
        o.processed_tat, o.shipped_tat, o.delivered_tat,
        o.brand_name, o.country_code,
        tc.processed_tat as config_processed_tat, tc.shipped_tat as config_shipped_tat, tc.delivered_tat as config_delivered_tat,
        ${slaStatusCase} as sla_status,
        ${pendingStatusCase} as pending_status,
        CASE 
          WHEN o.delivered_time IS NOT NULL THEN 'Delivered'
          WHEN o.shipped_time IS NOT NULL AND o.delivered_time IS NULL THEN 'Shipped'
          WHEN o.processed_time IS NOT NULL AND o.shipped_time IS NULL THEN 'OMS Synced'
          WHEN o.processed_time IS NULL AND o.shipped_time IS NULL AND o.delivered_time IS NULL THEN 'Not Synced to OMS'
          ELSE 'OMS Sync'
        END as current_stage,
        CASE 
          -- For orders not yet processed
          WHEN o.processed_time IS NULL AND o.shipped_time IS NULL AND o.delivered_time IS NULL
               AND TIMESTAMPDIFF(MINUTE, o.placed_time, NOW()) > (${parseTATToMinutes('tc.pending_not_processed_time')}) 
               THEN ROUND(TIMESTAMPDIFF(MINUTE, o.placed_time, NOW()) / 60.0, 1)
          
          -- For orders processed but not shipped
          WHEN o.processed_time IS NOT NULL 
               AND o.shipped_time IS NULL 
               AND TIMESTAMPDIFF(MINUTE, o.processed_time, NOW()) > (${parseTATToMinutes('tc.pending_processed_time')}) 
               THEN ROUND(TIMESTAMPDIFF(MINUTE, o.processed_time, NOW()) / 60.0, 1)
          
          -- For orders shipped but not delivered
          WHEN o.shipped_time IS NOT NULL 
               AND o.delivered_time IS NULL 
               AND TIMESTAMPDIFF(MINUTE, o.shipped_time, NOW()) > (${parseTATToMinutes('tc.pending_shipped_time')}) 
               THEN ROUND(TIMESTAMPDIFF(MINUTE, o.shipped_time, NOW()) / 60.0, 1)
          
          -- For orders that are confirmed but stuck in processing phase
          WHEN o.processed_time IS NULL 
               AND o.shipped_time IS NULL 
               AND o.delivered_time IS NULL
               AND TIMESTAMPDIFF(MINUTE, o.placed_time, NOW()) > (${parseTATToMinutes('tc.pending_processed_time')}) 
               THEN ROUND(TIMESTAMPDIFF(MINUTE, o.placed_time, NOW()) / 60.0, 1)
          
          ELSE 0
        END as pending_hours
      `;
      
      // Handle comma-separated SLA status values (e.g., "On Time,At Risk")
      let slaFilter = '';
      if (filters.sla_status) {
        const slaValues = filters.sla_status.split(',').map(s => s.trim());
        if (slaValues.length === 1) {
          slaFilter = `AND (${slaStatusCase}) = ?`;
        } else {
          const placeholders = slaValues.map(() => '?').join(',');
          slaFilter = `AND (${slaStatusCase}) IN (${placeholders})`;
        }
      }
      
      const pendingFilter = filters.pending_status ? `AND (${pendingStatusCase}) = ?` : '';
      
      const tableQueries = tables.map(table => `
        SELECT ${baseSelectFields}
        FROM ${table} o
        LEFT JOIN tat_config tc ON o.brand_name COLLATE utf8mb4_unicode_ci = tc.brand_name COLLATE utf8mb4_unicode_ci 
                                 AND o.country_code COLLATE utf8mb4_unicode_ci = tc.country_code COLLATE utf8mb4_unicode_ci
        ${whereClause}
        ${slaFilter}
        ${pendingFilter}
      `);
      
      let unionQuery = tableQueries.join(' UNION ALL ');
      
      if (queryType === 'count') {
        unionQuery = `SELECT SUM(count) as total FROM (${unionQuery}) as combined_counts`;
      } else {
        unionQuery = `SELECT * FROM (${unionQuery}) as combined_orders ORDER BY order_date DESC`;
        if (limit && offset !== undefined) {
          unionQuery += ` LIMIT ${limit} OFFSET ${offset}`;
        }
      }
      
      return unionQuery;
    };

    // Get total count with UNION of all tables
    const countQuery = buildUnionQuery('count');
    const countParams: (string | number)[] = [];
    
    // Add parameters for each table in the union
    tables.forEach(() => {
      countParams.push(...params);
      if (filters.sla_status) {
        const slaValues = filters.sla_status.split(',').map(s => s.trim());
        countParams.push(...slaValues);
      }
      if (filters.pending_status) {
        countParams.push(filters.pending_status);
      }
    });

    const [countRows] = await db.execute(countQuery, countParams);
    const total = (countRows as { total: number }[])[0].total;

    // Get paginated results from all tables
    const offset = (filters.page - 1) * filters.limit;
    const dataQuery = buildUnionQuery('data', filters.limit, offset);
    
    const dataParams: (string | number)[] = [];
    tables.forEach(() => {
      dataParams.push(...params);
      if (filters.sla_status) {
        const slaValues = filters.sla_status.split(',').map(s => s.trim());
        dataParams.push(...slaValues);
      }
      if (filters.pending_status) {
        dataParams.push(filters.pending_status);
      }
    });

    const [dataRows] = await db.execute(dataQuery, dataParams);

    const orders = (dataRows as Record<string, string | number | Date | null>[]).map(row => ({
      order_no: String(row.order_no || ''),
      order_status: String(row.order_status || ''),
      shipping_status: String(row.shipping_status || ''),
      confirmation_status: String(row.confirmation_status || ''),
      order_date: row.order_date,
      processed_time: row.processed_time,
      shipped_time: row.shipped_time,
      delivered_time: row.delivered_time,
      processed_tat: row.processed_tat ? String(row.processed_tat) : null,
      shipped_tat: row.shipped_tat ? String(row.shipped_tat) : null,
      delivered_tat: row.delivered_tat ? String(row.delivered_tat) : null,
      brand_name: String(row.brand_name || ''),
      country_code: String(row.country_code || ''),
              current_stage: String(row.current_stage || 'OMS Sync'),
      sla_status: String(row.sla_status || 'Unknown'),
      pending_status: String(row.pending_status || 'normal'),
      pending_hours: Number(row.pending_hours || 0),
      config_processed_tat: row.config_processed_tat ? String(row.config_processed_tat) : null,
      config_shipped_tat: row.config_shipped_tat ? String(row.config_shipped_tat) : null,
      config_delivered_tat: row.config_delivered_tat ? String(row.config_delivered_tat) : null,
    }));

    return NextResponse.json({
      orders,
      total,
      page: filters.page,
      limit: filters.limit,
      total_pages: Math.ceil(total / filters.limit),
      debug: {
        tables_found: tables.length,
        tables_queried: tables,
        where_clause: whereClause
      }
    });

  } catch (error) {
    console.error('Orders API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 