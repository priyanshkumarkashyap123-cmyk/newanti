import express from "express";
import { rustProxy } from "../../services/serviceProxy.js";
import {
  validateBody,
  pDeltaSchema,
  modalSchema,
  bucklingSchema,
  spectrumSchema,
  cableSchema
} from "../../middleware/validation.js";
const router = express.Router();
async function forwardToRust(rustPath, body, res, label, timeoutMs = 12e4) {
  try {
    const result = await rustProxy("POST", rustPath, body, void 0, timeoutMs);
    if (result.success) {
      res.json({ success: true, ...result.data });
    } else {
      console.error(`[Advanced/${label}] Rust API error:`, result.error);
      res.status(result.status || 500).json({
        success: false,
        error: result.error || `${label} failed`,
        service: "rust-api"
      });
    }
  } catch (error) {
    console.error(`[Advanced/${label}] Error:`, error);
    res.status(500).json({
      success: false,
      error: `${label} failed`
    });
  }
}
router.post("/pdelta", validateBody(pDeltaSchema), async (req, res) => {
  await forwardToRust("/api/advanced/pdelta", req.body, res, "PDelta");
});
router.post("/modal", validateBody(modalSchema), async (req, res) => {
  await forwardToRust("/api/advanced/modal", req.body, res, "Modal");
});
router.post("/spectrum", validateBody(spectrumSchema), async (req, res) => {
  await forwardToRust("/api/advanced/spectrum", req.body, res, "Spectrum", 18e4);
});
router.post("/buckling", validateBody(bucklingSchema), async (req, res) => {
  await forwardToRust("/api/advanced/buckling", req.body, res, "Buckling");
});
router.post("/cable", validateBody(cableSchema), async (req, res) => {
  await forwardToRust("/api/advanced/cable", req.body, res, "Cable");
});
router.get("/capabilities", (_req, res) => {
  res.json({
    success: true,
    capabilities: [
      {
        id: "pdelta",
        name: "P-Delta Analysis",
        description: "Geometric nonlinear analysis accounting for secondary moments from axial loads",
        endpoint: "/api/advanced/pdelta",
        engine: "rust-api"
      },
      {
        id: "modal",
        name: "Modal Analysis",
        description: "Eigenvalue extraction for natural frequencies and mode shapes",
        endpoint: "/api/advanced/modal",
        engine: "rust-api"
      },
      {
        id: "spectrum",
        name: "Response Spectrum Analysis",
        description: "Seismic analysis using IS 1893 or custom response spectra",
        endpoint: "/api/advanced/spectrum",
        engine: "rust-api"
      },
      {
        id: "buckling",
        name: "Buckling Analysis",
        description: "Linear stability analysis for critical load factors",
        endpoint: "/api/advanced/buckling",
        engine: "rust-api"
      },
      {
        id: "cable",
        name: "Cable Analysis",
        description: "Catenary cable analysis with sag and equivalent modulus",
        endpoint: "/api/advanced/cable",
        engine: "rust-api"
      }
    ]
  });
});
var advanced_default = router;
export {
  advanced_default as default
};
//# sourceMappingURL=index.js.map
