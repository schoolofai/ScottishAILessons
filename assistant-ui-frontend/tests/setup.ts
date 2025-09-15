import { setupWorker } from 'msw/browser';
import { http, HttpResponse } from 'msw';
import type { CourseRecommendation } from '../types/course-planner';

// Mock data for testing
const mockRecommendations: Record<string, CourseRecommendation> = {
  'course-math-123': {
    courseId: 'C844 73',
    generatedAt: new Date().toISOString(),
    graphRunId: 'mocked-run-id-123',
    candidates: [
      {
        lessonTemplateId: 'template-fractions-123',
        title: 'Mocked Fractions Lesson',
        targetOutcomeIds: ['AOM3.1', 'AOM3.2'],
        estimatedMinutes: 45,
        priorityScore: 0.65,
        reasons: ['overdue', 'low mastery'],
        flags: []
      },
      {
        lessonTemplateId: 'template-area-456',
        title: 'Mocked Area Lesson',
        targetOutcomeIds: ['AOM3.3'],
        estimatedMinutes: 30,
        priorityScore: 0.40,
        reasons: ['early order'],
        flags: []
      }
    ],
    rubric: 'Overdue>LowEMA>Order | -Recent -TooLong'
  },
  'course-physics-456': {
    courseId: 'C845 73',
    generatedAt: new Date().toISOString(),
    graphRunId: 'mocked-run-id-456',
    candidates: [
      {
        lessonTemplateId: 'template-forces-123',
        title: 'Mocked Forces Lesson',
        targetOutcomeIds: ['PHY3.1'],
        estimatedMinutes: 50,
        priorityScore: 0.70,
        reasons: ['overdue'],
        flags: []
      }
    ],
    rubric: 'Overdue>LowEMA>Order | -Recent -TooLong'
  },
  'course-english-789': {
    courseId: 'C846 73',
    generatedAt: new Date().toISOString(),
    graphRunId: 'mocked-run-id-789',
    candidates: [
      {
        lessonTemplateId: 'template-writing-123',
        title: 'Mocked Writing Lesson',
        targetOutcomeIds: ['ENG3.1'],
        estimatedMinutes: 40,
        priorityScore: 0.55,
        reasons: ['low mastery'],
        flags: []
      }
    ],
    rubric: 'Overdue>LowEMA>Order | -Recent -TooLong'
  }
};

// Request tracking for testing
declare global {
  interface Window {
    __MSW_WORKER?: ReturnType<typeof setupWorker>;
    __MSW_CAPTURED_REQUESTS?: Array<{
      url: string;
      method: string;
      headers: Record<string, string>;
      body?: any;
    }>;
    __MSW_REQUEST_COUNT?: number;
  }
}

// MSW handlers
const handlers = [
  // GET /api/recommendations/[courseId] - Success scenarios
  http.get('/api/recommendations/:courseId', async ({ request, params }) => {
    const courseId = params.courseId as string;
    const url = new URL(request.url);

    // Track requests for testing
    if (typeof window !== 'undefined') {
      window.__MSW_CAPTURED_REQUESTS = window.__MSW_CAPTURED_REQUESTS || [];
      window.__MSW_REQUEST_COUNT = (window.__MSW_REQUEST_COUNT || 0) + 1;

      window.__MSW_CAPTURED_REQUESTS.push({
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries()),
      });
    }

    // Check for error scenarios
    if (url.searchParams.get('forceError') === '500') {
      return new HttpResponse(null, {
        status: 500,
        statusText: 'Internal Server Error'
      });
    }

    if (url.searchParams.get('forceError') === '401') {
      return new HttpResponse(null, {
        status: 401,
        statusText: 'Unauthorized'
      });
    }

    // Handle delays for loading state testing
    const delay = url.searchParams.get('delay');
    if (delay) {
      await new Promise(resolve => setTimeout(resolve, parseInt(delay, 10)));
    }

    // Find matching mock data
    const mockData = Object.values(mockRecommendations).find(
      rec => courseId.includes(rec.courseId.replace(' ', '-').toLowerCase())
    );

    if (!mockData) {
      return new HttpResponse(
        JSON.stringify({ error: 'Course not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return HttpResponse.json(mockData);
  }),

  // POST /api/sessions/start - Session creation
  http.post('/api/sessions/start', async ({ request }) => {
    const body = await request.json();

    // Track requests
    if (typeof window !== 'undefined') {
      window.__MSW_CAPTURED_REQUESTS = window.__MSW_CAPTURED_REQUESTS || [];
      window.__MSW_CAPTURED_REQUESTS.push({
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries()),
        body
      });
    }

    // Mock session creation response
    return HttpResponse.json({
      sessionId: 'mocked-session-id-123',
      threadId: 'mocked-thread-id-123',
      lessonTemplateId: body.lessonTemplateId,
      status: 'created',
      createdAt: new Date().toISOString()
    });
  }),

  // Catch-all for unhandled API routes
  http.all('/api/*', ({ request }) => {
    console.warn(`MSW: Unhandled API request: ${request.method} ${request.url}`);
    return new HttpResponse(
      JSON.stringify({ error: 'API endpoint not mocked' }),
      {
        status: 501,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  })
];

// Create and export worker
export const worker = setupWorker(...handlers);

// Setup function for tests
export const setupMSW = () => {
  if (typeof window !== 'undefined') {
    window.__MSW_WORKER = worker;
    window.__MSW_CAPTURED_REQUESTS = [];
    window.__MSW_REQUEST_COUNT = 0;
  }
};

// Helper functions for tests
export const mockError = (status: number, path?: string) => {
  const errorHandler = http.get(path || '/api/recommendations/*', () => {
    return new HttpResponse(null, { status });
  });

  if (typeof window !== 'undefined' && window.__MSW_WORKER) {
    window.__MSW_WORKER.use(errorHandler);
  }
};

export const mockDelay = (delayMs: number, path?: string) => {
  const delayHandler = http.get(path || '/api/recommendations/*', async () => {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    return HttpResponse.json(mockRecommendations['course-math-123']);
  });

  if (typeof window !== 'undefined' && window.__MSW_WORKER) {
    window.__MSW_WORKER.use(delayHandler);
  }
};

export const getCapturedRequests = () => {
  if (typeof window !== 'undefined') {
    return window.__MSW_CAPTURED_REQUESTS || [];
  }
  return [];
};

export const getRequestCount = () => {
  if (typeof window !== 'undefined') {
    return window.__MSW_REQUEST_COUNT || 0;
  }
  return 0;
};

// Auto-setup in browser environment
if (typeof window !== 'undefined') {
  setupMSW();
}