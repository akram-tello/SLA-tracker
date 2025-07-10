"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { DashboardSummary } from '@/lib/types';

interface DashboardFilters {
  from_date: string;
  to_date: string;
  brand?: string;
  country?: string;
}

interface DashboardContextType {
  // Filter state
  filters: DashboardFilters;
  setFilters: (filters: DashboardFilters) => void;
  
  // Data state
  dashboardData: DashboardSummary | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  refreshData: () => void;
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

export const DashboardProvider: React.FC<DashboardProviderProps> = ({ children }) => {
  // Initialize filters with last month's data
  const [filters, setFilters] = useState<DashboardFilters>(() => {
    const lastMonth = subMonths(new Date(), 1);
    return {
      from_date: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
      to_date: format(endOfMonth(lastMonth), 'yyyy-MM-dd'),
    };
  });

  const [dashboardData, setDashboardData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        from_date: filters.from_date,
        to_date: filters.to_date,
      });
      
      if (filters.brand) params.append('brand', filters.brand);
      if (filters.country) params.append('country', filters.country);

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
    dashboardData,
    loading,
    error,
    refreshData,
  };

  return (
    <DashboardContext.Provider value={contextValue}>
      {children}
    </DashboardContext.Provider>
  );
}; 