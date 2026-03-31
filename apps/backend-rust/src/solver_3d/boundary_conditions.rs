use std::collections::HashMap;

use nalgebra::{DMatrix, DVector};

use super::types::{Element3D, Node3D};

pub fn collect_free_dofs(nodes: &[Node3D]) -> Vec<usize> {
	let mut free_dofs = Vec::new();
	for (i, node) in nodes.iter().enumerate() {
		for dof in 0..6 {
			if !node.restraints[dof] {
				free_dofs.push(i * 6 + dof);
			}
		}
	}
	free_dofs
}

pub fn apply_spring_stiffness(
	nodes: &[Node3D],
	k_global: &mut DMatrix<f64>,
) {
	for (idx, node) in nodes.iter().enumerate() {
		if let Some(ref springs) = node.spring_stiffness {
			let dof = idx * 6;
			for (d, &ks) in springs.iter().enumerate() {
				if d < 6 && ks > 0.0 {
					k_global[(dof + d, dof + d)] += ks;
				}
			}
		}
	}
}

pub fn reduce_system(
	k_global: &DMatrix<f64>,
	f_global: &DVector<f64>,
	free_dofs: &[usize],
) -> (DMatrix<f64>, DVector<f64>) {
	let n_free = free_dofs.len();
	let mut k_ff = DMatrix::zeros(n_free, n_free);
	let mut f_f = DVector::zeros(n_free);

	for (i, &ri) in free_dofs.iter().enumerate() {
		f_f[i] = f_global[ri];
		for (j, &cj) in free_dofs.iter().enumerate() {
			k_ff[(i, j)] = k_global[(ri, cj)];
		}
	}

	(k_ff, f_f)
}

pub fn expand_solution(num_dof: usize, free_dofs: &[usize], u_f: &DVector<f64>) -> DVector<f64> {
	let mut u_global = DVector::zeros(num_dof);
	for (i, &dof_idx) in free_dofs.iter().enumerate() {
		u_global[dof_idx] = u_f[i];
	}
	u_global
}

pub fn map_nodes_to_indices(nodes: &[Node3D]) -> HashMap<String, usize> {
	let mut node_map = HashMap::new();
	for (idx, node) in nodes.iter().enumerate() {
		node_map.insert(node.id.clone(), idx);
	}
	node_map
}

pub fn has_member_count_pin_support(node: &Node3D, single_member: bool) -> bool {
	let has_translation = node.restraints[0] || node.restraints[1] || node.restraints[2];
	let has_moment_z = node.restraints[5];
	has_translation && !has_moment_z && single_member
}

pub fn zero_support_reactions_for_unused_elements(_elements: &[Element3D]) {
}

