/**
 * ============================================================================
 * ASYNC OPERATION HOOK
 * ============================================================================
 * 
 * Industry-standard hook for handling async operations with:
 * - Loading states
 * - Error handling with retry
 * - Success/error callbacks
 * - Abort handling
 * - Optimistic updates
 * - Progress tracking
 * 
 * Addresses: "80% of async operations have no loading state"
 * 
 * @version 1.0.0
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '@/lib/logging/logger';
import { announce } from '@/utils/accessibility';

// ============================================================================
// TYPES
// ============================================================================

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T, E = Error> {
  data: T | null;
  error: E | null;
  status: AsyncStatus;
  isIdle: boolean;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  progress: number; // 0-100
}

export interface AsyncOperationOptions<T, E = Error> {
  /** Called on successful completion */
  onSuccess?: (data: T) => void;
  /** Called on error */
  onError?: (error: E) => void;
  /** Called when operation starts */
  onStart?: () => void;
  /** Called when operation completes (success or error) */
  onSettled?: (data: T | null, error: E | null) => void;
  /** Number of retry attempts on failure */
  retryCount?: number;
  /** Delay between retries in ms */
  retryDelay?: number;
  /** Enable optimistic update */
  optimisticData?: T;
  /** Announce status changes to screen readers */
  announceStatus?: boolean;
  /** Custom messages for screen reader announcements */
  announceMessages?: {
    loading?: string;
    success?: string;
    error?: string;
  };
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

export interface UseAsyncOperationReturn<T, E = Error> extends AsyncState<T, E> {
  /** Execute the async operation */
  execute: (...args: unknown[]) => Promise<T | null>;
  /** Reset to initial state */
  reset: () => void;
  /** Manually set data */
  setData: (data: T) => void;
  /** Manually set error */
  setError: (error: E) => void;
  /** Update progress (0-100) */
  setProgress: (progress: number) => void;
  /** Abort the current operation */
  abort: () => void;
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useAsyncOperation<T, E = Error>(
  asyncFn: (...args: unknown[]) => Promise<T>,
  options: AsyncOperationOptions<T, E> = {}
): UseAsyncOperationReturn<T, E> {
  const {
    onSuccess,
    onError,
    onStart,
    onSettled,
    retryCount = 0,
    retryDelay = 1000,
    optimisticData,
    announceStatus = true,
    announceMessages = {},
    signal: externalSignal,
  } = options;

  // State
  const [state, setState] = useState<AsyncState<T, E>>({
    data: null,
    error: null,
    status: 'idle',
    isIdle: true,
    isLoading: false,
    isSuccess: false,
    isError: false,
    progress: 0,
  });

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const retriesRef = useRef(0);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  // Update state helper with derived booleans
  const updateState = useCallback((updates: Partial<AsyncState<T, E>>) => {
    if (!isMountedRef.current) return;

    setState((prev) => {
      const newStatus = updates.status ?? prev.status;
      return {
        ...prev,
        ...updates,
        isIdle: newStatus === 'idle',
        isLoading: newStatus === 'loading',
        isSuccess: newStatus === 'success',
        isError: newStatus === 'error',
      };
    });
  }, []);

  // Abort function
  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    updateState({ status: 'idle', progress: 0 });
  }, [updateState]);

  // Execute async operation
  const execute = useCallback(
    async (...args: unknown[]): Promise<T | null> => {
      // Abort previous request
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      // Create combined signal
      const signal = externalSignal
        ? (AbortSignal as typeof AbortSignal & { any: (signals: AbortSignal[]) => AbortSignal }).any?.([
            externalSignal,
            abortControllerRef.current.signal,
          ]) || abortControllerRef.current.signal
        : abortControllerRef.current.signal;

      // Set loading state
      updateState({
        status: 'loading',
        error: null,
        progress: 0,
        data: optimisticData ?? state.data,
      });

      onStart?.();

      if (announceStatus) {
        announce(announceMessages.loading || 'Loading...', 'polite');
      }

      const attemptExecution = async (attempt: number): Promise<T> => {
        try {
          // Check if aborted
          if (signal.aborted) {
            throw new DOMException('Aborted', 'AbortError');
          }

          const result = await asyncFn(...args);

          // Check again after async operation
          if (signal.aborted) {
            throw new DOMException('Aborted', 'AbortError');
          }

          return result;
        } catch (error) {
          // Don't retry on abort
          if (error instanceof DOMException && error.name === 'AbortError') {
            throw error;
          }

          // Retry logic
          if (attempt < retryCount) {
            logger.warn(`Async operation failed, retrying (${attempt + 1}/${retryCount})`, { error });
            await new Promise((resolve) => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
            return attemptExecution(attempt + 1);
          }

          throw error;
        }
      };

      try {
        retriesRef.current = 0;
        const result = await attemptExecution(0);

        updateState({
          data: result,
          error: null,
          status: 'success',
          progress: 100,
        });

        if (announceStatus) {
          announce(announceMessages.success || 'Operation completed', 'polite');
        }

        onSuccess?.(result);
        onSettled?.(result, null);

        logger.debug('Async operation succeeded');
        return result;
      } catch (error) {
        // Ignore abort errors
        if (error instanceof DOMException && error.name === 'AbortError') {
          logger.debug('Async operation aborted');
          return null;
        }

        const typedError = error as E;

        updateState({
          data: null,
          error: typedError,
          status: 'error',
          progress: 0,
        });

        if (announceStatus) {
          const errorMessage = error instanceof Error ? error.message : 'An error occurred';
          announce(announceMessages.error || `Error: ${errorMessage}`, 'assertive');
        }

        onError?.(typedError);
        onSettled?.(null, typedError);

        logger.error('Async operation failed', { error });
        return null;
      }
    },
    [
      asyncFn,
      externalSignal,
      optimisticData,
      state.data,
      retryCount,
      retryDelay,
      announceStatus,
      announceMessages,
      onStart,
      onSuccess,
      onError,
      onSettled,
      updateState,
    ]
  );

  // Reset to initial state
  const reset = useCallback(() => {
    abort();
    updateState({
      data: null,
      error: null,
      status: 'idle',
      progress: 0,
    });
  }, [abort, updateState]);

  // Manual setters
  const setData = useCallback(
    (data: T) => updateState({ data, status: 'success' }),
    [updateState]
  );

  const setError = useCallback(
    (error: E) => updateState({ error, status: 'error' }),
    [updateState]
  );

  const setProgress = useCallback(
    (progress: number) => updateState({ progress: Math.min(100, Math.max(0, progress)) }),
    [updateState]
  );

  return {
    ...state,
    execute,
    reset,
    setData,
    setError,
    setProgress,
    abort,
  };
}

// ============================================================================
// MUTATION HOOK (for create/update/delete operations)
// ============================================================================

export interface UseMutationOptions<TData, TVariables, TError = Error> {
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: TError, variables: TVariables) => void;
  onSettled?: (data: TData | null, error: TError | null, variables: TVariables) => void;
  onMutate?: (variables: TVariables) => Promise<unknown> | unknown;
  retryCount?: number;
  retryDelay?: number;
}

export interface MutationState<TData, TError = Error> {
  data: TData | null;
  error: TError | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
}

export interface UseMutationReturn<TData, TVariables, TError = Error>
  extends MutationState<TData, TError> {
  mutate: (variables: TVariables) => void;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  reset: () => void;
}

export function useMutation<TData, TVariables, TError = Error>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: UseMutationOptions<TData, TVariables, TError> = {}
): UseMutationReturn<TData, TVariables, TError> {
  const { onSuccess, onError, onSettled, onMutate, retryCount = 0, retryDelay = 1000 } = options;

  const [state, setState] = useState<MutationState<TData, TError>>({
    data: null,
    error: null,
    isLoading: false,
    isSuccess: false,
    isError: false,
  });

  const mutateAsync = useCallback(
    async (variables: TVariables): Promise<TData> => {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        isSuccess: false,
        isError: false,
        error: null,
      }));

      // Optimistic update callback
      try {
        await onMutate?.(variables);
      } catch (e) {
        logger.warn('onMutate callback failed', { error: e });
      }

      const attemptMutation = async (attempt: number): Promise<TData> => {
        try {
          return await mutationFn(variables);
        } catch (error) {
          if (attempt < retryCount) {
            await new Promise((resolve) =>
              setTimeout(resolve, retryDelay * Math.pow(2, attempt))
            );
            return attemptMutation(attempt + 1);
          }
          throw error;
        }
      };

      try {
        const data = await attemptMutation(0);

        setState({
          data,
          error: null,
          isLoading: false,
          isSuccess: true,
          isError: false,
        });

        onSuccess?.(data, variables);
        onSettled?.(data, null, variables);

        return data;
      } catch (error) {
        const typedError = error as TError;

        setState({
          data: null,
          error: typedError,
          isLoading: false,
          isSuccess: false,
          isError: true,
        });

        onError?.(typedError, variables);
        onSettled?.(null, typedError, variables);

        throw error;
      }
    },
    [mutationFn, onSuccess, onError, onSettled, onMutate, retryCount, retryDelay]
  );

  const mutate = useCallback(
    (variables: TVariables) => {
      mutateAsync(variables).catch(() => {
        // Error is already handled in state
      });
    },
    [mutateAsync]
  );

  const reset = useCallback(() => {
    setState({
      data: null,
      error: null,
      isLoading: false,
      isSuccess: false,
      isError: false,
    });
  }, []);

  return {
    ...state,
    mutate,
    mutateAsync,
    reset,
  };
}

// ============================================================================
// PARALLEL ASYNC OPERATIONS
// ============================================================================

export interface ParallelAsyncState<T> {
  results: (T | null)[];
  errors: (Error | null)[];
  isLoading: boolean;
  isComplete: boolean;
  progress: number; // 0-100
  completedCount: number;
  totalCount: number;
}

export function useParallelAsync<T>(
  operations: (() => Promise<T>)[],
  options: { enabled?: boolean; announceProgress?: boolean } = {}
): ParallelAsyncState<T> & { refetch: () => Promise<void> } {
  const { enabled = true, announceProgress = false } = options;

  const [state, setState] = useState<ParallelAsyncState<T>>({
    results: [],
    errors: [],
    isLoading: false,
    isComplete: false,
    progress: 0,
    completedCount: 0,
    totalCount: operations.length,
  });

  const refetch = useCallback(async () => {
    if (!enabled || operations.length === 0) return;

    setState((prev) => ({
      ...prev,
      isLoading: true,
      isComplete: false,
      progress: 0,
      completedCount: 0,
      totalCount: operations.length,
    }));

    const results: (T | null)[] = new Array(operations.length).fill(null);
    const errors: (Error | null)[] = new Array(operations.length).fill(null);
    let completed = 0;

    await Promise.all(
      operations.map(async (op, index) => {
        try {
          results[index] = await op();
        } catch (error) {
          errors[index] = error instanceof Error ? error : new Error(String(error));
        } finally {
          completed++;
          const progress = Math.round((completed / operations.length) * 100);

          setState((prev) => ({
            ...prev,
            results: [...results],
            errors: [...errors],
            completedCount: completed,
            progress,
          }));

          if (announceProgress && completed % 5 === 0) {
            announce(`${progress}% complete`, 'polite');
          }
        }
      })
    );

    setState((prev) => ({
      ...prev,
      isLoading: false,
      isComplete: true,
    }));

    if (announceProgress) {
      const errorCount = errors.filter(Boolean).length;
      if (errorCount > 0) {
        announce(`Completed with ${errorCount} errors`, 'polite');
      } else {
        announce('All operations completed', 'polite');
      }
    }
  }, [operations, enabled, announceProgress]);

  useEffect(() => {
    if (enabled) {
      refetch();
    }
  }, [enabled, refetch]);

  return { ...state, refetch };
}

// ============================================================================
// DEBOUNCED ASYNC HOOK
// ============================================================================

export function useDebouncedAsync<T>(
  asyncFn: () => Promise<T>,
  debounceMs: number = 300,
  deps: unknown[] = []
): AsyncState<T> & { cancel: () => void } {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    status: 'idle',
    isIdle: true,
    isLoading: false,
    isSuccess: false,
    isError: false,
    progress: 0,
  });

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    abortControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    cancel();

    timeoutRef.current = setTimeout(async () => {
      abortControllerRef.current = new AbortController();

      setState((prev) => ({
        ...prev,
        status: 'loading',
        isIdle: false,
        isLoading: true,
        isSuccess: false,
        isError: false,
      }));

      try {
        const result = await asyncFn();

        if (!abortControllerRef.current?.signal.aborted) {
          setState({
            data: result,
            error: null,
            status: 'success',
            isIdle: false,
            isLoading: false,
            isSuccess: true,
            isError: false,
            progress: 100,
          });
        }
      } catch (error) {
        if (!abortControllerRef.current?.signal.aborted) {
          setState({
            data: null,
            error: error instanceof Error ? error : new Error(String(error)),
            status: 'error',
            isIdle: false,
            isLoading: false,
            isSuccess: false,
            isError: true,
            progress: 0,
          });
        }
      }
    }, debounceMs);

    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounceMs, ...deps]);

  return { ...state, cancel };
}

export default useAsyncOperation;
