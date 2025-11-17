import { NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/server/appwrite';
import { Query } from 'node-appwrite';

/**
 * GET /api/student/enrollments
 *
 * Fetches enrollments and courses for the authenticated student.
 * Returns both active and archived enrollments with full course data.
 *
 * Returns:
 * - 200: Enrollment and course data
 * - 401: Not authenticated
 * - 500: Server error
 */
export async function GET() {
  try {
    // Get authenticated session from httpOnly cookie
    const { account, databases } = await createSessionClient();

    // Get current user
    const user = await account.get();

    // Find student record
    const studentsResult = await databases.listDocuments(
      'default',
      'students',
      [Query.equal('userId', user.$id)]
    );

    if (studentsResult.documents.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Student record not found' },
        { status: 404 }
      );
    }

    const student = studentsResult.documents[0];

    // Get ALL enrollments
    const allEnrollmentsResult = await databases.listDocuments(
      'default',
      'enrollments',
      [Query.equal('studentId', student.$id)]
    );

    // Separate active and archived
    const activeEnrollments = allEnrollmentsResult.documents.filter((e: any) => {
      return !e.status || e.status === 'active';
    });

    const archivedEnrollments = allEnrollmentsResult.documents.filter((e: any) => {
      return e.status === 'archived';
    });

    // Get course IDs
    const activeCourseIds = activeEnrollments.map((e: any) => e.courseId);
    const archivedCourseIds = archivedEnrollments.map((e: any) => e.courseId);

    // Fetch courses
    let activeCourses = [];
    let archivedCourses = [];

    if (activeCourseIds.length > 0) {
      const activeCoursesResult = await databases.listDocuments(
        'default',
        'courses',
        [Query.equal('courseId', activeCourseIds)]
      );
      activeCourses = activeCoursesResult.documents;
    }

    if (archivedCourseIds.length > 0) {
      const archivedCoursesResult = await databases.listDocuments(
        'default',
        'courses',
        [Query.equal('courseId', archivedCourseIds)]
      );
      archivedCourses = archivedCoursesResult.documents;
    }

    return NextResponse.json({
      success: true,
      data: {
        student,
        enrollments: {
          active: activeEnrollments,
          archived: archivedEnrollments
        },
        courses: {
          active: activeCourses,
          archived: archivedCourses
        }
      }
    });

  } catch (error) {
    console.error('[API] /api/student/enrollments error:', error);

    if (error instanceof Error && error.message.includes('No session found')) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch enrollment data',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
