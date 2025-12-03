/**
 * Desmos renderer implementation
 * Extends BasePlaywrightRenderer for Desmos calculator screenshots
 */

import { BasePlaywrightRenderer } from './base.playwright.renderer';
import { generateDesmosHTML } from '../../generators/desmos.generator';
import type { RenderResult, RenderMetadata } from '../../types/common.types';
import type { DesmosRenderRequest } from '../../types/desmos.types';
import logger from '../../utils/logger';

export class DesmosRenderer extends BasePlaywrightRenderer {
  readonly name = 'desmos';
  readonly defaultTimeout = 15000; // Desmos may take longer due to complex expressions

  /**
   * Generate HTML for Desmos rendering
   */
  generateHTML(input: unknown, width: number, height: number): string {
    const request = input as DesmosRenderRequest;
    return generateDesmosHTML(request, width, height);
  }

  /**
   * Override render to add Desmos-specific metadata
   */
  async render(
    input: unknown,
    options: {
      width?: number;
      height?: number;
      format?: 'png' | 'jpeg';
      quality?: number;
      scale?: number;
      timeout?: number;
    } = {}
  ): Promise<RenderResult> {
    const request = input as DesmosRenderRequest;

    // Call base render
    const result = await super.render(input, options);

    // Add Desmos-specific metadata
    const desmosMetadata = this.extractDesmosMetadata(request);

    return {
      ...result,
      metadata: {
        ...result.metadata,
        ...desmosMetadata
      }
    };
  }

  /**
   * Extract Desmos-specific metadata from the request
   */
  private extractDesmosMetadata(request: DesmosRenderRequest): Partial<RenderMetadata> {
    const expressions = request.state.expressions?.list || [];

    // Count expression types
    let expressionCount = 0;
    let tableCount = 0;
    let folderCount = 0;
    let textCount = 0;
    let imageCount = 0;

    for (const item of expressions) {
      if ('type' in item) {
        switch (item.type) {
          case 'table':
            tableCount++;
            break;
          case 'folder':
            folderCount++;
            break;
          case 'text':
            textCount++;
            break;
          case 'image':
            imageCount++;
            break;
          default:
            expressionCount++;
        }
      } else {
        // Default is expression
        expressionCount++;
      }
    }

    // Extract viewport if set
    const viewport = request.state.graph?.viewport;

    // Check for special modes
    const polarMode = request.state.graph?.polarMode || false;
    const degreeMode = request.state.graph?.degreeMode || false;

    return {
      expressionCount,
      tableCount,
      folderCount,
      textCount,
      imageCount,
      totalItems: expressions.length,
      viewport: viewport ? {
        xmin: viewport.xmin,
        xmax: viewport.xmax,
        ymin: viewport.ymin,
        ymax: viewport.ymax
      } : undefined,
      polarMode,
      degreeMode
    };
  }
}

// Singleton instance
let desmosRendererInstance: DesmosRenderer | null = null;

/**
 * Get or create the Desmos renderer instance
 */
export function getDesmosRenderer(): DesmosRenderer | null {
  return desmosRendererInstance;
}

/**
 * Initialize the Desmos renderer
 */
export async function initDesmosRenderer(): Promise<DesmosRenderer> {
  if (!desmosRendererInstance) {
    desmosRendererInstance = new DesmosRenderer();
    await desmosRendererInstance.initialize();
    logger.info('desmos renderer initialized');
  }
  return desmosRendererInstance;
}

/**
 * Close the Desmos renderer
 */
export async function closeDesmosRenderer(): Promise<void> {
  if (desmosRendererInstance) {
    await desmosRendererInstance.close();
    desmosRendererInstance = null;
    logger.info('desmos renderer closed');
  }
}
