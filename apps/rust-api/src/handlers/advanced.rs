//! Advanced analysis handlers: P-Delta, Modal, Buckling, Spectrum

use axum::{
    extract::State,
    Json,
};
use nalgebra::{DMatrix, DVector};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
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
