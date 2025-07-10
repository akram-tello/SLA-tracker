"use client"

import { useDashboard } from '@/lib/dashboard-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function StageKPICards() {
  const { dashboardData, loading, error } = useDashboard()

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <CardTitle className="bg-gray-200 h-4 w-20 rounded"></CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="bg-gray-200 h-8 w-16 rounded"></div>
                <div className="bg-gray-200 h-3 w-24 rounded"></div>
              </div>
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
            <div className="text-red-600 text-sm">Error loading stage KPIs: {error}</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const stageKpis = dashboardData?.stage_kpis || []

  if (stageKpis.length === 0) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-gray-500 text-sm">No stage KPI data available</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Helper function to get stage color
  const getStageColor = (stage: string) => {
    switch (stage.toLowerCase()) {
      case 'processing': return 'text-gray-600'
      case 'processed': return 'text-blue-600'
      case 'shipped': return 'text-yellow-600'
      case 'delivered': return 'text-green-600'
      default: return 'text-gray-600'
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stageKpis.map((stageKpi) => {
        const breachedPercentage = stageKpi.total_orders > 0 
          ? ((stageKpi.breached_orders / stageKpi.total_orders) * 100).toFixed(1) 
          : '0'
        const riskPercentage = stageKpi.total_orders > 0 
          ? ((stageKpi.on_risk_orders / stageKpi.total_orders) * 100).toFixed(1)
          : '0'

        return (
          <Card key={stageKpi.stage} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className={`text-base font-semibold ${getStageColor(stageKpi.stage)}`}>
                {stageKpi.stage}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Total Orders */}
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {stageKpi.total_orders.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">Total Orders</div>
                </div>

                {/* Performance Metrics */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="font-medium text-green-600">
                      {stageKpi.on_time_orders.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">On Time</div>
                  </div>
                  <div>
                    <div className="font-medium text-red-600">
                      {stageKpi.breached_orders.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">Breached</div>
                  </div>
                </div>

                {/* Percentages */}
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Completion Rate:</span>
                    <span className="font-medium text-blue-600">
                      {stageKpi.completion_rate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-gray-600">Breach Rate:</span>
                    <span className="font-medium text-red-600">{breachedPercentage}%</span>
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-gray-600">Risk Rate:</span>
                    <span className="font-medium text-yellow-600">{riskPercentage}%</span>
                  </div>
                </div>

                {/* Average Delay for Breached Orders */}
                {stageKpi.avg_delay_seconds > 0 && (
                  <div className="pt-2 border-t border-gray-100">
                    <div className="text-xs text-gray-600">Avg Delay:</div>
                    <div className="text-sm font-medium text-red-600">
                      {Math.round(stageKpi.avg_delay_seconds / 3600)} hours
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
} 