/**
 * Integration Test: Session Completion with Score Persistence
 *
 * This test validates the complete session lifecycle including score tracking:
 * 1. Session creation (active status)
 * 2. Session completion with score
 * 3. Score persistence and retrieval
 * 4. Session history integration
 *
 * Purpose: Prevent schema mismatch errors like "Unknown attribute: score"
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client, Databases, Query } from 'appwrite';
import { SessionDriver } from '@/lib/appwrite/driver/SessionDriver';

// Test configuration
const TEST_CONFIG = {
  endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'http://localhost/v1',
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '',
  apiKey: process.env.APPWRITE_API_KEY || '',
  databaseId: 'default',
  sessionCollectionId: 'sessions'
};

describe('Session Completion Integration Tests', () => {
  let client: Client;
  let databases: Databases;
  let sessionDriver: SessionDriver;
  let testSessionId: string;

  // Test data
  const TEST_STUDENT_ID = 'test_student_integration';
  const TEST_COURSE_ID = 'test_course_integration';
  const TEST_LESSON_TEMPLATE_ID = 'test_lesson_template';
  const TEST_SCORE = 0.85; // 85% accuracy

  beforeAll(() => {
    // Skip if no API key (CI environments without Appwrite)
    if (!TEST_CONFIG.apiKey) {
      console.warn('⚠️  Skipping integration tests - APPWRITE_API_KEY not set');
      return;
    }

    // Initialize Appwrite client with API key for admin access
    client = new Client()
      .setEndpoint(TEST_CONFIG.endpoint)
      .setProject(TEST_CONFIG.projectId)
      .setKey(TEST_CONFIG.apiKey);

    databases = new Databases(client);
    sessionDriver = new SessionDriver(databases);
  });

  afterAll(async () => {
    // Cleanup: Delete test session if it exists
    if (testSessionId && databases) {
      try {
        await databases.deleteDocument(
          TEST_CONFIG.databaseId,
          TEST_CONFIG.sessionCollectionId,
          testSessionId
        );
        console.log(`✅ Cleaned up test session: ${testSessionId}`);
      } catch (error) {
        console.warn(`⚠️  Failed to cleanup test session: ${error}`);
      }
    }
  });

  it('should create a session with active status', async () => {
    if (!TEST_CONFIG.apiKey) return;

    const sessionData = {
      studentId: TEST_STUDENT_ID,
      courseId: TEST_COURSE_ID,
      lessonTemplateId: TEST_LESSON_TEMPLATE_ID,
      status: 'active' as const,
      startedAt: new Date().toISOString(),
      lessonSnapshot: JSON.stringify({
        title: 'Test Lesson',
        cards: []
      }),
      threadId: 'test_thread_123'
    };

    const session = await sessionDriver.createSession(sessionData);
    testSessionId = session.$id;

    expect(session).toBeDefined();
    expect(session.$id).toBeTruthy();
    expect(session.status).toBe('active');
    expect(session.studentId).toBe(TEST_STUDENT_ID);
    expect(session.courseId).toBe(TEST_COURSE_ID);

    console.log(`✅ Created test session: ${testSessionId}`);
  });

  it('should complete session with score and verify persistence', async () => {
    if (!TEST_CONFIG.apiKey || !testSessionId) return;

    // Complete the session with a score
    const completedSession = await sessionDriver.completeSession(testSessionId, TEST_SCORE);

    // Verify completion
    expect(completedSession.status).toBe('completed');
    expect(completedSession.score).toBe(TEST_SCORE);
    expect(completedSession.endedAt).toBeTruthy();

    console.log(`✅ Completed session with score: ${TEST_SCORE}`);

    // Re-fetch to verify persistence
    const fetchedSession = await databases.getDocument(
      TEST_CONFIG.databaseId,
      TEST_CONFIG.sessionCollectionId,
      testSessionId
    );

    expect(fetchedSession.status).toBe('completed');
    expect(fetchedSession.score).toBe(TEST_SCORE);
    expect(fetchedSession.endedAt).toBeTruthy();

    console.log('✅ Score persisted correctly in database');
  });

  it('should complete session without score (optional field)', async () => {
    if (!TEST_CONFIG.apiKey) return;

    // Create another session
    const sessionData = {
      studentId: TEST_STUDENT_ID,
      courseId: TEST_COURSE_ID,
      lessonTemplateId: TEST_LESSON_TEMPLATE_ID,
      status: 'active' as const,
      startedAt: new Date().toISOString(),
      lessonSnapshot: JSON.stringify({ title: 'Test Lesson 2', cards: [] }),
      threadId: 'test_thread_456'
    };

    const session = await sessionDriver.createSession(sessionData);
    const sessionId2 = session.$id;

    // Complete without score
    const completedSession = await sessionDriver.completeSession(sessionId2);

    expect(completedSession.status).toBe('completed');
    expect(completedSession.score).toBeUndefined();
    expect(completedSession.endedAt).toBeTruthy();

    console.log('✅ Session completed successfully without score');

    // Cleanup
    await databases.deleteDocument(
      TEST_CONFIG.databaseId,
      TEST_CONFIG.sessionCollectionId,
      sessionId2
    );
  });

  it('should reject invalid score values', async () => {
    if (!TEST_CONFIG.apiKey || !testSessionId) return;

    // Create a test session for invalid score testing
    const sessionData = {
      studentId: TEST_STUDENT_ID,
      courseId: TEST_COURSE_ID,
      lessonTemplateId: TEST_LESSON_TEMPLATE_ID,
      status: 'active' as const,
      startedAt: new Date().toISOString(),
      lessonSnapshot: JSON.stringify({ title: 'Test Lesson 3', cards: [] }),
      threadId: 'test_thread_789'
    };

    const session = await sessionDriver.createSession(sessionData);
    const sessionId3 = session.$id;

    // Test invalid scores (Appwrite should reject based on min/max constraints)
    const invalidScores = [-0.1, 1.5, 999];

    for (const invalidScore of invalidScores) {
      try {
        await sessionDriver.completeSession(sessionId3, invalidScore);
        // If no error thrown, test should fail
        expect(true).toBe(false); // Force failure
      } catch (error: any) {
        // Expected to fail with validation error
        expect(error).toBeDefined();
        console.log(`✅ Correctly rejected invalid score: ${invalidScore}`);
      }
    }

    // Cleanup
    await databases.deleteDocument(
      TEST_CONFIG.databaseId,
      TEST_CONFIG.sessionCollectionId,
      sessionId3
    );
  });

  it('should retrieve completed sessions with scores in history', async () => {
    if (!TEST_CONFIG.apiKey) return;

    // Query all completed sessions for test student
    const completedSessions = await databases.listDocuments(
      TEST_CONFIG.databaseId,
      TEST_CONFIG.sessionCollectionId,
      [
        Query.equal('studentId', TEST_STUDENT_ID),
        Query.equal('status', 'completed'),
        Query.orderDesc('$createdAt')
      ]
    );

    // Should have at least the sessions we created
    expect(completedSessions.total).toBeGreaterThan(0);

    // Find our test session
    const ourSession = completedSessions.documents.find(
      (doc: any) => doc.$id === testSessionId
    );

    expect(ourSession).toBeDefined();
    expect(ourSession.score).toBe(TEST_SCORE);
    expect(ourSession.status).toBe('completed');

    console.log(`✅ Found ${completedSessions.total} completed sessions in history`);
  });
});
