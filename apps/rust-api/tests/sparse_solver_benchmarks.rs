//! Sparse solver micro-bench harness (opt-in)
//!
//! Run manually with:
//! `cargo test sparse_solver_benchmark_ --test sparse_solver_benchmarks -- --ignored --nocapture`
//!
//! GPU parity benchmark (CPU-reference stubs, no hardware required):
//! `cargo test sparse_solver_benchmark_gpu_parity -- --ignored --nocapture`

use std::time::Instant;

use nalgebra::DVector;
use beamlab_rust_api::solver::gpu_solver::{
    cpu_csr_matvec_reference, gpu_pcg_solve, CsrDeviceBuffers, GpuConfig,
};
use beamlab_rust_api::solver::sparse_solver::{SolverStrategy, SparseSolver};

// ─── COO helpers ──────────────────────────────────────────────────────────────

fn build_tridiagonal_spd_coo(n: usize) -> (Vec<usize>, Vec<usize>, Vec<f64>, DVector<f64>) {
    let mut row_indices = Vec::with_capacity(3 * n - 2);
    let mut col_indices = Vec::with_capacity(3 * n - 2);
    let mut values = Vec::with_capacity(3 * n - 2);

    for i in 0..n {
        row_indices.push(i);
        col_indices.push(i);
        values.push(if i == n - 1 { 3.0 } else { 4.0 });

        if i + 1 < n {
            row_indices.push(i);
            col_indices.push(i + 1);
            values.push(-1.0);

            row_indices.push(i + 1);
            col_indices.push(i);
            values.push(-1.0);
        }
    }

    let rhs = DVector::from_element(n, 10.0);
    (row_indices, col_indices, values, rhs)
}

/// Build a frame-like SPD sparse matrix in COO format.
///
/// Uses block-coupled DOFs (e.g., 6 per node) with:
/// - stronger intra-node coupling (block-diagonal)
/// - nearest-node coupling along the chain (off-block terms)
fn build_frame_like_spd_coo(
    node_count: usize,
    dofs_per_node: usize,
) -> (usize, Vec<usize>, Vec<usize>, Vec<f64>, DVector<f64>) {
    let n = node_count * dofs_per_node;
    let mut row_indices = Vec::new();
    let mut col_indices = Vec::new();
    let mut values = Vec::new();

    let base_diag    = 24.0;
    let intra_couple = -0.35;
    let inter_diag   = -1.15;
    let inter_cross  = -0.08;

    for node in 0..node_count {
        let start = node * dofs_per_node;

        // Intra-node block (dense local stiffness-like block).
        for a in 0..dofs_per_node {
            for b in 0..dofs_per_node {
                row_indices.push(start + a);
                col_indices.push(start + b);
                values.push(if a == b { base_diag + a as f64 * 0.05 } else { intra_couple });
            }
        }

        // Nearest-neighbour node coupling (banded global connectivity).
        if node + 1 < node_count {
            let next = (node + 1) * dofs_per_node;
            for a in 0..dofs_per_node {
                row_indices.push(start + a); col_indices.push(next + a);  values.push(inter_diag);
                row_indices.push(next + a);  col_indices.push(start + a); values.push(inter_diag);

                if a + 1 < dofs_per_node {
                    row_indices.push(start + a);     col_indices.push(next + (a + 1));  values.push(inter_cross);
                    row_indices.push(next + (a + 1)); col_indices.push(start + a);      values.push(inter_cross);
                }
            }
        }
    }

    let rhs = DVector::from_element(n, 7.5);
    (n, row_indices, col_indices, values, rhs)
}

// ─── Shared benchmark runner ──────────────────────────────────────────────────

fn run_sparse_coo_benchmark(n: usize, label: &str) {
    let solver = SparseSolver::new();
    let (rows, cols, vals, rhs) = build_tridiagonal_spd_coo(n);

    let start = Instant::now();
    let result = solver
        .solve_coo(n, &rows, &cols, &vals, &rhs, &[])
        .unwrap_or_else(|err| panic!("{} DOF solve should succeed: {}", n, err));
    let elapsed_ms = start.elapsed().as_secs_f64() * 1000.0;

    assert!(result.solution.iter().all(|v| v.is_finite()));
    assert!(result.total_time_ms.is_finite());
    if n >= 3_000 {
        assert!(
            matches!(
                result.strategy_used,
                SolverStrategy::PreconditionedCG | SolverStrategy::MultiFrontal
            ),
            "Expected large solve to use sparse-oriented strategy, got {:?}",
            result.strategy_used
        );
    }

    println!(
        "[BENCH][{}] strategy={:?} matrix_build_ms={:.3} solve_ms={:.3} total_ms={:.3} \
         iterations={:?} converged={:?} residual={:?} tol={:?} precond={:?} \
         fallback={:?} fallback_strategy={:?} wall_ms={:.3}",
        label,
        result.strategy_used,
        result.matrix_build_time_ms,
        result.solve_time_ms,
        result.total_time_ms,
        result.iteration_count,
        result.converged,
        result.final_residual_norm,
        result.tolerance_used,
        result.preconditioner_used,
        result.fallback_used,
        result.fallback_strategy,
        elapsed_ms
    );
}

// ─── Tridiagonal benchmarks (1k → 100k DOF) ──────────────────────────────────

#[test]
#[ignore = "manual benchmark"]
fn sparse_solver_benchmark_1000_dof() {
    run_sparse_coo_benchmark(1_000, "1000");
}

#[test]
#[ignore = "manual benchmark"]
fn sparse_solver_benchmark_3000_dof() {
    run_sparse_coo_benchmark(3_000, "3000");
}

#[test]
#[ignore = "manual benchmark"]
fn sparse_solver_benchmark_6000_dof() {
    run_sparse_coo_benchmark(6_000, "6000");
}

#[test]
#[ignore = "manual benchmark"]
fn sparse_solver_benchmark_20000_dof() {
    run_sparse_coo_benchmark(20_000, "20000");
}

#[test]
#[ignore = "manual benchmark"]
fn sparse_solver_benchmark_50000_dof() {
    run_sparse_coo_benchmark(50_000, "50000");
}

#[test]
#[ignore = "manual benchmark"]
fn sparse_solver_benchmark_100000_dof() {
    run_sparse_coo_benchmark(100_000, "100000");
}

// ─── Frame-like benchmark (60k DOF / 10k nodes × 6 DOF) ──────────────────────

#[test]
#[ignore = "manual benchmark"]
fn sparse_solver_benchmark_frame_like_60000_dof() {
    let solver = SparseSolver::new();
    let (n, rows, cols, vals, rhs) = build_frame_like_spd_coo(10_000, 6);

    let start = Instant::now();
    let result = solver
        .solve_coo(n, &rows, &cols, &vals, &rhs, &[])
        .unwrap_or_else(|err| panic!("frame-like 60k DOF solve should succeed: {}", err));
    let elapsed_ms = start.elapsed().as_secs_f64() * 1000.0;

    assert!(result.solution.iter().all(|v| v.is_finite()));
    assert!(result.total_time_ms.is_finite());
    assert!(
        matches!(
            result.strategy_used,
            SolverStrategy::PreconditionedCG | SolverStrategy::MultiFrontal
        ),
        "Expected frame-like large solve to use sparse-oriented strategy, got {:?}",
        result.strategy_used
    );

    println!(
        "[BENCH][FRAME_LIKE_60000] strategy={:?} matrix_build_ms={:.3} solve_ms={:.3} \
         total_ms={:.3} iterations={:?} converged={:?} residual={:?} tol={:?} \
         precond={:?} fallback={:?} fallback_strategy={:?} wall_ms={:.3}",
        result.strategy_used,
        result.matrix_build_time_ms,
        result.solve_time_ms,
        result.total_time_ms,
        result.iteration_count,
        result.converged,
        result.final_residual_norm,
        result.tolerance_used,
        result.preconditioner_used,
        result.fallback_used,
        result.fallback_strategy,
        elapsed_ms
    );
}

// ─── GPU parity benchmark (20k DOF) ──────────────────────────────────────────
//
// Verifies that gpu_pcg_solve (Phase A — CPU-reference stubs) produces a
// solution numerically equivalent to the CPU PCG path in sparse_solver.rs.
// No GPU hardware required; exercises the full gpu_solver code path.
//
// Run with:
//   cargo test sparse_solver_benchmark_gpu_parity -- --ignored --nocapture

fn build_tridiagonal_csr_direct(n: usize) -> (CsrDeviceBuffers, DVector<f64>) {
    let mut row_offsets = Vec::with_capacity(n + 1);
    let mut col_indices = Vec::new();
    let mut values      = Vec::new();
    let mut diagonal    = Vec::with_capacity(n);
    row_offsets.push(0);
    for i in 0..n {
        let d = if i == n - 1 { 3.0_f64 } else { 4.0_f64 };
        diagonal.push(d);
        if i > 0     { col_indices.push(i - 1); values.push(-1.0_f64); }
        col_indices.push(i);    values.push(d);
        if i + 1 < n { col_indices.push(i + 1); values.push(-1.0_f64); }
        row_offsets.push(values.len());
    }
    let rhs = DVector::from_element(n, 1.0_f64);
    (CsrDeviceBuffers::from_host(n, row_offsets, col_indices, values, diagonal), rhs)
}

#[test]
#[ignore = "manual benchmark"]
fn sparse_solver_benchmark_gpu_parity_20000_dof() {
    let n = 20_000;
    let (buffers, rhs) = build_tridiagonal_csr_direct(n);

    // ── GPU PCG (Phase A — CPU-reference stubs) ────────────────────────────
    let gpu_start = Instant::now();
    let gpu_res = gpu_pcg_solve(&buffers, &rhs, 1e-10, n * 2, 1e-30)
        .expect("gpu_pcg_solve should succeed on 20k-DOF SPD system");
    let gpu_ms = gpu_start.elapsed().as_secs_f64() * 1000.0;

    // ── CPU SparseSolver PCG path (via COO entry point) ────────────────────
    let (rows, cols, vals) = {
        let mut r = Vec::new();
        let mut c = Vec::new();
        let mut v = Vec::new();
        for row in 0..n {
            let start = buffers.row_offsets[row];
            let end   = buffers.row_offsets[row + 1];
            for idx in start..end {
                r.push(row);
                c.push(buffers.col_indices[idx]);
                v.push(buffers.values[idx]);
            }
        }
        (r, c, v)
    };
    let solver = SparseSolver::new();
    let cpu_start = Instant::now();
    let cpu_res = solver
        .solve_coo(n, &rows, &cols, &vals, &rhs, &[])
        .expect("CPU PCG should succeed on 20k-DOF SPD system");
    let cpu_ms = cpu_start.elapsed().as_secs_f64() * 1000.0;

    // ── Parity check ──────────────────────────────────────────────────────
    let diff_norm = (&gpu_res.solution - &cpu_res.solution).norm();
    let rel_diff  = diff_norm / cpu_res.solution.norm().max(1e-30);

    let gpu_residual = cpu_csr_matvec_reference(&buffers, &gpu_res.solution) - &rhs;
    let gpu_rel_res  = gpu_residual.norm() / rhs.norm().max(1e-30);

    assert!(
        gpu_res.converged,
        "GPU PCG did not converge (residual = {:.2e})",
        gpu_res.final_residual_norm
    );
    assert!(
        rel_diff < 1e-6,
        "GPU/CPU parity failure: ||x_gpu - x_cpu|| / ||x_cpu|| = {rel_diff:.2e}"
    );
    assert!(
        gpu_rel_res < 1e-8,
        "GPU solution residual too large: {gpu_rel_res:.2e}"
    );

    let gpu_cfg = GpuConfig::from_env();
    println!(
        "[BENCH][GPU_PARITY_20000]  n={n}  gpu_enabled={}  gpu_ms={gpu_ms:.3}  cpu_ms={cpu_ms:.3}  \
         gpu_iters={}  cpu_iters={:?}  rel_diff={rel_diff:.2e}  gpu_rel_res={gpu_rel_res:.2e}  \
         device={}  device_mem_bytes={}  h2d_ms={:.3}  kernel_ms={:.3}  d2h_ms={:.3}",
        gpu_cfg.enabled,
        gpu_res.iteration_count,
        cpu_res.iteration_count,
        gpu_res.device_name,
        gpu_res.device_memory_bytes,
        gpu_res.transfer_host_to_device_ms,
        gpu_res.kernel_compute_ms,
        gpu_res.transfer_device_to_host_ms,
    );
}
