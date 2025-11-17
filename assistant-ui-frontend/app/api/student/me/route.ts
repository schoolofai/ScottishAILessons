import { NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/server/appwrite';
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
  try {
    // Get authenticated session from httpOnly cookie
    const { account, databases } = await createSessionClient();

    // Get current user from session
    const user = await account.get();

    // Find student record by userId
    const studentsResult = await databases.listDocuments(
      'default',
      'students',
      [Query.equal('userId', user.$id)]
    );

    if (studentsResult.documents.length === 0) {
      // Student record doesn't exist - create it
      const newStudent = await databases.createDocument(
        'default',
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
    console.error('[API] /api/student/me error:', error);

    // Check if it's an authentication error
    if (error instanceof Error && error.message.includes('No session found')) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Generic server error
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
