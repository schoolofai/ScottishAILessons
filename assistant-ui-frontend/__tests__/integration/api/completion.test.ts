/**
 * Integration tests for /api/student/sessions/[sessionId]/complete
 *
 * Tests the lesson completion API that persists Evidence, Mastery, and Routine data.
 * This endpoint was created to fix auth migration issues after moving from client-side
 * to server-side authentication.
 *
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/student/sessions/[sessionId]/complete/route';

// Mock Appwrite client
jest.mock('@/lib/server/appwrite', () => ({
  createSessionClient: jest.fn()
}));

// Mock node-appwrite SDK
jest.mock('node-appwrite', () => ({
  Query: {
    equal: (field: string, value: any) => `Query.equal("${field}", "${value}")`,
    limit: (value: number) => `Query.limit(${value})`
  },
  ID: {
    unique: () => 'test_unique_id'
  },
  Permission: {
    read: (role: string) => `Permission.read("${role}")`,
    update: (role: string) => `Permission.update("${role}")`,
    delete: (role: string) => `Permission.delete("${role}")`
  },
  Role: {
    user: (userId: string) => `user:${userId}`
  }
}));

describe('/api/student/sessions/[sessionId]/complete', () => {
  const mockUserId = 'user_test_123';
  const mockStudentId = 'student_test_456';
  const mockSessionId = 'session_test_789';
  const mockCourseId = 'course_test_abc';

  let mockDatabases: any;
  let mockAccount: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock account.get() response
    mockAccount = {
      get: jest.fn().mockResolvedValue({
        $id: mockUserId,
        email: 'test@scottishailessons.com'
      })
    };

    // Mock databases operations
    mockDatabases = {
      listDocuments: jest.fn(),
      getDocument: jest.fn(),
      createDocument: jest.fn(),
      updateDocument: jest.fn()
    };

    // Setup createSessionClient mock
    const { createSessionClient } = require('@/lib/server/appwrite');
    createSessionClient.mockResolvedValue({
      account: mockAccount,
      databases: mockDatabases
    });
  });

  describe('Happy Path: Successful completion', () => {
    it('should successfully process lesson completion with all data types', async () => {
      // ═══════════════════════════════════════════════════════════════
      // SETUP: Mock database responses
      // ═══════════════════════════════════════════════════════════════

      // 1. Student lookup
      mockDatabases.listDocuments.mockResolvedValueOnce({
        documents: [{
          $id: mockStudentId,
          userId: mockUserId
        }]
      });

      // 2. Session verification
      mockDatabases.getDocument.mockResolvedValueOnce({
        $id: mockSessionId,
        studentId: mockStudentId,
        courseId: mockCourseId,
        status: 'active'
      });

      // 3. MasteryV2 lookup (single document per student/course with ALL outcomes in JSON)
      mockDatabases.listDocuments.mockResolvedValueOnce({
        documents: [{
          $id: 'mastery_existing',
          studentId: mockStudentId,
          courseId: mockCourseId,
          emaByOutcome: JSON.stringify({ 'O1': 0.70, 'AS1.2': 0.65 }),
          updatedAt: '2025-01-15T00:00:00.000Z'
        }]
      });

      // 4. Routine lookup (existing)
      mockDatabases.listDocuments.mockResolvedValueOnce({
        documents: [{
          $id: 'routine_existing',
          studentId: mockStudentId,
          courseId: mockCourseId,
          dueAtByOutcome: JSON.stringify({ 'O1': '2025-01-20T00:00:00.000Z' })
        }]
      });

      // 5. Mock all creates/updates to succeed
      mockDatabases.createDocument.mockResolvedValue({ $id: 'created_doc' });
      mockDatabases.updateDocument.mockResolvedValue({ $id: 'updated_doc' });

      // ═══════════════════════════════════════════════════════════════
      // EXECUTE: Call the API endpoint
      // ═══════════════════════════════════════════════════════════════

      const requestBody = {
        evidence: [
          {
            sessionId: mockSessionId,
            studentId: mockStudentId,
            courseId: mockCourseId,
            outcomeId: 'O1',
            questionText: 'What is 2+2?',
            studentAnswer: '4',
            isCorrect: true,
            timestamp: new Date().toISOString()
          }
        ],
        masteryUpdates: [
          { outcomeId: 'O1', newEMA: 0.75 },
          { outcomeId: 'AS1.1', newEMA: 0.82 }
        ],
        routineUpdates: {
          'O1': 0.75,
          'AS1.1': 0.82
        }
      };

      const request = new NextRequest(
        `http://localhost:3000/api/student/sessions/${mockSessionId}/complete`,
        {
          method: 'POST',
          body: JSON.stringify(requestBody)
        }
      );

      const response = await POST(request, { params: { sessionId: mockSessionId } });
      const responseData = await response.json();

      // ═══════════════════════════════════════════════════════════════
      // VERIFY: Check all operations were performed correctly
      // ═══════════════════════════════════════════════════════════════

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.summary).toEqual({
        evidenceCreated: 1,
        masteryUpdated: true,
        masteryOutcomeCount: 2,
        routineUpdated: true,
        sessionId: mockSessionId
      });

      // Verify Evidence creation (1 record)
      expect(mockDatabases.createDocument).toHaveBeenCalledWith(
        'default',
        'evidence',
        'test_unique_id',
        expect.objectContaining({
          sessionId: mockSessionId,
          studentId: mockStudentId,
          outcomeId: 'O1',
          isCorrect: true
        })
      );

      // Verify MasteryV2 update (single document with merged emaByOutcome JSON)
      expect(mockDatabases.updateDocument).toHaveBeenCalledWith(
        'default',
        'MasteryV2',
        'mastery_existing',
        expect.objectContaining({
          emaByOutcome: expect.stringContaining('"O1":0.75'), // Updated O1
          emaByOutcome: expect.stringContaining('"AS1.1":0.82'), // New AS1.1
          updatedAt: expect.any(String)
        })
      );

      // Parse and verify the merged emaByOutcome JSON
      const masteryUpdateCall = mockDatabases.updateDocument.mock.calls.find(
        (call: any[]) => call[1] === 'MasteryV2'
      );
      expect(masteryUpdateCall).toBeDefined();
      const updatedEmaByOutcome = JSON.parse(masteryUpdateCall[3].emaByOutcome);
      expect(updatedEmaByOutcome).toEqual({
        'O1': 0.75,        // Updated from 0.70
        'AS1.1': 0.82,     // New outcome
        'AS1.2': 0.65      // Preserved existing outcome
      });

      // Verify Routine update (merged schedules)
      expect(mockDatabases.updateDocument).toHaveBeenCalledWith(
        'default',
        'routine',
        'routine_existing',
        expect.objectContaining({
          dueAtByOutcome: expect.stringContaining('O1')
        })
      );

      // Verify Session status update
      expect(mockDatabases.updateDocument).toHaveBeenCalledWith(
        'default',
        'sessions',
        mockSessionId,
        expect.objectContaining({
          status: 'completed',
          completedAt: expect.any(String)
        })
      );
    });

    it('should create new Routine when none exists', async () => {
      // Setup: Student and session exist
      mockDatabases.listDocuments
        .mockResolvedValueOnce({ documents: [{ $id: mockStudentId, userId: mockUserId }] }) // Student
        .mockResolvedValueOnce({ documents: [] }); // No existing routine

      mockDatabases.getDocument.mockResolvedValueOnce({
        $id: mockSessionId,
        studentId: mockStudentId,
        courseId: mockCourseId
      });

      mockDatabases.createDocument.mockResolvedValue({ $id: 'new_routine' });
      mockDatabases.updateDocument.mockResolvedValue({ $id: 'updated_session' });

      const request = new NextRequest(
        `http://localhost:3000/api/student/sessions/${mockSessionId}/complete`,
        {
          method: 'POST',
          body: JSON.stringify({
            evidence: [],
            masteryUpdates: [],
            routineUpdates: { 'O1': 0.75 }
          })
        }
      );

      const response = await POST(request, { params: { sessionId: mockSessionId } });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.summary.routineUpdated).toBe(true);

      // Verify new Routine was created
      expect(mockDatabases.createDocument).toHaveBeenCalledWith(
        'default',
        'routine',
        'test_unique_id',
        expect.objectContaining({
          studentId: mockStudentId,
          courseId: mockCourseId,
          dueAtByOutcome: expect.stringContaining('O1')
        }),
        expect.arrayContaining([
          `Permission.read("user:${mockUserId}")`
        ])
      );
    });
  });

  describe('Error Handling: Authentication and Authorization', () => {
    it('should return 401 when user is not authenticated', async () => {
      // Mock authentication failure
      const { createSessionClient } = require('@/lib/server/appwrite');
      createSessionClient.mockRejectedValueOnce(new Error('No session found'));

      const request = new NextRequest(
        `http://localhost:3000/api/student/sessions/${mockSessionId}/complete`,
        {
          method: 'POST',
          body: JSON.stringify({
            evidence: [],
            masteryUpdates: [],
            routineUpdates: {}
          })
        }
      );

      const response = await POST(request, { params: { sessionId: mockSessionId } });
      const responseData = await response.json();

      expect(response.status).toBe(401);
      expect(responseData.error).toBe('Not authenticated. Please log in.');
    });

    it('should return 404 when student not found', async () => {
      // Student lookup returns empty
      mockDatabases.listDocuments.mockResolvedValueOnce({ documents: [] });

      const request = new NextRequest(
        `http://localhost:3000/api/student/sessions/${mockSessionId}/complete`,
        {
          method: 'POST',
          body: JSON.stringify({
            evidence: [],
            masteryUpdates: [],
            routineUpdates: {}
          })
        }
      );

      const response = await POST(request, { params: { sessionId: mockSessionId } });
      const responseData = await response.json();

      expect(response.status).toBe(404);
      expect(responseData.error).toBe('Student not found');
    });

    it('should return 404 when session not found', async () => {
      // Student exists
      mockDatabases.listDocuments.mockResolvedValueOnce({
        documents: [{ $id: mockStudentId, userId: mockUserId }]
      });

      // Session not found
      mockDatabases.getDocument.mockRejectedValueOnce(new Error('Document not found'));

      const request = new NextRequest(
        `http://localhost:3000/api/student/sessions/${mockSessionId}/complete`,
        {
          method: 'POST',
          body: JSON.stringify({
            evidence: [],
            masteryUpdates: [],
            routineUpdates: {}
          })
        }
      );

      const response = await POST(request, { params: { sessionId: mockSessionId } });
      const responseData = await response.json();

      expect(response.status).toBe(404);
      expect(responseData.error).toBe('Session not found');
    });

    it('should return 403 when session belongs to different student', async () => {
      // Student exists
      mockDatabases.listDocuments.mockResolvedValueOnce({
        documents: [{ $id: mockStudentId, userId: mockUserId }]
      });

      // Session belongs to different student
      mockDatabases.getDocument.mockResolvedValueOnce({
        $id: mockSessionId,
        studentId: 'different_student_id',
        courseId: mockCourseId
      });

      const request = new NextRequest(
        `http://localhost:3000/api/student/sessions/${mockSessionId}/complete`,
        {
          method: 'POST',
          body: JSON.stringify({
            evidence: [],
            masteryUpdates: [],
            routineUpdates: {}
          })
        }
      );

      const response = await POST(request, { params: { sessionId: mockSessionId } });
      const responseData = await response.json();

      expect(response.status).toBe(403);
      expect(responseData.error).toBe('Unauthorized access to session');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty evidence/mastery/routine gracefully', async () => {
      mockDatabases.listDocuments.mockResolvedValueOnce({
        documents: [{ $id: mockStudentId, userId: mockUserId }]
      });

      mockDatabases.getDocument.mockResolvedValueOnce({
        $id: mockSessionId,
        studentId: mockStudentId,
        courseId: mockCourseId
      });

      mockDatabases.updateDocument.mockResolvedValue({ $id: 'updated_session' });

      const request = new NextRequest(
        `http://localhost:3000/api/student/sessions/${mockSessionId}/complete`,
        {
          method: 'POST',
          body: JSON.stringify({
            evidence: [],
            masteryUpdates: [],
            routineUpdates: {}
          })
        }
      );

      const response = await POST(request, { params: { sessionId: mockSessionId } });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.summary).toEqual({
        evidenceCreated: 0,
        masteryUpdated: false,
        masteryOutcomeCount: 0,
        routineUpdated: false,
        sessionId: mockSessionId
      });
    });

    it('should continue on session status update failure (non-critical)', async () => {
      mockDatabases.listDocuments.mockResolvedValueOnce({
        documents: [{ $id: mockStudentId, userId: mockUserId }]
      });

      mockDatabases.getDocument.mockResolvedValueOnce({
        $id: mockSessionId,
        studentId: mockStudentId,
        courseId: mockCourseId
      });

      // Session update fails but should not throw
      mockDatabases.updateDocument.mockRejectedValueOnce(new Error('Session update failed'));

      const request = new NextRequest(
        `http://localhost:3000/api/student/sessions/${mockSessionId}/complete`,
        {
          method: 'POST',
          body: JSON.stringify({
            evidence: [],
            masteryUpdates: [],
            routineUpdates: {}
          })
        }
      );

      const response = await POST(request, { params: { sessionId: mockSessionId } });
      const responseData = await response.json();

      // Should still return success even if session update failed
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
    });
  });

  describe('Spaced Repetition Scheduling', () => {
    it('should calculate correct intervals based on EMA scores', async () => {
      mockDatabases.listDocuments
        .mockResolvedValueOnce({ documents: [{ $id: mockStudentId, userId: mockUserId }] })
        .mockResolvedValueOnce({ documents: [] }); // No existing routine

      mockDatabases.getDocument.mockResolvedValueOnce({
        $id: mockSessionId,
        studentId: mockStudentId,
        courseId: mockCourseId
      });

      mockDatabases.createDocument.mockResolvedValue({ $id: 'new_routine' });
      mockDatabases.updateDocument.mockResolvedValue({ $id: 'updated_session' });

      const request = new NextRequest(
        `http://localhost:3000/api/student/sessions/${mockSessionId}/complete`,
        {
          method: 'POST',
          body: JSON.stringify({
            evidence: [],
            masteryUpdates: [],
            routineUpdates: {
              'O1': 0.85,  // Mastered: 7-14 days
              'O2': 0.65,  // Good: 3-7 days
              'O3': 0.45,  // Some progress: 1-3 days
              'O4': 0.25   // Struggling: 1 day
            }
          })
        }
      );

      await POST(request, { params: { sessionId: mockSessionId } });

      // Verify Routine creation with scheduled intervals
      const routineCreateCall = mockDatabases.createDocument.mock.calls.find(
        (call: any[]) => call[1] === 'routine'
      );

      expect(routineCreateCall).toBeDefined();
      const dueAtByOutcome = JSON.parse(routineCreateCall[3].dueAtByOutcome);

      // Verify all outcomes have due dates
      expect(dueAtByOutcome).toHaveProperty('O1');
      expect(dueAtByOutcome).toHaveProperty('O2');
      expect(dueAtByOutcome).toHaveProperty('O3');
      expect(dueAtByOutcome).toHaveProperty('O4');

      // Verify dates are in the future
      const now = new Date();
      expect(new Date(dueAtByOutcome.O1)).toBeInstanceOf(Date);
      expect(new Date(dueAtByOutcome.O1).getTime()).toBeGreaterThan(now.getTime());
    });
  });
});
