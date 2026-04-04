//! Solver backends: reduced system build, condition estimation, and linear solver dispatch.
//! Default backend should remain LU; additional backends (sparse, out-of-core, cache-optimized)
//! should implement the `LinearSolver` trait defined here.

use nalgebra::{DMatrix, DVector};

pub trait LinearSolver {
    /// Solve K * u = f. Returns displacement vector or an error string.
    fn solve(&self, k: &DMatrix<f64>, f: &DVector<f64>) -> Result<DVector<f64>, String>;
}

/// Default direct solver using LU decomposition.
pub struct LuLinearSolver;

impl LinearSolver for LuLinearSolver {
    fn solve(&self, k: &DMatrix<f64>, f: &DVector<f64>) -> Result<DVector<f64>, String> {
        k.clone()
            .lu()
            .solve(f)
            .ok_or_else(|| "Structure is unstable (singular stiffness matrix)".to_string())
    }
}

pub struct SolveOutcome {
    pub u_global: DVector<f64>,
    pub condition_estimate: f64,
}

/// Solve global displacements on free DOFs and reconstruct full displacement vector.
pub fn solve_displacements(
    k_global: &DMatrix<f64>,
    f_total: &DVector<f64>,
    free_dofs: &[usize],
    num_dof: usize,
) -> Result<SolveOutcome, String> {
    let n_free = free_dofs.len();
    let mut u_global: DVector<f64> = DVector::zeros(num_dof);

    if n_free == 0 {
        return Ok(SolveOutcome {
            u_global,
            condition_estimate: 1.0,
        });
    }

    let mut k_reduced = DMatrix::zeros(n_free, n_free);
    let mut f_reduced = DVector::zeros(n_free);

    for (i, &r_idx) in free_dofs.iter().enumerate() {
        f_reduced[i] = f_total[r_idx];
        for (j, &c_idx) in free_dofs.iter().enumerate() {
            k_reduced[(i, j)] = k_global[(r_idx, c_idx)];
        }
    }

    let mut max_diag = 0.0f64;
    let mut min_diag = f64::MAX;
    for i in 0..n_free {
        let d = k_reduced[(i, i)].abs();
        if d > 1e-20 {
            max_diag = max_diag.max(d);
            min_diag = min_diag.min(d);
        }
    }
    let condition_estimate = if min_diag > 1e-30 {
        max_diag / min_diag
    } else {
        f64::MAX
    };

    let solver = LuLinearSolver;
    let u_reduced = solver.solve(&k_reduced, &f_reduced)?;

    for (i, &dof_idx) in free_dofs.iter().enumerate() {
        u_global[dof_idx] = u_reduced[i];
    }

    Ok(SolveOutcome {
        u_global,
        condition_estimate,
    })
}
