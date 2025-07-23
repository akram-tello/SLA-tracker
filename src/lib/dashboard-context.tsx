"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { DashboardSummary } from '@/lib/types';

interface FilterOption {
  code: string;
  name: string;
}

interface FilterOptions {
  brands: FilterOption[];
  countries: FilterOption[];
  stages: FilterOption[];
}

interface DashboardFilters {
  from_date: string;
  to_date: string;
  brands?: string[]; // Changed to array for multi-select
  countries?: string[]; // Changed to array for multi-select
}

interface DashboardContextType {
  // Filter state
  filters: DashboardFilters;
  setFilters: (filters: DashboardFilters) => void;
  
  // Filter options
  filterOptions: FilterOptions;
  loadingFilterOptions: boolean;
  
  // Data state
  dashboardData: DashboardSummary | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  refreshData: () => void;
  fetchFilterOptions: () => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};

interface DashboardProviderProps {
  children: React.ReactNode;
}

// Create a stable default date range to avoid hydration mismatch
const getDefaultDateRange = () => {
  // Use today's date as end date and 3 months ago as start date
  const endDate = new Date(); // Today's date
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 3); // 3 months ago
  
  const dateRange = {
    from_date: format(startDate, 'yyyy-MM-dd'),
    to_date: format(endDate, 'yyyy-MM-dd'),
  };
  
  console.log('=== DEFAULT DATE RANGE ===');
  console.log('Start date (3 months ago):', dateRange.from_date);
  console.log('End date (today):', dateRange.to_date);
  
  return dateRange;
};

export const DashboardProvider: React.FC<DashboardProviderProps> = ({ children }) => {
  // Initialize filters with stable date range to prevent hydration mismatch
  const [filters, setFilters] = useState<DashboardFilters>(getDefaultDateRange);

  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    brands: [],
    countries: [],
    stages: []
  });
  const [loadingFilterOptions, setLoadingFilterOptions] = useState(true);

  const [dashboardData, setDashboardData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFilterOptions = useCallback(async () => {
    setLoadingFilterOptions(true);
    try {
      const response = await fetch('/api/v1/dashboard/filters');
      if (!response.ok) {
        console.warn(`Filter options API returned ${response.status}, using fallback`);
      }
      
      const data: FilterOptions = await response.json();
      setFilterOptions(data);
    } catch (err) {
      console.error('Error fetching filter options:', err);
      // Set fallback options if API fails
      setFilterOptions({
        brands: [
          { code: 'vs', name: "Victoria's Secret" },
          { code: 'bbw', name: 'Bath & Body Works' }
        ],
        countries: [
          { code: 'MY', name: 'Malaysia' },
          { code: 'SG', name: 'Singapore' }
        ],
        stages: [
          { code: 'Processed', name: 'Processed' },
          { code: 'Shipped', name: 'Shipped' },
          { code: 'Delivered', name: 'Delivered' }
        ]
      });
    } finally {
      setLoadingFilterOptions(false);
    }
  }, []);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        from_date: filters.from_date,
        to_date: filters.to_date,
      });
      
      // Handle multi-select brands (convert array back to individual API calls for now)
      // Note: This is a simplified approach; in production, the API should support multi-select
      if (filters.brands && filters.brands.length === 1) {
        params.append('brand', filters.brands[0]);
      }
      
      if (filters.countries && filters.countries.length === 1) {
        params.append('country', filters.countries[0]);
      }

      const response = await fetch(`/api/v1/dashboard/summary?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard data: ${response.statusText}`);
      }
      
      const data: DashboardSummary = await response.json();
      setDashboardData(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Fetch filter options on mount
  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  // Fetch data when filters change
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const refreshData = useCallback(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const contextValue: DashboardContextType = {
    filters,
    setFilters,
    filterOptions,
    loadingFilterOptions,
    dashboardData,
    loading,
    error,
    refreshData,
    fetchFilterOptions,
  };

  return (
    <DashboardContext.Provider value={contextValue}>
      {children}
    </DashboardContext.Provider>
  );
}; 