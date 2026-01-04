//! # BeamLab WASM Solver
//!
//! High-performance WebAssembly linear solver for structural analysis.
//! Uses nalgebra for sparse matrix operations and LU decomposition.

use nalgebra::{DMatrix, DVector};
use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

pub mod ai_architect;
pub mod renderer;

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
// TYPES
// ============================================

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

/// Solve a sparse linear system using CG (Conjugate Gradient)
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

    // Convert entries to CSR matrix
    let mut row_indices = Vec::with_capacity(input.entries.len());
    let mut col_indices = Vec::with_capacity(input.entries.len());
    let mut values = Vec::with_capacity(input.entries.len());

    for entry in input.entries {
        row_indices.push(entry.row);
        col_indices.push(entry.col);
        values.push(entry.value);
    }

    let coo = nalgebra_sparse::CooMatrix::try_from_triplets(
        input.size, input.size, row_indices, col_indices, values
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
    let b = DVector::from_vec(input.forces);
    
    // For now, let's use a simple Jacobi-preconditioned CG solver
    // Note: nalgebra-sparse doesn't have a built-in CG, so we implement a basic one
    let mut x = DVector::zeros(input.size);
    let mut r = &b - &csr * &x;
    
    // Jacobi preconditioner
    let mut inv_diag = DVector::zeros(input.size);
    for i in 0..input.size {
        let val = csr.get_entry(i, i).map(|e| e.into_value()).unwrap_or(0.0);
        inv_diag[i] = if val.abs() > 1e-15 { 1.0 / val } else { 1.0 };
    }
    
    let mut z = r.component_mul(&inv_diag);
    let mut p = z.clone();
    let mut rz_old = r.dot(&z);
    
    let b_norm = b.norm();
    let tol = 1e-10 * b_norm.max(1.0);
    let max_iter = input.size * 2;
    let mut success = false;
    let mut error = None;

    for _ in 0..max_iter {
        if r.norm() <= tol {
            success = true;
            break;
        }
        
        let ap = &csr * &p;
        let p_ap = p.dot(&ap);
        
        if p_ap.abs() < 1e-18 {
            error = Some("Division by zero in CG solver (matrix might be indefinite)".to_string());
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

    if !success && error.is_none() {
        error = Some("CG solver failed to converge".to_string());
    }

    let end = web_sys::window()
        .and_then(|w| w.performance())
        .map(|p| p.now())
        .unwrap_or(0.0);

    serde_json::to_string(&SolverOutput {
        displacements: x.data.as_vec().clone(),
        solve_time_ms: end - start,
        success,
        error,
        condition_number: None,
    }).unwrap_or_default()
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
            indices.sort_by(|&a, &b| eigenvalues[a].abs().partial_cmp(&eigenvalues[b].abs()).unwrap());

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
            "LU decomposition".to_string(),
            "Cholesky decomposition".to_string(),
            "Eigenvalue analysis".to_string(),
            "Condition number estimation".to_string(),
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
        Some(c) if c > 1e12 => (false, Some("Matrix is ill-conditioned".to_string())),
        Some(c) if c > 1e8 => (true, Some("Matrix condition is borderline".to_string())),
        Some(_) => (true, None),
        None => (rank == dof, if rank < dof { Some("Matrix is rank-deficient".to_string()) } else { None }),
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
}
