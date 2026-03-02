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

    // ============================================
    // 1. DEVICE SESSIONS
    // ============================================
    if (!collNames.has('devicesessions')) {
        await db.db!.createCollection('devicesessions');
    }

    await db.collection('devicesessions').createIndex(
        { clerkId: 1, isActive: 1 },
        { name: 'idx_devicesessions_clerk_active' }
    );
    await db.collection('devicesessions').createIndex(
        { clerkId: 1, deviceId: 1 },
        { name: 'idx_devicesessions_clerk_device' }
    );
    await db.collection('devicesessions').createIndex(
        { clerkId: 1, isAnalysisLocked: 1 },
        { name: 'idx_devicesessions_clerk_analysislock' }
    );
    await db.collection('devicesessions').createIndex(
        { userId: 1 },
        { name: 'idx_devicesessions_userid' }
    );
    // TTL: auto-expire after expiresAt
    await db.collection('devicesessions').createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0, name: 'idx_devicesessions_expire' }
    );
    // TTL: auto-clean stale heartbeats (24h)
    await db.collection('devicesessions').createIndex(
        { lastHeartbeat: 1 },
        {
            expireAfterSeconds: 86400,
            partialFilterExpression: { isActive: true },
            name: 'idx_devicesessions_heartbeat_stale'
        }
    );

    // ============================================
    // 2. ANALYSIS RESULTS (persistent)
    // ============================================
    if (!collNames.has('analysisresults')) {
        await db.db!.createCollection('analysisresults');
    }

    await db.collection('analysisresults').createIndex(
        { clerkId: 1, createdAt: -1 },
        { name: 'idx_analysisresults_clerk_created' }
    );
    await db.collection('analysisresults').createIndex(
        { projectId: 1, analysisType: 1 },
        { name: 'idx_analysisresults_project_type' }
    );
    await db.collection('analysisresults').createIndex(
        { clerkId: 1, analysisType: 1, createdAt: -1 },
        { name: 'idx_analysisresults_clerk_type_created' }
    );
    await db.collection('analysisresults').createIndex(
        { userId: 1 },
        { name: 'idx_analysisresults_userid' }
    );

    // ============================================
    // 3. REPORT GENERATIONS
    // ============================================
    if (!collNames.has('reportgenerations')) {
        await db.db!.createCollection('reportgenerations');
    }

    await db.collection('reportgenerations').createIndex(
        { clerkId: 1, createdAt: -1 },
        { name: 'idx_reportgenerations_clerk_created' }
    );
    await db.collection('reportgenerations').createIndex(
        { projectId: 1 },
        { name: 'idx_reportgenerations_project' }
    );
    await db.collection('reportgenerations').createIndex(
        { reportType: 1, format: 1 },
        { name: 'idx_reportgenerations_type_format' }
    );
    await db.collection('reportgenerations').createIndex(
        { userId: 1 },
        { name: 'idx_reportgenerations_userid' }
    );

    // ============================================
    // 4. USAGE LOGS
    // ============================================
    if (!collNames.has('usagelogs')) {
        await db.db!.createCollection('usagelogs');
    }

    await db.collection('usagelogs').createIndex(
        { createdAt: -1 },
        { name: 'idx_usagelogs_created_desc' }
    );
    await db.collection('usagelogs').createIndex(
        { clerkId: 1, createdAt: -1 },
        { name: 'idx_usagelogs_clerk_created' }
    );
    await db.collection('usagelogs').createIndex(
        { category: 1, createdAt: -1 },
        { name: 'idx_usagelogs_category_created' }
    );
    await db.collection('usagelogs').createIndex(
        { action: 1, createdAt: -1 },
        { name: 'idx_usagelogs_action_created' }
    );
    await db.collection('usagelogs').createIndex(
        { email: 1, createdAt: -1 },
        { name: 'idx_usagelogs_email_created' }
    );
    // TTL: auto-purge logs older than 90 days
    await db.collection('usagelogs').createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: 90 * 24 * 60 * 60, name: 'idx_usagelogs_ttl_90d' }
    );

    // ============================================
    // 5. ENHANCED USER INDEXES
    // ============================================
    try {
        await db.collection('users').createIndex(
            { lastActiveAt: -1 },
            { name: 'idx_users_lastactive_desc' }
        );
    } catch { /* Index may already exist */ }

    try {
        await db.collection('users').createIndex(
            { 'activityLog.timestamp': -1 },
            { name: 'idx_users_activitylog_ts' }
        );
    } catch { /* Index may already exist */ }

    try {
        await db.collection('users').createIndex(
            { activeAnalysisDeviceId: 1 },
            { sparse: true, name: 'idx_users_analysis_device' }
        );
    } catch { /* Index may already exist */ }
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
