import { test, expect } from '@playwright/test';

/**
 * GET /api/courses - API Contract Tests (RED PHASE)
 *
 * Tests the course listing endpoint that returns courses the authenticated
 * student is enrolled in. This endpoint enables multi-course dashboard
 * navigation and course selection for recommendations.
 *
 * Expected Response Format:
 * {
 *   courses: [
 *     {
 *       $id: string,
 *       courseId: string, // Format: "C844 73"
 *       subject: string,
 *       level: string,
 *       status: "active" | "inactive" | "archived"
 *     }
 *   ]
 * }
 */

const BASE_URL = 'http://localhost:3000';

test.describe('GET /api/courses - API Contract Tests (RED)', () => {

  test.describe('Authentication Contract', () => {
    test('should fail: require valid session cookie', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/courses`);

      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('statusCode', 401);
      expect(body.error).toContain('Authentication required');
    });

    test('should fail: reject invalid session cookies', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/courses`, {
        headers: {
          'Cookie': 'session=invalid-session-token'
        }
      });

      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('statusCode', 401);
    });

    test('should succeed: accept valid session cookie', async ({ request }) => {
      // First authenticate to get valid session
      const authResponse = await request.post(`${BASE_URL}/api/auth/sessions/start`, {
        data: {
          email: 'test@scottishailessons.com',
          password: 'red12345'
        }
      });

      expect(authResponse.status()).toBe(200);

      // Extract session cookie
      const cookies = authResponse.headers()['set-cookie'];
      expect(cookies).toBeDefined();

      // Use session to access courses
      const response = await request.get(`${BASE_URL}/api/courses`, {
        headers: {
          'Cookie': cookies
        }
      });

      expect(response.status()).toBe(200);
    });
  });

  test.describe('Success Response Contract', () => {
    test('should return enrolled courses for authenticated student', async ({ request }) => {
      // Authenticate first
      const authResponse = await request.post(`${BASE_URL}/api/auth/sessions/start`, {
        data: {
          email: 'test@scottishailessons.com',
          password: 'red12345'
        }
      });

      const cookies = authResponse.headers()['set-cookie'];

      const response = await request.get(`${BASE_URL}/api/courses`, {
        headers: {
          'Cookie': cookies
        }
      });

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('courses');
      expect(Array.isArray(body.courses)).toBe(true);
      expect(body.courses.length).toBeGreaterThan(0);
    });

    test('should return courses with correct schema format', async ({ request }) => {
      // Authenticate first
      const authResponse = await request.post(`${BASE_URL}/api/auth/sessions/start`, {
        data: {
          email: 'test@scottishailessons.com',
          password: 'red12345'
        }
      });

      const cookies = authResponse.headers()['set-cookie'];

      const response = await request.get(`${BASE_URL}/api/courses`, {
        headers: {
          'Cookie': cookies
        }
      });

      const body = await response.json();
      expect(body.courses.length).toBeGreaterThan(0);

      // Validate first course schema
      const course = body.courses[0];
      expect(course).toHaveProperty('$id');
      expect(course).toHaveProperty('courseId');
      expect(course).toHaveProperty('subject');
      expect(course).toHaveProperty('level');
      expect(course).toHaveProperty('status');

      // Validate courseId format (e.g., "C844 73")
      expect(course.courseId).toMatch(/^[A-Z]\d{3}\s\d{2}$/);

      // Validate status enum
      expect(['active', 'inactive', 'archived']).toContain(course.status);

      // Validate types
      expect(typeof course.$id).toBe('string');
      expect(typeof course.courseId).toBe('string');
      expect(typeof course.subject).toBe('string');
      expect(typeof course.level).toBe('string');
      expect(typeof course.status).toBe('string');
    });
  });

  test.describe('Student Profile Integration', () => {
    test('should fail: return error for student without profile', async ({ request }) => {
      // Authenticate with user who has no student profile
      const authResponse = await request.post(`${BASE_URL}/api/auth/sessions/start`, {
        data: {
          email: 'no-student@scottishailessons.com',
          password: 'red12345'
        }
      });

      const cookies = authResponse.headers()['set-cookie'];

      const response = await request.get(`${BASE_URL}/api/courses`, {
        headers: {
          'Cookie': cookies
        }
      });

      expect(response.status()).toBe(404);

      const body = await response.json();
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('statusCode', 404);
      expect(body.error).toContain('Student profile not found');
    });

    test('should return empty array for student with no enrollments', async ({ request }) => {
      // Authenticate with student who has no course enrollments
      const authResponse = await request.post(`${BASE_URL}/api/auth/sessions/start`, {
        data: {
          email: 'no-courses@scottishailessons.com',
          password: 'red12345'
        }
      });

      const cookies = authResponse.headers()['set-cookie'];

      const response = await request.get(`${BASE_URL}/api/courses`, {
        headers: {
          'Cookie': cookies
        }
      });

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('courses');
      expect(Array.isArray(body.courses)).toBe(true);
      expect(body.courses.length).toBe(0);
    });
  });

  test.describe('Error Handling Contract', () => {
    test('should fail: handle service unavailable gracefully', async ({ request }) => {
      // Authenticate with special email that triggers service error
      const authResponse = await request.post(`${BASE_URL}/api/auth/sessions/start`, {
        data: {
          email: 'service-error@scottishailessons.com',
          password: 'red12345'
        }
      });

      const cookies = authResponse.headers()['set-cookie'];

      const response = await request.get(`${BASE_URL}/api/courses`, {
        headers: {
          'Cookie': cookies
        }
      });

      expect(response.status()).toBe(500);

      const body = await response.json();
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('statusCode', 500);
    });

    test('should fail: handle database timeout gracefully', async ({ request }) => {
      // Authenticate with special email that triggers timeout
      const authResponse = await request.post(`${BASE_URL}/api/auth/sessions/start`, {
        data: {
          email: 'timeout@scottishailessons.com',
          password: 'red12345'
        }
      });

      const cookies = authResponse.headers()['set-cookie'];

      const response = await request.get(`${BASE_URL}/api/courses`, {
        headers: {
          'Cookie': cookies
        }
      });

      expect(response.status()).toBe(500);

      const body = await response.json();
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('statusCode', 500);
      expect(body.error).toContain('timeout');
    });
  });

  test.describe('HTTP Headers Contract', () => {
    test('should include proper cache control headers', async ({ request }) => {
      // Authenticate first
      const authResponse = await request.post(`${BASE_URL}/api/auth/sessions/start`, {
        data: {
          email: 'test@scottishailessons.com',
          password: 'red12345'
        }
      });

      const cookies = authResponse.headers()['set-cookie'];

      const response = await request.get(`${BASE_URL}/api/courses`, {
        headers: {
          'Cookie': cookies
        }
      });

      // Verify cache control headers for security
      const cacheControl = response.headers()['cache-control'];
      expect(cacheControl).toBeDefined();
      expect(cacheControl.toLowerCase()).toContain('no-cache');
    });

    test('should return JSON content type', async ({ request }) => {
      // Authenticate first
      const authResponse = await request.post(`${BASE_URL}/api/auth/sessions/start`, {
        data: {
          email: 'test@scottishailessons.com',
          password: 'red12345'
        }
      });

      const cookies = authResponse.headers()['set-cookie'];

      const response = await request.get(`${BASE_URL}/api/courses`, {
        headers: {
          'Cookie': cookies
        }
      });

      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('application/json');
    });
  });

  test.describe('Performance Contract', () => {
    test('should respond within 3 seconds', async ({ request }) => {
      // Authenticate first
      const authResponse = await request.post(`${BASE_URL}/api/auth/sessions/start`, {
        data: {
          email: 'test@scottishailessons.com',
          password: 'red12345'
        }
      });

      const cookies = authResponse.headers()['set-cookie'];

      const startTime = Date.now();

      const response = await request.get(`${BASE_URL}/api/courses`, {
        headers: {
          'Cookie': cookies
        }
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status()).toBe(200);
      expect(responseTime).toBeLessThan(3000); // 3 seconds
    });
  });

  test.describe('Data Integrity Contract', () => {
    test('should return consistent course data on multiple requests', async ({ request }) => {
      // Authenticate first
      const authResponse = await request.post(`${BASE_URL}/api/auth/sessions/start`, {
        data: {
          email: 'test@scottishailessons.com',
          password: 'red12345'
        }
      });

      const cookies = authResponse.headers()['set-cookie'];

      // Make first request
      const response1 = await request.get(`${BASE_URL}/api/courses`, {
        headers: {
          'Cookie': cookies
        }
      });

      const body1 = await response1.json();

      // Make second request
      const response2 = await request.get(`${BASE_URL}/api/courses`, {
        headers: {
          'Cookie': cookies
        }
      });

      const body2 = await response2.json();

      // Both requests should return identical data
      expect(body1).toEqual(body2);
      expect(body1.courses.length).toBe(body2.courses.length);

      if (body1.courses.length > 0) {
        expect(body1.courses[0].$id).toBe(body2.courses[0].$id);
        expect(body1.courses[0].courseId).toBe(body2.courses[0].courseId);
      }
    });

    test('should only return courses where student is enrolled', async ({ request }) => {
      // Authenticate first
      const authResponse = await request.post(`${BASE_URL}/api/auth/sessions/start`, {
        data: {
          email: 'test@scottishailessons.com',
          password: 'red12345'
        }
      });

      const cookies = authResponse.headers()['set-cookie'];

      const response = await request.get(`${BASE_URL}/api/courses`, {
        headers: {
          'Cookie': cookies
        }
      });

      const body = await response.json();

      // All returned courses should be valid enrollments
      for (const course of body.courses) {
        expect(course.status).toBe('active'); // Only active courses for enrolled students
        expect(course.$id).toBeDefined();
        expect(course.courseId).toBeDefined();
        expect(course.subject).toBeDefined();
        expect(course.level).toBeDefined();
      }
    });
  });
});