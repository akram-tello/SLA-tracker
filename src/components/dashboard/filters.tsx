"use client"

import { useState, useEffect } from "react"
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns"
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

  const handleQuickDate = (months: number) => {
    const monthsAgo = subMonths(new Date(), months)
    const from = format(startOfMonth(monthsAgo), 'yyyy-MM-dd')
    const to = format(endOfMonth(new Date()), 'yyyy-MM-dd')
    setFromDate(from)
    setToDate(to)
  }

  // Check if current date range matches quick select periods
  const isLast3Months = () => {
    const threeMonthsAgo = startOfMonth(subMonths(new Date(), 3))
    const endOfCurrentMonth = endOfMonth(new Date())
    return fromDate === format(threeMonthsAgo, 'yyyy-MM-dd') && 
           toDate === format(endOfCurrentMonth, 'yyyy-MM-dd')
  }

  const isLast6Months = () => {
    const sixMonthsAgo = startOfMonth(subMonths(new Date(), 6))
    const endOfCurrentMonth = endOfMonth(new Date())
    return fromDate === format(sixMonthsAgo, 'yyyy-MM-dd') && 
           toDate === format(endOfCurrentMonth, 'yyyy-MM-dd')
  }

  return (
    <div className="flex items-center gap-3 py-2 text-sm">
      {/* Improved Quick Date Buttons */}
      <div className="flex gap-1">
        <button
          onClick={() => handleQuickDate(3)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            isLast3Months() 
              ? 'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700' 
              : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
          }`}
        >
          Last 3 Months
        </button>
        <button
          onClick={() => handleQuickDate(6)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            isLast6Months() 
              ? 'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700' 
              : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
          }`}
        >
          Last 6 Months
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
  )
} 