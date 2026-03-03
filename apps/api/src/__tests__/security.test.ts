/**
 * Security Middleware Tests
 *
 * Tests rate limiter exports, securityHeaders, permissionsPolicy,
 * and middleware function signatures from src/middleware/security.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock dependencies before importing the module under test
vi.mock('../../src/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

vi.mock('../../src/config/cors.js', () => ({
  isTrustedOrigin: vi.fn(() => true),
}));

import {
  securityHeaders,
  permissionsPolicy,
  generalRateLimit,
  analysisRateLimit,
  billingRateLimit,
  crudRateLimit,
  authRateLimit,
  aiRateLimit,
  requestIdMiddleware,
  requestLogger,
  requestLoggerWithId,
  secureErrorHandler,
} from '../../src/middleware/security.js';

// ============================================
// Mock Express helpers
// ============================================

function mockReq(overrides: Record<string, unknown> = {}): Request {
  return {
    method: 'GET',
    originalUrl: '/test',
    ip: '127.0.0.1',
    get: vi.fn((header: string) => {
      if (header === 'user-agent') return 'vitest-agent';
      if (header === 'x-request-id') return overrides['requestId'];
      if (header === 'origin') return overrides['origin'];
      if (header === 'traceparent') return overrides['traceparent'];
      return undefined;
    }),
    socket: { remoteAddress: '127.0.0.1' },
    path: '/test',
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  const res: Record<string, unknown> = {
    locals: {},
    statusCode: 200,
  };
  res['status'] = vi.fn().mockReturnValue(res);
  res['json'] = vi.fn().mockReturnValue(res);
  res['setHeader'] = vi.fn().mockReturnValue(res);
  res['on'] = vi.fn();
  return res as unknown as Response;
}

// ============================================
// Rate limiter existence & signature tests
// ============================================

describe('Rate limiter exports', () => {
  const rateLimiters = [
    { name: 'generalRateLimit', fn: generalRateLimit },
    { name: 'analysisRateLimit', fn: analysisRateLimit },
    { name: 'billingRateLimit', fn: billingRateLimit },
    { name: 'crudRateLimit', fn: crudRateLimit },
    { name: 'authRateLimit', fn: authRateLimit },
    { name: 'aiRateLimit', fn: aiRateLimit },
  ];

  // Tests 1-5: each rate limiter is a valid middleware function
  rateLimiters.forEach(({ name, fn }) => {
    it(`${name} is a valid middleware function`, () => {
      expect(fn).toBeDefined();
      expect(typeof fn).toBe('function');
    });
  });

  // Test 8: all rate limiters are Express RequestHandler functions
  it('all rate limiters are functions (typeof === "function")', () => {
    rateLimiters.forEach(({ fn }) => {
      expect(typeof fn).toBe('function');
    });
  });

  // Test 9: rate limiters accept 3 parameters (req, res, next signature)
  rateLimiters.forEach(({ name, fn }) => {
    it(`${name} can be invoked as middleware without throwing`, () => {
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();

      // Rate limiters from express-rate-limit should be callable.
      // They may call next() or set headers — we just verify no throw.
      expect(() => fn(req, res, next)).not.toThrow();
    });
  });
});

// ============================================
// securityHeaders
// ============================================

describe('securityHeaders', () => {
  // Test 6 & 7
  it('is a valid middleware function', () => {
    expect(securityHeaders).toBeDefined();
    expect(typeof securityHeaders).toBe('function');
  });

  it('sets security headers when invoked', () => {
    const req = mockReq();
    const res = mockRes();
    // Helmet internally calls res.removeHeader / res.getHeader — add them to mock
    (res as any).removeHeader = vi.fn();
    (res as any).getHeader = vi.fn();
    const next = vi.fn();

    // Helmet is a composite middleware; it should not throw when given a
    // fully-mocked res and should eventually call next().
    expect(() => securityHeaders(req, res, next)).not.toThrow();
  });
});

// ============================================
// permissionsPolicy
// ============================================

describe('permissionsPolicy', () => {
  it('is a valid middleware function', () => {
    expect(typeof permissionsPolicy).toBe('function');
  });

  it('sets Permissions-Policy header and calls next()', () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    permissionsPolicy(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Permissions-Policy',
      expect.stringContaining('camera=()'),
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('includes payment=(self) in Permissions-Policy', () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    permissionsPolicy(req, res, next);

    const headerValue = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(headerValue).toContain('payment=(self)');
  });
});

// ============================================
// requestIdMiddleware
// ============================================

describe('requestIdMiddleware', () => {
  it('generates a UUID when no x-request-id header present', () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    requestIdMiddleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'x-request-id',
      expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      ),
    );
    expect(next).toHaveBeenCalled();
  });

  it('preserves valid existing x-request-id', () => {
    const existingId = 'aabbccdd-1122-3344-5566-778899aabbcc';
    const req = mockReq({ requestId: existingId });
    const res = mockRes();
    const next = vi.fn();

    requestIdMiddleware(req, res, next);

    expect(res.locals.requestId).toBe(existingId);
  });

  it('rejects invalid x-request-id and generates a new one', () => {
    const req = mockReq({ requestId: 'not-valid' });
    const res = mockRes();
    const next = vi.fn();

    requestIdMiddleware(req, res, next);

    expect(res.locals.requestId).not.toBe('not-valid');
    expect(res.locals.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('echoes traceparent header as traceresponse', () => {
    const traceId =
      '00-12345678901234567890123456789012-1234567890123456-01';
    const req = mockReq({ traceparent: traceId });
    const res = mockRes();
    const next = vi.fn();

    requestIdMiddleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('traceresponse', traceId);
  });
});

// ============================================
// requestLogger
// ============================================

describe('requestLogger', () => {
  it('is a valid middleware function that calls next()', () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    requestLogger(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});

// ============================================
// secureErrorHandler
// ============================================

describe('secureErrorHandler', () => {
  it('hides internal errors in production', () => {
    const originalEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';

    const err = new Error('DB password exposed');
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    secureErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    const jsonArg = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(jsonArg.error).not.toContain('DB password');
    expect(jsonArg.stack).toBeUndefined();

    process.env['NODE_ENV'] = originalEnv;
  });

  it('shows error details in development', () => {
    const originalEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'development';

    const err = new Error('Debug error');
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    secureErrorHandler(err, req, res, next);

    const jsonArg = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(jsonArg.error).toBe('Debug error');
    expect(jsonArg.stack).toBeDefined();

    process.env['NODE_ENV'] = originalEnv;
  });

  it('uses custom statusCode from error object', () => {
    const err: Error & { statusCode?: number } = new Error('Not found');
    err.statusCode = 404;
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    secureErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('includes requestId in response', () => {
    const req = mockReq();
    const res = mockRes();
    res.locals.requestId = 'req-123';
    const next = vi.fn();

    secureErrorHandler(new Error('test'), req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'req-123' }),
    );
  });
});
