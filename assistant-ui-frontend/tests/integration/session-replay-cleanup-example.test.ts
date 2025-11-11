/**
 * Session Replay Cleanup Example Test
 *
 * Demonstrates proper cleanup patterns for session replay tests
 * This is a REFERENCE IMPLEMENTATION showing best practices
 *
 * Based on patterns from:
 * - __tests__/integration/EvidenceDriver.test.ts
 * - __tests__/integration/MasteryDriver.test.ts
 * - tests/integration/session-completion.test.ts
 */

import { describe, test, beforeAll, afterAll, expect } from '@jest/globals';
import {
  TestResourceTracker,
  verifyCleanup,
  cleanupWithTimeout,
  batchDelete,
  TEST_CONFIG
} from '../utils/cleanup-helpers';
import {
  sessionReplayFixtures,
  type ConversationHistory
} from '../fixtures/session-replay-data';
import { databases } from '@/lib/appwrite';
import { SessionDriver } from '@/lib/appwrite/driver/SessionDriver';
import { createDriver } from '@/lib/appwrite';

describe('Session Replay Cleanup Patterns (Reference Implementation)', () => {
  // ═══════════════════════════════════════════════════════════════
  // RESOURCE TRACKING
  // ═══════════════════════════════════════════════════════════════

  let tracker: TestResourceTracker;
  let sessionDriver: SessionDriver;

  // Alternative: Manual tracking arrays
  let createdSessionIds: string[] = [];

  // ═══════════════════════════════════════════════════════════════
  // SETUP
  // ═══════════════════════════════════════════════════════════════

  beforeAll(async () => {
    console.log('🎬 Setting up session replay cleanup tests...');

    // Initialize resource tracker
    tracker = new TestResourceTracker();

    // Initialize drivers
    sessionDriver = createDriver(SessionDriver);

    console.log('✅ Setup complete');
  });

  // ═══════════════════════════════════════════════════════════════
  // CLEANUP - METHOD 1: Using TestResourceTracker (Recommended)
  // ═══════════════════════════════════════════════════════════════

  afterAll(async () => {
    console.log('🧹 Starting cleanup using TestResourceTracker...');

    try {
      // Comprehensive cleanup with error collection
      const result = await tracker.cleanup();

      // Verify cleanup succeeded
      if (result.errors.length === 0) {
        console.log('✅ All resources cleaned successfully');

        // Optional: Verify deletion
        const sessionIds = tracker.getTracked('sessions');
        if (sessionIds.length > 0) {
          const { verified, remaining } = await verifyCleanup(
            TEST_CONFIG.sessionCollectionId,
            sessionIds
          );

          if (!verified) {
            console.error(`⚠️  ${remaining.length} sessions still exist after cleanup`);
            // Could attempt force cleanup here
          }
        }
      } else {
        console.warn(`⚠️  Cleanup completed with ${result.errors.length} errors`);
      }
    } catch (error) {
      console.error('❌ Critical cleanup failure:', error);
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // ALTERNATIVE CLEANUP - METHOD 2: Manual Tracking
  // ═══════════════════════════════════════════════════════════════

  // Uncomment to use manual tracking instead of TestResourceTracker
  /*
  afterAll(async () => {
    console.log('🧹 Starting manual cleanup...');
    const cleanupErrors: Error[] = [];

    // Clean up sessions
    await Promise.all(createdSessionIds.map(async (id) => {
      try {
        await sessionDriver.deleteSession(id);
        console.log(`✅ Deleted session: ${id}`);
      } catch (error) {
        cleanupErrors.push(new Error(`Session ${id}: ${error.message}`));
        console.error(`❌ Failed to delete session ${id}:`, error);
      }
    }));

    // Report summary
    if (cleanupErrors.length === 0) {
      console.log('✅ Manual cleanup successful');
    } else {
      console.warn(`⚠️  ${cleanupErrors.length} cleanup errors occurred`);
      cleanupErrors.forEach(err => console.error(`  - ${err.message}`));
    }
  });
  */

  // ═══════════════════════════════════════════════════════════════
  // TEST 1: Basic Session Creation and Cleanup
  // ═══════════════════════════════════════════════════════════════

  test('should create and cleanup a single session', async () => {
    console.log('📝 TEST: Single session cleanup');

    // Given: Test data
    const history = sessionReplayFixtures.histories.small;
    const compressed = await sessionReplayFixtures.helpers.compress(history);

    // When: Create session
    const session = await databases.createDocument(
      TEST_CONFIG.databaseId,
      TEST_CONFIG.sessionCollectionId,
      'unique()',
      {
        studentId: 'student-test-001',
        lessonTemplateId: 'lesson-test-001',
        status: 'completed',
        startedAt: new Date().toISOString(),
        endedAt: new Date(Date.now() + 1800000).toISOString(),
        score: 0.85,
        conversationHistory: compressed
      }
    );

    // Track for cleanup
    tracker.track('session', session.$id);
    // OR: createdSessionIds.push(session.$id);

    console.log(`✅ Created session: ${session.$id}`);

    // Then: Session exists
    expect(session.$id).toBeDefined();
    expect(session.status).toBe('completed');

    // Cleanup happens in afterAll hook
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 2: Multiple Sessions (Batch Cleanup)
  // ═══════════════════════════════════════════════════════════════

  test('should create and cleanup multiple sessions', async () => {
    console.log('📝 TEST: Batch session cleanup');

    // Given: Multiple test sessions
    const testSessions = await sessionReplayFixtures.helpers.createMultiple(5);

    // When: Create all sessions
    const createdSessions = await Promise.all(
      testSessions.map(async (sessionData) => {
        const session = await databases.createDocument(
          TEST_CONFIG.databaseId,
          TEST_CONFIG.sessionCollectionId,
          'unique()',
          {
            ...sessionData,
            startedAt: sessionData.startedAt || new Date().toISOString()
          }
        );

        // Track each session
        tracker.track('session', session.$id);

        console.log(`✅ Created session: ${session.$id}`);
        return session;
      })
    );

    // Then: All sessions exist
    expect(createdSessions.length).toBe(5);

    // Cleanup happens in afterAll hook (batch deletion)
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 3: Large Session with Timeout Protection
  // ═══════════════════════════════════════════════════════════════

  test('should cleanup large session with timeout protection', async () => {
    console.log('📝 TEST: Large session cleanup with timeout');

    // Given: Large conversation history (100 messages)
    const largeHistory = sessionReplayFixtures.histories.createLarge(100);
    const compressed = await sessionReplayFixtures.helpers.compress(largeHistory);

    // When: Create large session
    const session = await databases.createDocument(
      TEST_CONFIG.databaseId,
      TEST_CONFIG.sessionCollectionId,
      'unique()',
      {
        studentId: 'student-test-002',
        lessonTemplateId: 'lesson-perf-001',
        status: 'completed',
        startedAt: new Date().toISOString(),
        endedAt: new Date(Date.now() + 3600000).toISOString(),
        conversationHistory: compressed
      }
    );

    tracker.track('session', session.$id);
    console.log(`✅ Created large session: ${session.$id} (${compressed.length} bytes)`);

    // Then: Session exists
    expect(session.$id).toBeDefined();

    // Note: Cleanup with timeout protection happens in afterAll
    // Large sessions may take longer to delete due to data size
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 4: Cleanup Verification
  // ═══════════════════════════════════════════════════════════════

  test('should verify cleanup after deletion', async () => {
    console.log('📝 TEST: Cleanup verification');

    // Given: A test session
    const history = sessionReplayFixtures.histories.small;
    const compressed = await sessionReplayFixtures.helpers.compress(history);

    const session = await databases.createDocument(
      TEST_CONFIG.databaseId,
      TEST_CONFIG.sessionCollectionId,
      'unique()',
      {
        studentId: 'student-test-003',
        lessonTemplateId: 'lesson-verify-001',
        status: 'completed',
        startedAt: new Date().toISOString(),
        conversationHistory: compressed
      }
    );

    const sessionId = session.$id;
    console.log(`✅ Created session for verification: ${sessionId}`);

    // When: Delete immediately (demonstrating verification)
    await databases.deleteDocument(
      TEST_CONFIG.databaseId,
      TEST_CONFIG.sessionCollectionId,
      sessionId
    );

    console.log(`🗑️  Deleted session: ${sessionId}`);

    // Then: Verify deletion
    const { verified, remaining } = await verifyCleanup(
      TEST_CONFIG.sessionCollectionId,
      [sessionId]
    );

    expect(verified).toBe(true);
    expect(remaining.length).toBe(0);

    console.log('✅ Cleanup verification passed');

    // Note: This session is NOT tracked because we deleted it already
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 5: Error Handling in Cleanup
  // ═══════════════════════════════════════════════════════════════

  test('should handle cleanup errors gracefully', async () => {
    console.log('📝 TEST: Cleanup error handling');

    // Given: Valid session
    const history = sessionReplayFixtures.histories.small;
    const compressed = await sessionReplayFixtures.helpers.compress(history);

    const session = await databases.createDocument(
      TEST_CONFIG.databaseId,
      TEST_CONFIG.sessionCollectionId,
      'unique()',
      {
        studentId: 'student-test-004',
        lessonTemplateId: 'lesson-error-001',
        status: 'completed',
        startedAt: new Date().toISOString(),
        conversationHistory: compressed
      }
    );

    tracker.track('session', session.$id);

    // Also track a non-existent session (will fail cleanup)
    tracker.track('session', 'non-existent-session-id');

    console.log(`✅ Created session: ${session.$id}`);
    console.log(`❌ Tracked non-existent session (will fail cleanup)`);

    // When cleanup runs in afterAll:
    // - session.$id will delete successfully
    // - 'non-existent-session-id' will fail
    // - Cleanup continues despite failure
    // - Error is collected and reported

    // This demonstrates graceful error handling
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 6: Batch Delete with Progress Reporting
  // ═══════════════════════════════════════════════════════════════

  test('should demonstrate batch delete pattern', async () => {
    console.log('📝 TEST: Batch delete pattern');

    // Given: 10 test sessions
    const sessionIds: string[] = [];

    for (let i = 0; i < 10; i++) {
      const history = sessionReplayFixtures.histories.small;
      const compressed = await sessionReplayFixtures.helpers.compress(history);

      const session = await databases.createDocument(
        TEST_CONFIG.databaseId,
        TEST_CONFIG.sessionCollectionId,
        'unique()',
        {
          studentId: 'student-test-batch',
          lessonTemplateId: `lesson-batch-${String(i).padStart(3, '0')}`,
          status: 'completed',
          startedAt: new Date().toISOString(),
          conversationHistory: compressed
        }
      );

      sessionIds.push(session.$id);
      console.log(`✅ Created batch session ${i + 1}/10: ${session.$id}`);
    }

    console.log('🗑️  Performing batch delete...');

    // When: Batch delete with progress reporting
    const result = await batchDelete(
      TEST_CONFIG.sessionCollectionId,
      sessionIds,
      5 // Process 5 at a time
    );

    // Then: All deleted
    expect(result.deleted).toBe(10);
    expect(result.failed).toBe(0);

    console.log(`✅ Batch delete complete: ${result.deleted}/${sessionIds.length} succeeded`);

    // Note: These sessions are NOT tracked because we already deleted them
  });
});

// ═══════════════════════════════════════════════════════════════
// ADDITIONAL CLEANUP PATTERNS (Commented Examples)
// ═══════════════════════════════════════════════════════════════

/*
// Pattern 1: Cleanup with timeout for large data
async function cleanupLargeSession(sessionId: string): Promise<void> {
  const result = await cleanupWithTimeout(
    () => sessionDriver.deleteSession(sessionId),
    15000, // 15 second timeout
    `session:${sessionId}`
  );

  if (result.timedOut) {
    console.warn(`⏱️  Large session ${sessionId} cleanup timed out - may require manual cleanup`);
  } else if (!result.success) {
    console.error(`❌ Large session ${sessionId} cleanup failed:`, result.error);
  }
}

// Pattern 2: Cleanup with retry for eventual consistency
async function cleanupWithRetry(sessionId: string, maxRetries: number = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await sessionDriver.deleteSession(sessionId);
      console.log(`✅ Deleted session ${sessionId} (attempt ${attempt})`);
      return true;
    } catch (error) {
      if (attempt < maxRetries) {
        console.log(`⏳ Retry ${attempt}/${maxRetries} for ${sessionId}...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.error(`❌ Failed to delete ${sessionId} after ${maxRetries} attempts`);
        return false;
      }
    }
  }
  return false;
}

// Pattern 3: Dependency-ordered cleanup (for related resources)
async function cleanupSessionWithRelations(sessionId: string): Promise<void> {
  // Clean in dependency order

  // 1. Evidence (references session)
  const evidence = await evidenceDriver.getBySession(sessionId);
  for (const e of evidence) {
    await evidenceDriver.deleteEvidence(e.$id);
  }

  // 2. Mastery (may reference evidence)
  const mastery = await masteryDriver.getBySession(sessionId);
  for (const m of mastery) {
    await masteryDriver.deleteMasteryV2(m.studentId, m.courseId);
  }

  // 3. Session (parent)
  await sessionDriver.deleteSession(sessionId);
}
*/
