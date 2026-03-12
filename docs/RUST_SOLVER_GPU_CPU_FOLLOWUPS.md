# Rust Solver: CPU→GPU Follow-ups (Post Sparse-PCG Integration)

**Date:** 2026-03-12

## Completed in current phase

- Reduced COO solve path now supports sparse-native PCG execution for large systems.
- Solver now reports:
  - strategy
  - matrix build time
  - iteration count
  - convergence flag
  - final residual norm
  - tolerance and max-iterations used

## New runtime tuning knobs

Environment variables:

- `SPARSE_SKYLINE_MAX_DOFS` (default: `1500`)
- `SPARSE_MULTIFRONTAL_MAX_DOFS` (default: `5000`)
- `SPARSE_PCG_TOLERANCE` (default: `1e-10`)
- `SPARSE_PCG_MAX_ITER_SCALE` (default: `2`) => `max_iter = n * scale`
- `SPARSE_PCG_PREFER_DOFS` (default: `2500`) => if matrix is sufficiently sparse (density ≤ 1%), prefer PCG route
- `SPARSE_PCG_SMALL_DOFS_MAX` (default: `2000`) => upper DOF bound for small-model tolerance band
- `SPARSE_PCG_MEDIUM_DOFS_MAX` (default: `10000`) => upper DOF bound for medium-model tolerance band
- `SPARSE_PCG_TOL_SMALL` (default: `SPARSE_PCG_TOLERANCE`) => tolerance for small-model PCG
- `SPARSE_PCG_TOL_MEDIUM` (default: `5e-10`) => tolerance for medium-model PCG
- `SPARSE_PCG_TOL_LARGE` (default: `1e-9`) => tolerance for large-model PCG
- `SPARSE_PCG_PRECONDITIONER` (default: `jacobi`) => `jacobi` | `none` | `block_jacobi` (hook)
- `SPARSE_PCG_ENABLE_FALLBACK_DIRECT` (default: `true`) => fallback to direct sparse route when PCG does not converge
- `SPARSE_PCG_FALLBACK_DENSE_MAX_DOFS` (default: `6000`) => upper DOF cap for fallback route

## Next backend optimization steps

1. **Adaptive tolerance policy by model scale**
   - ✅ Implemented DOF-banded policy (`small/medium/large`) with env overrides
   - Next: calibrate final band values against benchmark corpus

2. **Preconditioner upgrade path**
   - ✅ Added configurable preconditioner hook (`jacobi`, `none`, `block_jacobi` hook)
   - Current numerical implementation uses Jacobi-equivalent behavior for `block_jacobi` until block kernel lands
   - Next: ILU(0)/true block-Jacobi implementation behind feature flag

3. **Sparse reordering before iterative solve**
   - Integrate RCM/AMD policy for difficult sparsity patterns
   - Track effect on iteration count and total solve time

4. **Numerical QA gates**
   - Compare PCG solution with direct reference for sampled models
   - Add acceptance thresholds on displacement/reaction deltas

5. **Metrics integration**
   - Surface new solver telemetry in `/api/metrics/detailed`
   - Record iteration and convergence trends by model size bucket

## GPU integration path (safe rollout)

1. **Phase A (CPU-hardening)**
   - Stabilize sparse-PCG with benchmark corpus
   - Lock tolerance and iteration policy

2. **Phase B (kernel candidates)**
   - Offload sparse matvec and preconditioner kernels first
   - Keep control loop and convergence checks on CPU

3. **Phase C (runtime dispatch)**
   - Add `gpu_solver` feature gate
   - Route only when nnz/model-size threshold justifies transfer overhead

4. **Phase D (production rollout)**
   - Canary route by tenant/tier
   - Auto-fallback to CPU on non-convergence or timeout

## Benchmark harness

Manual micro-bench test harness:

- File: `apps/rust-api/tests/sparse_solver_benchmarks.rs`
- Run:
  - `cargo test sparse_solver_benchmark_ --test sparse_solver_benchmarks -- --ignored --nocapture`

Capture and compare:

- strategy used
- matrix build ms
- solve ms
- total ms
- iterations
- convergence
- residual norm

Interpretation guidance:

- `converged=true` and low residual: accept PCG route
- `converged=false` with `fallbackUsed=true`: result served via safe direct fallback; treat as tuning signal
- Frequent fallback indicates tolerance/preconditioner/reordering adjustments needed before GPU phase
