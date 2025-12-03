/**
 * Unit tests for Plotly HTML generator
 */

import { describe, it, expect } from 'vitest';
import { generatePlotlyHTML } from '../../src/generators/plotly.generator';
import type { PlotlyRenderRequest } from '../../src/types/plotly.types';

describe('Plotly HTML Generator', () => {
  const basicRequest: PlotlyRenderRequest = {
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

  describe('generatePlotlyHTML', () => {
    it('should generate valid HTML document', () => {
      const html = generatePlotlyHTML(basicRequest, 800, 600);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('</html>');
    });

    it('should include Plotly.js CDN', () => {
      const html = generatePlotlyHTML(basicRequest, 800, 600);

      expect(html).toContain('cdn.plot.ly/plotly-');
      expect(html).toContain('.min.js');
    });

    it('should set correct viewport dimensions', () => {
      const html = generatePlotlyHTML(basicRequest, 1200, 900);

      expect(html).toContain('width: 1200px');
      expect(html).toContain('height: 900px');
    });

    it('should embed chart data as JSON', () => {
      const request: PlotlyRenderRequest = {
        chart: {
          data: [
            {
              type: 'scatter',
              x: [1, 2, 3],
              y: [4, 5, 6],
              name: 'Test Data'
            }
          ]
        }
      };

      const html = generatePlotlyHTML(request, 800, 600);

      // Data should be embedded in the script
      expect(html).toContain('"type":"scatter"');
      expect(html).toContain('"name":"Test Data"');
    });

    it('should include render completion signaling', () => {
      const html = generatePlotlyHTML(basicRequest, 800, 600);

      expect(html).toContain('window.renderComplete = false');
      expect(html).toContain('window.renderComplete = true');
    });

    it('should include error capture mechanism', () => {
      const html = generatePlotlyHTML(basicRequest, 800, 600);

      expect(html).toContain('window.renderError = null');
      expect(html).toContain('window.consoleErrors = []');
      expect(html).toContain('window.onerror');
    });

    it('should force static plot configuration', () => {
      const html = generatePlotlyHTML(basicRequest, 800, 600);

      expect(html).toContain('staticPlot');
      expect(html).toContain('displayModeBar');
    });

    it('should escape < characters for XSS prevention', () => {
      const request: PlotlyRenderRequest = {
        chart: {
          data: [
            {
              type: 'bar',
              x: ['<script>alert("xss")</script>'],
              y: [1]
            }
          ]
        }
      };

      const html = generatePlotlyHTML(request, 800, 600);

      // Should not contain unescaped script tags
      expect(html).not.toContain('<script>alert');
      expect(html).toContain('\\u003c');
    });

    it('should include layout configuration', () => {
      const request: PlotlyRenderRequest = {
        chart: {
          data: [{ type: 'bar', x: ['A'], y: [1] }],
          layout: {
            title: 'Test Title',
            xaxis: { title: 'X Label' }
          }
        }
      };

      const html = generatePlotlyHTML(request, 800, 600);

      expect(html).toContain('Test Title');
      expect(html).toContain('X Label');
    });

    it('should apply default margins when not specified', () => {
      const html = generatePlotlyHTML(basicRequest, 800, 600);

      // Default margins should be applied
      expect(html).toContain('"margin"');
    });

    it('should preserve custom margins', () => {
      const request: PlotlyRenderRequest = {
        chart: {
          data: [{ type: 'bar', x: ['A'], y: [1] }],
          layout: {
            margin: { l: 100, r: 50, t: 80, b: 60 }
          }
        }
      };

      const html = generatePlotlyHTML(request, 800, 600);

      expect(html).toContain('"l":100');
      expect(html).toContain('"r":50');
    });

    it('should include chart container div', () => {
      const html = generatePlotlyHTML(basicRequest, 800, 600);

      expect(html).toContain('<div id="chart"></div>');
      expect(html).toContain("Plotly.newPlot('chart'");
    });

    it('should use Plotly.newPlot for rendering', () => {
      const html = generatePlotlyHTML(basicRequest, 800, 600);

      expect(html).toContain('Plotly.newPlot');
      expect(html).toContain('.then(function()');
      expect(html).toContain('.catch(function(error)');
    });

    it('should handle config options', () => {
      const request: PlotlyRenderRequest = {
        chart: {
          data: [{ type: 'bar', x: ['A'], y: [1] }],
          config: {
            responsive: false,
            displayModeBar: false
          }
        }
      };

      const html = generatePlotlyHTML(request, 800, 600);

      expect(html).toContain('responsive');
    });

    it('should reset CSS box model', () => {
      const html = generatePlotlyHTML(basicRequest, 800, 600);

      expect(html).toContain('box-sizing: border-box');
      expect(html).toContain('margin: 0');
      expect(html).toContain('padding: 0');
    });

    it('should set white background', () => {
      const html = generatePlotlyHTML(basicRequest, 800, 600);

      expect(html).toContain('background-color: white');
    });

    it('should prevent overflow', () => {
      const html = generatePlotlyHTML(basicRequest, 800, 600);

      expect(html).toContain('overflow: hidden');
    });
  });
});
