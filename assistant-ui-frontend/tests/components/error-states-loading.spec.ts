import { test, expect } from '@playwright/test';
import { TestHelper } from '../helpers/test-utils';

test.describe('Error States and Loading Indicators', () => {
  let helper: TestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new TestHelper(page);
    await helper.setupTest();
  });

  test.afterEach(async () => {
    await helper.cleanupTest();
  });

  test('shows proper loading states during dashboard initialization', async ({ page }) => {
    // Mock slow initialization
    await helper.mock.mockDelay(1000, '/api/student/initialize');

    await page.goto('/dashboard');

    // Check global loading state
    await expect(page.locator('[data-testid="dashboard-loading"]')).toBeVisible();
    await expect(page.getByText('Loading your dashboard...')).toBeVisible();

    // Check loading spinner
    const spinner = page.locator('[data-testid="dashboard-loading"] .animate-spin');
    await expect(spinner).toBeVisible();
    await expect(spinner).toHaveClass(/animate-spin/);

    // Should not show main dashboard content during loading
    await expect(page.locator('[data-testid="student-dashboard"]')).not.toBeVisible();
  });

  test('displays initialization error with retry functionality', async ({ page }) => {
    // Mock initialization failure
    await helper.mock.mockAPIError(500, '/api/student/initialize');

    await page.goto('/dashboard');
    await page.waitForTimeout(1000);

    // Check error display
    await expect(page.locator('[data-testid="dashboard-error"]')).toBeVisible();

    // Check error message
    const errorAlert = page.locator('[data-testid="dashboard-error"] [role="alert"]');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText('Failed to initialize student');

    // Check retry button
    const retryButton = page.locator('[data-testid="dashboard-retry"]');
    await expect(retryButton).toBeVisible();
    await expect(retryButton).toContainText('Retry');

    // Should not show main dashboard content on error
    await expect(page.locator('[data-testid="student-dashboard"]')).not.toBeVisible();
  });

  test('handles course loading errors independently', async ({ page }) => {
    // Mock successful student init but course loading failure
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockAPIError(500, '/api/courses');

    await page.goto('/dashboard');
    await page.waitForTimeout(1000);

    // Should show main dashboard layout
    await expect(page.locator('[data-testid="student-dashboard"]')).toBeVisible();

    // Should show course loading error
    await expect(page.locator('[data-testid="courses-error"]')).toBeVisible();

    // Should not show recommendations section when courses fail
    await expect(page.locator('[data-testid="recommendations-section"]')).not.toBeVisible();
  });

  test('shows course loading indicator during slow course fetch', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockDelay(1500, '/api/courses');

    await page.goto('/dashboard');

    // Should show dashboard but with course loading state
    await expect(page.locator('[data-testid="student-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="course-navigation-section"]')).toBeVisible();

    // Check for course loading indicator within navigation
    const courseLoading = page.locator('[data-testid="course-navigation-loading"]');
    await expect(courseLoading).toBeVisible();
  });

  test('displays recommendations loading state during fetch', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockMultipleCourses();
    await helper.mock.mockDelay(1500, '/api/recommendations/course_c84473');

    await page.goto('/dashboard');
    await helper.dashboard.waitForCoursesLoaded();

    // Should show recommendations loading
    await expect(page.locator('[data-testid="recommendations-loading"]')).toBeVisible();
    await expect(page.getByText('Loading recommendations...')).toBeVisible();

    // Loading should have proper ARIA attributes
    const loadingElement = page.locator('[data-testid="recommendations-loading"]');
    await expect(loadingElement).toHaveAttribute('aria-live', 'polite');
  });

  test('handles recommendations API errors gracefully', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockMultipleCourses();
    await helper.mock.mockAPIError(500, '/api/recommendations/course_c84473');

    await page.goto('/dashboard');
    await helper.dashboard.waitForCoursesLoaded();
    await page.waitForTimeout(1000);

    // Should show recommendations error
    await expect(page.locator('[data-testid="recommendations-error"]')).toBeVisible();

    // Should show retry button
    const retryButton = page.locator('[data-testid="recommendations-retry"]');
    await expect(retryButton).toBeVisible();
    await expect(retryButton).toContainText('Try Again');

    // Error should include proper error styling
    const errorContainer = page.locator('[data-testid="recommendations-error"]');
    await expect(errorContainer).toHaveClass(/space-y-4/);
  });

  test('shows empty state when no recommendations available', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockMultipleCourses();
    await helper.mock.mockEmptyRecommendations();

    await page.goto('/dashboard');
    await helper.dashboard.waitForCoursesLoaded();
    await page.waitForTimeout(1000);

    // Should show empty recommendations state
    await expect(page.locator('[data-testid="recommendations-empty-state"]')).toBeVisible();
    await expect(page.getByText('No recommendations available')).toBeVisible();

    // Should show helpful message
    await expect(page.getByText('Check back later for personalized lesson suggestions')).toBeVisible();

    // Should have refresh option
    const refreshButton = page.locator('[data-testid="recommendations-empty-state"] button');
    await expect(refreshButton).toBeVisible();
    await expect(refreshButton).toContainText('Refresh');
  });

  test('handles network timeouts with appropriate error messages', async ({ page }) => {
    // Mock extremely slow response to simulate timeout
    await helper.mock.mockDelay(30000, '/api/recommendations/course_c84473');

    await page.goto('/dashboard');

    // Navigate away and back to simulate user action during slow loading
    await page.goto('/about');
    await page.goBack();

    // Should handle the interrupted request gracefully
    await expect(page.locator('[data-testid="student-dashboard"]')).toBeVisible();
  });

  test('maintains loading state accessibility standards', async ({ page }) => {
    await helper.mock.mockDelay(1000, '/api/student/initialize');

    await page.goto('/dashboard');

    // Check main loading state accessibility
    const mainLoading = page.locator('[data-testid="dashboard-loading"]');
    await expect(mainLoading).toBeVisible();

    // Should be announced to screen readers
    await expect(mainLoading).toHaveAttribute('aria-live', 'polite');

    // Loading text should be readable
    const loadingText = mainLoading.getByText('Loading your dashboard...');
    await expect(loadingText).toBeVisible();
  });

  test('shows proper error hierarchy for multiple simultaneous failures', async ({ page }) => {
    // Mock multiple API failures
    await helper.mock.mockAPIError(500, '/api/student/initialize');
    await helper.mock.mockAPIError(500, '/api/courses');
    await helper.mock.mockAPIError(500, '/api/recommendations/course_c84473');

    await page.goto('/dashboard');
    await page.waitForTimeout(1000);

    // Should prioritize initialization error (highest level)
    await expect(page.locator('[data-testid="dashboard-error"]')).toBeVisible();

    // Should not show lower-level errors when init fails
    await expect(page.locator('[data-testid="courses-error"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="recommendations-error"]')).not.toBeVisible();
  });

  test('provides clear error messages for different failure types', async ({ page }) => {
    // Test different error scenarios
    const errorScenarios = [
      { endpoint: '/api/student/initialize', expectedText: 'Failed to initialize student', testId: 'dashboard-error' },
      { endpoint: '/api/courses', expectedText: 'Failed to load courses', testId: 'courses-error' },
      { endpoint: '/api/recommendations/course_c84473', expectedText: 'Failed to load recommendations', testId: 'recommendations-error' }
    ];

    for (const scenario of errorScenarios) {
      await page.reload();

      if (scenario.endpoint !== '/api/student/initialize') {
        await helper.mock.mockStudentInitialization();
      }
      if (scenario.endpoint !== '/api/courses' && scenario.endpoint !== '/api/student/initialize') {
        await helper.mock.mockMultipleCourses();
      }

      await helper.mock.mockAPIError(500, scenario.endpoint);

      await page.goto('/dashboard');
      await page.waitForTimeout(1000);

      // Check for specific error message
      const errorElement = page.locator(`[data-testid="${scenario.testId}"]`);
      if (scenario.endpoint === '/api/student/initialize' ||
          (scenario.endpoint === '/api/courses' && await page.locator('[data-testid="student-dashboard"]').isVisible()) ||
          (scenario.endpoint.includes('/api/recommendations/') && await page.locator('[data-testid="student-dashboard"]').isVisible())) {
        await expect(errorElement).toBeVisible();
        await expect(errorElement).toContainText(scenario.expectedText);
      }
    }
  });

  test('allows retry functionality from different error states', async ({ page }) => {
    // Test initialization error retry
    await helper.mock.mockAPIError(500, '/api/student/initialize');

    await page.goto('/dashboard');
    await page.waitForTimeout(1000);

    // Click retry button
    const retryButton = page.locator('[data-testid="dashboard-retry"]');
    await expect(retryButton).toBeVisible();

    // Mock successful retry
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockMultipleCourses();

    await retryButton.click();

    // Should attempt to reload
    await expect(page.locator('[data-testid="dashboard-loading"]')).toBeVisible();
  });

  test('shows progressive loading for complex dashboard initialization', async ({ page }) => {
    // Mock sequential loading with different delays
    await helper.mock.mockDelay(500, '/api/student/initialize');
    await helper.mock.mockDelay(800, '/api/courses');
    await helper.mock.mockDelay(1000, '/api/recommendations/course_c84473');

    await page.goto('/dashboard');

    // Should show initial loading
    await expect(page.locator('[data-testid="dashboard-loading"]')).toBeVisible();

    // Wait for student initialization
    await page.waitForTimeout(600);
    await expect(page.locator('[data-testid="student-dashboard"]')).toBeVisible();

    // Should show course loading
    await expect(page.locator('[data-testid="course-navigation-loading"]')).toBeVisible();

    // Wait for courses to load
    await page.waitForTimeout(400);

    // Should show recommendations loading
    await expect(page.locator('[data-testid="recommendations-loading"]')).toBeVisible();
  });

  test('maintains UI responsiveness during error states', async ({ page }) => {
    await helper.mock.mockAPIError(500, '/api/recommendations/course_c84473');
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockMultipleCourses();

    await page.goto('/dashboard');
    await helper.dashboard.waitForCoursesLoaded();

    // Even with recommendations error, course navigation should work
    await expect(page.locator('[data-testid="course-navigation-section"]')).toBeVisible();

    // Course tabs should still be interactive
    const physicsCourseTab = page.locator('[data-testid="course-tab-physics"]');
    if (await physicsCourseTab.isVisible()) {
      await physicsCourseTab.click();
      // Should update active course despite recommendations error
      await expect(physicsCourseTab).toHaveClass(/active/);
    }
  });
});

test.describe('Loading State Performance', () => {
  let helper: TestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new TestHelper(page);
    await helper.setupTest();
  });

  test('shows loading states within reasonable timeframes', async ({ page }) => {
    const startTime = Date.now();

    await helper.mock.mockStudentInitialization();
    await helper.mock.mockMultipleCourses();
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForDashboardLoaded();

    const loadTime = Date.now() - startTime;

    // Dashboard should load within reasonable time
    expect(loadTime).toBeLessThan(5000);

    // All components should be visible
    await expect(page.locator('[data-testid="course-navigation-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="recommendations-section"]')).toBeVisible();
  });

  test('handles rapid state transitions smoothly', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockMultipleCourses();

    await page.goto('/dashboard');
    await helper.dashboard.waitForCoursesLoaded();

    // Rapidly switch between different error/success states
    for (let i = 0; i < 3; i++) {
      await helper.mock.mockAPIError(500, `/api/recommendations/course_c84473`);
      await page.reload();
      await page.waitForTimeout(300);

      await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');
      await page.reload();
      await page.waitForTimeout(300);
    }

    // Dashboard should remain stable
    await expect(page.locator('[data-testid="student-dashboard"]')).toBeVisible();
  });
});