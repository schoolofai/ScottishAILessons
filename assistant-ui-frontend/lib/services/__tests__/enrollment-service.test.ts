/**
 * Unit Tests for Enrollment Service - Phase 1 MVP2
 *
 * Tests the complete enrollment pipeline with SOWV2 reference architecture.
 * Following Outside-In TDD approach from Phase 1 spec.
 */

import { Databases, ID, Query } from 'appwrite';
import {
  enrollStudentInCourse,
  checkEnrollmentExists,
  unenrollStudentFromCourse,
  EnrollmentError,
  EnrollmentResult
} from '../enrollment-service';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock Appwrite SDK
jest.mock('appwrite');

describe('Enrollment Service', () => {
  let mockDatabases: jest.Mocked<Databases>;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Create mock Databases instance
    mockDatabases = {
      listDocuments: jest.fn(),
      getDocument: jest.fn(),
      createDocument: jest.fn(),
      deleteDocument: jest.fn()
    } as any;
  });

  // ==========================================================================
  // enrollStudentInCourse() - Main Function Tests
  // ==========================================================================

  describe('enrollStudentInCourse', () => {
    // ACCEPTANCE TEST: Full enrollment pipeline
    it('should create enrollment, SOWV2 reference, and MasteryV2', async () => {
      // Setup: Mock student
      const mockStudent = {
        $id: 'student-123',
        userId: 'user-456'
      };

      // Setup: Mock Authored_SOW
      const mockAuthoredSOW = {
        $id: 'authored-sow-789',
        courseId: 'course_c84473',
        version: 'v1.0',
        status: 'published',
        entries: JSON.stringify([
          { order: 1, lessonTemplateRef: 'lesson-1' },
          { order: 2, lessonTemplateRef: 'lesson-2' }
        ])
      };

      // Setup: Mock course outcomes
      const mockOutcomes = {
        documents: [
          { outcomeRef: 'MTH-3-01a' },
          { outcomeRef: 'MTH-3-02a' },
          { outcomeRef: 'MTH-3-03a' }
        ]
      };

      // Setup: Mock responses
      mockDatabases.listDocuments
        // 1. Check existing enrollment (none)
        .mockResolvedValueOnce({ documents: [] })
        // 2. Get Authored_SOW (found)
        .mockResolvedValueOnce({ documents: [mockAuthoredSOW] })
        // 3. Get course outcomes
        .mockResolvedValueOnce(mockOutcomes);

      mockDatabases.getDocument
        // Get student for userId
        .mockResolvedValueOnce(mockStudent);

      mockDatabases.createDocument
        // 1. Create enrollment
        .mockResolvedValueOnce({
          $id: 'enrollment-abc',
          studentId: 'student-123',
          courseId: 'course_c84473',
          role: 'student',
          enrolledAt: expect.any(String)
        })
        // 2. Create SOWV2 reference
        .mockResolvedValueOnce({
          $id: 'sowv2-def',
          studentId: 'student-123',
          courseId: 'course_c84473',
          source_authored_sow_id: 'authored-sow-789',
          source_version: 'v1.0',
          customizations: '{}',
          createdAt: expect.any(String)
        })
        // 3. Create MasteryV2
        .mockResolvedValueOnce({
          $id: 'mastery-ghi',
          studentId: 'student-123',
          courseId: 'course_c84473',
          emaByOutcome: JSON.stringify({
            'MTH-3-01a': 0.0,
            'MTH-3-02a': 0.0,
            'MTH-3-03a': 0.0
          }),
          updatedAt: expect.any(String)
        });

      // Execute
      const result: EnrollmentResult = await enrollStudentInCourse(
        'student-123',
        'course_c84473',
        mockDatabases
      );

      // Verify enrollment created
      expect(result.enrollment.studentId).toBe('student-123');
      expect(result.enrollment.courseId).toBe('course_c84473');
      expect(result.enrollment.role).toBe('student');

      // Verify SOWV2 reference (NOT copy!)
      expect(result.sowv2.source_authored_sow_id).toBe(mockAuthoredSOW.$id);
      expect(result.sowv2.source_version).toBe(mockAuthoredSOW.version);
      expect(result.sowv2.customizations).toBe('{}');
      expect(result.sowv2).not.toHaveProperty('entries');  // No duplication!

      // Verify MasteryV2 initialized
      const emaByOutcome = JSON.parse(result.masteryv2.emaByOutcome);
      expect(Object.keys(emaByOutcome).length).toBe(3);
      expect(Object.values(emaByOutcome).every(v => v === 0.0)).toBe(true);

      // Verify database calls
      expect(mockDatabases.createDocument).toHaveBeenCalledTimes(3);
    });

    // ERROR HANDLING: Duplicate enrollment
    it('should throw DUPLICATE_ENROLLMENT if already enrolled', async () => {
      // Setup: Existing enrollment
      mockDatabases.listDocuments.mockResolvedValueOnce({
        documents: [{
          $id: 'existing-enrollment',
          studentId: 'student-123',
          courseId: 'course_c84473',
          role: 'student'
        }]
      });

      // Execute & Verify
      await expect(
        enrollStudentInCourse('student-123', 'course_c84473', mockDatabases)
      ).rejects.toMatchObject({
        name: 'EnrollmentError',
        code: 'DUPLICATE_ENROLLMENT',
        message: expect.stringContaining('already enrolled')
      });

      // Verify no documents created
      expect(mockDatabases.createDocument).not.toHaveBeenCalled();
    });

    // ERROR HANDLING: Missing Authored_SOW
    it('should throw NO_AUTHORED_SOW if curriculum template missing', async () => {
      const mockStudent = { $id: 'student-123', userId: 'user-456' };

      // Setup: No existing enrollment
      mockDatabases.listDocuments
        .mockResolvedValueOnce({ documents: [] })  // Check enrollment
        .mockResolvedValueOnce({ documents: [] });  // No Authored_SOW!

      mockDatabases.getDocument.mockResolvedValueOnce(mockStudent);

      mockDatabases.createDocument.mockResolvedValueOnce({
        $id: 'enrollment-abc',
        studentId: 'student-123',
        courseId: 'invalid-course'
      });

      // Execute & Verify
      await expect(
        enrollStudentInCourse('student-123', 'invalid-course', mockDatabases)
      ).rejects.toMatchObject({
        name: 'EnrollmentError',
        code: 'NO_AUTHORED_SOW',
        message: expect.stringContaining('No published Authored_SOW')
      });

      // Verify rollback: enrollment should be deleted
      expect(mockDatabases.deleteDocument).toHaveBeenCalledWith(
        'default',
        'enrollments',
        'enrollment-abc'
      );
    });

    // ROLLBACK: Transaction failure
    it('should rollback enrollment if SOWV2 creation fails', async () => {
      const mockStudent = { $id: 'student-123', userId: 'user-456' };
      const mockAuthoredSOW = {
        $id: 'authored-sow-789',
        courseId: 'course_c84473',
        version: 'v1.0',
        status: 'published'
      };

      // Setup: Enrollment succeeds, but SOWV2 creation fails
      mockDatabases.listDocuments
        .mockResolvedValueOnce({ documents: [] })  // No existing enrollment
        .mockResolvedValueOnce({ documents: [mockAuthoredSOW] });  // Authored_SOW found

      mockDatabases.getDocument.mockResolvedValueOnce(mockStudent);

      mockDatabases.createDocument
        .mockResolvedValueOnce({  // Enrollment OK
          $id: 'enrollment-123',
          studentId: 'student-123',
          courseId: 'course_c84473'
        })
        .mockRejectedValueOnce(new Error('SOWV2 creation failed'));  // SOWV2 fails

      // Execute & Verify
      await expect(
        enrollStudentInCourse('student-123', 'course_c84473', mockDatabases)
      ).rejects.toThrow();

      // Verify enrollment was deleted (rollback)
      expect(mockDatabases.deleteDocument).toHaveBeenCalledWith(
        'default',
        'enrollments',
        'enrollment-123'
      );
    });

    it('should rollback SOWV2 and enrollment if MasteryV2 creation fails', async () => {
      const mockStudent = { $id: 'student-123', userId: 'user-456' };
      const mockAuthoredSOW = {
        $id: 'authored-sow-789',
        courseId: 'course_c84473',
        version: 'v1.0',
        status: 'published'
      };
      const mockOutcomes = { documents: [{ outcomeRef: 'MTH-3-01a' }] };

      // Setup: Enrollment and SOWV2 succeed, MasteryV2 fails
      mockDatabases.listDocuments
        .mockResolvedValueOnce({ documents: [] })  // No existing enrollment
        .mockResolvedValueOnce({ documents: [mockAuthoredSOW] })  // Authored_SOW found
        .mockResolvedValueOnce(mockOutcomes);  // Outcomes found

      mockDatabases.getDocument.mockResolvedValueOnce(mockStudent);

      mockDatabases.createDocument
        .mockResolvedValueOnce({  // Enrollment OK
          $id: 'enrollment-123',
          studentId: 'student-123',
          courseId: 'course_c84473'
        })
        .mockResolvedValueOnce({  // SOWV2 OK
          $id: 'sowv2-456',
          source_authored_sow_id: 'authored-sow-789'
        })
        .mockRejectedValueOnce(new Error('MasteryV2 creation failed'));  // MasteryV2 fails

      // Execute & Verify
      await expect(
        enrollStudentInCourse('student-123', 'course_c84473', mockDatabases)
      ).rejects.toThrow();

      // Verify rollback: SOWV2 and enrollment deleted
      expect(mockDatabases.deleteDocument).toHaveBeenCalledWith(
        'default',
        'SOWV2',
        'sowv2-456'
      );
      expect(mockDatabases.deleteDocument).toHaveBeenCalledWith(
        'default',
        'enrollments',
        'enrollment-123'
      );
    });
  });

  // ==========================================================================
  // checkEnrollmentExists() - Helper Function Tests
  // ==========================================================================

  describe('checkEnrollmentExists', () => {
    it('should return true if enrollment exists', async () => {
      mockDatabases.listDocuments.mockResolvedValueOnce({
        documents: [{
          $id: 'enrollment-123',
          studentId: 'student-123',
          courseId: 'course_c84473'
        }]
      });

      const result = await checkEnrollmentExists(
        'student-123',
        'course_c84473',
        mockDatabases
      );

      expect(result).toBe(true);
      expect(mockDatabases.listDocuments).toHaveBeenCalledWith(
        'default',
        'enrollments',
        [
          Query.equal('studentId', 'student-123'),
          Query.equal('courseId', 'course_c84473')
        ]
      );
    });

    it('should return false if no enrollment exists', async () => {
      mockDatabases.listDocuments.mockResolvedValueOnce({ documents: [] });

      const result = await checkEnrollmentExists(
        'student-123',
        'course_c84473',
        mockDatabases
      );

      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // unenrollStudentFromCourse() - Cleanup Function Tests
  // ==========================================================================

  describe('unenrollStudentFromCourse', () => {
    it('should delete enrollment pipeline in correct order', async () => {
      // Setup: Mock existing records
      const mockSessions = {
        documents: [{ $id: 'session-1' }, { $id: 'session-2' }]
      };
      const mockMastery = {
        documents: [{ $id: 'mastery-1' }]
      };
      const mockSOWV2 = {
        documents: [{ $id: 'sowv2-1' }]
      };
      const mockEnrollment = {
        documents: [{ $id: 'enrollment-1' }]
      };

      mockDatabases.listDocuments
        // Sessions
        .mockResolvedValueOnce(mockSessions)
        // Evidence for session-1 (none)
        .mockResolvedValueOnce({ documents: [] })
        // Evidence for session-2 (none)
        .mockResolvedValueOnce({ documents: [] })
        // MasteryV2
        .mockResolvedValueOnce(mockMastery)
        // SOWV2
        .mockResolvedValueOnce(mockSOWV2)
        // Enrollment
        .mockResolvedValueOnce(mockEnrollment);

      // Execute
      await unenrollStudentFromCourse('student-123', 'course_c84473', mockDatabases);

      // Verify deletion order
      const deleteCalls = mockDatabases.deleteDocument.mock.calls;
      expect(deleteCalls[0]).toEqual(['default', 'sessions', 'session-1']);
      expect(deleteCalls[1]).toEqual(['default', 'sessions', 'session-2']);
      expect(deleteCalls[2]).toEqual(['default', 'MasteryV2', 'mastery-1']);
      expect(deleteCalls[3]).toEqual(['default', 'SOWV2', 'sowv2-1']);
      expect(deleteCalls[4]).toEqual(['default', 'enrollments', 'enrollment-1']);
    });

    it('should keep sessions with evidence', async () => {
      const mockSessions = {
        documents: [{ $id: 'session-with-evidence' }]
      };

      mockDatabases.listDocuments
        // Sessions
        .mockResolvedValueOnce(mockSessions)
        // Evidence exists for this session!
        .mockResolvedValueOnce({
          documents: [{ $id: 'evidence-1', sessionId: 'session-with-evidence' }]
        })
        // MasteryV2 (empty)
        .mockResolvedValueOnce({ documents: [] })
        // SOWV2 (empty)
        .mockResolvedValueOnce({ documents: [] })
        // Enrollment (empty)
        .mockResolvedValueOnce({ documents: [] });

      // Execute
      await unenrollStudentFromCourse('student-123', 'course_c84473', mockDatabases);

      // Verify session was NOT deleted
      expect(mockDatabases.deleteDocument).not.toHaveBeenCalledWith(
        'default',
        'sessions',
        'session-with-evidence'
      );
    });

    it('should throw DATABASE_ERROR on failure', async () => {
      mockDatabases.listDocuments.mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      await expect(
        unenrollStudentFromCourse('student-123', 'course_c84473', mockDatabases)
      ).rejects.toMatchObject({
        name: 'EnrollmentError',
        code: 'DATABASE_ERROR',
        message: expect.stringContaining('Unenrollment failed')
      });
    });
  });
});
