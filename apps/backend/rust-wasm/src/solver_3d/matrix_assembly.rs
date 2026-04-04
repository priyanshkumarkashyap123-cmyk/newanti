use std::collections::HashMap;

use nalgebra::DMatrix;

use super::element::BaseElement;
use super::types::{Element3D, ElementType, Node3D};

pub fn assemble_global_stiffness_matrix(
	nodes: &[Node3D],
	elements: &[Element3D],
	node_map: &HashMap<String, usize>,
) -> DMatrix<f64> {
	let num_dof = nodes.len() * 6;
	let mut k_global = DMatrix::zeros(num_dof, num_dof);

	for element in elements {
		match element.element_type {
			ElementType::Frame | ElementType::Truss | ElementType::Cable => {
				let i_idx = match node_map.get(&element.node_i) {
					Some(&idx) => idx,
					None => continue,
				};
				let j_idx = match node_map.get(&element.node_j) {
					Some(&idx) => idx,
					None => continue,
				};

				let node_i = &nodes[i_idx];
				let node_j = &nodes[j_idx];
				let dx = node_j.x - node_i.x;
				let dy = node_j.y - node_i.y;
				let dz = node_j.z - node_i.z;
				let length = (dx * dx + dy * dy + dz * dz).sqrt();
				if length < 1e-10 {
					continue;
				}

				let k_local = element.stiffness_matrix(length);
				let t_matrix = element.transformation_matrix(dx, dy, dz, length);
				let k_global_elem = t_matrix.transpose() * &k_local * &t_matrix;

				let dof_i = i_idx * 6;
				let dof_j = j_idx * 6;
				for r in 0..6 {
					for c in 0..6 {
						k_global[(dof_i + r, dof_i + c)] += k_global_elem[(r, c)];
						k_global[(dof_i + r, dof_j + c)] += k_global_elem[(r, 6 + c)];
						k_global[(dof_j + r, dof_i + c)] += k_global_elem[(6 + r, c)];
						k_global[(dof_j + r, dof_j + c)] += k_global_elem[(6 + r, 6 + c)];
					}
				}
			}
			ElementType::Plate => {
				continue;
			}
		}
	}

	k_global
}
