/**
 * Tests for subscription endpoints
 * Feature: user-data-management-and-platform
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { attachResponseHelpers } from '../../middleware/response.js';

// --- mocks ---
vi.mock('../../middleware/authMiddleware.js', () => ({
    requireAuth: () => (req: any, _res: any, next: any) => {
        req.auth = { userId: req.headers['x-user-id'] || 'user_test' };
        next();
    },
    getAuth: (req: any) => req.auth,
}));

vi.mock('../../models.js', () => ({
    User: {
        findOne: vi.fn(),
        findOneAndUpdate: vi.fn(),
    },
}));

import { User } from '../../models.js';
import subscriptionRoutes from '../subscriptionRoutes.js';
import { TIER_CONFIG } from '../../config/tierConfig.js';

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use(attachResponseHelpers);
    app.use('/', subscriptionRoutes);
    return app;
}

describe('GET /subscription', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns tier and features for free user', async () => {
        (User.findOne as any).mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ tier: 'free' }) }) });
        const res = await request(buildApp()).get('/').set('x-user-id', 'user1');
        expect(res.status).toBe(200);
        expect(res.body.data.tier).toBe('free');
        expect(res.body.data.features).toEqual(TIER_CONFIG.free);
    });

    it('returns tier and features for pro user', async () => {
        (User.findOne as any).mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ tier: 'pro' }) }) });
        const res = await request(buildApp()).get('/').set('x-user-id', 'user2');
        expect(res.status).toBe(200);
        expect(res.body.data.tier).toBe('pro');
        // Infinity serializes to null in JSON
        expect(res.body.data.features.maxComputeUnitsPerDay).toBe(TIER_CONFIG.pro.maxComputeUnitsPerDay);
        expect(res.body.data.features.features.collaboration).toBe(true);
    });

    it('returns 404 when user not found', async () => {
        (User.findOne as any).mockReturnValue({ select: () => ({ lean: () => Promise.resolve(null) }) });
        const res = await request(buildApp()).get('/').set('x-user-id', 'ghost');
        expect(res.status).toBe(404);
    });
});

describe('POST /upgrade', () => {
    beforeEach(() => vi.clearAllMocks());

    it('upgrades user tier and returns updated features', async () => {
        (User.findOneAndUpdate as any).mockReturnValue({ lean: () => Promise.resolve({ tier: 'pro' }) });
        const res = await request(buildApp())
            .post('/upgrade')
            .set('x-user-id', 'user1')
            .send({ tier: 'pro' });
        expect(res.status).toBe(200);
        expect(res.body.data.tier).toBe('pro');
        // Infinity serializes to null in JSON
        expect(res.body.data.features.maxComputeUnitsPerDay).toBe(TIER_CONFIG.pro.maxComputeUnitsPerDay);
        expect(res.body.data.features.features.collaboration).toBe(true);
    });

    it('reflects updated tier in subsequent GET (simulated)', async () => {
        (User.findOneAndUpdate as any).mockReturnValue({ lean: () => Promise.resolve({ tier: 'enterprise' }) });
        const upgradeRes = await request(buildApp())
            .post('/upgrade')
            .set('x-user-id', 'user1')
            .send({ tier: 'enterprise' });
        expect(upgradeRes.body.data.tier).toBe('enterprise');

        (User.findOne as any).mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ tier: 'enterprise' }) }) });
        const getRes = await request(buildApp()).get('/').set('x-user-id', 'user1');
        expect(getRes.body.data.tier).toBe('enterprise');
    });

    it('rejects invalid tier with 400', async () => {
        const res = await request(buildApp())
            .post('/upgrade')
            .set('x-user-id', 'user1')
            .send({ tier: 'platinum' });
        expect(res.status).toBe(400);
    });

    it('returns 404 when user not found', async () => {
        (User.findOneAndUpdate as any).mockReturnValue({ lean: () => Promise.resolve(null) });
        const res = await request(buildApp())
            .post('/upgrade')
            .set('x-user-id', 'ghost')
            .send({ tier: 'pro' });
        expect(res.status).toBe(404);
    });
});
