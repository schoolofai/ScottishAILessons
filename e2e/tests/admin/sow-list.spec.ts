/**
 * Admin Panel - SOW List E2E Tests
 *
 * Tests the admin panel SOW list view to ensure:
 * - SOW metadata is properly decompressed and displayed
 * - Subject, Level, Lessons count, and Duration are visible
 */

import { test, expect } from '@playwright/test';
import { authenticateUser } from '../helpers/auth';
import { TIMEOUTS } from '../helpers/constants';

// Admin user credentials - must have 'admin' label in Appwrite
const ADMIN_USER = {
  email: process.env.TEST_ADMIN_EMAIL || 'test@scottishailessons.com',
  password: process.env.TEST_ADMIN_PASSWORD || 'red12345',
};

test.describe('Admin Panel - SOW List', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await page.goto('/');
    await authenticateUser(page, ADMIN_USER);
  });

  test('should display SOW metadata correctly (lessons count and duration)', async ({ page }) => {
    console.log('[Test] Verifying SOW metadata display on admin panel...');

    // Navigate to admin page
    await page.goto('/admin');
    await page.waitForTimeout(TIMEOUTS.shortWait);

    // Wait for SOW list to load
    const sowList = page.locator('[data-testid="sow-item"]');
    await expect(sowList.first()).toBeVisible({ timeout: 10000 });
    console.log('[Test] SOW list loaded');

    // Get the first SOW item
    const firstSOW = sowList.first();

    // Check for lessons count - should show a number, not just "Lessons: •"
    // The regression shows "Lessons: •" without a number
    const lessonsText = firstSOW.locator('text=/Lessons:\\s*\\d+/');
    await expect(lessonsText).toBeVisible({ timeout: 5000 });
    console.log('[Test] ✅ Lessons count is visible');

    // Check for duration - should show "X min", not just "min"
    // The regression shows "Est. Duration: min" without a number
    const durationText = firstSOW.locator('text=/Duration:\\s*\\d+\\s*min/');
    await expect(durationText).toBeVisible({ timeout: 5000 });
    console.log('[Test] ✅ Duration is visible');

    console.log('[Test] ✅ SOW metadata displayed correctly');
  });

  test('should display course name in SOW cards', async ({ page }) => {
    console.log('[Test] Verifying course name display...');

    // Navigate to admin page
    await page.goto('/admin');
    await page.waitForTimeout(TIMEOUTS.shortWait);

    // Wait for SOW list to load
    const sowList = page.locator('[data-testid="sow-item"]');
    await expect(sowList.first()).toBeVisible({ timeout: 10000 });

    // Get the first SOW item and check it has a title (h3 with non-empty content)
    const firstSOW = sowList.first();
    const title = firstSOW.locator('h3');

    // Title should not be empty
    const titleText = await title.textContent();
    expect(titleText).toBeTruthy();
    expect(titleText!.trim().length).toBeGreaterThan(0);

    console.log(`[Test] ✅ Course name displayed: "${titleText?.trim()}"`);
  });

  test('should fetch SOW data from /api/admin/sows with proper metadata structure', async ({ page }) => {
    console.log('[Test] Testing admin SOWs API endpoint...');

    // Make API request to check response structure
    const response = await page.request.get('/api/admin/sows');

    // Check response status
    if (response.status() === 401) {
      console.log('[Test] ⚠️  Not authenticated as admin, skipping API test');
      test.skip();
      return;
    }

    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.sows)).toBe(true);

    if (data.sows.length === 0) {
      console.log('[Test] ⚠️  No SOWs found, skipping metadata check');
      test.skip();
      return;
    }

    // Check first SOW has proper metadata structure
    const firstSOW = data.sows[0];

    // Debug: log the actual data to see what we're getting
    console.log('[Test] First SOW courseId:', firstSOW.courseId);

    // Check entries field - should be array, not gzip string
    console.log('[Test] Entries type:', typeof firstSOW.entries);
    if (typeof firstSOW.entries === 'string') {
      console.log('[Test] ❌ Entries is still a STRING (possibly gzip):', firstSOW.entries.substring(0, 100));
    } else if (Array.isArray(firstSOW.entries)) {
      console.log('[Test] ✅ Entries is properly decompressed array with', firstSOW.entries.length, 'items');
    }

    // CRITICAL: entries should be an array, not a gzip string
    expect(Array.isArray(firstSOW.entries)).toBe(true);
    expect(firstSOW.entries.length).toBeGreaterThan(0);

    console.log('[Test] First SOW metadata:', JSON.stringify(firstSOW.metadata, null, 2));

    // Metadata should be an object (decompression working correctly)
    expect(firstSOW.metadata).toBeDefined();
    expect(typeof firstSOW.metadata).toBe('object');
    expect(firstSOW.metadata).not.toBeNull();

    // CRITICAL: Metadata should have SOME properties (not empty object)
    // If decompression failed, this would be null or empty
    const metadataKeys = Object.keys(firstSOW.metadata);
    expect(metadataKeys.length).toBeGreaterThan(0);

    console.log('[Test] ✅ SOW metadata decompressed correctly');
    console.log(`[Test] - Metadata has ${metadataKeys.length} keys: ${metadataKeys.join(', ')}`);

    // Check for common metadata fields (optional - some SOWs may have different schemas)
    if (firstSOW.metadata.course_name) {
      console.log(`[Test] - course_name: ${firstSOW.metadata.course_name}`);
    }
    if (firstSOW.metadata.total_lessons !== undefined) {
      console.log(`[Test] - total_lessons: ${firstSOW.metadata.total_lessons}`);
    }
    if (firstSOW.metadata.total_estimated_minutes !== undefined) {
      console.log(`[Test] - total_estimated_minutes: ${firstSOW.metadata.total_estimated_minutes}`);
    }
  });

  test('should fetch SOW detail with decompressed entries and metadata', async ({ page }) => {
    console.log('[Test] Testing admin SOW detail API endpoint...');

    // First get the list to find a SOW ID
    const listResponse = await page.request.get('/api/admin/sows');

    if (listResponse.status() === 401) {
      console.log('[Test] ⚠️  Not authenticated as admin, skipping API test');
      test.skip();
      return;
    }

    expect(listResponse.ok()).toBe(true);
    const listData = await listResponse.json();

    if (!listData.sows || listData.sows.length === 0) {
      console.log('[Test] ⚠️  No SOWs found, skipping detail test');
      test.skip();
      return;
    }

    // Get the first SOW's ID
    const sowId = listData.sows[0].$id;
    console.log(`[Test] Fetching detail for SOW: ${sowId}`);

    // Fetch the detail
    const detailResponse = await page.request.get(`/api/admin/sows/${sowId}`);
    expect(detailResponse.ok()).toBe(true);

    const detailData = await detailResponse.json();
    expect(detailData.success).toBe(true);

    const sow = detailData.sow;

    // CRITICAL: entries should be an array, not a gzip string
    console.log('[Test] Detail entries type:', typeof sow.entries);
    if (typeof sow.entries === 'string') {
      console.log('[Test] ❌ Detail entries is STRING:', sow.entries.substring(0, 100));
    } else if (Array.isArray(sow.entries)) {
      console.log('[Test] ✅ Detail entries is array with', sow.entries.length, 'items');
    }

    expect(Array.isArray(sow.entries)).toBe(true);

    // CRITICAL: metadata should be an object, not a string
    console.log('[Test] Detail metadata type:', typeof sow.metadata);
    expect(typeof sow.metadata).toBe('object');
    expect(sow.metadata).not.toBeNull();

    console.log('[Test] ✅ SOW detail properly decompressed');
  });
});
