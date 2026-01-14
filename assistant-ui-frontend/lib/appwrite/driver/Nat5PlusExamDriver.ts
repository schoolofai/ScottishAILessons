/**
 * Nat5PlusExamDriver
 *
 * Handles Nat5+ mock exam operations with Appwrite:
 * - nat5_plus_mock_exams: Exam storage
 * - nat5_plus_exam_attempts: Student attempts
 *
 * Uses server-side authentication only.
 */

import { Query } from 'appwrite';
import { BaseDriver } from './BaseDriver';
import { decompressJSON } from '../utils/compression';
import { logger, createLogger } from '@/lib/logger';

import type {
  Nat5PlusMockExam,
  ExamSection,
  ExamMetadata,
  ExamBrowseItem,
  ExamAttempt,
  ExamSubmission,
  EvaluationResult,
} from '@/lib/sqa-mock-exam/types';

const log = createLogger('Nat5PlusExamDriver');

// =============================================================================
// Document Types (raw from Appwrite)
// =============================================================================

interface ExamDocument {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  courseId: string;
  subject: string;
  level: string;
  exam_version: number;
  status: 'draft' | 'published' | 'archived';
  metadata: string; // JSON
  sections: string; // Compressed gzip+base64
  topic_coverage: string[];
  difficulty_distribution: string; // JSON
  template_sources: string[];
  generation_metadata: string; // JSON
  created_at: string;
  last_modified: string;
}

interface AttemptDocument {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  examId: string;
  studentId: string;
  courseId: string;
  attempt_number: number;
  status: 'in_progress' | 'submitted' | 'graded';
  started_at: string;
  submitted_at?: string;
  graded_at?: string;
  answers_snapshot?: string; // Compressed
  result_snapshot?: string; // Compressed
  marks_earned?: number;
  marks_possible?: number;
  percentage?: number;
  grade?: string;
}

// =============================================================================
// Nat5PlusExamDriver Class
// =============================================================================

export class Nat5PlusExamDriver extends BaseDriver {
  private static readonly COLLECTION_EXAMS = 'nat5_plus_mock_exams';
  private static readonly COLLECTION_ATTEMPTS = 'nat5_plus_exam_attempts';

  // ==========================================================================
  // Exam Browsing
  // ==========================================================================

  /**
   * List available exams for a course
   */
  async listExams(courseId?: string): Promise<ExamBrowseItem[]> {
    log.info('Listing exams', { courseId });

    try {
      const queries: string[] = [
        Query.equal('status', 'published'),
        Query.orderDesc('created_at'),
      ];

      if (courseId) {
        queries.push(Query.equal('courseId', courseId));
      }

      const response = await this.databases.listDocuments(
        this.databaseId,
        Nat5PlusExamDriver.COLLECTION_EXAMS,
        queries
      );

      const items: ExamBrowseItem[] = response.documents.map((doc) => {
        const examDoc = doc as unknown as ExamDocument;
        const metadata = this.parseJSON<ExamMetadata>(examDoc.metadata);

        return {
          examId: examDoc.$id,
          subject: examDoc.subject,
          level: examDoc.level,
          courseId: examDoc.courseId,
          examVersion: examDoc.exam_version,
          status: examDoc.status,
          totalMarks: metadata?.total_marks || 0,
          questionCount: 0, // Would need to decompress sections to count
          calculatorAllowed: metadata?.calculator_allowed ?? true,
        };
      });

      log.info(`Found ${items.length} exams`);
      return items;
    } catch (error) {
      log.error('Failed to list exams', { error });
      throw this.handleError(error, 'list exams');
    }
  }

  /**
   * Get a specific exam with full content
   */
  async getExam(examId: string): Promise<Nat5PlusMockExam> {
    if (!examId || examId.trim().length === 0) {
      throw new Error('Exam ID is required');
    }

    log.info(`Fetching exam: ${examId}`);

    try {
      const doc = await this.databases.getDocument(
        this.databaseId,
        Nat5PlusExamDriver.COLLECTION_EXAMS,
        examId
      );

      const examDoc = doc as unknown as ExamDocument;
      return this.parseExamDocument(examDoc);
    } catch (error) {
      log.error(`Failed to get exam ${examId}`, { error });
      throw this.handleError(error, `get exam ${examId}`);
    }
  }

  // ==========================================================================
  // Exam Attempts
  // ==========================================================================

  /**
   * Create a new exam attempt
   */
  async createAttempt(
    examId: string,
    studentId: string,
    courseId: string
  ): Promise<ExamAttempt> {
    log.info('Creating exam attempt', { examId, studentId });

    try {
      // Get attempt count for this student/exam
      const existing = await this.databases.listDocuments(
        this.databaseId,
        Nat5PlusExamDriver.COLLECTION_ATTEMPTS,
        [
          Query.equal('examId', examId),
          Query.equal('studentId', studentId),
        ]
      );

      const attemptNumber = existing.total + 1;

      const { ID } = await import('appwrite');

      const doc = await this.databases.createDocument(
        this.databaseId,
        Nat5PlusExamDriver.COLLECTION_ATTEMPTS,
        ID.unique(),
        {
          examId,
          studentId,
          courseId,
          attempt_number: attemptNumber,
          status: 'in_progress',
          started_at: new Date().toISOString(),
        }
      );

      log.info(`Created attempt ${doc.$id} (attempt #${attemptNumber})`);

      return {
        attemptId: doc.$id,
        examId,
        studentId,
        attemptNumber,
        status: 'in_progress',
        startedAt: doc.$createdAt,
      };
    } catch (error) {
      log.error('Failed to create attempt', { error });
      throw this.handleError(error, 'create attempt');
    }
  }

  /**
   * Get an existing attempt
   */
  async getAttempt(attemptId: string): Promise<ExamAttempt | null> {
    log.info(`Fetching attempt: ${attemptId}`);

    try {
      const doc = await this.databases.getDocument(
        this.databaseId,
        Nat5PlusExamDriver.COLLECTION_ATTEMPTS,
        attemptId
      );

      const attemptDoc = doc as unknown as AttemptDocument;

      return {
        attemptId: attemptDoc.$id,
        examId: attemptDoc.examId,
        studentId: attemptDoc.studentId,
        attemptNumber: attemptDoc.attempt_number,
        status: attemptDoc.status,
        startedAt: attemptDoc.started_at,
        submittedAt: attemptDoc.submitted_at,
        gradedAt: attemptDoc.graded_at,
        marksEarned: attemptDoc.marks_earned,
        marksPossible: attemptDoc.marks_possible,
        percentage: attemptDoc.percentage,
        grade: attemptDoc.grade as ExamAttempt['grade'],
      };
    } catch (error) {
      log.error(`Failed to get attempt ${attemptId}`, { error });
      return null;
    }
  }

  /**
   * Submit an attempt for grading
   */
  async submitAttempt(
    attemptId: string,
    submission: ExamSubmission
  ): Promise<void> {
    log.info(`Submitting attempt: ${attemptId}`);

    try {
      // Compress answers
      const answersCompressed = this.compressJSON(submission.answers);

      await this.databases.updateDocument(
        this.databaseId,
        Nat5PlusExamDriver.COLLECTION_ATTEMPTS,
        attemptId,
        {
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          answers_snapshot: answersCompressed,
        }
      );

      log.info(`Attempt ${attemptId} submitted`);
    } catch (error) {
      log.error(`Failed to submit attempt ${attemptId}`, { error });
      throw this.handleError(error, 'submit attempt');
    }
  }

  /**
   * Save evaluation result to attempt
   */
  async saveResult(
    attemptId: string,
    result: EvaluationResult
  ): Promise<void> {
    log.info(`Saving result for attempt: ${attemptId}`);

    try {
      const resultCompressed = this.compressJSON(result);

      await this.databases.updateDocument(
        this.databaseId,
        Nat5PlusExamDriver.COLLECTION_ATTEMPTS,
        attemptId,
        {
          status: 'graded',
          graded_at: new Date().toISOString(),
          result_snapshot: resultCompressed,
          marks_earned: result.overall_result.marks_earned,
          marks_possible: result.overall_result.marks_possible,
          percentage: result.overall_result.percentage,
          grade: result.overall_result.grade,
        }
      );

      log.info(`Result saved for attempt ${attemptId}`);
    } catch (error) {
      log.error(`Failed to save result for ${attemptId}`, { error });
      throw this.handleError(error, 'save result');
    }
  }

  /**
   * Get stored result for an attempt
   */
  async getResult(attemptId: string): Promise<EvaluationResult | null> {
    log.info(`Getting result for attempt: ${attemptId}`);

    try {
      const doc = await this.databases.getDocument(
        this.databaseId,
        Nat5PlusExamDriver.COLLECTION_ATTEMPTS,
        attemptId
      );

      const attemptDoc = doc as unknown as AttemptDocument;

      if (!attemptDoc.result_snapshot) {
        return null;
      }

      return decompressJSON<EvaluationResult>(attemptDoc.result_snapshot);
    } catch (error) {
      log.error(`Failed to get result for ${attemptId}`, { error });
      return null;
    }
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private parseExamDocument(doc: ExamDocument): Nat5PlusMockExam {
    // Parse metadata
    const metadata = this.parseJSON<ExamMetadata>(doc.metadata) || {
      title: '',
      total_marks: 0,
      duration_minutes: 0,
      calculator_allowed: true,
    };

    // Decompress sections
    const sections = decompressJSON<ExamSection[]>(doc.sections) || [];

    // Parse difficulty distribution
    const difficultyRaw = this.parseJSON<Record<string, number>>(
      doc.difficulty_distribution
    );
    const difficulty_distribution = {
      easy: difficultyRaw?.easy || 0,
      medium: difficultyRaw?.medium || 0,
      hard: difficultyRaw?.hard || 0,
    };

    // Parse generation metadata
    const generation_metadata = this.parseJSON(doc.generation_metadata);

    return {
      exam_id: doc.$id,
      course_id: doc.courseId,
      subject: doc.subject,
      level: doc.level,
      exam_version: doc.exam_version,
      status: doc.status,
      metadata,
      sections,
      topic_coverage: doc.topic_coverage || [],
      difficulty_distribution,
      template_sources: doc.template_sources || [],
      generation_metadata,
    };
  }

  private parseJSON<T>(value: string | undefined): T | null {
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  private compressJSON(data: unknown): string {
    // Simple JSON stringify for now - could add gzip compression
    return JSON.stringify(data);
  }

  protected handleError(error: unknown, context: string): Error {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Error in ${context}: ${message}`);
    return new Error(`Nat5PlusExamDriver: ${context} failed - ${message}`);
  }
}
