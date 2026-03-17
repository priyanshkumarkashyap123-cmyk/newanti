/**
 * Tests for analysis preflight and run endpoints
 * Feature: user-data-management-and-platform
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { attachResponseHelpers } from '../../middleware/response.js';

vi.mock('../../middleware/authMiddleware.js', () => ({
    requireAuth: () => (req: any, _res: any, next: any) => {
        req.auth = { userId: req.headers['x-user-id'] || null };
        next();
    },
    getAuth: (req: any) => req.auth ?? { userId: null },
}));

vi.mock('../../middleware/quotaRateLimiter.js', () => ({
    analysisRateLimiter: () => (req: any, res: any, next: any) => {
        // Simulate quota exceeded if header set
        if (req.headers['x-quota-exceeded'] === 'true') {
            return res.status(429).json({ success: false, error: 'COMPUTE_QUOTA_EXCEEDED' });
        }
        next();
    },
    projectCreationRateLimiter: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../services/serviceProxy.js', () => ({
    rustProxy: vi.fn(),
}));

vi.mock('../../models.js', () => ({
    User: { findOne: vi.fn() },
    AnalysisJob: { create: vi.fn(), updateOne: vi.fn(), updateMany: vi.fn(), findOne: vi.fn(), find: vi.fn() },
}));

vi.mock('../../services/quotaService.js', () => ({
    QuotaService: {
        computeWeight: (n: number, m: number) => Math.max(1, Math.ceil(n / 50) + Math.ceil(m / 100)),
        get: vi.fn().mockResolvedValue({ computeUnitsUsed: 0, projectsCreated: 0 }),
        deductComputeUnits: vi.fn().mockResolvedValue(undefined),
        incrementProjects: vi.fn(),
        reset: vi.fn(),
        resetAll: vi.fn(),
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

vi.mock('../../middleware/validation.js', () => ({
    validateBody: () => (_req: any, _res: any, next: any) => next(),
    analyzeRequestSchema: {},
}));

import { rustProxy } from '../../services/serviceProxy.js';
import { QuotaService } from '../../services/quotaService.js';
import { User } from '../../models.js';

async function buildApp() {
    const app = express();
    app.use(express.json());
    app.use(attachResponseHelpers);
    const { default: analysisRouter } = await import('../analysis/index.js');
    app.use('/', analysisRouter);
    return app;
}

const validModel = {
    nodes: Array.from({ length: 2 }, (_, i) => ({ id: `n${i}`, x: i, y: 0, z: 0 })),
    members: [{ id: 'm1', startNodeId: 'n0', endNodeId: 'n1' }],
    loads: [],
};

describe('POST /preflight', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns correct weight and remaining for authenticated user', async () => {
        (User.findOne as any).mockReturnValue({
            select: () => ({ lean: () => Promise.resolve({ _id: 'mongo1', tier: 'free' }) })
        });
        const app = await buildApp();
        const res = await request(app)
            .post('/preflight')
            .set('x-user-id', 'user1')
            .send({ nodeCount: 100, memberCount: 200 });

        expect(res.status).toBe(200);
        // weight = ceil(100/50) + ceil(200/100) = 2 + 2 = 4
        expect(res.body.data.weight).toBe(4);
        expect(typeof res.body.data.remaining === 'number' || res.body.data.remaining === null).toBe(true);
    });

    it('returns weight 1 for empty model', async () => {
        (User.findOne as any).mockReturnValue({
            select: () => ({ lean: () => Promise.resolve(null) })
        });
        const app = await buildApp();
        const res = await request(app)
            .post('/preflight')
            .set('x-user-id', 'user1')
            .send({ nodeCount: 0, memberCount: 0 });

        expect(res.status).toBe(200);
        expect(res.body.data.weight).toBe(1);
    });
});

describe('POST /run', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns result with computeMode=server and computeUnitsCharged on success', async () => {
        (rustProxy as any).mockResolvedValue({ success: true, data: { displacements: [] } });
        (User.findOne as any).mockReturnValue({
            select: () => ({ lean: () => Promise.resolve({ _id: 'mongo1' }) })
        });

        const app = await buildApp();
        const res = await request(app)
            .post('/run')
            .set('x-user-id', 'user1')
            .send(validModel);

        expect(res.status).toBe(200);
        expect(res.body.computeMode).toBe('server');
        expect(typeof res.body.computeUnitsCharged).toBe('number');
        expect(res.body.computeUnitsCharged).toBeGreaterThanOrEqual(1);
    });

    it('deducts quota after successful run', async () => {
        (rustProxy as any).mockResolvedValue({ success: true, data: { displacements: [] } });
        (User.findOne as any).mockReturnValue({
            select: () => ({ lean: () => Promise.resolve({ _id: 'mongo1' }) })
        });

        const app = await buildApp();
        await request(app)
            .post('/run')
            .set('x-user-id', 'user1')
            .send(validModel);

        expect(QuotaService.deductComputeUnits).toHaveBeenCalledTimes(1);
    });

    it('returns 429 when quota exceeded', async () => {
        const app = await buildApp();
        const res = await request(app)
            .post('/run')
            .set('x-user-id', 'user1')
            .set('x-quota-exceeded', 'true')
            .send(validModel);

        expect(res.status).toBe(429);
        expect(QuotaService.deductComputeUnits).not.toHaveBeenCalled();
    });

    it('does not deduct quota on analysis failure', async () => {
        (rustProxy as any).mockResolvedValue({ success: false, error: 'Rust error', status: 500 });

        const app = await buildApp();
        await request(app)
            .post('/run')
            .set('x-user-id', 'user1')
            .send(validModel);

        expect(QuotaService.deductComputeUnits).not.toHaveBeenCalled();
    });
});
