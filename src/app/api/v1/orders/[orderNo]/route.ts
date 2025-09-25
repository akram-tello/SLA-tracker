import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsDb } from '@/lib/db';
import { parseTimeStringToMinutes, calculateRiskThreshold, formatToMasterDbTime, formatToLocalTimeWithOffset } from '@/lib/utils';

// Country code to timezone mapping for SLA calculations
const COUNTRY_TIMEZONE_MAPPING: Record<string, { timezone: string; offsetHours: number; abbreviation: string }> = {
  'MY': { timezone: 'Asia/Kuala_Lumpur', offsetHours: 8, abbreviation: 'MY' },
  'SG': { timezone: 'Asia/Singapore', offsetHours: 8, abbreviation: 'SG' },
  'TH': { timezone: 'Asia/Bangkok', offsetHours: 7, abbreviation: 'TH' },
  'ID': { timezone: 'Asia/Jakarta', offsetHours: 7, abbreviation: 'ID' },
  'PH': { timezone: 'Asia/Manila', offsetHours: 8, abbreviation: 'PH' },
  'HK': { timezone: 'Asia/Hong_Kong', offsetHours: 8, abbreviation: 'HK' },
  'AU': { timezone: 'Australia/Sydney', offsetHours: 10, abbreviation: 'AU' }, 
  'NZ': { timezone: 'Pacific/Auckland', offsetHours: 12, abbreviation: 'NZ' }, 
  'VN': { timezone: 'Asia/Ho_Chi_Minh', offsetHours: 7, abbreviation: 'VN' }
};

/**
 * Calculate time difference in minutes between two local time strings
 * Automatically detects timezone from the timezone suffix in the strings
 */
function calculateTimeDifferenceFromLocalStrings(startTimeString: string, endTimeString: string): number {
  if (!startTimeString || !endTimeString) return 0;
  
  // Extract timezone from the string (e.g., "(HK)", "(AU)", etc.)
  const timezoneMatch = startTimeString.match(/\(([^)]+)\)$/);
  const countryCode = timezoneMatch ? timezoneMatch[1] : 'HK';
  
  // Get the timezone offset based on country code
  const timezoneInfo = COUNTRY_TIMEZONE_MAPPING[countryCode] || COUNTRY_TIMEZONE_MAPPING['HK'];
  const offsetHours = timezoneInfo.offsetHours;
  
  // Remove timezone suffixes like " (HK)" or " (AU)"
  const cleanStartTime = startTimeString.replace(/\s*\([^)]+\)$/, '');
  const cleanEndTime = endTimeString.replace(/\s*\([^)]+\)$/, '');
  
  // Parse with the correct timezone offset
  const offsetString = offsetHours >= 0 ? `+${offsetHours.toString().padStart(2, '0')}:00` : `${offsetHours.toString().padStart(3, '0')}:00`;
  const startDate = new Date(cleanStartTime.replace(' ', 'T') + offsetString);
  const endDate = new Date(cleanEndTime.replace(' ', 'T') + offsetString);
  
  // Calculate difference in minutes
  return Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60));
}

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
  { params }: { params: Promise<{ orderNo: string }> }
) {
  try {
    const { orderNo } = await params;
    
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
      SELECT processed_tat, shipped_tat, delivered_tat, risk_pct, urgent_pct, critical_pct
      FROM tat_config 
      WHERE brand_name = ? AND country_code = ?
    `, [orderDetails.brand_name, orderDetails.country_code]);

    // Use fallback if no config found
    const tatConfig = (tatConfigRows as Record<string, string | number>[])[0] || {
      processed_tat: '2h',
      shipped_tat: '2d', 
      delivered_tat: '7d',
      risk_pct: 80,
      urgent_pct: 100,
      critical_pct: 150
    };

    // Extract country code for timezone conversion
    const countryCode = String(orderDetails.country_code || '');

    // Calculate stage analysis using local time strings for accurate SLA calculations
    const localTimes = {
      placed_time_local: formatToLocalTimeWithOffset(orderDetails.placed_time as Date, countryCode),
      processed_time_local: formatToLocalTimeWithOffset(orderDetails.processed_time as Date, countryCode),
      shipped_time_local: formatToLocalTimeWithOffset(orderDetails.shipped_time as Date, countryCode),
      delivered_time_local: formatToLocalTimeWithOffset(orderDetails.delivered_time as Date, countryCode)
    };
    const stageAnalysis = calculateStageAnalysis(orderDetails, tatConfig, localTimes, countryCode);

    //! Calculate breach severity for current pending state only (Delivered => None)
    const nowUtc = new Date();
    const placedUtc = orderDetails.placed_time ? new Date(orderDetails.placed_time as Date) : null;
    const placedToNowMinutes = placedUtc
      ? Math.floor((nowUtc.getTime() - placedUtc.getTime()) / (1000 * 60))
      : 0;
    const processedTatMinutes = parseTimeStringToMinutes(String(tatConfig.processed_tat));
    const shippedTatMinutes = parseTimeStringToMinutes(String(tatConfig.shipped_tat));
    const deliveredTatMinutes = parseTimeStringToMinutes(String(tatConfig.delivered_tat));
    const urgentPct = Number(tatConfig.urgent_pct || 100);
    const criticalPct = Number(tatConfig.critical_pct || 150);

    let breachSeverity: 'None' | 'Urgent' | 'Critical' = 'None';

    // Determine current pending stage and apply thresholds
    if (orderDetails.delivered_time) {
      breachSeverity = 'None';
    } else if (orderDetails.shipped_time) {
      const urgentThreshold = (deliveredTatMinutes * urgentPct) / 100;
      const criticalThreshold = (deliveredTatMinutes * criticalPct) / 100;
      breachSeverity = placedToNowMinutes > criticalThreshold
        ? 'Critical'
        : (placedToNowMinutes > urgentThreshold ? 'Urgent' : 'None');
    } else if (orderDetails.processed_time) {
      const urgentThreshold = (shippedTatMinutes * urgentPct) / 100;
      const criticalThreshold = (shippedTatMinutes * criticalPct) / 100;
      breachSeverity = placedToNowMinutes > criticalThreshold
        ? 'Critical'
        : (placedToNowMinutes > urgentThreshold ? 'Urgent' : 'None');
    } else {
      const urgentThreshold = (processedTatMinutes * urgentPct) / 100;
      const criticalThreshold = (processedTatMinutes * criticalPct) / 100;
      breachSeverity = placedToNowMinutes > criticalThreshold
        ? 'Critical'
        : (placedToNowMinutes > urgentThreshold ? 'Urgent' : 'None');
    }

    // Format the response
    const formattedOrder = {
      order_no: String(orderDetails.order_no || ''),
      order_status: String(orderDetails.order_status || ''),
      shipping_status: String(orderDetails.shipping_status || ''),
      confirmation_status: String(orderDetails.confirmation_status || ''),
      placed_time: formatToMasterDbTime(orderDetails.placed_time as Date) || orderDetails.placed_time,
      placed_time_local: formatToLocalTimeWithOffset(orderDetails.placed_time as Date, countryCode),
      processed_time: formatToMasterDbTime(orderDetails.processed_time as Date) || orderDetails.processed_time,
      processed_time_local: formatToLocalTimeWithOffset(orderDetails.processed_time as Date, countryCode),
      shipped_time: formatToMasterDbTime(orderDetails.shipped_time as Date) || orderDetails.shipped_time,
      shipped_time_local: formatToLocalTimeWithOffset(orderDetails.shipped_time as Date, countryCode),
      delivered_time: formatToMasterDbTime(orderDetails.delivered_time as Date) || orderDetails.delivered_time,
      delivered_time_local: formatToLocalTimeWithOffset(orderDetails.delivered_time as Date, countryCode),
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
      overall_sla_status: determineOverallSLAStatus(stageAnalysis),
      // Breach severity for the current pending state (Delivered => None)
      breach_severity: breachSeverity
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

function calculateStageAnalysis(
  orderDetails: Record<string, unknown>, 
  tatConfig: Record<string, string | number>,
  localTimes: Record<string, string | null>,
  countryCode: string
): StageAnalysis[] {
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

  // Processing Stage Analysis
  const processedSLAMinutes = parseTimeStringToMinutes(String(tatConfig.processed_tat));
  const processedRiskMinutes = parseTimeStringToMinutes(calculateRiskThreshold(String(tatConfig.processed_tat), Number(tatConfig.risk_pct)));
  
  if (localTimes.processed_time_local && localTimes.placed_time_local) {
    const actualProcessingMinutes = calculateTimeDifferenceFromLocalStrings(
      localTimes.placed_time_local,
      localTimes.processed_time_local
    );
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
      stage: 'OMS Sync',
      status,
      actual_time: formatMinutesToTime(actualProcessingMinutes),
      sla_threshold: String(tatConfig.processed_tat),
      risk_threshold: calculateRiskThreshold(String(tatConfig.processed_tat), Number(tatConfig.risk_pct)),
      exceeded_by: exceededBy,
      description: status === 'Breached' 
        ? `Order took ${formatMinutesToTime(actualProcessingMinutes)} to sync to OMS, exceeding SLA of ${tatConfig.processed_tat} by ${exceededBy}`
        : status === 'At Risk'
        ? `Order took ${formatMinutesToTime(actualProcessingMinutes)} to sync to OMS, approaching SLA limit of ${tatConfig.processed_tat}`
        : `Order synced to OMS within SLA in ${formatMinutesToTime(actualProcessingMinutes)}`
    });
  } else if (!localTimes.processed_time_local) {
    // Order hasn't been processed yet - check if it should have been
    // Use the actual current local time for the specific country for SLA calculations
    const now = new Date();
    const countryKey = countryCode?.toUpperCase();
    const timezoneInfo = COUNTRY_TIMEZONE_MAPPING[countryKey || 'MY'] || COUNTRY_TIMEZONE_MAPPING['MY'];
    
    const currentTimeLocal = now.toLocaleString('sv-SE', { 
      timeZone: timezoneInfo.timezone,
      hour12: false 
    });
    const currentTimeFormatted = `${currentTimeLocal} (${timezoneInfo.abbreviation})`;
    
    const timeSinceOrder = calculateTimeDifferenceFromLocalStrings(
      localTimes.placed_time_local!,
      currentTimeFormatted
    );
    
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
      stage: 'OMS Sync',
      status,
      actual_time: `${formatMinutesToTime(timeSinceOrder)} (elapsed)`,
      sla_threshold: String(tatConfig.processed_tat),
      risk_threshold: calculateRiskThreshold(String(tatConfig.processed_tat), Number(tatConfig.risk_pct)),
      exceeded_by: exceededBy,
      description: status === 'Breached'
        ? `Order has been pending OMS sync for ${formatMinutesToTime(timeSinceOrder)}, exceeding SLA of ${tatConfig.processed_tat} by ${exceededBy}`
        : status === 'At Risk'
        ? `Order has been pending OMS sync for ${formatMinutesToTime(timeSinceOrder)}, approaching SLA limit of ${tatConfig.processed_tat}`
        : `Order is within OMS sync SLA (${formatMinutesToTime(timeSinceOrder)} elapsed)`
    });
  }

  // Shipping Stage Analysis
  const shippedSLAMinutes = parseTimeStringToMinutes(String(tatConfig.shipped_tat));
  const shippedRiskMinutes = parseTimeStringToMinutes(calculateRiskThreshold(String(tatConfig.shipped_tat), Number(tatConfig.risk_pct)));
  
  if (localTimes.shipped_time_local && localTimes.placed_time_local) {
    const actualShippingMinutes = calculateTimeDifferenceFromLocalStrings(
      localTimes.placed_time_local,
      localTimes.shipped_time_local
    );
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
  } else if (!localTimes.shipped_time_local && localTimes.processed_time_local) {
    // Order processed but not shipped yet
    const now = new Date();
    const countryKey = countryCode?.toUpperCase();
    const timezoneInfo = COUNTRY_TIMEZONE_MAPPING[countryKey || 'MY'] || COUNTRY_TIMEZONE_MAPPING['MY'];
    
    const currentTimeLocal = now.toLocaleString('sv-SE', { 
      timeZone: timezoneInfo.timezone,
      hour12: false 
    });
    const currentTimeFormatted = `${currentTimeLocal} (${timezoneInfo.abbreviation})`;
    
    const timeSinceOrder = calculateTimeDifferenceFromLocalStrings(
      localTimes.placed_time_local!,
      currentTimeFormatted
    );
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
      actual_time: `${formatMinutesToTime(timeSinceOrder)} (elapsed)`,
      sla_threshold: String(tatConfig.shipped_tat),
      risk_threshold: calculateRiskThreshold(String(tatConfig.shipped_tat), Number(tatConfig.risk_pct)),
      exceeded_by: exceededBy,
      description: status === 'Breached'
        ? `Order has been pending shipping for ${formatMinutesToTime(timeSinceOrder)}, exceeding SLA of ${tatConfig.shipped_tat} by ${exceededBy}`
        : status === 'At Risk'
        ? `Order has been pending shipping for ${formatMinutesToTime(timeSinceOrder)}, approaching SLA limit of ${tatConfig.shipped_tat}`
        : `Order is within shipping SLA (${formatMinutesToTime(timeSinceOrder)} total elapsed)`
    });
  } else if (!localTimes.shipped_time_local && !localTimes.processed_time_local) {
    stages.push({
      stage: 'Shipping',
      status: 'N/A',
      actual_time: null,
      sla_threshold: String(tatConfig.shipped_tat),
      risk_threshold: calculateRiskThreshold(String(tatConfig.shipped_tat), Number(tatConfig.risk_pct)),
      exceeded_by: null,
      description: 'Order must be synced to OMS before shipping analysis'
    });
  }

  // Delivery Stage Analysis  
  const deliveredSLAMinutes = parseTimeStringToMinutes(String(tatConfig.delivered_tat));
  const deliveredRiskMinutes = parseTimeStringToMinutes(calculateRiskThreshold(String(tatConfig.delivered_tat), Number(tatConfig.risk_pct)));
  
  if (localTimes.delivered_time_local && localTimes.placed_time_local) {
    const actualDeliveryMinutes = calculateTimeDifferenceFromLocalStrings(
      localTimes.placed_time_local,
      localTimes.delivered_time_local
    );
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
  } else if (!localTimes.delivered_time_local && localTimes.shipped_time_local) {
    // Order shipped but not delivered yet
    const now = new Date();
    const countryKey = countryCode?.toUpperCase();
    const timezoneInfo = COUNTRY_TIMEZONE_MAPPING[countryKey || 'MY'] || COUNTRY_TIMEZONE_MAPPING['MY'];
    
    const currentTimeLocal = now.toLocaleString('sv-SE', { 
      timeZone: timezoneInfo.timezone,
      hour12: false 
    });
    const currentTimeFormatted = `${currentTimeLocal} (${timezoneInfo.abbreviation})`;
    
    const timeSinceOrder = calculateTimeDifferenceFromLocalStrings(
      localTimes.placed_time_local!,
      currentTimeFormatted
    );
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
      actual_time: `${formatMinutesToTime(timeSinceOrder)} (elapsed)`,
      sla_threshold: String(tatConfig.delivered_tat),
      risk_threshold: calculateRiskThreshold(String(tatConfig.delivered_tat), Number(tatConfig.risk_pct)),
      exceeded_by: exceededBy,
      description: status === 'Breached'
        ? `Order has been pending delivery for ${formatMinutesToTime(timeSinceOrder)}, exceeding SLA of ${tatConfig.delivered_tat} by ${exceededBy}`
        : status === 'At Risk'
        ? `Order has been pending delivery for ${formatMinutesToTime(timeSinceOrder)}, approaching SLA limit of ${tatConfig.delivered_tat}`
        : `Order is within delivery SLA (${formatMinutesToTime(timeSinceOrder)} total elapsed)`
    });
  } else if (!localTimes.delivered_time_local) {
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