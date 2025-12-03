/**
 * Common types shared across all new renderers (Plotly, Desmos, GeoGebra, Imagen)
 *
 * NOTE: These types are for NEW renderers only.
 * The existing JSXGraph renderer uses types from ./diagram.ts (FROZEN)
 */

export interface RenderOptions {
  /** Image width in pixels (100-4000, default: 800) */
  width?: number;
  /** Image height in pixels (100-4000, default: 600) */
  height?: number;
  /** Output format (default: 'png') */
  format?: 'png' | 'jpeg';
  /** JPEG quality 1-100 (default: 90, only applies to jpeg format) */
  quality?: number;
  /** Device scale factor for high DPI (1-4, default: 2) */
  scale?: number;
  /** Render timeout in milliseconds (1000-60000, default varies by renderer) */
  timeout?: number;
  /** Response format (default: 'base64') */
  returnFormat?: 'base64' | 'binary';
}

export interface RenderResult {
  /** The rendered image as a Buffer */
  buffer: Buffer;
  /** Metadata about the render operation */
  metadata: RenderMetadata;
}

export interface RenderMetadata {
  /** The rendering tool used */
  tool: string;
  /** Output format */
  format: 'png' | 'jpeg';
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** Image size in bytes */
  sizeBytes: number;
  /** Time taken to render in milliseconds */
  renderTimeMs: number;
  /** ISO timestamp of render completion */
  timestamp: string;
  /** Tool-specific metadata (e.g., traceCount for Plotly) */
  [key: string]: unknown;
}

export interface RenderSuccessResponse {
  success: true;
  /** Base64-encoded image data */
  image: string;
  /** Render metadata */
  metadata: RenderMetadata;
}

export interface RenderErrorResponse {
  success: false;
  error: {
    /** Error code (e.g., 'VALIDATION_ERROR', 'RENDER_ERROR', 'TIMEOUT_ERROR') */
    code: string;
    /** Human-readable error message */
    message: string;
    /** Additional error details (e.g., validation errors) */
    details?: unknown;
    /** Console errors captured from the browser context */
    consoleErrors?: string[];
  };
}

export type RenderResponse = RenderSuccessResponse | RenderErrorResponse;
