import { Query } from 'appwrite';
import { BaseDriver } from './BaseDriver';
import type { Mastery } from '../types';

export interface MasteryData {
  studentId: string;
  courseId: string;
  outcomeRef: string;
  level: number;
  confidence: number;
}

export interface MasteryUpdate {
  outcome_id: string;
  score: number;
  timestamp: string;
}

/**
 * Mastery driver for student learning outcome mastery tracking
 */
export class MasteryDriver extends BaseDriver {
  /**
   * Create or update mastery record
   */
  async upsertMastery(masteryData: MasteryData): Promise<Mastery> {
    try {
      const user = await this.getCurrentUser();
      const permissions = this.createUserPermissions(user.$id);

      // Check if mastery record already exists
      const existing = await this.getMasteryByOutcome(
        masteryData.studentId,
        masteryData.outcomeRef
      );

      if (existing) {
        // Update existing record
        return await this.update<Mastery>('mastery', existing.$id, {
          level: masteryData.level,
          confidence: masteryData.confidence,
          lastUpdated: new Date().toISOString()
        });
      } else {
        // Create new record
        return await this.create<Mastery>('mastery', {
          ...masteryData,
          lastUpdated: new Date().toISOString()
        }, permissions);
      }
    } catch (error) {
      throw this.handleError(error, 'upsert mastery');
    }
  }

  /**
   * Get mastery record by student and outcome
   */
  async getMasteryByOutcome(studentId: string, outcomeRef: string): Promise<Mastery | null> {
    try {
      const records = await this.list<Mastery>('mastery', [
        Query.equal('studentId', studentId),
        Query.equal('outcomeRef', outcomeRef),
        Query.limit(1)
      ]);

      return records.length > 0 ? records[0] : null;
    } catch (error) {
      throw this.handleError(error, 'get mastery by outcome');
    }
  }

  /**
   * Get all mastery records for a student
   */
  async getStudentMasteries(studentId: string): Promise<Mastery[]> {
    try {
      return await this.list<Mastery>('mastery', [
        Query.equal('studentId', studentId),
        Query.orderDesc('lastUpdated')
      ]);
    } catch (error) {
      throw this.handleError(error, 'get student masteries');
    }
  }

  /**
   * Get mastery records for a specific course
   */
  async getCourseMasteries(studentId: string, coursePrefix: string): Promise<Mastery[]> {
    try {
      return await this.list<Mastery>('mastery', [
        Query.equal('studentId', studentId),
        Query.startsWith('outcomeRef', coursePrefix),
        Query.orderDesc('lastUpdated')
      ]);
    } catch (error) {
      throw this.handleError(error, 'get course masteries');
    }
  }

  /**
   * Batch update mastery records from backend mastery_updates
   */
  async batchUpdateMasteries(studentId: string, courseId: string, masteryUpdates: MasteryUpdate[]): Promise<Mastery[]> {
    try {
      const results: Mastery[] = [];

      // Process updates in batches for better performance
      const batchSize = 10;
      for (let i = 0; i < masteryUpdates.length; i += batchSize) {
        const batch = masteryUpdates.slice(i, i + batchSize);

        const batchPromises = batch.map(update =>
          this.upsertMastery({
            studentId,
            courseId,
            outcomeRef: update.outcome_id,
            level: update.score, // Use backend-calculated score as level
            confidence: update.score // Use score as confidence for now
          })
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      return results;
    } catch (error) {
      throw this.handleError(error, 'batch update masteries');
    }
  }

  /**
   * Get mastery statistics for a student
   */
  async getMasteryStats(studentId: string) {
    try {
      const masteries = await this.getStudentMasteries(studentId);

      if (masteries.length === 0) {
        return {
          totalOutcomes: 0,
          averageLevel: 0,
          masteredOutcomes: 0,
          inProgressOutcomes: 0
        };
      }

      const totalLevel = masteries.reduce((sum, m) => sum + m.level, 0);
      const averageLevel = totalLevel / masteries.length;
      const masteredOutcomes = masteries.filter(m => m.level >= 0.8).length;
      const inProgressOutcomes = masteries.filter(m => m.level >= 0.5 && m.level < 0.8).length;

      return {
        totalOutcomes: masteries.length,
        averageLevel: Math.round(averageLevel * 100) / 100,
        masteredOutcomes,
        inProgressOutcomes
      };
    } catch (error) {
      throw this.handleError(error, 'get mastery stats');
    }
  }

  /**
   * Delete mastery record by ID
   */
  async deleteMastery(masteryId: string): Promise<void> {
    try {
      await this.delete('mastery', masteryId);
    } catch (error) {
      throw this.handleError(error, 'delete mastery');
    }
  }

  /**
   * Delete all mastery records for a student
   */
  async deleteStudentMasteries(studentId: string): Promise<void> {
    try {
      const masteries = await this.getStudentMasteries(studentId);

      // Delete in batches
      const batchSize = 10;
      for (let i = 0; i < masteries.length; i += batchSize) {
        const batch = masteries.slice(i, i + batchSize);
        const deletePromises = batch.map(m => this.deleteMastery(m.$id));
        await Promise.all(deletePromises);
      }
    } catch (error) {
      throw this.handleError(error, 'delete student masteries');
    }
  }
}