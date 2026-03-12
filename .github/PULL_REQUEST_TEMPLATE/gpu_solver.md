## 🚀 GPU Solver Change

### Description
<!-- Describe the GPU-related change in detail -->

### Type of Change
- [ ] 🧪 GPU prototype / proof-of-concept
- [ ] ⚡ GPU kernel implementation
- [ ] 🔄 CPU↔GPU dispatch logic
- [ ] 📊 GPU benchmark / telemetry
- [ ] 🐛 GPU numerical fix
- [ ] 📝 GPU documentation

### Related Issues
Fixes #
Related to #

### GPU Feature Details

| Item | Value |
|------|-------|
| Feature gate | `--features gpu` |
| Runtime env | `SPARSE_GPU_ENABLE=true` |
| Affected kernels | |
| Min DOF threshold | `SPARSE_GPU_MIN_DOFS` |
| Min NNZ threshold | `SPARSE_GPU_MIN_NNZ` |
| Fallback path | CPU PCG → MultiFrontal |

### Numerical Parity Check
<!-- Paste output from the parity test -->

```
||u_gpu - u_cpu|| / ||u_cpu|| = ???
Max element-wise delta        = ???
Parity test status            = PASS / FAIL
```

### Benchmark Results
<!-- Paste [BENCH] output from the ignored benchmark suite -->

| DOF | CPU (ms) | GPU (ms) | Speedup | Converged | Iterations | Fallback |
|-----|----------|----------|---------|-----------|------------|---------|
| | | | | | | |

### Testing
- [ ] `cargo test` passes — no `gpu` feature (zero regression)
- [ ] `cargo test --features gpu` passes
- [ ] `cargo test --test sparse_solver_benchmarks -- --ignored --nocapture` passes
- [ ] GPU parity test: `||delta|| / ||ref|| < 1e-10`
- [ ] CPU fallback verified with `SPARSE_GPU_ENABLE=false`
- [ ] GPU unavailability fallback verified (no `gpu` feature build)

### Checklist
- [ ] No `.unwrap()` on GPU code paths — uses `?` or graceful CPU fallback
- [ ] Device memory freed on all error / early-return paths (RAII / `Drop`)
- [ ] `SparseResult` telemetry fields populated (`preconditioner_used`, `solve_time_ms`, etc.)
- [ ] `GpuSolveResult` transfer/kernel timing fields populated
- [ ] `docs/RUST_SOLVER_GPU_CPU_FOLLOWUPS.md` updated with new env knobs / results
- [ ] No new warnings from `cargo clippy --features gpu`
- [ ] Self-reviewed for security (no unbounded allocations, no user-data leaks)

### Additional Notes
<!-- Any context for reviewers — device quirks, driver requirements, benchmark machine specs -->
