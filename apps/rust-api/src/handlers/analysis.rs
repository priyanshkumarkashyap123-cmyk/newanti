//! Core structural analysis handlers
//!
//! These are the high-performance endpoints that replace Node.js analysis

use axum::{
    extract::State,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::error::{ApiError, ApiResult};
use crate::solver::{AnalysisInput, AnalysisResult, Solver};
use crate::AppState;

/// POST /api/analyze - Run structural analysis
pub async fn analyze(
    State(_state): State<Arc<AppState>>,
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

    // Run analysis
    let solver = Solver::new();
    let result = solver.analyze(&input).map_err(|e| ApiError::AnalysisFailed(e))?;

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
    State(_state): State<Arc<AppState>>,
    Json(input): Json<AnalysisInput>,
) -> ApiResult<Json<AnalysisResponse>> {
    // For now, same as regular analyze
    // TODO: Implement SSE streaming for progress updates
    analyze(State(_state), Json(input)).await
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
