//! OpenAPI spec serving handler

use axum::{response::IntoResponse, http::StatusCode};

// Embed the OpenAPI YAML at compile time for portability
// Path is relative to the crate root (apps/rust-api)
const OPENAPI_YAML: &str = include_str!("../../openapi.yaml");

/// GET /api/openapi.yaml - Serve the OpenAPI specification
pub async fn serve_openapi() -> impl IntoResponse {
    // Return as plain text (YAML)
    (StatusCode::OK, OPENAPI_YAML)
}
