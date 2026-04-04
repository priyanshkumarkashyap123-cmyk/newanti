/**
 * healthRoutes.ts — Health check endpoint for Node API.
 *
 * GET /health — Liveness endpoint (always 200).
 * GET /health/ready — Readiness endpoint (200 only when DB is connected).
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
 *   200 { status: 'ok', version: string, db: 'connected' | 'connecting' | 'disconnected' }
 *
 * Note:
 *   This is a liveness endpoint and should always return 200 so platform
 *   startup/warmup probes do not fail while dependencies are still initializing.
 */
router.get('/', async (_req: Request, res: Response) => {
  const version = process.env['npm_package_version'] ?? 'unknown';
  const readyState = mongoose.connection.readyState;

  // readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  const dbStatus =
    readyState === 1 ? 'connected' :
    readyState === 2 ? 'connecting' : 'disconnected';

  res.status(200).json({
    status: 'ok',
    version,
    db: dbStatus,
    uptime: process.uptime(),
  });
});

/**
 * GET /health/ready
 * Returns:
 *   200 when DB is connected
 *   503 when DB is not yet ready
 */
router.get('/ready', async (_req: Request, res: Response) => {
  const version = process.env['npm_package_version'] ?? 'unknown';
  const readyState = mongoose.connection.readyState;
  const dbStatus =
    readyState === 1 ? 'connected' :
    readyState === 2 ? 'connecting' : 'disconnected';

  const ready = readyState === 1;

  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'degraded',
    version,
    db: dbStatus,
  });
});

/**
 * GET /health/live
 * Returns:
 *   200 if process is alive
 */
router.get('/live', async (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    version: process.env['npm_package_version'] ?? 'unknown',
    uptime: process.uptime(),
  });
});

export default router;