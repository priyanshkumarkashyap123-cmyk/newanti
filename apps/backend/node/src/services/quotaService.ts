/**
 * QuotaService - Per-user daily quota tracking and enforcement
 *
 * Tracks projects created and compute units consumed per user per UTC day.
 * Uses MongoDB upsert for atomic, race-condition-safe operations.
 */

import { QuotaRecord, IQuotaRecord } from '../models/index.js';
import { User } from '../models/index.js';
import { logger } from '../utils/logger.js';

// Returns today's date as 'YYYY-MM-DD' in UTC
function todayUTC(): string {
    return new Date().toISOString().slice(0, 10);
}

async function ensureTodayRecord(clerkId: string): Promise<void> {
    const windowDate = todayUTC();

    const existing = await QuotaRecord.findOne({ clerkId, windowDate }).select('_id').lean();
    if (existing) return;

    const user = await User.findOne({ clerkId }).select('_id').lean();
    if (!user?._id) {
        throw new Error(`QuotaService: user not found for clerkId=${clerkId}`);
    }

    await QuotaRecord.findOneAndUpdate(
        { clerkId, windowDate },
        {
            $setOnInsert: {
                clerkId,
                userId: user._id,
                windowDate,
                projectsCreated: 0,
                computeUnitsUsed: 0,
            },
        },
        { upsert: true, setDefaultsOnInsert: true }
    );
}

/**
 * Compute the weight (Compute_Units) for an analysis job.
 * Formula: Math.max(1, ceil(nodeCount / 50) + ceil(memberCount / 100))
 * Requirement 4.1
 */
function computeWeight(nodeCount: number, memberCount: number): number {
    return Math.max(1, Math.ceil(nodeCount / 50) + Math.ceil(memberCount / 100));
}

/**
 * Get (or lazily create) today's quota record for a user.
 * Uses upsert so the first call of the day creates the row atomically.
 */
async function get(clerkId: string, userId: string): Promise<IQuotaRecord> {
    const windowDate = todayUTC();
    const record = await QuotaRecord.findOneAndUpdate(
        { clerkId, windowDate },
        {
            $setOnInsert: {
                clerkId,
                userId,
                windowDate,
                projectsCreated: 0,
                computeUnitsUsed: 0,
            },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return record as IQuotaRecord;
}

/**
 * Atomically deduct compute units from today's quota record.
 * Requirement 4.2
 */
async function deductComputeUnits(clerkId: string, weight: number): Promise<void> {
    if (!Number.isFinite(weight) || weight <= 0) {
        throw new Error(`QuotaService: invalid compute unit deduction weight=${weight}`);
    }

    await ensureTodayRecord(clerkId);
    const windowDate = todayUTC();
    const result = await QuotaRecord.findOneAndUpdate(
        { clerkId, windowDate },
        { $inc: { computeUnitsUsed: weight } }
    );

    if (!result) {
        logger.warn({ clerkId, windowDate }, '[QuotaService] deductComputeUnits had no matching record after ensureTodayRecord');
    }
}

/**
 * Atomically increment the projects-created counter for today.
 * Requirement 3.1
 */
async function incrementProjects(clerkId: string): Promise<void> {
    await ensureTodayRecord(clerkId);
    const windowDate = todayUTC();
    const result = await QuotaRecord.findOneAndUpdate(
        { clerkId, windowDate },
        { $inc: { projectsCreated: 1 } }
    );

    if (!result) {
        logger.warn({ clerkId, windowDate }, '[QuotaService] incrementProjects had no matching record after ensureTodayRecord');
    }
}

/**
 * Reset today's quota counters for a specific user (e.g. admin override).
 */
async function reset(clerkId: string): Promise<void> {
    await ensureTodayRecord(clerkId);
    const windowDate = todayUTC();
    const result = await QuotaRecord.findOneAndUpdate(
        { clerkId, windowDate },
        { $set: { projectsCreated: 0, computeUnitsUsed: 0 } }
    );

    if (!result) {
        logger.warn({ clerkId, windowDate }, '[QuotaService] reset had no matching record after ensureTodayRecord');
    }
}

/**
 * Reset all quota records for windows before today (cron job at UTC midnight).
 * Requirement 3.5
 */
async function resetAll(): Promise<void> {
    const windowDate = todayUTC();
    await QuotaRecord.updateMany(
        { windowDate: { $lt: windowDate } },
        { $set: { projectsCreated: 0, computeUnitsUsed: 0 } }
    );
}

export const QuotaService = {
    computeWeight,
    get,
    deductComputeUnits,
    incrementProjects,
    reset,
    resetAll,
};

export default QuotaService;
