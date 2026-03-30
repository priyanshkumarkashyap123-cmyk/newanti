/**
 * Property-Based Tests for Backend Input Validation
 *
 * Task 23.1 — Property 19: Node_API Body Validation
 * Task 23.2 — Property 20: Per-Tier Model Size Enforcement
 *
 * Validates: Requirements 17.4, 17.6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import express from 'express';
import request from 'supertest';
import { attachResponseHelpers } from '../../middleware/response.js';

// ── Auth mock ──────────────────────────────────────────────────────────────
vi.mock('../../middleware/authMiddleware.js', () => ({
  requireAuth: () => (req: any, _res: any, next: any) => {
    req.auth = { userId: req.headers['x-user-id'] || 'test-user' };
    next();
  },
  getAuth: (req: any) => req.auth ?? { userId: 'test-user' },
}));

vi.mock('../../middleware/quotaRateLimiter.js', () => ({
  analysisRateLimiter: () => (_req: any, _res: any, next: any) => next(),
  projectCreationRateLimiter: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../services/serviceProxy.js', () => ({
  rustProxy: vi.fn().mockResolvedValue({ success: true, data: { displacements: [] } }),
}));

vi.mock('../../models.js', () => ({
  User: {
    findOne: vi.fn().mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ _id: 'mongo1', tier: 'free' }) }),
    }),
  },
  AnalysisJob: {
    create: vi.fn(),
    updateOne: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({ modifiedCount: 0 }),
    findOne: vi.fn(),
    find: vi.fn().mockReturnValue({ select: () => ({ sort: () => ({ limit: () => ({ lean: () => Promise.resolve([]) }) }) }) }),
  },
}));

vi.mock('../../services/quotaService.js', () => ({
  QuotaService: {
    computeWeight: (n: number, m: number) => Math.max(1, Math.ceil(n / 50) + Math.ceil(m / 100)),
    get: vi.fn().mockResolvedValue({ computeUnitsUsed: 0, projectsCreated: 0 }),
    deductComputeUnits: vi.fn().mockResolvedValue(undefined),
    incrementProjects: vi.fn(),
  },
}));

vi.mock('../../utils/resultCache.js', () => ({
  cacheKey: () => 'key',
  getCachedResult: () => undefined,
  setCachedResult: vi.fn(),
}));

vi.mock('../../utils/proxyContracts.js', () => ({
  assertAnalysisPayload: () => ({ ok: true }),
}));

import { User } from '../../models.js';

// ── App builders ───────────────────────────────────────────────────────────

async function buildAnalysisApp() {
  const app = express();
  app.use(express.json());
  app.use(attachResponseHelpers);
  const { default: analysisRouter } = await import('../analysis/index.js');
  app.use('/', analysisRouter);
  return app;
}

async function buildProjectApp() {
  const app = express();
  app.use(express.json());
  app.use(attachResponseHelpers);
  const { default: projectRouter } = await import('../projectRoutes.js');
  app.use('/', projectRouter);
  return app;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Minimal valid analysis model with N nodes */
function makeModel(nodeCount: number) {
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    id: `n${i}`,
    x: i,
    y: 0,
    z: 0,
    restraints: i === 0 ? { fx: true, fy: true, fz: true } : {},
  }));
  const members = nodeCount >= 2
    ? [{ id: 'm1', startNodeId: 'n0', endNodeId: 'n1' }]
    : [];
  return { nodes, members, loads: [] };
}

// ── Property 19: Node_API Body Validation ─────────────────────────────────
// **Validates: Requirement 17.4**

describe('Property 19: Node_API Body Validation', () => {
  it('POST /api/projects with invalid body returns HTTP 400 VALIDATION_ERROR', async () => {
    const app = await buildProjectApp();

    // Mock resolveUser to return a valid user so auth passes
    (User.findOne as any).mockReturnValue({
      lean: () => Promise.resolve({ _id: 'mongo1', tier: 'free' }),
    });

    await fc.assert(
      fc.asyncProperty(
        // Generate bodies that fail the createProjectSchema (name is required, must be non-empty string)
        fc.oneof(
          fc.constant({}),                                    // missing name
          fc.constant({ name: '' }),                          // empty name
          fc.constant({ name: 123 }),                         // wrong type
          fc.record({ name: fc.constant(''), description: fc.string() }), // empty name with description
        ),
        async (invalidBody) => {
          const res = await request(app)
            .post('/')
            .set('x-user-id', 'test-user')
            .send(invalidBody);

          expect(res.status).toBe(400);
          expect(res.body.error).toBe('VALIDATION_ERROR');
          expect(Array.isArray(res.body.fields)).toBe(true);
          expect(res.body.fields.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('POST /analyze with invalid body (missing nodes) returns HTTP 400 VALIDATION_ERROR', async () => {
    const app = await buildAnalysisApp();

    await fc.assert(
      fc.asyncProperty(
        // Generate bodies that fail analyzeRequestSchema (nodes array required, min 2)
        fc.oneof(
          fc.constant({}),                                    // missing nodes/members
          fc.constant({ nodes: [], members: [] }),            // empty arrays (min 2 nodes)
          fc.constant({ nodes: [{ id: 'n1', x: 0, y: 0, z: 0 }], members: [] }), // only 1 node
          fc.constant({ members: [{ id: 'm1', startNodeId: 'n0', endNodeId: 'n1' }] }), // missing nodes
        ),
        async (invalidBody) => {
          const res = await request(app)
            .post('/')
            .set('x-user-id', 'test-user')
            .send(invalidBody);

          expect(res.status).toBe(400);
          expect(res.body.error).toBe('VALIDATION_ERROR');
          expect(Array.isArray(res.body.fields)).toBe(true);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('valid POST /analyze body passes validation and reaches handler', async () => {
    const app = await buildAnalysisApp();

    await fc.assert(
      fc.asyncProperty(
        // Generate valid node counts (2–10 nodes)
        fc.integer({ min: 2, max: 10 }),
        async (nodeCount) => {
          const model = makeModel(nodeCount);
          const res = await request(app)
            .post('/test/analyze')
            .set('x-user-id', 'test-user')
            .send(model);

          // Should NOT be a validation error (may be 200, 202, or other non-400)
          expect(res.status).not.toBe(400);
          if (res.status === 400) {
            // If 400, must not be VALIDATION_ERROR from schema (could be MODEL_TOO_LARGE)
            expect(res.body.error).not.toBe('VALIDATION_ERROR');
          }
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── Property 20: Per-Tier Model Size Enforcement ──────────────────────────
// **Validates: Requirement 17.6**

const TIER_LIMITS: Record<string, number> = {
  free: 100,
  pro: 2000,
  enterprise: 10000,
};

describe('Property 20: Per-Tier Model Size Enforcement', () => {
  beforeEach(() => vi.clearAllMocks());

  it('node count exceeding tier limit returns HTTP 400 MODEL_TOO_LARGE', async () => {
    const app = await buildAnalysisApp();

    // Only test free and pro tiers to avoid body size limits (enterprise limit = 10,000 nodes)
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('free', 'pro'),
        async (tier) => {
          const limit = TIER_LIMITS[tier];
          const nodeCount = limit + 1;

          // Mock user with this tier
          (User.findOne as any).mockReturnValue({
            select: () => ({
              lean: () => Promise.resolve({ _id: 'mongo1', tier }),
            }),
          });

          const model = makeModel(nodeCount);
          const res = await request(app)
            .post('/test/analyze')
            .set('x-user-id', 'test-user')
            .send(model);

          expect(res.status).toBe(400);
          expect(res.body.error).toBe('MODEL_TOO_LARGE');
        },
      ),
      { numRuns: 20 },
    );
  });

  it('enterprise tier: node count exceeding 10,000 returns HTTP 400 MODEL_TOO_LARGE', async () => {
    // Build a dedicated app with a larger JSON body limit to test enterprise tier
    const app = express();
    app.use(express.json({ limit: '20mb' }));
    app.use(attachResponseHelpers);
    const { default: analysisRouter } = await import('../analysis/index.js');
    app.use('/', analysisRouter);

    (User.findOne as any).mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve({ _id: 'mongo1', tier: 'enterprise' }),
      }),
    });

    // Build a compact model with 10,001 nodes
    const nodes = Array.from({ length: 10001 }, (_, i) => ({ id: `n${i}`, x: i % 100, y: Math.floor(i / 100), z: 0 }));
    const model = { nodes, members: [{ id: 'm1', startNodeId: 'n0', endNodeId: 'n1' }], loads: [] };

    const res = await request(app)
      .post('/test/analyze')
      .set('x-user-id', 'test-user')
      .send(model);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MODEL_TOO_LARGE');
  });

  it('node count at or below tier limit is not rejected with MODEL_TOO_LARGE', async () => {
    const app = await buildAnalysisApp();

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('free', 'pro', 'enterprise'),
        async (tier) => {
          const limit = TIER_LIMITS[tier];
          // Use exactly the limit (boundary value)
          const nodeCount = Math.max(2, limit);

          (User.findOne as any).mockReturnValue({
            select: () => ({
              lean: () => Promise.resolve({ _id: 'mongo1', tier }),
            }),
          });

          const model = makeModel(nodeCount);
          const res = await request(app)
            .post('/test/analyze')
            .set('x-user-id', 'test-user')
            .send(model);

          // Must not be MODEL_TOO_LARGE
          if (res.status === 400) {
            expect(res.body.error).not.toBe('MODEL_TOO_LARGE');
          }
        },
      ),
      { numRuns: 15 },
    );
  });

  it('MODEL_TOO_LARGE is returned before forwarding to any backend', async () => {
    const app = await buildAnalysisApp();
    const { rustProxy } = await import('../../services/serviceProxy.js');

    (User.findOne as any).mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve({ _id: 'mongo1', tier: 'free' }),
      }),
    });

    // 101 nodes exceeds free tier limit of 100
    const model = makeModel(101);
    const res = await request(app)
      .post('/test/analyze')
      .set('x-user-id', 'test-user')
      .send(model);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MODEL_TOO_LARGE');
    // rustProxy must NOT have been called
    expect(rustProxy).not.toHaveBeenCalled();
  });
});
