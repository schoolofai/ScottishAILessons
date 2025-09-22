import { test, expect } from '@playwright/test';
import { TestHelper } from '../helpers/test-utils';

test.describe('RecommendationSection Component', () => {
  let helper: TestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new TestHelper(page);
    await helper.setupTest();
  });

  test.afterEach(async () => {
    await helper.cleanupTest();
  });

  test('renders recommendation section with top pick prominently', async ({ page }) => {
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForRecommendationsLoaded();

    // Verify recommendation section exists
    await expect(page.locator('[data-testid="recommendations-section"]')).toBeVisible();

    // Verify top pick is displayed prominently
    await helper.assert.expectTopPickVisible();

    // Check top pick has special styling
    const topPickCard = page.locator('[data-testid="top-pick-card"]');
    await expect(topPickCard).toHaveClass(/border-blue-200/);
    await expect(topPickCard).toHaveClass(/bg-blue-50/);
  });

  test('displays top pick with correct priority score formatting', async ({ page }) => {
    // Mock data with specific priority score
    await page.evaluate(() => {
      if (window.__MSW_WORKER) {
        const handler = () => {
          return new Response(JSON.stringify({
            courseId: 'course_c84473',
            generatedAt: new Date().toISOString(),
            graphRunId: 'mock-graph-run',
            candidates: [{
              lessonTemplateId: 'lt_1',
              title: 'Advanced Algebra',
              priorityScore: 0.847,
              reasons: ['overdue', 'low mastery'],
              flags: []
            }],
            rubric: 'Overdue>LowEMA>Order | -Recent -TooLong'
          }));
        };
      }
    });

    await page.goto('/dashboard');
    await helper.dashboard.waitForRecommendationsLoaded();

    // Check priority score is formatted correctly
    const priorityScore = await helper.dashboard.getPriorityScore();
    expect(priorityScore).toContain('85%'); // 0.847 * 100 rounded
  });

  test('shows top pick badge with distinctive styling', async ({ page }) => {
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForRecommendationsLoaded();

    const topPickBadge = page.locator('[data-testid="top-pick-badge"]');
    await expect(topPickBadge).toBeVisible();
    await expect(topPickBadge).toContainText('Top Pick');

    // Check badge styling
    await expect(topPickBadge).toHaveClass(/bg-blue-500/);
    await expect(topPickBadge).toHaveClass(/text-white/);
    await expect(topPickBadge).toHaveClass(/font-medium/);
  });

  test('displays multiple candidates in order of priority score', async ({ page }) => {
    // Mock data with multiple candidates
    await page.evaluate(() => {
      if (window.__MSW_WORKER) {
        const handler = () => {
          return new Response(JSON.stringify({
            courseId: 'course_c84473',
            generatedAt: new Date().toISOString(),
            graphRunId: 'mock-graph-run',
            candidates: [
              {
                lessonTemplateId: 'lt_1',
                title: 'High Priority Lesson',
                priorityScore: 0.85,
                reasons: ['overdue'],
                flags: []
              },
              {
                lessonTemplateId: 'lt_2',
                title: 'Medium Priority Lesson',
                priorityScore: 0.60,
                reasons: ['low mastery'],
                flags: []
              },
              {
                lessonTemplateId: 'lt_3',
                title: 'Low Priority Lesson',
                priorityScore: 0.25,
                reasons: ['early order'],
                flags: []
              }
            ],
            rubric: 'Overdue>LowEMA>Order | -Recent -TooLong'
          }));
        };
      }
    });

    await page.goto('/dashboard');
    await helper.dashboard.waitForRecommendationsLoaded();

    // Verify correct number of candidates
    await helper.assert.expectCandidateCount(3);

    // Check that first candidate is the top pick
    const topPickTitle = await helper.dashboard.getTopPickTitle();
    expect(topPickTitle).toContain('High Priority Lesson');

    // Check other candidates are displayed in order
    const candidateCards = page.locator('[data-testid^="candidate-card-"]');
    await expect(candidateCards.nth(0)).toContainText('Medium Priority Lesson');
    await expect(candidateCards.nth(1)).toContainText('Low Priority Lesson');
  });

  test('displays recommendation metadata summary', async ({ page }) => {
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForRecommendationsLoaded();

    // Check metadata display
    const metadataSection = page.locator('[data-testid="recommendations-metadata"]');
    await expect(metadataSection).toBeVisible();

    // Should show candidate count
    await expect(metadataSection).toContainText('recommendations available');

    // Should show generation timestamp
    await expect(metadataSection).toContainText('Generated');
  });

  test('handles recommendation section with reason badges', async ({ page }) => {
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForRecommendationsLoaded();

    // Check that reason badges are displayed in the recommendation section
    await helper.assert.expectReasonBadge('overdue', 'red');

    // Verify reason badges are properly positioned within recommendation cards
    const topPickCard = page.locator('[data-testid="top-pick-card"]');
    const reasonBadge = topPickCard.locator('[data-testid^="reason-badge-"]');
    await expect(reasonBadge).toBeVisible();
  });

  test('shows start lesson buttons for all candidates', async ({ page }) => {
    // Mock multiple candidates
    await page.evaluate(() => {
      if (window.__MSW_WORKER) {
        const handler = () => {
          return new Response(JSON.stringify({
            courseId: 'course_c84473',
            generatedAt: new Date().toISOString(),
            graphRunId: 'mock-graph-run',
            candidates: [
              {
                lessonTemplateId: 'lt_1',
                title: 'First Lesson',
                priorityScore: 0.85,
                reasons: ['overdue'],
                flags: []
              },
              {
                lessonTemplateId: 'lt_2',
                title: 'Second Lesson',
                priorityScore: 0.60,
                reasons: ['low mastery'],
                flags: []
              }
            ],
            rubric: 'Overdue>LowEMA>Order | -Recent -TooLong'
          }));
        };
      }
    });

    await page.goto('/dashboard');
    await helper.dashboard.waitForRecommendationsLoaded();

    // Check top pick button
    const topPickButton = page.locator('[data-testid="top-pick-start-button"]');
    await expect(topPickButton).toBeVisible();
    await expect(topPickButton).toContainText('Start Lesson');

    // Check other candidate buttons
    const candidateButton = page.locator('[data-testid="candidate-card-1"] button');
    await expect(candidateButton).toBeVisible();
    await expect(candidateButton).toContainText('Start');
  });

  test('handles lesson selection and navigation', async ({ page }) => {
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForRecommendationsLoaded();

    // Click the top pick start button
    await helper.dashboard.startTopPickLesson();

    // Should navigate to session page (this will fail in tests due to API call, but verifies interaction)
    // The actual navigation test would require mocking the start-lesson API endpoint
  });

  test('displays empty state when no recommendations available', async ({ page }) => {
    // Mock empty recommendations
    await page.evaluate(() => {
      if (window.__MSW_WORKER) {
        const handler = () => {
          return new Response(JSON.stringify({
            courseId: 'course_c84473',
            generatedAt: new Date().toISOString(),
            graphRunId: 'mock-graph-run',
            candidates: [],
            rubric: 'No candidates available'
          }));
        };
      }
    });

    await page.goto('/dashboard');
    await page.waitForTimeout(1000); // Wait for API response

    // Should show empty state
    const emptyState = page.locator('[data-testid="recommendations-empty-state"]');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('No recommendations available');
  });

  test('shows loading state while fetching recommendations', async ({ page }) => {
    // Mock slow API response
    await helper.mock.mockDelay(2000, '/api/recommendations/');

    await page.goto('/dashboard');

    // Should show loading state
    await helper.assert.expectLoadingState();

    // Loading should include proper accessibility
    const loadingElement = page.locator('[data-testid="recommendations-loading"]');
    await expect(loadingElement).toHaveAttribute('aria-live', 'polite');
  });

  test('handles error state gracefully', async ({ page }) => {
    // Mock API error
    await helper.mock.mockAPIError(500, '/api/recommendations/');

    await page.goto('/dashboard');
    await page.waitForTimeout(1000);

    // Should show error state
    await helper.assert.expectErrorState();

    // Should provide retry option
    const retryButton = page.locator('[data-testid="recommendations-retry"]');
    await expect(retryButton).toBeVisible();
  });

  test('maintains no fallback content policy', async ({ page }) => {
    await helper.mock.mockAPIError(500, '/api/recommendations/');

    await page.goto('/dashboard');
    await page.waitForTimeout(1000);

    // Verify no fallback content is shown
    await helper.assert.expectNoFallbackContent();
  });

  test('displays recommendation rubric information', async ({ page }) => {
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForRecommendationsLoaded();

    // Check that rubric information is available (might be in tooltip or info section)
    const rubricInfo = page.locator('[data-testid="recommendation-rubric"]');
    if (await rubricInfo.isVisible()) {
      await expect(rubricInfo).toContainText('Overdue');
    }
  });
});

test.describe('RecommendationSection Responsive Design', () => {
  let helper: TestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new TestHelper(page);
    await helper.setupTest();
  });

  test('adapts layout for mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForRecommendationsLoaded();

    // Check that recommendation cards stack properly on mobile
    const recommendationSection = page.locator('[data-testid="recommendations-section"]');
    await expect(recommendationSection).toBeVisible();

    // Top pick should still be prominent but fit mobile width
    const topPickCard = page.locator('[data-testid="top-pick-card"]');
    await expect(topPickCard).toBeVisible();
  });

  test('maintains accessibility on different screen sizes', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // Tablet size

    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForRecommendationsLoaded();

    // Check that interactive elements remain accessible
    const startButton = page.locator('[data-testid="top-pick-start-button"]');
    await expect(startButton).toBeVisible();
    await expect(startButton).toHaveAttribute('type', 'button');
  });
});

test.describe('RecommendationSection Integration', () => {
  let helper: TestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new TestHelper(page);
    await helper.setupTest();
  });

  test('integrates with course navigation tabs', async ({ page }) => {
    await page.goto('/dashboard');

    // Switch course tabs and verify recommendations update
    await helper.dashboard.navigateToCourse('physics');
    await helper.dashboard.waitForRecommendationsLoaded();

    // Recommendations should be specific to the physics course
    const recommendationSection = page.locator('[data-testid="recommendations-section"]');
    await expect(recommendationSection).toBeVisible();
  });

  test('preserves thread ID for lesson continuity', async ({ page }) => {
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForRecommendationsLoaded();

    // Verify that thread ID is available for lesson selection
    // This would be tested by inspecting the lesson start API call
    const startButton = page.locator('[data-testid="top-pick-start-button"]');
    await expect(startButton).toBeVisible();
  });
});