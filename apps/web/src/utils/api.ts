/**
 * @deprecated Prefer importing from '@/lib/api/client'.
 *
 * Compatibility adapter to keep legacy call sites stable while routing all
 * requests through the canonical API client.
 */

import {
  apiClient as canonicalApiClient,
  ApiClientError,
  type RequestConfig as CanonicalRequestConfig,
  type ApiResponse as CanonicalApiResponse,
} from '@/lib/api/client';
import { APIError, AuthError, NetworkError } from './errorHandling';

export interface APIResponse<T> {
  data: T;
  status: number;
  message?: string;
}

export interface APIErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  details?: unknown;
}

export interface RequestConfig extends Omit<CanonicalRequestConfig, 'method' | 'body'> {
  baseURL?: string;
  retry?: number;
}

function withAbsoluteUrl(url: string, baseURL?: string): string {
  if (!baseURL || /^https?:\/\//.test(url)) {
    return url;
  }

  const normalizedBase = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
  const normalizedPath = url.startsWith('/') ? url : `/${url}`;
  return `${normalizedBase}${normalizedPath}`;
}

function toCanonicalConfig(config?: RequestConfig): CanonicalRequestConfig | undefined {
  if (!config) return undefined;

  const { baseURL: _baseURL, retry, ...rest } = config;
  return {
    ...rest,
    retries: retry ?? rest.retries,
  };
}

function toLegacyResponse<T>(response: CanonicalApiResponse<T>): APIResponse<T> {
  return {
    data: response.data,
    status: response.status,
  };
}

function normalizeError(error: unknown): never {
  if (error instanceof ApiClientError) {
    if (error.isUnauthorized) {
      throw new AuthError(error.message);
    }

    if (error.isNetworkError || error.isTimeout) {
      throw new NetworkError(error.message);
    }

    throw new APIError(error.message, error.status, {
      code: error.code,
      details: error.details,
      requestId: error.requestId,
      timestamp: error.timestamp,
    });
  }

  throw error;
}

class APIClient {
  async get<T>(url: string, config?: RequestConfig): Promise<APIResponse<T>> {
    try {
      const absoluteUrl = withAbsoluteUrl(url, config?.baseURL);
      const response = await canonicalApiClient.get<T>(absoluteUrl, toCanonicalConfig(config));
      return toLegacyResponse(response);
    } catch (error) {
      return normalizeError(error);
    }
  }

  async post<T, D = unknown>(url: string, data?: D, config?: RequestConfig): Promise<APIResponse<T>> {
    try {
      const absoluteUrl = withAbsoluteUrl(url, config?.baseURL);
      const response = await canonicalApiClient.post<T>(absoluteUrl, data, toCanonicalConfig(config));
      return toLegacyResponse(response);
    } catch (error) {
      return normalizeError(error);
    }
  }

  async put<T, D = unknown>(url: string, data?: D, config?: RequestConfig): Promise<APIResponse<T>> {
    try {
      const absoluteUrl = withAbsoluteUrl(url, config?.baseURL);
      const response = await canonicalApiClient.put<T>(absoluteUrl, data, toCanonicalConfig(config));
      return toLegacyResponse(response);
    } catch (error) {
      return normalizeError(error);
    }
  }

  async patch<T, D = unknown>(url: string, data?: D, config?: RequestConfig): Promise<APIResponse<T>> {
    try {
      const absoluteUrl = withAbsoluteUrl(url, config?.baseURL);
      const response = await canonicalApiClient.patch<T>(absoluteUrl, data, toCanonicalConfig(config));
      return toLegacyResponse(response);
    } catch (error) {
      return normalizeError(error);
    }
  }

  async delete<T>(url: string, config?: RequestConfig): Promise<APIResponse<T>> {
    try {
      const absoluteUrl = withAbsoluteUrl(url, config?.baseURL);
      const response = await canonicalApiClient.delete<T>(absoluteUrl, toCanonicalConfig(config));
      return toLegacyResponse(response);
    } catch (error) {
      return normalizeError(error);
    }
  }
}

export const apiClient = new APIClient();

export const api = {
  get: <T>(url: string, config?: RequestConfig) => apiClient.get<T>(url, config),
  post: <T, D = unknown>(url: string, data?: D, config?: RequestConfig) => apiClient.post<T, D>(url, data, config),
  put: <T, D = unknown>(url: string, data?: D, config?: RequestConfig) => apiClient.put<T, D>(url, data, config),
  patch: <T, D = unknown>(url: string, data?: D, config?: RequestConfig) => apiClient.patch<T, D>(url, data, config),
  delete: <T>(url: string, config?: RequestConfig) => apiClient.delete<T>(url, config),
};
