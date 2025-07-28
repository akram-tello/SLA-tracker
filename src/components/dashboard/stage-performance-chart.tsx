"use client"

import { useState, useEffect, useMemo } from "react"
import dynamic from "next/dynamic"
import { useDashboard } from "@/lib/dashboard-context"

// Dynamically import ReactApexChart to avoid SSR issues
const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false })

// Custom Tailwind Card component
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-lg hover:shadow-lg border dark:bg-zinc-950/50 backdrop-blur-sm border-gray-200 dark:border-gray-700 p-6 ${className}`}>
    {children}
  </div>
);

export function StagePerformanceChart() {
  const [mounted, setMounted] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const { dashboardData, loading, error } = useDashboard()

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

  const stageKpis = dashboardData?.stage_kpis || []

  // Calculate total completion rates for donut chart
  const completionData = useMemo(() => {
    const totalOrders = stageKpis.reduce((sum, stage) => sum + stage.total_orders, 0)
    const totalOnTime = stageKpis.reduce((sum, stage) => sum + stage.on_time_orders, 0)
    const totalOnRisk = stageKpis.reduce((sum, stage) => sum + stage.on_risk_orders, 0)
    const totalBreached = stageKpis.reduce((sum, stage) => sum + stage.breached_orders, 0)

    return {
      totalOrders,
      totalOnTime,
      totalOnRisk, 
      totalBreached,
      onTimePercentage: totalOrders > 0 ? ((totalOnTime / totalOrders) * 100) : 0,
      onRiskPercentage: totalOrders > 0 ? ((totalOnRisk / totalOrders) * 100) : 0,
      breachedPercentage: totalOrders > 0 ? ((totalBreached / totalOrders) * 100) : 0
    }
  }, [stageKpis])

  // Donut chart configuration
  const donutSeries = [
    (typeof completionData.onTimePercentage === 'number' && !isNaN(completionData.onTimePercentage)) ? completionData.onTimePercentage : 0,
    (typeof completionData.onRiskPercentage === 'number' && !isNaN(completionData.onRiskPercentage)) ? completionData.onRiskPercentage : 0,
    (typeof completionData.breachedPercentage === 'number' && !isNaN(completionData.breachedPercentage)) ? completionData.breachedPercentage : 0
  ]

  const donutOptions = {
    chart: {
      type: 'donut' as const,
      height: 400,
      animations: {
        enabled: true
      }
    },
    labels: ['On Time', 'At Risk', 'Breached'],
    colors: ['#10B981', '#F59E0B', '#EF4444'], // green-500, yellow-500, red-500
    legend: {
      position: 'bottom' as const,
      labels: {
        colors: '#374151' 
      }
    },
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          labels: {
            show: true,
            total: {
              show: true,
              showAlways: true,
              label: 'Total Orders',
              color: 'oklch(70.7% 0.022 261.325)',
              fontSize: '14px',
              fontWeight: 600,
              formatter: () => {
                return `${completionData.totalOrders.toLocaleString()}`
              }
            },
            value: {
              show: true,
              fontSize: '20px',
              fontWeight: 600,
              color: 'oklch(70.7% 0.022 261.325)',
              offsetY: 0
            }
          }
        }
      }
    },
    dataLabels: {
      enabled: true,
      formatter: function(val: number) {
        return (typeof val === 'number' && !isNaN(val)) ? val.toFixed(1) + '%' : '0.0%'
      },
      style: {
        colors: ['#ffffff'] 
      }
    },
    tooltip: {
      y: {
        formatter: function(val: number, opts: { seriesIndex: number }) {
          if (typeof val !== 'number' || isNaN(val)) return '0 orders (0.0%)'
          
          // Get the actual order count based on series index
          const orderCounts = [completionData.totalOnTime, completionData.totalOnRisk, completionData.totalBreached]
          const orderCount = orderCounts[opts.seriesIndex] || 0
          
          return `${orderCount.toLocaleString()} orders (${val.toFixed(1)}%)`
        }
      }
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Overall Performance Distribution
            </h3>
          </div>
          <div className="h-[400px] flex items-center justify-center">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-4"></div>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4">
                  <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Overall Performance Distribution
          </h3>
          <div className="text-center py-8">
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

  const hasData = stageKpis.length > 0

  if (!hasData) {
    return (
      <Card className="border-0 shadow-sm">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Overall Performance Distribution
            </h3>
          </div>
          <div className="text-center py-8">
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Overall Performance Distribution
          </h3>
        </div>
        <div className="h-[400px]">
          <ReactApexChart
            options={donutOptions}
            series={donutSeries}
            type="donut"
            height={400}
          />
        </div>
      </div>
    </Card>
  )
} 