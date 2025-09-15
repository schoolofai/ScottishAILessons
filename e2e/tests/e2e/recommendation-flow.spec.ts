import { test, expect } from '@playwright/test';

test.describe('AI Recommendation Flow (RED)', () => {
  test.beforeEach(async ({ page }) => {
    // Login as test user
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@scottishailessons.com');
    await page.fill('[data-testid="password"]', 'red12345');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should display AI recommendation section for active course', async ({ page }) => {
    // THIS WILL FAIL - RecommendationSection component doesn't exist yet
    await expect(page.locator('[data-testid="recommendations-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="recommendations-header"]'))
      .toContainText('AI Recommendations for Mathematics');
  });

  test('should show top pick lesson with priority badge', async ({ page }) => {
    // THIS WILL FAIL - Top Pick component doesn't exist yet
    await expect(page.locator('[data-testid="top-pick-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="top-pick-badge"]')).toContainText('Top Pick');

    // Should show lesson title and metadata
    await expect(page.locator('[data-testid="top-pick-title"]'))
      .toContainText('Fractions ↔ Decimals ↔ Percents');
    await expect(page.locator('[data-testid="top-pick-duration"]'))
      .toContainText('45 min');
  });

  test('should display reason badges with correct colors', async ({ page }) => {
    // THIS WILL FAIL - ReasonBadge components don't exist yet
    await expect(page.locator('[data-testid="reason-badge-overdue"]'))
      .toHaveClass(/bg-red-100.*text-red-800/);
    await expect(page.locator('[data-testid="reason-badge-low-mastery"]'))
      .toHaveClass(/bg-orange-100.*text-orange-800/);
    await expect(page.locator('[data-testid="reason-badge-early-order"]'))
      .toHaveClass(/bg-blue-100.*text-blue-800/);
  });

  test('should show complete lesson candidate list', async ({ page }) => {
    // THIS WILL FAIL - candidate list doesn't exist yet
    const candidateCards = page.locator('[data-testid^="candidate-card-"]');
    await expect(candidateCards).toHaveCount(5); // Up to 5 candidates

    // First candidate should be the top pick
    await expect(candidateCards.first())
      .toContainText('Top Pick');

    // Each candidate should have priority score
    for (let i = 0; i < 5; i++) {
      const card = candidateCards.nth(i);
      await expect(card.locator('[data-testid="priority-score"]')).toBeVisible();
    }
  });

  test('should handle start lesson action from top pick', async ({ page }) => {
    // THIS WILL FAIL - start button and session creation don't exist yet
    const startButton = page.locator('[data-testid="top-pick-start-button"]');
    await expect(startButton).toBeVisible();
    await expect(startButton).toContainText('Start Lesson');

    // Click should trigger session creation
    await startButton.click();

    // Should redirect to session with proper ID format
    await expect(page).toHaveURL(/\/session\/[a-zA-Z0-9-]+/);
  });

  test('should show loading state while fetching recommendations', async ({ page }) => {
    // THIS WILL FAIL - loading states don't exist yet

    // Navigate to different course to trigger fresh API call
    await page.click('[data-testid="course-tab-physics"]');

    // Should show loading skeleton
    await expect(page.locator('[data-testid="recommendations-loading"]')).toBeVisible();

    // Loading should eventually resolve to actual recommendations
    await expect(page.locator('[data-testid="recommendations-section"]'))
      .toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="recommendations-loading"]'))
      .not.toBeVisible();
  });

  test('should handle recommendation API errors gracefully', async ({ page }) => {
    // THIS WILL FAIL - error handling doesn't exist yet

    // Mock API failure scenario (would need MSW in real implementation)
    // For now, test the UI expects error state components

    await expect(page.locator('[data-testid="recommendations-error"]'))
      .toContainText('Unable to load recommendations');
    await expect(page.locator('[data-testid="retry-recommendations-button"]'))
      .toContainText('Try Again');
  });

  test('should display transparent scoring rubric', async ({ page }) => {
    // THIS WILL FAIL - rubric display doesn't exist yet

    // Should show human-readable scoring explanation
    await expect(page.locator('[data-testid="scoring-rubric"]'))
      .toContainText('Overdue>LowEMA>Order | -Recent -TooLong');

    // Should have info tooltip
    const rubricTooltip = page.locator('[data-testid="rubric-tooltip"]');
    await page.hover('[data-testid="scoring-rubric"]');
    await expect(rubricTooltip).toBeVisible();
    await expect(rubricTooltip).toContainText('Priority scoring based on');
  });

  test('should maintain recommendation state across course switches', async ({ page }) => {
    // THIS WILL FAIL - state management doesn't exist yet

    // Get initial recommendations for Mathematics
    const mathTopPick = await page.locator('[data-testid="top-pick-title"]').textContent();

    // Switch to Physics
    await page.click('[data-testid="course-tab-physics"]');
    await expect(page.locator('[data-testid="recommendations-header"]'))
      .toContainText('Physics');

    // Switch back to Mathematics
    await page.click('[data-testid="course-tab-mathematics"]');

    // Should restore previous recommendations (cached)
    await expect(page.locator('[data-testid="top-pick-title"]'))
      .toContainText(mathTopPick || '');
  });

  test('should respect zero fallback policy on API failures', async ({ page }) => {
    // THIS WILL FAIL - zero fallback behavior doesn't exist yet

    // When API fails, should NOT show placeholder content
    // Should show clear error message instead
    const errorElement = page.locator('[data-testid="recommendations-error"]');

    if (await errorElement.isVisible()) {
      // If error state, verify no fallback recommendations are shown
      await expect(page.locator('[data-testid="fallback-recommendations"]'))
        .not.toBeVisible();
      await expect(page.locator('[data-testid="placeholder-candidates"]'))
        .not.toBeVisible();
    }
  });
});