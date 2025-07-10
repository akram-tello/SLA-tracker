"use client"

// Custom Tailwind Card component
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
    {children}
  </div>
);

import { ChartData } from "@/lib/types"
import { useState, useEffect } from "react"
import dynamic from "next/dynamic"

// Dynamically import ReactApexChart to avoid SSR issues
const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false })

interface SLAChartProps {
  data?: ChartData[]
}

export function SLAChart({ data = [] }: SLAChartProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Sample data if none provided
  const sampleData = [
    { stage: "Processing", on_time: 850, on_risk: 120, breached: 30 },
    { stage: "Shipping", on_time: 750, on_risk: 180, breached: 70 },
    { stage: "Delivery", on_time: 680, on_risk: 200, breached: 120 },
  ]

  const chartData = data.length > 0 ? data : sampleData

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
           const total = chartData[dataIndex].on_time + chartData[dataIndex].on_risk + chartData[dataIndex].breached
           const percentage = total > 0 ? ((val / total) * 100).toFixed(1) : '0'
           return `${val.toLocaleString()} (${percentage}%)`
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

  if (!mounted) {
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