/**
 * ============================================================================
 * OPTIMISTIC UPDATE UTILITIES
 * ============================================================================
 * 
 * Industry-standard optimistic update patterns for:
 * - Immediate UI feedback
 * - Rollback on failure
 * - Conflict resolution
 * - Pending state tracking
 * - Retry logic
 * - Integration with data fetching
 * 
 * @version 1.0.0
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '@/lib/logging/logger';
import { announce } from '@/utils/accessibility';

// ============================================================================
// TYPES
// ============================================================================

export interface OptimisticUpdate<T> {
  id: string;
  timestamp: number;
  previousValue: T;
  optimisticValue: T;
  status: 'pending' | 'confirmed' | 'failed' | 'rolled-back';
  error?: Error;
}

export interface OptimisticState<T> {
  value: T;
  pendingUpdates: OptimisticUpdate<T>[];
  isUpdating: boolean;
  hasPendingChanges: boolean;
  lastConfirmedValue: T;
}

export interface UseOptimisticOptions<T> {
  initialValue: T;
  onConfirm?: (update: OptimisticUpdate<T>) => void;
  onRollback?: (update: OptimisticUpdate<T>) => void;
  onError?: (error: Error, update: OptimisticUpdate<T>) => void;
  maxRetries?: number;
  retryDelay?: number;
  announceChanges?: boolean;
}

export interface UseOptimisticReturn<T> {
  // State
  value: T;
  isUpdating: boolean;
  pendingCount: number;
  hasPendingChanges: boolean;
  pendingUpdates: OptimisticUpdate<T>[];
  
  // Actions
  update: (
    newValue: T | ((prev: T) => T),
    mutationFn: () => Promise<T>
  ) => Promise<T | null>;
  rollback: (updateId?: string) => void;
  confirm: (updateId: string) => void;
  reset: () => void;
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useOptimistic<T>(
  options: UseOptimisticOptions<T>
): UseOptimisticReturn<T> {
  const {
    initialValue,
    onConfirm,
    onRollback,
    onError,
    maxRetries = 0,
    retryDelay = 1000,
    announceChanges = false,
  } = options;

  // State
  const [state, setState] = useState<OptimisticState<T>>({
    value: initialValue,
    pendingUpdates: [],
    isUpdating: false,
    hasPendingChanges: false,
    lastConfirmedValue: initialValue,
  });

  // Refs for cleanup
  const isMountedRef = useRef(true);
  const retriesRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Generate update ID
  const generateId = useCallback(() => {
    return `update-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Update value optimistically
  const update = useCallback(
    async (
      newValue: T | ((prev: T) => T),
      mutationFn: () => Promise<T>
    ): Promise<T | null> => {
      const id = generateId();
      const previousValue = state.value;
      const optimisticValue = typeof newValue === 'function'
        ? (newValue as (prev: T) => T)(previousValue)
        : newValue;

      // Create optimistic update record
      const pendingUpdate: OptimisticUpdate<T> = {
        id,
        timestamp: Date.now(),
        previousValue,
        optimisticValue,
        status: 'pending',
      };

      // Apply optimistic update immediately
      setState((prev) => ({
        ...prev,
        value: optimisticValue,
        pendingUpdates: [...prev.pendingUpdates, pendingUpdate],
        isUpdating: true,
        hasPendingChanges: true,
      }));

      if (announceChanges) {
        announce('Change applied', 'polite');
      }

      // Execute mutation
      const executeMutation = async (attempt: number): Promise<T> => {
        try {
          return await mutationFn();
        } catch (error) {
          if (attempt < maxRetries) {
            logger.warn(`Optimistic update retry ${attempt + 1}/${maxRetries}`, { id });
            await new Promise((resolve) => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
            return executeMutation(attempt + 1);
          }
          throw error;
        }
      };

      try {
        const result = await executeMutation(0);

        if (!isMountedRef.current) return null;

        // Confirm update
        setState((prev) => ({
          ...prev,
          value: result,
          pendingUpdates: prev.pendingUpdates.map((u) =>
            u.id === id ? { ...u, status: 'confirmed' as const } : u
          ),
          isUpdating: prev.pendingUpdates.filter((u) => u.id !== id && u.status === 'pending').length > 0,
          hasPendingChanges: prev.pendingUpdates.filter((u) => u.id !== id && u.status === 'pending').length > 0,
          lastConfirmedValue: result,
        }));

        onConfirm?.({ ...pendingUpdate, status: 'confirmed' });
        
        if (announceChanges) {
          announce('Change saved', 'polite');
        }

        // Clean up confirmed updates after delay
        setTimeout(() => {
          if (isMountedRef.current) {
            setState((prev) => ({
              ...prev,
              pendingUpdates: prev.pendingUpdates.filter((u) => u.id !== id),
            }));
          }
        }, 5000);

        return result;
      } catch (error) {
        if (!isMountedRef.current) return null;

        const typedError = error instanceof Error ? error : new Error(String(error));
        logger.error('Optimistic update failed', { id, error: typedError });

        // Rollback on failure
        setState((prev) => {
          // Find the update that failed
          const failedUpdate = prev.pendingUpdates.find((u) => u.id === id);
          if (!failedUpdate) return prev;

          // Calculate rollback value by applying all other pending updates
          const otherPendingUpdates = prev.pendingUpdates.filter(
            (u) => u.id !== id && u.status === 'pending'
          );
          
          const rollbackValue = otherPendingUpdates.length > 0
            ? otherPendingUpdates[otherPendingUpdates.length - 1].optimisticValue
            : prev.lastConfirmedValue;

          return {
            ...prev,
            value: rollbackValue,
            pendingUpdates: prev.pendingUpdates.map((u) =>
              u.id === id ? { ...u, status: 'failed' as const, error: typedError } : u
            ),
            isUpdating: otherPendingUpdates.length > 0,
            hasPendingChanges: otherPendingUpdates.length > 0,
          };
        });

        onError?.(typedError, pendingUpdate);
        onRollback?.({ ...pendingUpdate, status: 'rolled-back' });

        if (announceChanges) {
          announce('Change failed, reverted', 'assertive');
        }

        return null;
      }
    },
    [state.value, generateId, maxRetries, retryDelay, announceChanges, onConfirm, onError, onRollback]
  );

  // Manual rollback
  const rollback = useCallback(
    (updateId?: string) => {
      setState((prev) => {
        if (updateId) {
          const update = prev.pendingUpdates.find((u) => u.id === updateId);
          if (!update) return prev;

          const otherPendingUpdates = prev.pendingUpdates.filter(
            (u) => u.id !== updateId && u.status === 'pending'
          );
          
          const rollbackValue = otherPendingUpdates.length > 0
            ? otherPendingUpdates[otherPendingUpdates.length - 1].optimisticValue
            : prev.lastConfirmedValue;

          onRollback?.({ ...update, status: 'rolled-back' });

          return {
            ...prev,
            value: rollbackValue,
            pendingUpdates: prev.pendingUpdates.map((u) =>
              u.id === updateId ? { ...u, status: 'rolled-back' as const } : u
            ),
          };
        } else {
          // Rollback all pending updates
          prev.pendingUpdates
            .filter((u) => u.status === 'pending')
            .forEach((u) => onRollback?.({ ...u, status: 'rolled-back' }));

          return {
            ...prev,
            value: prev.lastConfirmedValue,
            pendingUpdates: prev.pendingUpdates.map((u) =>
              u.status === 'pending' ? { ...u, status: 'rolled-back' as const } : u
            ),
            isUpdating: false,
            hasPendingChanges: false,
          };
        }
      });
    },
    [onRollback]
  );

  // Manual confirm
  const confirm = useCallback(
    (updateId: string) => {
      setState((prev) => {
        const update = prev.pendingUpdates.find((u) => u.id === updateId);
        if (!update) return prev;

        return {
          ...prev,
          pendingUpdates: prev.pendingUpdates.map((u) =>
            u.id === updateId ? { ...u, status: 'confirmed' as const } : u
          ),
          lastConfirmedValue: update.optimisticValue,
        };
      });
    },
    []
  );

  // Reset to initial
  const reset = useCallback(() => {
    setState({
      value: initialValue,
      pendingUpdates: [],
      isUpdating: false,
      hasPendingChanges: false,
      lastConfirmedValue: initialValue,
    });
    retriesRef.current.clear();
  }, [initialValue]);

  return {
    value: state.value,
    isUpdating: state.isUpdating,
    pendingCount: state.pendingUpdates.filter((u) => u.status === 'pending').length,
    hasPendingChanges: state.hasPendingChanges,
    pendingUpdates: state.pendingUpdates,
    update,
    rollback,
    confirm,
    reset,
  };
}

// ============================================================================
// OPTIMISTIC LIST OPERATIONS
// ============================================================================

export interface ListItem {
  id: string;
  [key: string]: unknown;
}

export interface UseOptimisticListOptions<T extends ListItem> {
  initialItems: T[];
  onItemAdded?: (item: T) => void;
  onItemUpdated?: (item: T) => void;
  onItemRemoved?: (id: string) => void;
  onError?: (error: Error, operation: string) => void;
}

export interface UseOptimisticListReturn<T extends ListItem> {
  items: T[];
  isUpdating: boolean;
  
  addItem: (item: T, mutationFn: () => Promise<T>) => Promise<T | null>;
  updateItem: (id: string, updates: Partial<T>, mutationFn: () => Promise<T>) => Promise<T | null>;
  removeItem: (id: string, mutationFn: () => Promise<void>) => Promise<boolean>;
  reorderItems: (fromIndex: number, toIndex: number, mutationFn: () => Promise<T[]>) => Promise<T[] | null>;
  reset: () => void;
}

export function useOptimisticList<T extends ListItem>(
  options: UseOptimisticListOptions<T>
): UseOptimisticListReturn<T> {
  const { initialItems, onItemAdded, onItemUpdated, onItemRemoved, onError } = options;

  const [items, setItems] = useState<T[]>(initialItems);
  const [isUpdating, setIsUpdating] = useState(false);
  const previousItemsRef = useRef<T[]>(initialItems);

  // Add item optimistically
  const addItem = useCallback(
    async (item: T, mutationFn: () => Promise<T>): Promise<T | null> => {
      const previousItems = [...items];
      previousItemsRef.current = previousItems;

      // Optimistically add item
      setItems((prev) => [...prev, item]);
      setIsUpdating(true);

      try {
        const result = await mutationFn();
        
        // Update with server response (may have different ID)
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? result : i))
        );
        
        onItemAdded?.(result);
        return result;
      } catch (error) {
        // Rollback
        setItems(previousItems);
        onError?.(error instanceof Error ? error : new Error(String(error)), 'add');
        return null;
      } finally {
        setIsUpdating(false);
      }
    },
    [items, onItemAdded, onError]
  );

  // Update item optimistically
  const updateItem = useCallback(
    async (id: string, updates: Partial<T>, mutationFn: () => Promise<T>): Promise<T | null> => {
      const previousItems = [...items];
      previousItemsRef.current = previousItems;

      // Optimistically update item
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, ...updates } : item
        )
      );
      setIsUpdating(true);

      try {
        const result = await mutationFn();
        
        setItems((prev) =>
          prev.map((item) => (item.id === id ? result : item))
        );
        
        onItemUpdated?.(result);
        return result;
      } catch (error) {
        // Rollback
        setItems(previousItems);
        onError?.(error instanceof Error ? error : new Error(String(error)), 'update');
        return null;
      } finally {
        setIsUpdating(false);
      }
    },
    [items, onItemUpdated, onError]
  );

  // Remove item optimistically
  const removeItem = useCallback(
    async (id: string, mutationFn: () => Promise<void>): Promise<boolean> => {
      const previousItems = [...items];
      previousItemsRef.current = previousItems;

      // Optimistically remove item
      setItems((prev) => prev.filter((item) => item.id !== id));
      setIsUpdating(true);

      try {
        await mutationFn();
        onItemRemoved?.(id);
        return true;
      } catch (error) {
        // Rollback
        setItems(previousItems);
        onError?.(error instanceof Error ? error : new Error(String(error)), 'remove');
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [items, onItemRemoved, onError]
  );

  // Reorder items optimistically
  const reorderItems = useCallback(
    async (
      fromIndex: number,
      toIndex: number,
      mutationFn: () => Promise<T[]>
    ): Promise<T[] | null> => {
      const previousItems = [...items];
      previousItemsRef.current = previousItems;

      // Optimistically reorder
      const newItems = [...items];
      const [removed] = newItems.splice(fromIndex, 1);
      newItems.splice(toIndex, 0, removed);
      setItems(newItems);
      setIsUpdating(true);

      try {
        const result = await mutationFn();
        setItems(result);
        return result;
      } catch (error) {
        // Rollback
        setItems(previousItems);
        onError?.(error instanceof Error ? error : new Error(String(error)), 'reorder');
        return null;
      } finally {
        setIsUpdating(false);
      }
    },
    [items, onError]
  );

  // Reset to initial
  const reset = useCallback(() => {
    setItems(initialItems);
    setIsUpdating(false);
  }, [initialItems]);

  return {
    items,
    isUpdating,
    addItem,
    updateItem,
    removeItem,
    reorderItems,
    reset,
  };
}

// ============================================================================
// CONFLICT RESOLUTION
// ============================================================================

export type ConflictResolutionStrategy = 'client-wins' | 'server-wins' | 'merge' | 'custom';

export interface ConflictResolutionOptions<T> {
  strategy: ConflictResolutionStrategy;
  customResolver?: (clientValue: T, serverValue: T, baseValue: T) => T;
  onConflict?: (conflict: { client: T; server: T; resolved: T }) => void;
}

export function resolveConflict<T extends Record<string, unknown>>(
  clientValue: T,
  serverValue: T,
  baseValue: T,
  options: ConflictResolutionOptions<T>
): T {
  const { strategy, customResolver, onConflict } = options;

  let resolved: T;

  switch (strategy) {
    case 'client-wins':
      resolved = clientValue;
      break;

    case 'server-wins':
      resolved = serverValue;
      break;

    case 'merge':
      // Simple merge: client changes override server, but keep server-only fields
      resolved = { ...serverValue, ...clientValue };
      break;

    case 'custom':
      if (!customResolver) {
        throw new Error('Custom resolver required for custom strategy');
      }
      resolved = customResolver(clientValue, serverValue, baseValue);
      break;

    default:
      resolved = serverValue;
  }

  onConflict?.({ client: clientValue, server: serverValue, resolved });
  return resolved;
}

// ============================================================================
// BATCH OPTIMISTIC UPDATES
// ============================================================================

export interface BatchUpdate<T> {
  id: string;
  operation: 'add' | 'update' | 'remove';
  payload: T | Partial<T> | string;
  mutationFn: () => Promise<unknown>;
}

export function useBatchOptimistic<T extends ListItem>() {
  const [queue, setQueue] = useState<BatchUpdate<T>[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const addToQueue = useCallback((update: Omit<BatchUpdate<T>, 'id'>) => {
    const id = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setQueue((prev) => [...prev, { ...update, id }]);
  }, []);

  const processBatch = useCallback(async () => {
    if (queue.length === 0 || isProcessing) return;

    setIsProcessing(true);
    const results: { id: string; success: boolean; error?: Error }[] = [];

    for (const update of queue) {
      try {
        await update.mutationFn();
        results.push({ id: update.id, success: true });
      } catch (error) {
        results.push({
          id: update.id,
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    setQueue([]);
    setIsProcessing(false);

    return results;
  }, [queue, isProcessing]);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  return {
    queue,
    queueLength: queue.length,
    isProcessing,
    addToQueue,
    processBatch,
    clearQueue,
  };
}

export default {
  useOptimistic,
  useOptimisticList,
  useBatchOptimistic,
  resolveConflict,
};
