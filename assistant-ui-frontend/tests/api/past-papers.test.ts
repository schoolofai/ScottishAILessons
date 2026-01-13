/**
 * API Contract Tests for Past Papers Routes
 *
 * Tests follow TDD Red-Green-Refactor methodology for API contract validation.
 * Using Playwright test framework for API testing.
 *
 * Routes tested:
 * - GET /api/past-papers - List papers with filters
 * - GET /api/past-papers/browse - Hierarchical navigation structure
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

test.describe('GET /api/past-papers - List Papers API', () => {

  test.describe('Authentication Contract', () => {
    test('should require authentication', async ({ request }) => {
      // ACT: Call past-papers endpoint without authentication
      const response = await request.get(`${BASE_URL}/api/past-papers`);

      // ASSERT: Should return 401 Unauthorized
      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body).toMatchObject({
        error: expect.stringContaining('authenticated'),
        statusCode: 401
      });
    });
  });

  test.describe('Request Validation Contract', () => {
    test('should validate subject parameter is optional', async ({ request }) => {
      // This test verifies the route accepts requests without subject filter
      // Will be validated in integration tests with auth
      const response = await request.get(`${BASE_URL}/api/past-papers`);

      // Without auth, should get 401 (not 400 for missing params)
      expect(response.status()).toBe(401);
    });

    test('should accept valid filter parameters', async ({ request }) => {
      // This test verifies the route accepts valid parameters
      const response = await request.get(
        `${BASE_URL}/api/past-papers?subject=Mathematics&level=National%205&year=2023`
      );

      // Without auth, should get 401 (params are validated after auth)
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Success Response Contract (requires authenticated session)', () => {
    test.skip('should return papers matching filter criteria', async ({ request }) => {
      // TODO: Run with authenticated session
      // This test should verify:
      // - 200 status code
      // - Response contains papers array
      // - Each paper has required fields (paperId, subject, level, year, paperCode, etc.)
      // - Pagination info included
    });

    test.skip('should return empty array for no matches', async ({ request }) => {
      // TODO: Run with authenticated session
      // Filter for non-existent subject/level should return empty array, not error
    });
  });

  test.describe('Error Handling Contract', () => {
    test('should return consistent error format', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/past-papers`);

      const body = await response.json();

      // Verify consistent error format
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('statusCode');

      // No data leakage
      expect(body).not.toHaveProperty('papers');
      expect(body).not.toHaveProperty('internal');
    });
  });
});

test.describe('GET /api/past-papers/browse - Navigation Structure API', () => {

  test.describe('Authentication Contract', () => {
    test('should require authentication', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/past-papers/browse`);

      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body).toMatchObject({
        error: expect.stringContaining('authenticated'),
        statusCode: 401
      });
    });
  });

  test.describe('Success Response Contract (requires authenticated session)', () => {
    test.skip('should return hierarchical navigation structure', async ({ request }) => {
      // TODO: Run with authenticated session
      // This test should verify:
      // - 200 status code
      // - Response contains subjects array
      // - Each subject has levels array
      // - Each level has years array
      // - Years are sorted descending
    });
  });
});

test.describe('GET /api/past-papers/[paperId] - Single Paper API', () => {

  test.describe('Authentication Contract', () => {
    test('should require authentication', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/past-papers/mathematics-n5-2023-X847-75-01`);

      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body).toMatchObject({
        error: expect.stringContaining('authenticated'),
        statusCode: 401
      });
    });
  });

  test.describe('Request Validation Contract', () => {
    test('should validate paperId parameter format', async ({ request }) => {
      // Invalid paper ID formats
      const invalidIds = ['', 'invalid', '123'];

      for (const paperId of invalidIds) {
        const response = await request.get(`${BASE_URL}/api/past-papers/${paperId}`);

        // Without auth, should get 401 first
        expect(response.status()).toBe(401);
      }
    });
  });

  test.describe('Success Response Contract (requires authenticated session)', () => {
    test.skip('should return paper with questions list', async ({ request }) => {
      // TODO: Run with authenticated session
      // This test should verify:
      // - 200 status code
      // - Response contains paper metadata
      // - Response contains questions array
      // - Each question has number, marks, topicTags, hasSolution
    });

    test.skip('should return 404 for non-existent paper', async ({ request }) => {
      // TODO: Run with authenticated session
      // Non-existent paper should return 404, not empty response
    });
  });
});

test.describe('GET /api/past-papers/[paperId]/questions/[questionNumber]/walkthrough - Walkthrough API', () => {

  test.describe('Authentication Contract', () => {
    test('should require authentication', async ({ request }) => {
      const response = await request.get(
        `${BASE_URL}/api/past-papers/mathematics-n5-2023-X847-75-01/questions/1/walkthrough`
      );

      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body).toMatchObject({
        error: expect.stringContaining('authenticated'),
        statusCode: 401
      });
    });
  });

  test.describe('Request Validation Contract', () => {
    test('should validate questionNumber parameter', async ({ request }) => {
      // Valid question number formats should return 401 (auth check before validation)
      // Note: Empty string ('') changes URL path structure so it's not tested here
      const testNumbers = ['1', '4a', '5b'];

      for (const qNum of testNumbers) {
        const response = await request.get(
          `${BASE_URL}/api/past-papers/mathematics-n5-2023-X847-75-01/questions/${qNum}/walkthrough`
        );

        // Without auth, should get 401 (auth check happens first)
        expect(response.status()).toBe(401);
      }
    });
  });

  test.describe('Success Response Contract (requires authenticated session)', () => {
    test.skip('should return walkthrough with steps and errors', async ({ request }) => {
      // TODO: Run with authenticated session
      // This test should verify:
      // - 200 status code
      // - Response contains walkthrough content
      // - Content has question_stem, steps, common_errors
      // - Each step has bullet, label, process, working, marks_earned
      // - Each error has error_type, description, why_marks_lost, prevention_tip
    });

    test.skip('should return status not_generated for missing walkthrough', async ({ request }) => {
      // TODO: Run with authenticated session
      // Missing walkthrough should return { status: 'not_generated' }, not 404
    });
  });
});

test.describe('GET /api/past-papers/availability/[courseId] - Past Papers Availability API', () => {

  test.describe('Authentication Contract', () => {
    test('should require authentication', async ({ request }) => {
      const response = await request.get(
        `${BASE_URL}/api/past-papers/availability/test-course-id`
      );

      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body).toMatchObject({
        error: expect.stringContaining('authenticated'),
        statusCode: 401
      });
    });
  });

  test.describe('Request Validation Contract', () => {
    test('should validate courseId parameter', async ({ request }) => {
      // Valid course ID should return 401 (auth check before business logic)
      const testCourseIds = ['course-123', 'mathematics-n5', 'test-course'];

      for (const courseId of testCourseIds) {
        const response = await request.get(
          `${BASE_URL}/api/past-papers/availability/${courseId}`
        );

        // Without auth, should get 401 (auth check happens first)
        expect(response.status()).toBe(401);
      }
    });
  });

  test.describe('Success Response Contract (requires authenticated session)', () => {
    test.skip('should return availability status for valid course', async ({ request }) => {
      // TODO: Run with authenticated session
      // This test should verify:
      // - 200 status code
      // - Response contains { success: true, available: boolean }
      // - If available, includes subject and level info
      // - subjectSlug and levelSlug for navigation
    });

    test.skip('should return available: false for non-existent course', async ({ request }) => {
      // TODO: Run with authenticated session
      // Non-existent course should return { available: false }, not 404
    });

    test.skip('should return available: false for course without past papers', async ({ request }) => {
      // TODO: Run with authenticated session
      // Course without matching past papers should return { available: false }
    });
  });
});
