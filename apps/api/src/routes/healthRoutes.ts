/**
 * healthRoutes.ts — Health check endpoint for Node API.
 *
 * GET /health — Returns service status and DB connectivity.
 * No authentication required.
 *
 * Requirements: 18.3, 18.4
 */

import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';

const router: Router = Router();

/**
 * GET /health
 * Returns:
 *   200 { status: 'ok', version: string, db: 'connected' | 'disconnected' }
 *   503 { status: 'degraded', version: string, db: 'disconnected' }
 */
router.get('/', async (_req: Request, res: Response) => {
  const version = process.env['npm_package_version'] ?? 'unknown';
  const readyState = mongoose.connection.readyState;

  // readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  const dbStatus = readyState === 1 ? 'connected' : 'disconnected';
  const isHealthy = readyState === 1 || readyState === 2;

  const body = {
    status: isHealthy ? 'ok' : 'degraded',
    version,
    db: dbStatus,
    uptime: process.uptime(),
  };

  res.status(isHealthy ? 200 : 503).json(body);
});

router.get('/ready', async (_req: Request, res: Response) => {
  const version = process.env['npm_package_version'] ?? 'unknown';
  const readyState = mongoose.connection.readyState;
  const dbStatus = readyState === 1 ? 'connected' : 'disconnected';
  const ready = readyState === 1;

  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'degraded',
    version,
    db: dbStatus,
  });
});

router.get('/live', async (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    version: process.env['npm_package_version'] ?? 'unknown',
    uptime: process.uptime(),
  });
});

export default router;
