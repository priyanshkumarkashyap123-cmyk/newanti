//! Error types and handling

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ApiError {
    #[error("Invalid request: {0}")]
    BadRequest(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Unauthorized")]
    Unauthorized,

    #[error("Rate limit exceeded")]
    RateLimited,

    #[error("Analysis failed: {0}")]
    AnalysisFailed(String),

    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("Internal server error: {0}")]
    InternalError(String),

    #[error("Timeout: analysis took too long")]
    Timeout,

    #[error("Model too large: {0}")]
    ModelTooLarge(String),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, error_message) = match &self {
            ApiError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            ApiError::InvalidInput(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            ApiError::NotFound(msg) => (StatusCode::NOT_FOUND, msg.clone()),
            ApiError::Unauthorized => (StatusCode::UNAUTHORIZED, "Unauthorized".to_string()),
            ApiError::RateLimited => (
                StatusCode::TOO_MANY_REQUESTS,
                "Rate limit exceeded".to_string(),
            ),
            ApiError::AnalysisFailed(msg) => (StatusCode::UNPROCESSABLE_ENTITY, msg.clone()),
            ApiError::DatabaseError(msg) => {
                // Log the real error server-side, return generic message to client
                tracing::error!("Database error: {}", msg);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "A database error occurred. Please try again.".to_string(),
                )
            }
            ApiError::InternalError(msg) => {
                tracing::error!("Internal error: {}", msg);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "An internal error occurred. Please try again.".to_string(),
                )
            }
            ApiError::Timeout => (StatusCode::REQUEST_TIMEOUT, "Analysis timeout".to_string()),
            ApiError::ModelTooLarge(msg) => (StatusCode::PAYLOAD_TOO_LARGE, msg.clone()),
        };

        let body = Json(json!({
            "success": false,
            "error": error_message,
            "code": status.as_u16()
        }));

        (status, body).into_response()
    }
}

impl From<mongodb::error::Error> for ApiError {
    fn from(err: mongodb::error::Error) -> Self {
        ApiError::DatabaseError(err.to_string())
    }
}

impl From<anyhow::Error> for ApiError {
    fn from(err: anyhow::Error) -> Self {
        ApiError::InternalError(err.to_string())
    }
}

pub type ApiResult<T> = Result<T, ApiError>;
