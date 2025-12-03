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

// NEW: Plotly renderer imports
import { plotlyRouter, initPlotlyRenderer } from './routes/plotly.routes';
import { BrowserService } from './services/browser.service';

// NEW: Desmos renderer imports
import { desmosRouter, initDesmosRenderer } from './routes/desmos.routes';

// NEW: GeoGebra renderer imports
import { geogebraRouter, initGeoGebraRenderer } from './routes/geogebra.routes';

// NEW: Imagen AI image generation imports
import { imagenRouter, initImagenClient, isImagenConfigured } from './routes/imagen.routes';

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
app.use('/api/v1/render/plotly', apiKeyAuth, plotlyRouter);
app.use('/api/v1/render/desmos', apiKeyAuth, desmosRouter);
app.use('/api/v1/render/geogebra', apiKeyAuth, geogebraRouter);
app.use('/api/v1/render/imagen', apiKeyAuth, imagenRouter);
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

    // Initialize Playwright browser (existing JSXGraph renderer)
    await renderer.initialize();
    logger.info('Playwright browser initialized');

    // Initialize new renderers (Plotly, Desmos, etc.)
    await initPlotlyRenderer();
    logger.info('Plotly renderer initialized');

    await initDesmosRenderer();
    logger.info('Desmos renderer initialized');

    // Initialize GeoGebra renderer
    await initGeoGebraRenderer();
    logger.info('GeoGebra renderer initialized');

    // Initialize Imagen client (optional - depends on API key)
    const imagenInitialized = initImagenClient();
    if (imagenInitialized) {
      logger.info('Imagen client initialized');
    } else {
      logger.warn('Imagen client not initialized - GOOGLE_AI_API_KEY not set');
    }

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
  await BrowserService.getInstance().close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await renderer.close();
  await BrowserService.getInstance().close();
  process.exit(0);
});

start();

export { app };
