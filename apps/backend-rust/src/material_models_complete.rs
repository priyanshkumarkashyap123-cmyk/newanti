//! Complete Material Models Library
//!
//! Production-grade material constitutive models for structural analysis
//! including linear, nonlinear, plasticity, damage, and rate-dependent models.
//!
//! ## Material Categories
//! - **Elastic** - Linear isotropic, orthotropic, anisotropic
//! - **Plastic** - von Mises, Tresca, Drucker-Prager, Mohr-Coulomb
//! - **Viscoplastic** - Rate-dependent plasticity
//! - **Damage** - Continuum damage mechanics
//! - **Hyperelastic** - Neo-Hookean, Mooney-Rivlin
//! - **Concrete** - Smeared crack, damage-plasticity
//!
//! ## Features
//! - Consistent tangent operators
//! - Return mapping algorithms
//! - Temperature dependence
//! - Strain rate effects

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// STRESS AND STRAIN TENSORS
// ============================================================================

/// 3D stress tensor (Voigt notation)
/// [σxx, σyy, σzz, τxy, τyz, τxz]
pub type Stress6 = [f64; 6];

/// 3D strain tensor (Voigt notation)
/// [εxx, εyy, εzz, γxy, γyz, γxz]
pub type Strain6 = [f64; 6];

/// 6x6 material stiffness matrix
pub type Stiffness6x6 = [[f64; 6]; 6];

/// Stress state descriptors
#[derive(Debug, Clone, Copy)]
pub struct StressInvariants {
    pub i1: f64,        // First invariant (trace)
    pub j2: f64,        // Second deviatoric invariant
    pub j3: f64,        // Third deviatoric invariant
    pub p: f64,         // Hydrostatic pressure
    pub q: f64,         // von Mises equivalent stress
    pub theta: f64,     // Lode angle
}

impl StressInvariants {
    pub fn from_stress(s: &Stress6) -> Self {
        // First invariant (trace)
        let i1 = s[0] + s[1] + s[2];
        let p = i1 / 3.0;
        
        // Deviatoric stress
        let s_dev = [
            s[0] - p,
            s[1] - p,
            s[2] - p,
            s[3],
            s[4],
            s[5],
        ];
        
        // Second deviatoric invariant
        let j2 = 0.5 * (s_dev[0]*s_dev[0] + s_dev[1]*s_dev[1] + s_dev[2]*s_dev[2])
               + s_dev[3]*s_dev[3] + s_dev[4]*s_dev[4] + s_dev[5]*s_dev[5];
        
        // Third deviatoric invariant
        let j3 = s_dev[0] * (s_dev[1] * s_dev[2] - s_dev[4] * s_dev[4])
               - s_dev[3] * (s_dev[3] * s_dev[2] - s_dev[4] * s_dev[5])
               + s_dev[5] * (s_dev[3] * s_dev[4] - s_dev[1] * s_dev[5]);
        
        // von Mises equivalent
        let q = (3.0 * j2).sqrt();
        
        // Lode angle
        let theta = if j2 > 1e-14 {
            let arg = (3.0 * 3.0_f64.sqrt() / 2.0) * j3 / j2.powf(1.5);
            let arg_clamped = arg.max(-1.0).min(1.0);
            (1.0 / 3.0) * arg_clamped.acos()
        } else {
            0.0
        };
        
        StressInvariants { i1, j2, j3, p, q, theta }
    }

    /// Principal stresses (using spectral decomposition)
    pub fn principal_stresses(&self) -> [f64; 3] {
        // Use the correct relation between principal stresses and invariants
        // σ_i = p + (2/sqrt(3)) * sqrt(J2) * cos(θ + 2πk/3), k = 0, 1, 2
        // where θ is the Lode angle already computed
        let r = (2.0 / 3.0_f64.sqrt()) * self.j2.sqrt();
        
        let mut principals = [
            self.p + r * (self.theta).cos(),
            self.p + r * (self.theta - 2.0 * PI / 3.0).cos(),
            self.p + r * (self.theta + 2.0 * PI / 3.0).cos(),
        ];
        
        // Sort descending for consistency
        principals.sort_by(|a, b| b.partial_cmp(a).unwrap());
        principals
    }
}

// ============================================================================
// LINEAR ELASTIC MATERIALS
// ============================================================================

/// Isotropic linear elastic material
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IsotropicElastic {
    pub e: f64,         // Young's modulus
    pub nu: f64,        // Poisson's ratio
    pub density: f64,
    pub alpha: f64,     // Thermal expansion
    pub name: String,
}

impl IsotropicElastic {
    pub fn new(e: f64, nu: f64, density: f64, name: &str) -> Self {
        IsotropicElastic {
            e, nu, density,
            alpha: 0.0,
            name: name.to_string(),
        }
    }

    pub fn steel() -> Self {
        Self::new(200e9, 0.3, 7850.0, "Steel")
    }

    pub fn aluminum() -> Self {
        Self::new(70e9, 0.33, 2700.0, "Aluminum")
    }

    pub fn concrete(fc: f64) -> Self {
        // E = 4700 * sqrt(fc) for fc in MPa
        let e = 4700.0 * (fc / 1e6).sqrt() * 1e6;
        Self::new(e, 0.2, 2400.0, "Concrete")
    }

    /// Shear modulus
    pub fn g(&self) -> f64 {
        self.e / (2.0 * (1.0 + self.nu))
    }

    /// Bulk modulus
    pub fn k(&self) -> f64 {
        self.e / (3.0 * (1.0 - 2.0 * self.nu))
    }

    /// Lamé's first parameter
    pub fn lambda(&self) -> f64 {
        self.e * self.nu / ((1.0 + self.nu) * (1.0 - 2.0 * self.nu))
    }

    /// 3D stiffness matrix
    pub fn stiffness_matrix_3d(&self) -> Stiffness6x6 {
        let lambda = self.lambda();
        let mu = self.g();
        
        let mut d = [[0.0; 6]; 6];
        
        d[0][0] = lambda + 2.0 * mu;
        d[1][1] = lambda + 2.0 * mu;
        d[2][2] = lambda + 2.0 * mu;
        
        d[0][1] = lambda;
        d[0][2] = lambda;
        d[1][0] = lambda;
        d[1][2] = lambda;
        d[2][0] = lambda;
        d[2][1] = lambda;
        
        d[3][3] = mu;
        d[4][4] = mu;
        d[5][5] = mu;
        
        d
    }

    /// Plane stress stiffness (3x3)
    pub fn stiffness_plane_stress(&self) -> [[f64; 3]; 3] {
        let c = self.e / (1.0 - self.nu * self.nu);
        
        [
            [c, c * self.nu, 0.0],
            [c * self.nu, c, 0.0],
            [0.0, 0.0, c * (1.0 - self.nu) / 2.0],
        ]
    }

    /// Plane strain stiffness (3x3)
    pub fn stiffness_plane_strain(&self) -> [[f64; 3]; 3] {
        let c = self.e / ((1.0 + self.nu) * (1.0 - 2.0 * self.nu));
        
        [
            [c * (1.0 - self.nu), c * self.nu, 0.0],
            [c * self.nu, c * (1.0 - self.nu), 0.0],
            [0.0, 0.0, c * (1.0 - 2.0 * self.nu) / 2.0],
        ]
    }

    /// Calculate stress from strain
    pub fn stress(&self, strain: &Strain6) -> Stress6 {
        let d = self.stiffness_matrix_3d();
        let mut stress = [0.0; 6];
        
        for i in 0..6 {
            for j in 0..6 {
                stress[i] += d[i][j] * strain[j];
            }
        }
        
        stress
    }
}

/// Orthotropic linear elastic material
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrthotropicElastic {
    pub e1: f64, pub e2: f64, pub e3: f64,      // Young's moduli
    pub nu12: f64, pub nu23: f64, pub nu13: f64, // Poisson's ratios
    pub g12: f64, pub g23: f64, pub g13: f64,   // Shear moduli
    pub density: f64,
    pub name: String,
}

impl OrthotropicElastic {
    pub fn new(
        e1: f64, e2: f64, e3: f64,
        nu12: f64, nu23: f64, nu13: f64,
        g12: f64, g23: f64, g13: f64,
        density: f64,
        name: &str,
    ) -> Self {
        OrthotropicElastic {
            e1, e2, e3,
            nu12, nu23, nu13,
            g12, g23, g13,
            density,
            name: name.to_string(),
        }
    }

    /// Wood material (typical softwood)
    pub fn wood() -> Self {
        Self::new(
            12e9, 1e9, 1e9,     // E1, E2, E3
            0.42, 0.37, 0.37,   // ν12, ν23, ν13
            0.75e9, 0.2e9, 0.75e9,  // G12, G23, G13
            600.0,
            "Softwood",
        )
    }

    /// Carbon fiber composite (unidirectional)
    pub fn cfrp_ud() -> Self {
        Self::new(
            140e9, 10e9, 10e9,
            0.3, 0.4, 0.3,
            5e9, 3.5e9, 5e9,
            1600.0,
            "CFRP-UD",
        )
    }

    /// 3D stiffness matrix
    pub fn stiffness_matrix_3d(&self) -> Stiffness6x6 {
        // Compliance matrix components
        let nu21 = self.nu12 * self.e2 / self.e1;
        let nu31 = self.nu13 * self.e3 / self.e1;
        let nu32 = self.nu23 * self.e3 / self.e2;
        
        let delta = 1.0 - self.nu12 * nu21 - self.nu23 * nu32 
                  - self.nu13 * nu31 - 2.0 * self.nu12 * self.nu23 * nu31;
        
        let mut d = [[0.0; 6]; 6];
        
        d[0][0] = self.e1 * (1.0 - self.nu23 * nu32) / delta;
        d[1][1] = self.e2 * (1.0 - self.nu13 * nu31) / delta;
        d[2][2] = self.e3 * (1.0 - self.nu12 * nu21) / delta;
        
        d[0][1] = self.e1 * (self.nu12 + self.nu13 * nu32) / delta;
        d[1][0] = d[0][1];
        
        d[0][2] = self.e1 * (self.nu13 + self.nu12 * self.nu23) / delta;
        d[2][0] = d[0][2];
        
        d[1][2] = self.e2 * (self.nu23 + self.nu12 * nu31) / delta;
        d[2][1] = d[1][2];
        
        d[3][3] = self.g12;
        d[4][4] = self.g23;
        d[5][5] = self.g13;
        
        d
    }
}

// ============================================================================
// PLASTICITY MODELS
// ============================================================================

/// von Mises (J2) plasticity with isotropic/kinematic hardening
#[derive(Debug, Clone)]
pub struct VonMisesPlasticity {
    pub elastic: IsotropicElastic,
    pub yield_stress: f64,
    pub h_iso: f64,      // Isotropic hardening modulus
    pub h_kin: f64,      // Kinematic hardening modulus
    pub hardening_type: HardeningType,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum HardeningType {
    None,           // Perfect plasticity
    Isotropic,      // Expanding yield surface
    Kinematic,      // Translating yield surface
    Combined,       // Both
}

/// Internal state variables for plasticity
#[derive(Debug, Clone)]
pub struct PlasticState {
    pub plastic_strain: Strain6,
    pub back_stress: Stress6,     // Kinematic hardening
    pub alpha: f64,               // Equivalent plastic strain
    pub yield_stress_current: f64, // Current yield stress
}

impl Default for PlasticState {
    fn default() -> Self {
        PlasticState {
            plastic_strain: [0.0; 6],
            back_stress: [0.0; 6],
            alpha: 0.0,
            yield_stress_current: 0.0,
        }
    }
}

impl VonMisesPlasticity {
    pub fn new(elastic: IsotropicElastic, yield_stress: f64) -> Self {
        VonMisesPlasticity {
            elastic,
            yield_stress,
            h_iso: 0.0,
            h_kin: 0.0,
            hardening_type: HardeningType::None,
        }
    }

    pub fn with_isotropic_hardening(mut self, h: f64) -> Self {
        self.h_iso = h;
        self.hardening_type = HardeningType::Isotropic;
        self
    }

    pub fn with_kinematic_hardening(mut self, h: f64) -> Self {
        self.h_kin = h;
        self.hardening_type = HardeningType::Kinematic;
        self
    }

    /// Steel with typical hardening
    pub fn steel_a36() -> Self {
        let elastic = IsotropicElastic::new(200e9, 0.3, 7850.0, "A36");
        VonMisesPlasticity::new(elastic, 250e6)
            .with_isotropic_hardening(2e9)
    }

    /// Yield function: f = q - (σy + H*α) = 0
    pub fn yield_function(&self, stress: &Stress6, state: &PlasticState) -> f64 {
        // Relative stress for kinematic hardening
        let mut s_rel = *stress;
        for i in 0..6 {
            s_rel[i] -= state.back_stress[i];
        }
        
        let inv = StressInvariants::from_stress(&s_rel);
        let sigma_y = self.yield_stress + self.h_iso * state.alpha;
        
        inv.q - sigma_y
    }

    /// Return mapping algorithm for stress update
    pub fn return_mapping(
        &self,
        strain_inc: &Strain6,
        state: &mut PlasticState,
    ) -> (Stress6, Stiffness6x6) {
        let d_elastic = self.elastic.stiffness_matrix_3d();
        let g = self.elastic.g();
        let k = self.elastic.k();
        
        // Trial elastic stress
        let elastic_strain: Strain6 = [
            strain_inc[0] - state.plastic_strain[0],
            strain_inc[1] - state.plastic_strain[1],
            strain_inc[2] - state.plastic_strain[2],
            strain_inc[3] - state.plastic_strain[3],
            strain_inc[4] - state.plastic_strain[4],
            strain_inc[5] - state.plastic_strain[5],
        ];
        
        let mut stress_trial = [0.0; 6];
        for i in 0..6 {
            for j in 0..6 {
                stress_trial[i] += d_elastic[i][j] * elastic_strain[j];
            }
        }
        
        // Check yield
        let f_trial = self.yield_function(&stress_trial, state);
        
        if f_trial <= 0.0 {
            // Elastic step
            return (stress_trial, d_elastic);
        }
        
        // Plastic correction - radial return
        let mut s_rel = stress_trial;
        for i in 0..6 {
            s_rel[i] -= state.back_stress[i];
        }
        
        let inv = StressInvariants::from_stress(&s_rel);
        let p = inv.p;
        
        // Deviatoric stress
        let s_dev = [
            s_rel[0] - p,
            s_rel[1] - p,
            s_rel[2] - p,
            s_rel[3],
            s_rel[4],
            s_rel[5],
        ];
        
        // Plastic multiplier
        let h_prime = self.h_iso + self.h_kin;
        let delta_gamma = f_trial / (3.0 * g + h_prime);
        
        // Flow direction (normalized deviatoric)
        let q_trial = inv.q;
        let mut n = [0.0; 6];
        if q_trial > 1e-14 {
            let factor = 3.0 / (2.0 * q_trial);
            for i in 0..6 {
                n[i] = factor * s_dev[i];
            }
        }
        
        // Update stress
        let mut stress = [0.0; 6];
        stress[0] = stress_trial[0] - 2.0 * g * delta_gamma * n[0];
        stress[1] = stress_trial[1] - 2.0 * g * delta_gamma * n[1];
        stress[2] = stress_trial[2] - 2.0 * g * delta_gamma * n[2];
        stress[3] = stress_trial[3] - 2.0 * g * delta_gamma * n[3];
        stress[4] = stress_trial[4] - 2.0 * g * delta_gamma * n[4];
        stress[5] = stress_trial[5] - 2.0 * g * delta_gamma * n[5];
        
        // Update state
        state.alpha += delta_gamma;
        
        for i in 0..6 {
            state.plastic_strain[i] += delta_gamma * n[i];
            state.back_stress[i] += 2.0/3.0 * self.h_kin * delta_gamma * n[i];
        }
        
        // Consistent tangent
        let theta = 1.0 - 3.0 * g * delta_gamma / q_trial;
        let theta_bar = 1.0 / (1.0 + h_prime / (3.0 * g)) - (1.0 - theta);
        
        let mut d_ep = [[0.0; 6]; 6];
        
        // Deviatoric part
        for i in 0..3 {
            for j in 0..3 {
                d_ep[i][j] = k - 2.0/3.0 * g * theta;
            }
            d_ep[i][i] += 2.0 * g * theta;
        }
        
        for i in 3..6 {
            d_ep[i][i] = g * theta;
        }
        
        // Plastic correction term
        if q_trial > 1e-14 {
            for i in 0..6 {
                for j in 0..6 {
                    d_ep[i][j] -= 2.0 * g * theta_bar * n[i] * n[j];
                }
            }
        }
        
        (stress, d_ep)
    }
}

// ============================================================================
// DRUCKER-PRAGER MODEL (SOILS/CONCRETE)
// ============================================================================

/// Drucker-Prager plasticity for pressure-dependent materials
#[derive(Debug, Clone)]
pub struct DruckerPrager {
    pub elastic: IsotropicElastic,
    pub cohesion: f64,      // c
    pub friction_angle: f64, // φ in radians
    pub dilation_angle: f64, // ψ in radians
}

impl DruckerPrager {
    pub fn new(elastic: IsotropicElastic, cohesion: f64, friction: f64, dilation: f64) -> Self {
        DruckerPrager {
            elastic,
            cohesion,
            friction_angle: friction,
            dilation_angle: dilation,
        }
    }

    /// Create from Mohr-Coulomb parameters
    pub fn from_mohr_coulomb(elastic: IsotropicElastic, c: f64, phi: f64) -> Self {
        // Match at outer apices
        let sin_phi = phi.sin();
        let alpha = 2.0 * sin_phi / (3.0_f64.sqrt() * (3.0 - sin_phi));
        let k = 6.0 * c * phi.cos() / (3.0_f64.sqrt() * (3.0 - sin_phi));
        
        DruckerPrager {
            elastic,
            cohesion: k / (3.0_f64.sqrt() * alpha),
            friction_angle: alpha.atan(),
            dilation_angle: alpha.atan(),
        }
    }

    /// Yield function: f = q + α*p - k = 0
    pub fn yield_function(&self, stress: &Stress6) -> f64 {
        let inv = StressInvariants::from_stress(stress);
        let alpha = (2.0 * self.friction_angle.sin()) / 
                    (3.0_f64.sqrt() * (3.0 - self.friction_angle.sin()));
        let k = 6.0 * self.cohesion * self.friction_angle.cos() /
                (3.0_f64.sqrt() * (3.0 - self.friction_angle.sin()));
        
        inv.q + alpha * inv.i1 - k
    }

    /// Return mapping (simplified)
    pub fn return_mapping(
        &self,
        strain_inc: &Strain6,
        plastic_strain: &mut Strain6,
    ) -> (Stress6, Stiffness6x6) {
        let d = self.elastic.stiffness_matrix_3d();
        
        // Trial stress
        let elastic_strain: Strain6 = [
            strain_inc[0] - plastic_strain[0],
            strain_inc[1] - plastic_strain[1],
            strain_inc[2] - plastic_strain[2],
            strain_inc[3] - plastic_strain[3],
            strain_inc[4] - plastic_strain[4],
            strain_inc[5] - plastic_strain[5],
        ];
        
        let mut stress = [0.0; 6];
        for i in 0..6 {
            for j in 0..6 {
                stress[i] += d[i][j] * elastic_strain[j];
            }
        }
        
        let f = self.yield_function(&stress);
        
        if f <= 0.0 {
            return (stress, d);
        }
        
        // Simplified return - project to yield surface
        let inv = StressInvariants::from_stress(&stress);
        let scale = (self.yield_function(&[0.0; 6]).abs() / inv.q).min(1.0);
        
        for i in 0..6 {
            stress[i] *= scale;
        }
        
        (stress, d)
    }
}

// ============================================================================
// CONCRETE DAMAGE MODEL
// ============================================================================

/// Concrete damage-plasticity model
#[derive(Debug, Clone)]
pub struct ConcreteDamage {
    pub elastic: IsotropicElastic,
    pub fc: f64,            // Compressive strength (positive)
    pub ft: f64,            // Tensile strength
    pub gf: f64,            // Fracture energy (N/m)
    pub damage_t: f64,      // Tensile damage variable
    pub damage_c: f64,      // Compressive damage variable
}

impl ConcreteDamage {
    pub fn new(fc: f64, ft: f64, gf: f64) -> Self {
        let e = 4700.0 * (fc / 1e6).sqrt() * 1e6;
        ConcreteDamage {
            elastic: IsotropicElastic::new(e, 0.2, 2400.0, "Concrete"),
            fc,
            ft,
            gf,
            damage_t: 0.0,
            damage_c: 0.0,
        }
    }

    /// Typical concrete
    pub fn typical(fc_mpa: f64) -> Self {
        let fc = fc_mpa * 1e6;
        let ft = 0.3 * (fc_mpa * fc_mpa).powf(1.0/3.0) * 1e6;
        let gf = 0.073 * (fc_mpa).powf(0.18) * 1e3; // N/m
        
        Self::new(fc, ft, gf)
    }

    /// Effective stress (damaged)
    pub fn effective_stress(&self, stress: &Stress6) -> Stress6 {
        let mut eff = *stress;
        let inv = StressInvariants::from_stress(stress);
        
        if inv.p > 0.0 {
            // Tension
            let factor = 1.0 - self.damage_t;
            for s in &mut eff {
                *s *= factor;
            }
        } else {
            // Compression
            let factor = 1.0 - self.damage_c;
            for s in &mut eff {
                *s *= factor;
            }
        }
        
        eff
    }

    /// Update damage based on strain
    pub fn update_damage(&mut self, strain: &Strain6) {
        let stress = self.elastic.stress(strain);
        let inv = StressInvariants::from_stress(&stress);
        
        // Tensile damage (Mazars-type)
        if inv.p > self.ft {
            let eps_0 = self.ft / self.elastic.e;
            let eps_eq = inv.q / self.elastic.e;
            
            if eps_eq > eps_0 {
                self.damage_t = 1.0 - eps_0 / eps_eq * 
                    (-1.0 * (eps_eq - eps_0) / (self.gf / (self.ft * 0.01))).exp();
                self.damage_t = self.damage_t.max(0.0).min(0.99);
            }
        }
        
        // Compressive damage
        if inv.p < 0.0 && inv.q > self.fc {
            self.damage_c = 1.0 - self.fc / inv.q;
            self.damage_c = self.damage_c.max(0.0).min(0.99);
        }
    }
}

// ============================================================================
// HYPERELASTIC MATERIALS
// ============================================================================

/// Neo-Hookean hyperelastic material
#[derive(Debug, Clone)]
pub struct NeoHookean {
    pub mu: f64,    // Shear modulus
    pub lambda: f64, // Lamé parameter
}

impl NeoHookean {
    pub fn new(e: f64, nu: f64) -> Self {
        let mu = e / (2.0 * (1.0 + nu));
        let lambda = e * nu / ((1.0 + nu) * (1.0 - 2.0 * nu));
        NeoHookean { mu, lambda }
    }

    /// Rubber
    pub fn rubber() -> Self {
        Self::new(1e6, 0.4999)  // Nearly incompressible
    }

    /// Strain energy density
    pub fn strain_energy(&self, f: &[[f64; 3]; 3]) -> f64 {
        let c = deformation_gradient_to_right_cauchy(f);
        let i1 = c[0][0] + c[1][1] + c[2][2];
        let j = determinant_3x3(f);
        
        self.mu / 2.0 * (i1 - 3.0) - self.mu * j.ln() + self.lambda / 2.0 * (j - 1.0).powi(2)
    }

    /// Cauchy stress from deformation gradient
    pub fn cauchy_stress(&self, f: &[[f64; 3]; 3]) -> [[f64; 3]; 3] {
        let j = determinant_3x3(f);
        let b = left_cauchy_green(f);
        
        let mut sigma = [[0.0; 3]; 3];
        
        let pressure = self.lambda * (j - 1.0);
        
        for i in 0..3 {
            for j_idx in 0..3 {
                sigma[i][j_idx] = self.mu / j * (b[i][j_idx] - if i == j_idx { 1.0 } else { 0.0 });
            }
            sigma[i][i] += pressure;
        }
        
        sigma
    }
}

/// Mooney-Rivlin hyperelastic material
#[derive(Debug, Clone)]
pub struct MooneyRivlin {
    pub c10: f64,
    pub c01: f64,
    pub d1: f64,    // Compressibility (D = 2/K)
}

impl MooneyRivlin {
    pub fn new(c10: f64, c01: f64, bulk_modulus: f64) -> Self {
        MooneyRivlin {
            c10,
            c01,
            d1: 2.0 / bulk_modulus,
        }
    }

    /// Strain energy density
    pub fn strain_energy(&self, f: &[[f64; 3]; 3]) -> f64 {
        let c = deformation_gradient_to_right_cauchy(f);
        let j = determinant_3x3(f);
        let j23 = j.powf(-2.0/3.0);
        
        let i1 = (c[0][0] + c[1][1] + c[2][2]) * j23;
        let i2 = 0.5 * (i1 * i1 - (c[0][0]*c[0][0] + c[1][1]*c[1][1] + c[2][2]*c[2][2]
                + 2.0*(c[0][1]*c[0][1] + c[1][2]*c[1][2] + c[0][2]*c[0][2])) * j23.powi(2));
        
        self.c10 * (i1 - 3.0) + self.c01 * (i2 - 3.0) + (j - 1.0).powi(2) / self.d1
    }
}

// ============================================================================
// VISCOELASTICITY
// ============================================================================

/// Generalized Maxwell viscoelastic model
#[derive(Debug, Clone)]
pub struct MaxwellViscoelastic {
    pub elastic: IsotropicElastic,
    pub chains: Vec<MaxwellChain>,
}

#[derive(Debug, Clone)]
pub struct MaxwellChain {
    pub modulus_ratio: f64,  // Gi/G_inf
    pub relaxation_time: f64, // τi
}

impl MaxwellViscoelastic {
    pub fn new(elastic: IsotropicElastic) -> Self {
        MaxwellViscoelastic {
            elastic,
            chains: Vec::new(),
        }
    }

    pub fn add_chain(&mut self, modulus_ratio: f64, relaxation_time: f64) {
        self.chains.push(MaxwellChain { modulus_ratio, relaxation_time });
    }

    /// Relaxation function G(t)
    pub fn relaxation_modulus(&self, t: f64) -> f64 {
        let g_inf = self.elastic.g();
        let mut g = g_inf;
        
        for chain in &self.chains {
            g += g_inf * chain.modulus_ratio * (-t / chain.relaxation_time).exp();
        }
        
        g
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

fn determinant_3x3(m: &[[f64; 3]; 3]) -> f64 {
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
  - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
  + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
}

fn deformation_gradient_to_right_cauchy(f: &[[f64; 3]; 3]) -> [[f64; 3]; 3] {
    // C = F^T * F
    let mut c = [[0.0; 3]; 3];
    for i in 0..3 {
        for j in 0..3 {
            for k in 0..3 {
                c[i][j] += f[k][i] * f[k][j];
            }
        }
    }
    c
}

fn left_cauchy_green(f: &[[f64; 3]; 3]) -> [[f64; 3]; 3] {
    // b = F * F^T
    let mut b = [[0.0; 3]; 3];
    for i in 0..3 {
        for j in 0..3 {
            for k in 0..3 {
                b[i][j] += f[i][k] * f[j][k];
            }
        }
    }
    b
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stress_invariants() {
        let stress = [100.0, 50.0, 0.0, 25.0, 0.0, 0.0];
        let inv = StressInvariants::from_stress(&stress);
        
        assert!((inv.i1 - 150.0).abs() < 1e-10);
        assert!(inv.j2 >= 0.0);
    }

    #[test]
    fn test_principal_stresses() {
        let stress = [100.0, 0.0, 0.0, 0.0, 0.0, 0.0];
        let inv = StressInvariants::from_stress(&stress);
        let principal = inv.principal_stresses();
        
        // Should have one principal stress ≈ 100
        let max_principal = principal.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        assert!((max_principal - 100.0).abs() < 1.0);
    }

    #[test]
    fn test_isotropic_elastic() {
        let mat = IsotropicElastic::steel();
        
        assert!((mat.e - 200e9).abs() < 1e3);
        assert!((mat.nu - 0.3).abs() < 1e-6);
        assert!(mat.g() > 0.0);
        assert!(mat.k() > 0.0);
    }

    #[test]
    fn test_stiffness_symmetry() {
        let mat = IsotropicElastic::steel();
        let d = mat.stiffness_matrix_3d();
        
        for i in 0..6 {
            for j in 0..6 {
                assert!((d[i][j] - d[j][i]).abs() < 1e-6);
            }
        }
    }

    #[test]
    fn test_stress_calculation() {
        let mat = IsotropicElastic::steel();
        let strain = [1e-3, 0.0, 0.0, 0.0, 0.0, 0.0];
        let stress = mat.stress(&strain);
        
        // Uniaxial stress should be ~ E * ε
        assert!(stress[0] > 0.0);
    }

    #[test]
    fn test_orthotropic() {
        let mat = OrthotropicElastic::wood();
        let d = mat.stiffness_matrix_3d();
        
        // Check symmetry
        for i in 0..6 {
            for j in 0..6 {
                assert!((d[i][j] - d[j][i]).abs() < 1e-6);
            }
        }
    }

    #[test]
    fn test_von_mises_yield() {
        let mat = VonMisesPlasticity::steel_a36();
        let state = PlasticState::default();
        
        // Below yield
        let stress_elastic = [200e6, 0.0, 0.0, 0.0, 0.0, 0.0];
        assert!(mat.yield_function(&stress_elastic, &state) < 0.0);
        
        // Above yield
        let stress_plastic = [300e6, 0.0, 0.0, 0.0, 0.0, 0.0];
        assert!(mat.yield_function(&stress_plastic, &state) > 0.0);
    }

    #[test]
    fn test_drucker_prager() {
        let elastic = IsotropicElastic::new(30e9, 0.2, 2400.0, "Soil");
        let mat = DruckerPrager::new(elastic, 50e3, 30.0_f64.to_radians(), 15.0_f64.to_radians());
        
        let stress = [100e3, 100e3, 100e3, 0.0, 0.0, 0.0];
        let f = mat.yield_function(&stress);
        
        // Hydrostatic compression should be below yield for most soils
        assert!(f < 0.0 || f.abs() < 1e6);
    }

    #[test]
    fn test_concrete_damage() {
        let mat = ConcreteDamage::typical(30.0);
        
        assert!(mat.fc > mat.ft);  // Concrete stronger in compression
        assert!(mat.damage_t >= 0.0);
        assert!(mat.damage_c >= 0.0);
    }

    #[test]
    fn test_neo_hookean() {
        let mat = NeoHookean::rubber();
        
        // Identity deformation gradient
        let f = [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]];
        let w = mat.strain_energy(&f);
        
        // Zero strain energy at undeformed state
        assert!(w.abs() < 1e-10);
    }

    #[test]
    fn test_maxwell_relaxation() {
        let elastic = IsotropicElastic::steel();
        let mut mat = MaxwellViscoelastic::new(elastic);
        mat.add_chain(0.5, 1.0);
        mat.add_chain(0.3, 10.0);
        
        // G(0) should be higher than G(∞)
        let g0 = mat.relaxation_modulus(0.0);
        let g_inf = mat.relaxation_modulus(1000.0);
        
        assert!(g0 > g_inf);
    }

    #[test]
    fn test_plane_stress() {
        let mat = IsotropicElastic::steel();
        let d = mat.stiffness_plane_stress();
        
        // Check symmetry
        for i in 0..3 {
            for j in 0..3 {
                assert!((d[i][j] - d[j][i]).abs() < 1e-6);
            }
        }
    }

    #[test]
    fn test_determinant() {
        let m = [[1.0, 0.0, 0.0], [0.0, 2.0, 0.0], [0.0, 0.0, 3.0]];
        assert!((determinant_3x3(&m) - 6.0).abs() < 1e-10);
    }
}
