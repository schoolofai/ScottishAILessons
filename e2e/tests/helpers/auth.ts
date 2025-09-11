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
  // Navigate to login page
  await page.getByRole('link', { name: 'Login', exact: true }).click();
  
  // Fill in credentials
  await page.getByRole('textbox', { name: 'Email' }).fill(user.email);
  await page.getByRole('textbox', { name: 'Password' }).fill(user.password);
  
  // Submit login form
  await page.getByRole('button', { name: 'Login' }).click();
  
  // Wait for successful redirect to dashboard
  await expect(page).toHaveURL(/\/dashboard/, { timeout: TIMEOUTS.pageLoad });
  
  // Verify user profile is loaded (look for dashboard elements)
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
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