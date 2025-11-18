import { NextResponse } from 'next/server';
import { createSessionClient, appwriteConfig } from '@/lib/server/appwrite';
import { Query } from 'node-appwrite';

/**
 * GET /api/student/me
 *
 * Fetches the current authenticated student's data.
 * Uses server-side session from httpOnly cookie.
 *
 * Returns:
 * - 200: Student data
 * - 401: Not authenticated
 * - 500: Server error
 */
export async function GET() {
  // Step 1: Authenticate user - wrap both createSessionClient and account.get in try-catch
  // This ensures expired/invalid sessions return 401, not 500
  let user;
  let databases;
  try {
    const sessionClient = await createSessionClient();
    databases = sessionClient.databases;
    user = await sessionClient.account.get();
  } catch (error: any) {
    console.error('[API] /api/student/me authentication failed:', error);
    return NextResponse.json(
      { success: false, error: 'Not authenticated' },
      { status: 401 }
    );
  }

  try {

    // Find student record by userId
    const studentsResult = await databases.listDocuments(
      appwriteConfig.databaseId,
      'students',
      [Query.equal('userId', user.$id)]
    );

    if (studentsResult.documents.length === 0) {
      // Student record doesn't exist - create it
      const newStudent = await databases.createDocument(
        appwriteConfig.databaseId,
        'students',
        user.$id, // Use user ID as document ID for consistency
        {
          userId: user.$id,
          name: user.name || user.email.split('@')[0],
          role: 'student'
        },
        [`read("user:${user.$id}")`, `write("user:${user.$id}")`]
      );

      return NextResponse.json({
        success: true,
        student: newStudent,
        user: {
          $id: user.$id,
          email: user.email,
          name: user.name
        }
      });
    }

    // Return existing student record
    return NextResponse.json({
      success: true,
      student: studentsResult.documents[0],
      user: {
        $id: user.$id,
        email: user.email,
        name: user.name
      }
    });

  } catch (error) {
    console.error('[API] /api/student/me database error:', error);

    // Database operation failed - return 500
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch student data',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
