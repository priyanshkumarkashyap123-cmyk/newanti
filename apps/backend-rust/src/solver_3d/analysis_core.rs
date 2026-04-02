use super::boundary_conditions::{apply_spring_stiffness, collect_free_dofs, expand_solution, map_nodes_to_indices, reduce_system};
use super::loads::assemble_global_load_vector;
use super::matrix_assembly::assemble_global_stiffness_matrix;
use super::result_builders::{build_analysis_result, build_zero_displacement_result};
use super::solver::solve_linear_system;
use super::types::{AnalysisConfig, AnalysisResult3D, DistributedLoad, Element3D, Node3D, NodalLoad, PointLoadOnMember, TemperatureLoad};

/// Single entry point for 3D frame analysis.
pub fn run_analysis(
	nodes: Vec<Node3D>,
	elements: Vec<Element3D>,
	nodal_loads: Vec<NodalLoad>,
	distributed_loads: Vec<DistributedLoad>,
	temperature_loads: Vec<TemperatureLoad>,
	point_loads_on_members: Vec<PointLoadOnMember>,
	_config: AnalysisConfig,
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

	let (displacements, reactions) = super::post::extract_nodal_results(
		&nodes,
		&u_global,
		&(&k_global * &u_global - &f_global),
	);
	let member_forces = super::post::calculate_member_forces(
		&elements,
		&nodes,
		&node_map,
		&u_global,
		&distributed_loads,
		&point_loads_on_members,
		&temperature_loads,
	)?;
	let plate_results = super::post::compute_plate_results(&elements, &nodes, &node_map, &u_global);
	let equilibrium_metrics = super::post::compute_equilibrium_metrics(
		&nodes,
		&elements,
		&node_map,
		&nodal_loads,
		&distributed_loads,
		&point_loads_on_members,
		&reactions,
		&u_global,
	);
	let equilibrium_check = Some(super::EquilibriumCheck {
		applied_forces: equilibrium_metrics.0,
		reaction_forces: equilibrium_metrics.1,
		residual: equilibrium_metrics.2,
		error_percent: equilibrium_metrics.3,
		pass: equilibrium_metrics.3 <= 5.0,
	});

	Ok(build_analysis_result(
		displacements,
		reactions,
		member_forces,
		plate_results,
		equilibrium_check,
		condition_number,
	))
}
