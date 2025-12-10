import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/server/appwrite';
import { Query } from 'node-appwrite';
import pako from 'pako';
import type { EvaluationResult } from '@/lib/exam/types';

/**
 * Decompress data from Appwrite storage
 */
function decompressData<T>(compressedBase64: string): T {
  const compressed = Buffer.from(compressedBase64, 'base64');
  const decompressed = pako.inflate(compressed, { to: 'string' });
  return JSON.parse(decompressed) as T;
}

/**
 * GET /api/exam/attempt/[attemptId]/results
 *
 * Retrieves the full evaluation results for a graded exam attempt.
 * Returns decompressed EvaluationResult when status is 'graded'.
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

    // Check if attempt is graded
    if (attempt.status !== 'graded') {
      return NextResponse.json(
        {
          success: false,
          error: 'Results not available yet',
          status: attempt.status,
          gradingError: attempt.gradingError || null,
        },
        { status: 400 }
      );
    }

    // Check if results exist
    if (!attempt.resultSnapshot) {
      return NextResponse.json(
        { success: false, error: 'No results found for this attempt' },
        { status: 404 }
      );
    }

    // Decompress and return the evaluation result
    let evaluationResult: EvaluationResult;
    try {
      evaluationResult = decompressData<EvaluationResult>(attempt.resultSnapshot);
    } catch (decompressError) {
      console.error('[API/exam/attempt/results] Failed to decompress results:', decompressError);
      return NextResponse.json(
        { success: false, error: 'Failed to retrieve results' },
        { status: 500 }
      );
    }

    console.log('[API/exam/attempt/results] Returning results:', {
      attemptId,
      grade: evaluationResult.overall_result.grade,
      percentage: evaluationResult.overall_result.percentage,
    });

    return NextResponse.json({
      success: true,
      attemptId: attempt.$id,
      status: attempt.status,
      gradedAt: attempt.gradedAt,
      evaluation: evaluationResult,
      // Include summary info
      score: attempt.score,
      totalMarks: attempt.totalMarks,
      percentage: attempt.percentage,
    });
  } catch (error: any) {
    console.error('[API/exam/attempt/results] Error:', error);

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

    const errorMessage = error instanceof Error ? error.message : 'Failed to get results';

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
