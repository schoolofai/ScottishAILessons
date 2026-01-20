import { Query, ID } from 'appwrite';
import { BaseDriver } from './BaseDriver';
import type { AuthoredSOWData, AuthoredSOWEntry, AuthoredSOWMetadata } from '../types';
import { decompressJSONWithStorage } from '../utils/compression';

// REMOVED: SOWEntry interface - entries now come from Authored_SOW via dereference

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
  entries: AuthoredSOWEntry[];  // From dereferenced Authored_SOW
  metadata: AuthoredSOWMetadata;  // From dereferenced Authored_SOW
  accessibility_notes?: string;  // From dereferenced Authored_SOW
  createdAt: string;
  source_sow_id: string;  // Required - Authored_SOW document ID
  source_version: string;  // Required - version identifier
  customizations?: StudentCustomizations;
}

/**
 * Scheme of Work driver for per-student lesson planning using SOWV2
 */
export class SOWDriver extends BaseDriver {
  /**
   * Get SOW for specific enrollment (studentId + courseId)
   * Uses reference-based architecture: dereferences to Authored_SOW for curriculum data
   */
  async getSOWForEnrollment(studentId: string, courseId: string): Promise<SOWData | null> {
    try {
      console.log('[SOWDriver Debug] Starting getSOWForEnrollment with:', { studentId, courseId });

      // Step 1: Get SOWV2 reference record
      const queries = [
        Query.equal('studentId', studentId),
        Query.equal('courseId', courseId),
        Query.limit(1)
      ];
      console.log('[SOWDriver Debug] SOWV2 query constructed:', { queries, collection: 'SOWV2' });

      const records = await this.list('SOWV2', queries);
      console.log('[SOWDriver Debug] SOWV2 query result:', { recordCount: records.length, records });

      if (records.length === 0) {
        console.log('[SOWDriver Debug] No SOWV2 records found');
        return null;
      }

      const sowRecord = records[0];

      // Step 2: Dereference to Authored_SOW
      if (!sowRecord.source_authored_sow_id) {
        throw new Error(
          `SOWV2 record for ${studentId}/${courseId} missing source_authored_sow_id. ` +
          `This record may need migration. Run: npm run migrate-sowv2`
        );
      }

      console.log('[SOWDriver Debug] Dereferencing to Authored_SOW:', sowRecord.source_authored_sow_id);

      const authoredSOW = await this.get('Authored_SOW', sowRecord.source_authored_sow_id);

      if (!authoredSOW) {
        throw new Error(
          `Authored_SOW document ${sowRecord.source_authored_sow_id} not found ` +
          `(referenced by SOWV2 for ${studentId}/${courseId})`
        );
      }

      // Step 3: Parse Authored_SOW data (decompress entries, parse metadata)
      // Uses async decompression to support storage bucket refs (storage:<file_id>)
      const authoredEntries: AuthoredSOWEntry[] = await decompressJSONWithStorage(authoredSOW.entries, this.storage) || [];
      const authoredMetadata: AuthoredSOWMetadata = JSON.parse(authoredSOW.metadata || '{}');

      console.log('[SOWDriver Debug] Dereferenced curriculum:', {
        entries: authoredEntries.length,
        version: sowRecord.source_version
      });

      // Step 4: Parse customizations
      const customizations: StudentCustomizations = sowRecord.customizations
        ? JSON.parse(sowRecord.customizations)
        : {};

      // Step 5: Return combined data
      return {
        studentId: sowRecord.studentId,
        courseId: sowRecord.courseId,
        entries: authoredEntries,  // From Authored_SOW
        metadata: authoredMetadata,  // From Authored_SOW
        accessibility_notes: authoredSOW.accessibility_notes,  // From Authored_SOW
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
   * @deprecated Legacy consolidation removed in reference architecture
   * Use Authored_SOW as the source of curriculum data
   */
  private async consolidateLegacySOW(studentId: string, courseId: string, cacheResult: boolean = true): Promise<SOWData | null> {
    throw new Error(
      'consolidateLegacySOW is deprecated. Reference architecture requires Authored_SOW. ' +
      'Ensure an Authored_SOW exists for this course and create SOWV2 reference via copyFromAuthoredSOW().'
    );
  }

  /**
   * Create or update SOWV2 reference (reference architecture)
   * NOTE: Does NOT store entries - they are dereferenced from Authored_SOW
   */
  async upsertSOW(sowData: SOWData): Promise<any> {
    try {
      // Validate required reference fields
      if (!sowData.source_sow_id) {
        throw new Error('source_sow_id is required for SOWV2 records (reference architecture)');
      }

      // Skip user/permissions for Databases-only initialization
      let permissions: string[] = [];
      try {
        const user = await this.getCurrentUser();
        permissions = this.createUserPermissions(user.$id);
      } catch (error) {
        console.warn('[SOWDriver] Using empty permissions - Databases-only instance');
      }

      // Check if record exists
      const existingRecords = await this.list('SOWV2', [
        Query.equal('studentId', sowData.studentId),
        Query.equal('courseId', sowData.courseId),
        Query.limit(1)
      ]);

      const docData: any = {
        studentId: sowData.studentId,
        courseId: sowData.courseId,
        source_authored_sow_id: sowData.source_sow_id,  // Required reference
        source_version: sowData.source_version || 'unknown',
        createdAt: sowData.createdAt
        // NOTE: entries NOT stored in SOWV2 - dereferenced from Authored_SOW
      };

      // Add customizations if present
      if (sowData.customizations !== undefined) {
        docData.customizations = JSON.stringify(sowData.customizations);
      }

      if (existingRecords.length > 0) {
        // Update existing record
        return await this.update('SOWV2', existingRecords[0].$id, docData);
      }

      // Create new record
      return await this.create('SOWV2', docData, permissions);
    } catch (error) {
      throw this.handleError(error, 'upsert SOW');
    }
  }

  /**
   * @deprecated Use copyFromAuthoredSOW() instead
   * Reference architecture creates SOWV2 from Authored_SOW, not lesson IDs
   */
  async createSOW(studentId: string, courseId: string, lessonTemplateIds: string[]): Promise<any> {
    throw new Error(
      'createSOW is deprecated. Use copyFromAuthoredSOW() to create SOWV2 reference from Authored_SOW template.'
    );
  }

  /**
   * @deprecated Curriculum entries come from Authored_SOW (read-only via dereference)
   * Use updateCustomizations() to modify student-specific settings
   */
  async updateSOWEntries(studentId: string, courseId: string, newEntries: AuthoredSOWEntry[]): Promise<any> {
    throw new Error(
      'updateSOWEntries is deprecated. Curriculum entries come from Authored_SOW and cannot be modified. ' +
      'Use updateCustomizations() to mark lessons as skipped or add custom lessons.'
    );
  }

  /**
   * Add custom lesson to SOW via customizations
   * Stores custom lesson in customizations.entries[order]
   */
  async addLessonToSOW(studentId: string, courseId: string, lessonTemplateId: string, order?: number): Promise<any> {
    try {
      const sowData = await this.getSOWForEnrollment(studentId, courseId);
      if (!sowData) {
        throw new Error(`No SOW found for student ${studentId}, course ${courseId}`);
      }

      const customizations = sowData.customizations || { entries: {} };
      const targetOrder = order || sowData.entries.length + 1;

      // Mark as custom addition in customizations
      customizations.entries = customizations.entries || {};
      customizations.entries[targetOrder] = {
        ...customizations.entries[targetOrder],
        custom_lesson_id: lessonTemplateId,
        added_manually: true
      };

      console.log(`[SOWDriver] Adding custom lesson ${lessonTemplateId} at order ${targetOrder} for ${studentId}/${courseId}`);

      return await this.updateCustomizations(studentId, courseId, customizations);
    } catch (error) {
      throw this.handleError(error, 'add lesson to SOW');
    }
  }

  /**
   * Mark lesson as skipped via customizations
   * Does not actually remove from curriculum (entries come from Authored_SOW)
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

      console.log(`[SOWDriver] Marking lesson at order ${order} as skipped for ${studentId}/${courseId}`);

      return await this.updateCustomizations(studentId, courseId, customizations);
    } catch (error) {
      throw this.handleError(error, 'remove lesson from SOW');
    }
  }

  /**
   * Get next lesson in sequence (from Authored_SOW entries)
   */
  async getNextLesson(studentId: string, courseId: string, completedLessonIds: string[] = []): Promise<AuthoredSOWEntry | null> {
    try {
      const sow = await this.getSOWForEnrollment(studentId, courseId);

      if (!sow || sow.entries.length === 0) {
        return null;
      }

      // Find first lesson not in completed list (using lessonTemplateRef from AuthoredSOWEntry)
      const nextLesson = sow.entries
        .sort((a, b) => a.order - b.order)
        .find(entry => {
          // Check customizations to see if lesson is skipped
          const customization = sow.customizations?.entries?.[entry.order];
          if (customization?.skipped) {
            return false;
          }
          // Check if lesson is completed
          return !completedLessonIds.includes(entry.lessonTemplateRef);
        });

      return nextLesson || null;
    } catch (error) {
      throw this.handleError(error, 'get next lesson');
    }
  }

  /**
   * Get lessons by week (uses customizations.entries[order].plannedAt)
   */
  async getLessonsByWeek(studentId: string, courseId: string, weekNumber: number): Promise<AuthoredSOWEntry[]> {
    try {
      const sow = await this.getSOWForEnrollment(studentId, courseId);

      if (!sow) {
        return [];
      }

      // Filter by week using plannedAt from customizations
      return sow.entries.filter(entry => {
        const customization = sow.customizations?.entries?.[entry.order];
        const plannedAt = customization?.plannedAt;

        if (!plannedAt) return false;

        // Extract week from plannedAt (assuming ISO date format)
        const plannedDate = new Date(plannedAt);
        const startOfYear = new Date(plannedDate.getFullYear(), 0, 1);
        const weekOfYear = Math.ceil(((plannedDate.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);

        return weekOfYear === weekNumber;
      });
    } catch (error) {
      throw this.handleError(error, 'get lessons by week');
    }
  }

  /**
   * Schedule lesson for specific date via customizations
   * Stores plannedAt in customizations.entries[order].plannedAt
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

      console.log(`[SOWDriver] Scheduling lesson at order ${order} for ${plannedAt} (${studentId}/${courseId})`);

      return await this.updateCustomizations(studentId, courseId, customizations);
    } catch (error) {
      throw this.handleError(error, 'schedule lesson for date');
    }
  }

  /**
   * Get SOW progress statistics (uses AuthoredSOWEntry)
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

      // Count non-skipped lessons only
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
   * @deprecated Use copyFromAuthoredSOW() instead
   * Reference architecture requires Authored_SOW as template source
   */
  async copySOWFromTemplate(studentId: string, courseId: string, templateSOW: AuthoredSOWEntry[]): Promise<any> {
    throw new Error(
      'copySOWFromTemplate is deprecated. Use copyFromAuthoredSOW() to create SOWV2 reference from Authored_SOW.'
    );
  }

  /**
   * Create SOWV2 reference to Authored SOW for student enrollment
   * Reference architecture: creates lightweight pointer, NOT a data copy
   * Called when student enrolls in a course
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

      // Skip user/permissions for Databases-only initialization
      let permissions: string[] = [];
      try {
        const user = await this.getCurrentUser();
        permissions = this.createUserPermissions(user.$id);
      } catch (error) {
        console.warn('[SOWDriver] Using empty permissions - Databases-only instance');
      }

      // Create reference-only record (NO data duplication)
      const sowReferenceRecord = {
        studentId,
        courseId,
        source_authored_sow_id: authoredSOW.$id,  // Store document ID pointer
        source_version: authoredSOW.version,
        customizations: '{}',  // Empty customizations initially
        createdAt: new Date().toISOString()
      };

      console.log(`[SOWDriver] Creating SOWV2 reference to Authored SOW v${authoredSOW.version} for ${studentId}/${courseId}`);
      console.log(`[SOWDriver] Reference: ${authoredSOW.$id} (NO data copied)`);

      // Insert into SOWV2
      return await this.create('SOWV2', sowReferenceRecord, permissions);
    } catch (error) {
      throw this.handleError(error, `create SOWV2 reference for student ${studentId} course ${courseId}`);
    }
  }

  /**
   * Update enrollment SOW with customizations - Phase 2.2 MVP2.5
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

      console.log(`[SOWDriver] Updating customizations for ${studentId}/${courseId}`);

      return await this.update('SOWV2', existingRecords[0].$id, {
        customizations: JSON.stringify(customizations)
      });
    } catch (error) {
      throw this.handleError(error, `update SOW customizations for student ${studentId} course ${courseId}`);
    }
  }
}