/**
 * API Hooks and Utilities
 * 
 * Comprehensive API layer including:
 * - Type-safe fetch wrapper
 * - React Query-like hooks for data fetching
 * - Automatic retries
 * - Error handling integration
 * - Request caching
 * - Optimistic updates support
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  apiClient as canonicalApiClient,
  ApiClientError,
  type RequestConfig as CanonicalRequestConfig,
} from './api/client';

// ============================================================================
// TYPES
// ============================================================================

export interface RequestConfig<T = unknown> extends Omit<CanonicalRequestConfig, 'method' | 'body'> {
  baseUrl?: string;
  transformResponse?: (data: unknown) => T;
}

export interface ApiResponse<T> {
  data: T | null;
  error: Error | null;
  status: number | null;
}

export interface UseApiState<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  status: 'idle' | 'loading' | 'success' | 'error';
}

export interface UseApiOptions<T> {
  enabled?: boolean;
  refetchInterval?: number;
  refetchOnFocus?: boolean;
  staleTime?: number;
  cacheTime?: number;
  retry?: number;
  retryDelay?: number;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  initialData?: T;
  keepPreviousData?: boolean;
}

export interface MutationState<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
}

// ============================================================================
// API CLIENT ADAPTER (delegates to canonical client)
// ============================================================================

function resolveUrl(endpoint: string, baseUrl?: string): string {
  if (!baseUrl || endpoint.startsWith('http')) return endpoint;

  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${normalizedBase}${normalizedEndpoint}`;
}

function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (error instanceof ApiClientError) return error;
  return new Error(String(error));
}

function applyTransform<T>(data: T, transform?: (data: unknown) => T): T {
  if (!transform) return data;
  return transform(data);
}

function toCanonicalConfig<T>(config?: RequestConfig<T>): Omit<CanonicalRequestConfig, 'method' | 'body'> {
  if (!config) return {};

  const { baseUrl: _baseUrl, transformResponse: _transformResponse, ...rest } = config;
  return rest;
}

class ApiClientAdapter {
  async get<T>(endpoint: string, config?: RequestConfig<T>): Promise<ApiResponse<T>> {
    try {
      const url = resolveUrl(endpoint, config?.baseUrl);
      const response = await canonicalApiClient.get<T>(url, toCanonicalConfig(config));

      return {
        data: applyTransform(response.data, config?.transformResponse),
        error: null,
        status: response.status,
      };
    } catch (error) {
      return { data: null, error: toError(error), status: null };
    }
  }

  async post<T>(endpoint: string, data?: unknown, config?: RequestConfig<T>): Promise<ApiResponse<T>> {
    try {
      const url = resolveUrl(endpoint, config?.baseUrl);
      const response = await canonicalApiClient.post<T>(url, data, toCanonicalConfig(config));

      return {
        data: applyTransform(response.data, config?.transformResponse),
        error: null,
        status: response.status,
      };
    } catch (error) {
      return { data: null, error: toError(error), status: null };
    }
  }

  async put<T>(endpoint: string, data?: unknown, config?: RequestConfig<T>): Promise<ApiResponse<T>> {
    try {
      const url = resolveUrl(endpoint, config?.baseUrl);
      const response = await canonicalApiClient.put<T>(url, data, toCanonicalConfig(config));

      return {
        data: applyTransform(response.data, config?.transformResponse),
        error: null,
        status: response.status,
      };
    } catch (error) {
      return { data: null, error: toError(error), status: null };
    }
  }

  async patch<T>(endpoint: string, data?: unknown, config?: RequestConfig<T>): Promise<ApiResponse<T>> {
    try {
      const url = resolveUrl(endpoint, config?.baseUrl);
      const response = await canonicalApiClient.patch<T>(url, data, toCanonicalConfig(config));

      return {
        data: applyTransform(response.data, config?.transformResponse),
        error: null,
        status: response.status,
      };
    } catch (error) {
      return { data: null, error: toError(error), status: null };
    }
  }

  async delete<T>(endpoint: string, config?: RequestConfig<T>): Promise<ApiResponse<T>> {
    try {
      const url = resolveUrl(endpoint, config?.baseUrl);
      const response = await canonicalApiClient.delete<T>(url, toCanonicalConfig(config));

      return {
        data: applyTransform(response.data, config?.transformResponse),
        error: null,
        status: response.status,
      };
    } catch (error) {
      return { data: null, error: toError(error), status: null };
    }
  }
}

export const apiClient = new ApiClientAdapter();

// ============================================================================
// CACHE
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  staleTime: number;
}

class QueryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private subscribers = new Map<string, Set<() => void>>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const isStale = Date.now() - entry.timestamp > entry.staleTime;
    if (isStale) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  set<T>(key: string, data: T, staleTime: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      staleTime,
    });
    this.notifySubscribers(key);
  }

  invalidate(key: string): void {
    this.cache.delete(key);
    this.notifySubscribers(key);
  }

  invalidateAll(): void {
    this.cache.clear();
    this.subscribers.forEach((_, key) => this.notifySubscribers(key));
  }

  subscribe(key: string, callback: () => void): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);
    
    return () => {
      this.subscribers.get(key)?.delete(callback);
    };
  }

  private notifySubscribers(key: string): void {
    this.subscribers.get(key)?.forEach((callback) => callback());
  }
}

export const queryCache = new QueryCache();

// ============================================================================
// USE QUERY HOOK
// ============================================================================

export function useQuery<T>(
  key: string | string[],
  fetcher: () => Promise<ApiResponse<T>>,
  options: UseApiOptions<T> = {}
): UseApiState<T> & {
  refetch: () => Promise<void>;
  invalidate: () => void;
} {
  const {
    enabled = true,
    refetchInterval,
    refetchOnFocus = false,
    staleTime = 5 * 60 * 1000,
    retry = 0,
    retryDelay = 1000,
    onSuccess,
    onError,
    initialData,
    keepPreviousData = false,
  } = options;

  const cacheKey = Array.isArray(key) ? key.join(':') : key;
  const retryCountRef = useRef(0);

  const [state, setState] = useState<UseApiState<T>>(() => {
    const cached = queryCache.get<T>(cacheKey);
    return {
      data: cached ?? initialData ?? null,
      error: null,
      isLoading: enabled && !cached,
      isError: false,
      isSuccess: !!cached,
      status: cached ? 'success' : 'idle',
    };
  });

  const fetchData = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      data: keepPreviousData ? prev.data : null,
      isLoading: true,
      status: 'loading',
    }));

    const { data, error } = await fetcher();

    if (error) {
      retryCountRef.current++;
      
      if (retryCountRef.current <= retry) {
        setTimeout(() => fetchData(), retryDelay * retryCountRef.current);
        return;
      }

      setState({
        data: keepPreviousData ? state.data : null,
        error,
        isLoading: false,
        isError: true,
        isSuccess: false,
        status: 'error',
      });
      onError?.(error);
    } else {
      retryCountRef.current = 0;
      queryCache.set(cacheKey, data, staleTime);
      setState({
        data,
        error: null,
        isLoading: false,
        isError: false,
        isSuccess: true,
        status: 'success',
      });
      onSuccess?.(data!);
    }
  }, [fetcher, cacheKey, retry, retryDelay, staleTime, onSuccess, onError, keepPreviousData]);

  const refetch = useCallback(async () => {
    retryCountRef.current = 0;
    await fetchData();
  }, [fetchData]);

  const invalidate = useCallback(() => {
    queryCache.invalidate(cacheKey);
  }, [cacheKey]);

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      fetchData();
    }
  }, [enabled, cacheKey]);

  // Refetch interval
  useEffect(() => {
    if (!refetchInterval || !enabled) return;

    const interval = setInterval(fetchData, refetchInterval);
    return () => clearInterval(interval);
  }, [refetchInterval, enabled, fetchData]);

  // Refetch on focus
  useEffect(() => {
    if (!refetchOnFocus || !enabled) return;

    const handleFocus = () => {
      fetchData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchOnFocus, enabled, fetchData]);

  // Subscribe to cache updates
  useEffect(() => {
    return queryCache.subscribe(cacheKey, () => {
      const cached = queryCache.get<T>(cacheKey);
      if (cached) {
        setState((prev) => ({ ...prev, data: cached }));
      }
    });
  }, [cacheKey]);

  return { ...state, refetch, invalidate };
}

// ============================================================================
// USE MUTATION HOOK
// ============================================================================

export function useMutation<TData, TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<ApiResponse<TData>>,
  options: {
    onSuccess?: (data: TData, variables: TVariables) => void;
    onError?: (error: Error, variables: TVariables) => void;
    onSettled?: (data: TData | null, error: Error | null, variables: TVariables) => void;
    invalidateKeys?: string[];
  } = {}
): MutationState<TData> & {
  mutate: (variables: TVariables) => Promise<void>;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  reset: () => void;
} {
  const { onSuccess, onError, onSettled, invalidateKeys } = options;

  const [state, setState] = useState<MutationState<TData>>({
    data: null,
    error: null,
    isLoading: false,
    isError: false,
    isSuccess: false,
  });

  const mutateAsync = useCallback(
    async (variables: TVariables): Promise<TData> => {
      setState({
        data: null,
        error: null,
        isLoading: true,
        isError: false,
        isSuccess: false,
      });

      try {
        const { data, error } = await mutationFn(variables);

        if (error) {
          throw error;
        }

        setState({
          data,
          error: null,
          isLoading: false,
          isError: false,
          isSuccess: true,
        });

        onSuccess?.(data!, variables);
        onSettled?.(data, null, variables);

        // Invalidate cache keys
        invalidateKeys?.forEach((key) => queryCache.invalidate(key));

        return data!;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setState({
          data: null,
          error,
          isLoading: false,
          isError: true,
          isSuccess: false,
        });

        onError?.(error, variables);
        onSettled?.(null, error, variables);

        throw error;
      }
    },
    [mutationFn, onSuccess, onError, onSettled, invalidateKeys]
  );

  const mutate = useCallback(
    async (variables: TVariables) => {
      try {
        await mutateAsync(variables);
      } catch {
        // Error is already handled in state
      }
    },
    [mutateAsync]
  );

  const reset = useCallback(() => {
    setState({
      data: null,
      error: null,
      isLoading: false,
      isError: false,
      isSuccess: false,
    });
  }, []);

  return { ...state, mutate, mutateAsync, reset };
}

// ============================================================================
// HELPER HOOKS
// ============================================================================

/**
 * Simple hook for fetching data from an API endpoint
 */
export function useApi<T>(
  endpoint: string,
  options?: UseApiOptions<T> & RequestConfig<T>
) {
  return useQuery<T>(
    endpoint,
    () => apiClient.get<T>(endpoint, options),
    options
  );
}

/**
 * Hook for creating new resources
 */
export function useCreate<T, TInput = Partial<T>>(
  endpoint: string,
  options?: {
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
    invalidateKeys?: string[];
  }
) {
  return useMutation<T, TInput>(
    (input) => apiClient.post<T>(endpoint, input),
    options
  );
}

/**
 * Hook for updating resources
 */
export function useUpdate<T, TInput = Partial<T>>(
  endpoint: string | ((id: string | number) => string),
  options?: {
    onSuccess?: (data: T, variables: { id: string | number; data: TInput }) => void;
    onError?: (error: Error) => void;
    invalidateKeys?: string[];
  }
) {
  return useMutation<T, { id: string | number; data: TInput }>(
    ({ id, data }) => {
      const url = typeof endpoint === 'function' ? endpoint(id) : `${endpoint}/${id}`;
      return apiClient.put<T>(url, data);
    },
    options
  );
}

/**
 * Hook for deleting resources
 */
export function useDelete<T = void>(
  endpoint: string | ((id: string | number) => string),
  options?: {
    onSuccess?: (data: T, id: string | number) => void;
    onError?: (error: Error) => void;
    invalidateKeys?: string[];
  }
) {
  return useMutation<T, string | number>(
    (id) => {
      const url = typeof endpoint === 'function' ? endpoint(id) : `${endpoint}/${id}`;
      return apiClient.delete<T>(url);
    },
    options
  );
}

export default apiClient;
