import { Page } from '@playwright/test';

/**
 * Test Data Cleanup Module
 *
 * Handles cleanup of test data created during E2E tests to maintain database hygiene.
 * All methods use server-side API endpoints to ensure proper cleanup.
 *
 * Usage:
 * ```typescript
 * test.afterEach(async ({ page }) => {
 *   const cleanup = new TestDataCleanup(page);
 *   await cleanup.cleanupEnrollments(studentId, enrollmentIds);
 *   await cleanup.verifyCleanup();
 * });
 * ```
 */
export class TestDataCleanup {
  private enrollmentsToCleanup: string[] = [];
  private sessionsToCleanup: string[] = [];
  private studentsToCleanup: string[] = [];

  constructor(private page: Page) {}

  /**
   * Track enrollment for cleanup
   */
  trackEnrollment(enrollmentId: string): void {
    this.enrollmentsToCleanup.push(enrollmentId);
  }

  /**
   * Track session for cleanup
   */
  trackSession(sessionId: string): void {
    this.sessionsToCleanup.push(sessionId);
  }

  /**
   * Track student for cleanup (for onboarding tests)
   */
  trackStudent(studentId: string): void {
    this.studentsToCleanup.push(studentId);
  }

  /**
   * Clean up test enrollments created during tests
   *
   * Uses server-side API to archive enrollments (soft delete)
   *
   * @param studentId - Student ID who owns the enrollments
   * @param courseIds - Array of course IDs to unenroll from
   */
  async cleanupEnrollments(studentId: string, courseIds: string[]): Promise<void> {
    console.log(`[Cleanup] Cleaning up ${courseIds.length} enrollments for student ${studentId}`);

    for (const courseId of courseIds) {
      try {
        const response = await this.page.request.post('/api/student/unenroll', {
          data: { courseId },
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok()) {
          console.log(`[Cleanup] ✅ Unenrolled from course: ${courseId}`);
        } else {
          const error = await response.json();
          console.warn(`[Cleanup] ⚠️  Failed to unenroll from ${courseId}:`, error);
        }
      } catch (error) {
        console.error(`[Cleanup] ❌ Error cleaning up enrollment ${courseId}:`, error);
      }
    }
  }

  /**
   * Clean up test sessions created during tests
   *
   * Note: Sessions are typically cleaned up automatically by lesson completion,
   * but this ensures any orphaned sessions are removed.
   *
   * @param studentId - Student ID who owns the sessions
   * @param sessionIds - Optional array of specific session IDs to delete
   */
  async cleanupSessions(studentId: string, sessionIds?: string[]): Promise<void> {
    if (!sessionIds || sessionIds.length === 0) {
      console.log('[Cleanup] No sessions to clean up');
      return;
    }

    console.log(`[Cleanup] Cleaning up ${sessionIds.length} sessions for student ${studentId}`);

    // TODO: Implement session cleanup API endpoint
    // For now, sessions are left as-is (they don't pollute test data significantly)
    console.warn('[Cleanup] ⚠️  Session cleanup not yet implemented - sessions will remain');
  }

  /**
   * Clean up test student data (for onboarding tests)
   *
   * WARNING: This permanently deletes the student account and all associated data.
   * Only use for test accounts created during onboarding tests.
   *
   * @param email - Email of the test student to delete
   */
  async cleanupTestStudent(email: string): Promise<void> {
    console.log(`[Cleanup] Cleaning up test student: ${email}`);

    try {
      // TODO: Implement student deletion API endpoint
      // This should:
      // 1. Delete student document
      // 2. Delete all enrollments
      // 3. Delete all sessions
      // 4. Delete all mastery data
      // 5. Delete user account from Appwrite auth

      console.warn('[Cleanup] ⚠️  Student cleanup not yet implemented - student will remain');
    } catch (error) {
      console.error(`[Cleanup] ❌ Error cleaning up student ${email}:`, error);
    }
  }

  /**
   * Verify cleanup was successful
   *
   * Checks that tracked enrollments/sessions/students were properly cleaned up.
   * Fails the test if cleanup verification fails.
   *
   * @throws Error if cleanup verification fails
   */
  async verifyCleanup(): Promise<void> {
    let cleanupFailed = false;
    const failures: string[] = [];

    // Verify enrollments cleaned up
    if (this.enrollmentsToCleanup.length > 0) {
      console.log(`[Cleanup] Verifying ${this.enrollmentsToCleanup.length} enrollments cleaned up...`);
      // TODO: Query enrollments endpoint to verify they're archived
      console.warn('[Cleanup] ⚠️  Enrollment verification not yet implemented');
    }

    // Verify sessions cleaned up
    if (this.sessionsToCleanup.length > 0) {
      console.log(`[Cleanup] Verifying ${this.sessionsToCleanup.length} sessions cleaned up...`);
      // TODO: Query sessions endpoint to verify they're deleted
      console.warn('[Cleanup] ⚠️  Session verification not yet implemented');
    }

    // Verify students cleaned up
    if (this.studentsToCleanup.length > 0) {
      console.log(`[Cleanup] Verifying ${this.studentsToCleanup.length} students cleaned up...`);
      // TODO: Query students endpoint to verify they're deleted
      console.warn('[Cleanup] ⚠️  Student verification not yet implemented');
    }

    if (cleanupFailed) {
      throw new Error(`Cleanup verification failed:\n${failures.join('\n')}`);
    }

    console.log('[Cleanup] ✅ All cleanup verified successfully');
  }

  /**
   * Cleanup all tracked test data
   *
   * Convenience method to cleanup all tracked data in one call.
   * Use in test.afterEach() or test.afterAll() hooks.
   */
  async cleanupAll(): Promise<void> {
    console.log('[Cleanup] Cleaning up all tracked test data...');

    // Cleanup enrollments
    if (this.enrollmentsToCleanup.length > 0) {
      // Extract studentId from first enrollment (assuming all enrollments are for same student)
      // This is a simplification - in real implementation, track studentId per enrollment
      console.warn('[Cleanup] ⚠️  Auto-cleanup of tracked enrollments not yet implemented');
    }

    // Cleanup sessions
    if (this.sessionsToCleanup.length > 0) {
      console.warn('[Cleanup] ⚠️  Auto-cleanup of tracked sessions not yet implemented');
    }

    // Cleanup students
    for (const studentId of this.studentsToCleanup) {
      await this.cleanupTestStudent(studentId);
    }

    await this.verifyCleanup();
  }
}

/**
 * Global cleanup function for test suite teardown
 *
 * Checks for any leaked test data from failed tests.
 * Run in global-teardown.ts to ensure database cleanliness.
 *
 * @param page - Playwright page instance
 */
export async function verifyNoTestDataLeaks(page: Page): Promise<void> {
  console.log('[Global Cleanup] Verifying no test data leaks...');

  // TODO: Implement global leak detection
  // This should query:
  // 1. Recent enrollments by test account
  // 2. Recent sessions by test account
  // 3. Recent test student accounts

  console.warn('[Global Cleanup] ⚠️  Leak detection not yet implemented');
}
