"use client"

import React, { useState, useEffect, Suspense, useMemo } from "react"
import { format } from "date-fns"
import { Download, ArrowLeft, Filter, Package, Moon, Sun, Loader2 } from "lucide-react"
import Link from "next/link"
import { useTheme } from 'next-themes'
import { useSearchParams } from "next/navigation"
import { OrderDetailsModal } from '@/components/orders/order-details-modal'
import { getBasePath } from "@/lib/utils"
import ProtectedRoute from '@/components/auth/protected-route'

// Helper function to format local time string for display
const formatLocalTime = (localTimeString: string | null | undefined, utcTime: string | Date | null | undefined) => {
  if (localTimeString) {
    try {
      const match = localTimeString.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) \((\w+)\)$/);
      if (match) {
        const [, datePart, timePart] = match;
        const date = new Date(`${datePart}T${timePart}`);
        return format(date, 'yyyy-MM-dd HH:mm');
      }
      return localTimeString;
    } catch {
      // Fallback to UTC if local time parsing fails
      return utcTime ? format(new Date(utcTime), 'yyyy-MM-dd HH:mm') : '';
    }
  }
  return utcTime ? format(new Date(utcTime), 'yyyy-MM-dd HH:mm') : '';
}

// Helper function for readable timeline format
const formatLocalTimeReadable = (localTimeString: string | null | undefined, utcTime: string | Date | null | undefined) => {
  if (localTimeString) {
    try {
      const match = localTimeString.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) \((\w+)\)$/);
      if (match) {
        const [, datePart, timePart, timezone] = match;
        const date = new Date(`${datePart}T${timePart}`);
        return `${format(date, 'MMM dd, yyyy HH:mm')} (${timezone})`;
      }
      return localTimeString;
    } catch {
      // Fallback to UTC if local time parsing fails
      return utcTime ? format(new Date(utcTime), 'MMM dd, yyyy HH:mm') : '';
    }
  }
  return utcTime ? format(new Date(utcTime), 'MMM dd, yyyy HH:mm') : '';
}

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
    primary: "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white border-transparent",
    secondary: "bg-gray-600 hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600 text-white border-transparent",
    outline: "bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600",
    ghost: "bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 border-transparent",
    danger: "bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white border-transparent"
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
    success: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-700",
    warning: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700",
    danger: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-700",
    info: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-700",
    purple: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-700",
    gray: "bg-gray-100 dark:bg-gray-700/30 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600"
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

// Updated Card component to match dashboard styling
const Card = ({ 
  children, 
  className = "" 
}: { 
  children: React.ReactNode; 
  className?: string;
}) => (
  <div className={`bg-white/60 dark:bg-zinc-950/60 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm ${className}`}>
    {children}
  </div>
);

// Enhanced Table Components
const Table = ({ children }: { children: React.ReactNode }) => (
  <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-zinc-950/50 backdrop-blur-sm">
        {children}
      </table>
    </div>
  </div>
);

const TableHeader = ({ children }: { children: React.ReactNode }) => (
  <thead className="bg-gray-50 dark:bg-gray-900/50">
    {children}
  </thead>
);

const TableHeaderCell = ({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
  <th 
    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:bg-gray-100 dark:hover:bg-zinc-950/50 ${className}`}
    onClick={onClick}
  >
    {children}
  </th>
);

const TableBody = ({ children }: { children: React.ReactNode }) => (
  <tbody className="bg-white dark:bg-zinc-950/50 divide-y divide-gray-200 dark:divide-gray-700">
    {children}
  </tbody>
);

const TableRow = ({ children, className = "", onClick }: { 
  children: React.ReactNode; 
  className?: string;
  onClick?: () => void;
}) => (
  <tr className={`hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors ${className}`} onClick={onClick}>
    {children}
  </tr>
);

const TableCell = ({ children, className = "", colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) => (
  <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 ${className}`} colSpan={colSpan}>
    {children}
  </td>
);

// Enhanced Order Interface
interface Order {
  order_no: string
  order_status: string
  shipping_status: string
  confirmation_status: string
  order_date: Date | string
  order_date_local?: string | null
  processed_time?: Date | string | null
  processed_time_local?: string | null
  shipped_time?: Date | string | null
  shipped_time_local?: string | null
  delivered_time?: Date | string | null
  delivered_time_local?: string | null
  processed_tat?: string | null
  shipped_tat?: string | null
  delivered_tat?: string | null
  brand_name: string
  country_code: string
  current_stage: string
  sla_status: string
    breach_severity?: 'None' | 'Urgent' | 'Critical'
  pending_status: string
  pending_hours: number
  config_processed_tat?: string | null
  config_shipped_tat?: string | null
  config_delivered_tat?: string | null
}

// Sort configuration interface
interface SortConfig {
  key: 'order_date' | 'timeline_priority';
  direction: 'asc' | 'desc';
}

// Filter State Interface  
interface FilterState {
  search: string
  sla_status: string
  stage: string
  pending_status: string
  fulfilment_status: string  // Changed from action_status to fulfilment_status
  brand: string
  country: string
  from_date: string
  to_date: string
  order_status: string
}

// Helper function to calculate actionable status - REMOVED since we're not using Action Status anymore


interface OrdersResponse {
  orders: Order[]
  total: number
  page: number
  limit: number
  total_pages: number
}

function OrdersContent() {
  const searchParams = useSearchParams()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [exportLoading, setExportLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const [filtersCleared, setFiltersCleared] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Order details modal state
  const [selectedOrderNo, setSelectedOrderNo] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'order_date',
    direction: 'desc'
  })
  
  // Enhanced Filter State - Initialize from URL parameters
  const [filters, setFilters] = useState<FilterState>(() => {
    // Parse URL parameters to initialize filters
    const urlParams = new URLSearchParams(searchParams.toString())
    const severity = urlParams.get('severity') || ''
    
    return {
      search: urlParams.get('search') || "",
      sla_status: severity || urlParams.get('sla_status') || '',
      stage: urlParams.get('stage') || '',
      pending_status: urlParams.get('pending_status') || '',
      fulfilment_status: urlParams.get('fulfilment_status') || '',
      brand: urlParams.get('brand') || '',
      country: urlParams.get('country') || '',
      from_date: urlParams.get('from_date') || '',
      to_date: urlParams.get('to_date') || '',
      order_status: urlParams.get('order_status') || ''
    }
  })
  
  // Get kpi_mode from URL parameters
  const kpiMode = searchParams.get('kpi_mode') === 'true'
  
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    total_pages: 0,
    limit: 20
  })

  // Page size options for dropdown
  const pageSizeOptions = [
    { value: 20, label: '20 per page' },
    { value: 50, label: '50 per page' },
    { value: 100, label: '100 per page' }
  ]

  // Filter Options State (like dashboard)
  const [filterOptions, setFilterOptions] = useState<{
    brands: Array<{ code: string; name: string }>;
    brandCountries: Record<string, Array<{ code: string; name: string }>>;
  }>({
    brands: [],
    brandCountries: {}
  })
  const [loadingFilterOptions, setLoadingFilterOptions] = useState(true)
  const basePath = getBasePath();

  // Get available countries for the selected brand
  const availableCountries = useMemo(() => {
    return filters.brand && filterOptions.brandCountries[filters.brand] 
      ? filterOptions.brandCountries[filters.brand] 
      : []
  }, [filters.brand, filterOptions.brandCountries])

  // Update filters when URL parameters change
  useEffect(() => {
    const urlParams = new URLSearchParams(searchParams.toString())
    const severity = urlParams.get('severity') || ''
    
    setFilters(prev => ({
      ...prev,
      // Map severity (Urgent/Critical) to sla_status on load
      sla_status: severity || urlParams.get('sla_status') || prev.sla_status,
      stage: urlParams.get('stage') || prev.stage,
      pending_status: urlParams.get('pending_status') || prev.pending_status,
      fulfilment_status: urlParams.get('fulfilment_status') || prev.fulfilment_status,
      brand: urlParams.get('brand') || prev.brand,
      country: urlParams.get('country') || prev.country,
      from_date: urlParams.get('from_date') || prev.from_date,
      to_date: urlParams.get('to_date') || prev.to_date,
      order_status: urlParams.get('order_status') || prev.order_status
    }))
  }, [searchParams])

  // Fetch filter options from dashboard API
  const fetchFilterOptions = async () => {
    setLoadingFilterOptions(true)
    try {
      const response = await fetch(`${basePath}/api/v1/dashboard/filters/`)
      if (!response.ok) {
        console.warn(`Filter options API returned ${response.status}, using fallback`)
      }
      
      const data = await response.json()
      setFilterOptions({
        brands: data.brands || [],
        brandCountries: data.brandCountries || {}
      })
    } catch (err) {
      console.error('Error fetching filter options:', err)
      // Set fallback options if API fails
      setFilterOptions({
        brands: [
          { code: 'vs', name: "Victoria's Secret" },
          { code: 'bbw', name: 'Bath & Body Works' }
        ],
        brandCountries: {
          'vs': [
            { code: 'MY', name: 'Malaysia' },
            { code: 'SG', name: 'Singapore' }
          ],
          'bbw': [
            { code: 'MY', name: 'Malaysia' },
            { code: 'SG', name: 'Singapore' }
          ]
        }
      })
    } finally {
      setLoadingFilterOptions(false)
    }
  }

  // Fetch filter options on mount
  useEffect(() => {
    fetchFilterOptions()
  }, [])

  // Filter Options
  const slaStatusOptions = [
    { value: "On Time", label: "On Time" },
    { value: "At Risk", label: "At Risk" },
    { value: "Breached", label: "Breached" },
    { value: "Urgent", label: "Urgent" },
    { value: "Critical", label: "Critical" }
  ]

  const stageOptions = [
    { value: "Not Processed", label: "Not Synced to OMS" },
    { value: "Processed", label: "OMS Synced" },
    { value: "Shipped", label: "Shipped" },
    { value: "Delivered", label: "Delivered" }
  ]

  // pending status options
  // const pendingStatusOptions = [
  //   { value: "pending", label: "🚨 Action Required (Overdue)" },
  //   { value: "normal", label: "✅ On Track (Within Thresholds)" }
  // ]

  // Fulfilment Status Options
  const fulfilmentStatusOptions = [
    { value: "fulfilled", label: "Fulfilled" },
    { value: "not_fulfilled", label: "Not Fulfilled" }
  ]

  const fetchOrders = async (currentFilters: FilterState, page: number = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        confirmation_status: 'CONFIRMED' // Only show confirmed orders
      })
      
      // Add limit parameter
      params.append('limit', pagination.limit.toString())
      
      if (currentFilters.search) params.append('order_no', currentFilters.search)
      // If user selects Urgent/Critical, pass it via dedicated severity param for server-side filtering across pages
      const isSeverityFilter = currentFilters.sla_status === 'Urgent' || currentFilters.sla_status === 'Critical'
      if (currentFilters.sla_status) {
        if (isSeverityFilter) {
          params.append('severity', currentFilters.sla_status)
        } else {
          params.append('sla_status', currentFilters.sla_status)
        }
      }
      
      // Handle stage filtering based on fulfilment_status
      let stageFilter = currentFilters.stage
      if (currentFilters.fulfilment_status === 'fulfilled') {
        stageFilter = 'Delivered'
      } else if (currentFilters.fulfilment_status === 'not_fulfilled') {
        // For not fulfilled, we want to exclude delivered orders
        // We'll handle this client-side since API doesn't support "NOT" filters
        stageFilter = currentFilters.stage
      }
      
      if (stageFilter) params.append('stage', stageFilter)
      if (currentFilters.pending_status) params.append('pending_status', currentFilters.pending_status)
      if (currentFilters.brand) params.append('brand', currentFilters.brand)
      if (currentFilters.country) params.append('country', currentFilters.country)
      if (currentFilters.from_date) params.append('from_date', currentFilters.from_date)
      if (currentFilters.to_date) params.append('to_date', currentFilters.to_date)
      if (currentFilters.order_status) params.append('order_status', currentFilters.order_status)
      
      // Add kpi_mode parameter if coming from KPI cards
      if (kpiMode) params.append('kpi_mode', 'true')


      const response = await fetch(`${basePath}/api/v1/orders?${params}`)
      if (!response.ok) throw new Error('Failed to fetch orders')
      
      const data: OrdersResponse = await response.json()
      let filteredOrders = data.orders
      
      // Apply client-side fulfilment_status filtering for "not_fulfilled"
      if (currentFilters.fulfilment_status === 'not_fulfilled') {
        filteredOrders = data.orders.filter(order => order.current_stage !== 'Delivered')
      }
      
      setOrders(filteredOrders)
      setPagination(prev => ({
        ...prev,
        total: currentFilters.fulfilment_status === 'not_fulfilled' ? filteredOrders.length : data.total,
        page: data.page,
        total_pages: currentFilters.fulfilment_status === 'not_fulfilled' ? Math.ceil(filteredOrders.length / pagination.limit) : data.total_pages,
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
  }, [filters, pagination.page, pagination.limit])

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPagination(prev => ({ ...prev, page: 1 })) // Reset to first page
    setFiltersCleared(false)
  }

  const clearFilters = () => {
    setFilters(prev => ({
      search: "",
      sla_status: "",
      stage: "",
      pending_status: "",
      fulfilment_status: "",
      brand: prev.brand,
      country: prev.country,
      from_date: "",
      to_date: "",
      order_status: ""
    }))
    setPagination(prev => ({ ...prev, page: 1 }))
    setFiltersCleared(true)
  }

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }))
  }

  const handlePageSizeChange = (newLimit: number) => {
    setPagination(prev => ({ 
      ...prev, 
      limit: newLimit,
      page: 1 // Reset to first page when changing page size
    }))
  }

  const handleOrderClick = (orderNo: string) => {
    setSelectedOrderNo(orderNo)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedOrderNo(null)
  }

  // New function to calculate stage analysis for all milestones
  const calculateStageAnalysis = (order: Order) => {
    // Use local time strings for accurate timezone-aware calculations
    const getCurrentTimeInTimezone = (countryCode: string) => {
      const timezoneMap: Record<string, string> = {
        'MY': 'Asia/Kuala_Lumpur',
        'SG': 'Asia/Singapore', 
        'TH': 'Asia/Bangkok',
        'ID': 'Asia/Jakarta',
        'PH': 'Asia/Manila',
        'HK': 'Asia/Hong_Kong',
        'AU': 'Australia/Sydney',
        'NZ': 'Pacific/Auckland',
        'VN': 'Asia/Ho_Chi_Minh'
      };
      const timezone = timezoneMap[countryCode] || 'Asia/Hong_Kong';
      return new Date().toLocaleString('sv-SE', { timeZone: timezone, hour12: false });
    };
    
    // Parse local time string to Date object
    const parseLocalTimeString = (localTimeString: string | null | undefined): Date | null => {
      if (!localTimeString) return null;
      const cleanTime = localTimeString.replace(/\s*\([^)]+\)$/, '');
      return new Date(cleanTime.replace(' ', 'T'));
    };
    
    const orderDateLocal = parseLocalTimeString(order.order_date_local) || new Date(order.order_date);
    const currentTimeString = getCurrentTimeInTimezone(order.country_code);
    const now = new Date(currentTimeString.replace(' ', 'T'));
    
    // Helper function to format minutes to readable time
    const formatMinutesToTime = (minutes: number): string => {
      if (minutes < 60) return `${minutes}m`;
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (hours < 24) {
        return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
      }
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      if (remainingHours > 0) {
        return `${days}d ${remainingHours}h`;
      }
      return `${days}d`;
    };

    // Helper function to parse TAT string to minutes
    const parseTATToMinutes = (tat: string): number => {
      let totalMinutes = 0;
      
      // Extract days
      const dayMatch = tat.match(/(\d+)d/);
      if (dayMatch) {
        totalMinutes += parseInt(dayMatch[1]) * 24 * 60;
      }
      
      // Extract hours
      const hourMatch = tat.match(/(\d+)h/);
      if (hourMatch) {
        totalMinutes += parseInt(hourMatch[1]) * 60;
      }
      
      // Extract minutes
      const minuteMatch = tat.match(/(\d+)m/);
      if (minuteMatch) {
        totalMinutes += parseInt(minuteMatch[1]);
      }
      
      return totalMinutes;
    };

    // Helper function to calculate time difference in minutes
    const getTimeDifferenceMinutes = (start: Date, end: Date): number => {
      return Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
    };

    const stages = [];

    // Processing Stage Analysis
    const processedSLAMinutes = parseTATToMinutes(order.config_processed_tat || order.processed_tat || '2h');
    
    if (order.processed_time) {
      // Order has been processed - check if it was on time
      const processedTimeLocal = parseLocalTimeString(order.processed_time_local) || new Date(order.processed_time);
      const actualProcessingMinutes = getTimeDifferenceMinutes(orderDateLocal, processedTimeLocal);
      let status: 'On Time' | 'At Risk' | 'Breached';
      let exceededBy: string | null = null;
      
      if (actualProcessingMinutes > processedSLAMinutes) {
        status = 'Breached';
        exceededBy = formatMinutesToTime(actualProcessingMinutes - processedSLAMinutes);
      } else {
        status = 'On Time';
      }

      stages.push({
        stage: 'OMS Sync',
        status,
        actual_time: formatMinutesToTime(actualProcessingMinutes),
        exceeded_by: exceededBy,
        isCompleted: true
      });
    } else {
      // Order hasn't been processed yet - check if it should have been
      const timeSinceOrder = getTimeDifferenceMinutes(orderDateLocal, now);
      let status: 'On Time' | 'At Risk' | 'Breached';
      let exceededBy: string | null = null;
      
      if (timeSinceOrder > processedSLAMinutes) {
        status = 'Breached';
        exceededBy = formatMinutesToTime(timeSinceOrder - processedSLAMinutes);
      } else {
        status = 'On Time';
      }

      stages.push({
        stage: 'OMS Sync',
        status,
        actual_time: `${formatMinutesToTime(timeSinceOrder)} elapsed`,
        exceeded_by: exceededBy,
        isCompleted: false
      });
    }

    // Shipping Stage Analysis
    const shippedSLAMinutes = parseTATToMinutes(order.config_shipped_tat || order.shipped_tat || '2d');
    
    if (order.shipped_time) {
      // Order has been shipped - check if it was on time (total time from order placement)
      const shippedTimeLocal = parseLocalTimeString(order.shipped_time_local) || new Date(order.shipped_time);
      const actualShippingMinutes = getTimeDifferenceMinutes(orderDateLocal, shippedTimeLocal);
      let status: 'On Time' | 'At Risk' | 'Breached';
      let exceededBy: string | null = null;
      
      if (actualShippingMinutes > shippedSLAMinutes) {
        status = 'Breached';
        exceededBy = formatMinutesToTime(actualShippingMinutes - shippedSLAMinutes);
      } else {
        status = 'On Time';
      }

      stages.push({
        stage: 'Shipping',
        status,
        actual_time: formatMinutesToTime(actualShippingMinutes),
        exceeded_by: exceededBy,
        isCompleted: true
      });
    } else if (order.processed_time) {
      // Order processed but not shipped yet - check current status
      const timeSinceOrder = getTimeDifferenceMinutes(orderDateLocal, now);
      let status: 'On Time' | 'At Risk' | 'Breached';
      let exceededBy: string | null = null;
      
      if (timeSinceOrder > shippedSLAMinutes) {
        status = 'Breached';
        exceededBy = formatMinutesToTime(timeSinceOrder - shippedSLAMinutes);
      } else {
        status = 'On Time';
      }

      stages.push({
        stage: 'Shipping',
        status,
        actual_time: `${formatMinutesToTime(timeSinceOrder)} elapsed`,
        exceeded_by: exceededBy,
        isCompleted: false
      });
    } else {
      stages.push({
        stage: 'Shipping',
        status: 'N/A',
        actual_time: null,
        exceeded_by: null,
        isCompleted: false
      });
    }

    // Delivery Stage Analysis
    const deliveredSLAMinutes = parseTATToMinutes(order.config_delivered_tat || order.delivered_tat || '7d');
    
    if (order.delivered_time) {
      // Order has been delivered - check if it was on time (total time from order placement)
      const deliveredTimeLocal = parseLocalTimeString(order.delivered_time_local) || new Date(order.delivered_time);
      const actualDeliveryMinutes = getTimeDifferenceMinutes(orderDateLocal, deliveredTimeLocal);
      let status: 'On Time' | 'At Risk' | 'Breached';
      let exceededBy: string | null = null;
      
      if (actualDeliveryMinutes > deliveredSLAMinutes) {
        status = 'Breached';
        exceededBy = formatMinutesToTime(actualDeliveryMinutes - deliveredSLAMinutes);
      } else {
        status = 'On Time';
      }

      stages.push({
        stage: 'Delivery',
        status,
        actual_time: formatMinutesToTime(actualDeliveryMinutes),
        exceeded_by: exceededBy,
        isCompleted: true
      });
    } else if (order.shipped_time) {
      // Order shipped but not delivered yet - check current status
      const timeSinceOrder = getTimeDifferenceMinutes(orderDateLocal, now);
      let status: 'On Time' | 'At Risk' | 'Breached';
      let exceededBy: string | null = null;
      
      if (timeSinceOrder > deliveredSLAMinutes) {
        status = 'Breached';
        exceededBy = formatMinutesToTime(timeSinceOrder - deliveredSLAMinutes);
      } else {
        status = 'On Time';
      }

      stages.push({
        stage: 'Delivery',
        status,
        actual_time: `${formatMinutesToTime(timeSinceOrder)} elapsed`,
        exceeded_by: exceededBy,
        isCompleted: false
      });
    } else {
      stages.push({
        stage: 'Delivery',
        status: 'N/A',
        actual_time: null,
        exceeded_by: null,
        isCompleted: false
      });
    }

    return stages;
  };

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
      'Not Synced to OMS': { variant: 'gray' as const },
      'OMS Synced': { variant: 'info' as const },
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

  // Helper function to calculate actionable status for SLA display
  const getActionableStatus = (order: Order): string => {
    // Always fulfilled if delivered
    if (order.current_stage === 'Delivered') {
      return 'Fulfilled';
    }
    
    // Check for action required (pending beyond thresholds)
    if (order.pending_status === 'pending') {
      switch (order.current_stage) {
        case 'Not Synced to OMS':
          return 'Action Required - Syncing to OMS Overdue';
        case 'OMS Synced':
          return 'Action Required - Shipping Overdue';
        case 'Shipped':
          return 'Action Required - Delivery Overdue';
        default:
          return 'Action Required';
      }
    }
    
    // Check for at-risk orders (approaching SLA breach)
    if (order.sla_status === 'At Risk') {
      switch (order.current_stage) {
        case 'Not Synced to OMS':
          return 'At Risk - OMS Sync';
        case 'OMS Synced':
          return 'At Risk - Shipping';
        case 'Shipped':
          return 'At Risk - Delivery';
        default:
          return 'At Risk';
      }
    }
    
    // Check for already breached orders
    if (order.sla_status === 'Breached') {
      switch (order.current_stage) {
        case 'Not Synced to OMS':
          return 'Breached - Syncing to OMS';
        case 'OMS Synced':
          return 'Breached - Shipping';
        case 'Shipped':
          return 'Breached - Delivery';
        default:
          return 'Breached';
      }
    }
    
    // Everything else is on track
    return 'On Track';
  };

  // Enhanced SLA Badge that shows only traditional SLA status
  const getEnhancedSLABadge = (order: typeof orders[0]) => {
      if (order.current_stage === 'Not Synced to OMS') {
      return <span className="text-sm text-gray-500">N/A</span>;
    }

    // Just show traditional SLA status
    return (
      <div className="flex items-center gap-2">
        {getSLABadge(order.sla_status)}
        {order.breach_severity === 'Critical' && (
          <Badge variant="danger" size="sm">Critical</Badge>
        )}
        {order.breach_severity === 'Urgent' && (
          <Badge variant="purple" size="sm">Urgent</Badge>
        )}
      </div>
    );
  }

  // Enhanced Fulfilment Badge that shows both fulfilment status and pending information
  const getEnhancedFulfilmentBadge = (order: typeof orders[0]) => {
    const isOverdue = order.pending_status === 'pending';
    const actionStatus = getActionableStatus(order);
    
    return (
      <div className="space-y-1">
        {/* Traditional Fulfilment Status */}
        <div>
          {getFulfilmentBadge(order)}
        </div>
        
        {/* Pending Information - Only show if overdue */}
        {isOverdue && (
          <div className="text-xs">
            {actionStatus.includes('Action Required') ? (
              <Badge variant="danger" size="sm">🚨 {actionStatus.replace('Action Required - ', '')}</Badge>
            ) : actionStatus.includes('Breached') ? (
              <Badge variant="danger" size="sm">🔴 {actionStatus.replace('Breached - ', '')}</Badge>
            ) : actionStatus.includes('At Risk') ? (
              <Badge variant="warning" size="sm">⚠️ {actionStatus.replace('At Risk - ', '')}</Badge>
            ) : (
              <span className="text-red-600 text-xs font-medium">Overdue</span>
            )}
          </div>
        )}
      </div>
    );
  }

  const exportToCSV = async () => {
    setExportLoading(true)
    try {
      // Fetch all orders using export-limit
      const params = new URLSearchParams({
        'export-limit': '10000',
      })
      
      // Apply same filters as current view
      if (filters.search) params.append('order_no', filters.search)
      const isSeverityFilter = filters.sla_status === 'Urgent' || filters.sla_status === 'Critical'
      if (filters.sla_status) {
        if (isSeverityFilter) {
          params.append('severity', filters.sla_status)
        } else {
          params.append('sla_status', filters.sla_status)
        }
      }
      
      let stageFilter = filters.stage
      if (filters.fulfilment_status === 'fulfilled') {
        stageFilter = 'Delivered'
      } else if (filters.fulfilment_status === 'not_fulfilled') {
        stageFilter = filters.stage
      }
      
      if (stageFilter) params.append('stage', stageFilter)
      if (filters.pending_status) params.append('pending_status', filters.pending_status)
      if (filters.brand) params.append('brand', filters.brand)
      if (filters.country) params.append('country', filters.country)
      if (filters.from_date) params.append('from_date', filters.from_date)
      if (filters.to_date) params.append('to_date', filters.to_date)
      if (filters.order_status) params.append('order_status', filters.order_status)
      
      if (kpiMode) params.append('kpi_mode', 'true')

      const exportUrl = `${basePath}/api/v1/orders?${params}`
      
      const response = await fetch(exportUrl)
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to fetch orders for export: ${response.status} ${errorText}`)
      }
      
      const data: OrdersResponse = await response.json()
      let exportOrders = data.orders
      
      if (filters.fulfilment_status === 'not_fulfilled') {
        exportOrders = data.orders.filter(order => order.current_stage !== 'Delivered')
      }

      const headers = [
        'Order No', 'Current Milestone', 'Next Milestone', 'SLA Status', 'Fulfilment Status', 'Brand', 'Country', 
        'Order Date', 'OMS Synced Time', 'Shipped Time', 'Delivered Time'
      ]

      const getNextMilestone = (currentStage: string) => {
        switch (currentStage) {
        case 'Not Synced to OMS':
          return 'OMS Synced'
        case 'OMS Synced':
          return 'Shipped'
        case 'Shipped':
          return 'Delivered'
        default:
          return 'N/A'
        }
      }

      const csvData = exportOrders.map(order => [
        order.order_no,
        order.current_stage,
        getNextMilestone(order.current_stage),
        order.sla_status,
        order.current_stage === 'Delivered' ? 'Fulfilled' : 'Not Fulfilled',
        order.brand_name,
        order.country_code,
        formatLocalTime(order.order_date_local, order.order_date),
        formatLocalTime(order.processed_time_local, order.processed_time),
        formatLocalTime(order.shipped_time_local, order.shipped_time),
        formatLocalTime(order.delivered_time_local, order.delivered_time)
      ])

      const csvContent = [headers, ...csvData]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const fileName = `orders-${filters.brand}-${filters.country}-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`
      a.download = fileName
      a.click()
      window.URL.revokeObjectURL(url)
      
      console.log('Export: Successfully exported', exportOrders.length, 'orders to', fileName)
    } catch (error) {
      console.error('Error exporting orders:', error)
      alert('Failed to export orders. Please try again.')
    } finally {
      setExportLoading(false)
    }
  }

  const activeFiltersCount = Object.entries(filters).filter(([key, value]) => 
    key !== 'search' && value !== ''
  ).length

  // Sorting functions
  const handleSort = (key: SortConfig['key']) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const sortOrders = (ordersToSort: Order[]) => {
    return [...ordersToSort].sort((a, b) => {
      if (sortConfig.key === 'order_date') {
        const aValue = new Date(a.order_date).getTime()
        const bValue = new Date(b.order_date).getTime()
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1
        }
        return 0
      }
      
      // Timeline priority sorting
      if (sortConfig.key === 'timeline_priority') {
        const aAnalysis = calculateStageAnalysis(a)
        const bAnalysis = calculateStageAnalysis(b)
        
        // Get the highest priority stage for each order
        const getPriorityScore = (analysis: ReturnType<typeof calculateStageAnalysis>) => {
          let maxScore = 0
          analysis.forEach(stage => {
            if (stage.status === 'Breached') {
              // Breached orders get highest priority (score 100 + exceeded minutes)
              const exceededMinutes = stage.exceeded_by ? 
                parseInt(stage.exceeded_by.replace(/[^0-9]/g, '')) : 0
              maxScore = Math.max(maxScore, 100 + exceededMinutes)
            } else if (stage.status === 'At Risk') {
              // At risk orders get medium priority (score 50)
              maxScore = Math.max(maxScore, 50)
            } else if (stage.actual_time && stage.actual_time.includes('pending')) {
              // Pending orders get low priority (score 25 + pending hours)
              const pendingHours = stage.actual_time.includes('d') ? 
                parseInt(stage.actual_time.split('d')[0]) * 24 : 
                stage.actual_time.includes('h') ? 
                parseInt(stage.actual_time.split('h')[0]) : 0
              maxScore = Math.max(maxScore, 25 + pendingHours)
            }
          })
          return maxScore
        }
        
        const aScore = getPriorityScore(aAnalysis)
        const bScore = getPriorityScore(bAnalysis)
        
        if (aScore < bScore) {
          return sortConfig.direction === 'asc' ? -1 : 1
        }
        if (aScore > bScore) {
          return sortConfig.direction === 'asc' ? 1 : -1
        }
        return 0
      }
      
      return 0
    })
  }

  const getSortIcon = (key: SortConfig['key']) => {
    if (sortConfig.key !== key) {
      return <span className="text-gray-400 text-xs">↕</span>
    }
    return sortConfig.direction === 'asc' ? 
      <span className="text-blue-600 text-xs font-bold">↑</span> : 
      <span className="text-blue-600 text-xs font-bold">↓</span>
  }
  
  // Generate dynamic title and subtitle based on selected filters
  const getDynamicTitle = () => {
    // Generate title and subtitle based on filters
    if (filters.brand && filters.country) {
      return {
        title: `${filters.brand.toUpperCase()} • ${filters.country.toUpperCase()}`,
        subtitle: 'Orders Management'
      }
    }
    
    if (filters.brand) {
      return {
        title: `${filters.brand.toUpperCase()} Orders`,
        subtitle: 'Order Management & Tracking'
      }
    }
    
    if (filters.country) {
      return {
        title: `${filters.country.toUpperCase()} Operations`,
        subtitle: 'Orders Management'
      }
    }

    // Check for other active filters to create meaningful titles
    if (filters.sla_status) {
      return {
        title: `${filters.sla_status} Orders`,
        subtitle: 'SLA Performance Management'
      }
    }

    if (filters.stage) {
      return {
        title: `${filters.stage} Orders`,
        subtitle: 'Stage-Specific Management'
      }
    }

    if (filters.pending_status === 'pending') {
      return {
        title: 'Action Required Orders',
        subtitle: 'Overdue Order Management'
      }
    }

    if (filters.fulfilment_status === 'fulfilled') {
      return {
        title: 'Fulfilled Orders',
        subtitle: 'Completed Order Management'
      }
    }

    if (filters.fulfilment_status === 'not_fulfilled') {
      return {
        title: 'Pending Fulfilment',
        subtitle: 'Active Order Management'
      }
    }
    
    return {
      title: 'Orders Management',
      subtitle: 'Monitor and manage order processing'
    }
  }

  const { title, subtitle } = getDynamicTitle();
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-black dark:to-black p-6 transition-colors duration-200">
      <div className="mx-auto space-y-6 px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href={`/?${new URLSearchParams({
              ...(filters.brand && { brand: filters.brand }),
              ...(filters.country && { country: filters.country })
            }).toString()}`}>
              <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />}>
                Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                {subtitle}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {!loading && `${pagination.total} orders found`}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            
            {/* Export Button */}
            <button
              onClick={exportToCSV}
              disabled={exportLoading}
              className={`p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${orders.some(order => order.current_stage === 'Delivered') || activeFiltersCount === 0 || filtersCleared || orders.length === 0 ? 'hidden' : ''}`}
              aria-label={exportLoading ? "Exporting..." : "Export to CSV"}
            >
              {exportLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Download className="h-5 w-5" />
              )}
            </button>
            
            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="hidden p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md transition-all duration-200"
              aria-label="Toggle theme"
              suppressHydrationWarning
            >
              {mounted && theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

                 {/* Quick Search & Filters - Minimal Design like Dashboard */}
         <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
          <div className="flex items-center gap-3 text-sm flex-wrap">
            {/* Quick Date Filters */}
            {/* <div className="flex gap-1">
              <button
                onClick={() => {
                  const today = format(new Date(), 'yyyy-MM-dd')
                  setFilters(prev => ({ ...prev, from_date: today, to_date: today }))
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  filters.from_date === format(new Date(), 'yyyy-MM-dd') && filters.to_date === format(new Date(), 'yyyy-MM-dd')
                    ? 'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700' 
                    : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => {
                  const yesterday = format(new Date(Date.now() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
                  setFilters(prev => ({ ...prev, from_date: yesterday, to_date: yesterday }))
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  filters.from_date === format(new Date(Date.now() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd') && filters.to_date === format(new Date(Date.now() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
                    ? 'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700' 
                    : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                }`}
              >
                Yesterday
              </button>
              <button
                onClick={() => {
                  const lastWeekStart = format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
                  const today = format(new Date(), 'yyyy-MM-dd')
                  setFilters(prev => ({ ...prev, from_date: lastWeekStart, to_date: today }))
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  filters.from_date === format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd') && filters.to_date === format(new Date(), 'yyyy-MM-dd')
                    ? 'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700' 
                    : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                }`}
              >
                Last 7 Days
              </button>
            </div> */}

            {/* Date Inputs */}
            <div className="flex items-center gap-2">
              <label htmlFor="from_date" className="text-xs text-gray-600 dark:text-gray-300">From</label>
              <input
                id="from_date"
                type="date"
                value={filters.from_date}
                onChange={(e) => handleFilterChange('from_date', e.target.value)}
                className="px-2 py-1 text-xs border border-gray-200 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="to_date" className="text-xs text-gray-600 dark:text-gray-300">To</label>
              <input
                id="to_date"
                type="date"
                value={filters.to_date}
                onChange={(e) => handleFilterChange('to_date', e.target.value)}
                className="px-2 py-1 text-xs border border-gray-200 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            {/* Search */}
            <div className="flex items-center gap-2">
              <label htmlFor="search_orders" className="text-xs text-gray-600 dark:text-gray-300">Search By Order No</label>
              <input
                id="search_orders"
                type="text"
                placeholder="Search orders..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="px-2 py-1 text-xs border border-gray-200 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white placeholder-gray-400"
              />
            </div>

            {/* SLA Status */}
            <div className="flex items-center gap-2">
              <label htmlFor="sla_status" className="text-xs text-gray-600 dark:text-gray-300">SLA</label>
              <select
                id="sla_status"
                value={filters.sla_status}
                onChange={(e) => handleFilterChange('sla_status', e.target.value)}
                className="px-2 py-1 text-xs border border-gray-200 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">All SLA Status</option>
                {slaStatusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Stage */}
            <div className="flex items-center gap-2">
              <label htmlFor="stage" className="text-xs text-gray-600 dark:text-gray-300">Milestone</label>
              <select
                id="stage"
                value={filters.stage}
                onChange={(e) => handleFilterChange('stage', e.target.value)}
                className="px-2 py-1 text-xs border border-gray-200 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">All Stages</option>
                {stageOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Pending Status */}
            {/* <select
              value={filters.pending_status}
              onChange={(e) => handleFilterChange('pending_status', e.target.value)}
              className="px-2 py-1 text-xs border border-gray-200 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">All Status</option>
              {pendingStatusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select> */}

            {/* Advanced Filters Toggle */}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              icon={<Filter className="h-3 w-3" />}
              className="text-xs hidden"
            >
              Advanced {activeFiltersCount > 0 && `(${activeFiltersCount})`}
            </Button>

            {/* Clear Filters */}
            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm hidden">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Advanced Filters</h3>
              <button 
                onClick={clearFilters}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Clear All
              </button>
            </div>
            <div className="flex items-center gap-3 text-sm flex-wrap">
              {/* Brand Select */}
              <select
                value={filters.brand}
                onChange={(e) => handleFilterChange('brand', e.target.value)}
                disabled={loadingFilterOptions}
                className={`px-2 py-1 text-xs border border-gray-200 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white ${loadingFilterOptions ? "opacity-50" : ""}`}
              >
                <option value="">{loadingFilterOptions ? "Loading..." : "All Brands"}</option>
                {filterOptions.brands.map(brand => (
                  <option key={brand.code} value={brand.code}>
                    {brand.name}
                  </option>
                ))}
              </select>

              {/* Country Select */}
              <select
                value={filters.country}
                onChange={(e) => handleFilterChange('country', e.target.value)}
                disabled={loadingFilterOptions}
                className={`px-2 py-1 text-xs border border-gray-200 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white ${loadingFilterOptions ? "opacity-50" : ""}`}
              >
                <option value="">{loadingFilterOptions ? "Loading..." : "All Countries"}</option>
                {availableCountries.map(country => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>

              {/* Fulfilment Status */}
              <select
                value={filters.fulfilment_status}
                onChange={(e) => handleFilterChange('fulfilment_status', e.target.value)}
                className="px-2 py-1 text-xs border border-gray-200 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">All Fulfilment</option>
                {fulfilmentStatusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Results Summary */}
        {!loading && (
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-4">
              <span>Showing {orders.length} of {pagination.total} orders</span>
              {activeFiltersCount > 0 && (
                <Badge variant="info">{activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''} applied</Badge>
              )}
              <span className="flex items-center gap-1">
                Sorted by: 
                <span className="font-medium text-blue-600">
                  {sortConfig.key === 'order_date' ? 'Order Date' : 'Timeline Priority'} ({sortConfig.direction.toUpperCase()})
                </span>
              </span>
            </div>
            <div className="flex items-center gap-4">
              {/* Page Size Dropdown */}
              <div className="flex items-center gap-2">
                <label htmlFor="page-size" className="text-xs text-gray-600 dark:text-gray-300">Show:</label>
                <select
                  id="page-size"
                  value={pagination.limit}
                  onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
                  className="px-2 py-1 text-xs border border-gray-200 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  {pageSizeOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <span>Page {pagination.page} of {pagination.total_pages}</span>
            </div>
          </div>
        )}

        {/* Enhanced Orders Table */}
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <tr>
                <TableHeaderCell 
                  className="cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('order_date')}
                >
                  <div className="flex items-center gap-2">
                    Order Details
                    {getSortIcon('order_date')}
                  </div>
                </TableHeaderCell>
                <TableHeaderCell>Current Milestone</TableHeaderCell>
                <TableHeaderCell>Next Milestone</TableHeaderCell>
                <TableHeaderCell>SLA Status</TableHeaderCell>
                <TableHeaderCell>Fulfilment Status</TableHeaderCell>
                <TableHeaderCell 
                  className="cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('timeline_priority')}
                >
                  <div className="flex items-center gap-2">
                    Timeline
                    {getSortIcon('timeline_priority')}
                  </div>
                </TableHeaderCell>
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
                sortOrders(orders).map((order) => {
                  // Helper function to get next milestone
                  const getNextMilestone = (currentStage: string) => {
                    switch(currentStage) {
                      case 'Not Synced to OMS':
                        return 'Sync to OMS';
                      case 'OMS Synced':
                        return 'Shipped';
                      case 'Shipped':
                        return 'Delivered';
                      case 'Delivered':
                        return 'N/A';
                      default:
                        return 'N/A';
                    }
                  };

                  // Helper function to get timeline with stage analysis
                  const getTimelineDisplay = (order: typeof orders[0]) => {
                    const timeline: string[] = [];
                    const stageAnalysis = calculateStageAnalysis(order);
                    
                    // Process each stage
                    stageAnalysis.forEach((stage) => {
                      if (stage.stage === 'OMS Sync') {
                        if (order.processed_time) {
                          let line = `Synced to OMS: ${formatLocalTimeReadable(order.processed_time_local, order.processed_time)}`;
                          if (stage.exceeded_by) {
                            line += ` (was +${stage.exceeded_by} over SLA)`;
                          }
                          timeline.push(line);
                        } else if (stage.actual_time) {
                          let line = `Not Synced to OMS: (${stage.actual_time})`;
                          if (stage.exceeded_by) {
                            line += ` +${stage.exceeded_by} over SLA`;
                          }
                          timeline.push(line);
                        }
                      } else if (stage.stage === 'Shipping') {
                        if (order.shipped_time) {
                          let line = `Shipped: ${formatLocalTimeReadable(order.shipped_time_local, order.shipped_time)}`;
                          if (stage.exceeded_by) {
                            line += ` (was +${stage.exceeded_by} over SLA)`;
                          }
                          timeline.push(line);
                        } else if (stage.actual_time) {
                          let line = `In Shipping: (${stage.actual_time})`;
                          if (stage.exceeded_by) {
                            line += ` +${stage.exceeded_by} over SLA`;
                          }
                          timeline.push(line);
                        }
                      } else if (stage.stage === 'Delivery') {
                        if (order.delivered_time) {
                          let line = `Delivered: ${formatLocalTimeReadable(order.delivered_time_local, order.delivered_time)}`;
                          if (stage.exceeded_by) {
                            line += ` (was +${stage.exceeded_by} over SLA)`;
                          }
                          timeline.push(line);
                        } else if (stage.actual_time) {
                          let line = `In Delivery: ${stage.actual_time}`;
                          if (stage.exceeded_by) {
                            line += ` +${stage.exceeded_by} over SLA`;
                          }
                          timeline.push(line);
                        }
                      }
                    });
                    
                    return timeline.length > 0 ? timeline : ['N/A'];
                  };

                  return (
                    <TableRow 
                      key={order.order_no}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleOrderClick(order.order_no)}
                    >
                      {/* Order Details */}
                      <TableCell>
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">{order.order_no}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {formatLocalTimeReadable(order.order_date_local, order.order_date)}
                          </div>
                        </div>
                      </TableCell>

                      {/* Current Milestone */}
                      <TableCell>
                        {getStageBadge(order.current_stage)}
                      </TableCell>

                      {/* Next Milestone */}
                      <TableCell>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          {getNextMilestone(order.current_stage)}
                        </div>
                      </TableCell>

                      {/* SLA Status with Actionable Information */}
                      <TableCell>
                        {getEnhancedSLABadge(order)}
                      </TableCell>

                      {/* Fulfilment Status */}
                      <TableCell>
                        {getEnhancedFulfilmentBadge(order)}
                      </TableCell>

                      {/* Timeline */}
                      <TableCell>
                        <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
                          {getTimelineDisplay(order).map((line, index) => {
                            // Check if line contains SLA breach information
                            const hasOverSLA = line.includes('over SLA');
                            const hasWasOverSLA = line.includes('was +');
                            const isPending = line.includes('pending');
                            
                            if (hasOverSLA) {
                              if (hasWasOverSLA) {
                                // Format: "Shipped: Jul 14, 2025 01:42 (was +17h 39m over SLA)"
                                const parts = line.split('(was +');
                                if (parts.length === 2) {
                                  const overSLAPart = parts[1].split(' over SLA')[0];
                                  return (
                                    <div key={index} className="text-gray-600 dark:text-gray-300">
                                      {parts[0]}
                                      <span className="text-red-600 dark:text-red-400 font-medium">(was +{overSLAPart} over SLA)</span>
                                    </div>
                                  );
                                }
                              } else {
                                // Format: "Delivery: 3d 13h pending +7h 10m over SLA"
                                const stageName = line.split(':')[0];
                                const restOfLine = line.substring(line.indexOf(':') + 1);
                                
                                return (
                                  <div key={index} className="text-gray-600 dark:text-gray-300">
                                    <span className="text-orange-600 dark:text-orange-400 font-medium">{stageName}:</span>
                                    {restOfLine.includes('+') ? (
                                      <>
                                        <span className="text-orange-600 dark:text-orange-400 font-medium">{restOfLine.split('+')[0]}</span>
                                        <span className="text-red-600 dark:text-red-400 font-medium">+{restOfLine.split('+')[1]}</span>
                                      </>
                                    ) : (
                                      <span className="text-orange-600 dark:text-orange-400 font-medium">{restOfLine}</span>
                                    )}
                                  </div>
                                );
                              }
                            } else if (isPending) {
                              // Format: "Shipping: 2d 9h pending" or "Delivery: 3d 13h pending"
                              const stageName = line.split(':')[0];
                              const restOfLine = line.substring(line.indexOf(':') + 1);
                              
                              return (
                                <div key={index} className="text-gray-600 dark:text-gray-300">
                                  <span className="text-orange-600 dark:text-orange-400 font-medium">{stageName}:</span>
                                  <span className="text-orange-600 dark:text-orange-400 font-medium">{restOfLine}</span>
                                </div>
                              );
                            }
                            return (
                              <div key={index} className="text-gray-600 dark:text-gray-300">
                                {line}
                              </div>
                            );
                          })}
                        </div>
                      </TableCell>

                      {/* Brand & Country */}
                      <TableCell>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{order.brand_name?.replace("'s", "'s") || 'N/A'}</div>
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
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Showing {(pagination.page - 1) * pagination.limit + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} orders
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(1)}
                  disabled={pagination.page === 1}
                >
                  First
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
                  onClick={() => handlePageChange(pagination.total_pages)}
                  disabled={pagination.page === pagination.total_pages}
                >
                  Last
                </Button>
              </div>
            </div>
          </Card>
        )}
        
      </div>

      {/* Order Details Modal */}
      <OrderDetailsModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        orderNo={selectedOrderNo}
      />
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
      <ProtectedRoute>
        <OrdersContent />
      </ProtectedRoute>
    </Suspense>
  )
} 