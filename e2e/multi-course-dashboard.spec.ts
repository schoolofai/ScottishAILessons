import { test, expect } from '@playwright/test';

test.describe('Multi-Course Dashboard Display (RED)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@scottishailessons.com');
    await page.fill('[data-testid="password"]', 'red12345');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should display course navigation tabs for enrolled courses', async ({ page }) => {
    // THESE TESTS WILL FAIL - elements don't exist yet
    await expect(page.locator('[data-testid="course-tab-mathematics"]')).toBeVisible();
    await expect(page.locator('[data-testid="course-tab-physics"]')).toBeVisible();
    await expect(page.locator('[data-testid="course-tab-english"]')).toBeVisible();
  });

  test('should show enhanced welcome header with course count', async ({ page }) => {
    // THIS WILL FAIL - enhanced header doesn't exist yet
    await expect(page.locator('[data-testid="enhanced-welcome-header"]'))
      .toContainText('Ready to continue your learning across 3 courses?');
  });

  test('should display overdue lesson badges on course tabs', async ({ page }) => {
    // THIS WILL FAIL - badges don't exist yet
    await expect(page.locator('[data-testid="course-tab-mathematics"] [data-testid="overdue-badge"]'))
      .toContainText('2');
  });

  test('should allow course tab navigation', async ({ page }) => {
    // THIS WILL FAIL - tabs don't exist yet
    await page.click('[data-testid="course-tab-physics"]');
    await expect(page.locator('[data-testid="course-tab-physics"]')).toHaveClass(/border-blue-500/);
    await expect(page.locator('[data-testid="course-tab-physics"]')).toHaveClass(/text-blue-600/);
  });

  test('should maintain course selection state across tab switches', async ({ page }) => {
    // THIS WILL FAIL - state management doesn't exist yet
    await page.click('[data-testid="course-tab-english"]');
    await expect(page.locator('[data-testid="course-tab-english"]')).toHaveAttribute('aria-selected', 'true');

    await page.click('[data-testid="course-tab-mathematics"]');
    await expect(page.locator('[data-testid="course-tab-mathematics"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-testid="course-tab-english"]')).toHaveAttribute('aria-selected', 'false');
  });
});