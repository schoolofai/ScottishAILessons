import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

// Load environment variables
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const HEADLESS = process.env.HEADLESS !== 'false';
const WORKERS = process.env.WORKERS ? parseInt(process.env.WORKERS) : 1;

export default defineConfig({
  testDir: './tests',
  timeout: 60000, // 60 seconds per test
  expect: {
    timeout: 15000 // 15 seconds for assertions (AI responses can be slow)
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : WORKERS,
  reporter: [
    ['html', { outputFolder: 'test-results/html-report' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list'],
    process.env.CI ? ['github'] : ['line']
  ],
  use: {
    baseURL: BASE_URL,
    headless: HEADLESS,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    // AI responses can be slow, increase timeouts
    actionTimeout: 30000,
    navigationTimeout: 30000
  },
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Increase viewport for better AI content visibility
        viewport: { width: 1920, height: 1080 }
      },
    },
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 }
      },
    },
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 }
      },
    },
    // Mobile testing (optional)
    // {
    //   name: 'mobile-chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
  ],
  webServer: process.env.CI ? undefined : {
    command: 'echo "Please ensure the Scottish AI Lessons system is running on the configured BASE_URL"',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 5000
  },
  outputDir: 'test-results/artifacts',
  globalSetup: require.resolve('./tests/helpers/global-setup.ts'),
});