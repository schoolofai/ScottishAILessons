import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/server/appwrite';
import { Query } from 'node-appwrite';
import { archiveEnrollment } from '@/lib/services/enrollment-service';

/**
 * POST /api/student/unenroll
 *
 * Un-enrolls (archives) the authenticated student from a course.
 * Requires authentication via httpOnly cookie.
 *
 * Request body:
 * - courseId: string
 *
 * Returns:
 * - 200: Un-enrollment successful
 *   - success: true
 * - 400: Missing courseId
 * - 401: Not authenticated
 * - 404: Student not found or not enrolled
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

    console.log(`[Unenroll API] Un-enrolling student from course: ${courseId}`);

    // Get authenticated session - REQUIRED for un-enrollment
    const { account, databases } = await createSessionClient();
    const user = await account.get();

    console.log(`[Unenroll API] Authenticated user: ${user.$id}`);

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

    console.log(`[Unenroll API] Found student: ${studentId}`);

    // Call archive enrollment service
    await archiveEnrollment(studentId, courseId, databases);

    console.log(`[Unenroll API] Successfully un-enrolled student ${studentId} from course ${courseId}`);

    return NextResponse.json({
      success: true,
      message: 'Successfully un-enrolled. Your progress is saved and you can re-enroll anytime.'
    });

  } catch (error: any) {
    console.error('[Unenroll API] Un-enrollment failed:', error);

    // Handle authentication errors
    if (error.message && error.message.includes('No session found')) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated. Please log in.' },
        { status: 401 }
      );
    }

    // Handle not enrolled errors
    if (error.code === 'NOT_ENROLLED' || error.message.includes('No enrollment found')) {
      return NextResponse.json(
        { success: false, error: 'You are not enrolled in this course.' },
        { status: 404 }
      );
    }

    // Generic error - fast fail with explicit message
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to un-enroll from course',
        details: error.code || String(error)
      },
      { status: 500 }
    );
  }
}
