use std::collections::HashMap;

use nalgebra::DVector;

use super::element::BaseElement;
use super::element::transformation_matrix_3d;
use super::types::{DistributedLoad, Element3D, LoadDirection, Node3D, NodalLoad, PointLoadOnMember, TemperatureLoad};

/// Shared FEF computation for a single direction.
pub fn compute_fef_1d(wa: f64, wb: f64, length: f64, sp: f64, ep: f64) -> (f64, f64, f64, f64) {
	if wa.abs() < 1e-12 && wb.abs() < 1e-12 {
		return (0.0, 0.0, 0.0, 0.0);
	}

	let is_partial = sp > 1e-10 || ep < 1.0 - 1e-10;
	if is_partial {
		let a = sp * length;
		let b = ep * length;
		let l = length;

		let gauss_pts: [(f64, f64); 5] = [
			(-0.906179845938664, 0.236926885056189),
			(-0.538469310105683, 0.478628670499366),
			(0.0, 0.568888888888889),
			(0.538469310105683, 0.478628670499366),
			(0.906179845938664, 0.236926885056189),
		];

		let half_span = (b - a) / 2.0;
		let mid = (a + b) / 2.0;

		let mut f_v1 = 0.0;
		let mut f_t1 = 0.0;
		let mut f_v2 = 0.0;
		let mut f_t2 = 0.0;

		for &(xi, wi) in &gauss_pts {
			let x = half_span * xi + mid;
			let xr = x / l;

			let n1 = 1.0 - 3.0 * xr * xr + 2.0 * xr * xr * xr;
			let n2 = x * (1.0 - xr) * (1.0 - xr);
			let n3 = 3.0 * xr * xr - 2.0 * xr * xr * xr;
			let n4 = x * xr * (xr - 1.0);

			let t_param = if (b - a).abs() > 1e-12 { (x - a) / (b - a) } else { 0.5 };
			let w = wa + (wb - wa) * t_param;

			let jac = half_span;
			f_v1 += wi * w * n1 * jac;
			f_t1 += wi * w * n2 * jac;
			f_v2 += wi * w * n3 * jac;
			f_t2 += wi * w * n4 * jac;
		}

		return (f_v1, f_v2, f_t1, f_t2);
	}

	if (wa - wb).abs() < 1e-12 {
		let r = wa * length / 2.0;
		let m = wa * length * length / 12.0;
		(r, r, m, -m)
	} else if wa.abs() < 1e-12 {
		(
			3.0 * wb * length / 20.0,
			7.0 * wb * length / 20.0,
			wb * length * length / 30.0,
			-wb * length * length / 20.0,
		)
	} else if wb.abs() < 1e-12 {
		(
			7.0 * wa * length / 20.0,
			3.0 * wa * length / 20.0,
			wa * length * length / 20.0,
			-wa * length * length / 30.0,
		)
	} else {
		let w_uniform = wa.min(wb);
		let w_triangular = (wa - wb).abs();
		let ascending = wb > wa;
		let r_u = w_uniform * length / 2.0;
		let m_u = w_uniform * length * length / 12.0;
		let (r1_t, r2_t, m1_t, m2_t) = if ascending {
			(
				3.0 * w_triangular * length / 20.0,
				7.0 * w_triangular * length / 20.0,
				w_triangular * length * length / 30.0,
				-w_triangular * length * length / 20.0,
			)
		} else {
			(
				7.0 * w_triangular * length / 20.0,
				3.0 * w_triangular * length / 20.0,
				w_triangular * length * length / 20.0,
				-w_triangular * length * length / 30.0,
			)
		};
		(r_u + r1_t, r_u + r2_t, m_u + m1_t, -m_u + m2_t)
	}
}

pub fn compute_point_load_fef(p: f64, position_ratio: f64, length: f64, is_moment: bool) -> (f64, f64, f64, f64) {
	let a = position_ratio * length;
	let b = length - a;
	let l = length;

	if is_moment {
		let v1 = 6.0 * p * a * b / (l * l * l);
		let v2 = -v1;
		let m1 = p * b * (2.0 * a - b) / (l * l);
		let m2 = p * a * (2.0 * b - a) / (l * l);
		(v1, v2, m1, m2)
	} else {
		let v1 = p * b * b * (3.0 * a + b) / (l * l * l);
		let v2 = p * a * a * (a + 3.0 * b) / (l * l * l);
		let m1 = p * a * b * b / (l * l);
		let m2 = -p * a * a * b / (l * l);
		(v1, v2, m1, m2)
	}
}

pub fn decompose_load_direction(direction: &LoadDirection, t_matrix: &nalgebra::DMatrix<f64>) -> (f64, f64, f64) {
	match direction {
		LoadDirection::LocalX => (1.0, 0.0, 0.0),
		LoadDirection::LocalY => (0.0, 1.0, 0.0),
		LoadDirection::LocalZ => (0.0, 0.0, 1.0),
		LoadDirection::GlobalX => (t_matrix[(0, 0)], t_matrix[(1, 0)], t_matrix[(2, 0)]),
		LoadDirection::GlobalY => (t_matrix[(0, 1)], t_matrix[(1, 1)], t_matrix[(2, 1)]),
		LoadDirection::GlobalZ => (t_matrix[(0, 2)], t_matrix[(1, 2)], t_matrix[(2, 2)]),
	}
}

pub fn compute_fixed_end_forces(
	elements: &[Element3D],
	nodes: &[Node3D],
	node_map: &HashMap<String, usize>,
	dl: &DistributedLoad,
) -> Result<DVector<f64>, String> {
	let num_dof = nodes.len() * 6;
	let mut fef_global = DVector::zeros(num_dof);

	let element = elements
		.iter()
		.find(|e| e.id == dl.element_id)
		.ok_or(format!("Element {} not found for distributed load", dl.element_id))?;

	let i_idx = *node_map
		.get(&element.node_i)
		.ok_or(format!("Node {} not found", element.node_i))?;
	let j_idx = *node_map
		.get(&element.node_j)
		.ok_or(format!("Node {} not found", element.node_j))?;

	let node_i = &nodes[i_idx];
	let node_j = &nodes[j_idx];

	let dx = node_j.x - node_i.x;
	let dy = node_j.y - node_i.y;
	let dz = node_j.z - node_i.z;
	let length = (dx * dx + dy * dy + dz * dz).sqrt();
	if length < 1e-10 {
		return Ok(fef_global);
	}

	let w1 = dl.w_start;
	let w2 = dl.w_end;
	if w1.abs() < 1e-12 && w2.abs() < 1e-12 {
		return Ok(fef_global);
	}

	let sp = dl.start_pos.max(0.0).min(1.0);
	let ep = dl.end_pos.max(0.0).min(1.0);

	let t_matrix = transformation_matrix_3d(dx, dy, dz, length, element.beta);

	let (lx, ly, lz) = decompose_load_direction(&dl.direction, &t_matrix);
	let (w_local_x1, w_local_y1, w_local_z1) = (lx * w1, ly * w1, lz * w1);
	let (w_local_x2, w_local_y2, w_local_z2) = (lx * w2, ly * w2, lz * w2);

	let (rx1, rx2, _mx1, _mx2) = compute_fef_1d(w_local_x1, w_local_x2, length, sp, ep);
	let (ry1, ry2, mz1, mz2) = compute_fef_1d(w_local_y1, w_local_y2, length, sp, ep);
	let (rz1, rz2, my1, my2) = compute_fef_1d(w_local_z1, w_local_z2, length, sp, ep);

	let mut fef_local: DVector<f64> = DVector::zeros(12);
	fef_local[0] = rx1;
	fef_local[6] = rx2;
	fef_local[1] = ry1;
	fef_local[5] = mz1;
	fef_local[7] = ry2;
	fef_local[11] = mz2;
	fef_local[2] = rz1;
	fef_local[4] = -my1;
	fef_local[8] = rz2;
	fef_local[10] = -my2;

	let fef_transformed = t_matrix.transpose() * fef_local;

	let dof_i = i_idx * 6;
	let dof_j = j_idx * 6;
	for k in 0..6 {
		fef_global[dof_i + k] += fef_transformed[k];
		fef_global[dof_j + k] += fef_transformed[6 + k];
	}

	Ok(fef_global)
}

pub fn assemble_global_load_vector(
	nodes: &[Node3D],
	elements: &[Element3D],
	node_map: &HashMap<String, usize>,
	nodal_loads: &[NodalLoad],
	distributed_loads: &[DistributedLoad],
	temperature_loads: &[TemperatureLoad],
	point_loads_on_members: &[PointLoadOnMember],
) -> DVector<f64> {
	let num_dof = nodes.len() * 6;
	let mut f_global = DVector::zeros(num_dof);
	let mut fef_global = DVector::zeros(num_dof);

	for load in nodal_loads {
		if let Some(&idx) = node_map.get(&load.node_id) {
			let dof = idx * 6;
			f_global[dof] += load.fx;
			f_global[dof + 1] += load.fy;
			f_global[dof + 2] += load.fz;
			f_global[dof + 3] += load.mx;
			f_global[dof + 4] += load.my;
			f_global[dof + 5] += load.mz;
		}
	}

	for element in elements {
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

		let t_matrix = element.transformation_matrix(dx, dy, dz, length);
		let mut fef_local: DVector<f64> = DVector::zeros(12);

		for dl in distributed_loads.iter().filter(|dl| dl.element_id == element.id) {
			let w1 = dl.w_start;
			let w2 = dl.w_end;
			if w1.abs() < 1e-12 && w2.abs() < 1e-12 {
				continue;
			}
			let sp = dl.start_pos.max(0.0).min(1.0);
			let ep = dl.end_pos.max(0.0).min(1.0);
			let (lx, ly, lz) = decompose_load_direction(&dl.direction, &t_matrix);
			let (rx1, rx2, _mx1, _mx2) = compute_fef_1d(lx * w1, lx * w2, length, sp, ep);
			let (ry1, ry2, mz1, mz2) = compute_fef_1d(ly * w1, ly * w2, length, sp, ep);
			let (rz1, rz2, my1, my2) = compute_fef_1d(lz * w1, lz * w2, length, sp, ep);

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

		for pl in point_loads_on_members.iter().filter(|pl| pl.element_id == element.id) {
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

		for tl in temperature_loads.iter().filter(|tl| tl.element_id == element.id) {
			let f_axial = element.E * element.A * tl.alpha * tl.delta_t;
			fef_local[0] += -f_axial;
			fef_local[6] += f_axial;
			let iz_val = if element.Iz > 0.0 { element.Iz } else { element.Iy };
			if tl.gradient_y.abs() > 1e-15 {
				let m_bend_z = element.E * iz_val * tl.alpha * tl.gradient_y;
				fef_local[5] += m_bend_z;
				fef_local[11] += -m_bend_z;
			}
			if tl.gradient_z.abs() > 1e-15 {
				let m_bend_y = element.E * element.Iy * tl.alpha * tl.gradient_z;
				fef_local[4] += -m_bend_y;
				fef_local[10] += m_bend_y;
			}
		}

		let dof_i = i_idx * 6;
		let dof_j = j_idx * 6;
		for k in 0..6 {
			fef_global[dof_i + k] += fef_local[k];
			fef_global[dof_j + k] += fef_local[6 + k];
		}
	}

	f_global + fef_global
}

