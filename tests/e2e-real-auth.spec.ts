import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

// Generate unique test data for each test run
const generateTestUser = () => {
  const uniqueId = uuidv4().substring(0, 8);
  return {
    name: `E2E Test User ${uniqueId}`,
    email: `e2e.test.${uniqueId}@playwright.local`,
    password: `TestPass${uniqueId}!`,
  };
};

test.describe('Real E2E Authentication Tests - No Mocks', () => {
  // Store test user data for cleanup
  let testUser: ReturnType<typeof generateTestUser>;

  test.beforeEach(async () => {
    // Generate unique test user for each test
    testUser = generateTestUser();
  });

  test('Complete authentication journey: Signup → Login → Logout', async ({ page }) => {
    // Step 1: Navigate to homepage
    await page.goto('http://localhost:3000');
    await expect(page.locator('span.text-xl.font-bold')).toContainText('Scottish AI Lessons');
    
    // Step 2: Go to signup page
    await page.locator('nav').getByRole('button', { name: 'Get Started' }).click();
    await expect(page).toHaveURL('/signup');
    
    // Step 3: Fill signup form with real data
    await page.locator('input[id="name"]').fill(testUser.name);
    await page.locator('input[id="email"]').fill(testUser.email);
    await page.locator('input[id="password"]').fill(testUser.password);
    await page.locator('input[id="confirmPassword"]').fill(testUser.password);
    
    // Step 4: Submit signup form (creates real Appwrite user)
    await page.locator('button[type="submit"]').click();
    
    // Step 5: Wait for signup to complete and redirect
    await page.waitForURL('/chat', { timeout: 10000 });
    
    // Step 6: Verify we're logged in and on chat page
    await expect(page).toHaveURL('/chat');
    const chatContainer = page.locator('main.h-dvh');
    await expect(chatContainer).toBeVisible();
    
    // Step 7: Logout
    await page.goto('/api/auth/logout');
    
    // Step 8: Verify redirect to homepage after logout
    await page.waitForURL('/', { timeout: 5000 });
    await expect(page).toHaveURL('/');
    
    // Step 9: Try to access protected route - should redirect to login
    await page.goto('/chat');
    await expect(page.url()).toContain('/login');
    
    // Step 10: Login with the same user
    await page.locator('input[id="email"]').fill(testUser.email);
    await page.locator('input[id="password"]').fill(testUser.password);
    await page.locator('button[type="submit"]').click();
    
    // Step 11: Verify successful login
    await page.waitForURL('/chat', { timeout: 10000 });
    await expect(page).toHaveURL('/chat');
  });

  test('Failed login with invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    // Try to login with non-existent user
    await page.locator('input[id="email"]').fill('nonexistent@example.com');
    await page.locator('input[id="password"]').fill('WrongPassword123!');
    await page.locator('button[type="submit"]').click();
    
    // Should show error message and stay on login page
    await expect(page.locator('.bg-red-50')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL('/login');
  });

  test('Signup validation: passwords must match', async ({ page }) => {
    const user = generateTestUser();
    
    await page.goto('/signup');
    
    // Fill form with mismatched passwords
    await page.locator('input[id="name"]').fill(user.name);
    await page.locator('input[id="email"]').fill(user.email);
    await page.locator('input[id="password"]').fill(user.password);
    await page.locator('input[id="confirmPassword"]').fill('DifferentPassword123!');
    
    await page.locator('button[type="submit"]').click();
    
    // Should show error and stay on signup page
    await expect(page.locator('text=Passwords do not match')).toBeVisible();
    await expect(page).toHaveURL('/signup');
  });

  test('Protected route middleware: unauthenticated access', async ({ page }) => {
    // Clear any existing cookies
    await page.context().clearCookies();
    
    // Try to access protected route without authentication
    await page.goto('/chat');
    
    // Should redirect to login with redirect parameter
    await expect(page.url()).toContain('/login');
    await expect(page.url()).toContain('redirect=%2Fchat');
  });

  test('Session persistence across page reloads', async ({ page }) => {
    // Create and login a new user
    await page.goto('/signup');
    
    await page.locator('input[id="name"]').fill(testUser.name);
    await page.locator('input[id="email"]').fill(testUser.email);
    await page.locator('input[id="password"]').fill(testUser.password);
    await page.locator('input[id="confirmPassword"]').fill(testUser.password);
    await page.locator('button[type="submit"]').click();
    
    // Wait for successful signup and redirect to chat
    await page.waitForURL('/chat', { timeout: 10000 });
    
    // Reload the page
    await page.reload();
    
    // Should still be on chat page (session persisted)
    await expect(page).toHaveURL('/chat');
    
    // Navigate away and back
    await page.goto('/');
    await page.goto('/chat');
    
    // Should still have access (session still valid)
    await expect(page).toHaveURL('/chat');
  });

  test('Duplicate email signup prevention', async ({ page }) => {
    // First, create a user
    await page.goto('/signup');
    
    await page.locator('input[id="name"]').fill(testUser.name);
    await page.locator('input[id="email"]').fill(testUser.email);
    await page.locator('input[id="password"]').fill(testUser.password);
    await page.locator('input[id="confirmPassword"]').fill(testUser.password);
    await page.locator('button[type="submit"]').click();
    
    // Wait for successful signup
    await page.waitForURL('/chat', { timeout: 10000 });
    
    // Logout
    await page.goto('/api/auth/logout');
    
    // Try to signup again with same email
    await page.goto('/signup');
    
    await page.locator('input[id="name"]').fill('Different Name');
    await page.locator('input[id="email"]').fill(testUser.email);
    await page.locator('input[id="password"]').fill('DifferentPass123!');
    await page.locator('input[id="confirmPassword"]').fill('DifferentPass123!');
    await page.locator('button[type="submit"]').click();
    
    // Should show error about email already in use
    await expect(page.locator('.bg-red-50')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL('/signup');
  });
});

// Cleanup test suite for removing test users
test.describe('Cleanup E2E Test Users', () => {
  test.skip('Manual cleanup - run separately if needed', async () => {
    // This test can be used to manually cleanup test users
    // It's skipped by default but can be run with: 
    // npx playwright test tests/e2e-real-auth.spec.ts --grep="Manual cleanup"
    
    console.log('To cleanup test users, use Appwrite console or MCP tools');
    console.log('Test users have emails matching pattern: e2e.test.*@playwright.local');
  });
});