"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { useDashboard } from "@/lib/dashboard-context"
import { RefreshCw } from "lucide-react"

export function Filters() {
  const { filters, setFilters, filterOptions, loadingFilterOptions, refreshData } = useDashboard()
  
  const [fromDate, setFromDate] = useState(filters.from_date)
  const [toDate, setToDate] = useState(filters.to_date)
  const [selectedBrand, setSelectedBrand] = useState(filters.brands?.[0] || "")
  const [selectedCountry, setSelectedCountry] = useState(filters.countries?.[0] || "")

  useEffect(() => {
    setFilters({
      from_date: fromDate,
      to_date: toDate,
      brands: selectedBrand ? [selectedBrand] : undefined,
      countries: selectedCountry ? [selectedCountry] : undefined,
    })
  }, [fromDate, toDate, selectedBrand, selectedCountry, setFilters])

  const handleQuickDate = (type: 'today' | 'yesterday' | 'last7days') => {
    const today = new Date()
    let from: string, to: string
    
    switch (type) {
      case 'today':
        from = format(today, 'yyyy-MM-dd')
        to = format(today, 'yyyy-MM-dd')
        break
      case 'yesterday':
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
        from = format(yesterday, 'yyyy-MM-dd')
        to = format(yesterday, 'yyyy-MM-dd')
        break
      case 'last7days':
        const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
        from = format(sevenDaysAgo, 'yyyy-MM-dd')
        to = format(today, 'yyyy-MM-dd')
        break
    }
    
    setFromDate(from)
    setToDate(to)
  }

  // Check if current date range matches quick select periods
  const isToday = () => {
    const today = format(new Date(), 'yyyy-MM-dd')
    return fromDate === today && toDate === today
  }

  const isYesterday = () => {
    const yesterday = format(new Date(Date.now() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
    return fromDate === yesterday && toDate === yesterday
  }

  const isLast7Days = () => {
    const today = format(new Date(), 'yyyy-MM-dd')
    const sevenDaysAgo = format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
    return fromDate === sevenDaysAgo && toDate === today
  }

  return (
    <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
      <div className="flex items-center gap-3 text-sm">
      {/* Improved Quick Date Buttons */}
      <div className="flex gap-1">
        <button
          onClick={() => handleQuickDate('today')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            isToday() 
              ? 'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700' 
              : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
          }`}
        >
          Today
        </button>
        <button
          onClick={() => handleQuickDate('yesterday')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            isYesterday() 
              ? 'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700' 
              : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
          }`}
        >
          Yesterday
        </button>
        <button
          onClick={() => handleQuickDate('last7days')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            isLast7Days() 
              ? 'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700' 
              : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
          }`}
        >
          Last 7 Days
        </button>
      </div>

      {/* Date Inputs */}
      <input
        type="date"
        value={fromDate}
        onChange={(e) => setFromDate(e.target.value)}
        className="px-2 py-1 text-xs border border-gray-200 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
      />
      <span className="text-gray-400 text-xs">to</span>
      <input
        type="date"
        value={toDate}
        onChange={(e) => setToDate(e.target.value)}
        className="px-2 py-1 text-xs border border-gray-200 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
      />

      {/* Brand Select */}
      <select
        value={selectedBrand}
        onChange={(e) => setSelectedBrand(e.target.value)}
        disabled={loadingFilterOptions}
        className="px-2 py-1 text-xs border border-gray-200 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
      >
        <option value="">All Brands</option>
        {filterOptions.brands.map(brand => (
          <option key={brand.code} value={brand.code}>
            {brand.name}
          </option>
        ))}
      </select>

      {/* Country Select */}
      <select
        value={selectedCountry}
        onChange={(e) => setSelectedCountry(e.target.value)}
        disabled={loadingFilterOptions}
        className="px-2 py-1 text-xs border border-gray-200 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
      >
        <option value="">All Countries</option>
        {filterOptions.countries.map(country => (
          <option key={country.code} value={country.code}>
            {country.name}
          </option>
        ))}
      </select>

      {/* Refresh */}
      <button
        onClick={refreshData}
        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        title="Refresh"
      >
        <RefreshCw className="h-3 w-3" />
      </button>
      </div>
    </div>
  )
} 