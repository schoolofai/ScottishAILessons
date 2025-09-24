import { Query } from 'appwrite';
import { BaseDriver } from './BaseDriver';

export interface SOWEntry {
  order: number;
  lessonTemplateId: string;
  plannedAt?: string;
}

export interface SOWData {
  studentId: string;
  courseId: string;
  entries: SOWEntry[];
  createdAt: string;
}

/**
 * Scheme of Work driver for per-student lesson planning using SOWV2
 */
export class SOWDriver extends BaseDriver {
  /**
   * Get SOW for specific enrollment (studentId + courseId)
   * Falls back to consolidating legacy scheme_of_work entries if SOWV2 not found
   */
  async getSOWForEnrollment(studentId: string, courseId: string): Promise<SOWData | null> {
    try {
      console.log('[SOWDriver Debug] Starting getSOWForEnrollment with:', { studentId, courseId });

      // Try to get from SOWV2 first
      const queries = [
        Query.equal('studentId', studentId),
        Query.equal('courseId', courseId),
        Query.limit(1)
      ];
      console.log('[SOWDriver Debug] SOWV2 query constructed:', { queries, collection: 'SOWV2' });

      const records = await this.list('SOWV2', queries);
      console.log('[SOWDriver Debug] SOWV2 query result:', { recordCount: records.length, records });

      if (records.length > 0) {
        const record = records[0];
        return {
          studentId: record.studentId,
          courseId: record.courseId,
          entries: JSON.parse(record.entries || '[]'),
          createdAt: record.createdAt
        };
      }

      // Fallback: consolidate legacy scheme_of_work entries
      console.log('[SOWDriver Debug] No SOWV2 records found, falling back to legacy SOW consolidation');
      return await this.consolidateLegacySOW(studentId, courseId);
    } catch (error) {
      throw this.handleError(error, 'get SOW for enrollment');
    }
  }

  /**
   * Consolidate legacy sow entries into SOWV2 format
   * and optionally cache the result
   */
  private async consolidateLegacySOW(studentId: string, courseId: string, cacheResult: boolean = true): Promise<SOWData | null> {
    try {
      // Query legacy sow entries - note: sow is course-level, not student-specific
      const legacyEntries = await this.list('sow', [
        Query.equal('courseId', courseId),
        Query.orderAsc('weekNumber')
      ]);

      if (legacyEntries.length === 0) {
        return null;
      }

      // Convert sow structure to SOWV2 format
      // sow has: courseId, weekNumber, lessonIds (JSON string array)
      // SOWV2 needs: studentId, courseId, entries (with order, lessonTemplateId)
      const entries: SOWEntry[] = [];
      let order = 1;

      for (const entry of legacyEntries) {
        try {
          const lessonIds = JSON.parse(entry.lessonIds || '[]');
          for (const lessonId of lessonIds) {
            entries.push({
              order: order++,
              lessonTemplateId: lessonId,
              plannedAt: undefined // sow doesn't have specific planning dates
            });
          }
        } catch (parseError) {
          console.warn(`Failed to parse lessonIds for sow entry ${entry.$id}:`, parseError);
        }
      }

      if (entries.length === 0) {
        return null;
      }

      const sowData: SOWData = {
        studentId,
        courseId,
        entries,
        createdAt: legacyEntries[0]?.$createdAt || new Date().toISOString()
      };

      // Optionally cache in SOWV2 for future lookups
      if (cacheResult) {
        try {
          await this.upsertSOW(sowData);
          console.log(`Consolidated legacy SOW for ${studentId}/${courseId} into SOWV2`);
        } catch (cacheError) {
          // Don't fail if caching fails, just log
          console.warn('Failed to cache consolidated SOW:', cacheError);
        }
      }

      return sowData;
    } catch (error) {
      throw this.handleError(error, 'consolidate legacy SOW');
    }
  }

  /**
   * Create or update SOW for enrollment
   */
  async upsertSOW(sowData: SOWData): Promise<any> {
    try {
      // Skip user/permissions for Databases-only initialization (planner service usage)
      let permissions: string[] = [];
      try {
        const user = await this.getCurrentUser();
        permissions = this.createUserPermissions(user.$id);
      } catch (error) {
        // For Databases-only drivers, use empty permissions (server-side operations)
        console.warn('SOWDriver: Using empty permissions - initialized with Databases instance only');
      }

      // Check if record exists
      const existing = await this.getSOWForEnrollment(sowData.studentId, sowData.courseId);

      const docData = {
        studentId: sowData.studentId,
        courseId: sowData.courseId,
        entries: JSON.stringify(sowData.entries),
        createdAt: sowData.createdAt
      };

      if (existing) {
        // Update existing record - find by querying since we need the document ID
        const existingRecords = await this.list('SOWV2', [
          Query.equal('studentId', sowData.studentId),
          Query.equal('courseId', sowData.courseId),
          Query.limit(1)
        ]);

        if (existingRecords.length > 0) {
          return await this.update('SOWV2', existingRecords[0].$id, docData);
        }
      }

      // Create new record
      return await this.create('SOWV2', docData, permissions);
    } catch (error) {
      throw this.handleError(error, 'upsert SOW');
    }
  }

  /**
   * Initialize SOW for new enrollment with template sequence
   */
  async createSOW(studentId: string, courseId: string, lessonTemplateIds: string[]): Promise<any> {
    try {
      const entries: SOWEntry[] = lessonTemplateIds.map((templateId, index) => ({
        order: index + 1,
        lessonTemplateId: templateId
      }));

      const sowData: SOWData = {
        studentId,
        courseId,
        entries,
        createdAt: new Date().toISOString()
      };

      return await this.upsertSOW(sowData);
    } catch (error) {
      throw this.handleError(error, 'create SOW');
    }
  }

  /**
   * Update SOW entries (reorder, add, remove lessons)
   */
  async updateSOWEntries(studentId: string, courseId: string, newEntries: SOWEntry[]): Promise<any> {
    try {
      const existing = await this.getSOWForEnrollment(studentId, courseId);

      if (!existing) {
        throw new Error('SOW not found for enrollment');
      }

      // Ensure entries are properly ordered
      const sortedEntries = newEntries
        .map((entry, index) => ({ ...entry, order: index + 1 }))
        .sort((a, b) => a.order - b.order);

      const sowData: SOWData = {
        ...existing,
        entries: sortedEntries
      };

      return await this.upsertSOW(sowData);
    } catch (error) {
      throw this.handleError(error, 'update SOW entries');
    }
  }

  /**
   * Add lesson to SOW at specific position
   */
  async addLessonToSOW(studentId: string, courseId: string, lessonTemplateId: string, position?: number): Promise<any> {
    try {
      const existing = await this.getSOWForEnrollment(studentId, courseId);

      if (!existing) {
        // Create new SOW with single lesson
        return await this.createSOW(studentId, courseId, [lessonTemplateId]);
      }

      const entries = [...existing.entries];
      const newEntry: SOWEntry = {
        order: position || entries.length + 1,
        lessonTemplateId: lessonTemplateId
      };

      if (position && position <= entries.length) {
        // Insert at specific position
        entries.splice(position - 1, 0, newEntry);
      } else {
        // Add at end
        entries.push(newEntry);
      }

      return await this.updateSOWEntries(studentId, courseId, entries);
    } catch (error) {
      throw this.handleError(error, 'add lesson to SOW');
    }
  }

  /**
   * Remove lesson from SOW
   */
  async removeLessonFromSOW(studentId: string, courseId: string, lessonTemplateId: string): Promise<any> {
    try {
      const existing = await this.getSOWForEnrollment(studentId, courseId);

      if (!existing) {
        throw new Error('SOW not found for enrollment');
      }

      const updatedEntries = existing.entries.filter(entry => entry.lessonTemplateId !== lessonTemplateId);

      return await this.updateSOWEntries(studentId, courseId, updatedEntries);
    } catch (error) {
      throw this.handleError(error, 'remove lesson from SOW');
    }
  }

  /**
   * Get next lesson in sequence
   */
  async getNextLesson(studentId: string, courseId: string, completedLessonIds: string[] = []): Promise<SOWEntry | null> {
    try {
      const sow = await this.getSOWForEnrollment(studentId, courseId);

      if (!sow || sow.entries.length === 0) {
        return null;
      }

      // Find first lesson not in completed list
      const nextLesson = sow.entries
        .sort((a, b) => a.order - b.order)
        .find(entry => !completedLessonIds.includes(entry.lessonTemplateId));

      return nextLesson || null;
    } catch (error) {
      throw this.handleError(error, 'get next lesson');
    }
  }

  /**
   * Get lessons by week (if plannedAt is used)
   */
  async getLessonsByWeek(studentId: string, courseId: string, weekNumber: number): Promise<SOWEntry[]> {
    try {
      const sow = await this.getSOWForEnrollment(studentId, courseId);

      if (!sow) {
        return [];
      }

      // Filter by week if plannedAt contains week information
      return sow.entries.filter(entry => {
        if (!entry.plannedAt) return false;

        // Extract week from plannedAt (assuming ISO date format)
        const plannedDate = new Date(entry.plannedAt);
        const startOfYear = new Date(plannedDate.getFullYear(), 0, 1);
        const weekOfYear = Math.ceil(((plannedDate.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);

        return weekOfYear === weekNumber;
      });
    } catch (error) {
      throw this.handleError(error, 'get lessons by week');
    }
  }

  /**
   * Schedule lesson for specific date
   */
  async scheduleLessonForDate(studentId: string, courseId: string, lessonTemplateId: string, plannedAt: string): Promise<any> {
    try {
      const existing = await this.getSOWForEnrollment(studentId, courseId);

      if (!existing) {
        throw new Error('SOW not found for enrollment');
      }

      const updatedEntries = existing.entries.map(entry => {
        if (entry.lessonTemplateId === lessonTemplateId) {
          return { ...entry, plannedAt };
        }
        return entry;
      });

      return await this.updateSOWEntries(studentId, courseId, updatedEntries);
    } catch (error) {
      throw this.handleError(error, 'schedule lesson for date');
    }
  }

  /**
   * Get SOW progress statistics
   */
  async getSOWProgress(studentId: string, courseId: string, completedLessonIds: string[] = []): Promise<{
    totalLessons: number;
    completedLessons: number;
    progressPercentage: number;
    nextLesson?: SOWEntry;
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

      const totalLessons = sow.entries.length;
      const completedLessons = sow.entries.filter(entry =>
        completedLessonIds.includes(entry.lessonTemplateId)
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
   * Copy SOW from template for new enrollment
   */
  async copySOWFromTemplate(studentId: string, courseId: string, templateSOW: SOWEntry[]): Promise<any> {
    try {
      const sowData: SOWData = {
        studentId,
        courseId,
        entries: templateSOW.map((entry, index) => ({
          ...entry,
          order: index + 1
        })),
        createdAt: new Date().toISOString()
      };

      return await this.upsertSOW(sowData);
    } catch (error) {
      throw this.handleError(error, 'copy SOW from template');
    }
  }
}