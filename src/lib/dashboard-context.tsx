"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

interface FilterOption {
  code: string;
  name: string;
}

interface FilterOptions {
  brands: FilterOption[];
  brandCountries: Record<string, FilterOption[]>;
  stages: FilterOption[];
}

interface DashboardFilters {
  from_date: string;
  to_date: string;
  brands?: string[]; // Changed to array for multi-select
  countries?: string[]; // Changed to array for multi-select
}

// V2 Dashboard Summary types
interface V2TatConfig {
  brand_name: string;
  brand_code: string;
  country_code: string;
  processed_tat: string;
  shipped_tat: string;
  delivered_tat: string;
  risk_pct: number;
}

interface V2StageItem {
  stage: string;
  total: number;
  on_time: number;
  on_risk: number;
  breached: number;
  urgent: number;
  critical: number;
  completion_rate: number;
  fulfillment_rate: number;
}

interface V2KPIs {
  placed_orders: number;
  breached_pending_orders: number;
  fulfilled_orders: number;
  fulfilled_breached_orders: number;
  at_risk_pending_orders: number;
  at_risk_orders: number;
  total_urgent_orders: number;
  total_critical_orders: number;
  completion_rate: number;
  fulfillment_rate: number;
  last_refresh: string;
}

interface V2DashboardSummary {
  tat_configs: V2TatConfig[];
  kpis: V2KPIs;
  stage_breakdown: V2StageItem[];
  historical_stage_breakdown: V2StageItem[];
}

interface DashboardContextType {
  // Filter state
  filters: DashboardFilters;
  setFilters: (filters: DashboardFilters) => void;
  
  // Filter options
  filterOptions: FilterOptions;
  loadingFilterOptions: boolean;
  
  // Filter-first state
  hasSelectedFilters: boolean;
  setHasInitialized: (initialized: boolean) => void;
  
  // Data state
  dashboardV2Data: V2DashboardSummary | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  refreshData: () => void;
  fetchFilterOptions: () => void;
  
  // URL state management
  updateURLWithFilters: (filters: DashboardFilters) => void;
  navigateToOrders: (additionalParams?: Record<string, string>) => void;
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
  startDate.setDate(1);
  startDate.setMonth(6);
  
  const dateRange = {
    from_date: format(startDate, 'yyyy-MM-dd'),
    to_date: format(endDate, 'yyyy-MM-dd'),
  };
  
  console.log('=== DEFAULT DATE RANGE ===');
  console.log('Start date (45 days ago):', dateRange.from_date);
  console.log('End date (today):', dateRange.to_date);
  
  return dateRange;
};

// Helper function to parse URL parameters into filters
const parseURLParamsToFilters = (searchParams: URLSearchParams): DashboardFilters => {
  const defaultRange = getDefaultDateRange();
  
  return {
    from_date: searchParams.get('from_date') || defaultRange.from_date,
    to_date: searchParams.get('to_date') || defaultRange.to_date,
    brands: searchParams.get('brand') ? [searchParams.get('brand')!] : undefined,
    countries: searchParams.get('country') ? [searchParams.get('country')!] : undefined,
  };
};

// Helper function to convert filters to URL parameters
const filtersToURLParams = (filters: DashboardFilters): URLSearchParams => {
  const params = new URLSearchParams();
  
  // Only include brand and country in URL, not date range
  if (filters.brands && filters.brands.length > 0) params.set('brand', filters.brands[0]);
  if (filters.countries && filters.countries.length > 0) params.set('country', filters.countries[0]);
  
  return params;
};

export const DashboardProvider: React.FC<DashboardProviderProps> = ({ children }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  // Initialize filters with stable defaults to prevent hydration mismatch
  const [filters, setFilters] = useState<DashboardFilters>(getDefaultDateRange);

  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    brands: [],
    brandCountries: {},
    stages: []
  });
  const [loadingFilterOptions, setLoadingFilterOptions] = useState(true);

  const [dashboardV2Data, setDashboardV2Data] = useState<V2DashboardSummary | null>(null);
  const [loading, setLoading] = useState(false); 
  const [error, setError] = useState<string | null>(null);
  
  // Track if user has gone through the filter selection process
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // Track if we're in the middle of initialization to prevent premature API calls
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Ref to access current filters without adding to dependencies
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Memoize hasSelectedFilters to prevent unnecessary re-renders
  const hasSelectedFilters = useMemo(() => {
    return hasInitialized && Boolean(
      (filters.brands && filters.brands.length > 0) &&
      (filters.countries && filters.countries.length > 0)
    );
  }, [hasInitialized, filters.brands, filters.countries]);

  // Update URL with current filters
  const updateURLWithFilters = useCallback((newFilters: DashboardFilters) => {
    const params = filtersToURLParams(newFilters);
    const currentPath = pathname || '/';
    const newURL = params.toString() ? `${currentPath}?${params.toString()}` : currentPath;
    router.replace(newURL, { scroll: false });
  }, [router, pathname]);

  // Navigate to orders page with current filters
  const navigateToOrders = useCallback((additionalParams?: Record<string, string>) => {
    const params = filtersToURLParams(filters);
    
    // Add any additional parameters
    if (additionalParams) {
      Object.entries(additionalParams).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
    }
    
    const ordersURL = params.toString() ? `/orders?${params.toString()}` : '/orders';
    router.push(ordersURL);
  }, [filters, router]);

  const fetchFilterOptions = useCallback(async () => {
    setLoadingFilterOptions(true);
    try {
      const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
      const response = await fetch(`${base}/api/v1/dashboard/filters/`);
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
        brandCountries: {
          'vs': [
            { code: 'MY', name: 'Malaysia' },
            { code: 'SG', name: 'Singapore' }
          ],
          'bbw': [
            { code: 'MY', name: 'Malaysia' },
            { code: 'SG', name: 'Singapore' }
          ]
        },
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

  const fetchDashboardData = useCallback(async (currentFilters?: DashboardFilters) => {
    // Use provided filters or fall back to current state from ref
    const filtersToUse = currentFilters || filtersRef.current;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        from_date: filtersToUse.from_date,
        to_date: filtersToUse.to_date,
      });
      
      // Handle multi-select brands (convert array back to individual API calls for now)
      // Note: This is a simplified approach; in production, the API should support multi-select
      if (filtersToUse.brands && filtersToUse.brands.length === 1) {
        params.append('brand', filtersToUse.brands[0]);
      }
      
      if (filtersToUse.countries && filtersToUse.countries.length === 1) {
        params.append('country', filtersToUse.countries[0]);
      }

      const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
      
      // Only fetch V2 data now
      const v2Response = await fetch(`${base}/api/v2/dashboard/summary/?${params}`);
      
      if (!v2Response.ok) {
        throw new Error(`Failed to fetch v2 dashboard data: ${v2Response.statusText}`);
      }
      
      const v2Data = await v2Response.json() as V2DashboardSummary;
      
      setDashboardV2Data(v2Data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []); // Stable function with no dependencies

  // Initialize filters from URL parameters after hydration
  useEffect(() => {
    const urlParams = new URLSearchParams(searchParams.toString());
    const newFilters = parseURLParamsToFilters(urlParams);
    setFilters(newFilters);
    
    // Check if we should mark as initialized based on URL parameters
    const hasBrands = urlParams.get('brand');
    const hasCountries = urlParams.get('country');
    if (hasBrands && hasCountries) {
      setHasInitialized(true);
    }
    // Always mark initialization as complete - let the main effect handle API calls
    setIsInitializing(false);
  }, [searchParams]);

  // Fetch filter options on mount
  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  // Use refs to track API call state and prevent duplicates
  const isCallInProgressRef = useRef(false);
  const lastCallFiltersRef = useRef<string>('');

  // Single, controlled effect for ALL API calls with duplicate prevention
  useEffect(() => {
    // Only fetch if:
    // 1. Not initializing
    // 2. Filters are properly selected
    if (isInitializing || !hasSelectedFilters) return;

    // Create a unique key for current filters to detect actual changes
    const filtersKey = JSON.stringify({
      from_date: filters.from_date,
      to_date: filters.to_date,
      brands: filters.brands,
      countries: filters.countries
    });

    // Skip if this exact filter combination was already called
    if (lastCallFiltersRef.current === filtersKey || isCallInProgressRef.current) {
      console.log('Skipping duplicate API call for same filters');
      return;
    }

    console.log('Making API call with filters:', filters);
    
    const timeoutId = setTimeout(() => {
      isCallInProgressRef.current = true;
      lastCallFiltersRef.current = filtersKey;
      
      fetchDashboardData(filters).finally(() => {
        isCallInProgressRef.current = false;
      });
    }, 200); // 200ms debounce

    return () => clearTimeout(timeoutId);
  }, [filters, hasSelectedFilters, isInitializing, fetchDashboardData]);

  // Sync filters with URL parameters when they change
  useEffect(() => {
    // Only update URL when we have actual filter changes and not during initial load
    if (hasSelectedFilters) {
      updateURLWithFilters(filters);
    }
  }, [filters, hasSelectedFilters, updateURLWithFilters])

  const refreshData = useCallback(() => {
    fetchDashboardData(filtersRef.current);
  }, [fetchDashboardData]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue: DashboardContextType = useMemo(() => ({
    filters,
    setFilters,
    filterOptions,
    loadingFilterOptions,
    hasSelectedFilters,
    setHasInitialized,
    dashboardV2Data,
    loading,
    error,
    refreshData,
    fetchFilterOptions,
    updateURLWithFilters,
    navigateToOrders,
  }), [
    filters,
    setFilters,
    filterOptions,
    loadingFilterOptions,
    hasSelectedFilters,
    setHasInitialized,
    dashboardV2Data,
    loading,
    error,
    refreshData,
    fetchFilterOptions,
    updateURLWithFilters,
    navigateToOrders,
  ]);

  return (
    <DashboardContext.Provider value={contextValue}>
      {children}
    </DashboardContext.Provider>
  );
}; 