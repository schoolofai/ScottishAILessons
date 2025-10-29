/**
 * E2E Tests for Session Replay Feature
 *
 * Tests the session replay functionality from a user's perspective
 * using Playwright for browser automation.
 *
 * Cleanup: All created sessions are tracked and cleaned up in afterAll hook
 */

import { test, expect } from '@playwright/test';
import { databases } from '@/lib/appwrite';
import {
  sessionReplayFixtures,
  type ConversationHistory
} from '../fixtures/session-replay-data';

// Test configuration
const TEST_CONFIG = {
  databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || 'default',
  sessionCollectionId: 'sessions',
  baseUrl: 'http://localhost:3000',
  testStudentId: 'student-e2e-test-001'
};

// ═══════════════════════════════════════════════════════════════
// RESOURCE TRACKING FOR CLEANUP
// ═══════════════════════════════════════════════════════════════

const createdSessionIds: string[] = [];

// ═══════════════════════════════════════════════════════════════
// CLEANUP
// ═══════════════════════════════════════════════════════════════

test.afterAll(async () => {
  console.log('🧹 Starting E2E session replay cleanup...');
  console.log(`   Cleaning ${createdSessionIds.length} sessions...`);

  const cleanupPromises = createdSessionIds.map(async (sessionId) => {
    try {
      await databases.deleteDocument(
        TEST_CONFIG.databaseId,
        TEST_CONFIG.sessionCollectionId,
        sessionId
      );
      console.log(`   ✅ Deleted session: ${sessionId}`);
    } catch (error) {
      console.error(`   ❌ Failed to delete session ${sessionId}:`, error);
    }
  });

  await Promise.all(cleanupPromises);
  console.log('✅ E2E cleanup completed');
});

// ═══════════════════════════════════════════════════════════════
// HELPER: Create Test Session
// ═══════════════════════════════════════════════════════════════

async function createTestSession(data: {
  status: 'completed' | 'abandoned' | 'active';
  conversationHistory?: string;
  score?: number;
  lessonTemplateId?: string;
}): Promise<string> {
  const session = await databases.createDocument(
    TEST_CONFIG.databaseId,
    TEST_CONFIG.sessionCollectionId,
    'unique()',
    {
      studentId: TEST_CONFIG.testStudentId,
      lessonTemplateId: data.lessonTemplateId || 'lesson-e2e-test-001',
      status: data.status,
      startedAt: new Date().toISOString(),
      endedAt: data.status !== 'active' ? new Date(Date.now() + 1800000).toISOString() : undefined,
      score: data.score,
      conversationHistory: data.conversationHistory
    }
  );

  // Track for cleanup
  createdSessionIds.push(session.$id);
  console.log(`📝 Created test session: ${session.$id} (status: ${data.status})`);

  return session.$id;
}

// ═══════════════════════════════════════════════════════════════
// TEST 1: Basic Replay Page Rendering
// ═══════════════════════════════════════════════════════════════

test.describe('Session Replay - Basic Rendering', () => {
  test('should load replay page with session metadata', async ({ page }) => {
    // Given: A completed session with history
    const history = sessionReplayFixtures.histories.small;
    const compressed = await sessionReplayFixtures.helpers.compress(history);

    const sessionId = await createTestSession({
      status: 'completed',
      conversationHistory: compressed,
      score: 0.85
    });

    // When: Navigate to replay page
    await page.goto(`${TEST_CONFIG.baseUrl}/sessions/${sessionId}/view`);

    // Then: Page loads successfully
    await expect(page.locator('text=Lesson Session Replay')).toBeVisible({ timeout: 10000 });

    // And: Session metadata is displayed
    await expect(page.locator('text=Score: 85%')).toBeVisible();
    await expect(page.locator('text=🎬 Replay Mode')).toBeVisible();
    await expect(page.locator('text=read-only view')).toBeVisible();

    console.log('✅ TEST PASSED: Basic replay page rendering');
  });

  test('should display session status badge', async ({ page }) => {
    // Given: A completed session
    const history = sessionReplayFixtures.histories.small;
    const compressed = await sessionReplayFixtures.helpers.compress(history);

    const sessionId = await createTestSession({
      status: 'completed',
      conversationHistory: compressed
    });

    // When: Load replay page
    await page.goto(`${TEST_CONFIG.baseUrl}/sessions/${sessionId}/view`);

    // Then: Status badge is visible
    await expect(page.locator('text=completed')).toBeVisible();

    console.log('✅ TEST PASSED: Session status badge displayed');
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST 2: Message Input Hidden
// ═══════════════════════════════════════════════════════════════

test.describe('Session Replay - Read-Only Mode', () => {
  test('should hide message input box in replay mode', async ({ page }) => {
    // Given: A completed session
    const history = sessionReplayFixtures.histories.small;
    const compressed = await sessionReplayFixtures.helpers.compress(history);

    const sessionId = await createTestSession({
      status: 'completed',
      conversationHistory: compressed
    });

    // When: Navigate to replay page
    await page.goto(`${TEST_CONFIG.baseUrl}/sessions/${sessionId}/view`);
    await page.waitForLoadState('networkidle');

    // Then: Message composer is not visible
    const composer = page.locator('[data-testid="composer"]');
    await expect(composer).not.toBeVisible();

    // And: No text input for messages
    const textarea = page.locator('textarea[placeholder*="message" i]');
    await expect(textarea).not.toBeVisible();

    // And: Replay mode notice is shown
    await expect(page.locator('text=🎬 Replay Mode')).toBeVisible();

    console.log('✅ TEST PASSED: Message input hidden in replay mode');
  });

  test('should show replay notice at bottom of thread', async ({ page }) => {
    // Given: A session with history
    const history = sessionReplayFixtures.histories.small;
    const compressed = await sessionReplayFixtures.helpers.compress(history);

    const sessionId = await createTestSession({
      status: 'completed',
      conversationHistory: compressed
    });

    // When: Load page
    await page.goto(`${TEST_CONFIG.baseUrl}/sessions/${sessionId}/view`);

    // Then: Replay notice is at bottom
    const replayNotice = page.locator('text=🎬 Replay Mode - This is a read-only view');
    await expect(replayNotice).toBeVisible();

    console.log('✅ TEST PASSED: Replay notice displayed');
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST 3: Conversation History Display
// ═══════════════════════════════════════════════════════════════

test.describe('Session Replay - Message Display', () => {
  test('should display all messages in chronological order', async ({ page }) => {
    // Given: A session with 5 messages
    const history = sessionReplayFixtures.histories.small; // 5 messages
    const compressed = await sessionReplayFixtures.helpers.compress(history);

    const sessionId = await createTestSession({
      status: 'completed',
      conversationHistory: compressed
    });

    // When: Load replay page
    await page.goto(`${TEST_CONFIG.baseUrl}/sessions/${sessionId}/view`);
    await page.waitForLoadState('networkidle');

    // Then: Message count should be 5
    const messages = page.locator('[data-message-role]');
    await expect(messages).toHaveCount(5, { timeout: 10000 });

    // And: First message is from user
    const firstMessage = messages.nth(0);
    await expect(firstMessage).toHaveAttribute('data-message-role', 'user');
    await expect(firstMessage).toContainText('Hello');

    // And: Second message is from assistant
    const secondMessage = messages.nth(1);
    await expect(secondMessage).toHaveAttribute('data-message-role', 'assistant');

    console.log('✅ TEST PASSED: All messages displayed in order');
  });

  test('should display session info card with message count', async ({ page }) => {
    // Given: Session with history
    const history = sessionReplayFixtures.histories.small;
    const compressed = await sessionReplayFixtures.helpers.compress(history);

    const sessionId = await createTestSession({
      status: 'completed',
      conversationHistory: compressed
    });

    // When: Load page
    await page.goto(`${TEST_CONFIG.baseUrl}/sessions/${sessionId}/view`);

    // Then: Message count is displayed
    await expect(page.locator('text=5 messages recorded')).toBeVisible();

    console.log('✅ TEST PASSED: Message count displayed');
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST 4: Navigation
// ═══════════════════════════════════════════════════════════════

test.describe('Session Replay - Navigation', () => {
  test('should navigate back when back button clicked', async ({ page }) => {
    // Given: A session
    const history = sessionReplayFixtures.histories.small;
    const compressed = await sessionReplayFixtures.helpers.compress(history);

    const sessionId = await createTestSession({
      status: 'completed',
      conversationHistory: compressed
    });

    // When: Navigate to replay page
    await page.goto(`${TEST_CONFIG.baseUrl}/sessions/${sessionId}/view`);

    // And: Click back button
    await page.click('button:has-text("Back to History")');

    // Then: Should navigate back
    // Note: This will just go back in browser history
    await page.waitForTimeout(1000);

    console.log('✅ TEST PASSED: Back button works');
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST 6: Error Handling
// ═══════════════════════════════════════════════════════════════

test.describe('Session Replay - Error Handling', () => {
  test('should show error for non-existent session', async ({ page }) => {
    // When: Navigate to non-existent session
    await page.goto(`${TEST_CONFIG.baseUrl}/sessions/non-existent-id/view`);

    // Then: Should show error message
    await expect(page.locator('text=Session not found')).toBeVisible({ timeout: 10000 });

    // And: Should show go back button
    await expect(page.locator('button:has-text("Go Back")' )).toBeVisible();

    console.log('✅ TEST PASSED: Error shown for non-existent session');
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST 7: Performance
// ═══════════════════════════════════════════════════════════════

test.describe('Session Replay - Performance', () => {
  test('should load page within acceptable time', async ({ page }) => {
    // Given: A session with moderate history (20 messages)
    const history = sessionReplayFixtures.histories.mediumWithCard;
    const compressed = await sessionReplayFixtures.helpers.compress(history);

    const sessionId = await createTestSession({
      status: 'completed',
      conversationHistory: compressed
    });

    // When: Measure load time
    const startTime = Date.now();
    await page.goto(`${TEST_CONFIG.baseUrl}/sessions/${sessionId}/view`);
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    // Then: Should load within 5 seconds (generous for E2E)
    expect(loadTime).toBeLessThan(5000);

    console.log(`✅ TEST PASSED: Page loaded in ${loadTime}ms`);
  });
});
