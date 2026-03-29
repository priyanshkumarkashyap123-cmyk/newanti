//! Fully Stressed Design (FSD) Optimization Engine
//!
//! Mathematical Framework:
//! - Objective: Minimize W(x) = Σ(ρᵢ Aᵢ Lᵢ)
//! - Variables: Discrete section sizes from IS catalog
//! - Constraints: Strength (UR ≤ 1.0), Serviceability (Δ ≤ Δ_allow)
//!
//! Algorithm:
//! 1. Initial State: Assign initial sections (user-defined or ultra-stiff)
//! 2. Global Analysis: Solve [K]{U} = {F} for internal forces
//! 3. Capacity Check: Calculate UR for all members
//! 4. Sizing Decision:
//!    - If UR > 1.0 (Failing): Upsize to next stronger section
//!    - If UR < Target (e.g., 0.8): Downsize to lighter section
//! 5. Redistribution: Changing I changes [K], forces redistri bute
//! 6. Iteration: Repeat until convergence (sections stop changing)
//!
//! Reference: Kirsch (1993), "Structural Optimization: Fundamentals and Applications"

use crate::design_codes::is_456;
use crate::design_codes::is_800::{design_shear, ismb_database, IsmbSection, GAMMA_M0};
#[allow(unused_imports)]
use crate::design_codes::section_wise::{
    self, MomentType, SectionDemand, SectionLocation, SteelDesignCode, SteelSectionInput,
    SteelSectionWiseDesigner,
};
use crate::solver::section_database::{SectionDatabase, SectionStandard};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ═══════════════════════════════════════════════════════════════════════════
// MATERIAL CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/// Young's modulus for structural steel (N/mm²)
const E_STEEL: f64 = 200_000.0;

/// Poisson's ratio for steel
#[allow(dead_code)]
const NU_STEEL: f64 = 0.3;

/// Shear modulus: G = E / (2(1+ν)) per IS 800 Cl. 2.2.4.1
const G_STEEL: f64 = 76_923.0; // E_STEEL / (2.0 * (1.0 + NU_STEEL))

/// LTB imperfection factor for rolled I-sections (IS 800 Table 14, curve a)
const ALPHA_LT_ROLLED: f64 = 0.21;

/// LTB imperfection factor for welded I-sections (IS 800 Table 14, curve c)
#[allow(dead_code)]
const ALPHA_LT_WELDED: f64 = 0.49;

// ═══════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

/// Optimization objective
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum Objective {
    /// Minimize total weight: W = Σ(ρᵢ Aᵢ Lᵢ)
    MinimizeWeight,
    /// Minimize cost: C = Σ(cᵢ Aᵢ Lᵢ)
    MinimizeCost,
    /// Minimize maximum utilization ratio
    MinimizeMaxUtilization,
    /// Multi-objective: weight + uniformity
    Balanced,
}

/// Constraint type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Constraint {
    /// Strength: Demand/Capacity ≤ 1.0
    Strength { ur_max: f64 },
    /// Serviceability: Deflection ≤ L/limit
    Deflection { limit_ratio: f64 },
    /// Fabrication: Max unique sections
    Fabrication { max_sections: usize },
    /// Buckling: Slenderness limits
    Buckling { lambda_max: f64 },
}

/// Member forces from analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberForces {
    pub member_id: String,
    pub load_combo: String,
    pub axial_kn: f64, // Positive = tension, Negative = compression
    pub shear_y_kn: f64,
    pub shear_z_kn: f64,
    pub moment_y_knm: f64,
    pub moment_z_knm: f64,
    pub torsion_knm: f64,
    /// Maximum deflection from solver (mm). If None, estimated from moment.
    #[serde(default)]
    pub max_deflection_mm: Option<f64>,
}

/// Material type for optimization routing
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum MaterialType {
    Steel,
    Concrete,
}

impl Default for MaterialType {
    fn default() -> Self {
        MaterialType::Steel
    }
}

/// Member geometric properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberGeometry {
    pub member_id: String,
    pub length_mm: f64,
    pub effective_length_y: f64, // For buckling
    pub effective_length_z: f64,
    /// Laterally unbraced length (mm). Defaults to member length if None.
    #[serde(default)]
    pub unbraced_length: Option<f64>,
    pub member_type: MemberType, // Beam, Column, Brace
    /// Material type: Steel or Concrete. Defaults to Steel.
    #[serde(default)]
    pub material_type: MaterialType,
    /// Section width for concrete members (mm)
    #[serde(default)]
    pub b_mm: Option<f64>,
    /// Section overall depth for concrete members (mm)
    #[serde(default)]
    pub d_mm: Option<f64>,
    /// Clear cover for concrete members (mm), default 30–40
    #[serde(default)]
    pub cover_mm: Option<f64>,
    /// Characteristic concrete strength (N/mm²), e.g. 25.0 for M25
    #[serde(default)]
    pub fck: Option<f64>,
    /// Yield strength of reinforcement (N/mm²), e.g. 500.0 for Fe500
    #[serde(default)]
    pub fy_rebar: Option<f64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum MemberType {
    Beam,
    Column,
    Brace,
    Truss,
}

// ═══════════════════════════════════════════════════════════════════════════
// RC (CONCRETE) SECTION DATABASE
// ═══════════════════════════════════════════════════════════════════════════

/// Standard RC cross-section (beam or column) for optimization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RcSection {
    /// Name, e.g. "RC230x400", "RC300x500"
    pub name: String,
    /// Width (mm)
    pub b_mm: f64,
    /// Overall depth (mm)
    pub d_mm: f64,
    /// Cross-sectional area (mm²)
    pub area_mm2: f64,
    /// Weight per meter (kg/m) assuming reinforced concrete density 25 kN/m³
    pub weight_per_m: f64,
    /// Second moment of area Ixx (mm⁴)
    pub ixx_mm4: f64,
    /// Section modulus Zxx (mm³)
    pub zxx_mm3: f64,
}

/// Standard Indian RC beam sizes ordered by increasing section modulus
pub fn rc_beam_database() -> Vec<RcSection> {
    let sections = [
        (230.0, 300.0),
        (230.0, 350.0),
        (230.0, 400.0),
        (230.0, 450.0),
        (230.0, 500.0),
        (250.0, 400.0),
        (250.0, 450.0),
        (250.0, 500.0),
        (300.0, 450.0),
        (300.0, 500.0),
        (300.0, 600.0),
        (300.0, 700.0),
        (350.0, 500.0),
        (350.0, 600.0),
        (350.0, 700.0),
        (400.0, 600.0),
        (400.0, 700.0),
        (400.0, 800.0),
        (450.0, 750.0),
        (450.0, 900.0),
    ];
    sections
        .iter()
        .map(|&(b, d)| {
            let area = b * d;
            // Density of RC ≈ 25 kN/m³ = 2500 kg/m³ = 2.5e-6 kg/mm³
            let weight = area * 2.5e-6 * 1000.0; // kg/m
            let ixx = b * d * d * d / 12.0;
            let zxx = b * d * d / 6.0;
            RcSection {
                name: format!("RC{}x{}", b as u32, d as u32),
                b_mm: b,
                d_mm: d,
                area_mm2: area,
                weight_per_m: weight,
                ixx_mm4: ixx,
                zxx_mm3: zxx,
            }
        })
        .collect()
}

/// Standard Indian RC column sizes ordered by increasing area
pub fn rc_column_database() -> Vec<RcSection> {
    let sections = [
        (230.0, 230.0),
        (230.0, 300.0),
        (300.0, 300.0),
        (300.0, 400.0),
        (350.0, 350.0),
        (350.0, 450.0),
        (400.0, 400.0),
        (400.0, 500.0),
        (450.0, 450.0),
        (450.0, 600.0),
        (500.0, 500.0),
        (500.0, 700.0),
        (600.0, 600.0),
        (600.0, 800.0),
        (750.0, 750.0),
    ];
    sections
        .iter()
        .map(|&(b, d)| {
            let area = b * d;
            let weight = area * 2.5e-6 * 1000.0;
            let ixx = b * d * d * d / 12.0;
            let zxx = b * d * d / 6.0;
            RcSection {
                name: format!("RC{}x{}", b as u32, d as u32),
                b_mm: b,
                d_mm: d,
                area_mm2: area,
                weight_per_m: weight,
                ixx_mm4: ixx,
                zxx_mm3: zxx,
            }
        })
        .collect()
}

/// Design check result per member per load combo
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesignCheck {
    pub member_id: String,
    pub load_combo: String,
    pub section_name: String,
    pub utilization_ratio: f64, // Max of all checks
    pub flexure_ur: f64,
    pub shear_ur: f64,
    pub compression_ur: f64,
    /// P-M interaction ratio per IS 800 Cl. 9.3
    #[serde(default)]
    pub interaction_ur: f64,
    /// Lateral-torsional buckling ratio per IS 800 Cl. 8.2.2
    #[serde(default)]
    pub ltb_ur: f64,
    /// Serviceability deflection ratio per IS 800 Table 6
    #[serde(default)]
    pub deflection_ur: f64,
    /// Web crippling/bearing ratio per IS 800 Cl. 8.7.4
    #[serde(default)]
    pub web_crippling_ur: f64,
    /// Connection capacity adequate (0.9 reserve applied)
    #[serde(default = "default_connection_adequate")]
    pub connection_adequate: bool,
    pub passed: bool,
    pub governing_check: String,
}

fn default_connection_adequate() -> bool {
    true
}

/// FSD optimization configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FSDConfig {
    /// Optimization objective
    pub objective: Objective,

    /// Constraints to enforce
    pub constraints: Vec<Constraint>,

    /// Target utilization ratio (0.8-0.95 typical)
    pub target_ur: f64,

    /// Maximum utilization allowed (1.0 strict, 0.95 conservative)
    pub max_ur: f64,

    /// Maximum iterations before stopping
    pub max_iterations: usize,

    /// Convergence tolerance on weight change (e.g., 0.5%)
    pub convergence_tolerance: f64,

    /// Material density (kg/mm³) - default steel 7.85e-6
    pub material_density: f64,

    /// Material cost ($/kg) - optional
    pub material_cost: Option<f64>,

    /// Yield strength (N/mm²)
    pub fy: f64,

    /// Group members by type (beams together, columns together)
    pub group_by_type: bool,

    /// Maximum unique sections allowed (constructability)
    pub max_unique_sections: Option<usize>,

    /// Section standard to use (IS, AISC, Eurocode). Defaults to IS.
    #[serde(default)]
    pub section_standard: Option<SectionStandard>,
}

impl Default for FSDConfig {
    fn default() -> Self {
        Self {
            objective: Objective::MinimizeWeight,
            constraints: vec![
                Constraint::Strength { ur_max: 1.0 },
                Constraint::Deflection { limit_ratio: 300.0 },
            ],
            target_ur: 0.85,
            max_ur: 1.0,
            max_iterations: 20,
            convergence_tolerance: 0.5, // 0.5% weight change
            material_density: 7.85e-6,  // Steel: kg/mm³
            material_cost: Some(1.2),   // $/kg typical
            fy: 250.0,
            group_by_type: true,
            max_unique_sections: Some(8),
            section_standard: None, // None = IS (default)
        }
    }
}

/// Envelope of peak forces per member across all load combinations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberEnvelopeSummary {
    pub member_id: String,
    pub section_name: String,
    /// Governing UR and which check governs
    pub governing_ur: f64,
    pub governing_check: String,
    pub governing_combo: String,
    /// Peak forces across all combos
    pub max_axial_kn: f64,
    pub min_axial_kn: f64,
    pub max_shear_y_kn: f64,
    pub max_moment_z_knm: f64,
    pub max_moment_y_knm: f64,
    /// Full UR breakdown from governing combo
    pub flexure_ur: f64,
    pub shear_ur: f64,
    pub compression_ur: f64,
    pub interaction_ur: f64,
    pub ltb_ur: f64,
    pub deflection_ur: f64,
    pub web_crippling_ur: f64,
    pub connection_adequate: bool,
    pub passed: bool,
}

/// FSD optimization result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FSDResult {
    /// Optimization success
    pub success: bool,

    /// Convergence achieved
    pub converged: bool,

    /// Number of iterations performed
    pub iterations: usize,

    /// Final member section assignments
    pub member_sections: HashMap<String, String>,

    /// Initial total weight (kg)
    pub initial_weight_kg: f64,

    /// Final total weight (kg)
    pub final_weight_kg: f64,

    /// Weight savings percentage
    pub weight_savings_pct: f64,

    /// Initial total cost ($)
    pub initial_cost: Option<f64>,

    /// Final total cost ($)
    pub final_cost: Option<f64>,

    /// Iteration history
    pub history: Vec<IterationHistory>,

    /// Final design checks
    pub final_checks: Vec<DesignCheck>,

    /// Envelope summaries per member (peak forces + governing UR)
    pub member_envelopes: Vec<MemberEnvelopeSummary>,

    /// Maximum utilization ratio achieved
    pub max_ur: f64,

    /// Number of unique sections used
    pub unique_sections: usize,

    /// Failure message if unsuccessful
    pub message: String,
}

/// History record for each iteration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IterationHistory {
    pub iteration: usize,
    pub total_weight_kg: f64,
    pub max_ur: f64,
    pub avg_ur: f64,
    pub num_failing_members: usize,
    pub num_section_changes: usize,
    pub convergence_metric: f64,
}

// ═══════════════════════════════════════════════════════════════════════════
// FSD OPTIMIZATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════

pub struct FSDEngine {
    config: FSDConfig,
    section_database: Vec<IsmbSection>,
    rc_beam_db: Vec<RcSection>,
    rc_column_db: Vec<RcSection>,
}

impl FSDEngine {
    /// Create new FSD engine with configuration
    ///
    /// Loads section database based on `config.section_standard`:
    /// - None | Some(IS) → ISMB sections from IS 808
    /// - Some(AISC) → W-shapes from AISC Manual
    /// - Some(Eurocode) → IPE / HEA / HEB from EN profiles
    pub fn new(config: FSDConfig) -> Self {
        let section_database = match config.section_standard {
            None | Some(SectionStandard::IS) => ismb_database(),
            Some(std) => {
                let db = SectionDatabase::new();
                db.by_standard(std)
                    .into_iter()
                    .filter(|s| s.shape == crate::solver::section_database::SectionShape::IBeam)
                    .map(|s| IsmbSection {
                        name: s.designation.clone(),
                        depth: s.depth,
                        width: s.width,
                        tw: s.tw,
                        tf: s.tf,
                        area: s.area,
                        ixx: s.ix,
                        iyy: s.iy,
                        zxx: s.sx,
                        zyy: s.sy,
                        rxx: s.rx,
                        ryy: s.ry,
                        weight: s.weight_per_m,
                    })
                    .collect()
            }
        };

        Self {
            config,
            section_database,
            rc_beam_db: rc_beam_database(),
            rc_column_db: rc_column_database(),
        }
    }

    /// Main optimization loop
    ///
    /// Algorithm:
    /// 1. Initialize sections (user-provided or default)
    /// 2. Loop until convergence:
    ///    a. Analyze structure → get member forces
    ///    b. Perform design checks → get utilization ratios
    ///    c. Resize members based on UR:
    ///       - UR > max_ur → upsize (stress-driven)
    ///       - UR < target_ur → downsize (economy-driven)
    ///    d. Check convergence (weight change < tolerance)
    /// 3. Return optimized design
    pub fn optimize<F>(
        &self,
        initial_sections: &HashMap<String, String>,
        geometries: &[MemberGeometry],
        mut analyze_fn: F,
    ) -> FSDResult
    where
        F: FnMut(&HashMap<String, String>) -> Vec<DesignCheck>,
    {
        let mut current_sections = initial_sections.clone();
        let mut history = Vec::new();
        let mut previous_weight = self.calculate_total_weight(&current_sections, geometries);
        let initial_weight = previous_weight;
        let initial_cost = self.calculate_total_cost(&current_sections, geometries);

        let mut converged = false;
        let mut iteration = 0;

        // Main FSD iteration loop
        while iteration < self.config.max_iterations {
            iteration += 1;

            // ═══════════════════════════════════════════════════════════════
            // STEP 1: Global Analysis → Get internal forces
            // ═══════════════════════════════════════════════════════════════
            // The analyze_fn callback should:
            // - Update structure with current_sections
            // - Solve [K]{U} = {F}
            // - Extract member forces
            // - Perform design checks
            // - Return DesignCheck results

            let design_checks = analyze_fn(&current_sections);

            // ═══════════════════════════════════════════════════════════════
            // STEP 2: Aggregate checks by member (max UR across load combos)
            // ═══════════════════════════════════════════════════════════════

            let member_max_ur = self.get_member_max_utilization(&design_checks);

            // ═══════════════════════════════════════════════════════════════
            // STEP 3: Sizing Decision — The Core FSD Logic
            // ═══════════════════════════════════════════════════════════════

            let (new_sections, num_changes) =
                self.resize_members(&current_sections, &member_max_ur, geometries);

            // ═══════════════════════════════════════════════════════════════
            // STEP 4: Calculate convergence metrics
            // ═══════════════════════════════════════════════════════════════

            let current_weight = self.calculate_total_weight(&new_sections, geometries);
            let weight_change_pct =
                ((previous_weight - current_weight) / previous_weight).abs() * 100.0;

            let max_ur = member_max_ur.values().cloned().fold(0.0, f64::max);
            let avg_ur = member_max_ur.values().sum::<f64>() / member_max_ur.len() as f64;
            let num_failing = member_max_ur
                .values()
                .filter(|&&ur| ur > self.config.max_ur)
                .count();

            // Record history
            history.push(IterationHistory {
                iteration,
                total_weight_kg: current_weight,
                max_ur,
                avg_ur,
                num_failing_members: num_failing,
                num_section_changes: num_changes,
                convergence_metric: weight_change_pct,
            });

            // ═══════════════════════════════════════════════════════════════
            // STEP 5: Check convergence
            // ═══════════════════════════════════════════════════════════════

            if num_changes == 0 || weight_change_pct < self.config.convergence_tolerance {
                converged = true;
                current_sections = new_sections;
                break;
            }

            // Update for next iteration
            current_sections = new_sections;
            previous_weight = current_weight;
        }

        // Final analysis with optimized sections
        let final_checks = analyze_fn(&current_sections);
        let final_weight = self.calculate_total_weight(&current_sections, geometries);
        let final_cost = self.calculate_total_cost(&current_sections, geometries);
        let member_max_ur = self.get_member_max_utilization(&final_checks);
        let max_ur = member_max_ur.values().cloned().fold(0.0, f64::max);

        let unique_sections = current_sections
            .values()
            .collect::<std::collections::HashSet<_>>()
            .len();

        let weight_savings_pct = ((initial_weight - final_weight) / initial_weight) * 100.0;

        let success = max_ur <= self.config.max_ur && converged;

        let message = if !converged && iteration >= self.config.max_iterations {
            format!(
                "Maximum iterations ({}) reached without convergence",
                self.config.max_iterations
            )
        } else if max_ur > self.config.max_ur {
            format!(
                "Design failed: max UR = {:.3} > {:.3}",
                max_ur, self.config.max_ur
            )
        } else {
            format!(
                "Optimization successful: {} iterations, {:.1}% weight savings",
                iteration, weight_savings_pct
            )
        };

        // Compute envelope summaries per member
        let member_envelopes = Self::compute_member_envelopes(&final_checks, &current_sections);

        FSDResult {
            success,
            converged,
            iterations: iteration,
            member_sections: current_sections,
            initial_weight_kg: initial_weight,
            final_weight_kg: final_weight,
            weight_savings_pct,
            initial_cost,
            final_cost,
            history,
            final_checks,
            member_envelopes,
            max_ur,
            unique_sections,
            message,
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SIZING LOGIC — The Heart of FSD
    // ═══════════════════════════════════════════════════════════════════════

    /// Resize members based on utilization ratios
    ///
    /// Logic:
    /// - UR > max_ur (Failing): Find next heavier section in catalog
    /// - UR < target_ur (Over-designed): Find next lighter section
    /// - target_ur ≤ UR ≤ max_ur (Optimal): Keep current section
    ///
    /// Routes steel vs. concrete members to their respective databases.
    ///
    /// Returns: (new_sections, number_of_changes)
    fn resize_members(
        &self,
        current_sections: &HashMap<String, String>,
        member_ur: &HashMap<String, f64>,
        geometries: &[MemberGeometry],
    ) -> (HashMap<String, String>, usize) {
        let mut new_sections = current_sections.clone();
        let mut num_changes = 0;

        for geom in geometries {
            let member_id = &geom.member_id;
            let default_section = if geom.material_type == MaterialType::Concrete {
                match geom.member_type {
                    MemberType::Column => "RC300x300".to_string(),
                    _ => "RC300x500".to_string(),
                }
            } else {
                "ISMB 200".to_string()
            };
            let current_section = current_sections
                .get(member_id)
                .cloned()
                .unwrap_or(default_section);

            let ur = member_ur.get(member_id).copied().unwrap_or(0.0);

            let new_section = if geom.material_type == MaterialType::Concrete {
                // ═══════════════════════════════════════════════════════════
                // CONCRETE RESIZING — use RC section catalog
                // ═══════════════════════════════════════════════════════════
                let rc_db = match geom.member_type {
                    MemberType::Column => &self.rc_column_db,
                    _ => &self.rc_beam_db,
                };
                let current_idx = rc_db
                    .iter()
                    .position(|s| s.name == current_section)
                    .unwrap_or(0);

                if ur > self.config.max_ur {
                    self.upsize_rc_section(rc_db, current_idx, ur / self.config.max_ur)
                } else if ur < self.config.target_ur {
                    self.downsize_rc_section(rc_db, current_idx)
                } else {
                    current_section.clone()
                }
            } else {
                // ═══════════════════════════════════════════════════════════
                // STEEL RESIZING — existing ISMB catalog logic
                // ═══════════════════════════════════════════════════════════
                let current_idx = self
                    .section_database
                    .iter()
                    .position(|s| s.name == current_section)
                    .unwrap_or(0);

                if ur > self.config.max_ur {
                    let scale_factor = ur / self.config.max_ur;
                    self.upsize_section(current_idx, scale_factor)
                } else if ur < self.config.target_ur {
                    self.downsize_section(current_idx)
                } else {
                    current_section.clone()
                }
            };

            if new_section != current_section {
                new_sections.insert(member_id.clone(), new_section);
                num_changes += 1;
            }
        }

        (new_sections, num_changes)
    }

    /// Upsize section — find next heavier/stronger section
    fn upsize_section(&self, current_idx: usize, scale_factor: f64) -> String {
        // Conservative approach: jump to section where Zxx is scaled appropriately
        let current_zxx = self.section_database[current_idx].zxx;
        let required_zxx = current_zxx * scale_factor;

        // Search forward in database for first section with Zxx >= required
        for section in self.section_database.iter().skip(current_idx + 1) {
            if section.zxx >= required_zxx {
                return section.name.clone();
            }
        }

        // If no adequate section, return heaviest
        self.section_database
            .last()
            .map(|s| s.name.clone())
            .unwrap_or_else(|| "ISMB 600".to_string())
    }

    /// Downsize section — find next lighter section
    fn downsize_section(&self, current_idx: usize) -> String {
        if current_idx > 0 {
            self.section_database[current_idx - 1].name.clone()
        } else {
            // Already at lightest section
            self.section_database[current_idx].name.clone()
        }
    }

    /// Upsize RC section — find next larger concrete section by section modulus
    ///
    /// Strategy: increase depth first (more efficient for flexure per IS 456),
    /// then width if depth limit is reached.
    fn upsize_rc_section(
        &self,
        rc_db: &[RcSection],
        current_idx: usize,
        scale_factor: f64,
    ) -> String {
        if rc_db.is_empty() {
            return format!("RC300x500");
        }
        let current_zxx = rc_db[current_idx].zxx_mm3;
        let required_zxx = current_zxx * scale_factor;

        // Search forward for first section with Zxx >= required
        for section in rc_db.iter().skip(current_idx + 1) {
            if section.zxx_mm3 >= required_zxx {
                return section.name.clone();
            }
        }
        // If no adequate section, return largest
        rc_db
            .last()
            .map(|s| s.name.clone())
            .unwrap_or_else(|| "RC400x800".to_string())
    }

    /// Downsize RC section — find next lighter concrete section
    fn downsize_rc_section(&self, rc_db: &[RcSection], current_idx: usize) -> String {
        if current_idx > 0 {
            rc_db[current_idx - 1].name.clone()
        } else {
            rc_db[current_idx].name.clone()
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    /// Compute envelope summaries per member from design checks across all load combos.
    ///
    /// For each member: finds peak forces and the governing load combo/check.
    fn compute_member_envelopes(
        checks: &[DesignCheck],
        sections: &HashMap<String, String>,
    ) -> Vec<MemberEnvelopeSummary> {
        // Group checks by member_id
        let mut by_member: HashMap<String, Vec<&DesignCheck>> = HashMap::new();
        for c in checks {
            by_member.entry(c.member_id.clone()).or_default().push(c);
        }

        let mut envelopes = Vec::new();
        for (member_id, member_checks) in &by_member {
            // Find governing check (max UR)
            let governing = member_checks.iter().max_by(|a, b| {
                a.utilization_ratio
                    .partial_cmp(&b.utilization_ratio)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });

            let gov = match governing {
                Some(g) => g,
                None => continue,
            };

            let section_name = sections
                .get(member_id)
                .cloned()
                .unwrap_or_else(|| gov.section_name.clone());

            envelopes.push(MemberEnvelopeSummary {
                member_id: member_id.clone(),
                section_name,
                governing_ur: gov.utilization_ratio,
                governing_check: gov.governing_check.clone(),
                governing_combo: gov.load_combo.clone(),
                max_axial_kn: 0.0, // Not available from DesignCheck; zero is safe
                min_axial_kn: 0.0,
                max_shear_y_kn: 0.0,
                max_moment_z_knm: 0.0,
                max_moment_y_knm: 0.0,
                flexure_ur: gov.flexure_ur,
                shear_ur: gov.shear_ur,
                compression_ur: gov.compression_ur,
                interaction_ur: gov.interaction_ur,
                ltb_ur: gov.ltb_ur,
                deflection_ur: gov.deflection_ur,
                web_crippling_ur: gov.web_crippling_ur,
                connection_adequate: gov.connection_adequate,
                passed: gov.utilization_ratio <= 1.0,
            });
        }

        // Sort by member_id for consistent output
        envelopes.sort_by(|a, b| a.member_id.cmp(&b.member_id));
        envelopes
    }

    /// Get maximum utilization ratio per member across all load combos
    fn get_member_max_utilization(&self, checks: &[DesignCheck]) -> HashMap<String, f64> {
        let mut member_ur: HashMap<String, f64> = HashMap::new();

        for check in checks {
            let current_max = member_ur.entry(check.member_id.clone()).or_insert(0.0);
            *current_max = current_max.max(check.utilization_ratio);
        }

        member_ur
    }

    /// Calculate total structural weight: W = Σ(ρ × A × L)
    fn calculate_total_weight(
        &self,
        sections: &HashMap<String, String>,
        geometries: &[MemberGeometry],
    ) -> f64 {
        let mut total_weight = 0.0;

        for geom in geometries {
            let section_name = sections.get(&geom.member_id).cloned().unwrap_or_else(|| {
                if geom.material_type == MaterialType::Concrete {
                    "RC300x500".to_string()
                } else {
                    "ISMB 200".to_string()
                }
            });

            let length_m = geom.length_mm / 1000.0;

            if geom.material_type == MaterialType::Concrete {
                let rc_db = match geom.member_type {
                    MemberType::Column => &self.rc_column_db,
                    _ => &self.rc_beam_db,
                };
                if let Some(section) = rc_db.iter().find(|s| s.name == section_name) {
                    total_weight += section.weight_per_m * length_m;
                }
            } else if let Some(section) = self
                .section_database
                .iter()
                .find(|s| s.name == section_name)
            {
                total_weight += section.weight * length_m;
            }
        }

        total_weight
    }

    /// Calculate total cost: C = Σ(cost × A × L)
    fn calculate_total_cost(
        &self,
        sections: &HashMap<String, String>,
        geometries: &[MemberGeometry],
    ) -> Option<f64> {
        self.config.material_cost.map(|unit_cost| {
            let weight = self.calculate_total_weight(sections, geometries);
            weight * unit_cost
        })
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN CHECK IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════

/// Perform comprehensive design check for single member
///
/// Checks performed (IS 800:2007):
/// - Flexure: Cl. 8.2.1 — M/Md
/// - Shear: Cl. 8.4 — V/Vd
/// - Compression: Cl. 7.1.2 — P/Pd (with buckling)
/// - P-M Interaction: Cl. 9.3.1 — N/Nd + My/Mdy + Mz/Mdz
/// - LTB: Cl. 8.2.2 — M/Md_ltb (lateral-torsional buckling)
/// - Deflection: Table 6 — δ/δ_allow
/// - Web Crippling: Cl. 8.7.4 — R/Fw
pub fn check_member(
    forces: &MemberForces,
    geometry: &MemberGeometry,
    section_name: &str,
    fy: f64,
) -> DesignCheck {
    let section_db = ismb_database();
    let section = match section_db.iter().find(|s| s.name == section_name) {
        Some(s) => s,
        None => {
            return DesignCheck {
                member_id: forces.member_id.clone(),
                load_combo: forces.load_combo.clone(),
                section_name: section_name.to_string(),
                utilization_ratio: f64::INFINITY,
                flexure_ur: 0.0,
                shear_ur: 0.0,
                compression_ur: 0.0,
                interaction_ur: 0.0,
                ltb_ur: 0.0,
                deflection_ur: 0.0,
                web_crippling_ur: 0.0,
                connection_adequate: false,
                passed: false,
                governing_check: format!("Section '{}' not in database", section_name),
            }
        }
    };

    // Enhanced section data (with J, Cw) for LTB check
    let steel_input = section_wise::lookup_ismb(section_name);

    // Laterally unbraced length (defaults to member length)
    let lb = geometry.unbraced_length.unwrap_or(geometry.length_mm);

    // ═══════════════════════════════════════════════════════════════════════
    // FLEXURE CHECK — IS 800 Cl. 8.2.1
    // ═══════════════════════════════════════════════════════════════════════

    let zpxx = 1.15 * section.zxx; // Approximate plastic modulus
    let md_knm = zpxx * fy / (GAMMA_M0 * 1e6);
    let mux_abs = forces.moment_z_knm.abs();
    let flexure_ur = if md_knm > 0.0 { mux_abs / md_knm } else { 0.0 };

    // ═══════════════════════════════════════════════════════════════════════
    // SHEAR CHECK — IS 800 Cl. 8.4
    // ═══════════════════════════════════════════════════════════════════════

    let d_web = section.depth - 2.0 * section.tf;
    let vu_kn = forces.shear_y_kn.abs();
    let shear_result = design_shear(d_web, section.tw, fy, vu_kn);
    let shear_ur = shear_result.utilization;

    // ═══════════════════════════════════════════════════════════════════════
    // COMPRESSION CHECK — IS 800 Cl. 7.1.2 (with buckling)
    // ═══════════════════════════════════════════════════════════════════════

    let (compression_ur, pd_kn) = if forces.axial_kn < 0.0 {
        let pu_kn = forces.axial_kn.abs();

        let lambda_xx = geometry.effective_length_y / section.rxx.max(1.0);
        let lambda_yy = geometry.effective_length_z / section.ryy.max(1.0);
        let lambda = lambda_xx.max(lambda_yy);
        let lambda_e = (lambda / std::f64::consts::PI) * (fy / E_STEEL).sqrt();

        let alpha = 0.34; // Buckling curve b for I-sections (IS 800 Table 10)
        let phi = 0.5 * (1.0 + alpha * (lambda_e - 0.2) + lambda_e.powi(2));

        // Perry-Robertson buckling reduction factor χ
        let discriminant = (phi * phi - lambda_e * lambda_e).max(0.0);
        let chi = if discriminant > 1e-12 {
            let denominator = phi + discriminant.sqrt();
            if denominator > 1e-12 {
                (1.0 / denominator).min(1.0)
            } else {
                1.0
            }
        } else {
            (1.0 / (2.0 * phi.max(0.5))).min(1.0)
        };

        let fcd = chi * fy / GAMMA_M0;
        let pd = section.area * fcd / 1000.0;
        let ur = if pd > 0.0 { pu_kn / pd } else { 0.0 };
        (ur, pd)
    } else {
        // Tension capacity (for interaction check denominator)
        (0.0, section.area * fy / (GAMMA_M0 * 1000.0))
    };

    // ═══════════════════════════════════════════════════════════════════════
    // LTB CHECK — IS 800 Cl. 8.2.2 (Lateral-Torsional Buckling)
    // ═══════════════════════════════════════════════════════════════════════

    let ltb_ur = if geometry.member_type == MemberType::Beam && mux_abs > f64::EPSILON {
        compute_ltb_ur(section, &steel_input, fy, mux_abs, lb)
    } else {
        0.0
    };

    // ═══════════════════════════════════════════════════════════════════════
    // P-M INTERACTION — IS 800 Cl. 9.3 (Combined Axial + Bending)
    // ═══════════════════════════════════════════════════════════════════════

    let interaction_ur = compute_interaction_ur(forces, section, fy, pd_kn, md_knm);

    // ═══════════════════════════════════════════════════════════════════════
    // DEFLECTION CHECK — IS 800 Table 6 (Serviceability)
    // ═══════════════════════════════════════════════════════════════════════

    let deflection_ur = compute_deflection_ur(forces, geometry, section);

    // ═══════════════════════════════════════════════════════════════════════
    // WEB CRIPPLING CHECK — IS 800 Cl. 8.7.4 (Web Bearing)
    // ═══════════════════════════════════════════════════════════════════════

    let web_crippling_ur = compute_web_crippling_ur(forces, section, fy, geometry);

    // ═══════════════════════════════════════════════════════════════════════
    // CONNECTION CAPACITY RESERVE
    // ═══════════════════════════════════════════════════════════════════════
    // Apply 0.9 factor when connections are not explicitly designed
    let connection_adequate = flexure_ur * 0.9 <= 1.0 && shear_ur * 0.9 <= 1.0;

    // ═══════════════════════════════════════════════════════════════════════
    // GOVERNING CHECK
    // ═══════════════════════════════════════════════════════════════════════

    let urs = [
        (flexure_ur, "flexure"),
        (shear_ur, "shear"),
        (compression_ur, "compression"),
        (interaction_ur, "interaction"),
        (ltb_ur, "ltb"),
        (deflection_ur, "deflection"),
        (web_crippling_ur, "web_crippling"),
    ];

    let (utilization_ratio, governing_check) = urs
        .iter()
        .max_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(ur, check)| (*ur, check.to_string()))
        .unwrap_or((0.0, "none".to_string()));

    DesignCheck {
        member_id: forces.member_id.clone(),
        load_combo: forces.load_combo.clone(),
        section_name: section_name.to_string(),
        utilization_ratio: round3(utilization_ratio),
        flexure_ur: round3(flexure_ur),
        shear_ur: round3(shear_ur),
        compression_ur: round3(compression_ur),
        interaction_ur: round3(interaction_ur),
        ltb_ur: round3(ltb_ur),
        deflection_ur: round3(deflection_ur),
        web_crippling_ur: round3(web_crippling_ur),
        connection_adequate,
        passed: utilization_ratio <= 1.0,
        governing_check,
    }
}

/// Round to 3 decimal places
fn round3(x: f64) -> f64 {
    (x * 1000.0).round() / 1000.0
}

// ═══════════════════════════════════════════════════════════════════════════
// INDIVIDUAL CHECK IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════

/// Compute LTB utilization ratio per IS 800 Cl. 8.2.2
///
/// Elastic critical moment:
///   Mcr = (π²EIy / Lb²) × √(Iw/Iy + (Lb²GJ)/(π²EIy))
///
/// Non-dimensional slenderness: λLT = √(βb × Zp × fy / Mcr)
/// Reduction factor χLT: IS 800 Cl. 8.2.2.1, Table 14
fn compute_ltb_ur(
    section: &IsmbSection,
    steel_input: &Option<SteelSectionInput>,
    fy: f64,
    mu_knm: f64,
    lb: f64,
) -> f64 {
    // Get torsional constants
    let (j, cw) = match steel_input {
        Some(si) => (si.j_mm4, si.cw_mm6),
        None => {
            // Approximate J and Cw for I-sections
            // J ≈ (2bf·tf³ + (d-2tf)·tw³) / 3
            let d_web = section.depth - 2.0 * section.tf;
            let j_approx =
                (2.0 * section.width * section.tf.powi(3) + d_web * section.tw.powi(3)) / 3.0;
            // Cw ≈ Iy × (d-tf)² / 4
            let hs = section.depth - section.tf;
            let cw_approx = section.iyy * hs * hs / 4.0;
            (j_approx, cw_approx)
        }
    };

    if lb < f64::EPSILON || section.iyy < f64::EPSILON {
        return 0.0;
    }

    let pi2 = std::f64::consts::PI * std::f64::consts::PI;
    let ei_y = E_STEEL * section.iyy;
    let term1 = pi2 * ei_y / (lb * lb);
    let cw_iy = if section.iyy > f64::EPSILON {
        cw / section.iyy
    } else {
        0.0
    };
    let gj_term = (lb * lb * G_STEEL * j) / (pi2 * ei_y);

    let under_root = cw_iy + gj_term;
    if under_root < 0.0 {
        return 0.0;
    }

    let mcr = term1 * under_root.sqrt(); // N·mm
    let mcr_knm = mcr / 1e6; // kN·m

    if mcr_knm < f64::EPSILON {
        return 0.0;
    }

    // Plastic section modulus (approximate)
    let zp = 1.15 * section.zxx;
    let beta_b = 1.0; // For plastic/compact sections

    let lambda_lt = (beta_b * zp * fy / mcr).sqrt();

    // If λLT ≤ 0.2, no LTB concern — plastic capacity governs
    if lambda_lt <= 0.2 {
        return 0.0;
    }

    let alpha_lt = ALPHA_LT_ROLLED; // Rolled I-sections
    let phi_lt = 0.5 * (1.0 + alpha_lt * (lambda_lt - 0.2) + lambda_lt * lambda_lt);

    let discriminant = (phi_lt * phi_lt - lambda_lt * lambda_lt).max(0.0);
    let chi_lt = if discriminant > f64::EPSILON {
        (1.0 / (phi_lt + discriminant.sqrt())).min(1.0).max(0.0)
    } else {
        (1.0 / (2.0 * phi_lt.max(0.5))).min(1.0).max(0.0)
    };

    let md_ltb = beta_b * zp * fy * chi_lt / (GAMMA_M0 * 1e6); // kN·m

    if md_ltb > f64::EPSILON {
        mu_knm / md_ltb
    } else {
        0.0
    }
}

/// Compute P-M interaction UR per IS 800 Cl. 9.3.1
///
/// Linear interaction (conservative):
///   N/Nd + My/Mdy + Mz/Mdz ≤ 1.0
///
/// Only activated when both axial and bending are significant.
fn compute_interaction_ur(
    forces: &MemberForces,
    section: &IsmbSection,
    fy: f64,
    pd_kn: f64,
    md_knm: f64,
) -> f64 {
    let axial_abs = forces.axial_kn.abs();
    let my_abs = forces.moment_y_knm.abs();
    let mz_abs = forces.moment_z_knm.abs();

    // Axial capacity
    let nd = if pd_kn > f64::EPSILON {
        pd_kn
    } else {
        section.area * fy / (GAMMA_M0 * 1000.0)
    };

    // Skip if no significant axial load (< 1% of capacity)
    if axial_abs < 0.01 * nd.abs().max(1.0) {
        return 0.0;
    }

    // Skip if no moment
    if mz_abs < f64::EPSILON && my_abs < f64::EPSILON {
        return 0.0;
    }

    // Minor axis moment capacity (approximate)
    let zpy = 1.15 * section.zyy;
    let mdy_knm = zpy * fy / (GAMMA_M0 * 1e6);

    // IS 800 Cl. 9.3.1.1 — Linear interaction (conservative)
    let n_ratio = axial_abs / nd.max(f64::EPSILON);
    let mz_ratio = mz_abs / md_knm.max(f64::EPSILON);
    let my_ratio = if mdy_knm > f64::EPSILON {
        my_abs / mdy_knm
    } else {
        0.0
    };

    n_ratio + mz_ratio + my_ratio
}

/// Compute deflection UR per IS 800 Table 6
///
/// If actual deflection provided in forces, uses that directly.
/// Otherwise estimates from moment: δ ≈ 5ML²/(48EI) for UDL-equivalent.
/// Allowable: L/300 for beams supporting floors.
fn compute_deflection_ur(
    forces: &MemberForces,
    geometry: &MemberGeometry,
    section: &IsmbSection,
) -> f64 {
    // Only check deflection for beams
    if geometry.member_type != MemberType::Beam {
        return 0.0;
    }

    let span = geometry.length_mm;
    if span < f64::EPSILON || section.ixx < f64::EPSILON {
        return 0.0;
    }

    let actual_defl = match forces.max_deflection_mm {
        Some(d) if d.abs() > f64::EPSILON => d.abs(),
        _ => {
            // Estimate: δ ≈ 5ML²/(48EI) for equivalent UDL moment
            let m = forces.moment_z_knm.abs() * 1e6; // N·mm
            5.0 * m * span * span / (48.0 * E_STEEL * section.ixx)
        }
    };

    // IS 800 Table 6: L/300 for beams supporting floors
    let allowable = span / 300.0;

    if allowable > f64::EPSILON {
        actual_defl / allowable
    } else {
        0.0
    }
}

/// Compute web crippling UR per IS 800 Cl. 8.7.4
///
/// Web bearing capacity: Fw = (b1 + n2) × tw × fyw / γm0
/// b1 = stiff bearing length (conservative 50 mm)
/// n2 = 2.5(tf + R1) at interior — approximated as 5·tf
fn compute_web_crippling_ur(
    forces: &MemberForces,
    section: &IsmbSection,
    fy: f64,
    geometry: &MemberGeometry,
) -> f64 {
    // Only check for beams with significant shear (reactions)
    if geometry.member_type != MemberType::Beam {
        return 0.0;
    }

    let reaction_kn = forces.shear_y_kn.abs();
    if reaction_kn < f64::EPSILON {
        return 0.0;
    }

    // Conservative: assume 50 mm stiff bearing length
    let b1 = 50.0; // mm
                   // n2 = 2.5(tf + R1), approximate R1 ≈ tf
    let n2 = 2.5 * (section.tf + section.tf);

    let fw_kn = (b1 + n2) * section.tw * (fy / GAMMA_M0) / 1000.0;

    if fw_kn > f64::EPSILON {
        reaction_kn / fw_kn
    } else {
        0.0
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// MULTI-STATION SECTION-WISE FSD CHECK
// ═══════════════════════════════════════════════════════════════════════════

/// Design check result using section-wise analysis (21-station UR)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SectionWiseDesignCheck {
    pub member_id: String,
    pub section_name: String,
    /// Max UR across all 21 stations (governs sizing)
    pub max_utilization: f64,
    /// Min UR across all stations (for economy ratio)
    pub min_utilization: f64,
    /// Governing station index (0–20)
    pub governing_station: usize,
    /// UR at midspan (station 10)
    pub midspan_ur: f64,
    /// Average UR at supports (stations 0 + 20) / 2
    pub support_ur: f64,
    pub passed: bool,
    pub economy_ratio: f64,
}

/// Check member using multi-station section-wise design (IS 800)
///
/// Instead of single-point UR, this runs the full 21-station SteelSectionWiseDesigner,
/// returning the max UR across all stations. This is the correct metric for FSD.
pub fn check_member_section_wise(
    demands: &[SectionDemand],
    section_name: &str,
    fy: f64,
    unbraced_length: f64,
    is_rolled: bool,
    member_id: &str,
) -> Result<SectionWiseDesignCheck, String> {
    let section_input = section_wise::lookup_ismb(section_name)
        .ok_or_else(|| format!("Unknown section: {}", section_name))?;

    let designer = SteelSectionWiseDesigner::new(fy, SteelDesignCode::Is800);
    let result =
        designer.design_member_sectionwise(&section_input, demands, unbraced_length, is_rolled)?;

    let checks = &result.section_checks;

    let midspan_ur = if checks.len() > 10 {
        checks[10].utilization_m.max(checks[10].utilization_v)
    } else {
        result.utilization
    };

    let n = checks.len();
    let support_ur = if n > 1 {
        let start_ur = checks[0].utilization_m.max(checks[0].utilization_v);
        let end_ur = checks[n - 1].utilization_m.max(checks[n - 1].utilization_v);
        (start_ur + end_ur) / 2.0
    } else {
        result.utilization
    };

    let max_ur = result.utilization;
    let min_ur = checks
        .iter()
        .map(|c| c.utilization_m.max(c.utilization_v))
        .fold(f64::INFINITY, f64::min);

    let governing_station = checks
        .iter()
        .enumerate()
        .max_by(|a, b| {
            let ua = a.1.utilization_m.max(a.1.utilization_v);
            let ub = b.1.utilization_m.max(b.1.utilization_v);
            ua.partial_cmp(&ub).unwrap_or(std::cmp::Ordering::Equal)
        })
        .map(|(i, _)| i)
        .unwrap_or(0);

    let economy = if min_ur > 1e-6 {
        max_ur / min_ur
    } else {
        f64::INFINITY
    };

    Ok(SectionWiseDesignCheck {
        member_id: member_id.to_string(),
        section_name: section_name.to_string(),
        max_utilization: max_ur,
        min_utilization: min_ur,
        governing_station,
        midspan_ur,
        support_ur,
        passed: result.passed,
        economy_ratio: economy,
    })
}

// ═══════════════════════════════════════════════════════════════════════════
// HAUNCH HEURISTIC
// ═══════════════════════════════════════════════════════════════════════════

/// Haunch recommendation for steel beams
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HaunchRecommendation {
    pub member_id: String,
    pub recommended: bool,
    /// "none", "both_ends", "left_end", "right_end"
    pub haunch_location: String,
    /// Suggested haunch depth increase as fraction of beam depth (e.g. 0.5 = 50% deeper)
    pub depth_increase_ratio: f64,
    /// Estimated weight saving vs upsizing the whole member (%)
    pub estimated_saving_pct: f64,
    pub reason: String,
}

/// Evaluate whether a haunch is economical for a beam.
///
/// Heuristic: If supports have UR >> midspan UR (typical in continuous beams),
/// a haunch at supports is more efficient than upsizing the entire member.
/// Threshold: support_ur / midspan_ur > 1.5 and midspan UR < 0.7 × max_ur
pub fn evaluate_haunch(sw_check: &SectionWiseDesignCheck, member_id: &str) -> HaunchRecommendation {
    let ratio = if sw_check.midspan_ur > 1e-6 {
        sw_check.support_ur / sw_check.midspan_ur
    } else {
        0.0
    };

    if ratio > 1.5 && sw_check.midspan_ur < 0.7 * sw_check.max_utilization {
        // Supports are governing — haunch is efficient
        let excess_ur = sw_check.support_ur - sw_check.midspan_ur;
        let depth_increase = (excess_ur * 0.5).min(0.8).max(0.2);
        // Rough saving estimate: haunch typically at ~15% of span each end = 30% of member
        // Weight increase from haunch ≈ depth_increase × 30% vs upsizing 100%
        let saving = ((1.0 - depth_increase * 0.3) * 100.0).max(10.0).min(40.0);

        HaunchRecommendation {
            member_id: member_id.to_string(),
            recommended: true,
            haunch_location: "both_ends".to_string(),
            depth_increase_ratio: (depth_increase * 100.0).round() / 100.0,
            estimated_saving_pct: saving.round(),
            reason: format!(
                "Support UR ({:.0}%) >> Midspan UR ({:.0}%): haunch more efficient than upsizing whole member",
                sw_check.support_ur * 100.0,
                sw_check.midspan_ur * 100.0,
            ),
        }
    } else {
        HaunchRecommendation {
            member_id: member_id.to_string(),
            recommended: false,
            haunch_location: "none".to_string(),
            depth_increase_ratio: 0.0,
            estimated_saving_pct: 0.0,
            reason: "Uniform section adequate — no significant UR gradient along span".to_string(),
        }
    }
}

/// Before/after comparison for FSD with section-wise checking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FSDSectionWiseComparison {
    /// Single-point UR (traditional)
    pub single_point_max_ur: f64,
    /// Multi-station max UR (section-wise)
    pub section_wise_max_ur: f64,
    /// Whether section-wise check is more conservative (usually yes)
    pub section_wise_more_conservative: bool,
    /// Haunch recommendations per member
    pub haunch_recommendations: Vec<HaunchRecommendation>,
    /// Number of members where haunch is suggested
    pub haunch_count: usize,
    /// Estimated total weight saving if haunches are used (%)
    pub haunch_saving_pct: f64,
}

// ═══════════════════════════════════════════════════════════════════════════
// RC (REINFORCED CONCRETE) DESIGN CHECK — IS 456:2000
// ═══════════════════════════════════════════════════════════════════════════

/// RC design check result per member per load combination.
///
/// Checks flexure (Cl. 38.1), shear (Cl. 40.1), deflection (Cl. 23.2),
/// and reinforcement limits (0.85bd/fy ≤ Ast ≤ 0.04bD).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RCDesignCheck {
    pub member_id: String,
    pub load_combo: String,
    /// Governing utilization ratio (max of individual checks)
    pub utilization_ratio: f64,
    pub passed: bool,
    pub governing_check: String,

    // Individual utilization ratios
    pub flexure_ur: f64,
    pub shear_ur: f64,
    pub deflection_ur: f64,

    // Reinforcement output
    /// Required tension reinforcement (mm²)
    pub ast_required_mm2: f64,
    /// Provided tension reinforcement (mm²)
    pub ast_provided_mm2: f64,
    /// Bar diameter selected (mm)
    pub bar_dia_mm: f64,
    /// Number of bars
    pub bar_count: usize,
    /// Stirrup diameter (mm)
    pub stirrup_dia_mm: f64,
    /// Stirrup spacing (mm)
    pub stirrup_spacing_mm: f64,
    /// Development length required (mm) — IS 456 Cl. 26.2.1
    pub ld_mm: f64,
}

/// Perform IS 456 RC design check for a concrete beam member.
///
/// # Arguments
/// * `member_id` — member identifier
/// * `load_combo` — load combination name
/// * `mu_knm` — factored bending moment (kN·m, absolute)
/// * `vu_kn` — factored shear force (kN, absolute)
/// * `b_mm` — beam width (mm)
/// * `d_mm` — overall depth D (mm); effective depth = D − cover − dia/2
/// * `cover_mm` — clear cover (mm), default 30–40
/// * `span_mm` — member span (mm), for deflection check
/// * `fck` — characteristic concrete strength (N/mm²)
/// * `fy` — yield strength of reinforcement (N/mm²)
/// * `support_type` — "simply_supported", "continuous", or "cantilever"
pub fn check_member_rc(
    member_id: &str,
    load_combo: &str,
    mu_knm: f64,
    vu_kn: f64,
    b_mm: f64,
    d_mm: f64,
    cover_mm: f64,
    span_mm: f64,
    fck: f64,
    fy: f64,
    support_type: &str,
) -> RCDesignCheck {
    let mu = mu_knm.abs();
    let vu = vu_kn.abs();

    // Effective depth
    // Assume 20mm bar initially for d_eff
    let d_eff = d_mm - cover_mm - 10.0; // D − cover − bar_dia/2

    // ── 1. Flexure check — IS 456 Cl. 38.1 ──
    let design_result = is_456::design_rc_beam_lsd(b_mm, d_eff, cover_mm, fck, fy, mu, vu);

    let ast_required = design_result.bending.ast_required_mm2;
    let ast_provided = design_result.bending.main_rebar.area_provided_mm2;

    // Flexure UR = Mu_demand / Mu_capacity
    let mu_capacity = is_456::flexural_capacity_singly(b_mm, d_eff, fck, fy, ast_provided);
    let flexure_ur = if mu_capacity > 0.0 {
        mu / mu_capacity
    } else {
        f64::INFINITY
    };

    // ── 2. Shear check — IS 456 Cl. 40.1 ──
    let pt_percent = (ast_provided / (b_mm * d_eff)) * 100.0;
    // Use 2-legged 8mm stirrups as default Asv for initial check
    let asv_default = 2.0 * std::f64::consts::PI / 4.0 * 8.0 * 8.0; // ~100.5 mm²
    let shear_result = is_456::design_shear(vu, b_mm, d_eff, fck, fy, pt_percent, asv_default);
    // Shear UR = τv / τc_max
    let shear_ur = if shear_result.tau_c_max > 0.0 {
        shear_result.tau_v / shear_result.tau_c_max
    } else {
        f64::INFINITY
    };

    // ── 3. Deflection check — IS 456 Cl. 23.2 ──
    let pc_percent = 0.0; // no compression steel for singly reinforced
    let defl = is_456::check_deflection(
        span_mm,
        d_eff,
        support_type,
        pt_percent,
        pc_percent,
        fy,
        ast_provided,
        ast_required,
    );
    // UR = (actual L/d) / (allowable L/d); > 1.0 = fail
    let actual_l_by_d = span_mm / d_eff;
    let deflection_ur = if defl.allowable_l_by_d > 0.0 {
        actual_l_by_d / defl.allowable_l_by_d
    } else {
        0.0
    };

    // ── 4. Reinforcement limits — IS 456 Cl. 26.5.1.1 ──
    let ast_min = 0.85 * b_mm * d_eff / fy;
    let ast_max = 0.04 * b_mm * d_mm;
    let ast_final = ast_provided.max(ast_min);

    // Select rebar configuration
    let rebar = is_456::select_reinforcement(ast_final, b_mm);

    // Development length
    let ld = is_456::development_length(rebar.diameter_mm, fy, fck);

    // Stirrup details from shear design
    let vus_for_stirrups = (shear_result.vus).max(0.0); // vus already in kN
    let (stirrup_dia, stirrup_spacing, _asv) =
        is_456::design_stirrup_spacing(vus_for_stirrups, b_mm, d_eff, fy);

    // ── Governing check ──
    let checks = [
        ("Flexure (IS 456 Cl. 38.1)", flexure_ur),
        ("Shear (IS 456 Cl. 40.1)", shear_ur),
        ("Deflection (IS 456 Cl. 23.2)", deflection_ur),
    ];
    let (governing_name, governing_ur) = checks
        .iter()
        .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))
        .unwrap();

    let overall_ur = round3(*governing_ur);

    // Debug: print values for known failing example to diagnose UR > 1
    if member_id == "B1" && (mu_knm - 100.0).abs() < f64::EPSILON {
        eprintln!(
            "DEBUG check_member_rc: mu={} kN·m, vu={} kN, b={} mm, d_eff={} mm",
            mu_knm, vu_kn, b_mm, d_eff
        );
        eprintln!(
            "  ast_required={} mm², ast_provided={} mm², mu_capacity={} kN·m",
            ast_required, ast_final, mu_capacity
        );
        eprintln!(
            "  flexure_ur={}, shear.tau_v={} N/mm², shear.tau_c={} N/mm², shear.tau_c_max={} N/mm²",
            flexure_ur, shear_result.tau_v, shear_result.tau_c, shear_result.tau_c_max
        );
        eprintln!(
            "  shear.vus={} kN, vus_for_stirrups={} kN, shear_ur={}",
            shear_result.vus, vus_for_stirrups, shear_ur
        );
    }

    RCDesignCheck {
        member_id: member_id.to_string(),
        load_combo: load_combo.to_string(),
        utilization_ratio: overall_ur,
        passed: overall_ur <= 1.0 && ast_final <= ast_max,
        governing_check: governing_name.to_string(),
        flexure_ur: round3(flexure_ur),
        shear_ur: round3(shear_ur),
        deflection_ur: round3(deflection_ur),
        ast_required_mm2: round3(ast_required),
        ast_provided_mm2: round3(ast_final),
        bar_dia_mm: rebar.diameter_mm,
        bar_count: rebar.count,
        stirrup_dia_mm: stirrup_dia,
        stirrup_spacing_mm: stirrup_spacing,
        ld_mm: round3(ld),
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fsd_config_default() {
        let config = FSDConfig::default();
        assert_eq!(config.target_ur, 0.85);
        assert_eq!(config.max_ur, 1.0);
        assert_eq!(config.max_iterations, 20);
    }

    #[test]
    fn test_member_check() {
        let forces = MemberForces {
            member_id: "B1".to_string(),
            load_combo: "1.2DL+1.6LL".to_string(),
            axial_kn: -100.0, // Compression
            shear_y_kn: 50.0,
            shear_z_kn: 0.0,
            moment_y_knm: 0.0,
            moment_z_knm: 120.0,
            torsion_knm: 0.0,
            max_deflection_mm: None,
        };

        let geometry = MemberGeometry {
            member_id: "B1".to_string(),
            length_mm: 5000.0,
            effective_length_y: 5000.0,
            effective_length_z: 5000.0,
            unbraced_length: None,
            member_type: MemberType::Beam,
            material_type: MaterialType::Steel,
            b_mm: None,
            d_mm: None,
            cover_mm: None,
            fck: None,
            fy_rebar: None,
        };

        let check = check_member(&forces, &geometry, "ISMB300", 250.0);

        assert!(check.utilization_ratio > 0.0);
        assert!(check.utilization_ratio < 2.0);
        assert!(!check.governing_check.is_empty());
        // Verify new checks are computed
        assert!(check.ltb_ur >= 0.0, "LTB UR should be non-negative");
        assert!(
            check.interaction_ur >= 0.0,
            "Interaction UR should be non-negative"
        );
        assert!(
            check.deflection_ur >= 0.0,
            "Deflection UR should be non-negative"
        );
    }

    #[test]
    fn test_ltb_check_is800() {
        // Textbook example: ISMB 300, 6m unbraced span, 80 kN·m moment
        // LTB should reduce capacity below plastic moment
        let forces = MemberForces {
            member_id: "B1".to_string(),
            load_combo: "1.5DL".to_string(),
            axial_kn: 0.0,
            shear_y_kn: 40.0,
            shear_z_kn: 0.0,
            moment_y_knm: 0.0,
            moment_z_knm: 80.0,
            torsion_knm: 0.0,
            max_deflection_mm: None,
        };
        let geometry = MemberGeometry {
            member_id: "B1".to_string(),
            length_mm: 6000.0,
            effective_length_y: 6000.0,
            effective_length_z: 6000.0,
            unbraced_length: Some(6000.0),
            member_type: MemberType::Beam,
            material_type: MaterialType::Steel,
            b_mm: None,
            d_mm: None,
            cover_mm: None,
            fck: None,
            fy_rebar: None,
        };
        let check = check_member(&forces, &geometry, "ISMB300", 250.0);
        // With 6m unbraced length, LTB should be active for ISMB 300
        assert!(
            check.ltb_ur > 0.0,
            "LTB should be active for 6m span: ltb_ur={}",
            check.ltb_ur
        );
        // LTB UR should be larger than basic flexure UR (LTB reduces capacity)
        assert!(
            check.ltb_ur >= check.flexure_ur,
            "LTB should govern over flexure: ltb={}, flex={}",
            check.ltb_ur,
            check.flexure_ur
        );
    }

    #[test]
    fn test_pm_interaction_is800() {
        // Column with combined compression + bending: interaction should activate
        let forces = MemberForces {
            member_id: "C1".to_string(),
            load_combo: "1.5DL+1.5LL".to_string(),
            axial_kn: -500.0, // 500 kN compression
            shear_y_kn: 20.0,
            shear_z_kn: 0.0,
            moment_y_knm: 0.0,
            moment_z_knm: 60.0, // 60 kN·m moment
            torsion_knm: 0.0,
            max_deflection_mm: None,
        };
        let geometry = MemberGeometry {
            member_id: "C1".to_string(),
            length_mm: 3500.0,
            effective_length_y: 3500.0,
            effective_length_z: 3500.0,
            unbraced_length: None,
            member_type: MemberType::Column,
            material_type: MaterialType::Steel,
            b_mm: None,
            d_mm: None,
            cover_mm: None,
            fck: None,
            fy_rebar: None,
        };
        let check = check_member(&forces, &geometry, "ISMB300", 250.0);
        // P-M interaction should exceed individual compression and flexure URs
        assert!(
            check.interaction_ur > check.compression_ur,
            "Interaction should exceed compression: int={}, comp={}",
            check.interaction_ur,
            check.compression_ur
        );
        assert!(
            check.interaction_ur > check.flexure_ur,
            "Interaction should exceed flexure: int={}, flex={}",
            check.interaction_ur,
            check.flexure_ur
        );
    }

    #[test]
    fn test_weight_calculation() {
        let config = FSDConfig::default();
        let engine = FSDEngine::new(config);

        let mut sections = HashMap::new();
        sections.insert("B1".to_string(), "ISMB300".to_string());
        sections.insert("B2".to_string(), "ISMB250".to_string());

        let geometries = vec![
            MemberGeometry {
                member_id: "B1".to_string(),
                length_mm: 6000.0,
                effective_length_y: 6000.0,
                effective_length_z: 6000.0,
                unbraced_length: None,
                member_type: MemberType::Beam,
                material_type: MaterialType::Steel,
                b_mm: None,
                d_mm: None,
                cover_mm: None,
                fck: None,
                fy_rebar: None,
            },
            MemberGeometry {
                member_id: "B2".to_string(),
                length_mm: 5000.0,
                effective_length_y: 5000.0,
                effective_length_z: 5000.0,
                unbraced_length: None,
                member_type: MemberType::Beam,
                material_type: MaterialType::Steel,
                b_mm: None,
                d_mm: None,
                cover_mm: None,
                fck: None,
                fy_rebar: None,
            },
        ];

        let weight = engine.calculate_total_weight(&sections, &geometries);

        // ISMB 300 = 44.6 kg/m × 6m = 267.6 kg
        // ISMB 250 = 37.3 kg/m × 5m = 186.5 kg
        // Total ≈ 454 kg
        // Allow wider range due to section database variations
        assert!(weight > 350.0 && weight < 600.0, "Weight was {}", weight);
    }

    #[test]
    fn test_check_member_section_wise() {
        // Simply-supported beam ISMB300 with parabolic moment demand
        let demands: Vec<SectionDemand> = (0..=20)
            .map(|i| {
                let x = i as f64 / 20.0;
                let mu = 4.0 * 80.0 * x * (1.0 - x); // Peak 80 kN·m at midspan
                let vu = 40.0 * (1.0 - 2.0 * x).abs(); // Linear shear, peak 40 kN at supports
                SectionDemand {
                    location: SectionLocation {
                        x_mm: x * 6000.0,
                        x_ratio: x,
                        label: format!("{:.1}L", x),
                    },
                    mu_knm: mu,
                    vu_kn: vu,
                    moment_type: if mu >= 0.0 {
                        MomentType::Sagging
                    } else {
                        MomentType::Hogging
                    },
                }
            })
            .collect();

        let result = check_member_section_wise(&demands, "ISMB300", 250.0, 2000.0, true, "B1");
        assert!(result.is_ok());
        let check = result.unwrap();
        assert!(check.max_utilization > 0.0);
        assert!(check.midspan_ur > check.support_ur);
        assert!(check.passed);
    }

    #[test]
    fn test_haunch_not_recommended_for_simple_beam() {
        let sw = SectionWiseDesignCheck {
            member_id: "B1".into(),
            section_name: "ISMB300".into(),
            max_utilization: 0.75,
            min_utilization: 0.05,
            governing_station: 10,
            midspan_ur: 0.75,
            support_ur: 0.10,
            passed: true,
            economy_ratio: 15.0,
        };
        let haunch = evaluate_haunch(&sw, "B1");
        assert!(!haunch.recommended);
    }

    #[test]
    fn test_haunch_recommended_for_continuous_beam() {
        // Continuous beam pattern: high support UR, low midspan UR
        let sw = SectionWiseDesignCheck {
            member_id: "B2".into(),
            section_name: "ISMB300".into(),
            max_utilization: 0.95,
            min_utilization: 0.15,
            governing_station: 0,
            midspan_ur: 0.35,
            support_ur: 0.95,
            passed: true,
            economy_ratio: 6.3,
        };
        let haunch = evaluate_haunch(&sw, "B2");
        assert!(haunch.recommended);
        assert_eq!(haunch.haunch_location, "both_ends");
        assert!(haunch.depth_increase_ratio > 0.0);
        assert!(haunch.estimated_saving_pct > 0.0);
    }

    #[test]
    fn test_rc_design_check_is456() {
        // Example: 300×500mm RC beam, M25/Fe415, span 6m, Mu=100 kN·m, Vu=80 kN
        let check = check_member_rc(
            "B1",
            "1.5(DL+LL)",
            100.0,  // Mu (kN·m)
            80.0,   // Vu (kN)
            300.0,  // b (mm)
            500.0,  // D overall depth (mm)
            40.0,   // cover (mm)
            6000.0, // span (mm)
            25.0,   // fck
            415.0,  // fy
            "simply_supported",
        );
        assert!(
            check.passed,
            "RC beam should pass: UR = {}",
            check.utilization_ratio
        );
        assert!(check.utilization_ratio <= 1.0);
        assert!(check.utilization_ratio > 0.0);
        assert!(check.flexure_ur > 0.0, "Flexure UR should be positive");
        assert!(
            check.ast_required_mm2 > 0.0,
            "Ast required should be positive"
        );
        assert!(
            check.ast_provided_mm2 >= check.ast_required_mm2,
            "Ast provided {} >= required {}",
            check.ast_provided_mm2,
            check.ast_required_mm2
        );
        assert!(check.bar_dia_mm > 0.0, "Bar dia should be positive");
        assert!(check.bar_count >= 2, "At least 2 bars");
        assert!(check.ld_mm > 0.0, "Development length should be positive");
        assert!(
            check.stirrup_spacing_mm > 0.0,
            "Stirrup spacing should be positive"
        );
        assert!(!check.governing_check.is_empty());
    }
}
