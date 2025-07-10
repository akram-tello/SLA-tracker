"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from "lucide-react"
import { useRouter } from "next/navigation"

interface KPICardsProps {
  totalOrders: number
  slaBreached: number
  onRisk: number
  completed: number
  filters?: {
    from_date: string
    to_date: string
    brand?: string
    country?: string
  }
}

export function KPICards({ totalOrders, slaBreached, onRisk, completed, filters }: KPICardsProps) {
  const router = useRouter()
  const breachedPercentage = totalOrders > 0 ? ((slaBreached / totalOrders) * 100).toFixed(1) : '0'
  const riskPercentage = totalOrders > 0 ? ((onRisk / totalOrders) * 100).toFixed(1) : '0'
  const completedPercentage = totalOrders > 0 ? ((completed / totalOrders) * 100).toFixed(1) : '0'

  const handleKPIClick = (slaStatus: string) => {
    const params = new URLSearchParams()
    if (filters?.from_date) params.append('from_date', filters.from_date)
    if (filters?.to_date) params.append('to_date', filters.to_date)
    if (filters?.brand) params.append('brand', filters.brand)
    if (filters?.country) params.append('country', filters.country)
    if (slaStatus !== 'all') params.append('sla_status', slaStatus)
    
    router.push(`/orders?${params.toString()}`)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleKPIClick('all')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalOrders.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">All orders in period</p>
        </CardContent>
      </Card>

      <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleKPIClick('Breached')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">SLA Breached</CardTitle>
          <TrendingDown className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{slaBreached.toLocaleString()}</div>
          <div className="flex items-center space-x-2">
            <Badge variant="destructive" className="text-xs">
              {breachedPercentage}%
            </Badge>
            <p className="text-xs text-muted-foreground">of total orders</p>
          </div>
        </CardContent>
      </Card>

      <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleKPIClick('At Risk')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">On Risk</CardTitle>
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">{onRisk.toLocaleString()}</div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-700">
              {riskPercentage}%
            </Badge>
            <p className="text-xs text-muted-foreground">of total orders</p>
          </div>
        </CardContent>
      </Card>

      <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleKPIClick('On Time')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completed</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{completed.toLocaleString()}</div>
          <div className="flex items-center space-x-2">
            <Badge className="text-xs bg-green-100 text-green-700">
              {completedPercentage}%
            </Badge>
            <p className="text-xs text-muted-foreground">of total orders</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 