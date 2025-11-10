/**
 * RevisionNotesDriver - Appwrite Driver for fetching revision notes markdown content
 *
 * This driver provides access to course-level cheat sheets and lesson-level quick notes
 * stored in Appwrite Storage. It follows the same pattern as DiagramDriver.
 *
 * @see specs/002-revision-notes-author/spec.md for backend data model
 * @see specs/003-revision-notes-frontend/data-model.md for frontend entities
 */

import { Storage, ID, Query } from 'appwrite';
import { BaseDriver } from './BaseDriver';

/**
 * Revision note types matching backend spec 002
 */
export type RevisionNoteType = 'cheat_sheet' | 'lesson_note';

/**
 * Metadata for a revision note document (from revision_notes collection)
 */
export interface RevisionNoteMetadata {
  $id: string;
  courseId: string;
  noteType: RevisionNoteType;
  lessonOrder?: number;
  markdownFileId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Revision note content with metadata
 */
export interface RevisionNoteContent {
  metadata: RevisionNoteMetadata;
  markdownContent: string;
  fileSize: number;
}

/**
 * Error codes for revision notes operations
 */
export enum RevisionNotesErrorCode {
  FETCH_FAILED = 'FETCH_FAILED',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',
  STORAGE_UNAVAILABLE = 'STORAGE_UNAVAILABLE',
  INVALID_DOCUMENT_ID = 'INVALID_DOCUMENT_ID'
}

/**
 * Custom error class for revision notes operations
 */
export class RevisionNotesError extends Error {
  constructor(
    public code: RevisionNotesErrorCode,
    message: string,
    public retryable: boolean = true
  ) {
    super(message);
    this.name = 'RevisionNotesError';
  }
}

/**
 * Driver for fetching revision notes from Appwrite
 *
 * Fast-fail principles:
 * - All errors throw detailed exceptions (no silent fallbacks)
 * - Network errors are retryable
 * - File not found errors are NOT retryable (content not generated yet)
 */
export class RevisionNotesDriver extends BaseDriver {
  private storage: Storage;
  private readonly BUCKET_ID = 'documents'; // Markdown files stored in documents bucket
  private readonly COLLECTION_ID = 'revision_notes';
  private readonly DATABASE_ID = 'default';

  constructor(client: any) {
    super(client);
    this.storage = new Storage(client);
  }

  /**
   * Check if a course cheat sheet exists in the database
   *
   * @param courseId - Course ID
   * @returns Promise<boolean> - True if cheat sheet exists
   * @throws RevisionNotesError - Network errors only (404 returns false)
   */
  async courseCheatSheetExists(courseId: string): Promise<boolean> {
    const documentId = this.getCheatSheetDocumentId(courseId);

    try {
      await this.databases.getDocument(
        this.DATABASE_ID,
        this.COLLECTION_ID,
        documentId
      );
      return true;
    } catch (error: any) {
      if (error.code === 404) {
        return false;
      }
      throw new RevisionNotesError(
        RevisionNotesErrorCode.NETWORK_ERROR,
        `Failed to check course cheat sheet existence for ${courseId}: ${error.message}`,
        true
      );
    }
  }

  /**
   * Check if lesson quick notes exist in the database
   *
   * @param courseId - Course ID
   * @param lessonOrder - Lesson order number (1-based)
   * @returns Promise<boolean> - True if lesson notes exist
   * @throws RevisionNotesError - Network errors only (404 returns false)
   */
  async lessonNotesExist(courseId: string, lessonOrder: number): Promise<boolean> {
    const documentId = this.getLessonNotesDocumentId(courseId, lessonOrder);

    try {
      await this.databases.getDocument(
        this.DATABASE_ID,
        this.COLLECTION_ID,
        documentId
      );
      return true;
    } catch (error: any) {
      if (error.code === 404) {
        return false;
      }
      throw new RevisionNotesError(
        RevisionNotesErrorCode.NETWORK_ERROR,
        `Failed to check lesson notes existence for ${courseId} lesson ${lessonOrder}: ${error.message}`,
        true
      );
    }
  }

  /**
   * Fetch course-level cheat sheet markdown content
   *
   * @param courseId - Course ID
   * @returns Promise<RevisionNoteContent> - Cheat sheet content with metadata
   * @throws RevisionNotesError - FILE_NOT_FOUND (not retryable), FETCH_FAILED (retryable)
   */
  async getCourseCheatSheet(courseId: string): Promise<RevisionNoteContent> {
    const documentId = this.getCheatSheetDocumentId(courseId);

    try {
      // Fetch metadata from database
      const document = await this.databases.getDocument(
        this.DATABASE_ID,
        this.COLLECTION_ID,
        documentId
      ) as RevisionNoteMetadata;

      // Fetch markdown file from storage
      const markdownContent = await this.fetchMarkdownFile(document.markdownFileId);

      return {
        metadata: document,
        markdownContent,
        fileSize: markdownContent.length
      };
    } catch (error: any) {
      if (error.code === 404) {
        throw new RevisionNotesError(
          RevisionNotesErrorCode.FILE_NOT_FOUND,
          `Course cheat sheet not yet available for course ${courseId}`,
          false // Not retryable - content not generated yet
        );
      }

      throw new RevisionNotesError(
        RevisionNotesErrorCode.FETCH_FAILED,
        `Failed to fetch course cheat sheet for ${courseId}: ${error.message}`,
        true // Retryable - might be network issue
      );
    }
  }

  /**
   * Fetch lesson-level quick notes markdown content
   *
   * @param courseId - Course ID
   * @param lessonOrder - Lesson order number (1-based)
   * @returns Promise<RevisionNoteContent> - Lesson notes content with metadata
   * @throws RevisionNotesError - FILE_NOT_FOUND (not retryable), FETCH_FAILED (retryable)
   */
  async getLessonQuickNotes(courseId: string, lessonOrder: number): Promise<RevisionNoteContent> {
    const documentId = this.getLessonNotesDocumentId(courseId, lessonOrder);

    try {
      // Fetch metadata from database
      const document = await this.databases.getDocument(
        this.DATABASE_ID,
        this.COLLECTION_ID,
        documentId
      ) as RevisionNoteMetadata;

      // Fetch markdown file from storage
      const markdownContent = await this.fetchMarkdownFile(document.markdownFileId);

      return {
        metadata: document,
        markdownContent,
        fileSize: markdownContent.length
      };
    } catch (error: any) {
      if (error.code === 404) {
        throw new RevisionNotesError(
          RevisionNotesErrorCode.FILE_NOT_FOUND,
          `Lesson notes not yet available for course ${courseId} lesson ${lessonOrder}`,
          false // Not retryable - content not generated yet
        );
      }

      throw new RevisionNotesError(
        RevisionNotesErrorCode.FETCH_FAILED,
        `Failed to fetch lesson notes for ${courseId} lesson ${lessonOrder}: ${error.message}`,
        true // Retryable - might be network issue
      );
    }
  }

  /**
   * Fetch all lesson notes for a course (useful for bulk prefetch)
   *
   * @param courseId - Course ID
   * @returns Promise<RevisionNoteContent[]> - Array of lesson notes
   * @throws RevisionNotesError - FETCH_FAILED (retryable)
   */
  async getAllLessonNotesForCourse(courseId: string): Promise<RevisionNoteContent[]> {
    try {
      // Query all lesson notes for the course
      const documents = await this.databases.listDocuments(
        this.DATABASE_ID,
        this.COLLECTION_ID,
        [
          Query.equal('courseId', courseId),
          Query.equal('noteType', 'lesson_note'),
          Query.orderAsc('lessonOrder')
        ]
      );

      // Fetch markdown content for each lesson note
      const lessonNotes = await Promise.all(
        documents.documents.map(async (doc: any) => {
          const markdownContent = await this.fetchMarkdownFile(doc.markdownFileId);
          return {
            metadata: doc as RevisionNoteMetadata,
            markdownContent,
            fileSize: markdownContent.length
          };
        })
      );

      return lessonNotes;
    } catch (error: any) {
      throw new RevisionNotesError(
        RevisionNotesErrorCode.FETCH_FAILED,
        `Failed to fetch lesson notes for course ${courseId}: ${error.message}`,
        true
      );
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Fetch markdown file content from Appwrite Storage
   *
   * @param fileId - Appwrite Storage file ID
   * @returns Promise<string> - Markdown content as string
   * @throws RevisionNotesError - STORAGE_UNAVAILABLE (retryable)
   */
  private async fetchMarkdownFile(fileId: string): Promise<string> {
    try {
      const fileView = this.storage.getFileView(this.BUCKET_ID, fileId);
      const response = await fetch(fileView.href);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const markdownText = await response.text();
      return markdownText;
    } catch (error: any) {
      throw new RevisionNotesError(
        RevisionNotesErrorCode.STORAGE_UNAVAILABLE,
        `Failed to fetch markdown file ${fileId} from storage: ${error.message}`,
        true // Retryable - might be temporary storage issue
      );
    }
  }

  /**
   * Generate document ID for course cheat sheet
   *
   * Format: revision_notes_{courseId}_cheat_sheet
   *
   * @param courseId - Course ID
   * @returns string - Document ID
   */
  private getCheatSheetDocumentId(courseId: string): string {
    return `revision_notes_${courseId}_cheat_sheet`;
  }

  /**
   * Generate document ID for lesson notes
   *
   * Format: revision_notes_{courseId}_lesson_{lessonOrder:02d}
   *
   * @param courseId - Course ID
   * @param lessonOrder - Lesson order number (1-based)
   * @returns string - Document ID
   */
  private getLessonNotesDocumentId(courseId: string, lessonOrder: number): string {
    const paddedOrder = String(lessonOrder).padStart(2, '0');
    return `revision_notes_${courseId}_lesson_${paddedOrder}`;
  }

  /**
   * Validate document ID format
   *
   * @param documentId - Document ID to validate
   * @returns boolean - True if valid format
   */
  private isValidDocumentId(documentId: string): boolean {
    const cheatSheetPattern = /^revision_notes_[\w-]+_cheat_sheet$/;
    const lessonNotePattern = /^revision_notes_[\w-]+_lesson_\d{2}$/;

    return cheatSheetPattern.test(documentId) || lessonNotePattern.test(documentId);
  }
}
