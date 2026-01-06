//! BeamLab Rust API Library
//! 
//! High-performance structural analysis library

pub mod solver;
pub mod config;
pub mod db;
pub mod error;
pub mod handlers;
pub mod middleware;
pub mod models;

pub use solver::cable::{CableMaterial, CableElement, CableSystem};

// Re-export AppState for integration tests
pub use crate::config::Config;
pub use crate::db::Database;

use std::sync::Arc;

/// Application state shared across all handlers
pub struct AppState {
    pub db: Database,
    pub config: Config,
}
