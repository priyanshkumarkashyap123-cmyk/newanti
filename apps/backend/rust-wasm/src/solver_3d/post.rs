//! Post-processing: reactions, member forces, equilibrium checks, plate results.

use std::collections::HashMap;

use nalgebra::DVector;

use super::element::transformation_matrix_3d;
use super::loads::decompose_load_direction;
use super::types::{DistributedLoad, Element3D, NodalLoad, Node3D, PointLoadOnMember};
use super::{ElementType, EquilibriumCheck, MemberForces, PlateStressResult, TemperatureLoad};
use crate::plate_element::PlateElement;

fn frame_element_stiffness(elem: &Element3D, length: f64) -> nalgebra::DMatrix<f64> {
	crate::solver_3d::element::frame_element_stiffness(elem, length)
}

fn compute_point_load_fef(
	p: f64,
	position_ratio: f64,
	length: f64,
	is_moment: bool,
) -> (f64, f64, f64, f64) {
	crate::solver_3d::loads::compute_point_load_fef(p, position_ratio, length, is_moment)
}

pub struct DofPartition {
	pub free_dofs: Vec<usize>,
	pub fixed_dofs: Vec<usize>,
}

pub fn partition_dofs(nodes: &[Node3D]) -> DofPartition {
	let mut free_dofs = Vec::new();
	let mut fixed_dofs = Vec::new();

	for (i, node) in nodes.iter().enumerate() {
		for dof in 0..6 {
			let global_dof = i * 6 + dof;
			if node.restraints[dof] {
				fixed_dofs.push(global_dof);
			} else {
				free_dofs.push(global_dof);
			}
		}
	}

	DofPartition {
		free_dofs,
		fixed_dofs,
	}
}

pub fn extract_nodal_results(
	nodes: &[Node3D],
	u_global: &DVector<f64>,
	r_global: &DVector<f64>,
) -> (HashMap<String, Vec<f64>>, HashMap<String, Vec<f64>>) {
	let mut displacements = HashMap::new();
	let mut reactions = HashMap::new();

	for (idx, node) in nodes.iter().enumerate() {
		let dof = idx * 6;

		displacements.insert(
			node.id.clone(),
			vec![
				u_global[dof],
				u_global[dof + 1],
				u_global[dof + 2],
				u_global[dof + 3],
				u_global[dof + 4],
				u_global[dof + 5],
			],
		);

		if node.restraints.iter().any(|&r| r) {
			reactions.insert(
				node.id.clone(),
				vec![
					r_global[dof],
					r_global[dof + 1],
					r_global[dof + 2],
					r_global[dof + 3],
					r_global[dof + 4],
					r_global[dof + 5],
				],
			);
		}
	}

	(displacements, reactions)
}

/// Compute nodal displacements and reactions from global solution and full K, F.
pub fn compute_nodal_response(
	nodes: &[Node3D],
	_node_map: &HashMap<String, usize>,
	u_global: &DVector<f64>,
	f_global: &DVector<f64>,
	k_global: &nalgebra::DMatrix<f64>,
) -> (HashMap<String, Vec<f64>>, HashMap<String, Vec<f64>>) {
	let mut r_global = k_global * u_global - f_global;
	// Zero out free DOFs reactions to avoid noise; keep only restrained dofs.
	for (i, node) in nodes.iter().enumerate() {
		let base = i * 6;
		for d in 0..6 {
			if !node.restraints[d] {
				r_global[base + d] = 0.0;
			}
		}
	}
	extract_nodal_results(nodes, u_global, &r_global)
}

pub fn compute_equilibrium_metrics(
	nodes: &[Node3D],
	elements: &[Element3D],
	node_map: &HashMap<String, usize>,
	nodal_loads: &[NodalLoad],
	all_distributed_loads: &[DistributedLoad],
	point_loads_on_members: &[PointLoadOnMember],
	reactions: &HashMap<String, Vec<f64>>,
	u_global: &DVector<f64>,
) -> (Vec<f64>, Vec<f64>, Vec<f64>, f64) {
	let mut sum_applied = vec![0.0f64; 6];

	for load in nodal_loads {
		if let Some(&idx) = node_map.get(&load.node_id) {
			let n = &nodes[idx];
			sum_applied[0] += load.fx;
			sum_applied[1] += load.fy;
			sum_applied[2] += load.fz;
			sum_applied[3] += load.mx + (n.y * load.fz - n.z * load.fy);
			sum_applied[4] += load.my + (n.z * load.fx - n.x * load.fz);
			sum_applied[5] += load.mz + (n.x * load.fy - n.y * load.fx);
		}
	}

	for dl in all_distributed_loads {
		if let Some(element) = elements.iter().find(|e| e.id == dl.element_id) {
			let ii = node_map.get(&element.node_i);
			let ji = node_map.get(&element.node_j);
			if let (Some(&i_idx), Some(&j_idx)) = (ii, ji) {
				let ni = &nodes[i_idx];
				let nj = &nodes[j_idx];
				let dx = nj.x - ni.x;
				let dy = nj.y - ni.y;
				let dz = nj.z - ni.z;
				let length = (dx * dx + dy * dy + dz * dz).sqrt();
				if length < 1e-10 {
					continue;
				}

				let sp = dl.start_pos.max(0.0).min(1.0);
				let ep = dl.end_pos.max(0.0).min(1.0);
				let load_length = (ep - sp) * length;
				let total_w = (dl.w_start + dl.w_end) * load_length / 2.0;

				let w_sum = dl.w_start.abs() + dl.w_end.abs();
				let load_center_ratio = if w_sum > 1e-12 {
					sp + (ep - sp) * (dl.w_start.abs() + 2.0 * dl.w_end.abs()) / (3.0 * w_sum)
				} else {
					(sp + ep) / 2.0
				};
				let cx_load = ni.x + load_center_ratio * dx;
				let cy_load = ni.y + load_center_ratio * dy;
				let cz_load = ni.z + load_center_ratio * dz;

				let (gfx, gfy, gfz) = match dl.direction {
					super::types::LoadDirection::GlobalX => (total_w, 0.0, 0.0),
					super::types::LoadDirection::GlobalY => (0.0, total_w, 0.0),
					super::types::LoadDirection::GlobalZ => (0.0, 0.0, total_w),
					super::types::LoadDirection::LocalX => {
						let cx = dx / length;
						let cy = dy / length;
						let cz = dz / length;
						(total_w * cx, total_w * cy, total_w * cz)
					}
					super::types::LoadDirection::LocalY => {
						let t = transformation_matrix_3d(dx, dy, dz, length, element.beta);
						(total_w * t[(1, 0)], total_w * t[(1, 1)], total_w * t[(1, 2)])
					}
					super::types::LoadDirection::LocalZ => {
						let t = transformation_matrix_3d(dx, dy, dz, length, element.beta);
						(total_w * t[(2, 0)], total_w * t[(2, 1)], total_w * t[(2, 2)])
					}
				};

				sum_applied[0] += gfx;
				sum_applied[1] += gfy;
				sum_applied[2] += gfz;
				sum_applied[3] += cy_load * gfz - cz_load * gfy;
				sum_applied[4] += cz_load * gfx - cx_load * gfz;
				sum_applied[5] += cx_load * gfy - cy_load * gfx;
			}
		}
	}

	for pl in point_loads_on_members {
		if let Some(element) = elements.iter().find(|e| e.id == pl.element_id) {
			if let (Some(&ii), Some(&ji)) = (node_map.get(&element.node_i), node_map.get(&element.node_j)) {
				let ni = &nodes[ii];
				let nj = &nodes[ji];
				let dx = nj.x - ni.x;
				let dy = nj.y - ni.y;
				let dz = nj.z - ni.z;
				let length = (dx * dx + dy * dy + dz * dz).sqrt();
				if length < 1e-10 {
					continue;
				}

				let pos = pl.position.max(0.0).min(1.0);
				let px = ni.x + pos * dx;
				let py = ni.y + pos * dy;
				let pz = ni.z + pos * dz;

				let t_matrix = transformation_matrix_3d(dx, dy, dz, length, element.beta);
				let (lx, ly, lz) = decompose_load_direction(&pl.direction, &t_matrix);
				let gfx = pl.magnitude * (lx * t_matrix[(0, 0)] + ly * t_matrix[(1, 0)] + lz * t_matrix[(2, 0)]);
				let gfy = pl.magnitude * (lx * t_matrix[(0, 1)] + ly * t_matrix[(1, 1)] + lz * t_matrix[(2, 1)]);
				let gfz = pl.magnitude * (lx * t_matrix[(0, 2)] + ly * t_matrix[(1, 2)] + lz * t_matrix[(2, 2)]);

				if !pl.is_moment {
					sum_applied[0] += gfx;
					sum_applied[1] += gfy;
					sum_applied[2] += gfz;
					sum_applied[3] += py * gfz - pz * gfy;
					sum_applied[4] += pz * gfx - px * gfz;
					sum_applied[5] += px * gfy - py * gfx;
				}
			}
		}
	}

	let mut sum_reactions = vec![0.0f64; 6];
	for (node_id, rxn) in reactions {
		if let Some(&idx) = node_map.get(node_id) {
			let n = &nodes[idx];
			sum_reactions[0] += rxn[0];
			sum_reactions[1] += rxn[1];
			sum_reactions[2] += rxn[2];
			sum_reactions[3] += rxn[3] + (n.y * rxn[2] - n.z * rxn[1]);
			sum_reactions[4] += rxn[4] + (n.z * rxn[0] - n.x * rxn[2]);
			sum_reactions[5] += rxn[5] + (n.x * rxn[1] - n.y * rxn[0]);
		}
	}

	for (idx, node) in nodes.iter().enumerate() {
		if let Some(ref springs) = node.spring_stiffness {
			let dof = idx * 6;
			let mut f_spring = vec![0.0f64; 6];
			let mut has_spring = false;
			for (d, &ks) in springs.iter().enumerate() {
				if d < 6 && ks > 0.0 {
					f_spring[d] = -ks * u_global[dof + d];
					has_spring = true;
				}
			}
			if has_spring {
				sum_reactions[0] += f_spring[0];
				sum_reactions[1] += f_spring[1];
				sum_reactions[2] += f_spring[2];
				sum_reactions[3] += f_spring[3] + (node.y * f_spring[2] - node.z * f_spring[1]);
				sum_reactions[4] += f_spring[4] + (node.z * f_spring[0] - node.x * f_spring[2]);
				sum_reactions[5] += f_spring[5] + (node.x * f_spring[1] - node.y * f_spring[0]);
			}
		}
	}

	let mut residual = vec![0.0f64; 6];
	let mut max_applied = 0.0f64;
	let mut max_residual = 0.0f64;
	for i in 0..6 {
		residual[i] = sum_applied[i] + sum_reactions[i];
		max_applied = max_applied.max(sum_applied[i].abs()).max(sum_reactions[i].abs());
		max_residual = max_residual.max(residual[i].abs());
	}
	let error_pct = if max_applied > 1e-10 {
		max_residual / max_applied * 100.0
	} else {
		0.0
	};

	(sum_applied, sum_reactions, residual, error_pct)
}

/// Convenience wrapper matching legacy name.
pub fn compute_equilibrium_check(
	nodes: &[Node3D],
	elements: &[Element3D],
	node_map: &HashMap<String, usize>,
	nodal_loads: &[NodalLoad],
	all_distributed_loads: &[DistributedLoad],
	point_loads_on_members: &[PointLoadOnMember],
	reactions: &HashMap<String, Vec<f64>>,
	u_global: &DVector<f64>,
) -> EquilibriumCheck {
	let (applied, reaction, residual, error_pct) = compute_equilibrium_metrics(
		nodes,
		elements,
		node_map,
		nodal_loads,
		all_distributed_loads,
		point_loads_on_members,
		reactions,
		u_global,
	);
	EquilibriumCheck {
		applied_forces: applied,
		reaction_forces: reaction,
		residual,
		error_percent: error_pct,
		pass: error_pct < 1e-3,
	}
}

/// Calculate member forces from global displacements.
/// Member forces = k_local * T * u_global - FEF.
pub fn calculate_member_forces(
	elements: &[Element3D],
	nodes: &[Node3D],
	node_map: &HashMap<String, usize>,
	u_global: &DVector<f64>,
	distributed_loads: &[DistributedLoad],
	point_loads_on_members: &[PointLoadOnMember],
	temperature_loads: &[TemperatureLoad],
) -> Result<HashMap<String, MemberForces>, String> {
	let mut forces = HashMap::new();

	let mut member_count: HashMap<String, usize> = HashMap::new();
	for elem in elements {
		if let ElementType::Plate = elem.element_type {
			continue;
		}
		*member_count.entry(elem.node_i.clone()).or_insert(0) += 1;
		*member_count.entry(elem.node_j.clone()).or_insert(0) += 1;
	}
	let is_pin_support = |node_id: &str| -> bool {
		if let Some(&idx) = node_map.get(node_id) {
			let nd = &nodes[idx];
			let has_translation = nd.restraints[0] || nd.restraints[1] || nd.restraints[2];
			let has_moment_z = nd.restraints[5];
			let single_member = *member_count.get(node_id).unwrap_or(&0) <= 1;
			has_translation && !has_moment_z && single_member
		} else {
			false
		}
	};

	for elem in elements {
		if let ElementType::Plate = elem.element_type {
			continue;
		}

		let i_idx = match node_map.get(&elem.node_i) { Some(&idx) => idx, None => continue };
		let j_idx = match node_map.get(&elem.node_j) { Some(&idx) => idx, None => continue };

		let node_i = &nodes[i_idx];
		let node_j = &nodes[j_idx];
		let dx = node_j.x - node_i.x;
		let dy = node_j.y - node_i.y;
		let dz = node_j.z - node_i.z;
		let length = (dx * dx + dy * dy + dz * dz).sqrt();

		if length < 1e-10 {
			forces.insert(elem.id.clone(), MemberForces {
				forces_i: vec![0.0; 6],
				forces_j: vec![0.0; 6],
				max_shear_y: 0.0,
				max_shear_z: 0.0,
				max_moment_y: 0.0,
				max_moment_z: 0.0,
				max_axial: 0.0,
				max_torsion: 0.0,
			});
			continue;
		}

		let dof_i = i_idx * 6;
		let dof_j = j_idx * 6;
		let mut u_elem = DVector::zeros(12);
		for k in 0..6 {
			u_elem[k] = u_global[dof_i + k];
			u_elem[6 + k] = u_global[dof_j + k];
		}

		let t_matrix = transformation_matrix_3d(dx, dy, dz, length, elem.beta);
		let u_local = &t_matrix * &u_elem;
		let k_local = frame_element_stiffness(elem, length);
		let f_local = &k_local * &u_local;

		let mut fef_local = DVector::zeros(12);

		for dl in distributed_loads {
			if dl.element_id != elem.id {
				continue;
			}
			let w1 = dl.w_start;
			let w2 = dl.w_end;
			if w1.abs() < 1e-12 && w2.abs() < 1e-12 {
				continue;
			}

			let sp = dl.start_pos.max(0.0).min(1.0);
			let ep = dl.end_pos.max(0.0).min(1.0);
			let (lx, ly, lz) = decompose_load_direction(&dl.direction, &t_matrix);

			let (rx1, rx2, _mx1, _mx2) = crate::solver_3d::loads::compute_fef_1d(lx * w1, lx * w2, length, sp, ep);
			let (ry1, ry2, mz1, mz2) = crate::solver_3d::loads::compute_fef_1d(ly * w1, ly * w2, length, sp, ep);
			let (rz1, rz2, my1, my2) = crate::solver_3d::loads::compute_fef_1d(lz * w1, lz * w2, length, sp, ep);

			fef_local[0] += rx1;
			fef_local[6] += rx2;
			fef_local[1] += ry1;
			fef_local[5] += mz1;
			fef_local[7] += ry2;
			fef_local[11] += mz2;
			fef_local[2] += rz1;
			fef_local[4] += -my1;
			fef_local[8] += rz2;
			fef_local[10] += -my2;
		}

		for pl in point_loads_on_members {
			if pl.element_id != elem.id {
				continue;
			}
			let (lx, ly, lz) = decompose_load_direction(&pl.direction, &t_matrix);
			let p = pl.magnitude;
			let pos = pl.position.max(0.0).min(1.0);

			if (lx * p).abs() > 1e-12 {
				if pl.is_moment {
					let (v1, v2, _m1, _m2) = compute_point_load_fef(lx * p, pos, length, true);
					fef_local[0] += v1;
					fef_local[6] += v2;
				} else {
					let a = pos * length;
					fef_local[0] += lx * p * (1.0 - a / length);
					fef_local[6] += lx * p * (a / length);
				}
			}
			if (ly * p).abs() > 1e-12 {
				let (v1, v2, m1, m2) = compute_point_load_fef(ly * p, pos, length, pl.is_moment);
				fef_local[1] += v1;
				fef_local[5] += m1;
				fef_local[7] += v2;
				fef_local[11] += m2;
			}
			if (lz * p).abs() > 1e-12 {
				let (v1, v2, m1, m2) = compute_point_load_fef(lz * p, pos, length, pl.is_moment);
				fef_local[2] += v1;
				fef_local[4] += -m1;
				fef_local[8] += v2;
				fef_local[10] += -m2;
			}
		}

		for tl in temperature_loads {
			if tl.element_id != elem.id {
				continue;
			}
			let f_axial = elem.E * elem.A * tl.alpha * tl.delta_t;
			fef_local[0] += -f_axial;
			fef_local[6] += f_axial;
			let iz_val = if elem.Iz > 0.0 { elem.Iz } else { elem.Iy };
			if tl.gradient_y.abs() > 1e-15 {
				let m_bend_z = elem.E * iz_val * tl.alpha * tl.gradient_y;
				fef_local[5] += m_bend_z;
				fef_local[11] += -m_bend_z;
			}
			if tl.gradient_z.abs() > 1e-15 {
				let m_bend_y = elem.E * elem.Iy * tl.alpha * tl.gradient_z;
				fef_local[4] += -m_bend_y;
				fef_local[10] += m_bend_y;
			}
		}

		let f_total = &f_local - &fef_local;
		let mut forces_i: Vec<f64> = (0..6).map(|k| f_total[k]).collect();
		let mut forces_j: Vec<f64> = (6..12).map(|k| f_total[k]).collect();

		for k in 0..6 {
			if elem.releases_i[k] {
				forces_i[k] = 0.0;
			}
			if elem.releases_j[k] {
				forces_j[k] = 0.0;
			}
		}

		if is_pin_support(&elem.node_i) {
			forces_i[4] = 0.0;
			forces_i[5] = 0.0;
		}
		if is_pin_support(&elem.node_j) {
			forces_j[4] = 0.0;
			forces_j[5] = 0.0;
		}

		let peak_force = forces_i
			.iter()
			.chain(forces_j.iter())
			.map(|v| v.abs())
			.fold(0.0f64, f64::max);
		if peak_force > 1e-15 {
			let tol = peak_force * 1e-6;
			for v in forces_i.iter_mut().chain(forces_j.iter_mut()) {
				if v.abs() < tol {
					*v = 0.0;
				}
			}
		}

		let max_shear_y = forces_i[1].abs().max(forces_j[1].abs());
		let max_shear_z = forces_i[2].abs().max(forces_j[2].abs());
		let max_moment_y = forces_i[4].abs().max(forces_j[4].abs());
		let max_moment_z = forces_i[5].abs().max(forces_j[5].abs());
		let max_axial = forces_i[0].abs().max(forces_j[0].abs());
		let max_torsion = forces_i[3].abs().max(forces_j[3].abs());

		forces.insert(elem.id.clone(), MemberForces {
			forces_i,
			forces_j,
			max_shear_y,
			max_shear_z,
			max_moment_y,
			max_moment_z,
			max_axial,
			max_torsion,
		});
	}

	Ok(forces)
}

/// Legacy wrapper for API compatibility.
pub fn compute_member_forces(
	elements: &[Element3D],
	nodes: &[Node3D],
	node_map: &HashMap<String, usize>,
	u_global: &DVector<f64>,
	distributed_loads: &[DistributedLoad],
	point_loads_on_members: &[PointLoadOnMember],
	temperature_loads: &[TemperatureLoad],
) -> Result<HashMap<String, MemberForces>, String> {
	calculate_member_forces(
		elements,
		nodes,
		node_map,
		u_global,
		distributed_loads,
		point_loads_on_members,
		temperature_loads,
	)
}

/// Compute plate/slab stress results from nodal displacements.
/// Evaluates membrane stresses, bending moments, and von Mises at element center.
pub fn compute_plate_results(
	elements: &[Element3D],
	nodes: &[Node3D],
	node_map: &HashMap<String, usize>,
	u_global: &DVector<f64>,
) -> HashMap<String, PlateStressResult> {
	let mut results = HashMap::new();

	for elem in elements {
		if let ElementType::Plate = elem.element_type {
			let ids = [
				&elem.node_i,
					&elem.node_j,
				match elem.node_k.as_ref() {
					Some(s) => s,
					None => continue,
				},
				match elem.node_l.as_ref() {
					Some(s) => s,
					None => continue,
				},
			];

			let mut indices = [0usize; 4];
			let mut coords_3d = [(0.0f64, 0.0f64, 0.0f64); 4];
			let mut ok = true;
			for (i, id) in ids.iter().enumerate() {
				match node_map.get(*id) {
					Some(&idx) => {
						indices[i] = idx;
						let n = &nodes[idx];
						coords_3d[i] = (n.x, n.y, n.z);
					}
					None => {
						ok = false;
						break;
					}
				}
			}
			if !ok {
				continue;
			}

			let thickness = match elem.thickness {
				Some(t) => t,
				None => continue,
			};
			let e_mod = elem.E;
			let nu = elem.nu.unwrap_or(0.3);

			let plate = PlateElement::new(
				[ids[0].to_string(), ids[1].to_string(), ids[2].to_string(), ids[3].to_string()],
				thickness,
				e_mod,
				nu,
				coords_3d,
			);

			let mut u_elem_global = DVector::zeros(24);
			for i in 0..4 {
				let base_g = indices[i] * 6;
				for d in 0..6 {
					u_elem_global[i * 6 + d] = u_global[base_g + d];
				}
			}

			let t_matrix = plate.transformation_matrix();
			let u_local = &t_matrix * &u_elem_global;
			let local_coords = plate.get_local_coords_2d();

			let (_det_mem, b_mem) = plate.shape_func_derivs_membrane(0.0, 0.0, &local_coords);
			let mut u_mem = DVector::zeros(8);
			for i in 0..4 {
				u_mem[i * 2] = u_local[i * 6];
				u_mem[i * 2 + 1] = u_local[i * 6 + 1];
			}
			let c_factor = e_mod / (1.0 - nu * nu);
			let strain_mem = &b_mem * &u_mem;
			let stress_xx = c_factor * (strain_mem[0] + nu * strain_mem[1]);
			let stress_yy = c_factor * (nu * strain_mem[0] + strain_mem[1]);
			let stress_xy = c_factor * (1.0 - nu) / 2.0 * strain_mem[2];

			let (_det_bend, b_b, _b_s) = plate.shape_func_mindlin(0.0, 0.0, &local_coords);
			let mut u_bend = DVector::zeros(12);
			for i in 0..4 {
				u_bend[i * 3] = u_local[i * 6 + 2];
				u_bend[i * 3 + 1] = u_local[i * 6 + 3];
				u_bend[i * 3 + 2] = u_local[i * 6 + 4];
			}
			let d_factor = e_mod * thickness.powi(3) / (12.0 * (1.0 - nu * nu));
			let kappa = &b_b * &u_bend;
			let moment_xx = d_factor * (kappa[0] + nu * kappa[1]);
			let moment_yy = d_factor * (nu * kappa[0] + kappa[1]);
			let moment_xy = d_factor * (1.0 - nu) / 2.0 * kappa[2];

			let n_center = [0.25f64; 4];
			let displacement = n_center
				.iter()
				.enumerate()
				.map(|(i, &n)| n * u_local[i * 6 + 2])
				.sum::<f64>();

			let sig_bx = stress_xx + 6.0 * moment_xx / (thickness * thickness);
			let sig_by = stress_yy + 6.0 * moment_yy / (thickness * thickness);
			let sig_bxy = stress_xy + 6.0 * moment_xy / (thickness * thickness);
			let von_mises = (sig_bx * sig_bx + sig_by * sig_by - sig_bx * sig_by + 3.0 * sig_bxy * sig_bxy).sqrt();

			results.insert(elem.id.clone(), PlateStressResult {
				stress_xx,
				stress_yy,
				stress_xy,
				moment_xx,
				moment_yy,
				moment_xy,
				displacement,
				von_mises,
			});
		}
	}

	results
}

/// Legacy wrapper to align with analysis_core expectations.
pub fn compute_reactions(
	nodes: &[Node3D],
	u_global: &DVector<f64>,
	k_global: &nalgebra::DMatrix<f64>,
	f_global: &DVector<f64>,
) -> HashMap<String, Vec<f64>> {
	let (_disp, reactions) = compute_nodal_response(nodes, &HashMap::new(), u_global, f_global, k_global);
	reactions
}

/// Legacy wrapper to extract displacements only.
pub fn compute_nodal_displacements(
	nodes: &[Node3D],
	u_global: &DVector<f64>,
) -> HashMap<String, Vec<f64>> {
	let mut disp = HashMap::new();
	for (i, node) in nodes.iter().enumerate() {
		let base = i * 6;
		disp.insert(
			node.id.clone(),
			vec![
				u_global[base],
				u_global[base + 1],
				u_global[base + 2],
				u_global[base + 3],
				u_global[base + 4],
				u_global[base + 5],
			],
		);
	}
	disp
}
