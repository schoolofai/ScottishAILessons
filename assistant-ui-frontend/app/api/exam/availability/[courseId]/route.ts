import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/server/appwrite';
import { Query } from 'node-appwrite';

/**
 * GET /api/exam/availability/[courseId]
 *
 * Checks if a course has published mock exams available.
 * Used by the dashboard to conditionally show "Take Mock Exam" button.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;

    if (!courseId || courseId.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Course ID is required' },
        { status: 400 }
      );
    }

    // Get authenticated user using secure httpOnly cookie (consistent with other API routes)
    const { databases } = await createSessionClient();

    // Check if course has published mock exams using direct database query
    const mockExamsResult = await databases.listDocuments(
      'default',
      'mock_exams',
      [
        Query.equal('courseId', courseId),
        Query.equal('status', 'published'),
        Query.orderAsc('$createdAt'),
        Query.limit(1),
      ]
    );

    const hasExam = mockExamsResult.total > 0;
    const examId = hasExam ? mockExamsResult.documents[0].$id : null;

    console.log('[API/exam/availability] Checked:', {
      courseId,
      hasExam,
      examId,
    });

    return NextResponse.json({
      success: true,
      available: hasExam,
      examId,
    });
  } catch (error: any) {
    console.error('[API/exam/availability] Error:', error);

    // Handle authentication errors (consistent with other API routes)
    if (error.message && error.message.includes('No session found')) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated. Please log in.' },
        { status: 401 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to check exam availability';

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
