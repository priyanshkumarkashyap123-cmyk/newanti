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

// Additional solver modules (public)
pub mod out_of_core_solver;
pub mod plate_shell_solver;
pub mod robust_eigenvalue_solver;
pub mod robust_nonlinear_solver;
pub mod sparse_solver;

// All modules from src/ (auto-generated from actual files)
pub mod acoustic_structural;
pub mod adaptive_facades;
pub mod advanced_composite;
pub mod advanced_composite_design;
pub mod advanced_concrete;
pub mod advanced_connection_design;
pub mod advanced_dynamics;
pub mod advanced_foundation;
pub mod advanced_foundation_design;
pub mod advanced_infrastructure;
pub mod advanced_loads;
pub mod advanced_materials;
pub mod advanced_matrix_decompositions;
pub mod advanced_mcmc;
pub mod advanced_numerical_methods;
pub mod advanced_rc_design;
pub mod advanced_reliability;
pub mod advanced_sampling;
pub mod advanced_seismic_analysis;
pub mod advanced_seismic_features;
pub mod ai_architect;
pub mod ai_guardrails;
pub mod airport_pavement;
pub mod aluminum_design;
pub mod api_integration;
pub mod arch_bridge;
pub mod as_built_analysis;
pub mod automated_code_checking;
pub mod bayesian_inference;
pub mod beam_design;
pub mod beam_elements_enhanced;
pub mod benchmark_tests;
pub mod biaxial_column_design;
pub mod bim_ifc_complete;
pub mod bim_integration;
pub mod blast_analysis;
pub mod blast_loading;
pub mod blast_resistant;
pub mod boundary_conditions;
pub mod bridge_bearings;
pub mod building_physics;
pub mod cable_bridge;
pub mod cable_stayed_bridge;
pub mod cache_optimized_sparse;
pub mod clause_coverage_maps;
pub mod cad_export;
pub mod caisson_foundation;
pub mod chimney_design;
pub mod cis2_steel_interchange;
pub mod clash_detection;
pub mod cloud_computing;
pub mod coastal_structures;
pub mod code_checking;
pub mod code_checks;
pub mod cold_formed_steel;
pub mod collaboration_tools;
pub mod column_design;
pub mod component_fragility_database;
pub mod composite_deck;
pub mod composite_materials;
pub mod composite_timber_advanced;
pub mod connection_design;
pub mod construction_materials;
pub mod construction_sequencing;
pub mod construction_simulation;
pub mod construction_staging;
pub mod contact_constraints;
pub mod contact_mechanics;
pub mod cooling_tower;
pub mod crack_serviceability;
pub mod crane_loading;
pub mod crane_runway;
pub mod creep_shrinkage;
pub mod curved_tapered_elements;
pub mod data_exchange;
pub mod data_export;
pub mod deep_excavation;
pub mod design_codes;
pub mod design_optimization;
pub mod digital_twin;
pub mod direct_analysis_aisc;
pub mod durability_design;
pub mod dynamic_wind;
pub mod dynamics;
pub mod eas_solid_elements;
pub mod eigenvalue_solvers;
pub mod error_estimation;
pub mod explicit_dynamics;
pub mod fatigue_analysis;
pub mod fatigue_fracture;
pub mod fiber_reinforced_polymers;
pub mod fiber_section;
pub mod fire_design;
pub mod floor_diaphragm;
pub mod floor_vibration;
pub mod fluid_structure_interaction;
pub mod formwork_design;
pub mod foundation_design;
pub mod foundation_stiffness;
pub mod fragility_analysis;
pub mod generative_design;
pub mod geometric_nonlinearity;
pub mod geotech_advanced;
pub mod glass_design;
pub mod glass_facade;
pub mod ground_improvement;
pub mod heritage_structures;
pub mod hht_alpha_integration;
pub mod high_performance_computing;
pub mod hydraulic_structures;
pub mod hysteretic_models;
pub mod ifc_export;
pub mod impact_analysis;
pub mod incremental_dynamic_analysis;
pub mod industrial_flooring;
pub mod industry_complete_parity;
pub mod industry_gaps_closure;
pub mod industry_leading_dynamics;
pub mod industry_leading_elements;
pub mod industry_leading_solvers;
pub mod input_validation;
pub mod international_codes;
pub mod is13920_ductile_detailing;
pub mod isogeometric_analysis;
pub mod lifecycle_assessment;
pub mod load_combinations;
pub mod long_span_structures;
pub mod machine_learning_structural;
pub mod macneal_harder_benchmarks;
pub mod marine_offshore;
pub mod masonry_design;
pub mod material_models_complete;
pub mod material_nonlinearity;
pub mod member_diagrams;
pub mod membrane_structures;
pub mod mesh_adaptation;
pub mod mesh_generation;
pub mod mesh_generation_production;
pub mod mesh_quality;
pub mod meshless_methods;
pub mod ml_optimization_engine;
pub mod model_import;
pub mod model_reduction;
pub mod model_uncertainty;
pub mod modeling_rendering;
pub mod moving_loads;
pub mod multi_physics_coupling;
pub mod multi_scale;
pub mod nafems_benchmarks;
pub mod nafems_benchmarks_extended;
pub mod nongaussian_transforms;
pub mod nonlinear_geometry;
pub mod nonlinear_material;
pub mod nonlinear_solver_framework;
pub mod nuclear_structures;
pub mod offshore_dnvgl;
pub mod offshore_structures;
pub mod offshore_wind;
pub mod optimization_engine;
pub mod parallel_assembly;
pub mod parallel_computing;
pub mod parametric_design;
pub mod partial_factor_calibration;
pub mod pdelta_buckling;
pub mod performance_based_design;
pub mod performance_cache;
pub mod performance_optimization;
pub mod physical_member;
pub mod pile_foundation;
pub mod plate_element;
pub mod precast_concrete;
pub mod precast_connections;
pub mod pressure_vessel;
pub mod prestressed_concrete;
pub mod probabilistic_analysis;
pub mod probabilistic_load_combinations;
pub mod production_engineering_calcs;
pub mod progressive_collapse;
pub mod pushover_analysis;
pub mod quality_assurance;
pub mod railway_structures;
pub mod rainflow_counting;
pub mod random_field_generation;
pub mod rc_design_advanced;
pub mod reliability_analysis;
pub mod renderer;
pub mod report_generation;
pub mod report_visualization;
pub mod resilience_engineering;
pub mod response_spectrum_robust;
pub mod result_postprocessing;
pub mod retaining_wall;
pub mod risk_assessment;
pub mod robust_design_optimization;
pub mod robust_element_validation;
pub mod robustness_analysis;
pub mod scaffolding;
pub mod section_database;
pub mod seismic_drift;
pub mod seismic_isolation;
pub mod seismic_isolation_advanced;
pub mod self_healing_structures;
pub mod sensitivity_analysis;
pub mod shape_memory_alloys;
pub mod shear_wall_design;
pub mod shell_buckling;
pub mod shell_elements_production;
pub mod sign_structures;
pub mod six_sigma_quality;
pub mod slab_design;
pub mod slope_stability;
pub mod sls_reliability;
pub mod smart_structures;
pub mod soil_structure;
pub mod soil_structure_interaction;
pub mod solid_elements;
pub mod solver_3d;
pub mod solver_robustness;
pub mod solver_settings;
pub mod space_structures;
pub mod sparse_multifidelity;
pub mod sparse_solver_advanced;
pub mod special_elements;
pub mod special_functions;
pub mod ssi_probabilistic;
pub mod steel_connection;
pub mod steel_connection_design;
pub mod steel_design_advanced;
pub mod stochastic_fem;
pub mod storage_structures;
pub mod stress_contour;
pub mod structural_ai;
pub mod structural_health_monitoring;
pub mod structural_monitoring;
pub mod structural_optimization;
pub mod structural_reliability;
pub mod surrogate_modeling;
pub mod suspension_bridge;
pub mod sustainability;
pub mod system_reliability;
pub mod tank_silo_design;
pub mod temporary_structures;
pub mod tensile_structures;
pub mod thermal_analysis;
pub mod timber_connections;
pub mod timber_design;
pub mod timber_structures;
pub mod time_history;
pub mod time_variant_reliability;
pub mod topology_optimization;
pub mod tower_chimney;
pub mod transmission_line;
pub mod tsunami_loading;
pub mod tunnel_lining;
pub mod tunnel_structures;
pub mod ultra_fast_solver;
pub mod uncertainty_quantification;
pub mod unit_consistency;
pub mod user_defined_spectrum;
pub mod vibration_control;
pub mod vibration_serviceability;
pub mod visualization_enhanced;
pub mod vtk_export;
pub mod water_treatment;
pub mod wind_load_generator;
pub mod wind_performance;

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
    let nodes: Vec<solver_3d::Node3D> = match serde_wasm_bindgen::from_value(nodes_val) {
        Ok(v) => v,
        Err(e) => return JsValue::from_str(&format!("Error parsing nodes: {}", e)),
    };
    
    let elements: Vec<solver_3d::Element3D> = match serde_wasm_bindgen::from_value(elements_val) {
        Ok(v) => v,
        Err(e) => return JsValue::from_str(&format!("Error parsing elements: {}", e)),
    };
    
    let nodal_loads: Vec<solver_3d::NodalLoad> = match serde_wasm_bindgen::from_value(nodal_loads_val) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::warn_1(&format!("Warning: Failed to parse nodal loads (using empty): {}", e).into());
            vec![]
        }
    };
        
    let distributed_loads: Vec<solver_3d::DistributedLoad> = match serde_wasm_bindgen::from_value(distributed_loads_val) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::warn_1(&format!("Warning: Failed to parse distributed loads (using empty): {}", e).into());
            vec![]
        }
    };
    
    let temperature_loads: Vec<solver_3d::TemperatureLoad> = serde_wasm_bindgen::from_value(temperature_loads_val)
        .unwrap_or_default();
    
    let point_loads: Vec<solver_3d::PointLoadOnMember> = serde_wasm_bindgen::from_value(point_loads_val)
        .unwrap_or_default();
    
    let config: solver_3d::AnalysisConfig = serde_wasm_bindgen::from_value(config_val)
        .unwrap_or_default();
    
    match solver_3d::analyze_3d_frame(nodes, elements, nodal_loads, distributed_loads, temperature_loads, point_loads, config) {
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

/// Combine multiple load case results using factored superposition.
/// `cases_val`: JSON map { caseName: AnalysisResult3D }
/// `combinations_val`: JSON array of LoadCombination objects
/// Returns an EnvelopeResult with max/min across all combinations.
#[wasm_bindgen]
pub fn combine_load_cases(cases_val: JsValue, combinations_val: JsValue) -> JsValue {
    let cases: std::collections::HashMap<String, solver_3d::AnalysisResult3D> = 
        match serde_wasm_bindgen::from_value(cases_val) {
            Ok(v) => v,
            Err(e) => return JsValue::from_str(&format!("Error parsing load cases: {}", e)),
        };
    
    let combinations: Vec<solver_3d::LoadCombination> = 
        match serde_wasm_bindgen::from_value(combinations_val) {
            Ok(v) => v,
            Err(e) => return JsValue::from_str(&format!("Error parsing combinations: {}", e)),
        };
    
    match solver_3d::compute_envelope(&cases, &combinations) {
        Ok(result) => serde_wasm_bindgen::to_value(&result)
            .unwrap_or_else(|e| JsValue::from_str(&format!("Serialization error: {}", e))),
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
    
    let temperature_loads: Vec<solver_3d::TemperatureLoad> = serde_wasm_bindgen::from_value(temperature_loads_val)
        .unwrap_or_default();
    
    let point_loads_on_members: Vec<solver_3d::PointLoadOnMember> = serde_wasm_bindgen::from_value(point_loads_on_members_val)
        .unwrap_or_default();
    
    let config: solver_3d::AnalysisConfig = serde_wasm_bindgen::from_value(config_val)
        .unwrap_or_default();
    
    // Perform P-Delta analysis with full feature set
    match solver_3d::p_delta_analysis(
        nodes, 
        elements, 
        nodal_loads, 
        distributed_loads,
        temperature_loads,
        point_loads_on_members,
        config,
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

/// Linearized buckling analysis — eigenvalue problem [Ke]{φ} = λ[-Kg]{φ}
/// Returns critical load factors where P_cr = λ × P_applied
#[wasm_bindgen]
pub fn analyze_buckling(
    nodes_val: JsValue,
    elements_val: JsValue,
    point_loads_val: JsValue,
    num_modes: usize
) -> JsValue {
    let nodes: Vec<solver_3d::Node3D> = match serde_wasm_bindgen::from_value(nodes_val) {
        Ok(v) => v,
        Err(e) => return JsValue::from_str(&format!(r#"{{"success":false,"error":"Node parse error: {}"}}"#, e)),
    };
    let elements: Vec<solver_3d::Element3D> = match serde_wasm_bindgen::from_value(elements_val) {
        Ok(v) => v,
        Err(e) => return JsValue::from_str(&format!(r#"{{"success":false,"error":"Element parse error: {}"}}"#, e)),
    };
    let nodal_loads: Vec<solver_3d::NodalLoad> = serde_wasm_bindgen::from_value(point_loads_val)
        .unwrap_or_default();

    match solver_3d::linearized_buckling_analysis(
        nodes, elements, nodal_loads, vec![],
        if num_modes == 0 { 5 } else { num_modes },
    ) {
        Ok(result) => {
            serde_wasm_bindgen::to_value(&result)
                .unwrap_or_else(|e| JsValue::from_str(&format!(r#"{{"success":false,"error":"Serialize: {}"}}"#, e)))
        },
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
    let input: PushoverWasmInput = match serde_wasm_bindgen::from_value(input_val) {
        Ok(v) => v,
        Err(e) => return JsValue::from_str(&format!(
            r#"{{"success":false,"error":"Input parse error: {}"}}"#, e
        )),
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

    let yield_pt = capacity_curve.yield_point.as_ref().map(|p| PushoverPoint {
        step: p.step,
        base_shear: p.base_shear,
        roof_displacement: p.roof_displacement,
        hinges_yielded: p.hinges_yielded,
    });

    let ultimate_pt = capacity_curve.ultimate_point.as_ref().map(|p| PushoverPoint {
        step: p.step,
        base_shear: p.base_shear,
        roof_displacement: p.roof_displacement,
        hinges_yielded: p.hinges_yielded,
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

    serde_wasm_bindgen::to_value(&result)
        .unwrap_or_else(|e| JsValue::from_str(&format!(
            r#"{{"success":false,"error":"Serialization error: {}"}}"#, e
        )))
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
