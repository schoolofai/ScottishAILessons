import { Query } from 'appwrite';
import { BaseDriver } from './BaseDriver';
import { StudentDrawingStorageDriver } from './StudentDrawingStorageDriver';
import type { Evidence, EvidenceData } from '../types';

export interface EnhancedEvidenceData {
  sessionId: string;
  itemId: string;
  attemptIndex: number;
  response: string;
  correct: boolean;
  score: number;
  outcomeScores: { [outcomeId: string]: number };
  submittedAt: string;
  feedback?: string;
}

/**
 * Evidence driver handling student response recording and retrieval
 */
export class EvidenceDriver extends BaseDriver {
  /**
   * Record evidence of student response
   */
  async recordEvidence(evidenceData: EvidenceData): Promise<Evidence> {
    try {
      console.log('[EvidenceDriver] Recording evidence:', evidenceData);

      // No need to get user or set permissions since evidence has documentSecurity: false
      return await this.create<Evidence>('evidence', evidenceData);
    } catch (error) {
      console.error('[EvidenceDriver] Record evidence failed:', error);
      throw this.handleError(error, 'record evidence');
    }
  }

  /**
   * Get evidence by ID
   */
  async getEvidence(evidenceId: string): Promise<Evidence> {
    try {
      return await this.get<Evidence>('evidence', evidenceId);
    } catch (error) {
      throw this.handleError(error, 'get evidence');
    }
  }

  /**
   * Get all evidence for a session
   */
  async getSessionEvidence(sessionId: string): Promise<Evidence[]> {
    try {
      return await this.list<Evidence>('evidence', [
        Query.equal('sessionId', sessionId),
        Query.orderAsc('$createdAt')
      ]);
    } catch (error) {
      throw this.handleError(error, 'get session evidence');
    }
  }

  /**
   * Get evidence for a specific item in a session
   */
  async getItemEvidence(sessionId: string, itemId: string): Promise<Evidence[]> {
    try {
      return await this.list<Evidence>('evidence', [
        Query.equal('sessionId', sessionId),
        Query.equal('itemId', itemId),
        Query.orderAsc('$createdAt')
      ]);
    } catch (error) {
      throw this.handleError(error, 'get item evidence');
    }
  }

  /**
   * Get latest evidence for an item
   */
  async getLatestItemEvidence(sessionId: string, itemId: string): Promise<Evidence | null> {
    try {
      const evidence = await this.list<Evidence>('evidence', [
        Query.equal('sessionId', sessionId),
        Query.equal('itemId', itemId),
        Query.orderDesc('$createdAt'),
        Query.limit(1)
      ]);
      
      return evidence.length > 0 ? evidence[0] : null;
    } catch (error) {
      throw this.handleError(error, 'get latest item evidence');
    }
  }

  /**
   * Count evidence for a session
   */
  async getEvidenceCount(sessionId: string): Promise<number> {
    try {
      const response = await this.listWithTotal<Evidence>('evidence', [
        Query.equal('sessionId', sessionId)
      ]);
      
      return response.total;
    } catch (error) {
      throw this.handleError(error, 'get evidence count');
    }
  }

  /**
   * Count correct responses for a session
   */
  async getCorrectResponsesCount(sessionId: string): Promise<number> {
    try {
      const response = await this.listWithTotal<Evidence>('evidence', [
        Query.equal('sessionId', sessionId),
        Query.equal('correct', true)
      ]);
      
      return response.total;
    } catch (error) {
      throw this.handleError(error, 'get correct responses count');
    }
  }

  /**
   * Get session accuracy percentage
   */
  async getSessionAccuracy(sessionId: string): Promise<number> {
    try {
      const totalCount = await this.getEvidenceCount(sessionId);
      if (totalCount === 0) return 0;
      
      const correctCount = await this.getCorrectResponsesCount(sessionId);
      return Math.round((correctCount / totalCount) * 100);
    } catch (error) {
      throw this.handleError(error, 'get session accuracy');
    }
  }

  /**
   * Update evidence correctness (for manual marking)
   */
  async updateEvidenceCorrectness(evidenceId: string, correct: boolean): Promise<Evidence> {
    try {
      return await this.update<Evidence>('evidence', evidenceId, { correct });
    } catch (error) {
      throw this.handleError(error, 'update evidence correctness');
    }
  }

  /**
   * Get evidence statistics for a student across all sessions
   */
  async getStudentEvidenceStats(studentId: string) {
    try {
      // Get all sessions for the student
      const sessions = await this.list('sessions', [
        Query.equal('studentId', studentId)
      ]);
      
      if (sessions.length === 0) {
        return {
          totalSessions: 0,
          totalEvidence: 0,
          totalCorrect: 0,
          overallAccuracy: 0
        };
      }
      
      // Get evidence for all sessions
      const sessionIds = sessions.map(s => s.$id);
      let totalEvidence = 0;
      let totalCorrect = 0;
      
      for (const sessionId of sessionIds) {
        const evidenceCount = await this.getEvidenceCount(sessionId);
        const correctCount = await this.getCorrectResponsesCount(sessionId);
        
        totalEvidence += evidenceCount;
        totalCorrect += correctCount;
      }
      
      const overallAccuracy = totalEvidence > 0 ? Math.round((totalCorrect / totalEvidence) * 100) : 0;
      
      return {
        totalSessions: sessions.length,
        totalEvidence,
        totalCorrect,
        overallAccuracy
      };
    } catch (error) {
      throw this.handleError(error, 'get student evidence stats');
    }
  }

  /**
   * Delete evidence by ID
   */
  async deleteEvidence(evidenceId: string): Promise<void> {
    try {
      await this.delete('evidence', evidenceId);
    } catch (error) {
      throw this.handleError(error, 'delete evidence');
    }
  }

  /**
   * Delete all evidence for a session
   */
  async deleteSessionEvidence(sessionId: string): Promise<void> {
    try {
      const evidence = await this.getSessionEvidence(sessionId);
      
      // Delete all evidence records
      for (const record of evidence) {
        await this.deleteEvidence(record.$id);
      }
    } catch (error) {
      throw this.handleError(error, 'delete session evidence');
    }
  }

  /**
   * Get recent evidence across all sessions (for analytics)
   */
  async getRecentEvidence(limit: number = 10): Promise<Evidence[]> {
    try {
      return await this.list<Evidence>('evidence', [
        Query.orderDesc('$createdAt'),
        Query.limit(limit)
      ]);
    } catch (error) {
      throw this.handleError(error, 'get recent evidence');
    }
  }

  /**
   * Batch record multiple evidence entries for better performance
   */
  async batchRecordEvidence(evidenceList: EvidenceData[]): Promise<Evidence[]> {
    try {
      console.log('[EvidenceDriver] Starting batch evidence recording for', evidenceList.length, 'records');
      console.log('[EvidenceDriver] Sample evidence data:', evidenceList[0]);

      // No need to get user or set permissions since evidence has documentSecurity: false
      const results: Evidence[] = [];

      // Process in batches to avoid overwhelming the database
      const batchSize = 10;
      for (let i = 0; i < evidenceList.length; i += batchSize) {
        const batch = evidenceList.slice(i, i + batchSize);
        console.log(`[EvidenceDriver] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(evidenceList.length/batchSize)}:`, batch.length, 'records');

        const batchPromises = batch.map(async (evidenceData, index) => {
          try {
            console.log(`[EvidenceDriver] Creating evidence record ${index + 1}:`, evidenceData);
            const result = await this.create<Evidence>('evidence', evidenceData);
            console.log(`[EvidenceDriver] Successfully created evidence record ${index + 1} with ID:`, result.$id);
            return result;
          } catch (error) {
            console.error(`[EvidenceDriver] Failed to create evidence record ${index + 1}:`, evidenceData, error);
            throw error; // Don't silently fail individual records
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        console.log(`[EvidenceDriver] Batch ${Math.floor(i/batchSize) + 1} completed successfully`);
      }

      console.log('[EvidenceDriver] All evidence records created successfully. Total:', results.length);
      return results;
    } catch (error) {
      console.error('[EvidenceDriver] Batch record evidence failed:', error);
      throw this.handleError(error, 'batch record evidence');
    }
  }

  // === Enhanced Evidence Methods (New Fields) ===

  /**
   * Record enhanced evidence with new fields (attemptIndex, score, outcomeScores, submittedAt)
   */
  async recordEnhancedEvidence(evidenceData: EnhancedEvidenceData): Promise<any> {
    try {
      console.log('[EvidenceDriver] Recording enhanced evidence:', evidenceData);

      // No need to get user or set permissions since evidence has documentSecurity: false
      const docData = {
        sessionId: evidenceData.sessionId,
        itemId: evidenceData.itemId,
        attemptIndex: evidenceData.attemptIndex,
        response: evidenceData.response,
        correct: evidenceData.correct,
        score: evidenceData.score,
        outcomeScores: JSON.stringify(evidenceData.outcomeScores),
        submittedAt: evidenceData.submittedAt,
        feedback: evidenceData.feedback
      };

      return await this.create('evidence', docData);
    } catch (error) {
      console.error('[EvidenceDriver] Record enhanced evidence failed:', error);
      throw this.handleError(error, 'record enhanced evidence');
    }
  }

  /**
   * Get evidence with enhanced fields
   */
  async getEnhancedEvidence(evidenceId: string): Promise<EnhancedEvidenceData | null> {
    try {
      const evidence = await this.get('Evidence', evidenceId);

      return {
        sessionId: evidence.sessionId,
        itemId: evidence.itemId,
        attemptIndex: evidence.attemptIndex || 0,
        response: evidence.response,
        correct: evidence.correct,
        score: evidence.score || (evidence.correct ? 1 : 0),
        outcomeScores: JSON.parse(evidence.outcomeScores || '{}'),
        submittedAt: evidence.submittedAt || evidence.timestamp || evidence.$createdAt,
        feedback: evidence.feedback
      };
    } catch (error) {
      throw this.handleError(error, 'get enhanced evidence');
    }
  }

  /**
   * Get evidence for session with enhanced data
   */
  async getSessionEnhancedEvidence(sessionId: string): Promise<EnhancedEvidenceData[]> {
    try {
      const evidenceList = await this.list('Evidence', [
        Query.equal('sessionId', sessionId),
        Query.orderAsc('attemptIndex'),
        Query.orderAsc('submittedAt')
      ]);

      return evidenceList.map(evidence => ({
        sessionId: evidence.sessionId,
        itemId: evidence.itemId,
        attemptIndex: evidence.attemptIndex || 0,
        response: evidence.response,
        correct: evidence.correct,
        score: evidence.score || (evidence.correct ? 1 : 0),
        outcomeScores: JSON.parse(evidence.outcomeScores || '{}'),
        submittedAt: evidence.submittedAt || evidence.timestamp || evidence.$createdAt,
        feedback: evidence.feedback
      }));
    } catch (error) {
      throw this.handleError(error, 'get session enhanced evidence');
    }
  }

  /**
   * Get outcome scores aggregated across all evidence for a session
   */
  async getSessionOutcomeScores(sessionId: string): Promise<{ [outcomeId: string]: number[] }> {
    try {
      const evidenceList = await this.getSessionEnhancedEvidence(sessionId);
      const outcomeScores: { [outcomeId: string]: number[] } = {};

      evidenceList.forEach(evidence => {
        Object.entries(evidence.outcomeScores).forEach(([outcomeId, score]) => {
          if (!outcomeScores[outcomeId]) {
            outcomeScores[outcomeId] = [];
          }
          outcomeScores[outcomeId].push(score);
        });
      });

      return outcomeScores;
    } catch (error) {
      throw this.handleError(error, 'get session outcome scores');
    }
  }

  /**
   * Calculate average outcome scores for EMA updates
   */
  async calculateOutcomeAverages(sessionId: string): Promise<{ [outcomeId: string]: number }> {
    try {
      const outcomeScores = await this.getSessionOutcomeScores(sessionId);
      const averages: { [outcomeId: string]: number } = {};

      Object.entries(outcomeScores).forEach(([outcomeId, scores]) => {
        if (scores.length > 0) {
          const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
          averages[outcomeId] = Math.max(0, Math.min(1, average)); // Clamp to [0,1]
        }
      });

      return averages;
    } catch (error) {
      throw this.handleError(error, 'calculate outcome averages');
    }
  }

  /**
   * Get item attempt history (all attempts for specific item)
   */
  async getItemAttemptHistory(sessionId: string, itemId: string): Promise<EnhancedEvidenceData[]> {
    try {
      const evidenceList = await this.list('Evidence', [
        Query.equal('sessionId', sessionId),
        Query.equal('itemId', itemId),
        Query.orderAsc('attemptIndex')
      ]);

      return evidenceList.map(evidence => ({
        sessionId: evidence.sessionId,
        itemId: evidence.itemId,
        attemptIndex: evidence.attemptIndex || 0,
        response: evidence.response,
        correct: evidence.correct,
        score: evidence.score || (evidence.correct ? 1 : 0),
        outcomeScores: JSON.parse(evidence.outcomeScores || '{}'),
        submittedAt: evidence.submittedAt || evidence.timestamp || evidence.$createdAt,
        feedback: evidence.feedback
      }));
    } catch (error) {
      throw this.handleError(error, 'get item attempt history');
    }
  }

  /**
   * Update outcome scores for existing evidence
   */
  async updateOutcomeScores(evidenceId: string, outcomeScores: { [outcomeId: string]: number }): Promise<any> {
    try {
      return await this.update('Evidence', evidenceId, {
        outcomeScores: JSON.stringify(outcomeScores)
      });
    } catch (error) {
      throw this.handleError(error, 'update outcome scores');
    }
  }

  /**
   * Add feedback to evidence record
   */
  async addFeedback(evidenceId: string, feedback: string): Promise<any> {
    try {
      return await this.update('Evidence', evidenceId, { feedback });
    } catch (error) {
      throw this.handleError(error, 'add feedback');
    }
  }

  // === Phase 10: Drawing Storage Helpers ===

  /**
   * Get drawing URLs from evidence record (handles both storage and legacy formats)
   *
   * Phase 10: Backward-compatible drawing retrieval
   * - NEW: Converts file IDs to storage preview URLs
   * - LEGACY: Converts base64 strings to data URLs
   *
   * @param evidence - Evidence record that may contain drawings
   * @returns Array of URLs for displaying drawings in <img> tags
   */
  getDrawingUrls(evidence: Evidence): string[] {
    // NEW FORMAT: Storage file IDs
    if (evidence.student_drawing_file_ids && evidence.student_drawing_file_ids.length > 0) {
      const storageDriver = new StudentDrawingStorageDriver(this.client);
      return storageDriver.getDrawingPreviewUrls(evidence.student_drawing_file_ids);
    }

    // LEGACY FORMAT: Base64 strings
    if (evidence.student_drawing) {
      try {
        // Try parsing as JSON array (multiple images)
        const parsed = JSON.parse(evidence.student_drawing);
        if (Array.isArray(parsed)) {
          return parsed.map(base64 => this.base64ToDataUrl(base64));
        }
      } catch {
        // Not JSON, treat as single base64 string
      }

      // Single base64 string
      return [this.base64ToDataUrl(evidence.student_drawing)];
    }

    // No drawings
    return [];
  }

  /**
   * Convert base64 string to data URL for <img> src
   * Handles both raw base64 and data URI formats
   */
  private base64ToDataUrl(base64: string): string {
    // Already a data URL
    if (base64.startsWith('data:')) {
      return base64;
    }

    // Raw base64, add prefix
    return `data:image/png;base64,${base64}`;
  }

  /**
   * Check if evidence has drawings (either format)
   */
  hasDrawings(evidence: Evidence): boolean {
    return !!(evidence.student_drawing_file_ids?.length || evidence.student_drawing);
  }
}