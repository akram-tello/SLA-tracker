"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartData } from "@/lib/types"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

interface SLAChartProps {
  data: ChartData[]
}

export function SLAChart({ data }: SLAChartProps) {
  const chartData = {
    labels: data.map(item => item.stage),
    datasets: [
      {
        label: 'On Time',
        data: data.map(item => item.on_time),
        backgroundColor: '#10b981', // green-500
        borderColor: '#059669', // green-600
        borderWidth: 1,
      },
      {
        label: 'On Risk',
        data: data.map(item => item.on_risk),
        backgroundColor: '#f59e0b', // yellow-500
        borderColor: '#d97706', // yellow-600
        borderWidth: 1,
      },
      {
        label: 'Breached',
        data: data.map(item => item.breached),
        backgroundColor: '#ef4444', // red-500
        borderColor: '#dc2626', // red-600
        borderWidth: 1,
      },
    ],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false,
      },
      tooltip: {
                 callbacks: {
           afterLabel: function(context: { dataIndex: number; raw: unknown }) {
             const dataIndex = context.dataIndex
             const total = data[dataIndex].on_time + data[dataIndex].on_risk + data[dataIndex].breached
             const percentage = total > 0 ? ((Number(context.raw) / total) * 100).toFixed(1) : '0'
             return `${percentage}% of total`
           }
         }
      }
    },
    scales: {
      x: {
        stacked: true,
      },
      y: {
        stacked: true,
        beginAtZero: true,
      },
    },
  }

  return (
    <Card className="col-span-4">
      <CardHeader>
        <CardTitle>SLA Performance by Stage</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <Bar data={chartData} options={options} />
        </div>
      </CardContent>
    </Card>
  )
} 