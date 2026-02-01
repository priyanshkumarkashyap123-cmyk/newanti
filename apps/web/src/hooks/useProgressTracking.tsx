/**
 * ============================================================================
 * PROGRESS TRACKING SYSTEM
 * ============================================================================
 * 
 * Industry-standard progress tracking for long operations:
 * - Multi-step progress
 * - ETA calculation
 * - Progress persistence
 * - Cancelable operations
 * - Background task tracking
 * - Progress notifications
 * - Integration with Server-Sent Events (SSE)
 * 
 * @version 1.0.0
 */

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  createContext,
  useContext,
  ReactNode,
} from 'react';
import { logger } from '@/lib/logging/logger';
import { announce } from '@/utils/accessibility';

// ============================================================================
// TYPES
// ============================================================================

export interface ProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'skipped';
  progress?: number; // 0-100
  message?: string;
  error?: Error;
  startedAt?: number;
  completedAt?: number;
  estimatedDuration?: number;
}

export interface ProgressState {
  id: string;
  title: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  steps: ProgressStep[];
  currentStepIndex: number;
  overallProgress: number; // 0-100
  startedAt?: number;
  completedAt?: number;
  estimatedTimeRemaining?: number;
  canCancel: boolean;
  canPause: boolean;
  metadata?: Record<string, unknown>;
}

export interface ProgressOptions {
  title: string;
  steps: Array<{ id: string; label: string; estimatedDuration?: number }>;
  canCancel?: boolean;
  canPause?: boolean;
  onProgress?: (state: ProgressState) => void;
  onComplete?: (state: ProgressState) => void;
  onError?: (error: Error, state: ProgressState) => void;
  onCancel?: (state: ProgressState) => void;
  announceProgress?: boolean;
  persistKey?: string;
}

export interface UseProgressReturn {
  state: ProgressState;
  
  // Step management
  startStep: (stepId: string, message?: string) => void;
  updateStep: (stepId: string, progress: number, message?: string) => void;
  completeStep: (stepId: string, message?: string) => void;
  failStep: (stepId: string, error: Error) => void;
  skipStep: (stepId: string) => void;
  
  // Overall control
  start: () => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  reset: () => void;
  complete: () => void;
  fail: (error: Error) => void;
  
  // Helpers
  isRunning: boolean;
  isComplete: boolean;
  isFailed: boolean;
  currentStep: ProgressStep | null;
  getStepById: (stepId: string) => ProgressStep | undefined;
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useProgress(options: ProgressOptions): UseProgressReturn {
  const {
    title,
    steps: initialSteps,
    canCancel = true,
    canPause = false,
    onProgress,
    onComplete,
    onError,
    onCancel,
    announceProgress = true,
    persistKey,
  } = options;

  // Initialize state
  const [state, setState] = useState<ProgressState>(() => {
    // Try to restore from persistence
    if (persistKey && typeof window !== 'undefined') {
      const saved = localStorage.getItem(`progress:${persistKey}`);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          // Ignore parse errors
        }
      }
    }

    return {
      id: `progress-${Date.now()}`,
      title,
      status: 'idle',
      steps: initialSteps.map((step) => ({
        ...step,
        status: 'pending' as const,
      })),
      currentStepIndex: -1,
      overallProgress: 0,
      canCancel,
      canPause,
    };
  });

  // Refs
  const startTimeRef = useRef<number | null>(null);
  const stepStartTimeRef = useRef<number | null>(null);

  // Persist state
  useEffect(() => {
    if (persistKey && typeof window !== 'undefined') {
      localStorage.setItem(`progress:${persistKey}`, JSON.stringify(state));
    }
  }, [state, persistKey]);

  // Notify on progress
  useEffect(() => {
    onProgress?.(state);
  }, [state, onProgress]);

  // Calculate ETA
  const calculateETA = useCallback((currentState: ProgressState): number | undefined => {
    if (!startTimeRef.current || currentState.overallProgress === 0) return undefined;
    
    const elapsed = Date.now() - startTimeRef.current;
    const remaining = (elapsed / currentState.overallProgress) * (100 - currentState.overallProgress);
    
    return Math.round(remaining / 1000); // seconds
  }, []);

  // Update overall progress based on steps
  const updateOverallProgress = useCallback((steps: ProgressStep[]): number => {
    const totalSteps = steps.length;
    if (totalSteps === 0) return 0;

    let completedWeight = 0;
    steps.forEach((step, index) => {
      if (step.status === 'completed' || step.status === 'skipped') {
        completedWeight += 1;
      } else if (step.status === 'in-progress') {
        completedWeight += (step.progress || 0) / 100;
      }
    });

    return Math.round((completedWeight / totalSteps) * 100);
  }, []);

  // Start overall progress
  const start = useCallback(() => {
    startTimeRef.current = Date.now();
    
    setState((prev) => ({
      ...prev,
      status: 'running',
      startedAt: Date.now(),
      currentStepIndex: 0,
    }));

    if (announceProgress) {
      announce(`Starting: ${title}`, 'polite');
    }

    logger.info('Progress started', { title });
  }, [title, announceProgress]);

  // Start a specific step
  const startStep = useCallback((stepId: string, message?: string) => {
    stepStartTimeRef.current = Date.now();

    setState((prev) => {
      const stepIndex = prev.steps.findIndex((s) => s.id === stepId);
      if (stepIndex === -1) return prev;

      const newSteps = prev.steps.map((step, i) => {
        if (i === stepIndex) {
          return {
            ...step,
            status: 'in-progress' as const,
            progress: 0,
            message,
            startedAt: Date.now(),
          };
        }
        return step;
      });

      const overallProgress = updateOverallProgress(newSteps);

      return {
        ...prev,
        steps: newSteps,
        currentStepIndex: stepIndex,
        overallProgress,
        estimatedTimeRemaining: calculateETA({
          ...prev,
          steps: newSteps,
          overallProgress,
        }),
      };
    });

    if (announceProgress) {
      const step = state.steps.find((s) => s.id === stepId);
      if (step) {
        announce(`Step: ${step.label}`, 'polite');
      }
    }
  }, [state.steps, updateOverallProgress, calculateETA, announceProgress]);

  // Update step progress
  const updateStep = useCallback((stepId: string, progress: number, message?: string) => {
    setState((prev) => {
      const stepIndex = prev.steps.findIndex((s) => s.id === stepId);
      if (stepIndex === -1) return prev;

      const newSteps = prev.steps.map((step, i) => {
        if (i === stepIndex) {
          return {
            ...step,
            progress: Math.min(100, Math.max(0, progress)),
            message: message || step.message,
          };
        }
        return step;
      });

      const overallProgress = updateOverallProgress(newSteps);

      return {
        ...prev,
        steps: newSteps,
        overallProgress,
        estimatedTimeRemaining: calculateETA({
          ...prev,
          steps: newSteps,
          overallProgress,
        }),
      };
    });
  }, [updateOverallProgress, calculateETA]);

  // Complete a step
  const completeStep = useCallback((stepId: string, message?: string) => {
    setState((prev) => {
      const stepIndex = prev.steps.findIndex((s) => s.id === stepId);
      if (stepIndex === -1) return prev;

      const newSteps = prev.steps.map((step, i) => {
        if (i === stepIndex) {
          return {
            ...step,
            status: 'completed' as const,
            progress: 100,
            message,
            completedAt: Date.now(),
          };
        }
        return step;
      });

      const overallProgress = updateOverallProgress(newSteps);
      const nextStepIndex = stepIndex + 1 < newSteps.length ? stepIndex + 1 : stepIndex;

      return {
        ...prev,
        steps: newSteps,
        currentStepIndex: nextStepIndex,
        overallProgress,
        estimatedTimeRemaining: calculateETA({
          ...prev,
          steps: newSteps,
          overallProgress,
        }),
      };
    });

    logger.debug('Step completed', { stepId });
  }, [updateOverallProgress, calculateETA]);

  // Fail a step
  const failStep = useCallback((stepId: string, error: Error) => {
    setState((prev) => {
      const stepIndex = prev.steps.findIndex((s) => s.id === stepId);
      if (stepIndex === -1) return prev;

      const newSteps = prev.steps.map((step, i) => {
        if (i === stepIndex) {
          return {
            ...step,
            status: 'failed' as const,
            error,
            message: error.message,
          };
        }
        return step;
      });

      const newState: ProgressState = {
        ...prev,
        status: 'failed',
        steps: newSteps,
        completedAt: Date.now(),
      };

      onError?.(error, newState);
      return newState;
    });

    if (announceProgress) {
      announce(`Step failed: ${error.message}`, 'assertive');
    }

    logger.error('Step failed', { stepId, error });
  }, [onError, announceProgress]);

  // Skip a step
  const skipStep = useCallback((stepId: string) => {
    setState((prev) => {
      const stepIndex = prev.steps.findIndex((s) => s.id === stepId);
      if (stepIndex === -1) return prev;

      const newSteps = prev.steps.map((step, i) => {
        if (i === stepIndex) {
          return {
            ...step,
            status: 'skipped' as const,
          };
        }
        return step;
      });

      const overallProgress = updateOverallProgress(newSteps);

      return {
        ...prev,
        steps: newSteps,
        overallProgress,
      };
    });
  }, [updateOverallProgress]);

  // Pause
  const pause = useCallback(() => {
    setState((prev) => ({
      ...prev,
      status: 'paused',
    }));

    if (announceProgress) {
      announce('Progress paused', 'polite');
    }
  }, [announceProgress]);

  // Resume
  const resume = useCallback(() => {
    setState((prev) => ({
      ...prev,
      status: 'running',
    }));

    if (announceProgress) {
      announce('Progress resumed', 'polite');
    }
  }, [announceProgress]);

  // Cancel
  const cancel = useCallback(() => {
    setState((prev) => {
      const newState: ProgressState = {
        ...prev,
        status: 'cancelled',
        completedAt: Date.now(),
      };

      onCancel?.(newState);
      return newState;
    });

    if (announceProgress) {
      announce('Progress cancelled', 'polite');
    }

    // Clear persistence
    if (persistKey) {
      localStorage.removeItem(`progress:${persistKey}`);
    }

    logger.info('Progress cancelled', { title });
  }, [title, onCancel, announceProgress, persistKey]);

  // Complete overall
  const complete = useCallback(() => {
    setState((prev) => {
      const newState: ProgressState = {
        ...prev,
        status: 'completed',
        overallProgress: 100,
        completedAt: Date.now(),
      };

      onComplete?.(newState);
      return newState;
    });

    if (announceProgress) {
      announce(`Completed: ${title}`, 'polite');
    }

    // Clear persistence
    if (persistKey) {
      localStorage.removeItem(`progress:${persistKey}`);
    }

    logger.info('Progress completed', { title });
  }, [title, onComplete, announceProgress, persistKey]);

  // Fail overall
  const fail = useCallback((error: Error) => {
    setState((prev) => {
      const newState: ProgressState = {
        ...prev,
        status: 'failed',
        completedAt: Date.now(),
      };

      onError?.(error, newState);
      return newState;
    });

    if (announceProgress) {
      announce(`Failed: ${error.message}`, 'assertive');
    }

    logger.error('Progress failed', { title, error });
  }, [title, onError, announceProgress]);

  // Reset
  const reset = useCallback(() => {
    startTimeRef.current = null;
    stepStartTimeRef.current = null;

    setState({
      id: `progress-${Date.now()}`,
      title,
      status: 'idle',
      steps: initialSteps.map((step) => ({
        ...step,
        status: 'pending' as const,
      })),
      currentStepIndex: -1,
      overallProgress: 0,
      canCancel,
      canPause,
    });

    // Clear persistence
    if (persistKey) {
      localStorage.removeItem(`progress:${persistKey}`);
    }
  }, [title, initialSteps, canCancel, canPause, persistKey]);

  // Helpers
  const getStepById = useCallback(
    (stepId: string) => state.steps.find((s) => s.id === stepId),
    [state.steps]
  );

  const currentStep = state.currentStepIndex >= 0 
    ? state.steps[state.currentStepIndex] 
    : null;

  return {
    state,
    startStep,
    updateStep,
    completeStep,
    failStep,
    skipStep,
    start,
    pause,
    resume,
    cancel,
    reset,
    complete,
    fail,
    isRunning: state.status === 'running',
    isComplete: state.status === 'completed',
    isFailed: state.status === 'failed',
    currentStep,
    getStepById,
  };
}

// ============================================================================
// PROGRESS CONTEXT (for global progress tracking)
// ============================================================================

interface ProgressContextValue {
  activeProgress: Map<string, ProgressState>;
  registerProgress: (state: ProgressState) => void;
  unregisterProgress: (id: string) => void;
  getProgress: (id: string) => ProgressState | undefined;
  hasActiveProgress: boolean;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [activeProgress, setActiveProgress] = useState<Map<string, ProgressState>>(new Map());

  const registerProgress = useCallback((state: ProgressState) => {
    setActiveProgress((prev) => new Map(prev).set(state.id, state));
  }, []);

  const unregisterProgress = useCallback((id: string) => {
    setActiveProgress((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const getProgress = useCallback(
    (id: string) => activeProgress.get(id),
    [activeProgress]
  );

  const value: ProgressContextValue = {
    activeProgress,
    registerProgress,
    unregisterProgress,
    getProgress,
    hasActiveProgress: activeProgress.size > 0,
  };

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgressContext(): ProgressContextValue {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error('useProgressContext must be used within ProgressProvider');
  }
  return context;
}

// ============================================================================
// SSE PROGRESS HOOK
// ============================================================================

export interface UseSSEProgressOptions {
  url: string;
  operationId?: string;
  onProgress?: (progress: number, message?: string) => void;
  onComplete?: (result: unknown) => void;
  onError?: (error: Error) => void;
  autoConnect?: boolean;
}

export interface UseSSEProgressReturn {
  progress: number;
  message: string | null;
  isConnected: boolean;
  isComplete: boolean;
  error: Error | null;
  result: unknown;
  connect: () => void;
  disconnect: () => void;
}

export function useSSEProgress(options: UseSSEProgressOptions): UseSSEProgressReturn {
  const {
    url,
    operationId,
    onProgress,
    onComplete,
    onError,
    autoConnect = true,
  } = options;

  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<unknown>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const fullUrl = operationId ? `${url}?operationId=${operationId}` : url;
    const eventSource = new EventSource(fullUrl);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
      logger.debug('SSE connected', { url: fullUrl });
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.progress !== undefined) {
          setProgress(data.progress);
          setMessage(data.message || null);
          onProgress?.(data.progress, data.message);
        }

        if (data.complete) {
          setIsComplete(true);
          setResult(data.result);
          onComplete?.(data.result);
          eventSource.close();
          setIsConnected(false);
        }

        if (data.error) {
          const err = new Error(data.error);
          setError(err);
          onError?.(err);
          eventSource.close();
          setIsConnected(false);
        }
      } catch (e) {
        logger.warn('Failed to parse SSE message', { data: event.data });
      }
    };

    eventSource.onerror = () => {
      const err = new Error('SSE connection error');
      setError(err);
      setIsConnected(false);
      onError?.(err);
    };
  }, [url, operationId, onProgress, onComplete, onError]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    progress,
    message,
    isConnected,
    isComplete,
    error,
    result,
    connect,
    disconnect,
  };
}

// ============================================================================
// UTILITY: Format time remaining
// ============================================================================

export function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes < 60) {
    return remainingSeconds > 0 
      ? `${minutes}m ${remainingSeconds}s` 
      : `${minutes}m`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  return remainingMinutes > 0 
    ? `${hours}h ${remainingMinutes}m` 
    : `${hours}h`;
}

export default {
  useProgress,
  ProgressProvider,
  useProgressContext,
  useSSEProgress,
  formatTimeRemaining,
};
