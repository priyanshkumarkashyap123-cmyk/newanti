//! Legacy analysis module. Use `analysis_core::run_analysis` as the entry point.

pub use crate::solver_3d::analysis_core::run_analysis;

use crate::dynamics::ModalResult;
use crate::pdelta_buckling::{BucklingMode, BucklingConfig, PDeltaConfig, PDeltaResult};
use crate::solver_3d::AnalysisConfig;

/// Stub modal analysis (not yet implemented in solver_3d). Returns error placeholder.
pub fn modal_analysis(_config: &AnalysisConfig) -> Result<ModalResult, String> {
	Ok(ModalResult {
		success: false,
		error: Some("modal_analysis not yet implemented in solver_3d".to_string()),
		frequencies: Vec::new(),
		periods: Vec::new(),
		mode_shapes: Vec::new(),
		mass_participation: Vec::new(),
		raw_eigenvectors: Vec::new(),
		effective_modal_masses: Vec::new(),
		total_mass: 0.0,
	})
}

/// Stub P-Delta analysis (not yet implemented). Returns default result with error flag.
pub fn p_delta_analysis(_config: &PDeltaConfig) -> Result<PDeltaResult, String> {
	Ok(PDeltaResult {
		converged: false,
		iterations: 0,
		displacements: Vec::new(),
		amplification_factors: Vec::new(),
		stability_coefficient: 0.0,
		axial_forces: Vec::new(),
	})
}

/// Stub linearized buckling analysis (not yet implemented). Returns empty modes.
pub fn linearized_buckling_analysis(_config: &BucklingConfig) -> Result<Vec<BucklingMode>, String> {
	Ok(Vec::new())
}
