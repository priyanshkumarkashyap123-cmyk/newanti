import express from "express";
import { pythonProxy } from "../../services/serviceProxy.js";
import {
  validateBody,
  steelDesignSchema,
  concreteBeamSchema,
  concreteColumnSchema,
  connectionDesignSchema,
  foundationDesignSchema
} from "../../middleware/validation.js";
const router = express.Router();
async function forwardToPython(pythonPath, body, res, label, timeoutMs = 3e4) {
  try {
    const result = await pythonProxy(
      "POST",
      pythonPath,
      body,
      void 0,
      timeoutMs
    );
    if (result.success) {
      res.json({ success: true, result: result.data });
    } else {
      res.status(result.status || 500).json({
        success: false,
        error: result.error || `${label} failed`,
        service: "python"
      });
    }
  } catch (error) {
    console.error(`[Design/${label}] Error:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : `${label} failed`
    });
  }
}
router.post(
  "/steel",
  validateBody(steelDesignSchema),
  async (req, res) => {
    await forwardToPython("/design/steel/check", req.body, res, "Steel");
  }
);
router.post(
  "/concrete/beam",
  validateBody(concreteBeamSchema),
  async (req, res) => {
    await forwardToPython(
      "/design/concrete/check",
      { ...req.body, element_type: "beam", code: "IS456" },
      res,
      "Concrete/Beam"
    );
  }
);
router.post(
  "/concrete/column",
  validateBody(concreteColumnSchema),
  async (req, res) => {
    await forwardToPython(
      "/design/concrete/check",
      { ...req.body, element_type: "column", code: "IS456" },
      res,
      "Concrete/Column"
    );
  }
);
router.post(
  "/connection",
  validateBody(connectionDesignSchema),
  async (req, res) => {
    await forwardToPython(
      "/design/connection/check",
      req.body,
      res,
      "Connection"
    );
  }
);
router.post(
  "/foundation",
  validateBody(foundationDesignSchema),
  async (req, res) => {
    await forwardToPython(
      "/design/foundation/check",
      req.body,
      res,
      "Foundation"
    );
  }
);
router.post("/aisc", async (req, res) => {
  await forwardToPython(
    "/design/steel/check",
    { ...req.body, code: "AISC360" },
    res,
    "Steel/AISC"
  );
});
router.post("/is800", async (req, res) => {
  await forwardToPython(
    "/design/steel/check",
    { ...req.body, code: "IS800" },
    res,
    "Steel/IS800"
  );
});
router.post("/steel/check", async (req, res) => {
  await forwardToPython("/design/steel/check", req.body, res, "Steel/Check");
});
router.post("/concrete/check", async (req, res) => {
  await forwardToPython(
    "/design/concrete/check",
    req.body,
    res,
    "Concrete/Check"
  );
});
router.post("/optimize", async (req, res) => {
  await forwardToPython("/design/optimize", req.body, res, "Optimize", 6e4);
});
router.get("/codes", (_req, res) => {
  res.json({
    success: true,
    codes: {
      steel: [
        {
          code: "IS800",
          name: "IS 800:2007",
          country: "India",
          description: "Limit State Method"
        },
        {
          code: "AISC360",
          name: "AISC 360-16",
          country: "USA",
          description: "LRFD/ASD Methods"
        }
      ],
      concrete: [
        {
          code: "IS456",
          name: "IS 456:2000",
          country: "India",
          description: "Limit State Method"
        }
      ],
      connections: [
        {
          code: "IS800_CONN",
          name: "IS 800:2007 Chapter 10",
          country: "India"
        }
      ],
      foundations: [
        {
          code: "IS456_FOUND",
          name: "IS 456:2000 + IS 1904",
          country: "India"
        }
      ]
    }
  });
});
var design_default = router;
export {
  design_default as default
};
//# sourceMappingURL=index.js.map
