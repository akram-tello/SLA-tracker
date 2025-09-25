"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import dynamic from "next/dynamic"
import { useDashboard } from "@/lib/dashboard-context"
import LoadingSkeleton from "@/components/ui/loading-skeleton"

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false })

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-lg dark:bg-zinc-950/50 backdrop-blur-sm border-gray-200 dark:border-gray-700 ${className}`}>
    {children}
  </div>
)

export function SLAChart() {
  const [mounted, setMounted] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const { filters, dashboardV2Data } = useDashboard()
  const [slaPerformanceData, setSlaPerformanceData] = useState<{ stage_breakdown?: Array<{ stage: string; on_time: number; on_risk: number; breached: number }> } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Refs to track API call state and prevent duplicates
  const isCallInProgressRef = useRef(false)
  const lastCallFiltersRef = useRef<string>('')
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  useEffect(() => {
    setMounted(true)
    const checkDarkMode = () => {
      if (typeof window !== 'undefined') {
        const isDark = document.documentElement.classList.contains('dark') || window.matchMedia('(prefers-color-scheme: dark)').matches
        setIsDarkMode(isDark)
      }
    }
    checkDarkMode()
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => checkDarkMode()
    mediaQuery.addEventListener('change', handleChange)
    const observer = new MutationObserver(checkDarkMode)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => {
      mediaQuery.removeEventListener('change', handleChange)
      observer.disconnect()
    }
  }, [])

  const fetchSlaPerformanceData = useCallback(async (currentFilters?: { from_date: string; to_date: string; brands?: string[]; countries?: string[] }) => {
    const filtersToUse = currentFilters || filtersRef.current
    
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ from_date: filtersToUse.from_date, to_date: filtersToUse.to_date })
      if (filtersToUse.brands && filtersToUse.brands.length === 1) params.append('brand', filtersToUse.brands[0])
      if (filtersToUse.countries && filtersToUse.countries.length === 1) params.append('country', filtersToUse.countries[0])

      const base = process.env.NEXT_PUBLIC_BASE_PATH || ''
      const slaPerformanceResponse = await fetch(`${base}/api/v1/dashboard/sla-performance-chart/?${params}`)

      if (!slaPerformanceResponse.ok) throw new Error(`Failed to fetch SLA performance data: ${slaPerformanceResponse.statusText}`)

      const data = await slaPerformanceResponse.json()
      setSlaPerformanceData(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Error fetching SLA performance data:', err)
    } finally {
      setLoading(false)
    }
  }, []) 

  useEffect(() => { 
    if (!dashboardV2Data) return

    // Create a unique key for current filters to detect actual changes
    const filtersKey = JSON.stringify({
      from_date: filters.from_date,
      to_date: filters.to_date,
      brands: filters.brands,
      countries: filters.countries
    });

    // Skip if this exact filter combination was already called
    if (lastCallFiltersRef.current === filtersKey || isCallInProgressRef.current) {
      console.log('⏭️ SLA Chart: Skipping duplicate API call for same filters');
      return;
    }

    console.log('🔄 SLA Chart: Making API call with filters:', filters);
    
    const timeoutId = setTimeout(() => {
      isCallInProgressRef.current = true;
      lastCallFiltersRef.current = filtersKey;
      
      fetchSlaPerformanceData(filters).finally(() => {
        isCallInProgressRef.current = false;
      });
    }, 200); // 200ms debounce

    return () => clearTimeout(timeoutId);
  }, [filters, dashboardV2Data, fetchSlaPerformanceData])

  // Combine V2 data with SLA performance data
  const combinedStageData = (() => {
    if (!dashboardV2Data || !slaPerformanceData) return []

    const notProcessedStage = dashboardV2Data.stage_breakdown.find(stage => stage.stage === 'Not Processed')
    const existingStageData = slaPerformanceData.stage_breakdown || []
    const combinedData: Array<{ stage: string; on_time: number; on_risk: number; breached: number }> = []

    if (notProcessedStage) {
      combinedData.push({ 
        stage: 'Not Processed', 
        on_time: notProcessedStage.on_time, 
        on_risk: notProcessedStage.on_risk, 
        breached: notProcessedStage.breached 
      })
    } else {
      combinedData.push({ stage: 'Not Processed', on_time: 0, on_risk: 0, breached: 0 })
    }

    combinedData.push(...existingStageData.map((stage: { stage: string; on_time: number; on_risk: number; breached: number }) => ({ 
      stage: stage.stage, 
      on_time: stage.on_time, 
      on_risk: stage.on_risk, 
      breached: stage.breached 
    })))

    const expectedStages = ['Not Processed', 'Processed', 'Shipped', 'Delivered']
    const existingStages = combinedData.map(item => item.stage)
    expectedStages.forEach(expectedStage => {
      if (!existingStages.includes(expectedStage)) {
        combinedData.push({ stage: expectedStage, on_time: 0, on_risk: 0, breached: 0 })
      }
    })

    combinedData.sort((a, b) => ['Not Processed', 'Processed', 'Shipped', 'Delivered'].indexOf(a.stage) - ['Not Processed', 'Processed', 'Shipped', 'Delivered'].indexOf(b.stage))
    return combinedData
  })()

  const barSeries = [
    { name: 'On Time', data: combinedStageData.map(item => item.on_time), color: '#10B981' },
    { name: 'At Risk', data: combinedStageData.map(item => item.on_risk), color: '#F59E0B' },
    { name: 'Breached', data: combinedStageData.map(item => item.breached), color: '#EF4444' }
  ]

  const textColor = isDarkMode ? 'oklch(70.7% 0.022 261.325)' : '#6B7280'
  const gridColor = isDarkMode ? '#374151' : '#E5E7EB'
  const barOptions = {
    chart: { type: 'bar' as const, height: 400, stacked: true, toolbar: { show: false }, background: 'transparent' },
    plotOptions: { bar: { horizontal: false, columnWidth: '55%', borderRadius: 4 } },
    xaxis: {
      categories: combinedStageData.map(item => {
        const stageName = item.stage === 'Not Processed' ? 'Not on OMS' : item.stage === 'Processed' ? 'OMS Synced' : item.stage
        const total = item.on_time + item.on_risk + item.breached
        return [`${stageName}`, `${total.toLocaleString()}`]
      }),
      labels: {
        style: { colors: textColor, fontSize: '12px' },
        formatter: function(value: string, _timestamp?: number, opts?: { dataPointIndex?: number }) {
          if (opts && typeof opts.dataPointIndex === 'number') {
            const dataIndex = opts.dataPointIndex
            if (combinedStageData[dataIndex]) {
              const total = combinedStageData[dataIndex].on_time + combinedStageData[dataIndex].on_risk + combinedStageData[dataIndex].breached
              return [`${value}`, `${total.toLocaleString()}`]
            }
          }
          return value
        }
      }
    },
    yaxis: { title: { text: 'Number of Orders', style: { color: textColor } }, labels: { style: { colors: textColor } } },
    legend: { position: 'top' as const, horizontalAlign: 'right' as const, labels: { colors: textColor } },
    grid: { borderColor: gridColor },
    tooltip: {
      shared: true, intersect: false, theme: isDarkMode ? 'dark' : 'light',
      y: { formatter: function(val: number, opts: { dataPointIndex: number }) {
        const dataIndex = opts.dataPointIndex
        if (combinedStageData[dataIndex]) {
          const total = combinedStageData[dataIndex].on_time + combinedStageData[dataIndex].on_risk + combinedStageData[dataIndex].breached
          const percentage = total > 0 ? ((val / total) * 100).toFixed(1) : '0'
          return `${val.toLocaleString()} (${percentage}%)`
        }
        return val.toLocaleString()
      } }
    },
    dataLabels: { enabled: false },
    responsive: [{ breakpoint: 768, options: { chart: { height: 300 }, legend: { position: 'bottom' } } }]
  }

  if (!mounted || loading) {
    return (
      <Card className="border-0 shadow-sm">
        <div className="p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">SLA Performance by Stage</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Timeline-based filtering: Orders with activity in selected period</p>
          </div>
          <LoadingSkeleton className="w-full h-[360px] rounded-xl" />
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-0 shadow-sm">
        <div className="p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">SLA Performance by Stage</h3>
          </div>
          <div className="text-center py-8 mt-4">
            <div className="text-red-500 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-gray-600 dark:text-gray-400">Failed to load chart data</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">{error}</p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-sm">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">SLA Performance by Stage</h3>
          </div>
        </div>
        <div className="h-[240px]">
          <ReactApexChart options={barOptions} series={barSeries} type="bar" height={250} />
        </div>
      </div>
    </Card>
  )
}