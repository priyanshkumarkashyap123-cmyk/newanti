/**
 * ============================================================================
 * SECURITY MIDDLEWARE - PHASE 1 ENHANCEMENTS
 * ============================================================================
 * 
 * Adds security controls to calculation endpoints:
 * - Rate limiting (per user / per IP)
 * - Audit logging for all calculations
 * - Input validation & sanitization
 * - Request throttling
 * 
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import { getErrorMessage } from '../../lib/errorHandling';

// ============================================================================
// RATE LIMITER
// ============================================================================

interface RateLimitConfig {
  windowMs: number;           // Time window in milliseconds
  maxRequests: number;        // Max requests per window
  keyGenerator?: (request: any) => string;
  skipList?: string[];        // User IDs or IPs to skip
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore: Map<string, RateLimitEntry> = new Map();

export class RateLimiter {
  private config: Required<RateLimitConfig>;

  constructor(config: RateLimitConfig) {
    this.config = {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      keyGenerator: config.keyGenerator || ((req) => req.userId || req.ip || 'anonymous'),
      skipList: config.skipList || [],
    };
  }

  check(request: { userId?: string; ip?: string; [key: string]: any }): RateLimitResult {
    const key = this.config.keyGenerator(request);
    
    // Skip for allowlisted users
    if (this.config.skipList.includes(key)) {
      return { allowed: true, remaining: this.config.maxRequests, resetAt: 0 };
    }

    const now = Date.now();
    const entry = rateLimitStore.get(key);

    // New entry or expired window
    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(key, {
        count: 1,
        resetAt: now + this.config.windowMs,
      });
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetAt: now + this.config.windowMs,
      };
    }

    // Within window - increment
    if (entry.count < this.config.maxRequests) {
      entry.count++;
      return {
        allowed: true,
        remaining: this.config.maxRequests - entry.count,
        resetAt: entry.resetAt,
      };
    }

    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetAt) {
        rateLimitStore.delete(key);
      }
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

// Default rate limiters for different tiers
export const RateLimiters = {
  // Free tier: 100 calculations per hour
  free: new RateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: 100,
  }),
  
  // Pro tier: 1000 calculations per hour
  pro: new RateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: 1000,
  }),
  
  // Enterprise: 10000 calculations per hour
  enterprise: new RateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: 10000,
  }),
  
  // Burst protection: 10 requests per second
  burst: new RateLimiter({
    windowMs: 1000,
    maxRequests: 10,
  }),
};

// ============================================================================
// AUDIT LOGGER
// ============================================================================

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string | null;
  sessionId: string | null;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  inputs: Record<string, any>;
  outputs?: {
    status: 'success' | 'failure' | 'error';
    summary?: string;
  };
  metadata: {
    ip?: string;
    userAgent?: string;
    calculationType?: string;
    designCode?: string;
    executionTimeMs?: number;
  };
}

export type AuditAction =
  | 'CALCULATION_STARTED'
  | 'CALCULATION_COMPLETED'
  | 'CALCULATION_FAILED'
  | 'REPORT_GENERATED'
  | 'MODEL_IMPORTED'
  | 'MODEL_EXPORTED'
  | 'SETTINGS_CHANGED'
  | 'LOGIN'
  | 'LOGOUT';

class AuditLogger {
  private logs: AuditLogEntry[] = [];
  private maxLogs: number = 10000;
  private persistCallback?: (entry: AuditLogEntry) => void;

  constructor(persistCallback?: (entry: AuditLogEntry) => void) {
    this.persistCallback = persistCallback;
  }

  log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    const fullEntry: AuditLogEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      ...entry,
    };

    // Store in memory
    this.logs.push(fullEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Persist if callback provided
    if (this.persistCallback) {
      try {
        this.persistCallback(fullEntry);
      } catch (e) {
        console.error('Failed to persist audit log:', e);
      }
    }

    return fullEntry;
  }

  query(filter: Partial<{
    userId: string;
    action: AuditAction;
    resource: string;
    startTime: string;
    endTime: string;
  }>, limit: number = 100): AuditLogEntry[] {
    return this.logs
      .filter((log) => {
        if (filter.userId && log.userId !== filter.userId) return false;
        if (filter.action && log.action !== filter.action) return false;
        if (filter.resource && log.resource !== filter.resource) return false;
        if (filter.startTime && log.timestamp < filter.startTime) return false;
        if (filter.endTime && log.timestamp > filter.endTime) return false;
        return true;
      })
      .slice(-limit);
  }

  getRecentLogs(count: number = 50): AuditLogEntry[] {
    return this.logs.slice(-count);
  }
}

// Singleton audit logger instance
export const auditLogger = new AuditLogger();

// ============================================================================
// INPUT VALIDATION & SANITIZATION
// ============================================================================

export interface ValidationRule<T = any> {
  type: 'number' | 'string' | 'boolean' | 'object' | 'array';
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: T[];
  validator?: (value: T) => boolean;
  message?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: { field: string; message: string }[];
}

export function validateInputs(
  inputs: Record<string, any>,
  rules: Record<string, ValidationRule>
): ValidationResult {
  const errors: { field: string; message: string }[] = [];

  for (const [field, rule] of Object.entries(rules)) {
    const value = inputs[field];

    // Required check
    if (rule.required && (value === undefined || value === null)) {
      errors.push({ field, message: rule.message || `${field} is required` });
      continue;
    }

    if (value === undefined || value === null) continue;

    // Type check
    if (rule.type === 'number' && typeof value !== 'number') {
      errors.push({ field, message: `${field} must be a number` });
      continue;
    }
    if (rule.type === 'string' && typeof value !== 'string') {
      errors.push({ field, message: `${field} must be a string` });
      continue;
    }
    if (rule.type === 'boolean' && typeof value !== 'boolean') {
      errors.push({ field, message: `${field} must be a boolean` });
      continue;
    }
    if (rule.type === 'array' && !Array.isArray(value)) {
      errors.push({ field, message: `${field} must be an array` });
      continue;
    }
    if (rule.type === 'object' && (typeof value !== 'object' || Array.isArray(value))) {
      errors.push({ field, message: `${field} must be an object` });
      continue;
    }

    // Range check for numbers
    if (rule.type === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        errors.push({ field, message: `${field} must be >= ${rule.min}` });
      }
      if (rule.max !== undefined && value > rule.max) {
        errors.push({ field, message: `${field} must be <= ${rule.max}` });
      }
    }

    // Length check for strings/arrays
    if (rule.type === 'string' || rule.type === 'array') {
      if (rule.min !== undefined && value.length < rule.min) {
        errors.push({ field, message: `${field} must have length >= ${rule.min}` });
      }
      if (rule.max !== undefined && value.length > rule.max) {
        errors.push({ field, message: `${field} must have length <= ${rule.max}` });
      }
    }

    // Pattern check for strings
    if (rule.type === 'string' && rule.pattern && !rule.pattern.test(value)) {
      errors.push({ field, message: rule.message || `${field} has invalid format` });
    }

    // Enum check
    if (rule.enum && !rule.enum.includes(value)) {
      errors.push({ field, message: `${field} must be one of: ${rule.enum.join(', ')}` });
    }

    // Custom validator
    if (rule.validator && !rule.validator(value)) {
      errors.push({ field, message: rule.message || `${field} failed validation` });
    }
  }

  return { valid: errors.length === 0, errors };
}

// Common validation schemas for structural calculations
export const ValidationSchemas = {
  beamAnalysis: {
    length: { type: 'number', required: true, min: 0.01, max: 100 } as ValidationRule,
    width: { type: 'number', required: true, min: 0.01, max: 10 } as ValidationRule,
    depth: { type: 'number', required: true, min: 0.01, max: 10 } as ValidationRule,
    load: { type: 'number', required: true, min: 0, max: 10000 } as ValidationRule,
    material: { type: 'string', required: true, enum: ['steel', 'concrete', 'timber', 'composite'] } as ValidationRule,
  },

  seismicAnalysis: {
    Z: { type: 'number', required: true, min: 0.1, max: 0.5 } as ValidationRule,
    I: { type: 'number', required: true, min: 1.0, max: 2.0 } as ValidationRule,
    R: { type: 'number', required: true, min: 1.5, max: 8.0 } as ValidationRule,
    Sa: { type: 'number', required: true, min: 0, max: 5.0 } as ValidationRule,
    weight: { type: 'number', required: true, min: 0 } as ValidationRule,
    designCode: { type: 'string', required: true, enum: ['IS1893', 'ASCE7', 'EN1998'] } as ValidationRule,
  },
};

// ============================================================================
// CALCULATION WRAPPER WITH SECURITY
// ============================================================================

export interface SecureCalculationOptions {
  userId?: string;
  sessionId?: string;
  tier?: 'free' | 'pro' | 'enterprise';
  ip?: string;
  userAgent?: string;
}

export async function secureCalculation<TInput, TOutput>(
  calculationType: string,
  inputs: TInput,
  validationRules: Record<string, ValidationRule>,
  calculator: (inputs: TInput) => TOutput | Promise<TOutput>,
  options: SecureCalculationOptions = {}
): Promise<{ success: true; result: TOutput } | { success: false; error: string }> {
  const startTime = Date.now();
  const tier = options.tier || 'free';

  // Rate limit check
  const burstCheck = RateLimiters.burst.check({ userId: options.userId, ip: options.ip });
  if (!burstCheck.allowed) {
    auditLogger.log({
      userId: options.userId || null,
      sessionId: options.sessionId || null,
      action: 'CALCULATION_FAILED',
      resource: calculationType,
      inputs: { ...inputs as any },
      outputs: { status: 'failure', summary: 'Rate limit exceeded (burst)' },
      metadata: { ip: options.ip, userAgent: options.userAgent, calculationType },
    });
    return { success: false, error: `Rate limit exceeded. Retry after ${burstCheck.retryAfter}s` };
  }

  const tierCheck = RateLimiters[tier].check({ userId: options.userId, ip: options.ip });
  if (!tierCheck.allowed) {
    auditLogger.log({
      userId: options.userId || null,
      sessionId: options.sessionId || null,
      action: 'CALCULATION_FAILED',
      resource: calculationType,
      inputs: { ...inputs as any },
      outputs: { status: 'failure', summary: 'Rate limit exceeded (tier)' },
      metadata: { ip: options.ip, userAgent: options.userAgent, calculationType },
    });
    return { success: false, error: `Hourly limit exceeded. Retry after ${tierCheck.retryAfter}s or upgrade plan.` };
  }

  // Input validation
  const validation = validateInputs(inputs as any, validationRules);
  if (!validation.valid) {
    auditLogger.log({
      userId: options.userId || null,
      sessionId: options.sessionId || null,
      action: 'CALCULATION_FAILED',
      resource: calculationType,
      inputs: { ...inputs as any },
      outputs: { status: 'failure', summary: `Validation failed: ${validation.errors.map(e => e.message).join(', ')}` },
      metadata: { ip: options.ip, userAgent: options.userAgent, calculationType },
    });
    return { success: false, error: validation.errors.map(e => e.message).join('; ') };
  }

  // Log start
  auditLogger.log({
    userId: options.userId || null,
    sessionId: options.sessionId || null,
    action: 'CALCULATION_STARTED',
    resource: calculationType,
    inputs: { ...inputs as any },
    metadata: { ip: options.ip, userAgent: options.userAgent, calculationType },
  });

  // Execute calculation
  try {
    const result = await calculator(inputs);
    const executionTimeMs = Date.now() - startTime;

    // Log success
    auditLogger.log({
      userId: options.userId || null,
      sessionId: options.sessionId || null,
      action: 'CALCULATION_COMPLETED',
      resource: calculationType,
      inputs: { ...inputs as any },
      outputs: { status: 'success' },
      metadata: { ip: options.ip, userAgent: options.userAgent, calculationType, executionTimeMs },
    });

    return { success: true, result };
  } catch (error: unknown) {
    const executionTimeMs = Date.now() - startTime;

    // Log failure
    auditLogger.log({
      userId: options.userId || null,
      sessionId: options.sessionId || null,
      action: 'CALCULATION_FAILED',
      resource: calculationType,
      inputs: { ...inputs as any },
      outputs: { status: 'error', summary: getErrorMessage(error, 'Calculation failed') },
      metadata: { ip: options.ip, userAgent: options.userAgent, calculationType, executionTimeMs },
    });

    return { success: false, error: getErrorMessage(error, 'Calculation failed') };
  }
}

// ============================================================================
// REQUEST THROTTLER (for UI debouncing)
// ============================================================================

export function createThrottler(delayMs: number): <T extends (...args: any[]) => any>(fn: T) => T {
  let lastCall = 0;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return <T extends (...args: any[]) => any>(fn: T): T => {
    return ((...args: any[]) => {
      const now = Date.now();
      const remaining = delayMs - (now - lastCall);

      if (remaining <= 0) {
        lastCall = now;
        return fn(...args);
      } else {
        if (timeout) clearTimeout(timeout);
        return new Promise((resolve) => {
          timeout = setTimeout(() => {
            lastCall = Date.now();
            resolve(fn(...args));
          }, remaining);
        });
      }
    }) as T;
  };
}
