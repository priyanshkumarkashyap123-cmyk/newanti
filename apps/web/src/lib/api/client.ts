/**
 * ============================================================================
 * INDUSTRY-STANDARD API CLIENT
 * ============================================================================
 * 
 * Enterprise-grade HTTP client with:
 * - Automatic retry with exponential backoff
 * - Request/response caching
 * - Request deduplication
 * - Timeout handling
 * - Error normalization
 * - Request interceptors
 * - Response interceptors
 * - Abort controller support
 * 
 * @version 1.0.0
 */

import { API_CONFIG } from '../../config/env';

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ============================================================================
// TYPES
// ============================================================================

export interface ApiClientConfig {
  baseUrl: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
  cache?: boolean;
  cacheTTL?: number;
}

export interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
  timeout?: number;
  retries?: number;
  cache?: boolean;
  signal?: AbortSignal;
  skipAuth?: boolean;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Headers;
  cached: boolean;
}

export interface ApiError {
  message: string;
  status: number;
  code: string;
  details?: unknown;
  timestamp: string;
  requestId?: string;
}

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly timestamp: string;
  public readonly requestId?: string;

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'ApiClientError';
    this.status = error.status;
    this.code = error.code;
    this.details = error.details;
    this.timestamp = error.timestamp;
    this.requestId = error.requestId;
  }

  get isNetworkError(): boolean {
    return this.code === 'NETWORK_ERROR';
  }

  get isTimeout(): boolean {
    return this.code === 'TIMEOUT';
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }
}

// ============================================================================
// CACHE IMPLEMENTATION
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class ResponseCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxSize = 100;

  set<T>(key: string, data: T, ttl: number): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  invalidate(pattern?: string | RegExp): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    for (const key of this.cache.keys()) {
      if (typeof pattern === 'string' ? key.includes(pattern) : pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}

// ============================================================================
// REQUEST DEDUPLICATION
// ============================================================================

class RequestDeduplicator {
  private pending = new Map<string, Promise<unknown>>();

  async dedupe<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = factory().finally(() => {
      this.pending.delete(key);
    });

    this.pending.set(key, promise);
    return promise;
  }
}

// ============================================================================
// INTERCEPTORS
// ============================================================================

type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
type ResponseInterceptor<T = unknown> = (response: ApiResponse<T>) => ApiResponse<T> | Promise<ApiResponse<T>>;
type ErrorInterceptor = (error: ApiClientError) => ApiClientError | Promise<ApiClientError>;

// ============================================================================
// API CLIENT
// ============================================================================

export class ApiClient {
  private config: Required<ApiClientConfig>;
  private cache: ResponseCache;
  private deduplicator: RequestDeduplicator;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private errorInterceptors: ErrorInterceptor[] = [];

  constructor(config: ApiClientConfig) {
    this.config = {
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      headers: {},
      cache: true,
      cacheTTL: 60000, // 1 minute default
      ...config,
    };
    this.cache = new ResponseCache();
    this.deduplicator = new RequestDeduplicator();
  }

  // ============================================
  // INTERCEPTORS
  // ============================================

  onRequest(interceptor: RequestInterceptor): () => void {
    this.requestInterceptors.push(interceptor);
    return () => {
      const index = this.requestInterceptors.indexOf(interceptor);
      if (index > -1) this.requestInterceptors.splice(index, 1);
    };
  }

  onResponse<T>(interceptor: ResponseInterceptor<T>): () => void {
    this.responseInterceptors.push(interceptor as ResponseInterceptor);
    return () => {
      const index = this.responseInterceptors.indexOf(interceptor as ResponseInterceptor);
      if (index > -1) this.responseInterceptors.splice(index, 1);
    };
  }

  onError(interceptor: ErrorInterceptor): () => void {
    this.errorInterceptors.push(interceptor);
    return () => {
      const index = this.errorInterceptors.indexOf(interceptor);
      if (index > -1) this.errorInterceptors.splice(index, 1);
    };
  }

  // ============================================
  // HTTP METHODS
  // ============================================

  async get<T>(endpoint: string, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  async post<T>(endpoint: string, body?: unknown, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'POST', body });
  }

  async put<T>(endpoint: string, body?: unknown, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'PUT', body });
  }

  async patch<T>(endpoint: string, body?: unknown, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'PATCH', body });
  }

  async delete<T>(endpoint: string, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }

  // ============================================
  // CORE REQUEST METHOD
  // ============================================

  private async request<T>(endpoint: string, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    // Apply request interceptors
    let finalConfig = config;
    for (const interceptor of this.requestInterceptors) {
      finalConfig = await interceptor(finalConfig);
    }

    const method = finalConfig.method || 'GET';
    const cacheEnabled = finalConfig.cache ?? (this.config.cache && method === 'GET');
    const cacheKey = this.getCacheKey(endpoint, finalConfig);

    // Check cache for GET requests
    if (cacheEnabled && method === 'GET') {
      const cached = this.cache.get<T>(cacheKey);
      if (cached !== null) {
        return {
          data: cached,
          status: 200,
          headers: new Headers(),
          cached: true,
        };
      }
    }

    // Deduplicate identical concurrent requests
    if (method === 'GET') {
      return this.deduplicator.dedupe(cacheKey, () => this.executeRequest<T>(endpoint, finalConfig, cacheKey));
    }

    return this.executeRequest<T>(endpoint, finalConfig, cacheKey);
  }

  private async executeRequest<T>(
    endpoint: string,
    config: RequestConfig,
    cacheKey: string
  ): Promise<ApiResponse<T>> {
    const url = this.buildUrl(endpoint, config.params);
    const timeout = config.timeout ?? this.config.timeout;
    const maxRetries = config.retries ?? this.config.retries;

    let lastError: ApiClientError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.fetchWithTimeout<T>(url, config, timeout);

        // Apply response interceptors
        let finalResponse = response;
        for (const interceptor of this.responseInterceptors) {
          finalResponse = await interceptor(finalResponse) as ApiResponse<T>;
        }

        // Cache successful GET responses
        if (config.method === 'GET' && config.cache !== false) {
          this.cache.set(cacheKey, finalResponse.data, this.config.cacheTTL);
        }

        return finalResponse;
      } catch (error) {
        lastError = error instanceof ApiClientError
          ? error
          : this.normalizeError(error);

        // Apply error interceptors
        for (const interceptor of this.errorInterceptors) {
          lastError = await interceptor(lastError);
        }

        // Don't retry on client errors (4xx) except rate limiting
        if (lastError.status >= 400 && lastError.status < 500 && lastError.status !== 429) {
          throw lastError;
        }

        // Exponential backoff
        if (attempt < maxRetries) {
          const delay = this.config.retryDelay * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError!;
  }

  private async fetchWithTimeout<T>(
    url: string,
    config: RequestConfig,
    timeout: number
  ): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const requestId = createRequestId();

    // Merge signals
    const signal = config.signal
      ? this.mergeAbortSignals(config.signal, controller.signal)
      : controller.signal;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
        ...this.config.headers,
        ...config.headers,
      };

      const response = await fetch(url, {
        method: config.method || 'GET',
        headers,
        body: config.body ? JSON.stringify(config.body) : undefined,
        credentials: 'include',
        signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiClientError({
          message: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
          code: errorData.code || `HTTP_${response.status}`,
          details: errorData.details,
          timestamp: new Date().toISOString(),
          requestId: response.headers.get('x-request-id') || requestId,
        });
      }

      const data = await response.json() as T;
      return {
        data,
        status: response.status,
        headers: response.headers,
        cached: false,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ApiClientError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiClientError({
          message: 'Request timeout',
          status: 408,
          code: 'TIMEOUT',
          timestamp: new Date().toISOString(),
          requestId,
        });
      }

      throw this.normalizeError(error);
    }
  }

  // ============================================
  // UTILITIES
  // ============================================

  private buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
    const base = endpoint.startsWith('http') ? endpoint : `${this.config.baseUrl}${endpoint}`;

    if (!params) return base;

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });

    const queryString = searchParams.toString();
    return queryString ? `${base}?${queryString}` : base;
  }

  private getCacheKey(endpoint: string, config: RequestConfig): string {
    const params = config.params ? JSON.stringify(config.params) : '';
    return `${config.method || 'GET'}:${endpoint}:${params}`;
  }

  private normalizeError(error: unknown): ApiClientError {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      return new ApiClientError({
        message: 'Network error - please check your connection',
        status: 0,
        code: 'NETWORK_ERROR',
        timestamp: new Date().toISOString(),
      });
    }

    return new ApiClientError({
      message: error instanceof Error ? error.message : 'Unknown error',
      status: 500,
      code: 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString(),
    });
  }

  private mergeAbortSignals(signal1: AbortSignal, signal2: AbortSignal): AbortSignal {
    const controller = new AbortController();

    const abort = () => controller.abort();
    signal1.addEventListener('abort', abort);
    signal2.addEventListener('abort', abort);

    return controller.signal;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================
  // CACHE MANAGEMENT
  // ============================================

  invalidateCache(pattern?: string | RegExp): void {
    this.cache.invalidate(pattern);
  }
}

// ============================================================================
// DEFAULT CLIENT INSTANCE
// ============================================================================

const API_BASE_URL = API_CONFIG.baseUrl;

export const apiClient = new ApiClient({
  baseUrl: API_BASE_URL,
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
  cache: true,
  cacheTTL: 60000,
});

// Add auth token interceptor
apiClient.onRequest((config) => {
  if (config.skipAuth) return config;

  const token = localStorage.getItem('beamlab-auth');
  if (token) {
    try {
      const authData = JSON.parse(token);
      if (authData?.state?.tokens?.accessToken) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${authData.state.tokens.accessToken}`,
        };
      }
    } catch {
      // Invalid token format
    }
  }
  return config;
});

// Add error logging interceptor
apiClient.onError((error) => {
  if (error.isServerError) {
    console.error('[API] Server error:', error.message, error.details);
  }
  return error;
});

export default apiClient;
