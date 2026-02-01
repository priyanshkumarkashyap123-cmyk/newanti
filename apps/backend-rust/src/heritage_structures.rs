// ============================================================================
// HERITAGE STRUCTURES - Conservation, Assessment, Retrofit
// Based on ICOMOS, EN 1998-3, ASCE 41
// ============================================================================

use serde::{Deserialize, Serialize};
use crate::special_functions::erf;

// ============================================================================
// MASONRY ASSESSMENT
// ============================================================================

/// Historic masonry properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoricMasonry {
    /// Masonry type
    pub masonry_type: MasonryType,
    /// Compressive strength fm (MPa)
    pub fm: f64,
    /// Shear strength fv0 (MPa)
    pub fv0: f64,
    /// Modulus of elasticity (GPa)
    pub em: f64,
    /// Unit weight (kN/m³)
    pub gamma: f64,
    /// Mortar condition
    pub mortar_condition: MortarCondition,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum MasonryType {
    RubbleStone,
    DressedStone,
    SoftMudBrick,
    HardFiredBrick,
    AdobeMudBrick,
    MixedMasonry,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum MortarCondition {
    Good,
    Fair,
    Poor,
    Missing,
}

impl HistoricMasonry {
    pub fn rubble_stone() -> Self {
        Self {
            masonry_type: MasonryType::RubbleStone,
            fm: 1.0,
            fv0: 0.035,
            em: 0.69,
            gamma: 19.0,
            mortar_condition: MortarCondition::Fair,
        }
    }
    
    pub fn dressed_stone() -> Self {
        Self {
            masonry_type: MasonryType::DressedStone,
            fm: 6.0,
            fv0: 0.08,
            em: 2.8,
            gamma: 22.0,
            mortar_condition: MortarCondition::Good,
        }
    }
    
    pub fn soft_mud_brick() -> Self {
        Self {
            masonry_type: MasonryType::SoftMudBrick,
            fm: 2.4,
            fv0: 0.06,
            em: 1.2,
            gamma: 18.0,
            mortar_condition: MortarCondition::Fair,
        }
    }
    
    /// Confidence factor CF
    pub fn confidence_factor(&self, knowledge_level: KnowledgeLevel) -> f64 {
        match knowledge_level {
            KnowledgeLevel::KL1 => 1.35,
            KnowledgeLevel::KL2 => 1.20,
            KnowledgeLevel::KL3 => 1.00,
        }
    }
    
    /// Mortar degradation factor
    pub fn mortar_factor(&self) -> f64 {
        match self.mortar_condition {
            MortarCondition::Good => 1.0,
            MortarCondition::Fair => 0.8,
            MortarCondition::Poor => 0.5,
            MortarCondition::Missing => 0.2,
        }
    }
    
    /// Adjusted compressive strength (MPa)
    pub fn adjusted_fm(&self, cf: f64) -> f64 {
        self.fm * self.mortar_factor() / cf
    }
    
    /// Shear modulus (GPa)
    pub fn gm(&self) -> f64 {
        self.em * 0.4
    }
    
    /// Drift limit at significant damage
    pub fn drift_limit_sd(&self) -> f64 {
        match self.masonry_type {
            MasonryType::RubbleStone => 0.003,
            MasonryType::DressedStone => 0.004,
            MasonryType::SoftMudBrick => 0.003,
            MasonryType::HardFiredBrick => 0.004,
            MasonryType::AdobeMudBrick => 0.002,
            MasonryType::MixedMasonry => 0.003,
        }
    }
    
    /// Drift limit at near collapse
    pub fn drift_limit_nc(&self) -> f64 {
        self.drift_limit_sd() * 1.33
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum KnowledgeLevel {
    KL1, // Limited
    KL2, // Normal
    KL3, // Full
}

// ============================================================================
// WALL CAPACITY
// ============================================================================

/// Masonry wall assessment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MasonryWall {
    /// Length (m)
    pub length: f64,
    /// Height (m)
    pub height: f64,
    /// Thickness (mm)
    pub thickness: f64,
    /// Masonry properties
    pub masonry: HistoricMasonry,
    /// Opening area ratio
    pub opening_ratio: f64,
    /// Boundary conditions
    pub boundary: WallBoundary,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum WallBoundary {
    Cantilever,
    FixedFree,
    FixedFixed,
}

impl MasonryWall {
    pub fn new(length: f64, height: f64, thickness: f64, masonry: HistoricMasonry) -> Self {
        Self {
            length,
            height,
            thickness,
            masonry,
            opening_ratio: 0.0,
            boundary: WallBoundary::FixedFree,
        }
    }
    
    /// Effective height
    pub fn effective_height(&self) -> f64 {
        match self.boundary {
            WallBoundary::Cantilever => 2.0 * self.height,
            WallBoundary::FixedFree => 0.85 * self.height,
            WallBoundary::FixedFixed => 0.7 * self.height,
        }
    }
    
    /// Slenderness ratio
    pub fn slenderness(&self) -> f64 {
        self.effective_height() / (self.thickness / 1000.0)
    }
    
    /// Cross-section area (m²)
    pub fn area(&self) -> f64 {
        self.length * self.thickness / 1000.0 * (1.0 - self.opening_ratio)
    }
    
    /// Axial load capacity (kN)
    pub fn axial_capacity(&self, cf: f64) -> f64 {
        let fm_adj = self.masonry.adjusted_fm(cf);
        let phi = self.capacity_reduction();
        
        phi * fm_adj * 1000.0 * self.area()
    }
    
    /// Capacity reduction for slenderness
    pub fn capacity_reduction(&self) -> f64 {
        let sr = self.slenderness();
        
        if sr < 6.0 {
            1.0
        } else if sr < 18.0 {
            1.0 - 0.025 * (sr - 6.0)
        } else {
            0.7 - 0.015 * (sr - 18.0)
        }.max(0.3)
    }
    
    /// In-plane shear capacity (kN)
    pub fn shear_capacity(&self, axial: f64, cf: f64) -> f64 {
        let fv0_adj = self.masonry.fv0 * self.masonry.mortar_factor() / cf;
        let sigma = axial / self.area() / 1000.0; // MPa
        
        let fvd = fv0_adj + 0.4 * sigma;
        
        fvd * 1000.0 * self.area()
    }
    
    /// Out-of-plane capacity (kPa)
    pub fn out_of_plane_capacity(&self, cf: f64) -> f64 {
        let fm_adj = self.masonry.adjusted_fm(cf);
        let t = self.thickness / 1000.0;
        let h_eff = self.effective_height();
        
        // Simplified yield line
        let alpha = self.length / h_eff;
        let beta = if alpha > 1.5 { 0.5 } else { 0.3 + 0.13 * alpha };
        
        beta * fm_adj * 1000.0 * (t / h_eff).powi(2)
    }
}

// ============================================================================
// TIMBER ASSESSMENT
// ============================================================================

/// Historic timber element
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoricTimber {
    /// Species
    pub species: TimberSpecies,
    /// Grade
    pub grade: TimberGrade,
    /// Width (mm)
    pub width: f64,
    /// Depth (mm)
    pub depth: f64,
    /// Moisture content (%)
    pub moisture: f64,
    /// Decay condition
    pub decay: DecayCondition,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum TimberSpecies {
    Oak,
    Teak,
    Pine,
    Chestnut,
    Elm,
    Unknown,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum TimberGrade {
    Structural,
    BetterThanAverage,
    Average,
    BelowAverage,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum DecayCondition {
    Sound,
    Minor,
    Moderate,
    Severe,
    Compromised,
}

impl HistoricTimber {
    pub fn oak_beam(width: f64, depth: f64) -> Self {
        Self {
            species: TimberSpecies::Oak,
            grade: TimberGrade::Average,
            width,
            depth,
            moisture: 15.0,
            decay: DecayCondition::Minor,
        }
    }
    
    /// Reference bending strength (MPa)
    pub fn ref_bending(&self) -> f64 {
        let base = match self.species {
            TimberSpecies::Oak => 28.0,
            TimberSpecies::Teak => 30.0,
            TimberSpecies::Pine => 20.0,
            TimberSpecies::Chestnut => 25.0,
            TimberSpecies::Elm => 22.0,
            TimberSpecies::Unknown => 18.0,
        };
        
        base * self.grade_factor()
    }
    
    /// Reference modulus (GPa)
    pub fn ref_modulus(&self) -> f64 {
        match self.species {
            TimberSpecies::Oak => 11.0,
            TimberSpecies::Teak => 12.5,
            TimberSpecies::Pine => 9.5,
            TimberSpecies::Chestnut => 10.0,
            TimberSpecies::Elm => 9.0,
            TimberSpecies::Unknown => 8.0,
        }
    }
    
    fn grade_factor(&self) -> f64 {
        match self.grade {
            TimberGrade::Structural => 1.2,
            TimberGrade::BetterThanAverage => 1.0,
            TimberGrade::Average => 0.8,
            TimberGrade::BelowAverage => 0.6,
        }
    }
    
    /// Decay reduction factor
    pub fn decay_factor(&self) -> f64 {
        match self.decay {
            DecayCondition::Sound => 1.0,
            DecayCondition::Minor => 0.9,
            DecayCondition::Moderate => 0.7,
            DecayCondition::Severe => 0.4,
            DecayCondition::Compromised => 0.1,
        }
    }
    
    /// Effective section properties after decay
    pub fn effective_width(&self) -> f64 {
        let loss = match self.decay {
            DecayCondition::Sound => 0.0,
            DecayCondition::Minor => 5.0,
            DecayCondition::Moderate => 15.0,
            DecayCondition::Severe => 30.0,
            DecayCondition::Compromised => 50.0,
        };
        
        (self.width - loss).max(0.0)
    }
    
    /// Section modulus (mm³)
    pub fn section_modulus(&self) -> f64 {
        self.effective_width() * self.depth.powi(2) / 6.0
    }
    
    /// Moment capacity (kN·m)
    pub fn moment_capacity(&self) -> f64 {
        let fb = self.ref_bending() * self.decay_factor();
        
        fb * self.section_modulus() / 1e6
    }
    
    /// Shear capacity (kN)
    pub fn shear_capacity(&self) -> f64 {
        let fv = 0.15 * self.ref_bending() * self.decay_factor();
        let a = self.effective_width() * self.depth;
        
        fv * a * 2.0 / 3.0 / 1000.0
    }
}

// ============================================================================
// RETROFIT INTERVENTIONS
// ============================================================================

/// Retrofit intervention
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetrofitIntervention {
    /// Intervention type
    pub intervention_type: InterventionType,
    /// Improvement factor on strength
    pub strength_factor: f64,
    /// Improvement factor on ductility
    pub ductility_factor: f64,
    /// Reversibility
    pub reversibility: Reversibility,
    /// Compatibility rating (1-5)
    pub compatibility: u8,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum InterventionType {
    // Masonry
    MortarRepointing,
    GroutInjection,
    SteelTieRods,
    FrpStrengthening,
    RingBeams,
    BasementUnderpinning,
    
    // Timber
    TimberSplicing,
    SteelPlateReinforcement,
    EpoxyRepair,
    CarbonFiberWrap,
    
    // Foundation
    Micropiles,
    JetGrouting,
    SoilNailing,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum Reversibility {
    FullyReversible,
    PartiallyReversible,
    Irreversible,
}

impl RetrofitIntervention {
    pub fn mortar_repointing() -> Self {
        Self {
            intervention_type: InterventionType::MortarRepointing,
            strength_factor: 1.3,
            ductility_factor: 1.1,
            reversibility: Reversibility::FullyReversible,
            compatibility: 5,
        }
    }
    
    pub fn grout_injection() -> Self {
        Self {
            intervention_type: InterventionType::GroutInjection,
            strength_factor: 1.5,
            ductility_factor: 1.0,
            reversibility: Reversibility::Irreversible,
            compatibility: 4,
        }
    }
    
    pub fn steel_ties() -> Self {
        Self {
            intervention_type: InterventionType::SteelTieRods,
            strength_factor: 1.2,
            ductility_factor: 1.5,
            reversibility: Reversibility::PartiallyReversible,
            compatibility: 4,
        }
    }
    
    pub fn frp_strengthening() -> Self {
        Self {
            intervention_type: InterventionType::FrpStrengthening,
            strength_factor: 2.0,
            ductility_factor: 1.0,
            reversibility: Reversibility::PartiallyReversible,
            compatibility: 2,
        }
    }
    
    /// Conservation score (higher is better)
    pub fn conservation_score(&self) -> f64 {
        let rev_score = match self.reversibility {
            Reversibility::FullyReversible => 1.0,
            Reversibility::PartiallyReversible => 0.6,
            Reversibility::Irreversible => 0.2,
        };
        
        (self.compatibility as f64 / 5.0 + rev_score) / 2.0
    }
    
    /// Effectiveness score
    pub fn effectiveness_score(&self) -> f64 {
        (self.strength_factor - 1.0 + self.ductility_factor - 1.0) / 2.0
    }
    
    /// Overall suitability
    pub fn suitability_score(&self) -> f64 {
        0.6 * self.conservation_score() + 0.4 * self.effectiveness_score()
    }
}

// ============================================================================
// DAMAGE ASSESSMENT
// ============================================================================

/// Damage classification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DamageAssessment {
    /// Crack pattern
    pub cracks: CrackPattern,
    /// Maximum crack width (mm)
    pub max_crack_width: f64,
    /// Out-of-plumb (mm/m)
    pub out_of_plumb: f64,
    /// Settlement (mm)
    pub settlement: f64,
    /// Damage grade
    pub grade: DamageGrade,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum CrackPattern {
    None,
    HairlineFine,
    DiagonalShear,
    HorizontalFlexure,
    Vertical,
    Corner,
    AroundOpenings,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, PartialOrd)]
pub enum DamageGrade {
    D0, // None
    D1, // Negligible to slight
    D2, // Moderate
    D3, // Substantial to heavy
    D4, // Very heavy
    D5, // Destruction
}

impl DamageAssessment {
    pub fn from_observations(
        max_crack: f64,
        out_of_plumb: f64,
        settlement: f64,
        pattern: CrackPattern
    ) -> Self {
        let grade = Self::determine_grade(max_crack, out_of_plumb, settlement);
        
        Self {
            cracks: pattern,
            max_crack_width: max_crack,
            out_of_plumb,
            settlement,
            grade,
        }
    }
    
    fn determine_grade(crack: f64, plumb: f64, settle: f64) -> DamageGrade {
        let crack_grade = if crack < 0.1 { 0 }
        else if crack < 1.0 { 1 }
        else if crack < 5.0 { 2 }
        else if crack < 15.0 { 3 }
        else if crack < 25.0 { 4 }
        else { 5 };
        
        let plumb_grade = if plumb < 1.0 { 0 }
        else if plumb < 5.0 { 1 }
        else if plumb < 10.0 { 2 }
        else if plumb < 20.0 { 3 }
        else { 4 };
        
        let settle_grade = if settle < 5.0 { 0 }
        else if settle < 15.0 { 1 }
        else if settle < 30.0 { 2 }
        else { 3 };
        
        let max_grade = crack_grade.max(plumb_grade).max(settle_grade);
        
        match max_grade {
            0 => DamageGrade::D0,
            1 => DamageGrade::D1,
            2 => DamageGrade::D2,
            3 => DamageGrade::D3,
            4 => DamageGrade::D4,
            _ => DamageGrade::D5,
        }
    }
    
    /// Estimated capacity reduction
    pub fn capacity_reduction(&self) -> f64 {
        match self.grade {
            DamageGrade::D0 => 1.0,
            DamageGrade::D1 => 0.95,
            DamageGrade::D2 => 0.8,
            DamageGrade::D3 => 0.6,
            DamageGrade::D4 => 0.3,
            DamageGrade::D5 => 0.0,
        }
    }
    
    /// Urgency of intervention
    pub fn intervention_urgency(&self) -> &'static str {
        match self.grade {
            DamageGrade::D0 => "No intervention needed",
            DamageGrade::D1 => "Monitoring recommended",
            DamageGrade::D2 => "Repair within 1-2 years",
            DamageGrade::D3 => "Repair within 6 months",
            DamageGrade::D4 => "Immediate action required",
            DamageGrade::D5 => "Structure unsafe - evacuate",
        }
    }
}

// ============================================================================
// VULNERABILITY INDEX
// ============================================================================

/// Vulnerability index method
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VulnerabilityIndex {
    /// Plan regularity (1-4)
    pub plan_regularity: u8,
    /// Vertical regularity (1-4)
    pub vertical_regularity: u8,
    /// Wall-floor connections (1-4)
    pub connections: u8,
    /// Wall density ratio x (%)
    pub wall_density_x: f64,
    /// Wall density ratio y (%)
    pub wall_density_y: f64,
    /// Height (stories)
    pub stories: u32,
    /// Foundation condition (1-4)
    pub foundation: u8,
}

impl VulnerabilityIndex {
    pub fn new() -> Self {
        Self {
            plan_regularity: 2,
            vertical_regularity: 2,
            connections: 2,
            wall_density_x: 5.0,
            wall_density_y: 5.0,
            stories: 2,
            foundation: 2,
        }
    }
    
    /// Calculate GNDT vulnerability index (0-100)
    pub fn gndt_index(&self) -> f64 {
        // GNDT Level II simplified
        let p1 = (self.plan_regularity - 1) as f64 * 15.0;
        let p2 = (self.vertical_regularity - 1) as f64 * 15.0;
        let p3 = (self.connections - 1) as f64 * 20.0;
        let p4 = if self.wall_density_x.min(self.wall_density_y) > 6.0 { 0.0 }
                 else if self.wall_density_x.min(self.wall_density_y) > 4.0 { 15.0 }
                 else { 30.0 };
        let p5 = if self.stories <= 2 { 0.0 }
                 else if self.stories <= 4 { 10.0 }
                 else { 20.0 };
        let p6 = (self.foundation - 1) as f64 * 10.0;
        
        (p1 + p2 + p3 + p4 + p5 + p6).min(100.0)
    }
    
    /// Expected damage factor (EMS-98)
    pub fn expected_damage(&self, intensity: u8) -> f64 {
        let iv = self.gndt_index();
        let d0 = 2.5 + 0.03 * iv;
        
        // Mean damage grade
        let mu_d = 2.5 * (1.0 + ((intensity as f64 - d0) / 2.3).tanh());
        
        mu_d
    }
    
    /// Fragility curve parameters
    pub fn fragility_parameters(&self) -> (f64, f64) {
        let iv = self.gndt_index();
        
        // Median PGA for damage state 3
        let theta = 0.3 * (-0.01 * iv).exp();
        // Dispersion
        let beta = 0.4 + 0.005 * iv;
        
        (theta, beta)
    }
    
    /// Probability of damage state exceedance
    pub fn probability_exceedance(&self, pga: f64, damage_state: DamageGrade) -> f64 {
        let (theta, beta) = self.fragility_parameters();
        
        let ds_factor = match damage_state {
            DamageGrade::D0 => return 1.0,
            DamageGrade::D1 => 0.5,
            DamageGrade::D2 => 0.75,
            DamageGrade::D3 => 1.0,
            DamageGrade::D4 => 1.5,
            DamageGrade::D5 => 2.0,
        };
        
        let theta_ds = theta * ds_factor;
        
        // Log-normal CDF
        0.5 * (1.0 + erf((pga / theta_ds).ln() / (beta * 2.0_f64.sqrt())))
    }
}

impl Default for VulnerabilityIndex {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_masonry_properties() {
        let stone = HistoricMasonry::rubble_stone();
        let brick = HistoricMasonry::soft_mud_brick();
        
        assert!(stone.fm < brick.fm);
    }

    #[test]
    fn test_confidence_factor() {
        let masonry = HistoricMasonry::dressed_stone();
        
        let cf1 = masonry.confidence_factor(KnowledgeLevel::KL1);
        let cf3 = masonry.confidence_factor(KnowledgeLevel::KL3);
        
        assert!(cf1 > cf3);
    }

    #[test]
    fn test_wall_capacity() {
        let masonry = HistoricMasonry::soft_mud_brick();
        let wall = MasonryWall::new(5.0, 3.0, 400.0, masonry);
        
        let n = wall.axial_capacity(1.2);
        assert!(n > 1000.0);
    }

    #[test]
    fn test_slenderness() {
        let masonry = HistoricMasonry::rubble_stone();
        let wall = MasonryWall::new(4.0, 4.0, 500.0, masonry);
        
        let sr = wall.slenderness();
        assert!(sr > 5.0 && sr < 20.0);
    }

    #[test]
    fn test_timber_capacity() {
        let beam = HistoricTimber::oak_beam(200.0, 300.0);
        
        let m = beam.moment_capacity();
        assert!(m > 10.0);
    }

    #[test]
    fn test_decay_effect() {
        let sound = HistoricTimber {
            decay: DecayCondition::Sound,
            ..HistoricTimber::oak_beam(200.0, 300.0)
        };
        let decayed = HistoricTimber {
            decay: DecayCondition::Moderate,
            ..HistoricTimber::oak_beam(200.0, 300.0)
        };
        
        assert!(sound.moment_capacity() > decayed.moment_capacity());
    }

    #[test]
    fn test_intervention() {
        let repoint = RetrofitIntervention::mortar_repointing();
        let frp = RetrofitIntervention::frp_strengthening();
        
        assert!(repoint.conservation_score() > frp.conservation_score());
        assert!(frp.effectiveness_score() > repoint.effectiveness_score());
    }

    #[test]
    fn test_damage_grade() {
        let minor = DamageAssessment::from_observations(
            0.5, 2.0, 5.0, CrackPattern::HairlineFine
        );
        let severe = DamageAssessment::from_observations(
            20.0, 15.0, 40.0, CrackPattern::DiagonalShear
        );
        
        assert!(minor.grade < severe.grade);
    }

    #[test]
    fn test_vulnerability_index() {
        let vi = VulnerabilityIndex::new();
        
        let iv = vi.gndt_index();
        assert!(iv >= 0.0 && iv <= 100.0);
    }

    #[test]
    fn test_fragility() {
        let vi = VulnerabilityIndex {
            plan_regularity: 3,
            vertical_regularity: 2,
            connections: 2,
            wall_density_x: 4.0,
            wall_density_y: 5.0,
            stories: 3,
            foundation: 2,
        };
        
        let p = vi.probability_exceedance(0.2, DamageGrade::D3);
        assert!(p > 0.0 && p < 1.0);
    }
}
