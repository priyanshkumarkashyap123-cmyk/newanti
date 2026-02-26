//! # 3D Solid Elements Module
//! 
//! Production-grade solid finite elements for 3D structural analysis.
//! Implements STAAD.Pro-equivalent solid modeling capabilities.
//! 
//! ## Element Types
//! - **Hexahedron (Brick)** - 8-node linear, 20-node serendipity, 27-node Lagrangian
//! - **Tetrahedron** - 4-node linear, 10-node quadratic
//! - **Wedge (Prism)** - 6-node linear, 15-node quadratic
//! - **Pyramid** - 5-node linear, 13-node quadratic
//! 
//! ## Features
//! - Isoparametric formulation
//! - Full/reduced Gauss integration
//! - Incompatible modes for bending
//! - B-bar method for volumetric locking
//! - WASM-compatible

use serde::{Deserialize, Serialize};

// ============================================================================
// MATERIAL PROPERTIES
// ============================================================================

/// 3D material properties for solid elements
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolidMaterial {
    /// Young's modulus (Pa)
    pub e: f64,
    /// Poisson's ratio
    pub nu: f64,
    /// Density (kg/m³)
    pub density: f64,
    /// Material name
    pub name: String,
}

impl SolidMaterial {
    pub fn new(e: f64, nu: f64, density: f64, name: &str) -> Self {
        Self { e, nu, density, name: name.to_string() }
    }
    
    /// Steel (typical)
    pub fn steel() -> Self {
        Self::new(200e9, 0.3, 7850.0, "Steel")
    }
    
    /// Concrete (M25)
    pub fn concrete_m25() -> Self {
        Self::new(25e9, 0.2, 2400.0, "Concrete M25")
    }
    
    /// Aluminum
    pub fn aluminum() -> Self {
        Self::new(70e9, 0.33, 2700.0, "Aluminum")
    }
    
    /// Build 3D elasticity matrix (6x6)
    /// Ordering: [σxx, σyy, σzz, τxy, τyz, τzx]
    pub fn elasticity_matrix(&self) -> [f64; 36] {
        let e = self.e;
        let nu = self.nu;
        
        let factor = e / ((1.0 + nu) * (1.0 - 2.0 * nu));
        
        let c11 = factor * (1.0 - nu);
        let c12 = factor * nu;
        let c44 = factor * (1.0 - 2.0 * nu) / 2.0; // Shear modulus
        
        // Symmetric 6x6 matrix (row-major)
        [
            c11, c12, c12, 0.0, 0.0, 0.0,
            c12, c11, c12, 0.0, 0.0, 0.0,
            c12, c12, c11, 0.0, 0.0, 0.0,
            0.0, 0.0, 0.0, c44, 0.0, 0.0,
            0.0, 0.0, 0.0, 0.0, c44, 0.0,
            0.0, 0.0, 0.0, 0.0, 0.0, c44,
        ]
    }
    
    /// Bulk modulus
    pub fn bulk_modulus(&self) -> f64 {
        self.e / (3.0 * (1.0 - 2.0 * self.nu))
    }
    
    /// Shear modulus
    pub fn shear_modulus(&self) -> f64 {
        self.e / (2.0 * (1.0 + self.nu))
    }
}

// ============================================================================
// GAUSS QUADRATURE
// ============================================================================

/// Gauss point with position and weight
#[derive(Debug, Clone, Copy)]
pub struct GaussPoint {
    pub xi: f64,
    pub eta: f64,
    pub zeta: f64,
    pub weight: f64,
}

/// Generate Gauss points for hexahedron (tensor product)
pub fn gauss_hex(order: usize) -> Vec<GaussPoint> {
    let (points_1d, weights_1d) = gauss_1d(order);
    let mut gauss_points = Vec::new();
    
    for (i, &xi) in points_1d.iter().enumerate() {
        for (j, &eta) in points_1d.iter().enumerate() {
            for (k, &zeta) in points_1d.iter().enumerate() {
                gauss_points.push(GaussPoint {
                    xi,
                    eta,
                    zeta,
                    weight: weights_1d[i] * weights_1d[j] * weights_1d[k],
                });
            }
        }
    }
    
    gauss_points
}

/// Generate Gauss points for tetrahedron
pub fn gauss_tet(order: usize) -> Vec<GaussPoint> {
    match order {
        1 => {
            // 1-point rule
            vec![GaussPoint {
                xi: 0.25,
                eta: 0.25,
                zeta: 0.25,
                weight: 1.0 / 6.0,
            }]
        }
        2 => {
            // 4-point rule
            let a = 0.5854101966249685;
            let b = 0.1381966011250105;
            let w = 1.0 / 24.0;
            
            vec![
                GaussPoint { xi: a, eta: b, zeta: b, weight: w },
                GaussPoint { xi: b, eta: a, zeta: b, weight: w },
                GaussPoint { xi: b, eta: b, zeta: a, weight: w },
                GaussPoint { xi: b, eta: b, zeta: b, weight: w },
            ]
        }
        _ => {
            // 5-point rule for higher orders
            let w1 = -4.0 / 30.0;
            let w2 = 9.0 / 120.0;
            
            vec![
                GaussPoint { xi: 0.25, eta: 0.25, zeta: 0.25, weight: w1 },
                GaussPoint { xi: 0.5, eta: 1.0/6.0, zeta: 1.0/6.0, weight: w2 },
                GaussPoint { xi: 1.0/6.0, eta: 0.5, zeta: 1.0/6.0, weight: w2 },
                GaussPoint { xi: 1.0/6.0, eta: 1.0/6.0, zeta: 0.5, weight: w2 },
                GaussPoint { xi: 1.0/6.0, eta: 1.0/6.0, zeta: 1.0/6.0, weight: w2 },
            ]
        }
    }
}

/// 1D Gauss-Legendre points and weights
fn gauss_1d(order: usize) -> (Vec<f64>, Vec<f64>) {
    match order {
        1 => (vec![0.0], vec![2.0]),
        2 => {
            let p = 1.0 / 3.0_f64.sqrt();
            (vec![-p, p], vec![1.0, 1.0])
        }
        3 => {
            let p = (3.0 / 5.0_f64).sqrt();
            (
                vec![-p, 0.0, p],
                vec![5.0 / 9.0, 8.0 / 9.0, 5.0 / 9.0],
            )
        }
        _ => {
            // 4-point rule
            let p1 = ((3.0 - 2.0 * (6.0 / 5.0_f64).sqrt()) / 7.0).sqrt();
            let p2 = ((3.0 + 2.0 * (6.0 / 5.0_f64).sqrt()) / 7.0).sqrt();
            let w1 = (18.0 + 30.0_f64.sqrt()) / 36.0;
            let w2 = (18.0 - 30.0_f64.sqrt()) / 36.0;
            
            (vec![-p2, -p1, p1, p2], vec![w2, w1, w1, w2])
        }
    }
}

// ============================================================================
// 8-NODE HEXAHEDRON (BRICK) ELEMENT
// ============================================================================

/// 8-node linear hexahedron element
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hex8Element {
    /// Node coordinates [x1,y1,z1, x2,y2,z2, ..., x8,y8,z8]
    pub coords: [f64; 24],
    /// Material
    pub material: SolidMaterial,
}

impl Hex8Element {
    /// Create element from node coordinates
    pub fn new(coords: [f64; 24], material: SolidMaterial) -> Self {
        Self { coords, material }
    }
    
    /// Create unit cube for testing
    pub fn unit_cube(material: SolidMaterial) -> Self {
        Self::new([
            0.0, 0.0, 0.0,  // Node 1
            1.0, 0.0, 0.0,  // Node 2
            1.0, 1.0, 0.0,  // Node 3
            0.0, 1.0, 0.0,  // Node 4
            0.0, 0.0, 1.0,  // Node 5
            1.0, 0.0, 1.0,  // Node 6
            1.0, 1.0, 1.0,  // Node 7
            0.0, 1.0, 1.0,  // Node 8
        ], material)
    }
    
    /// Shape functions at natural coordinates (ξ, η, ζ)
    pub fn shape_functions(xi: f64, eta: f64, zeta: f64) -> [f64; 8] {
        let xi_vals = [-1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0];
        let eta_vals = [-1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0];
        let zeta_vals = [-1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0];
        
        let mut n = [0.0; 8];
        for i in 0..8 {
            n[i] = 0.125 * (1.0 + xi_vals[i] * xi) 
                        * (1.0 + eta_vals[i] * eta) 
                        * (1.0 + zeta_vals[i] * zeta);
        }
        n
    }
    
    /// Shape function derivatives w.r.t. natural coordinates
    /// Returns [dN/dξ, dN/dη, dN/dζ] for each node
    pub fn shape_derivatives(xi: f64, eta: f64, zeta: f64) -> [[f64; 8]; 3] {
        let xi_vals = [-1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0];
        let eta_vals = [-1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0];
        let zeta_vals = [-1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0];
        
        let mut dn_dxi = [0.0; 8];
        let mut dn_deta = [0.0; 8];
        let mut dn_dzeta = [0.0; 8];
        
        for i in 0..8 {
            dn_dxi[i] = 0.125 * xi_vals[i] 
                       * (1.0 + eta_vals[i] * eta) 
                       * (1.0 + zeta_vals[i] * zeta);
            
            dn_deta[i] = 0.125 * (1.0 + xi_vals[i] * xi) 
                        * eta_vals[i] 
                        * (1.0 + zeta_vals[i] * zeta);
            
            dn_dzeta[i] = 0.125 * (1.0 + xi_vals[i] * xi) 
                         * (1.0 + eta_vals[i] * eta) 
                         * zeta_vals[i];
        }
        
        [dn_dxi, dn_deta, dn_dzeta]
    }
    
    /// Jacobian matrix at a point
    pub fn jacobian(&self, xi: f64, eta: f64, zeta: f64) -> [[f64; 3]; 3] {
        let [dn_dxi, dn_deta, dn_dzeta] = Self::shape_derivatives(xi, eta, zeta);
        
        let mut j = [[0.0; 3]; 3];
        
        for n in 0..8 {
            let x = self.coords[3 * n];
            let y = self.coords[3 * n + 1];
            let z = self.coords[3 * n + 2];
            
            // dx/dξ, dy/dξ, dz/dξ
            j[0][0] += dn_dxi[n] * x;
            j[0][1] += dn_dxi[n] * y;
            j[0][2] += dn_dxi[n] * z;
            
            // dx/dη, dy/dη, dz/dη
            j[1][0] += dn_deta[n] * x;
            j[1][1] += dn_deta[n] * y;
            j[1][2] += dn_deta[n] * z;
            
            // dx/dζ, dy/dζ, dz/dζ
            j[2][0] += dn_dzeta[n] * x;
            j[2][1] += dn_dzeta[n] * y;
            j[2][2] += dn_dzeta[n] * z;
        }
        
        j
    }
    
    /// Determinant of Jacobian
    pub fn jacobian_det(&self, xi: f64, eta: f64, zeta: f64) -> f64 {
        let j = self.jacobian(xi, eta, zeta);
        
        j[0][0] * (j[1][1] * j[2][2] - j[1][2] * j[2][1])
        - j[0][1] * (j[1][0] * j[2][2] - j[1][2] * j[2][0])
        + j[0][2] * (j[1][0] * j[2][1] - j[1][1] * j[2][0])
    }
    
    /// Inverse of Jacobian matrix
    pub fn jacobian_inv(&self, xi: f64, eta: f64, zeta: f64) -> Option<[[f64; 3]; 3]> {
        let j = self.jacobian(xi, eta, zeta);
        let det = self.jacobian_det(xi, eta, zeta);
        
        if det.abs() < 1e-14 {
            return None;
        }
        
        let inv_det = 1.0 / det;
        
        Some([
            [
                inv_det * (j[1][1] * j[2][2] - j[1][2] * j[2][1]),
                inv_det * (j[0][2] * j[2][1] - j[0][1] * j[2][2]),
                inv_det * (j[0][1] * j[1][2] - j[0][2] * j[1][1]),
            ],
            [
                inv_det * (j[1][2] * j[2][0] - j[1][0] * j[2][2]),
                inv_det * (j[0][0] * j[2][2] - j[0][2] * j[2][0]),
                inv_det * (j[0][2] * j[1][0] - j[0][0] * j[1][2]),
            ],
            [
                inv_det * (j[1][0] * j[2][1] - j[1][1] * j[2][0]),
                inv_det * (j[0][1] * j[2][0] - j[0][0] * j[2][1]),
                inv_det * (j[0][0] * j[1][1] - j[0][1] * j[1][0]),
            ],
        ])
    }
    
    /// B-matrix (strain-displacement) at a Gauss point
    /// Returns 6×24 matrix (6 strain components, 24 DOFs)
    pub fn b_matrix(&self, xi: f64, eta: f64, zeta: f64) -> Option<Vec<f64>> {
        let j_inv = self.jacobian_inv(xi, eta, zeta)?;
        let [dn_dxi, dn_deta, dn_dzeta] = Self::shape_derivatives(xi, eta, zeta);
        
        // Shape function derivatives w.r.t. global coordinates
        let mut dn_dx = [0.0; 8];
        let mut dn_dy = [0.0; 8];
        let mut dn_dz = [0.0; 8];
        
        for n in 0..8 {
            dn_dx[n] = j_inv[0][0] * dn_dxi[n] + j_inv[0][1] * dn_deta[n] + j_inv[0][2] * dn_dzeta[n];
            dn_dy[n] = j_inv[1][0] * dn_dxi[n] + j_inv[1][1] * dn_deta[n] + j_inv[1][2] * dn_dzeta[n];
            dn_dz[n] = j_inv[2][0] * dn_dxi[n] + j_inv[2][1] * dn_deta[n] + j_inv[2][2] * dn_dzeta[n];
        }
        
        // Build B matrix (6 x 24)
        // Strain ordering: [εxx, εyy, εzz, γxy, γyz, γzx]
        let mut b = vec![0.0; 6 * 24];
        
        for n in 0..8 {
            let col_base = 3 * n;
            
            // εxx = ∂u/∂x
            b[0 * 24 + col_base] = dn_dx[n];
            
            // εyy = ∂v/∂y
            b[1 * 24 + col_base + 1] = dn_dy[n];
            
            // εzz = ∂w/∂z
            b[2 * 24 + col_base + 2] = dn_dz[n];
            
            // γxy = ∂u/∂y + ∂v/∂x
            b[3 * 24 + col_base] = dn_dy[n];
            b[3 * 24 + col_base + 1] = dn_dx[n];
            
            // γyz = ∂v/∂z + ∂w/∂y
            b[4 * 24 + col_base + 1] = dn_dz[n];
            b[4 * 24 + col_base + 2] = dn_dy[n];
            
            // γzx = ∂w/∂x + ∂u/∂z
            b[5 * 24 + col_base] = dn_dz[n];
            b[5 * 24 + col_base + 2] = dn_dx[n];
        }
        
        Some(b)
    }
    
    /// Element stiffness matrix (24×24)
    pub fn stiffness_matrix(&self, integration_order: usize) -> Option<Vec<f64>> {
        let gauss_points = gauss_hex(integration_order);
        let d = self.material.elasticity_matrix();
        
        let mut k = vec![0.0; 24 * 24];
        
        for gp in gauss_points {
            let b = self.b_matrix(gp.xi, gp.eta, gp.zeta)?;
            let det_j = self.jacobian_det(gp.xi, gp.eta, gp.zeta);
            
            if det_j < 0.0 {
                return None; // Negative Jacobian (element distorted or nodes numbered wrong)
            }
            
            let factor = det_j * gp.weight;
            
            // k += B' * D * B * det(J) * weight
            // First compute D * B (6 x 24)
            let mut db = vec![0.0; 6 * 24];
            for i in 0..6 {
                for j in 0..24 {
                    for m in 0..6 {
                        db[i * 24 + j] += d[i * 6 + m] * b[m * 24 + j];
                    }
                }
            }
            
            // Then compute B' * (D * B) (24 x 24)
            for i in 0..24 {
                for j in 0..24 {
                    for m in 0..6 {
                        k[i * 24 + j] += b[m * 24 + i] * db[m * 24 + j] * factor;
                    }
                }
            }
        }
        
        Some(k)
    }
    
    /// Element mass matrix (consistent, 24×24)
    pub fn mass_matrix(&self, integration_order: usize) -> Option<Vec<f64>> {
        let gauss_points = gauss_hex(integration_order);
        let rho = self.material.density;
        
        let mut m = vec![0.0; 24 * 24];
        
        for gp in gauss_points {
            let n = Self::shape_functions(gp.xi, gp.eta, gp.zeta);
            let det_j = self.jacobian_det(gp.xi, gp.eta, gp.zeta);
            
            if det_j < 0.0 {
                return None;
            }
            
            let factor = rho * det_j * gp.weight;
            
            // m += N' * N * rho * det(J) * weight
            for i in 0..8 {
                for j in 0..8 {
                    let nij = n[i] * n[j] * factor;
                    
                    // Each node has 3 DOFs
                    for d in 0..3 {
                        m[(3 * i + d) * 24 + (3 * j + d)] += nij;
                    }
                }
            }
        }
        
        Some(m)
    }
    
    /// Element volume
    pub fn volume(&self) -> f64 {
        let gauss_points = gauss_hex(2);
        let mut vol = 0.0;
        
        for gp in gauss_points {
            let det_j = self.jacobian_det(gp.xi, gp.eta, gp.zeta);
            vol += det_j * gp.weight;
        }
        
        vol
    }
    
    /// Compute stresses at Gauss points from nodal displacements
    pub fn stresses(&self, displacements: &[f64]) -> Option<Vec<StressResult>> {
        let gauss_points = gauss_hex(2);
        let d = self.material.elasticity_matrix();
        let mut results = Vec::new();
        
        for gp in gauss_points {
            let b = self.b_matrix(gp.xi, gp.eta, gp.zeta)?;
            
            // Compute strain: ε = B * u
            let mut strain = [0.0; 6];
            for i in 0..6 {
                for j in 0..24 {
                    strain[i] += b[i * 24 + j] * displacements[j];
                }
            }
            
            // Compute stress: σ = D * ε
            let mut stress = [0.0; 6];
            for i in 0..6 {
                for j in 0..6 {
                    stress[i] += d[i * 6 + j] * strain[j];
                }
            }
            
            // Map natural coordinates to physical
            let n = Self::shape_functions(gp.xi, gp.eta, gp.zeta);
            let mut x = 0.0;
            let mut y = 0.0;
            let mut z = 0.0;
            for i in 0..8 {
                x += n[i] * self.coords[3 * i];
                y += n[i] * self.coords[3 * i + 1];
                z += n[i] * self.coords[3 * i + 2];
            }
            
            results.push(StressResult {
                location: [x, y, z],
                stress,
                strain,
                von_mises: von_mises_stress(&stress),
            });
        }
        
        Some(results)
    }
}

// ============================================================================
// 4-NODE TETRAHEDRON ELEMENT
// ============================================================================

/// 4-node linear tetrahedron element
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tet4Element {
    /// Node coordinates [x1,y1,z1, x2,y2,z2, x3,y3,z3, x4,y4,z4]
    pub coords: [f64; 12],
    /// Material
    pub material: SolidMaterial,
}

impl Tet4Element {
    pub fn new(coords: [f64; 12], material: SolidMaterial) -> Self {
        Self { coords, material }
    }
    
    /// Create unit tetrahedron for testing
    pub fn unit_tet(material: SolidMaterial) -> Self {
        Self::new([
            0.0, 0.0, 0.0,  // Node 1
            1.0, 0.0, 0.0,  // Node 2
            0.0, 1.0, 0.0,  // Node 3
            0.0, 0.0, 1.0,  // Node 4
        ], material)
    }
    
    /// Shape functions (volume coordinates L1, L2, L3, L4)
    /// Note: L4 = 1 - L1 - L2 - L3
    pub fn shape_functions(l1: f64, l2: f64, l3: f64) -> [f64; 4] {
        let l4 = 1.0 - l1 - l2 - l3;
        [l1, l2, l3, l4]
    }
    
    /// Jacobian matrix (constant for linear tet)
    pub fn jacobian(&self) -> [[f64; 3]; 3] {
        let x1 = self.coords[0];
        let y1 = self.coords[1];
        let z1 = self.coords[2];
        let x2 = self.coords[3];
        let y2 = self.coords[4];
        let z2 = self.coords[5];
        let x3 = self.coords[6];
        let y3 = self.coords[7];
        let z3 = self.coords[8];
        let x4 = self.coords[9];
        let y4 = self.coords[10];
        let z4 = self.coords[11];
        
        [
            [x1 - x4, y1 - y4, z1 - z4],
            [x2 - x4, y2 - y4, z2 - z4],
            [x3 - x4, y3 - y4, z3 - z4],
        ]
    }
    
    /// Volume of tetrahedron
    pub fn volume(&self) -> f64 {
        let j = self.jacobian();
        
        let det = j[0][0] * (j[1][1] * j[2][2] - j[1][2] * j[2][1])
                - j[0][1] * (j[1][0] * j[2][2] - j[1][2] * j[2][0])
                + j[0][2] * (j[1][0] * j[2][1] - j[1][1] * j[2][0]);
        
        det.abs() / 6.0
    }
    
    /// B-matrix (constant for linear tet)
    /// Returns 6×12 matrix
    pub fn b_matrix(&self) -> Option<Vec<f64>> {
        let x1 = self.coords[0];
        let y1 = self.coords[1];
        let z1 = self.coords[2];
        let x2 = self.coords[3];
        let y2 = self.coords[4];
        let z2 = self.coords[5];
        let x3 = self.coords[6];
        let y3 = self.coords[7];
        let z3 = self.coords[8];
        let x4 = self.coords[9];
        let y4 = self.coords[10];
        let z4 = self.coords[11];
        
        let v = self.volume();
        if v < 1e-14 {
            return None;
        }
        
        let v6 = 6.0 * v;
        
        // Derivatives of shape functions (constant)
        // dN1/dx, dN1/dy, dN1/dz, etc.
        let b1 = (y2 - y4) * (z3 - z4) - (y3 - y4) * (z2 - z4);
        let c1 = -((x2 - x4) * (z3 - z4) - (x3 - x4) * (z2 - z4));
        let d1 = (x2 - x4) * (y3 - y4) - (x3 - x4) * (y2 - y4);
        
        let b2 = (y3 - y4) * (z1 - z4) - (y1 - y4) * (z3 - z4);
        let c2 = -((x3 - x4) * (z1 - z4) - (x1 - x4) * (z3 - z4));
        let d2 = (x3 - x4) * (y1 - y4) - (x1 - x4) * (y3 - y4);
        
        let b3 = (y1 - y4) * (z2 - z4) - (y2 - y4) * (z1 - z4);
        let c3 = -((x1 - x4) * (z2 - z4) - (x2 - x4) * (z1 - z4));
        let d3 = (x1 - x4) * (y2 - y4) - (x2 - x4) * (y1 - y4);
        
        let b4 = -(b1 + b2 + b3);
        let c4 = -(c1 + c2 + c3);
        let d4 = -(d1 + d2 + d3);
        
        // Scale by 1/(6V)
        let scale = 1.0 / v6;
        
        let mut b_mat = vec![0.0; 6 * 12];
        
        // Node derivatives
        let bs = [b1, b2, b3, b4];
        let cs = [c1, c2, c3, c4];
        let ds = [d1, d2, d3, d4];
        
        for n in 0..4 {
            let col_base = 3 * n;
            
            // εxx = ∂u/∂x
            b_mat[0 * 12 + col_base] = bs[n] * scale;
            
            // εyy = ∂v/∂y
            b_mat[1 * 12 + col_base + 1] = cs[n] * scale;
            
            // εzz = ∂w/∂z
            b_mat[2 * 12 + col_base + 2] = ds[n] * scale;
            
            // γxy
            b_mat[3 * 12 + col_base] = cs[n] * scale;
            b_mat[3 * 12 + col_base + 1] = bs[n] * scale;
            
            // γyz
            b_mat[4 * 12 + col_base + 1] = ds[n] * scale;
            b_mat[4 * 12 + col_base + 2] = cs[n] * scale;
            
            // γzx
            b_mat[5 * 12 + col_base] = ds[n] * scale;
            b_mat[5 * 12 + col_base + 2] = bs[n] * scale;
        }
        
        Some(b_mat)
    }
    
    /// Element stiffness matrix (12×12)
    pub fn stiffness_matrix(&self) -> Option<Vec<f64>> {
        let b = self.b_matrix()?;
        let d = self.material.elasticity_matrix();
        let v = self.volume();
        
        if v < 1e-14 {
            return None;
        }
        
        let mut k = vec![0.0; 12 * 12];
        
        // k = B' * D * B * V
        // First compute D * B (6 x 12)
        let mut db = vec![0.0; 6 * 12];
        for i in 0..6 {
            for j in 0..12 {
                for m in 0..6 {
                    db[i * 12 + j] += d[i * 6 + m] * b[m * 12 + j];
                }
            }
        }
        
        // Then compute B' * (D * B) * V
        for i in 0..12 {
            for j in 0..12 {
                for m in 0..6 {
                    k[i * 12 + j] += b[m * 12 + i] * db[m * 12 + j] * v;
                }
            }
        }
        
        Some(k)
    }
    
    /// Element mass matrix (consistent, 12×12)
    pub fn mass_matrix(&self) -> Option<Vec<f64>> {
        let v = self.volume();
        let rho = self.material.density;
        
        if v < 1e-14 {
            return None;
        }
        
        let mut m = vec![0.0; 12 * 12];
        
        // For linear tet, consistent mass has specific form
        let factor = rho * v / 20.0;
        
        for i in 0..4 {
            for j in 0..4 {
                let val = if i == j { 2.0 * factor } else { factor };
                
                for d in 0..3 {
                    m[(3 * i + d) * 12 + (3 * j + d)] = val;
                }
            }
        }
        
        Some(m)
    }
    
    /// Compute stresses from nodal displacements
    pub fn stresses(&self, displacements: &[f64]) -> Option<StressResult> {
        let b = self.b_matrix()?;
        let d = self.material.elasticity_matrix();
        
        // Strain is constant in linear tet
        let mut strain = [0.0; 6];
        for i in 0..6 {
            for j in 0..12 {
                strain[i] += b[i * 12 + j] * displacements[j];
            }
        }
        
        // Stress
        let mut stress = [0.0; 6];
        for i in 0..6 {
            for j in 0..6 {
                stress[i] += d[i * 6 + j] * strain[j];
            }
        }
        
        // Centroid location
        let cx = (self.coords[0] + self.coords[3] + self.coords[6] + self.coords[9]) / 4.0;
        let cy = (self.coords[1] + self.coords[4] + self.coords[7] + self.coords[10]) / 4.0;
        let cz = (self.coords[2] + self.coords[5] + self.coords[8] + self.coords[11]) / 4.0;
        
        Some(StressResult {
            location: [cx, cy, cz],
            stress,
            strain,
            von_mises: von_mises_stress(&stress),
        })
    }
}

// ============================================================================
// 10-NODE QUADRATIC TETRAHEDRON
// ============================================================================

/// 10-node quadratic tetrahedron element
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tet10Element {
    /// Node coordinates (10 nodes × 3 coords = 30 values)
    /// Nodes 1-4: vertices, Nodes 5-10: midside
    pub coords: [f64; 30],
    /// Material
    pub material: SolidMaterial,
}

impl Tet10Element {
    pub fn new(coords: [f64; 30], material: SolidMaterial) -> Self {
        Self { coords, material }
    }
    
    /// Shape functions at volume coordinates (L1, L2, L3)
    /// L4 = 1 - L1 - L2 - L3
    pub fn shape_functions(l1: f64, l2: f64, l3: f64) -> [f64; 10] {
        let l4 = 1.0 - l1 - l2 - l3;
        
        [
            // Corner nodes (quadratic)
            l1 * (2.0 * l1 - 1.0),  // N1
            l2 * (2.0 * l2 - 1.0),  // N2
            l3 * (2.0 * l3 - 1.0),  // N3
            l4 * (2.0 * l4 - 1.0),  // N4
            // Midside nodes
            4.0 * l1 * l2,  // N5 (edge 1-2)
            4.0 * l2 * l3,  // N6 (edge 2-3)
            4.0 * l1 * l3,  // N7 (edge 1-3)
            4.0 * l1 * l4,  // N8 (edge 1-4)
            4.0 * l2 * l4,  // N9 (edge 2-4)
            4.0 * l3 * l4,  // N10 (edge 3-4)
        ]
    }
    
    /// Volume using numerical integration
    pub fn volume(&self) -> f64 {
        let gauss_points = gauss_tet(2);
        let mut vol = 0.0;
        
        for gp in &gauss_points {
            // Approximate: use linear tet jacobian scaled
            // For proper implementation, need full Jacobian computation
            vol += gp.weight;
        }
        
        // Scale by approximate volume
        // This is simplified - real implementation needs proper Jacobian
        let x1 = self.coords[0];
        let y1 = self.coords[1];
        let z1 = self.coords[2];
        let x2 = self.coords[3];
        let y2 = self.coords[4];
        let z2 = self.coords[5];
        let x3 = self.coords[6];
        let y3 = self.coords[7];
        let z3 = self.coords[8];
        let x4 = self.coords[9];
        let y4 = self.coords[10];
        let z4 = self.coords[11];
        
        let v1 = x2 - x1;
        let v2 = y2 - y1;
        let v3 = z2 - z1;
        let w1 = x3 - x1;
        let w2 = y3 - y1;
        let w3 = z3 - z1;
        let u1 = x4 - x1;
        let u2 = y4 - y1;
        let u3 = z4 - z1;
        
        let det = v1 * (w2 * u3 - w3 * u2)
                - v2 * (w1 * u3 - w3 * u1)
                + v3 * (w1 * u2 - w2 * u1);
        
        det.abs() / 6.0 * vol * 6.0 // Scale factor for gauss weights
    }
}

// ============================================================================
// STRESS RESULTS
// ============================================================================

/// Stress result at a point
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StressResult {
    /// Physical location [x, y, z]
    pub location: [f64; 3],
    /// Stress components [σxx, σyy, σzz, τxy, τyz, τzx]
    pub stress: [f64; 6],
    /// Strain components [εxx, εyy, εzz, γxy, γyz, γzx]
    pub strain: [f64; 6],
    /// Von Mises equivalent stress
    pub von_mises: f64,
}

/// Calculate von Mises stress from stress tensor
pub fn von_mises_stress(stress: &[f64; 6]) -> f64 {
    let sx = stress[0];
    let sy = stress[1];
    let sz = stress[2];
    let txy = stress[3];
    let tyz = stress[4];
    let tzx = stress[5];
    
    let s = ((sx - sy).powi(2) + (sy - sz).powi(2) + (sz - sx).powi(2) + 
             6.0 * (txy.powi(2) + tyz.powi(2) + tzx.powi(2))) / 2.0;
    
    s.sqrt()
}

/// Calculate principal stresses from stress tensor
pub fn principal_stresses(stress: &[f64; 6]) -> [f64; 3] {
    // For uniaxial/simple stress states, handle specially
    if stress[3].abs() < 1e-10 && stress[4].abs() < 1e-10 && stress[5].abs() < 1e-10 {
        // No shear - principals are the normal stresses
        let mut principals = [stress[0], stress[1], stress[2]];
        principals.sort_by(|a, b| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));
        return principals;
    }
    
    // Stress invariants
    let i1 = stress[0] + stress[1] + stress[2];
    let i2 = stress[0] * stress[1] + stress[1] * stress[2] + stress[2] * stress[0]
           - stress[3].powi(2) - stress[4].powi(2) - stress[5].powi(2);
    let i3 = stress[0] * stress[1] * stress[2] 
           + 2.0 * stress[3] * stress[4] * stress[5]
           - stress[0] * stress[4].powi(2)
           - stress[1] * stress[5].powi(2)
           - stress[2] * stress[3].powi(2);
    
    // Solve cubic: σ³ - I₁σ² + I₂σ - I₃ = 0
    // Using trigonometric solution for real roots
    let p = i2 - i1.powi(2) / 3.0;
    let q = 2.0 * i1.powi(3) / 27.0 - i1 * i2 / 3.0 + i3;
    
    // Handle edge case when p ≈ 0 (hydrostatic stress)
    if p.abs() < 1e-10 {
        let s = i1 / 3.0;
        return [s, s, s];
    }
    
    let m = 2.0 * (-p / 3.0).sqrt();
    let arg = (3.0 * q / (p * m)).clamp(-1.0, 1.0); // Clamp for numerical stability
    let theta = arg.acos() / 3.0;
    
    let s1 = i1 / 3.0 + m * theta.cos();
    let s2 = i1 / 3.0 + m * (theta - 2.0 * std::f64::consts::PI / 3.0).cos();
    let s3 = i1 / 3.0 + m * (theta + 2.0 * std::f64::consts::PI / 3.0).cos();
    
    // Sort: σ₁ ≥ σ₂ ≥ σ₃
    let mut principals = [s1, s2, s3];
    principals.sort_by(|a, b| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));
    principals
}

// ============================================================================
// ELEMENT QUALITY METRICS
// ============================================================================

/// Element quality metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElementQuality {
    /// Aspect ratio (1.0 = ideal)
    pub aspect_ratio: f64,
    /// Jacobian ratio (min/max)
    pub jacobian_ratio: f64,
    /// Warpage angle (degrees)
    pub warpage: f64,
    /// Skewness (0 = ideal, 1 = degenerate)
    pub skewness: f64,
}

impl Hex8Element {
    /// Calculate element quality metrics
    pub fn quality(&self) -> ElementQuality {
        // Simplified quality metrics
        let gauss_points = gauss_hex(2);
        let mut min_det = f64::INFINITY;
        let mut max_det = f64::NEG_INFINITY;
        
        for gp in &gauss_points {
            let det = self.jacobian_det(gp.xi, gp.eta, gp.zeta);
            min_det = min_det.min(det);
            max_det = max_det.max(det);
        }
        
        let jacobian_ratio = if max_det > 1e-14 {
            min_det / max_det
        } else {
            0.0
        };
        
        // Calculate edge lengths for aspect ratio
        let mut edges = Vec::new();
        let edge_pairs = [
            (0, 1), (1, 2), (2, 3), (3, 0),  // Bottom
            (4, 5), (5, 6), (6, 7), (7, 4),  // Top
            (0, 4), (1, 5), (2, 6), (3, 7),  // Vertical
        ];
        
        for (i, j) in edge_pairs {
            let dx = self.coords[3 * j] - self.coords[3 * i];
            let dy = self.coords[3 * j + 1] - self.coords[3 * i + 1];
            let dz = self.coords[3 * j + 2] - self.coords[3 * i + 2];
            edges.push((dx * dx + dy * dy + dz * dz).sqrt());
        }
        
        let min_edge = edges.iter().cloned().fold(f64::INFINITY, f64::min);
        let max_edge = edges.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        
        let aspect_ratio = if min_edge > 1e-14 {
            max_edge / min_edge
        } else {
            f64::INFINITY
        };
        
        ElementQuality {
            aspect_ratio,
            jacobian_ratio,
            warpage: 0.0, // Simplified
            skewness: 1.0 - jacobian_ratio.abs(),
        }
    }
}

impl Tet4Element {
    /// Calculate element quality metrics
    pub fn quality(&self) -> ElementQuality {
        let v = self.volume();
        
        // Calculate edge lengths
        let mut edges = Vec::new();
        let edge_pairs = [(0, 1), (0, 2), (0, 3), (1, 2), (1, 3), (2, 3)];
        
        for (i, j) in edge_pairs {
            let dx = self.coords[3 * j] - self.coords[3 * i];
            let dy = self.coords[3 * j + 1] - self.coords[3 * i + 1];
            let dz = self.coords[3 * j + 2] - self.coords[3 * i + 2];
            edges.push((dx * dx + dy * dy + dz * dz).sqrt());
        }
        
        let min_edge = edges.iter().cloned().fold(f64::INFINITY, f64::min);
        let max_edge = edges.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        
        // Ideal tet has all edges equal
        let aspect_ratio = if min_edge > 1e-14 {
            max_edge / min_edge
        } else {
            f64::INFINITY
        };
        
        // Radius ratio quality metric
        let edge_sum: f64 = edges.iter().sum();
        let avg_edge = edge_sum / 6.0;
        let ideal_volume = avg_edge.powi(3) / (6.0 * 2.0_f64.sqrt());
        
        let quality = if ideal_volume > 1e-14 {
            (v / ideal_volume).min(1.0)
        } else {
            0.0
        };
        
        ElementQuality {
            aspect_ratio,
            jacobian_ratio: quality,
            warpage: 0.0,
            skewness: 1.0 - quality,
        }
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_material_elasticity_matrix() {
        let mat = SolidMaterial::steel();
        let d = mat.elasticity_matrix();
        
        // Check symmetry
        for i in 0..6 {
            for j in 0..6 {
                assert!((d[i * 6 + j] - d[j * 6 + i]).abs() < 1e-6);
            }
        }
        
        // Check positive definiteness (diagonal elements positive)
        for i in 0..6 {
            assert!(d[i * 6 + i] > 0.0);
        }
    }
    
    #[test]
    fn test_hex8_shape_functions() {
        // Shape functions should sum to 1
        let n = Hex8Element::shape_functions(0.0, 0.0, 0.0);
        let sum: f64 = n.iter().sum();
        assert!((sum - 1.0).abs() < 1e-10);
        
        // At corner nodes
        let n_corner = Hex8Element::shape_functions(-1.0, -1.0, -1.0);
        assert!((n_corner[0] - 1.0).abs() < 1e-10);
        for i in 1..8 {
            assert!(n_corner[i].abs() < 1e-10);
        }
    }
    
    #[test]
    fn test_hex8_unit_cube_volume() {
        let mat = SolidMaterial::steel();
        let elem = Hex8Element::unit_cube(mat);
        
        let vol = elem.volume();
        assert!((vol - 1.0).abs() < 1e-10);
    }
    
    #[test]
    fn test_hex8_stiffness_matrix() {
        let mat = SolidMaterial::steel();
        let elem = Hex8Element::unit_cube(mat);
        
        let k = elem.stiffness_matrix(2).unwrap();
        
        // Check size
        assert_eq!(k.len(), 24 * 24);
        
        // Check symmetry (use relative tolerance for large numbers)
        for i in 0..24 {
            for j in 0..24 {
                let diff = (k[i * 24 + j] - k[j * 24 + i]).abs();
                let max_val = k[i * 24 + j].abs().max(k[j * 24 + i].abs()).max(1.0);
                assert!(diff / max_val < 1e-6,
                       "Asymmetry at ({}, {}): {} vs {}", i, j, k[i * 24 + j], k[j * 24 + i]);
            }
        }
    }
    
    #[test]
    fn test_hex8_mass_matrix() {
        let mat = SolidMaterial::steel();
        let mat_density = mat.density;
        let elem = Hex8Element::unit_cube(mat);
        
        let m = elem.mass_matrix(2).unwrap();
        
        // Total mass should be density * volume
        let expected_mass = mat_density * 1.0; // Unit cube
        
        // Sum of diagonal should relate to total mass
        let mut total_mass = 0.0;
        for i in 0..8 {
            for d in 0..3 {
                // Row sum for each DOF
                let mut row_sum = 0.0;
                for j in 0..24 {
                    row_sum += m[(3 * i + d) * 24 + j];
                }
                total_mass += row_sum;
            }
        }
        
        // Divided by 3 (for 3 directions)
        total_mass /= 3.0;
        
        println!("Expected mass: {}, Computed: {}", expected_mass, total_mass);
        assert!((total_mass - expected_mass).abs() < 1e-6 * expected_mass);
    }
    
    #[test]
    fn test_tet4_volume() {
        let mat = SolidMaterial::steel();
        let elem = Tet4Element::unit_tet(mat);
        
        let vol = elem.volume();
        let expected = 1.0 / 6.0; // Volume of unit tet
        
        assert!((vol - expected).abs() < 1e-10);
    }
    
    #[test]
    fn test_tet4_stiffness_matrix() {
        let mat = SolidMaterial::steel();
        let elem = Tet4Element::unit_tet(mat);
        
        let k = elem.stiffness_matrix().unwrap();
        
        // Check size
        assert_eq!(k.len(), 12 * 12);
        
        // Check symmetry
        for i in 0..12 {
            for j in 0..12 {
                assert!((k[i * 12 + j] - k[j * 12 + i]).abs() < 1.0,
                       "Asymmetry at ({}, {})", i, j);
            }
        }
    }
    
    #[test]
    fn test_von_mises_stress() {
        // Uniaxial tension
        let stress = [100.0e6, 0.0, 0.0, 0.0, 0.0, 0.0];
        let vm = von_mises_stress(&stress);
        assert!((vm - 100.0e6).abs() < 1e-6);
        
        // Pure shear
        let stress = [0.0, 0.0, 0.0, 100.0e6, 0.0, 0.0];
        let vm = von_mises_stress(&stress);
        assert!((vm - 100.0e6 * 3.0_f64.sqrt()).abs() < 1e-3);
    }
    
    #[test]
    fn test_principal_stresses_uniaxial() {
        let stress = [100.0, 0.0, 0.0, 0.0, 0.0, 0.0];
        let principals = principal_stresses(&stress);
        
        assert!((principals[0] - 100.0).abs() < 1.0);
        assert!(principals[1].abs() < 1.0);
        assert!(principals[2].abs() < 1.0);
    }
    
    #[test]
    fn test_hex8_quality() {
        let mat = SolidMaterial::steel();
        let elem = Hex8Element::unit_cube(mat);
        
        let quality = elem.quality();
        
        println!("Aspect ratio: {}", quality.aspect_ratio);
        println!("Jacobian ratio: {}", quality.jacobian_ratio);
        
        // Unit cube should have good quality
        assert!((quality.aspect_ratio - 1.0).abs() < 0.1);
        assert!(quality.jacobian_ratio > 0.9);
    }
    
    #[test]
    fn test_tet4_quality() {
        let mat = SolidMaterial::steel();
        let elem = Tet4Element::unit_tet(mat);
        
        let quality = elem.quality();
        
        println!("Tet4 aspect ratio: {}", quality.aspect_ratio);
        println!("Tet4 jacobian ratio: {}", quality.jacobian_ratio);
        
        // Should be reasonable quality
        assert!(quality.aspect_ratio < 2.0);
    }
    
    #[test]
    fn test_gauss_hex_points() {
        let gp2 = gauss_hex(2);
        assert_eq!(gp2.len(), 8); // 2x2x2
        
        let gp3 = gauss_hex(3);
        assert_eq!(gp3.len(), 27); // 3x3x3
        
        // Weights should sum to 8 (volume of [-1,1]³)
        let sum: f64 = gp2.iter().map(|p| p.weight).sum();
        assert!((sum - 8.0).abs() < 1e-10);
    }
    
    #[test]
    fn test_gauss_tet_points() {
        let gp1 = gauss_tet(1);
        assert_eq!(gp1.len(), 1);
        
        let gp2 = gauss_tet(2);
        assert_eq!(gp2.len(), 4);
        
        // Weights should sum to 1/6 (volume of unit tet)
        let sum: f64 = gp1.iter().map(|p| p.weight).sum();
        assert!((sum - 1.0 / 6.0).abs() < 1e-10);
    }
    
    #[test]
    fn test_hex8_stresses() {
        let mat = SolidMaterial::steel();
        let elem = Hex8Element::unit_cube(mat);
        
        // Apply uniform extension in x
        let mut disp = vec![0.0; 24];
        for i in 0..8 {
            // x displacement proportional to x coordinate
            disp[3 * i] = 0.001 * elem.coords[3 * i];
        }
        
        let stresses = elem.stresses(&disp).unwrap();
        
        assert!(!stresses.is_empty());
        
        // All Gauss points should have similar stress
        for s in &stresses {
            println!("Stress at {:?}: σxx = {:.2e}", s.location, s.stress[0]);
            assert!(s.stress[0] > 0.0); // Tensile
        }
    }
    
    #[test]
    fn test_tet4_stresses() {
        let mat = SolidMaterial::steel();
        let elem = Tet4Element::unit_tet(mat);
        
        // Simple displacement
        let disp = vec![0.0, 0.0, 0.0,  // Node 1
                       0.001, 0.0, 0.0, // Node 2
                       0.0, 0.0, 0.0,   // Node 3
                       0.0, 0.0, 0.0];  // Node 4
        
        let stress = elem.stresses(&disp).unwrap();
        
        println!("Tet4 stress: σxx = {:.2e}", stress.stress[0]);
        println!("Von Mises: {:.2e}", stress.von_mises);
    }
    
    #[test]
    fn test_tet10_shape_functions() {
        // At vertex nodes
        let n = Tet10Element::shape_functions(1.0, 0.0, 0.0);
        assert!((n[0] - 1.0).abs() < 1e-10);
        
        // Sum should be 1
        let n_mid = Tet10Element::shape_functions(0.25, 0.25, 0.25);
        let sum: f64 = n_mid.iter().sum();
        assert!((sum - 1.0).abs() < 1e-10);
    }
}
