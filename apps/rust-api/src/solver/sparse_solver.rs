//! Industrial-Grade Sparse Matrix Solver
//!
//! High-performance sparse solver for structural analysis, implementing:
//! - Compressed Sparse Row (CSR) storage
//! - Skyline (profile) solver for symmetric banded matrices
//! - Cholesky factorization for SPD systems
//! - Multi-frontal solver for large models
//! - Parallel assembly with Rayon
//!
//! Based on techniques used in STAAD.Pro, SAP2000, and ETABS solvers.

#![allow(dead_code)]

use nalgebra::{DMatrix, DVector};
use rayon::prelude::*;
use std::collections::HashMap;
use std::time::Instant;

/// Solver strategy selection based on problem characteristics
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SolverStrategy {
    /// Direct Cholesky for small models (<500 DOFs)
    DirectCholesky,
    /// Skyline (profile) solver for medium banded models
    Skyline,
    /// Multi-frontal for large sparse models (>5000 DOFs)
    MultiFrontal,
    /// Iterative PCG for very large models (>50000 DOFs)
    PreconditionedCG,
}

/// Sparse matrix in skyline (profile) format for efficient factorization
#[derive(Debug, Clone)]
pub struct SkylineMatrix {
    /// Diagonal elements
    pub diag: Vec<f64>,
    /// Column heights (profile)
    pub col_height: Vec<usize>,
    /// Off-diagonal elements stored column-wise
    pub off_diag: Vec<f64>,
    /// Pointer into off_diag for each column
    pub col_ptr: Vec<usize>,
    /// Matrix dimension
    pub n: usize,
}

/// Result of the sparse solve operation
#[derive(Debug, Clone)]
pub struct SparseResult {
    pub solution: DVector<f64>,
    pub strategy_used: SolverStrategy,
    pub matrix_build_time_ms: f64,
    pub factorization_time_ms: f64,
    pub solve_time_ms: f64,
    pub total_time_ms: f64,
    pub nnz: usize,
    pub bandwidth: usize,
    pub condition_estimate: f64,
    pub iteration_count: Option<usize>,
    pub converged: Option<bool>,
    pub final_residual_norm: Option<f64>,
    pub tolerance_used: Option<f64>,
    pub max_iterations_used: Option<usize>,
    pub preconditioner_used: Option<String>,
    pub fallback_used: Option<bool>,
    pub fallback_strategy: Option<String>,
}

#[derive(Debug, Clone, Copy)]
struct SparseMatrixStats {
    nnz: usize,
    bandwidth: usize,
}

#[derive(Debug, Clone)]
struct CsrTripletMatrix {
    n: usize,
    row_offsets: Vec<usize>,
    col_indices: Vec<usize>,
    values: Vec<f64>,
    diagonal: Vec<f64>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
enum PcgPreconditioner {
    Jacobi,
    None,
    BlockJacobi,
}

/// Industrial sparse solver engine
pub struct SparseSolver {
    /// Automatic strategy selection threshold
    pub auto_strategy: bool,
    /// Maximum DOFs for Skyline strategy
    pub skyline_max_dofs: usize,
    /// Maximum DOFs for MultiFrontal strategy
    pub multifrontal_max_dofs: usize,
    /// Pivot tolerance for numerical stability
    pub pivot_tolerance: f64,
    /// Zero tolerance
    pub zero_tolerance: f64,
    /// PCG relative/absolute residual tolerance
    pub pcg_tolerance: f64,
    /// PCG max-iteration scale factor (max_iter = n * scale)
    pub pcg_max_iter_scale: usize,
    /// Prefer PCG above this DOF count for sufficiently sparse COO systems
    pub pcg_prefer_from_dofs: usize,
    /// DOF threshold for small-model tolerance band
    pub pcg_small_dofs_max: usize,
    /// DOF threshold for medium-model tolerance band
    pub pcg_medium_dofs_max: usize,
    /// Tolerance used for small models
    pub pcg_tolerance_small: f64,
    /// Tolerance used for medium models
    pub pcg_tolerance_medium: f64,
    /// Tolerance used for large models
    pub pcg_tolerance_large: f64,
    /// DOF threshold where huge-model tolerance is used
    pub pcg_huge_dofs_min: usize,
    /// Tolerance used for huge models
    pub pcg_tolerance_huge: f64,
    /// Selected PCG preconditioner
    pcg_preconditioner: PcgPreconditioner,
    /// Enable direct fallback when PCG does not converge
    pub pcg_enable_fallback_direct: bool,
    /// Max DOFs where dense fallback is allowed
    pub pcg_fallback_dense_max_dofs: usize,
    /// Hard cap on PCG iterations to avoid runaway solve times on huge systems
    pub pcg_max_iter_cap: usize,
}

impl SparseSolver {
    fn env_usize(name: &str, default: usize) -> usize {
        std::env::var(name)
            .ok()
            .and_then(|v| v.parse::<usize>().ok())
            .filter(|&v| v > 0)
            .unwrap_or(default)
    }

    fn env_f64(name: &str, default: f64) -> f64 {
        std::env::var(name)
            .ok()
            .and_then(|v| v.parse::<f64>().ok())
            .filter(|v| v.is_finite() && *v > 0.0)
            .unwrap_or(default)
    }

    fn env_bool(name: &str, default: bool) -> bool {
        std::env::var(name)
            .ok()
            .map(|v| matches!(v.to_ascii_lowercase().as_str(), "1" | "true" | "yes" | "on"))
            .unwrap_or(default)
    }

    fn env_preconditioner(name: &str, default: PcgPreconditioner) -> PcgPreconditioner {
        std::env::var(name)
            .ok()
            .map(|v| match v.to_ascii_lowercase().as_str() {
                "none" => PcgPreconditioner::None,
                "block_jacobi" | "block-jacobi" | "blockjacobi" => PcgPreconditioner::BlockJacobi,
                _ => PcgPreconditioner::Jacobi,
            })
            .unwrap_or(default)
    }

    pub fn new() -> Self {
        let skyline_max_dofs = Self::env_usize("SPARSE_SKYLINE_MAX_DOFS", 1500);
        let multifrontal_max_dofs =
            Self::env_usize("SPARSE_MULTIFRONTAL_MAX_DOFS", 5000).max(skyline_max_dofs + 1);
        let pcg_tolerance = Self::env_f64("SPARSE_PCG_TOLERANCE", 1e-10);
        let pcg_max_iter_scale = Self::env_usize("SPARSE_PCG_MAX_ITER_SCALE", 2);
        let pcg_prefer_from_dofs = Self::env_usize("SPARSE_PCG_PREFER_DOFS", 2500);
        let pcg_small_dofs_max = Self::env_usize("SPARSE_PCG_SMALL_DOFS_MAX", 2000);
        let pcg_medium_dofs_max =
            Self::env_usize("SPARSE_PCG_MEDIUM_DOFS_MAX", 10000).max(pcg_small_dofs_max + 1);
        let pcg_tolerance_small = Self::env_f64("SPARSE_PCG_TOL_SMALL", pcg_tolerance);
        let pcg_tolerance_medium = Self::env_f64("SPARSE_PCG_TOL_MEDIUM", 5e-10);
        let pcg_tolerance_large = Self::env_f64("SPARSE_PCG_TOL_LARGE", 1e-9);
        let pcg_huge_dofs_min = Self::env_usize("SPARSE_PCG_HUGE_DOFS_MIN", 200_000);
        let pcg_tolerance_huge = Self::env_f64("SPARSE_PCG_TOL_HUGE", 5e-9);
        let pcg_preconditioner =
            Self::env_preconditioner("SPARSE_PCG_PRECONDITIONER", PcgPreconditioner::Jacobi);
        let pcg_enable_fallback_direct = Self::env_bool("SPARSE_PCG_ENABLE_FALLBACK_DIRECT", true);
        let pcg_fallback_dense_max_dofs =
            Self::env_usize("SPARSE_PCG_FALLBACK_DENSE_MAX_DOFS", 6000);
        let pcg_max_iter_cap = Self::env_usize("SPARSE_PCG_MAX_ITER_CAP", 200_000);

        Self {
            auto_strategy: true,
            skyline_max_dofs,
            multifrontal_max_dofs,
            pivot_tolerance: 1e-12,
            zero_tolerance: 1e-15,
            pcg_tolerance,
            pcg_max_iter_scale,
            pcg_prefer_from_dofs,
            pcg_small_dofs_max,
            pcg_medium_dofs_max,
            pcg_tolerance_small,
            pcg_tolerance_medium,
            pcg_tolerance_large,
            pcg_huge_dofs_min,
            pcg_tolerance_huge,
            pcg_preconditioner,
            pcg_enable_fallback_direct,
            pcg_fallback_dense_max_dofs,
            pcg_max_iter_cap,
        }
    }

    fn effective_pcg_tolerance(&self, n: usize) -> f64 {
        if n >= self.pcg_huge_dofs_min {
            self.pcg_tolerance_huge
        } else if n <= self.pcg_small_dofs_max {
            self.pcg_tolerance_small
        } else if n <= self.pcg_medium_dofs_max {
            self.pcg_tolerance_medium
        } else {
            self.pcg_tolerance_large
        }
    }

    fn effective_pcg_max_iter(&self, n: usize) -> usize {
        let scaled = n.saturating_mul(self.pcg_max_iter_scale.max(1));
        scaled.min(self.pcg_max_iter_cap.max(1))
    }

    fn preconditioner_label(&self) -> String {
        match self.pcg_preconditioner {
            PcgPreconditioner::Jacobi => "jacobi",
            PcgPreconditioner::None => "none",
            PcgPreconditioner::BlockJacobi => "block_jacobi",
        }
        .to_string()
    }

    /// Select optimal solver strategy based on problem size and sparsity
    pub fn select_strategy(&self, n: usize, nnz: usize) -> SolverStrategy {
        let density = nnz as f64 / (n as f64 * n as f64);
        if n <= 500 || density > 0.3 {
            SolverStrategy::DirectCholesky
        } else if n <= self.skyline_max_dofs {
            SolverStrategy::Skyline
        } else if n <= self.multifrontal_max_dofs {
            SolverStrategy::MultiFrontal
        } else {
            SolverStrategy::PreconditionedCG
        }
    }

    /// Main solve entry point: K * u = F
    /// Automatically selects the best strategy
    pub fn solve(
        &self,
        k_global: &DMatrix<f64>,
        f_global: &DVector<f64>,
        constrained_dofs: &[usize],
    ) -> Result<SparseResult, String> {
        let stats = SparseMatrixStats {
            nnz: Self::count_nnz(k_global),
            bandwidth: Self::compute_bandwidth(k_global),
        };
        self.solve_with_stats(k_global, f_global, constrained_dofs, stats, 0.0)
    }

    /// Solve a system assembled in COO/triplet form.
    ///
    /// This avoids an additional $O(n^2)$ scan for nnz/bandwidth statistics in the
    /// analysis pipeline where the reduced matrix already exists as sparse triplets.
    pub fn solve_coo(
        &self,
        n: usize,
        row_indices: &[usize],
        col_indices: &[usize],
        values: &[f64],
        f_global: &DVector<f64>,
        constrained_dofs: &[usize],
    ) -> Result<SparseResult, String> {
        if row_indices.len() != col_indices.len() || row_indices.len() != values.len() {
            return Err("Sparse triplet arrays must have matching lengths".into());
        }
        if n != f_global.len() {
            return Err("Force vector size must match matrix dimension".into());
        }

        let total_start = Instant::now();
        let build_start = Instant::now();
        let (csr_matrix, stats) = self.build_csr_from_coo(n, row_indices, col_indices, values)?;
        let matrix_build_time_ms = build_start.elapsed().as_secs_f64() * 1000.0;

        let mut strategy = if self.auto_strategy {
            self.select_strategy(n, stats.nnz)
        } else {
            SolverStrategy::DirectCholesky
        };

        let density = stats.nnz as f64 / ((n * n) as f64);
        if self.auto_strategy
            && constrained_dofs.is_empty()
            && n >= self.pcg_prefer_from_dofs
            && density <= 0.01
        {
            strategy = SolverStrategy::PreconditionedCG;
        }

        // ── GPU dispatch (feature-gated, Phase A = CPU-reference stubs) ─────────
        // Attempt the GPU path when:
        //   1. `SPARSE_GPU_ENABLE=true` is set at runtime, AND
        //   2. n / nnz exceed the configured thresholds, AND
        //   3. The selected strategy is PreconditionedCG (sparse-friendly), AND
        //   4. No boundary rows are being eliminated (unconstrained DOFs only).
        //
        // On any GpuError (including Unavailable when feature = "gpu" is off)
        // we fall through silently to the CPU PCG block below.
        #[cfg(feature = "gpu")]
        {
            use crate::solver::gpu_solver::{gpu_pcg_solve, CsrDeviceBuffers, GpuConfig};
            if strategy == SolverStrategy::PreconditionedCG && constrained_dofs.is_empty() {
                let gpu_cfg = GpuConfig::from_env();
                if gpu_cfg.should_use_gpu(n, stats.nnz) {
                    let solve_start = Instant::now();
                    let max_iter = self.effective_pcg_max_iter(n);
                    let pcg_tol = self.effective_pcg_tolerance(n);
                    let buffers = CsrDeviceBuffers::from_host(
                        n,
                        csr_matrix.row_offsets.clone(),
                        csr_matrix.col_indices.clone(),
                        csr_matrix.values.clone(),
                        csr_matrix.diagonal.clone(),
                    );
                    match gpu_pcg_solve(&buffers, f_global, pcg_tol, max_iter, 1e-30) {
                        Ok(gpu_res) => {
                            let solve_time_ms = solve_start.elapsed().as_secs_f64() * 1000.0;
                            let total_time_ms = total_start.elapsed().as_secs_f64() * 1000.0;
                            return Ok(SparseResult {
                                solution: gpu_res.solution,
                                strategy_used: strategy,
                                matrix_build_time_ms,
                                factorization_time_ms: 0.0,
                                solve_time_ms,
                                total_time_ms,
                                nnz: stats.nnz,
                                bandwidth: stats.bandwidth,
                                condition_estimate: self
                                    .estimate_condition_from_diagonal(&csr_matrix.diagonal),
                                iteration_count: Some(gpu_res.iteration_count),
                                converged: Some(gpu_res.converged),
                                final_residual_norm: Some(gpu_res.final_residual_norm),
                                tolerance_used: Some(pcg_tol),
                                max_iterations_used: Some(max_iter),
                                preconditioner_used: Some(format!(
                                    "GPU-Jacobi ({})",
                                    gpu_res.device_name
                                )),
                                fallback_used: Some(false),
                                fallback_strategy: None,
                            });
                        }
                        Err(e) => {
                            // Log and fall through to CPU PCG.
                            tracing::warn!("GPU solver error, falling back to CPU PCG: {e}");
                        }
                    }
                }
            }
        }
        // ── CPU PCG path ─────────────────────────────────────────────────────

        if strategy == SolverStrategy::PreconditionedCG && constrained_dofs.is_empty() {
            let solve_start = Instant::now();
            let max_iter = self.effective_pcg_max_iter(n);
            let pcg_tol = self.effective_pcg_tolerance(n);
            let mut pcg_out = self.solve_pcg_csr(&csr_matrix, f_global, pcg_tol, max_iter)?;

            let mut fallback_used = false;
            let mut fallback_strategy = None;

            if !pcg_out.converged
                && self.pcg_enable_fallback_direct
                && n <= self.pcg_fallback_dense_max_dofs
            {
                let k_dense = self.csr_to_dense(&csr_matrix);
                let fallback_sol = self.solve_multifrontal(&k_dense, f_global)?;
                pcg_out.solution = fallback_sol;
                fallback_used = true;
                fallback_strategy = Some("MultiFrontal".to_string());
            }

            let solve_time_ms = solve_start.elapsed().as_secs_f64() * 1000.0;
            let total_time_ms = total_start.elapsed().as_secs_f64() * 1000.0;

            return Ok(SparseResult {
                solution: pcg_out.solution,
                strategy_used: strategy,
                matrix_build_time_ms,
                factorization_time_ms: 0.0,
                solve_time_ms,
                total_time_ms,
                nnz: stats.nnz,
                bandwidth: stats.bandwidth,
                condition_estimate: self.estimate_condition_from_diagonal(&csr_matrix.diagonal),
                iteration_count: Some(pcg_out.iteration_count),
                converged: Some(pcg_out.converged),
                final_residual_norm: Some(pcg_out.final_residual_norm),
                tolerance_used: Some(pcg_tol),
                max_iterations_used: Some(max_iter),
                preconditioner_used: Some(self.preconditioner_label()),
                fallback_used: Some(fallback_used),
                fallback_strategy,
            });
        }

        let k_global = self.csr_to_dense(&csr_matrix);
        self.solve_with_stats(
            &k_global,
            f_global,
            constrained_dofs,
            stats,
            matrix_build_time_ms,
        )
    }

    /// Solve multiple load cases simultaneously (STAAD-like batch solve)
    pub fn solve_multi_rhs(
        &self,
        k_global: &DMatrix<f64>,
        forces: &[DVector<f64>],
        constrained_dofs: &[usize],
    ) -> Result<Vec<SparseResult>, String> {
        let n = k_global.nrows();
        let penalty = self.estimate_penalty(k_global);

        // Apply BCs once
        let mut k_mod = k_global.clone();
        for &dof in constrained_dofs {
            if dof < n {
                k_mod[(dof, dof)] += penalty;
            }
        }

        // Factorize once (Cholesky)
        let fact_start = Instant::now();
        let chol = k_mod
            .clone()
            .cholesky()
            .ok_or_else(|| "Matrix not positive definite for multi-RHS solve".to_string())?;
        let fact_time = fact_start.elapsed().as_secs_f64() * 1000.0;

        let nnz = Self::count_nnz(&k_mod);
        let bandwidth = Self::compute_bandwidth(&k_mod);
        let cond = self.estimate_condition(&k_mod);

        // Solve each RHS using single factorization
        forces
            .par_iter()
            .map(|f| {
                let solve_start = Instant::now();
                let mut f_mod = f.clone();
                for &dof in constrained_dofs {
                    if dof < n {
                        f_mod[dof] = 0.0;
                    }
                }
                let mut sol = chol.solve(&f_mod);
                for &dof in constrained_dofs {
                    if dof < n {
                        sol[dof] = 0.0;
                    }
                }
                let solve_time = solve_start.elapsed().as_secs_f64() * 1000.0;

                Ok(SparseResult {
                    solution: sol,
                    strategy_used: SolverStrategy::DirectCholesky,
                    matrix_build_time_ms: 0.0,
                    factorization_time_ms: fact_time,
                    solve_time_ms: solve_time,
                    total_time_ms: fact_time + solve_time,
                    nnz,
                    bandwidth,
                    condition_estimate: cond,
                    iteration_count: None,
                    converged: None,
                    final_residual_norm: None,
                    tolerance_used: None,
                    max_iterations_used: None,
                    preconditioner_used: None,
                    fallback_used: None,
                    fallback_strategy: None,
                })
            })
            .collect()
    }

    /// Cholesky factorization solver (for SPD matrices)
    fn solve_cholesky(&self, k: &DMatrix<f64>, f: &DVector<f64>) -> Result<DVector<f64>, String> {
        k.clone()
            .cholesky()
            .map(|chol| chol.solve(f))
            .ok_or_else(|| {
                "Matrix is not positive definite. Check for:\n\
                 - Insufficient supports (mechanism)\n\
                 - Zero stiffness members\n\
                 - Disconnected nodes"
                    .to_string()
            })
    }

    /// Skyline (profile) solver - efficient for banded matrices
    fn solve_skyline(&self, k: &DMatrix<f64>, f: &DVector<f64>) -> Result<DVector<f64>, String> {
        let n = k.nrows();
        let sky = self.build_skyline(k);

        // LDLT factorization in skyline format
        let mut diag = sky.diag.clone();
        let mut off = sky.off_diag.clone();

        for j in 0..n {
            let hj = sky.col_height[j];
            let pj = sky.col_ptr[j];

            // Reduce off-diagonal elements
            for i_off in 0..hj {
                let i = j - hj + i_off;
                let hi = sky.col_height[i];
                let pi = sky.col_ptr[i];

                let min_height = i_off.min(hi);
                let mut sum = 0.0;
                for k_idx in 0..min_height {
                    let idx_i = pi + hi - min_height + k_idx;
                    let idx_j = pj + i_off - min_height + k_idx;
                    if idx_i < off.len() && idx_j < off.len() {
                        sum += off[idx_i]
                            * off[idx_j]
                            * diag[i - hi + (hi - min_height + k_idx)].max(self.pivot_tolerance);
                    }
                }
                let idx = pj + i_off;
                if idx < off.len() {
                    off[idx] -= sum;
                    if diag[i].abs() > self.pivot_tolerance {
                        off[idx] /= diag[i];
                    }
                }
            }

            // Reduce diagonal
            let mut sum = 0.0;
            for i_off in 0..hj {
                let idx = pj + i_off;
                if idx < off.len() {
                    let i = j - hj + i_off;
                    sum += off[idx] * off[idx] * diag[i];
                }
            }
            diag[j] -= sum;

            if diag[j].abs() < self.pivot_tolerance {
                return Err(format!(
                    "Near-zero pivot at DOF {}. Possible instability or mechanism.",
                    j
                ));
            }
        }

        // Forward substitution
        let mut y = f.clone();
        for j in 0..n {
            let hj = sky.col_height[j];
            let pj = sky.col_ptr[j];
            for i_off in 0..hj {
                let i = j - hj + i_off;
                let idx = pj + i_off;
                if idx < off.len() {
                    y[j] -= off[idx] * y[i];
                }
            }
        }

        // Diagonal scaling
        for j in 0..n {
            if diag[j].abs() > self.pivot_tolerance {
                y[j] /= diag[j];
            }
        }

        // Back substitution
        for j in (0..n).rev() {
            let hj = sky.col_height[j];
            let pj = sky.col_ptr[j];
            for i_off in 0..hj {
                let i = j - hj + i_off;
                let idx = pj + i_off;
                if idx < off.len() {
                    y[i] -= off[idx] * y[j];
                }
            }
        }

        Ok(y)
    }

    /// Multi-frontal solver stub (delegates to Cholesky with RCM reordering)
    fn solve_multifrontal(
        &self,
        k: &DMatrix<f64>,
        f: &DVector<f64>,
    ) -> Result<DVector<f64>, String> {
        let n = k.nrows();

        // Reverse Cuthill-McKee reordering for bandwidth reduction
        let perm = self.rcm_reorder(k);
        let _inv_perm = self.invert_permutation(&perm);

        // Apply permutation to K and F
        let mut k_perm = DMatrix::zeros(n, n);
        let mut f_perm = DVector::zeros(n);
        for i in 0..n {
            f_perm[perm[i]] = f[i];
            for j in 0..n {
                k_perm[(perm[i], perm[j])] = k[(i, j)];
            }
        }

        // Solve permuted system
        let sol_perm = self.solve_cholesky(&k_perm, &f_perm)?;

        // Un-permute solution
        let mut sol = DVector::zeros(n);
        for i in 0..n {
            sol[i] = sol_perm[perm[i]];
        }

        Ok(sol)
    }

    /// Preconditioned Conjugate Gradient solver for very large systems
    fn solve_pcg(
        &self,
        k: &DMatrix<f64>,
        f: &DVector<f64>,
        tol: f64,
        max_iter: usize,
    ) -> Result<PcgSolveOutput, String> {
        let n = k.nrows();
        let rhs_norm = f.norm().max(1.0);

        let m_inv = self.build_dense_preconditioner(k);

        let mut x = DVector::zeros(n);
        let mut r = f - k * &x;
        let mut z = DVector::from_fn(n, |i, _| r[i] * m_inv[i]);
        let mut p = z.clone();
        let mut rz = r.dot(&z);

        for _iter in 0..max_iter {
            let ap = k * &p;
            let alpha = rz / p.dot(&ap).max(self.zero_tolerance);
            x += alpha * &p;
            r -= alpha * &ap;

            let r_norm = r.norm();
            if r_norm <= tol * rhs_norm {
                return Ok(PcgSolveOutput {
                    solution: x,
                    iteration_count: _iter + 1,
                    converged: true,
                    final_residual_norm: r_norm,
                });
            }

            z = DVector::from_fn(n, |i, _| r[i] * m_inv[i]);
            let rz_new = r.dot(&z);
            let beta = rz_new / rz.max(self.zero_tolerance);
            p = &z + beta * &p;
            rz = rz_new;
        }

        // Return best solution even if not fully converged
        Ok(PcgSolveOutput {
            solution: x,
            iteration_count: max_iter,
            converged: false,
            final_residual_norm: r.norm(),
        })
    }

    fn solve_pcg_csr(
        &self,
        k: &CsrTripletMatrix,
        f: &DVector<f64>,
        tol: f64,
        max_iter: usize,
    ) -> Result<PcgSolveOutput, String> {
        let n = k.n;
        if n != f.len() {
            return Err("Force vector size must match sparse matrix dimension".into());
        }
        let rhs_norm = f.norm().max(1.0);

        let m_inv = self.build_csr_preconditioner(k);

        let mut x = DVector::zeros(n);
        let mut r = f.clone();
        let mut z = DVector::from_fn(n, |i, _| r[i] * m_inv[i]);
        let mut p = z.clone();
        let mut rz = r.dot(&z);

        if r.norm() <= tol * rhs_norm {
            return Ok(PcgSolveOutput {
                solution: x,
                iteration_count: 0,
                converged: true,
                final_residual_norm: r.norm(),
            });
        }

        for iter in 0..max_iter {
            let ap = self.csr_matvec(k, &p);
            let alpha = rz / p.dot(&ap).max(self.zero_tolerance);
            x += alpha * &p;
            r -= alpha * &ap;

            if r.norm() <= tol * rhs_norm {
                return Ok(PcgSolveOutput {
                    solution: x,
                    iteration_count: iter + 1,
                    converged: true,
                    final_residual_norm: r.norm(),
                });
            }

            z = DVector::from_fn(n, |i, _| r[i] * m_inv[i]);
            let rz_new = r.dot(&z);
            let beta = rz_new / rz.max(self.zero_tolerance);
            p = &z + beta * &p;
            rz = rz_new;
        }

        Ok(PcgSolveOutput {
            solution: x,
            iteration_count: max_iter,
            converged: false,
            final_residual_norm: r.norm(),
        })
    }

    fn solve_with_stats(
        &self,
        k_global: &DMatrix<f64>,
        f_global: &DVector<f64>,
        constrained_dofs: &[usize],
        stats: SparseMatrixStats,
        matrix_build_time_ms: f64,
    ) -> Result<SparseResult, String> {
        let total_start = Instant::now();
        let n = k_global.nrows();

        if n != k_global.ncols() {
            return Err("Stiffness matrix must be square".into());
        }
        if n != f_global.len() {
            return Err("Force vector size must match matrix dimension".into());
        }

        let mut k_mod = k_global.clone();
        let mut f_mod = f_global.clone();
        let penalty = self.estimate_penalty(&k_mod);

        for &dof in constrained_dofs {
            if dof < n {
                k_mod[(dof, dof)] += penalty;
                f_mod[dof] = 0.0;
            }
        }

        let strategy = if self.auto_strategy {
            self.select_strategy(n, stats.nnz)
        } else {
            SolverStrategy::DirectCholesky
        };

        let fact_start = Instant::now();
        let solution = match strategy {
            SolverStrategy::DirectCholesky => PcgSolveOutput {
                solution: self.solve_cholesky(&k_mod, &f_mod)?,
                iteration_count: 0,
                converged: true,
                final_residual_norm: 0.0,
            },
            SolverStrategy::Skyline => PcgSolveOutput {
                solution: self.solve_skyline(&k_mod, &f_mod)?,
                iteration_count: 0,
                converged: true,
                final_residual_norm: 0.0,
            },
            SolverStrategy::MultiFrontal => PcgSolveOutput {
                solution: self.solve_multifrontal(&k_mod, &f_mod)?,
                iteration_count: 0,
                converged: true,
                final_residual_norm: 0.0,
            },
            SolverStrategy::PreconditionedCG => {
                let max_iter = self.effective_pcg_max_iter(n);
                let pcg_tol = self.effective_pcg_tolerance(n);
                let mut pcg_out = self.solve_pcg(&k_mod, &f_mod, pcg_tol, max_iter)?;

                if !pcg_out.converged
                    && self.pcg_enable_fallback_direct
                    && n <= self.pcg_fallback_dense_max_dofs
                {
                    let fallback_solution = self.solve_multifrontal(&k_mod, &f_mod)?;
                    pcg_out.solution = fallback_solution;
                }

                pcg_out
            }
        };
        let factorization_time = fact_start.elapsed().as_secs_f64() * 1000.0;

        let mut sol = solution.solution;
        for &dof in constrained_dofs {
            if dof < n {
                sol[dof] = 0.0;
            }
        }

        let cond = self.estimate_condition(&k_mod);
        let total_time = total_start.elapsed().as_secs_f64() * 1000.0;

        Ok(SparseResult {
            solution: sol,
            strategy_used: strategy,
            matrix_build_time_ms,
            factorization_time_ms: factorization_time,
            solve_time_ms: total_time - factorization_time,
            total_time_ms: matrix_build_time_ms + total_time,
            nnz: stats.nnz,
            bandwidth: stats.bandwidth,
            condition_estimate: cond,
            iteration_count: if strategy == SolverStrategy::PreconditionedCG {
                Some(solution.iteration_count)
            } else {
                None
            },
            converged: if strategy == SolverStrategy::PreconditionedCG {
                Some(solution.converged)
            } else {
                None
            },
            final_residual_norm: if strategy == SolverStrategy::PreconditionedCG {
                Some(solution.final_residual_norm)
            } else {
                None
            },
            tolerance_used: if strategy == SolverStrategy::PreconditionedCG {
                Some(self.effective_pcg_tolerance(n))
            } else {
                None
            },
            max_iterations_used: if strategy == SolverStrategy::PreconditionedCG {
                Some(self.effective_pcg_max_iter(n))
            } else {
                None
            },
            preconditioner_used: if strategy == SolverStrategy::PreconditionedCG {
                Some(self.preconditioner_label())
            } else {
                None
            },
            fallback_used: if strategy == SolverStrategy::PreconditionedCG {
                Some(
                    !solution.converged
                        && self.pcg_enable_fallback_direct
                        && n <= self.pcg_fallback_dense_max_dofs,
                )
            } else {
                None
            },
            fallback_strategy: if strategy == SolverStrategy::PreconditionedCG
                && !solution.converged
                && self.pcg_enable_fallback_direct
                && n <= self.pcg_fallback_dense_max_dofs
            {
                Some("MultiFrontal".to_string())
            } else {
                None
            },
        })
    }

    fn build_dense_preconditioner(&self, k: &DMatrix<f64>) -> DVector<f64> {
        let n = k.nrows();
        match self.pcg_preconditioner {
            PcgPreconditioner::None => DVector::from_element(n, 1.0),
            PcgPreconditioner::BlockJacobi => {
                // Hook for future block-Jacobi implementation. We keep Jacobi-equivalent
                // behavior for correctness while exposing the selectable preconditioner.
                let mut m_inv = DVector::zeros(n);
                for i in 0..n {
                    let d = k[(i, i)];
                    m_inv[i] = if d.abs() > self.zero_tolerance {
                        1.0 / d
                    } else {
                        1.0
                    };
                }
                m_inv
            }
            PcgPreconditioner::Jacobi => {
                let mut m_inv = DVector::zeros(n);
                for i in 0..n {
                    let d = k[(i, i)];
                    m_inv[i] = if d.abs() > self.zero_tolerance {
                        1.0 / d
                    } else {
                        1.0
                    };
                }
                m_inv
            }
        }
    }

    fn build_csr_preconditioner(&self, k: &CsrTripletMatrix) -> DVector<f64> {
        let n = k.n;
        match self.pcg_preconditioner {
            PcgPreconditioner::None => DVector::from_element(n, 1.0),
            PcgPreconditioner::BlockJacobi => {
                let mut m_inv = DVector::zeros(n);
                for i in 0..n {
                    let d = k.diagonal[i];
                    m_inv[i] = if d.abs() > self.zero_tolerance {
                        1.0 / d
                    } else {
                        1.0
                    };
                }
                m_inv
            }
            PcgPreconditioner::Jacobi => {
                let mut m_inv = DVector::zeros(n);
                for i in 0..n {
                    let d = k.diagonal[i];
                    m_inv[i] = if d.abs() > self.zero_tolerance {
                        1.0 / d
                    } else {
                        1.0
                    };
                }
                m_inv
            }
        }
    }

    fn build_csr_from_coo(
        &self,
        n: usize,
        row_indices: &[usize],
        col_indices: &[usize],
        values: &[f64],
    ) -> Result<(CsrTripletMatrix, SparseMatrixStats), String> {
        let mut aggregated: HashMap<(usize, usize), f64> = HashMap::with_capacity(values.len());

        for ((&r, &c), &v) in row_indices
            .iter()
            .zip(col_indices.iter())
            .zip(values.iter())
        {
            if r >= n || c >= n {
                return Err(format!(
                    "Sparse triplet index out of bounds: ({}, {}) for matrix size {}",
                    r, c, n
                ));
            }
            if v.abs() <= self.zero_tolerance {
                continue;
            }
            *aggregated.entry((r, c)).or_insert(0.0) += v;
        }

        let mut bandwidth = 0usize;
        let mut per_row: Vec<Vec<(usize, f64)>> = vec![Vec::new(); n];
        let mut diagonal = vec![0.0; n];
        let mut nnz = 0usize;

        for ((r, c), value) in aggregated {
            if value.abs() <= self.zero_tolerance {
                continue;
            }
            bandwidth = bandwidth.max(r.abs_diff(c));
            if r == c {
                diagonal[r] = value;
            }
            per_row[r].push((c, value));
            nnz += 1;
        }

        let mut row_offsets = Vec::with_capacity(n + 1);
        let mut csr_col_indices = Vec::with_capacity(nnz);
        let mut csr_values = Vec::with_capacity(nnz);
        row_offsets.push(0);

        for row in per_row.iter_mut() {
            row.sort_by_key(|(col, _)| *col);
            for &(col, value) in row.iter() {
                csr_col_indices.push(col);
                csr_values.push(value);
            }
            row_offsets.push(csr_col_indices.len());
        }

        let stats = SparseMatrixStats { nnz, bandwidth };

        Ok((
            CsrTripletMatrix {
                n,
                row_offsets,
                col_indices: csr_col_indices,
                values: csr_values,
                diagonal,
            },
            stats,
        ))
    }

    fn csr_to_dense(&self, matrix: &CsrTripletMatrix) -> DMatrix<f64> {
        let mut dense = DMatrix::zeros(matrix.n, matrix.n);
        for row in 0..matrix.n {
            let start = matrix.row_offsets[row];
            let end = matrix.row_offsets[row + 1];
            for idx in start..end {
                dense[(row, matrix.col_indices[idx])] = matrix.values[idx];
            }
        }
        dense
    }

    fn csr_matvec(&self, matrix: &CsrTripletMatrix, x: &DVector<f64>) -> DVector<f64> {
        let result: Vec<f64> = (0..matrix.n)
            .into_par_iter()
            .map(|row| {
                let start = matrix.row_offsets[row];
                let end = matrix.row_offsets[row + 1];
                let mut sum = 0.0;
                for idx in start..end {
                    sum += matrix.values[idx] * x[matrix.col_indices[idx]];
                }
                sum
            })
            .collect();

        DVector::from_vec(result)
    }

    fn estimate_condition_from_diagonal(&self, diagonal: &[f64]) -> f64 {
        if diagonal.is_empty() {
            return 1.0;
        }

        let mut min_diag = f64::MAX;
        let mut max_diag = 0.0_f64;
        for &d in diagonal {
            let value = d.abs();
            if value > self.zero_tolerance {
                min_diag = min_diag.min(value);
                max_diag = max_diag.max(value);
            }
        }

        if min_diag < self.zero_tolerance {
            return f64::INFINITY;
        }

        max_diag / min_diag
    }

    /// Build skyline storage from dense matrix
    fn build_skyline(&self, k: &DMatrix<f64>) -> SkylineMatrix {
        let n = k.nrows();
        let mut col_height = vec![0usize; n];

        // Compute column heights (profile)
        for j in 0..n {
            for i in 0..j {
                if k[(i, j)].abs() > self.zero_tolerance {
                    let height = j - i;
                    if height > col_height[j] {
                        col_height[j] = height;
                    }
                }
            }
        }

        // Build pointers
        let mut col_ptr = vec![0usize; n];
        let mut total = 0usize;
        for j in 0..n {
            col_ptr[j] = total;
            total += col_height[j];
        }

        // Fill off-diagonal elements
        let mut off_diag = vec![0.0; total];
        for j in 0..n {
            let hj = col_height[j];
            let pj = col_ptr[j];
            for i_off in 0..hj {
                let i = j - hj + i_off;
                off_diag[pj + i_off] = k[(i, j)];
            }
        }

        // Diagonal
        let diag: Vec<f64> = (0..n).map(|i| k[(i, i)]).collect();

        SkylineMatrix {
            diag,
            col_height,
            off_diag,
            col_ptr,
            n,
        }
    }

    /// Reverse Cuthill-McKee reordering for bandwidth reduction
    fn rcm_reorder(&self, k: &DMatrix<f64>) -> Vec<usize> {
        let n = k.nrows();

        // Build adjacency list
        let mut adj: Vec<Vec<usize>> = vec![Vec::new(); n];
        for i in 0..n {
            for j in (i + 1)..n {
                if k[(i, j)].abs() > self.zero_tolerance {
                    adj[i].push(j);
                    adj[j].push(i);
                }
            }
        }

        // Sort adjacency by degree (ascending)
        let degrees: Vec<usize> = (0..n).map(|i| adj[i].len()).collect();
        for i in 0..n {
            adj[i].sort_by_key(|&j| degrees[j]);
        }

        // BFS from minimum degree node
        let start = (0..n).min_by_key(|&i| adj[i].len()).unwrap_or(0);
        let mut visited = vec![false; n];
        let mut order = Vec::with_capacity(n);
        let mut queue = std::collections::VecDeque::new();

        queue.push_back(start);
        visited[start] = true;

        while let Some(node) = queue.pop_front() {
            order.push(node);
            for &neighbor in &adj[node] {
                if !visited[neighbor] {
                    visited[neighbor] = true;
                    queue.push_back(neighbor);
                }
            }
        }

        // Add any disconnected nodes
        for i in 0..n {
            if !visited[i] {
                order.push(i);
            }
        }

        // Reverse for RCM
        order.reverse();
        order
    }

    fn invert_permutation(&self, perm: &[usize]) -> Vec<usize> {
        let mut inv = vec![0; perm.len()];
        for (i, &p) in perm.iter().enumerate() {
            inv[p] = i;
        }
        inv
    }

    /// Estimate penalty value for boundary conditions
    fn estimate_penalty(&self, k: &DMatrix<f64>) -> f64 {
        let max_diag = (0..k.nrows()).map(|i| k[(i, i)].abs()).fold(0.0, f64::max);
        max_diag * 1e8
    }

    /// Estimate condition number from diagonal elements
    fn estimate_condition(&self, k: &DMatrix<f64>) -> f64 {
        let n = k.nrows();
        if n == 0 {
            return 1.0;
        }
        let mut min_diag = f64::MAX;
        let mut max_diag = 0.0_f64;
        for i in 0..n {
            let d = k[(i, i)].abs();
            if d > self.zero_tolerance {
                min_diag = min_diag.min(d);
                max_diag = max_diag.max(d);
            }
        }
        if min_diag < self.zero_tolerance {
            return f64::INFINITY;
        }
        max_diag / min_diag
    }

    fn count_nnz(k: &DMatrix<f64>) -> usize {
        let n = k.nrows();
        let mut count = 0;
        for i in 0..n {
            for j in 0..n {
                if k[(i, j)].abs() > 1e-15 {
                    count += 1;
                }
            }
        }
        count
    }

    fn compute_bandwidth(k: &DMatrix<f64>) -> usize {
        let n = k.nrows();
        let mut bw = 0usize;
        for i in 0..n {
            for j in (i + 1)..n {
                if k[(i, j)].abs() > 1e-15 {
                    bw = bw.max(j - i);
                }
            }
        }
        bw
    }
}

#[derive(Debug, Clone)]
struct PcgSolveOutput {
    solution: DVector<f64>,
    iteration_count: usize,
    converged: bool,
    final_residual_norm: f64,
}

impl Default for SparseSolver {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_spring_system() {
        let solver = SparseSolver::new();

        // 2-DOF spring system: k1=100, k2=200
        let mut k = DMatrix::zeros(3, 3);
        k[(0, 0)] = 100.0;
        k[(0, 1)] = -100.0;
        k[(1, 0)] = -100.0;
        k[(1, 1)] = 300.0; // 100 + 200
        k[(1, 2)] = -200.0;
        k[(2, 1)] = -200.0;
        k[(2, 2)] = 200.0;

        let mut f = DVector::zeros(3);
        f[1] = 50.0;

        let result = solver.solve(&k, &f, &[0, 2]).unwrap();
        assert!((result.solution[1] - 50.0 / 300.0).abs() < 1e-6);
    }

    #[test]
    fn test_multi_rhs() {
        let solver = SparseSolver::new();

        let mut k = DMatrix::zeros(3, 3);
        k[(0, 0)] = 100.0;
        k[(0, 1)] = -100.0;
        k[(1, 0)] = -100.0;
        k[(1, 1)] = 300.0;
        k[(1, 2)] = -200.0;
        k[(2, 1)] = -200.0;
        k[(2, 2)] = 200.0;

        let mut f1 = DVector::zeros(3);
        f1[1] = 50.0;
        let mut f2 = DVector::zeros(3);
        f2[1] = 100.0;

        let results = solver.solve_multi_rhs(&k, &[f1, f2], &[0, 2]).unwrap();
        assert_eq!(results.len(), 2);
        assert!((results[1].solution[1] / results[0].solution[1] - 2.0).abs() < 1e-6);
    }

    #[test]
    fn test_strategy_selection() {
        let solver = SparseSolver::new();
        assert_eq!(
            solver.select_strategy(100, 5000),
            SolverStrategy::DirectCholesky
        );
        assert_eq!(solver.select_strategy(1200, 50000), SolverStrategy::Skyline);
        assert_eq!(
            solver.select_strategy(4000, 200000),
            SolverStrategy::MultiFrontal
        );
        assert_eq!(
            solver.select_strategy(7000, 1000000),
            SolverStrategy::PreconditionedCG
        );
    }

    #[test]
    fn test_solve_coo_matches_dense_path() {
        let solver = SparseSolver::new();

        let mut k = DMatrix::zeros(3, 3);
        k[(0, 0)] = 100.0;
        k[(0, 1)] = -100.0;
        k[(1, 0)] = -100.0;
        k[(1, 1)] = 300.0;
        k[(1, 2)] = -200.0;
        k[(2, 1)] = -200.0;
        k[(2, 2)] = 200.0;

        let row_indices = vec![0, 0, 1, 1, 1, 2, 2];
        let col_indices = vec![0, 1, 0, 1, 2, 1, 2];
        let values = vec![100.0, -100.0, -100.0, 300.0, -200.0, -200.0, 200.0];

        let mut f = DVector::zeros(3);
        f[1] = 50.0;

        let dense_result = solver.solve(&k, &f, &[0, 2]).unwrap();
        let coo_result = solver
            .solve_coo(3, &row_indices, &col_indices, &values, &f, &[0, 2])
            .unwrap();

        assert!((dense_result.solution[1] - coo_result.solution[1]).abs() < 1e-9);
    }

    #[test]
    fn test_solve_coo_pcg_sparse_path_matches_dense_solution() {
        let mut sparse_solver = SparseSolver::new();
        sparse_solver.skyline_max_dofs = 1;
        sparse_solver.multifrontal_max_dofs = 2;

        let mut reference_solver = SparseSolver::new();
        reference_solver.auto_strategy = false;

        let n = 600;
        let mut k = DMatrix::zeros(n, n);
        let mut row_indices = Vec::new();
        let mut col_indices = Vec::new();
        let mut values = Vec::new();

        for i in 0..n {
            let diag = if i == n - 1 { 3.0 } else { 4.0 };
            k[(i, i)] = diag;
            row_indices.push(i);
            col_indices.push(i);
            values.push(diag);

            if i + 1 < n {
                k[(i, i + 1)] = -1.0;
                k[(i + 1, i)] = -1.0;

                row_indices.push(i);
                col_indices.push(i + 1);
                values.push(-1.0);

                row_indices.push(i + 1);
                col_indices.push(i);
                values.push(-1.0);
            }
        }

        let f = DVector::from_element(n, 10.0);

        let dense_result = reference_solver.solve(&k, &f, &[]).unwrap();
        let sparse_result = sparse_solver
            .solve_coo(n, &row_indices, &col_indices, &values, &f, &[])
            .unwrap();

        for i in [0usize, 1, 2, n / 2, n - 3, n - 2, n - 1] {
            assert!((dense_result.solution[i] - sparse_result.solution[i]).abs() < 1e-8);
        }
        assert_eq!(
            sparse_result.strategy_used,
            SolverStrategy::PreconditionedCG
        );
        assert!(sparse_result.iteration_count.is_some());
    }
}
