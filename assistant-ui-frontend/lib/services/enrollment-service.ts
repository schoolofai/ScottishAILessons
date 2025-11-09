/**
 * Enrollment Service - Phase 1 MVP2
 *
 * Manages the complete enrollment pipeline:
 * 1. Create enrollment record
 * 2. Create SOWV2 reference (NOT copy - reference architecture)
 * 3. Initialize MasteryV2 with empty EMA map
 *
 * CRITICAL: SOWV2 uses reference architecture - stores pointer to Authored_SOW,
 * does NOT duplicate the entries field.
 */

import { Databases, ID, Query } from 'appwrite';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface EnrollmentResult {
  enrollment: any;
  sowv2: any;
  masteryv2: any;
  authoredSOW: any;  // For verification
}

export interface Enrollment {
  $id: string;
  studentId: string;
  courseId: string;
  role: string;
  enrolledAt: string;
  status?: 'active' | 'archived';  // Optional for backward compatibility
  archivedAt?: string;
  archiveReason?: string;
}

export type EnrollmentStatus = 'active' | 'archived' | null;

export interface SOWV2 {
  $id: string;
  studentId: string;
  courseId: string;
  source_authored_sow_id: string;  // Reference to Authored_SOW
  source_version: string;
  customizations: string;  // JSON string
  createdAt: string;
}

export interface MasteryV2 {
  $id: string;
  studentId: string;
  courseId: string;
  emaByOutcome: string;  // JSON string: { outcomeRef: ema_value }
  updatedAt: string;
}

// ============================================================================
// Error Handling
// ============================================================================

export class EnrollmentError extends Error {
  constructor(
    public code:
      | 'DUPLICATE_ENROLLMENT'
      | 'NO_AUTHORED_SOW'
      | 'DATABASE_ERROR'
      | 'INVALID_COURSE'
      | 'ENROLLMENT_NOT_FOUND'
      | 'ARCHIVED_ENROLLMENT_NOT_FOUND'
      | 'ALREADY_ARCHIVED',
    message: string,
    public details?: any,
    public userMessage?: string  // User-friendly message override
  ) {
    super(message);
    this.name = 'EnrollmentError';
  }

  /**
   * Returns a user-friendly error message suitable for display in the UI.
   * Technical details are logged but not shown to end users.
   */
  toUserMessage(): string {
    // Use custom user message if provided
    if (this.userMessage) {
      return this.userMessage;
    }

    // Generate user-friendly message based on error code
    switch (this.code) {
      case 'DUPLICATE_ENROLLMENT':
        return 'You are already enrolled in this course. Visit your dashboard to continue learning.';
      case 'NO_AUTHORED_SOW':
        return 'This course curriculum is still being prepared. Please check back later or contact support.';
      case 'INVALID_COURSE':
        return 'This course is not available for enrollment at this time. Please contact support if you believe this is an error.';
      case 'DATABASE_ERROR':
        return 'We encountered a technical issue while processing your enrollment. Please try again in a few moments.';
      case 'ENROLLMENT_NOT_FOUND':
        return 'No active enrollment found for this course. Please enroll first to access course content.';
      case 'ARCHIVED_ENROLLMENT_NOT_FOUND':
        return 'No archived enrollment found. You may need to enroll in this course.';
      case 'ALREADY_ARCHIVED':
        return 'This enrollment is already archived.';
      default:
        return 'An unexpected error occurred during enrollment. Please contact support if this persists.';
    }
  }
}

// ============================================================================
// Main Enrollment Function
// ============================================================================

/**
 * Enrolls a student in a course, creating the complete enrollment pipeline.
 *
 * Pipeline:
 * 1. Check for existing enrollment (fast-fail if duplicate)
 * 2. Create enrollment record
 * 3. Get latest published Authored_SOW
 * 4. Create SOWV2 reference (NOT copy - stores pointer only)
 * 5. Initialize MasteryV2 with empty EMA map
 *
 * @throws {EnrollmentError} If enrollment fails at any step
 */
export async function enrollStudentInCourse(
  studentId: string,
  courseId: string,
  databases: Databases
): Promise<EnrollmentResult> {
  console.log('[Enrollment Service] Starting enrollment:', { studentId, courseId });

  // 1. Check enrollment status
  const enrollmentStatus = await getEnrollmentStatus(studentId, courseId, databases);

  // If active enrollment exists, throw error
  if (enrollmentStatus === 'active') {
    throw new EnrollmentError(
      'DUPLICATE_ENROLLMENT',
      `Student ${studentId} is already enrolled in course ${courseId}`
    );
  }

  // If archived enrollment exists, reactivate it
  if (enrollmentStatus === 'archived') {
    console.log('[Enrollment Service] Found archived enrollment, reactivating...');
    await reactivateEnrollment(studentId, courseId, databases);

    // Fetch and return existing records
    const enrollment = await databases.listDocuments(
      'default',
      'enrollments',
      [
        Query.equal('studentId', studentId),
        Query.equal('courseId', courseId),
        Query.equal('status', 'active')
      ]
    );

    const sowv2 = await databases.listDocuments(
      'default',
      'SOWV2',
      [
        Query.equal('studentId', studentId),
        Query.equal('courseId', courseId)
      ]
    );

    const masteryv2 = await databases.listDocuments(
      'default',
      'MasteryV2',
      [
        Query.equal('studentId', studentId),
        Query.equal('courseId', courseId)
      ]
    );

    // Get the source Authored_SOW for verification
    const authoredSOW = await databases.getDocument(
      'default',
      'Authored_SOW',
      sowv2.documents[0].source_authored_sow_id
    );

    console.log('[Enrollment Service] Reactivated with existing progress');
    return {
      enrollment: enrollment.documents[0],
      sowv2: sowv2.documents[0],
      masteryv2: masteryv2.documents[0],
      authoredSOW
    };
  }

  // No existing enrollment, proceed with normal enrollment flow
  let enrollmentId: string | null = null;
  let sowv2Id: string | null = null;

  try {
    // 2. Create enrollment record
    const enrollment = await createEnrollmentRecord(studentId, courseId, databases);
    enrollmentId = enrollment.$id;
    console.log('[Enrollment Service] Created enrollment:', enrollmentId);

    // 3. Get latest published Authored_SOW
    const authoredSOW = await getLatestAuthoredSOW(courseId, databases);
    console.log('[Enrollment Service] Found Authored_SOW:', authoredSOW.$id);

    // 4. Create SOWV2 reference (NOT copy - reference architecture)
    const sowv2 = await createSOWV2Reference(
      studentId,
      courseId,
      authoredSOW,
      databases
    );
    sowv2Id = sowv2.$id;
    console.log('[Enrollment Service] Created SOWV2 reference:', sowv2Id);

    // 5. Initialize MasteryV2
    const masteryv2 = await initializeMasteryV2(studentId, courseId, databases);
    console.log('[Enrollment Service] Initialized MasteryV2:', masteryv2.$id);

    console.log('[Enrollment Service] Success:', {
      enrollmentId: enrollment.$id,
      sowv2Id: sowv2.$id,
      masteryv2Id: masteryv2.$id
    });

    return { enrollment, sowv2, masteryv2, authoredSOW };
  } catch (error) {
    // Rollback: Delete created records in reverse order
    console.error('[Enrollment Service] Error during enrollment, rolling back:', error);

    if (sowv2Id) {
      try {
        await databases.deleteDocument('default', 'SOWV2', sowv2Id);
        console.log('[Enrollment Service] Rolled back SOWV2:', sowv2Id);
      } catch (rollbackError) {
        console.error('[Enrollment Service] Failed to rollback SOWV2:', rollbackError);
      }
    }

    if (enrollmentId) {
      try {
        await databases.deleteDocument('default', 'enrollments', enrollmentId);
        console.log('[Enrollment Service] Rolled back enrollment:', enrollmentId);
      } catch (rollbackError) {
        console.error('[Enrollment Service] Failed to rollback enrollment:', rollbackError);
      }
    }

    // Re-throw with context
    if (error instanceof EnrollmentError) {
      throw error;
    }

    throw new EnrollmentError(
      'DATABASE_ERROR',
      `Enrollment failed: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

// ============================================================================
// Helper Functions (each <50 lines per CLAUDE.md)
// ============================================================================

/**
 * Checks if student has an ACTIVE enrollment in course.
 * Archived enrollments are not considered active.
 */
export async function checkEnrollmentExists(
  studentId: string,
  courseId: string,
  databases: Databases
): Promise<boolean> {
  const result = await databases.listDocuments(
    'default',
    'enrollments',
    [
      Query.equal('studentId', studentId),
      Query.equal('courseId', courseId),
      Query.equal('status', 'active')  // Only check active enrollments
    ]
  );

  return result.documents.length > 0;
}

/**
 * Creates enrollment record with proper permissions.
 */
async function createEnrollmentRecord(
  studentId: string,
  courseId: string,
  databases: Databases
) {
  // Get userId from student record for permissions
  const userId = await getUserIdFromStudentId(studentId, databases);

  return await databases.createDocument(
    'default',
    'enrollments',
    ID.unique(),
    {
      studentId,
      courseId,
      role: 'student',
      enrolledAt: new Date().toISOString()
    },
    [`read("user:${userId}")`, `write("user:${userId}")`]
  );
}

/**
 * Gets the latest published Authored_SOW for a course.
 *
 * @throws {EnrollmentError} NO_AUTHORED_SOW if no published SOW exists
 */
async function getLatestAuthoredSOW(courseId: string, databases: Databases) {
  const authoredSOWResult = await databases.listDocuments(
    'default',
    'Authored_SOW',
    [
      Query.equal('courseId', courseId),
      Query.equal('status', 'published'),
      Query.orderDesc('version'),
      Query.limit(1)
    ]
  );

  if (authoredSOWResult.documents.length === 0) {
    throw new EnrollmentError(
      'NO_AUTHORED_SOW',
      `No published Authored_SOW found for course ${courseId}. ` +
      `Cannot create personalized curriculum.`
    );
  }

  return authoredSOWResult.documents[0];
}

/**
 * Creates SOWV2 reference (reference architecture - NOT copy!)
 *
 * CRITICAL: SOWV2 stores source_authored_sow_id pointer, NOT entries copy.
 * The entries field is accessed by dereferencing the Authored_SOW document.
 */
async function createSOWV2Reference(
  studentId: string,
  courseId: string,
  authoredSOW: any,
  databases: Databases
) {
  const userId = await getUserIdFromStudentId(studentId, databases);

  // CRITICAL: SOWV2 stores REFERENCE, not copy
  return await databases.createDocument(
    'default',
    'SOWV2',
    ID.unique(),
    {
      studentId,
      courseId,
      source_authored_sow_id: authoredSOW.$id,  // ← Pointer, not copy!
      source_version: authoredSOW.version,
      customizations: JSON.stringify({}),  // Empty initially
      createdAt: new Date().toISOString()
      // NO 'entries' field - accessed via dereference!
    },
    [`read("user:${userId}")`, `write("user:${userId}")`]
  );
}

/**
 * Initializes MasteryV2 with empty EMA map for all course outcomes.
 */
async function initializeMasteryV2(
  studentId: string,
  courseId: string,
  databases: Databases
) {
  const userId = await getUserIdFromStudentId(studentId, databases);

  // Get all course outcomes
  const outcomesResult = await databases.listDocuments(
    'default',
    'course_outcomes',
    [Query.equal('courseId', courseId)]
  );

  // Initialize all outcomes to 0.0 mastery
  const emaByOutcome: Record<string, number> = {};
  outcomesResult.documents.forEach((outcome: any) => {
    emaByOutcome[outcome.outcomeRef] = 0.0;
  });

  console.log('[Enrollment Service] Initializing MasteryV2 with outcomes:', Object.keys(emaByOutcome).length);

  return await databases.createDocument(
    'default',
    'MasteryV2',
    ID.unique(),
    {
      studentId,
      courseId,
      emaByOutcome: JSON.stringify(emaByOutcome),
      updatedAt: new Date().toISOString()
    },
    [`read("user:${userId}")`, `write("user:${userId}")`]
  );
}

/**
 * Gets userId from studentId for permission setup.
 */
async function getUserIdFromStudentId(
  studentId: string,
  databases: Databases
): Promise<string> {
  const student = await databases.getDocument('default', 'students', studentId);
  return student.userId;
}

// ============================================================================
// Enrollment Status & Archive Functions
// ============================================================================

/**
 * Gets the enrollment status for a student in a course.
 * Returns 'active', 'archived', or null if no enrollment exists.
 */
export async function getEnrollmentStatus(
  studentId: string,
  courseId: string,
  databases: Databases
): Promise<EnrollmentStatus> {
  const result = await databases.listDocuments(
    'default',
    'enrollments',
    [
      Query.equal('studentId', studentId),
      Query.equal('courseId', courseId)
    ]
  );

  if (result.documents.length === 0) {
    return null;
  }

  // Return status, defaulting to 'active' for backward compatibility
  const enrollment = result.documents[0] as Enrollment;
  return enrollment.status || 'active';
}

/**
 * Archives an enrollment (non-destructive).
 * Preserves SOWV2, MasteryV2, and Sessions for potential re-enrollment.
 *
 * @throws {EnrollmentError} ENROLLMENT_NOT_FOUND if no active enrollment exists
 */
export async function archiveEnrollment(
  studentId: string,
  courseId: string,
  databases: Databases,
  reason: string = 'user_requested'
): Promise<void> {
  console.log('[Enrollment Service] Archiving enrollment:', { studentId, courseId, reason });

  // Find enrollment (backward compatible - don't filter by status initially)
  const enrollments = await databases.listDocuments(
    'default',
    'enrollments',
    [
      Query.equal('studentId', studentId),
      Query.equal('courseId', courseId)
    ]
  );

  if (enrollments.documents.length === 0) {
    throw new EnrollmentError(
      'ENROLLMENT_NOT_FOUND',
      `No enrollment found for student ${studentId} in course ${courseId}`
    );
  }

  const enrollment = enrollments.documents[0] as any;

  // Check if already archived
  if (enrollment.status === 'archived') {
    throw new EnrollmentError(
      'ALREADY_ARCHIVED',
      `Enrollment for student ${studentId} in course ${courseId} is already archived`
    );
  }

  // Update status to archived (handles both old records without status and active records)
  await databases.updateDocument(
    'default',
    'enrollments',
    enrollment.$id,
    {
      status: 'archived',
      archivedAt: new Date().toISOString(),
      archiveReason: reason
    }
  );

  console.log('[Enrollment Service] Enrollment archived successfully');
  // IMPORTANT: Do NOT delete SOWV2, MasteryV2, or Sessions
  // Progress is preserved for potential re-enrollment
}

/**
 * Reactivates an archived enrollment, restoring student's previous progress.
 *
 * @throws {EnrollmentError} ARCHIVED_ENROLLMENT_NOT_FOUND if no archived enrollment exists
 */
export async function reactivateEnrollment(
  studentId: string,
  courseId: string,
  databases: Databases
): Promise<void> {
  console.log('[Enrollment Service] Reactivating enrollment:', { studentId, courseId });

  // Find archived enrollment
  const enrollments = await databases.listDocuments(
    'default',
    'enrollments',
    [
      Query.equal('studentId', studentId),
      Query.equal('courseId', courseId),
      Query.equal('status', 'archived')
    ]
  );

  if (enrollments.documents.length === 0) {
    throw new EnrollmentError(
      'ARCHIVED_ENROLLMENT_NOT_FOUND',
      `No archived enrollment found for student ${studentId} in course ${courseId}`
    );
  }

  // Reactivate enrollment
  await databases.updateDocument(
    'default',
    'enrollments',
    enrollments.documents[0].$id,
    {
      status: 'active',
      archivedAt: null,
      archiveReason: null
    }
  );

  console.log('[Enrollment Service] Enrollment reactivated successfully');
  // Progress automatically restored (SOWV2, MasteryV2 never deleted)
}

// ============================================================================
// Unenrollment Function
// ============================================================================

/**
 * Unenrolls a student from a course (cleanup all related records).
 *
 * Deletes in order:
 * 1. Sessions (only if no evidence exists)
 * 2. MasteryV2
 * 3. SOWV2
 * 4. Enrollment
 *
 * @throws {EnrollmentError} If unenrollment fails
 */
export async function unenrollStudentFromCourse(
  studentId: string,
  courseId: string,
  databases: Databases
): Promise<void> {
  console.log('[Enrollment Service] Starting unenrollment:', { studentId, courseId });

  try {
    // 1. Check if sessions have evidence
    const sessionsResult = await databases.listDocuments(
      'default',
      'sessions',
      [
        Query.equal('studentId', studentId),
        Query.equal('courseId', courseId)
      ]
    );

    // Delete sessions only if no evidence exists
    for (const session of sessionsResult.documents) {
      const evidenceResult = await databases.listDocuments(
        'default',
        'evidence',
        [Query.equal('sessionId', session.$id)]
      );

      if (evidenceResult.documents.length === 0) {
        await databases.deleteDocument('default', 'sessions', session.$id);
        console.log('[Enrollment Service] Deleted session:', session.$id);
      } else {
        console.warn('[Enrollment Service] Keeping session with evidence:', session.$id);
      }
    }

    // 2. Delete MasteryV2
    const masteryResult = await databases.listDocuments(
      'default',
      'MasteryV2',
      [
        Query.equal('studentId', studentId),
        Query.equal('courseId', courseId)
      ]
    );

    for (const mastery of masteryResult.documents) {
      await databases.deleteDocument('default', 'MasteryV2', mastery.$id);
      console.log('[Enrollment Service] Deleted MasteryV2:', mastery.$id);
    }

    // 3. Delete SOWV2
    const sowv2Result = await databases.listDocuments(
      'default',
      'SOWV2',
      [
        Query.equal('studentId', studentId),
        Query.equal('courseId', courseId)
      ]
    );

    for (const sowv2 of sowv2Result.documents) {
      await databases.deleteDocument('default', 'SOWV2', sowv2.$id);
      console.log('[Enrollment Service] Deleted SOWV2:', sowv2.$id);
    }

    // 4. Delete Enrollment
    const enrollmentResult = await databases.listDocuments(
      'default',
      'enrollments',
      [
        Query.equal('studentId', studentId),
        Query.equal('courseId', courseId)
      ]
    );

    for (const enrollment of enrollmentResult.documents) {
      await databases.deleteDocument('default', 'enrollments', enrollment.$id);
      console.log('[Enrollment Service] Deleted enrollment:', enrollment.$id);
    }

    console.log('[Enrollment Service] Unenrollment complete');
  } catch (error) {
    throw new EnrollmentError(
      'DATABASE_ERROR',
      `Unenrollment failed: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}
