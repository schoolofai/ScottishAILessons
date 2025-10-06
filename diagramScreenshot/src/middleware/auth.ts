import { Request, Response, NextFunction } from 'express';

export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  const validApiKey = process.env.API_KEY;

  if (!validApiKey) {
    // API key not configured, allow all (development only)
    if (process.env.NODE_ENV === 'development') {
      return next();
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_NOT_CONFIGURED',
        message: 'API authentication not configured'
      }
    });
    return;
  }

  if (!apiKey || apiKey !== validApiKey) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing API key'
      }
    });
    return;
  }

  next();
}
