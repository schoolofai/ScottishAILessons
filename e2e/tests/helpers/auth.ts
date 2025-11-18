/**
 * Authentication utilities for Scottish AI Lessons E2E tests
 * Based on authentication flow documented in playwright-e2e-test-log.md
 */

import { Page, expect } from '@playwright/test';
import { TEST_USER, SELECTORS, TIMEOUTS } from './constants';

/**
 * Authenticate user with test credentials
 * Based on successful authentication flow from test log
 */
export async function authenticateUser(page: Page, user = TEST_USER): Promise<void> {
  // Clear any existing session/cookies before logging in
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // Navigate to login page (use baseURL from config)
  await page.goto('/login');

  // Wait for login form to appear
  // Look for email input field to ensure we're on login page
  await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible({ timeout: 5000 });

  // Fill in credentials
  await page.getByRole('textbox', { name: /email/i }).fill(user.email);
  await page.getByRole('textbox', { name: /password/i }).fill(user.password);

  // Submit login form
  await page.getByRole('button', { name: /login|sign in/i }).click();

  // Wait for successful redirect to dashboard
  await expect(page).toHaveURL(/\/dashboard/, { timeout: TIMEOUTS.pageLoad });

  // Wait for dashboard to finish loading
  // Accept any valid dashboard state: success, empty, or error
  await Promise.race([
    page.locator('[data-testid="student-dashboard"]').waitFor({ state: 'visible', timeout: 20000 }),
    page.locator('[data-testid="dashboard-empty"]').waitFor({ state: 'visible', timeout: 20000 }),
    page.locator('[data-testid="dashboard-error"]').waitFor({ state: 'visible', timeout: 20000 })
  ]);
}

/**
 * Check if user is already authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    // Check for presence of dashboard link (indicates logged in state)
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible({ timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Authenticate user only if not already authenticated
 */
export async function ensureAuthenticated(page: Page, user = TEST_USER): Promise<void> {
  const authenticated = await isAuthenticated(page);
  if (!authenticated) {
    await authenticateUser(page, user);
  }
}

/**
 * Logout user (if logout functionality exists)
 */
export async function logoutUser(page: Page): Promise<void> {
  try {
    // Look for user menu or logout button
    const userButton = page.getByRole('button').filter({ hasText: /U|User|Profile/i });
    if (await userButton.isVisible({ timeout: 2000 })) {
      await userButton.click();
      
      // Look for logout option
      const logoutButton = page.getByRole('button', { name: /logout|sign out/i });
      if (await logoutButton.isVisible({ timeout: 2000 })) {
        await logoutButton.click();
        
        // Wait for redirect to login/home page
        await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
        return;
      }
    }
    
    // Fallback: clear storage and reload
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    
  } catch (error) {
    console.warn('Logout failed, clearing storage manually:', error);
    // Clear storage as fallback
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
  }
}

/**
 * Get current user session info from page
 */
export async function getSessionInfo(page: Page): Promise<any> {
  try {
    return await page.evaluate(() => {
      const sessionData = localStorage.getItem('session') || sessionStorage.getItem('session');
      return sessionData ? JSON.parse(sessionData) : null;
    });
  } catch {
    return null;
  }
}