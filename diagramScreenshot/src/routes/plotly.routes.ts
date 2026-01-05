/**
 * Plotly Render Routes
 *
 * POST /api/v1/render/plotly - Render Plotly chart to image
 */

import { Router, Request, Response } from 'express';
import { PlotlyRenderer } from '../services/renderers/plotly.renderer';
import { validatePlotlyRequest } from '../schemas/plotly.schema';
import { handleError } from '../utils/error-handler';
import logger from '../utils/logger';

export const plotlyRouter = Router();

// Module-level renderer instance
let renderer: PlotlyRenderer | null = null;

/**
 * Initialize the Plotly renderer
 * Must be called during server startup
 */
export async function initPlotlyRenderer(): Promise<void> {
  renderer = new PlotlyRenderer();
  await renderer.initialize();
  logger.info('Plotly renderer initialized');
}

/**
 * Get the current Plotly renderer instance
 * Used by health checks
 */
export function getPlotlyRenderer(): PlotlyRenderer | null {
  return renderer;
}

/**
 * POST /
 * Render a Plotly chart to image
 */
plotlyRouter.post('/', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // 1. Validate request body
    const validatedRequest = validatePlotlyRequest(req.body);

    logger.info('Plotly render request received', {
      traceCount: validatedRequest.chart.data.length,
      chartTypes: validatedRequest.chart.data.map(t => t.type)
    });

    // 2. Check renderer is ready
    if (!renderer || !renderer.isInitialized()) {
      throw new Error('RENDERER_NOT_INITIALIZED: Plotly renderer not ready');
    }

    // 3. Render the chart
    const result = await renderer.render(
      validatedRequest,
      validatedRequest.options || {}
    );

    // 4. Return success response
    res.json({
      success: true,
      image: result.buffer.toString('base64'),
      metadata: result.metadata
    });

    logger.info('Plotly render completed', {
      renderTimeMs: Date.now() - startTime,
      sizeBytes: result.buffer.length,
      traceCount: result.metadata.traceCount
    });

  } catch (error) {
    logger.error('Plotly render failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration: Date.now() - startTime,
      input: JSON.stringify(req.body, null, 2)
    });

    handleError(error, res);
  }
});
