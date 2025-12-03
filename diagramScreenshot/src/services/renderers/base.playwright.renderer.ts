/**
 * Base class for browser-based renderers (Plotly, Desmos, GeoGebra)
 *
 * Provides common rendering logic:
 * 1. Create browser page with viewport
 * 2. Load generated HTML
 * 3. Wait for render completion
 * 4. Capture screenshot
 * 5. Return result with metadata
 */

import { Page } from 'playwright';
import { BrowserService } from '../browser.service';
import { IPlaywrightRenderer } from '../renderer.interface';
import { RenderOptions, RenderResult } from '../../types/common.types';
import logger from '../../utils/logger';

export abstract class BasePlaywrightRenderer implements IPlaywrightRenderer {
  protected browserService: BrowserService;

  /** Unique name for this renderer (e.g., 'plotly', 'desmos') */
  abstract readonly name: string;

  /** Default timeout in ms for render operations */
  abstract readonly defaultTimeout: number;

  /**
   * Generate HTML for the specific visualization tool
   * Must be implemented by subclasses
   */
  abstract generateHTML(input: unknown, width: number, height: number): string;

  constructor() {
    this.browserService = BrowserService.getInstance();
  }

  /**
   * Initialize the browser service
   */
  async initialize(): Promise<void> {
    await this.browserService.initialize();
    logger.info(`${this.name} renderer initialized`);
  }

  /**
   * Render the input and return screenshot buffer with metadata
   */
  async render(input: unknown, options: RenderOptions = {}): Promise<RenderResult> {
    const startTime = Date.now();

    const {
      width = 800,
      height = 600,
      format = 'png',
      quality = 90,
      scale = 2,
      timeout = this.defaultTimeout
    } = options;

    let page: Page | null = null;

    try {
      // 1. Create page with viewport
      page = await this.browserService.createPage(width, height, scale);

      // 2. Generate HTML for this renderer
      const html = this.generateHTML(input, width, height);

      // 3. Load HTML via HTTP server (required for GeoGebra WebGL to work)
      const url = this.browserService.getHtmlUrl(html);
      await page.goto(url, { waitUntil: 'networkidle' });

      logger.info(`${this.name}: Page loaded, waiting for render completion...`);

      // 4. Wait for render completion signal
      await page.waitForFunction(
        '() => window.renderComplete === true',
        { timeout }
      );

      // 5. Check for rendering errors
      const renderError = await page.evaluate('() => window.renderError') as string | null;
      if (renderError) {
        throw new Error(`${this.name.toUpperCase()}_RENDER_ERROR: ${renderError}`);
      }

      // 6. Brief stability wait for animations to settle
      await page.waitForTimeout(300);

      logger.info(`${this.name}: Capturing screenshot...`);

      // 7. Capture screenshot
      const screenshotOptions: {
        type: 'png' | 'jpeg';
        quality?: number;
        omitBackground: boolean;
      } = {
        type: format,
        omitBackground: false
      };

      if (format === 'jpeg') {
        screenshotOptions.quality = quality;
      }

      const buffer = await page.screenshot(screenshotOptions);

      const renderTimeMs = Date.now() - startTime;

      logger.info(`${this.name}: Screenshot captured`, {
        sizeBytes: buffer.length,
        renderTimeMs
      });

      // 8. Return result with metadata
      return {
        buffer,
        metadata: {
          tool: this.name,
          format,
          width,
          height,
          sizeBytes: buffer.length,
          renderTimeMs,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      // Capture console errors for debugging
      let consoleErrors: string[] = [];
      if (page) {
        try {
          consoleErrors = await page.evaluate('() => window.consoleErrors || []') as string[];
        } catch {
          // Ignore errors when trying to get console errors
        }
      }

      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error(`${this.name} render failed`, {
        error: errorMessage,
        consoleErrors,
        duration: Date.now() - startTime
      });

      // Re-throw with console errors attached
      const enhancedError = new Error(errorMessage);
      (enhancedError as any).consoleErrors = consoleErrors;
      throw enhancedError;

    } finally {
      // Always close the page to prevent resource leaks
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Close is a no-op for individual renderers
   * The shared BrowserService handles browser lifecycle
   */
  async close(): Promise<void> {
    // Individual renderers don't close the shared browser
    // BrowserService.getInstance().close() handles that
  }

  /**
   * Check if the browser service is initialized
   */
  isInitialized(): boolean {
    return this.browserService.isInitialized();
  }
}
