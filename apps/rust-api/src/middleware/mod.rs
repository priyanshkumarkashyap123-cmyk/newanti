//! Middleware modules for the Rust API

pub mod performance;
pub mod rate_limit;

// Re-export commonly used items
pub use performance::{cacheable_headers, compression_layer, no_cache_headers};
pub use rate_limit::{auth_middleware, security_headers_middleware, SharedRateLimiter};
