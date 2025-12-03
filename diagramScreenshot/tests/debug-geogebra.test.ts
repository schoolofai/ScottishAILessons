/**
 * Debug test for GeoGebra rendering
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, Browser, Page } from 'playwright';
import * as http from 'http';
import { generateGeoGebraHTML } from '../src/generators/geogebra.generator';
import { GeoGebraRenderRequest } from '../src/types/geogebra.types';

describe('GeoGebra Debug Test', () => {
  let browser: Browser;
  let page: Page;
  let server: http.Server;
  let serverUrl: string;
  let htmlContent: string = '';

  beforeAll(async () => {
    // Create a simple HTTP server to serve the HTML
    server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(htmlContent);
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        serverUrl = `http://127.0.0.1:${addr.port}`;
        console.log(`Test server running at ${serverUrl}`);
        resolve();
      });
    });

    // Launch browser with WebGL enabled
    browser = await chromium.launch({
      headless: true,
      args: [
        '--enable-webgl',
        '--use-gl=angle',
        '--enable-features=VaapiVideoDecoder'
      ]
    });
    const context = await browser.newContext({
      viewport: { width: 600, height: 600 }
    });
    page = await context.newPage();

    // Capture console logs
    page.on('console', msg => {
      console.log(`[PAGE ${msg.type()}]: ${msg.text()}`);
    });

    page.on('pageerror', err => {
      console.log(`[PAGE ERROR]: ${err.message}`);
    });
  }, 60000);

  afterAll(async () => {
    await browser.close();
    server.close();
  });

  it('should load GeoGebra and execute commands', async () => {
    // Use our generator with a simple circle construction
    const request: GeoGebraRenderRequest = {
      construction: {
        commands: [
          'O = (0, 0)',
          'c = Circle(O, 3)',
          'A = Point(c)',
          'B = Point(c)'
        ],
        settings: {
          appType: 'geometry',
          showAxes: false,
          showGrid: false,
          coordSystem: { xmin: -5, xmax: 5, ymin: -5, ymax: 5 }
        },
        styles: [
          { name: 'c', color: '#0000CC', lineThickness: 3 },
          { name: 'O', color: '#CC0000', pointSize: 5 }
        ]
      }
    };

    // Set the HTML content for the server
    htmlContent = generateGeoGebraHTML(request, 600, 600);

    console.log('Navigating to page via HTTP server...');
    await page.goto(serverUrl, { waitUntil: 'networkidle' });

    console.log('Page loaded, checking initial state...');
    const initialState = await page.evaluate(() => ({
      renderComplete: (window as any).renderComplete,
      consoleErrors: (window as any).consoleErrors,
      ggbApplet: typeof (window as any).ggbApplet
    }));
    console.log('Initial state:', JSON.stringify(initialState, null, 2));

    console.log('Waiting for renderComplete (max 30s)...');
    await page.waitForFunction('window.renderComplete === true', { timeout: 30000 });
    console.log('renderComplete is true!');

    // Additional wait to allow GeoGebra to render
    console.log('Additional 2s wait for rendering...');
    await page.waitForTimeout(2000);

    // Try to export SVG with callback
    const svgExport = await page.evaluate(() => {
      return new Promise<string | null>((resolve) => {
        const api = (window as any).ggbApplet1;
        if (api && typeof api.exportSVG === 'function') {
          api.exportSVG((svg: string) => {
            resolve(svg ? svg.substring(0, 500) : null);
          });
          // Timeout fallback
          setTimeout(() => resolve(null), 3000);
        } else {
          resolve(null);
        }
      });
    });
    console.log('SVG export result:', svgExport ? 'success (length=' + svgExport.length + ')' : 'null');
    if (svgExport) {
      console.log('SVG preview:', svgExport.substring(0, 200));
    }

    const finalState = await page.evaluate(() => {
      const container = document.getElementById('ggb-container');
      const preview = container?.querySelector('.ggb_preview') as HTMLElement | null;
      const canvas = container?.querySelector('canvas');
      const iframe = container?.querySelector('iframe');

      // Try to get output from GeoGebra API
      let svgOutput: string | null = null;
      let pngBase64: string | null = null;
      let pngError: string | null = null;
      let availableMethods: string[] = [];
      try {
        const api = (window as any).ggbApplet1;
        if (api) {
          // List available methods that might help with export
          const exportMethods = Object.keys(api).filter(k =>
            typeof api[k] === 'function' &&
            (k.toLowerCase().includes('export') || k.toLowerCase().includes('svg') ||
             k.toLowerCase().includes('png') || k.toLowerCase().includes('image'))
          );
          availableMethods = exportMethods;

          // Try SVG export
          if (typeof api.exportSVG === 'function') {
            const svg = api.exportSVG();
            if (svg && typeof svg === 'string') {
              svgOutput = svg.substring(0, 300) + '...'; // Truncate for logging
            }
          }

          // Try getPNGBase64
          if (typeof api.getPNGBase64 === 'function') {
            const png = api.getPNGBase64(1.0, false, 72, false);
            if (png && typeof png === 'string' && png.length > 100) {
              pngBase64 = png.substring(0, 100) + '... (len=' + png.length + ')';
            } else {
              pngBase64 = 'returned: ' + String(png);
            }
          }
        }
      } catch (e: any) {
        pngError = e.message || String(e);
      }

      return {
        renderComplete: (window as any).renderComplete,
        renderError: (window as any).renderError,
        consoleErrors: (window as any).consoleErrors,
        ggbApplet: typeof (window as any).ggbApplet,
        ggbApplet1: typeof (window as any).ggbApplet1,
        hasPreview: !!preview,
        previewDisplay: preview?.style.display,
        previewZIndex: preview?.style.zIndex,
        hasCanvas: !!canvas,
        canvasSize: canvas ? `${canvas.width}x${canvas.height}` : null,
        hasIframe: !!iframe,
        containerChildCount: container?.childElementCount,
        containerClasses: Array.from(container?.querySelectorAll('*') || []).map(e => e.className).slice(0, 20),
        svgOutput,
        pngBase64,
        pngError,
        availableMethods
      };
    });
    console.log('Final state:', JSON.stringify(finalState, null, 2));

    // Take screenshot
    await page.screenshot({ path: '/tmp/geogebra-debug.png' });
    console.log('Screenshot saved to /tmp/geogebra-debug.png');

    // Check that we actually have the API
    expect(finalState.ggbApplet).toBe('object');
    expect(finalState.renderError).toBeNull();
  }, 45000);
});
