/**
 * Migration: Add missing database indexes
 *
 * Creates performance-critical indexes that should exist but were never
 * formally tracked. This is the baseline migration.
 */

import type mongoose from 'mongoose';
import type { MigrationModule } from './runner.js';

export const description = 'Add missing performance indexes on users, projects, and tokens';

export const up = async (db: mongoose.Connection): Promise<void> => {
    // Users – lookup by email is the most common auth query
    await db.collection('users').createIndex(
        { email: 1 },
        { unique: true, name: 'idx_users_email_unique' }
    );
    await db.collection('users').createIndex(
        { role: 1, subscriptionTier: 1 },
        { name: 'idx_users_role_tier' }
    );
    await db.collection('users').createIndex(
        { createdAt: -1 },
        { name: 'idx_users_created_desc' }
    );

    // Projects – owner lookup + sorting by last update
    await db.collection('projects').createIndex(
        { owner: 1, updatedAt: -1 },
        { name: 'idx_projects_owner_updated' }
    );
    await db.collection('projects').createIndex(
        { isPublic: 1, updatedAt: -1 },
        { name: 'idx_projects_public_updated' }
    );

    // Refresh tokens – lookup by token value is hot path
    await db.collection('refreshtokens').createIndex(
        { token: 1 },
        { unique: true, name: 'idx_refreshtokens_token_unique' }
    );
    await db.collection('refreshtokens').createIndex(
        { userId: 1 },
        { name: 'idx_refreshtokens_userid' }
    );
    // Auto-expire stale tokens (TTL index)
    await db.collection('refreshtokens').createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0, name: 'idx_refreshtokens_expire' }
    );

    // Verification codes – TTL + lookup
    await db.collection('verificationcodes').createIndex(
        { userId: 1, type: 1 },
        { name: 'idx_verificationcodes_user_type' }
    );
    await db.collection('verificationcodes').createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0, name: 'idx_verificationcodes_expire' }
    );

    // Analysis results – fast retrieval by project
    const collections = await db.db!.listCollections().toArray();
    const collNames = collections.map((c) => c.name);

    if (collNames.includes('analysisresults')) {
        await db.collection('analysisresults').createIndex(
            { projectId: 1, createdAt: -1 },
            { name: 'idx_analysisresults_project_created' }
        );
    }
};

export const down = async (db: mongoose.Connection): Promise<void> => {
    const tryDrop = async (coll: string, name: string) => {
        try {
            await db.collection(coll).dropIndex(name);
        } catch {
            // Index doesn't exist — ignore
        }
    };

    await tryDrop('users', 'idx_users_email_unique');
    await tryDrop('users', 'idx_users_role_tier');
    await tryDrop('users', 'idx_users_created_desc');
    await tryDrop('projects', 'idx_projects_owner_updated');
    await tryDrop('projects', 'idx_projects_public_updated');
    await tryDrop('refreshtokens', 'idx_refreshtokens_token_unique');
    await tryDrop('refreshtokens', 'idx_refreshtokens_userid');
    await tryDrop('refreshtokens', 'idx_refreshtokens_expire');
    await tryDrop('verificationcodes', 'idx_verificationcodes_user_type');
    await tryDrop('verificationcodes', 'idx_verificationcodes_expire');
    await tryDrop('analysisresults', 'idx_analysisresults_project_created');
};

export default { description, up, down } satisfies MigrationModule;
