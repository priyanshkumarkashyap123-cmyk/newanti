import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

// Mock the QuotaRecord model before importing the service
vi.mock('../../models/index.js', () => {
    const findOneMock = vi.fn();
    const findOneAndUpdateMock = vi.fn();
    const updateManyMock = vi.fn();
    const userFindOneMock = vi.fn();
    return {
        QuotaRecord: {
            findOne: findOneMock,
            findOneAndUpdate: findOneAndUpdateMock,
            updateMany: updateManyMock,
        },
        User: {
            findOne: userFindOneMock,
        },
    };
});

import { QuotaService } from '../quotaService.js';
import { QuotaRecord, User } from '../../models/index.js';

const mockFindOne = vi.mocked(QuotaRecord.findOne);
const mockFindOneAndUpdate = vi.mocked(QuotaRecord.findOneAndUpdate);
const mockUpdateMany = vi.mocked(QuotaRecord.updateMany);
const mockUserFindOne = vi.mocked(User.findOne);

beforeEach(() => {
    vi.clearAllMocks();

    // Default: today's quota row already exists, so ensureTodayRecord short-circuits.
    mockFindOne.mockReturnValue({
        select: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue({ _id: 'quota_row_1' }),
        }),
    } as never);

    // Safety default for branches that may call user lookup.
    mockUserFindOne.mockReturnValue({
        select: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue({ _id: 'user_row_1' }),
        }),
    } as never);
});

// ============================================
// computeWeight — pure function, no DB needed
// ============================================

describe('QuotaService.computeWeight', () => {
    // Unit tests for edge cases (Task 2.3)
    it('returns 1 for (0, 0)', () => {
        expect(QuotaService.computeWeight(0, 0)).toBe(1);
    });

    it('returns 2 for (50, 100)', () => {
        expect(QuotaService.computeWeight(50, 100)).toBe(2);
    });

    // ceil(1/50)=1, ceil(1/100)=1 → max(1, 1+1) = 2
    it('returns 2 for (1, 1)', () => {
        expect(QuotaService.computeWeight(1, 1)).toBe(2);
    });

    it('returns 4 for (100, 200)', () => {
        expect(QuotaService.computeWeight(100, 200)).toBe(4);
    });

    // Property test (Task 2.2)
    // Feature: user-data-management-and-platform, Property 9: Compute weight formula consistency
    it('matches formula for all (nodeCount, memberCount) pairs', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 10000 }),
                fc.integer({ min: 0, max: 10000 }),
                (nodeCount, memberCount) => {
                    const expected = Math.max(
                        1,
                        Math.ceil(nodeCount / 50) + Math.ceil(memberCount / 100)
                    );
                    expect(QuotaService.computeWeight(nodeCount, memberCount)).toBe(expected);
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ============================================
// get — upserts today's quota row
// ============================================

describe('QuotaService.get', () => {
    it('calls findOneAndUpdate with upsert:true and setOnInsert defaults', async () => {
        const fakeRecord = {
            clerkId: 'user_abc',
            userId: 'uid_123',
            windowDate: new Date().toISOString().slice(0, 10),
            projectsCreated: 0,
            computeUnitsUsed: 0,
        };
        mockFindOneAndUpdate.mockResolvedValueOnce(fakeRecord as never);

        const result = await QuotaService.get('user_abc', 'uid_123');

        expect(mockFindOneAndUpdate).toHaveBeenCalledOnce();
        const [filter, update, options] = mockFindOneAndUpdate.mock.calls[0];
        expect(filter).toMatchObject({ clerkId: 'user_abc' });
        expect(update).toHaveProperty('$setOnInsert');
        expect((update as Record<string, unknown>)['$setOnInsert']).toMatchObject({
            projectsCreated: 0,
            computeUnitsUsed: 0,
        });
        expect(options).toMatchObject({ upsert: true, new: true });
        expect(result).toEqual(fakeRecord);
    });
});

// ============================================
// deductComputeUnits — atomic $inc
// ============================================

describe('QuotaService.deductComputeUnits', () => {
    it('increments computeUnitsUsed by the given weight', async () => {
        mockFindOneAndUpdate.mockResolvedValueOnce(null as never);

        await QuotaService.deductComputeUnits('user_abc', 3);

        expect(mockFindOneAndUpdate).toHaveBeenCalledOnce();
        const [, update] = mockFindOneAndUpdate.mock.calls[0];
        expect((update as Record<string, unknown>)['$inc']).toMatchObject({ computeUnitsUsed: 3 });
    });
});

// ============================================
// incrementProjects — atomic $inc
// ============================================

describe('QuotaService.incrementProjects', () => {
    it('increments projectsCreated by 1', async () => {
        mockFindOneAndUpdate.mockResolvedValueOnce(null as never);

        await QuotaService.incrementProjects('user_abc');

        expect(mockFindOneAndUpdate).toHaveBeenCalledOnce();
        const [, update] = mockFindOneAndUpdate.mock.calls[0];
        expect((update as Record<string, unknown>)['$inc']).toMatchObject({ projectsCreated: 1 });
    });
});

// ============================================
// reset — zeroes today's counters
// ============================================

describe('QuotaService.reset', () => {
    it('sets both counters to 0 for today', async () => {
        mockFindOneAndUpdate.mockResolvedValueOnce(null as never);

        await QuotaService.reset('user_abc');

        expect(mockFindOneAndUpdate).toHaveBeenCalledOnce();
        const [, update] = mockFindOneAndUpdate.mock.calls[0];
        expect((update as Record<string, unknown>)['$set']).toMatchObject({
            projectsCreated: 0,
            computeUnitsUsed: 0,
        });
    });
});

// ============================================
// resetAll — zeroes past-window records
// ============================================

describe('QuotaService.resetAll', () => {
    it('calls updateMany with windowDate < today and zeroes counters', async () => {
        mockUpdateMany.mockResolvedValueOnce({ modifiedCount: 5 } as never);

        await QuotaService.resetAll();

        expect(mockUpdateMany).toHaveBeenCalledOnce();
        const [filter, update] = mockUpdateMany.mock.calls[0];
        const today = new Date().toISOString().slice(0, 10);
        expect((filter as Record<string, unknown>)['windowDate']).toMatchObject({ $lt: today });
        expect((update as Record<string, unknown>)['$set']).toMatchObject({
            projectsCreated: 0,
            computeUnitsUsed: 0,
        });
    });
});
