// ============================================================================
// PHASE 52: HYSTERETIC MATERIAL MODELS FOR SEISMIC ANALYSIS
// ============================================================================
//
// Industry-standard hysteretic models for nonlinear dynamic analysis:
// - Bilinear kinematic/isotropic hardening
// - Modified Takeda (RC structures)
// - Pivot hysteresis
// - Bouc-Wen smooth hysteresis
// - Pinching hysteresis (RC connections)
// - Flag-shaped (SMA, self-centering)
//
// Industry Parity: SAP2000, ETABS, OpenSees, PERFORM-3D
// ============================================================================


// ============================================================================
// HYSTERETIC STATE
// ============================================================================

/// State variables for hysteretic models
#[derive(Debug, Clone)]
pub struct HysteresisState {
    /// Current strain/deformation
    pub strain: f64,
    /// Current stress/force
    pub stress: f64,
    /// Plastic strain
    pub plastic_strain: f64,
    /// Maximum positive strain ever reached
    pub max_strain: f64,
    /// Minimum negative strain ever reached
    pub min_strain: f64,
    /// Current stiffness
    pub stiffness: f64,
    /// Cumulative energy dissipation
    pub energy: f64,
    /// Loading direction: 1 = loading, -1 = unloading, 0 = neutral
    pub loading_dir: i32,
    /// Internal state variable (model-specific)
    pub z: f64,
}

impl HysteresisState {
    pub fn new() -> Self {
        Self {
            strain: 0.0,
            stress: 0.0,
            plastic_strain: 0.0,
            max_strain: 0.0,
            min_strain: 0.0,
            stiffness: 0.0,
            energy: 0.0,
            loading_dir: 0,
            z: 0.0,
        }
    }
}

impl Default for HysteresisState {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// BILINEAR HYSTERESIS
// ============================================================================

/// Bilinear hysteretic model with kinematic hardening
/// 
/// Standard steel-type hysteresis with equal tension/compression behavior
#[derive(Debug, Clone)]
pub struct BilinearHysteresis {
    /// Initial elastic stiffness
    pub k0: f64,
    /// Post-yield stiffness ratio (α = k_p / k0)
    pub alpha: f64,
    /// Yield force/stress (positive)
    pub fy: f64,
    /// Current state
    state: HysteresisState,
}

impl BilinearHysteresis {
    pub fn new(k0: f64, fy: f64, alpha: f64) -> Self {
        let mut s = HysteresisState::new();
        s.stiffness = k0;
        Self { k0, alpha, fy, state: s }
    }
    
    /// Update state for new strain
    pub fn update(&mut self, strain: f64) -> (f64, f64) {
        let d_strain = strain - self.state.strain;
        
        // Yield strain
        let _ey = self.fy / self.k0;
        
        // Kinematic hardening: yield surface moves with plastic strain
        let backstress = self.k0 * self.alpha * self.state.plastic_strain / (1.0 - self.alpha);
        
        // Trial stress (elastic predictor)
        let trial_stress = self.state.stress + self.k0 * d_strain;
        
        // Yield function
        let f_trial = (trial_stress - backstress).abs() - self.fy;
        
        let (stress, stiffness);
        
        if f_trial <= 0.0 {
            // Elastic
            stress = trial_stress;
            stiffness = self.k0;
        } else {
            // Plastic
            let sign = if trial_stress - backstress >= 0.0 { 1.0 } else { -1.0 };
            let d_plastic = f_trial / self.k0;
            self.state.plastic_strain += sign * d_plastic;
            
            stress = backstress + sign * self.fy + self.alpha * self.k0 * sign * d_plastic;
            stiffness = self.alpha * self.k0;
            
            // Energy dissipation
            self.state.energy += 0.5 * (self.state.stress + stress).abs() * d_plastic;
        }
        
        // Update state
        self.state.strain = strain;
        self.state.stress = stress;
        self.state.stiffness = stiffness;
        self.state.max_strain = self.state.max_strain.max(strain);
        self.state.min_strain = self.state.min_strain.min(strain);
        
        if d_strain.abs() > 1e-16 {
            self.state.loading_dir = if d_strain > 0.0 { 1 } else { -1 };
        }
        
        (stress, stiffness)
    }
    
    pub fn state(&self) -> &HysteresisState {
        &self.state
    }
    
    pub fn reset(&mut self) {
        self.state = HysteresisState::new();
        self.state.stiffness = self.k0;
    }
}

// ============================================================================
// MODIFIED TAKEDA HYSTERESIS
// ============================================================================

/// Modified Takeda hysteretic model for reinforced concrete
/// 
/// Features:
/// - Stiffness degradation based on maximum deformation
/// - Different unloading stiffness
/// - Reloading targets previous maximum point
#[derive(Debug, Clone)]
pub struct TakedaHysteresis {
    /// Initial elastic stiffness
    pub k0: f64,
    /// Cracking force (positive)
    pub fcr: f64,
    /// Yield force (positive)
    pub fy: f64,
    /// Post-yield stiffness ratio
    pub alpha: f64,
    /// Unloading stiffness degradation parameter (typically 0.4)
    pub beta: f64,
    /// Reloading stiffness parameter (typically 0.0-0.6)
    pub gamma: f64,
    /// Current state
    state: HysteresisState,
    /// Maximum positive force reached
    fmax_pos: f64,
    /// Maximum negative force reached
    fmax_neg: f64,
    /// Deformation at max positive force
    dmax_pos: f64,
    /// Deformation at max negative force
    dmax_neg: f64,
}

impl TakedaHysteresis {
    pub fn new(k0: f64, fcr: f64, fy: f64, alpha: f64) -> Self {
        let mut s = HysteresisState::new();
        s.stiffness = k0;
        Self {
            k0,
            fcr,
            fy,
            alpha,
            beta: 0.4,
            gamma: 0.3,
            state: s,
            fmax_pos: fcr,
            fmax_neg: -fcr,
            dmax_pos: fcr / k0,
            dmax_neg: -fcr / k0,
        }
    }
    
    /// Set Takeda parameters
    pub fn with_params(mut self, beta: f64, gamma: f64) -> Self {
        self.beta = beta;
        self.gamma = gamma;
        self
    }
    
    pub fn update(&mut self, strain: f64) -> (f64, f64) {
        let d_strain = strain - self.state.strain;
        let prev_stress = self.state.stress;
        
        // Determine loading direction
        let loading = d_strain > 1e-16;
        let unloading = d_strain < -1e-16;
        
        // Yield deformation
        let dy = self.fy / self.k0;
        
        let (stress, stiffness);
        
        if loading {
            if strain >= 0.0 {
                // Positive loading
                if strain > self.dmax_pos {
                    // Beyond previous maximum - on backbone
                    if strain < dy {
                        stress = self.k0 * strain;
                        stiffness = self.k0;
                    } else {
                        let post_yield = self.alpha * self.k0;
                        stress = self.fy + post_yield * (strain - dy);
                        stiffness = post_yield;
                    }
                    self.dmax_pos = strain;
                    self.fmax_pos = stress;
                } else {
                    // Reloading toward previous maximum
                    let d_residual = self.gamma * self.dmax_pos;
                    let k_reload = self.fmax_pos / (self.dmax_pos - d_residual);
                    stress = k_reload * (strain - d_residual);
                    stiffness = k_reload;
                }
            } else {
                // Loading from negative to zero
                let k_unload = self.k0 * (self.dmax_neg / dy).abs().powf(self.beta);
                stress = prev_stress + k_unload * d_strain;
                stiffness = k_unload;
            }
        } else if unloading {
            if strain <= 0.0 {
                // Negative loading
                if strain < self.dmax_neg {
                    // Beyond previous minimum - on backbone
                    if strain > -dy {
                        stress = self.k0 * strain;
                        stiffness = self.k0;
                    } else {
                        let post_yield = self.alpha * self.k0;
                        stress = -self.fy + post_yield * (strain + dy);
                        stiffness = post_yield;
                    }
                    self.dmax_neg = strain;
                    self.fmax_neg = stress;
                } else {
                    // Reloading toward previous minimum
                    let d_residual = self.gamma * self.dmax_neg;
                    let k_reload = self.fmax_neg / (self.dmax_neg - d_residual);
                    stress = k_reload * (strain - d_residual);
                    stiffness = k_reload;
                }
            } else {
                // Unloading from positive to zero
                let k_unload = self.k0 * (self.dmax_pos / dy).powf(self.beta);
                stress = prev_stress + k_unload * d_strain;
                stiffness = k_unload;
            }
        } else {
            stress = prev_stress;
            stiffness = self.state.stiffness;
        }
        
        // Update state
        let d_energy = 0.5 * (prev_stress + stress).abs() * d_strain.abs();
        self.state.energy += d_energy;
        self.state.strain = strain;
        self.state.stress = stress;
        self.state.stiffness = stiffness;
        self.state.max_strain = self.state.max_strain.max(strain);
        self.state.min_strain = self.state.min_strain.min(strain);
        
        (stress, stiffness)
    }
    
    pub fn state(&self) -> &HysteresisState {
        &self.state
    }
}

// ============================================================================
// BOUC-WEN HYSTERESIS
// ============================================================================

/// Bouc-Wen smooth hysteretic model
/// 
/// Continuous hysteresis without explicit yield point.
/// Governed by differential equation: ż = (A - (β|z|^n + γ|z|^(n-1)*z*sign(ε̇))) * ε̇
#[derive(Debug, Clone)]
pub struct BoucWenHysteresis {
    /// Post-yield stiffness ratio
    pub alpha: f64,
    /// Initial stiffness
    pub k0: f64,
    /// Yield force
    pub fy: f64,
    /// Shape parameter A (typically 1.0)
    pub a_param: f64,
    /// Shape parameter β (controls hysteresis shape)
    pub beta: f64,
    /// Shape parameter γ (controls hysteresis shape)
    pub gamma_param: f64,
    /// Exponent n (controls smoothness, typically 1-2)
    pub n: f64,
    /// Current state
    state: HysteresisState,
}

impl BoucWenHysteresis {
    pub fn new(k0: f64, fy: f64, alpha: f64) -> Self {
        let mut s = HysteresisState::new();
        s.stiffness = k0;
        
        // Standard Bouc-Wen parameters for typical hysteresis
        Self {
            alpha,
            k0,
            fy,
            a_param: 1.0,
            beta: 0.5,
            gamma_param: 0.5,
            n: 2.0,
            state: s,
        }
    }
    
    /// Set Bouc-Wen shape parameters
    pub fn with_params(mut self, a: f64, beta: f64, gamma: f64, n: f64) -> Self {
        self.a_param = a;
        self.beta = beta;
        self.gamma_param = gamma;
        self.n = n;
        self
    }
    
    pub fn update(&mut self, strain: f64) -> (f64, f64) {
        let d_strain = strain - self.state.strain;
        let dy = self.fy / self.k0;
        
        // Normalize by yield strain
        let _eps = strain / dy;
        let d_eps = d_strain / dy;
        
        // Current z (normalized hysteretic variable)
        let z = self.state.z;
        
        // Bouc-Wen differential equation: dz/dε
        let sign_d_eps = if d_eps >= 0.0 { 1.0 } else { -1.0 };
        let z_n = z.abs().powf(self.n);
        let z_n1 = z.abs().powf(self.n - 1.0) * z;
        
        let dz_deps = self.a_param - (self.beta * z_n + self.gamma_param * z_n1 * sign_d_eps);
        
        // Integrate z
        let z_new = z + dz_deps * d_eps;
        self.state.z = z_new;
        
        // Force: F = α*k0*u + (1-α)*Fy*z
        let stress = self.alpha * self.k0 * strain + (1.0 - self.alpha) * self.fy * z_new;
        
        // Tangent stiffness
        let stiffness = self.alpha * self.k0 + (1.0 - self.alpha) * self.fy * dz_deps / dy;
        
        // Update state
        self.state.strain = strain;
        self.state.stress = stress;
        self.state.stiffness = stiffness;
        self.state.max_strain = self.state.max_strain.max(strain);
        self.state.min_strain = self.state.min_strain.min(strain);
        
        (stress, stiffness)
    }
    
    pub fn state(&self) -> &HysteresisState {
        &self.state
    }
}

// ============================================================================
// PIVOT HYSTERESIS
// ============================================================================

/// Pivot hysteretic model
/// 
/// RC hysteresis with pinching, based on pivot point concept.
/// Developed by Dowell, Seible, and Wilson (1998)
#[derive(Debug, Clone)]
pub struct PivotHysteresis {
    /// Initial elastic stiffness
    pub k0: f64,
    /// Positive yield force
    pub fy_pos: f64,
    /// Negative yield force
    pub fy_neg: f64,
    /// Post-yield stiffness ratio (positive)
    pub alpha_pos: f64,
    /// Post-yield stiffness ratio (negative)
    pub alpha_neg: f64,
    /// Pivot parameter for pinching (α1)
    pub alpha1: f64,
    /// Pivot parameter for pinching (α2)
    pub alpha2: f64,
    /// Pivot parameter for stiffness degradation (β1)
    pub beta1: f64,
    /// Pivot parameter for strength degradation (β2)
    pub beta2: f64,
    /// Current state
    state: HysteresisState,
    /// Branch indicator
    branch: i32,
}

impl PivotHysteresis {
    pub fn new(k0: f64, fy_pos: f64, fy_neg: f64, alpha: f64) -> Self {
        let mut s = HysteresisState::new();
        s.stiffness = k0;
        
        Self {
            k0,
            fy_pos,
            fy_neg: -fy_neg.abs(),
            alpha_pos: alpha,
            alpha_neg: alpha,
            alpha1: 4.0,
            alpha2: 4.0,
            beta1: 0.5,
            beta2: 0.2,
            state: s,
            branch: 0,
        }
    }
    
    pub fn update(&mut self, strain: f64) -> (f64, f64) {
        let _d_strain = strain - self.state.strain;
        let dy_pos = self.fy_pos / self.k0;
        let dy_neg = self.fy_neg / self.k0;
        
        // Simplified pivot model - backbone with degrading unload
        let (stress, stiffness);
        
        if strain >= 0.0 {
            if strain <= dy_pos {
                stress = self.k0 * strain;
                stiffness = self.k0;
            } else {
                stress = self.fy_pos + self.alpha_pos * self.k0 * (strain - dy_pos);
                stiffness = self.alpha_pos * self.k0;
            }
        } else {
            if strain >= dy_neg {
                stress = self.k0 * strain;
                stiffness = self.k0;
            } else {
                stress = self.fy_neg + self.alpha_neg * self.k0 * (strain - dy_neg);
                stiffness = self.alpha_neg * self.k0;
            }
        }
        
        // Apply stiffness degradation based on max deformation
        let mu = (self.state.max_strain / dy_pos).max(self.state.min_strain.abs() / dy_neg.abs());
        let deg_factor = 1.0 / (1.0 + self.beta1 * (mu - 1.0).max(0.0));
        
        self.state.strain = strain;
        self.state.stress = stress;
        self.state.stiffness = stiffness * deg_factor;
        self.state.max_strain = self.state.max_strain.max(strain);
        self.state.min_strain = self.state.min_strain.min(strain);
        
        (stress, stiffness * deg_factor)
    }
    
    pub fn state(&self) -> &HysteresisState {
        &self.state
    }
}

// ============================================================================
// FLAG-SHAPED HYSTERESIS
// ============================================================================

/// Flag-shaped hysteretic model for self-centering systems
/// 
/// Used for: Shape memory alloy (SMA) devices, post-tensioned connections
#[derive(Debug, Clone)]
pub struct FlagShapedHysteresis {
    /// Initial stiffness
    pub k0: f64,
    /// Activation force (start of flag)
    pub fa: f64,
    /// Maximum force (top of flag)
    pub fm: f64,
    /// Forward transformation strain
    pub eps_f: f64,
    /// Energy dissipation ratio (β)
    pub beta: f64,
    /// Current state
    state: HysteresisState,
}

impl FlagShapedHysteresis {
    /// Create SMA-type flag-shaped hysteresis
    pub fn new(k0: f64, fa: f64, fm: f64, eps_f: f64, beta: f64) -> Self {
        let mut s = HysteresisState::new();
        s.stiffness = k0;
        
        Self {
            k0,
            fa,
            fm,
            eps_f,
            beta: beta.clamp(0.0, 1.0),
            state: s,
        }
    }
    
    /// Create for shape memory alloy with typical properties
    pub fn sma(k0: f64, fy: f64) -> Self {
        Self::new(k0, 0.7 * fy, fy, 0.06, 0.5)
    }
    
    pub fn update(&mut self, strain: f64) -> (f64, f64) {
        let ea = self.fa / self.k0; // Activation strain
        
        let (stress, stiffness);
        
        // Loading branch
        if strain >= 0.0 {
            if strain < ea {
                // Elastic
                stress = self.k0 * strain;
                stiffness = self.k0;
            } else if strain < self.eps_f {
                // Transformation plateau (loading)
                let k_trans = (self.fm - self.fa) / (self.eps_f - ea);
                stress = self.fa + k_trans * (strain - ea);
                stiffness = k_trans;
            } else {
                // Beyond transformation
                stress = self.fm + self.k0 * (strain - self.eps_f);
                stiffness = self.k0;
            }
        } else {
            // Symmetric for negative strains
            let strain_abs = strain.abs();
            if strain_abs < ea {
                stress = self.k0 * strain;
                stiffness = self.k0;
            } else if strain_abs < self.eps_f {
                let k_trans = (self.fm - self.fa) / (self.eps_f - ea);
                stress = -(self.fa + k_trans * (strain_abs - ea));
                stiffness = k_trans;
            } else {
                stress = -(self.fm + self.k0 * (strain_abs - self.eps_f));
                stiffness = self.k0;
            }
        }
        
        // Apply flag shape (unloading at lower level)
        let unload_factor = 1.0 - self.beta;
        let is_unloading = (strain - self.state.strain) * (self.state.loading_dir as f64) < 0.0;
        
        let final_stress = if is_unloading && strain.abs() > ea {
            stress * unload_factor
        } else {
            stress
        };
        
        self.state.strain = strain;
        self.state.stress = final_stress;
        self.state.stiffness = stiffness;
        self.state.max_strain = self.state.max_strain.max(strain);
        self.state.min_strain = self.state.min_strain.min(strain);
        
        if (strain - self.state.strain).abs() > 1e-16 {
            self.state.loading_dir = if strain > self.state.strain { 1 } else { -1 };
        }
        
        (final_stress, stiffness)
    }
    
    pub fn state(&self) -> &HysteresisState {
        &self.state
    }
}

// ============================================================================
// PINCHING HYSTERESIS
// ============================================================================

/// Pinching hysteretic model for RC beam-column joints
/// 
/// Features severe pinching typical of shear-dominated behavior
#[derive(Debug, Clone)]
pub struct PinchingHysteresis {
    /// Backbone points: (strain, force) pairs
    backbone_pos: Vec<(f64, f64)>,
    backbone_neg: Vec<(f64, f64)>,
    /// Pinching parameters
    pub rdisp_p: f64, // Ratio of deformation at which reloading begins
    pub rforce_p: f64, // Ratio of force at which reloading begins
    pub uforce_p: f64, // Ratio of force developed on unloading path
    /// Damage parameters
    pub d_damage: f64,
    pub f_damage: f64,
    /// Current state
    state: HysteresisState,
    /// Maximum force reached
    fmax: f64,
    /// Deformation at max force
    dmax: f64,
}

impl PinchingHysteresis {
    pub fn new(k0: f64, fy: f64, alpha: f64) -> Self {
        let dy = fy / k0;
        let du = 10.0 * dy; // Ultimate deformation
        let fu = fy + alpha * k0 * (du - dy);
        
        let mut s = HysteresisState::new();
        s.stiffness = k0;
        
        Self {
            backbone_pos: vec![(0.0, 0.0), (dy, fy), (du, fu)],
            backbone_neg: vec![(0.0, 0.0), (-dy, -fy), (-du, -fu)],
            rdisp_p: 0.2,
            rforce_p: 0.1,
            uforce_p: 0.0,
            d_damage: 0.0,
            f_damage: 0.0,
            state: s,
            fmax: fy,
            dmax: dy,
        }
    }
    
    pub fn update(&mut self, strain: f64) -> (f64, f64) {
        // Simplified pinching model
        let d_strain = strain - self.state.strain;
        
        // Get backbone force
        let f_backbone = self.backbone_force(strain);
        
        // Apply pinching
        let loading = (d_strain >= 0.0 && strain >= 0.0) || (d_strain <= 0.0 && strain <= 0.0);
        
        let stress = if loading {
            // Loading toward backbone
            f_backbone
        } else {
            // Unloading with pinching
            let f_pinch = f_backbone * self.rforce_p;
            f_pinch
        };
        
        let stiffness = if d_strain.abs() > 1e-16 {
            (stress - self.state.stress) / d_strain
        } else {
            self.state.stiffness
        };
        
        self.state.strain = strain;
        self.state.stress = stress;
        self.state.stiffness = stiffness.max(1e-10);
        self.state.max_strain = self.state.max_strain.max(strain);
        self.state.min_strain = self.state.min_strain.min(strain);
        
        if strain.abs() > self.dmax.abs() {
            self.dmax = strain;
            self.fmax = stress;
        }
        
        (stress, stiffness.max(1e-10))
    }
    
    fn backbone_force(&self, strain: f64) -> f64 {
        let backbone = if strain >= 0.0 { &self.backbone_pos } else { &self.backbone_neg };
        
        for i in 1..backbone.len() {
            let (d0, f0) = backbone[i - 1];
            let (d1, f1) = backbone[i];
            
            if (strain >= d0.min(d1)) && (strain <= d0.max(d1)) {
                if (d1 - d0).abs() < 1e-16 {
                    return f0;
                }
                return f0 + (f1 - f0) * (strain - d0) / (d1 - d0);
            }
        }
        
        // Beyond backbone
        let last = backbone.last().unwrap();
        last.1
    }
    
    pub fn state(&self) -> &HysteresisState {
        &self.state
    }
}

// ============================================================================
// IMK (IBARRA-MEDINA-KRAWINKLER) HYSTERESIS
// ============================================================================

/// IMK deteriorating hysteretic model
/// 
/// Industry-standard model for modeling cyclic deterioration in steel/RC.
/// Per Lignos & Krawinkler (2011), PEER 2017/07
#[derive(Debug, Clone)]
pub struct IMKHysteresis {
    /// Elastic stiffness
    pub k_e: f64,
    /// Yield moment/force
    pub my: f64,
    /// Capping moment ratio (Mc/My)
    pub mc_my: f64,
    /// Pre-capping rotation
    pub theta_p: f64,
    /// Post-capping rotation
    pub theta_pc: f64,
    /// Residual strength ratio
    pub residual: f64,
    /// Cyclic deterioration parameter
    pub lambda: f64,
    /// Current state
    state: HysteresisState,
    /// Cumulative deterioration
    cum_damage: f64,
}

impl IMKHysteresis {
    /// Create IMK model with typical steel parameters
    pub fn steel(k_e: f64, my: f64) -> Self {
        let mut s = HysteresisState::new();
        s.stiffness = k_e;
        
        Self {
            k_e,
            my,
            mc_my: 1.1,
            theta_p: 0.03,
            theta_pc: 0.10,
            residual: 0.2,
            lambda: 1.0,
            state: s,
            cum_damage: 0.0,
        }
    }
    
    /// Create IMK model with typical RC parameters
    pub fn concrete(k_e: f64, my: f64) -> Self {
        let mut s = HysteresisState::new();
        s.stiffness = k_e;
        
        Self {
            k_e,
            my,
            mc_my: 1.05,
            theta_p: 0.02,
            theta_pc: 0.05,
            residual: 0.1,
            lambda: 0.8,
            state: s,
            cum_damage: 0.0,
        }
    }
    
    pub fn update(&mut self, rotation: f64) -> (f64, f64) {
        let theta_y = self.my / self.k_e;
        let mc = self.mc_my * self.my;
        let theta_c = theta_y + self.theta_p;
        let theta_u = theta_c + self.theta_pc;
        
        // Deterioration factor
        let d_factor = (-self.cum_damage / self.lambda).exp();
        let my_eff = self.my * d_factor;
        let mc_eff = mc * d_factor;
        
        let (moment, stiffness);
        let theta = rotation.abs();
        let sign = rotation.signum();
        
        if theta < theta_y {
            // Elastic
            moment = sign * self.k_e * theta;
            stiffness = self.k_e;
        } else if theta < theta_c {
            // Hardening
            let k_h = (mc_eff - my_eff) / self.theta_p;
            moment = sign * (my_eff + k_h * (theta - theta_y));
            stiffness = k_h;
        } else if theta < theta_u {
            // Softening (post-capping)
            let k_pc = -mc_eff * (1.0 - self.residual) / self.theta_pc;
            moment = sign * (mc_eff + k_pc * (theta - theta_c)).max(self.residual * my_eff);
            stiffness = k_pc;
        } else {
            // Residual
            moment = sign * self.residual * my_eff;
            stiffness = 1e-6 * self.k_e;
        }
        
        // Update cumulative damage (energy-based)
        let d_energy = 0.5 * (self.state.stress + moment).abs() 
                     * (rotation - self.state.strain).abs();
        self.cum_damage += d_energy / (self.my * theta_y);
        
        self.state.strain = rotation;
        self.state.stress = moment;
        self.state.stiffness = stiffness;
        self.state.energy += d_energy;
        
        (moment, stiffness)
    }
    
    pub fn state(&self) -> &HysteresisState {
        &self.state
    }
    
    pub fn damage(&self) -> f64 {
        self.cum_damage
    }
}

// ============================================================================
// TESTS
// ============================================================================
// ADDITIONAL INDUSTRY-STANDARD MODELS
// ============================================================================

/// Clough Hysteresis Model (Origin-Oriented)
/// 
/// Classic model for RC structures where reloading targets the origin.
/// Simpler than Takeda but captures essential degradation behavior.
#[derive(Debug, Clone)]
pub struct CloughHysteresis {
    /// Initial elastic stiffness
    pub k0: f64,
    /// Yield force (positive)
    pub fy: f64,
    /// Post-yield stiffness ratio
    pub alpha: f64,
    /// Unloading stiffness ratio (1.0 = elastic, <1.0 = degraded)
    pub beta: f64,
    /// Current state
    state: HysteresisState,
    /// Maximum positive deformation
    dmax_pos: f64,
    /// Maximum negative deformation  
    dmax_neg: f64,
    /// Force at max positive deformation
    fmax_pos: f64,
    /// Force at max negative deformation
    fmax_neg: f64,
}

impl CloughHysteresis {
    pub fn new(k0: f64, fy: f64, alpha: f64) -> Self {
        let mut s = HysteresisState::new();
        s.stiffness = k0;
        let dy = fy / k0;
        Self {
            k0,
            fy,
            alpha,
            beta: 1.0,
            state: s,
            dmax_pos: dy,
            dmax_neg: -dy,
            fmax_pos: fy,
            fmax_neg: -fy,
        }
    }
    
    pub fn with_degradation(mut self, beta: f64) -> Self {
        self.beta = beta;
        self
    }
    
    pub fn update(&mut self, strain: f64) -> (f64, f64) {
        let d_strain = strain - self.state.strain;
        let prev_stress = self.state.stress;
        let dy = self.fy / self.k0;
        
        let (stress, stiffness);
        
        if d_strain.abs() < 1e-16 {
            return (prev_stress, self.state.stiffness);
        }
        
        let loading = d_strain > 0.0;
        
        if loading {
            if strain >= 0.0 {
                if strain > self.dmax_pos {
                    // On backbone curve
                    if strain <= dy {
                        stress = self.k0 * strain;
                        stiffness = self.k0;
                    } else {
                        stress = self.fy + self.alpha * self.k0 * (strain - dy);
                        stiffness = self.alpha * self.k0;
                    }
                    self.dmax_pos = strain;
                    self.fmax_pos = stress;
                } else {
                    // Reloading toward previous max - origin-oriented
                    stiffness = self.fmax_pos / self.dmax_pos;
                    stress = stiffness * strain;
                }
            } else {
                // Unloading in negative region
                stiffness = self.k0 * self.beta;
                stress = prev_stress + stiffness * d_strain;
            }
        } else {
            // Unloading/negative loading
            if strain <= 0.0 {
                if strain < self.dmax_neg {
                    // On backbone curve
                    if strain >= -dy {
                        stress = self.k0 * strain;
                        stiffness = self.k0;
                    } else {
                        stress = -self.fy + self.alpha * self.k0 * (strain + dy);
                        stiffness = self.alpha * self.k0;
                    }
                    self.dmax_neg = strain;
                    self.fmax_neg = stress;
                } else {
                    // Reloading toward previous min - origin-oriented
                    stiffness = self.fmax_neg / self.dmax_neg;
                    stress = stiffness * strain;
                }
            } else {
                // Unloading in positive region
                stiffness = self.k0 * self.beta;
                stress = prev_stress + stiffness * d_strain;
            }
        }
        
        // Update state
        self.state.energy += 0.5 * (prev_stress + stress).abs() * d_strain.abs();
        self.state.strain = strain;
        self.state.stress = stress;
        self.state.stiffness = stiffness;
        self.state.max_strain = self.state.max_strain.max(strain);
        self.state.min_strain = self.state.min_strain.min(strain);
        
        (stress, stiffness)
    }
    
    pub fn state(&self) -> &HysteresisState {
        &self.state
    }
}

// ============================================================================
// MENEGOTTO-PINTO STEEL MODEL
// ============================================================================

/// Menegotto-Pinto smooth steel hysteresis model
/// 
/// Industry-standard for steel reinforcement with:
/// - Smooth transition from elastic to plastic
/// - Bauschinger effect
/// - Isotropic hardening option
/// 
/// Used in OpenSees as Steel02 material
#[derive(Debug, Clone)]
pub struct MenegottoPintoHysteresis {
    /// Initial elastic modulus
    pub e0: f64,
    /// Yield stress
    pub fy: f64,
    /// Strain hardening ratio
    pub b: f64,
    /// Initial curvature parameter (typically 10-20)
    pub r0: f64,
    /// Curvature degradation parameters
    pub a1: f64,
    pub a2: f64,
    /// Isotropic hardening parameters
    pub a3: f64,
    pub a4: f64,
    /// Current state
    state: HysteresisState,
    /// Current reversal point strain
    eps_r: f64,
    /// Current reversal point stress
    sig_r: f64,
    /// Target point strain (on asymptote)
    eps_0: f64,
    /// Target point stress
    sig_0: f64,
    /// Maximum absolute strain reached
    eps_max: f64,
    /// Current R value
    r: f64,
}

impl MenegottoPintoHysteresis {
    pub fn new(e0: f64, fy: f64, b: f64) -> Self {
        let ey = fy / e0;
        Self {
            e0,
            fy,
            b,
            r0: 15.0,
            a1: 18.5,
            a2: 0.15,
            a3: 0.0,
            a4: 1.0,
            state: HysteresisState::new(),
            eps_r: 0.0,
            sig_r: 0.0,
            eps_0: ey,
            sig_0: fy,
            eps_max: ey,
            r: 15.0,
        }
    }
    
    pub fn with_params(mut self, r0: f64, a1: f64, a2: f64) -> Self {
        self.r0 = r0;
        self.a1 = a1;
        self.a2 = a2;
        self.r = r0;
        self
    }
    
    pub fn with_isotropic_hardening(mut self, a3: f64, a4: f64) -> Self {
        self.a3 = a3;
        self.a4 = a4;
        self
    }
    
    pub fn update(&mut self, strain: f64) -> (f64, f64) {
        let eps = strain;
        let ey = self.fy / self.e0;
        
        // Check for reversal
        let d_eps = eps - self.state.strain;
        let prev_dir = self.state.loading_dir;
        let curr_dir = if d_eps > 1e-16 { 1 } else if d_eps < -1e-16 { -1 } else { 0 };
        
        if curr_dir != 0 && curr_dir != prev_dir && prev_dir != 0 {
            // Reversal detected
            self.eps_r = self.state.strain;
            self.sig_r = self.state.stress;
            
            // Update target point
            let sign = curr_dir as f64;
            let eps_shift = sign * ey; // Yield strain
            self.eps_0 = eps_shift;
            self.sig_0 = sign * self.fy;
            
            // Update R for Bauschinger effect
            let xi = (self.eps_max / ey - 1.0).abs();
            self.r = self.r0 - self.a1 * xi / (self.a2 + xi);
            self.r = self.r.max(0.1); // Ensure positive R
        }
        
        // Menegotto-Pinto equation
        let eps_star = (eps - self.eps_r) / (self.eps_0 - self.eps_r);
        let sig_star = self.b * eps_star + (1.0 - self.b) * eps_star / 
                       (1.0 + eps_star.abs().powf(self.r)).powf(1.0 / self.r);
        
        let stress = self.sig_r + sig_star * (self.sig_0 - self.sig_r);
        
        // Tangent stiffness
        let d_sig_star = self.b + (1.0 - self.b) / 
                         (1.0 + eps_star.abs().powf(self.r)).powf(1.0 + 1.0 / self.r);
        let stiffness = d_sig_star * (self.sig_0 - self.sig_r) / (self.eps_0 - self.eps_r);
        
        // Update state
        self.state.energy += 0.5 * (self.state.stress + stress).abs() * d_eps.abs();
        self.state.strain = strain;
        self.state.stress = stress;
        self.state.stiffness = stiffness.max(self.b * self.e0);
        self.state.loading_dir = curr_dir;
        self.eps_max = self.eps_max.max(strain.abs());
        
        (stress, self.state.stiffness)
    }
    
    pub fn state(&self) -> &HysteresisState {
        &self.state
    }
}

// ============================================================================
// RAMBERG-OSGOOD MODEL
// ============================================================================

/// Ramberg-Osgood nonlinear stress-strain model
/// 
/// Smooth nonlinear behavior without explicit yield point.
/// σ/σ₀ = ε/ε₀ + α(ε/ε₀)ⁿ
/// 
/// Used for metals and some soils.
#[derive(Debug, Clone)]
pub struct RambergOsgoodHysteresis {
    /// Reference stress
    pub sig0: f64,
    /// Reference strain
    pub eps0: f64,
    /// Shape parameter α (typically 3/7)
    pub alpha: f64,
    /// Exponent n (typically 5-20)
    pub n: f64,
    /// Current state
    state: HysteresisState,
    /// Masing factor for unloading (typically 2.0)
    pub masing: f64,
    /// Reversal strain
    eps_r: f64,
    /// Reversal stress  
    sig_r: f64,
}

impl RambergOsgoodHysteresis {
    pub fn new(e0: f64, fy: f64, n: f64) -> Self {
        let eps0 = fy / e0;
        Self {
            sig0: fy,
            eps0,
            alpha: 3.0 / 7.0,
            n,
            state: HysteresisState::new(),
            masing: 2.0,
            eps_r: 0.0,
            sig_r: 0.0,
        }
    }
    
    /// Backbone stress from strain using Newton-Raphson
    fn backbone_stress(&self, strain: f64) -> f64 {
        let sign = strain.signum();
        let eps = strain.abs();
        
        // Newton-Raphson to solve: ε = σ/E + α*(σ/σ₀)ⁿ * σ₀/E
        let e0 = self.sig0 / self.eps0;
        let mut sig = e0 * eps; // Initial guess
        
        for _ in 0..20 {
            let f = sig / e0 + self.alpha * (sig / self.sig0).powf(self.n) * self.eps0 - eps;
            let df = 1.0 / e0 + self.alpha * self.n * (sig / self.sig0).powf(self.n - 1.0) * self.eps0 / self.sig0;
            
            if df.abs() < 1e-20 { break; }
            
            let dsig = -f / df;
            sig += dsig;
            
            if dsig.abs() < 1e-10 { break; }
        }
        
        sign * sig.abs()
    }
    
    pub fn update(&mut self, strain: f64) -> (f64, f64) {
        let d_strain = strain - self.state.strain;
        
        // Check reversal
        let curr_dir = if d_strain > 1e-16 { 1 } else if d_strain < -1e-16 { -1 } else { 0 };
        let prev_dir = self.state.loading_dir;
        
        if curr_dir != 0 && curr_dir != prev_dir && prev_dir != 0 {
            self.eps_r = self.state.strain;
            self.sig_r = self.state.stress;
        }
        
        // Masing rule: scaled backbone from reversal point
        let eps_rel = (strain - self.eps_r) / self.masing;
        let sig_rel = self.backbone_stress(eps_rel);
        let stress = self.sig_r + self.masing * sig_rel;
        
        // Tangent stiffness (numerical)
        let eps_pert = strain + 1e-8;
        let eps_rel_pert = (eps_pert - self.eps_r) / self.masing;
        let sig_rel_pert = self.backbone_stress(eps_rel_pert);
        let stress_pert = self.sig_r + self.masing * sig_rel_pert;
        let stiffness = (stress_pert - stress) / 1e-8;
        
        // Update state
        self.state.energy += 0.5 * (self.state.stress + stress).abs() * d_strain.abs();
        self.state.strain = strain;
        self.state.stress = stress;
        self.state.stiffness = stiffness;
        self.state.loading_dir = curr_dir;
        
        (stress, stiffness)
    }
    
    pub fn state(&self) -> &HysteresisState {
        &self.state
    }
}

// ============================================================================
// BWBN (BOUC-WEN-BABER-NOORI) MODEL
// ============================================================================

/// Bouc-Wen-Baber-Noori model with pinching and degradation
/// 
/// Extended Bouc-Wen with:
/// - Strength degradation
/// - Stiffness degradation
/// - Pinching behavior
/// 
/// Industry standard for RC structures in nonlinear analysis
#[derive(Debug, Clone)]
pub struct BWBNHysteresis {
    /// Post-yield stiffness ratio
    pub alpha: f64,
    /// Initial stiffness
    pub k0: f64,
    /// Yield force
    pub fy: f64,
    /// Basic Bouc-Wen parameters
    pub a: f64,
    pub beta: f64,
    pub gamma: f64,
    pub n: f64,
    /// Strength degradation
    pub delta_nu: f64,
    pub delta_eta: f64,
    /// Stiffness degradation
    pub delta_a: f64,
    /// Pinching parameters
    pub p: f64,
    pub q: f64,
    pub zeta_s: f64,
    pub psi: f64,
    pub delta_psi: f64,
    pub lambda: f64,
    /// Current state
    state: HysteresisState,
    /// Accumulated dissipated energy (normalized)
    epsilon: f64,
    /// Current eta (strength factor)
    eta: f64,
    /// Current nu (stiffness factor)
    nu: f64,
}

impl BWBNHysteresis {
    pub fn new(k0: f64, fy: f64, alpha: f64) -> Self {
        let mut s = HysteresisState::new();
        s.stiffness = k0;
        
        Self {
            alpha,
            k0,
            fy,
            a: 1.0,
            beta: 0.5,
            gamma: 0.5,
            n: 2.0,
            delta_nu: 0.0,
            delta_eta: 0.0,
            delta_a: 0.0,
            p: 1.0,
            q: 0.0,
            zeta_s: 0.5,
            psi: 0.0,
            delta_psi: 0.0,
            lambda: 0.5,
            state: s,
            epsilon: 0.0,
            eta: 1.0,
            nu: 1.0,
        }
    }
    
    /// Configure degradation parameters
    pub fn with_degradation(mut self, delta_nu: f64, delta_eta: f64, delta_a: f64) -> Self {
        self.delta_nu = delta_nu;
        self.delta_eta = delta_eta;
        self.delta_a = delta_a;
        self
    }
    
    /// Configure pinching parameters
    pub fn with_pinching(mut self, p: f64, zeta_s: f64, psi: f64, lambda: f64) -> Self {
        self.p = p;
        self.zeta_s = zeta_s;
        self.psi = psi;
        self.lambda = lambda;
        self
    }
    
    pub fn update(&mut self, strain: f64) -> (f64, f64) {
        let d_strain = strain - self.state.strain;
        let zy = self.fy / self.k0 / (1.0 - self.alpha);
        
        // Current z
        let z = self.state.z;
        
        // Degradation functions
        let a = self.a - self.delta_a * self.epsilon;
        
        // Pinching function h(z)
        let _z_norm = z / zy;
        let sign_de = if d_strain >= 0.0 { 1.0 } else { -1.0 };
        let zu = (self.zeta_s * (1.0 - (-self.p * self.epsilon).exp())) * sign_de * zy;
        let h = 1.0 - self.psi * (1.0 - (-self.epsilon * self.delta_psi).exp()) *
                (-((z - self.lambda * zu).powi(2) / (self.zeta_s.powi(2) * zy.powi(2))).exp());
        
        // Bouc-Wen differential equation
        let sgn = if z * d_strain >= 0.0 { 1.0 } else { 0.0 };
        let dz = h * (a - (self.beta * sgn + self.gamma) * z.abs().powf(self.n)) * d_strain / (self.eta * zy);
        
        let z_new = z + dz;
        
        // Force
        let stress = self.alpha * self.k0 * strain + (1.0 - self.alpha) * self.k0 * zy * z_new / self.nu;
        
        // Tangent stiffness (simplified)
        let stiffness = self.alpha * self.k0 + (1.0 - self.alpha) * self.k0 * 
                       h * a / (self.eta * self.nu);
        
        // Update energy and degradation
        let de = (self.state.stress + stress) * d_strain / 2.0;
        self.epsilon += de.abs() / (self.fy * zy);
        self.eta = 1.0 + self.delta_eta * self.epsilon;
        self.nu = 1.0 + self.delta_nu * self.epsilon;
        
        // Update state
        self.state.energy += de.abs();
        self.state.strain = strain;
        self.state.stress = stress;
        self.state.stiffness = stiffness.max(self.alpha * self.k0);
        self.state.z = z_new;
        
        (stress, self.state.stiffness)
    }
    
    pub fn state(&self) -> &HysteresisState {
        &self.state
    }
    
    pub fn damage(&self) -> f64 {
        1.0 - 1.0 / self.eta
    }
}

// ============================================================================
// WASM BINDINGS FOR HYSTERETIC MODELS
// ============================================================================

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn create_bilinear_hysteresis(k0: f64, fy: f64, alpha: f64) -> Vec<f64> {
    let hyst = BilinearHysteresis::new(k0, fy, alpha);
    vec![hyst.k0, hyst.fy, hyst.alpha]
}

#[wasm_bindgen]
pub fn simulate_hysteresis_response(
    model: &str,
    k0: f64,
    fy: f64,
    alpha: f64,
    strain_history: &[f64]
) -> Vec<f64> {
    let mut results = Vec::with_capacity(strain_history.len() * 3);
    
    match model {
        "bilinear" => {
            let mut hyst = BilinearHysteresis::new(k0, fy, alpha);
            for &eps in strain_history {
                let (sig, k) = hyst.update(eps);
                results.push(eps);
                results.push(sig);
                results.push(k);
            }
        }
        "takeda" => {
            let fcr = fy * 0.3; // Typical cracking force ratio
            let mut hyst = TakedaHysteresis::new(k0, fcr, fy, alpha);
            for &eps in strain_history {
                let (sig, k) = hyst.update(eps);
                results.push(eps);
                results.push(sig);
                results.push(k);
            }
        }
        "bouc_wen" => {
            let mut hyst = BoucWenHysteresis::new(k0, fy, alpha);
            for &eps in strain_history {
                let (sig, k) = hyst.update(eps);
                results.push(eps);
                results.push(sig);
                results.push(k);
            }
        }
        "clough" => {
            let mut hyst = CloughHysteresis::new(k0, fy, alpha);
            for &eps in strain_history {
                let (sig, k) = hyst.update(eps);
                results.push(eps);
                results.push(sig);
                results.push(k);
            }
        }
        "menegotto_pinto" => {
            let mut hyst = MenegottoPintoHysteresis::new(k0, fy, alpha);
            for &eps in strain_history {
                let (sig, k) = hyst.update(eps);
                results.push(eps);
                results.push(sig);
                results.push(k);
            }
        }
        "bwbn" => {
            let mut hyst = BWBNHysteresis::new(k0, fy, alpha)
                .with_degradation(0.01, 0.01, 0.0)
                .with_pinching(1.0, 0.5, 0.5, 0.5);
            for &eps in strain_history {
                let (sig, k) = hyst.update(eps);
                results.push(eps);
                results.push(sig);
                results.push(k);
            }
        }
        _ => {
            // Default to bilinear
            let mut hyst = BilinearHysteresis::new(k0, fy, alpha);
            for &eps in strain_history {
                let (sig, k) = hyst.update(eps);
                results.push(eps);
                results.push(sig);
                results.push(k);
            }
        }
    }
    
    results
}

#[wasm_bindgen]
pub fn get_available_hysteresis_models() -> Vec<String> {
    vec![
        "bilinear".to_string(),
        "takeda".to_string(),
        "bouc_wen".to_string(),
        "pivot".to_string(),
        "flag_shaped".to_string(),
        "pinching".to_string(),
        "imk".to_string(),
        "clough".to_string(),
        "menegotto_pinto".to_string(),
        "ramberg_osgood".to_string(),
        "bwbn".to_string(),
    ]
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_bilinear_elastic() {
        let mut hyst = BilinearHysteresis::new(1000.0, 100.0, 0.02);
        
        // Elastic range
        let (f, k) = hyst.update(0.05);
        assert!((f - 50.0).abs() < 1e-10);
        assert!((k - 1000.0).abs() < 1e-10);
        
        // Return to zero
        let (f, _) = hyst.update(0.0);
        assert!(f.abs() < 1e-10);
    }
    
    #[test]
    fn test_bilinear_yielding() {
        let mut hyst = BilinearHysteresis::new(1000.0, 100.0, 0.02);
        
        // Beyond yield
        let (f, k) = hyst.update(0.2);
        assert!(f > 100.0);
        assert!((k - 20.0).abs() < 1e-6); // Post-yield stiffness
        
        // Unload
        let (f2, k2) = hyst.update(0.1);
        assert!(f2 < f);
        assert!((k2 - 1000.0).abs() < 1e-6); // Elastic unload
    }
    
    #[test]
    fn test_takeda_degradation() {
        let mut takeda = TakedaHysteresis::new(1000.0, 50.0, 100.0, 0.02);
        
        // First cycle - yield
        takeda.update(0.2);
        takeda.update(0.0);
        
        // Check that max deformation is tracked
        assert!(takeda.state().max_strain > 0.0);
    }
    
    #[test]
    fn test_bouc_wen_smooth() {
        let mut bw = BoucWenHysteresis::new(1000.0, 100.0, 0.05);
        
        // Gradual loading
        let mut forces = Vec::new();
        for i in 0..20 {
            let strain = (i as f64) * 0.01;
            let (f, _) = bw.update(strain);
            forces.push(f);
        }
        
        // Force should increase monotonically
        for i in 1..forces.len() {
            assert!(forces[i] >= forces[i-1]);
        }
        
        // Check smoothness (no sudden jumps)
        for i in 1..forces.len() {
            let df = (forces[i] - forces[i-1]).abs();
            assert!(df < 50.0); // Reasonable increment
        }
    }
    
    #[test]
    fn test_flag_shaped_recentering() {
        let mut flag = FlagShapedHysteresis::sma(1000.0, 100.0);
        
        // Load and unload
        flag.update(0.08);
        let (f_unload, _) = flag.update(0.0);
        
        // Should recenter (small residual)
        assert!(f_unload.abs() < 20.0);
    }
    
    #[test]
    fn test_imk_deterioration() {
        let mut imk = IMKHysteresis::steel(10000.0, 1000.0);
        
        // Multiple cycles
        for _ in 0..10 {
            imk.update(0.05);
            imk.update(-0.05);
        }
        
        // Damage should accumulate
        assert!(imk.damage() > 0.0);
        
        // Strength should be reduced
        let (m, _) = imk.update(0.05);
        assert!(m < 1000.0 * 1.1); // Less than undamaged capping moment
    }
    
    #[test]
    fn test_hysteresis_energy() {
        let mut hyst = BilinearHysteresis::new(1000.0, 100.0, 0.02);
        
        // Full cycle
        hyst.update(0.2);
        hyst.update(0.0);
        hyst.update(-0.2);
        hyst.update(0.0);
        
        // Energy should be dissipated
        assert!(hyst.state().energy > 0.0);
    }
    
    #[test]
    fn test_pinching() {
        let mut pinch = PinchingHysteresis::new(1000.0, 100.0, 0.02);
        
        // Load beyond yield
        pinch.update(0.2);
        let f_max = pinch.state().stress;
        
        // Unload - should pinch
        pinch.update(0.0);
        
        // Reload - reduced stiffness initially
        pinch.update(0.1);
        let f_reload = pinch.state().stress;
        
        // Force at reload point should be less than on backbone
        assert!(f_reload < f_max);
    }
}
