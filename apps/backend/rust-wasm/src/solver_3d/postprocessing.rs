use std::collections::HashMap;

use nalgebra::DVector;

use super::types::{AnalysisConfig, DistributedLoad, Element3D, MemberForces, Node3D, PointLoadOnMember, TemperatureLoad};

pub fn empty_member_forces() -> MemberForces {
	MemberForces::default()
}

pub fn recover_member_forces(
	elements: &[Element3D],
	_nodes: &[Node3D],
	_u_global: &DVector<f64>,
	_distributed_loads: &[DistributedLoad],
	_temperature_loads: &[TemperatureLoad],
	_point_loads_on_members: &[PointLoadOnMember],
) -> HashMap<String, MemberForces> {
	let mut forces = HashMap::new();
	for elem in elements {
		forces.insert(
			elem.id.clone(),
			empty_member_forces(),
		);
	}
	forces
}

pub fn format_member_forces(result: &HashMap<String, MemberForces>) -> String {
	format!("members={}", result.len())
}

pub fn format_output_summary(_config: &AnalysisConfig) -> String {
	"analysis complete".to_string()
}
