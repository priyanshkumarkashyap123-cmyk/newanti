import { Router } from "express";
import { getDbAuditService } from "../../services/DatabaseAuditService.js";
import { requireAuth } from "../../middleware/authMiddleware.js";
const router = Router();
const auditService = getDbAuditService();
router.use(requireAuth());
router.post("/", async (req, res) => {
  try {
    const {
      projectId,
      sessionId,
      type,
      action,
      details,
      aiGenerated,
      confidence,
      modelUsed,
      metadata
    } = req.body;
    if (!projectId || !sessionId || !type || !action || !details) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: projectId, sessionId, type, action, details"
      });
    }
    const entry = await auditService.log({
      projectId,
      sessionId,
      type,
      action,
      details,
      aiGenerated,
      confidence,
      modelUsed,
      metadata
    });
    return res.json({
      success: true,
      id: entry.id,
      timestamp: entry.timestamp
    });
  } catch (error) {
    console.error("[Audit API] Error logging entry:", error);
    return res.status(500).json({ success: false, error: "Failed to log audit entry" });
  }
});
router.get("/:projectId", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { type, limit, offset, startDate, endDate } = req.query;
    const entries = await auditService.getProjectEntries(projectId, {
      type,
      limit: limit ? parseInt(limit) : void 0,
      offset: offset ? parseInt(offset) : void 0,
      startDate: startDate ? new Date(startDate) : void 0,
      endDate: endDate ? new Date(endDate) : void 0
    });
    return res.json({
      success: true,
      entries,
      count: entries.length
    });
  } catch (error) {
    console.error("[Audit API] Error fetching entries:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch entries" });
  }
});
router.get("/:projectId/stats", async (req, res) => {
  try {
    const { projectId } = req.params;
    const stats = await auditService.getStats(projectId);
    return res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error("[Audit API] Error fetching stats:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch stats" });
  }
});
router.post("/sign", async (req, res) => {
  try {
    const { entryIds, engineerName, licenseNumber } = req.body;
    if (!entryIds || !engineerName || !licenseNumber) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: entryIds, engineerName, licenseNumber"
      });
    }
    const count = await auditService.signEntries(entryIds, {
      engineerName,
      licenseNumber,
      signedAt: /* @__PURE__ */ new Date()
    });
    return res.json({
      success: true,
      signedCount: count
    });
  } catch (error) {
    console.error("[Audit API] Error signing entries:", error);
    return res.status(500).json({ success: false, error: "Failed to sign entries" });
  }
});
router.get("/:projectId/report", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { engineer, license } = req.query;
    if (!engineer || !license) {
      return res.status(400).json({
        success: false,
        error: "Missing query parameters: engineer, license"
      });
    }
    const report = await auditService.generateReport(
      projectId,
      engineer,
      license
    );
    return res.json({
      success: true,
      report,
      format: "markdown"
    });
  } catch (error) {
    console.error("[Audit API] Error generating report:", error);
    return res.status(500).json({ success: false, error: "Failed to generate report" });
  }
});
router.get("/:projectId/export", async (req, res) => {
  try {
    const { projectId } = req.params;
    const format = req.query.format || "json";
    const data = await auditService.exportForCompliance(projectId, format);
    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=audit_${projectId}.csv`);
    } else {
      res.setHeader("Content-Type", "application/json");
    }
    return res.send(data);
  } catch (error) {
    console.error("[Audit API] Error exporting:", error);
    return res.status(500).json({ success: false, error: "Failed to export" });
  }
});
var audit_default = router;
export {
  audit_default as default
};
//# sourceMappingURL=index.js.map
