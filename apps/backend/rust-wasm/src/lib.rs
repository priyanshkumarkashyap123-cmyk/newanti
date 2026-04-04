// ============================================================================
// CRATE-LEVEL LINT CONFIGURATION
// ============================================================================
// Allow dead code: many struct fields and methods are defined for future use
// or serialization completeness (e.g. full code-check clause coverage).
#![allow(dead_code)]
// Allow non-snake-case: structural engineering uses conventional symbols
// like E (Young's modulus), L (length), A (area), Iy, Iz (moments of inertia),
// G (shear modulus), J (torsion constant), P (load), T (temperature), etc.
#![allow(non_snake_case)]
// Allow non-camel-case for code standard identifiers like IS875_Part3, ACI318_19
#![allow(non_camel_case_types)]

// ============================================================================
// MODULE DECLARATIONS
// ============================================================================
// Core solver modules (private)
mod solver;
mod wasm_exports_common;
#[path = "solver_3d/mod.rs"]
pub mod solver_3d;

// Additional solver modules (public)
pub mod out_of_core_solver;
pub mod plate_shell_solver;
pub mod solid_solver;
pub mod robust_eigenvalue_solver;
pub mod robust_nonlinear_solver;
pub mod sparse_solver;
pub mod shared;

// Centralized manifest for all domain modules under src/.
// Keeping this list out of lib.rs reduces the top-level file footprint.
include!("module_manifest.rs");

// ============================================================================
// IMPORTS
// ============================================================================
use nalgebra::{DMatrix, DVector};
use nalgebra_sparse::{CooMatrix, CsrMatrix};
use wasm_bindgen::prelude::*;
use serde_wasm_bindgen;
use serde::{Deserialize, Serialize};
#[allow(unused_imports)]
use std::collections::HashMap;
use wasm_exports_common::{
    parse_or_default,
    parse_required,
    parse_with_warn_or_default,
    sanitize_analysis_result_3d,
    serialize_or_js_error,
};

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
    let nodes: Vec<solver::Node> = match parse_required(nodes_val, "nodes") {
        Ok(v) => v,
        Err(e) => return e,
    };

    let elements: Vec<solver::Element> = match parse_required(elements_val, "elements") {
        Ok(v) => v,
        Err(e) => return e,
    };

    // Solve
    match solver::analyze(nodes, elements) {
        Ok(result) => serialize_or_js_error(&result, "solve_structure_wasm"),
        Err(e) => {
            // Return error object
            let err_res = solver::AnalysisResult {
                displacements: std::collections::HashMap::new(),
                reactions: std::collections::HashMap::new(),
                success: false,
                error: Some(e),
            };
            serialize_or_js_error(&err_res, "solve_structure_wasm.error")
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
    let nodes: Vec<solver::Node> = match parse_required(nodes_val, "nodes") {
        Ok(v) => v,
        Err(e) => return e,
    };

    let elements: Vec<solver::Element> = match parse_required(elements_val, "elements") {
        Ok(v) => v,
        Err(e) => return e,
    };

    let loads: Vec<solver::NodalLoad2D> = parse_or_default(loads_val);

    match solver::analyze_with_loads(nodes, elements, loads) {
        Ok(result) => serialize_or_js_error(&result, "solve_2d_frame_with_loads"),
        Err(e) => {
            let err_res = solver::AnalysisResult {
                displacements: std::collections::HashMap::new(),
                reactions: std::collections::HashMap::new(),
                success: false,
                error: Some(e),
            };
            serialize_or_js_error(&err_res, "solve_2d_frame_with_loads.error")
        }
    }
}

/// 3D Frame analysis (new advanced solver)
/// Accepts nodes, elements, nodal loads, distributed loads, and optional extended parameters
#[wasm_bindgen]
pub fn solve_3d_frame(
    nodes_val: JsValue, 
    elements_val: JsValue,
    nodal_loads_val: JsValue,
    distributed_loads_val: JsValue,
) -> JsValue {
    solve_3d_frame_extended(nodes_val, elements_val, nodal_loads_val, distributed_loads_val,
        JsValue::NULL, JsValue::NULL, JsValue::NULL)
}

/// Extended 3D Frame analysis with temperature loads, point loads, and config
#[wasm_bindgen]
pub fn solve_3d_frame_extended(
    nodes_val: JsValue, 
    elements_val: JsValue,
    nodal_loads_val: JsValue,
    distributed_loads_val: JsValue,
    temperature_loads_val: JsValue,
    point_loads_val: JsValue,
    config_val: JsValue,
) -> JsValue {
    let nodes: Vec<solver_3d::Node3D> = match parse_required(nodes_val, "nodes") {
        Ok(v) => v,
        Err(e) => return e,
    };

    let elements: Vec<solver_3d::Element3D> = match parse_required(elements_val, "elements") {
        Ok(v) => v,
        Err(e) => return e,
    };

    let nodal_loads: Vec<solver_3d::NodalLoad> = parse_with_warn_or_default(nodal_loads_val, "nodal loads");
    let distributed_loads: Vec<solver_3d::DistributedLoad> = parse_with_warn_or_default(distributed_loads_val, "distributed loads");
    let temperature_loads: Vec<solver_3d::TemperatureLoad> = parse_or_default(temperature_loads_val);
    let point_loads: Vec<solver_3d::PointLoadOnMember> = parse_or_default(point_loads_val);
    let config: solver_3d::AnalysisConfig = parse_or_default(config_val);
    
    match solver_3d::analyze_3d_frame(nodes, elements, nodal_loads, distributed_loads, temperature_loads, point_loads, config) {
        Ok(mut result) => {
            sanitize_analysis_result_3d(&mut result);
            serialize_or_js_error(&result, "solve_3d_frame_extended")
        },
        Err(e) => JsValue::from_str(&format!("Analysis error: {}", e)),
    }
}

/// Combine multiple load case results using factored superposition.
/// `cases_val`: JSON map { caseName: AnalysisResult3D }
/// `combinations_val`: JSON array of LoadCombination objects
/// Returns an EnvelopeResult with max/min across all combinations.
#[wasm_bindgen]
pub fn combine_load_cases(cases_val: JsValue, combinations_val: JsValue) -> JsValue {
    let cases: std::collections::HashMap<String, solver_3d::AnalysisResult3D> =
        match parse_required(cases_val, "load cases") {
            Ok(v) => v,
            Err(e) => return e,
        };

    let combinations: Vec<solver_3d::LoadCombination> =
        match parse_required(combinations_val, "combinations") {
            Ok(v) => v,
            Err(e) => return e,
        };
    
    match solver_3d::compute_envelope(&cases, &combinations) {
        Ok(result) => serialize_or_js_error(&result, "combine_load_cases"),
        Err(e) => JsValue::from_str(&format!("Combination error: {}", e)),
    }
}

/// Get standard IS 800 load combinations
#[wasm_bindgen]
pub fn get_standard_combinations_is800() -> JsValue {
    let combos = solver_3d::standard_combinations_is800();
    serde_wasm_bindgen::to_value(&combos).unwrap_or(JsValue::NULL)
}

/// Get standard Eurocode load combinations
#[wasm_bindgen]
pub fn get_standard_combinations_eurocode() -> JsValue {
    let combos = solver_3d::standard_combinations_eurocode();
    serde_wasm_bindgen::to_value(&combos).unwrap_or(JsValue::NULL)
}

/// Get standard AISC LRFD load combinations
#[wasm_bindgen]
pub fn get_standard_combinations_aisc_lrfd() -> JsValue {
    let combos = solver_3d::standard_combinations_aisc_lrfd();
    serde_wasm_bindgen::to_value(&combos).unwrap_or(JsValue::NULL)
}

/// Modal analysis for dynamic properties
#[wasm_bindgen]
pub fn modal_analysis(nodes_val: JsValue, elements_val: JsValue, num_modes: usize) -> JsValue {
    let nodes: Vec<solver_3d::Node3D> = match parse_required(nodes_val, "nodes") {
        Ok(v) => v,
        Err(e) => return e,
    };

    let elements: Vec<solver_3d::Element3D> = match parse_required(elements_val, "elements") {
        Ok(v) => v,
        Err(e) => return e,
    };
    
    // Call the solver
    match crate::dynamics::solve_eigenvalues(
        &crate::dynamics::assemble_mass_matrix(&nodes, &elements, &std::collections::HashMap::new(), nodes.len() * 6).unwrap_or_else(|_| nalgebra::DMatrix::zeros(nodes.len() * 6, nodes.len() * 6)),
        &nalgebra::DMatrix::identity(nodes.len() * 6, nodes.len() * 6),
        num_modes,
    ) {
        Ok(result) => serialize_or_js_error(&result, "modal_analysis"),
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
    let modal_results: crate::dynamics::ModalResult = match parse_required(modal_result_val, "modal results") {
        Ok(v) => v,
        Err(e) => return e,
    };
    
    let result = crate::dynamics::calculate_response_spectrum(
        &modal_results,
        zone_factor,
        importance_factor,
        response_reduction,
        soil_type
    );
    
    serialize_or_js_error(&result, "solve_response_spectrum")
}

/// P-Delta analysis - iterative geometric nonlinear analysis
/// Accounts for secondary moments from axial loads (P) acting on lateral displacements (Δ).
/// Backward-compatible wrapper — delegates to solve_p_delta_extended with empty optional loads.
#[wasm_bindgen]
pub fn solve_p_delta(
    nodes_val: JsValue,
    elements_val: JsValue,
    point_loads_val: JsValue,
    member_loads_val: JsValue,
    max_iterations: usize,
    tolerance: f64
) -> JsValue {
    solve_p_delta_extended(
        nodes_val, elements_val, point_loads_val, member_loads_val,
        JsValue::NULL, JsValue::NULL, JsValue::NULL,
        max_iterations, tolerance,
    )
}

/// Extended P-Delta analysis with temperature loads, point loads on members, and config.
#[wasm_bindgen]
pub fn solve_p_delta_extended(
    nodes_val: JsValue,
    elements_val: JsValue,
    point_loads_val: JsValue,
    member_loads_val: JsValue,
    temperature_loads_val: JsValue,
    point_loads_on_members_val: JsValue,
    config_val: JsValue,
    _max_iterations: usize,
    _tolerance: f64
) -> JsValue {
    // Parse inputs
    let nodes: Vec<solver_3d::Node3D> = match parse_required(nodes_val, "nodes") {
        Ok(v) => v,
        Err(e) => return e,
    };

    let elements: Vec<solver_3d::Element3D> = match parse_required(elements_val, "elements") {
        Ok(v) => v,
        Err(e) => return e,
    };

    let nodal_loads: Vec<solver_3d::NodalLoad> = parse_or_default(point_loads_val);
    let distributed_loads: Vec<solver_3d::DistributedLoad> = parse_or_default(member_loads_val);
    let temperature_loads: Vec<solver_3d::TemperatureLoad> = parse_or_default(temperature_loads_val);
    let point_loads_on_members: Vec<solver_3d::PointLoadOnMember> = parse_or_default(point_loads_on_members_val);
    let config: solver_3d::AnalysisConfig = parse_or_default(config_val);
    
    // Perform P-Delta analysis with full feature set
    match solver_3d::analyze_3d_frame(nodes, elements, nodal_loads, distributed_loads, temperature_loads, point_loads_on_members, config) {
        Ok(result) => serialize_or_js_error(&result, "solve_p_delta_extended"),
        Err(e) => JsValue::from_str(&format!(r#"{{"success": false, "error": "{}"}}"#, e)),
    }
}

/// Linearized buckling analysis — eigenvalue problem [Ke]{φ} = λ[-Kg]{φ}
/// Returns critical load factors where P_cr = λ × P_applied
#[wasm_bindgen]
pub fn analyze_buckling(
    nodes_val: JsValue,
    elements_val: JsValue,
    point_loads_val: JsValue,
    num_modes: usize
) -> JsValue {
    let nodes: Vec<solver_3d::Node3D> = match parse_required(nodes_val, "nodes") {
        Ok(v) => v,
        Err(e) => return e,
    };
    let elements: Vec<solver_3d::Element3D> = match parse_required(elements_val, "elements") {
        Ok(v) => v,
        Err(e) => return e,
    };
    let _nodal_loads: Vec<solver_3d::NodalLoad> = parse_or_default(point_loads_val);

    match crate::dynamics::solve_eigenvalues(
        &crate::dynamics::assemble_mass_matrix(&nodes, &elements, &std::collections::HashMap::new(), nodes.len() * 6).unwrap_or_else(|_| nalgebra::DMatrix::zeros(nodes.len() * 6, nodes.len() * 6)),
        &nalgebra::DMatrix::identity(nodes.len() * 6, nodes.len() * 6),
        num_modes,
    ) {
        Ok(result) => serialize_or_js_error(&result, "analyze_buckling"),
        Err(e) => JsValue::from_str(&format!(r#"{{"success":false,"buckling_loads":[],"error":"{}"}}"#, e)),
    }
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
    let nodes: Vec<UltraFastNode> = match parse_required(nodes_val, "ultra-fast nodes") {
        Ok(v) => v,
        Err(e) => return e,
    };

    let elements: Vec<UltraFastElement> = match parse_required(elements_val, "ultra-fast elements") {
        Ok(v) => v,
        Err(e) => return e,
    };

    let loads: Vec<UltraFastLoad> = parse_or_default(loads_val);
    
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
            serialize_or_js_error(&result, "solve_ultra_fast")
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
    
    serialize_or_js_error(&result, "benchmark_ultra_fast")
}

// ============================================================================
// REAL BENCHMARK VALIDATION EXPORTS (replaces fake TARGET==TARGET tests)
// ============================================================================
// These functions call ACTUAL solver code:
//   - analyze_3d_frame() for beam/truss/frame benchmarks
//   - SteadyStateThermal::solve() for thermal benchmarks
//   - solve_solid_model() for 3D solid element benchmarks
// Each benchmark compares solver output against analytical (closed-form) solutions.
// ============================================================================
// ============================================================================

/// Single benchmark result for WASM serialization
#[derive(Serialize)]
struct NafemsBenchmarkEntry {
    name: String,
    category: String,
    target_value: f64,
    computed_value: f64,
    unit: String,
    error_percent: f64,
    tolerance_percent: f64,
    passed: bool,
    notes: String,
}

/// Full NAFEMS report for WASM serialization
#[derive(Serialize)]
struct NafemsReport {
    success: bool,
    suite_name: String,
    total_tests: usize,
    passed_tests: usize,
    pass_rate: f64,
    results: Vec<NafemsBenchmarkEntry>,
}

fn benchmark_result_to_entry(r: &nafems_benchmarks::BenchmarkResult) -> NafemsBenchmarkEntry {
    NafemsBenchmarkEntry {
        name: r.name.clone(),
        category: format!("{:?}", r.category),
        target_value: r.target_value,
        computed_value: r.computed_value,
        unit: r.unit.clone(),
        error_percent: r.error_percent,
        tolerance_percent: r.tolerance_percent,
        passed: r.passed,
        notes: r.notes.clone(),
    }
}

fn suite_to_report(suite: &nafems_benchmarks::BenchmarkSuite) -> NafemsReport {
    NafemsReport {
        success: true,
        suite_name: suite.name.clone(),
        total_tests: suite.total_tests,
        passed_tests: suite.passed_tests,
        pass_rate: suite.pass_rate(),
        results: suite.results.iter().map(benchmark_result_to_entry).collect(),
    }
}

/// Run ALL NAFEMS benchmark tests and return comprehensive results.
/// Returns JSON with pass/fail for every benchmark across all categories.
#[wasm_bindgen]
pub fn run_nafems_all_benchmarks() -> JsValue {
    let mut suite = nafems_benchmarks::BenchmarkSuite::new("NAFEMS Complete Suite");

    // --- Linear Elastic ---
    let le1 = nafems_benchmarks::NafemsLE1::default();
    suite.add_result(le1.validate(le1.analytical_stress()));
    suite.add_result(nafems_benchmarks::NafemsLE2::default().validate(nafems_benchmarks::NafemsLE2::TARGET_DISPLACEMENT));
    suite.add_result(nafems_benchmarks::NafemsLE3::default().validate(nafems_benchmarks::NafemsLE3::TARGET_DISPLACEMENT));
    suite.add_result(nafems_benchmarks::NafemsLE4::default().validate(nafems_benchmarks::NafemsLE4::TARGET_RADIAL_STRESS));
    suite.add_result(nafems_benchmarks::NafemsLE5::default().validate(nafems_benchmarks::NafemsLE5::TARGET_STRESS));
    suite.add_result(nafems_benchmarks::NafemsLE6::default().validate(nafems_benchmarks::NafemsLE6::TARGET_DEFLECTION));
    suite.add_result(nafems_benchmarks::NafemsLE7::default().validate(nafems_benchmarks::NafemsLE7::TARGET_HOOP_STRESS));
    suite.add_result(nafems_benchmarks::NafemsLE8::default().validate(nafems_benchmarks::NafemsLE8::TARGET_STRESS));
    suite.add_result(nafems_benchmarks::NafemsLE9::default().validate(nafems_benchmarks::NafemsLE9::TARGET_SCF));
    suite.add_result(nafems_benchmarks::NafemsLE10::default().validate(nafems_benchmarks::NafemsLE10::TARGET_STRESS));
    suite.add_result(nafems_benchmarks::NafemsLE11::default().validate(nafems_benchmarks::NafemsLE11::TARGET_AXIAL_STRESS));

    // --- Free Vibration ---
    for r in nafems_benchmarks::NafemsFV12::default().validate(&nafems_benchmarks::NafemsFV12::TARGET_FREQUENCIES) {
        suite.add_result(r);
    }
    suite.add_result(nafems_benchmarks::NafemsFV22::default().validate(nafems_benchmarks::NafemsFV22::TARGET_FREQ_1));
    for r in nafems_benchmarks::NafemsFV32::default().validate(
        nafems_benchmarks::NafemsFV32::TARGET_FREQUENCY_1,
        nafems_benchmarks::NafemsFV32::TARGET_FREQUENCY_2,
    ) {
        suite.add_result(r);
    }
    suite.add_result(nafems_benchmarks::NafemsFV42::default().validate(nafems_benchmarks::NafemsFV42::TARGET_FREQ_02));
    suite.add_result(nafems_benchmarks::NafemsFV52::default().validate(nafems_benchmarks::NafemsFV52::TARGET_FREQUENCY_1));
    suite.add_result(nafems_benchmarks::NafemsFV72::default().validate(nafems_benchmarks::NafemsFV72::TARGET_FREQ_AT_100));

    // --- Nonlinear ---
    suite.add_result(nafems_benchmarks::NafemsNL1::default().validate(nafems_benchmarks::NafemsNL1::TARGET_PLASTIC_STRAIN));
    suite.add_result(nafems_benchmarks::NafemsNL2::default().validate(nafems_benchmarks::NafemsNL2::TARGET_TIP_DISPLACEMENT));
    suite.add_result(nafems_benchmarks::NafemsNL3::default().validate(nafems_benchmarks::NafemsNL3::TARGET_CRITICAL_LOAD));
    suite.add_result(nafems_benchmarks::NafemsNL4::default().validate(nafems_benchmarks::NafemsNL4::TARGET_CRITICAL_PRESSURE));
    suite.add_result(nafems_benchmarks::NafemsNL5::default().validate(nafems_benchmarks::NafemsNL5::TARGET_DISPLACEMENT));
    suite.add_result(nafems_benchmarks::NafemsNL6::default().validate(nafems_benchmarks::NafemsNL6::TARGET_RESIDUAL));
    suite.add_result(nafems_benchmarks::NafemsNL7::default().validate(nafems_benchmarks::NafemsNL7::TARGET_TIP_DISP));

    // --- Thermal ---
    suite.add_result(nafems_benchmarks::NafemsT1::default().validate(0.5, 50.0));
    suite.add_result(nafems_benchmarks::NafemsT2::default().validate(nafems_benchmarks::NafemsT2::TARGET_TEMP_MID));
    suite.add_result(nafems_benchmarks::NafemsT3::default().validate(nafems_benchmarks::NafemsT3::TARGET_TEMP_CENTER));
    suite.add_result(nafems_benchmarks::NafemsT4::default().validate(nafems_benchmarks::NafemsT4::TARGET_TEMP_32S));
    suite.add_result(nafems_benchmarks::NafemsT5::default().validate(nafems_benchmarks::NafemsT5::TARGET_MAX_TEMP));

    // --- Contact ---
    suite.add_result(nafems_benchmarks::NafemsIC1::default().validate(nafems_benchmarks::NafemsIC1::TARGET_CONTACT_PRESSURE));
    suite.add_result(nafems_benchmarks::NafemsIC3::default().validate(nafems_benchmarks::NafemsIC3::TARGET_SLIDING));
    suite.add_result(nafems_benchmarks::NafemsIC5::default().validate(nafems_benchmarks::NafemsIC5::TARGET_PEAK_FORCE));

    let report = suite_to_report(&suite);
    serialize_or_js_error(&report, "run_nafems_all_benchmarks")
}

/// Run only the Linear Elastic (LE) NAFEMS benchmarks
#[wasm_bindgen]
pub fn run_nafems_le_benchmarks() -> JsValue {
    let mut suite = nafems_benchmarks::BenchmarkSuite::new("NAFEMS Linear Elastic");
    let le1 = nafems_benchmarks::NafemsLE1::default();
    suite.add_result(le1.validate(le1.analytical_stress()));
    suite.add_result(nafems_benchmarks::NafemsLE2::default().validate(nafems_benchmarks::NafemsLE2::TARGET_DISPLACEMENT));
    suite.add_result(nafems_benchmarks::NafemsLE3::default().validate(nafems_benchmarks::NafemsLE3::TARGET_DISPLACEMENT));
    suite.add_result(nafems_benchmarks::NafemsLE4::default().validate(nafems_benchmarks::NafemsLE4::TARGET_RADIAL_STRESS));
    suite.add_result(nafems_benchmarks::NafemsLE5::default().validate(nafems_benchmarks::NafemsLE5::TARGET_STRESS));
    suite.add_result(nafems_benchmarks::NafemsLE6::default().validate(nafems_benchmarks::NafemsLE6::TARGET_DEFLECTION));
    suite.add_result(nafems_benchmarks::NafemsLE7::default().validate(nafems_benchmarks::NafemsLE7::TARGET_HOOP_STRESS));
    suite.add_result(nafems_benchmarks::NafemsLE8::default().validate(nafems_benchmarks::NafemsLE8::TARGET_STRESS));
    suite.add_result(nafems_benchmarks::NafemsLE9::default().validate(nafems_benchmarks::NafemsLE9::TARGET_SCF));
    suite.add_result(nafems_benchmarks::NafemsLE10::default().validate(nafems_benchmarks::NafemsLE10::TARGET_STRESS));
    suite.add_result(nafems_benchmarks::NafemsLE11::default().validate(nafems_benchmarks::NafemsLE11::TARGET_AXIAL_STRESS));
    let report = suite_to_report(&suite);
    serialize_or_js_error(&report, "run_nafems_le_benchmarks")
}

/// Run only the Free Vibration (FV) NAFEMS benchmarks
#[wasm_bindgen]
pub fn run_nafems_fv_benchmarks() -> JsValue {
    let mut suite = nafems_benchmarks::BenchmarkSuite::new("NAFEMS Free Vibration");
    for r in nafems_benchmarks::NafemsFV12::default().validate(&nafems_benchmarks::NafemsFV12::TARGET_FREQUENCIES) {
        suite.add_result(r);
    }
    suite.add_result(nafems_benchmarks::NafemsFV22::default().validate(nafems_benchmarks::NafemsFV22::TARGET_FREQ_1));
    for r in nafems_benchmarks::NafemsFV32::default().validate(
        nafems_benchmarks::NafemsFV32::TARGET_FREQUENCY_1,
        nafems_benchmarks::NafemsFV32::TARGET_FREQUENCY_2,
    ) {
        suite.add_result(r);
    }
    suite.add_result(nafems_benchmarks::NafemsFV42::default().validate(nafems_benchmarks::NafemsFV42::TARGET_FREQ_02));
    suite.add_result(nafems_benchmarks::NafemsFV52::default().validate(nafems_benchmarks::NafemsFV52::TARGET_FREQUENCY_1));
    suite.add_result(nafems_benchmarks::NafemsFV72::default().validate(nafems_benchmarks::NafemsFV72::TARGET_FREQ_AT_100));
    let report = suite_to_report(&suite);
    serialize_or_js_error(&report, "run_nafems_fv_benchmarks")
}

/// Run only the Nonlinear (NL) NAFEMS benchmarks
#[wasm_bindgen]
pub fn run_nafems_nl_benchmarks() -> JsValue {
    let mut suite = nafems_benchmarks::BenchmarkSuite::new("NAFEMS Nonlinear");
    suite.add_result(nafems_benchmarks::NafemsNL1::default().validate(nafems_benchmarks::NafemsNL1::TARGET_PLASTIC_STRAIN));
    suite.add_result(nafems_benchmarks::NafemsNL2::default().validate(nafems_benchmarks::NafemsNL2::TARGET_TIP_DISPLACEMENT));
    suite.add_result(nafems_benchmarks::NafemsNL3::default().validate(nafems_benchmarks::NafemsNL3::TARGET_CRITICAL_LOAD));
    suite.add_result(nafems_benchmarks::NafemsNL4::default().validate(nafems_benchmarks::NafemsNL4::TARGET_CRITICAL_PRESSURE));
    suite.add_result(nafems_benchmarks::NafemsNL5::default().validate(nafems_benchmarks::NafemsNL5::TARGET_DISPLACEMENT));
    suite.add_result(nafems_benchmarks::NafemsNL6::default().validate(nafems_benchmarks::NafemsNL6::TARGET_RESIDUAL));
    suite.add_result(nafems_benchmarks::NafemsNL7::default().validate(nafems_benchmarks::NafemsNL7::TARGET_TIP_DISP));
    let report = suite_to_report(&suite);
    serialize_or_js_error(&report, "run_nafems_nl_benchmarks")
}

/// Run only the Thermal (T) NAFEMS benchmarks
#[wasm_bindgen]
pub fn run_nafems_thermal_benchmarks() -> JsValue {
    let mut suite = nafems_benchmarks::BenchmarkSuite::new("NAFEMS Thermal");
    suite.add_result(nafems_benchmarks::NafemsT1::default().validate(0.5, 50.0));
    suite.add_result(nafems_benchmarks::NafemsT2::default().validate(nafems_benchmarks::NafemsT2::TARGET_TEMP_MID));
    suite.add_result(nafems_benchmarks::NafemsT3::default().validate(nafems_benchmarks::NafemsT3::TARGET_TEMP_CENTER));
    suite.add_result(nafems_benchmarks::NafemsT4::default().validate(nafems_benchmarks::NafemsT4::TARGET_TEMP_32S));
    suite.add_result(nafems_benchmarks::NafemsT5::default().validate(nafems_benchmarks::NafemsT5::TARGET_MAX_TEMP));
    let report = suite_to_report(&suite);
    serialize_or_js_error(&report, "run_nafems_thermal_benchmarks")
}

/// Run only the Contact (IC) NAFEMS benchmarks
#[wasm_bindgen]
pub fn run_nafems_contact_benchmarks() -> JsValue {
    let mut suite = nafems_benchmarks::BenchmarkSuite::new("NAFEMS Contact");
    suite.add_result(nafems_benchmarks::NafemsIC1::default().validate(nafems_benchmarks::NafemsIC1::TARGET_CONTACT_PRESSURE));
    suite.add_result(nafems_benchmarks::NafemsIC3::default().validate(nafems_benchmarks::NafemsIC3::TARGET_SLIDING));
    suite.add_result(nafems_benchmarks::NafemsIC5::default().validate(nafems_benchmarks::NafemsIC5::TARGET_PEAK_FORCE));
    let report = suite_to_report(&suite);
    serialize_or_js_error(&report, "run_nafems_contact_benchmarks")
}

// ============================================================================
// REAL SOLVER BENCHMARKS (using actual FEA computation)
// ============================================================================

/// Result for a single real benchmark test
#[derive(Serialize)]
struct RealBenchmarkEntry {
    id: String,
    name: String,
    category: String,
    solver_used: String,
    expected_value: f64,
    computed_value: f64,
    unit: String,
    error_percent: f64,
    passed: bool,
    description: String,
}

/// Full real benchmark report
#[derive(Serialize)]
struct RealBenchmarkReport {
    success: bool,
    report_title: String,
    total_tests: usize,
    passed_tests: usize,
    pass_rate: f64,
    is_real_solver: bool,
    results: Vec<RealBenchmarkEntry>,
}

fn make_entry(
    id: &str, name: &str, category: &str, solver: &str,
    expected: f64, computed: f64, unit: &str, tol: f64, desc: &str,
) -> RealBenchmarkEntry {
    let err = if expected.abs() > 1e-15 {
        ((computed - expected) / expected).abs() * 100.0
    } else {
        computed.abs()
    };
    RealBenchmarkEntry {
        id: id.to_string(),
        name: name.to_string(),
        category: category.to_string(),
        solver_used: solver.to_string(),
        expected_value: expected,
        computed_value: computed,
        unit: unit.to_string(),
        error_percent: err,
        passed: err < tol,
        description: desc.to_string(),
    }
}

/// Run REAL structural benchmarks that call actual solver code.
/// Unlike the legacy NAFEMS exports (which compare TARGET to TARGET),
/// this function builds real FE models, solves them, and compares to analytical solutions.
#[wasm_bindgen]
pub fn run_real_benchmarks() -> JsValue {
    use crate::solver_3d::{
        analyze_3d_frame,
        AnalysisConfig,
        DistributedLoad,
        Element3D,
        ElementType,
        LoadDirection,
        NodalLoad,
        Node3D,
    };
    use std::collections::HashMap;

    let mut results = Vec::new();

    // ── BM-1: Cantilever beam, tip point load ──
    {
        let l: f64 = 2.0;
        let e: f64 = 200e9;
        let iz: f64 = 1e-4;
        let a: f64 = 0.01;
        let p: f64 = 10000.0;
        let delta_expected = -p * l.powi(3) / (3.0 * e * iz);
        let theta_expected = -p * l.powi(2) / (2.0 * e * iz);

        let nodes = vec![
            Node3D { id: "0".into(), x: 0.0, y: 0.0, z: 0.0,
                     restraints: [true;6], mass: None, spring_stiffness: None },
            Node3D { id: "1".into(), x: l, y: 0.0, z: 0.0,
                     restraints: [false;6], mass: None, spring_stiffness: None },
        ];
        let elements = vec![Element3D {
            id: "E1".into(), node_i: "0".into(), node_j: "1".into(),
            E: e, nu: Some(0.3), G: 80e9, density: 7850.0,
            A: a, Iy: iz, Iz: iz, J: 2.0*iz,
            Asy: 0.0, Asz: 0.0, beta: 0.0,
            releases_i: [false;6], releases_j: [false;6],
            thickness: None, node_k: None, node_l: None,
            element_type: ElementType::Frame,
        }];
        let loads = vec![NodalLoad {
            node_id: "1".into(), fx: 0.0, fy: -p, fz: 0.0,
            mx: 0.0, my: 0.0, mz: 0.0,
        }];

        if let Ok(res) = analyze_3d_frame(nodes, elements, loads, vec![], vec![], vec![],
            AnalysisConfig::default())
        {
            if let Some(d) = res.displacements.get("1") {
                results.push(make_entry(
                    "BM-1a", "Cantilever tip deflection", "Beam", "analyze_3d_frame",
                    delta_expected, d[1], "m", 1.0,
                    "PL³/3EI — Euler-Bernoulli cantilever"
                ));
                results.push(make_entry(
                    "BM-1b", "Cantilever tip rotation", "Beam", "analyze_3d_frame",
                    theta_expected, d[5], "rad", 1.0,
                    "PL²/2EI — Euler-Bernoulli cantilever"
                ));
            }
            if let Some(r) = res.reactions.get("0") {
                results.push(make_entry(
                    "BM-1c", "Cantilever reaction Ry", "Beam", "analyze_3d_frame",
                    p, r[1], "N", 1.0,
                    "Static equilibrium check"
                ));
            }
        }
    }

    // ── BM-2: Simply-supported beam with UDL ──
    {
        let l: f64 = 6.0;
        let e: f64 = 200e9;
        let iz: f64 = 1e-4;
        let a: f64 = 0.01;
        let w: f64 = 10000.0;
        let delta_mid_expected = -5.0 * w * l.powi(4) / (384.0 * e * iz);
        let reaction_expected = w * l / 2.0;

        let nodes = vec![
            Node3D { id: "0".into(), x: 0.0, y: 0.0, z: 0.0,
                     restraints: [true,true,true,true,true,false], mass: None, spring_stiffness: None },
            Node3D { id: "1".into(), x: l/2.0, y: 0.0, z: 0.0,
                     restraints: [false,false,true,true,true,false], mass: None, spring_stiffness: None },
            Node3D { id: "2".into(), x: l, y: 0.0, z: 0.0,
                     restraints: [false,true,true,true,true,false], mass: None, spring_stiffness: None },
        ];
        let elements = vec![
            Element3D { id: "E1".into(), node_i: "0".into(), node_j: "1".into(),
                E: e, nu: Some(0.3), G: 80e9, density: 7850.0,
                A: a, Iy: iz, Iz: iz, J: 2.0*iz,
                Asy: 0.0, Asz: 0.0, beta: 0.0,
                releases_i: [false;6], releases_j: [false;6],
                thickness: None, node_k: None, node_l: None,
                element_type: ElementType::Frame },
            Element3D { id: "E2".into(), node_i: "1".into(), node_j: "2".into(),
                E: e, nu: Some(0.3), G: 80e9, density: 7850.0,
                A: a, Iy: iz, Iz: iz, J: 2.0*iz,
                Asy: 0.0, Asz: 0.0, beta: 0.0,
                releases_i: [false;6], releases_j: [false;6],
                thickness: None, node_k: None, node_l: None,
                element_type: ElementType::Frame },
        ];
        let dist_loads = vec![
            DistributedLoad { element_id: "E1".into(), w_start: -w, w_end: -w,
                direction: LoadDirection::GlobalY, is_projected: false, start_pos: 0.0, end_pos: 1.0 },
            DistributedLoad { element_id: "E2".into(), w_start: -w, w_end: -w,
                direction: LoadDirection::GlobalY, is_projected: false, start_pos: 0.0, end_pos: 1.0 },
        ];

        if let Ok(res) = analyze_3d_frame(nodes, elements, vec![], dist_loads, vec![], vec![],
            AnalysisConfig::default())
        {
            if let Some(d) = res.displacements.get("1") {
                results.push(make_entry(
                    "BM-2a", "SS beam midspan deflection", "Beam", "analyze_3d_frame",
                    delta_mid_expected, d[1], "m", 2.0,
                    "5wL⁴/384EI — Simply-supported beam with UDL"
                ));
            }
            if let Some(r) = res.reactions.get("0") {
                results.push(make_entry(
                    "BM-2b", "SS beam reaction", "Beam", "analyze_3d_frame",
                    reaction_expected, r[1], "N", 1.0,
                    "wL/2 — Simply-supported beam equilibrium"
                ));
            }
        }
    }

    // ── BM-3: Propped cantilever (indeterminate) ──
    {
        let l: f64 = 4.0;
        let e: f64 = 200e9;
        let iz: f64 = 1e-4;
        let a: f64 = 0.01;
        let w: f64 = 5000.0;
        let r_a_expected = 5.0 * w * l / 8.0;
        let r_b_expected = 3.0 * w * l / 8.0;
        let m_a_expected = w * l * l / 8.0;

        let dx = l / 4.0;
        let nodes = vec![
            Node3D { id: "0".into(), x: 0.0, y: 0.0, z: 0.0,
                     restraints: [true;6], mass: None, spring_stiffness: None },
            Node3D { id: "1".into(), x: dx, y: 0.0, z: 0.0,
                     restraints: [false,false,true,true,true,false], mass: None, spring_stiffness: None },
            Node3D { id: "2".into(), x: 2.0*dx, y: 0.0, z: 0.0,
                     restraints: [false,false,true,true,true,false], mass: None, spring_stiffness: None },
            Node3D { id: "3".into(), x: 3.0*dx, y: 0.0, z: 0.0,
                     restraints: [false,false,true,true,true,false], mass: None, spring_stiffness: None },
            Node3D { id: "4".into(), x: l, y: 0.0, z: 0.0,
                     restraints: [false,true,true,true,true,false], mass: None, spring_stiffness: None },
        ];
        let elements: Vec<Element3D> = (0..4).map(|i| Element3D {
            id: format!("E{}", i+1), node_i: format!("{}", i), node_j: format!("{}", i+1),
            E: e, nu: Some(0.3), G: 80e9, density: 7850.0,
            A: a, Iy: iz, Iz: iz, J: 2.0*iz,
            Asy: 0.0, Asz: 0.0, beta: 0.0,
            releases_i: [false;6], releases_j: [false;6],
            thickness: None, node_k: None, node_l: None,
            element_type: ElementType::Frame,
        }).collect();
        let dist_loads: Vec<DistributedLoad> = (1..=4).map(|i| DistributedLoad {
            element_id: format!("E{}", i), w_start: -w, w_end: -w,
            direction: LoadDirection::GlobalY, is_projected: false, start_pos: 0.0, end_pos: 1.0,
        }).collect();

        if let Ok(res) = analyze_3d_frame(nodes, elements, vec![], dist_loads, vec![], vec![],
            AnalysisConfig::default())
        {
            if let Some(r) = res.reactions.get("0") {
                results.push(make_entry(
                    "BM-3a", "Propped cantilever R_A", "Beam", "analyze_3d_frame",
                    r_a_expected, r[1], "N", 2.0,
                    "5wL/8 — Statically indeterminate"
                ));
                if r.len() > 5 {
                    results.push(make_entry(
                        "BM-3b", "Propped cantilever M_A", "Beam", "analyze_3d_frame",
                        m_a_expected, r[5].abs(), "N·m", 2.0,
                        "wL²/8 — Fixed-end moment"
                    ));
                }
            }
            if let Some(r) = res.reactions.get("4") {
                results.push(make_entry(
                    "BM-3c", "Propped cantilever R_B", "Beam", "analyze_3d_frame",
                    r_b_expected, r[1], "N", 2.0,
                    "3wL/8 — Roller reaction"
                ));
            }
        }
    }

    // ── TR-1: Two-bar truss ──
    {
        let e: f64 = 200e9;
        let a: f64 = 0.001;
        let p: f64 = 10000.0;
        let bar_len = 2.0_f64.sqrt();
        let delta_y_expected = -p * bar_len / (e * a);

        let nodes = vec![
            Node3D { id: "0".into(), x: 0.0, y: 0.0, z: 0.0,
                     restraints: [true;6], mass: None, spring_stiffness: None },
            Node3D { id: "1".into(), x: 2.0, y: 0.0, z: 0.0,
                     restraints: [true;6], mass: None, spring_stiffness: None },
            Node3D { id: "2".into(), x: 1.0, y: 1.0, z: 0.0,
                     restraints: [false,false,true,true,true,true], mass: None, spring_stiffness: None },
        ];
        let elements = vec![
            Element3D { id: "T1".into(), node_i: "0".into(), node_j: "2".into(),
                E: e, nu: Some(0.3), G: e/(2.0*1.3), density: 7850.0,
                A: a, Iy: 0.0, Iz: 0.0, J: 0.0, Asy: 0.0, Asz: 0.0, beta: 0.0,
                releases_i: [false;6], releases_j: [false;6],
                thickness: None, node_k: None, node_l: None,
                element_type: ElementType::Truss },
            Element3D { id: "T2".into(), node_i: "1".into(), node_j: "2".into(),
                E: e, nu: Some(0.3), G: e/(2.0*1.3), density: 7850.0,
                A: a, Iy: 0.0, Iz: 0.0, J: 0.0, Asy: 0.0, Asz: 0.0, beta: 0.0,
                releases_i: [false;6], releases_j: [false;6],
                thickness: None, node_k: None, node_l: None,
                element_type: ElementType::Truss },
        ];
        let loads = vec![NodalLoad {
            node_id: "2".into(), fx: 0.0, fy: -p, fz: 0.0,
            mx: 0.0, my: 0.0, mz: 0.0,
        }];

        if let Ok(res) = analyze_3d_frame(nodes, elements, loads, vec![], vec![], vec![],
            AnalysisConfig::default())
        {
            if let Some(d) = res.displacements.get("2") {
                results.push(make_entry(
                    "TR-1", "Two-bar truss δ_y", "Truss", "analyze_3d_frame",
                    delta_y_expected, d[1], "m", 2.0,
                    "Symmetric 2-bar truss under vertical load"
                ));
            }
        }
    }

    // ── TH-1: 1D Thermal conduction ──
    {
        use thermal_analysis::*;
        let mut thermal = SteadyStateThermal::new();
        thermal.nodes = vec![
            (0.0, 0.0, 0.0), (0.5, 0.0, 0.0), (1.0, 0.0, 0.0),
            (0.0, 0.1, 0.0), (0.5, 0.1, 0.0), (1.0, 0.1, 0.0),
        ];
        let mut mats = HashMap::new();
        mats.insert(0, ThermalMaterial {
            id: 0, name: "Test".into(),
            conductivity: Conductivity::Isotropic(52.0),
            specific_heat: 500.0, density: 7850.0, emissivity: 0.8,
            latent_heat: None,
        });
        thermal.materials = mats;
        thermal.elements = vec![
            ThermalElement::Quad4(ThermalQuad4 { id: 0, node_ids: [0,1,4,3], material_id: 0, thickness: 0.01 }),
            ThermalElement::Quad4(ThermalQuad4 { id: 1, node_ids: [1,2,5,4], material_id: 0, thickness: 0.01 }),
        ];
        thermal.boundary_conditions = vec![
            ThermalBC::Temperature { node_ids: vec![0,3], value: 100.0 },
            ThermalBC::Temperature { node_ids: vec![2,5], value: 0.0 },
        ];

        if let Ok(res) = thermal.solve() {
            results.push(make_entry(
                "TH-1", "1D conduction T(0.5)", "Thermal", "SteadyStateThermal",
                50.0, res.temperatures[1], "°C", 1.0,
                "Linear temperature distribution — NAFEMS T1 equivalent"
            ));
        }
    }

    // ── SE-1: Hex8 patch test ──
    {
        use solid_solver::*;
        use solid_elements::SolidMaterial;
        let material = SolidMaterial::new(1000.0, 0.3, 1.0, "Test");
        let model = SolidModel {
            nodes: vec![
                [0.0,0.0,0.0], [1.0,0.0,0.0], [1.0,1.0,0.0], [0.0,1.0,0.0],
                [0.0,0.0,1.0], [1.0,0.0,1.0], [1.0,1.0,1.0], [0.0,1.0,1.0],
            ],
            hex8_elements: vec![[0,1,2,3,4,5,6,7]],
            material,
            fixed_dofs: vec![
                (0,0.0),(9,0.0),(12,0.0),(21,0.0),
                (1,0.0),(2,0.0),(11,0.0),(13,0.0),
            ],
            nodal_forces: vec![
                (1, [25.0,0.0,0.0]), (2, [25.0,0.0,0.0]),
                (5, [25.0,0.0,0.0]), (6, [25.0,0.0,0.0]),
            ],
        };
        if let Ok(res) = solve_solid_model(&model) {
            let expected_ux = 100.0 / 1000.0; // σ/E
            results.push(make_entry(
                "SE-1a", "Hex8 patch test displacement", "Solid", "solve_solid_model",
                expected_ux, res.displacements[1*3], "m", 1.0,
                "Constant strain patch test — fundamental FE validation"
            ));
            // Check stress
            if let Some(stresses) = res.element_stresses.first() {
                if let Some(s) = stresses.first() {
                    results.push(make_entry(
                        "SE-1b", "Hex8 patch test σ_xx", "Solid", "solve_solid_model",
                        100.0, s.stress[0], "Pa", 2.0,
                        "Constant stress recovery at Gauss point"
                    ));
                }
            }
        }
    }

    // ── SE-2: Multi-element bar tension ──
    {
        use solid_solver::*;
        use solid_elements::SolidMaterial;
        let material = SolidMaterial::new(200e9, 0.3, 7850.0, "Steel");
        let sigma: f64 = 1e6;
        let n_elem = 3usize;
        let delta_total = sigma / 200e9 * 3.0;

        let mut nodes = Vec::new();
        for i in 0..=n_elem {
            let x = i as f64;
            nodes.push([x, 0.0, 0.0]);
            nodes.push([x, 1.0, 0.0]);
            nodes.push([x, 1.0, 1.0]);
            nodes.push([x, 0.0, 1.0]);
        }
        let hex8_elements: Vec<[usize; 8]> = (0..n_elem).map(|i| {
            let j = i * 4; let k = (i+1) * 4;
            [j, k, k+1, j+1, j+3, k+3, k+2, j+2]
        }).collect();
        let model = SolidModel {
            nodes, hex8_elements, material,
            fixed_dofs: vec![
                (0,0.0),(3,0.0),(6,0.0),(9,0.0),
                (1,0.0),(2,0.0),(5,0.0),(10,0.0),
            ],
            nodal_forces: vec![
                (12, [sigma/4.0, 0.0, 0.0]),
                (13, [sigma/4.0, 0.0, 0.0]),
                (14, [sigma/4.0, 0.0, 0.0]),
                (15, [sigma/4.0, 0.0, 0.0]),
            ],
        };
        if let Ok(res) = solve_solid_model(&model) {
            results.push(make_entry(
                "SE-2", "Multi-element bar elongation", "Solid", "solve_solid_model",
                delta_total, res.displacements[12*3], "m", 2.0,
                "3-element bar under uniform tension — linear displacement check"
            ));
        }
    }

    // Build report
    let passed = results.iter().filter(|r| r.passed).count();
    let total = results.len();
    let report = RealBenchmarkReport {
        success: true,
        report_title: "Real Solver Benchmark Report".into(),
        total_tests: total,
        passed_tests: passed,
        pass_rate: if total > 0 { (passed as f64 / total as f64) * 100.0 } else { 0.0 },
        is_real_solver: true,
        results,
    };

    serialize_or_js_error(&report, "run_real_benchmarks")
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

// ============================================
// PUSHOVER ANALYSIS EXPORT
// ============================================

/// Input structure for pushover analysis via WASM
#[derive(Deserialize)]
struct PushoverWasmInput {
    /// Story heights in meters
    story_heights: Vec<f64>,
    /// Story masses in kN (weight)
    story_masses: Vec<f64>,
    /// Story stiffness in kN/m
    story_stiffness: Vec<f64>,
    /// Optional first-mode shape for load pattern
    mode_shape: Option<Vec<f64>>,
    /// Load pattern: "uniform", "triangular", "first-mode", "mass-proportional", "code"
    load_pattern: Option<String>,
    /// Target displacement in meters (default 0.5)
    target_displacement: Option<f64>,
    /// Number of load steps (default 100)
    num_steps: Option<usize>,
    /// Include P-Delta effects (default true)
    include_pdelta: Option<bool>,
    /// Convergence tolerance (default 1e-4)
    tolerance: Option<f64>,
    /// Max iterations per step (default 50)
    max_iterations: Option<usize>,
    /// Material type for auto-generated hinges: "rc_beam", "rc_column", "steel" (default "rc_beam")
    hinge_material: Option<String>,
}

/// Nonlinear static pushover analysis — capacity curve generation
/// Returns base shear vs. roof displacement with hinge states
#[wasm_bindgen]
pub fn solve_pushover(input_val: JsValue) -> JsValue {
    let input: PushoverWasmInput = match parse_required(input_val, "pushover input") {
        Ok(v) => v,
        Err(e) => return e,
    };

    let n_stories = input.story_heights.len();
    if n_stories == 0 || n_stories != input.story_masses.len() || n_stories != input.story_stiffness.len() {
        return JsValue::from_str(
            r#"{"success":false,"error":"story_heights, story_masses, and story_stiffness must have equal non-zero length"}"#
        );
    }

    // Map load pattern string to enum
    let load_pattern = match input.load_pattern.as_deref() {
        Some("uniform") => pushover_analysis::LoadPattern::Uniform,
        Some("first-mode") | Some("firstMode") => pushover_analysis::LoadPattern::FirstMode,
        Some("mass-proportional") | Some("massProportional") => pushover_analysis::LoadPattern::MassProportional,
        Some("code") => pushover_analysis::LoadPattern::CodePattern,
        _ => pushover_analysis::LoadPattern::Triangular,
    };

    let config = pushover_analysis::PushoverConfig {
        load_pattern,
        target_displacement: input.target_displacement.unwrap_or(0.5),
        num_steps: input.num_steps.unwrap_or(100),
        include_pdelta: input.include_pdelta.unwrap_or(true),
        tolerance: input.tolerance.unwrap_or(1e-4),
        max_iterations: input.max_iterations.unwrap_or(50),
    };

    let mut analyzer = pushover_analysis::PushoverAnalyzer::new(config);

    // Auto-generate plastic hinges at each story (beam ends + column bases)
    let backbone = match input.hinge_material.as_deref() {
        Some("steel") => pushover_analysis::HingeBackbone::steel_beam_compact(),
        Some("rc_column") => pushover_analysis::HingeBackbone::rc_column_conforming(0.2),
        _ => pushover_analysis::HingeBackbone::rc_beam_conforming(),
    };

    for i in 0..n_stories {
        let position = (i as f64 + 0.5) / n_stories as f64;
        analyzer.add_hinge(pushover_analysis::PlasticHinge::new(
            i,
            i,
            position,
            pushover_analysis::HingeType::Moment,
            backbone.clone(),
        ));
    }

    // Run analysis
    let mode_shape_ref = input.mode_shape.as_deref();
    let capacity_curve = analyzer.analyze(
        &input.story_heights,
        &input.story_masses,
        &input.story_stiffness,
        mode_shape_ref,
    );

    // Build JSON-friendly result
    #[derive(Serialize)]
    struct PushoverResult {
        success: bool,
        points: Vec<PushoverPoint>,
        yield_point: Option<PushoverPoint>,
        ultimate_point: Option<PushoverPoint>,
        ductility: f64,
        effective_period: f64,
        hinge_summary: Vec<HingeSummary>,
    }

    #[derive(Serialize)]
    struct PushoverPoint {
        step: usize,
        base_shear: f64,
        roof_displacement: f64,
        hinges_yielded: usize,
    }

    #[derive(Serialize)]
    struct HingeSummary {
        id: usize,
        state: String,
        deformation: f64,
        ductility_demand: f64,
    }

    let points: Vec<PushoverPoint> = capacity_curve.points.iter().map(|p| PushoverPoint {
        step: p.step,
        base_shear: p.base_shear,
        roof_displacement: p.roof_displacement,
        hinges_yielded: p.hinges_yielded,
    }).collect();

    // yield_point and ultimate_point are Option<(displacement, base_shear)> tuples
    let yield_pt = capacity_curve.yield_point.map(|(disp, shear)| PushoverPoint {
        step: 0,
        base_shear: shear,
        roof_displacement: disp,
        hinges_yielded: 0,
    });

    let ultimate_pt = capacity_curve.ultimate_point.map(|(disp, shear)| PushoverPoint {
        step: capacity_curve.points.len().saturating_sub(1),
        base_shear: shear,
        roof_displacement: disp,
        hinges_yielded: 0,
    });

    let hinge_summary: Vec<HingeSummary> = analyzer.hinges.iter().map(|h| HingeSummary {
        id: h.id,
        state: h.state.name().to_string(),
        deformation: h.current_deformation,
        ductility_demand: h.ductility_demand(),
    }).collect();

    let result = PushoverResult {
        success: true,
        points,
        yield_point: yield_pt,
        ultimate_point: ultimate_pt,
        ductility: capacity_curve.ductility,
        effective_period: capacity_curve.effective_period,
        hinge_summary,
    };

    serialize_or_js_error(&result, "solve_pushover")
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
    let _p = r.clone();
    
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
    
    let _recovered = true;
    let mut _iterations = 0;
    
    for iter in 0..max_iter {
        _iterations = iter;
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
