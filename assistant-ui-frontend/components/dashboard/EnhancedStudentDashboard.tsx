"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DashboardCourseGrid } from "./DashboardCourseGrid";
import { Button } from "../ui/button";
import { Alert, AlertDescription } from "../ui/alert";
import { BookOpen, Archive, ChevronDown, ChevronUp } from "lucide-react";
import { DashboardSkeleton } from "../ui/LoadingSkeleton";
import { CourseCard } from "../courses/CourseCard";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import { SubscriptionPaywallModal, type PriceInfo } from "./SubscriptionPaywallModal";
import { SubscriptionStatusBanner } from "../subscription/SubscriptionStatusBanner";
import type { EnhancedCourseData } from "../courses/EnhancedCourseCard";
import {
  type Course,
  formatErrorMessage,
  getStudentDisplayName
} from "../../lib/dashboard/utils";

/**
 * Transform courses from API format to EnhancedCourseData format for the grid
 */
function transformToEnhancedCourseData(courses: Course[]): EnhancedCourseData[] {
  return courses.map(course => ({
    id: course.courseId,
    subject: course.subject,
    level: course.level || 'unknown',
    progress: course.progress || 0,
    completedLessons: course.completedLessons || 0,
    totalLessons: course.totalLessons || 0,
    nextLessonTitle: course.nextLessonTitle,
    overdueLessons: course.overdueLessons || 0,
    status: 'active' as const
  }));
}

/**
 * EnhancedStudentDashboard - Main dashboard with gamified course card grid
 *
 * This component displays:
 * - Welcome header with student name
 * - Course cards in a responsive grid layout
 * - Archived courses section
 * - Subscription status banner and paywall
 *
 * Course-specific content (curriculum, recommendations, exams) is now
 * displayed on the dedicated course detail page at /dashboard/course/[courseId]
 */
export function EnhancedStudentDashboard() {
  const router = useRouter();

  // Student state
  const [student, setStudent] = useState<any>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseData, setCourseData] = useState<EnhancedCourseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [error, setError] = useState("");
  const [coursesError, setCoursesError] = useState<string | null>(null);

  // Archived courses state
  const [archivedCourses, setArchivedCourses] = useState<Course[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  // Subscription paywall state
  const { hasAccess, isLoading: subscriptionLoading } = useSubscription();
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [subscriptionPrice, setSubscriptionPrice] = useState<PriceInfo | null>(null);

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  useEffect(() => {
    initializeStudent();
  }, []);

  // Prefetch subscription price for instant paywall modal display
  useEffect(() => {
    const fetchSubscriptionPrice = async () => {
      try {
        const response = await fetch('/api/stripe/product-info');
        if (response.ok) {
          const data = await response.json();
          setSubscriptionPrice(data);
        }
      } catch (error) {
        // Silently fail - modal will use fallback price
      }
    };

    fetchSubscriptionPrice();
  }, []);

  // Initialize student using server-side API (SSR-compatible)
  const initializeStudent = async () => {
    try {
      setLoading(true);
      setError("");

      // Call server-side API that uses httpOnly session cookie
      const response = await fetch('/api/student/me');

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Not authenticated. Please log in.');
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch student data');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load student data');
      }

      setStudent(data.student);

      // Load enrollments and courses from server API
      await loadEnrollmentsFromAPI(data.student);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize student");

      // Redirect to login if authentication failed
      if (err instanceof Error && err.message.includes('Not authenticated')) {
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  // Load enrollments and courses from server-side API
  const loadEnrollmentsFromAPI = async (studentData: any) => {
    try {
      setCoursesLoading(true);
      setCoursesError(null);

      const response = await fetch('/api/student/enrollments');

      if (!response.ok) {
        throw new Error('Failed to fetch enrollments');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load enrollments');
      }

      const { enrollments, courses: coursesData } = result.data;

      // Set active and archived courses
      setCourses(coursesData.active);
      setArchivedCourses(coursesData.archived);

      // Transform for the card grid
      const transformedCourses = transformToEnhancedCourseData(coursesData.active);
      setCourseData(transformedCourses);

      // Check if no active enrollments
      if (enrollments.active.length === 0) {
        setCoursesError('No active enrollments found. Please enroll in a course to get started.');
        return;
      }

    } catch (err) {
      console.error('[Dashboard] Failed to load enrollments:', err);
      setCoursesError(formatErrorMessage(err));
      throw err;
    } finally {
      setCoursesLoading(false);
    }
  };

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  // Handle course selection - navigate to course detail page
  const handleCourseSelect = useCallback((courseId: string) => {
    router.push(`/dashboard/course/${courseId}`);
  }, [router]);

  // Handle browse courses navigation
  const handleBrowseCourses = useCallback(() => {
    router.push('/courses/catalog');
  }, [router]);

  // Handle re-enrollment from archived courses
  const handleReenroll = async (courseId: string, courseName: string) => {
    if (!student) {
      toast.error('Student data not available');
      throw new Error('Student data not available');
    }

    try {
      const response = await fetch('/api/student/enroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ courseId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to re-enroll' }));
        throw new Error(errorData.error || 'Failed to re-enroll in course');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to re-enroll in course');
      }

      // Reload courses to update the UI
      await loadEnrollmentsFromAPI(student);

      toast.success(`Welcome back! Your progress in ${courseName} has been restored.`);
    } catch (error) {
      console.error('Failed to re-enroll:', error);
      toast.error('Failed to re-enroll in course. Please try again.');
      throw error;
    }
  };

  // Handle dashboard retry (for initialization failures)
  const handleDashboardRetry = useCallback(() => {
    initializeStudent();
  }, []);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const studentDisplayName = useMemo(() => getStudentDisplayName(student), [student]);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="container mx-auto p-6" data-testid="dashboard-error">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button
          onClick={handleDashboardRetry}
          className="mt-4"
          data-testid="dashboard-retry"
        >
          Retry
        </Button>
      </div>
    );
  }

  // Empty state: No enrollments
  if (courseData.length === 0 && !coursesLoading) {
    return (
      <div className="container mx-auto p-6" data-testid="dashboard-empty">
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <BookOpen className="h-16 w-16 mx-auto mb-4 text-blue-600" />
          <h2 className="text-2xl font-bold mb-4">Welcome to Scottish AI Lessons!</h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            You haven't enrolled in any courses yet. Browse our course catalog to get started with your learning journey.
          </p>
          <Button
            onClick={handleBrowseCourses}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Browse Courses
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="student-dashboard">
      {/* Subscription Status Banner */}
      <SubscriptionStatusBanner />

      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Welcome back, {studentDisplayName}!
        </h1>
        <p className="text-gray-600">
          You have <strong>{courseData.length}</strong> active course{courseData.length !== 1 ? 's' : ''}.
          Select one to continue learning.
        </p>
      </div>

      {/* Course Cards Grid */}
      <div data-testid="course-navigation-section">
        <h2 className="text-xl font-semibold flex items-center mb-4">
          <BookOpen className="h-5 w-5 mr-2" />
          Your Courses
        </h2>
        <DashboardCourseGrid
          courses={courseData}
          onCourseSelect={handleCourseSelect}
          onBrowseCourses={handleBrowseCourses}
          loading={coursesLoading}
        />
      </div>

      {/* Archived Courses Section */}
      {archivedCourses.length > 0 && (
        <div className="mt-8" data-testid="archived-courses-section">
          <Button
            variant="ghost"
            onClick={() => setShowArchived(!showArchived)}
            className="mb-4 w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 hover:bg-gray-100"
          >
            <div className="flex items-center gap-2">
              <Archive className="h-4 w-4 text-gray-600" />
              <span className="font-semibold text-gray-700">
                Archived Courses ({archivedCourses.length})
              </span>
            </div>
            {showArchived ? (
              <ChevronUp className="h-4 w-4 text-gray-600" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-600" />
            )}
          </Button>

          {showArchived && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-75">
              {archivedCourses.map((course: any) => (
                <CourseCard
                  key={course.courseId}
                  course={course}
                  enrollmentStatus="archived"
                  onClick={() => router.push(`/courses/${course.courseId}`)}
                  onEnroll={() => handleReenroll(course.courseId, course.subject)}
                  onUnenroll={() => {}}
                />
              ))}
            </div>
          )}

          {showArchived && archivedCourses.length > 0 && (
            <p className="text-sm text-gray-500 mt-4 text-center">
              Archived courses preserve all your progress. Click "Re-enroll" to restore a course to your active list.
            </p>
          )}
        </div>
      )}

      {/* Subscription paywall modal */}
      <SubscriptionPaywallModal
        isOpen={showPaywallModal}
        onClose={() => setShowPaywallModal(false)}
        priceInfo={subscriptionPrice}
      />
    </div>
  );
}

export default EnhancedStudentDashboard;
