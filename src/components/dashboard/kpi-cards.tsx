"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from "lucide-react"

interface KPICardsProps {
  totalOrders: number
  slaBreached: number
  onRisk: number
  completed: number
}

export function KPICards({ totalOrders, slaBreached, onRisk, completed }: KPICardsProps) {
  const breachedPercentage = totalOrders > 0 ? ((slaBreached / totalOrders) * 100).toFixed(1) : '0'
  const riskPercentage = totalOrders > 0 ? ((onRisk / totalOrders) * 100).toFixed(1) : '0'
  const completedPercentage = totalOrders > 0 ? ((completed / totalOrders) * 100).toFixed(1) : '0'

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalOrders.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">All orders in period</p>
        </CardContent>
      </Card>

      <Card>
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

      <Card>
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

      <Card>
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