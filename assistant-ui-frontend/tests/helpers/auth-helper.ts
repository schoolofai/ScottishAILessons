import { Page, expect } from '@playwright/test';
import { testUsers, routes, selectors } from './test-data';

export class AuthHelper {
  constructor(private page: Page) {}

  async clearAllCookies() {
    await this.page.context().clearCookies();
  }

  async loginWithEmailPassword(email: string = testUsers.validUser.email, password: string = testUsers.validUser.password) {
    await this.page.goto(routes.login);
    await this.page.fill(selectors.emailInput, email);
    await this.page.fill(selectors.passwordInput, password);
    await this.page.click(selectors.submitButton);
  }

  async signupWithEmailPassword(
    name: string = testUsers.validUser.name,
    email: string = testUsers.validUser.email,
    password: string = testUsers.validUser.password
  ) {
    await this.page.goto(routes.signup);
    await this.page.fill(selectors.nameInput, name);
    await this.page.fill(selectors.emailInput, email);
    await this.page.fill(selectors.passwordInput, password);
    await this.page.fill(selectors.confirmPasswordInput, password);
    await this.page.click(selectors.submitButton);
  }

  async logout() {
    // Mock logout API call
    await this.page.evaluate(() => {
      return fetch('/api/auth/logout', { method: 'POST' });
    });
    await this.clearAllCookies();
  }

  async expectToBeLoggedIn() {
    await expect(this.page).toHaveURL(routes.chat);
    // Check for session cookie
    const cookies = await this.page.context().cookies();
    const sessionCookie = cookies.find(cookie => cookie.name === 'appwrite-session');
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.httpOnly).toBe(true);
  }

  async expectToBeLoggedOut() {
    const cookies = await this.page.context().cookies();
    const sessionCookie = cookies.find(cookie => cookie.name === 'appwrite-session');
    expect(sessionCookie).toBeUndefined();
  }

  async expectRedirectToLogin() {
    await expect(this.page).toHaveURL(routes.login);
  }

  async expectErrorMessage(message?: string) {
    const errorElement = this.page.locator(selectors.errorMessage);
    await expect(errorElement).toBeVisible();
    if (message) {
      await expect(errorElement).toContainText(message);
    }
  }

  async expectSuccessMessage(message?: string) {
    const successElement = this.page.locator(selectors.successMessage);
    await expect(successElement).toBeVisible();
    if (message) {
      await expect(successElement).toContainText(message);
    }
  }

  async mockApiResponse(endpoint: string, response: any, status: number = 200) {
    await this.page.route(endpoint, route => {
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });
  }

  async interceptAuthRequests() {
    const requests: any[] = [];
    
    this.page.on('request', request => {
      if (request.url().includes('/api/auth/')) {
        requests.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
          postData: request.postData(),
        });
      }
    });

    return requests;
  }

  async generateUniqueEmail(): Promise<string> {
    const timestamp = Date.now();
    return `test-${timestamp}@example.com`;
  }

  async checkSessionCookieProperties() {
    const cookies = await this.page.context().cookies();
    const sessionCookie = cookies.find(cookie => cookie.name === 'appwrite-session');
    
    if (sessionCookie) {
      expect(sessionCookie.httpOnly).toBe(true);
      expect(sessionCookie.secure).toBe(process.env.NODE_ENV === 'production');
      expect(sessionCookie.sameSite).toBe('Strict');
    }
    
    return sessionCookie;
  }
}