import express from "express";
import { v4 as uuidv4 } from "uuid";
import { rustProxy } from "../../services/serviceProxy.js";
import { validateBody, analyzeRequestSchema } from "../../middleware/validation.js";
const router = express.Router();
const jobs = /* @__PURE__ */ new Map();
async function handleAnalysisRequest(req, res) {
  const model = req.body;
  const nodeCount = model.nodes?.length || 0;
  console.log(`[Analysis] -> Rust API | ${nodeCount} nodes, ${model.members?.length || 0} members`);
  if (nodeCount > 5e3) {
    const jobId = uuidv4();
    jobs.set(jobId, { id: jobId, status: "pending", createdAt: /* @__PURE__ */ new Date() });
    runAnalysisAsync(jobId, model);
    res.status(202).json({
      success: true,
      jobId,
      message: "Analysis job queued",
      pollUrl: `/api/analyze/job/${jobId}`
    });
    return;
  }
  const result = await rustProxy("POST", "/api/analyze", model, void 0, 12e4);
  if (result.success) {
    res.json(result.data);
  } else {
    console.error("[Analysis] Rust API error:", result.error);
    res.status(result.status || 500).json({
      success: false,
      error: result.error || "Analysis failed",
      service: "rust-api"
    });
  }
}
router.post("/", validateBody(analyzeRequestSchema), handleAnalysisRequest);
router.post("/solve", validateBody(analyzeRequestSchema), handleAnalysisRequest);
router.get("/job/:jobId", (req, res) => {
  const { jobId } = req.params;
  if (!jobId) {
    res.status(400).json({ success: false, error: "Missing jobId" });
    return;
  }
  const job = jobs.get(jobId);
  if (!job) {
    res.status(404).json({ success: false, error: "Job not found" });
    return;
  }
  res.json({
    success: true,
    job: {
      id: job.id,
      status: job.status,
      progress: job.progress,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      completedAt: job.completedAt
    }
  });
});
router.post("/validate", (req, res) => {
  const model = req.body;
  const errors = [];
  if (!model.nodes || model.nodes.length === 0) errors.push("No nodes provided");
  if (!model.members || model.members.length === 0) errors.push("No members provided");
  const nodeIds = new Set(model.nodes?.map((n) => n.id) || []);
  for (const member of model.members || []) {
    if (!nodeIds.has(member.startNodeId))
      errors.push(`Member ${member.id} references unknown start node: ${member.startNodeId}`);
    if (!nodeIds.has(member.endNodeId))
      errors.push(`Member ${member.id} references unknown end node: ${member.endNodeId}`);
  }
  for (const load of model.loads || []) {
    if (!nodeIds.has(load.nodeId))
      errors.push(`Load references unknown node: ${load.nodeId}`);
  }
  const hasRestraints = model.nodes?.some(
    (n) => n.restraints && (n.restraints.fx || n.restraints.fy || n.restraints.fz)
  );
  if (!hasRestraints) errors.push("Model has no boundary conditions (restraints)");
  res.json({
    valid: errors.length === 0,
    errors,
    stats: {
      nodes: model.nodes?.length || 0,
      members: model.members?.length || 0,
      loads: model.loads?.length || 0
    }
  });
});
async function runAnalysisAsync(jobId, model) {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = "running";
  job.progress = 0;
  try {
    const result = await rustProxy("POST", "/api/analyze", model, void 0, 3e5);
    if (result.success) {
      job.status = "completed";
      job.progress = 100;
      job.result = result.data;
    } else {
      job.status = "failed";
      job.error = result.error || "Rust API analysis failed";
    }
    job.completedAt = /* @__PURE__ */ new Date();
  } catch (error) {
    job.status = "failed";
    job.error = error instanceof Error ? error.message : "Unknown error";
    job.completedAt = /* @__PURE__ */ new Date();
  }
  setTimeout(() => jobs.delete(jobId), 60 * 60 * 1e3);
}
var analysis_default = router;
export {
  analysis_default as default
};
//# sourceMappingURL=index.js.map
