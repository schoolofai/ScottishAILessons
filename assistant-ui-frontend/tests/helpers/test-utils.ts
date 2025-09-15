import { Page, expect } from '@playwright/test';
import { worker } from '../setup';
import { testStudents, testSchedulingContexts, testErrorScenarios } from '../fixtures/seed-data';

// Authentication helpers
export class AuthHelper {
  constructor(private page: Page) {}

  async loginAsTestUser() {
    await this.page.goto('/login');
    await this.page.fill('[data-testid="email"]', 'test@scottishailessons.com');
    await this.page.fill('[data-testid="password"]', 'red12345');
    await this.page.click('[data-testid="login-button"]');
    await expect(this.page).toHaveURL('/dashboard');
  }

  async loginAsUser(email: string, password: string) {
    await this.page.goto('/login');
    await this.page.fill('[data-testid="email"]', email);
    await this.page.fill('[data-testid="password"]', password);
    await this.page.click('[data-testid="login-button"]');
  }

  async logout() {
    await this.page.click('[data-testid="user-menu"]');
    await this.page.click('[data-testid="logout-button"]');
    await expect(this.page).toHaveURL('/login');
  }
}

// Dashboard navigation helpers
export class DashboardHelper {
  constructor(private page: Page) {}

  async navigateToCourse(courseSubject: 'mathematics' | 'physics' | 'english') {
    const courseTabId = `course-tab-${courseSubject}`;
    await this.page.click(`[data-testid="${courseTabId}"]`);

    // Wait for course context to load
    await expect(this.page.locator(`[data-testid="${courseTabId}"]`))
      .toHaveAttribute('aria-selected', 'true');
  }

  async waitForRecommendationsLoaded() {
    await expect(this.page.locator('[data-testid="recommendations-section"]'))
      .toBeVisible({ timeout: 10000 });
    await expect(this.page.locator('[data-testid="recommendations-loading"]'))
      .not.toBeVisible();
  }

  async waitForRecommendationsError() {
    await expect(this.page.locator('[data-testid="recommendations-error"]'))
      .toBeVisible({ timeout: 5000 });
  }

  async getTopPickTitle(): Promise<string> {
    return await this.page.locator('[data-testid="top-pick-title"]').textContent() || '';
  }

  async getPriorityScore(): Promise<string> {
    return await this.page.locator('[data-testid="priority-score"]').textContent() || '';
  }

  async getCandidateCount(): Promise<number> {
    return await this.page.locator('[data-testid^="candidate-card-"]').count();
  }

  async startTopPickLesson() {
    await this.page.click('[data-testid="top-pick-start-button"]');
  }
}

// MSW mock helpers
export class MockHelper {
  constructor(private page: Page) {}

  async setupMSW() {
    // Initialize MSW in the browser context
    await this.page.addInitScript(() => {
      if (typeof window !== 'undefined') {
        // Set up MSW worker reference
        import('/tests/setup.js').then((module) => {
          if (module.worker) {
            window.__MSW_WORKER = module.worker;
            window.__MSW_CAPTURED_REQUESTS = [];
            window.__MSW_REQUEST_COUNT = 0;
          }
        });
      }
    });
  }

  async mockSuccessfulRecommendations(courseId: string, contextKey: keyof typeof testSchedulingContexts) {
    const context = testSchedulingContexts[contextKey];

    await this.page.evaluate(([courseId, context]) => {
      if (window.__MSW_WORKER) {
        // Mock successful response
        const handler = (req: any) => {
          if (req.url.includes(courseId)) {
            return new Response(JSON.stringify({
              courseId: context.course.courseId,
              generatedAt: new Date().toISOString(),
              graphRunId: `mock-${courseId}-${Date.now()}`,
              candidates: context.templates.slice(0, 3).map((template, index) => ({
                lessonTemplateId: template.$id,
                title: template.title,
                targetOutcomeIds: template.outcomeRefs,
                estimatedMinutes: template.estMinutes,
                priorityScore: 0.8 - (index * 0.1),
                reasons: ['mocked'],
                flags: []
              })),
              rubric: 'Overdue>LowEMA>Order | -Recent -TooLong'
            }));
          }
        };
        // Note: This is a simplified mock - actual MSW integration would be more complex
      }
    }, [courseId, context]);
  }

  async mockAPIError(status: number, path?: string) {
    const errorData = Object.values(testErrorScenarios).find(e => e.status === status);

    await this.page.evaluate(([status, errorData, path]) => {
      if (window.__MSW_WORKER) {
        // Mock error response
        const handler = (req: any) => {
          if (!path || req.url.includes(path)) {
            return new Response(JSON.stringify(errorData), {
              status,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        };
        // Note: Simplified mock - actual implementation would use MSW's http.get/post
      }
    }, [status, errorData, path]);
  }

  async mockDelay(delayMs: number, path?: string) {
    await this.page.evaluate(([delayMs, path]) => {
      if (window.__MSW_WORKER) {
        // Mock delayed response
        const handler = async (req: any) => {
          if (!path || req.url.includes(path)) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
            return new Response(JSON.stringify({
              courseId: 'delayed-response',
              candidates: [],
              rubric: 'Delayed'
            }));
          }
        };
        // Note: Simplified mock
      }
    }, [delayMs, path]);
  }

  async getCapturedRequests(): Promise<Array<{url: string, method: string, headers: Record<string, string>}>> {
    return await this.page.evaluate(() => {
      return window.__MSW_CAPTURED_REQUESTS || [];
    });
  }

  async getRequestCount(): Promise<number> {
    return await this.page.evaluate(() => {
      return window.__MSW_REQUEST_COUNT || 0;
    });
  }

  async resetRequestTracking() {
    await this.page.evaluate(() => {
      if (window.__MSW_WORKER) {
        window.__MSW_CAPTURED_REQUESTS = [];
        window.__MSW_REQUEST_COUNT = 0;
      }
    });
  }
}

// Test assertion helpers
export class AssertionHelper {
  constructor(private page: Page) {}

  async expectRecommendationsVisible() {
    await expect(this.page.locator('[data-testid="recommendations-section"]')).toBeVisible();
  }

  async expectTopPickVisible() {
    await expect(this.page.locator('[data-testid="top-pick-card"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="top-pick-badge"]')).toContainText('Top Pick');
  }

  async expectCandidateCount(expectedCount: number) {
    await expect(this.page.locator('[data-testid^="candidate-card-"]')).toHaveCount(expectedCount);
  }

  async expectReasonBadge(reason: string, color: string) {
    const badge = this.page.locator(`[data-testid="reason-badge-${reason}"]`);
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(new RegExp(color));
  }

  async expectErrorState(message?: string) {
    await expect(this.page.locator('[data-testid="recommendations-error"]')).toBeVisible();
    if (message) {
      await expect(this.page.locator('[data-testid="recommendations-error"]')).toContainText(message);
    }
  }

  async expectLoadingState() {
    await expect(this.page.locator('[data-testid="recommendations-loading"]')).toBeVisible();
  }

  async expectNoFallbackContent() {
    await expect(this.page.locator('[data-testid="fallback-recommendations"]')).not.toBeVisible();
    await expect(this.page.locator('[data-testid="placeholder-candidates"]')).not.toBeVisible();
  }

  async expectSessionRedirect(sessionIdPattern?: RegExp) {
    const urlPattern = sessionIdPattern || /\/session\/[a-zA-Z0-9-]+/;
    await expect(this.page).toHaveURL(urlPattern);
  }

  async expectCourseTabActive(courseSubject: string) {
    const courseTab = this.page.locator(`[data-testid="course-tab-${courseSubject}"]`);
    await expect(courseTab).toHaveAttribute('aria-selected', 'true');
    await expect(courseTab).toHaveClass(/border-blue-500/);
    await expect(courseTab).toHaveClass(/text-blue-600/);
  }
}

// Combined test helper class
export class TestHelper {
  public auth: AuthHelper;
  public dashboard: DashboardHelper;
  public mock: MockHelper;
  public assert: AssertionHelper;

  constructor(private page: Page) {
    this.auth = new AuthHelper(page);
    this.dashboard = new DashboardHelper(page);
    this.mock = new MockHelper(page);
    this.assert = new AssertionHelper(page);
  }

  async setupTest() {
    await this.mock.setupMSW();
    await this.auth.loginAsTestUser();
  }

  async cleanupTest() {
    await this.mock.resetRequestTracking();
  }
}

// Test scenario builders
export const buildTestScenario = {
  overdueLesson: (courseSubject: 'mathematics' | 'physics' | 'english') => ({
    context: testSchedulingContexts[`${courseSubject}Overdue`] || testSchedulingContexts.mathematicsOverdue,
    expectedTopReason: 'overdue',
    expectedScoreRange: [0.4, 0.8]
  }),

  lowMasteryLesson: (courseSubject: 'mathematics' | 'physics' | 'english') => ({
    context: testSchedulingContexts[`${courseSubject}Current`] || testSchedulingContexts.physicsCurrent,
    expectedTopReason: 'low mastery',
    expectedScoreRange: [0.2, 0.6]
  }),

  normalProgression: (courseSubject: 'mathematics' | 'physics' | 'english') => ({
    context: testSchedulingContexts[`${courseSubject}Advanced`] || testSchedulingContexts.englishAdvanced,
    expectedTopReason: 'early order',
    expectedScoreRange: [0.1, 0.3]
  })
};

// Data validation helpers
export const validateRecommendationResponse = (response: any) => {
  const required = ['courseId', 'generatedAt', 'graphRunId', 'candidates', 'rubric'];
  for (const field of required) {
    if (!(field in response)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (!Array.isArray(response.candidates)) {
    throw new Error('Candidates must be an array');
  }

  for (const candidate of response.candidates) {
    const candidateRequired = ['lessonTemplateId', 'title', 'targetOutcomeIds', 'priorityScore', 'reasons'];
    for (const field of candidateRequired) {
      if (!(field in candidate)) {
        throw new Error(`Missing required candidate field: ${field}`);
      }
    }
  }
};

export const validateSessionResponse = (response: any) => {
  const required = ['sessionId', 'threadId', 'lessonTemplateId', 'status', 'createdAt'];
  for (const field of required) {
    if (!(field in response)) {
      throw new Error(`Missing required session field: ${field}`);
    }
  }
};