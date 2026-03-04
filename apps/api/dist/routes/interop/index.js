import { Router } from "express";
import { pythonProxy } from "../../services/serviceProxy.js";
import { requireAuth } from "../../middleware/authMiddleware.js";
const router = Router();
router.use(requireAuth());
async function forwardToPython(pythonPath, body, res, label, timeoutMs = 3e4) {
  try {
    const result = await pythonProxy("POST", pythonPath, body, void 0, timeoutMs);
    if (result.success) {
      res.json(result.data);
    } else {
      res.status(result.status || 500).json({
        success: false,
        error: result.error || `${label} failed`,
        service: "python"
      });
    }
  } catch (error) {
    console.error(`[Interop/${label}] Error:`, error);
    res.status(500).json({
      error: `${label} failed`
    });
  }
}
router.post("/staad/import", async (req, res) => {
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ error: "Missing file content" });
  }
  await forwardToPython("/interop/staad/import", { content }, res, "STAAD Import");
});
router.post("/staad/export", async (req, res) => {
  const { model } = req.body;
  if (!model) {
    return res.status(400).json({ error: "Missing model data" });
  }
  await forwardToPython("/interop/staad/export", { model }, res, "STAAD Export");
});
router.post("/dxf/import", async (req, res) => {
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ error: "Missing file content" });
  }
  await forwardToPython("/interop/dxf/import", { content }, res, "DXF Import");
});
router.post("/report/generate", async (req, res) => {
  const { model, results, options } = req.body;
  if (!model || !options) {
    return res.status(400).json({ error: "Missing model or options" });
  }
  await forwardToPython(
    "/reports/generate",
    { model, results, options },
    res,
    "Report Gen",
    6e4
    // Reports can take longer
  );
});
router.post("/validate", async (req, res) => {
  try {
    const { model } = req.body;
    const errors = [];
    const warnings = [];
    if (!model.nodes || !Array.isArray(model.nodes)) {
      errors.push("Missing or invalid nodes array");
    } else {
      const nodeIds = /* @__PURE__ */ new Set();
      for (const node of model.nodes) {
        if (!node.id) errors.push("Node missing ID");
        if (nodeIds.has(node.id)) errors.push(`Duplicate node ID: ${node.id}`);
        nodeIds.add(node.id);
        if (node.x === void 0 || node.y === void 0) {
          errors.push(`Node ${node.id} missing coordinates`);
        }
      }
    }
    if (!model.members || !Array.isArray(model.members)) {
      errors.push("Missing or invalid members array");
    } else {
      const nodeIds = new Set(model.nodes?.map((n) => n.id) || []);
      for (const member of model.members) {
        if (!member.id) errors.push("Member missing ID");
        if (!nodeIds.has(member.startNodeId)) {
          errors.push(`Member ${member.id} references unknown start node: ${member.startNodeId}`);
        }
        if (!nodeIds.has(member.endNodeId)) {
          errors.push(`Member ${member.id} references unknown end node: ${member.endNodeId}`);
        }
        if (member.startNodeId === member.endNodeId) {
          errors.push(`Member ${member.id} has same start and end node`);
        }
      }
    }
    if (model.supports && Array.isArray(model.supports)) {
      const nodeIds = new Set(model.nodes?.map((n) => n.id) || []);
      for (const support of model.supports) {
        if (!nodeIds.has(support.nodeId)) {
          warnings.push(`Support references unknown node: ${support.nodeId}`);
        }
      }
    }
    return res.json({ valid: errors.length === 0, errors, warnings });
  } catch (error) {
    console.error("Validation error:", error);
    return res.status(500).json({
      error: "Validation failed"
    });
  }
});
router.get("/formats", (_req, res) => {
  res.json({
    import: [
      { id: "json", name: "JSON Model", extension: ".json", description: "BeamLab native format" },
      { id: "std", name: "STAAD.Pro", extension: ".std", description: "STAAD.Pro input file" },
      { id: "dxf", name: "AutoCAD DXF", extension: ".dxf", description: "DXF geometry (LINE entities)" }
    ],
    export: [
      { id: "json", name: "JSON Model", extension: ".json", description: "BeamLab native format" },
      { id: "std", name: "STAAD.Pro", extension: ".std", description: "STAAD.Pro input file" },
      { id: "csv", name: "CSV", extension: ".csv", description: "Comma-separated values" },
      { id: "pdf", name: "PDF Report", extension: ".pdf", description: "Analysis report" }
    ]
  });
});
var interop_default = router;
export {
  interop_default as default
};
//# sourceMappingURL=index.js.map
