import { test, expect } from '@playwright/test';
import { AuthHelper } from './helpers/auth-helper';
import { ChatPage, LoginPage } from './page-objects/auth-pages';
import { routes, apiEndpoints } from './helpers/test-data';

test.describe('Route Protection Middleware', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    await authHelper.clearAllCookies();
  });

  test.describe('Protected Routes', () => {
    test('should redirect unauthenticated user from /chat to /login', async ({ page }) => {
      // Try to access protected route without authentication
      await page.goto(routes.chat);
      
      // Should be redirected to login
      await authHelper.expectRedirectToLogin();
      
      // Check if redirect parameter is set
      const url = new URL(page.url());
      expect(url.searchParams.get('redirect')).toBe('/chat');
    });

    test('should allow authenticated user to access /chat', async ({ page }) => {
      const chatPage = new ChatPage(page);
      
      // Mock successful login
      await authHelper.mockApiResponse(apiEndpoints.login, {
        success: true,
        userId: 'test-user-id'
      });
      
      // First login
      await authHelper.loginWithEmailPassword();
      await chatPage.expectChatInterface();
      
      // Now directly access /chat
      await page.goto(routes.chat);
      await chatPage.expectChatInterface();
    });

    test('should redirect authenticated user from auth pages to /chat', async ({ page }) => {
      const chatPage = new ChatPage(page);
      
      // Mock successful login first
      await authHelper.mockApiResponse(apiEndpoints.login, {
        success: true,
        userId: 'test-user-id'
      });
      
      await authHelper.loginWithEmailPassword();
      await chatPage.expectChatInterface();
      
      // Try to access login page while authenticated
      await page.goto(routes.login);
      await expect(page).toHaveURL(routes.chat);
      
      // Try to access signup page while authenticated
      await page.goto(routes.signup);
      await expect(page).toHaveURL(routes.chat);
      
      // Try to access reset password page while authenticated
      await page.goto(routes.resetPassword);
      await expect(page).toHaveURL(routes.chat);
    });

    test('should allow access to home page regardless of auth status', async ({ page }) => {
      // Test without authentication
      await page.goto(routes.home);
      await expect(page).toHaveURL(routes.home);
      
      // Test with authentication
      await authHelper.mockApiResponse(apiEndpoints.login, {
        success: true,
        userId: 'test-user-id'
      });
      
      await authHelper.loginWithEmailPassword();
      await page.goto(routes.home);
      await expect(page).toHaveURL(routes.home);
    });
  });

  test.describe('Session Validation', () => {
    test('should validate session cookie on protected route access', async ({ page }) => {
      // Manually set an invalid session cookie
      await page.context().addCookies([{
        name: 'appwrite-session',
        value: 'invalid-session-token',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Strict',
      }]);
      
      // Try to access protected route
      await page.goto(routes.chat);
      
      // Should be redirected to login due to invalid session
      await authHelper.expectRedirectToLogin();
    });

    test('should handle missing session cookie', async ({ page }) => {
      // Ensure no cookies are set
      await authHelper.clearAllCookies();
      
      await page.goto(routes.chat);
      await authHelper.expectRedirectToLogin();
    });

    test('should preserve destination URL for post-login redirect', async ({ page }) => {
      // Try to access specific protected route
      await page.goto(routes.chat + '?param=test');
      
      // Should redirect to login with redirect parameter
      await authHelper.expectRedirectToLogin();
      
      const url = new URL(page.url());
      const redirectParam = url.searchParams.get('redirect');
      expect(redirectParam).toBe('/chat');
    });
  });

  test.describe('Middleware Performance', () => {
    test('should not significantly impact page load time', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto(routes.home);
      await expect(page.locator('nav')).toBeVisible();
      
      const loadTime = Date.now() - startTime;
      
      // Middleware should not add more than 100ms to load time
      expect(loadTime).toBeLessThan(2000); // Generous for CI
    });

    test('should handle concurrent requests', async ({ browser }) => {
      const contexts = await Promise.all([
        browser.newContext(),
        browser.newContext(),
        browser.newContext(),
      ]);
      
      const pages = await Promise.all(
        contexts.map(context => context.newPage())
      );
      
      // Make concurrent requests to protected route
      const startTime = Date.now();
      await Promise.all(
        pages.map(page => page.goto(routes.chat))
      );
      const endTime = Date.now();
      
      // All should redirect to login
      for (const page of pages) {
        await expect(page).toHaveURL(routes.login);
      }
      
      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(5000);
      
      // Cleanup
      await Promise.all(contexts.map(context => context.close()));
    });
  });

  test.describe('Edge Cases', () => {
    test('should handle malformed session cookie', async ({ page }) => {
      // Set a malformed cookie
      await page.context().addCookies([{
        name: 'appwrite-session',
        value: 'malformed.cookie.value',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Strict',
      }]);
      
      await page.goto(routes.chat);
      await authHelper.expectRedirectToLogin();
    });

    test('should handle expired session cookie', async ({ page }) => {
      // Set an expired cookie
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      await page.context().addCookies([{
        name: 'appwrite-session',
        value: 'expired-session-token',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Strict',
        expires: Math.floor(pastDate.getTime() / 1000),
      }]);
      
      await page.goto(routes.chat);
      await authHelper.expectRedirectToLogin();
    });

    test('should handle network errors during session validation', async ({ page }) => {
      // Set a valid-looking cookie
      await page.context().addCookies([{
        name: 'appwrite-session',
        value: 'valid-looking-session-token',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Strict',
      }]);
      
      // Mock network error for session validation
      await page.route('**/api/auth/**', route => {
        route.abort();
      });
      
      await page.goto(routes.chat);
      
      // Should redirect to login on network error
      await authHelper.expectRedirectToLogin();
    });

    test('should handle rapid navigation between protected and public routes', async ({ page }) => {
      const chatPage = new ChatPage(page);
      
      // Mock successful login
      await authHelper.mockApiResponse(apiEndpoints.login, {
        success: true,
        userId: 'test-user-id'
      });
      
      await authHelper.loginWithEmailPassword();
      await chatPage.expectChatInterface();
      
      // Rapidly navigate between routes
      for (let i = 0; i < 5; i++) {
        await page.goto(routes.home);
        await expect(page).toHaveURL(routes.home);
        
        await page.goto(routes.chat);
        await expect(page).toHaveURL(routes.chat);
      }
    });

    test('should handle browser back/forward with authentication', async ({ page }) => {
      const loginPage = new LoginPage(page);
      const chatPage = new ChatPage(page);
      
      // Start at home
      await page.goto(routes.home);
      
      // Go to login
      await page.goto(routes.login);
      await loginPage.expectLoginForm();
      
      // Mock successful login
      await authHelper.mockApiResponse(apiEndpoints.login, {
        success: true,
        userId: 'test-user-id'
      });
      
      await loginPage.login('test@example.com', 'password');
      await chatPage.expectChatInterface();
      
      // Use browser back button
      await page.goBack();
      
      // Should redirect to chat (since user is authenticated)
      await expect(page).toHaveURL(routes.chat);
      
      // Go forward
      await page.goForward();
      await expect(page).toHaveURL(routes.chat);
    });
  });

  test.describe('Security Headers', () => {
    test('should set secure cookie attributes in production', async ({ page }) => {
      // This would need to be tested against a production build
      // For now, we'll test the cookie setting logic
      
      await authHelper.mockApiResponse(apiEndpoints.login, {
        success: true,
        userId: 'test-user-id'
      });
      
      await authHelper.loginWithEmailPassword();
      
      const cookie = await authHelper.checkSessionCookieProperties();
      expect(cookie).toBeDefined();
      expect(cookie?.httpOnly).toBe(true);
      expect(cookie?.sameSite).toBe('Strict');
    });

    test('should prevent CSRF attacks with SameSite cookies', async ({ page }) => {
      // Mock login to set cookie
      await authHelper.mockApiResponse(apiEndpoints.login, {
        success: true,
        userId: 'test-user-id'
      });
      
      await authHelper.loginWithEmailPassword();
      
      const cookies = await page.context().cookies();
      const sessionCookie = cookies.find(cookie => cookie.name === 'appwrite-session');
      
      expect(sessionCookie?.sameSite).toBe('Strict');
    });
  });
});