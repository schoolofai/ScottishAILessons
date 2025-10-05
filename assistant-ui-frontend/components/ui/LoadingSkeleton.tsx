/**
 * Loading Skeleton Components
 *
 * Provides consistent loading state placeholders across the application.
 * Uses Tailwind's animate-pulse for shimmer effect.
 */

// Course Card Skeleton
export function CourseCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
      <div className="h-6 bg-gray-200 rounded mb-4 w-3/4"></div>
      <div className="h-4 bg-gray-200 rounded mb-2 w-1/2"></div>
      <div className="h-4 bg-gray-200 rounded mb-4 w-2/3"></div>
      <div className="h-10 bg-gray-200 rounded w-full"></div>
    </div>
  );
}

// Progress Card Skeleton
export function ProgressCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 bg-gray-200 rounded w-1/2"></div>
        <div className="h-12 w-12 bg-gray-200 rounded-full"></div>
      </div>
      <div className="space-y-3">
        <div className="flex justify-between">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
        <div className="flex justify-between">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/5"></div>
        </div>
        <div className="flex justify-between">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
      </div>
      <div className="h-10 bg-gray-200 rounded w-full mt-4"></div>
    </div>
  );
}

// Recommendation Card Skeleton
export function RecommendationCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 bg-gray-200 rounded w-1/4"></div>
        <div className="h-5 bg-gray-200 rounded w-1/5"></div>
      </div>
      <div className="h-6 bg-gray-200 rounded mb-3 w-2/3"></div>
      <div className="flex gap-2 mb-4">
        <div className="h-6 bg-gray-200 rounded-full w-16"></div>
        <div className="h-6 bg-gray-200 rounded-full w-20"></div>
        <div className="h-6 bg-gray-200 rounded-full w-16"></div>
      </div>
      <div className="h-4 bg-gray-200 rounded w-1/3"></div>
    </div>
  );
}

// Dashboard Skeleton - Full page
export function DashboardSkeleton() {
  return (
    <div
      className="container mx-auto p-6 space-y-6"
      role="status"
      aria-live="polite"
      aria-label="Loading dashboard"
    >
      {/* Header skeleton */}
      <div className="text-center mb-8">
        <div className="h-8 bg-gray-200 rounded mb-4 w-1/3 mx-auto animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded mb-6 w-1/2 mx-auto animate-pulse"></div>
      </div>

      {/* Course tabs skeleton */}
      <div className="mb-8">
        <div className="h-6 bg-gray-200 rounded mb-4 w-32 animate-pulse"></div>
        <div className="flex gap-2 mb-6">
          <div className="h-10 bg-gray-200 rounded w-40 animate-pulse"></div>
          <div className="h-10 bg-gray-200 rounded w-40 animate-pulse"></div>
        </div>
      </div>

      {/* Progress card skeleton */}
      <ProgressCardSkeleton />

      {/* Recommendations skeleton */}
      <div className="space-y-4">
        <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
        <RecommendationCardSkeleton />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RecommendationCardSkeleton />
          <RecommendationCardSkeleton />
        </div>
      </div>
    </div>
  );
}

// Progress Page Skeleton
export function ProgressPageSkeleton() {
  return (
    <div
      className="container mx-auto p-6 space-y-6"
      role="status"
      aria-live="polite"
      aria-label="Loading progress details"
    >
      {/* Back button skeleton */}
      <div className="h-10 bg-gray-200 rounded w-40 animate-pulse"></div>

      {/* Header skeleton */}
      <div className="mb-6">
        <div className="h-8 bg-gray-200 rounded mb-2 w-1/2 animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse"></div>
      </div>

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded mb-2 w-2/3"></div>
            <div className="h-8 bg-gray-200 rounded mb-1 w-1/2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/3"></div>
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="bg-white rounded-lg shadow p-6 mb-8 animate-pulse">
        <div className="h-6 bg-gray-200 rounded mb-4 w-1/3"></div>
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>

      {/* Session history skeleton */}
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded mb-4 w-1/4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Generic skeleton for inline loading
export function InlineLoadingSkeleton() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="space-y-3 w-full max-w-md">
        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded animate-pulse w-5/6"></div>
        <div className="h-4 bg-gray-200 rounded animate-pulse w-4/6"></div>
      </div>
    </div>
  );
}
