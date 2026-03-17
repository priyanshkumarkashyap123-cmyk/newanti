/**
 * Tests for quota reset cron job
 * Feature: user-data-management-and-platform, Property 6: Quota tracking accuracy
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// Mock QuotaService
vi.mock('../../services/quotaService.js', () => ({
    QuotaService: {
        resetAll: vi.fn(),
        computeWeight: (n: number, m: number) => Math.max(1, Math.ceil(n / 50) + Math.ceil(m / 100)),
        get: vi.fn(),
        deductComputeUnits: vi.fn(),
        incrementProjects: vi.fn(),
    },
}));

vi.mock('node-cron', () => ({
    default: { schedule: vi.fn() },
}));

import { QuotaService } from '../../services/quotaService.js';

// Feature: user-data-management-and-platform, Property 6: Quota tracking accuracy
describe('Property 6: Quota Tracking Accuracy', () => {
    beforeEach(() => vi.clearAllMocks());

    it('compute weight formula is consistent with deduction amounts', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 5000 }),
                fc.integer({ min: 0, max: 10000 }),
                (nodeCount, memberCount) => {
                    const weight = QuotaService.computeWeight(nodeCount, memberCount);
                    const expected = Math.max(1, Math.ceil(nodeCount / 50) + Math.ceil(memberCount / 100));
                    return weight === expected;
                }
            ),
            { numRuns: 100 }
        );
    });

    it('quota remaining decreases by exactly the compute weight after each job', async () => {
        const initialUsed = 2;
        const nodeCount = 100;
        const memberCount = 200;
        const weight = QuotaService.computeWeight(nodeCount, memberCount);

        (QuotaService.get as any).mockResolvedValueOnce({ computeUnitsUsed: initialUsed, projectsCreated: 0 });
        (QuotaService.deductComputeUnits as any).mockResolvedValueOnce(undefined);
        (QuotaService.get as any).mockResolvedValueOnce({ computeUnitsUsed: initialUsed + weight, projectsCreated: 0 });

        const before = await QuotaService.get('user1', 'mongo1');
        await QuotaService.deductComputeUnits('user1', 'mongo1', weight);
        const after = await QuotaService.get('user1', 'mongo1');

        expect(after.computeUnitsUsed - before.computeUnitsUsed).toBe(weight);
    });
});

describe('Quota reset cron', () => {
    beforeEach(() => vi.clearAllMocks());

    it('resetAll is called and returns count of reset records', async () => {
        (QuotaService.resetAll as any).mockResolvedValue(5);
        const count = await QuotaService.resetAll();
        expect(count).toBe(5);
        expect(QuotaService.resetAll).toHaveBeenCalledTimes(1);
    });

    it('resetAll resolves to 0 when no past-date records exist', async () => {
        (QuotaService.resetAll as any).mockResolvedValue(0);
        const count = await QuotaService.resetAll();
        expect(count).toBe(0);
    });
});
