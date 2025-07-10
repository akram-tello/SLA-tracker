"use client"

import { StageBreakdown as StageBreakdownType } from "@/lib/types"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"

// Custom Tailwind components
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
    {children}
  </div>
);

const Table = ({ children, hoverable }: { children: React.ReactNode; hoverable?: boolean }) => (
  <table className={`w-full text-sm text-left text-gray-500 dark:text-gray-400 ${hoverable ? 'hover:bg-gray-50' : ''}`}>
    {children}
  </table>
);

const TableHead = ({ children }: { children: React.ReactNode }) => (
  <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
    {children}
  </thead>
);

const TableHeadCell = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <th scope="col" className={`px-6 py-3 ${className}`}>
    {children}
  </th>
);

const TableBody = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <tbody className={className}>
    {children}
  </tbody>
);

const TableRow = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <tr className={`hover:bg-gray-50 dark:hover:bg-gray-600 ${className}`}>
    {children}
  </tr>
);

const TableCell = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <td className={`px-6 py-4 ${className}`}>
    {children}
  </td>
);

const Badge = ({ children, color = "gray" }: { children: React.ReactNode; color?: "success" | "warning" | "failure" | "gray" }) => {
  const colorClasses = {
    success: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300", 
    failure: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    gray: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
  };
  
  return (
    <span className={`text-xs font-medium px-2.5 py-0.5 rounded ${colorClasses[color]}`}>
      {children}
    </span>
  );
};

interface StageBreakdownTableProps {
  data?: StageBreakdownType[]
  filters?: {
    from_date: string
    to_date: string
    brand?: string
    country?: string
  }
}

export function StageBreakdownTable({ data, filters }: StageBreakdownTableProps) {
  const router = useRouter()
  const [tableData, setTableData] = useState<StageBreakdownType[]>([])
  const [loading, setLoading] = useState(true)

  // Sample data for demonstration
  const sampleData: StageBreakdownType[] = [
    {
      stage: "Processing",
      on_time: 850,
      breached: 30,
      on_risk: 120,
      avg_delay: "45m"
    },
    {
      stage: "Shipping", 
      on_time: 750,
      breached: 70,
      on_risk: 180,
      avg_delay: "2h 15m"
    },
    {
      stage: "Delivery",
      on_time: 680,
      breached: 120, 
      on_risk: 200,
      avg_delay: "1d 3h"
    }
  ]

  useEffect(() => {
    if (data && data.length > 0) {
      setTableData(data)
    } else {
      setTableData(sampleData)
    }
    setLoading(false)
  }, [data])

  const handleStageClick = (stage: string, slaStatus: string) => {
    const params = new URLSearchParams()
    if (filters?.from_date) params.append('from_date', filters.from_date)
    if (filters?.to_date) params.append('to_date', filters.to_date)
    if (filters?.brand) params.append('brand', filters.brand)
    if (filters?.country) params.append('country', filters.country)
    params.append('stage', stage)
    if (slaStatus !== 'all') params.append('sla_status', slaStatus)
    
    router.push(`/orders?${params.toString()}`)
  }

  const getSLABadge = (onTime: number, breached: number, onRisk: number) => {
    const total = onTime + breached + onRisk
    if (total === 0) return <Badge color="gray">No Data</Badge>
    
    const onTimePercentage = (onTime / total) * 100
    
    if (onTimePercentage >= 90) {
      return <Badge color="success">Excellent</Badge>
    } else if (onTimePercentage >= 80) {
      return <Badge color="warning">Good</Badge>
    } else if (onTimePercentage >= 70) {
      return <Badge color="warning">Fair</Badge>
    } else {
      return <Badge color="failure">Poor</Badge>
    }
  }

  if (loading) {
    return (
      <Card className="border-0 shadow-sm">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Stage Breakdown
          </h3>
          <div className="animate-pulse space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="grid grid-cols-6 gap-4">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-sm">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Stage Breakdown
        </h3>
        <div className="overflow-x-auto">
          <Table hoverable>
            <TableHead>
              <TableRow>
                <TableHeadCell>Stage</TableHeadCell>
                <TableHeadCell className="text-right">On-Time</TableHeadCell>
                <TableHeadCell className="text-right">Breached</TableHeadCell>
                <TableHeadCell className="text-right">On-Risk</TableHeadCell>
                <TableHeadCell className="text-right">Avg Delay</TableHeadCell>
                <TableHeadCell className="text-right">Performance</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody className="divide-y">
              {tableData.map((row) => (
                <TableRow key={row.stage} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                  <TableCell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                    {row.stage}
                  </TableCell>
                  <TableCell className="text-right">
                    <span 
                      className="text-green-600 dark:text-green-400 font-medium cursor-pointer hover:underline"
                      onClick={() => handleStageClick(row.stage, 'On Time')}
                    >
                      {row.on_time.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span 
                      className="text-red-600 dark:text-red-400 font-medium cursor-pointer hover:underline"
                      onClick={() => handleStageClick(row.stage, 'Breached')}
                    >
                      {row.breached.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span 
                      className="text-yellow-600 dark:text-yellow-400 font-medium cursor-pointer hover:underline"
                      onClick={() => handleStageClick(row.stage, 'At Risk')}
                    >
                      {row.on_risk.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-gray-600 dark:text-gray-400">
                    {row.avg_delay}
                  </TableCell>
                  <TableCell className="text-right">
                    {getSLABadge(row.on_time, row.breached, row.on_risk)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </Card>
  )
} 

// Export as StageBreakdown for consistency with the main page import
export const StageBreakdown = StageBreakdownTable; 