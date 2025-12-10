import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient, createAdminClient } from '@/lib/server/appwrite';
import { Query } from 'node-appwrite';
import { z } from 'zod';
import pako from 'pako';
import type { EvaluationResult } from '@/lib/exam/types';

/**
 * Compress data for storage in Appwrite
 */
function compressData(data: object): string {
  const jsonString = JSON.stringify(data);
  const compressed = pako.deflate(jsonString);
  return Buffer.from(compressed).toString('base64');
}

/**
 * Background grading function - runs after response is sent
 * Uses admin client since user session may no longer be available
 */
async function performBackgroundGrading(
  attemptId: string,
  langGraphPayload: object
): Promise<void> {
  const langGraphUrl = process.env.LANGGRAPH_URL || 'http://localhost:2024';
  const graphName = 'graph_mock_exam';

  console.log(`[Background Grading] Starting for attempt ${attemptId}`);

  try {
    const gradingResponse = await fetch(`${langGraphUrl}/runs/wait`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assistant_id: graphName,
        input: langGraphPayload,
        config: {
          configurable: {},
        },
      }),
    });

    if (!gradingResponse.ok) {
      const errorText = await gradingResponse.text();
      console.error('[Background Grading] LangGraph error:', errorText);
      throw new Error(`Grading service returned ${gradingResponse.status}: ${errorText}`);
    }

    const responseData = await gradingResponse.json();

    // Check for error in response
    if (responseData.__error__) {
      console.error('[Background Grading] LangGraph returned error:', responseData.__error__);
      throw new Error(`Grading failed: ${responseData.__error__.message || 'Unknown error'}`);
    }

    // Extract evaluation result from response
    let evaluationResult: EvaluationResult | null = null;

    if (responseData.structured_response) {
      evaluationResult = responseData.structured_response as EvaluationResult;
    } else if (responseData.evaluation_result) {
      evaluationResult = responseData.evaluation_result as EvaluationResult;
    }

    if (!evaluationResult) {
      console.error('[Background Grading] Failed to extract evaluation. Response:', JSON.stringify(responseData).substring(0, 1000));
      throw new Error('No evaluation result received from grading service');
    }

    console.log('[Background Grading] Grading complete:', {
      attemptId,
      grade: evaluationResult.overall_result.grade,
      percentage: evaluationResult.overall_result.percentage,
      passStatus: evaluationResult.overall_result.pass_status,
    });

    // Use admin client to update the attempt (user session may be gone)
    const { databases } = await createAdminClient();

    // Compress the evaluation result for storage
    const compressedResult = compressData(evaluationResult);

    // Update attempt with grading results and status
    await databases.updateDocument(
      'default',
      'exam_attempts',
      attemptId,
      {
        status: 'graded',
        gradedAt: new Date().toISOString(),
        resultSnapshot: compressedResult,
        score: evaluationResult.overall_result.total_marks_earned,
        totalMarks: evaluationResult.overall_result.total_marks_possible,
        percentage: evaluationResult.overall_result.percentage,
      }
    );

    console.log(`[Background Grading] Saved results for attempt ${attemptId}`);
  } catch (error) {
    console.error(`[Background Grading] Error grading attempt ${attemptId}:`, error);

    // Update attempt with error status
    try {
      const { databases } = await createAdminClient();
      await databases.updateDocument(
        'default',
        'exam_attempts',
        attemptId,
        {
          status: 'grading_error',
          gradingError: error instanceof Error ? error.message : 'Unknown grading error',
        }
      );
    } catch (updateError) {
      console.error('[Background Grading] Failed to update error status:', updateError);
    }
  }
}

/**
 * Request schema for submitting an exam
 */
const SubmitExamSchema = z.object({
  attemptId: z.string().min(1, 'Attempt ID is required'),
  examId: z.string().min(1, 'Exam ID is required'),
  studentId: z.string().min(1, 'Student ID is required'),
  courseId: z.string().min(1, 'Course ID is required'),
  answers: z.array(z.object({
    question_id: z.string(),
    question_number: z.number(),
    section_id: z.string(),
    question_type: z.string(),
    response: z.object({
      selected_option: z.string().optional(),
      selected_options: z.array(z.string()).optional(),
      numeric_value: z.number().optional(),
      response_text: z.string().optional(),
      working: z.string().optional(),
      final_answer: z.string().optional(),
    }),
    time_spent_seconds: z.number(),
    was_flagged: z.boolean(),
  })),
  submission_metadata: z.object({
    started_at: z.string(),
    submitted_at: z.string(),
    time_limit_minutes: z.number(),
    time_spent_minutes: z.number(),
    was_auto_submitted: z.boolean(),
  }),
  exam_context: z.object({
    total_questions: z.number(),
    questions_answered: z.number(),
    questions_skipped: z.number(),
    questions_flagged: z.number(),
  }),
  mock_exam: z.any(), // Full exam object for grading context
});

/**
 * POST /api/exam/submit
 *
 * Submits an exam for grading. Calls the LangGraph backend to perform
 * LLM-powered grading and returns the evaluation result.
 * Uses server-side authentication via httpOnly session cookie.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const submission = SubmitExamSchema.parse(body);

    // Get authenticated user using secure httpOnly cookie (consistent with other API routes)
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

    // Verify the student owns this attempt
    if (student.$id !== submission.studentId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - student mismatch' },
        { status: 403 }
      );
    }

    console.log('[API/exam/submit] Processing submission:', {
      attemptId: submission.attemptId,
      examId: submission.examId,
      studentId: submission.studentId,
      answersCount: submission.answers.length,
    });

    // Compress answers for storage
    const compressedAnswers = compressData(submission.answers);

    // Update attempt status to submitted and save answers snapshot
    await databases.updateDocument(
      'default',
      'exam_attempts',
      submission.attemptId,
      {
        status: 'submitted',
        submittedAt: new Date().toISOString(),
        answersSnapshot: compressedAnswers,
      }
    );

    console.log('[API/exam/submit] Answers saved, status set to submitted');

    // Build the submission payload for LangGraph backend
    const langGraphPayload = {
      exam_submission: {
        submission_id: `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        exam_id: submission.examId,
        attempt_id: submission.attemptId,
        student_id: submission.studentId,
        course_id: submission.courseId,
        submission_metadata: submission.submission_metadata,
        answers: submission.answers,
        exam_context: submission.exam_context,
        mock_exam: submission.mock_exam,
      },
    };

    // Start background grading (fire-and-forget)
    // This runs asynchronously after we return the response
    // The grading will update the attempt status to 'graded' when complete
    performBackgroundGrading(submission.attemptId, langGraphPayload).catch((error) => {
      console.error('[API/exam/submit] Background grading failed:', error);
    });

    console.log('[API/exam/submit] Background grading started, returning immediately');

    // Return immediately - frontend will poll for results
    return NextResponse.json({
      success: true,
      attemptId: submission.attemptId,
      status: 'submitted',
      message: 'Your answers have been saved. Grading is in progress.',
    });
  } catch (error: any) {
    console.error('[API/exam/submit] Error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid submission data',
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

    const errorMessage = error instanceof Error ? error.message : 'Submission failed';

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
