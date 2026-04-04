/**
 * Lightweight error extraction utilities.
 * Kept separate from UI-heavy modules for testability and reuse.
 */

/**
 * Safely extract an error message from an unknown caught value.
 * Handles Error instances, plain strings, and objects with a `message` property.
 */
export function getErrorMessage(e: unknown, fallback = 'An unexpected error occurred'): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  if (
    e !== null &&
    typeof e === 'object' &&
    'message' in e &&
    typeof (e as { message: unknown }).message === 'string'
  ) {
    return (e as { message: string }).message;
  }
  return fallback;
}

/**
 * Check if the caught value is an AbortError (e.g. from AbortController timeout).
 */
export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}

/**
 * Extract an error message from Axios-style errors with `response.data.detail`,
 * falling back to the standard getErrorMessage chain.
 */
export function getApiErrorMessage(e: unknown, fallback = 'Request failed'): string {
  if (e !== null && typeof e === 'object') {
    const axiosErr = e as { response?: { data?: { detail?: string } } };
    if (typeof axiosErr.response?.data?.detail === 'string') {
      return axiosErr.response.data.detail;
    }
  }
  return getErrorMessage(e, fallback);
}
