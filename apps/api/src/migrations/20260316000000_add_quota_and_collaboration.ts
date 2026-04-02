/**
 * Migration: Add quota_records and collaboration_invites collections + indexes
 *
 * Creates the collections and indexes required for:
 * - Per-user daily quota tracking (QuotaRecord)
 * - Project collaboration invites (CollaborationInvite)
 */

import type mongoose from 'mongoose';
import type { IndexSpecification } from 'mongodb';
// MigrationModule type retained for interface consistency.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { MigrationModule } from './runner.js';

export const description = 'Add quota_records and collaboration_invites collections and indexes';

export const up = async (db: mongoose.Connection): Promise<void> => {
    const collections = await db.db!.listCollections().toArray();
    const collNames = new Set(collections.map((c) => c.name));

    const ensureIndex = async (
        collName: string,
        key: IndexSpecification,
        options: Record<string, unknown> = {}
    ) => {
        const existing = await db.collection(collName).listIndexes().toArray();
        const found = existing.find((idx) => JSON.stringify(idx.key) === JSON.stringify(key));
        if (found) {
            console.log(`Index on ${collName} ${JSON.stringify(key)} already exists as ${found.name}, skipping`);
            return;
        }
        await db.collection(collName).createIndex(key, options);
    };

    // ============================================
    // 1. QUOTA RECORDS
    // ============================================
    if (!collNames.has('quotarecords')) {
        await db.db!.createCollection('quotarecords');
    }

    // Unique: one record per user per UTC date
    await ensureIndex('quotarecords', { clerkId: 1, windowDate: 1 }, {
        unique: true,
        name: 'idx_quotarecords_clerkid_windowdate_unique',
    });
    await ensureIndex('quotarecords', { userId: 1, windowDate: 1 }, {
        name: 'idx_quotarecords_userid_windowdate',
    });

    // ============================================
    // 2. COLLABORATION INVITES
    // ============================================
    if (!collNames.has('collaborationinvites')) {
        await db.db!.createCollection('collaborationinvites');
    }

    // Unique: one invite per project per invitee
    await ensureIndex('collaborationinvites', { projectId: 1, inviteeId: 1 }, {
        unique: true,
        name: 'idx_collaborationinvites_project_invitee_unique',
    });
    await ensureIndex('collaborationinvites', { projectId: 1 }, {
        name: 'idx_collaborationinvites_projectid',
    });
    await ensureIndex('collaborationinvites', { inviteeClerkId: 1, status: 1 }, {
        name: 'idx_collaborationinvites_inviteeclerkid_status',
    });
};

export const down = async (db: mongoose.Connection): Promise<void> => {
    const tryDrop = async (coll: string, name: string) => {
        try {
            await db.collection(coll).dropIndex(name);
        } catch {
            /* Index doesn't exist — ignore */
        }
    };

    await tryDrop('quotarecords', 'idx_quotarecords_clerkid_windowdate_unique');
    await tryDrop('quotarecords', 'idx_quotarecords_userid_windowdate');

    await tryDrop('collaborationinvites', 'idx_collaborationinvites_project_invitee_unique');
    await tryDrop('collaborationinvites', 'idx_collaborationinvites_projectid');
    await tryDrop('collaborationinvites', 'idx_collaborationinvites_inviteeclerkid_status');
};
