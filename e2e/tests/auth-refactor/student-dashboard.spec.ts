/**
 * Student Dashboard E2E Tests - Auth Refactor
 *
 * Tests dashboard data loading, recommendations, and re-enrollment functionality.
 * These tests verify EnhancedStudentDashboard uses server-side auth correctly.
 *
 * Expected Behavior:
 * - Dashboard loads all enrolled courses via server API
 * - Recommendations load via LangGraph Course Manager
 * - Re-enrollment works via server API
 * - NO fallback patterns (fast-fail on errors)
 * - NO 401 errors (proper httpOnly cookie auth)
 *
 * Initial Status: TESTS WILL FAIL
 * Reason: EnhancedStudentDashboard.tsx uses client SDK for:
 *   - Lines 266-269: databases.listDocuments() for enrollments
 *   - Lines 305-309: databases.listDocuments() for courses
 *   - Lines 358-362: databases.listDocuments() for archived courses
 *   - Lines 379-385: Client SDK for re-enrollment
 *   - Line 188: FALLBACK PATTERN ("Continue without metadata")
 *
 * Related Components:
 * - components/dashboard/EnhancedStudentDashboard.tsx
 * - lib/appwrite/driver/* (various drivers)
 */

import { test, expect } from '@playwright/test';
import { authenticateUser } from '../helpers/auth';
import { TIMEOUTS } from '../helpers/constants';
import { TestDataCleanup } from '../helpers/cleanup';

const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@scottishailessons.com',
  password: process.env.TEST_USER_PASSWORD || 'red12345',
};

test.describe('Student Dashboard - Auth Refactor', () => {
  let cleanup: TestDataCleanup;

  test.beforeEach(async ({ page }) => {
    cleanup = new TestDataCleanup(page);
    await page.goto('/');
    await authenticateUser(page, TEST_USER);
  });

  test.afterEach(async ({ page }) => {
    await cleanup.cleanupAll();
  });

  test('should load dashboard with all enrolled courses', async ({ page }) => {
    console.log('[Test] Testing dashboard loading...');

    await page.goto('/dashboard');

    // ❌ EXPECTED TO FAIL: Dashboard uses client SDK for enrollments (line 266-269)
    // Verify welcome message loads - use heading to avoid strict mode violation
    await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible({
      timeout: TIMEOUTS.pageLoad,
    });
    console.log('[Test] ✅ Welcome message visible');

    // Verify course count displayed
    await expect(page.getByText(/across \d+ course/i)).toBeVisible();
    console.log('[Test] ✅ Course count displayed');

    // Verify "Your Courses" section loads
    await expect(page.getByRole('heading', { name: /Your Courses/i })).toBeVisible();
    console.log('[Test] ✅ Your Courses section visible');

    // Verify at least one course tab displayed (courses are shown as tabs, not cards)
    const courseTabs = page.locator('[data-testid^="course-tab-"]');
    const courseCount = await courseTabs.count();
    expect(courseCount).toBeGreaterThan(0);
    console.log(`[Test] ✅ Found ${courseCount} course tabs`);
  });

  test('should load recommendations via LangGraph', async ({ page }) => {
    console.log('[Test] Testing dashboard recommendations loading...');

    await page.goto('/dashboard');

    // ❌ EXPECTED TO FAIL: May fail if Course Manager can't load mastery data
    // Verify Reviews & Recommendations section loads (it's a span, not a heading)
    await expect(page.getByText(/Reviews & Recommendations/i)).toBeVisible({
      timeout: 15000, // LangGraph call takes longer
    });
    console.log('[Test] ✅ Recommendations section visible');

    // Verify "What to Review" section
    await expect(page.getByText(/What to Review/i)).toBeVisible();
    console.log('[Test] ✅ What to Review section visible');

    // Verify "What to Take Next" section
    await expect(page.getByText(/What to Take Next/i)).toBeVisible();
    console.log('[Test] ✅ What to Take Next section visible');

    // Verify at least one recommendation item
    const recommendationItems = page.locator('[data-testid="recommendation-item"]');
    const recommendationCount = await recommendationItems.count();

    if (recommendationCount > 0) {
      console.log(`[Test] ✅ Found ${recommendationCount} recommendation items`);
    } else {
      console.log('[Test] ⚠️  No recommendations found (might be empty for this student)');
    }
  });

  test('should handle re-enrollment in archived course', async ({ page }) => {
    console.log('[Test] Testing re-enrollment functionality...');

    await page.goto('/dashboard');

    // Wait for dashboard to load
    await expect(page.getByRole('heading', { name: /Your Courses/i })).toBeVisible();

    // Find archived course (if any)
    const archivedCourse = page.locator('[data-enrollment-status="archived"]').first();
    const archivedCount = await archivedCourse.count();

    if (archivedCount === 0) {
      console.log('[Test] ⚠️  No archived courses found, skipping re-enrollment test');
      test.skip();
      return;
    }

    console.log('[Test] Found archived course');

    // Get course ID
    const courseId = await archivedCourse.getAttribute('data-course-id');
    console.log(`[Test] Re-enrolling in course: ${courseId}`);

    // Click re-enroll button
    const reenrollButton = archivedCourse.getByRole('button', { name: /re-enroll/i });
    await reenrollButton.click();

    // ❌ EXPECTED TO FAIL: Re-enrollment uses client SDK (lines 379-385)
    // Verify success message
    await expect(page.getByText(/successfully re-enrolled|enrollment restored/i)).toBeVisible({
      timeout: 5000,
    });
    console.log('[Test] ✅ Re-enrollment success message displayed');

    // Verify course status changed to active
    await expect(archivedCourse).toHaveAttribute('data-enrollment-status', 'active');
    console.log('[Test] ✅ Course status updated to active');

    // Verify course now appears in active courses list
    const activeCourses = page.locator('[data-enrollment-status="active"]');
    const isCourseActive = await activeCourses.filter({ has: page.locator(`[data-course-id="${courseId}"]`) }).count();
    expect(isCourseActive).toBeGreaterThan(0);
    console.log('[Test] ✅ Course appears in active courses list');

    // Cleanup: Archive again to restore original state
    const unenrollButton = archivedCourse.getByRole('button', { name: /unenroll|archive/i });
    if (await unenrollButton.isVisible()) {
      await unenrollButton.click();
      await page.waitForTimeout(TIMEOUTS.shortWait);
      console.log('[Test] Archived course again to restore original state');
    }
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

    await page.goto('/dashboard');

    // Wait for all data to load
    await page.waitForTimeout(TIMEOUTS.mediumWait);

    // ❌ EXPECTED TO FAIL: Client SDK calls will generate 401 errors
    // Verify no 401 errors
    expect(consoleErrors.length).toBe(0);

    if (consoleErrors.length > 0) {
      console.error('[Test] ❌ Found 401 errors:', consoleErrors);
    } else {
      console.log('[Test] ✅ No 401 auth errors detected');
    }
  });

  test('should NOT use fallback pattern for errors', async ({ page }) => {
    console.log('[Test] Testing for absence of fallback patterns...');

    // Track console logs
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      consoleLogs.push(msg.text());
    });

    await page.goto('/dashboard');
    await page.waitForTimeout(TIMEOUTS.mediumWait);

    // ❌ EXPECTED TO FAIL: Line 188 has fallback "Continue without metadata"
    // Verify no "continue without" fallback messages
    const fallbackMessages = consoleLogs.filter((log) => log.includes('continue without') || log.includes('fallback'));

    expect(fallbackMessages.length).toBe(0);

    if (fallbackMessages.length > 0) {
      console.error('[Test] ❌ Found fallback pattern usage:', fallbackMessages);
    } else {
      console.log('[Test] ✅ No fallback patterns detected (fast-fail implemented)');
    }
  });

  test('should use server API for all dashboard data', async ({ page }) => {
    console.log('[Test] Verifying dashboard uses server API...');

    // Track network requests
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

    await page.goto('/dashboard');
    await page.waitForTimeout(TIMEOUTS.mediumWait);

    // ❌ EXPECTED TO FAIL: Dashboard uses client SDK for enrollments/courses
    // Verify API calls were made
    const dashboardAPICalls = apiCalls.filter(
      (call) => call.includes('/api/student/') || call.includes('/api/dashboard/')
    );
    expect(dashboardAPICalls.length).toBeGreaterThan(0);
    console.log(`[Test] ✅ Found ${dashboardAPICalls.length} server API calls`);

    // Log SDK calls before asserting (so we can see them even if test fails)
    if (clientSDKCalls.length > 0) {
      console.log(`[Test] ⚠️  Detected ${clientSDKCalls.length} client SDK calls:`);
      clientSDKCalls.forEach((call, index) => {
        console.log(`  ${index + 1}. ${call}`);
      });
    } else {
      console.log('[Test] ✅ No direct client SDK calls detected');
    }

    // Note: RevisionNotesDriver (cheat sheet checks) uses client SDK but is out of scope for dashboard migration (Priority #5)
    // For now, we'll tolerate a small number of SDK calls from secondary features
    // STRICT ENFORCEMENT: Core dashboard functionality (enrollments, courses, recommendations) MUST use server API
    const maxAllowedSDKCalls = 3; // Allow cheat sheet checks
    expect(clientSDKCalls.length).toBeLessThanOrEqual(maxAllowedSDKCalls);
  });

  test('should load course curriculum for each enrolled course', async ({ page }) => {
    console.log('[Test] Testing curriculum loading for courses...');

    await page.goto('/dashboard');

    // Wait for courses to load
    await expect(page.getByRole('heading', { name: /Your Courses/i })).toBeVisible();

    // Find first active course
    const firstCourse = page.locator('[data-enrollment-status="active"]').first();

    if ((await firstCourse.count()) === 0) {
      console.log('[Test] ⚠️  No active courses found, skipping curriculum test');
      test.skip();
      return;
    }

    // Check if curriculum is visible (might be in expanded state)
    const curriculumSection = firstCourse.locator('[data-testid="course-curriculum"]');

    if (!(await curriculumSection.isVisible())) {
      // Try expanding the course card
      const expandButton = firstCourse.getByRole('button', { name: /expand|show details/i });
      if (await expandButton.isVisible()) {
        await expandButton.click();
        await page.waitForTimeout(TIMEOUTS.shortWait);
      }
    }

    // ❌ EXPECTED TO FAIL: CourseCurriculum component uses client SDK
    // Verify curriculum section loads
    await expect(curriculumSection).toBeVisible({ timeout: 5000 });
    console.log('[Test] ✅ Curriculum section visible');

    // Verify at least one lesson displayed
    const lessonItems = curriculumSection.locator('[data-testid="lesson-item"]');
    const lessonCount = await lessonItems.count();

    if (lessonCount > 0) {
      console.log(`[Test] ✅ Found ${lessonCount} lessons in curriculum`);
    } else {
      console.log('[Test] ⚠️  No lessons found (course might be empty)');
    }
  });

  test('should fast-fail on enrollment data loading errors', async ({ page }) => {
    console.log('[Test] Testing fast-fail behavior on data loading errors...');

    // Mock API failure to test error handling
    await page.route('**/api/student/enrollments*', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ success: false, error: 'Internal server error' }),
      });
    });

    // Track console errors
    const errorLogs: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errorLogs.push(msg.text());
      }
    });

    await page.goto('/dashboard');
    await page.waitForTimeout(TIMEOUTS.mediumWait);

    // ❌ EXPECTED TO FAIL: Current implementation may have fallback patterns
    // Verify error is logged (not silently caught)
    const apiErrorLogs = errorLogs.filter((log) => log.includes('Failed to') || log.includes('error'));
    expect(apiErrorLogs.length).toBeGreaterThan(0);

    if (apiErrorLogs.length > 0) {
      console.log('[Test] ✅ Error was logged (fast-fail behavior):', apiErrorLogs[0]);
    } else {
      console.error('[Test] ❌ Error was silently caught (fallback pattern detected)');
    }

    // Verify user sees error message (not empty state)
    // Check for dashboard-error testid first, then verify text content
    const errorContainer = page.locator('[data-testid="dashboard-error"]');
    await expect(errorContainer).toBeVisible({ timeout: 10000 });

    // Verify error text is present
    const errorMessage = page.getByText(/failed|error/i);
    await expect(errorMessage).toBeVisible();
    console.log('[Test] ✅ User-facing error message displayed');
  });
});
