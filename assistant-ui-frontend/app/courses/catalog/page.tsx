'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CourseCard } from '@/components/courses/CourseCard';
import { CourseFilterBar } from '@/components/courses/CourseFilterBar';
import { Button } from '@/components/ui/button';
import { Loader2, GraduationCap, ArrowLeft } from 'lucide-react';

export default function CourseCatalogPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<any[]>([]);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    level: 'all',
    subject: 'all',
    search: ''
  });

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      const { Client, Databases, Account, Query } = await import('appwrite');

      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

      const databases = new Databases(client);
      const account = new Account(client);

      // Get all courses
      const coursesResult = await databases.listDocuments('default', 'courses');

      // Get student enrollments
      try {
        const user = await account.get();
        const studentsResult = await databases.listDocuments('default', 'students',
          [Query.equal('userId', user.$id)]
        );

        if (studentsResult.documents.length > 0) {
          const student = studentsResult.documents[0];
          const enrollmentsResult = await databases.listDocuments('default', 'enrollments',
            [Query.equal('studentId', student.$id)]
          );

          setEnrolledCourseIds(enrollmentsResult.documents.map((e: any) => e.courseId));
        }
      } catch (err) {
        // User not logged in - show all courses without enrollment status
        console.log('User not logged in, showing public catalog');
      }

      setCourses(coursesResult.documents);
    } catch (error) {
      console.error('Failed to load courses:', error);
    } finally {
      setLoading(false);
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
            {filteredCourses.map(course => (
              <CourseCard
                key={course.courseId}
                course={course}
                enrolled={enrolledCourseIds.includes(course.courseId)}
                onClick={() => router.push(`/courses/${course.courseId}`)}
              />
            ))}
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
    </div>
  );
}
