//! Middleware modules for the Rust API

pub mod performance;
pub mod rate_limit;

// Re-export commonly used items
pub use performance::{compression_layer, cacheable_headers, no_cache_headers};
pub use rate_limit::{SharedRateLimiter, auth_middleware, security_headers_middleware};
