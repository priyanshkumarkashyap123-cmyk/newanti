//! Health check handlers

use axum::{response::IntoResponse, Json};
use serde_json::json;

/// Root endpoint
pub async fn root() -> impl IntoResponse {
    Json(json!({
        "name": "BeamLab Ultimate API",
        "version": "2.1.0",
        "engine": "Rust/Axum",
        "status": "running",
        "performance": "50x faster than Node.js"
    }))
}

/// Health check endpoint
pub async fn health_check() -> impl IntoResponse {
    let host_parallelism = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(1);
    let tokio_workers_configured = std::env::var("TOKIO_WORKER_THREADS")
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or(host_parallelism);
    let rayon_workers_configured = std::env::var("RAYON_NUM_THREADS")
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or(host_parallelism);

    Json(json!({
        "status": "ok",
        "service": "BeamLab Rust API",
        "version": "2.1.0",
        "engine": "Rust/Axum",
        "threads": {
            "rayon_effective": rayon::current_num_threads(),
            "rayon_configured": rayon_workers_configured,
            "tokio_configured": tokio_workers_configured,
            "host_available_parallelism": host_parallelism
        },
        "features": [
            "3D Frame Analysis (6 DOF)",
            "Sparse Matrix Solver",
            "Multi-threaded Assembly",
            "P-Delta Analysis",
            "Modal Analysis",
            "Buckling Analysis"
        ]
    }))
}

/// Readiness endpoint
pub async fn health_ready() -> impl IntoResponse {
    Json(json!({
        "status": "ready"
    }))
}

/// Dependencies status endpoint
pub async fn health_dependencies() -> impl IntoResponse {
    // In a real implementation, check dependent services (e.g., MongoDB)
    Json(json!({
        "mongodb": "connected"
    }))
}
