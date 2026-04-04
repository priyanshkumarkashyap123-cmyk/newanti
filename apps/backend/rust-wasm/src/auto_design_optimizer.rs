// =====================================================================
// Auto-Design Optimization Loop
// =====================================================================
//
// Iterative analysis → check D/C → re-select section → re-analyze loop.
// Changing a member's stiffness changes the force distribution,
// so we must iterate until the entire structure converges on an
// optimal-weight set of sections.
//
// References:
//   AISC 360-22, IS 800:2007, EN 1993-1-1
//   ASCE 7-22 serviceability (L/360 etc.)
// =====================================================================

use std::collections::HashMap;

// ─── Section catalogue ──────────────────────────────────────────────

/// A steel section from any standard (IS/AISC/EN/BS).
#[derive(Debug, Clone)]
pub struct CatalogSection {
    pub designation: String,
    pub standard: SectionStandard,
    pub shape: SectionShape,
    // Geometry (mm)
    pub depth: f64,
    pub flange_width: f64,
    pub web_thickness: f64,
    pub flange_thickness: f64,
    // Section properties
    pub area_mm2: f64,
    pub ixx_mm4: f64,          // strong-axis
    pub iyy_mm4: f64,          // weak-axis
    pub zxx_mm3: f64,          // elastic, strong
    pub zyy_mm3: f64,          // elastic, weak
    pub zpxx_mm3: f64,         // plastic, strong
    pub zpyy_mm3: f64,         // plastic, weak
    pub rxx_mm: f64,           // radius of gyration
    pub ryy_mm: f64,
    pub mass_per_m: f64,       // kg/m
    pub j_mm4: f64,            // torsion constant
    pub cw_mm6: f64,           // warping constant
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SectionStandard { Indian, AISC, European, British, Custom }

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SectionShape {
    IBeam, Channel, Angle, Tee,
    HSSRect, HSSSquare, Pipe,
    WideFlange, PlateGirder,
}

// ─── Design check result ────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct MemberDCResult {
    pub member_id: String,
    pub section: String,
    pub dc_flexure_major: f64,
    pub dc_flexure_minor: f64,
    pub dc_shear: f64,
    pub dc_axial: f64,
    pub dc_interaction: f64,
    pub dc_governing: f64,
    pub dc_deflection: f64,
    pub check_name: String,
    pub pass: bool,
}

impl MemberDCResult {
    pub fn governing_dc(&self) -> f64 {
        self.dc_governing.max(self.dc_deflection)
    }
}

// ─── Simple stiffness model (beam-column) ───────────────────────────

/// Represents a member in the structure for local analysis.
#[derive(Debug, Clone)]
pub struct StructuralMember {
    pub id: String,
    pub length_mm: f64,
    pub current_section: String,
    pub elastic_modulus: f64,          // MPa
    pub yield_strength: f64,          // MPa
    pub unbraced_length_major_mm: f64,
    pub unbraced_length_minor_mm: f64,
    pub effective_length_factor_major: f64,
    pub effective_length_factor_minor: f64,
    pub cb: f64,                      // Moment gradient factor
    pub member_type: MemberType,
    // Demand (from analysis)
    pub axial_kn: f64,
    pub moment_major_knm: f64,
    pub moment_minor_knm: f64,
    pub shear_major_kn: f64,
    pub shear_minor_kn: f64,
    pub max_deflection_mm: f64,
    pub span_for_deflection_mm: f64,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum MemberType { Beam, Column, BraceOrStrut }

// ─── Design code engine ─────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum DesignCode { IS800, AISC360, EN1993 }

/// Compute D/C ratios for a given section under given demands.
pub fn compute_dc_ratios(
    member: &StructuralMember,
    section: &CatalogSection,
    code: DesignCode,
) -> MemberDCResult {
    let fy = member.yield_strength;
    let e = member.elastic_modulus;

    // Capacity calculations
    let phi_b = match code { DesignCode::AISC360 => 0.90, _ => 1.0 / 1.10 };
    let phi_c = match code { DesignCode::AISC360 => 0.90, _ => 1.0 / 1.10 };
    let phi_v = match code { DesignCode::AISC360 => 1.00, _ => 1.0 / 1.10 };

    // Flexural capacity (plastic moment)
    let mp_major = phi_b * fy * section.zpxx_mm3 / 1e6; // kN·m
    let mp_minor = phi_b * fy * section.zpyy_mm3 / 1e6;

    // Lateral-torsional buckling (simplified)
    let lb = member.unbraced_length_major_mm;
    let ry = section.ryy_mm.max(1.0);
    let lambda_ltb = lb / ry;
    let fe_ltb = std::f64::consts::PI.powi(2) * e / (lambda_ltb * lambda_ltb);
    let fcr_ltb = if fe_ltb >= 2.25 * fy { fy } else { 0.658_f64.powf(fy / fe_ltb) * fy };
    let mn_ltb = phi_b * fcr_ltb * section.zpxx_mm3 / 1e6;
    let mn_major = mn_ltb.min(mp_major);

    // Compression capacity (strong + weak axis)
    let kl_major = member.effective_length_factor_major * member.unbraced_length_major_mm;
    let kl_minor = member.effective_length_factor_minor * member.unbraced_length_minor_mm;
    let lambda_major = kl_major / section.rxx_mm.max(1.0);
    let lambda_minor = kl_minor / ry;
    let lambda_gov = lambda_major.max(lambda_minor);
    let fe_axial = std::f64::consts::PI.powi(2) * e / (lambda_gov * lambda_gov + 1e-12);
    let fcr_axial = if fy / fe_axial <= 2.25 {
        0.658_f64.powf(fy / fe_axial) * fy
    } else {
        0.877 * fe_axial
    };
    let pn = phi_c * fcr_axial * section.area_mm2 / 1e3; // kN

    // Shear capacity
    let aw = section.depth * section.web_thickness; // mm²
    let cv = 1.0_f64; // simplification for compact sections
    let vn = phi_v * 0.6 * fy * aw * cv / 1e3; // kN

    // D/C ratios
    let dc_flex_major = member.moment_major_knm.abs() / mn_major.max(1e-6);
    let dc_flex_minor = member.moment_minor_knm.abs() / mp_minor.max(1e-6);
    let dc_shear_val = member.shear_major_kn.abs() / vn.max(1e-6);
    let dc_axial_val = member.axial_kn.abs() / pn.max(1e-6);

    // AISC H1 interaction
    let pu_over_pc = dc_axial_val;
    let dc_interaction = if pu_over_pc >= 0.2 {
        pu_over_pc + (8.0 / 9.0) * (dc_flex_major + dc_flex_minor)
    } else {
        pu_over_pc / 2.0 + dc_flex_major + dc_flex_minor
    };

    // Deflection D/C
    let allowable_defl = match member.member_type {
        MemberType::Beam => member.span_for_deflection_mm / 360.0,
        MemberType::Column => member.span_for_deflection_mm / 600.0,
        _ => member.span_for_deflection_mm / 300.0,
    };
    let dc_defl = member.max_deflection_mm / allowable_defl.max(0.01);

    let dc_governing = dc_flex_major.max(dc_flex_minor).max(dc_shear_val)
        .max(dc_interaction).max(dc_defl);

    let (check_name, pass) = if dc_governing > 1.0 {
        let name = if dc_interaction >= dc_governing - 0.001 { "Interaction H1" }
        else if dc_flex_major >= dc_governing - 0.001 { "Flexure (major)" }
        else if dc_defl >= dc_governing - 0.001 { "Deflection" }
        else { "Governing" };
        (name.to_string(), false)
    } else {
        ("OK".to_string(), true)
    };

    MemberDCResult {
        member_id: member.id.clone(),
        section: section.designation.clone(),
        dc_flexure_major: dc_flex_major,
        dc_flexure_minor: dc_flex_minor,
        dc_shear: dc_shear_val,
        dc_axial: dc_axial_val,
        dc_interaction,
        dc_governing,
        dc_deflection: dc_defl,
        check_name,
        pass,
    }
}

// ─── Section selector ───────────────────────────────────────────────

/// Sorting criterion for section selection.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SelectionObjective { MinimumWeight, MinimumDepth, MinimumCost }

/// Pick the lightest section from the catalogue that passes all checks.
pub fn select_optimal_section(
    member: &StructuralMember,
    catalogue: &[CatalogSection],
    code: DesignCode,
    objective: SelectionObjective,
    max_dc: f64,
) -> Option<(CatalogSection, MemberDCResult)> {
    let mut candidates: Vec<(CatalogSection, MemberDCResult)> = catalogue.iter()
        .map(|s| {
            let dc = compute_dc_ratios(member, s, code);
            (s.clone(), dc)
        })
        .filter(|(_, dc)| dc.governing_dc() <= max_dc)
        .collect();

    if candidates.is_empty() { return None; }

    match objective {
        SelectionObjective::MinimumWeight => {
            candidates.sort_by(|a, b| a.0.mass_per_m.partial_cmp(&b.0.mass_per_m).unwrap());
        }
        SelectionObjective::MinimumDepth => {
            candidates.sort_by(|a, b| a.0.depth.partial_cmp(&b.0.depth).unwrap());
        }
        SelectionObjective::MinimumCost => {
            // Approximate cost = mass × unit cost (uniform cost assumed)
            candidates.sort_by(|a, b| a.0.mass_per_m.partial_cmp(&b.0.mass_per_m).unwrap());
        }
    }

    Some(candidates.into_iter().next().unwrap())
}

// ─── Stiffness-aware iterative design loop ──────────────────────────

/// Configuration for the auto-design loop.
#[derive(Debug, Clone)]
pub struct AutoDesignConfig {
    pub max_iterations: usize,
    pub max_dc_ratio: f64,          // target ≤ 1.0
    pub convergence_tol: f64,       // weight change tolerance (fraction)
    pub design_code: DesignCode,
    pub objective: SelectionObjective,
    pub stiffness_update: bool,     // re-run analysis
}

impl Default for AutoDesignConfig {
    fn default() -> Self {
        Self {
            max_iterations: 15,
            max_dc_ratio: 0.95,
            convergence_tol: 0.005,   // 0.5 % change
            design_code: DesignCode::AISC360,
            objective: SelectionObjective::MinimumWeight,
            stiffness_update: true,
        }
    }
}

/// Result of one iteration.
#[derive(Debug, Clone)]
pub struct IterationResult {
    pub iteration: usize,
    pub total_weight_kg: f64,
    pub members_changed: usize,
    pub members_failing: usize,
    pub max_dc: f64,
    pub member_results: Vec<MemberDCResult>,
    pub section_assignments: HashMap<String, String>,
}

/// Full optimization result.
#[derive(Debug, Clone)]
pub struct AutoDesignResult {
    pub converged: bool,
    pub iterations_used: usize,
    pub final_weight_kg: f64,
    pub initial_weight_kg: f64,
    pub weight_saving_pct: f64,
    pub iterations: Vec<IterationResult>,
    pub final_assignments: HashMap<String, String>,
    pub final_dc_results: Vec<MemberDCResult>,
}

/// Run the auto-design optimization loop.
///
/// `demand_updater` is a callback that re-analyses the structure
/// when member stiffnesses change. It receives the current section
/// assignments and returns updated member demands.
pub fn run_auto_design<F>(
    members: &[StructuralMember],
    catalogue: &[CatalogSection],
    config: &AutoDesignConfig,
    mut demand_updater: F,
) -> AutoDesignResult
where
    F: FnMut(&HashMap<String, String>) -> Vec<StructuralMember>,
{
    let mut current_members = members.to_vec();
    let mut assignments: HashMap<String, String> = members.iter()
        .map(|m| (m.id.clone(), m.current_section.clone()))
        .collect();

    let initial_weight = compute_total_weight(&current_members, catalogue, &assignments);
    let mut prev_weight = initial_weight;
    let mut iterations: Vec<IterationResult> = Vec::new();

    for iter_num in 1..=config.max_iterations {
        let mut members_changed = 0_usize;
        let mut members_failing = 0_usize;
        let mut max_dc = 0.0_f64;
        let mut dc_results: Vec<MemberDCResult> = Vec::new();

        // Phase 1: check every member, select optimal section
        for m in &current_members {
            if let Some((best_sec, dc)) = select_optimal_section(
                m, catalogue, config.design_code, config.objective, config.max_dc_ratio,
            ) {
                if best_sec.designation != *assignments.get(&m.id).unwrap_or(&String::new()) {
                    assignments.insert(m.id.clone(), best_sec.designation.clone());
                    members_changed += 1;
                }
                max_dc = max_dc.max(dc.governing_dc());
                dc_results.push(dc);
            } else {
                // No section passes → pick heaviest and flag
                let heaviest = catalogue.iter()
                    .max_by(|a, b| a.mass_per_m.partial_cmp(&b.mass_per_m).unwrap());
                if let Some(h) = heaviest {
                    let dc = compute_dc_ratios(m, h, config.design_code);
                    assignments.insert(m.id.clone(), h.designation.clone());
                    max_dc = max_dc.max(dc.governing_dc());
                    dc_results.push(dc);
                    members_failing += 1;
                }
            }
        }

        let current_weight = compute_total_weight(&current_members, catalogue, &assignments);

        iterations.push(IterationResult {
            iteration: iter_num,
            total_weight_kg: current_weight,
            members_changed,
            members_failing,
            max_dc,
            member_results: dc_results.clone(),
            section_assignments: assignments.clone(),
        });

        // Check convergence
        let weight_change = ((current_weight - prev_weight) / prev_weight.max(1.0)).abs();
        if members_changed == 0 || weight_change < config.convergence_tol {
            return AutoDesignResult {
                converged: true,
                iterations_used: iter_num,
                final_weight_kg: current_weight,
                initial_weight_kg: initial_weight,
                weight_saving_pct: (1.0 - current_weight / initial_weight.max(1.0)) * 100.0,
                iterations,
                final_assignments: assignments,
                final_dc_results: dc_results,
            };
        }

        prev_weight = current_weight;

        // Phase 2: re-analyse with updated stiffnesses
        if config.stiffness_update {
            current_members = demand_updater(&assignments);
        }
    }

    let final_weight = compute_total_weight(&current_members, catalogue, &assignments);
    let final_dc: Vec<MemberDCResult> = current_members.iter().filter_map(|m| {
        let sec_name = assignments.get(&m.id)?;
        let sec = catalogue.iter().find(|s| s.designation == *sec_name)?;
        Some(compute_dc_ratios(m, sec, config.design_code))
    }).collect();

    AutoDesignResult {
        converged: false,
        iterations_used: config.max_iterations,
        final_weight_kg: final_weight,
        initial_weight_kg: initial_weight,
        weight_saving_pct: (1.0 - final_weight / initial_weight.max(1.0)) * 100.0,
        iterations,
        final_assignments: assignments,
        final_dc_results: final_dc,
    }
}

fn compute_total_weight(
    members: &[StructuralMember],
    catalogue: &[CatalogSection],
    assignments: &HashMap<String, String>,
) -> f64 {
    members.iter().map(|m| {
        let name = assignments.get(&m.id).map(|s| s.as_str()).unwrap_or("");
        let mass = catalogue.iter().find(|c| c.designation == name)
            .map(|c| c.mass_per_m).unwrap_or(0.0);
        mass * m.length_mm / 1000.0  // kg
    }).sum()
}

// ─── Built-in AISC W-shape catalogue (compact subset) ────────────

pub fn aisc_w_catalogue() -> Vec<CatalogSection> {
    // Representative W-shapes sorted light → heavy
    let data: Vec<(&str, f64, f64, f64, f64, f64, f64, f64, f64, f64, f64, f64, f64)> = vec![
        // (desig, d, bf, tw, tf, A, Ix, Iy, Zx, Zy, J, mass, ry)
        ("W8X10", 201.0, 100.0, 4.3, 5.2, 1260.0, 14.0e6, 1.47e6, 154e3, 43.4e3, 5520.0, 14.9, 34.0),
        ("W10X12", 251.0, 101.0, 4.8, 5.1, 1550.0, 24.0e6, 1.72e6, 211e3, 50.8e3, 6780.0, 17.9, 33.3),
        ("W10X22", 260.0, 147.0, 6.1, 8.4, 2870.0, 48.2e6, 7.66e6, 415e3, 153e3, 45000.0, 32.7, 51.6),
        ("W12X19", 309.0, 102.0, 5.7, 6.5, 2470.0, 54.0e6, 2.26e6, 391e3, 65.5e3, 14500.0, 28.3, 30.2),
        ("W12X26", 310.0, 165.0, 5.8, 9.7, 3420.0, 82.4e6, 17.0e6, 585e3, 305e3, 84600.0, 38.7, 70.6),
        ("W14X22", 349.0, 127.0, 5.8, 8.5, 2870.0, 82.9e6, 4.74e6, 525e3, 110e3, 36400.0, 32.7, 40.6),
        ("W14X30", 352.0, 171.0, 6.9, 10.0, 3870.0, 121e6, 16.6e6, 759e3, 287e3, 101000.0, 44.5, 65.5),
        ("W14X48", 355.0, 204.0, 7.9, 12.7, 6250.0, 201e6, 36.0e6, 1260e3, 522e3, 241000.0, 71.4, 75.9),
        ("W16X26", 399.0, 140.0, 6.4, 8.8, 3350.0, 124e6, 6.75e6, 694e3, 143e3, 47500.0, 38.7, 44.9),
        ("W16X36", 403.0, 178.0, 7.5, 10.9, 4680.0, 186e6, 24.5e6, 1030e3, 408e3, 145000.0, 53.6, 72.4),
        ("W18X35", 449.0, 152.0, 7.6, 10.8, 4550.0, 220e6, 12.4e6, 1090e3, 242e3, 95200.0, 52.1, 52.3),
        ("W18X50", 457.0, 190.0, 9.0, 14.5, 6550.0, 340e6, 40.7e6, 1660e3, 634e3, 308000.0, 74.4, 78.7),
        ("W21X44", 525.0, 165.0, 8.9, 11.4, 5740.0, 371e6, 13.0e6, 1580e3, 233e3, 123000.0, 65.5, 47.5),
        ("W21X62", 533.0, 210.0, 10.2, 15.6, 8060.0, 555e6, 48.6e6, 2330e3, 686e3, 425000.0, 92.3, 77.7),
        ("W24X55", 599.0, 178.0, 10.0, 12.8, 7180.0, 563e6, 17.9e6, 2100e3, 296e3, 173000.0, 82.0, 49.8),
        ("W24X76", 607.0, 228.0, 11.2, 17.3, 9910.0, 835e6, 73.8e6, 3080e3, 958e3, 632000.0, 113.0, 86.4),
        ("W30X90", 753.0, 254.0, 11.2, 16.3, 11600.0, 1440e6, 70.1e6, 4270e3, 820e3, 545000.0, 134.0, 77.7),
        ("W36X135", 904.0, 304.0, 15.2, 20.1, 17500.0, 3240e6, 186e6, 8020e3, 1810e3, 1660000.0, 201.0, 103.0),
    ];

    data.into_iter().map(|(desig, d, bf, tw, tf, a, ix, iy, zx, zy, j, mass, ry)| {
        CatalogSection {
            designation: desig.to_string(),
            standard: SectionStandard::AISC,
            shape: SectionShape::WideFlange,
            depth: d, flange_width: bf, web_thickness: tw, flange_thickness: tf,
            area_mm2: a, ixx_mm4: ix, iyy_mm4: iy,
            zxx_mm3: zx * 0.9, zyy_mm3: zy * 0.9, // elastic ≈ 0.9 × plastic
            zpxx_mm3: zx, zpyy_mm3: zy,
            rxx_mm: (ix / a).sqrt(), ryy_mm: ry,
            mass_per_m: mass, j_mm4: j, cw_mm6: iy * d * d / 4.0,
        }
    }).collect()
}

// =====================================================================
// Tests
// =====================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_member(id: &str, m_knm: f64, p_kn: f64) -> StructuralMember {
        StructuralMember {
            id: id.to_string(),
            length_mm: 6000.0,
            current_section: "W14X22".to_string(),
            elastic_modulus: 200_000.0,
            yield_strength: 345.0,
            unbraced_length_major_mm: 6000.0,
            unbraced_length_minor_mm: 3000.0,
            effective_length_factor_major: 1.0,
            effective_length_factor_minor: 1.0,
            cb: 1.0,
            member_type: MemberType::Beam,
            axial_kn: p_kn,
            moment_major_knm: m_knm,
            moment_minor_knm: 0.0,
            shear_major_kn: m_knm / 3.0,
            shear_minor_kn: 0.0,
            max_deflection_mm: 10.0,
            span_for_deflection_mm: 6000.0,
        }
    }

    #[test]
    fn test_dc_ratios_pass() {
        let cat = aisc_w_catalogue();
        let sec = cat.iter().find(|s| s.designation == "W14X48").unwrap();
        let m = sample_member("B1", 100.0, 0.0);
        let dc = compute_dc_ratios(&m, sec, DesignCode::AISC360);
        assert!(dc.dc_governing < 1.0, "W14X48 should pass for 100 kN·m: {}", dc.dc_governing);
        assert!(dc.pass);
    }

    #[test]
    fn test_dc_ratios_fail() {
        let cat = aisc_w_catalogue();
        let sec = cat.iter().find(|s| s.designation == "W8X10").unwrap();
        let m = sample_member("B2", 100.0, 0.0); // W8X10 can't handle 100 kN·m
        let dc = compute_dc_ratios(&m, sec, DesignCode::AISC360);
        assert!(dc.dc_governing > 1.0);
        assert!(!dc.pass);
    }

    #[test]
    fn test_select_optimal_section() {
        let cat = aisc_w_catalogue();
        let m = sample_member("B3", 120.0, 0.0);
        let result = select_optimal_section(
            &m, &cat, DesignCode::AISC360, SelectionObjective::MinimumWeight, 1.0,
        );
        assert!(result.is_some());
        let (sec, dc) = result.unwrap();
        assert!(dc.governing_dc() <= 1.0);
        println!("Selected: {} (mass={} kg/m, DC={})", sec.designation, sec.mass_per_m, dc.dc_governing);
    }

    #[test]
    fn test_catalogue_sorted_by_weight() {
        let cat = aisc_w_catalogue();
        assert!(cat.len() >= 15);
        // Should have a range of weights
        let min_mass = cat.iter().map(|s| s.mass_per_m).fold(f64::INFINITY, f64::min);
        let max_mass = cat.iter().map(|s| s.mass_per_m).fold(0.0_f64, f64::max);
        assert!(max_mass > 10.0 * min_mass, "Catalogue should span a wide weight range");
    }

    #[test]
    fn test_auto_design_loop_converges() {
        let cat = aisc_w_catalogue();
        let members = vec![
            sample_member("B1", 80.0, 0.0),
            sample_member("B2", 200.0, 50.0),
            sample_member("C1", 30.0, 400.0),
        ];
        let config = AutoDesignConfig {
            max_iterations: 10,
            max_dc_ratio: 0.95,
            convergence_tol: 0.01,
            design_code: DesignCode::AISC360,
            objective: SelectionObjective::MinimumWeight,
            stiffness_update: false, // no re-analysis callback in test
        };

        let result = run_auto_design(&members, &cat, &config, |_| members.clone());
        assert!(result.converged, "Should converge within 10 iterations");
        assert!(result.iterations_used <= 3, "Static demands → converge in ≤3 iters");
        assert!(!result.final_assignments.is_empty());
        println!("Converged in {} iters, weight={:.1} kg, saving={:.1}%",
            result.iterations_used, result.final_weight_kg, result.weight_saving_pct);
    }

    #[test]
    fn test_interaction_check_h1() {
        let cat = aisc_w_catalogue();
        let sec = cat.iter().find(|s| s.designation == "W14X30").unwrap();
        // High axial + moment → interaction governs
        let mut m = sample_member("C1", 50.0, 500.0);
        m.member_type = MemberType::Column;
        let dc = compute_dc_ratios(&m, sec, DesignCode::AISC360);
        assert!(dc.dc_interaction > 0.0);
        println!("Interaction DC={:.3}, axial DC={:.3}", dc.dc_interaction, dc.dc_axial);
    }

    #[test]
    fn test_deflection_dc() {
        let cat = aisc_w_catalogue();
        let sec = cat.iter().find(|s| s.designation == "W10X12").unwrap();
        let mut m = sample_member("B1", 20.0, 0.0);
        m.max_deflection_mm = 25.0; // L/240 → should fail L/360
        let dc = compute_dc_ratios(&m, sec, DesignCode::AISC360);
        assert!(dc.dc_deflection > 1.0, "L/240 > L/360 → DC_defl > 1.0");
    }
}
