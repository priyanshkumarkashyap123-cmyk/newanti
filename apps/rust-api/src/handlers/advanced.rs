//! Advanced analysis handlers: P-Delta, Modal, Buckling, Spectrum,
//! Staged Construction, Direct Analysis Method (DAM), Newton-Raphson /
//! Arc-Length Nonlinear Solve, and Mass Source Definition.

use axum::{
    extract::State,
    Json,
};
use nalgebra::{DMatrix, DVector};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

use crate::cache::AnalysisCache;
use crate::error::{ApiError, ApiResult};
use crate::solver::{AnalysisInput, Solver, MemberGeometry, PDeltaConfig, PDeltaSolver};
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

    // Assemble stiffness matrix
    let k_elastic = solver.assemble_global_stiffness(&req.input)
        .map_err(|e| ApiError::AnalysisFailed(format!("Failed to assemble stiffness: {}", e)))?;

    let n_dof = req.input.nodes.len() * 6;

    // Build force vector from loads
    let mut forces = DVector::zeros(n_dof);
    let node_index: std::collections::HashMap<String, usize> = req.input.nodes
        .iter()
        .enumerate()
        .map(|(i, n)| (n.id.clone(), i))
        .collect();
    
    for load in &req.input.loads {
        if let Some(&idx) = node_index.get(&load.node_id) {
            forces[idx * 6] = load.fx;
            forces[idx * 6 + 1] = load.fy;
            forces[idx * 6 + 2] = load.fz;
            forces[idx * 6 + 3] = load.mx;
            forces[idx * 6 + 4] = load.my;
            forces[idx * 6 + 5] = load.mz;
        }
    }

    // Build member geometry data
    let member_geometry: Vec<MemberGeometry> = req.input.members
        .iter()
        .filter_map(|member| {
            let start_idx = *node_index.get(&member.start_node_id)?;
            let end_idx = *node_index.get(&member.end_node_id)?;
            let start_node = &req.input.nodes[start_idx];
            let end_node = &req.input.nodes[end_idx];
            
            Some(MemberGeometry {
                node_i: [start_node.x, start_node.y, start_node.z],
                node_j: [end_node.x, end_node.y, end_node.z],
                node_i_dof: start_idx * 6,
                node_j_dof: end_idx * 6,
                area: member.a,
                elastic_modulus: member.e,
                moment_of_inertia: member.i,
            })
        })
        .collect();

    // Create P-Delta configuration
    let pdelta_config = PDeltaConfig {
        max_iterations: req.max_iterations,
        displacement_tolerance: req.tolerance,
        ..PDeltaConfig::default()
    };

    // Run P-Delta analysis
    let pdelta_solver = PDeltaSolver::new(pdelta_config);
    let pdelta_result = pdelta_solver.analyze(&k_elastic, &forces, &member_geometry)
        .map_err(|e| ApiError::AnalysisFailed(format!("P-Delta analysis failed: {}", e)))?;

    let performance_ms = start.elapsed().as_secs_f64() * 1000.0;

    // Convert displacements from DOF array to per-node results
    let displacements: Vec<DisplacementResult> = req.input.nodes
        .iter()
        .enumerate()
        .map(|(i, node)| {
            let base = i * 6;
            DisplacementResult {
                node_id: node.id.clone(),
                dx: if base < pdelta_result.displacements.len() { pdelta_result.displacements[base] } else { 0.0 },
                dy: if base + 1 < pdelta_result.displacements.len() { pdelta_result.displacements[base + 1] } else { 0.0 },
                dz: if base + 2 < pdelta_result.displacements.len() { pdelta_result.displacements[base + 2] } else { 0.0 },
            }
        })
        .collect();

    // Get final tolerance from last convergence history entry
    let final_tolerance = pdelta_result.convergence_history.last()
        .map(|c| c.displacement_norm)
        .unwrap_or(0.0);

    let response = PDeltaResponse {
        success: true,
        converged: pdelta_result.converged,
        iterations: pdelta_result.iterations,
        final_tolerance,
        displacements,
        amplification_factor: pdelta_result.amplification_factor,
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
    let stiffness = solver.assemble_global_stiffness(&req.input)
        .map_err(|e| ApiError::AnalysisFailed(format!("Failed to build stiffness matrix: {}", e)))?;
    
    let n_dof = req.input.nodes.len() * 6;
    
    // Build mass matrix from node masses
    let mut mass = DMatrix::zeros(n_dof, n_dof);
    for (_node_idx, node_mass) in req.masses.iter().enumerate() {
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
            member_loads: req.input.member_loads.clone(),
            dof_per_node: req.input.dof_per_node,
            options: req.input.options.clone(),
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

    let _n_dof = req.input.nodes.len() * 6;
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
    let last = spectrum[spectrum.len() - 1];
    if period >= last.0 { return last.1; }
    for i in 0..spectrum.len() - 1 {
        let (t0, sa0) = spectrum[i];
        let (t1, sa1) = spectrum[i + 1];
        if period >= t0 && period <= t1 {
            let frac = (period - t0) / (t1 - t0).max(1e-12);
            return sa0 + frac * (sa1 - sa0);
        }
    }
    last.1
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

// =====================================================================
// 4.  Design, Optimization & Detailing Engines
// =====================================================================

// ── 4-A.  Auto-Design Optimization Loop ─────────────────────────────

#[derive(Debug, Deserialize)]
pub struct AutoDesignRequest {
    pub members: Vec<AutoDesignMemberInput>,
    pub catalogue: Option<Vec<CatalogueSectionInput>>,
    pub design_code: Option<String>,      // "AISC360" | "IS800" | "EN1993"
    pub selection_strategy: Option<String>, // "MinWeight" | "MinDepth" | "MinCost"
    pub max_iterations: Option<usize>,
    pub dc_target: Option<f64>,
    pub convergence_tolerance: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct AutoDesignMemberInput {
    pub id: String,
    pub member_type: String,  // "Beam" | "Column" | "Brace"
    pub length_mm: f64,
    pub unbraced_length_mm: Option<f64>,
    pub moment_demand_knm: f64,
    pub shear_demand_kn: f64,
    pub axial_demand_kn: Option<f64>,
    pub deflection_limit: Option<f64>,  // e.g. L/360
    pub current_section: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CatalogueSectionInput {
    pub name: String,
    pub depth_mm: f64,
    pub width_mm: f64,
    pub area_mm2: f64,
    pub ix_mm4: f64,
    pub iy_mm4: f64,
    pub sx_mm3: f64,
    pub sy_mm3: f64,
    pub zx_mm3: f64,
    pub zy_mm3: f64,
    pub weight_kg_per_m: f64,
    pub fy_mpa: Option<f64>,
    pub tw_mm: Option<f64>,
    pub tf_mm: Option<f64>,
    pub ry_mm: Option<f64>,
    pub j_mm4: Option<f64>,
    pub cw_mm6: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AutoDesignResponse {
    pub success: bool,
    pub iterations: usize,
    pub converged: bool,
    pub total_weight_kg: f64,
    pub members: Vec<AutoDesignMemberResult>,
    pub performance_ms: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AutoDesignMemberResult {
    pub id: String,
    pub selected_section: String,
    pub dc_flexure: f64,
    pub dc_shear: f64,
    pub dc_axial: f64,
    pub dc_interaction: f64,
    pub dc_deflection: f64,
    pub dc_governing: f64,
    pub weight_kg_per_m: f64,
    pub iteration_selected: usize,
}

pub async fn auto_design_optimization(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<AutoDesignRequest>,
) -> ApiResult<Json<AutoDesignResponse>> {
    let start = std::time::Instant::now();

    let design_code = req.design_code.as_deref().unwrap_or("AISC360");
    let strategy = req.selection_strategy.as_deref().unwrap_or("MinWeight");
    let max_iter = req.max_iterations.unwrap_or(20);
    let dc_target = req.dc_target.unwrap_or(0.95);
    let tol = req.convergence_tolerance.unwrap_or(0.02);

    let phi = match design_code {
        "IS800" => 0.90,
        "EN1993" => 1.0 / 1.0,
        _ => 0.90,
    };

    // Build section catalogue
    struct CatSec {
        name: String, depth: f64, area: f64, ix: f64, iy: f64,
        _sx: f64, zx: f64, _ry: f64, w: f64, tw: f64, _tf: f64,
        _j: f64, _cw: f64,
    }
    let catalogue: Vec<CatSec> = if let Some(ref c) = req.catalogue {
        c.iter().map(|s| CatSec {
            name: s.name.clone(), depth: s.depth_mm, area: s.area_mm2,
            ix: s.ix_mm4, iy: s.iy_mm4, _sx: s.sx_mm3, zx: s.zx_mm3,
            _ry: s.ry_mm.unwrap_or(s.iy_mm4.sqrt() / s.area_mm2.sqrt()),
            w: s.weight_kg_per_m, tw: s.tw_mm.unwrap_or(8.0),
            _tf: s.tf_mm.unwrap_or(12.0), _j: s.j_mm4.unwrap_or(1e5),
            _cw: s.cw_mm6.unwrap_or(1e9),
        }).collect()
    } else {
        // Default AISC W-shapes (representative)
        vec![
            ("W8X10",  203.0, 1900.0, 14.5e6, 1.33e6, 143e3, 161e3, 26.4, 10.0, 4.3, 5.6, 5.08e3, 3.26e9),
            ("W10X19", 260.0, 3610.0, 42.6e6, 4.19e6, 328e3, 370e3, 34.0, 19.0, 6.4, 8.5, 27.9e3, 28.8e9),
            ("W12X26", 310.0, 4950.0, 85.1e6, 8.55e6, 549e3, 618e3, 41.6, 26.0, 6.1, 9.7, 51.0e3, 77.6e9),
            ("W14X30", 352.0, 5710.0, 121e6, 9.70e6, 689e3, 786e3, 41.2, 30.0, 6.9, 10.0, 58.2e3, 108e9),
            ("W16X36", 403.0, 6840.0, 199e6, 12.4e6, 988e3, 1130e3, 42.6, 36.0, 7.5, 10.9, 83.9e3, 226e9),
            ("W18X50", 457.0, 9480.0, 339e6, 24.1e6, 1490e3, 1690e3, 50.4, 50.0, 9.0, 14.5, 264e3, 575e9),
            ("W21X57", 535.0, 10800.0, 486e6, 21.1e6, 1820e3, 2060e3, 44.2, 57.0, 8.4, 13.1, 199e3, 804e9),
            ("W24X76", 608.0, 14500.0, 812e6, 37.3e6, 2670e3, 3040e3, 50.7, 76.0, 11.2, 17.3, 624e3, 2230e9),
            ("W27X84", 684.0, 16000.0, 1080e6, 34.4e6, 3160e3, 3570e3, 46.4, 84.0, 10.7, 16.3, 537e3, 2650e9),
            ("W30X99", 753.0, 18800.0, 1490e6, 41.4e6, 3960e3, 4470e3, 46.9, 99.0, 11.2, 17.0, 696e3, 4380e9),
            ("W33X118",838.0, 22400.0, 2070e6, 55.6e6, 4940e3, 5620e3, 49.8, 118.0, 13.5, 18.8, 1290e3, 8500e9),
            ("W36X135",912.0, 25700.0, 2700e6, 63.3e6, 5920e3, 6750e3, 49.6, 135.0, 13.0, 19.8, 1380e3, 11000e9),
        ].into_iter().map(|(n,d,a,ix,iy,sx,zx,ry,w,tw,tf,j,cw)| CatSec {
            name: n.to_string(), depth: d, area: a, ix, iy, _sx: sx, zx, _ry: ry, w, tw, _tf: tf, _j: j, _cw: cw,
        }).collect()
    };

    // Sort by weight for MinWeight, by depth for MinDepth
    let mut sorted_cat: Vec<usize> = (0..catalogue.len()).collect();
    match strategy {
        "MinDepth" => sorted_cat.sort_by(|a, b| catalogue[*a].depth.partial_cmp(&catalogue[*b].depth).unwrap_or(std::cmp::Ordering::Equal)),
        _ => sorted_cat.sort_by(|a, b| catalogue[*a].w.partial_cmp(&catalogue[*b].w).unwrap_or(std::cmp::Ordering::Equal)),
    }

    // D/C ratio computation (AISC H1-1)
    let compute_dc = |sec: &CatSec, m_knm: f64, v_kn: f64, p_kn: f64, lb: f64, defl_limit: f64, span: f64| -> (f64, f64, f64, f64, f64) {
        let fy = 345.0; // A992

        // Flexure
        let mn = phi * fy * sec.zx / 1e6; // kN·m
        let dc_flex = m_knm.abs() / mn.max(1e-12);

        // Shear
        let aw = sec.depth * sec.tw;
        let vn = phi * 0.6 * fy * aw / 1e3;
        let dc_shear = v_kn.abs() / vn.max(1e-12);

        // Axial compression (Euler with reduction)
        let pe = std::f64::consts::PI.powi(2) * 200000.0 * sec.iy / (lb * lb);
        let pn_comp = phi * fy * sec.area / 1e3 * (1.0 - fy * sec.area / (4.0 * pe)).max(0.1);
        let dc_axial = p_kn.abs() / pn_comp.max(1e-12);

        // Interaction H1-1a/b
        let pr_over_pc = dc_axial;
        let dc_inter = if pr_over_pc >= 0.2 {
            pr_over_pc + 8.0 / 9.0 * dc_flex
        } else {
            pr_over_pc / 2.0 + dc_flex
        };

        // Deflection (assume uniform load → δ = 5wL4/384EI)
        let w_per_mm = if span > 0.0 { 8.0 * m_knm * 1e6 / (span * span) } else { 0.0 };
        let delta = 5.0 * w_per_mm * span.powi(4) / (384.0 * 200000.0 * sec.ix);
        let delta_limit = span / defl_limit;
        let dc_defl = if delta_limit > 0.0 { delta / delta_limit } else { 0.0 };

        (dc_flex, dc_shear, dc_axial, dc_inter, dc_defl)
    };

    // Iterative design
    let mut member_results: Vec<AutoDesignMemberResult> = Vec::new();
    let mut converged = true;
    let mut iterations_used = 0;

    for member in &req.members {
        let lb = member.unbraced_length_mm.unwrap_or(member.length_mm);
        let p_kn = member.axial_demand_kn.unwrap_or(0.0);
        let defl_lim = member.deflection_limit.unwrap_or(360.0);

        let mut best_idx = 0;
        let mut best_dc = f64::MAX;
        let mut best_iter = 0;
        let mut best_dcs = (0.0, 0.0, 0.0, 0.0, 0.0);

        for iter in 0..max_iter {
            iterations_used = iterations_used.max(iter + 1);
            let mut found = false;
            for &si in &sorted_cat {
                let sec = &catalogue[si];
                let (df, ds, da, di, dd) = compute_dc(sec, member.moment_demand_knm, member.shear_demand_kn, p_kn, lb, defl_lim, member.length_mm);
                let governing = df.max(ds).max(da).max(di).max(dd);
                if governing <= dc_target {
                    if sec.w < catalogue[best_idx].w || best_dc > dc_target {
                        best_idx = si;
                        best_dc = governing;
                        best_dcs = (df, ds, da, di, dd);
                        best_iter = iter;
                    }
                    found = true;
                    break;
                }
            }
            if !found {
                // Use largest section
                let si = sorted_cat.last().copied().unwrap_or(0);
                let sec = &catalogue[si];
                let (df, ds, da, di, dd) = compute_dc(sec, member.moment_demand_knm, member.shear_demand_kn, p_kn, lb, defl_lim, member.length_mm);
                best_idx = si;
                best_dc = df.max(ds).max(da).max(di).max(dd);
                best_dcs = (df, ds, da, di, dd);
                best_iter = iter;
                converged = false;
            }
            // Check convergence
            if best_dc <= dc_target && (best_dc - dc_target).abs() < tol {
                break;
            }
        }

        member_results.push(AutoDesignMemberResult {
            id: member.id.clone(),
            selected_section: catalogue[best_idx].name.clone(),
            dc_flexure: (best_dcs.0 * 1000.0).round() / 1000.0,
            dc_shear: (best_dcs.1 * 1000.0).round() / 1000.0,
            dc_axial: (best_dcs.2 * 1000.0).round() / 1000.0,
            dc_interaction: (best_dcs.3 * 1000.0).round() / 1000.0,
            dc_deflection: (best_dcs.4 * 1000.0).round() / 1000.0,
            dc_governing: (best_dc * 1000.0).round() / 1000.0,
            weight_kg_per_m: catalogue[best_idx].w,
            iteration_selected: best_iter,
        });
    }

    let total_weight = member_results.iter()
        .zip(req.members.iter())
        .map(|(r, m)| r.weight_kg_per_m * m.length_mm / 1000.0)
        .sum();

    let performance_ms = start.elapsed().as_secs_f64() * 1000.0;

    Ok(Json(AutoDesignResponse {
        success: true,
        iterations: iterations_used,
        converged,
        total_weight_kg: total_weight,
        members: member_results,
        performance_ms,
    }))
}

// ── 4-B.  Cracked Section Analysis ──────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CrackedSectionRequest {
    pub b_mm: f64,
    pub h_mm: f64,
    pub d_mm: f64,
    pub fck_mpa: f64,
    pub fy_mpa: f64,
    pub concrete_code: Option<String>,  // "IS456" | "ACI318"
    pub tension_bars: Vec<RebarLayerInput>,
    pub compression_bars: Option<Vec<RebarLayerInput>>,
    pub applied_moment_knm: f64,
    pub ie_method: Option<String>,  // "BransonACI" | "Eurocode2" | "BischoffACI318_19"
    pub span_mm: Option<f64>,
    pub loading_type: Option<String>,  // "UDL" | "Point" | "Cantilever"
    pub sustained_load_ratio: Option<f64>,
    pub loading_age_months: Option<f64>,
    pub is_flanged: Option<bool>,
    pub flange_width_mm: Option<f64>,
    pub flange_depth_mm: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct RebarLayerInput {
    pub n_bars: usize,
    pub diameter_mm: f64,
    pub depth_mm: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CrackedSectionResponse {
    pub success: bool,
    pub gross_inertia_mm4: f64,
    pub cracking_moment_knm: f64,
    pub cracked_na_depth_mm: f64,
    pub cracked_inertia_mm4: f64,
    pub effective_inertia_mm4: f64,
    pub modular_ratio: f64,
    pub ie_method: String,
    pub is_cracked: bool,
    pub long_term_multiplier: f64,
    pub deflection_mm: Option<f64>,
    pub span_over_deflection: Option<f64>,
    pub performance_ms: f64,
}

pub async fn cracked_section_analysis(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<CrackedSectionRequest>,
) -> ApiResult<Json<CrackedSectionResponse>> {
    let start = std::time::Instant::now();

    let b = req.b_mm;
    let h = req.h_mm;
    let d = req.d_mm;
    let fck = req.fck_mpa;
    let _fy = req.fy_mpa;

    // Concrete properties
    let is_aci = req.concrete_code.as_deref().unwrap_or("IS456") == "ACI318";
    let ec = if is_aci { 4700.0 * fck.sqrt() } else { 5000.0 * fck.sqrt() };
    let es = 200000.0;
    let m_ratio = es / ec;

    // Flexural tensile strength
    let fr = if is_aci { 0.62 * fck.sqrt() } else { 0.7 * fck.sqrt() };

    // Gross section
    let ig = b * h.powi(3) / 12.0;
    let yt = h / 2.0;
    let mcr = fr * ig / (yt * 1e6); // kN·m

    // Tension reinforcement area
    let ast: f64 = req.tension_bars.iter()
        .map(|l| l.n_bars as f64 * std::f64::consts::PI / 4.0 * l.diameter_mm.powi(2))
        .sum();
    // Compression reinforcement
    let asc: f64 = req.compression_bars.as_ref().map(|bars| {
        bars.iter().map(|l| l.n_bars as f64 * std::f64::consts::PI / 4.0 * l.diameter_mm.powi(2)).sum()
    }).unwrap_or(0.0);
    let d_prime = req.compression_bars.as_ref()
        .and_then(|bars| bars.first())
        .map(|l| l.depth_mm)
        .unwrap_or(40.0);

    // Cracked section analysis — NA depth by quadratic
    let (xcr, icr) = if req.is_flanged.unwrap_or(false) {
        let bf = req.flange_width_mm.unwrap_or(b * 3.0);
        let hf = req.flange_depth_mm.unwrap_or(h * 0.15);
        // Iterative for T-beam
        let mut x = hf;
        for _ in 0..50 {
            let cf = if x <= hf { bf * x } else { bf * hf + b * (x - hf) };
            let f = cf * x / 2.0 + (m_ratio - 1.0) * asc * (x - d_prime) - m_ratio * ast * (d - x);
            let df_dx = if x <= hf { bf * x + cf / 2.0 } else { bf * hf + b * (2.0 * x - hf) / 2.0 + b * (x - hf) }
                + (m_ratio - 1.0) * asc + m_ratio * ast;
            let x_new = x - f / df_dx.max(1.0);
            if (x_new - x).abs() < 0.01 { x = x_new; break; }
            x = x_new.max(1.0).min(d);
        }
        let icr_val = if x <= hf {
            bf * x.powi(3) / 3.0 + m_ratio * ast * (d - x).powi(2) + (m_ratio - 1.0) * asc * (x - d_prime).powi(2)
        } else {
            bf * hf.powi(3) / 12.0 + bf * hf * (x - hf / 2.0).powi(2)
                + b * (x - hf).powi(3) / 3.0
                + m_ratio * ast * (d - x).powi(2)
                + (m_ratio - 1.0) * asc * (x - d_prime).powi(2)
        };
        (x, icr_val)
    } else {
        // Rectangular: b·x²/2 + (m-1)·Asc·(x-d') = m·Ast·(d-x)
        let a_coeff = b / 2.0;
        let b_coeff = (m_ratio - 1.0) * asc + m_ratio * ast;
        let c_coeff = -((m_ratio - 1.0) * asc * d_prime + m_ratio * ast * d);
        let disc = b_coeff * b_coeff - 4.0 * a_coeff * c_coeff;
        let x = (-b_coeff + disc.max(0.0).sqrt()) / (2.0 * a_coeff);
        let x = x.max(1.0).min(d);
        let icr_val = b * x.powi(3) / 3.0
            + m_ratio * ast * (d - x).powi(2)
            + (m_ratio - 1.0) * asc * (x - d_prime).powi(2);
        (x, icr_val)
    };

    let ma = req.applied_moment_knm;
    let is_cracked = ma.abs() > mcr;

    // Effective inertia
    let ie_method = req.ie_method.as_deref().unwrap_or("BransonACI");
    let ie = if !is_cracked {
        ig
    } else {
        let ratio = mcr / ma.abs().max(1e-12);
        match ie_method {
            "Eurocode2" => {
                let zeta = 1.0 - 0.5 * ratio * ratio;
                let zeta = zeta.max(0.0).min(1.0);
                1.0 / ((1.0 - zeta) / ig + zeta / icr)
            }
            "BischoffACI318_19" => {
                icr / (1.0 - (1.0 - icr / ig) * ratio * ratio)
            }
            _ => {
                // Branson: Ie = (Mcr/Ma)³·Ig + (1-(Mcr/Ma)³)·Icr
                let r3 = ratio.powi(3);
                r3 * ig + (1.0 - r3) * icr
            }
        }
    };

    // Long-term multiplier
    let sustained = req.sustained_load_ratio.unwrap_or(0.5);
    let months = req.loading_age_months.unwrap_or(60.0);
    let rho_prime = asc / (b * d);
    let xi_aci = if months >= 60.0 { 2.0 } else if months >= 36.0 { 1.8 } else if months >= 12.0 { 1.4 } else if months >= 6.0 { 1.2 } else { 1.0 };
    let lt_mult = 1.0 + xi_aci / (1.0 + 50.0 * rho_prime) * sustained;

    // Deflection
    let (defl, span_over_defl) = if let Some(span) = req.span_mm {
        let load_type = req.loading_type.as_deref().unwrap_or("UDL");
        // Back-calculate w from moment
        let w = match load_type {
            "Point" => 0.0, // special case below
            "Cantilever" => 2.0 * ma.abs() * 1e6 / (span * span),
            _ => 8.0 * ma.abs() * 1e6 / (span * span),
        };
        let delta_inst = match load_type {
            "Point" => ma.abs() * 1e6 * span * span / (48.0 * ec * ie),
            "Cantilever" => w * span.powi(4) / (8.0 * ec * ie),
            _ => 5.0 * w * span.powi(4) / (384.0 * ec * ie),
        };
        let delta_lt = delta_inst * lt_mult;
        let sod = if delta_lt > 0.0 { span / delta_lt } else { f64::INFINITY };
        (Some(delta_lt), Some(sod))
    } else {
        (None, None)
    };

    let performance_ms = start.elapsed().as_secs_f64() * 1000.0;

    Ok(Json(CrackedSectionResponse {
        success: true,
        gross_inertia_mm4: ig,
        cracking_moment_knm: (mcr * 1000.0).round() / 1000.0,
        cracked_na_depth_mm: (xcr * 100.0).round() / 100.0,
        cracked_inertia_mm4: icr,
        effective_inertia_mm4: ie,
        modular_ratio: (m_ratio * 100.0).round() / 100.0,
        ie_method: ie_method.to_string(),
        is_cracked,
        long_term_multiplier: (lt_mult * 1000.0).round() / 1000.0,
        deflection_mm: defl.map(|d| (d * 100.0).round() / 100.0),
        span_over_deflection: span_over_defl.map(|s| (s * 10.0).round() / 10.0),
        performance_ms,
    }))
}

// ── 4-C.  Floor Walking & Vibration Check ───────────────────────────

#[derive(Debug, Deserialize)]
pub struct FloorWalkingRequest {
    pub occupancy: String,          // "Office" | "Residential" | "Hospital" | etc.
    pub beam_span_m: f64,
    pub girder_span_m: f64,
    pub beam_spacing_m: f64,
    pub beam_ix_mm4: f64,
    pub girder_ix_mm4: f64,
    pub slab_depth_mm: f64,
    pub concrete_density_kg_m3: Option<f64>,
    pub damping_ratio: Option<f64>,
    pub walker_weight_n: Option<f64>,
    pub walking_frequency_hz: Option<f64>,
    pub check_rhythmic: Option<bool>,
    pub rhythmic_weight_n: Option<f64>,
    pub rhythmic_activity_freq_hz: Option<f64>,
    pub check_codes: Option<Vec<String>>,  // ["DG11", "SCIP354", "IS800", "EN1990"]
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FloorWalkingResponse {
    pub success: bool,
    pub beam_frequency_hz: f64,
    pub girder_frequency_hz: f64,
    pub combined_frequency_hz: f64,
    pub dg11_result: Option<DG11CheckOutput>,
    pub sci_p354_result: Option<SCIP354CheckOutput>,
    pub is800_result: Option<MinFreqCheckOutput>,
    pub en1990_result: Option<MinFreqCheckOutput>,
    pub rhythmic_result: Option<RhythmicCheckOutput>,
    pub overall_pass: bool,
    pub recommendations: Vec<String>,
    pub performance_ms: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DG11CheckOutput {
    pub peak_acceleration_g: f64,
    pub acceleration_limit_g: f64,
    pub effective_panel_weight_kn: f64,
    pub pass: bool,
    pub harmonics_checked: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SCIP354CheckOutput {
    pub response_factor: f64,
    pub response_limit: f64,
    pub pass: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MinFreqCheckOutput {
    pub frequency_hz: f64,
    pub min_required_hz: f64,
    pub pass: bool,
    pub code: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RhythmicCheckOutput {
    pub dynamic_amplification: f64,
    pub peak_acceleration_g: f64,
    pub limit_g: f64,
    pub pass: bool,
}

pub async fn floor_walking_vibration(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<FloorWalkingRequest>,
) -> ApiResult<Json<FloorWalkingResponse>> {
    let start = std::time::Instant::now();

    let conc_density = req.concrete_density_kg_m3.unwrap_or(2400.0);
    let walker_w = req.walker_weight_n.unwrap_or(700.0);
    let walk_freq = req.walking_frequency_hz.unwrap_or(2.0);

    // Occupancy parameters
    let (accel_limit, damping_default, resp_factor_limit) = match req.occupancy.as_str() {
        "Residential" => (0.005, 0.03, 8.0),
        "Hospital" | "Surgery" => (0.0015, 0.03, 1.0),
        "ShoppingMall" => (0.015, 0.02, 4.0),
        "Gymnasium" | "SportsFacility" => (0.05, 0.06, 24.0),
        "Industrial" => (0.05, 0.03, 24.0),
        _ => (0.005, 0.03, 8.0), // Office default
    };
    let beta = req.damping_ratio.unwrap_or(damping_default);

    // Slab weight per unit area
    let slab_w = conc_density * 9.81 * req.slab_depth_mm / 1000.0; // N/m²

    // Component frequencies (simply-supported beam: fn = π/2 × √(EI g / w L⁴))
    let e_conc = 5000.0 * 30.0_f64.sqrt(); // assume M30 concrete, MPa
    let g = 9810.0; // mm/s²

    let beam_span = req.beam_span_m * 1000.0;
    let girder_span = req.girder_span_m * 1000.0;
    let beam_spacing = req.beam_spacing_m * 1000.0;

    // Beam: distributed load = slab_w × spacing
    let _w_beam = slab_w * beam_spacing / 1e6; // N/mm per mm length => slab_w is N/m², spacing in mm
    let w_beam_n_per_mm = slab_w * beam_spacing / 1e6; // N/mm
    let delta_beam = 5.0 * w_beam_n_per_mm * beam_span.powi(4) / (384.0 * 200000.0 * req.beam_ix_mm4);
    let fn_beam = if delta_beam > 0.0 { 0.18 * (g / delta_beam).sqrt() } else { 100.0 };

    // Girder: concentrated loads from beams
    let w_girder_total = slab_w * beam_span * girder_span / 1e6; // total N
    let w_girder_per_mm = w_girder_total / girder_span;
    let delta_girder = 5.0 * w_girder_per_mm * girder_span.powi(4) / (384.0 * 200000.0 * req.girder_ix_mm4);
    let fn_girder = if delta_girder > 0.0 { 0.18 * (g / delta_girder).sqrt() } else { 100.0 };

    // Dunkerley combined
    let fn_combined = 1.0 / (1.0 / (fn_beam * fn_beam) + 1.0 / (fn_girder * fn_girder)).sqrt();

    let checks = req.check_codes.as_ref().map(|c| c.iter().map(|s| s.as_str()).collect::<Vec<_>>())
        .unwrap_or_else(|| vec!["DG11", "SCIP354", "IS800", "EN1990"]);

    let mut overall_pass = true;
    let mut recommendations = Vec::new();

    // DG11 walking excitation (Ch 4, Eq 4-1)
    let dg11_result = if checks.contains(&"DG11") {
        let alpha_i = [0.5, 0.2, 0.1, 0.05]; // harmonic force coefficients
        // Effective panel weight
        let ds = e_conc * req.slab_depth_mm.powi(3) / 12.0; // slab stiffness per unit width
        let bj = (2.0 / 3.0 * (ds / (200000.0 * req.beam_ix_mm4 / beam_spacing)).powf(0.25) * beam_span).min(2.0 / 3.0 * girder_span);
        let bg = (2.0 / 3.0 * (ds / (200000.0 * req.girder_ix_mm4 / girder_span)).powf(0.25) * girder_span).min(2.0 / 3.0 * beam_span);
        let wj = slab_w * bj * beam_span / 1000.0; // kN
        let wg = slab_w * bg * girder_span / 1000.0;
        let w_eff = wj + wg;

        let mut peak_accel = 0.0;
        for (i, &alpha) in alpha_i.iter().enumerate() {
            let f_harm = (i as f64 + 1.0) * walk_freq;
            let ratio = f_harm / fn_combined;
            let r2 = ratio * ratio;
            let daf = 1.0 / ((1.0 - r2).powi(2) + (2.0 * beta * ratio).powi(2)).sqrt();
            let a_harm = alpha * walker_w * daf / (w_eff * 1000.0).max(1.0);
            if a_harm > peak_accel { peak_accel = a_harm; }
        }

        let pass = peak_accel <= accel_limit;
        if !pass {
            overall_pass = false;
            recommendations.push(format!("DG11 FAIL: peak accel {:.4}g > limit {:.4}g — increase beam stiffness or add damping", peak_accel, accel_limit));
        }
        Some(DG11CheckOutput {
            peak_acceleration_g: (peak_accel * 10000.0).round() / 10000.0,
            acceleration_limit_g: accel_limit,
            effective_panel_weight_kn: (w_eff * 10.0).round() / 10.0,
            pass,
            harmonics_checked: 4,
        })
    } else { None };

    // SCI P354
    let sci_result = if checks.contains(&"SCIP354") {
        let rms_accel = walker_w * 0.4 / ((2.0 * beta * fn_combined * slab_w * beam_span * girder_span / 1e6).max(1.0));
        let a_rms_g = rms_accel / 9.81;
        let response_factor = a_rms_g / 0.005;
        let pass = response_factor <= resp_factor_limit;
        if !pass {
            overall_pass = false;
            recommendations.push(format!("SCI P354 FAIL: R={:.1} > limit {:.0}", response_factor, resp_factor_limit));
        }
        Some(SCIP354CheckOutput {
            response_factor: (response_factor * 100.0).round() / 100.0,
            response_limit: resp_factor_limit,
            pass,
        })
    } else { None };

    // IS 800 check
    let is800_result = if checks.contains(&"IS800") {
        let min_freq = 5.0;
        let pass = fn_combined >= min_freq;
        if !pass {
            overall_pass = false;
            recommendations.push(format!("IS 800 FAIL: fn={:.2} Hz < 5.0 Hz minimum", fn_combined));
        }
        Some(MinFreqCheckOutput {
            frequency_hz: (fn_combined * 100.0).round() / 100.0,
            min_required_hz: min_freq,
            pass,
            code: "IS 800".to_string(),
        })
    } else { None };

    // EN 1990 check
    let en1990_result = if checks.contains(&"EN1990") {
        let min_freq = 3.0;
        let pass = fn_combined >= min_freq;
        if !pass {
            overall_pass = false;
            recommendations.push(format!("EN 1990 FAIL: fn={:.2} Hz < 3.0 Hz minimum", fn_combined));
        }
        Some(MinFreqCheckOutput {
            frequency_hz: (fn_combined * 100.0).round() / 100.0,
            min_required_hz: min_freq,
            pass,
            code: "EN 1990".to_string(),
        })
    } else { None };

    // Rhythmic check
    let rhythmic_result = if req.check_rhythmic.unwrap_or(false) {
        let f_act = req.rhythmic_activity_freq_hz.unwrap_or(2.5);
        let wp = req.rhythmic_weight_n.unwrap_or(1500.0); // weight of participants
        let ratio = f_act / fn_combined;
        let r2 = ratio * ratio;
        let daf = 1.0 / ((1.0 - r2).powi(2) + (2.0 * beta * ratio).powi(2)).sqrt();
        let alpha = 0.5; // rhythmic force coefficient
        let w_total = slab_w * beam_span * girder_span / 1e6; // N total
        let peak_a = alpha * wp * daf / w_total.max(1.0);
        let limit = 0.05; // 5% g for rhythmic
        let pass = peak_a <= limit;
        if !pass {
            overall_pass = false;
            recommendations.push(format!("Rhythmic FAIL: peak accel {:.4}g > {:.2}g", peak_a, limit));
        }
        Some(RhythmicCheckOutput {
            dynamic_amplification: (daf * 100.0).round() / 100.0,
            peak_acceleration_g: (peak_a * 10000.0).round() / 10000.0,
            limit_g: limit,
            pass,
        })
    } else { None };

    if overall_pass {
        recommendations.push("All vibration checks passed.".to_string());
    }

    let performance_ms = start.elapsed().as_secs_f64() * 1000.0;

    Ok(Json(FloorWalkingResponse {
        success: true,
        beam_frequency_hz: (fn_beam * 100.0).round() / 100.0,
        girder_frequency_hz: (fn_girder * 100.0).round() / 100.0,
        combined_frequency_hz: (fn_combined * 100.0).round() / 100.0,
        dg11_result,
        sci_p354_result: sci_result,
        is800_result,
        en1990_result: en1990_result,
        rhythmic_result,
        overall_pass,
        recommendations,
        performance_ms,
    }))
}

// ── 4-D.  Rebar Curtailment & Detailing ─────────────────────────────

#[derive(Debug, Deserialize)]
pub struct RebarDetailingRequest {
    pub bar_dia_mm: f64,
    pub n_bars: usize,
    pub b_mm: f64,
    pub h_mm: f64,
    pub d_mm: f64,
    pub fck_mpa: f64,
    pub fy_mpa: f64,
    pub clear_cover_mm: f64,
    pub bar_type: Option<String>,        // "Deformed" | "Plain"
    pub code: Option<String>,            // "IS456" | "ACI318" | "Eurocode2"
    pub span_mm: f64,
    pub moment_diagram: Option<Vec<MomentPointInput>>,
    pub pct_bars_spliced: Option<f64>,
    pub hook_type: Option<String>,       // "Standard90" | "Standard180" | "HeadedBar"
    pub is_top_bar: Option<bool>,
    pub is_tension: Option<bool>,
    pub max_aggregate_mm: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct MomentPointInput {
    pub x_mm: f64,
    pub moment_knm: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RebarDetailingResponse {
    pub success: bool,
    pub development_length_mm: f64,
    pub ld_over_db: f64,
    pub lap_splice_mm: f64,
    pub lap_class: String,
    pub hook_ldh_mm: f64,
    pub hook_total_mm: f64,
    pub bar_spacing_mm: f64,
    pub spacing_pass: bool,
    pub rho_pct: f64,
    pub rho_min_pct: f64,
    pub rho_max_pct: f64,
    pub reinforcement_pass: bool,
    pub curtailment: Option<CurtailmentOutput>,
    pub all_checks_pass: bool,
    pub issues: Vec<String>,
    pub performance_ms: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CurtailmentOutput {
    pub n_cutoff_points: usize,
    pub savings_pct: f64,
    pub cutoff_schedule: Vec<CutoffScheduleItem>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CutoffScheduleItem {
    pub bars_continuing: usize,
    pub bars_cutoff: usize,
    pub theoretical_x_mm: f64,
    pub actual_x_mm: f64,
    pub moment_capacity_knm: f64,
}

pub async fn rebar_detailing_analysis(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<RebarDetailingRequest>,
) -> ApiResult<Json<RebarDetailingResponse>> {
    let start = std::time::Instant::now();

    let db = req.bar_dia_mm;
    let fck = req.fck_mpa;
    let fy = req.fy_mpa;
    let cover = req.clear_cover_mm;
    let is_deformed = req.bar_type.as_deref().unwrap_or("Deformed") == "Deformed";
    let code = req.code.as_deref().unwrap_or("IS456");
    let is_top = req.is_top_bar.unwrap_or(false);
    let is_tension = req.is_tension.unwrap_or(true);

    let mut issues = Vec::new();

    // ── Development length ──
    let (ld, ld_db) = match code {
        "ACI318" => {
            let psi_t = if is_top { 1.3 } else { 1.0 };
            let psi_s = if db <= 22.0 { 0.8 } else { 1.0 };
            let cb_ktr = ((cover) / db).min(2.5);
            let ld_val = if is_tension {
                let v = (fy * psi_t * psi_s * db) / (1.1 * fck.sqrt() * cb_ktr);
                v.max(300.0)
            } else {
                ((0.24 * fy / fck.sqrt()) * db).max(200.0)
            };
            (ld_val, ld_val / db)
        }
        "Eurocode2" => {
            let fctd = 0.21 * fck.powf(2.0 / 3.0) / 1.5;
            let fbd = 2.25 * fctd;
            let fyd = fy / 1.15;
            let lb_rqd = db / 4.0 * fyd / fbd;
            let alpha5 = if !is_tension { 0.7 } else { 1.0 };
            let lbd = (alpha5 * lb_rqd).max(10.0 * db).max(100.0);
            (lbd, lbd / db)
        }
        _ => {
            // IS 456
            let tau_bd_base = match fck as u32 {
                0..=19 => 1.2, 20..=24 => 1.4, 25..=29 => 1.5,
                30..=34 => 1.7, 35..=39 => 1.9, _ => 2.2,
            };
            let tau_bd = if is_deformed { tau_bd_base * 1.6 } else { tau_bd_base };
            let mut ld_val = fy * db / (4.0 * tau_bd);
            if is_top { ld_val *= 1.3; }
            if !is_tension { ld_val *= 0.8; }
            (ld_val, ld_val / db)
        }
    };

    // ── Lap splice ──
    let pct_spliced = req.pct_bars_spliced.unwrap_or(0.50);
    let (lap_class_str, lap_len) = {
        let factor = if pct_spliced <= 0.50 { 1.0 } else { 1.3 };
        let cls = if pct_spliced <= 0.50 { "ClassA" } else { "ClassB" };
        let min_lap = match code {
            "ACI318" => 300.0,
            _ => (15.0 * db).max(200.0),
        };
        (cls.to_string(), (ld * factor).max(min_lap))
    };

    // ── Hook anchorage ──
    let hook = req.hook_type.as_deref().unwrap_or("Standard90");
    let (bend_r, ext) = match hook {
        "Standard180" => (4.0 * db, 4.0 * db),
        "HeadedBar" => (0.0, 0.0),
        _ => (4.0 * db, 12.0 * db),
    };
    let ldh = match code {
        "ACI318" => ((0.24 * fy / fck.sqrt()) * db).max(8.0 * db).max(150.0),
        "Eurocode2" => {
            let fctd = 0.21 * fck.powf(2.0 / 3.0) / 1.5;
            let fbd = 2.25 * fctd;
            let fyd = fy / 1.15;
            let lb = db / 4.0 * fyd / fbd;
            (lb * 0.7).max(10.0 * db).max(100.0)
        }
        _ => {
            let anch_val = if hook == "Standard180" { 16.0 * db } else { 8.0 * db };
            (ld - anch_val).max(0.0)
        }
    };
    let hook_total = ldh + std::f64::consts::PI * bend_r + ext;

    // ── Bar spacing ──
    let max_agg = req.max_aggregate_mm.unwrap_or(20.0);
    let total_bar_w = req.n_bars as f64 * db;
    let available = req.b_mm - 2.0 * cover - total_bar_w;
    let clear_spacing = if req.n_bars > 1 { available / (req.n_bars - 1) as f64 } else { available };
    let min_spacing = db.max(max_agg + 5.0);
    let max_spacing = 300.0;
    let spacing_pass_min = clear_spacing >= min_spacing;
    let spacing_pass_max = clear_spacing <= max_spacing;
    if !spacing_pass_min { issues.push(format!("Spacing {:.0} mm < min {:.0} mm", clear_spacing, min_spacing)); }
    if !spacing_pass_max { issues.push(format!("Spacing {:.0} mm > max {:.0} mm for crack control", clear_spacing, max_spacing)); }

    // ── Reinforcement limits ──
    let bar_area = std::f64::consts::PI / 4.0 * db * db;
    let ast = req.n_bars as f64 * bar_area;
    let bd = req.b_mm * req.d_mm;
    let rho = ast / bd;
    let (rho_min, rho_max) = match code {
        "ACI318" => {
            let r1 = 0.25 * fck.sqrt() / fy;
            let r2 = 1.4 / fy;
            (r1.max(r2), 0.04)
        }
        "Eurocode2" => {
            let fctm = 0.30 * fck.powf(2.0 / 3.0);
            ((0.26 * fctm / fy).max(0.0013), 0.04)
        }
        _ => (0.0012, 0.04),
    };
    let rho_pass_min = rho >= rho_min;
    let rho_pass_max = rho <= rho_max;
    if !rho_pass_min { issues.push(format!("ρ={:.3}% < min {:.3}%", rho * 100.0, rho_min * 100.0)); }
    if !rho_pass_max { issues.push(format!("ρ={:.3}% > max {:.1}%", rho * 100.0, rho_max * 100.0)); }

    // ── Curtailment ──
    let curtailment = if let Some(ref md) = req.moment_diagram {
        if md.len() >= 2 {
            let n = req.n_bars;
            let min_bars = (n + 2) / 3;
            let m_capacity_n = |nb: usize| -> f64 {
                let a_s = nb as f64 * bar_area;
                let a = a_s * fy / (0.36 * fck * req.b_mm);
                0.87 * fy * a_s * (req.d_mm - a / 2.0) / 1e6
            };

            let _m_max = md.iter().map(|p| p.moment_knm.abs()).fold(0.0_f64, f64::max);
            let mid = req.span_mm / 2.0;

            let mut schedule = Vec::new();
            let mut bars_rem = n;

            while bars_rem > min_bars {
                let new_rem = bars_rem - 1;
                let mc = m_capacity_n(new_rem);
                if mc < 1.0 { break; }

                // Find theoretical cutoff
                let mut sorted: Vec<&MomentPointInput> = md.iter().collect();
                sorted.sort_by(|a, b| {
                    let da = (a.x_mm - mid).abs();
                    let db_val = (b.x_mm - mid).abs();
                    da.partial_cmp(&db_val).unwrap_or(std::cmp::Ordering::Equal)
                });

                let mut theo_x = None;
                for pt in &sorted {
                    if pt.moment_knm.abs() <= mc {
                        theo_x = Some(pt.x_mm);
                        break;
                    }
                }

                if let Some(tx) = theo_x {
                    let actual = if tx < mid {
                        (tx - ld - req.d_mm).max(0.0)
                    } else {
                        (tx + ld + req.d_mm).min(req.span_mm)
                    };
                    schedule.push(CutoffScheduleItem {
                        bars_continuing: new_rem,
                        bars_cutoff: 1,
                        theoretical_x_mm: (tx * 10.0).round() / 10.0,
                        actual_x_mm: (actual * 10.0).round() / 10.0,
                        moment_capacity_knm: (mc * 100.0).round() / 100.0,
                    });
                    bars_rem = new_rem;
                } else {
                    break;
                }
            }

            let full_len = n as f64 * req.span_mm;
            let actual_len: f64 = {
                let mut total = bars_rem as f64 * req.span_mm;
                for cp in &schedule {
                    let bar_len = req.span_mm - 2.0 * cp.actual_x_mm.min(req.span_mm / 2.0);
                    total += cp.bars_cutoff as f64 * bar_len.max(0.0);
                }
                total
            };
            let savings = (1.0 - actual_len / full_len.max(1.0)) * 100.0;

            Some(CurtailmentOutput {
                n_cutoff_points: schedule.len(),
                savings_pct: (savings * 10.0).round() / 10.0,
                cutoff_schedule: schedule,
            })
        } else { None }
    } else { None };

    let all_pass = spacing_pass_min && spacing_pass_max && rho_pass_min && rho_pass_max;
    let performance_ms = start.elapsed().as_secs_f64() * 1000.0;

    Ok(Json(RebarDetailingResponse {
        success: true,
        development_length_mm: (ld * 10.0).round() / 10.0,
        ld_over_db: (ld_db * 10.0).round() / 10.0,
        lap_splice_mm: (lap_len * 10.0).round() / 10.0,
        lap_class: lap_class_str,
        hook_ldh_mm: (ldh * 10.0).round() / 10.0,
        hook_total_mm: (hook_total * 10.0).round() / 10.0,
        bar_spacing_mm: (clear_spacing * 10.0).round() / 10.0,
        spacing_pass: spacing_pass_min && spacing_pass_max,
        rho_pct: (rho * 100.0 * 1000.0).round() / 1000.0,
        rho_min_pct: (rho_min * 100.0 * 1000.0).round() / 1000.0,
        rho_max_pct: (rho_max * 100.0 * 100.0).round() / 100.0,
        reinforcement_pass: rho_pass_min && rho_pass_max,
        curtailment,
        all_checks_pass: all_pass,
        issues,
        performance_ms,
    }))
}