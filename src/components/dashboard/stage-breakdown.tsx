"use client"

// StageBreakdown type is available from dashboardData.stage_breakdown
import { useRouter } from "next/navigation"
import { useDashboard } from "@/lib/dashboard-context"

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

const TableCell = ({ children, className = "", colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) => (
  <td className={`px-6 py-4 ${className}`} colSpan={colSpan}>
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

export function StageBreakdownTable() {
  const router = useRouter()
  const { dashboardData, loading, error, filters } = useDashboard()

  const handleStageClick = (stage: string, slaStatus: string) => {
    const params = new URLSearchParams()
    if (filters.from_date) params.append('from_date', filters.from_date)
    if (filters.to_date) params.append('to_date', filters.to_date)
    if (filters.brand) params.append('brand', filters.brand)
    if (filters.country) params.append('country', filters.country)
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

  if (error) {
    return (
      <Card className="border-0 shadow-sm">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Stage Breakdown
          </h3>
          <div className="text-center py-8">
            <div className="text-red-500 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-gray-600 dark:text-gray-400">Failed to load stage breakdown data</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">{error}</p>
          </div>
        </div>
      </Card>
    )
  }

  const stageBreakdownData = dashboardData?.stage_breakdown || []

  if (stageBreakdownData.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Stage Breakdown
          </h3>
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-gray-600 dark:text-gray-400">No stage breakdown data available</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Try adjusting your filters or date range</p>
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
              {stageBreakdownData.map((row) => (
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