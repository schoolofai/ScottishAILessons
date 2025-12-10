import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/server/appwrite';

/**
 * POST /api/admin/mock-exams/[id]/publish
 *
 * Publishes a mock exam by updating its status to 'published'.
 * Requires admin authentication via httpOnly cookie.
 *
 * Returns:
 * - 200: Mock exam published successfully
 * - 400: Invalid exam ID
 * - 401: Not authenticated or not admin
 * - 404: Mock exam not found
 * - 500: Server error
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: examId } = await params;

    console.log(`[Admin MockExams Publish API] Publishing mock exam ${examId}...`);

    // Validate exam ID
    if (!examId || examId.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Mock exam ID is required for publishing' },
        { status: 400 }
      );
    }

    // Get authenticated session - REQUIRED
    const { account, databases } = await createSessionClient();
    const user = await account.get();

    console.log(`[Admin MockExams Publish API] User authenticated: ${user.$id}`);

    // Check if user has admin label
    const labels = (user.labels || []) as string[];
    const isAdmin = labels.includes('admin');

    if (!isAdmin) {
      console.warn(`[Admin MockExams Publish API] Non-admin user ${user.$id} attempted to publish mock exam`);
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    console.log(`[Admin MockExams Publish API] Admin user ${user.$id} publishing mock exam ${examId}`);

    // Update mock exam status to 'published'
    const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
    const collectionId = 'mock_exams';

    const updatedDoc = await databases.updateDocument(
      databaseId,
      collectionId,
      examId,
      { status: 'published' }
    );

    console.info(`✅ Mock exam ${examId} published successfully`);

    return NextResponse.json({
      success: true,
      message: `Mock exam ${examId} published successfully`,
      exam: {
        id: updatedDoc.$id,
        title: updatedDoc.title,
        status: updatedDoc.status,
        courseId: updatedDoc.courseId,
      }
    });

  } catch (error: any) {
    console.error('[Admin MockExams Publish API] Failed to publish mock exam:', error);

    // Handle authentication errors
    if (error.message && (error.message.includes('No session found') || error.message.includes('Invalid session'))) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated. Please log in.' },
        { status: 401 }
      );
    }

    // Handle document not found errors
    if (error.code === 404 || error.message?.includes('not found')) {
      const { id } = await (arguments[1] as { params: Promise<{ id: string }> }).params;
      return NextResponse.json(
        { success: false, error: `Mock exam not found: ${id}` },
        { status: 404 }
      );
    }

    // Generic error - fast fail with explicit message
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to publish mock exam',
        details: error.code || String(error)
      },
      { status: 500 }
    );
  }
}
