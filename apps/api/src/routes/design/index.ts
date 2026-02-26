/**
 * Design Routes - Proxies to Python backend for structural design checks
 *
 * CANONICAL OWNER: Python (richest implementations - IS 456, IS 800,
 *   AISC 360, Eurocode 3, connections, foundations with full rebar layout)
 * This file is a THIN PROXY. No design computation runs in Node.js.
 */

import express, { Router, Request, Response } from "express";
import { pythonProxy } from "../../services/serviceProxy.js";
import {
  validateBody,
  steelDesignSchema,
  concreteBeamSchema,
  concreteColumnSchema,
  connectionDesignSchema,
  foundationDesignSchema,
} from "../../middleware/validation.js";

const router: Router = express.Router();

// ============================================
// Helper: Forward to Python and handle response
// ============================================

async function forwardToPython(
  pythonPath: string,
  body: unknown,
  res: Response,
  label: string,
  timeoutMs = 30_000,
): Promise<void> {
  try {
    const result = await pythonProxy(
      "POST",
      pythonPath,
      body,
      undefined,
      timeoutMs,
    );
    if (result.success) {
      res.json({ success: true, result: result.data });
    } else {
      res.status(result.status || 500).json({
        success: false,
        error: result.error || `${label} failed`,
        service: "python",
      });
    }
  } catch (error) {
    console.error(`[Design/${label}] Error:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : `${label} failed`,
    });
  }
}

// ============================================
// POST /design/steel - Steel Design (IS 800 / AISC 360)
// ============================================

router.post(
  "/steel",
  validateBody(steelDesignSchema),
  async (req: Request, res: Response) => {
    await forwardToPython("/design/steel/check", req.body, res, "Steel");
  },
);

// ============================================
// POST /design/concrete/beam - Concrete Beam Design (IS 456)
// ============================================

router.post(
  "/concrete/beam",
  validateBody(concreteBeamSchema),
  async (req: Request, res: Response) => {
    await forwardToPython(
      "/design/concrete/check",
      { ...req.body, element_type: "beam", code: "IS456" },
      res,
      "Concrete/Beam",
    );
  },
);

// ============================================
// POST /design/concrete/column - Concrete Column Design (IS 456)
// ============================================

router.post(
  "/concrete/column",
  validateBody(concreteColumnSchema),
  async (req: Request, res: Response) => {
    await forwardToPython(
      "/design/concrete/check",
      { ...req.body, element_type: "column", code: "IS456" },
      res,
      "Concrete/Column",
    );
  },
);

// ============================================
// POST /design/connection - Connection Design
// ============================================

router.post(
  "/connection",
  validateBody(connectionDesignSchema),
  async (req: Request, res: Response) => {
    await forwardToPython(
      "/design/connection/check",
      req.body,
      res,
      "Connection",
    );
  },
);

// ============================================
// POST /design/foundation - Foundation Design
// ============================================

router.post(
  "/foundation",
  validateBody(foundationDesignSchema),
  async (req: Request, res: Response) => {
    await forwardToPython(
      "/design/foundation/check",
      req.body,
      res,
      "Foundation",
    );
  },
);

// ============================================
// Backward-compatible aliases
// Frontend calls /api/design/aisc, /is800, /steel/check, /concrete/check
// ============================================

router.post("/aisc", async (req: Request, res: Response) => {
  await forwardToPython(
    "/design/steel/check",
    { ...req.body, code: "AISC360" },
    res,
    "Steel/AISC",
  );
});

router.post("/is800", async (req: Request, res: Response) => {
  await forwardToPython(
    "/design/steel/check",
    { ...req.body, code: "IS800" },
    res,
    "Steel/IS800",
  );
});

router.post("/steel/check", async (req: Request, res: Response) => {
  await forwardToPython("/design/steel/check", req.body, res, "Steel/Check");
});

router.post("/concrete/check", async (req: Request, res: Response) => {
  await forwardToPython(
    "/design/concrete/check",
    req.body,
    res,
    "Concrete/Check",
  );
});

router.post("/optimize", async (req: Request, res: Response) => {
  await forwardToPython("/design/optimize", req.body, res, "Optimize", 60_000);
});

// ============================================
// GET /design/codes - Available Design Codes (static)
// ============================================

router.get("/codes", (_req: Request, res: Response) => {
  res.json({
    success: true,
    codes: {
      steel: [
        {
          code: "IS800",
          name: "IS 800:2007",
          country: "India",
          description: "Limit State Method",
        },
        {
          code: "AISC360",
          name: "AISC 360-16",
          country: "USA",
          description: "LRFD/ASD Methods",
        },
      ],
      concrete: [
        {
          code: "IS456",
          name: "IS 456:2000",
          country: "India",
          description: "Limit State Method",
        },
      ],
      connections: [
        {
          code: "IS800_CONN",
          name: "IS 800:2007 Chapter 10",
          country: "India",
        },
      ],
      foundations: [
        {
          code: "IS456_FOUND",
          name: "IS 456:2000 + IS 1904",
          country: "India",
        },
      ],
    },
  });
});

export default router;
