//! Core structural analysis handlers
//!
//! These are the high-performance endpoints that replace Node.js analysis

use axum::{
    extract::State,
    response::IntoResponse,
    Json,
};
use nalgebra::{DMatrix, DVector};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::error::{ApiError, ApiResult};
use crate::cache::AnalysisCache;
use crate::solver::{
    AnalysisInput, AnalysisResult, Solver,
    ModalSolver, ModalConfig, MassMatrixType,
    TimeHistorySolver, TimeHistoryConfig, IntegrationMethod, DampingModel,
    ResponseSpectrumSolver, ResponseSpectrumConfig,
    SeismicCode, SeismicZone, SoilType, ImportanceFactor, ResponseReduction, CombinationMethod,
};
use crate::AppState;

/// POST /api/analyze - Run structural analysis
pub async fn analyze(
    State(state): State<Arc<AppState>>,
    Json(input): Json<AnalysisInput>,
) -> ApiResult<Json<AnalysisResponse>> {
    // Validate input
    if input.nodes.is_empty() {
        return Err(ApiError::BadRequest("No nodes provided".into()));
    }
    if input.members.is_empty() {
        return Err(ApiError::BadRequest("No members provided".into()));
    }
    if input.supports.is_empty() {
        return Err(ApiError::BadRequest("No supports provided".into()));
    }

    // Check model size limits
    if input.nodes.len() > 100_000 {
        return Err(ApiError::ModelTooLarge(format!(
            "Model has {} nodes, max is 100,000",
            input.nodes.len()
        )));
    }

    // Check cache first
    let cache_key = AnalysisCache::cache_key("analyze", &input);
    if let Some(result) = state.analysis_cache.get::<AnalysisResult>(&cache_key).await {
        tracing::debug!("Cache HIT for analysis ({} nodes, {} members)", input.nodes.len(), input.members.len());
        return Ok(Json(AnalysisResponse {
            success: true,
            message: format!(
                "Analysis complete (cached) ({} nodes, {} members)",
                input.nodes.len(),
                input.members.len()
            ),
            result,
        }));
    }

    // Run analysis
    let solver = Solver::new();
    let result = solver.analyze(&input).map_err(|e| ApiError::AnalysisFailed(e))?;

    // Cache the result
    state.analysis_cache.insert(cache_key, &result).await;

    Ok(Json(AnalysisResponse {
        success: true,
        message: format!(
            "Analysis complete in {:.2}ms ({} nodes, {} members)",
            result.performance.total_time_ms,
            input.nodes.len(),
            input.members.len()
        ),
        result,
    }))
}

/// POST /api/analyze/batch - Run multiple analyses in parallel
pub async fn batch_analyze(
    State(_state): State<Arc<AppState>>,
    Json(inputs): Json<Vec<AnalysisInput>>,
) -> ApiResult<Json<BatchAnalysisResponse>> {
    use rayon::prelude::*;

    if inputs.is_empty() {
        return Err(ApiError::BadRequest("No analysis inputs provided".into()));
    }
    if inputs.len() > 100 {
        return Err(ApiError::BadRequest("Maximum 100 analyses per batch".into()));
    }

    let start = std::time::Instant::now();
    let solver = Solver::new();

    // Run all analyses in parallel using Rayon
    let results: Vec<Result<AnalysisResult, String>> = inputs
        .par_iter()
        .map(|input| solver.analyze(input))
        .collect();

    let total_time = start.elapsed().as_secs_f64() * 1000.0;

    let (successes, failures): (Vec<_>, Vec<_>) = results
        .into_iter()
        .partition(|r| r.is_ok());

    Ok(Json(BatchAnalysisResponse {
        success: true,
        total_analyses: inputs.len(),
        successful: successes.len(),
        failed: failures.len(),
        total_time_ms: total_time,
        results: successes.into_iter().filter_map(|r| r.ok()).collect(),
    }))
}

/// POST /api/analyze/stream - Stream analysis progress (for large models)
pub async fn stream_analyze(
    State(state): State<Arc<AppState>>,
    Json(input): Json<AnalysisInput>,
) -> ApiResult<Json<AnalysisResponse>> {
    // For now, same as regular analyze (with caching)
    // TODO: Implement SSE streaming for progress updates
    analyze(State(state), Json(input)).await
}

#[derive(Serialize)]
pub struct AnalysisResponse {
    pub success: bool,
    pub message: String,
    pub result: AnalysisResult,
}

#[derive(Serialize)]
pub struct BatchAnalysisResponse {
    pub success: bool,
    pub total_analyses: usize,
    pub successful: usize,
    pub failed: usize,
    pub total_time_ms: f64,
    pub results: Vec<AnalysisResult>,
}

// ============================================
// MODAL ANALYSIS
// ============================================

#[derive(Debug, Deserialize)]
pub struct ModalAnalysisRequest {
    /// Stiffness matrix (flattened row-major)
    pub stiffness_matrix: Vec<f64>,
    
    /// Mass matrix (flattened row-major)
    pub mass_matrix: Vec<f64>,
    
    /// Matrix dimension (N x N)
    pub dimension: usize,
    
    /// Number of modes to extract
    #[serde(default = "default_num_modes")]
    pub num_modes: usize,
    
    /// Mass matrix type (Consistent or Lumped)
    #[serde(default)]
    pub mass_type: String,
    
    /// Normalize mode shapes
    #[serde(default = "default_true")]
    pub normalize_modes: bool,
    
    /// Compute participation factors
    #[serde(default = "default_true")]
    pub compute_participation: bool,
}

fn default_num_modes() -> usize { 10 }
fn default_true() -> bool { true }

#[derive(Debug, Serialize)]
pub struct ModalAnalysisResponse {
    pub success: bool,
    pub frequencies_hz: Vec<f64>,
    pub frequencies_rad_s: Vec<f64>,
    pub periods_s: Vec<f64>,
    pub mode_shapes: Vec<Vec<f64>>,
    pub modal_masses: Vec<f64>,
    pub participation_factors: Option<Vec<f64>>,
    pub cumulative_participation: Option<Vec<f64>>,
    pub performance_ms: f64,
}

/// POST /api/analysis/modal - Modal eigenvalue analysis
pub async fn modal_analysis(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<ModalAnalysisRequest>,
) -> ApiResult<Json<ModalAnalysisResponse>> {
    let start = std::time::Instant::now();

    // Validate matrix dimensions
    let n = req.dimension;
    if req.stiffness_matrix.len() != n * n {
        return Err(ApiError::InvalidInput(
            format!("Stiffness matrix size {} does not match dimension {}²", 
                    req.stiffness_matrix.len(), n)
        ));
    }
    if req.mass_matrix.len() != n * n {
        return Err(ApiError::InvalidInput(
            format!("Mass matrix size {} does not match dimension {}²", 
                    req.mass_matrix.len(), n)
        ));
    }

    // Convert to DMatrix (snake_case to satisfy lints)
    let k = DMatrix::from_row_slice(n, n, &req.stiffness_matrix);
    let m = DMatrix::from_row_slice(n, n, &req.mass_matrix);

    // Configure modal solver
    let mass_type = match req.mass_type.to_lowercase().as_str() {
        "lumped" => MassMatrixType::Lumped,
        _ => MassMatrixType::Consistent,
    };

    let config = ModalConfig {
        num_modes: req.num_modes.min(n),
        mass_type,
        normalize_modes: req.normalize_modes,
        compute_participation: req.compute_participation,
    };

    // Run modal analysis
    let solver = ModalSolver::new(config);
    let result = solver.analyze(&k, &m)
        .map_err(|e| ApiError::AnalysisFailed(e))?;

    // Convert frequencies to Hz
    let frequencies_hz: Vec<f64> = result.frequencies.iter()
        .map(|omega| omega / (2.0 * std::f64::consts::PI))
        .collect();

    // Extract mode shapes as vectors
    let mode_shapes: Vec<Vec<f64>> = (0..result.mode_shapes.ncols())
        .map(|i| result.mode_shapes.column(i).as_slice().to_vec())
        .collect();

    let performance_ms = start.elapsed().as_secs_f64() * 1000.0;

    Ok(Json(ModalAnalysisResponse {
        success: true,
        frequencies_hz,
        frequencies_rad_s: result.frequencies,
        periods_s: result.periods,
        mode_shapes,
        modal_masses: result.modal_masses,
        participation_factors: result.participation_factors,
        cumulative_participation: result.cumulative_participation,
        performance_ms,
    }))
}

// ============================================
// TIME-HISTORY ANALYSIS
// ============================================

#[derive(Debug, Deserialize)]
pub struct TimeHistoryRequest {
    /// Stiffness matrix (flattened row-major)
    pub stiffness_matrix: Vec<f64>,
    
    /// Mass matrix (flattened row-major)
    pub mass_matrix: Vec<f64>,
    
    /// Matrix dimension
    pub dimension: usize,
    
    /// Force history (each entry is a force vector at time step)
    pub force_history: Vec<Vec<f64>>,
    
    /// Time step (seconds)
    pub dt: f64,
    
    /// Initial displacement (optional)
    pub initial_displacement: Option<Vec<f64>>,
    
    /// Initial velocity (optional)
    pub initial_velocity: Option<Vec<f64>>,
    
    /// Integration method
    #[serde(default = "default_integration_method")]
    pub integration_method: String,
    
    /// Damping model
    #[serde(default)]
    pub damping: DampingConfig,
    
    /// Output interval (save every Nth step)
    #[serde(default = "default_output_interval")]
    pub output_interval: usize,
}

#[derive(Debug, Deserialize)]
pub struct DampingConfig {
    #[serde(rename = "type")]
    pub damping_type: String,  // "none", "rayleigh", "modal"
    pub alpha: Option<f64>,    // Rayleigh mass coefficient
    pub beta: Option<f64>,     // Rayleigh stiffness coefficient
    pub ratios: Option<Vec<f64>>, // Modal damping ratios
}

impl Default for DampingConfig {
    fn default() -> Self {
        Self {
            damping_type: "none".into(),
            alpha: None,
            beta: None,
            ratios: None,
        }
    }
}

fn default_integration_method() -> String { "newmark".into() }
fn default_output_interval() -> usize { 1 }

#[derive(Debug, Serialize)]
pub struct TimeHistoryResponse {
    pub success: bool,
    pub time: Vec<f64>,
    pub displacement_history: Vec<Vec<f64>>,
    pub velocity_history: Vec<Vec<f64>>,
    pub acceleration_history: Vec<Vec<f64>>,
    pub max_displacement: f64,
    pub max_velocity: f64,
    pub max_acceleration: f64,
    pub performance_ms: f64,
}

/// POST /api/analysis/time-history - Time-history integration
pub async fn time_history_analysis(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<TimeHistoryRequest>,
) -> ApiResult<Json<TimeHistoryResponse>> {
    let start = std::time::Instant::now();

    let n = req.dimension;
    
    // Validate inputs
    if req.stiffness_matrix.len() != n * n || req.mass_matrix.len() != n * n {
        return Err(ApiError::InvalidInput("Matrix dimensions mismatch".into()));
    }
    
    if req.force_history.is_empty() {
        return Err(ApiError::InvalidInput("Force history is empty".into()));
    }
    
    if req.force_history.iter().any(|f| f.len() != n) {
        return Err(ApiError::InvalidInput("Force vector dimension mismatch".into()));
    }

    // Convert to DMatrix/DVector (snake_case to satisfy lints)
    let k = DMatrix::from_row_slice(n, n, &req.stiffness_matrix);
    let m = DMatrix::from_row_slice(n, n, &req.mass_matrix);
    
    // Convert force history to Vec<DVector>
    let force_history: Vec<DVector<f64>> = req.force_history
        .iter()
        .map(|f| DVector::from_vec(f.clone()))
        .collect();
    let n_steps = force_history.len();

    // Initial conditions
    let u0 = req.initial_displacement.as_ref().map(|v| DVector::<f64>::from_vec(v.clone()));
    let v0 = req.initial_velocity.as_ref().map(|v| DVector::<f64>::from_vec(v.clone()));

    // Parse integration method
    let integration = match req.integration_method.to_lowercase().as_str() {
        "central_difference" | "central-difference" => IntegrationMethod::CentralDifference,
        "wilson" => IntegrationMethod::Wilson { theta: 1.4 },
        _ => IntegrationMethod::Newmark { beta: 0.25, gamma: 0.5 },
    };

    // Parse damping model
    let damping = match req.damping.damping_type.to_lowercase().as_str() {
        "rayleigh" => {
            let alpha = req.damping.alpha.ok_or_else(|| 
                ApiError::InvalidInput("Rayleigh damping requires alpha".into()))?;
            let beta = req.damping.beta.ok_or_else(|| 
                ApiError::InvalidInput("Rayleigh damping requires beta".into()))?;
            DampingModel::Rayleigh { alpha, beta }
        },
        "modal" => {
            let ratios = req.damping.ratios.clone().ok_or_else(|| 
                ApiError::InvalidInput("Modal damping requires ratios".into()))?;
            DampingModel::Modal { ratios }
        },
        _ => DampingModel::None,
    };

    // Configure time-history solver
    let duration = req.dt * (n_steps - 1) as f64;
    let config = TimeHistoryConfig {
        dt: req.dt,
        duration,
        method: integration,
        damping,
        output_interval: req.output_interval,
    };

    // Run time-history analysis
    let solver = TimeHistorySolver::new(config);
    let result = solver.analyze(&k, &m, &force_history, u0.as_ref(), v0.as_ref())
        .map_err(|e| ApiError::AnalysisFailed(e))?;

    // TimeHistoryResult already has Vec<DVector<f64>>, convert to Vec<Vec<f64>>
    let displacement_history: Vec<Vec<f64>> = result.displacements
        .iter()
        .map(|v| v.as_slice().to_vec())
        .collect();

    let velocity_history: Vec<Vec<f64>> = result.velocities
        .iter()
        .map(|v| v.as_slice().to_vec())
        .collect();

    let acceleration_history: Vec<Vec<f64>> = result.accelerations
        .iter()
        .map(|v| v.as_slice().to_vec())
        .collect();

    // Find max values across all DOFs
    let max_displacement = result.max_displacements.iter().map(|x| x.abs()).fold(0.0f64, f64::max);
    let max_velocity = result.max_velocities.iter().map(|x| x.abs()).fold(0.0f64, f64::max);
    let max_acceleration = result.max_accelerations.iter().map(|x| x.abs()).fold(0.0f64, f64::max);

    let performance_ms = start.elapsed().as_secs_f64() * 1000.0;

    Ok(Json(TimeHistoryResponse {
        success: true,
        time: result.time,
        displacement_history,
        velocity_history,
        acceleration_history,
        max_displacement,
        max_velocity,
        max_acceleration,
        performance_ms,
    }))
}

// ============================================
// SEISMIC RESPONSE SPECTRUM ANALYSIS
// ============================================

#[derive(Debug, Deserialize)]
pub struct SeismicAnalysisRequest {
    /// Modal analysis results
    pub frequencies_rad_s: Vec<f64>,
    pub mode_shapes: Vec<Vec<f64>>,
    pub modal_masses: Vec<f64>,
    pub participation_factors: Vec<f64>,
    
    /// Seismic configuration
    pub seismic_code: String,  // IS1893, ASCE7, EC8
    pub zone: String,          // Zone2-Zone5 for IS1893
    pub soil_type: String,     // TypeI, TypeII, TypeIII
    pub importance: String,    // Ordinary, Important, Critical
    pub response_reduction: String, // OMRF, SMRF, ShearWall, DualSystem
    
    #[serde(default = "default_damping_ratio")]
    pub damping_ratio: f64,
    
    #[serde(default = "default_combination_method")]
    pub combination_method: String,  // SRSS, CQC, ABS
    
    /// Story information for force distribution
    pub story_heights: Option<Vec<f64>>,
    pub story_masses: Option<Vec<f64>>,
}

fn default_damping_ratio() -> f64 { 0.05 }
fn default_combination_method() -> String { "CQC".into() }

#[derive(Debug, Serialize)]
pub struct SeismicAnalysisResponse {
    pub success: bool,
    pub periods_s: Vec<f64>,
    pub spectral_accelerations_g: Vec<f64>,
    pub modal_displacements_m: Vec<f64>,
    pub modal_base_shears_kn: Vec<f64>,
    pub max_displacement_m: f64,
    pub max_base_shear_kn: f64,
    pub code_base_shear_kn: f64,
    pub story_forces: Option<Vec<StoryForceResult>>,
    pub combination_method: String,
    pub performance_ms: f64,
}

#[derive(Debug, Serialize)]
pub struct StoryForceResult {
    pub level: usize,
    pub height_m: f64,
    pub lateral_force_kn: f64,
    pub cumulative_shear_kn: f64,
}

/// POST /api/analysis/seismic - Response spectrum analysis
pub async fn seismic_analysis(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<SeismicAnalysisRequest>,
) -> ApiResult<Json<SeismicAnalysisResponse>> {
    let start = std::time::Instant::now();

    // Validate inputs
    let n_modes = req.frequencies_rad_s.len();
    if n_modes == 0 {
        return Err(ApiError::InvalidInput("No modes provided".into()));
    }
    
    if req.mode_shapes.len() != n_modes {
        return Err(ApiError::InvalidInput("Mode shapes count mismatch".into()));
    }
    
    if req.modal_masses.len() != n_modes || req.participation_factors.len() != n_modes {
        return Err(ApiError::InvalidInput("Modal data length mismatch".into()));
    }

    // Parse seismic code
    let code = match req.seismic_code.to_uppercase().as_str() {
        "IS1893" | "IS_1893" => SeismicCode::IS1893,
        "ASCE7" | "ASCE_7" => SeismicCode::ASCE7,
        "EC8" | "EUROCODE8" => SeismicCode::EC8,
        _ => return Err(ApiError::InvalidInput(format!("Unknown seismic code: {}", req.seismic_code))),
    };

    // Parse zone
    let zone = match req.zone.to_uppercase().as_str() {
        "ZONE2" | "ZONE_2" | "II" => SeismicZone::Zone2,
        "ZONE3" | "ZONE_3" | "III" => SeismicZone::Zone3,
        "ZONE4" | "ZONE_4" | "IV" => SeismicZone::Zone4,
        "ZONE5" | "ZONE_5" | "V" => SeismicZone::Zone5,
        _ => return Err(ApiError::InvalidInput(format!("Unknown zone: {}", req.zone))),
    };

    // Parse soil type
    let soil_type = match req.soil_type.to_uppercase().as_str() {
        "TYPE1" | "TYPEI" | "I" | "ROCK" => SoilType::TypeI,
        "TYPE2" | "TYPEII" | "II" | "MEDIUM" => SoilType::TypeII,
        "TYPE3" | "TYPEIII" | "III" | "SOFT" => SoilType::TypeIII,
        _ => return Err(ApiError::InvalidInput(format!("Unknown soil type: {}", req.soil_type))),
    };

    // Parse importance factor
    let importance = match req.importance.to_lowercase().as_str() {
        "ordinary" | "normal" => ImportanceFactor::Ordinary,
        "important" => ImportanceFactor::Important,
        "critical" | "essential" => ImportanceFactor::Critical,
        _ => return Err(ApiError::InvalidInput(format!("Unknown importance: {}", req.importance))),
    };

    // Parse response reduction
    let response_reduction = match req.response_reduction.to_uppercase().as_str() {
        "OMRF" => ResponseReduction::OMRF,
        "SMRF" => ResponseReduction::SMRF,
        "SHEARWALL" | "SHEAR_WALL" => ResponseReduction::ShearWall,
        "DUALSYSTEM" | "DUAL_SYSTEM" => ResponseReduction::DualSystem,
        _ => {
            // Try to parse as float
            req.response_reduction.parse::<f64>()
                .map(ResponseReduction::Custom)
                .map_err(|_| ApiError::InvalidInput(format!("Unknown response reduction: {}", req.response_reduction)))?
        }
    };

    // Parse combination method
    let combination_method = match req.combination_method.to_uppercase().as_str() {
        "SRSS" => CombinationMethod::SRSS,
        "CQC" => CombinationMethod::CQC,
        "ABS" | "ABSOLUTE" => CombinationMethod::ABS,
        _ => return Err(ApiError::InvalidInput(format!("Unknown combination method: {}", req.combination_method))),
    };

    // Configure response spectrum solver
    let config = ResponseSpectrumConfig {
        code,
        zone,
        soil_type,
        importance,
        response_reduction,
        damping_ratio: req.damping_ratio,
        combination_method,
        include_vertical: false,
    };

    let solver = ResponseSpectrumSolver::new(config);

    // Convert mode shapes to DMatrix
    let n_dof = req.mode_shapes[0].len();
    let mut mode_shapes_matrix: DMatrix<f64> = DMatrix::zeros(n_dof, n_modes);
    for (mode_idx, mode_shape) in req.mode_shapes.iter().enumerate() {
        for (dof_idx, &value) in mode_shape.iter().enumerate() {
            mode_shapes_matrix[(dof_idx, mode_idx)] = value;
        }
    }

    // Run response spectrum analysis
    let result = solver.analyze(
        &req.frequencies_rad_s,
        &mode_shapes_matrix,
        &req.modal_masses,
        &req.participation_factors,
    ).map_err(|e| ApiError::AnalysisFailed(e))?;

    // Story force distribution (if provided)
    let story_forces = if let (Some(heights), Some(masses)) = (req.story_heights, req.story_masses) {
        let forces = solver.distribute_story_forces(
            result.max_base_shear,
            &heights,
            &masses,
        );
        
        Some(forces.into_iter().map(|f| StoryForceResult {
            level: f.level,
            height_m: f.height,
            lateral_force_kn: f.force_kn,
            cumulative_shear_kn: f.shear_kn,
        }).collect())
    } else {
        None
    };

    let performance_ms = start.elapsed().as_secs_f64() * 1000.0;

    Ok(Json(SeismicAnalysisResponse {
        success: true,
        periods_s: result.periods,
        spectral_accelerations_g: result.spectral_accelerations,
        modal_displacements_m: result.modal_displacements,
        modal_base_shears_kn: result.modal_base_shears.iter().map(|v| v / 1000.0).collect(),
        max_displacement_m: result.max_displacement,
        max_base_shear_kn: result.max_base_shear / 1000.0,
        code_base_shear_kn: result.code_base_shear / 1000.0,
        story_forces,
        combination_method: format!("{:?}", result.combination_method),
        performance_ms,
    }))
}
