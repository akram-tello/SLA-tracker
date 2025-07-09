"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StageBreakdown } from "@/lib/types"

interface StageBreakdownTableProps {
  data: StageBreakdown[]
}

export function StageBreakdownTable({ data }: StageBreakdownTableProps) {
  const getSLABadge = (onTime: number, breached: number, onRisk: number) => {
    const total = onTime + breached + onRisk
    if (total === 0) return <Badge variant="secondary">No Data</Badge>
    
    const onTimePercentage = (onTime / total) * 100
    
    if (onTimePercentage >= 90) {
      return <Badge className="bg-green-100 text-green-700">Excellent</Badge>
    } else if (onTimePercentage >= 80) {
      return <Badge className="bg-yellow-100 text-yellow-700">Good</Badge>
    } else if (onTimePercentage >= 70) {
      return <Badge className="bg-orange-100 text-orange-700">Fair</Badge>
    } else {
      return <Badge variant="destructive">Poor</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stage Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Stage</TableHead>
              <TableHead className="text-right">On-Time</TableHead>
              <TableHead className="text-right">Breached</TableHead>
              <TableHead className="text-right">On-Risk</TableHead>
              <TableHead className="text-right">Avg Delay</TableHead>
              <TableHead className="text-right">Performance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.stage}>
                <TableCell className="font-medium">{row.stage}</TableCell>
                <TableCell className="text-right">
                  <span className="text-green-600 font-medium">
                    {row.on_time.toLocaleString()}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="text-red-600 font-medium">
                    {row.breached.toLocaleString()}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="text-yellow-600 font-medium">
                    {row.on_risk.toLocaleString()}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {row.avg_delay}
                </TableCell>
                <TableCell className="text-right">
                  {getSLABadge(row.on_time, row.breached, row.on_risk)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
} 