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
  geotechSptSchema,
  geotechInfiniteSlopeSchema,
  geotechBearingCapacitySchema,
  geotechRetainingWallSchema,
  geotechSettlementSchema,
  geotechLiquefactionSchema,
  geotechPileAxialSchema,
  geotechRankineSchema,
  geotechSeismicEarthPressureSchema,
} from "../../middleware/validation.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { logger } from "../../utils/logger.js";
import { assertDesignPayload } from "../../utils/proxyContracts.js";

const router: Router = express.Router();

// ============================================
// Helper: Rust-first forwarding with Python fallback
// ============================================

const DESIGN_PRIMARY_ENGINE =
  (process.env["DESIGN_PRIMARY_ENGINE"] || "rust").toLowerCase();

type BackendService = "rust" | "python";

function getRequestId(req: Request, res: Response): string | undefined {
  const rid = res.locals.requestId || req.get("x-request-id");
  return typeof rid === "string" && rid.length > 0 ? rid : undefined;
}

async function callBackend(
  service: BackendService,
  path: string,
  body: unknown,
  timeoutMs: number,
  requestId?: string,
) {
  if (service === "rust") {
    return rustProxy("POST", path, body, undefined, timeoutMs, requestId);
  }
  return pythonProxy("POST", path, body, undefined, timeoutMs, requestId);
}

async function forwardDesign(
  options: {
    req: Request;
    rustPath?: string;
    pythonPath?: string;
    body: unknown;
    res: Response;
    label: string;
    timeoutMs?: number;
  },
): Promise<void> {
  const { req, rustPath, pythonPath, body, res, label, timeoutMs = 30_000 } = options;
  const requestId = getRequestId(req, res);

  const preferRust = DESIGN_PRIMARY_ENGINE !== "python";
  const order: Array<{ service: BackendService; path: string }> = preferRust
    ? [
        ...(rustPath ? [{ service: "rust" as const, path: rustPath }] : []),
        ...(pythonPath ? [{ service: "python" as const, path: pythonPath }] : []),
      ]
    : [
        ...(pythonPath ? [{ service: "python" as const, path: pythonPath }] : []),
        ...(rustPath ? [{ service: "rust" as const, path: rustPath }] : []),
      ];

  if (order.length === 0) {
    res.status(500).json({
      success: false,
      error: `${label} route misconfigured: no backend target defined`,
      service: "design-gateway",
    });
    return;
  }

  let lastError = `${label} failed`;
  let lastStatus = 500;

  for (const target of order) {
    const result = await callBackend(target.service, target.path, body, timeoutMs, requestId);
    if (result.success) {
      const guard = assertDesignPayload(result.data, `Design/${label}`);
      if (!guard.ok) {
        logger.error({ reason: guard.reason, requestId }, `[Design/${label}] Invalid upstream payload`);
        res.status(502).json({
          success: false,
          error: "Invalid design payload from upstream service",
          code: "UPSTREAM_CONTRACT_ERROR",
          requestId,
          service: target.service,
        });
        return;
      }

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
      req,
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
      req,
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
      req,
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
      req,
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
      req,
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
    req,
    rustPath: "/api/design/aisc360/bending",
    pythonPath: "/design/steel/check",
    body: { ...req.body, code: "AISC360" },
    res,
    label: "Steel/AISC",
  });
}));

router.post("/is800", asyncHandler(async (req: Request, res: Response) => {
  await forwardDesign({
    req,
    rustPath: "/api/design/is800/auto-select",
    pythonPath: "/design/steel/check",
    body: { ...req.body, code: "IS800" },
    res,
    label: "Steel/IS800",
  });
}));

router.post("/steel/check", asyncHandler(async (req: Request, res: Response) => {
  await forwardDesign({
    req,
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
    req,
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
    req,
    rustPath: "/api/optimization/auto-select",
    pythonPath: "/design/optimize",
    body: req.body,
    res,
    label: "Optimize",
    timeoutMs: 60_000,
  });
}));

// ============================================
// Geotechnical Design Routes (Rust-first)
// ============================================

router.post(
  "/geotech/spt-correlation",
  validateBody(geotechSptSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await forwardDesign({
      req,
      rustPath: "/api/design/geotech/spt-correlation",
      body: req.body,
      res,
      label: "Geotech/SPT",
    });
  }),
);

router.post(
  "/geotech/slope/infinite",
  validateBody(geotechInfiniteSlopeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await forwardDesign({
      req,
      rustPath: "/api/design/geotech/slope/infinite",
      body: req.body,
      res,
      label: "Geotech/InfiniteSlope",
    });
  }),
);

router.post(
  "/geotech/foundation/bearing-capacity",
  validateBody(geotechBearingCapacitySchema),
  asyncHandler(async (req: Request, res: Response) => {
    await forwardDesign({
      req,
      rustPath: "/api/design/geotech/foundation/bearing-capacity",
      body: req.body,
      res,
      label: "Geotech/BearingCapacity",
    });
  }),
);

router.post(
  "/geotech/retaining-wall/stability",
  validateBody(geotechRetainingWallSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await forwardDesign({
      req,
      rustPath: "/api/design/geotech/retaining-wall/stability",
      body: req.body,
      res,
      label: "Geotech/RetainingWall",
    });
  }),
);

router.post(
  "/geotech/settlement/consolidation",
  validateBody(geotechSettlementSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await forwardDesign({
      req,
      rustPath: "/api/design/geotech/settlement/consolidation",
      body: req.body,
      res,
      label: "Geotech/Settlement",
    });
  }),
);

router.post(
  "/geotech/liquefaction/screening",
  validateBody(geotechLiquefactionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await forwardDesign({
      req,
      rustPath: "/api/design/geotech/liquefaction/screening",
      body: req.body,
      res,
      label: "Geotech/Liquefaction",
    });
  }),
);

router.post(
  "/geotech/foundation/pile-axial-capacity",
  validateBody(geotechPileAxialSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await forwardDesign({
      req,
      rustPath: "/api/design/geotech/foundation/pile-axial-capacity",
      body: req.body,
      res,
      label: "Geotech/PileAxial",
    });
  }),
);

router.post(
  "/geotech/earth-pressure/rankine",
  validateBody(geotechRankineSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await forwardDesign({
      req,
      rustPath: "/api/design/geotech/earth-pressure/rankine",
      body: req.body,
      res,
      label: "Geotech/EarthPressureRankine",
    });
  }),
);

router.post(
  "/geotech/earth-pressure/seismic",
  validateBody(geotechSeismicEarthPressureSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await forwardDesign({
      req,
      rustPath: "/api/design/geotech/earth-pressure/seismic",
      body: req.body,
      res,
      label: "Geotech/EarthPressureSeismic",
    });
  }),
);

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
