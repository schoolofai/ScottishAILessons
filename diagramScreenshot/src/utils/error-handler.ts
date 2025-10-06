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
