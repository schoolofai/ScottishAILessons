import { Router, Request, Response } from 'express';
import { validateRenderRequest } from '../services/validator';
import { handleError } from '../utils/error-handler';
import logger from '../utils/logger';

let renderer: any = null;

export function setRenderer(r: any) {
  renderer = r;
}

export const renderRouter = Router();

renderRouter.post('/', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // Validate request
    const { diagram, options } = validateRenderRequest(req.body);

    logger.info('Render request validated', {
      elementCount: diagram.elements.length,
      options
    });

    if (!renderer) {
      throw new Error('Renderer not initialized');
    }

    // Render diagram
    const buffer = await renderer.render(diagram, options || {});

    const duration = Date.now() - startTime;

    // Return response
    const imageBase64 = buffer.toString('base64');

    res.json({
      success: true,
      image: imageBase64,
      metadata: {
        format: options?.format || 'png',
        width: options?.width || 800,
        height: options?.height || 600,
        sizeBytes: buffer.length,
        renderTimeMs: duration,
        elementCount: diagram.elements.length,
        timestamp: new Date().toISOString()
      }
    });

    logger.info('Render completed', {
      duration,
      elementCount: diagram.elements.length,
      sizeBytes: buffer.length
    });

  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('Render failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration,
      input: JSON.stringify(req.body, null, 2)
    });

    handleError(error, res);
  }
});
