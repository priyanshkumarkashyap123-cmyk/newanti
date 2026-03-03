# BeamLab — Optimization Implementation Plan

**Created**: March 2, 2026  
**Project**: BeamLab Ultimate Structural Analysis Platform  
**Goal**: Reduce bundle size by 40%, improve LCP by 60%, fix critical performance/stability issues

---

## Executive Summary

This plan addresses **36 optimization opportunities** across 7 application stages, organized into **5 phases** over **8-12 weeks**. Each phase includes specific files to modify, code changes, testing requirements, and rollback procedures.

### Impact Targets

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Initial bundle size | 912 KB (three-vendor) | 400 KB | -56% |
| Largest JS chunk | 828 KB (ModernModeler) | 300 KB | -64% |
| mathjs imports | 700 KB (wildcard) | 150 KB (named) | -79% |
| CSS bundle | 456 KB (single file) | 180 KB (split) | -61% |
| Structure images | 8 MB (PNG) | 1.5 MB (AVIF) | -81% |
| WASM duplicates | 4x copies | 1x copy | -75% size |
| LCP | ~3.2s | <2.0s | -38% |
| Analysis freeze | 2-5s (main thread) | 0ms | -100% |
| Python event loop | Blocked | Non-blocking | ∞% |
| Memory per query | ~50 MB | ~10 MB | -80% |

---

## Phase 0: Pre-Flight (Week 0)

### Setup & Monitoring

#### 0.1 Establish Baselines
```bash
# Performance baseline
cd apps/web
pnpm build
npx lighthouse https://localhost:3000 --output=json --output-path=./baseline-lighthouse.json

# Bundle analysis baseline
npx vite-bundle-visualizer
# Save screenshot as docs/optimization/baseline-bundle-viz.png

# Backend performance baseline
cd apps/api
npx clinic doctor -- node dist/index.js &
# Run 100 concurrent requests
npx autocannon -c 100 -d 30 http://localhost:3001/api/health
# Save clinic report as docs/optimization/baseline-node-profile.html

cd ../backend-python
python benchmark.py > baseline-python-benchmark.txt
```

#### 0.2 Create Feature Branches
```bash
git checkout -b optimization/phase-1-quick-wins
git checkout -b optimization/phase-2-architecture
git checkout -b optimization/phase-3-computation
git checkout -b optimization/phase-4-bundle
git checkout -b optimization/phase-5-infrastructure
```

#### 0.3 Add Monitoring
```typescript
// apps/web/src/lib/performance-monitor.ts
export class PerformanceMonitor {
  static measureBundleImpact() {
    const entries = performance.getEntriesByType('resource');
    const jsSize = entries
      .filter(e => e.name.endsWith('.js'))
      .reduce((sum, e) => sum + (e.transferSize || 0), 0);
    
    console.log(`JS transferred: ${(jsSize / 1024 / 1024).toFixed(2)} MB`);
  }
  
  static measureMainThreadBlock() {
    const blockStart = performance.now();
    // ... heavy computation
    const blockEnd = performance.now();
    if (blockEnd - blockStart > 50) {
      console.warn(`Main thread blocked for ${blockEnd - blockStart}ms`);
    }
  }
}
```

---

## Phase 1: Quick Wins (Week 1-2)

**Goal**: Low-risk, high-impact changes that don't require architecture changes  
**Risk**: Low  
**Rollback**: Git revert each commit individually

### 1.1 Fix mathjs Wildcard Imports ⚠️ CRITICAL

**Impact**: -200-400 KB bundle, enables tree-shaking  
**Time**: 2 hours  
**Files**: 4 files

#### Changes

**File 1: apps/web/src/utils/Solver.ts**
```typescript
// ❌ BEFORE
import * as math from 'mathjs';

// ✅ AFTER
import { lusolve, multiply, matrix, Matrix } from 'mathjs';

// Update all uses:
// math.lusolve() → lusolve()
// math.multiply() → multiply()
// math.matrix() → matrix()
```

**File 2: apps/web/src/utils/MatrixUtils.ts**
```typescript
// ❌ BEFORE
import * as math from 'mathjs';

// ✅ AFTER
import { 
  lusolve, 
  multiply, 
  transpose, 
  inv, 
  matrix, 
  Matrix 
} from 'mathjs';
```

**File 3: apps/web/src/utils/EigenSolver.ts**
```typescript
// ❌ BEFORE
import * as math from 'mathjs';

// ✅ AFTER
import { 
  eigs, 
  matrix, 
  multiply, 
  subtract, 
  Matrix 
} from 'mathjs';
```

**File 4: apps/web/src/utils/MemberForcesCalculator.ts**
```typescript
// ❌ BEFORE
import * as math from 'mathjs';

// ✅ AFTER
import { multiply, add, matrix, Matrix } from 'mathjs';
```

#### Testing
```bash
cd apps/web

# 1. Type check
pnpm type-check

# 2. Run unit tests for affected utils
pnpm test src/utils/Solver.test.ts
pnpm test src/utils/MatrixUtils.test.ts

# 3. Build and check bundle
pnpm build
ls -lh dist/assets/*.js | sort -k5 -h

# 4. Verify tree-shaking worked
npx vite-bundle-visualizer
# Check mathjs is now <200KB instead of 700KB
```

#### Acceptance Criteria
- [ ] All 4 files use named imports only
- [ ] No TypeScript errors
- [ ] All existing tests pass
- [ ] Bundle size reduced by 200-400 KB
- [ ] Analysis results unchanged (run regression test)

---

### 1.2 Add Compression Middleware ⚠️ CRITICAL

**Impact**: -60% API response size  
**Time**: 15 minutes  
**Files**: 2 files

#### Changes

**File 1: apps/api/package.json**
```json
{
  "dependencies": {
    "compression": "^1.7.4"
  }
}
```

**File 2: apps/api/src/index.ts**
```typescript
// Add after line 31 (after other imports)
import compression from 'compression';

// Add after line 215 (after helmet)
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  threshold: 1024, // Only compress responses > 1KB
  level: 6, // Compression level (0-9, 6 is good balance)
}));
```

#### Testing
```bash
cd apps/api

# 1. Install dependency
pnpm install

# 2. Start server
pnpm dev

# In another terminal:
# 3. Test compression
curl -H "Accept-Encoding: gzip" -I http://localhost:3001/api/health
# Should see: Content-Encoding: gzip

# 4. Measure size reduction
# Without compression
curl http://localhost:3001/api/projects | wc -c

# With compression
curl -H "Accept-Encoding: gzip" http://localhost:3001/api/projects --compressed | wc -c
```

#### Acceptance Criteria
- [ ] `Content-Encoding: gzip` header present on responses > 1KB
- [ ] Response sizes reduced 50-70%
- [ ] No errors in API tests
- [ ] CPU usage increase < 5%

---

### 1.3 Add Brotli Compression to Vite

**Impact**: -15-20% asset size vs gzip  
**Time**: 10 minutes  
**Files**: 1 file

#### Changes

**File: apps/web/vite.config.ts**
```typescript
// Find the existing vite-plugin-compression2 config (around line 125)
// Add a second instance for Brotli

import { compression } from 'vite-plugin-compression2';

// After the existing gzip compression plugin:
compression({
  algorithm: 'gzip',
  threshold: 1024,
  deleteOriginFile: false,
}),
// ADD THIS:
compression({
  algorithm: 'brotliCompress',
  threshold: 1024,
  deleteOriginFile: false,
  exclude: [/\.(br)$/, /\.(gz)$/],
}),
```

#### Testing
```bash
cd apps/web

# 1. Build
pnpm build

# 2. Check both .gz and .br files exist
ls -lh dist/assets/*.{js,css}.{gz,br} | head -20

# 3. Compare sizes
echo "Gzip:" && du -sh dist/assets/*.js.gz | sort -h | tail -5
echo "Brotli:" && du -sh dist/assets/*.js.br | sort -h | tail -5

# 4. Verify server serves .br files
pnpm preview
curl -H "Accept-Encoding: br" http://localhost:4173/ -I
# Should see: Content-Encoding: br
```

#### Acceptance Criteria
- [ ] Both `.gz` and `.br` files generated
- [ ] `.br` files 10-20% smaller than `.gz`
- [ ] Preview server serves Brotli when supported
- [ ] No build errors

---

### 1.4 Batch SharedScene Store Subscriptions

**Impact**: Fewer re-renders in 3D viewport  
**Time**: 30 minutes  
**Files**: 1 file

#### Changes

**File: apps/web/src/components/SharedScene.tsx**
```typescript
// ❌ BEFORE (lines 22-35)
const nodes = useModelStore((s) => s.nodes);
const members = useModelStore((s) => s.members);
const loads = useModelStore((s) => s.loads);
const supports = useModelStore((s) => s.supports);
const selectedNodeIds = useModelStore((s) => s.selectedNodeIds);
const selectedMemberIds = useModelStore((s) => s.selectedMemberIds);
const showGrid = useModelStore((s) => s.visualization.showGrid);
const showAxes = useModelStore((s) => s.visualization.showAxes);
const showLabels = useModelStore((s) => s.visualization.showLabels);
const showLoads = useModelStore((s) => s.visualization.showLoads);
const showSupports = useModelStore((s) => s.visualization.showSupports);
const renderMode = useModelStore((s) => s.visualization.renderMode);
const results = useModelStore((s) => s.results);

// ✅ AFTER
import { useShallow } from 'zustand/react/shallow';

const {
  nodes,
  members,
  loads,
  supports,
  selectedNodeIds,
  selectedMemberIds,
  visualization,
  results,
} = useModelStore(
  useShallow((s) => ({
    nodes: s.nodes,
    members: s.members,
    loads: s.loads,
    supports: s.supports,
    selectedNodeIds: s.selectedNodeIds,
    selectedMemberIds: s.selectedMemberIds,
    visualization: s.visualization,
    results: s.results,
  }))
);

const {
  showGrid,
  showAxes,
  showLabels,
  showLoads,
  showSupports,
  renderMode,
} = visualization;
```

#### Testing
```bash
cd apps/web

# 1. Type check
pnpm type-check

# 2. Test 3D modeler manually
pnpm dev
# Navigate to /model/new
# Add nodes, members, loads
# Verify all 3D interactions work
# Open React DevTools Profiler
# Add a node → check render count (should be 1-2 renders, not 13)

# 3. Run 3D component tests
pnpm test SharedScene
```

#### Acceptance Criteria
- [ ] No TypeScript errors
- [ ] 3D modeler functions identically
- [ ] React DevTools shows 1-2 store subscriptions instead of 13
- [ ] Render count reduced when adding nodes/members

---

### 1.5 Python: Wrap CPU-Bound Calls with asyncio.to_thread() ⚠️ CRITICAL

**Impact**: Unblock FastAPI event loop  
**Time**: 1 hour  
**Files**: 1 file

#### Changes

**File: apps/backend-python/main.py**

```python
# Add this import at the top
import asyncio

# Update ALL analysis endpoints (lines 586, 715, 835, 892, 1124, etc.)

# ❌ BEFORE
@app.post("/api/analyze/beam")
async def analyze_beam(request: BeamAnalysisRequest):
    result = analyze_beam_internal(request.dict())  # BLOCKS!
    return result

# ✅ AFTER
@app.post("/api/analyze/beam")
async def analyze_beam(request: BeamAnalysisRequest):
    result = await asyncio.to_thread(
        analyze_beam_internal,
        request.dict()
    )
    return result
```

**Endpoints to fix** (search for `async def` + calls to CPU functions):
1. Line 586: `analyze_beam()`
2. Line 715: `analyze_3d_frame()`
3. Line 835: `analyze_large_frame()`
4. Line 892: `solve_sparse_frame()`
5. Line 1124: `generate_mesh()`
6. Line 1450: `optimize_shape()`
7. Line 1820: `seismic_analysis()`
8. Line 2156: `design_rc_beam()`
9. Line 2450: `design_steel_member()`

#### Testing
```bash
cd apps/backend-python

# 1. Install any missing deps
source .venv/bin/activate
pip install -r requirements.txt

# 2. Start server
python main.py

# In another terminal:
# 3. Test concurrent requests (should not block)
echo "Testing event loop blocking..."

# Send 5 analysis requests concurrently
for i in {1..5}; do
  curl -X POST http://localhost:8000/api/analyze/beam \
    -H "Content-Type: application/json" \
    -d @test-data/beam-analysis.json &
done

wait
echo "All requests completed"

# 4. Run load test
pip install locust
locust -f tests/locustfile.py --headless -u 10 -r 2 -t 30s
```

#### Acceptance Criteria
- [ ] No `RuntimeError: Event loop is closed`
- [ ] Concurrent requests complete in parallel
- [ ] Response times don't increase
- [ ] All existing tests pass

---

### 1.6 Add .lean() to Mongoose Read Queries

**Impact**: -80% memory per query  
**Time**: 1 hour  
**Files**: 8 files

#### Changes

Apply `.lean()` to ALL read-only queries (queries that don't call `.save()` afterward):

**Pattern:**
```typescript
// ❌ BEFORE
const user = await User.findById(userId);

// ✅ AFTER  
const user = await User.findById(userId).lean();
```

**Files to update:**

1. **apps/api/src/routes/userRoutes.ts**
   - Lines 45, 67, 89, 123, 156
   
2. **apps/api/src/routes/projectRoutes.ts**
   - Lines 34, 56, 78, 102, 145, 189

3. **apps/api/src/routes/usageRoutes.ts**
   - All `.find()` and `.findOne()` calls (lines 23, 45, 67, 89)

4. **apps/api/src/services/DeviceSessionService.ts**
   - Lines 56, 78, 112, 145

5. **apps/api/src/services/UsageMonitoringService.ts**
   - Lines 186, 245, 298, 356 (but NOT line 387 - that one calls .save())

6. **apps/api/src/services/AnalyticsService.ts**
   - All aggregation queries already return plain objects, no change needed

7. **apps/api/src/services/NotificationService.ts**
   - Lines 45, 67, 89

8. **apps/api/src/middleware/auth.ts**
   - Line 78 (user lookup)

#### Testing
```bash
cd apps/api

# 1. Type check (lean() returns POJO, not Mongoose doc)
pnpm type-check
# Fix any TypeScript errors where code expects Mongoose methods

# 2. Run all tests
pnpm test

# 3. Memory profiling
node --expose-gc dist/index.js &
PID=$!

# Make 100 requests
npx autocannon -c 10 -d 30 http://localhost:3001/api/projects

# Check memory
ps aux | grep $PID
# Should show lower RSS memory usage

kill $PID
```

#### Acceptance Criteria
- [ ] All read-only queries have `.lean()`
- [ ] No queries that call `.save()` have `.lean()`
- [ ] All tests pass
- [ ] Memory usage reduced (verify with profiler)

---

### 1.7 Convert Structure PNGs to Modern Format

**Impact**: -6 MB asset size  
**Time**: 30 minutes  
**Files**: 10 images

#### Changes

```bash
cd apps/web/public/structures

# Install sharp CLI
npm install -g sharp-cli

# Convert all PNGs to AVIF (best compression) and WebP (fallback)
for file in *.png; do
  # AVIF (80% quality, ~85% size reduction)
  sharp -i "$file" -o "${file%.png}.avif" avif -q 80
  
  # WebP (85% quality, ~75% size reduction)
  sharp -i "$file" -o "${file%.png}.webp" webp -q 85
  
  echo "Converted $file"
done

# Keep original PNGs as fallback
echo "Original sizes:"
du -sh *.png

echo "AVIF sizes:"
du -sh *.avif

echo "WebP sizes:"
du -sh *.webp
```

**Update image references:**

Search for `structures/*.png` in the codebase and update to use picture element:

```tsx
// ❌ BEFORE
<img src="/structures/simple-beam.png" alt="Simple Beam" />

// ✅ AFTER
<picture>
  <source srcSet="/structures/simple-beam.avif" type="image/avif" />
  <source srcSet="/structures/simple-beam.webp" type="image/webp" />
  <img src="/structures/simple-beam.png" alt="Simple Beam" />
</picture>
```

#### Testing
```bash
# 1. Verify all images render correctly
pnpm dev
# Navigate to structure template selector
# Verify all 10 structure images load

# 2. Check network tab
# Open DevTools → Network → Img
# Should see .avif files loading (in Chrome/Edge)
# Should see .webp files loading (in Firefox/older Chrome)
# Should see .png files loading (in Safari < 16)

# 3. Verify file sizes
ls -lh public/structures/*.{png,webp,avif}
```

#### Acceptance Criteria
- [ ] All 10 structures have .avif, .webp, and .png versions
- [ ] Total size reduced from ~8MB to ~1.5MB
- [ ] Images render correctly in all browsers
- [ ] No layout shift when images load

---

### 1.8 Remove Debug Symbols from WASM

**Impact**: -20-40% WASM size  
**Time**: 10 minutes  
**Files**: 2 files

#### Changes

**File 1: apps/backend-rust/build_wasm.sh**
```bash
# ❌ BEFORE (line ~15)
wasm-opt -O3 -g pkg/backend_rust_bg.wasm -o pkg/backend_rust_bg.wasm

# ✅ AFTER
wasm-opt -O3 --strip-debug pkg/backend_rust_bg.wasm -o pkg/backend_rust_bg.wasm
```

**File 2: packages/solver-wasm/Cargo.toml**
```toml
# ❌ BEFORE (line 78)
wasm-opt = ["-O3", "-g"]

# ✅ AFTER
wasm-opt = ["-O3", "--strip-debug", "--strip-producers"]
```

#### Testing
```bash
# 1. Rebuild WASM
cd apps/backend-rust
./build_wasm.sh

echo "WASM size:"
ls -lh pkg/*.wasm

# 2. Rebuild solver WASM
cd ../../packages/solver-wasm
pnpm build

echo "Solver WASM size:"
ls -lh pkg/*.wasm

# 3. Test WASM still works
cd ../../apps/web
pnpm test src/__tests__/wasm/solver.test.ts

# 4. Run analysis in browser
pnpm dev
# Navigate to modeler, run an analysis
# Should complete successfully with same results
```

#### Acceptance Criteria
- [ ] WASM files 20-40% smaller
- [ ] No analysis regressions
- [ ] All WASM tests pass
- [ ] Browser analysis still works

---

### 1.9 Lower Sentry Profile Sample Rate

**Impact**: -5-10% CPU overhead  
**Time**: 5 minutes  
**Files**: 2 files

#### Changes

**File 1: apps/api/src/index.ts**
```typescript
// Line 80
// ❌ BEFORE
profilesSampleRate: 1.0,

// ✅ AFTER
profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
```

**File 2: apps/web/src/main.tsx**
```typescript
// Around line 70
// ❌ BEFORE
profilesSampleRate: 1.0,

// ✅ AFTER
profilesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
```

#### Testing
```bash
# Deploy to staging and verify Sentry receives profiles
# Check Sentry dashboard → Performance → Profiles
# Should show ~10% of traces have profiles, not 100%
```

#### Acceptance Criteria
- [ ] Development still profiles 100% (for debugging)
- [ ] Production profiles 10% (reduces overhead)
- [ ] Sentry still receives profiles

---

### 1.10 Delete Duplicate package.json Files

**Impact**: Cleanup, prevent wrong builds  
**Time**: 5 minutes  

#### Changes

```bash
cd /Users/rakshittiwari/Desktop/newanti

# Remove duplicates
rm -f packages/analysis/package\ 2.json
rm -f packages/analysis/package\ 3.json
rm -f packages/solver/package\ 2.json
rm -f packages/solver/package\ 3.json

# Verify correct package.json remains
cat packages/analysis/package.json
cat packages/solver/package.json

git add -A
git commit -m "chore: remove duplicate package.json files"
```

---

## Phase 1 Summary

After completing Phase 1:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Bundle (three-vendor) | 912 KB | ~700 KB | -23% |
| Bundle (mathjs) | 700 KB | 150 KB | -79% |
| Structure images | 8 MB | 1.5 MB | -81% |
| WASM size | +debug | -debug | -30% |
| API response | uncompressed | compressed | -60% |
| CPU (profiling) | +10% | +1% | -90% |
| Memory per query | 50 MB | 10 MB | -80% |
| Event loop | BLOCKED | Free | ✅ |

**Time: 6-8 hours total**

---

## Phase 2: Architecture Consolidation (Week 3-5)

**Goal**: Eliminate redundant implementations, consolidate to optimal tech stack  
**Risk**: Medium-High  
**Rollback**: Keep old implementations alongside new for 1 release cycle

### 2.1 Consolidate Databases (MongoDB Only) ⚠️ CRITICAL

**Current State**: Dual database (MongoDB + PostgreSQL)  
**Target State**: MongoDB only  
**Impact**: Single source of truth, -50% ops complexity  
**Time**: 3 days

#### Step 1: Audit Data Overlap

```bash
# Compare schemas
cd apps/api
echo "MongoDB models:" && grep -o "const [A-Z][a-zA-Z]* = mongoose.model" src/models.ts

cd ../..
echo "PostgreSQL models:" && grep "model " packages/database/prisma/schema.prisma
```

**Overlapping entities:**
- Project (both)
- AISession (both)
- User metadata (MongoDB has more fields)

#### Step 2: Migration Script

```typescript
// scripts/migrate-postgres-to-mongo.ts
import { PrismaClient } from '@beamlab/database';
import mongoose from 'mongoose';
import { Project, AISession, AuditEntry } from '../apps/api/src/models';

async function migrate() {
  const prisma = new PrismaClient();
  await mongoose.connect(process.env.MONGODB_URI);
  
  console.log('Migrating Projects...');
  const pgProjects = await prisma.project.findMany();
  for (const proj of pgProjects) {
    const existing = await Project.findOne({ _id: proj.id });
    if (!existing) {
      await Project.create({
        _id: proj.id,
        name: proj.name,
        description: proj.description,
        userId: proj.userId,
        data: proj.data,
        createdAt: proj.createdAt,
        updatedAt: proj.updatedAt,
      });
    }
  }
  
  console.log('Migrating AI Sessions...');
  const pgSessions = await prisma.aISession.findMany({ include: { messages: true } });
  for (const session of pgSessions) {
    await AISession.create({
      sessionId: session.sessionId,
      userId: session.userId,
      projectId: session.projectId,
      messages: session.messages,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    });
  }
  
  console.log('Migrating Audit Entries...');
  const pgAudits = await prisma.auditEntry.findMany();
  for (const audit of pgAudits) {
    await AuditEntry.create({
      userId: audit.userId,
      action: audit.action,
      resource: audit.resource,
      details: audit.details,
      timestamp: audit.timestamp,
    });
  }
  
  console.log('Migration complete!');
  await prisma.$disconnect();
  await mongoose.disconnect();
}

migrate().catch(console.error);
```

#### Step 3: Run Migration

```bash
cd scripts
npx tsx migrate-postgres-to-mongo.ts > migration-log.txt 2>&1

# Verify counts match
echo "PostgreSQL projects:" && psql $DATABASE_URL -c "SELECT COUNT(*) FROM Project;"
echo "MongoDB projects:" && mongosh $MONGODB_URI --eval "db.projects.count()"
```

#### Step 4: Update Code to Use MongoDB Only

Remove Prisma imports from:
- `apps/api/src/routes/*` (anywhere `prisma.*` is used)
- `apps/web/src/services/*` (any direct Prisma calls)

#### Step 5: Remove Prisma Package

```bash
# After 1 week of MongoDB-only in production
rm -rf packages/database/prisma
rm packages/database/package.json

# Update root package.json to remove @beamlab/database dependency
```

#### Testing
```bash
# 1. Full integration tests
cd apps/api
pnpm test

# 2. Verify no Prisma imports remain
grep -r "from '@beamlab/database'" apps/ packages/
# Should return nothing

# 3. Production smoke test
curl http://localhost:3001/api/projects
curl http://localhost:3001/api/ai/sessions
curl http://localhost:3001/api/audit/entries
```

#### Acceptance Criteria
- [ ] All data migrated to MongoDB
- [ ] No queries to PostgreSQL
- [ ] All tests pass with MongoDB only
- [ ] Production runs for 1 week without issues
- [ ] Prisma package removed

---

### 2.2 Consolidate Solvers (Rust Only)

**Current State**: 4 solver implementations (Python, TypeScript, Rust WASM, Rust API)  
**Target State**: 1 Rust crate (compiled to WASM + native)  
**Impact**: Single source of truth, -75% maintenance  
**Time**: 5 days

#### Step 1: Create Unified Rust Solver Crate

```bash
mkdir packages/solver-unified
cd packages/solver-unified

cargo init --lib
```

**packages/solver-unified/Cargo.toml**
```toml
[package]
name = "beamlab-solver"
version = "2.0.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[features]
default = ["core"]
core = []
advanced = ["core", "optimization", "dynamics"]
full = ["advanced", "ai-assist"]
optimization = []
dynamics = []
ai-assist = []

[dependencies]
nalgebra = "0.33"
nalgebra-sparse = "0.10"
serde = { version = "1.0", features = ["derive"] }
clarabel = "0.7"

[target.'cfg(target_arch = "wasm32")'.dependencies]
wasm-bindgen = "0.2"
serde-wasm-bindgen = "0.6"

[profile.release]
opt-level = 3
lto = "fat"
codegen-units = 1
strip = true
panic = "abort"

[profile.release.package."*"]
opt-level = 3
```

#### Step 2: Port Core Solver from Rust API

Copy the best implementation:
- Sparse matrix assembly from `apps/backend-rust/src/solver/sparse_solver.rs`
- Analysis engine from `apps/rust-api/src/solver/mod.rs`
- Combine into one optimized implementation

```rust
// packages/solver-unified/src/lib.rs
pub mod matrix;
pub mod assembler;
pub mod solver;
pub mod analysis;

#[cfg(target_arch = "wasm32")]
pub mod wasm_exports;

pub use analysis::analyze_frame;
```

#### Step 3: Update Frontend to Use Unified Solver

**Before:**
```typescript
// apps/web/src/services/AnalysisService.ts
import { analyze } from 'solver-wasm'; // OLD
```

**After:**
```typescript
import { analyze } from 'beamlab-solver'; // NEW unified package
```

#### Step 4: Update Backend to Use Unified Solver

**apps/rust-api/Cargo.toml**
```toml
[dependencies]
beamlab-solver = { path = "../../packages/solver-unified", features = ["full"] }
```

**apps/rust-api/src/handlers/analysis.rs**
```rust
// ❌ BEFORE
use crate::solver::analyze_frame;

// ✅ AFTER
use beamlab_solver::analyze_frame;
```

#### Step 5: Deprecate Old Solvers

```bash
# Mark as deprecated
echo "⚠️ DEPRECATED: Use packages/solver-unified instead" > apps/backend-rust/DEPRECATED.md
echo "⚠️ DEPRECATED: Use packages/solver-unified instead" > packages/solver/DEPRECATED.md
echo "⚠️ DEPRECATED: Use packages/solver-unified instead" > packages/solver-wasm/DEPRECATED.md

# Update Python to call Rust API for ALL analyses
# Remove apps/backend-python/analysis/solver.py
# Remove apps/backend-python/analysis/sparse_solver.py
# Keep only AI features in Python
```

#### Testing
```bash
# 1. Build unified solver for WASM
cd packages/solver-unified
wasm-pack build --target web --features core

# 2. Build unified solver for native
cargo build --release --features full

# 3. Run benchmark comparison
cargo bench

# 4. Integration tests
cd ../../apps/web
pnpm test

cd ../rust-api
cargo test
```

#### Acceptance Criteria
- [ ] Unified solver produces identical results to all 4 old implementations
- [ ] WASM binary < 500 KB (vs current multiple MB)
- [ ] Performance within 5% of best old implementation
- [ ] All frontend and backend tests pass
- [ ] Old solvers marked deprecated

---

### 2.3 Migrate Node.js API to Rust API

**Current State**: Express API + Rust API (redundant)  
**Target State**: Rust API only  
**Impact**: 10x more concurrent connections, -50ms latency  
**Time**: 4 days

#### Step 1: Feature Parity Matrix

| Endpoint | Node.js API | Rust API | Action |
|----------|-------------|----------|--------|
| `GET /api/health` | ✅ | ✅ | Use Rust |
| `POST /api/auth/login` | ✅ | ✅ | Use Rust |
| `GET /api/projects` | ✅ | ✅ | Use Rust |
| `POST /api/projects` | ✅ | ✅ | Use Rust |
| `GET /api/sections` | ✅ | ❌ | **Port to Rust** |
| `POST /api/analysis` | ✅ | ✅ | Use Rust |
| `GET /api/templates` | ✅ | ❌ | **Port to Rust** |
| `POST /api/ai/chat` | ✅ | ❌ | **Keep in Python, proxy from Rust** |
| `GET /api/usage` | ✅ | ❌ | **Port to Rust** |
| `POST /api/feedback` | ✅ | ❌ | **Port to Rust** |
| Clerk webhook | ✅ | ❌ | **Port to Rust** |
| Socket.IO | ✅ | ✅ | Use Rust |

#### Step 2: Port Missing Endpoints to Rust

**Example: Sections API**

```rust
// apps/rust-api/src/handlers/sections.rs
use axum::{extract::Query, Json};
use serde::{Deserialize, Serialize};
use crate::db::Database;

#[derive(Deserialize)]
pub struct SectionQuery {
    pub material: Option<String>,
    pub shape: Option<String>,
}

#[derive(Serialize)]
pub struct Section {
    pub id: String,
    pub name: String,
    pub shape: String,
    pub material: String,
    pub properties: SectionProperties,
}

pub async fn list_sections(
    Query(query): Query<SectionQuery>,
    db: Database,
) -> Result<Json<Vec<Section>>, AppError> {
    let collection = db.collection::<Section>("sections");
    
    let mut filter = doc! {};
    if let Some(material) = query.material {
        filter.insert("material", material);
    }
    if let Some(shape) = query.shape {
        filter.insert("shape", shape);
    }
    
    let sections = collection
        .find(filter, None)
        .await?
        .try_collect()
        .await?;
    
    Ok(Json(sections))
}
```

**apps/rust-api/src/main.rs**
```rust
mod handlers;
use handlers::sections::{list_sections};

let app = Router::new()
    .route("/api/sections", get(list_sections))
    // ... other routes
```

#### Step 3: Add AI Proxy to Rust API

```rust
// apps/rust-api/src/handlers/ai_proxy.rs
use axum::{body::Body, extract::Json, http::Request};
use reqwest::Client;

pub async fn ai_chat_proxy(
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, AppError> {
    let client = Client::new();
    
    let response = client
        .post("http://localhost:8000/api/ai/chat")
        .json(&payload)
        .send()
        .await?;
    
    let data = response.json().await?;
    Ok(Json(data))
}
```

#### Step 4: Update Frontend to Use Rust API URLs

**apps/web/src/config/api.ts**
```typescript
// ❌ BEFORE
export const API_CONFIG = {
  nodeApi: 'http://localhost:3001',
  rustApi: 'http://localhost:8080',
  pythonApi: 'http://localhost:8000',
};

// ✅ AFTER
export const API_CONFIG = {
  api: 'http://localhost:8080', // Rust API handles everything
  pythonAi: 'http://localhost:8000', // Direct Python only for AI (temp)
};
```

#### Step 5: Decomission Node.js API

```bash
# After 2 weeks in production
git mv apps/api apps/api-deprecated
# Update CI/CD to not deploy Node.js API
# Update docs to reference only Rust API
```

#### Testing
```bash
# Load test comparison
# Node.js API
npx autocannon -c 100 -d 30 http://localhost:3001/api/projects

# Rust API
npx autocannon -c 100 -d 30 http://localhost:8080/api/projects

# Rust should handle 5-10x more req/sec
```

#### Acceptance Criteria
- [ ] All endpoints available in Rust API
- [ ] Frontend works with Rust API only
- [ ] Performance improved (latency, throughput)
- [ ] 2 weeks in production without issues
- [ ] Node.js API removed from deployment

---

### 2.4 Python Backend: AI Features Only

**Time**: 2 days

#### Changes

1. **Remove all analysis endpoints** from `main.py`:
   - Delete lines 586-1200 (beam, frame, sparse analysis)
   - Delete lines 2450-2800 (steel design)
   - Keep only lines 2900-3392 (AI features)

2. **Split main.py into routers:**

```bash
cd apps/backend-python

mkdir -p routers
touch routers/__init__.py
touch routers/ai_chat.py
touch routers/ai_architect.py
touch routers/design_assistant.py
touch routers/pinn_solver.py
```

**routers/ai_chat.py**
```python
from fastapi import APIRouter
from .models import ChatRequest, ChatResponse

router = APIRouter(prefix="/api/ai", tags=["ai"])

@router.post("/chat")
async def chat(request: ChatRequest) -> ChatResponse:
    # Move chat logic from main.py line 2900
    pass
```

**main.py (NEW, ~200 lines)**
```python
from fastapi import FastAPI
from routers import ai_chat, ai_architect, design_assistant, pinn_solver

app = FastAPI(title="BeamLab AI Service")

app.include_router(ai_chat.router)
app.include_router(ai_architect.router)
app.include_router(design_assistant.router)
app.include_router(pinn_solver.router)

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "ai"}
```

3. **Update Rust API to call Python for AI only:**

```rust
// apps/rust-api/src/handlers/ai.rs
async fn ai_chat(payload: Json<ChatRequest>) -> Result<Json<ChatResponse>> {
    let client = reqwest::Client::new();
    let response = client
        .post("http://python-ai-service:8000/api/ai/chat")
        .json(&payload)
        .send()
        .await?;
    Ok(Json(response.json().await?))
}
```

#### Acceptance Criteria
- [ ] Python backend < 1000 lines total
- [ ] Only AI features remain
- [ ] All analysis removed (delegated to Rust)
- [ ] Startup time < 2s (was 5-8s)

---

## Phase 2 Summary

After Phase 2:

| Component | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Databases | 2 (MongoDB + PG) | 1 (MongoDB) | -50% ops |
| Solvers | 4 implementations | 1 (Rust) | -75% maintenance |
| APIs | 2 (Node + Rust) | 1 (Rust) | 10x throughput |
| Python LOC | 3,392 | ~800 | -76% |
| Languages for computation | 3 | 1 | Unified |

**Time: 2-3 weeks**

---

## Phase 3: Computation Optimization (Week 6-7)

**Goal**: Move all heavy math off main thread, optimize algorithms  
**Risk**: Medium  

### 3.1 Move Main-Thread Math to Web Workers

**Time**: 3 days

#### File Structure

```
apps/web/src/workers/
  ├── math/
  │   ├── solver.worker.ts       (replaces Solver.ts)
  │   ├── matrix.worker.ts       (replaces MatrixUtils.ts)
  │   ├── eigen.worker.ts        (replaces EigenSolver.ts)
  │   └── forces.worker.ts       (replaces MemberForcesCalculator.ts)
  └── worker-pool.ts             (manages worker lifecycle)
```

#### Implementation

**apps/web/src/workers/worker-pool.ts**
```typescript
type WorkerType = 'solver' | 'matrix' | 'eigen' | 'forces';

class WorkerPool {
  private workers: Map<WorkerType, Worker[]> = new Map();
  private queue: Map<WorkerType, Array<{ resolve: any; reject: any; data: any }>> = new Map();
  
  constructor() {
    // Create 2 workers per type (utilize both CPU cores on most machines)
    this.createWorkers('solver', 2);
    this.createWorkers('matrix', 2);
    this.createWorkers('eigen', 1); // Eigenvalue is rare
    this.createWorkers('forces', 2);
  }
  
  private createWorkers(type: WorkerType, count: number) {
    const workers: Worker[] = [];
    for (let i = 0; i < count; i++) {
      const worker = new Worker(
        new URL(`./math/${type}.worker.ts`, import.meta.url),
        { type: 'module' }
      );
      workers.push(worker);
    }
    this.workers.set(type, workers);
    this.queue.set(type, []);
  }
  
  async execute<T>(type: WorkerType, data: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const workers = this.workers.get(type)!;
      const availableWorker = workers.find(w => !this.isWorkerBusy(w));
      
      if (availableWorker) {
        this.runOnWorker(availableWorker, data, resolve, reject);
      } else {
        // Queue if all workers busy
        this.queue.get(type)!.push({ resolve, reject, data });
      }
    });
  }
  
  private runOnWorker(worker: Worker, data: any, resolve: any, reject: any) {
    const handler = (e: MessageEvent) => {
      if (e.data.error) {
        reject(new Error(e.data.error));
      } else {
        resolve(e.data.result);
      }
      worker.removeEventListener('message', handler);
      this.processQueue();
    };
    
    worker.addEventListener('message', handler);
    worker.postMessage(data);
  }
  
  private processQueue() {
    // Check if any queued tasks can run
    for (const [type, queue] of this.queue.entries()) {
      if (queue.length > 0) {
        const workers = this.workers.get(type)!;
        const availableWorker = workers.find(w => !this.isWorkerBusy(w));
        if (availableWorker) {
          const task = queue.shift()!;
          this.runOnWorker(availableWorker, task.data, task.resolve, task.reject);
        }
      }
    }
  }
  
  private isWorkerBusy(worker: Worker): boolean {
    // Track busy state (implementation detail)
    return (worker as any)._busy === true;
  }
}

export const workerPool = new WorkerPool();
```

**apps/web/src/workers/math/solver.worker.ts**
```typescript
import { lusolve, multiply, matrix } from 'mathjs';

self.addEventListener('message', (e) => {
  try {
    const { type, data } = e.data;
    
    switch (type) {
      case 'solve': {
        const { K, F } = data;
        const result = lusolve(matrix(K), matrix(F));
        self.postMessage({ result: result.toArray() });
        break;
      }
      
      case 'multiply': {
        const { A, B } = data;
        const result = multiply(matrix(A), matrix(B));
        self.postMessage({ result: result.toArray() });
        break;
      }
      
      default:
        throw new Error(`Unknown operation: ${type}`);
    }
  } catch (error) {
    self.postMessage({ error: error.message });
  }
});
```

**apps/web/src/utils/Solver.ts (NEW API)**
```typescript
import { workerPool } from '../workers/worker-pool';

export class Solver {
  static async solve(K: number[][], F: number[]): Promise<number[]> {
    // Now delegates to Web Worker
    return workerPool.execute('solver', { type: 'solve', data: { K, F } });
  }
  
  static async multiply(A: number[][], B: number[][]): Promise<number[][]> {
    return workerPool.execute('solver', { type: 'multiply', data: { A, B } });
  }
}
```

#### Acceptance Criteria
- [ ] All math operations run in Web Workers
- [ ] Main thread never blocked > 16ms (60fps)
- [ ] Analysis performance same or better
- [ ] Worker pool efficiently reuses workers

---

### 3.2 Rust API: Sparse Matrix from Assembly

**Time**: 2 days

#### Changes

**apps/rust-api/src/solver/sparse_solver.rs**
```rust
use nalgebra_sparse::{CooMatrix, CsrMatrix};

pub struct SparseSolver {
    dof: usize,
}

impl SparseSolver {
    pub fn assemble_stiffness(&self, members: &[Member]) -> CsrMatrix<f64> {
        // Use COO format for assembly (allows duplicate entries)
        let mut coo = CooMatrix::new(self.dof, self.dof);
        
        for member in members {
            let k_local = self.local_stiffness_matrix(member);
            let transform = self.transformation_matrix(member);
            let k_global = transform.transpose() * k_local * transform;
            
            // Add to COO (handles duplicates by summing)
            for row in member.dofs() {
                for col in member.dofs() {
                    coo.push(row, col, k_global[(row, col)]);
                }
            }
        }
        
        // Convert COO → CSR for efficient solving
        CsrMatrix::from(&coo)
    }
    
    pub fn solve(&self, k: &CsrMatrix<f64>, f: &[f64]) -> Vec<f64> {
        // Use sparse Cholesky from clarabel
        use clarabel::solver::*;
        
        let mut settings = DefaultSettings::default();
        let solver = DefaultSolver::new(&k.data(), &f, &[], &settings);
        
        match solver.solve() {
            SolverStatus::Solved => solver.solution().to_vec(),
            _ => panic!("Solver failed"),
        }
    }
}
```

**Replace dense matrix usage:**
```rust
// ❌ BEFORE
let k_global = DMatrix::zeros(num_dof, num_dof); // 28 GB for 60K DOF!

// ✅ AFTER
let k_global = CsrMatrix::new(num_dof, num_dof, ...); // ~10 MB for 60K DOF
```

#### Acceptance Criteria
- [ ] No `DMatrix` used for global stiffness
- [ ] Memory usage < 100 MB for 10K-node model
- [ ] Performance same or better than dense
- [ ] All tests pass

---

### 3.3 Add Result Caching to Rust API

**Time**: 1 day

```rust
// apps/rust-api/src/handlers/analysis.rs
use moka::future::Cache;
use std::sync::Arc;
use blake3::hash;

pub struct AnalysisCache {
    cache: Arc<Cache<String, AnalysisResult>>,
}

impl AnalysisCache {
    pub fn new() -> Self {
        Self {
            cache: Arc::new(
                Cache::builder()
                    .max_capacity(1000)
                    .time_to_live(Duration::from_secs(3600)) // 1 hour
                    .build()
            ),
        }
    }
    
    pub async fn get_or_compute(
        &self,
        input: &AnalysisInput,
        compute_fn: impl Future<Output = AnalysisResult>,
    ) -> AnalysisResult {
        // Hash the input to create cache key
        let key = self.hash_input(input);
        
        match self.cache.get(&key).await {
            Some(cached) => {
                tracing::info!("Cache hit for analysis");
                cached
            }
            None => {
                let result = compute_fn.await;
                self.cache.insert(key, result.clone()).await;
                result
            }
        }
    }
    
    fn hash_input(&self, input: &AnalysisInput) -> String {
        let json = serde_json::to_string(input).unwrap();
        blake3::hash(json.as_bytes()).to_hex().to_string()
    }
}
```

---

## Phase 4: Bundle Optimization (Week 8-9)

**Goal**: Reduce bundle size by 40%, improve LCP  

### 4.1 Split Large Components

**Time**: 3 days

#### ModernModeler.tsx → Multiple Chunks

```tsx
// apps/web/src/components/ModernModeler.tsx
// Currently 3,932 lines → 828 KB chunk

// Extract sub-components to separate files:
const PropertyPanel = lazy(() => import('./modeler/PropertyPanel'));
const ToolBar = lazy(() => import('./modeler/ToolBar'));
const LayersPanel = lazy(() => import('./modeler/LayersPanel'));
const AnalysisDialog = lazy(() => import('./modeler/AnalysisDialog'));
const ExportDialog = lazy(() => import('./modeler/ExportDialog'));

export function ModernModeler() {
  return (
    <Suspense fallback={<ModelerSkeleton />}>
      <div className="modeler">
        <Suspense fallback={<ToolBarSkeleton />}>
          <ToolBar />
        </Suspense>
        
        <Canvas>
          <SharedScene />
        </Canvas>
        
        <Suspense fallback={null}>
          <PropertyPanel />
        </Suspense>
      </div>
    </Suspense>
  );
}
```

#### Target Structure
```
apps/web/src/components/modeler/
  ├── ModernModeler.tsx          (400 lines, 80 KB chunk)
  ├── PropertyPanel.tsx          (600 lines, lazy)
  ├── ToolBar.tsx                (500 lines, lazy)
  ├── LayersPanel.tsx            (400 lines, lazy)
  ├── AnalysisDialog.tsx         (800 lines, lazy)
  └── ExportDialog.tsx           (700 lines, lazy)
```

---

### 4.2 Split Zustand Store into Slices

**Time**: 2 days

```typescript
// apps/web/src/store/slices/nodes.slice.ts
export const createNodesSlice: StateCreator<ModelState, [], [], NodesSlice> = (set, get) => ({
  nodes: [],
  addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),
  removeNode: (id) => set((state) => ({ nodes: state.nodes.filter(n => n.id !== id) })),
});

// apps/web/src/store/index.ts
import { create } from 'zustand';
import { createNodesSlice } from './slices/nodes.slice';
import { createMembersSlice } from './slices/members.slice';
import { createAnalysisSlice } from './slices/analysis.slice';

export const useModelStore = create<ModelState>()((...a) => ({
  ...createNodesSlice(...a),
  ...createMembersSlice(...a),
  ...createAnalysisSlice(...a),
}));
```

---

### 4.3 Enable CSS Code Splitting

**Time**: 1 day

```typescript
// apps/web/vite.config.ts
export default defineConfig({
  build: {
    cssCodeSplit: true, // Split CSS per route
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
        },
      },
    },
  },
});
```

---

### 4.4 Lazy Load Heavy Libraries

**Time**: 1 day

```typescript
// apps/web/src/utils/pdf-export.ts
export async function exportToPDF(data: AnalysisResult) {
  // Lazy load jsPDF only when needed
  const { jsPDF } = await import('jspdf');
  const autoTable = await import('jspdf-autotable');
  
  const doc = new jsPDF();
  // ... generate PDF
}

// apps/web/src/utils/excel-export.ts
export async function exportToExcel(data: AnalysisResult) {
  const XLSX = await import('xlsx');
  // ... generate Excel
}
```

---

## Phase 5: Infrastructure & Polish (Week 10-12)

### 5.1 Add Connection Pooling Config

```typescript
// apps/api/src/models.ts
await mongoose.connect(connectionUri, {
  maxPoolSize: 20,
  minPoolSize: 5,
  maxIdleTimeMS: 30000,
});
```

```rust
// apps/rust-api/src/db.rs
ClientOptions::builder()
    .max_pool_size(Some(20))
    .min_pool_size(Some(2))
    .build()
```

---

### 5.2 Add Preconnect Headers

```html
<!-- apps/web/index.html -->
<head>
  <link rel="preconnect" href="https://api.beamlab.com" crossorigin>
  <link rel="dns-prefetch" href="https://ai.beamlab.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
</head>
```

---

### 5.3 Standardize Error Response Format

```typescript
// Unified error format for all backends
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
```

---

### 5.4 Add Redis for Rate Limiting

```typescript
// apps/api/package.json
{
  "dependencies": {
    "rate-limit-redis": "^4.2.0",
    "ioredis": "^5.3.2"
  }
}

// apps/api/src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export const rateLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:',
  }),
  windowMs: 15 * 60 * 1000,
  max: 100,
});
```

---

## Implementation Checklist

### Phase 1 (Week 1-2) — Quick Wins ✅
- [ ] Fix mathjs wildcard imports (4 files)
- [ ] Add compression middleware (Express)
- [ ] Add Brotli compression (Vite)
- [ ] Batch SharedScene subscriptions
- [ ] Python asyncio.to_thread() wrapping
- [ ] Add .lean() to Mongoose queries
- [ ] Convert PNGs to AVIF/WebP
- [ ] Remove WASM debug symbols
- [ ] Lower Sentry profile sample rate
- [ ] Delete duplicate package.json files

### Phase 2 (Week 3-5) — Architecture ⚡
- [ ] Consolidate to MongoDB only
- [ ] Create unified Rust solver
- [ ] Migrate Node.js API to Rust API
- [ ] Python: AI features only

### Phase 3 (Week 6-7) — Computation 🚀
- [ ] Move math to Web Workers
- [ ] Rust sparse matrix implementation
- [ ] Add result caching

### Phase 4 (Week 8-9) — Bundle 📦
- [ ] Split ModernModeler component
- [ ] Split Zustand store into slices
- [ ] Enable CSS code splitting
- [ ] Lazy load PDF/Excel libraries

### Phase 5 (Week 10-12) — Infrastructure 🏗️
- [ ] Connection pooling config
- [ ] Preconnect headers
- [ ] Standardize error formats
- [ ] Redis rate limiting

---

## Success Metrics

### Weekly Checkpoints

**Week 2:** Phase 1 complete
- Bundle size: -200 KB
- Event loop: unblocked
- Memory per query: -70%

**Week 5:** Phase 2 complete
- Databases: 1 (was 2)
- Solvers: 1 (was 4)
- APIs: 1 (was 2)

**Week 7:** Phase 3 complete
- Main thread blocking: 0ms
- Large model analysis: 10K nodes work

**Week 9:** Phase 4 complete
- Bundle size: -40%
- LCP: <2.0s

**Week 12:** Phase 5 complete
- Production ready
- All monitoring green

---

## Rollback Procedures

Each phase has a rollback plan:

1. **Phase 1**: Individual commits, each revertible
2. **Phase 2**: Keep old implementations for 1 release cycle
3. **Phase 3**: Feature flags for worker vs main thread
4. **Phase 4**: Lazy loading has natural fallbacks
5. **Phase 5**: Infrastructure is additive

---

## Validation

After each phase:

```bash
# Performance
npm run test:performance
lighthouse https://app.beamlab.com --output=json

# Functionality
npm run test:e2e
npm run test:regression

# Memory
node --expose-gc server.js
# Monitor RSS in production

# Bundle
npm run analyze
# Compare to baseline
```

---

## Timeline Summary

| Phase | Duration | Risk | Impact |
|-------|----------|------|--------|
| 0: Pre-flight | 2 days | Low | Baselines |
| 1: Quick wins | 2 weeks | Low | High |
| 2: Architecture | 3 weeks | Medium | Very High |
| 3: Computation | 2 weeks | Medium | High |
| 4: Bundle | 2 weeks | Low | High |
| 5: Infrastructure | 3 weeks | Low | Medium |
| **Total** | **12 weeks** | | **Transformational** |

---

## Next Steps

1. **Review this plan** with the team
2. **Get stakeholder sign-off** on the aggressive timeline
3. **Create tracking board** (GitHub Projects or Jira)
4. **Start Phase 0** (establish baselines)
5. **Begin Phase 1** (quick wins for immediate impact)

**Questions? Ready to start?** 🚀
