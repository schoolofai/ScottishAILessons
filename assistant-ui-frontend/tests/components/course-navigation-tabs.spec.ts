import { test, expect } from '@playwright/test';
import { TestHelper } from '../helpers/test-utils';

test.describe('CourseNavigationTabs Component', () => {
  let helper: TestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new TestHelper(page);
    await helper.setupTest();
  });

  test.afterEach(async () => {
    await helper.cleanupTest();
  });

  test('renders course tabs with enrollment data', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');

    // Verify course navigation tabs are visible
    await expect(page.locator('[data-testid="course-navigation-tabs"]')).toBeVisible();

    // Check for expected course tabs
    await expect(page.locator('[data-testid="course-tab-mathematics"]')).toBeVisible();
    await expect(page.locator('[data-testid="course-tab-physics"]')).toBeVisible();
    await expect(page.locator('[data-testid="course-tab-english"]')).toBeVisible();
  });

  test('displays course titles correctly', async ({ page }) => {
    await page.goto('/dashboard');

    // Check course tab titles
    await expect(page.locator('[data-testid="course-tab-mathematics"]')).toContainText('Mathematics');
    await expect(page.locator('[data-testid="course-tab-physics"]')).toContainText('Physics');
    await expect(page.locator('[data-testid="course-tab-english"]')).toContainText('English');
  });

  test('shows active state for selected tab', async ({ page }) => {
    await page.goto('/dashboard');

    // Mathematics should be active by default
    await helper.assert.expectCourseTabActive('mathematics');

    // Other tabs should not be active
    const physicsTab = page.locator('[data-testid="course-tab-physics"]');
    const englishTab = page.locator('[data-testid="course-tab-english"]');

    await expect(physicsTab).toHaveAttribute('aria-selected', 'false');
    await expect(englishTab).toHaveAttribute('aria-selected', 'false');
  });

  test('switches active tab when clicked', async ({ page }) => {
    await page.goto('/dashboard');

    // Click physics tab
    await page.click('[data-testid="course-tab-physics"]');

    // Verify physics is now active
    await helper.assert.expectCourseTabActive('physics');

    // Verify mathematics is no longer active
    const mathTab = page.locator('[data-testid="course-tab-mathematics"]');
    await expect(mathTab).toHaveAttribute('aria-selected', 'false');
  });

  test('maintains accessibility attributes', async ({ page }) => {
    await page.goto('/dashboard');

    const tabs = [
      '[data-testid="course-tab-mathematics"]',
      '[data-testid="course-tab-physics"]',
      '[data-testid="course-tab-english"]'
    ];

    for (const tabSelector of tabs) {
      const tab = page.locator(tabSelector);

      // Check accessibility attributes
      await expect(tab).toHaveAttribute('role', 'tab');
      await expect(tab).toHaveAttribute('tabindex');
      await expect(tab).toHaveAttribute('aria-selected');
    }

    // Check tablist container
    await expect(page.locator('[data-testid="course-navigation-tabs"]')).toHaveAttribute('role', 'tablist');
  });

  test('displays course enrollment count', async ({ page }) => {
    await page.goto('/dashboard');

    // Each course tab should show enrollment status
    const mathTab = page.locator('[data-testid="course-tab-mathematics"]');
    const physicsTab = page.locator('[data-testid="course-tab-physics"]');
    const englishTab = page.locator('[data-testid="course-tab-english"]');

    // Verify enrollment indicators are present
    await expect(mathTab.locator('[data-testid="enrollment-indicator"]')).toBeVisible();
    await expect(physicsTab.locator('[data-testid="enrollment-indicator"]')).toBeVisible();
    await expect(englishTab.locator('[data-testid="enrollment-indicator"]')).toBeVisible();
  });

  test('handles keyboard navigation', async ({ page }) => {
    await page.goto('/dashboard');

    // Focus on first tab
    await page.focus('[data-testid="course-tab-mathematics"]');

    // Navigate with arrow keys
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-testid="course-tab-physics"]')).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-testid="course-tab-english"]')).toBeFocused();

    // Test wrap-around
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-testid="course-tab-mathematics"]')).toBeFocused();

    // Test reverse navigation
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('[data-testid="course-tab-english"]')).toBeFocused();
  });

  test('triggers course content reload on tab change', async ({ page }) => {
    await page.goto('/dashboard');

    // Mock request tracking
    await helper.mock.resetRequestTracking();

    // Click physics tab
    await page.click('[data-testid="course-tab-physics"]');

    // Wait for recommendations to load
    await helper.dashboard.waitForRecommendationsLoaded();

    // Verify API calls were made for physics course
    const requests = await helper.mock.getCapturedRequests();
    const recommendationRequests = requests.filter(r => r.url.includes('/api/recommendations/'));

    expect(recommendationRequests.length).toBeGreaterThan(0);
  });

  test('shows loading state during course switch', async ({ page }) => {
    await page.goto('/dashboard');

    // Mock delay for recommendation API
    await helper.mock.mockDelay(1000, '/api/recommendations/');

    // Click physics tab
    await page.click('[data-testid="course-tab-physics"]');

    // Verify loading state appears
    await helper.assert.expectLoadingState();

    // Verify loading state disappears after delay
    await expect(page.locator('[data-testid="recommendations-loading"]')).not.toBeVisible({ timeout: 2000 });
  });

  test('displays course progress indicators', async ({ page }) => {
    await page.goto('/dashboard');

    const tabs = [
      '[data-testid="course-tab-mathematics"]',
      '[data-testid="course-tab-physics"]',
      '[data-testid="course-tab-english"]'
    ];

    for (const tabSelector of tabs) {
      const tab = page.locator(tabSelector);

      // Check for progress indicator
      await expect(tab.locator('[data-testid="course-progress"]')).toBeVisible();

      // Check for completion percentage
      const progressText = await tab.locator('[data-testid="course-progress"]').textContent();
      expect(progressText).toMatch(/\d+%/); // Should contain percentage
    }
  });

  test('handles course data from recommendations API response', async ({ page }) => {
    // Mock successful recommendations with course metadata
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');

    // Wait for course tabs to render with API data
    await expect(page.locator('[data-testid="course-navigation-tabs"]')).toBeVisible();

    // Verify course data is displayed correctly
    const mathTab = page.locator('[data-testid="course-tab-mathematics"]');
    await expect(mathTab).toContainText('Mathematics');

    // Verify enrollment status is shown
    await expect(mathTab.locator('[data-testid="enrollment-indicator"]')).toBeVisible();
  });
});

test.describe('CourseNavigationTabs Error States', () => {
  let helper: TestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new TestHelper(page);
    await helper.setupTest();
  });

  test('handles missing course enrollment gracefully', async ({ page }) => {
    // Mock API error for unenrolled course
    await helper.mock.mockAPIError(403, '/api/recommendations/');

    await page.goto('/dashboard');

    // Verify error state is handled gracefully
    await expect(page.locator('[data-testid="course-navigation-tabs"]')).toBeVisible();

    // Tabs should still be rendered but with disabled state
    const tabs = page.locator('[data-testid^="course-tab-"]');
    await expect(tabs.first()).toBeVisible();
  });

  test('shows loading state for course data', async ({ page }) => {
    // Mock slow API response
    await helper.mock.mockDelay(2000, '/api/courses/');

    await page.goto('/dashboard');

    // Verify course tabs show loading state
    await expect(page.locator('[data-testid="course-navigation-loading"]')).toBeVisible();

    // Verify loading state clears
    await expect(page.locator('[data-testid="course-navigation-loading"]')).not.toBeVisible({ timeout: 3000 });
  });
});