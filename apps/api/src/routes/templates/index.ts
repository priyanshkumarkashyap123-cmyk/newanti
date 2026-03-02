/**
 * Template Routes - Proxies to Rust API for structural templates
 *
 * CANONICAL OWNER: Rust API (sub-ms response times, parallel generation)
 * This file is a THIN PROXY. No template logic runs in Node.js.
 */

import express, { Router, Request, Response } from "express";
import { rustProxy } from "../../services/serviceProxy.js";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { asyncHandler, HttpError } from "../../utils/asyncHandler.js";
import { logger } from "../../utils/logger.js";

const router: Router = express.Router();

// All template routes require authentication
router.use(requireAuth());

// ============================================
// Helper: Forward to Rust and handle response
// ============================================

async function forwardToRust(
  rustPath: string,
  query: Record<string, string>,
  res: Response,
  label: string,
): Promise<void> {
  try {
    const result = await rustProxy("GET", rustPath, undefined, query);
    if (result.success) {
      res.json(result.data);
    } else {
      res.status(result.status || 500).json({
        success: false,
        error: result.error || `${label} failed`,
        service: "rust",
      });
    }
  } catch (error) {
    logger.error({ err: error }, `[Templates/${label}] Error`);
    res.status(500).json({
      success: false,
      error: `${label} failed`,
    });
  }
}

// ============================================
// GET /templates/:type - Get a structural template
// ============================================

const TEMPLATE_TYPES = ["beam", "continuous-beam", "truss", "frame", "portal"];

router.get("/:type", asyncHandler(async (req: Request, res: Response) => {
  const type = req.params["type"] ?? "";
  if (!TEMPLATE_TYPES.includes(type)) {
    throw new HttpError(400, `Invalid template type: ${type}. Valid: ${TEMPLATE_TYPES.join(", ")}`);
  }
  const query: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.query)) {
    if (typeof v === "string") query[k] = v;
  }
  await forwardToRust(`/api/templates/${type}`, query, res, type);
}));

// ============================================
// POST /templates/generate - Generic template generation
// Accepts { type, params } body (backward-compat with Python /generate/template)
// ============================================

router.post("/generate", asyncHandler(async (req: Request, res: Response) => {
  const { type, params } = req.body as {
    type?: string;
    params?: Record<string, unknown>;
  };
  if (!type) {
    throw new HttpError(400, "Missing 'type' field");
  }

  const typeMap: Record<string, string> = {
    beam: "beam",
    simple_beam: "beam",
    continuous_beam: "continuous-beam",
    truss: "truss",
    frame: "frame",
    portal: "portal",
    portal_frame: "portal",
    "3d_frame": "frame",
  };

  const rustType = typeMap[type] || type;
  if (!TEMPLATE_TYPES.includes(rustType)) {
    throw new HttpError(400, `Unknown template type: ${type}. Valid: ${Object.keys(typeMap).join(", ")}`);
  }

  const query: Record<string, string> = {};
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) query[k] = String(v);
    }
  }

  await forwardToRust(`/api/templates/${rustType}`, query, res, rustType);
}));

export default router;
