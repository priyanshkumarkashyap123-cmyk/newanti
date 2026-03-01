/**
 * ============================================================================
 * REACT HOOKS FOR RUST BACKEND API
 * ============================================================================
 *
 * High-level hooks for structural analysis with:
 * - Automatic loading/error state management
 * - Real-time progress via WebSocket
 * - Backend fallback (WASM -> Rust -> Python)
 * - Result caching in component state
 *
 * @version 1.0.0
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  rustApi,
  type AnalysisModel,
  type StaticResult,
  type ModalResult,
  type DesignCheckResult,
  type SteelSection,
  type ProgressEvent,
} from "../api/rustApi";

// ============================================================================
// TYPES
// ============================================================================

export interface AnalysisState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  backend: "wasm" | "rust" | "python" | null;
  timeMs: number | null;
  progress: ProgressEvent | null;
}

function getErrorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

// ============================================================================
// CORE ANALYSIS HOOK
// ============================================================================

/**
 * Smart analysis hook with automatic backend selection and progress tracking.
 *
 * Usage:
 *   const { analyze, data, loading, progress, error, backend } = useSmartAnalysis();
 *   await analyze(model, 'static');
 */
export function useSmartAnalysis() {
  const [state, setState] = useState<AnalysisState<unknown>>({
    data: null,
    loading: false,
    error: null,
    backend: null,
    timeMs: null,
    progress: null,
  });

  const analyze = useCallback(
    async (
      model: AnalysisModel,
      type: "static" | "modal" | "pdelta" | "buckling" | "spectrum" = "static",
      options: Record<string, unknown> = {},
    ) => {
      setState((s) => ({ ...s, loading: true, error: null, progress: null }));

      try {
        const result = await rustApi.smartAnalyze(model, type, options);
        setState({
          data: result.result,
          loading: false,
          error: null,
          backend: result.backend,
          timeMs: result.timeMs,
          progress: null,
        });
        return result;
      } catch (e: unknown) {
        setState((s) => ({
          ...s,
          loading: false,
          error: getErrorMessage(e, "Analysis failed"),
        }));
        throw e;
      }
    },
    [],
  );

  return {
    analyze,
    ...state,
    reset: () =>
      setState({
        data: null,
        loading: false,
        error: null,
        backend: null,
        timeMs: null,
        progress: null,
      }),
  };
}

// ============================================================================
// STATIC ANALYSIS HOOK
// ============================================================================

export function useStaticAnalysis() {
  const [state, setState] = useState<AnalysisState<StaticResult>>({
    data: null,
    loading: false,
    error: null,
    backend: null,
    timeMs: null,
    progress: null,
  });

  const analyze = useCallback(async (model: AnalysisModel) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const start = performance.now();

    try {
      const result = await rustApi.analyzeStatic(model);
      setState({
        data: result,
        loading: false,
        error: null,
        backend: "rust",
        timeMs: performance.now() - start,
        progress: null,
      });
      return result;
    } catch (e: unknown) {
      setState((s) => ({
        ...s,
        loading: false,
        error: getErrorMessage(e, "Analysis failed"),
      }));
      throw e;
    }
  }, []);

  return { analyze, ...state };
}

// ============================================================================
// MODAL ANALYSIS HOOK
// ============================================================================

export function useModalAnalysis() {
  const [state, setState] = useState<AnalysisState<ModalResult>>({
    data: null,
    loading: false,
    error: null,
    backend: null,
    timeMs: null,
    progress: null,
  });

  const analyze = useCallback(async (model: AnalysisModel, nModes = 12) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const start = performance.now();

    try {
      const result = await rustApi.analyzeModal(model, nModes);
      setState({
        data: result,
        loading: false,
        error: null,
        backend: "rust",
        timeMs: performance.now() - start,
        progress: null,
      });
      return result;
    } catch (e: unknown) {
      setState((s) => ({
        ...s,
        loading: false,
        error: getErrorMessage(e, "Analysis failed"),
      }));
      throw e;
    }
  }, []);

  return { analyze, ...state };
}

// ============================================================================
// JOB PROGRESS HOOK (WebSocket-based)
// ============================================================================

/**
 * Track a long-running analysis job with WebSocket progress updates.
 *
 * Usage:
 *   const { submit, jobId, status, progress, result, error } = useAnalysisJob();
 *   await submit('modal', modelData, 'high');
 */
export function useAnalysisJob() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  // Cleanup WebSocket and polling on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      wsRef.current?.close();
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  const submit = useCallback(
    async (
      jobType: string,
      input: Record<string, unknown>,
      priority: "urgent" | "high" | "normal" | "low" = "normal",
    ) => {
      setLoading(true);
      setError(null);
      setResult(null);
      setProgress(null);

      try {
        const resp = await rustApi.submitJob(jobType, input, priority);
        setJobId(resp.job_id);
        setStatus("queued");

        // Connect WebSocket for progress
        wsRef.current?.close();
        wsRef.current = rustApi.connectJobProgress(
          resp.job_id,
          (event) => {
            setProgress(event);
            if (event.status) setStatus(event.status);

            if (event.status === "completed") {
              setLoading(false);
              // Fetch the full result
              rustApi.getJobStatus(resp.job_id).then((st) => {
                setResult(st.result);
              });
            } else if (event.status === "failed") {
              setLoading(false);
              setError(event.message || "Job failed");
            }
          },
          () => {
            // On WS error, fall back to polling
            startPolling(resp.job_id);
          },
        );

        return resp.job_id;
      } catch (e: unknown) {
        setLoading(false);
        setError(getErrorMessage(e, "Failed to submit job"));
        throw e;
      }
    },
    [],
  );

  const startPolling = useCallback((id: string) => {
    const poll = async () => {
      if (!isMountedRef.current) return;
      try {
        const st = await rustApi.getJobStatus(id);
        if (!isMountedRef.current) return;
        setStatus(st.status);
        setProgress({
          type: "job_progress",
          percent: st.progress,
          stage: st.stage,
          message: st.message,
        });

        if (st.status === "completed") {
          setResult(st.result);
          setLoading(false);
        } else if (st.status === "failed") {
          setError(st.error || "Job failed");
          setLoading(false);
        } else {
          pollingRef.current = setTimeout(poll, 2000);
        }
      } catch {
        if (isMountedRef.current) {
          pollingRef.current = setTimeout(poll, 5000);
        }
      }
    };
    poll();
  }, []);

  const cancel = useCallback(async () => {
    if (jobId) {
      await rustApi.cancelJob(jobId);
      setStatus("cancelled");
      setLoading(false);
      wsRef.current?.close();
    }
  }, [jobId]);

  return {
    submit,
    cancel,
    jobId,
    status,
    progress,
    result,
    error,
    loading,
  };
}

// ============================================================================
// SECTION DATABASE HOOK
// ============================================================================

export function useSteelSections(standard: string = "is") {
  const [sections, setSections] = useState<SteelSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    rustApi
      .getSections(standard)
      .then((data) => {
        if (!cancelled) {
          setSections(data);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(getErrorMessage(e, "Failed to load steel sections"));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [standard]);

  const search = useCallback(async (query: string) => {
    try {
      const results = await rustApi.searchSections(query);
      setSections(results);
    } catch {
      // Keep existing sections on search error
    }
  }, []);

  return { sections, loading, error, search };
}

// ============================================================================
// DESIGN CHECK HOOK
// ============================================================================

export function useDesignCheck() {
  const [result, setResult] = useState<DesignCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkSteel = useCallback(
    async (params: Parameters<typeof rustApi.checkSteelDesign>[0]) => {
      setLoading(true);
      setError(null);
      try {
        const res = await rustApi.checkSteelDesign(params);
        setResult(res);
        setLoading(false);
        return res;
      } catch (e: unknown) {
        setError(getErrorMessage(e, "Steel design check failed"));
        setLoading(false);
        throw e;
      }
    },
    [],
  );

  const checkConcrete = useCallback(
    async (params: Parameters<typeof rustApi.checkConcreteDesign>[0]) => {
      setLoading(true);
      setError(null);
      try {
        const res = await rustApi.checkConcreteDesign(params);
        setResult(res);
        setLoading(false);
        return res;
      } catch (e: unknown) {
        setError(getErrorMessage(e, "Concrete design check failed"));
        setLoading(false);
        throw e;
      }
    },
    [],
  );

  return { checkSteel, checkConcrete, result, loading, error };
}

// ============================================================================
// RUST BACKEND STATUS HOOK
// ============================================================================

export function useRustBackendStatus() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [queueStatus, setQueueStatus] = useState<{
    queued: number;
    running: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const isUp = await rustApi.isAvailable();
      if (cancelled) return;
      setAvailable(isUp);

      if (isUp) {
        const caps = await rustApi.getCapabilities();
        if (!cancelled) setCapabilities(caps);

        try {
          const qs = await rustApi.getQueueStatus();
          if (!cancelled)
            setQueueStatus({ queued: qs.queued, running: qs.running });
        } catch {
          // Queue status may not be available
        }
      }
    };

    check();
    const interval = setInterval(check, 60_000); // Re-check every minute

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { available, capabilities, queueStatus };
}
