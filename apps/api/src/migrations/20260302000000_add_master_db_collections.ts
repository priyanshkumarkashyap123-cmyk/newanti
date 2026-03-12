/**
 * Migration: Add DeviceSession, AnalysisResult, ReportGeneration, UsageLog collections + indexes
 *
 * This migration creates the collections and performance-critical indexes
 * for the new database management system:
 * - Device session tracking (multi-device enforcement)
 * - Persistent analysis results
 * - Report generation tracking
 * - Usage monitoring logs
 * - Enhanced User schema indexes
 */

import type mongoose from 'mongoose';
import type { MigrationModule } from './runner.js';

export const description = 'Add device sessions, analysis results, reports, usage logs collections and indexes';

export const up = async (db: mongoose.Connection): Promise<void> => {
    const collections = await db.db!.listCollections().toArray();
    const collNames = new Set(collections.map((c) => c.name));

    // Helper to create index only when an equivalent key doesn't already exist
    const ensureIndex = async (
        collName: string,
        key: Record<string, number>,
        options: Record<string, unknown> = {}
    ) => {
        const existing = await db.collection(collName).listIndexes().toArray();
        const found = existing.find((idx) => JSON.stringify(idx.key) === JSON.stringify(key));
        if (found) {
            // Index with same key exists — skip
             
            console.log(`Index on ${collName} ${JSON.stringify(key)} already exists as ${found.name}, skipping`);
            return;
        }
        await db.collection(collName).createIndex(key, options);
    };

    // ============================================
    // 1. DEVICE SESSIONS
    // ============================================
    if (!collNames.has('devicesessions')) {
        await db.db!.createCollection('devicesessions');
    }

    await ensureIndex('devicesessions', { clerkId: 1, isActive: 1 }, { name: 'idx_devicesessions_clerk_active' });
    await ensureIndex('devicesessions', { clerkId: 1, deviceId: 1 }, { name: 'idx_devicesessions_clerk_device' });
    await ensureIndex('devicesessions', { clerkId: 1, isAnalysisLocked: 1 }, { name: 'idx_devicesessions_clerk_analysislock' });
    await ensureIndex('devicesessions', { userId: 1 }, { name: 'idx_devicesessions_userid' });
    // TTL: auto-expire after expiresAt
    await ensureIndex('devicesessions', { expiresAt: 1 }, { expireAfterSeconds: 0, name: 'idx_devicesessions_expire' });
    // TTL: auto-clean stale heartbeats (24h)
    await ensureIndex('devicesessions', { lastHeartbeat: 1 }, {
        expireAfterSeconds: 86400,
        partialFilterExpression: { isActive: true },
        name: 'idx_devicesessions_heartbeat_stale'
    });

    // ============================================
    // 2. ANALYSIS RESULTS (persistent)
    // ============================================
    if (!collNames.has('analysisresults')) {
        await db.db!.createCollection('analysisresults');
    }

    await ensureIndex('analysisresults', { clerkId: 1, createdAt: -1 }, { name: 'idx_analysisresults_clerk_created' });
    await ensureIndex('analysisresults', { projectId: 1, analysisType: 1 }, { name: 'idx_analysisresults_project_type' });
    await ensureIndex('analysisresults', { clerkId: 1, analysisType: 1, createdAt: -1 }, { name: 'idx_analysisresults_clerk_type_created' });
    await ensureIndex('analysisresults', { userId: 1 }, { name: 'idx_analysisresults_userid' });

    // ============================================
    // 3. REPORT GENERATIONS
    // ============================================
    if (!collNames.has('reportgenerations')) {
        await db.db!.createCollection('reportgenerations');
    }

    await ensureIndex('reportgenerations', { clerkId: 1, createdAt: -1 }, { name: 'idx_reportgenerations_clerk_created' });
    await ensureIndex('reportgenerations', { projectId: 1 }, { name: 'idx_reportgenerations_project' });
    await ensureIndex('reportgenerations', { reportType: 1, format: 1 }, { name: 'idx_reportgenerations_type_format' });
    await ensureIndex('reportgenerations', { userId: 1 }, { name: 'idx_reportgenerations_userid' });

    // ============================================
    // 4. USAGE LOGS
    // ============================================
    if (!collNames.has('usagelogs')) {
        await db.db!.createCollection('usagelogs');
    }

    await ensureIndex('usagelogs', { createdAt: -1 }, { name: 'idx_usagelogs_created_desc' });
    await ensureIndex('usagelogs', { clerkId: 1, createdAt: -1 }, { name: 'idx_usagelogs_clerk_created' });
    await ensureIndex('usagelogs', { category: 1, createdAt: -1 }, { name: 'idx_usagelogs_category_created' });
    await ensureIndex('usagelogs', { action: 1, createdAt: -1 }, { name: 'idx_usagelogs_action_created' });
    await ensureIndex('usagelogs', { email: 1, createdAt: -1 }, { name: 'idx_usagelogs_email_created' });
    // TTL: auto-purge logs older than 90 days
    await ensureIndex('usagelogs', { createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60, name: 'idx_usagelogs_ttl_90d' });

    // ============================================
    // 5. ENHANCED USER INDEXES
    // ============================================
    await ensureIndex('users', { lastActiveAt: -1 }, { name: 'idx_users_lastactive_desc' });
    await ensureIndex('users', { 'activityLog.timestamp': -1 }, { name: 'idx_users_activitylog_ts' });
    await ensureIndex('users', { activeAnalysisDeviceId: 1 }, { sparse: true, name: 'idx_users_analysis_device' });
};

export const down = async (db: mongoose.Connection): Promise<void> => {
    const tryDrop = async (coll: string, name: string) => {
        try {
            await db.collection(coll).dropIndex(name);
        } catch {
            /* Index doesn't exist — ignore */
        }
    };

    // Device sessions indexes
    await tryDrop('devicesessions', 'idx_devicesessions_clerk_active');
    await tryDrop('devicesessions', 'idx_devicesessions_clerk_device');
    await tryDrop('devicesessions', 'idx_devicesessions_clerk_analysislock');
    await tryDrop('devicesessions', 'idx_devicesessions_userid');
    await tryDrop('devicesessions', 'idx_devicesessions_expire');
    await tryDrop('devicesessions', 'idx_devicesessions_heartbeat_stale');

    // Analysis results indexes
    await tryDrop('analysisresults', 'idx_analysisresults_clerk_created');
    await tryDrop('analysisresults', 'idx_analysisresults_project_type');
    await tryDrop('analysisresults', 'idx_analysisresults_clerk_type_created');
    await tryDrop('analysisresults', 'idx_analysisresults_userid');

    // Report generations indexes
    await tryDrop('reportgenerations', 'idx_reportgenerations_clerk_created');
    await tryDrop('reportgenerations', 'idx_reportgenerations_project');
    await tryDrop('reportgenerations', 'idx_reportgenerations_type_format');
    await tryDrop('reportgenerations', 'idx_reportgenerations_userid');

    // Usage logs indexes
    await tryDrop('usagelogs', 'idx_usagelogs_created_desc');
    await tryDrop('usagelogs', 'idx_usagelogs_clerk_created');
    await tryDrop('usagelogs', 'idx_usagelogs_category_created');
    await tryDrop('usagelogs', 'idx_usagelogs_action_created');
    await tryDrop('usagelogs', 'idx_usagelogs_email_created');
    await tryDrop('usagelogs', 'idx_usagelogs_ttl_90d');

    // User indexes
    await tryDrop('users', 'idx_users_lastactive_desc');
    await tryDrop('users', 'idx_users_activitylog_ts');
    await tryDrop('users', 'idx_users_analysis_device');
};
