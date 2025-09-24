import { ServerMasteryDriver } from '../support/ServerMasteryDriver';
import { TestAuth, TestUser } from '../support/testAuth';
import { v4 as uuidv4 } from 'uuid';

describe('MasteryDriver Integration Tests', () => {
  let masteryDriver: ServerMasteryDriver;
  let testAuth: TestAuth;
  let testUser: TestUser;
  let testStudentId: string;
  let testCourseId: string;
  let testStudentIds: string[] = [];

  beforeAll(async () => {
    testAuth = new TestAuth();
    const { user, sessionClient } = await testAuth.createTestUserSession();

    testUser = user;
    masteryDriver = new ServerMasteryDriver(sessionClient, testUser.id);
    testStudentId = `test-student-${uuidv4()}`;
    testCourseId = `test-course-${uuidv4()}`;
    testStudentIds.push(testStudentId);

    console.log('Created test user:', testUser.email, 'ID:', testUser.id);
    console.log('Using test student ID:', testStudentId);
    console.log('Using test course ID:', testCourseId);
  });

  afterAll(async () => {
    try {
      // Clean up MasteryV2 records for all test students
      console.log('Cleaning up test MasteryV2 records for students:', testStudentIds);

      const cleanupPromises = testStudentIds.map(async (studentId) => {
        try {
          console.log(`Cleaning up MasteryV2 records for student ${studentId}`);
          await masteryDriver.deleteMasteryV2(studentId, testCourseId);
          console.log('Deleted MasteryV2 record for student:', studentId);
        } catch (error) {
          console.error(`Failed to clean up MasteryV2 records for student ${studentId}:`, error);
        }
      });

      await Promise.all(cleanupPromises);
      console.log('MasteryV2 cleanup completed');

      // Clean up test user
      await testAuth.cleanupTestUsers();
      console.log('Test user cleanup completed');
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  });

  describe('MasteryV2 Operations', () => {
    test('should create initial MasteryV2 record', async () => {
      const masteryData = {
        studentId: testStudentId,
        courseId: testCourseId,
        emaByOutcome: {
          'outcome-1': 0.3,
          'outcome-2': 0.5
        },
        updatedAt: new Date().toISOString()
      };

      console.log('Creating initial MasteryV2 record:', masteryData);

      const result = await masteryDriver.upsertMasteryV2(masteryData);

      expect(result).toBeDefined();
      expect(result.$id).toBeDefined();
      expect(result.studentId).toBe(testStudentId);
      expect(result.courseId).toBe(testCourseId);

      // Verify emaByOutcome is stored as JSON string
      expect(typeof result.emaByOutcome).toBe('string');

      console.log('Successfully created MasteryV2 record with ID:', result.$id);
    });

    test('should retrieve MasteryV2 record', async () => {
      console.log('Retrieving MasteryV2 record for student:', testStudentId, 'course:', testCourseId);

      const mastery = await masteryDriver.getMasteryV2(testStudentId, testCourseId);

      expect(mastery).toBeDefined();
      expect(mastery?.studentId).toBe(testStudentId);
      expect(mastery?.courseId).toBe(testCourseId);
      expect(mastery?.emaByOutcome).toBeDefined();
      expect(typeof mastery?.emaByOutcome).toBe('object');
      expect(mastery?.emaByOutcome['outcome-1']).toBe(0.3);
      expect(mastery?.emaByOutcome['outcome-2']).toBe(0.5);

      console.log('Retrieved MasteryV2 record:', {
        studentId: mastery?.studentId,
        courseId: mastery?.courseId,
        emaByOutcome: mastery?.emaByOutcome,
        updatedAt: mastery?.updatedAt
      });
    });

    test('should update specific outcome EMA', async () => {
      console.log('Updating outcome EMA for outcome-1 to 0.7');

      await masteryDriver.updateOutcomeEMA(
        testStudentId,
        testCourseId,
        'outcome-1',
        0.7
      );

      const updated = await masteryDriver.getMasteryV2(testStudentId, testCourseId);

      expect(updated?.emaByOutcome['outcome-1']).toBe(0.7);
      expect(updated?.emaByOutcome['outcome-2']).toBe(0.5); // Unchanged

      console.log('Updated EMAs:', updated?.emaByOutcome);
    });

    test('should batch update multiple EMAs', async () => {
      const emaUpdates = {
        'outcome-1': 0.8,
        'outcome-2': 0.6,
        'outcome-3': 0.9
      };

      console.log('Batch updating EMAs:', emaUpdates);

      await masteryDriver.batchUpdateEMAs(testStudentId, testCourseId, emaUpdates);

      const updated = await masteryDriver.getMasteryV2(testStudentId, testCourseId);

      expect(updated?.emaByOutcome['outcome-1']).toBe(0.8);
      expect(updated?.emaByOutcome['outcome-2']).toBe(0.6);
      expect(updated?.emaByOutcome['outcome-3']).toBe(0.9);

      console.log('Batch updated EMAs:', updated?.emaByOutcome);
    });

    test('should auto-create mastery record if not exists', async () => {
      const newStudentId = `test-student-${uuidv4()}`;
      const newCourseId = `test-course-${uuidv4()}`;
      testStudentIds.push(newStudentId); // Track for cleanup

      console.log('Testing auto-creation for new student:', newStudentId, 'course:', newCourseId);

      // Should auto-create when updating EMA
      await masteryDriver.updateOutcomeEMA(
        newStudentId,
        newCourseId,
        'new-outcome',
        0.4
      );

      const created = await masteryDriver.getMasteryV2(newStudentId, newCourseId);

      expect(created).toBeDefined();
      expect(created?.emaByOutcome['new-outcome']).toBe(0.4);

      console.log('Auto-created MasteryV2 record with EMA:', created?.emaByOutcome);
    });

    test('should handle invalid EMA scores by clamping', async () => {
      console.log('Testing EMA score clamping');

      // Should clamp to [0,1]
      await masteryDriver.updateOutcomeEMA(
        testStudentId,
        testCourseId,
        'outcome-4',
        1.5 // Above max
      );

      const result = await masteryDriver.getMasteryV2(testStudentId, testCourseId);
      expect(result?.emaByOutcome['outcome-4']).toBe(1);
      console.log('Clamped 1.5 to:', result?.emaByOutcome['outcome-4']);

      await masteryDriver.updateOutcomeEMA(
        testStudentId,
        testCourseId,
        'outcome-5',
        -0.5 // Below min
      );

      const result2 = await masteryDriver.getMasteryV2(testStudentId, testCourseId);
      expect(result2?.emaByOutcome['outcome-5']).toBe(0);
      console.log('Clamped -0.5 to:', result2?.emaByOutcome['outcome-5']);
    });

    test('should retrieve specific outcome EMA', async () => {
      const ema = await masteryDriver.getOutcomeEMA(
        testStudentId,
        testCourseId,
        'outcome-1'
      );

      expect(ema).toBe(0.8); // From previous batch update test

      console.log('Retrieved EMA for outcome-1:', ema);
    });

    test('should return null for non-existent outcome EMA', async () => {
      const ema = await masteryDriver.getOutcomeEMA(
        testStudentId,
        testCourseId,
        'non-existent-outcome'
      );

      expect(ema).toBeNull();

      console.log('Non-existent outcome EMA returned:', ema);
    });

    test('should return null for non-existent student/course', async () => {
      const nonExistentStudentId = `non-existent-${uuidv4()}`;
      const mastery = await masteryDriver.getMasteryV2(nonExistentStudentId, testCourseId);

      expect(mastery).toBeNull();

      console.log('Non-existent student mastery returned:', mastery);
    });

    test('should handle batch EMA updates with mixed existing/new outcomes', async () => {
      const mixedUpdates = {
        'outcome-1': 0.95, // Existing - update
        'outcome-2': 0.85, // Existing - update
        'outcome-new-1': 0.7, // New - create
        'outcome-new-2': 0.6  // New - create
      };

      console.log('Testing mixed EMA updates:', mixedUpdates);

      await masteryDriver.batchUpdateEMAs(testStudentId, testCourseId, mixedUpdates);

      const result = await masteryDriver.getMasteryV2(testStudentId, testCourseId);

      expect(result?.emaByOutcome['outcome-1']).toBe(0.95);
      expect(result?.emaByOutcome['outcome-2']).toBe(0.85);
      expect(result?.emaByOutcome['outcome-new-1']).toBe(0.7);
      expect(result?.emaByOutcome['outcome-new-2']).toBe(0.6);

      console.log('Mixed update result EMAs:', result?.emaByOutcome);
    });
  });
});