"use client"

import { useState } from "react"
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DashboardFilters as DashboardFiltersType } from "@/lib/types"

interface FiltersProps {
  filters: DashboardFiltersType
  onFiltersChange: (filters: DashboardFiltersType) => void
}

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

export function DashboardFilters({ filters, onFiltersChange }: FiltersProps) {
  const [fromDate, setFromDate] = useState<Date>(new Date(filters.from_date))
  const [toDate, setToDate] = useState<Date>(new Date(filters.to_date))

  const handleQuickDate = (quickDate: typeof QUICK_DATES[0]) => {
    const { from, to } = quickDate.getValue()
    setFromDate(from)
    setToDate(to)
    onFiltersChange({
      ...filters,
      from_date: format(from, 'yyyy-MM-dd'),
      to_date: format(to, 'yyyy-MM-dd'),
    })
  }

  const handleDateChange = (type: 'from' | 'to', date: Date | undefined) => {
    if (!date) return
    
    if (type === 'from') {
      setFromDate(date)
      onFiltersChange({
        ...filters,
        from_date: format(date, 'yyyy-MM-dd'),
      })
    } else {
      setToDate(date)
      onFiltersChange({
        ...filters,
        to_date: format(date, 'yyyy-MM-dd'),
      })
    }
  }

  const handleBrandChange = (brand: string) => {
    onFiltersChange({
      ...filters,
      brand: brand === "all" ? undefined : brand,
    })
  }

  const handleCountryChange = (country: string) => {
    onFiltersChange({
      ...filters,
      country: country === "all" ? undefined : country,
    })
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row gap-4 items-end">
          {/* Quick Date Selection */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Quick Select</label>
            <div className="flex gap-2">
              {QUICK_DATES.map((quickDate) => (
                <Button
                  key={quickDate.label}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickDate(quickDate)}
                >
                  {quickDate.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Date Range */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">From Date</label>
            <DatePicker
              value={fromDate}
              onChange={(date) => handleDateChange('from', date)}
              placeholder="Select from date"
              className="w-[200px]"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">To Date</label>
            <DatePicker
              value={toDate}
              onChange={(date) => handleDateChange('to', date)}
              placeholder="Select to date"
              className="w-[200px]"
            />
          </div>

          {/* Brand Filter */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Brand</label>
            <Select value={filters.brand || "all"} onValueChange={handleBrandChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select brand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {BRANDS.map((brand) => (
                  <SelectItem key={brand} value={brand}>
                    {brand}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Country Filter */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Country</label>
            <Select value={filters.country || "all"} onValueChange={handleCountryChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {COUNTRIES.map((country) => (
                  <SelectItem key={country.code} value={country.code}>
                    {country.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 