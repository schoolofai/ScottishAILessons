/**
 * Stripe integration utilities for E2E tests
 * Provides helpers for testing subscription flows with Stripe test cards
 */

import { Page, expect } from '@playwright/test';
import { TIMEOUTS } from './constants';

/**
 * Stripe test card numbers
 * See: https://stripe.com/docs/testing#cards
 */
export const STRIPE_TEST_CARDS = {
  // Successful payment
  success: '4242424242424242',

  // Card requires authentication (3D Secure)
  requiresAuth: '4000002500003155',

  // Payment declined
  declined: '4000000000000002',

  // Insufficient funds
  insufficientFunds: '4000000000009995',

  // Card expired
  expired: '4000000000000069',
} as const;

/**
 * Stripe test card expiry dates
 */
export const STRIPE_TEST_EXPIRY = {
  valid: '12/34',      // Future date
  expired: '01/20',    // Past date
} as const;

/**
 * Stripe test CVV/CVC
 */
export const STRIPE_TEST_CVC = '123';

/**
 * Stripe test ZIP/Postal code
 */
export const STRIPE_TEST_ZIP = '12345';

/**
 * Wait for Stripe Checkout page to load
 * Stripe checkout opens in new tab or redirects to stripe.com domain
 */
export async function waitForStripeCheckout(page: Page): Promise<void> {
  console.log('[Stripe Helper] Waiting for Stripe Checkout to load...');

  // Wait for Stripe checkout URL
  await page.waitForURL(/checkout\.stripe\.com|stripe\.com/, {
    timeout: TIMEOUTS.pageLoad
  });

  // Wait for card input field to be visible
  await expect(page.locator('#cardNumber, [name="cardnumber"]')).toBeVisible({
    timeout: TIMEOUTS.pageLoad
  });

  console.log('[Stripe Helper] ✅ Stripe Checkout loaded');
}

/**
 * Fill Stripe Checkout form with test card details
 * Handles both embedded and hosted Stripe Checkout
 */
export async function fillStripeCheckoutForm(
  page: Page,
  cardNumber: string = STRIPE_TEST_CARDS.success
): Promise<void> {
  console.log('[Stripe Helper] Filling Stripe Checkout form...');

  // Wait for payment form to be ready
  await page.waitForSelector('[name="cardnumber"], #cardNumber', {
    state: 'visible',
    timeout: TIMEOUTS.pageLoad
  });

  // Fill card number
  const cardInput = page.locator('[name="cardnumber"], #cardNumber').first();
  await cardInput.fill(cardNumber);
  console.log('[Stripe Helper] Card number filled');

  // Fill expiry date
  const expiryInput = page.locator('[name="exp-date"], #cardExpiry').first();
  await expiryInput.fill(STRIPE_TEST_EXPIRY.valid);
  console.log('[Stripe Helper] Expiry date filled');

  // Fill CVC
  const cvcInput = page.locator('[name="cvc"], #cardCvc').first();
  await cvcInput.fill(STRIPE_TEST_CVC);
  console.log('[Stripe Helper] CVC filled');

  // Fill ZIP/Postal code (if present)
  const zipInput = page.locator('[name="postal"], #billingPostalCode').first();
  if (await zipInput.count() > 0) {
    await zipInput.fill(STRIPE_TEST_ZIP);
    console.log('[Stripe Helper] ZIP code filled');
  }

  console.log('[Stripe Helper] ✅ Stripe form filled successfully');
}

/**
 * Submit Stripe Checkout payment
 */
export async function submitStripeCheckout(page: Page): Promise<void> {
  console.log('[Stripe Helper] Submitting Stripe Checkout...');

  // Find and click submit/pay button
  const submitButton = page.locator('button[type="submit"]').filter({ hasText: /pay|subscribe/i });
  await submitButton.click();

  console.log('[Stripe Helper] Payment submitted, waiting for redirect...');

  // Wait for redirect back to our app (success URL)
  await page.waitForURL(/localhost|127\.0\.0\.1/, {
    timeout: TIMEOUTS.pageLoad
  });

  console.log('[Stripe Helper] ✅ Redirected back to app');
}

/**
 * Complete full Stripe checkout flow with test card
 * This is a convenience function that combines all checkout steps
 */
export async function completeStripeCheckout(
  page: Page,
  cardNumber: string = STRIPE_TEST_CARDS.success
): Promise<void> {
  console.log('[Stripe Helper] Starting complete Stripe checkout flow...');

  await waitForStripeCheckout(page);
  await fillStripeCheckoutForm(page, cardNumber);
  await submitStripeCheckout(page);

  console.log('[Stripe Helper] ✅ Stripe checkout completed successfully');
}

/**
 * Check subscription status via API endpoint
 * Returns subscription data if user is subscribed
 */
export async function getSubscriptionStatus(page: Page): Promise<any> {
  try {
    const response = await page.request.get('/api/stripe/subscription-status');

    if (!response.ok()) {
      console.error('[Stripe Helper] Subscription status API failed:', response.status());
      return null;
    }

    const data = await response.json();
    console.log('[Stripe Helper] Subscription status:', data);

    return data;
  } catch (error) {
    console.error('[Stripe Helper] Failed to fetch subscription status:', error);
    return null;
  }
}

/**
 * Verify subscription is active
 */
export async function verifySubscriptionActive(page: Page): Promise<boolean> {
  const status = await getSubscriptionStatus(page);

  if (!status || !status.subscription) {
    console.error('[Stripe Helper] No subscription found');
    return false;
  }

  const isActive = status.subscription.status === 'active' && status.hasAccess === true;
  console.log('[Stripe Helper] Subscription active:', isActive);

  return isActive;
}

/**
 * Wait for subscription to activate after payment
 * Polls the subscription status endpoint until active
 */
export async function waitForSubscriptionActivation(
  page: Page,
  maxAttempts: number = 10,
  interval: number = 2000
): Promise<boolean> {
  console.log('[Stripe Helper] Waiting for subscription activation...');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[Stripe Helper] Check attempt ${attempt}/${maxAttempts}...`);

    const isActive = await verifySubscriptionActive(page);

    if (isActive) {
      console.log('[Stripe Helper] ✅ Subscription activated successfully');
      return true;
    }

    if (attempt < maxAttempts) {
      console.log(`[Stripe Helper] Not active yet, waiting ${interval}ms before retry...`);
      await page.waitForTimeout(interval);
    }
  }

  console.error('[Stripe Helper] ❌ Subscription failed to activate after', maxAttempts, 'attempts');
  return false;
}

/**
 * Verify paywall modal is displayed
 */
export async function verifyPaywallDisplayed(page: Page): Promise<boolean> {
  try {
    // Look for paywall modal content
    const paywallHeading = page.getByRole('heading', { name: /upgrade|subscription|premium|pro/i });
    await expect(paywallHeading).toBeVisible({ timeout: 5000 });

    console.log('[Stripe Helper] ✅ Paywall modal displayed');
    return true;
  } catch (error) {
    console.error('[Stripe Helper] Paywall modal not found');
    return false;
  }
}

/**
 * Click "Subscribe" or "Upgrade" button in paywall modal
 */
export async function clickSubscribeButton(page: Page): Promise<void> {
  console.log('[Stripe Helper] Looking for subscribe button...');

  // Find subscribe/upgrade button
  const subscribeButton = page.getByRole('button', { name: /subscribe|upgrade|get started|buy now/i });
  await expect(subscribeButton).toBeVisible({ timeout: 5000 });

  console.log('[Stripe Helper] Clicking subscribe button...');
  await subscribeButton.click();

  console.log('[Stripe Helper] ✅ Subscribe button clicked');
}

/**
 * Verify "Upgrade to Pro" button visibility in header
 */
export async function verifyUpgradeButtonVisible(page: Page, shouldBeVisible: boolean): Promise<void> {
  const upgradeButton = page.getByRole('button', { name: /upgrade.*pro/i });

  if (shouldBeVisible) {
    await expect(upgradeButton).toBeVisible({ timeout: 3000 });
    console.log('[Stripe Helper] ✅ Upgrade button is visible (user not subscribed)');
  } else {
    await expect(upgradeButton).not.toBeVisible({ timeout: 3000 });
    console.log('[Stripe Helper] ✅ Upgrade button is hidden (user subscribed)');
  }
}
