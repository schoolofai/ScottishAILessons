import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import dotenv from 'dotenv';

import { renderRouter, setRenderer as setRenderRenderer } from './routes/render';
import { healthRouter, setRenderer as setHealthRenderer } from './routes/health';
import { apiKeyAuth } from './middleware/auth';
import logger from './utils/logger';
import { DiagramRenderer } from './services/renderer';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Global renderer instance
const renderer = new DiagramRenderer();

// Set renderer in routes
setRenderRenderer(renderer);
setHealthRenderer(renderer);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || '*',
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: process.env.MAX_REQUEST_SIZE || '5mb' }));

// Routes
app.use('/api/v1/render', apiKeyAuth, renderRouter);
app.use('/health', healthRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`
    }
  });
});

// Initialize and start server
async function start() {
  try {
    logger.info('Initializing DiagramScreenshot service...');

    // Initialize Playwright browser
    await renderer.initialize();
    logger.info('Playwright browser initialized');

    // Start server
    app.listen(PORT, () => {
      logger.info(`Server listening on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`Render endpoint: http://localhost:${PORT}/api/v1/render`);
    });

  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error
    });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await renderer.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await renderer.close();
  process.exit(0);
});

start();

export { app };
