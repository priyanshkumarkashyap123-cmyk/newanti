import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import mongoose from 'mongoose';

import { getRegisteredMigrationNames } from '../src/migrations/runner.js';

function fail(message: string): never {
  throw new Error(`[migration-preflight] ${message}`);
}

function ensureMonotonicOrder(names: string[]): void {
  const sorted = [...names].sort();
  const sameOrder = sorted.every((name, idx) => name === names[idx]);
  if (!sameOrder) {
    fail('Migration registry is not in chronological order.');
  }
}

function ensureUnique(names: string[]): void {
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) {
      fail(`Duplicate migration registration detected: ${name}`);
    }
    seen.add(name);
  }
}

async function checkOptionalDbConnectivity(): Promise<void> {
  if (process.env['MIGRATION_PREFLIGHT_CONNECT'] !== 'true') {
    return;
  }

  const uri = process.env['MONGODB_URI'] || process.env['MONGO_URI'];
  if (!uri) {
    fail('MIGRATION_PREFLIGHT_CONNECT=true requires MONGODB_URI or MONGO_URI');
  }

  await mongoose.connect(uri);
  await mongoose.connection.db?.admin().ping();
  await mongoose.disconnect();
}

async function main(): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const migrationsDir = path.resolve(__dirname, '../src/migrations');

  const registered = getRegisteredMigrationNames();
  if (registered.length === 0) {
    fail('No migrations registered in runner.ts');
  }

  ensureUnique(registered);
  ensureMonotonicOrder(registered);

  const allMigrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((name) => /^\d{14}_.+\.ts$/.test(name))
    .map((name) => name.replace(/\.ts$/, ''))
    .sort();

  const missingFromDisk = registered.filter(
    (name) => !allMigrationFiles.includes(name),
  );
  if (missingFromDisk.length > 0) {
    fail(`Registered migrations missing on disk: ${missingFromDisk.join(', ')}`);
  }

  const unregisteredFiles = allMigrationFiles.filter(
    (name) => !registered.includes(name),
  );
  if (unregisteredFiles.length > 0) {
    fail(`Migration files not registered in runner.ts: ${unregisteredFiles.join(', ')}`);
  }

  await checkOptionalDbConnectivity();

  console.log('[migration-preflight] OK');
  console.log(`[migration-preflight] Registered migrations: ${registered.length}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
