//! # BeamLab WASM Solver - Ultra High Performance Edition
//!
//! High-performance WebAssembly linear solver for structural analysis.
//! Optimized for 100,000+ node civil engineering structures.
//!
//! ## Features:
//! - GPU-accelerated sparse matrix operations (WebGPU)
//! - Algebraic Multigrid (AMG) preconditioner for O(n) complexity
//! - Domain decomposition for massive problems
//! - SIMD-optimized vector operations
//! - Cache-friendly data structures
//!
//! ## Performance Targets:
//! - 100,000 nodes (~600,000 DOF): < 500ms
//! - 50,000 nodes (~300,000 DOF): < 100ms
//! - 10,000 nodes (~60,000 DOF): < 10ms

use nalgebra::{DMatrix, DVector};
use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

// Core modules
pub mod ai_architect;
pub mod renderer;
pub mod pinn;

// Ultra-performance modules
pub mod gpu_solver;
pub mod simd_ops;
pub mod webgpu_shaders;

// Re-export main solver components
pub use gpu_solver::{
    UltraSolver, 
    UltraSolverOutput,
    GpuCsrMatrix,
    AmgPreconditioner,
    PcgSolver,
    DomainDecompositionSolver,
    SolveResult,
    MAX_GPU_DOF,
    solve_ultra_sparse,
    solve_ultra_coo,
};

pub use simd_ops::{
    simd_dot,
    simd_norm,
    simd_axpy,
    blocked_spmv,
    VectorPool,
};

pub use webgpu_shaders::{
    GpuContext,
    GpuSolverConfig,
    SPMV_SHADER,
    DOT_SHADER,
    AXPY_SHADER,
};

// ============================================
// INITIALIZATION
// ============================================

/// Initialize panic hook for better error messages in browser console
#[wasm_bindgen(start)]
pub fn init() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

// ============================================
// SAFE SERIALIZATION HELPERS
// ============================================

/// Safely serialize a result to JsValue, returning an error object instead of panicking.
/// This prevents WASM instance abort if serialization fails (e.g., NaN values).
fn safe_to_js<T: Serialize>(value: &T) -> JsValue {
    match serde_wasm_bindgen::to_value(value) {
        Ok(v) => v,
        Err(e) => {
            // Return a minimal error object that won't fail serialization
            let error_msg = format!("Serialization failed: {}", e);
            let fallback = AnalysisResult {
                displacements: std::collections::HashMap::new(),
                reactions: std::collections::HashMap::new(),
                member_forces: std::collections::HashMap::new(),
                success: false,
                error: Some(error_msg),
            };
            // This inner call should never fail since the error result has no NaN/Inf values
            serde_wasm_bindgen::to_value(&fallback)
                .unwrap_or(JsValue::from_str("serialization error"))
        }
    }
}

/// Safely serialize a BucklingResult to JsValue.
fn safe_buckling_to_js(value: &BucklingResult) -> JsValue {
    match serde_wasm_bindgen::to_value(value) {
        Ok(v) => v,
        Err(e) => {
            let fallback = BucklingResult {
                success: false,
                buckling_factors: vec![],
                critical_loads: vec![],
                error: Some(format!("Serialization failed: {}", e)),
            };
            serde_wasm_bindgen::to_value(&fallback)
                .unwrap_or(JsValue::from_str("serialization error"))
        }
    }
}

// ============================================
// TYPES
// ============================================

/// Buckling analysis result
#[derive(Serialize, Deserialize)]
pub struct BucklingResult {
    pub success: bool,
    pub buckling_factors: Vec<f64>,
    pub critical_loads: Vec<f64>,
    pub error: Option<String>,
}

/// Input structure for the solver
#[derive(Serialize, Deserialize)]
pub struct SolverInput {
    /// Flattened stiffness matrix (row-major, n×n)
    pub stiffness: Vec<f64>,
    /// Force vector (n elements)
    pub forces: Vec<f64>,
    /// Number of degrees of freedom
    pub dof: usize,
}

/// Output structure from the solver
#[derive(Serialize, Deserialize)]
pub struct SolverOutput {
    /// Displacement vector (n elements)
    pub displacements: Vec<f64>,
    /// Solution time in milliseconds
    pub solve_time_ms: f64,
    /// Whether the solution was successful
    pub success: bool,
    /// Error message if failed
    pub error: Option<String>,
    /// Condition number estimate (if available)
    pub condition_number: Option<f64>,
}

/// Sparse matrix entry
#[derive(Serialize, Deserialize)]
pub struct SparseEntry {
    pub row: usize,
    pub col: usize,
    pub value: f64,
}

/// Sparse matrix input
#[derive(Serialize, Deserialize)]
pub struct SparseSolverInput {
    /// Non-zero entries of the stiffness matrix
    pub entries: Vec<SparseEntry>,
    /// Force vector
    pub forces: Vec<f64>,
    /// Matrix size (n×n)
    pub size: usize,
}

// ============================================
// CIVIL ENGINEERING ENGINES
// ============================================

// --- GEOTECHNICAL ENGINE ---

#[derive(Serialize, Deserialize)]
pub struct FootingInput {
    pub width: f64,    // B (m)
    pub length: f64,   // L (m)
    pub depth: f64,    // Df (m)
    pub cohesion: f64, // c (kPa, kN/m²)
    pub phi: f64,      // Friction Angle (degrees)
    pub gamma: f64,    // Unit Weight (kN/m³)
    pub fs: f64,       // Factor of Safety (default 3.0)
}

#[derive(Serialize, Deserialize)]
pub struct BearingCapacityResult {
    pub q_ult: f64,    // Ultimate Capacity (kPa)
    pub q_allow: f64,  // Allowable Capacity (kPa)
    pub nc: f64,
    pub nq: f64,
    pub n_gamma: f64,
}

/// Calculate Bearing Capacity using Terzaghi's/Meyerhof's combined approach
/// Ultra-fast implementation for Monte Carlo simulations
#[wasm_bindgen]
pub fn calculate_bearing_capacity(input_json: &str) -> String {
    let input: FootingInput = match serde_json::from_str(input_json) {
        Ok(i) => i,
        Err(_) => return "{}".to_string(),
    };

    let phi_rad = input.phi.to_radians();
    
    // Meyerhof Factors
    // Nq = e^(pi * tan(phi)) * tan^2(45 + phi/2)
    let nq = (std::f64::consts::PI * phi_rad.tan()).exp() * (45.0f64.to_radians() + phi_rad / 2.0).tan().powi(2);
    
    // Nc = (Nq - 1) * cot(phi)
    let nc = if input.phi > 0.0 {
        (nq - 1.0) * (1.0 / phi_rad.tan())
    } else {
        5.14 // Undrained condition
    };

    // N_gamma = 2 * (Nq + 1) * tan(phi)
    let n_gamma = 2.0 * (nq + 1.0) * phi_rad.tan();

    // Shape Factors (Generic)
    let sc = 1.0 + 0.2 * (input.width / input.length); // Shape factor for cohesion
    let sq = 1.0 + 0.1 * (input.width / input.length) * phi_rad.sin(); // Shape factor for surcharge
    let s_gamma = 1.0 - 0.3 * (input.width / input.length); // Shape factor for weight

    // Ultimate Bearing Capacity (General Equation)
    // q_ult = c*Nc*sc + q*Nq*sq + 0.5*gamma*B*N_gamma*s_gamma
    // q = gamma * Df (Surcharge)
    let q_surcharge = input.gamma * input.depth;
    
    let term1 = input.cohesion * nc * sc;
    let term2 = q_surcharge * nq * sq;
    let term3 = 0.5 * input.gamma * input.width * n_gamma * s_gamma;

    let q_ult = term1 + term2 + term3;
    let q_allow = q_ult / input.fs;

    let result = BearingCapacityResult {
        q_ult,
        q_allow,
        nc,
        nq,
        n_gamma
    };

    serde_json::to_string(&result).unwrap_or_default()
}


// ============================================
// MAIN SOLVER FUNCTIONS
// ============================================

/// Solve a linear system K * u = F using LU decomposition
///
/// # Arguments
/// * `stiffness_array` - Flattened stiffness matrix (row-major)
/// * `force_array` - Force vector
/// * `dof` - Number of degrees of freedom
///
/// # Returns
/// * Displacement vector as Float64Array
#[wasm_bindgen]
pub fn solve_system(
    stiffness_array: &[f64],
    force_array: &[f64],
    dof: usize
) -> Result<js_sys::Float64Array, JsValue> {
    // Validate input
    if stiffness_array.len() != dof * dof {
        return Err(JsValue::from_str(&format!(
            "Stiffness matrix size mismatch: expected {}×{}={}, got {}",
            dof, dof, dof * dof, stiffness_array.len()
        )));
    }

    if force_array.len() != dof {
        return Err(JsValue::from_str(&format!(
            "Force vector size mismatch: expected {}, got {}",
            dof, force_array.len()
        )));
    }

    // Create nalgebra matrix and vector
    let stiffness = DMatrix::from_row_slice(dof, dof, stiffness_array);
    let forces = DVector::from_vec(force_array.to_vec());

    // Perform LU decomposition and solve
    match stiffness.lu().solve(&forces) {
        Some(displacements) => {
            let result = js_sys::Float64Array::new_with_length(dof as u32);
            for (i, &val) in displacements.iter().enumerate() {
                result.set_index(i as u32, val);
            }
            Ok(result)
        }
        None => Err(JsValue::from_str("Matrix is singular - cannot solve system"))
    }
}

/// Solve with full result information (JSON interface)
#[wasm_bindgen]
pub fn solve_system_json(input_json: &str) -> String {
    let start = web_sys::window()
        .and_then(|w| w.performance())
        .map(|p| p.now())
        .unwrap_or(0.0);

    // Parse input
    let input: SolverInput = match serde_json::from_str(input_json) {
        Ok(i) => i,
        Err(e) => return serde_json::to_string(&SolverOutput {
            displacements: vec![],
            solve_time_ms: 0.0,
            success: false,
            error: Some(format!("Failed to parse input: {}", e)),
            condition_number: None,
        }).unwrap_or_default()
    };

    // Validate dimensions
    if input.stiffness.len() != input.dof * input.dof {
        return serde_json::to_string(&SolverOutput {
            displacements: vec![],
            solve_time_ms: 0.0,
            success: false,
            error: Some(format!("Stiffness matrix size mismatch")),
            condition_number: None,
        }).unwrap_or_default();
    }

    // Create matrix and vector
    let stiffness = DMatrix::from_row_slice(input.dof, input.dof, &input.stiffness);
    let forces = DVector::from_vec(input.forces);

    // Solve
    let result = match stiffness.clone().lu().solve(&forces) {
        Some(displacements) => {
            let end = web_sys::window()
                .and_then(|w| w.performance())
                .map(|p| p.now())
                .unwrap_or(0.0);

            // Estimate condition number (using SVD for small matrices)
            let cond = if input.dof <= 100 {
                estimate_condition_number(&stiffness)
            } else {
                None
            };

            SolverOutput {
                displacements: displacements.data.as_vec().clone(),
                solve_time_ms: end - start,
                success: true,
                error: None,
                condition_number: cond,
            }
        }
        None => SolverOutput {
            displacements: vec![],
            solve_time_ms: 0.0,
            success: false,
            error: Some("Matrix is singular - system has no unique solution".to_string()),
            condition_number: None,
        }
    };

    serde_json::to_string(&result).unwrap_or_default()
}

/// Solve a sparse linear system using CG (Conjugate Gradient) with LU fallback
#[wasm_bindgen]
pub fn solve_sparse_system_json(input_json: &str) -> String {
    use nalgebra_sparse::{CsrMatrix};
    use nalgebra::{DVector};

    let start = web_sys::window()
        .and_then(|w| w.performance())
        .map(|p| p.now())
        .unwrap_or(0.0);

    // Parse input
    let input: SparseSolverInput = match serde_json::from_str(input_json) {
        Ok(i) => i,
        Err(e) => return serde_json::to_string(&SolverOutput {
            displacements: vec![],
            solve_time_ms: 0.0,
            success: false,
            error: Some(format!("Failed to parse input: {}", e)),
            condition_number: None,
        }).unwrap_or_default()
    };

    // Size validation - use ultra solver for large problems
    const MAX_LEGACY_DOF: usize = 18000; // Legacy solver limit
    const MAX_DOF: usize = 600000; // ~100,000 nodes at 6 DOF/node
    
    // Redirect large problems to ultra-performance solver
    if input.size > MAX_LEGACY_DOF {
        if input.size > MAX_DOF {
            return serde_json::to_string(&SolverOutput {
                displacements: vec![],
                solve_time_ms: 0.0,
                success: false,
                error: Some(format!(
                    "Model too large: {} DOF exceeds maximum of {}. Consider cloud computing for larger models.",
                    input.size, MAX_DOF
                )),
                condition_number: None,
            }).unwrap_or_default();
        }
        
        // Use ultra solver with AMG for large problems
        let matrix = gpu_solver::GpuCsrMatrix::from_triplets(
            input.size, input.size,
            &input.entries.iter().map(|e| e.row).collect::<Vec<_>>(),
            &input.entries.iter().map(|e| e.col).collect::<Vec<_>>(),
            &input.entries.iter().map(|e| e.value).collect::<Vec<_>>(),
        );
        
        let solver = gpu_solver::UltraSolver::new();
        return solver.solve(
            &matrix.row_ptrs,
            &matrix.col_indices,
            &matrix.values,
            &input.forces,
            input.size,
        );
    }

    // Convert entries to CSR matrix
    let mut row_indices = Vec::with_capacity(input.entries.len());
    let mut col_indices = Vec::with_capacity(input.entries.len());
    let mut values = Vec::with_capacity(input.entries.len());

    for entry in &input.entries {
        row_indices.push(entry.row);
        col_indices.push(entry.col);
        values.push(entry.value);
    }

    let coo = nalgebra_sparse::CooMatrix::try_from_triplets(
        input.size, input.size, row_indices.clone(), col_indices.clone(), values.clone()
    );

    let coo = match coo {
        Ok(c) => c,
        Err(e) => return serde_json::to_string(&SolverOutput {
            displacements: vec![],
            solve_time_ms: 0.0,
            success: false,
            error: Some(format!("Failed to build COO matrix: {}", e)),
            condition_number: None,
        }).unwrap_or_default()
    };

    let csr = CsrMatrix::from(&coo);
    let b = DVector::from_vec(input.forces.clone());
    
    // Try CG solver first (faster for large symmetric positive-definite matrices)
    let mut x = DVector::zeros(input.size);
    let mut r = &b - &csr * &x;
    
    // Jacobi preconditioner
    let mut inv_diag = DVector::zeros(input.size);
    let mut has_zero_diagonal = false;
    for i in 0..input.size {
        let val = csr.get_entry(i, i).map(|e| e.into_value()).unwrap_or(0.0);
        if val.abs() < 1e-15 {
            has_zero_diagonal = true;
            inv_diag[i] = 1.0; // Use 1.0 to avoid div by zero
        } else {
            inv_diag[i] = 1.0 / val;
        }
    }
    
    let mut cg_success = false;
    let mut cg_indefinite = false;
    
    // Only try CG if no zero diagonals (indicates possible singular matrix)
    if !has_zero_diagonal {
        let mut z = r.component_mul(&inv_diag);
        let mut p = z.clone();
        let mut rz_old = r.dot(&z);
        
        let b_norm = b.norm();
        let tol = 1e-10 * b_norm.max(1.0);
        let max_iter = input.size.min(5000); // Cap at 5000 to prevent long stalls

        for _ in 0..max_iter {
            if r.norm() <= tol {
                cg_success = true;
                break;
            }
            
            let ap = &csr * &p;
            let p_ap = p.dot(&ap);
            
            if p_ap.abs() < 1e-18 {
                cg_indefinite = true;
                break;
            }
            
            let alpha = rz_old / p_ap;
            x += alpha * &p;
            r -= alpha * &ap;
            
            z = r.component_mul(&inv_diag);
            let rz_new = r.dot(&z);
            let beta = rz_new / rz_old;
            p = &z + beta * &p;
            rz_old = rz_new;
        }
    } else {
        cg_indefinite = true;
    }
    
    // If CG failed or matrix is indefinite, fallback to LU decomposition
    if !cg_success && (cg_indefinite || has_zero_diagonal) {
        // Convert sparse to dense and solve with LU
        // Only feasible for moderate-sized matrices (< 2000 DOF)
        if input.size <= 3000 {
            let mut dense = DMatrix::zeros(input.size, input.size);
            for entry in &input.entries {
                dense[(entry.row, entry.col)] = entry.value;
            }
            
            let b_dense = DVector::from_vec(input.forces.clone());
            
            match dense.lu().solve(&b_dense) {
                Some(displacements) => {
                    let end = web_sys::window()
                        .and_then(|w| w.performance())
                        .map(|p| p.now())
                        .unwrap_or(0.0);
                    
                    return serde_json::to_string(&SolverOutput {
                        displacements: displacements.data.as_vec().clone(),
                        solve_time_ms: end - start,
                        success: true,
                        error: None,
                        condition_number: None,
                    }).unwrap_or_default();
                }
                None => {
                    let end = web_sys::window()
                        .and_then(|w| w.performance())
                        .map(|p| p.now())
                        .unwrap_or(0.0);
                    
                    return serde_json::to_string(&SolverOutput {
                        displacements: vec![],
                        solve_time_ms: end - start,
                        success: false,
                        error: Some("Structure is unstable. Please check that:\n1. All nodes have proper supports\n2. The structure is not a mechanism\n3. All members are connected".to_string()),
                        condition_number: None,
                    }).unwrap_or_default();
                }
            }
        } else {
            let end = web_sys::window()
                .and_then(|w| w.performance())
                .map(|p| p.now())
                .unwrap_or(0.0);
            
            return serde_json::to_string(&SolverOutput {
                displacements: vec![],
                solve_time_ms: end - start,
                success: false,
                error: Some("Structure may be unstable (matrix is indefinite). For large systems, ensure proper boundary conditions.".to_string()),
                condition_number: None,
            }).unwrap_or_default();
        }
    }

    let end = web_sys::window()
        .and_then(|w| w.performance())
        .map(|p| p.now())
        .unwrap_or(0.0);

    if cg_success {
        serde_json::to_string(&SolverOutput {
            displacements: x.data.as_vec().clone(),
            solve_time_ms: end - start,
            success: true,
            error: None,
            condition_number: None,
        }).unwrap_or_default()
    } else {
        serde_json::to_string(&SolverOutput {
            displacements: vec![],
            solve_time_ms: end - start,
            success: false,
            error: Some("CG solver failed to converge. Try adding more supports or checking member connectivity.".to_string()),
            condition_number: None,
        }).unwrap_or_default()
    }
}

/// Solve a sparse linear system using CG with direct TypedArray input and LU fallback
/// Avoids OOM issues with large JSON strings
#[wasm_bindgen]
pub fn solve_sparse_system(
    row_indices: &[usize],  // Uint32Array passed as generic array
    col_indices: &[usize],
    values: &[f64],
    forces: &[f64],
    size: usize
) -> Result<js_sys::Float64Array, JsValue> {
    use nalgebra_sparse::{CsrMatrix};
    use nalgebra::{DVector};

    if row_indices.len() != values.len() || col_indices.len() != values.len() {
        return Err(JsValue::from_str("Input arrays length mismatch"));
    }

    // Size validation - use ultra solver for large problems
    const MAX_LEGACY_DOF: usize = 18000; // Legacy solver limit
    const MAX_DOF: usize = 600000; // ~100,000 nodes at 6 DOF/node
    
    // Redirect large problems to ultra-performance solver
    if size > MAX_LEGACY_DOF {
        if size > MAX_DOF {
            return Err(JsValue::from_str(&format!(
                "Model too large: {} DOF exceeds maximum of {}. Consider cloud computing for larger models.",
                size, MAX_DOF
            )));
        }
        
        // Use ultra solver with AMG for large problems
        let result_json = gpu_solver::solve_ultra_coo(row_indices, col_indices, values, forces, size);
        let result: gpu_solver::UltraSolverOutput = serde_json::from_str(&result_json)
            .map_err(|e| JsValue::from_str(&format!("Parse error: {}", e)))?;
        
        if result.success {
            let arr = js_sys::Float64Array::new_with_length(size as u32);
            for (i, &val) in result.displacements.iter().enumerate() {
                arr.set_index(i as u32, val);
            }
            return Ok(arr);
        } else {
            return Err(JsValue::from_str(&result.error.unwrap_or("Unknown error".to_string())));
        }
    }

    // Convert to CSR directly
    let rows = row_indices.to_vec();
    let cols = col_indices.to_vec();
    let vals = values.to_vec();
    
    let coo = match nalgebra_sparse::CooMatrix::try_from_triplets(
        size, size, rows.clone(), cols.clone(), vals.clone()
    ) {
        Ok(c) => c,
        Err(e) => return Err(JsValue::from_str(&format!("Failed to construct COO matrix: {}", e))),
    };

    let csr = CsrMatrix::from(&coo);
    let b = DVector::from_column_slice(forces);
    
    // CG Solver with LU fallback
    let mut x = DVector::zeros(size);
    let mut r = &b - &csr * &x;
    
    // Jacobi preconditioner - check for zero diagonals
    let mut inv_diag = DVector::zeros(size);
    let mut has_zero_diagonal = false;
    for i in 0..size {
        let val = csr.get_entry(i, i).map(|e| e.into_value()).unwrap_or(0.0);
        if val.abs() < 1e-15 {
            has_zero_diagonal = true;
            inv_diag[i] = 1.0;
        } else {
            inv_diag[i] = 1.0 / val;
        }
    }
    
    let mut cg_success = false;
    let mut cg_indefinite = false;
    
    // Only try CG if no zero diagonals
    if !has_zero_diagonal {
        let mut z = r.component_mul(&inv_diag);
        let mut p = z.clone();
        let mut rz_old = r.dot(&z);
        
        let b_norm = b.norm();
        let tol = 1e-8 * b_norm.max(1.0); 
        let max_iter = size.min(5000); // Cap at 5000 to prevent long stalls
        
        for _ in 0..max_iter {
            if r.norm() <= tol {
                cg_success = true;
                break;
            }
            
            let ap = &csr * &p;
            let p_ap = p.dot(&ap);
            
            if p_ap.abs() < 1e-20 {
                cg_indefinite = true;
                break;
            }
            
            let alpha = rz_old / p_ap;
            x += alpha * &p;
            r -= alpha * &ap;
            
            z = r.component_mul(&inv_diag);
            let rz_new = r.dot(&z);
            let beta = rz_new / rz_old;
            p = &z + beta * &p;
            rz_old = rz_new;
        }
    } else {
        cg_indefinite = true;
    }
    
    // If CG failed, try LU fallback for smaller systems
    if !cg_success && (cg_indefinite || has_zero_diagonal) {
        if size <= 3000 {
            // Convert sparse to dense for LU
            let mut dense = DMatrix::zeros(size, size);
            for i in 0..row_indices.len() {
                dense[(row_indices[i], col_indices[i])] = values[i];
            }
            
            let b_dense = DVector::from_column_slice(forces);
            
            match dense.lu().solve(&b_dense) {
                Some(displacements) => {
                    let result = js_sys::Float64Array::new_with_length(size as u32);
                    for (i, &val) in displacements.iter().enumerate() {
                        result.set_index(i as u32, val);
                    }
                    return Ok(result);
                }
                None => {
                    return Err(JsValue::from_str("Structure is unstable. Please check that all nodes have proper supports and the structure is not a mechanism."));
                }
            }
        } else {
            return Err(JsValue::from_str("Structure may be unstable (matrix is indefinite). Ensure proper boundary conditions are applied."));
        }
    }
    
    // Return CG result
    let result = js_sys::Float64Array::new_with_length(size as u32);
    for (i, &val) in x.iter().enumerate() {
        result.set_index(i as u32, val);
    }
    
    Ok(result)
}

/// Solve using Cholesky decomposition (faster for symmetric positive-definite matrices)
#[wasm_bindgen]
pub fn solve_system_cholesky(
    stiffness_array: &[f64],
    force_array: &[f64],
    dof: usize
) -> Result<js_sys::Float64Array, JsValue> {
    if stiffness_array.len() != dof * dof {
        return Err(JsValue::from_str("Stiffness matrix size mismatch"));
    }

    let stiffness = DMatrix::from_row_slice(dof, dof, stiffness_array);
    let forces = DVector::from_vec(force_array.to_vec());

    // Try Cholesky decomposition (assumes symmetric positive-definite)
    match stiffness.clone().cholesky() {
        Some(chol) => {
            let displacements = chol.solve(&forces);
            let result = js_sys::Float64Array::new_with_length(dof as u32);
            for (i, &val) in displacements.iter().enumerate() {
                result.set_index(i as u32, val);
            }
            Ok(result)
        }
        None => {
            // Fallback to LU if Cholesky fails
            match stiffness.lu().solve(&forces) {
                Some(displacements) => {
                    let result = js_sys::Float64Array::new_with_length(dof as u32);
                    for (i, &val) in displacements.iter().enumerate() {
                        result.set_index(i as u32, val);
                    }
                    Ok(result)
                }
                None => Err(JsValue::from_str("Matrix is singular"))
            }
        }
    }
}

// ============================================
// EIGENVALUE SOLVER (for Modal Analysis)
// ============================================

/// Compute eigenvalues and eigenvectors for modal analysis
/// Returns JSON with eigenvalues (natural frequencies) and mode shapes
#[wasm_bindgen]
pub fn compute_eigenvalues(
    stiffness_array: &[f64],
    mass_array: &[f64],
    dof: usize,
    num_modes: usize
) -> String {
    #[derive(Serialize)]
    struct EigenResult {
        eigenvalues: Vec<f64>,
        frequencies: Vec<f64>,  // Natural frequencies in Hz
        eigenvectors: Vec<Vec<f64>>,
        success: bool,
        error: Option<String>,
    }

    // Create matrices
    let k = DMatrix::from_row_slice(dof, dof, stiffness_array);
    let m = DMatrix::from_row_slice(dof, dof, mass_array);

    // For generalized eigenvalue problem K*φ = ω²*M*φ
    // We solve M^(-1)*K*φ = ω²*φ

    match m.clone().lu().try_inverse() {
        Some(m_inv) => {
            let a = m_inv * k;
            
            // Compute eigendecomposition
            let eigen = a.symmetric_eigen();
            
            // Extract eigenvalues and vectors
            let eigenvalues: Vec<f64> = eigen.eigenvalues.iter().cloned().collect();
            let eigenvectors_matrix = eigen.eigenvectors;

            // Sort by eigenvalue magnitude (ascending)
            let mut indices: Vec<usize> = (0..eigenvalues.len()).collect();
            indices.sort_by(|&a, &b| eigenvalues[a].abs().partial_cmp(&eigenvalues[b].abs()).unwrap_or(std::cmp::Ordering::Equal));

            let sorted_eigenvalues: Vec<f64> = indices.iter()
                .take(num_modes.min(dof))
                .map(|&i| eigenvalues[i])
                .collect();

            let frequencies: Vec<f64> = sorted_eigenvalues.iter()
                .map(|&val| if val > 0.0 { (val.sqrt()) / (2.0 * std::f64::consts::PI) } else { 0.0 })
                .collect();

            let eigenvectors: Vec<Vec<f64>> = indices.iter()
                .take(num_modes.min(dof))
                .map(|&i| eigenvectors_matrix.column(i).iter().cloned().collect())
                .collect();

            serde_json::to_string(&EigenResult {
                eigenvalues: sorted_eigenvalues,
                frequencies,
                eigenvectors,
                success: true,
                error: None,
            }).unwrap_or_default()
        }
        None => {
            serde_json::to_string(&EigenResult {
                eigenvalues: vec![],
                frequencies: vec![],
                eigenvectors: vec![],
                success: false,
                error: Some("Mass matrix is singular".to_string()),
            }).unwrap_or_default()
        }
    }
}

// ============================================
// STRUCTURAL ANALYSIS FUNCTIONS
// ============================================

/// Node for structural analysis
#[derive(Serialize, Deserialize)]
pub struct Node {
    pub id: i32,
    pub x: f64,
    pub y: f64,
    pub fixed: [bool; 3], // [dx, dy, rotation]
}

/// Member releases (internal hinges)
#[derive(Serialize, Deserialize, Clone)]
pub struct MemberReleases {
    pub start_moment: bool, // Release moment at start
    pub end_moment: bool,   // Release moment at end
    pub start_axial: bool,  // Release axial at start
    pub end_axial: bool,    // Release axial at end
}

/// Element (beam/member) for structural analysis
#[derive(Serialize, Deserialize)]
pub struct Element {
    pub id: i32,
    pub node_start: i32,
    pub node_end: i32,
    pub e: f64, // Young's modulus (Pa)
    pub i: f64, // Moment of inertia (m^4)
    pub a: f64, // Cross-sectional area (m^2)
    pub g: Option<f64>, // Shear modulus (Pa) for 3D
    pub j: Option<f64>, // Torsional constant (m^4) for 3D
    pub alpha: Option<f64>, // Thermal expansion coefficient
    pub releases: Option<MemberReleases>, // Member releases
}

/// Point load applied at a node
#[derive(Serialize, Deserialize, Clone)]
pub struct PointLoad {
    pub node_id: i32,
    pub fx: f64, // Force in X direction (N)
    pub fy: f64, // Force in Y direction (N)
    pub mz: f64, // Moment about Z axis (N·m)
}

/// Load distribution type
#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum LoadDistribution {
    Uniform,      // Constant intensity
    Triangular,   // Linear from w1 to 0 or 0 to w2
    Trapezoidal,  // Linear from w1 to w2
}

/// Distributed load on a member
#[derive(Serialize, Deserialize, Clone)]
pub struct MemberLoad {
    pub element_id: i32,
    pub w1: f64,  // Load intensity at start (N/m)
    pub w2: f64,  // Load intensity at end (N/m)
    pub direction: String, // "local_y", "local_x", "global_y", etc.
    pub start_pos: f64, // Start position (0-1 ratio)
    pub end_pos: f64,   // End position (0-1 ratio)
    pub is_projected: bool, // Project load perpendicular to slope
}

/// Temperature load on a member
#[derive(Serialize, Deserialize, Clone)]
pub struct TemperatureLoad {
    pub element_id: i32,
    pub delta_t: f64,      // Uniform temperature change (°C)
    pub gradient_t: f64,   // Temperature gradient through depth (°C)
    pub alpha: f64,        // Thermal expansion coefficient (1/°C)
    pub section_depth: f64, // Section depth for gradient (m)
}

/// Member forces (internal forces in an element)
#[derive(Serialize, Deserialize, Clone)]
pub struct MemberForces {
    pub axial: f64,        // Axial force (tension positive)
    pub shear_start: f64,  // Shear at start
    pub moment_start: f64, // Moment at start
    pub shear_end: f64,    // Shear at end
    pub moment_end: f64,   // Moment at end
}

/// Analysis result
#[derive(Serialize, Deserialize)]
pub struct AnalysisResult {
    pub displacements: std::collections::HashMap<i32, [f64; 3]>,
    pub reactions: std::collections::HashMap<i32, [f64; 3]>,
    pub member_forces: std::collections::HashMap<i32, MemberForces>,
    pub success: bool,
    pub error: Option<String>,
}

/// Compute local fixed-end force components (v_start, v_end, m_start, m_end)
/// for member distributed loads over a (possibly partial) span.
fn member_load_end_forces(load: &MemberLoad, element_length: f64) -> Option<(f64, f64, f64, f64)> {
    let mut start_pos = load.start_pos.clamp(0.0, 1.0);
    let mut end_pos = load.end_pos.clamp(0.0, 1.0);
    if start_pos > end_pos {
        std::mem::swap(&mut start_pos, &mut end_pos);
    }

    let a = start_pos * element_length;
    let b = end_pos * element_length;
    let load_length = b - a;
    if load_length <= 1e-12 || element_length <= 1e-12 {
        return None;
    }

    // Numerical integration of consistent nodal load vector over partial span.
    // Hermite beam functions for transverse load q(x):
    // [V_i, M_i, V_j, M_j] = ∫ [N1, N2, N3, N4] q(x) dx.
    // Sign convention compatibility:
    // - Existing engine expects moments as (-M_i, -M_j) relative to direct Hermite integral,
    //   so we negate moment integrals below to preserve legacy/output convention.
    let gauss_points = [
        (-0.906_179_845_938_664, 0.236_926_885_056_189),
        (-0.538_469_310_105_683, 0.478_628_670_499_366),
        (0.0, 0.568_888_888_888_889),
        (0.538_469_310_105_683, 0.478_628_670_499_366),
        (0.906_179_845_938_664, 0.236_926_885_056_189),
    ];

    let mut v_start = 0.0;
    let mut v_end = 0.0;
    let mut m_start = 0.0;
    let mut m_end = 0.0;

    for (xi_gp, wt) in gauss_points {
        let x = 0.5 * (b - a) * xi_gp + 0.5 * (a + b);
        let xi = x / element_length;
        let eta = (x - a) / load_length;
        let w_x = load.w1 + (load.w2 - load.w1) * eta;

        let n1 = 1.0 - 3.0 * xi * xi + 2.0 * xi * xi * xi;
        let n2 = element_length * (xi - 2.0 * xi * xi + xi * xi * xi);
        let n3 = 3.0 * xi * xi - 2.0 * xi * xi * xi;
        let n4 = element_length * (-xi * xi + xi * xi * xi);

        let jac = 0.5 * (b - a);
        let d_int = wt * jac;

        v_start += w_x * n1 * d_int;
        m_start += -w_x * n2 * d_int;
        v_end += w_x * n3 * d_int;
        m_end += -w_x * n4 * d_int;
    }

    Some((v_start, v_end, m_start, m_end))
}

/// Compute equivalent nodal force vectors in global and local coordinates:
/// order is [Fx_start, Fy_start, Mz_start, Fx_end, Fy_end, Mz_end].
fn member_load_equivalent_vectors(load: &MemberLoad, element_length: f64, c: f64, s: f64) -> Option<([f64; 6], [f64; 6])> {
    let direction = load.direction.to_lowercase();
    let is_local_y = direction.contains("local") && direction.contains("y");
    let is_global_direction = direction.contains("global");

    // If load is marked as projected, convert to equivalent load per member length.
    // For 2D frame members in XY plane: projected-on-plan scaling uses |cos(theta)| = |c|.
    let projection_scale = if load.is_projected && is_global_direction {
        c.abs()
    } else {
        1.0
    };

    let adjusted_load = MemberLoad {
        element_id: load.element_id,
        w1: load.w1 * projection_scale,
        w2: load.w2 * projection_scale,
        direction: load.direction.clone(),
        start_pos: load.start_pos,
        end_pos: load.end_pos,
        is_projected: load.is_projected,
    };

    let (v_start, v_end, m_start, m_end) = member_load_end_forces(&adjusted_load, element_length)?;

    let f_global = if is_local_y {
        // Convert local-Y equivalent forces to global
        [
            -v_start * s,
            v_start * c,
            m_start,
            -v_end * s,
            v_end * c,
            m_end,
        ]
    } else {
        // Treat non-local inputs as global-Y style (legacy behavior)
        [
            0.0,
            v_start,
            m_start,
            0.0,
            v_end,
            m_end,
        ]
    };

    // Transform forces global -> local for force recovery consistency
    let f_local = [
        c * f_global[0] + s * f_global[1],
        -s * f_global[0] + c * f_global[1],
        f_global[2],
        c * f_global[3] + s * f_global[4],
        -s * f_global[3] + c * f_global[4],
        f_global[5],
    ];

    Some((f_global, f_local))
}

fn solve_structure_core(
    nodes: &[Node],
    elements: &[Element],
    point_loads: &[PointLoad],
    member_loads: &[MemberLoad],
) -> AnalysisResult {
    // Number of DOF (3 per node: x, y, rotation)
    let num_nodes = nodes.len();
    let dof = num_nodes * 3;

    // Build global stiffness matrix
    let mut k_global = DMatrix::zeros(dof, dof);
    let mut f_global = DVector::zeros(dof);

    // Pre-build node ID -> index map for O(1) lookup and safe error handling
    let node_idx_map: std::collections::HashMap<i32, usize> = nodes.iter()
        .enumerate()
        .map(|(i, n)| (n.id, i))
        .collect();

    // Helper closure: safe node index lookup
    let make_error_result = |msg: String| -> AnalysisResult {
        AnalysisResult {
            displacements: std::collections::HashMap::new(),
            reactions: std::collections::HashMap::new(),
            member_forces: std::collections::HashMap::new(),
            success: false,
            error: Some(msg),
        }
    };

    // Assemble stiffness matrix for each element
    for elem in elements {
        // Find start and end nodes
        let start_node = nodes.iter().find(|n| n.id == elem.node_start);
        let end_node = nodes.iter().find(|n| n.id == elem.node_end);

        if start_node.is_none() || end_node.is_none() {
            return make_error_result(format!("Element {} references invalid nodes", elem.id));
        }

        let start = start_node.unwrap();
        let end = end_node.unwrap();

        // Calculate element length and orientation
        let dx = end.x - start.x;
        let dy = end.y - start.y;
        let l = (dx * dx + dy * dy).sqrt();

        if l < 1e-10 {
            return make_error_result(format!("Element {} has zero length", elem.id));
        }

        let c = dx / l;
        let s = dy / l;

        // Local stiffness matrix (6x6 for 2D frame element)
        let ea_l = elem.e * elem.a / l;
        let ei_l3 = elem.e * elem.i / (l * l * l);
        let ei_l2 = elem.e * elem.i / (l * l);
        let ei_l = elem.e * elem.i / l;

        // Build local stiffness matrix
        let mut k_local = DMatrix::zeros(6, 6);
        
        // Axial stiffness
        k_local[(0, 0)] = ea_l;
        k_local[(0, 3)] = -ea_l;
        k_local[(3, 0)] = -ea_l;
        k_local[(3, 3)] = ea_l;

        // Bending stiffness
        k_local[(1, 1)] = 12.0 * ei_l3;
        k_local[(1, 2)] = 6.0 * ei_l2;
        k_local[(1, 4)] = -12.0 * ei_l3;
        k_local[(1, 5)] = 6.0 * ei_l2;

        k_local[(2, 1)] = 6.0 * ei_l2;
        k_local[(2, 2)] = 4.0 * ei_l;
        k_local[(2, 4)] = -6.0 * ei_l2;
        k_local[(2, 5)] = 2.0 * ei_l;

        k_local[(4, 1)] = -12.0 * ei_l3;
        k_local[(4, 2)] = -6.0 * ei_l2;
        k_local[(4, 4)] = 12.0 * ei_l3;
        k_local[(4, 5)] = -6.0 * ei_l2;

        k_local[(5, 1)] = 6.0 * ei_l2;
        k_local[(5, 2)] = 2.0 * ei_l;
        k_local[(5, 4)] = -6.0 * ei_l2;
        k_local[(5, 5)] = 4.0 * ei_l;

        // Transformation matrix
        let mut t = DMatrix::zeros(6, 6);
        t[(0, 0)] = c; t[(0, 1)] = s;
        t[(1, 0)] = -s; t[(1, 1)] = c;
        t[(2, 2)] = 1.0;
        t[(3, 3)] = c; t[(3, 4)] = s;
        t[(4, 3)] = -s; t[(4, 4)] = c;
        t[(5, 5)] = 1.0;

        // Transform to global coordinates: K = T^T * k_local * T
        let k_global_elem = t.transpose() * k_local * t;

        // Get DOF indices for this element (safe lookup)
        let start_idx = match node_idx_map.get(&elem.node_start) {
            Some(&idx) => idx,
            None => return make_error_result(format!("Element {} references non-existent start node {}", elem.id, elem.node_start)),
        };
        let end_idx = match node_idx_map.get(&elem.node_end) {
            Some(&idx) => idx,
            None => return make_error_result(format!("Element {} references non-existent end node {}", elem.id, elem.node_end)),
        };

        let dof_map = [
            start_idx * 3,     // start x
            start_idx * 3 + 1, // start y
            start_idx * 3 + 2, // start rotation
            end_idx * 3,       // end x
            end_idx * 3 + 1,   // end y
            end_idx * 3 + 2,   // end rotation
        ];

        // Add to global stiffness matrix
        for i in 0..6 {
            for j in 0..6 {
                k_global[(dof_map[i], dof_map[j])] += k_global_elem[(i, j)];
            }
        }
    }

    // ============================================
    // APPLY LOADS
    // ============================================

    // 1. Apply point loads
    for load in point_loads {
        // Find node index
        if let Some(node_idx) = nodes.iter().position(|n| n.id == load.node_id) {
            f_global[node_idx * 3 + 0] += load.fx;
            f_global[node_idx * 3 + 1] += load.fy;
            f_global[node_idx * 3 + 2] += load.mz;
        }
    }

    // 2. Apply member distributed loads (convert to equivalent nodal loads)
    for load in member_loads {
        if let Some(elem) = elements.iter().find(|e| e.id == load.element_id) {
            let start_idx = match node_idx_map.get(&elem.node_start) {
                Some(&idx) => idx,
                None => continue, // skip invalid element references
            };
            let end_idx = match node_idx_map.get(&elem.node_end) {
                Some(&idx) => idx,
                None => continue,
            };
            let start = &nodes[start_idx];
            let end = &nodes[end_idx];

            // Element geometry
            let dx = end.x - start.x;
            let dy = end.y - start.y;
            let l = (dx * dx + dy * dy).sqrt();
            let c = dx / l;
            let s = dy / l;

            if let Some((fef_global, _fef_local)) = member_load_equivalent_vectors(load, l, c, s) {
                f_global[start_idx * 3 + 0] += fef_global[0];
                f_global[start_idx * 3 + 1] += fef_global[1];
                f_global[start_idx * 3 + 2] += fef_global[2];
                f_global[end_idx * 3 + 0] += fef_global[3];
                f_global[end_idx * 3 + 1] += fef_global[4];
                f_global[end_idx * 3 + 2] += fef_global[5];
            }
        }
    }

    // ============================================
    // APPLY BOUNDARY CONDITIONS
    // ============================================

    // Apply boundary conditions (fixed DOFs)
    let mut free_dofs = Vec::new();
    let mut fixed_dofs = Vec::new();

    for (node_idx, node) in nodes.iter().enumerate() {
        for dof_offset in 0..3 {
            let global_dof = node_idx * 3 + dof_offset;
            if node.fixed[dof_offset] {
                fixed_dofs.push(global_dof);
            } else {
                free_dofs.push(global_dof);
            }
        }
    }

    // Reduce stiffness matrix to free DOFs only
    let n_free = free_dofs.len();
    
    // Edge case: if all DOFs are fixed, we can't solve (no unknowns)
    // But we can still calculate reactions from the applied loads
    let u_reduced = if n_free == 0 {
        // No free DOFs - all displacements are zero
        DVector::zeros(0)
    } else {
        let mut k_reduced = DMatrix::zeros(n_free, n_free);
        let mut f_reduced = DVector::zeros(n_free);

        for (i, &dof_i) in free_dofs.iter().enumerate() {
            for (j, &dof_j) in free_dofs.iter().enumerate() {
                k_reduced[(i, j)] = k_global[(dof_i, dof_j)];
            }
            f_reduced[i] = f_global[dof_i];
        }

        // Solve for displacements
        match k_reduced.lu().solve(&f_reduced) {
            Some(u) => u,
            None => {
                return make_error_result("Singular stiffness matrix - structure is unstable".to_string());
            }
        }
    };

    // Build full displacement vector
    let mut displacements = std::collections::HashMap::new();
    let mut u_full = vec![0.0; dof];

    for (i, &dof_idx) in free_dofs.iter().enumerate() {
        u_full[dof_idx] = u_reduced[i];
    }

    // Organize displacements by node
    for (node_idx, node) in nodes.iter().enumerate() {
        displacements.insert(
            node.id,
            [
                u_full[node_idx * 3],
                u_full[node_idx * 3 + 1],
                u_full[node_idx * 3 + 2],
            ],
        );
    }

    // ============================================
    // CALCULATE REACTIONS
    // ============================================
    
    let mut reactions = std::collections::HashMap::new();
    
    // Convert to DVector for matrix multiplication
    let u_full_vec = DVector::from_vec(u_full.clone());
    
    // Calculate forces at all DOF: F_reaction = K*u - F_applied
    let f_reaction = &k_global * &u_full_vec - &f_global;
    
    // Extract reactions at fixed nodes
    for (node_idx, node) in nodes.iter().enumerate() {
        let mut has_reaction = false;
        let mut rx = 0.0;
        let mut ry = 0.0;
        let mut rm = 0.0;
        
        for dof_offset in 0..3 {
            if node.fixed[dof_offset] {
                has_reaction = true;
                match dof_offset {
                    0 => rx = f_reaction[node_idx * 3 + 0],
                    1 => ry = f_reaction[node_idx * 3 + 1],
                    2 => rm = f_reaction[node_idx * 3 + 2],
                    _ => {}
                }
            }
        }
        
        if has_reaction {
            reactions.insert(node.id, [rx, ry, rm]);
        }
    }

    // ============================================
    // CALCULATE MEMBER FORCES
    // ============================================
    
    let mut member_forces = std::collections::HashMap::new();
    
    for elem in elements {
        let start_idx = match node_idx_map.get(&elem.node_start) {
            Some(&idx) => idx,
            None => continue, // skip elements with invalid node references
        };
        let end_idx = match node_idx_map.get(&elem.node_end) {
            Some(&idx) => idx,
            None => continue,
        };
        let start = &nodes[start_idx];
        let end = &nodes[end_idx];
        
        // Element geometry
        let dx = end.x - start.x;
        let dy = end.y - start.y;
        let l = (dx * dx + dy * dy).sqrt();
        if l < 1e-10 { continue; } // skip zero-length elements
        let c = dx / l;
        let s = dy / l;
        let ea_l = elem.e * elem.a / l;
        let ei_l3 = elem.e * elem.i / (l * l * l);
        let ei_l2 = elem.e * elem.i / (l * l);
        let ei_l = elem.e * elem.i / l;
        
        let mut k_local = DMatrix::zeros(6, 6);
        
        // Axial
        k_local[(0, 0)] = ea_l;
        k_local[(0, 3)] = -ea_l;
        k_local[(3, 0)] = -ea_l;
        k_local[(3, 3)] = ea_l;
        
        // Bending
        k_local[(1, 1)] = 12.0 * ei_l3;
        k_local[(1, 2)] = 6.0 * ei_l2;
        k_local[(1, 4)] = -12.0 * ei_l3;
        k_local[(1, 5)] = 6.0 * ei_l2;
        k_local[(2, 1)] = 6.0 * ei_l2;
        k_local[(2, 2)] = 4.0 * ei_l;
        k_local[(2, 4)] = -6.0 * ei_l2;
        k_local[(2, 5)] = 2.0 * ei_l;
        k_local[(4, 1)] = -12.0 * ei_l3;
        k_local[(4, 2)] = -6.0 * ei_l2;
        k_local[(4, 4)] = 12.0 * ei_l3;
        k_local[(4, 5)] = -6.0 * ei_l2;
        k_local[(5, 1)] = 6.0 * ei_l2;
        k_local[(5, 2)] = 2.0 * ei_l;
        k_local[(5, 4)] = -6.0 * ei_l2;
        k_local[(5, 5)] = 4.0 * ei_l;
        
        // Transformation matrix T (6x6)
        let mut t_matrix = DMatrix::zeros(6, 6);
        t_matrix[(0, 0)] = c; t_matrix[(0, 1)] = s;
        t_matrix[(1, 0)] = -s; t_matrix[(1, 1)] = c;
        t_matrix[(2, 2)] = 1.0;
        t_matrix[(3, 3)] = c; t_matrix[(3, 4)] = s;
        t_matrix[(4, 3)] = -s; t_matrix[(4, 4)] = c;
        t_matrix[(5, 5)] = 1.0;
        
        // Get element displacements in global coordinates
        let u_elem_global = DVector::from_vec(vec![
            u_full[start_idx * 3 + 0],
            u_full[start_idx * 3 + 1],
            u_full[start_idx * 3 + 2],
            u_full[end_idx * 3 + 0],
            u_full[end_idx * 3 + 1],
            u_full[end_idx * 3 + 2],
        ]);
        
        // Transform to local coordinates: u_local = T * u_global
        let u_elem_local = &t_matrix * &u_elem_global;
        
        // Calculate local forces: f = k * u
        let f_elem_local = &k_local * &u_elem_local;
        
        // Subtract Fixed-End Forces (FEF) from calculated forces for loaded members
        // {f_corrected} = {f_elastic} - {FEF_local}
        let mut f_elem_local_corrected = f_elem_local.clone();

        // Iterate over member loads and subtract FEF for matching element
        for load in member_loads {
            if load.element_id != elem.id {
                continue;
            }

            if let Some((_fef_global, fef_local)) = member_load_equivalent_vectors(load, l, c, s) {
                for i in 0..6 {
                    f_elem_local_corrected[i] -= fef_local[i];
                }
            }
        }

        // Extract corrected forces (sign convention: tension positive, compression negative)
        let forces_corrected = MemberForces {
            axial: f_elem_local_corrected[0],           // Axial force
            shear_start: f_elem_local_corrected[1],     // Shear at start
            moment_start: f_elem_local_corrected[2],    // Moment at start
            shear_end: -f_elem_local_corrected[4],      // Shear at end (flip sign for convention)
            moment_end: -f_elem_local_corrected[5],     // Moment at end (flip sign for convention)
        };
        
        member_forces.insert(elem.id, forces_corrected);
    }

    AnalysisResult {
        displacements,
        reactions,
        member_forces,
        success: true,
        error: None,
    }
}

/// Solve a frame structure using Direct Stiffness Method
/// Takes nodes, elements, and loads, returns displacements, reactions, and member forces
#[wasm_bindgen]
pub fn solve_structure_wasm(
    nodes_json: JsValue,
    elements_json: JsValue,
    point_loads_json: JsValue,
    member_loads_json: JsValue
) -> JsValue {
    // Parse input
    let nodes: Vec<Node> = match serde_wasm_bindgen::from_value(nodes_json) {
        Ok(n) => n,
        Err(e) => {
            let result = AnalysisResult {
                displacements: std::collections::HashMap::new(),
                reactions: std::collections::HashMap::new(),
                member_forces: std::collections::HashMap::new(),
                success: false,
                error: Some(format!("Failed to parse nodes: {}", e)),
            };
            return serde_wasm_bindgen::to_value(&result).unwrap();
        }
    };

    let elements: Vec<Element> = match serde_wasm_bindgen::from_value(elements_json) {
        Ok(e) => e,
        Err(e) => {
            let result = AnalysisResult {
                displacements: std::collections::HashMap::new(),
                reactions: std::collections::HashMap::new(),
                member_forces: std::collections::HashMap::new(),
                success: false,
                error: Some(format!("Failed to parse elements: {}", e)),
            };
            return serde_wasm_bindgen::to_value(&result).unwrap();
        }
    };

    let point_loads: Vec<PointLoad> = serde_wasm_bindgen::from_value(point_loads_json).unwrap_or_default();
    let member_loads: Vec<MemberLoad> = serde_wasm_bindgen::from_value(member_loads_json).unwrap_or_default();

    let result = solve_structure_core(&nodes, &elements, &point_loads, &member_loads);
    serde_wasm_bindgen::to_value(&result).unwrap()
}

// ============================================
// ADVANCED ANALYSIS FUNCTIONS
// ============================================

/// Calculate geometric stiffness matrix for an element (for P-Delta and buckling)
/// Based on axial force P in the member
fn calculate_geometric_stiffness(
    l: f64,      // Element length
    p: f64,      // Axial force (positive = tension, negative = compression)
    c: f64,      // cos(angle)
    s: f64,      // sin(angle)
) -> DMatrix<f64> {
    // Geometric stiffness matrix in local coordinates (6x6)
    // For beam-column element under axial load
    let mut kg_local = DMatrix::zeros(6, 6);
    
    // Geometric stiffness due to axial force
    // This matrix represents the effect of axial force on transverse stiffness
    let coeff = p / l;
    
    // Transverse geometric stiffness (symmetric)
    kg_local[(1, 1)] = 6.0/5.0 * coeff;
    kg_local[(1, 2)] = coeff * l / 10.0;
    kg_local[(1, 4)] = -6.0/5.0 * coeff;
    kg_local[(1, 5)] = coeff * l / 10.0;
    
    kg_local[(2, 1)] = coeff * l / 10.0;
    kg_local[(2, 2)] = 2.0 * coeff * l * l / 15.0;
    kg_local[(2, 4)] = -coeff * l / 10.0;
    kg_local[(2, 5)] = -coeff * l * l / 30.0;
    
    kg_local[(4, 1)] = -6.0/5.0 * coeff;
    kg_local[(4, 2)] = -coeff * l / 10.0;
    kg_local[(4, 4)] = 6.0/5.0 * coeff;
    kg_local[(4, 5)] = -coeff * l / 10.0;
    
    kg_local[(5, 1)] = coeff * l / 10.0;
    kg_local[(5, 2)] = -coeff * l * l / 30.0;
    kg_local[(5, 4)] = -coeff * l / 10.0;
    kg_local[(5, 5)] = 2.0 * coeff * l * l / 15.0;
    
    // Transform to global coordinates
    let mut t_matrix = DMatrix::zeros(6, 6);
    t_matrix[(0, 0)] = c; t_matrix[(0, 1)] = s;
    t_matrix[(1, 0)] = -s; t_matrix[(1, 1)] = c;
    t_matrix[(2, 2)] = 1.0;
    t_matrix[(3, 3)] = c; t_matrix[(3, 4)] = s;
    t_matrix[(4, 3)] = -s; t_matrix[(4, 4)] = c;
    t_matrix[(5, 5)] = 1.0;
    
    &t_matrix.transpose() * &kg_local * &t_matrix
}

/// P-Delta analysis with second-order effects
/// Iterative solution considering geometric nonlinearity
#[wasm_bindgen]
pub fn solve_p_delta(
    nodes_json: JsValue,
    elements_json: JsValue,
    point_loads_json: JsValue,
    member_loads_json: JsValue,
    max_iterations: Option<usize>,
    tolerance: Option<f64>,
) -> JsValue {
    let max_iter = max_iterations.unwrap_or(20);
    let tol = tolerance.unwrap_or(1e-4);
    
    // Parse inputs (same as solve_structure_wasm)
    let nodes: Vec<Node> = serde_wasm_bindgen::from_value(nodes_json).unwrap_or_default();
    let elements: Vec<Element> = serde_wasm_bindgen::from_value(elements_json).unwrap_or_default();
    let point_loads: Vec<PointLoad> = serde_wasm_bindgen::from_value(point_loads_json).unwrap_or_default();
    let _member_loads: Vec<MemberLoad> = serde_wasm_bindgen::from_value(member_loads_json).unwrap_or_default();
    
    let num_nodes = nodes.len();
    let dof = num_nodes * 3;
    
    // Pre-build node ID -> index map for safe O(1) lookup
    let node_idx_map: std::collections::HashMap<i32, usize> = nodes.iter()
        .enumerate()
        .map(|(i, n)| (n.id, i))
        .collect();
    
    // Initial analysis (first-order)
    let mut u_prev = DVector::zeros(dof);
    let mut converged = false;
    
    for iteration in 0..max_iter {
        // Build stiffness matrix including geometric stiffness
        let mut k_total = DMatrix::zeros(dof, dof);
        
        // Assemble elastic stiffness (same as before)
        for elem in &elements {
            let start_idx = match node_idx_map.get(&elem.node_start) {
                Some(&idx) => idx,
                None => continue,
            };
            let end_idx = match node_idx_map.get(&elem.node_end) {
                Some(&idx) => idx,
                None => continue,
            };
            let start = &nodes[start_idx];
            let end = &nodes[end_idx];
            
            let dx = end.x - start.x;
            let dy = end.y - start.y;
            let l = (dx * dx + dy * dy).sqrt();
            if l < 1e-10 { continue; } // skip zero-length elements
            let c = dx / l;
            let s = dy / l;
            
            // Elastic stiffness
            let ea_l = elem.e * elem.a / l;
            let ei_l3 = elem.e * elem.i / (l * l * l);
            let ei_l2 = elem.e * elem.i / (l * l);
            let ei_l = elem.e * elem.i / l;
            
            let mut k_local = DMatrix::zeros(6, 6);
            k_local[(0, 0)] = ea_l;
            k_local[(0, 3)] = -ea_l;
            k_local[(3, 0)] = -ea_l;
            k_local[(3, 3)] = ea_l;
            
            k_local[(1, 1)] = 12.0 * ei_l3;
            k_local[(1, 2)] = 6.0 * ei_l2;
            k_local[(1, 4)] = -12.0 * ei_l3;
            k_local[(1, 5)] = 6.0 * ei_l2;
            k_local[(2, 1)] = 6.0 * ei_l2;
            k_local[(2, 2)] = 4.0 * ei_l;
            k_local[(2, 4)] = -6.0 * ei_l2;
            k_local[(2, 5)] = 2.0 * ei_l;
            k_local[(4, 1)] = -12.0 * ei_l3;
            k_local[(4, 2)] = -6.0 * ei_l2;
            k_local[(4, 4)] = 12.0 * ei_l3;
            k_local[(4, 5)] = -6.0 * ei_l2;
            k_local[(5, 1)] = 6.0 * ei_l2;
            k_local[(5, 2)] = 2.0 * ei_l;
            k_local[(5, 4)] = -6.0 * ei_l2;
            k_local[(5, 5)] = 4.0 * ei_l;
            
            // Transform elastic stiffness
            let mut t_matrix = DMatrix::zeros(6, 6);
            t_matrix[(0, 0)] = c; t_matrix[(0, 1)] = s;
            t_matrix[(1, 0)] = -s; t_matrix[(1, 1)] = c;
            t_matrix[(2, 2)] = 1.0;
            t_matrix[(3, 3)] = c; t_matrix[(3, 4)] = s;
            t_matrix[(4, 3)] = -s; t_matrix[(4, 4)] = c;
            t_matrix[(5, 5)] = 1.0;
            
            let k_elem_global = &t_matrix.transpose() * &k_local * &t_matrix;
            
            // Calculate axial force from previous iteration
            let u_elem = vec![
                if iteration == 0 { 0.0 } else { u_prev[start_idx * 3] },
                if iteration == 0 { 0.0 } else { u_prev[start_idx * 3 + 1] },
                if iteration == 0 { 0.0 } else { u_prev[start_idx * 3 + 2] },
                if iteration == 0 { 0.0 } else { u_prev[end_idx * 3] },
                if iteration == 0 { 0.0 } else { u_prev[end_idx * 3 + 1] },
                if iteration == 0 { 0.0 } else { u_prev[end_idx * 3 + 2] },
            ];
            let u_elem_vec = DVector::from_vec(u_elem);
            let u_local = &t_matrix * &u_elem_vec;
            let f_local = &k_local * &u_local;
            let axial_force = f_local[0]; // Axial force from previous iteration
            
            // Geometric stiffness
            let kg_elem_global = calculate_geometric_stiffness(l, axial_force, c, s);
            
            // Total element stiffness = elastic + geometric
            let k_total_elem = k_elem_global + kg_elem_global;
            
            // Assemble into global
            let dof_map = [
                start_idx * 3, start_idx * 3 + 1, start_idx * 3 + 2,
                end_idx * 3, end_idx * 3 + 1, end_idx * 3 + 2,
            ];
            
            for i in 0..6 {
                for j in 0..6 {
                    k_total[(dof_map[i], dof_map[j])] += k_total_elem[(i, j)];
                }
            }
        }
        
        // Apply loads (same as before - simplified for brevity)
        let mut f_global = DVector::zeros(dof);
        for load in &point_loads {
            if let Some(node_idx) = nodes.iter().position(|n| n.id == load.node_id) {
                f_global[node_idx * 3] += load.fx;
                f_global[node_idx * 3 + 1] += load.fy;
                f_global[node_idx * 3 + 2] += load.mz;
            }
        }
        
        // Apply boundary conditions and solve
        let mut free_dofs = Vec::new();
        for (node_idx, node) in nodes.iter().enumerate() {
            for dof_offset in 0..3 {
                if !node.fixed[dof_offset] {
                    free_dofs.push(node_idx * 3 + dof_offset);
                }
            }
        }
        
        let n_free = free_dofs.len();
        let mut k_reduced = DMatrix::zeros(n_free, n_free);
        let mut f_reduced = DVector::zeros(n_free);
        
        for (i, &dof_i) in free_dofs.iter().enumerate() {
            for (j, &dof_j) in free_dofs.iter().enumerate() {
                k_reduced[(i, j)] = k_total[(dof_i, dof_j)];
            }
            f_reduced[i] = f_global[dof_i];
        }
        
        // Solve
        let u_reduced = match k_reduced.lu().solve(&f_reduced) {
            Some(u) => u,
            None => break,
        };
        
        // Build full displacement vector
        let mut u_full = vec![0.0; dof];
        for (i, &dof_idx) in free_dofs.iter().enumerate() {
            u_full[dof_idx] = u_reduced[i];
        }
        let u_current = DVector::from_vec(u_full.clone());
        
        // Check convergence
        if iteration > 0 {
            let diff = &u_current - &u_prev;
            let norm = diff.norm() / u_current.norm().max(1e-10);
            if norm < tol {
                converged = true;
                break;
            }
        }
        
        u_prev = u_current;
    }
    
    // Return final result
    let mut displacements = std::collections::HashMap::new();
    for (node_idx, node) in nodes.iter().enumerate() {
        displacements.insert(
            node.id,
            [u_prev[node_idx * 3], u_prev[node_idx * 3 + 1], u_prev[node_idx * 3 + 2]],
        );
    }
    
    let result = AnalysisResult {
        displacements,
        reactions: std::collections::HashMap::new(),
        member_forces: std::collections::HashMap::new(),
        success: converged,
        error: if converged { None } else { Some("P-Delta analysis did not converge".to_string()) },
    };
    
    serde_wasm_bindgen::to_value(&result).unwrap()
}

/// Buckling analysis - eigenvalue problem to find critical loads
/// Solves: [K_e - λ*K_g]{φ} = 0
#[wasm_bindgen]
pub fn analyze_buckling(
    nodes_json: JsValue,
    elements_json: JsValue,
    point_loads_json: JsValue,
    num_modes: usize,
) -> JsValue {
    // Parse inputs
    let nodes: Vec<Node> = match serde_wasm_bindgen::from_value(nodes_json) {
        Ok(n) => n,
        Err(_) => {
            return serde_wasm_bindgen::to_value(&BucklingResult {
                success: false,
                buckling_factors: vec![],
                critical_loads: vec![],
                error: Some("Failed to parse nodes".to_string()),
            }).unwrap();
        }
    };
    
    let elements: Vec<Element> = match serde_wasm_bindgen::from_value(elements_json) {
        Ok(e) => e,
        Err(_) => {
            return serde_wasm_bindgen::to_value(&BucklingResult {
                success: false,
                buckling_factors: vec![],
                critical_loads: vec![],
                error: Some("Failed to parse elements".to_string()),
            }).unwrap();
        }
    };
    
    let point_loads: Vec<PointLoad> = serde_wasm_bindgen::from_value(point_loads_json).unwrap_or_default();
    
    let num_nodes = nodes.len();
    let dof = num_nodes * 3;
    
    // Build elastic stiffness matrix
    let mut k_elastic: DMatrix<f64> = DMatrix::zeros(dof, dof);
    
    // Build geometric stiffness with unit loads (will be scaled by eigenvalue)
    let mut k_geometric: DMatrix<f64> = DMatrix::zeros(dof, dof);
    
    // Pre-build node ID -> index map for safe O(1) lookup
    let node_idx_map: std::collections::HashMap<i32, usize> = nodes.iter()
        .enumerate()
        .map(|(i, n)| (n.id, i))
        .collect();
    
    for elem in &elements {
        let start_idx = match node_idx_map.get(&elem.node_start) {
            Some(&idx) => idx,
            None => continue,
        };
        let end_idx = match node_idx_map.get(&elem.node_end) {
            Some(&idx) => idx,
            None => continue,
        };
        let start = &nodes[start_idx];
        let end = &nodes[end_idx];
        
        let dx = end.x - start.x;
        let dy = end.y - start.y;
        let l = (dx * dx + dy * dy).sqrt();
        if l < 1e-10 { continue; } // skip zero-length elements
        let c = dx / l;
        let s = dy / l;
        
        // Elastic stiffness (same as before)
        let ea_l = elem.e * elem.a / l;
        let ei_l3 = elem.e * elem.i / (l * l * l);
        let ei_l2 = elem.e * elem.i / (l * l);
        let ei_l = elem.e * elem.i / l;
        
        let mut k_local = DMatrix::zeros(6, 6);
        k_local[(0, 0)] = ea_l;
        k_local[(0, 3)] = -ea_l;
        k_local[(3, 0)] = -ea_l;
        k_local[(3, 3)] = ea_l;
        k_local[(1, 1)] = 12.0 * ei_l3;
        k_local[(1, 2)] = 6.0 * ei_l2;
        k_local[(1, 4)] = -12.0 * ei_l3;
        k_local[(1, 5)] = 6.0 * ei_l2;
        k_local[(2, 1)] = 6.0 * ei_l2;
        k_local[(2, 2)] = 4.0 * ei_l;
        k_local[(2, 4)] = -6.0 * ei_l2;
        k_local[(2, 5)] = 2.0 * ei_l;
        k_local[(4, 1)] = -12.0 * ei_l3;
        k_local[(4, 2)] = -6.0 * ei_l2;
        k_local[(4, 4)] = 12.0 * ei_l3;
        k_local[(4, 5)] = -6.0 * ei_l2;
        k_local[(5, 1)] = 6.0 * ei_l2;
        k_local[(5, 2)] = 2.0 * ei_l;
        k_local[(5, 4)] = -6.0 * ei_l2;
        k_local[(5, 5)] = 4.0 * ei_l;
        
        // Transformation matrix
        let mut t_matrix = DMatrix::zeros(6, 6);
        t_matrix[(0, 0)] = c; t_matrix[(0, 1)] = s;
        t_matrix[(1, 0)] = -s; t_matrix[(1, 1)] = c;
        t_matrix[(2, 2)] = 1.0;
        t_matrix[(3, 3)] = c; t_matrix[(3, 4)] = s;
        t_matrix[(4, 3)] = -s; t_matrix[(4, 4)] = c;
        t_matrix[(5, 5)] = 1.0;
        
        let k_elem_global = &t_matrix.transpose() * &k_local * &t_matrix;
        
        // Geometric stiffness with unit axial force (P = -1 for compression)
        let kg_elem_global = calculate_geometric_stiffness(l, -1.0, c, s);
        
        // Assemble
        let dof_map = [
            start_idx * 3, start_idx * 3 + 1, start_idx * 3 + 2,
            end_idx * 3, end_idx * 3 + 1, end_idx * 3 + 2,
        ];
        
        for i in 0..6 {
            for j in 0..6 {
                k_elastic[(dof_map[i], dof_map[j])] += k_elem_global[(i, j)];
                k_geometric[(dof_map[i], dof_map[j])] += kg_elem_global[(i, j)];
            }
        }
    }
    
    // Apply boundary conditions
    let mut free_dofs = Vec::new();
    for (node_idx, node) in nodes.iter().enumerate() {
        for dof_offset in 0..3 {
            if !node.fixed[dof_offset] {
                free_dofs.push(node_idx * 3 + dof_offset);
            }
        }
    }
    
    let n_free = free_dofs.len();
    let mut ke_reduced = DMatrix::zeros(n_free, n_free);
    let mut kg_reduced = DMatrix::zeros(n_free, n_free);
    
    for (i, &dof_i) in free_dofs.iter().enumerate() {
        for (j, &dof_j) in free_dofs.iter().enumerate() {
            ke_reduced[(i, j)] = k_elastic[(dof_i, dof_j)];
            kg_reduced[(i, j)] = k_geometric[(dof_i, dof_j)];
        }
    }
    
    // Solve generalized eigenvalue problem: K_e * φ = λ * K_g * φ
    // Use inverse iteration or QR algorithm
    // For now, use simplified approach: solve K_e^(-1) * K_g
    
    let ke_inv = match ke_reduced.clone().lu().try_inverse() {
        Some(inv) => inv,
        None => {
            return serde_wasm_bindgen::to_value(&BucklingResult {
                success: false,
                buckling_factors: vec![],
                critical_loads: vec![],
                error: Some("Elastic stiffness matrix is singular".to_string()),
            }).unwrap();
        }
    };
    
    let a_matrix: DMatrix<f64> = ke_inv * kg_reduced;
    
    // Compute eigenvalues (this is simplified - full implementation needs proper eigenvalue solver)
    let eigenvalues = a_matrix.symmetric_eigenvalues();
    
    // Buckling load factors are reciprocals of eigenvalues
    let mut buckling_factors: Vec<f64> = eigenvalues.iter()
        .filter(|&&e| e > 1e-10)
        .map(|&e| 1.0 / e)
        .collect();
    buckling_factors.sort_by(|a: &f64, b: &f64| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    
    // Take first num_modes
    buckling_factors.truncate(num_modes);
    
    let result = BucklingResult {
        success: true,
        buckling_factors: buckling_factors.clone(),
        critical_loads: buckling_factors, // Same for unit load
        error: None,
    };
    
    serde_wasm_bindgen::to_value(&result).unwrap()
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/// Estimate condition number using SVD
fn estimate_condition_number(matrix: &DMatrix<f64>) -> Option<f64> {
    let svd = matrix.clone().svd(false, false);
    let singular_values = svd.singular_values;
    
    if singular_values.len() == 0 {
        return None;
    }

    let max_sv = singular_values.iter().cloned().fold(f64::MIN, f64::max);
    let min_sv = singular_values.iter().cloned().fold(f64::MAX, f64::min);

    if min_sv > 0.0 {
        Some(max_sv / min_sv)
    } else {
        Some(f64::INFINITY)
    }
}

/// Get solver version and capabilities
#[wasm_bindgen]
pub fn get_solver_info() -> String {
    #[derive(Serialize)]
    struct SolverInfo {
        version: String,
        capabilities: Vec<String>,
        max_recommended_dof: usize,
    }

    serde_json::to_string(&SolverInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        capabilities: vec![
            String::from("LU decomposition"),
            String::from("Cholesky decomposition"),
            String::from("Eigenvalue analysis"),
            String::from("Condition number estimation"),
        ],
        max_recommended_dof: 100000,
    }).unwrap_or_default()
}

/// Check if matrix is well-conditioned
#[wasm_bindgen]
pub fn check_matrix_condition(stiffness_array: &[f64], dof: usize) -> String {
    #[derive(Serialize)]
    struct ConditionResult {
        is_well_conditioned: bool,
        condition_number: Option<f64>,
        determinant: f64,
        rank: usize,
        warning: Option<String>,
    }

    let matrix = DMatrix::from_row_slice(dof, dof, stiffness_array);
    let det = matrix.determinant();
    let rank = matrix.rank(1e-10);
    let cond = if dof <= 200 { estimate_condition_number(&matrix) } else { None };

    let (is_well_conditioned, warning) = match cond {
        Some(c) if c > 1e12 => (false, Some(String::from("Matrix is ill-conditioned"))),
        Some(c) if c > 1e8 => (true, Some(String::from("Matrix condition is borderline"))),
        Some(_) => (true, None),
        None => (rank == dof, if rank < dof { Some(String::from("Matrix is rank-deficient")) } else { None }),
    };

    serde_json::to_string(&ConditionResult {
        is_well_conditioned,
        condition_number: cond,
        determinant: det,
        rank,
        warning,
    }).unwrap_or_default()
}

// ============================================
// TESTS
// ============================================

#[cfg(test)]
mod tests {
    use super::*;

    fn solve_case(
        nodes: Vec<Node>,
        elements: Vec<Element>,
        point_loads: Vec<PointLoad>,
        member_loads: Vec<MemberLoad>,
    ) -> AnalysisResult {
        solve_structure_core(&nodes, &elements, &point_loads, &member_loads)
    }

    #[test]
    fn test_simple_system() {
        // Simple 2x2 system: [2, 1; 1, 3] * u = [1, 2]
        let k = vec![2.0, 1.0, 1.0, 3.0];
        let f = vec![1.0, 2.0];
        
        let stiffness = DMatrix::from_row_slice(2, 2, &k);
        let forces = DVector::from_vec(f);
        
        let result = stiffness.lu().solve(&forces).unwrap();
        
        // Verify solution: u ≈ [0.2, 0.6]
        assert!((result[0] - 0.2_f64).abs() < 1e-10);
        assert!((result[1] - 0.6_f64).abs() < 1e-10);
    }

    #[test]
    fn test_symmetric_system() {
        // Symmetric positive-definite matrix
        let k = vec![4.0, 2.0, 2.0, 5.0];
        let f = vec![6.0, 7.0];
        
        let stiffness = DMatrix::from_row_slice(2, 2, &k);
        let forces = DVector::from_vec(f);
        
        let chol = stiffness.cholesky().unwrap();
        let result = chol.solve(&forces);
        
        // Verify solution exists
        assert!(result.len() == 2);
    }

    #[test]
    fn test_member_load_equivalent_vectors_local_y_horizontal() {
        let load = MemberLoad {
            element_id: 1,
            w1: -10.0,
            w2: -10.0,
            direction: "local_y".to_string(),
            start_pos: 0.0,
            end_pos: 1.0,
            is_projected: false,
        };

        let l = 5.0;
        let (f_global, f_local) = member_load_equivalent_vectors(&load, l, 1.0, 0.0)
            .expect("FEF should be computable for full-span load");

        // For horizontal member, local and global are aligned for y-direction loading
        assert!((f_global[1] - f_local[1]).abs() < 1e-12);
        assert!((f_global[4] - f_local[4]).abs() < 1e-12);

        // UDL equivalent end shears should be wL/2
        let expected_v = load.w1 * l / 2.0;
        assert!((f_local[1] - expected_v).abs() < 1e-10);
        assert!((f_local[4] - expected_v).abs() < 1e-10);
    }

    #[test]
    fn test_member_load_equivalent_vectors_global_y_inclined_produces_local_axial_component() {
        let load = MemberLoad {
            element_id: 1,
            w1: -10.0,
            w2: -10.0,
            direction: "global_y".to_string(),
            start_pos: 0.0,
            end_pos: 1.0,
            is_projected: false,
        };

        // 45-degree member
        let c = std::f64::consts::FRAC_1_SQRT_2;
        let s = std::f64::consts::FRAC_1_SQRT_2;
        let (_f_global, f_local) = member_load_equivalent_vectors(&load, 5.0, c, s)
            .expect("FEF should be computable for full-span load");

        // Global vertical load on an inclined member creates local axial + transverse components
        assert!(f_local[0].abs() > 0.0, "Expected nonzero local axial force component");
        assert!(f_local[1].abs() > 0.0, "Expected nonzero local transverse force component");
    }

    #[test]
    fn test_simply_supported_beam_udl_reactions_and_end_moments() {
        // Simply-supported beam: pin at left, roller at right, UDL on full span
        let l_m = 6.0;
        let w_npm = -10_000.0; // 10 kN/m downward

        let nodes = vec![
            Node {
                id: 1,
                x: 0.0,
                y: 0.0,
                fixed: [true, true, false],
            },
            Node {
                id: 2,
                x: l_m,
                y: 0.0,
                fixed: [false, true, false],
            },
        ];

        let elements = vec![Element {
            id: 1,
            node_start: 1,
            node_end: 2,
            e: 200e9,
            i: 8.0e-5,
            a: 0.01,
            g: None,
            j: None,
            alpha: None,
            releases: None,
        }];

        let member_loads = vec![MemberLoad {
            element_id: 1,
            w1: w_npm,
            w2: w_npm,
            direction: "global_y".to_string(),
            start_pos: 0.0,
            end_pos: 1.0,
            is_projected: false,
        }];

        let result = solve_case(nodes, elements, vec![], member_loads);
        assert!(result.success, "Solver failed: {:?}", result.error);

        let r1 = result.reactions.get(&1).expect("left support reactions");
        let r2 = result.reactions.get(&2).expect("right support reactions");

        let total_vertical_reaction = r1[1] + r2[1];
        let total_applied_vertical = w_npm * l_m;
        assert!(
            (total_vertical_reaction + total_applied_vertical).abs() < 1e-4,
            "Vertical equilibrium failed: Rsum={} N, Load={} N",
            total_vertical_reaction,
            total_applied_vertical
        );

        let expected_reaction = -total_applied_vertical / 2.0;
        assert!(
            (r1[1] - expected_reaction).abs() < 1e-4,
            "Left reaction mismatch: got {}, expected {}",
            r1[1],
            expected_reaction
        );
        assert!(
            (r2[1] - expected_reaction).abs() < 1e-4,
            "Right reaction mismatch: got {}, expected {}",
            r2[1],
            expected_reaction
        );

        // End moments for a simply supported beam under UDL should be ~0
        let mf = result.member_forces.get(&1).expect("member forces");
        assert!(
            mf.moment_start.abs() < 1e-3,
            "Start end-moment should be ~0 for simply-supported beam, got {}",
            mf.moment_start
        );
        assert!(
            mf.moment_end.abs() < 1e-3,
            "End end-moment should be ~0 for simply-supported beam, got {}",
            mf.moment_end
        );
    }

    #[test]
    fn test_cantilever_beam_udl_fixed_end_actions() {
        // Cantilever beam: fixed at left, free at right, UDL on full span
        let l_m = 4.0;
        let w_npm = -12_000.0; // 12 kN/m downward

        let nodes = vec![
            Node {
                id: 1,
                x: 0.0,
                y: 0.0,
                fixed: [true, true, true],
            },
            Node {
                id: 2,
                x: l_m,
                y: 0.0,
                fixed: [false, false, false],
            },
        ];

        let elements = vec![Element {
            id: 1,
            node_start: 1,
            node_end: 2,
            e: 200e9,
            i: 8.0e-5,
            a: 0.01,
            g: None,
            j: None,
            alpha: None,
            releases: None,
        }];

        let member_loads = vec![MemberLoad {
            element_id: 1,
            w1: w_npm,
            w2: w_npm,
            direction: "global_y".to_string(),
            start_pos: 0.0,
            end_pos: 1.0,
            is_projected: false,
        }];

        let result = solve_case(nodes, elements, vec![], member_loads);
        assert!(result.success, "Solver failed: {:?}", result.error);

        let r_fixed = result.reactions.get(&1).expect("fixed support reactions");

        let total_applied_vertical = w_npm * l_m;
        let expected_shear_reaction = -total_applied_vertical;
        assert!(
            (r_fixed[1] - expected_shear_reaction).abs() < 1e-4,
            "Cantilever vertical reaction mismatch: got {}, expected {}",
            r_fixed[1],
            expected_shear_reaction
        );

        let expected_fixed_moment = -w_npm * l_m * l_m / 2.0;
        assert!(
            (r_fixed[2].abs() - expected_fixed_moment.abs()).abs() < 1e-3,
            "Cantilever fixed-end moment magnitude mismatch: got {}, expected magnitude {}",
            r_fixed[2],
            expected_fixed_moment
        );

        let mf = result.member_forces.get(&1).expect("member forces");
        assert!(
            (mf.moment_start.abs() - expected_fixed_moment.abs()).abs() < 1e-3,
            "Member start moment magnitude mismatch: got {}, expected magnitude {}",
            mf.moment_start,
            expected_fixed_moment
        );
        assert!(
            mf.moment_end.abs() < 1e-3,
            "Free end moment should be ~0 for cantilever, got {}",
            mf.moment_end
        );
    }

    #[test]
    fn test_partial_udl_position_changes_end_shear_split() {
        // Validate position sensitivity for partial UDL conversion:
        // total load is conserved, but start/end nodal shear split changes with load location.
        let span_m = 10.0;
        let w_npm = -8_000.0;
        let left_half = MemberLoad {
            element_id: 1,
            w1: w_npm,
            w2: w_npm,
            direction: "global_y".to_string(),
            start_pos: 0.0,
            end_pos: 0.5,
            is_projected: false,
        };

        let right_half = MemberLoad {
            start_pos: 0.5,
            end_pos: 1.0,
            ..left_half.clone()
        };

        let (f_left, _) = member_load_equivalent_vectors(&left_half, span_m, 1.0, 0.0)
            .expect("left-half load vector");
        let (f_right, _) = member_load_equivalent_vectors(&right_half, span_m, 1.0, 0.0)
            .expect("right-half load vector");

        let loaded_len = 0.5 * span_m;
        let total_load = w_npm * loaded_len;

        let total_left = f_left[1] + f_left[4];
        let total_right = f_right[1] + f_right[4];

        assert!(
            (total_left - total_load).abs() < 1e-6,
            "Left-half resultant mismatch: got {}, expected {}",
            total_left,
            total_load
        );
        assert!(
            (total_right - total_load).abs() < 1e-6,
            "Right-half resultant mismatch: got {}, expected {}",
            total_right,
            total_load
        );

        assert!(
            f_left[1].abs() > f_left[4].abs(),
            "Left-half load should bias start-node shear: start={}, end={}",
            f_left[1],
            f_left[4]
        );
        assert!(
            f_right[4].abs() > f_right[1].abs(),
            "Right-half load should bias end-node shear: start={}, end={}",
            f_right[1],
            f_right[4]
        );
    }

    #[test]
    fn test_projected_global_y_load_scales_with_member_projection() {
        let base_load = MemberLoad {
            element_id: 1,
            w1: -10.0,
            w2: -10.0,
            direction: "global_y".to_string(),
            start_pos: 0.0,
            end_pos: 1.0,
            is_projected: false,
        };

        let projected_load = MemberLoad {
            is_projected: true,
            ..base_load.clone()
        };

        // 60-degree member from global X axis -> c = 0.5
        let c = 0.5;
        let s = (1.0_f64 - c * c).sqrt();
        let l = 6.0;

        let (f_global_non_projected, _) =
            member_load_equivalent_vectors(&base_load, l, c, s).expect("non-projected vector");
        let (f_global_projected, _) =
            member_load_equivalent_vectors(&projected_load, l, c, s).expect("projected vector");

        let total_vertical_non_projected = f_global_non_projected[1] + f_global_non_projected[4];
        let total_vertical_projected = f_global_projected[1] + f_global_projected[4];

        assert!(
            (total_vertical_projected - c.abs() * total_vertical_non_projected).abs() < 1e-10,
            "Projected load should scale by |cos(theta)|: got {}, expected {}",
            total_vertical_projected,
            c.abs() * total_vertical_non_projected
        );
    }
}
