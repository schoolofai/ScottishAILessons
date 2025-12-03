/**
 * Abstract interfaces for new renderers
 *
 * NOTE: These interfaces are for NEW renderers only (Plotly, Desmos, GeoGebra).
 * The existing DiagramRenderer class (FROZEN) does not implement these interfaces.
 */

import { RenderOptions, RenderResult } from '../types/common.types';

/**
 * Base interface for all new renderers
 */
export interface IRenderer {
  /** Unique name identifying this renderer */
  readonly name: string;

  /** Default timeout in milliseconds for render operations */
  readonly defaultTimeout: number;

  /**
   * Initialize the renderer (e.g., start browser)
   * Must be called before render()
   */
  initialize(): Promise<void>;

  /**
   * Render the input and return the result
   * @param input - Renderer-specific input (e.g., PlotlyRenderRequest)
   * @param options - Render options (width, height, format, etc.)
   */
  render(input: unknown, options: RenderOptions): Promise<RenderResult>;

  /**
   * Clean up resources (e.g., close browser)
   */
  close(): Promise<void>;

  /**
   * Check if the renderer is ready to accept render requests
   */
  isInitialized(): boolean;
}

/**
 * Interface for browser-based renderers (Plotly, Desmos, GeoGebra)
 * These renderers generate HTML and capture screenshots via Playwright
 */
export interface IPlaywrightRenderer extends IRenderer {
  /**
   * Generate self-contained HTML for rendering
   * @param input - Renderer-specific input
   * @param width - Viewport width
   * @param height - Viewport height
   * @returns HTML string to be loaded in browser
   */
  generateHTML(input: unknown, width: number, height: number): string;
}
