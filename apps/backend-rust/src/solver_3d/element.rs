use nalgebra::DMatrix;

use super::types::{Element3D, ElementType};

pub trait BaseElement {
	fn element_type(&self) -> ElementType;
	fn stiffness_matrix(&self, length: f64) -> DMatrix<f64>;
	fn transformation_matrix(&self, dx: f64, dy: f64, dz: f64, length: f64) -> DMatrix<f64>;
}

impl BaseElement for Element3D {
	fn element_type(&self) -> ElementType {
		self.element_type.clone()
	}

	fn stiffness_matrix(&self, length: f64) -> DMatrix<f64> {
		match self.element_type {
			ElementType::Frame => frame_element_stiffness(self, length),
			ElementType::Truss => truss_element_stiffness(self, length),
			ElementType::Cable => cable_element_stiffness(self, length),
			ElementType::Plate => DMatrix::zeros(12, 12),
		}
	}

	fn transformation_matrix(&self, dx: f64, dy: f64, dz: f64, length: f64) -> DMatrix<f64> {
		transformation_matrix_3d(dx, dy, dz, length, self.beta)
	}
}

#[allow(non_snake_case)]
pub fn frame_element_stiffness(elem: &Element3D, L: f64) -> DMatrix<f64> {
	let E = elem.E;
	let G = elem.G;
	let A = elem.A;
	let Iy = elem.Iy;
	let Iz = if elem.Iz > 0.0 { elem.Iz } else { elem.Iy };
	let J = elem.J;

	let mut k = DMatrix::zeros(12, 12);

	let k_axial = E * A / L;
	let k_torsion = G * J / L;

	let phi_y = if elem.Asy > 0.0 { 12.0 * E * Iz / (G * elem.Asy * L * L) } else { 0.0 };
	let phi_z = if elem.Asz > 0.0 { 12.0 * E * Iy / (G * elem.Asz * L * L) } else { 0.0 };

	let denom_y = 1.0 + phi_z;
	let k2y = 12.0 * E * Iy / (L * L * L * denom_y);
	let k3y = 6.0 * E * Iy / (L * L * denom_y);
	let k4y = (4.0 + phi_z) * E * Iy / (L * denom_y);
	let k5y = (2.0 - phi_z) * E * Iy / (L * denom_y);

	let denom_z = 1.0 + phi_y;
	let k2z = 12.0 * E * Iz / (L * L * L * denom_z);
	let k3z = 6.0 * E * Iz / (L * L * denom_z);
	let k4z = (4.0 + phi_y) * E * Iz / (L * denom_z);
	let k5z = (2.0 - phi_y) * E * Iz / (L * denom_z);

	k[(0, 0)] = k_axial;
	k[(0, 6)] = -k_axial;
	k[(6, 0)] = -k_axial;
	k[(6, 6)] = k_axial;

	k[(3, 3)] = k_torsion;
	k[(3, 9)] = -k_torsion;
	k[(9, 3)] = -k_torsion;
	k[(9, 9)] = k_torsion;

	k[(1, 1)] = k2z;
	k[(1, 5)] = k3z;
	k[(1, 7)] = -k2z;
	k[(1, 11)] = k3z;
	k[(5, 1)] = k3z;
	k[(5, 5)] = k4z;
	k[(5, 7)] = -k3z;
	k[(5, 11)] = k5z;
	k[(7, 1)] = -k2z;
	k[(7, 5)] = -k3z;
	k[(7, 7)] = k2z;
	k[(7, 11)] = -k3z;
	k[(11, 1)] = k3z;
	k[(11, 5)] = k5z;
	k[(11, 7)] = -k3z;
	k[(11, 11)] = k4z;

	k[(2, 2)] = k2y;
	k[(2, 4)] = -k3y;
	k[(2, 8)] = -k2y;
	k[(2, 10)] = -k3y;
	k[(4, 2)] = -k3y;
	k[(4, 4)] = k4y;
	k[(4, 8)] = k3y;
	k[(4, 10)] = k5y;
	k[(8, 2)] = -k2y;
	k[(8, 4)] = k3y;
	k[(8, 8)] = k2y;
	k[(8, 10)] = k3y;
	k[(10, 2)] = -k3y;
	k[(10, 4)] = k5y;
	k[(10, 8)] = k3y;
	k[(10, 10)] = k4y;

	k
}

#[allow(non_snake_case)]
pub fn truss_element_stiffness(elem: &Element3D, L: f64) -> DMatrix<f64> {
	let mut k = DMatrix::zeros(12, 12);
	let k_axial = elem.E * elem.A / L;

	k[(0, 0)] = k_axial;
	k[(0, 6)] = -k_axial;
	k[(6, 0)] = -k_axial;
	k[(6, 6)] = k_axial;

	k
}

#[allow(non_snake_case)]
pub fn cable_element_stiffness(elem: &Element3D, L: f64) -> DMatrix<f64> {
	let mut k = DMatrix::zeros(12, 12);
	let k_axial = elem.E * elem.A / L;

	k[(0, 0)] = k_axial;
	k[(0, 6)] = -k_axial;
	k[(6, 0)] = -k_axial;
	k[(6, 6)] = k_axial;

	k
}

#[allow(non_snake_case)]
pub fn transformation_matrix_3d(dx: f64, dy: f64, dz: f64, L: f64, beta: f64) -> DMatrix<f64> {
	let cx = dx / L;
	let cy = dy / L;
	let cz = dz / L;
	let cxz = (cx * cx + cz * cz).sqrt();

	let rotation = if (1.0 - cy.abs()) < 1e-10 || cxz < 1e-10 {
		let sign = if cy > 0.0 { 1.0 } else { -1.0 };
		DMatrix::from_row_slice(3, 3, &[
			0.0, sign, 0.0,
			-sign * beta.cos(), 0.0, beta.sin(),
			sign * beta.sin(), 0.0, beta.cos(),
		])
	} else {
		DMatrix::from_row_slice(3, 3, &[
			cx, cy, cz,
			(-cx * cy * beta.cos() - cz * beta.sin()) / cxz,
			cxz * beta.cos(),
			(-cy * cz * beta.cos() + cx * beta.sin()) / cxz,
			(cx * cy * beta.sin() - cz * beta.cos()) / cxz,
			-cxz * beta.sin(),
			(cy * cz * beta.sin() + cx * beta.cos()) / cxz,
		])
	};

	let mut t = DMatrix::zeros(12, 12);
	for i in 0..3 {
		for j in 0..3 {
			t[(i, j)] = rotation[(i, j)];
			t[(3 + i, 3 + j)] = rotation[(i, j)];
			t[(6 + i, 6 + j)] = rotation[(i, j)];
			t[(9 + i, 9 + j)] = rotation[(i, j)];
		}
	}
	t
}
