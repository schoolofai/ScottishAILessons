import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/server/appwrite';
import { Query } from 'node-appwrite';

/**
 * GET /api/admin/mock-exams
 *
 * Lists all mock exams (for admin dashboard).
 * Requires admin authentication via httpOnly cookie.
 *
 * Returns:
 * - 200: List of mock exams with metadata
 * - 401: Not authenticated or not admin
 * - 500: Server error
 */
export async function GET(request: NextRequest) {
  try {
    console.log(`[Admin MockExams API] Listing all mock exams...`);

    // Get authenticated session - REQUIRED
    const { account, databases } = await createSessionClient();
    const user = await account.get();

    console.log(`[Admin MockExams API] User authenticated: ${user.$id}`);

    // Check if user has admin label
    const labels = (user.labels || []) as string[];
    const isAdmin = labels.includes('admin');

    if (!isAdmin) {
      console.warn(`[Admin MockExams API] Non-admin user ${user.$id} attempted to list mock exams`);
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    // Fetch all mock exams
    const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
    const collectionId = 'mock_exams';

    const response = await databases.listDocuments(
      databaseId,
      collectionId,
      [
        Query.orderDesc('$createdAt'),
        Query.limit(100),
      ]
    );

    console.log(`[Admin MockExams API] Found ${response.total} mock exams`);

    // Return exam list with key metadata (without compressed content)
    const exams = response.documents.map((doc: any) => ({
      id: doc.$id,
      title: doc.title,
      courseId: doc.courseId,
      status: doc.status,
      version: doc.version,
      createdAt: doc.$createdAt,
      updatedAt: doc.$updatedAt,
    }));

    return NextResponse.json({
      success: true,
      total: response.total,
      exams,
    });

  } catch (error: any) {
    console.error('[Admin MockExams API] Failed to list mock exams:', error);

    // Handle authentication errors
    if (error.message && (error.message.includes('No session found') || error.message.includes('Invalid session'))) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated. Please log in.' },
        { status: 401 }
      );
    }

    // Generic error - fast fail with explicit message
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to list mock exams',
        details: error.code || String(error)
      },
      { status: 500 }
    );
  }
}
