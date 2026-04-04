import type { MutableRefObject } from "react";
import { abortAndClear, clearProgressInterval } from "./runtimeCleanup";

export interface ExecutionCleanupContext {
  progressIntervalRef: MutableRefObject<ReturnType<typeof setInterval> | null>;
  analysisAbortRef: MutableRefObject<AbortController | null>;
  clearAnimation: () => void;
  setIsAnalyzingLocal: (v: boolean) => void;
  setIsAnalyzing: (v: boolean) => void;
  releaseDeviceLock: () => Promise<void>;
}

export function cleanupAnalysisExecution(context: ExecutionCleanupContext): void {
  context.clearAnimation();
  clearProgressInterval(context.progressIntervalRef);
  abortAndClear(context.analysisAbortRef);
  context.setIsAnalyzingLocal(false);
  context.setIsAnalyzing(false);
  void context.releaseDeviceLock().catch(() => {
    // non-critical cleanup
  });
}