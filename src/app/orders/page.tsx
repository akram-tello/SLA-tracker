"use client"

import React, { useState, useEffect, Suspense } from "react"
import { format } from "date-fns"
import { Download, ArrowLeft, Search, Filter, Package } from "lucide-react"
import Link from "next/link"
// import { OrderFilters } from "@/lib/types" // Not needed with new filter structure
import { useSearchParams } from "next/navigation"

// Enhanced UI Components
const Button = ({ 
  children, 
  onClick, 
  variant = "primary", 
  size = "md", 
  className = "",
  disabled = false,
  icon
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}) => {
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white border-transparent",
    secondary: "bg-gray-600 hover:bg-gray-700 text-white border-transparent",
    outline: "bg-transparent hover:bg-gray-50 text-gray-700 border-gray-300",
    ghost: "bg-transparent hover:bg-gray-100 text-gray-700 border-transparent",
    danger: "bg-red-600 hover:bg-red-700 text-white border-transparent"
  };
  
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm", 
    lg: "px-6 py-3 text-base"
  };
  
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 font-medium rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
};

const Badge = ({ 
  children, 
  variant = "gray",
  size = "sm" 
}: { 
  children: React.ReactNode; 
  variant?: "success" | "warning" | "danger" | "info" | "gray" | "purple";
  size?: "sm" | "md";
}) => {
  const variants = {
    success: "bg-green-100 text-green-800 border-green-200",
    warning: "bg-yellow-100 text-yellow-800 border-yellow-200",
    danger: "bg-red-100 text-red-800 border-red-200",
    info: "bg-blue-100 text-blue-800 border-blue-200",
    purple: "bg-purple-100 text-purple-800 border-purple-200",
    gray: "bg-gray-100 text-gray-800 border-gray-200"
  };
  
  const sizes = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1"
  };
  
  return (
    <span className={`inline-flex items-center font-medium rounded-full border ${variants[variant]} ${sizes[size]}`}>
      {children}
    </span>
  );
};

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
    {children}
  </div>
);

const Input = ({ 
  type = "text", 
  placeholder, 
  value, 
  onChange, 
  icon,
  className = "" 
}: {
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon?: React.ReactNode;
  className?: string;
}) => (
  <div className="relative">
    {icon && (
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <div className="h-4 w-4 text-gray-400">{icon}</div>
      </div>
    )}
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${icon ? 'pl-10' : ''} ${className}`}
    />
  </div>
);

const Select = ({ 
  value, 
  onChange, 
  options, 
  placeholder = "Select...",
  className = "" 
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={`block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${className}`}
  >
    <option value="">{placeholder}</option>
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

// Enhanced Table Components
const Table = ({ children }: { children: React.ReactNode }) => (
  <div className="overflow-hidden rounded-lg border border-gray-200">
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        {children}
      </table>
    </div>
  </div>
);

const TableHeader = ({ children }: { children: React.ReactNode }) => (
  <thead className="bg-gray-50">
    {children}
  </thead>
);

const TableHeaderCell = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <th className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${className}`}>
    {children}
  </th>
);

const TableBody = ({ children }: { children: React.ReactNode }) => (
  <tbody className="bg-white divide-y divide-gray-200">
    {children}
  </tbody>
);

const TableRow = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <tr className={`hover:bg-gray-50 transition-colors ${className}`}>
    {children}
  </tr>
);

const TableCell = ({ children, className = "", colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) => (
  <td className={`px-6 py-4 whitespace-nowrap text-sm ${className}`} colSpan={colSpan}>
    {children}
  </td>
);

// Enhanced Order Interface
interface Order {
  order_no: string
  order_status: string
  shipping_status: string
  order_date: Date | string
  processed_time?: Date | string | null
  shipped_time?: Date | string | null
  delivered_time?: Date | string | null
  processed_tat?: string | null
  shipped_tat?: string | null
  delivered_tat?: string | null
  brand_name: string
  country_code: string
  current_stage: string
  sla_status: string
  pending_status: string
  pending_hours: number
}

interface OrdersResponse {
  orders: Order[]
  total: number
  page: number
  limit: number
  total_pages: number
}

// Filter State Interface
interface FilterState {
  search: string
  sla_status: string
  stage: string
  pending_status: string
  brand: string
  country: string
  from_date: string
  to_date: string
  order_status: string
}

function OrdersContent() {
  const searchParams = useSearchParams()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  
  // Enhanced Filter State
  const [filters, setFilters] = useState<FilterState>(() => ({
    search: "",
    sla_status: searchParams.get('sla_status') || '',
    stage: searchParams.get('stage') || '',
    pending_status: searchParams.get('pending_status') || '',
    brand: searchParams.get('brand') || '',
    country: searchParams.get('country') || '',
    from_date: searchParams.get('from_date') || '',
    to_date: searchParams.get('to_date') || '',
    order_status: searchParams.get('order_status') || ''
  }))
  
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    total_pages: 0,
    limit: 20
  })

  // Filter Options
  const slaStatusOptions = [
    { value: "On Time", label: "On Time" },
    { value: "At Risk", label: "At Risk" },
    { value: "Breached", label: "Breached" }
  ]

  const stageOptions = [
    { value: "Not Processed", label: "Not Processed" },
    { value: "Processed", label: "Processed" },
    { value: "Shipped", label: "Shipped" },
    { value: "Delivered", label: "Delivered" }
  ]

  const pendingStatusOptions = [
    { value: "pending", label: "Pending" },
    { value: "normal", label: "Normal" }
  ]

  const orderStatusOptions = [
    { value: "NEW", label: "New" },
    { value: "PROCESSING", label: "Processing" },
    { value: "COMPLETED", label: "Completed" },
    { value: "CANCELLED", label: "Cancelled" }
  ]

  const fetchOrders = async (currentFilters: FilterState, page: number = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        confirmation_status: 'CONFIRMED' // Only show confirmed orders
      })
      
      if (currentFilters.search) params.append('order_no', currentFilters.search)
      if (currentFilters.sla_status) params.append('sla_status', currentFilters.sla_status)
      if (currentFilters.stage) params.append('stage', currentFilters.stage)
      if (currentFilters.pending_status) params.append('pending_status', currentFilters.pending_status)
      if (currentFilters.brand) params.append('brand', currentFilters.brand)
      if (currentFilters.country) params.append('country', currentFilters.country)
      if (currentFilters.from_date) params.append('from_date', currentFilters.from_date)
      if (currentFilters.to_date) params.append('to_date', currentFilters.to_date)
      if (currentFilters.order_status) params.append('order_status', currentFilters.order_status)

      const response = await fetch(`/api/v1/orders?${params}`)
      if (!response.ok) throw new Error('Failed to fetch orders')
      
      const data: OrdersResponse = await response.json()
      setOrders(data.orders)
      setPagination(prev => ({
        ...prev,
        total: data.total,
        page: data.page,
        total_pages: data.total_pages,
      }))
    } catch (error) {
      console.error('Error fetching orders:', error)
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders(filters, pagination.page)
  }, [filters, pagination.page])

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPagination(prev => ({ ...prev, page: 1 })) // Reset to first page
  }

  const clearFilters = () => {
    setFilters({
      search: "", sla_status: "", stage: "", pending_status: "",
      brand: "", country: "", from_date: "", to_date: "", order_status: ""
    })
  }

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }))
  }

  // Enhanced Badge Functions
  const getSLABadge = (status: string) => {
    switch (status) {
      case 'On Time':
        return <Badge variant="success">On Time</Badge>
      case 'At Risk':
        return <Badge variant="warning">At Risk</Badge>
      case 'Breached':
        return <Badge variant="danger">Breached</Badge>
      default:
        return <Badge variant="gray">{status}</Badge>
    }
  }

  const getStageBadge = (stage: string) => {
    const stageConfig = {
      'Not Processed': { variant: 'gray' as const },
      'Processed': { variant: 'info' as const },
      'Shipped': { variant: 'warning' as const },
      'Delivered': { variant: 'success' as const }
    }
    
    const config = stageConfig[stage as keyof typeof stageConfig] || { variant: 'gray' as const }
    return <Badge variant={config.variant}>{stage}</Badge>
  }

  // Get fulfilment status badge with orange styling
  const getFulfilmentBadge = (order: typeof orders[0]) => {
    if (order.current_stage === 'Delivered') {
      return <Badge variant="success">Fulfilled</Badge>;
    } else {
      return <Badge variant="warning">Not Fulfilled</Badge>;
    }
  }

  const exportToCSV = () => {
    const headers = [
      'Order No', 'Current Stage', 'SLA Status', 'Pending Status', 'Brand', 'Country', 
      'Order Date', 'Processed Time', 'Shipped Time', 'Delivered Time', 'Pending Hours'
    ]
    
    const csvData = orders.map(order => [
      order.order_no,
      order.current_stage,
      order.sla_status,
      order.pending_status,
      order.brand_name,
      order.country_code,
      format(new Date(order.order_date), 'yyyy-MM-dd'),
      order.processed_time ? format(new Date(order.processed_time), 'yyyy-MM-dd HH:mm') : '',
      order.shipped_time ? format(new Date(order.shipped_time), 'yyyy-MM-dd HH:mm') : '',
      order.delivered_time ? format(new Date(order.delivered_time), 'yyyy-MM-dd HH:mm') : '',
      order.pending_hours
    ])

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orders-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const activeFiltersCount = Object.values(filters).filter(value => value !== '').length

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />}>
                Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Orders Management</h1>
              <p className="text-sm text-gray-600 mt-1">
                {!loading && `${pagination.total} orders found`}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => setShowFilters(!showFilters)}
              icon={<Filter className="h-4 w-4" />}
            >
              Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
            </Button>
            <Button 
              onClick={exportToCSV} 
              disabled={orders.length === 0}
              icon={<Download className="h-4 w-4" />}
            >
              Export
            </Button>
          </div>
        </div>

                 {/* Quick Search & Filters */}
         <Card className="p-6">
           <div className="space-y-4">
             {/* Search */}
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-2">Search Orders</label>
               <Input
                 placeholder="Search by order number..."
                 value={filters.search}
                 onChange={(e) => handleFilterChange('search', e.target.value)}
                 icon={<Search />}
               />
             </div>
             
             {/* Quick Filters */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-2">SLA Status</label>
                 <Select
                   value={filters.sla_status}
                   onChange={(value) => handleFilterChange('sla_status', value)}
                   options={slaStatusOptions}
                   placeholder="All SLA Status"
                 />
               </div>
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-2">Current Milestone</label>
                 <Select
                   value={filters.stage}
                   onChange={(value) => handleFilterChange('stage', value)}
                   options={stageOptions}
                   placeholder="All Stages"
                 />
               </div>
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-2">Fulfilment Status</label>
                 <Select
                   value={filters.pending_status}
                   onChange={(value) => handleFilterChange('pending_status', value)}
                   options={pendingStatusOptions}
                   placeholder="All Fulfilment Status"
                 />
               </div>
             </div>
           </div>
         </Card>

        {/* Advanced Filters */}
        {showFilters && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Advanced Filters</h3>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear All
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Brand</label>
                <Input
                  placeholder="e.g., Victoria's Secret"
                  value={filters.brand}
                  onChange={(e) => handleFilterChange('brand', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                <Input
                  placeholder="e.g., TH, MY, SG"
                  value={filters.country}
                  onChange={(e) => handleFilterChange('country', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                                 <Input
                   type="date"
                   value={filters.from_date}
                   onChange={(e) => handleFilterChange('from_date', e.target.value)}
                 />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                                 <Input
                   type="date"
                   value={filters.to_date}
                   onChange={(e) => handleFilterChange('to_date', e.target.value)}
                 />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Order Status</label>
                <Select
                  value={filters.order_status}
                  onChange={(value) => handleFilterChange('order_status', value)}
                  options={orderStatusOptions}
                  placeholder="Order Status"
                />
              </div>
            </div>
          </Card>
        )}

        {/* Results Summary */}
        {!loading && (
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-4">
              <span>Showing {orders.length} of {pagination.total} orders</span>
              {activeFiltersCount > 0 && (
                <Badge variant="info">{activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''} applied</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span>Page {pagination.page} of {pagination.total_pages}</span>
            </div>
          </div>
        )}

        {/* Enhanced Orders Table */}
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <tr>
                <TableHeaderCell>Order Details</TableHeaderCell>
                <TableHeaderCell>Current Milestone</TableHeaderCell>
                <TableHeaderCell>Next Milestone</TableHeaderCell>
                <TableHeaderCell>SLA Status</TableHeaderCell>
                <TableHeaderCell>Fulfilment Status</TableHeaderCell>
                <TableHeaderCell>Timeline</TableHeaderCell>
                <TableHeaderCell>Brand & Country</TableHeaderCell>
              </tr>
            </TableHeader>
            <TableBody>
              {loading ? (
                // Enhanced Loading Skeleton
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell className="text-center py-12 text-gray-500" colSpan={7}>
                    <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <div className="text-lg font-medium mb-2">No orders found</div>
                    <div className="text-sm">Try adjusting your search criteria or filters</div>
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => {
                  // Helper function to get next milestone
                  const getNextMilestone = (currentStage: string) => {
                    switch(currentStage) {
                      case 'Not Processed':
                        return 'Order not confirmed';
                      case 'Processed':
                        return 'Shipped';
                      case 'Shipped':
                        return 'Delivered';
                      case 'Delivered':
                        return 'N/A';
                      default:
                        return 'N/A';
                    }
                  };

                  // Helper function to get timeline with pending delay information
                  const getTimelineDisplay = (order: typeof orders[0]): string[] => {
                    const timeline: string[] = [];
                    const now = new Date();
                    
                    // Helper to calculate time difference and format
                    const formatTimeDiff = (start: Date, end: Date) => {
                      const diffMs = end.getTime() - start.getTime();
                      const diffMins = Math.floor(diffMs / (1000 * 60));
                      
                      if (diffMins < 60) {
                        return `${diffMins}m`;
                      } else if (diffMins < 1440) {
                        const hours = Math.floor(diffMins / 60);
                        const mins = diffMins % 60;
                        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
                      } else {
                        const days = Math.floor(diffMins / 1440);
                        const hours = Math.floor((diffMins % 1440) / 60);
                        return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
                      }
                    };

                    // Add processed milestone if exists
                    if (order.processed_time) {
                      const processedDate = new Date(order.processed_time);
                      
                      // Check if currently pending in processed stage
                      let pendingInfo = '';
                      if (order.current_stage === 'Processed' && !order.shipped_time) {
                        const pendingTime = formatTimeDiff(processedDate, now);
                        pendingInfo = ` (${pendingTime} pending)`;
                      }
                      
                      timeline.push(`Processed: ${format(processedDate, 'MMM dd, yyyy HH:mm')}${pendingInfo}`);
                    }
                    
                    // Add shipped milestone if exists
                    if (order.shipped_time) {
                      const shippedDate = new Date(order.shipped_time);
                      
                      // Check if currently pending in shipped stage
                      let pendingInfo = '';
                      if (order.current_stage === 'Shipped' && !order.delivered_time) {
                        const pendingTime = formatTimeDiff(shippedDate, now);
                        pendingInfo = ` (${pendingTime} pending)`;
                      }
                      
                      timeline.push(`Shipped: ${format(shippedDate, 'MMM dd, yyyy HH:mm')}${pendingInfo}`);
                    }
                    
                    // Add delivered milestone if exists
                    if (order.delivered_time) {
                      const deliveredDate = new Date(order.delivered_time);
                      timeline.push(`Delivered: ${format(deliveredDate, 'MMM dd, yyyy HH:mm')}`);
                    }
                    
                    return timeline.length > 0 ? timeline : ['N/A'];
                  };

                  return (
                    <TableRow key={order.order_no}>
                      {/* Order Details */}
                      <TableCell>
                        <div>
                          <div className="font-semibold text-gray-900">{order.order_no}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {format(new Date(order.order_date), 'MMM dd, yyyy, HH:mm a')}
                          </div>
                        </div>
                      </TableCell>

                      {/* Current Milestone */}
                      <TableCell>
                        {getStageBadge(order.current_stage)}
                      </TableCell>

                      {/* Next Milestone */}
                      <TableCell>
                        <div className="text-sm text-gray-600">
                          {getNextMilestone(order.current_stage)}
                        </div>
                      </TableCell>

                      {/* SLA Status */}
                      <TableCell>
                        {order.current_stage === 'Not Processed' ? (
                          <span className="text-sm text-gray-500">N/A</span>
                        ) : (
                          getSLABadge(order.sla_status)
                        )}
                      </TableCell>

                      {/* Fulfilment Status */}
                      <TableCell>
                        {getFulfilmentBadge(order)}
                      </TableCell>

                      {/* Timeline */}
                      <TableCell>
                        <div className="space-y-1 text-xs">
                          {getTimelineDisplay(order).map((line, index) => {
                            // Check if line contains pending information
                            const hasPending = line.includes('pending');
                            if (hasPending) {
                              // Split the line to highlight pending part in orange
                              const parts = line.split('(');
                              if (parts.length === 2) {
                                return (
                                  <div key={index} className="text-gray-600">
                                    {parts[0]}
                                    <span className="text-orange-600 font-medium">({parts[1]}</span>
                                  </div>
                                );
                              }
                            }
                            return (
                              <div key={index} className="text-gray-600">
                                {line}
                              </div>
                            );
                          })}
                        </div>
                      </TableCell>

                      {/* Brand & Country */}
                      <TableCell>
                        <div>
                          <div className="font-medium text-gray-900">{order.brand_name?.replace("'s", "'s") || 'N/A'}</div>
                          <Badge variant="gray" size="sm">{order.country_code}</Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Enhanced Pagination */}
        {!loading && pagination.total_pages > 1 && (
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {(pagination.page - 1) * pagination.limit + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} orders
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                >
                  Previous
                </Button>
                
                {/* Page Numbers */}
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, pagination.total_pages) }, (_, i) => {
                    const page = Math.max(1, pagination.page - 2) + i
                    if (page > pagination.total_pages) return null
                    
                    return (
                      <Button
                        key={page}
                        variant={page === pagination.page ? "primary" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(page)}
                        className="w-10"
                      >
                        {page}
                      </Button>
                    )
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.total_pages}
                >
                  Next
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

export default function OrdersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading orders...</p>
        </div>
      </div>
    }>
      <OrdersContent />
    </Suspense>
  )
} 