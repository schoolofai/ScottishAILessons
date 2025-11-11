import { Storage, Query, Databases } from 'appwrite';
import { BaseDriver } from './BaseDriver';

/**
 * Revision note types matching backend spec 002
 */
export type RevisionNoteType = 'cheat_sheet' | 'lesson_note';

/**
 * Metadata for a revision note document (from revision_notes collection)
 * Note: Backend stores markdown_file_id in snake_case (Python convention)
 */
export interface RevisionNoteMetadata {
  $id: string;
  courseId: string;
  noteType: RevisionNoteType;
  lessonOrder?: number;
  markdown_file_id: string; // Backend uses snake_case
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

  constructor(sessionTokenOrDatabases?: string | Databases) {
    super(sessionTokenOrDatabases);

    // Initialize Storage service (same pattern as DiagramDriver)
    if (this.client) {
      this.storage = new Storage(this.client);
    } else {
      // Fallback: create new client for Storage access
      const { Client } = require('appwrite');
      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);
      this.storage = new Storage(client);
    }
  }

  /**
   * Check if a course cheat sheet exists in the database
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
      const markdownContent = await this.fetchMarkdownFile(document.markdown_file_id);

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
      const markdownContent = await this.fetchMarkdownFile(document.markdown_file_id);

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
   * Fetch markdown file content from Appwrite Storage
   */
  private async fetchMarkdownFile(fileId: string): Promise<string> {
    try {
      // Construct download URL manually (same pattern as DiagramDriver)
      const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
      const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

      if (!endpoint || !projectId) {
        throw new Error('Missing NEXT_PUBLIC_APPWRITE_ENDPOINT or NEXT_PUBLIC_APPWRITE_PROJECT_ID');
      }

      // Use /view endpoint to get file content
      const fileUrl = `${endpoint}/storage/buckets/${this.BUCKET_ID}/files/${fileId}/view?project=${projectId}`;
      const response = await fetch(fileUrl);

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
   * Format: {courseId}_cheat_sheet
   * Note: Backend removed 'revision_notes_' prefix to stay within Appwrite's 36-char limit
   */
  private getCheatSheetDocumentId(courseId: string): string {
    return `${courseId}_cheat_sheet`;
  }

  /**
   * Generate document ID for lesson notes
   * Format: {courseId}_lesson_{lessonOrder:02d}
   * Note: Backend removed 'revision_notes_' prefix to stay within Appwrite's 36-char limit
   */
  private getLessonNotesDocumentId(courseId: string, lessonOrder: number): string {
    const paddedOrder = String(lessonOrder).padStart(2, '0');
    return `${courseId}_lesson_${paddedOrder}`;
  }
}
