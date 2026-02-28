// ============================================================================
// ALUMINUM STRUCTURAL DESIGN MODULE
// Aluminum Design Manual (ADM) 2020 & Eurocode 9 Design
// ============================================================================

#![allow(non_camel_case_types)]  // Industry-standard alloy designations like 6061_T6

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// ALUMINUM ALLOYS AND TEMPERS
// ============================================================================

/// Aluminum alloy series
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AluminumAlloy {
    // 5xxx Series (Magnesium)
    _5052_H32,
    _5083_H116,
    _5086_H116,
    _5454_H32,
    // 6xxx Series (Magnesium-Silicon)
    _6005A_T61,
    _6061_T6,
    _6063_T5,
    _6063_T6,
    _6082_T6,
    _6351_T5,
    // 7xxx Series (Zinc)
    _7005_T53,
    _7075_T6,
}

impl AluminumAlloy {
    /// Mechanical properties
    pub fn properties(&self) -> AluminumProperties {
        match self {
            AluminumAlloy::_6061_T6 => AluminumProperties {
                ftu: 42.0,        // Tensile ultimate (ksi)
                fty: 35.0,        // Tensile yield (ksi)
                fcy: 35.0,        // Compressive yield (ksi)
                fsu: 27.0,        // Shear ultimate (ksi)
                fsy: 20.0,        // Shear yield (ksi)
                e: 10100.0,       // Modulus of elasticity (ksi)
                g: 3800.0,        // Shear modulus (ksi)
                density: 0.098,   // lb/in³
                alpha: 13.0e-6,   // Thermal expansion (/°F)
            },
            AluminumAlloy::_6063_T6 => AluminumProperties {
                ftu: 30.0,
                fty: 25.0,
                fcy: 25.0,
                fsu: 19.0,
                fsy: 14.0,
                e: 10100.0,
                g: 3800.0,
                density: 0.098,
                alpha: 13.0e-6,
            },
            AluminumAlloy::_6082_T6 => AluminumProperties {
                ftu: 45.0,
                fty: 38.0,
                fcy: 38.0,
                fsu: 29.0,
                fsy: 22.0,
                e: 10100.0,
                g: 3800.0,
                density: 0.098,
                alpha: 13.0e-6,
            },
            AluminumAlloy::_5052_H32 => AluminumProperties {
                ftu: 33.0,
                fty: 28.0,
                fcy: 28.0,
                fsu: 20.0,
                fsy: 16.0,
                e: 10200.0,
                g: 3800.0,
                density: 0.097,
                alpha: 13.3e-6,
            },
            AluminumAlloy::_7075_T6 => AluminumProperties {
                ftu: 83.0,
                fty: 73.0,
                fcy: 73.0,
                fsu: 48.0,
                fsy: 42.0,
                e: 10400.0,
                g: 3900.0,
                density: 0.101,
                alpha: 13.1e-6,
            },
            _ => AluminumProperties {
                ftu: 38.0,
                fty: 32.0,
                fcy: 32.0,
                fsu: 24.0,
                fsy: 18.0,
                e: 10100.0,
                g: 3800.0,
                density: 0.098,
                alpha: 13.0e-6,
            },
        }
    }
    
    /// Buckling constants (ADM Table B.4.1)
    pub fn buckling_constants(&self) -> BucklingConstants {
        let props = self.properties();
        let bp = (props.fcy / 10.0_f64).sqrt() * 5.0;
        
        BucklingConstants {
            bc: props.fcy * (1.0 + props.fcy / 2250.0),
            dc: bp / 10.0,
            cc: 0.41 * bp,
            bt: props.fty * (1.0 + props.fty / 2250.0),
            dt: bp / 10.0,
            ct: 0.41 * bp,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct AluminumProperties {
    pub ftu: f64,     // Tensile ultimate strength (ksi)
    pub fty: f64,     // Tensile yield strength (ksi)
    pub fcy: f64,     // Compressive yield strength (ksi)
    pub fsu: f64,     // Shear ultimate strength (ksi)
    pub fsy: f64,     // Shear yield strength (ksi)
    pub e: f64,       // Modulus of elasticity (ksi)
    pub g: f64,       // Shear modulus (ksi)
    pub density: f64, // Density (lb/in³)
    pub alpha: f64,   // Coefficient of thermal expansion (/°F)
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct BucklingConstants {
    pub bc: f64,  // Compressive intercept
    pub dc: f64,  // Compressive slope
    pub cc: f64,  // Compressive slenderness limit
    pub bt: f64,  // Tensile intercept
    pub dt: f64,  // Tensile slope
    pub ct: f64,  // Tensile slenderness limit
}

// ============================================================================
// SECTION TYPES
// ============================================================================

/// Aluminum section types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AluminumSection {
    /// I-beam section
    IBeam {
        bf: f64,  // Flange width
        tf: f64,  // Flange thickness
        d: f64,   // Depth
        tw: f64,  // Web thickness
    },
    /// Channel section
    Channel {
        bf: f64,
        tf: f64,
        d: f64,
        tw: f64,
    },
    /// Rectangular tube
    RectTube {
        b: f64,   // Width
        h: f64,   // Height
        t: f64,   // Wall thickness
    },
    /// Round tube
    RoundTube {
        d: f64,   // Outer diameter
        t: f64,   // Wall thickness
    },
    /// Angle
    Angle {
        l1: f64,  // Leg 1 length
        l2: f64,  // Leg 2 length
        t: f64,   // Thickness
    },
    /// Tee section
    Tee {
        bf: f64,
        tf: f64,
        d: f64,
        tw: f64,
    },
    /// Custom section
    Custom {
        area: f64,
        ix: f64,
        iy: f64,
        sx: f64,
        sy: f64,
        rx: f64,
        ry: f64,
        j: f64,
        cw: f64,
    },
}

impl AluminumSection {
    /// Cross-sectional area (in²)
    pub fn area(&self) -> f64 {
        match self {
            AluminumSection::IBeam { bf, tf, d, tw } => {
                2.0 * bf * tf + (d - 2.0 * tf) * tw
            }
            AluminumSection::Channel { bf, tf, d, tw } => {
                2.0 * bf * tf + (d - 2.0 * tf) * tw
            }
            AluminumSection::RectTube { b, h, t } => {
                2.0 * t * (b + h - 2.0 * t)
            }
            AluminumSection::RoundTube { d, t } => {
                PI * (d - t) * t
            }
            AluminumSection::Angle { l1, l2, t } => {
                t * (l1 + l2 - t)
            }
            AluminumSection::Tee { bf, tf, d, tw } => {
                bf * tf + (d - tf) * tw
            }
            AluminumSection::Custom { area, .. } => *area,
        }
    }
    
    /// Moment of inertia about strong axis (in⁴)
    pub fn ix(&self) -> f64 {
        match self {
            AluminumSection::IBeam { bf, tf, d, tw } => {
                let h = d - 2.0 * tf;
                (bf * d.powi(3) - (bf - tw) * h.powi(3)) / 12.0
            }
            AluminumSection::RectTube { b, h, t } => {
                (b * h.powi(3) - (b - 2.0 * t) * (h - 2.0 * t).powi(3)) / 12.0
            }
            AluminumSection::RoundTube { d, t } => {
                let d_o = *d;
                let d_i = d - 2.0 * t;
                PI / 64.0 * (d_o.powi(4) - d_i.powi(4))
            }
            AluminumSection::Custom { ix, .. } => *ix,
            _ => self.area() * 10.0, // Simplified
        }
    }
    
    /// Section modulus about strong axis (in³)
    pub fn sx(&self) -> f64 {
        match self {
            AluminumSection::IBeam { d, .. } => self.ix() / (d / 2.0),
            AluminumSection::RectTube { h, .. } => self.ix() / (h / 2.0),
            AluminumSection::RoundTube { d, .. } => self.ix() / (d / 2.0),
            AluminumSection::Custom { sx, .. } => *sx,
            _ => self.ix() / 5.0,
        }
    }
    
    /// Radius of gyration about strong axis (in)
    pub fn rx(&self) -> f64 {
        (self.ix() / self.area()).sqrt()
    }
    
    /// Radius of gyration about weak axis (in)
    pub fn ry(&self) -> f64 {
        match self {
            AluminumSection::IBeam { bf, tf, d, tw } => {
                let iy = (2.0 * tf * bf.powi(3) + (d - 2.0 * tf) * tw.powi(3)) / 12.0;
                (iy / self.area()).sqrt()
            }
            AluminumSection::RectTube { b, h, t } => {
                let iy = (h * b.powi(3) - (h - 2.0 * t) * (b - 2.0 * t).powi(3)) / 12.0;
                (iy / self.area()).sqrt()
            }
            AluminumSection::RoundTube { .. } => self.rx(), // Equal for round
            AluminumSection::Custom { ry, .. } => *ry,
            _ => self.rx() * 0.5,
        }
    }
    
    /// Torsional constant J (in⁴)
    pub fn j(&self) -> f64 {
        match self {
            AluminumSection::RectTube { b, h, t } => {
                // Bredt-Batho: J = 4A²t/s = 2t(b-t)²(h-t)² / (b+h-2t)
                2.0 * t * (b - t).powi(2) * (h - t).powi(2) / 
                    (b + h - 2.0 * t)
            }
            AluminumSection::RoundTube { d, t } => {
                let d_o = *d;
                let d_i = d - 2.0 * t;
                PI / 32.0 * (d_o.powi(4) - d_i.powi(4))
            }
            AluminumSection::IBeam { bf, tf, d, tw } => {
                (2.0 * bf * tf.powi(3) + (d - 2.0 * tf) * tw.powi(3)) / 3.0
            }
            AluminumSection::Custom { j, .. } => *j,
            _ => 0.1,
        }
    }
    
    /// Element slenderness (b/t ratio)
    pub fn element_slenderness(&self) -> f64 {
        match self {
            AluminumSection::IBeam { bf, tf, .. } => (bf / 2.0) / tf,
            AluminumSection::RectTube { b, t, .. } => (b - 2.0 * t) / t,
            AluminumSection::RoundTube { d, t } => d / t,
            AluminumSection::Angle { l1, t, .. } => l1 / t,
            _ => 10.0,
        }
    }
}

// ============================================================================
// ADM 2020 DESIGNER
// ============================================================================

/// Safety factors per ADM
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AdmDesignBasis {
    Building,   // Building structures (Ω = 1.65)
    Bridge,     // Bridge structures (Ω = 1.95)
}

impl AdmDesignBasis {
    pub fn omega_t(&self) -> f64 {
        match self {
            AdmDesignBasis::Building => 1.65,
            AdmDesignBasis::Bridge => 1.95,
        }
    }
    
    pub fn omega_c(&self) -> f64 {
        match self {
            AdmDesignBasis::Building => 1.65,
            AdmDesignBasis::Bridge => 1.95,
        }
    }
    
    pub fn omega_b(&self) -> f64 {
        match self {
            AdmDesignBasis::Building => 1.65,
            AdmDesignBasis::Bridge => 1.95,
        }
    }
    
    pub fn omega_v(&self) -> f64 {
        match self {
            AdmDesignBasis::Building => 1.65,
            AdmDesignBasis::Bridge => 1.95,
        }
    }
}

/// Aluminum Design Manual designer
pub struct AdmDesigner {
    pub alloy: AluminumAlloy,
    pub section: AluminumSection,
    pub design_basis: AdmDesignBasis,
    pub unbraced_length_x: f64,
    pub unbraced_length_y: f64,
    pub effective_length_factor: f64,
}

impl AdmDesigner {
    pub fn new(alloy: AluminumAlloy, section: AluminumSection) -> Self {
        Self {
            alloy,
            section,
            design_basis: AdmDesignBasis::Building,
            unbraced_length_x: 0.0,
            unbraced_length_y: 0.0,
            effective_length_factor: 1.0,
        }
    }
    
    /// Allowable tensile stress (ADM Chapter D)
    pub fn allowable_tension(&self) -> f64 {
        let props = self.alloy.properties();
        let omega = self.design_basis.omega_t();
        
        // Lesser of yield and ultimate
        let ft_y = props.fty / omega;
        let ft_u = props.ftu / (omega * 1.1); // kt = 1.1 for unwelded
        
        ft_y.min(ft_u)
    }
    
    /// Allowable compressive stress (ADM Chapter E)
    pub fn allowable_compression(&self) -> CompressionCapacity {
        let props = self.alloy.properties();
        let omega = self.design_basis.omega_c();
        
        // Member slenderness
        let kl_r_x = self.effective_length_factor * self.unbraced_length_x / self.section.rx();
        let kl_r_y = self.effective_length_factor * self.unbraced_length_y / self.section.ry();
        let kl_r = kl_r_x.max(kl_r_y);
        
        // Buckling constants
        let consts = self.alloy.buckling_constants();
        
        // Euler buckling stress
        let fe = PI.powi(2) * props.e / kl_r.powi(2);
        
        // Critical stress
        let fc = if kl_r <= consts.cc {
            // Inelastic buckling
            consts.bc - consts.dc * kl_r
        } else {
            // Elastic buckling
            fe
        };
        
        let fc_allowable = (fc / omega).min(props.fcy / omega);
        
        CompressionCapacity {
            fc_allowable,
            slenderness: kl_r,
            fe,
            buckling_mode: if kl_r <= consts.cc { "Inelastic" } else { "Elastic" }.to_string(),
        }
    }
    
    /// Allowable bending stress (ADM Chapter F)
    pub fn allowable_bending(&self) -> BendingCapacity {
        let props = self.alloy.properties();
        let omega = self.design_basis.omega_b();
        
        // Lateral-torsional buckling
        let lb = self.unbraced_length_y;
        let ry = self.section.ry();
        let slenderness_ltb = lb / ry;
        
        // Yielding
        let fb_y = props.fty / omega;
        
        // LTB stress (simplified)
        let cb = 1.0; // Conservative
        let j = self.section.j();
        let sx = self.section.sx();
        let area = self.section.area();
        
        let me = cb * PI.powi(2) * props.e * area * ry.powi(2) / lb.powi(2) *
                 (1.0 + 0.078 * j * lb.powi(2) / (area * ry.powi(2))).sqrt();
        
        let fb_ltb = (me / sx) / omega;
        
        // Local buckling
        let b_t = self.section.element_slenderness();
        let consts = self.alloy.buckling_constants();
        
        let fb_local = if b_t <= consts.cc / 2.0 {
            props.fty / omega
        } else {
            (consts.bt - consts.dt * b_t) / omega
        };
        
        let fb_allowable = fb_y.min(fb_ltb).min(fb_local);
        
        BendingCapacity {
            fb_allowable,
            fb_yield: fb_y,
            fb_ltb,
            fb_local,
            slenderness_ltb,
            controlling: if fb_allowable == fb_y { 
                "Yielding" 
            } else if fb_allowable == fb_ltb { 
                "LTB" 
            } else { 
                "Local" 
            }.to_string(),
        }
    }
    
    /// Allowable shear stress (ADM Chapter G)
    pub fn allowable_shear(&self) -> f64 {
        let props = self.alloy.properties();
        let omega = self.design_basis.omega_v();
        
        // Shear yielding
        let fv_y = props.fsy / omega;
        
        // Shear buckling (web)
        let fv_buck = props.fsu / omega;
        
        fv_y.min(fv_buck)
    }
    
    /// Check tension member (ADM D.1)
    pub fn check_tension(&self, p: f64) -> TensionCheckResult {
        let ft_allowable = self.allowable_tension();
        let ft_actual = p / self.section.area();
        let ratio = ft_actual / ft_allowable;
        
        TensionCheckResult {
            ft_actual,
            ft_allowable,
            ratio,
            pass: ratio <= 1.0,
        }
    }
    
    /// Check compression member (ADM E.1)
    pub fn check_compression(&self, p: f64) -> AxialCheckResult {
        let capacity = self.allowable_compression();
        let fc_actual = p / self.section.area();
        let ratio = fc_actual / capacity.fc_allowable;
        
        AxialCheckResult {
            fc_actual,
            fc_allowable: capacity.fc_allowable,
            slenderness: capacity.slenderness,
            ratio,
            pass: ratio <= 1.0,
        }
    }
    
    /// Check flexural member (ADM F.1)
    pub fn check_bending(&self, m: f64) -> FlexuralCheckResult {
        let capacity = self.allowable_bending();
        let fb_actual = m / self.section.sx();
        let ratio = fb_actual / capacity.fb_allowable;
        
        FlexuralCheckResult {
            fb_actual,
            fb_allowable: capacity.fb_allowable,
            controlling: capacity.controlling,
            ratio,
            pass: ratio <= 1.0,
        }
    }
    
    /// Check shear (ADM G.1)
    pub fn check_shear(&self, v: f64) -> ShearCheckResult {
        let fv_allowable = self.allowable_shear();
        
        // Approximate shear area
        let av = match &self.section {
            AluminumSection::IBeam { d, tw, tf, .. } => (d - 2.0 * tf) * tw,
            AluminumSection::RectTube { h, t, .. } => 2.0 * h * t,
            _ => self.section.area() * 0.5,
        };
        
        let fv_actual = v / av;
        let ratio = fv_actual / fv_allowable;
        
        ShearCheckResult {
            fv_actual,
            fv_allowable,
            ratio,
            pass: ratio <= 1.0,
        }
    }
    
    /// Combined axial and bending (ADM H.1)
    pub fn check_combined(
        &self, 
        p: f64, 
        mx: f64, 
        is_compression: bool
    ) -> CombinedCheckResult {
        let fb_actual = mx / self.section.sx();
        
        let (fa_actual, fa_allowable, interaction) = if is_compression {
            let axial = self.check_compression(p);
            let bending = self.check_bending(mx);
            
            // ADM H.1-1 interaction equation
            let cmx = 0.85; // Conservative
            let fe = PI.powi(2) * self.alloy.properties().e / 
                     (self.effective_length_factor * self.unbraced_length_x / self.section.rx()).powi(2);
            
            let int = axial.ratio + cmx * bending.ratio / (1.0 - axial.fc_actual / fe);
            
            (axial.fc_actual, axial.fc_allowable, int)
        } else {
            let axial = self.check_tension(p);
            let bending = self.check_bending(mx);
            
            // ADM H.2-1
            let int = axial.ratio + bending.ratio;
            
            (axial.ft_actual, axial.ft_allowable, int)
        };
        
        CombinedCheckResult {
            fa_actual,
            fa_allowable,
            fb_actual,
            fb_allowable: self.allowable_bending().fb_allowable,
            interaction_ratio: interaction,
            pass: interaction <= 1.0,
        }
    }
}

// ============================================================================
// RESULT STRUCTURES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompressionCapacity {
    pub fc_allowable: f64,
    pub slenderness: f64,
    pub fe: f64,
    pub buckling_mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BendingCapacity {
    pub fb_allowable: f64,
    pub fb_yield: f64,
    pub fb_ltb: f64,
    pub fb_local: f64,
    pub slenderness_ltb: f64,
    pub controlling: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TensionCheckResult {
    pub ft_actual: f64,
    pub ft_allowable: f64,
    pub ratio: f64,
    pub pass: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AxialCheckResult {
    pub fc_actual: f64,
    pub fc_allowable: f64,
    pub slenderness: f64,
    pub ratio: f64,
    pub pass: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlexuralCheckResult {
    pub fb_actual: f64,
    pub fb_allowable: f64,
    pub controlling: String,
    pub ratio: f64,
    pub pass: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShearCheckResult {
    pub fv_actual: f64,
    pub fv_allowable: f64,
    pub ratio: f64,
    pub pass: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CombinedCheckResult {
    pub fa_actual: f64,
    pub fa_allowable: f64,
    pub fb_actual: f64,
    pub fb_allowable: f64,
    pub interaction_ratio: f64,
    pub pass: bool,
}

// ============================================================================
// EUROCODE 9 (EN 1999)
// ============================================================================

/// Eurocode 9 aluminum material
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Ec9Alloy {
    EN_AW_6082_T6,
    EN_AW_6061_T6,
    EN_AW_6063_T6,
    EN_AW_5083_H111,
    EN_AW_5754_H22,
}

impl Ec9Alloy {
    /// Characteristic strengths (N/mm²)
    pub fn strengths(&self) -> Ec9Strengths {
        match self {
            Ec9Alloy::EN_AW_6082_T6 => Ec9Strengths {
                f_0: 250.0,      // 0.2% proof stress
                f_u: 290.0,      // Ultimate tensile
                f_ow: 160.0,     // 0.2% proof in HAZ
                f_uw: 185.0,     // Ultimate in HAZ
            },
            Ec9Alloy::EN_AW_6061_T6 => Ec9Strengths {
                f_0: 240.0,
                f_u: 260.0,
                f_ow: 115.0,
                f_uw: 165.0,
            },
            Ec9Alloy::EN_AW_6063_T6 => Ec9Strengths {
                f_0: 160.0,
                f_u: 195.0,
                f_ow: 65.0,
                f_uw: 130.0,
            },
            Ec9Alloy::EN_AW_5083_H111 => Ec9Strengths {
                f_0: 125.0,
                f_u: 275.0,
                f_ow: 125.0,
                f_uw: 275.0,
            },
            Ec9Alloy::EN_AW_5754_H22 => Ec9Strengths {
                f_0: 130.0,
                f_u: 220.0,
                f_ow: 80.0,
                f_uw: 190.0,
            },
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Ec9Strengths {
    pub f_0: f64,    // 0.2% proof stress (N/mm²)
    pub f_u: f64,    // Ultimate tensile strength (N/mm²)
    pub f_ow: f64,   // 0.2% proof in HAZ (N/mm²)
    pub f_uw: f64,   // Ultimate in HAZ (N/mm²)
}

/// Eurocode 9 partial safety factors
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Ec9GammaFactors {
    pub gamma_m1: f64,  // Resistance of members (1.10)
    pub gamma_m2: f64,  // Resistance of net section (1.25)
}

impl Default for Ec9GammaFactors {
    fn default() -> Self {
        Self {
            gamma_m1: 1.10,
            gamma_m2: 1.25,
        }
    }
}

// ============================================================================
// WELDED CONNECTION DESIGN
// ============================================================================

/// Fillet weld design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilletWeld {
    pub leg_size: f64,        // Leg size (in or mm)
    pub length: f64,          // Effective length
    pub electrode: WeldElectrode,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum WeldElectrode {
    ER4043,  // Low strength
    ER5356,  // Medium strength
    ER5556,  // High strength
}

impl WeldElectrode {
    pub fn filler_strength(&self) -> f64 {
        match self {
            WeldElectrode::ER4043 => 14.5,   // ksi
            WeldElectrode::ER5356 => 26.0,
            WeldElectrode::ER5556 => 28.0,
        }
    }
}

impl FilletWeld {
    /// Effective throat (in or mm)
    pub fn throat(&self) -> f64 {
        0.707 * self.leg_size
    }
    
    /// Allowable load per unit length (kip/in or kN/mm)
    pub fn allowable_load_per_length(&self, omega: f64) -> f64 {
        let fuw = self.electrode.filler_strength();
        let throat = self.throat();
        0.6 * fuw * throat / omega
    }
    
    /// Total allowable load (kip or kN)
    pub fn allowable_load(&self, omega: f64) -> f64 {
        self.allowable_load_per_length(omega) * self.length
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_alloy_properties() {
        let props = AluminumAlloy::_6061_T6.properties();
        assert_eq!(props.fty, 35.0);
        assert_eq!(props.e, 10100.0);
    }

    #[test]
    fn test_section_area() {
        let section = AluminumSection::RectTube { b: 6.0, h: 4.0, t: 0.25 };
        let area = section.area();
        // Area = 2 * t * (b + h - 2*t) = 2 * 0.25 * (6 + 4 - 0.5) = 4.75
        assert!((area - 4.75).abs() < 0.1);
    }

    #[test]
    fn test_round_tube() {
        let section = AluminumSection::RoundTube { d: 4.0, t: 0.25 };
        let area = section.area();
        assert!(area > 0.0);
        assert!(section.rx() > 0.0);
    }

    #[test]
    fn test_allowable_tension() {
        let section = AluminumSection::RectTube { b: 4.0, h: 4.0, t: 0.25 };
        let designer = AdmDesigner::new(AluminumAlloy::_6061_T6, section);
        let ft = designer.allowable_tension();
        
        assert!(ft > 20.0 && ft < 25.0); // Should be around 21 ksi
    }

    #[test]
    fn test_compression_check() {
        let section = AluminumSection::RoundTube { d: 4.0, t: 0.25 };
        let mut designer = AdmDesigner::new(AluminumAlloy::_6061_T6, section);
        designer.unbraced_length_x = 120.0;
        designer.unbraced_length_y = 120.0;
        
        let result = designer.check_compression(10.0);
        assert!(result.fc_actual > 0.0);
        assert!(result.slenderness > 0.0);
    }

    #[test]
    fn test_bending_check() {
        let section = AluminumSection::IBeam { bf: 6.0, tf: 0.5, d: 8.0, tw: 0.375 };
        let mut designer = AdmDesigner::new(AluminumAlloy::_6061_T6, section);
        designer.unbraced_length_y = 60.0;
        
        let result = designer.check_bending(100.0); // 100 kip-in
        assert!(result.fb_actual > 0.0);
        assert!(result.fb_allowable > 0.0);
    }

    #[test]
    fn test_shear_check() {
        let section = AluminumSection::IBeam { bf: 6.0, tf: 0.5, d: 8.0, tw: 0.375 };
        let designer = AdmDesigner::new(AluminumAlloy::_6061_T6, section);
        
        let result = designer.check_shear(5.0);
        assert!(result.fv_actual > 0.0);
        assert!(result.fv_allowable > 0.0);
    }

    #[test]
    fn test_combined_check() {
        let section = AluminumSection::RectTube { b: 4.0, h: 6.0, t: 0.375 };
        let mut designer = AdmDesigner::new(AluminumAlloy::_6082_T6, section);
        designer.unbraced_length_x = 96.0;
        designer.unbraced_length_y = 96.0;
        
        let result = designer.check_combined(5.0, 50.0, true);
        assert!(result.interaction_ratio > 0.0);
    }

    #[test]
    fn test_eurocode_alloy() {
        let strengths = Ec9Alloy::EN_AW_6082_T6.strengths();
        assert_eq!(strengths.f_0, 250.0);
        assert_eq!(strengths.f_u, 290.0);
    }

    #[test]
    fn test_fillet_weld() {
        let weld = FilletWeld {
            leg_size: 0.25,
            length: 6.0,
            electrode: WeldElectrode::ER5356,
        };
        
        assert!((weld.throat() - 0.177).abs() < 0.01);
        assert!(weld.allowable_load(1.65) > 0.0);
    }

    #[test]
    fn test_design_basis() {
        assert_eq!(AdmDesignBasis::Building.omega_t(), 1.65);
        assert_eq!(AdmDesignBasis::Bridge.omega_t(), 1.95);
    }

    #[test]
    fn test_tension_check() {
        let section = AluminumSection::RoundTube { d: 3.0, t: 0.25 };
        let designer = AdmDesigner::new(AluminumAlloy::_6063_T6, section);
        
        let result = designer.check_tension(10.0);
        assert!(result.ft_actual > 0.0);
        assert!(result.ratio > 0.0);
    }

    #[test]
    fn test_custom_section() {
        let section = AluminumSection::Custom {
            area: 5.0,
            ix: 20.0,
            iy: 10.0,
            sx: 5.0,
            sy: 3.0,
            rx: 2.0,
            ry: 1.4,
            j: 1.0,
            cw: 10.0,
        };
        
        assert_eq!(section.area(), 5.0);
        assert_eq!(section.ix(), 20.0);
    }
}
