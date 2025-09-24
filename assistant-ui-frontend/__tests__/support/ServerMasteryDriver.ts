import { Query } from 'node-appwrite';
import { ServerBaseDriver } from './ServerBaseDriver';

export interface MasteryV2Data {
  studentId: string;
  courseId: string;
  emaByOutcome: { [outcomeId: string]: number };
  updatedAt: string;
}

/**
 * Server-side Mastery driver for integration tests (V2 only) with SSR authentication
 */
export class ServerMasteryDriver extends ServerBaseDriver {
  constructor(sessionClient?: { client: any; account: any; databases: any }, sessionUserId?: string) {
    super(sessionClient, sessionUserId);
  }
  /**
   * Get consolidated mastery record for student/course using MasteryV2
   */
  async getMasteryV2(studentId: string, courseId: string): Promise<MasteryV2Data | null> {
    try {
      const records = await this.list('MasteryV2', [
        Query.equal('studentId', studentId),
        Query.equal('courseId', courseId),
        Query.limit(1)
      ]);

      if (records.length === 0) {
        return null;
      }

      const record = records[0];
      return {
        studentId: record.studentId,
        courseId: record.courseId,
        emaByOutcome: JSON.parse(record.emaByOutcome || '{}'),
        updatedAt: record.updatedAt
      };
    } catch (error) {
      throw this.handleError(error, 'get masteryV2');
    }
  }

  /**
   * Upsert consolidated mastery record using MasteryV2
   */
  async upsertMasteryV2(masteryData: MasteryV2Data): Promise<any> {
    try {
      // For session client, permissions are handled automatically
      const permissions = this.createUserPermissions();

      // Check if record exists
      const existing = await this.getMasteryV2(masteryData.studentId, masteryData.courseId);

      const docData = {
        studentId: masteryData.studentId,
        courseId: masteryData.courseId,
        emaByOutcome: JSON.stringify(masteryData.emaByOutcome),
        updatedAt: masteryData.updatedAt
      };

      if (existing) {
        // Update existing record - find by querying since we need the document ID
        const existingRecords = await this.list('MasteryV2', [
          Query.equal('studentId', masteryData.studentId),
          Query.equal('courseId', masteryData.courseId),
          Query.limit(1)
        ]);

        if (existingRecords.length > 0) {
          return await this.update('MasteryV2', existingRecords[0].$id, docData);
        }
      }

      // Create new record
      return await this.create('MasteryV2', docData, permissions);
    } catch (error) {
      throw this.handleError(error, 'upsert masteryV2');
    }
  }

  /**
   * Update specific outcome EMA in consolidated record
   * Auto-creates mastery record if it doesn't exist
   */
  async updateOutcomeEMA(studentId: string, courseId: string, outcomeId: string, emaScore: number): Promise<any> {
    try {
      let existing = await this.getMasteryV2(studentId, courseId);

      // Auto-create initial mastery record if none exists
      if (!existing) {
        existing = await this.createInitialMasteryV2(studentId, courseId, outcomeId);
      }

      const emaByOutcome = { ...existing.emaByOutcome };
      emaByOutcome[outcomeId] = Math.max(0, Math.min(1, emaScore)); // Clamp to [0,1]

      return await this.upsertMasteryV2({
        studentId,
        courseId,
        emaByOutcome,
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
      const initialEMAByOutcome: { [outcomeId: string]: number } = {};

      // If we have a specific outcome to start with, give it a default EMA of 0.3
      if (firstOutcomeId) {
        initialEMAByOutcome[firstOutcomeId] = 0.3; // Default starting EMA
      }

      const masteryData: MasteryV2Data = {
        studentId,
        courseId,
        emaByOutcome: initialEMAByOutcome,
        updatedAt: new Date().toISOString()
      };

      await this.upsertMasteryV2(masteryData);
      return masteryData;
    } catch (error) {
      throw this.handleError(error, 'create initial masteryV2');
    }
  }

  /**
   * Batch update multiple outcome EMAs
   * Auto-creates mastery record if it doesn't exist
   */
  async batchUpdateEMAs(studentId: string, courseId: string, emaUpdates: { [outcomeId: string]: number }): Promise<any> {
    try {
      let existing = await this.getMasteryV2(studentId, courseId);

      // Auto-create initial mastery record if none exists
      if (!existing) {
        const firstOutcomeId = Object.keys(emaUpdates)[0];
        existing = await this.createInitialMasteryV2(studentId, courseId, firstOutcomeId);
      }

      const emaByOutcome = { ...existing.emaByOutcome };

      // Apply all updates
      Object.entries(emaUpdates).forEach(([outcomeId, score]) => {
        emaByOutcome[outcomeId] = Math.max(0, Math.min(1, score)); // Clamp to [0,1]
      });

      return await this.upsertMasteryV2({
        studentId,
        courseId,
        emaByOutcome,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      throw this.handleError(error, 'batch update EMAs');
    }
  }

  /**
   * Get EMA score for specific outcome
   */
  async getOutcomeEMA(studentId: string, courseId: string, outcomeId: string): Promise<number | null> {
    try {
      const masteryRecord = await this.getMasteryV2(studentId, courseId);
      if (!masteryRecord) {
        return null;
      }

      return masteryRecord.emaByOutcome[outcomeId] || null;
    } catch (error) {
      throw this.handleError(error, 'get outcome EMA');
    }
  }

  /**
   * Delete mastery record by student and course
   */
  async deleteMasteryV2(studentId: string, courseId: string): Promise<void> {
    try {
      const records = await this.list('MasteryV2', [
        Query.equal('studentId', studentId),
        Query.equal('courseId', courseId)
      ]);

      for (const record of records) {
        await this.delete('MasteryV2', record.$id);
      }
    } catch (error) {
      throw this.handleError(error, 'delete masteryV2');
    }
  }
}