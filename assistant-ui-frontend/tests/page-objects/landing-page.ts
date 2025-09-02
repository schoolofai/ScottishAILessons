import { Page, Locator, expect } from '@playwright/test';
import { routes, selectors } from '../helpers/test-data';

export class LandingPage {
  readonly page: Page;
  readonly navbar: Locator;
  readonly logo: Locator;
  readonly loginButton: Locator;
  readonly signupButton: Locator;
  readonly heroSection: Locator;
  readonly featuresSection: Locator;
  readonly footer: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = page.locator('nav');
    this.logo = page.locator('a').filter({ hasText: 'Scottish AI Lessons' });
    this.loginButton = page.locator(selectors.loginButton);
    this.signupButton = page.locator(selectors.signupButton);
    this.heroSection = page.locator('section').first();
    this.featuresSection = page.locator('section').nth(1);
    this.footer = page.locator('footer');
  }

  async goto() {
    await this.page.goto(routes.home);
  }

  async clickLogin() {
    await this.loginButton.click();
  }

  async clickSignup() {
    await this.signupButton.click();
  }

  async clickLogo() {
    await this.logo.click();
  }

  async expectPageLoaded() {
    await expect(this.navbar).toBeVisible();
    await expect(this.heroSection).toBeVisible();
    await expect(this.featuresSection).toBeVisible();
    await expect(this.footer).toBeVisible();
  }

  async expectHeroContent() {
    await expect(this.heroSection).toContainText('Enhance Your Learning Journey');
    await expect(this.heroSection).toContainText('AI-Powered Learning Platform');
    
    // Check for CTA buttons
    const getStartedButton = this.heroSection.locator('text=Get Started Free');
    const loginToAccountButton = this.heroSection.locator('text=Login to Your Account');
    
    await expect(getStartedButton).toBeVisible();
    await expect(loginToAccountButton).toBeVisible();
  }

  async expectFeaturesSection() {
    await expect(this.featuresSection).toContainText('Why Choose Our Platform?');
    
    // Check for feature cards
    const featureCards = this.featuresSection.locator('.bg-white');
    await expect(featureCards).toHaveCount(6);
    
    // Verify specific features
    await expect(this.featuresSection).toContainText('Interactive Chat');
    await expect(this.featuresSection).toContainText('Comprehensive Knowledge');
    await expect(this.featuresSection).toContainText('Track Progress');
    await expect(this.featuresSection).toContainText('Student & Teacher Modes');
    await expect(this.featuresSection).toContainText('Secure & Private');
    await expect(this.featuresSection).toContainText('Learn Anytime');
  }

  async expectNavigation() {
    await expect(this.logo).toBeVisible();
    await expect(this.loginButton).toBeVisible();
    await expect(this.signupButton).toBeVisible();
  }

  async expectResponsiveDesign() {
    // Test mobile viewport
    await this.page.setViewportSize({ width: 375, height: 667 });
    await expect(this.navbar).toBeVisible();
    await expect(this.heroSection).toBeVisible();
    
    // Test desktop viewport
    await this.page.setViewportSize({ width: 1920, height: 1080 });
    await expect(this.navbar).toBeVisible();
    await expect(this.heroSection).toBeVisible();
  }

  async testAllLinks() {
    // Test logo link
    await this.clickLogo();
    await expect(this.page).toHaveURL(routes.home);
    
    // Test login button
    await this.clickLogin();
    await expect(this.page).toHaveURL(routes.login);
    
    await this.goto();
    
    // Test signup button
    await this.clickSignup();
    await expect(this.page).toHaveURL(routes.signup);
  }
}