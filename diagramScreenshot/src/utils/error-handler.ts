import { Response } from 'express';
import { ZodError } from 'zod';

export class RenderError extends Error {
  constructor(
    message: string,
    public originalError: Error,
    public metadata: Record<string, any> = {}
  ) {
    super(message);
    this.name = 'RenderError';
  }
}

export function handleError(error: unknown, res: Response): void {
  // Zod validation error
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid diagram configuration',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          issue: err.message,
          received: (err as any).received
        }))
      }
    });
    return;
  }

  // Rendering error
  if (error instanceof RenderError) {
    res.status(500).json({
      success: false,
      error: {
        code: 'RENDER_ERROR',
        message: error.message,
        details: error.metadata,
        consoleErrors: error.metadata.consoleErrors || []
      }
    });
    return;
  }

  // Timeout error
  if (error instanceof Error && error.message.includes('timeout')) {
    res.status(408).json({
      success: false,
      error: {
        code: 'TIMEOUT_ERROR',
        message: 'Rendering exceeded maximum allowed time',
        suggestion: 'Reduce element count or increase timeout option'
      }
    });
    return;
  }

  // Generic error
  console.error('Unexpected error:', error);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    }
  });
}

/**
 * Handle render errors with tool-specific error codes
 */
export function handleRenderError(error: unknown, res: Response, tool: string): void {
  // Zod validation error
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `Invalid ${tool} configuration`,
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          issue: err.message,
          received: (err as any).received
        }))
      }
    });
    return;
  }

  const errorMessage = error instanceof Error ? error.message : String(error);

  // Safety block (Imagen specific)
  if (errorMessage.includes('SAFETY') || errorMessage.includes('IMAGEN_SAFETY_BLOCK')) {
    res.status(400).json({
      success: false,
      error: {
        code: 'SAFETY_BLOCK',
        message: 'Content was blocked by safety filters. Please modify your prompt.',
        tool
      }
    });
    return;
  }

  // Rate limit (Imagen specific)
  if (errorMessage.includes('RATE_LIMIT') || errorMessage.includes('quota')) {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT',
        message: 'API rate limit exceeded. Please try again later.',
        tool
      }
    });
    return;
  }

  // Not configured
  if (errorMessage.includes('NOT_CONFIGURED') || errorMessage.includes('NOT_INITIALIZED')) {
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: `${tool} service is not configured or unavailable`,
        tool
      }
    });
    return;
  }

  // Timeout error
  if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
    res.status(408).json({
      success: false,
      error: {
        code: 'TIMEOUT_ERROR',
        message: 'Request exceeded maximum allowed time',
        tool
      }
    });
    return;
  }

  // No images generated (Imagen specific)
  if (errorMessage.includes('NO_IMAGES')) {
    res.status(422).json({
      success: false,
      error: {
        code: 'GENERATION_FAILED',
        message: 'No images were generated. Try modifying your prompt.',
        tool
      }
    });
    return;
  }

  // Rendering error
  if (error instanceof RenderError) {
    res.status(500).json({
      success: false,
      error: {
        code: 'RENDER_ERROR',
        message: error.message,
        tool,
        details: error.metadata,
        consoleErrors: error.metadata.consoleErrors || []
      }
    });
    return;
  }

  // Generic error
  console.error(`${tool} unexpected error:`, error);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: errorMessage,
      tool
    }
  });
}
