import { Query } from 'appwrite';
import { BaseDriver } from './BaseDriver';

export interface MasteryV2Data {
  studentId: string;
  courseId: string;
  emaByOutcomeId: { [outcomeDocumentId: string]: number }; // Keys are course_outcome document IDs
  updatedAt: string;
}

export interface MasteryV2Update {
  outcomeId: string; // course_outcome document ID
  score: number;
  timestamp: string;
}

/**
 * MasteryV2 Driver - Uses course_outcome document IDs as keys
 * Enhanced version of MasteryDriver using document IDs instead of string refs
 */
export class MasteryV2Driver extends BaseDriver {

  /**
   * Get consolidated mastery record for student/course using outcome document IDs
   */
  async getMasteryV2(studentId: string, courseId: string): Promise<MasteryV2Data | null> {
    try {
      console.log('[MasteryV2Driver] getMasteryV2 called:', { studentId, courseId });

      const records = await this.list('MasteryV2', [
        Query.equal('studentId', studentId),
        Query.equal('courseId', courseId),
        Query.limit(1)
      ]);

      console.log('[MasteryV2Driver] getMasteryV2 query results:', { recordCount: records.length });

      if (records.length === 0) {
        console.log('[MasteryV2Driver] No MasteryV2 record found');
        return null;
      }

      const record = records[0];
      console.log('[MasteryV2Driver] Raw MasteryV2 record:', record);

      const parsedEmaByOutcomeId = JSON.parse(record.emaByOutcome || '{}');
      console.log('[MasteryV2Driver] Parsed emaByOutcomeId:', parsedEmaByOutcomeId);

      const result = {
        studentId: record.studentId,
        courseId: record.courseId,
        emaByOutcomeId: parsedEmaByOutcomeId,
        updatedAt: record.updatedAt
      };

      console.log('[MasteryV2Driver] getMasteryV2 returning:', result);
      return result;
    } catch (error) {
      console.error('[MasteryV2Driver] getMasteryV2 failed:', {
        studentId,
        courseId,
        error: error.message,
        stack: error.stack
      });
      throw this.handleError(error, 'get masteryV2');
    }
  }

  /**
   * Upsert consolidated mastery record using outcome document IDs
   */
  async upsertMasteryV2(masteryData: MasteryV2Data): Promise<any> {
    try {
      console.log('[MasteryV2Driver] Upserting MasteryV2 record:', masteryData);

      // Check if record exists
      const existing = await this.getMasteryV2(masteryData.studentId, masteryData.courseId);

      const docData = {
        studentId: masteryData.studentId,
        courseId: masteryData.courseId,
        emaByOutcome: JSON.stringify(masteryData.emaByOutcomeId),
        updatedAt: masteryData.updatedAt
      };

      console.log('[MasteryV2Driver] Document data to upsert:', docData);

      if (existing) {
        // Update existing record - find by querying since we need the document ID
        const existingRecords = await this.list('MasteryV2', [
          Query.equal('studentId', masteryData.studentId),
          Query.equal('courseId', masteryData.courseId),
          Query.limit(1)
        ]);

        if (existingRecords.length > 0) {
          console.log('[MasteryV2Driver] Updating existing MasteryV2 record with ID:', existingRecords[0].$id);
          return await this.update('MasteryV2', existingRecords[0].$id, docData);
        }
      }

      // Create new record
      console.log('[MasteryV2Driver] Creating new MasteryV2 record');
      try {
        return await this.create('MasteryV2', docData);
      } catch (createError) {
        // Handle race condition: if document was created between check and create
        if (createError.message.includes('already exists') || createError.message.includes('Document with the requested ID already exists')) {
          console.log('[MasteryV2Driver] Race condition detected, falling back to update operation');

          // Re-query for the record that was created
          const existingRecords = await this.list('MasteryV2', [
            Query.equal('studentId', masteryData.studentId),
            Query.equal('courseId', masteryData.courseId),
            Query.limit(1)
          ]);

          if (existingRecords.length > 0) {
            console.log('[MasteryV2Driver] Found record created by race condition, updating with ID:', existingRecords[0].$id);
            return await this.update('MasteryV2', existingRecords[0].$id, docData);
          }
        }

        // If it's not a race condition, re-throw the original error
        throw createError;
      }
    } catch (error) {
      console.error('[MasteryV2Driver] Upsert MasteryV2 failed:', error);
      throw this.handleError(error, 'upsert masteryV2');
    }
  }

  /**
   * Update specific outcome EMA using document ID
   */
  async updateOutcomeEMA(studentId: string, courseId: string, outcomeDocId: string, emaScore: number): Promise<any> {
    try {
      let existing = await this.getMasteryV2(studentId, courseId);

      // Auto-create initial mastery record if none exists
      if (!existing) {
        existing = await this.createInitialMasteryV2(studentId, courseId, outcomeDocId);
      }

      const emaByOutcomeId = { ...existing.emaByOutcomeId };
      emaByOutcomeId[outcomeDocId] = Math.max(0, Math.min(1, emaScore)); // Clamp to [0,1]

      return await this.upsertMasteryV2({
        studentId,
        courseId,
        emaByOutcomeId,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      throw this.handleError(error, 'update outcome EMA');
    }
  }

  /**
   * Create initial mastery record with default EMA values
   */
  private async createInitialMasteryV2(studentId: string, courseId: string, firstOutcomeId?: string): Promise<MasteryV2Data> {
    try {
      console.log('[MasteryV2Driver] createInitialMasteryV2 called:', { studentId, courseId, firstOutcomeId });

      const initialEMAByOutcomeId: { [outcomeId: string]: number } = {};

      // If we have a specific outcome to start with, give it a default EMA of 0.3
      if (firstOutcomeId) {
        initialEMAByOutcomeId[firstOutcomeId] = 0.3; // Default starting EMA
        console.log('[MasteryV2Driver] Setting initial EMA for outcome:', firstOutcomeId, '= 0.3');
      }

      const masteryData: MasteryV2Data = {
        studentId,
        courseId,
        emaByOutcomeId: initialEMAByOutcomeId,
        updatedAt: new Date().toISOString()
      };

      console.log('[MasteryV2Driver] Creating initial MasteryV2 with data:', masteryData);

      const result = await this.upsertMasteryV2(masteryData);
      console.log('[MasteryV2Driver] Initial MasteryV2 upsert result:', result);

      console.log('[MasteryV2Driver] createInitialMasteryV2 completed successfully');
      return masteryData;
    } catch (error) {
      console.error('[MasteryV2Driver] createInitialMasteryV2 failed:', {
        studentId,
        courseId,
        firstOutcomeId,
        error: error.message,
        stack: error.stack
      });
      throw this.handleError(error, 'create initial masteryV2');
    }
  }

  /**
   * Batch update multiple outcome EMAs using document IDs
   */
  async batchUpdateEMAs(studentId: string, courseId: string, emaUpdates: { [outcomeDocId: string]: number }): Promise<any> {
    try {
      console.log('[MasteryV2Driver] batchUpdateEMAs called:', { studentId, courseId, emaUpdates });

      let existing = await this.getMasteryV2(studentId, courseId);
      console.log('[MasteryV2Driver] Existing MasteryV2 record:', existing ? 'Found' : 'Not found', existing);

      // Auto-create initial mastery record if none exists
      if (!existing) {
        console.log('[MasteryV2Driver] No existing record, auto-creating initial MasteryV2...');
        const firstOutcomeId = Object.keys(emaUpdates)[0];
        existing = await this.createInitialMasteryV2(studentId, courseId, firstOutcomeId);
        console.log('[MasteryV2Driver] Initial MasteryV2 created:', existing);
      }

      const emaByOutcomeId = { ...existing.emaByOutcomeId };
      console.log('[MasteryV2Driver] Current EMAs before update:', emaByOutcomeId);

      // Apply all updates
      Object.entries(emaUpdates).forEach(([outcomeDocId, score]) => {
        const clampedScore = Math.max(0, Math.min(1, score)); // Clamp to [0,1]
        console.log(`[MasteryV2Driver] Updating outcome ${outcomeDocId}: ${score} -> ${clampedScore}`);
        emaByOutcomeId[outcomeDocId] = clampedScore;
      });

      console.log('[MasteryV2Driver] Merged EMAs to upsert:', emaByOutcomeId);

      const result = await this.upsertMasteryV2({
        studentId,
        courseId,
        emaByOutcomeId,
        updatedAt: new Date().toISOString()
      });

      console.log('[MasteryV2Driver] batchUpdateEMAs completed successfully:', result);
      return result;
    } catch (error) {
      console.error('[MasteryV2Driver] batchUpdateEMAs failed:', {
        studentId,
        courseId,
        emaUpdates,
        error: error.message,
        stack: error.stack
      });
      throw this.handleError(error, 'batch update EMAs');
    }
  }

  /**
   * Get EMA score for specific outcome using document ID
   */
  async getOutcomeEMA(studentId: string, courseId: string, outcomeDocId: string): Promise<number | null> {
    try {
      const masteryRecord = await this.getMasteryV2(studentId, courseId);
      if (!masteryRecord) {
        return null;
      }

      return masteryRecord.emaByOutcomeId[outcomeDocId] || null;
    } catch (error) {
      throw this.handleError(error, 'get outcome EMA');
    }
  }

  /**
   * Get all outcome EMAs for a course as a map of document ID -> EMA score
   */
  async getCourseEMAs(studentId: string, courseId: string): Promise<{ [outcomeDocId: string]: number } | null> {
    try {
      const masteryRecord = await this.getMasteryV2(studentId, courseId);
      if (!masteryRecord) {
        return null;
      }

      return masteryRecord.emaByOutcomeId;
    } catch (error) {
      throw this.handleError(error, 'get course EMAs');
    }
  }

  /**
   * Get mastery statistics using outcome document IDs
   */
  async getMasteryStats(studentId: string, courseId: string) {
    try {
      const masteryRecord = await this.getMasteryV2(studentId, courseId);

      if (!masteryRecord) {
        return {
          totalOutcomes: 0,
          averageLevel: 0,
          masteredOutcomes: 0,
          inProgressOutcomes: 0
        };
      }

      const emaValues = Object.values(masteryRecord.emaByOutcomeId);

      if (emaValues.length === 0) {
        return {
          totalOutcomes: 0,
          averageLevel: 0,
          masteredOutcomes: 0,
          inProgressOutcomes: 0
        };
      }

      const totalLevel = emaValues.reduce((sum, ema) => sum + ema, 0);
      const averageLevel = totalLevel / emaValues.length;
      const masteredOutcomes = emaValues.filter(ema => ema >= 0.8).length;
      const inProgressOutcomes = emaValues.filter(ema => ema >= 0.5 && ema < 0.8).length;

      return {
        totalOutcomes: emaValues.length,
        averageLevel: Math.round(averageLevel * 100) / 100,
        masteredOutcomes,
        inProgressOutcomes
      };
    } catch (error) {
      throw this.handleError(error, 'get mastery stats');
    }
  }
}