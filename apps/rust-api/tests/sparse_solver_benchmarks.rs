//! Sparse solver micro-bench harness (opt-in)
//!
//! Run manually with:
//! `cargo test sparse_solver_benchmark_ --test sparse_solver_benchmarks -- --ignored --nocapture`

use std::time::Instant;

use nalgebra::DVector;
use rust_api::solver::sparse_solver::{SolverStrategy, SparseSolver};

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
/// The model uses block-coupled DOFs (e.g., 6 per node) with:
/// - stronger intra-node coupling (block-diagonal)
/// - nearest-node coupling along the chain (off-block terms)
///
/// This is still synthetic, but closer to structural stiffness connectivity than
/// a scalar tridiagonal pattern.
fn build_frame_like_spd_coo(
    node_count: usize,
    dofs_per_node: usize,
) -> (usize, Vec<usize>, Vec<usize>, Vec<f64>, DVector<f64>) {
    let n = node_count * dofs_per_node;
    let mut row_indices = Vec::new();
    let mut col_indices = Vec::new();
    let mut values = Vec::new();

    let base_diag = 24.0;
    let intra_couple = -0.35;
    let inter_diag = -1.15;
    let inter_cross = -0.08;

    for node in 0..node_count {
        let start = node * dofs_per_node;

        // Intra-node block terms (dense local stiffness-like block).
        for a in 0..dofs_per_node {
            for b in 0..dofs_per_node {
                row_indices.push(start + a);
                col_indices.push(start + b);
                let v = if a == b {
                    base_diag + a as f64 * 0.05
                } else {
                    intra_couple
                };
                values.push(v);
            }
        }

        // Nearest-neighbor node coupling (banded global connectivity).
        if node + 1 < node_count {
            let next = (node + 1) * dofs_per_node;
            for a in 0..dofs_per_node {
                // Same-DOF coupling
                row_indices.push(start + a);
                col_indices.push(next + a);
                values.push(inter_diag);

                row_indices.push(next + a);
                col_indices.push(start + a);
                values.push(inter_diag);

                // Cross-DOF light coupling for richer sparsity pattern
                if a + 1 < dofs_per_node {
                    row_indices.push(start + a);
                    col_indices.push(next + (a + 1));
                    values.push(inter_cross);

                    row_indices.push(next + (a + 1));
                    col_indices.push(start + a);
                    values.push(inter_cross);
                }
            }
        }
    }

    let rhs = DVector::from_element(n, 7.5);
    (n, row_indices, col_indices, values, rhs)
}

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
            matches!(result.strategy_used, SolverStrategy::PreconditionedCG | SolverStrategy::MultiFrontal),
            "Expected large solve to use sparse-oriented strategy, got {:?}",
            result.strategy_used
        );
    }

    println!(
        "[BENCH][{}] strategy={:?} matrix_build_ms={:.3} solve_ms={:.3} total_ms={:.3} iterations={:?} converged={:?} residual={:?} tol={:?} precond={:?} fallback={:?} fallback_strategy={:?} wall_ms={:.3}",
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

#[test]
#[ignore = "manual benchmark"]
fn sparse_solver_benchmark_frame_like_60000_dof() {
    let solver = SparseSolver::new();
    let dofs_per_node = 6;
    let node_count = 10_000;
    let (n, rows, cols, vals, rhs) = build_frame_like_spd_coo(node_count, dofs_per_node);

    let start = Instant::now();
    let result = solver
        .solve_coo(n, &rows, &cols, &vals, &rhs, &[])
        .unwrap_or_else(|err| panic!("frame-like 60k DOF solve should succeed: {}", err));
    let elapsed_ms = start.elapsed().as_secs_f64() * 1000.0;

    assert!(result.solution.iter().all(|v| v.is_finite()));
    assert!(result.total_time_ms.is_finite());
    assert!(
        matches!(result.strategy_used, SolverStrategy::PreconditionedCG | SolverStrategy::MultiFrontal),
        "Expected frame-like large solve to use sparse-oriented strategy, got {:?}",
        result.strategy_used
    );

    println!(
        "[BENCH][FRAME_LIKE_60000] strategy={:?} matrix_build_ms={:.3} solve_ms={:.3} total_ms={:.3} iterations={:?} converged={:?} residual={:?} tol={:?} precond={:?} fallback={:?} fallback_strategy={:?} wall_ms={:.3}",
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
