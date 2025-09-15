import { expect, test, beforeEach } from '@playwright/test';

test.describe('Recommendations API with MSW (RED)', () => {
  beforeEach(async ({ page }) => {
    // THIS WILL FAIL - MSW setup doesn't exist yet
    // Mock setup should intercept API calls before any navigation
    await page.addInitScript(() => {
      // Setup MSW worker - this will fail until MSW is configured
      if (typeof window !== 'undefined') {
        // @ts-expect-error - MSW not configured yet
        window.__MSW_WORKER?.start();
      }
    });

    // Navigate to login and authenticate
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@scottishailessons.com');
    await page.fill('[data-testid="password"]', 'red12345');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should mock successful recommendations API response', async ({ page }) => {
    // THIS WILL FAIL - MSW handlers don't exist yet
    // Should intercept GET /api/recommendations/course-math-123
    // and return mock lesson candidates

    // Navigate to Mathematics course tab
    await page.click('[data-testid="course-tab-mathematics"]');

    // Should receive mocked recommendation data
    await expect(page.locator('[data-testid="top-pick-title"]'))
      .toContainText('Mocked Fractions Lesson');
    await expect(page.locator('[data-testid="priority-score"]'))
      .toContainText('0.65');
  });

  test('should mock API error scenarios', async ({ page }) => {
    // THIS WILL FAIL - MSW error handlers don't exist yet
    // Should intercept and return 500 error for recommendations

    await page.evaluate(() => {
      // Mock API failure - this will fail until MSW is configured
      // @ts-expect-error - MSW not configured yet
      window.__MSW_WORKER?.use(
        // Mock 500 error response
      );
    });

    await page.click('[data-testid="course-tab-physics"]');

    // Should show error state, not fallback content
    await expect(page.locator('[data-testid="recommendations-error"]'))
      .toBeVisible();
    await expect(page.locator('[data-testid="recommendations-error"]'))
      .toContainText('Unable to load recommendations');
  });

  test('should mock session creation API', async ({ page }) => {
    // THIS WILL FAIL - MSW session handlers don't exist yet
    // Should intercept POST /api/sessions/start

    // First ensure recommendations are loaded
    await page.click('[data-testid="course-tab-mathematics"]');
    await expect(page.locator('[data-testid="top-pick-start-button"]'))
      .toBeVisible();

    // Mock session creation response
    await page.evaluate(() => {
      // @ts-expect-error - MSW not configured yet
      window.__MSW_WORKER?.use(
        // Mock session creation success
      );
    });

    await page.click('[data-testid="top-pick-start-button"]');

    // Should redirect to mocked session ID
    await expect(page).toHaveURL('/session/mocked-session-id-123');
  });

  test('should handle slow API responses with loading states', async ({ page }) => {
    // THIS WILL FAIL - MSW delay handlers don't exist yet
    // Should intercept and add artificial delay

    await page.evaluate(() => {
      // @ts-expect-error - MSW not configured yet
      window.__MSW_WORKER?.use(
        // Add 2 second delay to recommendations API
      );
    });

    await page.click('[data-testid="course-tab-english"]');

    // Should show loading state
    await expect(page.locator('[data-testid="recommendations-loading"]'))
      .toBeVisible();

    // Should eventually load content
    await expect(page.locator('[data-testid="recommendations-section"]'))
      .toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="recommendations-loading"]'))
      .not.toBeVisible();
  });

  test('should mock invalid authentication scenarios', async ({ page }) => {
    // THIS WILL FAIL - MSW auth handlers don't exist yet
    // Should intercept and return 401 for unauthenticated requests

    await page.evaluate(() => {
      // @ts-expect-error - MSW not configured yet
      window.__MSW_WORKER?.use(
        // Mock 401 unauthorized response
      );
    });

    await page.click('[data-testid="course-tab-mathematics"]');

    // Should redirect to login or show auth error
    // (Zero fallback - no placeholder recommendations)
    await expect(page).toHaveURL(/\/(login|auth-error)/);
  });

  test('should verify request payloads to course manager', async ({ page }) => {
    // THIS WILL FAIL - MSW request inspection doesn't exist yet
    // Should capture and validate request data sent to backend

    let capturedRequest: any = null;

    await page.evaluate(() => {
      // @ts-expect-error - MSW not configured yet
      window.__MSW_CAPTURED_REQUESTS = [];
    });

    await page.click('[data-testid="course-tab-mathematics"]');

    // Allow request to complete
    await page.waitForTimeout(1000);

    capturedRequest = await page.evaluate(() => {
      // @ts-expect-error - MSW not configured yet
      return window.__MSW_CAPTURED_REQUESTS?.find(
        (req: any) => req.url.includes('/api/recommendations')
      );
    });

    // Verify request structure
    expect(capturedRequest).toBeDefined();
    expect(capturedRequest.url).toContain('/course-math-123');
    expect(capturedRequest.method).toBe('GET');
    expect(capturedRequest.headers).toHaveProperty('authorization');
  });

  test('should test concurrent API requests', async ({ page }) => {
    // THIS WILL FAIL - MSW concurrent handling doesn't exist yet
    // Should handle multiple rapid course switches

    await page.evaluate(() => {
      // @ts-expect-error - MSW not configured yet
      window.__MSW_REQUEST_COUNT = 0;
    });

    // Rapidly switch between courses
    await page.click('[data-testid="course-tab-mathematics"]');
    await page.click('[data-testid="course-tab-physics"]');
    await page.click('[data-testid="course-tab-english"]');
    await page.click('[data-testid="course-tab-mathematics"]');

    // Allow all requests to settle
    await page.waitForTimeout(2000);

    const requestCount = await page.evaluate(() => {
      // @ts-expect-error - MSW not configured yet
      return window.__MSW_REQUEST_COUNT;
    });

    // Should handle all requests without race conditions
    expect(requestCount).toBeGreaterThan(0);
    await expect(page.locator('[data-testid="recommendations-section"]'))
      .toBeVisible();
  });
});