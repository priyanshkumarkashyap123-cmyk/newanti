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
];

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
    console.log(`[migrations] Connected to ${mongoose.connection.host}/${mongoose.connection.name}`);
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
        console.log('[migrations] No pending migrations.');
        return { applied: [], skipped: MIGRATIONS.map((m) => m.name) };
    }

    console.log(`[migrations] ${pending.length} pending migration(s) to apply.`);
    const newlyApplied: string[] = [];

    for (const entry of pending) {
        const mod = await entry.module();
        const start = Date.now();
        console.log(`[migrations] Applying: ${entry.name} — ${mod.description}`);

        try {
            await mod.up(db);
            const durationMs = Date.now() - start;

            await MigrationModel.create({
                name: entry.name,
                description: mod.description,
                appliedAt: new Date(),
                durationMs,
            });

            console.log(`[migrations] ✓ ${entry.name} (${durationMs}ms)`);
            newlyApplied.push(entry.name);
        } catch (err) {
            console.error(`[migrations] ✗ ${entry.name} FAILED:`, err);
            throw err; // Stop on first failure — no partial runs
        }
    }

    return { applied: newlyApplied, skipped: applied };
}

export async function showStatus(): Promise<void> {
    await connectDB();
    const applied = await getAppliedMigrations();

    console.log('\n Migration Status');
    console.log('─'.repeat(60));

    for (const entry of MIGRATIONS) {
        const isApplied = applied.includes(entry.name);
        const status = isApplied ? '✓ applied' : '○ pending';
        console.log(`  ${status}  ${entry.name}`);
    }

    console.log('─'.repeat(60));
    console.log(`  Total: ${MIGRATIONS.length}  Applied: ${applied.length}  Pending: ${MIGRATIONS.length - applied.length}\n`);
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
                    console.log('[migrations] Nothing to roll back.');
                } else {
                    const last = applied[applied.length - 1]!;
                    const entry = MIGRATIONS.find((m) => m.name === last);
                    if (!entry) {
                        console.error(`[migrations] Cannot find module for ${last}`);
                        process.exit(1);
                    }
                    const mod = await entry.module();
                    console.log(`[migrations] Rolling back: ${last}`);
                    await mod.down(mongoose.connection);
                    await MigrationModel.deleteOne({ name: last });
                    console.log(`[migrations] ✓ Rolled back ${last}`);
                }
            } else {
                await runPendingMigrations();
            }
        } catch (err) {
            console.error('[migrations] Fatal error:', err);
            process.exit(1);
        } finally {
            await mongoose.disconnect();
        }
    })();
}
