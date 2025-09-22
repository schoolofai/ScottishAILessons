import { test, expect } from '@playwright/test';
import { TestHelper } from '../helpers/test-utils';

test.describe('Enhanced Student Dashboard', () => {
  let helper: TestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new TestHelper(page);
    await helper.setupTest();
  });

  test.afterEach(async () => {
    await helper.cleanupTest();
  });

  test('renders complete dashboard with all integrated components', async ({ page }) => {
    // Mock student initialization
    await helper.mock.mockStudentInitialization();

    // Mock multiple courses
    await helper.mock.mockMultipleCourses();

    // Mock recommendations for default course
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForDashboardLoaded();

    // Verify main dashboard structure
    await expect(page.locator('[data-testid="student-dashboard"]')).toBeVisible();

    // Verify header section
    await expect(page.locator('h1')).toContainText('Welcome back');

    // Verify course navigation section
    await expect(page.locator('[data-testid="course-navigation-section"]')).toBeVisible();

    // Verify recommendations section
    await expect(page.locator('[data-testid="recommendations-section"]')).toBeVisible();
  });

  test('displays student name in welcome header', async ({ page }) => {
    await helper.mock.mockStudentInitialization('Alice Johnson');
    await helper.mock.mockMultipleCourses();

    await page.goto('/dashboard');
    await helper.dashboard.waitForDashboardLoaded();

    const welcomeHeader = page.locator('h1');
    await expect(welcomeHeader).toContainText('Welcome back, Alice Johnson!');
  });

  test('handles dashboard initialization loading state', async ({ page }) => {
    // Mock slow student initialization
    await helper.mock.mockDelay(2000, '/api/student/initialize');

    await page.goto('/dashboard');

    // Check loading state
    await expect(page.locator('[data-testid="dashboard-loading"]')).toBeVisible();
    await expect(page.getByText('Loading your dashboard...')).toBeVisible();

    // Verify loading spinner
    const loadingSpinner = page.locator('[data-testid="dashboard-loading"] .animate-spin');
    await expect(loadingSpinner).toBeVisible();
  });

  test('shows dashboard initialization error with retry option', async ({ page }) => {
    // Mock initialization error
    await helper.mock.mockAPIError(500, '/api/student/initialize');

    await page.goto('/dashboard');
    await page.waitForTimeout(1000);

    // Check error state
    await expect(page.locator('[data-testid="dashboard-error"]')).toBeVisible();

    // Check retry button
    const retryButton = page.locator('[data-testid="dashboard-retry"]');
    await expect(retryButton).toBeVisible();
    await expect(retryButton).toContainText('Retry');
  });

  test('integrates course navigation with recommendations loading', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockMultipleCourses();
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForDashboardLoaded();

    // Verify initial course and recommendations
    await expect(page.locator('[data-testid="course-tab-mathematics"]')).toHaveClass(/active/);
    await expect(page.locator('[data-testid="recommendations-section"]')).toBeVisible();

    // Switch to physics course
    await page.locator('[data-testid="course-tab-physics"]').click();

    // Should show recommendations loading for new course
    await expect(page.locator('[data-testid="recommendations-loading"]')).toBeVisible();
  });

  test('displays course progress information in navigation', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockCoursesWithProgress();

    await page.goto('/dashboard');
    await helper.dashboard.waitForDashboardLoaded();

    // Check progress indicators
    const mathTab = page.locator('[data-testid="course-tab-mathematics"]');
    await expect(mathTab.locator('[data-testid="course-progress"]')).toBeVisible();

    // Check progress text
    await expect(mathTab).toContainText('75%'); // Mock progress value

    // Check completed lessons count
    await expect(mathTab).toContainText('15 / 20'); // Mock lesson counts
  });

  test('shows enrollment status for different courses', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockCoursesWithEnrollment();

    await page.goto('/dashboard');
    await helper.dashboard.waitForDashboardLoaded();

    // Check enrolled course
    const enrolledCourse = page.locator('[data-testid="course-tab-mathematics"]');
    await expect(enrolledCourse).not.toHaveClass(/disabled/);

    // Check non-enrolled course
    const nonEnrolledCourse = page.locator('[data-testid="course-tab-chemistry"]');
    await expect(nonEnrolledCourse).toHaveClass(/disabled/);
    await expect(nonEnrolledCourse.locator('[data-testid="enrollment-badge"]')).toContainText('Not Enrolled');
  });

  test('handles course switching with recommendation updates', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockMultipleCourses();
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForDashboardLoaded();

    // Initial state - mathematics recommendations
    await expect(page.locator('[data-testid="top-pick-title"]')).toContainText('Advanced Algebra');

    // Mock physics recommendations
    await helper.mock.mockSuccessfulRecommendations('course_physics', 'physicsBasics');

    // Switch to physics course
    await page.locator('[data-testid="course-tab-physics"]').click();
    await helper.dashboard.waitForRecommendationsLoaded();

    // Should show physics recommendations
    await expect(page.locator('[data-testid="top-pick-title"]')).toContainText('Newton\'s Laws');
  });

  test('preserves lesson start functionality across course switches', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockMultipleCourses();
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');
    await helper.mock.mockLessonStart();

    await page.goto('/dashboard');
    await helper.dashboard.waitForDashboardLoaded();

    // Click start lesson button
    await page.locator('[data-testid="top-pick-start-button"]').click();

    // Should attempt navigation to session page
    await page.waitForURL(/\/session\/*/);
  });

  test('shows contextual information about active course', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockCourseDetails();

    await page.goto('/dashboard');
    await helper.dashboard.waitForDashboardLoaded();

    // Check course details section
    const courseInfo = page.locator('[data-testid="active-course-info"]');
    await expect(courseInfo).toBeVisible();

    // Check course metadata
    await expect(courseInfo).toContainText('Mathematics');
    await expect(courseInfo).toContainText('Secondary');
    await expect(courseInfo).toContainText('Advanced Level');
  });

  test('displays recent activity or session history', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockMultipleCourses();
    await helper.mock.mockRecentSessions();

    await page.goto('/dashboard');
    await helper.dashboard.waitForDashboardLoaded();

    // Check recent activity section
    const recentActivity = page.locator('[data-testid="recent-activity"]');
    await expect(recentActivity).toBeVisible();

    // Check recent session items
    await expect(page.locator('[data-testid="recent-session-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="recent-session-1"]')).toContainText('Completed:');
  });

  test('handles empty course list gracefully', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockEmptyCourses();

    await page.goto('/dashboard');
    await page.waitForTimeout(1000);

    // Should show empty course state
    await expect(page.locator('[data-testid="empty-courses-state"]')).toBeVisible();
    await expect(page.getByText('No courses available')).toBeVisible();
  });

  test('maintains responsive layout on different screen sizes', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockMultipleCourses();
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/dashboard');
    await helper.dashboard.waitForDashboardLoaded();

    // Dashboard should still be functional on mobile
    await expect(page.locator('[data-testid="student-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="course-navigation-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="recommendations-section"]')).toBeVisible();

    // Course tabs should stack or scroll on mobile
    const courseNavigation = page.locator('[data-testid="course-navigation-tabs"]');
    await expect(courseNavigation).toBeVisible();
  });

  test('provides accessibility features for screen readers', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockMultipleCourses();
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForDashboardLoaded();

    // Check main heading hierarchy
    const mainHeading = page.locator('h1');
    await expect(mainHeading).toBeVisible();

    // Check section headings
    await expect(page.locator('h2')).toHaveCount(2); // Courses and Recommendations sections

    // Check interactive elements have proper labels
    const startButton = page.locator('[data-testid="top-pick-start-button"]');
    await expect(startButton).toHaveAttribute('type', 'button');

    // Check course tabs have proper roles
    const courseTabs = page.locator('[data-testid^="course-tab-"]');
    await expect(courseTabs.first()).toHaveAttribute('role', 'tab');
  });

  test('shows loading states appropriately during course switches', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockMultipleCourses();
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForDashboardLoaded();

    // Mock slow recommendations loading for new course
    await helper.mock.mockDelay(1500, '/api/recommendations/course_physics');

    // Switch course and verify loading state
    await page.locator('[data-testid="course-tab-physics"]').click();

    // Should show recommendations loading
    await expect(page.locator('[data-testid="recommendations-loading"]')).toBeVisible();

    // Course navigation should remain functional
    await expect(page.locator('[data-testid="course-navigation-section"]')).toBeVisible();
  });

  test('handles concurrent course and recommendation errors', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockAPIError(500, '/api/courses');

    await page.goto('/dashboard');
    await page.waitForTimeout(1000);

    // Should show course loading error
    await expect(page.locator('[data-testid="courses-error"]')).toBeVisible();

    // Should not show recommendations section when courses fail to load
    await expect(page.locator('[data-testid="recommendations-section"]')).not.toBeVisible();
  });
});

test.describe('Enhanced Student Dashboard Performance', () => {
  let helper: TestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new TestHelper(page);
    await helper.setupTest();
  });

  test('loads dashboard efficiently with multiple components', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockMultipleCourses();
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    const startTime = Date.now();

    await page.goto('/dashboard');
    await helper.dashboard.waitForDashboardLoaded();

    const loadTime = Date.now() - startTime;

    // Dashboard should load in reasonable time (< 3 seconds)
    expect(loadTime).toBeLessThan(3000);

    // All main components should be visible
    await expect(page.locator('[data-testid="course-navigation-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="recommendations-section"]')).toBeVisible();
  });

  test('handles rapid course switching without breaking', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockMultipleCourses();
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForDashboardLoaded();

    // Rapidly switch between courses
    for (let i = 0; i < 3; i++) {
      await page.locator('[data-testid="course-tab-physics"]').click();
      await page.waitForTimeout(100);
      await page.locator('[data-testid="course-tab-mathematics"]').click();
      await page.waitForTimeout(100);
    }

    // Dashboard should still be functional
    await expect(page.locator('[data-testid="student-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="course-navigation-section"]')).toBeVisible();
  });
});

test.describe('Enhanced Student Dashboard Integration', () => {
  let helper: TestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new TestHelper(page);
    await helper.setupTest();
  });

  test('maintains state consistency across navigation', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockMultipleCourses();
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForDashboardLoaded();

    // Verify initial state
    const activeCourse = await page.locator('[data-testid^="course-tab-"][class*="active"]').getAttribute('data-testid');
    expect(activeCourse).toContain('mathematics');

    // Navigate away and back
    await page.goto('/about');
    await page.goBack();

    // Should maintain the same active course
    const activeCourseAfterReturn = await page.locator('[data-testid^="course-tab-"][class*="active"]').getAttribute('data-testid');
    expect(activeCourseAfterReturn).toContain('mathematics');
  });

  test('integrates with lesson session flow', async ({ page }) => {
    await helper.mock.mockStudentInitialization();
    await helper.mock.mockMultipleCourses();
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');
    await helper.mock.mockLessonStart();

    await page.goto('/dashboard');
    await helper.dashboard.waitForDashboardLoaded();

    // Start a lesson
    await page.locator('[data-testid="top-pick-start-button"]').click();

    // Should navigate to session
    await page.waitForURL(/\/session\/.*/);

    // Navigate back to dashboard
    await page.goto('/dashboard');

    // Dashboard should reload and show updated state
    await helper.dashboard.waitForDashboardLoaded();
    await expect(page.locator('[data-testid="student-dashboard"]')).toBeVisible();
  });
});