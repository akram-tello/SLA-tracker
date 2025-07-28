"use client"

import { useState } from "react"
import { useDashboard } from "@/lib/dashboard-context"
import { ArrowRight, Building2, Globe, TrendingUp } from "lucide-react"

export function FilterFirstScreen() {
  const { filterOptions, loadingFilterOptions, setFilters, filters, setHasInitialized } = useDashboard()
  const [selectedBrand, setSelectedBrand] = useState(filters.brands?.[0] || "")
  const [selectedCountry, setSelectedCountry] = useState(filters.countries?.[0] || "")

  const handleContinue = () => {
    setFilters({
      ...filters,
      brands: selectedBrand ? [selectedBrand] : undefined,
      countries: selectedCountry ? [selectedCountry] : undefined,
    })
    setHasInitialized(true)
  }

  const canContinue = true 

  if (loadingFilterOptions) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-black dark:to-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading available options...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-black dark:to-black flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
              <TrendingUp className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            SLA Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Select your brand and/or country to filter data, or continue to see all data
          </p>
        </div>

        {/* Filter Form */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-lg">
          {/* Brand Selection */}
          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              <Building2 className="h-4 w-4" />
              Select Brand
            </label>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            >
              <option value="">Select all brands</option>
              {filterOptions.brands.map(brand => (
                <option key={brand.code} value={brand.code}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>

          {/* Country Selection */}
          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              <Globe className="h-4 w-4" />
              Select Country
            </label>
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            >
              <option value="">Select all countries</option>
              {filterOptions.countries.map(country => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>

          {/* Continue Button */}
          <button
            onClick={handleContinue}
            disabled={!canContinue}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
              canContinue
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
          >
            {selectedBrand || selectedCountry ? 'Continue with Selected Filters' : 'Continue to View All Data'}
            <ArrowRight className="h-4 w-4" />
          </button>

          {/* Help Text */}
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
            Select brand and/or country to filter data, or continue to see all data
          </p>
        </div>
      </div>
    </div>
  )
} 