"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import Link from 'next/link'
import { useDashboard } from '@/lib/dashboard-context'

export function KPICards() {
  const { dashboardData, loading, error, filters } = useDashboard()

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium bg-gray-200 h-4 w-20 rounded"></CardTitle>
              <div className="bg-gray-200 h-4 w-4 rounded"></div>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-200 h-8 w-16 rounded mb-1"></div>
              <div className="bg-gray-200 h-3 w-24 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-red-200">
          <CardContent className="p-6">
            <div className="text-red-600 text-sm">Error loading KPIs: {error}</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!dashboardData?.kpis) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-gray-500 text-sm">No KPI data available</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { kpis } = dashboardData

  // Helper function to create drill-down URLs
  const getDrillDownUrl = (type: string) => {
    const params = new URLSearchParams()
    if (filters.brand) params.append('brand', filters.brand)
    if (filters.country) params.append('country', filters.country)
    if (filters.from_date) params.append('from_date', filters.from_date)
    if (filters.to_date) params.append('to_date', filters.to_date)
    
    // Add specific filters based on KPI type
    switch (type) {
      case 'breached':
        params.append('sla_status', 'breached')
        break
      case 'on_risk':
        params.append('sla_status', 'on_risk')
        break
      case 'on_time':
        params.append('sla_status', 'on_time')
        break
    }
    
    return `/orders?${params.toString()}`
  }

  const cards = [
    {
      title: "Total Orders",
      value: kpis.total_orders.toLocaleString(),
      description: "All orders in period",
      icon: TrendingUp,
      link: getDrillDownUrl('all'),
      color: "text-blue-600"
    },
    {
      title: "SLA Breached",
      value: kpis.breached_orders.toLocaleString(),
      description: `${((kpis.breached_orders / kpis.total_orders) * 100 || 0).toFixed(1)}% of total`,
      icon: AlertTriangle,
      link: getDrillDownUrl('breached'),
      color: "text-red-600"
    },
    {
      title: "On Risk",
      value: kpis.on_risk_orders.toLocaleString(),
      description: `${((kpis.on_risk_orders / kpis.total_orders) * 100 || 0).toFixed(1)}% of total`,
      icon: Clock,
      link: getDrillDownUrl('on_risk'),
      color: "text-yellow-600"
    },
    {
      title: "Completed On Time",
      value: kpis.on_time_orders.toLocaleString(),
      description: `${kpis.completion_rate.toFixed(1)}% completion rate`,
      icon: CheckCircle,
      link: getDrillDownUrl('on_time'),
      color: "text-green-600"
    }
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const IconComponent = card.icon
        return (
          <Link href={card.link} key={card.title} className="group">
            <Card className="transition-all duration-200 hover:shadow-md hover:border-gray-300 group-hover:scale-[1.02]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium group-hover:text-blue-600 transition-colors">
                  {card.title}
                </CardTitle>
                <IconComponent className={`h-4 w-4 ${card.color} group-hover:scale-110 transition-transform`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
} 