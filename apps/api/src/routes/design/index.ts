/**
 * Design Routes - Rust-first proxy for structural design checks
 *
 * Strategy:
 *  - Prefer Rust API for performance-critical design checks.
 *  - Fallback to Python API for endpoint/payload compatibility.
 *  - Keep Node.js as a thin gateway only (no local design calculations).
 */

import express, { Router, Request, Response } from "express";
import { pythonProxy, rustProxy } from "../../services/serviceProxy.js";
import {
  validateBody,
  steelDesignSchema,
  concreteBeamSchema,
  concreteColumnSchema,
  connectionDesignSchema,
  foundationDesignSchema,
} from "../../middleware/validation.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { logger } from "../../utils/logger.js";

const router: Router = express.Router();

// ============================================
// Helper: Rust-first forwarding with Python fallback
// ============================================

const DESIGN_PRIMARY_ENGINE =
  (process.env["DESIGN_PRIMARY_ENGINE"] || "rust").toLowerCase();

type BackendService = "rust" | "python";

async function callBackend(
  service: BackendService,
  path: string,
  body: unknown,
  timeoutMs: number,
) {
  if (service === "rust") {
    return rustProxy("POST", path, body, undefined, timeoutMs);
  }
  return pythonProxy("POST", path, body, undefined, timeoutMs);
}

async function forwardDesign(
  options: {
    rustPath?: string;
    pythonPath: string;
    body: unknown;
    res: Response;
    label: string;
    timeoutMs?: number;
  },
): Promise<void> {
  const { rustPath, pythonPath, body, res, label, timeoutMs = 30_000 } = options;

  const preferRust = DESIGN_PRIMARY_ENGINE !== "python";
  const order: Array<{ service: BackendService; path: string }> = preferRust
    ? [
        ...(rustPath ? [{ service: "rust" as const, path: rustPath }] : []),
        { service: "python" as const, path: pythonPath },
      ]
    : [
        { service: "python" as const, path: pythonPath },
        ...(rustPath ? [{ service: "rust" as const, path: rustPath }] : []),
      ];

  let lastError = `${label} failed`;
  let lastStatus = 500;

  for (const target of order) {
    const result = await callBackend(target.service, target.path, body, timeoutMs);
    if (result.success) {
      res.json({
        success: true,
        result: result.data,
        engine: target.service,
      });
      return;
    }

    lastError = result.error || `${label} failed via ${target.service}`;
    lastStatus = result.status || 500;
    logger.warn(
      `[Design/${label}] ${target.service.toUpperCase()} failed (${lastStatus}). ${
        target.service === "rust" ? "Trying Python fallback if available." : "No further fallback."
      }`,
    );
  }

  res.status(lastStatus).json({
    success: false,
    error: lastError,
    service: "design-gateway",
  });
}

function mapConnectionRustPath(body: unknown): string | undefined {
  try {
    const req = (body || {}) as { type?: string };
    if (req.type === "welded") return "/api/design/is800/fillet-weld";
    if (req.type === "base_plate") return "/api/design/base-plate";
    return "/api/design/is800/bolt-bearing";
  } catch {
    return undefined;
  }
}

// ============================================
// POST /design/steel - Steel Design (IS 800 / AISC 360)
// ============================================

router.post(
  "/steel",
  validateBody(steelDesignSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await forwardDesign({
      rustPath:
        req.body?.code === "AISC360"
          ? "/api/design/aisc360/bending"
          : "/api/design/is800/auto-select",
      pythonPath: "/design/steel/check",
      body: req.body,
      res,
      label: "Steel",
    });
  }),
);

// ============================================
// POST /design/concrete/beam - Concrete Beam Design (IS 456)
// ============================================

router.post(
  "/concrete/beam",
  validateBody(concreteBeamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await forwardDesign({
      rustPath: "/api/design/is456/flexural-capacity",
      pythonPath: "/design/concrete/check",
      body: { ...req.body, element_type: "beam", code: "IS456" },
      res,
      label: "Concrete/Beam",
    });
  }),
);

// ============================================
// POST /design/concrete/column - Concrete Column Design (IS 456)
// ============================================

router.post(
  "/concrete/column",
  validateBody(concreteColumnSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await forwardDesign({
      rustPath: "/api/design/is456/biaxial-column",
      pythonPath: "/design/concrete/check",
      body: { ...req.body, element_type: "column", code: "IS456" },
      res,
      label: "Concrete/Column",
    });
  }),
);

// ============================================
// POST /design/connection - Connection Design
// ============================================

router.post(
  "/connection",
  validateBody(connectionDesignSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await forwardDesign({
      rustPath: mapConnectionRustPath(req.body),
      pythonPath: "/design/connection/check",
      body: req.body,
      res,
      label: "Connection",
    });
  }),
);

// ============================================
// POST /design/foundation - Foundation Design
// ============================================

router.post(
  "/foundation",
  validateBody(foundationDesignSchema),
  asyncHandler(async (req: Request, res: Response) => {
    // Rust endpoint parity for foundation design is not complete yet.
    await forwardDesign({
      pythonPath: "/design/foundation/check",
      body: req.body,
      res,
      label: "Foundation",
    });
  }),
);

// ============================================
// Backward-compatible aliases
// Frontend calls /api/design/aisc, /is800, /steel/check, /concrete/check
// ============================================

router.post("/aisc", asyncHandler(async (req: Request, res: Response) => {
  await forwardDesign({
    rustPath: "/api/design/aisc360/bending",
    pythonPath: "/design/steel/check",
    body: { ...req.body, code: "AISC360" },
    res,
    label: "Steel/AISC",
  });
}));

router.post("/is800", asyncHandler(async (req: Request, res: Response) => {
  await forwardDesign({
    rustPath: "/api/design/is800/auto-select",
    pythonPath: "/design/steel/check",
    body: { ...req.body, code: "IS800" },
    res,
    label: "Steel/IS800",
  });
}));

router.post("/steel/check", asyncHandler(async (req: Request, res: Response) => {
  await forwardDesign({
    rustPath:
      req.body?.code === "AISC360"
        ? "/api/design/aisc360/bending"
        : "/api/design/is800/auto-select",
    pythonPath: "/design/steel/check",
    body: req.body,
    res,
    label: "Steel/Check",
  });
}));

router.post("/concrete/check", asyncHandler(async (req: Request, res: Response) => {
  await forwardDesign({
    rustPath:
      req.body?.element_type === "column"
        ? "/api/design/is456/biaxial-column"
        : "/api/design/is456/flexural-capacity",
    pythonPath: "/design/concrete/check",
    body: req.body,
    res,
    label: "Concrete/Check",
  });
}));

router.post("/optimize", asyncHandler(async (req: Request, res: Response) => {
  await forwardDesign({
    rustPath: "/api/optimization/auto-select",
    pythonPath: "/design/optimize",
    body: req.body,
    res,
    label: "Optimize",
    timeoutMs: 60_000,
  });
}));

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
