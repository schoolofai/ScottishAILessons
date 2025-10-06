import { chromium, Browser, Page } from 'playwright';
import { RenderOptions, JSXGraphDiagram } from '../types/diagram';
import { generateHTML } from '../utils/html-generator';
import { RenderError } from '../utils/error-handler';
import logger from '../utils/logger';

export class DiagramRenderer {
  private browser: Browser | null = null;

  async initialize(): Promise<void> {
    if (!this.browser) {
      logger.info('Initializing Playwright browser...');
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      });
      logger.info('Playwright browser initialized');
    }
  }

  async render(
    diagram: JSXGraphDiagram,
    options: RenderOptions = {}
  ): Promise<Buffer> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    const {
      width = 800,
      height = 600,
      format = 'png',
      quality = 90,
      scale = 2,
      timeout = 10000,
      waitForStable = true,
      backgroundColor = 'white',
      fullPage = false
    } = options;

    let page: Page | null = null;

    try {
      logger.info('Creating new page with viewport', { width, height, scale });

      // Create new page with viewport
      page = await this.browser.newPage({
        viewport: { width, height },
        deviceScaleFactor: scale
      });

      // Generate HTML
      const html = generateHTML(diagram, { width, height, backgroundColor });

      // Navigate to data URL
      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
      await page.goto(dataUrl, { waitUntil: 'networkidle' });

      logger.info('Page loaded, waiting for render completion...');

      // Wait for rendering completion
      await page.waitForFunction(
        '() => window.renderComplete === true',
        { timeout }
      );

      // Check for rendering errors
      const renderError = await page.evaluate('() => window.renderError') as any;
      if (renderError) {
        throw new Error(`JSXGraph rendering error: ${renderError.message || 'Unknown error'}`);
      }

      logger.info('Rendering complete, waiting for stability...');

      // Optional: Wait for animations to settle
      if (waitForStable) {
        await page.waitForTimeout(500);
      }

      logger.info('Capturing screenshot...');

      // Capture screenshot
      const screenshotOptions: any = {
        type: format,
        fullPage,
        omitBackground: backgroundColor === 'transparent'
      };

      if (format === 'jpeg') {
        screenshotOptions.quality = quality;
      }

      const buffer = await page.screenshot(screenshotOptions);

      logger.info('Screenshot captured', { sizeBytes: buffer.length });

      return buffer;

    } catch (error) {
      logger.error('Rendering failed', { error: error instanceof Error ? error.message : String(error) });

      // Capture console errors for debugging
      const consoleErrors = await page?.evaluate('() => window.consoleErrors || []').catch(() => []);

      throw new RenderError(
        'Rendering failed',
        error instanceof Error ? error : new Error(String(error)),
        { consoleErrors }
      );

    } finally {
      // Cleanup page
      if (page) {
        await page.close();
      }
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      logger.info('Closing browser...');
      await this.browser.close();
      this.browser = null;
      logger.info('Browser closed');
    }
  }

  isInitialized(): boolean {
    return this.browser !== null;
  }
}
