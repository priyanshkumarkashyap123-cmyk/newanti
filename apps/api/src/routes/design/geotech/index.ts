/**
 * Geotechnical Design Routes - Foundation, slope, soil checks
 * Routes: POST /design/geotech/*
 */

import { Router, Request, Response } from "express";
import {
  validateBody,
  foundationDesignSchema,
  geotechSptSchema,
  geotechInfiniteSlopeSchema,
  geotechBearingCapacitySchema,
  geotechRetainingWallSchema,
  geotechSettlementSchema,
  geotechLiquefactionSchema,
  geotechPileAxialSchema,
} from "../../../middleware/validation.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { logger } from "../../../utils/logger.js";
import {
  createDesignRouteHandler,
  getRequestId,
} from "../middleware/forwardingUtils.js";

const router: Router = Router();

/**
 * Foundation Design
 * POST /design/geotech/foundation
 * Checks: bearing capacity, settlement, overturning, sliding
 */
router.post(
  "/foundation",
  validateBody(foundationDesignSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = getRequestId(req, res);
    logger.info({ requestId }, "[FOUNDATION] Processing foundation design");

    const handler = createDesignRouteHandler({
      rustPath: "/design/geotech/foundation",
      pythonPath: "/design/geotech/foundation",
      label: "FOUNDATION",
      timeoutMs: 20_000,
    });

    return handler(req, res);
  })
);

/**
 * SPT (Standard Penetration Test) Correlation
 * POST /design/geotech/spt
 * Correlates SPT-N to soil properties, bearing capacity
 */
router.post(
  "/spt",
  validateBody(geotechSptSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = getRequestId(req, res);
    logger.info({ requestId }, "[SPT] Processing SPT correlation");

    const handler = createDesignRouteHandler({
      pythonPath: "/design/geotech/spt",
      label: "SPT",
      timeoutMs: 10_000,
    });

    return handler(req, res);
  })
);

/**
 * Bearing Capacity Analysis
 * POST /design/geotech/bearing-capacity
 */
router.post(
  "/bearing-capacity",
  validateBody(geotechBearingCapacitySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = getRequestId(req, res);
    logger.info({ requestId }, "[BEARING-CAP] Processing bearing capacity analysis");

    const handler = createDesignRouteHandler({
      pythonPath: "/design/geotech/bearing-capacity",
      label: "BEARING-CAP",
      timeoutMs: 15_000,
    });

    return handler(req, res);
  })
);

/**
 * Slope Stability (Infinite Slope Method)
 * POST /design/geotech/slope-stability
 */
router.post(
  "/slope-stability",
  validateBody(geotechInfiniteSlopeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = getRequestId(req, res);
    logger.info({ requestId }, "[SLOPE] Processing slope stability analysis");

    const handler = createDesignRouteHandler({
      pythonPath: "/design/geotech/slope-stability",
      label: "SLOPE",
      timeoutMs: 15_000,
    });

    return handler(req, res);
  })
);

/**
 * Retaining Wall Design
 * POST /design/geotech/retaining-wall
 */
router.post(
  "/retaining-wall",
  validateBody(geotechRetainingWallSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = getRequestId(req, res);
    logger.info({ requestId }, "[RW] Processing retaining wall design");

    const handler = createDesignRouteHandler({
      pythonPath: "/design/geotech/retaining-wall",
      label: "RW",
      timeoutMs: 15_000,
    });

    return handler(req, res);
  })
);

/**
 * Settlement Analysis
 * POST /design/geotech/settlement
 */
router.post(
  "/settlement",
  validateBody(geotechSettlementSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = getRequestId(req, res);
    logger.info({ requestId }, "[SETTLEMENT] Processing settlement analysis");

    const handler = createDesignRouteHandler({
      pythonPath: "/design/geotech/settlement",
      label: "SETTLEMENT",
      timeoutMs: 15_000,
    });

    return handler(req, res);
  })
);

/**
 * Liquefaction Potential Analysis
 * POST /design/geotech/liquefaction
 */
router.post(
  "/liquefaction",
  validateBody(geotechLiquefactionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = getRequestId(req, res);
    logger.info({ requestId }, "[LIQUEFACTION] Processing liquefaction analysis");

    const handler = createDesignRouteHandler({
      pythonPath: "/design/geotech/liquefaction",
      label: "LIQUEFACTION",
      timeoutMs: 15_000,
    });

    return handler(req, res);
  })
);

/**
 * Pile Axial Capacity
 * POST /design/geotech/pile-axial
 */
router.post(
  "/pile-axial",
  validateBody(geotechPileAxialSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = getRequestId(req, res);
    logger.info({ requestId }, "[PILE-AXIAL] Processing pile axial capacity");

    const handler = createDesignRouteHandler({
      pythonPath: "/design/geotech/pile-axial",
      label: "PILE-AXIAL",
      timeoutMs: 15_000,
    });

    return handler(req, res);
  })
);

export default router;
