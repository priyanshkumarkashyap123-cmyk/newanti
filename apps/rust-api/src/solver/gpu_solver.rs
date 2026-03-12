//! GPU-Accelerated Sparse Solver Kernels
//!
//! Feature-gated behind `--features gpu`. When the feature is NOT compiled in,
//! every GPU function still compiles — it returns `GpuError::Unavailable`.
//! This guarantees the CPU path is never silently bypassed and the codebase
//! compiles identically in both modes.
//!
//! # Architecture
//!
//! ```text
//!   Host CSR data
//!        │
//!   CsrDeviceBuffers::from_host()          ← always available
//!        │
//!   [#cfg(feature = "gpu")]
//!   upload to device (pinned async copy)   ← Phase B
//!        │
//!   gpu_csr_matvec()                       ← cuSPARSE SpMV  (Phase B)
//!   gpu_jacobi_preconditioner()            ← device kernel   (Phase B)
//!        │
//!   PCG control loop — runs on CPU         ← this file, always available
//!   scalar dot products via cublasDdot     ← Phase B
//!        │
//!   download solution ──► DVector<f64>     ← Phase B
//! ```
//!
//! # Phases
//!
//! | Phase | Description |
//! |-------|-------------|
//! | A (current) | CPU-reference stubs behind the GPU API. Exercises the full code path so correctness tests and benchmarks can run without a GPU. |
//! | B | Bind `cuSPARSE` / `cuBLAS` via FFI (`cust` crate or C shim + `bindgen`). Replace stub bodies. |
//! | C | Move PCG scalar reductions to device; use CUDA Graphs for repeated SpMV sequences. |
//!
//! # Environment Variables
//!
//! | Variable | Default | Description |
//! |----------|---------|-------------|
//! | `SPARSE_GPU_ENABLE` | `false` | Master on/off switch |
//! | `SPARSE_GPU_MIN_DOFS` | `10000` | Minimum DOFs before GPU is attempted |
//! | `SPARSE_GPU_MIN_NNZ` | `50000` | Minimum NNZ before GPU is attempted |
//! | `SPARSE_GPU_DEVICE_ID` | `0` | CUDA device ordinal |
//! | `SPARSE_GPU_FORCE_CPU` | `false` | Force CPU even when GPU is available (debug) |

use nalgebra::DVector;
use rayon::prelude::*;
use std::time::Instant;

// ─── Public result type ───────────────────────────────────────────────────────

/// Telemetry produced by a GPU-accelerated PCG solve.
///
/// All timing fields are in milliseconds.  When running on the CPU-reference
/// stub (Phase A), `transfer_*_ms` and `kernel_compute_ms` reflect pure CPU
/// timing so they are still useful as a comparison baseline.
#[derive(Debug, Clone)]
pub struct GpuSolveResult {
    /// Computed displacement / unknown vector.
    pub solution: DVector<f64>,
    /// Number of PCG iterations performed.
    pub iteration_count: usize,
    /// Whether the relative residual criterion was met.
    pub converged: bool,
    /// `||r_final|| / max(1, ||b||)`.
    pub final_residual_norm: f64,
    /// Time to transfer matrix + RHS from host to device (ms).
    pub transfer_host_to_device_ms: f64,
    /// Time spent inside GPU kernels — SpMV, preconditioner, reductions (ms).
    pub kernel_compute_ms: f64,
    /// Time to copy solution from device back to host (ms).
    pub transfer_device_to_host_ms: f64,
    /// Human-readable device label, e.g. `"Tesla V100 32 GB"`.
    /// In Phase A this is `"cpu-only"` or `"gpu-stub (Phase A)"`.
    pub device_name: String,
    /// Estimated device memory consumed in bytes
    /// (CSR arrays + two work vectors).
    pub device_memory_bytes: usize,
}

// ─── Error type ───────────────────────────────────────────────────────────────

/// Errors that can originate from the GPU solver path.
#[derive(Debug, Clone)]
pub enum GpuError {
    /// Feature not compiled in, or disabled via `SPARSE_GPU_ENABLE=false`.
    Unavailable(String),
    /// CUDA driver / runtime returned a non-SUCCESS status.
    DeviceError(String),
    /// NaN / Inf detected in residuals or solution on device.
    NumericalError(String),
    /// DMA / pinned-memory transfer failure.
    TransferError(String),
}

impl std::fmt::Display for GpuError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GpuError::Unavailable(m)    => write!(f, "GPU unavailable: {m}"),
            GpuError::DeviceError(m)    => write!(f, "GPU device error: {m}"),
            GpuError::NumericalError(m) => write!(f, "GPU numerical error: {m}"),
            GpuError::TransferError(m)  => write!(f, "GPU transfer error: {m}"),
        }
    }
}

impl std::error::Error for GpuError {}

// ─── CSR device-buffer handle ─────────────────────────────────────────────────

/// Host-side container for CSR data staged for GPU upload.
///
/// In Phase B this struct will additionally own `DeviceBuffer<f64>` and
/// `DeviceBuffer<usize>` handles (from the `cust` crate or a CUDA C shim) so
/// the same matrix can be reused across multiple RHS solves without repeated
/// host→device transfers.
///
/// Constructed via [`CsrDeviceBuffers::from_host`]; validity of index ranges is
/// the responsibility of the upstream `build_csr_from_coo` function in
/// `sparse_solver.rs`.
#[derive(Debug, Clone)]
pub struct CsrDeviceBuffers {
    /// Matrix dimension (number of rows = number of columns).
    pub n: usize,
    /// Number of non-zero entries.
    pub nnz: usize,
    /// CSR row-pointer array, length `n + 1`.
    pub row_offsets: Vec<usize>,
    /// CSR column-index array, length `nnz`.
    pub col_indices: Vec<usize>,
    /// CSR value array, length `nnz`.
    pub values: Vec<f64>,
    /// Main diagonal, pre-extracted for the Jacobi preconditioner, length `n`.
    pub diagonal: Vec<f64>,
}

impl CsrDeviceBuffers {
    /// Stage host CSR arrays ready for a potential GPU upload.
    pub fn from_host(
        n: usize,
        row_offsets: Vec<usize>,
        col_indices: Vec<usize>,
        values: Vec<f64>,
        diagonal: Vec<f64>,
    ) -> Self {
        let nnz = values.len();
        Self { n, nnz, row_offsets, col_indices, values, diagonal }
    }
}

// ─── Runtime configuration ────────────────────────────────────────────────────

/// GPU solver runtime configuration.
///
/// All fields are read from environment variables at construction time so
/// tuning requires no recompilation.
#[derive(Debug, Clone)]
pub struct GpuConfig {
    /// Master enable — `SPARSE_GPU_ENABLE` (default `false`).
    pub enabled: bool,
    /// Minimum DOF count before GPU dispatch is attempted —
    /// `SPARSE_GPU_MIN_DOFS` (default `10_000`).
    pub min_dofs: usize,
    /// Minimum NNZ count before GPU dispatch is attempted —
    /// `SPARSE_GPU_MIN_NNZ` (default `50_000`).
    pub min_nnz: usize,
    /// CUDA device ordinal — `SPARSE_GPU_DEVICE_ID` (default `0`).
    pub device_id: usize,
    /// Force CPU even when GPU is present —
    /// `SPARSE_GPU_FORCE_CPU` (default `false`).
    pub force_cpu: bool,
}

impl GpuConfig {
    /// Construct by reading current environment variables.
    pub fn from_env() -> Self {
        Self {
            enabled:   env_bool("SPARSE_GPU_ENABLE", false),
            min_dofs:  env_usize("SPARSE_GPU_MIN_DOFS", 10_000),
            min_nnz:   env_usize("SPARSE_GPU_MIN_NNZ",  50_000),
            device_id: env_usize("SPARSE_GPU_DEVICE_ID", 0),
            force_cpu: env_bool("SPARSE_GPU_FORCE_CPU", false),
        }
    }

    /// Returns `true` when GPU dispatch should be attempted for this problem.
    pub fn should_use_gpu(&self, n: usize, nnz: usize) -> bool {
        self.enabled && !self.force_cpu && n >= self.min_dofs && nnz >= self.min_nnz
    }
}

// ─── GPU kernel API ───────────────────────────────────────────────────────────
//
// Each function exists in two versions:
//   • `#[cfg(feature = "gpu")]`      → will call CUDA via FFI in Phase B
//   • `#[cfg(not(feature = "gpu"))]` → returns GpuError::Unavailable
//
// The PCG control loop (`gpu_pcg_solve`) is always-available and catches
// GpuError from each kernel, falling back to the CPU-reference implementation.

/// Sparse matrix–vector product: **y = A · x**.
///
/// Phase A: returns `GpuError::Unavailable` (no `gpu` feature).  
/// Phase B: upload x to device, call `cusparseSpMV`, download y.
#[cfg(feature = "gpu")]
pub fn gpu_csr_matvec(
    buffers: &CsrDeviceBuffers,
    x: &DVector<f64>,
) -> Result<DVector<f64>, GpuError> {
    // TODO(gpu-phase-b): Replace body with cuSPARSE SpMV:
    //   1. Ensure CSR buffers are on device (lazy upload / pre-uploaded).
    //   2. Ensure `x` is on device.
    //   3. Create cuSPARSE SpMV descriptor.
    //   4. Call cusparseSpMV(CUSPARSE_OPERATION_NON_TRANSPOSE, α=1, β=0).
    //   5. Return device y — or copy back if the control loop stays on CPU.
    Ok(cpu_csr_matvec_reference(buffers, x))
}

#[cfg(not(feature = "gpu"))]
pub fn gpu_csr_matvec(
    _buffers: &CsrDeviceBuffers,
    _x: &DVector<f64>,
) -> Result<DVector<f64>, GpuError> {
    Err(GpuError::Unavailable(
        "Compiled without `gpu` feature — using CPU fallback".into(),
    ))
}

/// Build Jacobi (diagonal-inverse) preconditioner: **m_inv[i] = 1 / A[i,i]**.
///
/// Phase A: returns `GpuError::Unavailable` (no `gpu` feature).  
/// Phase B: executes an element-wise reciprocal kernel on the device diagonal.
#[cfg(feature = "gpu")]
pub fn gpu_jacobi_preconditioner(
    buffers: &CsrDeviceBuffers,
    zero_tol: f64,
) -> Result<DVector<f64>, GpuError> {
    // TODO(gpu-phase-b): Replace with device element-wise reciprocal kernel.
    Ok(cpu_jacobi_reference(&buffers.diagonal, zero_tol))
}

#[cfg(not(feature = "gpu"))]
pub fn gpu_jacobi_preconditioner(
    _buffers: &CsrDeviceBuffers,
    _zero_tol: f64,
) -> Result<DVector<f64>, GpuError> {
    Err(GpuError::Unavailable(
        "Compiled without `gpu` feature — using CPU fallback".into(),
    ))
}

// ─── PCG control loop ─────────────────────────────────────────────────────────

/// Full Preconditioned Conjugate Gradient solve.
///
/// This function is **always available** (no feature gate on the function
/// itself).  It attempts the GPU kernel for SpMV and preconditioner application
/// and falls back silently to the CPU-reference implementation when either
/// returns any [`GpuError`] (including `Unavailable`).  This means every
/// convergence code path is tested identically regardless of whether `--features
/// gpu` is enabled.
///
/// # Convergence criterion (relative residual)
/// ```text
/// ||r_k|| ≤ tol · max(1, ||b||)
/// ```
///
/// This is the same criterion used by the CPU PCG path in `sparse_solver.rs`.
pub fn gpu_pcg_solve(
    buffers: &CsrDeviceBuffers,
    f: &DVector<f64>,
    tol: f64,
    max_iter: usize,
    zero_tol: f64,
) -> Result<GpuSolveResult, GpuError> {
    let n = buffers.n;
    if n != f.len() {
        return Err(GpuError::NumericalError(
            "Force vector size must match matrix dimension".into(),
        ));
    }

    // Preconditioner — GPU kernel with automatic CPU fallback.
    let m_inv = gpu_jacobi_preconditioner(buffers, zero_tol)
        .unwrap_or_else(|_| cpu_jacobi_reference(&buffers.diagonal, zero_tol));

    let rhs_norm = f.norm().max(1.0);

    // Phase B — upload CSR arrays to device here (pinned async copy).
    let h2d_start = Instant::now();
    // TODO(gpu-phase-b): actual device upload
    let transfer_h2d_ms = h2d_start.elapsed().as_secs_f64() * 1000.0;

    let mut x  = DVector::zeros(n);
    let mut r  = f.clone();
    let mut z  = DVector::from_fn(n, |i, _| r[i] * m_inv[i]);
    let mut p  = z.clone();
    let mut rz = r.dot(&z);

    // Early exit when initial residual is already within tolerance.
    if r.norm() <= tol * rhs_norm {
        return Ok(GpuSolveResult {
            solution: x,
            iteration_count: 0,
            converged: true,
            final_residual_norm: r.norm(),
            transfer_host_to_device_ms: transfer_h2d_ms,
            kernel_compute_ms: 0.0,
            transfer_device_to_host_ms: 0.0,
            device_name: device_name_label(),
            device_memory_bytes: estimate_device_bytes(buffers),
        });
    }

    let kernel_start = Instant::now();

    for iter in 0..max_iter {
        // SpMV: ap = A · p  — GPU kernel with CPU fallback.
        let ap = gpu_csr_matvec(buffers, &p)
            .unwrap_or_else(|_| cpu_csr_matvec_reference(buffers, &p));

        let pap   = p.dot(&ap).max(zero_tol);
        let alpha = rz / pap;
        x += alpha * &p;
        r -= alpha * &ap;

        let r_norm = r.norm();
        if r_norm <= tol * rhs_norm {
            let kernel_ms = kernel_start.elapsed().as_secs_f64() * 1000.0;
            // Phase B — copy solution from device here.
            let d2h_ms = 0.0_f64; // TODO(gpu-phase-b)
            return Ok(GpuSolveResult {
                solution: x,
                iteration_count: iter + 1,
                converged: true,
                final_residual_norm: r_norm,
                transfer_host_to_device_ms: transfer_h2d_ms,
                kernel_compute_ms: kernel_ms,
                transfer_device_to_host_ms: d2h_ms,
                device_name: device_name_label(),
                device_memory_bytes: estimate_device_bytes(buffers),
            });
        }

        z = DVector::from_fn(n, |i, _| r[i] * m_inv[i]);
        let rz_new = r.dot(&z);
        let beta   = rz_new / rz.max(zero_tol);
        p  = &z + beta * &p;
        rz = rz_new;
    }

    // Reached max_iter without convergence — return best approximation.
    let kernel_ms = kernel_start.elapsed().as_secs_f64() * 1000.0;
    Ok(GpuSolveResult {
        solution: x,
        iteration_count: max_iter,
        converged: false,
        final_residual_norm: r.norm(),
        transfer_host_to_device_ms: transfer_h2d_ms,
        kernel_compute_ms: kernel_ms,
        transfer_device_to_host_ms: 0.0,
        device_name: device_name_label(),
        device_memory_bytes: estimate_device_bytes(buffers),
    })
}

// ─── CPU reference implementations (always available) ─────────────────────────

/// CPU reference CSR matvec using Rayon parallelism.
///
/// Used as the fallback inside [`gpu_pcg_solve`] and as the reference for
/// numerical parity tests.
pub fn cpu_csr_matvec_reference(buffers: &CsrDeviceBuffers, x: &DVector<f64>) -> DVector<f64> {
    let result: Vec<f64> = (0..buffers.n)
        .into_par_iter()
        .map(|row| {
            let start = buffers.row_offsets[row];
            let end   = buffers.row_offsets[row + 1];
            (start..end)
                .map(|idx| buffers.values[idx] * x[buffers.col_indices[idx]])
                .sum()
        })
        .collect();
    DVector::from_vec(result)
}

/// CPU reference Jacobi preconditioner: `m_inv[i] = 1 / diag[i]`.
pub fn cpu_jacobi_reference(diagonal: &[f64], zero_tol: f64) -> DVector<f64> {
    let n = diagonal.len();
    let mut m_inv = DVector::zeros(n);
    for i in 0..n {
        m_inv[i] = if diagonal[i].abs() > zero_tol {
            1.0 / diagonal[i]
        } else {
            1.0
        };
    }
    m_inv
}

// ─── Private helpers ──────────────────────────────────────────────────────────

fn device_name_label() -> String {
    #[cfg(feature = "gpu")]
    { "gpu-stub (CPU reference — Phase A)".to_string() }
    #[cfg(not(feature = "gpu"))]
    { "cpu-only (no gpu feature)".to_string() }
}

/// Rough estimate of device memory required for the solve.
fn estimate_device_bytes(b: &CsrDeviceBuffers) -> usize {
    // row_offsets + col_indices + values + diagonal + 2 work vectors (x, ap).
    let index_bytes = (b.row_offsets.len() + b.col_indices.len()) * std::mem::size_of::<usize>();
    let value_bytes = (b.values.len() + b.diagonal.len() + 2 * b.n) * std::mem::size_of::<f64>();
    index_bytes + value_bytes
}

fn env_usize(name: &str, default: usize) -> usize {
    std::env::var(name)
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .filter(|&v| v > 0)
        .unwrap_or(default)
}

fn env_bool(name: &str, default: bool) -> bool {
    std::env::var(name)
        .ok()
        .map(|v| matches!(v.to_ascii_lowercase().as_str(), "1" | "true" | "yes" | "on"))
        .unwrap_or(default)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    /// 3×3 SPD tridiagonal:
    ///   [ 4  -1   0 ]
    ///   [-1   4  -1 ]
    ///   [ 0  -1   3 ]
    fn make_3x3_spd() -> CsrDeviceBuffers {
        CsrDeviceBuffers::from_host(
            3,
            vec![0, 2, 5, 7],
            vec![0, 1, 0, 1, 2, 1, 2],
            vec![4.0, -1.0, -1.0, 4.0, -1.0, -1.0, 3.0],
            vec![4.0, 4.0, 3.0],
        )
    }

    /// Build an n-DOF tridiagonal SPD matrix in CSR format.
    fn make_tridiagonal_csr(n: usize) -> CsrDeviceBuffers {
        let mut row_offsets = Vec::with_capacity(n + 1);
        let mut col_indices = Vec::new();
        let mut values      = Vec::new();
        let mut diagonal    = Vec::with_capacity(n);
        row_offsets.push(0);
        for i in 0..n {
            let d = if i == n - 1 { 3.0 } else { 4.0 };
            diagonal.push(d);
            if i > 0     { col_indices.push(i - 1); values.push(-1.0); }
            col_indices.push(i);    values.push(d);
            if i + 1 < n { col_indices.push(i + 1); values.push(-1.0); }
            row_offsets.push(values.len());
        }
        CsrDeviceBuffers::from_host(n, row_offsets, col_indices, values, diagonal)
    }

    // ── CPU reference tests ───────────────────────────────────────────────────

    #[test]
    fn test_cpu_matvec_3x3() {
        let csr = make_3x3_spd();
        let x   = DVector::from_vec(vec![1.0, 2.0, 3.0]);
        let y   = cpu_csr_matvec_reference(&csr, &x);
        // y = [4·1 + (-1)·2, (-1)·1 + 4·2 + (-1)·3, (-1)·2 + 3·3]
        //   = [2, 4, 7]
        assert!((y[0] - 2.0).abs() < 1e-12, "y[0] = {}", y[0]);
        assert!((y[1] - 4.0).abs() < 1e-12, "y[1] = {}", y[1]);
        assert!((y[2] - 7.0).abs() < 1e-12, "y[2] = {}", y[2]);
    }

    #[test]
    fn test_cpu_jacobi_3x3() {
        let diag  = vec![4.0, 4.0, 3.0];
        let m_inv = cpu_jacobi_reference(&diag, 1e-15);
        assert!((m_inv[0] - 0.25).abs()       < 1e-12);
        assert!((m_inv[1] - 0.25).abs()       < 1e-12);
        assert!((m_inv[2] - 1.0 / 3.0).abs() < 1e-12);
    }

    // ── Config tests ──────────────────────────────────────────────────────────

    #[test]
    fn test_gpu_config_disabled_by_default() {
        // With no env vars set, GPU must be disabled — no silent dispatch surprises.
        let cfg = GpuConfig::from_env();
        assert!(
            !cfg.should_use_gpu(1_000_000, 5_000_000),
            "GPU should be off by default"
        );
    }

    // ── PCG solve tests ───────────────────────────────────────────────────────

    #[test]
    fn test_gpu_pcg_solves_3x3() {
        let csr = make_3x3_spd();
        let f   = DVector::from_vec(vec![10.0, 10.0, 10.0]);
        let res = gpu_pcg_solve(&csr, &f, 1e-10, 50, 1e-15)
            .expect("PCG should succeed on 3×3 SPD system");

        assert!(res.converged, "PCG did not converge on 3×3 SPD system");
        assert!(res.solution.iter().all(|v| v.is_finite()), "Solution contains non-finite values");
        assert!(res.iteration_count <= 10, "Too many iterations: {}", res.iteration_count);

        let resid = cpu_csr_matvec_reference(&csr, &res.solution) - &f;
        assert!(resid.norm() < 1e-8, "Residual too large: {}", resid.norm());
    }

    #[test]
    fn test_gpu_pcg_parity_200_dofs() {
        let n   = 200;
        let csr = make_tridiagonal_csr(n);
        let f   = DVector::from_element(n, 10.0);

        let res = gpu_pcg_solve(&csr, &f, 1e-10, n * 2, 1e-15)
            .expect("PCG should succeed on 200-DOF SPD system");

        assert!(res.converged, "PCG did not converge on 200-DOF system");

        let ax      = cpu_csr_matvec_reference(&csr, &res.solution);
        let rel_err = (&ax - &f).norm() / f.norm();
        assert!(
            rel_err < 1e-8,
            "GPU/CPU parity failure: relative residual = {rel_err}"
        );
    }

    #[test]
    fn test_gpu_pcg_zero_rhs_returns_zero_solution() {
        let n   = 50;
        let csr = make_tridiagonal_csr(n);
        let f   = DVector::zeros(n);

        let res = gpu_pcg_solve(&csr, &f, 1e-10, n * 2, 1e-15)
            .expect("PCG should handle zero RHS");

        assert!(res.converged);
        assert_eq!(res.iteration_count, 0, "Zero RHS should exit without iterating");
        assert!(res.solution.norm() < 1e-14);
    }

    // ── Feature-gate tests ────────────────────────────────────────────────────

    /// Without the `gpu` feature, the GPU matvec must return `Unavailable` so
    /// callers know not to rely on it.
    #[cfg(not(feature = "gpu"))]
    #[test]
    fn test_gpu_matvec_unavailable_without_feature() {
        let csr = make_3x3_spd();
        let x   = DVector::from_vec(vec![1.0, 2.0, 3.0]);
        match gpu_csr_matvec(&csr, &x) {
            Err(GpuError::Unavailable(_)) => {}
            other => panic!("Expected Unavailable, got: {:?}", other),
        }
    }

    #[cfg(not(feature = "gpu"))]
    #[test]
    fn test_gpu_jacobi_unavailable_without_feature() {
        let csr = make_3x3_spd();
        match gpu_jacobi_preconditioner(&csr, 1e-15) {
            Err(GpuError::Unavailable(_)) => {}
            other => panic!("Expected Unavailable, got: {:?}", other),
        }
    }
}
