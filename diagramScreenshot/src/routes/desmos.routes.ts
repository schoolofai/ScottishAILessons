/**
 * Desmos rendering routes
 * Provides endpoints for rendering Desmos calculator graphs
 */

import { Router, Request, Response } from 'express';
import {
  validateDesmosRequest,
  validateSimpleDesmosRequest,
  convertSimpleToFullState,
  safeValidateDesmosRequest,
  safeValidateSimpleDesmosRequest
} from '../schemas/desmos.schema';
import {
  DesmosRenderer,
  initDesmosRenderer,
  getDesmosRenderer
} from '../services/renderers/desmos.renderer';
import logger from '../utils/logger';

export const desmosRouter = Router();

/**
 * POST /
 * Render a Desmos graph using full state format
 */
desmosRouter.post('/', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // Validate request
    const validatedRequest = validateDesmosRequest(req.body);

    const expressionCount = validatedRequest.state.expressions?.list?.length || 0;

    logger.info('Desmos render request received', {
      expressionCount,
      hasViewport: !!validatedRequest.state.graph?.viewport
    });

    // Get renderer
    const renderer = getDesmosRenderer();
    if (!renderer || !renderer.isInitialized()) {
      throw new Error('RENDERER_NOT_INITIALIZED: Desmos renderer not ready');
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

    logger.info('Desmos render completed', {
      renderTimeMs: duration,
      sizeBytes: result.buffer.length,
      expressionCount
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
    const duration = Date.now() - startTime;

    // Check if it's a validation error
    if (error instanceof Error && error.name === 'ZodError') {
      logger.error('Desmos validation failed', {
        duration,
        error: error.message
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
      logger.error('Desmos renderer not initialized', { duration });

      res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Desmos renderer is not available'
        }
      });
      return;
    }

    // Generic error
    logger.error('Desmos render failed', {
      duration,
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'RENDER_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    });
  }
});

/**
 * POST /simple
 * Render a Desmos graph using simplified format (just expressions)
 */
desmosRouter.post('/simple', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // Validate simple request
    const simpleRequest = validateSimpleDesmosRequest(req.body);

    // Convert to full state format
    const fullRequest = convertSimpleToFullState(simpleRequest);

    logger.info('Desmos simple render request received', {
      expressionCount: simpleRequest.expressions.length,
      hasViewport: !!simpleRequest.viewport
    });

    // Get renderer
    const renderer = getDesmosRenderer();
    if (!renderer || !renderer.isInitialized()) {
      throw new Error('RENDERER_NOT_INITIALIZED: Desmos renderer not ready');
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

    logger.info('Desmos simple render completed', {
      renderTimeMs: duration,
      sizeBytes: result.buffer.length,
      expressionCount: simpleRequest.expressions.length
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
    const duration = Date.now() - startTime;

    // Check if it's a validation error
    if (error instanceof Error && error.name === 'ZodError') {
      logger.error('Desmos simple validation failed', {
        duration,
        error: error.message
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
      logger.error('Desmos renderer not initialized', { duration });

      res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Desmos renderer is not available'
        }
      });
      return;
    }

    // Generic error
    logger.error('Desmos simple render failed', {
      duration,
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'RENDER_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    });
  }
});

// Export initialization function
export { initDesmosRenderer, getDesmosRenderer };
