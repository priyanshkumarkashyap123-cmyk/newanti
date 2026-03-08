//! Performance optimization middleware
//!
//! - HTTP response compression (gzip, brotli, deflate)
//! - Cache headers for static responses
//! - Request timing instrumentation
//! - Response size tracking

use axum::http::{header, HeaderValue};
use axum::response::{IntoResponse, Response};
use std::time::Instant;
use tower_http::compression::{CompressionLayer, predicate::SizeAbove};
use tower_http::compression::CompressionLevel;

/// Add compression middleware with optimal settings
pub fn compression_layer() -> CompressionLayer {
    CompressionLayer::new()
        .gzip(true)
        .br(true) // Brotli
        .deflate(true)
        // Only compress responses > 1KB
        .compress_when(SizeAbove::new(1024))
        // Use level 6 (balanced speed/ratio)
        .quality(CompressionLevel::Precise(6))
}

/// Response timing wrapper
#[derive(Debug)]
pub struct TimedResponse {
    pub response: Response,
    pub duration_ms: u64,
}

impl TimedResponse {
    pub fn new(response: Response, start: Instant) -> Self {
        let duration_ms = start.elapsed().as_millis() as u64;
        Self {
            response,
            duration_ms,
        }
    }
}

impl IntoResponse for TimedResponse {
    fn into_response(mut self) -> Response {
        // Add custom duration header
        self.response.headers_mut().insert(
            "X-Response-Time-Ms",
            HeaderValue::from_str(&self.duration_ms.to_string()).unwrap_or(HeaderValue::from_static("0")),
        );
        self.response
    }
}

/// Cache control headers for deterministic results
pub fn cacheable_headers() -> [(header::HeaderName, HeaderValue); 2] {
    [
        (
            header::CACHE_CONTROL,
            HeaderValue::from_static("public, max-age=3600, immutable"),
        ),
        (
            header::VARY,
            HeaderValue::from_static("Accept-Encoding"),
        ),
    ]
}

/// No-cache headers for dynamic results
pub fn no_cache_headers() -> [(header::HeaderName, HeaderValue); 1] {
    [
        (
            header::CACHE_CONTROL,
            HeaderValue::from_static("no-cache, no-store, must-revalidate"),
        ),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compression_layer_creation() {
        let layer = compression_layer();
        // Should not panic
        drop(layer);
    }

    #[test]
    fn test_cacheable_headers() {
        let headers = cacheable_headers();
        assert_eq!(headers.len(), 2);
        assert_eq!(headers[0].0, header::CACHE_CONTROL);
    }

    #[test]
    fn test_no_cache_headers() {
        let headers = no_cache_headers();
        assert_eq!(headers.len(), 1);
        assert_eq!(headers[0].0, header::CACHE_CONTROL);
    }
}
