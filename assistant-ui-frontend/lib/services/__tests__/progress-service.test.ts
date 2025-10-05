/**
 * Unit Tests for Progress Service - Phase 1 MVP2
 *
 * Tests progress calculation with SOWV2 reference dereferencing.
 */

import { Databases, Query } from 'appwrite';
import {
  getCourseProgress,
  getAllCoursesProgress,
  isLessonCompleted,
  ProgressError
} from '../progress-service';

// Mock Appwrite SDK
jest.mock('appwrite');

describe('Progress Service', () => {
  let mockDatabases: jest.Mocked<Databases>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDatabases = {
      listDocuments: jest.fn(),
      getDocument: jest.fn(),
      createDocument: jest.fn(),
      deleteDocument: jest.fn()
    } as any;
  });

  // ==========================================================================
  // getCourseProgress() - Main Function Tests
  // ==========================================================================

  describe('getCourseProgress', () => {
    it('should calculate progress with SOWV2 reference dereference', async () => {
      // Setup: SOWV2 references Authored_SOW
      const authoredSOW = {
        $id: 'authored-sow-123',
        courseId: 'course_c84473',
        version: 'v1.0',
        entries: JSON.stringify([
          { order: 1, lessonTemplateRef: 'lesson-1' },
          { order: 2, lessonTemplateRef: 'lesson-2' },
          { order: 3, lessonTemplateRef: 'lesson-3' }
        ])
      };

      const sowv2 = {
        studentId: 'student-123',
        courseId: 'course_c84473',
        source_authored_sow_id: 'authored-sow-123',  // ← Reference
        source_version: 'v1.0',
        customizations: '{}'
        // NO entries field!
      };

      const course = {
        $id: 'course_c84473',
        courseId: 'course_c84473',
        subject: 'Mathematics',
        level: 'National 3'
      };

      const completedSessions = [
        { lessonTemplateId: 'lesson-1', stage: 'done', startedAt: '2024-01-01T10:00:00Z' }
      ];

      const masteryV2 = {
        emaByOutcome: JSON.stringify({
          'MTH-3-01a': 0.6,
          'MTH-3-02a': 0.4,
          'MTH-3-03a': 0.5
        })
      };

      // Mock: SOWV2 lookup
      mockDatabases.listDocuments
        .mockResolvedValueOnce({ documents: [sowv2] })  // SOWV2
        .mockResolvedValueOnce({ documents: completedSessions })  // Completed sessions
        .mockResolvedValueOnce({ documents: [masteryV2] })  // MasteryV2
        .mockResolvedValueOnce({ documents: completedSessions });  // Last activity

      // Mock: Authored_SOW dereference
      mockDatabases.getDocument
        .mockResolvedValueOnce(authoredSOW)  // Dereference Authored_SOW
        .mockResolvedValueOnce(course);  // Course metadata

      // Execute
      const result = await getCourseProgress(
        'student-123',
        'course_c84473',
        mockDatabases
      );

      // Verify progress calculation
      expect(result.totalLessons).toBe(3);  // From Authored_SOW
      expect(result.completedLessons).toBe(1);  // One completed session
      expect(result.progressPercentage).toBe(33.33);  // 1/3 * 100
      expect(result.courseName).toBe('Mathematics - National 3');
      expect(result.completedLessonIds).toEqual(['lesson-1']);
      expect(result.lastActivity).toBe('2024-01-01T10:00:00Z');

      // Verify SOWV2 dereference call
      expect(mockDatabases.getDocument).toHaveBeenCalledWith(
        'default',
        'Authored_SOW',
        'authored-sow-123'  // Dereferenced by source_authored_sow_id
      );
    });

    it('should calculate average mastery from MasteryV2', async () => {
      const sowv2 = {
        source_authored_sow_id: 'authored-sow-123',
        customizations: '{}'
      };

      const authoredSOW = {
        $id: 'authored-sow-123',
        entries: JSON.stringify([{ order: 1, lessonTemplateRef: 'lesson-1' }])
      };

      const course = { subject: 'Mathematics', level: 'National 3' };

      const masteryv2 = {
        emaByOutcome: JSON.stringify({
          'outcome-1': 0.8,
          'outcome-2': 0.6,
          'outcome-3': 0.7
        })
      };

      mockDatabases.listDocuments
        .mockResolvedValueOnce({ documents: [sowv2] })  // SOWV2
        .mockResolvedValueOnce({ documents: [] })  // No completed sessions
        .mockResolvedValueOnce({ documents: [masteryv2] })  // MasteryV2
        .mockResolvedValueOnce({ documents: [] });  // No activity

      mockDatabases.getDocument
        .mockResolvedValueOnce(authoredSOW)
        .mockResolvedValueOnce(course);

      // Execute
      const result = await getCourseProgress('student-123', 'course_c84473', mockDatabases);

      // Verify average mastery calculation
      expect(result.averageMastery).toBe(0.7);  // (0.8 + 0.6 + 0.7) / 3
    });

    it('should handle zero mastery for new enrollment', async () => {
      const sowv2 = {
        source_authored_sow_id: 'authored-sow-123',
        customizations: '{}'
      };

      const authoredSOW = {
        entries: JSON.stringify([{ order: 1 }])
      };

      const course = { subject: 'Mathematics', level: 'National 3' };

      mockDatabases.listDocuments
        .mockResolvedValueOnce({ documents: [sowv2] })  // SOWV2
        .mockResolvedValueOnce({ documents: [] })  // No sessions
        .mockResolvedValueOnce({ documents: [] })  // No mastery yet
        .mockResolvedValueOnce({ documents: [] });  // No activity

      mockDatabases.getDocument
        .mockResolvedValueOnce(authoredSOW)
        .mockResolvedValueOnce(course);

      // Execute
      const result = await getCourseProgress('student-123', 'course_c84473', mockDatabases);

      // Verify zero state
      expect(result.averageMastery).toBe(0);
      expect(result.completedLessons).toBe(0);
      expect(result.progressPercentage).toBe(0);
      expect(result.lastActivity).toBeNull();
    });

    it('should throw NO_SOWV2 if SOWV2 missing', async () => {
      mockDatabases.listDocuments.mockResolvedValueOnce({ documents: [] });  // No SOWV2

      await expect(
        getCourseProgress('student-123', 'course_c84473', mockDatabases)
      ).rejects.toMatchObject({
        name: 'ProgressError',
        code: 'NO_SOWV2',
        message: expect.stringContaining('No SOWV2 found')
      });
    });

    it('should throw DATABASE_ERROR on Authored_SOW fetch failure', async () => {
      const sowv2 = {
        source_authored_sow_id: 'invalid-sow-id',
        customizations: '{}'
      };

      mockDatabases.listDocuments.mockResolvedValueOnce({ documents: [sowv2] });
      mockDatabases.getDocument.mockRejectedValueOnce(new Error('Authored_SOW not found'));

      await expect(
        getCourseProgress('student-123', 'course_c84473', mockDatabases)
      ).rejects.toMatchObject({
        name: 'ProgressError',
        code: 'DATABASE_ERROR'
      });
    });

    it('should calculate estimated time remaining', async () => {
      const sowv2 = { source_authored_sow_id: 'authored-sow-123' };
      const authoredSOW = {
        entries: JSON.stringify([
          { order: 1 },
          { order: 2 },
          { order: 3 },
          { order: 4 },
          { order: 5 }
        ])
      };
      const course = { subject: 'Math', level: 'N3' };

      mockDatabases.listDocuments
        .mockResolvedValueOnce({ documents: [sowv2] })
        .mockResolvedValueOnce({ documents: [{ id: '1' }, { id: '2' }] })  // 2 completed
        .mockResolvedValueOnce({ documents: [] })
        .mockResolvedValueOnce({ documents: [] });

      mockDatabases.getDocument
        .mockResolvedValueOnce(authoredSOW)
        .mockResolvedValueOnce(course);

      const result = await getCourseProgress('student-123', 'course_c84473', mockDatabases);

      // 5 total - 2 completed = 3 remaining * 30 min = 90 min
      expect(result.estimatedTimeRemaining).toBe(90);
    });
  });

  // ==========================================================================
  // getAllCoursesProgress() - Batch Progress Tests
  // ==========================================================================

  describe('getAllCoursesProgress', () => {
    it('should get progress for all enrolled courses', async () => {
      const enrollments = {
        documents: [
          { courseId: 'course-1' },
          { courseId: 'course-2' }
        ]
      };

      // Mock enrollments lookup
      mockDatabases.listDocuments.mockResolvedValueOnce(enrollments);

      // Mock getCourseProgress calls for each course
      // Course 1 mocks
      const sowv2_1 = { source_authored_sow_id: 'sow-1' };
      const authoredSOW_1 = { entries: JSON.stringify([{ order: 1 }]) };
      const course_1 = { subject: 'Math', level: 'N3' };

      // Course 2 mocks
      const sowv2_2 = { source_authored_sow_id: 'sow-2' };
      const authoredSOW_2 = { entries: JSON.stringify([{ order: 1 }]) };
      const course_2 = { subject: 'English', level: 'N4' };

      mockDatabases.listDocuments
        // Course 1
        .mockResolvedValueOnce({ documents: [sowv2_1] })
        .mockResolvedValueOnce({ documents: [] })
        .mockResolvedValueOnce({ documents: [] })
        .mockResolvedValueOnce({ documents: [] })
        // Course 2
        .mockResolvedValueOnce({ documents: [sowv2_2] })
        .mockResolvedValueOnce({ documents: [] })
        .mockResolvedValueOnce({ documents: [] })
        .mockResolvedValueOnce({ documents: [] });

      mockDatabases.getDocument
        .mockResolvedValueOnce(authoredSOW_1)
        .mockResolvedValueOnce(course_1)
        .mockResolvedValueOnce(authoredSOW_2)
        .mockResolvedValueOnce(course_2);

      const result = await getAllCoursesProgress('student-123', mockDatabases);

      expect(result).toHaveLength(2);
      expect(result[0].courseName).toBe('Math - N3');
      expect(result[1].courseName).toBe('English - N4');
    });
  });

  // ==========================================================================
  // isLessonCompleted() - Utility Tests
  // ==========================================================================

  describe('isLessonCompleted', () => {
    it('should return true if lesson is completed', async () => {
      mockDatabases.listDocuments.mockResolvedValueOnce({
        documents: [{
          lessonTemplateId: 'lesson-1',
          stage: 'done'
        }]
      });

      const result = await isLessonCompleted(
        'student-123',
        'course_c84473',
        'lesson-1',
        mockDatabases
      );

      expect(result).toBe(true);
      expect(mockDatabases.listDocuments).toHaveBeenCalledWith(
        'default',
        'sessions',
        [
          Query.equal('studentId', 'student-123'),
          Query.equal('courseId', 'course_c84473'),
          Query.equal('lessonTemplateId', 'lesson-1'),
          Query.equal('stage', 'done')
        ]
      );
    });

    it('should return false if lesson is not completed', async () => {
      mockDatabases.listDocuments.mockResolvedValueOnce({ documents: [] });

      const result = await isLessonCompleted(
        'student-123',
        'course_c84473',
        'lesson-1',
        mockDatabases
      );

      expect(result).toBe(false);
    });
  });
});
