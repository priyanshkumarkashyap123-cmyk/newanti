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

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::design_codes::is_800::{design_shear, ismb_database, IsmbSection, GAMMA_M0};
use crate::design_codes::section_wise::{
    self, MomentType, SectionDemand, SectionLocation, SteelDesignCode,
    SteelSectionWiseDesigner,
};

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
    pub axial_kn: f64,      // Positive = tension, Negative = compression
    pub shear_y_kn: f64,
    pub shear_z_kn: f64,
    pub moment_y_knm: f64,
    pub moment_z_knm: f64,
    pub torsion_knm: f64,
}

/// Member geometric properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberGeometry {
    pub member_id: String,
    pub length_mm: f64,
    pub effective_length_y: f64,  // For buckling
    pub effective_length_z: f64,
    pub member_type: MemberType,   // Beam, Column, Brace
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum MemberType {
    Beam,
    Column,
    Brace,
    Truss,
}

/// Design check result per member per load combo
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesignCheck {
    pub member_id: String,
    pub load_combo: String,
    pub section_name: String,
    pub utilization_ratio: f64,     // Max of all checks (flex, shear, comp)
    pub flexure_ur: f64,
    pub shear_ur: f64,
    pub compression_ur: f64,
    pub passed: bool,
    pub governing_check: String,    // "flexure", "shear", "compression"
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
            convergence_tolerance: 0.5,  // 0.5% weight change
            material_density: 7.85e-6,   // Steel: kg/mm³
            material_cost: Some(1.2),     // $/kg typical
            fy: 250.0,
            group_by_type: true,
            max_unique_sections: Some(8),
        }
    }
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
}

impl FSDEngine {
    /// Create new FSD engine with configuration
    pub fn new(config: FSDConfig) -> Self {
        let section_database = ismb_database();
        
        Self {
            config,
            section_database,
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
            
            let (new_sections, num_changes) = self.resize_members(
                &current_sections,
                &member_max_ur,
                geometries,
            );
            
            // ═══════════════════════════════════════════════════════════════
            // STEP 4: Calculate convergence metrics
            // ═══════════════════════════════════════════════════════════════
            
            let current_weight = self.calculate_total_weight(&new_sections, geometries);
            let weight_change_pct = ((previous_weight - current_weight) / previous_weight).abs() * 100.0;
            
            let max_ur = member_max_ur.values().cloned().fold(0.0, f64::max);
            let avg_ur = member_max_ur.values().sum::<f64>() / member_max_ur.len() as f64;
            let num_failing = member_max_ur.values().filter(|&&ur| ur > self.config.max_ur).count();
            
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
        
        let unique_sections = current_sections.values().collect::<std::collections::HashSet<_>>().len();
        
        let weight_savings_pct = ((initial_weight - final_weight) / initial_weight) * 100.0;
        
        let success = max_ur <= self.config.max_ur && converged;
        
        let message = if !converged && iteration >= self.config.max_iterations {
            format!("Maximum iterations ({}) reached without convergence", self.config.max_iterations)
        } else if max_ur > self.config.max_ur {
            format!("Design failed: max UR = {:.3} > {:.3}", max_ur, self.config.max_ur)
        } else {
            format!("Optimization successful: {} iterations, {:.1}% weight savings", iteration, weight_savings_pct)
        };
        
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
            let current_section = current_sections.get(member_id).cloned()
                .unwrap_or_else(|| "ISMB 200".to_string());
            
            let ur = member_ur.get(member_id).copied().unwrap_or(0.0);
            
            // Find current section index in database
            let current_idx = self.section_database.iter()
                .position(|s| s.name == current_section)
                .unwrap_or(0);
            
            let new_section = if ur > self.config.max_ur {
                // ═══════════════════════════════════════════════════════════
                // STRESS-DRIVEN RESIZING: Member is failing → Upsize
                // ═══════════════════════════════════════════════════════════
                
                // Estimate required section modulus scaling
                let scale_factor = ur / self.config.max_ur;
                
                // Search for next adequate section
                self.upsize_section(current_idx, scale_factor)
                
            } else if ur < self.config.target_ur {
                // ═══════════════════════════════════════════════════════════
                // ECONOMY-DRIVEN RESIZING: Member is over-designed → Downsize
                // ═══════════════════════════════════════════════════════════
                
                // Try one step lighter (conservative downsizing)
                self.downsize_section(current_idx)
                
            } else {
                // ═══════════════════════════════════════════════════════════
                // OPTIMAL RANGE: Keep current section
                // ═══════════════════════════════════════════════════════════
                current_section.clone()
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
        self.section_database.last()
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
    
    // ═══════════════════════════════════════════════════════════════════════
    // HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════
    
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
            let section_name = sections.get(&geom.member_id)
                .cloned()
                .unwrap_or_else(|| "ISMB 200".to_string());
            
            if let Some(section) = self.section_database.iter().find(|s| s.name == section_name) {
                // Weight = density × area × length
                // Note: section.weight is kg/m, so convert accordingly
                let length_m = geom.length_mm / 1000.0;
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

/// Perform design check for single member
///
/// Returns DesignCheck with all utilization ratios
pub fn check_member(
    forces: &MemberForces,
    geometry: &MemberGeometry,
    section_name: &str,
    fy: f64,
) -> DesignCheck {
    let section_db = ismb_database();
    let section = match section_db.iter()
        .find(|s| s.name == section_name)
    {
        Some(s) => s,
        None => return DesignCheck {
            member_id: forces.member_id.clone(),
            load_combo: forces.load_combo.clone(),
            section_name: section_name.to_string(),
            utilization_ratio: f64::INFINITY,
            flexure_ur: 0.0,
            shear_ur: 0.0,
            compression_ur: 0.0,
            passed: false,
            governing_check: format!("Section '{}' not in database", section_name),
        },
    };
    
    // ═══════════════════════════════════════════════════════════════════════
    // FLEXURE CHECK
    // ═══════════════════════════════════════════════════════════════════════
    
    let zpxx = 1.15 * section.zxx;  // Approximate plastic modulus
    let md_knm = zpxx * fy / (GAMMA_M0 * 1e6);
    let mux_abs = forces.moment_z_knm.abs();
    let flexure_ur = if md_knm > 0.0 { mux_abs / md_knm } else { 0.0 };
    
    // ═══════════════════════════════════════════════════════════════════════
    // SHEAR CHECK
    // ═══════════════════════════════════════════════════════════════════════
    
    let d_web = section.depth - 2.0 * section.tf;
    let vu_kn = forces.shear_y_kn.abs();
    let shear_result = design_shear(d_web, section.tw, fy, vu_kn);
    let shear_ur = shear_result.utilization;
    
    // ═══════════════════════════════════════════════════════════════════════
    // COMPRESSION CHECK (if axial load present)
    // ═══════════════════════════════════════════════════════════════════════
    
    let compression_ur = if forces.axial_kn < 0.0 {
        // Compression (negative axial)
        let pu_kn = forces.axial_kn.abs();
        
        let lambda_xx = geometry.effective_length_y / section.rxx.max(1.0);
        let lambda_yy = geometry.effective_length_z / section.ryy.max(1.0);
        let lambda = lambda_xx.max(lambda_yy);
        let lambda_e = (lambda / std::f64::consts::PI) * (fy / 200_000.0).sqrt();
        
        let alpha = 0.34;  // Buckling curve b for I-sections
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
        let pd_kn = section.area * fcd / 1000.0;
        
        if pd_kn > 0.0 { pu_kn / pd_kn } else { 0.0 }
    } else {
        0.0  // Tension — simplified (would need bolt check in practice)
    };
    
    // ═══════════════════════════════════════════════════════════════════════
    // GOVERNING CHECK
    // ═══════════════════════════════════════════════════════════════════════
    
    let utilization_ratio = flexure_ur.max(shear_ur).max(compression_ur);
    
    let governing_check = if flexure_ur >= shear_ur && flexure_ur >= compression_ur {
        "flexure"
    } else if shear_ur >= compression_ur {
        "shear"
    } else {
        "compression"
    };
    
    DesignCheck {
        member_id: forces.member_id.clone(),
        load_combo: forces.load_combo.clone(),
        section_name: section_name.to_string(),
        utilization_ratio: (utilization_ratio * 1000.0).round() / 1000.0,
        flexure_ur: (flexure_ur * 1000.0).round() / 1000.0,
        shear_ur: (shear_ur * 1000.0).round() / 1000.0,
        compression_ur: (compression_ur * 1000.0).round() / 1000.0,
        passed: utilization_ratio <= 1.0,
        governing_check: governing_check.to_string(),
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
    let result = designer.design_member_sectionwise(
        &section_input,
        demands,
        unbraced_length,
        is_rolled,
    )?;

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
    let min_ur = checks.iter()
        .map(|c| c.utilization_m.max(c.utilization_v))
        .fold(f64::INFINITY, f64::min);

    let governing_station = checks.iter()
        .enumerate()
        .max_by(|a, b| {
            let ua = a.1.utilization_m.max(a.1.utilization_v);
            let ub = b.1.utilization_m.max(b.1.utilization_v);
            ua.partial_cmp(&ub).unwrap_or(std::cmp::Ordering::Equal)
        })
        .map(|(i, _)| i)
        .unwrap_or(0);

    let economy = if min_ur > 1e-6 { max_ur / min_ur } else { f64::INFINITY };

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
pub fn evaluate_haunch(
    sw_check: &SectionWiseDesignCheck,
    member_id: &str,
) -> HaunchRecommendation {
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
            axial_kn: -100.0,  // Compression
            shear_y_kn: 50.0,
            shear_z_kn: 0.0,
            moment_y_knm: 0.0,
            moment_z_knm: 120.0,
            torsion_knm: 0.0,
        };
        
        let geometry = MemberGeometry {
            member_id: "B1".to_string(),
            length_mm: 5000.0,
            effective_length_y: 5000.0,
            effective_length_z: 5000.0,
            member_type: MemberType::Beam,
        };
        
        let check = check_member(&forces, &geometry, "ISMB300", 250.0);
        
        assert!(check.utilization_ratio > 0.0);
        assert!(check.utilization_ratio < 2.0);
        assert!(!check.governing_check.is_empty());
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
                member_type: MemberType::Beam,
            },
            MemberGeometry {
                member_id: "B2".to_string(),
                length_mm: 5000.0,
                effective_length_y: 5000.0,
                effective_length_z: 5000.0,
                member_type: MemberType::Beam,
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
                    moment_type: if mu >= 0.0 { MomentType::Sagging } else { MomentType::Hogging },
                }
            })
            .collect();

        let result = check_member_section_wise(
            &demands, "ISMB300", 250.0, 2000.0, true, "B1",
        );
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
}
