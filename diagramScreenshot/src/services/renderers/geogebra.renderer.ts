/**
 * GeoGebra renderer implementation
 * Extends BasePlaywrightRenderer for GeoGebra applet screenshots
 *
 * Best suited for:
 * - Circle theorems and geometric proofs
 * - Geometric constructions (bisectors, perpendiculars)
 * - Similarity and congruence demonstrations
 * - Angle properties and theorems
 */

import { BasePlaywrightRenderer } from './base.playwright.renderer';
import { generateGeoGebraHTML } from '../../generators/geogebra.generator';
import type { RenderResult, RenderMetadata } from '../../types/common.types';
import type { GeoGebraRenderRequest, GeoGebraCommand } from '../../types/geogebra.types';
import logger from '../../utils/logger';

export class GeoGebraRenderer extends BasePlaywrightRenderer {
  readonly name = 'geogebra';
  readonly defaultTimeout = 30000; // GeoGebra applet takes longer to load

  /**
   * Generate HTML for GeoGebra rendering
   */
  generateHTML(input: unknown, width: number, height: number): string {
    const request = input as GeoGebraRenderRequest;
    return generateGeoGebraHTML(request, width, height);
  }

  /**
   * Override render to add GeoGebra-specific metadata
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
    const request = input as GeoGebraRenderRequest;

    // Call base render
    const result = await super.render(input, options);

    // Add GeoGebra-specific metadata
    const geogebraMetadata = this.extractGeoGebraMetadata(request);

    return {
      ...result,
      metadata: {
        ...result.metadata,
        ...geogebraMetadata
      }
    };
  }

  /**
   * Extract GeoGebra-specific metadata from the request
   */
  private extractGeoGebraMetadata(request: GeoGebraRenderRequest): Partial<RenderMetadata> {
    const construction = request.construction;
    const commands = construction.commands || [];
    const styles = construction.styles || [];
    const settings = construction.settings || {};

    // Count commands
    const commandCount = commands.length;

    // Extract command types (rough categorization)
    const commandTypes = this.categorizeCommands(commands);

    return {
      commandCount,
      styleCount: styles.length,
      appType: settings.appType || 'geometry',
      hasAxes: settings.showAxes ?? false,
      hasGrid: settings.showGrid ?? false,
      commandTypes
    };
  }

  /**
   * Categorize commands by type for metadata
   */
  private categorizeCommands(commands: (string | GeoGebraCommand)[]): string[] {
    const types = new Set<string>();

    for (const cmd of commands) {
      const cmdStr = typeof cmd === 'string' ? cmd : cmd.command;

      // Simple pattern matching for common command types
      if (cmdStr.includes('Circle')) types.add('circle');
      if (cmdStr.includes('Point') || /^[A-Z]\d?\s*=\s*\(/.test(cmdStr)) types.add('point');
      if (cmdStr.includes('Line') || cmdStr.includes('Segment') || cmdStr.includes('Ray')) types.add('line');
      if (cmdStr.includes('Polygon') || cmdStr.includes('Triangle')) types.add('polygon');
      if (cmdStr.includes('Angle')) types.add('angle');
      if (cmdStr.includes('Perpendicular') || cmdStr.includes('Bisector')) types.add('construction');
      if (cmdStr.includes('Arc')) types.add('arc');
      if (cmdStr.includes('Tangent')) types.add('tangent');
      if (cmdStr.includes('Intersect')) types.add('intersection');
      if (cmdStr.includes('Midpoint')) types.add('midpoint');
      if (cmdStr.includes('Distance')) types.add('measurement');
    }

    return Array.from(types);
  }
}

// Singleton instance
let geogebraRendererInstance: GeoGebraRenderer | null = null;

/**
 * Get or create the GeoGebra renderer instance
 */
export function getGeoGebraRenderer(): GeoGebraRenderer | null {
  return geogebraRendererInstance;
}

/**
 * Initialize the GeoGebra renderer
 */
export async function initGeoGebraRenderer(): Promise<GeoGebraRenderer> {
  if (!geogebraRendererInstance) {
    geogebraRendererInstance = new GeoGebraRenderer();
    await geogebraRendererInstance.initialize();
    logger.info('geogebra renderer initialized');
  }
  return geogebraRendererInstance;
}

/**
 * Close the GeoGebra renderer
 */
export async function closeGeoGebraRenderer(): Promise<void> {
  if (geogebraRendererInstance) {
    await geogebraRendererInstance.close();
    geogebraRendererInstance = null;
    logger.info('geogebra renderer closed');
  }
}
