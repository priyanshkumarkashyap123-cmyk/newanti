//! Health check route module
//!
//! Re-exports the health check handler from handlers::health.
//! The route is registered in main.rs without auth middleware.
//!
//! Requirements: 18.1, 18.4

pub use crate::handlers::health::health_check;
