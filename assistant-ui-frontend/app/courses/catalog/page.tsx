'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CourseCard } from '@/components/courses/CourseCard';
import { CourseFilterBar } from '@/components/courses/CourseFilterBar';
import { Button } from '@/components/ui/button';
import { Loader2, GraduationCap, ArrowLeft } from 'lucide-react';
import { UnenrollConfirmationModal } from '@/components/dialogs/UnenrollConfirmationModal';
import { type EnrollmentStatus } from '@/lib/services/enrollment-service';
import { toast } from 'sonner';

export default function CourseCatalogPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<any[]>([]);
  const [enrollmentStatusMap, setEnrollmentStatusMap] = useState<Map<string, EnrollmentStatus>>(new Map());
  const [studentId, setStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    level: 'all',
    subject: 'all',
    search: ''
  });

  // Unenroll modal state
  const [unenrollModalOpen, setUnenrollModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      console.log('[Catalog] Fetching courses from API...');

      const response = await fetch('/api/courses/catalog', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch courses: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load courses');
      }

      const { courses: catalogCourses, enrollmentStatusMap: statusMapData, studentId: sid } = result.data;

      // Set courses
      setCourses(catalogCourses);
      console.log(`[Catalog] Loaded ${catalogCourses.length} courses`);

      // Convert enrollment status map from object to Map
      const statusMap = new Map<string, EnrollmentStatus>();
      Object.entries(statusMapData || {}).forEach(([courseId, status]) => {
        statusMap.set(courseId, status as EnrollmentStatus);
      });

      setEnrollmentStatusMap(statusMap);
      setStudentId(sid);
      console.log(`[Catalog] Loaded ${statusMap.size} enrollments`);

    } catch (error: any) {
      console.error('[Catalog] Failed to load courses:', error);
      throw error; // Fast fail, no silent errors
    } finally {
      setLoading(false);
    }
  };

  // Handler for un-enrollment
  const handleUnenroll = (courseId: string, courseName: string) => {
    setSelectedCourse({ id: courseId, name: courseName });
    setUnenrollModalOpen(true);
  };

  const confirmUnenroll = async () => {
    if (!selectedCourse) {
      throw new Error('Missing required data for un-enrollment');
    }

    try {
      console.log(`[Catalog] Un-enrolling from course: ${selectedCourse.id}`);

      const response = await fetch('/api/student/unenroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ courseId: selectedCourse.id }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to un-enroll from course');
      }

      // Update local state
      setEnrollmentStatusMap(prev => {
        const updated = new Map(prev);
        updated.set(selectedCourse.id, 'archived');
        return updated;
      });

      toast.success('Successfully un-enrolled. Your progress is saved and you can re-enroll anytime.');
    } catch (error: any) {
      console.error('[Catalog] Failed to un-enroll:', error);
      toast.error(error.message || 'Failed to un-enroll from course. Please try again.');
      throw error; // Fast fail, no fallback
    } finally {
      setUnenrollModalOpen(false);
      setSelectedCourse(null);
    }
  };

  // Handler for re-enrollment
  const handleReenroll = async (courseId: string, courseName: string) => {
    try {
      console.log(`[Catalog] Re-enrolling in course: ${courseId}`);

      const response = await fetch('/api/student/enroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ courseId }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        if (response.status === 401) {
          toast.error('You must be logged in to enroll');
          router.push('/login');
          return;
        }
        throw new Error(result.error || 'Failed to enroll in course');
      }

      // Update local state
      setEnrollmentStatusMap(prev => {
        const updated = new Map(prev);
        updated.set(courseId, 'active');
        return updated;
      });

      toast.success(`Welcome back! Your progress in ${courseName} has been restored.`);
    } catch (error: any) {
      console.error('[Catalog] Failed to re-enroll:', error);
      toast.error(error.message || 'Failed to re-enroll in course. Please try again.');
      throw error; // Fast fail, no fallback
    }
  };

  const filteredCourses = courses.filter(course => {
    // Level filter
    if (filters.level !== 'all' && course.level?.toLowerCase() !== filters.level) {
      return false;
    }

    // Subject filter
    if (filters.subject !== 'all' && course.subject?.toLowerCase() !== filters.subject) {
      return false;
    }

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        course.subject?.toLowerCase().includes(searchLower) ||
        course.level?.toLowerCase().includes(searchLower) ||
        course.description?.toLowerCase().includes(searchLower)
      );
    }

    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading courses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => router.back()}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                  <GraduationCap className="h-8 w-8 text-blue-600" />
                  Course Catalog
                </h1>
                <p className="text-gray-600 mt-1">
                  Browse and enroll in Scottish Curriculum aligned courses
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Filters */}
        <CourseFilterBar filters={filters} onChange={setFilters} />

        {/* Results count */}
        <div className="my-6">
          <p className="text-sm text-gray-600">
            Showing {filteredCourses.length} of {courses.length} courses
          </p>
        </div>

        {/* Course grid */}
        {filteredCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map(course => {
              const enrollmentStatus = enrollmentStatusMap.get(course.courseId) || null;
              return (
                <CourseCard
                  key={course.courseId}
                  course={course}
                  enrollmentStatus={enrollmentStatus}
                  onClick={() => router.push(`/courses/${course.courseId}`)}
                  onEnroll={() => handleReenroll(course.courseId, course.subject)}
                  onUnenroll={() => handleUnenroll(course.courseId, course.subject)}
                />
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-lg shadow-sm">
            <GraduationCap className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              No courses found
            </h3>
            <p className="text-gray-500 mb-4">
              Try adjusting your filters to see more courses
            </p>
            <Button
              onClick={() => setFilters({ level: 'all', subject: 'all', search: '' })}
              variant="outline"
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>

      {/* Un-enrollment confirmation modal */}
      {selectedCourse && (
        <UnenrollConfirmationModal
          isOpen={unenrollModalOpen}
          courseName={selectedCourse.name}
          onConfirm={confirmUnenroll}
          onCancel={() => {
            setUnenrollModalOpen(false);
            setSelectedCourse(null);
          }}
        />
      )}
    </div>
  );
}
