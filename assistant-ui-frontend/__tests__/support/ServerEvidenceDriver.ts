import { Query } from 'node-appwrite';
import { ServerBaseDriver } from './ServerBaseDriver';
import type { Evidence, EvidenceData } from '@/lib/appwrite/types';

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
 * Server-side Evidence driver for integration tests with SSR authentication
 */
export class ServerEvidenceDriver extends ServerBaseDriver {
  constructor(sessionClient?: { client: any; account: any; databases: any }, sessionUserId?: string) {
    super(sessionClient, sessionUserId);
  }
  /**
   * Record evidence of student response
   */
  async recordEvidence(evidenceData: EvidenceData): Promise<Evidence> {
    try {
      // For session client, permissions are handled automatically
      const permissions = this.createUserPermissions();

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
   * Batch record multiple evidence entries for better performance
   */
  async batchRecordEvidence(evidenceList: EvidenceData[]): Promise<Evidence[]> {
    try {
      console.log('[ServerEvidenceDriver] Starting batch evidence recording for', evidenceList.length, 'records');
      console.log('[ServerEvidenceDriver] Sample evidence data:', evidenceList[0]);

      // For session client, permissions are handled automatically
      const permissions = this.createUserPermissions();
      const results: Evidence[] = [];

      // Process in batches to avoid overwhelming the database
      const batchSize = 10;
      for (let i = 0; i < evidenceList.length; i += batchSize) {
        const batch = evidenceList.slice(i, i + batchSize);
        console.log(`[ServerEvidenceDriver] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(evidenceList.length/batchSize)}:`, batch.length, 'records');

        const batchPromises = batch.map(async (evidenceData, index) => {
          try {
            console.log(`[ServerEvidenceDriver] Creating evidence record ${index + 1}:`, evidenceData);
            const result = await this.create<Evidence>('evidence', evidenceData, permissions);
            console.log(`[ServerEvidenceDriver] Successfully created evidence record ${index + 1} with ID:`, result.$id);
            return result;
          } catch (error) {
            console.error(`[ServerEvidenceDriver] Failed to create evidence record ${index + 1}:`, evidenceData, error);
            throw error;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        console.log(`[ServerEvidenceDriver] Batch ${Math.floor(i/batchSize) + 1} completed successfully`);
      }

      console.log('[ServerEvidenceDriver] All evidence records created successfully. Total:', results.length);
      return results;
    } catch (error) {
      console.error('[ServerEvidenceDriver] Batch record evidence failed:', error);
      throw this.handleError(error, 'batch record evidence');
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
}