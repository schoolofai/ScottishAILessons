import { ServerEvidenceDriver } from '../support/ServerEvidenceDriver';
import { TestAuth, TestUser } from '../support/testAuth';
import { v4 as uuidv4 } from 'uuid';

describe('EvidenceDriver Integration Tests', () => {
  let evidenceDriver: ServerEvidenceDriver;
  let testAuth: TestAuth;
  let testUser: TestUser;
  let testSessionId: string;
  let createdEvidenceIds: string[] = [];

  beforeAll(async () => {
    testAuth = new TestAuth();
    const { user, sessionClient } = await testAuth.createTestUserSession();

    testUser = user;
    evidenceDriver = new ServerEvidenceDriver(sessionClient, testUser.id);
    testSessionId = `test-session-${uuidv4()}`;

    console.log('Created test user:', testUser.email, 'ID:', testUser.id);
    console.log('Using test session ID:', testSessionId);
  });

  afterAll(async () => {
    try {
      // Clean up all test data
      console.log('Cleaning up test evidence records:', createdEvidenceIds);

      const cleanupPromises = createdEvidenceIds.map(async (id) => {
        try {
          await evidenceDriver.delete('evidence', id);
          console.log('Deleted evidence:', id);
        } catch (error) {
          console.error('Failed to delete test evidence:', id, error);
        }
      });

      await Promise.all(cleanupPromises);
      console.log('Evidence cleanup completed');

      // Clean up test user
      await testAuth.cleanupTestUsers();
      console.log('Test user cleanup completed');
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  });

  test('should record single evidence entry', async () => {
    const evidenceData = {
      sessionId: testSessionId,
      itemId: 'test-item-1',
      response: 'Test answer',
      correct: true,
      attempts: 1,
      confidence: 0.9,
      reasoning: 'Test reasoning',
      feedback: 'Good job!',
      timestamp: new Date().toISOString()
    };

    console.log('Creating evidence with data:', evidenceData);

    const result = await evidenceDriver.recordEvidence(evidenceData);

    expect(result).toBeDefined();
    expect(result.$id).toBeDefined();
    expect(result.itemId).toBe('test-item-1');
    expect(result.correct).toBe(true);
    expect(result.sessionId).toBe(testSessionId);
    expect(result.response).toBe('Test answer');
    expect(result.attempts).toBe(1);
    expect(result.confidence).toBe(0.9);

    createdEvidenceIds.push(result.$id);
    console.log('Successfully created evidence with ID:', result.$id);
  });

  test('should batch record multiple evidence entries', async () => {
    const evidenceArray = [
      {
        sessionId: testSessionId,
        itemId: 'test-item-2',
        response: 'Answer 2',
        correct: false,
        attempts: 2,
        confidence: 0.5,
        reasoning: 'Reasoning 2',
        feedback: 'Try again',
        timestamp: new Date().toISOString()
      },
      {
        sessionId: testSessionId,
        itemId: 'test-item-3',
        response: 'Answer 3',
        correct: true,
        attempts: 1,
        confidence: 0.8,
        reasoning: 'Reasoning 3',
        feedback: 'Excellent',
        timestamp: new Date().toISOString()
      }
    ];

    console.log('Batch creating evidence with data:', evidenceArray);

    const results = await evidenceDriver.batchRecordEvidence(evidenceArray);

    expect(results).toHaveLength(2);
    expect(results[0].itemId).toBe('test-item-2');
    expect(results[0].correct).toBe(false);
    expect(results[0].attempts).toBe(2);
    expect(results[1].itemId).toBe('test-item-3');
    expect(results[1].correct).toBe(true);
    expect(results[1].attempts).toBe(1);

    results.forEach(r => {
      createdEvidenceIds.push(r.$id);
      console.log('Successfully created evidence with ID:', r.$id);
    });
  });

  test('should retrieve evidence by session', async () => {
    console.log('Retrieving evidence for session:', testSessionId);

    const evidence = await evidenceDriver.getSessionEvidence(testSessionId);

    expect(evidence).toBeDefined();
    expect(evidence.length).toBeGreaterThanOrEqual(3);
    expect(evidence.every(e => e.sessionId === testSessionId)).toBe(true);

    // Verify we have all our test items
    const itemIds = evidence.map(e => e.itemId).sort();
    expect(itemIds).toContain('test-item-1');
    expect(itemIds).toContain('test-item-2');
    expect(itemIds).toContain('test-item-3');

    console.log('Retrieved evidence count:', evidence.length);
    console.log('Evidence item IDs:', itemIds);
  });

  test('should handle errors gracefully', async () => {
    const invalidData = {
      sessionId: '', // Invalid: empty session ID
      itemId: 'test-item',
      response: 'Test',
      correct: true,
      attempts: 1,
      confidence: 0.5,
      reasoning: 'Test',
      feedback: 'Test',
      timestamp: new Date().toISOString()
    };

    console.log('Testing error handling with invalid data:', invalidData);

    await expect(evidenceDriver.recordEvidence(invalidData))
      .rejects.toThrow();

    console.log('Error handling test passed - invalid data rejected');
  });

  test('should validate data types correctly', async () => {
    const validData = {
      sessionId: testSessionId,
      itemId: 'test-item-4',
      response: 'Test response',
      correct: true,
      attempts: 3,
      confidence: 0.75,
      reasoning: 'Valid reasoning',
      feedback: 'Good work',
      timestamp: new Date().toISOString()
    };

    const result = await evidenceDriver.recordEvidence(validData);

    expect(typeof result.correct).toBe('boolean');
    expect(typeof result.attempts).toBe('number');
    expect(typeof result.confidence).toBe('number');
    expect(typeof result.response).toBe('string');
    expect(typeof result.reasoning).toBe('string');
    expect(typeof result.feedback).toBe('string');

    createdEvidenceIds.push(result.$id);
    console.log('Data type validation test passed for evidence ID:', result.$id);
  });
});