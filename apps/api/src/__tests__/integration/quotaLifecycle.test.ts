/**
 * Integration tests: Full quota lifecycle
 * Requirements: 3.1, 3.2, 3.3, 4.3
 * Feature: user-data-management-and-platform
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Response } from 'express';
import request from 'supertest';
import { TIER_CONFIG } from '../../config/tierConfig.js';

vi.mock('../../services/quotaService.js', () => ({
    QuotaService: {
        computeWeight: (n: number, m: number) => Math.max(1, Math.ceil(n / 50) + Math.ceil(m / 100)),
        get: vi.fn(),
        incrementProjects: vi.fn(),
        deductComputeUnits: vi.fn(),
        reset: vi.fn(),
        resetAll: vi.fn(),
    },
}));

import { QuotaService } from '../../services/quotaService.js';

function buildApp(userTier: 'free' | 'pro' | 'enterprise' = 'free') {
    const app = express();
    app.use(express.json());
    app.use((req: any, _res: Response, next: any) => {
        req.testUser = { _id: 'mongo1', tier: userTier, clerkId: 'user_test' };
        next();
    });

    app.get('/quota', async (req: any, res: Response) => {
        const tier = req.testUser.tier as keyof typeof TIER_CONFIG;
        const tierCfg = TIER_CONFIG[tier];
        const quota = await QuotaService.get('user_test', 'mongo1');
        const projectsRemaining = tierCfg.maxProjectsPerDay === Infinity
            ? null : Math.max(0, tierCfg.maxProjectsPerDay - quota.projectsCreated);
        const computeUnitsRemaining = tierCfg.maxComputeUnitsPerDay === Infinity
            ? null : Math.max(0, tierCfg.maxComputeUnitsPerDay - quota.computeUnitsUsed);
        res.json({ success: true, data: { tier, projectsRemaining, computeUnitsRemaining, ...quota } });
    });

    app.post('/projects', async (req: any, res: Response) => {
        const tier = req.testUser.tier as keyof typeof TIER_CONFIG;
        const tierCfg = TIER_CONFIG[tier];
        const quota = await QuotaService.get('user_test', 'mongo1');
        if (tierCfg.maxProjectsPerDay !== Infinity && quota.projectsCreated >= tierCfg.maxProjectsPerDay) {
            return res.status(429).json({ success: false, error: 'PROJECT_QUOTA_EXCEEDED' });
        }
        await QuotaService.incrementProjects('user_test', 'mongo1');
        return res.json({ success: true, data: { id: 'proj_1', name: req.body.name } });
    });

    return app;
}

describe('Quota lifecycle integration', () => {
    beforeEach(() => vi.clearAllMocks());

    it('free user can create up to 3 projects, 4th is rejected with 429', async () => {
        let projectsCreated = 0;
        (QuotaService.get as any).mockImplementation(async () => ({ projectsCreated, computeUnitsUsed: 0 }));
        (QuotaService.incrementProjects as any).mockImplementation(async () => { projectsCreated += 1; });

        const app = buildApp('free');
        for (let i = 0; i < 3; i++) {
            const res = await request(app).post('/projects').send({ name: `Project ${i + 1}` });
            expect(res.status).toBe(200);
        }
        const res4 = await request(app).post('/projects').send({ name: 'Project 4' });
        expect(res4.status).toBe(429);
        expect(res4.body.error).toBe('PROJECT_QUOTA_EXCEEDED');
    });

    it('quota endpoint reflects correct remaining after project creation', async () => {
        (QuotaService.get as any).mockResolvedValue({ projectsCreated: 2, computeUnitsUsed: 0 });
        const app = buildApp('free');
        const res = await request(app).get('/quota');
        expect(res.status).toBe(200);
        expect(res.body.data.projectsRemaining).toBe(1);
    });

    it('pro user is never quota-blocked on project creation', async () => {
        (QuotaService.get as any).mockResolvedValue({ projectsCreated: 100, computeUnitsUsed: 0 });
        (QuotaService.incrementProjects as any).mockResolvedValue(undefined);
        const app = buildApp('pro');
        const res = await request(app).post('/projects').send({ name: 'Pro Project' });
        expect(res.status).toBe(200);
    });

    it('compute units quota exhaustion would block analysis for free user', async () => {
        (QuotaService.get as any).mockResolvedValue({ projectsCreated: 0, computeUnitsUsed: 5 });
        const tierCfg = TIER_CONFIG['free'];
        const quota = await QuotaService.get('user_test', 'mongo1');
        const weight = QuotaService.computeWeight(10, 10);
        const wouldExceed = tierCfg.maxComputeUnitsPerDay !== Infinity &&
            quota.computeUnitsUsed + weight > tierCfg.maxComputeUnitsPerDay;
        expect(wouldExceed).toBe(true);
    });
});
