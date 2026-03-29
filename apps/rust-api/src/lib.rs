//! BeamLab Rust API Library
//!
//! High-performance structural analysis library

#![deny(warnings)]
// Allow warnings during tests so unit test builds (which reference many
// library-only helpers) do not fail due to crate-wide deny(warnings).
// This preserves deny(warnings) for normal builds while making test
// iteration practical.
#![cfg_attr(test, allow(warnings))]

pub mod cache;
pub mod config;
pub mod db;
pub mod design_codes;
pub mod error;
pub mod handlers;
pub mod middleware;
pub mod models;
pub mod optimization;
pub mod solver; // FSD and structural optimization

pub use solver::cable::{CableElement, CableMaterial, CableSystem};
pub use solver::elements::{
    CrossSection, ElementMaterial, PlateShellElement, TimoshenkoBeamElement, TrussElement,
};
pub use solver::load_combinations::LoadCombinationEngine;
pub use solver::post_processor::PostProcessor;
pub use solver::section_database::SectionDatabase;
pub use solver::sparse_solver::SparseSolver;
// job_queue module kept in solver/ for potential future use, but not re-exported
pub use solver::ws_progress::ProgressBroadcaster;

// Re-export optimization engine
pub use optimization::{
    check_member as check_member_fsd, Constraint as OptConstraint, DesignCheck, FSDConfig,
    FSDEngine, FSDResult, IterationHistory, MemberForces, MemberGeometry, MemberType,
    Objective as OptObjective,
};

// Re-export design code types for international standards
pub use design_codes::aci_318::{
    ACICapacity, ACIColumnResult, ACIDesignParams, ACIDevLengthResult, ACISection,
};
pub use design_codes::aisc_360::{
    AiscCapacity, AiscCompressionCapacity, AiscCompressionParams, AiscDesignParams,
    AiscInteractionResult, AiscSection, AiscShearCapacity,
};
pub use design_codes::eurocode2::{
    EC2Capacity, EC2CrackWidthResult, EC2DesignParams, EC2PunchingShearResult, EC2Section,
};
pub use design_codes::eurocode3::{
    EC3BucklingResult, EC3Capacity, EC3DesignParams, EC3InteractionResult, EC3Section, SectionClass,
};
pub use design_codes::is_456::TorsionDesignResult;
pub use design_codes::nds_2018::{NDSCapacity, NDSDesignParams, NDSSection};

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
