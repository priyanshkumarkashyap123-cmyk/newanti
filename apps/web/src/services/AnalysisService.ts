/**
 * AnalysisService - Smart Solver Routing
 *
 * Automatically routes analysis to local worker or cloud server
 * based on model complexity (node count).
 *
 * - nodeCount < 2000: Local SolverWorker
 * - nodeCount >= 2000: Cloud API
 */

import { analysisLogger } from "../utils/logger";
import { API_CONFIG } from "../config/env";
import { getOptimalDofPerNode } from "../utils/structureDimensionality";

// ============================================
// TYPES
// ============================================

export interface PlateData {
  id: string;
  nodeIds: string[];
  thickness: number;
  E?: number;
  nu?: number;
}

export interface ModelData {
  nodes: NodeData[];
  members: MemberData[];
  plates?: PlateData[];
  loads: LoadData[];
  dofPerNode?: 2 | 3 | 6;
  settings?: {
    selfWeight: boolean; // Auto-apply self weight
  };
}

export interface NodeData {
  id: string;
  x: number;
  y: number;
  z: number;
  restraints?: {
    fx?: boolean;
    fy?: boolean;
    fz?: boolean;
    mx?: boolean;
    my?: boolean;
    mz?: boolean;
  };
}

export interface MemberData {
  id: string;
  startNodeId: string;
  endNodeId: string;
  E?: number;
  A?: number;
  I?: number;
  Iy?: number;
  Iz?: number;
  J?: number;
  G?: number;
  type?: "frame" | "truss" | "spring";
  releases?: {
    fxStart?: boolean;
    fyStart?: boolean;
    fzStart?: boolean;
    mxStart?: boolean;
    myStart?: boolean;
    mzStart?: boolean;
    fxEnd?: boolean;
    fyEnd?: boolean;
    fzEnd?: boolean;
    mxEnd?: boolean;
    myEnd?: boolean;
    mzEnd?: boolean;
  };
}

export interface LoadData {
  nodeId: string;
  fx?: number;
  fy?: number;
  fz?: number;
  mx?: number;
  my?: number;
  mz?: number;
}

/** Structured error detail from backend analysis diagnosis */
export interface AnalysisErrorDetail {
  type: string;
  message: string;
  elementIds?: string[];
}

export interface AnalysisResult {
  success: boolean;
  displacements?: Record<string, number[]>;
  reactions?: Record<string, number[]>;
  memberForces?: Record<
    string,
    { axial: number; shear?: number; momentStart?: number; momentEnd?: number }
  >;
  plateResults?: Record<string, { stress: number }>; // Placeholder
  stats?: {
    totalDof?: number;
    nnz?: number;
    sparsity?: number;
    assemblyTimeMs: number;
    solveTimeMs: number;
    totalTimeMs: number;
    method?: string;
    usedCloud?: boolean;
    fallbackFromLocal?: boolean; // True if cloud was used after local solver failed
  };
  error?: string;
  /** Machine-readable error code from backend (e.g. SINGULAR_MATRIX, ANALYSIS_TIMEOUT) */
  errorCode?: string;
  /** Structured diagnostic details with element IDs for 3D highlighting */
  errorDetails?: AnalysisErrorDetail[];
}

export type AnalysisStage =
  | "validating"
  | "uploading"
  | "queued"
  | "assembling"
  | "solving"
  | "downloading"
  | "complete";

export interface ProgressCallback {
  (stage: AnalysisStage, percent: number, message: string): void;
}

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  LOCAL_THRESHOLD: 3000, // Use local WASM solver for models up to 3000 nodes
  LARGE_MODEL_THRESHOLD: 5000, // Use Python sparse solver for 5k+ nodes
  // Python backend for high-performance large model analysis
  PYTHON_API_URL: API_CONFIG.pythonUrl,
  // Node.js API for auth/payments
  API_BASE_URL: API_CONFIG.baseUrl,
  POLL_INTERVAL: 1000, // Poll interval for async jobs (ms)
  MAX_POLL_TIME: 300000, // Maximum poll time (5 minutes)
};

// ============================================
// ANALYSIS SERVICE
// ============================================

class AnalysisService {
  private worker: Worker | null = null;
  private abortController: AbortController | null = null;

  // Debounce state for rapid updates (e.g., slider manipulation)
  private pendingAnalysis: {
    model: ModelData;
    resolve: (result: AnalysisResult) => void;
    reject: (error: Error) => void;
    onProgress?: ProgressCallback;
    token?: string | null;
  } | null = null;
  private debounceTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly DEBOUNCE_MS = 300; // Coalesce requests within 300ms

  /**
   * Debounced analysis - coalesces rapid requests
   * Only the LAST request within DEBOUNCE_MS will be executed
   * Use this for live-updating UI like sliders
   * @see bottleneck_report.md - Missing Solver Debounce fix
   */
  async analyzeDebounced(
    model: ModelData,
    onProgress?: ProgressCallback,
    token?: string | null,
  ): Promise<AnalysisResult> {
    return new Promise((resolve, reject) => {
      // Cancel any pending analysis
      if (this.debounceTimeoutId) {
        clearTimeout(this.debounceTimeoutId);
        // Resolve pending with "superseded" result (not an error)
        if (this.pendingAnalysis) {
          this.pendingAnalysis.resolve({
            success: false,
            error: "Request superseded by newer analysis",
          } as AnalysisResult);
        }
      }

      // Queue this request
      this.pendingAnalysis = { model, resolve, reject, onProgress, token };

      // Start debounce timer
      this.debounceTimeoutId = setTimeout(async () => {
        const pending = this.pendingAnalysis;
        this.pendingAnalysis = null;
        this.debounceTimeoutId = null;

        if (!pending) return;

        try {
          const result = await this.analyze(
            pending.model,
            pending.onProgress,
            pending.token,
          );
          pending.resolve(result);
        } catch (error) {
          pending.reject(
            error instanceof Error ? error : new Error(String(error)),
          );
        }
      }, this.DEBOUNCE_MS);
    });
  }

  /**
   * Run structural analysis
   * Automatically selects local or cloud solver based on model size
   */
  async analyze(
    model: ModelData,
    onProgress?: ProgressCallback,
    token?: string | null,
  ): Promise<AnalysisResult> {
    const nodeCount = model.nodes.length;

    // ── Auto-detect dimensionality if dofPerNode not explicitly set ──
    if (!model.dofPerNode) {
      const detected = getOptimalDofPerNode(
        model.nodes,
        model.members,
        model.loads,
      );
      model = { ...model, dofPerNode: detected };
      analysisLogger.info(`[Auto-detect] dofPerNode = ${detected}`);
    }

    onProgress?.("validating", 5, "Validating model...");

    // Validate model first
    const validation = await this.validateModel(model, token);
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join(", ")}`,
      };
    }

    // Route based on node count
    if (nodeCount < CONFIG.LOCAL_THRESHOLD) {
      // Try local solver first
      const localResult = await this.analyzeLocal(model, onProgress);

      // If local solver failed with memory/size error, fallback to cloud
      if (!localResult.success && localResult.error) {
        const errorLower = localResult.error.toLowerCase();
        const shouldFallback =
          errorLower.includes("memory") ||
          errorLower.includes("too large") ||
          errorLower.includes("exceeds") ||
          errorLower.includes("error 5") ||
          errorLower.includes("crashed") ||
          errorLower.includes("oom");

        if (shouldFallback && token) {
          analysisLogger.warn(
            "Local solver failed, falling back to cloud:",
            localResult.error,
          );
          onProgress?.(
            "uploading",
            15,
            "Local solver failed. Switching to cloud solver...",
          );

          try {
            const cloudResult = await this.analyzeCloud(
              model,
              onProgress,
              token,
            );
            if (cloudResult.success && cloudResult.stats) {
              cloudResult.stats.fallbackFromLocal = true;
            }
            return cloudResult;
          } catch (cloudError) {
            // Both solvers failed - return original local error
            analysisLogger.error("Cloud fallback also failed:", cloudError);
            return {
              success: false,
              error: `Local solver: ${localResult.error}\nCloud solver: ${cloudError instanceof Error ? cloudError.message : String(cloudError)}`,
            };
          }
        }
      }

      return localResult;
    } else {
      return this.analyzeCloud(model, onProgress, token);
    }
  }

  /**
   * Initialize the Web Worker if not already active
   */
  private initializeWorker(): void {
    if (!this.worker) {
      this.worker = new Worker(
        new URL("../workers/StructuralSolverWorker.ts", import.meta.url),
        { type: "module" },
      );

      // Handle worker errors
      this.worker.onerror = (error) => {
        analysisLogger.error("Worker Error:", error);
      };
    }
  }

  /**
   * Run analysis locally using Web Worker
   */
  private async analyzeLocal(
    model: ModelData,
    onProgress?: ProgressCallback,
  ): Promise<AnalysisResult> {
    onProgress?.("assembling", 10, "Starting local solver...");

    return new Promise((resolve, reject) => {
      // Create worker if not exists
      this.initializeWorker();

      const handleMessage = (event: MessageEvent) => {
        const data = event.data;

        if (data.type === "progress") {
          const stage = data.stage as AnalysisStage;
          onProgress?.(stage, data.percent, data.message);
        } else if (data.type === "result") {
          this.worker?.removeEventListener("message", handleMessage);

          if (data.success) {
            const dofPerNode = model.dofPerNode ?? 3;

            // Displacements
            const displacements: Record<string, number[]> = {};
            const dispArray = data.displacements as Float64Array;
            model.nodes.forEach((node, i) => {
              const start = i * dofPerNode;
              displacements[node.id] = Array.from(
                dispArray.slice(start, start + dofPerNode),
              );
            });

            // Reactions (if available)
            let reactions: Record<string, number[]> | undefined;
            if (data.reactions) {
              reactions = {};
              const reacArray = data.reactions as Float64Array;
              model.nodes.forEach((node, i) => {
                const start = i * dofPerNode;
                reactions![node.id] = Array.from(
                  reacArray.slice(start, start + dofPerNode),
                );
              });
            }

            // Member forces (if available) — preserves diagramData from worker
            let memberForces: Record<string, any> | undefined;
            if (data.memberForces && Array.isArray(data.memberForces)) {
              memberForces = {};
              for (const mf of data.memberForces as any[]) {
                memberForces[mf.id] = {
                  axial: mf.start?.axial ?? 0,
                  shear: mf.start?.shear,
                  momentStart: mf.start?.moment,
                  momentEnd: mf.end?.moment,
                  // Pass through diagram arrays from generateDiagramData()
                  max_shear_y: mf.maxShearY,
                  max_moment_y: mf.maxMomentY,
                  x_values: mf.diagramData?.x_values,
                  shear_y: mf.diagramData?.shear_y,
                  shear_z: mf.diagramData?.shear_z,
                  moment_y: mf.diagramData?.moment_y,
                  moment_z: mf.diagramData?.moment_z,
                  // Use key 'axial' as array (matches PyNite format)
                  ...(mf.diagramData?.axial
                    ? { axial: mf.diagramData.axial }
                    : {}),
                  torsion: mf.diagramData?.torsion,
                  deflection_y: mf.diagramData?.deflection_y,
                  deflection_z: mf.diagramData?.deflection_z,
                };
              }
            }

            resolve({
              success: true,
              displacements,
              reactions,
              memberForces,
              stats: {
                ...data.stats,
                usedCloud: false,
              },
            });
          } else {
            resolve({
              success: false,
              error: data.error,
            });
          }
        }
      };

      if (this.worker) {
        this.worker.addEventListener("message", handleMessage);

        const handleError = (error: ErrorEvent) => {
          this.worker?.removeEventListener("message", handleMessage);
          this.worker?.removeEventListener("error", handleError);
          reject(new Error(error.message));
        };
        this.worker.addEventListener("error", handleError);
      } else {
        reject(new Error("Worker initialization failed"));
        return;
      }

      // Convert member loads to nodal loads if present
      const sendToWorker = async () => {
        let allLoads = [...model.loads];

        // Check if model has memberLoads property
        const modelWithMemberLoads = model as any;
        if (
          modelWithMemberLoads.memberLoads &&
          modelWithMemberLoads.memberLoads.length > 0
        ) {
          analysisLogger.info(
            `Converting ${modelWithMemberLoads.memberLoads.length} member loads to nodal loads...`,
          );
          analysisLogger.debug(
            "Member loads:",
            modelWithMemberLoads.memberLoads,
          );

          try {
            // Import conversion utility
            const { convertMemberLoadsToNodal, mergeNodalLoads } =
              await import("../utils/loadConversion");

            const conversionResult = convertMemberLoadsToNodal(
              modelWithMemberLoads.memberLoads,
              model.members,
              model.nodes,
            );

            analysisLogger.debug("Conversion result:", {
              summary: conversionResult.summary,
              errors: conversionResult.errors,
              warnings: conversionResult.warnings,
              nodalLoadsCount: conversionResult.nodalLoads.length,
            });

            if (conversionResult.errors.length > 0) {
              analysisLogger.error(
                "Conversion errors:",
                conversionResult.errors,
              );
            }

            if (conversionResult.warnings.length > 0) {
              analysisLogger.warn(
                "Conversion warnings:",
                conversionResult.warnings,
              );
            }

            // Merge with existing nodal loads
            allLoads = mergeNodalLoads([
              ...allLoads,
              ...conversionResult.nodalLoads,
            ]);

            analysisLogger.info(
              `Total nodal loads after conversion: ${allLoads.length}`,
            );
            analysisLogger.debug("Final loads being sent to worker:", allLoads);
          } catch (err) {
            analysisLogger.error("Load conversion failed:", err);
            // Continue with original loads
          }
        } else {
          analysisLogger.debug(
            "No member loads to convert, using direct nodal loads:",
            allLoads.length,
          );
        }

        // Send to worker
        // NOTE: Do NOT pass memberLoads here — loadConversion.ts already converted
        // them into equivalent nodal loads (merged into allLoads above).
        // Passing memberLoads would cause the worker to independently re-compute
        // fixed-end forces, resulting in DOUBLE-COUNTING of member load effects.
        this.worker!.postMessage({
          type: "analyze",
          requestId: `local-${Date.now()}`,
          model: {
            nodes: model.nodes,
            members: model.members,
            loads: allLoads,
            memberLoads: [], // Cleared — already converted to nodal loads above
            // Pass original member loads for force-recovery only.
            // The worker uses these to subtract FEF from k*u during
            // member force computation (f = k*u − FEF).
            memberLoadsForRecovery: modelWithMemberLoads.memberLoads ?? [],
            dofPerNode:
              model.dofPerNode ??
              getOptimalDofPerNode(model.nodes, model.members, model.loads),
            settings: model.settings,
          },
        });
      };

      sendToWorker();
    });
  }

  /**
   * Run analysis on cloud server using Python sparse solver
   */
  /**
   * Run analysis on cloud server using Python sparse solver via Worker
   * Offloads JSON serialization and network request to worker thread
   */
  private async analyzeCloud(
    model: ModelData,
    onProgress?: ProgressCallback,
    token?: string | null,
  ): Promise<AnalysisResult> {
    return new Promise((resolve) => {
      if (!this.worker) {
        this.initializeWorker();
      }

      const requestId = `cloud-${Date.now()}`;

      // Progress listener
      const progressHandler = (e: MessageEvent) => {
        const { type, stage, percent, message } = e.data;
        if (type === "progress") {
          onProgress?.(stage, percent, message);
        }
      };

      // Result handler
      const resultHandler = (e: MessageEvent) => {
        const response = e.data;

        // Filter for this specific request
        if (response.requestId !== requestId) return;

        if (response.type === "result") {
          // Cleanup
          this.worker!.removeEventListener("message", progressHandler);
          this.worker!.removeEventListener("message", resultHandler);

          if (!response.success) {
            resolve({
              success: false,
              error: response.error || "Worker cloud analysis failed",
              errorCode: response.errorCode,
              errorDetails: response.errorDetails,
            });
            return;
          }

          const data = response.data;

          onProgress?.("complete", 100, "Analysis complete!");

          // Convert displacements format
          const displacements: Record<string, number[]> = {};
          for (const [nodeId, disp] of Object.entries(
            data.displacements || {},
          )) {
            const d = disp as {
              dx: number;
              dy: number;
              dz: number;
              rx: number;
              ry: number;
              rz: number;
            };
            displacements[nodeId] = [d.dx, d.dy, d.dz, d.rx, d.ry, d.rz];
          }

          // Convert reactions (array of 6 DOF per node)
          const reactions: Record<string, number[]> | undefined =
            data.reactions && Object.keys(data.reactions).length > 0
              ? (data.reactions as Record<string, number[]>)
              : undefined;

          // Convert member forces from cloud format
          let memberForces: Record<string, any> | undefined;
          if (data.member_forces && Object.keys(data.member_forces).length > 0) {
            memberForces = {};
            for (const [memberId, mf] of Object.entries(data.member_forces || {})) {
              const f = mf as any;
              memberForces[memberId] = {
                axial: f.axial_start ?? 0,
                shear: f.shear_y_start,
                momentStart: f.moment_z_start,
                momentEnd: f.moment_z_end,
              };
            }
          }

          resolve({
            success: true,
            displacements,
            reactions,
            memberForces,
            stats: {
              assemblyTimeMs: 0,
              solveTimeMs: data.stats?.solve_time_ms || 0,
              totalTimeMs: data.stats?.total_time_ms || 0,
              method: data.stats?.method,
              usedCloud: true,
            },
          });
        }
      };

      this.worker!.addEventListener("message", progressHandler);
      this.worker!.addEventListener("message", resultHandler);

      // Send to worker
      this.worker!.postMessage({
        type: "analyze_cloud",
        requestId,
        model: {
          nodes: model.nodes,
          members: model.members,
          loads: model.loads,
          dofPerNode:
            model.dofPerNode ??
            getOptimalDofPerNode(model.nodes, model.members, model.loads),
          settings: model.settings,
        },
        url: CONFIG.PYTHON_API_URL,
        token,
      });
    });
  }

  /**
   * Poll for async job results with exponential backoff and timeout
   * Reserved for async backend polling (Phase 2)
   */
  private async pollForResults(
    jobId: string,
    onProgress?: ProgressCallback,
    signal?: AbortSignal,
    token?: string | null,
  ): Promise<AnalysisResult> {
    const startTime = Date.now();
    let pollCount = 0;
    let pollInterval = CONFIG.POLL_INTERVAL;
    const maxPollInterval = 5000; // Max 5 seconds between polls

    while (Date.now() - startTime < CONFIG.MAX_POLL_TIME) {
      if (signal?.aborted) {
        return { success: false, error: "Analysis cancelled" };
      }

      try {
        const headers: Record<string, string> = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        // Create abort controller for fetch with 10s timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
          const response = await fetch(
            `${CONFIG.API_BASE_URL}/api/analyze/job/${jobId}`,
            {
              signal: controller.signal,
              headers,
              cache: "no-store",
            },
          );

          clearTimeout(timeoutId);

          if (!response.ok) {
            // Log but don't crash on temporary errors
            if (response.status >= 500) {
              analysisLogger.warn(
                `Server error fetching job status: ${response.status}`,
              );
            } else if (response.status === 404) {
              return { success: false, error: "Job not found" };
            }
            throw new Error(`HTTP ${response.status}`);
          }

          const data = await response.json();
          const job = data.job;

          if (!job) {
            throw new Error("Invalid job response");
          }

          if (job.status === "completed") {
            onProgress?.("complete", 100, "Analysis complete!");
            return {
              ...job.result,
              stats: { ...job.result?.stats, usedCloud: true },
            };
          }

          if (job.status === "failed") {
            return {
              success: false,
              error: job.error || "Analysis failed",
              errorCode: job.errorCode,
              errorDetails: job.errorDetails,
            };
          }

          // Update progress - ensure valid range
          const progress = Math.min(99, Math.max(10, job.progress || 30));
          onProgress?.("solving", progress, `Processing... ${job.status}`);

          // Reset poll interval on success
          pollInterval = CONFIG.POLL_INTERVAL;
          pollCount = 0;
        } catch (fetchError) {
          clearTimeout(timeoutId);

          if (
            fetchError instanceof TypeError &&
            fetchError.message.includes("Failed to fetch")
          ) {
            analysisLogger.warn("Network error, will retry...");
          } else if (
            fetchError instanceof DOMException &&
            fetchError.name === "AbortError"
          ) {
            analysisLogger.warn("Fetch timeout, retrying...");
          } else {
            analysisLogger.error("Poll fetch error:", fetchError);
          }
          // Continue polling on network errors
        }
      } catch (error) {
        analysisLogger.error("Poll error:", error);
        // Don't throw - continue polling
      }

      // Exponential backoff with max
      pollCount++;
      pollInterval = Math.min(
        maxPollInterval,
        CONFIG.POLL_INTERVAL * Math.pow(1.5, Math.min(pollCount, 3)),
      );

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    return { success: false, error: "Analysis timed out after 5 minutes" };
  }

  /**
   * Validate model with server
   */
  async validateModel(
    model: ModelData,
    token?: string | null,
  ): Promise<{ valid: boolean; errors: string[] }> {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${CONFIG.API_BASE_URL}/api/analyze/validate`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(model),
        },
      );

      if (response.ok) {
        return await response.json();
      }

      // Fallback to local validation
      return this.validateModelLocal(model);
    } catch {
      // Fallback to local validation if server unavailable
      return this.validateModelLocal(model);
    }
  }

  /**
   * Run non-linear analysis (P-Delta, Geometric Non-linearity)
   */
  async runNonLinearAnalysis(
    model: ModelData,
    settings: {
      type: "p_delta" | "geometric" | "material";
      iterations?: number;
      tolerance?: number;
    },
    token?: string | null,
  ): Promise<AnalysisResult> {
    // Non-linear always runs on cloud due to complexity
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // Route to Rust backend P-Delta solver (20x faster than Python)
      const API_URL = API_CONFIG.baseUrl;
      const response = await fetch(`${API_URL}/api/advanced/pdelta`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          input: model,
          max_iterations: settings?.iterations || 10,
          tolerance: settings?.tolerance || 1e-6,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.detail || "Non-linear analysis failed",
        };
      }

      return await response.json();
    } catch (error) {
      analysisLogger.error("Non-linear analysis error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Network error",
      };
    }
  }

  /**
   * Local model validation
   */
  private validateModelLocal(model: ModelData): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!model.nodes?.length) {
      errors.push("No nodes in model");
    }

    if (!model.members?.length) {
      errors.push("No members in model");
    }

    const nodeIds = new Set(model.nodes?.map((n) => n.id));
    for (const member of model.members || []) {
      if (!nodeIds.has(member.startNodeId)) {
        errors.push(`Invalid start node: ${member.startNodeId}`);
        break;
      }
      if (!nodeIds.has(member.endNodeId)) {
        errors.push(`Invalid end node: ${member.endNodeId}`);
        break;
      }
    }

    const hasRestraints = model.nodes?.some(
      (n) =>
        n.restraints && (n.restraints.fx || n.restraints.fy || n.restraints.fz),
    );
    if (!hasRestraints) {
      errors.push("No boundary conditions defined");
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Cancel ongoing analysis
   */
  cancel(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  /**
   * Terminate worker
   */
  dispose(): void {
    this.cancel();
    this.worker?.terminate();
    this.worker = null;
  }

  /**
   * Get recommended solver based on model
   */
  getRecommendedSolver(nodeCount: number): "local" | "cloud" {
    return nodeCount < CONFIG.LOCAL_THRESHOLD ? "local" : "cloud";
  }
}

// Export singleton
export const analysisService = new AnalysisService();
export default AnalysisService;
