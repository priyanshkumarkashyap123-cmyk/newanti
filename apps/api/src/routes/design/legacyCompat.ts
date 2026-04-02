import { Router, Request, Response } from "express";
import {
  validateBody,
  steelDesignSchema,
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
import {
  forwardDesignRequest,
  DESIGN_DEFAULT_TIMEOUT_MS,
} from "./middleware/forwardingUtils.js";

const router: Router = Router();

function mapConnectionRustPath(body: unknown): string {
  const payload = (body || {}) as { type?: string };
  if (payload.type === "welded") return "/api/design/is800/fillet-weld";
  if (payload.type === "base_plate") return "/api/design/base-plate";
  return "/api/design/is800/bolt-bearing";
}

async function forwardAndRespond(
  req: Request,
  res: Response,
  options: {
    rustPath?: string;
    pythonPath?: string;
    body?: unknown;
    label: string;
    timeoutMs?: number;
  },
): Promise<void> {
  try {
    const result = await forwardDesignRequest({
      req,
      res,
      rustPath: options.rustPath,
      pythonPath: options.pythonPath,
      body: options.body ?? req.body,
      label: options.label,
      timeoutMs: options.timeoutMs ?? DESIGN_DEFAULT_TIMEOUT_MS,
    });

    if (typeof res.ok === "function") {
      res.ok(result);
      return;
    }

    res.status(200).json(result);
  } catch (error) {
    const err = error as Error & { status?: number; code?: string };
    const status = err.status || 502;
    const payload: Record<string, unknown> = {
      success: false,
      error: err.message || "Design route error",
    };
    if (err.code) {
      payload.code = err.code;
    }

    res.status(status).json(payload);
  }
}

router.post(
  "/steel",
  validateBody(steelDesignSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await forwardAndRespond(req, res, {
      rustPath:
        req.body?.code === "AISC360"
          ? "/api/design/aisc360/bending"
          : "/api/design/is800/auto-select",
      pythonPath: "/design/steel/check",
      label: "Steel",
    });
  }),
);

router.post(
  "/aisc",
  asyncHandler(async (req: Request, res: Response) => {
    await forwardAndRespond(req, res, {
      rustPath: "/api/design/aisc360/bending",
      pythonPath: "/design/steel/check",
      body: { ...req.body, code: "AISC360" },
      label: "Steel/AISC",
    });
  }),
);

router.post(
  "/is800",
  asyncHandler(async (req: Request, res: Response) => {
    await forwardAndRespond(req, res, {
      rustPath: "/api/design/is800/auto-select",
      pythonPath: "/design/steel/check",
      body: { ...req.body, code: "IS800" },
      label: "Steel/IS800",
    });
  }),
);

router.post(
  "/steel/check",
  asyncHandler(async (req: Request, res: Response) => {
    await forwardAndRespond(req, res, {
      rustPath:
        req.body?.code === "AISC360"
          ? "/api/design/aisc360/bending"
          : "/api/design/is800/auto-select",
      pythonPath: "/design/steel/check",
      label: "Steel/Check",
    });
  }),
);

router.post(
  "/concrete/check",
  asyncHandler(async (req: Request, res: Response) => {
    await forwardAndRespond(req, res, {
      rustPath:
        req.body?.element_type === "column"
          ? "/api/design/is456/biaxial-column"
          : "/api/design/is456/flexural-capacity",
      pythonPath: "/design/concrete/check",
      label: "Concrete/Check",
    });
  }),
);

router.post(
  "/connection",
  validateBody(connectionDesignSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await forwardAndRespond(req, res, {
      rustPath: mapConnectionRustPath(req.body),
      pythonPath: "/design/connection/check",
      label: "Connection",
    });
  }),
);

router.post(
  "/foundation",
  validateBody(foundationDesignSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await forwardAndRespond(req, res, {
      pythonPath: "/design/foundation/check",
      label: "Foundation",
    });
  }),
);

router.post(
  "/optimize",
  asyncHandler(async (req: Request, res: Response) => {
    await forwardAndRespond(req, res, {
      rustPath: "/api/optimization/auto-select",
      pythonPath: "/design/optimize",
      label: "Optimize",
      timeoutMs: 60_000,
    });
  }),
);

router.post(
  "/geotech/spt-correlation",
  validateBody(geotechSptSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await forwardAndRespond(req, res, {
      rustPath: "/api/design/geotech/spt-correlation",
      label: "Geotech/SPT",
    });
  }),
);

router.post(
  "/geotech/slope/infinite",
  validateBody(geotechInfiniteSlopeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await forwardAndRespond(req, res, {
      rustPath: "/api/design/geotech/slope/infinite",
      label: "Geotech/InfiniteSlope",
    });
  }),
);

router.post(
  "/geotech/foundation/bearing-capacity",
  validateBody(geotechBearingCapacitySchema),
  asyncHandler(async (req: Request, res: Response) => {
    await forwardAndRespond(req, res, {
      rustPath: "/api/design/geotech/foundation/bearing-capacity",
      label: "Geotech/BearingCapacity",
    });
  }),
);

router.post(
  "/geotech/retaining-wall/stability",
  validateBody(geotechRetainingWallSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await forwardAndRespond(req, res, {
      rustPath: "/api/design/geotech/retaining-wall/stability",
      label: "Geotech/RetainingWall",
    });
  }),
);

router.post(
  "/geotech/settlement/consolidation",
  validateBody(geotechSettlementSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await forwardAndRespond(req, res, {
      rustPath: "/api/design/geotech/settlement/consolidation",
      label: "Geotech/Settlement",
    });
  }),
);

router.post(
  "/geotech/liquefaction/screening",
  validateBody(geotechLiquefactionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await forwardAndRespond(req, res, {
      rustPath: "/api/design/geotech/liquefaction/screening",
      label: "Geotech/Liquefaction",
    });
  }),
);

router.post(
  "/geotech/foundation/pile-axial-capacity",
  validateBody(geotechPileAxialSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await forwardAndRespond(req, res, {
      rustPath: "/api/design/geotech/foundation/pile-axial-capacity",
      label: "Geotech/PileAxial",
    });
  }),
);

router.post(
  "/geotech/earth-pressure/rankine",
  validateBody(geotechRankineSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await forwardAndRespond(req, res, {
      rustPath: "/api/design/geotech/earth-pressure/rankine",
      label: "Geotech/EarthPressureRankine",
    });
  }),
);

router.post(
  "/geotech/earth-pressure/seismic",
  validateBody(geotechSeismicEarthPressureSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await forwardAndRespond(req, res, {
      rustPath: "/api/design/geotech/earth-pressure/seismic",
      label: "Geotech/EarthPressureSeismic",
    });
  }),
);

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
