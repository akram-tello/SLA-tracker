"use client"

import { Card } from '@/components/ui/card'
import { useDashboard } from '@/lib/dashboard-context'
import Link from 'next/link'
import { 
  TrendingUp, 
  Clock, 
  AlertTriangle, 
  XCircle,
  Package,
  PackageX,
  Truck,
  AlertCircle
} from 'lucide-react'

interface KPICardProps {
  title: string
  value: number
  percentage?: number
  icon: React.ReactNode
  color: string
  href: string
  description: string
}

function KPICard({ title, value, percentage, icon, color, href, description }: KPICardProps) {
  return (
    <Link href={href} className="group block">
      <Card className="p-6 hover:shadow-lg transition-all duration-200 cursor-pointer group-hover:border-blue-300 dark:group-hover:border-blue-600">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-2 rounded-lg ${color}`}>
                {icon}
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {title}
              </p>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {value.toLocaleString()}
            </div>
            {percentage !== undefined && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {percentage.toFixed(1)}% of total
              </p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {description}
            </p>
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <svg
              className="w-5 h-5 text-gray-400 group-hover:text-blue-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </Card>
    </Link>
  )
}

export function KPICards({ section = "all" }: { section?: "overview" | "action-required" | "all" }) {
  const { dashboardData, loading, error, filters } = useDashboard()

  if (loading) {
    const cardCount = section === "overview" ? 5 : section === "action-required" ? 9 : 14;
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {[...Array(cardCount)].map((_, i) => (
          <Card key={i} className="p-6 animate-pulse">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
              <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6 border-red-200 dark:border-red-800">
          <div className="text-red-600 dark:text-red-400 text-sm">Error loading KPIs: {error}</div>
        </Card>
      </div>
    )
  }

  if (!dashboardData?.kpis) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6">
          <div className="text-gray-500 dark:text-gray-400 text-sm">No KPI data available</div>
        </Card>
      </div>
    )
  }

  const data = dashboardData.kpis

  // Helper function to build URL with current filters
  const buildFilteredUrl = (additionalParams: Record<string, string> = {}) => {
    const params = new URLSearchParams()
    
    // Add current dashboard filters
    if (filters.brands && filters.brands.length === 1) {
      params.append('brand', filters.brands[0])
    }
    if (filters.countries && filters.countries.length === 1) {
      params.append('country', filters.countries[0])
    }
    if (filters.from_date) {
      params.append('from_date', filters.from_date)
    }
    if (filters.to_date) {
      params.append('to_date', filters.to_date)
    }
    
    // Add additional parameters
    Object.entries(additionalParams).forEach(([key, value]) => {
      params.append(key, value)
    })
    
    return `/orders?${params.toString()}`
  }

  const kpiCards = [
    {
      title: "Total Orders",
      value: data.total_orders,
      percentage: 100,
      icon: <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
      color: "bg-blue-100 dark:bg-blue-900/30",
      href: buildFilteredUrl(),
      description: "All orders in selected period"
    },
    {
      title: "On Time Orders",
      value: data.on_time_orders,
      percentage: data.total_orders > 0 ? (data.on_time_orders / data.total_orders) * 100 : 0,
      icon: <Clock className="h-4 w-4 text-green-600 dark:text-green-400" />,
      color: "bg-green-100 dark:bg-green-900/30",
      href: buildFilteredUrl({ sla_status: 'On Time' }),
      description: "Orders meeting SLA targets"
    },
    {
      title: "At Risk Orders",
      value: data.on_risk_orders,
      percentage: data.total_orders > 0 ? (data.on_risk_orders / data.total_orders) * 100 : 0,
      icon: <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />,
      color: "bg-orange-100 dark:bg-orange-900/30",
      href: buildFilteredUrl({ sla_status: 'At Risk' }),
      description: "Orders approaching SLA limits"
    },
    {
      title: "Breached Orders",
      value: data.breached_orders,
      percentage: data.total_orders > 0 ? (data.breached_orders / data.total_orders) * 100 : 0,
      icon: <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />,
      color: "bg-red-100 dark:bg-red-900/30",
      href: buildFilteredUrl({ sla_status: 'Breached' }),
      description: "Orders exceeding SLA limits"
    },
    {
      title: "Fulfilled Orders",
      value: data.fulfilled_orders,
      percentage: data.total_orders > 0 ? (data.fulfilled_orders / data.total_orders) * 100 : 0,
      icon: <Package className="h-4 w-4 text-green-600 dark:text-green-400" />,
      color: "bg-green-100 dark:bg-green-900/30",
      href: buildFilteredUrl({ fulfilment_status: 'fulfilled' }),
      description: "Orders completed and delivered"
    }
  ]

  // Action Required KPI cards with combinations
  const actionRequiredCards = [
    {
      title: "Overdue processed orders  & Breached SLA",
      value: data.action_required_breached_processed || 0,
      icon: <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />,
      color: "bg-red-100 dark:bg-red-900/30",
      href: buildFilteredUrl({ sla_status: 'Breached', stage: 'Processed', pending_status: 'pending' }),
      description: "🚨 Shipping Overdue"
    },
    {
      title: "Overdue shipped orders & Breached SLA",
      value: data.action_required_breached_shipped || 0,
      icon: <Truck className="h-4 w-4 text-red-600 dark:text-red-400" />,
      color: "bg-red-100 dark:bg-red-900/30",
      href: buildFilteredUrl({ sla_status: 'Breached', stage: 'Shipped', pending_status: 'pending' }),
      description: "🚨 Deliverey Overdue"
    },
    {
      title: "Overdue delivered orders & Breached SLA",
      value: data.action_required_breached_delivered || 0,
      icon: <PackageX className="h-4 w-4 text-red-600 dark:text-red-400" />,
      color: "bg-red-100 dark:bg-red-900/30",
      href: buildFilteredUrl({ sla_status: 'Breached', stage: 'Delivered', pending_status: 'pending' }),
      description: "🚨 Delivery Overdue"
    },
    {
      title: "Overdue processed orders & At Risk SLA",
      value: data.action_required_at_risk_processed || 0,
      icon: <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />,
      color: "bg-orange-100 dark:bg-orange-900/30",
      href: buildFilteredUrl({ sla_status: 'At Risk', stage: 'Processed', pending_status: 'pending' }),
      description: "⚠️ Shipping Overdue"
    },
    {
      title: "Overdue shipped orders & At Risk SLA",
      value: data.action_required_at_risk_shipped || 0,
      icon: <Truck className="h-4 w-4 text-orange-600 dark:text-orange-400" />,
      color: "bg-orange-100 dark:bg-orange-900/30",
      href: buildFilteredUrl({ sla_status: 'At Risk', stage: 'Shipped', pending_status: 'pending' }),
      description: "⚠️ Shipping Overdue"
    },
    {
      title: "Overdue delivered orders & At Risk SLA",
      value: data.action_required_at_risk_delivered || 0,
      icon: <PackageX className="h-4 w-4 text-orange-600 dark:text-orange-400" />,
      color: "bg-orange-100 dark:bg-orange-900/30",
      href: buildFilteredUrl({ sla_status: 'At Risk', stage: 'Delivered', pending_status: 'pending' }),
      description: "⚠️ Delivery Overdue"
    },
    {
      title: "Monitor - On Time & Processing",
      value: data.action_required_on_time_processed || 0,
      icon: <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
      color: "bg-blue-100 dark:bg-blue-900/30",
      href: buildFilteredUrl({ sla_status: 'On Time', stage: 'Processed', pending_status: 'pending' }),
      description: "Overdue processed orders, within SLA"
    },
    {
      title: "Monitor - On Time & Shipping",
      value: data.action_required_on_time_shipped || 0,
      icon: <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
      color: "bg-blue-100 dark:bg-blue-900/30",
      href: buildFilteredUrl({ sla_status: 'On Time', stage: 'Shipped', pending_status: 'pending' }),
      description: "Overdue shipped orders, within SLA"
    },
    {
      title: "Monitor - On Time & Delivered",
      value: data.action_required_on_time_delivered || 0,
      icon: <PackageX className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
      color: "bg-blue-100 dark:bg-blue-900/30",
      href: buildFilteredUrl({ sla_status: 'On Time', stage: 'Delivered', pending_status: 'pending' }),
      description: "Overdue delivered orders, within SLA"
    }
  ]

  // Render based on section prop
  if (section === "overview") {
    return (
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Overview</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {kpiCards.map((kpi, index) => (
            <KPICard key={index} {...kpi} />
          ))}
        </div>
      </div>
    )
  }

  if (section === "action-required") {
    return (
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          🚨 Action Required - Operational Focus
        </h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {actionRequiredCards.map((kpi, index) => (
            <KPICard key={`action-${index}`} {...kpi} />
          ))}
        </div>
      </div>
    )
  }

  // Default: show all sections (backward compatibility)
  return (
    <div className="space-y-6">
      {/* Main KPI Grid - Overview */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Overview</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {kpiCards.map((kpi, index) => (
            <KPICard key={index} {...kpi} />
          ))}
        </div>
      </div>

      {/* Action Required Grid - Operational Focus */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          🚨 Action Required - Operational Focus
        </h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {actionRequiredCards.map((kpi, index) => (
            <KPICard key={`action-${index}`} {...kpi} />
          ))}
        </div>
      </div>
    </div>
  )
} 