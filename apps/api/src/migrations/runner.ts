/**
 * Database Migration Runner for MongoDB/Mongoose
 *
 * Lightweight, framework-free migration system that tracks applied
 * migrations in a `_migrations` collection.
 *
 * Usage:
 *   npx tsx src/migrations/runner.ts          # run pending migrations
 *   npx tsx src/migrations/runner.ts --status  # show migration status
 *
 * Adding a new migration:
 *   1. Create a file in src/migrations/ named YYYYMMDDHHMMSS_description.ts
 *   2. Export { up, down, description } matching the MigrationModule interface
 *   3. Register it in the MIGRATIONS array below
 */

import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

// ============================================
// TYPES
// ============================================

interface MigrationRecord {
    name: string;
    description: string;
    appliedAt: Date;
    durationMs: number;
}

export interface MigrationModule {
    description: string;
    up: (db: mongoose.Connection) => Promise<void>;
    down: (db: mongoose.Connection) => Promise<void>;
}

interface MigrationEntry {
    name: string;
    module: () => Promise<MigrationModule>;
}

// ============================================
// MIGRATION REGISTRY
// Add new migrations here in chronological order.
// ============================================

const MIGRATIONS: MigrationEntry[] = [
    {
        name: '20250101000000_add_indexes',
        module: () => import('./20250101000000_add_indexes.js'),
    },
    {
        name: '20260302000000_add_master_db_collections',
        module: () => import('./20260302000000_add_master_db_collections.js'),
    },
    {
        name: '20260316000000_add_quota_and_collaboration',
        module: () => import('./20260316000000_add_quota_and_collaboration.js'),
    },
    {
        name: '20260317010000_harden_billing_idempotency',
        module: () => import('./20260317010000_harden_billing_idempotency.js'),
    },
];

export function getRegisteredMigrationNames(): string[] {
    return MIGRATIONS.map((m) => m.name);
}

// ============================================
// MIGRATION COLLECTION SCHEMA
// ============================================

const migrationSchema = new mongoose.Schema<MigrationRecord>(
    {
        name: { type: String, required: true, unique: true },
        description: { type: String, default: '' },
        appliedAt: { type: Date, default: Date.now },
        durationMs: { type: Number, default: 0 },
    },
    { collection: '_migrations' }
);

const MigrationModel =
    mongoose.models['_Migration'] ||
    mongoose.model<MigrationRecord>('_Migration', migrationSchema);

// ============================================
// RUNNER
// ============================================

async function connectDB(): Promise<mongoose.Connection> {
    const uri =
        process.env['MONGODB_URI'] ||
        process.env['MONGO_URI'] ||
        'mongodb://localhost:27017/beamlab';
    
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(uri);
    }
    logger.info(`[migrations] Connected to ${mongoose.connection.host}/${mongoose.connection.name}`);
    return mongoose.connection;
}

export async function getAppliedMigrations(): Promise<string[]> {
    const records = await MigrationModel.find({}).sort({ appliedAt: 1 }).lean();
    return records.map((r: any) => r.name);
}

export async function runPendingMigrations(): Promise<{ applied: string[]; skipped: string[] }> {
    const db = await connectDB();
    const applied = await getAppliedMigrations();
    const pending = MIGRATIONS.filter((m) => !applied.includes(m.name));

    if (pending.length === 0) {
        logger.info('[migrations] No pending migrations.');
        return { applied: [], skipped: MIGRATIONS.map((m) => m.name) };
    }

    logger.info(`[migrations] ${pending.length} pending migration(s) to apply.`);
    const newlyApplied: string[] = [];

    for (const entry of pending) {
        const mod = await entry.module();
        const start = Date.now();
        logger.info(`[migrations] Applying: ${entry.name} -- ${mod.description}`);

        try {
            await mod.up(db);
            const durationMs = Date.now() - start;

            await MigrationModel.create({
                name: entry.name,
                description: mod.description,
                appliedAt: new Date(),
                durationMs,
            });

            logger.info(`[migrations] ${entry.name} applied (${durationMs}ms)`);
            newlyApplied.push(entry.name);
        } catch (err) {
            logger.error({ err }, `[migrations] ${entry.name} FAILED`);
            throw err; // Stop on first failure — no partial runs
        }
    }

    return { applied: newlyApplied, skipped: applied };
}

export async function showStatus(): Promise<void> {
    await connectDB();
    const applied = await getAppliedMigrations();

    logger.info('Migration Status');
    logger.info('─'.repeat(60));

    for (const entry of MIGRATIONS) {
        const isApplied = applied.includes(entry.name);
        const status = isApplied ? '✓ applied' : '○ pending';
        logger.info(`  ${status}  ${entry.name}`);
    }

    logger.info('─'.repeat(60));
    logger.info(`  Total: ${MIGRATIONS.length}  Applied: ${applied.length}  Pending: ${MIGRATIONS.length - applied.length}`);
}

// ============================================
// CLI ENTRY POINT
// ============================================

const __filename = fileURLToPath(import.meta.url);
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMain) {
    const arg = process.argv[2];

    (async () => {
        try {
            if (arg === '--status') {
                await showStatus();
            } else if (arg === '--down') {
                // Rollback last migration
                await connectDB();
                const applied = await getAppliedMigrations();
                if (applied.length === 0) {
                    logger.info('[migrations] Nothing to roll back.');
                } else {
                    const last = applied[applied.length - 1]!;
                    const entry = MIGRATIONS.find((m) => m.name === last);
                    if (!entry) {
                        logger.error(`[migrations] Cannot find module for ${last}`);
                        process.exit(1);
                    }
                    const mod = await entry.module();
                    logger.info(`[migrations] Rolling back: ${last}`);
                    await mod.down(mongoose.connection);
                    await MigrationModel.deleteOne({ name: last });
                    logger.info(`[migrations] Rolled back ${last}`);
                }
            } else {
                await runPendingMigrations();
            }
        } catch (err) {
            logger.error({ err }, '[migrations] Fatal error');
            process.exit(1);
        } finally {
            await mongoose.disconnect();
        }
    })();
}
