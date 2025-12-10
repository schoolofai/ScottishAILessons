import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/server/appwrite';
import { Query, ID } from 'node-appwrite';
import { z } from 'zod';

/**
 * Request schema for creating an exam attempt
 */
const CreateAttemptSchema = z.object({
  examId: z.string().min(1, 'Exam ID is required'),
  courseId: z.string().min(1, 'Course ID is required'),
});

/**
 * POST /api/exam/attempt
 *
 * Creates a new exam attempt for the authenticated student.
 * Returns the attempt ID used to track progress and submit answers.
 * Uses server-side authentication via httpOnly session cookie.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { examId, courseId } = CreateAttemptSchema.parse(body);

    // Get authenticated user using secure httpOnly cookie (consistent with other API routes)
    const { account, databases } = await createSessionClient();
    const user = await account.get();

    // Get student record
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

    // Verify course enrollment
    const enrollmentsResult = await databases.listDocuments(
      'default',
      'enrollments',
      [
        Query.equal('studentId', student.$id),
        Query.equal('courseId', courseId),
        Query.equal('status', 'active'),
      ]
    );

    if (enrollmentsResult.documents.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Not enrolled in this course' },
        { status: 403 }
      );
    }

    // Count existing attempts for this student/exam
    const existingAttemptsResult = await databases.listDocuments(
      'default',
      'exam_attempts',
      [
        Query.equal('examId', examId),
        Query.equal('studentId', student.$id),
      ]
    );

    const attemptNumber = existingAttemptsResult.total + 1;

    // Create exam attempt (field names match database schema)
    const attempt = await databases.createDocument(
      'default',
      'exam_attempts',
      ID.unique(),
      {
        examId,
        studentId: student.$id,
        courseId,
        attemptNumber,  // camelCase to match schema
        status: 'in_progress',
        startedAt: new Date().toISOString(),  // camelCase to match schema
      },
      // Set permissions so user can read/update their own attempt
      [
        `read("user:${user.$id}")`,
        `update("user:${user.$id}")`,
      ]
    );

    console.log('[API/exam/attempt] Created attempt:', {
      attemptId: attempt.$id,
      examId,
      studentId: student.$id,
      attemptNumber: attempt.attemptNumber,
    });

    return NextResponse.json({
      success: true,
      attemptId: attempt.$id,
      attemptNumber: attempt.attemptNumber,
      startedAt: attempt.startedAt,
    }, { status: 201 });
  } catch (error: any) {
    console.error('[API/exam/attempt] Error creating attempt:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request parameters',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    // Handle authentication errors (consistent with other API routes)
    if (error.message && error.message.includes('No session found')) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated. Please log in.' },
        { status: 401 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to create attempt';

    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      return NextResponse.json(
        { success: false, error: 'Exam or course not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
