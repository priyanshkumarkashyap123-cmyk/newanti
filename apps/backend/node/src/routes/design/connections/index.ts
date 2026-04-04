/**
 * Connection Design Routes - Bolted, welded, riveted connections
 * Routes: POST /design/connections/*
 */

import { Router, Request, Response } from "express";
import { validateBody } from "../../../middleware/validation.js";
import { connectionDesignSchema } from "../../../validation/steel.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { logger } from "../../../utils/logger.js";
import {
  createDesignRouteHandler,
  getRequestId,
} from "../middleware/forwardingUtils.js";

const router: Router = Router();

/**
 * Bolted Connection Design
 * POST /design/connections/bolted
 * Checks: shear, bearing, net section, block shear, prying
 */
router.post(
  "/bolted",
  validateBody(connectionDesignSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = getRequestId(req, res);
    logger.info({ requestId }, "[BOLTED-CONN] Processing bolted connection design");

    const handler = createDesignRouteHandler({
      rustPath: "/design/connections/bolted",
      pythonPath: "/design/connections/bolted",
      label: "BOLTED-CONN",
      timeoutMs: 15_000,
    });

    return handler(req, res);
  })
);

/**
 * Welded Connection Design
 * POST /design/connections/welded
 * Checks: fillet weld strength, butt weld, combined stress
 */
router.post(
  "/welded",
  validateBody(connectionDesignSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = getRequestId(req, res);
    logger.info({ requestId }, "[WELDED-CONN] Processing welded connection design");

    const handler = createDesignRouteHandler({
      rustPath: "/design/connections/welded",
      pythonPath: "/design/connections/welded",
      label: "WELDED-CONN",
      timeoutMs: 15_000,
    });

    return handler(req, res);
  })
);

/**
 * Moment Connection Design
 * POST /design/connections/moment
 * Checks: full moment transfer, plastic hinging
 */
router.post(
  "/moment",
  validateBody(connectionDesignSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = getRequestId(req, res);
    logger.info({ requestId }, "[MOMENT-CONN] Processing moment connection design");

    const handler = createDesignRouteHandler({
      rustPath: "/design/connections/moment",
      pythonPath: "/design/connections/moment",
      label: "MOMENT-CONN",
      timeoutMs: 15_000,
    });

    return handler(req, res);
  })
);

export default router;
