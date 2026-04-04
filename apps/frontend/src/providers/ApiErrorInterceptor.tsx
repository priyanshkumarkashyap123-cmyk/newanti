/**
 * ============================================================================
 * API ERROR TOAST INTERCEPTOR
 * ============================================================================
 *
 * Wires API client errors to the global toast notification system.
 * Automatically shows user-friendly error messages for server failures,
 * network errors, and auth issues.
 *
 * Drop this into your app's provider tree:
 *   <ToastProvider>
 *     <ApiErrorInterceptor />
 *     <App />
 *   </ToastProvider>
 */

import { useEffect } from 'react';
import { useToast } from '../components/ui/ToastSystem';

// Global hook for programmatic toast access outside React components
let _showToast: ((type: 'error' | 'warning' | 'info' | 'success', title: string, message: string) => void) | null = null;

/**
 * Show a toast notification from anywhere (even outside React).
 * Must be called after ApiErrorInterceptor mounts.
 */
export function showGlobalToast(type: 'error' | 'warning' | 'info' | 'success', title: string, message: string): void {
  if (_showToast) {
    _showToast(type, title, message);
  } else {
    // Fallback: log to console if toast system not mounted yet
    console[type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'info'](`[${title}] ${message}`);
  }
}

/**
 * React component that sets up global API error handling.
 * Mount once in your app tree inside ToastProvider.
 */
export function ApiErrorInterceptor(): null {
  const toast = useToast();

  useEffect(() => {
    // Register global toast function
    _showToast = (type, title, message) => {
      toast.addToast({
        type,
        title,
        message,
        duration: type === 'error' ? 8000 : 5000,
        dismissible: true,
      });
    };

    // Listen for unhandled fetch errors
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      if (!error) return;

      // Only catch API/network errors, not other promise rejections
      const msg = error?.message || String(error);
      if (
        msg.includes('fetch') ||
        msg.includes('network') ||
        msg.includes('CORS') ||
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('AbortError')
      ) {
        toast.addToast({
          type: 'error',
          title: 'Network Error',
          message: 'Unable to reach the server. Please check your connection.',
          duration: 8000,
          dismissible: true,
        });
        event.preventDefault(); // Don't log to console twice
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    const handleApiClientError = (event: Event) => {
      const customEvent = event as CustomEvent<{
        message?: string;
        status?: number;
        code?: string;
        action?: string;
        helpLink?: string;
      }>;

      const detail = customEvent.detail;
      if (!detail) return;

      const title = detail.status ? `Request failed (${detail.status})` : 'Request failed';
      const suffixParts = [detail.action, detail.helpLink].filter(Boolean);
      const message = suffixParts.length > 0
        ? `${detail.message ?? 'Something went wrong.'} · ${suffixParts.join(' · ')}`
        : detail.message ?? 'Something went wrong.';

      toast.addToast({
        type: 'error',
        title,
        message,
        duration: 8000,
        dismissible: true,
      });
    };

    window.addEventListener('beamlab:api-error', handleApiClientError as EventListener);

    return () => {
      _showToast = null;
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('beamlab:api-error', handleApiClientError as EventListener);
    };
  }, [toast]);

  return null;
}

/**
 * API error classification helper.
 * Maps HTTP status codes to user-friendly messages.
 */
export function classifyApiError(status: number, body?: string): { title: string; message: string } {
  switch (true) {
    case status === 0:
      return { title: 'Connection Failed', message: 'Cannot reach the server. Check your internet connection.' };
    case status === 401:
      return { title: 'Authentication Required', message: 'Please sign in to continue.' };
    case status === 403:
      return { title: 'Access Denied', message: 'You don\'t have permission to perform this action.' };
    case status === 404:
      return { title: 'Not Found', message: 'The requested resource was not found.' };
    case status === 408:
      return { title: 'Request Timeout', message: 'The server took too long to respond. Try again.' };
    case status === 413:
      return { title: 'Model Too Large', message: 'The structural model exceeds the maximum size. Try reducing nodes.' };
    case status === 422:
      return { title: 'Invalid Input', message: body || 'Please check your input data and try again.' };
    case status === 429:
      return { title: 'Rate Limited', message: 'Too many requests. Please wait a moment and try again.' };
    case status >= 500 && status < 600:
      return { title: 'Server Error', message: 'An internal server error occurred. Our team has been notified.' };
    default:
      return { title: 'Request Failed', message: `Unexpected error (HTTP ${status}).` };
  }
}

export default ApiErrorInterceptor;
