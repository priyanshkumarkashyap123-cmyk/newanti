//! Custom middleware for the Rust API

use axum::{
    body::Body,
    extract::Request,
    http::{header, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use governor::{Quota, RateLimiter, clock::DefaultClock, state::keyed::DashMapStateStore};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use std::{num::NonZeroU32, sync::Arc, time::Instant};
use uuid::Uuid;
use tracing::{info, warn, error};

// ─────────────────────────────────────────────────────────────
// Rate Limiter (Governor — production-grade token-bucket)
// ─────────────────────────────────────────────────────────────

type KeyedLimiter = RateLimiter<String, DashMapStateStore<String>, DefaultClock>;

/// Shared rate limiter state — create once in main(), share via Arc.
#[derive(Clone)]
pub struct SharedRateLimiter {
    pub general: Arc<KeyedLimiter>,  // 100 req/min
    pub analysis: Arc<KeyedLimiter>, // 15 req/min
}

impl SharedRateLimiter {
    pub fn new() -> Self {
        Self {
            general: Arc::new(RateLimiter::dashmap(
                Quota::per_minute(NonZeroU32::new(100).unwrap()),
            )),
            analysis: Arc::new(RateLimiter::dashmap(
                Quota::per_minute(NonZeroU32::new(15).unwrap()),
            )),
        }
    }
}

/// Extract client IP from X-Forwarded-For or socket address.
fn client_ip(req: &Request) -> String {
    req.headers()
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(',').next())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

/// General rate-limit middleware — apply to all routes.
pub async fn rate_limit_middleware(
    request: Request,
    next: Next,
) -> Response {
    // Skip health endpoints
    let path = request.uri().path();
    if path == "/" || path == "/health" || request.method() == axum::http::Method::OPTIONS {
        return next.run(request).await;
    }

    let ip = client_ip(&request);

    // Use a simple global limiter (governor with DashMap)
    // Build in-line for simplicity (governor is zero-alloc per check)
    static LIMITER: std::sync::OnceLock<Arc<KeyedLimiter>> = std::sync::OnceLock::new();
    let limiter = LIMITER.get_or_init(|| {
        Arc::new(RateLimiter::dashmap(
            Quota::per_minute(NonZeroU32::new(100).unwrap()),
        ))
    });

    match limiter.check_key(&ip) {
        Ok(_) => next.run(request).await,
        Err(_) => {
            warn!(ip = %ip, path = %path, "Rate limit exceeded");
            rate_limit_response()
        }
    }
}

/// Stricter rate-limit for analysis endpoints — 15 req/min.
pub async fn analysis_rate_limit_middleware(
    request: Request,
    next: Next,
) -> Response {
    let ip = client_ip(&request);
    let path = request.uri().path().to_string();

    static LIMITER: std::sync::OnceLock<Arc<KeyedLimiter>> = std::sync::OnceLock::new();
    let limiter = LIMITER.get_or_init(|| {
        Arc::new(RateLimiter::dashmap(
            Quota::per_minute(NonZeroU32::new(15).unwrap()),
        ))
    });

    match limiter.check_key(&ip) {
        Ok(_) => next.run(request).await,
        Err(_) => {
            warn!(ip = %ip, path = %path, "Analysis rate limit exceeded");
            rate_limit_response()
        }
    }
}

/// Security-headers middleware — adds standard headers to every response.
pub async fn security_headers_middleware(
    request: Request,
    next: Next,
) -> Response {
    let mut response = next.run(request).await;
    let headers = response.headers_mut();

    headers.insert(
        header::HeaderName::from_static("x-content-type-options"),
        "nosniff".parse().unwrap(),
    );
    headers.insert(
        header::HeaderName::from_static("x-frame-options"),
        "DENY".parse().unwrap(),
    );
    headers.insert(
        header::HeaderName::from_static("referrer-policy"),
        "strict-origin-when-cross-origin".parse().unwrap(),
    );
    headers.insert(
        header::HeaderName::from_static("x-xss-protection"),
        "0".parse().unwrap(),
    );
    headers.insert(
        header::HeaderName::from_static("permissions-policy"),
        "geolocation=(), microphone=(), camera=()".parse().unwrap(),
    );

    response
}

/// JWT claims structure (matching Clerk format)
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,           // User ID
    pub exp: usize,            // Expiration time
    pub iat: usize,            // Issued at
    pub email: Option<String>,
    pub name: Option<String>,
}

/// Authenticated user extracted from JWT — inserted into request extensions
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: String,
    pub email: Option<String>,
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
    
    let request_id = headers
        .get("x-request-id")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    info!(
        method = %method,
        path = %uri,
        user_agent = %user_agent,
        request_id = %request_id,
        "Incoming request"
    );

    let mut response = next.run(request).await;
    if let Ok(v) = request_id.parse() {
        response.headers_mut().insert(
            header::HeaderName::from_static("x-request-id"),
            v,
        );
    }

    response
}

/// JWT authentication middleware
/// Note: For routes that require authentication
pub async fn auth_middleware(
    request: Request,
    next: Next,
) -> Result<Response, Response> {
    // Internal service secret bypass (mirrors Python backend)
    let internal_secret = std::env::var("INTERNAL_SERVICE_SECRET").unwrap_or_default();
    let internal_header = request.headers().get("x-internal-service").and_then(|v| v.to_str().ok());
    if !internal_secret.is_empty() && internal_secret.len() >= 16 {
        if let Some(internal) = internal_header {
            if subtle::ConstantTimeEq::ct_eq(internal_secret.as_bytes(), internal.as_bytes()).unwrap_u8() == 1 {
                // Allow request as internal service
                return Ok(next.run(request).await);
            }
        }
    }

    // Fallback to JWT auth
    let jwt_secret = match std::env::var("JWT_SECRET") {
        Ok(secret) if !secret.is_empty() => secret,
        _ => {
            error!("JWT_SECRET environment variable is not set — refusing to start auth");
            return Err(Response::builder()
                .status(StatusCode::INTERNAL_SERVER_ERROR)
                .body(Body::from("{\"error\":\"Server misconfiguration\"}"))
                .unwrap());
        }
    };

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
            // Inject user_id into request extensions for downstream handlers
            let mut request = request;
            request.extensions_mut().insert(AuthUser {
                user_id: token_data.claims.sub.clone(),
                email: token_data.claims.email.clone(),
            });
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
pub async fn cors_preflight(request: Request) -> impl IntoResponse {
    let origin = request
        .headers()
        .get(header::ORIGIN)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    
    let allowed_origins = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://beamlabultimate.tech",
        "https://www.beamlabultimate.tech",
        "https://brave-mushroom-0eae8ec00.4.azurestaticapps.net",
    ];
    
    let allow_origin = if allowed_origins.contains(&origin) {
        origin
    } else {
        "https://beamlabultimate.tech"
    };
    
    Response::builder()
        .status(StatusCode::NO_CONTENT)
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, allow_origin)
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
