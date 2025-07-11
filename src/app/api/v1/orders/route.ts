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
      from_date: searchParams.get('from_date') || undefined,
      to_date: searchParams.get('to_date') || undefined,
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

    // Build a simple query for the first available table (for MVP)
    // In production, you'd want to handle multiple tables properly
    const mainTable = tables[0];
    
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
      whereConditions.push('order_date BETWEEN ? AND ?');
      params.push(filters.from_date, filters.to_date);
    }

    // Add stage filtering based on current stage of orders
    if (filters.stage) {
      if (filters.stage === 'Delivered') {
        whereConditions.push('delivered_time IS NOT NULL');
      } else if (filters.stage === 'Shipped') {
        whereConditions.push('shipped_time IS NOT NULL AND delivered_time IS NULL');
      } else if (filters.stage === 'Processed') {
        whereConditions.push('processing_time IS NOT NULL AND shipped_time IS NULL');
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Build stage-specific SLA status calculation for formatted TAT strings
    const getSLAStatusCase = (stage?: string) => {
      const parseTATToMinutes = (tatField: string) => `
        COALESCE(
          CASE WHEN ${tatField} REGEXP '[0-9]+d' THEN 
            CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(${tatField}, 'd', 1), ' ', -1) AS UNSIGNED) * 1440 
          ELSE 0 END +
          CASE WHEN ${tatField} REGEXP '[0-9]+h' THEN 
            CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(${tatField}, 'h', 1), ' ', -1) AS UNSIGNED) * 60 
          ELSE 0 END +
          CASE WHEN ${tatField} REGEXP '[0-9]+m' THEN 
            CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(${tatField}, 'm', 1), ' ', -1) AS UNSIGNED)
          ELSE 0 END, 0
        )
      `;

      if (stage === 'Processed') {
        return `
          CASE
            WHEN o.processed_tat IS NOT NULL THEN
              CASE 
                WHEN ${parseTATToMinutes('o.processed_tat')} > ${parseTATToMinutes('tc.processed_tat')} THEN 'Breached'
                WHEN ${parseTATToMinutes('o.processed_tat')} > (${parseTATToMinutes('tc.processed_tat')} * tc.risk_pct / 100) THEN 'At Risk'
                ELSE 'On Time'
              END
            ELSE 'On Time'
          END
        `;
      } else if (stage === 'Shipped') {
        return `
          CASE
            WHEN o.shipped_tat IS NOT NULL THEN
              CASE 
                WHEN ${parseTATToMinutes('o.shipped_tat')} > ${parseTATToMinutes('tc.shipped_tat')} THEN 'Breached'
                WHEN ${parseTATToMinutes('o.shipped_tat')} > (${parseTATToMinutes('tc.shipped_tat')} * tc.risk_pct / 100) THEN 'At Risk'
                ELSE 'On Time'
              END
            ELSE 'On Time'
          END
        `;
      } else if (stage === 'Delivered') {
        return `
          CASE
            WHEN o.delivered_tat IS NOT NULL THEN
              CASE 
                WHEN ${parseTATToMinutes('o.delivered_tat')} > ${parseTATToMinutes('tc.delivered_tat')} THEN 'Breached'
                WHEN ${parseTATToMinutes('o.delivered_tat')} > (${parseTATToMinutes('tc.delivered_tat')} * tc.risk_pct / 100) THEN 'At Risk'
                ELSE 'On Time'
              END
            ELSE 'On Time'
          END
        `;
      } else {
        // Default to processed stage if no stage specified
        return `
          CASE
            WHEN o.processed_tat IS NOT NULL THEN
              CASE 
                WHEN ${parseTATToMinutes('o.processed_tat')} > ${parseTATToMinutes('tc.processed_tat')} THEN 'Breached'
                WHEN ${parseTATToMinutes('o.processed_tat')} > (${parseTATToMinutes('tc.processed_tat')} * tc.risk_pct / 100) THEN 'At Risk'
                ELSE 'On Time'
              END
            ELSE 'On Time'
          END
        `;
      }
    };

    const slaStatusCase = getSLAStatusCase(filters.stage);

    // Get total count with stage-specific SLA logic
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM ${mainTable} o
      LEFT JOIN tat_config tc ON o.brand_name COLLATE utf8mb4_unicode_ci = tc.brand_name COLLATE utf8mb4_unicode_ci 
                               AND o.country_code COLLATE utf8mb4_unicode_ci = tc.country_code COLLATE utf8mb4_unicode_ci
      ${whereClause}
      ${filters.sla_status ? `${whereClause ? 'AND' : 'WHERE'} (${slaStatusCase}) = ?` : ''}
    `;
    const countParams = [...params];
    if (filters.sla_status) {
      countParams.push(filters.sla_status);
    }
    const [countRows] = await db.execute(countQuery, countParams);
    const total = (countRows as { total: number }[])[0].total;

    // Get paginated results
    const offset = (filters.page - 1) * filters.limit;
    const dataQuery = `
      SELECT 
        o.order_no, o.order_status, o.shipping_status, o.order_date,
        o.processing_time, o.shipped_time, o.delivered_time,
        o.processed_tat, o.shipped_tat, o.delivered_tat,
        o.brand_name, o.country_code,
        ${slaStatusCase} as sla_status,
        CASE 
          WHEN o.delivered_time IS NOT NULL THEN 'Delivered'
          WHEN o.shipped_time IS NOT NULL AND o.delivered_time IS NULL THEN 'Shipped'
          WHEN o.processing_time IS NOT NULL AND o.shipped_time IS NULL THEN 'Processed'
          ELSE 'Processing'
        END as current_stage
      FROM ${mainTable} o
      LEFT JOIN tat_config tc ON o.brand_name COLLATE utf8mb4_unicode_ci = tc.brand_name COLLATE utf8mb4_unicode_ci 
                               AND o.country_code COLLATE utf8mb4_unicode_ci = tc.country_code COLLATE utf8mb4_unicode_ci
      ${whereClause}
      ${filters.sla_status ? `${whereClause ? 'AND' : 'WHERE'} (${slaStatusCase}) = ?` : ''}
      ORDER BY o.order_date DESC 
      LIMIT ${filters.limit} OFFSET ${offset}
    `;
    
    if (filters.sla_status) {
      params.push(filters.sla_status);
    }

    const [dataRows] = await db.execute(dataQuery, params);

    const orders = (dataRows as Record<string, string | number | Date | null>[]).map(row => ({
      order_no: String(row.order_no || ''),
      order_status: String(row.order_status || ''),
      shipping_status: String(row.shipping_status || ''),
      order_date: row.order_date,
      processing_time: row.processing_time,
      shipped_time: row.shipped_time,
      delivered_time: row.delivered_time,
      processed_tat: row.processed_tat ? String(row.processed_tat) : null,
      shipped_tat: row.shipped_tat ? String(row.shipped_tat) : null,
      delivered_tat: row.delivered_tat ? String(row.delivered_tat) : null,
      brand_name: String(row.brand_name || ''),
      country_code: String(row.country_code || ''),
      current_stage: String(row.current_stage || 'Processing'),
      sla_status: String(row.sla_status || 'Unknown'),
    }));

    return NextResponse.json({
      orders,
      total,
      page: filters.page,
      limit: filters.limit,
      total_pages: Math.ceil(total / filters.limit),
      debug: {
        tables_found: tables.length,
        main_table: mainTable,
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