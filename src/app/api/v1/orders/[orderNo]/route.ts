import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsDb } from '@/lib/db';
import { parseTimeStringToMinutes, calculateRiskThreshold } from '@/lib/utils';

interface StageAnalysis {
  stage: string;
  status: 'On Time' | 'At Risk' | 'Breached' | 'N/A';
  actual_time: string | null;
  sla_threshold: string;
  risk_threshold: string;
  exceeded_by: string | null;
  description: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { orderNo: string } }
) {
  try {
    const orderNo = params.orderNo;
    
    if (!orderNo) {
      return NextResponse.json(
        { error: 'Order number is required' },
        { status: 400 }
      );
    }

    const db = await getAnalyticsDb();
    
    // Get available order tables
    const [tableRows] = await db.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'orders_%'
    `);

    const tables = (tableRows as { TABLE_NAME: string }[]).map(row => row.TABLE_NAME);
    
    if (tables.length === 0) {
      return NextResponse.json(
        { error: 'No order tables found' },
        { status: 404 }
      );
    }

    // Search for the order across all tables
    let orderDetails = null;
    
    for (const table of tables) {
      try {
        const [orderRows] = await db.execute(`
          SELECT 
            order_no,
            order_status,
            shipping_status,
            confirmation_status,
            placed_time,
            processed_time,
            shipped_time,
            delivered_time,
            processed_tat,
            shipped_tat,
            delivered_tat,
            currency,
            invoice_no,
            brand_name,
            country_code,
            card_type,
            amount,
            transactionid,
            shipmentid,
            shipping_method,
            carrier,
            tracking_url,
            updated_at,
            -- Calculate current stage
            CASE 
              WHEN delivered_time IS NOT NULL THEN 'Delivered'
              WHEN shipped_time IS NOT NULL AND delivered_time IS NULL THEN 'Shipped'
              WHEN processed_time IS NOT NULL AND shipped_time IS NULL THEN 'Processed'
              WHEN processed_time IS NULL AND shipped_time IS NULL AND delivered_time IS NULL THEN 'Not Processed'
              ELSE 'Processing'
            END as current_stage
          FROM ${table}
          WHERE order_no = ?
          LIMIT 1
        `, [orderNo]);

        if ((orderRows as Record<string, unknown>[]).length > 0) {
          orderDetails = (orderRows as Record<string, unknown>[])[0];
          break;
        }
      } catch (error) {
        console.warn(`Could not search table ${table}:`, error);
        continue;
      }
    }

    if (!orderDetails) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Get TAT configuration for this brand/country
    const [tatConfigRows] = await db.execute(`
      SELECT processed_tat, shipped_tat, delivered_tat, risk_pct
      FROM tat_config 
      WHERE brand_name = ? AND country_code = ?
    `, [orderDetails.brand_name, orderDetails.country_code]);

    // Use fallback if no config found
    const tatConfig = (tatConfigRows as Record<string, string | number>[])[0] || {
      processed_tat: '2h',
      shipped_tat: '2d', 
      delivered_tat: '7d',
      risk_pct: 80
    };

    // Calculate stage analysis
    const stageAnalysis = calculateStageAnalysis(orderDetails, tatConfig);

    // Format the response
    const formattedOrder = {
      order_no: String(orderDetails.order_no || ''),
      order_status: String(orderDetails.order_status || ''),
      shipping_status: String(orderDetails.shipping_status || ''),
      confirmation_status: String(orderDetails.confirmation_status || ''),
      placed_time: orderDetails.placed_time,
      processed_time: orderDetails.processed_time,
      shipped_time: orderDetails.shipped_time,
      delivered_time: orderDetails.delivered_time,
      processed_tat: orderDetails.processed_tat ? String(orderDetails.processed_tat) : null,
      shipped_tat: orderDetails.shipped_tat ? String(orderDetails.shipped_tat) : null,
      delivered_tat: orderDetails.delivered_tat ? String(orderDetails.delivered_tat) : null,
      currency: String(orderDetails.currency || ''),
      invoice_no: String(orderDetails.invoice_no || ''),
      brand_name: String(orderDetails.brand_name || ''),
      country_code: String(orderDetails.country_code || ''),
      // Payment information
      payment: {
        card_type: orderDetails.card_type ? String(orderDetails.card_type) : null,
        amount: orderDetails.amount ? Number(orderDetails.amount) : null,
        transaction_id: orderDetails.transactionid ? String(orderDetails.transactionid) : null,
        currency: String(orderDetails.currency || '')
      },
      // Shipping information
      shipping: {
        shipment_id: orderDetails.shipmentid ? String(orderDetails.shipmentid) : null,
        shipping_method: orderDetails.shipping_method ? String(orderDetails.shipping_method) : null,
        carrier: orderDetails.carrier ? String(orderDetails.carrier) : null,
        tracking_url: orderDetails.tracking_url ? String(orderDetails.tracking_url) : null
      },
      // Status information
      current_stage: String(orderDetails.current_stage || 'Processing'),
      updated_at: orderDetails.updated_at,
      // SLA breach analysis for each stage
      sla_analysis: stageAnalysis,
      // Overall SLA status
      overall_sla_status: determineOverallSLAStatus(stageAnalysis)
    };

    return NextResponse.json({ order: formattedOrder });

  } catch (error) {
    console.error('Order details API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function calculateStageAnalysis(orderDetails: Record<string, unknown>, tatConfig: Record<string, string | number>): StageAnalysis[] {
  const placedTime = orderDetails.placed_time as Date;
  const processedTime = orderDetails.processed_time as Date | null;
  const shippedTime = orderDetails.shipped_time as Date | null;
  const deliveredTime = orderDetails.delivered_time as Date | null;

  const stages: StageAnalysis[] = [];

  // Helper function to format minutes to readable time
  const formatMinutesToTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours < 24) {
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (remainingHours > 0) {
      return `${days}d ${remainingHours}h`;
    }
    return `${days}d`;
  };

  // Helper function to calculate time difference in minutes
  const getTimeDifferenceMinutes = (start: Date, end: Date): number => {
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
  };

  // Processing Stage Analysis
  const processedSLAMinutes = parseTimeStringToMinutes(String(tatConfig.processed_tat));
  const processedRiskMinutes = parseTimeStringToMinutes(calculateRiskThreshold(String(tatConfig.processed_tat), Number(tatConfig.risk_pct)));
  
  if (processedTime && placedTime) {
    const actualProcessingMinutes = getTimeDifferenceMinutes(placedTime, processedTime);
    let status: 'On Time' | 'At Risk' | 'Breached';
    let exceededBy: string | null = null;
    
    if (actualProcessingMinutes > processedSLAMinutes) {
      status = 'Breached';
      exceededBy = formatMinutesToTime(actualProcessingMinutes - processedSLAMinutes);
    } else if (actualProcessingMinutes > processedRiskMinutes) {
      status = 'At Risk';
    } else {
      status = 'On Time';
    }

    stages.push({
      stage: 'Processing',
      status,
      actual_time: formatMinutesToTime(actualProcessingMinutes),
      sla_threshold: String(tatConfig.processed_tat),
      risk_threshold: calculateRiskThreshold(String(tatConfig.processed_tat), Number(tatConfig.risk_pct)),
      exceeded_by: exceededBy,
      description: status === 'Breached' 
        ? `Order took ${formatMinutesToTime(actualProcessingMinutes)} to process, exceeding SLA of ${tatConfig.processed_tat} by ${exceededBy}`
        : status === 'At Risk'
        ? `Order took ${formatMinutesToTime(actualProcessingMinutes)} to process, approaching SLA limit of ${tatConfig.processed_tat}`
        : `Order processed within SLA in ${formatMinutesToTime(actualProcessingMinutes)}`
    });
  } else if (!processedTime) {
    // Order hasn't been processed yet - check if it should have been
    const timeSinceOrder = getTimeDifferenceMinutes(placedTime, new Date());
    let status: 'On Time' | 'At Risk' | 'Breached';
    let exceededBy: string | null = null;
    
    if (timeSinceOrder > processedSLAMinutes) {
      status = 'Breached';
      exceededBy = formatMinutesToTime(timeSinceOrder - processedSLAMinutes);
    } else if (timeSinceOrder > processedRiskMinutes) {
      status = 'At Risk';
    } else {
      status = 'On Time';
    }

    stages.push({
      stage: 'Processing',
      status,
      actual_time: `${formatMinutesToTime(timeSinceOrder)} (pending)`,
      sla_threshold: String(tatConfig.processed_tat),
      risk_threshold: calculateRiskThreshold(String(tatConfig.processed_tat), Number(tatConfig.risk_pct)),
      exceeded_by: exceededBy,
      description: status === 'Breached'
        ? `Order has been pending processing for ${formatMinutesToTime(timeSinceOrder)}, exceeding SLA of ${tatConfig.processed_tat} by ${exceededBy}`
        : status === 'At Risk'
        ? `Order has been pending processing for ${formatMinutesToTime(timeSinceOrder)}, approaching SLA limit of ${tatConfig.processed_tat}`
        : `Order is within processing SLA (${formatMinutesToTime(timeSinceOrder)} elapsed)`
    });
  }

  // Shipping Stage Analysis
  const shippedSLAMinutes = parseTimeStringToMinutes(String(tatConfig.shipped_tat));
  const shippedRiskMinutes = parseTimeStringToMinutes(calculateRiskThreshold(String(tatConfig.shipped_tat), Number(tatConfig.risk_pct)));
  
  if (shippedTime && placedTime) {
    const actualShippingMinutes = getTimeDifferenceMinutes(placedTime, shippedTime);
    let status: 'On Time' | 'At Risk' | 'Breached';
    let exceededBy: string | null = null;
    
    if (actualShippingMinutes > shippedSLAMinutes) {
      status = 'Breached';
      exceededBy = formatMinutesToTime(actualShippingMinutes - shippedSLAMinutes);
    } else if (actualShippingMinutes > shippedRiskMinutes) {
      status = 'At Risk';
    } else {
      status = 'On Time';
    }

    stages.push({
      stage: 'Shipping',
      status,
      actual_time: formatMinutesToTime(actualShippingMinutes),
      sla_threshold: String(tatConfig.shipped_tat),
      risk_threshold: calculateRiskThreshold(String(tatConfig.shipped_tat), Number(tatConfig.risk_pct)),
      exceeded_by: exceededBy,
      description: status === 'Breached'
        ? `Order took ${formatMinutesToTime(actualShippingMinutes)} to ship, exceeding SLA of ${tatConfig.shipped_tat} by ${exceededBy}`
        : status === 'At Risk'
        ? `Order took ${formatMinutesToTime(actualShippingMinutes)} to ship, approaching SLA limit of ${tatConfig.shipped_tat}`
        : `Order shipped within SLA in ${formatMinutesToTime(actualShippingMinutes)}`
    });
  } else if (!shippedTime && processedTime) {
    // Order processed but not shipped yet
    const timeSinceOrder = getTimeDifferenceMinutes(placedTime, new Date());
    let status: 'On Time' | 'At Risk' | 'Breached';
    let exceededBy: string | null = null;
    
    if (timeSinceOrder > shippedSLAMinutes) {
      status = 'Breached';
      exceededBy = formatMinutesToTime(timeSinceOrder - shippedSLAMinutes);
    } else if (timeSinceOrder > shippedRiskMinutes) {
      status = 'At Risk';
    } else {
      status = 'On Time';
    }

    stages.push({
      stage: 'Shipping',
      status,
      actual_time: `${formatMinutesToTime(timeSinceOrder)} (pending)`,
      sla_threshold: String(tatConfig.shipped_tat),
      risk_threshold: calculateRiskThreshold(String(tatConfig.shipped_tat), Number(tatConfig.risk_pct)),
      exceeded_by: exceededBy,
      description: status === 'Breached'
        ? `Order has been pending shipping for ${formatMinutesToTime(timeSinceOrder)}, exceeding SLA of ${tatConfig.shipped_tat} by ${exceededBy}`
        : status === 'At Risk'
        ? `Order has been pending shipping for ${formatMinutesToTime(timeSinceOrder)}, approaching SLA limit of ${tatConfig.shipped_tat}`
        : `Order is within shipping SLA (${formatMinutesToTime(timeSinceOrder)} total elapsed)`
    });
  } else if (!shippedTime && !processedTime) {
    stages.push({
      stage: 'Shipping',
      status: 'N/A',
      actual_time: null,
      sla_threshold: String(tatConfig.shipped_tat),
      risk_threshold: calculateRiskThreshold(String(tatConfig.shipped_tat), Number(tatConfig.risk_pct)),
      exceeded_by: null,
      description: 'Order must be processed before shipping analysis'
    });
  }

  // Delivery Stage Analysis  
  const deliveredSLAMinutes = parseTimeStringToMinutes(String(tatConfig.delivered_tat));
  const deliveredRiskMinutes = parseTimeStringToMinutes(calculateRiskThreshold(String(tatConfig.delivered_tat), Number(tatConfig.risk_pct)));
  
  if (deliveredTime && placedTime) {
    const actualDeliveryMinutes = getTimeDifferenceMinutes(placedTime, deliveredTime);
    let status: 'On Time' | 'At Risk' | 'Breached';
    let exceededBy: string | null = null;
    
    if (actualDeliveryMinutes > deliveredSLAMinutes) {
      status = 'Breached';
      exceededBy = formatMinutesToTime(actualDeliveryMinutes - deliveredSLAMinutes);
    } else if (actualDeliveryMinutes > deliveredRiskMinutes) {
      status = 'At Risk';
    } else {
      status = 'On Time';
    }

    stages.push({
      stage: 'Delivery',
      status,
      actual_time: formatMinutesToTime(actualDeliveryMinutes),
      sla_threshold: String(tatConfig.delivered_tat),
      risk_threshold: calculateRiskThreshold(String(tatConfig.delivered_tat), Number(tatConfig.risk_pct)),
      exceeded_by: exceededBy,
      description: status === 'Breached'
        ? `Order took ${formatMinutesToTime(actualDeliveryMinutes)} to deliver, exceeding SLA of ${tatConfig.delivered_tat} by ${exceededBy}`
        : status === 'At Risk'
        ? `Order took ${formatMinutesToTime(actualDeliveryMinutes)} to deliver, approaching SLA limit of ${tatConfig.delivered_tat}`
        : `Order delivered within SLA in ${formatMinutesToTime(actualDeliveryMinutes)}`
    });
  } else if (!deliveredTime && shippedTime) {
    // Order shipped but not delivered yet
    const timeSinceOrder = getTimeDifferenceMinutes(placedTime, new Date());
    let status: 'On Time' | 'At Risk' | 'Breached';
    let exceededBy: string | null = null;
    
    if (timeSinceOrder > deliveredSLAMinutes) {
      status = 'Breached';
      exceededBy = formatMinutesToTime(timeSinceOrder - deliveredSLAMinutes);
    } else if (timeSinceOrder > deliveredRiskMinutes) {
      status = 'At Risk';
    } else {
      status = 'On Time';
    }

    stages.push({
      stage: 'Delivery',
      status,
      actual_time: `${formatMinutesToTime(timeSinceOrder)} (pending)`,
      sla_threshold: String(tatConfig.delivered_tat),
      risk_threshold: calculateRiskThreshold(String(tatConfig.delivered_tat), Number(tatConfig.risk_pct)),
      exceeded_by: exceededBy,
      description: status === 'Breached'
        ? `Order has been pending delivery for ${formatMinutesToTime(timeSinceOrder)}, exceeding SLA of ${tatConfig.delivered_tat} by ${exceededBy}`
        : status === 'At Risk'
        ? `Order has been pending delivery for ${formatMinutesToTime(timeSinceOrder)}, approaching SLA limit of ${tatConfig.delivered_tat}`
        : `Order is within delivery SLA (${formatMinutesToTime(timeSinceOrder)} total elapsed)`
    });
  } else if (!deliveredTime) {
    stages.push({
      stage: 'Delivery',
      status: 'N/A',
      actual_time: null,
      sla_threshold: String(tatConfig.delivered_tat),
      risk_threshold: calculateRiskThreshold(String(tatConfig.delivered_tat), Number(tatConfig.risk_pct)),
      exceeded_by: null,
      description: 'Order must be shipped before delivery analysis'
    });
  }

  return stages;
}

function determineOverallSLAStatus(stageAnalysis: StageAnalysis[]): string {
  const hasBreached = stageAnalysis.some(stage => stage.status === 'Breached');
  const hasAtRisk = stageAnalysis.some(stage => stage.status === 'At Risk');
  
  if (hasBreached) return 'Breached';
  if (hasAtRisk) return 'At Risk';
  return 'On Time';
} 