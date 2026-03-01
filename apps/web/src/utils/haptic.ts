/**
 * haptic.ts — Haptic feedback utility per Figma §18.4
 *
 * Provides structured haptic feedback for mobile touch interactions.
 * Maps directly to Figma touch-gesture specs:
 *   - Single tap → select   → light (10ms)
 *   - Long press → context  → medium (20ms)
 *   - Destructive action     → heavy (30ms)
 *   - Snap / drag events     → throttled feedback
 *
 * Safely no-ops on devices that don't support `navigator.vibrate()`.
 * Includes throttling to prevent rapid-fire vibrations during drag.
 */

// ---------------------------------------------------------------------------
// Capability detection (cached once)
// ---------------------------------------------------------------------------

const supportsVibration =
  typeof navigator !== 'undefined' &&
  typeof navigator.vibrate === 'function';

/** Returns `true` if the device/browser supports the Vibration API. */
export function isHapticSupported(): boolean {
  return supportsVibration;
}

// ---------------------------------------------------------------------------
// Throttle — prevent overlapping bursts during drag / scroll
// ---------------------------------------------------------------------------

let lastFire = 0;
const MIN_INTERVAL_MS = 60; // ≈ 16 fps cap on vibrations

function throttledVibrate(pattern: number | number[]): void {
  if (!supportsVibration) return;
  const now = performance.now();
  if (now - lastFire < MIN_INTERVAL_MS) return;
  lastFire = now;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* Vibration API threw — likely revoked permission or backgrounded tab */
  }
}

function vibrate(pattern: number | number[]): void {
  if (!supportsVibration) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* silently ignore */
  }
}

// ---------------------------------------------------------------------------
// Core intensity levels — Figma §18.4
// ---------------------------------------------------------------------------

export const haptic = {
  // ── Primitive intensities ──────────────────────────────────────────────

  /** Light tap — element selection, toggle, minor state change (10ms). */
  light: () => vibrate(10),

  /** Medium impact — drag start/end, long-press, snap to position (20ms). */
  medium: () => vibrate(20),

  /** Heavy impact — destructive action confirmation, analysis error (30ms). */
  heavy: () => vibrate(30),

  /** Double-pulse — e.g. double-tap zoom, undo/redo (10–gap–10). */
  double: () => vibrate([10, 50, 10]),

  // ── Semantic patterns (engineering-specific) ───────────────────────────

  /** Element selected in viewport — maps to "Single Tap → light tap". */
  select: () => vibrate(10),

  /** Context menu / action sheet opened — maps to "Long Press 500ms → medium". */
  contextMenu: () => vibrate(20),

  /** Snap event during bottom-sheet or slider drag — throttled light pulse. */
  snap: () => throttledVibrate(10),

  /** Drag started — medium feedback, once per gesture. */
  dragStart: () => vibrate(20),

  /** Drag ended / dropped — light confirmation. */
  dragEnd: () => vibrate(10),

  /** Analysis started — short ascending buzz. */
  analysisStart: () => vibrate([10, 30, 20]),

  /** Analysis completed successfully — satisfying double-pulse. */
  analysisComplete: () => vibrate([15, 60, 15, 60, 30]),

  /** Error / validation failed — sharp triple-pulse. */
  error: () => vibrate([30, 40, 30, 40, 30]),

  /** Warning — two medium pulses. */
  warning: () => vibrate([20, 80, 20]),

  /** Success confirmation (save, export, etc.) — crisp single pulse. */
  success: () => vibrate(15),

  /** Undo / redo — maps to three-finger/two-finger tap gestures. */
  undo: () => vibrate([10, 50, 10]),

  // ── Continuous feedback (for drag operations) ──────────────────────────

  /** Tick during continuous drag — throttled to prevent buzzing. */
  tick: () => throttledVibrate(8),

  /** Cancel any ongoing vibration pattern immediately. */
  cancel: () => {
    if (!supportsVibration) return;
    try {
      navigator.vibrate(0);
    } catch {
      /* ignore */
    }
  },
} as const;
