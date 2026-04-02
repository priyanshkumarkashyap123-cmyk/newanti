use super::types::{AnalysisResult3D, EnvelopeResult};

pub use super::result_builders::{build_analysis_result, build_zero_displacement_result};

pub fn format_analysis_result(result: &AnalysisResult3D) -> String {
	format!("success={}, nodes={}, members={}", result.success, result.displacements.len(), result.member_forces.len())
}

pub fn format_envelope_result(result: &EnvelopeResult) -> String {
	format!("max_displacements={}, max_reactions={}, max_members={}", result.max_displacements.len(), result.max_reactions.len(), result.max_member_forces.len())
}
