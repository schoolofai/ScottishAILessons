'use client';

import { Card, CardContent } from '../ui/card';
import { EnhancedCourseCard, type EnhancedCourseData } from '../courses/EnhancedCourseCard';
import { Loader2, Plus, BookOpen } from 'lucide-react';

interface DashboardCourseGridProps {
  courses: EnhancedCourseData[];
  onCourseSelect: (courseId: string) => void;
  onBrowseCourses: () => void;
  loading?: boolean;
}

/**
 * Skeleton loading state for course cards
 */
function CourseGridSkeleton() {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      data-testid="course-grid-skeleton"
    >
      {[1, 2, 3].map((i) => (
        <Card key={i} className="h-[220px] animate-shimmer">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              {/* Progress ring skeleton */}
              <div className="w-16 h-16 rounded-full bg-gray-200" />
              <div className="flex-1">
                {/* Title skeleton */}
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-2" />
                {/* Badge skeleton */}
                <div className="h-5 bg-gray-200 rounded w-1/3" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {/* Lesson count skeleton */}
              <div className="h-4 bg-gray-200 rounded w-2/3" />
              {/* Next lesson skeleton */}
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
            {/* Button skeleton */}
            <div className="mt-4 h-10 bg-gray-200 rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Empty state when no courses are enrolled
 */
function EmptyCourseState({ onBrowseCourses }: { onBrowseCourses: () => void }) {
  return (
    <div
      className="text-center py-12 bg-white rounded-lg shadow-md"
      data-testid="course-grid-empty"
    >
      <BookOpen className="h-16 w-16 mx-auto mb-4 text-blue-600" />
      <h2 className="text-2xl font-bold mb-4">No courses yet!</h2>
      <p className="text-gray-600 mb-6 max-w-md mx-auto">
        Start your learning journey by enrolling in a course from our catalog.
      </p>
      <button
        onClick={onBrowseCourses}
        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
      >
        Browse Courses
      </button>
    </div>
  );
}

/**
 * "Add More Courses" card for the grid
 */
function AddCourseCard({ onClick }: { onClick: () => void }) {
  return (
    <Card
      className="h-full flex flex-col items-center justify-center cursor-pointer border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-all duration-300 min-h-[220px]"
      onClick={onClick}
      data-testid="add-course-card"
    >
      <CardContent className="flex flex-col items-center justify-center text-center p-6">
        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
          <Plus className="h-8 w-8 text-blue-600" />
        </div>
        <h3 className="font-semibold text-gray-700 mb-1">Browse More Courses</h3>
        <p className="text-sm text-gray-500">
          Explore our catalog
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * DashboardCourseGrid - Responsive grid layout for course cards
 *
 * Features:
 * - Responsive grid: 1 column (mobile) → 2 columns (tablet) → 3 columns (desktop)
 * - Staggered fade-in animation for playful reveal
 * - Loading skeleton state
 * - Empty state with CTA
 * - "Add Course" card for discoverability
 */
export function DashboardCourseGrid({
  courses,
  onCourseSelect,
  onBrowseCourses,
  loading = false
}: DashboardCourseGridProps) {
  if (loading) {
    return <CourseGridSkeleton />;
  }

  if (courses.length === 0) {
    return <EmptyCourseState onBrowseCourses={onBrowseCourses} />;
  }

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      data-testid="dashboard-course-grid"
    >
      {courses.map((course, index) => (
        <div
          key={course.id}
          className="animate-fade-in"
          style={{ animationDelay: `${index * 0.05}s` }}
        >
          <EnhancedCourseCard
            course={course}
            onClick={() => onCourseSelect(course.id)}
          />
        </div>
      ))}

      {/* Add Course Card */}
      <div
        className="animate-fade-in"
        style={{ animationDelay: `${courses.length * 0.05}s` }}
      >
        <AddCourseCard onClick={onBrowseCourses} />
      </div>
    </div>
  );
}

export default DashboardCourseGrid;
