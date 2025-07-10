"use client"

// Custom Tailwind Card component
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
    {children}
  </div>
);

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { useDashboard } from "@/lib/dashboard-context"

// Dynamically import ReactApexChart to avoid SSR issues
const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false })

export function SLAChart() {
  const [mounted, setMounted] = useState(false)
  const { dashboardData, loading, error } = useDashboard()

  useEffect(() => {
    setMounted(true)
  }, [])

  const chartData = dashboardData?.stage_breakdown || []

  const series = [
    {
      name: 'On Time',
      data: chartData.map(item => item.on_time),
      color: '#10B981' // green-500
    },
    {
      name: 'On Risk',
      data: chartData.map(item => item.on_risk),
      color: '#F59E0B' // yellow-500
    },
    {
      name: 'Breached',
      data: chartData.map(item => item.breached),
      color: '#EF4444' // red-500
    }
  ]

  const options = {
    chart: {
      type: 'bar' as const,
      height: 350,
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
      categories: chartData.map(item => item.stage),
      labels: {
        style: {
          colors: '#6B7280' // gray-500
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
      borderColor: '#E5E7EB' // gray-200
    },
    tooltip: {
      shared: true,
      intersect: false,
             y: {
         formatter: function(val: number, opts: { dataPointIndex: number }) {
           const dataIndex = opts.dataPointIndex
           if (chartData[dataIndex]) {
             const total = chartData[dataIndex].on_time + chartData[dataIndex].on_risk + chartData[dataIndex].breached
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            SLA Performance by Stage
          </h3>
          <div className="h-[350px] flex items-center justify-center">
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
            SLA Performance by Stage
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

  if (chartData.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            SLA Performance by Stage
          </h3>
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
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          SLA Performance by Stage
        </h3>
        <div className="h-[350px]">
          <ReactApexChart
            options={options}
            series={series}
            type="bar"
            height={350}
          />
        </div>
      </div>
    </Card>
  )
} 