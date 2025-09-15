/*
API Contract Tests for GET /api/recommendations/[courseId]
These tests follow TDD Red-Green-Refactor methodology for API contract validation.
Using Playwright test framework for API testing.
*/

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

test.describe('GET /api/recommendations/[courseId] - API Contract Tests (RED)', () => {

  test.describe('Authentication & Authorization Contract', () => {
    test('should fail: require valid session cookie', async ({ request }) => {
      // ARRANGE: Request without session cookie

      // ACT: Call recommendations endpoint without authentication
      const response = await request.get(`${BASE_URL}/api/recommendations/${encodeURIComponent('C844 73')}`);

      // ASSERT: Should return 401 Unauthorized
      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Authentication required',
        statusCode: 401
      });
    });

    test('should fail: reject invalid session cookies', async ({ request }) => {
      // ARRANGE: Request with invalid session cookie
      const cookies = [
        { name: 'session', value: 'invalid-session-token', domain: 'localhost', path: '/' }
      ];

      // ACT: Call endpoint with invalid session
      const response = await request.get(`${BASE_URL}/api/recommendations/${encodeURIComponent('C844 73')}`, {
        headers: { 'Cookie': cookies.map(c => `${c.name}=${c.value}`).join('; ') }
      });

      // ASSERT: Should return 401 Unauthorized
      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body).toMatchObject({
        error: 'User not found',
        statusCode: 401
      });
    });

    test('should fail: enforce course enrollment verification', async ({ request }) => {
      // ARRANGE: Valid session but not enrolled in requested course
      // This test will fail until proper enrollment verification is implemented

      const validSessionCookie = 'mock-valid-session-token';
      const cookies = [
        { name: 'session', value: validSessionCookie, domain: 'localhost', path: '/' }
      ];

      // ACT: Request recommendations for non-enrolled course
      const response = await request.get(`${BASE_URL}/api/recommendations/${encodeURIComponent('C999 88')}`, {
        headers: { 'Cookie': cookies.map(c => `${c.name}=${c.value}`).join('; ') }
      });

      // ASSERT: Should return 403 Forbidden
      expect(response.status()).toBe(403);

      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Not enrolled in this course',
        statusCode: 403
      });
    });
  });

  test.describe('Request Validation Contract', () => {
    test('should fail: validate courseId parameter format', async ({ request }) => {
      // ARRANGE: Invalid courseId formats (excluding empty string which routes to /api/recommendations/)
      const invalidCourseIds = [
        'invalid-format', // wrong format
        'C999', // incomplete
        'INVALID 123', // spaces not allowed
        'c844 73' // lowercase not allowed
      ];

      const validSessionCookie = 'mock-valid-session-token';
      const cookies = [
        { name: 'session', value: validSessionCookie, domain: 'localhost', path: '/' }
      ];

      // ACT & ASSERT: Test each invalid courseId
      for (const courseId of invalidCourseIds) {
        const response = await request.get(`${BASE_URL}/api/recommendations/${courseId}`, {
          headers: { 'Cookie': cookies.map(c => `${c.name}=${c.value}`).join('; ') }
        });

        expect(response.status()).toBe(400);

        const body = await response.json();
        expect(body).toMatchObject({
          error: 'Invalid request parameters',
          statusCode: 400,
          details: expect.any(Array) // Zod error details
        });
      }
    });

    test('should fail: handle malformed request headers', async ({ request }) => {
      // ARRANGE: Malformed or missing required headers

      // ACT: Request with malformed Cookie header
      const response = await request.get(`${BASE_URL}/api/recommendations/${encodeURIComponent('C844 73')}`, {
        headers: {
          'Cookie': 'malformed-cookie-header-without-session'
        }
      });

      // ASSERT: Should return authentication error
      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.error).toContain('Authentication required');
    });
  });

  test.describe('Course Manager Integration Contract', () => {
    test('should fail: handle Course Manager service unavailability', async ({ request }) => {
      // ARRANGE: Valid session and enrollment, but Course Manager is down
      // This test will fail until proper error handling is implemented

      const validSessionCookie = 'mock-valid-session-for-math';
      const cookies = [
        { name: 'session', value: validSessionCookie, domain: 'localhost', path: '/' }
      ];

      // ACT: Request when Course Manager service is unavailable
      const response = await request.get(`${BASE_URL}/api/recommendations/${encodeURIComponent('C844 73')}`, {
        headers: { 'Cookie': cookies.map(c => `${c.name}=${c.value}`).join('; ') }
      });

      // ASSERT: Should return 500 with specific error message (not fallback data)
      expect(response.status()).toBe(500);

      const body = await response.json();
      expect(body).toMatchObject({
        error: expect.stringContaining('Course Manager'),
        statusCode: 500
      });

      // Verify zero fallback policy - no recommendation data should be present
      expect(body).not.toHaveProperty('lessons');
      expect(body).not.toHaveProperty('topPick');
      expect(body).not.toHaveProperty('reasoning');
    });

    test('should fail: handle Course Manager timeout scenarios', async ({ request }) => {
      // ARRANGE: Course Manager responds too slowly (>30s timeout)

      const validSessionCookie = 'mock-timeout-session';
      const cookies = [
        { name: 'session', value: validSessionCookie, domain: 'localhost', path: '/' }
      ];

      // ACT: Request that will timeout
      const response = await request.get(`${BASE_URL}/api/recommendations/${encodeURIComponent('C111 11')}`, {
        headers: { 'Cookie': cookies.map(c => `${c.name}=${c.value}`).join('; ') }
      });

      // ASSERT: Should return timeout error
      expect(response.status()).toBe(500);

      const body = await response.json();
      expect(body.error).toContain('timed out');
      expect(body.statusCode).toBe(500);
    });

    test('should fail: validate Course Manager response format', async ({ request }) => {
      // ARRANGE: Course Manager returns malformed response

      const validSessionCookie = 'mock-malformed-response-session';
      const cookies = [
        { name: 'session', value: validSessionCookie, domain: 'localhost', path: '/' }
      ];

      // ACT: Request that gets malformed Course Manager response
      const response = await request.get(`${BASE_URL}/api/recommendations/${encodeURIComponent('C222 22')}`, {
        headers: { 'Cookie': cookies.map(c => `${c.name}=${c.value}`).join('; ') }
      });

      // ASSERT: Should return validation error
      expect(response.status()).toBe(500);

      const body = await response.json();
      expect(body.error).toContain('did not return recommendations');
    });
  });

  test.describe('Success Response Contract', () => {
    test('should fail: return valid CourseRecommendation schema', async ({ request }) => {
      // ARRANGE: Valid session, enrollment, and working Course Manager
      // This test will fail until the full implementation is complete

      const validSessionCookie = 'mock-full-valid-session';
      const cookies = [
        { name: 'session', value: validSessionCookie, domain: 'localhost', path: '/' }
      ];

      // ACT: Request recommendations for enrolled course
      const response = await request.get(`${BASE_URL}/api/recommendations/${encodeURIComponent('C844 73')}`, {
        headers: { 'Cookie': cookies.map(c => `${c.name}=${c.value}`).join('; ') }
      });

      // ASSERT: Should return 200 with valid CourseRecommendation
      expect(response.status()).toBe(200);

      const body = await response.json();

      // Verify response matches CourseRecommendation schema
      expect(body).toMatchObject({
        topPick: {
          templateId: expect.any(String),
          title: expect.any(String),
          outcomeRefs: expect.any(Array),
          estMinutes: expect.any(Number),
          priority: expect.any(Number),
          reason: expect.stringMatching(/^(overdue|low_mastery|sow_order)$/)
        },
        otherCandidates: expect.any(Array),
        reasoning: {
          explanation: expect.any(String),
          factors: expect.any(Array),
          confidence: expect.any(Number)
        },
        graphRunId: expect.any(String),
        timestamp: expect.any(String)
      });

      // Verify priority scoring is valid (0-1 range)
      expect(body.topPick.priority).toBeGreaterThanOrEqual(0);
      expect(body.topPick.priority).toBeLessThanOrEqual(1);

      // Verify reasoning confidence is valid
      expect(body.reasoning.confidence).toBeGreaterThanOrEqual(0);
      expect(body.reasoning.confidence).toBeLessThanOrEqual(1);
    });

    test('should fail: include proper HTTP headers in success response', async ({ request }) => {
      // ARRANGE: Valid successful request scenario

      const validSessionCookie = 'mock-headers-test-session';
      const cookies = [
        { name: 'session', value: validSessionCookie, domain: 'localhost', path: '/' }
      ];

      // ACT: Make successful request
      const response = await request.get(`${BASE_URL}/api/recommendations/${encodeURIComponent('C844 73')}`, {
        headers: { 'Cookie': cookies.map(c => `${c.name}=${c.value}`).join('; ') }
      });

      // ASSERT: Verify proper response headers
      expect(response.headers()['content-type']).toContain('application/json');
      expect(response.headers()).toHaveProperty('cache-control'); // Should not be cached
      expect(response.headers()['cache-control']).toContain('no-cache');
    });
  });

  test.describe('Error Handling Contract', () => {
    test('should fail: maintain consistent error response format', async ({ request }) => {
      // ARRANGE: Various error scenarios
      const errorScenarios = [
        { path: `${BASE_URL}/api/recommendations/`, expectedStatus: 404 }, // missing courseId
        { path: `${BASE_URL}/api/recommendations/invalid`, expectedStatus: 400 }, // invalid courseId
      ];

      // ACT & ASSERT: Test each error scenario
      for (const scenario of errorScenarios) {
        const response = await request.get(scenario.path);

        expect(response.status()).toBe(scenario.expectedStatus);

        const body = await response.json();

        // Verify consistent error format
        expect(body).toMatchObject({
          error: expect.any(String),
          statusCode: expect.any(Number)
        });

        // Verify no data leakage in error responses
        expect(body).not.toHaveProperty('lessons');
        expect(body).not.toHaveProperty('topPick');
        expect(body).not.toHaveProperty('student');
        expect(body).not.toHaveProperty('internal');
      }
    });

    test('should fail: handle database connection failures', async ({ request }) => {
      // ARRANGE: Database connection failure scenario

      const validSessionCookie = 'mock-db-failure-session';
      const cookies = [
        { name: 'session', value: validSessionCookie, domain: 'localhost', path: '/' }
      ];

      // ACT: Request when database is unavailable
      const response = await request.get(`${BASE_URL}/api/recommendations/${encodeURIComponent('C333 33')}`, {
        headers: { 'Cookie': cookies.map(c => `${c.name}=${c.value}`).join('; ') }
      });

      // ASSERT: Should return appropriate database error
      expect(response.status()).toBe(500);

      const body = await response.json();
      expect(body.error).toBeTruthy();
      expect(body.statusCode).toBe(500);

      // Zero fallback policy - no placeholder data
      expect(body).not.toHaveProperty('topPick');
    });
  });

  test.describe('Performance & Resource Contract', () => {
    test('should fail: complete requests within acceptable timeframe', async ({ request }) => {
      // ARRANGE: Performance timing measurement

      const validSessionCookie = 'mock-performance-session';
      const cookies = [
        { name: 'session', value: validSessionCookie, domain: 'localhost', path: '/' }
      ];

      const startTime = Date.now();

      // ACT: Make request and measure response time
      const response = await request.get(`${BASE_URL}/api/recommendations/${encodeURIComponent('C844 73')}`, {
        headers: { 'Cookie': cookies.map(c => `${c.name}=${c.value}`).join('; ') }
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // ASSERT: Response time should be under 5 seconds (including LangGraph call)
      expect(responseTime).toBeLessThan(5000);

      // Response should complete (not timeout)
      expect(response.status()).not.toBe(408); // Request Timeout
      expect(response.status()).not.toBe(504); // Gateway Timeout
    });

    test('should fail: properly handle concurrent requests', async ({ request }) => {
      // ARRANGE: Multiple concurrent requests for same course

      const validSessionCookie = 'mock-concurrent-session';
      const cookies = [
        { name: 'session', value: validSessionCookie, domain: 'localhost', path: '/' }
      ];

      const requestOptions = {
        headers: { 'Cookie': cookies.map(c => `${c.name}=${c.value}`).join('; ') }
      };

      // ACT: Make 3 concurrent requests
      const promises = [
        request.get(`${BASE_URL}/api/recommendations/${encodeURIComponent('C844 73')}`, requestOptions),
        request.get(`${BASE_URL}/api/recommendations/${encodeURIComponent('C844 73')}`, requestOptions),
        request.get(`${BASE_URL}/api/recommendations/${encodeURIComponent('C844 73')}`, requestOptions)
      ];

      const responses = await Promise.all(promises);

      // ASSERT: All requests should complete successfully
      responses.forEach((response, index) => {
        expect(response.status()).toBeLessThan(500); // No server errors
      });

      // Verify consistent responses (same user, same course should get same recommendations)
      if (responses.every(r => r.status() === 200)) {
        const bodies = await Promise.all(responses.map(r => r.json()));

        // Top pick should be consistent across concurrent requests
        expect(bodies[0].topPick.templateId).toBe(bodies[1].topPick.templateId);
        expect(bodies[1].topPick.templateId).toBe(bodies[2].topPick.templateId);
      }
    });
  });
});