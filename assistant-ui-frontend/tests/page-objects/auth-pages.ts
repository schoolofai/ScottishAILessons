import { Page, Locator, expect } from '@playwright/test';
import { routes, selectors } from '../helpers/test-data';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly googleButton: Locator;
  readonly forgotPasswordLink: Locator;
  readonly signupLink: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input[id="email"]');
    this.passwordInput = page.locator('input[id="password"]');
    this.loginButton = page.locator('button[type="submit"]');
    this.googleButton = page.locator('text=Continue with Google');
    this.forgotPasswordLink = page.locator('text=Forgot password?');
    this.signupLink = page.locator('text=Sign up');
    this.errorMessage = page.locator('.bg-red-50');
  }

  async goto() {
    await this.page.goto(routes.login);
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  async clickGoogleLogin() {
    await this.googleButton.click();
  }

  async clickForgotPassword() {
    await this.forgotPasswordLink.click();
  }

  async clickSignupLink() {
    await this.signupLink.click();
  }

  async expectLoginForm() {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.loginButton).toBeVisible();
    await expect(this.googleButton).toBeVisible();
    await expect(this.forgotPasswordLink).toBeVisible();
    await expect(this.signupLink).toBeVisible();
  }

  async expectErrorMessage(message?: string) {
    await expect(this.errorMessage).toBeVisible();
    if (message) {
      await expect(this.errorMessage).toContainText(message);
    }
  }
}

export class SignupPage {
  readonly page: Page;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly signupButton: Locator;
  readonly googleButton: Locator;
  readonly loginLink: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nameInput = page.locator('input[id="name"]');
    this.emailInput = page.locator('input[id="email"]');
    this.passwordInput = page.locator('input[id="password"]');
    this.confirmPasswordInput = page.locator('input[id="confirmPassword"]');
    this.signupButton = page.locator('button[type="submit"]');
    this.googleButton = page.locator('text=Continue with Google');
    this.loginLink = page.locator('text=Login');
    this.errorMessage = page.locator('.bg-red-50');
  }

  async goto() {
    await this.page.goto(routes.signup);
  }

  async signup(name: string, email: string, password: string, confirmPassword?: string) {
    await this.nameInput.fill(name);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(confirmPassword || password);
    await this.signupButton.click();
  }

  async clickGoogleSignup() {
    await this.googleButton.click();
  }

  async clickLoginLink() {
    await this.loginLink.click();
  }

  async expectSignupForm() {
    await expect(this.nameInput).toBeVisible();
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.confirmPasswordInput).toBeVisible();
    await expect(this.signupButton).toBeVisible();
    await expect(this.googleButton).toBeVisible();
    await expect(this.loginLink).toBeVisible();
  }

  async expectErrorMessage(message?: string) {
    await expect(this.errorMessage).toBeVisible();
    if (message) {
      await expect(this.errorMessage).toContainText(message);
    }
  }
}

export class ResetPasswordPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly newPasswordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly sendEmailButton: Locator;
  readonly resetPasswordButton: Locator;
  readonly backToLoginLink: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input[id="email"]');
    this.newPasswordInput = page.locator('input[id="newPassword"]');
    this.confirmPasswordInput = page.locator('input[id="confirmPassword"]');
    this.sendEmailButton = page.locator('text=Send Recovery Email');
    this.resetPasswordButton = page.locator('text=Reset Password');
    this.backToLoginLink = page.locator('text=Back to Login');
    this.errorMessage = page.locator('.bg-red-50');
    this.successMessage = page.locator('.bg-green-50');
  }

  async goto() {
    await this.page.goto(routes.resetPassword);
  }

  async requestPasswordReset(email: string) {
    await this.emailInput.fill(email);
    await this.sendEmailButton.click();
  }

  async resetPassword(newPassword: string, confirmPassword?: string) {
    await this.newPasswordInput.fill(newPassword);
    await this.confirmPasswordInput.fill(confirmPassword || newPassword);
    await this.resetPasswordButton.click();
  }

  async clickBackToLogin() {
    await this.backToLoginLink.click();
  }

  async expectRequestForm() {
    await expect(this.emailInput).toBeVisible();
    await expect(this.sendEmailButton).toBeVisible();
    await expect(this.backToLoginLink).toBeVisible();
  }

  async expectResetForm() {
    await expect(this.newPasswordInput).toBeVisible();
    await expect(this.confirmPasswordInput).toBeVisible();
    await expect(this.resetPasswordButton).toBeVisible();
  }

  async expectSuccessMessage(message?: string) {
    await expect(this.successMessage).toBeVisible();
    if (message) {
      await expect(this.successMessage).toContainText(message);
    }
  }

  async expectErrorMessage(message?: string) {
    await expect(this.errorMessage).toBeVisible();
    if (message) {
      await expect(this.errorMessage).toContainText(message);
    }
  }
}

export class ChatPage {
  readonly page: Page;
  readonly chatInterface: Locator;
  readonly logoutButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.chatInterface = page.locator('[data-testid="chat-interface"]');
    this.logoutButton = page.locator('text=Logout');
  }

  async goto() {
    await this.page.goto(routes.chat);
  }

  async expectChatInterface() {
    // Should be on chat page or have authentication working
    const url = this.page.url();
    expect(url.includes('/chat')).toBe(true);
    // The chat interface should be visible (MyAssistant component)
    const chatContainer = this.page.locator('main.h-dvh');
    await expect(chatContainer).toBeVisible();
  }

  async logout() {
    if (await this.logoutButton.isVisible()) {
      await this.logoutButton.click();
    }
  }
}