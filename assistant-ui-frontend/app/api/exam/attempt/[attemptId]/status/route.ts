import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/server/appwrite';
import { Query } from 'node-appwrite';

/**
 * GET /api/exam/attempt/[attemptId]/status
 *
 * Lightweight endpoint to check the status of an exam attempt.
 * Used for polling during grading process.
 * Returns: { status, gradedAt?, hasResults }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await params;

    if (!attemptId) {
      return NextResponse.json(
        { success: false, error: 'Attempt ID is required' },
        { status: 400 }
      );
    }

    // Get authenticated user using secure httpOnly cookie
    const { account, databases } = await createSessionClient();
    const user = await account.get();

    // Get student record to verify ownership
    const studentsResult = await databases.listDocuments(
      'default',
      'students',
      [Query.equal('userId', user.$id)]
    );

    if (studentsResult.documents.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Student profile not found' },
        { status: 404 }
      );
    }

    const student = studentsResult.documents[0];

    // Get the attempt
    const attempt = await databases.getDocument(
      'default',
      'exam_attempts',
      attemptId
    );

    // Verify the student owns this attempt
    if (attempt.studentId !== student.$id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - not your attempt' },
        { status: 403 }
      );
    }

    // Return status information
    return NextResponse.json({
      success: true,
      attemptId: attempt.$id,
      status: attempt.status,
      gradedAt: attempt.gradedAt || null,
      hasResults: attempt.status === 'graded' && !!attempt.resultSnapshot,
      // Include error info if grading failed
      gradingError: attempt.gradingError || null,
      // Progress info
      submittedAt: attempt.submittedAt || null,
    });
  } catch (error: any) {
    console.error('[API/exam/attempt/status] Error:', error);

    // Handle authentication errors
    if (error.message && error.message.includes('No session found')) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated. Please log in.' },
        { status: 401 }
      );
    }

    // Handle not found
    if (error.code === 404 || error.message?.includes('not found')) {
      return NextResponse.json(
        { success: false, error: 'Attempt not found' },
        { status: 404 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to get status';

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
