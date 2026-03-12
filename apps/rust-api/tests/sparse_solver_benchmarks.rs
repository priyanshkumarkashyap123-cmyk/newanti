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

#[test]
#[ignore = "manual benchmark"]
fn sparse_solver_benchmark_1000_dof() {
    let solver = SparseSolver::new();
    let n = 1_000;
    let (rows, cols, vals, rhs) = build_tridiagonal_spd_coo(n);

    let start = Instant::now();
    let result = solver
        .solve_coo(n, &rows, &cols, &vals, &rhs, &[])
        .expect("1000 DOF solve should succeed");
    let elapsed_ms = start.elapsed().as_secs_f64() * 1000.0;

    assert!(result.solution.iter().all(|v| v.is_finite()));
    assert!(result.total_time_ms.is_finite());

    println!(
        "[BENCH][1000] strategy={:?} matrix_build_ms={:.3} solve_ms={:.3} total_ms={:.3} iterations={:?} converged={:?} residual={:?} wall_ms={:.3}",
        result.strategy_used,
        result.matrix_build_time_ms,
        result.solve_time_ms,
        result.total_time_ms,
        result.iteration_count,
        result.converged,
        result.final_residual_norm,
        elapsed_ms
    );
}

#[test]
#[ignore = "manual benchmark"]
fn sparse_solver_benchmark_3000_dof() {
    let solver = SparseSolver::new();
    let n = 3_000;
    let (rows, cols, vals, rhs) = build_tridiagonal_spd_coo(n);

    let start = Instant::now();
    let result = solver
        .solve_coo(n, &rows, &cols, &vals, &rhs, &[])
        .expect("3000 DOF solve should succeed");
    let elapsed_ms = start.elapsed().as_secs_f64() * 1000.0;

    assert!(result.solution.iter().all(|v| v.is_finite()));
    assert!(result.total_time_ms.is_finite());
    assert!(
        matches!(result.strategy_used, SolverStrategy::PreconditionedCG | SolverStrategy::MultiFrontal),
        "Expected large solve to use sparse-oriented strategy, got {:?}",
        result.strategy_used
    );

    println!(
        "[BENCH][3000] strategy={:?} matrix_build_ms={:.3} solve_ms={:.3} total_ms={:.3} iterations={:?} converged={:?} residual={:?} wall_ms={:.3}",
        result.strategy_used,
        result.matrix_build_time_ms,
        result.solve_time_ms,
        result.total_time_ms,
        result.iteration_count,
        result.converged,
        result.final_residual_norm,
        elapsed_ms
    );
}
