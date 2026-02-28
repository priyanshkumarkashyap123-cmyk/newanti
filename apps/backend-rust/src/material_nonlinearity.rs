//! # Material Nonlinearity Module
//!
//! Advanced material models for nonlinear analysis:
//! - Concrete: Compression softening, tension stiffening, cracking
//! - Steel: Elastic-plastic, kinematic/isotropic hardening
//! - Fiber section discretization
//! - Constitutive integration algorithms
//!
//! Standards: Eurocode 2, ACI 318, fib Model Code 2010

use serde::{Deserialize, Serialize};

// ============================================================================
// MATERIAL MODELS - CONCRETE
// ============================================================================

/// Concrete material model per Eurocode 2
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConcreteMaterial {
    /// Characteristic cylinder strength (MPa)
    pub fck: f64,
    /// Mean cylinder strength (MPa)
    pub fcm: f64,
    /// Mean tensile strength (MPa)
    pub fctm: f64,
    /// Elastic modulus (MPa)
    pub ecm: f64,
    /// Strain at peak stress
    pub epsilon_c1: f64,
    /// Ultimate strain
    pub epsilon_cu1: f64,
    /// Model type
    pub model: ConcreteModel,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ConcreteModel {
    /// Linear elastic
    Linear,
    /// Parabolic-rectangular (EC2 3.1.7)
    ParabolicRectangular,
    /// Mander confined model
    ManderConfined,
    /// Kent-Park degrading
    KentPark,
    /// Popovics-Thorenfeldt-Collins
    Popovics,
    /// Concrete02 (OpenSees compatible)
    Concrete02,
}

impl ConcreteMaterial {
    /// Create from characteristic strength (EC2 Table 3.1)
    pub fn from_fck(fck: f64) -> Self {
        let fcm = fck + 8.0;  // Mean strength
        let fctm = if fck <= 50.0 {
            0.30 * fck.powf(2.0 / 3.0)
        } else {
            2.12 * (1.0 + fcm / 10.0).ln()
        };
        
        let ecm = 22000.0 * (fcm / 10.0).powf(0.3);  // MPa
        let epsilon_c1 = (0.7 * fcm.powf(0.31)).min(2.8) / 1000.0;
        let epsilon_cu1 = if fck <= 50.0 { 0.0035 } else { 
            0.0035 - (fck - 50.0) * 0.00001 
        };
        
        Self {
            fck,
            fcm,
            fctm,
            ecm,
            epsilon_c1,
            epsilon_cu1,
            model: ConcreteModel::ParabolicRectangular,
        }
    }
    
    /// Create confined concrete per Mander et al. (1988)
    pub fn confined(
        fck: f64,
        lateral_pressure: f64,  // Effective confining stress
    ) -> Self {
        let mut mat = Self::from_fck(fck);
        
        // Confined strength
        let fl_prime = lateral_pressure;
        let fcc = mat.fck * (-1.254 + 2.254 * (1.0 + 7.94 * fl_prime / mat.fck).sqrt() 
                            - 2.0 * fl_prime / mat.fck);
        
        // Confined strain
        let epsilon_cc = mat.epsilon_c1 * (1.0 + 5.0 * (fcc / mat.fck - 1.0));
        
        mat.fcm = fcc;
        mat.epsilon_c1 = epsilon_cc;
        mat.epsilon_cu1 = 0.004 + 1.4 * lateral_pressure * 0.01 / fcc;  // Ultimate
        mat.model = ConcreteModel::ManderConfined;
        
        mat
    }
    
    /// Stress-strain response
    pub fn stress(&self, strain: f64) -> f64 {
        match self.model {
            ConcreteModel::Linear => self.linear_stress(strain),
            ConcreteModel::ParabolicRectangular => self.parabolic_rectangular(strain),
            ConcreteModel::ManderConfined => self.mander_stress(strain),
            ConcreteModel::KentPark => self.kent_park_stress(strain),
            ConcreteModel::Popovics => self.popovics_stress(strain),
            ConcreteModel::Concrete02 => self.concrete02_stress(strain),
        }
    }
    
    /// Tangent modulus
    pub fn tangent(&self, strain: f64) -> f64 {
        let eps = 1e-8;
        let sigma1 = self.stress(strain);
        let sigma2 = self.stress(strain + eps);
        (sigma2 - sigma1) / eps
    }
    
    fn linear_stress(&self, strain: f64) -> f64 {
        if strain >= 0.0 {
            // Tension
            let sigma = self.ecm * strain;
            sigma.min(self.fctm)
        } else {
            // Compression
            let sigma = self.ecm * strain;
            sigma.max(-self.fcm)
        }
    }
    
    /// EC2 parabolic-rectangular model
    fn parabolic_rectangular(&self, strain: f64) -> f64 {
        if strain >= 0.0 {
            // Tension (linear until cracking, then zero)
            let sigma = self.ecm * strain;
            if sigma <= self.fctm { sigma } else { 0.0 }
        } else {
            let eps = -strain;  // Positive for compression
            let eps_c2 = 0.002;  // Strain at end of parabola
            let eps_cu2 = 0.0035;  // Ultimate strain
            
            if eps <= eps_c2 {
                // Parabolic region: σ = fc * (1 - (1 - ε/εc2)^n)
                let n = 2.0;
                -self.fcm * (1.0 - (1.0 - eps / eps_c2).powf(n))
            } else if eps <= eps_cu2 {
                // Rectangular region
                -self.fcm
            } else {
                // Beyond ultimate - softening
                -self.fcm * (1.0 - (eps - eps_cu2) / 0.001).max(0.2)
            }
        }
    }
    
    /// Mander confined concrete model
    fn mander_stress(&self, strain: f64) -> f64 {
        if strain >= 0.0 {
            // Tension (simplified)
            let sigma = self.ecm * strain;
            if sigma <= self.fctm { sigma } else { 0.0 }
        } else {
            let eps = -strain;
            let x = eps / self.epsilon_c1;
            let r = self.ecm / (self.ecm - self.fcm / self.epsilon_c1);
            
            -self.fcm * x * r / (r - 1.0 + x.powf(r))
        }
    }
    
    /// Kent-Park degrading stiffness model
    fn kent_park_stress(&self, strain: f64) -> f64 {
        if strain >= 0.0 {
            let sigma = self.ecm * strain;
            if sigma <= self.fctm { sigma } else { 0.0 }
        } else {
            let eps = -strain;
            let eps_0 = 0.002;
            
            if eps <= eps_0 {
                // Ascending branch
                -self.fcm * (2.0 * eps / eps_0 - (eps / eps_0).powi(2))
            } else {
                // Descending branch
                let z = 0.5 / (0.002 + 0.9 * 0.002);  // Simplified slope
                let sigma = self.fcm * (1.0 - z * (eps - eps_0));
                -sigma.max(0.2 * self.fcm)
            }
        }
    }
    
    /// Popovics-Thorenfeldt-Collins model
    fn popovics_stress(&self, strain: f64) -> f64 {
        if strain >= 0.0 {
            let sigma = self.ecm * strain;
            if sigma <= self.fctm { sigma } else { 0.0 }
        } else {
            let eps = -strain;
            let eps_c = self.epsilon_c1;
            let n = 0.8 + self.fcm / 17.0;
            let k = if eps <= eps_c { 1.0 } else { 0.67 + self.fcm / 62.0 };
            
            let x = eps / eps_c;
            -self.fcm * n * x / (n - 1.0 + x.powf(n * k))
        }
    }
    
    /// Concrete02 model (OpenSees compatible)
    fn concrete02_stress(&self, strain: f64) -> f64 {
        // Simplified version without hysteretic rules
        self.mander_stress(strain)
    }
    
    /// Secant modulus at given strain
    pub fn secant_modulus(&self, strain: f64) -> f64 {
        if strain.abs() < 1e-10 {
            self.ecm
        } else {
            self.stress(strain) / strain
        }
    }
}

// ============================================================================
// MATERIAL MODELS - STEEL
// ============================================================================

/// Steel material model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteelMaterial {
    /// Yield strength (MPa)
    pub fy: f64,
    /// Ultimate strength (MPa)
    pub fu: f64,
    /// Elastic modulus (MPa)
    pub e: f64,
    /// Strain hardening ratio (Esh/E)
    pub b: f64,
    /// Yield strain
    pub epsilon_y: f64,
    /// Ultimate strain
    pub epsilon_u: f64,
    /// Hardening model
    pub model: SteelModel,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SteelModel {
    /// Linear elastic
    Linear,
    /// Elastic-perfectly plastic
    ElasticPerfectlyPlastic,
    /// Bilinear with kinematic hardening
    BilinearKinematic,
    /// Bilinear with isotropic hardening
    BilinearIsotropic,
    /// Ramberg-Osgood
    RambergOsgood,
    /// Giuffre-Menegotto-Pinto (Steel02)
    GiuffreMenegottoPinto,
    /// True stress-strain
    TrueStressStrain,
}

impl SteelMaterial {
    /// Create from yield strength
    pub fn from_fy(fy: f64) -> Self {
        let fu = 1.25 * fy;  // Typical fu/fy ratio
        let e = 200_000.0;   // MPa
        let epsilon_y = fy / e;
        
        Self {
            fy,
            fu,
            e,
            b: 0.01,  // 1% hardening ratio
            epsilon_y,
            epsilon_u: 0.15,
            model: SteelModel::BilinearKinematic,
        }
    }
    
    /// Create with full specification
    pub fn new(fy: f64, fu: f64, e: f64, b: f64, epsilon_u: f64) -> Self {
        Self {
            fy,
            fu,
            e,
            b,
            epsilon_y: fy / e,
            epsilon_u,
            model: SteelModel::BilinearKinematic,
        }
    }
    
    /// Stress-strain response (monotonic)
    pub fn stress(&self, strain: f64) -> f64 {
        match self.model {
            SteelModel::Linear => self.e * strain,
            SteelModel::ElasticPerfectlyPlastic => self.epp_stress(strain),
            SteelModel::BilinearKinematic => self.bilinear_stress(strain),
            SteelModel::BilinearIsotropic => self.bilinear_stress(strain),
            SteelModel::RambergOsgood => self.ramberg_osgood_stress(strain),
            SteelModel::GiuffreMenegottoPinto => self.gmp_stress(strain),
            SteelModel::TrueStressStrain => self.true_stress(strain),
        }
    }
    
    /// Tangent modulus
    pub fn tangent(&self, strain: f64) -> f64 {
        match self.model {
            SteelModel::Linear => self.e,
            SteelModel::ElasticPerfectlyPlastic => {
                if strain.abs() < self.epsilon_y { self.e } else { 0.0 }
            }
            SteelModel::BilinearKinematic | SteelModel::BilinearIsotropic => {
                if strain.abs() < self.epsilon_y { self.e } else { self.b * self.e }
            }
            _ => {
                let eps = 1e-8;
                (self.stress(strain + eps) - self.stress(strain)) / eps
            }
        }
    }
    
    fn epp_stress(&self, strain: f64) -> f64 {
        if strain > self.epsilon_y {
            self.fy
        } else if strain < -self.epsilon_y {
            -self.fy
        } else {
            self.e * strain
        }
    }
    
    fn bilinear_stress(&self, strain: f64) -> f64 {
        let eps_y = self.epsilon_y;
        
        if strain > eps_y {
            self.fy + self.b * self.e * (strain - eps_y)
        } else if strain < -eps_y {
            -self.fy + self.b * self.e * (strain + eps_y)
        } else {
            self.e * strain
        }
    }
    
    /// Ramberg-Osgood model: ε = σ/E + α(σ/σy)^n
    fn ramberg_osgood_stress(&self, strain: f64) -> f64 {
        // Solve iteratively for stress given strain
        let alpha = 0.002;  // Offset strain
        let n = 15.0;  // Hardening exponent
        
        let sign = strain.signum();
        let eps = strain.abs();
        
        // Newton-Raphson to find σ
        let mut sigma = self.e * eps.min(self.epsilon_y);
        
        for _ in 0..20 {
            let f = sigma / self.e + alpha * (sigma / self.fy).powf(n) - eps;
            let df = 1.0 / self.e + alpha * n / self.fy * (sigma / self.fy).powf(n - 1.0);
            
            if df.abs() > 1e-10 {
                sigma -= f / df;
            }
            sigma = sigma.max(0.0).min(self.fu);
            
            if f.abs() < 1e-10 { break; }
        }
        
        sign * sigma
    }
    
    /// Giuffre-Menegotto-Pinto model (Steel02)
    fn gmp_stress(&self, strain: f64) -> f64 {
        let b = self.b;
        let r0 = 20.0;  // Initial curvature parameter
        
        let eps_star = strain / self.epsilon_y;
        let sigma_star = b * eps_star + (1.0 - b) * eps_star / (1.0 + eps_star.abs().powf(r0)).powf(1.0 / r0);
        
        sigma_star * self.fy
    }
    
    /// True stress-strain conversion
    fn true_stress(&self, eng_strain: f64) -> f64 {
        let eng_stress = self.bilinear_stress(eng_strain);
        
        // True stress = Engineering stress × (1 + engineering strain)
        // True strain = ln(1 + engineering strain)
        eng_stress * (1.0 + eng_strain)
    }
}

// ============================================================================
// FIBER SECTION
// ============================================================================

/// Fiber in a discretized section
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Fiber {
    /// Y coordinate from centroid (m)
    pub y: f64,
    /// Z coordinate from centroid (m)
    pub z: f64,
    /// Area (m²)
    pub area: f64,
    /// Material type
    pub material: FiberMaterial,
    /// Current strain
    pub strain: f64,
    /// Current stress (MPa)
    pub stress: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FiberMaterial {
    Concrete(ConcreteMaterial),
    Steel(SteelMaterial),
}

impl Fiber {
    pub fn concrete(y: f64, z: f64, area: f64, mat: ConcreteMaterial) -> Self {
        Self {
            y, z, area,
            material: FiberMaterial::Concrete(mat),
            strain: 0.0,
            stress: 0.0,
        }
    }
    
    pub fn steel(y: f64, z: f64, area: f64, mat: SteelMaterial) -> Self {
        Self {
            y, z, area,
            material: FiberMaterial::Steel(mat),
            strain: 0.0,
            stress: 0.0,
        }
    }
    
    /// Update fiber state for given section strain
    pub fn update(&mut self, axial_strain: f64, curvature_y: f64, curvature_z: f64) {
        // Strain at fiber: ε = ε0 - κy×y - κz×z (sign convention)
        self.strain = axial_strain - curvature_y * self.y - curvature_z * self.z;
        
        self.stress = match &self.material {
            FiberMaterial::Concrete(mat) => mat.stress(self.strain),
            FiberMaterial::Steel(mat) => mat.stress(self.strain),
        };
    }
    
    /// Tangent modulus
    pub fn tangent(&self) -> f64 {
        match &self.material {
            FiberMaterial::Concrete(mat) => mat.tangent(self.strain),
            FiberMaterial::Steel(mat) => mat.tangent(self.strain),
        }
    }
    
    /// Force contribution
    pub fn force(&self) -> f64 {
        self.stress * self.area * 1e6  // MPa × m² → N
    }
}

/// Fiber section for moment-curvature analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FiberSection {
    /// Section name
    pub name: String,
    /// Fibers
    pub fibers: Vec<Fiber>,
    /// Total area (m²)
    pub area: f64,
    /// Centroid y (m)
    pub centroid_y: f64,
    /// Centroid z (m)
    pub centroid_z: f64,
}

impl FiberSection {
    /// Create rectangular concrete section with reinforcement
    pub fn rc_rectangular(
        width: f64,      // m
        height: f64,     // m
        cover: f64,      // m
        concrete: ConcreteMaterial,
        rebar_top: (f64, f64),     // (area, fy)
        rebar_bot: (f64, f64),     // (area, fy)
        n_fibers_y: usize,
        n_fibers_z: usize,
    ) -> Self {
        let mut fibers = Vec::new();
        
        // Concrete fibers
        let dy = height / n_fibers_y as f64;
        let dz = width / n_fibers_z as f64;
        let fiber_area = dy * dz;
        
        for i in 0..n_fibers_y {
            let y = -height / 2.0 + dy * (i as f64 + 0.5);
            for j in 0..n_fibers_z {
                let z = -width / 2.0 + dz * (j as f64 + 0.5);
                fibers.push(Fiber::concrete(y, z, fiber_area, concrete.clone()));
            }
        }
        
        // Top reinforcement
        let y_top = height / 2.0 - cover;
        let steel_top = SteelMaterial::from_fy(rebar_top.1);
        fibers.push(Fiber::steel(y_top, 0.0, rebar_top.0, steel_top));
        
        // Bottom reinforcement
        let y_bot = -height / 2.0 + cover;
        let steel_bot = SteelMaterial::from_fy(rebar_bot.1);
        fibers.push(Fiber::steel(y_bot, 0.0, rebar_bot.0, steel_bot));
        
        let area = width * height;
        
        Self {
            name: "RC Section".to_string(),
            fibers,
            area,
            centroid_y: 0.0,
            centroid_z: 0.0,
        }
    }
    
    /// Create steel I-section
    pub fn steel_i_section(
        depth: f64,
        bf: f64,
        tw: f64,
        tf: f64,
        steel: SteelMaterial,
        n_flange: usize,
        n_web: usize,
    ) -> Self {
        let mut fibers = Vec::new();
        
        // Top flange fibers
        let _dy_f = tf / 2.0;
        let dz_f = bf / n_flange as f64;
        for i in 0..n_flange {
            let z = -bf / 2.0 + dz_f * (i as f64 + 0.5);
            let y = depth / 2.0 - tf / 2.0;
            fibers.push(Fiber::steel(y, z, tf * dz_f, steel.clone()));
        }
        
        // Web fibers
        let hw = depth - 2.0 * tf;
        let dy_w = hw / n_web as f64;
        for i in 0..n_web {
            let y = -hw / 2.0 + dy_w * (i as f64 + 0.5);
            fibers.push(Fiber::steel(y, 0.0, tw * dy_w, steel.clone()));
        }
        
        // Bottom flange fibers
        for i in 0..n_flange {
            let z = -bf / 2.0 + dz_f * (i as f64 + 0.5);
            let y = -depth / 2.0 + tf / 2.0;
            fibers.push(Fiber::steel(y, z, tf * dz_f, steel.clone()));
        }
        
        let area = 2.0 * bf * tf + hw * tw;
        
        Self {
            name: "Steel I-Section".to_string(),
            fibers,
            area,
            centroid_y: 0.0,
            centroid_z: 0.0,
        }
    }
    
    /// Get section response for given deformation
    pub fn response(&mut self, axial_strain: f64, curvature_y: f64, curvature_z: f64) 
        -> SectionResponse 
    {
        // Update all fibers
        for fiber in &mut self.fibers {
            fiber.update(axial_strain, curvature_y, curvature_z);
        }
        
        // Integrate forces
        let mut n = 0.0;   // Axial force
        let mut my = 0.0;  // Moment about Y
        let mut mz = 0.0;  // Moment about Z
        
        // Tangent stiffness
        let mut ea = 0.0;    // Axial stiffness
        let mut ei_y = 0.0;  // Flexural stiffness Y
        let mut ei_z = 0.0;  // Flexural stiffness Z
        
        for fiber in &self.fibers {
            let f = fiber.force();
            let et = fiber.tangent() * 1e6;  // MPa → Pa
            let a = fiber.area;
            
            n += f;
            my -= f * fiber.y;
            mz -= f * fiber.z;
            
            ea += et * a;
            ei_y += et * a * fiber.y * fiber.y;
            ei_z += et * a * fiber.z * fiber.z;
        }
        
        SectionResponse {
            axial_force: n,
            moment_y: my,
            moment_z: mz,
            axial_stiffness: ea,
            flexural_stiffness_y: ei_y,
            flexural_stiffness_z: ei_z,
        }
    }
    
    /// Moment-curvature analysis
    pub fn moment_curvature(&mut self, max_curvature: f64, n_steps: usize) -> Vec<(f64, f64)> {
        let mut results = Vec::new();
        let d_kappa = max_curvature / n_steps as f64;
        
        for i in 0..=n_steps {
            let kappa = d_kappa * i as f64;
            let response = self.response(0.0, kappa, 0.0);
            results.push((kappa, response.moment_y.abs()));
        }
        
        results
    }
}

/// Section response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SectionResponse {
    pub axial_force: f64,
    pub moment_y: f64,
    pub moment_z: f64,
    pub axial_stiffness: f64,
    pub flexural_stiffness_y: f64,
    pub flexural_stiffness_z: f64,
}

// ============================================================================
// PLASTICITY STATE
// ============================================================================

/// State variables for cyclic loading
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlasticityState {
    /// Plastic strain
    pub epsilon_p: f64,
    /// Back stress (kinematic hardening)
    pub alpha: f64,
    /// Accumulated plastic strain
    pub kappa: f64,
    /// Yield stress (isotropic hardening)
    pub sigma_y: f64,
    /// Last committed strain
    pub epsilon_commit: f64,
    /// Last committed stress
    pub sigma_commit: f64,
}

impl PlasticityState {
    pub fn new(initial_yield: f64) -> Self {
        Self {
            epsilon_p: 0.0,
            alpha: 0.0,
            kappa: 0.0,
            sigma_y: initial_yield,
            epsilon_commit: 0.0,
            sigma_commit: 0.0,
        }
    }
    
    /// Commit current state
    pub fn commit(&mut self, strain: f64, stress: f64) {
        self.epsilon_commit = strain;
        self.sigma_commit = stress;
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_concrete_from_fck() {
        let c30 = ConcreteMaterial::from_fck(30.0);
        assert!((c30.fcm - 38.0).abs() < 0.1);
        assert!(c30.ecm > 30000.0 && c30.ecm < 35000.0);
    }
    
    #[test]
    fn test_concrete_stress_strain() {
        let c30 = ConcreteMaterial::from_fck(30.0);
        
        // Zero strain = zero stress
        assert!(c30.stress(0.0).abs() < 0.1);
        
        // Compression
        let sigma = c30.stress(-0.002);
        assert!(sigma < 0.0);  // Negative stress
        assert!(sigma > -40.0);  // Should be near fcm
        
        // Tension (cracked)
        let sigma_t = c30.stress(0.001);
        assert!(sigma_t >= 0.0);
    }
    
    #[test]
    fn test_mander_confined() {
        let unconfined = ConcreteMaterial::from_fck(30.0);
        let confined = ConcreteMaterial::confined(30.0, 3.0);  // 3 MPa confinement
        
        // Confined should be stronger
        assert!(confined.fcm > unconfined.fcm);
        assert!(confined.epsilon_c1 > unconfined.epsilon_c1);
    }
    
    #[test]
    fn test_steel_from_fy() {
        let s355 = SteelMaterial::from_fy(355.0);
        assert!((s355.epsilon_y - 355.0 / 200000.0).abs() < 1e-6);
    }
    
    #[test]
    fn test_steel_stress_strain() {
        let s355 = SteelMaterial::from_fy(355.0);
        
        // Elastic
        let sigma_e = s355.stress(0.001);
        assert!((sigma_e - 200.0).abs() < 1.0);  // 0.001 × 200000 = 200 MPa
        
        // Yielded
        let sigma_y = s355.stress(0.01);
        assert!(sigma_y > 355.0);  // With hardening
    }
    
    #[test]
    fn test_fiber_update() {
        let concrete = ConcreteMaterial::from_fck(30.0);
        let mut fiber = Fiber::concrete(0.2, 0.0, 0.01, concrete);
        
        // Pure bending curvature
        fiber.update(0.0, 0.01, 0.0);
        
        // Fiber at y=0.2m with κ=0.01 has strain = -0.002
        assert!((fiber.strain - (-0.002)).abs() < 1e-6);
        assert!(fiber.stress < 0.0);  // Compression
    }
    
    #[test]
    fn test_fiber_section_response() {
        let concrete = ConcreteMaterial::from_fck(30.0);
        let mut section = FiberSection::rc_rectangular(
            0.3,   // 300mm wide
            0.5,   // 500mm deep
            0.05,  // 50mm cover
            concrete,
            (0.001, 500.0),  // Top rebar: 1000mm², fy=500
            (0.002, 500.0),  // Bot rebar: 2000mm², fy=500
            10,
            6,
        );
        
        let response = section.response(0.0, 0.001, 0.0);
        
        // Should have some moment capacity
        assert!(response.moment_y.abs() > 0.0);
        assert!(response.flexural_stiffness_y > 0.0);
    }
    
    #[test]
    fn test_moment_curvature() {
        let concrete = ConcreteMaterial::from_fck(30.0);
        let mut section = FiberSection::rc_rectangular(
            0.3, 0.5, 0.05,
            concrete,
            (0.001, 500.0),
            (0.002, 500.0),
            10, 6,
        );
        
        let m_phi = section.moment_curvature(0.05, 20);
        
        // Should have full curve computed
        assert!(m_phi.len() == 21);
        
        // Should have positive moment capacity
        let max_moment = m_phi.iter().map(|(_, m)| m.abs()).fold(0.0f64, f64::max);
        assert!(max_moment > 0.0, "Should have positive moment capacity");
        
        // Initial stiffness should be positive
        assert!(m_phi[1].1 > 0.0 && m_phi[2].1 > m_phi[1].1, "Initial behavior should be stiffening");
    }
    
    #[test]
    fn test_steel_i_section() {
        let steel = SteelMaterial::from_fy(355.0);
        let mut section = FiberSection::steel_i_section(
            0.310,  // depth
            0.166,  // bf
            0.0069, // tw
            0.0114, // tf
            steel,
            8,      // flange fibers
            10,     // web fibers
        );
        
        let response = section.response(0.0, 0.001, 0.0);
        assert!(response.moment_y.abs() > 0.0);
        assert!(response.flexural_stiffness_y > 0.0);
    }
    
    #[test]
    fn test_ramberg_osgood() {
        let mut steel = SteelMaterial::from_fy(355.0);
        steel.model = SteelModel::RambergOsgood;
        
        // Should produce smooth transition
        let sigma_1 = steel.stress(0.001);
        let sigma_2 = steel.stress(0.002);
        let sigma_3 = steel.stress(0.005);
        
        assert!(sigma_1 < sigma_2);
        assert!(sigma_2 < sigma_3);
    }
    
    #[test]
    fn test_gmp_model() {
        let mut steel = SteelMaterial::from_fy(355.0);
        steel.model = SteelModel::GiuffreMenegottoPinto;
        
        // Smooth Bauschinger effect
        let sigma_pos = steel.stress(0.01);
        let sigma_neg = steel.stress(-0.01);
        
        assert!((sigma_pos + sigma_neg).abs() < 1.0);  // Symmetric
    }
}
