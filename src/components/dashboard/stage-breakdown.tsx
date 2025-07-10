"use client"

import { useDashboard } from '@/lib/dashboard-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

export function StageBreakdown() {
  const { dashboardData, loading, error, filters } = useDashboard()

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Stage Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex justify-between items-center p-4 border rounded-lg">
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="h-3 bg-gray-200 rounded w-32"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                  <div className="h-3 bg-gray-200 rounded w-12"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Stage Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-red-500 mb-2">⚠️</div>
            <p className="text-gray-600">Failed to load stage breakdown</p>
            <p className="text-sm text-gray-500 mt-1">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const stageData = dashboardData?.stage_breakdown || []

  if (stageData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Stage Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-500">No stage data available</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Helper function to get stage color
  const getStageColor = (stage: string) => {
    switch (stage.toLowerCase()) {
      case 'processing': return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'processed': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'shipped': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'delivered': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // Helper function to create drill-down URLs
  const getDrillDownUrl = (stage: string) => {
    const params = new URLSearchParams()
    if (filters.brand) params.append('brand', filters.brand)
    if (filters.country) params.append('country', filters.country)
    if (filters.from_date) params.append('from_date', filters.from_date)
    if (filters.to_date) params.append('to_date', filters.to_date)
    params.append('stage', stage)
    return `/orders?${params.toString()}`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Stage Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {stageData.map((stage) => (
            <Link 
              key={stage.stage} 
              href={getDrillDownUrl(stage.stage)}
              className="group block"
            >
              <div className="flex justify-between items-center p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer group-hover:border-blue-300">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStageColor(stage.stage)}`}>
                      {stage.stage}
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">On Time:</span>
                      <span className="ml-1 font-medium text-green-600">{stage.on_time.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">At Risk:</span>
                      <span className="ml-1 font-medium text-yellow-600">{stage.on_risk.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Breached:</span>
                      <span className="ml-1 font-medium text-red-600">{stage.breached.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">
                    {stage.total.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">
                    {stage.completion_rate.toFixed(1)}% on-time
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
        
        {/* Summary totals */}
        <div className="mt-6 pt-4 border-t">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-gray-900">
                {stageData.reduce((sum, stage) => sum + stage.total, 0).toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">Total Orders</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-green-600">
                {stageData.reduce((sum, stage) => sum + stage.on_time, 0).toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">On Time</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-yellow-600">
                {stageData.reduce((sum, stage) => sum + stage.on_risk, 0).toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">At Risk</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-red-600">
                {stageData.reduce((sum, stage) => sum + stage.breached, 0).toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">Breached</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 