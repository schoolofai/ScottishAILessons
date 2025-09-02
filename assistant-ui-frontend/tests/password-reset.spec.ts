import { test, expect } from '@playwright/test';
import { ResetPasswordPage, LoginPage } from './page-objects/auth-pages';
import { AuthHelper } from './helpers/auth-helper';
import { testUsers, testData, apiEndpoints, routes } from './helpers/test-data';

test.describe('Password Reset Flow', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    await authHelper.clearAllCookies();
  });

  test.describe('Password Reset Request', () => {
    test('should send recovery email for valid email', async ({ page }) => {
      const resetPage = new ResetPasswordPage(page);
      
      // Mock successful recovery request
      await authHelper.mockApiResponse(apiEndpoints.recovery, {
        success: true,
        message: 'Recovery email sent'
      });
      
      await resetPage.goto();
      await resetPage.expectRequestForm();
      
      await resetPage.requestPasswordReset(testUsers.validUser.email);
      
      await resetPage.expectSuccessMessage('Recovery email sent');
    });

    test('should validate email format for reset request', async ({ page }) => {
      const resetPage = new ResetPasswordPage(page);
      
      await resetPage.goto();
      
      // Try with invalid email
      await resetPage.requestPasswordReset(testData.invalidEmails[0]);
      
      await resetPage.expectErrorMessage('valid email');
    });

    test('should handle non-existent email gracefully', async ({ page }) => {
      const resetPage = new ResetPasswordPage(page);
      
      // Mock response for non-existent email
      await authHelper.mockApiResponse(apiEndpoints.recovery, {
        error: 'User not found'
      }, 404);
      
      await resetPage.goto();
      await resetPage.requestPasswordReset('nonexistent@example.com');
      
      // Should show appropriate error message
      await resetPage.expectErrorMessage('User not found');
    });

    test('should show loading state during recovery request', async ({ page }) => {
      const resetPage = new ResetPasswordPage(page);
      
      // Mock delayed response
      await page.route(apiEndpoints.recovery, route => {
        setTimeout(() => {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, message: 'Email sent' }),
          });
        }, 1000);
      });
      
      await resetPage.goto();
      await resetPage.requestPasswordReset(testUsers.validUser.email);
      
      // Check for loading state
      const loadingButton = page.locator('text=Sending...');
      await expect(loadingButton).toBeVisible();
    });

    test('should navigate back to login from reset request', async ({ page }) => {
      const resetPage = new ResetPasswordPage(page);
      
      await resetPage.goto();
      await resetPage.clickBackToLogin();
      
      await expect(page).toHaveURL(routes.login);
    });

    test('should clear form after successful request', async ({ page }) => {
      const resetPage = new ResetPasswordPage(page);
      
      await authHelper.mockApiResponse(apiEndpoints.recovery, {
        success: true,
        message: 'Recovery email sent'
      });
      
      await resetPage.goto();
      await resetPage.requestPasswordReset(testUsers.validUser.email);
      
      await resetPage.expectSuccessMessage();
      
      // Email field should be cleared
      const emailValue = await resetPage.emailInput.inputValue();
      expect(emailValue).toBe('');
    });
  });

  test.describe('Password Reset Confirmation', () => {
    test('should reset password with valid token', async ({ page }) => {
      const resetPage = new ResetPasswordPage(page);
      
      // Mock successful reset confirmation
      await authHelper.mockApiResponse(`${apiEndpoints.recovery}/confirm`, {
        success: true,
        message: 'Password reset successful'
      });
      
      // Navigate to reset page with tokens (simulating email link click)
      await page.goto(`${routes.resetPassword}?userId=test-user-id&secret=test-secret`);
      
      await resetPage.expectResetForm();
      
      const newPassword = 'NewPassword123!';
      await resetPage.resetPassword(newPassword);
      
      await resetPage.expectSuccessMessage('Password reset successful');
    });

    test('should validate new password strength', async ({ page }) => {
      const resetPage = new ResetPasswordPage(page);
      
      await page.goto(`${routes.resetPassword}?userId=test-user-id&secret=test-secret`);
      await resetPage.expectResetForm();
      
      // Try weak password
      await resetPage.resetPassword(testData.invalidPasswords[0]); // '123'
      
      await resetPage.expectErrorMessage('at least 8 characters');
    });

    test('should validate password confirmation match', async ({ page }) => {
      const resetPage = new ResetPasswordPage(page);
      
      await page.goto(`${routes.resetPassword}?userId=test-user-id&secret=test-secret`);
      await resetPage.expectResetForm();
      
      // Try mismatched passwords
      await resetPage.resetPassword('NewPassword123!', 'DifferentPassword456!');
      
      await resetPage.expectErrorMessage('Passwords do not match');
    });

    test('should handle invalid reset token', async ({ page }) => {
      const resetPage = new ResetPasswordPage(page);
      
      // Mock invalid token response
      await authHelper.mockApiResponse(`${apiEndpoints.recovery}/confirm`, {
        error: 'Invalid or expired reset token'
      }, 400);
      
      await page.goto(`${routes.resetPassword}?userId=test-user-id&secret=invalid-secret`);
      await resetPage.expectResetForm();
      
      await resetPage.resetPassword('NewPassword123!');
      
      await resetPage.expectErrorMessage('Invalid or expired');
    });

    test('should handle expired reset token', async ({ page }) => {
      const resetPage = new ResetPasswordPage(page);
      
      // Mock expired token response
      await authHelper.mockApiResponse(`${apiEndpoints.recovery}/confirm`, {
        error: 'Reset token has expired'
      }, 400);
      
      await page.goto(`${routes.resetPassword}?userId=test-user-id&secret=expired-secret`);
      await resetPage.expectResetForm();
      
      await resetPage.resetPassword('NewPassword123!');
      
      await resetPage.expectErrorMessage('expired');
    });

    test('should redirect to login after successful reset', async ({ page }) => {
      const resetPage = new ResetPasswordPage(page);
      
      // Mock successful reset with redirect
      await authHelper.mockApiResponse(`${apiEndpoints.recovery}/confirm`, {
        success: true,
        message: 'Password reset successful'
      });
      
      await page.goto(`${routes.resetPassword}?userId=test-user-id&secret=test-secret`);
      await resetPage.resetPassword('NewPassword123!');
      
      await resetPage.expectSuccessMessage();
      
      // Should redirect to login after a delay
      await expect(page).toHaveURL(routes.login, { timeout: 3000 });
    });

    test('should show loading state during password reset', async ({ page }) => {
      const resetPage = new ResetPasswordPage(page);
      
      // Mock delayed response
      await page.route(`${apiEndpoints.recovery}/confirm`, route => {
        setTimeout(() => {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true }),
          });
        }, 1000);
      });
      
      await page.goto(`${routes.resetPassword}?userId=test-user-id&secret=test-secret`);
      await resetPage.resetPassword('NewPassword123!');
      
      // Check for loading state
      const loadingButton = page.locator('text=Resetting password...');
      await expect(loadingButton).toBeVisible();
    });
  });

  test.describe('End-to-End Reset Flow', () => {
    test('should complete full password reset journey', async ({ page }) => {
      const resetPage = new ResetPasswordPage(page);
      const loginPage = new LoginPage(page);
      
      // Step 1: Request password reset
      await authHelper.mockApiResponse(apiEndpoints.recovery, {
        success: true,
        message: 'Recovery email sent'
      });
      
      await resetPage.goto();
      await resetPage.requestPasswordReset(testUsers.validUser.email);
      await resetPage.expectSuccessMessage();
      
      // Step 2: Simulate clicking email link (with tokens)
      await page.goto(`${routes.resetPassword}?userId=test-user-id&secret=test-secret`);
      await resetPage.expectResetForm();
      
      // Step 3: Reset password
      await authHelper.mockApiResponse(`${apiEndpoints.recovery}/confirm`, {
        success: true,
        message: 'Password reset successful'
      });
      
      const newPassword = 'NewSecurePassword123!';
      await resetPage.resetPassword(newPassword);
      await resetPage.expectSuccessMessage();
      
      // Step 4: Redirect to login and test new password
      await expect(page).toHaveURL(routes.login, { timeout: 3000 });
      
      await authHelper.mockApiResponse(apiEndpoints.login, {
        success: true,
        userId: 'test-user-id'
      });
      
      await loginPage.login(testUsers.validUser.email, newPassword);
      
      // Should successfully login with new password
      await authHelper.expectToBeLoggedIn();
    });

    test('should prevent reset token reuse', async ({ page }) => {
      const resetPage = new ResetPasswordPage(page);
      
      // First use of token - successful
      await authHelper.mockApiResponse(`${apiEndpoints.recovery}/confirm`, {
        success: true,
        message: 'Password reset successful'
      });
      
      await page.goto(`${routes.resetPassword}?userId=test-user-id&secret=test-secret`);
      await resetPage.resetPassword('NewPassword123!');
      await resetPage.expectSuccessMessage();
      
      // Second use of same token - should fail
      await authHelper.mockApiResponse(`${apiEndpoints.recovery}/confirm`, {
        error: 'Reset token has already been used'
      }, 400);
      
      await page.goto(`${routes.resetPassword}?userId=test-user-id&secret=test-secret`);
      await resetPage.resetPassword('AnotherPassword456!');
      await resetPage.expectErrorMessage('already been used');
    });
  });

  test.describe('Security Considerations', () => {
    test('should handle missing reset parameters', async ({ page }) => {
      // Try to access reset form without parameters
      await page.goto(routes.resetPassword);
      
      // Should show email request form instead of reset form
      const resetPage = new ResetPasswordPage(page);
      await resetPage.expectRequestForm();
    });

    test('should handle malformed reset parameters', async ({ page }) => {
      // Try with malformed parameters
      await page.goto(`${routes.resetPassword}?userId=&secret=`);
      
      const resetPage = new ResetPasswordPage(page);
      await resetPage.expectRequestForm();
    });

    test('should rate limit reset requests', async ({ page }) => {
      const resetPage = new ResetPasswordPage(page);
      
      // Mock rate limit response
      await authHelper.mockApiResponse(apiEndpoints.recovery, {
        error: 'Too many reset requests. Please try again later.'
      }, 429);
      
      await resetPage.goto();
      await resetPage.requestPasswordReset(testUsers.validUser.email);
      
      await resetPage.expectErrorMessage('Too many reset requests');
    });

    test('should handle concurrent reset attempts', async ({ browser }) => {
      const contexts = await Promise.all([
        browser.newContext(),
        browser.newContext(),
      ]);
      
      const pages = await Promise.all(
        contexts.map(context => context.newPage())
      );
      
      const resetPages = pages.map(page => new ResetPasswordPage(page));
      
      // Mock different responses for concurrent requests
      for (let i = 0; i < pages.length; i++) {
        const authHelper = new AuthHelper(pages[i]);
        await authHelper.mockApiResponse(`${apiEndpoints.recovery}/confirm`, {
          error: i === 0 ? 'Token already used' : 'Invalid token'
        }, 400);
      }
      
      // Try to reset with same token concurrently
      await Promise.all([
        pages[0].goto(`${routes.resetPassword}?userId=test-user-id&secret=test-secret`),
        pages[1].goto(`${routes.resetPassword}?userId=test-user-id&secret=test-secret`)
      ]);
      
      await Promise.all([
        resetPages[0].resetPassword('Password1!'),
        resetPages[1].resetPassword('Password2!')
      ]);
      
      // Both should show appropriate error messages
      await Promise.all([
        resetPages[0].expectErrorMessage(),
        resetPages[1].expectErrorMessage()
      ]);
      
      // Cleanup
      await Promise.all(contexts.map(context => context.close()));
    });

    test('should clear sensitive data from form', async ({ page }) => {
      const resetPage = new ResetPasswordPage(page);
      
      await page.goto(`${routes.resetPassword}?userId=test-user-id&secret=test-secret`);
      await resetPage.expectResetForm();
      
      // Fill password fields
      await resetPage.newPasswordInput.fill('TestPassword123!');
      await resetPage.confirmPasswordInput.fill('TestPassword123!');
      
      // Navigate away
      await page.goto(routes.home);
      
      // Navigate back
      await page.goto(`${routes.resetPassword}?userId=test-user-id&secret=test-secret`);
      
      // Password fields should be empty
      const newPasswordValue = await resetPage.newPasswordInput.inputValue();
      const confirmPasswordValue = await resetPage.confirmPasswordInput.inputValue();
      
      expect(newPasswordValue).toBe('');
      expect(confirmPasswordValue).toBe('');
    });
  });

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async ({ page }) => {
      const resetPage = new ResetPasswordPage(page);
      
      await resetPage.goto();
      
      // Tab through form elements
      await page.keyboard.press('Tab'); // Email field
      await page.keyboard.type(testUsers.validUser.email);
      
      await page.keyboard.press('Tab'); // Send email button
      await page.keyboard.press('Enter'); // Submit
      
      await page.waitForTimeout(100);
    });

    test('should have proper ARIA labels', async ({ page }) => {
      const resetPage = new ResetPasswordPage(page);
      
      await resetPage.goto();
      
      // Check for accessibility attributes
      const emailInput = resetPage.emailInput;
      const hasLabel = await emailInput.evaluate(el => {
        return el.getAttribute('aria-label') !== null || 
               document.querySelector(`label[for="${el.id}"]`) !== null;
      });
      
      expect(hasLabel).toBe(true);
    });

    test('should announce form errors to screen readers', async ({ page }) => {
      const resetPage = new ResetPasswordPage(page);
      
      await resetPage.goto();
      await resetPage.requestPasswordReset(testData.invalidEmails[0]);
      
      const errorMessage = resetPage.errorMessage;
      const hasAriaLive = await errorMessage.evaluate(el => {
        return el.getAttribute('aria-live') !== null || 
               el.getAttribute('role') === 'alert';
      });
      
      // Error messages should be announced to screen readers
      expect(hasAriaLive).toBe(true);
    });
  });
});