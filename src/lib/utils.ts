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
