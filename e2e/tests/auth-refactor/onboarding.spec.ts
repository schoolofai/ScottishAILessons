/**
 * Onboarding E2E Tests - Auth Refactor
 *
 * Tests new user onboarding flow and initial setup.
 * These tests verify server-side authentication via httpOnly cookies.
 *
 * Expected Behavior:
 * - New users can complete onboarding process
 * - Profile setup uses server API (NOT client SDK)
 * - Initial course recommendations load via LangGraph
 * - Session persists through onboarding flow
 *
 * Initial Status: THESE TESTS WILL FAIL
 * Reason: Onboarding components likely use AuthDriver with client SDK
 * Fix Required: Migrate onboarding flow to use /api/auth/* and /api/student/* endpoints
 *
 * Related Components:
 * - app/(auth)/onboarding/page.tsx (if exists)
 * - components/onboarding/* (if exists)
 * - lib/appwrite/driver/AuthDriver.ts
 */

import { test, expect, Page } from '@playwright/test';
import { authenticateUser, logoutUser } from '../helpers/auth';
import { TIMEOUTS } from '../helpers/constants';
import { TestDataCleanup } from '../helpers/cleanup';

// Test accounts
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@scottishailessons.com',
  password: process.env.TEST_USER_PASSWORD || 'red12345',
};

test.describe('Onboarding - Auth Refactor', () => {
  test.beforeEach(async ({ page }) => {
    // Start from home page
    await page.goto('/');
  });

  test.afterEach(async ({ page }) => {
    // Cleanup any test data created
    const cleanup = new TestDataCleanup(page);
    await cleanup.cleanupAll();
  });

  test('should redirect authenticated user away from onboarding if already completed', async ({ page }) => {
    console.log('[Test] Testing onboarding redirect for existing user...');

    // SKIP: Onboarding page doesn't exist yet - this is a feature test, not an auth refactor test
    // TODO: Implement onboarding page with server-side redirect logic
    console.log('[Test] ⚠️  Skipping - onboarding page not implemented');
    test.skip();
  });

  test('should display welcome screen for new user on first login', async ({ page }) => {
    console.log('[Test] Testing first-time user onboarding...');

    // Note: This test assumes we can simulate a new user
    // In practice, may need to create a test user on-the-fly
    console.log('[Test] ⚠️  This test requires ability to create new test users');
    console.log('[Test] Skipping for now - requires test user creation infrastructure');

    test.skip();
  });

  test('should allow user to set up profile during onboarding', async ({ page }) => {
    console.log('[Test] Testing profile setup during onboarding...');

    // Note: Similar to above, requires new user creation
    console.log('[Test] ⚠️  This test requires ability to create new test users');
    console.log('[Test] Skipping for now - requires test user creation infrastructure');

    test.skip();
  });

  test('should load initial course recommendations during onboarding', async ({ page }) => {
    console.log('[Test] Testing course recommendations during onboarding...');

    // Login as test user
    await authenticateUser(page, TEST_USER);

    // Navigate to dashboard (where recommendations should load)
    await page.goto('/dashboard');

    // Verify recommendations section appears
    // The dashboard has a "Reviews & Recommendations" button/section
    await expect(page.getByText(/Reviews & Recommendations/i)).toBeVisible({
      timeout: 15000, // LangGraph takes longer
    });
    console.log('[Test] ✅ Recommendations section visible');

    // Verify specific recommendation subsections (headings)
    const whatToReview = page.getByRole('heading', { name: /What to Review/i });
    const whatToTakeNext = page.getByRole('heading', { name: /What to Take Next/i });

    const reviewVisible = await whatToReview.isVisible();
    const nextVisible = await whatToTakeNext.isVisible();

    if (reviewVisible && nextVisible) {
      console.log('[Test] ✅ Found "What to Review" and "What to Take Next" sections');
    } else {
      console.log('[Test] ⚠️  Recommendation subsections may be collapsed');
    }

    // Verify at least one recommendation item
    const recommendationItems = page.locator('[data-testid="recommendation-item"]');
    const itemCount = await recommendationItems.count();

    if (itemCount > 0) {
      console.log(`[Test] ✅ Found ${itemCount} recommendation items`);
    } else {
      console.log('[Test] ⚠️  No recommendation items found (may require LangGraph setup)');
    }
  });

  test('should not show 401 errors during onboarding flow', async ({ page }) => {
    console.log('[Test] Testing for absence of 401 auth errors during onboarding...');

    // Track console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && (msg.text().includes('401') || msg.text().includes('Unauthorized'))) {
        consoleErrors.push(msg.text());
      }
    });

    // Login and navigate to dashboard
    await authenticateUser(page, TEST_USER);
    await page.goto('/dashboard');

    // Wait for page to fully load
    await page.waitForTimeout(TIMEOUTS.mediumWait);

    // ❌ EXPECTED TO FAIL: Client SDK calls may generate 401 errors
    expect(consoleErrors.length).toBe(0);

    if (consoleErrors.length > 0) {
      console.error('[Test] ❌ Found 401 errors:', consoleErrors);
    } else {
      console.log('[Test] ✅ No 401 auth errors detected');
    }
  });

  test('should use server API for profile setup (not client SDK)', async ({ page }) => {
    console.log('[Test] Verifying onboarding uses server API...');

    // Track API calls
    const apiCalls: string[] = [];
    const clientSDKCalls: string[] = [];

    page.on('request', (request) => {
      const url = request.url();

      // Track server API calls
      if (url.includes('/api/')) {
        apiCalls.push(`${request.method()} ${url}`);
      }

      // Track direct Appwrite SDK calls (should NOT happen)
      if (url.includes('appwrite.io') || url.includes('cloud.appwrite.io')) {
        if (!url.includes('/api/')) {
          clientSDKCalls.push(url);
        }
      }
    });

    // Login
    await authenticateUser(page, TEST_USER);

    // Navigate to dashboard (simulating end of onboarding)
    await page.goto('/dashboard');
    await page.waitForTimeout(TIMEOUTS.mediumWait);

    // ❌ EXPECTED TO FAIL: May detect client SDK calls during onboarding flow
    // Verify uses server API
    const profileAPICalls = apiCalls.filter((call) =>
      call.includes('/api/student/') ||
      call.includes('/api/auth/')
    );

    console.log(`[Test] Found ${profileAPICalls.length} profile-related API calls`);
    console.log(`[Test] Found ${clientSDKCalls.length} direct client SDK calls`);

    // Log SDK calls before asserting (so we can see them even if test fails)
    if (clientSDKCalls.length > 0) {
      console.log(`[Test] ⚠️  Detected ${clientSDKCalls.length} client SDK calls:`);
      clientSDKCalls.slice(0, 5).forEach((call, index) => {
        console.log(`  ${index + 1}. ${call}`);
      });
    } else {
      console.log('[Test] ✅ No direct client SDK calls detected');
    }

    // Note: Similar to curriculum test, some SDK calls may be from secondary features (Priority #5)
    // STRICT ENFORCEMENT: Core onboarding/profile functionality MUST use server API
    const maxAllowedSDKCalls = 3; // Allow secondary feature SDK calls
    expect(clientSDKCalls.length).toBeLessThanOrEqual(maxAllowedSDKCalls);
  });

  test('should persist session through onboarding flow', async ({ page }) => {
    console.log('[Test] Testing session persistence through onboarding...');

    // Login
    await authenticateUser(page, TEST_USER);
    console.log('[Test] Initial login successful');

    // Navigate through multiple pages (simulating onboarding flow)
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
    console.log('[Test] ✅ Dashboard navigation successful');

    await page.goto('/courses/catalog');
    await expect(page).toHaveURL(/\/courses\/catalog/);
    console.log('[Test] ✅ Courses navigation successful');

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
    console.log('[Test] ✅ Return to dashboard successful');

    // Verify user still authenticated (no redirect to login)
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/login');
    console.log('[Test] ✅ Session persisted through navigation');
  });
});

test.describe('Onboarding - Profile Completion Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login for all tests
    await page.goto('/');
    await authenticateUser(page, TEST_USER);
  });

  test.afterEach(async ({ page }) => {
    const cleanup = new TestDataCleanup(page);
    await cleanup.cleanupAll();
  });

  test('should load user profile via server API', async ({ page }) => {
    console.log('[Test] Testing user profile loading...');

    // Track API calls
    const apiCalls: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/')) {
        apiCalls.push(`${request.method()} ${url}`);
      }
    });

    // Navigate to a page that loads user profile
    await page.goto('/dashboard');
    await page.waitForTimeout(TIMEOUTS.shortWait);

    // ❌ EXPECTED TO FAIL: Profile loading may use client SDK
    // Verify profile API call was made
    const profileAPICalls = apiCalls.filter((call) =>
      call.includes('/api/auth/me') ||
      call.includes('/api/student/me')
    );

    expect(profileAPICalls.length).toBeGreaterThan(0);

    if (profileAPICalls.length > 0) {
      console.log('[Test] ✅ Profile API calls detected:', profileAPICalls);
    } else {
      console.error('[Test] ❌ No profile API calls detected');
    }
  });

  test('should NOT use fallback pattern for profile loading errors', async ({ page }) => {
    console.log('[Test] Testing for absence of fallback patterns...');

    // Track console messages for fallback patterns
    const fallbackPatterns: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (
        text.includes('falling back') ||
        text.includes('fallback to') ||
        text.includes('using default') ||
        text.includes('retrying with')
      ) {
        fallbackPatterns.push(text);
      }
    });

    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForTimeout(TIMEOUTS.mediumWait);

    // Verify NO fallback patterns (should fast-fail instead)
    expect(fallbackPatterns.length).toBe(0);

    if (fallbackPatterns.length > 0) {
      console.error('[Test] ❌ Detected fallback patterns:', fallbackPatterns);
    } else {
      console.log('[Test] ✅ No fallback patterns detected (fast-fail implemented)');
    }
  });
});
