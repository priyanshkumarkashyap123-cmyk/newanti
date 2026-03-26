import express, { type Request, type Response, type NextFunction } from "express";
import asyncHandler from "express-async-handler";
import { requireAuth } from "../../middleware/authMiddleware.js";
import {
  isVmOrchestratorConfigured,
  getCircuitStats,
  checkVmHealth,
  type VmHealthResponse,
} from "../../services/vmOrchestrator.js";
import { getGpuAutoscaleTelemetrySnapshot } from "../../services/gpuAutoscaleTelemetry.js";
import { getRealtimeMetrics } from "../../services/realtimeMetrics.js";

const router: express.Router = express.Router();

// GET /api/admin/gpu-status
// Protected: accepts either a valid admin token in header `x-admin-token`
// or the normal authenticated session (requireAuth()).
function adminAuth(req: Request, res: Response, next: NextFunction) {
  const hdr = (req.headers["x-admin-token"] ?? req.headers["x-autoscale-token"]) as string | undefined;
  const envToken = process.env["ADMIN_STATUS_TOKEN"] ?? "";
  if (hdr && envToken && hdr === envToken) return next();
  return requireAuth()(req, res, next);
}

router.get(
  "/gpu-status",
  adminAuth,
  asyncHandler(async (_req: Request, res: Response) => {
    const configured = isVmOrchestratorConfigured();
    const circuit = getCircuitStats();

    let vmHealth: VmHealthResponse | { error: string } | null = null;
    if (configured) {
      try {
        vmHealth = await checkVmHealth();
      } catch (err) {
        vmHealth = { error: String(err) };
      }
    }

    const telemetry = getGpuAutoscaleTelemetrySnapshot();
    const realtime = getRealtimeMetrics();

    // Autostart eligibility (replicates the conservative checks in vmOrchestrator)
    const vmAutostartEnabled = (process.env["AZURE_VM_AUTOSTART_ENABLED"] ?? "false") === "true";
    const hasVmTarget = (process.env["AZURE_VM_SUBSCRIPTION_ID"] ?? "").trim().length > 0
      && (process.env["AZURE_VM_RESOURCE_GROUP"] ?? "").trim().length > 0
      && (process.env["AZURE_VM_NAME"] ?? "").trim().length > 0;
    const hasClientCreds = (process.env["AZURE_TENANT_ID"] ?? "").trim().length > 0
      && (process.env["AZURE_CLIENT_ID"] ?? "").trim().length > 0
      && (process.env["AZURE_CLIENT_SECRET"] ?? "").trim().length > 0;
    const hasManagedIdentity = ((process.env["IDENTITY_ENDPOINT"] ?? "") || (process.env["MSI_ENDPOINT"] ?? "")).trim().length > 0;

    const minUsers = Number(process.env["AZURE_VM_AUTOSTART_MIN_ACTIVE_USERS"] ?? "1") || 1;
    const minProjects = Number(process.env["AZURE_VM_AUTOSTART_MIN_ACTIVE_PROJECTS"] ?? "1") || 1;

    const realtimeAllows = realtime.activeSocketUsers >= minUsers || realtime.activeProjects >= minProjects;

    const autostartEligible = vmAutostartEnabled && hasVmTarget && (hasClientCreds || hasManagedIdentity) && realtimeAllows;

    res.json({
      configured,
      circuit,
      vmHealth,
      telemetry,
      realtime,
      autostartEligible,
      env: {
        AZURE_VM_AUTOSTART_ENABLED: process.env["AZURE_VM_AUTOSTART_ENABLED"] ?? "",
        AZURE_VM_SUBSCRIPTION_ID: process.env["AZURE_VM_SUBSCRIPTION_ID"] ? "(set)" : "(unset)",
        AZURE_VM_RESOURCE_GROUP: process.env["AZURE_VM_RESOURCE_GROUP"] ? "(set)" : "(unset)",
        AZURE_VM_NAME: process.env["AZURE_VM_NAME"] ? "(set)" : "(unset)",
      },
    });
  }),
);

export default router;
