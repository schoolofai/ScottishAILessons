import { test, expect } from '@playwright/test';

/**
 * Smoke Tests - Critical path verification
 * These tests verify the most important functionality works
 * Should run quickly and catch major regressions
 */

test.describe('Smoke Tests - Critical Path', () => {
  test('should load homepage', async ({ page }) => {
    await page.goto('/');
    
    // Page should load
    await expect(page).toHaveURL('/');
    
    // Key elements should be visible
    await expect(page.locator('span.text-xl.font-bold')).toContainText('Scottish AI Lessons');
    await expect(page.locator('nav').getByRole('button', { name: 'Login' })).toBeVisible();
    await expect(page.locator('nav').getByRole('button', { name: 'Get Started' })).toBeVisible();
  });

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/');
    
    await page.locator('nav').getByRole('button', { name: 'Login' }).click();
    
    await expect(page).toHaveURL('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('text=Continue with Google')).toBeVisible();
  });

  test('should navigate to signup page', async ({ page }) => {
    await page.goto('/');
    
    await page.locator('nav').getByRole('button', { name: 'Get Started' }).click();
    
    await expect(page).toHaveURL('/signup');
    await expect(page.locator('input[id="name"]')).toBeVisible();
    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="password"]')).toBeVisible();
    await expect(page.locator('input[id="confirmPassword"]')).toBeVisible();
  });

  test('should redirect unauthenticated user from protected route', async ({ page }) => {
    // Clear any existing cookies
    await page.context().clearCookies();
    
    // Try to access protected route
    await page.goto('/chat');
    
    // Should redirect to login (may include redirect parameter)
    await expect(page.url()).toContain('/login');
  });

  test('should handle basic form validation', async ({ page }) => {
    await page.goto('/login');
    
    // Try to submit form with invalid email
    await page.fill('input[type="email"]', 'invalid-email');
    await page.click('button[type="submit"]');
    
    // HTML5 validation should prevent submission
    const emailInput = page.locator('input[type="email"]');
    const isInvalid = await emailInput.evaluate(el => !(el as HTMLInputElement).validity.valid);
    expect(isInvalid).toBe(true);
  });

  test('should display error for invalid login', async ({ page }) => {
    // Mock failed login response
    await page.route('/api/auth/login', route => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid credentials' }),
      });
    });
    
    await page.goto('/login');
    
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.locator('.bg-red-50')).toBeVisible();
    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });

  test('should handle successful login flow', async ({ page }) => {
    // Mock successful login response
    await page.route('/api/auth/login', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, userId: 'test-user' }),
        headers: {
          'Set-Cookie': 'appwrite-session=mock-session-token; HttpOnly; Path=/'
        }
      });
    });
    
    await page.goto('/login');
    
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait a moment for redirect processing
    await page.waitForTimeout(1000);
    
    // Should either be on chat or have session cookie
    const url = page.url();
    const cookies = await page.context().cookies();
    const hasSession = cookies.some(c => c.name.includes('session'));
    
    expect(url.includes('/chat') || hasSession).toBe(true);
  });

  test('should load chat interface for authenticated user', async ({ page }) => {
    // Set session cookie to simulate authenticated state
    await page.context().addCookies([{
      name: 'appwrite-session',
      value: 'mock-session-token',
      domain: 'localhost',
      path: '/',
    }]);
    
    await page.goto('/chat');
    
    // Chat interface should load
    await expect(page).toHaveURL('/chat');
    
    // Main chat container should be visible
    const chatContainer = page.locator('main.h-dvh');
    await expect(chatContainer).toBeVisible();
  });

  test('should handle signup validation', async ({ page }) => {
    await page.goto('/signup');
    
    // Try with mismatched passwords
    await page.fill('input[id="name"]', 'Test User');
    await page.fill('input[id="email"]', 'test@example.com');
    await page.fill('input[id="password"]', 'password123');
    await page.fill('input[id="confirmPassword"]', 'differentpassword');
    await page.click('button[type="submit"]');
    
    // Should show password mismatch error
    await expect(page.locator('text=Passwords do not match')).toBeVisible();
  });

  test('should navigate to password reset', async ({ page }) => {
    await page.goto('/login');
    
    await page.click('text=Forgot password?');
    
    await expect(page).toHaveURL('/reset-password');
    await expect(page.locator('text=Reset Password')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('should have responsive navigation', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Navigation should be visible and functional
    await expect(page.locator('span.text-xl.font-bold')).toContainText('Scottish AI Lessons');
    await expect(page.locator('nav').getByRole('button', { name: 'Login' })).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('span.text-xl.font-bold')).toContainText('Scottish AI Lessons');
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock server error
    await page.route('/api/auth/login', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });
    
    await page.goto('/login');
    
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Should handle error gracefully
    await expect(page.locator('.bg-red-50')).toBeVisible();
  });

  test('should maintain session across page reloads', async ({ page }) => {
    // Set up authenticated session
    await page.context().addCookies([{
      name: 'appwrite-session',
      value: 'mock-session-token',
      domain: 'localhost',
      path: '/',
    }]);
    
    // Go to chat page
    await page.goto('/chat');
    
    // Should load chat interface
    await expect(page.url()).toContain('/chat');
    
    // Reload page
    await page.reload();
    
    // Should still be on chat page or maintain session
    const url = page.url();
    expect(url.includes('/chat')).toBe(true);
  });

  test('should have proper page titles', async ({ page }) => {
    // Home page
    await page.goto('/');
    await expect(page).toHaveTitle(/assistant-ui App/);
    
    // Login page  
    await page.goto('/login');
    await expect(page).toHaveTitle(/assistant-ui App/);
    
    // Signup page
    await page.goto('/signup');
    await expect(page).toHaveTitle(/assistant-ui App/);
  });

  test('should handle concurrent user sessions', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // Both contexts should be able to load the app independently
    await Promise.all([
      page1.goto('/'),
      page2.goto('/'),
    ]);
    
    await Promise.all([
      expect(page1.locator('span.text-xl.font-bold')).toContainText('Scottish AI Lessons'),
      expect(page2.locator('span.text-xl.font-bold')).toContainText('Scottish AI Lessons'),
    ]);
    
    await context1.close();
    await context2.close();
  });
});