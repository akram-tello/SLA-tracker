"use client"

import { useState, useEffect, useMemo } from "react"
import dynamic from "next/dynamic"
import { useDashboard } from "@/lib/dashboard-context"
import { PieChart, BarChart3 } from "lucide-react"
import { DashboardSummary } from "@/lib/types"

// Dynamically import ReactApexChart to avoid SSR issues
const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false })

// Custom Tailwind Card component
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
    {children}
  </div>
);

type ChartType = 'donut' | 'radial'

export function StagePerformanceChartNew() {
  const [mounted, setMounted] = useState(false)
  const [chartType, setChartType] = useState<ChartType>('donut')
  const [chartKey, setChartKey] = useState(0)
  const { filters } = useDashboard()
  
  // Local state for new dashboard data
  const [newDashboardData, setNewDashboardData] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch data from new endpoint
  const fetchNewDashboardData = async () => {
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

      const response = await fetch(`/api/v1/dashboard/new-summary?${params}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch new dashboard data: ${response.statusText}`)
      }
      
      const data: DashboardSummary = await response.json()
      setNewDashboardData(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Error fetching new dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch data when filters change
  useEffect(() => {
    fetchNewDashboardData()
  }, [filters])

  const stageKpis = newDashboardData?.stage_kpis || []

  // Toggle between chart types
  const toggleChartType = () => {
    setChartType(prev => prev === 'donut' ? 'radial' : 'donut')
    setChartKey(prev => prev + 1)
  }

  // Helper function to get stage color based on stage breakdown colors
  const getStageColor = (stage: string) => {
    switch (stage.toLowerCase()) {
      case 'not processed': return '#EF4444' // red-500
      case 'processing': return '#6B7280' // gray-500
      case 'processed': return '#3B82F6' // blue-500
      case 'shipped': return '#F59E0B' // yellow-500/amber-500
      case 'delivered': return '#10B981' // green-500
      default: return '#6B7280' // gray-500
    }
  }

  // Calculate total completion rates for donut chart
  const completionData = useMemo(() => {
    const totalOrders = stageKpis.reduce((sum, stage) => sum + stage.total_orders, 0)
    const totalOnTime = stageKpis.reduce((sum, stage) => sum + stage.on_time_orders, 0)
    const totalOnRisk = stageKpis.reduce((sum, stage) => sum + stage.on_risk_orders, 0)
    const totalBreached = stageKpis.reduce((sum, stage) => sum + stage.breached_orders, 0)

    return {
      totalOrders,
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
        colors: '#374151' // gray-700 for light mode, will be overridden by dark mode CSS
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
              label: 'Total Orders',
              color: '#374151', // gray-700 for light mode
              formatter: () => completionData.totalOrders.toLocaleString()
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
        formatter: function(val: number) {
          return (typeof val === 'number' && !isNaN(val)) ? val.toFixed(1) + '%' : '0.0%'
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

  // Radial bar chart configuration
  const radialSeries = stageKpis.map(stage => {
    const rate = stage.completion_rate
    return (typeof rate === 'number' && !isNaN(rate)) ? rate : 0
  })
  const radialLabels = stageKpis.map(stage => stage.stage)
  const radialColors = stageKpis.map(stage => getStageColor(stage.stage))

  const radialOptions = {
    chart: {
      type: 'radialBar' as const,
      height: 400,
      animations: {
        enabled: true
      }
    },
    plotOptions: {
      radialBar: {
        dataLabels: {
          name: {
            fontSize: '12px',
            color: '#374151' // gray-700 for light mode
          },
          value: {
            show: true,
          },
          tooltip: {
            formatter: function (val: number, opts: { series: number[]; seriesIndex: number }) {
              const actualValue = opts.series[opts.seriesIndex];
              return (typeof actualValue === 'number' && !isNaN(actualValue)) 
                ? actualValue.toFixed(1) + '%' 
                : '0.0%';
            }
          }
        },
        hollow: {
          size: '30%'
        }
      }
    },
    labels: radialLabels,
    colors: radialColors,
    legend: {
      show: true,
      position: 'bottom' as const,
      labels: {
        colors: '#374151' 
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
              Stage Performance Overview (New)
            </h3>
            <div className="flex gap-2">
              <button className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                <PieChart className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </button>
              <button className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                <BarChart3 className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              </button>
            </div>
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
            Stage Performance Overview (New)
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
              Stage Performance Overview (New)
            </h3>
            <div className="flex gap-2">
              <button
                onClick={toggleChartType}
                className={`p-2 rounded-lg transition-colors ${
                  chartType === 'donut' 
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}
              >
                <PieChart className="h-4 w-4" />
              </button>
              <button
                onClick={toggleChartType}
                className={`p-2 rounded-lg transition-colors ${
                  chartType === 'radial' 
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <BarChart3 className="h-4 w-4" />
              </button>
            </div>
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
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {chartType === 'donut' ? 'Overall Performance Distribution (New)' : 'Stage Completion Rates (New)'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Timeline-based filtering: Orders with activity in selected period
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={toggleChartType}
              className={`p-2 rounded-lg transition-colors ${
                chartType === 'donut' 
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              title="Donut Chart"
            >
              <PieChart className="h-4 w-4" />
            </button>
            <button
              onClick={toggleChartType}
              className={`p-2 rounded-lg transition-colors ${
                chartType === 'radial' 
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              title="Radial Chart"
            >
              <BarChart3 className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="h-[400px]">
          {chartType === 'donut' ? (
            <ReactApexChart
              key={`donut-${chartKey}`}
              options={donutOptions}
              series={donutSeries}
              type="donut"
              height={400}
            />
          ) : (
            <ReactApexChart
              key={`radial-${chartKey}`}
              options={radialOptions}
              series={radialSeries}
              type="radialBar"
              height={400}
            />
          )}
        </div>
      </div>
    </Card>
  )
} 