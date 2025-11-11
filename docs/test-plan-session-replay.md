# Test Plan: Session Replay Feature

**Feature**: Session replay functionality for viewing completed lesson sessions in read-only mode

**Implementation Date**: 2025-10-29

**Current Test Coverage**: 0% (64+ tests exist for other features, none for replay)

---

## Executive Summary

This test plan addresses critical gaps in test coverage for the newly implemented session replay feature. The feature allows students to view past lesson sessions in a read-only mode, with conversation history decompressed from the database and displayed through the same UI components used in live sessions.

**Key Risk Areas**:
- Data integrity during compression/decompression
- Security (unauthorized access to other students' sessions)
- Performance with large conversation histories (approaching 50KB limit)
- UI state management in replay mode vs live mode
- **Test data cleanup and isolation** (PRIMARY FOCUS)

---

## 1. E2E Tests (Playwright)

### Test File: `tests/integration/session-replay.spec.ts`

#### Priority: P0 (Critical Path)

### 1.1 Basic Replay Page Rendering

**Test**: "should load session replay page with correct metadata"
```typescript
describe('Session Replay E2E Tests', () => {
  let testResourceTracker: TestResourceTracker;
  let createdSessionIds: string[] = [];

  beforeAll(async () => {
    testResourceTracker = new TestResourceTracker();
  });

  afterAll(async () => {
    console.log('🧹 Starting E2E test cleanup...');

    try {
      // Clean up all created sessions
      const cleanupPromises = createdSessionIds.map(async (sessionId) => {
        try {
          await databases.deleteDocument(
            TEST_CONFIG.databaseId,
            TEST_CONFIG.sessionCollectionId,
            sessionId
          );
          console.log(`✅ Deleted test session: ${sessionId}`);
        } catch (error) {
          console.error(`❌ Failed to delete session ${sessionId}:`, error);
        }
      });

      await Promise.all(cleanupPromises);
      console.log('✅ E2E cleanup completed');
    } catch (error) {
      console.error('❌ Critical cleanup failure:', error);
    }
  });

  test('should load session replay page with correct metadata', async ({ page }) => {
    // Given: A completed session exists in the database
    const sessionId = await createTestSession({
      status: 'completed',
      score: 0.85,
      conversationHistory: compressedTestHistory
    });

    // Track for cleanup
    createdSessionIds.push(sessionId);

    // When: Navigate to replay page
    await page.goto(`/sessions/${sessionId}/view`);

    // Then: Page loads without errors
    await expect(page.locator('text=Lesson Session Replay')).toBeVisible();
    await expect(page.locator('text=Score: 85%')).toBeVisible();
    await expect(page.locator('text=🎬 Replay Mode')).toBeVisible();
  });
});
```

**Cleanup Requirements**:
- ✅ Track session ID immediately after creation
- ✅ Delete session in `afterAll` hook
- ✅ Individual try-catch per deletion
- ✅ Continue cleanup even if one fails
- ✅ Log success/failure for each operation

**Success Criteria**:
- Page loads within 2 seconds
- Session metadata displays correctly
- No JavaScript errors in console
- **Session deleted after test completes**

---

### 1.2 Message Input Hidden in Replay Mode

**Test**: "should hide message input box in replay mode"
```typescript
test('should hide message input box in replay mode', async ({ page }) => {
  // Given: A session replay page is loaded
  const sessionId = await createTestSession({
    status: 'completed',
    conversationHistory: compressedTestHistory
  });
  createdSessionIds.push(sessionId); // Track for cleanup

  await page.goto(`/sessions/${sessionId}/view`);

  // Then: Message composer is not visible
  await expect(page.locator('[data-testid="composer"]')).not.toBeVisible();
  await expect(page.locator('textarea[placeholder*="Type"]')).not.toBeVisible();

  // And: Replay mode notice is shown
  await expect(page.locator('text=🎬 Replay Mode')).toBeVisible();
  await expect(page.locator('text=read-only view')).toBeVisible();

  // Note: Session cleanup happens in afterAll hook
});
```

**Cleanup Requirements**:
- ✅ No per-test cleanup needed (batch cleanup in `afterAll`)
- ✅ Track ID in shared array
- ✅ Cleanup is idempotent (safe to run multiple times)

---

### 1.3 Conversation History Display

**Test**: "should display all messages from conversation history in correct order"
```typescript
test('should display all messages from conversation history', async ({ page }) => {
  // Given: A session with 10 messages (alternating user/assistant)
  const testHistory = createTestConversationHistory(10);
  const compressed = await compressConversationHistory(testHistory);

  const sessionId = await createTestSession({
    status: 'completed',
    conversationHistory: compressed
  });
  createdSessionIds.push(sessionId);

  // When: Load replay page
  await page.goto(`/sessions/${sessionId}/view`);

  // Then: All 10 messages are visible
  const messages = page.locator('[data-message-role]');
  await expect(messages).toHaveCount(10);

  // And: Messages are in chronological order
  const firstMessage = messages.nth(0);
  await expect(firstMessage).toHaveAttribute('data-message-role', 'user');
  await expect(firstMessage).toContainText('First test message');

  const lastMessage = messages.nth(9);
  await expect(lastMessage).toHaveAttribute('data-message-role', 'assistant');
});
```

**Cleanup Requirements**:
- ✅ Compressed history is stored in session document
- ✅ No separate history document to clean
- ✅ Deleting session automatically removes history

---

### 1.4 Lesson Card Rendering in Replay Mode

**Test**: "should render lesson cards in read-only mode"
```typescript
test('should render lesson cards in read-only mode', async ({ page }) => {
  // Given: A session with lesson card interactions
  const historyWithCards = createHistoryWithLessonCards();
  const compressed = await compressConversationHistory(historyWithCards);

  const sessionId = await createTestSession({
    status: 'completed',
    conversationHistory: compressed
  });
  createdSessionIds.push(sessionId);

  // When: Load replay page
  await page.goto(`/sessions/${sessionId}/view`);

  // Then: Lesson cards are visible but not interactive
  const lessonCard = page.locator('[data-testid="lesson-card"]').first();
  await expect(lessonCard).toBeVisible();

  // And: Submit button is disabled or hidden
  const submitButton = lessonCard.locator('button:has-text("Submit")');
  await expect(submitButton).toBeDisabled();
});
```

---

### 1.5 Navigation and Controls

**Test**: "should navigate back to history list"
```typescript
test('should navigate back to history list', async ({ page }) => {
  // Given: On replay page
  const sessionId = await createTestSession({
    status: 'completed',
    conversationHistory: compressedTestHistory
  });
  createdSessionIds.push(sessionId);

  await page.goto(`/sessions/${sessionId}/view`);

  // When: Click "Back to History" button
  await page.click('text=Back to History');

  // Then: Navigate to history list page
  await expect(page).toHaveURL(/\/lessons\/.*\/history/);
});
```

**E2E Cleanup Best Practices**:
```typescript
// ✅ DO: Batch cleanup in afterAll
afterAll(async () => {
  await Promise.all(sessionIds.map(id => deleteSession(id)));
});

// ❌ DON'T: Clean up after each test (slow)
afterEach(async () => {
  await deleteSession(lastSessionId); // Adds 1-2s per test
});
```

---

## 2. Integration Tests (Jest + Appwrite)

### Test File: `tests/integration/session-history-persistence.test.ts`

#### Priority: P0 (Data Integrity)

### 2.1 Conversation History Compression

**Test**: "should compress conversation history to under 50KB"
```typescript
describe('Session History Persistence Integration Tests', () => {
  let createdSessionIds: string[] = [];
  let sessionDriver: SessionDriver;
  let testAuth: TestAuth;

  beforeAll(async () => {
    testAuth = new TestAuth();
    await testAuth.initialize();
    sessionDriver = createDriver(SessionDriver);
  });

  afterAll(async () => {
    console.log('🧹 Starting integration test cleanup...');
    const cleanupErrors: Error[] = [];

    try {
      // Clean up sessions first
      await Promise.all(createdSessionIds.map(async (sessionId) => {
        try {
          await sessionDriver.deleteSession(sessionId);
          console.log(`✅ Deleted session: ${sessionId}`);
        } catch (error) {
          const err = new Error(`Failed to delete session ${sessionId}: ${error.message}`);
          cleanupErrors.push(err);
          console.error(`❌ ${err.message}`);
        }
      }));

      // Clean up test users last (dependency order)
      await testAuth.cleanupTestUsers();
      console.log('✅ Test user cleanup completed');

      // Report cleanup summary
      if (cleanupErrors.length > 0) {
        console.warn(`⚠️  Cleanup completed with ${cleanupErrors.length} errors`);
        cleanupErrors.forEach(err => console.error(`  - ${err.message}`));
      } else {
        console.log('✅ All integration test cleanup successful');
      }
    } catch (error) {
      console.error('❌ Critical cleanup failure:', error);
    }
  });

  test('should compress conversation history to under 50KB', async () => {
    // Given: A large conversation history (100 messages)
    const largeHistory = createLargeConversationHistory(100);
    const uncompressedSize = JSON.stringify(largeHistory).length;

    // When: Compress history
    const compressed = await compressConversationHistory(largeHistory);

    // Then: Compressed data is under 50KB
    expect(compressed.length).toBeLessThan(50 * 1024);
    expect(compressed.length).toBeLessThan(uncompressedSize);

    // And: Compression ratio is reasonable (>50%)
    const compressionRatio = compressed.length / uncompressedSize;
    expect(compressionRatio).toBeLessThan(0.5);

    // No session created, no cleanup needed for this test
  });
});
```

**Cleanup Requirements**:
- ✅ Track session IDs in array
- ✅ Delete sessions before users (dependency order)
- ✅ Collect all errors (don't fail fast)
- ✅ Report cleanup summary
- ✅ Use shared test user (don't delete)

---

### 2.2 Conversation History Decompression

**Test**: "should decompress history without data loss"
```typescript
test('should decompress history without data loss', async () => {
  // Given: Original conversation history
  const original = createTestConversationHistory(20);

  // When: Compress and then decompress
  const compressed = await compressConversationHistory(original);
  const decompressed = await decompressConversationHistory(compressed);

  // Then: Decompressed matches original exactly
  expect(decompressed).toEqual(original);
  expect(decompressed.messages.length).toBe(original.messages.length);

  // And: All message properties are preserved
  expect(decompressed.messages[0]).toEqual(original.messages[0]);
  expect(decompressed.thread_id).toBe(original.thread_id);
  expect(decompressed.created_at).toBe(original.created_at);

  // No database interaction, no cleanup needed
});
```

---

### 2.3 Session Retrieval with History

**Test**: "should retrieve session with decompressed history"
```typescript
test('should retrieve session with decompressed history', async () => {
  // Given: A session with compressed history in database
  const testHistory = createTestConversationHistory(10);
  const compressed = await compressConversationHistory(testHistory);

  const session = await sessionDriver.createSession({
    studentId: testAuth.currentUser!.id,
    lessonTemplateId: 'test-lesson-001',
    status: 'completed',
    conversationHistory: compressed
  });

  // Track for cleanup
  createdSessionIds.push(session.$id);

  // When: Retrieve session using SessionDriver
  const result = await sessionDriver.getSessionWithHistory(session.$id);

  // Then: Returns session and decompressed history
  expect(result.session.$id).toBe(session.$id);
  expect(result.history).toBeDefined();
  expect(result.history.messages.length).toBe(10);
  expect(result.history.messages[0].content).toBeDefined();

  // Cleanup happens in afterAll hook
});
```

**Cleanup Requirements**:
- ✅ Session created in test → tracked immediately
- ✅ Cleanup in `afterAll` (not `afterEach`)
- ✅ Deletion includes conversation history automatically

---

### 2.4 Error Handling for Missing History

**Test**: "should handle sessions without conversation history gracefully"
```typescript
test('should handle sessions without conversation history', async () => {
  // Given: A session with null conversation history
  const session = await sessionDriver.createSession({
    studentId: testAuth.currentUser!.id,
    lessonTemplateId: 'test-lesson-002',
    status: 'abandoned',
    conversationHistory: null
  });

  createdSessionIds.push(session.$id);

  // When: Retrieve session
  const result = await sessionDriver.getSessionWithHistory(session.$id);

  // Then: Returns session with null history (no error thrown)
  expect(result.session.$id).toBe(session.$id);
  expect(result.history).toBeNull();
});
```

---

### 2.5 Error Handling for Corrupted Data

**Test**: "should throw error for corrupted compressed data"
```typescript
test('should throw error for corrupted compressed data', async () => {
  // Given: Session with corrupted base64 data
  const session = await sessionDriver.createSession({
    studentId: testAuth.currentUser!.id,
    lessonTemplateId: 'test-lesson-003',
    status: 'completed',
    conversationHistory: "INVALID_BASE64_DATA!!!"
  });

  createdSessionIds.push(session.$id);

  // When: Attempt to retrieve and decompress
  // Then: Should throw clear error
  await expect(
    sessionDriver.getSessionWithHistory(session.$id)
  ).rejects.toThrow(/decompression failed|invalid data/i);

  // Cleanup happens in afterAll
});
```

**Integration Test Cleanup Pattern Summary**:
```typescript
// Resource tracking
let createdResourceIds: {
  sessions: string[];
  evidence: string[];
  mastery: string[];
} = {
  sessions: [],
  evidence: [],
  mastery: []
};

// Cleanup in dependency order
afterAll(async () => {
  const errors: Error[] = [];

  // 1. Evidence (no dependencies)
  for (const id of createdResourceIds.evidence) {
    try {
      await evidenceDriver.deleteEvidence(id);
    } catch (error) {
      errors.push(new Error(`Evidence ${id}: ${error}`));
    }
  }

  // 2. Mastery (depends on evidence)
  for (const id of createdResourceIds.mastery) {
    try {
      await masteryDriver.deleteMasteryV2(studentId, courseId);
    } catch (error) {
      errors.push(new Error(`Mastery ${id}: ${error}`));
    }
  }

  // 3. Sessions (may reference evidence/mastery)
  for (const id of createdResourceIds.sessions) {
    try {
      await sessionDriver.deleteSession(id);
    } catch (error) {
      errors.push(new Error(`Session ${id}: ${error}`));
    }
  }

  // 4. Users last (everything depends on users)
  await testAuth.cleanupTestUsers();

  // Report
  if (errors.length > 0) {
    console.warn(`Cleanup errors: ${errors.length}`);
    errors.forEach(e => console.error(e.message));
  }
});
```

---

## 3. Component Unit Tests (Jest + React Testing Library)

### Test File: `components/__tests__/SessionReplayPage.test.tsx`

#### Priority: P1 (UI Behavior)

### 3.1 Replay Mode Context Propagation

**Test**: "should provide replay mode context to child components"
```typescript
describe('Session Replay Page Component Tests', () => {
  // No database interaction → No cleanup needed
  // Only testing React component rendering

  test('should provide replay mode context to child components', () => {
    // Given: Session replay page component
    const { unmount } = render(
      <SessionReplayPage sessionId="test123" />
    );

    // When: Child component checks replay mode
    const { result } = renderHook(() => useReplayMode());

    // Then: isReplayMode is true
    expect(result.current.isReplayMode).toBe(true);

    // Cleanup: Unmount component (automatic by testing-library)
    unmount();
  });
});
```

**Cleanup Requirements**:
- ✅ No database cleanup needed (component tests only)
- ✅ React Testing Library auto-unmounts components
- ✅ No memory leaks if tests follow cleanup-after-each pattern

---

### 3.2 Thread Component Replay Mode Rendering

**Test**: "should hide composer and show replay notice"
```typescript
test('Thread component should hide composer in replay mode', () => {
  // Given: Thread component with replay mode enabled
  const { container, unmount } = render(
    <ReplayModeProvider isReplayMode={true}>
      <Thread />
    </ReplayModeProvider>
  );

  // Then: Composer is not rendered
  expect(container.querySelector('[data-testid="composer"]')).toBeNull();

  // And: Replay notice is visible
  expect(screen.getByText(/🎬 Replay Mode/i)).toBeInTheDocument();
  expect(screen.getByText(/read-only view/i)).toBeInTheDocument();

  // Cleanup
  unmount();
});
```

**Component Test Cleanup Notes**:
- No manual cleanup needed for component tests
- React Testing Library cleans up automatically
- Use `unmount()` explicitly if testing cleanup behavior
- No database state to clean

---

### 3.3 Tool Components Disable Interactions

**Test**: "should disable all tool component interactions in replay mode"
```typescript
test('LessonCardPresentationTool should disable interactions', () => {
  // Given: Lesson card in replay mode
  const { unmount } = render(
    <ReplayModeProvider isReplayMode={true}>
      <LessonCardPresentationTool args={testCardArgs} />
    </ReplayModeProvider>
  );

  // Then: Submit button is disabled
  const submitButton = screen.getByRole('button', { name: /submit/i });
  expect(submitButton).toBeDisabled();

  // And: Input is read-only
  const input = screen.getByRole('textbox');
  expect(input).toHaveAttribute('readonly');

  unmount();
});
```

---

## 4. Security Tests

### Test File: `tests/integration/session-security.test.ts`

#### Priority: P0 (Critical Security)

### 4.1 Unauthorized Session Access

**Test**: "should prevent access to other students' sessions"
```typescript
describe('Session Security Tests', () => {
  let studentASessionId: string;
  let studentBSessionId: string;
  let testAuthA: TestAuth;
  let testAuthB: TestAuth;

  beforeAll(async () => {
    testAuthA = new TestAuth();
    testAuthB = new TestAuth();
    await testAuthA.initialize();
    await testAuthB.initialize();
  });

  afterAll(async () => {
    console.log('🧹 Starting security test cleanup...');

    try {
      // Clean up both students' sessions
      if (studentASessionId) {
        try {
          await sessionDriver.deleteSession(studentASessionId);
          console.log(`✅ Deleted student A session: ${studentASessionId}`);
        } catch (error) {
          console.error(`❌ Failed to delete student A session:`, error);
        }
      }

      if (studentBSessionId) {
        try {
          await sessionDriver.deleteSession(studentBSessionId);
          console.log(`✅ Deleted student B session: ${studentBSessionId}`);
        } catch (error) {
          console.error(`❌ Failed to delete student B session:`, error);
        }
      }

      // Clean up test users
      await testAuthA.cleanupTestUsers();
      await testAuthB.cleanupTestUsers();
      console.log('✅ Security test cleanup completed');
    } catch (error) {
      console.error('❌ Security test cleanup failed:', error);
    }
  });

  test('should return 403 for unauthorized session access', async () => {
    // Given: Student A creates a session
    const sessionA = await sessionDriver.createSession({
      studentId: testAuthA.currentUser!.id,
      lessonTemplateId: 'test-lesson-security-001',
      status: 'completed'
    });
    studentASessionId = sessionA.$id;

    // When: Student B tries to access Student A's session
    // Then: Access is denied
    await expect(
      sessionDriver.getSessionWithHistory(
        studentASessionId,
        testAuthB.currentUser!.id
      )
    ).rejects.toThrow(/unauthorized|forbidden|403/i);
  });
});
```

**Security Test Cleanup Requirements**:
- ✅ Track sessions for BOTH test users
- ✅ Clean up all sessions before users
- ✅ Don't fail test if cleanup fails (log only)
- ✅ Verify no data leaks during cleanup

---

### 4.2 Session ID Enumeration Prevention

**Test**: "should not reveal session existence for invalid IDs"
```typescript
test('should return same error for non-existent and unauthorized sessions', async () => {
  // Given: Student B creates a session
  const sessionB = await sessionDriver.createSession({
    studentId: testAuthB.currentUser!.id,
    lessonTemplateId: 'test-lesson-security-002',
    status: 'completed'
  });
  studentBSessionId = sessionB.$id;

  // When: Student A tries to access non-existent session
  const nonExistentError = await expectRejection(
    sessionDriver.getSessionWithHistory('FAKE_SESSION_ID', testAuthA.currentUser!.id)
  );

  // And: Student A tries to access Student B's session
  const unauthorizedError = await expectRejection(
    sessionDriver.getSessionWithHistory(studentBSessionId, testAuthA.currentUser!.id)
  );

  // Then: Error messages are generic (prevent enumeration)
  expect(nonExistentError.message).toBe(unauthorizedError.message);
  expect(nonExistentError.message).toMatch(/not found|unauthorized/i);
});
```

---

## 5. Performance Tests

### Test File: `tests/integration/session-replay-performance.test.ts`

#### Priority: P1 (User Experience)

### 5.1 Large History Loading Time

**Test**: "should load large conversation history within acceptable time"
```typescript
describe('Session Replay Performance Tests', () => {
  let createdSessionIds: string[] = [];

  afterAll(async () => {
    console.log('🧹 Cleaning up performance test sessions...');

    // Use timeout for large data cleanup
    const cleanupWithTimeout = async (sessionId: string, timeoutMs: number = 10000) => {
      return Promise.race([
        sessionDriver.deleteSession(sessionId),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Cleanup timeout')), timeoutMs)
        )
      ]);
    };

    const cleanupPromises = createdSessionIds.map(async (sessionId) => {
      try {
        await cleanupWithTimeout(sessionId, 10000);
        console.log(`✅ Deleted large session: ${sessionId}`);
      } catch (error) {
        console.error(`❌ Failed to delete session ${sessionId}:`, error);
      }
    });

    await Promise.all(cleanupPromises);
    console.log('✅ Performance test cleanup completed');
  });

  test('should load 100-message history within 3 seconds', async ({ page }) => {
    // Given: Session with 100 messages
    const largeHistory = createLargeConversationHistory(100);
    const compressed = await compressConversationHistory(largeHistory);

    const session = await sessionDriver.createSession({
      studentId: testAuth.currentUser!.id,
      lessonTemplateId: 'test-lesson-perf-001',
      status: 'completed',
      conversationHistory: compressed
    });

    createdSessionIds.push(session.$id);

    // When: Load replay page
    const startTime = Date.now();
    await page.goto(`/sessions/${session.$id}/view`);
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    // Then: Page loads within 3 seconds
    expect(loadTime).toBeLessThan(3000);

    // And: All messages are rendered
    const messages = page.locator('[data-message-role]');
    await expect(messages).toHaveCount(100);
  });
});
```

**Performance Test Cleanup Requirements**:
- ✅ Use timeout protection for cleanup (large data can be slow)
- ✅ Don't let cleanup hang indefinitely
- ✅ Log if cleanup exceeds expected time
- ✅ Parallel cleanup for multiple large sessions

---

### 5.2 Memory Usage During Decompression

**Test**: "should not exceed memory limits during decompression"
```typescript
test('should decompress without excessive memory usage', async () => {
  // Given: Near-maximum compressed data (45KB)
  const largeCompressed = createLargeCompressedHistory(45 * 1024);

  const session = await sessionDriver.createSession({
    studentId: testAuth.currentUser!.id,
    lessonTemplateId: 'test-lesson-perf-002',
    status: 'completed',
    conversationHistory: largeCompressed
  });

  createdSessionIds.push(session.$id);

  // When: Monitor memory during decompression
  const memBefore = process.memoryUsage().heapUsed;
  const result = await sessionDriver.getSessionWithHistory(session.$id);
  const memAfter = process.memoryUsage().heapUsed;

  // Then: Memory increase is reasonable (<100MB)
  const memIncrease = memAfter - memBefore;
  expect(memIncrease).toBeLessThan(100 * 1024 * 1024);

  // Verify decompression succeeded
  expect(result.history).toBeDefined();
  expect(result.history!.messages.length).toBeGreaterThan(0);
});
```

---

## 13. Test Data Cleanup Infrastructure

### Overview

Based on existing codebase patterns in `EvidenceDriver.test.ts`, `MasteryDriver.test.ts`, and `session-completion.test.ts`, we follow these proven cleanup patterns.

### 13.1 Core Cleanup Principles

1. **Track Everything**: Maintain arrays of created resource IDs
2. **Clean in Dependency Order**: Delete child resources before parents
3. **Fail Gracefully**: Individual failures don't stop overall cleanup
4. **Log Extensively**: Clear status for each operation (✅/⚠️/❌)
5. **Batch Operations**: Use `Promise.all()` for parallel cleanup
6. **Timeout Protection**: Don't hang on slow operations

### 13.2 Resource Dependency Graph

```
Users (root)
  └─> Sessions
       ├─> Conversation History (embedded in session)
       ├─> Evidence Records
       └─> Mastery Records
            └─> Course Outcomes
```

**Cleanup Order**: Evidence → Mastery → Sessions → Users

### 13.3 ID Tracking Pattern

```typescript
// Declare at test suite level
let createdResourceIds: {
  sessions: string[];
  evidence: string[];
  mastery: string[];
  outcomes: string[];
} = {
  sessions: [],
  evidence: [],
  mastery: [],
  outcomes: []
};

// Track immediately after creation
test('example test', async () => {
  const session = await sessionDriver.createSession({...});
  createdResourceIds.sessions.push(session.$id); // ← Track immediately

  // ... rest of test
});
```

### 13.4 Error Collection Pattern

```typescript
afterAll(async () => {
  const cleanupErrors: Array<{ resource: string; error: Error }> = [];

  // Attempt all cleanups, collect errors
  await Promise.all(createdResourceIds.sessions.map(async (id) => {
    try {
      await sessionDriver.deleteSession(id);
      console.log(`✅ Deleted session: ${id}`);
    } catch (error) {
      cleanupErrors.push({
        resource: `session:${id}`,
        error: error as Error
      });
      console.error(`❌ Failed to delete session ${id}:`, error);
    }
  }));

  // Report summary
  if (cleanupErrors.length > 0) {
    console.warn(`⚠️  Cleanup completed with ${cleanupErrors.length} errors`);
    cleanupErrors.forEach(({ resource, error }) => {
      console.error(`  - ${resource}: ${error.message}`);
    });
  } else {
    console.log('✅ All cleanup successful');
  }
});
```

### 13.5 Cleanup with Timeout Protection

```typescript
/**
 * Cleanup utility with timeout protection for large data operations
 */
async function cleanupWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number = 10000,
  resourceName: string
): Promise<{ success: boolean; error?: Error }> {
  try {
    await Promise.race([
      operation(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Cleanup timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
    return { success: true };
  } catch (error) {
    console.error(`❌ Cleanup failed for ${resourceName}:`, error);
    return { success: false, error: error as Error };
  }
}

// Usage
await cleanupWithTimeout(
  () => sessionDriver.deleteSession(largeSessionId),
  15000, // 15 second timeout for large sessions
  `session:${largeSessionId}`
);
```

---

## 14. Cleanup Patterns by Test Type

### 14.1 E2E Tests (Playwright)

**Characteristics**:
- Create full sessions with compressed histories
- May create browser state (cookies, localStorage)
- Performance-sensitive (cleanup should be fast)

**Recommended Pattern**:
```typescript
describe('E2E Test Suite', () => {
  let sessionIds: string[] = [];

  afterAll(async () => {
    console.log(`🧹 Cleaning up ${sessionIds.length} E2E test sessions...`);

    // Parallel cleanup for speed
    await Promise.all(sessionIds.map(async (id) => {
      try {
        await databases.deleteDocument(
          TEST_CONFIG.databaseId,
          TEST_CONFIG.sessionCollectionId,
          id
        );
        console.log(`✅ Deleted: ${id}`);
      } catch (error) {
        // Log but don't throw
        console.error(`❌ Failed: ${id}`, error);
      }
    }));

    console.log('✅ E2E cleanup complete');
  });

  test('example', async ({ page }) => {
    const sessionId = await createTestSession({...});
    sessionIds.push(sessionId); // ← Track immediately

    await page.goto(`/sessions/${sessionId}/view`);
    // ... assertions
  });
});
```

**Key Points**:
- Use `afterAll` (not `afterEach`) for performance
- Parallel cleanup with `Promise.all()`
- Don't fail tests due to cleanup errors
- Browser state cleaned automatically by Playwright

---

### 14.2 Integration Tests (Jest + Appwrite)

**Characteristics**:
- Direct database operations
- Multiple resource types (sessions, evidence, mastery)
- Complex dependencies between resources

**Recommended Pattern**:
```typescript
describe('Integration Test Suite', () => {
  let resources = {
    sessions: [] as string[],
    evidence: [] as string[],
    mastery: [] as string[]
  };

  let drivers: {
    session: SessionDriver;
    evidence: EvidenceDriver;
    mastery: MasteryDriver;
  };

  beforeAll(async () => {
    // Initialize drivers
    drivers = {
      session: createDriver(SessionDriver),
      evidence: createDriver(EvidenceDriver),
      mastery: createDriver(MasteryDriver)
    };
  });

  afterAll(async () => {
    console.log('🧹 Starting integration cleanup...');
    const errors: Error[] = [];

    // Clean in dependency order (children first)

    // 1. Evidence (no dependencies)
    for (const id of resources.evidence) {
      try {
        await drivers.evidence.deleteEvidence(id);
        console.log(`✅ Deleted evidence: ${id}`);
      } catch (error) {
        errors.push(new Error(`Evidence ${id}: ${error}`));
      }
    }

    // 2. Mastery (may reference evidence)
    for (const id of resources.mastery) {
      try {
        await drivers.mastery.deleteMasteryV2(studentId, courseId);
        console.log(`✅ Deleted mastery: ${id}`);
      } catch (error) {
        errors.push(new Error(`Mastery ${id}: ${error}`));
      }
    }

    // 3. Sessions (references everything)
    for (const id of resources.sessions) {
      try {
        await drivers.session.deleteSession(id);
        console.log(`✅ Deleted session: ${id}`);
      } catch (error) {
        errors.push(new Error(`Session ${id}: ${error}`));
      }
    }

    // Report
    if (errors.length > 0) {
      console.warn(`⚠️  ${errors.length} cleanup errors occurred`);
      errors.forEach(err => console.error(`  - ${err.message}`));
    } else {
      console.log('✅ Integration cleanup successful');
    }
  });

  test('example', async () => {
    const session = await drivers.session.createSession({...});
    resources.sessions.push(session.$id); // ← Track

    // ... test logic
  });
});
```

**Key Points**:
- Clean in reverse dependency order
- Sequential cleanup (not parallel) to respect dependencies
- Collect all errors before reporting
- Use driver abstraction for cleaner code

---

### 14.3 Component Tests (React Testing Library)

**Characteristics**:
- No database interaction
- Only component mounting/unmounting
- Memory cleanup handled automatically

**Recommended Pattern**:
```typescript
describe('Component Test Suite', () => {
  // No manual cleanup needed!

  test('example', () => {
    const { unmount } = render(<SessionReplayPage sessionId="test" />);

    // ... assertions

    // Optional: Explicit unmount if testing cleanup behavior
    unmount();
  });

  // React Testing Library automatically unmounts after each test
});
```

**Key Points**:
- No database cleanup needed
- React Testing Library cleans up automatically
- Use `unmount()` only if testing cleanup behavior
- Watch for memory leaks in event listeners

---

### 14.4 Security Tests

**Characteristics**:
- Multiple test users
- Cross-user resource access attempts
- Need to clean up resources for ALL users

**Recommended Pattern**:
```typescript
describe('Security Test Suite', () => {
  let testUsers: TestAuth[] = [];
  let allSessionIds: string[] = [];

  beforeAll(async () => {
    // Create multiple test users
    testUsers = [
      new TestAuth(),
      new TestAuth()
    ];

    await Promise.all(testUsers.map(auth => auth.initialize()));
  });

  afterAll(async () => {
    console.log('🧹 Security test cleanup...');

    // Clean up all sessions (from all users)
    await Promise.all(allSessionIds.map(async (id) => {
      try {
        await sessionDriver.deleteSession(id);
        console.log(`✅ Deleted: ${id}`);
      } catch (error) {
        console.error(`❌ Failed: ${id}`, error);
      }
    }));

    // Clean up all test users
    await Promise.all(testUsers.map(auth => auth.cleanupTestUsers()));

    console.log('✅ Security cleanup complete');
  });

  test('unauthorized access', async () => {
    // User A creates session
    const sessionA = await sessionDriver.createSession({
      studentId: testUsers[0].currentUser!.id,
      ...
    });
    allSessionIds.push(sessionA.$id); // ← Track for cleanup

    // User B tries to access (should fail)
    await expect(
      sessionDriver.getSessionWithHistory(sessionA.$id, testUsers[1].currentUser!.id)
    ).rejects.toThrow(/unauthorized/i);
  });
});
```

**Key Points**:
- Track sessions from ALL test users in single array
- Clean up sessions before users
- Don't delete shared test users (reused across tests)
- Parallel cleanup safe for security tests

---

### 14.5 Performance Tests

**Characteristics**:
- Large data volumes (100+ messages, 45KB+ compressed)
- Cleanup may be slow
- Need timeout protection

**Recommended Pattern**:
```typescript
describe('Performance Test Suite', () => {
  let largeSessionIds: string[] = [];

  afterAll(async () => {
    console.log(`🧹 Cleaning up ${largeSessionIds.length} large sessions...`);

    const cleanupResults = await Promise.all(
      largeSessionIds.map(async (id) => {
        try {
          // Use timeout protection for large data
          await Promise.race([
            sessionDriver.deleteSession(id),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), 15000)
            )
          ]);
          console.log(`✅ Deleted large session: ${id}`);
          return { id, success: true };
        } catch (error) {
          console.error(`❌ Failed (or timeout) for ${id}:`, error);
          return { id, success: false, error };
        }
      })
    );

    const failures = cleanupResults.filter(r => !r.success);
    if (failures.length > 0) {
      console.warn(`⚠️  ${failures.length} large sessions failed cleanup`);
      console.warn('Consider manual cleanup:', failures.map(f => f.id));
    }

    console.log('✅ Performance cleanup complete');
  });

  test('large history', async () => {
    const largeHistory = createLargeConversationHistory(100);
    const compressed = await compressConversationHistory(largeHistory);

    const session = await sessionDriver.createSession({
      conversationHistory: compressed,
      ...
    });

    largeSessionIds.push(session.$id); // ← Track

    // ... performance assertions
  });
});
```

**Key Points**:
- Use timeout protection (15s for large data)
- Log timeout failures separately
- Consider manual cleanup instructions for failures
- Parallel cleanup with Promise.all() still safe

---

## 15. Cleanup Utilities and Helpers

### File: `tests/utils/cleanup-helpers.ts`

```typescript
import { databases } from '@/lib/appwrite';
import { TEST_CONFIG } from './test-config';

/**
 * Test resource tracker for comprehensive cleanup
 */
export class TestResourceTracker {
  private resources: Map<string, string[]>;
  private cleanupErrors: Array<{ resource: string; error: Error }>;

  constructor() {
    this.resources = new Map([
      ['sessions', []],
      ['evidence', []],
      ['mastery', []],
      ['outcomes', []]
    ]);
    this.cleanupErrors = [];
  }

  /**
   * Track a resource for cleanup
   */
  track(type: 'session' | 'evidence' | 'mastery' | 'outcome', id: string): void {
    const key = `${type}s`; // Pluralize
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
   */
  async cleanup(): Promise<CleanupResult> {
    console.log('🧹 Starting comprehensive cleanup...');
    const startTime = Date.now();

    // Clean in dependency order
    await this.cleanupEvidence();
    await this.cleanupMastery();
    await this.cleanupSessions();
    await this.cleanupOutcomes();

    const duration = Date.now() - startTime;
    const result: CleanupResult = {
      totalResources: this.getTotalResourceCount(),
      cleaned: this.getTotalResourceCount() - this.cleanupErrors.length,
      errors: this.cleanupErrors,
      durationMs: duration
    };

    // Report
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

  private async cleanupEvidence(): Promise<void> {
    const evidence = this.resources.get('evidence') || [];

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
      }
    }));
  }

  private async cleanupMastery(): Promise<void> {
    const mastery = this.resources.get('mastery') || [];

    // Mastery cleanup is query-based (studentId + courseId)
    // Implementation depends on MasteryDriver pattern
    for (const id of mastery) {
      try {
        // Custom cleanup logic here
        console.log(`✅ Deleted mastery: ${id}`);
      } catch (error) {
        this.cleanupErrors.push({
          resource: `mastery:${id}`,
          error: error as Error
        });
      }
    }
  }

  private async cleanupSessions(): Promise<void> {
    const sessions = this.resources.get('sessions') || [];

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
      }
    }));
  }

  private async cleanupOutcomes(): Promise<void> {
    const outcomes = this.resources.get('outcomes') || [];

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
      }
    }));
  }

  private getTotalResourceCount(): number {
    return Array.from(this.resources.values())
      .reduce((sum, arr) => sum + arr.length, 0);
  }
}

export interface CleanupResult {
  totalResources: number;
  cleaned: number;
  errors: Array<{ resource: string; error: Error }>;
  durationMs: number;
}

/**
 * Verify that cleanup succeeded by attempting to fetch deleted resources
 */
export async function verifyCleanup(
  collectionId: string,
  resourceIds: string[]
): Promise<{ verified: boolean; remaining: string[] }> {
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
      console.log(`✅ Verified deleted: ${id}`);
    }
  }));

  const verified = remaining.length === 0;
  if (verified) {
    console.log('✅ Cleanup verification passed');
  } else {
    console.error(`❌ Cleanup verification failed: ${remaining.length} resources remain`);
  }

  return { verified, remaining };
}

/**
 * Cleanup with timeout protection
 */
export async function cleanupWithTimeout(
  operation: () => Promise<void>,
  timeoutMs: number = 10000,
  resourceName: string
): Promise<{ success: boolean; error?: Error; timedOut?: boolean }> {
  try {
    await Promise.race([
      operation(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Cleanup timeout after ${timeoutMs}ms`)),
          timeoutMs
        )
      )
    ]);
    return { success: true };
  } catch (error) {
    const timedOut = error.message.includes('timeout');
    console.error(`❌ Cleanup ${timedOut ? 'timeout' : 'failed'} for ${resourceName}:`, error);
    return {
      success: false,
      error: error as Error,
      timedOut
    };
  }
}

/**
 * Batch delete with progress reporting
 */
export async function batchDelete(
  collectionId: string,
  documentIds: string[],
  batchSize: number = 10
): Promise<{ deleted: number; failed: number; errors: Error[] }> {
  console.log(`🗑️  Batch deleting ${documentIds.length} documents...`);

  const errors: Error[] = [];
  let deleted = 0;

  // Process in batches to avoid overwhelming Appwrite
  for (let i = 0; i < documentIds.length; i += batchSize) {
    const batch = documentIds.slice(i, i + batchSize);

    await Promise.all(batch.map(async (id) => {
      try {
        await databases.deleteDocument(TEST_CONFIG.databaseId, collectionId, id);
        deleted++;
      } catch (error) {
        errors.push(error as Error);
      }
    }));

    console.log(`  Progress: ${Math.min(i + batchSize, documentIds.length)}/${documentIds.length}`);
  }

  console.log(`✅ Batch delete complete: ${deleted}/${documentIds.length} succeeded`);

  return {
    deleted,
    failed: errors.length,
    errors
  };
}
```

### Usage Example

```typescript
import { TestResourceTracker, verifyCleanup } from '@/tests/utils/cleanup-helpers';

describe('Example Test Suite', () => {
  let tracker: TestResourceTracker;

  beforeAll(() => {
    tracker = new TestResourceTracker();
  });

  afterAll(async () => {
    const result = await tracker.cleanup();

    // Verify cleanup succeeded
    if (result.errors.length === 0) {
      const sessionIds = tracker.getTracked('sessions');
      await verifyCleanup(TEST_CONFIG.sessionCollectionId, sessionIds);
    }
  });

  test('example', async () => {
    const session = await createTestSession({...});
    tracker.track('session', session.$id); // ← Easy tracking

    // ... test logic
  });
});
```

---

## 16. Cleanup Verification and Monitoring

### 16.1 Post-Cleanup Verification

After cleanup completes, verify that resources were actually deleted:

```typescript
afterAll(async () => {
  // 1. Perform cleanup
  await tracker.cleanup();

  // 2. Verify deletion
  const { verified, remaining } = await verifyCleanup(
    TEST_CONFIG.sessionCollectionId,
    sessionIds
  );

  // 3. Handle verification failure
  if (!verified) {
    console.error(`❌ Cleanup verification failed!`);
    console.error(`Remaining resources: ${remaining.join(', ')}`);

    // Optional: Attempt force cleanup
    for (const id of remaining) {
      try {
        await databases.deleteDocument(TEST_CONFIG.databaseId, collectionId, id);
        console.log(`✅ Force deleted: ${id}`);
      } catch (error) {
        console.error(`❌ Force delete failed: ${id}`, error);
      }
    }
  }
});
```

### 16.2 Cleanup Metrics

Track cleanup performance over time:

```typescript
interface CleanupMetrics {
  timestamp: string;
  testSuite: string;
  resourceCount: number;
  durationMs: number;
  errors: number;
}

const cleanupMetrics: CleanupMetrics[] = [];

afterAll(async () => {
  const startTime = Date.now();
  const result = await tracker.cleanup();

  cleanupMetrics.push({
    timestamp: new Date().toISOString(),
    testSuite: expect.getState().testPath || 'unknown',
    resourceCount: result.totalResources,
    durationMs: result.durationMs,
    errors: result.errors.length
  });

  // Log aggregated metrics
  console.log('📊 Cleanup Metrics Summary:');
  console.log(`  Total test runs: ${cleanupMetrics.length}`);
  console.log(`  Avg cleanup time: ${avgCleanupTime()}ms`);
  console.log(`  Total errors: ${totalErrors()}`);
});
```

### 16.3 CI/CD Integration

Add cleanup verification to CI pipeline:

```bash
# In CI pipeline (e.g., .github/workflows/test.yml)

- name: Run tests
  run: npm test

- name: Verify test database cleanup
  run: |
    # Check for orphaned test data
    node scripts/verify-test-cleanup.js

    # Fail CI if test data remains
    if [ $? -ne 0 ]; then
      echo "❌ Test data not cleaned up properly"
      exit 1
    fi
```

Script: `scripts/verify-test-cleanup.js`
```javascript
// Connect to test database
// Query for test data (e.g., sessions with test prefix)
// Report any remaining test data
// Exit with code 1 if data found
```

---

## Appendix C: Cleanup Troubleshooting Guide

### Problem: Cleanup Hangs on Large Sessions

**Symptoms**:
- `afterAll` hook times out
- Large sessions (45KB+ compressed data) don't delete

**Solution**:
```typescript
// Use timeout protection
await cleanupWithTimeout(
  () => sessionDriver.deleteSession(largeSessionId),
  15000, // 15 second timeout
  `session:${largeSessionId}`
);
```

### Problem: Partial Cleanup Leaves Orphaned Data

**Symptoms**:
- Some resources deleted, others remain
- Tests fail due to data pollution

**Solution**:
```typescript
// Use individual try-catch (don't fail fast)
await Promise.all(sessionIds.map(async (id) => {
  try {
    await deleteSession(id);
  } catch (error) {
    // Log but continue
    console.error(`Failed: ${id}`, error);
  }
}));
```

### Problem: Dependency Order Violations

**Symptoms**:
- Deletion fails with "foreign key constraint" errors
- Parent deleted before children

**Solution**:
```typescript
// Clean in correct order (children first)
await cleanupEvidence();     // 1. No dependencies
await cleanupMastery();      // 2. References evidence
await cleanupSessions();     // 3. References mastery
await cleanupUsers();        // 4. Root (everything depends on users)
```

### Problem: Test User Deletion Fails

**Symptoms**:
- "Cannot delete user with active sessions" error

**Solution**:
```typescript
// Don't delete shared test user!
// Only clean up sessions and tracking array
await testAuth.cleanupTestUsers(); // Just clears array, doesn't delete user
```

### Problem: Cleanup Verification Fails in CI

**Symptoms**:
- Local tests pass, CI fails on cleanup verification

**Solution**:
```typescript
// Add retry logic for eventual consistency
async function verifyCleanupWithRetry(
  collectionId: string,
  resourceIds: string[],
  maxRetries: number = 3
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    const { verified } = await verifyCleanup(collectionId, resourceIds);
    if (verified) return true;

    console.log(`Retry ${i + 1}/${maxRetries}...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return false;
}
```

---

## 17. Test Command Reference

```bash
# Run all replay tests
npm run test:replay

# Run E2E tests only
npm run test:e2e -- tests/integration/session-replay.spec.ts

# Run integration tests
npm run test:integration -- tests/integration/session-history-persistence.test.ts

# Run with coverage
npm run test:coverage -- --testPathPattern=replay

# Run performance tests
npm run test:performance

# Run security tests
npm run test:security

# Run with cleanup verification
npm run test -- --verbose --detectLeaks

# Run single test suite
npm test -- session-replay.spec.ts

# Run with custom timeout (for slow cleanup)
npm test -- --testTimeout=30000
```

---

## 18. Coverage Targets

| Category | Target | Current | Gap |
|----------|--------|---------|-----|
| E2E Tests | 10 tests | 0 | 10 |
| Integration Tests | 8 tests | 0 | 8 |
| Unit Tests | 6 tests | 0 | 6 |
| Security Tests | 2 tests | 0 | 2 |
| Performance Tests | 2 tests | 0 | 2 |
| **TOTAL** | **28 tests** | **0** | **28** |

**Code Coverage Target**: 80% line coverage for:
- `app/sessions/[sessionId]/view/page.tsx`
- `lib/appwrite/driver/SessionDriver.ts` (history methods)
- `contexts/ReplayModeContext.tsx`
- `lib/replay/ReplayRuntime.ts`

**Cleanup Coverage**: 100% of tests must include proper cleanup

---

## 19. Definition of Done

A test is considered complete when:

1. ✅ Test is written and passes locally
2. ✅ Test is added to CI pipeline
3. ✅ Test fixtures are created and documented
4. ✅ Test has clear comments explaining Given/When/Then
5. ✅ Test has assertion messages for debugging
6. ✅ Test runs in under 10 seconds (E2E) or 1 second (unit)
7. ✅ **Test cleanup is implemented and verified**
8. ✅ **Cleanup logs are clear and use emoji status indicators**
9. ✅ **Test tracks all created resource IDs**
10. ✅ **Cleanup handles failures gracefully (individual try-catch)**
11. ✅ Test is reviewed by team member
12. ✅ **Cleanup verification passes (no orphaned data)**

---

## 20. Success Metrics

This test plan is successful when:

- ✅ All 28 tests are implemented and passing
- ✅ Code coverage reaches 80% for replay feature
- ✅ **100% of tests include proper cleanup**
- ✅ **Zero orphaned documents after test runs (verified)**
- ✅ **Tests can run 100+ times without data buildup**
- ✅ Zero security vulnerabilities found in manual review
- ✅ Performance tests confirm <3s load time for large histories
- ✅ No regressions introduced in existing 64+ tests
- ✅ **Cleanup completes within 30 seconds even for large datasets**
- ✅ **CI/CD pipeline shows stable test data metrics**
- ✅ Feature ships to production with confidence

---

**Document Version**: 2.0 (Enhanced with Cleanup Details)
**Last Updated**: 2025-10-29
**Author**: Test Plan Generator
**Review Status**: Approved
**Cleanup Patterns Source**: Based on existing patterns in EvidenceDriver.test.ts, MasteryDriver.test.ts, session-completion.test.ts
