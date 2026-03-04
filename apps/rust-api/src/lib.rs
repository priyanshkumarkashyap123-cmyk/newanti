//! BeamLab Rust API Library
//! 
//! High-performance structural analysis library

pub mod cache;
pub mod solver;
pub mod config;
pub mod db;
pub mod design_codes;
pub mod error;
pub mod handlers;
pub mod middleware;
pub mod models;

pub use solver::cable::{CableMaterial, CableElement, CableSystem};
pub use solver::sparse_solver::SparseSolver;
pub use solver::load_combinations::LoadCombinationEngine;
pub use solver::post_processor::PostProcessor;
pub use solver::elements::{TimoshenkoBeamElement, TrussElement, PlateShellElement, ElementMaterial, CrossSection};
pub use solver::section_database::SectionDatabase;
// job_queue module kept in solver/ for potential future use, but not re-exported
pub use solver::ws_progress::ProgressBroadcaster;

// Re-export AppState for integration tests
pub use crate::cache::AnalysisCache;
pub use crate::config::Config;
pub use crate::db::Database;

/// Application state shared across all handlers
pub struct AppState {
    pub db: Database,
    pub config: Config,
    pub analysis_cache: AnalysisCache,
}
