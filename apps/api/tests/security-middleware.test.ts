/**
 * Tests for Security Middleware
 *
 * Validates rate limiting configuration, request ID generation,
 * and error handler behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock the logger before importing modules that use it
vi.mock('../src/utils/logger.js', () => ({
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

import {
  requestIdMiddleware,
  requestLoggerWithId,
  secureErrorHandler,
} from '../src/middleware/security.js';

function mockReq(overrides: Record<string, any> = {}): Request {
  return {
    method: 'GET',
    originalUrl: '/test',
    ip: '127.0.0.1',
    get: vi.fn((header: string) => {
      if (header === 'user-agent') return 'test-agent';
      if (header === 'x-request-id') return overrides.requestId;
      if (header === 'origin') return overrides.origin;
      return undefined;
    }),
    socket: { remoteAddress: '127.0.0.1' },
    path: '/test',
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  const res: any = {
    locals: {},
  };
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  res.statusCode = 200;
  return res as Response;
}

describe('requestIdMiddleware', () => {
  it('generates a UUID request ID when none provided', () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    requestIdMiddleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', expect.stringMatching(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    ));
    expect(res.locals.requestId).toBeDefined();
    expect(next).toHaveBeenCalled();
  });

  it('uses existing valid x-request-id header', () => {
    const existingId = '12345678-1234-1234-1234-123456789abc';
    const req = mockReq({ requestId: existingId });
    const res = mockRes();
    const next = vi.fn();

    requestIdMiddleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', existingId);
    expect(res.locals.requestId).toBe(existingId);
  });

  it('rejects invalid x-request-id and generates new one', () => {
    const req = mockReq({ requestId: 'not-a-uuid' });
    const res = mockRes();
    const next = vi.fn();

    requestIdMiddleware(req, res, next);

    // Should generate new UUID, not use the invalid one
    expect(res.locals.requestId).not.toBe('not-a-uuid');
    expect(res.locals.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });
});

describe('secureErrorHandler', () => {
  it('returns 500 with generic message in production', () => {
    const originalEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';

    const err = new Error('Database connection string exposed');
    const req = mockReq();
    const res = mockRes();
    res.statusCode = 200; // Will be overridden
    const next = vi.fn();

    secureErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'An unexpected error occurred. Please try again later.', // Never exposes actual error in production
      })
    );
    // Should NOT contain the actual error message or stack
    const jsonArg = (res.json as any).mock.calls[0][0];
    expect(jsonArg.error).not.toContain('Database');
    expect(jsonArg.stack).toBeUndefined();

    process.env['NODE_ENV'] = originalEnv;
  });

  it('returns detailed error in development', () => {
    const originalEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'development';

    const err = new Error('Test error');
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    secureErrorHandler(err, req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Test error',
      })
    );
    const jsonArg = (res.json as any).mock.calls[0][0];
    expect(jsonArg.stack).toBeDefined();

    process.env['NODE_ENV'] = originalEnv;
  });

  it('uses custom statusCode from error', () => {
    const err: any = new Error('Not found');
    err.statusCode = 404;
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    secureErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('includes requestId in error response', () => {
    const req = mockReq();
    const res = mockRes();
    res.locals.requestId = 'test-req-id';
    const next = vi.fn();

    secureErrorHandler(new Error('test'), req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'test-req-id',
      })
    );
  });
});
