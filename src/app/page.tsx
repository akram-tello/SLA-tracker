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
import { Filters } from '@/components/dashboard/filters';

// Custom Tailwind components
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
    {children}
  </div>
);

function DashboardContent() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const { filters, filterOptions } = useDashboard();

  // Ensure theme is mounted to prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
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
      title: 'SLA Tracker Dashboard',
      subtitle: 'Monitor order processing performance'
    };
  };

  const { title, subtitle } = getDynamicTitle();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {title}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {subtitle}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
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
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
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

        {/* KPI Cards */}
        <div className="mb-8">
          <KPICards />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <Card>
            <SLAChart />
          </Card>
          <Card>
            <StageBreakdown />
          </Card>
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
