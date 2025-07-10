"use client"

import React, { Suspense, useState, useEffect } from 'react';
import { Moon, Sun, User } from 'lucide-react';
import { useTheme } from 'next-themes';

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

const Spinner = ({ size = "md" }: { size?: "sm" | "md" | "lg" }) => {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8", 
    lg: "h-12 w-12"
  };
  
  return (
    <div className={`animate-spin rounded-full border-b-2 border-blue-600 ${sizeClasses[size]}`}></div>
  );
};

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // Ensure theme is mounted to prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              SLA Tracker Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Monitor order processing performance across brands and countries
            </p>
          </div>
          
          {/* Right side - Buttons */}
          <div className="flex items-center space-x-4">
            {/* Sign In Button */}
            <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors">
              <User className="h-4 w-4 mr-2" />
              Sign In
            </button>
            
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle theme"
            >
              {mounted && (
                theme === 'dark' ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )
              )}
            </button>
          </div>
        </div>

        {/* Filters Section */}
        <Card className="mb-8 border-0 shadow-sm">
          <Suspense fallback={
            <div className="flex justify-center p-8">
              <Spinner size="lg" />
            </div>
          }>
            <Filters />
          </Suspense>
        </Card>

        {/* KPI Cards */}
        <div className="mb-8">
          <Suspense fallback={
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="border-0 shadow-sm">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                  </div>
                </Card>
              ))}
            </div>
          }>
            <KPICards />
          </Suspense>
        </div>

        {/* Charts and Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* SLA Performance Chart */}
          <Card className="border-0 shadow-sm">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                SLA Performance Trend
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Track performance over time
              </p>
            </div>
            <Suspense fallback={
              <div className="flex justify-center items-center h-64">
                <Spinner size="lg" />
              </div>
            }>
              <SLAChart />
            </Suspense>
          </Card>

          {/* Stage Breakdown */}
          <Card className="border-0 shadow-sm">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Performance by Stage
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Breakdown across order processing stages
              </p>
            </div>
            <Suspense fallback={
              <div className="flex justify-center items-center h-64">
                <Spinner size="lg" />
              </div>
            }>
              <StageBreakdown />
            </Suspense>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="border-0 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Quick Actions
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Common dashboard tasks
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Export Data
              </button>
              <button className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                Refresh Data
              </button>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
