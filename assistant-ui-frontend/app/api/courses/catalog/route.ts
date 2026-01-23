import { NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/server/appwrite';
import { Query } from 'node-appwrite';
import { AuthoredSOWDriver } from '@/lib/appwrite/driver/AuthoredSOWDriver';

/**
 * GET /api/courses/catalog
 *
 * Fetches course catalog with optional enrollment status for authenticated users.
 * This endpoint serves both public (anonymous) and authenticated requests.
 *
 * Returns:
 * - 200: Course catalog data
 *   - courses: Filtered courses with published SOWs
 *   - enrollmentStatusMap: Map of courseId -> enrollment status (only if authenticated)
 *   - studentId: Student document ID (only if authenticated)
 * - 500: Server error
 */
export async function GET() {
  try {
    // Try to get authenticated session (optional - user may not be logged in)
    let databases;
    let storage;
    let isAuthenticated = false;
    let user = null;
    let studentId = null;

    try {
      const session = await createSessionClient();
      databases = session.databases;
      storage = session.storage;
      user = await session.account.get();
      isAuthenticated = true;
    } catch (authError) {
      // User not authenticated - that's OK, we'll show public catalog
      console.log('[Catalog API] Anonymous user, showing public catalog');

      // Create unauthenticated client for public data (need both Databases AND Storage)
      const { Databases, Client, Storage } = await import('node-appwrite');
      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);
      databases = new Databases(client);
      storage = new Storage(client);
    }

    // Get all courses (increase limit to load all courses, not just default 25)
    const coursesResult = await databases.listDocuments('default', 'courses', [
      Query.limit(500)
    ]);

    console.log(`[Catalog API] Loaded ${coursesResult.documents.length} total courses`);

    // Filter courses to only those with published SOWs (version 1)
    // Pass both databases and storage to support storage-backed SOW entries
    const sowDriver = new AuthoredSOWDriver(databases, storage);
    const publishedCourseIds = await sowDriver.getPublishedCourseIds();

    const coursesWithPublishedSOWs = coursesResult.documents.filter(
      (course: any) => publishedCourseIds.has(course.courseId)
    );

    console.log(
      `[Catalog API] Filtered to ${coursesWithPublishedSOWs.length} courses with published SOWs`
    );

    // Build enrollment status map if authenticated
    const enrollmentStatusMap: Record<string, string> = {};

    if (isAuthenticated && user) {
      try {
        // Get student record
        const studentsResult = await databases.listDocuments('default', 'students', [
          Query.equal('userId', user.$id)
        ]);

        if (studentsResult.documents.length > 0) {
          const student = studentsResult.documents[0];
          studentId = student.$id;

          // Get all enrollments for this student
          const enrollmentsResult = await databases.listDocuments('default', 'enrollments', [
            Query.equal('studentId', student.$id)
          ]);

          // Build enrollment status map
          enrollmentsResult.documents.forEach((enrollment: any) => {
            // Default to 'active' for backward compatibility with old records
            const status = enrollment.status || 'active';
            enrollmentStatusMap[enrollment.courseId] = status;
          });

          console.log(`[Catalog API] Loaded ${Object.keys(enrollmentStatusMap).length} enrollments for student ${studentId}`);
        } else {
          console.log(`[Catalog API] No student record found for user ${user.$id}`);
        }
      } catch (enrollmentError) {
        console.error('[Catalog API] Failed to load enrollment status:', enrollmentError);
        // Don't fail the whole request - just return without enrollment status
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        courses: coursesWithPublishedSOWs,
        enrollmentStatusMap,
        studentId,
        isAuthenticated
      }
    });

  } catch (error: any) {
    console.error('[Catalog API] Fatal error:', error);

    // Fast fail - throw explicit error, no fallbacks
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load course catalog',
        details: error.message || String(error)
      },
      { status: 500 }
    );
  }
}
