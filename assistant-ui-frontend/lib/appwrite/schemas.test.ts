/*
Unit tests for schema transformation functions.
These tests follow TDD Red-Green-Refactor methodology for data transformation.
Using Playwright test framework.
*/

import { test, expect } from '@playwright/test';
import {
  transformAppwriteDocument,
  prepareForAppwrite,
  validateCollection,
  safeValidateCollection,
  CourseSchema,
  StudentSchema,
  LessonTemplateSchema,
  SchedulingContextSchema
} from './schemas';

test.describe('Schema Transformation Functions', () => {
  test.describe('RED: Failing Tests for transformAppwriteDocument', () => {
    test('should fail: transform Appwrite course document', async () => {
      // ARRANGE: Mock Appwrite document with metadata fields
      const appwriteDoc = {
        $id: 'course-123',
        courseId: 'C844 73',
        subject: 'Applications of Mathematics',
        level: 'National 3',
        status: 'active',
        $createdAt: '2024-01-01T00:00:00.000Z',
        $updatedAt: '2024-01-02T00:00:00.000Z',
        $permissions: ['read("user:123")'],
        $databaseId: 'default',
        $collectionId: 'courses'
      };

      // ACT & ASSERT: Should fail initially due to missing implementation
      await expect(() => {
        const result = transformAppwriteDocument(appwriteDoc, CourseSchema);

        // These assertions should pass after implementation
        expect(result).toMatchObject({
          $id: 'course-123',
          courseId: 'C844 73',
          subject: 'Applications of Mathematics',
          level: 'National 3',
          status: 'active',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z'
        });

        // Metadata fields should be removed
        expect(result).not.toHaveProperty('$permissions');
        expect(result).not.toHaveProperty('$databaseId');
        expect(result).not.toHaveProperty('$collectionId');
        expect(result).not.toHaveProperty('$createdAt');
        expect(result).not.toHaveProperty('$updatedAt');
      }).not.toThrow();
    });

    test('should fail: transform student document with array accommodations', async () => {
      const appwriteDoc = {
        $id: 'student-123',
        userId: 'user-456',
        name: 'Test Student',
        accommodations: ['extra_time', 'large_print'], // Array format
        enrolledCourses: ['course-1', 'course-2'],
        $createdAt: '2024-01-01T00:00:00.000Z',
        $updatedAt: '2024-01-01T00:00:00.000Z'
      };

      await expect(() => {
        const result = transformAppwriteDocument(appwriteDoc, StudentSchema);

        expect(result.accommodations).toEqual(['extra_time', 'large_print']);
        expect(result.enrolledCourses).toEqual(['course-1', 'course-2']);
      }).not.toThrow();
    });

    test('should fail: handle missing timestamp fallback', async () => {
      const appwriteDoc = {
        $id: 'course-no-timestamps',
        courseId: 'C123 45',
        subject: 'Test Subject',
        level: 'Test Level',
        status: 'active',
        // Missing both $createdAt and createdAt
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      await expect(() => {
        const result = transformAppwriteDocument(appwriteDoc, CourseSchema);
        expect(result.updatedAt).toBe('2024-01-01T00:00:00.000Z');
        // Should handle missing createdAt gracefully or throw appropriate error
      }).not.toThrow();
    });

    test('should fail: validate schema mismatch error handling', async () => {
      const invalidDoc = {
        $id: 'invalid-course',
        courseId: 'INVALID-FORMAT', // Wrong format
        subject: '', // Empty required field
        level: 'Test',
        status: 'invalid-status', // Not in enum
        $createdAt: 'invalid-date', // Invalid date
        $updatedAt: '2024-01-01T00:00:00.000Z'
      };

      await expect(() => {
        transformAppwriteDocument(invalidDoc, CourseSchema);
      }).toThrow();
    });
  });

  test.describe('RED: Failing Tests for prepareForAppwrite', () => {
    test('should fail: prepare lesson template data for Appwrite', async () => {
      const templateData = {
        $id: 'template-123', // Should be removed
        courseId: 'C844 73',
        title: 'Test Lesson',
        outcomeRefs: ['AOM3.1', 'AOM3.2'], // Should be JSON stringified
        estMinutes: 45,
        status: 'published',
        difficulty: 'intermediate',
        prerequisites: ['prereq-1'], // Should be JSON stringified
        createdAt: '2024-01-01T00:00:00.000Z', // Should be removed
        updatedAt: '2024-01-02T00:00:00.000Z' // Should be removed
      };

      await expect(() => {
        const result = prepareForAppwrite(templateData);

        // Managed fields should be removed
        expect(result).not.toHaveProperty('$id');
        expect(result).not.toHaveProperty('createdAt');
        expect(result).not.toHaveProperty('updatedAt');

        // Arrays should be JSON strings
        expect(typeof result.outcomeRefs).toBe('string');
        expect(result.outcomeRefs).toBe('["AOM3.1","AOM3.2"]');

        // Other fields should remain
        expect(result.courseId).toBe('C844 73');
        expect(result.title).toBe('Test Lesson');
        expect(result.estMinutes).toBe(45);
      }).not.toThrow();
    });

    test('should fail: prepare student data with accommodations array', async () => {
      const studentData = {
        userId: 'user-123',
        name: 'Test Student',
        accommodations: ['extra_time', 'quiet_room'], // Should be stringified
        enrolledCourses: ['course-1', 'course-2'], // Should be stringified
        customField: 'should remain'
      };

      await expect(() => {
        const result = prepareForAppwrite(studentData);

        expect(typeof result.accommodations).toBe('string');
        expect(result.accommodations).toBe('["extra_time","quiet_room"]');
        expect(typeof result.enrolledCourses).toBe('string');
        expect(result.enrolledCourses).toBe('["course-1","course-2"]');
        expect(result.customField).toBe('should remain');
      }).not.toThrow();
    });

    test('should fail: handle non-array fields gracefully', async () => {
      const dataWithoutArrays = {
        courseId: 'C123 45',
        title: 'No Arrays Here',
        accommodations: 'not-an-array', // Should not be modified
        outcomeRefs: null, // Should not be modified
        estMinutes: 30
      };

      await expect(() => {
        const result = prepareForAppwrite(dataWithoutArrays);

        expect(result.accommodations).toBe('not-an-array');
        expect(result.outcomeRefs).toBeNull();
        expect(result.estMinutes).toBe(30);
      }).not.toThrow();
    });

    test('should fail: prepare routine data with recentTemplateIds', async () => {
      const routineData = {
        studentId: 'student-123',
        courseId: 'course-456',
        dueAtByOutcome: { 'AOM3.1': '2024-02-01T00:00:00.000Z' },
        lastTaughtAt: '2024-01-15T00:00:00.000Z',
        recentTemplateIds: ['template-1', 'template-2'], // Should be stringified
        lastUpdated: '2024-01-01T00:00:00.000Z'
      };

      await expect(() => {
        const result = prepareForAppwrite(routineData);

        expect(typeof result.recentTemplateIds).toBe('string');
        expect(result.recentTemplateIds).toBe('["template-1","template-2"]');
        expect(result.dueAtByOutcome).toEqual({ 'AOM3.1': '2024-02-01T00:00:00.000Z' });
      }).not.toThrow();
    });
  });

  test.describe('RED: Failing Tests for validateCollection', () => {
    test('should fail: validate valid course data', async () => {
      const validCourse = {
        $id: 'course-valid',
        courseId: 'C844 73',
        subject: 'Mathematics',
        level: 'National 3',
        status: 'active',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      await expect(() => {
        const result = validateCollection('courses', validCourse);
        expect(result).toEqual(validCourse);
      }).not.toThrow();
    });

    test('should fail: validate invalid course data throws error', async () => {
      const invalidCourse = {
        $id: 'course-invalid',
        courseId: 'WRONG-FORMAT',
        subject: '',
        level: 'Invalid Level',
        status: 'wrong-status'
      };

      await expect(() => {
        validateCollection('courses', invalidCourse);
      }).toThrow();
    });

    test('should fail: validate lesson template with outcome refs', async () => {
      const validTemplate = {
        $id: 'template-valid',
        courseId: 'C844 73',
        title: 'Valid Template',
        outcomeRefs: ['AOM3.1', 'AOM3.2'],
        estMinutes: 45,
        status: 'published',
        difficulty: 'intermediate',
        prerequisites: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      await expect(() => {
        const result = validateCollection('lesson_templates', validTemplate);
        expect(result.outcomeRefs).toEqual(['AOM3.1', 'AOM3.2']);
        expect(result.estMinutes).toBe(45);
      }).not.toThrow();
    });
  });

  test.describe('RED: Failing Tests for safeValidateCollection', () => {
    test('should fail: return success for valid data', async () => {
      const validStudent = {
        $id: 'student-valid',
        userId: 'user-123',
        name: 'Valid Student',
        accommodations: ['extra_time'],
        enrolledCourses: ['course-1'],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      await expect(() => {
        const result = safeValidateCollection('students', validStudent);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(validStudent);
        }
      }).not.toThrow();
    });

    test('should fail: return error for invalid data', async () => {
      const invalidStudent = {
        $id: '',
        userId: null,
        name: '',
        accommodations: 'not-array',
        enrolledCourses: undefined
      };

      await expect(() => {
        const result = safeValidateCollection('students', invalidStudent);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeDefined();
          expect(result.error.issues).toBeDefined();
          expect(result.error.issues.length).toBeGreaterThan(0);
        }
      }).not.toThrow();
    });

    test('should fail: validate scheduling context schema', async () => {
      const validContext = {
        student: {
          id: 'student-123',
          displayName: 'Test Student',
          accommodations: ['extra_time']
        },
        course: {
          $id: 'course-123',
          courseId: 'C844 73',
          subject: 'Mathematics',
          level: 'National 3',
          status: 'active',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z'
        },
        sow: {
          entries: []
        },
        templates: [{
          $id: 'template-123',
          courseId: 'C844 73',
          title: 'Test Template',
          outcomeRefs: ['AOM3.1'],
          estMinutes: 30,
          status: 'published',
          difficulty: 'intermediate',
          prerequisites: []
        }],
        mastery: {
          emaByOutcome: {
            'AOM3.1': 0.5
          }
        },
        routine: {
          dueAtByOutcome: {
            'AOM3.1': '2024-02-01T00:00:00.000Z'
          },
          lastTaughtAt: '2024-01-15T00:00:00.000Z',
          recentTemplateIds: []
        },
        constraints: {
          maxBlockMinutes: 25,
          avoidRepeatWithinDays: 3,
          preferOverdue: true,
          preferLowEMA: true
        }
      };

      await expect(() => {
        const result = SchedulingContextSchema.safeParse(validContext);
        expect(result.success).toBe(true);
      }).not.toThrow();
    });
  });

  test.describe('RED: Failing Edge Cases and Error Handling', () => {
    test('should fail: handle deeply nested array transformations', async () => {
      const complexData = {
        nestedArrays: [
          { items: ['item1', 'item2'] },
          { items: ['item3'] }
        ],
        outcomeRefs: ['ref1', 'ref2'],
        accommodations: ['acc1'],
        normalField: 'unchanged'
      };

      await expect(() => {
        const result = prepareForAppwrite(complexData);

        // Only known array fields should be stringified
        expect(typeof result.outcomeRefs).toBe('string');
        expect(typeof result.accommodations).toBe('string');

        // Nested arrays should remain unchanged
        expect(Array.isArray(result.nestedArrays)).toBe(true);
        expect(result.normalField).toBe('unchanged');
      }).not.toThrow();
    });

    test('should fail: handle circular references gracefully', async () => {
      const circularData = {
        name: 'test',
        outcomeRefs: ['ref1']
      };
      // Create circular reference
      (circularData as any).self = circularData;

      await expect(() => {
        const result = prepareForAppwrite(circularData);
        expect(typeof result.outcomeRefs).toBe('string');
        // Should not crash on circular reference
      }).not.toThrow();
    });

    test('should fail: validate timestamp edge cases', async () => {
      const edgeTimestamps = {
        $id: 'edge-case',
        courseId: 'C123 45',
        subject: 'Edge Case',
        level: 'Test',
        status: 'active',
        $createdAt: null, // Null timestamp
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      await expect(() => {
        const result = transformAppwriteDocument(edgeTimestamps, CourseSchema);
        // Should handle null timestamps by providing fallback
        expect(result.createdAt).toBeDefined();
        expect(typeof result.createdAt).toBe('string');
        expect(result.updatedAt).toBe('2024-01-01T00:00:00.000Z');
      }).not.toThrow();
    });
  });
});