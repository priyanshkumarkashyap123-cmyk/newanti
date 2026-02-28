// ============================================================================
// TIMBER DESIGN MODULE
// NDS (National Design Specification) & Eurocode 5 Timber Design
// ============================================================================

#![allow(non_camel_case_types)]  // Industry-standard wood species names like Hem_Fir

use serde::{Deserialize, Serialize};

// ============================================================================
// TIMBER SPECIES AND GRADES
// ============================================================================

/// Wood species groups (NDS)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum WoodSpecies {
    // Softwoods
    DouglasFirLarch,
    Hem_Fir,
    SouthernPine,
    SprucePineFir,
    // Hardwoods
    RedOak,
    WhiteOak,
    YellowPoplar,
    // Engineered
    Glulam,
    LVL,     // Laminated Veneer Lumber
    PSL,     // Parallel Strand Lumber
    LSL,     // Laminated Strand Lumber
    CLT,     // Cross-Laminated Timber
}

impl WoodSpecies {
    /// Reference design values (psi) - Fb, Ft, Fv, Fc_perp, Fc, E, Emin
    pub fn reference_values(&self) -> TimberReferenceValues {
        match self {
            WoodSpecies::DouglasFirLarch => TimberReferenceValues {
                fb: 1500.0,      // Bending
                ft: 1000.0,      // Tension parallel
                fv: 180.0,       // Shear
                fc_perp: 625.0,  // Compression perpendicular
                fc: 1700.0,      // Compression parallel
                e: 1_900_000.0,  // Modulus of elasticity
                e_min: 690_000.0,
                specific_gravity: 0.50,
            },
            WoodSpecies::SouthernPine => TimberReferenceValues {
                fb: 1650.0,
                ft: 1100.0,
                fv: 175.0,
                fc_perp: 565.0,
                fc: 1800.0,
                e: 1_800_000.0,
                e_min: 660_000.0,
                specific_gravity: 0.55,
            },
            WoodSpecies::SprucePineFir => TimberReferenceValues {
                fb: 1150.0,
                ft: 675.0,
                fv: 135.0,
                fc_perp: 425.0,
                fc: 1150.0,
                e: 1_400_000.0,
                e_min: 510_000.0,
                specific_gravity: 0.42,
            },
            WoodSpecies::Hem_Fir => TimberReferenceValues {
                fb: 1100.0,
                ft: 725.0,
                fv: 150.0,
                fc_perp: 405.0,
                fc: 1300.0,
                e: 1_500_000.0,
                e_min: 550_000.0,
                specific_gravity: 0.43,
            },
            WoodSpecies::Glulam => TimberReferenceValues {
                fb: 2400.0,
                ft: 1650.0,
                fv: 265.0,
                fc_perp: 650.0,
                fc: 1950.0,
                e: 1_800_000.0,
                e_min: 850_000.0,
                specific_gravity: 0.50,
            },
            WoodSpecies::LVL => TimberReferenceValues {
                fb: 2900.0,
                ft: 2025.0,
                fv: 285.0,
                fc_perp: 750.0,
                fc: 2510.0,
                e: 2_000_000.0,
                e_min: 1_040_000.0,
                specific_gravity: 0.50,
            },
            WoodSpecies::CLT => TimberReferenceValues {
                fb: 1950.0,
                ft: 1350.0,
                fv: 215.0,
                fc_perp: 625.0,
                fc: 1750.0,
                e: 1_700_000.0,
                e_min: 850_000.0,
                specific_gravity: 0.42,
            },
            _ => TimberReferenceValues {
                fb: 1200.0,
                ft: 800.0,
                fv: 150.0,
                fc_perp: 500.0,
                fc: 1200.0,
                e: 1_400_000.0,
                e_min: 510_000.0,
                specific_gravity: 0.45,
            },
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct TimberReferenceValues {
    pub fb: f64,       // Bending (psi)
    pub ft: f64,       // Tension parallel (psi)
    pub fv: f64,       // Shear (psi)
    pub fc_perp: f64,  // Compression perpendicular (psi)
    pub fc: f64,       // Compression parallel (psi)
    pub e: f64,        // Modulus of elasticity (psi)
    pub e_min: f64,    // Minimum E for stability (psi)
    pub specific_gravity: f64,
}

/// Lumber grade
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LumberGrade {
    SelectStructural,
    No1,
    No2,
    No3,
    Stud,
    Construction,
    Standard,
    Utility,
}

impl LumberGrade {
    /// Grade factor for reference values
    pub fn factor(&self) -> f64 {
        match self {
            LumberGrade::SelectStructural => 1.0,
            LumberGrade::No1 => 0.85,
            LumberGrade::No2 => 0.70,
            LumberGrade::No3 => 0.55,
            LumberGrade::Stud => 0.60,
            LumberGrade::Construction => 0.75,
            LumberGrade::Standard => 0.60,
            LumberGrade::Utility => 0.45,
        }
    }
}

// ============================================================================
// NDS ADJUSTMENT FACTORS
// ============================================================================

/// Load duration factor CD (NDS Table 2.3.2)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LoadDuration {
    Permanent,        // > 10 years (0.9)
    TenYears,         // Normal (1.0)
    TwoMonths,        // Snow (1.15)
    SevenDays,        // Construction (1.25)
    TenMinutes,       // Wind/Seismic (1.6)
    Impact,           // Impact (2.0)
}

impl LoadDuration {
    pub fn cd(&self) -> f64 {
        match self {
            LoadDuration::Permanent => 0.90,
            LoadDuration::TenYears => 1.00,
            LoadDuration::TwoMonths => 1.15,
            LoadDuration::SevenDays => 1.25,
            LoadDuration::TenMinutes => 1.60,
            LoadDuration::Impact => 2.00,
        }
    }
}

/// Moisture service condition
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MoistureCondition {
    Dry,      // MC ≤ 19% for sawn, ≤ 16% for glulam
    Wet,      // MC > 19%
}

impl MoistureCondition {
    /// Wet service factor CM (NDS Table 4A)
    pub fn cm(&self, property: &str) -> f64 {
        match self {
            MoistureCondition::Dry => 1.0,
            MoistureCondition::Wet => match property {
                "Fb" => 0.85,
                "Ft" => 1.0,
                "Fv" => 0.97,
                "Fc_perp" => 0.67,
                "Fc" => 0.80,
                "E" => 0.90,
                _ => 1.0,
            },
        }
    }
}

/// Temperature factor Ct (NDS Table 2.3.3)
pub fn temperature_factor(temp_f: f64, moisture: MoistureCondition) -> f64 {
    match moisture {
        MoistureCondition::Dry => {
            if temp_f <= 100.0 { 1.0 }
            else if temp_f <= 125.0 { 0.9 }
            else { 0.8 }
        }
        MoistureCondition::Wet => {
            if temp_f <= 100.0 { 1.0 }
            else if temp_f <= 125.0 { 0.7 }
            else { 0.5 }
        }
    }
}

/// Size factor CF for sawn lumber (NDS Table 4A)
pub fn size_factor_sawn(depth: f64) -> f64 {
    // For 2x10 and smaller
    if depth <= 4.0 {
        1.5
    } else if depth <= 6.0 {
        1.3
    } else if depth <= 8.0 {
        1.2
    } else if depth <= 10.0 {
        1.1
    } else if depth <= 12.0 {
        1.0
    } else {
        (12.0 / depth).powf(1.0 / 9.0)
    }
}

/// Size factor CF for Fc (compression parallel) - NDS Table 4A
/// Different from Fb size factors
pub fn size_factor_fc(depth: f64) -> f64 {
    if depth <= 4.0 {
        1.15
    } else if depth <= 6.0 {
        1.10
    } else if depth <= 8.0 {
        1.05
    } else {
        1.0
    }
}

/// Volume factor CV for glulam (NDS 5.3.6)
pub fn volume_factor_glulam(length: f64, depth: f64, width: f64) -> f64 {
    let x = 1.0 / 10.0; // Loading condition exponent
    let l_ref = 21.0 * 12.0;  // 21 ft reference length
    let d_ref = 12.0;          // 12 in reference depth
    let b_ref = 5.125;         // 5-1/8 in reference width
    
    let cv = (l_ref / length).powf(x) * 
             (d_ref / depth).powf(x) * 
             (b_ref / width).powf(x);
    
    cv.min(1.0)
}

/// Beam stability factor CL (NDS 3.3.3)
/// c = 0.95 for glulam, 0.80 for sawn lumber
pub fn beam_stability_factor(fb_prime: f64, e_min_prime: f64, le: f64, d: f64, b: f64) -> f64 {
    // Effective length ratio
    let rb = (le * d / b.powi(2)).sqrt();
    
    // Critical buckling stress
    let fbe = 1.20 * e_min_prime / rb.powi(2);
    
    // Beam stability factor (NDS 3.3.3.8)
    // Use c = 0.80 for sawn lumber (conservative default)
    let c = 0.80;
    let ratio = fbe / fb_prime;
    let term1 = (1.0 + ratio) / (2.0 * c);
    let term2 = ((1.0 + ratio) / (2.0 * c)).powi(2) - ratio / c;
    
    term1 - term2.sqrt()
}

/// Column stability factor CP (NDS 3.7.1)
pub fn column_stability_factor(fc_star: f64, e_min_prime: f64, le: f64, d: f64, c: f64) -> f64 {
    // Slenderness ratio
    let le_d = le / d;
    
    // Critical buckling stress
    let fce = 0.822 * e_min_prime / le_d.powi(2);
    
    // Column stability factor
    let ratio = fce / fc_star;
    let term1 = (1.0 + ratio) / (2.0 * c);
    let term2 = ((1.0 + ratio) / (2.0 * c)).powi(2) - ratio / c;
    
    term1 - term2.sqrt()
}

// ============================================================================
// TIMBER SECTION PROPERTIES
// ============================================================================

/// Standard sawn lumber dimensions (actual sizes in inches)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LumberSize {
    _2x4,
    _2x6,
    _2x8,
    _2x10,
    _2x12,
    _4x4,
    _4x6,
    _4x8,
    _6x6,
    _6x8,
    _8x8,
    Custom,
}

impl LumberSize {
    /// Actual dimensions (width, depth) in inches
    pub fn actual_dimensions(&self) -> (f64, f64) {
        match self {
            LumberSize::_2x4 => (1.5, 3.5),
            LumberSize::_2x6 => (1.5, 5.5),
            LumberSize::_2x8 => (1.5, 7.25),
            LumberSize::_2x10 => (1.5, 9.25),
            LumberSize::_2x12 => (1.5, 11.25),
            LumberSize::_4x4 => (3.5, 3.5),
            LumberSize::_4x6 => (3.5, 5.5),
            LumberSize::_4x8 => (3.5, 7.25),
            LumberSize::_6x6 => (5.5, 5.5),
            LumberSize::_6x8 => (5.5, 7.5),
            LumberSize::_8x8 => (7.5, 7.5),
            LumberSize::Custom => (0.0, 0.0),
        }
    }
}

/// Timber section properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimberSection {
    /// Width (inches)
    pub b: f64,
    /// Depth (inches)
    pub d: f64,
    /// Species
    pub species: WoodSpecies,
    /// Grade
    pub grade: LumberGrade,
}

impl TimberSection {
    pub fn new(b: f64, d: f64, species: WoodSpecies, grade: LumberGrade) -> Self {
        Self { b, d, species, grade }
    }
    
    pub fn from_lumber_size(size: LumberSize, species: WoodSpecies, grade: LumberGrade) -> Self {
        let (b, d) = size.actual_dimensions();
        Self { b, d, species, grade }
    }
    
    /// Cross-sectional area (in²)
    pub fn area(&self) -> f64 {
        self.b * self.d
    }
    
    /// Section modulus (in³)
    pub fn section_modulus(&self) -> f64 {
        self.b * self.d.powi(2) / 6.0
    }
    
    /// Moment of inertia (in⁴)
    pub fn moment_of_inertia(&self) -> f64 {
        self.b * self.d.powi(3) / 12.0
    }
    
    /// Radius of gyration (in)
    pub fn radius_of_gyration(&self) -> f64 {
        self.d / (12.0_f64).sqrt()
    }
}

// ============================================================================
// NDS TIMBER DESIGNER
// ============================================================================

/// NDS timber member designer
pub struct NdsTimberDesigner {
    pub section: TimberSection,
    pub moisture: MoistureCondition,
    pub temperature: f64,
    pub load_duration: LoadDuration,
    pub unbraced_length: f64,
}

impl NdsTimberDesigner {
    pub fn new(section: TimberSection) -> Self {
        Self {
            section,
            moisture: MoistureCondition::Dry,
            temperature: 70.0,
            load_duration: LoadDuration::TenYears,
            unbraced_length: 0.0,
        }
    }
    
    /// Get adjusted design values F'
    pub fn adjusted_values(&self) -> AdjustedValues {
        let ref_vals = self.section.species.reference_values();
        let grade_factor = self.section.grade.factor();
        
        let cd = self.load_duration.cd();
        let cm_fb = self.moisture.cm("Fb");
        let cm_ft = self.moisture.cm("Ft");
        let cm_fv = self.moisture.cm("Fv");
        let cm_fc_perp = self.moisture.cm("Fc_perp");
        let cm_fc = self.moisture.cm("Fc");
        let cm_e = self.moisture.cm("E");
        let ct = temperature_factor(self.temperature, self.moisture);
        let cf = size_factor_sawn(self.section.d);
        let cf_fc = size_factor_fc(self.section.d);
        
        AdjustedValues {
            fb_prime: ref_vals.fb * grade_factor * cd * cm_fb * ct * cf,
            ft_prime: ref_vals.ft * grade_factor * cd * cm_ft * ct * cf,
            fv_prime: ref_vals.fv * cd * cm_fv * ct, // No grade_factor for Fv per NDS Table 4A
            fc_perp_prime: ref_vals.fc_perp * cm_fc_perp * ct, // No grade_factor for Fc_perp per NDS Table 4A
            fc_prime: ref_vals.fc * grade_factor * cd * cm_fc * ct * cf_fc, // Use Fc-specific CF
            e_prime: ref_vals.e * cm_e * ct,
            e_min_prime: ref_vals.e_min * cm_e * ct,
        }
    }
    
    /// Check bending capacity (NDS 3.3)
    pub fn check_bending(&self, m: f64) -> BendingCheckResult {
        let adj = self.adjusted_values();
        let s = self.section.section_modulus();
        
        // Beam stability factor
        let cl = if self.unbraced_length > 0.0 {
            beam_stability_factor(
                adj.fb_prime, 
                adj.e_min_prime, 
                self.unbraced_length,
                self.section.d,
                self.section.b
            )
        } else {
            1.0
        };
        
        let fb_adj = adj.fb_prime * cl;
        let fb_actual = m / s;
        let ratio = fb_actual / fb_adj;
        
        BendingCheckResult {
            fb_actual,
            fb_allowable: fb_adj,
            cl,
            ratio,
            pass: ratio <= 1.0,
        }
    }
    
    /// Check shear capacity (NDS 3.4)
    pub fn check_shear(&self, v: f64) -> ShearCheckResult {
        let adj = self.adjusted_values();
        let a = self.section.area();
        
        // Actual shear stress
        let fv_actual = 1.5 * v / a;
        let ratio = fv_actual / adj.fv_prime;
        
        ShearCheckResult {
            fv_actual,
            fv_allowable: adj.fv_prime,
            ratio,
            pass: ratio <= 1.0,
        }
    }
    
    /// Check compression parallel to grain (NDS 3.6)
    pub fn check_compression(&self, p: f64, le: f64) -> CompressionCheckResult {
        let adj = self.adjusted_values();
        let a = self.section.area();
        
        // Column stability factor
        let cp = column_stability_factor(
            adj.fc_prime, 
            adj.e_min_prime, 
            le, 
            self.section.d.min(self.section.b), 
            // NDS 3.7.1: c = 0.9 for glulam/SCL, 0.8 for sawn lumber
            0.8
        );
        
        let fc_adj = adj.fc_prime * cp;
        let fc_actual = p / a;
        let ratio = fc_actual / fc_adj;
        
        let le_d = le / self.section.d.min(self.section.b);
        
        CompressionCheckResult {
            fc_actual,
            fc_allowable: fc_adj,
            cp,
            slenderness: le_d,
            ratio,
            pass: ratio <= 1.0,
        }
    }
    
    /// Check tension parallel to grain (NDS 3.8)
    pub fn check_tension(&self, t: f64) -> TensionCheckResult {
        let adj = self.adjusted_values();
        let a = self.section.area();
        
        let ft_actual = t / a;
        let ratio = ft_actual / adj.ft_prime;
        
        TensionCheckResult {
            ft_actual,
            ft_allowable: adj.ft_prime,
            ratio,
            pass: ratio <= 1.0,
        }
    }
    
    /// Combined bending and axial (NDS 3.9)
    pub fn check_combined(&self, m: f64, p: f64, is_compression: bool, le: f64) -> CombinedCheckResult {
        let bending = self.check_bending(m);
        
        let (axial_ratio, interaction) = if is_compression {
            let comp = self.check_compression(p, le);
            
            // NDS Eq. 3.9-3 for combined compression + bending
            let fce1 = 0.822 * self.adjusted_values().e_min_prime / (le / self.section.d).powi(2);
            let amplification = if comp.fc_actual >= fce1 {
                f64::INFINITY // Beyond Euler buckling
            } else {
                1.0 / (1.0 - comp.fc_actual / fce1)
            };
            let interaction = (comp.ratio).powi(2) + bending.ratio * amplification;
            (comp.ratio, interaction)
        } else {
            let tens = self.check_tension(p);
            // NDS Eq. 3.9-1 for combined tension + bending
            let interaction = tens.ratio + bending.ratio;
            (tens.ratio, interaction)
        };
        
        CombinedCheckResult {
            bending_ratio: bending.ratio,
            axial_ratio,
            interaction_ratio: interaction,
            pass: interaction <= 1.0,
        }
    }
    
    /// Check bearing perpendicular to grain (NDS 3.10)
    pub fn check_bearing(&self, p: f64, bearing_length: f64) -> BearingCheckResult {
        let adj = self.adjusted_values();
        
        // Bearing area factor Cb (NDS 3.10.4)
        let cb = if bearing_length >= 6.0 {
            1.0
        } else {
            (bearing_length + 0.375) / bearing_length
        };
        
        let fc_perp_adj = adj.fc_perp_prime * cb;
        let bearing_area = self.section.b * bearing_length;
        let fc_perp_actual = p / bearing_area;
        let ratio = fc_perp_actual / fc_perp_adj;
        
        BearingCheckResult {
            fc_perp_actual,
            fc_perp_allowable: fc_perp_adj,
            cb,
            ratio,
            pass: ratio <= 1.0,
        }
    }
}

// ============================================================================
// RESULT STRUCTURES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdjustedValues {
    pub fb_prime: f64,
    pub ft_prime: f64,
    pub fv_prime: f64,
    pub fc_perp_prime: f64,
    pub fc_prime: f64,
    pub e_prime: f64,
    pub e_min_prime: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BendingCheckResult {
    pub fb_actual: f64,
    pub fb_allowable: f64,
    pub cl: f64,
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
pub struct CompressionCheckResult {
    pub fc_actual: f64,
    pub fc_allowable: f64,
    pub cp: f64,
    pub slenderness: f64,
    pub ratio: f64,
    pub pass: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TensionCheckResult {
    pub ft_actual: f64,
    pub ft_allowable: f64,
    pub ratio: f64,
    pub pass: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CombinedCheckResult {
    pub bending_ratio: f64,
    pub axial_ratio: f64,
    pub interaction_ratio: f64,
    pub pass: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BearingCheckResult {
    pub fc_perp_actual: f64,
    pub fc_perp_allowable: f64,
    pub cb: f64,
    pub ratio: f64,
    pub pass: bool,
}

// ============================================================================
// EUROCODE 5 TIMBER DESIGN
// ============================================================================

/// Eurocode 5 strength classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Ec5StrengthClass {
    // Softwood
    C14, C16, C18, C20, C22, C24, C27, C30, C35, C40, C45, C50,
    // Hardwood
    D30, D35, D40, D50, D60, D70,
    // Glulam
    GL24h, GL28h, GL32h, GL36h,
    GL24c, GL28c, GL32c, GL36c,
}

impl Ec5StrengthClass {
    /// Characteristic strengths (N/mm²)
    pub fn characteristic_values(&self) -> Ec5CharacteristicValues {
        match self {
            Ec5StrengthClass::C24 => Ec5CharacteristicValues {
                fm_k: 24.0,
                ft_0_k: 14.5,
                ft_90_k: 0.4,
                fc_0_k: 21.0,
                fc_90_k: 2.5,
                fv_k: 4.0,
                e_0_mean: 11000.0,
                e_0_05: 7400.0,
                e_90_mean: 370.0,
                g_mean: 690.0,
                rho_k: 350.0,
            },
            Ec5StrengthClass::GL28h => Ec5CharacteristicValues {
                fm_k: 28.0,
                ft_0_k: 22.3,
                ft_90_k: 0.5,
                fc_0_k: 26.5, // EN 14080 Table 5 for GL28h
                fc_90_k: 3.0,
                fv_k: 3.5,
                e_0_mean: 12600.0,
                e_0_05: 10200.0,
                e_90_mean: 420.0,
                g_mean: 780.0,
                rho_k: 425.0,
            },
            _ => Ec5CharacteristicValues {
                fm_k: 24.0,
                ft_0_k: 14.5,
                ft_90_k: 0.4,
                fc_0_k: 21.0,
                fc_90_k: 2.5,
                fv_k: 4.0,
                e_0_mean: 11000.0,
                e_0_05: 7400.0,
                e_90_mean: 370.0,
                g_mean: 690.0,
                rho_k: 350.0,
            },
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Ec5CharacteristicValues {
    pub fm_k: f64,      // Bending strength
    pub ft_0_k: f64,    // Tension parallel
    pub ft_90_k: f64,   // Tension perpendicular
    pub fc_0_k: f64,    // Compression parallel
    pub fc_90_k: f64,   // Compression perpendicular
    pub fv_k: f64,      // Shear
    pub e_0_mean: f64,  // Mean modulus parallel
    pub e_0_05: f64,    // 5% modulus
    pub e_90_mean: f64, // Mean modulus perpendicular
    pub g_mean: f64,    // Mean shear modulus
    pub rho_k: f64,     // Characteristic density (kg/m³)
}

/// Eurocode 5 service class
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Ec5ServiceClass {
    SC1, // Indoor, heated
    SC2, // Covered, unheated
    SC3, // Exposed
}

impl Ec5ServiceClass {
    pub fn kmod(&self, load_duration: &str) -> f64 {
        match (self, load_duration) {
            (Ec5ServiceClass::SC1, "permanent") => 0.60,
            (Ec5ServiceClass::SC1, "long-term") => 0.70,
            (Ec5ServiceClass::SC1, "medium-term") => 0.80,
            (Ec5ServiceClass::SC1, "short-term") => 0.90,
            (Ec5ServiceClass::SC1, "instantaneous") => 1.10,
            (Ec5ServiceClass::SC2, "permanent") => 0.60,
            (Ec5ServiceClass::SC2, "long-term") => 0.70,
            (Ec5ServiceClass::SC2, "medium-term") => 0.80,
            (Ec5ServiceClass::SC2, "short-term") => 0.90,
            (Ec5ServiceClass::SC2, "instantaneous") => 1.10,
            (Ec5ServiceClass::SC3, "permanent") => 0.50,
            (Ec5ServiceClass::SC3, "long-term") => 0.55,
            (Ec5ServiceClass::SC3, "medium-term") => 0.65,
            (Ec5ServiceClass::SC3, "short-term") => 0.70,
            (Ec5ServiceClass::SC3, "instantaneous") => 0.90,
            _ => 0.80,
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
    fn test_wood_species_values() {
        let vals = WoodSpecies::DouglasFirLarch.reference_values();
        assert_eq!(vals.fb, 1500.0);
        assert_eq!(vals.e, 1_900_000.0);
    }

    #[test]
    fn test_lumber_size() {
        let (b, d) = LumberSize::_2x10.actual_dimensions();
        assert!((b - 1.5).abs() < 0.01);
        assert!((d - 9.25).abs() < 0.01);
    }

    #[test]
    fn test_timber_section() {
        let section = TimberSection::from_lumber_size(
            LumberSize::_2x12,
            WoodSpecies::DouglasFirLarch,
            LumberGrade::No1
        );
        
        assert!((section.area() - 16.875).abs() < 0.01);
        assert!(section.section_modulus() > 0.0);
    }

    #[test]
    fn test_load_duration_factor() {
        assert_eq!(LoadDuration::TenYears.cd(), 1.0);
        assert_eq!(LoadDuration::TenMinutes.cd(), 1.6);
    }

    #[test]
    fn test_moisture_factor() {
        assert_eq!(MoistureCondition::Dry.cm("Fb"), 1.0);
        assert_eq!(MoistureCondition::Wet.cm("Fb"), 0.85);
    }

    #[test]
    fn test_size_factor() {
        assert!(size_factor_sawn(5.5) > 1.0);
        assert_eq!(size_factor_sawn(12.0), 1.0);
    }

    #[test]
    fn test_nds_adjusted_values() {
        let section = TimberSection::from_lumber_size(
            LumberSize::_2x10,
            WoodSpecies::DouglasFirLarch,
            LumberGrade::No1
        );
        let designer = NdsTimberDesigner::new(section);
        let adj = designer.adjusted_values();
        
        assert!(adj.fb_prime > 0.0);
        assert!(adj.e_prime > 0.0);
    }

    #[test]
    fn test_bending_check() {
        let section = TimberSection::from_lumber_size(
            LumberSize::_2x12,
            WoodSpecies::DouglasFirLarch,
            LumberGrade::No1
        );
        let designer = NdsTimberDesigner::new(section);
        let result = designer.check_bending(5000.0); // 5000 lb-in moment
        
        assert!(result.fb_actual > 0.0);
        assert!(result.fb_allowable > 0.0);
    }

    #[test]
    fn test_shear_check() {
        let section = TimberSection::from_lumber_size(
            LumberSize::_2x10,
            WoodSpecies::SouthernPine,
            LumberGrade::No2
        );
        let designer = NdsTimberDesigner::new(section);
        let result = designer.check_shear(500.0); // 500 lb
        
        assert!(result.fv_actual > 0.0);
        assert!(result.ratio > 0.0);
    }

    #[test]
    fn test_compression_check() {
        let section = TimberSection::from_lumber_size(
            LumberSize::_4x4,
            WoodSpecies::DouglasFirLarch,
            LumberGrade::No1
        );
        let mut designer = NdsTimberDesigner::new(section);
        designer.unbraced_length = 96.0; // 8 ft
        
        let result = designer.check_compression(5000.0, 96.0);
        
        assert!(result.cp > 0.0 && result.cp <= 1.0);
        assert!(result.slenderness > 0.0);
    }

    #[test]
    fn test_combined_check() {
        let section = TimberSection::from_lumber_size(
            LumberSize::_6x6,
            WoodSpecies::DouglasFirLarch,
            LumberGrade::SelectStructural
        );
        let designer = NdsTimberDesigner::new(section);
        
        let result = designer.check_combined(10000.0, 5000.0, true, 120.0);
        
        assert!(result.interaction_ratio > 0.0);
    }

    #[test]
    fn test_bearing_check() {
        let section = TimberSection::from_lumber_size(
            LumberSize::_2x10,
            WoodSpecies::SprucePineFir,
            LumberGrade::No2
        );
        let designer = NdsTimberDesigner::new(section);
        
        let result = designer.check_bearing(2000.0, 3.5);
        
        assert!(result.cb >= 1.0);
        assert!(result.ratio > 0.0);
    }

    #[test]
    fn test_ec5_strength_class() {
        let vals = Ec5StrengthClass::C24.characteristic_values();
        assert_eq!(vals.fm_k, 24.0);
        assert_eq!(vals.e_0_mean, 11000.0);
    }

    #[test]
    fn test_ec5_service_class() {
        let kmod = Ec5ServiceClass::SC1.kmod("medium-term");
        assert!((kmod - 0.80).abs() < 0.01);
    }

    #[test]
    fn test_glulam_values() {
        let vals = WoodSpecies::Glulam.reference_values();
        assert!(vals.fb > 2000.0); // Higher than sawn lumber
    }
}
