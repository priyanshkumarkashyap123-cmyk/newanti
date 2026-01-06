//! Advanced Analysis API Handlers
//!
//! Complete integration with Rust solvers for:
//! - Modal Analysis (eigenvalue extraction)
//! - Time-History Analysis (Newmark-β)
//! - P-Delta Analysis (geometric nonlinearity)
//! - Response Spectrum Analysis (seismic)

use axum::{extract::State, Json};
use nalgebra::{DMatrix, DVector};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::error::{ApiError, ApiResult};
use crate::solver::{
    ModalSolver, ModalConfig, MassMatrixType,
    TimeHistorySolver, TimeHistoryConfig, DampingModel, IntegrationMethod,
    PDeltaSolver, PDeltaConfig, MemberGeometry,
    ResponseSpectrumSolver, ResponseSpectrumConfig, SeismicCode, SeismicZone,
    SoilType, ImportanceFactor, ResponseReduction, CombinationMethod,
};
use crate::AppState;

// ============================================
// MODAL ANALYSIS
// ============================================

#[derive(Debug, Deserialize)]
pub struct ModalRequest {
    /// Stiffness matrix (flattened, row-major)
    pub stiffness: Vec<f64>,
    /// Mass matrix (flattened, row-major)
    pub mass: Vec<f64>,
    /// Matrix dimension (N×N)
    pub dimension: usize,
    /// Number of modes to extract
    #[serde(default = "default_num_modes")]
    pub num_modes: usize,
    /// Mass matrix type
    #[serde(default)]
    pub mass_type: String,  // "consistent" or "lumped"
    /// Compute participation factors
    #[serde(default = "default_true")]
    pub compute_participation: bool,
}

fn default_num_modes() -> usize { 6 }
fn default_true() -> bool { true }

#[derive(Debug, Serialize)]
pub struct ModalResponse {
    pub success: bool,
    pub modes: Vec<ModeData>,
    pub cumulative_participation: Option<Vec<f64>>,
    pub performance_ms: f64,
}

#[derive(Debug, Serialize)]
pub struct ModeData {
    pub mode_number: usize,
    pub frequency_hz: f64,
    pub frequency_rad: f64,
    pub period_s: f64,
    pub modal_mass: f64,
    pub participation_factor: Option<f64>,
    pub mode_shape: Vec<f64>,
}

/// POST /api/analysis/modal - Modal eigenvalue analysis
pub async fn modal_analysis(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<ModalRequest>,
) -> ApiResult<Json<ModalResponse>> {
    let start = std::time::Instant::now();

    // Validate input
    let n = req.dimension;
    if req.stiffness.len() != n * n {
        return Err(ApiError::BadRequest(
            format!("Stiffness matrix size mismatch: expected {}×{}, got {}", n, n, req.stiffness.len())
        ));
    }
    if req.mass.len() != n * n {
        return Err(ApiError::BadRequest(
            format!("Mass matrix size mismatch: expected {}×{}, got {}", n, n, req.mass.len())
        ));
    }

    // Construct matrices
    let K = DMatrix::from_row_slice(n, n, &req.stiffness);
    let M = DMatrix::from_row_slice(n, n, &req.mass);

    // Configure modal solver
    let mass_type = match req.mass_type.as_str() {
        "lumped" => MassMatrixType::Lumped,
        _ => MassMatrixType::Consistent,
    };

    let config = ModalConfig {
        num_modes: req.num_modes,
        mass_type,
        normalize_modes: true,
        compute_participation: req.compute_participation,
    };

    let solver = ModalSolver::new(config);

    // Perform modal analysis
    let result = solver.analyze(&K, &M)
        .map_err(|e| ApiError::AnalysisFailed(e))?;

    // Convert to response format
    let modes: Vec<ModeData> = (0..result.frequencies.len())
        .map(|i| {
            let omega = result.frequencies[i];
            let freq_hz = omega / (2.0 * std::f64::consts::PI);
            let period = result.periods[i];
            
            // Extract mode shape for this mode
            let mode_shape: Vec<f64> = (0..n)
                .map(|j| result.mode_shapes[(j, i)])
                .collect();

            let participation = result.participation_factors
                .as_ref()
                .map(|pf| pf[i]);

            ModeData {
                mode_number: i + 1,
                frequency_hz: freq_hz,
                frequency_rad: omega,
                period_s: period,
                modal_mass: result.modal_masses[i],
                participation_factor: participation,
                mode_shape,
            }
        })
        .collect();

    let performance_ms = start.elapsed().as_secs_f64() * 1000.0;

    Ok(Json(ModalResponse {
        success: true,
        modes,
        cumulative_participation: result.cumulative_participation,
        performance_ms,
    }))
}

// ============================================
// TIME-HISTORY ANALYSIS
// ============================================

#[derive(Debug, Deserialize)]
pub struct TimeHistoryRequest {
    /// Stiffness matrix
    pub stiffness: Vec<f64>,
    /// Mass matrix
    pub mass: Vec<f64>,
    /// Matrix dimension
    pub dimension: usize,
    /// Time step (seconds)
    pub dt: f64,
    /// Analysis duration (seconds)
    pub duration: f64,
    /// Force history (array of force vectors at each time step)
    pub force_history: Vec<Vec<f64>>,
    /// Initial displacement
    #[serde(default)]
    pub initial_displacement: Option<Vec<f64>>,
    /// Initial velocity
    #[serde(default)]
    pub initial_velocity: Option<Vec<f64>>,
    /// Rayleigh damping alpha
    #[serde(default)]
    pub damping_alpha: Option<f64>,
    /// Rayleigh damping beta
    #[serde(default)]
    pub damping_beta: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct TimeHistoryResponse {
    pub success: bool,
    pub time_points: Vec<f64>,
    pub max_displacement: f64,
    pub max_velocity: f64,
    pub max_acceleration: f64,
    pub displacement_history: Vec<Vec<f64>>,
    pub velocity_history: Vec<Vec<f64>>,
    pub acceleration_history: Vec<Vec<f64>>,
    pub performance_ms: f64,
}

/// POST /api/analysis/time-history - Time-history dynamic analysis
pub async fn time_history_analysis(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<TimeHistoryRequest>,
) -> ApiResult<Json<TimeHistoryResponse>> {
    let start = std::time::Instant::now();

    let n = req.dimension;
    
    // Validate input
    if req.stiffness.len() != n * n || req.mass.len() != n * n {
        return Err(ApiError::BadRequest("Matrix dimension mismatch".to_string()));
    }

    // Construct matrices
    let K = DMatrix::from_row_slice(n, n, &req.stiffness);
    let M = DMatrix::from_row_slice(n, n, &req.mass);

    // Construct force history
    let force_history: Vec<DVector<f64>> = req.force_history.iter()
        .map(|f| DVector::from_vec(f.clone()))
        .collect();

    // Initial conditions
    let u0 = req.initial_displacement
        .map(|v| DVector::from_vec(v))
        .unwrap_or_else(|| DVector::zeros(n));
    
    let v0 = req.initial_velocity
        .map(|v| DVector::from_vec(v))
        .unwrap_or_else(|| DVector::zeros(n));

    // Damping model
    let damping = if let (Some(alpha), Some(beta)) = (req.damping_alpha, req.damping_beta) {
        DampingModel::Rayleigh { alpha, beta }
    } else {
        DampingModel::None
    };

    // Configure time-history solver
    let config = TimeHistoryConfig {
        dt: req.dt,
        duration: req.duration,
        method: IntegrationMethod::Newmark { beta: 0.25, gamma: 0.5 },
        damping,
        output_interval: 1,
    };

    let solver = TimeHistorySolver::new(config);

    // Perform analysis
    let result = solver.analyze(&K, &M, &force_history, &u0, &v0)
        .map_err(|e| ApiError::AnalysisFailed(e))?;

    // Convert to response format
    let displacement_history: Vec<Vec<f64>> = result.displacement_history.iter()
        .map(|dv| dv.as_slice().to_vec())
        .collect();

    let velocity_history: Vec<Vec<f64>> = result.velocity_history.iter()
        .map(|dv| dv.as_slice().to_vec())
        .collect();

    let acceleration_history: Vec<Vec<f64>> = result.acceleration_history.iter()
        .map(|dv| dv.as_slice().to_vec())
        .collect();

    let performance_ms = start.elapsed().as_secs_f64() * 1000.0;

    Ok(Json(TimeHistoryResponse {
        success: true,
        time_points: result.time_points,
        max_displacement: result.max_displacement,
        max_velocity: result.max_velocity,
        max_acceleration: result.max_acceleration,
        displacement_history,
        velocity_history,
        acceleration_history,
        performance_ms,
    }))
}

// ============================================
// P-DELTA ANALYSIS
// ============================================

#[derive(Debug, Deserialize)]
pub struct PDeltaRequest {
    /// Stiffness matrix
    pub stiffness: Vec<f64>,
    /// Mass matrix
    pub mass: Vec<f64>,
    /// Matrix dimension
    pub dimension: usize,
    /// Load vector
    pub loads: Vec<f64>,
    /// Member geometries for geometric stiffness
    pub members: Vec<MemberGeometryInput>,
    /// Maximum iterations
    #[serde(default = "default_max_iter")]
    pub max_iterations: usize,
    /// Convergence tolerance
    #[serde(default = "default_tolerance")]
    pub tolerance: f64,
}

fn default_max_iter() -> usize { 20 }
fn default_tolerance() -> f64 { 1e-6 }

#[derive(Debug, Deserialize)]
pub struct MemberGeometryInput {
    pub node_i: usize,
    pub node_j: usize,
    pub length: f64,
}

#[derive(Debug, Serialize)]
pub struct PDeltaResponse {
    pub success: bool,
    pub converged: bool,
    pub iterations: usize,
    pub final_error: f64,
    pub displacements: Vec<f64>,
    pub amplification_factor: f64,
    pub performance_ms: f64,
}

/// POST /api/analysis/pdelta - P-Delta geometric nonlinear analysis
pub async fn pdelta_analysis(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<PDeltaRequest>,
) -> ApiResult<Json<PDeltaResponse>> {
    let start = std::time::Instant::now();

    let n = req.dimension;
    
    // Validate input
    if req.stiffness.len() != n * n || req.mass.len() != n * n || req.loads.len() != n {
        return Err(ApiError::BadRequest("Dimension mismatch".to_string()));
    }

    // Construct matrices
    let K = DMatrix::from_row_slice(n, n, &req.stiffness);
    let M = DMatrix::from_row_slice(n, n, &req.mass);
    let loads = DVector::from_vec(req.loads.clone());

    // Convert member geometries
    let members: Vec<MemberGeometry> = req.members.iter()
        .map(|m| MemberGeometry {
            node_i: m.node_i,
            node_j: m.node_j,
            length: m.length,
        })
        .collect();

    // Configure P-Delta solver
    let config = PDeltaConfig {
        max_iterations: req.max_iterations,
        tolerance: req.tolerance,
        relaxation: 1.0,
    };

    let solver = PDeltaSolver::new(config);

    // Perform P-Delta analysis
    let result = solver.analyze(&K, &M, &loads, &members, None)
        .map_err(|e| ApiError::AnalysisFailed(e))?;

    let performance_ms = start.elapsed().as_secs_f64() * 1000.0;

    Ok(Json(PDeltaResponse {
        success: true,
        converged: result.converged,
        iterations: result.iterations,
        final_error: result.final_error,
        displacements: result.displacements.as_slice().to_vec(),
        amplification_factor: result.amplification_factor,
        performance_ms,
    }))
}

// ============================================
// RESPONSE SPECTRUM ANALYSIS
// ============================================

#[derive(Debug, Deserialize)]
pub struct ResponseSpectrumRequest {
    /// Natural frequencies (rad/s) from modal analysis
    pub frequencies: Vec<f64>,
    /// Mode shapes (flattened matrix, N_dof × N_modes)
    pub mode_shapes: Vec<f64>,
    /// Number of DOFs
    pub n_dof: usize,
    /// Modal masses
    pub modal_masses: Vec<f64>,
    /// Participation factors
    pub participation_factors: Vec<f64>,
    /// Seismic configuration
    pub seismic_config: SeismicConfigInput,
    /// Story heights (for force distribution)
    #[serde(default)]
    pub story_heights: Option<Vec<f64>>,
    /// Story masses (for force distribution)
    #[serde(default)]
    pub story_masses: Option<Vec<f64>>,
}

#[derive(Debug, Deserialize)]
pub struct SeismicConfigInput {
    /// Design code: "IS1893", "ASCE7", "EC8"
    pub code: String,
    /// Seismic zone: "Zone2", "Zone3", "Zone4", "Zone5"
    pub zone: String,
    /// Soil type: "TypeI", "TypeII", "TypeIII"
    pub soil_type: String,
    /// Importance: "Ordinary", "Important", "Critical"
    pub importance: String,
    /// Response reduction: "OMRF", "SMRF", "ShearWall", "DualSystem"
    pub response_reduction: String,
    /// Damping ratio (typically 0.05)
    #[serde(default = "default_damping")]
    pub damping_ratio: f64,
    /// Combination method: "SRSS", "CQC", "ABS"
    #[serde(default = "default_cqc")]
    pub combination_method: String,
}

fn default_damping() -> f64 { 0.05 }
fn default_cqc() -> String { "CQC".to_string() }

#[derive(Debug, Serialize)]
pub struct ResponseSpectrumResponse {
    pub success: bool,
    pub periods: Vec<f64>,
    pub spectral_accelerations: Vec<f64>,
    pub modal_displacements: Vec<f64>,
    pub modal_base_shears: Vec<f64>,
    pub max_displacement: f64,
    pub max_base_shear: f64,
    pub code_base_shear: f64,
    pub story_forces: Option<Vec<StoryForceData>>,
    pub performance_ms: f64,
}

#[derive(Debug, Serialize)]
pub struct StoryForceData {
    pub level: usize,
    pub height: f64,
    pub force_kn: f64,
    pub shear_kn: f64,
}

/// POST /api/analysis/response-spectrum - Seismic response spectrum analysis
pub async fn response_spectrum_analysis(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<ResponseSpectrumRequest>,
) -> ApiResult<Json<ResponseSpectrumResponse>> {
    let start = std::time::Instant::now();

    let n_modes = req.frequencies.len();
    let n_dof = req.n_dof;

    // Validate input
    if req.mode_shapes.len() != n_dof * n_modes {
        return Err(ApiError::BadRequest(
            format!("Mode shape matrix size mismatch: expected {}×{}, got {}", 
                    n_dof, n_modes, req.mode_shapes.len())
        ));
    }

    // Construct mode shapes matrix
    let mode_shapes = DMatrix::from_row_slice(n_dof, n_modes, &req.mode_shapes);

    // Parse seismic configuration
    let code = match req.seismic_config.code.as_str() {
        "ASCE7" => SeismicCode::ASCE7,
        "EC8" => SeismicCode::EC8,
        _ => SeismicCode::IS1893,
    };

    let zone = match req.seismic_config.zone.as_str() {
        "Zone2" => SeismicZone::Zone2,
        "Zone3" => SeismicZone::Zone3,
        "Zone4" => SeismicZone::Zone4,
        "Zone5" => SeismicZone::Zone5,
        _ => SeismicZone::Zone3,
    };

    let soil_type = match req.seismic_config.soil_type.as_str() {
        "TypeI" => SoilType::TypeI,
        "TypeIII" => SoilType::TypeIII,
        _ => SoilType::TypeII,
    };

    let importance = match req.seismic_config.importance.as_str() {
        "Important" => ImportanceFactor::Important,
        "Critical" => ImportanceFactor::Critical,
        _ => ImportanceFactor::Ordinary,
    };

    let response_reduction = match req.seismic_config.response_reduction.as_str() {
        "OMRF" => ResponseReduction::OMRF,
        "ShearWall" => ResponseReduction::ShearWall,
        "DualSystem" => ResponseReduction::DualSystem,
        _ => ResponseReduction::SMRF,
    };

    let combination_method = match req.seismic_config.combination_method.as_str() {
        "SRSS" => CombinationMethod::SRSS,
        "ABS" => CombinationMethod::ABS,
        _ => CombinationMethod::CQC,
    };

    // Configure response spectrum solver
    let config = ResponseSpectrumConfig {
        code,
        zone,
        soil_type,
        importance,
        response_reduction,
        damping_ratio: req.seismic_config.damping_ratio,
        combination_method,
        include_vertical: false,
    };

    let solver = ResponseSpectrumSolver::new(config);

    // Perform response spectrum analysis
    let result = solver.analyze(
        &req.frequencies,
        &mode_shapes,
        &req.modal_masses,
        &req.participation_factors,
    ).map_err(|e| ApiError::AnalysisFailed(e))?;

    // Story force distribution (if provided)
    let story_forces = if let (Some(heights), Some(masses)) = 
        (req.story_heights.as_ref(), req.story_masses.as_ref()) {
        let forces = solver.distribute_story_forces(
            result.max_base_shear,
            heights,
            masses,
        );
        
        Some(forces.iter().map(|f| StoryForceData {
            level: f.level,
            height: f.height,
            force_kn: f.force_kn,
            shear_kn: f.shear_kn,
        }).collect())
    } else {
        None
    };

    let performance_ms = start.elapsed().as_secs_f64() * 1000.0;

    Ok(Json(ResponseSpectrumResponse {
        success: true,
        periods: result.periods,
        spectral_accelerations: result.spectral_accelerations,
        modal_displacements: result.modal_displacements,
        modal_base_shears: result.modal_base_shears,
        max_displacement: result.max_displacement,
        max_base_shear: result.max_base_shear,
        code_base_shear: result.code_base_shear,
        story_forces,
        performance_ms,
    }))
}
