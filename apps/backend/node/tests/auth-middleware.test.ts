/**
 * Tests for Auth Middleware (authMiddleware.ts)
 *
 * Validates Clerk-based authentication, role checks,
 * error handling, and WebSocket token verification.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// Hoisted mock variables — available inside vi.mock factories
// ---------------------------------------------------------------------------

const {
  mockClerkGetAuth,
  mockClerkMiddlewareFn,
  mockClerkRequireAuthFn,
  mockVerifyToken,
  mockClerkClient,
  mockJwtVerify,
} = vi.hoisted(() => ({
  mockClerkGetAuth: vi.fn(),
  mockClerkMiddlewareFn: vi.fn((_req: any, _res: any, next: any) => next()),
  mockClerkRequireAuthFn: vi.fn((_req: any, _res: any, next: any) => next()),
  mockVerifyToken: vi.fn(),
  mockClerkClient: {
    users: {
      getUser: vi.fn(),
    },
  },
  mockJwtVerify: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

// Mock the logger to suppress output during tests
vi.mock('../src/utils/logger.js', () => ({
  logger: {
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

// Clerk mock — controls what clerkGetAuth / clerkMiddleware / requireAuth return
vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => mockClerkMiddlewareFn,
  requireAuth: () => mockClerkRequireAuthFn,
  getAuth: (req: any) => mockClerkGetAuth(req),
  verifyToken: (...args: any[]) => mockVerifyToken(...args),
  clerkClient: Promise.resolve(mockClerkClient),
}));

// jsonwebtoken mock
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: (...args: any[]) => mockJwtVerify(...args),
  },
}));

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks are set up
// ---------------------------------------------------------------------------

import {
  isUsingClerk,
  authMiddleware,
  requireAuth,
  getAuth,
  getUserId,
  isAuthenticated,
  requireRole,
  handleAuthError,
  verifySocketToken,
} from '../src/middleware/authMiddleware.js';

const originalEnv = {
  USE_CLERK: process.env['USE_CLERK'],
  LOCAL_AUTH_BYPASS: process.env['LOCAL_AUTH_BYPASS'],
  CLERK_SECRET_KEY: process.env['CLERK_SECRET_KEY'],
  NODE_ENV: process.env['NODE_ENV'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockReq(overrides: Record<string, any> = {}): Request {
  return {
    method: 'GET',
    originalUrl: '/test',
    ip: '127.0.0.1',
    headers: {},
    get: vi.fn((header: string) => {
      if (header === 'authorization') return overrides.authorization;
      return undefined;
    }),
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
  return res as Response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  process.env['USE_CLERK'] = 'true';
  process.env['LOCAL_AUTH_BYPASS'] = 'false';
  process.env['NODE_ENV'] = 'test';
  process.env['CLERK_SECRET_KEY'] = 'test_secret';
});

afterEach(() => {
  if (originalEnv.USE_CLERK !== undefined) process.env['USE_CLERK'] = originalEnv.USE_CLERK;
  else delete process.env['USE_CLERK'];
  if (originalEnv.LOCAL_AUTH_BYPASS !== undefined) process.env['LOCAL_AUTH_BYPASS'] = originalEnv.LOCAL_AUTH_BYPASS;
  else delete process.env['LOCAL_AUTH_BYPASS'];
  if (originalEnv.CLERK_SECRET_KEY !== undefined) process.env['CLERK_SECRET_KEY'] = originalEnv.CLERK_SECRET_KEY;
  else delete process.env['CLERK_SECRET_KEY'];
  if (originalEnv.NODE_ENV !== undefined) process.env['NODE_ENV'] = originalEnv.NODE_ENV;
  else delete process.env['NODE_ENV'];
});

// ==========================================
// 1. isUsingClerk
// ==========================================
describe('isUsingClerk', () => {
  const originalEnv = process.env['USE_CLERK'];

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env['USE_CLERK'] = originalEnv;
    } else {
      delete process.env['USE_CLERK'];
    }
  });

  it('returns true when USE_CLERK is "true"', () => {
    process.env['USE_CLERK'] = 'true';
    expect(isUsingClerk()).toBe(true);
  });

  it('returns false when USE_CLERK is not set', () => {
    delete process.env['USE_CLERK'];
    expect(isUsingClerk()).toBe(false);
  });

  it('returns false when USE_CLERK is any value other than "true"', () => {
    process.env['USE_CLERK'] = 'false';
    expect(isUsingClerk()).toBe(false);
  });
});

// ==========================================
// 2. authMiddleware (Clerk middleware wrapper)
// ==========================================
describe('authMiddleware', () => {
  it('calls through to clerkMiddleware and invokes next()', () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    (authMiddleware as any)(req, res, next);

    expect(mockClerkMiddlewareFn).toHaveBeenCalledWith(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

// ==========================================
// 3. requireAuth
// ==========================================
describe('requireAuth', () => {
  it('returns a middleware that delegates to clerkRequireAuth', () => {
    const middleware = requireAuth();
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    (middleware as any)(req, res, next);

    expect(mockClerkRequireAuthFn).toHaveBeenCalledWith(req, res, next);
  });
});

// ==========================================
// 4. getAuth — extract auth info from request
// ==========================================
describe('getAuth', () => {
  it('returns userId and sessionId from Clerk auth', () => {
    mockClerkGetAuth.mockReturnValue({
      userId: 'user_abc123',
      sessionId: 'sess_xyz789',
    });

    const req = mockReq();
    const result = getAuth(req);

    expect(result.userId).toBe('user_abc123');
    expect(result.sessionId).toBe('sess_xyz789');
    expect(result.email).toBeNull(); // email requires a separate API call
  });

  it('returns null userId when user is not authenticated', () => {
    mockClerkGetAuth.mockReturnValue({ userId: null, sessionId: null });

    const result = getAuth(mockReq());

    expect(result.userId).toBeNull();
    expect(result.sessionId).toBeNull();
  });

  it('handles missing fields gracefully (defaults to null)', () => {
    mockClerkGetAuth.mockReturnValue({});

    const result = getAuth(mockReq());

    expect(result.userId).toBeNull();
    expect(result.sessionId).toBeNull();
  });
});

// ==========================================
// 5. getUserId — convenience helper
// ==========================================
describe('getUserId', () => {
  it('returns the userId string when authenticated', () => {
    mockClerkGetAuth.mockReturnValue({ userId: 'user_42' });

    expect(getUserId(mockReq())).toBe('user_42');
  });

  it('returns null when not authenticated', () => {
    mockClerkGetAuth.mockReturnValue({ userId: null });

    expect(getUserId(mockReq())).toBeNull();
  });
});

// ==========================================
// 6. isAuthenticated
// ==========================================
describe('isAuthenticated', () => {
  it('returns true when userId is present', () => {
    mockClerkGetAuth.mockReturnValue({ userId: 'user_1' });

    expect(isAuthenticated(mockReq())).toBe(true);
  });

  it('returns false when userId is null', () => {
    mockClerkGetAuth.mockReturnValue({ userId: null });

    expect(isAuthenticated(mockReq())).toBe(false);
  });

  it('returns false when userId is undefined', () => {
    mockClerkGetAuth.mockReturnValue({});

    expect(isAuthenticated(mockReq())).toBe(false);
  });
});

// ==========================================
// 7. requireRole — RBAC middleware
// ==========================================
describe('requireRole', () => {
  it('responds 401 when user is not authenticated', async () => {
    mockClerkGetAuth.mockReturnValue({ userId: null });

    const middleware = requireRole(['admin']);
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: 'Authentication required' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when user has the required role', async () => {
    mockClerkGetAuth.mockReturnValue({ userId: 'user_admin' });
    mockClerkClient.users.getUser.mockResolvedValue({
      publicMetadata: { role: 'admin' },
    });

    const middleware = requireRole(['admin']);
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('responds 403 when user lacks the required role', async () => {
    mockClerkGetAuth.mockReturnValue({ userId: 'user_basic' });
    mockClerkClient.users.getUser.mockResolvedValue({
      publicMetadata: { role: 'user' },
    });

    const middleware = requireRole(['admin', 'editor']);
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining('Insufficient permissions'),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('defaults to "user" role when publicMetadata has no role', async () => {
    mockClerkGetAuth.mockReturnValue({ userId: 'user_norole' });
    mockClerkClient.users.getUser.mockResolvedValue({
      publicMetadata: {},
    });

    const middleware = requireRole(['user']);
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    // "user" is the default role, and it's in the allowed list
    expect(next).toHaveBeenCalled();
  });

  it('responds 403 when Clerk user lookup throws (fail closed)', async () => {
    mockClerkGetAuth.mockReturnValue({ userId: 'user_err' });
    mockClerkClient.users.getUser.mockRejectedValue(new Error('Clerk API down'));

    const middleware = requireRole(['admin']);
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Unable to verify permissions' }),
    );
    expect(next).not.toHaveBeenCalled();
  });
});

// ==========================================
// 8. handleAuthError — error handler
// ==========================================
describe('handleAuthError', () => {
  it('responds 401 for ClerkError', () => {
    const err = new Error('token expired');
    err.name = 'ClerkError';
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    handleAuthError(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: 'Authentication failed' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 when error message contains "Unauthenticated"', () => {
    const err = new Error('Unauthenticated request');
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    handleAuthError(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes non-auth errors to next()', () => {
    const err = new Error('Something else broke');
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    handleAuthError(err, req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(err);
  });

  it('includes the original error message in the 401 response', () => {
    const err = new Error('Unauthenticated — session expired');
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    handleAuthError(err, req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Unauthenticated — session expired',
      }),
    );
  });
});

// ==========================================
// 9. verifySocketToken — WebSocket auth
// ==========================================
describe('verifySocketToken', () => {
  const originalSecret = process.env['JWT_SECRET'];
  const originalClerkKey = process.env['CLERK_SECRET_KEY'];

  beforeEach(() => {
    process.env['JWT_SECRET'] = 'test-jwt-secret';
    process.env['CLERK_SECRET_KEY'] = 'sk_test_clerk';
  });

  afterEach(() => {
    if (originalSecret !== undefined) process.env['JWT_SECRET'] = originalSecret;
    else delete process.env['JWT_SECRET'];
    if (originalClerkKey !== undefined) process.env['CLERK_SECRET_KEY'] = originalClerkKey;
    else delete process.env['CLERK_SECRET_KEY'];
  });

  it('returns null for empty token', async () => {
    const result = await verifySocketToken('');
    expect(result).toBeNull();
  });

  it('returns userId when Clerk verifyToken succeeds', async () => {
    mockVerifyToken.mockResolvedValue({ sub: 'user_clerk_001' });

    const result = await verifySocketToken('valid-clerk-token');

    expect(result).toEqual({ userId: 'user_clerk_001', sub: 'user_clerk_001' });
    expect(mockVerifyToken).toHaveBeenCalledWith('valid-clerk-token', {
      secretKey: 'sk_test_clerk',
    });
  });

  it('falls back to JWT verification when Clerk fails', async () => {
    mockVerifyToken.mockRejectedValue(new Error('Clerk: invalid token'));
    mockJwtVerify.mockReturnValue({ userId: 'user_jwt_001' });

    const result = await verifySocketToken('jwt-token');

    expect(result).toEqual({ userId: 'user_jwt_001', sub: 'user_jwt_001' });
    expect(mockJwtVerify).toHaveBeenCalledWith('jwt-token', 'test-jwt-secret');
  });

  it('handles JWT token with "sub" claim instead of "userId"', async () => {
    mockVerifyToken.mockRejectedValue(new Error('Clerk fail'));
    mockJwtVerify.mockReturnValue({ sub: 'user_sub_002' });

    const result = await verifySocketToken('jwt-token-sub');

    expect(result).toEqual({ userId: 'user_sub_002', sub: 'user_sub_002' });
  });

  it('handles JWT token with "id" claim', async () => {
    mockVerifyToken.mockRejectedValue(new Error('Clerk fail'));
    mockJwtVerify.mockReturnValue({ id: 'user_id_003' });

    const result = await verifySocketToken('jwt-token-id');

    expect(result).toEqual({ userId: 'user_id_003', sub: 'user_id_003' });
  });

  it('returns null when both Clerk and JWT verification fail', async () => {
    mockVerifyToken.mockRejectedValue(new Error('Clerk fail'));
    mockJwtVerify.mockImplementation(() => { throw new Error('JWT fail'); });

    const result = await verifySocketToken('bad-token');

    expect(result).toBeNull();
  });

  it('returns null when Clerk fails and no JWT_SECRET is set', async () => {
    delete process.env['JWT_SECRET'];
    mockVerifyToken.mockRejectedValue(new Error('Clerk fail'));

    const result = await verifySocketToken('some-token');

    expect(result).toBeNull();
  });

  it('returns null when Clerk verifyToken returns payload without sub', async () => {
    mockVerifyToken.mockResolvedValue({ iss: 'clerk', aud: 'api' });

    const result = await verifySocketToken('no-sub-token');

    expect(result).toBeNull();
  });
});
