/**
 * Robust fetch utility with timeouts and error handling
 */

export interface FetchOptions extends RequestInit {
    timeout?: number; // milliseconds
    retries?: number;
    retryDelay?: number;
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
        ...fetchOptions
    } = options;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            try {
                const response = await fetch(url, {
                    ...fetchOptions,
                    signal: controller.signal,
                    headers: {
                        'Content-Type': 'application/json',
                        ...fetchOptions.headers,
                    },
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

                    return {
                        success: false,
                        error: errorData.error || errorData.message || `Request failed with status ${response.status}`,
                        status: response.status,
                    };
                }

                // Parse successful response
                let data: T;
                const contentType = response.headers.get('content-type');

                if (contentType?.includes('application/json')) {
                    data = await response.json();
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
    data: any,
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
