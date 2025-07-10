"use client"

import { TrendingDown, AlertTriangle, CheckCircle, Package, Truck, Home } from "lucide-react"
import { useRouter } from "next/navigation"
import { StageKPI } from "@/lib/types"

// Custom Tailwind components
const Card = ({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 ${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''} ${className}`} onClick={onClick}>
    {children}
  </div>
);

const CardHeader = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`flex flex-row items-center justify-between space-y-0 pb-2 ${className}`}>
    {children}
  </div>
);

const CardTitle = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <h3 className={`text-sm font-medium ${className}`}>
    {children}
  </h3>
);

const CardContent = ({ children }: { children: React.ReactNode }) => (
  <div>
    {children}
  </div>
);

const Badge = ({ children, variant = "default", className = "" }: { children: React.ReactNode; variant?: "default" | "destructive" | "secondary"; className?: string }) => {
  const variantClasses = {
    default: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    destructive: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    secondary: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
  };
  
  return (
    <span className={`text-xs font-medium px-2.5 py-0.5 rounded ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
};

interface StageKPICardsProps {
  stageKpis: StageKPI[]
  filters?: {
    from_date: string
    to_date: string
    brand?: string
    country?: string
  }
}

export function StageKPICards({ stageKpis, filters }: StageKPICardsProps) {
  const router = useRouter()

  const handleKPIClick = (stage: string, slaStatus: string) => {
    const params = new URLSearchParams()
    if (filters?.from_date) params.append('from_date', filters.from_date)
    if (filters?.to_date) params.append('to_date', filters.to_date)
    if (filters?.brand) params.append('brand', filters.brand)
    if (filters?.country) params.append('country', filters.country)
    params.append('stage', stage)
    if (slaStatus !== 'all') params.append('sla_status', slaStatus)
    
    router.push(`/orders?${params.toString()}`)
  }

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'Processed': return <Package className="h-4 w-4" />
      case 'Shipped': return <Truck className="h-4 w-4" />  
      case 'Delivered': return <Home className="h-4 w-4" />
      default: return <Package className="h-4 w-4" />
    }
  }

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'Processed': return 'text-blue-600'
      case 'Shipped': return 'text-purple-600'
      case 'Delivered': return 'text-green-600'
      default: return 'text-gray-600'
    }
  }

  return (
    <div className="space-y-6">
      {stageKpis.map((stageKpi) => {
        const breachedPercentage = stageKpi.total_orders > 0 
          ? ((stageKpi.sla_breached / stageKpi.total_orders) * 100).toFixed(1) 
          : '0'
        const riskPercentage = stageKpi.total_orders > 0 
          ? ((stageKpi.on_risk / stageKpi.total_orders) * 100).toFixed(1) 
          : '0'
        const completedPercentage = stageKpi.total_orders > 0 
          ? ((stageKpi.completed / stageKpi.total_orders) * 100).toFixed(1) 
          : '0'

        return (
          <div key={stageKpi.stage} className="space-y-2">
            <div className="flex items-center gap-2">
              <div className={getStageColor(stageKpi.stage)}>
                {getStageIcon(stageKpi.stage)}
              </div>
              <h3 className={`font-semibold text-lg ${getStageColor(stageKpi.stage)}`}>
                {stageKpi.stage} Stage
              </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Total Orders */}
              <Card 
                className="cursor-pointer hover:shadow-lg transition-shadow" 
                onClick={() => handleKPIClick(stageKpi.stage, 'all')}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                  {getStageIcon(stageKpi.stage)}
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stageKpi.total_orders.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Orders in {stageKpi.stage.toLowerCase()}</p>
                </CardContent>
              </Card>

              {/* SLA Breached */}
              <Card 
                className="cursor-pointer hover:shadow-lg transition-shadow" 
                onClick={() => handleKPIClick(stageKpi.stage, 'Breached')}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">SLA Breached</CardTitle>
                  <TrendingDown className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{stageKpi.sla_breached.toLocaleString()}</div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="destructive" className="text-xs">
                      {breachedPercentage}%
                    </Badge>
                    <p className="text-xs text-muted-foreground">of {stageKpi.stage.toLowerCase()}</p>
                  </div>
                </CardContent>
              </Card>

              {/* On Risk */}
              <Card 
                className="cursor-pointer hover:shadow-lg transition-shadow" 
                onClick={() => handleKPIClick(stageKpi.stage, 'At Risk')}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">On Risk</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{stageKpi.on_risk.toLocaleString()}</div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-700">
                      {riskPercentage}%
                    </Badge>
                    <p className="text-xs text-muted-foreground">of {stageKpi.stage.toLowerCase()}</p>
                  </div>
                </CardContent>
              </Card>

              {/* On Time */}
              <Card 
                className="cursor-pointer hover:shadow-lg transition-shadow" 
                onClick={() => handleKPIClick(stageKpi.stage, 'On Time')}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">On Time</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{stageKpi.completed.toLocaleString()}</div>
                  <div className="flex items-center space-x-2">
                    <Badge className="text-xs bg-green-100 text-green-700">
                      {completedPercentage}%
                    </Badge>
                    <p className="text-xs text-muted-foreground">of {stageKpi.stage.toLowerCase()}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )
      })}
    </div>
  )
} 