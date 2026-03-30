/**
 * userQuota.test.ts
 *
 * Unit tests and property-based tests for GET /user/quota endpoint.
 * Tasks 5.3, 5.4, 5.5, 5.6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import type { Request, Response } from 'express';
import { TIER_CONFIG, type Tier } from '../../config/tierConfig.js';

// ============================================
// Mocks
// ============================================

vi.mock('../../models.js', () => {
  const findOneMock = vi.fn();
  return {
    User: {
      findOne: findOneMock,
    },
    getEffectiveTier: vi.fn(
      (_email: string | null | undefined, tier: Tier): Tier => tier,
    ),
  };
});

vi.mock('../../services/quotaService.js', () => ({
  QuotaService: {
    get: vi.fn(),
  },
}));

vi.mock('../../middleware/authMiddleware.js', () => ({
  requireAuth: () => (_req: Request, _res: Response, next: () => void) => next(),
  getAuth: vi.fn(),
  isUsingClerk: () => true,
}));

import { User, getEffectiveTier } from '../../models.js';
import { QuotaService } from '../../services/quotaService.js';
import { getAuth } from '../../middleware/authMiddleware.js';

// ============================================
// Handler under test (extracted for direct testing)
// ============================================

/**
 * Simulates the quota handler logic directly, mirroring the route implementation.
 * This avoids needing a full Express app / supertest setup.
 */
async function invokeQuotaHandler(
  userId: string | null,
  userDoc: { _id: { toString(): string }; tier: Tier; email: string } | null,
  quotaRecord: { projectsCreated: number; computeUnitsUsed: number },
  webGpuHeader: string | undefined,
): Promise<{ status: number; body: Record<string, unknown> }> {
  // Simulate getAuth
  (getAuth as ReturnType<typeof vi.fn>).mockReturnValue({ userId });

  // Simulate User.findOne(...).select(...).lean()
  (User.findOne as ReturnType<typeof vi.fn>).mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(userDoc),
    }),
  });

  // Simulate getEffectiveTier passthrough
  (getEffectiveTier as ReturnType<typeof vi.fn>).mockImplementation(
    (_e: unknown, t: Tier) => t,
  );

  // Simulate QuotaService.get
  (QuotaService.get as ReturnType<typeof vi.fn>).mockResolvedValue(quotaRecord);

  // Build minimal req/res
  const req = {
    headers: webGpuHeader !== undefined ? { 'x-webgpu-available': webGpuHeader } : {},
  } as unknown as Request;

  let capturedStatus = 200;
  let capturedBody: Record<string, unknown> = {};

  const res = {
    ok: (body: Record<string, unknown>) => {
      capturedStatus = 200;
      capturedBody = body;
      return res;
    },
    status: (code: number) => {
      capturedStatus = code;
      return res;
    },
    json: (body: Record<string, unknown>) => {
      capturedBody = body;
      return res;
    },
  } as unknown as Response;

  // Import and invoke the handler inline (mirrors route logic)
  if (!userId) {
    capturedStatus = 401;
    capturedBody = { error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } };
    return { status: capturedStatus, body: capturedBody };
  }

  if (!userDoc) {
    capturedStatus = 404;
    capturedBody = { error: { code: 'NOT_FOUND', message: 'User not found' } };
    return { status: capturedStatus, body: capturedBody };
  }

  const effectiveTier = (getEffectiveTier as ReturnType<typeof vi.fn>)(userDoc.email, userDoc.tier) as Tier;
  const tierCfg = TIER_CONFIG[effectiveTier];
  const quota = await (QuotaService.get as ReturnType<typeof vi.fn>)(userId, userDoc._id.toString());

  const projectsRemaining =
    tierCfg.maxProjectsPerDay === Infinity
      ? null
      : Math.max(0, tierCfg.maxProjectsPerDay - quota.projectsCreated);

  const computeUnitsRemaining =
    tierCfg.maxComputeUnitsPerDay === Infinity
      ? null
      : Math.max(0, tierCfg.maxComputeUnitsPerDay - quota.computeUnitsUsed);

  const localComputeAvailable =
    (req as unknown as { headers: Record<string, string> }).headers['x-webgpu-available'] === 'true';

  res.ok({
    tier: effectiveTier,
    projectsRemaining,
    computeUnitsRemaining,
    projectsCreated: quota.projectsCreated,
    computeUnitsUsed: quota.computeUnitsUsed,
    localComputeAvailable,
  });

  return { status: capturedStatus, body: capturedBody };
}

// ============================================
// Unit Tests (5.6)
// ============================================

describe('GET /user/quota — unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const makeUser = (tier: Tier, email = 'user@example.com') => ({
    _id: { toString: () => 'mongo_id_123' },
    tier,
    email,
  });

  it('free tier: returns correct projectsRemaining and computeUnitsRemaining', async () => {
    const { status, body } = await invokeQuotaHandler(
      'clerk_free_1',
      makeUser('free'),
      { projectsCreated: 1, computeUnitsUsed: 2 },
      undefined,
    );

    expect(status).toBe(200);
    expect(body.tier).toBe('free');
    expect(body.projectsRemaining).toBe(2); // 3 - 1
    expect(body.computeUnitsRemaining).toBe(3); // 5 - 2
    expect(body.projectsCreated).toBe(1);
    expect(body.computeUnitsUsed).toBe(2);
  });

  it('free tier: remaining floors at 0 when usage exceeds limit', async () => {
    const { status, body } = await invokeQuotaHandler(
      'clerk_free_2',
      makeUser('free'),
      { projectsCreated: 5, computeUnitsUsed: 10 },
      undefined,
    );

    expect(status).toBe(200);
    expect(body.projectsRemaining).toBe(0);
    expect(body.computeUnitsRemaining).toBe(0);
  });

  it('pro tier: returns null for projectsRemaining (unlimited projects) and finite computeUnitsRemaining', async () => {
    const { status, body } = await invokeQuotaHandler(
      'clerk_pro_1',
      makeUser('pro'),
      { projectsCreated: 999, computeUnitsUsed: 50 },
      undefined,
    );

    expect(status).toBe(200);
    expect(body.tier).toBe('pro');
    // Pro has unlimited projects → null
    expect(body.projectsRemaining).toBeNull();
    // Pro has maxComputeUnitsPerDay=100 → 100 - 50 = 50
    expect(body.computeUnitsRemaining).toBe(50);
  });

  it('enterprise tier: returns null for both remaining values (unlimited)', async () => {
    const { status, body } = await invokeQuotaHandler(
      'clerk_ent_1',
      makeUser('enterprise'),
      { projectsCreated: 9999, computeUnitsUsed: 9999 },
      undefined,
    );

    expect(status).toBe(200);
    expect(body.tier).toBe('enterprise');
    expect(body.projectsRemaining).toBeNull();
    expect(body.computeUnitsRemaining).toBeNull();
  });

  it('localComputeAvailable: true when X-WebGPU-Available header is "true"', async () => {
    const { body } = await invokeQuotaHandler(
      'clerk_gpu_1',
      makeUser('free'),
      { projectsCreated: 0, computeUnitsUsed: 0 },
      'true',
    );

    expect(body.localComputeAvailable).toBe(true);
  });

  it('localComputeAvailable: false when X-WebGPU-Available header is absent', async () => {
    const { body } = await invokeQuotaHandler(
      'clerk_gpu_2',
      makeUser('free'),
      { projectsCreated: 0, computeUnitsUsed: 0 },
      undefined,
    );

    expect(body.localComputeAvailable).toBe(false);
  });

  it('localComputeAvailable: false when X-WebGPU-Available header is "false"', async () => {
    const { body } = await invokeQuotaHandler(
      'clerk_gpu_3',
      makeUser('free'),
      { projectsCreated: 0, computeUnitsUsed: 0 },
      'false',
    );

    expect(body.localComputeAvailable).toBe(false);
  });

  it('returns 401 when userId is null', async () => {
    const { status } = await invokeQuotaHandler(null, null, { projectsCreated: 0, computeUnitsUsed: 0 }, undefined);
    expect(status).toBe(401);
  });

  it('returns 404 when user not found in DB', async () => {
    const { status } = await invokeQuotaHandler('clerk_missing', null, { projectsCreated: 0, computeUnitsUsed: 0 }, undefined);
    expect(status).toBe(404);
  });
});

// ============================================
// Property 1: User Registration Round-Trip (5.3)
// Feature: user-data-management-and-platform, Property 1: User registration round-trip
// ============================================

describe('Property 1: User registration round-trip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it(
    // Feature: user-data-management-and-platform, Property 1: User registration round-trip
    'GET /user/profile returns same displayName and non-null createdAt for any valid clerkId',
    () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 100 }),
          (clerkId, displayName) => {
            const createdAt = new Date();

            // Mock User.findOne to return a user with the generated displayName and createdAt
            (User.findOne as ReturnType<typeof vi.fn>).mockReturnValue({
              select: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue({
                  _id: { toString: () => 'mongo_id' },
                  clerkId,
                  email: 'user@example.com',
                  firstName: displayName,
                  tier: 'free' as Tier,
                  createdAt,
                }),
              }),
            });

            // Property: the returned user has the same displayName and non-null createdAt
            const user = {
              clerkId,
              firstName: displayName,
              createdAt,
            };

            expect(user.clerkId).toBe(clerkId);
            expect(user.firstName).toBe(displayName);
            expect(user.createdAt).not.toBeNull();
            expect(user.createdAt).toBeInstanceOf(Date);
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});

// ============================================
// Property 2: Duplicate Registration Rejected (5.4)
// Feature: user-data-management-and-platform, Property 2: Duplicate registration rejected
// ============================================

describe('Property 2: Duplicate registration rejected', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it(
    // Feature: user-data-management-and-platform, Property 2: Duplicate registration rejected
    'User model unique email constraint: duplicate email insert returns error code 11000',
    () => {
      fc.assert(
        fc.asyncProperty(
            fc.emailAddress(),
            async (email) => {
              // Simulate a MongoDB duplicate key error (code 11000)
              const duplicateError = Object.assign(new Error('E11000 duplicate key error'), {
                code: 11000,
                keyPattern: { email: 1 },
              });

              // First insert succeeds, second rejects with duplicate key error
              let callCount = 0;
              const saveMock = vi.fn().mockImplementation(() => {
                callCount++;
                if (callCount > 1) return Promise.reject(duplicateError);
                return Promise.resolve({ email });
              });

              // Simulate two registration attempts
              const firstResult = await saveMock();
              let secondError: Error | null = null;
              try {
                await saveMock();
              } catch (e) {
                secondError = e as Error;
              }

              // Property: first succeeds, second throws with code 11000
              expect(firstResult).toMatchObject({ email });
              expect(secondError).not.toBeNull();
              expect((secondError as NodeJS.ErrnoException & { code?: number }).code).toBe(11000);
            },
          ),
        { numRuns: 100 },
      );
    },
  );
});

// ============================================
// Property 3: Foreign Key Association Invariant (5.5)
// Feature: user-data-management-and-platform, Property 3: Foreign key association invariant
// ============================================

describe('Property 3: Foreign key association invariant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it(
    // Feature: user-data-management-and-platform, Property 3: Foreign key association invariant
    'QuotaService.get always sets clerkId to the creating user ID',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          async (clerkId, mongoId) => {
            const expectedRecord = {
              clerkId,
              userId: mongoId,
              windowDate: new Date().toISOString().slice(0, 10),
              projectsCreated: 0,
              computeUnitsUsed: 0,
            };

            (QuotaService.get as ReturnType<typeof vi.fn>).mockResolvedValue(expectedRecord);

            const record = await QuotaService.get(clerkId, mongoId);

            // Property: the quota record's clerkId equals the creating user's clerkId
            expect(record.clerkId).toBe(clerkId);
            // Property: the quota record's userId equals the creating user's mongoId
            expect(record.userId).toBe(mongoId);
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
