/**
 * Layout Routes - Proxy to Python layout optimizer
 *
 * Security goal: frontend calls Node API only; Python service stays private.
 */

import { Router, Request, Response, type IRouter } from "express";
import { pythonProxy } from "../../services/serviceProxy.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { logger } from "../../utils/logger.js";

const router: IRouter = Router();

/**
 * POST /layout/v2/optimize
 * Forwards layout v2 optimization requests to Python backend.
 */
router.post(
  "/v2/optimize",
  asyncHandler(async (req: Request, res: Response) => {
    const result = await pythonProxy("POST", "/api/layout/v2/optimize", req.body, undefined, 90_000);

    if (result.success) {
      res.json(result.data);
      return;
    }

    res.status(result.status || 502).json({
      success: false,
      error: result.error || "Layout optimization service is unavailable",
      service: "optimizer",
    });
  }),
);

/**
 * POST /layout/v2/auto-optimize
 * Minimal-input optimization: backend auto-generates room program then optimizes.
 */
router.post(
  "/v2/auto-optimize",
  asyncHandler(async (req: Request, res: Response) => {
    const result = await pythonProxy(
      "POST",
      "/api/layout/v2/auto-optimize",
      req.body,
      undefined,
      90_000,
    );

    if (result.success) {
      res.json(result.data);
      return;
    }

    res.status(result.status || 502).json({
      success: false,
      error: result.error || "Layout auto-optimization service is unavailable",
      service: "optimizer",
    });
  }),
);

/**
 * GET /layout/v2/health
 * Lightweight health probe used by the Space Planning UI retry flow.
 */
router.get(
  "/v2/health",
  asyncHandler(async (_req: Request, res: Response) => {
    try {
      const result = await pythonProxy("GET", "/health", undefined, undefined, 10_000);

      if (!result.success) {
        res.status(result.status || 503).json({
          ok: false,
          status: result.status || 503,
          message: result.error || "Optimization service health check failed",
        });
        return;
      }

      res.json({
        ok: true,
        status: result.status,
        message: "Optimization service is healthy",
        details: result.data,
      });
    } catch (error) {
      logger.error({ err: error }, "[Layout/Health] Error");
      res.status(503).json({
        ok: false,
        status: 503,
        message: "Optimization service health check failed",
      });
    }
  }),
);

export default router;
