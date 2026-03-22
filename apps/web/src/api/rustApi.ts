/**
 * ============================================================================
 * UNIFIED RUST BACKEND API SERVICE
 * ============================================================================
 *
 * Production-grade TypeScript client for the Rust structural analysis backend.
 * Uses the canonical ApiClient for retry, caching, auth, and error handling.
 *
 * Features:
 * - Health-checked connection with circuit breaker
 * - Typed request/response interfaces for all Rust endpoints
 * - Job queue integration (submit, poll, cancel)
 * - WebSocket progress streaming
 * - Automatic fallback to Python backend when Rust is unavailable
 *
 * @version 1.0.0
 */

import { API_CONFIG } from "../config/env";
import { ApiClient, type RequestConfig } from "../lib/api/client";
import {
  detectLocalComputeCapability,
  getComputePreference,
  type ComputePreference,
} from "../utils/computePreference";

// ============================================================================
// TYPES
// ============================================================================

export interface Node3D {
  id: number;
  x: number;
  y: number;
  z: number;
}

export interface Member {
  id: number;
  start_node: number;
  end_node: number;
  section?: string;
  material?: string;
}

export interface Support {
  node_id: number;
  dx: boolean;
  dy: boolean;
  dz: boolean;
  rx: boolean;
  ry: boolean;
  rz: boolean;
  spring_values?: number[];
}

export interface LoadDef {
  load_type: "point" | "distributed" | "moment" | "temperature" | "self_weight";
  node_id?: number;
  member_id?: number;
  values: number[];
  direction?: string;
}

export interface MaterialProps {
  e: number; // Young's modulus (Pa)
  g: number; // Shear modulus (Pa)
  density: number; // kg/m³
  poisson: number;
  fy?: number; // Yield strength
  fu?: number; // Ultimate strength
}

export interface SectionProps {
  area: number;
  ix: number;
  iy: number;
  iz: number;
  zx?: number;
  zy?: number;
}

export interface AnalysisModel {
  nodes: Node3D[];
  members: Member[];
  supports: Support[];
  loads: LoadDef[];
  material?: MaterialProps;
  sections?: Record<string, SectionProps>;
}

// ── Result Types ────────────────────────────────────────────────────────────

export interface StaticResult {
  success: boolean;
  displacements: Record<string, number[]>; // node_id -> [dx, dy, dz, rx, ry, rz]
  reactions: Record<string, number[]>;
  member_forces: MemberForceResult[];
  solve_time_ms: number;
  n_dof: number;
  condition_number?: number;
}

export interface MemberForceResult {
  member_id: number;
  start_forces: number[]; // [Fx, Fy, Fz, Mx, My, Mz]
  end_forces: number[];
  max_moment?: number;
  max_shear?: number;
}

export interface ModalResult {
  success: boolean;
  modes: ModeShape[];
  solve_time_ms: number;
}

export interface ModeShape {
  mode_number: number;
  frequency_hz: number;
  period_s: number;
  modal_mass_ratio: number;
  mode_shape: Record<string, number[]>;
}

export interface BucklingResult {
  success: boolean;
  modes: BucklingMode[];
  solve_time_ms: number;
}

export interface BucklingMode {
  mode_number: number;
  load_factor: number;
  mode_shape: Record<string, number[]>;
}

export interface SpectrumResult {
  success: boolean;
  displacements: Record<string, number[]>;
  member_forces: MemberForceResult[];
  base_shear: number[];
  modal_contributions: ModeShape[];
  solve_time_ms: number;
}

export interface DesignCheckResult {
  success: boolean;
  member_id: number;
  code: string;
  status: "pass" | "fail";
  utilization_ratio: number;
  checks: DesignCheck[];
  governing_check: string;
}

export interface DesignCheck {
  name: string;
  capacity: number;
  demand: number;
  ratio: number;
  status: "pass" | "fail";
  clause?: string;
}

export interface SteelSection {
  designation: string;
  standard: string;
  depth: number;
  width: number;
  area: number;
  ix: number;
  iy: number;
  zx: number;
  zy: number;
  weight: number;
}

// ── Job Queue Types ─────────────────────────────────────────────────────────

export interface JobSubmitResponse {
  success: boolean;
  job_id: string;
  message: string;
}

export interface JobStatus {
  job_id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  stage: string;
  message: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  result?: unknown;
  error?: string;
}

export interface QueueStatus {
  queued: number;
  running: number;
  completed: number;
  failed: number;
  total: number;
}

// ── Progress Events ─────────────────────────────────────────────────────────

export interface ProgressEvent {
  type: "job_progress" | "heartbeat" | "pong";
  job_id?: string;
  status?: string;
  percent?: number;
  stage?: string;
  message?: string;
  eta_seconds?: number;
  time?: number;
}

// ============================================================================
// RUST API SERVICE
// ============================================================================

class RustApiService {
  private client: ApiClient;
  private pythonClient: ApiClient;
  private nodeClient: ApiClient;
  private _isRustAvailable: boolean | null = null;
  private _lastHealthCheck = 0;
  private _healthCheckInterval = 30_000; // 30 seconds

  constructor() {
    this.client = new ApiClient({
      baseUrl: API_CONFIG.rustUrl,
      timeout: API_CONFIG.timeout,
      retries: 2,
      retryDelay: 1000,
    });

    this.pythonClient = new ApiClient({
      baseUrl: API_CONFIG.pythonUrl,
      timeout: API_CONFIG.timeout,
      retries: 1,
    });

    this.nodeClient = new ApiClient({
      baseUrl: API_CONFIG.baseUrl,
      timeout: API_CONFIG.timeout,
      retries: 1,
      retryDelay: 500,
    });

    // Add auth token interceptor to both clients
    const authInterceptor = (config: RequestConfig) => {
      const token = localStorage.getItem("beamlab-auth");
      if (token) {
        try {
          const authData = JSON.parse(token);
          if (authData?.state?.tokens?.accessToken) {
            config.headers = {
              ...config.headers,
              Authorization: `Bearer ${authData.state.tokens.accessToken}`,
            };
          }
        } catch {
          /* ignore invalid token */
        }
      }
      return config;
    };

    this.client.onRequest(authInterceptor);
    this.pythonClient.onRequest(authInterceptor);
    this.nodeClient.onRequest(authInterceptor);
  }

  private isGpuCandidate(jobType: string): boolean {
    return [
      "modal",
      "pdelta",
      "buckling",
      "spectrum",
      "time_history",
      "response_spectrum",
      "nonlinear",
      "pushover",
      "static_gpu",
      "fem3d",
    ].includes(jobType);
  }

  private mapJobTypeToGpuSolver(jobType: string): string {
    if (jobType === "spectrum") return "response_spectrum";
    if (jobType === "static_gpu") return "fem3d";
    return jobType;
  }

  private getClientIdempotencyKey(jobType: string): string {
    const random =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `gpu-${jobType}-${random}`;
  }

  private extractJobId(payload: Record<string, unknown>): string | null {
    const fromCamel = payload.jobId;
    if (typeof fromCamel === "string" && fromCamel.length > 0) return fromCamel;

    const fromSnake = payload.job_id;
    if (typeof fromSnake === "string" && fromSnake.length > 0) return fromSnake;

    return null;
  }

  private extractJobStatus(payload: Record<string, unknown>): JobStatus {
    const statusRaw = payload.status;
    const status =
      typeof statusRaw === "string" &&
      ["queued", "running", "completed", "failed", "cancelled", "timeout"].includes(statusRaw)
        ? (statusRaw as JobStatus["status"])
        : "running";

    const resultPayload = (payload.result ?? payload.output) as unknown;

    return {
      job_id: this.extractJobId(payload) ?? "unknown",
      status,
      progress: typeof payload.progress === "number" ? payload.progress : status === "completed" ? 100 : 0,
      stage: typeof payload.stage === "string" ? payload.stage : status,
      message: typeof payload.message === "string" ? payload.message : "",
      created_at: typeof payload.created_at === "string" ? payload.created_at : new Date().toISOString(),
      started_at: typeof payload.started_at === "string" ? payload.started_at : undefined,
      completed_at: typeof payload.completed_at === "string" ? payload.completed_at : undefined,
      result: resultPayload,
      error: typeof payload.error === "string" ? payload.error : undefined,
    };
  }

  private async submitGpuJob(
    jobType: string,
    input: Record<string, unknown>,
  ): Promise<JobSubmitResponse> {
    const solver = this.mapJobTypeToGpuSolver(jobType);
    const idempotencyKey = this.getClientIdempotencyKey(jobType);
    const resp = await this.nodeClient.post<Record<string, unknown>>(
      "/api/v1/gpu-jobs",
      {
        solver,
        input,
        idempotencyKey,
        priority: "normal",
      },
      {
        headers: {
          "X-Idempotency-Key": idempotencyKey,
        },
      },
    );

    const payload = resp.data as Record<string, unknown>;
    const jobId = this.extractJobId(payload);
    if (!jobId) {
      throw new Error("GPU job submission did not return a job ID");
    }

    return {
      success: true,
      job_id: jobId,
      message: typeof payload.message === "string" ? payload.message : "Job queued",
    };
  }

  private async waitForGpuJob(jobId: string, maxWaitMs: number): Promise<unknown> {
    const pollIntervalMs = 1000;
    let elapsed = 0;

    while (elapsed < maxWaitMs) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      elapsed += pollIntervalMs;

      const status = await this.getJobStatus(jobId);
      if (status.status === "completed") {
        return status.result;
      }

      if (status.status === "failed" || status.status === "cancelled") {
        throw new Error(status.error || `GPU job ended with status '${status.status}'`);
      }
    }

    throw new Error("GPU job timed out");
  }

  // ── Health & Availability ───────────────────────────────────────────────

  /**
   * Check if the Rust backend is available.
   * Caches result for 30 seconds to avoid excessive pings.
   */
  async isAvailable(): Promise<boolean> {
    const now = Date.now();
    if (
      this._isRustAvailable !== null &&
      now - this._lastHealthCheck < this._healthCheckInterval
    ) {
      return this._isRustAvailable;
    }

    try {
      const resp = await this.client.get<{ status: string }>("/api/health", {
        timeout: 3000,
        retries: 0,
        cache: false,
      });
      this._isRustAvailable = resp.data.status === "ok" || resp.status === 200;
    } catch {
      this._isRustAvailable = false;
    }

    this._lastHealthCheck = now;
    return this._isRustAvailable;
  }

  /**
   * Get Rust backend capabilities
   */
  async getCapabilities(): Promise<string[]> {
    try {
      const resp = await this.client.get<{ capabilities: string[] }>(
        "/api/advanced/capabilities",
        { cache: true },
      );
      return resp.data.capabilities || [];
    } catch {
      return [];
    }
  }

  // ── Static Analysis ─────────────────────────────────────────────────────

  async analyzeStatic(model: AnalysisModel): Promise<StaticResult> {
    const resp = await this.client.post<StaticResult>("/api/analyze", model);
    return resp.data;
  }

  // ── P-Delta (Geometric Nonlinearity) ────────────────────────────────────

  async analyzePDelta(
    model: AnalysisModel,
    options?: { maxIterations?: number; tolerance?: number },
  ): Promise<StaticResult> {
    const resp = await this.client.post<StaticResult>("/api/advanced/pdelta", {
      ...model,
      ...options,
    });
    return resp.data;
  }

  // ── Modal Analysis ──────────────────────────────────────────────────────

  async analyzeModal(
    model: AnalysisModel,
    nModes: number = 12,
  ): Promise<ModalResult> {
    const resp = await this.client.post<ModalResult>("/api/advanced/modal", {
      ...model,
      n_modes: nModes,
    });
    return resp.data;
  }

  // ── Buckling Analysis ───────────────────────────────────────────────────

  async analyzeBuckling(model: AnalysisModel): Promise<BucklingResult> {
    const resp = await this.client.post<BucklingResult>(
      "/api/advanced/buckling",
      model,
    );
    return resp.data;
  }

  // ── Response Spectrum ───────────────────────────────────────────────────

  async analyzeSpectrum(
    model: AnalysisModel,
    options: {
      zoneFactor?: number;
      importanceFactor?: number;
      responseReduction?: number;
      soilType?: string;
      combinationMethod?: "CQC" | "SRSS";
    } = {},
  ): Promise<SpectrumResult> {
    const resp = await this.client.post<SpectrumResult>(
      "/api/advanced/spectrum",
      {
        ...model,
        zone_factor: options.zoneFactor ?? 0.16,
        importance_factor: options.importanceFactor ?? 1.0,
        response_reduction: options.responseReduction ?? 5.0,
        soil_type: options.soilType ?? "medium",
        combination_method: options.combinationMethod ?? "CQC",
      },
    );
    return resp.data;
  }

  // ── Cable Analysis ──────────────────────────────────────────────────────

  async analyzeCable(params: {
    span: number;
    sag: number;
    loadPerMeter: number;
    cableArea: number;
    elasticModulus: number;
    selfWeight?: number;
  }): Promise<{
    horizontalTension: number;
    maxTension: number;
    cableLength: number;
    sagRatio: number;
  }> {
    const resp = await this.client.post<any>("/api/advanced/cable", params);
    return resp.data;
  }

  // ── Design Checks (canonical owner: Python backend) ────────────────

  async checkSteelDesign(params: {
    code: "IS800" | "AISC360" | "Eurocode3";
    sectionDesignation: string;
    memberForces: number[];
    memberLength: number;
    effectiveLengthFactorY?: number;
    effectiveLengthFactorZ?: number;
    fy?: number;
  }): Promise<DesignCheckResult> {
    const resp = await this.pythonClient.post<DesignCheckResult>(
      "/design/steel/check",
      params,
    );
    return resp.data;
  }

  async checkConcreteDesign(params: {
    code: "IS456" | "ACI318" | "Eurocode2";
    memberType: "beam" | "column";
    memberForces: number[];
    width: number;
    depth: number;
    fck: number;
    fy: number;
    cover?: number;
  }): Promise<DesignCheckResult> {
    const resp = await this.pythonClient.post<DesignCheckResult>(
      `/design/concrete/${params.memberType === "column" ? "column" : "beam"}`,
      params,
    );
    return resp.data;
  }

  // ── Steel Section Database ─────────────────────────────────────────────

  async getSections(standard: string = "is"): Promise<SteelSection[]> {
    const resp = await this.client.get<{ sections: SteelSection[] }>(
      `/api/sections`,
      { params: { standard }, cache: true },
    );
    return resp.data.sections || [];
  }

  async searchSections(query: string): Promise<SteelSection[]> {
    const resp = await this.client.get<{ sections: SteelSection[] }>(
      `/api/sections/search`,
      { params: { q: query }, cache: true },
    );
    return resp.data.sections || [];
  }

  async getOptimalSection(
    requiredZx: number,
    standard: string = "is",
  ): Promise<SteelSection | null> {
    try {
      const resp = await this.client.get<{ section: SteelSection }>(
        `/api/sections/${standard}/optimal`,
        { params: { required_zx: requiredZx } },
      );
      return resp.data.section || null;
    } catch {
      return null;
    }
  }

  // ── Job Queue (canonical owner: Python backend) ───────────────────────

  /**
   * Submit a long-running analysis job.
   * Returns job_id for polling or WebSocket subscription.
   */
  async submitJob(
    jobType: string,
    input: Record<string, unknown>,
    priority: "urgent" | "high" | "normal" | "low" = "normal",
    userId?: string,
  ): Promise<JobSubmitResponse> {
    if (this.isGpuCandidate(jobType)) {
      return this.submitGpuJob(jobType, input);
    }

    const resp = await this.pythonClient.post<JobSubmitResponse>(
      "/api/jobs/submit",
      { job_type: jobType, priority, user_id: userId, input },
    );
    return resp.data;
  }

  /**
   * Poll job status. Prefer WebSocket for real-time updates.
   */
  async getJobStatus(jobId: string): Promise<JobStatus> {
    if (!jobId.startsWith("py-")) {
      try {
        const gpuResp = await this.nodeClient.get<Record<string, unknown>>(
          `/api/v1/gpu-jobs/${jobId}`,
          { cache: false },
        );
        return this.extractJobStatus(gpuResp.data as Record<string, unknown>);
      } catch {
        // Fall back to legacy Python queue status endpoint.
      }
    }

    const resp = await this.pythonClient.get<any>(`/api/jobs/${jobId}`, {
      cache: false,
    });
    return resp.data;
  }

  /**
   * Cancel a queued job.
   */
  async cancelJob(jobId: string): Promise<boolean> {
    if (!jobId.startsWith("py-")) {
      try {
        const resp = await this.nodeClient.delete<{ success?: boolean }>(
          `/api/v1/gpu-jobs/${jobId}`,
        );
        return Boolean(resp.data.success);
      } catch {
        // continue to Python fallback
      }
    }

    try {
      const resp = await this.pythonClient.delete<{ success: boolean }>(
        `/api/jobs/${jobId}`,
      );
      return resp.data.success;
    } catch {
      return false;
    }
  }

  /**
   * Get queue statistics.
   */
  async getQueueStatus(): Promise<QueueStatus> {
    const resp = await this.pythonClient.get<{ queue: QueueStatus }>(
      "/api/jobs/queue/status",
    );
    return resp.data.queue;
  }

  // ── WebSocket Progress ─────────────────────────────────────────────────

  /**
   * Connect to WebSocket for real-time job progress updates.
   *
   * Usage:
   *   const ws = rustApi.connectJobProgress('abc123', (event) => {
   *     console.log(`${event.percent}% - ${event.message}`);
   *   });
   *   // Later: ws.close();
   */
  connectJobProgress(
    jobId: string,
    onProgress: (event: ProgressEvent) => void,
    onError?: (error: Event) => void,
  ): WebSocket {
    // Use the dedicated WS URL from env config
    const wsUrl =
      API_CONFIG.wsUrl ||
      API_CONFIG.pythonUrl
        .replace("http://", "ws://")
        .replace("https://", "wss://");

    // Include auth token as query param (WebSocket doesn't support custom headers)
    const token = typeof window !== 'undefined'
      ? window.localStorage?.getItem('auth_token')
      : null;
    const authQuery = token ? `?token=${encodeURIComponent(token)}` : '';
    const ws = new WebSocket(`${wsUrl}/analysis/${jobId}${authQuery}`);

    ws.onmessage = (event) => {
      try {
        const data: ProgressEvent = JSON.parse(event.data);
        if (data.type === "heartbeat") return; // Ignore heartbeats
        onProgress(data);
      } catch {
        // Ignore parse errors
      }
    };

    ws.onerror = (event) => {
      console.error(`[WS] Job ${jobId} error:`, event);
      onError?.(event);
    };

    ws.onclose = () => {
      console.info(`[WS] Job ${jobId} connection closed`);
    };

    // Send periodic pings to keep alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      } else {
        clearInterval(pingInterval);
      }
    }, 25000);

    return ws;
  }

  // ── Smart Analysis (Auto-Backend Selection) ────────────────────────────

  /**
   * Run analysis with automatic backend selection.
   *
   * Small models (<500 nodes) -> WASM (in-browser, zero latency)
   * Medium models (500-5000 nodes) -> Rust backend (10x faster)
   * Rust unavailable -> Python fallback
   *
   * @param model - The structural analysis model
   * @param analysisType - Type of analysis to perform
   * @param options - Options including an optional `wasmRunner` injected dependency.
   *   Pass `wasmRunner` to avoid dynamic imports of localAnalysis (eliminates circular dep risk).
   */
  async smartAnalyze(
    model: AnalysisModel,
    analysisType:
      | "static"
      | "modal"
      | "pdelta"
      | "buckling"
      | "spectrum" = "static",
    options: {
      wasmRunner?: () => Promise<unknown>;
      computePreference?: ComputePreference;
      [key: string]: unknown;
    } = {},
  ): Promise<{
    result: unknown;
    backend: "wasm" | "rust" | "python";
    timeMs: number;
  }> {
    const nodeCount = model.nodes.length;
    const start = performance.now();
    const computePreference = options.computePreference ?? getComputePreference();
    const capability = await detectLocalComputeCapability();
    const localNodeLimit = capability.maxRecommendedLocalNodes;

    const shouldTryLocal =
      analysisType === "static" &&
      computePreference !== "cloud" &&
      nodeCount <= localNodeLimit &&
      (computePreference === "local" ||
        (computePreference === "auto" && capability.canUseLocal));

    // Local preference path: try WASM/WebGPU first (via injected runner or dynamic import)
    if (shouldTryLocal) {
      try {
        let result: unknown;
        if (options.wasmRunner) {
          // Use injected wasmRunner (preferred — no circular dep)
          result = await options.wasmRunner();
        } else {
          // Fallback: dynamic import (legacy path)
          const { runLocalAnalysis } = await import("./localAnalysis");
          result = await runLocalAnalysis();
        }
        return {
          result,
          backend: "wasm",
          timeMs: performance.now() - start,
        };
      } catch (error) {
        console.warn("[RustAPI] Local analysis path failed, falling back to cloud:", error);
        // Fall through to server
      }
    }

    const shouldUseGpuFleet =
      analysisType !== "static" ||
      nodeCount > localNodeLimit;

    if (shouldUseGpuFleet) {
      try {
        const jobType = analysisType === "static" ? "fem3d" : analysisType;
        const submitResp = await this.submitJob(jobType, {
          ...(model as unknown as Record<string, unknown>),
          options,
        });

        const result = await this.waitForGpuJob(submitResp.job_id, 180_000);
        return {
          result,
          backend: "rust",
          timeMs: performance.now() - start,
        };
      } catch (gpuError) {
        console.warn("[RustAPI] GPU fleet path failed, trying direct backend path:", gpuError);
      }
    }

    // Try Rust backend
    const rustAvailable = await this.isAvailable();
    if (rustAvailable) {
      try {
        let result: unknown;
        switch (analysisType) {
          case "static":
            result = await this.analyzeStatic(model);
            break;
          case "modal":
            result = await this.analyzeModal(
              model,
              (options.nModes as number) || 12,
            );
            break;
          case "pdelta":
            result = await this.analyzePDelta(model, options as any);
            break;
          case "buckling":
            result = await this.analyzeBuckling(model);
            break;
          case "spectrum":
            result = await this.analyzeSpectrum(model, options as any);
            break;
        }
        return {
          result,
          backend: "rust",
          timeMs: performance.now() - start,
        };
      } catch (e) {
        console.warn("[RustAPI] Rust analysis failed, trying Python:", e);
      }
    }

    // Python fallback via job queue
    const jobResp = await this.submitJob(analysisType, {
      ...(model as unknown as Record<string, unknown>),
      options,
    });

    // Poll for result
    const maxWait = 120_000; // 2 minutes
    const pollInterval = 1000;
    let elapsed = 0;

    while (elapsed < maxWait) {
      await new Promise((r) => setTimeout(r, pollInterval));
      elapsed += pollInterval;

      const status = await this.getJobStatus(jobResp.job_id);
      if (status.status === "completed") {
        return {
          result: status.result,
          backend: "python",
          timeMs: performance.now() - start,
        };
      }
      if (status.status === "failed") {
        throw new Error(status.error || "Analysis failed on Python backend");
      }
    }

    throw new Error("Analysis timed out");
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const rustApi = new RustApiService();
export default rustApi;
