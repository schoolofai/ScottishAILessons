/**
 * Subscription UI E2E Tests
 *
 * Tests the subscription management UI components on the dashboard.
 * Verifies that SubscriptionStatusCard and ManageSubscriptionButton render correctly.
 */

import { test, expect } from '@playwright/test';
import { authenticateUser } from '../helpers/auth';
import { TIMEOUTS } from '../helpers/constants';

const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@scottishailessons.com',
  password: process.env.TEST_USER_PASSWORD || 'red12345',
};

test.describe('Subscription Management UI', () => {
  test('should show subscription management section on dashboard', async ({ page }) => {
    console.log('[Test] Verifying subscription management UI...');

    // Login
    await page.goto('/');
    await authenticateUser(page, TEST_USER);

    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForTimeout(TIMEOUTS.shortWait);

    // Verify subscription management section exists
    const subscriptionSection = page.locator('[data-testid="subscription-management-section"]');
    await expect(subscriptionSection).toBeVisible({ timeout: 10000 });
    console.log('[Test] ✅ Subscription management section found');

    // Verify subscription status card content
    const statusCard = page.locator('text=Subscription Status');
    await expect(statusCard).toBeVisible({ timeout: 5000 });
    console.log('[Test] ✅ Subscription status card visible');

    // Verify subscription is active (check for the description text)
    const activeDescription = page.locator('text=Your subscription is active and in good standing');
    await expect(activeDescription).toBeVisible({ timeout: 5000 });
    console.log('[Test] ✅ Active subscription status visible');

    // Verify "Manage Subscription" button
    const manageButton = page.locator('text=Manage Subscription');
    await expect(manageButton).toBeVisible({ timeout: 5000 });
    console.log('[Test] ✅ Manage Subscription button visible');

    // Verify billing cycle info
    const billingCycleLabel = page.locator('text=Billing Cycle');
    await expect(billingCycleLabel).toBeVisible({ timeout: 5000 });
    console.log('[Test] ✅ Billing cycle info visible');

    // Verify payment status
    const paymentStatusLabel = page.locator('text=Payment Status');
    await expect(paymentStatusLabel).toBeVisible({ timeout: 5000 });
    console.log('[Test] ✅ Payment status info visible');

    console.log('[Test] ✅ All subscription UI elements verified successfully!');
  });

  test('should show plan details in subscription card', async ({ page }) => {
    console.log('[Test] Verifying plan details in subscription card...');

    // Login
    await page.goto('/');
    await authenticateUser(page, TEST_USER);

    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForTimeout(TIMEOUTS.mediumWait); // Allow subscription data to load

    // Verify subscription management section exists
    const subscriptionSection = page.locator('[data-testid="subscription-management-section"]');
    await expect(subscriptionSection).toBeVisible({ timeout: 10000 });

    // Verify plan label (case-insensitive, partial match)
    const planLabel = page.locator('text=/Plan/i').first();
    await expect(planLabel).toBeVisible({ timeout: 5000 });

    // Verify Billing Cycle label
    const billingLabel = page.locator('text=/Billing.*Cycle/i').first();
    await expect(billingLabel).toBeVisible({ timeout: 5000 });

    // Verify Payment Status label
    const paymentLabel = page.locator('text=/Payment.*Status/i').first();
    await expect(paymentLabel).toBeVisible({ timeout: 5000 });

    console.log('[Test] ✅ Plan details verified');
  });

  test('should have Manage Subscription button visible', async ({ page }) => {
    console.log('[Test] Verifying Manage Subscription button visibility...');

    // Login
    await page.goto('/');
    await authenticateUser(page, TEST_USER);

    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForTimeout(TIMEOUTS.mediumWait); // Allow subscription data to load

    // Find the button (it may be disabled while loading, but should be visible)
    const manageButton = page.locator('button:has-text("Manage Subscription")');
    await expect(manageButton).toBeVisible({ timeout: 10000 });

    // Just verify the button exists - disabled state depends on loading/access
    console.log('[Test] ✅ Manage Subscription button is visible');
  });
});
