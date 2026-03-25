/**
 * ============================================================================
 * SENTRY ERROR TRACKING - FRONTEND
 * ============================================================================
 * 
 * Production-grade error tracking with:
 * - Automatic error capture
 * - Performance monitoring
 * - Session replay
 * - User feedback collection
 * - Custom context and tags
 * 
 * @version 1.0.0
 */

import * as Sentry from '@sentry/react';
import { getValidatedSentryDsn } from '../../config/env';

// ============================================================================
// CONFIGURATION
// ============================================================================

const VALIDATED_SENTRY_DSN = getValidatedSentryDsn();
const ENVIRONMENT = import.meta.env.MODE || 'development';
const VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

/**
 * Initialize Sentry for the frontend
 */
export function initSentry(): void {
  if (!VALIDATED_SENTRY_DSN) {
    if (import.meta.env.DEV) console.log('[Sentry] DSN not configured, skipping initialization');
    return;
  }

  Sentry.init({
    dsn: VALIDATED_SENTRY_DSN,
    environment: ENVIRONMENT,
    release: `beamlab@${VERSION}`,
    
    // Performance Monitoring
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
    
    // Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Integrations
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
      Sentry.feedbackIntegration({
        colorScheme: 'dark',
        showBranding: false,
        buttonLabel: 'Report Issue',
        submitButtonLabel: 'Send Report',
        formTitle: 'Report an Issue',
        messagePlaceholder: 'Describe what happened...',
      }),
    ],

    // Filter events
    beforeSend(event, hint) {
      // Don't send events in development
      if (ENVIRONMENT === 'development') {
        console.log('[Sentry] Would send event:', event);
        return null;
      }

      // Filter out common non-actionable errors
      const error = hint?.originalException;
      if (error instanceof Error) {
        // Ignore network errors from adblockers
        if (error.message.includes('Failed to fetch') && error.message.includes('analytics')) {
          return null;
        }
        // Ignore ResizeObserver errors
        if (error.message.includes('ResizeObserver loop')) {
          return null;
        }
      }

      return event;
    },

    // Scrub sensitive data
    beforeSendTransaction(event) {
      // Remove sensitive query params
      if (event.request?.url) {
        const url = new URL(event.request.url);
        ['token', 'key', 'password', 'secret'].forEach(param => {
          if (url.searchParams.has(param)) {
            url.searchParams.set(param, '[REDACTED]');
          }
        });
        event.request.url = url.toString();
      }
      return event;
    },
  });

  if (import.meta.env.DEV) console.log(`[Sentry] Initialized for ${ENVIRONMENT} environment`);
}

// ============================================================================
// USER CONTEXT
// ============================================================================

export function setSentryUser(user: {
  id: string;
  email?: string;
  username?: string;
} | null): void {
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
    });
  } else {
    Sentry.setUser(null);
  }
}

// ============================================================================
// CUSTOM CONTEXT
// ============================================================================

export function setSentryContext(name: string, context: Record<string, unknown>): void {
  Sentry.setContext(name, context);
}

export function setSentryTag(key: string, value: string): void {
  Sentry.setTag(key, value);
}

// ============================================================================
// ERROR CAPTURE
// ============================================================================

export function captureError(
  error: Error | unknown,
  context?: Record<string, unknown>
): string {
  if (context) {
    Sentry.setContext('additional', context);
  }
  
  return Sentry.captureException(error);
}

export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info'
): string {
  return Sentry.captureMessage(message, level);
}

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

export function startTransaction(
  name: string,
  op: string
): Sentry.Span | undefined {
  return Sentry.startInactiveSpan({
    name,
    op,
  });
}

export function measurePerformance<T>(
  name: string,
  operation: string,
  fn: () => T
): T {
  return Sentry.startSpan({ name, op: operation }, () => fn());
}

export async function measureAsyncPerformance<T>(
  name: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  return Sentry.startSpan({ name, op: operation }, () => fn());
}

// ============================================================================
// USER FEEDBACK
// ============================================================================

export function showFeedbackDialog(): void {
  const feedback = Sentry.getFeedback();
  if (feedback && 'openDialog' in feedback && typeof (feedback as unknown as { openDialog: () => void }).openDialog === 'function') {
    (feedback as unknown as { openDialog: () => void }).openDialog();
  }
}

// ============================================================================
// ERROR BOUNDARY WRAPPER
// ============================================================================

export const SentryErrorBoundary = Sentry.ErrorBoundary;

export function withSentryErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback: React.ReactNode
): React.ComponentType<P> {
  return Sentry.withErrorBoundary(Component, { fallback: fallback as React.ReactElement });
}

// ============================================================================
// PROFILER
// ============================================================================

export const SentryProfiler = Sentry.withProfiler;

export default {
  init: initSentry,
  setUser: setSentryUser,
  setContext: setSentryContext,
  setTag: setSentryTag,
  captureError,
  captureMessage,
  startTransaction,
  measurePerformance,
  measureAsyncPerformance,
  showFeedbackDialog,
  ErrorBoundary: SentryErrorBoundary,
  withErrorBoundary: withSentryErrorBoundary,
  withProfiler: SentryProfiler,
};
