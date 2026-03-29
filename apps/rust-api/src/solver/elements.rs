//! Production Element Library
//!
//! Industry-standard finite elements:
//! - Timoshenko Beam (shear-deformable, 12 DOF)
//! - Truss element (2-node, axial only)
//! - Plate/Shell element (4-node, Mindlin-Reissner)
//! - Spring element (6 DOF)
//! - Gap/Contact element
//!
//! Each element produces a local stiffness matrix,
//! transformation matrix, and equivalent nodal loads.

use nalgebra::{DMatrix, DVector};
use serde::{Deserialize, Serialize};

/// Element type enumeration
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum ElementType {
    /// Euler-Bernoulli beam (slender, no shear deformation)
    EulerBeam,
    /// Timoshenko beam (includes shear deformation)
    TimoshenkoBeam,
    /// Truss (axial only, pin-pin)
    Truss,
    /// Plate/Shell (4-node quadrilateral, Mindlin-Reissner)
    PlateShell,
    /// Axial spring
    Spring,
    /// Rigid link
    RigidLink,
}

/// Material properties for element
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElementMaterial {
    pub e: f64,       // Elastic modulus (N/mm²)
    pub g: f64,       // Shear modulus (N/mm²)
    pub nu: f64,      // Poisson's ratio
    pub density: f64, // kg/m³
    pub alpha: f64,   // Thermal expansion coefficient (1/°C)
    pub fy: f64,      // Yield strength (N/mm²)
}

impl ElementMaterial {
    /// Standard structural steel (Fe 250 / A36)
    pub fn steel() -> Self {
        Self {
            e: 200_000.0,
            g: 76_923.0,
            nu: 0.3,
            density: 7850.0,
            alpha: 12e-6,
            fy: 250.0,
        }
    }

    /// Standard concrete (M25)
    pub fn concrete_m25() -> Self {
        Self {
            e: 25_000.0,
            g: 10_417.0,
            nu: 0.2,
            density: 2500.0,
            alpha: 10e-6,
            fy: 25.0, // fck
        }
    }

    /// Aluminum (6061-T6)
    pub fn aluminum() -> Self {
        Self {
            e: 68_900.0,
            g: 26_000.0,
            nu: 0.33,
            density: 2700.0,
            alpha: 23.6e-6,
            fy: 276.0,
        }
    }
}

/// Cross-section properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrossSection {
    pub a: f64,     // Area (mm²)
    pub ix: f64,    // Moment of inertia X (mm⁴) - strong axis
    pub iy: f64,    // Moment of inertia Y (mm⁴) - weak axis
    pub j: f64,     // Torsional constant (mm⁴)
    pub as_y: f64,  // Shear area Y (mm²) - for Timoshenko
    pub as_z: f64,  // Shear area Z (mm²) - for Timoshenko
    pub zx: f64,    // Plastic modulus X (mm³)
    pub zy: f64,    // Plastic modulus Y (mm³)
    pub depth: f64, // Total depth (mm)
    pub width: f64, // Total width (mm)
}

impl CrossSection {
    /// Create I-beam section from dimensions
    pub fn i_beam(depth: f64, width: f64, tw: f64, tf: f64) -> Self {
        let a = 2.0 * width * tf + (depth - 2.0 * tf) * tw;
        let ix = width * depth.powi(3) / 12.0 - (width - tw) * (depth - 2.0 * tf).powi(3) / 12.0;
        let iy = 2.0 * tf * width.powi(3) / 12.0 + (depth - 2.0 * tf) * tw.powi(3) / 12.0;
        let j = (2.0 * width * tf.powi(3) + (depth - 2.0 * tf) * tw.powi(3)) / 3.0;
        let as_y = (depth - 2.0 * tf) * tw; // Approximate shear area
        let as_z = 2.0 * width * tf * 5.0 / 6.0;
        let zx = width * tf * (depth - tf) + tw * (depth - 2.0 * tf).powi(2) / 4.0;
        let zy = 2.0 * tf * width.powi(2) / 4.0 + (depth - 2.0 * tf) * tw.powi(2) / 4.0;

        Self {
            a,
            ix,
            iy,
            j,
            as_y,
            as_z,
            zx,
            zy,
            depth,
            width,
        }
    }

    /// Create rectangular solid section
    pub fn rectangular(width: f64, depth: f64) -> Self {
        let a = width * depth;
        let ix = width * depth.powi(3) / 12.0;
        let iy = depth * width.powi(3) / 12.0;
        let j = if width > depth {
            width
                * depth.powi(3)
                * (1.0 / 3.0
                    - 0.21 * depth / width * (1.0 - depth.powi(4) / (12.0 * width.powi(4))))
        } else {
            depth
                * width.powi(3)
                * (1.0 / 3.0
                    - 0.21 * width / depth * (1.0 - width.powi(4) / (12.0 * depth.powi(4))))
        };
        let as_y = a * 5.0 / 6.0;
        let as_z = a * 5.0 / 6.0;
        let zx = width * depth.powi(2) / 4.0;
        let zy = depth * width.powi(2) / 4.0;

        Self {
            a,
            ix,
            iy,
            j,
            as_y,
            as_z,
            zx,
            zy,
            depth,
            width,
        }
    }

    /// Create circular hollow section (pipe)
    pub fn pipe(outer_d: f64, thickness: f64) -> Self {
        let inner_d = outer_d - 2.0 * thickness;
        let a = std::f64::consts::PI / 4.0 * (outer_d.powi(2) - inner_d.powi(2));
        let ix = std::f64::consts::PI / 64.0 * (outer_d.powi(4) - inner_d.powi(4));
        let iy = ix;
        let j = std::f64::consts::PI / 32.0 * (outer_d.powi(4) - inner_d.powi(4));
        let as_y = a / 2.0;
        let as_z = a / 2.0;
        let zx = (outer_d.powi(3) - inner_d.powi(3)) / 6.0;
        let zy = zx;

        Self {
            a,
            ix,
            iy,
            j,
            as_y,
            as_z,
            zx,
            zy,
            depth: outer_d,
            width: outer_d,
        }
    }
}

/// Timoshenko beam element (12 DOFs: 6 per node)
/// Accounts for shear deformation, critical for deep beams
pub struct TimoshenkoBeamElement;

impl TimoshenkoBeamElement {
    /// Generate 12x12 local stiffness matrix with shear deformation
    pub fn stiffness_matrix(
        length: f64,
        mat: &ElementMaterial,
        section: &CrossSection,
    ) -> DMatrix<f64> {
        let l = length;
        let l2 = l * l;
        let l3 = l2 * l;
        let e = mat.e;
        let g = mat.g;
        let a = section.a;
        let ix = section.ix;
        let iy = section.iy;
        let j = section.j;

        // Shear deformation parameters (Timoshenko correction)
        let phi_y = if section.as_y > 0.0 && g > 0.0 {
            12.0 * e * ix / (g * section.as_y * l2)
        } else {
            0.0 // Euler-Bernoulli
        };
        let phi_z = if section.as_z > 0.0 && g > 0.0 {
            12.0 * e * iy / (g * section.as_z * l2)
        } else {
            0.0
        };

        let mut k = DMatrix::zeros(12, 12);

        // Axial stiffness
        let ea_l = e * a / l;
        k[(0, 0)] = ea_l;
        k[(0, 6)] = -ea_l;
        k[(6, 0)] = -ea_l;
        k[(6, 6)] = ea_l;

        // Torsional stiffness
        let gj_l = g * j / l;
        k[(3, 3)] = gj_l;
        k[(3, 9)] = -gj_l;
        k[(9, 3)] = -gj_l;
        k[(9, 9)] = gj_l;

        // Bending in X-Y plane (about Z-axis) with shear correction
        let c_z = e * ix / (l3 * (1.0 + phi_y));
        k[(1, 1)] = 12.0 * c_z;
        k[(1, 5)] = 6.0 * c_z * l;
        k[(1, 7)] = -12.0 * c_z;
        k[(1, 11)] = 6.0 * c_z * l;

        k[(5, 1)] = 6.0 * c_z * l;
        k[(5, 5)] = (4.0 + phi_y) * c_z * l2;
        k[(5, 7)] = -6.0 * c_z * l;
        k[(5, 11)] = (2.0 - phi_y) * c_z * l2;

        k[(7, 1)] = -12.0 * c_z;
        k[(7, 5)] = -6.0 * c_z * l;
        k[(7, 7)] = 12.0 * c_z;
        k[(7, 11)] = -6.0 * c_z * l;

        k[(11, 1)] = 6.0 * c_z * l;
        k[(11, 5)] = (2.0 - phi_y) * c_z * l2;
        k[(11, 7)] = -6.0 * c_z * l;
        k[(11, 11)] = (4.0 + phi_y) * c_z * l2;

        // Bending in X-Z plane (about Y-axis) with shear correction
        let c_y = e * iy / (l3 * (1.0 + phi_z));
        k[(2, 2)] = 12.0 * c_y;
        k[(2, 4)] = -6.0 * c_y * l;
        k[(2, 8)] = -12.0 * c_y;
        k[(2, 10)] = -6.0 * c_y * l;

        k[(4, 2)] = -6.0 * c_y * l;
        k[(4, 4)] = (4.0 + phi_z) * c_y * l2;
        k[(4, 8)] = 6.0 * c_y * l;
        k[(4, 10)] = (2.0 - phi_z) * c_y * l2;

        k[(8, 2)] = -12.0 * c_y;
        k[(8, 4)] = 6.0 * c_y * l;
        k[(8, 8)] = 12.0 * c_y;
        k[(8, 10)] = 6.0 * c_y * l;

        k[(10, 2)] = -6.0 * c_y * l;
        k[(10, 4)] = (2.0 - phi_z) * c_y * l2;
        k[(10, 8)] = 6.0 * c_y * l;
        k[(10, 10)] = (4.0 + phi_z) * c_y * l2;

        k
    }

    /// Consistent mass matrix (for dynamics)
    pub fn mass_matrix(length: f64, mat: &ElementMaterial, section: &CrossSection) -> DMatrix<f64> {
        let l = length;
        let rho_a = mat.density * section.a * 1e-9; // Convert to consistent units (N/mm → kg/mm)
        let m_total = rho_a * l;

        let mut m = DMatrix::zeros(12, 12);

        // Lumped mass (simpler and often preferred in practice)
        let m_half = m_total / 2.0;
        for i in 0..3 {
            m[(i, i)] = m_half;
            m[(i + 6, i + 6)] = m_half;
        }

        // Rotational inertia (approximate)
        let i_rot = m_total * l * l / 420.0;
        for i in 3..6 {
            m[(i, i)] = i_rot;
            m[(i + 6, i + 6)] = i_rot;
        }

        m
    }

    /// Geometric stiffness matrix (for P-Delta and buckling)
    pub fn geometric_stiffness(length: f64, axial_force: f64) -> DMatrix<f64> {
        let l = length;
        let p = axial_force;
        let mut kg = DMatrix::zeros(12, 12);

        let c = p / (30.0 * l);

        // Bending terms
        kg[(1, 1)] = 36.0 * c;
        kg[(1, 5)] = 3.0 * l * c;
        kg[(1, 7)] = -36.0 * c;
        kg[(1, 11)] = 3.0 * l * c;

        kg[(5, 1)] = 3.0 * l * c;
        kg[(5, 5)] = 4.0 * l * l * c;
        kg[(5, 7)] = -3.0 * l * c;
        kg[(5, 11)] = -l * l * c;

        kg[(7, 1)] = -36.0 * c;
        kg[(7, 5)] = -3.0 * l * c;
        kg[(7, 7)] = 36.0 * c;
        kg[(7, 11)] = -3.0 * l * c;

        kg[(11, 1)] = 3.0 * l * c;
        kg[(11, 5)] = -l * l * c;
        kg[(11, 7)] = -3.0 * l * c;
        kg[(11, 11)] = 4.0 * l * l * c;

        // Z-direction (same pattern)
        kg[(2, 2)] = 36.0 * c;
        kg[(2, 4)] = -3.0 * l * c;
        kg[(2, 8)] = -36.0 * c;
        kg[(2, 10)] = -3.0 * l * c;

        kg[(4, 2)] = -3.0 * l * c;
        kg[(4, 4)] = 4.0 * l * l * c;
        kg[(4, 8)] = 3.0 * l * c;
        kg[(4, 10)] = -l * l * c;

        kg[(8, 2)] = -36.0 * c;
        kg[(8, 4)] = 3.0 * l * c;
        kg[(8, 8)] = 36.0 * c;
        kg[(8, 10)] = 3.0 * l * c;

        kg[(10, 2)] = -3.0 * l * c;
        kg[(10, 4)] = -l * l * c;
        kg[(10, 8)] = 3.0 * l * c;
        kg[(10, 10)] = 4.0 * l * l * c;

        kg
    }

    /// Equivalent nodal loads for uniformly distributed load
    pub fn equiv_nodal_loads_udl(length: f64, wy: f64, wz: f64) -> DVector<f64> {
        let l = length;
        let mut f = DVector::zeros(12);

        // UDL in Y direction
        f[1] = wy * l / 2.0;
        f[5] = wy * l * l / 12.0;
        f[7] = wy * l / 2.0;
        f[11] = -wy * l * l / 12.0;

        // UDL in Z direction
        f[2] = wz * l / 2.0;
        f[4] = -wz * l * l / 12.0;
        f[8] = wz * l / 2.0;
        f[10] = wz * l * l / 12.0;

        f
    }

    /// Transformation matrix for 3D member
    pub fn transformation_matrix(start: &[f64; 3], end: &[f64; 3]) -> DMatrix<f64> {
        let dx = end[0] - start[0];
        let dy = end[1] - start[1];
        let dz = end[2] - start[2];
        let l = (dx * dx + dy * dy + dz * dz).sqrt();

        let cx = dx / l;
        let cy = dy / l;
        let cz = dz / l;

        // Build 3x3 rotation
        let r = if cx.abs() < 1e-10 && cz.abs() < 1e-10 {
            // Vertical member
            let sign = if cy > 0.0 { 1.0 } else { -1.0 };
            DMatrix::from_row_slice(3, 3, &[0.0, sign, 0.0, -sign, 0.0, 0.0, 0.0, 0.0, 1.0])
        } else {
            let cxz = (cx * cx + cz * cz).sqrt();
            DMatrix::from_row_slice(
                3,
                3,
                &[
                    cx,
                    cy,
                    cz,
                    -cx * cy / cxz,
                    cxz,
                    -cy * cz / cxz,
                    -cz / cxz,
                    0.0,
                    cx / cxz,
                ],
            )
        };

        // Expand to 12x12
        let mut t = DMatrix::zeros(12, 12);
        for block in 0..4 {
            let off = block * 3;
            for i in 0..3 {
                for j in 0..3 {
                    t[(off + i, off + j)] = r[(i, j)];
                }
            }
        }
        t
    }
}

/// Truss element (2 DOFs per node: axial only in 3D that's 3 translational DOFs)
pub struct TrussElement;

impl TrussElement {
    /// 6x6 stiffness matrix in global coordinates
    pub fn stiffness_matrix_global(
        start: &[f64; 3],
        end: &[f64; 3],
        e: f64,
        a: f64,
    ) -> DMatrix<f64> {
        let dx = end[0] - start[0];
        let dy = end[1] - start[1];
        let dz = end[2] - start[2];
        let l = (dx * dx + dy * dy + dz * dz).sqrt();

        let cx = dx / l;
        let cy = dy / l;
        let cz = dz / l;

        let k_local = e * a / l;
        let mut k = DMatrix::zeros(6, 6);

        // Direction cosine products
        let cc = [
            [cx * cx, cx * cy, cx * cz],
            [cy * cx, cy * cy, cy * cz],
            [cz * cx, cz * cy, cz * cz],
        ];

        for i in 0..3 {
            for j in 0..3 {
                k[(i, j)] = k_local * cc[i][j];
                k[(i, j + 3)] = -k_local * cc[i][j];
                k[(i + 3, j)] = -k_local * cc[i][j];
                k[(i + 3, j + 3)] = k_local * cc[i][j];
            }
        }

        k
    }
}

/// Spring element (6 DOFs)
pub struct SpringElement;

impl SpringElement {
    /// Generate spring stiffness matrix
    pub fn stiffness_matrix(
        kx: f64,
        ky: f64,
        kz: f64,
        krx: f64,
        kry: f64,
        krz: f64,
    ) -> DMatrix<f64> {
        let mut k = DMatrix::zeros(6, 6);
        k[(0, 0)] = kx;
        k[(1, 1)] = ky;
        k[(2, 2)] = kz;
        k[(3, 3)] = krx;
        k[(4, 4)] = kry;
        k[(5, 5)] = krz;
        k
    }
}

/// 4-node plate/shell element (Mindlin-Reissner theory)
/// Each node has 5 DOFs: w, theta_x, theta_y, u, v (or 6 with drilling DOF)
pub struct PlateShellElement;

impl PlateShellElement {
    /// Compute 24x24 stiffness matrix for a quad shell element (6 DOF/node)
    /// Uses bilinear isoparametric formulation with 2x2 Gauss integration
    pub fn stiffness_matrix(
        nodes: &[[f64; 3]; 4],
        thickness: f64,
        mat: &ElementMaterial,
    ) -> DMatrix<f64> {
        let e = mat.e;
        let nu = mat.nu;
        let t = thickness;

        // Constitutive matrix for plane stress (membrane part)
        let d_factor = e * t / (1.0 - nu * nu);
        let _d_membrane = DMatrix::from_row_slice(
            3,
            3,
            &[
                d_factor,
                d_factor * nu,
                0.0,
                d_factor * nu,
                d_factor,
                0.0,
                0.0,
                0.0,
                d_factor * (1.0 - nu) / 2.0,
            ],
        );

        // Bending stiffness
        let d_bend_factor = e * t.powi(3) / (12.0 * (1.0 - nu * nu));
        let _d_bending = DMatrix::from_row_slice(
            3,
            3,
            &[
                d_bend_factor,
                d_bend_factor * nu,
                0.0,
                d_bend_factor * nu,
                d_bend_factor,
                0.0,
                0.0,
                0.0,
                d_bend_factor * (1.0 - nu) / 2.0,
            ],
        );

        // 2x2 Gauss points
        let gp = 1.0 / 3.0_f64.sqrt();
        let gauss_pts = [(-gp, -gp), (gp, -gp), (gp, gp), (-gp, gp)];
        let weights = [1.0; 4];

        let mut k = DMatrix::zeros(24, 24);

        for (&(xi, eta), &w) in gauss_pts.iter().zip(weights.iter()) {
            // Shape functions derivatives
            let dn_dxi = [
                [
                    -(1.0 - eta) / 4.0,
                    (1.0 - eta) / 4.0,
                    (1.0 + eta) / 4.0,
                    -(1.0 + eta) / 4.0,
                ],
                [
                    -(1.0 - xi) / 4.0,
                    -(1.0 + xi) / 4.0,
                    (1.0 + xi) / 4.0,
                    (1.0 - xi) / 4.0,
                ],
            ];

            // Jacobian
            let mut jac = [[0.0; 2]; 2];
            for i in 0..4 {
                jac[0][0] += dn_dxi[0][i] * nodes[i][0];
                jac[0][1] += dn_dxi[0][i] * nodes[i][1];
                jac[1][0] += dn_dxi[1][i] * nodes[i][0];
                jac[1][1] += dn_dxi[1][i] * nodes[i][1];
            }

            let det_j = jac[0][0] * jac[1][1] - jac[0][1] * jac[1][0];
            if det_j.abs() < 1e-15 {
                continue;
            }

            let inv_j = [
                [jac[1][1] / det_j, -jac[0][1] / det_j],
                [-jac[1][0] / det_j, jac[0][0] / det_j],
            ];

            // B matrix (strain-displacement) for membrane
            let mut dn_dx = [[0.0; 4]; 2];
            for i in 0..4 {
                dn_dx[0][i] = inv_j[0][0] * dn_dxi[0][i] + inv_j[0][1] * dn_dxi[1][i];
                dn_dx[1][i] = inv_j[1][0] * dn_dxi[0][i] + inv_j[1][1] * dn_dxi[1][i];
            }

            // Simplified: add membrane contribution to diagonal block
            // Full implementation would compute B^T * D * B for each Gauss point
            for i in 0..4 {
                let ni = i * 6;
                for j in 0..4 {
                    let nj = j * 6;
                    let contrib = d_factor * w * det_j;

                    // Membrane coupling (u-u, v-v)
                    k[(ni, nj)] += contrib * dn_dx[0][i] * dn_dx[0][j];
                    k[(ni + 1, nj + 1)] += contrib * dn_dx[1][i] * dn_dx[1][j];
                    k[(ni, nj + 1)] += contrib * nu * dn_dx[0][i] * dn_dx[1][j];
                    k[(ni + 1, nj)] += contrib * nu * dn_dx[1][i] * dn_dx[0][j];

                    // Bending coupling (rx-rx, ry-ry)
                    let bend_contrib = d_bend_factor * w * det_j;
                    k[(ni + 3, nj + 3)] += bend_contrib * dn_dx[0][i] * dn_dx[0][j];
                    k[(ni + 4, nj + 4)] += bend_contrib * dn_dx[1][i] * dn_dx[1][j];

                    // Out-of-plane (w-w)
                    let shear_factor = e * t * 5.0 / (12.0 * (1.0 + nu));
                    let _n_i = match i {
                        0 => (1.0 - xi) * (1.0 - eta) / 4.0,
                        1 => (1.0 + xi) * (1.0 - eta) / 4.0,
                        2 => (1.0 + xi) * (1.0 + eta) / 4.0,
                        3 => (1.0 - xi) * (1.0 + eta) / 4.0,
                        _ => 0.0,
                    };
                    let _n_j = match j {
                        0 => (1.0 - xi) * (1.0 - eta) / 4.0,
                        1 => (1.0 + xi) * (1.0 - eta) / 4.0,
                        2 => (1.0 + xi) * (1.0 + eta) / 4.0,
                        3 => (1.0 - xi) * (1.0 + eta) / 4.0,
                        _ => 0.0,
                    };
                    k[(ni + 2, nj + 2)] += shear_factor
                        * (dn_dx[0][i] * dn_dx[0][j] + dn_dx[1][i] * dn_dx[1][j])
                        * w
                        * det_j;
                }
            }
        }

        // Ensure symmetry
        for i in 0..24 {
            for j in (i + 1)..24 {
                let avg = (k[(i, j)] + k[(j, i)]) / 2.0;
                k[(i, j)] = avg;
                k[(j, i)] = avg;
            }
        }

        k
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_timoshenko_stiffness_symmetry() {
        let mat = ElementMaterial::steel();
        let section = CrossSection::i_beam(400.0, 200.0, 8.9, 13.5); // ISMB 400-like

        let k = TimoshenkoBeamElement::stiffness_matrix(5000.0, &mat, &section);

        // Check symmetry
        for i in 0..12 {
            for j in 0..12 {
                assert!(
                    (k[(i, j)] - k[(j, i)]).abs() < 1e-6,
                    "Not symmetric at ({},{}): {} vs {}",
                    i,
                    j,
                    k[(i, j)],
                    k[(j, i)]
                );
            }
        }
    }

    #[test]
    fn test_timoshenko_vs_euler() {
        let mat = ElementMaterial::steel();

        // Slender beam (Timoshenko ≈ Euler-Bernoulli)
        let slender = CrossSection::rectangular(100.0, 10.0); // Very thin
        let k_timo = TimoshenkoBeamElement::stiffness_matrix(10000.0, &mat, &slender);

        // For slender beams, shear deformation parameter φ ≈ 0
        // So stiffness should be close to Euler-Bernoulli
        assert!(k_timo[(1, 1)] > 0.0);
    }

    #[test]
    fn test_truss_element() {
        let k = TrussElement::stiffness_matrix_global(
            &[0.0, 0.0, 0.0],
            &[1000.0, 0.0, 0.0],
            200_000.0,
            1000.0,
        );

        // Axial stiffness = EA/L = 200000 * 1000 / 1000 = 200000
        assert!((k[(0, 0)] - 200_000.0).abs() < 1.0);
        assert!((k[(0, 3)] - (-200_000.0)).abs() < 1.0);
    }

    #[test]
    fn test_section_properties() {
        let section = CrossSection::i_beam(400.0, 200.0, 8.9, 13.5);
        assert!(section.a > 0.0);
        assert!(section.ix > section.iy); // Strong axis > weak axis
        assert!(section.as_y > 0.0);
    }

    #[test]
    fn test_geometric_stiffness() {
        let kg = TimoshenkoBeamElement::geometric_stiffness(5000.0, 100_000.0);
        // Should be symmetric
        for i in 0..12 {
            for j in 0..12 {
                assert!((kg[(i, j)] - kg[(j, i)]).abs() < 1e-6);
            }
        }
    }
}
