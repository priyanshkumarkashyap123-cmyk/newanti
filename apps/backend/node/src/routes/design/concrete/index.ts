/**
 * Concrete Design Routes - IS 456 / ACI 318 checks
 * Routes: POST /design/concrete/*
 */

import { Router, Request, Response } from "express";
import {
  validateBody,
  concreteBeamSchema,
  concreteColumnSchema,
} from "../../../middleware/validation.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { logger } from "../../../utils/logger.js";
import {
  createDesignRouteHandler,
  getRequestId,
} from "../middleware/forwardingUtils.js";

const router: Router = Router();

/**
 * Concrete Beam Design
 * POST /design/concrete/beam
 * Checks: Moment, shear, torsion, deflection (IS 456)
 */
router.post(
  "/beam",
  validateBody(concreteBeamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = getRequestId(req, res);
    logger.info({ requestId }, "[CONCRETE-BEAM] Processing concrete beam design");

    req.body = {
      ...req.body,
      element_type: "beam",
      code: req.body?.code || "IS456",
    };

    const handler = createDesignRouteHandler({
      rustPath: "/api/design/is456/flexural-capacity",
      pythonPath: "/design/concrete/check",
      label: "CONCRETE-BEAM",
    });

    return handler(req, res);
  })
);

/**
 * Concrete Column Design
 * POST /design/concrete/column
 * Checks: compression, moments, P-Delta effects, detailing (IS 456)
 */
router.post(
  "/column",
  validateBody(concreteColumnSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = getRequestId(req, res);
    logger.info(
      { requestId },
      "[CONCRETE-COLUMN] Processing concrete column design"
    );

    req.body = {
      ...req.body,
      element_type: "column",
      code: req.body?.code || "IS456",
    };

    const handler = createDesignRouteHandler({
      rustPath: "/api/design/is456/biaxial-column",
      pythonPath: "/design/concrete/check",
      label: "CONCRETE-COLUMN",
    });

    return handler(req, res);
  })
);

/**
 * Concrete Slab Design
 * POST /design/concrete/slab
 * Checks: One-way, two-way slabs, deflection, punching shear (IS 456)
 */
router.post(
  "/slab",
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = getRequestId(req, res);
    logger.info({ requestId }, "[CONCRETE-SLAB] Processing concrete slab design");

    const handler = createDesignRouteHandler({
      rustPath: "/api/design/is456/flexural-capacity",
      pythonPath: "/design/concrete/check",
      label: "CONCRETE-SLAB",
    });

    return handler(req, res);
  })
);

/**
 * Concrete Section Optimization
 * POST /design/concrete/optimize
 * Finds minimum steel/concrete needed for given force envelope
 */
router.post(
  "/optimize",
  validateBody(concreteBeamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = getRequestId(req, res);
    logger.info(
      { requestId },
      "[CONCRETE-OPTIMIZE] Processing concrete section optimization"
    );

    const handler = createDesignRouteHandler({
      rustPath: "/api/optimization/auto-select",
      pythonPath: "/design/optimize",
      label: "CONCRETE-OPTIMIZE",
      timeoutMs: 60_000, // Optimization takes longer
    });

    return handler(req, res);
  })
);

export default router;
