/**
 * Integration tests for Plotly renderer
 * These tests use a real browser via Playwright
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PlotlyRenderer } from '../../src/services/renderers/plotly.renderer';
import { BrowserService } from '../../src/services/browser.service';
import type { PlotlyRenderRequest } from '../../src/types/plotly.types';

describe('PlotlyRenderer Integration', () => {
  let renderer: PlotlyRenderer;

  beforeAll(async () => {
    renderer = new PlotlyRenderer();
    await renderer.initialize();
  }, 30000);

  afterAll(async () => {
    await renderer.close();
    await BrowserService.getInstance().close();
  });

  describe('initialization', () => {
    it('should be initialized after calling initialize()', () => {
      expect(renderer.isInitialized()).toBe(true);
    });

    it('should have correct name', () => {
      expect(renderer.name).toBe('plotly');
    });

    it('should have reasonable default timeout', () => {
      expect(renderer.defaultTimeout).toBeGreaterThan(0);
      expect(renderer.defaultTimeout).toBeLessThanOrEqual(60000);
    });
  });

  describe('render', () => {
    it('should render a basic bar chart', async () => {
      const request: PlotlyRenderRequest = {
        chart: {
          data: [
            {
              type: 'bar',
              x: ['A', 'B', 'C'],
              y: [10, 20, 30]
            }
          ]
        }
      };

      const result = await renderer.render(request, {
        width: 800,
        height: 600,
        format: 'png'
      });

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer.length).toBeGreaterThan(0);
      expect(result.metadata.format).toBe('png');
      expect(result.metadata.width).toBe(800);
      expect(result.metadata.height).toBe(600);
    }, 30000);

    it('should render a scatter plot', async () => {
      const request: PlotlyRenderRequest = {
        chart: {
          data: [
            {
              type: 'scatter',
              x: [1, 2, 3, 4, 5],
              y: [2, 4, 6, 8, 10],
              mode: 'lines+markers'
            }
          ]
        }
      };

      const result = await renderer.render(request, {
        width: 800,
        height: 600
      });

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.metadata.traceCount).toBe(1);
      expect(result.metadata.chartTypes).toContain('scatter');
    }, 30000);

    it('should render a pie chart', async () => {
      const request: PlotlyRenderRequest = {
        chart: {
          data: [
            {
              type: 'pie',
              values: [30, 25, 20, 15, 10],
              labels: ['A', 'B', 'C', 'D', 'E']
            }
          ]
        }
      };

      const result = await renderer.render(request, {
        width: 600,
        height: 600
      });

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.metadata.chartTypes).toContain('pie');
    }, 30000);

    it('should render with custom scale', async () => {
      const request: PlotlyRenderRequest = {
        chart: {
          data: [{ type: 'bar', x: ['A'], y: [1] }]
        }
      };

      const result = await renderer.render(request, {
        width: 400,
        height: 300,
        scale: 2
      });

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.metadata.scale).toBe(2);
    }, 30000);

    it('should render as JPEG when specified', async () => {
      const request: PlotlyRenderRequest = {
        chart: {
          data: [{ type: 'bar', x: ['A'], y: [1] }]
        }
      };

      const result = await renderer.render(request, {
        width: 800,
        height: 600,
        format: 'jpeg',
        quality: 80
      });

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.metadata.format).toBe('jpeg');
    }, 30000);

    it('should include chart title in metadata', async () => {
      const request: PlotlyRenderRequest = {
        chart: {
          data: [{ type: 'bar', x: ['A'], y: [1] }],
          layout: {
            title: 'My Test Chart'
          }
        }
      };

      const result = await renderer.render(request, {
        width: 800,
        height: 600
      });

      expect(result.metadata.title).toBe('My Test Chart');
    }, 30000);

    it('should handle complex title objects', async () => {
      const request: PlotlyRenderRequest = {
        chart: {
          data: [{ type: 'bar', x: ['A'], y: [1] }],
          layout: {
            title: { text: 'Complex Title' }
          }
        }
      };

      const result = await renderer.render(request, {
        width: 800,
        height: 600
      });

      expect(result.metadata.title).toBe('Complex Title');
    }, 30000);

    it('should track trace count in metadata', async () => {
      const request: PlotlyRenderRequest = {
        chart: {
          data: [
            { type: 'bar', x: ['A', 'B'], y: [10, 20], name: 'Series 1' },
            { type: 'bar', x: ['A', 'B'], y: [15, 25], name: 'Series 2' },
            { type: 'bar', x: ['A', 'B'], y: [12, 18], name: 'Series 3' }
          ]
        }
      };

      const result = await renderer.render(request, {
        width: 800,
        height: 600
      });

      expect(result.metadata.traceCount).toBe(3);
    }, 30000);

    it('should track unique chart types', async () => {
      const request: PlotlyRenderRequest = {
        chart: {
          data: [
            { type: 'scatter', x: [1, 2], y: [1, 2], mode: 'lines' },
            { type: 'scatter', x: [1, 2], y: [2, 3], mode: 'markers' },
            { type: 'bar', x: ['A', 'B'], y: [10, 20] }
          ]
        }
      };

      const result = await renderer.render(request, {
        width: 800,
        height: 600
      });

      expect(result.metadata.chartTypes).toContain('scatter');
      expect(result.metadata.chartTypes).toContain('bar');
      expect(result.metadata.chartTypes?.length).toBe(2); // Unique types only
    }, 30000);

    it('should include render duration in metadata', async () => {
      const request: PlotlyRenderRequest = {
        chart: {
          data: [{ type: 'bar', x: ['A'], y: [1] }]
        }
      };

      const result = await renderer.render(request, {
        width: 800,
        height: 600
      });

      expect(result.metadata.renderDurationMs).toBeDefined();
      expect(result.metadata.renderDurationMs).toBeGreaterThan(0);
    }, 30000);
  });

  describe('error handling', () => {
    it('should timeout on very long rendering', async () => {
      const request: PlotlyRenderRequest = {
        chart: {
          data: [{ type: 'bar', x: ['A'], y: [1] }]
        }
      };

      // Set an extremely short timeout to force failure
      await expect(
        renderer.render(request, {
          width: 800,
          height: 600,
          timeout: 1 // 1ms timeout should fail
        })
      ).rejects.toThrow();
    }, 30000);
  });
});
