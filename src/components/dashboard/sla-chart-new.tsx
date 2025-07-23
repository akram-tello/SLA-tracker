"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { useDashboard } from "@/lib/dashboard-context"

import { DashboardSummary } from "@/lib/types"

// Dynamically import ReactApexChart to avoid SSR issues
const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false })

// Custom Tailwind Card component
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
    {children}
  </div>
);



export function SLAChartNew() {
  const [mounted, setMounted] = useState(false)
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

  const stageData = newDashboardData?.stage_breakdown || []

  // Debug logging to trace the missing order
  useEffect(() => {
    if (newDashboardData) {
      console.log('=== REACT COMPONENT DEBUG ===');
      console.log('Full API Response:', newDashboardData);
      console.log('Stage Breakdown:', stageData);
      
      // Check specifically for Processed stage
      const processedStage = stageData.find(stage => stage.stage === 'Processed');
      if (processedStage) {
        console.log('Processed Stage Data:', processedStage);
        console.log('Processed Total:', processedStage.total);
        console.log('Processed On Time:', processedStage.on_time);
        console.log('Processed At Risk:', processedStage.on_risk);
        console.log('Processed Breached:', processedStage.breached);
        console.log('Sum Check:', processedStage.on_time + processedStage.on_risk + processedStage.breached);
      }
    }
  }, [newDashboardData, stageData])

  // Bar chart configuration (stage breakdown)
  const barSeries = [
    {
      name: 'On Time',
      data: stageData.map(item => item.on_time),
      color: '#10B981' // green-500
    },
    {
      name: 'At Risk',
      data: stageData.map(item => item.on_risk),
      color: '#F59E0B' // yellow-500
    },
    {
      name: 'Breached',
      data: stageData.map(item => item.breached),
      color: '#EF4444' // red-500
    }
  ]

  // Debug the chart series data
  useEffect(() => {
    if (stageData.length > 0) {
      console.log('=== CHART SERIES DEBUG ===');
      console.log('Stage Data:', stageData);
      console.log('On Time Series:', stageData.map(item => item.on_time));
      console.log('At Risk Series:', stageData.map(item => item.on_risk));
      console.log('Breached Series:', stageData.map(item => item.breached));
      console.log('Bar Series:', barSeries);
    }
  }, [stageData])

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
      categories: stageData.map(item => item.stage),
      labels: {
        style: {
          colors: '#6B7280'
        }
      }
    },
    yaxis: {
      title: {
        text: 'Number of Orders',
        style: {
          color: '#6B7280'
        }
      },
      labels: {
        style: {
          colors: '#6B7280'
        }
      }
    },
    legend: {
      position: 'top' as const,
      horizontalAlign: 'right' as const,
      labels: {
        colors: '#6B7280'
      }
    },
    grid: {
      borderColor: '#E5E7EB'
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: {
        formatter: function(val: number, opts: { dataPointIndex: number }) {
          const dataIndex = opts.dataPointIndex
          if (stageData[dataIndex]) {
            const total = stageData[dataIndex].on_time + stageData[dataIndex].on_risk + stageData[dataIndex].breached
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
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              SLA Performance by Stage (New)
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

  const hasStageData = stageData.length > 0

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