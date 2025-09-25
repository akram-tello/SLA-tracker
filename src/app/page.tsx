"use client"

import React, { Suspense } from 'react';
import ProtectedRoute from '@/components/auth/protected-route';
import Dashboard from '@/app/dashboard/page';

function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-black dark:to-black flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-300">Loading dashboard...</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    </Suspense>
  );
}
