//! Seismic Drift Checks
//!
//! Story drift and displacement checks per multiple seismic codes:
//! ASCE 7-22, IS 1893:2016, Eurocode 8, IBC 2021.
//!
//! ## Features
//! - Story drift ratio computation
//! - Multi-code drift limits
//! - Torsional irregularity checks
//! - P-Delta stability coefficient
//! - Deflection amplification factors
//! - Drift reporting by story and direction

use serde::{Deserialize, Serialize};

// ============================================================================
// SEISMIC DESIGN CODES
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SeismicDriftCode {
    /// ASCE 7-22 / IBC 2021
    ASCE7_22,
    /// IS 1893:2016 (India)
    IS1893_2016,
    /// Eurocode 8
    EN1998,
    /// IBC 2018
    IBC2018,
    /// NBC 2015 (Canada)
    NBC2015,
    /// NZS 1170.5 (New Zealand)
    NZS1170,
    /// NBCC 2020
    NBCC2020,
}

impl Default for SeismicDriftCode {
    fn default() -> Self {
        SeismicDriftCode::ASCE7_22
    }
}

// ============================================================================
// RISK/OCCUPANCY CATEGORIES
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum RiskCategory {
    /// I - Low hazard to human life
    I,
    /// II - Normal occupancy
    II,
    /// III - High occupancy
    III,
    /// IV - Essential facilities
    IV,
}

impl Default for RiskCategory {
    fn default() -> Self {
        RiskCategory::II
    }
}

// ============================================================================
// STRUCTURAL SYSTEM TYPES
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum StructuralSystem {
    /// Steel moment frame (special)
    SteelSMRF,
    /// Steel moment frame (intermediate)
    SteelIMRF,
    /// Steel moment frame (ordinary)
    SteelOMRF,
    /// Steel braced frame (special)
    SteelSCBF,
    /// Steel braced frame (ordinary)
    SteelOCBF,
    /// Steel EBF
    SteelEBF,
    /// Concrete moment frame (special)
    ConcreteSMRF,
    /// Concrete moment frame (intermediate)
    ConcreteIMRF,
    /// Concrete moment frame (ordinary)
    ConcreteOMRF,
    /// Concrete shear wall (special)
    ConcreteSpecialWall,
    /// Concrete shear wall (ordinary)
    ConcreteOrdinaryWall,
    /// Dual system
    DualSystem,
    /// Bearing wall system
    BearingWall,
    /// Other
    Other,
}

impl StructuralSystem {
    /// Get deflection amplification factor Cd (ASCE 7)
    pub fn cd_factor(&self) -> f64 {
        match self {
            StructuralSystem::SteelSMRF => 5.5,
            StructuralSystem::SteelIMRF => 4.0,
            StructuralSystem::SteelOMRF => 3.0,
            StructuralSystem::SteelSCBF => 5.0,
            StructuralSystem::SteelOCBF => 3.25,
            StructuralSystem::SteelEBF => 4.0,
            StructuralSystem::ConcreteSMRF => 5.5,
            StructuralSystem::ConcreteIMRF => 4.5,
            StructuralSystem::ConcreteOMRF => 2.5,
            StructuralSystem::ConcreteSpecialWall => 5.0,
            StructuralSystem::ConcreteOrdinaryWall => 4.0,
            StructuralSystem::DualSystem => 5.5,
            StructuralSystem::BearingWall => 4.0,
            StructuralSystem::Other => 3.0,
        }
    }
    
    /// Get importance factor Ie for risk category (ASCE 7)
    pub fn importance_factor(&self, risk: RiskCategory) -> f64 {
        match risk {
            RiskCategory::I => 1.0,
            RiskCategory::II => 1.0,
            RiskCategory::III => 1.25,
            RiskCategory::IV => 1.5,
        }
    }
}

// ============================================================================
// DRIFT LIMITS
// ============================================================================

/// Story drift limits per code
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriftLimits {
    /// Code used
    pub code: SeismicDriftCode,
    /// Allowable drift ratio for Risk I/II
    pub limit_normal: f64,
    /// Allowable drift ratio for Risk III
    pub limit_high: f64,
    /// Allowable drift ratio for Risk IV
    pub limit_essential: f64,
}

impl DriftLimits {
    /// Get ASCE 7-22 / IBC drift limits (Table 12.12-1)
    pub fn asce7() -> Self {
        DriftLimits {
            code: SeismicDriftCode::ASCE7_22,
            limit_normal: 0.020,    // 2.0% for Risk I/II
            limit_high: 0.015,      // 1.5% for Risk III
            limit_essential: 0.010, // 1.0% for Risk IV
        }
    }
    
    /// Get IS 1893:2016 drift limits
    pub fn is1893() -> Self {
        DriftLimits {
            code: SeismicDriftCode::IS1893_2016,
            limit_normal: 0.004,    // 0.4% for normal buildings
            limit_high: 0.004,      // Same
            limit_essential: 0.004, // Same
        }
    }
    
    /// Get Eurocode 8 drift limits (EN 1998-1 Cl. 4.4.3.2)
    /// Note: EC8 limits depend on non-structural element type, not risk category.
    /// limit_normal → non-interfering non-structural elements (dr·ν ≤ 0.010h)
    /// limit_high → ductile non-structural elements (dr·ν ≤ 0.0075h)
    /// limit_essential → brittle non-structural elements (dr·ν ≤ 0.005h)
    /// The ν factor (0.5 for importance I/II, 0.4 for III/IV) must be applied
    /// to the computed drift before comparing against these limits.
    pub fn en1998() -> Self {
        DriftLimits {
            code: SeismicDriftCode::EN1998,
            limit_normal: 0.010,    // non-interfering non-structural elements
            limit_high: 0.0075,     // ductile non-structural elements
            limit_essential: 0.005, // brittle non-structural elements
        }
    }
    
    /// Get limit for risk category
    pub fn get_limit(&self, risk: RiskCategory) -> f64 {
        match risk {
            RiskCategory::I | RiskCategory::II => self.limit_normal,
            RiskCategory::III => self.limit_high,
            RiskCategory::IV => self.limit_essential,
        }
    }
}

// ============================================================================
// STORY DRIFT DATA
// ============================================================================

/// Story information for drift analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Story {
    /// Story ID/name
    pub id: String,
    /// Story level number (1 = first above ground)
    pub level: usize,
    /// Story height (mm)
    pub height: f64,
    /// Elevation at top of story (mm)
    pub elevation: f64,
    /// Total vertical design load at AND above this level, Px (kN)
    /// Per ASCE 7-22 §12.8.7: Px includes all gravity load at and above level x
    pub weight: f64,
    /// Story shear in X (kN)
    pub vx: f64,
    /// Story shear in Y (kN)
    pub vy: f64,
}

/// Displacement results at a story
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct StoryDisplacements {
    /// Maximum X displacement (mm)
    pub dx_max: f64,
    /// Minimum X displacement (mm)
    pub dx_min: f64,
    /// Maximum Y displacement (mm)
    pub dy_max: f64,
    /// Minimum Y displacement (mm)
    pub dy_min: f64,
    /// Average X displacement (mm)
    pub dx_avg: f64,
    /// Average Y displacement (mm)
    pub dy_avg: f64,
    /// Rotation about Z (radians)
    pub rz: f64,
}

/// Story drift results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoryDriftResult {
    /// Story ID
    pub story_id: String,
    /// Story level
    pub level: usize,
    /// Story height (mm)
    pub height: f64,
    /// Elastic drift X (mm)
    pub drift_xe: f64,
    /// Elastic drift Y (mm)
    pub drift_ye: f64,
    /// Amplified drift X (mm) - δx × Cd / Ie
    pub drift_x: f64,
    /// Amplified drift Y (mm)
    pub drift_y: f64,
    /// Drift ratio X (Δ/h)
    pub ratio_x: f64,
    /// Drift ratio Y (Δ/h)
    pub ratio_y: f64,
    /// Allowable drift ratio
    pub allowable: f64,
    /// DCR X (demand/capacity ratio)
    pub dcr_x: f64,
    /// DCR Y (demand/capacity ratio)
    pub dcr_y: f64,
    /// Passes drift check
    pub passes_x: bool,
    pub passes_y: bool,
    /// Maximum torsional ratio (δmax/δavg)
    pub torsion_ratio_x: f64,
    pub torsion_ratio_y: f64,
    /// Torsional irregularity type
    pub torsion_irregularity: Option<TorsionalIrregularity>,
    /// P-Delta stability coefficient θ
    pub theta_x: f64,
    pub theta_y: f64,
}

// ============================================================================
// TORSIONAL IRREGULARITY
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum TorsionalIrregularity {
    /// No irregularity (ratio < 1.2)
    None,
    /// Type 1a: Torsional (1.2 ≤ ratio < 1.4)
    Type1a,
    /// Type 1b: Extreme torsional (ratio ≥ 1.4)
    Type1b,
}

impl TorsionalIrregularity {
    pub fn from_ratio(ratio: f64) -> Self {
        if ratio >= 1.4 {
            TorsionalIrregularity::Type1b
        } else if ratio >= 1.2 {
            TorsionalIrregularity::Type1a
        } else {
            TorsionalIrregularity::None
        }
    }
    
    pub fn description(&self) -> &'static str {
        match self {
            TorsionalIrregularity::None => "No torsional irregularity",
            TorsionalIrregularity::Type1a => "Type 1a: Torsional Irregularity",
            TorsionalIrregularity::Type1b => "Type 1b: Extreme Torsional Irregularity",
        }
    }
}

// ============================================================================
// DRIFT ANALYZER
// ============================================================================

/// Configuration for drift analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriftConfig {
    /// Seismic code
    pub code: SeismicDriftCode,
    /// Risk category
    pub risk_category: RiskCategory,
    /// Structural system
    pub system: StructuralSystem,
    /// Deflection amplification factor Cd
    pub cd: f64,
    /// Importance factor Ie
    pub ie: f64,
    /// Consider P-Delta effects
    pub check_pdelta: bool,
    /// P-Delta stability limit θmax
    /// ASCE 7: θmax = 0.5/(β×Cd) ≤ 0.25; 0.10 is only the threshold
    /// below which P-Delta effects may be neglected, NOT the structural limit.
    pub theta_max: f64,
}

impl Default for DriftConfig {
    fn default() -> Self {
        let system = StructuralSystem::ConcreteSMRF;
        let risk = RiskCategory::II;
        DriftConfig {
            code: SeismicDriftCode::ASCE7_22,
            risk_category: risk,
            system,
            cd: system.cd_factor(),
            ie: system.importance_factor(risk),
            check_pdelta: true,
            theta_max: 0.25, // ASCE 7-22 upper bound: θmax = 0.5/(β×Cd) ≤ 0.25
        }
    }
}

/// Story drift analyzer
pub struct DriftAnalyzer {
    pub config: DriftConfig,
    pub limits: DriftLimits,
}

impl DriftAnalyzer {
    pub fn new(config: DriftConfig) -> Self {
        let limits = match config.code {
            SeismicDriftCode::ASCE7_22 | SeismicDriftCode::IBC2018 => DriftLimits::asce7(),
            SeismicDriftCode::IS1893_2016 => DriftLimits::is1893(),
            SeismicDriftCode::EN1998 => DriftLimits::en1998(),
            _ => DriftLimits::asce7(),
        };
        
        DriftAnalyzer { config, limits }
    }
    
    /// Compute story drifts from displacement results
    pub fn compute_drifts(
        &self,
        stories: &[Story],
        displacements: &[StoryDisplacements],
    ) -> Vec<StoryDriftResult> {
        if stories.len() != displacements.len() {
            return Vec::new();
        }
        
        let mut results = Vec::new();
        let allowable = self.limits.get_limit(self.config.risk_category);
        
        for i in 0..stories.len() {
            let story = &stories[i];
            let disp = &displacements[i];
            
            // Get displacement at story below (or 0 for first story)
            let (dx_below, dy_below) = if i == 0 {
                (0.0, 0.0)
            } else {
                (displacements[i - 1].dx_avg, displacements[i - 1].dy_avg)
            };
            
            // Elastic drift (relative displacement)
            let drift_xe = disp.dx_avg - dx_below;
            let drift_ye = disp.dy_avg - dy_below;
            
            // Amplified drift: δ × Cd / Ie
            let drift_x = drift_xe * self.config.cd / self.config.ie;
            let drift_y = drift_ye * self.config.cd / self.config.ie;
            
            // Drift ratio
            let ratio_x = drift_x.abs() / story.height;
            let ratio_y = drift_y.abs() / story.height;
            
            // DCR
            let dcr_x = ratio_x / allowable;
            let dcr_y = ratio_y / allowable;
            
            // Torsional ratio (max/avg) per ASCE 7-22 Table 12.3-1
            // Must use STORY DRIFTS at diaphragm edges, not total displacements
            let (dx_max_below, dx_min_below, dy_max_below, dy_min_below) = if i == 0 {
                (0.0, 0.0, 0.0, 0.0)
            } else {
                let dp = &displacements[i - 1];
                (dp.dx_max, dp.dx_min, dp.dy_max, dp.dy_min)
            };
            let drift_dx_max = (disp.dx_max - dx_max_below).abs();
            let drift_dx_min = (disp.dx_min - dx_min_below).abs();
            let drift_dy_max = (disp.dy_max - dy_max_below).abs();
            let drift_dy_min = (disp.dy_min - dy_min_below).abs();
            let drift_dx_avg = (drift_dx_max + drift_dx_min) / 2.0;
            let drift_dy_avg = (drift_dy_max + drift_dy_min) / 2.0;
            let torsion_ratio_x = if drift_dx_avg > 1e-6 {
                drift_dx_max.max(drift_dx_min) / drift_dx_avg
            } else {
                1.0
            };
            let torsion_ratio_y = if drift_dy_avg > 1e-6 {
                drift_dy_max.max(drift_dy_min) / drift_dy_avg
            } else {
                1.0
            };
            
            let torsion_irregularity = TorsionalIrregularity::from_ratio(
                torsion_ratio_x.max(torsion_ratio_y)
            );
            
            // P-Delta stability coefficient θ = (Px × Δ) / (Vx × hsx × Cd)
            let theta_x = if self.config.check_pdelta && story.vx.abs() > 1e-6 {
                (story.weight * drift_x.abs()) / 
                (story.vx.abs() * story.height * self.config.cd)
            } else {
                0.0
            };
            let theta_y = if self.config.check_pdelta && story.vy.abs() > 1e-6 {
                (story.weight * drift_y.abs()) / 
                (story.vy.abs() * story.height * self.config.cd)
            } else {
                0.0
            };
            
            results.push(StoryDriftResult {
                story_id: story.id.clone(),
                level: story.level,
                height: story.height,
                drift_xe,
                drift_ye,
                drift_x,
                drift_y,
                ratio_x,
                ratio_y,
                allowable,
                dcr_x,
                dcr_y,
                passes_x: ratio_x <= allowable,
                passes_y: ratio_y <= allowable,
                torsion_ratio_x,
                torsion_ratio_y,
                torsion_irregularity: if matches!(torsion_irregularity, TorsionalIrregularity::None) {
                    None
                } else {
                    Some(torsion_irregularity)
                },
                theta_x,
                theta_y,
            });
        }
        
        results
    }
    
    /// Check P-Delta stability
    pub fn check_pdelta_stability(&self, results: &[StoryDriftResult]) -> PDeltaCheck {
        let mut max_theta = 0.0;
        let mut critical_story = String::new();
        let mut issues = Vec::new();
        
        for result in results {
            let theta = result.theta_x.max(result.theta_y);
            if theta > max_theta {
                max_theta = theta;
                critical_story = result.story_id.clone();
            }
            
            if theta > self.config.theta_max {
                issues.push(format!(
                    "Story {}: θ = {:.3} > {:.3} limit",
                    result.story_id, theta, self.config.theta_max
                ));
            }
        }
        
        PDeltaCheck {
            max_theta,
            critical_story,
            theta_limit: self.config.theta_max,
            passes: max_theta <= self.config.theta_max,
            issues,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PDeltaCheck {
    pub max_theta: f64,
    pub critical_story: String,
    pub theta_limit: f64,
    pub passes: bool,
    pub issues: Vec<String>,
}

// ============================================================================
// DRIFT SUMMARY REPORT
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriftSummary {
    /// Code used
    pub code: SeismicDriftCode,
    /// Risk category
    pub risk_category: RiskCategory,
    /// Allowable drift ratio
    pub allowable_ratio: f64,
    /// Maximum drift ratio X
    pub max_ratio_x: f64,
    /// Maximum drift ratio Y
    pub max_ratio_y: f64,
    /// Critical story X
    pub critical_story_x: String,
    /// Critical story Y
    pub critical_story_y: String,
    /// Maximum DCR
    pub max_dcr: f64,
    /// Overall pass/fail
    pub passes: bool,
    /// Torsional irregularity detected
    pub has_torsion_irregularity: bool,
    /// P-Delta check result
    pub pdelta_check: PDeltaCheck,
    /// Number of stories checked
    pub num_stories: usize,
    /// Number of stories failing
    pub num_failing: usize,
}

/// Generate drift summary from results
pub fn generate_drift_summary(
    results: &[StoryDriftResult],
    analyzer: &DriftAnalyzer,
) -> DriftSummary {
    let mut max_ratio_x = 0.0;
    let mut max_ratio_y = 0.0;
    let mut critical_story_x = String::new();
    let mut critical_story_y = String::new();
    let mut has_torsion = false;
    let mut num_failing = 0;
    
    for result in results {
        if result.ratio_x > max_ratio_x {
            max_ratio_x = result.ratio_x;
            critical_story_x = result.story_id.clone();
        }
        if result.ratio_y > max_ratio_y {
            max_ratio_y = result.ratio_y;
            critical_story_y = result.story_id.clone();
        }
        if result.torsion_irregularity.is_some() {
            has_torsion = true;
        }
        if !result.passes_x || !result.passes_y {
            num_failing += 1;
        }
    }
    
    let max_dcr = results.iter()
        .map(|r| r.dcr_x.max(r.dcr_y))
        .fold(0.0, f64::max);
    
    let pdelta_check = analyzer.check_pdelta_stability(results);
    
    DriftSummary {
        code: analyzer.config.code,
        risk_category: analyzer.config.risk_category,
        allowable_ratio: analyzer.limits.get_limit(analyzer.config.risk_category),
        max_ratio_x,
        max_ratio_y,
        critical_story_x,
        critical_story_y,
        max_dcr,
        passes: num_failing == 0 && pdelta_check.passes,
        has_torsion_irregularity: has_torsion,
        pdelta_check,
        num_stories: results.len(),
        num_failing,
    }
}

// ============================================================================
// CODE-SPECIFIC UTILITIES
// ============================================================================

/// Get drift limit description per code
pub fn drift_limit_description(code: SeismicDriftCode) -> String {
    match code {
        SeismicDriftCode::ASCE7_22 => 
            "ASCE 7-22 Table 12.12-1: Δa = 0.020hsx (Risk I/II), 0.015hsx (III), 0.010hsx (IV)".to_string(),
        SeismicDriftCode::IS1893_2016 =>
            "IS 1893:2016 Cl. 7.11.1: Story drift ≤ 0.004 × story height".to_string(),
        SeismicDriftCode::EN1998 =>
            "EN 1998-1 Cl. 4.4.3.2: dr × ν ≤ 0.005h to 0.010h (depending on non-structural)".to_string(),
        _ => format!("{:?} drift limits", code),
    }
}

/// IS 1893 specific drift check
pub fn check_drift_is1893(
    stories: &[Story],
    displacements: &[StoryDisplacements],
    importance_factor: f64,
    response_reduction: f64,
) -> Vec<StoryDriftResult> {
    let mut config = DriftConfig::default();
    config.code = SeismicDriftCode::IS1893_2016;
    // IS 1893: Actual displacement = (R × δe) / I
    config.cd = response_reduction;
    config.ie = importance_factor;
    
    let analyzer = DriftAnalyzer::new(config);
    analyzer.compute_drifts(stories, displacements)
}

/// ASCE 7 Redundancy factor ρ
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum RedundancyFactor {
    /// ρ = 1.0 (adequate redundancy)
    Rho1_0,
    /// ρ = 1.3 (insufficient redundancy)
    Rho1_3,
}

impl RedundancyFactor {
    pub fn value(&self) -> f64 {
        match self {
            RedundancyFactor::Rho1_0 => 1.0,
            RedundancyFactor::Rho1_3 => 1.3,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_drift_limits() {
        let asce = DriftLimits::asce7();
        assert!((asce.get_limit(RiskCategory::II) - 0.020).abs() < 0.001);
        assert!((asce.get_limit(RiskCategory::IV) - 0.010).abs() < 0.001);
        
        let is1893 = DriftLimits::is1893();
        assert!((is1893.get_limit(RiskCategory::II) - 0.004).abs() < 0.001);
    }
    
    #[test]
    fn test_torsional_irregularity() {
        assert_eq!(TorsionalIrregularity::from_ratio(1.0), TorsionalIrregularity::None);
        assert_eq!(TorsionalIrregularity::from_ratio(1.25), TorsionalIrregularity::Type1a);
        assert_eq!(TorsionalIrregularity::from_ratio(1.5), TorsionalIrregularity::Type1b);
    }
    
    #[test]
    fn test_drift_analyzer() {
        let config = DriftConfig::default();
        let analyzer = DriftAnalyzer::new(config);
        
        let stories = vec![
            Story {
                id: "Story 1".to_string(),
                level: 1,
                height: 4000.0,
                elevation: 4000.0,
                weight: 5000.0,
                vx: 800.0,
                vy: 600.0,
            },
            Story {
                id: "Story 2".to_string(),
                level: 2,
                height: 3500.0,
                elevation: 7500.0,
                weight: 4500.0,
                vx: 600.0,
                vy: 450.0,
            },
        ];
        
        let displacements = vec![
            StoryDisplacements {
                dx_avg: 15.0,
                dy_avg: 12.0,
                dx_max: 18.0,
                dx_min: 12.0,
                dy_max: 14.0,
                dy_min: 10.0,
                rz: 0.001,
            },
            StoryDisplacements {
                dx_avg: 35.0,
                dy_avg: 28.0,
                dx_max: 42.0,
                dx_min: 28.0,
                dy_max: 33.0,
                dy_min: 23.0,
                rz: 0.002,
            },
        ];
        
        let results = analyzer.compute_drifts(&stories, &displacements);
        
        assert_eq!(results.len(), 2);
        assert!(results[0].drift_x > 0.0);
        assert!(results[0].ratio_x > 0.0);
    }
    
    #[test]
    fn test_structural_system() {
        let smrf = StructuralSystem::SteelSMRF;
        assert!((smrf.cd_factor() - 5.5).abs() < 0.1);
        assert!((smrf.importance_factor(RiskCategory::IV) - 1.5).abs() < 0.1);
    }
    
    #[test]
    fn test_drift_summary() {
        let config = DriftConfig::default();
        let analyzer = DriftAnalyzer::new(config);
        
        let stories = vec![Story {
            id: "S1".to_string(),
            level: 1,
            height: 4000.0,
            elevation: 4000.0,
            weight: 5000.0,
            vx: 500.0,
            vy: 400.0,
        }];
        
        let displacements = vec![StoryDisplacements {
            dx_avg: 10.0,
            dy_avg: 8.0,
            dx_max: 12.0,
            dx_min: 8.0,
            dy_max: 10.0,
            dy_min: 6.0,
            rz: 0.001,
        }];
        
        let results = analyzer.compute_drifts(&stories, &displacements);
        let summary = generate_drift_summary(&results, &analyzer);
        
        assert!(summary.max_ratio_x > 0.0);
        assert_eq!(summary.num_stories, 1);
    }
}
