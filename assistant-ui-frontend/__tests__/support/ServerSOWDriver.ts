import { Query } from 'node-appwrite';
import { ServerBaseDriver } from './ServerBaseDriver';
import type { AuthoredSOWData, AuthoredSOWEntry, AuthoredSOWMetadata } from '../../lib/appwrite/types';
import { decompressJSONWithStorage } from '../../lib/appwrite/utils/compression';

export interface StudentCustomizations {
  entries?: {
    [order: number]: {
      plannedAt?: string;
      skipped?: boolean;
      notes?: string;
      custom_lesson_id?: string;
      added_manually?: boolean;
    };
  };
  preferences?: any;
}

export interface SOWData {
  studentId: string;
  courseId: string;
  entries: AuthoredSOWEntry[];
  metadata: AuthoredSOWMetadata;
  accessibility_notes?: string;
  createdAt: string;
  source_sow_id: string;
  source_version: string;
  customizations?: StudentCustomizations;
}

/**
 * Server-side SOW driver for integration tests with SSR authentication
 * Implements reference-based architecture where SOWV2 references Authored_SOW
 */
export class ServerSOWDriver extends ServerBaseDriver {
  constructor(sessionClient?: { client: any; account: any; databases: any }, sessionUserId?: string) {
    super(sessionClient, sessionUserId);
  }

  /**
   * Get SOW for specific enrollment (studentId + courseId)
   * Uses reference-based architecture: dereferences to Authored_SOW for curriculum data
   */
  async getSOWForEnrollment(studentId: string, courseId: string): Promise<SOWData | null> {
    try {
      // Step 1: Get SOWV2 reference record
      const records = await this.list('SOWV2', [
        Query.equal('studentId', studentId),
        Query.equal('courseId', courseId),
        Query.limit(1)
      ]);

      if (records.length === 0) {
        return null;
      }

      const sowRecord = records[0];

      // Step 2: Validate reference exists
      if (!sowRecord.source_authored_sow_id) {
        throw new Error(
          `SOWV2 record for ${studentId}/${courseId} missing source_authored_sow_id. ` +
          `This record may need migration. Run: npm run migrate-sowv2`
        );
      }

      // Step 3: Dereference to Authored_SOW
      const authoredSOW = await this.get('Authored_SOW', sowRecord.source_authored_sow_id);

      if (!authoredSOW) {
        throw new Error(
          `Authored_SOW document ${sowRecord.source_authored_sow_id} not found ` +
          `(referenced by SOWV2 for ${studentId}/${courseId})`
        );
      }

      // Step 4: Parse Authored_SOW data (decompress entries, parse metadata)
      // Uses async decompression to support storage bucket refs (storage:<file_id>)
      const authoredEntries: AuthoredSOWEntry[] = await decompressJSONWithStorage(authoredSOW.entries, this.storage) || [];
      const authoredMetadata: AuthoredSOWMetadata = JSON.parse(authoredSOW.metadata || '{}');

      // Step 5: Parse customizations
      const customizations: StudentCustomizations = sowRecord.customizations
        ? JSON.parse(sowRecord.customizations)
        : {};

      // Step 6: Return combined data
      return {
        studentId: sowRecord.studentId,
        courseId: sowRecord.courseId,
        entries: authoredEntries,
        metadata: authoredMetadata,
        accessibility_notes: authoredSOW.accessibility_notes,
        createdAt: sowRecord.createdAt,
        source_sow_id: sowRecord.source_authored_sow_id,
        source_version: sowRecord.source_version || 'unknown',
        customizations
      };
    } catch (error) {
      throw this.handleError(error, 'get SOW for enrollment');
    }
  }

  /**
   * Create SOWV2 reference to Authored SOW for student enrollment
   * Reference architecture: creates lightweight pointer, NOT a data copy
   */
  async copyFromAuthoredSOW(
    studentId: string,
    courseId: string,
    authoredSOW: AuthoredSOWData
  ): Promise<any> {
    try {
      if (!authoredSOW || !authoredSOW.$id) {
        throw new Error(`Invalid Authored SOW data for course ${courseId} - missing document ID`);
      }

      const permissions = this.createUserPermissions();

      // Create reference-only record (NO data duplication)
      const sowReferenceRecord = {
        studentId,
        courseId,
        source_authored_sow_id: authoredSOW.$id,
        source_version: authoredSOW.version,
        customizations: '{}',
        createdAt: new Date().toISOString()
      };

      return await this.create('SOWV2', sowReferenceRecord, permissions);
    } catch (error) {
      throw this.handleError(error, `create SOWV2 reference for student ${studentId} course ${courseId}`);
    }
  }

  /**
   * Update enrollment SOW with customizations
   */
  async updateCustomizations(
    studentId: string,
    courseId: string,
    customizations: any
  ): Promise<any> {
    try {
      const existing = await this.getSOWForEnrollment(studentId, courseId);

      if (!existing) {
        throw new Error(`SOW not found for student ${studentId} in course ${courseId}`);
      }

      const existingRecords = await this.list('SOWV2', [
        Query.equal('studentId', studentId),
        Query.equal('courseId', courseId),
        Query.limit(1)
      ]);

      if (existingRecords.length === 0) {
        throw new Error(`SOWV2 record not found for student ${studentId} in course ${courseId}`);
      }

      return await this.update('SOWV2', existingRecords[0].$id, {
        customizations: JSON.stringify(customizations)
      });
    } catch (error) {
      throw this.handleError(error, `update SOW customizations for student ${studentId} course ${courseId}`);
    }
  }

  /**
   * Add custom lesson to SOW via customizations
   */
  async addLessonToSOW(studentId: string, courseId: string, lessonTemplateId: string, order?: number): Promise<any> {
    try {
      const sowData = await this.getSOWForEnrollment(studentId, courseId);
      if (!sowData) {
        throw new Error(`No SOW found for student ${studentId}, course ${courseId}`);
      }

      const customizations = sowData.customizations || { entries: {} };
      const targetOrder = order || sowData.entries.length + 1;

      customizations.entries = customizations.entries || {};
      customizations.entries[targetOrder] = {
        ...customizations.entries[targetOrder],
        custom_lesson_id: lessonTemplateId,
        added_manually: true
      };

      return await this.updateCustomizations(studentId, courseId, customizations);
    } catch (error) {
      throw this.handleError(error, 'add lesson to SOW');
    }
  }

  /**
   * Mark lesson as skipped via customizations
   */
  async removeLessonFromSOW(studentId: string, courseId: string, order: number): Promise<any> {
    try {
      const sowData = await this.getSOWForEnrollment(studentId, courseId);
      if (!sowData) {
        throw new Error(`No SOW found for student ${studentId}, course ${courseId}`);
      }

      const customizations = sowData.customizations || { entries: {} };
      customizations.entries = customizations.entries || {};
      customizations.entries[order] = {
        ...customizations.entries[order],
        skipped: true
      };

      return await this.updateCustomizations(studentId, courseId, customizations);
    } catch (error) {
      throw this.handleError(error, 'remove lesson from SOW');
    }
  }

  /**
   * Schedule lesson for specific date via customizations
   */
  async scheduleLessonForDate(studentId: string, courseId: string, order: number, plannedAt: string): Promise<any> {
    try {
      const sowData = await this.getSOWForEnrollment(studentId, courseId);
      if (!sowData) {
        throw new Error(`No SOW found for student ${studentId}, course ${courseId}`);
      }

      const customizations = sowData.customizations || { entries: {} };
      customizations.entries = customizations.entries || {};
      customizations.entries[order] = {
        ...customizations.entries[order],
        plannedAt: plannedAt
      };

      return await this.updateCustomizations(studentId, courseId, customizations);
    } catch (error) {
      throw this.handleError(error, 'schedule lesson for date');
    }
  }

  /**
   * Get next lesson in sequence
   */
  async getNextLesson(studentId: string, courseId: string, completedLessonIds: string[] = []): Promise<AuthoredSOWEntry | null> {
    try {
      const sow = await this.getSOWForEnrollment(studentId, courseId);

      if (!sow || sow.entries.length === 0) {
        return null;
      }

      const nextLesson = sow.entries
        .sort((a, b) => a.order - b.order)
        .find(entry => {
          const customization = sow.customizations?.entries?.[entry.order];
          if (customization?.skipped) {
            return false;
          }
          return !completedLessonIds.includes(entry.lessonTemplateRef);
        });

      return nextLesson || null;
    } catch (error) {
      throw this.handleError(error, 'get next lesson');
    }
  }

  /**
   * Get SOW progress statistics
   */
  async getSOWProgress(studentId: string, courseId: string, completedLessonIds: string[] = []): Promise<{
    totalLessons: number;
    completedLessons: number;
    progressPercentage: number;
    nextLesson?: AuthoredSOWEntry;
  }> {
    try {
      const sow = await this.getSOWForEnrollment(studentId, courseId);

      if (!sow) {
        return {
          totalLessons: 0,
          completedLessons: 0,
          progressPercentage: 0
        };
      }

      const nonSkippedEntries = sow.entries.filter(entry => {
        const customization = sow.customizations?.entries?.[entry.order];
        return !customization?.skipped;
      });

      const totalLessons = nonSkippedEntries.length;
      const completedLessons = nonSkippedEntries.filter(entry =>
        completedLessonIds.includes(entry.lessonTemplateRef)
      ).length;

      const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

      const nextLesson = await this.getNextLesson(studentId, courseId, completedLessonIds);

      return {
        totalLessons,
        completedLessons,
        progressPercentage,
        nextLesson: nextLesson || undefined
      };
    } catch (error) {
      throw this.handleError(error, 'get SOW progress');
    }
  }

  /**
   * Delete SOWV2 record (for test cleanup)
   */
  async deleteSOWV2(studentId: string, courseId: string): Promise<void> {
    try {
      const records = await this.list('SOWV2', [
        Query.equal('studentId', studentId),
        Query.equal('courseId', courseId)
      ]);

      for (const record of records) {
        await this.delete('SOWV2', record.$id);
      }
    } catch (error) {
      throw this.handleError(error, 'delete SOWV2');
    }
  }
}
