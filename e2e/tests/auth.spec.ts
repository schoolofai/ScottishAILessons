/**
 * Authentication tests for Scottish AI Lessons
 * Based on authentication flow documented in playwright-e2e-test-log.md
 */

import { test, expect } from '@playwright/test';
import { authenticateUser, isAuthenticated, logoutUser, getSessionInfo } from './helpers/auth';
import { TEST_USER } from './helpers/constants';

test.describe('Authentication', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should successfully authenticate with valid credentials', async ({ page }) => {
    // Verify we start unauthenticated
    expect(await isAuthenticated(page)).toBe(false);
    
    // Perform authentication
    await authenticateUser(page, TEST_USER);
    
    // Verify authentication success
    expect(await isAuthenticated(page)).toBe(true);
    
    // Verify dashboard is accessible
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  });

  test('should reject invalid credentials', async ({ page }) => {
    const invalidUser = {
      email: 'invalid@example.com',
      password: 'wrongpassword'
    };
    
    try {
      await authenticateUser(page, invalidUser);
      // If no error is thrown, check if we're still on login page
      const currentUrl = page.url();
      expect(currentUrl).not.toMatch(/\/dashboard/);
    } catch (error) {
      // Authentication should fail - this is expected behavior
      expect(error).toBeDefined();
    }
    
    // Should still be unauthenticated
    expect(await isAuthenticated(page)).toBe(false);
  });

  test('should maintain session across page reloads', async ({ page }) => {
    // Authenticate user
    await authenticateUser(page, TEST_USER);
    expect(await isAuthenticated(page)).toBe(true);
    
    // Reload the page
    await page.reload();
    
    // Should still be authenticated
    expect(await isAuthenticated(page)).toBe(true);
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  });

  test('should handle logout if functionality exists', async ({ page }) => {
    // Authenticate user first
    await authenticateUser(page, TEST_USER);
    expect(await isAuthenticated(page)).toBe(true);
    
    // Attempt logout
    await logoutUser(page);
    
    // Should be unauthenticated after logout
    expect(await isAuthenticated(page)).toBe(false);
  });

  test('should store session information', async ({ page }) => {
    // Authenticate user
    await authenticateUser(page, TEST_USER);
    
    // Get session info
    const sessionInfo = await getSessionInfo(page);
    
    // Session info should exist (format may vary based on implementation)
    expect(sessionInfo).toBeDefined();
    
    if (sessionInfo) {
      // Basic validation of session structure
      expect(typeof sessionInfo).toBe('object');
      console.log('Session info detected:', sessionInfo);
    }
  });

  test('should redirect to dashboard after successful login', async ({ page }) => {
    // Start from home page
    await page.goto('/');
    
    // Authenticate
    await authenticateUser(page, TEST_USER);
    
    // Should be redirected to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Dashboard should be functional
    await expect(page.getByRole('button', { name: 'Start Lesson' })).toBeVisible({ timeout: 10000 });
  });

});