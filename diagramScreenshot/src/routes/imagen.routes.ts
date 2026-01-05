/**
 * Imagen API routes
 *
 * POST /api/v1/render/imagen - Generate educational images using AI
 *
 * Rate limited to prevent API abuse
 */

import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import {
  getImagenClient,
  initImagenClient,
  isImagenConfigured
} from '../services/clients/imagen.client';
import { validateImagenRequest } from '../schemas/imagen.schema';
import { handleRenderError } from '../utils/error-handler';
import logger from '../utils/logger';

export const imagenRouter = Router();

/**
 * Rate limiter for Imagen endpoint
 * More restrictive than other endpoints due to external API costs
 */
const imagenRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 10, // 10 requests per minute per IP
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many imagen requests. Please try again later.',
      details: {
        retryAfter: 60
      }
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiter to all imagen routes
imagenRouter.use(imagenRateLimiter);

/**
 * POST / - Generate educational image
 *
 * @body {ImagenRenderRequest} Request body with prompt and options
 * @returns {ImagenSuccessResponse | ImagenErrorResponse}
 */
imagenRouter.post('/', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // Check if Imagen is configured
    if (!isImagenConfigured()) {
      res.status(503).json({
        success: false,
        error: {
          code: 'IMAGEN_NOT_CONFIGURED',
          message: 'Imagen service is not configured. GOOGLE_AI_API_KEY may not be set.'
        }
      });
      return;
    }

    // Validate request
    const validatedRequest = validateImagenRequest(req.body);

    logger.info('Imagen render request', {
      promptLength: validatedRequest.prompt.text.length,
      style: validatedRequest.prompt.style?.type,
      numberOfImages: validatedRequest.options?.numberOfImages || 1
    });

    // Get client and generate
    const client = getImagenClient();
    if (!client) {
      throw new Error('IMAGEN_NOT_INITIALIZED: Client not available');
    }

    const result = await client.generate(validatedRequest);

    // Return success response
    res.json(result);

    logger.info('Imagen render completed', {
      renderTimeMs: Date.now() - startTime,
      imageCount: result.images.length
    });

  } catch (error) {
    // Log error with input metadata (exclude full prompt for privacy/size)
    const inputMeta = {
      promptLength: req.body?.prompt?.text?.length || 0,
      style: req.body?.prompt?.style?.type || 'none',
      options: req.body?.options || {}
    };

    logger.error('Imagen render failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration: Date.now() - startTime,
      inputMeta
    });

    handleRenderError(error, res, 'imagen');
  }
});

/**
 * GET /status - Check Imagen service status
 */
imagenRouter.get('/status', (_req: Request, res: Response) => {
  const configured = isImagenConfigured();

  res.json({
    service: 'imagen',
    status: configured ? 'available' : 'unavailable',
    reason: configured ? null : 'GOOGLE_AI_API_KEY not configured'
  });
});

/**
 * Initialize the Imagen service
 * Called during server startup
 */
export { initImagenClient, isImagenConfigured };
