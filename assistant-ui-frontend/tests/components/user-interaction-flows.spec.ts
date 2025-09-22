import { test, expect } from '@playwright/test';
import { TestHelper } from '../helpers/test-utils';

test.describe('User Interaction Flows', () => {
  let helper: TestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new TestHelper(page);
    await helper.setupTest();
  });

  test.afterEach(async () => {
    await helper.cleanupTest();
  });

  test('completes full lesson selection flow from dashboard', async ({ page }) => {
    await helper.mock.mockStudentInitialization('Jane Doe');
    await helper.mock.mockMultipleCourses();
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');
    await helper.mock.mockLessonStart();

    await page.goto('/dashboard');
    await helper.dashboard.waitForDashboardLoaded();

    // Verify dashboard is loaded with recommendations
    await expect(page.locator('[data-testid="recommendations-section"]')).toBeVisible();

    // Click on top pick lesson
    const topPickButton = page.locator('[data-testid="top-pick-start-button"]');
    await expect(topPickButton).toBeVisible();
    await expect(topPickButton).toContainText('Start Lesson');

    // Start lesson
    await topPickButton.click();

    // Should navigate to session page
    await page.waitForURL(/\/session\/.*/);
    expect(page.url()).toMatch(/\/session\/.*/);
  });

  test('handles course switching with immediate recommendation updates', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockMultipleCourses();
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForDashboardLoaded();

    // Verify initial mathematics recommendations
    await expect(page.locator('[data-testid="top-pick-title"]')).toContainText('Advanced Algebra');

    // Mock physics recommendations
    await helper.mock.mockSuccessfulRecommendations('course_physics', 'physicsBasics');

    // Switch to physics course
    const physicsTab = page.locator('[data-testid="course-tab-physics"]');
    await expect(physicsTab).toBeVisible();
    await physicsTab.click();

    // Verify course tab becomes active
    await expect(physicsTab).toHaveClass(/active/);

    // Wait for new recommendations to load
    await helper.dashboard.waitForRecommendationsLoaded();

    // Verify physics recommendations are displayed
    await expect(page.locator('[data-testid="top-pick-title"]')).toContainText('Newton\'s Laws');
  });

  test('supports keyboard navigation through course tabs', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockMultipleCourses();
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForDashboardLoaded();

    // Focus on first course tab
    const mathTab = page.locator('[data-testid="course-tab-mathematics"]');
    await mathTab.focus();

    // Navigate with right arrow key
    await page.keyboard.press('ArrowRight');

    // Physics tab should be focused
    const physicsTab = page.locator('[data-testid="course-tab-physics"]');
    await expect(physicsTab).toBeFocused();

    // Press Enter to activate
    await page.keyboard.press('Enter');

    // Should activate physics course
    await expect(physicsTab).toHaveClass(/active/);
  });

  test('handles lesson start with proper context preservation', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockMultipleCourses();
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForDashboardLoaded();

    // Mock lesson start API
    await page.route('/api/start-lesson', async route => {
      const request = route.request();
      const body = request.postData();

      // Verify lesson start request includes proper context
      expect(body).toContain('course_c84473');
      expect(body).toContain('lessonTemplateId');
      expect(body).toContain('threadId');
      expect(body).toContain('recommendationsState');

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessionId: 'session_123',
          threadId: 'thread_456'
        })
      });
    });

    // Start lesson
    await page.locator('[data-testid="top-pick-start-button"]').click();

    // Should navigate with session context
    await page.waitForURL(/\/session\/session_123/);
  });

  test('supports alternative candidate selection', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockMultipleCourses();

    // Mock multiple candidates
    await page.route('/api/recommendations/course_c84473', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          available: true,
          recommendations_ready: true,
          thread_id: 'thread_123',
          candidates: [
            {
              lessonTemplateId: 'lt_1',
              title: 'Advanced Algebra',
              priorityScore: 0.85,
              reasons: ['overdue'],
              flags: []
            },
            {
              lessonTemplateId: 'lt_2',
              title: 'Basic Geometry',
              priorityScore: 0.60,
              reasons: ['low mastery'],
              flags: []
            },
            {
              lessonTemplateId: 'lt_3',
              title: 'Number Theory',
              priorityScore: 0.45,
              reasons: ['early order'],
              flags: []
            }
          ],
          metadata: {
            total_candidates: 3,
            generated_at: new Date().toISOString()
          }
        })
      });
    });

    await page.goto('/dashboard');
    await helper.dashboard.waitForDashboardLoaded();

    // Verify multiple candidates are shown
    await expect(page.locator('[data-testid="candidate-card-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="candidate-card-2"]')).toBeVisible();

    // Select second candidate
    const secondCandidateButton = page.locator('[data-testid="candidate-card-1"] button');
    await expect(secondCandidateButton).toBeVisible();
    await expect(secondCandidateButton).toContainText('Start');

    await helper.mock.mockLessonStart();
    await secondCandidateButton.click();

    // Should start lesson with second candidate
    await page.waitForURL(/\/session\/.*/);
  });

  test('handles retry actions for failed operations', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockMultipleCourses();
    await helper.mock.mockAPIError(500, '/api/recommendations/course_c84473');

    await page.goto('/dashboard');
    await helper.dashboard.waitForCoursesLoaded();

    // Should show recommendations error
    await expect(page.locator('[data-testid="recommendations-error"]')).toBeVisible();

    // Click retry button
    const retryButton = page.locator('[data-testid="recommendations-retry"]');
    await expect(retryButton).toBeVisible();

    // Mock successful retry
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await retryButton.click();

    // Should show loading then success
    await expect(page.locator('[data-testid="recommendations-loading"]')).toBeVisible();
    await helper.dashboard.waitForRecommendationsLoaded();
    await expect(page.locator('[data-testid="recommendations-section"]')).toBeVisible();
  });

  test('preserves user session across page navigation', async ({ page }) => {
    await helper.mock.mockStudentInitialization('Alex Smith');
    await helper.mock.mockMultipleCourses();
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForDashboardLoaded();

    // Verify user name is displayed
    await expect(page.getByText('Welcome back, Alex Smith!')).toBeVisible();

    // Navigate away and back
    await page.goto('/about');
    await page.goBack();

    // Should preserve session
    await helper.dashboard.waitForDashboardLoaded();
    await expect(page.getByText('Welcome back, Alex Smith!')).toBeVisible();
  });

  test('handles concurrent user actions gracefully', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockMultipleCourses();
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForDashboardLoaded();

    // Rapidly click multiple course tabs
    const mathTab = page.locator('[data-testid="course-tab-mathematics"]');
    const physicsTab = page.locator('[data-testid="course-tab-physics"]');

    // Mock both course recommendations
    await helper.mock.mockSuccessfulRecommendations('course_physics', 'physicsBasics');

    // Click tabs rapidly
    await mathTab.click();
    await physicsTab.click();
    await mathTab.click();

    // Should handle the rapid clicks and settle on final state
    await helper.dashboard.waitForRecommendationsLoaded();
    await expect(mathTab).toHaveClass(/active/);
  });

  test('provides feedback for lesson start failures', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockMultipleCourses();
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForDashboardLoaded();

    // Mock lesson start failure
    await page.route('/api/start-lesson', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Failed to start lesson'
        })
      });
    });

    // Try to start lesson
    await page.locator('[data-testid="top-pick-start-button"]').click();

    // Should show error feedback
    await expect(page.locator('[data-testid="dashboard-error"]')).toBeVisible();
    await expect(page.getByText('Failed to start lesson')).toBeVisible();
  });

  test('supports reason badge interactions', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockMultipleCourses();
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForDashboardLoaded();

    // Hover over reason badge to show tooltip
    const reasonBadge = page.locator('[data-testid="reason-badge-overdue"]');
    await expect(reasonBadge).toBeVisible();

    await reasonBadge.hover();

    // Should show tooltip with explanation
    await expect(page.locator('[data-testid="reason-tooltip"]')).toBeVisible();
    await expect(page.getByText('This lesson addresses overdue learning outcomes')).toBeVisible();
  });

  test('handles progressive enhancement for touch devices', async ({ page }) => {
    // Simulate mobile device
    await page.setViewportSize({ width: 375, height: 667 });
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)');

    await helper.mock.mockStudentInitialization();
    await helper.mock.mockMultipleCourses();
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForDashboardLoaded();

    // Touch interactions should work for course switching
    const physicsTab = page.locator('[data-testid="course-tab-physics"]');
    await physicsTab.tap();

    // Should switch course on mobile
    await expect(physicsTab).toHaveClass(/active/);

    // Lesson start should work with touch
    await helper.mock.mockLessonStart();
    const startButton = page.locator('[data-testid="top-pick-start-button"]');
    await startButton.tap();

    await page.waitForURL(/\/session\/.*/);
  });

  test('provides accessible navigation for screen readers', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockMultipleCourses();
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForDashboardLoaded();

    // Check ARIA attributes for course tabs
    const courseTabList = page.locator('[role="tablist"]');
    await expect(courseTabList).toBeVisible();

    const courseTabs = page.locator('[role="tab"]');
    await expect(courseTabs).toHaveCount(2); // Math and Physics

    // Check active tab is properly marked
    const activeTab = page.locator('[role="tab"][aria-selected="true"]');
    await expect(activeTab).toHaveCount(1);

    // Check lesson start button accessibility
    const startButton = page.locator('[data-testid="top-pick-start-button"]');
    await expect(startButton).toHaveAttribute('type', 'button');
  });

  test('maintains state consistency during rapid interactions', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockMultipleCourses();
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForDashboardLoaded();

    // Perform rapid interactions
    const mathTab = page.locator('[data-testid="course-tab-mathematics"]');
    const physicsTab = page.locator('[data-testid="course-tab-physics"]');
    const refreshButton = page.locator('[data-testid="recommendations-retry"]');

    // Rapid course switching
    for (let i = 0; i < 5; i++) {
      await mathTab.click();
      await page.waitForTimeout(50);
      await physicsTab.click();
      await page.waitForTimeout(50);
    }

    // Should maintain consistent state
    await helper.dashboard.waitForRecommendationsLoaded();
    const activeTab = page.locator('[role="tab"][aria-selected="true"]');
    await expect(activeTab).toHaveCount(1);
  });

  test('supports browser back/forward navigation', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockMultipleCourses();
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    // Start on dashboard
    await page.goto('/dashboard');
    await helper.dashboard.waitForDashboardLoaded();

    // Navigate to different page
    await page.goto('/profile');

    // Use browser back button
    await page.goBack();

    // Should return to dashboard
    await helper.dashboard.waitForDashboardLoaded();
    await expect(page.locator('[data-testid="student-dashboard"]')).toBeVisible();

    // Use browser forward button
    await page.goForward();
    expect(page.url()).toContain('/profile');
  });
});

test.describe('User Interaction Performance', () => {
  let helper: TestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new TestHelper(page);
    await helper.setupTest();
  });

  test('responds to user interactions within acceptable timeframes', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockMultipleCourses();
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForDashboardLoaded();

    // Measure course switching response time
    const startTime = Date.now();

    await page.locator('[data-testid="course-tab-physics"]').click();

    // Wait for visual feedback (tab activation)
    await expect(page.locator('[data-testid="course-tab-physics"]')).toHaveClass(/active/);

    const responseTime = Date.now() - startTime;

    // Interaction should be responsive (< 100ms for visual feedback)
    expect(responseTime).toBeLessThan(100);
  });

  test('handles multiple simultaneous user actions efficiently', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockMultipleCourses();

    await page.goto('/dashboard');
    await helper.dashboard.waitForCoursesLoaded();

    // Perform multiple actions simultaneously
    const actions = [
      page.locator('[data-testid="course-tab-physics"]').click(),
      page.locator('[data-testid="course-tab-mathematics"]').click(),
      page.reload(),
    ];

    // Should handle concurrent actions without crashing
    await Promise.allSettled(actions);

    // Page should remain functional
    await helper.dashboard.waitForDashboardLoaded();
    await expect(page.locator('[data-testid="student-dashboard"]')).toBeVisible();
  });
});