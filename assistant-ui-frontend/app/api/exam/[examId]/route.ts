import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/server/appwrite';
import { Query } from 'node-appwrite';
import { decompressMockExam } from '@/lib/exam/compression';
import type { MockExam } from '@/lib/exam/types';

/**
 * GET /api/exam/[examId]
 *
 * Fetches a mock exam by ID with full content for presentation.
 * Returns decompressed exam data ready for the frontend.
 * Uses server-side authentication via httpOnly session cookie.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await params;

    if (!examId || examId.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Exam ID is required' },
        { status: 400 }
      );
    }

    // Get authenticated user using secure httpOnly cookie (consistent with other API routes)
    const { databases } = await createSessionClient();

    // Fetch the mock exam document
    const examDoc = await databases.getDocument('default', 'mock_exams', examId);

    if (!examDoc) {
      return NextResponse.json(
        { success: false, error: 'Exam not found' },
        { status: 404 }
      );
    }

    // Verify exam is published
    if (examDoc.status !== 'published') {
      return NextResponse.json(
        { success: false, error: 'Exam is not available' },
        { status: 403 }
      );
    }

    // Decompress the exam content
    const exam = decompressMockExam(examDoc) as MockExam;

    console.log('[API/exam] Fetched exam:', {
      examId: exam.examId,
      title: exam.metadata.title,
      sections: exam.sections.length,
      totalMarks: exam.metadata.totalMarks,
    });

    return NextResponse.json({
      success: true,
      exam,
    });
  } catch (error: any) {
    console.error('[API/exam] Error fetching exam:', error);

    // Handle authentication errors (consistent with other API routes)
    if (error.message && error.message.includes('No session found')) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated. Please log in.' },
        { status: 401 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch exam';

    // Handle specific error cases
    if (errorMessage.includes('not found') || errorMessage.includes('404') || errorMessage.includes('Document with the requested ID')) {
      return NextResponse.json(
        { success: false, error: 'Exam not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
