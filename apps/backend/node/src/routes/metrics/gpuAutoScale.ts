import express, { type Request, type Response, type Router } from "express";
import { checkVmHealth, getCircuitStats, isVmOrchestratorConfigured } from "../../services/vmOrchestrator.js";
import { getGpuAutoscaleTelemetrySnapshot } from "../../services/gpuAutoscaleTelemetry.js";

export interface RealtimeGpuMetrics {
  activeSocketUsers: number;
  activeProjects: number;
}

interface CreateGpuAutoscaleRouterOptions {
  getRealtimeMetrics: () => RealtimeGpuMetrics;
}

function isMetricsTokenAuthorized(req: Request): boolean {
  const expectedToken = process.env["GPU_AUTOSCALE_METRICS_TOKEN"];
  if (!expectedToken) {
    return true;
  }

  const headerToken = req.get("x-metrics-token") ?? req.get("authorization")?.replace(/^Bearer\s+/i, "");
  return headerToken === expectedToken;
}

export function createGpuAutoScaleMetricsRouter(options: CreateGpuAutoscaleRouterOptions): Router {
  const router = express.Router();

  router.get("/gpu-auto-scale", async (req: Request, res: Response) => {
    if (!isMetricsTokenAuthorized(req)) {
      res.status(401).json({
        success: false,
        error: "Unauthorized metrics request",
      });
      return;
    }

    const vmHealth = await checkVmHealth();
    const circuitStats = getCircuitStats();
    const telemetry = getGpuAutoscaleTelemetrySnapshot();
    const realtime = options.getRealtimeMetrics();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      vmFleet: {
        configured: isVmOrchestratorConfigured(),
        healthy: vmHealth.healthy,
        activeWorkers: vmHealth.activeWorkers,
        queueDepth: vmHealth.queueDepth,
        latencyMs: vmHealth.latencyMs,
      },
      circuitBreaker: {
        open: circuitStats.isOpen,
        failures: circuitStats.failures,
      },
      realtime,
      telemetry,
    });
  });

  return router;
}
