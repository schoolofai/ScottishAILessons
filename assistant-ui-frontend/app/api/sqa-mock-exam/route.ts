import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/server/appwrite';
import { Query } from 'node-appwrite';
import { logger, createLogger } from '@/lib/logger';

const log = createLogger('API/sqa-mock-exam');

/**
 * GET /api/sqa-mock-exam
 *
 * Lists available Nat5+ SQA mock exams.
 * Optionally filters by courseId query parameter.
 * Uses server-side authentication via httpOnly session cookie.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');

    log.info('Listing SQA mock exams', { courseId });

    // Get authenticated user using secure httpOnly cookie
    const { databases } = await createSessionClient();

    // Build queries
    const queries: string[] = [
      Query.equal('status', 'published'),
      Query.orderDesc('created_at'),
    ];

    if (courseId) {
      queries.push(Query.equal('courseId', courseId));
    }

    // Fetch exams from nat5_plus_mock_exams collection
    const response = await databases.listDocuments(
      'default',
      'nat5_plus_mock_exams',
      queries
    );

    // Map documents to ExamBrowseItem format
    const exams = response.documents.map((doc) => {
      // Parse metadata JSON
      let metadata: {
        title?: string;
        total_marks?: number;
        duration_minutes?: number;
        calculator_allowed?: boolean;
      } = {};

      try {
        if (doc.metadata) {
          metadata = JSON.parse(doc.metadata);
        }
      } catch (e) {
        log.warn('Failed to parse exam metadata', { examId: doc.$id });
      }

      return {
        examId: doc.$id,
        subject: doc.subject,
        level: doc.level,
        courseId: doc.courseId,
        examVersion: doc.exam_version,
        status: doc.status,
        title: metadata.title || `${doc.subject} ${doc.level} Mock Exam`,
        totalMarks: metadata.total_marks || 0,
        durationMinutes: metadata.duration_minutes || 90,
        calculatorAllowed: metadata.calculator_allowed ?? true,
        topicCoverage: doc.topic_coverage || [],
        createdAt: doc.created_at,
      };
    });

    log.info(`Found ${exams.length} published exams`, { courseId });

    return NextResponse.json({
      success: true,
      exams,
      total: response.total,
    });
  } catch (error: unknown) {
    log.error('Error listing SQA mock exams', { error });

    // Handle authentication errors
    if (error instanceof Error && error.message.includes('No session found')) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated. Please log in.' },
        { status: 401 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to list exams';

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
