"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { useDashboard } from "@/lib/dashboard-context"

import { DashboardSummary } from "@/lib/types"

// Dynamically import ReactApexChart to avoid SSR issues
const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false })

// Custom Tailwind Card component
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-lg hover:shadow-lg border dark:bg-zinc-950/50 backdrop-blur-sm border-gray-200 dark:border-gray-700 p-6 ${className}`}>
    {children}
  </div>
);

export function SLAChart() {
  const [mounted, setMounted] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const { filters } = useDashboard()
  
  // Local state for combined dashboard data
  const [combinedStageData, setCombinedStageData] = useState<Array<{
    stage: string;
    on_time: number;
    on_risk: number;
    breached: number;
  }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    
    // Detect dark mode
    const checkDarkMode = () => {
      if (typeof window !== 'undefined') {
        const isDark = document.documentElement.classList.contains('dark') || 
                      window.matchMedia('(prefers-color-scheme: dark)').matches
        setIsDarkMode(isDark)
      }
    }
    
    checkDarkMode()
    
    // Listen for theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => checkDarkMode()
    mediaQuery.addEventListener('change', handleChange)
    
    // Listen for class changes on html element
    const observer = new MutationObserver(checkDarkMode)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange)
      observer.disconnect()
    }
  }, [])

  // Fetch data from both APIs and combine them
  const fetchCombinedData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams({
        from_date: filters.from_date,
        to_date: filters.to_date,
      })
      
      // Handle multi-select brands (convert array back to individual API calls for now)
      if (filters.brands && filters.brands.length === 1) {
        params.append('brand', filters.brands[0])
      }
      
      if (filters.countries && filters.countries.length === 1) {
        params.append('country', filters.countries[0])
      }

      // Fetch from both APIs in parallel
      const [slaPerformanceResponse, summaryResponse] = await Promise.all([
        fetch(`api/v1/dashboard/sla-performance-chart?${params}`),
        fetch(`api/v1/dashboard/summary?${params}`)
      ])

      if (!slaPerformanceResponse.ok) {
        throw new Error(`Failed to fetch SLA performance data: ${slaPerformanceResponse.statusText}`)
      }

      if (!summaryResponse.ok) {
        throw new Error(`Failed to fetch summary data: ${summaryResponse.statusText}`)
      }
      
      const slaPerformanceData: DashboardSummary = await slaPerformanceResponse.json()
      const summaryData: DashboardSummary = await summaryResponse.json()
      
      // Get "Not Processed" data from summary API
      const notProcessedStage = summaryData.stage_breakdown.find(stage => stage.stage === 'Not Processed')
      
      // Get existing stage data from SLA performance API
      const existingStageData = slaPerformanceData.stage_breakdown || []
      
      // Combine the data: Not Processed first, then existing stages
      const combinedData = []
      
      // Add "Not Processed" if it exists and has data
      if (notProcessedStage && (notProcessedStage.on_time > 0 || notProcessedStage.on_risk > 0 || notProcessedStage.breached > 0)) {
        combinedData.push({
          stage: 'Not Processed',
          on_time: notProcessedStage.on_time,
          on_risk: notProcessedStage.on_risk,
          breached: notProcessedStage.breached
        })
      }
      
      // Add existing stages from SLA performance API
      combinedData.push(...existingStageData.map(stage => ({
        stage: stage.stage,
        on_time: stage.on_time,
        on_risk: stage.on_risk,
        breached: stage.breached
      })))
      
      setCombinedStageData(combinedData)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Error fetching combined dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch data when filters change
  useEffect(() => {
    fetchCombinedData()
  }, [filters])

  // Bar chart configuration (combined stage breakdown)
  const barSeries = [
    {
      name: 'On Time',
      data: combinedStageData.map(item => item.on_time),
      color: '#10B981' // green-500
    },
    {
      name: 'At Risk',
      data: combinedStageData.map(item => item.on_risk),
      color: '#F59E0B' // yellow-500
    },
    {
      name: 'Breached',
      data: combinedStageData.map(item => item.breached),
      color: '#EF4444' // red-500
    }
  ]

  // Theme-aware colors
  const textColor = isDarkMode ? 'oklch(70.7% 0.022 261.325)' : '#6B7280' 
  const gridColor = isDarkMode ? '#374151' : '#E5E7EB'
  const barOptions = {
    chart: {
      type: 'bar' as const,
      height: 400,
      stacked: true,
      toolbar: {
        show: false
      },
      background: 'transparent'
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '55%',
        borderRadius: 4
      }
    },
    xaxis: {
      categories: combinedStageData.map(item => 
        item.stage === 'Not Processed' ? 'Not Synced to OMS' : 
        item.stage === 'Processed' ? 'OMS Synced' : item.stage
      ),
      labels: {
        style: {
          colors: textColor,
          fontSize: '14px'
        }
      }
    },
    yaxis: {
      title: {
        text: 'Number of Orders',
        style: {
          color: textColor
        }
      },
      labels: {
        style: {
          colors: textColor
        }
      }
    },
    legend: {
      position: 'top' as const,
      horizontalAlign: 'right' as const,
      labels: {
        colors: textColor
      }
    },
    grid: {
      borderColor: gridColor
    },
    tooltip: {
      shared: true,
      intersect: false,
      theme: isDarkMode ? 'dark' : 'light',
      y: {
        formatter: function(val: number, opts: { dataPointIndex: number }) {
          const dataIndex = opts.dataPointIndex
          if (combinedStageData[dataIndex]) {
            const total = combinedStageData[dataIndex].on_time + combinedStageData[dataIndex].on_risk + combinedStageData[dataIndex].breached
            const percentage = total > 0 ? ((val / total) * 100).toFixed(1) : '0'
            return `${val.toLocaleString()} (${percentage}%)`
          }
          return val.toLocaleString()
        }
      }
    },
    dataLabels: {
      enabled: false
    },
    responsive: [{
      breakpoint: 768,
      options: {
        chart: {
          height: 300
        },
        legend: {
          position: 'bottom'
        }
      }
    }]
  }

  if (!mounted || loading) {
    return (
      <Card className="border-0 shadow-sm">
        <div className="p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              SLA Performance by Stage
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Timeline-based filtering: Orders with activity in selected period
            </p>
          </div>
          <div className="h-[400px] flex items-center justify-center mt-4">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-4"></div>
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-4">
                  <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-28 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-0 shadow-sm">
        <div className="p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              SLA Performance by Stage
            </h3>
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

  const hasStageData = combinedStageData.length > 0

  if (!hasStageData) {
    return (
      <Card className="border-0 shadow-sm">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                SLA Performance by Stage
              </h3>
            </div>
          </div>
          <div className="text-center py-8 mt-4">
            <div className="text-gray-400 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-gray-600 dark:text-gray-400">No chart data available</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Try adjusting your filters or date range</p>
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
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              SLA Performance by Stage
            </h3>
          </div>
        </div>
        <div className="h-[400px]">
          <ReactApexChart
            options={barOptions}
            series={barSeries}
            type="bar"
            height={400}
          />
        </div>
      </div>
    </Card>
  )
} 