//! Custom middleware for the Rust API

use axum::{
    body::Body,
    extract::Request,
    http::{header, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use std::time::Instant;
use tracing::{info, warn};

/// JWT claims structure (matching Clerk format)
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,           // User ID
    pub exp: usize,            // Expiration time
    pub iat: usize,            // Issued at
    pub email: Option<String>,
    pub name: Option<String>,
}

/// Request timing middleware - logs request duration
pub async fn timing_middleware(
    request: Request,
    next: Next,
) -> Response {
    let start = Instant::now();
    let method = request.method().clone();
    let uri = request.uri().clone();
    
    let response = next.run(request).await;
    
    let duration = start.elapsed();
    let status = response.status();
    
    if duration.as_millis() > 100 {
        info!(
            method = %method,
            uri = %uri,
            status = %status,
            duration_ms = %duration.as_millis(),
            "Slow request"
        );
    }
    
    response
}

/// Request logging middleware
pub async fn logging_middleware(
    request: Request,
    next: Next,
) -> Response {
    let method = request.method().clone();
    let uri = request.uri().path().to_string();
    let headers = request.headers().clone();
    
    let user_agent = headers
        .get(header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown");
    
    info!(
        method = %method,
        path = %uri,
        user_agent = %user_agent,
        "Incoming request"
    );
    
    next.run(request).await
}

/// JWT authentication middleware
/// Note: For routes that require authentication
pub async fn auth_middleware(
    request: Request,
    next: Next,
) -> Result<Response, Response> {
    let jwt_secret = std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| "development-secret-key".to_string());
    
    // Extract token from Authorization header
    let auth_header = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok());
    
    let token = match auth_header {
        Some(header) if header.starts_with("Bearer ") => {
            &header[7..]
        }
        _ => {
            warn!("Missing or invalid Authorization header");
            return Err((
                StatusCode::UNAUTHORIZED,
                "Missing or invalid Authorization header"
            ).into_response());
        }
    };
    
    // Validate JWT
    let validation = Validation::new(Algorithm::HS256);
    match decode::<Claims>(
        token,
        &DecodingKey::from_secret(jwt_secret.as_bytes()),
        &validation,
    ) {
        Ok(token_data) => {
            info!(user_id = %token_data.claims.sub, "Authenticated request");
            // Could add claims to request extensions here
            Ok(next.run(request).await)
        }
        Err(e) => {
            warn!(error = %e, "JWT validation failed");
            Err((
                StatusCode::UNAUTHORIZED,
                "Invalid or expired token"
            ).into_response())
        }
    }
}

/// API key authentication middleware (for service-to-service)
pub async fn api_key_middleware(
    request: Request,
    next: Next,
) -> Result<Response, Response> {
    let api_key = std::env::var("RUST_API_KEY").ok();
    
    // If no API key is configured, allow all requests
    let Some(expected_key) = api_key else {
        return Ok(next.run(request).await);
    };
    
    let provided_key = request
        .headers()
        .get("X-API-Key")
        .and_then(|v| v.to_str().ok());
    
    match provided_key {
        Some(key) if key == expected_key => {
            Ok(next.run(request).await)
        }
        _ => {
            warn!("Invalid API key");
            Err((
                StatusCode::UNAUTHORIZED,
                "Invalid API key"
            ).into_response())
        }
    }
}

/// CORS preflight handler
/// Note: The CorsLayer in main.rs handles OPTIONS automatically.
/// This handler is kept as a fallback with matching allowed headers.
pub async fn cors_preflight() -> impl IntoResponse {
    Response::builder()
        .status(StatusCode::NO_CONTENT)
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "https://beamlabultimate.tech")
        .header(header::ACCESS_CONTROL_ALLOW_METHODS, "GET, POST, PUT, DELETE, OPTIONS, PATCH")
        .header(header::ACCESS_CONTROL_ALLOW_HEADERS, "Content-Type, Authorization, Accept, Origin, Cache-Control, X-API-Key, X-Requested-With, X-Request-ID, sentry-trace, baggage")
        .header(header::ACCESS_CONTROL_ALLOW_CREDENTIALS, "true")
        .header(header::ACCESS_CONTROL_MAX_AGE, "86400")
        .body(Body::empty())
        .unwrap()
}

/// Rate limit exceeded response
pub fn rate_limit_response() -> Response {
    Response::builder()
        .status(StatusCode::TOO_MANY_REQUESTS)
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::RETRY_AFTER, "60")
        .body(Body::from(r#"{"error":"Rate limit exceeded","retry_after":60}"#))
        .unwrap()
}
