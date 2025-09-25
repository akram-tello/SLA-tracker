"use client"

import React, { useMemo } from "react"   
import { useDashboard } from "@/lib/dashboard-context"
import LoadingSkeleton from "@/components/ui/loading-skeleton"


function formatTatToFriendly(tat: string): string {
  if (!tat) return "-"
  const dMatch = tat.match(/(\d+)\s*d/i)
  const hMatch = tat.match(/(\d+)\s*h/i)
  const mMatch = tat.match(/(\d+)\s*m/i)
  const days = dMatch ? parseInt(dMatch[1], 10) : 0
  const hours = hMatch ? parseInt(hMatch[1], 10) : 0
  const minutes = mMatch ? parseInt(mMatch[1], 10) : 0

  if (days > 0) return `${days} Day${days === 1 ? '' : 's'}`
  if (hours > 0) return `${hours} Hour${hours === 1 ? '' : 's'}`
  return `${minutes} Min${minutes === 1 ? '' : 's'}`
}

export default function SlaBadges() {
  const { filters, dashboardV2Data, loading: dashboardLoading, error: dashboardError } = useDashboard()

  const hasBrand = !!(filters.brands && filters.brands.length > 0)
  const hasCountry = !!(filters.countries && filters.countries.length > 0)

  // Get TAT configs from centralized v2 data
  const tatConfigs = dashboardV2Data?.tat_configs || []

  const activeTat = useMemo(() => {
    if (!tatConfigs.length) return null
    const brand = filters.brands?.[0]
    const country = filters.countries?.[0]?.toUpperCase()
    if (!brand || !country) return null
    return tatConfigs.find(tc => tc.brand_code === brand && tc.country_code === country) || null
  }, [tatConfigs, filters.brands, filters.countries])

  if (!hasBrand || !hasCountry) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <span className="inline-flex items-center rounded-lg bg-gray-800 dark:bg-[#1B2A36] text-white text-sm font-semibold px-3 py-1">SLA</span>
        <span className="text-gray-600 dark:text-[#B9CAD6] text-sm">Select a brand and country to view SLA thresholds</span>
      </div>
    )
  }

  if (dashboardLoading) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <span className="inline-flex items-center rounded-lg bg-gray-800 dark:bg-[#1B2A36] text-white text-sm font-semibold px-3 py-1">SLA</span>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <LoadingSkeleton className="h-4 w-28 rounded" />
          <LoadingSkeleton className="h-4 w-28 rounded" />
          <LoadingSkeleton className="h-4 w-28 rounded" />
        </div>
      </div>
    )
  }

  if (dashboardError || !activeTat) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <span className="inline-flex items-center rounded-lg bg-gray-800 dark:bg-[#1B2A36] text-white text-sm font-semibold px-3 py-1">SLA</span>
        <span className="text-gray-600 dark:text-[#B9CAD6] text-sm">Unable to load SLA thresholds</span>
      </div>
    )
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-4">
      <span className="inline-flex items-center rounded-lg bg-gray-800 dark:bg-[#1B2A36] text-white text-sm font-semibold px-3 py-1">SLA</span>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-gray-600 dark:text-[#B9CAD6] text-base">
        <span>OMS sync - <span className="font-bold text-gray-900 dark:text-white">{formatTatToFriendly(activeTat.processed_tat)}</span></span>
        <span>Shipped - <span className="font-bold text-gray-900 dark:text-white">{formatTatToFriendly(activeTat.shipped_tat)}</span></span>
        <span>Delivered - <span className="font-bold text-gray-900 dark:text-white">{formatTatToFriendly(activeTat.delivered_tat)}</span></span>
      </div>
    </div>
  )
}

 