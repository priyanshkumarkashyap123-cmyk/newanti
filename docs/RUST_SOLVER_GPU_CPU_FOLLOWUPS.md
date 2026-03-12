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

## Next backend optimization steps

1. **Adaptive tolerance policy by model scale**
   - Small/medium: stricter residual
   - Very large: looser default + post-check residual gate

2. **Preconditioner upgrade path**
   - Current: Jacobi (diagonal)
   - Next: ILU(0) / block-Jacobi option behind feature flag

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
