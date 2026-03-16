/**
 * Shared API Error Codes and Response Format
 * 
 * Used across all backends (Node.js, Python, Rust) to ensure
 * consistent error handling and client-side error recovery.
 * 
 * All API error responses must follow this format:
 * {
 *   "error": "Human-readable error message",
 *   "code": "ERROR_CODE_CONSTANT",
 *   "requestId": "unique-request-id",
 *   "details": { optional context object }
 * }
 */

export enum ApiErrorCode {
  // Authentication & Authorization (401, 403)
  UNAUTHORIZED = "UNAUTHORIZED",
  INVALID_TOKEN = "INVALID_TOKEN",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
  FORBIDDEN = "FORBIDDEN",

  // Client Errors (400, 404, 422)
  BAD_REQUEST = "BAD_REQUEST",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  NOT_FOUND = "NOT_FOUND",
  INVALID_MODEL = "INVALID_MODEL",
  MISSING_FIELD = "MISSING_FIELD",

  // Business Logic Errors (422)
  DUPLICATE_KEY = "DUPLICATE_KEY",
  CONFLICT = "CONFLICT",
  INSUFFICIENT_SUPPORTS = "INSUFFICIENT_SUPPORTS",
  SINGULAR_MATRIX = "SINGULAR_MATRIX",
  UNSUPPORTED_ELEMENT_TYPE = "UNSUPPORTED_ELEMENT_TYPE",

  // Rate Limiting & Quota (429)
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  QUOTA_EXCEEDED = "QUOTA_EXCEEDED",
  ANALYSIS_LIMIT_EXCEEDED = "ANALYSIS_LIMIT_EXCEEDED",

  // Resource Constraints (503)
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  MEMORY_LIMIT_EXCEEDED = "MEMORY_LIMIT_EXCEEDED",
  TIMEOUT = "TIMEOUT",
  SOLVER_TIMEOUT = "SOLVER_TIMEOUT",
  DATABASE_UNAVAILABLE = "DATABASE_UNAVAILABLE",

  // Server Errors (500)
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
  SOLVER_ERROR = "SOLVER_ERROR",

  // Analysis-specific errors (422)
  ANALYSIS_FAILED = "ANALYSIS_FAILED",
  SOLVER_DIVERGED = "SOLVER_DIVERGED",
  NONLINEAR_SOLVER_FAILED = "NONLINEAR_SOLVER_FAILED",
}

export interface ApiErrorResponse {
  error: string;
  code: ApiErrorCode;
  requestId?: string;
  details?: Record<string, unknown>;
  timestamp?: string;
}

/**
 * HTTP Status Code Mapping
 * Standardized across all backends
 */
export const ErrorCodeToHttpStatus: Record<ApiErrorCode, number> = {
  // 400 Bad Request
  [ApiErrorCode.BAD_REQUEST]: 400,
  [ApiErrorCode.VALIDATION_ERROR]: 400,
  [ApiErrorCode.MISSING_FIELD]: 400,
  [ApiErrorCode.INVALID_MODEL]: 400,

  // 401 Unauthorized
  [ApiErrorCode.UNAUTHORIZED]: 401,
  [ApiErrorCode.INVALID_TOKEN]: 401,
  [ApiErrorCode.TOKEN_EXPIRED]: 401,

  // 403 Forbidden
  [ApiErrorCode.FORBIDDEN]: 403,
  [ApiErrorCode.INSUFFICIENT_PERMISSIONS]: 403,

  // 404 Not Found
  [ApiErrorCode.NOT_FOUND]: 404,

  // 409 Conflict
  [ApiErrorCode.CONFLICT]: 409,
  [ApiErrorCode.DUPLICATE_KEY]: 409,

  // 422 Unprocessable Entity (Semantic/Business Logic Error)
  [ApiErrorCode.INSUFFICIENT_SUPPORTS]: 422,
  [ApiErrorCode.SINGULAR_MATRIX]: 422,
  [ApiErrorCode.UNSUPPORTED_ELEMENT_TYPE]: 422,
  [ApiErrorCode.ANALYSIS_FAILED]: 422,
  [ApiErrorCode.SOLVER_DIVERGED]: 422,
  [ApiErrorCode.NONLINEAR_SOLVER_FAILED]: 422,

  // 429 Too Many Requests
  [ApiErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ApiErrorCode.QUOTA_EXCEEDED]: 429,
  [ApiErrorCode.ANALYSIS_LIMIT_EXCEEDED]: 429,

  // 503 Service Unavailable
  [ApiErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ApiErrorCode.DATABASE_UNAVAILABLE]: 503,
  [ApiErrorCode.MEMORY_LIMIT_EXCEEDED]: 503,
  [ApiErrorCode.TIMEOUT]: 503,
  [ApiErrorCode.SOLVER_TIMEOUT]: 503,

  // 500 Internal Server Error (catch-all)
  [ApiErrorCode.INTERNAL_SERVER_ERROR]: 500,
  [ApiErrorCode.DATABASE_ERROR]: 500,
  [ApiErrorCode.EXTERNAL_SERVICE_ERROR]: 500,
  [ApiErrorCode.SOLVER_ERROR]: 500,
};

/**
 * Remediation hints for clients to suggest fixes to users
 */
export const ErrorRemediationHints: Record<ApiErrorCode, string> = {
  [ApiErrorCode.UNAUTHORIZED]: "Log in again or refresh your session.",
  [ApiErrorCode.INVALID_TOKEN]: "Your authentication token is invalid. Log in again.",
  [ApiErrorCode.TOKEN_EXPIRED]: "Your session has expired. Log in again.",
  [ApiErrorCode.INSUFFICIENT_PERMISSIONS]: "You don't have permission to perform this action. Contact support.",
  [ApiErrorCode.FORBIDDEN]: "This resource is not accessible.",
  [ApiErrorCode.INVALID_MODEL]: "Check your model definition for invalid elements or connections.",
  [ApiErrorCode.INSUFFICIENT_SUPPORTS]: "Add support conditions or boundary conditions to stabilize the model.",
  [ApiErrorCode.SINGULAR_MATRIX]: "Check for disconnected elements or redundant supports. Remove or adjust.",
  [ApiErrorCode.UNSUPPORTED_ELEMENT_TYPE]: "This element type is not yet supported. Use a different element.",
  [ApiErrorCode.ANALYSIS_FAILED]: "The analysis could not complete. Check your model and try again.",
  [ApiErrorCode.SOLVER_DIVERGED]: "The solver couldn't find a solution. Refine your model or reduce load increments.",
  [ApiErrorCode.NONLINEAR_SOLVER_FAILED]: "Nonlinear analysis did not converge. Try different loads, materials, or solver settings.",
  [ApiErrorCode.RATE_LIMIT_EXCEEDED]: "Too many requests. Please wait a moment before trying again.",
  [ApiErrorCode.QUOTA_EXCEEDED]: "You've exceeded your analysis quota. Upgrade your plan or contact support.",
  [ApiErrorCode.DATABASE_UNAVAILABLE]: "Backend database is temporarily unavailable. Try again in a moment.",
  [ApiErrorCode.SOLVER_TIMEOUT]: "Analysis took too long and timed out. Try a simpler model or fewer load steps.",
  [ApiErrorCode.TIMEOUT]: "Request timed out. Try again or contact support if this persists.",
  [ApiErrorCode.MEMORY_LIMIT_EXCEEDED]: "Model is too large to analyze. Simplify or reduce element count.",
  [ApiErrorCode.SERVICE_UNAVAILABLE]: "Service is temporarily unavailable. Please try again soon.",
  [ApiErrorCode.INTERNAL_SERVER_ERROR]: "An unexpected error occurred. Our team has been notified. Please try again.",
  [ApiErrorCode.NOT_FOUND]: "This resource was not found.",
  [ApiErrorCode.CONFLICT]: "This resource already exists or there's a conflict.",
  [ApiErrorCode.DUPLICATE_KEY]: "A resource with this identifier already exists.",
  [ApiErrorCode.BAD_REQUEST]: "The request is malformed. Check your input and try again.",
  [ApiErrorCode.VALIDATION_ERROR]: "One or more fields are invalid. Check your input.",
  [ApiErrorCode.MISSING_FIELD]: "Required field is missing.",
  [ApiErrorCode.DATABASE_ERROR]: "Database error occurred. Please try again.",
  [ApiErrorCode.EXTERNAL_SERVICE_ERROR]: "An external service failed. Please try again.",
  [ApiErrorCode.SOLVER_ERROR]: "Structural analysis solver encountered an error. Check your model.",
  [ApiErrorCode.ANALYSIS_LIMIT_EXCEEDED]: "You've exceeded your analysis limit. Upgrade or wait for the next billing period.",
};

/**
 * Client-side error handling utilities
 */

export function isRetryableError(errorCode: ApiErrorCode, httpStatus: number): boolean {
  // Retry on 429 (rate limit), 503 (service unavailable), and specific errors
  if (httpStatus === 429 || httpStatus === 503) return true;
  if (errorCode === ApiErrorCode.TIMEOUT) return true;
  if (errorCode === ApiErrorCode.SOLVER_TIMEOUT) return true;
  if (errorCode === ApiErrorCode.DATABASE_UNAVAILABLE) return true;
  return false;
}

export function getRetryDelayMs(attempt: number, errorCode?: ApiErrorCode): number {
  // Exponential backoff with jitter: (2 ^ attempt) * 100 + random(0, 100)
  const exponential = Math.pow(2, Math.min(attempt, 5)) * 100;
  const jitter = Math.random() * 100;
  const baseDelay = exponential + jitter;

  // If rate limited, respect Retry-After header (server-provided)
  if (errorCode === ApiErrorCode.RATE_LIMIT_EXCEEDED) {
    return Math.min(baseDelay, 30_000); // max 30s
  }

  return Math.min(baseDelay, 10_000); // max 10s for other retries
}

export function isSeverityLevel(errorCode: ApiErrorCode): "info" | "warning" | "error" {
  // Use for Sentry severity and alerting
  if ([ApiErrorCode.RATE_LIMIT_EXCEEDED, ApiErrorCode.QUOTA_EXCEEDED].includes(errorCode)) {
    return "info"; // Expected behavior
  }
  if ([ApiErrorCode.VALIDATION_ERROR, ApiErrorCode.BAD_REQUEST].includes(errorCode)) {
    return "warning"; // Client error
  }
  return "error"; // Everything else is an error
}
