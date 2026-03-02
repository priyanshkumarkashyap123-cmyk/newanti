/**
 * useUnsavedChangesGuard
 *
 * Warns users before leaving the modeler with unsaved changes.
 * - Intercepts in-app navigation via react-router `useBlocker`
 * - Intercepts tab close / refresh via `beforeunload`
 *
 * Dirty detection: subscribes to structural model fields (nodes, members,
 * plates, loads) and marks dirty on change.  Cleared when the caller
 * invokes the returned `markClean` function (typically after save).
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useModelStore } from '../store/model';

/** Lightweight fingerprint – we only care whether *something* changed. */
function fingerprint(state: {
  nodes: Map<string, unknown>;
  members: Map<string, unknown>;
  plates: Map<string, unknown>;
  pointLoads: Map<string, unknown>;
  distributedLoads: Map<string, unknown>;
}): string {
  return [
    state.nodes.size,
    state.members.size,
    state.plates.size,
    state.pointLoads.size,
    state.distributedLoads.size,
    // Include first key of each map to detect replacements
    state.nodes.keys().next().value ?? '',
    state.members.keys().next().value ?? '',
  ].join('|');
}

export function useUnsavedChangesGuard() {
  const [isDirty, setIsDirty] = useState(false);
  const savedFingerprintRef = useRef<string>('');

  // Take a snapshot of current fingerprint
  const markClean = useCallback(() => {
    const state = useModelStore.getState();
    savedFingerprintRef.current = fingerprint(state as any);
    setIsDirty(false);
  }, []);

  // Set initial clean fingerprint on mount
  useEffect(() => {
    markClean();
  }, [markClean]);

  // Subscribe to model changes and compare fingerprints
  useEffect(() => {
    const unsub = useModelStore.subscribe((state) => {
      const current = fingerprint(state as any);
      if (current !== savedFingerprintRef.current) {
        setIsDirty(true);
      }
    });
    return unsub;
  }, []);

  // Block in-app navigation when dirty
  const blocker = useBlocker(isDirty);

  useEffect(() => {
    if (blocker.state === 'blocked') {
      const leave = window.confirm(
        'You have unsaved changes. Are you sure you want to leave?',
      );
      if (leave) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker]);

  // Block tab close / refresh when dirty
  useEffect(() => {
    if (!isDirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore custom messages but require returnValue
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  return { isDirty, markClean };
}
