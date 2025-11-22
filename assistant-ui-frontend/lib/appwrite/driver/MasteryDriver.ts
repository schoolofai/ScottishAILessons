import { Query } from 'appwrite';
import { BaseDriver } from './BaseDriver';
import type { Mastery } from '../types';
import { batchCalculateEMAs } from '@/lib/utils/ema-calculator';
import { EMA_CONFIG } from '@/lib/config/ema-config';

export interface MasteryData {
  studentId: string;
  courseId: string;
  outcomeRef: string;
  level: number;
  confidence: number;
}

export interface MasteryV2Data {
  studentId: string;
  courseId: string;
  emaByOutcome: { [outcomeId: string]: number };
  updatedAt: string;
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
   * @deprecated Use MasteryV2 methods instead (upsertMasteryV2, batchUpdateEMAs). Will be removed in next version.
   */
  async upsertMastery(masteryData: MasteryData): Promise<Mastery> {
    console.warn('[MasteryDriver] upsertMastery is deprecated. Use upsertMasteryV2 or updateOutcomeEMA instead.');
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
   * @deprecated Use getOutcomeEMA from MasteryV2 instead. Will be removed in next version.
   */
  async getMasteryByOutcome(studentId: string, outcomeRef: string): Promise<Mastery | null> {
    console.warn('[MasteryDriver] getMasteryByOutcome is deprecated. Use getOutcomeEMA instead.');
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
   * @deprecated Use getMasteryV2 from MasteryV2 instead. Will be removed in next version.
   */
  async getStudentMasteries(studentId: string): Promise<Mastery[]> {
    console.warn('[MasteryDriver] getStudentMasteries is deprecated. Use getMasteryV2 instead.');
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
   * @deprecated Use batchUpdateEMAs from MasteryV2 instead. Will be removed in next version.
   */
  async batchUpdateMasteries(studentId: string, courseId: string, masteryUpdates: MasteryUpdate[]): Promise<Mastery[]> {
    console.warn('[MasteryDriver] batchUpdateMasteries is deprecated. Use batchUpdateEMAs instead.');
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

  // === MasteryV2 Methods (Consolidated JSON Structure) ===

  /**
   * Get consolidated mastery record for student/course using MasteryV2
   */
  async getMasteryV2(studentId: string, courseId: string): Promise<MasteryV2Data | null> {
    try {
      console.log('[MasteryDriver] getMasteryV2 called:', { studentId, courseId });

      const records = await this.list('MasteryV2', [
        Query.equal('studentId', studentId),
        Query.equal('courseId', courseId),
        Query.limit(1)
      ]);

      console.log('[MasteryDriver] getMasteryV2 query results:', { recordCount: records.length });

      if (records.length === 0) {
        console.log('[MasteryDriver] No MasteryV2 record found');
        return null;
      }

      const record = records[0];
      console.log('[MasteryDriver] Raw MasteryV2 record:', record);

      const parsedEmaByOutcome = JSON.parse(record.emaByOutcome || '{}');
      console.log('[MasteryDriver] Parsed emaByOutcome:', parsedEmaByOutcome);

      const result = {
        studentId: record.studentId,
        courseId: record.courseId,
        emaByOutcome: parsedEmaByOutcome,
        updatedAt: record.updatedAt
      };

      console.log('[MasteryDriver] getMasteryV2 returning:', result);
      return result;
    } catch (error) {
      console.error('[MasteryDriver] getMasteryV2 failed:', {
        studentId,
        courseId,
        error: error.message,
        stack: error.stack
      });
      throw this.handleError(error, 'get masteryV2');
    }
  }

  /**
   * Upsert consolidated mastery record using MasteryV2
   */
  async upsertMasteryV2(masteryData: MasteryV2Data): Promise<any> {
    try {
      console.log('[MasteryDriver] Upserting MasteryV2 record:', masteryData);

      // No need to get user or set permissions since MasteryV2 has documentSecurity: false

      // Check if record exists
      const existing = await this.getMasteryV2(masteryData.studentId, masteryData.courseId);

      const docData = {
        studentId: masteryData.studentId,
        courseId: masteryData.courseId,
        emaByOutcome: JSON.stringify(masteryData.emaByOutcome),
        updatedAt: masteryData.updatedAt
      };

      console.log('[MasteryDriver] Document data to upsert:', docData);

      if (existing) {
        // Update existing record - find by querying since we need the document ID
        const existingRecords = await this.list('MasteryV2', [
          Query.equal('studentId', masteryData.studentId),
          Query.equal('courseId', masteryData.courseId),
          Query.limit(1)
        ]);

        if (existingRecords.length > 0) {
          console.log('[MasteryDriver] Updating existing MasteryV2 record with ID:', existingRecords[0].$id);
          return await this.update('MasteryV2', existingRecords[0].$id, docData);
        }
      }

      // Create new record
      console.log('[MasteryDriver] Creating new MasteryV2 record');
      return await this.create('MasteryV2', docData);
    } catch (error) {
      console.error('[MasteryDriver] Upsert MasteryV2 failed:', error);
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
      console.log('[MasteryDriver] createInitialMasteryV2 called:', { studentId, courseId, firstOutcomeId });

      const initialEMAByOutcome: { [outcomeId: string]: number } = {};

      // If we have a specific outcome to start with, give it a default EMA of 0.3
      if (firstOutcomeId) {
        initialEMAByOutcome[firstOutcomeId] = 0.3; // Default starting EMA
        console.log('[MasteryDriver] Setting initial EMA for outcome:', firstOutcomeId, '= 0.3');
      }

      const masteryData: MasteryV2Data = {
        studentId,
        courseId,
        emaByOutcome: initialEMAByOutcome,
        updatedAt: new Date().toISOString()
      };

      console.log('[MasteryDriver] Creating initial MasteryV2 with data:', masteryData);

      const result = await this.upsertMasteryV2(masteryData);
      console.log('[MasteryDriver] Initial MasteryV2 upsert result:', result);

      console.log('[MasteryDriver] createInitialMasteryV2 completed successfully');
      return masteryData;
    } catch (error) {
      console.error('[MasteryDriver] createInitialMasteryV2 failed:', {
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
   * Batch update multiple outcome EMAs using true Exponential Moving Average
   * Auto-creates mastery record if it doesn't exist
   * 
   * EMA Formula: new_ema = α * new_score + (1 - α) * old_ema
   * Where α (alpha) = smoothing factor (default: 0.3)
   * 
   * @param studentId - Student identifier
   * @param courseId - Course identifier
   * @param newScores - New observation scores by outcome ID (raw scores from lesson)
   * @param config - Optional EMA configuration override
   * @returns Updated MasteryV2 record
   */
  async batchUpdateEMAs(
    studentId: string, 
    courseId: string, 
    newScores: { [outcomeId: string]: number },
    config?: { alpha?: number }
  ): Promise<any> {
    try {
      // Check if EMA is enabled (feature flag for rollback)
      if (!EMA_CONFIG.enabled) {
        console.warn('[MasteryDriver] EMA feature is disabled, using direct replacement');
        return this.batchUpdateEMAsLegacy(studentId, courseId, newScores);
      }

      console.log('[MasteryDriver] batchUpdateEMAs called (EMA mode):', { 
        studentId, 
        courseId, 
        newScores,
        alpha: config?.alpha ?? EMA_CONFIG.alpha,
        enabled: EMA_CONFIG.enabled
      });

      // 1. Fetch existing mastery record
      let existing = await this.getMasteryV2(studentId, courseId);
      
      if (!existing) {
        console.log('[MasteryDriver] No existing record, auto-creating initial MasteryV2...');
        const firstOutcomeId = Object.keys(newScores)[0];
        existing = await this.createInitialMasteryV2(studentId, courseId, firstOutcomeId);
        console.log('[MasteryDriver] Initial MasteryV2 created:', existing);
      }

      console.log('[MasteryDriver] Current EMAs before update:', existing.emaByOutcome);

      // 2. Calculate new EMAs using true exponential averaging
      const emaConfig = {
        alpha: config?.alpha ?? EMA_CONFIG.alpha,
        bootstrapAlpha: EMA_CONFIG.bootstrapAlpha,
        bootstrapThreshold: EMA_CONFIG.bootstrapThreshold
      };

      const { updatedEMAs, metadata } = batchCalculateEMAs(
        existing.emaByOutcome,     // Old EMAs
        newScores,                 // New observations
        {},                        // Observation counts (TODO: track in Phase 6)
        emaConfig
      );

      // 3. Log EMA calculations for debugging
      console.log('[MasteryDriver] EMA calculations:');
      Object.entries(metadata).forEach(([outcomeId, result]) => {
        const oldEMA = existing!.emaByOutcome[outcomeId] ?? 0.0;
        const changeSign = result.change >= 0 ? '+' : '';
        const bootstrapFlag = result.wasBootstrapped ? ' [BOOTSTRAP]' : '';
        console.log(
          `  ${outcomeId}: ${oldEMA.toFixed(3)} → ${result.newEMA.toFixed(3)} ` +
          `(Δ${changeSign}${result.change.toFixed(3)}, α=${result.effectiveAlpha}${bootstrapFlag})`
        );
      });

      // 4. Preserve outcomes not updated in this lesson
      const finalEMAs = { ...existing.emaByOutcome, ...updatedEMAs };
      console.log('[MasteryDriver] Final EMAs to persist:', finalEMAs);

      // 5. Upsert to database
      const result = await this.upsertMasteryV2({
        studentId,
        courseId,
        emaByOutcome: finalEMAs,
        updatedAt: new Date().toISOString()
      });

      console.log('[MasteryDriver] batchUpdateEMAs completed successfully (EMA mode)');
      
      // Log analytics for monitoring
      console.log('[EMA Analytics]', {
        studentId,
        courseId,
        timestamp: new Date().toISOString(),
        alpha: emaConfig.alpha,
        outcomesUpdated: Object.keys(newScores).length,
        outcomes: Object.entries(metadata).map(([outcomeId, result]) => ({
          outcomeId,
          oldEMA: existing!.emaByOutcome[outcomeId] ?? 0.0,
          newObservation: newScores[outcomeId],
          newEMA: result.newEMA,
          change: result.change,
          effectiveAlpha: result.effectiveAlpha,
          wasBootstrapped: result.wasBootstrapped
        }))
      });

      return result;

    } catch (error) {
      console.error('[MasteryDriver] batchUpdateEMAs failed:', {
        studentId,
        courseId,
        newScores,
        error: error.message,
        stack: error.stack
      });
      throw this.handleError(error, 'batch update EMAs');
    }
  }

  /**
   * Legacy batch update method (direct replacement, no EMA)
   * Used as fallback when EMA is disabled
   * 
   * @deprecated This will be removed once EMA is fully validated
   * @private
   */
  private async batchUpdateEMAsLegacy(
    studentId: string, 
    courseId: string, 
    emaUpdates: { [outcomeId: string]: number }
  ): Promise<any> {
    console.log('[MasteryDriver] Using legacy direct replacement (EMA disabled)');

    let existing = await this.getMasteryV2(studentId, courseId);

    if (!existing) {
      const firstOutcomeId = Object.keys(emaUpdates)[0];
      existing = await this.createInitialMasteryV2(studentId, courseId, firstOutcomeId);
    }

    const emaByOutcome = { ...existing.emaByOutcome };

    // Direct replacement (old behavior)
    Object.entries(emaUpdates).forEach(([outcomeId, score]) => {
      const clampedScore = Math.max(0, Math.min(1, score));
      emaByOutcome[outcomeId] = clampedScore;
    });

    return await this.upsertMasteryV2({
      studentId,
      courseId,
      emaByOutcome,
      updatedAt: new Date().toISOString()
    });
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
}