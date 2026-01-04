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

/// Element (beam/member) for structural analysis
#[derive(Serialize, Deserialize)]
pub struct Element {
    pub id: i32,
    pub node_start: i32,
    pub node_end: i32,
    pub e: f64, // Young's modulus (Pa)
    pub i: f64, // Moment of inertia (m^4)
    pub a: f64, // Cross-sectional area (m^2)
}

/// Point load applied at a node
#[derive(Serialize, Deserialize, Clone)]
pub struct PointLoad {
    pub node_id: i32,
    pub fx: f64, // Force in X direction (N)
    pub fy: f64, // Force in Y direction (N)
    pub mz: f64, // Moment about Z axis (N·m)
}

/// Distributed load on a member
#[derive(Serialize, Deserialize, Clone)]
pub struct MemberLoad {
    pub element_id: i32,
    pub wx: f64,  // Distributed load along member axis (N/m)
    pub wy: f64,  // Distributed load perpendicular to member (N/m)
    pub start_pos: f64, // Start position (0-1 ratio)
    pub end_pos: f64,   // End position (0-1 ratio)
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

    // Number of DOF (3 per node: x, y, rotation)
    let num_nodes = nodes.len();
    let dof = num_nodes * 3;

    // Build global stiffness matrix
    let mut k_global = DMatrix::zeros(dof, dof);
    let mut f_global = DVector::zeros(dof);

    // Assemble stiffness matrix for each element
    for elem in &elements {
        // Find start and end nodes
        let start_node = nodes.iter().find(|n| n.id == elem.node_start);
        let end_node = nodes.iter().find(|n| n.id == elem.node_end);

        if start_node.is_none() || end_node.is_none() {
            let result = AnalysisResult {
                displacements: std::collections::HashMap::new(),
                reactions: std::collections::HashMap::new(),
                member_forces: std::collections::HashMap::new(),
                success: false,
                error: Some(format!("Element {} references invalid nodes", elem.id)),
            };
            return serde_wasm_bindgen::to_value(&result).unwrap();
        }

        let start = start_node.unwrap();
        let end = end_node.unwrap();

        // Calculate element length and orientation
        let dx = end.x - start.x;
        let dy = end.y - start.y;
        let l = (dx * dx + dy * dy).sqrt();

        if l < 1e-10 {
            let result = AnalysisResult {
                displacements: std::collections::HashMap::new(),
                reactions: std::collections::HashMap::new(),
                member_forces: std::collections::HashMap::new(),
                success: false,
                error: Some(format!("Element {} has zero length", elem.id)),
            };
            return serde_wasm_bindgen::to_value(&result).unwrap();
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

        // Get DOF indices for this element
        let start_idx = nodes.iter().position(|n| n.id == elem.node_start).unwrap();
        let end_idx = nodes.iter().position(|n| n.id == elem.node_end).unwrap();

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
    for load in &point_loads {
        // Find node index
        if let Some(node_idx) = nodes.iter().position(|n| n.id == load.node_id) {
            f_global[node_idx * 3 + 0] += load.fx;
            f_global[node_idx * 3 + 1] += load.fy;
            f_global[node_idx * 3 + 2] += load.mz;
        }
    }

    // 2. Apply member distributed loads (convert to equivalent nodal loads)
    for load in &member_loads {
        if let Some(elem) = elements.iter().find(|e| e.id == load.element_id) {
            let start_idx = nodes.iter().position(|n| n.id == elem.node_start).unwrap();
            let end_idx = nodes.iter().position(|n| n.id == elem.node_end).unwrap();
            let start = &nodes[start_idx];
            let end = &nodes[end_idx];

            // Element geometry
            let dx = end.x - start.x;
            let dy = end.y - start.y;
            let l = (dx * dx + dy * dy).sqrt();
            let c = dx / l;
            let s = dy / l;

            // Effective length for partial loads
            let start_pos = load.start_pos.max(0.0).min(1.0);
            let end_pos = load.end_pos.max(0.0).min(1.0);
            let load_length = (end_pos - start_pos) * l;

            // For uniformly distributed load (UDL) perpendicular to member
            // Fixed-end forces in local coordinates:
            // V_start = wL/2, M_start = -wL²/12
            // V_end = wL/2, M_end = wL²/12
            
            let w_perp = load.wy;
            let w_axial = load.wx;

            if w_perp.abs() > 1e-10 {
                // Equivalent nodal loads in local coordinates
                let v_start = w_perp * load_length / 2.0;
                let v_end = w_perp * load_length / 2.0;
                let m_start = -w_perp * load_length * load_length / 12.0;
                let m_end = w_perp * load_length * load_length / 12.0;

                // Transform to global coordinates
                // Local: [u, v, theta] -> Global: [x, y, theta]
                // Fy_global = -v*sin(angle) for vertical load
                // Fx_global = -v*cos(angle) for vertical load (perpendicular)
                
                let fx_start = -v_start * s;
                let fy_start = v_start * c;
                let fx_end = -v_end * s;
                let fy_end = v_end * c;

                // Add to force vector
                f_global[start_idx * 3 + 0] += fx_start;
                f_global[start_idx * 3 + 1] += fy_start;
                f_global[start_idx * 3 + 2] += m_start;
                f_global[end_idx * 3 + 0] += fx_end;
                f_global[end_idx * 3 + 1] += fy_end;
                f_global[end_idx * 3 + 2] += m_end;
            }

            if w_axial.abs() > 1e-10 {
                // Axial distributed load
                let axial_start = w_axial * load_length / 2.0;
                let axial_end = w_axial * load_length / 2.0;

                f_global[start_idx * 3 + 0] += axial_start * c;
                f_global[start_idx * 3 + 1] += axial_start * s;
                f_global[end_idx * 3 + 0] += axial_end * c;
                f_global[end_idx * 3 + 1] += axial_end * s;
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
    let mut k_reduced = DMatrix::zeros(n_free, n_free);
    let mut f_reduced = DVector::zeros(n_free);

    for (i, &dof_i) in free_dofs.iter().enumerate() {
        for (j, &dof_j) in free_dofs.iter().enumerate() {
            k_reduced[(i, j)] = k_global[(dof_i, dof_j)];
        }
        f_reduced[i] = f_global[dof_i];
    }

    // Solve for displacements
    let u_reduced = match k_reduced.lu().solve(&f_reduced) {
        Some(u) => u,
        None => {
            let result = AnalysisResult {
                displacements: std::collections::HashMap::new(),
                reactions: std::collections::HashMap::new(),
                member_forces: std::collections::HashMap::new(),
                success: false,
                error: Some("Singular stiffness matrix - structure is unstable".to_string()),
            };
            return serde_wasm_bindgen::to_value(&result).unwrap();
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
    
    for elem in &elements {
        let start_idx = nodes.iter().position(|n| n.id == elem.node_start).unwrap();
        let end_idx = nodes.iter().position(|n| n.id == elem.node_end).unwrap();
        let start = &nodes[start_idx];
        let end = &nodes[end_idx];
        
        // Element geometry
        let dx = end.x - start.x;
        let dy = end.y - start.y;
        let l = (dx * dx + dy * dy).sqrt();
        let c = dx / l;
        let s = dy / l;
        
        // Build stiffness and transformation matrices (same as assembly)
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
        
        // Extract forces (sign convention: tension positive, compression negative)
        let forces = MemberForces {
            axial: f_elem_local[0],           // Axial force
            shear_start: f_elem_local[1],     // Shear at start
            moment_start: f_elem_local[2],    // Moment at start
            shear_end: -f_elem_local[4],      // Shear at end (flip sign for convention)
            moment_end: -f_elem_local[5],     // Moment at end (flip sign for convention)
        };
        
        member_forces.insert(elem.id, forces);
    }

    let result = AnalysisResult {
        displacements,
        reactions,
        member_forces,
        success: true,
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
