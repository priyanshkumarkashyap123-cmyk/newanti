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
		let e = self.E;
		let g = self.G;
		let a = self.A;
		let iy = self.Iy;
		let iz = if self.Iz > 0.0 { self.Iz } else { self.Iy };
		let j = self.J;

		let mut k = DMatrix::zeros(12, 12);
		let k_axial = e * a / length;
		let k_torsion = g * j / length;
		let phi_y = if self.Asy > 0.0 { 12.0 * e * iz / (g * self.Asy * length * length) } else { 0.0 };
		let phi_z = if self.Asz > 0.0 { 12.0 * e * iy / (g * self.Asz * length * length) } else { 0.0 };

		let denom_y = 1.0 + phi_z;
		let k2y = 12.0 * e * iy / (length * length * length * denom_y);
		let k3y = 6.0 * e * iy / (length * length * denom_y);
		let k4y = (4.0 + phi_z) * e * iy / (length * denom_y);
		let k5y = (2.0 - phi_z) * e * iy / (length * denom_y);

		let denom_z = 1.0 + phi_y;
		let k2z = 12.0 * e * iz / (length * length * length * denom_z);
		let k3z = 6.0 * e * iz / (length * length * denom_z);
		let k4z = (4.0 + phi_y) * e * iz / (length * denom_z);
		let k5z = (2.0 - phi_y) * e * iz / (length * denom_z);

		k[(0, 0)] = k_axial;   k[(0, 6)] = -k_axial;
		k[(6, 0)] = -k_axial;   k[(6, 6)] = k_axial;

		k[(3, 3)] = k_torsion;  k[(3, 9)] = -k_torsion;
		k[(9, 3)] = -k_torsion; k[(9, 9)] = k_torsion;

		k[(1, 1)] = k2z;   k[(1, 5)] = k3z;   k[(1, 7)] = -k2z;  k[(1, 11)] = k3z;
		k[(5, 1)] = k3z;   k[(5, 5)] = k4z;   k[(5, 7)] = -k3z;  k[(5, 11)] = k5z;
		k[(7, 1)] = -k2z;  k[(7, 5)] = -k3z;  k[(7, 7)] = k2z;   k[(7, 11)] = -k3z;
		k[(11, 1)] = k3z;  k[(11, 5)] = k5z;  k[(11, 7)] = -k3z; k[(11, 11)] = k4z;

		k[(2, 2)] = k2y;   k[(2, 4)] = -k3y;  k[(2, 8)] = -k2y;  k[(2, 10)] = -k3y;
		k[(4, 2)] = -k3y;  k[(4, 4)] = k4y;   k[(4, 8)] = k3y;   k[(4, 10)] = k5y;
		k[(8, 2)] = -k2y;  k[(8, 4)] = k3y;   k[(8, 8)] = k2y;   k[(8, 10)] = k3y;
		k[(10, 2)] = -k3y; k[(10, 4)] = k5y;  k[(10, 8)] = k3y;  k[(10, 10)] = k4y;

		k
	}

	fn transformation_matrix(&self, dx: f64, dy: f64, dz: f64, length: f64) -> DMatrix<f64> {
		let cx = dx / length;
		let cy = dy / length;
		let cz = dz / length;
		let beta = self.beta;
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
}
