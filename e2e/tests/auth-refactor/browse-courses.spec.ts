/**
 * Browse Courses E2E Tests - Auth Refactor
 *
 * Tests course catalog browsing and enrollment functionality.
 * These tests verify server-side authentication and enrollment operations.
 *
 * Expected Behavior:
 * - Course catalog loads for both authenticated and anonymous users
 * - Authenticated users see enrollment status for each course
 * - Enroll/unenroll operations work via server API
 * - No client SDK calls (all via /api/ endpoints)
 *
 * Initial Status: PARTIALLY WORKING (catalog already migrated)
 * Already Fixed: /api/courses/catalog endpoint exists
 * Still Needs Testing: Enrollment operations via server API
 *
 * Related Components:
 * - app/courses/catalog/page.tsx (ALREADY MIGRATED)
 * - app/api/courses/catalog/route.ts (EXISTS)
 * - app/api/student/enroll/route.ts (EXISTS)
 * - app/api/student/unenroll/route.ts (EXISTS)
 */

import { test, expect } from '@playwright/test';
import { authenticateUser } from '../helpers/auth';
import { TIMEOUTS } from '../helpers/constants';
import { TestDataCleanup } from '../helpers/cleanup';

const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@scottishailessons.com',
  password: process.env.TEST_USER_PASSWORD || 'red12345',
};

const TEST_COURSES = {
  MATHEMATICS_N3: 'test_course_simple_math', // Known working course
  APPLICATIONS_HIGHER: 'course_c84476', // 24 lessons (might be empty)
};

test.describe('Browse Courses - Auth Refactor', () => {
  let cleanup: TestDataCleanup;
  let createdEnrollments: string[] = [];

  test.beforeEach(async ({ page }) => {
    cleanup = new TestDataCleanup(page);
    createdEnrollments = [];
    await page.goto('/');
  });

  test.afterEach(async ({ page }) => {
    // Cleanup any enrollments created during test
    if (createdEnrollments.length > 0) {
      console.log(`[Cleanup] Cleaning up ${createdEnrollments.length} test enrollments...`);
      await cleanup.cleanupEnrollments(TEST_USER.email, createdEnrollments);
    }
    await cleanup.verifyCleanup();
  });

  test('should display course catalog for unauthenticated user', async ({ page }) => {
    console.log('[Test] Testing course catalog for anonymous user...');

    // Navigate to catalog without logging in
    await page.goto('/courses/catalog');
    console.log('[Test] Navigated to /courses/catalog');

    // ✅ SHOULD PASS: Catalog page already migrated to server API
    // Verify catalog page loads
    await expect(page.getByRole('heading', { name: /course catalog|browse courses/i })).toBeVisible({
      timeout: TIMEOUTS.pageLoad,
    });
    console.log('[Test] ✅ Course catalog heading visible');

    // Verify at least one course displayed
    const courseCards = page.locator('[data-testid="course-card"]');
    const courseCount = await courseCards.count();
    expect(courseCount).toBeGreaterThan(0);
    console.log(`[Test] ✅ Found ${courseCount} courses`);

    // Verify action buttons visible (Enroll for auth users, View Details for anon users)
    const actionButtons = page.getByRole('button', { name: /enroll|view details/i });
    const actionButtonCount = await actionButtons.count();
    expect(actionButtonCount).toBeGreaterThan(0);
    console.log(`[Test] ✅ Found ${actionButtonCount} action buttons`);
  });

  test('should display course catalog with enrollment status for authenticated user', async ({ page }) => {
    console.log('[Test] Testing course catalog with enrollment status...');

    // Login as student
    await authenticateUser(page, TEST_USER);
    console.log('[Test] Student user authenticated');

    // Navigate to catalog
    await page.goto('/courses/catalog');
    console.log('[Test] Navigated to /courses/catalog');

    // ✅ SHOULD PASS: Catalog endpoint returns enrollment status
    // Verify catalog loads
    await expect(page.getByRole('heading', { name: /course catalog|browse courses/i })).toBeVisible();
    console.log('[Test] ✅ Course catalog loaded');

    // Verify enrollment status indicators present
    // Look for "Enrolled" badge or similar
    const enrolledBadges = page.locator('[data-enrollment-status="active"]');
    const enrolledCount = await enrolledBadges.count();

    if (enrolledCount > 0) {
      console.log(`[Test] ✅ Found ${enrolledCount} enrolled courses`);

      // Verify enrolled course shows different UI
      const enrolledCourse = enrolledBadges.first();
      await expect(enrolledCourse.getByText(/enrolled|continue learning/i)).toBeVisible();
      console.log('[Test] ✅ Enrolled course shows correct status');
    } else {
      console.log('[Test] ⚠️  No enrolled courses found for test user');
    }

    // Verify unenrolled courses show enroll button
    const unenrolledCourses = page.locator('[data-enrollment-status="not-enrolled"]');
    const unenrolledCount = await unenrolledCourses.count();

    if (unenrolledCount > 0) {
      const unenrolledCourse = unenrolledCourses.first();
      await expect(unenrolledCourse.getByRole('button', { name: /enroll/i })).toBeVisible();
      console.log(`[Test] ✅ Found ${unenrolledCount} unenrolled courses with enroll buttons`);
    }
  });

  test('should allow enrollment in new course', async ({ page }) => {
    console.log('[Test] Testing course enrollment...');

    // Login as student
    await authenticateUser(page, TEST_USER);
    await page.goto('/courses/catalog');

    // Find an unenrolled course
    const unenrolledCourse = page.locator('[data-enrollment-status="not-enrolled"]').first();

    // Check if there are any unenrolled courses
    const unenrolledCount = await unenrolledCourse.count();

    if (unenrolledCount === 0) {
      console.log('[Test] ⚠️  No unenrolled courses available, skipping enrollment test');
      test.skip();
      return;
    }

    // Get course ID before enrolling
    const courseId = await unenrolledCourse.getAttribute('data-course-id');
    console.log(`[Test] Enrolling in course: ${courseId}`);

    // Track for cleanup
    if (courseId) {
      createdEnrollments.push(courseId);
    }

    // Click enroll button
    const enrollButton = unenrolledCourse.getByRole('button', { name: /enroll/i });
    await enrollButton.click();

    // ✅ SHOULD PASS: Enrollment endpoint already exists
    // Verify enrollment success message
    await expect(page.getByText(/successfully enrolled|enrollment confirmed/i)).toBeVisible({
      timeout: 5000,
    });
    console.log('[Test] ✅ Enrollment success message displayed');

    // Verify course status changed to enrolled
    await expect(unenrolledCourse).toHaveAttribute('data-enrollment-status', 'active');
    console.log('[Test] ✅ Course status updated to enrolled');

    // Verify enroll button changed to "View Course" or similar
    await expect(unenrolledCourse.getByRole('button', { name: /view course|continue/i })).toBeVisible();
    console.log('[Test] ✅ Enroll button changed to view course button');
  });

  test('should allow unenrollment from enrolled course', async ({ page }) => {
    console.log('[Test] Testing course unenrollment...');

    // Login as student
    await authenticateUser(page, TEST_USER);
    await page.goto('/courses/catalog');

    // Find an enrolled course
    const enrolledCourse = page.locator('[data-enrollment-status="active"]').first();

    // Check if there are any enrolled courses
    const enrolledCount = await enrolledCourse.count();

    if (enrolledCount === 0) {
      console.log('[Test] ⚠️  No enrolled courses available, skipping unenrollment test');
      test.skip();
      return;
    }

    // Get course ID
    const courseId = await enrolledCourse.getAttribute('data-course-id');
    console.log(`[Test] Unenrolling from course: ${courseId}`);

    // Find and click unenroll/archive button
    // This might be in a dropdown menu or modal
    const moreButton = enrolledCourse.getByRole('button', { name: /more|options|menu/i });

    if (await moreButton.isVisible()) {
      await moreButton.click();
      console.log('[Test] Opened course options menu');
    }

    const unenrollButton = page.getByRole('button', { name: /unenroll|archive/i });
    await unenrollButton.click();

    // ✅ SHOULD PASS: Unenrollment endpoint already exists
    // Verify unenrollment success
    await expect(page.getByText(/successfully unenrolled|enrollment archived/i)).toBeVisible({
      timeout: 5000,
    });
    console.log('[Test] ✅ Unenrollment success message displayed');

    // Verify course status changed to not-enrolled or archived
    // Note: Unenrollment might archive rather than delete
    const newStatus = await enrolledCourse.getAttribute('data-enrollment-status');
    expect(['not-enrolled', 'archived']).toContain(newStatus);
    console.log(`[Test] ✅ Course status updated to: ${newStatus}`);

    // Re-enroll for cleanup (restore original state)
    if (newStatus === 'not-enrolled' && courseId) {
      const enrollButton = enrolledCourse.getByRole('button', { name: /enroll/i });
      await enrollButton.click();
      await page.waitForTimeout(TIMEOUTS.shortWait);
      console.log('[Test] Re-enrolled in course to restore original state');
    }
  });

  test('should display course details when clicking "View Details"', async ({ page }) => {
    console.log('[Test] Testing course details navigation...');

    await page.goto('/courses/catalog');

    // Wait for courses to load
    await expect(page.getByRole('heading', { name: /course catalog/i })).toBeVisible();

    // Find first course card
    const firstCourse = page.locator('[data-testid="course-card"]').first();
    const courseId = await firstCourse.getAttribute('data-course-id');
    console.log(`[Test] Clicking details for course: ${courseId}`);

    // Click "View Details" button
    const viewDetailsButton = firstCourse.getByRole('button', { name: /view details/i });
    await viewDetailsButton.click();

    // ✅ SHOULD PASS: Course details page already migrated
    // Verify navigation to course details page
    await expect(page).toHaveURL(new RegExp(`/courses/${courseId}`), { timeout: TIMEOUTS.pageLoad });
    console.log(`[Test] ✅ Navigated to course details: /courses/${courseId}`);

    // Verify course details page loaded
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    console.log('[Test] ✅ Course details page loaded');

    // Verify lessons/curriculum section visible (use specific heading to avoid multiple matches)
    await expect(page.getByRole('heading', { name: /course structure|lessons/i })).toBeVisible();
    console.log('[Test] ✅ Course content section visible');
  });

  test('should not show 401 errors in console', async ({ page }) => {
    console.log('[Test] Testing for absence of 401 auth errors...');

    // Track console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && (msg.text().includes('401') || msg.text().includes('Unauthorized'))) {
        consoleErrors.push(msg.text());
      }
    });

    // Login and navigate to catalog
    await authenticateUser(page, TEST_USER);
    await page.goto('/courses/catalog');

    // Wait for page to fully load
    await page.waitForTimeout(TIMEOUTS.mediumWait);

    // ✅ SHOULD PASS: Catalog already uses server API
    // Verify no 401 errors
    expect(consoleErrors.length).toBe(0);

    if (consoleErrors.length > 0) {
      console.error('[Test] ❌ Found 401 errors:', consoleErrors);
    } else {
      console.log('[Test] ✅ No 401 auth errors detected');
    }
  });

  test('should use server API endpoints (not client SDK)', async ({ page }) => {
    console.log('[Test] Verifying course catalog uses server API...');

    // Login first (SDK calls from Dashboard are out of scope for Browse Courses migration)
    await authenticateUser(page, TEST_USER);

    // NOW start tracking network requests (only for Browse Courses pages)
    const apiCalls: string[] = [];
    const clientSDKCalls: string[] = [];

    page.on('request', (request) => {
      const url = request.url();

      if (url.includes('/api/')) {
        apiCalls.push(`${request.method()} ${new URL(url).pathname}`);
      }

      // Detect direct Appwrite SDK calls (should NOT happen)
      if (url.includes('appwrite.io') && !url.includes('/api/')) {
        clientSDKCalls.push(url);
      }
    });

    // Load catalog page (tracking starts here)
    await page.goto('/courses/catalog');

    // Wait for data to load
    await page.waitForTimeout(TIMEOUTS.mediumWait);

    // ✅ SHOULD PASS: Catalog uses /api/courses/catalog
    // Verify API call was made
    const catalogAPICalls = apiCalls.filter((call) => call.includes('/api/courses/catalog'));
    expect(catalogAPICalls.length).toBeGreaterThan(0);
    console.log('[Test] ✅ Catalog API call detected:', catalogAPICalls[0]);

    // Verify NO direct client SDK calls
    expect(clientSDKCalls.length).toBe(0);

    if (clientSDKCalls.length > 0) {
      console.error('[Test] ❌ Detected client SDK calls:', clientSDKCalls);
    } else {
      console.log('[Test] ✅ No direct client SDK calls detected');
    }
  });
});
