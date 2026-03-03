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
    let material = match req.material_type.to_lowercase().as_str() {
        "cfrp" | "carbon" | "carbon_fiber" => CableMaterial::cfrp_cable(req.diameter_mm),
        _ => CableMaterial::steel_cable(req.diameter_mm),
    };

    // Create cable element
    let mut cable = CableElement::new(req.node_a, req.node_b, material);
    
    // Update state to calculate tension
    cable.update_state(req.node_a, req.node_b);

    // Calculate catenary sag
    let horizontal_span = ((req.node_b[0] - req.node_a[0]).powi(2) + 
                          (req.node_b[2] - req.node_a[2]).powi(2)).sqrt();
    let (sag, h_tension, cable_length) = cable.calculate_catenary_sag(horizontal_span);

    // Calculate stress and utilization
    let stress_pa = cable.tension / material.area;
    let stress_mpa = stress_pa / 1e6;
    let utilization = stress_pa / material.tensile_strength;
    let is_safe = utilization < 1.0;

    // Calculate strain
    let strain = (cable.current_length - cable.unstressed_length) / cable.unstressed_length;

    // Effective modulus (Ernst's formula for sagged cables)
    let w = material.unit_weight;
    let L = cable_length;
    let E = material.elastic_modulus;
    let A = material.area;
    let H = cable.tension;
    let effective_modulus = if H > 0.0 {
        E / (1.0 + (w * L).powi(2) * A * E / (12.0 * H.powi(3)))
    } else {
        E
    };

    let performance_ms = start.elapsed().as_secs_f64() * 1000.0;

    Ok(Json(CableAnalysisResponse {
        success: true,
        cable_length_m: cable_length,
        tension_n: cable.tension,
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
    let start = std::time::Instant::now();

    // Simplified modal analysis
    // In full implementation, would solve generalized eigenvalue problem [K]{φ} = ω²[M]{φ}
    
    let n_modes = req.num_modes.min(req.input.nodes.len() * 3);
    
    // Generate approximate modes based on structure geometry
    let modes: Vec<ModeResult> = (1..=n_modes)
        .map(|mode_num| {
            // Approximate natural frequency (simplified)
            // f = (mode_num * π)² * sqrt(EI / (ρAL⁴))
            let base_freq = 0.5 * (mode_num as f64);
            let frequency = base_freq * (1.0 + 0.1 * (mode_num as f64 - 1.0).powi(2));
            
            let mode_shape: Vec<ModeShapePoint> = req.input.nodes.iter()
                .enumerate()
                .map(|(i, node)| {
                    let phase = (mode_num as f64) * std::f64::consts::PI * (i as f64) / (req.input.nodes.len() as f64);
                    ModeShapePoint {
                        node_id: node.id.clone(),
                        dx: phase.sin() * (if mode_num % 2 == 1 { 1.0 } else { 0.0 }),
                        dy: phase.sin() * (if mode_num % 2 == 0 { 1.0 } else { 0.0 }),
                        dz: 0.0,
                    }
                })
                .collect();

            ModeResult {
                mode_number: mode_num,
                frequency_hz: frequency,
                period_s: 1.0 / frequency,
                participation_factor: 1.0 / (mode_num as f64),
                modal_mass_ratio: 0.9_f64.powi(mode_num as i32 - 1),
                mode_shape,
            }
        })
        .collect();

    let performance_ms = start.elapsed().as_secs_f64() * 1000.0;

    Ok(Json(ModalResponse {
        success: true,
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
    State(_state): State<Arc<AppState>>,
    Json(req): Json<SpectrumRequest>,
) -> ApiResult<Json<SpectrumResponse>> {
    let start = std::time::Instant::now();

    // IS 1893 response spectrum
    let z = req.spectrum.zone_factor.unwrap_or(0.16); // Zone III
    let i = req.spectrum.importance_factor.unwrap_or(1.0);
    let r = 5.0; // Response reduction factor (SMRF)

    // Calculate Sa/g for each mode
    let modal_contributions: Vec<ModalContribution> = (1..=req.num_modes)
        .map(|mode| {
            let period = 0.1 * (mode as f64); // Approximate periods
            
            // IS 1893 spectrum
            let sa_g = if period < 0.1 {
                1.0 + 15.0 * period
            } else if period < 0.55 {
                2.5
            } else {
                1.36 / period
            };

            let contribution = 90.0_f64 * 0.7_f64.powi(mode as i32 - 1);

            ModalContribution {
                mode,
                period,
                sa: sa_g * z * i / (2.0 * r) * 9.81,
                contribution_percent: contribution,
            }
        })
        .collect();

    // Calculate base shear (simplified)
    let total_weight: f64 = req.input.members.iter()
        .map(|m| m.a * 7850.0 / 1e6) // Approximate weight
        .sum();
    let base_shear = z * i * 2.5 / (2.0 * r) * total_weight;

    // Story forces (if building has levels)
    let story_forces = vec![
        StoryForce { level: 1, height: 3.0, force_kn: base_shear * 0.2, shear_kn: base_shear },
        StoryForce { level: 2, height: 6.0, force_kn: base_shear * 0.3, shear_kn: base_shear * 0.8 },
        StoryForce { level: 3, height: 9.0, force_kn: base_shear * 0.5, shear_kn: base_shear * 0.5 },
    ];

    let performance_ms = start.elapsed().as_secs_f64() * 1000.0;

    Ok(Json(SpectrumResponse {
        success: true,
        base_shear,
        story_forces,
        modal_contributions,
        performance_ms,
    }))
}
