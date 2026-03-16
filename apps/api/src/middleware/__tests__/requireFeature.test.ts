/**
 * requireFeature middleware tests
 *
 * Unit tests and property-based tests for the feature-gating middleware.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../authMiddleware.js';
import { TIER_CONFIG, type Tier, type FeatureFlags } from '../../config/tierConfig.js';

// ============================================
// Mock the User model and getEffectiveTier
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

import { User, getEffectiveTier } from '../../models.js';
import { requireFeature } from '../requireFeature.js';

// ============================================
// Helpers
// ============================================

const mockReq = (userId?: string): AuthenticatedRequest => {
  return {
    auth: userId ? { userId } : undefined,
  } as AuthenticatedRequest;
};

const mockRes = () => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const mockNext: () => NextFunction = () => vi.fn() as unknown as NextFunction;

/** Set up User.findOne to return a user with the given tier */
function setupUserWithTier(tier: Tier, email = 'user@example.com') {
  (User.findOne as ReturnType<typeof vi.fn>).mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue({ tier, email }),
    }),
  });
  (getEffectiveTier as ReturnType<typeof vi.fn>).mockImplementation(
    (_e: unknown, t: Tier) => t,
  );
}

// ============================================
// Unit Tests (3.4)
// ============================================

describe('requireFeature middleware — unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('free tier: collaboration → 403 FEATURE_NOT_IN_TIER', async () => {
    setupUserWithTier('free');
    const req = mockReq('clerk_user_1');
    const res = mockRes();
    const next = mockNext();

    await requireFeature('collaboration')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'FEATURE_NOT_IN_TIER',
          message: expect.stringContaining('collaboration'),
        }),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('free tier: pdfExport → 403 FEATURE_NOT_IN_TIER', async () => {
    setupUserWithTier('free');
    const req = mockReq('clerk_user_1');
    const res = mockRes();
    const next = mockNext();

    await requireFeature('pdfExport')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'FEATURE_NOT_IN_TIER' }),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('free tier: apiAccess → 403 FEATURE_NOT_IN_TIER', async () => {
    setupUserWithTier('free');
    const req = mockReq('clerk_user_1');
    const res = mockRes();
    const next = mockNext();

    await requireFeature('apiAccess')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'FEATURE_NOT_IN_TIER' }),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('pro tier: collaboration → next() called', async () => {
    setupUserWithTier('pro');
    const req = mockReq('clerk_user_2');
    const res = mockRes();
    const next = mockNext();

    await requireFeature('collaboration')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('pro tier: apiAccess → 403 FEATURE_NOT_IN_TIER', async () => {
    setupUserWithTier('pro');
    const req = mockReq('clerk_user_2');
    const res = mockRes();
    const next = mockNext();

    await requireFeature('apiAccess')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'FEATURE_NOT_IN_TIER' }),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('enterprise tier: apiAccess → next() called', async () => {
    setupUserWithTier('enterprise');
    const req = mockReq('clerk_user_3');
    const res = mockRes();
    const next = mockNext();

    await requireFeature('apiAccess')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('enterprise tier: collaboration → next() called', async () => {
    setupUserWithTier('enterprise');
    const req = mockReq('clerk_user_3');
    const res = mockRes();
    const next = mockNext();

    await requireFeature('collaboration')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('missing auth → 401 UNAUTHORIZED', async () => {
    const req = mockReq(); // no userId
    const res = mockRes();
    const next = mockNext();

    await requireFeature('collaboration')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('user not found in DB → 401 UNAUTHORIZED', async () => {
    (User.findOne as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      }),
    });

    const req = mockReq('clerk_ghost');
    const res = mockRes();
    const next = mockNext();

    await requireFeature('collaboration')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('error envelope has correct shape: { error: { code, message } }', async () => {
    setupUserWithTier('free');
    const req = mockReq('clerk_user_1');
    const res = mockRes();
    const next = mockNext();

    await requireFeature('aiAssistant')(req, res, next);

    const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(jsonCall).toHaveProperty('error');
    expect(jsonCall.error).toHaveProperty('code', 'FEATURE_NOT_IN_TIER');
    expect(jsonCall.error).toHaveProperty('message');
    expect(typeof jsonCall.error.message).toBe('string');
    expect(jsonCall.error.message.length).toBeGreaterThan(0);
  });
});

// ============================================
// Property-Based Test (3.3)
// Feature: user-data-management-and-platform, Property 14: Feature gating enforced server-side
// ============================================

describe('requireFeature middleware — property tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it(
    // Feature: user-data-management-and-platform, Property 14: Feature gating enforced server-side
    'Property 14: for any (tier, feature) pair where TIER_CONFIG[tier].features[feature] === false, middleware returns 403',
    async () => {
      const tiers = Object.keys(TIER_CONFIG) as Tier[];
      const features = Object.keys(TIER_CONFIG.free.features) as (keyof FeatureFlags)[];

      // Build the list of gated (tier, feature) pairs
      const gatedPairs: Array<{ tier: Tier; feature: keyof FeatureFlags }> = [];
      for (const tier of tiers) {
        for (const feature of features) {
          if (!TIER_CONFIG[tier].features[feature]) {
            gatedPairs.push({ tier, feature });
          }
        }
      }

      // Ensure there are gated pairs to test
      expect(gatedPairs.length).toBeGreaterThan(0);

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...gatedPairs),
          async ({ tier, feature }) => {
            setupUserWithTier(tier);

            const req = mockReq('clerk_prop_user');
            const res = mockRes();
            const next = mockNext();

            await requireFeature(feature)(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(
              expect.objectContaining({
                error: expect.objectContaining({
                  code: 'FEATURE_NOT_IN_TIER',
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
});
