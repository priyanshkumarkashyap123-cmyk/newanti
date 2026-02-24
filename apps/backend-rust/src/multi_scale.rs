// ============================================================================
// MULTI-SCALE ANALYSIS - Homogenization, RVE, Concurrent Methods
// Micro-Macro Coupling, Computational Homogenization
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// REPRESENTATIVE VOLUME ELEMENT (RVE)
// ============================================================================

/// RVE geometry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RveGeometry {
    /// RVE dimensions (Lx, Ly, Lz)
    pub dimensions: [f64; 3],
    /// Inclusion volume fraction
    pub volume_fraction: f64,
    /// Inclusion type
    pub inclusion_type: InclusionType,
    /// Number of inclusions
    pub num_inclusions: usize,
}

/// Types of inclusions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum InclusionType {
    /// Spherical inclusions
    Spherical { radius: f64 },
    /// Ellipsoidal inclusions
    Ellipsoidal { a: f64, b: f64, c: f64 },
    /// Cylindrical fibers
    CylindricalFiber { radius: f64, length: f64 },
    /// Platelet inclusions
    Platelet { radius: f64, thickness: f64 },
    /// Cubic inclusions
    Cubic { side: f64 },
    /// Random voids
    Voids { mean_radius: f64, std_dev: f64 },
}

impl RveGeometry {
    pub fn new(dimensions: [f64; 3], volume_fraction: f64, inclusion_type: InclusionType) -> Self {
        let num_inclusions = Self::estimate_num_inclusions(&dimensions, volume_fraction, &inclusion_type);
        
        Self {
            dimensions,
            volume_fraction,
            inclusion_type,
            num_inclusions,
        }
    }
    
    /// Estimate number of inclusions needed
    fn estimate_num_inclusions(dims: &[f64; 3], vf: f64, inc_type: &InclusionType) -> usize {
        let rve_vol = dims[0] * dims[1] * dims[2];
        
        let inc_vol = match inc_type {
            InclusionType::Spherical { radius } => 4.0 / 3.0 * PI * radius.powi(3),
            InclusionType::Ellipsoidal { a, b, c } => 4.0 / 3.0 * PI * a * b * c,
            InclusionType::CylindricalFiber { radius, length } => PI * radius.powi(2) * length,
            InclusionType::Platelet { radius, thickness } => PI * radius.powi(2) * thickness,
            InclusionType::Cubic { side } => side.powi(3),
            InclusionType::Voids { mean_radius, .. } => 4.0 / 3.0 * PI * mean_radius.powi(3),
        };
        
        ((vf * rve_vol) / inc_vol).round() as usize
    }
    
    /// RVE volume
    pub fn volume(&self) -> f64 {
        self.dimensions[0] * self.dimensions[1] * self.dimensions[2]
    }
    
    /// Matrix volume
    pub fn matrix_volume(&self) -> f64 {
        self.volume() * (1.0 - self.volume_fraction)
    }
    
    /// Inclusion volume
    pub fn inclusion_volume(&self) -> f64 {
        self.volume() * self.volume_fraction
    }
}

// ============================================================================
// MATERIAL PHASES
// ============================================================================

/// Material phase properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaterialPhase {
    pub name: String,
    /// Young's modulus (MPa)
    pub e: f64,
    /// Poisson's ratio
    pub nu: f64,
    /// Yield stress (MPa)
    pub sigma_y: f64,
    /// Volume fraction
    pub volume_fraction: f64,
}

impl MaterialPhase {
    pub fn new(name: &str, e: f64, nu: f64, sigma_y: f64, vf: f64) -> Self {
        Self {
            name: name.to_string(),
            e,
            nu,
            sigma_y,
            volume_fraction: vf,
        }
    }
    
    /// Bulk modulus
    pub fn bulk_modulus(&self) -> f64 {
        self.e / (3.0 * (1.0 - 2.0 * self.nu))
    }
    
    /// Shear modulus
    pub fn shear_modulus(&self) -> f64 {
        self.e / (2.0 * (1.0 + self.nu))
    }
    
    /// Lamé first parameter
    pub fn lame_lambda(&self) -> f64 {
        self.e * self.nu / ((1.0 + self.nu) * (1.0 - 2.0 * self.nu))
    }
}

// ============================================================================
// HOMOGENIZATION BOUNDS
// ============================================================================

/// Homogenization bounds and estimates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HomogenizationBounds {
    pub matrix: MaterialPhase,
    pub inclusion: MaterialPhase,
}

impl HomogenizationBounds {
    pub fn new(matrix: MaterialPhase, inclusion: MaterialPhase) -> Self {
        Self { matrix, inclusion }
    }
    
    /// Voigt (upper) bound - uniform strain
    pub fn voigt_modulus(&self) -> f64 {
        let vm = 1.0 - self.inclusion.volume_fraction;
        let vi = self.inclusion.volume_fraction;
        
        vm * self.matrix.e + vi * self.inclusion.e
    }
    
    /// Reuss (lower) bound - uniform stress
    pub fn reuss_modulus(&self) -> f64 {
        let vm = 1.0 - self.inclusion.volume_fraction;
        let vi = self.inclusion.volume_fraction;
        
        1.0 / (vm / self.matrix.e + vi / self.inclusion.e)
    }
    
    /// Voigt-Reuss-Hill average
    pub fn vrh_modulus(&self) -> f64 {
        0.5 * (self.voigt_modulus() + self.reuss_modulus())
    }
    
    /// Hashin-Shtrikman lower bound for bulk modulus
    pub fn hs_lower_bulk(&self) -> f64 {
        let km = self.matrix.bulk_modulus();
        let ki = self.inclusion.bulk_modulus();
        let gm = self.matrix.shear_modulus();
        let vi = self.inclusion.volume_fraction;
        
        km + vi / (1.0 / (ki - km) + (1.0 - vi) / (km + 4.0 / 3.0 * gm))
    }
    
    /// Hashin-Shtrikman upper bound for bulk modulus
    pub fn hs_upper_bulk(&self) -> f64 {
        let km = self.matrix.bulk_modulus();
        let ki = self.inclusion.bulk_modulus();
        let gi = self.inclusion.shear_modulus();
        let vm = 1.0 - self.inclusion.volume_fraction;
        
        ki + vm / (1.0 / (km - ki) + self.inclusion.volume_fraction / (ki + 4.0 / 3.0 * gi))
    }
    
    /// Hashin-Shtrikman lower bound for shear modulus
    pub fn hs_lower_shear(&self) -> f64 {
        let km = self.matrix.bulk_modulus();
        let gm = self.matrix.shear_modulus();
        let gi = self.inclusion.shear_modulus();
        let vi = self.inclusion.volume_fraction;
        
        let beta = gm * (9.0 * km + 8.0 * gm) / (6.0 * (km + 2.0 * gm));
        
        gm + vi / (1.0 / (gi - gm) + (1.0 - vi) / (gm + beta))
    }
    
    /// Hashin-Shtrikman upper bound for shear modulus
    pub fn hs_upper_shear(&self) -> f64 {
        let ki = self.inclusion.bulk_modulus();
        let gm = self.matrix.shear_modulus();
        let gi = self.inclusion.shear_modulus();
        let vm = 1.0 - self.inclusion.volume_fraction;
        
        let beta = gi * (9.0 * ki + 8.0 * gi) / (6.0 * (ki + 2.0 * gi));
        
        gi + vm / (1.0 / (gm - gi) + self.inclusion.volume_fraction / (gi + beta))
    }
    
    /// Mori-Tanaka effective bulk modulus
    pub fn mori_tanaka_bulk(&self) -> f64 {
        let km = self.matrix.bulk_modulus();
        let ki = self.inclusion.bulk_modulus();
        let gm = self.matrix.shear_modulus();
        let vi = self.inclusion.volume_fraction;
        
        // For spherical inclusions
        let _alpha = (1.0 + self.matrix.nu) / (3.0 * (1.0 - self.matrix.nu));
        
        km + vi * (ki - km) / (1.0 + (1.0 - vi) * (ki - km) / (km + 4.0 / 3.0 * gm))
    }
    
    /// Mori-Tanaka effective shear modulus
    pub fn mori_tanaka_shear(&self) -> f64 {
        let _km = self.matrix.bulk_modulus();
        let gm = self.matrix.shear_modulus();
        let gi = self.inclusion.shear_modulus();
        let vi = self.inclusion.volume_fraction;
        
        let beta = (8.0 - 10.0 * self.matrix.nu) / (15.0 * (1.0 - self.matrix.nu));
        
        gm + vi * (gi - gm) / (1.0 + (1.0 - vi) * beta * (gi - gm) / gm)
    }
    
    /// Mori-Tanaka effective Young's modulus
    pub fn mori_tanaka_modulus(&self) -> f64 {
        let k = self.mori_tanaka_bulk();
        let g = self.mori_tanaka_shear();
        
        9.0 * k * g / (3.0 * k + g)
    }
    
    /// Self-consistent bulk modulus (iterative)
    pub fn self_consistent_bulk(&self) -> f64 {
        let km = self.matrix.bulk_modulus();
        let ki = self.inclusion.bulk_modulus();
        let gm = self.matrix.shear_modulus();
        let gi = self.inclusion.shear_modulus();
        let vi = self.inclusion.volume_fraction;
        let vm = 1.0 - vi;
        
        // Initial guess
        let mut k_eff = vm * km + vi * ki;
        let g_eff = vm * gm + vi * gi;
        
        // Iterate
        for _ in 0..20 {
            let alpha = (1.0 + k_eff / (k_eff + 4.0 / 3.0 * g_eff)) / 3.0;
            
            let k_new = km + vi * (ki - km) * alpha / 
                       (1.0 - (1.0 - vi) * (ki - km) / (ki + 4.0 / 3.0 * g_eff));
            
            if (k_new - k_eff).abs() < 1e-6 {
                break;
            }
            k_eff = k_new;
        }
        
        k_eff
    }
}

// ============================================================================
// ESHELBY TENSOR
// ============================================================================

/// Eshelby tensor for ellipsoidal inclusions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EshelbyTensor {
    /// Inclusion aspect ratios
    pub a1: f64,
    pub a2: f64,
    pub a3: f64,
    /// Matrix Poisson's ratio
    pub nu_m: f64,
}

impl EshelbyTensor {
    pub fn new(a1: f64, a2: f64, a3: f64, nu_m: f64) -> Self {
        Self { a1, a2, a3, nu_m }
    }
    
    /// Sphere (simplified)
    pub fn sphere(nu_m: f64) -> Self {
        Self::new(1.0, 1.0, 1.0, nu_m)
    }
    
    /// Prolate spheroid (fiber-like)
    pub fn prolate(aspect_ratio: f64, nu_m: f64) -> Self {
        Self::new(1.0, 1.0, aspect_ratio, nu_m)
    }
    
    /// Oblate spheroid (disk-like)
    pub fn oblate(aspect_ratio: f64, nu_m: f64) -> Self {
        Self::new(aspect_ratio, aspect_ratio, 1.0, nu_m)
    }
    
    /// S1111 component for sphere
    pub fn s1111_sphere(&self) -> f64 {
        (7.0 - 5.0 * self.nu_m) / (15.0 * (1.0 - self.nu_m))
    }
    
    /// S1122 component for sphere
    pub fn s1122_sphere(&self) -> f64 {
        (5.0 * self.nu_m - 1.0) / (15.0 * (1.0 - self.nu_m))
    }
    
    /// S1212 component for sphere
    pub fn s1212_sphere(&self) -> f64 {
        (4.0 - 5.0 * self.nu_m) / (15.0 * (1.0 - self.nu_m))
    }
    
    /// Full Eshelby tensor for sphere (symmetric)
    pub fn tensor_sphere(&self) -> [[f64; 6]; 6] {
        let s1111 = self.s1111_sphere();
        let s1122 = self.s1122_sphere();
        let s1212 = self.s1212_sphere();
        
        [
            [s1111, s1122, s1122, 0.0, 0.0, 0.0],
            [s1122, s1111, s1122, 0.0, 0.0, 0.0],
            [s1122, s1122, s1111, 0.0, 0.0, 0.0],
            [0.0, 0.0, 0.0, s1212, 0.0, 0.0],
            [0.0, 0.0, 0.0, 0.0, s1212, 0.0],
            [0.0, 0.0, 0.0, 0.0, 0.0, s1212],
        ]
    }
}

// ============================================================================
// COMPUTATIONAL HOMOGENIZATION (FE²)
// ============================================================================

/// Macro strain state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MacroStrain {
    pub e11: f64,
    pub e22: f64,
    pub e33: f64,
    pub e12: f64,
    pub e23: f64,
    pub e13: f64,
}

impl MacroStrain {
    pub fn uniaxial_x(strain: f64) -> Self {
        Self {
            e11: strain,
            e22: 0.0,
            e33: 0.0,
            e12: 0.0,
            e23: 0.0,
            e13: 0.0,
        }
    }
    
    pub fn shear_xy(strain: f64) -> Self {
        Self {
            e11: 0.0,
            e22: 0.0,
            e33: 0.0,
            e12: strain,
            e23: 0.0,
            e13: 0.0,
        }
    }
    
    pub fn to_array(&self) -> [f64; 6] {
        [self.e11, self.e22, self.e33, self.e12, self.e23, self.e13]
    }
}

/// Macro stress state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MacroStress {
    pub s11: f64,
    pub s22: f64,
    pub s33: f64,
    pub s12: f64,
    pub s23: f64,
    pub s13: f64,
}

impl MacroStress {
    pub fn zero() -> Self {
        Self {
            s11: 0.0,
            s22: 0.0,
            s33: 0.0,
            s12: 0.0,
            s23: 0.0,
            s13: 0.0,
        }
    }
    
    pub fn to_array(&self) -> [f64; 6] {
        [self.s11, self.s22, self.s33, self.s12, self.s23, self.s13]
    }
}

/// Effective stiffness tensor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EffectiveStiffness {
    pub c: [[f64; 6]; 6],
}

impl EffectiveStiffness {
    pub fn new() -> Self {
        Self { c: [[0.0; 6]; 6] }
    }
    
    /// From engineering constants (isotropic)
    pub fn from_isotropic(e: f64, nu: f64) -> Self {
        let lambda = e * nu / ((1.0 + nu) * (1.0 - 2.0 * nu));
        let mu = e / (2.0 * (1.0 + nu));
        
        let mut c = [[0.0; 6]; 6];
        
        c[0][0] = lambda + 2.0 * mu;
        c[1][1] = lambda + 2.0 * mu;
        c[2][2] = lambda + 2.0 * mu;
        c[0][1] = lambda;
        c[0][2] = lambda;
        c[1][0] = lambda;
        c[1][2] = lambda;
        c[2][0] = lambda;
        c[2][1] = lambda;
        c[3][3] = mu;
        c[4][4] = mu;
        c[5][5] = mu;
        
        Self { c }
    }
    
    /// Young's modulus in direction 1
    pub fn young_modulus_1(&self) -> f64 {
        // E1 = 1/S11 where S = C^-1
        self.c[0][0] - (self.c[0][1] + self.c[0][2]).powi(2) / 
                       (self.c[1][1] + self.c[2][2] + 2.0 * self.c[1][2])
    }
    
    /// Shear modulus G12
    pub fn shear_modulus_12(&self) -> f64 {
        self.c[5][5]
    }
    
    /// Apply strain to get stress
    pub fn apply(&self, strain: &MacroStrain) -> MacroStress {
        let eps = strain.to_array();
        let mut sig = [0.0; 6];
        
        for i in 0..6 {
            for j in 0..6 {
                sig[i] += self.c[i][j] * eps[j];
            }
        }
        
        MacroStress {
            s11: sig[0],
            s22: sig[1],
            s33: sig[2],
            s12: sig[3],
            s23: sig[4],
            s13: sig[5],
        }
    }
}

// ============================================================================
// PERIODIC BOUNDARY CONDITIONS
// ============================================================================

/// Periodic boundary conditions for RVE
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeriodicBoundary {
    pub rve_size: [f64; 3],
    pub master_nodes: Vec<usize>,
    pub slave_nodes: Vec<usize>,
}

impl PeriodicBoundary {
    pub fn new(rve_size: [f64; 3]) -> Self {
        Self {
            rve_size,
            master_nodes: Vec::new(),
            slave_nodes: Vec::new(),
        }
    }
    
    /// Add periodic pair
    pub fn add_pair(&mut self, master: usize, slave: usize) {
        self.master_nodes.push(master);
        self.slave_nodes.push(slave);
    }
    
    /// Check if point is on boundary
    pub fn is_on_boundary(&self, position: [f64; 3], tolerance: f64) -> bool {
        for i in 0..3 {
            if position[i].abs() < tolerance || 
               (position[i] - self.rve_size[i]).abs() < tolerance {
                return true;
            }
        }
        false
    }
    
    /// Find matching boundary face
    pub fn matching_face(&self, position: [f64; 3], tolerance: f64) -> Option<[f64; 3]> {
        let mut matched = position;
        
        for i in 0..3 {
            if position[i].abs() < tolerance {
                matched[i] = self.rve_size[i];
            } else if (position[i] - self.rve_size[i]).abs() < tolerance {
                matched[i] = 0.0;
            }
        }
        
        if matched == position {
            None
        } else {
            Some(matched)
        }
    }
}

// ============================================================================
// SCALE TRANSITION
// ============================================================================

/// Scale transition scheme
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ScaleTransition {
    /// First-order (classical homogenization)
    FirstOrder,
    /// Second-order (strain gradient)
    SecondOrder { internal_length: f64 },
    /// Micromorphic
    Micromorphic { micro_modulus: f64 },
}

/// Multi-scale analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiScaleAnalysis {
    pub rve: RveGeometry,
    pub bounds: HomogenizationBounds,
    pub transition: ScaleTransition,
    pub effective_stiffness: EffectiveStiffness,
}

impl MultiScaleAnalysis {
    pub fn new(rve: RveGeometry, matrix: MaterialPhase, inclusion: MaterialPhase) -> Self {
        let bounds = HomogenizationBounds::new(matrix, inclusion);
        
        // Initial estimate using Mori-Tanaka
        let e_eff = bounds.mori_tanaka_modulus();
        let nu_eff = 0.3; // Simplified
        let effective_stiffness = EffectiveStiffness::from_isotropic(e_eff, nu_eff);
        
        Self {
            rve,
            bounds,
            transition: ScaleTransition::FirstOrder,
            effective_stiffness,
        }
    }
    
    /// Get homogenized modulus
    pub fn homogenized_modulus(&self) -> f64 {
        self.bounds.mori_tanaka_modulus()
    }
    
    /// Compute macro stress from macro strain
    pub fn macro_stress(&self, macro_strain: &MacroStrain) -> MacroStress {
        self.effective_stiffness.apply(macro_strain)
    }
    
    /// Error bounds
    pub fn modulus_bounds(&self) -> (f64, f64) {
        (self.bounds.reuss_modulus(), self.bounds.voigt_modulus())
    }
    
    /// Hashin-Shtrikman bounds
    pub fn hs_bounds(&self) -> (f64, f64) {
        let k_low = self.bounds.hs_lower_bulk();
        let k_up = self.bounds.hs_upper_bulk();
        let g_low = self.bounds.hs_lower_shear();
        let g_up = self.bounds.hs_upper_shear();
        
        let e_low = 9.0 * k_low * g_low / (3.0 * k_low + g_low);
        let e_up = 9.0 * k_up * g_up / (3.0 * k_up + g_up);
        
        (e_low, e_up)
    }
}

// ============================================================================
// FIBER COMPOSITES
// ============================================================================

/// Fiber composite micromechanics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FiberComposite {
    /// Fiber properties
    pub fiber: MaterialPhase,
    /// Matrix properties
    pub matrix: MaterialPhase,
    /// Fiber volume fraction
    pub vf: f64,
    /// Fiber orientation (degrees from 1-axis)
    pub orientation: f64,
}

impl FiberComposite {
    pub fn new(fiber: MaterialPhase, matrix: MaterialPhase, vf: f64) -> Self {
        Self {
            fiber,
            matrix,
            vf,
            orientation: 0.0,
        }
    }
    
    /// Longitudinal modulus E1 (Rule of Mixtures)
    pub fn e1(&self) -> f64 {
        self.vf * self.fiber.e + (1.0 - self.vf) * self.matrix.e
    }
    
    /// Transverse modulus E2 (Halpin-Tsai)
    pub fn e2(&self) -> f64 {
        let xi = 2.0; // For circular fibers
        let eta = (self.fiber.e / self.matrix.e - 1.0) / 
                  (self.fiber.e / self.matrix.e + xi);
        
        self.matrix.e * (1.0 + xi * eta * self.vf) / (1.0 - eta * self.vf)
    }
    
    /// In-plane shear modulus G12 (Halpin-Tsai)
    pub fn g12(&self) -> f64 {
        let xi = 1.0;
        let gf = self.fiber.shear_modulus();
        let gm = self.matrix.shear_modulus();
        
        let eta = (gf / gm - 1.0) / (gf / gm + xi);
        
        gm * (1.0 + xi * eta * self.vf) / (1.0 - eta * self.vf)
    }
    
    /// Major Poisson's ratio ν12
    pub fn nu12(&self) -> f64 {
        self.vf * self.fiber.nu + (1.0 - self.vf) * self.matrix.nu
    }
    
    /// Minor Poisson's ratio ν21
    pub fn nu21(&self) -> f64 {
        self.nu12() * self.e2() / self.e1()
    }
    
    /// Longitudinal strength (fiber failure)
    pub fn longitudinal_strength(&self) -> f64 {
        self.vf * self.fiber.sigma_y + (1.0 - self.vf) * self.matrix.sigma_y
    }
    
    /// Transformed stiffness for angle-ply
    pub fn transformed_stiffness(&self, angle: f64) -> [[f64; 3]; 3] {
        let theta = angle * PI / 180.0;
        let c = theta.cos();
        let s = theta.sin();
        
        let q11 = self.e1() / (1.0 - self.nu12() * self.nu21());
        let q22 = self.e2() / (1.0 - self.nu12() * self.nu21());
        let q12 = self.nu12() * q22;
        let q66 = self.g12();
        
        let c2 = c * c;
        let s2 = s * s;
        let _cs = c * s;
        
        [
            [
                q11 * c2.powi(2) + 2.0 * (q12 + 2.0 * q66) * c2 * s2 + q22 * s2.powi(2),
                (q11 + q22 - 4.0 * q66) * c2 * s2 + q12 * (c2.powi(2) + s2.powi(2)),
                (q11 - q12 - 2.0 * q66) * c * c2 * s + (q12 - q22 + 2.0 * q66) * c * s * s2,
            ],
            [
                (q11 + q22 - 4.0 * q66) * c2 * s2 + q12 * (c2.powi(2) + s2.powi(2)),
                q11 * s2.powi(2) + 2.0 * (q12 + 2.0 * q66) * c2 * s2 + q22 * c2.powi(2),
                (q11 - q12 - 2.0 * q66) * c * s * s2 + (q12 - q22 + 2.0 * q66) * c * c2 * s,
            ],
            [
                (q11 - q12 - 2.0 * q66) * c * c2 * s + (q12 - q22 + 2.0 * q66) * c * s * s2,
                (q11 - q12 - 2.0 * q66) * c * s * s2 + (q12 - q22 + 2.0 * q66) * c * c2 * s,
                (q11 + q22 - 2.0 * q12 - 2.0 * q66) * c2 * s2 + q66 * (c2.powi(2) + s2.powi(2)),
            ],
        ]
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rve_geometry() {
        let rve = RveGeometry::new(
            [10.0, 10.0, 10.0],
            0.3,
            InclusionType::Spherical { radius: 1.0 },
        );
        
        assert!((rve.volume() - 1000.0).abs() < 0.01);
        assert!(rve.num_inclusions > 0);
    }

    #[test]
    fn test_voigt_reuss_bounds() {
        let matrix = MaterialPhase::new("Matrix", 3000.0, 0.35, 50.0, 0.7);
        let inclusion = MaterialPhase::new("Inclusion", 70000.0, 0.2, 500.0, 0.3);
        
        let bounds = HomogenizationBounds::new(matrix, inclusion);
        
        let voigt = bounds.voigt_modulus();
        let reuss = bounds.reuss_modulus();
        
        assert!(voigt > reuss);
        assert!(voigt > 0.0);
        assert!(reuss > 0.0);
    }

    #[test]
    fn test_mori_tanaka() {
        let matrix = MaterialPhase::new("Matrix", 3000.0, 0.35, 50.0, 0.7);
        let inclusion = MaterialPhase::new("Inclusion", 70000.0, 0.2, 500.0, 0.3);
        
        let bounds = HomogenizationBounds::new(matrix, inclusion);
        
        let mt = bounds.mori_tanaka_modulus();
        let voigt = bounds.voigt_modulus();
        let reuss = bounds.reuss_modulus();
        
        assert!(mt >= reuss && mt <= voigt);
    }

    #[test]
    fn test_eshelby_sphere() {
        let eshelby = EshelbyTensor::sphere(0.3);
        
        let s1111 = eshelby.s1111_sphere();
        let s1122 = eshelby.s1122_sphere();
        
        assert!(s1111 > 0.0);
        assert!(s1111 > s1122.abs());
    }

    #[test]
    fn test_effective_stiffness() {
        let stiff = EffectiveStiffness::from_isotropic(200000.0, 0.3);
        
        let e1 = stiff.young_modulus_1();
        assert!((e1 - 200000.0).abs() / 200000.0 < 0.1);
    }

    #[test]
    fn test_fiber_composite() {
        let fiber = MaterialPhase::new("Carbon", 230000.0, 0.2, 3500.0, 0.6);
        let matrix = MaterialPhase::new("Epoxy", 3500.0, 0.35, 80.0, 0.4);
        
        let composite = FiberComposite::new(fiber, matrix, 0.6);
        
        let e1 = composite.e1();
        let e2 = composite.e2();
        
        assert!(e1 > e2);
        assert!(e1 > 100000.0);
    }

    #[test]
    fn test_multi_scale() {
        let rve = RveGeometry::new(
            [10.0, 10.0, 10.0],
            0.3,
            InclusionType::Spherical { radius: 1.0 },
        );
        
        let matrix = MaterialPhase::new("Matrix", 3000.0, 0.35, 50.0, 0.7);
        let inclusion = MaterialPhase::new("Inclusion", 70000.0, 0.2, 500.0, 0.3);
        
        let analysis = MultiScaleAnalysis::new(rve, matrix, inclusion);
        
        let e_eff = analysis.homogenized_modulus();
        let (e_low, e_high) = analysis.modulus_bounds();
        
        assert!(e_eff >= e_low && e_eff <= e_high);
    }

    #[test]
    fn test_periodic_boundary() {
        let pbc = PeriodicBoundary::new([10.0, 10.0, 10.0]);
        
        assert!(pbc.is_on_boundary([0.0, 5.0, 5.0], 0.01));
        assert!(pbc.is_on_boundary([10.0, 5.0, 5.0], 0.01));
        assert!(!pbc.is_on_boundary([5.0, 5.0, 5.0], 0.01));
    }

    #[test]
    fn test_hashin_shtrikman() {
        let matrix = MaterialPhase::new("Matrix", 3000.0, 0.35, 50.0, 0.7);
        let inclusion = MaterialPhase::new("Inclusion", 70000.0, 0.2, 500.0, 0.3);
        
        let bounds = HomogenizationBounds::new(matrix, inclusion);
        
        let hs_low = bounds.hs_lower_bulk();
        let hs_up = bounds.hs_upper_bulk();
        
        assert!(hs_up > hs_low);
    }
}
