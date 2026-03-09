/**
 * Robust fetch utility with timeouts and error handling
 */

import { addCsrfHeader } from '../lib/security';

export interface FetchOptions extends RequestInit {
    timeout?: number; // milliseconds
    retries?: number;
    retryDelay?: number;
    authToken?: string;
    withCsrf?: boolean;
}

export interface FetchResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    status?: number;
}

/**
 * Fetch with timeout, retries, and proper error handling
 */
export async function fetchWithTimeout<T>(
    url: string,
    options: FetchOptions = {}
): Promise<FetchResponse<T>> {
    const {
        timeout = 15000, // 15 seconds default
        retries = 2,
        retryDelay = 1000,
        authToken,
        withCsrf = false,
        ...fetchOptions
    } = options;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const headers = new Headers(fetchOptions.headers as HeadersInit | undefined);
            if (!headers.has('Content-Type') && fetchOptions.body !== undefined) {
                headers.set('Content-Type', 'application/json');
            }
            if (authToken) {
                headers.set('Authorization', `Bearer ${authToken}`);
            }
            if (withCsrf) {
                addCsrfHeader(headers);
            }

            try {
                const response = await fetch(url, {
                    ...fetchOptions,
                    signal: controller.signal,
                    headers,
                });

                clearTimeout(timeoutId);

                // Handle non-2xx responses
                if (!response.ok) {
                    if (response.status >= 500 && attempt < retries) {
                        // Retry on server errors
                        lastError = new Error(`HTTP ${response.status}`);
                        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
                        continue;
                    }

                    // For non-retriable errors, return error response
                    let errorData: any = null;
                    try {
                        errorData = await response.json();
                    } catch {
                        errorData = { error: `HTTP ${response.status}` };
                    }

                    // Handle both old string errors and new envelope { error: { code, message } }
                    let errorMsg: string;
                    if (typeof errorData?.success === 'boolean' && errorData?.success === false) {
                        if (typeof errorData?.error === 'object' && errorData.error?.message) {
                            errorMsg = errorData.error.message;
                        } else if (typeof errorData?.error === 'string') {
                            errorMsg = errorData.error;
                        } else {
                            errorMsg = errorData?.message || `Request failed with status ${response.status}`;
                        }
                    } else
                    if (typeof errorData?.error === 'object' && errorData.error?.message) {
                        errorMsg = errorData.error.message;
                    } else if (typeof errorData?.error === 'string') {
                        errorMsg = errorData.error;
                    } else {
                        errorMsg = errorData?.message || `Request failed with status ${response.status}`;
                    }

                    return {
                        success: false,
                        error: errorMsg,
                        status: response.status,
                    };
                }

                // Parse successful response
                let data: T;
                const contentType = response.headers.get('content-type');

                if (contentType?.includes('application/json')) {
                    const raw = await response.json();

                    // Handle envelope-level logical failures even with 2xx status
                    if (raw && typeof raw === 'object' && raw.success === false) {
                        const envelopeError =
                            typeof raw.error === 'object' && raw.error?.message
                                ? raw.error.message
                                : (raw.error || raw.message || 'Request failed');
                        return {
                            success: false,
                            error: envelopeError,
                            status: response.status,
                        };
                    }

                    // Auto-unwrap API envelope: { success, data, requestId, ts }
                    if (raw && typeof raw === 'object' && 'success' in raw && raw.success === true && 'data' in raw) {
                        data = raw.data as T;
                    } else {
                        data = raw as T;
                    }
                } else {
                    data = (await response.text()) as unknown as T;
                }

                return { success: true, data, status: response.status };
            } catch (error) {
                clearTimeout(timeoutId);

                if (error instanceof DOMException && error.name === 'AbortError') {
                    lastError = new Error(`Request timeout after ${timeout}ms`);
                } else if (error instanceof TypeError) {
                    lastError = new Error('Network error');
                } else {
                    lastError = error instanceof Error ? error : new Error(String(error));
                }

                // Retry on network errors or timeouts
                if (attempt < retries) {
                    await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
                    continue;
                }
            }
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
        }
    }

    return {
        success: false,
        error: lastError?.message || 'Request failed after retries',
    };
}

/**
 * Fetch JSON with type safety
 */
export async function fetchJson<T>(
    url: string,
    options?: FetchOptions
): Promise<T> {
    const response = await fetchWithTimeout<T>(url, options);

    if (!response.success) {
        throw new Error(response.error || 'Request failed');
    }

    return response.data!;
}

/**
 * Post JSON data with timeout
 */
export async function postJson<T>(
    url: string,
    data: unknown,
    options?: FetchOptions
): Promise<T> {
    return fetchJson<T>(url, {
        ...options,
        method: 'POST',
        body: JSON.stringify(data),
    });
}

/**
 * Get JSON data with timeout
 */
export async function getJson<T>(
    url: string,
    options?: FetchOptions
): Promise<T> {
    return fetchJson<T>(url, {
        ...options,
        method: 'GET',
    });
}
