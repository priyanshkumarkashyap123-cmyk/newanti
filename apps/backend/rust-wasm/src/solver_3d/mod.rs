//! Facade for solver_3d: exports public types and the single analysis entry point.

pub mod types;
pub mod element;
pub mod node;
pub mod loads;
pub mod boundary_conditions;
pub mod matrix_assembly;
pub mod solver;
pub mod analysis;
pub mod results;
pub mod postprocessing;
pub mod utils;

// New modules for refactor
pub mod assembly;
pub mod solver_backend;
pub mod post;
pub mod combos;
pub mod analysis_core;
pub mod envelope;
pub mod result_builders;

pub use analysis_core::run_analysis;
pub use analysis_core::run_analysis as analyze_3d_frame;

pub use types::{
	AnalysisConfig,
	AnalysisResult3D,
	DistributedLoad,
	Element3D,
	ElementType,
	EquilibriumCheck,
	EnvelopeResult,
	LoadCombination,
	LoadDirection,
	MemberForces,
	NodalLoad,
	Node3D,
	PlateStressResult,
	PointLoadOnMember,
	TemperatureLoad,
};

// Public API: keep run_analysis as the single entry; alias analyze_3d_frame for legacy callers
pub use combos::{
	combine_load_cases,
	compute_envelope,
	standard_combinations_aisc_lrfd,
	standard_combinations_eurocode,
	standard_combinations_is800,
};
pub use result_builders::{build_analysis_result, build_zero_displacement_result};

// ModalResult is defined in dynamics.rs
pub use crate::dynamics::ModalResult;
