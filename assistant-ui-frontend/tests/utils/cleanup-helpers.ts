/**
 * Test Cleanup Helper Utilities
 *
 * Based on existing cleanup patterns from:
 * - __tests__/integration/EvidenceDriver.test.ts
 * - __tests__/integration/MasteryDriver.test.ts
 * - tests/integration/session-completion.test.ts
 *
 * These utilities provide:
 * - ID tracking for test resources
 * - Dependency-ordered cleanup
 * - Error collection (fail gracefully)
 * - Cleanup verification
 * - Timeout protection for large data
 */

import { databases } from '@/lib/appwrite';

/**
 * Configuration for test database collections
 * Import from your test config or define here
 */
export const TEST_CONFIG = {
  databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || 'default',
  sessionCollectionId: 'sessions',
  evidenceCollectionId: 'evidence',
  masteryCollectionId: 'MasteryV2',
  outcomesCollectionId: 'Outcomes',
  conversationHistoryCollectionId: 'conversation_history'
};

/**
 * Result of cleanup operation
 */
export interface CleanupResult {
  totalResources: number;
  cleaned: number;
  errors: Array<{ resource: string; error: Error }>;
  durationMs: number;
}

/**
 * Test resource tracker for comprehensive cleanup
 *
 * Usage:
 * ```typescript
 * const tracker = new TestResourceTracker();
 *
 * const session = await createSession({...});
 * tracker.track('session', session.$id);
 *
 * await tracker.cleanup(); // In afterAll hook
 * ```
 */
export class TestResourceTracker {
  private resources: Map<string, string[]>;
  private cleanupErrors: Array<{ resource: string; error: Error }>;

  constructor() {
    this.resources = new Map([
      ['sessions', []],
      ['evidence', []],
      ['mastery', []],
      ['outcomes', []],
      ['histories', []]
    ]);
    this.cleanupErrors = [];
  }

  /**
   * Track a resource for cleanup
   *
   * @param type - Type of resource
   * @param id - Resource ID (or composite key for mastery)
   */
  track(type: 'session' | 'evidence' | 'mastery' | 'outcome' | 'history', id: string): void {
    const key = `${type === 'history' ? 'histories' : type}s`; // Pluralize
    const existing = this.resources.get(key) || [];
    existing.push(id);
    this.resources.set(key, existing);
    console.log(`📝 Tracked ${type}: ${id}`);
  }

  /**
   * Get all tracked resources of a type
   */
  getTracked(type: string): string[] {
    return this.resources.get(type) || [];
  }

  /**
   * Clean up all tracked resources in dependency order
   *
   * Cleanup order: Evidence → Mastery → Sessions → Outcomes → Histories
   * (Children before parents to respect foreign key constraints)
   */
  async cleanup(): Promise<CleanupResult> {
    console.log('🧹 Starting comprehensive cleanup...');
    const startTime = Date.now();

    // Clean in dependency order (children first)
    await this.cleanupEvidence();
    await this.cleanupMastery();
    await this.cleanupSessions();
    await this.cleanupOutcomes();
    await this.cleanupHistories();

    const duration = Date.now() - startTime;
    const result: CleanupResult = {
      totalResources: this.getTotalResourceCount(),
      cleaned: this.getTotalResourceCount() - this.cleanupErrors.length,
      errors: this.cleanupErrors,
      durationMs: duration
    };

    // Report summary
    if (this.cleanupErrors.length === 0) {
      console.log(`✅ Cleanup successful: ${result.cleaned} resources in ${duration}ms`);
    } else {
      console.warn(`⚠️  Cleanup partial: ${result.cleaned}/${result.totalResources} succeeded`);
      this.cleanupErrors.forEach(({ resource, error }) => {
        console.error(`  ❌ ${resource}: ${error.message}`);
      });
    }

    return result;
  }

  /**
   * Clean up evidence records
   */
  private async cleanupEvidence(): Promise<void> {
    const evidence = this.resources.get('evidence') || [];
    if (evidence.length === 0) return;

    console.log(`🧹 Cleaning ${evidence.length} evidence records...`);

    await Promise.all(evidence.map(async (id) => {
      try {
        await databases.deleteDocument(
          TEST_CONFIG.databaseId,
          TEST_CONFIG.evidenceCollectionId,
          id
        );
        console.log(`✅ Deleted evidence: ${id}`);
      } catch (error) {
        this.cleanupErrors.push({
          resource: `evidence:${id}`,
          error: error as Error
        });
        console.error(`❌ Failed to delete evidence ${id}:`, error);
      }
    }));
  }

  /**
   * Clean up mastery records
   *
   * Note: Mastery records may require query-based deletion
   * if tracked by composite key (studentId + courseId)
   */
  private async cleanupMastery(): Promise<void> {
    const mastery = this.resources.get('mastery') || [];
    if (mastery.length === 0) return;

    console.log(`🧹 Cleaning ${mastery.length} mastery records...`);

    // Sequential cleanup for mastery (may have dependencies on evidence)
    for (const id of mastery) {
      try {
        // If ID is document ID (not composite key)
        await databases.deleteDocument(
          TEST_CONFIG.databaseId,
          TEST_CONFIG.masteryCollectionId,
          id
        );
        console.log(`✅ Deleted mastery: ${id}`);
      } catch (error) {
        this.cleanupErrors.push({
          resource: `mastery:${id}`,
          error: error as Error
        });
        console.error(`❌ Failed to delete mastery ${id}:`, error);
      }
    }
  }

  /**
   * Clean up session records
   *
   * Note: Sessions may embed conversation history, so deleting
   * the session also removes the history
   */
  private async cleanupSessions(): Promise<void> {
    const sessions = this.resources.get('sessions') || [];
    if (sessions.length === 0) return;

    console.log(`🧹 Cleaning ${sessions.length} sessions...`);

    await Promise.all(sessions.map(async (id) => {
      try {
        await databases.deleteDocument(
          TEST_CONFIG.databaseId,
          TEST_CONFIG.sessionCollectionId,
          id
        );
        console.log(`✅ Deleted session: ${id}`);
      } catch (error) {
        this.cleanupErrors.push({
          resource: `session:${id}`,
          error: error as Error
        });
        console.error(`❌ Failed to delete session ${id}:`, error);
      }
    }));
  }

  /**
   * Clean up outcome records
   */
  private async cleanupOutcomes(): Promise<void> {
    const outcomes = this.resources.get('outcomes') || [];
    if (outcomes.length === 0) return;

    console.log(`🧹 Cleaning ${outcomes.length} outcomes...`);

    await Promise.all(outcomes.map(async (id) => {
      try {
        await databases.deleteDocument(
          TEST_CONFIG.databaseId,
          TEST_CONFIG.outcomesCollectionId,
          id
        );
        console.log(`✅ Deleted outcome: ${id}`);
      } catch (error) {
        this.cleanupErrors.push({
          resource: `outcome:${id}`,
          error: error as Error
        });
        console.error(`❌ Failed to delete outcome ${id}:`, error);
      }
    }));
  }

  /**
   * Clean up conversation history records
   *
   * Note: Histories are typically embedded in sessions, but this
   * handles cases where they're stored separately
   */
  private async cleanupHistories(): Promise<void> {
    const histories = this.resources.get('histories') || [];
    if (histories.length === 0) return;

    console.log(`🧹 Cleaning ${histories.length} conversation histories...`);

    await Promise.all(histories.map(async (id) => {
      try {
        await databases.deleteDocument(
          TEST_CONFIG.databaseId,
          TEST_CONFIG.conversationHistoryCollectionId,
          id
        );
        console.log(`✅ Deleted history: ${id}`);
      } catch (error) {
        this.cleanupErrors.push({
          resource: `history:${id}`,
          error: error as Error
        });
        console.error(`❌ Failed to delete history ${id}:`, error);
      }
    }));
  }

  /**
   * Get total count of tracked resources
   */
  private getTotalResourceCount(): number {
    return Array.from(this.resources.values())
      .reduce((sum, arr) => sum + arr.length, 0);
  }

  /**
   * Clear all tracked resources (useful for test isolation)
   */
  clear(): void {
    this.resources.forEach((_, key) => {
      this.resources.set(key, []);
    });
    this.cleanupErrors = [];
    console.log('🧹 Cleared all tracked resources');
  }
}

/**
 * Verify that cleanup succeeded by attempting to fetch deleted resources
 *
 * Usage:
 * ```typescript
 * const { verified, remaining } = await verifyCleanup(
 *   TEST_CONFIG.sessionCollectionId,
 *   sessionIds
 * );
 * ```
 */
export async function verifyCleanup(
  collectionId: string,
  resourceIds: string[]
): Promise<{ verified: boolean; remaining: string[] }> {
  if (resourceIds.length === 0) {
    console.log('✅ No resources to verify (empty list)');
    return { verified: true, remaining: [] };
  }

  console.log(`🔍 Verifying cleanup of ${resourceIds.length} resources...`);

  const remaining: string[] = [];

  await Promise.all(resourceIds.map(async (id) => {
    try {
      await databases.getDocument(TEST_CONFIG.databaseId, collectionId, id);
      // If we reach here, document still exists!
      remaining.push(id);
      console.warn(`⚠️  Resource still exists: ${id}`);
    } catch (error) {
      // Expected: Document not found = cleanup succeeded
      const errorMessage = (error as any)?.message || '';
      if (errorMessage.includes('not found') || errorMessage.includes('404')) {
        console.log(`✅ Verified deleted: ${id}`);
      } else {
        // Unexpected error (not a "not found" error)
        console.error(`❌ Verification error for ${id}:`, error);
        remaining.push(id); // Assume it still exists if we can't verify
      }
    }
  }));

  const verified = remaining.length === 0;
  if (verified) {
    console.log('✅ Cleanup verification passed');
  } else {
    console.error(`❌ Cleanup verification failed: ${remaining.length} resources remain`);
    console.error('Remaining IDs:', remaining);
  }

  return { verified, remaining };
}

/**
 * Cleanup with timeout protection (for large data operations)
 *
 * Usage:
 * ```typescript
 * await cleanupWithTimeout(
 *   () => sessionDriver.deleteSession(largeSessionId),
 *   15000, // 15 second timeout
 *   `session:${largeSessionId}`
 * );
 * ```
 */
export async function cleanupWithTimeout(
  operation: () => Promise<void>,
  timeoutMs: number = 10000,
  resourceName: string
): Promise<{ success: boolean; error?: Error; timedOut?: boolean }> {
  try {
    await Promise.race([
      operation(),
      new Promise<void>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Cleanup timeout after ${timeoutMs}ms`)),
          timeoutMs
        )
      )
    ]);
    console.log(`✅ Cleanup succeeded: ${resourceName}`);
    return { success: true };
  } catch (error) {
    const errorMessage = (error as Error).message;
    const timedOut = errorMessage.includes('timeout');

    if (timedOut) {
      console.error(`⏱️  Cleanup timeout for ${resourceName} after ${timeoutMs}ms`);
    } else {
      console.error(`❌ Cleanup failed for ${resourceName}:`, error);
    }

    return {
      success: false,
      error: error as Error,
      timedOut
    };
  }
}

/**
 * Batch delete with progress reporting
 *
 * Useful for cleaning up large numbers of resources without overwhelming Appwrite
 *
 * Usage:
 * ```typescript
 * const result = await batchDelete(
 *   TEST_CONFIG.sessionCollectionId,
 *   sessionIds,
 *   10 // Process 10 at a time
 * );
 * ```
 */
export async function batchDelete(
  collectionId: string,
  documentIds: string[],
  batchSize: number = 10
): Promise<{ deleted: number; failed: number; errors: Error[] }> {
  if (documentIds.length === 0) {
    console.log('✅ No documents to delete (empty list)');
    return { deleted: 0, failed: 0, errors: [] };
  }

  console.log(`🗑️  Batch deleting ${documentIds.length} documents from ${collectionId}...`);

  const errors: Error[] = [];
  let deleted = 0;

  // Process in batches to avoid overwhelming Appwrite
  for (let i = 0; i < documentIds.length; i += batchSize) {
    const batch = documentIds.slice(i, i + batchSize);
    console.log(`  Processing batch: ${i + 1}-${Math.min(i + batchSize, documentIds.length)} of ${documentIds.length}`);

    await Promise.all(batch.map(async (id) => {
      try {
        await databases.deleteDocument(TEST_CONFIG.databaseId, collectionId, id);
        deleted++;
        console.log(`    ✅ Deleted: ${id}`);
      } catch (error) {
        errors.push(error as Error);
        console.error(`    ❌ Failed: ${id}`, error);
      }
    }));

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < documentIds.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`✅ Batch delete complete: ${deleted}/${documentIds.length} succeeded`);

  if (errors.length > 0) {
    console.warn(`⚠️  ${errors.length} deletions failed`);
  }

  return {
    deleted,
    failed: errors.length,
    errors
  };
}

/**
 * Cleanup verification with retry (for eventual consistency in CI)
 *
 * Usage:
 * ```typescript
 * const verified = await verifyCleanupWithRetry(
 *   TEST_CONFIG.sessionCollectionId,
 *   sessionIds,
 *   3 // Retry up to 3 times
 * );
 * ```
 */
export async function verifyCleanupWithRetry(
  collectionId: string,
  resourceIds: string[],
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<boolean> {
  console.log(`🔍 Verifying cleanup with up to ${maxRetries} retries...`);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const { verified, remaining } = await verifyCleanup(collectionId, resourceIds);

    if (verified) {
      console.log(`✅ Verification succeeded on attempt ${attempt}`);
      return true;
    }

    if (attempt < maxRetries) {
      console.log(`⏳ Retry ${attempt}/${maxRetries} after ${delayMs}ms delay...`);
      console.log(`   ${remaining.length} resources still remaining`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    } else {
      console.error(`❌ Verification failed after ${maxRetries} attempts`);
      console.error(`   ${remaining.length} resources remain:`, remaining);
    }
  }

  return false;
}

/**
 * Force cleanup of remaining resources after verification failure
 *
 * Usage:
 * ```typescript
 * const { verified, remaining } = await verifyCleanup(...);
 * if (!verified) {
 *   await forceCleanup(TEST_CONFIG.sessionCollectionId, remaining);
 * }
 * ```
 */
export async function forceCleanup(
  collectionId: string,
  resourceIds: string[]
): Promise<{ cleaned: number; stillRemaining: string[] }> {
  if (resourceIds.length === 0) {
    return { cleaned: 0, stillRemaining: [] };
  }

  console.log(`🔨 Force cleanup of ${resourceIds.length} remaining resources...`);

  const stillRemaining: string[] = [];
  let cleaned = 0;

  for (const id of resourceIds) {
    try {
      await databases.deleteDocument(TEST_CONFIG.databaseId, collectionId, id);
      cleaned++;
      console.log(`✅ Force deleted: ${id}`);
    } catch (error) {
      stillRemaining.push(id);
      console.error(`❌ Force delete failed: ${id}`, error);
    }
  }

  if (stillRemaining.length === 0) {
    console.log('✅ Force cleanup successful');
  } else {
    console.error(`❌ ${stillRemaining.length} resources could not be force cleaned`);
    console.error('Manual intervention required for:', stillRemaining);
  }

  return { cleaned, stillRemaining };
}
