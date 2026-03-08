# Design Code Compliance Audit

## Status: Reviewed — No Deployment Blockers

### Rust Design Codes (apps/rust-api/src/design_codes/) — ✅ Production-Ready
- 11 modules: IS 456, IS 800, IS 1893, IS 875, ACI 318, AISC 360, EC2, EC3, NDS 2018, serviceability
- All use named safety factor constants (never inline magic numbers)
- Result structs follow convention: `passed: bool, utilization: f64, message: String`
- 80+ tests with known textbook examples
- Full clause citations (e.g., "IS 456 Cl. 38.1")

### TypeScript Engines (apps/web/src/components/structural/) — ⚠️ Maintenance Risk
- 20+ engines with standardized `CalculationResult` interface
- **Zero test coverage** — high regression risk for future changes
- Uses `isAdequate` instead of `passed` (naming mismatch with Rust)
- Safety factors hardcoded per-file (no shared constants module)

### IS 800 Triple Implementation — ⚠️ Consolidation Needed
| Location | Used By | Status |
|----------|---------|--------|
| `apps/rust-api/src/design_codes/is_800.rs` | Rust API | ✅ Canonical |
| `apps/web/src/components/structural/SteelDesignEngine.ts` | Structural page (exported but unused) | ⚠️ Dead code |
| `apps/web/src/utils/IS800_SteelDesignEngine.ts` | Optimizer.ts (FSD optimization) | ⚠️ Active duplicate |

### Recommended Future Actions (Not Blocking Deployment)
1. Add TypeScript test suite for structural engines (NAFEMS benchmarks)
2. Consolidate IS 800 — delegate TS to Rust API or unify
3. Create shared `constants/safety-factors.ts` module
4. Add missing clause citations to TypeScript engines
