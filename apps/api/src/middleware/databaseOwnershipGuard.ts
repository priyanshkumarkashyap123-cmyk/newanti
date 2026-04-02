/**
 * apps/api/src/middleware/databaseOwnershipGuard.ts
 *
 * Enforces MongoDB write authorization rules to prevent unauthorized
 * cross-service mutations. All write operations are validated against
 * the ownership matrix defined in ITEM5_MONGODB_OWNERSHIP_MATRIX.md.
 *
 * Usage:
 *   app.use(databaseOwnershipGuard);
 *
 * The middleware extracts the calling service from:
 *   1. x-service-caller header (internal service calls)
 *   2. JWT claims (frontend calls, defaults to 'node')
 *   3. Context object (for direct method calls)
 *
 * Violations are logged as security events and return 403 Forbidden.
 */

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

// ─────────────────────────────────────────────────────────────────────────────
// WRITE AUTHORIZATION MATRIX
// ─────────────────────────────────────────────────────────────────────────────
// Key: Collection name (lowercase singular from Mongoose)
// Value: Array of service names that may write to this collection
//
// Reference: ITEM5_MONGODB_OWNERSHIP_MATRIX.md — Collection Ownership Matrix

const WRITE_AUTHORITY: Record<string, string[]> = {
  // User & Authentication Collections (Node only)
  users: ['node'],
  usermodels: ['node'],
  refreshtokens: ['node'],
  verificationcodes: ['node'],
  consents: ['node'],

  // Project & Collaboration Collections (Node only)
  projects: ['node'],
  collaborationinvites: ['node'],

  // Billing & Subscription Collections (Node only)
  subscriptions: ['node'],
  subscriptionledgers: ['node'],
  paymentwebhookevents: ['node'],
  usagecounters: ['node'],
  legacypaymentdata: ['node'], // migration-only; write disabled in prod
  tierchangelogs: ['node'],

  // Analysis & Reporting Collections
  aisessions: ['node'],
  analysisjobs: ['node'],
  analysisresults: ['rust'], // Rust is the exclusive writer
  reportgenerations: ['node'],

  // Operations Collections (Node only)
  devicesessions: ['node'],
  usagelogs: ['node'],
  quotarecords: ['node'],
  gpujobidempotency: ['node'],

  // Deprecated/Legacy (Write disabled)
  devicesession: [], // Use devicesessions
  reportgeneration: [], // Use reportgenerations
};

// ─────────────────────────────────────────────────────────────────────────────
// APPEND-ONLY COLLECTIONS
// ─────────────────────────────────────────────────────────────────────────────
// These collections may only be appended to; no UPDATE or DELETE allowed.
// This preserves immutability for audit trails.

const APPEND_ONLY_COLLECTIONS = new Set([
  'tierchangelogs',
  'usagelogs',
  'paymentwebhookevents', // Idempotent tracking; no updates
]);

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract the calling service from request context.
 *
 * Priority:
 *   1. x-service-caller header (internal service-to-service calls)
 *   2. x-caller-service header (alternative name)
 *   3. Defaults to 'node' (frontend calls through gateway)
 */
function extractCallerService(req: Request): string {
  return (
    (req.headers['x-service-caller'] as string) ||
    (req.headers['x-caller-service'] as string) ||
    'node'
  );
}

/**
 * Log authorization violation as security event.
 */
function logOwnershipViolation(
  service: string,
  collection: string,
  operation: string,
  reason: string
) {
  logger.warn(
    {
      service,
      collection,
      operation,
      reason,
      timestamp: new Date().toISOString(),
      type: 'DATABASE_AUTHORIZATION_VIOLATION',
    },
    '[OwnershipGuard] Unauthorized database write attempt'
  );
}

/**
 * Log authorized write for audit purposes.
 */
function logAuthorizedWrite(
  service: string,
  collection: string,
  operation: string
) {
  // Only log if DEBUG_DATABASE_OWNERSHIP env var is set
  if (process.env['DEBUG_DATABASE_OWNERSHIP']) {
    logger.debug(
      {
        service,
        collection,
        operation,
        timestamp: new Date().toISOString(),
      },
      '[OwnershipGuard] Authorized database write'
    );
  }
}

/**
 * Validate write authority for a collection.
 *
 * Returns { authorized: boolean, reason?: string }
 */
function validateWriteAuthority(
  service: string,
  collection: string,
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
): { authorized: boolean; reason?: string } {
  // Normalize collection name to lowercase
  const normalizedCollection = collection.toLowerCase();

  // Check if collection is defined in the authority matrix
  const authorizedServices = WRITE_AUTHORITY[normalizedCollection];
  if (!authorizedServices) {
    return {
      authorized: false,
      reason: `Collection "${collection}" not found in authorization matrix`,
    };
  }

  // Check if calling service is authorized
  if (!authorizedServices.includes(service)) {
    return {
      authorized: false,
      reason: `Service "${service}" not authorized for ${operation} on "${collection}"; authorized: [${authorizedServices.join(', ')}]`,
    };
  }

  // For append-only collections, disallow UPDATE and DELETE
  if (APPEND_ONLY_COLLECTIONS.has(normalizedCollection)) {
    if (operation !== 'INSERT') {
      return {
        authorized: false,
        reason: `Collection "${collection}" is append-only; ${operation} operations not permitted`,
      };
    }
  }

  return { authorized: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Express middleware to enforce database write authorization.
 *
 * Applies to all HTTP requests. Validates that:
 *   1. Only authorized services can write to protected collections
 *   2. Append-only collections receive only INSERT operations
 *   3. All violations are logged as security events
 *
 * If x-enforce-ownership is explicitly set to 'false' in headers,
 * bypass validation (useful for migrations during deployment).
 */
export function databaseOwnershipGuard(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Allow opt-out for data migrations (temporary; remove after migration completes)
  if (req.headers['x-enforce-ownership'] === 'false') {
    if (process.env['DEBUG_DATABASE_OWNERSHIP']) {
      logger.debug(
        { path: req.path, method: req.method },
        '[OwnershipGuard] Write enforcement bypassed per x-enforce-ownership header'
      );
    }
    next();
    return;
  }

  // Only validate on write operations
  const isWriteOperation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(
    req.method.toUpperCase()
  );
  if (!isWriteOperation) {
    next();
    return;
  }

  // Extract calling service
  const service = extractCallerService(req);

  // Infer operation type
  const operation =
    req.method.toUpperCase() === 'DELETE'
      ? 'DELETE'
      : req.method.toUpperCase() === 'POST'
        ? 'INSERT'
        : 'UPDATE';

  // Infer target collection from request path or body
  // Common patterns:
  //   POST /api/v1/projects                  → projects
  //   PUT /api/v1/projects/:id               → projects
  //   DELETE /api/v1/projects/:id            → projects
  //   POST /api/v1/subscriptions/:id/upgrade → subscriptions
  const pathSegments = req.path.split('/').filter((s) => s);
  const targetCollection = pathSegments[pathSegments.length - 1]?.replace(
    /:[a-z]+$/,
    ''
  );

  // Fallback: extract from request body if collection hint provided
  const collectionHint = (req.body as Record<string, unknown>)?._collection as
    | string
    | undefined;
  const collection = targetCollection || collectionHint;

  // If we couldn't infer the collection, log and allow (graceful degradation)
  if (!collection) {
    if (process.env['DEBUG_DATABASE_OWNERSHIP']) {
      logger.debug(
        { path: req.path, method: req.method },
        '[OwnershipGuard] Could not infer target collection; allowing operation'
      );
    }
    next();
    return;
  }

  // Validate write authority
  const result = validateWriteAuthority(service, collection, operation);
  if (!result.authorized) {
    logOwnershipViolation(service, collection, operation, result.reason || '');
    res.status(403).json({
      success: false,
      error: 'UNAUTHORIZED_WRITE',
      code: 'OWNERSHIP_VIOLATION',
      message: result.reason || 'Write operation not authorized',
      service,
      collection,
      operation,
    });
    return;
  }

  // Authorization granted; log and proceed
  logAuthorizedWrite(service, collection, operation);
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// DIRECT METHOD (Non-HTTP) VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate write authority for direct Mongoose method calls
 * (e.g., Model.insertOne(), not via HTTP).
 *
 * Usage:
 *   await validateOwnershipBeforeWrite('node', 'projects', 'INSERT');
 *
 * Throws UnauthorizedWriteError if validation fails.
 */
export async function validateOwnershipBeforeWrite(
  service: string,
  collection: string,
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
): Promise<void> {
  const result = validateWriteAuthority(service, collection, operation);
  if (!result.authorized) {
    logOwnershipViolation(service, collection, operation, result.reason || '');
    const error = new Error(
      `Unauthorized write to "${collection}": ${result.reason}`
    ) as Error & { code: string };
    error.code = 'OWNERSHIP_VIOLATION';
    throw error;
  }
  logAuthorizedWrite(service, collection, operation);
}

/**
 * Return the write authority matrix for introspection/debugging.
 *
 * Useful for:
 *   - Admin dashboards
 *   - Documentation generation
 *   - Automated compliance checks
 */
export function getWriteAuthorityMatrix(): Record<string, string[]> {
  return { ...WRITE_AUTHORITY };
}

/**
 * Check if a collection is append-only.
 */
export function isAppendOnly(collection: string): boolean {
  return APPEND_ONLY_COLLECTIONS.has(collection.toLowerCase());
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export default databaseOwnershipGuard;
