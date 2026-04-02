/**
 * Response Denormalizer — Convert Python API Responses to Node-Compatible Format
 * 
 * This module provides functions to convert response payloads from Python backend (snake_case fields,
 * raw models, HTTPException detail field) to Node-compatible format (camelCase, wrapped envelope,
 * standardized error format).
 * 
 * Applied after receiving responses from Python backend service.
 */

import { logger } from '../utils/logger.js';

// ============================================
// TYPES
// ============================================

interface PythonResponse {
  [key: string]: unknown;
}

interface NodeResponse {
  success: boolean;
  result?: unknown;
  error?: string;
  code?: string;
  requestId?: string;
  timestamp?: string;
}

// ============================================
// RESPONSE DENORMALIZATION
// ============================================

/**
 * Denormalize a Python response to Node-compatible format.
 * 
 * If the response already has a `success` field, assume it's already wrapped.
 * Otherwise, wrap it in the Node envelope format.
 * 
 * @param response - Response from Python backend
 * @param statusCode - HTTP status code from Python backend
 * @returns Node-compatible response
 */
export function denormalizeResponseToNode(
  response: unknown,
  statusCode: number,
): NodeResponse {
  // Handle non-object responses (shouldn't happen with JSON APIs)
  if (!response || typeof response !== 'object') {
    return {
      success: statusCode >= 200 && statusCode < 300,
      result: response,
    };
  }

  const resp = response as Record<string, unknown>;

  // If already wrapped with success field, assume it's Node-compatible
  if ('success' in resp) {
    // Still normalize field names in case of snake_case
    return normalizeFieldNamesInResponse(resp as unknown as NodeResponse) as NodeResponse;
  }

  // If response contains HTTPException detail field (FastAPI error)
  if ('detail' in resp && statusCode >= 400) {
    return {
      success: false,
      error: String(resp.detail || 'Unknown error'),
      code: determineErrorCode(statusCode, resp),
    };
  }

  // If success status but response looks like an error
  if (statusCode >= 400) {
    const errorMessage = extractErrorMessage(resp);
    return {
      success: false,
      error: errorMessage,
      code: determineErrorCode(statusCode, resp),
    };
  }

  // Otherwise, wrap successful response
  return {
    success: true,
    result: normalizeFieldNamesInResponse(resp),
  };
}

// ============================================
// ERROR EXTRACTION HELPERS
// ============================================

/**
 * Extract error message from various Python response formats.
 * Tries multiple common field names.
 * 
 * @param response - Response object
 * @returns Error message string
 */
function extractErrorMessage(response: Record<string, unknown>): string {
  // Try common error field names
  if (typeof response.detail === 'string') return response.detail;
  if (typeof response.error === 'string') return response.error;
  if (typeof response.message === 'string') return response.message;
  if (typeof response.msg === 'string') return response.msg;

  // Try nested error object
  if (typeof response.error_detail === 'string') return response.error_detail;

  // Fallback: stringify the response
  return JSON.stringify(response).substring(0, 200);
}

/**
 * Determine machine-readable error code from HTTP status and response.
 * 
 * @param statusCode - HTTP status code
 * @param response - Response object
 * @returns Error code string
 */
function determineErrorCode(statusCode: number, response: Record<string, unknown>): string {
  // Check if response has a code field
  if (typeof response.code === 'string') return response.code;

  // Map status code to standard error codes
  switch (statusCode) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 422:
      return 'VALIDATION_ERROR';
    case 429:
      return 'RATE_LIMITED';
    case 500:
      return 'INTERNAL_ERROR';
    case 503:
      return 'SERVICE_UNAVAILABLE';
    default:
      return 'UNKNOWN_ERROR';
  }
}

// ============================================
// FIELD NAME NORMALIZATION
// ============================================

/**
 * Convert snake_case field names to camelCase in response object.
 * Recursive to handle nested objects and arrays.
 * 
 * @param obj - Input object
 * @param depth - Current recursion depth
 * @returns Object with camelCase field names
 */
export function normalizeFieldNamesInResponse(
  obj: unknown,
  depth = 0,
): unknown {
  // Prevent stack overflow
  if (depth > 10) {
    logger.warn('[ResponseDenormalizer] normalizeFieldNamesInResponse: max depth exceeded');
    return obj;
  }

  // Primitive types pass through
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  // Arrays: apply recursively to each element
  if (Array.isArray(obj)) {
    return obj.map((item) => normalizeFieldNamesInResponse(item, depth + 1));
  }

  // Objects: convert keys and recurse on values
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = convertSnakeToCamelCase(key);
    result[camelKey] = normalizeFieldNamesInResponse(value, depth + 1);
  }

  return result;
}

/**
 * Convert snake_case string to camelCase.
 * Examples:
 *   "start_node_id" → "startNodeId"
 *   "member_loads" → "memberLoads"
 *   "id" → "id"
 * 
 * @param str - Input string
 * @returns Converted string
 */
function convertSnakeToCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase());
}

// ============================================
// ANALYSIS RESPONSE DENORMALIZATION
// ============================================

/**
 * Denormalize an analysis response from Python.
 * Converts snake_case fields to camelCase and wraps in Node envelope.
 * 
 * @param response - Python analysis response
 * @param statusCode - HTTP status code
 * @returns Node-compatible analysis response
 */
export function denormalizeAnalysisResponse(
  response: unknown,
  statusCode: number,
): NodeResponse {
  if (!response || typeof response !== 'object') {
    return denormalizeResponseToNode(response, statusCode);
  }

  const resp = response as Record<string, unknown>;

  // If already Node-wrapped, pass through
  if ('success' in resp && 'result' in resp) {
    return resp as unknown as NodeResponse;
  }

  // Convert snake_case to camelCase
  const normalized = normalizeFieldNamesInResponse(resp);

  // Wrap in Node envelope
  if (statusCode >= 400) {
    const errorMsg = extractErrorMessage(resp);
    return {
      success: false,
      error: errorMsg,
      code: determineErrorCode(statusCode, resp),
    };
  }

  return {
    success: true,
    result: normalized,
  };
}

// ============================================
// DESIGN RESPONSE DENORMALIZATION
// ============================================

/**
 * Denormalize a design check response from Python.
 * Restructures result format if necessary.
 * 
 * @param response - Python design response
 * @param statusCode - HTTP status code
 * @returns Node-compatible design response
 */
export function denormalizeDesignResponse(
  response: unknown,
  statusCode: number,
): NodeResponse {
  if (!response || typeof response !== 'object') {
    return denormalizeResponseToNode(response, statusCode);
  }

  const resp = response as Record<string, unknown>;

  // If error, return early
  if (statusCode >= 400 || (resp.success === false)) {
    const errorMsg = extractErrorMessage(resp);
    return {
      success: false,
      error: errorMsg,
      code: determineErrorCode(statusCode, resp),
    };
  }

  // Normalize field names
  const normalized = normalizeFieldNamesInResponse(resp);

  // If already wrapped, return as-is
  if (normalized && typeof normalized === 'object' && 'success' in (normalized as any) && 'result' in (normalized as any)) {
    return normalized as NodeResponse;
  }

  // Wrap in Node envelope
  return {
    success: true,
    result: normalized,
  };
}

// ============================================
// SECTIONS RESPONSE DENORMALIZATION
// ============================================

/**
 * Denormalize a sections response from Python.
 * 
 * @param response - Python sections response
 * @param statusCode - HTTP status code
 * @returns Node-compatible sections response
 */
export function denormalizeSectionsResponse(
  response: unknown,
  statusCode: number,
): NodeResponse {
  return denormalizeResponseToNode(response, statusCode);
}

// ============================================
// RESPONSE ROUTING
// ============================================

/**
 * Denormalize a response based on the endpoint and status code.
 * Routes to appropriate denormalizer function.
 * 
 * @param path - Request path (e.g., "/analysis", "/design/check")
 * @param response - Response from Python backend
 * @param statusCode - HTTP status code
 * @returns Node-compatible response
 */
export function denormalizeResponseFromPython(
  path: string,
  response: unknown,
  statusCode: number,
): NodeResponse {
  // Route to appropriate denormalizer
  if (path.includes('/analysis') || path.includes('/analyze')) {
    return denormalizeAnalysisResponse(response, statusCode);
  }

  if (path.includes('/design/check')) {
    return denormalizeDesignResponse(response, statusCode);
  }

  if (path.includes('/sections')) {
    return denormalizeSectionsResponse(response, statusCode);
  }

  // Default: generic denormalization
  return denormalizeResponseToNode(response, statusCode);
}

// ============================================
// LOGGING & DEBUGGING
// ============================================

/**
 * Log differences between original and denormalized response (debug level).
 * Useful for troubleshooting contract issues.
 * 
 * @param label - Label for logging
 * @param original - Original response
 * @param denormalized - Denormalized response
 */
export function logDenormalizationDiff(
  label: string,
  original: unknown,
  denormalized: unknown,
): void {
  if (process.env.DEBUG_RESPONSE_DENORMALIZATION !== 'true') {
    return;
  }

  const originalStr = JSON.stringify(original, null, 2);
  const denormalizedStr = JSON.stringify(denormalized, null, 2);

  if (originalStr !== denormalizedStr) {
    logger.info(`[ResponseDenormalizer] ${label} — original: ${originalStr.substring(0, 200)}`);
    logger.info(`[ResponseDenormalizer] ${label} — denormalized: ${denormalizedStr.substring(0, 200)}`);
  }
}
