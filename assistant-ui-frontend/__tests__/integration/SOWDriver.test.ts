import { ServerSOWDriver } from '../support/ServerSOWDriver';
import { ServerAuthoredSOWDriver } from '../support/ServerAuthoredSOWDriver';
import { TestAuth, TestUser } from '../support/testAuth';
import { v4 as uuidv4 } from 'uuid';
import type { AuthoredSOWEntry, AuthoredSOWMetadata } from '../../lib/appwrite/types';

describe('SOWDriver Integration Tests - Reference Architecture', () => {
  let sowDriver: ServerSOWDriver;
  let authoredSOWDriver: ServerAuthoredSOWDriver;
  let testAuth: TestAuth;
  let testUser: TestUser;
  let testStudentId: string;
  let testCourseId: string;
  let testAuthoredSOWId: string;
  let testStudentIds: string[] = [];

  // Sample curriculum data
  const SAMPLE_ENTRIES: AuthoredSOWEntry[] = [
    {
      order: 1,
      lessonTemplateRef: `lesson-fractions-intro-${uuidv4()}`,
      title: 'Introduction to Fractions',
      description: 'Basic fraction concepts',
      duration_minutes: 45,
      difficulty: 'foundation'
    },
    {
      order: 2,
      lessonTemplateRef: `lesson-fractions-equivalent-${uuidv4()}`,
      title: 'Equivalent Fractions',
      description: 'Finding equivalent fractions',
      duration_minutes: 45,
      difficulty: 'foundation'
    },
    {
      order: 3,
      lessonTemplateRef: `lesson-fractions-addition-${uuidv4()}`,
      title: 'Adding Fractions',
      description: 'Addition with like denominators',
      duration_minutes: 60,
      difficulty: 'intermediate'
    }
  ];

  const SAMPLE_METADATA: AuthoredSOWMetadata = {
    coherence: {
      policy_notes: ['Calculator use allowed for checking only'],
      sequencing_notes: ['Spiral approach - revisit concepts']
    },
    accessibility_notes: ['Use plain language (CEFR B1)'],
    engagement_notes: ['Scottish contexts where possible'],
    weeks: 12,
    periods_per_week: 3
  };

  beforeAll(async () => {
    testAuth = new TestAuth();
    const { user, sessionClient } = await testAuth.createTestUserSession();

    testUser = user;
    sowDriver = new ServerSOWDriver(sessionClient, testUser.id);
    authoredSOWDriver = new ServerAuthoredSOWDriver(sessionClient, testUser.id);
    testStudentId = `test-student-${uuidv4()}`;
    testCourseId = `test-course-${uuidv4()}`;
    testStudentIds.push(testStudentId);

    console.log('Created test user:', testUser.email, 'ID:', testUser.id);
    console.log('Using test student ID:', testStudentId);
    console.log('Using test course ID:', testCourseId);

    // Create test Authored_SOW document
    const authoredSOWData = {
      courseId: testCourseId,
      version: 'test-v1.0',
      status: 'published',
      entries: SAMPLE_ENTRIES,
      metadata: SAMPLE_METADATA,
      accessibility_notes: 'Test accessibility guidance',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const createdAuthoredSOW = await authoredSOWDriver.createAuthoredSOW(authoredSOWData);
    testAuthoredSOWId = createdAuthoredSOW.$id;

    console.log('Created test Authored_SOW:', testAuthoredSOWId);
  });

  afterAll(async () => {
    try {
      console.log('Cleaning up test SOWV2 records for students:', testStudentIds);

      const cleanupPromises = testStudentIds.map(async (studentId) => {
        try {
          console.log(`Cleaning up SOWV2 records for student ${studentId}`);
          await sowDriver.deleteSOWV2(studentId, testCourseId);
          console.log('Deleted SOWV2 record for student:', studentId);
        } catch (error) {
          console.error(`Failed to clean up SOWV2 records for student ${studentId}:`, error);
        }
      });

      await Promise.all(cleanupPromises);
      console.log('SOWV2 cleanup completed');

      // Delete test Authored_SOW
      if (testAuthoredSOWId) {
        await authoredSOWDriver.deleteAuthoredSOW(testAuthoredSOWId);
        console.log('Deleted test Authored_SOW:', testAuthoredSOWId);
      }

      // Clean up test user
      await testAuth.cleanupTestUsers();
      console.log('Test user cleanup completed');
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  });

  describe('1. copyFromAuthoredSOW() - Reference Creation', () => {
    test('should create reference-only SOWV2 record without duplicating curriculum data', async () => {
      const authoredSOW = await authoredSOWDriver.getAuthoredSOW(testAuthoredSOWId);
      expect(authoredSOW).toBeDefined();

      console.log('Creating SOWV2 reference from Authored_SOW:', testAuthoredSOWId);

      const result = await sowDriver.copyFromAuthoredSOW(
        testStudentId,
        testCourseId,
        authoredSOW!
      );

      expect(result).toBeDefined();
      expect(result.$id).toBeDefined();
      expect(result.studentId).toBe(testStudentId);
      expect(result.courseId).toBe(testCourseId);
      expect(result.source_authored_sow_id).toBe(testAuthoredSOWId);
      expect(result.source_version).toBe('test-v1.0');

      // CRITICAL: Verify NO curriculum data duplication in SOWV2
      expect(result.entries).toBeUndefined();
      expect(result.metadata).toBeUndefined();

      // Verify customizations initialized as empty
      const customizations = JSON.parse(result.customizations || '{}');
      expect(customizations).toEqual({});

      console.log('Successfully created reference-only SOWV2 record:', result.$id);
    });

    test('should throw error if Authored_SOW is missing document ID', async () => {
      const invalidAuthoredSOW = {
        courseId: testCourseId,
        version: 'test-v1.0',
        status: 'published'
      } as any;

      await expect(
        sowDriver.copyFromAuthoredSOW(testStudentId, `invalid-course-${uuidv4()}`, invalidAuthoredSOW)
      ).rejects.toThrow('Invalid Authored SOW data');
    });
  });

  describe('2. getSOWForEnrollment() - Dereference Logic', () => {
    test('should dereference to Authored_SOW and return combined data', async () => {
      const authoredSOW = await authoredSOWDriver.getAuthoredSOW(testAuthoredSOWId);
      await sowDriver.copyFromAuthoredSOW(testStudentId, testCourseId, authoredSOW!);

      console.log('Retrieving SOW for enrollment:', testStudentId, testCourseId);

      const sowData = await sowDriver.getSOWForEnrollment(testStudentId, testCourseId);

      expect(sowData).not.toBeNull();
      expect(sowData!.studentId).toBe(testStudentId);
      expect(sowData!.courseId).toBe(testCourseId);

      // Verify curriculum data comes from Authored_SOW
      expect(sowData!.entries).toHaveLength(3);
      expect(sowData!.entries[0].title).toBe('Introduction to Fractions');
      expect(sowData!.entries[1].title).toBe('Equivalent Fractions');
      expect(sowData!.entries[2].title).toBe('Adding Fractions');

      // Verify metadata comes from Authored_SOW
      expect(sowData!.metadata.weeks).toBe(12);
      expect(sowData!.metadata.periods_per_week).toBe(3);
      expect(sowData!.metadata.coherence.policy_notes).toContain('Calculator use allowed for checking only');

      // Verify accessibility_notes comes from Authored_SOW
      expect(sowData!.accessibility_notes).toBe('Test accessibility guidance');

      // Verify reference tracking
      expect(sowData!.source_sow_id).toBe(testAuthoredSOWId);
      expect(sowData!.source_version).toBe('test-v1.0');

      console.log('Successfully dereferenced curriculum data from Authored_SOW');
    });

    test('should return null if no SOWV2 record exists for enrollment', async () => {
      const sowData = await sowDriver.getSOWForEnrollment(
        `nonexistent-student-${uuidv4()}`,
        `nonexistent-course-${uuidv4()}`
      );

      expect(sowData).toBeNull();
    });
  });

  describe('3. Student Customizations', () => {
    test('should store and retrieve customizations separately from curriculum', async () => {
      const authoredSOW = await authoredSOWDriver.getAuthoredSOW(testAuthoredSOWId);
      await sowDriver.copyFromAuthoredSOW(testStudentId, testCourseId, authoredSOW!);

      const customizations = {
        entries: {
          1: { plannedAt: '2025-01-15', notes: 'Review after winter break' },
          2: { skipped: true }
        },
        preferences: { hint_level: 2 }
      };

      console.log('Adding customizations:', customizations);

      await sowDriver.updateCustomizations(testStudentId, testCourseId, customizations);

      const sowData = await sowDriver.getSOWForEnrollment(testStudentId, testCourseId);

      expect(sowData!.customizations).toEqual(customizations);

      // Verify curriculum data unchanged
      expect(sowData!.entries).toHaveLength(3);
      expect(sowData!.entries[0].title).toBe('Introduction to Fractions');

      console.log('Customizations stored successfully');
    });

    test('should mark lesson as skipped via customizations', async () => {
      const authoredSOW = await authoredSOWDriver.getAuthoredSOW(testAuthoredSOWId);
      await sowDriver.copyFromAuthoredSOW(testStudentId, testCourseId, authoredSOW!);

      console.log('Skipping lesson at order 2');

      await sowDriver.removeLessonFromSOW(testStudentId, testCourseId, 2);

      const sowData = await sowDriver.getSOWForEnrollment(testStudentId, testCourseId);

      expect(sowData!.customizations?.entries?.[2]?.skipped).toBe(true);

      // Curriculum entries should still exist
      expect(sowData!.entries).toHaveLength(3);

      console.log('Lesson marked as skipped successfully');
    });

    test('should add custom lesson via customizations', async () => {
      const authoredSOW = await authoredSOWDriver.getAuthoredSOW(testAuthoredSOWId);
      await sowDriver.copyFromAuthoredSOW(testStudentId, testCourseId, authoredSOW!);

      const customLessonId = `lesson-custom-review-${uuidv4()}`;

      console.log('Adding custom lesson at order 4:', customLessonId);

      await sowDriver.addLessonToSOW(testStudentId, testCourseId, customLessonId, 4);

      const sowData = await sowDriver.getSOWForEnrollment(testStudentId, testCourseId);

      expect(sowData!.customizations?.entries?.[4]?.custom_lesson_id).toBe(customLessonId);
      expect(sowData!.customizations?.entries?.[4]?.added_manually).toBe(true);

      console.log('Custom lesson added successfully');
    });

    test('should schedule lesson for specific date via customizations', async () => {
      const authoredSOW = await authoredSOWDriver.getAuthoredSOW(testAuthoredSOWId);
      await sowDriver.copyFromAuthoredSOW(testStudentId, testCourseId, authoredSOW!);

      const plannedDate = '2025-01-20T09:00:00Z';

      console.log('Scheduling lesson 1 for:', plannedDate);

      await sowDriver.scheduleLessonForDate(testStudentId, testCourseId, 1, plannedDate);

      const sowData = await sowDriver.getSOWForEnrollment(testStudentId, testCourseId);

      expect(sowData!.customizations?.entries?.[1]?.plannedAt).toBe(plannedDate);

      console.log('Lesson scheduled successfully');
    });
  });

  describe('4. getNextLesson() with Customizations', () => {
    test('should return first uncompleted lesson, respecting skipped lessons', async () => {
      const authoredSOW = await authoredSOWDriver.getAuthoredSOW(testAuthoredSOWId);
      await sowDriver.copyFromAuthoredSOW(testStudentId, testCourseId, authoredSOW!);

      // Skip lesson 2
      await sowDriver.removeLessonFromSOW(testStudentId, testCourseId, 2);

      // Mark lesson 1 as completed
      const completedLessons = [SAMPLE_ENTRIES[0].lessonTemplateRef];

      console.log('Finding next lesson with lesson 1 completed and lesson 2 skipped');

      const nextLesson = await sowDriver.getNextLesson(testStudentId, testCourseId, completedLessons);

      // Should skip lesson 2 (skipped) and return lesson 3
      expect(nextLesson).not.toBeNull();
      expect(nextLesson!.title).toBe('Adding Fractions');
      expect(nextLesson!.order).toBe(3);

      console.log('Next lesson correctly identified:', nextLesson!.title);
    });

    test('should return null if all lessons completed or skipped', async () => {
      const authoredSOW = await authoredSOWDriver.getAuthoredSOW(testAuthoredSOWId);
      await sowDriver.copyFromAuthoredSOW(testStudentId, testCourseId, authoredSOW!);

      // Mark all lessons as completed
      const completedLessons = SAMPLE_ENTRIES.map(e => e.lessonTemplateRef);

      console.log('Finding next lesson with all lessons completed');

      const nextLesson = await sowDriver.getNextLesson(testStudentId, testCourseId, completedLessons);

      expect(nextLesson).toBeNull();

      console.log('Correctly returned null for all completed lessons');
    });
  });

  describe('5. getSOWProgress() with Customizations', () => {
    test('should calculate progress excluding skipped lessons', async () => {
      const authoredSOW = await authoredSOWDriver.getAuthoredSOW(testAuthoredSOWId);
      await sowDriver.copyFromAuthoredSOW(testStudentId, testCourseId, authoredSOW!);

      // Skip lesson 2
      await sowDriver.removeLessonFromSOW(testStudentId, testCourseId, 2);

      // Complete lesson 1
      const completedLessons = [SAMPLE_ENTRIES[0].lessonTemplateRef];

      console.log('Calculating progress with lesson 1 completed and lesson 2 skipped');

      const progress = await sowDriver.getSOWProgress(testStudentId, testCourseId, completedLessons);

      // Total: 2 lessons (3 - 1 skipped)
      // Completed: 1 lesson
      // Progress: 50%
      expect(progress.totalLessons).toBe(2);
      expect(progress.completedLessons).toBe(1);
      expect(progress.progressPercentage).toBe(50);
      expect(progress.nextLesson?.title).toBe('Adding Fractions');

      console.log('Progress calculated correctly:', {
        totalLessons: progress.totalLessons,
        completedLessons: progress.completedLessons,
        progressPercentage: progress.progressPercentage
      });
    });
  });

  describe('6. Reference Architecture Validation', () => {
    test('should use lessonTemplateRef field (not lessonTemplateId)', async () => {
      const authoredSOW = await authoredSOWDriver.getAuthoredSOW(testAuthoredSOWId);
      await sowDriver.copyFromAuthoredSOW(testStudentId, testCourseId, authoredSOW!);

      const sowData = await sowDriver.getSOWForEnrollment(testStudentId, testCourseId);

      // Verify all entries use lessonTemplateRef (breaking change fix)
      sowData!.entries.forEach(entry => {
        expect(entry.lessonTemplateRef).toBeDefined();
        expect((entry as any).lessonTemplateId).toBeUndefined();
      });

      console.log('Verified correct field name: lessonTemplateRef');
    });

    test('should maintain reference integrity after multiple updates', async () => {
      const authoredSOW = await authoredSOWDriver.getAuthoredSOW(testAuthoredSOWId);
      await sowDriver.copyFromAuthoredSOW(testStudentId, testCourseId, authoredSOW!);

      // Multiple customization updates
      await sowDriver.updateCustomizations(testStudentId, testCourseId, { preferences: { hint_level: 1 } });
      await sowDriver.scheduleLessonForDate(testStudentId, testCourseId, 1, '2025-01-10');
      await sowDriver.addLessonToSOW(testStudentId, testCourseId, `lesson-extra-${uuidv4()}`, 4);

      console.log('Verifying reference integrity after multiple updates');

      const sowData = await sowDriver.getSOWForEnrollment(testStudentId, testCourseId);

      // Reference should remain intact
      expect(sowData!.source_sow_id).toBe(testAuthoredSOWId);
      expect(sowData!.source_version).toBe('test-v1.0');

      // Curriculum data should match Authored_SOW
      expect(sowData!.entries).toHaveLength(3);
      expect(sowData!.metadata.weeks).toBe(12);

      console.log('Reference integrity maintained across updates');
    });
  });
});
