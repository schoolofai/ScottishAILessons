# Multi-Tool Mathematical Diagram Rendering Service - Implementation Plan

## Overview

This plan extends the DiagramScreenshot service to support multiple rendering tools (Plotly, Desmos, GeoGebra, Imagen) while maintaining strict OCP compliance - existing code remains frozen.

**Priority Order**: Plotly (pilot) → Desmos → GeoGebra → Imagen

---

## Phase 0: Infrastructure & Test Framework (Pre-requisite)

### 0.1 Create Shared Types & Interfaces

**File: `src/types/common.types.ts`**

```typescript
// Pseudo-code: Common types shared across all new renderers

export interface RenderOptions {
  width?: number;          // 100-4000, default 800
  height?: number;         // 100-4000, default 600
  format?: 'png' | 'jpeg'; // default 'png'
  quality?: number;        // 1-100, default 90 (jpeg only)
  scale?: number;          // 1-4, default 2
  timeout?: number;        // 1000-60000, default 15000
  returnFormat?: 'base64' | 'binary';  // default 'base64'
}

export interface RenderResult {
  buffer: Buffer;
  metadata: {
    tool: string;
    format: 'png' | 'jpeg';
    width: number;
    height: number;
    sizeBytes: number;
    renderTimeMs: number;
    timestamp: string;
    [key: string]: unknown;  // Tool-specific metadata
  };
}

export interface RenderSuccessResponse {
  success: true;
  image: string;  // base64
  metadata: RenderResult['metadata'];
}

export interface RenderErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    consoleErrors?: string[];
  };
}
```

### 0.2 Create Renderer Interface

**File: `src/services/renderer.interface.ts`**

```typescript
// Pseudo-code: Abstract interface for all new renderers

import { RenderOptions, RenderResult } from '../types/common.types';

export interface IRenderer {
  readonly name: string;
  readonly defaultTimeout: number;

  initialize(): Promise<void>;
  render(input: unknown, options: RenderOptions): Promise<RenderResult>;
  close(): Promise<void>;
  isInitialized(): boolean;
}

// For browser-based renderers (Plotly, Desmos, GeoGebra)
export interface IPlaywrightRenderer extends IRenderer {
  generateHTML(input: unknown, width: number, height: number): string;
}
```

### 0.3 Create Browser Service (Singleton for NEW renderers)

**File: `src/services/browser.service.ts`**

```typescript
// Pseudo-code: Singleton browser service for new renderers
// NOTE: Existing DiagramRenderer keeps its own browser - complete isolation

import { chromium, Browser, Page } from 'playwright';
import logger from '../utils/logger';

export class BrowserService {
  private static instance: BrowserService;
  private browser: Browser | null = null;

  private constructor() {}  // Private - use getInstance()

  static getInstance(): BrowserService {
    if (!BrowserService.instance) {
      BrowserService.instance = new BrowserService();
    }
    return BrowserService.instance;
  }

  async initialize(): Promise<void> {
    if (this.browser) return;  // Already initialized

    logger.info('BrowserService: Initializing shared browser for new renderers...');

    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    logger.info('BrowserService: Browser initialized');
  }

  async createPage(width: number, height: number, scale: number): Promise<Page> {
    if (!this.browser) {
      throw new Error('BROWSER_NOT_INITIALIZED: Call initialize() first');
    }

    return this.browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: scale
    });
  }

  async close(): Promise<void> {
    if (this.browser) {
      logger.info('BrowserService: Closing browser...');
      await this.browser.close();
      this.browser = null;
    }
  }

  isInitialized(): boolean {
    return this.browser !== null && this.browser.isConnected();
  }
}
```

### 0.4 Create Base Playwright Renderer

**File: `src/services/renderers/base.playwright.renderer.ts`**

```typescript
// Pseudo-code: Base class for browser-based renderers

import { Page } from 'playwright';
import { BrowserService } from '../browser.service';
import { IPlaywrightRenderer } from '../renderer.interface';
import { RenderOptions, RenderResult } from '../../types/common.types';
import logger from '../../utils/logger';

export abstract class BasePlaywrightRenderer implements IPlaywrightRenderer {
  protected browserService: BrowserService;

  abstract readonly name: string;
  abstract readonly defaultTimeout: number;
  abstract generateHTML(input: unknown, width: number, height: number): string;

  constructor() {
    this.browserService = BrowserService.getInstance();
  }

  async initialize(): Promise<void> {
    await this.browserService.initialize();
  }

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
      // 1. Create page
      page = await this.browserService.createPage(width, height, scale);

      // 2. Generate HTML
      const html = this.generateHTML(input, width, height);

      // 3. Load HTML via data URL
      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
      await page.goto(dataUrl, { waitUntil: 'networkidle' });

      // 4. Wait for render completion
      await page.waitForFunction(
        '() => window.renderComplete === true',
        { timeout }
      );

      // 5. Check for errors
      const renderError = await page.evaluate('() => window.renderError');
      if (renderError) {
        throw new Error(`${this.name.toUpperCase()}_RENDER_ERROR: ${renderError}`);
      }

      // 6. Brief stability wait
      await page.waitForTimeout(300);

      // 7. Capture screenshot
      const screenshotOptions: any = {
        type: format,
        omitBackground: false
      };
      if (format === 'jpeg') {
        screenshotOptions.quality = quality;
      }

      const buffer = await page.screenshot(screenshotOptions);

      // 8. Return result
      return {
        buffer,
        metadata: {
          tool: this.name,
          format,
          width,
          height,
          sizeBytes: buffer.length,
          renderTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      // Capture console errors for debugging
      const consoleErrors = await page?.evaluate('() => window.consoleErrors || []').catch(() => []);

      logger.error(`${this.name} render failed`, {
        error: error instanceof Error ? error.message : String(error),
        consoleErrors
      });

      throw error;

    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  async close(): Promise<void> {
    // Individual renderer doesn't close shared browser
    // BrowserService.close() handles that
  }

  isInitialized(): boolean {
    return this.browserService.isInitialized();
  }
}
```

### 0.5 Test Framework Setup

**File: `tests/helpers/test-server.ts`**

```typescript
// Pseudo-code: Test server setup helper

import express from 'express';
import { app } from '../../src/index';

export async function createTestServer() {
  // Return configured express app for supertest
  return app;
}

export function loadFixture(tool: string, name: string): object {
  // Load JSON fixture from tests/fixtures/{tool}/{name}.json
  const path = `../fixtures/${tool}/${name}.json`;
  return require(path);
}
```

**File: `vitest.config.ts`** (create if not exists)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts']  // Entry point excluded
    },
    testTimeout: 30000,  // 30s for browser-based tests
    hookTimeout: 60000   // 60s for setup/teardown
  }
});
```

---

## Phase 1: Plotly Pilot Implementation

### 1.1 Plotly Types

**File: `src/types/plotly.types.ts`**

```typescript
// Pseudo-code: Plotly-specific types

export interface PlotlyTrace {
  type: 'scatter' | 'bar' | 'pie' | 'histogram' | 'box' | 'heatmap' | 'line';
  x?: (number | string)[];
  y?: number[];
  values?: number[];       // pie charts
  labels?: string[];       // pie charts
  name?: string;
  mode?: 'lines' | 'markers' | 'lines+markers' | 'text' | 'none';
  marker?: {
    color?: string | string[];
    size?: number | number[];
    symbol?: string;
    line?: { color?: string; width?: number };
  };
  line?: {
    color?: string;
    width?: number;
    dash?: 'solid' | 'dot' | 'dash' | 'dashdot';
  };
  text?: string[];
  textposition?: 'inside' | 'outside' | 'auto' | 'none';
  boxpoints?: 'all' | 'outliers' | 'suspectedoutliers' | false;
  nbinsx?: number;
  histnorm?: '' | 'percent' | 'probability' | 'density';
}

export interface PlotlyLayout {
  title?: string | { text: string; font?: object };
  xaxis?: {
    title?: string;
    range?: [number, number];
    showgrid?: boolean;
    zeroline?: boolean;
    dtick?: number;
    tickformat?: string;
    type?: 'linear' | 'log' | 'date' | 'category';
  };
  yaxis?: {
    title?: string;
    range?: [number, number];
    showgrid?: boolean;
    zeroline?: boolean;
    dtick?: number;
  };
  showlegend?: boolean;
  legend?: { x?: number; y?: number; orientation?: 'v' | 'h' };
  bargap?: number;
  bargroupgap?: number;
  paper_bgcolor?: string;
  plot_bgcolor?: string;
  font?: { family?: string; size?: number; color?: string };
  margin?: { l?: number; r?: number; t?: number; b?: number };
  annotations?: Array<{
    x: number;
    y: number;
    text: string;
    showarrow?: boolean;
    arrowhead?: number;
    font?: object;
  }>;
}

export interface PlotlyConfig {
  staticPlot?: boolean;
  displayModeBar?: boolean;
  responsive?: boolean;
}

export interface PlotlyRenderRequest {
  chart: {
    data: PlotlyTrace[];
    layout?: PlotlyLayout;
    config?: PlotlyConfig;
  };
  options?: import('./common.types').RenderOptions;
}
```

### 1.2 Plotly Schema Validation

**File: `src/schemas/plotly.schema.ts`**

```typescript
// Pseudo-code: Zod schema for Plotly requests

import { z } from 'zod';

const plotlyTraceSchema = z.object({
  type: z.enum(['scatter', 'bar', 'pie', 'histogram', 'box', 'heatmap', 'line']),
  x: z.array(z.union([z.number(), z.string()])).optional(),
  y: z.array(z.number()).optional(),
  values: z.array(z.number()).optional(),
  labels: z.array(z.string()).optional(),
  name: z.string().optional(),
  mode: z.enum(['lines', 'markers', 'lines+markers', 'text', 'none']).optional(),
  marker: z.object({
    color: z.union([z.string(), z.array(z.string())]).optional(),
    size: z.union([z.number(), z.array(z.number())]).optional(),
    symbol: z.string().optional(),
    line: z.object({
      color: z.string().optional(),
      width: z.number().optional()
    }).optional()
  }).optional(),
  line: z.object({
    color: z.string().optional(),
    width: z.number().optional(),
    dash: z.enum(['solid', 'dot', 'dash', 'dashdot']).optional()
  }).optional(),
  text: z.array(z.string()).optional(),
  textposition: z.enum(['inside', 'outside', 'auto', 'none']).optional(),
  boxpoints: z.union([
    z.enum(['all', 'outliers', 'suspectedoutliers']),
    z.literal(false)
  ]).optional(),
  nbinsx: z.number().optional(),
  histnorm: z.enum(['', 'percent', 'probability', 'density']).optional()
});

const plotlyLayoutSchema = z.object({
  title: z.union([z.string(), z.object({ text: z.string(), font: z.any().optional() })]).optional(),
  xaxis: z.object({
    title: z.string().optional(),
    range: z.tuple([z.number(), z.number()]).optional(),
    showgrid: z.boolean().optional(),
    zeroline: z.boolean().optional(),
    dtick: z.number().optional(),
    tickformat: z.string().optional(),
    type: z.enum(['linear', 'log', 'date', 'category']).optional()
  }).optional(),
  yaxis: z.object({
    title: z.string().optional(),
    range: z.tuple([z.number(), z.number()]).optional(),
    showgrid: z.boolean().optional(),
    zeroline: z.boolean().optional(),
    dtick: z.number().optional()
  }).optional(),
  showlegend: z.boolean().optional(),
  legend: z.object({
    x: z.number().optional(),
    y: z.number().optional(),
    orientation: z.enum(['v', 'h']).optional()
  }).optional(),
  bargap: z.number().min(0).max(1).optional(),
  bargroupgap: z.number().min(0).max(1).optional(),
  paper_bgcolor: z.string().optional(),
  plot_bgcolor: z.string().optional(),
  font: z.object({
    family: z.string().optional(),
    size: z.number().optional(),
    color: z.string().optional()
  }).optional(),
  margin: z.object({
    l: z.number().optional(),
    r: z.number().optional(),
    t: z.number().optional(),
    b: z.number().optional()
  }).optional(),
  annotations: z.array(z.object({
    x: z.number(),
    y: z.number(),
    text: z.string(),
    showarrow: z.boolean().optional(),
    arrowhead: z.number().optional(),
    font: z.any().optional()
  })).optional()
}).optional();

const plotlyConfigSchema = z.object({
  staticPlot: z.boolean().optional(),
  displayModeBar: z.boolean().optional(),
  responsive: z.boolean().optional()
}).optional();

const renderOptionsSchema = z.object({
  width: z.number().min(100).max(4000).optional(),
  height: z.number().min(100).max(4000).optional(),
  format: z.enum(['png', 'jpeg']).optional(),
  quality: z.number().min(1).max(100).optional(),
  scale: z.number().min(1).max(4).optional(),
  timeout: z.number().min(1000).max(60000).optional(),
  returnFormat: z.enum(['base64', 'binary']).optional()
}).optional();

export const plotlyRequestSchema = z.object({
  chart: z.object({
    data: z.array(plotlyTraceSchema).min(1, 'At least one trace required'),
    layout: plotlyLayoutSchema,
    config: plotlyConfigSchema
  }),
  options: renderOptionsSchema
});

export function validatePlotlyRequest(data: unknown) {
  return plotlyRequestSchema.parse(data);
}
```

### 1.3 Plotly HTML Generator

**File: `src/generators/plotly.generator.ts`**

```typescript
// Pseudo-code: Generate self-contained HTML for Plotly rendering

import { PlotlyRenderRequest } from '../types/plotly.types';

export function generatePlotlyHTML(
  request: PlotlyRenderRequest,
  width: number,
  height: number
): string {
  const { chart } = request;

  // Merge layout with dimensions
  const layout = {
    ...chart.layout,
    width,
    height,
    margin: chart.layout?.margin || { l: 60, r: 40, t: 60, b: 60 }
  };

  // Force static rendering
  const config = {
    staticPlot: true,
    displayModeBar: false,
    responsive: false,
    ...chart.config
  };

  // Escape JSON for safe embedding
  const dataJSON = JSON.stringify(chart.data).replace(/</g, '\\u003c');
  const layoutJSON = JSON.stringify(layout).replace(/</g, '\\u003c');
  const configJSON = JSON.stringify(config).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${width}px; height: ${height}px; overflow: hidden; }
    #chart { width: 100%; height: 100%; }
  </style>
  <script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>
</head>
<body>
  <div id="chart"></div>
  <script>
    window.renderComplete = false;
    window.renderError = null;
    window.consoleErrors = [];

    const origError = console.error;
    console.error = function(...args) {
      window.consoleErrors.push(args.map(a => String(a)).join(' '));
      origError.apply(console, args);
    };

    try {
      const data = ${dataJSON};
      const layout = ${layoutJSON};
      const config = ${configJSON};

      Plotly.newPlot('chart', data, layout, config)
        .then(function() {
          window.renderComplete = true;
        })
        .catch(function(error) {
          window.renderError = error.message || 'Plotly render failed';
          window.renderComplete = true;
        });

    } catch (error) {
      window.renderError = error.message || 'Script execution failed';
      window.renderComplete = true;
    }
  </script>
</body>
</html>`;
}
```

### 1.4 Plotly Renderer

**File: `src/services/renderers/plotly.renderer.ts`**

```typescript
// Pseudo-code: Plotly renderer implementation

import { BasePlaywrightRenderer } from './base.playwright.renderer';
import { generatePlotlyHTML } from '../../generators/plotly.generator';
import { PlotlyRenderRequest } from '../../types/plotly.types';
import { RenderResult } from '../../types/common.types';

export class PlotlyRenderer extends BasePlaywrightRenderer {
  readonly name = 'plotly';
  readonly defaultTimeout = 10000;  // 10 seconds

  generateHTML(input: unknown, width: number, height: number): string {
    return generatePlotlyHTML(input as PlotlyRenderRequest, width, height);
  }

  // Override to add Plotly-specific metadata
  async render(input: unknown, options = {}): Promise<RenderResult> {
    const result = await super.render(input, options);
    const request = input as PlotlyRenderRequest;

    // Add Plotly-specific metadata
    result.metadata.traceCount = request.chart.data.length;
    result.metadata.chartTypes = [...new Set(request.chart.data.map(t => t.type))];

    return result;
  }
}
```

### 1.5 Plotly Route

**File: `src/routes/plotly.routes.ts`**

```typescript
// Pseudo-code: Express route for Plotly endpoint

import { Router, Request, Response } from 'express';
import { PlotlyRenderer } from '../services/renderers/plotly.renderer';
import { validatePlotlyRequest } from '../schemas/plotly.schema';
import { handleError } from '../utils/error-handler';
import logger from '../utils/logger';

export const plotlyRouter = Router();

let renderer: PlotlyRenderer | null = null;

export async function initPlotlyRenderer(): Promise<void> {
  renderer = new PlotlyRenderer();
  await renderer.initialize();
  logger.info('Plotly renderer initialized');
}

export function getPlotlyRenderer(): PlotlyRenderer | null {
  return renderer;
}

plotlyRouter.post('/', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // 1. Validate request
    const validatedRequest = validatePlotlyRequest(req.body);

    logger.info('Plotly render request', {
      traceCount: validatedRequest.chart.data.length
    });

    // 2. Check renderer
    if (!renderer || !renderer.isInitialized()) {
      throw new Error('RENDERER_NOT_INITIALIZED: Plotly renderer not ready');
    }

    // 3. Render
    const result = await renderer.render(validatedRequest, validatedRequest.options || {});

    // 4. Return success response
    res.json({
      success: true,
      image: result.buffer.toString('base64'),
      metadata: result.metadata
    });

    logger.info('Plotly render completed', {
      renderTimeMs: Date.now() - startTime,
      sizeBytes: result.buffer.length
    });

  } catch (error) {
    logger.error('Plotly render failed', {
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime
    });

    handleError(error, res);
  }
});
```

### 1.6 Integration: Extend index.ts (Minimal Changes)

**Changes to `src/index.ts`** - ADD these lines only:

```typescript
// ADD import at top (after existing imports)
import { plotlyRouter, initPlotlyRenderer, getPlotlyRenderer } from './routes/plotly.routes';
import { BrowserService } from './services/browser.service';

// ADD route registration (after existing routes, before 404 handler)
app.use('/api/v1/render/plotly', apiKeyAuth, plotlyRouter);

// ADD to start() function, after existing renderer.initialize()
await initPlotlyRenderer();
logger.info('Plotly renderer initialized');

// ADD to shutdown handlers (SIGTERM, SIGINT)
await BrowserService.getInstance().close();
```

### 1.7 Extend Health Check

**Changes to `src/routes/health.ts`** - ADD these lines:

```typescript
// ADD import
import { BrowserService } from '../services/browser.service';
import { getPlotlyRenderer } from './plotly.routes';

// ADD to health check response object (inside the GET '/' handler)
const plotlyRenderer = getPlotlyRenderer();
// Add to response:
newRenderers: {
  browserService: BrowserService.getInstance().isInitialized() ? 'ok' : 'not_initialized',
  plotly: plotlyRenderer?.isInitialized() ? 'ok' : 'not_initialized'
}
```

---

## Phase 2: Desmos Implementation

### 2.1 Desmos Types

**File: `src/types/desmos.types.ts`**

```typescript
// Pseudo-code: Key interfaces

export interface DesmosExpression {
  id?: string;
  type: 'expression' | 'table' | 'text' | 'folder';
  latex?: string;
  color?: string;
  lineStyle?: 'SOLID' | 'DASHED' | 'DOTTED';
  lineWidth?: number;  // 0.5-10
  pointStyle?: 'POINT' | 'OPEN' | 'CROSS';
  pointSize?: number;  // 1-20
  fillOpacity?: number;  // 0-1
  hidden?: boolean;
  showLabel?: boolean;
  label?: string;
  labelSize?: 'small' | 'medium' | 'large';
  labelOrientation?: 'above' | 'below' | 'left' | 'right' | 'default';
  columns?: Array<{ latex: string; values: number[] }>;  // For tables
  sliderBounds?: { min: number; max: number; step?: number };
}

export interface DesmosSettings {
  viewport?: { xmin: number; xmax: number; ymin: number; ymax: number };
  showGrid?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  xAxisNumbers?: boolean;
  yAxisNumbers?: boolean;
  polarMode?: boolean;
  degreeMode?: boolean;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export interface DesmosRenderRequest {
  graph: {
    expressions: DesmosExpression[];
    settings?: DesmosSettings;
  };
  options?: import('./common.types').RenderOptions;
}
```

### 2.2 Desmos HTML Generator

**File: `src/generators/desmos.generator.ts`**

```typescript
// Pseudo-code: Key difference from Plotly - uses Desmos API

export function generateDesmosHTML(
  request: DesmosRenderRequest,
  width: number,
  height: number
): string {
  const apiKey = process.env.DESMOS_API_KEY;
  if (!apiKey) {
    throw new Error('DESMOS_API_KEY environment variable not set');
  }

  const { graph } = request;
  const settings = graph.settings || {};
  const expressionsJSON = JSON.stringify(graph.expressions);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${width}px; height: ${height}px; overflow: hidden; }
    #calculator { width: 100%; height: 100%; }
  </style>
  <script src="https://www.desmos.com/api/v1.11/calculator.js?apiKey=${apiKey}"></script>
</head>
<body>
  <div id="calculator"></div>
  <script>
    window.renderComplete = false;
    window.renderError = null;
    window.consoleErrors = [];

    // Console capture
    const origError = console.error;
    console.error = (...args) => {
      window.consoleErrors.push(args.map(a => String(a)).join(' '));
      origError.apply(console, args);
    };

    try {
      const elt = document.getElementById('calculator');
      const calculator = Desmos.GraphingCalculator(elt, {
        expressions: true,
        settingsMenu: false,
        zoomButtons: false,
        lockViewport: true,
        border: false,
        showGrid: ${settings.showGrid !== false},
        showXAxis: ${settings.showXAxis !== false},
        showYAxis: ${settings.showYAxis !== false},
        xAxisNumbers: ${settings.xAxisNumbers !== false},
        yAxisNumbers: ${settings.yAxisNumbers !== false},
        polarMode: ${settings.polarMode === true},
        degreeMode: ${settings.degreeMode === true}
      });

      // Set viewport if specified
      ${settings.viewport ? `
      calculator.setMathBounds({
        left: ${settings.viewport.xmin},
        right: ${settings.viewport.xmax},
        bottom: ${settings.viewport.ymin},
        top: ${settings.viewport.ymax}
      });` : ''}

      // Add expressions
      const expressions = ${expressionsJSON};
      expressions.forEach((expr, index) => {
        const id = expr.id || 'expr_' + index;

        if (expr.type === 'expression' && expr.latex) {
          calculator.setExpression({
            id: id,
            latex: expr.latex,
            color: expr.color,
            lineStyle: expr.lineStyle ? Desmos.Styles[expr.lineStyle] : undefined,
            lineWidth: expr.lineWidth,
            pointStyle: expr.pointStyle ? Desmos.Styles[expr.pointStyle] : undefined,
            pointSize: expr.pointSize,
            fillOpacity: expr.fillOpacity,
            hidden: expr.hidden,
            showLabel: expr.showLabel,
            label: expr.label,
            sliderBounds: expr.sliderBounds
          });
        } else if (expr.type === 'table' && expr.columns) {
          calculator.setExpression({
            id: id,
            type: 'table',
            columns: expr.columns
          });
        }
      });

      // Wait for render (Desmos is async)
      setTimeout(() => {
        window.renderComplete = true;
      }, 800);

    } catch (error) {
      window.renderError = error.message;
      window.renderComplete = true;
    }
  </script>
</body>
</html>`;
}
```

### 2.3 Desmos Renderer & Route

Similar pattern to Plotly:
- `src/services/renderers/desmos.renderer.ts` - extends BasePlaywrightRenderer
- `src/schemas/desmos.schema.ts` - Zod validation
- `src/routes/desmos.routes.ts` - Express route

**Key difference**: `defaultTimeout = 15000` (longer due to API init)

---

## Phase 3: GeoGebra Implementation

### 3.1 GeoGebra Types

**File: `src/types/geogebra.types.ts`**

```typescript
export interface GeoGebraSettings {
  appType?: 'classic' | 'geometry' | 'graphing' | '3d';
  showAxes?: boolean;
  showGrid?: boolean;
  xmin?: number;
  xmax?: number;
  ymin?: number;
  ymax?: number;
  enableLabelDrags?: boolean;
  showResetIcon?: boolean;
  angleUnit?: 'degree' | 'radian';
  labelingStyle?: 'automatic' | 'all' | 'allNew' | 'none';
}

export interface GeoGebraRenderRequest {
  construction: {
    commands: string[];  // GeoGebra commands in execution order
    settings?: GeoGebraSettings;
  };
  options?: import('./common.types').RenderOptions;
}
```

### 3.2 GeoGebra HTML Generator

**File: `src/generators/geogebra.generator.ts`**

```typescript
// Pseudo-code: Key points - uses GeoGebra deployggb.js

export function generateGeoGebraHTML(
  request: GeoGebraRenderRequest,
  width: number,
  height: number
): string {
  const { construction } = request;
  const settings = construction.settings || {};
  const appType = settings.appType || 'classic';
  const commandsJSON = JSON.stringify(construction.commands);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${width}px; height: ${height}px; overflow: hidden; }
    #ggb-container { width: 100%; height: 100%; }
  </style>
  <script src="https://www.geogebra.org/apps/deployggb.js"></script>
</head>
<body>
  <div id="ggb-container"></div>
  <script>
    window.renderComplete = false;
    window.renderError = null;
    window.consoleErrors = [];
    window.ggbApplet = null;

    const origError = console.error;
    console.error = (...args) => {
      window.consoleErrors.push(args.map(a => String(a)).join(' '));
      origError.apply(console, args);
    };

    const commands = ${commandsJSON};

    const params = {
      "appName": "${appType}",
      "width": ${width},
      "height": ${height},
      "showToolBar": false,
      "showAlgebraInput": false,
      "showMenuBar": false,
      "showResetIcon": ${settings.showResetIcon === true},
      "enableLabelDrags": ${settings.enableLabelDrags === true},
      "enableShiftDragZoom": false,
      "enableRightClick": false,
      "showZoomButtons": false,
      "showFullscreenButton": false,
      "preventFocus": true,
      "useBrowserForJS": true,
      "appletOnLoad": function(api) {
        window.ggbApplet = api;

        try {
          // Apply coordinate system settings
          ${settings.showAxes !== undefined ? `api.setAxesVisible(${settings.showAxes}, ${settings.showAxes});` : ''}
          ${settings.showGrid !== undefined ? `api.setGridVisible(${settings.showGrid});` : ''}
          ${settings.xmin !== undefined ? `api.setCoordSystem(${settings.xmin}, ${settings.xmax}, ${settings.ymin}, ${settings.ymax});` : ''}

          // Execute commands
          for (let i = 0; i < commands.length; i++) {
            const cmd = commands[i];
            const result = api.evalCommand(cmd);
            if (!result && !cmd.startsWith('Set')) {
              console.error('GeoGebra command failed: ' + cmd);
            }
          }

          // Wait for rendering to stabilize
          setTimeout(() => {
            window.renderComplete = true;
          }, 1000);

        } catch (error) {
          window.renderError = error.message;
          window.renderComplete = true;
        }
      }
    };

    const applet = new GGBApplet(params, true);
    applet.inject('ggb-container');
  </script>
</body>
</html>`;
}
```

### 3.3 GeoGebra Renderer

**Key difference**: `defaultTimeout = 30000` (GeoGebra is slowest to initialize)

---

## Phase 4: Imagen Implementation

### 4.1 Imagen Types

**File: `src/types/imagen.types.ts`**

```typescript
export interface ImageStyle {
  type: 'realistic' | 'diagram' | 'illustration' | 'simple';
  colorScheme?: 'full-color' | 'muted' | 'monochrome';
  perspective?: 'front' | 'side' | 'isometric' | 'birds-eye';
}

export interface ImagenRenderRequest {
  prompt: {
    text: string;
    context?: string;
    style?: ImageStyle;
  };
  options?: {
    width?: number;
    height?: number;
    numberOfImages?: number;  // 1-4
    seed?: number;
  };
}

export interface ImagenResult {
  success: true;
  images: Array<{ image: string; mimeType: string }>;
  metadata: {
    tool: 'imagen';
    model: string;
    prompt: string;
    width: number;
    height: number;
    imageCount: number;
    renderTimeMs: number;
    timestamp: string;
  };
}
```

### 4.2 Imagen Client (NOT Playwright-based)

**File: `src/services/clients/imagen.client.ts`**

```typescript
// Pseudo-code: Uses Google GenAI SDK, not browser

import { GoogleGenAI, Modality } from '@google/genai';
import { ImagenRenderRequest, ImagenResult } from '../../types/imagen.types';
import logger from '../../utils/logger';

export class ImagenClient {
  private client: GoogleGenAI;
  private readonly model = 'gemini-2.0-flash-preview-image-generation';

  constructor() {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY environment variable not set');
    }
    this.client = new GoogleGenAI({ apiKey });
  }

  async generate(request: ImagenRenderRequest): Promise<ImagenResult> {
    const startTime = Date.now();

    // Build prompt with style guidance
    let fullPrompt = `Educational illustration for mathematics: ${request.prompt.text}`;

    if (request.prompt.style) {
      fullPrompt += `. Style: ${this.buildStyleGuide(request.prompt.style)}`;
    }

    fullPrompt += '. Clear, unambiguous visual suitable for students.';

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: fullPrompt,
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
      });

      const images: Array<{ image: string; mimeType: string }> = [];

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          images.push({
            image: part.inlineData.data,
            mimeType: part.inlineData.mimeType || 'image/png'
          });
        }
      }

      if (images.length === 0) {
        throw new Error('IMAGEN_NO_IMAGES: No images were generated');
      }

      return {
        success: true,
        images,
        metadata: {
          tool: 'imagen',
          model: this.model,
          prompt: request.prompt.text,
          width: request.options?.width || 1024,
          height: request.options?.height || 1024,
          imageCount: images.length,
          renderTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      logger.error('Imagen generation failed', { error });
      throw new Error(`IMAGEN_ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildStyleGuide(style: ImagenRenderRequest['prompt']['style']): string {
    const parts: string[] = [];

    switch (style?.type) {
      case 'realistic': parts.push('photorealistic, detailed'); break;
      case 'diagram': parts.push('clean diagram, technical illustration'); break;
      case 'illustration': parts.push('educational illustration, clear and simple'); break;
      case 'simple': parts.push('simple, minimalist, clean lines'); break;
    }

    if (style?.perspective) parts.push(`${style.perspective} view`);
    if (style?.colorScheme === 'muted') parts.push('muted colors, soft tones');
    if (style?.colorScheme === 'monochrome') parts.push('black and white, grayscale');

    return parts.join(', ');
  }
}
```

### 4.3 Imagen Route (with Rate Limiting)

**File: `src/routes/imagen.routes.ts`**

```typescript
// Pseudo-code: Key difference - uses rate limiting for external API

import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { ImagenClient } from '../services/clients/imagen.client';
import { validateImagenRequest } from '../schemas/imagen.schema';
import { handleError } from '../utils/error-handler';
import logger from '../utils/logger';

export const imagenRouter = Router();

let client: ImagenClient | null = null;

// Rate limit: 10 requests per minute per IP
const imagenRateLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 10,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many imagen requests. Please try again later.'
    }
  }
});

export function initImagenClient(): void {
  if (process.env.GOOGLE_AI_API_KEY) {
    client = new ImagenClient();
    logger.info('Imagen client initialized');
  } else {
    logger.warn('GOOGLE_AI_API_KEY not set - Imagen endpoint disabled');
  }
}

export function isImagenConfigured(): boolean {
  return client !== null;
}

// Apply rate limiter to all imagen routes
imagenRouter.use(imagenRateLimiter);

imagenRouter.post('/', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    if (!client) {
      throw new Error('IMAGEN_NOT_CONFIGURED: GOOGLE_AI_API_KEY not set');
    }

    const validatedRequest = validateImagenRequest(req.body);

    logger.info('Imagen request', { promptLength: validatedRequest.prompt.text.length });

    const result = await client.generate(validatedRequest);

    res.json(result);

    logger.info('Imagen completed', {
      renderTimeMs: Date.now() - startTime,
      imageCount: result.images.length
    });

  } catch (error) {
    logger.error('Imagen failed', {
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime
    });

    handleError(error, res);
  }
});
```

---

## Phase 5: Test Implementation

### 5.1 Test Fixtures

**File: `tests/fixtures/plotly/bar-chart.json`**

```json
{
  "chart": {
    "data": [
      {
        "type": "bar",
        "x": ["Mon", "Tue", "Wed", "Thu", "Fri"],
        "y": [5, 8, 3, 9, 6],
        "marker": {
          "color": ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd"]
        }
      }
    ],
    "layout": {
      "title": "Daily Sales",
      "xaxis": { "title": "Day" },
      "yaxis": { "title": "Units Sold" }
    }
  }
}
```

**File: `tests/fixtures/plotly/invalid-missing-data.json`**

```json
{
  "chart": {
    "layout": { "title": "No Data" }
  }
}
```

### 5.2 Unit Tests

**File: `tests/unit/schemas/plotly.schema.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { validatePlotlyRequest } from '../../../src/schemas/plotly.schema';

describe('Plotly Schema Validation', () => {
  it('accepts valid bar chart', () => {
    const input = {
      chart: {
        data: [{ type: 'bar', x: ['A', 'B'], y: [1, 2] }]
      }
    };

    expect(() => validatePlotlyRequest(input)).not.toThrow();
  });

  it('rejects empty data array', () => {
    const input = {
      chart: { data: [] }
    };

    expect(() => validatePlotlyRequest(input)).toThrow(/At least one trace required/);
  });

  it('rejects invalid trace type', () => {
    const input = {
      chart: {
        data: [{ type: 'invalid', x: [1], y: [1] }]
      }
    };

    expect(() => validatePlotlyRequest(input)).toThrow();
  });

  it('validates width bounds', () => {
    const input = {
      chart: { data: [{ type: 'bar', x: ['A'], y: [1] }] },
      options: { width: 50 }  // Below minimum
    };

    expect(() => validatePlotlyRequest(input)).toThrow();
  });
});
```

**File: `tests/unit/generators/plotly.generator.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { generatePlotlyHTML } from '../../../src/generators/plotly.generator';

describe('Plotly HTML Generator', () => {
  it('generates valid HTML structure', () => {
    const request = {
      chart: {
        data: [{ type: 'bar' as const, x: ['A'], y: [1] }]
      }
    };

    const html = generatePlotlyHTML(request, 800, 600);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('plotly-2.27.0.min.js');
    expect(html).toContain('window.renderComplete');
    expect(html).toContain('Plotly.newPlot');
  });

  it('embeds data correctly', () => {
    const request = {
      chart: {
        data: [{ type: 'scatter' as const, x: [1, 2, 3], y: [4, 5, 6] }]
      }
    };

    const html = generatePlotlyHTML(request, 800, 600);

    expect(html).toContain('[1,2,3]');
    expect(html).toContain('[4,5,6]');
  });

  it('sets dimensions correctly', () => {
    const html = generatePlotlyHTML(
      { chart: { data: [{ type: 'bar' as const }] } },
      1200,
      900
    );

    expect(html).toContain('width: 1200px');
    expect(html).toContain('height: 900px');
  });
});
```

### 5.3 Integration Tests

**File: `tests/integration/plotly.renderer.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PlotlyRenderer } from '../../src/services/renderers/plotly.renderer';
import { BrowserService } from '../../src/services/browser.service';

describe('Plotly Renderer Integration', () => {
  let renderer: PlotlyRenderer;

  beforeAll(async () => {
    renderer = new PlotlyRenderer();
    await renderer.initialize();
  }, 60000);

  afterAll(async () => {
    await BrowserService.getInstance().close();
  });

  it('renders simple bar chart', async () => {
    const request = {
      chart: {
        data: [{ type: 'bar' as const, x: ['A', 'B', 'C'], y: [1, 2, 3] }]
      }
    };

    const result = await renderer.render(request, { width: 800, height: 600 });

    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.length).toBeGreaterThan(1000);  // Reasonable PNG size
    expect(result.metadata.tool).toBe('plotly');
    expect(result.metadata.format).toBe('png');
    expect(result.metadata.width).toBe(800);
    expect(result.metadata.height).toBe(600);
    expect(result.metadata.traceCount).toBe(1);
  }, 30000);

  it('renders scatter plot with multiple traces', async () => {
    const request = {
      chart: {
        data: [
          { type: 'scatter' as const, mode: 'markers' as const, x: [1, 2, 3], y: [4, 5, 6], name: 'Series A' },
          { type: 'scatter' as const, mode: 'lines' as const, x: [1, 2, 3], y: [6, 5, 4], name: 'Series B' }
        ],
        layout: { title: 'Test Plot', showlegend: true }
      }
    };

    const result = await renderer.render(request);

    expect(result.metadata.traceCount).toBe(2);
    expect(result.metadata.chartTypes).toContain('scatter');
  }, 30000);

  it('respects render options', async () => {
    const request = {
      chart: { data: [{ type: 'pie' as const, values: [1, 2, 3], labels: ['A', 'B', 'C'] }] }
    };

    const result = await renderer.render(request, {
      width: 500,
      height: 500,
      format: 'jpeg',
      quality: 80,
      scale: 1
    });

    expect(result.metadata.format).toBe('jpeg');
    expect(result.metadata.width).toBe(500);
    expect(result.metadata.height).toBe(500);
  }, 30000);
});
```

### 5.4 E2E API Tests

**File: `tests/e2e/api.plotly.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index';

describe('POST /api/v1/render/plotly', () => {
  const API_KEY = process.env.API_KEY || 'test-key';

  it('returns 401 without API key', async () => {
    const response = await request(app)
      .post('/api/v1/render/plotly')
      .send({ chart: { data: [{ type: 'bar' }] } });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it('returns 400 for invalid request body', async () => {
    const response = await request(app)
      .post('/api/v1/render/plotly')
      .set('X-API-Key', API_KEY)
      .send({ chart: { data: [] } });  // Empty data array

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 200 with valid bar chart', async () => {
    const response = await request(app)
      .post('/api/v1/render/plotly')
      .set('X-API-Key', API_KEY)
      .send({
        chart: {
          data: [{ type: 'bar', x: ['A', 'B'], y: [1, 2] }]
        }
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.image).toBeTruthy();
    expect(response.body.metadata.tool).toBe('plotly');
  }, 30000);

  it('respects timeout option', async () => {
    const response = await request(app)
      .post('/api/v1/render/plotly')
      .set('X-API-Key', API_KEY)
      .send({
        chart: { data: [{ type: 'bar', x: ['A'], y: [1] }] },
        options: { timeout: 1 }  // 1ms timeout - should fail
      });

    expect(response.status).toBe(408);
    expect(response.body.error.code).toBe('TIMEOUT_ERROR');
  }, 10000);
});
```

### 5.5 Regression Test for Existing Endpoint

**File: `tests/e2e/api.render.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index';

describe('POST /api/v1/render (JSXGraph - FROZEN)', () => {
  const API_KEY = process.env.API_KEY || 'test-key';

  it('still works after adding new renderers', async () => {
    const response = await request(app)
      .post('/api/v1/render')
      .set('X-API-Key', API_KEY)
      .send({
        diagram: {
          board: {
            boundingbox: [-5, 5, 5, -5],
            axis: true
          },
          elements: [
            {
              type: 'point',
              args: [0, 0],
              attributes: { name: 'Origin' }
            }
          ]
        }
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.image).toBeTruthy();
    expect(response.body.metadata.elementCount).toBe(1);
  }, 30000);
});
```

---

## Phase 6: Environment & Docker Updates

### 6.1 Environment Variables

**Add to `.env.example`**:

```bash
# New Renderer Configuration
DESMOS_API_KEY=your-desmos-api-key
GOOGLE_AI_API_KEY=your-google-ai-api-key

# Timeouts (optional - defaults in code)
PLOTLY_TIMEOUT=10000
DESMOS_TIMEOUT=15000
GEOGEBRA_TIMEOUT=30000
IMAGEN_TIMEOUT=30000
```

### 6.2 Package.json Updates

**Add dependencies**:

```json
{
  "dependencies": {
    "@google/genai": "^0.1.0"
  }
}
```

### 6.3 Dockerfile Updates

No changes required - existing Playwright base image supports all browser-based renderers.

---

## Implementation Checklist

### Phase 0: Infrastructure
- [ ] Create `src/types/common.types.ts`
- [ ] Create `src/services/renderer.interface.ts`
- [ ] Create `src/services/browser.service.ts`
- [ ] Create `src/services/renderers/base.playwright.renderer.ts`
- [ ] Create `vitest.config.ts`
- [ ] Create `tests/helpers/test-server.ts`

### Phase 1: Plotly (Pilot)
- [ ] Create `src/types/plotly.types.ts`
- [ ] Create `src/schemas/plotly.schema.ts`
- [ ] Create `src/generators/plotly.generator.ts`
- [ ] Create `src/services/renderers/plotly.renderer.ts`
- [ ] Create `src/routes/plotly.routes.ts`
- [ ] EXTEND `src/index.ts` - add Plotly route
- [ ] EXTEND `src/routes/health.ts` - add Plotly health check
- [ ] Create `tests/fixtures/plotly/*.json`
- [ ] Create `tests/unit/schemas/plotly.schema.test.ts`
- [ ] Create `tests/unit/generators/plotly.generator.test.ts`
- [ ] Create `tests/integration/plotly.renderer.test.ts`
- [ ] Create `tests/e2e/api.plotly.test.ts`
- [ ] Create `tests/e2e/api.render.test.ts` (regression)
- [ ] Test existing `/api/v1/render` still works

### Phase 2: Desmos
- [ ] Create `src/types/desmos.types.ts`
- [ ] Create `src/schemas/desmos.schema.ts`
- [ ] Create `src/generators/desmos.generator.ts`
- [ ] Create `src/services/renderers/desmos.renderer.ts`
- [ ] Create `src/routes/desmos.routes.ts`
- [ ] EXTEND `src/index.ts` - add Desmos route
- [ ] EXTEND `src/routes/health.ts` - add Desmos health check
- [ ] Create tests for Desmos
- [ ] Add `DESMOS_API_KEY` to `.env.example`

### Phase 3: GeoGebra
- [ ] Create `src/types/geogebra.types.ts`
- [ ] Create `src/schemas/geogebra.schema.ts`
- [ ] Create `src/generators/geogebra.generator.ts`
- [ ] Create `src/services/renderers/geogebra.renderer.ts`
- [ ] Create `src/routes/geogebra.routes.ts`
- [ ] EXTEND `src/index.ts` - add GeoGebra route
- [ ] EXTEND `src/routes/health.ts` - add GeoGebra health check
- [ ] Create tests for GeoGebra

### Phase 4: Imagen
- [ ] Create `src/types/imagen.types.ts`
- [ ] Create `src/schemas/imagen.schema.ts`
- [ ] Create `src/services/clients/imagen.client.ts`
- [ ] Create `src/routes/imagen.routes.ts`
- [ ] EXTEND `src/index.ts` - add Imagen route
- [ ] EXTEND `src/routes/health.ts` - add Imagen health check
- [ ] Create tests for Imagen
- [ ] Add `GOOGLE_AI_API_KEY` to `.env.example`
- [ ] Add `@google/genai` to package.json

### Phase 5: Final Integration
- [ ] Update `.env.example` with all new variables
- [ ] Run full test suite
- [ ] Verify Docker build works
- [ ] Test all endpoints manually
- [ ] Update README with new endpoints

---

## Summary

| Phase | Files Created | Files Modified | Endpoints Added |
|-------|---------------|----------------|-----------------|
| 0 | 5 | 1 (vitest.config) | 0 |
| 1 (Plotly) | 9 + tests | 2 (index.ts, health.ts) | POST /api/v1/render/plotly |
| 2 (Desmos) | 5 + tests | 2 | POST /api/v1/render/desmos |
| 3 (GeoGebra) | 5 + tests | 2 | POST /api/v1/render/geogebra |
| 4 (Imagen) | 4 + tests | 2 | POST /api/v1/render/imagen |
| **Total** | ~28 + tests | 2 core files | 4 new endpoints |

**OCP Compliance**: ✅ Existing `renderer.ts`, `render.ts`, `validator.ts`, `html-generator.ts`, `diagram.ts` remain FROZEN.
