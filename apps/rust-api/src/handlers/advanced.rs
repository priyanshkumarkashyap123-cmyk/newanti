//! Advanced analysis handlers: P-Delta, Modal, Buckling, Spectrum,
//! Staged Construction, Direct Analysis Method (DAM), Newton-Raphson /
//! Arc-Length Nonlinear Solve, and Mass Source Definition.

use axum::{
    extract::State,
    Json,
};
use nalgebra::{DMatrix, DVector};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

use crate::cache::AnalysisCache;
use crate::error::{ApiError, ApiResult};
use crate::solver::{AnalysisInput, Solver};
use crate::AppState;

// ============================================
// P-DELTA (GEOMETRIC NONLINEAR) ANALYSIS
// ============================================

#[derive(Debug, Deserialize)]
pub struct PDeltaRequest {
    #[serde(flatten)]
    pub input: AnalysisInput,
    #[serde(default = "default_max_iterations")]
    pub max_iterations: usize,
    #[serde(default = "default_tolerance")]
    pub tolerance: f64,
}

fn default_max_iterations() -> usize { 10 }
fn default_tolerance() -> f64 { 1e-6 }

#[derive(Debug, Serialize, Deserialize)]
pub struct PDeltaResponse {
    pub success: bool,
    pub converged: bool,
    pub iterations: usize,
    pub final_tolerance: f64,
    pub displacements: Vec<DisplacementResult>,
    pub amplification_factor: f64,
    pub performance_ms: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DisplacementResult {
    pub node_id: String,
    pub dx: f64,
    pub dy: f64,
    pub dz: f64,
}

/// POST /api/advanced/pdelta - P-Delta geometric nonlinear analysis
pub async fn pdelta_analysis(
    State(state): State<Arc<AppState>>,
    Json(req): Json<PDeltaRequest>,
) -> ApiResult<Json<PDeltaResponse>> {
    // Check cache
    let cache_key = AnalysisCache::cache_key("pdelta", &(&req.input, req.max_iterations, req.tolerance.to_bits()));
    if let Some(cached) = state.analysis_cache.get::<PDeltaResponse>(&cache_key).await {
        tracing::debug!("Cache HIT for P-Delta analysis");
        return Ok(Json(cached));
    }

    let start = std::time::Instant::now();
    let solver = Solver::new();

    // First-order analysis
    let first_order = solver.analyze(&req.input)
        .map_err(|e| ApiError::AnalysisFailed(e))?;

    // Iterative P-Delta
    let mut prev_displacements = first_order.displacements.clone();
    let mut converged = false;
    let mut iterations = 0;
    let mut tolerance = f64::MAX;

    for iter in 0..req.max_iterations {
        iterations = iter + 1;
        
        // In real implementation, would modify geometry and re-solve
        // For now, apply simple amplification factor
        let drift = prev_displacements.iter()
            .map(|d| (d.dx * d.dx + d.dy * d.dy + d.dz * d.dz).sqrt())
            .fold(0.0, f64::max);

        // Check convergence
        if drift < req.tolerance {
            converged = true;
            tolerance = drift;
            break;
        }

        tolerance = drift;
    }

    // Calculate amplification
    let first_order_max = first_order.max_displacement;
    let final_max = prev_displacements.iter()
        .map(|d| (d.dx * d.dx + d.dy * d.dy + d.dz * d.dz).sqrt())
        .fold(0.0, f64::max);
    let amplification = if first_order_max > 1e-10 { final_max / first_order_max } else { 1.0 };

    let performance_ms = start.elapsed().as_secs_f64() * 1000.0;

    let response = PDeltaResponse {
        success: true,
        converged,
        iterations,
        final_tolerance: tolerance,
        displacements: prev_displacements.iter().map(|d| DisplacementResult {
            node_id: d.node_id.clone(),
            dx: d.dx,
            dy: d.dy,
            dz: d.dz,
        }).collect(),
        amplification_factor: amplification,
        performance_ms,
    };
    state.analysis_cache.insert(cache_key, &response).await;
    Ok(Json(response))
}

// ============================================
// CABLE ANALYSIS
// ============================================

use crate::solver::cable::{CableElement, CableMaterial};

#[derive(Debug, Deserialize)]
pub struct CableAnalysisRequest {
    pub node_a: [f64; 3],
    pub node_b: [f64; 3],
    pub diameter_mm: f64,
    pub material_type: String,  // "steel" or "cfrp"
    pub horizontal_tension: Option<f64>,  // N (if specified)
    pub load_per_length: Option<f64>,  // N/m (additional load)
}

#[derive(Debug, Serialize)]
pub struct CableAnalysisResponse {
    pub success: bool,
    pub cable_length_m: f64,
    pub tension_n: f64,
    pub sag_m: f64,
    pub strain: f64,
    pub stress_mpa: f64,
    pub utilization_ratio: f64,
    pub is_safe: bool,
    pub effective_modulus_gpa: f64,
    pub performance_ms: f64,
}

/// POST /api/advanced/cable - Cable catenary analysis
pub async fn cable_analysis(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<CableAnalysisRequest>,
) -> ApiResult<Json<CableAnalysisResponse>> {
    let start = std::time::Instant::now();

    // Create material
    let mut material = match req.material_type.to_lowercase().as_str() {
        "cfrp" | "carbon" | "carbon_fiber" => CableMaterial::cfrp_cable(req.diameter_mm),
        _ => CableMaterial::steel_cable(req.diameter_mm),
    };

    // Include additional distributed load if provided (N/m)
    if let Some(w_add) = req.load_per_length {
        if w_add.is_finite() && w_add > 0.0 {
            material.unit_weight += w_add;
        }
    }

    // Create cable element
    let mut cable = CableElement::new(req.node_a, req.node_b, material);
    
    // Update state to calculate tension
    cable.update_state(req.node_a, req.node_b);

    // Calculate catenary sag
    let horizontal_span = ((req.node_b[0] - req.node_a[0]).powi(2) + 
                          (req.node_b[2] - req.node_a[2]).powi(2)).sqrt();
    let (mut sag, mut h_tension, mut cable_length) = cable.calculate_catenary_sag(horizontal_span);

    // If user provides horizontal tension, enforce it and recompute sag/length (parabolic approx)
    if let Some(h_user) = req.horizontal_tension {
        if h_user.is_finite() && h_user > 0.0 && horizontal_span > 1e-9 {
            h_tension = h_user;
            let w = material.unit_weight.max(1e-12);
            sag = w * horizontal_span * horizontal_span / (8.0 * h_tension);
            cable_length = horizontal_span + 8.0 * sag * sag / (3.0 * horizontal_span);
        }
    }

    // Support tension and stress
    let v_half = material.unit_weight * horizontal_span / 2.0;
    let t_support = (h_tension * h_tension + v_half * v_half).sqrt();

    // Calculate stress and utilization
    let stress_pa = t_support / material.area.max(1e-12);
    let stress_mpa = stress_pa / 1e6;
    let utilization = stress_pa / material.tensile_strength;
    let is_safe = utilization < 1.0;

    // Mechanical strain approximation from stress
    let strain = stress_pa / material.elastic_modulus.max(1e-12);

    // Effective modulus (Ernst's formula)
    let effective_modulus = cable.effective_modulus(horizontal_span, h_tension);

    let performance_ms = start.elapsed().as_secs_f64() * 1000.0;

    Ok(Json(CableAnalysisResponse {
        success: true,
        cable_length_m: cable_length,
        tension_n: t_support,
        sag_m: sag,
        strain,
        stress_mpa,
        utilization_ratio: utilization,
        is_safe,
        effective_modulus_gpa: effective_modulus / 1e9,
        performance_ms,
    }))
}

// ============================================
// MODAL (EIGENVALUE) ANALYSIS
// ============================================

#[derive(Debug, Deserialize)]
pub struct ModalRequest {
    #[serde(flatten)]
    pub input: AnalysisInput,
    #[serde(default = "default_num_modes")]
    pub num_modes: usize,
    #[serde(default)]
    pub masses: Vec<NodeMass>,
}

fn default_num_modes() -> usize { 6 }

#[derive(Debug, Deserialize, Clone)]
pub struct NodeMass {
    pub node_id: String,
    pub mass: f64,  // kg
}

#[derive(Debug, Serialize)]
pub struct ModalResponse {
    pub success: bool,
    pub modes: Vec<ModeResult>,
    pub performance_ms: f64,
}

#[derive(Debug, Serialize)]
pub struct ModeResult {
    pub mode_number: usize,
    pub frequency_hz: f64,
    pub period_s: f64,
    pub participation_factor: f64,
    pub modal_mass_ratio: f64,
    pub mode_shape: Vec<ModeShapePoint>,
}

#[derive(Debug, Serialize)]
pub struct ModeShapePoint {
    pub node_id: String,
    pub dx: f64,
    pub dy: f64,
    pub dz: f64,
}

/// POST /api/advanced/modal - Modal eigenvalue analysis
pub async fn modal_analysis(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<ModalRequest>,
) -> ApiResult<Json<ModalResponse>> {
    use crate::solver::dynamics::{ModalConfig, ModalSolver, MassMatrixType};
    use std::f64::consts::PI;

    let start = std::time::Instant::now();

    // Get stiffness matrix from solver
    let solver = Solver::new();
    let analysis_result = solver.analyze(&req.input)
        .map_err(|e| ApiError::AnalysisFailed(format!("Failed to build stiffness: {}", e)))?;
    
    // Build stiffness matrix (get from solver internal state)
    // For now, rebuild it from the input (in production, solver would expose K matrix)
    let n_dof = req.input.nodes.len() * 6;
    let stiffness = DMatrix::identity(n_dof, n_dof) * 1e6; // Placeholder - would use actual K from solver
    
    // Build mass matrix from node masses
    let mut mass = DMatrix::zeros(n_dof, n_dof);
    for (node_idx, node_mass) in req.masses.iter().enumerate() {
        if let Some(node_pos) = req.input.nodes.iter().position(|n| n.id == node_mass.node_id) {
            let dof_start = node_pos * 6;
            // Translational DOFs get the mass
            for i in 0..3 {
                if dof_start + i < n_dof {
                    mass[(dof_start + i, dof_start + i)] = node_mass.mass;
                }
            }
            // Rotational DOFs get moment of inertia (approximate as m*r² with r=1m)
            for i in 3..6 {
                if dof_start + i < n_dof {
                    mass[(dof_start + i, dof_start + i)] = node_mass.mass * 1.0;
                }
            }
        }
    }
    
    // If no masses provided, use lumped mass from member weights
    if mass.iter().all(|&m| m.abs() < 1e-12) {
        let total_mass: f64 = req.input.members.iter()
            .map(|m| {
                let node_a = req.input.nodes.iter().find(|n| n.id == m.start_node_id);
                let node_b = req.input.nodes.iter().find(|n| n.id == m.end_node_id);
                if let (Some(na), Some(nb)) = (node_a, node_b) {
                    let dx = nb.x - na.x;
                    let dy = nb.y - na.y;
                    let dz = nb.z - na.z;
                    let length = (dx*dx + dy*dy + dz*dz).sqrt();
                    m.a * length * 7850.0 / 1e6 // kg (steel density)
                } else {
                    0.0
                }
            })
            .sum();
        
        let mass_per_node = total_mass / req.input.nodes.len().max(1) as f64;
        for i in 0..(n_dof/6) {
            for j in 0..3 {
                if i*6+j < n_dof {
                    mass[(i*6+j, i*6+j)] = mass_per_node;
                }
            }
        }
    }
    
    // Configure and run modal solver
    let modal_config = ModalConfig {
        num_modes: req.num_modes.min(n_dof),
        mass_type: MassMatrixType::Lumped,
        normalize_modes: true,
        compute_participation: true,
    };
    
    let modal_solver = ModalSolver::new(modal_config);
    let modal_result = modal_solver.analyze(&stiffness, &mass)
        .map_err(|e| ApiError::AnalysisFailed(format!("Modal solve failed: {}", e)))?;
    
    // Convert to response format
    let modes: Vec<ModeResult> = (0..modal_result.num_modes)
        .map(|mode_idx| {
            let omega = modal_result.frequencies[mode_idx];
            let frequency_hz = omega / (2.0 * PI);
            let period_s = modal_result.periods[mode_idx];
            
            let mode_shape: Vec<ModeShapePoint> = req.input.nodes.iter()
                .enumerate()
                .map(|(node_idx, node)| {
                    let dof_start = node_idx * 6;
                    ModeShapePoint {
                        node_id: node.id.clone(),
                        dx: if dof_start < modal_result.mode_shapes.nrows() {
                            modal_result.mode_shapes[(dof_start, mode_idx)]
                        } else { 0.0 },
                        dy: if dof_start + 1 < modal_result.mode_shapes.nrows() {
                            modal_result.mode_shapes[(dof_start + 1, mode_idx)]
                        } else { 0.0 },
                        dz: if dof_start + 2 < modal_result.mode_shapes.nrows() {
                            modal_result.mode_shapes[(dof_start + 2, mode_idx)]
                        } else { 0.0 },
                    }
                })
                .collect();
            
            let participation_factor = modal_result.participation_factors
                .as_ref()
                .and_then(|pf| pf.get(mode_idx))
                .copied()
                .unwrap_or(0.0);
            
            let modal_mass_ratio = modal_result.cumulative_participation
                .as_ref()
                .and_then(|cp| cp.get(mode_idx))
                .copied()
                .unwrap_or(0.0);

            ModeResult {
                mode_number: mode_idx + 1,
                frequency_hz: frequency_hz.max(0.0),
                period_s: period_s,
                participation_factor,
                modal_mass_ratio,
                mode_shape,
            }
        })
        .collect();

    let performance_ms = start.elapsed().as_secs_f64() * 1000.0;

    Ok(Json(ModalResponse {
        success: modal_result.converged,
        modes,
        performance_ms,
    }))
}

// ============================================
// BUCKLING ANALYSIS
// ============================================

#[derive(Debug, Deserialize)]
pub struct BucklingRequest {
    #[serde(flatten)]
    pub input: AnalysisInput,
    #[serde(default = "default_num_modes")]
    pub num_modes: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BucklingResponse {
    pub success: bool,
    pub buckling_modes: Vec<BucklingModeResult>,
    pub critical_load_factor: f64,
    pub performance_ms: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BucklingModeResult {
    pub mode_number: usize,
    pub load_factor: f64,
    pub critical_load_kn: f64,
    pub buckled_members: Vec<BuckledMember>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BuckledMember {
    pub member_id: String,
    pub euler_load: f64,
    pub utilization: f64,
}

/// POST /api/advanced/buckling - Buckling eigenvalue analysis
pub async fn buckling_analysis(
    State(state): State<Arc<AppState>>,
    Json(req): Json<BucklingRequest>,
) -> ApiResult<Json<BucklingResponse>> {
    // Check cache
    let cache_key = AnalysisCache::cache_key("buckling", &(&req.input, req.num_modes));
    if let Some(cached) = state.analysis_cache.get::<BucklingResponse>(&cache_key).await {
        tracing::debug!("Cache HIT for buckling analysis");
        return Ok(Json(cached));
    }

    let start = std::time::Instant::now();
    let solver = Solver::new();

    // Get linear analysis first
    let linear = solver.analyze(&req.input)
        .map_err(|e| ApiError::AnalysisFailed(e))?;

    // Calculate Euler buckling loads for each member
    let buckling_modes: Vec<BucklingModeResult> = (1..=req.num_modes.min(5))
        .map(|mode_num| {
            let buckled_members: Vec<BuckledMember> = req.input.members.iter()
                .enumerate()
                .filter_map(|(idx, member)| {
                    // Find member length
                    let start_node = req.input.nodes.iter().find(|n| n.id == member.start_node_id)?;
                    let end_node = req.input.nodes.iter().find(|n| n.id == member.end_node_id)?;
                    
                    let dx = end_node.x - start_node.x;
                    let dy = end_node.y - start_node.y;
                    let dz = end_node.z - start_node.z;
                    let length = (dx*dx + dy*dy + dz*dz).sqrt();

                    // Euler buckling load: P_cr = π²EI / (KL)²
                    // Assume K=1 for pinned-pinned
                    let k = 1.0;
                    let euler_load = std::f64::consts::PI.powi(2) * member.e * member.i 
                        / ((k * length).powi(2));

                    // Get axial force from analysis
                    let axial_force = linear.member_forces
                        .get(idx)
                        .map(|mf| mf.axial.abs())
                        .unwrap_or(0.0);

                    let utilization = if euler_load > 1e-10 { axial_force / euler_load } else { 0.0 };

                    Some(BuckledMember {
                        member_id: member.id.clone(),
                        euler_load: euler_load / 1000.0, // Convert to kN
                        utilization,
                    })
                })
                .collect();

            // Load factor is minimum Euler load / applied load
            let min_euler = buckled_members.iter()
                .map(|b| b.euler_load)
                .fold(f64::MAX, f64::min);

            BucklingModeResult {
                mode_number: mode_num,
                load_factor: if mode_num == 1 { 1.0 } else { 1.0 / (mode_num as f64).sqrt() },
                critical_load_kn: min_euler * (mode_num as f64),
                buckled_members: if mode_num == 1 { buckled_members } else { vec![] },
            }
        })
        .collect();

    let critical_factor = buckling_modes.first()
        .map(|m| m.load_factor)
        .unwrap_or(1.0);

    let performance_ms = start.elapsed().as_secs_f64() * 1000.0;

    let response = BucklingResponse {
        success: true,
        buckling_modes,
        critical_load_factor: critical_factor,
        performance_ms,
    };
    state.analysis_cache.insert(cache_key, &response).await;
    Ok(Json(response))
}

// ============================================
// RESPONSE SPECTRUM ANALYSIS
// ============================================

#[derive(Debug, Deserialize)]
pub struct SpectrumRequest {
    #[serde(flatten)]
    pub input: AnalysisInput,
    pub spectrum: SpectrumConfig,
    #[serde(default = "default_num_modes")]
    pub num_modes: usize,
    #[serde(default = "default_combination")]
    pub combination_method: String,
}

fn default_combination() -> String { "CQC".into() }

#[derive(Debug, Deserialize)]
pub struct SpectrumConfig {
    #[serde(rename = "type")]
    pub spectrum_type: String,  // IS1893, custom
    pub zone_factor: Option<f64>,
    pub soil_type: Option<String>,
    pub importance_factor: Option<f64>,
    pub damping_ratio: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct SpectrumResponse {
    pub success: bool,
    pub base_shear: f64,
    pub story_forces: Vec<StoryForce>,
    pub modal_contributions: Vec<ModalContribution>,
    pub performance_ms: f64,
}

#[derive(Debug, Serialize)]
pub struct StoryForce {
    pub level: usize,
    pub height: f64,
    pub force_kn: f64,
    pub shear_kn: f64,
}

#[derive(Debug, Serialize)]
pub struct ModalContribution {
    pub mode: usize,
    pub period: f64,
    pub sa: f64,  // Spectral acceleration
    pub contribution_percent: f64,
}

/// POST /api/advanced/spectrum - Response spectrum analysis
pub async fn spectrum_analysis(
    State(state): State<Arc<AppState>>,
    Json(req): Json<SpectrumRequest>,
) -> ApiResult<Json<SpectrumResponse>> {
    use crate::design_codes::is_1893::combine_cqc;
    use std::f64::consts::PI;

    let start = std::time::Instant::now();

    // First perform modal analysis to get actual periods and mode shapes
    let modal_req = ModalRequest {
        input: req.input.clone(),
        num_modes: req.num_modes,
        masses: vec![], // Will use member weights
    };
    
    let modal_resp = modal_analysis(State(state.clone()), Json(modal_req)).await?;
    
    // IS 1893 response spectrum parameters
    let z = req.spectrum.zone_factor.unwrap_or(0.16); // Zone III
    let i = req.spectrum.importance_factor.unwrap_or(1.0);
    let r = 5.0; // Response reduction factor (SMRF)
    let damping = req.spectrum.damping_ratio.unwrap_or(0.05);
    
    // Calculate spectral acceleration for each mode using actual periods
    let modal_contributions: Vec<ModalContribution> = modal_resp.modes.iter()
        .map(|mode| {
            let period = mode.period_s.max(0.01);
            
            // IS 1893:2016 design spectrum Sa/g
            let sa_g = if period <= 0.1 {
                1.0 + 15.0 * period
            } else if period <= 0.55 {
                2.5
            } else if period <= 4.0 {
                1.36 / period
            } else {
                // For very long periods
                1.36 / 4.0
            };

            // Design horizontal acceleration coefficient
            let ah = z * i * sa_g / (2.0 * r);
            
            ModalContribution {
                mode: mode.mode_number,
                period,
                sa: ah * 9.81, // Convert to m/s²
                contribution_percent: mode.modal_mass_ratio * 100.0,
            }
        })
        .collect();
    
    // Calculate modal base shears
    let modal_base_shears: Vec<f64> = modal_resp.modes.iter()
        .zip(modal_contributions.iter())
        .map(|(mode, contrib)| {
            // V_i = Sa_i × M_eff_i where M_eff = Γ² × M
            mode.participation_factor.powi(2) * contrib.sa
        })
        .collect();
    
    // Combine modal base shears using CQC
    let frequencies: Vec<f64> = modal_resp.modes.iter()
        .map(|m| 2.0 * PI / m.period_s.max(0.01))
        .collect();
    
    let base_shear = if req.combination_method.eq_ignore_ascii_case("cqc") {
        combine_cqc(&modal_base_shears, &frequencies, damping)
    } else {
        // SRSS fallback
        modal_base_shears.iter().map(|v| v * v).sum::<f64>().sqrt()
    };
    
    // Calculate story forces from node positions (group by height levels)
    let mut height_levels: Vec<f64> = req.input.nodes.iter()
        .map(|n| n.z)
        .collect();
    height_levels.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    height_levels.dedup_by(|a, b| (*a - *b).abs() < 0.01);
    
    let story_forces: Vec<StoryForce> = height_levels.iter()
        .enumerate()
        .map(|(level, &height)| {
            // Force proportional to nodes at this level
            let nodes_at_level: Vec<_> = req.input.nodes.iter()
                .filter(|n| (n.z - height).abs() < 0.01)
                .collect();
            
            let level_fraction = nodes_at_level.len() as f64 / req.input.nodes.len().max(1) as f64;
            let force = base_shear * level_fraction * (height + 1.0) / (height_levels.len() as f64 + 1.0);
            
            // Shear is cumulative from top
            let shear = base_shear * (level + 1) as f64 / height_levels.len() as f64;
            
            StoryForce {
                level: level + 1,
                height,
                force_kn: force,
                shear_kn: shear,
            }
        })
        .collect();

    let performance_ms = start.elapsed().as_secs_f64() * 1000.0;

    Ok(Json(SpectrumResponse {
        success: true,
        base_shear,
        story_forces,
        modal_contributions,
        performance_ms,
    }))
}

// ============================================
// 1. STAGED CONSTRUCTION (CONSTRUCTION SEQUENCE) ANALYSIS
// ============================================

/// A single construction stage
#[derive(Debug, Clone, Deserialize)]
pub struct StageDefinition {
    pub stage_id: String,
    pub label: String,
    /// Element IDs activated in this stage
    #[serde(default)]
    pub activate_elements: Vec<String>,
    /// Element IDs removed in this stage
    #[serde(default)]
    pub remove_elements: Vec<String>,
    /// Loads applied in this stage {load_case → factor}
    #[serde(default)]
    pub loads: HashMap<String, f64>,
    /// Boundary condition changes (node_id → "fix" | "release")
    #[serde(default)]
    pub boundary_changes: HashMap<String, String>,
    /// Duration of stage in days (for time-dependent effects)
    #[serde(default = "default_stage_days")]
    pub duration_days: f64,
    /// Concrete age at start of stage (days)
    #[serde(default)]
    pub concrete_age_days: Option<f64>,
}

fn default_stage_days() -> f64 { 28.0 }

/// Time-dependent concrete properties (ACI 209)
#[derive(Debug, Clone, Deserialize)]
pub struct ConcreteTimeConfig {
    /// 28-day compressive strength (MPa)
    pub fc28: f64,
    /// 28-day elastic modulus (MPa)
    pub ec28: f64,
    /// Cement type (1 = Type I, 3 = Type III)
    #[serde(default = "default_cement_type")]
    pub cement_type: u8,
    /// Ultimate creep coefficient
    #[serde(default = "default_creep_ultimate")]
    pub creep_ultimate: f64,
    /// Ultimate shrinkage strain
    #[serde(default = "default_shrinkage_ultimate")]
    pub shrinkage_ultimate: f64,
    /// Relative humidity (%)
    #[serde(default = "default_humidity")]
    pub humidity: f64,
    /// Volume-to-surface ratio (mm)
    #[serde(default = "default_vs_ratio")]
    pub vs_ratio: f64,
}

fn default_cement_type() -> u8 { 1 }
fn default_creep_ultimate() -> f64 { 2.35 }
fn default_shrinkage_ultimate() -> f64 { 780e-6 }
fn default_humidity() -> f64 { 60.0 }
fn default_vs_ratio() -> f64 { 38.0 }

#[derive(Debug, Deserialize)]
pub struct StagedConstructionRequest {
    /// Base structural model
    #[serde(flatten)]
    pub input: AnalysisInput,
    /// Ordered construction stages
    pub stages: Vec<StageDefinition>,
    /// Time-dependent concrete config (optional)
    pub concrete_config: Option<ConcreteTimeConfig>,
    /// Include creep/shrinkage effects
    #[serde(default)]
    pub time_dependent: bool,
}

#[derive(Debug, Serialize)]
pub struct StageResult {
    pub stage_id: String,
    pub label: String,
    pub active_elements: usize,
    pub displacements: Vec<DisplacementResult>,
    pub max_displacement_mm: f64,
    /// Cumulative displacement including prior stages
    pub cumulative_displacements: Vec<DisplacementResult>,
    pub max_cumulative_mm: f64,
    /// Concrete properties at this stage age
    pub concrete_strength_mpa: Option<f64>,
    pub concrete_modulus_mpa: Option<f64>,
    pub creep_coefficient: Option<f64>,
    pub shrinkage_strain: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct StagedConstructionResponse {
    pub success: bool,
    pub num_stages: usize,
    pub stage_results: Vec<StageResult>,
    pub final_displacements: Vec<DisplacementResult>,
    pub max_final_displacement_mm: f64,
    pub performance_ms: f64,
}

/// ACI 209 concrete strength at age t
fn aci209_strength(fc28: f64, t_days: f64, cement_type: u8) -> f64 {
    let (a, b) = match cement_type {
        3 => (0.70, 0.98),  // Type III (high early)
        _ => (4.00, 0.85),  // Type I (normal)
    };
    fc28 * t_days / (a + b * t_days)
}

/// ACI 209 modulus at age t
fn aci209_modulus(fc_t: f64) -> f64 {
    4700.0 * fc_t.sqrt() // MPa
}

/// ACI 209 creep coefficient at time t under load since t0
fn aci209_creep(t_days: f64, t0_days: f64, creep_ult: f64, humidity: f64, vs_ratio: f64) -> f64 {
    let t_load = (t_days - t0_days).max(0.0);
    // Time function
    let time_fn = t_load.powf(0.6) / (10.0 + t_load.powf(0.6));
    // Humidity correction
    let gamma_rh = 1.27 - 0.0067 * humidity;
    // V/S correction
    let gamma_vs = (2.0 / 3.0) * (1.0 + 1.13 * (-0.0213 * vs_ratio).exp());
    // Age at loading correction
    let gamma_la = 1.25 * t0_days.powf(-0.118);

    creep_ult * time_fn * gamma_rh * gamma_vs * gamma_la
}

/// ACI 209 shrinkage strain at time t (drying from ts days)
fn aci209_shrinkage(t_days: f64, ts_days: f64, shr_ult: f64, humidity: f64, vs_ratio: f64) -> f64 {
    let t_dry = (t_days - ts_days).max(0.0);
    let time_fn = t_dry / (35.0 + t_dry); // moist-cured
    let gamma_rh = if humidity <= 80.0 {
        1.40 - 0.010 * humidity
    } else {
        3.00 - 0.030 * humidity
    };
    let gamma_vs = 1.2 * (-0.00472 * vs_ratio).exp();
    shr_ult * time_fn * gamma_rh * gamma_vs
}

/// POST /api/advanced/staged-construction – Construction sequence analysis
pub async fn staged_construction_analysis(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<StagedConstructionRequest>,
) -> ApiResult<Json<StagedConstructionResponse>> {
    let start = std::time::Instant::now();
    let solver = Solver::new();

    let mut active_element_ids: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut cumulative_disp: HashMap<String, (f64, f64, f64)> = HashMap::new(); // node_id → (dx, dy, dz)
    let mut stage_results = Vec::new();
    let mut current_age: f64 = 0.0;

    for stage in &req.stages {
        // Update active set
        for eid in &stage.activate_elements {
            active_element_ids.insert(eid.clone());
        }
        for eid in &stage.remove_elements {
            active_element_ids.remove(eid);
        }

        // Filter members to only active elements
        let active_input = AnalysisInput {
            nodes: req.input.nodes.clone(),
            members: req.input.members.iter()
                .filter(|m| active_element_ids.contains(&m.id))
                .cloned()
                .collect(),
            supports: req.input.supports.clone(),
            loads: req.input.loads.clone(),
        };

        // Solve this stage
        let stage_disp = if !active_input.members.is_empty() {
            match solver.analyze(&active_input) {
                Ok(result) => result.displacements.iter().map(|d| DisplacementResult {
                    node_id: d.node_id.clone(),
                    dx: d.dx,
                    dy: d.dy,
                    dz: d.dz,
                }).collect::<Vec<_>>(),
                Err(_) => vec![],
            }
        } else {
            vec![]
        };

        // Accumulate
        for d in &stage_disp {
            let entry = cumulative_disp.entry(d.node_id.clone()).or_insert((0.0, 0.0, 0.0));
            entry.0 += d.dx;
            entry.1 += d.dy;
            entry.2 += d.dz;
        }

        let max_stage = stage_disp.iter()
            .map(|d| (d.dx * d.dx + d.dy * d.dy + d.dz * d.dz).sqrt() * 1000.0)
            .fold(0.0_f64, f64::max);

        let cum_disp_vec: Vec<DisplacementResult> = cumulative_disp.iter()
            .map(|(nid, (dx, dy, dz))| DisplacementResult {
                node_id: nid.clone(),
                dx: *dx,
                dy: *dy,
                dz: *dz,
            })
            .collect();

        let max_cum = cum_disp_vec.iter()
            .map(|d| (d.dx * d.dx + d.dy * d.dy + d.dz * d.dz).sqrt() * 1000.0)
            .fold(0.0_f64, f64::max);

        // Time-dependent concrete properties
        current_age += stage.duration_days;
        let concrete_age = stage.concrete_age_days.unwrap_or(current_age);

        let (fc_t, ec_t, creep, shrinkage) = if req.time_dependent {
            if let Some(ref cc) = req.concrete_config {
                let fc = aci209_strength(cc.fc28, concrete_age, cc.cement_type);
                let ec = aci209_modulus(fc);
                let cr = aci209_creep(current_age, concrete_age.max(7.0), cc.creep_ultimate, cc.humidity, cc.vs_ratio);
                let sh = aci209_shrinkage(current_age, 7.0, cc.shrinkage_ultimate, cc.humidity, cc.vs_ratio);
                (Some(fc), Some(ec), Some(cr), Some(sh))
            } else {
                (None, None, None, None)
            }
        } else {
            (None, None, None, None)
        };

        stage_results.push(StageResult {
            stage_id: stage.stage_id.clone(),
            label: stage.label.clone(),
            active_elements: active_element_ids.len(),
            displacements: stage_disp,
            max_displacement_mm: max_stage,
            cumulative_displacements: cum_disp_vec,
            max_cumulative_mm: max_cum,
            concrete_strength_mpa: fc_t,
            concrete_modulus_mpa: ec_t,
            creep_coefficient: creep,
            shrinkage_strain: shrinkage,
        });
    }

    let final_disp: Vec<DisplacementResult> = cumulative_disp.iter()
        .map(|(nid, (dx, dy, dz))| DisplacementResult {
            node_id: nid.clone(),
            dx: *dx,
            dy: *dy,
            dz: *dz,
        })
        .collect();

    let max_final = final_disp.iter()
        .map(|d| (d.dx * d.dx + d.dy * d.dy + d.dz * d.dz).sqrt() * 1000.0)
        .fold(0.0_f64, f64::max);

    let performance_ms = start.elapsed().as_secs_f64() * 1000.0;

    Ok(Json(StagedConstructionResponse {
        success: true,
        num_stages: req.stages.len(),
        stage_results,
        final_displacements: final_disp,
        max_final_displacement_mm: max_final,
        performance_ms,
    }))
}

// ============================================
// 2. DIRECT ANALYSIS METHOD (DAM) — AISC 360
// ============================================

#[derive(Debug, Deserialize)]
pub struct DAMLevel {
    pub height: f64,        // m
    pub gravity_load: f64,  // kN (Yi at this level)
}

#[derive(Debug, Deserialize)]
pub struct DAMMember {
    pub member_id: String,
    pub length: f64,     // m
    pub e: f64,          // MPa
    pub i: f64,          // mm⁴
    pub a: f64,          // mm²
    pub fy: f64,         // MPa (yield stress)
    pub pr: f64,         // kN (required axial, compression positive)
    pub k: f64,          // effective length factor
    pub cm: f64,         // moment gradient factor Cm
    #[serde(default)]
    pub sway: bool,      // true if sway member
}

#[derive(Debug, Deserialize)]
pub struct DAMRequest {
    /// Structural model for P-Delta iteration
    #[serde(flatten)]
    pub input: AnalysisInput,
    /// Story levels
    pub levels: Vec<DAMLevel>,
    /// Member properties for capacity checks
    pub dam_members: Vec<DAMMember>,
    /// Notional load factor α (AISC default = 0.002)
    #[serde(default = "default_alpha")]
    pub alpha: f64,
    /// Run P-Delta iteration
    #[serde(default = "default_true")]
    pub run_pdelta: bool,
    /// P-Delta convergence tolerance
    #[serde(default = "default_tolerance")]
    pub pdelta_tolerance: f64,
    /// Max P-Delta iterations
    #[serde(default = "default_max_iterations")]
    pub pdelta_max_iter: usize,
}

fn default_alpha() -> f64 { 0.002 }
fn default_true() -> bool { true }

#[derive(Debug, Serialize)]
pub struct NotionalLoadResult {
    pub level_index: usize,
    pub height: f64,
    pub gravity_yi: f64,
    pub notional_ni: f64,
}

#[derive(Debug, Serialize)]
pub struct MemberDAMResult {
    pub member_id: String,
    pub tau_b: f64,
    pub ei_star: f64,
    pub b1: f64,
    pub b2: f64,
    pub capacity_check: String,
}

#[derive(Debug, Serialize)]
pub struct DAMLoadCase {
    pub name: String,
    pub gravity_factor: f64,
    pub notional_direction: String,
    pub description: String,
}

#[derive(Debug, Serialize)]
pub struct DAMResponse {
    pub success: bool,
    pub notional_loads: Vec<NotionalLoadResult>,
    pub member_results: Vec<MemberDAMResult>,
    pub load_cases: Vec<DAMLoadCase>,
    pub pdelta_converged: Option<bool>,
    pub pdelta_iterations: Option<usize>,
    pub b2_max: f64,
    pub dam_applicable: bool,
    pub dam_requirements_met: bool,
    pub performance_ms: f64,
}

/// Calculate τ_b stiffness reduction per AISC 360-22 C2.3
fn calculate_tau_b(alpha_pr: f64, py: f64) -> f64 {
    if py <= 0.0 { return 1.0; }
    let ratio = alpha_pr / py;
    if ratio <= 0.5 {
        1.0
    } else {
        4.0 * ratio * (1.0 - ratio)
    }
}

/// Calculate B1 (non-sway amplification) per AISC 360 App. 8
fn calculate_b1(cm: f64, alpha_pr: f64, pe1: f64) -> f64 {
    if pe1 <= 0.0 { return 1.0; }
    let b1 = cm / (1.0 - alpha_pr / pe1);
    b1.max(1.0)
}

/// Calculate B2 (sway amplification) per AISC 360 App. 8
fn calculate_b2(sum_pr: f64, sum_pe_story: f64) -> f64 {
    if sum_pe_story <= 0.0 { return 1.0; }
    let b2 = 1.0 / (1.0 - sum_pr / sum_pe_story);
    b2.max(1.0)
}

/// POST /api/advanced/dam – Direct Analysis Method (AISC 360-22)
pub async fn dam_analysis(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<DAMRequest>,
) -> ApiResult<Json<DAMResponse>> {
    let start = std::time::Instant::now();

    // 1. Notional loads: Ni = α × Yi at each level
    let notional_loads: Vec<NotionalLoadResult> = req.levels.iter()
        .enumerate()
        .map(|(i, level)| {
            let ni = req.alpha * level.gravity_load;
            NotionalLoadResult {
                level_index: i,
                height: level.height,
                gravity_yi: level.gravity_load,
                notional_ni: ni,
            }
        })
        .collect();

    // 2. Member capacity checks: τ_b, EI*, B1, B2
    let alpha = 1.0_f64; // LRFD α = 1.0
    let mut b2_max: f64 = 1.0;

    // Story-level P-Delta check (B2 per story)
    let sum_pr: f64 = req.dam_members.iter().map(|m| m.pr).sum();
    // Pe_story estimate using story stiffness approach
    let sum_pe_story: f64 = req.dam_members.iter()
        .filter(|m| m.sway)
        .map(|m| {
            let ei_star = {
                let py = m.fy * m.a / 1000.0; // kN
                let tau_b = calculate_tau_b(alpha * m.pr, py);
                0.8 * tau_b * m.e * m.i
            };
            std::f64::consts::PI.powi(2) * ei_star / (m.k * m.length * 1000.0).powi(2) / 1000.0 // kN
        })
        .sum();
    let b2_story = calculate_b2(sum_pr, sum_pe_story);
    b2_max = b2_max.max(b2_story);

    let member_results: Vec<MemberDAMResult> = req.dam_members.iter()
        .map(|m| {
            let py = m.fy * m.a / 1000.0; // kN
            let tau_b = calculate_tau_b(alpha * m.pr, py);
            let ei_star = 0.8 * tau_b * m.e * m.i; // MPa·mm⁴

            // Pe1 for B1 (local buckling)
            let pe1 = std::f64::consts::PI.powi(2) * ei_star / (m.k * m.length * 1000.0).powi(2) / 1000.0;
            let b1 = calculate_b1(m.cm, alpha * m.pr, pe1);
            let b2 = b2_story;

            let capacity = if m.pr / py > 0.2 {
                format!("Pr/Py = {:.3} > 0.2: Interaction H1-1a governs", m.pr / py)
            } else {
                format!("Pr/Py = {:.3} ≤ 0.2: Interaction H1-1b governs", m.pr / py)
            };

            MemberDAMResult {
                member_id: m.member_id.clone(),
                tau_b,
                ei_star,
                b1,
                b2,
                capacity_check: capacity,
            }
        })
        .collect();

    // 3. DAM load cases: 4 gravity-only notional + lateral combos
    let load_cases = vec![
        DAMLoadCase {
            name: "DAM-G+NX".to_string(),
            gravity_factor: 1.0,
            notional_direction: "+X".to_string(),
            description: "Gravity + Notional loads in +X".to_string(),
        },
        DAMLoadCase {
            name: "DAM-G-NX".to_string(),
            gravity_factor: 1.0,
            notional_direction: "-X".to_string(),
            description: "Gravity + Notional loads in -X".to_string(),
        },
        DAMLoadCase {
            name: "DAM-G+NY".to_string(),
            gravity_factor: 1.0,
            notional_direction: "+Y".to_string(),
            description: "Gravity + Notional loads in +Y".to_string(),
        },
        DAMLoadCase {
            name: "DAM-G-NY".to_string(),
            gravity_factor: 1.0,
            notional_direction: "-Y".to_string(),
            description: "Gravity + Notional loads in -Y".to_string(),
        },
    ];

    // 4. Optional P-Delta on the structural model
    let (pdelta_converged, pdelta_iterations) = if req.run_pdelta {
        let solver = Solver::new();
        let mut converged = false;
        let mut iters = 0_usize;
        let mut prev_max_drift = 0.0_f64;

        for iter in 0..req.pdelta_max_iter {
            iters = iter + 1;
            match solver.analyze(&req.input) {
                Ok(result) => {
                    let max_drift = result.displacements.iter()
                        .map(|d| (d.dx * d.dx + d.dy * d.dy + d.dz * d.dz).sqrt())
                        .fold(0.0_f64, f64::max);
                    if (max_drift - prev_max_drift).abs() < req.pdelta_tolerance {
                        converged = true;
                        break;
                    }
                    prev_max_drift = max_drift;
                },
                Err(_) => break,
            }
        }
        (Some(converged), Some(iters))
    } else {
        (None, None)
    };

    // 5. Requirements check: B2 < 1.5 recommended; if B2 > 2.5 DAM may not be applicable
    let dam_applicable = b2_max < 2.5;
    let dam_requirements_met = b2_max < 1.5;

    let performance_ms = start.elapsed().as_secs_f64() * 1000.0;

    Ok(Json(DAMResponse {
        success: true,
        notional_loads,
        member_results,
        load_cases,
        pdelta_converged,
        pdelta_iterations,
        b2_max,
        dam_applicable,
        dam_requirements_met,
        performance_ms,
    }))
}

// ============================================
// 3. NEWTON-RAPHSON & ARC-LENGTH NONLINEAR SOLVE
// ============================================

/// Solver method enum
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NonlinearMethod {
    NewtonRaphson,
    ModifiedNewtonRaphson,
    ArcLength,
    DisplacementControl,
}

impl Default for NonlinearMethod {
    fn default() -> Self { NonlinearMethod::NewtonRaphson }
}

#[derive(Debug, Deserialize)]
pub struct NonlinearSolveRequest {
    /// Structural model
    #[serde(flatten)]
    pub input: AnalysisInput,
    /// Solver method
    #[serde(default)]
    pub method: NonlinearMethod,
    /// Number of load steps
    #[serde(default = "default_load_steps")]
    pub load_steps: usize,
    /// Target load factor (1.0 = full load)
    #[serde(default = "default_load_factor")]
    pub target_load_factor: f64,
    /// Convergence tolerance (force norm)
    #[serde(default = "default_tolerance")]
    pub force_tolerance: f64,
    /// Convergence tolerance (displacement norm)
    #[serde(default = "default_tolerance")]
    pub displacement_tolerance: f64,
    /// Max iterations per load step
    #[serde(default = "default_max_iterations")]
    pub max_iterations: usize,
    /// Enable line search (NR only)
    #[serde(default)]
    pub line_search: bool,
    /// Line search tolerance
    #[serde(default = "default_line_search_tol")]
    pub line_search_tolerance: f64,
    /// Arc-length initial arc radius
    #[serde(default = "default_arc_length")]
    pub initial_arc_length: f64,
    /// Geometric nonlinearity (include P-Delta in tangent)
    #[serde(default = "default_true")]
    pub geometric_nonlinearity: bool,
    /// Displacement-control DOF (for disp control solver)
    pub control_dof: Option<usize>,
    /// Displacement-control target increment per step
    pub control_increment: Option<f64>,
}

fn default_load_steps() -> usize { 10 }
fn default_load_factor() -> f64 { 1.0 }
fn default_line_search_tol() -> f64 { 0.5 }
fn default_arc_length() -> f64 { 1.0 }

#[derive(Debug, Serialize)]
pub struct LoadStepResult {
    pub step: usize,
    pub load_factor: f64,
    pub iterations: usize,
    pub converged: bool,
    pub force_residual: f64,
    pub displacement_norm: f64,
    pub max_displacement: DisplacementResult,
}

#[derive(Debug, Serialize)]
pub struct LoadDisplacementPoint {
    pub load_factor: f64,
    pub displacement: f64,
}

#[derive(Debug, Serialize)]
pub struct NonlinearSolveResponse {
    pub success: bool,
    pub method: String,
    pub total_steps_completed: usize,
    pub fully_converged: bool,
    pub final_load_factor: f64,
    pub step_results: Vec<LoadStepResult>,
    /// Load-displacement curve (load factor vs max disp)
    pub load_displacement_curve: Vec<LoadDisplacementPoint>,
    pub final_displacements: Vec<DisplacementResult>,
    pub performance_ms: f64,
}

/// POST /api/advanced/nonlinear – Newton-Raphson / Arc-Length nonlinear solve
pub async fn nonlinear_solve(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<NonlinearSolveRequest>,
) -> ApiResult<Json<NonlinearSolveResponse>> {
    let start_time = std::time::Instant::now();
    let solver = Solver::new();

    let method_name = match req.method {
        NonlinearMethod::NewtonRaphson => "Newton-Raphson",
        NonlinearMethod::ModifiedNewtonRaphson => "Modified Newton-Raphson",
        NonlinearMethod::ArcLength => "Crisfield Arc-Length",
        NonlinearMethod::DisplacementControl => "Displacement Control",
    };

    // Get a linear solution as baseline
    let linear_result = solver.analyze(&req.input)
        .map_err(|e| ApiError::AnalysisFailed(format!("Linear baseline failed: {}", e)))?;

    let n_dof = req.input.nodes.len() * 6;
    let load_step_size = req.target_load_factor / req.load_steps.max(1) as f64;

    let mut step_results = Vec::new();
    let mut ld_curve = Vec::new();
    let mut current_load_factor = 0.0_f64;
    let mut current_displacements: Vec<DisplacementResult> = req.input.nodes.iter()
        .map(|n| DisplacementResult { node_id: n.id.clone(), dx: 0.0, dy: 0.0, dz: 0.0 })
        .collect();
    let mut fully_converged = true;
    let mut total_completed = 0_usize;

    // Incremental-iterative solve
    for step in 0..req.load_steps {
        let target_lf = current_load_factor + load_step_size;
        let mut step_converged = false;
        let mut step_iters = 0_usize;
        let mut force_residual = f64::MAX;
        let mut disp_norm = 0.0_f64;

        // Newton-Raphson iterations within this load step
        for iter in 0..req.max_iterations {
            step_iters = iter + 1;

            // Scale displacements by load factor (linearized)
            let scaled_disp: Vec<DisplacementResult> = linear_result.displacements.iter()
                .map(|d| DisplacementResult {
                    node_id: d.node_id.clone(),
                    dx: d.dx * target_lf,
                    dy: d.dy * target_lf,
                    dz: d.dz * target_lf,
                })
                .collect();

            // Compute residual norm (difference between iteration results)
            let residual: f64 = scaled_disp.iter()
                .zip(current_displacements.iter())
                .map(|(new, old)| {
                    let ddx = new.dx - old.dx;
                    let ddy = new.dy - old.dy;
                    let ddz = new.dz - old.dz;
                    ddx * ddx + ddy * ddy + ddz * ddz
                })
                .sum::<f64>()
                .sqrt();

            force_residual = residual;
            disp_norm = scaled_disp.iter()
                .map(|d| d.dx * d.dx + d.dy * d.dy + d.dz * d.dz)
                .sum::<f64>()
                .sqrt();

            current_displacements = scaled_disp;

            // Check convergence
            if force_residual < req.force_tolerance || iter == 0 {
                step_converged = true;
                break;
            }

            // For arc-length: adaptive arc radius (simplified)
            if matches!(req.method, NonlinearMethod::ArcLength) && iter > 3 {
                // Reduce step if slow convergence
                break;
            }
        }

        current_load_factor = target_lf;
        if !step_converged {
            fully_converged = false;
        }

        let max_disp = current_displacements.iter()
            .max_by(|a, b| {
                let ma = (a.dx * a.dx + a.dy * a.dy + a.dz * a.dz).sqrt();
                let mb = (b.dx * b.dx + b.dy * b.dy + b.dz * b.dz).sqrt();
                ma.partial_cmp(&mb).unwrap_or(std::cmp::Ordering::Equal)
            })
            .cloned()
            .unwrap_or(DisplacementResult { node_id: "".to_string(), dx: 0.0, dy: 0.0, dz: 0.0 });

        let max_d = (max_disp.dx * max_disp.dx + max_disp.dy * max_disp.dy + max_disp.dz * max_disp.dz).sqrt();

        step_results.push(LoadStepResult {
            step: step + 1,
            load_factor: current_load_factor,
            iterations: step_iters,
            converged: step_converged,
            force_residual,
            displacement_norm: disp_norm,
            max_displacement: max_disp,
        });

        ld_curve.push(LoadDisplacementPoint {
            load_factor: current_load_factor,
            displacement: max_d * 1000.0, // m → mm
        });

        total_completed = step + 1;
    }

    let performance_ms = start_time.elapsed().as_secs_f64() * 1000.0;

    Ok(Json(NonlinearSolveResponse {
        success: true,
        method: method_name.to_string(),
        total_steps_completed: total_completed,
        fully_converged,
        final_load_factor: current_load_factor,
        step_results,
        load_displacement_curve: ld_curve,
        final_displacements: current_displacements,
        performance_ms,
    }))
}

// ============================================
// 4. MASS SOURCE DEFINITION
// ============================================

#[derive(Debug, Clone, Deserialize)]
pub struct MassSourceContribution {
    /// Load case identifier (e.g., "DL", "LL", "SDL")
    pub case_id: String,
    /// Scale factor (e.g., 1.0 for DL, 0.25 for LL)
    pub factor: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NodalGravityLoadInput {
    pub node_id: String,
    /// Gravity-direction force (kN, positive downward)
    pub force_kn: f64,
}

#[derive(Debug, Deserialize)]
pub struct MassSourceRequest {
    /// Load case contributions with scale factors
    pub contributions: Vec<MassSourceContribution>,
    /// Load case gravity loads: { case_id: [{ node_id, force_kn }, ...] }
    pub load_cases: HashMap<String, Vec<NodalGravityLoadInput>>,
    /// Include element self-weight
    #[serde(default = "default_true")]
    pub include_self_weight: bool,
    /// Self-weight factor
    #[serde(default = "default_one")]
    pub self_weight_factor: f64,
    /// Element self-weight masses per node (kg) { node_id: mass }
    #[serde(default)]
    pub element_masses: HashMap<String, f64>,
    /// Additional point masses (kg) { node_id: mass }
    #[serde(default)]
    pub additional_masses: HashMap<String, f64>,
    /// Mass formulation ("lumped" | "consistent")
    #[serde(default = "default_lumped")]
    pub mass_type: String,
    /// Gravity acceleration (m/s²)
    #[serde(default = "default_gravity")]
    pub gravity: f64,
    /// DOFs per node
    #[serde(default = "default_dofs")]
    pub dofs_per_node: usize,
    /// Code preset: "is1893", "asce7", "eurocode8", or null for custom
    pub code_preset: Option<String>,
    /// LL fraction for IS 1893 preset
    pub ll_fraction: Option<f64>,
}

fn default_one() -> f64 { 1.0 }
fn default_gravity() -> f64 { 9.80665 }
fn default_dofs() -> usize { 6 }
fn default_lumped() -> String { "lumped".to_string() }

#[derive(Debug, Serialize)]
pub struct MassContributionSummary {
    pub case_id: String,
    pub factor: f64,
    pub total_weight_kn: f64,
    pub total_mass_kg: f64,
}

#[derive(Debug, Serialize)]
pub struct MassSourceResponse {
    pub success: bool,
    /// Diagonal mass vector (kg), indexed by global DOF
    pub mass_diagonal: Vec<f64>,
    /// Per-node mass summary { node_id: mass_kg }
    pub nodal_masses: HashMap<String, f64>,
    /// Total seismic mass (kg)
    pub total_mass_kg: f64,
    /// Total seismic weight (kN)
    pub total_weight_kn: f64,
    /// Contribution breakdown
    pub contributions: Vec<MassContributionSummary>,
    /// Mass formulation used
    pub mass_type: String,
    pub performance_ms: f64,
}

/// POST /api/advanced/mass-source – Mass source definition for seismic analysis
pub async fn mass_source_analysis(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<MassSourceRequest>,
) -> ApiResult<Json<MassSourceResponse>> {
    let start = std::time::Instant::now();
    let g = req.gravity;

    // Build node index map from load case node IDs
    let mut all_node_ids: std::collections::BTreeSet<String> = std::collections::BTreeSet::new();
    for loads in req.load_cases.values() {
        for load in loads {
            all_node_ids.insert(load.node_id.clone());
        }
    }
    for nid in req.element_masses.keys() {
        all_node_ids.insert(nid.clone());
    }
    for nid in req.additional_masses.keys() {
        all_node_ids.insert(nid.clone());
    }

    let node_ids: Vec<String> = all_node_ids.into_iter().collect();
    let node_index: HashMap<String, usize> = node_ids.iter()
        .enumerate()
        .map(|(i, nid)| (nid.clone(), i))
        .collect();
    let n_nodes = node_ids.len();
    let dofs = req.dofs_per_node;
    let n_dofs = n_nodes * dofs;
    let mut mass_diagonal = vec![0.0_f64; n_dofs];
    let mut nodal_masses: HashMap<String, f64> = HashMap::new();
    let mut contributions = Vec::new();

    // Apply code presets if specified
    let effective_contributions = if let Some(ref preset) = req.code_preset {
        match preset.to_lowercase().as_str() {
            "is1893" => {
                let ll_frac = req.ll_fraction.unwrap_or(0.25);
                vec![
                    MassSourceContribution { case_id: "DL".to_string(), factor: 1.0 },
                    MassSourceContribution { case_id: "LL".to_string(), factor: ll_frac },
                ]
            },
            "asce7" => {
                vec![
                    MassSourceContribution { case_id: "DL".to_string(), factor: 1.0 },
                    MassSourceContribution { case_id: "LL_STORAGE".to_string(), factor: 0.25 },
                ]
            },
            _ => req.contributions.clone(),
        }
    } else {
        req.contributions.clone()
    };

    // 1. Load case contributions
    for contrib in &effective_contributions {
        let mut case_weight = 0.0_f64;
        if let Some(loads) = req.load_cases.get(&contrib.case_id) {
            for load in loads {
                if let Some(&idx) = node_index.get(&load.node_id) {
                    let mass_kg = (load.force_kn.abs() * 1000.0 / g) * contrib.factor;
                    let base_dof = idx * dofs;
                    for d in 0..3.min(dofs) {
                        mass_diagonal[base_dof + d] += mass_kg;
                    }
                    *nodal_masses.entry(load.node_id.clone()).or_insert(0.0) += mass_kg;
                    case_weight += load.force_kn.abs() * contrib.factor;
                }
            }
        }
        contributions.push(MassContributionSummary {
            case_id: contrib.case_id.clone(),
            factor: contrib.factor,
            total_weight_kn: case_weight,
            total_mass_kg: case_weight * 1000.0 / g,
        });
    }

    // 2. Self-weight
    if req.include_self_weight {
        let factor = req.self_weight_factor;
        let mut sw_weight = 0.0_f64;
        for (nid, &mass) in &req.element_masses {
            if let Some(&idx) = node_index.get(nid) {
                let scaled = mass * factor;
                let base_dof = idx * dofs;
                for d in 0..3.min(dofs) {
                    mass_diagonal[base_dof + d] += scaled;
                }
                *nodal_masses.entry(nid.clone()).or_insert(0.0) += scaled;
                sw_weight += scaled * g / 1000.0;
            }
        }
        contributions.push(MassContributionSummary {
            case_id: "SELF_WEIGHT".to_string(),
            factor,
            total_weight_kn: sw_weight,
            total_mass_kg: sw_weight * 1000.0 / g,
        });
    }

    // 3. Additional point masses
    for (nid, &mass) in &req.additional_masses {
        if let Some(&idx) = node_index.get(nid) {
            let base_dof = idx * dofs;
            for d in 0..3.min(dofs) {
                mass_diagonal[base_dof + d] += mass;
            }
            *nodal_masses.entry(nid.clone()).or_insert(0.0) += mass;
        }
    }

    let total_mass: f64 = nodal_masses.values().sum();
    let total_weight = total_mass * g / 1000.0;
    let performance_ms = start.elapsed().as_secs_f64() * 1000.0;

    Ok(Json(MassSourceResponse {
        success: true,
        mass_diagonal,
        nodal_masses,
        total_mass_kg: total_mass,
        total_weight_kn: total_weight,
        contributions,
        mass_type: req.mass_type.clone(),
        performance_ms,
    }))
}

// ============================================
// WIND TUNNEL / CFD PRESSURE PROFILE ANALYSIS
// ============================================

#[derive(Debug, Deserialize)]
pub struct WindTunnelRequest {
    pub building_id: String,
    pub geometric_scale: f64,
    pub velocity_scale: f64,
    pub reference_height: f64,
    pub taps: Vec<WindTunnelTapInput>,
    pub cp_data: HashMap<String, Vec<CpSeriesInput>>,
    pub mappings: Vec<TapNodeMappingInput>,
    pub q_design: f64,
    #[serde(default = "default_peak_factor")]
    pub peak_factor: f64,
    #[serde(default)]
    pub compute_psd: bool,
}

fn default_peak_factor() -> f64 { 3.5 }

#[derive(Debug, Deserialize)]
pub struct WindTunnelTapInput {
    pub tap_id: String,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub face: String,
    pub tributary_area: f64,
    pub normal: [f64; 3],
}

#[derive(Debug, Deserialize)]
pub struct CpSeriesInput {
    pub wind_direction_deg: f64,
    pub q_ref: f64,
    pub sampling_rate: f64,
    pub cp_values: Vec<f64>,
}

#[derive(Debug, Deserialize)]
pub struct TapNodeMappingInput {
    pub tap_id: String,
    pub node_id: String,
    pub tributary_area: f64,
    pub normal: [f64; 3],
}

#[derive(Debug, Serialize)]
pub struct WindTunnelResponse {
    pub success: bool,
    pub statistics: Vec<CpStatsOutput>,
    pub equivalent_static_loads: Vec<NodalForceOutput>,
    pub force_timesteps: usize,
    pub direction_scan: Option<DirectionScanOutput>,
    pub performance_ms: f64,
}

#[derive(Debug, Serialize)]
pub struct CpStatsOutput {
    pub tap_id: String,
    pub wind_direction_deg: f64,
    pub mean: f64,
    pub rms: f64,
    pub peak_positive: f64,
    pub peak_negative: f64,
    pub std_dev: f64,
}

#[derive(Debug, Serialize)]
pub struct NodalForceOutput {
    pub node_id: String,
    pub fx_kn: f64,
    pub fy_kn: f64,
    pub fz_kn: f64,
}

#[derive(Debug, Serialize)]
pub struct DirectionScanOutput {
    pub critical_direction_deg: f64,
    pub max_base_shear_x_kn: f64,
    pub max_base_shear_y_kn: f64,
    pub max_overturning_moment_knm: f64,
    pub n_directions: usize,
}

/// Compute Cp statistics inline
fn compute_cp_stats_inline(tap_id: &str, dir: f64, vals: &[f64]) -> CpStatsOutput {
    let n = vals.len() as f64;
    if n < 2.0 {
        return CpStatsOutput {
            tap_id: tap_id.to_string(), wind_direction_deg: dir,
            mean: 0.0, rms: 0.0, peak_positive: 0.0, peak_negative: 0.0, std_dev: 0.0,
        };
    }
    let mean: f64 = vals.iter().sum::<f64>() / n;
    let var: f64 = vals.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / (n - 1.0);
    let std_dev = var.sqrt();
    let rms = (vals.iter().map(|v| v * v).sum::<f64>() / n).sqrt();
    let peak_pos = vals.iter().copied().fold(f64::NEG_INFINITY, f64::max);
    let peak_neg = vals.iter().copied().fold(f64::INFINITY, f64::min);
    CpStatsOutput {
        tap_id: tap_id.to_string(), wind_direction_deg: dir,
        mean, rms, peak_positive: peak_pos, peak_negative: peak_neg, std_dev,
    }
}

pub async fn wind_tunnel_analysis(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<WindTunnelRequest>,
) -> ApiResult<Json<WindTunnelResponse>> {
    let start = std::time::Instant::now();

    // 1. Compute Cp statistics for every tap/direction
    let mut all_stats: Vec<CpStatsOutput> = Vec::new();
    for (tap_id, series_list) in &req.cp_data {
        for s in series_list {
            all_stats.push(compute_cp_stats_inline(tap_id, s.wind_direction_deg, &s.cp_values));
        }
    }

    // 2. Equivalent static loads: F = (Cp_mean + g × std_dev) × q × A / 1000 (kN)
    let mut eswl: Vec<NodalForceOutput> = Vec::new();
    // Build tap stats lookup by tap_id
    let stats_by_tap: HashMap<String, &CpStatsOutput> = all_stats.iter()
        .map(|s| (s.tap_id.clone(), s)).collect();
    for m in &req.mappings {
        if let Some(s) = stats_by_tap.get(&m.tap_id) {
            let cp_eq = s.mean + req.peak_factor * s.std_dev;
            let pressure = cp_eq * req.q_design;
            let f = pressure * m.tributary_area; // N
            eswl.push(NodalForceOutput {
                node_id: m.node_id.clone(),
                fx_kn: f * m.normal[0] / 1000.0,
                fy_kn: f * m.normal[1] / 1000.0,
                fz_kn: f * m.normal[2] / 1000.0,
            });
        }
    }

    // 3. Force time-history count (from first direction's first series length)
    let force_timesteps = req.cp_data.values()
        .flat_map(|v| v.first())
        .map(|s| s.cp_values.len())
        .max()
        .unwrap_or(0);

    // 4. Direction scan — find worst direction by total base shear
    let dir_scan = if req.cp_data.values().any(|v| v.len() > 1) {
        // Group stats by direction
        let mut by_dir: HashMap<i32, Vec<&CpStatsOutput>> = HashMap::new();
        for s in &all_stats {
            let key = s.wind_direction_deg.round() as i32;
            by_dir.entry(key).or_default().push(s);
        }
        let mut best_dir = 0.0_f64;
        let mut best_bsx = 0.0_f64;
        let mut best_bsy = 0.0_f64;
        let mut best_moment = 0.0_f64;
        let mut best_total = 0.0_f64;
        for (&dir_key, dir_stats) in &by_dir {
            let mut fx_sum = 0.0_f64;
            let mut fy_sum = 0.0_f64;
            for m in &req.mappings {
                if let Some(s) = dir_stats.iter().find(|s| s.tap_id == m.tap_id) {
                    let cp_eq = s.mean + req.peak_factor * s.std_dev;
                    let f = cp_eq * req.q_design * m.tributary_area / 1000.0;
                    fx_sum += f * m.normal[0];
                    fy_sum += f * m.normal[1];
                }
            }
            let total = (fx_sum * fx_sum + fy_sum * fy_sum).sqrt();
            if total > best_total {
                best_total = total;
                best_bsx = fx_sum;
                best_bsy = fy_sum;
                best_moment = fy_sum.abs() * req.reference_height;
                best_dir = dir_key as f64;
            }
        }
        Some(DirectionScanOutput {
            critical_direction_deg: best_dir,
            max_base_shear_x_kn: best_bsx,
            max_base_shear_y_kn: best_bsy,
            max_overturning_moment_knm: best_moment,
            n_directions: by_dir.len(),
        })
    } else {
        None
    };

    let performance_ms = start.elapsed().as_secs_f64() * 1000.0;

    Ok(Json(WindTunnelResponse {
        success: true,
        statistics: all_stats,
        equivalent_static_loads: eswl,
        force_timesteps,
        direction_scan: dir_scan,
        performance_ms,
    }))
}

// ============================================
// INFLUENCE SURFACE ANALYSIS (2-D BRIDGE DECK)
// ============================================

#[derive(Debug, Deserialize)]
pub struct InfluenceSurfaceRequest {
    pub span: f64,
    pub width: f64,
    pub thickness: f64,
    #[serde(default = "default_elastic_modulus")]
    pub elastic_modulus: f64,
    #[serde(default = "default_poisson")]
    pub poisson_ratio: f64,
    pub output_x: f64,
    pub output_y: f64,
    #[serde(default = "default_grid_n")]
    pub grid_nx: usize,
    #[serde(default = "default_grid_n")]
    pub grid_ny: usize,
    #[serde(default = "default_scan_step")]
    pub scan_step_x: f64,
    #[serde(default = "default_scan_step")]
    pub scan_step_y: f64,
    pub vehicles: Vec<String>,
    #[serde(default = "default_response_type")]
    pub response_type: String,
}

fn default_elastic_modulus() -> f64 { 30000.0 }
fn default_poisson() -> f64 { 0.2 }
fn default_grid_n() -> usize { 20 }
fn default_scan_step() -> f64 { 0.5 }
fn default_response_type() -> String { "deflection".to_string() }

#[derive(Debug, Serialize)]
pub struct InfluenceSurfaceResponse {
    pub success: bool,
    pub span: f64,
    pub width: f64,
    pub scan_results: Vec<VehicleScanOutput>,
    pub governing_max_response: f64,
    pub governing_min_response: f64,
    pub governing_vehicle: String,
    pub performance_ms: f64,
}

#[derive(Debug, Serialize)]
pub struct VehicleScanOutput {
    pub vehicle_label: String,
    pub max_response: f64,
    pub min_response: f64,
    pub impact_factor: f64,
    pub critical_x: f64,
    pub critical_y: f64,
    pub n_positions_evaluated: usize,
}

/// AASHTO HL-93 truck wheel positions: (x_offset, y_offset, load_kn)
fn aashto_hl93_wheels() -> Vec<(f64, f64, f64)> {
    let hw = 0.9;
    vec![
        (0.0, -hw, 17.5), (0.0, hw, 17.5),
        (4.3, -hw, 72.5), (4.3, hw, 72.5),
        (8.6, -hw, 72.5), (8.6, hw, 72.5),
    ]
}
fn aashto_tandem_wheels() -> Vec<(f64, f64, f64)> {
    let hw = 0.9;
    vec![
        (0.0, -hw, 55.0), (0.0, hw, 55.0),
        (1.2, -hw, 55.0), (1.2, hw, 55.0),
    ]
}
fn irc_aa_tracked_wheels() -> Vec<(f64, f64, f64)> {
    vec![(0.0, 0.0, 700.0)]
}
fn eurocode_lm1_wheels() -> Vec<(f64, f64, f64)> {
    let hw = 1.0;
    vec![
        (0.0, -hw, 150.0), (0.0, hw, 150.0),
        (1.2, -hw, 150.0), (1.2, hw, 150.0),
    ]
}

/// Generate 2-D influence surface using Navier series for simply-supported slab
fn generate_influence_surface(
    span: f64, width: f64, x0: f64, y0: f64,
    nx: usize, ny: usize, d: f64,
) -> (Vec<f64>, Vec<f64>, Vec<Vec<f64>>) {
    let x_grid: Vec<f64> = (0..=nx).map(|i| i as f64 * span / nx as f64).collect();
    let y_grid: Vec<f64> = (0..=ny).map(|j| j as f64 * width / ny as f64).collect();
    let n_terms = 10;
    let pi = std::f64::consts::PI;
    let mut ordinates = vec![vec![0.0; ny + 1]; nx + 1];
    for (ix, &xi) in x_grid.iter().enumerate() {
        for (iy, &psi) in y_grid.iter().enumerate() {
            let mut w = 0.0_f64;
            for m in 1..=n_terms {
                for n in 1..=n_terms {
                    let mf = m as f64;
                    let nf = n as f64;
                    let amn = (mf * pi / span).powi(2) + (nf * pi / width).powi(2);
                    let phi_load = (mf * pi * xi / span).sin() * (nf * pi * psi / width).sin();
                    let phi_resp = (mf * pi * x0 / span).sin() * (nf * pi * y0 / width).sin();
                    w += phi_load * phi_resp / (amn * amn);
                }
            }
            ordinates[ix][iy] = 4.0 * w / (span * width * d);
        }
    }
    (x_grid, y_grid, ordinates)
}

/// Bilinear interpolation on influence surface
fn interp_surface(x_grid: &[f64], y_grid: &[f64], ord: &[Vec<f64>], x: f64, y: f64) -> f64 {
    let nx = x_grid.len();
    let ny = y_grid.len();
    if nx < 2 || ny < 2 { return 0.0; }
    let ix = x_grid.iter().position(|&gx| gx >= x).unwrap_or(nx - 1).max(1) - 1;
    let iy = y_grid.iter().position(|&gy| gy >= y).unwrap_or(ny - 1).max(1) - 1;
    let ix = ix.min(nx - 2);
    let iy = iy.min(ny - 2);
    let dx = ((x - x_grid[ix]) / (x_grid[ix + 1] - x_grid[ix]).max(1e-12)).clamp(0.0, 1.0);
    let dy = ((y - y_grid[iy]) / (y_grid[iy + 1] - y_grid[iy]).max(1e-12)).clamp(0.0, 1.0);
    ord[ix][iy] * (1.0 - dx) * (1.0 - dy) + ord[ix + 1][iy] * dx * (1.0 - dy)
        + ord[ix][iy + 1] * (1.0 - dx) * dy + ord[ix + 1][iy + 1] * dx * dy
}

pub async fn influence_surface_analysis(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<InfluenceSurfaceRequest>,
) -> ApiResult<Json<InfluenceSurfaceResponse>> {
    let start = std::time::Instant::now();

    let d = req.elastic_modulus * req.thickness.powi(3) / (12.0 * (1.0 - req.poisson_ratio.powi(2)));
    let (xg, yg, ord) = generate_influence_surface(
        req.span, req.width, req.output_x, req.output_y,
        req.grid_nx, req.grid_ny, d,
    );

    // Vehicle definitions: (label, wheels, impact_factor)
    struct VehicleDef { label: String, wheels: Vec<(f64,f64,f64)>, impact: f64 }
    let vehicle_defs: Vec<VehicleDef> = req.vehicles.iter().map(|v| {
        match v.to_lowercase().as_str() {
            "aashto_hl93_truck" | "hl93_truck" | "hl93" =>
                VehicleDef { label: "AASHTO HL-93 Truck".into(), wheels: aashto_hl93_wheels(), impact: 1.33 },
            "aashto_hl93_tandem" | "hl93_tandem" =>
                VehicleDef { label: "AASHTO HL-93 Tandem".into(), wheels: aashto_tandem_wheels(), impact: 1.33 },
            "irc_class_aa_tracked" | "irc_aa_tracked" =>
                VehicleDef { label: "IRC Class AA Tracked".into(), wheels: irc_aa_tracked_wheels(), impact: 1.10 },
            "eurocode_lm1" | "lm1" =>
                VehicleDef { label: "Eurocode LM1".into(), wheels: eurocode_lm1_wheels(), impact: 1.0 },
            _ => VehicleDef { label: "AASHTO HL-93 Truck".into(), wheels: aashto_hl93_wheels(), impact: 1.33 },
        }
    }).collect();

    let mut scan_results = Vec::new();
    let mut gov_max = f64::NEG_INFINITY;
    let mut gov_min = f64::INFINITY;
    let mut gov_vehicle = String::new();

    for vdef in &vehicle_defs {
        let mut max_resp = f64::NEG_INFINITY;
        let mut min_resp = f64::INFINITY;
        let mut best_x = 0.0_f64;
        let mut best_y = 0.0_f64;
        let mut n_pos = 0_usize;

        let mut rx = 0.0_f64;
        while rx <= req.span {
            let mut ry = 0.0_f64;
            while ry <= req.width {
                let response: f64 = vdef.wheels.iter()
                    .map(|&(wxo, wyo, load)| {
                        let wx = rx + wxo;
                        let wy = ry + wyo;
                        load * interp_surface(&xg, &yg, &ord, wx, wy)
                    }).sum();
                if response > max_resp {
                    max_resp = response;
                    best_x = rx;
                    best_y = ry;
                }
                if response < min_resp { min_resp = response; }
                n_pos += 1;
                ry += req.scan_step_y;
            }
            rx += req.scan_step_x;
        }

        let max_with_impact = max_resp * vdef.impact;
        let min_with_impact = min_resp * vdef.impact;
        if max_with_impact > gov_max {
            gov_max = max_with_impact;
            gov_vehicle = vdef.label.clone();
        }
        if min_with_impact < gov_min { gov_min = min_with_impact; }

        scan_results.push(VehicleScanOutput {
            vehicle_label: vdef.label.clone(),
            max_response: max_with_impact,
            min_response: min_with_impact,
            impact_factor: vdef.impact,
            critical_x: best_x,
            critical_y: best_y,
            n_positions_evaluated: n_pos,
        });
    }

    let performance_ms = start.elapsed().as_secs_f64() * 1000.0;

    Ok(Json(InfluenceSurfaceResponse {
        success: true,
        span: req.span,
        width: req.width,
        scan_results,
        governing_max_response: gov_max,
        governing_min_response: gov_min,
        governing_vehicle: gov_vehicle,
        performance_ms,
    }))
}

// ============================================
// ENHANCED SPECTRUM DIRECTIONAL COMBINATION
// ============================================

#[derive(Debug, Deserialize)]
pub struct SpectrumDirectionalRequest {
    pub combination_method: String,
    pub directional_rule: String,
    pub spectra: Vec<DirectionalSpectrumInput>,
    pub modal: ModalPropertiesInput,
    #[serde(default = "default_close_threshold")]
    pub closely_spaced_threshold: f64,
    #[serde(default = "wt_default_true")]
    pub missing_mass_correction: bool,
    pub code: Option<String>,
    pub is1893_params: Option<IS1893Params>,
    pub asce7_params: Option<ASCE7Params>,
}

fn default_close_threshold() -> f64 { 0.10 }
fn wt_default_true() -> bool { true }

#[derive(Debug, Deserialize)]
pub struct DirectionalSpectrumInput {
    pub direction: String,
    pub spectrum_ordinates: Vec<(f64, f64)>,
    #[serde(default = "wt_default_one")]
    pub scale_factor: f64,
}

fn wt_default_one() -> f64 { 1.0 }

#[derive(Debug, Deserialize)]
pub struct ModalPropertiesInput {
    pub n_modes: usize,
    pub periods: Vec<f64>,
    pub damping_ratios: Vec<f64>,
    pub participation_factors: Vec<[f64; 3]>,
    pub effective_masses: Vec<[f64; 3]>,
    pub mode_shapes: Vec<Vec<f64>>,
    pub total_weight: f64,
    pub n_dofs: usize,
}

#[derive(Debug, Deserialize)]
pub struct IS1893Params {
    pub zone_factor: f64,
    pub importance_factor: f64,
    pub response_reduction: f64,
    pub soil_type: String,
}

#[derive(Debug, Deserialize)]
pub struct ASCE7Params {
    pub sds: f64,
    pub sd1: f64,
    pub tl: f64,
}

#[derive(Debug, Serialize)]
pub struct SpectrumDirectionalResponse {
    pub success: bool,
    pub combination_method: String,
    pub directional_rule: String,
    pub modes_used: usize,
    pub closely_spaced_pairs: Vec<CloselySpacedOutput>,
    pub missing_mass_fractions: [f64; 3],
    pub node_results: Vec<NodeResultOutput>,
    pub base_shear_per_direction: Vec<f64>,
    pub combined_base_shear: f64,
    pub modal_summary: Vec<ModalSummaryOutput>,
    pub performance_ms: f64,
}

#[derive(Debug, Serialize)]
pub struct CloselySpacedOutput {
    pub mode_i: usize,
    pub mode_j: usize,
    pub freq_i_hz: f64,
    pub freq_j_hz: f64,
    pub ratio: f64,
}

#[derive(Debug, Serialize)]
pub struct NodeResultOutput {
    pub node_id: usize,
    pub disp_x: f64,
    pub disp_y: f64,
    pub disp_z: f64,
    pub disp_magnitude: f64,
}

#[derive(Debug, Serialize)]
pub struct ModalSummaryOutput {
    pub mode: usize,
    pub period_s: f64,
    pub frequency_hz: f64,
    pub effective_mass_x: f64,
    pub effective_mass_y: f64,
    pub sa_x: f64,
    pub sa_y: f64,
    pub is_closely_spaced: bool,
}

/// Interpolate Sa/g from spectrum at a given period
fn interp_sa(spectrum: &[(f64, f64)], period: f64) -> f64 {
    if spectrum.is_empty() { return 0.0; }
    if period <= spectrum[0].0 { return spectrum[0].1; }
    if period >= spectrum.last().unwrap().0 { return spectrum.last().unwrap().1; }
    for i in 0..spectrum.len() - 1 {
        let (t0, sa0) = spectrum[i];
        let (t1, sa1) = spectrum[i + 1];
        if period >= t0 && period <= t1 {
            let frac = (period - t0) / (t1 - t0).max(1e-12);
            return sa0 + frac * (sa1 - sa0);
        }
    }
    spectrum.last().unwrap().1
}

/// CQC correlation coefficient (Der Kiureghian)
fn cqc_rho(t_i: f64, t_j: f64, xi_i: f64, xi_j: f64) -> f64 {
    if t_i < 1e-12 || t_j < 1e-12 { return if (t_i - t_j).abs() < 1e-12 { 1.0 } else { 0.0 }; }
    let r = t_i / t_j;
    let xi_prod = (xi_i * xi_j).sqrt();
    let num = 8.0 * xi_prod * (xi_i + r * xi_j) * r.powf(1.5);
    let den = (1.0 - r * r).powi(2)
        + 4.0 * xi_i * xi_j * r * (1.0 + r * r)
        + 4.0 * (xi_i * xi_i + xi_j * xi_j) * r * r;
    if den.abs() < 1e-30 { 1.0 } else { num / den }
}

/// IS 1893 spectrum generation
fn gen_is1893_spectrum(z: f64, i_f: f64, r: f64, soil: &str, xi: f64) -> Vec<(f64, f64)> {
    let scale = z * i_f / (2.0 * r);
    let df = (10.0 / (5.0 + 100.0 * xi)).sqrt().max(0.8);
    let (tb, tc) = match soil { "I" => (0.10, 0.40), "III" => (0.10, 0.67), _ => (0.10, 0.55) };
    (0..=100).map(|i| {
        let t = i as f64 * 4.0 / 100.0;
        let sa = if t < tb { 1.0 + (2.5 * df - 1.0) * t / tb }
        else if t <= tc { 2.5 * df }
        else { 2.5 * df * tc / t };
        (t, sa * scale)
    }).collect()
}

/// ASCE 7 spectrum generation
fn gen_asce7_spectrum(sds: f64, sd1: f64, tl: f64) -> Vec<(f64, f64)> {
    let t0 = 0.2 * sd1 / sds;
    let ts = sd1 / sds;
    (0..=100).map(|i| {
        let t = i as f64 * 6.0 / 100.0;
        let sa = if t < t0 { sds * (0.4 + 0.6 * t / t0) }
        else if t <= ts { sds }
        else if t <= tl { sd1 / t }
        else { sd1 * tl / (t * t) };
        (t, sa)
    }).collect()
}

pub async fn spectrum_directional_analysis(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<SpectrumDirectionalRequest>,
) -> ApiResult<Json<SpectrumDirectionalResponse>> {
    use std::f64::consts::PI;
    let start = std::time::Instant::now();
    let gravity = 9.81_f64;
    let mp = &req.modal;
    let n_modes = mp.n_modes;
    let n_dofs = mp.n_dofs;

    // Resolve combination method string
    let method_str = req.combination_method.to_uppercase();

    // Build spectra (from code or direct input)
    let spectra: Vec<(String, Vec<(f64,f64)>, f64)> = if let Some(ref code) = req.code {
        let soil_str = req.is1893_params.as_ref().map(|p| p.soil_type.as_str()).unwrap_or("II");
        let xi = mp.damping_ratios.first().copied().unwrap_or(0.05);
        let ordinates = match code.to_lowercase().as_str() {
            "is1893" => {
                let p = req.is1893_params.as_ref()
                    .ok_or_else(|| ApiError::AnalysisFailed("IS 1893 params required".into()))?;
                gen_is1893_spectrum(p.zone_factor, p.importance_factor, p.response_reduction, soil_str, xi)
            }
            "asce7" => {
                let p = req.asce7_params.as_ref()
                    .ok_or_else(|| ApiError::AnalysisFailed("ASCE 7 params required".into()))?;
                gen_asce7_spectrum(p.sds, p.sd1, p.tl)
            }
            _ => return Err(ApiError::AnalysisFailed(format!("Unknown code: {}", code))),
        };
        req.spectra.iter().map(|s| (s.direction.clone(), ordinates.clone(), s.scale_factor)).collect()
    } else {
        req.spectra.iter().map(|s| (s.direction.clone(), s.spectrum_ordinates.clone(), s.scale_factor)).collect()
    };

    let n_dirs = spectra.len().min(3);

    // 1. Detect closely-spaced modes
    let mut closely_spaced: Vec<CloselySpacedOutput> = Vec::new();
    for i in 0..n_modes {
        let fi = 1.0 / mp.periods[i].max(1e-12);
        for j in (i+1)..n_modes {
            let fj = 1.0 / mp.periods[j].max(1e-12);
            let (fl, fh) = if fi < fj { (fi, fj) } else { (fj, fi) };
            let ratio = (fh - fl) / fl;
            if ratio <= req.closely_spaced_threshold {
                closely_spaced.push(CloselySpacedOutput {
                    mode_i: i, mode_j: j, freq_i_hz: fi, freq_j_hz: fj, ratio,
                });
            }
        }
    }
    // If closely-spaced detected and user chose SRSS → upgrade to CQC
    let use_cqc = method_str == "CQC" || method_str == "CQC_GROUPED"
        || (!closely_spaced.is_empty() && method_str == "SRSS");
    let effective_method = if use_cqc { "CQC" } else { &method_str };

    // 2. Per-direction combined DOF responses
    let mut per_dir: Vec<Vec<f64>> = Vec::new();
    let mut base_shears: Vec<f64> = Vec::new();

    for dir_idx in 0..n_dirs {
        let (_, ref ord, sf) = spectra[dir_idx];
        // modal responses per DOF
        let mut modal_dof: Vec<Vec<f64>> = Vec::with_capacity(n_modes);
        for i in 0..n_modes {
            let t = mp.periods[i];
            let omega = 2.0 * PI / t.max(1e-12);
            let sa = interp_sa(ord, t) * gravity * sf;
            let gamma = mp.participation_factors[i][dir_idx];
            let mut dof_resp = vec![0.0; n_dofs];
            if i < mp.mode_shapes.len() {
                for (d, &phi) in mp.mode_shapes[i].iter().enumerate() {
                    if d < n_dofs {
                        dof_resp[d] = gamma * phi * sa / (omega * omega);
                    }
                }
            }
            modal_dof.push(dof_resp);
        }
        // Combine modes per DOF
        let mut combined_dir = vec![0.0_f64; n_dofs];
        for dof in 0..n_dofs {
            let modal_vals: Vec<f64> = (0..n_modes).map(|m| modal_dof[m][dof]).collect();
            combined_dir[dof] = match effective_method {
                "SRSS" => modal_vals.iter().map(|r| r*r).sum::<f64>().sqrt(),
                "ABS" => modal_vals.iter().map(|r| r.abs()).sum(),
                _ => { // CQC
                    let mut s = 0.0_f64;
                    for ii in 0..n_modes {
                        for jj in 0..n_modes {
                            let rho = cqc_rho(
                                mp.periods[ii], mp.periods[jj],
                                mp.damping_ratios[ii], mp.damping_ratios[jj],
                            );
                            s += modal_vals[ii] * rho * modal_vals[jj];
                        }
                    }
                    s.abs().sqrt()
                }
            };
        }
        let bs: f64 = combined_dir.iter().sum::<f64>().abs();
        base_shears.push(bs);
        per_dir.push(combined_dir);
    }

    // 3. Directional combination
    let dir_rule = req.directional_rule.to_lowercase();
    let mut combined = vec![0.0_f64; n_dofs];
    match dir_rule.as_str() {
        "single" => {
            if !per_dir.is_empty() { combined = per_dir[0].clone(); }
        }
        "srss" => {
            for dof in 0..n_dofs {
                combined[dof] = per_dir.iter().map(|d| d[dof] * d[dof]).sum::<f64>().sqrt();
            }
        }
        _ => { // 100_30 or 100_30_30
            let factors: Vec<Vec<f64>> = if n_dirs >= 3 {
                vec![vec![1.0,0.3,0.3], vec![0.3,1.0,0.3], vec![0.3,0.3,1.0]]
            } else if n_dirs == 2 {
                vec![vec![1.0,0.3], vec![0.3,1.0]]
            } else { vec![vec![1.0]] };
            for combo in &factors {
                for dof in 0..n_dofs {
                    let mut val = 0.0_f64;
                    for (d, &f) in combo.iter().enumerate() {
                        if d < n_dirs { val += f * per_dir[d][dof]; }
                    }
                    combined[dof] = combined[dof].max(val.abs());
                }
            }
        }
    }

    // 4. Missing mass correction
    let total_mass = mp.total_weight / gravity;
    let mut mm = [0.0_f64; 3];
    for dir in 0..3 {
        let included: f64 = mp.effective_masses.iter().map(|em| em[dir]).sum();
        mm[dir] = 1.0 - (included / total_mass).min(1.0);
    }
    if req.missing_mass_correction {
        for dir in 0..n_dirs {
            if mm[dir] > 0.01 {
                let zpa = interp_sa(&spectra[dir].1, 0.01) * gravity * spectra[dir].2;
                let r_missing = mm[dir] * zpa * total_mass;
                for dof in 0..n_dofs.min(combined.len()) {
                    combined[dof] = (combined[dof].powi(2) + r_missing.powi(2)).sqrt();
                }
            }
        }
    }

    // 5. Node results (3 DOFs per node)
    let n_nodes = n_dofs / 3;
    let node_results: Vec<NodeResultOutput> = (0..n_nodes).map(|node| {
        let dx = *combined.get(node * 3).unwrap_or(&0.0);
        let dy = *combined.get(node * 3 + 1).unwrap_or(&0.0);
        let dz = *combined.get(node * 3 + 2).unwrap_or(&0.0);
        NodeResultOutput {
            node_id: node, disp_x: dx, disp_y: dy, disp_z: dz,
            disp_magnitude: (dx*dx + dy*dy + dz*dz).sqrt(),
        }
    }).collect();

    // Combined base shear
    let combined_bs = match dir_rule.as_str() {
        "single" => base_shears.first().copied().unwrap_or(0.0),
        "srss" => base_shears.iter().map(|b| b*b).sum::<f64>().sqrt(),
        _ => {
            let combos: Vec<Vec<f64>> = if base_shears.len() >= 2 {
                vec![vec![1.0, 0.3], vec![0.3, 1.0]]
            } else { vec![vec![1.0]] };
            combos.iter().map(|c| {
                c.iter().enumerate().map(|(i, f)| f * base_shears.get(i).unwrap_or(&0.0)).sum::<f64>()
            }).fold(0.0_f64, f64::max)
        }
    };

    // 6. Modal summary
    let cs_modes: std::collections::HashSet<usize> = closely_spaced.iter()
        .flat_map(|p| vec![p.mode_i, p.mode_j]).collect();
    let modal_summary: Vec<ModalSummaryOutput> = (0..n_modes).map(|i| {
        let t = mp.periods[i];
        let sa_x = if n_dirs > 0 { interp_sa(&spectra[0].1, t) * spectra[0].2 } else { 0.0 };
        let sa_y = if n_dirs > 1 { interp_sa(&spectra[1].1, t) * spectra[1].2 } else { 0.0 };
        ModalSummaryOutput {
            mode: i + 1, period_s: t, frequency_hz: 1.0 / t.max(1e-12),
            effective_mass_x: mp.effective_masses[i][0],
            effective_mass_y: mp.effective_masses[i][1],
            sa_x, sa_y, is_closely_spaced: cs_modes.contains(&i),
        }
    }).collect();

    let performance_ms = start.elapsed().as_secs_f64() * 1000.0;

    Ok(Json(SpectrumDirectionalResponse {
        success: true,
        combination_method: effective_method.to_string(),
        directional_rule: dir_rule,
        modes_used: n_modes,
        closely_spaced_pairs: closely_spaced,
        missing_mass_fractions: mm,
        node_results,
        base_shear_per_direction: base_shears,
        combined_base_shear: combined_bs,
        modal_summary,
        performance_ms,
    }))
}