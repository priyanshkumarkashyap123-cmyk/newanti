//! Component Fragility Database Module
//!
//! Pre-built fragility curves for structural and non-structural components
//! per FEMA P-58, HAZUS, and ATC-58 methodologies.
//!
//! ## Standards
//! - FEMA P-58 Seismic Performance Assessment
//! - HAZUS MH 4.0 Earthquake Model
//! - ATC-58 Guidelines
//! - PACT (Performance Assessment Calculation Tool)
//!
//! ## Component Types
//! - Structural: Columns, beams, walls, connections
//! - Non-structural: Cladding, ceilings, MEP, contents

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::special_functions::*;


fn standard_normal_inverse(p: f64) -> f64 {
    2.0_f64.sqrt() * crate::special_functions::erfinv(2.0 * p - 1.0)
}

// ============================================================================
// DAMAGE STATES
// ============================================================================

/// Standard damage states per FEMA P-58
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum DamageState {
    /// No damage (operational)
    DS0,
    /// Slight damage
    DS1,
    /// Moderate damage
    DS2,
    /// Extensive damage
    DS3,
    /// Complete damage / collapse
    DS4,
}

impl DamageState {
    pub fn description(&self) -> &'static str {
        match self {
            DamageState::DS0 => "No Damage",
            DamageState::DS1 => "Slight Damage",
            DamageState::DS2 => "Moderate Damage",
            DamageState::DS3 => "Extensive Damage",
            DamageState::DS4 => "Complete Damage",
        }
    }

    /// HAZUS equivalent
    pub fn hazus_name(&self) -> &'static str {
        match self {
            DamageState::DS0 => "None",
            DamageState::DS1 => "Slight",
            DamageState::DS2 => "Moderate",
            DamageState::DS3 => "Extensive",
            DamageState::DS4 => "Complete",
        }
    }
}

// ============================================================================
// ENGINEERING DEMAND PARAMETERS
// ============================================================================

/// Demand parameter types for fragility curves
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum DemandType {
    /// Peak interstory drift ratio
    IDR,
    /// Peak floor acceleration (g)
    PFA,
    /// Peak floor velocity (m/s)
    PFV,
    /// Peak ground acceleration (g)
    PGA,
    /// Peak ground velocity (m/s)
    PGV,
    /// Peak ground displacement (m)
    PGD,
    /// Residual drift ratio
    RDR,
    /// Peak shear force (kN)
    Vmax,
    /// Peak rotation (rad)
    Theta,
}

impl DemandType {
    pub fn unit(&self) -> &'static str {
        match self {
            DemandType::IDR | DemandType::RDR | DemandType::Theta => "rad",
            DemandType::PFA | DemandType::PGA => "g",
            DemandType::PFV | DemandType::PGV => "m/s",
            DemandType::PGD => "m",
            DemandType::Vmax => "kN",
        }
    }
}

// ============================================================================
// FRAGILITY CURVE
// ============================================================================

/// Lognormal fragility curve parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FragilityCurve {
    /// Median capacity (θ)
    pub median: f64,
    /// Total dispersion (β)
    pub dispersion: f64,
    /// Demand parameter type
    pub demand_type: DemandType,
    /// Damage state
    pub damage_state: DamageState,
}

impl FragilityCurve {
    pub fn new(median: f64, dispersion: f64, demand_type: DemandType, damage_state: DamageState) -> Self {
        FragilityCurve {
            median,
            dispersion,
            demand_type,
            damage_state,
        }
    }

    /// Probability of exceeding damage state at given demand
    pub fn probability_of_exceedance(&self, demand: f64) -> f64 {
        if demand <= 0.0 {
            return 0.0;
        }
        
        let z = (demand / self.median).ln() / self.dispersion;
        standard_normal_cdf(z)
    }

    /// Demand at specified probability
    pub fn demand_at_probability(&self, prob: f64) -> f64 {
        let z = standard_normal_inverse(prob);
        self.median * (z * self.dispersion).exp()
    }
}

// ============================================================================
// COMPONENT FRAGILITY GROUP
// ============================================================================

/// Component category
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ComponentCategory {
    // Structural
    RCColumn,
    RCBeam,
    RCWall,
    SteelColumn,
    SteelBeam,
    SteelConnection,
    MasonryWall,
    TimberFrame,
    
    // Non-structural - Architectural
    ExteriorCladding,
    PartitionWall,
    CurtainWall,
    Ceiling,
    Flooring,
    
    // Non-structural - MEP
    Piping,
    HVAC,
    Electrical,
    Elevator,
    FireSprinkler,
    
    // Contents
    FreestandingEquipment,
    AnchoredEquipment,
    ShelvingContents,
}

/// Component fragility group with multiple damage states
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentFragilityGroup {
    /// Component ID (FEMA P-58 format: B.xx.yy.zz)
    pub id: String,
    /// Component description
    pub description: String,
    /// Component category
    pub category: ComponentCategory,
    /// Fragility curves for each damage state
    pub curves: Vec<FragilityCurve>,
    /// Consequence data: repair cost ratio per damage state
    pub repair_cost_ratio: HashMap<DamageState, f64>,
    /// Consequence data: repair time (days) per damage state
    pub repair_time_days: HashMap<DamageState, f64>,
    /// Directional (True) or non-directional (False)
    pub directional: bool,
}

impl ComponentFragilityGroup {
    /// Get probability distribution across damage states at given demand
    pub fn damage_state_probabilities(&self, demand: f64) -> HashMap<DamageState, f64> {
        let mut probs = HashMap::new();
        let _prev_p = 0.0;

        // Sort curves by median (DS1 < DS2 < DS3 < DS4)
        let mut sorted_curves = self.curves.clone();
        sorted_curves.sort_by(|a, b| a.median.partial_cmp(&b.median).unwrap_or(std::cmp::Ordering::Equal));

        // Calculate probability of being in each damage state
        let exceedance_probs: Vec<(DamageState, f64)> = sorted_curves.iter()
            .map(|c| (c.damage_state, c.probability_of_exceedance(demand)))
            .collect();

        // P(DS=i) = P(DS≥i) - P(DS≥i+1)
        for i in 0..exceedance_probs.len() {
            let (ds, p_exceed) = exceedance_probs[i];
            let p_next = if i + 1 < exceedance_probs.len() {
                exceedance_probs[i + 1].1
            } else {
                0.0
            };
            probs.insert(ds, (p_exceed - p_next).max(0.0));
        }

        // P(DS0) = 1 - P(DS≥1)
        let p_any_damage = exceedance_probs.first().map(|(_, p)| *p).unwrap_or(0.0);
        probs.insert(DamageState::DS0, (1.0 - p_any_damage).max(0.0));

        probs
    }

    /// Expected repair cost ratio at given demand
    pub fn expected_repair_cost(&self, demand: f64) -> f64 {
        let probs = self.damage_state_probabilities(demand);
        
        probs.iter()
            .map(|(ds, p)| {
                p * self.repair_cost_ratio.get(ds).unwrap_or(&0.0)
            })
            .sum()
    }
}

// ============================================================================
// FEMA P-58 FRAGILITY DATABASE
// ============================================================================

/// FEMA P-58 / PACT fragility database
#[derive(Debug)]
pub struct FragilityDatabase {
    components: HashMap<String, ComponentFragilityGroup>,
}

impl FragilityDatabase {
    pub fn new() -> Self {
        let mut db = FragilityDatabase {
            components: HashMap::new(),
        };
        db.load_standard_components();
        db
    }

    /// Load standard FEMA P-58 components
    fn load_standard_components(&mut self) {
        // =================================================================
        // STRUCTURAL COMPONENTS
        // =================================================================

        // B1041.001a - RC Column, SMF, low clamping
        self.components.insert(
            "B1041.001a".to_string(),
            ComponentFragilityGroup {
                id: "B1041.001a".to_string(),
                description: "RC Column in SMF, Low Clamping".to_string(),
                category: ComponentCategory::RCColumn,
                curves: vec![
                    FragilityCurve::new(0.020, 0.40, DemandType::IDR, DamageState::DS1),
                    FragilityCurve::new(0.033, 0.35, DemandType::IDR, DamageState::DS2),
                    FragilityCurve::new(0.050, 0.30, DemandType::IDR, DamageState::DS3),
                ],
                repair_cost_ratio: [
                    (DamageState::DS1, 0.05),
                    (DamageState::DS2, 0.25),
                    (DamageState::DS3, 1.00),
                ].iter().cloned().collect(),
                repair_time_days: [
                    (DamageState::DS1, 5.0),
                    (DamageState::DS2, 30.0),
                    (DamageState::DS3, 90.0),
                ].iter().cloned().collect(),
                directional: true,
            }
        );

        // B1041.003a - RC Column, OMF
        self.components.insert(
            "B1041.003a".to_string(),
            ComponentFragilityGroup {
                id: "B1041.003a".to_string(),
                description: "RC Column in OMF".to_string(),
                category: ComponentCategory::RCColumn,
                curves: vec![
                    FragilityCurve::new(0.010, 0.45, DemandType::IDR, DamageState::DS1),
                    FragilityCurve::new(0.020, 0.40, DemandType::IDR, DamageState::DS2),
                    FragilityCurve::new(0.030, 0.35, DemandType::IDR, DamageState::DS3),
                ],
                repair_cost_ratio: [
                    (DamageState::DS1, 0.05),
                    (DamageState::DS2, 0.30),
                    (DamageState::DS3, 1.00),
                ].iter().cloned().collect(),
                repair_time_days: [
                    (DamageState::DS1, 5.0),
                    (DamageState::DS2, 45.0),
                    (DamageState::DS3, 120.0),
                ].iter().cloned().collect(),
                directional: true,
            }
        );

        // B1031.001 - Steel Column, W-shape
        self.components.insert(
            "B1031.001".to_string(),
            ComponentFragilityGroup {
                id: "B1031.001".to_string(),
                description: "Steel Column, Wide Flange".to_string(),
                category: ComponentCategory::SteelColumn,
                curves: vec![
                    FragilityCurve::new(0.030, 0.30, DemandType::IDR, DamageState::DS1),
                    FragilityCurve::new(0.045, 0.30, DemandType::IDR, DamageState::DS2),
                    FragilityCurve::new(0.060, 0.35, DemandType::IDR, DamageState::DS3),
                ],
                repair_cost_ratio: [
                    (DamageState::DS1, 0.03),
                    (DamageState::DS2, 0.15),
                    (DamageState::DS3, 0.80),
                ].iter().cloned().collect(),
                repair_time_days: [
                    (DamageState::DS1, 3.0),
                    (DamageState::DS2, 20.0),
                    (DamageState::DS3, 60.0),
                ].iter().cloned().collect(),
                directional: true,
            }
        );

        // B1035.001 - Pre-Northridge WUF Connection
        self.components.insert(
            "B1035.001".to_string(),
            ComponentFragilityGroup {
                id: "B1035.001".to_string(),
                description: "Pre-Northridge Welded Flange Connection".to_string(),
                category: ComponentCategory::SteelConnection,
                curves: vec![
                    FragilityCurve::new(0.015, 0.40, DemandType::IDR, DamageState::DS1),
                    FragilityCurve::new(0.025, 0.35, DemandType::IDR, DamageState::DS2),
                    FragilityCurve::new(0.040, 0.30, DemandType::IDR, DamageState::DS3),
                ],
                repair_cost_ratio: [
                    (DamageState::DS1, 0.10),
                    (DamageState::DS2, 0.40),
                    (DamageState::DS3, 1.00),
                ].iter().cloned().collect(),
                repair_time_days: [
                    (DamageState::DS1, 7.0),
                    (DamageState::DS2, 30.0),
                    (DamageState::DS3, 90.0),
                ].iter().cloned().collect(),
                directional: true,
            }
        );

        // B1044.001 - RC Shear Wall (low rise)
        self.components.insert(
            "B1044.001".to_string(),
            ComponentFragilityGroup {
                id: "B1044.001".to_string(),
                description: "RC Shear Wall, Low-Rise".to_string(),
                category: ComponentCategory::RCWall,
                curves: vec![
                    FragilityCurve::new(0.004, 0.50, DemandType::IDR, DamageState::DS1),
                    FragilityCurve::new(0.008, 0.45, DemandType::IDR, DamageState::DS2),
                    FragilityCurve::new(0.015, 0.40, DemandType::IDR, DamageState::DS3),
                ],
                repair_cost_ratio: [
                    (DamageState::DS1, 0.08),
                    (DamageState::DS2, 0.35),
                    (DamageState::DS3, 1.00),
                ].iter().cloned().collect(),
                repair_time_days: [
                    (DamageState::DS1, 10.0),
                    (DamageState::DS2, 45.0),
                    (DamageState::DS3, 120.0),
                ].iter().cloned().collect(),
                directional: true,
            }
        );

        // =================================================================
        // NON-STRUCTURAL - ARCHITECTURAL
        // =================================================================

        // B2011.001 - Exterior Glass Curtain Wall
        self.components.insert(
            "B2011.001".to_string(),
            ComponentFragilityGroup {
                id: "B2011.001".to_string(),
                description: "Exterior Glass Curtain Wall".to_string(),
                category: ComponentCategory::CurtainWall,
                curves: vec![
                    FragilityCurve::new(0.020, 0.35, DemandType::IDR, DamageState::DS1),
                    FragilityCurve::new(0.035, 0.30, DemandType::IDR, DamageState::DS2),
                    FragilityCurve::new(0.050, 0.30, DemandType::IDR, DamageState::DS3),
                ],
                repair_cost_ratio: [
                    (DamageState::DS1, 0.05),
                    (DamageState::DS2, 0.30),
                    (DamageState::DS3, 1.00),
                ].iter().cloned().collect(),
                repair_time_days: [
                    (DamageState::DS1, 2.0),
                    (DamageState::DS2, 14.0),
                    (DamageState::DS3, 60.0),
                ].iter().cloned().collect(),
                directional: true,
            }
        );

        // C1011.001a - Gypsum Partition Wall (full height)
        self.components.insert(
            "C1011.001a".to_string(),
            ComponentFragilityGroup {
                id: "C1011.001a".to_string(),
                description: "Gypsum Partition Wall, Full Height".to_string(),
                category: ComponentCategory::PartitionWall,
                curves: vec![
                    FragilityCurve::new(0.0039, 0.60, DemandType::IDR, DamageState::DS1),
                    FragilityCurve::new(0.0085, 0.40, DemandType::IDR, DamageState::DS2),
                ],
                repair_cost_ratio: [
                    (DamageState::DS1, 0.15),
                    (DamageState::DS2, 0.60),
                ].iter().cloned().collect(),
                repair_time_days: [
                    (DamageState::DS1, 1.0),
                    (DamageState::DS2, 3.0),
                ].iter().cloned().collect(),
                directional: true,
            }
        );

        // C3032.001a - Suspended Ceiling (high seismic)
        self.components.insert(
            "C3032.001a".to_string(),
            ComponentFragilityGroup {
                id: "C3032.001a".to_string(),
                description: "Suspended Ceiling, Seismic Braced".to_string(),
                category: ComponentCategory::Ceiling,
                curves: vec![
                    FragilityCurve::new(0.55, 0.45, DemandType::PFA, DamageState::DS1),
                    FragilityCurve::new(1.00, 0.40, DemandType::PFA, DamageState::DS2),
                    FragilityCurve::new(1.50, 0.35, DemandType::PFA, DamageState::DS3),
                ],
                repair_cost_ratio: [
                    (DamageState::DS1, 0.10),
                    (DamageState::DS2, 0.50),
                    (DamageState::DS3, 1.00),
                ].iter().cloned().collect(),
                repair_time_days: [
                    (DamageState::DS1, 0.5),
                    (DamageState::DS2, 2.0),
                    (DamageState::DS3, 5.0),
                ].iter().cloned().collect(),
                directional: false,
            }
        );

        // =================================================================
        // NON-STRUCTURAL - MEP
        // =================================================================

        // D2021.001a - Cold Water Piping, Braced
        self.components.insert(
            "D2021.001a".to_string(),
            ComponentFragilityGroup {
                id: "D2021.001a".to_string(),
                description: "Cold Water Piping, Braced".to_string(),
                category: ComponentCategory::Piping,
                curves: vec![
                    FragilityCurve::new(2.25, 0.45, DemandType::PFA, DamageState::DS1),
                    FragilityCurve::new(3.00, 0.40, DemandType::PFA, DamageState::DS2),
                ],
                repair_cost_ratio: [
                    (DamageState::DS1, 0.02),
                    (DamageState::DS2, 0.20),
                ].iter().cloned().collect(),
                repair_time_days: [
                    (DamageState::DS1, 0.5),
                    (DamageState::DS2, 3.0),
                ].iter().cloned().collect(),
                directional: false,
            }
        );

        // D3041.001a - HVAC Equipment, Vibration Isolated
        self.components.insert(
            "D3041.001a".to_string(),
            ComponentFragilityGroup {
                id: "D3041.001a".to_string(),
                description: "HVAC Equipment, Vibration Isolated".to_string(),
                category: ComponentCategory::HVAC,
                curves: vec![
                    FragilityCurve::new(0.50, 0.50, DemandType::PFA, DamageState::DS1),
                    FragilityCurve::new(1.00, 0.45, DemandType::PFA, DamageState::DS2),
                    FragilityCurve::new(2.00, 0.40, DemandType::PFA, DamageState::DS3),
                ],
                repair_cost_ratio: [
                    (DamageState::DS1, 0.05),
                    (DamageState::DS2, 0.30),
                    (DamageState::DS3, 1.00),
                ].iter().cloned().collect(),
                repair_time_days: [
                    (DamageState::DS1, 1.0),
                    (DamageState::DS2, 7.0),
                    (DamageState::DS3, 30.0),
                ].iter().cloned().collect(),
                directional: false,
            }
        );

        // D1014.001 - Elevator
        self.components.insert(
            "D1014.001".to_string(),
            ComponentFragilityGroup {
                id: "D1014.001".to_string(),
                description: "Elevator".to_string(),
                category: ComponentCategory::Elevator,
                curves: vec![
                    FragilityCurve::new(0.25, 0.55, DemandType::PFA, DamageState::DS1),
                    FragilityCurve::new(0.50, 0.50, DemandType::PFA, DamageState::DS2),
                    FragilityCurve::new(1.00, 0.45, DemandType::PFA, DamageState::DS3),
                ],
                repair_cost_ratio: [
                    (DamageState::DS1, 0.02),
                    (DamageState::DS2, 0.15),
                    (DamageState::DS3, 0.60),
                ].iter().cloned().collect(),
                repair_time_days: [
                    (DamageState::DS1, 1.0),
                    (DamageState::DS2, 14.0),
                    (DamageState::DS3, 60.0),
                ].iter().cloned().collect(),
                directional: false,
            }
        );

        // =================================================================
        // CONTENTS
        // =================================================================

        // E2022.001 - Computer/Electronics on desk
        self.components.insert(
            "E2022.001".to_string(),
            ComponentFragilityGroup {
                id: "E2022.001".to_string(),
                description: "Computer Equipment on Desk".to_string(),
                category: ComponentCategory::FreestandingEquipment,
                curves: vec![
                    FragilityCurve::new(0.40, 0.55, DemandType::PFA, DamageState::DS1),
                    FragilityCurve::new(0.80, 0.50, DemandType::PFA, DamageState::DS2),
                ],
                repair_cost_ratio: [
                    (DamageState::DS1, 0.10),
                    (DamageState::DS2, 1.00),
                ].iter().cloned().collect(),
                repair_time_days: [
                    (DamageState::DS1, 0.25),
                    (DamageState::DS2, 2.0),
                ].iter().cloned().collect(),
                directional: false,
            }
        );
    }

    /// Get component by ID
    pub fn get(&self, id: &str) -> Option<&ComponentFragilityGroup> {
        self.components.get(id)
    }

    /// Get all components in a category
    pub fn by_category(&self, category: ComponentCategory) -> Vec<&ComponentFragilityGroup> {
        self.components.values()
            .filter(|c| c.category == category)
            .collect()
    }

    /// List all component IDs
    pub fn list_ids(&self) -> Vec<&str> {
        self.components.keys().map(|s| s.as_str()).collect()
    }
}

impl Default for FragilityDatabase {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// HAZUS BUILDING FRAGILITIES
// ============================================================================

/// HAZUS building type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum HAZUSBuildingType {
    /// Wood light frame
    W1,
    /// Wood commercial
    W2,
    /// Steel moment frame
    S1L, S1M, S1H,
    /// Steel braced frame
    S2L, S2M, S2H,
    /// Steel frame with concrete walls
    S4L, S4M, S4H,
    /// Concrete moment frame
    C1L, C1M, C1H,
    /// Concrete shear wall
    C2L, C2M, C2H,
    /// Precast concrete frame
    PC1,
    /// Reinforced masonry
    RM1L, RM1M,
    /// Unreinforced masonry bearing wall
    URML, URMM,
}

/// HAZUS code level
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum HAZUSCodeLevel {
    HighCode,
    ModerateCode,
    LowCode,
    PreCode,
}

/// HAZUS building fragility data
#[derive(Debug, Clone)]
pub struct HAZUSBuildingFragility {
    pub building_type: HAZUSBuildingType,
    pub code_level: HAZUSCodeLevel,
    /// Median spectral displacement (inches) per damage state
    pub median_sd: HashMap<DamageState, f64>,
    /// Beta dispersion
    pub beta: f64,
}

impl HAZUSBuildingFragility {
    /// Get HAZUS default fragility for building type
    pub fn get_default(building_type: HAZUSBuildingType, code_level: HAZUSCodeLevel) -> Self {
        // HAZUS MH 4.0 Table 5.9d (selected values)
        let (sd1, sd2, sd3, sd4, beta) = match (building_type, code_level) {
            (HAZUSBuildingType::C1M, HAZUSCodeLevel::HighCode) => (0.60, 1.25, 3.25, 8.75, 0.70),
            (HAZUSBuildingType::C1M, HAZUSCodeLevel::ModerateCode) => (0.45, 0.90, 2.25, 6.00, 0.75),
            (HAZUSBuildingType::C1M, HAZUSCodeLevel::LowCode) => (0.30, 0.60, 1.50, 4.00, 0.80),
            (HAZUSBuildingType::S1M, HAZUSCodeLevel::HighCode) => (0.75, 1.50, 4.00, 10.00, 0.65),
            (HAZUSBuildingType::S1M, HAZUSCodeLevel::ModerateCode) => (0.55, 1.10, 2.80, 7.00, 0.70),
            (HAZUSBuildingType::W1, HAZUSCodeLevel::HighCode) => (0.50, 1.00, 3.00, 7.50, 0.80),
            _ => (0.50, 1.00, 2.50, 6.00, 0.75), // Default
        };

        let mut median_sd = HashMap::new();
        median_sd.insert(DamageState::DS1, sd1);
        median_sd.insert(DamageState::DS2, sd2);
        median_sd.insert(DamageState::DS3, sd3);
        median_sd.insert(DamageState::DS4, sd4);

        HAZUSBuildingFragility {
            building_type,
            code_level,
            median_sd,
            beta,
        }
    }

    /// Probability of damage state exceedance at given spectral displacement (inches)
    pub fn probability_of_exceedance(&self, sd: f64, ds: DamageState) -> f64 {
        if let Some(&median) = self.median_sd.get(&ds) {
            if sd <= 0.0 {
                return 0.0;
            }
            let z = (sd / median).ln() / self.beta;
            standard_normal_cdf(z)
        } else {
            0.0
        }
    }
}

// ============================================================================
// LOSS AGGREGATION
// ============================================================================

/// Loss aggregation for building
#[derive(Debug, Clone)]
pub struct BuildingLossAggregator {
    components: Vec<(ComponentFragilityGroup, u32)>,  // (component, quantity)
    building_replacement_cost: f64,
}

impl BuildingLossAggregator {
    pub fn new(replacement_cost: f64) -> Self {
        BuildingLossAggregator {
            components: Vec::new(),
            building_replacement_cost: replacement_cost,
        }
    }

    pub fn add_component(&mut self, component: ComponentFragilityGroup, quantity: u32) {
        self.components.push((component, quantity));
    }

    /// Calculate expected loss at given demands
    pub fn expected_loss(&self, demands: &HashMap<DemandType, f64>) -> ExpectedLoss {
        let mut total_repair = 0.0;
        let mut total_time = 0.0;

        for (component, qty) in &self.components {
            let demand = demands.get(&component.curves[0].demand_type).unwrap_or(&0.0);
            let cost = component.expected_repair_cost(*demand);
            
            // Simplified: max repair time across damage states
            let probs = component.damage_state_probabilities(*demand);
            let time: f64 = probs.iter()
                .map(|(ds, p)| p * component.repair_time_days.get(ds).unwrap_or(&0.0))
                .sum();

            total_repair += cost * (*qty as f64);
            total_time += time;
        }

        ExpectedLoss {
            repair_cost: total_repair * self.building_replacement_cost,
            repair_time_days: total_time,
            loss_ratio: total_repair,
        }
    }
}

/// Expected loss result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExpectedLoss {
    pub repair_cost: f64,
    pub repair_time_days: f64,
    pub loss_ratio: f64,
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fragility_curve() {
        let curve = FragilityCurve::new(0.02, 0.4, DemandType::IDR, DamageState::DS1);
        
        // At median, probability should be 50%
        let p_median = curve.probability_of_exceedance(0.02);
        assert!((p_median - 0.5).abs() < 0.01);

        // Lower demand, lower probability
        let p_low = curve.probability_of_exceedance(0.01);
        assert!(p_low < 0.5);

        // Higher demand, higher probability
        let p_high = curve.probability_of_exceedance(0.04);
        assert!(p_high > 0.5);
    }

    #[test]
    fn test_fragility_database() {
        let db = FragilityDatabase::new();
        
        // Check that components exist
        let column = db.get("B1041.001a");
        assert!(column.is_some());
        
        let ids = db.list_ids();
        assert!(ids.len() > 5);
    }

    #[test]
    fn test_damage_state_probabilities() {
        let db = FragilityDatabase::new();
        let column = db.get("B1041.001a").unwrap();

        let probs = column.damage_state_probabilities(0.025);
        
        // Sum should be 1.0
        let sum: f64 = probs.values().sum();
        assert!((sum - 1.0).abs() < 0.01);

        // DS0 probability should exist
        assert!(probs.contains_key(&DamageState::DS0));
    }
}
