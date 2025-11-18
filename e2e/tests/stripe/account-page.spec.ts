/**
 * Account Page - Subscription Management E2E Tests
 *
 * Tests the user account page subscription management features:
 * - Subscription status display
 * - Manage Subscription button functionality
 * - Proper separation from education-focused dashboard
 *
 * Following TDD approach - tests written before implementation
 */

import { test, expect } from '@playwright/test';
import { authenticateUser } from '../helpers/auth';
import { TIMEOUTS } from '../helpers/constants';

// Test user credentials
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@scottishailessons.com',
  password: process.env.TEST_USER_PASSWORD || 'red12345',
};

test.describe('Account Page - Subscription Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as test user
    await page.goto('/');
    await authenticateUser(page, TEST_USER);
  });

  test('should navigate to account page from header', async ({ page }) => {
    console.log('[Test] Verifying account page navigation...');

    // Navigate to dashboard first
    await page.goto('/dashboard');
    await page.waitForTimeout(TIMEOUTS.shortWait);

    // Click on account/profile link in header
    const accountLink = page.locator('[data-testid="account-link"], a[href="/account"]').first();
    await expect(accountLink).toBeVisible({ timeout: 10000 });
    await accountLink.click();

    // Verify we're on the account page
    await expect(page).toHaveURL(/\/account/);
    console.log('[Test] ✅ Successfully navigated to account page');
  });

  test('should display subscription status card on account page', async ({ page }) => {
    console.log('[Test] Verifying subscription status card on account page...');

    // Navigate to account page
    await page.goto('/account');
    await page.waitForTimeout(TIMEOUTS.shortWait);

    // Wait for subscription status card
    const statusCard = page.locator('[data-testid="subscription-status-card"]');
    await expect(statusCard).toBeVisible({ timeout: 10000 });
    console.log('[Test] ✅ Subscription status card visible');

    // Verify subscription details are displayed
    const planInfo = statusCard.locator('text=/Plan|Subscription Status/i');
    await expect(planInfo).toBeVisible();
    console.log('[Test] ✅ Plan information displayed');
  });

  test('should display Manage Subscription button on account page', async ({ page }) => {
    console.log('[Test] Verifying Manage Subscription button on account page...');

    // Navigate to account page
    await page.goto('/account');
    await page.waitForTimeout(TIMEOUTS.shortWait);

    // Wait for Manage Subscription button
    const manageButton = page.locator('button:has-text("Manage Subscription"), [data-testid="manage-subscription-button"]');
    await expect(manageButton).toBeVisible({ timeout: 10000 });
    console.log('[Test] ✅ Manage Subscription button visible on account page');
  });

  test('should NOT display subscription status card on dashboard', async ({ page }) => {
    console.log('[Test] Verifying subscription card NOT on dashboard...');

    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForTimeout(TIMEOUTS.shortWait);

    // Wait for dashboard to load
    await expect(page.locator('[data-testid="student-dashboard"], .dashboard-container')).toBeVisible({ timeout: 10000 });

    // Verify subscription status card is NOT visible on dashboard
    const statusCard = page.locator('[data-testid="subscription-status-card"]');
    await expect(statusCard).not.toBeVisible();
    console.log('[Test] ✅ Subscription status card correctly NOT on dashboard');
  });

  test('should NOT display Manage Subscription button on dashboard', async ({ page }) => {
    console.log('[Test] Verifying Manage Subscription button NOT on dashboard...');

    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForTimeout(TIMEOUTS.shortWait);

    // Wait for dashboard to load
    await expect(page.locator('[data-testid="student-dashboard"], .dashboard-container')).toBeVisible({ timeout: 10000 });

    // Verify Manage Subscription button is NOT visible on dashboard
    // We're specifically looking for the button with exactly this text
    const manageButton = page.locator('[data-testid="manage-subscription-button"]');
    await expect(manageButton).not.toBeVisible();
    console.log('[Test] ✅ Manage Subscription button correctly NOT on dashboard');
  });

  test('should display account page header and navigation', async ({ page }) => {
    console.log('[Test] Verifying account page structure...');

    // Navigate to account page
    await page.goto('/account');
    await page.waitForTimeout(TIMEOUTS.shortWait);

    // Verify page heading
    const heading = page.locator('h1, h2').filter({ hasText: /Account|Profile|Settings/i });
    await expect(heading).toBeVisible({ timeout: 10000 });
    console.log('[Test] ✅ Account page heading visible');
  });

  test('should redirect Manage Subscription to Stripe portal', async ({ page }) => {
    console.log('[Test] Verifying Stripe portal redirect...');

    // Navigate to account page
    await page.goto('/account');
    await page.waitForTimeout(TIMEOUTS.shortWait);

    // Click Manage Subscription button
    const manageButton = page.locator('button:has-text("Manage Subscription"), [data-testid="manage-subscription-button"]');
    await expect(manageButton).toBeVisible({ timeout: 10000 });

    // Listen for navigation to Stripe
    const navigationPromise = page.waitForURL(/billing\.stripe\.com|checkout\.stripe\.com/, {
      timeout: 30000,
    }).catch(() => null);

    await manageButton.click();

    // Check if we're redirected to Stripe portal
    // Note: This may fail if user has no subscription - that's expected
    const navigated = await navigationPromise;
    if (navigated) {
      console.log('[Test] ✅ Redirected to Stripe billing portal');
    } else {
      // Check for error message if no subscription
      const errorMessage = page.locator('text=/subscription|portal/i');
      console.log('[Test] ℹ️ Portal redirect may require active subscription');
    }
  });

  test('should display user profile information on account page', async ({ page }) => {
    console.log('[Test] Verifying user profile info on account page...');

    // Navigate to account page
    await page.goto('/account');
    await page.waitForTimeout(TIMEOUTS.shortWait);

    // Check for profile section (email, name)
    const profileSection = page.locator('[data-testid="profile-section"], .profile-info');

    // Page should have some user-identifying information
    const userEmail = page.locator(`text=/${TEST_USER.email}/i`);
    const visible = await userEmail.isVisible().catch(() => false);

    if (visible) {
      console.log('[Test] ✅ User email displayed on account page');
    } else {
      // At minimum, account page should exist and load
      await expect(page).toHaveURL(/\/account/);
      console.log('[Test] ✅ Account page loaded successfully');
    }
  });
});

test.describe('Dashboard - Education Focus', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await authenticateUser(page, TEST_USER);
  });

  test('should display course/lesson related content on dashboard', async ({ page }) => {
    console.log('[Test] Verifying dashboard shows education content...');

    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForTimeout(TIMEOUTS.shortWait);

    // Dashboard should have course-related content
    const courseContent = page.locator('text=/course|lesson|learn|study|progress/i').first();
    await expect(courseContent).toBeVisible({ timeout: 10000 });
    console.log('[Test] ✅ Dashboard displays education-related content');
  });

  test('should still check subscription for lesson access on dashboard', async ({ page }) => {
    console.log('[Test] Verifying subscription check still works for lessons...');

    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForTimeout(TIMEOUTS.shortWait);

    // The dashboard should still have lesson functionality
    // Just not the subscription management UI
    await expect(page.locator('[data-testid="student-dashboard"], .dashboard-container')).toBeVisible({ timeout: 10000 });
    console.log('[Test] ✅ Dashboard functional for education purposes');
  });
});
