/**
 * Unit tests for useProjectAutoSave hook
 * Requirements: 2.3, 2.5
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProjectAutoSave } from '../useProjectAutoSave';

const PROJECT_ID = 'test-project-123';
const STORAGE_KEY = `beamlab:unsaved:${PROJECT_ID}`;
const SAMPLE_STATE = { nodes: [{ id: 1, x: 0, y: 0 }], members: [] };

describe('useProjectAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('1. On save failure → state written to localStorage under correct key', () => {
    it('writes state to localStorage when onSave throws', async () => {
      const onSave = vi.fn().mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useProjectAutoSave({
          projectId: PROJECT_ID,
          state: SAMPLE_STATE,
          onSave,
          intervalMs: 60000,
        })
      );

      await act(async () => {
        await result.current.flushNow();
      });

      // Verify the entry was written to localStorage under the correct key
      const stored = localStorage.getItem(STORAGE_KEY);
      expect(stored).toBe(JSON.stringify(SAMPLE_STATE));
    });

    it('sets hasPendingChanges to true after save failure', async () => {
      const onSave = vi.fn().mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useProjectAutoSave({
          projectId: PROJECT_ID,
          state: SAMPLE_STATE,
          onSave,
        })
      );

      await act(async () => {
        await result.current.flushNow();
      });

      expect(result.current.hasPendingChanges).toBe(true);
    });
  });

  describe('2. On save success after retry → localStorage entry cleared', () => {
    it('removes localStorage entry when retry succeeds', async () => {
      // Pre-populate localStorage to simulate a previous failure
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SAMPLE_STATE));

      const onSave = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useProjectAutoSave({
          projectId: PROJECT_ID,
          state: SAMPLE_STATE,
          onSave,
        })
      );

      await act(async () => {
        await result.current.flushNow();
      });

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('sets hasPendingChanges to false after successful save', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SAMPLE_STATE));

      const onSave = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useProjectAutoSave({
          projectId: PROJECT_ID,
          state: SAMPLE_STATE,
          onSave,
        })
      );

      await act(async () => {
        await result.current.flushNow();
      });

      expect(result.current.hasPendingChanges).toBe(false);
    });

    it('updates lastSavedAt after successful save', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useProjectAutoSave({
          projectId: PROJECT_ID,
          state: SAMPLE_STATE,
          onSave,
        })
      );

      expect(result.current.lastSavedAt).toBeNull();

      await act(async () => {
        await result.current.flushNow();
      });

      expect(result.current.lastSavedAt).toBeInstanceOf(Date);
    });
  });

  describe('3. hasPendingChanges is true when localStorage has unsaved entry', () => {
    it('initializes hasPendingChanges as true when localStorage has entry', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SAMPLE_STATE));

      const onSave = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useProjectAutoSave({
          projectId: PROJECT_ID,
          state: SAMPLE_STATE,
          onSave,
        })
      );

      expect(result.current.hasPendingChanges).toBe(true);
    });
  });

  describe('4. hasPendingChanges is false when localStorage is empty', () => {
    it('initializes hasPendingChanges as false when localStorage is empty', () => {
      const onSave = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useProjectAutoSave({
          projectId: PROJECT_ID,
          state: SAMPLE_STATE,
          onSave,
        })
      );

      expect(result.current.hasPendingChanges).toBe(false);
    });
  });

  describe('5. flushNow triggers immediate save attempt', () => {
    it('calls onSave immediately when flushNow is invoked', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useProjectAutoSave({
          projectId: PROJECT_ID,
          state: SAMPLE_STATE,
          onSave,
        })
      );

      // onSave should not have been called yet (no interval elapsed)
      expect(onSave).not.toHaveBeenCalled();

      await act(async () => {
        await result.current.flushNow();
      });

      expect(onSave).toHaveBeenCalledOnce();
      expect(onSave).toHaveBeenCalledWith(PROJECT_ID, SAMPLE_STATE);
    });

    it('sets isSaving to true during save and false after', async () => {
      let resolveSave!: () => void;
      const onSave = vi.fn().mockImplementation(
        () => new Promise<void>((resolve) => { resolveSave = resolve; })
      );

      const { result } = renderHook(() =>
        useProjectAutoSave({
          projectId: PROJECT_ID,
          state: SAMPLE_STATE,
          onSave,
        })
      );

      let flushPromise: Promise<void>;
      act(() => {
        flushPromise = result.current.flushNow();
      });

      // isSaving should be true while the promise is pending
      expect(result.current.isSaving).toBe(true);

      await act(async () => {
        resolveSave();
        await flushPromise!;
      });

      expect(result.current.isSaving).toBe(false);
    });
  });

  describe('Auto-save interval', () => {
    it('triggers save after intervalMs elapses', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);

      renderHook(() =>
        useProjectAutoSave({
          projectId: PROJECT_ID,
          state: SAMPLE_STATE,
          onSave,
          intervalMs: 5000,
        })
      );

      expect(onSave).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(5000);
        // Allow microtasks to flush
        await Promise.resolve();
      });

      expect(onSave).toHaveBeenCalledOnce();
    });

    it('does not trigger save when enabled is false', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);

      renderHook(() =>
        useProjectAutoSave({
          projectId: PROJECT_ID,
          state: SAMPLE_STATE,
          onSave,
          intervalMs: 5000,
          enabled: false,
        })
      );

      await act(async () => {
        vi.advanceTimersByTime(10000);
        await Promise.resolve();
      });

      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe('Exponential backoff retry', () => {
    it('retries with exponential backoff after failure', async () => {
      const onSave = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useProjectAutoSave({
          projectId: PROJECT_ID,
          state: SAMPLE_STATE,
          onSave,
        })
      );

      // First attempt (flushNow) — fails, schedules retry at 1000ms
      await act(async () => {
        await result.current.flushNow();
      });
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(result.current.hasPendingChanges).toBe(true);

      // Advance 1000ms — first retry fires, fails, schedules retry at 2000ms
      await act(async () => {
        vi.advanceTimersByTime(1000);
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(onSave).toHaveBeenCalledTimes(2);

      // Advance 2000ms — second retry fires, succeeds
      await act(async () => {
        vi.advanceTimersByTime(2000);
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(onSave).toHaveBeenCalledTimes(3);
      expect(result.current.hasPendingChanges).toBe(false);
    });
  });
});
