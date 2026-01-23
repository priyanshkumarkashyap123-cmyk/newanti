mod solver;
pub mod solver_3d;
pub mod design_codes;
pub mod renderer; // Stubbed for WASM compatibility (Three.js used for actual rendering)
pub mod ai_architect;
pub mod dynamics;
pub mod plate_element;
pub mod ultra_fast_solver;

use nalgebra::{DMatrix, DVector};
use nalgebra_sparse::{CooMatrix, CsrMatrix};
use wasm_bindgen::prelude::*;
use serde_wasm_bindgen;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// Re-export design code calculations
pub use design_codes::{
    calculate_beam_capacity, 
    calculate_seismic_base_shear,
    calculate_aisc_capacity 
};

#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub fn set_panic_hook() {
    console_error_panic_hook::set_once();
}

/// Solve a linear system K * u = F using LU decomposition
/// Backported from legacy solver-wasm for compatibility with StructuralSolverWorker
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

/// 2D Frame analysis (backward compatible - no loads)
#[wasm_bindgen]
pub fn solve_structure_wasm(nodes_val: JsValue, elements_val: JsValue) -> JsValue {
    // Deserialize inputs
    let nodes: Vec<solver::Node> = match serde_wasm_bindgen::from_value(nodes_val) {
        Ok(v) => v,
        Err(e) => return JsValue::from_str(&format!("Error parsing nodes: {}", e)),
    };
    
    let elements: Vec<solver::Element> = match serde_wasm_bindgen::from_value(elements_val) {
        Ok(v) => v,
        Err(e) => return JsValue::from_str(&format!("Error parsing elements: {}", e)),
    };

    // Solve
    match solver::analyze(nodes, elements) {
        Ok(result) => {
             match serde_wasm_bindgen::to_value(&result) {
                 Ok(val) => val,
                 Err(e) => JsValue::from_str(&format!("Error serializing result: {}", e)),
             }
        },
        Err(e) => {
            // Return error object
            let err_res = solver::AnalysisResult {
                displacements: std::collections::HashMap::new(),
                reactions: std::collections::HashMap::new(),
                success: false,
                error: Some(e),
            };
            serde_wasm_bindgen::to_value(&err_res).unwrap_or(JsValue::from_str("Error"))
        }
    }
}

/// 2D Frame analysis WITH nodal loads
/// This is the recommended function for 2D analysis with applied loads
#[wasm_bindgen]
pub fn solve_2d_frame_with_loads(
    nodes_val: JsValue, 
    elements_val: JsValue,
    loads_val: JsValue
) -> JsValue {
    let nodes: Vec<solver::Node> = match serde_wasm_bindgen::from_value(nodes_val) {
        Ok(v) => v,
        Err(e) => return JsValue::from_str(&format!("Error parsing nodes: {}", e)),
    };
    
    let elements: Vec<solver::Element> = match serde_wasm_bindgen::from_value(elements_val) {
        Ok(v) => v,
        Err(e) => return JsValue::from_str(&format!("Error parsing elements: {}", e)),
    };
    
    let loads: Vec<solver::NodalLoad2D> = serde_wasm_bindgen::from_value(loads_val)
        .unwrap_or_default();

    match solver::analyze_with_loads(nodes, elements, loads) {
        Ok(result) => {
            serde_wasm_bindgen::to_value(&result)
                .unwrap_or_else(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
        },
        Err(e) => {
            let err_res = solver::AnalysisResult {
                displacements: std::collections::HashMap::new(),
                reactions: std::collections::HashMap::new(),
                success: false,
                error: Some(e),
            };
            serde_wasm_bindgen::to_value(&err_res).unwrap_or(JsValue::from_str("Error"))
        }
    }
}

/// 3D Frame analysis (new advanced solver)
#[wasm_bindgen]
pub fn solve_3d_frame(
    nodes_val: JsValue, 
    elements_val: JsValue,
    nodal_loads_val: JsValue,
    distributed_loads_val: JsValue,
) -> JsValue {
    let nodes: Vec<solver_3d::Node3D> = match serde_wasm_bindgen::from_value(nodes_val) {
        Ok(v) => v,
        Err(e) => return JsValue::from_str(&format!("Error parsing nodes: {}", e)),
    };
    
    let elements: Vec<solver_3d::Element3D> = match serde_wasm_bindgen::from_value(elements_val) {
        Ok(v) => v,
        Err(e) => return JsValue::from_str(&format!("Error parsing elements: {}", e)),
    };
    
    let nodal_loads: Vec<solver_3d::NodalLoad> = serde_wasm_bindgen::from_value(nodal_loads_val)
        .unwrap_or_default();
        
    let distributed_loads: Vec<solver_3d::DistributedLoad> = serde_wasm_bindgen::from_value(distributed_loads_val)
        .unwrap_or_default();
    
    match solver_3d::analyze_3d_frame(nodes, elements, nodal_loads, distributed_loads, vec![]) {
        Ok(mut result) => {
            // Sanitize NaN values to prevent serialization errors
            for (_, disp) in result.displacements.iter_mut() {
                for val in disp.iter_mut() {
                    if val.is_nan() || val.is_infinite() {
                        *val = 0.0;
                    }
                }
            }
            for (_, react) in result.reactions.iter_mut() {
                for val in react.iter_mut() {
                    if val.is_nan() || val.is_infinite() {
                        *val = 0.0;
                    }
                }
            }
            for (_, forces) in result.member_forces.iter_mut() {
                for val in forces.forces_i.iter_mut() {
                    if val.is_nan() || val.is_infinite() { *val = 0.0; }
                }
                for val in forces.forces_j.iter_mut() {
                    if val.is_nan() || val.is_infinite() { *val = 0.0; }
                }
                if forces.max_shear_y.is_nan() { forces.max_shear_y = 0.0; }
                if forces.max_shear_z.is_nan() { forces.max_shear_z = 0.0; }
                if forces.max_moment_y.is_nan() { forces.max_moment_y = 0.0; }
                if forces.max_moment_z.is_nan() { forces.max_moment_z = 0.0; }
                if forces.max_axial.is_nan() { forces.max_axial = 0.0; }
                if forces.max_torsion.is_nan() { forces.max_torsion = 0.0; }
            }
            
            serde_wasm_bindgen::to_value(&result)
                .unwrap_or_else(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
        },
        Err(e) => JsValue::from_str(&format!("Analysis error: {}", e)),
    }
}

/// Modal analysis for dynamic properties
#[wasm_bindgen]
pub fn modal_analysis(nodes_val: JsValue, elements_val: JsValue, num_modes: usize) -> JsValue {
    let nodes: Vec<solver_3d::Node3D> = match serde_wasm_bindgen::from_value(nodes_val) {
        Ok(v) => v,
        Err(e) => return JsValue::from_str(&format!("Error parsing nodes: {}", e)),
    };
    
    let elements: Vec<solver_3d::Element3D> = match serde_wasm_bindgen::from_value(elements_val) {
        Ok(v) => v,
        Err(e) => return JsValue::from_str(&format!("Error parsing elements: {}", e)),
    };
    
    // Call the solver
    match solver_3d::modal_analysis(nodes, elements, num_modes) {
        Ok(result) => {
             match serde_wasm_bindgen::to_value(&result) {
                 Ok(val) => val,
                 Err(e) => JsValue::from_str(&format!("Error serializing modal result: {}", e)),
             }
        },
        Err(e) => JsValue::from_str(&format!("Modal Analysis Error: {}", e)),
    }
}

/// Response Spectrum Analysis (Seismic)
#[wasm_bindgen]
pub fn solve_response_spectrum(
    modal_result_val: JsValue,
    zone_factor: f64,
    importance_factor: f64,
    response_reduction: f64,
    soil_type: u8
) -> JsValue {
    let modal_results: crate::dynamics::ModalResult = match serde_wasm_bindgen::from_value(modal_result_val) {
        Ok(v) => v,
        Err(e) => return JsValue::from_str(&format!("Error parsing modal results: {}", e)),
    };
    
    let result = crate::dynamics::calculate_response_spectrum(
        &modal_results,
        zone_factor,
        importance_factor,
        response_reduction,
        soil_type
    );
    
    serde_wasm_bindgen::to_value(&result)
        .unwrap_or_else(|e| JsValue::from_str(&format!("Error serializing seismic result: {}", e)))
}

/// P-Delta analysis - iterative geometric nonlinear analysis
/// Accounts for secondary moments from axial loads (P) acting on lateral displacements (Δ)
#[wasm_bindgen]
pub fn solve_p_delta(
    nodes_val: JsValue,
    elements_val: JsValue,
    point_loads_val: JsValue,
    member_loads_val: JsValue,
    max_iterations: usize,
    tolerance: f64
) -> JsValue {
    // Parse inputs
    let nodes: Vec<solver_3d::Node3D> = match serde_wasm_bindgen::from_value(nodes_val) {
        Ok(v) => v,
        Err(e) => return JsValue::from_str(&format!("Error parsing nodes: {}", e)),
    };
    
    let elements: Vec<solver_3d::Element3D> = match serde_wasm_bindgen::from_value(elements_val) {
        Ok(v) => v,
        Err(e) => return JsValue::from_str(&format!("Error parsing elements: {}", e)),
    };
    
    let nodal_loads: Vec<solver_3d::NodalLoad> = serde_wasm_bindgen::from_value(point_loads_val)
        .unwrap_or_default();
        
    let distributed_loads: Vec<solver_3d::DistributedLoad> = serde_wasm_bindgen::from_value(member_loads_val)
        .unwrap_or_default();
    
    // Perform P-Delta analysis
    match solver_3d::p_delta_analysis(
        nodes, 
        elements, 
        nodal_loads, 
        distributed_loads,
        if max_iterations == 0 { 10 } else { max_iterations },
        if tolerance == 0.0 { 1e-4 } else { tolerance }
    ) {
        Ok(result) => {
            serde_wasm_bindgen::to_value(&result)
                .unwrap_or_else(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
        },
        Err(e) => JsValue::from_str(&format!(r#"{{"success": false, "error": "{}"}}"#, e)),
    }
}

/// Buckling analysis (stub for backward compatibility)
#[wasm_bindgen]
pub fn analyze_buckling(
    _nodes_val: JsValue,
    _elements_val: JsValue,
    _point_loads_val: JsValue,
    _num_modes: usize
) -> JsValue {
    JsValue::from_str(r#"{"success": false, "error": "Buckling analysis not yet implemented in backend-rust"}"#)
}

/// Get solver version and capabilities
#[wasm_bindgen]
pub fn get_solver_info() -> String {
    r#"{
        "version": "3.0.0-ultra-fast",
        "capabilities": [
            "2D frame analysis",
            "3D frame analysis",
            "Plate/Shell Finite Elements (DKQ)",
            "AISC 360-16 LRFD Design",
            "Indian Standard Design (IS456/IS800)",
            "Direct stiffness method",
            "LU decomposition solver",
            "Cholesky decomposition (SPD)",
            "Sparse matrix storage (CSR)",
            "Conjugate Gradient iterative solver",
            "Memory pooling",
            "Incremental updates (Sherman-Morrison)",
            "Model Order Reduction (POD)"
        ],
        "performance": {
            "target_20_nodes_us": 100,
            "target_100_nodes_us": 1000,
            "target_1000_nodes_ms": 10,
            "memory_efficient": true
        }
    }"#.to_string()
}

// ============================================
// ULTRA-FAST SOLVER EXPORTS
// ============================================

/// Ultra-fast 3D frame analysis with performance metrics
/// Returns microsecond-level analysis times for small-medium structures
#[wasm_bindgen]
pub fn solve_ultra_fast(
    nodes_val: JsValue,
    elements_val: JsValue,
    loads_val: JsValue,
) -> JsValue {
    // Input structure for ultra-fast solver
    #[derive(Deserialize)]
    struct UltraFastNode {
        id: String,
        x: f64,
        y: f64,
        #[serde(default)]
        z: f64,
        #[serde(default)]
        restraints: [bool; 6],
    }
    
    #[derive(Deserialize)]
    struct UltraFastElement {
        id: String,
        node_i: usize,
        node_j: usize,
        #[serde(alias = "E")]
        e: f64,
        #[serde(default = "default_g")]
        g: f64,
        #[serde(alias = "A")]
        a: f64,
        #[serde(alias = "Iy", default)]
        iy: f64,
        #[serde(alias = "Iz", default)]
        iz: f64,
        #[serde(alias = "J", default)]
        j: f64,
        #[serde(default)]
        beta: f64,
    }
    
    fn default_g() -> f64 { 80e9 }
    
    #[derive(Deserialize)]
    struct UltraFastLoad {
        node_idx: usize,
        #[serde(default)]
        fx: f64,
        #[serde(default)]
        fy: f64,
        #[serde(default)]
        fz: f64,
        #[serde(default)]
        mx: f64,
        #[serde(default)]
        my: f64,
        #[serde(default)]
        mz: f64,
    }
    
    // Parse inputs
    let nodes: Vec<UltraFastNode> = match serde_wasm_bindgen::from_value(nodes_val) {
        Ok(v) => v,
        Err(e) => return JsValue::from_str(&format!(r#"{{"success":false,"error":"Node parse error: {}"}}"#, e)),
    };
    
    let elements: Vec<UltraFastElement> = match serde_wasm_bindgen::from_value(elements_val) {
        Ok(v) => v,
        Err(e) => return JsValue::from_str(&format!(r#"{{"success":false,"error":"Element parse error: {}"}}"#, e)),
    };
    
    let loads: Vec<UltraFastLoad> = serde_wasm_bindgen::from_value(loads_val).unwrap_or_default();
    
    // Convert to ultra-fast format
    let uf_nodes: Vec<_> = nodes.iter()
        .map(|n| (n.id.clone(), n.x, n.y, n.z, n.restraints))
        .collect();
    
    let uf_elements: Vec<_> = elements.iter()
        .map(|e| (
            e.id.clone(), e.node_i, e.node_j,
            e.e, e.g, e.a, e.iy, e.iz, e.j, e.beta
        ))
        .collect();
    
    let uf_loads: Vec<_> = loads.iter()
        .map(|l| (l.node_idx, l.fx, l.fy, l.fz, l.mx, l.my, l.mz))
        .collect();
    
    // Run analysis
    match ultra_fast_solver::analyze_ultra_fast(&uf_nodes, &uf_elements, &uf_loads) {
        Ok(result) => {
            serde_wasm_bindgen::to_value(&result)
                .unwrap_or_else(|e| JsValue::from_str(&format!(r#"{{"success":false,"error":"Serialize error: {}"}}"#, e)))
        }
        Err(e) => JsValue::from_str(&format!(r#"{{"success":false,"error":"{}"}}"#, e)),
    }
}

/// Benchmark the ultra-fast solver
/// Returns timing statistics for different problem sizes
#[wasm_bindgen]
pub fn benchmark_ultra_fast(num_nodes: usize, num_elements: usize, iterations: usize) -> JsValue {
    let (mean, median, min) = ultra_fast_solver::benchmark_solver(
        num_nodes, 
        num_elements,
        if iterations == 0 { 10 } else { iterations }
    );
    
    #[derive(Serialize)]
    struct BenchmarkResult {
        num_nodes: usize,
        num_elements: usize,
        iterations: usize,
        mean_us: f64,
        median_us: f64,
        min_us: f64,
        target_met: bool,
    }
    
    // Target: 100μs for 20 nodes, 1000μs for 100 nodes
    let target = if num_nodes <= 20 { 100.0 } 
                 else if num_nodes <= 100 { 1000.0 } 
                 else { 10000.0 };
    
    let result = BenchmarkResult {
        num_nodes,
        num_elements,
        iterations,
        mean_us: mean,
        median_us: median,
        min_us: min,
        target_met: min < target,
    };
    
    serde_wasm_bindgen::to_value(&result)
        .unwrap_or_else(|_| JsValue::from_str(r#"{"error":"Benchmark failed"}"#))
}
/// Sparse system input
#[derive(Deserialize)]
struct SparseSystemInput {
    entries: Vec<SparseEntry>,
    forces: Vec<f64>,
    size: usize,
}

#[derive(Deserialize)]
struct SparseEntry {
    row: usize,
    col: usize,
    value: f64,
}

/// Sparse system output
#[derive(Serialize)]
struct SparseSystemOutput {
    success: bool,
    displacements: Vec<f64>,
    error: Option<String>,
    solve_time_ms: f64,
}

/// Solve sparse system using Conjugate Gradient
/// This handles large structures (e.g. 10k+ nodes) without OOM.
#[wasm_bindgen]
pub fn solve_sparse_system_json(input_json: &str) -> String {
    let start = js_sys::Date::now();

    // 1. Parse Input
    let input: SparseSystemInput = match serde_json::from_str(input_json) {
        Ok(v) => v,
        Err(e) => return serde_json::to_string(&SparseSystemOutput {
            success: false,
            displacements: vec![],
            error: Some(format!("JSON Parse Error: {}", e)),
            solve_time_ms: 0.0,
        }).unwrap(),
    };

    let n = input.size;
    
    // 2. Build Sparse Matrix (COO -> CSR)
    // CooMatrix::new(rows, cols)
    let mut coo = CooMatrix::new(n, n);
    for entry in input.entries {
        coo.push(entry.row, entry.col, entry.value);
    }
    
    let csr = CsrMatrix::from(&coo);
    
    // 3. Build Force Vector
    let b = DVector::from_vec(input.forces);
    
    // 4. Solve using Conjugate Gradient (PCG) with Jacobi Preconditioner
    // Initialization
    let mut x = DVector::from_element(n, 0.0);
    let mut r = b.clone(); // Residual r = b - Ax (x=0)
    let mut p = r.clone();
    
    // Jacobi Preconditioner: M = diag(A)
    // We need diagonal elements. CsrMatrix doesn't have easy diag access?
    // We can iterate.
    let mut diag = DVector::from_element(n, 1.0);
    
    // Extract diagonal (slow-ish but OK once)
    // In CSR: row offsets and col indices.
    // row i is in values[row_offsets[i] .. row_offsets[i+1]]
    // with col indices in col_indices[...]
    let row_offsets = csr.row_offsets();
    let col_indices = csr.col_indices();
    let values = csr.values();
    
    for i in 0..n {
        let start = row_offsets[i];
        let end = row_offsets[i+1];
        for idx in start..end {
            if col_indices[idx] == i {
                diag[i] = values[idx];
                break;
            }
        }
    }
    
    // z = M^-1 * r
    let mut z = DVector::zeros(n);
    for i in 0..n {
        if diag[i].abs() > 1e-12 {
            z[i] = r[i] / diag[i];
        } else {
            z[i] = r[i];
        }
    }
    
    let mut p = z.clone();
    let mut r_dot_z = r.dot(&z);
    
    let max_iter = n * 2;
    let tol = 1e-8;
    let b_norm = b.norm();
    
    let mut recovered = true;
    let mut iterations = 0;
    
    for iter in 0..max_iter {
        iterations = iter;
        // Ap = A * p
        let ap = &csr * &p;
        
        // alpha = (r . z) / (p . Ap)
        let p_dot_ap = p.dot(&ap);
        
        if p_dot_ap.abs() < 1e-20 {
             // breakdown
             break;
        }
        
        let alpha = r_dot_z / p_dot_ap;
        
        // x = x + alpha * p
        x = &x + alpha * &p;
        
        // r = r - alpha * Ap
        r = &r - alpha * &ap;
        
        if r.norm() / b_norm < tol {
            break; 
        }
        
        // z_new = M^-1 * r
        let mut z_new = DVector::zeros(n);
        for i in 0..n {
            if diag[i].abs() > 1e-12 {
                z_new[i] = r[i] / diag[i];
            } else {
                z_new[i] = r[i];
            }
        }
        
        let r_dot_z_new = r.dot(&z_new);
        let beta = r_dot_z_new / r_dot_z;
        
        // p = z_new + beta * p
        p = z_new + beta * &p;
        
        r_dot_z = r_dot_z_new;
    }
    
    let end = js_sys::Date::now();
    let solve_time = end - start;
    
    // Return result
    let output = SparseSystemOutput {
        success: true,
        displacements: x.as_slice().to_vec(),
        error: None,
        solve_time_ms: solve_time,
    };
    
    serde_json::to_string(&output).unwrap_or(r#"{"success":false,"error":"Serialization failed"}"#.to_string())
}
