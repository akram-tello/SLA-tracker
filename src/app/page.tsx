"use client"

import { useState, useEffect } from "react"
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns"
import { StageKPICards } from "@/components/dashboard/stage-kpi-cards"
import { SLAChart } from "@/components/dashboard/sla-chart"
import { StageBreakdownTable } from "@/components/dashboard/stage-breakdown"
import { DashboardFilters } from "@/components/dashboard/filters"
import { DashboardSummary, DashboardFilters as DashboardFiltersType } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"
import Link from "next/link"

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<DashboardFiltersType>({
    from_date: format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'), // Start of last month
    to_date: format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'), // End of last month
  })

  const fetchSummary = async (currentFilters: DashboardFiltersType) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        from_date: currentFilters.from_date,
        to_date: currentFilters.to_date,
      })
      
      if (currentFilters.brand) params.append('brand', currentFilters.brand)
      if (currentFilters.country) params.append('country', currentFilters.country)

      const response = await fetch(`/api/v1/dashboard/summary?${params}`)
      if (!response.ok) throw new Error('Failed to fetch summary')
      
      const data = await response.json()
      setSummary(data)
    } catch (error) {
      console.error('Error fetching summary:', error)
      // Set empty data on error
      setSummary({
        total_orders: 0,
        sla_breached: 0,
        on_risk: 0,
        completed: 0,
        stage_kpis: [],
        chart_data: [],
        stage_breakdown: [],
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSummary(filters)
  }, [filters])

  const handleFiltersChange = (newFilters: DashboardFiltersType) => {
    setFilters(newFilters)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
            <div className="h-32 bg-gray-200 rounded mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">SLA Tracker Dashboard</h1>
            <p className="text-gray-600 mt-1">Monitor SLA performance across brands and countries</p>
          </div>
          <div className="flex gap-3">
            <Link href="/orders">
              <Button variant="outline">
                View Orders
              </Button>
            </Link>
            <Button variant="outline" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <DashboardFilters filters={filters} onFiltersChange={handleFiltersChange} />

        {/* Stage-Specific KPI Cards */}
        {summary && summary.stage_kpis.length > 0 && (
          <StageKPICards
            stageKpis={summary.stage_kpis}
            filters={filters}
          />
        )}

        {/* Chart and Table */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart */}
          {summary && summary.chart_data.length > 0 ? (
            <SLAChart data={summary.chart_data} />
          ) : (
            <div className="bg-white rounded-lg border p-8 text-center">
              <p className="text-gray-500">No chart data available for the selected filters</p>
            </div>
          )}

          {/* Stage Breakdown */}
          {summary && summary.stage_breakdown.length > 0 ? (
            <StageBreakdownTable data={summary.stage_breakdown} filters={filters} />
          ) : (
            <div className="bg-white rounded-lg border p-8 text-center">
              <p className="text-gray-500">No breakdown data available for the selected filters</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
