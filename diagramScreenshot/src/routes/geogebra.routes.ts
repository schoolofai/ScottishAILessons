/**
 * GeoGebra rendering routes
 * Provides endpoints for rendering GeoGebra geometric constructions
 *
 * Best suited for:
 * - Circle theorems and geometric proofs
 * - Geometric constructions (bisectors, perpendiculars)
 * - Similarity and congruence demonstrations
 * - Angle properties and theorems
 */

import { Router, Request, Response } from 'express';
import {
  validateGeoGebraRequest,
  validateSimpleGeoGebraRequest,
  convertSimpleToFullConstruction
} from '../schemas/geogebra.schema';
import {
  GeoGebraRenderer,
  initGeoGebraRenderer,
  getGeoGebraRenderer
} from '../services/renderers/geogebra.renderer';
import logger from '../utils/logger';

export const geogebraRouter = Router();

/**
 * POST /
 * Render a GeoGebra construction using full format
 */
geogebraRouter.post('/', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // Validate request
    const validatedRequest = validateGeoGebraRequest(req.body);

    const commandCount = validatedRequest.construction.commands.length;
    const styleCount = validatedRequest.construction.styles?.length || 0;

    logger.info('GeoGebra render request received', {
      commandCount,
      styleCount,
      appType: validatedRequest.construction.settings?.appType || 'geometry'
    });

    // Get renderer
    const renderer = getGeoGebraRenderer();
    if (!renderer || !renderer.isInitialized()) {
      throw new Error('RENDERER_NOT_INITIALIZED: GeoGebra renderer not ready');
    }

    // Extract options
    const options = validatedRequest.options || {};
    const width = options.width || 800;
    const height = options.height || 600;
    const format = options.format || 'png';
    const quality = options.quality || 90;
    const scale = options.scale || 2;
    const timeout = options.timeout || renderer.defaultTimeout;

    // Render
    const result = await renderer.render(validatedRequest, {
      width,
      height,
      format,
      quality,
      scale,
      timeout
    });

    const duration = Date.now() - startTime;

    // Return response
    const imageBase64 = result.buffer.toString('base64');

    logger.info('GeoGebra render completed', {
      renderTimeMs: duration,
      sizeBytes: result.buffer.length,
      commandCount
    });

    res.json({
      success: true,
      image: imageBase64,
      metadata: {
        ...result.metadata,
        renderTimeMs: duration
      }
    });

  } catch (error) {
    handleGeoGebraError(error, res, startTime, req.body);
  }
});

/**
 * POST /simple
 * Render a GeoGebra construction using simplified format (just commands)
 */
geogebraRouter.post('/simple', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // Validate simple request
    const simpleRequest = validateSimpleGeoGebraRequest(req.body);

    // Convert to full construction format
    const fullRequest = convertSimpleToFullConstruction(simpleRequest);

    logger.info('GeoGebra simple render request received', {
      commandCount: simpleRequest.commands.length,
      hasCoordSystem: !!simpleRequest.coordSystem
    });

    // Get renderer
    const renderer = getGeoGebraRenderer();
    if (!renderer || !renderer.isInitialized()) {
      throw new Error('RENDERER_NOT_INITIALIZED: GeoGebra renderer not ready');
    }

    // Extract options
    const options = simpleRequest.options || {};
    const width = options.width || 800;
    const height = options.height || 600;
    const format = options.format || 'png';
    const quality = options.quality || 90;
    const scale = options.scale || 2;
    const timeout = options.timeout || renderer.defaultTimeout;

    // Render
    const result = await renderer.render(fullRequest, {
      width,
      height,
      format,
      quality,
      scale,
      timeout
    });

    const duration = Date.now() - startTime;

    // Return response
    const imageBase64 = result.buffer.toString('base64');

    logger.info('GeoGebra simple render completed', {
      renderTimeMs: duration,
      sizeBytes: result.buffer.length,
      commandCount: simpleRequest.commands.length
    });

    res.json({
      success: true,
      image: imageBase64,
      metadata: {
        ...result.metadata,
        renderTimeMs: duration
      }
    });

  } catch (error) {
    handleGeoGebraError(error, res, startTime, req.body);
  }
});

/**
 * Centralized error handler for GeoGebra routes
 */
function handleGeoGebraError(
  error: unknown,
  res: Response,
  startTime: number,
  requestBody?: unknown
): void {
  const duration = Date.now() - startTime;
  const inputLog = requestBody ? JSON.stringify(requestBody, null, 2) : 'N/A';

  // Check if it's a validation error
  if (error instanceof Error && error.name === 'ZodError') {
    logger.error('GeoGebra validation failed', {
      duration,
      error: error.message,
      input: inputLog
    });

    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request format',
        details: error.message
      }
    });
    return;
  }

  // Check for renderer not initialized
  if (error instanceof Error && error.message.includes('RENDERER_NOT_INITIALIZED')) {
    logger.error('GeoGebra renderer not initialized', { duration, input: inputLog });

    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'GeoGebra renderer is not available'
      }
    });
    return;
  }

  // Generic error - LOG THE FULL INPUT for debugging
  logger.error('GeoGebra render failed', {
    duration,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    input: inputLog
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'RENDER_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  });
}

// Export initialization function
export { initGeoGebraRenderer, getGeoGebraRenderer };
