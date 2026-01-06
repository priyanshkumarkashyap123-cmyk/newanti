mod solver;
pub mod solver_3d;
pub mod design_codes;
pub mod renderer;
pub mod ai_architect;
use nalgebra::{DMatrix, DVector};
use wasm_bindgen::prelude::*;
use serde_wasm_bindgen;
use serde::{Deserialize, Serialize};

// Re-export design code calculations
pub use design_codes::{calculate_beam_capacity, calculate_seismic_base_shear};

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

/// 2D Frame analysis (backward compatible)
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
        Ok(result) => serde_wasm_bindgen::to_value(&result)
            .unwrap_or_else(|e| JsValue::from_str(&format!("Serialization error: {}", e))),
        Err(e) => JsValue::from_str(&format!("Analysis error: {}", e)),
    }
}

/// Modal analysis for dynamic properties
#[wasm_bindgen]
pub fn modal_analysis(nodes_val: JsValue, elements_val: JsValue, num_modes: usize) -> JsValue {
    let nodes: Vec<solver_3d::Node3D> = match serde_wasm_bindgen::from_value(nodes_val) {
        Ok(v) => v,
        Err(e) => return JsValue::from_str(&format!("Error: {}", e)),
    };
    
    let elements: Vec<solver_3d::Element3D> = match serde_wasm_bindgen::from_value(elements_val) {
        Ok(v) => v,
        Err(e) => return JsValue::from_str(&format!("Error: {}", e)),
    };
    
    match solver_3d::modal_analysis(nodes, elements, num_modes) {
        Ok(result) => serde_wasm_bindgen::to_value(&result)
            .unwrap_or_else(|e| JsValue::from_str(&format!("Error: {}", e))),
        Err(e) => JsValue::from_str(&format!("Error: {}", e)),
    }
}

/// P-Delta analysis (stub for backward compatibility)
#[wasm_bindgen]
pub fn solve_p_delta(
    _nodes_val: JsValue,
    _elements_val: JsValue,
    _point_loads_val: JsValue,
    _member_loads_val: JsValue,
    _max_iterations: usize,
    _tolerance: f64
) -> JsValue {
    JsValue::from_str(r#"{"success": false, "error": "P-Delta analysis not yet implemented in backend-rust"}"#)
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
        "version": "2.0.0-rust",
        "capabilities": [
            "2D frame analysis",
            "3D frame analysis",
            "Modal analysis",
            "Direct stiffness method",
            "LU decomposition solver"
        ]
    }"#.to_string()
}

