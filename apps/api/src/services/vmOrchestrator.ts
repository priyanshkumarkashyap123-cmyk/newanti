/**
 * Azure VM Orchestrator — GPU Compute Gateway
 *
 * This service sits between the Node API and the Azure VM Scale Set that
 * runs GPU-accelerated structural solvers.  It provides:
 *
 *   • Job submission   — POST /jobs        (fire a GPU task)
 *   • Status polling   — GET  /jobs/:id    (check result)
 *   • Job cancellation — DELETE /jobs/:id  (abort in-flight work)
 *   • Health probe     — GET  /health      (is the fleet reachable?)
 *
 * FALLBACK BEHAVIOUR
 * If AZURE_VM_ORCHESTRATOR_URL is absent (dev/CI) every call falls back
 * to the Python backend gracefully — the rest of the API never notices.
 *
 * CIRCUIT BREAKER
 * Tracks consecutive failures.  After VM_CIRCUIT_THRESHOLD failures the
 * circuit "opens" for VM_CIRCUIT_RESET_MS milliseconds, forcing all traffic
 * to the Python fallback until the fleet recovers.
 *
 * SECURITY
 * - API key sent as Bearer token in Authorization header (never in URL).
 * - API key value is never logged.
 * - All fetch calls have an explicit AbortController timeout.
 */

import { logger } from "../utils/logger.js";
import { pythonProxy } from "./serviceProxy.js";

// ============================================
// CONFIG (from environment, never hardcoded)
// ============================================

const VM_ORCHESTRATOR_URL = normalizeBaseUrl(process.env["AZURE_VM_ORCHESTRATOR_URL"] ?? "");
const VM_API_KEY = process.env["AZURE_VM_ORCHESTRATOR_API_KEY"] ?? "";

/** ms to wait for the orchestrator before timing out a single HTTP call */
const VM_HTTP_TIMEOUT_MS = getPositiveIntEnv("AZURE_VM_HTTP_TIMEOUT_MS", 30_000);

/** how many consecutive failures before opening the circuit */
const VM_CIRCUIT_THRESHOLD = getPositiveIntEnv("AZURE_VM_CIRCUIT_THRESHOLD", 5);

/** how long the circuit stays open before attempting half-open probe (ms) */
const VM_CIRCUIT_RESET_MS = getPositiveIntEnv("AZURE_VM_CIRCUIT_RESET_MS", 60_000);

/**
 * Max attempts for job-submission retries with exponential backoff.
 * Status-polling retries are handled by the caller (client polls).
 */
const VM_SUBMIT_MAX_RETRIES = getPositiveIntEnv("AZURE_VM_SUBMIT_MAX_RETRIES", 3);

// ============================================
// TYPES
// ============================================

export interface VmJobPayload {
  /** Solver type: "fem3d" | "pdelta" | "modal" | "buckling" | "nonlinear" etc. */
  solver: string;
  /** Arbitrary JSON input — validated by the VM worker, not here */
  input: Record<string, unknown>;
  /** Caller-supplied idempotency key (e.g. user+project+timestamp hash) */
  idempotencyKey?: string;
  /** Priority class: "low" | "normal" | "high" — defaults to "normal" */
  priority?: "low" | "normal" | "high";
}

export type VmJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "timeout";

export interface VmJobResult {
  jobId: string;
  status: VmJobStatus;
  /** Wall-clock time in ms as reported by the GPU worker */
  durationMs?: number;
  /** Solver output — present when status === "completed" */
  output?: Record<string, unknown>;
  /** Human-readable error from the GPU worker */
  error?: string;
  /** ISO timestamp of last state change */
  updatedAt?: string;
}

export interface VmSubmitResponse {
  jobId: string;
  status: "queued" | "running";
  estimatedDurationMs?: number;
}

export interface VmHealthResponse {
  healthy: boolean;
  activeWorkers: number;
  queueDepth: number;
  latencyMs: number;
}

// ============================================
// CIRCUIT BREAKER STATE
// ============================================

interface CircuitState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

const circuit: CircuitState = {
  failures: 0,
  lastFailure: 0,
  isOpen: false,
};

function isCircuitOpen(): boolean {
  if (!circuit.isOpen) return false;
  const elapsed = Date.now() - circuit.lastFailure;
  if (elapsed >= VM_CIRCUIT_RESET_MS) {
    // Half-open: allow one probe through
    circuit.isOpen = false;
    circuit.failures = 0;
    logger.info("[VmOrchestrator] Circuit half-open — probing VM fleet");
    return false;
  }
  return true;
}

function recordSuccess(): void {
  circuit.failures = 0;
  circuit.isOpen = false;
}

function recordFailure(reason: string): void {
  circuit.failures += 1;
  circuit.lastFailure = Date.now();
  if (circuit.failures >= VM_CIRCUIT_THRESHOLD) {
    circuit.isOpen = true;
    logger.warn(
      { failures: circuit.failures, reason },
      "[VmOrchestrator] Circuit OPENED — routing to Python fallback",
    );
  }
}

// ============================================
// INTERNAL HTTP HELPER
// ============================================

interface FetchResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

function shouldCountAsCircuitFailure(status: number): boolean {
  // Only penalize infra/transient errors, never caller 4xx errors.
  return status === 408 || status >= 500;
}

async function vmFetch<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
  timeoutMs = VM_HTTP_TIMEOUT_MS,
): Promise<FetchResult<T>> {
  const url = `${VM_ORCHESTRATOR_URL}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    Accept: "application/json",
    // API key auth — value never logged
    Authorization: `Bearer ${VM_API_KEY}`,
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        ok: false,
        status: response.status,
        error: `HTTP ${response.status}: ${text.slice(0, 200)}`,
      };
    }

    // Handle 204/no-content and non-JSON responses safely.
    if (response.status === 204) {
      return { ok: true, status: response.status };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return { ok: true, status: response.status };
    }

    const text = await response.text();
    if (!text) {
      return { ok: true, status: response.status };
    }

    const data = JSON.parse(text) as T;
    return { ok: true, status: response.status, data };
  } catch (err) {
    clearTimeout(timer);
    const isTimeout =
      err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      status: isTimeout ? 408 : 503,
      error: isTimeout ? "VM orchestrator request timed out" : String(err),
    };
  }
}

// ============================================
// FEATURE FLAG — is the fleet configured?
// ============================================

export function isVmOrchestratorConfigured(): boolean {
  return VM_ORCHESTRATOR_URL.length > 0 && VM_API_KEY.length > 0;
}

export function getCircuitStats(): CircuitState & { configured: boolean } {
  return { ...circuit, configured: isVmOrchestratorConfigured() };
}

// ============================================
// PUBLIC API — submitGpuJob
// ============================================

/**
 * Submit a job to the GPU worker fleet.
 *
 * Retries up to VM_SUBMIT_MAX_RETRIES times with exponential backoff
 * (200 ms → 400 ms → 800 ms).  If the circuit is open or the fleet is
 * not configured, falls back immediately to the Python backend.
 *
 * @returns The vm job ID + queued/running status, or Python fallback data.
 */
export async function submitGpuJob(
  payload: VmJobPayload,
): Promise<{ source: "vm" | "python"; data: unknown }> {
  const normalizedPayload: VmJobPayload = {
    ...payload,
    priority: payload.priority ?? "normal",
  };

  if (!isVmOrchestratorConfigured() || isCircuitOpen()) {
    logger.info(
      {
        solver: payload.solver,
        circuitOpen: circuit.isOpen,
        configured: isVmOrchestratorConfigured(),
      },
      "[VmOrchestrator] Routing to Python fallback",
    );
    return _pythonFallback("POST", "/api/jobs/submit", normalizedPayload);
  }

  let lastError = "";
  for (let attempt = 1; attempt <= VM_SUBMIT_MAX_RETRIES; attempt++) {
    const result = await vmFetch<VmSubmitResponse>(
      "POST",
      "/jobs",
      normalizedPayload,
    );

    if (result.ok && result.data) {
      recordSuccess();
      logger.info(
        { jobId: result.data.jobId, solver: payload.solver, attempt },
        "[VmOrchestrator] Job submitted to GPU fleet",
      );
      return { source: "vm", data: result.data };
    }

    lastError = result.error ?? "Unknown error";
    if (shouldCountAsCircuitFailure(result.status)) {
      recordFailure(lastError);
    }

    // Don't retry on 4xx — these are caller errors, not transient fleet issues
    if (result.status >= 400 && result.status < 500) {
      break;
    }

    // Exponential backoff: 200ms, 400ms, 800ms
    if (attempt < VM_SUBMIT_MAX_RETRIES) {
      const jitterMs = Math.floor(Math.random() * 75);
      await sleep(200 * Math.pow(2, attempt - 1) + jitterMs);
    }
  }

  // All retries exhausted — fall back to Python
  logger.warn(
    { solver: payload.solver, error: lastError },
    "[VmOrchestrator] GPU fleet unavailable after retries — Python fallback",
  );
  return _pythonFallback("POST", "/api/jobs/submit", normalizedPayload);
}

// ============================================
// PUBLIC API — getGpuJobStatus
// ============================================

/**
 * Poll the status/results of a previously submitted GPU job.
 *
 * Falls back to Python if the job ID looks like a Python job
 * (prefix "py-") or if the fleet is unreachable.
 */
export async function getGpuJobStatus(
  jobId: string,
): Promise<{ source: "vm" | "python"; data: unknown }> {
  // Python job IDs are prefixed "py-"
  if (jobId.startsWith("py-") || !isVmOrchestratorConfigured() || isCircuitOpen()) {
    return _pythonFallback("GET", `/api/jobs/${jobId}`, undefined);
  }

  const result = await vmFetch<VmJobResult>("GET", `/jobs/${jobId}`);

  if (result.ok && result.data) {
    recordSuccess();
    return { source: "vm", data: result.data };
  }

  if (shouldCountAsCircuitFailure(result.status)) {
    recordFailure(result.error ?? "status-check failed");
  }
  return _pythonFallback("GET", `/api/jobs/${jobId}`, undefined);
}

// ============================================
// PUBLIC API — cancelGpuJob
// ============================================

export async function cancelGpuJob(
  jobId: string,
): Promise<{ source: "vm" | "python"; data: unknown }> {
  if (jobId.startsWith("py-") || !isVmOrchestratorConfigured() || isCircuitOpen()) {
    return _pythonFallback("DELETE", `/api/jobs/${jobId}`, undefined);
  }

  const result = await vmFetch<{ cancelled: boolean }>(
    "DELETE",
    `/jobs/${jobId}`,
  );

  if (result.ok) {
    recordSuccess();
    return { source: "vm", data: result.data ?? { cancelled: true } };
  }

  if (shouldCountAsCircuitFailure(result.status)) {
    recordFailure(result.error ?? "cancel failed");
  }
  return _pythonFallback("DELETE", `/api/jobs/${jobId}`, undefined);
}

// ============================================
// PUBLIC API — checkVmHealth
// ============================================

export async function checkVmHealth(): Promise<VmHealthResponse> {
  if (!isVmOrchestratorConfigured()) {
    return { healthy: false, activeWorkers: 0, queueDepth: 0, latencyMs: 0 };
  }

  const start = Date.now();
  const result = await vmFetch<VmHealthResponse>(
    "GET",
    "/health",
    undefined,
    5_000,
  );
  const latencyMs = Date.now() - start;

  if (result.ok && result.data) {
    recordSuccess();
    return { ...result.data, latencyMs };
  }

  if (shouldCountAsCircuitFailure(result.status)) {
    recordFailure(result.error ?? "health-check failed");
  }
  return { healthy: false, activeWorkers: 0, queueDepth: 0, latencyMs };
}

// ============================================
// INTERNAL — Python fallback helper
// ============================================

async function _pythonFallback(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body: unknown,
): Promise<{ source: "python"; data: unknown }> {
  try {
    const result = await pythonProxy(method, path, body);
    return { source: "python", data: result.data };
  } catch (err) {
    logger.error({ err }, "[VmOrchestrator] Python fallback also failed");
    throw err;
  }
}

// ============================================
// UTILITY
// ============================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPositiveIntEnv(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (!raw) return defaultValue;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    logger.warn({ key, raw, defaultValue }, "[VmOrchestrator] Invalid numeric env; using default");
    return defaultValue;
  }
  return Math.floor(parsed);
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}
