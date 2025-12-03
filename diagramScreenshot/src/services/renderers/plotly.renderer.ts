/**
 * Plotly Renderer
 *
 * Renders Plotly.js charts to PNG/JPEG images using Playwright.
 * Extends BasePlaywrightRenderer with Plotly-specific HTML generation
 * and metadata enrichment.
 */

import { BasePlaywrightRenderer } from './base.playwright.renderer';
import { generatePlotlyHTML } from '../../generators/plotly.generator';
import type { PlotlyRenderRequest } from '../../types/plotly.types';
import type { RenderOptions, RenderResult } from '../../types/common.types';

export class PlotlyRenderer extends BasePlaywrightRenderer {
  readonly name = 'plotly';
  readonly defaultTimeout = 10000; // 10 seconds - Plotly is fast

  /**
   * Generate HTML for Plotly chart rendering
   */
  generateHTML(input: unknown, width: number, height: number): string {
    return generatePlotlyHTML(input as PlotlyRenderRequest, width, height);
  }

  /**
   * Render Plotly chart with additional metadata
   */
  async render(input: unknown, options: RenderOptions = {}): Promise<RenderResult> {
    // Call base render
    const result = await super.render(input, options);

    // Add Plotly-specific metadata
    const request = input as PlotlyRenderRequest;
    result.metadata.traceCount = request.chart.data.length;
    result.metadata.chartTypes = [...new Set(request.chart.data.map(t => t.type))];

    // Add layout info if present
    if (request.chart.layout?.title) {
      result.metadata.title = typeof request.chart.layout.title === 'string'
        ? request.chart.layout.title
        : request.chart.layout.title.text;
    }

    return result;
  }
}
