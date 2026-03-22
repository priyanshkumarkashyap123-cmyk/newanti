/**
 * GPU Autoscale Telemetry
 *
 * Lightweight in-memory counters for autoscaling decisions.
 * These counters are intentionally process-local and cheap to update.
 */

type GpuDispatchSource = "vm" | "python";
type GpuTerminalStatus = "completed" | "failed" | "cancelled" | "timeout";

interface TimestampedCounter {
  ts: number;
  value: number;
}

interface AutoscaleCounters {
  submissionsTotal: number;
  vmDispatchTotal: number;
  pythonDispatchTotal: number;
  completedTotal: number;
  failedTotal: number;
  cancelledTotal: number;
  timeoutTotal: number;
}

const counters: AutoscaleCounters = {
  submissionsTotal: 0,
  vmDispatchTotal: 0,
  pythonDispatchTotal: 0,
  completedTotal: 0,
  failedTotal: 0,
  cancelledTotal: 0,
  timeoutTotal: 0,
};

const submitTimeline: TimestampedCounter[] = [];
const SUBMIT_WINDOW_MS = 5 * 60 * 1000;

function pruneTimeline(nowMs: number): void {
  const cutoff = nowMs - SUBMIT_WINDOW_MS;
  while (submitTimeline.length > 0 && (submitTimeline[0]?.ts ?? 0) < cutoff) {
    submitTimeline.shift();
  }
}

export function recordGpuJobSubmission(): void {
  counters.submissionsTotal += 1;
  const nowMs = Date.now();
  submitTimeline.push({ ts: nowMs, value: 1 });
  pruneTimeline(nowMs);
}

export function recordGpuJobDispatchSource(source: GpuDispatchSource): void {
  if (source === "vm") {
    counters.vmDispatchTotal += 1;
    return;
  }
  counters.pythonDispatchTotal += 1;
}

export function recordGpuJobTerminalStatus(status: GpuTerminalStatus): void {
  if (status === "completed") {
    counters.completedTotal += 1;
    return;
  }
  if (status === "cancelled") {
    counters.cancelledTotal += 1;
    return;
  }
  if (status === "timeout") {
    counters.timeoutTotal += 1;
    return;
  }
  counters.failedTotal += 1;
}

export function getGpuAutoscaleTelemetrySnapshot(): {
  counters: AutoscaleCounters;
  recentSubmissionRatePerMinute: number;
  sampleWindowSeconds: number;
  vmDispatchRatio: number;
} {
  const nowMs = Date.now();
  pruneTimeline(nowMs);

  const submissionsInWindow = submitTimeline.reduce((sum, sample) => sum + sample.value, 0);
  const windowMinutes = SUBMIT_WINDOW_MS / 60_000;
  const recentSubmissionRatePerMinute = submissionsInWindow / windowMinutes;

  const totalDispatches = counters.vmDispatchTotal + counters.pythonDispatchTotal;
  const vmDispatchRatio = totalDispatches === 0 ? 0 : counters.vmDispatchTotal / totalDispatches;

  return {
    counters: { ...counters },
    recentSubmissionRatePerMinute,
    sampleWindowSeconds: SUBMIT_WINDOW_MS / 1000,
    vmDispatchRatio,
  };
}
