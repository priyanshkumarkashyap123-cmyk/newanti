import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
const MIGRATIONS = [
  {
    name: "20250101000000_add_indexes",
    module: () => import("./20250101000000_add_indexes.js")
  }
];
const migrationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, default: "" },
    appliedAt: { type: Date, default: Date.now },
    durationMs: { type: Number, default: 0 }
  },
  { collection: "_migrations" }
);
const MigrationModel = mongoose.models["_Migration"] || mongoose.model("_Migration", migrationSchema);
async function connectDB() {
  const uri = process.env["MONGODB_URI"] || process.env["MONGO_URI"] || "mongodb://localhost:27017/beamlab";
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
  console.log(`[migrations] Connected to ${mongoose.connection.host}/${mongoose.connection.name}`);
  return mongoose.connection;
}
async function getAppliedMigrations() {
  const records = await MigrationModel.find({}).sort({ appliedAt: 1 }).lean();
  return records.map((r) => r.name);
}
async function runPendingMigrations() {
  const db = await connectDB();
  const applied = await getAppliedMigrations();
  const pending = MIGRATIONS.filter((m) => !applied.includes(m.name));
  if (pending.length === 0) {
    console.log("[migrations] No pending migrations.");
    return { applied: [], skipped: MIGRATIONS.map((m) => m.name) };
  }
  console.log(`[migrations] ${pending.length} pending migration(s) to apply.`);
  const newlyApplied = [];
  for (const entry of pending) {
    const mod = await entry.module();
    const start = Date.now();
    console.log(`[migrations] Applying: ${entry.name} \u2014 ${mod.description}`);
    try {
      await mod.up(db);
      const durationMs = Date.now() - start;
      await MigrationModel.create({
        name: entry.name,
        description: mod.description,
        appliedAt: /* @__PURE__ */ new Date(),
        durationMs
      });
      console.log(`[migrations] \u2713 ${entry.name} (${durationMs}ms)`);
      newlyApplied.push(entry.name);
    } catch (err) {
      console.error(`[migrations] \u2717 ${entry.name} FAILED:`, err);
      throw err;
    }
  }
  return { applied: newlyApplied, skipped: applied };
}
async function showStatus() {
  await connectDB();
  const applied = await getAppliedMigrations();
  console.log("\n Migration Status");
  console.log("\u2500".repeat(60));
  for (const entry of MIGRATIONS) {
    const isApplied = applied.includes(entry.name);
    const status = isApplied ? "\u2713 applied" : "\u25CB pending";
    console.log(`  ${status}  ${entry.name}`);
  }
  console.log("\u2500".repeat(60));
  console.log(`  Total: ${MIGRATIONS.length}  Applied: ${applied.length}  Pending: ${MIGRATIONS.length - applied.length}
`);
}
const __filename = fileURLToPath(import.meta.url);
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isMain) {
  const arg = process.argv[2];
  (async () => {
    try {
      if (arg === "--status") {
        await showStatus();
      } else if (arg === "--down") {
        await connectDB();
        const applied = await getAppliedMigrations();
        if (applied.length === 0) {
          console.log("[migrations] Nothing to roll back.");
        } else {
          const last = applied[applied.length - 1];
          const entry = MIGRATIONS.find((m) => m.name === last);
          if (!entry) {
            console.error(`[migrations] Cannot find module for ${last}`);
            process.exit(1);
          }
          const mod = await entry.module();
          console.log(`[migrations] Rolling back: ${last}`);
          await mod.down(mongoose.connection);
          await MigrationModel.deleteOne({ name: last });
          console.log(`[migrations] \u2713 Rolled back ${last}`);
        }
      } else {
        await runPendingMigrations();
      }
    } catch (err) {
      console.error("[migrations] Fatal error:", err);
      process.exit(1);
    } finally {
      await mongoose.disconnect();
    }
  })();
}
export {
  getAppliedMigrations,
  runPendingMigrations,
  showStatus
};
//# sourceMappingURL=runner.js.map
