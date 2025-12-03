/**
 * Singleton browser service for NEW renderers only
 *
 * IMPORTANT: This is a SEPARATE browser instance from the existing DiagramRenderer.
 * The existing DiagramRenderer (FROZEN) keeps its own browser instance for JSXGraph.
 * This ensures complete isolation and no regression risk.
 */

import { chromium, Browser, Page } from 'playwright';
import * as http from 'http';
import logger from '../utils/logger';

export class BrowserService {
  private static instance: BrowserService;
  private browser: Browser | null = null;
  private httpServer: http.Server | null = null;
  private httpPort: number = 0;
  private pendingHtml: string = '';

  /**
   * Private constructor - use getInstance() instead
   */
  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): BrowserService {
    if (!BrowserService.instance) {
      BrowserService.instance = new BrowserService();
    }
    return BrowserService.instance;
  }

  /**
   * Initialize the browser and HTTP server if not already initialized
   */
  async initialize(): Promise<void> {
    if (this.browser) {
      return; // Already initialized
    }

    logger.info('BrowserService: Initializing shared browser for new renderers...');

    // Start HTTP server for serving HTML (needed by GeoGebra which doesn't work with data: URLs)
    await this.startHttpServer();

    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        // Enable GPU for WebGL (needed by GeoGebra)
        '--enable-webgl',
        '--use-gl=angle',
        '--enable-features=VaapiVideoDecoder'
      ]
    });

    logger.info('BrowserService: Browser initialized successfully');
  }

  /**
   * Start the internal HTTP server for serving HTML content
   */
  private async startHttpServer(): Promise<void> {
    if (this.httpServer) {
      return;
    }

    this.httpServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(this.pendingHtml);
    });

    return new Promise<void>((resolve, reject) => {
      this.httpServer!.listen(0, '127.0.0.1', () => {
        const addr = this.httpServer!.address() as { port: number };
        this.httpPort = addr.port;
        logger.info(`BrowserService: HTTP server started on port ${this.httpPort}`);
        resolve();
      });
      this.httpServer!.on('error', reject);
    });
  }

  /**
   * Get the URL to serve the given HTML content
   */
  getHtmlUrl(html: string): string {
    this.pendingHtml = html;
    return `http://127.0.0.1:${this.httpPort}`;
  }

  /**
   * Create a new page with the specified viewport
   * @throws Error if browser not initialized
   */
  async createPage(width: number, height: number, scale: number): Promise<Page> {
    if (!this.browser) {
      throw new Error('BROWSER_NOT_INITIALIZED: Call initialize() first');
    }

    return this.browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: scale
    });
  }

  /**
   * Close the browser and release resources
   */
  async close(): Promise<void> {
    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = null;
      logger.info('BrowserService: HTTP server closed');
    }

    if (this.browser) {
      logger.info('BrowserService: Closing browser...');
      await this.browser.close();
      this.browser = null;
      logger.info('BrowserService: Browser closed');
    }
  }

  /**
   * Check if the browser is initialized and connected
   */
  isInitialized(): boolean {
    return this.browser !== null && this.browser.isConnected();
  }
}
