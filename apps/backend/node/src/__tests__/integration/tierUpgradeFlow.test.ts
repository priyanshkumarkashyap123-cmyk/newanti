/**
 * Integration tests: Tier upgrade flow
 * Requirements: 6.3, 6.4
 * Feature: user-data-management-and-platform
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Response } from 'express';
import request from 'supertest';
import { TIER_CONFIG } from '../../config/tierConfig.js';

vi.mock('../../models/index.js', () => ({
    User: { findOne: vi.fn(), findOneAndUpdate: vi.fn() },
}));

import { User } from '../../models/index.js';

vi.mock('../../services/quotaService.js', () => ({
    QuotaService: {
        computeWeight: (n: number, m: number) => Math.max(1, Math.ceil(n / 50) + Math.ceil(m / 100)),
        get: vi.fn().mockResolvedValue({ projectsCreated: 3, computeUnitsUsed: 5 }),
        incrementProjects: vi.fn(),
        deductComputeUnits: vi.fn(),
        reset: vi.fn(),
        resetAll: vi.fn(),
    },
}));

import { QuotaService } from '../../services/quotaService.js';

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use((req: any, _res: Response, next: any) => {
        req.userId = req.headers['x-user-id'] || 'user1';
        next();
    });

    // GET /subscription
    app.get('/subscription', async (req: any, res: Response) => {
        const user = await User.findOne({ clerkId: req.userId });
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        const tier = (user as any).tier as keyof typeof TIER_CONFIG;
        return res.json({ success: true, data: { tier, features: TIER_CONFIG[tier] } });
    });

    // POST /subscription/upgrade
    app.post('/subscription/upgrade', async (req: any, res: Response) => {
        const { tier } = req.body;
        if (!['free', 'pro', 'enterprise'].includes(tier)) {
            return res.status(400).json({ success: false, error: 'Invalid tier' });
        }
        const user = await User.findOneAndUpdate(
            { clerkId: req.userId },
            { $set: { tier } },
            { new: true }
        );
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        return res.json({ success: true, data: { tier, features: TIER_CONFIG[tier as keyof typeof TIER_CONFIG] } });
    });

    // GET /quota
    app.get('/quota', async (req: any, res: Response) => {
        const user = await User.findOne({ clerkId: req.userId });
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        const tier = (user as any).tier as keyof typeof TIER_CONFIG;
        const tierCfg = TIER_CONFIG[tier];
        const quota = await QuotaService.get(req.userId, (user as any)._id?.toString());
        const projectsRemaining = tierCfg.maxProjectsPerDay === Infinity
            ? null : Math.max(0, tierCfg.maxProjectsPerDay - quota.projectsCreated);
        return res.json({ success: true, data: { tier, projectsRemaining } });
    });

    // POST /projects (quota-gated)
    app.post('/projects', async (req: any, res: Response) => {
        const user = await User.findOne({ clerkId: req.userId });
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        const tier = (user as any).tier as keyof typeof TIER_CONFIG;
        const tierCfg = TIER_CONFIG[tier];
        const quota = await QuotaService.get(req.userId, (user as any)._id?.toString());
        if (tierCfg.maxProjectsPerDay !== Infinity && quota.projectsCreated >= tierCfg.maxProjectsPerDay) {
            return res.status(429).json({ success: false, error: 'PROJECT_QUOTA_EXCEEDED' });
        }
        return res.json({ success: true, data: { id: 'proj_new' } });
    });

    return app;
}

describe('Tier upgrade flow integration', () => {
    beforeEach(() => vi.clearAllMocks());

    it('free user hits quota → upgrade to Pro → quota limits updated', async () => {
        // Start as free user with quota exhausted
        const freeUser = { _id: 'mongo1', tier: 'free', clerkId: 'user1' };
        (User.findOne as any).mockResolvedValue(freeUser);
        (QuotaService.get as any).mockResolvedValue({ projectsCreated: 3, computeUnitsUsed: 5 });

        const app = buildApp();

        // Free user is blocked
        const blockedRes = await request(app)
            .post('/projects')
            .set('x-user-id', 'user1')
            .send({ name: 'New Project' });
        expect(blockedRes.status).toBe(429);

        // Upgrade to Pro
        const proUser = { _id: 'mongo1', tier: 'pro', clerkId: 'user1' };
        (User.findOneAndUpdate as any).mockResolvedValue(proUser);
        const upgradeRes = await request(app)
            .post('/subscription/upgrade')
            .set('x-user-id', 'user1')
            .send({ tier: 'pro' });
        expect(upgradeRes.status).toBe(200);
        expect(upgradeRes.body.data.tier).toBe('pro');

        // After upgrade, quota limits are unlimited
        (User.findOne as any).mockResolvedValue(proUser);
        const quotaRes = await request(app)
            .get('/quota')
            .set('x-user-id', 'user1');
        expect(quotaRes.status).toBe(200);
        expect(quotaRes.body.data.projectsRemaining).toBeNull(); // Infinity → null
    });

    it('gated features become accessible after upgrade to Pro', async () => {
        const freeUser = { _id: 'mongo1', tier: 'free', clerkId: 'user1' };
        (User.findOne as any).mockResolvedValue(freeUser);

        const app = buildApp();

        // Check free tier features
        const freeSubRes = await request(app)
            .get('/subscription')
            .set('x-user-id', 'user1');
        expect(freeSubRes.status).toBe(200);
        expect(freeSubRes.body.data.features.features.collaboration).toBe(false);

        // Upgrade to Pro
        const proUser = { _id: 'mongo1', tier: 'pro', clerkId: 'user1' };
        (User.findOneAndUpdate as any).mockResolvedValue(proUser);
        await request(app)
            .post('/subscription/upgrade')
            .set('x-user-id', 'user1')
            .send({ tier: 'pro' });

        // Check pro tier features
        (User.findOne as any).mockResolvedValue(proUser);
        const proSubRes = await request(app)
            .get('/subscription')
            .set('x-user-id', 'user1');
        expect(proSubRes.status).toBe(200);
        expect(proSubRes.body.data.features.features.collaboration).toBe(true);
        expect(proSubRes.body.data.features.features.pdfExport).toBe(true);
    });

    it('pro user can create projects beyond free limit', async () => {
        const proUser = { _id: 'mongo1', tier: 'pro', clerkId: 'user1' };
        (User.findOne as any).mockResolvedValue(proUser);
        (QuotaService.get as any).mockResolvedValue({ projectsCreated: 10, computeUnitsUsed: 0 });

        const app = buildApp();
        const res = await request(app)
            .post('/projects')
            .set('x-user-id', 'user1')
            .send({ name: 'Pro Project' });
        expect(res.status).toBe(200);
    });
});
