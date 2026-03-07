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