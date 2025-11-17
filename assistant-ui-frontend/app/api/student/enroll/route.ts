import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/server/appwrite';
import { Query } from 'node-appwrite';
import { enrollStudentInCourse } from '@/lib/services/enrollment-service';

/**
 * POST /api/student/enroll
 *
 * Enrolls the authenticated student in a course.
 * Requires authentication via httpOnly cookie.
 *
 * Request body:
 * - courseId: string
 *
 * Returns:
 * - 200: Enrollment successful
 *   - success: true
 *   - enrollment: Enrollment document
 * - 400: Missing courseId
 * - 401: Not authenticated
 * - 500: Server error (with explicit error message)
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { courseId } = body;

    if (!courseId) {
      return NextResponse.json(
        { success: false, error: 'Course ID is required' },
        { status: 400 }
      );
    }

    console.log(`[Enroll API] Enrolling student in course: ${courseId}`);

    // Get authenticated session - REQUIRED for enrollment
    const { account, databases } = await createSessionClient();
    const user = await account.get();

    console.log(`[Enroll API] Authenticated user: ${user.$id}`);

    // Get student record
    const studentsResult = await databases.listDocuments('default', 'students', [
      Query.equal('userId', user.$id)
    ]);

    if (studentsResult.documents.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Student record not found. Please contact support.' },
        { status: 404 }
      );
    }

    const student = studentsResult.documents[0];
    const studentId = student.$id;

    console.log(`[Enroll API] Found student: ${studentId}`);

    // Call enrollment service
    const enrollment = await enrollStudentInCourse(studentId, courseId, databases);

    console.log(`[Enroll API] Successfully enrolled student ${studentId} in course ${courseId}`);

    return NextResponse.json({
      success: true,
      enrollment
    });

  } catch (error: any) {
    console.error('[Enroll API] Enrollment failed:', error);

    // Handle authentication errors
    if (error.message && error.message.includes('No session found')) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated. Please log in to enroll.' },
        { status: 401 }
      );
    }

    // Handle duplicate enrollment errors
    if (error.code === 'DUPLICATE_ENROLLMENT') {
      return NextResponse.json(
        { success: false, error: 'You are already enrolled in this course.' },
        { status: 409 }
      );
    }

    // Handle missing SOW errors
    if (error.code === 'NO_AUTHORED_SOW') {
      return NextResponse.json(
        { success: false, error: 'This course is not yet available for enrollment.' },
        { status: 400 }
      );
    }

    // Generic error - fast fail with explicit message
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to enroll in course',
        details: error.code || String(error)
      },
      { status: 500 }
    );
  }
}
