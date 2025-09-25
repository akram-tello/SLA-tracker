import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format minutes into human-readable time string
 * @param totalMinutes - Total minutes to format
 * @returns Formatted string like "2h 30m" or "1d 5h 30m"
 */
export function formatMinutesToTimeString(totalMinutes: number): string {
  if (totalMinutes === 0) return "0m";
  
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  
  const parts: string[] = [];
  
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  
  return parts.join(' ');
}

/**
 * Parse time string into total minutes
 * @param timeString - Formatted string like "2h 30m" or "1d 5h 30m"
 * @returns Total minutes
 */
export function parseTimeStringToMinutes(timeString: string): number {
  if (!timeString || timeString.trim() === '') return 0;
  
  let totalMinutes = 0;
  
  // Match days (e.g., "2d")
  const daysMatch = timeString.match(/(\d+)d/);
  if (daysMatch) {
    totalMinutes += parseInt(daysMatch[1]) * 24 * 60;
  }
  
  // Match hours (e.g., "5h")
  const hoursMatch = timeString.match(/(\d+)h/);
  if (hoursMatch) {
    totalMinutes += parseInt(hoursMatch[1]) * 60;
  }
  
  // Match minutes (e.g., "30m")
  const minutesMatch = timeString.match(/(\d+)m/);
  if (minutesMatch) {
    totalMinutes += parseInt(minutesMatch[1]);
  }
  
  return totalMinutes;
}

/**
 * Calculate time difference between two dates and format as time string
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Formatted time string
 */
export function calculateTATFromDates(startDate: Date, endDate: Date): string {
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  return formatMinutesToTimeString(diffMinutes);
}

/**
 * Compare two time strings for SLA calculations
 * @param actualTAT - Actual TAT string (e.g., "2h 30m")
 * @param thresholdTAT - Threshold TAT string (e.g., "2h")
 * @returns 1 if actual > threshold, 0 if equal, -1 if actual < threshold
 */
export function compareTATStrings(actualTAT: string, thresholdTAT: string): number {
  const actualMinutes = parseTimeStringToMinutes(actualTAT);
  const thresholdMinutes = parseTimeStringToMinutes(thresholdTAT);
  
  if (actualMinutes > thresholdMinutes) return 1;
  if (actualMinutes < thresholdMinutes) return -1;
  return 0;
}

/**
 * Calculate risk threshold from SLA threshold and risk percentage
 * @param slaThreshold - SLA threshold string (e.g., "2d")
 * @param riskPercentage - Risk percentage (e.g., 80)
 * @returns Risk threshold string
 */
export function calculateRiskThreshold(slaThreshold: string, riskPercentage: number): string {
  const slaMinutes = parseTimeStringToMinutes(slaThreshold);
  const riskMinutes = Math.floor(slaMinutes * (riskPercentage / 100));
  return formatMinutesToTimeString(riskMinutes);
}

/**
 * Get the base path for the application
 */
export function getBasePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH || '';
}

/**
 * Create a URL with the base path
 */
export function createUrl(path: string): string {
  const basePath = getBasePath();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${basePath}${cleanPath}`;
}

/**
 * Create an API URL with the base path
 */
export function createApiUrl(path: string): string {
  const basePath = getBasePath();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${basePath}/api${cleanPath}`;
}

/**
 * Country code to timezone mapping
 */
const COUNTRY_TIMEZONE_MAPPING: Record<string, { timezone: string; abbreviation: string; offsetHours: number }> = {
  'MY': { timezone: 'Asia/Kuala_Lumpur', abbreviation: 'MY', offsetHours: 8 },
  'SG': { timezone: 'Asia/Singapore', abbreviation: 'SG', offsetHours: 8 },
  'TH': { timezone: 'Asia/Bangkok', abbreviation: 'TH', offsetHours: 7 },
  'ID': { timezone: 'Asia/Jakarta', abbreviation: 'ID', offsetHours: 7 },
  'PH': { timezone: 'Asia/Manila', abbreviation: 'PH', offsetHours: 8 },
  'HK': { timezone: 'Asia/Hong_Kong', abbreviation: 'HK', offsetHours: 8 },
  'AU': { timezone: 'Australia/Sydney', abbreviation: 'AU', offsetHours: 10 },
  'NZ': { timezone: 'Pacific/Auckland', abbreviation: 'NZ', offsetHours: 12 },
  'VN': { timezone: 'Asia/Ho_Chi_Minh', abbreviation: 'VN', offsetHours: 7 }
};

export function formatToLocalTime(utcTimestamp: Date | string | null | undefined, countryCode?: string): string | null {
  if (!utcTimestamp) return null;
  
  const date = utcTimestamp instanceof Date ? utcTimestamp : new Date(utcTimestamp);
  
  // Default to Malaysia if no country code provided or not found
  const countryKey = countryCode?.toUpperCase();
  const timezoneInfo = COUNTRY_TIMEZONE_MAPPING[countryKey || 'MY'] || COUNTRY_TIMEZONE_MAPPING['MY'];
  
  // Use Intl.DateTimeFormat for accurate timezone conversion
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezoneInfo.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  return `${formatter.format(date)} (${timezoneInfo.abbreviation})`;
}

/**
 * Format UTC time to master DB format
 * This matches the format used in the master database (UTC + 8 hours)
 */
export function formatToMasterDbTime(utcTimestamp: Date | string | null | undefined): string | null {
  if (!utcTimestamp) return null;
  
  const date = utcTimestamp instanceof Date ? utcTimestamp : new Date(utcTimestamp);
  
  // Add 8 hours to UTC to match the master DB format
  const adjustedDate = new Date(date.getTime() + (8 * 60 * 60 * 1000));
  
  // Format as YYYY-MM-DD HH:mm:ss 
  const year = adjustedDate.getUTCFullYear();
  const month = String(adjustedDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(adjustedDate.getUTCDate()).padStart(2, '0');
  const hours = String(adjustedDate.getUTCHours()).padStart(2, '0');
  const minutes = String(adjustedDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(adjustedDate.getUTCSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Format UTC time to local timezone with additional offset for _local fields
 */
export function formatToLocalTimeWithOffset(utcTimestamp: Date | string | null | undefined, countryCode?: string): string | null {
  if (!utcTimestamp) return null;
  
  const date = utcTimestamp instanceof Date ? utcTimestamp : new Date(utcTimestamp);
  
  // Default to Malaysia if no country code provided or not found
  const countryKey = countryCode?.toUpperCase();
  const timezoneInfo = COUNTRY_TIMEZONE_MAPPING[countryKey || 'MY'] || COUNTRY_TIMEZONE_MAPPING['MY'];
  
  // Add master DB offset (8 hours) + country-specific timezone offset
  const totalOffsetHours = 8 + timezoneInfo.offsetHours;
  const adjustedDate = new Date(date.getTime() + (totalOffsetHours * 60 * 60 * 1000));
  
  // Format as YYYY-MM-DD HH:mm:ss 
  const year = adjustedDate.getUTCFullYear();
  const month = String(adjustedDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(adjustedDate.getUTCDate()).padStart(2, '0');
  const hours = String(adjustedDate.getUTCHours()).padStart(2, '0');
  const minutes = String(adjustedDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(adjustedDate.getUTCSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} (${timezoneInfo.abbreviation})`;
}
