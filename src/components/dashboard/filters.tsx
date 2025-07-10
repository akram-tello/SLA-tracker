"use client"

import { useState } from "react"
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns"

// Custom Tailwind components
const Button = ({ 
  children, 
  onClick, 
  color = "blue", 
  size = "md", 
  className = "" 
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  color?: "blue" | "gray"; 
  size?: "sm" | "md" | "lg";
  className?: string;
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
      className={`font-medium rounded-lg transition-colors ${colorClasses[color]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </button>
  );
};

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

const Datepicker = ({ 
  value, 
  onChange, 
  className = "" 
}: { 
  value?: Date; 
  onChange?: (date: Date | undefined) => void;
  className?: string;
}) => (
  <input
    type="date"
    value={value ? value.toISOString().split('T')[0] : ''}
    onChange={(e) => onChange?.(e.target.value ? new Date(e.target.value) : undefined)}
    className={`bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 ${className}`}
  />
);

const QUICK_DATES = [
  { label: "Today", getValue: () => ({ from: new Date(), to: new Date() }) },
  { label: "Last 7 Days", getValue: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { label: "This Month", getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: "Last Month", getValue: () => {
    const lastMonth = subMonths(new Date(), 1)
    return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) }
  }},
]

const BRANDS = [
  "Victoria's Secret",
  "Bath & Body Works",
]

const COUNTRIES = [
  { code: "MY", name: "Malaysia" },
  { code: "SG", name: "Singapore" },
]

export function Filters() {
  const [fromDate, setFromDate] = useState<Date>(startOfMonth(subMonths(new Date(), 1)))
  const [toDate, setToDate] = useState<Date>(endOfMonth(subMonths(new Date(), 1)))
  const [selectedBrand, setSelectedBrand] = useState<string>("all")
  const [selectedCountry, setSelectedCountry] = useState<string>("all")

  const handleQuickDate = (quickDate: typeof QUICK_DATES[0]) => {
    const { from, to } = quickDate.getValue()
    setFromDate(from)
    setToDate(to)
  }

  const handleApplyFilters = () => {
    // In a real implementation, this would trigger a callback or event
    console.log('Applied filters:', {
      from_date: format(fromDate, 'yyyy-MM-dd'),
      to_date: format(toDate, 'yyyy-MM-dd'),
      brand: selectedBrand === "all" ? undefined : selectedBrand,
      country: selectedCountry === "all" ? undefined : selectedCountry,
    })
  }

  return (
    <div className="p-6">
      <div className="flex flex-col lg:flex-row gap-6 items-end">
        {/* Quick Date Selection */}
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Quick Select</label>
          <div className="flex gap-2 flex-wrap">
            {QUICK_DATES.map((quickDate) => (
              <Button
                key={quickDate.label}
                size="sm"
                color="gray"
                onClick={() => handleQuickDate(quickDate)}
                className="text-xs"
              >
                {quickDate.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Custom Date Range */}
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">From Date</label>
          <div className="w-48">
            <Datepicker
              value={fromDate}
              onChange={(date) => date && setFromDate(date)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">To Date</label>
          <div className="w-48">
            <Datepicker
              value={toDate}
              onChange={(date) => date && setToDate(date)}
            />
          </div>
        </div>

        {/* Brand Filter */}
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Brand</label>
          <div className="w-48">
            <Select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
            >
              <option value="all">All Brands</option>
              {BRANDS.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Country Filter */}
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Country</label>
          <div className="w-48">
            <Select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
            >
              <option value="all">All Countries</option>
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Apply Button */}
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 invisible">Apply</label>
          <Button onClick={handleApplyFilters} className="w-32">
            Apply Filters
          </Button>
        </div>
      </div>
    </div>
  )
} 