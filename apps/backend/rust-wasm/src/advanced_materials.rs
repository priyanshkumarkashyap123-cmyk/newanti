// ============================================================================
// PHASE 51: ADVANCED MATERIAL MODELS
// ============================================================================
//
// Expands material model library from ~10 to 30+ models:
// - Hyperelastic: Neo-Hookean, Mooney-Rivlin, Ogden, Arruda-Boyce
// - Plasticity: Drucker-Prager, Cap plasticity, Cam-clay
// - Viscoelastic: Prony series, Generalized Maxwell
// - Damage: Continuum damage, Cohesive zone
// - Concrete: Concrete damaged plasticity (CDP), MCFT
//
// Industry Parity: ABAQUS, ANSYS, LS-DYNA
// ============================================================================

use std::f64::consts::PI;

// ============================================================================
// HYPERELASTIC MODELS
// ============================================================================

/// Neo-Hookean hyperelastic model
/// 
/// Strain energy: W = C10 * (I1_bar - 3) + 1/D1 * (J - 1)^2
/// 
/// Used for: Rubber, soft tissues, polymers
#[derive(Debug, Clone)]
pub struct NeoHookean {
    /// Material constant C10 (shear modulus / 2)
    pub c10: f64,
    /// Bulk modulus parameter D1
    pub d1: f64,
}

impl NeoHookean {
    pub fn new(shear_modulus: f64, bulk_modulus: f64) -> Self {
        Self {
            c10: shear_modulus / 2.0,
            d1: 2.0 / bulk_modulus,
        }
    }
    
    /// From Young's modulus and Poisson's ratio
    pub fn from_elastic(e: f64, nu: f64) -> Self {
        let g = e / (2.0 * (1.0 + nu));
        let k = e / (3.0 * (1.0 - 2.0 * nu));
        Self::new(g, k)
    }
    
    /// Strain energy density
    pub fn strain_energy(&self, i1_bar: f64, j: f64) -> f64 {
        self.c10 * (i1_bar - 3.0) + (1.0 / self.d1) * (j - 1.0).powi(2)
    }
    
    /// Cauchy stress from deformation gradient
    pub fn cauchy_stress(&self, f: &[[f64; 3]; 3]) -> [[f64; 3]; 3] {
        let j = determinant_3x3(f);
        let b = left_cauchy_green(f);
        let i1 = b[0][0] + b[1][1] + b[2][2];
        
        // Deviatoric part
        let j_23 = j.powf(-2.0 / 3.0);
        let dev_coeff = 2.0 * self.c10 * j_23 / j;
        
        // Hydrostatic part
        let p = (2.0 / self.d1) * (j - 1.0);
        
        let mut sigma = [[0.0; 3]; 3];
        for i in 0..3 {
            for k in 0..3 {
                let delta = if i == k { 1.0 } else { 0.0 };
                sigma[i][k] = dev_coeff * (b[i][k] - i1 / 3.0 * delta) + p * delta;
            }
        }
        
        sigma
    }
}

/// Mooney-Rivlin hyperelastic model
/// 
/// Strain energy: W = C10 * (I1_bar - 3) + C01 * (I2_bar - 3) + 1/D1 * (J - 1)^2
#[derive(Debug, Clone)]
pub struct MooneyRivlin {
    pub c10: f64,
    pub c01: f64,
    pub d1: f64,
}

impl MooneyRivlin {
    pub fn new(c10: f64, c01: f64, bulk_modulus: f64) -> Self {
        Self {
            c10,
            c01,
            d1: 2.0 / bulk_modulus,
        }
    }
    
    /// Strain energy density
    pub fn strain_energy(&self, i1_bar: f64, i2_bar: f64, j: f64) -> f64 {
        self.c10 * (i1_bar - 3.0) + 
        self.c01 * (i2_bar - 3.0) + 
        (1.0 / self.d1) * (j - 1.0).powi(2)
    }
    
    /// Shear modulus at small strains
    pub fn shear_modulus(&self) -> f64 {
        2.0 * (self.c10 + self.c01)
    }
}

/// Ogden hyperelastic model (N-term)
/// 
/// Strain energy: W = Σ (μi/αi) * (λ1^αi + λ2^αi + λ3^αi - 3)
#[derive(Debug, Clone)]
pub struct Ogden {
    /// Material parameters μ
    pub mu: Vec<f64>,
    /// Material parameters α
    pub alpha: Vec<f64>,
    /// Bulk modulus
    pub bulk_modulus: f64,
}

impl Ogden {
    pub fn new(mu: Vec<f64>, alpha: Vec<f64>, bulk_modulus: f64) -> Self {
        assert_eq!(mu.len(), alpha.len(), "μ and α must have same length");
        Self { mu, alpha, bulk_modulus }
    }
    
    /// 3-term Ogden model for rubber
    pub fn rubber() -> Self {
        Self {
            mu: vec![0.69e6, 0.01e6, -0.0122e6],
            alpha: vec![1.3, 5.0, -2.0],
            bulk_modulus: 2000e6,
        }
    }
    
    /// Strain energy from principal stretches
    pub fn strain_energy(&self, lambda: [f64; 3]) -> f64 {
        let j = lambda[0] * lambda[1] * lambda[2];
        let j_13 = j.powf(-1.0 / 3.0);
        
        // Isochoric stretches
        let lam_bar = [
            lambda[0] * j_13,
            lambda[1] * j_13,
            lambda[2] * j_13,
        ];
        
        let mut w_iso = 0.0;
        for i in 0..self.mu.len() {
            let term = lam_bar[0].powf(self.alpha[i]) +
                       lam_bar[1].powf(self.alpha[i]) +
                       lam_bar[2].powf(self.alpha[i]) - 3.0;
            w_iso += (self.mu[i] / self.alpha[i]) * term;
        }
        
        // Volumetric part
        let w_vol = (self.bulk_modulus / 2.0) * (j - 1.0).powi(2);
        
        w_iso + w_vol
    }
}

/// Arruda-Boyce (8-chain) hyperelastic model
/// 
/// Physically-based model for rubber networks
#[derive(Debug, Clone)]
pub struct ArrudaBoyce {
    /// Shear modulus
    pub mu: f64,
    /// Locking stretch λ_m
    pub lambda_m: f64,
    /// Bulk modulus
    pub bulk_modulus: f64,
}

impl ArrudaBoyce {
    pub fn new(mu: f64, lambda_m: f64, bulk_modulus: f64) -> Self {
        Self { mu, lambda_m, bulk_modulus }
    }
    
    /// Strain energy using 5-term Padé approximation
    pub fn strain_energy(&self, i1_bar: f64, j: f64) -> f64 {
        let lambda_m2 = self.lambda_m * self.lambda_m;
        let lambda_m4 = lambda_m2 * lambda_m2;
        let lambda_m6 = lambda_m4 * lambda_m2;
        
        // Coefficients for Padé approximation
        let c1 = 0.5;
        let c2 = 1.0 / 20.0 / lambda_m2;
        let c3 = 11.0 / 1050.0 / lambda_m4;
        let c4 = 19.0 / 7000.0 / lambda_m6;
        let c5 = 519.0 / 673750.0 / (lambda_m6 * lambda_m2);
        
        let w_iso = self.mu * (
            c1 * (i1_bar - 3.0) +
            c2 * (i1_bar.powi(2) - 9.0) +
            c3 * (i1_bar.powi(3) - 27.0) +
            c4 * (i1_bar.powi(4) - 81.0) +
            c5 * (i1_bar.powi(5) - 243.0)
        );
        
        let w_vol = (self.bulk_modulus / 2.0) * (j - 1.0).powi(2);
        
        w_iso + w_vol
    }
}

// ============================================================================
// PLASTICITY MODELS
// ============================================================================

/// Drucker-Prager plasticity model
/// 
/// Yield function: f = t - p * tan(β) - d
/// where t = q/2 * [1 + 1/K - (1 - 1/K)(r/q)^3]
/// 
/// Used for: Granular materials, soil, rock, concrete
#[derive(Debug, Clone)]
pub struct DruckerPrager {
    /// Friction angle in radians
    pub friction_angle: f64,
    /// Cohesion
    pub cohesion: f64,
    /// Dilation angle in radians
    pub dilation_angle: f64,
    /// Flow stress ratio K
    pub k_ratio: f64,
}

impl DruckerPrager {
    pub fn new(friction_angle_deg: f64, cohesion: f64, dilation_angle_deg: f64) -> Self {
        Self {
            friction_angle: friction_angle_deg * PI / 180.0,
            cohesion,
            dilation_angle: dilation_angle_deg * PI / 180.0,
            k_ratio: 1.0, // Default: circular yield surface in π-plane
        }
    }
    
    /// Match to Mohr-Coulomb for compression
    pub fn from_mohr_coulomb_compression(phi_deg: f64, c: f64) -> Self {
        let phi = phi_deg * PI / 180.0;
        let tan_beta = 6.0 * phi.sin() / (3.0 - phi.sin());
        let d = 6.0 * c * phi.cos() / (3.0 - phi.sin());
        
        Self {
            friction_angle: tan_beta.atan(),
            cohesion: d / (6.0 * (tan_beta.atan()).cos()),
            dilation_angle: 0.0,
            k_ratio: 1.0,
        }
    }
    
    /// Yield function value
    pub fn yield_function(&self, p: f64, q: f64) -> f64 {
        let d = self.cohesion * (self.friction_angle.cos());
        let tan_beta = self.friction_angle.tan();
        
        q - p * tan_beta - d
    }
    
    /// Check if stress state is yielding
    pub fn is_yielding(&self, p: f64, q: f64) -> bool {
        self.yield_function(p, q) > 1e-10
    }
}

/// Modified Cam-Clay model
/// 
/// Critical state soil mechanics model for clay
#[derive(Debug, Clone)]
pub struct ModifiedCamClay {
    /// Slope of normal consolidation line (λ)
    pub lambda: f64,
    /// Slope of swelling/recompression line (κ)
    pub kappa: f64,
    /// Critical state stress ratio M
    pub m_cs: f64,
    /// Initial specific volume
    pub v0: f64,
    /// Pre-consolidation pressure
    pub p_c: f64,
}

impl ModifiedCamClay {
    pub fn new(lambda: f64, kappa: f64, m_cs: f64, p_c: f64) -> Self {
        Self {
            lambda,
            kappa,
            m_cs,
            p_c,
            v0: 2.5, // Typical for clay
        }
    }
    
    /// Yield function: f = q^2/M^2 + p'(p' - p_c)
    pub fn yield_function(&self, p: f64, q: f64) -> f64 {
        (q / self.m_cs).powi(2) + p * (p - self.p_c)
    }
    
    /// Bulk modulus (pressure-dependent)
    pub fn bulk_modulus(&self, p: f64, v: f64) -> f64 {
        v * p / self.kappa
    }
    
    /// Shear modulus (from Poisson's ratio assumption)
    pub fn shear_modulus(&self, k: f64, nu: f64) -> f64 {
        3.0 * k * (1.0 - 2.0 * nu) / (2.0 * (1.0 + nu))
    }
}

/// Cap plasticity model
/// 
/// Combines Drucker-Prager shear failure with elliptical cap
#[derive(Debug, Clone)]
pub struct CapPlasticity {
    /// Drucker-Prager shear surface
    pub shear: DruckerPrager,
    /// Cap eccentricity R
    pub r_cap: f64,
    /// Initial cap yield stress
    pub pb: f64,
    /// Hardening parameter
    pub w: f64,
    /// Hardening parameter
    pub d1: f64,
}

impl CapPlasticity {
    pub fn new(shear: DruckerPrager, r_cap: f64, pb: f64) -> Self {
        Self {
            shear,
            r_cap,
            pb,
            w: 0.1,
            d1: 0.01,
        }
    }
    
    /// Cap yield function
    pub fn cap_yield(&self, p: f64, q: f64, pa: f64) -> f64 {
        let pb_pa = self.pb - pa;
        if pb_pa.abs() < 1e-10 {
            return q; // Degenerate cap
        }
        
        let p_term = (p - pa) / (self.pb - pa);
        let q_term = q / (self.r_cap * (self.pb - pa));
        
        p_term.powi(2) + q_term.powi(2) - 1.0
    }
}

/// Concrete Damaged Plasticity (CDP) model
/// 
/// ABAQUS-style concrete model with damage and plasticity
#[derive(Debug, Clone)]
pub struct ConcreteDamagedPlasticity {
    /// Compressive strength f'c
    pub fc: f64,
    /// Tensile strength ft
    pub ft: f64,
    /// Compressive damage evolution
    pub dc_table: Vec<(f64, f64)>, // (inelastic strain, damage)
    /// Tensile damage evolution
    pub dt_table: Vec<(f64, f64)>, // (cracking strain, damage)
    /// Dilation angle
    pub dilation_angle: f64,
    /// Eccentricity
    pub eccentricity: f64,
    /// Biaxial/uniaxial ratio fb0/fc0
    pub fb_fc_ratio: f64,
    /// Kc parameter
    pub kc: f64,
}

impl ConcreteDamagedPlasticity {
    /// Create CDP model from concrete grade
    pub fn from_grade(fc_mpa: f64) -> Self {
        let fc = fc_mpa * 1e6; // Convert to Pa
        let ft = 0.1 * fc; // Approximate tensile strength
        
        Self {
            fc,
            ft,
            dc_table: vec![
                (0.0, 0.0),
                (0.001, 0.2),
                (0.002, 0.5),
                (0.003, 0.7),
                (0.004, 0.85),
            ],
            dt_table: vec![
                (0.0, 0.0),
                (0.0001, 0.3),
                (0.0002, 0.6),
                (0.0003, 0.8),
                (0.0004, 0.9),
            ],
            dilation_angle: 36.0 * PI / 180.0,
            eccentricity: 0.1,
            fb_fc_ratio: 1.16,
            kc: 0.667,
        }
    }
    
    /// Interpolate damage from table
    pub fn damage_compression(&self, inelastic_strain: f64) -> f64 {
        interpolate_table(&self.dc_table, inelastic_strain)
    }
    
    /// Interpolate damage from table
    pub fn damage_tension(&self, cracking_strain: f64) -> f64 {
        interpolate_table(&self.dt_table, cracking_strain)
    }
    
    /// Effective stress (undamaged)
    pub fn effective_stress(&self, stress: f64, damage: f64) -> f64 {
        stress / (1.0 - damage).max(0.001)
    }
}

// ============================================================================
// VISCOELASTIC MODELS
// ============================================================================

/// Prony series viscoelastic model
/// 
/// G(t) = G_inf + Σ Gi * exp(-t/τi)
#[derive(Debug, Clone)]
pub struct PronyViscoelastic {
    /// Instantaneous shear modulus
    pub g0: f64,
    /// Long-term shear modulus
    pub g_inf: f64,
    /// Prony series coefficients (gi, τi)
    pub prony_terms: Vec<(f64, f64)>,
    /// Bulk modulus (assumed elastic)
    pub bulk_modulus: f64,
}

impl PronyViscoelastic {
    pub fn new(g0: f64, prony_terms: Vec<(f64, f64)>, bulk_modulus: f64) -> Self {
        // Compute g_inf from Prony series
        let sum_gi: f64 = prony_terms.iter().map(|(gi, _)| gi).sum();
        let g_inf = g0 - sum_gi;
        
        Self {
            g0,
            g_inf,
            prony_terms,
            bulk_modulus,
        }
    }
    
    /// Relaxation modulus at time t
    pub fn shear_modulus(&self, t: f64) -> f64 {
        let mut g = self.g_inf;
        for (gi, tau_i) in &self.prony_terms {
            g += gi * (-t / tau_i).exp();
        }
        g
    }
    
    /// Relaxation function normalized
    pub fn relaxation_function(&self, t: f64) -> f64 {
        self.shear_modulus(t) / self.g0
    }
}

/// Generalized Maxwell model
/// 
/// Parallel combination of Maxwell elements
#[derive(Debug, Clone)]
pub struct GeneralizedMaxwell {
    /// Equilibrium modulus
    pub e_eq: f64,
    /// Maxwell elements (Ei, ηi)
    pub elements: Vec<MaxwellElement>,
}

#[derive(Debug, Clone)]
pub struct MaxwellElement {
    /// Spring stiffness
    pub e: f64,
    /// Dashpot viscosity
    pub eta: f64,
}

impl MaxwellElement {
    pub fn new(e: f64, eta: f64) -> Self {
        Self { e, eta }
    }
    
    /// Relaxation time τ = η/E
    pub fn relaxation_time(&self) -> f64 {
        self.eta / self.e
    }
}

impl GeneralizedMaxwell {
    pub fn new(e_eq: f64, elements: Vec<MaxwellElement>) -> Self {
        Self { e_eq, elements }
    }
    
    /// Relaxation modulus at time t
    pub fn relaxation_modulus(&self, t: f64) -> f64 {
        let mut e = self.e_eq;
        for elem in &self.elements {
            let tau = elem.relaxation_time();
            e += elem.e * (-t / tau).exp();
        }
        e
    }
    
    /// Convert to Prony series
    pub fn to_prony(&self) -> PronyViscoelastic {
        let g0 = self.e_eq + self.elements.iter().map(|e| e.e).sum::<f64>();
        let prony_terms: Vec<(f64, f64)> = self.elements.iter()
            .map(|e| (e.e, e.relaxation_time()))
            .collect();
        
        PronyViscoelastic::new(g0, prony_terms, g0) // Assuming K ≈ G for simplicity
    }
}

// ============================================================================
// DAMAGE MODELS
// ============================================================================

/// Continuum damage mechanics model
/// 
/// σ = (1 - D) * C : ε
#[derive(Debug, Clone)]
pub struct ContinuumDamage {
    /// Young's modulus (undamaged)
    pub e: f64,
    /// Poisson's ratio
    pub nu: f64,
    /// Damage initiation strain
    pub epsilon_0: f64,
    /// Damage evolution parameter
    pub epsilon_f: f64,
    /// Current damage variable
    pub damage: f64,
}

impl ContinuumDamage {
    pub fn new(e: f64, nu: f64, epsilon_0: f64, epsilon_f: f64) -> Self {
        Self {
            e,
            nu,
            epsilon_0,
            epsilon_f,
            damage: 0.0,
        }
    }
    
    /// Update damage based on equivalent strain
    pub fn update_damage(&mut self, equivalent_strain: f64) {
        if equivalent_strain > self.epsilon_0 {
            let d = 1.0 - (self.epsilon_0 / equivalent_strain) * 
                    (-(equivalent_strain - self.epsilon_0) / (self.epsilon_f - self.epsilon_0)).exp();
            self.damage = self.damage.max(d.min(0.999)); // Irreversible, max 99.9%
        }
    }
    
    /// Effective modulus
    pub fn effective_modulus(&self) -> f64 {
        self.e * (1.0 - self.damage)
    }
    
    /// Energy release rate
    pub fn energy_release_rate(&self, strain_energy: f64) -> f64 {
        strain_energy / (1.0 - self.damage).max(0.001)
    }
}

/// Cohesive zone model
/// 
/// Traction-separation law for fracture
#[derive(Debug, Clone)]
pub struct CohesiveZone {
    /// Maximum traction (strength)
    pub t_max: f64,
    /// Separation at damage initiation
    pub delta_0: f64,
    /// Separation at complete failure
    pub delta_f: f64,
    /// Fracture energy
    pub g_c: f64,
    /// Mode mixity parameter
    pub eta: f64,
}

impl CohesiveZone {
    /// Bilinear traction-separation law
    pub fn bilinear(t_max: f64, delta_0: f64, g_c: f64) -> Self {
        // delta_f from area under curve = Gc
        let delta_f = 2.0 * g_c / t_max;
        
        Self {
            t_max,
            delta_0,
            delta_f,
            g_c,
            eta: 1.0,
        }
    }
    
    /// Traction at given separation
    pub fn traction(&self, delta: f64) -> f64 {
        if delta <= 0.0 {
            0.0 // Compression (contact)
        } else if delta < self.delta_0 {
            // Linear elastic
            self.t_max * delta / self.delta_0
        } else if delta < self.delta_f {
            // Softening
            self.t_max * (self.delta_f - delta) / (self.delta_f - self.delta_0)
        } else {
            0.0 // Complete failure
        }
    }
    
    /// Damage variable
    pub fn damage(&self, delta_max: f64) -> f64 {
        if delta_max <= self.delta_0 {
            0.0
        } else if delta_max >= self.delta_f {
            1.0
        } else {
            (delta_max - self.delta_0) / (self.delta_f - self.delta_0)
        }
    }
}

// ============================================================================
// MODIFIED COMPRESSION FIELD THEORY (MCFT)
// ============================================================================

/// Modified Compression Field Theory for reinforced concrete
#[derive(Debug, Clone)]
pub struct MCFT {
    /// Concrete compressive strength
    pub fc: f64,
    /// Concrete tensile strength
    pub ft: f64,
    /// Concrete strain at peak stress
    pub epsilon_c: f64,
    /// Steel yield stress
    pub fy: f64,
    /// Steel modulus
    pub es: f64,
    /// Reinforcement ratios (x, y)
    pub rho: (f64, f64),
    /// Crack spacing parameter
    pub s_theta: f64,
}

impl MCFT {
    pub fn new(fc: f64, fy: f64, rho_x: f64, rho_y: f64) -> Self {
        Self {
            fc,
            ft: 0.33 * fc.sqrt() * 1e6, // MPa to Pa conversion assumed
            epsilon_c: 0.002,
            fy,
            es: 200e9,
            rho: (rho_x, rho_y),
            s_theta: 0.3, // meters
        }
    }
    
    /// Concrete compression stress (Vecchio-Collins)
    pub fn concrete_compression(&self, epsilon_2: f64, epsilon_1: f64) -> f64 {
        // Softening due to transverse tension
        let softening = 1.0 / (0.8 + 170.0 * epsilon_1);
        let fp = self.fc * softening.min(1.0);
        let ep = self.epsilon_c * softening.min(1.0);
        
        let ratio = epsilon_2 / ep;
        fp * (2.0 * ratio - ratio * ratio)
    }
    
    /// Concrete tension stress (tension stiffening)
    pub fn concrete_tension(&self, epsilon_1: f64) -> f64 {
        let ecr = self.ft / (2.0 * self.fc / self.epsilon_c); // Cracking strain
        
        if epsilon_1 <= ecr {
            // Linear elastic
            2.0 * self.fc / self.epsilon_c * epsilon_1
        } else {
            // Tension stiffening
            self.ft / (1.0 + (500.0 * epsilon_1).sqrt())
        }
    }
}

// ============================================================================
// CREEP MODELS
// ============================================================================

/// ACI 209 creep and shrinkage model
#[derive(Debug, Clone)]
pub struct ACI209Creep {
    /// Ultimate creep coefficient
    pub phi_u: f64,
    /// Time function parameters
    pub d: f64,
    pub psi: f64,
    /// Ultimate shrinkage strain
    pub epsilon_sh_u: f64,
}

impl ACI209Creep {
    pub fn new(_fc_28: f64, humidity: f64, volume_surface_ratio: f64) -> Self {
        // Correction factors for CREEP (ACI 209R-92 §2.5.3)
        let gamma_la = 1.0; // Loading age
        let gamma_h_creep = 1.27 - 0.0067 * humidity;
        let gamma_vs_creep = (2.0 / 3.0) * (1.0 + 1.13 * (-0.54 * volume_surface_ratio).exp());
        
        let phi_u = 2.35 * gamma_la * gamma_h_creep * gamma_vs_creep;
        
        // Correction factors for SHRINKAGE (different from creep per ACI 209R-92)
        // Humidity: γ_sh = 1.40 - 0.010H for H ≤ 80%, 3.00 - 0.030H for H > 80%
        let gamma_h_shrinkage = if humidity <= 80.0 {
            1.40 - 0.010 * humidity
        } else {
            3.00 - 0.030 * humidity
        };
        // V/S: γ_vs = 1.2 × e^(-0.12 × V/S)
        let gamma_vs_shrinkage = 1.2 * (-0.12 * volume_surface_ratio).exp();
        let epsilon_sh_u = 780e-6 * gamma_h_shrinkage * gamma_vs_shrinkage;
        
        Self {
            phi_u,
            d: 10.0,
            psi: 0.6,
            epsilon_sh_u,
        }
    }
    
    /// Creep coefficient at time t (days) for loading at t0
    pub fn creep_coefficient(&self, t: f64, t0: f64) -> f64 {
        let duration = (t - t0).max(0.0);
        self.phi_u * duration.powf(self.psi) / (self.d + duration.powf(self.psi))
    }
    
    /// Shrinkage strain at time t (days)
    pub fn shrinkage_strain(&self, t: f64, t_dry: f64) -> f64 {
        let duration = (t - t_dry).max(0.0);
        self.epsilon_sh_u * duration / (35.0 + duration)
    }
}

/// Eurocode 2 creep model
#[derive(Debug, Clone)]
pub struct EC2Creep {
    /// Notional creep coefficient
    pub phi_0: f64,
    /// Coefficient for time development
    pub beta_h: f64,
}

impl EC2Creep {
    pub fn new(fc: f64, rh: f64, h0: f64, t0: f64) -> Self {
        // RH factor
        let alpha_1 = (35.0 / fc).powf(0.7);
        let alpha_2 = (35.0 / fc).powf(0.2);
        
        let phi_rh = if rh < 0.99 * 100.0 {
            (1.0 + (1.0 - rh / 100.0) / (0.1 * h0.powf(1.0 / 3.0)) * alpha_1) * alpha_2
        } else {
            1.0
        };
        
        let beta_fcm = 16.8 / fc.sqrt();
        let beta_t0 = 1.0 / (0.1 + t0.powf(0.2));
        
        let phi_0 = phi_rh * beta_fcm * beta_t0;
        // EN 1992-1-1 Eq. B.8b: β_H uses α3 = (35/fcm)^0.5, not α1
        let alpha_3 = (35.0 / fc).powf(0.5);
        let beta_h = 1.5 * (1.0 + (0.012 * rh).powf(18.0)) * h0 + 250.0 * alpha_3;
        
        Self { phi_0, beta_h: beta_h.min(1500.0 * alpha_3) }
    }
    
    /// Creep coefficient at time t
    pub fn creep_coefficient(&self, t: f64, t0: f64) -> f64 {
        let beta_c = ((t - t0) / (self.beta_h + t - t0)).powf(0.3);
        self.phi_0 * beta_c
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

fn determinant_3x3(f: &[[f64; 3]; 3]) -> f64 {
    f[0][0] * (f[1][1] * f[2][2] - f[1][2] * f[2][1]) -
    f[0][1] * (f[1][0] * f[2][2] - f[1][2] * f[2][0]) +
    f[0][2] * (f[1][0] * f[2][1] - f[1][1] * f[2][0])
}

fn left_cauchy_green(f: &[[f64; 3]; 3]) -> [[f64; 3]; 3] {
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

fn interpolate_table(table: &[(f64, f64)], x: f64) -> f64 {
    if table.is_empty() {
        return 0.0;
    }
    if x <= table[0].0 {
        return table[0].1;
    }
    if x >= table[table.len() - 1].0 {
        return table[table.len() - 1].1;
    }
    
    for i in 0..table.len() - 1 {
        if x >= table[i].0 && x <= table[i + 1].0 {
            let t = (x - table[i].0) / (table[i + 1].0 - table[i].0);
            return table[i].1 + t * (table[i + 1].1 - table[i].1);
        }
    }
    
    table[table.len() - 1].1
}

// ============================================================================
// MATERIAL LIBRARY
// ============================================================================

/// Unified material model enum
#[derive(Debug, Clone)]
pub enum MaterialModel {
    // Hyperelastic
    NeoHookean(NeoHookean),
    MooneyRivlin(MooneyRivlin),
    Ogden(Ogden),
    ArrudaBoyce(ArrudaBoyce),
    
    // Plasticity
    DruckerPrager(DruckerPrager),
    ModifiedCamClay(ModifiedCamClay),
    CapPlasticity(CapPlasticity),
    ConcreteDamagedPlasticity(ConcreteDamagedPlasticity),
    
    // Viscoelastic
    PronyViscoelastic(PronyViscoelastic),
    GeneralizedMaxwell(GeneralizedMaxwell),
    
    // Damage
    ContinuumDamage(ContinuumDamage),
    CohesiveZone(CohesiveZone),
    
    // Specialized
    MCFT(MCFT),
    ACI209Creep(ACI209Creep),
    EC2Creep(EC2Creep),
}

impl MaterialModel {
    /// Get model name
    pub fn name(&self) -> &'static str {
        match self {
            Self::NeoHookean(_) => "Neo-Hookean",
            Self::MooneyRivlin(_) => "Mooney-Rivlin",
            Self::Ogden(_) => "Ogden",
            Self::ArrudaBoyce(_) => "Arruda-Boyce",
            Self::DruckerPrager(_) => "Drucker-Prager",
            Self::ModifiedCamClay(_) => "Modified Cam-Clay",
            Self::CapPlasticity(_) => "Cap Plasticity",
            Self::ConcreteDamagedPlasticity(_) => "Concrete Damaged Plasticity",
            Self::PronyViscoelastic(_) => "Prony Viscoelastic",
            Self::GeneralizedMaxwell(_) => "Generalized Maxwell",
            Self::ContinuumDamage(_) => "Continuum Damage",
            Self::CohesiveZone(_) => "Cohesive Zone",
            Self::MCFT(_) => "MCFT",
            Self::ACI209Creep(_) => "ACI 209 Creep",
            Self::EC2Creep(_) => "EC2 Creep",
        }
    }
    
    /// Get category
    pub fn category(&self) -> &'static str {
        match self {
            Self::NeoHookean(_) | Self::MooneyRivlin(_) | 
            Self::Ogden(_) | Self::ArrudaBoyce(_) => "Hyperelastic",
            
            Self::DruckerPrager(_) | Self::ModifiedCamClay(_) |
            Self::CapPlasticity(_) | Self::ConcreteDamagedPlasticity(_) => "Plasticity",
            
            Self::PronyViscoelastic(_) | Self::GeneralizedMaxwell(_) => "Viscoelastic",
            
            Self::ContinuumDamage(_) | Self::CohesiveZone(_) => "Damage",
            
            Self::MCFT(_) | Self::ACI209Creep(_) | Self::EC2Creep(_) => "Specialized",
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
    fn test_neo_hookean() {
        let nh = NeoHookean::from_elastic(1e6, 0.3);
        
        // At zero strain, energy should be zero
        let w = nh.strain_energy(3.0, 1.0);
        assert!(w.abs() < 1e-10);
        
        // With stretch
        let w = nh.strain_energy(3.5, 1.0);
        assert!(w > 0.0);
    }
    
    #[test]
    fn test_mooney_rivlin() {
        let mr = MooneyRivlin::new(0.3e6, 0.1e6, 2000e6);
        
        let g = mr.shear_modulus();
        assert!((g - 0.8e6).abs() < 1e-3);
    }
    
    #[test]
    fn test_ogden_rubber() {
        let ogden = Ogden::rubber();
        
        // Unit stretches = zero energy
        let w = ogden.strain_energy([1.0, 1.0, 1.0]);
        assert!(w.abs() < 1e-6);
        
        // Uniaxial extension
        let w = ogden.strain_energy([1.5, 0.816, 0.816]); // Incompressible
        assert!(w > 0.0);
    }
    
    #[test]
    fn test_drucker_prager() {
        let dp = DruckerPrager::new(30.0, 1e6, 0.0);
        
        // High deviatoric stress should yield
        assert!(dp.is_yielding(0.0, 5e6));
        
        // Very high confining pressure with no deviatoric stress should not yield
        // f = q - p*tan(β) - d = 0 - 50e6*0.577 - 866000 < 0 (elastic)
        assert!(!dp.is_yielding(50e6, 0.0)); // Positive p = compression
    }
    
    #[test]
    fn test_cam_clay() {
        let mcc = ModifiedCamClay::new(0.2, 0.04, 1.0, 100e3);
        
        // On yield surface
        let f = mcc.yield_function(50e3, 50e3);
        assert!(f.abs() < 1e-3);
        
        // Inside surface
        let f = mcc.yield_function(50e3, 30e3);
        assert!(f < 0.0);
    }
    
    #[test]
    fn test_cdp() {
        let cdp = ConcreteDamagedPlasticity::from_grade(30.0);
        
        assert!(cdp.fc > 0.0);
        assert!(cdp.ft > 0.0);
        assert!(cdp.ft < cdp.fc);
        
        // Damage interpolation
        let d = cdp.damage_compression(0.002);
        assert!(d > 0.0 && d < 1.0);
    }
    
    #[test]
    fn test_prony_viscoelastic() {
        let prony = PronyViscoelastic::new(
            1e6,
            vec![(0.3e6, 1.0), (0.2e6, 10.0)],
            2e9,
        );
        
        // At t=0, should be G0
        let g0 = prony.shear_modulus(0.0);
        assert!((g0 - 1e6).abs() < 1e-3);
        
        // At t→∞, should be G_inf
        let g_inf = prony.shear_modulus(1e6);
        assert!((g_inf - prony.g_inf).abs() / prony.g_inf < 0.01);
    }
    
    #[test]
    fn test_cohesive_zone() {
        // Use correct parameters: delta_f = 2*Gc/t_max must be > delta_0
        // With t_max=3e6, delta_0=0.0001, Gc=300 => delta_f = 600/3e6 = 0.0002 > delta_0
        let cz = CohesiveZone::bilinear(3e6, 0.0001, 300.0);
        
        // At delta=0
        assert!(cz.traction(0.0).abs() < 1e-10);
        
        // Just before delta_0, should be close to t_max
        let t_near_peak = cz.traction(cz.delta_0 * 0.99);
        assert!(t_near_peak > 0.98 * cz.t_max);
        
        // Complete failure: delta > delta_f
        assert!(cz.traction(cz.delta_f * 1.1).abs() < 1e-10);
    }
    
    #[test]
    fn test_continuum_damage() {
        let mut cd = ContinuumDamage::new(200e9, 0.3, 0.001, 0.01);
        
        // No damage initially
        assert!(cd.damage < 1e-10);
        
        // Apply strain beyond initiation
        cd.update_damage(0.005);
        assert!(cd.damage > 0.0 && cd.damage < 1.0);
        
        // Damage is irreversible
        let d1 = cd.damage;
        cd.update_damage(0.002);
        assert!((cd.damage - d1).abs() < 1e-10);
    }
    
    #[test]
    fn test_mcft() {
        let mcft = MCFT::new(30e6, 400e6, 0.02, 0.02);
        
        // Compression
        let fc2 = mcft.concrete_compression(0.002, 0.0);
        assert!(fc2 > 0.0);
        
        // Softening with transverse tension
        let fc2_soft = mcft.concrete_compression(0.002, 0.005);
        assert!(fc2_soft < fc2);
    }
    
    #[test]
    fn test_aci209_creep() {
        let creep = ACI209Creep::new(30.0, 50.0, 75.0);
        
        // At t=t0, creep = 0
        let phi = creep.creep_coefficient(28.0, 28.0);
        assert!(phi.abs() < 1e-10);
        
        // Creep increases with time
        let phi_1y = creep.creep_coefficient(365.0, 28.0);
        let phi_10y = creep.creep_coefficient(3650.0, 28.0);
        assert!(phi_10y > phi_1y);
    }
    
    #[test]
    fn test_material_library() {
        let models: Vec<MaterialModel> = vec![
            MaterialModel::NeoHookean(NeoHookean::from_elastic(1e6, 0.3)),
            MaterialModel::DruckerPrager(DruckerPrager::new(30.0, 1e6, 0.0)),
            MaterialModel::CohesiveZone(CohesiveZone::bilinear(3e6, 0.001, 300.0)),
        ];
        
        for model in &models {
            assert!(!model.name().is_empty());
            assert!(!model.category().is_empty());
        }
    }
}
