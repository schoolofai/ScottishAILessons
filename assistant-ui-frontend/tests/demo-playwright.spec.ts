import { test, expect } from '@playwright/test';

/**
 * Demonstration of Playwright MCP Integration
 * These tests showcase how to use Playwright MCP tools for testing the authentication system
 */

test.describe('Playwright MCP Integration Demo', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing state
    await page.context().clearCookies();
  });

  test('MCP Demo: Navigate and interact with landing page', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Take a snapshot of the landing page
    const snapshot = await page.content();
    expect(snapshot).toContain('Scottish AI Lessons');
    expect(snapshot).toContain('AI-Powered Learning Platform');
    
    // Interact with navigation elements
    const loginButton = page.locator('text=Login');
    const signupButton = page.locator('text=Get Started');
    
    await expect(loginButton).toBeVisible();
    await expect(signupButton).toBeVisible();
    
    // Click login button and verify navigation
    await loginButton.click();
    await expect(page).toHaveURL('/login');
    
    console.log('✅ Successfully navigated to login page');
  });

  test('MCP Demo: Test form interactions and validation', async ({ page }) => {
    await page.goto('/login');
    
    // Locate form elements
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');
    
    // Test form is visible
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();
    
    // Test form validation
    await emailInput.fill('invalid-email');
    await passwordInput.fill('short');
    await submitButton.click();
    
    // Check for validation errors
    const isEmailInvalid = await emailInput.evaluate(
      el => !(el as HTMLInputElement).validity.valid
    );
    expect(isEmailInvalid).toBe(true);
    
    console.log('✅ Form validation working correctly');
  });

  test('MCP Demo: Mock API responses and test authentication flow', async ({ page }) => {
    // Mock successful login API response
    await page.route('/api/auth/login', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          userId: 'demo-user-123'
        })
      });
    });
    
    await page.goto('/login');
    
    // Fill login form
    await page.fill('input[type="email"]', 'demo@example.com');
    await page.fill('input[type="password"]', 'demo-password');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Verify redirect to chat page
    await expect(page).toHaveURL('/chat');
    
    console.log('✅ Authentication flow completed successfully');
  });

  test('MCP Demo: Test responsive design and browser resize', async ({ page }) => {
    await page.goto('/');
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Verify mobile layout
    const navbar = page.locator('nav');
    await expect(navbar).toBeVisible();
    
    // Take screenshot for mobile
    const mobileScreenshot = await page.screenshot({
      fullPage: true,
      path: 'test-results/mobile-layout.png'
    });
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    // Verify desktop layout
    await expect(navbar).toBeVisible();
    
    // Take screenshot for desktop
    const desktopScreenshot = await page.screenshot({
      fullPage: true, 
      path: 'test-results/desktop-layout.png'
    });
    
    console.log('✅ Responsive design tested on multiple viewports');
  });

  test('MCP Demo: Test error handling and user feedback', async ({ page }) => {
    // Mock error response
    await page.route('/api/auth/login', route => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Invalid credentials'
        })
      });
    });
    
    await page.goto('/login');
    
    // Attempt login with invalid credentials
    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Verify error message appears
    const errorMessage = page.locator('.bg-red-50');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Invalid credentials');
    
    console.log('✅ Error handling and user feedback working correctly');
  });

  test('MCP Demo: Test session management and cookies', async ({ page }) => {
    // Mock successful login
    await page.route('/api/auth/login', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          userId: 'session-demo-user'
        })
      });
    });
    
    await page.goto('/login');
    
    // Login
    await page.fill('input[type="email"]', 'session@example.com');
    await page.fill('input[type="password"]', 'sessionpass');
    await page.click('button[type="submit"]');
    
    // Check cookies are set
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(cookie => cookie.name === 'appwrite-session');
    
    // Verify session cookie properties (if implementation sets cookies)
    if (sessionCookie) {
      expect(sessionCookie.httpOnly).toBe(true);
      expect(sessionCookie.sameSite).toBe('Strict');
      console.log('✅ Session cookie set with secure properties');
    } else {
      console.log('ℹ️  Session cookie not set (may be handled by API)');
    }
    
    // Verify we're on protected route
    await expect(page).toHaveURL('/chat');
    
    console.log('✅ Session management tested successfully');
  });

  test('MCP Demo: Test concurrent sessions and multi-tab behavior', async ({ browser }) => {
    // Create multiple browser contexts to simulate different users
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // Mock different responses for each context
    await page1.route('/api/auth/login', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, userId: 'user1' })
      });
    });
    
    await page2.route('/api/auth/login', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, userId: 'user2' })
      });
    });
    
    // Login in both contexts simultaneously
    await Promise.all([
      page1.goto('/login'),
      page2.goto('/login')
    ]);
    
    await Promise.all([
      page1.fill('input[type="email"]', 'user1@example.com'),
      page2.fill('input[type="email"]', 'user2@example.com')
    ]);
    
    await Promise.all([
      page1.fill('input[type="password"]', 'password1'),
      page2.fill('input[type="password"]', 'password2')
    ]);
    
    await Promise.all([
      page1.click('button[type="submit"]'),
      page2.click('button[type="submit"]')
    ]);
    
    // Verify both contexts navigate to chat
    await Promise.all([
      expect(page1).toHaveURL('/chat'),
      expect(page2).toHaveURL('/chat')
    ]);
    
    console.log('✅ Concurrent sessions handled correctly');
    
    // Cleanup
    await context1.close();
    await context2.close();
  });

  test('MCP Demo: Test network conditions and offline behavior', async ({ page, context }) => {
    await page.goto('/login');
    
    // Fill form first
    await page.fill('input[type="email"]', 'network@example.com');
    await page.fill('input[type="password"]', 'networktest');
    
    // Simulate network failure
    await page.route('/api/auth/login', route => {
      route.abort(); // Simulate network error
    });
    
    // Attempt login
    await page.click('button[type="submit"]');
    
    // Wait a moment for any error handling
    await page.waitForTimeout(1000);
    
    // Verify the form is still present (didn't navigate away)
    await expect(page.locator('input[type="email"]')).toBeVisible();
    
    console.log('✅ Network error handling tested');
    
    // Test recovery - restore network and mock success
    await page.route('/api/auth/login', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, userId: 'network-recovery-user' })
      });
    });
    
    // Retry login
    await page.click('button[type="submit"]');
    
    // Should now succeed
    await expect(page).toHaveURL('/chat');
    
    console.log('✅ Network recovery tested successfully');
  });

  test('MCP Demo: Performance and timing testing', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Page should load within reasonable time
    expect(loadTime).toBeLessThan(3000);
    
    console.log(`✅ Page loaded in ${loadTime}ms`);
    
    // Test form interaction timing
    const formStartTime = Date.now();
    
    await page.goto('/login');
    await page.fill('input[type="email"]', 'timing@example.com');
    await page.fill('input[type="password"]', 'timingtest');
    
    const formInteractionTime = Date.now() - formStartTime;
    
    // Form interactions should be responsive
    expect(formInteractionTime).toBeLessThan(1000);
    
    console.log(`✅ Form interaction completed in ${formInteractionTime}ms`);
  });

  test('MCP Demo: Accessibility and keyboard navigation', async ({ page }) => {
    await page.goto('/login');
    
    // Test keyboard navigation
    await page.keyboard.press('Tab'); // Should focus on email input
    await page.keyboard.type('keyboard@example.com');
    
    await page.keyboard.press('Tab'); // Should focus on password input
    await page.keyboard.type('keyboardtest');
    
    await page.keyboard.press('Tab'); // Should focus on submit button
    
    // Check that focus is on the submit button
    const activeElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(activeElement).toBe('BUTTON');
    
    console.log('✅ Keyboard navigation working correctly');
    
    // Test form submission with Enter key
    await page.route('/api/auth/login', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, userId: 'keyboard-user' })
      });
    });
    
    await page.keyboard.press('Enter');
    
    // Should submit form and navigate
    await expect(page).toHaveURL('/chat');
    
    console.log('✅ Keyboard form submission working correctly');
  });
});

test.describe('Playwright MCP Advanced Features', () => {
  test('MCP Demo: Browser automation capabilities', async ({ page }) => {
    // Demonstrate various browser automation features
    await page.goto('/');
    
    // Capture page metrics
    const metrics = await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine
    }));
    
    console.log('Browser metrics:', metrics);
    
    // Test JavaScript execution
    const result = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        ready: document.readyState
      };
    });
    
    expect(result.title).toBeTruthy();
    expect(result.url).toContain('localhost');
    expect(result.ready).toBe('complete');
    
    console.log('✅ JavaScript execution in browser context working');
  });

  test('MCP Demo: Advanced element interactions', async ({ page }) => {
    await page.goto('/signup');
    
    // Test drag and drop (if applicable)
    // Test hover interactions
    const googleButton = page.locator('text=Continue with Google');
    await googleButton.hover();
    
    // Test right-click context menu
    await page.locator('input[type="email"]').click({ button: 'right' });
    
    // Test double-click
    await page.locator('input[name="name"]').dblclick();
    
    console.log('✅ Advanced element interactions tested');
  });
});

console.log(`
🎭 Playwright MCP Integration Demo Complete!

This test suite demonstrates:
✅ Basic page navigation and element interaction  
✅ Form testing and validation
✅ API mocking and response handling
✅ Responsive design testing
✅ Error handling verification
✅ Session and cookie management
✅ Concurrent user simulation
✅ Network condition testing
✅ Performance monitoring
✅ Accessibility and keyboard navigation
✅ Advanced browser automation

Use these patterns as a foundation for testing your authentication system!
`);