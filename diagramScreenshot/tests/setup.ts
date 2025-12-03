/**
 * Test setup file - initializes renderers before E2E tests
 */

import { beforeAll, afterAll } from 'vitest';
import { initPlotlyRenderer } from '../src/routes/plotly.routes';
import { initDesmosRenderer } from '../src/routes/desmos.routes';
import { BrowserService } from '../src/services/browser.service';

// Only run setup for E2E tests (check if we're in e2e directory)
const isE2E = process.env.VITEST_POOL_ID !== undefined;

if (isE2E) {
  beforeAll(async () => {
    console.log('Initializing renderers for E2E tests...');
    try {
      await initPlotlyRenderer();
      console.log('Plotly renderer initialized');
    } catch (error) {
      console.error('Failed to initialize Plotly renderer:', error);
    }
    try {
      await initDesmosRenderer();
      console.log('Desmos renderer initialized');
    } catch (error) {
      console.error('Failed to initialize Desmos renderer:', error);
    }
  }, 30000);

  afterAll(async () => {
    console.log('Cleaning up renderers...');
    try {
      await BrowserService.getInstance().close();
      console.log('Browser service closed');
    } catch (error) {
      console.error('Failed to close browser service:', error);
    }
  });
}
