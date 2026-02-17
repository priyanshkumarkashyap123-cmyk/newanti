/**
 * ============================================================================
 * PRODUCTION-GRADE ERROR HANDLING
 * ============================================================================
 * 
 * Industry-standard error handling with:
 * - Custom error classes
 * - Error boundaries
 * - User-friendly messages
 * - Automatic error reporting
 * 
 * @version 1.0.0
 */

import { logger } from './logger';

/**
 * Base application error class
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: string = 'APP_ERROR',
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;

    // Capture stack trace if available (non-standard but supported in most environments)
    const ErrorWithCapture = Error as unknown as { captureStackTrace?: (target: object, constructor: Function) => void };
    if (ErrorWithCapture.captureStackTrace) {
      ErrorWithCapture.captureStackTrace(this, this.constructor as Function);
    }
  }
}

/**
 * API-related errors
 */
export class APIError extends AppError {
  constructor(message: string, statusCode: number = 500, context?: Record<string, unknown>) {
    super(message, 'API_ERROR', statusCode, true, context);
  }
}

/**
 * Validation errors
 */
export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, true, context);
  }
}

/**
 * Authentication errors
 */
export class AuthError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'AUTH_ERROR', 401, true, context);
  }
}

/**
 * Network errors
 */
export class NetworkError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'NETWORK_ERROR', 503, true, context);
  }
}

/**
 * Convert unknown errors to AppError
 */
export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(
      error.message,
      'UNKNOWN_ERROR',
      500,
      false,
      { originalError: error.name }
    );
  }

  if (typeof error === 'string') {
    return new AppError(error, 'STRING_ERROR', 500, false);
  }

  return new AppError(
    'An unknown error occurred',
    'UNKNOWN_ERROR',
    500,
    false,
    { error: String(error) }
  );
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(error: unknown): string {
  const normalized = normalizeError(error);

  const messages: Record<string, string> = {
    NETWORK_ERROR: 'Network connection failed. Please check your internet connection.',
    API_ERROR: 'Server error occurred. Please try again later.',
    VALIDATION_ERROR: 'Invalid input. Please check your data.',
    AUTH_ERROR: 'Authentication failed. Please log in again.',
  };

  return messages[normalized.code] || normalized.message || 'An unexpected error occurred.';
}

/**
 * Global error handler
 */
export function handleError(error: unknown, context?: Record<string, unknown>): void {
  const normalized = normalizeError(error);

  logger.error(normalized.message, {
    code: normalized.code,
    statusCode: normalized.statusCode,
    stack: normalized.stack,
    context: { ...normalized.context, ...context },
  });

  // Show user-friendly notification (integrate with your toast/notification system)
  if (normalized.isOperational && typeof window !== 'undefined') {
    // TODO: Integrate with notification system
    console.error('User-facing error:', getUserFriendlyMessage(error));
  }
}

/**
 * Async error wrapper for promise-based operations
 */
export function asyncErrorHandler<T>(
  promise: Promise<T>,
  context?: Record<string, unknown>
): Promise<[Error | null, T | null]> {
  return promise
    .then((data): [null, T] => [null, data])
    .catch((error): [Error, null] => {
      handleError(error, context);
      return [normalizeError(error), null];
    });
}

/**
 * Try-catch wrapper that returns Result type
 */
export type Result<T, E = AppError> =
  | { success: true; data: T }
  | { success: false; error: E };

export function tryCatch<T>(fn: () => T, context?: Record<string, unknown>): Result<T> {
  try {
    const data = fn();
    return { success: true, data };
  } catch (error) {
    const normalized = normalizeError(error);
    handleError(normalized, context);
    return { success: false, error: normalized };
  }
}

export async function tryCatchAsync<T>(
  fn: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<Result<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    const normalized = normalizeError(error);
    handleError(normalized, context);
    return { success: false, error: normalized };
  }
}
