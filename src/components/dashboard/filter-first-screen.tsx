"use client"

import { useMemo } from "react"
import LoadingSkeleton from "@/components/ui/loading-skeleton"
import { useDashboard } from "@/lib/dashboard-context"
import { ArrowRight, Building2, Globe, TrendingUp } from "lucide-react"

export function FilterFirstScreen() {
  const { 
    filterOptions, 
    loadingFilterOptions, 
    setFilters, 
    filters, 
    setHasInitialized,
    updateURLWithFilters 
  } = useDashboard()
  
  const selectedBrand = filters.brands?.[0] || ""
  const selectedCountry = filters.countries?.[0] || ""

  const availableCountries = useMemo(() => {
    return selectedBrand && filterOptions.brandCountries[selectedBrand] 
      ? filterOptions.brandCountries[selectedBrand] 
      : []
  }, [selectedBrand, filterOptions.brandCountries])

  const handleBrandChange = (brand: string) => {
    const newFilters = {
      ...filters,
      brands: brand ? [brand] : undefined,
      countries: undefined
    }
    setFilters(newFilters)
  }

  const handleCountryChange = (country: string) => {
    const newFilters = {
      ...filters,
      countries: country ? [country] : undefined
    }
    setFilters(newFilters)
  }

  const handleContinue = () => {
    updateURLWithFilters(filters)
    setHasInitialized(true)
  }

  const canContinue = !!selectedBrand && !!selectedCountry

  if (loadingFilterOptions) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-black dark:to-black flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <LoadingSkeleton className="h-12 w-12 rounded-full mx-auto" />
            <LoadingSkeleton className="h-6 w-56 rounded mx-auto mt-4" />
          </div>
          <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-lg space-y-4">
            <LoadingSkeleton className="h-4 w-32" />
            <LoadingSkeleton className="h-10 w-full" />
            <LoadingSkeleton className="h-4 w-32 mt-4" />
            <LoadingSkeleton className="h-10 w-full" />
            <LoadingSkeleton className="h-10 w-full mt-6" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-black dark:to-black flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
              <TrendingUp className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">SLA Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-300">Select your brand and/or country to filter data, or continue to see all data</p>
        </div>

        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-lg">
          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              <Building2 className="h-4 w-4" />
              Select Brand
            </label>
            <select value={selectedBrand} onChange={(e) => handleBrandChange(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors">
              <option value="">Select all brands</option>
              {filterOptions.brands.map(brand => (
                <option key={brand.code} value={brand.code}>{brand.name}</option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              <Globe className="h-4 w-4" />
              Select Country
            </label>
            <select value={selectedCountry} onChange={(e) => handleCountryChange(e.target.value)} disabled={!selectedBrand} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <option value="">Select all countries</option>
              {availableCountries.map(country => (
                <option key={country.code} value={country.code}>{country.name}</option>
              ))}
            </select>
          </div>

          <button onClick={handleContinue} disabled={!canContinue} className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
              canContinue ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105' : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}>
            {selectedBrand || selectedCountry ? 'Continue with Selected Filters' : 'Continue to View All Data'}
            <ArrowRight className="h-4 w-4" />
          </button>

          <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">Select brand and/or country to filter data, or continue to see all data</p>
        </div>
      </div>
    </div>
  )
}


