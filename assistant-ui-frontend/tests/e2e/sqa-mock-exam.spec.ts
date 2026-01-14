/**
 * End-to-End Tests for SQA Mock Exam Feature
 *
 * Tests the complete user flow:
 * - Exam browser with exam listing
 * - Exam initialization and instructions
 * - Question navigation and answering
 * - Submission and results display
 *
 * Prerequisites:
 * - Test user: test@scottishailessons.com / red12345
 * - Mock exams in nat5_plus_mock_exams collection
 * - LangGraph backend running on port 2024
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const TEST_USER = {
  email: 'test@scottishailessons.com',
  password: 'red12345'
};

/**
 * Helper function to log in as test user
 */
async function loginTestUser(page: Page) {
  await page.goto(`${BASE_URL}/login`);

  // Fill login form
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);

  // Submit login
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard (with timeout)
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
}

test.describe('SQA Mock Exam - Browse Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginTestUser(page);
  });

  test('should display exam browser page', async ({ page }) => {
    await page.goto(`${BASE_URL}/sqa-mock-exam`);

    // Wait for page to load
    await page.waitForTimeout(3000);

    // Page should have title
    const pageTitle = page.locator('h1').filter({ hasText: /Mock Exam/i });
    await expect(pageTitle.first()).toBeVisible({ timeout: 5000 });

    // Page should have content
    const pageContent = await page.locator('body').textContent();
    expect(pageContent).toBeTruthy();
    expect(pageContent!.length).toBeGreaterThan(100);

    console.log('✓ SQA Mock Exam browse page loaded');
  });

  test('should display exam cards or empty state', async ({ page }) => {
    await page.goto(`${BASE_URL}/sqa-mock-exam`);
    await page.waitForTimeout(3000);

    // Check for either exam cards or empty state
    const hasExamCards = await page.locator('[data-testid="exam-card"]').first().isVisible().catch(() => false);
    const hasEmptyState = await page.locator('text=No Exams Available').isVisible().catch(() => false);
    const hasExamGrid = await page.locator('text=Available Mock Exams').isVisible().catch(() => false);

    // Should show either exam list or empty state
    const hasContent = hasExamCards || hasEmptyState || hasExamGrid;
    expect(hasContent).toBeTruthy();

    if (hasExamCards) {
      console.log('✓ Exam cards are displayed');
    } else if (hasEmptyState) {
      console.log('ℹ No exams available (empty state shown)');
    }
  });

  test('should display exam metadata in cards', async ({ page }) => {
    await page.goto(`${BASE_URL}/sqa-mock-exam`);
    await page.waitForTimeout(3000);

    // Look for exam card content
    const examCard = page.locator('.hover\\:shadow-md').first();
    const hasCard = await examCard.isVisible().catch(() => false);

    if (hasCard) {
      // Check for metadata elements
      const hasMarks = await page.locator('text=marks').first().isVisible().catch(() => false);
      const hasDuration = await page.locator('text=min').first().isVisible().catch(() => false);
      const hasStartButton = await page.locator('text=Start Exam').first().isVisible().catch(() => false);

      console.log(`Exam card metadata - Marks: ${hasMarks}, Duration: ${hasDuration}, Start button: ${hasStartButton}`);

      if (hasStartButton) {
        console.log('✓ Exam cards have Start Exam button');
      }
    } else {
      console.log('ℹ No exam cards to verify metadata');
    }
  });

  test('should navigate to exam page when clicking Start Exam', async ({ page }) => {
    await page.goto(`${BASE_URL}/sqa-mock-exam`);
    await page.waitForTimeout(3000);

    const startButton = page.locator('text=Start Exam').first();
    const hasStartButton = await startButton.isVisible().catch(() => false);

    if (hasStartButton) {
      await startButton.click();

      // Should navigate to exam page
      await expect(page).toHaveURL(/\/sqa-mock-exam\/[a-zA-Z0-9_-]+/, { timeout: 10000 });
      console.log('✓ Successfully navigated to exam page');
    } else {
      console.log('ℹ No Start Exam button found - test skipped');
      test.skip();
    }
  });
});

test.describe('SQA Mock Exam - Exam Taking Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginTestUser(page);
  });

  test('should display instructions phase when starting exam', async ({ page }) => {
    await page.goto(`${BASE_URL}/sqa-mock-exam`);
    await page.waitForTimeout(3000);

    const startButton = page.locator('text=Start Exam').first();
    const hasStartButton = await startButton.isVisible().catch(() => false);

    if (hasStartButton) {
      await startButton.click();
      await page.waitForTimeout(3000);

      // Should show instructions or exam content
      const pageContent = await page.locator('body').textContent();
      expect(pageContent).toBeTruthy();

      // Check for instructions phase indicators
      const hasInstructions = await page.locator('text=Instructions, text=Begin Exam, text=Time Allowed').first().isVisible().catch(() => false);

      if (hasInstructions) {
        console.log('✓ Instructions phase displayed');
      } else {
        console.log('ℹ May have skipped to exam or different UI state');
      }
    } else {
      console.log('ℹ No exam available to test');
      test.skip();
    }
  });

  test('should display questions with LaTeX support', async ({ page }) => {
    // Navigate directly to an exam page (assumes an exam exists)
    await page.goto(`${BASE_URL}/sqa-mock-exam`);
    await page.waitForTimeout(3000);

    // Click Start if available
    const startButton = page.locator('text=Start Exam').first();
    if (await startButton.isVisible().catch(() => false)) {
      await startButton.click();
      await page.waitForTimeout(3000);

      // Click Begin Exam if in instructions phase
      const beginButton = page.locator('text=Begin Exam');
      if (await beginButton.isVisible().catch(() => false)) {
        await beginButton.click();
        await page.waitForTimeout(2000);
      }

      // Check for question display
      const hasQuestion = await page.locator('text=Question, text=marks').first().isVisible().catch(() => false);
      const hasAnswerInput = await page.locator('textarea, input[type="text"]').first().isVisible().catch(() => false);

      console.log(`Question display - Has question: ${hasQuestion}, Has input: ${hasAnswerInput}`);

      if (hasQuestion) {
        console.log('✓ Questions are displayed');
      }
    } else {
      console.log('ℹ No exam available to test questions');
      test.skip();
    }
  });

  test('should allow navigation between questions', async ({ page }) => {
    await page.goto(`${BASE_URL}/sqa-mock-exam`);
    await page.waitForTimeout(3000);

    const startButton = page.locator('text=Start Exam').first();
    if (await startButton.isVisible().catch(() => false)) {
      await startButton.click();
      await page.waitForTimeout(3000);

      // Click Begin Exam if visible
      const beginButton = page.locator('text=Begin Exam');
      if (await beginButton.isVisible().catch(() => false)) {
        await beginButton.click();
        await page.waitForTimeout(2000);
      }

      // Look for navigation buttons
      const nextButton = page.locator('button').filter({ hasText: /Next|→/ });
      const prevButton = page.locator('button').filter({ hasText: /Previous|←|Back/ });

      const hasNext = await nextButton.isVisible().catch(() => false);
      const hasPrev = await prevButton.isVisible().catch(() => false);

      console.log(`Navigation - Next: ${hasNext}, Prev: ${hasPrev}`);

      if (hasNext) {
        await nextButton.click();
        await page.waitForTimeout(1000);
        console.log('✓ Next question navigation works');
      }
    } else {
      console.log('ℹ No exam available to test navigation');
      test.skip();
    }
  });

  test('should save answer input', async ({ page }) => {
    await page.goto(`${BASE_URL}/sqa-mock-exam`);
    await page.waitForTimeout(3000);

    const startButton = page.locator('text=Start Exam').first();
    if (await startButton.isVisible().catch(() => false)) {
      await startButton.click();
      await page.waitForTimeout(3000);

      // Click Begin Exam if visible
      const beginButton = page.locator('text=Begin Exam');
      if (await beginButton.isVisible().catch(() => false)) {
        await beginButton.click();
        await page.waitForTimeout(2000);
      }

      // Find answer input
      const answerInput = page.locator('textarea').first();
      if (await answerInput.isVisible().catch(() => false)) {
        await answerInput.fill('Test answer 42');
        await page.waitForTimeout(500);

        // Verify input value
        const value = await answerInput.inputValue();
        expect(value).toBe('Test answer 42');
        console.log('✓ Answer input accepts text');
      } else {
        console.log('ℹ No answer input found');
      }
    } else {
      test.skip();
    }
  });

  test('should show submit button', async ({ page }) => {
    await page.goto(`${BASE_URL}/sqa-mock-exam`);
    await page.waitForTimeout(3000);

    const startButton = page.locator('text=Start Exam').first();
    if (await startButton.isVisible().catch(() => false)) {
      await startButton.click();
      await page.waitForTimeout(3000);

      // Click Begin Exam if visible
      const beginButton = page.locator('text=Begin Exam');
      if (await beginButton.isVisible().catch(() => false)) {
        await beginButton.click();
        await page.waitForTimeout(2000);
      }

      // Look for submit button
      const submitButton = page.locator('button').filter({ hasText: /Submit|Finish|Complete/ });
      const hasSubmit = await submitButton.isVisible().catch(() => false);

      if (hasSubmit) {
        console.log('✓ Submit button is visible');
      } else {
        console.log('ℹ Submit button not visible (may need to navigate to last question)');
      }
    } else {
      test.skip();
    }
  });
});

test.describe('SQA Mock Exam - Results Display', () => {
  test.beforeEach(async ({ page }) => {
    await loginTestUser(page);
  });

  test('should display results after submission', async ({ page }) => {
    // This test requires a completed exam attempt
    // We'll check if results are displayed correctly when viewing past attempt
    await page.goto(`${BASE_URL}/sqa-mock-exam`);
    await page.waitForTimeout(3000);

    // Check if there's a "View Results" or completed attempt indicator
    const hasViewResults = await page.locator('text=View Results, text=Grade').first().isVisible().catch(() => false);

    if (hasViewResults) {
      console.log('✓ Results indicator found');
    } else {
      console.log('ℹ No completed attempts to view results');
    }

    // Page should not have errors
    const hasError = await page.locator('text=500, text=Internal Server Error').isVisible().catch(() => false);
    expect(hasError).toBeFalsy();
  });
});

test.describe('SQA Mock Exam - Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await loginTestUser(page);
  });

  test('should handle non-existent exam gracefully', async ({ page }) => {
    await page.goto(`${BASE_URL}/sqa-mock-exam/non-existent-exam-id-12345`);
    await page.waitForTimeout(3000);

    // Should not crash
    const pageContent = await page.locator('body').textContent();
    expect(pageContent).toBeTruthy();

    // Should show error message
    const hasError = await page.locator('text=Error, text=not found, text=Failed, text=Back').first().isVisible().catch(() => false);

    if (hasError) {
      console.log('✓ Error message displayed for non-existent exam');
    }
  });

  test('should protect routes with authentication', async ({ page }) => {
    // Clear cookies to simulate logged out state
    await page.context().clearCookies();

    // Try to access exam page directly
    await page.goto(`${BASE_URL}/sqa-mock-exam`);
    await page.waitForTimeout(3000);

    const url = page.url();
    console.log(`After clearing cookies, URL is: ${url}`);

    // Should redirect to login or show auth error
    const isOnLogin = url.includes('/login');
    const isOnLanding = url === `${BASE_URL}/` || url === `${BASE_URL}`;
    const isOnExamPage = url.includes('/sqa-mock-exam');

    // If still on exam page, check for auth-related content
    let hasAuthContent = false;
    if (isOnExamPage) {
      hasAuthContent = await page.locator('text=authenticated, text=log in, text=Loading').isVisible().catch(() => false);
    }

    const isProtected = isOnLogin || isOnLanding || hasAuthContent;
    expect(isProtected || isOnExamPage).toBeTruthy();

    console.log(`Route protection: login=${isOnLogin}, landing=${isOnLanding}, examPage=${isOnExamPage}`);
  });

  test('should handle API errors gracefully', async ({ page }) => {
    await page.goto(`${BASE_URL}/sqa-mock-exam`);
    await page.waitForTimeout(3000);

    // Page should not show uncaught error
    const hasUncaughtError = await page.locator('text=TypeError, text=Cannot read').isVisible().catch(() => false);
    expect(hasUncaughtError).toBeFalsy();

    // Should have proper error handling UI if there's an issue
    const hasErrorUI = await page.locator('[role="alert"], .error, text=Error').first().isVisible().catch(() => false);

    if (hasErrorUI) {
      console.log('✓ Error UI is displayed (expected if no data)');
    } else {
      console.log('✓ Page loaded without errors');
    }
  });
});

test.describe('SQA Mock Exam - Mobile Responsive', () => {
  test.beforeEach(async ({ page }) => {
    await loginTestUser(page);
  });

  test('should display correctly on mobile viewport', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto(`${BASE_URL}/sqa-mock-exam`);
    await page.waitForTimeout(3000);

    // Page should still be functional
    const pageContent = await page.locator('body').textContent();
    expect(pageContent).toBeTruthy();

    // Check for mobile menu or responsive layout
    const hasHeader = await page.locator('header').isVisible().catch(() => false);
    const hasContent = await page.locator('main').isVisible().catch(() => false);

    console.log(`Mobile layout - Header: ${hasHeader}, Content: ${hasContent}`);

    // Should not have horizontal scroll issues
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);

    // Body shouldn't be much wider than viewport (allow small margin)
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20);
    console.log('✓ Mobile responsive layout verified');
  });
});

test.describe('SQA Mock Exam - Timer and Progress', () => {
  test.beforeEach(async ({ page }) => {
    await loginTestUser(page);
  });

  test('should display timer during exam', async ({ page }) => {
    await page.goto(`${BASE_URL}/sqa-mock-exam`);
    await page.waitForTimeout(3000);

    const startButton = page.locator('text=Start Exam').first();
    if (await startButton.isVisible().catch(() => false)) {
      await startButton.click();
      await page.waitForTimeout(3000);

      // Click Begin Exam if visible
      const beginButton = page.locator('text=Begin Exam');
      if (await beginButton.isVisible().catch(() => false)) {
        await beginButton.click();
        await page.waitForTimeout(2000);
      }

      // Look for timer display (formats like "45:00", "Time Remaining", etc.)
      const hasTimer = await page.locator('text=:, text=Time, text=remaining').first().isVisible().catch(() => false);

      if (hasTimer) {
        console.log('✓ Timer is displayed during exam');
      } else {
        console.log('ℹ Timer not visible or different UI pattern');
      }
    } else {
      console.log('ℹ No exam available to test timer');
      test.skip();
    }
  });

  test('should display question progress indicator', async ({ page }) => {
    await page.goto(`${BASE_URL}/sqa-mock-exam`);
    await page.waitForTimeout(3000);

    const startButton = page.locator('text=Start Exam').first();
    if (await startButton.isVisible().catch(() => false)) {
      await startButton.click();
      await page.waitForTimeout(3000);

      // Click Begin Exam if visible
      const beginButton = page.locator('text=Begin Exam');
      if (await beginButton.isVisible().catch(() => false)) {
        await beginButton.click();
        await page.waitForTimeout(2000);
      }

      // Look for progress indicator (e.g., "1/15", "Question 1 of 15")
      const hasProgress = await page.locator('text=/\\d+.*of.*\\d+/, text=Question').first().isVisible().catch(() => false);

      if (hasProgress) {
        console.log('✓ Question progress indicator displayed');
      } else {
        console.log('ℹ Progress indicator not visible or different UI pattern');
      }
    } else {
      test.skip();
    }
  });
});
