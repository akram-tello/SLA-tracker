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

function KPICard({ title, value, icon, color, href, description }: KPICardProps) {
  return (
    <Link href={href} className="group block flex-1 min-w-0 h-full">
      <div className="p-4 transition-all duration-200 cursor-pointer group-hover:scale-[1.02] h-full">
        <div className="flex flex-col space-y-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${color} flex-shrink-0`}>
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 leading-tight">
                {title}
              </p>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <svg
                className="w-4 h-4 text-gray-400 group-hover:text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {value.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              {description}
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}

export function KPICards({ section = "all" }: { section?: "overview" | "action-required" | "all" }) {
  const { dashboardData, loading, error, filters } = useDashboard()

  if (loading) {
        if (section === "overview") {
      return (
        <div className="space-y-6">
          {/* Section 1: Orders Created Loading */}
          <div>
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
            <div className="grid gap-4">
              <Card className="p-4 animate-pulse h-full">
                <div className="flex flex-col space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg flex-shrink-0"></div>
                    <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
                    <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded flex-shrink-0"></div>
                  </div>
                  <div>
                    <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
                    <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Section 2: Orders In Progress Loading */}
          <div>
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="p-4 animate-pulse h-full">
                  <div className="flex flex-col space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg flex-shrink-0"></div>
                      <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
                      <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded flex-shrink-0"></div>
                    </div>
                    <div>
                      <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
                      <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Section 3: Orders Fulfilled Loading */}
          <div>
            <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[...Array(2)].map((_, i) => (
                <Card key={i} className="p-4 animate-pulse h-full">
                  <div className="flex flex-col space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg flex-shrink-0"></div>
                      <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
                      <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded flex-shrink-0"></div>
                    </div>
                    <div>
                      <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
                      <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )
    }

    // Other sections loading state
    const cardCount = section === "action-required" ? 9 : 14;
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(cardCount)].map((_, i) => (
          <Card key={i} className="p-4 animate-pulse h-full">
            <div className="flex flex-col space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg flex-shrink-0"></div>
                <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
                <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded flex-shrink-0"></div>
              </div>
              <div>
                <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
                <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
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

  // Helper function to build URL with current filters (status-based filtering)
  const buildFilteredUrl = (additionalParams: Record<string, string> = {}) => {
    const params = new URLSearchParams()
    
    // Add KPI mode flag to enable status-based filtering
    params.append('kpi_mode', 'true')
    
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

  // Helper function to build URL for placement-based filtering (Total Orders only)
  const buildPlacementFilteredUrl = (additionalParams: Record<string, string> = {}) => {
    const params = new URLSearchParams()
    
    // Add KPI mode flag set to false for placement-based filtering
    params.append('kpi_mode', 'false')
    
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
      title: "Orders Created",
      value: data.total_orders,
      percentage: 100,
      icon: <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
      color: "bg-blue-100 dark:bg-blue-900/30",
      href: buildPlacementFilteredUrl(),
      description: "All orders placed in selected period"
    },
    {
      title: "Order in progress (within SLA)",
      value: data.on_time_orders,
      percentage: data.total_orders > 0 ? (data.on_time_orders / data.total_orders) * 100 : 0,
      icon: <Clock className="h-4 w-4 text-green-600 dark:text-green-400" />,
      color: "bg-green-100 dark:bg-green-900/30",
      href: buildFilteredUrl({ sla_status: 'On Time' }),
      description: "Orders meeting SLA targets (On Time)"
    },
    {
      title: "Order in progress (At Risk)",
      value: data.on_risk_orders,
      percentage: data.total_orders > 0 ? (data.on_risk_orders / data.total_orders) * 100 : 0,
      icon: <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />,
      color: "bg-orange-100 dark:bg-orange-900/30",
      href: buildFilteredUrl({ sla_status: 'At Risk' }),
      description: "Orders approaching SLA limits"
    },
    {
      title: "Orders Breached SLA",
      value: data.breached_orders,
      percentage: data.total_orders > 0 ? (data.breached_orders / data.total_orders) * 100 : 0,
      icon: <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />,
      color: "bg-red-100 dark:bg-red-900/30",
      href: buildFilteredUrl({ sla_status: 'Breached' }),
      description: "Orders exceeding SLA limits"
    },
    {
      title: "Orders Fulfilled",
      value: data.fulfilled_orders,
      percentage: data.total_orders > 0 ? (data.fulfilled_orders / data.total_orders) * 100 : 0,
      icon: <Package className="h-4 w-4 text-green-600 dark:text-green-400" />,
      color: "bg-green-100 dark:bg-green-900/30",
      href: buildFilteredUrl({ fulfilment_status: 'fulfilled', sla_status: 'On Time,At Risk' }),
      description: "Completed orders (On Time & At Risk)"
    },
    {
      title: "Ordrer Fulfilled but SLA breached",
      value: data.fulfilled_breached_orders || 0,
      percentage: data.total_orders > 0 ? ((data.fulfilled_breached_orders || 0) / data.total_orders) * 100 : 0,
      icon: <PackageX className="h-4 w-4 text-red-600 dark:text-red-400" />,
      color: "bg-red-100 dark:bg-red-900/30",
      href: buildFilteredUrl({ fulfilment_status: 'fulfilled', sla_status: 'Breached' }),
      description: "Completed orders that breached SLA"
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
      <div className="space-y-8">
        {/* Combined Row: Orders Created & Orders Fulfilled */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Orders Created Group - Takes 1/3 of the width */}
          <div className="dark:bg-gradient-to-br dark:from-blue-900/10 dark:to-indigo-900/10 dark:border dark:border-blue-800/50 rounded-2xl p-6 lg:border-r lg:border-blue-200/50 lg:dark:border-blue-800/50">
            <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-4 uppercase tracking-wider">
              Orders Created
            </h4>
            <div className="grid gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <KPICard {...kpiCards[0]} />
              </div>
            </div>
          </div>

          {/* Orders Fulfilled Group - Takes 2/3 of the width */}
          <div className="lg:col-span-2 dark:bg-gradient-to-br dark:from-emerald-900/10 dark:to-green-900/10 dark:border dark:border-emerald-800/50 rounded-2xl p-6">
            <h4 className="text-sm font-semibold text-emerald-800 dark:text-emerald-200 mb-4 uppercase tracking-wider">
              Orders Fulfilled
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                <KPICard {...kpiCards[4]} />
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                <KPICard {...kpiCards[5]} />
              </div>
            </div>
          </div>
        </div>

        {/* Orders In Progress Group */}
        <div className="dark:bg-gradient-to-br dark:from-amber-900/10 dark:to-orange-900/10 dark:border dark:border-amber-800/50 rounded-2xl p-6">
          <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-4 uppercase tracking-wider">
            Orders In Progress
          </h4>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <KPICard {...kpiCards[1]} />
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <KPICard {...kpiCards[2]} />
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <KPICard {...kpiCards[3]} />
            </div>
          </div>
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
            <div key={`action-${index}`} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <KPICard {...kpi} />
            </div>
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
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
            <div key={`action-${index}`} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <KPICard {...kpi} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
} 