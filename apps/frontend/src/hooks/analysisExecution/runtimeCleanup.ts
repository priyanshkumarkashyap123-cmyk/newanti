import type { MutableRefObject } from "react";

export function clearProgressInterval(
  intervalRef: MutableRefObject<ReturnType<typeof setInterval> | null>,
): void {
  if (!intervalRef.current) {
    return;
  }

  clearInterval(intervalRef.current);
  intervalRef.current = null;
}

export function abortAndClear(
  abortRef: MutableRefObject<AbortController | null>,
): void {
  if (!abortRef.current) {
    return;
  }

  abortRef.current.abort();
  abortRef.current = null;
}
