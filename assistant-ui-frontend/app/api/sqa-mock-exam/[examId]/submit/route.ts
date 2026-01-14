import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient, createAdminClient } from '@/lib/server/appwrite';
import { Query, ID } from 'node-appwrite';
import { z } from 'zod';
import pako from 'pako';
import { logger, createLogger } from '@/lib/logger';
import type { EvaluationResult } from '@/lib/sqa-mock-exam/types';

const log = createLogger('API/sqa-mock-exam/submit');

/**
 * Compress data for storage in Appwrite
 */
function compressData(data: object): string {
  const jsonString = JSON.stringify(data);
  const compressed = pako.deflate(jsonString);
  return Buffer.from(compressed).toString('base64');
}

/**
 * Background grading function for Nat5+ SQA exams
 * Uses the graph_nat5_plus_exam LangGraph evaluator
 */
async function performBackgroundGrading(
  attemptId: string,
  langGraphPayload: object
): Promise<void> {
  const langGraphUrl = process.env.LANGGRAPH_URL || 'http://localhost:2024';
  const graphName = 'graph_nat5_plus_exam';

  log.info(`Starting background grading for attempt ${attemptId}`);

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
      log.error('LangGraph grading error', { errorText, status: gradingResponse.status });
      throw new Error(`Grading service returned ${gradingResponse.status}: ${errorText}`);
    }

    const responseData = await gradingResponse.json();

    // Check for error in response
    if (responseData.__error__) {
      log.error('LangGraph returned error', { error: responseData.__error__ });
      throw new Error(`Grading failed: ${responseData.__error__.message || 'Unknown error'}`);
    }

    // Extract evaluation result from response
    // The graph returns overall_result which contains the full EvaluationResult
    let evaluationResult: EvaluationResult | null = null;

    if (responseData.overall_result) {
      evaluationResult = responseData.overall_result as EvaluationResult;
    } else if (responseData.evaluation_result) {
      evaluationResult = responseData.evaluation_result as EvaluationResult;
    }

    if (!evaluationResult) {
      log.error('Failed to extract evaluation result', {
        responseKeys: Object.keys(responseData),
      });
      throw new Error('No evaluation result received from grading service');
    }

    log.info('Grading complete', {
      attemptId,
      grade: evaluationResult.overall_result.grade,
      percentage: evaluationResult.overall_result.percentage,
      marksEarned: evaluationResult.overall_result.marks_earned,
      marksPossible: evaluationResult.overall_result.marks_possible,
    });

    // Use admin client to update the attempt
    const { databases } = await createAdminClient();

    // Compress the evaluation result for storage
    const compressedResult = compressData(evaluationResult);

    // Update attempt with grading results
    await databases.updateDocument(
      'default',
      'nat5_plus_exam_attempts',
      attemptId,
      {
        status: 'graded',
        graded_at: new Date().toISOString(),
        result_snapshot: compressedResult,
        marks_earned: evaluationResult.overall_result.marks_earned,
        marks_possible: evaluationResult.overall_result.marks_possible,
        percentage: evaluationResult.overall_result.percentage,
        grade: evaluationResult.overall_result.grade,
      }
    );

    log.info(`Saved grading results for attempt ${attemptId}`);
  } catch (error) {
    log.error(`Error grading attempt ${attemptId}`, { error });

    // Update attempt with error status
    try {
      const { databases } = await createAdminClient();
      await databases.updateDocument(
        'default',
        'nat5_plus_exam_attempts',
        attemptId,
        {
          status: 'grading_error',
        }
      );
    } catch (updateError) {
      log.error('Failed to update error status', { updateError });
    }
  }
}

/**
 * Request schema for submitting an SQA mock exam
 */
const SubmitExamSchema = z.object({
  attemptId: z.string().min(1, 'Attempt ID is required'),
  answers: z.array(
    z.object({
      question_id: z.string(),
      response_text: z.string(),
      working_shown: z.string().optional(),
    })
  ),
  mock_exam: z.any(), // Full exam object for grading context
});

/**
 * POST /api/sqa-mock-exam/[examId]/submit
 *
 * Submits an SQA mock exam for grading using the graph_nat5_plus_exam evaluator.
 * Returns immediately and performs grading in background.
 * Uses server-side authentication via httpOnly session cookie.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await params;
    const body = await request.json();
    const submission = SubmitExamSchema.parse(body);

    log.info('Processing SQA mock exam submission', {
      examId,
      attemptId: submission.attemptId,
      answersCount: submission.answers.length,
    });

    // Get authenticated user
    const { account, databases } = await createSessionClient();
    const user = await account.get();

    // Get student record to verify ownership
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

    // Verify the attempt belongs to this student
    const attempt = await databases.getDocument(
      'default',
      'nat5_plus_exam_attempts',
      submission.attemptId
    );

    if (attempt.studentId !== student.$id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - attempt does not belong to student' },
        { status: 403 }
      );
    }

    // Compress answers for storage
    const compressedAnswers = compressData(submission.answers);

    // Update attempt status to submitted
    await databases.updateDocument(
      'default',
      'nat5_plus_exam_attempts',
      submission.attemptId,
      {
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        answers_snapshot: compressedAnswers,
      }
    );

    log.info('Answers saved, status set to submitted');

    // Build payload for LangGraph evaluator
    // The evaluator expects mock_exam with sections containing questions and marking schemes
    // and student_answers with response_text (not answer)
    const langGraphPayload = {
      submission_id: `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      exam_id: examId,
      mock_exam: submission.mock_exam,
      student_answers: submission.answers,
    };

    // Start background grading
    performBackgroundGrading(submission.attemptId, langGraphPayload).catch((error) => {
      log.error('Background grading failed', { error });
    });

    log.info('Background grading started, returning immediately');

    return NextResponse.json({
      success: true,
      attemptId: submission.attemptId,
      status: 'submitted',
      message: 'Your answers have been saved. Grading is in progress.',
    });
  } catch (error: unknown) {
    log.error('Error submitting SQA mock exam', { error });

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

    // Handle authentication errors
    if (error instanceof Error && error.message.includes('No session found')) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated. Please log in.' },
        { status: 401 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Submission failed';

    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
