/**
 * Integration Tests for Session History Persistence
 *
 * Tests compression, decompression, and database persistence of conversation histories
 *
 * Cleanup: All created sessions are tracked and cleaned up in afterAll hook
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import {
  sessionReplayFixtures,
  type ConversationHistory
} from '../fixtures/session-replay-data';
import { databases } from '@/lib/appwrite';
import { createDriver } from '@/lib/appwrite';
import { SessionDriver } from '@/lib/appwrite/driver/SessionDriver';

// Test configuration
const TEST_CONFIG = {
  databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || 'default',
  sessionCollectionId: 'sessions',
  testStudentId: 'student-integration-test-001'
};

// ═══════════════════════════════════════════════════════════════
// RESOURCE TRACKING FOR CLEANUP
// ═══════════════════════════════════════════════════════════════

const createdSessionIds: string[] = [];
let sessionDriver: SessionDriver;

// ═══════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════

beforeAll(async () => {
  console.log('🎬 Setting up session history persistence tests...');
  sessionDriver = createDriver(SessionDriver);
  console.log('✅ Setup complete');
});

// ═══════════════════════════════════════════════════════════════
// CLEANUP
// ═══════════════════════════════════════════════════════════════

afterAll(async () => {
  console.log('🧹 Starting integration test cleanup...');
  console.log(`   Cleaning ${createdSessionIds.length} sessions...`);

  const cleanupErrors: Error[] = [];

  await Promise.all(createdSessionIds.map(async (sessionId) => {
    try {
      await databases.deleteDocument(
        TEST_CONFIG.databaseId,
        TEST_CONFIG.sessionCollectionId,
        sessionId
      );
      console.log(`   ✅ Deleted session: ${sessionId}`);
    } catch (error) {
      const err = new Error(`Session ${sessionId}: ${(error as Error).message}`);
      cleanupErrors.push(err);
      console.error(`   ❌ ${err.message}`);
    }
  }));

  // Report cleanup summary
  if (cleanupErrors.length > 0) {
    console.warn(`⚠️  Cleanup completed with ${cleanupErrors.length} errors`);
    cleanupErrors.forEach(err => console.error(`  - ${err.message}`));
  } else {
    console.log('✅ All integration test cleanup successful');
  }
});

// ═══════════════════════════════════════════════════════════════
// TEST 1: Compression
// ═══════════════════════════════════════════════════════════════

describe('Conversation History Compression', () => {
  test('should compress small history successfully', async () => {
    // Given: A small conversation history (5 messages)
    const history = sessionReplayFixtures.histories.small;
    const originalSize = JSON.stringify(history).length;

    // When: Compress the history
    const compressed = await sessionReplayFixtures.helpers.compress(history);

    // Then: Compressed size is smaller
    expect(compressed.length).toBeLessThan(originalSize);

    // And: Compression is valid base64
    expect(() => Buffer.from(compressed, 'base64')).not.toThrow();

    console.log(`✅ Compressed ${originalSize} bytes → ${compressed.length} bytes`);
    console.log(`   Compression ratio: ${((compressed.length / originalSize) * 100).toFixed(1)}%`);
  });

  test('should compress large history under 50KB', async () => {
    // Given: A large conversation history (100 messages)
    const largeHistory = sessionReplayFixtures.histories.createLarge(100);
    const uncompressedSize = JSON.stringify(largeHistory).length;

    // When: Compress history
    const compressed = await sessionReplayFixtures.helpers.compress(largeHistory);

    // Then: Compressed data is under 50KB limit
    expect(compressed.length).toBeLessThan(50 * 1024);
    expect(compressed.length).toBeLessThan(uncompressedSize);

    // And: Compression ratio is reasonable (>50% reduction)
    const compressionRatio = compressed.length / uncompressedSize;
    expect(compressionRatio).toBeLessThan(0.5);

    console.log(`✅ Large history compressed: ${uncompressedSize} bytes → ${compressed.length} bytes`);
    console.log(`   Compression ratio: ${(compressionRatio * 100).toFixed(1)}%`);
  });

  test('should compress history with lesson cards', async () => {
    // Given: History with tool calls (lesson cards)
    const historyWithCards = sessionReplayFixtures.histories.createWithCards(3);

    // When: Compress
    const compressed = await sessionReplayFixtures.helpers.compress(historyWithCards);

    // Then: Compression succeeds
    expect(compressed).toBeDefined();
    expect(compressed.length).toBeGreaterThan(0);

    console.log(`✅ History with cards compressed: ${compressed.length} bytes`);
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST 2: Decompression
// ═══════════════════════════════════════════════════════════════

describe('Conversation History Decompression', () => {
  test('should decompress without data loss', async () => {
    // Given: Original conversation history
    const original = sessionReplayFixtures.histories.small;

    // When: Compress and then decompress
    const compressed = await sessionReplayFixtures.helpers.compress(original);
    const decompressed = await sessionReplayFixtures.helpers.decompress(compressed);

    // Then: Decompressed matches original exactly
    expect(decompressed).toEqual(original);
    expect(decompressed.messages.length).toBe(original.messages.length);
    expect(decompressed.thread_id).toBe(original.thread_id);

    // And: All message properties are preserved
    expect(decompressed.messages[0]).toEqual(original.messages[0]);
    expect(decompressed.messages[0].content).toBe(original.messages[0].content);

    console.log('✅ Decompression preserves all data');
  });

  test('should handle large history decompression', async () => {
    // Given: Large history (100 messages)
    const largeHistory = sessionReplayFixtures.histories.createLarge(100);

    // When: Compress and decompress
    const compressed = await sessionReplayFixtures.helpers.compress(largeHistory);
    const decompressed = await sessionReplayFixtures.helpers.decompress(compressed);

    // Then: All messages preserved
    expect(decompressed.messages.length).toBe(100);
    expect(decompressed.messages[0].id).toBe(largeHistory.messages[0].id);
    expect(decompressed.messages[99].id).toBe(largeHistory.messages[99].id);

    console.log('✅ Large history decompression successful (100 messages)');
  });

  test('should throw error for corrupted data', async () => {
    // Given: Corrupted compressed data
    const corruptedData = sessionReplayFixtures.compressed.corrupted;

    // When/Then: Decompression should fail
    await expect(
      sessionReplayFixtures.helpers.decompress(corruptedData)
    ).rejects.toThrow();

    console.log('✅ Corrupted data throws error as expected');
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST 3: Database Persistence
// ═══════════════════════════════════════════════════════════════

describe('Session with History Persistence', () => {
  test('should save and retrieve session with compressed history', async () => {
    // Given: Test history
    const history = sessionReplayFixtures.histories.small;
    const compressed = await sessionReplayFixtures.helpers.compress(history);

    // When: Create session in database
    const session = await databases.createDocument(
      TEST_CONFIG.databaseId,
      TEST_CONFIG.sessionCollectionId,
      'unique()',
      {
        studentId: TEST_CONFIG.testStudentId,
        lessonTemplateId: 'lesson-persist-001',
        status: 'completed',
        startedAt: new Date().toISOString(),
        endedAt: new Date(Date.now() + 1800000).toISOString(),
        score: 0.75,
        conversationHistory: compressed
      }
    );

    createdSessionIds.push(session.$id);
    console.log(`📝 Created session: ${session.$id}`);

    // Then: Session is saved with compressed history
    expect(session.$id).toBeDefined();
    expect(session.conversationHistory).toBe(compressed);

    // And: Can retrieve and decompress
    const retrieved = await databases.getDocument(
      TEST_CONFIG.databaseId,
      TEST_CONFIG.sessionCollectionId,
      session.$id
    );

    const decompressed = await sessionReplayFixtures.helpers.decompress(
      retrieved.conversationHistory
    );

    expect(decompressed.messages.length).toBe(5);
    expect(decompressed.thread_id).toBe(history.thread_id);

    console.log('✅ Session saved and retrieved with history intact');
  });

  test('should handle null conversation history', async () => {
    // Given: Session with null history
    const session = await databases.createDocument(
      TEST_CONFIG.databaseId,
      TEST_CONFIG.sessionCollectionId,
      'unique()',
      {
        studentId: TEST_CONFIG.testStudentId,
        lessonTemplateId: 'lesson-null-history-001',
        status: 'active',
        startedAt: new Date().toISOString(),
        conversationHistory: null
      }
    );

    createdSessionIds.push(session.$id);
    console.log(`📝 Created session with null history: ${session.$id}`);

    // When: Retrieve session
    const retrieved = await databases.getDocument(
      TEST_CONFIG.databaseId,
      TEST_CONFIG.sessionCollectionId,
      session.$id
    );

    // Then: History is null (no error)
    expect(retrieved.conversationHistory).toBeNull();
    expect(retrieved.status).toBe('active');

    console.log('✅ Session with null history handles gracefully');
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST 4: SessionDriver Integration
// ═══════════════════════════════════════════════════════════════

describe('SessionDriver getSessionWithHistory', () => {
  test('should retrieve session and decompress history', async () => {
    // Given: Session with compressed history
    const history = sessionReplayFixtures.histories.small;
    const compressed = await sessionReplayFixtures.helpers.compress(history);

    const session = await databases.createDocument(
      TEST_CONFIG.databaseId,
      TEST_CONFIG.sessionCollectionId,
      'unique()',
      {
        studentId: TEST_CONFIG.testStudentId,
        lessonTemplateId: 'lesson-driver-001',
        status: 'completed',
        startedAt: new Date().toISOString(),
        conversationHistory: compressed
      }
    );

    createdSessionIds.push(session.$id);

    // When: Use SessionDriver to get session with history
    const result = await sessionDriver.getSessionWithHistory(session.$id);

    // Then: Returns session and decompressed history
    expect(result.session.$id).toBe(session.$id);
    expect(result.history).toBeDefined();
    expect(result.history!.messages.length).toBe(5);
    expect(result.history!.messages[0].content).toBeDefined();

    console.log('✅ SessionDriver retrieves and decompresses history');
  });

  test('should handle session without history', async () => {
    // Given: Session with null history
    const session = await databases.createDocument(
      TEST_CONFIG.databaseId,
      TEST_CONFIG.sessionCollectionId,
      'unique()',
      {
        studentId: TEST_CONFIG.testStudentId,
        lessonTemplateId: 'lesson-driver-null-001',
        status: 'active',
        startedAt: new Date().toISOString(),
        conversationHistory: null
      }
    );

    createdSessionIds.push(session.$id);

    // When: Retrieve via SessionDriver
    const result = await sessionDriver.getSessionWithHistory(session.$id);

    // Then: Returns session with null history (no error)
    expect(result.session.$id).toBe(session.$id);
    expect(result.history).toBeNull();

    console.log('✅ SessionDriver handles null history without errors');
  });

  test('should throw error for corrupted history data', async () => {
    // Given: Session with corrupted compressed data
    const session = await databases.createDocument(
      TEST_CONFIG.databaseId,
      TEST_CONFIG.sessionCollectionId,
      'unique()',
      {
        studentId: TEST_CONFIG.testStudentId,
        lessonTemplateId: 'lesson-driver-corrupt-001',
        status: 'completed',
        startedAt: new Date().toISOString(),
        conversationHistory: 'INVALID_BASE64_DATA!!!'
      }
    );

    createdSessionIds.push(session.$id);

    // When/Then: Should throw error on decompression
    await expect(
      sessionDriver.getSessionWithHistory(session.$id)
    ).rejects.toThrow();

    console.log('✅ SessionDriver throws error for corrupted data');
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST 5: Performance
// ═══════════════════════════════════════════════════════════════

describe('Session History Performance', () => {
  test('should compress within 1 second', async () => {
    // Given: Large history (100 messages)
    const largeHistory = sessionReplayFixtures.histories.createLarge(100);

    // When: Measure compression time
    const startTime = Date.now();
    const compressed = await sessionReplayFixtures.helpers.compress(largeHistory);
    const compressionTime = Date.now() - startTime;

    // Then: Should complete within 1 second
    expect(compressionTime).toBeLessThan(1000);

    console.log(`✅ Compression completed in ${compressionTime}ms`);
  });

  test('should decompress within 500ms', async () => {
    // Given: Compressed large history
    const largeHistory = sessionReplayFixtures.histories.createLarge(100);
    const compressed = await sessionReplayFixtures.helpers.compress(largeHistory);

    // When: Measure decompression time
    const startTime = Date.now();
    const decompressed = await sessionReplayFixtures.helpers.decompress(compressed);
    const decompressionTime = Date.now() - startTime;

    // Then: Should complete within 500ms
    expect(decompressionTime).toBeLessThan(500);
    expect(decompressed.messages.length).toBe(100);

    console.log(`✅ Decompression completed in ${decompressionTime}ms`);
  });
});
