import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseProjectAutoSaveOptions {
  projectId: string;
  state: Record<string, unknown>;
  onSave: (projectId: string, state: Record<string, unknown>) => Promise<void>;
  intervalMs?: number; // default 60000 (60s)
  enabled?: boolean;   // default true
}

export interface UseProjectAutoSaveResult {
  isSaving: boolean;
  lastSavedAt: Date | null;
  hasPendingChanges: boolean;
  flushNow: () => Promise<void>;
}

const STORAGE_KEY_PREFIX = 'beamlab:unsaved:';
const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 30000;

function getStorageKey(projectId: string): string {
  return `${STORAGE_KEY_PREFIX}${projectId}`;
}

function hasPendingLocalChanges(projectId: string): boolean {
  try {
    return localStorage.getItem(getStorageKey(projectId)) !== null;
  } catch {
    return false;
  }
}

function writeToLocalStorage(projectId: string, state: Record<string, unknown>): void {
  try {
    localStorage.setItem(getStorageKey(projectId), JSON.stringify(state));
  } catch {
    // Ignore storage errors (e.g. private browsing quota exceeded)
  }
}

function clearLocalStorage(projectId: string): void {
  try {
    localStorage.removeItem(getStorageKey(projectId));
  } catch {
    // Ignore
  }
}

export function useProjectAutoSave(options: UseProjectAutoSaveOptions): UseProjectAutoSaveResult {
  const {
    projectId,
    state,
    onSave,
    intervalMs = 60000,
    enabled = true,
  } = options;

  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hasPendingChanges, setHasPendingChanges] = useState(() =>
    hasPendingLocalChanges(projectId)
  );

  // Keep refs to latest values to avoid stale closures in intervals
  const stateRef = useRef(state);
  const onSaveRef = useRef(onSave);
  const projectIdRef = useRef(projectId);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelayRef = useRef(BACKOFF_BASE_MS);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);
  useEffect(() => { projectIdRef.current = projectId; }, [projectId]);

  // Sync hasPendingChanges when projectId changes
  useEffect(() => {
    setHasPendingChanges(hasPendingLocalChanges(projectId));
  }, [projectId]);

  const attemptSave = useCallback(async (stateToSave: Record<string, unknown>): Promise<boolean> => {
    try {
      await onSaveRef.current(projectIdRef.current, stateToSave);
      clearLocalStorage(projectIdRef.current);
      setLastSavedAt(new Date());
      setHasPendingChanges(false);
      retryDelayRef.current = BACKOFF_BASE_MS; // reset backoff on success
      return true;
    } catch {
      writeToLocalStorage(projectIdRef.current, stateToSave);
      setHasPendingChanges(true);
      return false;
    }
  }, []);

  const scheduleRetry = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }

    const delay = retryDelayRef.current;
    retryDelayRef.current = Math.min(delay * 2, BACKOFF_MAX_MS);

    retryTimeoutRef.current = setTimeout(async () => {
      const key = getStorageKey(projectIdRef.current);
      let pendingState: Record<string, unknown> | null = null;
      try {
        const raw = localStorage.getItem(key);
        if (raw) pendingState = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        // Corrupted entry — clear it
        clearLocalStorage(projectIdRef.current);
        setHasPendingChanges(false);
        return;
      }

      if (!pendingState) return;

      setIsSaving(true);
      const success = await attemptSave(pendingState);
      setIsSaving(false);

      if (!success) {
        scheduleRetry();
      }
    }, delay);
  }, [attemptSave]);

  // Auto-save interval
  useEffect(() => {
    if (!enabled) return;

    const intervalId = setInterval(async () => {
      setIsSaving(true);
      const success = await attemptSave(stateRef.current);
      setIsSaving(false);

      if (!success) {
        scheduleRetry();
      }
    }, intervalMs);

    return () => clearInterval(intervalId);
  }, [enabled, intervalMs, attemptSave, scheduleRetry]);

  // Cleanup retry timeout on unmount or projectId change
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [projectId]);

  const flushNow = useCallback(async (): Promise<void> => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    setIsSaving(true);
    const success = await attemptSave(stateRef.current);
    setIsSaving(false);

    if (!success) {
      scheduleRetry();
    }
  }, [attemptSave, scheduleRetry]);

  return { isSaving, lastSavedAt, hasPendingChanges, flushNow };
}
