/**
 * Session Creation Utilities (v3)
 *
 * Simplified session management:
 * - Always creates fresh sessions
 * - Auto-abandons any existing active session
 * - No resume/continue functionality
 */

import { Databases, Query } from 'appwrite';
import { logger } from '@/lib/logger';

/**
 * Create a fresh session, abandoning any existing active session
 *
 * This implements the v3 behavior where:
 * - Users always start lessons fresh
 * - Any existing active session is automatically abandoned
 * - No resume/continue functionality
 *
 * @returns New session ID
 * @throws Error if creation fails (fail fast - no fallbacks)
 */
export async function createFreshSession(
  databases: Databases,
  params: {
    lessonTemplateId: string;
    studentId: string;
    courseId: string;
    threadId?: string;
  }
): Promise<string> {
  const { lessonTemplateId, studentId, courseId, threadId } = params;

  // Validate inputs (fail fast - no fallbacks per CLAUDE.md)
  if (!lessonTemplateId || !studentId || !courseId) {
    const missingParams = [];
    if (!lessonTemplateId) missingParams.push('lessonTemplateId');
    if (!studentId) missingParams.push('studentId');
    if (!courseId) missingParams.push('courseId');

    throw new Error(`Missing required parameters: ${missingParams.join(', ')}`);
  }

  try {
    // Step 1: Check for existing active session (SECURITY: studentId filter)
    logger.debug('checking_for_active_session_to_abandon', {
      lessonTemplateId,
      studentId,
      courseId
    });

    const activeSessions = await databases.listDocuments(
      'default',
      'sessions',
      [
        Query.equal('studentId', studentId),
        Query.equal('lessonTemplateId', lessonTemplateId),
        Query.equal('status', 'active'),
        Query.orderDesc('startedAt'),
        Query.limit(1)
      ]
    );

    // Step 2: Abandon existing active session if found
    if (activeSessions.documents.length > 0) {
      const existingSession = activeSessions.documents[0];

      logger.info('abandoning_existing_session', {
        sessionId: existingSession.$id,
        lessonTemplateId,
        studentId
      });

      await databases.updateDocument(
        'default',
        'sessions',
        existingSession.$id,
        { status: 'abandoned' }
      );

      logger.info('existing_session_abandoned', {
        sessionId: existingSession.$id,
        lessonTemplateId,
        studentId
      });
    }

    // Step 3: Create new session
    logger.info('creating_fresh_session', {
      lessonTemplateId,
      studentId,
      courseId,
      hasThreadId: !!threadId
    });

    const { createLessonSession } = await import('@/lib/sessions/session-manager');

    const newSession = await createLessonSession({
      lessonTemplateId,
      studentId,
      courseId,
      threadId
    });

    logger.info('fresh_session_created', {
      sessionId: newSession.$id,
      lessonTemplateId,
      studentId,
      courseId,
      hasThreadId: !!threadId
    });

    return newSession.$id;
  } catch (error) {
    logger.error('createFreshSession_failed', {
      lessonTemplateId,
      studentId,
      courseId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

/**
 * Get session status for a lesson (v3 simplified)
 *
 * Returns status information for UI rendering:
 * - never_started: No completed sessions
 * - completed: At least one completed session
 * - locked: Lesson is not published
 *
 * Note: No "in_progress" state in v3 - abandoned sessions are ignored
 */
export async function getLessonStatusV3(
  databases: Databases,
  lessonTemplateId: string,
  studentId: string,
  isPublished: boolean
): Promise<{
  state: 'never_started' | 'completed' | 'locked';
  action: 'start' | 'retake' | 'locked';
  completedCount: number;
}> {
  // Validate inputs
  if (!lessonTemplateId || !studentId) {
    throw new Error('Invalid parameters: lessonTemplateId and studentId required');
  }

  // LOCKED state takes precedence
  if (!isPublished) {
    return {
      state: 'locked',
      action: 'locked',
      completedCount: 0
    };
  }

  try {
    // Get completed session count (SECURITY: studentId filter)
    const completedSessionsResult = await databases.listDocuments(
      'default',
      'sessions',
      [
        Query.equal('studentId', studentId),
        Query.equal('lessonTemplateId', lessonTemplateId),
        Query.equal('status', 'completed'),
        Query.limit(1) // We only need count
      ]
    );

    const completedCount = completedSessionsResult.total;

    // Determine state (v3 simplified - only never_started or completed)
    if (completedCount > 0) {
      return {
        state: 'completed',
        action: 'retake',
        completedCount
      };
    } else {
      return {
        state: 'never_started',
        action: 'start',
        completedCount: 0
      };
    }
  } catch (error) {
    logger.error('getLessonStatusV3_failed', {
      lessonTemplateId,
      studentId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Security middleware for session access
 * Prevents users from accessing other students' sessions
 *
 * @throws Error if session doesn't exist or studentId doesn't match
 */
export async function validateSessionAccess(
  databases: Databases,
  sessionId: string,
  studentId: string
): Promise<void> {
  if (!sessionId || !studentId) {
    throw new Error('Session validation requires sessionId and studentId');
  }

  try {
    const session = await databases.getDocument(
      'default',
      'sessions',
      sessionId
    );

    if (session.studentId !== studentId) {
      logger.warn('unauthorized_session_access_attempt', {
        sessionId,
        requestingStudentId: studentId,
        sessionOwnerStudentId: session.studentId
      });
      throw new Error('Unauthorized: Cannot access another student\'s session');
    }

    logger.debug('session_access_validated', { sessionId, studentId });
  } catch (error) {
    logger.error('validateSessionAccess_failed', {
      sessionId,
      studentId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
