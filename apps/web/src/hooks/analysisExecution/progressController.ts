import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { unstable_batchedUpdates } from "react-dom";
import type { AnalysisStage } from "../../components/AnalysisProgressModal";

export interface ProgressUiState {
  stage: AnalysisStage;
  progress: number;
  at: number;
}

type CommitOptions = { force?: boolean };

export type CommitAnalysisProgress = (
  stage: AnalysisStage,
  progress: number,
  options?: CommitOptions,
) => void;

export function createCommitAnalysisProgress(
  progressUiStateRef: MutableRefObject<ProgressUiState>,
  setAnalysisStage: Dispatch<SetStateAction<AnalysisStage>>,
  setAnalysisProgress: Dispatch<SetStateAction<number>>,
): CommitAnalysisProgress {
  return (stage, progress, options) => {
    const now = performance.now();
    const rounded = Math.max(0, Math.min(100, Math.round(progress)));
    const prev = progressUiStateRef.current;
    const stageChanged = prev.stage !== stage;
    const delta = Math.abs(rounded - prev.progress);
    const elapsed = now - prev.at;
    const shouldCommit = options?.force || stageChanged || rounded >= 100 || delta >= 2 || elapsed >= 100;

    if (!shouldCommit) return;

    progressUiStateRef.current = { stage, progress: rounded, at: now };
    unstable_batchedUpdates(() => {
      setAnalysisStage(stage);
      setAnalysisProgress(rounded);
    });
  };
}

export function createProgressAnimator(
  progressIntervalRef: MutableRefObject<ReturnType<typeof setInterval> | null>,
  progressUiStateRef: MutableRefObject<ProgressUiState>,
  commitAnalysisProgress: CommitAnalysisProgress,
) {
  let activeInterval: ReturnType<typeof setInterval> | null = null;

  const clearAnimation = () => {
    if (activeInterval) {
      clearInterval(activeInterval);
      activeInterval = null;
    }
    progressIntervalRef.current = null;
  };

  const animateProgress = (from: number, to: number, durationMs: number) => {
    clearAnimation();

    let current = from;
    const step = (to - from) / (durationMs / 50);

    activeInterval = setInterval(() => {
      progressIntervalRef.current = activeInterval;
      current = Math.min(current + step, to);
      commitAnalysisProgress(progressUiStateRef.current.stage, current);

      if (current >= to) {
        clearAnimation();
      }
    }, 50);
  };

  return {
    animateProgress,
    clearAnimation,
  };
}
