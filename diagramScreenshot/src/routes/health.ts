import { Router, Request, Response } from 'express';
import os from 'os';
import { getPlotlyRenderer } from './plotly.routes';
import { getDesmosRenderer } from './desmos.routes';
import { getGeoGebraRenderer } from './geogebra.routes';
import { isImagenConfigured } from './imagen.routes';

let renderer: any = null;

export function setRenderer(r: any) {
  renderer = r;
}

export const healthRouter = Router();

healthRouter.get('/', async (req: Request, res: Response) => {
  try {
    const jsxgraphHealthy = renderer ? renderer.isInitialized() : false;
    const plotlyRenderer = getPlotlyRenderer();
    const plotlyHealthy = plotlyRenderer ? plotlyRenderer.isInitialized() : false;
    const desmosRenderer = getDesmosRenderer();
    const desmosHealthy = desmosRenderer ? desmosRenderer.isInitialized() : false;
    const geogebraRenderer = getGeoGebraRenderer();
    const geogebraHealthy = geogebraRenderer ? geogebraRenderer.isInitialized() : false;
    const imagenConfigured = isImagenConfigured();

    // Overall health: core renderers must be healthy (Imagen is optional)
    const isHealthy = jsxgraphHealthy && plotlyHealthy && desmosHealthy && geogebraHealthy;
    const status = isHealthy ? 'healthy' : 'unhealthy';
    const statusCode = isHealthy ? 200 : 503;

    const memUsage = process.memoryUsage();

    res.status(statusCode).json({
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      renderers: {
        jsxgraph: {
          initialized: jsxgraphHealthy
        },
        plotly: {
          initialized: plotlyHealthy
        },
        desmos: {
          initialized: desmosHealthy
        },
        geogebra: {
          initialized: geogebraHealthy
        },
        imagen: {
          configured: imagenConfigured,
          note: imagenConfigured ? 'ready' : 'GOOGLE_AI_API_KEY not set'
        }
      },
      // Keep legacy field for backwards compatibility
      playwright: {
        initialized: jsxgraphHealthy
      },
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2)
      },
      system: {
        loadAverage: os.loadavg(),
        freeMemory: os.freemem(),
        totalMemory: os.totalmem()
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

healthRouter.get('/ready', (req: Request, res: Response) => {
  const jsxgraphReady = renderer ? renderer.isInitialized() : false;
  const plotlyRenderer = getPlotlyRenderer();
  const plotlyReady = plotlyRenderer ? plotlyRenderer.isInitialized() : false;
  const desmosRenderer = getDesmosRenderer();
  const desmosReady = desmosRenderer ? desmosRenderer.isInitialized() : false;
  const geogebraRenderer = getGeoGebraRenderer();
  const geogebraReady = geogebraRenderer ? geogebraRenderer.isInitialized() : false;
  const isReady = jsxgraphReady && plotlyReady && desmosReady && geogebraReady;
  res.status(isReady ? 200 : 503).send(isReady ? 'OK' : 'Not Ready');
});

healthRouter.get('/live', (req: Request, res: Response) => {
  // Process is running if this responds
  res.status(200).send('OK');
});
