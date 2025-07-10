"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Search, Download, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { OrderFilters } from "@/lib/types"
import { useSearchParams } from "next/navigation"

interface Order {
  order_no: string
  order_status: string
  shipping_status: string
  order_date: Date
  processing_time?: Date
  shipped_time?: Date
  delivered_time?: Date
  processed_tat?: number
  shipped_tat?: number
  delivered_tat?: number
  brand_name: string
  country_code: string
  sla_status: string
  filtered_stage?: string
}

interface OrdersResponse {
  orders: Order[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export default function OrdersPage() {
  const searchParams = useSearchParams()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  
  // Initialize filters from URL params (for drill-down from dashboard)
  const [filters, setFilters] = useState<OrderFilters>(() => {
    const initialFilters: OrderFilters = {
      page: 1,
      limit: 20,
    }
    
    // Parse URL parameters
    if (searchParams.get('sla_status')) initialFilters.sla_status = searchParams.get('sla_status') || undefined
    if (searchParams.get('stage')) initialFilters.stage = searchParams.get('stage') || undefined  
    if (searchParams.get('brand')) initialFilters.brand = searchParams.get('brand') || undefined
    if (searchParams.get('country')) initialFilters.country = searchParams.get('country') || undefined
    if (searchParams.get('from_date')) initialFilters.from_date = searchParams.get('from_date') || undefined
    if (searchParams.get('to_date')) initialFilters.to_date = searchParams.get('to_date') || undefined
    
    return initialFilters
  })
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    total_pages: 0,
  })

  const fetchOrders = async (currentFilters: OrderFilters) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentFilters.page.toString(),
        limit: currentFilters.limit.toString(),
      })
      
      if (currentFilters.order_status) params.append('order_status', currentFilters.order_status)
      if (currentFilters.risk_flag !== undefined) params.append('risk_flag', currentFilters.risk_flag.toString())
      if (currentFilters.order_no) params.append('order_no', currentFilters.order_no)
      if (currentFilters.brand) params.append('brand', currentFilters.brand)
      if (currentFilters.country) params.append('country', currentFilters.country)
      if (currentFilters.sla_status) params.append('sla_status', currentFilters.sla_status)
      if (currentFilters.stage) params.append('stage', currentFilters.stage)
      if (currentFilters.from_date) params.append('from_date', currentFilters.from_date)
      if (currentFilters.to_date) params.append('to_date', currentFilters.to_date)

      const response = await fetch(`/api/v1/orders?${params}`)
      if (!response.ok) throw new Error('Failed to fetch orders')
      
      const data: OrdersResponse = await response.json()
      setOrders(data.orders)
      setPagination({
        total: data.total,
        page: data.page,
        total_pages: data.total_pages,
      })
    } catch (error) {
      console.error('Error fetching orders:', error)
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders(filters)
  }, [filters])

  const handleSearch = () => {
    setFilters(prev => ({
      ...prev,
      page: 1,
      order_no: searchTerm || undefined,
    }))
  }

  const handleFilterChange = (key: keyof OrderFilters, value: string | boolean | undefined) => {
    setFilters(prev => ({
      ...prev,
      page: 1,
      [key]: value,
    }))
  }

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({
      ...prev,
      page: newPage,
    }))
  }

  const getSLABadge = (status: string) => {
    switch (status) {
      case 'On Time':
        return <Badge className="bg-green-100 text-green-700">On Time</Badge>
      case 'At Risk':
        return <Badge className="bg-yellow-100 text-yellow-700">At Risk</Badge>
      case 'Breached':
        return <Badge variant="destructive">Breached</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const exportToCSV = () => {
    const headers = [
      'Order No', 'Order Status', 'Shipping Status', 'Order Date',
      'Processing Time', 'Shipped Time', 'Delivered Time',
      'Brand', 'Country', 'SLA Status'
    ]
    
    const csvData = orders.map(order => [
      order.order_no,
      order.order_status,
      order.shipping_status,
      format(new Date(order.order_date), 'yyyy-MM-dd'),
      order.processing_time ? format(new Date(order.processing_time), 'yyyy-MM-dd HH:mm') : '',
      order.shipped_time ? format(new Date(order.shipped_time), 'yyyy-MM-dd HH:mm') : '',
      order.delivered_time ? format(new Date(order.delivered_time), 'yyyy-MM-dd HH:mm') : '',
      order.brand_name,
      order.country_code,
      order.sla_status,
    ])

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orders-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Orders Backlog
                {filters.stage && (
                  <span className="text-lg font-normal text-gray-600 ml-2">
                    - {filters.stage} Stage
                  </span>
                )}
              </h1>
              <p className="text-gray-600 mt-1">
                {filters.sla_status && filters.stage 
                  ? `Showing ${filters.sla_status.toLowerCase()} orders in ${filters.stage.toLowerCase()} stage`
                  : filters.sla_status 
                  ? `Showing ${filters.sla_status.toLowerCase()} orders`
                  : filters.stage
                  ? `Showing orders in ${filters.stage.toLowerCase()} stage`
                  : "View and manage order details"
                }
              </p>
            </div>
          </div>
          <Button onClick={exportToCSV} disabled={orders.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Search */}
              <div className="flex gap-2">
                <Input
                  placeholder="Search order number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} size="icon">
                  <Search className="h-4 w-4" />
                </Button>
              </div>

              {/* Order Status */}
              <Select 
                value={filters.order_status || "all"} 
                onValueChange={(value) => handleFilterChange('order_status', value === 'all' ? undefined : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Order Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Processing">Processing</SelectItem>
                  <SelectItem value="Shipped">Shipped</SelectItem>
                  <SelectItem value="Delivered">Delivered</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>

              {/* Risk Flag */}
              <Select 
                value={filters.risk_flag === undefined ? "all" : filters.risk_flag.toString()} 
                onValueChange={(value) => handleFilterChange('risk_flag', value === 'all' ? undefined : value === 'true')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="SLA Risk" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Orders</SelectItem>
                  <SelectItem value="true">At Risk</SelectItem>
                  <SelectItem value="false">Not At Risk</SelectItem>
                </SelectContent>
              </Select>

              {/* Brand */}
              <Select 
                value={filters.brand || "all"} 
                onValueChange={(value) => handleFilterChange('brand', value === 'all' ? undefined : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Brands</SelectItem>
                                     <SelectItem value="Victoria's Secret">Victoria&apos;s Secret</SelectItem>
                  <SelectItem value="Bath & Body Works">Bath & Body Works</SelectItem>
                </SelectContent>
              </Select>

              {/* Country */}
              <Select 
                value={filters.country || "all"} 
                onValueChange={(value) => handleFilterChange('country', value === 'all' ? undefined : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  <SelectItem value="MY">Malaysia</SelectItem>
                  <SelectItem value="SG">Singapore</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>
                Orders ({pagination.total.toLocaleString()} total)
              </CardTitle>
              <div className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.total_pages}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No orders found matching the filters</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order No</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Shipping</TableHead>
                      <TableHead>Order Date</TableHead>
                      <TableHead>Processing</TableHead>
                      <TableHead>Shipped</TableHead>
                      <TableHead>Delivered</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>SLA Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.order_no}>
                        <TableCell className="font-medium">{order.order_no}</TableCell>
                        <TableCell>{order.order_status}</TableCell>
                        <TableCell>{order.shipping_status}</TableCell>
                        <TableCell>{format(new Date(order.order_date), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>
                          {order.processing_time 
                            ? format(new Date(order.processing_time), 'MMM dd, HH:mm')
                            : '-'
                          }
                        </TableCell>
                        <TableCell>
                          {order.shipped_time 
                            ? format(new Date(order.shipped_time), 'MMM dd, HH:mm')
                            : '-'
                          }
                        </TableCell>
                        <TableCell>
                          {order.delivered_time 
                            ? format(new Date(order.delivered_time), 'MMM dd, HH:mm')
                            : '-'
                          }
                        </TableCell>
                        <TableCell>{order.brand_name}</TableCell>
                        <TableCell>{order.country_code}</TableCell>
                        <TableCell>{getSLABadge(order.sla_status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                <div className="flex justify-between items-center mt-6">
                  <div className="text-sm text-gray-500">
                    Showing {((pagination.page - 1) * filters.limit) + 1} to{' '}
                    {Math.min(pagination.page * filters.limit, pagination.total)} of{' '}
                    {pagination.total} results
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page >= pagination.total_pages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 