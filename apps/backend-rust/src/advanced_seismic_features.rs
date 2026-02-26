// ============================================================================
// ADVANCED SEISMIC ANALYSIS FEATURES
// ============================================================================
//
// Industry-standard seismic features per ASCE 7-22, IS 1893, Eurocode 8:
// - Accidental torsion (5% eccentricity)
// - Vertical earthquake components
// - P-Delta effects (second-order)
// - Diaphragm flexibility
// - Irregularity detection
// - R/Ω0/Cd parameter validation
//
// Industry Parity: ETABS, SAP2000, STAAD.Pro
// ============================================================================

use serde::{Deserialize, Serialize};

// ============================================================================
// ACCIDENTAL TORSION
// ============================================================================

/// Accidental torsion parameters per ASCE 7-22 Section 12.8.4.2
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccidentalTorsion {
    /// Eccentricity ratio (default 0.05 = 5%)
    pub eccentricity_ratio: f64,
    /// Floor dimensions for eccentricity calculation
    pub floor_dimensions: Vec<FloorDimension>,
    /// Amplification factor Ax (ASCE 7-22 Eq. 12.8-14)
    pub amplification_factors: Vec<f64>,
    /// Torsional irregularity flag
    pub has_torsional_irregularity: bool,
    /// Extreme torsional irregularity flag
    pub has_extreme_torsional_irregularity: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FloorDimension {
    pub floor_level: usize,
    pub elevation: f64,
    /// Building dimension perpendicular to earthquake direction (Lx)
    pub lx: f64,
    /// Building dimension parallel to earthquake direction (Ly)
    pub ly: f64,
    /// Center of mass coordinates
    pub cm_x: f64,
    pub cm_y: f64,
    /// Center of rigidity coordinates
    pub cr_x: f64,
    pub cr_y: f64,
}

impl AccidentalTorsion {
    /// Create new accidental torsion calculator
    pub fn new(eccentricity_ratio: f64) -> Self {
        Self {
            eccentricity_ratio: eccentricity_ratio.clamp(0.0, 0.10),
            floor_dimensions: Vec::new(),
            amplification_factors: Vec::new(),
            has_torsional_irregularity: false,
            has_extreme_torsional_irregularity: false,
        }
    }

    /// Add floor dimensions
    pub fn add_floor(&mut self, floor: FloorDimension) {
        self.floor_dimensions.push(floor);
    }

    /// Calculate accidental eccentricity for each floor
    /// Per ASCE 7-22 Section 12.8.4.2: e_accidental = 0.05 * L
    pub fn calculate_eccentricities(&self, direction: SeismicDirection) -> Vec<f64> {
        self.floor_dimensions
            .iter()
            .map(|floor| {
                let dimension = match direction {
                    SeismicDirection::X => floor.ly, // Perpendicular to X
                    SeismicDirection::Y => floor.lx, // Perpendicular to Y
                };
                self.eccentricity_ratio * dimension
            })
            .collect()
    }

    /// Calculate torsional amplification factor Ax
    /// Per ASCE 7-22 Eq. 12.8-14: Ax = (δmax / 1.2 * δavg)² ≤ 3.0
    pub fn calculate_amplification(
        &mut self,
        max_drifts: &[f64],
        avg_drifts: &[f64],
    ) -> Vec<f64> {
        let factors: Vec<f64> = max_drifts
            .iter()
            .zip(avg_drifts.iter())
            .map(|(&max, &avg)| {
                if avg > 0.0 {
                    let ax = (max / (1.2 * avg)).powi(2);
                    ax.clamp(1.0, 3.0)
                } else {
                    1.0
                }
            })
            .collect();

        // Check torsional irregularity
        for (&max, &avg) in max_drifts.iter().zip(avg_drifts.iter()) {
            if avg > 0.0 {
                let ratio = max / avg;
                if ratio > 1.4 {
                    self.has_extreme_torsional_irregularity = true;
                    self.has_torsional_irregularity = true;
                } else if ratio > 1.2 {
                    self.has_torsional_irregularity = true;
                }
            }
        }

        self.amplification_factors = factors.clone();
        factors
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SeismicDirection {
    X,
    Y,
}

// ============================================================================
// VERTICAL EARTHQUAKE
// ============================================================================

/// Vertical earthquake component per ASCE 7-22 Section 12.4.2.2
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerticalEarthquake {
    /// SDS (Short period design spectral acceleration)
    pub sds: f64,
    /// Ev = 0.2 * SDS * D (vertical seismic effect)
    pub ev_factor: f64,
    /// Apply to cantilevers and prestressed elements
    pub apply_to_cantilevers: bool,
    /// Apply to horizontal components supporting discontinuous elements
    pub apply_to_discontinuous: bool,
}

impl VerticalEarthquake {
    /// Create vertical earthquake calculator
    /// Per ASCE 7-22 Section 12.4.2.2
    pub fn new(sds: f64) -> Self {
        Self {
            sds,
            ev_factor: 0.2 * sds,
            apply_to_cantilevers: true,
            apply_to_discontinuous: true,
        }
    }

    /// Calculate vertical seismic effect Ev
    /// Ev = 0.2 * SDS * D (where D is dead load effect)
    pub fn calculate_ev(&self, dead_load_effect: f64) -> f64 {
        self.ev_factor * dead_load_effect
    }

    /// Calculate vertical ground motion Evns for nonstructural
    pub fn calculate_evns(&self, weight: f64, z: f64, h: f64, ap: f64, rp: f64, ip: f64) -> f64 {
        // Per ASCE 7-22 Eq. 13.3-1 (simplified vertical component)
        let height_factor = 1.0 + 2.0 * (z / h);
        0.2 * self.sds * weight * ap * ip / rp * height_factor * 0.67
    }
}

// ============================================================================
// P-DELTA EFFECTS
// ============================================================================

/// P-Delta analysis per ASCE 7-22 Section 12.8.7
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PDeltaAnalysis {
    /// Stability coefficients per story
    pub stability_coefficients: Vec<StoryStability>,
    /// Maximum allowed stability coefficient (0.10 without analysis, 0.25 max)
    pub theta_max: f64,
    /// P-Delta amplification factors
    pub amplification_factors: Vec<f64>,
    /// Requires second-order analysis
    pub requires_second_order: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoryStability {
    pub story: usize,
    /// Story height
    pub height: f64,
    /// Total vertical load at and above story (Px)
    pub px: f64,
    /// Story shear (Vx)
    pub vx: f64,
    /// Design story drift (Δ)
    pub delta: f64,
    /// Deflection amplification factor (Cd)
    pub cd: f64,
    /// Importance factor
    pub ie: f64,
    /// Stability coefficient θ
    pub theta: f64,
    /// Stability status
    pub status: StabilityStatus,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StabilityStatus {
    /// θ ≤ 0.10 - P-Delta can be ignored
    Negligible,
    /// 0.10 < θ ≤ θmax - amplify forces by 1/(1-θ)
    RequiresAmplification,
    /// θ > θmax - structure is potentially unstable
    Unstable,
}

impl PDeltaAnalysis {
    /// Create P-Delta analysis
    pub fn new() -> Self {
        Self {
            stability_coefficients: Vec::new(),
            theta_max: 0.25,
            amplification_factors: Vec::new(),
            requires_second_order: false,
        }
    }

    /// Calculate stability coefficient per ASCE 7-22 Eq. 12.8-16
    /// θ = (Px * Δ * Ie) / (Vx * hsx * Cd)
    pub fn calculate_stability(
        &mut self,
        story: usize,
        height: f64,
        px: f64,      // Total vertical load
        vx: f64,      // Story shear
        delta: f64,   // Story drift
        cd: f64,      // Deflection amplification factor
        ie: f64,      // Importance factor
    ) -> StoryStability {
        let theta = if vx > 0.0 && height > 0.0 && cd > 0.0 {
            (px * delta * ie) / (vx * height * cd)
        } else {
            0.0
        };

        // Determine maximum theta
        // Per ASCE 7-22: θmax = 0.5 / (β * Cd) ≤ 0.25
        // Using β = 1.0 for elastic analysis
        let theta_max_calculated = (0.5 / cd).min(self.theta_max);

        let status = if theta <= 0.10 {
            StabilityStatus::Negligible
        } else if theta <= theta_max_calculated {
            StabilityStatus::RequiresAmplification
        } else {
            StabilityStatus::Unstable
        };

        let story_stability = StoryStability {
            story,
            height,
            px,
            vx,
            delta,
            cd,
            ie,
            theta,
            status,
        };

        self.stability_coefficients.push(story_stability.clone());
        
        if status == StabilityStatus::RequiresAmplification {
            self.requires_second_order = true;
        }

        story_stability
    }

    /// Calculate P-Delta amplification factor
    /// Factor = 1 / (1 - θ)
    pub fn get_amplification(&self, theta: f64) -> f64 {
        if theta >= 1.0 {
            return f64::INFINITY;
        }
        1.0 / (1.0 - theta)
    }

    /// Apply P-Delta amplification to forces
    pub fn amplify_forces(&self, story_forces: &[f64]) -> Vec<f64> {
        story_forces
            .iter()
            .zip(self.stability_coefficients.iter())
            .map(|(&force, stability)| {
                match stability.status {
                    StabilityStatus::Negligible => force,
                    StabilityStatus::RequiresAmplification => {
                        force * self.get_amplification(stability.theta)
                    }
                    StabilityStatus::Unstable => f64::INFINITY,
                }
            })
            .collect()
    }
}

impl Default for PDeltaAnalysis {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// DIAPHRAGM FLEXIBILITY
// ============================================================================

/// Diaphragm flexibility classification per ASCE 7-22 Section 12.3.1
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiaphragmFlexibility {
    /// Diaphragm type
    pub classification: DiaphragmType,
    /// Maximum in-plane deflection
    pub max_deflection: f64,
    /// Average story drift
    pub avg_story_drift: f64,
    /// Flexibility ratio (δdiaphragm / δstory)
    pub flexibility_ratio: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DiaphragmType {
    /// Rigid per ASCE 7-22 Section 12.3.1.2
    Rigid,
    /// Flexible per ASCE 7-22 Section 12.3.1.1
    Flexible,
    /// Semi-rigid - requires explicit modeling
    SemiRigid,
}

impl DiaphragmFlexibility {
    /// Classify diaphragm per ASCE 7-22
    /// Flexible: δdiaphragm > 2 * δstory
    /// Rigid: δdiaphragm < 0.5 * δstory (or per Section 12.3.1.2 conditions)
    pub fn classify(max_deflection: f64, avg_story_drift: f64) -> Self {
        let flexibility_ratio = if avg_story_drift > 0.0 {
            max_deflection / avg_story_drift
        } else {
            0.0
        };

        let classification = if flexibility_ratio > 2.0 {
            DiaphragmType::Flexible
        } else if flexibility_ratio < 0.5 {
            DiaphragmType::Rigid
        } else {
            DiaphragmType::SemiRigid
        };

        Self {
            classification,
            max_deflection,
            avg_story_drift,
            flexibility_ratio,
        }
    }

    /// Check if diaphragm can be idealized as rigid
    /// Per ASCE 7-22 Section 12.3.1.2
    pub fn is_ideally_rigid(
        construction_type: &str,
        span_depth_ratio: f64,
        no_horizontal_irregularity: bool,
    ) -> bool {
        let valid_type = matches!(
            construction_type,
            "concrete" | "concrete_filled_deck" | "steel_deck_concrete"
        );

        valid_type && span_depth_ratio <= 3.0 && no_horizontal_irregularity
    }
}

// ============================================================================
// IRREGULARITY DETECTION
// ============================================================================

/// Structural irregularity detection per ASCE 7-22 Tables 12.3-1 and 12.3-2
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrregularityDetection {
    /// Horizontal irregularities detected
    pub horizontal: Vec<HorizontalIrregularity>,
    /// Vertical irregularities detected
    pub vertical: Vec<VerticalIrregularity>,
    /// Reference only (no penalty)
    pub reference_only: bool,
    /// Requires dynamic analysis
    pub requires_dynamic: bool,
    /// Not permitted for SDC D-F
    pub sdc_restrictions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HorizontalIrregularity {
    pub irregularity_type: HorizontalIrregularityType,
    pub floor: Option<usize>,
    pub ratio: f64,
    pub limit: f64,
    pub description: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum HorizontalIrregularityType {
    /// Type 1a: Torsional (δmax/δavg > 1.2)
    Torsional,
    /// Type 1b: Extreme Torsional (δmax/δavg > 1.4)
    ExtremeTorsional,
    /// Type 2: Re-entrant Corner (>15% in both directions)
    ReentrantCorner,
    /// Type 3: Diaphragm Discontinuity (>50% cutout or stiffness change)
    DiaphragmDiscontinuity,
    /// Type 4: Out-of-Plane Offset
    OutOfPlaneOffset,
    /// Type 5: Nonparallel Systems
    NonparallelSystems,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerticalIrregularity {
    pub irregularity_type: VerticalIrregularityType,
    pub story: Option<usize>,
    pub ratio: f64,
    pub limit: f64,
    pub description: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum VerticalIrregularityType {
    /// Type 1a: Soft Story (stiffness < 70% of story above)
    SoftStory,
    /// Type 1b: Extreme Soft Story (stiffness < 60%)
    ExtremeSoftStory,
    /// Type 2: Weight Irregularity (mass > 150% of adjacent)
    WeightIrregularity,
    /// Type 3: Geometric Irregularity (dimension > 130% of adjacent)
    GeometricIrregularity,
    /// Type 4: In-Plane Offset (offset > length of element)
    InPlaneOffset,
    /// Type 5a: Weak Story (strength < 80% of story above)
    WeakStory,
    /// Type 5b: Extreme Weak Story (strength < 65%)
    ExtremeWeakStory,
}

impl IrregularityDetection {
    /// Create new irregularity detector
    pub fn new() -> Self {
        Self {
            horizontal: Vec::new(),
            vertical: Vec::new(),
            reference_only: true,
            requires_dynamic: false,
            sdc_restrictions: Vec::new(),
        }
    }

    /// Check for torsional irregularity (Type 1a/1b)
    pub fn check_torsional(&mut self, max_drift: f64, avg_drift: f64, floor: usize) {
        if avg_drift <= 0.0 {
            return;
        }

        let ratio = max_drift / avg_drift;

        if ratio > 1.4 {
            self.horizontal.push(HorizontalIrregularity {
                irregularity_type: HorizontalIrregularityType::ExtremeTorsional,
                floor: Some(floor),
                ratio,
                limit: 1.4,
                description: format!(
                    "Extreme torsional irregularity at floor {}: δmax/δavg = {:.2} > 1.4",
                    floor, ratio
                ),
            });
            self.requires_dynamic = true;
            self.sdc_restrictions.push("Not permitted in SDC E or F".to_string());
        } else if ratio > 1.2 {
            self.horizontal.push(HorizontalIrregularity {
                irregularity_type: HorizontalIrregularityType::Torsional,
                floor: Some(floor),
                ratio,
                limit: 1.2,
                description: format!(
                    "Torsional irregularity at floor {}: δmax/δavg = {:.2} > 1.2",
                    floor, ratio
                ),
            });
        }
    }

    /// Check for soft story (Type 1a/1b)
    pub fn check_soft_story(&mut self, story_stiffnesses: &[f64]) {
        for i in 0..story_stiffnesses.len().saturating_sub(1) {
            let current = story_stiffnesses[i];
            let above = story_stiffnesses[i + 1];
            
            if above > 0.0 {
                let ratio = current / above;
                
                if ratio < 0.60 {
                    self.vertical.push(VerticalIrregularity {
                        irregularity_type: VerticalIrregularityType::ExtremeSoftStory,
                        story: Some(i + 1),
                        ratio,
                        limit: 0.60,
                        description: format!(
                            "Extreme soft story at story {}: stiffness ratio = {:.2} < 0.60",
                            i + 1, ratio
                        ),
                    });
                    self.requires_dynamic = true;
                    self.sdc_restrictions.push("Not permitted in SDC D, E, or F".to_string());
                } else if ratio < 0.70 {
                    self.vertical.push(VerticalIrregularity {
                        irregularity_type: VerticalIrregularityType::SoftStory,
                        story: Some(i + 1),
                        ratio,
                        limit: 0.70,
                        description: format!(
                            "Soft story at story {}: stiffness ratio = {:.2} < 0.70",
                            i + 1, ratio
                        ),
                    });
                }
            }
        }
    }

    /// Check for weak story (Type 5a/5b)
    pub fn check_weak_story(&mut self, story_strengths: &[f64]) {
        for i in 0..story_strengths.len().saturating_sub(1) {
            let current = story_strengths[i];
            let above = story_strengths[i + 1];
            
            if above > 0.0 {
                let ratio = current / above;
                
                if ratio < 0.65 {
                    self.vertical.push(VerticalIrregularity {
                        irregularity_type: VerticalIrregularityType::ExtremeWeakStory,
                        story: Some(i + 1),
                        ratio,
                        limit: 0.65,
                        description: format!(
                            "Extreme weak story at story {}: strength ratio = {:.2} < 0.65",
                            i + 1, ratio
                        ),
                    });
                    self.requires_dynamic = true;
                    self.sdc_restrictions.push("Not permitted in SDC B-F".to_string());
                } else if ratio < 0.80 {
                    self.vertical.push(VerticalIrregularity {
                        irregularity_type: VerticalIrregularityType::WeakStory,
                        story: Some(i + 1),
                        ratio,
                        limit: 0.80,
                        description: format!(
                            "Weak story at story {}: strength ratio = {:.2} < 0.80",
                            i + 1, ratio
                        ),
                    });
                }
            }
        }
    }

    /// Get summary of all irregularities
    pub fn get_summary(&self) -> String {
        let mut summary = String::new();
        
        if self.horizontal.is_empty() && self.vertical.is_empty() {
            return "No structural irregularities detected".to_string();
        }

        summary.push_str("STRUCTURAL IRREGULARITIES DETECTED:\n\n");

        if !self.horizontal.is_empty() {
            summary.push_str("Horizontal Irregularities:\n");
            for irreg in &self.horizontal {
                summary.push_str(&format!("  - {}\n", irreg.description));
            }
        }

        if !self.vertical.is_empty() {
            summary.push_str("\nVertical Irregularities:\n");
            for irreg in &self.vertical {
                summary.push_str(&format!("  - {}\n", irreg.description));
            }
        }

        if self.requires_dynamic {
            summary.push_str("\n⚠️ Dynamic analysis required per ASCE 7-22 Table 12.6-1\n");
        }

        if !self.sdc_restrictions.is_empty() {
            summary.push_str("\n🚫 SDC Restrictions:\n");
            for restriction in &self.sdc_restrictions {
                summary.push_str(&format!("  - {}\n", restriction));
            }
        }

        summary
    }
}

impl Default for IrregularityDetection {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// R/Ω0/Cd PARAMETER VALIDATION
// ============================================================================

/// Seismic response modification coefficients validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeismicCoefficients {
    /// Response modification coefficient R
    pub r: f64,
    /// Overstrength factor Ω0
    pub omega_0: f64,
    /// Deflection amplification factor Cd
    pub cd: f64,
    /// Seismic force-resisting system type
    pub system_type: String,
    /// Height limit (ft, None = no limit)
    pub height_limit: Option<f64>,
    /// Permitted SDCs
    pub permitted_sdc: Vec<char>,
}

impl SeismicCoefficients {
    /// Validate coefficients are consistent with ASCE 7-22 Table 12.2-1
    pub fn validate(&self) -> Result<(), String> {
        // R must be positive
        if self.r <= 0.0 {
            return Err("R must be greater than 0".to_string());
        }

        // Ω0 must be at least 1.0
        if self.omega_0 < 1.0 {
            return Err("Ω0 must be at least 1.0".to_string());
        }

        // Cd must be positive and typically Cd ≤ R
        if self.cd <= 0.0 {
            return Err("Cd must be greater than 0".to_string());
        }

        // Check typical relationships
        if self.cd > self.r * 1.5 {
            return Err("Cd typically should not exceed 1.5 * R".to_string());
        }

        Ok(())
    }

    /// Get standard coefficients for common systems per ASCE 7-22 Table 12.2-1
    pub fn from_system(system: &str, sdc: char) -> Option<Self> {
        let coefficients = match system {
            "special_moment_frame_steel" => SeismicCoefficients {
                r: 8.0,
                omega_0: 3.0,
                cd: 5.5,
                system_type: "Special Steel Moment Frame".to_string(),
                height_limit: None,
                permitted_sdc: vec!['A', 'B', 'C', 'D', 'E', 'F'],
            },
            "intermediate_moment_frame_steel" => SeismicCoefficients {
                r: 4.5,
                omega_0: 3.0,
                cd: 4.0,
                system_type: "Intermediate Steel Moment Frame".to_string(),
                height_limit: Some(160.0),
                permitted_sdc: vec!['A', 'B', 'C', 'D'],
            },
            "ordinary_moment_frame_steel" => SeismicCoefficients {
                r: 3.5,
                omega_0: 3.0,
                cd: 3.0,
                system_type: "Ordinary Steel Moment Frame".to_string(),
                height_limit: Some(65.0),
                permitted_sdc: vec!['A', 'B', 'C'],
            },
            "special_concentrically_braced_frame" => SeismicCoefficients {
                r: 6.0,
                omega_0: 2.0,
                cd: 5.0,
                system_type: "Special Concentrically Braced Frame".to_string(),
                height_limit: Some(160.0),
                permitted_sdc: vec!['A', 'B', 'C', 'D', 'E', 'F'],
            },
            "buckling_restrained_braced_frame" => SeismicCoefficients {
                r: 8.0,
                omega_0: 2.5,
                cd: 5.0,
                system_type: "Buckling-Restrained Braced Frame".to_string(),
                height_limit: Some(160.0),
                permitted_sdc: vec!['A', 'B', 'C', 'D', 'E', 'F'],
            },
            "special_moment_frame_concrete" => SeismicCoefficients {
                r: 8.0,
                omega_0: 3.0,
                cd: 5.5,
                system_type: "Special RC Moment Frame".to_string(),
                height_limit: None,
                permitted_sdc: vec!['A', 'B', 'C', 'D', 'E', 'F'],
            },
            "special_shear_wall" => SeismicCoefficients {
                r: 5.0,
                omega_0: 2.5,
                cd: 5.0,
                system_type: "Special RC Shear Wall".to_string(),
                height_limit: Some(160.0),
                permitted_sdc: vec!['A', 'B', 'C', 'D', 'E', 'F'],
            },
            _ => return None,
        };

        // Check if system is permitted for the SDC
        if coefficients.permitted_sdc.contains(&sdc) {
            Some(coefficients)
        } else {
            None
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
    fn test_accidental_torsion() {
        let mut torsion = AccidentalTorsion::new(0.05);
        torsion.add_floor(FloorDimension {
            floor_level: 1,
            elevation: 3500.0,
            lx: 30000.0,
            ly: 20000.0,
            cm_x: 15000.0,
            cm_y: 10000.0,
            cr_x: 15500.0,
            cr_y: 10200.0,
        });

        let eccentricities = torsion.calculate_eccentricities(SeismicDirection::X);
        assert!((eccentricities[0] - 1000.0).abs() < 1.0); // 5% of 20000 = 1000
    }

    #[test]
    fn test_p_delta() {
        let mut pdelta = PDeltaAnalysis::new();
        
        let result = pdelta.calculate_stability(
            1,        // story
            3500.0,   // height (mm)
            5000.0,   // Px (kN)
            200.0,    // Vx (kN)
            35.0,     // delta (mm)
            5.0,      // Cd
            1.0,      // Ie
        );

        // θ = (5000 * 35 * 1.0) / (200 * 3500 * 5.0) = 0.05
        assert!((result.theta - 0.05).abs() < 0.001);
        assert_eq!(result.status, StabilityStatus::Negligible);
    }

    #[test]
    fn test_irregularity_detection() {
        let mut detector = IrregularityDetection::new();
        
        // Test torsional irregularity
        detector.check_torsional(50.0, 35.0, 1); // ratio = 1.43 > 1.4
        
        assert!(!detector.horizontal.is_empty());
        assert_eq!(
            detector.horizontal[0].irregularity_type,
            HorizontalIrregularityType::ExtremeTorsional
        );
    }

    #[test]
    fn test_seismic_coefficients() {
        let smf = SeismicCoefficients::from_system("special_moment_frame_steel", 'D');
        assert!(smf.is_some());
        
        let smf = smf.unwrap();
        assert_eq!(smf.r, 8.0);
        assert_eq!(smf.omega_0, 3.0);
        assert_eq!(smf.cd, 5.5);
        
        // Ordinary moment frame not permitted in SDC D
        let omf = SeismicCoefficients::from_system("ordinary_moment_frame_steel", 'D');
        assert!(omf.is_none());
    }
}
