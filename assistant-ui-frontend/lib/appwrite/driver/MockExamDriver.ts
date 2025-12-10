import { Query } from 'appwrite';
import { BaseDriver } from './BaseDriver';
import { decompressJSON, compressJSON } from '../utils/compression';
import type {
  MockExam,
  MockExamDocument,
  ExamAttemptDocument,
  EvaluationResult,
} from '../../exam/types';

/**
 * MockExamDriver - Handles mock exam CRUD operations with Appwrite
 *
 * Collection: mock_exams
 * - Stores exam definitions with compressed content
 * - Links to courses via courseId
 *
 * Collection: exam_attempts
 * - Tracks student exam attempts
 * - Stores answers and results as compressed JSON
 */
export class MockExamDriver extends BaseDriver {
  private static readonly COLLECTION_MOCK_EXAMS = 'mock_exams';
  private static readonly COLLECTION_EXAM_ATTEMPTS = 'exam_attempts';

  /**
   * Get all published mock exams for a course
   */
  async getMockExamsForCourse(courseId: string): Promise<MockExamDocument[]> {
    if (!courseId || courseId.trim().length === 0) {
      throw new Error('Course ID is required to fetch mock exams');
    }

    try {
      const documents = await this.list<MockExamDocument>(
        MockExamDriver.COLLECTION_MOCK_EXAMS,
        [
          Query.equal('courseId', courseId),
          Query.equal('status', 'published'),
          Query.orderDesc('$createdAt'),
        ]
      );

      console.log(`[MockExamDriver] Found ${documents.length} published mock exams for course: ${courseId}`);
      return documents;
    } catch (error) {
      throw this.handleError(error, `get mock exams for course ${courseId}`);
    }
  }

  /**
   * Get a specific mock exam by ID
   */
  async getMockExam(examId: string): Promise<MockExamDocument> {
    if (!examId || examId.trim().length === 0) {
      throw new Error('Exam ID is required');
    }

    try {
      const document = await this.get<MockExamDocument>(
        MockExamDriver.COLLECTION_MOCK_EXAMS,
        examId
      );

      console.log(`[MockExamDriver] Retrieved mock exam: ${document.title}`);
      return document;
    } catch (error) {
      throw this.handleError(error, `get mock exam ${examId}`);
    }
  }

  /**
   * Get mock exam with decompressed content
   * Returns the full MockExam object ready for presentation
   */
  async getMockExamWithContent(examId: string): Promise<MockExam> {
    const document = await this.getMockExam(examId);

    try {
      // Decompress the exam content JSON
      const examContent = decompressJSON<MockExam>(document.exam_content);

      if (!examContent) {
        throw new Error('Failed to decompress exam content');
      }

      console.log(`[MockExamDriver] Decompressed exam: ${examContent.metadata.title}, ${examContent.sections.length} sections`);
      return examContent;
    } catch (error) {
      throw new Error(`Failed to parse mock exam content: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if a course has any published mock exams
   * Lightweight query for dashboard integration
   */
  async courseHasMockExam(courseId: string): Promise<boolean> {
    if (!courseId || courseId.trim().length === 0) {
      return false;
    }

    try {
      const response = await this.listWithTotal<MockExamDocument>(
        MockExamDriver.COLLECTION_MOCK_EXAMS,
        [
          Query.equal('courseId', courseId),
          Query.equal('status', 'published'),
          Query.limit(1),
        ]
      );

      return response.total > 0;
    } catch (error) {
      console.error(`[MockExamDriver] Error checking mock exam for course ${courseId}:`, error);
      return false;
    }
  }

  /**
   * Get the first available mock exam for a course
   * Used when navigating from dashboard "Take Mock Exam" button
   */
  async getFirstMockExamForCourse(courseId: string): Promise<MockExamDocument | null> {
    if (!courseId || courseId.trim().length === 0) {
      throw new Error('Course ID is required');
    }

    try {
      const documents = await this.list<MockExamDocument>(
        MockExamDriver.COLLECTION_MOCK_EXAMS,
        [
          Query.equal('courseId', courseId),
          Query.equal('status', 'published'),
          Query.orderAsc('$createdAt'),
          Query.limit(1),
        ]
      );

      if (documents.length === 0) {
        return null;
      }

      return documents[0];
    } catch (error) {
      throw this.handleError(error, `get first mock exam for course ${courseId}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // EXAM ATTEMPTS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Create a new exam attempt
   */
  async createExamAttempt(
    examId: string,
    studentId: string,
    courseId: string
  ): Promise<ExamAttemptDocument> {
    if (!examId || !studentId || !courseId) {
      throw new Error('Exam ID, Student ID, and Course ID are all required');
    }

    try {
      // Get attempt count for this student/exam combination
      const previousAttempts = await this.list<ExamAttemptDocument>(
        MockExamDriver.COLLECTION_EXAM_ATTEMPTS,
        [
          Query.equal('examId', examId),
          Query.equal('studentId', studentId),
        ]
      );

      const user = await this.getCurrentUser();
      const attemptNumber = previousAttempts.length + 1;

      const attemptData = {
        examId,
        studentId,
        courseId,
        attempt_number: attemptNumber,
        status: 'in_progress' as const,
        started_at: new Date().toISOString(),
      };

      const permissions = this.createUserPermissions(user.$id);
      const document = await this.create<ExamAttemptDocument>(
        MockExamDriver.COLLECTION_EXAM_ATTEMPTS,
        attemptData,
        permissions
      );

      console.log(`[MockExamDriver] Created exam attempt ${document.$id} (attempt #${attemptNumber})`);
      return document;
    } catch (error) {
      throw this.handleError(error, 'create exam attempt');
    }
  }

  /**
   * Get an exam attempt by ID
   */
  async getExamAttempt(attemptId: string): Promise<ExamAttemptDocument> {
    if (!attemptId) {
      throw new Error('Attempt ID is required');
    }

    try {
      return await this.get<ExamAttemptDocument>(
        MockExamDriver.COLLECTION_EXAM_ATTEMPTS,
        attemptId
      );
    } catch (error) {
      throw this.handleError(error, `get exam attempt ${attemptId}`);
    }
  }

  /**
   * Update exam attempt with current answers (for auto-save)
   */
  async saveExamProgress(
    attemptId: string,
    answersSnapshot: string
  ): Promise<ExamAttemptDocument> {
    if (!attemptId) {
      throw new Error('Attempt ID is required');
    }

    try {
      return await this.update<ExamAttemptDocument>(
        MockExamDriver.COLLECTION_EXAM_ATTEMPTS,
        attemptId,
        {
          answers_snapshot: answersSnapshot,
        }
      );
    } catch (error) {
      throw this.handleError(error, `save exam progress ${attemptId}`);
    }
  }

  /**
   * Submit exam attempt
   */
  async submitExamAttempt(attemptId: string): Promise<ExamAttemptDocument> {
    if (!attemptId) {
      throw new Error('Attempt ID is required');
    }

    try {
      return await this.update<ExamAttemptDocument>(
        MockExamDriver.COLLECTION_EXAM_ATTEMPTS,
        attemptId,
        {
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        }
      );
    } catch (error) {
      throw this.handleError(error, `submit exam attempt ${attemptId}`);
    }
  }

  /**
   * Save grading result to exam attempt
   */
  async saveGradingResult(
    attemptId: string,
    evaluationResult: EvaluationResult
  ): Promise<ExamAttemptDocument> {
    if (!attemptId) {
      throw new Error('Attempt ID is required');
    }

    try {
      const compressedResult = compressJSON(evaluationResult);

      return await this.update<ExamAttemptDocument>(
        MockExamDriver.COLLECTION_EXAM_ATTEMPTS,
        attemptId,
        {
          status: 'graded',
          graded_at: new Date().toISOString(),
          result_snapshot: compressedResult,
        }
      );
    } catch (error) {
      throw this.handleError(error, `save grading result ${attemptId}`);
    }
  }

  /**
   * Get all attempts for a student on a specific exam
   */
  async getStudentExamAttempts(
    studentId: string,
    examId: string
  ): Promise<ExamAttemptDocument[]> {
    if (!studentId || !examId) {
      throw new Error('Student ID and Exam ID are required');
    }

    try {
      return await this.list<ExamAttemptDocument>(
        MockExamDriver.COLLECTION_EXAM_ATTEMPTS,
        [
          Query.equal('studentId', studentId),
          Query.equal('examId', examId),
          Query.orderDesc('$createdAt'),
        ]
      );
    } catch (error) {
      throw this.handleError(error, `get student exam attempts`);
    }
  }

  /**
   * Get the most recent graded attempt for a student
   */
  async getLatestGradedAttempt(
    studentId: string,
    examId: string
  ): Promise<ExamAttemptDocument | null> {
    if (!studentId || !examId) {
      throw new Error('Student ID and Exam ID are required');
    }

    try {
      const attempts = await this.list<ExamAttemptDocument>(
        MockExamDriver.COLLECTION_EXAM_ATTEMPTS,
        [
          Query.equal('studentId', studentId),
          Query.equal('examId', examId),
          Query.equal('status', 'graded'),
          Query.orderDesc('graded_at'),
          Query.limit(1),
        ]
      );

      return attempts.length > 0 ? attempts[0] : null;
    } catch (error) {
      throw this.handleError(error, `get latest graded attempt`);
    }
  }

  /**
   * Get evaluation result from a graded attempt
   */
  async getEvaluationResult(attemptId: string): Promise<EvaluationResult | null> {
    const attempt = await this.getExamAttempt(attemptId);

    if (attempt.status !== 'graded' || !attempt.result_snapshot) {
      return null;
    }

    try {
      return decompressJSON<EvaluationResult>(attempt.result_snapshot);
    } catch (error) {
      throw new Error(`Failed to decompress evaluation result: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
