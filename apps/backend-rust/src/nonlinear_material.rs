// ============================================================================
// NONLINEAR MATERIAL MODELS - Plasticity, Damage, Viscoplasticity
// von Mises, Drucker-Prager, Concrete Damage Plasticity
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// STRESS-STRAIN STATE
// ============================================================================

/// 3D stress tensor (Voigt notation)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StressTensor {
    /// σxx
    pub s11: f64,
    /// σyy
    pub s22: f64,
    /// σzz
    pub s33: f64,
    /// τxy
    pub s12: f64,
    /// τyz
    pub s23: f64,
    /// τxz
    pub s13: f64,
}

impl StressTensor {
    pub fn new(s11: f64, s22: f64, s33: f64, s12: f64, s23: f64, s13: f64) -> Self {
        Self { s11, s22, s33, s12, s23, s13 }
    }
    
    pub fn zero() -> Self {
        Self::new(0.0, 0.0, 0.0, 0.0, 0.0, 0.0)
    }
    
    /// Hydrostatic pressure (mean stress)
    pub fn hydrostatic(&self) -> f64 {
        (self.s11 + self.s22 + self.s33) / 3.0
    }
    
    /// First invariant I1
    pub fn i1(&self) -> f64 {
        self.s11 + self.s22 + self.s33
    }
    
    /// Second invariant I2
    pub fn i2(&self) -> f64 {
        self.s11 * self.s22 + self.s22 * self.s33 + self.s33 * self.s11 -
        self.s12.powi(2) - self.s23.powi(2) - self.s13.powi(2)
    }
    
    /// Third invariant I3
    pub fn i3(&self) -> f64 {
        self.s11 * self.s22 * self.s33 +
        2.0 * self.s12 * self.s23 * self.s13 -
        self.s11 * self.s23.powi(2) -
        self.s22 * self.s13.powi(2) -
        self.s33 * self.s12.powi(2)
    }
    
    /// Deviatoric stress tensor
    pub fn deviatoric(&self) -> StressTensor {
        let p = self.hydrostatic();
        StressTensor {
            s11: self.s11 - p,
            s22: self.s22 - p,
            s33: self.s33 - p,
            s12: self.s12,
            s23: self.s23,
            s13: self.s13,
        }
    }
    
    /// J2 (second deviatoric invariant)
    pub fn j2(&self) -> f64 {
        let dev = self.deviatoric();
        0.5 * (dev.s11.powi(2) + dev.s22.powi(2) + dev.s33.powi(2)) +
        dev.s12.powi(2) + dev.s23.powi(2) + dev.s13.powi(2)
    }
    
    /// J3 (third deviatoric invariant)
    pub fn j3(&self) -> f64 {
        let dev = self.deviatoric();
        dev.i3()
    }
    
    /// von Mises equivalent stress
    pub fn von_mises(&self) -> f64 {
        (3.0 * self.j2()).sqrt()
    }
    
    /// Lode angle (radians)
    pub fn lode_angle(&self) -> f64 {
        let j2 = self.j2();
        let j3 = self.j3();
        
        if j2 < 1e-10 {
            0.0
        } else {
            let cos_3theta = (3.0 * 3.0_f64.sqrt() / 2.0) * j3 / j2.powf(1.5);
            cos_3theta.clamp(-1.0, 1.0).acos() / 3.0
        }
    }
    
    /// Principal stresses
    pub fn principal(&self) -> (f64, f64, f64) {
        let i1 = self.i1();
        let i2 = self.i2();
        let i3 = self.i3();
        
        // Solve cubic equation
        let p = i1 / 3.0;
        let q = (2.0 * i1.powi(3) - 9.0 * i1 * i2 + 27.0 * i3) / 54.0;
        let r = ((i1.powi(2) - 3.0 * i2) / 9.0).max(0.0);
        
        let phi = if r > 1e-10 {
            (q / (r * r.sqrt())).clamp(-1.0, 1.0).acos() / 3.0
        } else {
            0.0
        };
        
        let sqrt_r = r.sqrt();
        let s1 = p + 2.0 * sqrt_r * phi.cos();
        let s2 = p + 2.0 * sqrt_r * (phi + 2.0 * PI / 3.0).cos();
        let s3 = p + 2.0 * sqrt_r * (phi + 4.0 * PI / 3.0).cos();
        
        // Sort descending
        let mut principals = [s1, s2, s3];
        principals.sort_by(|a, b| b.partial_cmp(a).unwrap());
        
        (principals[0], principals[1], principals[2])
    }
}

/// Strain tensor (Voigt notation)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrainTensor {
    pub e11: f64,
    pub e22: f64,
    pub e33: f64,
    pub e12: f64, // Engineering shear / 2
    pub e23: f64,
    pub e13: f64,
}

impl StrainTensor {
    pub fn new(e11: f64, e22: f64, e33: f64, e12: f64, e23: f64, e13: f64) -> Self {
        Self { e11, e22, e33, e12, e23, e13 }
    }
    
    pub fn zero() -> Self {
        Self::new(0.0, 0.0, 0.0, 0.0, 0.0, 0.0)
    }
    
    /// Volumetric strain
    pub fn volumetric(&self) -> f64 {
        self.e11 + self.e22 + self.e33
    }
    
    /// Equivalent plastic strain (for isotropic hardening)
    pub fn equivalent(&self) -> f64 {
        let dev_e11 = self.e11 - self.volumetric() / 3.0;
        let dev_e22 = self.e22 - self.volumetric() / 3.0;
        let dev_e33 = self.e33 - self.volumetric() / 3.0;
        
        (2.0 / 3.0 * (dev_e11.powi(2) + dev_e22.powi(2) + dev_e33.powi(2) +
         2.0 * (self.e12.powi(2) + self.e23.powi(2) + self.e13.powi(2)))).sqrt()
    }
    
    /// Add strains
    pub fn add(&self, other: &StrainTensor) -> StrainTensor {
        StrainTensor {
            e11: self.e11 + other.e11,
            e22: self.e22 + other.e22,
            e33: self.e33 + other.e33,
            e12: self.e12 + other.e12,
            e23: self.e23 + other.e23,
            e13: self.e13 + other.e13,
        }
    }
    
    /// Scale strain
    pub fn scale(&self, factor: f64) -> StrainTensor {
        StrainTensor {
            e11: self.e11 * factor,
            e22: self.e22 * factor,
            e33: self.e33 * factor,
            e12: self.e12 * factor,
            e23: self.e23 * factor,
            e13: self.e13 * factor,
        }
    }
}

// ============================================================================
// VON MISES PLASTICITY
// ============================================================================

/// von Mises plasticity model with isotropic hardening
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VonMisesPlasticity {
    /// Young's modulus (MPa)
    pub e: f64,
    /// Poisson's ratio
    pub nu: f64,
    /// Initial yield stress (MPa)
    pub sigma_y0: f64,
    /// Hardening modulus (MPa)
    pub h: f64,
    /// Accumulated plastic strain
    pub eps_p_eq: f64,
}

impl VonMisesPlasticity {
    pub fn new(e: f64, nu: f64, sigma_y0: f64, h: f64) -> Self {
        Self {
            e,
            nu,
            sigma_y0,
            h,
            eps_p_eq: 0.0,
        }
    }
    
    /// Current yield stress with hardening
    pub fn current_yield(&self) -> f64 {
        self.sigma_y0 + self.h * self.eps_p_eq
    }
    
    /// Yield function f = σ_vm - σ_y
    pub fn yield_function(&self, stress: &StressTensor) -> f64 {
        stress.von_mises() - self.current_yield()
    }
    
    /// Check if stress state is elastic
    pub fn is_elastic(&self, stress: &StressTensor) -> bool {
        self.yield_function(stress) <= 0.0
    }
    
    /// Bulk modulus
    pub fn bulk_modulus(&self) -> f64 {
        self.e / (3.0 * (1.0 - 2.0 * self.nu))
    }
    
    /// Shear modulus
    pub fn shear_modulus(&self) -> f64 {
        self.e / (2.0 * (1.0 + self.nu))
    }
    
    /// Elastic stress from strain
    pub fn elastic_stress(&self, strain: &StrainTensor) -> StressTensor {
        let lambda = self.e * self.nu / ((1.0 + self.nu) * (1.0 - 2.0 * self.nu));
        let mu = self.shear_modulus();
        let ev = strain.volumetric();
        
        StressTensor {
            s11: lambda * ev + 2.0 * mu * strain.e11,
            s22: lambda * ev + 2.0 * mu * strain.e22,
            s33: lambda * ev + 2.0 * mu * strain.e33,
            s12: 2.0 * mu * strain.e12,
            s23: 2.0 * mu * strain.e23,
            s13: 2.0 * mu * strain.e13,
        }
    }
    
    /// Radial return mapping algorithm
    pub fn return_mapping(&mut self, trial_stress: &StressTensor) -> (StressTensor, StrainTensor) {
        let sigma_vm = trial_stress.von_mises();
        let sigma_y = self.current_yield();
        
        if sigma_vm <= sigma_y {
            // Elastic
            return (trial_stress.clone(), StrainTensor::zero());
        }
        
        // Plastic correction
        let mu = self.shear_modulus();
        let dev = trial_stress.deviatoric();
        
        // Solve for plastic multiplier
        let delta_lambda = (sigma_vm - sigma_y) / (3.0 * mu + self.h);
        
        // Update plastic strain
        self.eps_p_eq += delta_lambda;
        
        // Corrected stress
        let factor = 1.0 - 3.0 * mu * delta_lambda / sigma_vm;
        let corrected = StressTensor {
            s11: trial_stress.hydrostatic() + factor * dev.s11,
            s22: trial_stress.hydrostatic() + factor * dev.s22,
            s33: trial_stress.hydrostatic() + factor * dev.s33,
            s12: factor * dev.s12,
            s23: factor * dev.s23,
            s13: factor * dev.s13,
        };
        
        // Plastic strain increment
        let n_factor = delta_lambda / sigma_vm;
        let plastic_strain = StrainTensor {
            e11: 1.5 * n_factor * dev.s11,
            e22: 1.5 * n_factor * dev.s22,
            e33: 1.5 * n_factor * dev.s33,
            e12: 1.5 * n_factor * dev.s12,
            e23: 1.5 * n_factor * dev.s23,
            e13: 1.5 * n_factor * dev.s13,
        };
        
        (corrected, plastic_strain)
    }
}

// ============================================================================
// DRUCKER-PRAGER PLASTICITY
// ============================================================================

/// Drucker-Prager plasticity for pressure-dependent materials
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DruckerPrager {
    /// Young's modulus (MPa)
    pub e: f64,
    /// Poisson's ratio
    pub nu: f64,
    /// Friction angle (degrees)
    pub phi: f64,
    /// Cohesion (MPa)
    pub c: f64,
    /// Dilation angle (degrees)
    pub psi: f64,
    /// Hardening modulus (MPa)
    pub h: f64,
    /// Accumulated plastic strain
    pub eps_p_eq: f64,
}

impl DruckerPrager {
    pub fn new(e: f64, nu: f64, phi: f64, c: f64, psi: f64) -> Self {
        Self {
            e,
            nu,
            phi,
            c,
            psi,
            h: 0.0,
            eps_p_eq: 0.0,
        }
    }
    
    /// From Mohr-Coulomb parameters (plane strain matching)
    pub fn from_mohr_coulomb(e: f64, nu: f64, phi_deg: f64, c: f64) -> Self {
        let _phi_rad = phi_deg * PI / 180.0;
        
        Self {
            e,
            nu,
            phi: phi_deg,
            c,
            psi: phi_deg, // Associated flow
            h: 0.0,
            eps_p_eq: 0.0,
        }
    }
    
    /// Alpha parameter (friction)
    pub fn alpha(&self) -> f64 {
        let phi_rad = self.phi * PI / 180.0;
        2.0 * phi_rad.sin() / (3.0_f64.sqrt() * (3.0 - phi_rad.sin()))
    }
    
    /// k parameter (cohesion)
    pub fn k(&self) -> f64 {
        let phi_rad = self.phi * PI / 180.0;
        6.0 * self.c * phi_rad.cos() / (3.0_f64.sqrt() * (3.0 - phi_rad.sin()))
    }
    
    /// Beta parameter (dilation)
    pub fn beta(&self) -> f64 {
        let psi_rad = self.psi * PI / 180.0;
        2.0 * psi_rad.sin() / (3.0_f64.sqrt() * (3.0 - psi_rad.sin()))
    }
    
    /// Yield function
    pub fn yield_function(&self, stress: &StressTensor) -> f64 {
        let j2 = stress.j2();
        let i1 = stress.i1();
        
        self.alpha() * i1 + j2.sqrt() - self.k() - self.h * self.eps_p_eq
    }
    
    /// Shear modulus
    pub fn shear_modulus(&self) -> f64 {
        self.e / (2.0 * (1.0 + self.nu))
    }
    
    /// Bulk modulus
    pub fn bulk_modulus(&self) -> f64 {
        self.e / (3.0 * (1.0 - 2.0 * self.nu))
    }
    
    /// Check if elastic
    pub fn is_elastic(&self, stress: &StressTensor) -> bool {
        self.yield_function(stress) <= 0.0
    }
}

// ============================================================================
// CONCRETE DAMAGE PLASTICITY
// ============================================================================

/// Concrete Damage Plasticity model (simplified)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConcreteDamagePlasticity {
    /// Young's modulus (MPa)
    pub e0: f64,
    /// Poisson's ratio
    pub nu: f64,
    /// Compressive strength (MPa)
    pub fc: f64,
    /// Tensile strength (MPa)
    pub ft: f64,
    /// Compressive damage variable
    pub dc: f64,
    /// Tensile damage variable
    pub dt: f64,
    /// Compressive plastic strain
    pub eps_pc: f64,
    /// Tensile plastic strain
    pub eps_pt: f64,
    /// Dilation angle (degrees)
    pub psi: f64,
    /// Eccentricity
    pub eccentricity: f64,
    /// Biaxial/uniaxial ratio
    pub fb0_fc0: f64,
    /// Kc parameter
    pub kc: f64,
}

impl ConcreteDamagePlasticity {
    pub fn new(e0: f64, fc: f64, ft: f64) -> Self {
        Self {
            e0,
            nu: 0.2,
            fc,
            ft,
            dc: 0.0,
            dt: 0.0,
            eps_pc: 0.0,
            eps_pt: 0.0,
            psi: 36.0,
            eccentricity: 0.1,
            fb0_fc0: 1.16,
            kc: 0.667,
        }
    }
    
    /// Current elastic modulus (degraded)
    pub fn current_modulus(&self) -> f64 {
        self.e0 * (1.0 - self.dc.max(self.dt))
    }
    
    /// Compressive stress-strain (hardening/softening)
    pub fn compressive_stress(&self, eps_c: f64) -> f64 {
        let eps_c0 = 2.0 * self.fc / self.e0; // Peak strain
        
        if eps_c < eps_c0 {
            // Hardening
            let x = eps_c / eps_c0;
            self.fc * (2.0 * x - x.powi(2))
        } else {
            // Softening
            let x = eps_c / eps_c0;
            self.fc / (1.0 + (x - 1.0).powi(2))
        }
    }
    
    /// Tensile stress-strain (exponential softening)
    pub fn tensile_stress(&self, eps_t: f64) -> f64 {
        let eps_t0 = self.ft / self.e0; // Cracking strain
        
        if eps_t < eps_t0 {
            self.e0 * eps_t
        } else {
            // Exponential softening
            let gf = 0.1; // Fracture energy (N/mm) - simplified
            let lc = 100.0; // Characteristic length (mm)
            let alpha = self.ft * lc / gf;
            
            self.ft * (-alpha * (eps_t - eps_t0)).exp()
        }
    }
    
    /// Compressive damage from plastic strain
    pub fn compressive_damage(&self, eps_pc: f64) -> f64 {
        let eps_c0 = 2.0 * self.fc / self.e0;
        
        if eps_pc < eps_c0 {
            0.0
        } else {
            1.0 - 1.0 / (1.0 + (eps_pc / eps_c0 - 1.0).powi(2))
        }
    }
    
    /// Tensile damage from plastic strain
    pub fn tensile_damage(&self, eps_pt: f64) -> f64 {
        let eps_t0 = self.ft / self.e0;
        
        if eps_pt < eps_t0 {
            0.0
        } else {
            let gf = 0.1;
            let lc = 100.0;
            let alpha = self.ft * lc / gf;
            
            1.0 - (-alpha * (eps_pt - eps_t0)).exp()
        }
    }
    
    /// Update damage variables
    pub fn update_damage(&mut self, eps_pc: f64, eps_pt: f64) {
        self.eps_pc = eps_pc;
        self.eps_pt = eps_pt;
        self.dc = self.compressive_damage(eps_pc);
        self.dt = self.tensile_damage(eps_pt);
    }
    
    /// Effective stress (undamaged)
    pub fn effective_stress(&self, stress: &StressTensor) -> StressTensor {
        let d = self.dc.max(self.dt);
        
        StressTensor {
            s11: stress.s11 / (1.0 - d).max(0.01),
            s22: stress.s22 / (1.0 - d).max(0.01),
            s33: stress.s33 / (1.0 - d).max(0.01),
            s12: stress.s12 / (1.0 - d).max(0.01),
            s23: stress.s23 / (1.0 - d).max(0.01),
            s13: stress.s13 / (1.0 - d).max(0.01),
        }
    }
}

// ============================================================================
// HARDENING LAWS
// ============================================================================

/// Hardening law types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HardeningLaw {
    /// Linear isotropic hardening
    LinearIsotropic { h: f64 },
    /// Voce (saturation) hardening
    Voce { sigma_inf: f64, delta: f64 },
    /// Power law hardening
    PowerLaw { k: f64, n: f64 },
    /// Combined linear + kinematic
    Combined { h_iso: f64, h_kin: f64 },
}

impl HardeningLaw {
    /// Yield stress increment from equivalent plastic strain
    pub fn stress_increment(&self, eps_p_eq: f64, sigma_y0: f64) -> f64 {
        match self {
            HardeningLaw::LinearIsotropic { h } => h * eps_p_eq,
            HardeningLaw::Voce { sigma_inf, delta } => {
                (sigma_inf - sigma_y0) * (1.0 - (-delta * eps_p_eq).exp())
            }
            HardeningLaw::PowerLaw { k, n } => k * eps_p_eq.powf(*n),
            HardeningLaw::Combined { h_iso, .. } => h_iso * eps_p_eq,
        }
    }
    
    /// Tangent hardening modulus
    pub fn tangent_modulus(&self, eps_p_eq: f64, sigma_y0: f64) -> f64 {
        match self {
            HardeningLaw::LinearIsotropic { h } => *h,
            HardeningLaw::Voce { sigma_inf, delta } => {
                (sigma_inf - sigma_y0) * delta * (-delta * eps_p_eq).exp()
            }
            HardeningLaw::PowerLaw { k, n } => {
                if eps_p_eq > 1e-10 {
                    k * n * eps_p_eq.powf(n - 1.0)
                } else {
                    1e10 // Very stiff initially
                }
            }
            HardeningLaw::Combined { h_iso, .. } => *h_iso,
        }
    }
}

// ============================================================================
// VISCOPLASTICITY
// ============================================================================

/// Perzyna viscoplasticity model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerzynaViscoplasticity {
    /// Base plasticity model
    pub base_sigma_y0: f64,
    /// Hardening modulus
    pub h: f64,
    /// Viscosity parameter (1/s)
    pub eta: f64,
    /// Rate sensitivity exponent
    pub n: f64,
    /// Young's modulus
    pub e: f64,
    /// Poisson's ratio
    pub nu: f64,
    /// Accumulated plastic strain
    pub eps_p_eq: f64,
}

impl PerzynaViscoplasticity {
    pub fn new(e: f64, nu: f64, sigma_y0: f64, h: f64, eta: f64, n: f64) -> Self {
        Self {
            base_sigma_y0: sigma_y0,
            h,
            eta,
            n,
            e,
            nu,
            eps_p_eq: 0.0,
        }
    }
    
    /// Static yield stress
    pub fn static_yield(&self) -> f64 {
        self.base_sigma_y0 + self.h * self.eps_p_eq
    }
    
    /// Overstress function
    pub fn overstress(&self, stress: &StressTensor) -> f64 {
        let sigma_vm = stress.von_mises();
        let sigma_y = self.static_yield();
        
        (sigma_vm - sigma_y).max(0.0)
    }
    
    /// Viscoplastic strain rate
    pub fn strain_rate(&self, stress: &StressTensor) -> f64 {
        let f = self.overstress(stress);
        
        if f > 0.0 {
            self.eta * (f / self.base_sigma_y0).powf(self.n)
        } else {
            0.0
        }
    }
    
    /// Update for time step
    pub fn update(&mut self, stress: &StressTensor, dt: f64) {
        let deps_p = self.strain_rate(stress) * dt;
        self.eps_p_eq += deps_p;
    }
    
    /// Dynamic yield stress at strain rate
    pub fn dynamic_yield(&self, strain_rate: f64) -> f64 {
        let sigma_y = self.static_yield();
        
        sigma_y * (1.0 + (strain_rate / self.eta).powf(1.0 / self.n))
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stress_invariants() {
        let stress = StressTensor::new(100.0, 50.0, 30.0, 20.0, 10.0, 5.0);
        
        let i1 = stress.i1();
        assert!((i1 - 180.0).abs() < 0.01);
        
        let vm = stress.von_mises();
        assert!(vm > 0.0);
    }

    #[test]
    fn test_deviatoric() {
        let stress = StressTensor::new(100.0, 100.0, 100.0, 0.0, 0.0, 0.0);
        let dev = stress.deviatoric();
        
        assert!(dev.s11.abs() < 0.01);
        assert!(dev.j2() < 0.01);
    }

    #[test]
    fn test_principal_stresses() {
        let stress = StressTensor::new(100.0, 50.0, 0.0, 0.0, 0.0, 0.0);
        let (s1, s2, s3) = stress.principal();
        
        assert!((s1 - 100.0).abs() < 1.0);
        assert!((s2 - 50.0).abs() < 1.0);
        assert!(s3.abs() < 1.0);
    }

    #[test]
    fn test_von_mises_elastic() {
        let mut vm = VonMisesPlasticity::new(200000.0, 0.3, 250.0, 1000.0);
        
        let stress = StressTensor::new(100.0, 50.0, 0.0, 0.0, 0.0, 0.0);
        assert!(vm.is_elastic(&stress));
    }

    #[test]
    fn test_von_mises_plastic() {
        let mut vm = VonMisesPlasticity::new(200000.0, 0.3, 250.0, 1000.0);
        
        let stress = StressTensor::new(300.0, 0.0, 0.0, 0.0, 0.0, 0.0);
        assert!(!vm.is_elastic(&stress));
    }

    #[test]
    fn test_return_mapping() {
        let mut vm = VonMisesPlasticity::new(200000.0, 0.3, 250.0, 1000.0);
        
        let trial = StressTensor::new(350.0, 50.0, 0.0, 0.0, 0.0, 0.0);
        let (corrected, _) = vm.return_mapping(&trial);
        
        // Corrected stress should be on yield surface
        let f = vm.yield_function(&corrected);
        assert!(f.abs() < 1.0);
    }

    #[test]
    fn test_drucker_prager() {
        let dp = DruckerPrager::new(30000.0, 0.2, 30.0, 5.0, 30.0);
        
        assert!(dp.alpha() > 0.0);
        assert!(dp.k() > 0.0);
    }

    #[test]
    fn test_concrete_damage() {
        let mut cdp = ConcreteDamagePlasticity::new(30000.0, 30.0, 3.0);
        
        let sigma_c = cdp.compressive_stress(0.001);
        assert!(sigma_c > 0.0 && sigma_c < 30.0);
        
        cdp.update_damage(0.005, 0.0);
        assert!(cdp.dc > 0.0);
    }

    #[test]
    fn test_hardening_laws() {
        let linear = HardeningLaw::LinearIsotropic { h: 1000.0 };
        let voce = HardeningLaw::Voce { sigma_inf: 400.0, delta: 10.0 };
        
        let ds_linear = linear.stress_increment(0.1, 250.0);
        let ds_voce = voce.stress_increment(0.1, 250.0);
        
        assert!((ds_linear - 100.0).abs() < 0.01);
        assert!(ds_voce > 0.0 && ds_voce < 150.0);
    }

    #[test]
    fn test_viscoplasticity() {
        let vp = PerzynaViscoplasticity::new(200000.0, 0.3, 250.0, 1000.0, 1e-4, 5.0);
        
        let dynamic_yield = vp.dynamic_yield(1.0);
        assert!(dynamic_yield > vp.static_yield());
    }

    #[test]
    fn test_strain_operations() {
        let e1 = StrainTensor::new(0.001, 0.001, 0.001, 0.0, 0.0, 0.0);
        let e2 = StrainTensor::new(0.001, 0.0, 0.0, 0.0, 0.0, 0.0);
        
        let sum = e1.add(&e2);
        assert!((sum.e11 - 0.002).abs() < 1e-6);
        
        let eq = e2.equivalent();
        assert!(eq > 0.0);
    }
}
