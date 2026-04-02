//! Advanced Composite Design Module
//! 
//! Comprehensive steel-concrete composite design matching:
//! - SAP2000/ETABS composite frame design
//! - STAAD.Pro composite beam design
//! - RAM Structural System composite analysis
//!
//! Features:
//! - Composite beam design (AISC 360, EN 1994)
//! - Concrete-filled steel tube (CFST) columns
//! - Composite slab design with metal deck
//! - Shear connector design (headed studs)
//! - Partial composite action
//! - Long-term effects (creep, shrinkage)
//! - Fire resistance design

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

use crate::rebar_utils::circle_area;

// ============================================================================
// DESIGN CODE
// ============================================================================

/// Composite design code
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum CompositeDesignCode {
    /// AISC 360-22
    Aisc360,
    /// EN 1994-1-1 (Eurocode 4)
    En1994,
    /// IS 11384 (Indian Standard)
    Is11384,
    /// AS/NZS 2327
    AsNzs2327,
}

// ============================================================================
// MATERIAL PROPERTIES
// ============================================================================

/// Steel properties for composite design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompositeSteel {
    /// Yield strength Fy (MPa)
    pub fy: f64,
    /// Tensile strength Fu (MPa)
    pub fu: f64,
    /// Elastic modulus E (MPa)
    pub es: f64,
    /// Steel grade designation
    pub grade: String,
}

impl Default for CompositeSteel {
    fn default() -> Self {
        CompositeSteel {
            fy: 345.0,  // Grade 50
            fu: 450.0,
            es: 200_000.0,
            grade: "A992".to_string(),
        }
    }
}

/// Concrete properties for composite design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompositeConcrete {
    /// Compressive strength fc' (MPa)
    pub fc: f64,
    /// Elastic modulus Ec (MPa)
    pub ec: f64,
    /// Unit weight (kN/m³)
    pub unit_weight: f64,
    /// Is lightweight concrete
    pub is_lightweight: bool,
}

impl Default for CompositeConcrete {
    fn default() -> Self {
        let fc = 28.0;
        CompositeConcrete {
            fc,
            ec: 4700.0 * fc.sqrt(), // ACI formula
            unit_weight: 24.0,
            is_lightweight: false,
        }
    }
}

impl CompositeConcrete {
    pub fn new(fc: f64) -> Self {
        let ec = 4700.0 * fc.sqrt();
        CompositeConcrete {
            fc,
            ec,
            unit_weight: 24.0,
            is_lightweight: false,
        }
    }
    
    /// Modular ratio n = Es/Ec
    pub fn modular_ratio(&self, es: f64) -> f64 {
        es / self.ec
    }
}

// ============================================================================
// METAL DECK
// ============================================================================

/// Metal deck profile
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetalDeck {
    /// Deck designation
    pub name: String,
    /// Rib height hr (mm)
    pub rib_height: f64,
    /// Rib width wr at top (mm)
    pub rib_width_top: f64,
    /// Rib width at bottom (mm)
    pub rib_width_bottom: f64,
    /// Rib spacing (mm)
    pub rib_spacing: f64,
    /// Deck thickness (mm)
    pub thickness: f64,
    /// Deck yield strength (MPa)
    pub fy_deck: f64,
    /// Perpendicular or parallel to beam
    pub perpendicular: bool,
}

impl Default for MetalDeck {
    fn default() -> Self {
        MetalDeck {
            name: "3VLI-20".to_string(),
            rib_height: 76.0,
            rib_width_top: 152.0,
            rib_width_bottom: 51.0,
            rib_spacing: 305.0,
            thickness: 0.9,
            fy_deck: 230.0,
            perpendicular: true,
        }
    }
}

impl MetalDeck {
    /// Average rib width
    pub fn avg_rib_width(&self) -> f64 {
        (self.rib_width_top + self.rib_width_bottom) / 2.0
    }
    
    /// Rib ratio wr/hr
    pub fn rib_ratio(&self) -> f64 {
        self.avg_rib_width() / self.rib_height
    }
}

// ============================================================================
// COMPOSITE BEAM
// ============================================================================

/// Steel section for composite beam
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteelSection {
    /// Section designation
    pub name: String,
    /// Depth d (mm)
    pub depth: f64,
    /// Flange width bf (mm)
    pub bf: f64,
    /// Flange thickness tf (mm)
    pub tf: f64,
    /// Web thickness tw (mm)
    pub tw: f64,
    /// Cross-sectional area A (mm²)
    pub area: f64,
    /// Strong-axis moment of inertia Ix (mm⁴)
    pub ix: f64,
    /// Section modulus Sx (mm³)
    pub sx: f64,
    /// Plastic modulus Zx (mm³)
    pub zx: f64,
}

impl SteelSection {
    /// W530x92 (W21x62 equivalent)
    pub fn w530x92() -> Self {
        SteelSection {
            name: "W530x92".to_string(),
            depth: 533.0,
            bf: 209.0,
            tf: 15.6,
            tw: 10.2,
            area: 11_800.0,
            ix: 554_000_000.0,
            sx: 2_080_000.0,
            zx: 2_330_000.0,
        }
    }
    
    /// Compute plastic neutral axis in steel
    pub fn pna_steel(&self) -> f64 {
        self.depth / 2.0 // Symmetric section
    }
}

/// Composite beam definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompositeBeam {
    /// Beam ID
    pub id: String,
    /// Span length (m)
    pub span: f64,
    /// Steel section
    pub steel: SteelSection,
    /// Steel material
    pub steel_mat: CompositeSteel,
    /// Concrete material
    pub concrete: CompositeConcrete,
    /// Metal deck profile
    pub deck: MetalDeck,
    /// Total slab thickness above deck (mm)
    pub slab_thickness: f64,
    /// Effective flange width (mm)
    pub beff: f64,
    /// Number of shear studs
    pub n_studs: usize,
    /// Stud diameter (mm)
    pub stud_diameter: f64,
    /// Stud height after welding (mm)
    pub stud_height: f64,
    /// Is shored construction
    pub is_shored: bool,
}

impl CompositeBeam {
    pub fn new(id: &str, span: f64, steel: SteelSection) -> Self {
        let beff = (span * 1000.0 / 4.0).min(3000.0); // L/4 or 3m max
        
        CompositeBeam {
            id: id.to_string(),
            span,
            steel,
            steel_mat: CompositeSteel::default(),
            concrete: CompositeConcrete::default(),
            deck: MetalDeck::default(),
            slab_thickness: 75.0,
            beff,
            n_studs: 40,
            stud_diameter: 19.0,
            stud_height: 100.0,
            is_shored: false,
        }
    }
    
    /// Total depth of composite section
    pub fn total_depth(&self) -> f64 {
        self.steel.depth + self.deck.rib_height + self.slab_thickness
    }
    
    /// Concrete area above deck
    pub fn concrete_area(&self) -> f64 {
        self.beff * self.slab_thickness
    }
    
    /// Haunch height (for solid slab or filled ribs)
    pub fn haunch_height(&self) -> f64 {
        self.deck.rib_height
    }
}

// ============================================================================
// SHEAR STUD DESIGN
// ============================================================================

/// Shear stud capacity calculation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudCapacityResult {
    /// Nominal stud strength Qn (kN)
    pub qn: f64,
    /// Reduction factor for deck geometry Rg
    pub rg: f64,
    /// Reduction factor for stud position Rp
    pub rp: f64,
    /// Reduced stud strength (kN)
    pub qn_reduced: f64,
    /// Number of studs required
    pub n_required: usize,
    /// Degree of composite action (%)
    pub composite_ratio: f64,
}

/// Calculate shear stud strength per AISC 360
pub fn stud_strength_aisc(
    stud_dia: f64,  // mm
    stud_height: f64, // mm
    fu_stud: f64,   // MPa (typically 450 for ASTM A108)
    concrete: &CompositeConcrete,
    deck: &MetalDeck,
) -> StudCapacityResult {
    let asc = circle_area(stud_dia); // mm²
    let ec = concrete.ec; // MPa
    let fc = concrete.fc; // MPa
    
    // Basic stud strength (AISC I8-1)
    // Qn = 0.5*Asc*sqrt(f'c*Ec) ≤ Rg*Rp*Asc*Fu
    let qn1 = 0.5 * asc * (fc * ec).sqrt(); // N (concrete breakout)
    
    // Deck reduction factors
    let hr = deck.rib_height;
    let wr = deck.avg_rib_width();
    let hs = stud_height;
    
    // Rg - group effect factor
    let rg = if deck.perpendicular {
        if deck.rib_spacing > 300.0 { 1.0 }
        else { 0.85 }
    } else {
        // Parallel to beam
        let nr = 1; // Assume 1 stud per rib
        if nr == 1 { 1.0 } else { 0.85 }
    };
    
    // Rp - position effect factor
    let rp = if deck.perpendicular {
        let ratio = wr / hr;
        if ratio >= 1.5 && hs / hr >= 1.5 { 0.75 }
        else { 0.6 }
    } else {
        // Parallel to beam - stud in strong/weak position
        0.75 // Conservative
    };
    
    let qn2 = rg * rp * asc * fu_stud; // N (steel fracture, with reduction)
    let qn_base = qn1.min(qn2) / 1000.0; // kN (per AISC: Qn ≤ Rg*Rp*Asc*Fu)
    
    // Unreduced for reporting
    let qn_unreduced = (0.5 * asc * (fc * ec).sqrt()).min(asc * fu_stud) / 1000.0;
    
    StudCapacityResult {
        qn: qn_unreduced,
        rg,
        rp,
        qn_reduced: qn_base,
        n_required: 0,
        composite_ratio: 100.0,
    }
}

/// Calculate required number of studs for full composite action
pub fn studs_for_full_composite(
    beam: &CompositeBeam,
    stud_capacity: f64, // kN per stud
) -> usize {
    let fy = beam.steel_mat.fy;
    let fc = beam.concrete.fc;
    let as_steel = beam.steel.area;
    let ac = beam.concrete_area();
    
    // Compression force in concrete
    let c_concrete = 0.85 * fc * ac / 1000.0; // kN
    
    // Tension force in steel
    let t_steel = fy * as_steel / 1000.0; // kN
    
    // Horizontal shear = min(C, T)
    let vh = c_concrete.min(t_steel);
    
    // Number of studs = Vh / Qn
    let n_per_side = (vh / stud_capacity).ceil() as usize;
    
    n_per_side * 2 // Both sides of max moment
}

// ============================================================================
// COMPOSITE BEAM STRENGTH
// ============================================================================

/// Composite beam strength results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompositeBeamStrength {
    /// Plastic neutral axis location from top of steel (mm)
    pub pna_location: f64,
    /// PNA is in concrete (true) or steel (false)
    pub pna_in_concrete: bool,
    /// Nominal moment strength Mn (kN-m)
    pub mn: f64,
    /// Design moment strength φMn (kN-m)
    pub phi_mn: f64,
    /// Lower bound moment of inertia Ilb (mm⁴)
    pub i_lb: f64,
    /// Transformed moment of inertia Itr (mm⁴)
    pub i_tr: f64,
    /// Degree of composite action (%)
    pub composite_pct: f64,
}

/// Calculate composite beam plastic moment capacity
pub fn composite_beam_strength(
    beam: &CompositeBeam,
    stud_capacity: f64, // kN per stud
    code: CompositeDesignCode,
) -> CompositeBeamStrength {
    let fy = beam.steel_mat.fy;
    let fc = beam.concrete.fc;
    let es = beam.steel_mat.es;
    let ec = beam.concrete.ec;
    
    let as_steel = beam.steel.area;
    let ac = beam.concrete_area();
    let d = beam.steel.depth;
    let tc = beam.slab_thickness;
    let hr = beam.deck.rib_height;
    
    // Full composite forces
    let c_max = 0.85 * fc * ac / 1000.0; // kN
    let t_max = fy * as_steel / 1000.0; // kN
    
    // Actual horizontal shear (from studs)
    let n_studs_one_side = beam.n_studs / 2;
    let sum_qn = stud_capacity * n_studs_one_side as f64;
    
    // Degree of composite action
    let composite_pct = (sum_qn / c_max.min(t_max) * 100.0).min(100.0);
    
    // Compression force in slab
    let c_actual = sum_qn.min(c_max);
    
    // Determine PNA location
    let (pna_location, pna_in_concrete, mn) = if c_actual >= t_max {
        // PNA in concrete slab (full composite with C > T)
        let a = c_actual * 1000.0 / (0.85 * fc * beam.beff);
        let pna_loc = a;
        
        // Distance from centroid of steel to centroid of concrete compression block
        let y_conc = hr + tc - a / 2.0;
        let arm = d / 2.0 + y_conc;
        
        // Moment capacity (steel yielding, all tension in steel)
        let mp = t_max * arm / 1000.0; // kN-m
        
        (pna_loc, true, mp)
    } else {
        // PNA in steel (partial composite)
        // Concrete compression = c_actual
        // Steel above PNA in compression, steel below in tension
        
        let af = beam.steel.bf * beam.steel.tf;
        let deficit = t_max - c_actual; // Net force in steel = 2 * compression in steel above PNA
        let comp_steel_force = deficit / 2.0; // Force in compression part of steel
        
        // Approximate PNA location from top of steel
        let pna_steel = if comp_steel_force < fy * af / 1000.0 {
            // PNA in top flange
            comp_steel_force * 1000.0 / (fy * beam.steel.bf)
        } else {
            // PNA in web
            let flange_comp = fy * af / 1000.0;
            let web_comp = comp_steel_force - flange_comp;
            beam.steel.tf + web_comp * 1000.0 / (fy * beam.steel.tw)
        };
        
        // Moment capacity (simplified plastic stress distribution)
        // Concrete compression block at top
        let y_conc = hr + tc / 2.0;
        let arm_conc = d + y_conc - pna_steel;
        
        // Steel below PNA contributes tension, above contributes compression
        let mp_conc = c_actual * arm_conc / 1000.0;
        let mp_steel = beam.steel.zx * fy / 1_000_000.0; // Approximate plastic moment of steel
        
        let mp = mp_conc + mp_steel * 0.5; // Simplified
        
        (pna_steel, false, mp)
    };
    
    // Lower bound moment of inertia (for deflection)
    let n = es / ec;
    let atr = ac / n + as_steel;
    
    // Centroid of transformed section from bottom of steel
    let y_steel = d / 2.0;
    let y_conc = d + hr + tc / 2.0;
    let y_bar = (as_steel * y_steel + (ac / n) * y_conc) / atr;
    
    let i_steel = beam.steel.ix;
    let i_conc = beam.beff * tc.powi(3) / 12.0 / n;
    
    let i_tr = i_steel + as_steel * (y_bar - y_steel).powi(2) +
               i_conc + (ac / n) * (y_conc - y_bar).powi(2);
    
    // Lower bound inertia (AISC C-I3-2)
    let i_lb = beam.steel.ix + as_steel * (d / 2.0 + hr + tc / 2.0).powi(2) *
               (sum_qn / (c_max.min(t_max))).sqrt();
    
    // Resistance factor
    let phi = match code {
        CompositeDesignCode::Aisc360 => 0.90,
        CompositeDesignCode::En1994 => 1.0 / 1.25, // γM0
        _ => 0.90,
    };
    
    CompositeBeamStrength {
        pna_location,
        pna_in_concrete,
        mn,
        phi_mn: phi * mn,
        i_lb,
        i_tr,
        composite_pct,
    }
}

// ============================================================================
// CFST COLUMNS (CONCRETE-FILLED STEEL TUBES)
// ============================================================================

/// CFST section type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum CfstType {
    /// Circular section
    Circular,
    /// Square section
    Square,
    /// Rectangular section
    Rectangular,
}

/// Concrete-filled steel tube column
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CfstColumn {
    /// Column ID
    pub id: String,
    /// Section type
    pub section_type: CfstType,
    /// Outer dimension D (or B for rectangular) (mm)
    pub outer_dim: f64,
    /// Second dimension H for rectangular (mm)
    pub outer_dim_2: Option<f64>,
    /// Wall thickness t (mm)
    pub wall_thickness: f64,
    /// Unbraced length (m)
    pub length: f64,
    /// Effective length factor K
    pub k_factor: f64,
    /// Steel material
    pub steel: CompositeSteel,
    /// Concrete material
    pub concrete: CompositeConcrete,
    /// Internal reinforcement area (mm²)
    pub as_internal: f64,
}

impl CfstColumn {
    pub fn new_circular(id: &str, diameter: f64, thickness: f64, length: f64) -> Self {
        CfstColumn {
            id: id.to_string(),
            section_type: CfstType::Circular,
            outer_dim: diameter,
            outer_dim_2: None,
            wall_thickness: thickness,
            length,
            k_factor: 1.0,
            steel: CompositeSteel::default(),
            concrete: CompositeConcrete::default(),
            as_internal: 0.0,
        }
    }
    
    pub fn new_square(id: &str, width: f64, thickness: f64, length: f64) -> Self {
        CfstColumn {
            id: id.to_string(),
            section_type: CfstType::Square,
            outer_dim: width,
            outer_dim_2: None,
            wall_thickness: thickness,
            length,
            k_factor: 1.0,
            steel: CompositeSteel::default(),
            concrete: CompositeConcrete::default(),
            as_internal: 0.0,
        }
    }
    
    /// Steel tube area
    pub fn steel_area(&self) -> f64 {
        let d = self.outer_dim;
        let t = self.wall_thickness;
        
        match self.section_type {
            CfstType::Circular => PI * (d.powi(2) - (d - 2.0 * t).powi(2)) / 4.0,
            CfstType::Square => d.powi(2) - (d - 2.0 * t).powi(2),
            CfstType::Rectangular => {
                let h = self.outer_dim_2.unwrap_or(d);
                d * h - (d - 2.0 * t) * (h - 2.0 * t)
            }
        }
    }
    
    /// Concrete core area
    pub fn concrete_area(&self) -> f64 {
        let d = self.outer_dim;
        let t = self.wall_thickness;
        
        match self.section_type {
            CfstType::Circular => PI * (d - 2.0 * t).powi(2) / 4.0,
            CfstType::Square => (d - 2.0 * t).powi(2),
            CfstType::Rectangular => {
                let h = self.outer_dim_2.unwrap_or(d);
                (d - 2.0 * t) * (h - 2.0 * t)
            }
        }
    }
    
    /// D/t ratio for local buckling check
    pub fn dt_ratio(&self) -> f64 {
        self.outer_dim / self.wall_thickness
    }
    
    /// Moment of inertia of steel tube
    pub fn steel_inertia(&self) -> f64 {
        let d = self.outer_dim;
        let t = self.wall_thickness;
        let di = d - 2.0 * t;
        
        match self.section_type {
            CfstType::Circular => PI * (d.powi(4) - di.powi(4)) / 64.0,
            CfstType::Square | CfstType::Rectangular => {
                let h = self.outer_dim_2.unwrap_or(d);
                let hi = h - 2.0 * t;
                (d * h.powi(3) - di * hi.powi(3)) / 12.0
            }
        }
    }
    
    /// Moment of inertia of concrete core
    pub fn concrete_inertia(&self) -> f64 {
        let d = self.outer_dim;
        let t = self.wall_thickness;
        let di = d - 2.0 * t;
        
        match self.section_type {
            CfstType::Circular => PI * di.powi(4) / 64.0,
            CfstType::Square | CfstType::Rectangular => {
                let h = self.outer_dim_2.unwrap_or(d);
                let hi = h - 2.0 * t;
                di * hi.powi(3) / 12.0
            }
        }
    }
}

/// CFST column strength results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CfstStrength {
    /// Nominal axial strength Po (kN)
    pub pn0: f64,
    /// Critical buckling load Pcr (kN)
    pub pcr: f64,
    /// Nominal compressive strength Pn (kN)
    pub pn: f64,
    /// Design compressive strength φPn (kN)
    pub phi_pn: f64,
    /// Nominal moment strength Mn (kN-m)
    pub mn: f64,
    /// Design moment strength φMn (kN-m)
    pub phi_mn: f64,
    /// D/t limit check
    pub dt_ok: bool,
    /// Confinement factor ξ
    pub confinement: f64,
}

/// Calculate CFST column strength per AISC 360
pub fn cfst_strength_aisc(column: &CfstColumn) -> CfstStrength {
    let as_steel = column.steel_area();
    let ac = column.concrete_area();
    let fy = column.steel.fy;
    let fc = column.concrete.fc;
    let es = column.steel.es;
    let ec = column.concrete.ec;
    
    let is = column.steel_inertia();
    let ic = column.concrete_inertia();
    
    // Slenderness parameter
    let d = column.outer_dim;
    let t = column.wall_thickness;
    let dt = d / t;
    
    // D/t limits
    let lambda_p = 0.15 * es / fy;
    let lambda_r = 0.19 * es / fy;
    let dt_ok = match column.section_type {
        CfstType::Circular => dt <= lambda_r,
        _ => dt <= 2.26 * (es / fy).sqrt(),
    };
    
    // C2 factor for filled tubes
    let c2 = match column.section_type {
        CfstType::Circular => {
            if dt <= lambda_p { 0.95 }
            else if dt <= lambda_r { 0.95 - (0.95 - 0.70) * (dt - lambda_p) / (lambda_r - lambda_p) }
            else { 0.70 }
        }
        _ => 0.85, // Rectangular
    };
    
    // Squash load Po (AISC I2-4)
    let pp = fy * as_steel + c2 * fc * ac;
    let pn0 = pp / 1000.0; // kN
    
    // Effective stiffness (AISC I2-6)
    let c1 = 0.25 + 3.0 * (as_steel / (ac + as_steel));
    let ei_eff = es * is + c1 * ec * ic;
    
    // Critical buckling load
    let kl = column.k_factor * column.length * 1000.0; // mm
    let pe = PI.powi(2) * ei_eff / kl.powi(2);
    let pcr = pe / 1000.0; // kN
    
    // Nominal strength with stability
    let lambda_c = pp / pe;
    let pn = if lambda_c <= 2.25 {
        pp * 0.658_f64.powf(lambda_c)
    } else {
        0.877 * pe
    } / 1000.0;
    
    // Resistance factor
    let phi_c = 0.75;
    let phi_pn = phi_c * pn;
    
    // Moment strength (simplified plastic)
    let zs = match column.section_type {
        CfstType::Circular => {
            let di = d - 2.0 * t;
            (d.powi(3) - di.powi(3)) / 6.0
        }
        _ => {
            let h = column.outer_dim_2.unwrap_or(d);
            d * h.powi(2) / 4.0 - (d - 2.0 * t) * (h - 2.0 * t).powi(2) / 4.0
        }
    };
    
    let zc = match column.section_type {
        CfstType::Circular => {
            let di = d - 2.0 * t;
            di.powi(3) / 6.0
        }
        _ => {
            let di = d - 2.0 * t;
            let hi = column.outer_dim_2.unwrap_or(d) - 2.0 * t;
            di * hi.powi(2) / 4.0
        }
    };
    
    let mp = (fy * zs + 0.5 * fc * zc) / 1_000_000.0; // kN-m
    let phi_b = 0.90;
    
    // Confinement factor
    let xi = (as_steel * fy) / (ac * fc);
    
    CfstStrength {
        pn0,
        pcr,
        pn,
        phi_pn,
        mn: mp,
        phi_mn: phi_b * mp,
        dt_ok,
        confinement: xi,
    }
}

// ============================================================================
// COMPOSITE SLAB DESIGN
// ============================================================================

/// Composite slab definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompositeSlab {
    /// Slab ID
    pub id: String,
    /// Metal deck profile
    pub deck: MetalDeck,
    /// Total slab thickness (mm)
    pub total_thickness: f64,
    /// Concrete above deck tc (mm)
    pub concrete_above_deck: f64,
    /// Concrete material
    pub concrete: CompositeConcrete,
    /// Reinforcement bar diameter (mm)
    pub rebar_dia: f64,
    /// Reinforcement spacing (mm)
    pub rebar_spacing: f64,
    /// Cover to reinforcement (mm)
    pub cover: f64,
    /// Span (m)
    pub span: f64,
    /// Is continuous (more than 1 span)
    pub is_continuous: bool,
}

impl CompositeSlab {
    pub fn new(id: &str, span: f64) -> Self {
        let deck = MetalDeck::default();
        let tc = 75.0;
        CompositeSlab {
            id: id.to_string(),
            deck: deck.clone(),
            total_thickness: deck.rib_height + tc,
            concrete_above_deck: tc,
            concrete: CompositeConcrete::default(),
            rebar_dia: 10.0,
            rebar_spacing: 200.0,
            cover: 20.0,
            span,
            is_continuous: false,
        }
    }
    
    /// Effective depth
    pub fn effective_depth(&self) -> f64 {
        self.total_thickness - self.cover - self.rebar_dia / 2.0
    }
    
    /// Reinforcement ratio
    pub fn rho(&self) -> f64 {
        let as_bar = PI * self.rebar_dia.powi(2) / 4.0;
        let as_per_m = as_bar * 1000.0 / self.rebar_spacing;
        as_per_m / (self.effective_depth() * 1000.0)
    }
}

/// Composite slab strength results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlabStrengthResult {
    /// Positive moment capacity (kN-m/m)
    pub m_positive: f64,
    /// Negative moment capacity (kN-m/m)
    pub m_negative: f64,
    /// Shear capacity (kN/m)
    pub v_capacity: f64,
    /// Deflection check L/span_ratio
    pub deflection_ratio: f64,
    /// Fire rating (hours)
    pub fire_rating: f64,
}

/// Calculate composite slab capacity
pub fn composite_slab_strength(slab: &CompositeSlab, fy_rebar: f64) -> SlabStrengthResult {
    let fc = slab.concrete.fc;
    let tc = slab.concrete_above_deck;
    let hr = slab.deck.rib_height;
    let d = slab.effective_depth();
    
    // Reinforcement area per meter
    let as_bar = PI * slab.rebar_dia.powi(2) / 4.0;
    let as_per_m = as_bar * 1000.0 / slab.rebar_spacing;
    
    // Positive moment (T-beam behavior over ribs)
    // Conservative: use solid slab above deck
    let a = as_per_m * fy_rebar / (0.85 * fc * 1000.0);
    let m_pos = as_per_m * fy_rebar * (d - a / 2.0) / 1_000_000.0; // kN-m/m
    
    // Negative moment (solid slab at supports)
    let d_neg = hr + tc - slab.cover - slab.rebar_dia / 2.0;
    let m_neg = as_per_m * fy_rebar * (d_neg - a / 2.0) / 1_000_000.0;
    
    // Shear capacity (simplified)
    let v_c = 0.17 * fc.sqrt() * 1000.0 * d / 1000.0; // kN/m
    
    // Deflection ratio (approximate)
    let ec = slab.concrete.ec;
    let i_eff = 1000.0 * (tc + hr * 0.5).powi(3) / 12.0; // Approximate
    let _ei = ec * i_eff;
    let deflection_ratio = slab.span * 1000.0 / (d * 20.0);
    
    // Fire rating (based on cover and slab thickness)
    let fire_rating = if slab.concrete_above_deck >= 90.0 && slab.cover >= 25.0 {
        2.0
    } else if slab.concrete_above_deck >= 70.0 && slab.cover >= 20.0 {
        1.5
    } else {
        1.0
    };
    
    SlabStrengthResult {
        m_positive: m_pos,
        m_negative: m_neg,
        v_capacity: v_c,
        deflection_ratio,
        fire_rating,
    }
}

// ============================================================================
// LONG-TERM EFFECTS
// ============================================================================

/// Long-term effects on composite section
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LongTermEffects {
    /// Creep coefficient φ
    pub creep_coefficient: f64,
    /// Shrinkage strain εsh
    pub shrinkage_strain: f64,
    /// Age-adjusted modular ratio
    pub n_eff: f64,
    /// Long-term moment of inertia (mm⁴)
    pub i_long_term: f64,
    /// Additional deflection from creep (mm)
    pub creep_deflection: f64,
    /// Stress increase in steel from creep
    pub steel_stress_increase: f64,
}

/// Calculate long-term effects per EN 1994
pub fn long_term_effects(
    beam: &CompositeBeam,
    short_term_itr: f64,
    sustained_moment: f64, // kN-m
) -> LongTermEffects {
    let es = beam.steel_mat.es;
    let ec = beam.concrete.ec;
    let n_0 = es / ec;
    
    // Typical creep coefficient (50% RH, loading at 28 days)
    let phi_28 = 2.0;
    
    // Shrinkage strain (mm/mm)
    let eps_sh = 400e-6;
    
    // Age-adjusted modular ratio
    let chi = 0.8; // Aging coefficient
    let n_l = n_0 * (1.0 + phi_28 * chi);
    
    // Long-term transformed properties
    let as_steel = beam.steel.area;
    let ac = beam.concrete_area();
    let d = beam.steel.depth;
    let hr = beam.deck.rib_height;
    let tc = beam.slab_thickness;
    
    // Long-term transformed area
    let atr_lt = ac / n_l + as_steel;
    
    // Centroid
    let y_steel = d / 2.0;
    let y_conc = d + hr + tc / 2.0;
    let y_bar_lt = (as_steel * y_steel + (ac / n_l) * y_conc) / atr_lt;
    
    // Long-term inertia
    let i_steel = beam.steel.ix;
    let i_conc_lt = beam.beff * tc.powi(3) / 12.0 / n_l;
    let i_lt = i_steel + as_steel * (y_bar_lt - y_steel).powi(2) +
               i_conc_lt + (ac / n_l) * (y_conc - y_bar_lt).powi(2);
    
    // Creep deflection increase
    let creep_factor = (short_term_itr / i_lt) - 1.0;
    let span = beam.span * 1000.0; // mm
    let delta_creep = 5.0 * sustained_moment * 1_000_000.0 * span.powi(2) / 
                      (384.0 * es * i_lt) * creep_factor;
    
    // Stress redistribution to steel
    let stress_increase = (phi_28 / (1.0 + phi_28 * chi)) * 
                          sustained_moment * 1_000_000.0 * (y_conc - y_bar_lt) / i_lt;
    
    LongTermEffects {
        creep_coefficient: phi_28,
        shrinkage_strain: eps_sh,
        n_eff: n_l,
        i_long_term: i_lt,
        creep_deflection: delta_creep,
        steel_stress_increase: stress_increase,
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_stud_strength() {
        let concrete = CompositeConcrete::new(28.0);
        let deck = MetalDeck::default();
        
        let result = stud_strength_aisc(19.0, 100.0, 450.0, &concrete, &deck);
        
        // 19mm stud should have capacity around 80-120 kN
        assert!(result.qn > 50.0);
        assert!(result.qn_reduced > 0.0);
        assert!(result.qn_reduced <= result.qn);
        assert!(result.rg <= 1.0);
        assert!(result.rp <= 1.0);
    }
    
    #[test]
    fn test_composite_beam_strength() {
        let steel = SteelSection::w530x92();
        let beam = CompositeBeam::new("CB1", 9.0, steel);
        
        let stud_cap = stud_strength_aisc(
            beam.stud_diameter,
            beam.stud_height,
            450.0,
            &beam.concrete,
            &beam.deck,
        );
        
        let result = composite_beam_strength(&beam, stud_cap.qn_reduced, CompositeDesignCode::Aisc360);
        
        // Composite beam should have higher capacity than steel alone
        let mp_steel = beam.steel.zx * beam.steel_mat.fy / 1_000_000.0;
        assert!(result.mn > mp_steel);
        assert!(result.phi_mn < result.mn);
        assert!(result.i_tr > beam.steel.ix);
    }
    
    #[test]
    fn test_cfst_circular() {
        let column = CfstColumn::new_circular("C1", 400.0, 12.0, 4.0);
        
        assert!(column.steel_area() > 0.0);
        assert!(column.concrete_area() > 0.0);
        assert!(column.dt_ratio() < 50.0);
        
        let result = cfst_strength_aisc(&column);
        
        assert!(result.pn0 > 0.0);
        assert!(result.pn <= result.pn0);
        assert!(result.phi_pn < result.pn);
        assert!(result.dt_ok);
        assert!(result.confinement > 0.0);
    }
    
    #[test]
    fn test_cfst_square() {
        let column = CfstColumn::new_square("C2", 350.0, 10.0, 3.5);
        
        let result = cfst_strength_aisc(&column);
        
        assert!(result.pn0 > 0.0);
        assert!(result.mn > 0.0);
    }
    
    #[test]
    fn test_composite_slab() {
        let slab = CompositeSlab::new("S1", 3.0);
        
        let result = composite_slab_strength(&slab, 500.0);
        
        assert!(result.m_positive > 0.0);
        assert!(result.v_capacity > 0.0);
        assert!(result.fire_rating >= 1.0);
    }
    
    #[test]
    fn test_studs_required() {
        let steel = SteelSection::w530x92();
        let beam = CompositeBeam::new("CB1", 10.0, steel);
        
        let stud_cap = 80.0; // kN
        let n_req = studs_for_full_composite(&beam, stud_cap);
        
        // Should need significant number of studs for full composite
        assert!(n_req > 20);
        assert!(n_req < 200);
    }
    
    #[test]
    fn test_long_term_effects() {
        let steel = SteelSection::w530x92();
        let beam = CompositeBeam::new("CB1", 9.0, steel);
        
        let i_tr = 800_000_000.0; // Approximate
        let effects = long_term_effects(&beam, i_tr, 200.0);
        
        assert!(effects.creep_coefficient > 0.0);
        assert!(effects.n_eff > beam.steel_mat.es / beam.concrete.ec);
        assert!(effects.i_long_term > 0.0);
    }
    
    #[test]
    fn test_deck_reduction_factors() {
        let concrete = CompositeConcrete::new(30.0);
        
        // Perpendicular deck
        let mut deck = MetalDeck::default();
        deck.perpendicular = true;
        let result1 = stud_strength_aisc(19.0, 125.0, 450.0, &concrete, &deck);
        
        // Parallel deck
        deck.perpendicular = false;
        let result2 = stud_strength_aisc(19.0, 125.0, 450.0, &concrete, &deck);
        
        // Both should have reasonable reduction factors
        assert!(result1.rg > 0.5 && result1.rg <= 1.0);
        assert!(result2.rg > 0.5 && result2.rg <= 1.0);
    }
    
    #[test]
    fn test_modular_ratio() {
        let concrete = CompositeConcrete::new(28.0);
        let n = concrete.modular_ratio(200_000.0);
        
        // Typical n is 6-10 for normal concrete
        assert!(n > 5.0 && n < 15.0);
    }
}
