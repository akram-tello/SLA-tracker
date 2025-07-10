"use client"

import React, { useState, useEffect } from "react"
import { format } from "date-fns"
import { Search, Download, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { OrderFilters } from "@/lib/types"
import { useSearchParams } from "next/navigation"

// Custom Tailwind components
const Button = ({ 
  children, 
  onClick, 
  color = "blue", 
  size = "md", 
  className = "",
  disabled = false
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  color?: "blue" | "gray"; 
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
}) => {
  const colorClasses = {
    blue: "bg-blue-600 hover:bg-blue-700 text-white",
    gray: "bg-gray-100 hover:bg-gray-200 text-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white"
  };
  
  const sizeClasses = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-2 text-sm", 
    lg: "px-6 py-3 text-base"
  };
  
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`font-medium rounded-lg transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${colorClasses[color]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </button>
  );
};

const TextInput = ({ 
  type = "text", 
  placeholder, 
  value, 
  onChange, 
  onKeyPress,
  icon,
  className = "" 
}: { 
  type?: string; 
  placeholder?: string; 
  value?: string; 
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyPress?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) => (
  <div className="relative">
    <input 
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      onKeyPress={onKeyPress}
      className={`bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 ${icon ? 'pr-10' : ''} dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 ${className}`}
    />
    {icon && (
      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
        {React.createElement(icon, { className: "h-4 w-4 text-gray-400" })}
      </div>
    )}
  </div>
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

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}>
    {children}
  </div>
);

const Select = ({ 
  children, 
  value, 
  onChange, 
  className = "" 
}: { 
  children: React.ReactNode; 
  value?: string; 
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  className?: string;
}) => (
  <select 
    value={value}
    onChange={onChange}
    className={`bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 ${className}`}
  >
    {children}
  </select>
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
        return <Badge color="success">On Time</Badge>
      case 'At Risk':
        return <Badge color="warning">At Risk</Badge>
      case 'Breached':
        return <Badge color="failure">Breached</Badge>
      default:
        return <Badge color="gray">{status}</Badge>
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button color="gray" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Orders</h1>
          </div>
          <Button onClick={exportToCSV} color="blue">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-sm">
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="relative">
                <TextInput
                  type="text"
                  placeholder="Search by order number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  icon={Search}
                />
              </div>
              
              <Select
                value={filters.order_status || ''}
                onChange={(e) => handleFilterChange('order_status', e.target.value || undefined)}
              >
                <option value="">All Order Status</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </Select>

              <Select
                value={filters.sla_status || ''}
                onChange={(e) => handleFilterChange('sla_status', e.target.value || undefined)}
              >
                <option value="">All SLA Status</option>
                <option value="On Time">On Time</option>
                <option value="At Risk">At Risk</option>
                <option value="Breached">Breached</option>
              </Select>

              <Select
                value={filters.brand || ''}
                onChange={(e) => handleFilterChange('brand', e.target.value || undefined)}
              >
                <option value="">All Brands</option>
                <option value="Victoria's Secret">Victoria&apos;s Secret</option>
                <option value="Bath & Body Works">Bath & Body Works</option>
              </Select>
            </div>
            
            <div className="flex gap-4">
              <Button onClick={handleSearch} color="blue">
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
              <Button 
                onClick={() => {
                  setSearchTerm('')
                  setFilters({ page: 1, limit: 20 })
                }}
                color="gray"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </Card>

        {/* Results Summary */}
        {!loading && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {orders.length} of {pagination.total} orders
            {filters.sla_status && ` (filtered by SLA: ${filters.sla_status})`}
            {filters.stage && ` (filtered by stage: ${filters.stage})`}
          </div>
        )}

        {/* Orders Table */}
        <Card className="border-0 shadow-sm">
          <div className="overflow-x-auto">
            <Table hoverable>
              <TableHead>
                <TableRow>
                  <TableHeadCell>Order No</TableHeadCell>
                  <TableHeadCell>Order Status</TableHeadCell>
                  <TableHeadCell>Brand</TableHeadCell>
                  <TableHeadCell>Country</TableHeadCell>
                  <TableHeadCell>Order Date</TableHeadCell>
                  <TableHeadCell>Processing</TableHeadCell>
                  <TableHeadCell>Shipped</TableHeadCell>
                  <TableHeadCell>Delivered</TableHeadCell>
                  <TableHeadCell>SLA Status</TableHeadCell>
                </TableRow>
              </TableHead>
              <TableBody className="divide-y">
                {loading ? (
                  // Loading skeleton
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div></TableCell>
                      <TableCell><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div></TableCell>
                      <TableCell><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div></TableCell>
                      <TableCell><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div></TableCell>
                      <TableCell><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div></TableCell>
                      <TableCell><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div></TableCell>
                      <TableCell><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div></TableCell>
                      <TableCell><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div></TableCell>
                      <TableCell><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div></TableCell>
                    </TableRow>
                  ))
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500 dark:text-gray-400">
                      No orders found
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => (
                    <TableRow key={order.order_no} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                      <TableCell className="font-medium text-gray-900 dark:text-white">
                        {order.order_no}
                      </TableCell>
                      <TableCell className="capitalize">
                        {order.order_status}
                      </TableCell>
                      <TableCell>{order.brand_name}</TableCell>
                      <TableCell>{order.country_code}</TableCell>
                      <TableCell>{format(new Date(order.order_date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>
                        {order.processing_time ? (
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {format(new Date(order.processing_time), 'MMM dd, HH:mm')}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {order.shipped_time ? (
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {format(new Date(order.shipped_time), 'MMM dd, HH:mm')}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {order.delivered_time ? (
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {format(new Date(order.delivered_time), 'MMM dd, HH:mm')}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getSLABadge(order.sla_status)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {!loading && pagination.total_pages > 1 && (
            <div className="flex justify-between items-center px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Page {pagination.page} of {pagination.total_pages}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  color="gray"
                  size="sm"
                >
                  Previous
                </Button>
                {Array.from({ length: Math.min(5, pagination.total_pages) }, (_, i) => {
                  const page = i + 1
                  return (
                    <Button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      color={page === pagination.page ? "blue" : "gray"}
                      size="sm"
                    >
                      {page}
                    </Button>
                  )
                })}
                <Button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.total_pages}
                  color="gray"
                  size="sm"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
} 