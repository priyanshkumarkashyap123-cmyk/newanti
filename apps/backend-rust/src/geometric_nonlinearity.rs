//! Geometric Nonlinearity Module
//!
//! Large displacement/rotation analysis using corotational formulations
//! and total/updated Lagrangian approaches.
//!
//! ## Formulations
//! - **Corotational** - Element-level rotation extraction
//! - **Total Lagrangian** - Reference to initial configuration
//! - **Updated Lagrangian** - Reference to current configuration
//!
//! ## Features
//! - Large rotations (quaternion-based)
//! - Follower forces
//! - Geometric stiffness
//! - Second-order effects (P-Δ, P-δ)


// ============================================================================
// ROTATION REPRESENTATIONS
// ============================================================================

/// 3x3 Rotation matrix
#[derive(Debug, Clone, Copy)]
pub struct RotationMatrix {
    pub data: [[f64; 3]; 3],
}

impl RotationMatrix {
    pub fn identity() -> Self {
        RotationMatrix {
            data: [
                [1.0, 0.0, 0.0],
                [0.0, 1.0, 0.0],
                [0.0, 0.0, 1.0],
            ],
        }
    }

    /// Create from axis-angle representation
    pub fn from_axis_angle(axis: [f64; 3], angle: f64) -> Self {
        let norm = (axis[0].powi(2) + axis[1].powi(2) + axis[2].powi(2)).sqrt();
        if norm < 1e-14 || angle.abs() < 1e-14 {
            return Self::identity();
        }

        let n = [axis[0] / norm, axis[1] / norm, axis[2] / norm];
        let c = angle.cos();
        let s = angle.sin();
        let t = 1.0 - c;

        RotationMatrix {
            data: [
                [t * n[0] * n[0] + c, t * n[0] * n[1] - s * n[2], t * n[0] * n[2] + s * n[1]],
                [t * n[0] * n[1] + s * n[2], t * n[1] * n[1] + c, t * n[1] * n[2] - s * n[0]],
                [t * n[0] * n[2] - s * n[1], t * n[1] * n[2] + s * n[0], t * n[2] * n[2] + c],
            ],
        }
    }

    /// Create rotation matrix from rotation vector (exponential map)
    pub fn from_rotation_vector(theta: [f64; 3]) -> Self {
        let angle = (theta[0].powi(2) + theta[1].powi(2) + theta[2].powi(2)).sqrt();
        if angle < 1e-14 {
            return Self::identity();
        }

        let axis = [theta[0] / angle, theta[1] / angle, theta[2] / angle];
        Self::from_axis_angle(axis, angle)
    }

    /// Extract rotation vector from rotation matrix (logarithmic map)
    pub fn to_rotation_vector(&self) -> [f64; 3] {
        let trace = self.data[0][0] + self.data[1][1] + self.data[2][2];
        let cos_angle = (trace - 1.0) / 2.0;
        let angle = cos_angle.clamp(-1.0, 1.0).acos();

        if angle.abs() < 1e-10 {
            // Small angle approximation
            return [
                (self.data[2][1] - self.data[1][2]) / 2.0,
                (self.data[0][2] - self.data[2][0]) / 2.0,
                (self.data[1][0] - self.data[0][1]) / 2.0,
            ];
        }

        let factor = angle / (2.0 * angle.sin());
        [
            factor * (self.data[2][1] - self.data[1][2]),
            factor * (self.data[0][2] - self.data[2][0]),
            factor * (self.data[1][0] - self.data[0][1]),
        ]
    }

    /// Matrix multiplication
    pub fn multiply(&self, other: &RotationMatrix) -> RotationMatrix {
        let mut result = [[0.0; 3]; 3];
        for i in 0..3 {
            for j in 0..3 {
                for k in 0..3 {
                    result[i][j] += self.data[i][k] * other.data[k][j];
                }
            }
        }
        RotationMatrix { data: result }
    }

    /// Transpose
    pub fn transpose(&self) -> RotationMatrix {
        RotationMatrix {
            data: [
                [self.data[0][0], self.data[1][0], self.data[2][0]],
                [self.data[0][1], self.data[1][1], self.data[2][1]],
                [self.data[0][2], self.data[1][2], self.data[2][2]],
            ],
        }
    }

    /// Rotate a vector
    pub fn rotate(&self, v: [f64; 3]) -> [f64; 3] {
        [
            self.data[0][0] * v[0] + self.data[0][1] * v[1] + self.data[0][2] * v[2],
            self.data[1][0] * v[0] + self.data[1][1] * v[1] + self.data[1][2] * v[2],
            self.data[2][0] * v[0] + self.data[2][1] * v[1] + self.data[2][2] * v[2],
        ]
    }

    /// Determinant
    pub fn determinant(&self) -> f64 {
        let d = &self.data;
        d[0][0] * (d[1][1] * d[2][2] - d[1][2] * d[2][1])
            - d[0][1] * (d[1][0] * d[2][2] - d[1][2] * d[2][0])
            + d[0][2] * (d[1][0] * d[2][1] - d[1][1] * d[2][0])
    }
}

impl Default for RotationMatrix {
    fn default() -> Self {
        Self::identity()
    }
}

/// Quaternion for rotation representation
#[derive(Debug, Clone, Copy)]
pub struct Quaternion {
    pub w: f64, // scalar part
    pub x: f64, // vector part
    pub y: f64,
    pub z: f64,
}

impl Quaternion {
    pub fn identity() -> Self {
        Quaternion { w: 1.0, x: 0.0, y: 0.0, z: 0.0 }
    }

    pub fn from_axis_angle(axis: [f64; 3], angle: f64) -> Self {
        let norm = (axis[0].powi(2) + axis[1].powi(2) + axis[2].powi(2)).sqrt();
        if norm < 1e-14 {
            return Self::identity();
        }

        let half_angle = angle / 2.0;
        let s = half_angle.sin() / norm;

        Quaternion {
            w: half_angle.cos(),
            x: axis[0] * s,
            y: axis[1] * s,
            z: axis[2] * s,
        }
    }

    pub fn from_rotation_matrix(r: &RotationMatrix) -> Self {
        let trace = r.data[0][0] + r.data[1][1] + r.data[2][2];

        if trace > 0.0 {
            let s = (trace + 1.0).sqrt() * 2.0;
            Quaternion {
                w: s / 4.0,
                x: (r.data[2][1] - r.data[1][2]) / s,
                y: (r.data[0][2] - r.data[2][0]) / s,
                z: (r.data[1][0] - r.data[0][1]) / s,
            }
        } else if r.data[0][0] > r.data[1][1] && r.data[0][0] > r.data[2][2] {
            let s = (1.0 + r.data[0][0] - r.data[1][1] - r.data[2][2]).sqrt() * 2.0;
            Quaternion {
                w: (r.data[2][1] - r.data[1][2]) / s,
                x: s / 4.0,
                y: (r.data[0][1] + r.data[1][0]) / s,
                z: (r.data[0][2] + r.data[2][0]) / s,
            }
        } else if r.data[1][1] > r.data[2][2] {
            let s = (1.0 + r.data[1][1] - r.data[0][0] - r.data[2][2]).sqrt() * 2.0;
            Quaternion {
                w: (r.data[0][2] - r.data[2][0]) / s,
                x: (r.data[0][1] + r.data[1][0]) / s,
                y: s / 4.0,
                z: (r.data[1][2] + r.data[2][1]) / s,
            }
        } else {
            let s = (1.0 + r.data[2][2] - r.data[0][0] - r.data[1][1]).sqrt() * 2.0;
            Quaternion {
                w: (r.data[1][0] - r.data[0][1]) / s,
                x: (r.data[0][2] + r.data[2][0]) / s,
                y: (r.data[1][2] + r.data[2][1]) / s,
                z: s / 4.0,
            }
        }
    }

    pub fn to_rotation_matrix(&self) -> RotationMatrix {
        let q = self.normalize();
        let (w, x, y, z) = (q.w, q.x, q.y, q.z);

        RotationMatrix {
            data: [
                [1.0 - 2.0 * (y * y + z * z), 2.0 * (x * y - w * z), 2.0 * (x * z + w * y)],
                [2.0 * (x * y + w * z), 1.0 - 2.0 * (x * x + z * z), 2.0 * (y * z - w * x)],
                [2.0 * (x * z - w * y), 2.0 * (y * z + w * x), 1.0 - 2.0 * (x * x + y * y)],
            ],
        }
    }

    pub fn normalize(&self) -> Self {
        let norm = (self.w.powi(2) + self.x.powi(2) + self.y.powi(2) + self.z.powi(2)).sqrt();
        if norm < 1e-14 {
            return Self::identity();
        }
        Quaternion {
            w: self.w / norm,
            x: self.x / norm,
            y: self.y / norm,
            z: self.z / norm,
        }
    }

    pub fn multiply(&self, other: &Quaternion) -> Quaternion {
        Quaternion {
            w: self.w * other.w - self.x * other.x - self.y * other.y - self.z * other.z,
            x: self.w * other.x + self.x * other.w + self.y * other.z - self.z * other.y,
            y: self.w * other.y - self.x * other.z + self.y * other.w + self.z * other.x,
            z: self.w * other.z + self.x * other.y - self.y * other.x + self.z * other.w,
        }
    }

    pub fn rotate(&self, v: [f64; 3]) -> [f64; 3] {
        self.to_rotation_matrix().rotate(v)
    }
}

impl Default for Quaternion {
    fn default() -> Self {
        Self::identity()
    }
}

// ============================================================================
// COROTATIONAL FRAME
// ============================================================================

/// Corotational frame for an element
#[derive(Debug, Clone)]
pub struct CorotationalFrame {
    pub rotation: RotationMatrix,      // Element rotation R
    pub reference_length: f64,         // Initial element length
    pub current_length: f64,           // Deformed element length
    pub local_displacement: Vec<f64>,  // Displacement in corotated frame
}

impl CorotationalFrame {
    /// Create corotational frame for 2-node beam element
    pub fn from_beam_nodes(
        node1_ref: [f64; 3],
        node2_ref: [f64; 3],
        node1_def: [f64; 3],
        node2_def: [f64; 3],
    ) -> Self {
        // Reference configuration
        let dx_ref = [
            node2_ref[0] - node1_ref[0],
            node2_ref[1] - node1_ref[1],
            node2_ref[2] - node1_ref[2],
        ];
        let l_ref = (dx_ref[0].powi(2) + dx_ref[1].powi(2) + dx_ref[2].powi(2)).sqrt();

        // Current configuration
        let dx_def = [
            node2_def[0] - node1_def[0],
            node2_def[1] - node1_def[1],
            node2_def[2] - node1_def[2],
        ];
        let l_def = (dx_def[0].powi(2) + dx_def[1].powi(2) + dx_def[2].powi(2)).sqrt();

        // Current axis
        let e1 = if l_def > 1e-14 {
            [dx_def[0] / l_def, dx_def[1] / l_def, dx_def[2] / l_def]
        } else {
            [1.0, 0.0, 0.0]
        };

        // Construct rotation matrix (simplified - assumes small twist)
        // Full implementation would track element twist
        let e2 = perpendicular_vector(e1);
        let e3 = cross_product(e1, e2);

        let rotation = RotationMatrix {
            data: [e1, e2, e3],
        }.transpose();

        // Local displacement = R^T * (u_global)
        let local_displacement = vec![l_def - l_ref]; // Axial stretch

        CorotationalFrame {
            rotation,
            reference_length: l_ref,
            current_length: l_def,
            local_displacement,
        }
    }

    /// Get rigid body rotation (as rotation vector)
    pub fn get_rigid_rotation(&self) -> [f64; 3] {
        self.rotation.to_rotation_vector()
    }

    /// Get deformational displacement
    pub fn get_deformational_displacement(&self) -> &[f64] {
        &self.local_displacement
    }

    /// Transform local stiffness to global
    pub fn transform_stiffness_to_global(&self, k_local: &[f64], n_dof: usize) -> Vec<f64> {
        // K_global = T^T * K_local * T
        // where T is the transformation matrix
        let mut k_global = vec![0.0; n_dof * n_dof];

        // Build transformation matrix
        let t = self.build_transformation_matrix(n_dof);

        // K_global = T^T * K_local * T
        for i in 0..n_dof {
            for j in 0..n_dof {
                for p in 0..n_dof {
                    for q in 0..n_dof {
                        k_global[i * n_dof + j] += t[p * n_dof + i] * k_local[p * n_dof + q] * t[q * n_dof + j];
                    }
                }
            }
        }

        k_global
    }

    /// Transform local forces to global
    pub fn transform_forces_to_global(&self, f_local: &[f64]) -> Vec<f64> {
        let n = f_local.len();
        let t = self.build_transformation_matrix(n);

        // f_global = T^T * f_local
        let mut f_global = vec![0.0; n];
        for i in 0..n {
            for j in 0..n {
                f_global[i] += t[j * n + i] * f_local[j];
            }
        }

        f_global
    }

    fn build_transformation_matrix(&self, n_dof: usize) -> Vec<f64> {
        let mut t = vec![0.0; n_dof * n_dof];
        let r = &self.rotation.data;

        // For 12-DOF beam element (2 nodes × 6 DOF)
        if n_dof == 12 {
            for node in 0..2 {
                let base = node * 6;
                // Translation DOFs
                for i in 0..3 {
                    for j in 0..3 {
                        t[(base + i) * n_dof + (base + j)] = r[i][j];
                    }
                }
                // Rotation DOFs
                for i in 0..3 {
                    for j in 0..3 {
                        t[(base + 3 + i) * n_dof + (base + 3 + j)] = r[i][j];
                    }
                }
            }
        } else {
            // Default: block diagonal with rotation matrices
            let num_blocks = n_dof / 3;
            for block in 0..num_blocks {
                let base = block * 3;
                for i in 0..3 {
                    for j in 0..3 {
                        t[(base + i) * n_dof + (base + j)] = r[i][j];
                    }
                }
            }
        }

        t
    }
}

/// Helper: find perpendicular vector
fn perpendicular_vector(v: [f64; 3]) -> [f64; 3] {
    let mut perp = if v[0].abs() < 0.9 {
        [1.0, 0.0, 0.0]
    } else {
        [0.0, 1.0, 0.0]
    };

    // Gram-Schmidt
    let dot: f64 = perp.iter().zip(v.iter()).map(|(a, b)| a * b).sum();
    for i in 0..3 {
        perp[i] -= dot * v[i];
    }

    let norm = (perp[0].powi(2) + perp[1].powi(2) + perp[2].powi(2)).sqrt();
    [perp[0] / norm, perp[1] / norm, perp[2] / norm]
}

/// Helper: cross product
fn cross_product(a: [f64; 3], b: [f64; 3]) -> [f64; 3] {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}

// ============================================================================
// GEOMETRIC STIFFNESS
// ============================================================================

/// Geometric stiffness matrix generator
pub struct GeometricStiffness;

impl GeometricStiffness {
    /// Geometric stiffness for 2D beam element (6 DOF)
    /// K_g = P/L * [...] where P is axial force
    pub fn beam_2d(length: f64, axial_force: f64) -> [[f64; 6]; 6] {
        let p_l = axial_force / length;

        let mut kg = [[0.0; 6]; 6];

        // Simplified geometric stiffness (lateral DOFs only)
        // More complete version includes all coupling terms
        let c = p_l * 6.0 / 5.0;
        let c2 = p_l * length / 10.0;
        let c3 = p_l * 2.0 * length * length / 15.0;

        // v1-v1
        kg[1][1] = c;
        // v1-θ1
        kg[1][2] = c2;
        kg[2][1] = c2;
        // θ1-θ1
        kg[2][2] = c3;
        // v1-v2
        kg[1][4] = -c;
        kg[4][1] = -c;
        // v1-θ2
        kg[1][5] = c2;
        kg[5][1] = c2;
        // θ1-v2
        kg[2][4] = -c2;
        kg[4][2] = -c2;
        // θ1-θ2
        kg[2][5] = -c3 / 2.0;
        kg[5][2] = -c3 / 2.0;
        // v2-v2
        kg[4][4] = c;
        // v2-θ2
        kg[4][5] = -c2;
        kg[5][4] = -c2;
        // θ2-θ2
        kg[5][5] = c3;

        kg
    }

    /// Geometric stiffness for 3D beam element (12 DOF)
    pub fn beam_3d(length: f64, axial_force: f64) -> [[f64; 12]; 12] {
        let p_l = axial_force / length;
        let mut kg = [[0.0; 12]; 12];

        // Same structure as 2D but with both y and z directions
        let c = p_l * 6.0 / 5.0;
        let c2 = p_l * length / 10.0;
        let c3 = p_l * 2.0 * length * length / 15.0;

        // Y-direction (DOFs 1, 5, 7, 11)
        kg[1][1] = c;
        kg[1][5] = c2;
        kg[5][1] = c2;
        kg[5][5] = c3;
        kg[1][7] = -c;
        kg[7][1] = -c;
        kg[1][11] = c2;
        kg[11][1] = c2;
        kg[5][7] = -c2;
        kg[7][5] = -c2;
        kg[5][11] = -c3 / 2.0;
        kg[11][5] = -c3 / 2.0;
        kg[7][7] = c;
        kg[7][11] = -c2;
        kg[11][7] = -c2;
        kg[11][11] = c3;

        // Z-direction (DOFs 2, 4, 8, 10)
        kg[2][2] = c;
        kg[2][4] = -c2;
        kg[4][2] = -c2;
        kg[4][4] = c3;
        kg[2][8] = -c;
        kg[8][2] = -c;
        kg[2][10] = -c2;
        kg[10][2] = -c2;
        kg[4][8] = c2;
        kg[8][4] = c2;
        kg[4][10] = -c3 / 2.0;
        kg[10][4] = -c3 / 2.0;
        kg[8][8] = c;
        kg[8][10] = c2;
        kg[10][8] = c2;
        kg[10][10] = c3;

        kg
    }

    /// Geometric stiffness for membrane/shell element
    pub fn membrane(
        stress: [f64; 3],  // σxx, σyy, σxy
        b_matrix: &[f64],  // Strain-displacement matrix
        thickness: f64,
        area: f64,
    ) -> Vec<f64> {
        // K_g = ∫ B_NL^T * S * B_NL dA
        // Simplified implementation - full version uses numerical integration
        let n_dof = b_matrix.len() / 3; // Assuming 3 strain components
        let mut kg = vec![0.0; n_dof * n_dof];

        // Stress matrix
        let s = [
            [stress[0], stress[2]],
            [stress[2], stress[1]],
        ];

        // This is a placeholder - full implementation needs proper B_NL matrix
        let factor = thickness * area;
        for i in 0..n_dof {
            kg[i * n_dof + i] += factor * (s[0][0] + s[1][1]) * 0.5;
        }

        kg
    }
}

// ============================================================================
// TOTAL LAGRANGIAN FORMULATION
// ============================================================================

/// Total Lagrangian strain measures
pub struct TotalLagrangian;

impl TotalLagrangian {
    /// Green-Lagrange strain tensor: E = 0.5 * (F^T*F - I)
    pub fn green_lagrange_strain(deformation_gradient: &[[f64; 3]; 3]) -> [[f64; 3]; 3] {
        let f = deformation_gradient;
        let mut c = [[0.0; 3]; 3];

        // C = F^T * F (right Cauchy-Green tensor)
        for i in 0..3 {
            for j in 0..3 {
                for k in 0..3 {
                    c[i][j] += f[k][i] * f[k][j];
                }
            }
        }

        // E = 0.5 * (C - I)
        let mut e = [[0.0; 3]; 3];
        for i in 0..3 {
            for j in 0..3 {
                e[i][j] = 0.5 * c[i][j];
            }
            e[i][i] -= 0.5;
        }

        e
    }

    /// Second Piola-Kirchhoff stress from Green-Lagrange strain
    /// S = C : E (for linear elastic material)
    pub fn second_piola_kirchhoff(
        strain: &[[f64; 3]; 3],
        elastic_modulus: f64,
        poisson_ratio: f64,
    ) -> [[f64; 3]; 3] {
        let lambda = elastic_modulus * poisson_ratio /
            ((1.0 + poisson_ratio) * (1.0 - 2.0 * poisson_ratio));
        let mu = elastic_modulus / (2.0 * (1.0 + poisson_ratio));

        let trace = strain[0][0] + strain[1][1] + strain[2][2];

        let mut s = [[0.0; 3]; 3];
        for i in 0..3 {
            for j in 0..3 {
                s[i][j] = 2.0 * mu * strain[i][j];
            }
            s[i][i] += lambda * trace;
        }

        s
    }

    /// Deformation gradient from displacement gradient
    /// F = I + ∂u/∂X
    pub fn deformation_gradient(displacement_gradient: &[[f64; 3]; 3]) -> [[f64; 3]; 3] {
        let mut f = displacement_gradient.clone();
        for i in 0..3 {
            f[i][i] += 1.0;
        }
        f
    }
}

// ============================================================================
// UPDATED LAGRANGIAN FORMULATION
// ============================================================================

/// Updated Lagrangian strain measures
pub struct UpdatedLagrangian;

impl UpdatedLagrangian {
    /// Almansi (Euler) strain tensor: e = 0.5 * (I - B^-1)
    /// where B = F * F^T is left Cauchy-Green tensor
    pub fn almansi_strain(deformation_gradient: &[[f64; 3]; 3]) -> [[f64; 3]; 3] {
        let f = deformation_gradient;
        let mut b = [[0.0; 3]; 3];

        // B = F * F^T
        for i in 0..3 {
            for j in 0..3 {
                for k in 0..3 {
                    b[i][j] += f[i][k] * f[j][k];
                }
            }
        }

        // Invert B (3x3 matrix inversion)
        let det = b[0][0] * (b[1][1] * b[2][2] - b[1][2] * b[2][1])
                - b[0][1] * (b[1][0] * b[2][2] - b[1][2] * b[2][0])
                + b[0][2] * (b[1][0] * b[2][1] - b[1][1] * b[2][0]);

        let mut b_inv = [[0.0; 3]; 3];
        if det.abs() > 1e-14 {
            let inv_det = 1.0 / det;
            b_inv[0][0] = inv_det * (b[1][1] * b[2][2] - b[1][2] * b[2][1]);
            b_inv[0][1] = inv_det * (b[0][2] * b[2][1] - b[0][1] * b[2][2]);
            b_inv[0][2] = inv_det * (b[0][1] * b[1][2] - b[0][2] * b[1][1]);
            b_inv[1][0] = inv_det * (b[1][2] * b[2][0] - b[1][0] * b[2][2]);
            b_inv[1][1] = inv_det * (b[0][0] * b[2][2] - b[0][2] * b[2][0]);
            b_inv[1][2] = inv_det * (b[0][2] * b[1][0] - b[0][0] * b[1][2]);
            b_inv[2][0] = inv_det * (b[1][0] * b[2][1] - b[1][1] * b[2][0]);
            b_inv[2][1] = inv_det * (b[0][1] * b[2][0] - b[0][0] * b[2][1]);
            b_inv[2][2] = inv_det * (b[0][0] * b[1][1] - b[0][1] * b[1][0]);
        }

        // e = 0.5 * (I - B^-1)
        let mut e = [[0.0; 3]; 3];
        for i in 0..3 {
            for j in 0..3 {
                e[i][j] = -0.5 * b_inv[i][j];
            }
            e[i][i] += 0.5;
        }

        e
    }

    /// Cauchy stress from Almansi strain
    pub fn cauchy_stress(
        strain: &[[f64; 3]; 3],
        elastic_modulus: f64,
        poisson_ratio: f64,
    ) -> [[f64; 3]; 3] {
        // Same constitutive relation for small strains
        TotalLagrangian::second_piola_kirchhoff(strain, elastic_modulus, poisson_ratio)
    }
}

// ============================================================================
// P-DELTA ANALYSIS
// ============================================================================

/// P-Delta effect analysis
pub struct PDeltaAnalysis {
    pub iterations: usize,
    pub tolerance: f64,
    pub include_p_delta: bool,  // P-Δ (nodal displacement)
    pub include_p_small_delta: bool,  // P-δ (member curvature)
}

impl Default for PDeltaAnalysis {
    fn default() -> Self {
        PDeltaAnalysis {
            iterations: 10,
            tolerance: 1e-6,
            include_p_delta: true,
            include_p_small_delta: false,
        }
    }
}

impl PDeltaAnalysis {
    /// Compute P-Delta amplification factor (approximate)
    /// B2 = 1 / (1 - ΣP / Pe)
    pub fn amplification_factor(total_gravity_load: f64, euler_buckling_load: f64) -> f64 {
        if euler_buckling_load <= 0.0 {
            return 1.0;
        }

        let ratio = total_gravity_load / euler_buckling_load;
        if ratio >= 1.0 {
            return f64::INFINITY; // Unstable
        }

        1.0 / (1.0 - ratio)
    }

    /// Compute additional moment due to P-Delta
    /// M_additional = P * Δ
    pub fn additional_moment(axial_load: f64, lateral_displacement: f64) -> f64 {
        axial_load * lateral_displacement
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f64::consts::PI;

    #[test]
    fn test_rotation_matrix_identity() {
        let r = RotationMatrix::identity();

        assert!((r.determinant() - 1.0).abs() < 1e-10);

        let v = [1.0, 2.0, 3.0];
        let rotated = r.rotate(v);
        assert!((rotated[0] - v[0]).abs() < 1e-10);
        assert!((rotated[1] - v[1]).abs() < 1e-10);
        assert!((rotated[2] - v[2]).abs() < 1e-10);
    }

    #[test]
    fn test_rotation_matrix_90_degrees() {
        let r = RotationMatrix::from_axis_angle([0.0, 0.0, 1.0], PI / 2.0);

        let v = [1.0, 0.0, 0.0];
        let rotated = r.rotate(v);

        // 90° rotation around z-axis: x -> y
        assert!((rotated[0] - 0.0).abs() < 1e-10);
        assert!((rotated[1] - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_rotation_vector_roundtrip() {
        let theta = [0.1, 0.2, 0.3];
        let r = RotationMatrix::from_rotation_vector(theta);
        let theta_back = r.to_rotation_vector();

        assert!((theta[0] - theta_back[0]).abs() < 1e-10);
        assert!((theta[1] - theta_back[1]).abs() < 1e-10);
        assert!((theta[2] - theta_back[2]).abs() < 1e-10);
    }

    #[test]
    fn test_quaternion_identity() {
        let q = Quaternion::identity();
        let v = [1.0, 2.0, 3.0];
        let rotated = q.rotate(v);

        assert!((rotated[0] - v[0]).abs() < 1e-10);
        assert!((rotated[1] - v[1]).abs() < 1e-10);
        assert!((rotated[2] - v[2]).abs() < 1e-10);
    }

    #[test]
    fn test_quaternion_rotation_matrix_conversion() {
        let r = RotationMatrix::from_axis_angle([1.0, 0.0, 0.0], 0.5);
        let q = Quaternion::from_rotation_matrix(&r);
        let r_back = q.to_rotation_matrix();

        for i in 0..3 {
            for j in 0..3 {
                assert!((r.data[i][j] - r_back.data[i][j]).abs() < 1e-10);
            }
        }
    }

    #[test]
    fn test_corotational_frame() {
        let node1_ref = [0.0, 0.0, 0.0];
        let node2_ref = [1.0, 0.0, 0.0];
        let node1_def = [0.0, 0.0, 0.0];
        let node2_def = [1.1, 0.0, 0.0];

        let frame = CorotationalFrame::from_beam_nodes(
            node1_ref, node2_ref, node1_def, node2_def,
        );

        assert!((frame.reference_length - 1.0).abs() < 1e-10);
        assert!((frame.current_length - 1.1).abs() < 1e-10);
    }

    #[test]
    fn test_geometric_stiffness_beam_2d() {
        let l = 1.0;
        let p = 100.0;

        let kg = GeometricStiffness::beam_2d(l, p);

        // Check symmetry
        for i in 0..6 {
            for j in 0..6 {
                assert!((kg[i][j] - kg[j][i]).abs() < 1e-10);
            }
        }
    }

    #[test]
    fn test_green_lagrange_strain_no_deformation() {
        let f = [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]];
        let e = TotalLagrangian::green_lagrange_strain(&f);

        // No deformation -> zero strain
        for i in 0..3 {
            for j in 0..3 {
                assert!((e[i][j]).abs() < 1e-10);
            }
        }
    }

    #[test]
    fn test_green_lagrange_strain_uniaxial() {
        // 10% stretch in x-direction
        let f = [[1.1, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]];
        let e = TotalLagrangian::green_lagrange_strain(&f);

        // E_xx = 0.5 * (1.1^2 - 1) = 0.105
        assert!((e[0][0] - 0.105).abs() < 1e-10);
        assert!((e[1][1]).abs() < 1e-10);
        assert!((e[2][2]).abs() < 1e-10);
    }

    #[test]
    fn test_p_delta_amplification() {
        let p = 100.0;    // Gravity load
        let pe = 500.0;   // Euler load

        let b2 = PDeltaAnalysis::amplification_factor(p, pe);

        // B2 = 1 / (1 - 100/500) = 1 / 0.8 = 1.25
        assert!((b2 - 1.25).abs() < 1e-10);
    }

    #[test]
    fn test_perpendicular_vector() {
        let v = [1.0, 0.0, 0.0];
        let perp = perpendicular_vector(v);

        // Should be perpendicular
        let dot: f64 = v.iter().zip(perp.iter()).map(|(a, b)| a * b).sum();
        assert!(dot.abs() < 1e-10);

        // Should be unit vector
        let norm = (perp[0].powi(2) + perp[1].powi(2) + perp[2].powi(2)).sqrt();
        assert!((norm - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_cross_product() {
        let a = [1.0, 0.0, 0.0];
        let b = [0.0, 1.0, 0.0];
        let c = cross_product(a, b);

        assert!((c[0] - 0.0).abs() < 1e-10);
        assert!((c[1] - 0.0).abs() < 1e-10);
        assert!((c[2] - 1.0).abs() < 1e-10);
    }
}
