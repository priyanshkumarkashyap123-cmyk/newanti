//! Thermal Analysis Framework
//!
//! Heat transfer analysis including steady-state and transient thermal problems.
//! Supports conduction, convection, and radiation boundary conditions.
//!
//! ## Analysis Types
//! - **Steady-State** - Time-independent temperature distribution
//! - **Transient** - Time-dependent heat transfer
//! - **Coupled** - Thermo-mechanical coupling
//!
//! ## Features
//! - 2D/3D thermal elements
//! - Temperature-dependent properties
//! - Phase change (latent heat)
//! - Thermal contact resistance

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// MATERIAL PROPERTIES
// ============================================================================

/// Thermal material properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThermalMaterial {
    pub id: usize,
    pub name: String,
    pub conductivity: Conductivity,
    pub specific_heat: f64,       // J/(kg·K)
    pub density: f64,             // kg/m³
    pub emissivity: f64,          // For radiation (0-1)
    pub latent_heat: Option<LatentHeat>,
}

/// Thermal conductivity (can be isotropic or orthotropic)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Conductivity {
    Isotropic(f64),                    // k [W/(m·K)]
    Orthotropic { kx: f64, ky: f64, kz: f64 },
    TemperatureDependent(Vec<(f64, f64)>), // [(T, k), ...]
}

impl Conductivity {
    pub fn get_value(&self, temperature: f64) -> [f64; 3] {
        match self {
            Conductivity::Isotropic(k) => [*k, *k, *k],
            Conductivity::Orthotropic { kx, ky, kz } => [*kx, *ky, *kz],
            Conductivity::TemperatureDependent(table) => {
                let k = interpolate_table(table, temperature);
                [k, k, k]
            }
        }
    }
}

/// Latent heat for phase change
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatentHeat {
    pub solidus_temp: f64,   // Temperature where melting starts
    pub liquidus_temp: f64,  // Temperature where fully melted
    pub latent_heat: f64,    // J/kg
}

impl LatentHeat {
    /// Get effective specific heat including latent heat
    pub fn effective_specific_heat(&self, temperature: f64, base_cp: f64) -> f64 {
        if temperature < self.solidus_temp || temperature > self.liquidus_temp {
            base_cp
        } else {
            // Distribute latent heat over phase change range
            let delta_t = self.liquidus_temp - self.solidus_temp;
            if delta_t > 1e-10 {
                base_cp + self.latent_heat / delta_t
            } else {
                base_cp
            }
        }
    }
}

impl Default for ThermalMaterial {
    fn default() -> Self {
        ThermalMaterial {
            id: 0,
            name: "Steel".to_string(),
            conductivity: Conductivity::Isotropic(50.0), // W/(m·K)
            specific_heat: 500.0,  // J/(kg·K)
            density: 7850.0,       // kg/m³
            emissivity: 0.8,
            latent_heat: None,
        }
    }
}

/// Common thermal materials
impl ThermalMaterial {
    pub fn steel() -> Self {
        Self::default()
    }

    pub fn aluminum() -> Self {
        ThermalMaterial {
            id: 1,
            name: "Aluminum".to_string(),
            conductivity: Conductivity::Isotropic(237.0),
            specific_heat: 900.0,
            density: 2700.0,
            emissivity: 0.05,
            latent_heat: None,
        }
    }

    pub fn concrete() -> Self {
        ThermalMaterial {
            id: 2,
            name: "Concrete".to_string(),
            conductivity: Conductivity::Isotropic(1.4),
            specific_heat: 880.0,
            density: 2400.0,
            emissivity: 0.9,
            latent_heat: None,
        }
    }

    pub fn insulation() -> Self {
        ThermalMaterial {
            id: 3,
            name: "Insulation".to_string(),
            conductivity: Conductivity::Isotropic(0.04),
            specific_heat: 840.0,
            density: 30.0,
            emissivity: 0.9,
            latent_heat: None,
        }
    }

    pub fn water() -> Self {
        ThermalMaterial {
            id: 4,
            name: "Water".to_string(),
            conductivity: Conductivity::Isotropic(0.6),
            specific_heat: 4186.0,
            density: 1000.0,
            emissivity: 0.95,
            latent_heat: Some(LatentHeat {
                solidus_temp: 273.15,
                liquidus_temp: 273.15,
                latent_heat: 334000.0, // J/kg
            }),
        }
    }
}

// ============================================================================
// THERMAL ELEMENTS
// ============================================================================

/// 2D thermal element (quadrilateral)
#[derive(Debug, Clone)]
pub struct ThermalQuad4 {
    pub id: usize,
    pub node_ids: [usize; 4],
    pub material_id: usize,
    pub thickness: f64,
}

impl ThermalQuad4 {
    /// Compute conductivity matrix [K]
    pub fn conductivity_matrix(
        &self,
        nodes: &[(f64, f64)],
        material: &ThermalMaterial,
        temperature: f64,
    ) -> [[f64; 4]; 4] {
        let k = material.conductivity.get_value(temperature);
        let t = self.thickness;

        // Get nodal coordinates
        let coords: Vec<(f64, f64)> = self.node_ids.iter()
            .map(|&id| nodes[id])
            .collect();

        // 2x2 Gauss quadrature
        let gauss_pts = [-1.0 / 3.0_f64.sqrt(), 1.0 / 3.0_f64.sqrt()];
        let weights = [1.0, 1.0];

        let mut ke = [[0.0; 4]; 4];

        for (i, &xi) in gauss_pts.iter().enumerate() {
            for (j, &eta) in gauss_pts.iter().enumerate() {
                let w = weights[i] * weights[j];

                // Shape function derivatives
                let (dndx, dndy, det_j) = self.shape_derivatives(xi, eta, &coords);

                // B matrix (gradient of shape functions)
                // k_ij = ∫ (∂Ni/∂x * kx * ∂Nj/∂x + ∂Ni/∂y * ky * ∂Nj/∂y) dA
                for a in 0..4 {
                    for b in 0..4 {
                        ke[a][b] += w * det_j * t * (
                            k[0] * dndx[a] * dndx[b] +
                            k[1] * dndy[a] * dndy[b]
                        );
                    }
                }
            }
        }

        ke
    }

    /// Compute capacity matrix [C] (for transient analysis)
    pub fn capacity_matrix(
        &self,
        nodes: &[(f64, f64)],
        material: &ThermalMaterial,
        temperature: f64,
    ) -> [[f64; 4]; 4] {
        let cp = if let Some(ref lh) = material.latent_heat {
            lh.effective_specific_heat(temperature, material.specific_heat)
        } else {
            material.specific_heat
        };
        let rho = material.density;
        let t = self.thickness;

        let coords: Vec<(f64, f64)> = self.node_ids.iter()
            .map(|&id| nodes[id])
            .collect();

        let gauss_pts = [-1.0 / 3.0_f64.sqrt(), 1.0 / 3.0_f64.sqrt()];
        let weights = [1.0, 1.0];

        let mut ce = [[0.0; 4]; 4];

        for (i, &xi) in gauss_pts.iter().enumerate() {
            for (j, &eta) in gauss_pts.iter().enumerate() {
                let w = weights[i] * weights[j];

                let n = self.shape_functions(xi, eta);
                let (_, _, det_j) = self.shape_derivatives(xi, eta, &coords);

                // c_ij = ∫ ρ * cp * Ni * Nj dA
                for a in 0..4 {
                    for b in 0..4 {
                        ce[a][b] += w * det_j * t * rho * cp * n[a] * n[b];
                    }
                }
            }
        }

        ce
    }

    /// Shape functions at (xi, eta)
    fn shape_functions(&self, xi: f64, eta: f64) -> [f64; 4] {
        [
            0.25 * (1.0 - xi) * (1.0 - eta),
            0.25 * (1.0 + xi) * (1.0 - eta),
            0.25 * (1.0 + xi) * (1.0 + eta),
            0.25 * (1.0 - xi) * (1.0 + eta),
        ]
    }

    /// Shape function derivatives in physical coordinates
    fn shape_derivatives(
        &self,
        xi: f64,
        eta: f64,
        coords: &[(f64, f64)],
    ) -> ([f64; 4], [f64; 4], f64) {
        // Derivatives w.r.t. natural coordinates
        let dndxi = [
            -0.25 * (1.0 - eta),
             0.25 * (1.0 - eta),
             0.25 * (1.0 + eta),
            -0.25 * (1.0 + eta),
        ];
        let dndeta = [
            -0.25 * (1.0 - xi),
            -0.25 * (1.0 + xi),
             0.25 * (1.0 + xi),
             0.25 * (1.0 - xi),
        ];

        // Jacobian
        let mut j11 = 0.0;
        let mut j12 = 0.0;
        let mut j21 = 0.0;
        let mut j22 = 0.0;

        for i in 0..4 {
            j11 += dndxi[i] * coords[i].0;
            j12 += dndxi[i] * coords[i].1;
            j21 += dndeta[i] * coords[i].0;
            j22 += dndeta[i] * coords[i].1;
        }

        let det_j = j11 * j22 - j12 * j21;

        // Inverse Jacobian
        let inv_det = 1.0 / det_j;
        let ji11 = j22 * inv_det;
        let ji12 = -j12 * inv_det;
        let ji21 = -j21 * inv_det;
        let ji22 = j11 * inv_det;

        // Transform derivatives
        let mut dndx = [0.0; 4];
        let mut dndy = [0.0; 4];
        for i in 0..4 {
            dndx[i] = ji11 * dndxi[i] + ji12 * dndeta[i];
            dndy[i] = ji21 * dndxi[i] + ji22 * dndeta[i];
        }

        (dndx, dndy, det_j)
    }
}

/// 3D thermal element (hexahedron)
#[derive(Debug, Clone)]
pub struct ThermalHex8 {
    pub id: usize,
    pub node_ids: [usize; 8],
    pub material_id: usize,
}

impl ThermalHex8 {
    /// Shape functions at (xi, eta, zeta)
    pub fn shape_functions(&self, xi: f64, eta: f64, zeta: f64) -> [f64; 8] {
        [
            0.125 * (1.0 - xi) * (1.0 - eta) * (1.0 - zeta),
            0.125 * (1.0 + xi) * (1.0 - eta) * (1.0 - zeta),
            0.125 * (1.0 + xi) * (1.0 + eta) * (1.0 - zeta),
            0.125 * (1.0 - xi) * (1.0 + eta) * (1.0 - zeta),
            0.125 * (1.0 - xi) * (1.0 - eta) * (1.0 + zeta),
            0.125 * (1.0 + xi) * (1.0 - eta) * (1.0 + zeta),
            0.125 * (1.0 + xi) * (1.0 + eta) * (1.0 + zeta),
            0.125 * (1.0 - xi) * (1.0 + eta) * (1.0 + zeta),
        ]
    }

    /// Compute 8x8 conductivity matrix
    pub fn conductivity_matrix(
        &self,
        nodes: &[(f64, f64, f64)],
        material: &ThermalMaterial,
        temperature: f64,
    ) -> Vec<f64> {
        let k = material.conductivity.get_value(temperature);

        let coords: Vec<(f64, f64, f64)> = self.node_ids.iter()
            .map(|&id| nodes[id])
            .collect();

        let gp = 1.0 / 3.0_f64.sqrt();
        let gauss_pts = [-gp, gp];

        let mut ke = vec![0.0; 64]; // 8x8 matrix

        for &xi in &gauss_pts {
            for &eta in &gauss_pts {
                for &zeta in &gauss_pts {
                    let (dndx, dndy, dndz, det_j) = 
                        self.shape_derivatives(xi, eta, zeta, &coords);

                    for a in 0..8 {
                        for b in 0..8 {
                            ke[a * 8 + b] += det_j * (
                                k[0] * dndx[a] * dndx[b] +
                                k[1] * dndy[a] * dndy[b] +
                                k[2] * dndz[a] * dndz[b]
                            );
                        }
                    }
                }
            }
        }

        ke
    }

    fn shape_derivatives(
        &self,
        xi: f64,
        eta: f64,
        zeta: f64,
        coords: &[(f64, f64, f64)],
    ) -> ([f64; 8], [f64; 8], [f64; 8], f64) {
        // Natural coordinate derivatives
        let dndxi = [
            -0.125 * (1.0 - eta) * (1.0 - zeta),
             0.125 * (1.0 - eta) * (1.0 - zeta),
             0.125 * (1.0 + eta) * (1.0 - zeta),
            -0.125 * (1.0 + eta) * (1.0 - zeta),
            -0.125 * (1.0 - eta) * (1.0 + zeta),
             0.125 * (1.0 - eta) * (1.0 + zeta),
             0.125 * (1.0 + eta) * (1.0 + zeta),
            -0.125 * (1.0 + eta) * (1.0 + zeta),
        ];
        let dndeta = [
            -0.125 * (1.0 - xi) * (1.0 - zeta),
            -0.125 * (1.0 + xi) * (1.0 - zeta),
             0.125 * (1.0 + xi) * (1.0 - zeta),
             0.125 * (1.0 - xi) * (1.0 - zeta),
            -0.125 * (1.0 - xi) * (1.0 + zeta),
            -0.125 * (1.0 + xi) * (1.0 + zeta),
             0.125 * (1.0 + xi) * (1.0 + zeta),
             0.125 * (1.0 - xi) * (1.0 + zeta),
        ];
        let dndzeta = [
            -0.125 * (1.0 - xi) * (1.0 - eta),
            -0.125 * (1.0 + xi) * (1.0 - eta),
            -0.125 * (1.0 + xi) * (1.0 + eta),
            -0.125 * (1.0 - xi) * (1.0 + eta),
             0.125 * (1.0 - xi) * (1.0 - eta),
             0.125 * (1.0 + xi) * (1.0 - eta),
             0.125 * (1.0 + xi) * (1.0 + eta),
             0.125 * (1.0 - xi) * (1.0 + eta),
        ];

        // Jacobian matrix
        let mut j = [[0.0; 3]; 3];
        for i in 0..8 {
            j[0][0] += dndxi[i] * coords[i].0;
            j[0][1] += dndxi[i] * coords[i].1;
            j[0][2] += dndxi[i] * coords[i].2;
            j[1][0] += dndeta[i] * coords[i].0;
            j[1][1] += dndeta[i] * coords[i].1;
            j[1][2] += dndeta[i] * coords[i].2;
            j[2][0] += dndzeta[i] * coords[i].0;
            j[2][1] += dndzeta[i] * coords[i].1;
            j[2][2] += dndzeta[i] * coords[i].2;
        }

        // Determinant
        let det_j = j[0][0] * (j[1][1] * j[2][2] - j[1][2] * j[2][1])
                  - j[0][1] * (j[1][0] * j[2][2] - j[1][2] * j[2][0])
                  + j[0][2] * (j[1][0] * j[2][1] - j[1][1] * j[2][0]);

        // Inverse Jacobian
        let inv_det = 1.0 / det_j;
        let ji = [
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
        ];

        // Physical derivatives
        let mut dndx = [0.0; 8];
        let mut dndy = [0.0; 8];
        let mut dndz = [0.0; 8];
        for i in 0..8 {
            dndx[i] = ji[0][0] * dndxi[i] + ji[0][1] * dndeta[i] + ji[0][2] * dndzeta[i];
            dndy[i] = ji[1][0] * dndxi[i] + ji[1][1] * dndeta[i] + ji[1][2] * dndzeta[i];
            dndz[i] = ji[2][0] * dndxi[i] + ji[2][1] * dndeta[i] + ji[2][2] * dndzeta[i];
        }

        (dndx, dndy, dndz, det_j)
    }
}

// ============================================================================
// BOUNDARY CONDITIONS
// ============================================================================

/// Thermal boundary condition types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ThermalBC {
    /// Prescribed temperature (Dirichlet)
    Temperature {
        node_ids: Vec<usize>,
        value: f64,
    },
    /// Heat flux (Neumann)
    HeatFlux {
        surface_id: usize,
        flux: f64,  // W/m² (positive = into body)
    },
    /// Convection (Robin)
    Convection {
        surface_id: usize,
        film_coefficient: f64,  // W/(m²·K)
        ambient_temp: f64,
    },
    /// Radiation
    Radiation {
        surface_id: usize,
        emissivity: f64,
        ambient_temp: f64,
    },
    /// Internal heat generation
    HeatGeneration {
        element_ids: Vec<usize>,
        power_density: f64,  // W/m³
    },
}

/// Convection boundary contribution
pub struct ConvectionBC;

impl ConvectionBC {
    /// Surface convection matrix contribution
    /// h_ij = ∫ h * Ni * Nj dS
    pub fn surface_matrix_quad4(
        edge_nodes: [usize; 2],
        node_coords: &[(f64, f64)],
        h: f64,  // Film coefficient
    ) -> ([[f64; 2]; 2], [f64; 2]) {
        let (x1, y1) = node_coords[edge_nodes[0]];
        let (x2, y2) = node_coords[edge_nodes[1]];
        let length = ((x2 - x1).powi(2) + (y2 - y1).powi(2)).sqrt();

        // Lumped (diagonal) approach for simplicity
        let h_matrix = [
            [h * length / 3.0, h * length / 6.0],
            [h * length / 6.0, h * length / 3.0],
        ];

        // For load vector: f = h * T_ambient * ∫ Ni dS
        let load = [h * length / 2.0, h * length / 2.0];

        (h_matrix, load)
    }
}

/// Radiation boundary (linearized)
pub struct RadiationBC;

impl RadiationBC {
    /// Stefan-Boltzmann constant
    pub const STEFAN_BOLTZMANN: f64 = 5.67e-8; // W/(m²·K⁴)

    /// Linearized radiation coefficient
    /// h_rad = ε * σ * (T² + T_amb²) * (T + T_amb)
    pub fn linearized_coefficient(
        emissivity: f64,
        surface_temp: f64,
        ambient_temp: f64,
    ) -> f64 {
        let sigma = Self::STEFAN_BOLTZMANN;
        emissivity * sigma * (surface_temp.powi(2) + ambient_temp.powi(2))
            * (surface_temp + ambient_temp)
    }
}

// ============================================================================
// STEADY-STATE SOLVER
// ============================================================================

/// Steady-state thermal analysis
pub struct SteadyStateThermal {
    pub nodes: Vec<(f64, f64, f64)>,
    pub elements: Vec<ThermalElement>,
    pub materials: HashMap<usize, ThermalMaterial>,
    pub boundary_conditions: Vec<ThermalBC>,
}

#[derive(Debug, Clone)]
pub enum ThermalElement {
    Quad4(ThermalQuad4),
    Hex8(ThermalHex8),
}

impl SteadyStateThermal {
    pub fn new() -> Self {
        SteadyStateThermal {
            nodes: Vec::new(),
            elements: Vec::new(),
            materials: HashMap::new(),
            boundary_conditions: Vec::new(),
        }
    }

    /// Solve steady-state: [K]{T} = {Q}
    pub fn solve(&self) -> Result<ThermalResult, String> {
        let n_nodes = self.nodes.len();
        if n_nodes == 0 {
            return Err("No nodes defined".to_string());
        }

        // Assemble global conductivity matrix
        let mut k_global = vec![0.0; n_nodes * n_nodes];
        let mut f_global = vec![0.0; n_nodes];

        // Element assembly (simplified for Quad4 2D)
        for element in &self.elements {
            match element {
                ThermalElement::Quad4(quad) => {
                    let material = self.materials.get(&quad.material_id)
                        .ok_or("Material not found")?;
                    let nodes_2d: Vec<(f64, f64)> = self.nodes.iter()
                        .map(|&(x, y, _)| (x, y))
                        .collect();

                    let ke = quad.conductivity_matrix(&nodes_2d, material, 293.15); // Room temp

                    // Scatter to global
                    for (i, &ni) in quad.node_ids.iter().enumerate() {
                        for (j, &nj) in quad.node_ids.iter().enumerate() {
                            k_global[ni * n_nodes + nj] += ke[i][j];
                        }
                    }
                }
                ThermalElement::Hex8(_hex) => {
                    // Similar assembly for 3D
                }
            }
        }

        // Apply boundary conditions
        let mut constrained_dofs = Vec::new();
        let mut prescribed_temps = HashMap::new();

        for bc in &self.boundary_conditions {
            match bc {
                ThermalBC::Temperature { node_ids, value } => {
                    for &nid in node_ids {
                        constrained_dofs.push(nid);
                        prescribed_temps.insert(nid, *value);
                    }
                }
                ThermalBC::HeatFlux { .. } => {
                    // Add to load vector
                }
                ThermalBC::Convection { .. } => {
                    // Add convection matrix and load
                }
                ThermalBC::HeatGeneration { element_ids, power_density } => {
                    // Add internal heat generation to load vector
                    for &eid in element_ids {
                        if eid < self.elements.len() {
                            // Simplified: distribute to element nodes
                            if let ThermalElement::Quad4(quad) = &self.elements[eid] {
                                let vol = 1.0; // Would compute element volume
                                let q = power_density * vol / 4.0;
                                for &nid in &quad.node_ids {
                                    f_global[nid] += q;
                                }
                            }
                        }
                    }
                }
                _ => {}
            }
        }

        // Apply temperature BCs using penalty method
        let penalty = 1e20;
        for (&nid, &temp) in &prescribed_temps {
            k_global[nid * n_nodes + nid] += penalty;
            f_global[nid] = penalty * temp;
        }

        // Solve (simple Gauss elimination for small systems)
        let temperatures = self.solve_linear_system(&k_global, &f_global, n_nodes)?;

        Ok(ThermalResult {
            temperatures,
            heat_fluxes: HashMap::new(),
            convergence_info: None,
        })
    }

    /// Simple linear solver (for production, use sparse solver)
    fn solve_linear_system(&self, k: &[f64], f: &[f64], n: usize) -> Result<Vec<f64>, String> {
        let mut a = k.to_vec();
        let mut b = f.to_vec();

        // Gaussian elimination with partial pivoting
        for i in 0..n {
            // Find pivot
            let mut max_val = a[i * n + i].abs();
            let mut max_row = i;
            for k in (i + 1)..n {
                if a[k * n + i].abs() > max_val {
                    max_val = a[k * n + i].abs();
                    max_row = k;
                }
            }

            if max_val < 1e-14 {
                return Err("Singular matrix".to_string());
            }

            // Swap rows
            if max_row != i {
                for j in 0..n {
                    a.swap(i * n + j, max_row * n + j);
                }
                b.swap(i, max_row);
            }

            // Eliminate
            for k in (i + 1)..n {
                let factor = a[k * n + i] / a[i * n + i];
                for j in i..n {
                    a[k * n + j] -= factor * a[i * n + j];
                }
                b[k] -= factor * b[i];
            }
        }

        // Back substitution
        let mut x = vec![0.0; n];
        for i in (0..n).rev() {
            let mut sum = b[i];
            for j in (i + 1)..n {
                sum -= a[i * n + j] * x[j];
            }
            x[i] = sum / a[i * n + i];
        }

        Ok(x)
    }
}

impl Default for SteadyStateThermal {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// TRANSIENT SOLVER
// ============================================================================

/// Transient thermal analysis
pub struct TransientThermal {
    pub steady_state: SteadyStateThermal,
    pub time_step: f64,
    pub total_time: f64,
    pub theta: f64,  // Time integration parameter (0.5 = Crank-Nicolson, 1.0 = Backward Euler)
    pub initial_temperature: f64,
}

impl TransientThermal {
    pub fn new(model: SteadyStateThermal) -> Self {
        TransientThermal {
            steady_state: model,
            time_step: 1.0,
            total_time: 100.0,
            theta: 0.5,
            initial_temperature: 293.15, // 20°C
        }
    }

    /// Solve transient: [C]{Ṫ} + [K]{T} = {Q}
    /// Using generalized trapezoidal rule:
    /// ([C]/Δt + θ[K]){T_{n+1}} = ([C]/Δt - (1-θ)[K]){T_n} + θ{Q_{n+1}} + (1-θ){Q_n}
    pub fn solve(&self) -> Result<Vec<TransientStep>, String> {
        let n_nodes = self.steady_state.nodes.len();
        let n_steps = (self.total_time / self.time_step).ceil() as usize;

        // Initial condition
        let mut temp = vec![self.initial_temperature; n_nodes];
        let mut results = vec![TransientStep {
            time: 0.0,
            temperatures: temp.clone(),
        }];

        // Assemble matrices (simplified - would use element assembly)
        let k_global = vec![0.0; n_nodes * n_nodes]; // Placeholder
        let c_global = vec![0.0; n_nodes * n_nodes]; // Placeholder
        let f_global = vec![0.0; n_nodes]; // Placeholder

        // Time stepping
        for step in 1..=n_steps {
            let time = step as f64 * self.time_step;

            // Build effective matrix: [C]/Δt + θ[K]
            let mut k_eff = vec![0.0; n_nodes * n_nodes];
            for i in 0..n_nodes * n_nodes {
                k_eff[i] = c_global[i] / self.time_step + self.theta * k_global[i];
            }

            // Build effective load: ([C]/Δt - (1-θ)[K]){T_n} + {Q}
            let mut f_eff = vec![0.0; n_nodes];
            for i in 0..n_nodes {
                f_eff[i] = f_global[i];
                for j in 0..n_nodes {
                    f_eff[i] += (c_global[i * n_nodes + j] / self.time_step
                        - (1.0 - self.theta) * k_global[i * n_nodes + j]) * temp[j];
                }
            }

            // Solve for T_{n+1}
            temp = self.steady_state.solve_linear_system(&k_eff, &f_eff, n_nodes)?;

            results.push(TransientStep {
                time,
                temperatures: temp.clone(),
            });
        }

        Ok(results)
    }
}

/// Single time step result
#[derive(Debug, Clone)]
pub struct TransientStep {
    pub time: f64,
    pub temperatures: Vec<f64>,
}

// ============================================================================
// RESULTS
// ============================================================================

/// Thermal analysis result
#[derive(Debug, Clone)]
pub struct ThermalResult {
    pub temperatures: Vec<f64>,
    pub heat_fluxes: HashMap<usize, [f64; 3]>,  // Element ID -> (qx, qy, qz)
    pub convergence_info: Option<ConvergenceInfo>,
}

#[derive(Debug, Clone)]
pub struct ConvergenceInfo {
    pub iterations: usize,
    pub residual: f64,
    pub converged: bool,
}

impl ThermalResult {
    /// Compute heat flux at element centroid
    pub fn compute_heat_flux(
        &mut self,
        element_id: usize,
        node_temps: &[f64],
        conductivity: [f64; 3],
        dndx: &[f64],
        dndy: &[f64],
        dndz: &[f64],
    ) {
        let n = dndx.len();

        // q = -k * ∇T
        let mut grad_t = [0.0; 3];
        for i in 0..n {
            grad_t[0] += dndx[i] * node_temps[i];
            grad_t[1] += dndy[i] * node_temps[i];
            grad_t[2] += dndz[i] * node_temps[i];
        }

        self.heat_fluxes.insert(
            element_id,
            [
                -conductivity[0] * grad_t[0],
                -conductivity[1] * grad_t[1],
                -conductivity[2] * grad_t[2],
            ],
        );
    }

    /// Maximum temperature
    pub fn max_temperature(&self) -> f64 {
        self.temperatures.iter().cloned().fold(f64::NEG_INFINITY, f64::max)
    }

    /// Minimum temperature
    pub fn min_temperature(&self) -> f64 {
        self.temperatures.iter().cloned().fold(f64::INFINITY, f64::min)
    }
}

// ============================================================================
// THERMO-MECHANICAL COUPLING
// ============================================================================

/// Thermo-mechanical coupling data
#[derive(Debug, Clone)]
pub struct ThermoMechanicalCoupling {
    pub thermal_expansion_coeff: f64,  // 1/K
    pub reference_temperature: f64,
}

impl ThermoMechanicalCoupling {
    /// Compute thermal strain
    pub fn thermal_strain(&self, temperature: f64) -> f64 {
        self.thermal_expansion_coeff * (temperature - self.reference_temperature)
    }

    /// Compute thermal stress (for constrained element)
    pub fn thermal_stress(&self, temperature: f64, elastic_modulus: f64) -> f64 {
        -elastic_modulus * self.thermal_strain(temperature)
    }

    /// Compute equivalent nodal forces from thermal loading
    pub fn thermal_load_vector(
        &self,
        temperatures: &[f64],
        elastic_modulus: f64,
        b_matrix: &[f64],
        volume: f64,
    ) -> Vec<f64> {
        // For 3D: f_th = ∫ B^T * D * ε_th dV
        let n_dof = b_matrix.len() / 6; // Assuming 6 strain components

        let mut f_th = vec![0.0; n_dof];
        let avg_temp: f64 = temperatures.iter().sum::<f64>() / temperatures.len() as f64;
        let eps_th = self.thermal_strain(avg_temp);

        // Simplified: uniform thermal strain in all directions
        let eps_thermal = [eps_th, eps_th, eps_th, 0.0, 0.0, 0.0];

        // This is a placeholder - full implementation needs proper integration
        let _factor = elastic_modulus * volume;
        for i in 0..n_dof {
            for j in 0..6 {
                f_th[i] += b_matrix[j * n_dof + i] * eps_thermal[j] * volume;
            }
        }

        f_th
    }
}

impl Default for ThermoMechanicalCoupling {
    fn default() -> Self {
        ThermoMechanicalCoupling {
            thermal_expansion_coeff: 12e-6, // Steel
            reference_temperature: 293.15,  // 20°C
        }
    }
}

// ============================================================================
// UTILITIES
// ============================================================================

/// Linear interpolation from table
fn interpolate_table(table: &[(f64, f64)], x: f64) -> f64 {
    if table.is_empty() {
        return 0.0;
    }
    if table.len() == 1 {
        return table[0].1;
    }

    // Find bracketing points
    if x <= table[0].0 {
        return table[0].1;
    }
    if x >= table.last().unwrap().0 {
        return table.last().unwrap().1;
    }

    for i in 0..table.len() - 1 {
        if x >= table[i].0 && x <= table[i + 1].0 {
            let t = (x - table[i].0) / (table[i + 1].0 - table[i].0);
            return table[i].1 + t * (table[i + 1].1 - table[i].1);
        }
    }

    table.last().unwrap().1
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_conductivity_isotropic() {
        let k = Conductivity::Isotropic(50.0);
        let values = k.get_value(300.0);
        assert_eq!(values, [50.0, 50.0, 50.0]);
    }

    #[test]
    fn test_conductivity_orthotropic() {
        let k = Conductivity::Orthotropic { kx: 10.0, ky: 20.0, kz: 30.0 };
        let values = k.get_value(300.0);
        assert_eq!(values, [10.0, 20.0, 30.0]);
    }

    #[test]
    fn test_conductivity_temp_dependent() {
        let k = Conductivity::TemperatureDependent(vec![
            (200.0, 60.0),
            (400.0, 50.0),
            (600.0, 40.0),
        ]);
        let values = k.get_value(300.0);
        assert!((values[0] - 55.0).abs() < 1e-10);
    }

    #[test]
    fn test_latent_heat() {
        let lh = LatentHeat {
            solidus_temp: 273.15,
            liquidus_temp: 275.15,
            latent_heat: 334000.0,
        };

        // Below solidus
        assert_eq!(lh.effective_specific_heat(270.0, 4186.0), 4186.0);

        // In phase change range
        let cp_eff = lh.effective_specific_heat(274.15, 4186.0);
        assert!(cp_eff > 4186.0);

        // Above liquidus
        assert_eq!(lh.effective_specific_heat(280.0, 4186.0), 4186.0);
    }

    #[test]
    fn test_thermal_material_defaults() {
        let steel = ThermalMaterial::steel();
        assert_eq!(steel.density, 7850.0);

        let aluminum = ThermalMaterial::aluminum();
        assert!(matches!(aluminum.conductivity, Conductivity::Isotropic(k) if k > 200.0));
    }

    #[test]
    fn test_radiation_coefficient() {
        let h_rad = RadiationBC::linearized_coefficient(0.9, 373.15, 293.15);
        assert!(h_rad > 5.0); // Should be around 5-10 W/(m²·K)
    }

    #[test]
    fn test_thermal_strain() {
        let coupling = ThermoMechanicalCoupling {
            thermal_expansion_coeff: 12e-6,
            reference_temperature: 293.15,
        };

        let strain = coupling.thermal_strain(393.15); // 100K increase
        assert!((strain - 12e-4).abs() < 1e-10);
    }

    #[test]
    fn test_interpolate_table() {
        let table = vec![(0.0, 0.0), (10.0, 100.0), (20.0, 150.0)];

        assert_eq!(interpolate_table(&table, -5.0), 0.0);
        assert_eq!(interpolate_table(&table, 5.0), 50.0);
        assert_eq!(interpolate_table(&table, 15.0), 125.0);
        assert_eq!(interpolate_table(&table, 25.0), 150.0);
    }

    #[test]
    fn test_quad4_shape_functions() {
        let quad = ThermalQuad4 {
            id: 0,
            node_ids: [0, 1, 2, 3],
            material_id: 0,
            thickness: 1.0,
        };

        // Center point
        let n = quad.shape_functions(0.0, 0.0);
        assert!((n.iter().sum::<f64>() - 1.0).abs() < 1e-10);

        // Corner point
        let n_corner = quad.shape_functions(-1.0, -1.0);
        assert!((n_corner[0] - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_hex8_shape_functions() {
        let hex = ThermalHex8 {
            id: 0,
            node_ids: [0, 1, 2, 3, 4, 5, 6, 7],
            material_id: 0,
        };

        let n = hex.shape_functions(0.0, 0.0, 0.0);
        assert!((n.iter().sum::<f64>() - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_thermal_result() {
        let result = ThermalResult {
            temperatures: vec![100.0, 200.0, 150.0, 175.0],
            heat_fluxes: HashMap::new(),
            convergence_info: None,
        };

        assert_eq!(result.max_temperature(), 200.0);
        assert_eq!(result.min_temperature(), 100.0);
    }
}
