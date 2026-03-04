import express from "express";
import { pythonProxy } from "../../services/serviceProxy.js";
const router = express.Router();
async function forwardToPython(method, pythonPath, body, res, label, timeoutMs = 3e4) {
  try {
    const result = await pythonProxy(
      method,
      pythonPath,
      body,
      void 0,
      timeoutMs
    );
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
    console.error(`[Jobs/${label}] Error:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : `${label} failed`
    });
  }
}
router.post("/", async (req, res) => {
  await forwardToPython("POST", "/api/jobs/submit", req.body, res, "Submit");
});
router.post("/submit", async (req, res) => {
  await forwardToPython("POST", "/api/jobs/submit", req.body, res, "Submit");
});
router.get("/queue/status", async (_req, res) => {
  await forwardToPython(
    "GET",
    "/api/jobs/queue/status",
    void 0,
    res,
    "QueueStatus"
  );
});
router.get("/:id", async (req, res) => {
  const jobId = req.params["id"] ?? "";
  await forwardToPython("GET", `/api/jobs/${jobId}`, void 0, res, "Status");
});
router.delete("/:id", async (req, res) => {
  const jobId = req.params["id"] ?? "";
  await forwardToPython(
    "DELETE",
    `/api/jobs/${jobId}`,
    void 0,
    res,
    "Cancel"
  );
});
var jobs_default = router;
export {
  jobs_default as default
};
//# sourceMappingURL=index.js.map
