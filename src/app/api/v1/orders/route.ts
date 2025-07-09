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
    });

    const db = await getAnalyticsDb();
    
    // Get available table names for brand-country combinations
    const [tableRows] = await db.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE 'orders_%'
    `, [process.env.ANALYTICS_DB_NAME || 'sla_tracker']);

    const tables = (tableRows as Record<string, string>[])
      .map(row => row.TABLE_NAME)
      .filter(tableName => {
        if (filters.brand || filters.country) {
          const parts = tableName.replace('orders_', '').split('_');
          const brandCode = parts.slice(0, -1).join('_');
          const countryCode = parts[parts.length - 1];
          
          if (filters.brand && !brandCode.includes(filters.brand.replace(/\s+/g, '').substring(0, 3).toUpperCase())) {
            return false;
          }
          if (filters.country && countryCode !== filters.country) {
            return false;
          }
        }
        return true;
      });

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
    const params: (string | number | boolean)[] = [];

    if (filters.order_status) {
      whereConditions.push('order_status = ?');
      params.push(filters.order_status);
    }

    if (filters.order_no) {
      whereConditions.push('order_no LIKE ?');
      params.push(`%${filters.order_no}%`);
    }

    if (filters.risk_flag !== undefined) {
      // Calculate risk condition based on TAT config
      whereConditions.push(`
        EXISTS (
          SELECT 1 FROM tat_config t 
          WHERE t.brand_name = o.brand_name 
          AND t.country_code = o.country_code
          AND (
            (o.processed_tat IS NOT NULL AND o.processed_tat > t.processed_tat * t.risk_pct / 100) OR
            (o.shipped_tat IS NOT NULL AND o.shipped_tat > t.shipped_tat * t.risk_pct / 100) OR
            (o.delivered_tat IS NOT NULL AND o.delivered_tat > t.delivered_tat * t.risk_pct / 100)
          )
        ) = ?
      `);
      params.push(filters.risk_flag);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Build UNION query for all relevant tables
    const unionQueries = tables.map(table => `
      SELECT 
        order_no, order_status, shipping_status, order_date,
        processing_time, shipped_time, delivered_time,
        processed_tat, shipped_tat, delivered_tat,
        brand_name, country_code,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM tat_config t 
            WHERE t.brand_name = o.brand_name 
            AND t.country_code = o.country_code
            AND (
              (o.processed_tat IS NOT NULL AND o.processed_tat > t.processed_tat) OR
              (o.shipped_tat IS NOT NULL AND o.shipped_tat > t.shipped_tat) OR
              (o.delivered_tat IS NOT NULL AND o.delivered_tat > t.delivered_tat)
            )
          ) THEN 'Breached'
          WHEN EXISTS (
            SELECT 1 FROM tat_config t 
            WHERE t.brand_name = o.brand_name 
            AND t.country_code = o.country_code
            AND (
              (o.processed_tat IS NOT NULL AND o.processed_tat > t.processed_tat * t.risk_pct / 100) OR
              (o.shipped_tat IS NOT NULL AND o.shipped_tat > t.shipped_tat * t.risk_pct / 100) OR
              (o.delivered_tat IS NOT NULL AND o.delivered_tat > t.delivered_tat * t.risk_pct / 100)
            )
          ) THEN 'At Risk'
          ELSE 'On Time'
        END as sla_status
      FROM ${table} o
      ${whereClause}
    `).join(' UNION ALL ');

    // For now, use a simpler approach without complex parameter binding
    // Build queries with direct substitution for the initial version
    let finalUnionQueries = unionQueries;
    
    // Replace parameter placeholders with actual values for WHERE conditions
    if (filters.order_status) {
      finalUnionQueries = finalUnionQueries.replace(/WHERE.*?=.*?\?/g, () => {
        return `WHERE order_status = '${filters.order_status}'`;
      });
    }
    
    if (filters.order_no) {
      const whereReplacement = filters.order_status ? 'AND' : 'WHERE';
      finalUnionQueries = finalUnionQueries.replace(/AND order_no LIKE \?|WHERE order_no LIKE \?/g, () => {
        return `${whereReplacement} order_no LIKE '%${filters.order_no}%'`;
      });
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM (${finalUnionQueries}) as combined`;
    const [countRows] = await db.execute(countQuery);
    const total = (countRows as Record<string, number>[])[0].total;

    // Get paginated results
    const offset = (filters.page - 1) * filters.limit;
    const dataQuery = `${finalUnionQueries} ORDER BY order_date DESC LIMIT ${filters.limit} OFFSET ${offset}`;
    const [dataRows] = await db.execute(dataQuery);

    const orders = (dataRows as Record<string, string | number | Date | null>[]).map(row => ({
      order_no: String(row.order_no),
      order_status: String(row.order_status),
      shipping_status: String(row.shipping_status),
      order_date: row.order_date,
      processing_time: row.processing_time,
      shipped_time: row.shipped_time,
      delivered_time: row.delivered_time,
      processed_tat: row.processed_tat ? Number(row.processed_tat) : null,
      shipped_tat: row.shipped_tat ? Number(row.shipped_tat) : null,
      delivered_tat: row.delivered_tat ? Number(row.delivered_tat) : null,
      brand_name: String(row.brand_name),
      country_code: String(row.country_code),
      sla_status: String(row.sla_status),
    }));

    return NextResponse.json({
      orders,
      total,
      page: filters.page,
      limit: filters.limit,
      total_pages: Math.ceil(total / filters.limit),
    });
  } catch (error) {
    console.error('Orders API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 