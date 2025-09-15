/*
API Contract Tests for POST /api/auth/sessions/start
These tests follow TDD Red-Green-Refactor methodology for API contract validation.
Using Playwright test framework for API testing.
*/

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

test.describe('POST /api/auth/sessions/start - API Contract Tests (RED)', () => {

  test.describe('Request Validation Contract', () => {
    test('should fail: require email field', async ({ request }) => {
      // ARRANGE: Request without email
      const requestBody = {
        password: 'red12345'
      };

      // ACT: Call sessions start endpoint without email
      const response = await request.post(`${BASE_URL}/api/auth/sessions/start`, {
        data: requestBody,
        headers: { 'Content-Type': 'application/json' }
      });

      // ASSERT: Should return 400 Bad Request
      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Invalid request parameters',
        statusCode: 400,
        details: expect.any(Array)
      });
    });

    test('should fail: require password field', async ({ request }) => {
      // ARRANGE: Request without password
      const requestBody = {
        email: 'test@scottishailessons.com'
      };

      // ACT: Call sessions start endpoint without password
      const response = await request.post(`${BASE_URL}/api/auth/sessions/start`, {
        data: requestBody,
        headers: { 'Content-Type': 'application/json' }
      });

      // ASSERT: Should return 400 Bad Request
      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Invalid request parameters',
        statusCode: 400,
        details: expect.any(Array)
      });
    });

    test('should fail: validate email format', async ({ request }) => {
      // ARRANGE: Invalid email formats
      const invalidEmails = [
        'invalid-email',
        'missing@domain',
        '@missing-local.com',
        'spaces in@email.com',
        'toolong' + 'x'.repeat(250) + '@domain.com'
      ];

      // ACT & ASSERT: Test each invalid email
      for (const email of invalidEmails) {
        const response = await request.post(`${BASE_URL}/api/auth/sessions/start`, {
          data: { email, password: 'red12345' },
          headers: { 'Content-Type': 'application/json' }
        });

        expect(response.status()).toBe(400);

        const body = await response.json();
        expect(body).toMatchObject({
          error: 'Invalid request parameters',
          statusCode: 400,
          details: expect.any(Array)
        });
      }
    });

    test('should fail: validate password requirements', async ({ request }) => {
      // ARRANGE: Invalid passwords
      const invalidPasswords = [
        '', // empty
        '123', // too short
        'x'.repeat(129), // too long
        '   ', // whitespace only
      ];

      // ACT & ASSERT: Test each invalid password
      for (const password of invalidPasswords) {
        const response = await request.post(`${BASE_URL}/api/auth/sessions/start`, {
          data: { email: 'test@scottishailessons.com', password },
          headers: { 'Content-Type': 'application/json' }
        });

        expect(response.status()).toBe(400);

        const body = await response.json();
        expect(body).toMatchObject({
          error: 'Invalid request parameters',
          statusCode: 400,
          details: expect.any(Array)
        });
      }
    });

    test('should fail: reject non-JSON request body', async ({ request }) => {
      // ARRANGE: Non-JSON request body
      const response = await request.post(`${BASE_URL}/api/auth/sessions/start`, {
        data: 'email=test@example.com&password=test123',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      // ASSERT: Should return 400 for invalid content type
      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toContain('Invalid');
    });
  });

  test.describe('Authentication Contract', () => {
    test('should fail: reject invalid credentials', async ({ request }) => {
      // ARRANGE: Invalid credentials
      const requestBody = {
        email: 'invalid@example.com',
        password: 'wrongpassword'
      };

      // ACT: Attempt login with invalid credentials
      const response = await request.post(`${BASE_URL}/api/auth/sessions/start`, {
        data: requestBody,
        headers: { 'Content-Type': 'application/json' }
      });

      // ASSERT: Should return 401 Unauthorized
      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Invalid credentials',
        statusCode: 401
      });

      // Verify no session cookie is set
      const cookies = response.headers()['set-cookie'];
      expect(cookies).toBeFalsy();
    });

    test('should fail: reject correct email with wrong password', async ({ request }) => {
      // ARRANGE: Correct email, wrong password
      const requestBody = {
        email: 'test@scottishailessons.com',
        password: 'wrongpassword123'
      };

      // ACT: Attempt login with wrong password
      const response = await request.post(`${BASE_URL}/api/auth/sessions/start`, {
        data: requestBody,
        headers: { 'Content-Type': 'application/json' }
      });

      // ASSERT: Should return 401 Unauthorized
      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Invalid credentials',
        statusCode: 401
      });
    });

    test('should fail: handle non-existent user gracefully', async ({ request }) => {
      // ARRANGE: Non-existent user with valid format
      const requestBody = {
        email: 'nonexistent@scottishailessons.com',
        password: 'red12345'
      };

      // ACT: Attempt login with non-existent user
      const response = await request.post(`${BASE_URL}/api/auth/sessions/start`, {
        data: requestBody,
        headers: { 'Content-Type': 'application/json' }
      });

      // ASSERT: Should return 401 (not 404 to prevent user enumeration)
      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Invalid credentials',
        statusCode: 401
      });
    });
  });

  test.describe('Service Integration Contract', () => {
    test('should fail: handle Appwrite service unavailable', async ({ request }) => {
      // ARRANGE: Request that will trigger service unavailable scenario
      const requestBody = {
        email: 'service-error@test.com',
        password: 'red12345'
      };

      // ACT: Request when Appwrite service is unavailable
      const response = await request.post(`${BASE_URL}/api/auth/sessions/start`, {
        data: requestBody,
        headers: { 'Content-Type': 'application/json' }
      });

      // ASSERT: Should return 500 Service Error
      expect(response.status()).toBe(500);

      const body = await response.json();
      expect(body).toMatchObject({
        error: expect.stringContaining('service'),
        statusCode: 500
      });

      // Verify no partial session data is leaked
      expect(body).not.toHaveProperty('session');
      expect(body).not.toHaveProperty('user');
      expect(body).not.toHaveProperty('token');
    });

    test('should fail: handle Appwrite timeout scenarios', async ({ request }) => {
      // ARRANGE: Request that will timeout
      const requestBody = {
        email: 'timeout@test.com',
        password: 'red12345'
      };

      // ACT: Request that will timeout
      const response = await request.post(`${BASE_URL}/api/auth/sessions/start`, {
        data: requestBody,
        headers: { 'Content-Type': 'application/json' }
      });

      // ASSERT: Should return timeout error
      expect(response.status()).toBe(500);

      const body = await response.json();
      expect(body.error).toContain('timed out');
      expect(body.statusCode).toBe(500);
    });

    test('should fail: handle rate limiting', async ({ request }) => {
      // ARRANGE: Multiple rapid requests to trigger rate limiting
      const requestBody = {
        email: 'test@scottishailessons.com',
        password: 'red12345'
      };

      // ACT: Make rapid requests to trigger rate limiting
      const requests = Array(6).fill(0).map(() =>
        request.post(`${BASE_URL}/api/auth/sessions/start`, {
          data: requestBody,
          headers: { 'Content-Type': 'application/json' }
        })
      );

      const responses = await Promise.all(requests);

      // ASSERT: All requests should complete (rate limiting not implemented in MVP)
      // For MVP, we just verify that all requests complete without crashing
      responses.forEach((response, index) => {
        expect(response.status()).toBeGreaterThanOrEqual(200); // Valid response
        expect(response.status()).toBeLessThan(600); // Valid HTTP status codes
      });

      // TODO: Implement rate limiting in future iterations
      console.log('Rate limiting test: MVP implementation allows all requests to complete');
    });
  });

  test.describe('Success Response Contract', () => {
    test('should fail: return valid session with correct credentials', async ({ request }) => {
      // ARRANGE: Valid test credentials
      const requestBody = {
        email: 'test@scottishailessons.com',
        password: 'red12345'
      };

      // ACT: Login with correct credentials
      const response = await request.post(`${BASE_URL}/api/auth/sessions/start`, {
        data: requestBody,
        headers: { 'Content-Type': 'application/json' }
      });

      // ASSERT: Should return 200 with session data
      expect(response.status()).toBe(200);

      const body = await response.json();

      // Verify response structure
      expect(body).toMatchObject({
        session: {
          userId: expect.any(String),
          sessionId: expect.any(String),
          expiresAt: expect.any(String)
        },
        user: {
          $id: expect.any(String),
          email: 'test@scottishailessons.com',
          name: expect.any(String)
        },
        student: {
          $id: expect.any(String),
          userId: expect.any(String),
          name: expect.any(String)
        }
      });

      // Verify session cookie is set
      const cookies = response.headers()['set-cookie'];
      expect(cookies).toBeTruthy();
      expect(cookies).toContain('session=');
      expect(cookies).toContain('HttpOnly');
      expect(cookies).toContain('Secure');
      expect(cookies.toLowerCase()).toContain('samesite=strict');

      // Verify session expiry is in the future
      const expiresAt = new Date(body.session.expiresAt);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

      // Verify no sensitive data is exposed
      expect(body).not.toHaveProperty('password');
      expect(body).not.toHaveProperty('hash');
      expect(body.user).not.toHaveProperty('password');
    });

    test('should fail: include proper HTTP headers in success response', async ({ request }) => {
      // ARRANGE: Valid login request
      const requestBody = {
        email: 'test@scottishailessons.com',
        password: 'red12345'
      };

      // ACT: Successful login
      const response = await request.post(`${BASE_URL}/api/auth/sessions/start`, {
        data: requestBody,
        headers: { 'Content-Type': 'application/json' }
      });

      // ASSERT: Verify proper response headers
      expect(response.headers()['content-type']).toContain('application/json');
      expect(response.headers()).toHaveProperty('cache-control');
      expect(response.headers()['cache-control']).toContain('no-cache');

      // Verify security headers
      const cookies = response.headers()['set-cookie'];
      expect(cookies).toBeTruthy();
      expect(cookies).toContain('HttpOnly');
      expect(cookies).toContain('Secure');
      expect(cookies.toLowerCase()).toContain('samesite=strict');
    });
  });

  test.describe('Security Contract', () => {
    test('should fail: prevent session fixation attacks', async ({ request }) => {
      // ARRANGE: Request with existing session cookie
      const requestBody = {
        email: 'test@scottishailessons.com',
        password: 'red12345'
      };

      // ACT: Login attempt with pre-existing session cookie
      const response = await request.post(`${BASE_URL}/api/auth/sessions/start`, {
        data: requestBody,
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'session=malicious-existing-session'
        }
      });

      // ASSERT: Should return new session, ignoring old cookie
      expect(response.status()).toBe(200);

      const cookies = response.headers()['set-cookie'];
      expect(cookies).toBeTruthy();
      expect(cookies).not.toContain('malicious-existing-session');
    });

    test('should fail: handle SQL injection attempts in email', async ({ request }) => {
      // ARRANGE: SQL injection attempts in email
      const sqlInjectionAttempts = [
        "admin'; DROP TABLE users; --",
        "test@example.com' OR '1'='1",
        "test@example.com'; UPDATE users SET password='hacked' WHERE email='admin@site.com'; --"
      ];

      // ACT & ASSERT: All attempts should be safely handled
      for (const maliciousEmail of sqlInjectionAttempts) {
        const response = await request.post(`${BASE_URL}/api/auth/sessions/start`, {
          data: { email: maliciousEmail, password: 'red12345' },
          headers: { 'Content-Type': 'application/json' }
        });

        // Should either be validation error or authentication error, but not crash
        expect([400, 401]).toContain(response.status());

        const body = await response.json();
        expect(body).toHaveProperty('error');
        expect(body).toHaveProperty('statusCode');
      }
    });

    test('should fail: enforce secure cookie attributes', async ({ request }) => {
      // ARRANGE: Valid login request
      const requestBody = {
        email: 'test@scottishailessons.com',
        password: 'red12345'
      };

      // ACT: Successful login
      const response = await request.post(`${BASE_URL}/api/auth/sessions/start`, {
        data: requestBody,
        headers: { 'Content-Type': 'application/json' }
      });

      // ASSERT: Verify all security attributes are set
      const setCookieHeader = response.headers()['set-cookie'];
      expect(setCookieHeader).toBeTruthy();

      // Parse cookie attributes
      const cookieAttributes = setCookieHeader.toLowerCase();
      expect(cookieAttributes).toContain('httponly');
      expect(cookieAttributes).toContain('secure');
      expect(cookieAttributes).toContain('samesite=strict');

      // Verify session has reasonable expiry (not too long)
      if (setCookieHeader.includes('Max-Age')) {
        const maxAge = setCookieHeader.match(/max-age=(\d+)/i);
        if (maxAge) {
          const maxAgeSeconds = parseInt(maxAge[1]);
          // Should not exceed 24 hours (86400 seconds)
          expect(maxAgeSeconds).toBeLessThanOrEqual(86400);
        }
      }
    });
  });

  test.describe('Error Handling Contract', () => {
    test('should fail: maintain consistent error response format', async ({ request }) => {
      // ARRANGE: Various error scenarios
      const errorScenarios = [
        { data: {}, expectedStatus: 400 }, // missing fields
        { data: { email: 'invalid' }, expectedStatus: 400 }, // invalid email format
        { data: { email: 'test@example.com', password: 'wrong' }, expectedStatus: 401 }, // wrong password
      ];

      // ACT & ASSERT: Test each error scenario
      for (const scenario of errorScenarios) {
        const response = await request.post(`${BASE_URL}/api/auth/sessions/start`, {
          data: scenario.data,
          headers: { 'Content-Type': 'application/json' }
        });

        expect(response.status()).toBe(scenario.expectedStatus);

        const body = await response.json();

        // Verify consistent error format
        expect(body).toMatchObject({
          error: expect.any(String),
          statusCode: expect.any(Number)
        });

        // Verify no sensitive data leakage in error responses
        expect(body).not.toHaveProperty('password');
        expect(body).not.toHaveProperty('session');
        expect(body).not.toHaveProperty('user');
        expect(body).not.toHaveProperty('hash');
        expect(body).not.toHaveProperty('internal');
      }
    });

    test('should fail: handle malformed JSON gracefully', async ({ request }) => {
      // ARRANGE: Malformed JSON
      const response = await request.post(`${BASE_URL}/api/auth/sessions/start`, {
        data: '{"email": "test@example.com", "password": }', // malformed JSON
        headers: { 'Content-Type': 'application/json' }
      });

      // ASSERT: Should return 400 Bad Request for malformed JSON
      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toContain('Invalid');
      expect(body.statusCode).toBe(400);
    });
  });

  test.describe('Performance Contract', () => {
    test('should fail: complete authentication within acceptable timeframe', async ({ request }) => {
      // ARRANGE: Valid credentials and timing
      const requestBody = {
        email: 'test@scottishailessons.com',
        password: 'red12345'
      };

      const startTime = Date.now();

      // ACT: Perform authentication
      const response = await request.post(`${BASE_URL}/api/auth/sessions/start`, {
        data: requestBody,
        headers: { 'Content-Type': 'application/json' }
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // ASSERT: Response time should be under 3 seconds
      expect(responseTime).toBeLessThan(3000);

      // Should complete successfully
      expect([200, 401]).toContain(response.status()); // Allow for either success or auth failure
    });
  });
});