import { test, expect } from '@playwright/test';
import { LandingPage } from './page-objects/landing-page';
import { routes } from './helpers/test-data';

test.describe('Landing Page', () => {
  let landingPage: LandingPage;

  test.beforeEach(async ({ page }) => {
    landingPage = new LandingPage(page);
    await landingPage.goto();
  });

  test('should load homepage correctly', async () => {
    await landingPage.expectPageLoaded();
    await expect(landingPage.page).toHaveTitle(/assistant-ui App/);
  });

  test('should display navigation elements', async () => {
    await landingPage.expectNavigation();
  });

  test('should display hero section with correct content', async () => {
    await landingPage.expectHeroContent();
  });

  test('should display features section', async () => {
    await landingPage.expectFeaturesSection();
  });

  test('should have responsive design', async () => {
    await landingPage.expectResponsiveDesign();
  });

  test('should navigate to login page when login button clicked', async () => {
    await landingPage.clickLogin();
    await expect(landingPage.page).toHaveURL(routes.login);
  });

  test('should navigate to signup page when signup button clicked', async () => {
    await landingPage.clickSignup();
    await expect(landingPage.page).toHaveURL(routes.signup);
  });

  test('should navigate to home when logo clicked', async () => {
    await landingPage.clickLogin(); // Navigate away first
    await landingPage.clickLogo();
    await expect(landingPage.page).toHaveURL(routes.home);
  });

  test('should have proper SEO elements', async () => {
    // Check meta tags
    const title = await landingPage.page.locator('title').textContent();
    expect(title).toContain('assistant-ui App');
    
    const description = await landingPage.page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toBeTruthy();
  });

  test('should have accessible navigation', async ({ page }) => {
    // Test keyboard navigation
    await page.keyboard.press('Tab'); // Should focus on first interactive element
    await page.keyboard.press('Enter');
    
    // Should navigate somewhere (login or signup)
    await expect(page).not.toHaveURL(routes.home);
  });

  test('should display footer with copyright', async () => {
    await expect(landingPage.footer).toBeVisible();
    await expect(landingPage.footer).toContainText('© 2024 Scottish AI Lessons');
  });

  test('hero CTA buttons should work', async ({ page }) => {
    // Test "Get Started Free" button in hero
    const getStartedButton = page.locator('text=Get Started Free').first();
    await getStartedButton.click();
    await expect(page).toHaveURL(routes.signup);
    
    await landingPage.goto();
    
    // Test "Login to Your Account" button in hero  
    const loginButton = page.locator('text=Login to Your Account').first();
    await loginButton.click();
    await expect(page).toHaveURL(routes.login);
  });

  test('should display brand features correctly', async ({ page }) => {
    // Check for specific brand features
    const features = [
      '24/7 Available',
      'Adaptive Learning',
      'Personalized Experience'
    ];
    
    for (const feature of features) {
      await expect(page.locator(`text=${feature}`)).toBeVisible();
    }
  });

  test('should handle page load performance', async ({ page }) => {
    const startTime = Date.now();
    await landingPage.goto();
    await landingPage.expectPageLoaded();
    const loadTime = Date.now() - startTime;
    
    // Landing page should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });
});