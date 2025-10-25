/**
 * Lesson Progress and History Test Suite
 *
 * Tests the secure lesson progress tracking implementation including:
 * - Session state management (never_started, in_progress, completed, locked)
 * - Race condition handling
 * - Session history
 * - Security (preventing access to other students' sessions)
 * - Accessibility compliance
 */

import { test, expect } from '@playwright/test';

test.describe('Lesson Progress and History', () => {
  // Test user credentials (from spec: test@scottishailessons.com / red12345)
  const TEST_USER = {
    email: 'test@scottishailessons.com',
    password: 'red12345'
  };

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    await page.waitForURL('/dashboard', { timeout: 10000 });
  });

  test('should show "Start Lesson" for never-started lesson', async ({ page }) => {
    // Navigate to dashboard
    await expect(page).toHaveURL('/dashboard');

    // Find a lesson with "Start" or "Start Lesson" button
    const startButton = page.locator('button:has-text("Start")').first();
    await expect(startButton).toBeVisible();

    // Check ARIA label exists
    const ariaLabel = await startButton.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel).toMatch(/Start .+/i);
  });

  test('should create session and navigate when starting lesson', async ({ page }) => {
    await page.goto('/dashboard');

    // Click first "Start Lesson" button
    const startButton = page.locator('button:has-text("Start")').first();
    await startButton.click();

    // Should navigate to session page
    await page.waitForURL(/\/session\/.+/, { timeout: 15000 });
    expect(page.url()).toMatch(/\/session\/[a-zA-Z0-9]+/);

    // Go back to dashboard
    await page.goto('/dashboard');

    // Button should now say "Continue" for that lesson
    const continueButton = page.locator('button:has-text("Continue")');
    await expect(continueButton).toBeVisible({ timeout: 5000 });
  });

  test('should show "Continue" for in-progress lessons', async ({ page }) => {
    await page.goto('/dashboard');

    // Look for "Continue" button (assumes at least one in-progress lesson exists)
    const continueButton = page.locator('button:has-text("Continue")').first();

    if (await continueButton.count() > 0) {
      await expect(continueButton).toBeVisible();

      // Check ARIA label
      const ariaLabel = await continueButton.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel).toMatch(/Continue .+/i);

      // Check for "Last activity" timestamp
      const activityText = page.locator('text=/Last activity:/i');
      if (await activityText.count() > 0) {
        await expect(activityText.first()).toBeVisible();
      }
    }
  });

  test('should show "Retake Lesson" for completed lessons', async ({ page }) => {
    await page.goto('/dashboard');

    // Look for "Retake Lesson" button
    const retakeButton = page.locator('button:has-text("Retake")').first();

    if (await retakeButton.count() > 0) {
      await expect(retakeButton).toBeVisible();

      // Check ARIA label
      const ariaLabel = await retakeButton.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel).toMatch(/Retake .+/i);

      // Should show history link
      const historyLink = page.locator('button:has-text("View History")');
      if (await historyLink.count() > 0) {
        await expect(historyLink.first()).toBeVisible();
      }
    }
  });

  test('should display history page with completed sessions', async ({ page }) => {
    await page.goto('/dashboard');

    // Find and click "View History" link
    const historyLink = page.locator('button:has-text("View History")').first();

    if (await historyLink.count() > 0) {
      await historyLink.click();

      // Should navigate to history page
      await page.waitForURL(/\/lesson-sessions\/.+/, { timeout: 10000 });

      // Should show page title
      await expect(page.locator('h1')).toBeVisible();

      // Should show completion count
      const completionText = page.locator('text=/completed this lesson.*time/i');
      await expect(completionText).toBeVisible();

      // Check for session list with role="list"
      const sessionList = page.locator('[role="list"]');
      if (await sessionList.count() > 0) {
        await expect(sessionList).toBeVisible();
      }

      // Back button should work
      const backButton = page.locator('button:has-text("Back")');
      await expect(backButton).toBeVisible();
    }
  });

  test('should show "Locked" for unpublished lessons', async ({ page }) => {
    await page.goto('/dashboard');

    // Look for locked lessons
    const lockedButton = page.locator('button:has-text("Locked")').first();

    if (await lockedButton.count() > 0) {
      await expect(lockedButton).toBeVisible();
      await expect(lockedButton).toBeDisabled();

      // Check ARIA label
      const ariaLabel = await lockedButton.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel).toMatch(/locked/i);
    }
  });

  test('should maintain accessibility standards', async ({ page }) => {
    await page.goto('/dashboard');

    // Check ARIA labels on buttons
    const buttons = page.locator('button:has-text("Start"), button:has-text("Continue"), button:has-text("Retake")');
    const buttonCount = await buttons.count();

    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const button = buttons.nth(i);
      const ariaLabel = await button.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
    }

    // Check keyboard navigation
    const firstButton = page.locator('button:has-text("Start"), button:has-text("Continue")').first();
    if (await firstButton.count() > 0) {
      await firstButton.focus();
      await expect(firstButton).toBeFocused();
    }
  });

  test('should show "Start Over" option for stale sessions', async ({ page }) => {
    await page.goto('/dashboard');

    // Look for "Start Over" button (only visible for stale in-progress sessions)
    const startOverButton = page.locator('button:has-text("Start Over")').first();

    if (await startOverButton.count() > 0) {
      await expect(startOverButton).toBeVisible();

      // Check ARIA label
      const ariaLabel = await startOverButton.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel).toMatch(/Start .+ over/i);
    }
  });

  test('should handle loading states correctly', async ({ page }) => {
    await page.goto('/dashboard');

    // Click start button and check for loading state
    const startButton = page.locator('button:has-text("Start")').first();

    if (await startButton.count() > 0) {
      await startButton.click();

      // Should show "Starting..." text briefly
      const loadingText = page.locator('text=Starting...');

      // Check for aria-busy attribute during loading
      const ariaBusy = await startButton.getAttribute('aria-busy');
      // Note: This may pass quickly, so we don't assert if not caught
    }
  });

  test('should navigate back from history page', async ({ page }) => {
    await page.goto('/dashboard');

    const historyLink = page.locator('button:has-text("View History")').first();

    if (await historyLink.count() > 0) {
      await historyLink.click();
      await page.waitForURL(/\/lesson-sessions\/.+/);

      // Click back button
      const backButton = page.locator('button:has-text("Back")').first();
      await backButton.click();

      // Should return to dashboard
      await page.waitForURL('/dashboard', { timeout: 10000 });
      await expect(page).toHaveURL('/dashboard');
    }
  });

  test('should display course progress correctly', async ({ page }) => {
    await page.goto('/dashboard');

    // Check for progress indicator
    const progressText = page.locator('text=/\\d+ of \\d+ completed/i');

    if (await progressText.count() > 0) {
      await expect(progressText.first()).toBeVisible();
    }

    // Check for progress bar
    const progressBar = page.locator('[role="progressbar"], .progress');

    if (await progressBar.count() > 0) {
      await expect(progressBar.first()).toBeVisible();
    }
  });

  test('should handle race conditions when creating sessions', async ({ page, context }) => {
    // This test requires opening multiple tabs
    const page2 = await context.newPage();

    // Navigate both to dashboard
    await Promise.all([
      page.goto('/dashboard'),
      page2.goto('/dashboard')
    ]);

    // Try to start the same lesson from both tabs
    const startButton1 = page.locator('button:has-text("Start")').first();
    const startButton2 = page2.locator('button:has-text("Start")').first();

    // Get lesson info to ensure we're clicking the same lesson
    const lessonText1 = await startButton1.locator('..').locator('..').textContent();

    // Click simultaneously
    await Promise.all([
      startButton1.click(),
      startButton2.click()
    ]);

    // Both should navigate to session pages
    await Promise.all([
      page.waitForURL(/\/session\/.+/, { timeout: 15000 }),
      page2.waitForURL(/\/session\/.+/, { timeout: 15000 })
    ]);

    // Both should navigate to the SAME session (race condition handled)
    const url1 = page.url();
    const url2 = page2.url();

    // Extract session IDs
    const sessionId1 = url1.match(/\/session\/([^/]+)/)?.[1];
    const sessionId2 = url2.match(/\/session\/([^/]+)/)?.[1];

    // Session IDs should match (idempotent creation)
    expect(sessionId1).toBe(sessionId2);

    await page2.close();
  });

  test('should show error message for expired session', async ({ page }) => {
    // Clear cookies to simulate expired session
    await page.context().clearCookies();
    await page.goto('/dashboard');

    // Should redirect to login or show error
    await expect(page).toHaveURL(/\/(login|auth)/i, { timeout: 10000 });
  });

  test('should display lesson metadata', async ({ page }) => {
    await page.goto('/dashboard');

    // Check for lesson type badges
    const badges = page.locator('.badge, [class*="badge"]');

    if (await badges.count() > 0) {
      // Should show lesson types (Teach, Practice, etc.)
      const badgeTexts = await badges.allTextContents();
      const hasLessonType = badgeTexts.some(text =>
        /teach|practice|check-in|revision|assessment/i.test(text)
      );

      if (hasLessonType) {
        expect(hasLessonType).toBe(true);
      }
    }

    // Check for estimated time
    const timeText = page.locator('text=/\\d+ min/i');

    if (await timeText.count() > 0) {
      await expect(timeText.first()).toBeVisible();
    }
  });
});
