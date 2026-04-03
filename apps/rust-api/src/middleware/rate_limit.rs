//! Custom middleware for the Rust API

use axum::{
    body::Body,
    extract::Request,
    http::{header, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use governor::{clock::DefaultClock, state::keyed::DashMapStateStore, Quota, RateLimiter};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use std::sync::atomic::{AtomicU64, Ordering};
use sha2::{Digest, Sha256};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, num::NonZeroU32, sync::{Arc, Mutex, OnceLock}, time::Instant};
use tracing::{error, info, warn};
use uuid::Uuid;

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
            general: Arc::new(RateLimiter::dashmap(Quota::per_minute(
                NonZeroU32::new(100).unwrap(),
            ))),
            analysis: Arc::new(RateLimiter::dashmap(Quota::per_minute(
                NonZeroU32::new(15).unwrap(),
            ))),
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
pub async fn rate_limit_middleware(request: Request, next: Next) -> Response {
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
        Arc::new(RateLimiter::dashmap(Quota::per_minute(
            NonZeroU32::new(100).unwrap(),
        )))
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
pub async fn analysis_rate_limit_middleware(request: Request, next: Next) -> Response {
    let ip = client_ip(&request);
    let path = request.uri().path().to_string();

    static LIMITER: std::sync::OnceLock<Arc<KeyedLimiter>> = std::sync::OnceLock::new();
    let limiter = LIMITER.get_or_init(|| {
        Arc::new(RateLimiter::dashmap(Quota::per_minute(
            NonZeroU32::new(15).unwrap(),
        )))
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
pub async fn security_headers_middleware(request: Request, next: Next) -> Response {
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

    // Deprecation headers — signal unversioned API sunset (2026-09-30)
    headers.insert(
        header::HeaderName::from_static("deprecation"),
        "true".parse().unwrap(),
    );
    headers.insert(
        header::HeaderName::from_static("sunset"),
        "Wed, 30 Sep 2026 00:00:00 GMT".parse().unwrap(),
    );
    headers.insert(
        header::HeaderName::from_static("link"),
        r#"<https://docs.beamlabultimate.tech/api-versioning>; rel="successor-version", <https://docs.beamlabultimate.tech/migration-guide>; rel="migration""#.parse().unwrap(),
    );

    response
}

/// JWT claims structure (matching Clerk format)
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // User ID
    pub exp: usize,  // Expiration time
    pub iat: usize,  // Issued at
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
pub async fn timing_middleware(request: Request, next: Next) -> Response {
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
pub async fn logging_middleware(request: Request, next: Next) -> Response {
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
        response
            .headers_mut()
            .insert(header::HeaderName::from_static("x-request-id"), v);
    }

    response
}

fn is_production_runtime() -> bool {
    std::env::var("RUST_ENV")
        .or_else(|_| std::env::var("NODE_ENV"))
        .unwrap_or_else(|_| "development".to_string())
        == "production"
}

fn hmac_sha256_hex(secret: &str, message: &str) -> String {
    const BLOCK_SIZE: usize = 64;

    let mut key = secret.as_bytes().to_vec();
    if key.len() > BLOCK_SIZE {
        let mut hasher = Sha256::new();
        hasher.update(&key);
        key = hasher.finalize().to_vec();
    }
    if key.len() < BLOCK_SIZE {
        key.resize(BLOCK_SIZE, 0);
    }

    let mut o_key_pad = vec![0x5c_u8; BLOCK_SIZE];
    let mut i_key_pad = vec![0x36_u8; BLOCK_SIZE];
    for i in 0..BLOCK_SIZE {
        o_key_pad[i] ^= key[i];
        i_key_pad[i] ^= key[i];
    }

    let mut inner = Sha256::new();
    inner.update(&i_key_pad);
    inner.update(message.as_bytes());
    let inner_hash = inner.finalize();

    let mut outer = Sha256::new();
    outer.update(&o_key_pad);
    outer.update(inner_hash);
    let digest = outer.finalize();

    let mut out = String::with_capacity(digest.len() * 2);
    for byte in digest {
        use std::fmt::Write as _;
        let _ = write!(out, "{:02x}", byte);
    }
    out
}

fn nonce_cache() -> &'static Mutex<HashMap<String, i64>> {
    static NONCE_CACHE: OnceLock<Mutex<HashMap<String, i64>>> = OnceLock::new();
    NONCE_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

pub static INTERNAL_AUTH_REJECTED_TOTAL: AtomicU64 = AtomicU64::new(0);
pub static INTERNAL_AUTH_REPLAY_REJECTED: AtomicU64 = AtomicU64::new(0);
pub static INTERNAL_AUTH_MISSING_SIGNED_HEADERS: AtomicU64 = AtomicU64::new(0);
pub static INTERNAL_AUTH_INVALID_TIMESTAMP: AtomicU64 = AtomicU64::new(0);
pub static INTERNAL_AUTH_TIMESTAMP_SKEW_REJECTED: AtomicU64 = AtomicU64::new(0);
pub static INTERNAL_AUTH_SIGNATURE_MISMATCH: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, Copy, Serialize)]
pub struct InternalAuthMetrics {
    pub rejected_total: u64,
    pub replay_rejected: u64,
    pub missing_signed_headers: u64,
    pub invalid_timestamp: u64,
    pub timestamp_skew_rejected: u64,
    pub signature_mismatch: u64,
}

#[inline]
fn mark_internal_auth_rejected(counter: &AtomicU64) {
    INTERNAL_AUTH_REJECTED_TOTAL.fetch_add(1, Ordering::Relaxed);
    counter.fetch_add(1, Ordering::Relaxed);
}

pub fn internal_auth_metrics_snapshot() -> InternalAuthMetrics {
    InternalAuthMetrics {
        rejected_total: INTERNAL_AUTH_REJECTED_TOTAL.load(Ordering::Relaxed),
        replay_rejected: INTERNAL_AUTH_REPLAY_REJECTED.load(Ordering::Relaxed),
        missing_signed_headers: INTERNAL_AUTH_MISSING_SIGNED_HEADERS.load(Ordering::Relaxed),
        invalid_timestamp: INTERNAL_AUTH_INVALID_TIMESTAMP.load(Ordering::Relaxed),
        timestamp_skew_rejected: INTERNAL_AUTH_TIMESTAMP_SKEW_REJECTED.load(Ordering::Relaxed),
        signature_mismatch: INTERNAL_AUTH_SIGNATURE_MISMATCH.load(Ordering::Relaxed),
    }
}

fn reserve_internal_nonce(nonce: &str, now: i64, ttl_sec: i64) -> bool {
    let cache = nonce_cache();
    let mut guard = match cache.lock() {
        Ok(g) => g,
        Err(_) => return false,
    };

    guard.retain(|_, expiry| *expiry > now);

    if guard.contains_key(nonce) {
        return false;
    }

    guard.insert(nonce.to_string(), now + ttl_sec.max(1));
    true
}

fn verify_internal_service_signature(request: &Request) -> bool {
    let internal_secret = std::env::var("INTERNAL_SERVICE_SECRET").unwrap_or_default();
    if internal_secret.trim().len() < 16 {
        return false;
    }

    let caller = request
        .headers()
        .get("x-internal-caller")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let timestamp_raw = request
        .headers()
        .get("x-internal-timestamp")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let signature = request
        .headers()
        .get("x-internal-signature")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let nonce = request
        .headers()
        .get("x-internal-nonce")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let request_id = request
        .headers()
        .get("x-request-id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if !caller.is_empty()
        && !timestamp_raw.is_empty()
        && !nonce.is_empty()
        && !signature.is_empty()
        && !request_id.is_empty()
    {
        let timestamp = match timestamp_raw.parse::<i64>() {
            Ok(v) => v,
            Err(_) => {
                mark_internal_auth_rejected(&INTERNAL_AUTH_INVALID_TIMESTAMP);
                return false;
            }
        };
        let max_skew = std::env::var("INTERNAL_SIGNATURE_MAX_SKEW_SEC")
            .ok()
            .and_then(|v| v.parse::<i64>().ok())
            .filter(|v| *v > 0)
            .unwrap_or(120);

        let now = chrono::Utc::now().timestamp();
        if (now - timestamp).abs() > max_skew {
            mark_internal_auth_rejected(&INTERNAL_AUTH_TIMESTAMP_SKEW_REJECTED);
            return false;
        }

        let nonce_ttl = std::env::var("INTERNAL_NONCE_TTL_SEC")
            .ok()
            .and_then(|v| v.parse::<i64>().ok())
            .filter(|v| *v > 0)
            .unwrap_or(180);

        let message = format!("{}:{}:{}:{}", caller, timestamp, nonce, request_id);
        let expected = hmac_sha256_hex(&internal_secret, &message);
        let signature_ok = subtle::ConstantTimeEq::ct_eq(expected.as_bytes(), signature.as_bytes())
            .unwrap_u8()
            == 1;

        if !signature_ok {
            mark_internal_auth_rejected(&INTERNAL_AUTH_SIGNATURE_MISMATCH);
            return false;
        }

        let nonce_ok = reserve_internal_nonce(nonce, now, nonce_ttl);
        if !nonce_ok {
            mark_internal_auth_rejected(&INTERNAL_AUTH_REPLAY_REJECTED);
        }
        return nonce_ok;
    }

    mark_internal_auth_rejected(&INTERNAL_AUTH_MISSING_SIGNED_HEADERS);

    // Backward compatibility while rolling out signed headers in non-production.
    if !is_production_runtime() {
        let internal_header = request
            .headers()
            .get("x-internal-service")
            .and_then(|v| v.to_str().ok());
        if let Some(internal) = internal_header {
            return subtle::ConstantTimeEq::ct_eq(internal_secret.as_bytes(), internal.as_bytes())
                .unwrap_u8()
                == 1;
        }
    }

    false
}

/// JWT authentication middleware
/// Note: For routes that require authentication
pub async fn auth_middleware(request: Request, next: Next) -> Result<Response, Response> {
    // Internal service bypass only when signed service headers verify.
    if verify_internal_service_signature(&request) {
        return Ok(next.run(request).await);
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
        Some(header) if header.starts_with("Bearer ") => &header[7..],
        _ => {
            warn!("Missing or invalid Authorization header");
            return Err((
                StatusCode::UNAUTHORIZED,
                "Missing or invalid Authorization header",
            )
                .into_response());
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
            Err((StatusCode::UNAUTHORIZED, "Invalid or expired token").into_response())
        }
    }
}

/// API key authentication middleware (for service-to-service)
pub async fn api_key_middleware(request: Request, next: Next) -> Result<Response, Response> {
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
        Some(key) if key == expected_key => Ok(next.run(request).await),
        _ => {
            warn!("Invalid API key");
            Err((StatusCode::UNAUTHORIZED, "Invalid API key").into_response())
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
        .body(Body::from(
            r#"{"error":"Rate limit exceeded","retry_after":60}"#,
        ))
        .unwrap()
}
