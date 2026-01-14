import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/server/appwrite';
import { Query, ID } from 'node-appwrite';
import { z } from 'zod';
import { logger, createLogger } from '@/lib/logger';

const log = createLogger('API/sqa-mock-exam/attempt');

/**
 * Request schema for creating an exam attempt
 */
const CreateAttemptSchema = z.object({
  examId: z.string().min(1, 'Exam ID is required'),
  courseId: z.string().min(1, 'Course ID is required'),
});

/**
 * GET /api/sqa-mock-exam/attempt
 *
 * Lists all exam attempts for the authenticated student.
 * Optionally filtered by courseId query parameter.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');

    log.info('Listing SQA mock exam attempts', { courseId });

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
    const studentId = student.$id;

    // Build query
    const queries = [
      Query.equal('studentId', studentId),
      Query.orderDesc('$createdAt'),
      Query.limit(50),
    ];

    if (courseId) {
      queries.push(Query.equal('courseId', courseId));
    }

    // Fetch attempts
    const attemptsResult = await databases.listDocuments(
      'default',
      'nat5_plus_exam_attempts',
      queries
    );

    // Enrich attempts with exam titles
    const enrichedAttempts = await Promise.all(
      attemptsResult.documents.map(async (attempt) => {
        let examTitle = `Mock Exam v${attempt.examId.slice(-4)}`;

        try {
          const exam = await databases.getDocument(
            'default',
            'nat5_plus_mock_exams',
            attempt.examId
          );
          if (exam.metadata) {
            const metadata = typeof exam.metadata === 'string'
              ? JSON.parse(exam.metadata)
              : exam.metadata;
            examTitle = metadata.title || examTitle;
          }
        } catch (err) {
          log.warn('Could not fetch exam details', { examId: attempt.examId, error: err });
        }

        return {
          attemptId: attempt.$id,
          examId: attempt.examId,
          examTitle,
          attemptNumber: attempt.attempt_number,
          status: attempt.status,
          marksEarned: attempt.marks_earned,
          marksPossible: attempt.marks_possible,
          percentage: attempt.percentage,
          grade: attempt.grade,
          startedAt: attempt.started_at,
          submittedAt: attempt.submitted_at,
          gradedAt: attempt.graded_at,
        };
      })
    );

    log.info(`Loaded ${enrichedAttempts.length} exam attempts`, { studentId });

    return NextResponse.json({
      success: true,
      attempts: enrichedAttempts,
      total: enrichedAttempts.length,
    });
  } catch (error: unknown) {
    log.error('Error listing SQA mock exam attempts', { error });

    if (error instanceof Error && error.message.includes('No session found')) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated. Please log in.' },
        { status: 401 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to list attempts';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

/**
 * POST /api/sqa-mock-exam/attempt
 *
 * Creates a new exam attempt for the authenticated student.
 * Uses server-side authentication via httpOnly session cookie.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { examId, courseId } = CreateAttemptSchema.parse(body);

    log.info('Creating SQA mock exam attempt', { examId, courseId });

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
    const studentId = student.$id;

    // Check how many attempts this student has for this exam
    const existingAttempts = await databases.listDocuments(
      'default',
      'nat5_plus_exam_attempts',
      [Query.equal('examId', examId), Query.equal('studentId', studentId)]
    );

    const attemptNumber = existingAttempts.total + 1;

    // Create the new attempt
    const attempt = await databases.createDocument(
      'default',
      'nat5_plus_exam_attempts',
      ID.unique(),
      {
        examId,
        studentId,
        courseId,
        attempt_number: attemptNumber,
        status: 'in_progress',
        started_at: new Date().toISOString(),
      },
      // Grant read permission to the user
      [`read("user:${user.$id}")`, `update("user:${user.$id}")`]
    );

    log.info('Created SQA mock exam attempt', {
      attemptId: attempt.$id,
      attemptNumber,
      examId,
      studentId,
    });

    return NextResponse.json({
      success: true,
      attemptId: attempt.$id,
      attemptNumber,
      status: 'in_progress',
      startedAt: attempt.started_at,
    });
  } catch (error: unknown) {
    log.error('Error creating SQA mock exam attempt', { error });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    // Handle authentication errors
    if (error instanceof Error && error.message.includes('No session found')) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated. Please log in.' },
        { status: 401 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to create attempt';

    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
