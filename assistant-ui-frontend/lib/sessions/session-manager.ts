/**
 * Session Management Utility
 *
 * Provides reusable functions for creating lesson sessions with full lesson content.
 * Supports optional thread ID for continuity between recommendations and teaching.
 */

import { ID, Databases, Account, Client } from 'appwrite';

export interface StartLessonParams {
  lessonTemplateId: string;
  studentId: string;
  courseId: string;
  threadId?: string;  // Optional for continuity from recommendations
}

export interface LessonSession {
  $id: string;
  studentId: string;
  courseId: string;
  lessonTemplateId: string;
  threadId?: string;
  startedAt: string;
  stage: string;
  lessonSnapshot: string;
}

/**
 * Creates a new lesson session in Appwrite with complete lesson content.
 *
 * This function:
 * 1. Loads the full lesson template from Appwrite
 * 2. Creates a complete lesson snapshot with cards and content
 * 3. Stores the session in Appwrite
 * 4. Optionally preserves thread ID for continuity
 *
 * @param params Session creation parameters
 * @returns Created session document
 */
export async function createLessonSession(params: StartLessonParams): Promise<LessonSession> {
  const { lessonTemplateId, studentId, courseId, threadId } = params;

  try {
    // Setup Appwrite client
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

    // Get session from localStorage and set it
    const cookieFallback = localStorage.getItem('cookieFallback');
    if (cookieFallback) {
      try {
        const cookieData = JSON.parse(cookieFallback);
        const sessionKey = `a_session_${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`;
        const storedSession = cookieData[sessionKey];
        if (storedSession) {
          client.setSession(storedSession);
        }
      } catch (e) {
        console.warn('Failed to parse cookieFallback:', e);
      }
    }

    const account = new Account(client);
    const databases = new Databases(client);
    const user = await account.get();

    console.log('createLessonSession - Loading lesson template:', lessonTemplateId);

    // Get the full lesson template document
    const lessonTemplate = await databases.getDocument(
      'default',
      'lesson_templates',
      lessonTemplateId
    );

    console.log('createLessonSession - Lesson template loaded:', lessonTemplate.title);

    // Create the lesson snapshot with FULL CONTENT
    const lessonSnapshot = {
      lessonTemplateId,
      courseId,
      title: lessonTemplate.title,
      outcomeRefs: JSON.parse(lessonTemplate.outcomeRefs || '[]'),  // Parse JSON string
      cards: JSON.parse(lessonTemplate.cards || '[]'),              // Parse JSON string - CRITICAL!
      templateVersion: lessonTemplate.version || 1,
      estMinutes: lessonTemplate.estMinutes || 30,
      startedAt: new Date().toISOString()
    };

    console.log('createLessonSession - Lesson snapshot created:', {
      title: lessonSnapshot.title,
      cardCount: lessonSnapshot.cards.length,
      outcomeCount: lessonSnapshot.outcomeRefs.length,
      hasThreadId: !!threadId
    });

    // Prepare session data
    const sessionData: Record<string, any> = {
      studentId,
      courseId: courseId.replace(/\s+/g, '_'), // Sanitize for Appwrite ID constraints
      lessonTemplateId,
      startedAt: new Date().toISOString(),
      stage: 'design',
      lessonSnapshot: JSON.stringify(lessonSnapshot)  // Stringify for storage
    };

    // Include threadId if provided (for continuity from EnhancedDashboard)
    if (threadId) {
      sessionData.threadId = threadId;
      console.log('createLessonSession - Including threadId for continuity:', threadId);
    }

    // Create session in Appwrite
    const newSession = await databases.createDocument(
      'default',
      'sessions',
      ID.unique(),
      sessionData,
      [`read("user:${user.$id}")`, `write("user:${user.$id}")`]  // Permissions
    ) as LessonSession;

    console.log('createLessonSession - Session created successfully:', {
      sessionId: newSession.$id,
      courseId: newSession.courseId,
      lessonTemplateId: newSession.lessonTemplateId,
      hasThreadId: !!newSession.threadId
    });

    return newSession;

  } catch (error) {
    console.error('createLessonSession - Error creating session:', error);
    throw new Error(`Failed to create lesson session: ${error.message}`);
  }
}

/**
 * Convenience function for extracting lesson snapshot from session
 */
export function parseLessonSnapshot(lessonSnapshot: string) {
  try {
    return JSON.parse(lessonSnapshot);
  } catch (error) {
    console.error('Failed to parse lesson snapshot:', error);
    throw new Error('Invalid lesson snapshot data');
  }
}