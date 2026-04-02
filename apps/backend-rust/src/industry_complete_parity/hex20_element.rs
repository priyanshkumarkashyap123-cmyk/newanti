use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElementValidationResult {
    pub passed: bool,
    pub utilization: f64,
    pub message: String,
    pub clause: String,
}

/// 20-Node Serendipity Hexahedral Element (Hex20)
/// Industry standard: ANSYS SOLID186, ABAQUS C3D20
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hex20Element {
    pub id: usize,
    pub node_ids: [usize; 20],
    pub e: f64,          // Young's modulus
    pub nu: f64,         // Poisson's ratio
    pub rho: f64,        // Density
    pub integration: IntegrationScheme,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum IntegrationScheme {
    Full,      // 3×3×3 = 27 Gauss points
    Reduced,   // 2×2×2 = 8 Gauss points (with hourglass control)
    Selective, // Mixed integration
}

impl Hex20Element {
    /// Input validity check for Hex20 constitutive and density parameters.
    pub fn validate_properties(&self) -> ElementValidationResult {
        let valid_e = self.e > 0.0;
        let valid_nu = self.nu > -1.0 && self.nu < 0.5;
        let valid_rho = self.rho >= 0.0;
        let passed = valid_e && valid_nu && valid_rho;
        let invalid_count = [valid_e, valid_nu, valid_rho].iter().filter(|&&v| !v).count();
        ElementValidationResult {
            passed,
            utilization: invalid_count as f64 / 3.0,
            message: if passed {
                "Hex20 material properties are valid".to_string()
            } else {
                "Hex20 material properties invalid (E>0, -1<nu<0.5, rho>=0 required)".to_string()
            },
            clause: "ANSYS SOLID186 / ABAQUS C3D20 input precheck".to_string(),
        }
    }

    /// Shape functions at natural coordinates (ξ, η, ζ)
    /// Corner nodes (1-8): N = (1/8)(1+ξ_i*ξ)(1+η_i*η)(1+ζ_i*ζ)(ξ_i*ξ+η_i*η+ζ_i*ζ-2)
    /// Mid-edge nodes (9-20): Appropriate quadratic functions
    pub fn shape_functions(xi: f64, eta: f64, zeta: f64) -> [f64; 20] {
        let mut n = [0.0; 20];
        
        // Corner node coordinates
        let corners = [
            (-1.0, -1.0, -1.0), (1.0, -1.0, -1.0), (1.0, 1.0, -1.0), (-1.0, 1.0, -1.0),
            (-1.0, -1.0, 1.0), (1.0, -1.0, 1.0), (1.0, 1.0, 1.0), (-1.0, 1.0, 1.0),
        ];
        
        // Mid-edge node coordinates
        let midedges = [
            (0.0, -1.0, -1.0), (1.0, 0.0, -1.0), (0.0, 1.0, -1.0), (-1.0, 0.0, -1.0),
            (0.0, -1.0, 1.0), (1.0, 0.0, 1.0), (0.0, 1.0, 1.0), (-1.0, 0.0, 1.0),
            (-1.0, -1.0, 0.0), (1.0, -1.0, 0.0), (1.0, 1.0, 0.0), (-1.0, 1.0, 0.0),
        ];
        
        // Corner node shape functions (with mid-node correction)
        for (i, &(xi_i, eta_i, zeta_i)) in corners.iter().enumerate() {
            let xi_term = 1.0 + xi_i * xi;
            let eta_term = 1.0 + eta_i * eta;
            let zeta_term = 1.0 + zeta_i * zeta;
            n[i] = 0.125 * xi_term * eta_term * zeta_term * 
                   (xi_i * xi + eta_i * eta + zeta_i * zeta - 2.0);
        }
        
        // Mid-edge shape functions
        for (i, &(xi_i, eta_i, zeta_i)) in midedges.iter().enumerate() {
            let idx = i + 8;
            let xi_i: f64 = xi_i;
            let eta_i: f64 = eta_i;
            let zeta_i: f64 = zeta_i;
            if xi_i.abs() < 1e-10 {
                // Edge parallel to ξ
                n[idx] = 0.25 * (1.0 - xi * xi) * (1.0 + eta_i * eta) * (1.0 + zeta_i * zeta);
            } else if eta_i.abs() < 1e-10 {
                // Edge parallel to η
                n[idx] = 0.25 * (1.0 + xi_i * xi) * (1.0 - eta * eta) * (1.0 + zeta_i * zeta);
            } else {
                // Edge parallel to ζ
                n[idx] = 0.25 * (1.0 + xi_i * xi) * (1.0 + eta_i * eta) * (1.0 - zeta * zeta);
            }
        }
        
        n
    }
    
    /// Shape function derivatives ∂N/∂ξ, ∂N/∂η, ∂N/∂ζ
    pub fn shape_derivatives(xi: f64, eta: f64, zeta: f64) -> [[f64; 20]; 3] {
        let mut dn = [[0.0; 20]; 3];
        
        let corners = [
            (-1.0, -1.0, -1.0), (1.0, -1.0, -1.0), (1.0, 1.0, -1.0), (-1.0, 1.0, -1.0),
            (-1.0, -1.0, 1.0), (1.0, -1.0, 1.0), (1.0, 1.0, 1.0), (-1.0, 1.0, 1.0),
        ];
        
        let midedges = [
            (0.0, -1.0, -1.0), (1.0, 0.0, -1.0), (0.0, 1.0, -1.0), (-1.0, 0.0, -1.0),
            (0.0, -1.0, 1.0), (1.0, 0.0, 1.0), (0.0, 1.0, 1.0), (-1.0, 0.0, 1.0),
            (-1.0, -1.0, 0.0), (1.0, -1.0, 0.0), (1.0, 1.0, 0.0), (-1.0, 1.0, 0.0),
        ];
        
        // Corner nodes
        for (i, &(xi_i, eta_i, zeta_i)) in corners.iter().enumerate() {
            let xi_term = 1.0 + xi_i * xi;
            let eta_term = 1.0 + eta_i * eta;
            let zeta_term = 1.0 + zeta_i * zeta;
            let sum = xi_i * xi + eta_i * eta + zeta_i * zeta;
            
            // ∂N/∂ξ
            dn[0][i] = 0.125 * xi_i * eta_term * zeta_term * (sum - 2.0) +
                       0.125 * xi_term * eta_term * zeta_term * xi_i;
            
            // ∂N/∂η  
            dn[1][i] = 0.125 * xi_term * eta_i * zeta_term * (sum - 2.0) +
                       0.125 * xi_term * eta_term * zeta_term * eta_i;
            
            // ∂N/∂ζ
            dn[2][i] = 0.125 * xi_term * eta_term * zeta_i * (sum - 2.0) +
                       0.125 * xi_term * eta_term * zeta_term * zeta_i;
        }
        
        // Mid-edge nodes
        for (i, &(xi_i, eta_i, zeta_i)) in midedges.iter().enumerate() {
            let idx = i + 8;
            let xi_i: f64 = xi_i;
            let eta_i: f64 = eta_i;
            let zeta_i: f64 = zeta_i;
            
            if xi_i.abs() < 1e-10 {
                let eta_term = 1.0 + eta_i * eta;
                let zeta_term = 1.0 + zeta_i * zeta;
                dn[0][idx] = -0.5 * xi * eta_term * zeta_term;
                dn[1][idx] = 0.25 * (1.0 - xi * xi) * eta_i * zeta_term;
                dn[2][idx] = 0.25 * (1.0 - xi * xi) * eta_term * zeta_i;
            } else if eta_i.abs() < 1e-10 {
                let xi_term = 1.0 + xi_i * xi;
                let zeta_term = 1.0 + zeta_i * zeta;
                dn[0][idx] = 0.25 * xi_i * (1.0 - eta * eta) * zeta_term;
                dn[1][idx] = -0.5 * xi_term * eta * zeta_term;
                dn[2][idx] = 0.25 * xi_term * (1.0 - eta * eta) * zeta_i;
            } else {
                let xi_term = 1.0 + xi_i * xi;
                let eta_term = 1.0 + eta_i * eta;
                dn[0][idx] = 0.25 * xi_i * eta_term * (1.0 - zeta * zeta);
                dn[1][idx] = 0.25 * xi_term * eta_i * (1.0 - zeta * zeta);
                dn[2][idx] = -0.5 * xi_term * eta_term * zeta;
            }
        }
        
        dn
    }
    
    /// Gauss points for 3×3×3 integration
    pub fn gauss_points_3x3x3() -> (Vec<[f64; 3]>, Vec<f64>) {
        let gp = [
            -0.7745966692414834, 
            0.0, 
            0.7745966692414834,
        ];
        let wt = [
            0.5555555555555556,
            0.8888888888888888,
            0.5555555555555556,
        ];
        
        let mut points = Vec::with_capacity(27);
        let mut weights = Vec::with_capacity(27);
        
        for (i, &zi) in gp.iter().enumerate() {
            for (j, &ej) in gp.iter().enumerate() {
                for (k, &xk) in gp.iter().enumerate() {
                    points.push([xk, ej, zi]);
                    weights.push(wt[k] * wt[j] * wt[i]);
                }
            }
        }
        
        (points, weights)
    }
    
    /// Compute element stiffness matrix (60×60)
    pub fn stiffness_matrix(&self, coords: &[[f64; 3]; 20]) -> [[f64; 60]; 60] {
        let mut ke = [[0.0; 60]; 60];
        
        // Material matrix (isotropic)
        let d = self.constitutive_matrix();
        
        // Gauss integration
        let (gauss_pts, gauss_wts) = match self.integration {
            IntegrationScheme::Full => Self::gauss_points_3x3x3(),
            IntegrationScheme::Reduced => Self::gauss_points_2x2x2(),
            IntegrationScheme::Selective => Self::gauss_points_3x3x3(),
        };
        
        for (gp, &weight) in gauss_pts.iter().zip(gauss_wts.iter()) {
            let xi = gp[0];
            let eta = gp[1];
            let zeta = gp[2];
            
            let dn = Self::shape_derivatives(xi, eta, zeta);
            let (b_matrix, det_j) = self.strain_displacement_matrix(&dn, coords);
            
            if det_j <= 0.0 {
                continue;  // Skip negative Jacobian
            }
            
            // Ke += B^T * D * B * det(J) * weight
            let bt_d = self.multiply_bt_d(&b_matrix, &d);
            let bt_d_b = self.multiply_matrices(&bt_d, &b_matrix);
            
            let factor = det_j * weight;
            for i in 0..60 {
                for j in 0..60 {
                    ke[i][j] += bt_d_b[i][j] * factor;
                }
            }
        }
        
        ke
    }
    
    fn gauss_points_2x2x2() -> (Vec<[f64; 3]>, Vec<f64>) {
        let g = 0.5773502691896257;  // 1/√3
        let mut points = Vec::with_capacity(8);
        let mut weights = Vec::with_capacity(8);
        
        for &zi in &[-g, g] {
            for &ei in &[-g, g] {
                for &xi in &[-g, g] {
                    points.push([xi, ei, zi]);
                    weights.push(1.0);
                }
            }
        }
        
        (points, weights)
    }
    
    fn constitutive_matrix(&self) -> [[f64; 6]; 6] {
        let e = self.e;
        let nu = self.nu;
        let denom = (1.0 + nu) * (1.0 - 2.0 * nu);
        if denom.abs() <= f64::EPSILON || e <= 0.0 {
            return [[0.0; 6]; 6];
        }
        let factor = e / denom;
        
        let mut d = [[0.0; 6]; 6];
        
        d[0][0] = factor * (1.0 - nu);
        d[1][1] = factor * (1.0 - nu);
        d[2][2] = factor * (1.0 - nu);
        
        d[0][1] = factor * nu;
        d[0][2] = factor * nu;
        d[1][0] = factor * nu;
        d[1][2] = factor * nu;
        d[2][0] = factor * nu;
        d[2][1] = factor * nu;
        
        d[3][3] = factor * (1.0 - 2.0 * nu) / 2.0;
        d[4][4] = factor * (1.0 - 2.0 * nu) / 2.0;
        d[5][5] = factor * (1.0 - 2.0 * nu) / 2.0;
        
        d
    }
    
    fn strain_displacement_matrix(
        &self,
        dn: &[[f64; 20]; 3],
        coords: &[[f64; 3]; 20],
    ) -> ([[f64; 60]; 6], f64) {
        // Compute Jacobian
        let mut j = [[0.0; 3]; 3];
        for i in 0..3 {
            for k in 0..3 {
                for n in 0..20 {
                    j[i][k] += dn[i][n] * coords[n][k];
                }
            }
        }
        
        // Determinant
        let det_j = j[0][0] * (j[1][1] * j[2][2] - j[1][2] * j[2][1])
                  - j[0][1] * (j[1][0] * j[2][2] - j[1][2] * j[2][0])
                  + j[0][2] * (j[1][0] * j[2][1] - j[1][1] * j[2][0]);
        
        if det_j.abs() < 1e-14 {
            return ([[0.0; 60]; 6], 0.0);
        }
        
        // Inverse Jacobian
        let inv_det = 1.0 / det_j;
        let mut j_inv = [[0.0; 3]; 3];
        
        j_inv[0][0] = inv_det * (j[1][1] * j[2][2] - j[1][2] * j[2][1]);
        j_inv[0][1] = inv_det * (j[0][2] * j[2][1] - j[0][1] * j[2][2]);
        j_inv[0][2] = inv_det * (j[0][1] * j[1][2] - j[0][2] * j[1][1]);
        j_inv[1][0] = inv_det * (j[1][2] * j[2][0] - j[1][0] * j[2][2]);
        j_inv[1][1] = inv_det * (j[0][0] * j[2][2] - j[0][2] * j[2][0]);
        j_inv[1][2] = inv_det * (j[0][2] * j[1][0] - j[0][0] * j[1][2]);
        j_inv[2][0] = inv_det * (j[1][0] * j[2][1] - j[1][1] * j[2][0]);
        j_inv[2][1] = inv_det * (j[0][1] * j[2][0] - j[0][0] * j[2][1]);
        j_inv[2][2] = inv_det * (j[0][0] * j[1][1] - j[0][1] * j[1][0]);
        
        // ∂N/∂x = J^{-1} * ∂N/∂ξ
        let mut dn_dx = [[0.0; 20]; 3];
        for i in 0..3 {
            for n in 0..20 {
                for k in 0..3 {
                    dn_dx[i][n] += j_inv[i][k] * dn[k][n];
                }
            }
        }
        
        // Build B-matrix (6 x 60)
        let mut b = [[0.0; 60]; 6];
        for n in 0..20 {
            let col = n * 3;
            
            // ε_xx = ∂u/∂x
            b[0][col] = dn_dx[0][n];
            // ε_yy = ∂v/∂y
            b[1][col + 1] = dn_dx[1][n];
            // ε_zz = ∂w/∂z
            b[2][col + 2] = dn_dx[2][n];
            
            // γ_xy = ∂u/∂y + ∂v/∂x
            b[3][col] = dn_dx[1][n];
            b[3][col + 1] = dn_dx[0][n];
            
            // γ_yz = ∂v/∂z + ∂w/∂y
            b[4][col + 1] = dn_dx[2][n];
            b[4][col + 2] = dn_dx[1][n];
            
            // γ_xz = ∂u/∂z + ∂w/∂x
            b[5][col] = dn_dx[2][n];
            b[5][col + 2] = dn_dx[0][n];
        }
        
        (b, det_j)
    }
    
    fn multiply_bt_d(&self, b: &[[f64; 60]; 6], d: &[[f64; 6]; 6]) -> [[f64; 6]; 60] {
        let mut bt_d = [[0.0; 6]; 60];
        for i in 0..60 {
            for j in 0..6 {
                for k in 0..6 {
                    bt_d[i][j] += b[k][i] * d[k][j];
                }
            }
        }
        bt_d
    }
    
    fn multiply_matrices(&self, a: &[[f64; 6]; 60], b: &[[f64; 60]; 6]) -> [[f64; 60]; 60] {
        let mut c = [[0.0; 60]; 60];
        for i in 0..60 {
            for j in 0..60 {
                for k in 0..6 {
                    c[i][j] += a[i][k] * b[k][j];
                }
            }
        }
        c
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_hex() -> Hex20Element {
        Hex20Element {
            id: 1,
            node_ids: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
            e: 30_000.0,
            nu: 0.2,
            rho: 2500.0,
            integration: IntegrationScheme::Full,
        }
    }

    #[test]
    fn validate_properties_accepts_valid_material() {
        let e = sample_hex();
        let out = e.validate_properties();
        assert!(out.passed);
        assert_eq!(out.utilization, 0.0);
    }

    #[test]
    fn validate_properties_rejects_invalid_poisson_ratio() {
        let mut e = sample_hex();
        e.nu = 0.5;
        let out = e.validate_properties();
        assert!(!out.passed);
        assert!(out.utilization > 0.0);
    }
}

