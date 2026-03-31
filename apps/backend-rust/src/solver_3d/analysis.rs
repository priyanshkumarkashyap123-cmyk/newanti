use std::collections::HashMap;

use nalgebra::{DMatrix, DVector};

use super::boundary_conditions::{apply_spring_stiffness, collect_free_dofs, expand_solution, map_nodes_to_indices, reduce_system};
use super::loads::assemble_global_load_vector;
use super::matrix_assembly::assemble_global_stiffness_matrix;
use super::results::{build_analysis_result, build_zero_displacement_result};
use super::solver::solve_linear_system;
use super::types::{AnalysisConfig, AnalysisResult3D, DistributedLoad, Element3D, EnvelopeResult, LoadCombination, Node3D, NodalLoad, PointLoadOnMember, TemperatureLoad};

pub fn run_analysis(
	nodes: Vec<Node3D>,
	elements: Vec<Element3D>,
	nodal_loads: Vec<NodalLoad>,
	distributed_loads: Vec<DistributedLoad>,
	temperature_loads: Vec<TemperatureLoad>,
	point_loads_on_members: Vec<PointLoadOnMember>,
	config: AnalysisConfig,
) -> Result<AnalysisResult3D, String> {
	if nodes.is_empty() {
		return Err("No nodes in structure".to_string());
	}
	if elements.is_empty() {
		return Err("No elements in structure".to_string());
	}

	let node_map = map_nodes_to_indices(&nodes);
	let mut k_global = assemble_global_stiffness_matrix(&nodes, &elements, &node_map);
	apply_spring_stiffness(&nodes, &mut k_global);

	let f_global = assemble_global_load_vector(
		&nodes,
		&elements,
		&node_map,
		&nodal_loads,
		&distributed_loads,
		&temperature_loads,
		&point_loads_on_members,
	);

	let free_dofs = collect_free_dofs(&nodes);
	if free_dofs.is_empty() {
		return Ok(build_zero_displacement_result(&nodes, &elements));
	}

	let (k_ff, f_f) = reduce_system(&k_global, &f_global, &free_dofs);
	let (u_f, condition_number) = solve_linear_system(&k_ff, &f_f)?;
	let u_global = expand_solution(nodes.len() * 6, &free_dofs, &u_f);

	Ok(build_analysis_result(
		&nodes,
		&elements,
		&node_map,
		&u_global,
		&f_global,
		&k_global,
		condition_number,
		&distributed_loads,
		&temperature_loads,
		&point_loads_on_members,
		&config,
	))
}

pub fn combine_load_cases(
	load_cases: &[HashMap<String, f64>],
	combinations: &[LoadCombination],
) -> Vec<HashMap<String, f64>> {
	let mut result = Vec::new();
	for combo in combinations {
		let mut combined = HashMap::new();
		for case in load_cases {
			for (k, v) in case {
				*combined.entry(k.clone()).or_insert(0.0) += v * combo.factor;
			}
		}
		result.push(combined);
	}
	result
}

pub fn compute_envelope(results: &[AnalysisResult3D]) -> EnvelopeResult {
	let mut envelope = EnvelopeResult::default();
	envelope.case_count = results.len();
	envelope
}
