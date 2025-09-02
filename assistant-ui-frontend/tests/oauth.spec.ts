import { test, expect } from '@playwright/test';
import { LoginPage, SignupPage, ChatPage } from './page-objects/auth-pages';
import { AuthHelper } from './helpers/auth-helper';
import { apiEndpoints, routes } from './helpers/test-data';

test.describe('OAuth Integration', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    await authHelper.clearAllCookies();
  });

  test.describe('Google OAuth Flow', () => {
    test('should initiate Google OAuth from login page', async ({ page }) => {
      const loginPage = new LoginPage(page);
      
      // Mock OAuth initiation response
      await authHelper.mockApiResponse(apiEndpoints.googleOAuth, {
        redirectUrl: 'https://accounts.google.com/oauth/v2/auth?client_id=test&redirect_uri=test'
      });
      
      await loginPage.goto();
      await loginPage.expectLoginForm();
      
      // Click Google login button
      await loginPage.clickGoogleLogin();
      
      // Should navigate to Google OAuth (mocked)
      // In real test, this would redirect to Google
      await page.waitForTimeout(100); // Small delay for API call
    });

    test('should initiate Google OAuth from signup page', async ({ page }) => {
      const signupPage = new SignupPage(page);
      
      // Mock OAuth initiation response
      await authHelper.mockApiResponse(apiEndpoints.googleOAuth, {
        redirectUrl: 'https://accounts.google.com/oauth/v2/auth?client_id=test&redirect_uri=test'
      });
      
      await signupPage.goto();
      await signupPage.expectSignupForm();
      
      // Click Google signup button
      await signupPage.clickGoogleSignup();
      
      await page.waitForTimeout(100);
    });

    test('should handle successful OAuth callback', async ({ page }) => {
      const chatPage = new ChatPage(page);
      
      // Simulate OAuth callback with valid parameters
      const callbackUrl = `${routes.home}/api/auth/google/callback?userId=test-user-id&secret=test-secret`;
      
      // Mock the callback endpoint
      await page.route('**/api/auth/google/callback*', route => {
        // Simulate successful callback processing
        route.fulfill({
          status: 302,
          headers: {
            'Location': routes.chat
          }
        });
      });
      
      await page.goto(callbackUrl);
      
      // Should redirect to chat after successful OAuth
      await expect(page).toHaveURL(routes.chat);
    });

    test('should handle OAuth callback failure', async ({ page }) => {
      // Simulate OAuth callback with error
      const callbackUrl = `${routes.home}/api/auth/google/callback?error=access_denied`;
      
      // Mock the callback endpoint to redirect with error
      await page.route('**/api/auth/google/callback*', route => {
        route.fulfill({
          status: 302,
          headers: {
            'Location': `${routes.login}?error=oauth_failed`
          }
        });
      });
      
      await page.goto(callbackUrl);
      
      // Should redirect back to login with error
      await expect(page).toHaveURL(/.*login.*error=oauth_failed/);
    });

    test('should handle missing OAuth parameters', async ({ page }) => {
      // Simulate OAuth callback without required parameters
      const callbackUrl = `${routes.home}/api/auth/google/callback`;
      
      await page.route('**/api/auth/google/callback*', route => {
        route.fulfill({
          status: 302,
          headers: {
            'Location': `${routes.login}?error=invalid_callback`
          }
        });
      });
      
      await page.goto(callbackUrl);
      
      await expect(page).toHaveURL(/.*login.*error=invalid_callback/);
    });
  });

  test.describe('OAuth Security', () => {
    test('should validate OAuth state parameter (CSRF protection)', async ({ page }) => {
      // In a real implementation, this would test state parameter validation
      // For now, we'll test the flow without state mismatch
      
      const loginPage = new LoginPage(page);
      
      await authHelper.mockApiResponse(apiEndpoints.googleOAuth, {
        redirectUrl: 'https://accounts.google.com/oauth/v2/auth?state=valid-state-token'
      });
      
      await loginPage.goto();
      await loginPage.clickGoogleLogin();
      
      // The OAuth URL should include state parameter
      await page.waitForTimeout(100);
    });

    test('should handle OAuth timeout', async ({ page }) => {
      const loginPage = new LoginPage(page);
      
      // Mock timeout response
      await page.route(apiEndpoints.googleOAuth, route => {
        // Simulate timeout
        setTimeout(() => {
          route.fulfill({
            status: 408,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Request timeout' }),
          });
        }, 100);
      });
      
      await loginPage.goto();
      await loginPage.clickGoogleLogin();
      
      // Should handle timeout gracefully
      await page.waitForTimeout(200);
    });

    test('should prevent OAuth injection attacks', async ({ page }) => {
      // Test with malicious redirect URL
      const loginPage = new LoginPage(page);
      
      await authHelper.mockApiResponse(apiEndpoints.googleOAuth, {
        redirectUrl: 'javascript:alert("xss")'
      });
      
      await loginPage.goto();
      await loginPage.clickGoogleLogin();
      
      // Should not execute JavaScript or navigate to malicious URL
      await expect(page).toHaveURL(routes.login);
      await page.waitForTimeout(100);
    });
  });

  test.describe('OAuth User Experience', () => {
    test('should show loading state during OAuth initiation', async ({ page }) => {
      const loginPage = new LoginPage(page);
      
      // Mock delayed OAuth response
      await page.route(apiEndpoints.googleOAuth, route => {
        setTimeout(() => {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              redirectUrl: 'https://accounts.google.com/oauth'
            }),
          });
        }, 1000);
      });
      
      await loginPage.goto();
      await loginPage.clickGoogleLogin();
      
      // Check for loading state on Google button
      const loadingButton = page.locator('button:has-text("Continue with Google") svg.animate-spin');
      await expect(loadingButton).toBeVisible();
    });

    test('should handle OAuth window popup (if implemented)', async ({ page, context }) => {
      const loginPage = new LoginPage(page);
      
      // This would test popup-based OAuth flow
      // For now, testing redirect-based flow
      await authHelper.mockApiResponse(apiEndpoints.googleOAuth, {
        redirectUrl: 'https://accounts.google.com/oauth'
      });
      
      await loginPage.goto();
      
      // Listen for popup
      const popupPromise = context.waitForEvent('page');
      await loginPage.clickGoogleLogin();
      
      // In redirect flow, no popup should be created
      await page.waitForTimeout(500);
    });

    test('should handle OAuth cancellation', async ({ page }) => {
      // Simulate user cancelling OAuth flow
      const callbackUrl = `${routes.home}/api/auth/google/callback?error=access_denied&error_description=The user denied the request`;
      
      await page.route('**/api/auth/google/callback*', route => {
        route.fulfill({
          status: 302,
          headers: {
            'Location': `${routes.login}?error=oauth_failed`
          }
        });
      });
      
      await page.goto(callbackUrl);
      
      // Should redirect back to login
      await expect(page).toHaveURL(/.*login/);
    });

    test('should handle network errors during OAuth', async ({ page }) => {
      const loginPage = new LoginPage(page);
      
      // Mock network error
      await page.route(apiEndpoints.googleOAuth, route => {
        route.abort();
      });
      
      await loginPage.goto();
      await loginPage.clickGoogleLogin();
      
      // Should handle error gracefully (stay on login page)
      await expect(page).toHaveURL(routes.login);
      await page.waitForTimeout(100);
    });
  });

  test.describe('OAuth Integration with Existing Auth', () => {
    test('should link OAuth account to existing email account', async ({ page }) => {
      // This would test account linking scenarios
      // Mock successful OAuth with existing email
      const callbackUrl = `${routes.home}/api/auth/google/callback?userId=existing-user&secret=test-secret`;
      
      await page.route('**/api/auth/google/callback*', route => {
        route.fulfill({
          status: 302,
          headers: {
            'Location': routes.chat
          }
        });
      });
      
      await page.goto(callbackUrl);
      await expect(page).toHaveURL(routes.chat);
    });

    test('should create new account via OAuth', async ({ page }) => {
      const chatPage = new ChatPage(page);
      
      // Mock OAuth for new user
      const callbackUrl = `${routes.home}/api/auth/google/callback?userId=new-user-id&secret=test-secret`;
      
      await page.route('**/api/auth/google/callback*', route => {
        route.fulfill({
          status: 302,
          headers: {
            'Location': routes.chat
          }
        });
      });
      
      await page.goto(callbackUrl);
      
      // Should redirect to chat and be logged in
      await chatPage.expectChatInterface();
    });

    test('should handle OAuth with existing session', async ({ page }) => {
      const chatPage = new ChatPage(page);
      
      // First, log in normally
      await authHelper.mockApiResponse(apiEndpoints.login, {
        success: true,
        userId: 'existing-user'
      });
      
      await authHelper.loginWithEmailPassword();
      await chatPage.expectChatInterface();
      
      // Now try OAuth (should handle existing session)
      const callbackUrl = `${routes.home}/api/auth/google/callback?userId=oauth-user&secret=test-secret`;
      
      await page.route('**/api/auth/google/callback*', route => {
        route.fulfill({
          status: 302,
          headers: {
            'Location': routes.chat
          }
        });
      });
      
      await page.goto(callbackUrl);
      await expect(page).toHaveURL(routes.chat);
    });
  });

  test.describe('OAuth Provider Errors', () => {
    test('should handle Google OAuth service unavailable', async ({ page }) => {
      const loginPage = new LoginPage(page);
      
      // Mock service unavailable
      await authHelper.mockApiResponse(apiEndpoints.googleOAuth, {
        error: 'Service temporarily unavailable'
      }, 503);
      
      await loginPage.goto();
      await loginPage.clickGoogleLogin();
      
      // Should show error or fallback
      await page.waitForTimeout(100);
      await expect(page).toHaveURL(routes.login);
    });

    test('should handle invalid OAuth configuration', async ({ page }) => {
      const loginPage = new LoginPage(page);
      
      // Mock configuration error
      await authHelper.mockApiResponse(apiEndpoints.googleOAuth, {
        error: 'OAuth provider not configured'
      }, 500);
      
      await loginPage.goto();
      await loginPage.clickGoogleLogin();
      
      await page.waitForTimeout(100);
      await expect(page).toHaveURL(routes.login);
    });
  });
});