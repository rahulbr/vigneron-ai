
import React, { Suspense, lazy } from 'react';

// Lazy load heavy components
export const LazyEnhancedGDDChart = lazy(() => import('./EnhancedGDDChart'));
export const LazyGrowthCurveChart = lazy(() => import('./GrowthCurveChart'));
export const LazyReportsModal = lazy(() => import('./ReportsModal'));

// Loading fallback component
const ChartSkeleton = () => (
  <div className="animate-pulse bg-gray-200 rounded-lg h-64 w-full flex items-center justify-center">
    <div className="text-gray-500">Loading chart...</div>
  </div>
);

// Wrapped components with suspense
export const EnhancedGDDChartWithSuspense = (props: any) => (
  <Suspense fallback={<ChartSkeleton />}>
    <LazyEnhancedGDDChart {...props} />
  </Suspense>
);

export const GrowthCurveChartWithSuspense = (props: any) => (
  <Suspense fallback={<ChartSkeleton />}>
    <LazyGrowthCurveChart {...props} />
  </Suspense>
);

export const ReportsModalWithSuspense = (props: any) => (
  <Suspense fallback={<div>Loading...</div>}>
    <LazyReportsModal {...props} />
  </Suspense>
);
