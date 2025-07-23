"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { useDashboard } from "@/lib/dashboard-context"
import { BarChart3, TrendingUp } from "lucide-react"

// Dynamically import ReactApexChart to avoid SSR issues
const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false })

// Custom Tailwind Card component
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
    {children}
  </div>
);

type ChartType = 'bar' | 'line'

export function SLAChart() {
  const [mounted, setMounted] = useState(false)
  const [chartType, setChartType] = useState<ChartType>('bar')
  const [chartKey, setChartKey] = useState(0)
  const { dashboardData, loading, error } = useDashboard()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Toggle between chart types
  const toggleChartType = () => {
    setChartType(prev => prev === 'bar' ? 'line' : 'bar')
    setChartKey(prev => prev + 1)
  }

  const stageData = dashboardData?.stage_breakdown || []
  const chartData = dashboardData?.chart_data || []

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

  // Helper function to aggregate data for large datasets to prevent performance issues
  const aggregateChartData = (data: typeof chartData) => {
    if (data.length <= 30) {
      // For datasets with 30 or fewer points, return as-is
      return data;
    }
    
    // For larger datasets, group by week to reduce data points
    const weeklyData = new Map<string, {
      date: string;
      total_orders: number;
      on_time_orders: number;
      on_risk_orders: number;
      breached_orders: number;
    }>();
    
    data.forEach(item => {
      const date = new Date(item.date);
      // Get the Monday of the week for grouping
      const monday = new Date(date);
      monday.setDate(date.getDate() - date.getDay() + 1);
      const weekKey = monday.toISOString().split('T')[0];
      
      if (!weeklyData.has(weekKey)) {
        weeklyData.set(weekKey, {
          date: weekKey,
          total_orders: 0,
          on_time_orders: 0,
          on_risk_orders: 0,
          breached_orders: 0
        });
      }
      
      const weekData = weeklyData.get(weekKey)!;
      weekData.total_orders += item.total_orders;
      weekData.on_time_orders += item.on_time_orders;
      weekData.on_risk_orders += item.on_risk_orders || 0;
      weekData.breached_orders += item.breached_orders;
    });
    
    return Array.from(weeklyData.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  };

  const aggregatedData = aggregateChartData(chartData);

  // Line chart configuration (time-based data) - More performant and visual
  const lineSeries = [
    {
      name: 'On Time',
      data: aggregatedData.map(item => ({
        x: item.date,
        y: item.on_time_orders || 0
      })),
      color: '#10B981' // green-500
    },
    {
      name: 'At Risk',
      data: aggregatedData.map(item => ({
        x: item.date,
        y: item.on_risk_orders || 0
      })),
      color: '#F59E0B' // yellow-500
    },
    {
      name: 'Breached',
      data: aggregatedData.map(item => ({
        x: item.date,
        y: item.breached_orders || 0
      })),
      color: '#EF4444' // red-500
    }
  ]

  const lineOptions = {
    chart: {
      type: 'line' as const,
      height: 400,
      toolbar: {
        show: false
      },
      background: 'transparent',
      zoom: {
        enabled: false
      },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
        animateGradually: {
          enabled: true,
          delay: 150
        },
        dynamicAnimation: {
          enabled: true,
          speed: 350
        }
      },
      dropShadow: {
        enabled: true,
        color: '#000',
        top: 1,
        left: 1,
        blur: 3,
        opacity: 0.1
      }
    },
    stroke: {
      curve: 'smooth' as const,
      width: 3,
      lineCap: 'round' as const
    },
    markers: {
      size: 6,
      strokeWidth: 2,
      strokeColors: '#fff',
      hover: {
        size: 8,
        sizeOffset: 3
      }
    },
    xaxis: {
      type: 'datetime' as const,
      labels: {
        style: {
          colors: '#6B7280',
          fontSize: '12px'
        },
        format: aggregatedData.length <= 30 ? 'MMM dd' : 'MMM dd'
      },
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      }
    },
    yaxis: {
      title: {
        text: 'Number of Orders',
        style: {
          color: '#6B7280',
          fontSize: '14px',
          fontWeight: 600
        }
      },
      labels: {
        style: {
          colors: '#6B7280',
          fontSize: '12px'
        },
        formatter: function(val: number) {
          return val.toLocaleString()
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
      borderColor: '#E5E7EB',
      strokeDashArray: 3,
      xaxis: {
        lines: {
          show: false
        }
      },
      yaxis: {
        lines: {
          show: true
        }
      },
      padding: {
        top: 0,
        right: 30,
        bottom: 0,
        left: 20
      }
    },
    tooltip: {
      shared: true,
      intersect: false,
      x: {
        format: aggregatedData.length <= 30 ? 'MMM dd, yyyy' : 'MMM dd, yyyy (Week of)'
      },
      y: {
        formatter: function(val: number) {
          return val.toLocaleString() + ' orders'
        }
      },
      marker: {
        show: true
      },
      style: {
        fontSize: '12px'
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
        },
        markers: {
          size: 4
        },
        stroke: {
          width: 2
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
              SLA Performance by Stage
            </h3>
            <div className="flex gap-2">
              <button className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                <BarChart3 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </button>
              <button className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                <TrendingUp className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              </button>
            </div>
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

  const hasStageData = stageData.length > 0
  const hasTimeData = chartData.length > 0
  const hasData = chartType === 'bar' ? hasStageData : hasTimeData

  if (!hasData) {
    return (
      <Card className="border-0 shadow-sm">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {chartType === 'bar' ? 'SLA Performance by Stage' : 'SLA Performance Trends'}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={toggleChartType}
                className={`p-2 rounded-lg transition-colors ${
                  chartType === 'bar' 
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title="Bar Chart"
              >
                <BarChart3 className="h-4 w-4" />
              </button>
              <button
                onClick={toggleChartType}
                className={`p-2 rounded-lg transition-colors ${
                  chartType === 'line' 
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title="Line Chart"
              >
                <TrendingUp className="h-4 w-4" />
              </button>
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {chartType === 'bar' ? 'SLA Performance by Stage' : 'SLA Performance Trends'}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={toggleChartType}
              className={`p-2 rounded-lg transition-colors ${
                chartType === 'bar' 
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              title="Bar Chart"
            >
              <BarChart3 className="h-4 w-4" />
            </button>
            <button
              onClick={toggleChartType}
              className={`p-2 rounded-lg transition-colors ${
                chartType === 'line' 
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              title="Line Chart"
            >
              <TrendingUp className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="h-[400px]">
          {chartType === 'bar' ? (
            <ReactApexChart
              key={`bar-${chartKey}`}
              options={barOptions}
              series={barSeries}
              type="bar"
              height={400}
            />
          ) : (
            <ReactApexChart
              key={`line-${chartKey}`}
              options={lineOptions}
              series={lineSeries}
              type="line"
              height={400}
            />
          )}
        </div>
      </div>
    </Card>
  )
} 