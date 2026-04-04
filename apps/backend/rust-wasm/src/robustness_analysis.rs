// ============================================================================
// ROBUSTNESS & PROGRESSIVE COLLAPSE ANALYSIS MODULE
// Alternate load path, key element, tie force methods - GSA, UFC, Eurocode
// ============================================================================

use serde::{Deserialize, Serialize};

// ============================================================================
// ROBUSTNESS CLASS
// ============================================================================

/// Building risk category (UFC 4-023-03)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RiskCategory {
    /// Low occupancy: <50 people
    I,
    /// Standard occupancy
    II,
    /// High occupancy: >300 people, public assembly
    III,
    /// Essential facilities, high risk
    IV,
}

impl RiskCategory {
    /// Consequence class (Eurocode)
    pub fn consequence_class(&self) -> &'static str {
        match self {
            RiskCategory::I => "CC1",
            RiskCategory::II => "CC2a",
            RiskCategory::III => "CC2b",
            RiskCategory::IV => "CC3",
        }
    }
    
    /// Required analysis level
    pub fn analysis_level(&self) -> &'static str {
        match self {
            RiskCategory::I => "None",
            RiskCategory::II => "Tie forces",
            RiskCategory::III => "Alternate load path",
            RiskCategory::IV => "Enhanced local resistance",
        }
    }
}

/// Structural redundancy level
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RedundancyLevel {
    /// No redundancy
    None,
    /// Limited redundancy
    Limited,
    /// Moderate redundancy
    Moderate,
    /// High redundancy
    High,
}

// ============================================================================
// TIE FORCE METHOD
// ============================================================================

/// Direction of tie force
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TieDirection {
    /// Internal longitudinal ties
    InternalLongitudinal,
    /// Internal transverse ties
    InternalTransverse,
    /// Peripheral (edge) ties
    Peripheral,
    /// Vertical ties
    Vertical,
}

/// Tie force requirements
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TieForceRequirement {
    /// Floor load (kN/m²)
    pub floor_load: f64,
    /// Bay width/span (m)
    pub span: f64,
    /// Number of stories
    pub num_stories: u32,
    /// Floor-to-floor height (m)
    pub story_height: f64,
}

impl TieForceRequirement {
    pub fn new(floor_load: f64, span: f64, num_stories: u32, story_height: f64) -> Self {
        Self { floor_load, span, num_stories, story_height }
    }
    
    /// Characteristic tie force (kN/m) - GSA/UFC method
    fn basic_tie_strength(&self) -> f64 {
        let w = self.floor_load; // kN/m²
        let l = self.span;
        
        // Ti = 0.5 × (1.0D + 0.5L) × L (simplified)
        0.5 * w * l
    }
    
    /// Internal tie force (kN/m)
    pub fn internal_tie(&self) -> f64 {
        let ti = self.basic_tie_strength();
        ti.max(75.0) // Minimum 75 kN/m
    }
    
    /// Peripheral tie force (kN)
    pub fn peripheral_tie(&self) -> f64 {
        let ft = self.internal_tie() * self.span;
        ft.max(75.0) // Minimum 75 kN total
    }
    
    /// Vertical tie force (kN)
    pub fn vertical_tie(&self) -> f64 {
        // Greatest of column loads above
        let tributary = self.span.powi(2);
        let load_per_floor = self.floor_load * tributary;
        
        (load_per_floor * 2.5).max(self.num_stories as f64 * load_per_floor * 0.1)
    }
    
    /// Required rebar area for tie (mm²)
    pub fn rebar_for_tie(&self, tie_force: f64) -> f64 {
        let fy = 500.0; // MPa
        let gamma_s = 1.15;
        
        tie_force * 1000.0 / (fy / gamma_s)
    }
}

// ============================================================================
// ALTERNATE LOAD PATH ANALYSIS
// ============================================================================

/// Column removal scenario
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RemovalLocation {
    /// Corner column
    Corner,
    /// Edge column (not corner)
    Edge,
    /// Interior column
    Interior,
    /// Below transfer beam/slab
    BelowTransfer,
}

impl RemovalLocation {
    /// Dynamic amplification factor
    pub fn daf(&self) -> f64 {
        match self {
            RemovalLocation::Corner => 2.0,
            RemovalLocation::Edge => 2.0,
            RemovalLocation::Interior => 2.0,
            RemovalLocation::BelowTransfer => 2.0,
        }
    }
    
    /// Criticality factor
    pub fn criticality(&self) -> f64 {
        match self {
            RemovalLocation::Corner => 1.0,
            RemovalLocation::Edge => 1.2,
            RemovalLocation::Interior => 1.5,
            RemovalLocation::BelowTransfer => 1.8,
        }
    }
}

/// Alternate load path analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlternateLoadPath {
    /// Removal location
    pub location: RemovalLocation,
    /// Column axial load before removal (kN)
    pub column_load: f64,
    /// Beam span adjacent to removed column (m)
    pub beam_span: f64,
    /// Beam depth (mm)
    pub beam_depth: f64,
    /// Floor load (kN/m²)
    pub floor_load: f64,
    /// Slab thickness (mm)
    pub slab_thickness: f64,
}

impl AlternateLoadPath {
    pub fn new(location: RemovalLocation, column_load: f64, beam_span: f64) -> Self {
        Self {
            location,
            column_load,
            beam_span,
            beam_depth: beam_span * 50.0, // L/20 typical
            floor_load: 10.0,
            slab_thickness: 200.0,
        }
    }
    
    /// Effective doubled span after removal
    pub fn effective_span(&self) -> f64 {
        2.0 * self.beam_span
    }
    
    /// Load combination for progressive collapse (kN/m)
    pub fn design_load(&self) -> f64 {
        // UFC: 1.2D + 0.5L (or 0.2S)
        let w = self.floor_load;
        (1.2 * w * 0.7 + 0.5 * w * 0.3) * self.beam_span // Tributary
    }
    
    /// Amplified load with DAF (kN/m)
    pub fn amplified_load(&self) -> f64 {
        self.design_load() * self.location.daf()
    }
    
    /// Required catenary tension (kN)
    pub fn catenary_tension(&self) -> f64 {
        let w = self.amplified_load();
        let l = self.effective_span();
        let sag = l / 20.0; // Assume 5% sag
        
        w * l.powi(2) / (8.0 * sag)
    }
    
    /// Beam rotation demand (radians)
    pub fn rotation_demand(&self) -> f64 {
        let l = self.effective_span();
        let sag = l / 20.0;
        
        2.0 * sag / l
    }
    
    /// Check if rotation is acceptable
    pub fn rotation_acceptable(&self) -> bool {
        // UFC limit: 0.2 rad for steel, 0.1 rad for RC
        self.rotation_demand() < 0.1
    }
    
    /// Demand/capacity ratio
    pub fn dcr(&self, beam_capacity: f64) -> f64 {
        self.catenary_tension() / beam_capacity
    }
}

// ============================================================================
// KEY ELEMENT DESIGN
// ============================================================================

/// Key element - element whose failure leads to disproportionate collapse
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyElement {
    /// Element type
    pub element_type: KeyElementType,
    /// Notional removal area (m²)
    pub removal_area: f64,
    /// Number of floors affected
    pub floors_affected: u32,
    /// Total floor area (m²)
    pub total_floor_area: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum KeyElementType {
    Column,
    TransferBeam,
    LoadBearingWall,
    Truss,
    BracingMember,
}

impl KeyElement {
    pub fn new(element_type: KeyElementType, removal_area: f64, floors: u32) -> Self {
        Self {
            element_type,
            removal_area,
            floors_affected: floors,
            total_floor_area: removal_area * floors as f64,
        }
    }
    
    /// Is this a key element? (>15% or 70m² per floor)
    pub fn is_key_element(&self) -> bool {
        let limit_per_floor = 70.0; // m²
        self.removal_area > limit_per_floor || self.removal_area / 100.0 > 0.15
    }
    
    /// Required accidental load (kN/m²) - 34 kN/m² typical
    pub fn accidental_load(&self) -> f64 {
        34.0 // GSA/UFC standard
    }
    
    /// Total accidental load on element (kN)
    pub fn total_accidental_force(&self) -> f64 {
        self.accidental_load() * self.removal_area
    }
    
    /// Enhanced resistance factor
    pub fn resistance_factor(&self) -> f64 {
        match self.element_type {
            KeyElementType::Column => 1.5,
            KeyElementType::TransferBeam => 1.5,
            KeyElementType::LoadBearingWall => 1.3,
            KeyElementType::Truss => 1.5,
            KeyElementType::BracingMember => 1.4,
        }
    }
}

// ============================================================================
// CATENARY/MEMBRANE ACTION
// ============================================================================

/// Catenary action in beams
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatenaryAction {
    /// Span (m)
    pub span: f64,
    /// Reinforcement area (mm²)
    pub rebar_area: f64,
    /// Steel yield strength (MPa)
    pub fy: f64,
    /// Allowable deflection (m)
    pub max_deflection: f64,
}

impl CatenaryAction {
    pub fn new(span: f64, rebar_area: f64) -> Self {
        Self {
            span,
            rebar_area,
            fy: 500.0,
            max_deflection: span * 0.05, // L/20
        }
    }
    
    /// Maximum catenary force (kN)
    pub fn max_catenary_force(&self) -> f64 {
        self.rebar_area * self.fy / 1000.0
    }
    
    /// Deflection at catenary action (m)
    pub fn catenary_deflection(&self) -> f64 {
        // Geometric: large deformation
        self.max_deflection
    }
    
    /// Rotation at catenary action (radians)
    pub fn catenary_rotation(&self) -> f64 {
        2.0 * self.max_deflection / self.span
    }
    
    /// Load carried by catenary action (kN/m)
    pub fn catenary_load_capacity(&self) -> f64 {
        let t = self.max_catenary_force();
        let delta = self.max_deflection;
        
        8.0 * t * delta / self.span.powi(2)
    }
}

/// Membrane action in slabs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MembraneAction {
    /// Slab panel length (m)
    pub length: f64,
    /// Slab panel width (m)
    pub width: f64,
    /// Slab thickness (mm)
    pub thickness: f64,
    /// Bottom rebar area (mm²/m)
    pub bottom_rebar: f64,
    /// Top rebar area (mm²/m)
    pub top_rebar: f64,
}

impl MembraneAction {
    pub fn new(length: f64, width: f64, thickness: f64) -> Self {
        let min_rebar = 0.0013 * thickness * 1000.0; // Minimum 0.13%
        
        Self {
            length,
            width,
            thickness,
            bottom_rebar: min_rebar,
            top_rebar: min_rebar,
        }
    }
    
    /// Panel aspect ratio
    pub fn aspect_ratio(&self) -> f64 {
        self.length / self.width
    }
    
    /// Short span
    pub fn short_span(&self) -> f64 {
        self.length.min(self.width)
    }
    
    /// Maximum membrane deflection (m)
    pub fn membrane_deflection(&self) -> f64 {
        self.short_span() * 0.1 // 10% of short span
    }
    
    /// Tensile membrane capacity (kN/m)
    pub fn membrane_capacity(&self) -> f64 {
        let fy = 500.0;
        (self.bottom_rebar + self.top_rebar) * fy / 1000.0
    }
    
    /// Enhanced load capacity with membrane action (kN/m²)
    pub fn enhanced_capacity(&self) -> f64 {
        let t = self.membrane_capacity();
        let delta = self.membrane_deflection();
        
        // Bailey's method approximation
        let l = self.short_span();
        let enhancement = 1.0 + 8.0 * delta / l;
        
        // Base capacity + membrane
        let w_base = 8.0 * t * self.thickness / 1000.0 / l.powi(2) * 30.0; // Simplified
        w_base * enhancement
    }
}

// ============================================================================
// REDUNDANCY ASSESSMENT
// ============================================================================

/// Structure redundancy assessment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedundancyAssessment {
    /// Number of vertical load paths
    pub vertical_paths: u32,
    /// Number of lateral load paths
    pub lateral_paths: u32,
    /// Is structure braced?
    pub is_braced: bool,
    /// Number of continuous tie lines
    pub tie_lines: u32,
    /// Ductility class
    pub ductility: DuctilityClass,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DuctilityClass {
    Low,
    Medium,
    High,
}

impl RedundancyAssessment {
    pub fn new(vertical_paths: u32, lateral_paths: u32, is_braced: bool) -> Self {
        Self {
            vertical_paths,
            lateral_paths,
            is_braced,
            tie_lines: vertical_paths.min(lateral_paths),
            ductility: DuctilityClass::Medium,
        }
    }
    
    /// Redundancy level
    pub fn redundancy_level(&self) -> RedundancyLevel {
        if self.vertical_paths <= 2 || self.lateral_paths <= 1 {
            RedundancyLevel::None
        } else if self.vertical_paths <= 4 || !self.is_braced {
            RedundancyLevel::Limited
        } else if self.vertical_paths <= 8 {
            RedundancyLevel::Moderate
        } else {
            RedundancyLevel::High
        }
    }
    
    /// Redundancy factor (for seismic design)
    pub fn redundancy_factor(&self) -> f64 {
        match self.redundancy_level() {
            RedundancyLevel::None => 1.5,
            RedundancyLevel::Limited => 1.3,
            RedundancyLevel::Moderate => 1.1,
            RedundancyLevel::High => 1.0,
        }
    }
    
    /// Robustness score (0-100)
    pub fn robustness_score(&self) -> f64 {
        let mut score = 0.0;
        
        // Vertical paths (max 30)
        score += (self.vertical_paths.min(10) as f64) * 3.0;
        
        // Lateral paths (max 20)
        score += (self.lateral_paths.min(4) as f64) * 5.0;
        
        // Bracing (20)
        if self.is_braced { score += 20.0; }
        
        // Tie lines (max 20)
        score += (self.tie_lines.min(10) as f64) * 2.0;
        
        // Ductility (max 10)
        score += match self.ductility {
            DuctilityClass::Low => 3.0,
            DuctilityClass::Medium => 6.0,
            DuctilityClass::High => 10.0,
        };
        
        score.min(100.0)
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_risk_category() {
        assert_eq!(RiskCategory::III.consequence_class(), "CC2b");
    }

    #[test]
    fn test_tie_forces() {
        let ties = TieForceRequirement::new(10.0, 8.0, 10, 3.5);
        
        assert!(ties.internal_tie() >= 75.0);
        assert!(ties.peripheral_tie() >= 75.0);
    }

    #[test]
    fn test_vertical_tie() {
        let ties = TieForceRequirement::new(10.0, 8.0, 10, 3.5);
        let vt = ties.vertical_tie();
        
        assert!(vt > 0.0);
    }

    #[test]
    fn test_rebar_for_tie() {
        let ties = TieForceRequirement::new(10.0, 8.0, 10, 3.5);
        let as_req = ties.rebar_for_tie(100.0);
        
        assert!(as_req > 200.0); // ~230 mm²
    }

    #[test]
    fn test_alternate_load_path() {
        let alp = AlternateLoadPath::new(RemovalLocation::Interior, 2000.0, 8.0);
        
        assert!((alp.effective_span() - 16.0).abs() < 0.1);
    }

    #[test]
    fn test_catenary_tension() {
        let alp = AlternateLoadPath::new(RemovalLocation::Interior, 2000.0, 8.0);
        let tension = alp.catenary_tension();
        
        assert!(tension > 0.0);
    }

    #[test]
    fn test_rotation_demand() {
        let alp = AlternateLoadPath::new(RemovalLocation::Interior, 2000.0, 8.0);
        
        assert!(alp.rotation_demand() < 0.2);
    }

    #[test]
    fn test_key_element() {
        let ke = KeyElement::new(KeyElementType::Column, 100.0, 5);
        
        assert!(ke.is_key_element());
    }

    #[test]
    fn test_accidental_load() {
        let ke = KeyElement::new(KeyElementType::Column, 100.0, 5);
        
        assert!((ke.accidental_load() - 34.0).abs() < 0.1);
    }

    #[test]
    fn test_catenary_action() {
        let cat = CatenaryAction::new(8.0, 2000.0);
        
        assert!(cat.max_catenary_force() > 900.0);
    }

    #[test]
    fn test_catenary_rotation() {
        let cat = CatenaryAction::new(8.0, 2000.0);
        
        assert!(cat.catenary_rotation() < 0.15);
    }

    #[test]
    fn test_membrane_action() {
        let mem = MembraneAction::new(8.0, 8.0, 200.0);
        
        assert!((mem.aspect_ratio() - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_membrane_capacity() {
        let mem = MembraneAction::new(8.0, 8.0, 200.0);
        
        assert!(mem.membrane_capacity() > 0.0);
    }

    #[test]
    fn test_redundancy_assessment() {
        let ra = RedundancyAssessment::new(10, 4, true);
        
        assert_eq!(ra.redundancy_level(), RedundancyLevel::High);
    }

    #[test]
    fn test_robustness_score() {
        let high = RedundancyAssessment::new(10, 4, true);
        let low = RedundancyAssessment::new(2, 1, false);
        
        assert!(high.robustness_score() > low.robustness_score());
    }

    #[test]
    fn test_redundancy_factor() {
        let low = RedundancyAssessment::new(2, 1, false);
        
        assert!((low.redundancy_factor() - 1.5).abs() < 0.1);
    }
}
