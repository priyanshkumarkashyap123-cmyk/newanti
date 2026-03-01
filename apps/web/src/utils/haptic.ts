/**
 * haptic.ts — Haptic feedback utility per Figma §18.4
 * 
 * Provides light/medium vibration for mobile touch interactions.
 * Safely no-ops on devices that don't support navigator.vibrate().
 */

export const haptic = {
  /** Light tap feedback — 10ms vibrate */
  light: () => {
    try { navigator.vibrate?.(10); } catch { /* unsupported */ }
  },
  /** Medium feedback — 20ms vibrate (drag start/end) */
  medium: () => {
    try { navigator.vibrate?.(20); } catch { /* unsupported */ }
  },
  /** Heavy feedback — 30ms vibrate (destructive actions) */
  heavy: () => {
    try { navigator.vibrate?.(30); } catch { /* unsupported */ }
  },
  /** Double-tap pattern */
  double: () => {
    try { navigator.vibrate?.([10, 50, 10]); } catch { /* unsupported */ }
  },
};
