/**
 * Steel Design Routes - IS 800 / AISC 360 checks
 * Routes: POST /design/steel/*
 */

import { Router, Request, Response } from "express";
import { validateBody } from "../../../middleware/validation.js";
import { steelDesignSchema } from "../../../validation/steel.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { logger } from "../../../utils/logger.js";
import {
  createDesignRouteHandler,
  getRequestId,
} from "../middleware/forwardingUtils.js";

const router: Router = Router();

/**
 * Steel Beam Design
 * POST /design/steel/beam
 * Checks: Bending, shear, deflection, lateral buckling (IS 800)
 */
router.post(
  "/beam",
  validateBody(steelDesignSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = getRequestId(req, res);
    logger.info({ requestId }, "[STEEL-BEAM] Processing steel beam design");

    const handler = createDesignRouteHandler({
      rustPath: "/design/steel/beam",
      pythonPath: "/design/steel/beam",
      label: "STEEL-BEAM",
      timeoutMs: 15_000,
    });

    return handler(req, res);
  })
);

/**
 * Steel Column Design
 * POST /design/steel/column
 * Checks: compression, buckling, combined stress (IS 800)
 */
router.post(
  "/column",
  validateBody(steelDesignSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = getRequestId(req, res);
    logger.info(
      { requestId },
      "[STEEL-COLUMN] Processing steel column design"
    );

    const handler = createDesignRouteHandler({
      rustPath: "/design/steel/column",
      pythonPath: "/design/steel/column",
      label: "STEEL-COLUMN",
      timeoutMs: 15_000,
    });

    return handler(req, res);
  })
);

/**
 * Steel Section Optimization
 * POST /design/steel/optimize
 * Finds smallest/cheapest section meeting design criteria
 */
router.post(
  "/optimize",
  validateBody(steelDesignSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = getRequestId(req, res);
    logger.info(
      { requestId },
      "[STEEL-OPTIMIZE] Processing steel section optimization"
    );

    const handler = createDesignRouteHandler({
      rustPath: "/design/steel/optimize",
      pythonPath: "/design/steel/optimize",
      label: "STEEL-OPTIMIZE",
      timeoutMs: 30_000, // Optimization takes longer
    });

    return handler(req, res);
  })
);

export default router;
