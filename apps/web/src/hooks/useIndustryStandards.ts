/**
 * ============================================================================
 * CUSTOM REACT HOOKS
 * ============================================================================
 * 
 * Industry-standard hooks for common patterns:
 * - Data fetching with SWR-like features
 * - Debounce and throttle
 * - Local storage sync
 * - Media queries
 * - Keyboard shortcuts
 * - Intersection observer
 * 
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { apiClient, ApiClientError, type ApiResponse } from '@/lib/api/client';
import { logger } from '@/lib/logging/logger';

// ============================================================================
// DATA FETCHING HOOK
// ============================================================================

export interface UseQueryOptions<T> {
  enabled?: boolean;
  refetchOnWindowFocus?: boolean;
  refetchInterval?: number;
  staleTime?: number;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export interface UseQueryResult<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isRefetching: boolean;
  refetch: () => Promise<void>;
  invalidate: () => void;
}

export function useQuery<T>(
  key: string | string[],
  fetcher: () => Promise<ApiResponse<T>>,
  options: UseQueryOptions<T> = {}
): UseQueryResult<T> {
  const {
    enabled = true,
    refetchOnWindowFocus = true,
    refetchInterval,
    staleTime = 0,
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const lastFetchTime = useRef<number>(0);

  const queryKey = useMemo(() => 
    Array.isArray(key) ? key.join(':') : key,
    [key]
  );

  const fetchData = useCallback(async (isRefetch = false) => {
    if (!enabled) return;

    // Check stale time
    if (isRefetch && staleTime > 0 && Date.now() - lastFetchTime.current < staleTime) {
      return;
    }

    if (isRefetch) {
      setIsRefetching(true);
    } else {
      setIsLoading(true);
    }

    try {
      const response = await fetcher();
      setData(response.data);
      setError(null);
      lastFetchTime.current = Date.now();
      onSuccess?.(response.data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      onError?.(error);
      logger.error(`Query failed: ${queryKey}`, err);
    } finally {
      setIsLoading(false);
      setIsRefetching(false);
    }
  }, [enabled, fetcher, queryKey, staleTime, onSuccess, onError]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refetch on window focus
  useEffect(() => {
    if (!refetchOnWindowFocus) return;

    const handleFocus = () => fetchData(true);
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchOnWindowFocus, fetchData]);

  // Polling
  useEffect(() => {
    if (!refetchInterval) return;

    const interval = setInterval(() => fetchData(true), refetchInterval);
    return () => clearInterval(interval);
  }, [refetchInterval, fetchData]);

  const invalidate = useCallback(() => {
    lastFetchTime.current = 0;
    fetchData(true);
  }, [fetchData]);

  return {
    data,
    error,
    isLoading,
    isRefetching,
    refetch: () => fetchData(true),
    invalidate,
  };
}

// ============================================================================
// MUTATION HOOK
// ============================================================================

export interface UseMutationOptions<TData, TVariables> {
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: Error, variables: TVariables) => void;
  onSettled?: (data: TData | null, error: Error | null, variables: TVariables) => void;
}

export interface UseMutationResult<TData, TVariables> {
  mutate: (variables: TVariables) => Promise<TData>;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  data: TData | null;
  error: Error | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  reset: () => void;
}

export function useMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: UseMutationOptions<TData, TVariables> = {}
): UseMutationResult<TData, TVariables> {
  const [data, setData] = useState<TData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const mutateAsync = useCallback(async (variables: TVariables): Promise<TData> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await mutationFn(variables);
      setData(result);
      options.onSuccess?.(result, variables);
      options.onSettled?.(result, null, variables);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      options.onError?.(error, variables);
      options.onSettled?.(null, error, variables);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [mutationFn, options]);

  const mutate = useCallback((variables: TVariables) => {
    mutateAsync(variables).catch(() => {});
    return Promise.resolve(data as TData);
  }, [mutateAsync, data]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    mutate,
    mutateAsync,
    data,
    error,
    isLoading,
    isSuccess: data !== null && error === null,
    isError: error !== null,
    reset,
  };
}

// ============================================================================
// DEBOUNCE HOOK
// ============================================================================

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      queueMicrotask(() => setDebouncedValue(value));
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => callback(...args), delay);
  }, [callback, delay]) as T;
}

// ============================================================================
// THROTTLE HOOK
// ============================================================================

export function useThrottledCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  limit: number
): T {
  const lastRan = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    
    if (now - lastRan.current >= limit) {
      callback(...args);
      lastRan.current = now;
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args);
        lastRan.current = Date.now();
      }, limit - (now - lastRan.current));
    }
  }, [callback, limit]) as T;
}

// ============================================================================
// LOCAL STORAGE HOOK
// ============================================================================

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue(prev => {
      const newValue = value instanceof Function ? value(prev) : value;
      try {
        localStorage.setItem(key, JSON.stringify(newValue));
      } catch (error) {
        logger.error(`Failed to save to localStorage: ${key}`, error);
      }
      return newValue;
    });
  }, [key]);

  const removeValue = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      logger.error(`Failed to remove from localStorage: ${key}`, error);
    }
  }, [key, initialValue]);

  // Sync across tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        try {
          setStoredValue(JSON.parse(e.newValue));
        } catch {
          // Ignore parse errors
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [storedValue, setValue, removeValue];
}

// ============================================================================
// MEDIA QUERY HOOK
// ============================================================================

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    queueMicrotask(() => {
      setMatches(mediaQuery.matches);
    });

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

// Common media query hooks
export const useIsMobile = () => useMediaQuery('(max-width: 640px)');
export const useIsTablet = () => useMediaQuery('(min-width: 641px) and (max-width: 1024px)');
export const useIsDesktop = () => useMediaQuery('(min-width: 1025px)');
export const usePrefersDarkMode = () => useMediaQuery('(prefers-color-scheme: dark)');
export const usePrefersReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');

// ============================================================================
// KEYBOARD SHORTCUT HOOK
// ============================================================================

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  handler: (e: KeyboardEvent) => void;
  description?: string;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;

        if (keyMatch && (shortcut.ctrl ? ctrlMatch : true) && shiftMatch && altMatch) {
          e.preventDefault();
          shortcut.handler(e);
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

// ============================================================================
// INTERSECTION OBSERVER HOOK
// ============================================================================

export interface UseIntersectionOptions {
  threshold?: number | number[];
  root?: Element | null;
  rootMargin?: string;
  freezeOnceVisible?: boolean;
}

export function useIntersection(
  ref: React.RefObject<Element>,
  options: UseIntersectionOptions = {}
): boolean {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const frozenRef = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (frozenRef.current) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
      
      if (entry.isIntersecting && options.freezeOnceVisible) {
        frozenRef.current = true;
        observer.disconnect();
      }
    }, {
      threshold: options.threshold,
      root: options.root,
      rootMargin: options.rootMargin,
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, options.threshold, options.root, options.rootMargin, options.freezeOnceVisible]);

  return isIntersecting;
}

// ============================================================================
// CLICK OUTSIDE HOOK
// ============================================================================

export function useClickOutside<T extends HTMLElement>(
  ref: React.RefObject<T>,
  handler: (event: MouseEvent | TouchEvent) => void
): void {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

// ============================================================================
// PREVIOUS VALUE HOOK
// ============================================================================

export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  const [previous, setPrevious] = useState<T | undefined>(undefined);
  
  useEffect(() => {
    setPrevious(ref.current);
    ref.current = value;
  }, [value]);
  
  return previous;
}

// ============================================================================
// TOGGLE HOOK
// ============================================================================

export function useToggle(initialValue = false): [boolean, () => void, (value: boolean) => void] {
  const [value, setValue] = useState(initialValue);
  const toggle = useCallback(() => setValue(v => !v), []);
  return [value, toggle, setValue];
}

// ============================================================================
// COPY TO CLIPBOARD HOOK
// ============================================================================

export function useCopyToClipboard(): [boolean, (text: string) => Promise<boolean>] {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return true;
    } catch {
      setCopied(false);
      return false;
    }
  }, []);

  return [copied, copy];
}

export default {
  useQuery,
  useMutation,
  useDebounce,
  useDebouncedCallback,
  useThrottledCallback,
  useLocalStorage,
  useMediaQuery,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  usePrefersDarkMode,
  usePrefersReducedMotion,
  useKeyboardShortcuts,
  useIntersection,
  useClickOutside,
  usePrevious,
  useToggle,
  useCopyToClipboard,
};
