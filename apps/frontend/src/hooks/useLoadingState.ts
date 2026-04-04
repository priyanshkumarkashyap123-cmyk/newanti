/**
 * ============================================================================
 * ENHANCED LOADING STATE HOOK
 * ============================================================================
 * 
 * Provides comprehensive loading state management with:
 * - Multiple concurrent operations tracking
 * - Minimum display time (prevents flashing)
 * - Automatic timeout detection
 * - Progress tracking
 * - Error state management
 * 
 * @version 1.0.0
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export interface LoadingState {
  isLoading: boolean;
  operation: string | null;
  progress?: number;
  startTime: number | null;
  error: Error | null;
}

export interface UseLoadingStateOptions {
  minDisplayTime?: number; // Minimum time to show loading (prevents flashing)
  timeout?: number;         // Auto-timeout if operation takes too long
  onTimeout?: () => void;
}

export interface LoadingStateController {
  isLoading: boolean;
  operation: string | null;
  progress: number | undefined;
  error: Error | null;
  operations: Set<string>;
  
  // Actions
  start: (operation: string) => void;
  stop: (operation: string) => void;
  setProgress: (operation: string, progress: number) => void;
  setError: (error: Error) => void;
  clearError: () => void;
  reset: () => void;
  
  // Helpers
  isOperationLoading: (operation: string) => boolean;
  getOperationCount: () => number;
  wrap: <T>(operation: string, fn: () => Promise<T>) => Promise<T>;
}

/**
 * Enhanced loading state hook with support for multiple concurrent operations
 */
export function useLoadingState(
  options: UseLoadingStateOptions = {}
): LoadingStateController {
  const { minDisplayTime = 300, timeout = 30000, onTimeout } = options;

  const [loadingOperations, setLoadingOperations] = useState<Set<string>>(new Set());
  const [currentOperation, setCurrentOperation] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);

  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const minDisplayTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      minDisplayTimersRef.current.forEach(timer => clearTimeout(timer));
    };
  }, []);

  const start = useCallback((operation: string) => {
    setLoadingOperations(prev => {
      const next = new Set(prev);
      next.add(operation);
      return next;
    });
    
    if (!currentOperation) {
      setCurrentOperation(operation);
      setStartTime(Date.now());
    }

    // Set timeout for this operation
    if (timeout > 0) {
      const timeoutId = setTimeout(() => {
        console.warn(`Operation "${operation}" timed out after ${timeout}ms`);
        onTimeout?.();
        stop(operation);
      }, timeout);
      timeoutsRef.current.set(operation, timeoutId);
    }
  }, [currentOperation, timeout, onTimeout]);

  const stop = useCallback((operation: string) => {
    const now = Date.now();
    const elapsed = startTime ? now - startTime : 0;
    const remainingMinTime = Math.max(0, minDisplayTime - elapsed);

    // Clear timeout
    const timeoutId = timeoutsRef.current.get(operation);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutsRef.current.delete(operation);
    }

    // Enforce minimum display time to prevent flashing
    if (remainingMinTime > 0) {
      const timerId = setTimeout(() => {
        setLoadingOperations(prev => {
          const next = new Set(prev);
          next.delete(operation);
          if (next.size === 0) {
            setCurrentOperation(null);
            setStartTime(null);
            setProgress(undefined);
          } else if (currentOperation === operation) {
            // Switch to next operation
            setCurrentOperation(next.values().next().value ?? null);
          }
          return next;
        });
        minDisplayTimersRef.current.delete(operation);
      }, remainingMinTime);
      
      minDisplayTimersRef.current.set(operation, timerId);
    } else {
      setLoadingOperations(prev => {
        const next = new Set(prev);
        next.delete(operation);
        if (next.size === 0) {
          setCurrentOperation(null);
          setStartTime(null);
          setProgress(undefined);
        } else if (currentOperation === operation) {
          setCurrentOperation(next.values().next().value ?? null);
        }
        return next;
      });
    }
  }, [currentOperation, minDisplayTime, startTime]);

  const setProgressForOperation = useCallback((operation: string, progressValue: number) => {
    if (loadingOperations.has(operation) && operation === currentOperation) {
      setProgress(Math.max(0, Math.min(100, progressValue)));
    }
  }, [loadingOperations, currentOperation]);

  const handleError = useCallback((err: Error) => {
    setError(err);
    // Clear all loading operations on error
    loadingOperations.forEach(op => stop(op));
  }, [loadingOperations, stop]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const reset = useCallback(() => {
    loadingOperations.forEach(op => stop(op));
    setError(null);
    setProgress(undefined);
  }, [loadingOperations, stop]);

  const isOperationLoading = useCallback((operation: string) => {
    return loadingOperations.has(operation);
  }, [loadingOperations]);

  const getOperationCount = useCallback(() => {
    return loadingOperations.size;
  }, [loadingOperations]);

  /**
   * Wrap an async function with automatic loading state management
   */
  const wrap = useCallback(async <T,>(operation: string, fn: () => Promise<T>): Promise<T> => {
    try {
      start(operation);
      clearError();
      const result = await fn();
      stop(operation);
      return result;
    } catch (err) {
      handleError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, [start, stop, clearError, handleError]);

  return {
    isLoading: loadingOperations.size > 0,
    operation: currentOperation,
    progress,
    error,
    operations: loadingOperations,
    start,
    stop,
    setProgress: setProgressForOperation,
    setError: handleError,
    clearError,
    reset,
    isOperationLoading,
    getOperationCount,
    wrap,
  };
}

/**
 * Simpler loading state hook for single operations
 */
export function useSimpleLoading(initialState = false) {
  const [isLoading, setIsLoading] = useState(initialState);
  const [error, setError] = useState<Error | null>(null);

  const wrap = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await fn();
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    setError,
    clearError: () => setError(null),
    wrap,
  };
}
