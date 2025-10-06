import { Router, Request, Response } from 'express';
import os from 'os';

let renderer: any = null;

export function setRenderer(r: any) {
  renderer = r;
}

export const healthRouter = Router();

healthRouter.get('/', async (req: Request, res: Response) => {
  try {
    const isHealthy = renderer ? renderer.isInitialized() : false;
    const status = isHealthy ? 'healthy' : 'unhealthy';
    const statusCode = isHealthy ? 200 : 503;

    const memUsage = process.memoryUsage();

    res.status(statusCode).json({
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      playwright: {
        initialized: isHealthy
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
  const isReady = renderer ? renderer.isInitialized() : false;
  res.status(isReady ? 200 : 503).send(isReady ? 'OK' : 'Not Ready');
});

healthRouter.get('/live', (req: Request, res: Response) => {
  // Process is running if this responds
  res.status(200).send('OK');
});
