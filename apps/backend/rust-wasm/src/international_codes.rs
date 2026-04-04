//! Comprehensive Design Code Implementation
//! 
//! International structural design codes:
//! - ACI 318-19: Building Code Requirements for Structural Concrete
//! - Eurocode 2: Design of Concrete Structures
//! - Eurocode 3: Design of Steel Structures
//! - AS 4100: Steel Structures (Australian)
//! - CSA S16: Design of Steel Structures (Canadian)
//! - NBC India (IS 456, IS 800, IS 1893, IS 875)

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================
// COMMON TYPES
// ============================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesignResult {
    pub passed: bool,
    pub utilization_ratio: f64,
    pub capacity: f64,
    pub demand: f64,
    pub code_clause: String,
    pub warnings: Vec<String>,
    pub details: std::collections::HashMap<String, f64>,
}

impl DesignResult {
    pub fn new(passed: bool, utilization: f64, capacity: f64, demand: f64, clause: &str) -> Self {
        Self {
            passed,
            utilization_ratio: utilization,
            capacity,
            demand,
            code_clause: clause.to_string(),
            warnings: Vec::new(),
            details: std::collections::HashMap::new(),
        }
    }
    
    pub fn with_warning(mut self, warning: &str) -> Self {
        self.warnings.push(warning.to_string());
        self
    }
    
    pub fn with_detail(mut self, key: &str, value: f64) -> Self {
        self.details.insert(key.to_string(), value);
        self
    }
}

// ============================================
// ACI 318-19: CONCRETE DESIGN
// ============================================

pub mod aci318 {
    use super::*;
    
    /// Concrete material properties per ACI 318
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ConcreteMaterial {
        pub fc: f64,           // Specified compressive strength (MPa)
        pub wc: f64,           // Unit weight (kg/m³)
        pub aggregate: String, // Normal weight, lightweight, etc.
    }
    
    impl ConcreteMaterial {
        pub fn new(fc: f64) -> Self {
            Self {
                fc,
                wc: 2400.0,
                aggregate: "normal".to_string(),
            }
        }
        
        /// Modulus of elasticity per ACI 318-19 Table 19.2.2.1
        pub fn modulus(&self) -> f64 {
            if self.aggregate == "normal" {
                4700.0 * self.fc.sqrt() // MPa
            } else {
                // Lightweight concrete (ACI 318-19 Table 19.2.2.1(b) SI)
                0.043 * self.wc.powf(1.5) * self.fc.sqrt() // MPa
            }
        }
        
        /// Modulus of rupture per ACI 318-19 Eq. 19.2.3.1
        pub fn modulus_of_rupture(&self, lambda: f64) -> f64 {
            0.62 * lambda * self.fc.sqrt()
        }
    }
    
    /// Reinforcing steel properties
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct RebarMaterial {
        pub fy: f64,    // Yield strength (MPa)
        pub fu: f64,    // Ultimate strength (MPa)
        pub es: f64,    // Modulus (MPa)
    }
    
    impl Default for RebarMaterial {
        fn default() -> Self {
            Self {
                fy: 420.0,      // Grade 60 rebar
                fu: 620.0,
                es: 200000.0,
            }
        }
    }
    
    /// Beam section for flexural design
    #[derive(Debug, Clone)]
    pub struct BeamSection {
        pub b: f64,     // Width (mm)
        pub h: f64,     // Total depth (mm)
        pub d: f64,     // Effective depth (mm)
        pub d_prime: f64, // Compression steel depth (mm)
        pub as_tension: f64, // Tension steel area (mm²)
        pub as_compression: f64, // Compression steel area (mm²)
    }
    
    /// Flexural design per ACI 318-19 Chapter 22
    pub fn flexural_strength(
        section: &BeamSection,
        concrete: &ConcreteMaterial,
        rebar: &RebarMaterial,
        mu: f64, // Factored moment (kN·m)
    ) -> DesignResult {
        let fc = concrete.fc;
        let fy = rebar.fy;
        let b = section.b;
        let d = section.d;
        let as_t = section.as_tension;
        
        // Strength reduction factor (ACI 318-19 Table 21.2.1)
        let _phi = 0.90; // Tension-controlled
        
        // Beta1 factor (ACI 318-19 Table 22.2.2.4.3)
        let beta1 = if fc <= 28.0 {
            0.85
        } else if fc >= 55.0 {
            0.65
        } else {
            0.85 - 0.05 * (fc - 28.0) / 7.0
        };
        
        // Neutral axis depth from equilibrium
        // 0.85 * f'c * beta1 * c * b = As * fy
        let c = (as_t * fy) / (0.85 * fc * beta1 * b);
        
        // Check strain in tension steel (ACI 318-19 Table 21.2.2)
        let epsilon_cu = 0.003;
        let epsilon_t = epsilon_cu * (d - c) / c;
        let epsilon_ty = fy / rebar.es;
        
        // Adjust phi based on strain (ACI 318-19 Table 21.2.2)
        let phi_actual = if epsilon_t >= 0.005 {
            0.90 // Tension-controlled
        } else if epsilon_t <= epsilon_ty {
            0.65 // Compression-controlled
        } else {
            // Transition zone
            0.65 + 0.25 * (epsilon_t - epsilon_ty) / (0.005 - epsilon_ty)
        };
        
        // Moment arm
        let a = beta1 * c;
        
        // Nominal moment capacity
        let mn = as_t * fy * (d - a / 2.0) / 1e6; // kN·m
        
        // Design moment capacity
        let phi_mn = phi_actual * mn;
        
        // Utilization ratio
        let ratio = mu / phi_mn;
        
        let mut result = DesignResult::new(
            ratio <= 1.0,
            ratio,
            phi_mn,
            mu,
            "ACI 318-19 Sec. 22.2"
        );
        
        result = result
            .with_detail("neutral_axis_c", c)
            .with_detail("strain_epsilon_t", epsilon_t)
            .with_detail("phi_factor", phi_actual)
            .with_detail("nominal_Mn", mn)
            .with_detail("beta1", beta1);
        
        // Check minimum reinforcement (ACI 318-19 Table 9.6.1.2)
        let as_min = (0.25 * fc.sqrt() / fy).max(1.4 / fy) * b * d;
        if as_t < as_min {
            result = result.with_warning(&format!(
                "As = {:.0} mm² < As,min = {:.0} mm² (ACI 318-19 Table 9.6.1.2)",
                as_t, as_min
            ));
        }
        
        // Check maximum reinforcement
        let rho = as_t / (b * d);
        let rho_max = 0.85 * beta1 * fc / fy * 0.003 / (0.003 + 0.004);
        if rho > rho_max {
            result = result.with_warning(&format!(
                "ρ = {:.4} > ρ_max = {:.4} - Section may be compression-controlled",
                rho, rho_max
            ));
        }
        
        result
    }
    
    /// Shear design per ACI 318-19 Chapter 22
    pub fn shear_strength(
        section: &BeamSection,
        concrete: &ConcreteMaterial,
        vu: f64, // Factored shear (kN)
        nu: f64, // Factored axial load (kN), positive = compression
        av: f64, // Area of shear reinforcement (mm²)
        s: f64,  // Stirrup spacing (mm)
    ) -> DesignResult {
        let fc = concrete.fc;
        let b = section.b;
        let d = section.d;
        
        // Strength reduction factor (ACI 318-19 Table 21.2.1)
        let phi = 0.75;
        
        // Lambda factor for normal weight concrete
        let lambda = 1.0;
        
        // Concrete contribution (ACI 318-19 Eq. 22.5.5.1)
        // Simplified: Vc = 0.17 * λ * √f'c * bw * d
        let nu_ag = nu * 1000.0 / (b * section.h); // Axial stress
        let vc = if nu_ag >= 0.0 {
            // With axial compression
            0.17 * lambda * fc.sqrt() * (1.0 + nu_ag / (14.0 * fc.sqrt())).min(2.0)
        } else {
            // With axial tension
            0.17 * lambda * fc.sqrt() * (1.0 + nu_ag / (3.5 * fc.sqrt())).max(0.0)
        };
        
        let vc_force = vc * b * d / 1000.0; // kN
        
        // Steel contribution (ACI 318-19 Eq. 22.5.8.5.3)
        let vs_force = if s > 0.0 {
            av * 420.0 * d / s / 1000.0 // kN, assuming fy = 420 MPa
        } else {
            0.0
        };
        
        // Maximum shear reinforcement (ACI 318-19 Sec. 22.5.1.2)
        let vs_max = 0.66 * fc.sqrt() * b * d / 1000.0; // kN
        let vs_limited = vs_force.min(vs_max);
        
        // Nominal and design capacity
        let vn = vc_force + vs_limited;
        let phi_vn = phi * vn;
        
        let ratio = vu / phi_vn;
        
        let mut result = DesignResult::new(
            ratio <= 1.0,
            ratio,
            phi_vn,
            vu,
            "ACI 318-19 Sec. 22.5"
        );
        
        result = result
            .with_detail("Vc", vc_force)
            .with_detail("Vs", vs_limited)
            .with_detail("Vn", vn);
        
        // Check minimum shear reinforcement (ACI 318-19 Table 9.6.3.1)
        if vu > phi * vc_force / 2.0 {
            let av_min = (0.062 * fc.sqrt()).max(0.35) * b * s / 420.0;
            if av < av_min && s > 0.0 {
                result = result.with_warning(&format!(
                    "Av = {:.0} mm² < Av,min = {:.0} mm² (ACI 318-19 Table 9.6.3.1)",
                    av, av_min
                ));
            }
        }
        
        // Check maximum spacing (ACI 318-19 Table 9.7.6.2.2)
        let s_max = if vs_force <= 0.33 * fc.sqrt() * b * d / 1000.0 {
            (d / 2.0).min(600.0)
        } else {
            (d / 4.0).min(300.0)
        };
        
        if s > s_max {
            result = result.with_warning(&format!(
                "s = {:.0} mm > s_max = {:.0} mm (ACI 318-19 Table 9.7.6.2.2)",
                s, s_max
            ));
        }
        
        result
    }
    
    /// Column design per ACI 318-19 Chapter 22
    pub fn column_capacity(
        b: f64,     // Width (mm)
        h: f64,     // Depth (mm)
        ast: f64,   // Total steel area (mm²)
        fc: f64,    // Concrete strength (MPa)
        fy: f64,    // Steel yield strength (MPa)
        pu: f64,    // Factored axial load (kN)
        mu: f64,    // Factored moment (kN·m)
    ) -> DesignResult {
        let ag = b * h;
        
        // Maximum axial capacity (tied column, ACI 318-19 Eq. 22.4.2.1)
        let phi_pn_max = 0.80 * 0.65 * (0.85 * fc * (ag - ast) + fy * ast) / 1000.0; // kN
        
        // Check pure axial
        let p_ratio = pu / phi_pn_max;
        
        // Approximate interaction (simplified)
        // In practice, would compute full P-M interaction diagram
        let d = h - 60.0; // Approximate effective depth
        let phi_mn = 0.65 * ast / 2.0 * fy * (d - h / 2.0) / 1e6; // kN·m (approximate)
        
        let m_ratio = if phi_mn > 0.0 { mu / phi_mn } else { 0.0 };
        
        // Combined ratio (simplified linear interaction)
        let combined_ratio = p_ratio + m_ratio;
        
        let mut result = DesignResult::new(
            combined_ratio <= 1.0,
            combined_ratio,
            phi_pn_max,
            pu,
            "ACI 318-19 Sec. 22.4"
        );
        
        result = result
            .with_detail("phi_Pn_max", phi_pn_max)
            .with_detail("phi_Mn", phi_mn)
            .with_detail("rho_g", ast / ag);
        
        // Check reinforcement ratio limits (ACI 318-19 Table 10.6.1.1)
        let rho_g = ast / ag;
        if rho_g < 0.01 {
            result = result.with_warning("ρg < 0.01 - Below minimum (ACI 318-19 Table 10.6.1.1)");
        }
        if rho_g > 0.08 {
            result = result.with_warning("ρg > 0.08 - Above maximum (ACI 318-19 Table 10.6.1.1)");
        }
        
        result
    }
}

// ============================================
// EUROCODE 2: CONCRETE DESIGN
// ============================================

pub mod eurocode2 {
    use super::*;
    
    /// Concrete class per EN 1992-1-1
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ConcreteClass {
        pub fck: f64,     // Characteristic cylinder strength (MPa)
        pub fck_cube: f64, // Characteristic cube strength (MPa)
        pub fcm: f64,     // Mean cylinder strength (MPa)
        pub fctm: f64,    // Mean tensile strength (MPa)
        pub ecm: f64,     // Secant modulus (GPa)
    }
    
    impl ConcreteClass {
        /// Create concrete class from characteristic strength
        pub fn new(fck: f64) -> Self {
            let fcm = fck + 8.0;
            Self {
                fck,
                fck_cube: fck * 1.2, // Approximate
                fcm,
                fctm: if fck <= 50.0 {
                    0.30 * fck.powf(2.0 / 3.0)
                } else {
                    2.12 * (1.0 + (fcm / 10.0)).ln()
                },
                ecm: 22.0 * (fcm / 10.0).powf(0.3),
            }
        }
        
        /// Design compressive strength
        pub fn fcd(&self, gamma_c: f64) -> f64 {
            0.85 * self.fck / gamma_c
        }
    }
    
    /// Reinforcing steel per EN 1992-1-1
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ReinforcingSteel {
        pub fyk: f64,     // Characteristic yield strength (MPa)
        pub es: f64,      // Modulus (GPa)
        pub epsilon_uk: f64, // Characteristic strain at max force
    }
    
    impl Default for ReinforcingSteel {
        fn default() -> Self {
            Self {
                fyk: 500.0,    // B500B
                es: 200.0,
                epsilon_uk: 0.05,
            }
        }
    }
    
    impl ReinforcingSteel {
        pub fn fyd(&self, gamma_s: f64) -> f64 {
            self.fyk / gamma_s
        }
    }
    
    /// Rectangular stress block parameters per EC2 3.1.7
    fn stress_block_params(fck: f64) -> (f64, f64) {
        let lambda = if fck <= 50.0 {
            0.8
        } else {
            0.8 - (fck - 50.0) / 400.0
        };
        
        let eta = if fck <= 50.0 {
            1.0
        } else {
            1.0 - (fck - 50.0) / 200.0
        };
        
        (lambda, eta)
    }
    
    /// Flexural design per EN 1992-1-1
    pub fn flexural_capacity(
        b: f64,     // Width (mm)
        d: f64,     // Effective depth (mm)
        as_t: f64,  // Tension reinforcement (mm²)
        fck: f64,   // Concrete strength (MPa)
        fyk: f64,   // Steel yield strength (MPa)
        med: f64,   // Design moment (kN·m)
    ) -> DesignResult {
        // Partial factors (persistent design situation)
        let gamma_c = 1.5;
        let gamma_s = 1.15;
        
        let fcd = 0.85 * fck / gamma_c;
        let fyd = fyk / gamma_s;
        
        // Stress block parameters
        let (lambda, eta) = stress_block_params(fck);
        
        // Neutral axis from equilibrium
        let x = (as_t * fyd) / (eta * fcd * lambda * b);
        
        // Lever arm
        let z = d - lambda * x / 2.0;
        
        // Moment of resistance
        let mrd = as_t * fyd * z / 1e6; // kN·m
        
        let ratio = med / mrd;
        
        let mut result = DesignResult::new(
            ratio <= 1.0,
            ratio,
            mrd,
            med,
            "EN 1992-1-1 Sec. 6.1"
        );
        
        // Limit on x/d (ductility)
        let x_d_ratio = x / d;
        let x_d_limit = if fck <= 50.0 { 0.45 } else { 0.35 };
        
        if x_d_ratio > x_d_limit {
            result = result.with_warning(&format!(
                "x/d = {:.3} > {:.2} - Consider compression reinforcement (EC2 5.6.3)",
                x_d_ratio, x_d_limit
            ));
        }
        
        result = result
            .with_detail("neutral_axis_x", x)
            .with_detail("lever_arm_z", z)
            .with_detail("x_d_ratio", x_d_ratio)
            .with_detail("fcd", fcd)
            .with_detail("fyd", fyd);
        
        // Minimum reinforcement (EC2 9.2.1.1)
        let as_min = (0.26 * (fck.powf(2.0/3.0) * 0.30) / fyk * b * d).max(0.0013 * b * d);
        if as_t < as_min {
            result = result.with_warning(&format!(
                "As = {:.0} mm² < As,min = {:.0} mm² (EC2 9.2.1.1)",
                as_t, as_min
            ));
        }
        
        result
    }
    
    /// Shear design per EN 1992-1-1 Section 6.2
    pub fn shear_capacity(
        b: f64,     // Width (mm)
        d: f64,     // Effective depth (mm)
        as_t: f64,  // Tension reinforcement (mm²)
        fck: f64,   // Concrete strength (MPa)
        ved: f64,   // Design shear force (kN)
        asw: f64,   // Shear reinforcement area (mm²)
        s: f64,     // Stirrup spacing (mm)
        fywd: f64,  // Design yield strength of stirrups (MPa)
    ) -> DesignResult {
        let gamma_c = 1.5;
        
        // Concrete contribution without shear reinforcement (EC2 6.2.2)
        let rho_l = (as_t / (b * d)).min(0.02);
        let k = (1.0 + (200.0 / d).sqrt()).min(2.0);
        
        let v_rd_c = (0.18 / gamma_c * k * (100.0 * rho_l * fck).powf(1.0/3.0))
            .max(0.035 * k.powf(1.5) * fck.sqrt());
        
        let vrd_c = v_rd_c * b * d / 1000.0; // kN
        
        // Shear reinforcement contribution (EC2 6.2.3)
        let cot_theta = 2.5; // Assuming θ = 21.8° (cot θ = 2.5)
        
        let vrd_s = if s > 0.0 {
            asw / s * 0.9 * d * fywd * cot_theta / 1000.0 // kN
        } else {
            0.0
        };
        
        // Maximum shear (crushing of compression struts)
        let alpha_cw = 1.0; // For non-prestressed
        let nu1 = 0.6 * (1.0 - fck / 250.0);
        let fcd = 0.85 * fck / gamma_c;
        
        let vrd_max = alpha_cw * b * 0.9 * d * nu1 * fcd / (cot_theta + 1.0 / cot_theta) / 1000.0;
        
        // Design resistance
        let vrd = if ved > vrd_c {
            vrd_s.min(vrd_max)
        } else {
            vrd_c
        };
        
        let ratio = ved / vrd;
        
        let mut result = DesignResult::new(
            ratio <= 1.0,
            ratio,
            vrd,
            ved,
            "EN 1992-1-1 Sec. 6.2"
        );
        
        result = result
            .with_detail("VRd_c", vrd_c)
            .with_detail("VRd_s", vrd_s)
            .with_detail("VRd_max", vrd_max)
            .with_detail("k_factor", k)
            .with_detail("rho_l", rho_l);
        
        // Check minimum shear reinforcement (EC2 9.2.2)
        if ved > vrd_c {
            let rho_w_min = 0.08 * fck.sqrt() / fywd;
            let asw_min = rho_w_min * b * s;
            if asw < asw_min {
                result = result.with_warning(&format!(
                    "Asw = {:.0} mm² < Asw,min = {:.0} mm² (EC2 9.2.2)",
                    asw, asw_min
                ));
            }
        }
        
        result
    }
}

// ============================================
// EUROCODE 3: STEEL DESIGN
// ============================================

pub mod eurocode3 {
    use super::*;
    
    /// Steel grade per EN 10025
    #[derive(Debug, Clone, Copy, Serialize, Deserialize)]
    pub enum SteelGrade {
        S235,
        S275,
        S355,
        S420,
        S460,
    }
    
    impl SteelGrade {
        pub fn fy(&self, t: f64) -> f64 {
            // Yield strength varies with thickness
            match self {
                SteelGrade::S235 => if t <= 16.0 { 235.0 } else if t <= 40.0 { 225.0 } else { 215.0 },
                SteelGrade::S275 => if t <= 16.0 { 275.0 } else if t <= 40.0 { 265.0 } else { 255.0 },
                SteelGrade::S355 => if t <= 16.0 { 355.0 } else if t <= 40.0 { 345.0 } else { 335.0 },
                SteelGrade::S420 => if t <= 16.0 { 420.0 } else if t <= 40.0 { 400.0 } else { 390.0 },
                SteelGrade::S460 => if t <= 16.0 { 460.0 } else if t <= 40.0 { 440.0 } else { 430.0 },
            }
        }
        
        pub fn fu(&self, t: f64) -> f64 {
            match self {
                SteelGrade::S235 => if t <= 40.0 { 360.0 } else { 360.0 },
                SteelGrade::S275 => if t <= 40.0 { 430.0 } else { 410.0 },
                SteelGrade::S355 => if t <= 40.0 { 510.0 } else { 470.0 },
                SteelGrade::S420 => if t <= 40.0 { 520.0 } else { 500.0 },
                SteelGrade::S460 => if t <= 40.0 { 540.0 } else { 530.0 },
            }
        }
    }
    
    /// Cross-section class per EC3 Table 5.2
    #[derive(Debug, Clone, Copy, PartialEq)]
    pub enum CrossSectionClass {
        Class1, // Plastic
        Class2, // Compact
        Class3, // Semi-compact
        Class4, // Slender
    }
    
    /// Classify I-section per EC3 Table 5.2
    pub fn classify_i_section(
        b: f64,     // Flange width (mm)
        tf: f64,    // Flange thickness (mm)
        h: f64,     // Total depth (mm)
        tw: f64,    // Web thickness (mm)
        fy: f64,    // Yield strength (MPa)
    ) -> CrossSectionClass {
        let epsilon = (235.0 / fy).sqrt();
        
        // Flange classification (outstand, compression)
        let c_f = (b - tw) / 2.0;
        let flange_ratio = c_f / tf;
        
        let flange_class = if flange_ratio <= 9.0 * epsilon {
            CrossSectionClass::Class1
        } else if flange_ratio <= 10.0 * epsilon {
            CrossSectionClass::Class2
        } else if flange_ratio <= 14.0 * epsilon {
            CrossSectionClass::Class3
        } else {
            CrossSectionClass::Class4
        };
        
        // Web classification (internal, bending)
        let c_w = h - 2.0 * tf;
        let web_ratio = c_w / tw;
        
        let web_class = if web_ratio <= 72.0 * epsilon {
            CrossSectionClass::Class1
        } else if web_ratio <= 83.0 * epsilon {
            CrossSectionClass::Class2
        } else if web_ratio <= 124.0 * epsilon {
            CrossSectionClass::Class3
        } else {
            CrossSectionClass::Class4
        };
        
        // Overall class is the worst of flange and web
        match (flange_class, web_class) {
            (CrossSectionClass::Class4, _) | (_, CrossSectionClass::Class4) => CrossSectionClass::Class4,
            (CrossSectionClass::Class3, _) | (_, CrossSectionClass::Class3) => CrossSectionClass::Class3,
            (CrossSectionClass::Class2, _) | (_, CrossSectionClass::Class2) => CrossSectionClass::Class2,
            _ => CrossSectionClass::Class1,
        }
    }
    
    /// Flexural capacity per EC3 Section 6.2.5
    pub fn moment_resistance(
        wpl: f64,   // Plastic section modulus (mm³)
        wel: f64,   // Elastic section modulus (mm³)
        fy: f64,    // Yield strength (MPa)
        class: CrossSectionClass,
        med: f64,   // Design moment (kN·m)
    ) -> DesignResult {
        let gamma_m0 = 1.0;
        
        let mc_rd = match class {
            CrossSectionClass::Class1 | CrossSectionClass::Class2 => {
                wpl * fy / gamma_m0 / 1e6 // kN·m
            }
            CrossSectionClass::Class3 => {
                wel * fy / gamma_m0 / 1e6 // kN·m
            }
            CrossSectionClass::Class4 => {
                // Would need effective section modulus
                wel * fy / gamma_m0 / 1e6 * 0.9 // Simplified reduction
            }
        };
        
        let ratio = med / mc_rd;
        
        DesignResult::new(
            ratio <= 1.0,
            ratio,
            mc_rd,
            med,
            "EN 1993-1-1 Sec. 6.2.5"
        )
        .with_detail("Wpl", wpl)
        .with_detail("Wel", wel)
        .with_detail("gamma_M0", gamma_m0)
    }
    
    /// Shear capacity per EC3 Section 6.2.6
    pub fn shear_resistance(
        av: f64,    // Shear area (mm²)
        fy: f64,    // Yield strength (MPa)
        ved: f64,   // Design shear (kN)
    ) -> DesignResult {
        let gamma_m0 = 1.0;
        
        // Plastic shear resistance
        let vpl_rd = av * (fy / 3.0_f64.sqrt()) / gamma_m0 / 1000.0; // kN
        
        let ratio = ved / vpl_rd;
        
        DesignResult::new(
            ratio <= 1.0,
            ratio,
            vpl_rd,
            ved,
            "EN 1993-1-1 Sec. 6.2.6"
        )
        .with_detail("Av", av)
    }
    
    /// Axial compression per EC3 Section 6.3.1
    pub fn compression_resistance(
        a: f64,     // Gross area (mm²)
        fy: f64,    // Yield strength (MPa)
        ned: f64,   // Design axial force (kN)
        lcr_y: f64, // Buckling length y-y (mm)
        lcr_z: f64, // Buckling length z-z (mm)
        iy: f64,    // Radius of gyration y-y (mm)
        iz: f64,    // Radius of gyration z-z (mm)
        alpha: f64, // Imperfection factor
    ) -> DesignResult {
        let gamma_m1 = 1.0;
        let e = 210000.0; // MPa
        
        // Slenderness ratios
        let lambda_y = lcr_y / iy;
        let lambda_z = lcr_z / iz;
        
        // Non-dimensional slenderness
        let lambda_1 = PI * (e / fy).sqrt();
        let lambda_bar_y = lambda_y / lambda_1;
        let lambda_bar_z = lambda_z / lambda_1;
        
        // Reduction factor (EC3 6.3.1.2)
        let phi_y = 0.5 * (1.0 + alpha * (lambda_bar_y - 0.2) + lambda_bar_y.powi(2));
        let chi_y = 1.0 / (phi_y + (phi_y.powi(2) - lambda_bar_y.powi(2)).sqrt());
        let chi_y = chi_y.min(1.0);
        
        let phi_z = 0.5 * (1.0 + alpha * (lambda_bar_z - 0.2) + lambda_bar_z.powi(2));
        let chi_z = 1.0 / (phi_z + (phi_z.powi(2) - lambda_bar_z.powi(2)).sqrt());
        let chi_z = chi_z.min(1.0);
        
        let chi = chi_y.min(chi_z);
        
        // Design buckling resistance
        let nb_rd = chi * a * fy / gamma_m1 / 1000.0; // kN
        
        let ratio = ned / nb_rd;
        
        DesignResult::new(
            ratio <= 1.0,
            ratio,
            nb_rd,
            ned,
            "EN 1993-1-1 Sec. 6.3.1"
        )
        .with_detail("lambda_bar_y", lambda_bar_y)
        .with_detail("lambda_bar_z", lambda_bar_z)
        .with_detail("chi_y", chi_y)
        .with_detail("chi_z", chi_z)
        .with_detail("chi", chi)
    }
    
    /// Combined bending and axial per EC3 Section 6.3.3
    pub fn interaction_check(
        ned: f64,   // Design axial (kN)
        my_ed: f64, // Design moment y-y (kN·m)
        mz_ed: f64, // Design moment z-z (kN·m)
        nb_rd_y: f64, // Buckling resistance y-y (kN)
        nb_rd_z: f64, // Buckling resistance z-z (kN)
        my_rd: f64,   // Moment resistance y-y (kN·m)
        mz_rd: f64,   // Moment resistance z-z (kN·m)
        kyy: f64,     // Interaction factor
        kyz: f64,
        kzy: f64,
        kzz: f64,
    ) -> DesignResult {
        // Equation 6.61
        let ratio_61 = ned / nb_rd_y + kyy * my_ed / my_rd + kyz * mz_ed / mz_rd;
        
        // Equation 6.62
        let ratio_62 = ned / nb_rd_z + kzy * my_ed / my_rd + kzz * mz_ed / mz_rd;
        
        let max_ratio = ratio_61.max(ratio_62);
        
        DesignResult::new(
            max_ratio <= 1.0,
            max_ratio,
            1.0,
            max_ratio,
            "EN 1993-1-1 Sec. 6.3.3"
        )
        .with_detail("ratio_6.61", ratio_61)
        .with_detail("ratio_6.62", ratio_62)
    }
}

// ============================================
// AS 4100: AUSTRALIAN STEEL CODE
// ============================================

pub mod as4100 {
    use super::*;
    
    /// Section capacity factor per AS 4100
    const PHI: f64 = 0.9;
    
    /// Member moment capacity per AS 4100 Section 5
    pub fn member_moment_capacity(
        ms: f64,    // Section moment capacity (kN·m)
        le: f64,    // Effective length (mm)
        i_y: f64,   // Second moment of area about minor axis (mm⁴)
        j: f64,     // Torsion constant (mm⁴)
        iw: f64,    // Warping constant (mm⁶)
        _fy: f64,    // Yield stress (MPa)
        m_star: f64, // Design moment (kN·m)
    ) -> DesignResult {
        let e = 200000.0; // MPa
        let g = 80000.0;  // MPa
        
        // Reference buckling moment (AS 4100 Eq. 5.6.1.1)
        // Mo = sqrt[(π²EIy/Le²)(GJ + π²EIw/Le²)] — units: N·mm → /1e6 → kN·m
        let mo = ((PI.powi(2) * e * i_y / le.powi(2)) * (g * j + (PI.powi(2) * e * iw / le.powi(2)))).sqrt() / 1e6;
        
        // Slenderness reduction factor (0.6 multiplies entire bracket)
        let alpha_s = 0.6 * (((ms / mo).powi(2) + 3.0).sqrt() - ms / mo);
        let alpha_s = alpha_s.min(1.0).max(0.0);
        
        // Member moment capacity
        let mb = alpha_s * ms;
        let phi_mb = PHI * mb;
        
        let ratio = m_star / phi_mb;
        
        DesignResult::new(
            ratio <= 1.0,
            ratio,
            phi_mb,
            m_star,
            "AS 4100 Sec. 5.6"
        )
        .with_detail("Mo", mo)
        .with_detail("alpha_s", alpha_s)
        .with_detail("Ms", ms)
        .with_detail("Mb", mb)
    }
    
    /// Compression member capacity per AS 4100 Section 6
    pub fn compression_capacity(
        ns: f64,    // Section capacity (kN)
        le: f64,    // Effective length (mm)
        r: f64,     // Radius of gyration (mm)
        fy: f64,    // Yield stress (MPa)
        alpha_b: f64, // Member section constant
        n_star: f64,  // Design axial force (kN)
    ) -> DesignResult {
        let _e = 200000.0;
        
        // Modified slenderness
        let lambda_n = le / r * (fy / 250.0).sqrt();
        
        // Slenderness reduction factor (AS 4100 Eq. 6.3.3)
        let lambda_a = alpha_b * (90.0 - lambda_n) / 90.0;
        let xi = (lambda_n / 90.0).powi(2) + 1.0 + 2.0 * lambda_a;
        let alpha_c = xi / (2.0 * (lambda_n / 90.0).powi(2)) * 
            (1.0 - (1.0 - 4.0 * (lambda_n / 90.0).powi(2) / xi.powi(2)).sqrt());
        let alpha_c = alpha_c.min(1.0).max(0.0);
        
        // Member compression capacity
        let nc = alpha_c * ns;
        let phi_nc = PHI * nc;
        
        let ratio = n_star / phi_nc;
        
        DesignResult::new(
            ratio <= 1.0,
            ratio,
            phi_nc,
            n_star,
            "AS 4100 Sec. 6.3"
        )
        .with_detail("lambda_n", lambda_n)
        .with_detail("alpha_c", alpha_c)
        .with_detail("Ns", ns)
        .with_detail("Nc", nc)
    }
}

// ============================================
// CSA S16: CANADIAN STEEL CODE
// ============================================

pub mod csa_s16 {
    use super::*;
    
    /// Resistance factor for steel
    const PHI: f64 = 0.9;
    
    /// Cross-section compressive resistance per CSA S16 Cl. 13.3
    pub fn compressive_resistance(
        a: f64,     // Gross area (mm²)
        fy: f64,    // Yield strength (MPa)
        kl: f64,    // Effective length (mm)
        r: f64,     // Radius of gyration (mm)
        n: f64,     // Column buckling curve (1.34 for hot-rolled)
        cf: f64,    // Design compression (kN)
    ) -> DesignResult {
        let e = 200000.0;
        
        // Euler buckling stress
        let fe = PI.powi(2) * e / (kl / r).powi(2);
        
        // Slenderness parameter
        let lambda = (fy / fe).sqrt();
        
        // Compressive resistance
        let cr = PHI * a * fy * (1.0 + lambda.powf(2.0 * n)).powf(-1.0 / n) / 1000.0; // kN
        
        let ratio = cf / cr;
        
        DesignResult::new(
            ratio <= 1.0,
            ratio,
            cr,
            cf,
            "CSA S16 Cl. 13.3"
        )
        .with_detail("Fe", fe)
        .with_detail("lambda", lambda)
        .with_detail("n", n)
    }
    
    /// Flexural resistance per CSA S16 Cl. 13.5
    pub fn flexural_resistance(
        zx: f64,    // Plastic section modulus (mm³)
        _sx: f64,    // Elastic section modulus (mm³)
        fy: f64,    // Yield strength (MPa)
        _lu: f64,    // Unbraced length (mm)
        _mp: f64,    // Plastic moment capacity (kN·m)
        mr: f64,    // Critical elastic moment (kN·m)
        mf: f64,    // Factored moment (kN·m)
    ) -> DesignResult {
        // Plastic moment
        let mp_calc = PHI * zx * fy / 1e6; // kN·m
        
        // Determine governing capacity
        let omega2 = 1.0; // Conservative; depends on moment gradient
        
        let mu = if mr >= 0.67 * mp_calc {
            // Inelastic LTB
            1.15 * PHI * mp_calc * (1.0 - 0.28 * mp_calc / (omega2 * mr))
        } else {
            // Elastic LTB
            PHI * omega2 * mr
        };
        
        let mr_final = mu.min(PHI * mp_calc);
        
        let ratio = mf / mr_final;
        
        DesignResult::new(
            ratio <= 1.0,
            ratio,
            mr_final,
            mf,
            "CSA S16 Cl. 13.5"
        )
        .with_detail("Mp", mp_calc)
        .with_detail("Mu", mu)
        .with_detail("omega2", omega2)
    }
    
    /// Combined axial and bending per CSA S16 Cl. 13.8
    pub fn interaction_check(
        cf: f64,    // Factored axial compression (kN)
        cr: f64,    // Compressive resistance (kN)
        mfx: f64,   // Factored moment x-x (kN·m)
        mrx: f64,   // Moment resistance x-x (kN·m)
        mfy: f64,   // Factored moment y-y (kN·m)
        mry: f64,   // Moment resistance y-y (kN·m)
        u1x: f64,   // Factor accounting for P-δ
        u1y: f64,
    ) -> DesignResult {
        // Interaction equation (CSA S16 Eq. 13.8.2)
        let ratio = cf / cr + 0.85 * u1x * mfx / mrx + u1y * mfy / mry;
        
        DesignResult::new(
            ratio <= 1.0,
            ratio,
            1.0,
            ratio,
            "CSA S16 Cl. 13.8.2"
        )
        .with_detail("Cf/Cr", cf / cr)
        .with_detail("Mfx/Mrx", mfx / mrx)
        .with_detail("Mfy/Mry", mfy / mry)
    }
}

// ============================================
// UNIFIED CODE CHECKER
// ============================================

/// Enumeration of supported design codes
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum DesignCode {
    ACI318,
    Eurocode2,
    Eurocode3,
    AS4100,
    CSAS16,
    IS456,
    IS800,
}

/// Unified design checker that routes to appropriate code
pub struct UnifiedCodeChecker {
    pub code: DesignCode,
}

impl UnifiedCodeChecker {
    pub fn new(code: DesignCode) -> Self {
        Self { code }
    }
    
    pub fn check_beam_flexure(
        &self,
        b: f64,
        d: f64,
        as_t: f64,
        fc: f64,
        fy: f64,
        m_design: f64,
    ) -> DesignResult {
        match self.code {
            DesignCode::ACI318 => {
                let section = aci318::BeamSection {
                    b, h: d + 50.0, d, d_prime: 50.0,
                    as_tension: as_t, as_compression: 0.0,
                };
                let concrete = aci318::ConcreteMaterial::new(fc);
                let rebar = aci318::RebarMaterial { fy, fu: fy * 1.5, es: 200000.0 };
                aci318::flexural_strength(&section, &concrete, &rebar, m_design)
            }
            DesignCode::Eurocode2 => {
                eurocode2::flexural_capacity(b, d, as_t, fc, fy, m_design)
            }
            _ => DesignResult::new(false, 0.0, 0.0, m_design, "Code not applicable for concrete")
        }
    }
    
    pub fn check_column_compression(
        &self,
        a: f64,
        fy: f64,
        le: f64,
        r: f64,
        n_design: f64,
    ) -> DesignResult {
        match self.code {
            DesignCode::Eurocode3 => {
                eurocode3::compression_resistance(a, fy, n_design, le, le, r, r, 0.34)
            }
            DesignCode::AS4100 => {
                let ns = a * fy / 1000.0 * 0.9; // Approximate section capacity
                as4100::compression_capacity(ns, le, r, fy, 0.5, n_design)
            }
            DesignCode::CSAS16 => {
                csa_s16::compressive_resistance(a, fy, le, r, 1.34, n_design)
            }
            _ => DesignResult::new(false, 0.0, 0.0, n_design, "Code not applicable for steel compression")
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_aci318_flexure() {
        let section = aci318::BeamSection {
            b: 300.0,
            h: 500.0,
            d: 450.0,
            d_prime: 50.0,
            as_tension: 1500.0, // 3-#25 bars
            as_compression: 0.0,
        };
        let concrete = aci318::ConcreteMaterial::new(28.0);
        let rebar = aci318::RebarMaterial::default();
        
        let result = aci318::flexural_strength(&section, &concrete, &rebar, 150.0);
        
        assert!(result.passed);
        assert!(result.utilization_ratio < 1.0);
        println!("ACI 318 Flexure: {:?}", result);
    }
    
    #[test]
    fn test_eurocode2_flexure() {
        let result = eurocode2::flexural_capacity(
            300.0,  // b
            450.0,  // d
            1500.0, // As
            30.0,   // fck
            500.0,  // fyk
            200.0,  // MEd
        );
        
        assert!(result.passed);
        println!("EC2 Flexure: {:?}", result);
    }
    
    #[test]
    fn test_eurocode3_compression() {
        let result = eurocode3::compression_resistance(
            10000.0, // A (mm²)
            355.0,   // fy
            500.0,   // NEd (kN)
            4000.0,  // Lcr_y
            4000.0,  // Lcr_z
            80.0,    // iy
            45.0,    // iz
            0.34,    // alpha (curve b)
        );
        
        println!("EC3 Compression: {:?}", result);
    }
    
    #[test]
    fn test_section_classification() {
        let class = eurocode3::classify_i_section(
            200.0,  // b
            12.0,   // tf
            400.0,  // h
            8.0,    // tw
            355.0,  // fy
        );
        
        println!("Section class: {:?}", class);
    }
}
