/**
 * Global setup for Scottish AI Lessons E2E tests
 * Verifies system is running and accessible before tests begin
 */

import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:3000';
  
  console.log(`🔍 Checking if Scottish AI Lessons is running at ${baseURL}`);
  
  // Launch a browser to check if the application is accessible
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Try to navigate to the application
    await page.goto(baseURL, { timeout: 10000 });
    
    // Check if the page loads and contains expected content
    const pageTitle = await page.title();
    console.log(`✅ Application is accessible. Page title: "${pageTitle}"`);
    
    // Verify login functionality is available
    const loginLink = page.getByRole('link', { name: 'Login' });
    if (await loginLink.isVisible({ timeout: 5000 })) {
      console.log('✅ Login functionality detected');
    } else {
      console.log('⚠️  Login link not immediately visible - this may be normal if user is already authenticated');
    }
    
    console.log('🚀 System verification complete. Starting tests...\n');
    
  } catch (error) {
    console.error(`❌ Failed to connect to Scottish AI Lessons at ${baseURL}`);
    console.error('Please ensure the system is running with the following commands:');
    console.error('');
    console.error('For LangGraph (default):');
    console.error('  cd langgraph-agent && ./start.sh');
    console.error('');
    console.error('For Aegra:');  
    console.error('  cd aegra-agent && ./start-aegra.sh');
    console.error('');
    console.error(`Original error: ${error}`);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

export default globalSetup;