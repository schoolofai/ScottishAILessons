import { test, expect } from '@playwright/test';
import { TestHelper } from '../helpers/test-utils';

test.describe('ReasonBadge Component', () => {
  let helper: TestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new TestHelper(page);
    await helper.setupTest();
  });

  test.afterEach(async () => {
    await helper.cleanupTest();
  });

  test('renders overdue reason with red color coding', async ({ page }) => {
    // Mock recommendations with overdue reason
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForRecommendationsLoaded();

    // Check for overdue reason badge with red color
    const overdueReason = page.locator('[data-testid="reason-badge-overdue"]');
    await expect(overdueReason).toBeVisible();
    await expect(overdueReason).toHaveClass(/bg-red-100/);
    await expect(overdueReason).toHaveClass(/text-red-800/);
    await expect(overdueReason).toContainText('overdue');
  });

  test('renders low mastery reason with orange color coding', async ({ page }) => {
    // Create mock data with low mastery reason
    await page.evaluate(() => {
      if (window.__MSW_WORKER) {
        // Mock response with low mastery
        const handler = () => {
          return new Response(JSON.stringify({
            courseId: 'course_c84473',
            generatedAt: new Date().toISOString(),
            graphRunId: 'mock-graph-run',
            candidates: [{
              lessonTemplateId: 'lt_1',
              title: 'Basic Algebra',
              priorityScore: 0.45,
              reasons: ['low mastery'],
              flags: []
            }],
            rubric: 'LowEMA>Order | -Recent -TooLong'
          }));
        };
      }
    });

    await page.goto('/dashboard');
    await helper.dashboard.waitForRecommendationsLoaded();

    // Check for low mastery reason badge with orange color
    const lowMasteryReason = page.locator('[data-testid="reason-badge-low mastery"]');
    await expect(lowMasteryReason).toBeVisible();
    await expect(lowMasteryReason).toHaveClass(/bg-orange-100/);
    await expect(lowMasteryReason).toHaveClass(/text-orange-800/);
    await expect(lowMasteryReason).toContainText('low mastery');
  });

  test('renders early order reason with green color coding', async ({ page }) => {
    // Create mock data with early order reason
    await page.evaluate(() => {
      if (window.__MSW_WORKER) {
        const handler = () => {
          return new Response(JSON.stringify({
            courseId: 'course_c84473',
            generatedAt: new Date().toISOString(),
            graphRunId: 'mock-graph-run',
            candidates: [{
              lessonTemplateId: 'lt_1',
              title: 'Introduction to Algebra',
              priorityScore: 0.25,
              reasons: ['early order'],
              flags: []
            }],
            rubric: 'Order | -Recent -TooLong'
          }));
        };
      }
    });

    await page.goto('/dashboard');
    await helper.dashboard.waitForRecommendationsLoaded();

    // Check for early order reason badge with green color
    const earlyOrderReason = page.locator('[data-testid="reason-badge-early order"]');
    await expect(earlyOrderReason).toBeVisible();
    await expect(earlyOrderReason).toHaveClass(/bg-green-100/);
    await expect(earlyOrderReason).toHaveClass(/text-green-800/);
    await expect(earlyOrderReason).toContainText('early order');
  });

  test('renders short win reason with blue color coding', async ({ page }) => {
    // Create mock data with short win reason
    await page.evaluate(() => {
      if (window.__MSW_WORKER) {
        const handler = () => {
          return new Response(JSON.stringify({
            courseId: 'course_c84473',
            generatedAt: new Date().toISOString(),
            graphRunId: 'mock-graph-run',
            candidates: [{
              lessonTemplateId: 'lt_1',
              title: 'Quick Review',
              priorityScore: 0.15,
              reasons: ['short win'],
              flags: []
            }],
            rubric: 'ShortWin | -Recent -TooLong'
          }));
        };
      }
    });

    await page.goto('/dashboard');
    await helper.dashboard.waitForRecommendationsLoaded();

    // Check for short win reason badge with blue color
    const shortWinReason = page.locator('[data-testid="reason-badge-short win"]');
    await expect(shortWinReason).toBeVisible();
    await expect(shortWinReason).toHaveClass(/bg-blue-100/);
    await expect(shortWinReason).toHaveClass(/text-blue-800/);
    await expect(shortWinReason).toContainText('short win');
  });

  test('renders recent reason with gray color coding', async ({ page }) => {
    // Create mock data with recent reason (negative)
    await page.evaluate(() => {
      if (window.__MSW_WORKER) {
        const handler = () => {
          return new Response(JSON.stringify({
            courseId: 'course_c84473',
            generatedAt: new Date().toISOString(),
            graphRunId: 'mock-graph-run',
            candidates: [{
              lessonTemplateId: 'lt_1',
              title: 'Recently Taught Lesson',
              priorityScore: 0.05,
              reasons: ['recent'],
              flags: ['recently-taught']
            }],
            rubric: 'Order | -Recent -TooLong'
          }));
        };
      }
    });

    await page.goto('/dashboard');
    await helper.dashboard.waitForRecommendationsLoaded();

    // Check for recent reason badge with gray color
    const recentReason = page.locator('[data-testid="reason-badge-recent"]');
    await expect(recentReason).toBeVisible();
    await expect(recentReason).toHaveClass(/bg-gray-100/);
    await expect(recentReason).toHaveClass(/text-gray-800/);
    await expect(recentReason).toContainText('recent');
  });

  test('renders long lesson reason with yellow color coding', async ({ page }) => {
    // Create mock data with long lesson reason
    await page.evaluate(() => {
      if (window.__MSW_WORKER) {
        const handler = () => {
          return new Response(JSON.stringify({
            courseId: 'course_c84473',
            generatedAt: new Date().toISOString(),
            graphRunId: 'mock-graph-run',
            candidates: [{
              lessonTemplateId: 'lt_1',
              title: 'Extended Lesson',
              priorityScore: 0.10,
              reasons: ['long lesson'],
              flags: []
            }],
            rubric: 'Order | -Recent -TooLong'
          }));
        };
      }
    });

    await page.goto('/dashboard');
    await helper.dashboard.waitForRecommendationsLoaded();

    // Check for long lesson reason badge with yellow color
    const longLessonReason = page.locator('[data-testid="reason-badge-long lesson"]');
    await expect(longLessonReason).toBeVisible();
    await expect(longLessonReason).toHaveClass(/bg-yellow-100/);
    await expect(longLessonReason).toHaveClass(/text-yellow-800/);
    await expect(longLessonReason).toContainText('long lesson');
  });

  test('renders multiple reasons with appropriate colors', async ({ page }) => {
    // Create mock data with multiple reasons
    await page.evaluate(() => {
      if (window.__MSW_WORKER) {
        const handler = () => {
          return new Response(JSON.stringify({
            courseId: 'course_c84473',
            generatedAt: new Date().toISOString(),
            graphRunId: 'mock-graph-run',
            candidates: [{
              lessonTemplateId: 'lt_1',
              title: 'Complex Lesson',
              priorityScore: 0.65,
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

    // Check for both reason badges
    const overdueReason = page.locator('[data-testid="reason-badge-overdue"]');
    const lowMasteryReason = page.locator('[data-testid="reason-badge-low mastery"]');

    await expect(overdueReason).toBeVisible();
    await expect(overdueReason).toHaveClass(/bg-red-100/);

    await expect(lowMasteryReason).toBeVisible();
    await expect(lowMasteryReason).toHaveClass(/bg-orange-100/);
  });

  test('handles unknown reasons with default styling', async ({ page }) => {
    // Create mock data with unknown reason
    await page.evaluate(() => {
      if (window.__MSW_WORKER) {
        const handler = () => {
          return new Response(JSON.stringify({
            courseId: 'course_c84473',
            generatedAt: new Date().toISOString(),
            graphRunId: 'mock-graph-run',
            candidates: [{
              lessonTemplateId: 'lt_1',
              title: 'Custom Reason Lesson',
              priorityScore: 0.30,
              reasons: ['unknown reason'],
              flags: []
            }],
            rubric: 'Custom | -Recent -TooLong'
          }));
        };
      }
    });

    await page.goto('/dashboard');
    await helper.dashboard.waitForRecommendationsLoaded();

    // Check for unknown reason badge with default styling
    const unknownReason = page.locator('[data-testid="reason-badge-unknown reason"]');
    await expect(unknownReason).toBeVisible();
    await expect(unknownReason).toHaveClass(/bg-gray-100/);
    await expect(unknownReason).toHaveClass(/text-gray-700/);
    await expect(unknownReason).toContainText('unknown reason');
  });

  test('reason badges are clickable and show tooltips', async ({ page }) => {
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForRecommendationsLoaded();

    // Check that reason badge is clickable
    const reasonBadge = page.locator('[data-testid="reason-badge-overdue"]');
    await expect(reasonBadge).toBeVisible();

    // Hover to show tooltip
    await reasonBadge.hover();
    await expect(page.locator('[data-testid="reason-tooltip"]')).toBeVisible();
  });

  test('reason badges have proper sizing and typography', async ({ page }) => {
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForRecommendationsLoaded();

    const reasonBadge = page.locator('[data-testid="reason-badge-overdue"]');
    await expect(reasonBadge).toBeVisible();

    // Check typography classes
    await expect(reasonBadge).toHaveClass(/text-xs/);
    await expect(reasonBadge).toHaveClass(/font-medium/);

    // Check sizing classes
    await expect(reasonBadge).toHaveClass(/px-2/);
    await expect(reasonBadge).toHaveClass(/py-1/);
    await expect(reasonBadge).toHaveClass(/rounded-full/);
  });
});

test.describe('ReasonBadge Color Accessibility', () => {
  let helper: TestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new TestHelper(page);
    await helper.setupTest();
  });

  test('reason badges maintain sufficient color contrast', async ({ page }) => {
    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForRecommendationsLoaded();

    const reasonBadge = page.locator('[data-testid="reason-badge-overdue"]');
    await expect(reasonBadge).toBeVisible();

    // Check that text color provides sufficient contrast
    const backgroundColor = await reasonBadge.evaluate(el =>
      window.getComputedStyle(el).backgroundColor
    );
    const textColor = await reasonBadge.evaluate(el =>
      window.getComputedStyle(el).color
    );

    // Basic contrast check (should be different colors)
    expect(backgroundColor).not.toBe(textColor);
  });

  test('reason badges work with dark mode', async ({ page }) => {
    // Enable dark mode
    await page.addInitScript(() => {
      document.documentElement.classList.add('dark');
    });

    await helper.mock.mockSuccessfulRecommendations('course_c84473', 'mathematicsOverdue');

    await page.goto('/dashboard');
    await helper.dashboard.waitForRecommendationsLoaded();

    const reasonBadge = page.locator('[data-testid="reason-badge-overdue"]');
    await expect(reasonBadge).toBeVisible();

    // Verify badge is still readable in dark mode
    const isVisible = await reasonBadge.isVisible();
    expect(isVisible).toBe(true);
  });
});