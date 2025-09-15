import { Query } from 'appwrite';
import { BaseDriver } from './BaseDriver';
import type { Evidence, EvidenceData } from '../types';

/**
 * Evidence driver handling student response recording and retrieval
 */
export class EvidenceDriver extends BaseDriver {
  /**
   * Record evidence of student response
   */
  async recordEvidence(evidenceData: EvidenceData): Promise<Evidence> {
    try {
      const user = await this.getCurrentUser();
      const permissions = this.createUserPermissions(user.$id);
      
      return await this.create<Evidence>('evidence', evidenceData, permissions);
    } catch (error) {
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
      const user = await this.getCurrentUser();
      const permissions = this.createUserPermissions(user.$id);
      const results: Evidence[] = [];

      // Process in batches to avoid overwhelming the database
      const batchSize = 10;
      for (let i = 0; i < evidenceList.length; i += batchSize) {
        const batch = evidenceList.slice(i, i + batchSize);

        const batchPromises = batch.map(evidenceData =>
          this.create<Evidence>('evidence', evidenceData, permissions)
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      return results;
    } catch (error) {
      throw this.handleError(error, 'batch record evidence');
    }
  }
}