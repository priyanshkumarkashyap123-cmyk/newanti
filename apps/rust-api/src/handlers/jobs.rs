//! Job queue API handlers

use axum::{
    extract::{Path, State},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::error::{ApiError, ApiResult};
use crate::AppState;
use crate::solver::job_queue::{JobPriority, JobType, JobQueue, QueueStatus};

/// Request to submit a new analysis job
#[derive(Debug, Deserialize)]
pub struct SubmitJobRequest {
    pub job_type: String,       // "static", "modal", "pdelta", "seismic", "buckling", "batch"
    pub priority: Option<String>, // "low", "normal", "high", "urgent"
    pub user_id: String,
    pub input: serde_json::Value,
}

/// Response with job ID
#[derive(Debug, Serialize)]
pub struct SubmitJobResponse {
    pub success: bool,
    pub job_id: String,
    pub message: String,
}

/// Response with job details
#[derive(Debug, Serialize)]
pub struct JobStatusResponse {
    pub success: bool,
    pub job_id: String,
    pub status: String,
    pub progress: f64,
    pub message: String,
    pub created_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
}

/// Queue status response
#[derive(Debug, Serialize)]
pub struct QueueStatusResponse {
    pub success: bool,
    pub queue: QueueStatus,
}

fn parse_job_type(s: &str) -> Result<JobType, String> {
    match s.to_lowercase().as_str() {
        "static" => Ok(JobType::StaticAnalysis),
        "modal" => Ok(JobType::ModalAnalysis),
        "pdelta" | "p-delta" => Ok(JobType::PDeltaAnalysis),
        "seismic" => Ok(JobType::SeismicAnalysis),
        "time-history" | "time_history" => Ok(JobType::TimeHistoryAnalysis),
        "buckling" => Ok(JobType::BucklingAnalysis),
        "design" => Ok(JobType::DesignCheck),
        "batch" => Ok(JobType::BatchAnalysis { model_count: 1 }),
        _ => Err(format!("Unknown job type: {}", s)),
    }
}

fn parse_priority(s: Option<&str>) -> JobPriority {
    match s.map(|s| s.to_lowercase()).as_deref() {
        Some("low") => JobPriority::Low,
        Some("high") => JobPriority::High,
        Some("urgent") => JobPriority::Urgent,
        _ => JobPriority::Normal,
    }
}

/// POST /api/jobs - Submit a new job
pub async fn submit_job(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<SubmitJobRequest>,
) -> ApiResult<Json<SubmitJobResponse>> {
    let job_type = parse_job_type(&req.job_type)
        .map_err(|e| ApiError::BadRequest(e))?;
    let priority = parse_priority(req.priority.as_deref());

    // Create a temporary job queue (in production, this would be shared state)
    let (queue, _rx) = JobQueue::new(
        num_cpus::get().max(2)
    );

    let job_id = queue.submit(job_type, priority, req.user_id, req.input).await;

    Ok(Json(SubmitJobResponse {
        success: true,
        job_id: job_id.clone(),
        message: format!("Job {} queued successfully", job_id),
    }))
}

/// GET /api/jobs/:id - Get job status
pub async fn get_job_status(
    State(_state): State<Arc<AppState>>,
    Path(job_id): Path<String>,
) -> ApiResult<Json<JobStatusResponse>> {
    // In production, look up from shared state
    Ok(Json(JobStatusResponse {
        success: true,
        job_id: job_id.clone(),
        status: "queued".into(),
        progress: 0.0,
        message: "Job is in queue".into(),
        created_at: chrono::Utc::now().to_rfc3339(),
        started_at: None,
        completed_at: None,
        result: None,
        error: None,
    }))
}

/// DELETE /api/jobs/:id - Cancel a job
pub async fn cancel_job(
    State(_state): State<Arc<AppState>>,
    Path(job_id): Path<String>,
) -> ApiResult<Json<serde_json::Value>> {
    Ok(Json(serde_json::json!({
        "success": true,
        "job_id": job_id,
        "message": "Job cancellation requested"
    })))
}

/// GET /api/jobs/queue/status - Get queue status
pub async fn get_queue_status(
    State(_state): State<Arc<AppState>>,
) -> ApiResult<Json<QueueStatusResponse>> {
    Ok(Json(QueueStatusResponse {
        success: true,
        queue: QueueStatus {
            queued: 0,
            running: 0,
            completed: 0,
            failed: 0,
            total: 0,
        },
    }))
}
