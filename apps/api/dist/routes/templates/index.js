import express from "express";
import { rustProxy } from "../../services/serviceProxy.js";
import { requireAuth } from "../../middleware/authMiddleware.js";
const router = express.Router();
router.use(requireAuth());
async function forwardToRust(rustPath, query, res, label) {
  try {
    const result = await rustProxy("GET", rustPath, void 0, query);
    if (result.success) {
      res.json(result.data);
    } else {
      res.status(result.status || 500).json({
        success: false,
        error: result.error || `${label} failed`,
        service: "rust"
      });
    }
  } catch (error) {
    console.error(`[Templates/${label}] Error:`, error);
    res.status(500).json({
      success: false,
      error: `${label} failed`
    });
  }
}
const TEMPLATE_TYPES = ["beam", "continuous-beam", "truss", "frame", "portal"];
router.get("/:type", async (req, res) => {
  const type = req.params["type"] ?? "";
  if (!TEMPLATE_TYPES.includes(type)) {
    res.status(400).json({
      success: false,
      error: `Invalid template type: ${type}. Valid: ${TEMPLATE_TYPES.join(", ")}`
    });
    return;
  }
  const query = {};
  for (const [k, v] of Object.entries(req.query)) {
    if (typeof v === "string") query[k] = v;
  }
  await forwardToRust(`/api/templates/${type}`, query, res, type);
});
router.post("/generate", async (req, res) => {
  const { type, params } = req.body;
  if (!type) {
    res.status(400).json({ success: false, error: "Missing 'type' field" });
    return;
  }
  const typeMap = {
    beam: "beam",
    simple_beam: "beam",
    continuous_beam: "continuous-beam",
    truss: "truss",
    frame: "frame",
    portal: "portal",
    portal_frame: "portal",
    "3d_frame": "frame"
  };
  const rustType = typeMap[type] || type;
  if (!TEMPLATE_TYPES.includes(rustType)) {
    res.status(400).json({
      success: false,
      error: `Unknown template type: ${type}. Valid: ${Object.keys(typeMap).join(", ")}`
    });
    return;
  }
  const query = {};
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== void 0 && v !== null) query[k] = String(v);
    }
  }
  await forwardToRust(`/api/templates/${rustType}`, query, res, rustType);
});
var templates_default = router;
export {
  templates_default as default
};
//# sourceMappingURL=index.js.map
