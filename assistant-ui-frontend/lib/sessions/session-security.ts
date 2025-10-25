/**
 * Session Security Utilities
 *
 * Provides secure session management with:
 * - Access control validation
 * - Race-condition safe session creation
 * - Idempotent operations
 * - Comprehensive logging
 */

import { Databases, Query } from 'appwrite';
import { logger } from '@/lib/logger';

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

/**
 * Idempotent session creation with race condition prevention
 * Uses atomic check before creation to handle concurrent requests
 *
 * @returns Object with sessionId and isNew flag
 */
export async function createOrGetActiveSession(
  databases: Databases,
  params: {
    lessonTemplateId: string;
    studentId: string;
    courseId: string;
    threadId?: string;
  }
): Promise<{ sessionId: string; isNew: boolean }> {
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
    // Check for existing active session (SECURITY: studentId filter)
    logger.debug('checking_for_active_session', {
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

    if (activeSessions.documents.length > 0) {
      const existingSession = activeSessions.documents[0];

      // Validate session data (fail fast)
      if (!existingSession.startedAt) {
        logger.error('corrupted_session_data', {
          sessionId: existingSession.$id,
          issue: 'missing_startedAt'
        });
        throw new Error(`Corrupted session data: ${existingSession.$id}`);
      }

      const sessionAge = Date.now() - new Date(existingSession.startedAt).getTime();

      logger.info('session_reuse', {
        sessionId: existingSession.$id,
        lessonTemplateId,
        studentId,
        ageMs: sessionAge,
        ageDays: Math.floor(sessionAge / (24 * 60 * 60 * 1000))
      });

      return {
        sessionId: existingSession.$id,
        isNew: false
      };
    }

    // Create new session with comprehensive logging
    logger.info('creating_new_session', {
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

    logger.info('session_created', {
      sessionId: newSession.$id,
      lessonTemplateId,
      studentId,
      courseId,
      hasThreadId: !!threadId
    });

    return {
      sessionId: newSession.$id,
      isNew: true
    };
  } catch (error) {
    logger.error('createOrGetActiveSession_failed', {
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
 * Abandon active session and create new one
 * Requires explicit user confirmation
 *
 * @returns New session ID
 */
export async function abandonAndRestart(
  databases: Databases,
  activeSessionId: string,
  studentId: string,
  lessonTemplateId: string,
  courseId: string,
  threadId?: string
): Promise<string> {
  if (!activeSessionId || !studentId || !lessonTemplateId || !courseId) {
    throw new Error('Missing required parameters for abandonAndRestart');
  }

  try {
    // Validate access first
    await validateSessionAccess(databases, activeSessionId, studentId);

    logger.info('abandoning_session', {
      sessionId: activeSessionId,
      lessonTemplateId,
      studentId
    });

    // Mark as abandoned
    await databases.updateDocument(
      'default',
      'sessions',
      activeSessionId,
      { status: 'abandoned' }
    );

    logger.info('session_abandoned', {
      sessionId: activeSessionId,
      lessonTemplateId,
      studentId
    });

    // Create new session
    const { sessionId } = await createOrGetActiveSession(databases, {
      lessonTemplateId,
      studentId,
      courseId,
      threadId
    });

    logger.info('session_restarted', {
      oldSessionId: activeSessionId,
      newSessionId: sessionId,
      lessonTemplateId,
      studentId
    });

    return sessionId;
  } catch (error) {
    logger.error('abandonAndRestart_failed', {
      activeSessionId,
      lessonTemplateId,
      studentId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

/**
 * Get session status for a lesson
 * Returns comprehensive status information for UI rendering
 */
export async function getLessonStatus(
  databases: Databases,
  lessonTemplateId: string,
  studentId: string,
  isPublished: boolean
): Promise<{
  state: 'never_started' | 'in_progress' | 'completed' | 'locked';
  action: 'start' | 'continue' | 'retake' | 'locked';
  activeSessionId?: string;
  completedCount: number;
  lastActivity?: string;
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
    // Query active sessions (SECURITY: studentId filter)
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

    // Get completed session count
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

    const activeSession = activeSessions.documents[0] || null;
    const completedCount = completedSessionsResult.total;

    // Determine state
    if (activeSession) {
      // Validate session data
      if (!activeSession.startedAt) {
        logger.error('session_missing_startedAt', {
          sessionId: activeSession.$id,
          lessonTemplateId,
          studentId
        });
        throw new Error(`Corrupted session data: ${activeSession.$id}`);
      }

      return {
        state: 'in_progress',
        action: 'continue',
        activeSessionId: activeSession.$id,
        completedCount,
        lastActivity: activeSession.updatedAt || activeSession.startedAt
      };
    } else if (completedCount > 0) {
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
    logger.error('getLessonStatus_failed', {
      lessonTemplateId,
      studentId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
