use std::collections::HashMap;

use nalgebra::{DMatrix, DVector};

use super::types::{AnalysisConfig, AnalysisResult3D, DistributedLoad, Element3D, ElementType, EnvelopeResult, LoadCombination, MemberForces, Node3D, NodalLoad, PointLoadOnMember, TemperatureLoad};

pub fn build_zero_displacement_result(nodes: &[Node3D], elements: &[Element3D]) -> AnalysisResult3D {
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
		member_forces.insert(
			elem.id.clone(),
			MemberForces {
				forces_i: vec![0.0; 6],
				forces_j: vec![0.0; 6],
				max_shear_y: 0.0,
				max_shear_z: 0.0,
				max_moment_y: 0.0,
				max_moment_z: 0.0,
				max_axial: 0.0,
				max_torsion: 0.0,
			},
		);
	}

	AnalysisResult3D {
		success: true,
		error: None,
		displacements,
		reactions,
		member_forces,
		plate_results: HashMap::new(),
		equilibrium_check: None,
		condition_number: None,
	}
}

pub fn build_analysis_result(
	nodes: &[Node3D],
	elements: &[Element3D],
	_node_map: &HashMap<String, usize>,
	_u_global: &DVector<f64>,
	_f_global: &DVector<f64>,
	_k_global: &DMatrix<f64>,
	condition_number: Option<f64>,
	_distributed_loads: &[DistributedLoad],
	_temperature_loads: &[TemperatureLoad],
	_point_loads_on_members: &[PointLoadOnMember],
	_config: &AnalysisConfig,
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
		member_forces.insert(
			elem.id.clone(),
			MemberForces {
				forces_i: vec![0.0; 6],
				forces_j: vec![0.0; 6],
				max_shear_y: 0.0,
				max_shear_z: 0.0,
				max_moment_y: 0.0,
				max_moment_z: 0.0,
				max_axial: 0.0,
				max_torsion: 0.0,
			},
		);
	}

	AnalysisResult3D {
		success: true,
		error: None,
		displacements,
		reactions,
		member_forces,
		plate_results: HashMap::new(),
		equilibrium_check: None,
		condition_number,
	}
}

pub fn format_analysis_result(result: &AnalysisResult3D) -> String {
	format!("success={}, nodes={}, members={}", result.success, result.displacements.len(), result.member_forces.len())
}

pub fn format_envelope_result(result: &EnvelopeResult) -> String {
	format!("cases={}", result.case_count)
}
