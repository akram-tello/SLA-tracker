"use client"

import React, { useState, useEffect } from 'react';
import { Moon, Sun, User } from 'lucide-react';
import { useTheme } from 'next-themes';

// Import DashboardProvider and hook
import { DashboardProvider, useDashboard } from '@/lib/dashboard-context';

// Lazy load dashboard components
import { KPICards } from '@/components/dashboard/kpi-cards';
import { SLAChart } from '@/components/dashboard/sla-chart';
import { StageBreakdown } from '@/components/dashboard/stage-breakdown';
import { StagePerformanceChart } from '@/components/dashboard/stage-performance-chart';

import { Filters } from '@/components/dashboard/filters';
import { FilterFirstScreen } from '@/components/dashboard/filter-first-screen';

function DashboardContent() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const { filters, filterOptions, hasSelectedFilters } = useDashboard();

  // Ensure theme is mounted to prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  // Generate dynamic title and subtitle based on selected filters
  const getDynamicTitle = () => {
    const brandName = filters.brands?.[0] ? 
      filterOptions.brands.find(b => b.code === filters.brands![0])?.name : null;
    const countryName = filters.countries?.[0] ? 
      filterOptions.countries.find(c => c.code === filters.countries![0])?.name : null;

    if (brandName && countryName) {
      return {
        title: `${brandName} • ${countryName}`,
        subtitle: 'SLA Performance Dashboard'
      };
    }
    
    if (brandName) {
      return {
        title: `${brandName} Dashboard`,
        subtitle: 'SLA Performance Tracking'
      };
    }
    
    if (countryName) {
      return {
        title: `${countryName} Operations`,
        subtitle: 'SLA Performance Dashboard'
      };
    }
    
    return {
      title: 'E-commerce Orders SLA Tracker Dashboard',
      subtitle: 'Monitor order processing performance'
    };
  };

  const { title, subtitle } = getDynamicTitle();

  // Show filter-first screen if not initialized
  if (!hasSelectedFilters) {
    return <FilterFirstScreen />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-black dark:to-black transition-colors duration-200">
      <main className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              {title}
            </h1>
            <p className="text-gray-600 dark:text-gray-300 text-base">
              {subtitle}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md transition-all duration-200"
              aria-label="Toggle theme"
              suppressHydrationWarning
            >
              {mounted && theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>

            {/* Profile Button */}
            <button
              className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md transition-all duration-200"
              aria-label="User profile"
            >
              <User className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Filters Section */}
        <div className="mb-8">
          <Filters />
        </div>

        {/* 1. KPIs Section */}
        <div className="mb-8">
          <KPICards section="overview" />
        </div>

       {/* 2. Charts Section */}
       <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Performance Analytics</h2>

        {/*  Charts with Timeline-based filtering */}
          <div className="mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column - SLA Performance Chart */}
              <div>
                <SLAChart />
              </div>

              {/* Right Column - Stage Performance Chart */}
              <div>
                <StagePerformanceChart />
              </div>
            </div>
          </div>
        </div>

        {/* 3. Action Required KPIs Section */}
        <div className="mb-8" style={{ display: 'none' }}>
          <KPICards section="action-required" />
        </div>

        {/* 4. Stage Breakdown Section */}
        <div className="mb-8">
          <StageBreakdown />
        </div>
      </main>
    </div>
  );
}

export default function Dashboard() {
  return (
    <DashboardProvider>
      <DashboardContent />
    </DashboardProvider>
  );
}
