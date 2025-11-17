import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/server/appwrite';
import { Query } from 'node-appwrite';

/**
 * GET /api/courses/[courseId]
 *
 * Fetches detailed course information with optional enrollment status.
 * This endpoint serves both public (anonymous) and authenticated requests.
 *
 * Returns:
 * - 200: Course details
 *   - course: Course document
 *   - outcomes: Learning outcomes for the course
 *   - lessons: Lesson templates from published SOW (version 1)
 *   - isEnrolled: Whether student is enrolled (only if authenticated)
 *   - studentId: Student document ID (only if authenticated)
 * - 404: Course not found
 * - 500: Server error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    const { courseId } = params;

    if (!courseId) {
      return NextResponse.json(
        { success: false, error: 'Course ID is required' },
        { status: 400 }
      );
    }

    console.log(`[Course Detail API] Fetching course: ${courseId}`);

    // Try to get authenticated session (optional - user may not be logged in)
    let databases;
    let isAuthenticated = false;
    let user = null;
    let studentId = null;
    let isEnrolled = false;

    try {
      const session = await createSessionClient();
      databases = session.databases;
      user = await session.account.get();
      isAuthenticated = true;
      console.log(`[Course Detail API] Authenticated user: ${user.$id}`);
    } catch (authError) {
      // User not authenticated - that's OK, we'll show public course details
      console.log('[Course Detail API] Anonymous user, showing public course details');

      // Create unauthenticated client for public data
      const { Databases, Client } = await import('node-appwrite');
      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);
      databases = new Databases(client);
    }

    // Get course details - query by courseId field, not document ID
    const coursesResult = await databases.listDocuments('default', 'courses', [
      Query.equal('courseId', courseId)
    ]);

    if (coursesResult.documents.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Course not found' },
        { status: 404 }
      );
    }

    const courseDoc = coursesResult.documents[0];
    console.log(`[Course Detail API] Found course: ${courseDoc.subject}`);

    // Get course outcomes
    const outcomesResult = await databases.listDocuments('default', 'course_outcomes', [
      Query.equal('courseId', courseId)
    ]);

    console.log(`[Course Detail API] Found ${outcomesResult.documents.length} outcomes`);

    // Get lesson templates (from latest published Authored_SOW version 1)
    let lessons: any[] = [];
    try {
      const authoredSOWResult = await databases.listDocuments('default', 'Authored_SOW', [
        Query.equal('courseId', courseId),
        Query.equal('version', '1'), // Only version 1 (production)
        Query.equal('status', 'published'),
        Query.limit(1)
      ]);

      if (authoredSOWResult.documents.length > 0) {
        const authoredSOW = authoredSOWResult.documents[0];
        // Decompress entries
        const { decompressJSON } = await import('@/lib/appwrite/utils/compression');
        lessons = decompressJSON(authoredSOW.entries);
        console.log(`[Course Detail API] Found ${lessons.length} lessons in published SOW`);
      } else {
        console.log(`[Course Detail API] No published SOW v1 found for course ${courseId}`);
      }
    } catch (sowError) {
      console.error('[Course Detail API] Error loading lesson templates:', sowError);
      // Don't fail the whole request - just return without lessons
    }

    // Check enrollment status if authenticated
    if (isAuthenticated && user) {
      try {
        // Get student record
        const studentsResult = await databases.listDocuments('default', 'students', [
          Query.equal('userId', user.$id)
        ]);

        if (studentsResult.documents.length > 0) {
          const student = studentsResult.documents[0];
          studentId = student.$id;

          // Check enrollment
          const enrollmentsResult = await databases.listDocuments('default', 'enrollments', [
            Query.equal('studentId', student.$id),
            Query.equal('courseId', courseId)
          ]);

          // Consider enrolled if ANY enrollment exists (active or archived)
          isEnrolled = enrollmentsResult.documents.length > 0;
          console.log(`[Course Detail API] Student ${studentId} enrollment status: ${isEnrolled}`);
        } else {
          console.log(`[Course Detail API] No student record found for user ${user.$id}`);
        }
      } catch (enrollmentError) {
        console.error('[Course Detail API] Failed to check enrollment status:', enrollmentError);
        // Don't fail the whole request - just return without enrollment status
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        course: courseDoc,
        outcomes: outcomesResult.documents,
        lessons,
        isEnrolled,
        studentId,
        isAuthenticated
      }
    });

  } catch (error: any) {
    console.error('[Course Detail API] Fatal error:', error);

    // Fast fail - throw explicit error, no fallbacks
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load course details',
        details: error.message || String(error)
      },
      { status: 500 }
    );
  }
}
