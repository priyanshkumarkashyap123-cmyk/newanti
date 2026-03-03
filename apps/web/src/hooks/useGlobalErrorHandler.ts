import { useEffect } from 'react';
import { uiLogger } from '../lib/logging/logger';

/**
 * Registers global listeners for unhandled errors and unhandled promise
 * rejections, logging them via the structured UI logger.
 *
 * Should be called once in the root App component.
 */
export function useGlobalErrorHandler(): void {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      uiLogger.error('Unhandled error', {
        error: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      uiLogger.error('Unhandled promise rejection', {
        error: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);
}
