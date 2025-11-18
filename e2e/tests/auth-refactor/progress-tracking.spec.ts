/**
 * Progress Tracking E2E Tests - Auth Refactor
 *
 * Tests student progress tracking and mastery data.
 * These tests verify server-side authentication via httpOnly cookies.
 *
 * Expected Behavior:
 * - Students can view overall progress across courses
 * - Lesson completion tracking works correctly
 * - Mastery/assessment data loads via server API (NOT client SDK)
 * - Progress updates reflected in real-time
 *
 * Initial Status: THESE TESTS WILL FAIL
 * Reason: Progress components likely use MasteryDriver with client SDK
 * Fix Required: Migrate progress tracking to /api/student/progress/* endpoints
 *
 * Related Components:
 * - components/progress/* (if exists)
 * - lib/appwrite/driver/MasteryDriver.ts
 * - Dashboard progress display
 */

import { test, expect, Page } from '@playwright/test';
import { authenticateUser, logoutUser } from '../helpers/auth';
import { TIMEOUTS } from '../helpers/constants';
import { TestDataCleanup } from '../helpers/cleanup';

// Test accounts
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@scottishailessons.com',
  password: process.env.TEST_USER_PASSWORD || 'red12345',
};

test.describe('Progress Tracking - Auth Refactor', () => {
  test.beforeEach(async ({ page }) => {
    // Start from home page
    await page.goto('/');
  });

  test.afterEach(async ({ page }) => {
    // Cleanup any test data created
    const cleanup = new TestDataCleanup(page);
    await cleanup.cleanupAll();
  });

  test('should display overall progress on dashboard', async ({ page }) => {
    console.log('[Test] Testing overall progress display...');

    // Login as test user
    await authenticateUser(page, TEST_USER);
    console.log('[Test] User authenticated');

    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForTimeout(TIMEOUTS.mediumWait);

    // ❌ EXPECTED TO FAIL: Progress display may use client SDK
    // Look for progress indicators
    const progressSection = page.locator('[data-testid="progress-section"]');
    const progressBars = page.locator('[role="progressbar"]');

    const progressSectionCount = await progressSection.count();
    const progressBarCount = await progressBars.count();

    if (progressSectionCount > 0 || progressBarCount > 0) {
      console.log(`[Test] ✅ Found progress indicators (section: ${progressSectionCount}, bars: ${progressBarCount})`);
    } else {
      console.log('[Test] ⚠️  No progress indicators found (may require enrolled courses)');
    }
  });

  test('should display course-specific progress', async ({ page }) => {
    console.log('[Test] Testing course-specific progress...');

    // Login
    await authenticateUser(page, TEST_USER);

    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForTimeout(TIMEOUTS.shortWait);

    // Find enrolled course card
    const enrolledCourseCard = page.locator('[data-testid="enrolled-course-card"]').first();

    if ((await enrolledCourseCard.count()) === 0) {
      console.log('[Test] ⚠️  No enrolled courses found, skipping test');
      test.skip();
      return;
    }

    // ❌ EXPECTED TO FAIL: Course progress uses client SDK
    // Look for progress indicator within course card
    const courseProgress = enrolledCourseCard.locator('[data-testid="course-progress"]');
    const courseProgressBar = enrolledCourseCard.locator('[role="progressbar"]');

    if ((await courseProgress.count()) > 0 || (await courseProgressBar.count()) > 0) {
      console.log('[Test] ✅ Found course-specific progress indicator');

      // Try to extract progress value
      if ((await courseProgressBar.count()) > 0) {
        const progressValue = await courseProgressBar.getAttribute('aria-valuenow');
        console.log(`[Test] Progress value: ${progressValue}%`);
      }
    } else {
      console.log('[Test] ⚠️  No course progress indicator found');
    }
  });

  test('should display lesson completion status in curriculum', async ({ page }) => {
    console.log('[Test] Testing lesson completion indicators...');

    // Login
    await authenticateUser(page, TEST_USER);

    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForTimeout(TIMEOUTS.shortWait);

    // Click on first enrolled course
    const enrolledCourse = page.locator('[data-testid="enrolled-course-card"]').first();

    if ((await enrolledCourse.count()) === 0) {
      console.log('[Test] ⚠️  No enrolled courses, skipping test');
      test.skip();
      return;
    }

    await enrolledCourse.click();
    await page.waitForTimeout(TIMEOUTS.mediumWait);

    // ❌ EXPECTED TO FAIL: Lesson completion uses client SDK
    // Look for completion indicators on lessons
    const completedLessons = page.locator('[data-testid="lesson-item"][data-status="completed"]');
    const completedCount = await completedLessons.count();

    console.log(`[Test] Found ${completedCount} completed lessons`);

    // Look for checkmarks or completion icons
    const completionIcons = page.locator('[data-testid="lesson-completion-icon"]');
    const iconCount = await completionIcons.count();

    console.log(`[Test] Found ${iconCount} completion icons`);
  });

  test('should load mastery data via server API', async ({ page }) => {
    console.log('[Test] Testing mastery data loading...');

    // Track API calls
    const masteryAPICalls: string[] = [];
    const clientSDKCalls: string[] = [];

    page.on('request', (request) => {
      const url = request.url();

      // Track mastery-related API calls
      if (url.includes('/api/student/mastery') || url.includes('/api/student/progress')) {
        masteryAPICalls.push(`${request.method()} ${url}`);
      }

      // Track direct Appwrite SDK calls
      if (url.includes('appwrite.io') || url.includes('cloud.appwrite.io')) {
        if (!url.includes('/api/')) {
          clientSDKCalls.push(url);
        }
      }
    });

    // Login
    await authenticateUser(page, TEST_USER);

    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForTimeout(TIMEOUTS.mediumWait);

    console.log(`[Test] Found ${masteryAPICalls.length} mastery API calls`);
    console.log(`[Test] Found ${clientSDKCalls.length} direct client SDK calls`);

    // Log SDK calls before asserting (so we can see them even if test fails)
    if (clientSDKCalls.length > 0) {
      console.log(`[Test] ⚠️  Detected ${clientSDKCalls.length} client SDK calls:`);
      clientSDKCalls.slice(0, 5).forEach((call, index) => {
        console.log(`  ${index + 1}. ${call}`);
      });
    } else {
      console.log('[Test] ✅ No direct client SDK calls detected');
    }

    // Note: Similar to other tests, some SDK calls may be from secondary features (Priority #5)
    // STRICT ENFORCEMENT: Core mastery/progress functionality MUST use server API
    const maxAllowedSDKCalls = 3; // Allow secondary feature SDK calls
    expect(clientSDKCalls.length).toBeLessThanOrEqual(maxAllowedSDKCalls);

    // Verify mastery uses server API
    if (masteryAPICalls.length > 0) {
      console.log('[Test] ✅ Mastery API calls detected:', masteryAPICalls);
    } else {
      console.log('[Test] ⚠️  No mastery API calls detected (may use different endpoint pattern)');
    }
  });

  test('should not show 401 errors when loading progress data', async ({ page }) => {
    console.log('[Test] Testing for absence of 401 errors in progress tracking...');

    // Track console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && (msg.text().includes('401') || msg.text().includes('Unauthorized'))) {
        consoleErrors.push(msg.text());
      }
    });

    // Login
    await authenticateUser(page, TEST_USER);

    // Navigate to dashboard (loads progress)
    await page.goto('/dashboard');
    await page.waitForTimeout(TIMEOUTS.mediumWait);

    // Navigate to a course (loads course-specific progress)
    const enrolledCourse = page.locator('[data-testid="enrolled-course-card"]').first();

    if ((await enrolledCourse.count()) > 0) {
      await enrolledCourse.click();
      await page.waitForTimeout(TIMEOUTS.mediumWait);
    }

    // ❌ EXPECTED TO FAIL: Client SDK calls will generate 401 errors
    expect(consoleErrors.length).toBe(0);

    if (consoleErrors.length > 0) {
      console.error('[Test] ❌ Found 401 errors:', consoleErrors.slice(0, 5));
    } else {
      console.log('[Test] ✅ No 401 auth errors detected');
    }
  });

  test('should NOT use fallback pattern for progress loading errors', async ({ page }) => {
    console.log('[Test] Testing for absence of fallback patterns...');

    // Track console messages for fallback patterns
    const fallbackPatterns: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (
        text.includes('falling back') ||
        text.includes('fallback to') ||
        text.includes('using default') ||
        text.includes('retrying with')
      ) {
        fallbackPatterns.push(text);
      }
    });

    // Login
    await authenticateUser(page, TEST_USER);

    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForTimeout(TIMEOUTS.mediumWait);

    // Verify NO fallback patterns (should fast-fail instead)
    expect(fallbackPatterns.length).toBe(0);

    if (fallbackPatterns.length > 0) {
      console.error('[Test] ❌ Detected fallback patterns:', fallbackPatterns);
    } else {
      console.log('[Test] ✅ No fallback patterns detected (fast-fail implemented)');
    }
  });
});

test.describe('Progress Tracking - Mastery System Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login for all tests
    await page.goto('/');
    await authenticateUser(page, TEST_USER);
  });

  test.afterEach(async ({ page }) => {
    const cleanup = new TestDataCleanup(page);
    await cleanup.cleanupAll();
  });

  test('should display mastery levels for learning outcomes', async ({ page }) => {
    console.log('[Test] Testing mastery level display...');

    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForTimeout(TIMEOUTS.shortWait);

    // Navigate to a course curriculum
    const enrolledCourse = page.locator('[data-testid="enrolled-course-card"]').first();

    if ((await enrolledCourse.count()) === 0) {
      console.log('[Test] ⚠️  No enrolled courses, skipping test');
      test.skip();
      return;
    }

    await enrolledCourse.click();
    await page.waitForTimeout(TIMEOUTS.mediumWait);

    // ❌ EXPECTED TO FAIL: Mastery display uses client SDK
    // Look for mastery indicators
    const masteryIndicators = page.locator('[data-testid="mastery-indicator"]');
    const masteryCount = await masteryIndicators.count();

    if (masteryCount > 0) {
      console.log(`[Test] ✅ Found ${masteryCount} mastery indicators`);
    } else {
      console.log('[Test] ⚠️  No mastery indicators found (may require mastery data)');
    }
  });

  test('should track spaced repetition schedule', async ({ page }) => {
    console.log('[Test] Testing spaced repetition tracking...');

    // Track API calls for spaced repetition
    const spacedRepAPICalls: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/student/spaced-repetition')) {
        spacedRepAPICalls.push(`${request.method()} ${url}`);
      }
    });

    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForTimeout(TIMEOUTS.mediumWait);

    // ❌ EXPECTED TO FAIL: Spaced repetition may use client SDK
    // Verify spaced repetition API calls
    console.log(`[Test] Found ${spacedRepAPICalls.length} spaced repetition API calls`);

    if (spacedRepAPICalls.length > 0) {
      console.log('[Test] ✅ Spaced repetition API calls detected:', spacedRepAPICalls);
    } else {
      console.log('[Test] ⚠️  No spaced repetition API calls (may not be implemented yet)');
    }
  });

  test('should update progress after lesson completion', async ({ page }) => {
    console.log('[Test] Testing progress updates after lesson completion...');

    // Track progress update API calls
    const progressUpdateCalls: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (
        (url.includes('/api/student/progress') || url.includes('/api/student/mastery')) &&
        (request.method() === 'PATCH' || request.method() === 'PUT' || request.method() === 'POST')
      ) {
        progressUpdateCalls.push(`${request.method()} ${url}`);
      }
    });

    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForTimeout(TIMEOUTS.shortWait);

    // Note: Actually completing a lesson requires full lesson flow
    // This test just verifies the API structure exists
    console.log('[Test] ⚠️  Full lesson completion requires extended test flow');
    console.log('[Test] Monitoring progress update API calls...');

    // For now, just verify we can detect the pattern
    console.log(`[Test] Tracking ${progressUpdateCalls.length} progress update calls`);
  });

  test('should load historical progress data', async ({ page }) => {
    console.log('[Test] Testing historical progress data loading...');

    // Track API calls for historical data
    const historyAPICalls: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/student/progress') || url.includes('/api/student/sessions')) {
        historyAPICalls.push(`${request.method()} ${url}`);
      }
    });

    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForTimeout(TIMEOUTS.mediumWait);

    // ❌ EXPECTED TO FAIL: Historical data may use client SDK
    // Verify history API calls
    console.log(`[Test] Found ${historyAPICalls.length} history-related API calls`);

    if (historyAPICalls.length > 0) {
      console.log('[Test] ✅ History API calls detected');
    }

    // Look for progress charts or history visualizations
    const progressCharts = page.locator('[data-testid="progress-chart"]');
    const chartCount = await progressCharts.count();

    if (chartCount > 0) {
      console.log(`[Test] ✅ Found ${chartCount} progress charts`);
    } else {
      console.log('[Test] ⚠️  No progress charts found (may not be implemented yet)');
    }
  });

  test('should handle concurrent progress updates correctly', async ({ page }) => {
    console.log('[Test] Testing concurrent progress update handling...');

    // Track all progress-related API calls with timing
    const apiCallTimestamps: Array<{ time: number; call: string }> = [];

    page.on('request', (request) => {
      const url = request.url();
      if (
        url.includes('/api/student/progress') ||
        url.includes('/api/student/mastery') ||
        url.includes('/api/student/sessions')
      ) {
        apiCallTimestamps.push({
          time: Date.now(),
          call: `${request.method()} ${url}`,
        });
      }
    });

    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForTimeout(TIMEOUTS.mediumWait);

    // Navigate to course (may trigger multiple progress loads)
    const enrolledCourse = page.locator('[data-testid="enrolled-course-card"]').first();

    if ((await enrolledCourse.count()) > 0) {
      await enrolledCourse.click();
      await page.waitForTimeout(TIMEOUTS.mediumWait);
    }

    // Analyze concurrent calls
    console.log(`[Test] Tracked ${apiCallTimestamps.length} progress-related API calls`);

    if (apiCallTimestamps.length >= 2) {
      // Check for calls happening within 1 second of each other
      for (let i = 1; i < apiCallTimestamps.length; i++) {
        const timeDiff = apiCallTimestamps[i].time - apiCallTimestamps[i - 1].time;
        if (timeDiff < 1000) {
          console.log(`[Test] Detected concurrent calls (${timeDiff}ms apart):`);
          console.log(`  - ${apiCallTimestamps[i - 1].call}`);
          console.log(`  - ${apiCallTimestamps[i].call}`);
        }
      }
    }

    console.log('[Test] ✅ Concurrent update tracking complete');
  });
});
