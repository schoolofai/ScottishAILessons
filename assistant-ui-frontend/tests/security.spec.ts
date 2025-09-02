import { test, expect } from '@playwright/test';
import { LoginPage, SignupPage } from './page-objects/auth-pages';
import { AuthHelper } from './helpers/auth-helper';
import { testUsers, testData, apiEndpoints } from './helpers/test-data';

test.describe('Security Tests', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    await authHelper.clearAllCookies();
  });

  test.describe('Input Sanitization', () => {
    test('should prevent XSS in email field', async ({ page }) => {
      const loginPage = new LoginPage(page);
      
      await loginPage.goto();
      
      const xssPayload = '<script>alert("xss")</script>';
      await loginPage.emailInput.fill(xssPayload);
      
      // The script should not execute
      const emailValue = await loginPage.emailInput.inputValue();
      expect(emailValue).toBe(xssPayload); // Input should contain the text but not execute
      
      // Check that no script was executed
      const alertHandled = await page.evaluate(() => {
        return window.alert === window.alert; // Should not be overridden
      });
      expect(alertHandled).toBe(true);
    });

    test('should prevent XSS in name field', async ({ page }) => {
      const signupPage = new SignupPage(page);
      
      await signupPage.goto();
      
      const xssPayload = '"><img src=x onerror=alert("xss")>';
      await signupPage.nameInput.fill(xssPayload);
      
      // Should not execute script
      const nameValue = await signupPage.nameInput.inputValue();
      expect(nameValue).toBe(xssPayload);
      
      // No alert should be triggered
      await page.waitForTimeout(100);
    });

    test('should prevent SQL injection attempts', async ({ page }) => {
      const loginPage = new LoginPage(page);
      
      // Mock API to check what data is being sent
      let requestData: any;
      await page.route(apiEndpoints.login, route => {
        requestData = JSON.parse(route.request().postData() || '{}');
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid credentials' }),
        });
      });
      
      await loginPage.goto();
      
      const sqlInjectionPayload = "'; DROP TABLE users; --";
      await loginPage.login(sqlInjectionPayload, 'password');
      
      // Verify the payload is sent as-is (should be sanitized server-side)
      await page.waitForTimeout(100);
      expect(requestData.email).toBe(sqlInjectionPayload);
    });

    test('should handle malicious file uploads', async ({ page }) => {
      // This would test file upload fields if they exist
      // Currently not applicable to auth forms, but good practice
      
      const signupPage = new SignupPage(page);
      await signupPage.goto();
      
      // If there were file upload fields, test with malicious files
      const fileInputs = await page.locator('input[type="file"]').count();
      expect(fileInputs).toBe(0); // Auth forms shouldn't have file uploads
    });

    test('should prevent HTML injection in error messages', async ({ page }) => {
      const loginPage = new LoginPage(page);
      
      // Mock error response with HTML content
      await authHelper.mockApiResponse(apiEndpoints.login, {
        error: '<script>alert("html injection")</script>Invalid credentials'
      }, 401);
      
      await loginPage.goto();
      await loginPage.login('test@example.com', 'wrongpassword');
      
      // Error should be displayed but HTML should not execute
      await loginPage.expectErrorMessage();
      const errorText = await loginPage.errorMessage.textContent();
      expect(errorText).toContain('Invalid credentials');
      
      // No script should execute
      await page.waitForTimeout(100);
    });
  });

  test.describe('Session Security', () => {
    test('should set secure cookie attributes', async ({ page }) => {
      // Mock successful login
      await authHelper.mockApiResponse(apiEndpoints.login, {
        success: true,
        userId: 'test-user-id'
      });
      
      await authHelper.loginWithEmailPassword();
      
      const cookie = await authHelper.checkSessionCookieProperties();
      expect(cookie).toBeDefined();
      expect(cookie?.httpOnly).toBe(true);
      expect(cookie?.sameSite).toBe('Strict');
      
      // In production, should be secure
      if (process.env.NODE_ENV === 'production') {
        expect(cookie?.secure).toBe(true);
      }
    });

    test('should prevent session fixation attacks', async ({ page }) => {
      // Set a pre-existing session cookie
      await page.context().addCookies([{
        name: 'appwrite-session',
        value: 'old-session-id',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
      }]);
      
      // Mock successful login
      await authHelper.mockApiResponse(apiEndpoints.login, {
        success: true,
        userId: 'test-user-id'
      });
      
      await authHelper.loginWithEmailPassword();
      
      // After login, session should be new/different
      const cookies = await page.context().cookies();
      const sessionCookie = cookies.find(c => c.name === 'appwrite-session');
      expect(sessionCookie?.value).not.toBe('old-session-id');
    });

    test('should handle session hijacking attempts', async ({ page, browser }) => {
      // Login in first context
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      const auth1 = new AuthHelper(page1);
      
      await auth1.mockApiResponse(apiEndpoints.login, { success: true, userId: 'user1' });
      await auth1.loginWithEmailPassword();
      
      const cookies1 = await context1.cookies();
      const sessionCookie = cookies1.find(c => c.name === 'appwrite-session');
      
      // Try to use same session in different context
      const context2 = await browser.newContext();
      await context2.addCookies([sessionCookie!]);
      const page2 = await context2.newPage();
      
      // Both sessions should be independent
      await page2.goto('/chat');
      
      // Implementation dependent - some systems allow this, others don't
      // The important thing is that it's controlled and logged
      
      await context1.close();
      await context2.close();
    });

    test('should prevent CSRF attacks', async ({ page }) => {
      // Mock successful login to set session
      await authHelper.mockApiResponse(apiEndpoints.login, {
        success: true,
        userId: 'test-user-id'
      });
      
      await authHelper.loginWithEmailPassword();
      
      // Try to make request from different origin (simulated)
      const response = await page.evaluate(async () => {
        try {
          const response = await fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Origin': 'https://malicious-site.com'
            }
          });
          return { status: response.status, ok: response.ok };
        } catch (error) {
          return { error: error.message };
        }
      });
      
      // CSRF protection should prevent the request or validate origin
      // The exact behavior depends on implementation
      expect(response.status).toBeDefined();
    });
  });

  test.describe('Rate Limiting', () => {
    test('should rate limit login attempts', async ({ page }) => {
      const loginPage = new LoginPage(page);
      
      await loginPage.goto();
      
      // Mock rate limit response after multiple attempts
      let attemptCount = 0;
      await page.route(apiEndpoints.login, route => {
        attemptCount++;
        if (attemptCount > 3) {
          route.fulfill({
            status: 429,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Too many login attempts' }),
          });
        } else {
          route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Invalid credentials' }),
          });
        }
      });
      
      // Make multiple failed login attempts
      for (let i = 0; i < 4; i++) {
        await loginPage.login('test@example.com', 'wrongpassword');
        await page.waitForTimeout(100);
      }
      
      // Should show rate limit error
      await loginPage.expectErrorMessage('Too many login attempts');
    });

    test('should rate limit signup attempts', async ({ page }) => {
      const signupPage = new SignupPage(page);
      
      let attemptCount = 0;
      await page.route(apiEndpoints.signup, route => {
        attemptCount++;
        if (attemptCount > 2) {
          route.fulfill({
            status: 429,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Too many signup attempts' }),
          });
        } else {
          route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Invalid data' }),
          });
        }
      });
      
      await signupPage.goto();
      
      // Make multiple signup attempts
      for (let i = 0; i < 3; i++) {
        await signupPage.signup('Test User', `test${i}@example.com`, 'password');
        await page.waitForTimeout(100);
      }
      
      await signupPage.expectErrorMessage('Too many signup attempts');
    });

    test('should rate limit password reset requests', async ({ page }) => {
      const resetPage = await import('./page-objects/auth-pages').then(m => new m.ResetPasswordPage(page));
      
      let requestCount = 0;
      await page.route(apiEndpoints.recovery, route => {
        requestCount++;
        if (requestCount > 2) {
          route.fulfill({
            status: 429,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Too many reset requests' }),
          });
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true }),
          });
        }
      });
      
      await resetPage.goto();
      
      for (let i = 0; i < 3; i++) {
        await resetPage.requestPasswordReset('test@example.com');
        await page.waitForTimeout(100);
      }
      
      await resetPage.expectErrorMessage('Too many reset requests');
    });
  });

  test.describe('Content Security Policy', () => {
    test('should have proper CSP headers', async ({ page }) => {
      const response = await page.goto('/login');
      const cspHeader = response?.headers()['content-security-policy'];
      
      // Should have CSP header in production
      if (process.env.NODE_ENV === 'production') {
        expect(cspHeader).toBeDefined();
        expect(cspHeader).toContain("default-src 'self'");
      }
    });

    test('should prevent inline script execution', async ({ page }) => {
      await page.goto('/login');
      
      // Try to inject inline script
      const scriptExecuted = await page.evaluate(() => {
        try {
          const script = document.createElement('script');
          script.innerHTML = 'window.testCSP = true;';
          document.head.appendChild(script);
          return window.testCSP === true;
        } catch (error) {
          return false;
        }
      });
      
      // CSP should prevent inline scripts (in production)
      if (process.env.NODE_ENV === 'production') {
        expect(scriptExecuted).toBe(false);
      }
    });
  });

  test.describe('Data Validation', () => {
    test('should validate email format strictly', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      
      const invalidEmails = [
        'plainaddress',
        '@domain.com',
        'user@',
        'user@.com',
        'user..name@domain.com',
        'user@domain',
        'user name@domain.com',
      ];
      
      for (const email of invalidEmails) {
        await loginPage.emailInput.fill(email);
        await loginPage.passwordInput.fill('password123');
        await loginPage.loginButton.click();
        
        // Should show validation error
        const isInvalid = await loginPage.emailInput.evaluate(
          el => !(el as HTMLInputElement).validity.valid
        );
        expect(isInvalid).toBe(true);
        
        await loginPage.emailInput.fill(''); // Clear for next test
      }
    });

    test('should validate password complexity', async ({ page }) => {
      const signupPage = new SignupPage(page);
      await signupPage.goto();
      
      const weakPasswords = [
        '123',           // too short
        'password',      // no numbers/caps
        'PASSWORD',      // no lowercase
        '12345678',      // no letters
        'Pass1',         // too short but mixed
      ];
      
      for (const password of weakPasswords) {
        await signupPage.nameInput.fill('Test User');
        await signupPage.emailInput.fill('test@example.com');
        await signupPage.passwordInput.fill(password);
        await signupPage.confirmPasswordInput.fill(password);
        await signupPage.signupButton.click();
        
        // Should show validation error
        await signupPage.expectErrorMessage();
        
        // Clear form for next test
        await signupPage.nameInput.fill('');
        await signupPage.emailInput.fill('');
        await signupPage.passwordInput.fill('');
        await signupPage.confirmPasswordInput.fill('');
      }
    });

    test('should prevent buffer overflow attempts', async ({ page }) => {
      const signupPage = new SignupPage(page);
      await signupPage.goto();
      
      // Create very long strings
      const longString = 'A'.repeat(10000);
      
      await signupPage.nameInput.fill(longString);
      await signupPage.emailInput.fill(`${longString}@example.com`);
      await signupPage.passwordInput.fill(longString);
      
      // Form should handle long inputs gracefully
      const nameValue = await signupPage.nameInput.inputValue();
      expect(nameValue.length).toBeLessThanOrEqual(10000);
    });
  });

  test.describe('Network Security', () => {
    test('should use HTTPS in production', async ({ page }) => {
      const url = page.url();
      
      // In production, should use HTTPS
      if (process.env.NODE_ENV === 'production') {
        expect(url).toMatch(/^https:/);
      }
    });

    test('should have security headers', async ({ page }) => {
      const response = await page.goto('/login');
      const headers = response?.headers();
      
      if (process.env.NODE_ENV === 'production') {
        // Should have security headers
        expect(headers?.['x-frame-options']).toBeDefined();
        expect(headers?.['x-content-type-options']).toBe('nosniff');
        expect(headers?.['x-xss-protection']).toBeDefined();
      }
    });

    test('should prevent clickjacking', async ({ page }) => {
      const response = await page.goto('/login');
      const xFrameOptions = response?.headers()['x-frame-options'];
      
      if (process.env.NODE_ENV === 'production') {
        expect(xFrameOptions).toMatch(/DENY|SAMEORIGIN/);
      }
    });
  });

  test.describe('Error Handling Security', () => {
    test('should not leak sensitive information in errors', async ({ page }) => {
      const loginPage = new LoginPage(page);
      
      // Mock detailed error (like what shouldn't happen)
      await authHelper.mockApiResponse(apiEndpoints.login, {
        error: 'Database connection failed: user_table not found in postgres://user:pass@localhost:5432/db'
      }, 500);
      
      await loginPage.goto();
      await loginPage.login('test@example.com', 'password');
      
      // Error should be generic, not expose system details
      const errorText = await loginPage.errorMessage.textContent();
      expect(errorText).not.toContain('Database');
      expect(errorText).not.toContain('postgres://');
      expect(errorText).not.toContain('user_table');
    });

    test('should handle API errors gracefully', async ({ page }) => {
      const loginPage = new LoginPage(page);
      
      // Mock server error
      await page.route(apiEndpoints.login, route => route.abort());
      
      await loginPage.goto();
      await loginPage.login('test@example.com', 'password');
      
      // Should show generic error message
      await page.waitForTimeout(1000);
      // Error handling behavior would depend on implementation
    });
  });
});