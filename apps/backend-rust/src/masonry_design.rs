// ============================================================================
// MASONRY DESIGN MODULE
// ACI 530 (TMS 402), Eurocode 6, IS 1905 compliant masonry structural design
// ============================================================================

use serde::{Deserialize, Serialize};

// ============================================================================
// MASONRY UNIT TYPES
// ============================================================================

/// Masonry unit types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MasonryUnitType {
    /// Concrete masonry unit (CMU/block)
    ConcreteMasonry,
    /// Clay brick
    ClayBrick,
    /// Autoclaved aerated concrete
    Aac,
    /// Calcium silicate
    CalciumSilicate,
    /// Natural stone
    Stone,
    /// Glass block
    GlassBlock,
}

/// Mortar type per ASTM C270
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MortarType {
    /// Type M - High strength
    TypeM,
    /// Type S - Standard
    TypeS,
    /// Type N - Moderate
    TypeN,
    /// Type O - Low strength
    TypeO,
    /// Type K - Very low strength
    TypeK,
}

impl MortarType {
    /// Minimum compressive strength (MPa)
    pub fn min_strength(&self) -> f64 {
        match self {
            MortarType::TypeM => 17.2,
            MortarType::TypeS => 12.4,
            MortarType::TypeN => 5.2,
            MortarType::TypeO => 2.4,
            MortarType::TypeK => 0.5,
        }
    }
}

/// Grout fill type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum GroutFill {
    /// Fully grouted
    FullyGrouted,
    /// Partially grouted
    PartiallyGrouted,
    /// Ungrouted (hollow)
    Ungrouted,
}

// ============================================================================
// MASONRY MATERIAL PROPERTIES
// ============================================================================

/// Masonry material properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MasonryMaterial {
    /// Unit type
    pub unit_type: MasonryUnitType,
    /// Specified compressive strength f'm (MPa)
    pub fm: f64,
    /// Unit compressive strength (MPa)
    pub unit_strength: f64,
    /// Mortar type
    pub mortar_type: MortarType,
    /// Grout strength (MPa)
    pub grout_strength: f64,
    /// Modulus of elasticity (MPa)
    pub em: f64,
    /// Shear modulus (MPa)
    pub gm: f64,
    /// Unit weight (kN/m³)
    pub unit_weight: f64,
}

impl MasonryMaterial {
    /// Create new masonry material
    pub fn new(unit_type: MasonryUnitType, fm: f64, mortar_type: MortarType) -> Self {
        // ACI 530: Em = 900 * f'm for CMU, 700 * f'm for clay
        let em = match unit_type {
            MasonryUnitType::ConcreteMasonry => 900.0 * fm,
            MasonryUnitType::ClayBrick => 700.0 * fm,
            MasonryUnitType::Aac => 500.0 * fm,
            _ => 700.0 * fm,
        };
        
        let unit_weight = match unit_type {
            MasonryUnitType::ConcreteMasonry => 21.0,
            MasonryUnitType::ClayBrick => 19.0,
            MasonryUnitType::Aac => 6.0,
            MasonryUnitType::CalciumSilicate => 18.0,
            MasonryUnitType::Stone => 24.0,
            MasonryUnitType::GlassBlock => 22.0,
        };
        
        Self {
            unit_type,
            fm,
            unit_strength: fm * 1.5, // Typical ratio
            mortar_type,
            grout_strength: 14.0, // Default f'g
            em,
            gm: em / 2.5, // Typical ratio
            unit_weight,
        }
    }
    
    /// Standard CMU 2000 psi (13.8 MPa)
    pub fn standard_cmu() -> Self {
        Self::new(MasonryUnitType::ConcreteMasonry, 13.8, MortarType::TypeS)
    }
    
    /// High-strength CMU
    pub fn high_strength_cmu() -> Self {
        Self::new(MasonryUnitType::ConcreteMasonry, 20.7, MortarType::TypeM)
    }
    
    /// Standard clay brick
    pub fn standard_clay_brick() -> Self {
        Self::new(MasonryUnitType::ClayBrick, 10.3, MortarType::TypeS)
    }
    
    /// Allowable flexural tension (MPa) - parallel to bed joint
    pub fn allowable_tension_parallel(&self) -> f64 {
        match self.unit_type {
            MasonryUnitType::ConcreteMasonry => 0.41, // 60 psi
            MasonryUnitType::ClayBrick => 0.52,
            _ => 0.35,
        }
    }
    
    /// Allowable flexural tension (MPa) - perpendicular to bed joint
    pub fn allowable_tension_perpendicular(&self) -> f64 {
        match self.unit_type {
            MasonryUnitType::ConcreteMasonry => 0.17, // 25 psi
            MasonryUnitType::ClayBrick => 0.21,
            _ => 0.14,
        }
    }
}

// ============================================================================
// MASONRY SECTION PROPERTIES
// ============================================================================

/// Masonry wall section
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MasonryWallSection {
    /// Wall thickness (mm)
    pub thickness: f64,
    /// Wall length (mm)
    pub length: f64,
    /// Wall height (mm)
    pub height: f64,
    /// Grout fill
    pub grout_fill: GroutFill,
    /// Cell spacing for partial grout (mm)
    pub grout_spacing: f64,
    /// Reinforcement area per meter height (mm²/m)
    pub vertical_reinf_area: f64,
    /// Horizontal reinforcement area per meter height (mm²/m)
    pub horizontal_reinf_area: f64,
    /// Reinforcement yield strength (MPa)
    pub fy: f64,
}

impl MasonryWallSection {
    /// Standard 8" (203mm) CMU wall
    pub fn standard_8inch() -> Self {
        Self {
            thickness: 203.0,
            length: 1000.0,
            height: 3000.0,
            grout_fill: GroutFill::PartiallyGrouted,
            grout_spacing: 1200.0,
            vertical_reinf_area: 400.0,
            horizontal_reinf_area: 200.0,
            fy: 420.0,
        }
    }
    
    /// Standard 12" (305mm) CMU wall
    pub fn standard_12inch() -> Self {
        Self {
            thickness: 305.0,
            length: 1000.0,
            height: 3000.0,
            grout_fill: GroutFill::FullyGrouted,
            grout_spacing: 0.0,
            vertical_reinf_area: 600.0,
            horizontal_reinf_area: 300.0,
            fy: 420.0,
        }
    }
    
    /// Gross cross-sectional area (mm²)
    pub fn gross_area(&self) -> f64 {
        self.thickness * self.length
    }
    
    /// Net cross-sectional area (mm²)
    pub fn net_area(&self, fill_ratio: f64) -> f64 {
        self.gross_area() * fill_ratio
    }
    
    /// Moment of inertia about weak axis (mm⁴)
    pub fn moment_of_inertia(&self) -> f64 {
        self.length * self.thickness.powi(3) / 12.0
    }
    
    /// Section modulus (mm³)
    pub fn section_modulus(&self) -> f64 {
        self.length * self.thickness.powi(2) / 6.0
    }
    
    /// Slenderness ratio
    pub fn slenderness_ratio(&self) -> f64 {
        self.height / self.thickness
    }
    
    /// Effective depth for flexure (mm)
    pub fn effective_depth(&self) -> f64 {
        self.thickness - 40.0 // Cover
    }
}

// ============================================================================
// ACI 530/TMS 402 DESIGNER
// ============================================================================

/// ACI 530 (TMS 402) masonry design
pub struct Aci530Designer {
    /// Material properties
    pub material: MasonryMaterial,
    /// Design method
    pub design_method: MasonryDesignMethod,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MasonryDesignMethod {
    /// Allowable Stress Design (ASD)
    AllowableStress,
    /// Strength Design (SD/LRFD)
    StrengthDesign,
}

impl Aci530Designer {
    pub fn new(material: MasonryMaterial) -> Self {
        Self {
            material,
            design_method: MasonryDesignMethod::StrengthDesign,
        }
    }
    
    /// Slenderness reduction factor (ACI 530)
    pub fn slenderness_factor(&self, h_t_ratio: f64) -> f64 {
        if h_t_ratio <= 99.0 {
            1.0 - (h_t_ratio / 140.0).powi(2)
        } else {
            (70.0 / h_t_ratio).powi(2)
        }
    }
    
    /// Allowable axial compression (kN) - ASD
    pub fn allowable_axial_compression_asd(
        &self,
        section: &MasonryWallSection,
        effective_length_factor: f64,
    ) -> f64 {
        let h_t = section.slenderness_ratio();
        let r = self.slenderness_factor(h_t * effective_length_factor);
        
        let fa = 0.25 * self.material.fm; // Allowable stress
        let a_n = section.gross_area() * 0.75; // Net area factor
        
        fa * a_n * r / 1000.0 // kN
    }
    
    /// Nominal axial capacity (kN) - Strength Design
    pub fn nominal_axial_capacity_sd(
        &self,
        section: &MasonryWallSection,
        effective_length_factor: f64,
    ) -> f64 {
        let h_t = section.slenderness_ratio();
        let _r = self.slenderness_factor(h_t * effective_length_factor);
        
        // φPn = 0.80 * [0.80 * f'm * (An - As) + fy * As] for h/r ≤ 99
        let a_n = section.gross_area() * 0.75;
        let a_s = section.vertical_reinf_area * section.height / 1000.0;
        
        let phi = 0.9; // Axial compression
        let pn = 0.80 * (0.80 * self.material.fm * (a_n - a_s) + section.fy * a_s);
        
        phi * pn / 1000.0 // kN
    }
    
    /// Allowable flexural tension (kN/m) - unreinforced
    pub fn allowable_flexural_tension(&self, section: &MasonryWallSection) -> f64 {
        let ft = self.material.allowable_tension_parallel();
        let s = section.section_modulus();
        ft * s / 1e6 // kN·m per m
    }
    
    /// Nominal flexural capacity (kN·m) - reinforced
    pub fn nominal_flexural_capacity(&self, section: &MasonryWallSection) -> f64 {
        let d = section.effective_depth();
        let a_s = section.vertical_reinf_area;
        let fy = section.fy;
        let fm = self.material.fm;
        
        // Depth of compression block
        let a = a_s * fy / (0.80 * fm * section.length);
        
        // Nominal moment
        let phi = 0.9;
        let mn = a_s * fy * (d - a / 2.0) / 1e6; // kN·m
        
        phi * mn
    }
    
    /// Shear capacity (kN)
    pub fn shear_capacity(&self, section: &MasonryWallSection) -> f64 {
        let d = section.effective_depth();
        let fv = 0.083 * self.material.fm.sqrt(); // MPa
        
        let phi = 0.8;
        let vn = fv * section.length * d / 1000.0;
        
        phi * vn
    }
    
    /// Design wall for axial + bending (interaction check)
    pub fn check_interaction(
        &self,
        section: &MasonryWallSection,
        axial: f64,      // kN
        moment: f64,     // kN·m
    ) -> InteractionResult {
        let p_capacity = self.nominal_axial_capacity_sd(section, 1.0);
        let m_capacity = self.nominal_flexural_capacity(section);
        
        // Linear interaction
        let utilization = axial / p_capacity + moment / m_capacity;
        
        InteractionResult {
            axial_capacity: p_capacity,
            moment_capacity: m_capacity,
            utilization,
            pass: utilization <= 1.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InteractionResult {
    pub axial_capacity: f64,
    pub moment_capacity: f64,
    pub utilization: f64,
    pub pass: bool,
}

// ============================================================================
// EUROCODE 6 DESIGNER
// ============================================================================

/// Eurocode 6 masonry design
pub struct Eurocode6Designer {
    /// Material properties
    pub material: MasonryMaterial,
    /// Partial safety factor for masonry
    pub gamma_m: f64,
    /// Partial safety factor for steel
    pub gamma_s: f64,
}

impl Eurocode6Designer {
    pub fn new(material: MasonryMaterial) -> Self {
        Self {
            material,
            gamma_m: 2.0, // Category A workmanship
            gamma_s: 1.15,
        }
    }
    
    /// Characteristic compressive strength of masonry
    pub fn characteristic_strength(&self) -> f64 {
        // fk = K * fb^0.7 * fm^0.3
        let k = match self.material.unit_type {
            MasonryUnitType::ClayBrick => 0.55,
            MasonryUnitType::ConcreteMasonry => 0.45,
            MasonryUnitType::CalciumSilicate => 0.55,
            MasonryUnitType::Aac => 0.65,
            _ => 0.45,
        };
        
        let fb = self.material.unit_strength;
        let fm = self.material.mortar_type.min_strength();
        
        k * fb.powf(0.7) * fm.powf(0.3)
    }
    
    /// Design compressive strength
    pub fn design_strength(&self) -> f64 {
        self.characteristic_strength() / self.gamma_m
    }
    
    /// Capacity reduction factor (slenderness)
    pub fn capacity_reduction(&self, section: &MasonryWallSection, eccentricity: f64) -> f64 {
        let h_eff = 0.75 * section.height; // Typical for pinned-pinned
        let t = section.thickness;
        let lambda = h_eff / t;
        
        // Eccentricity at mid-height
        let e = eccentricity + h_eff.powi(2) * section.thickness / (2400.0 * t);
        
        // Capacity reduction factor
        let a = 1.0 - 2.0 * e / t;
        let u = lambda - 2.0;
        
        if lambda <= 27.0 {
            a * (-u.powi(2) / 2300.0).exp()
        } else {
            0.0
        }
    }
    
    /// Design resistance for axial compression (kN)
    pub fn axial_resistance(&self, section: &MasonryWallSection, eccentricity: f64) -> f64 {
        let fd = self.design_strength();
        let phi = self.capacity_reduction(section, eccentricity);
        let a = section.gross_area();
        
        phi * a * fd / 1000.0
    }
    
    /// Design resistance for bending (kN·m)
    pub fn moment_resistance(&self, section: &MasonryWallSection) -> f64 {
        let fd = self.design_strength();
        let z = section.section_modulus();
        
        fd * z / 1e6
    }
    
    /// Lateral shear resistance (kN)
    pub fn shear_resistance(&self, section: &MasonryWallSection, axial_stress: f64) -> f64 {
        // fvk = fvk0 + 0.4 * σd (with limit)
        let fvk0 = 0.2; // Initial shear strength (MPa)
        let fvk = (fvk0 + 0.4 * axial_stress).min(0.065 * self.material.fm);
        
        let fvd = fvk / self.gamma_m;
        let a = section.gross_area() * 0.75; // Net area
        
        fvd * a / 1000.0
    }
}

// ============================================================================
// IS 1905 DESIGNER (INDIAN STANDARD)
// ============================================================================

/// IS 1905 masonry design
pub struct Is1905Designer {
    /// Material properties
    pub material: MasonryMaterial,
}

impl Is1905Designer {
    pub fn new(material: MasonryMaterial) -> Self {
        Self { material }
    }
    
    /// Basic compressive stress (MPa)
    pub fn basic_compressive_stress(&self) -> f64 {
        // Based on mortar type and unit strength
        let unit_str = self.material.unit_strength;
        
        match self.material.mortar_type {
            MortarType::TypeM | MortarType::TypeS => {
                if unit_str >= 35.0 { 2.0 }
                else if unit_str >= 25.0 { 1.6 }
                else if unit_str >= 15.0 { 1.2 }
                else if unit_str >= 10.0 { 0.9 }
                else { 0.6 }
            }
            _ => {
                if unit_str >= 35.0 { 1.5 }
                else if unit_str >= 25.0 { 1.2 }
                else if unit_str >= 15.0 { 0.9 }
                else { 0.6 }
            }
        }
    }
    
    /// Slenderness ratio (h/t or L/t)
    pub fn slenderness_ratio(&self, section: &MasonryWallSection) -> f64 {
        section.height / section.thickness
    }
    
    /// Area reduction factor (for slenderness)
    pub fn area_reduction_factor(&self, sr: f64) -> f64 {
        if sr <= 6.0 { 1.0 }
        else if sr <= 8.0 { 0.97 }
        else if sr <= 10.0 { 0.93 }
        else if sr <= 12.0 { 0.87 }
        else if sr <= 14.0 { 0.80 }
        else if sr <= 16.0 { 0.72 }
        else if sr <= 18.0 { 0.63 }
        else if sr <= 20.0 { 0.53 }
        else if sr <= 22.0 { 0.43 }
        else if sr <= 24.0 { 0.33 }
        else if sr <= 26.0 { 0.24 }
        else { 0.15 }
    }
    
    /// Permissible compressive stress (MPa)
    pub fn permissible_stress(&self, section: &MasonryWallSection, eccentricity_ratio: f64) -> f64 {
        let fb = self.basic_compressive_stress();
        let sr = self.slenderness_ratio(section);
        let ks = self.area_reduction_factor(sr);
        
        // Eccentricity reduction
        let ke = if eccentricity_ratio <= 0.0 { 1.0 }
        else if eccentricity_ratio <= 1.0/6.0 { 0.9 }
        else if eccentricity_ratio <= 1.0/4.0 { 0.75 }
        else if eccentricity_ratio <= 1.0/3.0 { 0.5 }
        else { 0.25 };
        
        fb * ks * ke
    }
    
    /// Allowable load (kN)
    pub fn allowable_load(&self, section: &MasonryWallSection, eccentricity: f64) -> f64 {
        let e_ratio = eccentricity / section.thickness;
        let sigma = self.permissible_stress(section, e_ratio);
        let a = section.gross_area();
        
        sigma * a / 1000.0
    }
}

// ============================================================================
// MASONRY WALL DESIGN CHECKS
// ============================================================================

/// Complete masonry wall design check
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MasonryWallDesign {
    pub section: MasonryWallSection,
    pub material: MasonryMaterial,
    pub axial_load: f64,    // kN
    pub moment: f64,        // kN·m
    pub shear: f64,         // kN
    pub out_of_plane: f64,  // kN·m/m
}

impl MasonryWallDesign {
    pub fn new(section: MasonryWallSection, material: MasonryMaterial) -> Self {
        Self {
            section,
            material,
            axial_load: 0.0,
            moment: 0.0,
            shear: 0.0,
            out_of_plane: 0.0,
        }
    }
    
    pub fn with_loads(mut self, axial: f64, moment: f64, shear: f64) -> Self {
        self.axial_load = axial;
        self.moment = moment;
        self.shear = shear;
        self
    }
    
    /// Full design check per ACI 530
    pub fn check_aci530(&self) -> MasonryDesignResult {
        let designer = Aci530Designer::new(self.material.clone());
        
        let axial_capacity = designer.nominal_axial_capacity_sd(&self.section, 1.0);
        let moment_capacity = designer.nominal_flexural_capacity(&self.section);
        let shear_capacity = designer.shear_capacity(&self.section);
        
        let interaction = designer.check_interaction(
            &self.section,
            self.axial_load,
            self.moment,
        );
        
        let shear_utilization = if shear_capacity > 0.0 {
            self.shear / shear_capacity
        } else {
            f64::INFINITY
        };
        
        MasonryDesignResult {
            code: "ACI 530 (TMS 402)".to_string(),
            axial_capacity,
            moment_capacity,
            shear_capacity,
            axial_utilization: self.axial_load / axial_capacity,
            moment_utilization: self.moment / moment_capacity,
            shear_utilization,
            interaction_utilization: interaction.utilization,
            pass: interaction.pass && shear_utilization <= 1.0,
        }
    }
    
    /// Full design check per Eurocode 6
    pub fn check_ec6(&self) -> MasonryDesignResult {
        let designer = Eurocode6Designer::new(self.material.clone());
        
        let eccentricity = if self.axial_load > 0.0 {
            self.moment * 1000.0 / self.axial_load // mm
        } else {
            0.0
        };
        
        let axial_capacity = designer.axial_resistance(&self.section, eccentricity);
        let moment_capacity = designer.moment_resistance(&self.section);
        
        let axial_stress = self.axial_load * 1000.0 / self.section.gross_area();
        let shear_capacity = designer.shear_resistance(&self.section, axial_stress);
        
        let axial_util = self.axial_load / axial_capacity;
        let moment_util = if moment_capacity > 0.0 { self.moment / moment_capacity } else { 0.0 };
        let shear_util = if shear_capacity > 0.0 { self.shear / shear_capacity } else { 0.0 };
        
        MasonryDesignResult {
            code: "EN 1996 (Eurocode 6)".to_string(),
            axial_capacity,
            moment_capacity,
            shear_capacity,
            axial_utilization: axial_util,
            moment_utilization: moment_util,
            shear_utilization: shear_util,
            interaction_utilization: axial_util + moment_util,
            pass: axial_util <= 1.0 && moment_util <= 1.0 && shear_util <= 1.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MasonryDesignResult {
    pub code: String,
    pub axial_capacity: f64,
    pub moment_capacity: f64,
    pub shear_capacity: f64,
    pub axial_utilization: f64,
    pub moment_utilization: f64,
    pub shear_utilization: f64,
    pub interaction_utilization: f64,
    pub pass: bool,
}

// ============================================================================
// REINFORCED MASONRY BEAM
// ============================================================================

/// Reinforced masonry beam (lintel)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MasonryBeam {
    /// Width (mm)
    pub width: f64,
    /// Total depth (mm)
    pub depth: f64,
    /// Effective depth (mm)
    pub d: f64,
    /// Span (mm)
    pub span: f64,
    /// Tension steel area (mm²)
    pub as_tension: f64,
    /// Compression steel area (mm²)
    pub as_compression: f64,
    /// Steel yield strength (MPa)
    pub fy: f64,
    /// Masonry material
    pub material: MasonryMaterial,
}

impl MasonryBeam {
    /// Nominal moment capacity (kN·m)
    pub fn moment_capacity(&self) -> f64 {
        let a = self.as_tension * self.fy / (0.80 * self.material.fm * self.width);
        
        let phi = 0.9;
        let mn = self.as_tension * self.fy * (self.d - a / 2.0) / 1e6;
        
        phi * mn
    }
    
    /// Shear capacity (kN)
    pub fn shear_capacity(&self) -> f64 {
        let fv = 0.083 * self.material.fm.sqrt(); // MPa
        let phi = 0.8;
        
        phi * fv * self.width * self.d / 1000.0
    }
    
    /// Cracking moment (kN·m)
    pub fn cracking_moment(&self) -> f64 {
        let fr = 0.62 * self.material.fm.sqrt(); // Modulus of rupture
        let ig = self.width * self.depth.powi(3) / 12.0;
        let yt = self.depth / 2.0;
        
        fr * ig / (yt * 1e6)
    }
    
    /// Deflection at midspan under uniform load (mm)
    pub fn midspan_deflection(&self, w: f64) -> f64 {
        // w in kN/m, returns mm
        let l = self.span;
        let e = self.material.em * 1000.0; // kPa
        let i = self.width * self.depth.powi(3) / 12.0 / 1e12; // m⁴
        
        5.0 * w * l.powi(4) / (384.0 * e * i * 1e3)
    }
}

// ============================================================================
// MASONRY COLUMN
// ============================================================================

/// Reinforced masonry column
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MasonryColumn {
    /// Width (mm)
    pub width: f64,
    /// Depth (mm)
    pub depth: f64,
    /// Height (mm)
    pub height: f64,
    /// Total steel area (mm²)
    pub as_total: f64,
    /// Steel yield strength (MPa)
    pub fy: f64,
    /// Material
    pub material: MasonryMaterial,
    /// Grout fill
    pub grout_fill: GroutFill,
}

impl MasonryColumn {
    pub fn new(width: f64, depth: f64, height: f64, material: MasonryMaterial) -> Self {
        Self {
            width,
            depth,
            height,
            as_total: 0.0,
            fy: 420.0,
            material,
            grout_fill: GroutFill::FullyGrouted,
        }
    }
    
    /// Gross area (mm²)
    pub fn gross_area(&self) -> f64 {
        self.width * self.depth
    }
    
    /// Slenderness ratio
    pub fn slenderness(&self) -> f64 {
        let r = (self.depth / 12.0_f64.sqrt()).min(self.width / 12.0_f64.sqrt());
        self.height / r
    }
    
    /// Nominal axial capacity (kN)
    pub fn axial_capacity(&self) -> f64 {
        let an = self.gross_area() * 0.80; // Grouted
        let phi = 0.9;
        
        let pn = 0.80 * (0.80 * self.material.fm * (an - self.as_total) + self.fy * self.as_total);
        
        // Slenderness reduction
        let sr = self.slenderness();
        let r = if sr <= 99.0 {
            1.0 - (sr / 140.0).powi(2)
        } else {
            (70.0 / sr).powi(2)
        };
        
        phi * pn * r / 1000.0
    }
    
    /// Balanced axial load (kN)
    pub fn balanced_load(&self) -> f64 {
        let d = self.depth - 40.0;
        let epsilon_y = self.fy / (200_000.0); // Steel strain at yield
        let epsilon_mu = 0.0025; // Ultimate masonry strain
        
        let cb = epsilon_mu * d / (epsilon_mu + epsilon_y);
        let ab = 0.80 * cb;
        
        let cc = 0.80 * self.material.fm * ab * self.width;
        let cs = self.as_total / 2.0 * self.fy;
        let ts = self.as_total / 2.0 * self.fy;
        
        (cc + cs - ts) / 1000.0
    }
    
    /// P-M interaction (simplified)
    pub fn pm_interaction(&self, p: f64, m: f64) -> f64 {
        let p_cap = self.axial_capacity();
        let m_cap = self.moment_capacity();
        
        p / p_cap + m / m_cap
    }
    
    /// Nominal moment capacity (kN·m)
    pub fn moment_capacity(&self) -> f64 {
        let d = self.depth - 40.0;
        let a = self.as_total * self.fy / (0.80 * self.material.fm * self.width);
        
        let phi = 0.9;
        let mn = self.as_total * self.fy * (d - a / 2.0) / 1e6;
        
        phi * mn
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mortar_strength() {
        assert!((MortarType::TypeM.min_strength() - 17.2).abs() < 0.1);
        assert!((MortarType::TypeS.min_strength() - 12.4).abs() < 0.1);
    }

    #[test]
    fn test_masonry_material() {
        let mat = MasonryMaterial::standard_cmu();
        assert!((mat.fm - 13.8).abs() < 0.1);
        assert_eq!(mat.unit_type, MasonryUnitType::ConcreteMasonry);
    }

    #[test]
    fn test_elastic_modulus() {
        let mat = MasonryMaterial::standard_cmu();
        let expected = 900.0 * 13.8;
        assert!((mat.em - expected).abs() < 1.0);
    }

    #[test]
    fn test_wall_section() {
        let section = MasonryWallSection::standard_8inch();
        assert!((section.thickness - 203.0).abs() < 1.0);
        
        let sr = section.slenderness_ratio();
        assert!(sr > 10.0 && sr < 20.0);
    }

    #[test]
    fn test_section_properties() {
        let section = MasonryWallSection::standard_8inch();
        let area = section.gross_area();
        let i = section.moment_of_inertia();
        
        assert!(area > 0.0);
        assert!(i > 0.0);
    }

    #[test]
    fn test_aci530_slenderness() {
        let mat = MasonryMaterial::standard_cmu();
        let designer = Aci530Designer::new(mat);
        
        let r1 = designer.slenderness_factor(10.0);
        let r2 = designer.slenderness_factor(50.0);
        
        assert!(r1 > r2);
        assert!(r1 <= 1.0);
    }

    #[test]
    fn test_axial_capacity() {
        let mat = MasonryMaterial::standard_cmu();
        let section = MasonryWallSection::standard_8inch();
        let designer = Aci530Designer::new(mat);
        
        let p = designer.nominal_axial_capacity_sd(&section, 1.0);
        assert!(p > 0.0);
    }

    #[test]
    fn test_flexural_capacity() {
        let mat = MasonryMaterial::standard_cmu();
        let section = MasonryWallSection::standard_8inch();
        let designer = Aci530Designer::new(mat);
        
        let m = designer.nominal_flexural_capacity(&section);
        assert!(m > 0.0);
    }

    #[test]
    fn test_interaction_check() {
        let mat = MasonryMaterial::standard_cmu();
        let section = MasonryWallSection::standard_8inch();
        let designer = Aci530Designer::new(mat);
        
        let result = designer.check_interaction(&section, 100.0, 5.0);
        assert!(result.utilization > 0.0);
    }

    #[test]
    fn test_ec6_design() {
        let mat = MasonryMaterial::standard_clay_brick();
        let designer = Eurocode6Designer::new(mat);
        
        let fk = designer.characteristic_strength();
        let fd = designer.design_strength();
        
        assert!(fk > fd);
    }

    #[test]
    fn test_ec6_capacity_reduction() {
        let mat = MasonryMaterial::standard_clay_brick();
        let section = MasonryWallSection::standard_8inch();
        let designer = Eurocode6Designer::new(mat);
        
        let phi1 = designer.capacity_reduction(&section, 0.0);
        let phi2 = designer.capacity_reduction(&section, 20.0);
        
        assert!(phi1 > phi2);
    }

    #[test]
    fn test_is1905_design() {
        let mat = MasonryMaterial::standard_clay_brick();
        let section = MasonryWallSection::standard_8inch();
        let designer = Is1905Designer::new(mat);
        
        let fb = designer.basic_compressive_stress();
        let p = designer.allowable_load(&section, 0.0);
        
        assert!(fb > 0.0);
        assert!(p > 0.0);
    }

    #[test]
    fn test_masonry_beam() {
        let mat = MasonryMaterial::standard_cmu();
        let beam = MasonryBeam {
            width: 203.0,
            depth: 406.0,
            d: 356.0,
            span: 3000.0,
            as_tension: 400.0,
            as_compression: 0.0,
            fy: 420.0,
            material: mat,
        };
        
        let mn = beam.moment_capacity();
        let vn = beam.shear_capacity();
        
        assert!(mn > 0.0);
        assert!(vn > 0.0);
    }

    #[test]
    fn test_masonry_column() {
        let mat = MasonryMaterial::standard_cmu();
        let mut col = MasonryColumn::new(406.0, 406.0, 3000.0, mat);
        col.as_total = 800.0;
        
        let pn = col.axial_capacity();
        let mn = col.moment_capacity();
        
        assert!(pn > 0.0);
        assert!(mn > 0.0);
    }

    #[test]
    fn test_full_wall_design() {
        let mat = MasonryMaterial::standard_cmu();
        let section = MasonryWallSection::standard_12inch();
        let design = MasonryWallDesign::new(section, mat)
            .with_loads(200.0, 10.0, 30.0);
        
        let result = design.check_aci530();
        assert!(result.axial_capacity > 0.0);
        assert!(result.shear_capacity > 0.0);
    }

    #[test]
    fn test_ec6_wall_design() {
        let mat = MasonryMaterial::standard_clay_brick();
        let section = MasonryWallSection::standard_8inch();
        let design = MasonryWallDesign::new(section, mat)
            .with_loads(100.0, 5.0, 20.0);
        
        let result = design.check_ec6();
        assert!(result.code.contains("Eurocode"));
    }

    #[test]
    fn test_cracking_moment() {
        let mat = MasonryMaterial::standard_cmu();
        let beam = MasonryBeam {
            width: 203.0,
            depth: 406.0,
            d: 356.0,
            span: 3000.0,
            as_tension: 400.0,
            as_compression: 0.0,
            fy: 420.0,
            material: mat,
        };
        
        let mcr = beam.cracking_moment();
        assert!(mcr > 0.0);
    }
}
