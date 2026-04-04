use std::collections::HashMap;

use super::types::{AnalysisResult3D, EquilibriumCheck, MemberForces, PlateStressResult};

pub fn build_analysis_result(
	displacements: HashMap<String, Vec<f64>>,
	reactions: HashMap<String, Vec<f64>>,
	member_forces: HashMap<String, MemberForces>,
	plate_results: HashMap<String, PlateStressResult>,
	equilibrium_check: Option<EquilibriumCheck>,
	condition_number: Option<f64>,
) -> AnalysisResult3D {
	AnalysisResult3D {
		success: true,
		error: None,
		displacements,
		reactions,
		member_forces,
		plate_results,
		equilibrium_check,
		condition_number,
	}
}

pub fn build_zero_displacement_result(
	nodes: &[super::types::Node3D],
	elements: &[super::types::Element3D],
) -> AnalysisResult3D {
	let mut displacements = HashMap::new();
	let mut reactions = HashMap::new();
	let mut member_forces = HashMap::new();

	for node in nodes {
		displacements.insert(node.id.clone(), vec![0.0; 6]);
		if node.restraints.iter().any(|&r| r) {
			reactions.insert(node.id.clone(), vec![0.0; 6]);
		}
	}

	for elem in elements {
		member_forces.insert(elem.id.clone(), MemberForces::default());
	}

	AnalysisResult3D {
		success: true,
		error: None,
		displacements,
		reactions,
		member_forces,
		plate_results: HashMap::new(),
		equilibrium_check: Some(EquilibriumCheck {
			applied_forces: vec![0.0; 6],
			reaction_forces: vec![0.0; 6],
			residual: vec![0.0; 6],
			error_percent: 0.0,
			pass: true,
		}),
		condition_number: None,
	}
}
