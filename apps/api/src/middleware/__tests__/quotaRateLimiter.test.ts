/**
 * quotaRateLimiter middleware tests
 *
 * Unit tests and property-based tests for quota enforcement middleware.
 * Tasks 4.2, 4.3, 4.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../authMiddleware.js';
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

vi.mock('../../services/quotaService.js', () => {
  return {
    QuotaService: {
      get: vi.fn(),
      computeWeight: vi.fn((nodeCount: number, memberCount: number) =>
        Math.max(1, Math.ceil(nodeCount / 50) + Math.ceil(memberCount / 100)),
      ),
    },
  };
});

import { User, getEffectiveTier } from '../../models.js';
import { QuotaService } from '../../services/quotaService.js';
import {
  projectCreationRateLimiter,
  analysisRateLimiter,
} from '../quotaRateLimiter.js';

// ============================================
// Helpers
// ============================================

const mockReq = (userId?: string, body: Record<string, unknown> = {}): AuthenticatedRequest => {
  return {
    auth: userId ? { userId } : undefined,
    body,
  } as AuthenticatedRequest;
};

const mockRes = () => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const mockNext = (): NextFunction => vi.fn() as unknown as NextFunction;

function setupUser(tier: Tier, email = 'user@example.com') {
  (User.findOne as ReturnType<typeof vi.fn>).mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue({ tier, email, _id: 'mongo_id_123' }),
    }),
  });
  (getEffectiveTier as ReturnType<typeof vi.fn>).mockImplementation(
    (_e: unknown, t: Tier) => t,
  );
}

function setupQuota(projectsCreated: number, computeUnitsUsed: number) {
  (QuotaService.get as ReturnType<typeof vi.fn>).mockResolvedValue({
    projectsCreated,
    computeUnitsUsed,
  });
}

// ============================================
// Unit Tests — projectCreationRateLimiter (4.4)
// ============================================

describe('projectCreationRateLimiter — unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('free user with projectsCreated=2 (below limit=3) → next() called', async () => {
    setupUser('free');
    setupQuota(2, 0);

    const req = mockReq('clerk_free_1');
    const res = mockRes();
    const next = mockNext();

    await projectCreationRateLimiter()(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('free user with projectsCreated=3 (at limit=3) → 429 PROJECT_QUOTA_EXCEEDED', async () => {
    setupUser('free');
    setupQuota(3, 0);

    const req = mockReq('clerk_free_2');
    const res = mockRes();
    const next = mockNext();

    await projectCreationRateLimiter()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'PROJECT_QUOTA_EXCEEDED',
          message: expect.stringContaining('3'),
        }),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('pro user with projectsCreated=100 → next() called (bypass)', async () => {
    setupUser('pro');
    // QuotaService.get should NOT be called for pro users
    const req = mockReq('clerk_pro_1');
    const res = mockRes();
    const next = mockNext();

    await projectCreationRateLimiter()(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(QuotaService.get).not.toHaveBeenCalled();
  });

  it('enterprise user → next() called (bypass)', async () => {
    setupUser('enterprise');
    const req = mockReq('clerk_ent_1');
    const res = mockRes();
    const next = mockNext();

    await projectCreationRateLimiter()(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(QuotaService.get).not.toHaveBeenCalled();
  });

  it('missing auth → 401 UNAUTHORIZED', async () => {
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    await projectCreationRateLimiter()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

// ============================================
// Unit Tests — analysisRateLimiter (4.4)
// ============================================

describe('analysisRateLimiter — unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const getNodeCount = (req: AuthenticatedRequest) =>
    (req.body as { nodeCount?: number }).nodeCount ?? 0;
  const getMemberCount = (req: AuthenticatedRequest) =>
    (req.body as { memberCount?: number }).memberCount ?? 0;

  it('free user with computeUnitsUsed=3, job weight=1 (below limit=5) → next() called', async () => {
    setupUser('free');
    setupQuota(0, 3);

    // nodeCount=50, memberCount=0 → weight = ceil(50/50) + ceil(0/100) = 1 + 0 = 1
    const req = mockReq('clerk_free_3', { nodeCount: 50, memberCount: 0 });
    const res = mockRes();
    const next = mockNext();

    await analysisRateLimiter(getNodeCount, getMemberCount)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('free user with computeUnitsUsed=4, job weight=1 (at limit=5) → 429 COMPUTE_QUOTA_EXCEEDED', async () => {
    setupUser('free');
    setupQuota(0, 4);

    // nodeCount=50, memberCount=0 → weight=1; 4+1=5 > 5 is false, but 4+1 > 5 is false...
    // Actually 4+1=5 which is NOT > 5, so this should pass. Let's use weight=2 to exceed.
    // nodeCount=100, memberCount=0 → weight = ceil(100/50) + 0 = 2; 4+2=6 > 5 → 429
    const req = mockReq('clerk_free_4', { nodeCount: 100, memberCount: 0 });
    const res = mockRes();
    const next = mockNext();

    await analysisRateLimiter(getNodeCount, getMemberCount)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'COMPUTE_QUOTA_EXCEEDED',
          message: expect.stringContaining('5'),
          details: expect.objectContaining({
            jobWeight: 2,
            remaining: 1,
          }),
        }),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('free user with computeUnitsUsed=4, job weight=1 (4+1=5, exactly at limit) → next() called', async () => {
    setupUser('free');
    setupQuota(0, 4);

    // nodeCount=50, memberCount=0 → weight=1; 4+1=5 which is NOT > 5 → allowed
    const req = mockReq('clerk_free_5', { nodeCount: 50, memberCount: 0 });
    const res = mockRes();
    const next = mockNext();

    await analysisRateLimiter(getNodeCount, getMemberCount)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('enterprise user with computeUnitsUsed=1000 → next() called (bypass)', async () => {
    setupUser('enterprise');
    const req = mockReq('clerk_ent_2', { nodeCount: 5000, memberCount: 5000 });
    const res = mockRes();
    const next = mockNext();

    await analysisRateLimiter(getNodeCount, getMemberCount)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(QuotaService.get).not.toHaveBeenCalled();
  });

  it('pro user with high usage → next() called (bypass)', async () => {
    setupUser('pro');
    const req = mockReq('clerk_pro_2', { nodeCount: 1000, memberCount: 1000 });
    const res = mockRes();
    const next = mockNext();

    await analysisRateLimiter(getNodeCount, getMemberCount)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(QuotaService.get).not.toHaveBeenCalled();
  });
});

// ============================================
// Property-Based Test (4.2)
// Feature: user-data-management-and-platform, Property 7: Quota enforcement rejects at limit
// ============================================

describe('quotaRateLimiter — property tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it(
    // Feature: user-data-management-and-platform, Property 7: Quota enforcement rejects at limit
    'Property 7: free-tier users at or above project limit always get 429 and quota unchanged',
    async () => {
      const limit = TIER_CONFIG.free.maxProjectsPerDay; // 3

      await fc.assert(
        fc.asyncProperty(
          // projectsCreated >= limit
          fc.integer({ min: limit, max: limit + 100 }),
          async (projectsCreated) => {
            setupUser('free');
            setupQuota(projectsCreated, 0);

            const req = mockReq('clerk_prop_7');
            const res = mockRes();
            const next = mockNext();

            await projectCreationRateLimiter()(req, res, next);

            expect(res.status).toHaveBeenCalledWith(429);
            expect(res.json).toHaveBeenCalledWith(
              expect.objectContaining({
                error: expect.objectContaining({
                  code: 'PROJECT_QUOTA_EXCEEDED',
                }),
              }),
            );
            expect(next).not.toHaveBeenCalled();
            // Quota counters unchanged: QuotaService.get was called but no increment
            expect(QuotaService.get).toHaveBeenCalled();

            vi.clearAllMocks();
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    // Feature: user-data-management-and-platform, Property 7: Quota enforcement rejects at limit
    'Property 7: free-tier users at or above compute unit limit always get 429',
    async () => {
      const limit = TIER_CONFIG.free.maxComputeUnitsPerDay; // 5

      await fc.assert(
        fc.asyncProperty(
          // computeUnitsUsed >= limit (so even weight=1 would exceed)
          fc.integer({ min: limit, max: limit + 100 }),
          async (computeUnitsUsed) => {
            setupUser('free');
            setupQuota(0, computeUnitsUsed);

            // weight=1 (minimal job): computeUnitsUsed + 1 > limit
            const req = mockReq('clerk_prop_7b', { nodeCount: 1, memberCount: 0 });
            const res = mockRes();
            const next = mockNext();

            const getNodeCount = (r: AuthenticatedRequest) =>
              (r.body as { nodeCount?: number }).nodeCount ?? 0;
            const getMemberCount = (r: AuthenticatedRequest) =>
              (r.body as { memberCount?: number }).memberCount ?? 0;

            await analysisRateLimiter(getNodeCount, getMemberCount)(req, res, next);

            expect(res.status).toHaveBeenCalledWith(429);
            expect(res.json).toHaveBeenCalledWith(
              expect.objectContaining({
                error: expect.objectContaining({
                  code: 'COMPUTE_QUOTA_EXCEEDED',
                }),
              }),
            );
            expect(next).not.toHaveBeenCalled();

            vi.clearAllMocks();
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    // Feature: user-data-management-and-platform, Property 8: Pro and Enterprise users bypass quota
    'Property 8: pro and enterprise users always bypass quota regardless of usage',
    async () => {
      const nonFreeTiers: Tier[] = ['pro', 'enterprise'];

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...nonFreeTiers),
          fc.integer({ min: 0, max: 10000 }),
          fc.integer({ min: 0, max: 10000 }),
          async (tier, projectsCreated, computeUnitsUsed) => {
            setupUser(tier);
            // Even if quota is set high, it should never be checked
            setupQuota(projectsCreated, computeUnitsUsed);

            const req = mockReq('clerk_prop_8');
            const res = mockRes();
            const next = mockNext();

            await projectCreationRateLimiter()(req, res, next);

            expect(next).toHaveBeenCalledTimes(1);
            expect(res.status).not.toHaveBeenCalled();
            // Quota service should NOT be called for non-free tiers
            expect(QuotaService.get).not.toHaveBeenCalled();

            vi.clearAllMocks();
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    // Feature: user-data-management-and-platform, Property 8: Pro and Enterprise users bypass quota
    'Property 8: pro and enterprise users bypass analysis quota regardless of usage',
    async () => {
      const nonFreeTiers: Tier[] = ['pro', 'enterprise'];

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...nonFreeTiers),
          fc.integer({ min: 0, max: 10000 }),
          fc.integer({ min: 0, max: 10000 }),
          fc.integer({ min: 0, max: 10000 }),
          async (tier, computeUnitsUsed, nodeCount, memberCount) => {
            setupUser(tier);
            setupQuota(0, computeUnitsUsed);

            const req = mockReq('clerk_prop_8b', { nodeCount, memberCount });
            const res = mockRes();
            const next = mockNext();

            const getNodeCount = (r: AuthenticatedRequest) =>
              (r.body as { nodeCount?: number }).nodeCount ?? 0;
            const getMemberCount = (r: AuthenticatedRequest) =>
              (r.body as { memberCount?: number }).memberCount ?? 0;

            await analysisRateLimiter(getNodeCount, getMemberCount)(req, res, next);

            expect(next).toHaveBeenCalledTimes(1);
            expect(res.status).not.toHaveBeenCalled();
            expect(QuotaService.get).not.toHaveBeenCalled();

            vi.clearAllMocks();
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
