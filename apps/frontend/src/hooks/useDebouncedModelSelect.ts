/**
 * useDebouncedModelSelect.ts — Debounced selector for model store
 *
 * Problem: Components like StatusBar, PropertiesPanel, ResultsToolbar subscribe
 * to `nodes`, `members`, `selectedIds` which change at 60fps during drag.
 * This causes cascading re-renders across the UI.
 *
 * Solution: This hook debounces the selector output so UI components only
 * re-render at a configurable interval (default 100ms), NOT at 60fps.
 *
 * Usage:
 *   // Instead of:
 *   const nodes = useModelStore(s => s.nodes);
 *
 *   // Use:
 *   const nodes = useDebouncedModelSelect(s => s.nodes, 100);
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { useModelStore } from '../store/model';

/**
 * Subscribe to model store with debounced updates.
 * Returns the selector value, but only re-renders the component every `delayMs`.
 *
 * @param selector  – Zustand selector function (s => s.nodes, etc.)
 * @param delayMs   – Debounce interval in ms (default: 100)
 * @param equalityFn – Optional equality fn (default: Object.is)
 */
export function useDebouncedModelSelect<T>(
  selector: (state: ReturnType<typeof useModelStore.getState>) => T,
  delayMs = 100,
  equalityFn: (a: T, b: T) => boolean = Object.is,
): T {
  // Get the initial value synchronously to avoid flash
  const [value, setValue] = useState<T>(() =>
    selector(useModelStore.getState()),
  );

  const latestRef = useRef(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Subscribe to store changes
    const unsub = useModelStore.subscribe((state) => {
      const next = selector(state);

      // Skip if value hasn't actually changed
      if (equalityFn(latestRef.current, next)) return;

      latestRef.current = next;

      // Debounce the state update
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        setValue(next);
        timerRef.current = null;
      }, delayMs);
    });

    return () => {
      unsub();
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [selector, delayMs, equalityFn]);

  return value;
}

/**
 * Batch-select multiple model store fields with debouncing.
 * Avoids the "14 individual selectors" anti-pattern.
 *
 * Usage:
 *   const { nodes, members, selectedIds } = useDebouncedModelBatch(
 *     s => ({
 *       nodes: s.nodes,
 *       members: s.members,
 *       selectedIds: s.selectedIds,
 *     }),
 *     150,
 *   );
 */
export function useDebouncedModelBatch<T extends Record<string, unknown>>(
  selector: (state: ReturnType<typeof useModelStore.getState>) => T,
  delayMs = 100,
): T {
  // Shallow equality for objects: compare each key with Object.is
  const shallowEqual = useCallback((a: T, b: T) => {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!Object.is(a[key], b[key])) return false;
    }
    return true;
  }, []);

  return useDebouncedModelSelect(selector, delayMs, shallowEqual);
}

/**
 * Convenience: debounced count of model entities for status bars.
 * Only re-renders when counts ACTUALLY change, checked every 200ms.
 */
export function useModelCounts() {
  return useDebouncedModelBatch(
    (s) => ({
      nodeCount: s.nodes.size,
      memberCount: s.members.size,
      plateCount: s.plates?.size ?? 0,
      loadCount: s.loads.length,
      memberLoadCount: s.memberLoads.length,
      selectedCount: s.selectedIds.size,
    }),
    200,
  );
}
