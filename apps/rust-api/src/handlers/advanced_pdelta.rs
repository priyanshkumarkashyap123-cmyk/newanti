//! P-Delta (geometric nonlinear) analysis handler extracted from advanced.rs

use axum::{extract::State, Json};
use nalgebra::DVector;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::cache::AnalysisCache;
use crate::error::{ApiError, ApiResult};
use crate::solver::{AnalysisInput, MemberGeometry, PDeltaConfig, PDeltaSolver, Solver};
use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct PDeltaRequest {
    #[serde(flatten)]
    pub input: AnalysisInput,
    #[serde(default = "default_max_iterations")]
    pub max_iterations: usize,
    #[serde(default = "default_tolerance")]
    pub tolerance: f64,
}

fn default_max_iterations() -> usize {
    10
}
fn default_tolerance() -> f64 {
    1e-6
}

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
    let cache_key = AnalysisCache::cache_key(
        "pdelta",
        &(&req.input, req.max_iterations, req.tolerance.to_bits()),
    );
    if let Some(cached) = state.analysis_cache.get::<PDeltaResponse>(&cache_key).await {
        tracing::debug!("Cache HIT for P-Delta analysis");
        return Ok(Json(cached));
    }

    let start = std::time::Instant::now();
    let solver = Solver::new();

    // Assemble stiffness matrix
    let k_elastic = solver
        .assemble_global_stiffness(&req.input)
        .map_err(|e| ApiError::AnalysisFailed(format!("Failed to assemble stiffness: {}", e)))?;

    let n_dof = req.input.nodes.len() * 6;

    // Build force vector from loads
    let mut forces = DVector::zeros(n_dof);
    let node_index: std::collections::HashMap<String, usize> = req
        .input
        .nodes
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
    let member_geometry: Vec<MemberGeometry> = req
        .input
        .members
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
    let pdelta_result = pdelta_solver
        .analyze_sparse(&k_elastic, &forces, &member_geometry)
        .map_err(|e| ApiError::AnalysisFailed(format!("P-Delta analysis failed: {}", e)))?;

    let performance_ms = start.elapsed().as_secs_f64() * 1000.0;

    // Convert displacements from DOF array to per-node results
    let displacements: Vec<DisplacementResult> = req
        .input
        .nodes
        .iter()
        .enumerate()
        .map(|(i, node)| {
            let base = i * 6;
            DisplacementResult {
                node_id: node.id.clone(),
                dx: if base < pdelta_result.displacements.len() {
                    pdelta_result.displacements[base]
                } else {
                    0.0
                },
                dy: if base + 1 < pdelta_result.displacements.len() {
                    pdelta_result.displacements[base + 1]
                } else {
                    0.0
                },
                dz: if base + 2 < pdelta_result.displacements.len() {
                    pdelta_result.displacements[base + 2]
                } else {
                    0.0
                },
            }
        })
        .collect();

    // Get final tolerance from last convergence history entry
    let final_tolerance = pdelta_result
        .convergence_history
        .last()
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

pub use PDeltaRequest as PDeltaAnalysisRequest;
pub use PDeltaResponse as PDeltaAnalysisResponse;
