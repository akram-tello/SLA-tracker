"use client"

import { Card } from '@/components/ui/card'
import { useDashboard } from '@/lib/dashboard-context'

export function KPICards() {
  const { dashboardData, loading, error } = useDashboard()

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-6 animate-pulse">
            <div className="space-y-3">
              <div className="h-4 w-20 bg-gray-200 rounded"></div>
              <div className="h-8 w-16 bg-gray-200 rounded"></div>
              <div className="h-3 w-24 bg-gray-200 rounded"></div>
            </div>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6 border-red-200">
          <div className="text-red-600 text-sm">Error loading KPIs: {error}</div>
        </Card>
      </div>
    )
  }

  if (!dashboardData?.kpis) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6">
          <div className="text-gray-500 text-sm">No KPI data available</div>
        </Card>
      </div>
    )
  }

  const data = dashboardData.kpis
  const formatTime = (seconds: number) => {
    if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}m`
    } else if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      return `${hours}h ${minutes}m`
    } else {
      const days = Math.floor(seconds / 86400)
      const hours = Math.floor((seconds % 86400) / 3600)
      return `${days}d ${hours}h`
    }
  }

  const formatPendingTime = (hours: number) => {
    if (hours < 24) {
      return `${hours.toFixed(1)}h`
    } else {
      const days = Math.floor(hours / 24)
      const remainingHours = Math.floor(hours % 24)
      return `${days}d ${remainingHours}h`
    }
  }

  // Calculate normal pending orders (pending but not at risk or breached)
  // Handle cases where pending data might not be available yet
  const pendingOrders = data.pending_orders || 0
  const atRiskPendingOrders = data.at_risk_pending_orders || 0
  const breachedPendingOrders = data.breached_pending_orders || 0
  const avgPendingHours = data.avg_pending_hours || 0
  const pendingRate = data.pending_rate || 0
  
  const normalPendingOrders = pendingOrders - atRiskPendingOrders - breachedPendingOrders

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="p-6">
        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
          <p className="text-sm font-medium">Total Orders</p>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-4 w-4 text-muted-foreground"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="m19 8 2 2-2 2" />
            <path d="m17 12 2-2-2-2" />
          </svg>
        </div>
        <div className="text-2xl font-bold">{data.total_orders.toLocaleString()}</div>
        <p className="text-xs text-muted-foreground">
          {data.completion_rate}% completion rate
        </p>
      </Card>

      <Card className="p-6">
        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
          <p className="text-sm font-medium">On Time</p>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-4 w-4 text-green-600"
          >
            <polyline points="20,6 9,17 4,12" />
          </svg>
        </div>
        <div className="text-2xl font-bold text-green-600">{data.on_time_orders.toLocaleString()}</div>
        <p className="text-xs text-muted-foreground">
          {((data.on_time_orders / data.total_orders) * 100).toFixed(1)}% of total
        </p>
      </Card>

      <Card className="p-6">
        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
          <p className="text-sm font-medium">At Risk</p>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-4 w-4 text-orange-600"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4" />
            <path d="m12 17 .01 0" />
          </svg>
        </div>
        <div className="text-2xl font-bold text-orange-600">{data.on_risk_orders.toLocaleString()}</div>
        <p className="text-xs text-muted-foreground">
          {((data.on_risk_orders / data.total_orders) * 100).toFixed(1)}% of total
        </p>
      </Card>

      <Card className="p-6">
        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
          <p className="text-sm font-medium">Breached</p>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-4 w-4 text-red-600"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" x2="9" y1="9" y2="15" />
            <line x1="9" x2="15" y1="9" y2="15" />
          </svg>
        </div>
        <div className="text-2xl font-bold text-red-600">{data.breached_orders.toLocaleString()}</div>
        <p className="text-xs text-muted-foreground">
          Avg delay: {formatTime(data.avg_delay_seconds)}
        </p>
      </Card>

      {/* NEW: Pending Orders Section */}
      <Card className="p-6 md:col-span-2 lg:col-span-4">
        <div className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <p className="text-lg font-medium">Pending Orders Analysis</p>
            <p className="text-xs text-muted-foreground">Orders stuck in current stage beyond threshold</p>
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-5 w-5 text-yellow-600"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12,6 12,12 16,14" />
          </svg>
        </div>
        
        <div className="grid gap-4 md:grid-cols-4">
          {/* Total Pending */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-yellow-600">Total Pending</p>
            <div className="text-xl font-bold">{pendingOrders.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {pendingRate.toFixed(1)}% of all orders
            </p>
          </div>

          {/* Normal Pending (On Time but Stuck) */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-blue-600">Normal + Pending</p>
            <div className="text-xl font-bold text-blue-600">{normalPendingOrders.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Fast processing, stuck
            </p>
          </div>

          {/* At Risk + Pending */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-orange-600">At Risk + Pending</p>
            <div className="text-xl font-bold text-orange-600">{atRiskPendingOrders.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Slow and stuck - Priority
            </p>
          </div>

          {/* Breached + Pending */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-red-600">Breached + Pending</p>
            <div className="text-xl font-bold text-red-600">{breachedPendingOrders.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Late and stuck - Critical
            </p>
          </div>
        </div>

        {pendingOrders > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Average pending time: <span className="font-medium">{formatPendingTime(avgPendingHours)}</span>
            </p>
          </div>
        )}
      </Card>
    </div>
  )
} 