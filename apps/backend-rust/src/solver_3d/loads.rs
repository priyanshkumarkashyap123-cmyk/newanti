use std::collections::HashMap;

use nalgebra::DVector;

use super::element::BaseElement;
use super::types::{DistributedLoad, Element3D, LoadDirection, Node3D, NodalLoad, PointLoadOnMember, TemperatureLoad};

fn decompose_load_direction(direction: &LoadDirection, t_matrix: &nalgebra::DMatrix<f64>) -> (f64, f64, f64) {
	let mut dir = match direction {
		LoadDirection::GlobalX => (1.0, 0.0, 0.0),
		LoadDirection::GlobalY => (0.0, 1.0, 0.0),
		LoadDirection::GlobalZ => (0.0, 0.0, 1.0),
		LoadDirection::LocalX => (1.0, 0.0, 0.0),
		LoadDirection::LocalY => (0.0, 1.0, 0.0),
		LoadDirection::LocalZ => (0.0, 0.0, 1.0),
	};

	let _ = t_matrix;
	if matches!(direction, LoadDirection::LocalX | LoadDirection::LocalY | LoadDirection::LocalZ) {
		dir = match direction {
			LoadDirection::LocalX => (1.0, 0.0, 0.0),
			LoadDirection::LocalY => (0.0, 1.0, 0.0),
			LoadDirection::LocalZ => (0.0, 0.0, 1.0),
			_ => dir,
		};
	}
	dir
}

fn compute_fef_1d(_w1: f64, _w2: f64, _length: f64, _sp: f64, _ep: f64) -> (f64, f64, f64, f64) {
	(0.0, 0.0, 0.0, 0.0)
}

fn compute_point_load_fef(_p: f64, _pos: f64, _length: f64, _is_moment: bool) -> (f64, f64, f64, f64) {
	(0.0, 0.0, 0.0, 0.0)
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
		let mut fef_local = DVector::zeros(12);

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

