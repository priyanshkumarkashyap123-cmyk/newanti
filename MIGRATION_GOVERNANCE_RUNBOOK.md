# Migration Governance Runbook — BeamLab MongoDB

**Document Version**: 1.0  
**Last Updated**: Apr 2, 2026  
**Owner**: Database Team  
**Applies To**: All MongoDB migrations in production and staging environments

---

## Table of Contents

1. [Overview](#overview)
2. [Pre-Flight Checklist](#pre-flight-checklist)
3. [Migration Execution](#migration-execution)
4. [Post-Flight Verification](#post-flight-verification)
5. [Rollback Procedures](#rollback-procedures)
6. [Emergency Contacts](#emergency-contacts)

---

## Overview

BeamLab uses a lightweight, framework-free migration system that:

- Tracks applied migrations in a `_migrations` collection
- Supports reversible (up/down) migrations
- Prevents accidental double-application
- Logs execution time and status
- Works with MongoDB directly (no ORM coupling)

**System Location**: `apps/api/src/migrations/runner.ts`  
**Status Check Command**: `npx tsx src/migrations/runner.ts --status`

### Migration Types

| Type | Time | Risk | Example |
|---|---|---|---|
| **Index Creation** | 2-10 min | Low | Adding compound index on `(owner, createdAt)` |
| **Collection Creation** | <1 min | Very Low | Creating `quotarecords` collection |
| **Schema Update** | 5-30 min | Medium | Adding fields to existing documents |
| **Data Transformation** | 30 min - hours | High | Backfill `tierchangelog` from subscription history |

---

## Pre-Flight Checklist

### Step 1: Code Review (48 hours before execution)

- [ ] Migration file reviewed by >=2 engineers
- [ ] SQL/aggregation queries tested on staging with representative data size
- [ ] Rollback procedure documented and tested
- [ ] Index selectivity verified (cardinality check for new indexes)
- [ ] No hardcoded production data or credentials in migration
- [ ] Migration is idempotent (safe to re-run)

**Review Template**:
```markdown
## Code Review: [Migration Name]

**Duration Estimate**: [X] minutes  
**Risk Level**: [Low|Medium|High]  
**Rollback Type**: [Index Drop|Collection Drop|Data Restore|Forward Fix]

### Checklist
- [ ] Reviewed migration logic
- [ ] Verified rollback procedure
- [ ] No hardcoded secrets/credentials
- [ ] Idempotent (safe duplicate runs)
- [ ] Tested against staging data

**Questions**:
...
```

**Approval Required From**:
- [ ] Database Owner (team lead)
- [ ] Application Lead (validates impact)
- [ ] 1 Additional Senior Engineer

### Step 2: Staging Validation (24 hours before execution)

Run migration on a **production-like staging environment** with:
- Real data (sanitized prod snapshot if possible)
- Same MongoDB version
- Same network latency
- Same load (if possible)

```bash
# Connect to staging database
export MONGODB_URI="mongodb+srv://staging:password@staging.mongodb.net/beamlab"

# Check current migration status
npx tsx src/migrations/runner.ts --status

# Example output:
# ┌─ Migration Status ─────────────────────┐
# │ Applied:                              │
# │  • 20250101000000_add_indexes         │
# │  • 20260302000000_add_master_db...    │
# │ Pending:                              │
# │  • 20260401000000_new_migration       │
# └───────────────────────────────────────┘

# Run pending migrations
npx tsx src/migrations/runner.ts

# Verify success
npx tsx src/migrations/runner.ts --status

# Run smoke tests
npm run test:migrations
```

**Validation Criteria**:
- ✅ Migration completes without errors
- ✅ Indexes created/updated (verify with `db.collection.getIndexes()`)
- ✅ No spike in query latency
- ✅ Smoke tests pass
- ✅ Estimated runtime matches estimate (±20%)

### Step 3: Backup & Freeze (4 hours before execution)

```bash
# Take automated backup (assumes Azure automaton or cloud provider handles this)
# Verify backup completed
az backup container backup --name beamlab-mongo --vault-name beamlab-backup

# Notify team: "Maintenance window starting in 4 hours"
# Post in #devops Slack channel
echo "🔒 Maintenance window: [START_TIME] - [END_TIME] UTC
  Migration: [Name]
  Expected Duration: [X] minutes
  Impact: [no interruption / read-only mode / downtime]"

# Freeze new deployments
# (via CI/CD: disable deploy triggers or add manual approval gate)
```

---

## Migration Execution

### Phase 1: Pre-Execution (15 min before)

```bash
# 1. Final health check
curl https://beamlab-backend-node-prod.azurewebsites.net/health
# Expected: { healthy: true, mongodb: "connected" }

# 2. Record baseline metrics
echo "Checking baseline MongoDB metrics..."
mongosh $MONGODB_URI --eval "
  db.stats();
  db.currentOp();
  db.serverStatus().replication
"

# 3. Alert ops team: Ready to execute
echo "✅ Pre-execution checks passed. Proceeding with migration."
```

### Phase 2: Execute Migration (Maintenance Window)

```bash
# Recommended: Run during low-traffic window (2-6 AM UTC)

# Connect to production database
export MONGODB_URI="mongodb+srv://prod:password@prod-cluster.mongodb.net/beamlab"

# Start migration runner (with logging)
npx tsx src/migrations/runner.ts 2>&1 | tee migration-log-$(date +%s).txt

# Monitor output:
# [20.30s] Applying 20260401000000_new_migration...
# [20.31s] ✅ Successfully applied 20260401000000_new_migration (1023ms)
# [20.32s] All migrations up to date.

# Watch for errors:
# ❌ FATAL: Index already exists (probably idempotent, safe to retry)
# ❌ FATAL: Connection lost (network issue, check MongoDB cloud status)
```

**If Migration Hangs (>2x estimated time)**:

```bash
# 1. Check MongoDB oplog for long-running operations
mongosh $MONGODB_URI --eval "
  db.currentOp({ secs_running: { \$gte: 300 } })
"

# 2. Kill long-running operation (if safe)
# mongosh $MONGODB_URI --eval "db.killOp(123)"

# 3. If stuck: Roll back immediately (see Rollback section)
```

### Phase 3: Monitor During Migration

Keep these dashboards/logs open:

```bash
# Terminal 1: Migration log
tail -f migration-log-$(date +%s).txt

# Terminal 2: MongoDB performance
watch -n 5 'mongosh $MONGODB_URI --eval "db.stats(); db.serverStatus().replication"'

# Terminal 3: Application health
while true; do
  curl -s https://beamlab-backend-node-prod.azurewebsites.net/health | jq .
  sleep 10
done

# Terminal 4: Index creation progress (if creating large index)
mongosh $MONGODB_URI --eval "
  db.currentOp({
    'command.createIndexes': { \$exists: true }
  })
"
```

**Abort Criteria**:
- Application returns HTTP 500 errors
- MongoDB connection pool exhausted
- CPU spike >80% sustained
- Memory usage >90%
- Replica lag >30 seconds

---

## Post-Flight Verification

### Immediate (Within 1 hour)

```bash
# 1. Confirm migration applied
npx tsx src/migrations/runner.ts --status
# Expected: New migration in "Applied" list

# 2. Verify indexes exist
mongosh $MONGODB_URI --eval "
  db.getCollectionNames().forEach(coll => {
    const indexes = db[coll].getIndexes();
    if (indexes.length > 1) { // >1 = at least one non-_id index
      console.log(coll + ': ' + indexes.length + ' indexes');
    }
  });
"

# 3. Query performance spot-check
mongosh $MONGODB_URI --eval "
  const start = Date.now();
  db.projects.find({ owner: ObjectId('example'), createdAt: { \$gte: ISODate('2026-01-01') } })
    .sort({ createdAt: -1 })
    .limit(10)
    .explain('executionStats');
  console.log('Query time: ' + (Date.now() - start) + 'ms');
" | grep -E "executionStats|executionTimeMillis|totalDocsExamined"

# 4. Run smoke tests
npm run test:migrations
```

### Delayed (After 24-48 hours)

```bash
# Monitor for:
# - Increased query latencies (check APM/Application Insights)
# - Increased error rates
# - Unusual memory/CPU patterns

# If using Azure Monitor:
az monitor metrics list-definitions \
  --resource-group beamlab-prod \
  --resource-type Microsoft.DocumentDB/databaseAccounts

# Verify no midnight/weekend regression
// Continue monitoring for 48-72 hours
```

### Full Verification Checklist

- [ ] Migration completed without errors
- [ ] New indexes visible in `db.collection.getIndexes()`
- [ ] Query performance improved (or unchanged if data migration)
- [ ] Smoke tests pass
- [ ] No spike in application error rate
- [ ] No spike in latency (p95, p99)
- [ ] Replica lag normal (<5 sec)
- [ ] Backup successful
- [ ] Rollback plan validated (not actually rolled back, but plan reviewed)

---

## Rollback Procedures

### Rollback Type 1: Index Creation (Simple)

**Symptoms**: Index negatively impacts write performance  
**Time to Rollback**: <2 min

```bash
# Drop the problematic index
mongosh $MONGODB_URI --eval "
  db.projects.dropIndex('idx_projects_owner_updated')
"

# Verify it's gone
db.projects.getIndexes()

# Update migration status manually (optional; safe to leave as 'applied')
mongosh $MONGODB_URI --eval "
  db._migrations.deleteOne({ name: '20260401000000_name' })
"

# No restart required; queries will use next best index
```

### Rollback Type 2: Collection or Schema (Moderate)

**Symptoms**: New collection/fields cause write errors  
**Time to Rollback**: 5-15 min

```bash
# Option A: Drop the entire collection
mongosh $MONGODB_URI --eval "
  db.quotarecords.drop();
  db._migrations.deleteOne({ name: '20260316000000_add_quota_and_collaboration' })
"

# Option B: Drop specific fields (if only some are problematic)
mongosh $MONGODB_URI --eval "
  db.users.updateMany(
    {},
    { \$unset: { newProblematicField: 1 } }
  )
"

# Restart application to reload schema cache
# (If using Mongoose, no restart needed; it auto-reloads)
```

### Rollback Type 3: Data Transformation (Complex)

**Symptoms**: Incorrect data after backfill; data loss  
**Time to Rollback**: 30 min - hours (depends on restore duration)

```bash
# Restore from backup (point-in-time before migration)
# IF using Azure Cosmos/Atlas:
az backup container restore \
  --vault-name beamlab-backup \
  --resource-group beamlab-prod \
  --backup-name beamlab-20260401-0200

# Verify restore completed
mongosh $MONGODB_URI_NEW --eval "
  db.stats()
"

# Once verified:
# 1. Swap DNS to point to restored cluster
# 2. Re-run migration with fix applied

# Mark migration as rolled back
db._migrations.deleteOne({ name: '20260401000000_name' })

# Re-apply once fixed
npm src/migrations/runner.ts
```

### Rollback Decision Tree

```
Did it break?
├─ Yes: Is the app returning errors?
│  ├─ Yes: Immediate rollback (Type 1 or 2 above)
│  └─ No: Proceed with caution, monitor closely
└─ No: Continue monitoring

Is rollback Type 1 (index drop)?
├─ Yes: < 2 minutes, safe, proceed
└─ No: Check if Type 2 (collection drop) or Type 3 (restore)
     ├─ Type 2: 5-15 min, can do in off-hours
     └─ Type 3: 30+ min, requires coordination with restore team
          Contact: [ops-lead email]
```

---

## Emergency Contacts

### Database On-Call

| Role | Name | Phone | Email |
|---|---|---|---|
| Primary DB Owner | [Name] | [+XX-XXX-XXXX] | [email] |
| Backup | [Name] | [+XX-XXX-XXXX] | [email] |
| MongoDB Support | Atlas Support | [Link] | support@mongodb.com |

### Escalation Path

1. **Tier 1** (Database Ops): Page on-call DB engineer
2. **Tier 2** (Platform Team): Notify platform lead if Tier 1 unavailable
3. **Tier 3** (VP Eng): Escalate if customer-impacting outage >15 min

### Communication Channels

- **Slack**: #database-ops, #incidents
- **PagerDuty**: [oncall-url]
- **Docs**: [Runbook wiki link]

---

## Migration Template

Use this template for each new migration:

```typescript
/**
 * Migration: [Description]
 *
 * Purpose: [Why we're doing this]
 * Duration Estimate: [X minutes]
 * Risk Level: [Low|Medium|High]
 * Rollback Type: [Index Drop|Collection Drop|Data Restore|NA]
 *
 * Changes:
 *   - [Change 1]
 *   - [Change 2]
 */

import type mongoose from 'mongoose';
import type { MigrationModule } from './runner.js';

export const description = '[Description matching filename]';

export const up = async (db: mongoose.Connection): Promise<void> => {
  // Implementation
};

export const down = async (db: mongoose.Connection): Promise<void> => {
  // Rollback implementation
};

export default { description, up, down } satisfies MigrationModule;
```

---

## Appendix A: MongoDB Connection Troubleshooting

| Symptom | Diagnosis | Fix |
|---|---|---|
| `ECONNREFUSED` | MongoDB not reachable | Check firewall rules, IP allowlist |
| `AUTHENTICATION failed` | Wrong credentials | Verify `MONGODB_URI` env var |
| `Server selection timeout` | DNS resolution or network | Ping MongoDB cluster, check VNet |
| `Replica set has no primary` | MongoDB cluster unhealthy | Contact MongoDB Atlas support |

---

## Appendix B: Index Creation Best Practices

### Before Creating Large Index

```bash
# Estimate index size
mongosh $MONGODB_URI --eval "
  const coll = db.projects;
  const stats = coll.aggregate([
    { \$group: { _id: null, count: { \$sum: 1 }, totalSize: { \$sum: \$_size } } }
  ]).next();
  console.log('Documents: ' + stats.count);
  console.log('Avg doc size: ' + (stats.totalSize / stats.count) + ' bytes');
  console.log('Estimated index size (rough): ' + (stats.totalSize * 0.1) + ' bytes'); // ~10% of data
"

# Result: [Count, Size] → Estimate execution time
# <100k docs: <5 min
# 100k-1M: 5-20 min
# 1M+: 20+ min (consider background = true)
```

### Index Creation with Background Flag (non-blocking)

```javascript
db.projects.createIndex(
  { owner: 1, createdAt: -1 },
  { background: true, name: 'idx_projects_owner_created' }
)
```

⚠️ **Warning**: `background: true` takes longer but doesn't block writes.

---

## Appendix C: Dry-Run Testing

Some migrations support dry-run; implement this pattern:

```typescript
const DRY_RUN = process.env['DRY_RUN'] === 'true';

export const up = async (db: mongoose.Connection): Promise<void> => {
  // Execute migration
  const result = await db.collection('projects').updateMany(
    { /* ... */ },
    { $set: { /* ... */ } }
  );

  if (DRY_RUN) {
    console.log(`[DRY RUN] Would have updated ${result.modifiedCount} documents`);
    // When DRY_RUN=true, actual updates are not persisted
  }
};
```

Run with: `DRY_RUN=true npx tsx src/migrations/runner.ts`

---

## Version History

| Date | Changes |
|---|---|
| Apr 2, 2026 | Initial runbook creation; added migration types, checklists, rollback procedures |

