// ============================================================================
// COMPOSITE DECK DESIGN MODULE
// Steel Deck Institute (SDI) & AISC 360 Composite Design
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// DECK PROFILES & MATERIALS
// ============================================================================

/// Standard metal deck profiles
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum DeckProfile {
    /// 1.5" deep, 6" pitch (1.5VLI, Verco B-Deck)
    Deck15_6,
    /// 2" deep, 12" pitch (2VLI, common composite)
    Deck2_12,
    /// 3" deep, 12" pitch (3VLI, long span)
    Deck3_12,
    /// 3" deep, 9" pitch (3N, narrow rib)
    Deck3_9,
    /// Custom profile
    Custom,
}

/// Deck gauge (thickness)
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum DeckGauge {
    Gauge22, // 0.0295"
    Gauge20, // 0.0358"
    Gauge18, // 0.0474"
    Gauge16, // 0.0598"
}

impl DeckGauge {
    /// Get thickness in mm
    pub fn thickness_mm(&self) -> f64 {
        match self {
            DeckGauge::Gauge22 => 0.749,
            DeckGauge::Gauge20 => 0.909,
            DeckGauge::Gauge18 => 1.204,
            DeckGauge::Gauge16 => 1.519,
        }
    }
    
    /// Get thickness in inches
    pub fn thickness_in(&self) -> f64 {
        match self {
            DeckGauge::Gauge22 => 0.0295,
            DeckGauge::Gauge20 => 0.0358,
            DeckGauge::Gauge18 => 0.0474,
            DeckGauge::Gauge16 => 0.0598,
        }
    }
}

/// Metal deck properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetalDeckProps {
    pub profile: DeckProfile,
    pub gauge: DeckGauge,
    /// Rib depth (mm)
    pub rib_depth: f64,
    /// Rib width at top (mm)
    pub rib_width_top: f64,
    /// Rib width at bottom (mm)
    pub rib_width_bottom: f64,
    /// Rib spacing/pitch (mm)
    pub rib_spacing: f64,
    /// Deck yield strength (MPa)
    pub fy_deck: f64,
    /// Deck area per unit width (mm²/m)
    pub area_per_width: f64,
    /// Deck moment of inertia per unit width (mm⁴/m)
    pub inertia_per_width: f64,
    /// Section modulus per unit width (mm³/m)
    pub section_modulus: f64,
}

impl MetalDeckProps {
    /// Create standard 2" composite deck
    pub fn standard_2in(gauge: DeckGauge) -> Self {
        let t = gauge.thickness_mm();
        
        Self {
            profile: DeckProfile::Deck2_12,
            gauge,
            rib_depth: 50.8,        // 2"
            rib_width_top: 152.4,   // 6" average
            rib_width_bottom: 50.8, // 2"
            rib_spacing: 304.8,     // 12"
            fy_deck: 230.0,         // 33 ksi typical
            area_per_width: 1200.0 * t / 0.909, // Scaled from 20ga
            inertia_per_width: 150000.0 * t / 0.909,
            section_modulus: 5900.0 * t / 0.909,
        }
    }
    
    /// Create standard 3" composite deck
    pub fn standard_3in(gauge: DeckGauge) -> Self {
        let t = gauge.thickness_mm();
        
        Self {
            profile: DeckProfile::Deck3_12,
            gauge,
            rib_depth: 76.2,        // 3"
            rib_width_top: 177.8,   // 7" average
            rib_width_bottom: 63.5, // 2.5"
            rib_spacing: 304.8,     // 12"
            fy_deck: 230.0,
            area_per_width: 1400.0 * t / 0.909,
            inertia_per_width: 280000.0 * t / 0.909,
            section_modulus: 7300.0 * t / 0.909,
        }
    }
    
    /// Create standard 1.5" deck
    pub fn standard_15in(gauge: DeckGauge) -> Self {
        let t = gauge.thickness_mm();
        
        Self {
            profile: DeckProfile::Deck15_6,
            gauge,
            rib_depth: 38.1,        // 1.5"
            rib_width_top: 76.2,    // 3" average
            rib_width_bottom: 25.4, // 1"
            rib_spacing: 152.4,     // 6"
            fy_deck: 230.0,
            area_per_width: 1000.0 * t / 0.909,
            inertia_per_width: 65000.0 * t / 0.909,
            section_modulus: 4300.0 * t / 0.909,
        }
    }
}

/// Concrete properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConcreteProps {
    /// Compressive strength f'c (MPa)
    pub fc: f64,
    /// Unit weight (kN/m³)
    pub unit_weight: f64,
    /// Elastic modulus (MPa)
    pub ec: f64,
}

impl ConcreteProps {
    /// Normal weight concrete
    pub fn normal_weight(fc: f64) -> Self {
        let wc = 23.5; // kN/m³
        let ec = 4700.0 * fc.sqrt(); // ACI formula
        Self { fc, unit_weight: wc, ec }
    }
    
    /// Lightweight concrete
    pub fn lightweight(fc: f64) -> Self {
        let wc = 18.0; // kN/m³
        let ec = 3300.0 * fc.sqrt(); // Reduced modulus
        Self { fc, unit_weight: wc, ec }
    }
}

// ============================================================================
// COMPOSITE SLAB DESIGN
// ============================================================================

/// Composite slab designer (SDI Method)
#[derive(Debug, Clone)]
pub struct CompositeSlabDesigner {
    pub deck: MetalDeckProps,
    pub concrete: ConcreteProps,
    /// Total slab thickness (mm)
    pub total_thickness: f64,
    /// Concrete cover above ribs (mm)
    pub cover_above_ribs: f64,
    /// Steel beam spacing (mm)
    pub beam_spacing: f64,
    /// Span length (mm)
    pub span: f64,
    /// Simple or continuous
    pub is_continuous: bool,
}

impl CompositeSlabDesigner {
    pub fn new(
        deck: MetalDeckProps,
        concrete: ConcreteProps,
        total_thickness: f64,
        beam_spacing: f64,
        span: f64,
    ) -> Self {
        let cover_above_ribs = total_thickness - deck.rib_depth;
        
        Self {
            deck,
            concrete,
            total_thickness,
            cover_above_ribs,
            beam_spacing,
            span,
            is_continuous: false,
        }
    }
    
    /// Calculate construction stage capacity (unshored)
    /// SDI Section 3
    pub fn construction_capacity(&self) -> ConstructionResult {
        let l = self.span / 1000.0; // Convert to m
        let _b = 1.0; // Per meter width
        
        // Deck moment capacity
        let mn_deck = self.deck.section_modulus * self.deck.fy_deck / 1e6; // kNm/m
        let phi_mn = 0.90 * mn_deck;
        
        // Construction loads
        let w_deck = self.deck_weight();
        let w_conc = self.wet_concrete_weight();
        let w_const = 0.96; // 20 psf construction load
        let w_total = w_deck + w_conc + w_const;
        
        // Required moment (simple span)
        let mu = w_total * l.powi(2) / 8.0;
        
        // Deflection check
        let e_deck = 203000.0; // MPa
        let i_deck = self.deck.inertia_per_width / 1e12; // m⁴/m
        let delta = 5.0 * w_total * l.powi(4) / (384.0 * e_deck * 1e6 * i_deck);
        let delta_limit = l / 180.0; // L/180 for construction
        
        // Shear capacity
        let vn = 0.6 * self.deck.fy_deck * self.deck.area_per_width / 1000.0; // kN/m
        let vu = w_total * l / 2.0;
        
        ConstructionResult {
            w_deck: w_deck,
            w_wet_concrete: w_conc,
            w_construction: w_const,
            w_total,
            mu_required: mu,
            mn_available: mn_deck,
            phi_mn,
            moment_ratio: mu / phi_mn,
            deflection: delta * 1000.0, // mm
            deflection_limit: delta_limit * 1000.0,
            deflection_ratio: delta / delta_limit,
            vu_required: vu,
            vn_available: vn,
            shear_ratio: vu / (0.90 * vn),
            pass_strength: mu <= phi_mn,
            pass_deflection: delta <= delta_limit,
            pass_shear: vu <= 0.90 * vn,
        }
    }
    
    /// Calculate composite slab strength (SDI Method)
    /// Based on empirical coefficients from deck manufacturer tests
    pub fn composite_strength(&self, m_test: f64, k_test: f64) -> CompositeSlabResult {
        let l = self.span / 1000.0; // m
        let d = self.total_thickness - self.deck.rib_depth / 2.0; // Effective depth (mm)
        let _t = self.deck.gauge.thickness_mm();
        
        // SDI shear-bond strength (Eq 5.4-1)
        // Mn = k₁ × As × fy × d + k₂ × b × d² × √f'c × (m/l + k)
        // Simplified version using test coefficients
        
        let as_deck = self.deck.area_per_width; // mm²/m
        let b = 1000.0; // mm (per meter width)
        
        // Positive moment capacity (composite)
        let mn_comp = m_test * as_deck * d / (l * 1000.0) + k_test * b * d;
        
        // Check against full plastic capacity
        let a = as_deck * self.deck.fy_deck / (0.85 * self.concrete.fc * b);
        let mn_plastic = as_deck * self.deck.fy_deck * (d - a / 2.0) / 1e6;
        
        let mn = mn_comp.min(mn_plastic);
        let phi_mn = 0.90 * mn;
        
        // Service loads
        let w_dead = self.dead_load();
        let w_live = 2.4; // Assume 50 psf live load
        let w_total = w_dead + w_live;
        let mu = w_total * l.powi(2) / 8.0;
        
        // Deflection
        let ie = self.effective_inertia();
        let n = self.modular_ratio();
        let delta_dead = 5.0 * w_dead * l.powi(4) / (384.0 * self.concrete.ec * 1e6 * ie);
        let delta_live = 5.0 * w_live * l.powi(4) / (384.0 * self.concrete.ec * 1e6 * ie);
        let delta_total = delta_dead + delta_live;
        
        CompositeSlabResult {
            effective_depth: d,
            stress_block_depth: a,
            mn_shear_bond: mn_comp,
            mn_plastic,
            mn_nominal: mn,
            phi_mn,
            mu_required: mu,
            moment_ratio: mu / phi_mn,
            delta_dead: delta_dead * 1000.0,
            delta_live: delta_live * 1000.0,
            delta_total: delta_total * 1000.0,
            modular_ratio: n,
            effective_inertia: ie * 1e12, // mm⁴/m
            pass: mu <= phi_mn,
        }
    }
    
    /// Calculate one-way shear capacity
    pub fn shear_capacity(&self) -> f64 {
        let d = self.total_thickness - self.deck.rib_depth / 2.0;
        let b = 1000.0; // Per meter width
        
        // Concrete shear capacity (ACI 318)
        let vc = 0.17 * self.concrete.fc.sqrt() * b * d / 1000.0; // kN/m
        0.75 * vc
    }
    
    /// Calculate punching shear capacity (for concentrated loads)
    pub fn punching_shear(&self, load_area: f64, pu: f64) -> PunchingResult {
        let d = self.total_thickness - self.deck.rib_depth / 2.0;
        let fc = self.concrete.fc;
        
        // Critical perimeter (d/2 from load)
        let bo = 4.0 * (load_area.sqrt() + d);
        
        // ACI punching shear
        let vc = 0.33 * fc.sqrt() * bo * d / 1000.0; // kN
        let phi_vc = 0.75 * vc;
        
        PunchingResult {
            critical_perimeter: bo,
            effective_depth: d,
            vc_nominal: vc,
            phi_vc,
            pu_applied: pu,
            ratio: pu / phi_vc,
            pass: pu <= phi_vc,
        }
    }
    
    /// Fire rating check (based on concrete cover)
    pub fn fire_rating(&self) -> u32 {
        let cover = self.cover_above_ribs;
        
        // Based on IBC/SDI fire rating tables
        if cover >= 114.0 { // 4.5"
            4 // 4-hour rating
        } else if cover >= 89.0 { // 3.5"
            3 // 3-hour rating
        } else if cover >= 64.0 { // 2.5"
            2 // 2-hour rating
        } else if cover >= 38.0 { // 1.5"
            1 // 1-hour rating
        } else {
            0 // Unrated
        }
    }
    
    /// Calculate deck weight per unit area (kN/m²)
    fn deck_weight(&self) -> f64 {
        // Approximate based on gauge
        match self.deck.gauge {
            DeckGauge::Gauge22 => 0.088,
            DeckGauge::Gauge20 => 0.107,
            DeckGauge::Gauge18 => 0.141,
            DeckGauge::Gauge16 => 0.178,
        }
    }
    
    /// Calculate wet concrete weight (kN/m²)
    fn wet_concrete_weight(&self) -> f64 {
        // Average thickness including ribs
        let avg_thickness = self.cover_above_ribs 
            + self.deck.rib_depth * (self.deck.rib_width_top + self.deck.rib_width_bottom) 
            / (2.0 * self.deck.rib_spacing);
        
        self.concrete.unit_weight * avg_thickness / 1000.0
    }
    
    /// Calculate dead load (kN/m²)
    fn dead_load(&self) -> f64 {
        self.deck_weight() + self.wet_concrete_weight()
    }
    
    /// Calculate modular ratio
    fn modular_ratio(&self) -> f64 {
        let es = 200000.0; // Steel modulus
        es / self.concrete.ec
    }
    
    /// Calculate cracked/effective moment of inertia
    fn effective_inertia(&self) -> f64 {
        let n = self.modular_ratio();
        let d = (self.total_thickness - self.deck.rib_depth / 2.0) / 1000.0; // m
        let b = 1.0; // per meter width
        let as_deck = self.deck.area_per_width / 1e6; // m²/m
        
        // Cracked section analysis
        let c = n * as_deck / b * 
            ((1.0 + 2.0 * b * d / (n * as_deck)).sqrt() - 1.0);
        
        // Cracked moment of inertia
        b * c.powi(3) / 3.0 + n * as_deck * (d - c).powi(2)
    }
}

// ============================================================================
// COMPOSITE BEAM DESIGN (AISC 360)
// ============================================================================

/// Composite beam designer
#[derive(Debug, Clone)]
pub struct CompositeBeamDesigner {
    /// Steel beam section properties
    pub steel: SteelBeamProps,
    /// Deck properties
    pub deck: MetalDeckProps,
    /// Concrete properties  
    pub concrete: ConcreteProps,
    /// Total slab thickness (mm)
    pub slab_thickness: f64,
    /// Beam spacing (mm)
    pub beam_spacing: f64,
    /// Beam span (mm)
    pub span: f64,
    /// Stud diameter (mm)
    pub stud_diameter: f64,
    /// Stud height after welding (mm)
    pub stud_height: f64,
    /// Number of studs per rib
    pub studs_per_rib: u32,
    /// Deck perpendicular to beam
    pub deck_perpendicular: bool,
}

/// Steel beam section properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteelBeamProps {
    /// Designation
    pub name: String,
    /// Depth (mm)
    pub d: f64,
    /// Flange width (mm)
    pub bf: f64,
    /// Flange thickness (mm)
    pub tf: f64,
    /// Web thickness (mm)
    pub tw: f64,
    /// Area (mm²)
    pub area: f64,
    /// Moment of inertia Ix (mm⁴)
    pub ix: f64,
    /// Section modulus Sx (mm³)
    pub sx: f64,
    /// Plastic modulus Zx (mm³)
    pub zx: f64,
    /// Yield strength (MPa)
    pub fy: f64,
}

impl CompositeBeamDesigner {
    /// Calculate full composite beam strength
    pub fn full_composite_strength(&self) -> CompositeBeamResult {
        let fc = self.concrete.fc;
        let fy = self.steel.fy;
        let as_steel = self.steel.area;
        
        // Effective slab width (AISC I3.1a)
        let b_eff = self.effective_width();
        
        // Concrete above deck
        let tc = self.slab_thickness - self.deck.rib_depth;
        
        // Full composite: C = T
        let t_max = as_steel * fy; // Max steel tension
        let c_max = 0.85 * fc * b_eff * tc; // Max concrete compression
        
        // PNA location and capacity
        let (pna_location, mn) = if c_max >= t_max {
            // PNA in slab
            let a = t_max / (0.85 * fc * b_eff);
            let y_arm = self.steel.d / 2.0 + self.deck.rib_depth + tc - a / 2.0;
            ("Slab".to_string(), t_max * y_arm / 1e6)
        } else {
            // PNA in steel
            let c_slab = c_max;
            let t_remaining = t_max - c_slab;
            // Simplified - assumes PNA in web
            let y_arm = self.steel.d / 2.0 + self.deck.rib_depth + tc / 2.0;
            ("Steel".to_string(), (c_slab * y_arm + t_remaining * self.steel.d / 4.0) / 1e6)
        };
        
        let phi_mn = 0.90 * mn;
        
        // Stud requirements
        let qn = self.stud_strength();
        let n_studs_req = (t_max.min(c_max) / qn).ceil() as u32;
        
        CompositeBeamResult {
            effective_width: b_eff,
            concrete_force: c_max / 1000.0,
            steel_force: t_max / 1000.0,
            pna_location,
            mn_nominal: mn,
            phi_mn,
            stud_strength: qn / 1000.0,
            studs_required: n_studs_req,
            degree_of_composite: 100.0,
        }
    }
    
    /// Calculate partial composite beam strength
    pub fn partial_composite_strength(&self, n_studs: u32) -> CompositeBeamResult {
        let fc = self.concrete.fc;
        let fy = self.steel.fy;
        let as_steel = self.steel.area;
        
        let b_eff = self.effective_width();
        let tc = self.slab_thickness - self.deck.rib_depth;
        
        // Shear connection force
        let qn = self.stud_strength();
        let v_prime = (n_studs as f64) * qn;
        
        // Limits
        let t_max = as_steel * fy;
        let c_max = 0.85 * fc * b_eff * tc;
        
        // Degree of composite action
        let v_min = t_max.min(c_max);
        let degree = (v_prime / v_min * 100.0).min(100.0);
        
        // Check minimum 25%
        if degree < 25.0 {
            // Below minimum - use non-composite
            return CompositeBeamResult {
                effective_width: b_eff,
                concrete_force: 0.0,
                steel_force: t_max / 1000.0,
                pna_location: "Non-composite".to_string(),
                mn_nominal: self.steel.zx * fy / 1e6,
                phi_mn: 0.90 * self.steel.zx * fy / 1e6,
                stud_strength: qn / 1000.0,
                studs_required: n_studs,
                degree_of_composite: degree,
            };
        }
        
        // Partial composite moment
        let c_actual = v_prime.min(c_max);
        let a = c_actual / (0.85 * fc * b_eff);
        let _y_arm = self.steel.d / 2.0 + self.deck.rib_depth + tc - a / 2.0;
        
        // Steel contribution
        let mp_steel = self.steel.zx * fy / 1e6;
        
        // Interpolate between Mp and full composite
        let mn_full = self.full_composite_strength().mn_nominal;
        let mn = mp_steel + (v_prime / v_min) * (mn_full - mp_steel);
        
        CompositeBeamResult {
            effective_width: b_eff,
            concrete_force: c_actual / 1000.0,
            steel_force: v_prime / 1000.0,
            pna_location: "Partial composite".to_string(),
            mn_nominal: mn,
            phi_mn: 0.90 * mn,
            stud_strength: qn / 1000.0,
            studs_required: n_studs,
            degree_of_composite: degree,
        }
    }
    
    /// Calculate deflection
    pub fn deflection(&self, w_dead: f64, w_live: f64) -> DeflectionResult {
        let l = self.span / 1000.0; // m
        let e_steel = 200000.0; // MPa
        
        // Lower bound moment of inertia (AISC I3.2)
        let i_steel = self.steel.ix / 1e12; // m⁴
        let i_lb = self.lower_bound_inertia() / 1e12;
        
        // Construction deflection (steel only)
        let delta_const = 5.0 * w_dead * l.powi(4) / (384.0 * e_steel * 1e6 * i_steel);
        
        // Live load deflection (composite)
        let delta_live = 5.0 * w_live * l.powi(4) / (384.0 * e_steel * 1e6 * i_lb);
        
        // Total
        let delta_total = delta_const + delta_live;
        
        DeflectionResult {
            i_steel: self.steel.ix,
            i_composite: i_lb * 1e12,
            delta_construction: delta_const * 1000.0,
            delta_live: delta_live * 1000.0,
            delta_total: delta_total * 1000.0,
            l_over_360: l / 360.0 * 1000.0,
            l_over_240: l / 240.0 * 1000.0,
            pass_live: delta_live <= l / 360.0,
            pass_total: delta_total <= l / 240.0,
        }
    }
    
    /// Calculate shear strength
    pub fn shear_capacity(&self) -> f64 {
        let aw = self.steel.d * self.steel.tw;
        let cv = 1.0; // For most rolled shapes
        let vn = 0.6 * self.steel.fy * aw * cv / 1000.0; // kN
        0.90 * vn
    }
    
    /// Effective slab width (AISC I3.1a)
    fn effective_width(&self) -> f64 {
        let b1 = self.span / 8.0;           // 1/8 span each side
        let b2 = self.beam_spacing / 2.0;   // Half beam spacing
        
        let b_eff_one_side = b1.min(b2);
        2.0 * b_eff_one_side // Total (both sides)
    }
    
    /// Stud shear strength (AISC I8.2a)
    fn stud_strength(&self) -> f64 {
        let d = self.stud_diameter;
        let fu = 450.0; // 65 ksi typical for studs
        let fc = self.concrete.fc;
        let ec = self.concrete.ec;
        
        // Basic strength
        let qn_basic = 0.5 * PI * d.powi(2) / 4.0 * (fc * ec).sqrt();
        let qn_rupture = PI * d.powi(2) / 4.0 * fu;
        
        let qn = qn_basic.min(qn_rupture);
        
        // Deck reduction factor (AISC I8.2a)
        let rg = if self.deck_perpendicular {
            // Deck perpendicular to beam
            let hr = self.deck.rib_depth;
            let hs = self.stud_height;
            let wr = (self.deck.rib_width_top + self.deck.rib_width_bottom) / 2.0;
            
            let rp = (0.85 / (self.studs_per_rib as f64).sqrt())
                * (wr / hr) * ((hs / hr) - 1.0);
            rp.min(1.0).max(0.6)
        } else {
            // Deck parallel to beam
            1.0
        };
        
        rg * qn
    }
    
    /// Lower bound moment of inertia for deflection
    fn lower_bound_inertia(&self) -> f64 {
        let n = 200000.0 / self.concrete.ec; // Modular ratio
        let b_eff = self.effective_width();
        let tc = self.slab_thickness - self.deck.rib_depth;
        
        // Transformed section
        let ac = b_eff * tc / n; // Transformed concrete area
        let as_steel = self.steel.area;
        
        // Centroid from bottom of steel
        let y_steel = self.steel.d / 2.0;
        let y_conc = self.steel.d + self.deck.rib_depth + tc / 2.0;
        let y_bar = (as_steel * y_steel + ac * y_conc) / (as_steel + ac);
        
        // Moment of inertia
        let i_steel = self.steel.ix + as_steel * (y_bar - y_steel).powi(2);
        let i_conc = b_eff * tc.powi(3) / (12.0 * n) + ac * (y_conc - y_bar).powi(2);
        
        i_steel + i_conc
    }
}

// ============================================================================
// RESULT STRUCTURES
// ============================================================================

/// Construction stage result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConstructionResult {
    pub w_deck: f64,
    pub w_wet_concrete: f64,
    pub w_construction: f64,
    pub w_total: f64,
    pub mu_required: f64,
    pub mn_available: f64,
    pub phi_mn: f64,
    pub moment_ratio: f64,
    pub deflection: f64,
    pub deflection_limit: f64,
    pub deflection_ratio: f64,
    pub vu_required: f64,
    pub vn_available: f64,
    pub shear_ratio: f64,
    pub pass_strength: bool,
    pub pass_deflection: bool,
    pub pass_shear: bool,
}

/// Composite slab result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompositeSlabResult {
    pub effective_depth: f64,
    pub stress_block_depth: f64,
    pub mn_shear_bond: f64,
    pub mn_plastic: f64,
    pub mn_nominal: f64,
    pub phi_mn: f64,
    pub mu_required: f64,
    pub moment_ratio: f64,
    pub delta_dead: f64,
    pub delta_live: f64,
    pub delta_total: f64,
    pub modular_ratio: f64,
    pub effective_inertia: f64,
    pub pass: bool,
}

/// Punching shear result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PunchingResult {
    pub critical_perimeter: f64,
    pub effective_depth: f64,
    pub vc_nominal: f64,
    pub phi_vc: f64,
    pub pu_applied: f64,
    pub ratio: f64,
    pub pass: bool,
}

/// Composite beam result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompositeBeamResult {
    pub effective_width: f64,
    pub concrete_force: f64,
    pub steel_force: f64,
    pub pna_location: String,
    pub mn_nominal: f64,
    pub phi_mn: f64,
    pub stud_strength: f64,
    pub studs_required: u32,
    pub degree_of_composite: f64,
}

/// Deflection result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeflectionResult {
    pub i_steel: f64,
    pub i_composite: f64,
    pub delta_construction: f64,
    pub delta_live: f64,
    pub delta_total: f64,
    pub l_over_360: f64,
    pub l_over_240: f64,
    pub pass_live: bool,
    pub pass_total: bool,
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deck_properties() {
        let deck = MetalDeckProps::standard_2in(DeckGauge::Gauge20);
        
        assert!((deck.rib_depth - 50.8).abs() < 0.1);
        assert!(deck.area_per_width > 1000.0);
        assert!(deck.inertia_per_width > 100000.0);
    }

    #[test]
    fn test_concrete_properties() {
        let conc = ConcreteProps::normal_weight(28.0);
        
        assert!((conc.fc - 28.0).abs() < 0.1);
        assert!(conc.ec > 20000.0);
        assert!((conc.unit_weight - 23.5).abs() < 0.1);
    }

    #[test]
    fn test_construction_capacity() {
        let deck = MetalDeckProps::standard_2in(DeckGauge::Gauge20);
        let conc = ConcreteProps::normal_weight(28.0);
        let designer = CompositeSlabDesigner::new(deck, conc, 130.0, 3000.0, 2500.0);
        
        let result = designer.construction_capacity();
        
        assert!(result.w_total > 0.0);
        assert!(result.mn_available > 0.0);
        assert!(result.moment_ratio > 0.0);
    }

    #[test]
    fn test_composite_slab_strength() {
        let deck = MetalDeckProps::standard_2in(DeckGauge::Gauge20);
        let conc = ConcreteProps::normal_weight(28.0);
        let designer = CompositeSlabDesigner::new(deck, conc, 130.0, 3000.0, 2500.0);
        
        // Typical m and k values from deck manufacturer
        let result = designer.composite_strength(0.5, 100.0);
        
        assert!(result.mn_nominal > 0.0);
        assert!(result.phi_mn > 0.0);
    }

    #[test]
    fn test_punching_shear() {
        let deck = MetalDeckProps::standard_2in(DeckGauge::Gauge20);
        let conc = ConcreteProps::normal_weight(28.0);
        let designer = CompositeSlabDesigner::new(deck, conc, 130.0, 3000.0, 2500.0);
        
        let result = designer.punching_shear(10000.0, 50.0); // 100x100mm load, 50 kN
        
        assert!(result.critical_perimeter > 0.0);
        assert!(result.phi_vc > 0.0);
    }

    #[test]
    fn test_fire_rating() {
        let deck = MetalDeckProps::standard_2in(DeckGauge::Gauge20);
        let conc = ConcreteProps::normal_weight(28.0);
        
        // 130mm total, 2" deck = ~80mm cover - should be 2-hour
        let designer = CompositeSlabDesigner::new(deck, conc, 130.0, 3000.0, 2500.0);
        assert!(designer.fire_rating() >= 2);
        
        // 150mm total = ~100mm cover - should be 3-hour
        let designer2 = CompositeSlabDesigner::new(
            MetalDeckProps::standard_2in(DeckGauge::Gauge20),
            ConcreteProps::normal_weight(28.0),
            150.0, 3000.0, 2500.0);
        assert!(designer2.fire_rating() >= 3);
    }

    #[test]
    fn test_composite_beam_strength() {
        let steel = SteelBeamProps {
            name: "W18x35".to_string(),
            d: 450.0,
            bf: 152.0,
            tf: 10.8,
            tw: 7.6,
            area: 6645.0,
            ix: 2.16e8,
            sx: 9.6e5,
            zx: 1.09e6,
            fy: 345.0,
        };
        
        let deck = MetalDeckProps::standard_2in(DeckGauge::Gauge20);
        let conc = ConcreteProps::normal_weight(28.0);
        
        let designer = CompositeBeamDesigner {
            steel,
            deck,
            concrete: conc,
            slab_thickness: 130.0,
            beam_spacing: 3000.0,
            span: 9000.0,
            stud_diameter: 19.0,
            stud_height: 100.0,
            studs_per_rib: 1,
            deck_perpendicular: true,
        };
        
        let result = designer.full_composite_strength();
        
        assert!(result.effective_width > 0.0);
        assert!(result.mn_nominal > 0.0);
        assert!(result.studs_required > 0);
    }

    #[test]
    fn test_partial_composite() {
        let steel = SteelBeamProps {
            name: "W16x31".to_string(),
            d: 400.0,
            bf: 140.0,
            tf: 10.0,
            tw: 7.0,
            area: 5935.0,
            ix: 1.56e8,
            sx: 7.8e5,
            zx: 8.85e5,
            fy: 345.0,
        };
        
        let deck = MetalDeckProps::standard_2in(DeckGauge::Gauge20);
        let conc = ConcreteProps::normal_weight(28.0);
        
        let designer = CompositeBeamDesigner {
            steel,
            deck,
            concrete: conc,
            slab_thickness: 130.0,
            beam_spacing: 3000.0,
            span: 9000.0,
            stud_diameter: 19.0,
            stud_height: 100.0,
            studs_per_rib: 1,
            deck_perpendicular: true,
        };
        
        // Test with reduced studs
        let full = designer.full_composite_strength();
        let partial = designer.partial_composite_strength(full.studs_required / 2);
        
        assert!(partial.degree_of_composite < 100.0);
        assert!(partial.mn_nominal < full.mn_nominal);
    }

    #[test]
    fn test_deflection() {
        let steel = SteelBeamProps {
            name: "W18x35".to_string(),
            d: 450.0,
            bf: 152.0,
            tf: 10.8,
            tw: 7.6,
            area: 6645.0,
            ix: 2.16e8,
            sx: 9.6e5,
            zx: 1.09e6,
            fy: 345.0,
        };
        
        let deck = MetalDeckProps::standard_2in(DeckGauge::Gauge20);
        let conc = ConcreteProps::normal_weight(28.0);
        
        let designer = CompositeBeamDesigner {
            steel,
            deck,
            concrete: conc,
            slab_thickness: 130.0,
            beam_spacing: 3000.0,
            span: 9000.0,
            stud_diameter: 19.0,
            stud_height: 100.0,
            studs_per_rib: 1,
            deck_perpendicular: true,
        };
        
        let result = designer.deflection(5.0, 3.0);
        
        assert!(result.i_composite > result.i_steel);
        assert!(result.delta_total > 0.0);
        assert!(result.l_over_360 > 0.0);
    }

    #[test]
    fn test_deck_gauges() {
        assert!((DeckGauge::Gauge22.thickness_mm() - 0.749).abs() < 0.01);
        assert!((DeckGauge::Gauge20.thickness_mm() - 0.909).abs() < 0.01);
        assert!((DeckGauge::Gauge18.thickness_mm() - 1.204).abs() < 0.01);
        assert!((DeckGauge::Gauge16.thickness_mm() - 1.519).abs() < 0.01);
    }
}
