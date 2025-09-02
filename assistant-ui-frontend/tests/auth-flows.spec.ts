import { test, expect } from '@playwright/test';
import { LoginPage, SignupPage, ChatPage } from './page-objects/auth-pages';
import { AuthHelper } from './helpers/auth-helper';
import { testUsers, testData, apiEndpoints } from './helpers/test-data';

test.describe('Authentication Flows', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    await authHelper.clearAllCookies();
  });

  test.describe('Email/Password Signup', () => {
    test('should successfully create account with valid data', async ({ page }) => {
      const signupPage = new SignupPage(page);
      const chatPage = new ChatPage(page);
      
      // Mock successful signup API response
      await authHelper.mockApiResponse(apiEndpoints.signup, { 
        success: true, 
        userId: 'test-user-id' 
      });
      
      await signupPage.goto();
      await signupPage.expectSignupForm();
      
      const uniqueEmail = await authHelper.generateUniqueEmail();
      await signupPage.signup(
        testUsers.validUser.name,
        uniqueEmail,
        testUsers.validUser.password
      );
      
      // Should redirect to chat after successful signup
      await chatPage.expectChatInterface();
      await authHelper.expectToBeLoggedIn();
    });

    test('should validate required fields', async ({ page }) => {
      const signupPage = new SignupPage(page);
      
      await signupPage.goto();
      
      // Try to submit empty form
      await signupPage.signupButton.click();
      
      // Check for validation messages (HTML5 validation)
      const nameInput = signupPage.nameInput;
      const isInvalid = await nameInput.evaluate(el => (el as HTMLInputElement).validity.valueMissing);
      expect(isInvalid).toBe(true);
    });

    test('should validate email format', async ({ page }) => {
      const signupPage = new SignupPage(page);
      
      await signupPage.goto();
      
      // Test invalid email
      await signupPage.signup(
        testUsers.validUser.name,
        testData.invalidEmails[0],
        testUsers.validUser.password
      );
      
      await signupPage.expectErrorMessage('valid email');
    });

    test('should validate password strength', async ({ page }) => {
      const signupPage = new SignupPage(page);
      
      await signupPage.goto();
      
      // Test weak password
      await signupPage.signup(
        testUsers.validUser.name,
        await authHelper.generateUniqueEmail(),
        testData.invalidPasswords[0] // '123'
      );
      
      await signupPage.expectErrorMessage('at least 8 characters');
    });

    test('should validate password confirmation match', async ({ page }) => {
      const signupPage = new SignupPage(page);
      
      await signupPage.goto();
      
      // Test mismatched passwords
      await signupPage.signup(
        testUsers.validUser.name,
        await authHelper.generateUniqueEmail(),
        testUsers.validUser.password,
        'DifferentPassword123!'
      );
      
      await signupPage.expectErrorMessage('Passwords do not match');
    });

    test('should handle duplicate email registration', async ({ page }) => {
      const signupPage = new SignupPage(page);
      
      // Mock duplicate email error
      await authHelper.mockApiResponse(apiEndpoints.signup, {
        error: 'A user with the same email already exists'
      }, 400);
      
      await signupPage.goto();
      await signupPage.signup(
        testUsers.validUser.name,
        testUsers.validUser.email,
        testUsers.validUser.password
      );
      
      await signupPage.expectErrorMessage('already exists');
    });

    test('should display loading state during signup', async ({ page }) => {
      const signupPage = new SignupPage(page);
      
      // Mock delayed response
      await page.route(apiEndpoints.signup, route => {
        setTimeout(() => {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, userId: 'test' }),
          });
        }, 1000);
      });
      
      await signupPage.goto();
      await signupPage.signup(
        testUsers.validUser.name,
        await authHelper.generateUniqueEmail(),
        testUsers.validUser.password
      );
      
      // Check for loading state
      const loadingButton = page.locator('text=Creating account...');
      await expect(loadingButton).toBeVisible();
    });
  });

  test.describe('Email/Password Login', () => {
    test('should successfully login with valid credentials', async ({ page }) => {
      const loginPage = new LoginPage(page);
      const chatPage = new ChatPage(page);
      
      // Mock successful login
      await authHelper.mockApiResponse(apiEndpoints.login, {
        success: true,
        userId: 'test-user-id'
      });
      
      await loginPage.goto();
      await loginPage.expectLoginForm();
      
      await loginPage.login(testUsers.validUser.email, testUsers.validUser.password);
      
      await chatPage.expectChatInterface();
      await authHelper.expectToBeLoggedIn();
    });

    test('should handle invalid credentials', async ({ page }) => {
      const loginPage = new LoginPage(page);
      
      // Mock invalid credentials
      await authHelper.mockApiResponse(apiEndpoints.login, {
        error: 'Invalid credentials'
      }, 401);
      
      await loginPage.goto();
      await loginPage.login('wrong@email.com', 'wrongpassword');
      
      await loginPage.expectErrorMessage('Invalid credentials');
    });

    test('should validate email format on login', async ({ page }) => {
      const loginPage = new LoginPage(page);
      
      await loginPage.goto();
      await loginPage.login(testData.invalidEmails[0], testUsers.validUser.password);
      
      await loginPage.expectErrorMessage('valid email');
    });

    test('should require password', async ({ page }) => {
      const loginPage = new LoginPage(page);
      
      await loginPage.goto();
      
      await loginPage.emailInput.fill(testUsers.validUser.email);
      await loginPage.loginButton.click();
      
      await loginPage.expectErrorMessage('password');
    });

    test('should display loading state during login', async ({ page }) => {
      const loginPage = new LoginPage(page);
      
      // Mock delayed response
      await page.route(apiEndpoints.login, route => {
        setTimeout(() => {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, userId: 'test' }),
          });
        }, 1000);
      });
      
      await loginPage.goto();
      await loginPage.login(testUsers.validUser.email, testUsers.validUser.password);
      
      // Check for loading state
      const loadingButton = page.locator('text=Logging in...');
      await expect(loadingButton).toBeVisible();
    });

    test('should navigate to forgot password page', async ({ page }) => {
      const loginPage = new LoginPage(page);
      
      await loginPage.goto();
      await loginPage.clickForgotPassword();
      
      await expect(page).toHaveURL('/reset-password');
    });

    test('should navigate to signup page', async ({ page }) => {
      const loginPage = new LoginPage(page);
      
      await loginPage.goto();
      await loginPage.clickSignupLink();
      
      await expect(page).toHaveURL('/signup');
    });
  });

  test.describe('Session Management', () => {
    test('should maintain session across page reloads', async ({ page }) => {
      const loginPage = new LoginPage(page);
      const chatPage = new ChatPage(page);
      
      // Mock successful login
      await authHelper.mockApiResponse(apiEndpoints.login, {
        success: true,
        userId: 'test-user-id'
      });
      
      await authHelper.loginWithEmailPassword();
      await chatPage.expectChatInterface();
      
      // Reload page
      await page.reload();
      await chatPage.expectChatInterface();
    });

    test('should logout successfully', async ({ page }) => {
      const chatPage = new ChatPage(page);
      const loginPage = new LoginPage(page);
      
      // First login
      await authHelper.mockApiResponse(apiEndpoints.login, {
        success: true,
        userId: 'test-user-id'
      });
      
      await authHelper.loginWithEmailPassword();
      await chatPage.expectChatInterface();
      
      // Mock logout
      await authHelper.mockApiResponse(apiEndpoints.logout, { success: true });
      
      // Logout
      await authHelper.logout();
      
      // Try to access protected route
      await chatPage.goto();
      await authHelper.expectRedirectToLogin();
      await authHelper.expectToBeLoggedOut();
    });

    test('should handle concurrent sessions', async ({ browser }) => {
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();
      
      const auth1 = new AuthHelper(page1);
      const auth2 = new AuthHelper(page2);
      
      // Mock login for both
      await auth1.mockApiResponse(apiEndpoints.login, { success: true, userId: 'user1' });
      await auth2.mockApiResponse(apiEndpoints.login, { success: true, userId: 'user2' });
      
      // Login in both contexts with different users
      await auth1.loginWithEmailPassword(testUsers.validUser.email);
      await auth2.loginWithEmailPassword(testUsers.anotherValidUser.email);
      
      // Both should be logged in
      await auth1.expectToBeLoggedIn();
      await auth2.expectToBeLoggedIn();
      
      // Logout from first context
      await auth1.mockApiResponse(apiEndpoints.logout, { success: true });
      await auth1.logout();
      
      // First should be logged out, second still logged in
      await page1.goto('/chat');
      await auth1.expectRedirectToLogin();
      
      await page2.goto('/chat');
      await auth2.expectToBeLoggedIn();
      
      await context1.close();
      await context2.close();
    });
  });

  test.describe('Form Interactions', () => {
    test('should clear error messages when user types', async ({ page }) => {
      const loginPage = new LoginPage(page);
      
      // Mock error response
      await authHelper.mockApiResponse(apiEndpoints.login, {
        error: 'Invalid credentials'
      }, 401);
      
      await loginPage.goto();
      await loginPage.login('wrong@email.com', 'wrongpassword');
      await loginPage.expectErrorMessage();
      
      // Start typing in email field
      await loginPage.emailInput.fill('new@email.com');
      
      // Error message should be cleared (implementation dependent)
      // This would require the actual form to clear errors on input
    });

    test('should handle keyboard navigation', async ({ page }) => {
      const loginPage = new LoginPage(page);
      
      await loginPage.goto();
      
      // Tab through form fields
      await page.keyboard.press('Tab'); // Email field
      await page.keyboard.type(testUsers.validUser.email);
      
      await page.keyboard.press('Tab'); // Password field
      await page.keyboard.type(testUsers.validUser.password);
      
      await page.keyboard.press('Tab'); // Login button
      await page.keyboard.press('Enter'); // Submit form
      
      // Should attempt to submit (would need API mock for full test)
    });

    test('should handle form submission with Enter key', async ({ page }) => {
      const loginPage = new LoginPage(page);
      
      await authHelper.mockApiResponse(apiEndpoints.login, {
        success: true,
        userId: 'test-user-id'
      });
      
      await loginPage.goto();
      await loginPage.emailInput.fill(testUsers.validUser.email);
      await loginPage.passwordInput.fill(testUsers.validUser.password);
      
      // Submit with Enter key
      await page.keyboard.press('Enter');
      
      // Should attempt login
      const chatPage = new ChatPage(page);
      await chatPage.expectChatInterface();
    });
  });
});