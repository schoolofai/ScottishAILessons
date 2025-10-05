/**
 * Progress Service - Phase 1 MVP2
 *
 * Calculates course progress metrics from sessions and mastery.
 * Uses SOWV2 reference architecture to dereference Authored_SOW for curriculum data.
 */

import { Databases, Query } from 'appwrite';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface CourseProgress {
  courseId: string;
  courseName: string;
  totalLessons: number;
  completedLessons: number;
  progressPercentage: number;
  averageMastery: number;  // 0-1 scale
  lastActivity: string | null;  // ISO datetime
  estimatedTimeRemaining: number;  // minutes
  completedLessonIds: string[];  // For filtering
}

// ============================================================================
// Error Handling
// ============================================================================

export class ProgressError extends Error {
  constructor(
    public code: 'NO_SOWV2' | 'NO_AUTHORED_SOW' | 'DATABASE_ERROR',
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ProgressError';
  }
}

// ============================================================================
// Main Progress Function
// ============================================================================

/**
 * Calculates comprehensive progress metrics for a student's course enrollment.
 *
 * Data sources:
 * 1. SOWV2 → Authored_SOW (dereference for total lessons)
 * 2. Sessions (completed count)
 * 3. MasteryV2 (average mastery)
 *
 * @throws {ProgressError} If SOWV2 or Authored_SOW not found
 */
export async function getCourseProgress(
  studentId: string,
  courseId: string,
  databases: Databases
): Promise<CourseProgress> {
  console.log('[Progress Service] Calculating progress:', { studentId, courseId });

  try {
    // 1. Get SOWV2 reference
    const sowv2Result = await databases.listDocuments('default', 'SOWV2',
      [
        Query.equal('studentId', studentId),
        Query.equal('courseId', courseId)
      ]
    );

    if (sowv2Result.documents.length === 0) {
      throw new ProgressError(
        'NO_SOWV2',
        `No SOWV2 found for student ${studentId}, course ${courseId}. ` +
        `Enrollment may be incomplete.`
      );
    }

    const sowv2 = sowv2Result.documents[0];

    // 2. Dereference to Authored_SOW for curriculum data
    const authoredSOW = await databases.getDocument(
      'default',
      'Authored_SOW',
      sowv2.source_authored_sow_id
    );

    const sowEntries = JSON.parse(authoredSOW.entries);
    const totalLessons = sowEntries.length;

    console.log('[Progress Service] Total lessons from Authored_SOW:', totalLessons);

    // 3. Get course metadata
    const course = await databases.getDocument('default', 'courses', courseId);

    // 4. Count completed sessions
    const completedSessions = await getCompletedSessions(studentId, courseId, databases);
    const completedLessons = completedSessions.length;
    const progressPercentage = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

    console.log('[Progress Service] Completed lessons:', completedLessons);

    // 5. Calculate average mastery
    const averageMastery = await calculateAverageMastery(studentId, courseId, databases);

    // 6. Get last activity
    const lastActivity = await getLastActivity(studentId, courseId, databases);

    // 7. Estimate time remaining
    const avgMinutesPerLesson = 30;  // TODO: Calculate from lesson templates
    const estimatedTimeRemaining = (totalLessons - completedLessons) * avgMinutesPerLesson;

    const progress: CourseProgress = {
      courseId,
      courseName: `${course.subject} - ${course.level}`,
      totalLessons,
      completedLessons,
      progressPercentage: Math.round(progressPercentage * 100) / 100,
      averageMastery: Math.round(averageMastery * 100) / 100,
      lastActivity,
      estimatedTimeRemaining,
      completedLessonIds: completedSessions.map((s: any) => s.lessonTemplateId)
    };

    console.log('[Progress Service] Progress calculated:', progress);

    return progress;
  } catch (error) {
    if (error instanceof ProgressError) {
      throw error;
    }

    throw new ProgressError(
      'DATABASE_ERROR',
      `Failed to calculate progress: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

// ============================================================================
// Helper Functions (each <50 lines per CLAUDE.md)
// ============================================================================

/**
 * Gets all completed sessions for a student in a course.
 */
async function getCompletedSessions(
  studentId: string,
  courseId: string,
  databases: Databases
) {
  const result = await databases.listDocuments('default', 'sessions',
    [
      Query.equal('studentId', studentId),
      Query.equal('courseId', courseId),
      Query.equal('stage', 'done')
    ]
  );
  return result.documents;
}

/**
 * Calculates average mastery across all outcomes.
 */
async function calculateAverageMastery(
  studentId: string,
  courseId: string,
  databases: Databases
): Promise<number> {
  const masteryResult = await databases.listDocuments('default', 'MasteryV2',
    [
      Query.equal('studentId', studentId),
      Query.equal('courseId', courseId)
    ]
  );

  if (masteryResult.documents.length === 0) {
    return 0;
  }

  const emaByOutcome = JSON.parse(masteryResult.documents[0].emaByOutcome);
  const masteryValues = Object.values(emaByOutcome) as number[];

  if (masteryValues.length === 0) {
    return 0;
  }

  const sum = masteryValues.reduce((acc, val) => acc + val, 0);
  return sum / masteryValues.length;
}

/**
 * Gets the timestamp of the last activity (most recent session).
 */
async function getLastActivity(
  studentId: string,
  courseId: string,
  databases: Databases
): Promise<string | null> {
  const result = await databases.listDocuments('default', 'sessions',
    [
      Query.equal('studentId', studentId),
      Query.equal('courseId', courseId),
      Query.orderDesc('startedAt'),
      Query.limit(1)
    ]
  );

  return result.documents[0]?.startedAt || null;
}

// ============================================================================
// Additional Progress Utilities
// ============================================================================

/**
 * Gets progress for all enrolled courses.
 */
export async function getAllCoursesProgress(
  studentId: string,
  databases: Databases
): Promise<CourseProgress[]> {
  console.log('[Progress Service] Getting progress for all enrollments:', studentId);

  // Get all enrollments
  const enrollmentsResult = await databases.listDocuments(
    'default',
    'enrollments',
    [Query.equal('studentId', studentId)]
  );

  const progressPromises = enrollmentsResult.documents.map((enrollment: any) =>
    getCourseProgress(studentId, enrollment.courseId, databases)
  );

  return Promise.all(progressPromises);
}

/**
 * Checks if a specific lesson is completed.
 */
export async function isLessonCompleted(
  studentId: string,
  courseId: string,
  lessonTemplateId: string,
  databases: Databases
): Promise<boolean> {
  const result = await databases.listDocuments('default', 'sessions',
    [
      Query.equal('studentId', studentId),
      Query.equal('courseId', courseId),
      Query.equal('lessonTemplateId', lessonTemplateId),
      Query.equal('stage', 'done')
    ]
  );

  return result.documents.length > 0;
}
