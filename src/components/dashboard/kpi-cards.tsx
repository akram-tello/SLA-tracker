"use client"

import { useRouter } from "next/navigation"
import { useDashboard } from "@/lib/dashboard-context"

// Custom Tailwind Card component
const Card = ({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 ${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''} ${className}`} onClick={onClick}>
    {children}
  </div>
);

export function KPICards() {
  const router = useRouter()
  const { dashboardData, loading, error, filters } = useDashboard()

  const handleKPIClick = (slaStatus: string) => {
    const params = new URLSearchParams()
    if (filters.from_date) params.append('from_date', filters.from_date)
    if (filters.to_date) params.append('to_date', filters.to_date)
    if (filters.brand) params.append('brand', filters.brand)
    if (filters.country) params.append('country', filters.country)
    if (slaStatus !== 'all') params.append('sla_status', slaStatus)
    router.push(`/orders?${params.toString()}`)
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-0 shadow-sm">
            <div className="animate-pulse p-6">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            </div>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-0 shadow-sm col-span-full">
          <div className="text-center py-8">
            <div className="text-red-500 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-gray-600 dark:text-gray-400">Failed to load KPI data</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">{error}</p>
          </div>
        </Card>
      </div>
    )
  }

  const data = {
    total_orders: dashboardData?.total_orders || 0,
    sla_breached: dashboardData?.sla_breached || 0,
    on_risk: dashboardData?.on_risk || 0,
    completed: dashboardData?.completed || 0
  }

  const breachedPercentage = data.total_orders > 0 ? ((data.sla_breached / data.total_orders) * 100).toFixed(1) : '0'
  const riskPercentage = data.total_orders > 0 ? ((data.on_risk / data.total_orders) * 100).toFixed(1) : '0'
  const completedPercentage = data.total_orders > 0 ? ((data.completed / data.total_orders) * 100).toFixed(1) : '0'

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Total Orders */}
      <Card 
        className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200" 
        onClick={() => handleKPIClick('all')}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Orders</h3>
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {data.total_orders.toLocaleString()}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">All orders in period</p>
        </div>
      </Card>

      {/* SLA Breached */}
      <Card 
        className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200" 
        onClick={() => handleKPIClick('Breached')}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">SLA Breached</h3>
            <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {data.sla_breached.toLocaleString()}
          </div>
          <div className="flex items-center mt-1">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
              {breachedPercentage}%
            </span>
            <p className="text-xs text-gray-500 dark:text-gray-400 ml-2">of total orders</p>
          </div>
        </div>
      </Card>

      {/* On Risk */}
      <Card 
        className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200" 
        onClick={() => handleKPIClick('At Risk')}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">On Risk</h3>
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
              <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {data.on_risk.toLocaleString()}
          </div>
          <div className="flex items-center mt-1">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
              {riskPercentage}%
            </span>
            <p className="text-xs text-gray-500 dark:text-gray-400 ml-2">of total orders</p>
          </div>
        </div>
      </Card>

      {/* Completed */}
      <Card 
        className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200" 
        onClick={() => handleKPIClick('On Time')}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Completed</h3>
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {data.completed.toLocaleString()}
          </div>
          <div className="flex items-center mt-1">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              {completedPercentage}%
            </span>
            <p className="text-xs text-gray-500 dark:text-gray-400 ml-2">of total orders</p>
          </div>
        </div>
      </Card>
    </div>
  )
} 