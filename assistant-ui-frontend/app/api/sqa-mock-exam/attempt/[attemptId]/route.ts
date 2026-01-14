import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/server/appwrite';
import { Query } from 'node-appwrite';
import pako from 'pako';
import { logger, createLogger } from '@/lib/logger';
import type { EvaluationResult } from '@/lib/sqa-mock-exam/types';

const log = createLogger('API/sqa-mock-exam/attempt/[attemptId]');

/**
 * Decompress stored data from Appwrite
 */
function decompressData<T>(compressed: string): T | null {
  try {
    const buffer = Buffer.from(compressed, 'base64');
    const decompressed = pako.inflate(buffer);
    const jsonString = new TextDecoder().decode(decompressed);
    return JSON.parse(jsonString) as T;
  } catch (e) {
    log.error('Failed to decompress data', { error: e });
    return null;
  }
}

/**
 * GET /api/sqa-mock-exam/attempt/[attemptId]
 *
 * Gets the status and results of an exam attempt.
 * Returns evaluation results if grading is complete.
 * Uses server-side authentication via httpOnly session cookie.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await params;
    const { searchParams } = new URL(request.url);
    const includeAnswers = searchParams.get('includeAnswers') === 'true';

    if (!attemptId || attemptId.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Attempt ID is required' },
        { status: 400 }
      );
    }

    log.info(`Fetching SQA mock exam attempt: ${attemptId}`, { includeAnswers });

    // Get authenticated user
    const { account, databases } = await createSessionClient();
    const user = await account.get();

    // Get student record
    const studentsResult = await databases.listDocuments('default', 'students', [
      Query.equal('userId', user.$id),
    ]);

    if (studentsResult.documents.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Student profile not found' },
        { status: 404 }
      );
    }

    const student = studentsResult.documents[0];

    // Fetch the attempt
    const attempt = await databases.getDocument(
      'default',
      'nat5_plus_exam_attempts',
      attemptId
    );

    if (!attempt) {
      return NextResponse.json(
        { success: false, error: 'Attempt not found' },
        { status: 404 }
      );
    }

    // Verify the attempt belongs to this student
    if (attempt.studentId !== student.$id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - attempt does not belong to student' },
        { status: 403 }
      );
    }

    // Build response object
    const response: {
      success: boolean;
      attemptId: string;
      examId: string;
      attemptNumber: number;
      status: string;
      startedAt: string;
      submittedAt?: string;
      gradedAt?: string;
      marksEarned?: number;
      marksPossible?: number;
      percentage?: number;
      grade?: string;
      evaluationResult?: EvaluationResult;
      studentAnswers?: unknown[];
    } = {
      success: true,
      attemptId: attempt.$id,
      examId: attempt.examId,
      attemptNumber: attempt.attempt_number,
      status: attempt.status,
      startedAt: attempt.started_at,
    };

    if (attempt.submitted_at) {
      response.submittedAt = attempt.submitted_at;
    }

    if (attempt.graded_at) {
      response.gradedAt = attempt.graded_at;
    }

    // Include grading results if available
    if (attempt.status === 'graded') {
      response.marksEarned = attempt.marks_earned;
      response.marksPossible = attempt.marks_possible;
      response.percentage = attempt.percentage;
      response.grade = attempt.grade;

      // Decompress full evaluation result if available
      if (attempt.result_snapshot) {
        const evaluationResult = decompressData<EvaluationResult>(attempt.result_snapshot);
        if (evaluationResult) {
          response.evaluationResult = evaluationResult;
        }
      }

      // Include student answers if requested (for review page)
      if (includeAnswers && attempt.answers_snapshot) {
        const studentAnswers = decompressData<unknown[]>(attempt.answers_snapshot);
        if (studentAnswers) {
          response.studentAnswers = studentAnswers;
        }
      }
    }

    log.info('Fetched SQA mock exam attempt', {
      attemptId,
      status: attempt.status,
      grade: attempt.grade,
    });

    return NextResponse.json(response);
  } catch (error: unknown) {
    log.error('Error fetching SQA mock exam attempt', { error });

    // Handle authentication errors
    if (error instanceof Error && error.message.includes('No session found')) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated. Please log in.' },
        { status: 401 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch attempt';

    // Handle not found
    if (
      errorMessage.includes('not found') ||
      errorMessage.includes('404') ||
      errorMessage.includes('Document with the requested ID')
    ) {
      return NextResponse.json(
        { success: false, error: 'Attempt not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
