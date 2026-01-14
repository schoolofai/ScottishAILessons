import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/server/appwrite';
import { decompressJSON } from '@/lib/appwrite/utils/compression';
import { logger, createLogger } from '@/lib/logger';
import type { Nat5PlusMockExam, ExamSection, ExamMetadata } from '@/lib/sqa-mock-exam/types';

const log = createLogger('API/sqa-mock-exam/[examId]');

/**
 * GET /api/sqa-mock-exam/[examId]
 *
 * Fetches a Nat5+ SQA mock exam by ID with full content for presentation.
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

    log.info(`Fetching SQA mock exam: ${examId}`);

    // Get authenticated user using secure httpOnly cookie
    const { databases } = await createSessionClient();

    // Fetch the exam document
    const examDoc = await databases.getDocument(
      'default',
      'nat5_plus_mock_exams',
      examId
    );

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

    // Parse metadata JSON
    let metadata: ExamMetadata = {
      title: '',
      total_marks: 0,
      duration_minutes: 90,
      calculator_allowed: true,
    };

    try {
      if (examDoc.metadata) {
        metadata = JSON.parse(examDoc.metadata);
      }
    } catch (e) {
      log.warn('Failed to parse exam metadata', { examId });
    }

    // Decompress sections (gzip + base64 encoded)
    let sections: ExamSection[] = [];
    try {
      if (examDoc.sections) {
        sections = decompressJSON<ExamSection[]>(examDoc.sections) || [];
      }
    } catch (e) {
      log.error('Failed to decompress exam sections', { examId, error: e });
      throw new Error('Failed to load exam content');
    }

    // Parse difficulty distribution
    let difficultyDistribution = { easy: 0, medium: 0, hard: 0 };
    try {
      if (examDoc.difficulty_distribution) {
        difficultyDistribution = JSON.parse(examDoc.difficulty_distribution);
      }
    } catch (e) {
      log.warn('Failed to parse difficulty distribution', { examId });
    }

    // Parse generation metadata
    let generationMetadata = null;
    try {
      if (examDoc.generation_metadata) {
        generationMetadata = JSON.parse(examDoc.generation_metadata);
      }
    } catch (e) {
      log.warn('Failed to parse generation metadata', { examId });
    }

    // Build the full exam object
    const exam: Nat5PlusMockExam = {
      exam_id: examDoc.$id,
      course_id: examDoc.courseId,
      subject: examDoc.subject,
      level: examDoc.level,
      exam_version: examDoc.exam_version,
      status: examDoc.status,
      metadata,
      sections,
      topic_coverage: examDoc.topic_coverage || [],
      difficulty_distribution: difficultyDistribution,
      template_sources: examDoc.template_sources || [],
      generation_metadata: generationMetadata,
    };

    log.info('Fetched SQA mock exam', {
      examId: exam.exam_id,
      title: exam.metadata.title,
      sectionsCount: exam.sections.length,
      totalMarks: exam.metadata.total_marks,
    });

    return NextResponse.json({
      success: true,
      exam,
    });
  } catch (error: unknown) {
    log.error('Error fetching SQA mock exam', { error });

    // Handle authentication errors
    if (error instanceof Error && error.message.includes('No session found')) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated. Please log in.' },
        { status: 401 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch exam';

    // Handle specific error cases
    if (
      errorMessage.includes('not found') ||
      errorMessage.includes('404') ||
      errorMessage.includes('Document with the requested ID')
    ) {
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
