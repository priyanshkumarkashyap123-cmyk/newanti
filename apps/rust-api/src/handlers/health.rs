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
    Json(json!({
        "status": "ok",
        "service": "BeamLab Rust API",
        "version": "2.1.0",
        "engine": "Rust/Axum",
        "threads": rayon::current_num_threads(),
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
