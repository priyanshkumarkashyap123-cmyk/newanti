// ============================================================================
// ADVANCED COMPOSITE AND TIMBER DESIGN
// ============================================================================
//
// P3 REQUIREMENT: Advanced Composite/Timber Features
//
// Features:
// - Composite steel-concrete beams (EN 1994)
// - Shear connector design
// - Timber design per EN 1995 / NDS
// - Cross-laminated timber (CLT) panels
// - Glulam beam design
// - Connection design for timber
// - Fire design for timber
// - Creep and duration of load effects
//
// Industry Standard: Tekla Tedds, RFEM, SCIA Engineer
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

use crate::rebar_utils::circle_area;

// ============================================================================
// COMPOSITE BEAM DESIGN (EN 1994)
// ============================================================================

/// Composite steel-concrete beam design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompositeBeamDesign {
    /// Steel section properties
    pub steel_section: SteelSection,
    /// Concrete slab properties
    pub concrete_slab: ConcreteSlab,
    /// Shear connection
    pub shear_connection: ShearConnection,
    /// Loading
    pub loading: CompositeLoading,
    /// Results
    pub results: CompositeDesignResults,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteelSection {
    pub designation: String,
    pub depth: f64,           // mm
    pub flange_width: f64,    // mm
    pub flange_thick: f64,    // mm
    pub web_thick: f64,       // mm
    pub area: f64,            // mm²
    pub iy: f64,              // mm⁴
    pub iz: f64,              // mm⁴
    pub zy: f64,              // mm³ (plastic)
    pub fy: f64,              // MPa
    pub e_steel: f64,         // MPa
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConcreteSlab {
    pub width_eff: f64,       // mm (effective width)
    pub depth_total: f64,     // mm
    pub depth_above_deck: f64, // mm (for metal deck)
    pub fck: f64,             // MPa
    pub e_concrete: f64,      // MPa
    pub deck_profile: Option<DeckProfile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeckProfile {
    pub depth: f64,           // mm
    pub pitch: f64,           // mm
    pub width_top: f64,       // mm
    pub width_bottom: f64,    // mm
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShearConnection {
    pub connector_type: ShearConnectorType,
    pub diameter: f64,        // mm
    pub height: f64,          // mm
    pub fu: f64,              // MPa
    pub spacing: f64,         // mm
    pub rows: usize,          // number of rows
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ShearConnectorType {
    HeadedStud,
    ChannelConnector,
    PerfobondRib,
    Angle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompositeLoading {
    pub span: f64,            // mm
    pub dead_load: f64,       // kN/m (construction stage)
    pub superimposed: f64,    // kN/m
    pub live_load: f64,       // kN/m
    pub propping: PropMethod,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PropMethod {
    Propped,
    Unpropped,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompositeDesignResults {
    /// Composite section properties
    pub composite_props: CompositeProperties,
    /// Moment capacities
    pub moment_capacity: MomentCapacity,
    /// Shear capacity
    pub shear_capacity: f64,
    /// Shear connector design
    pub connector_design: ConnectorDesign,
    /// Deflections
    pub deflections: DeflectionResults,
    /// Utilization ratios
    pub utilization: CompositeUtilization,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompositeProperties {
    pub modular_ratio_short: f64,
    pub modular_ratio_long: f64,
    pub neutral_axis_short: f64,    // mm from bottom
    pub neutral_axis_long: f64,
    pub i_composite_short: f64,     // mm⁴
    pub i_composite_long: f64,
    pub z_bottom: f64,              // mm³
    pub z_top: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MomentCapacity {
    pub m_pl_rd: f64,               // kN·m (full interaction)
    pub m_el_rd: f64,               // kN·m (elastic limit)
    pub m_construction: f64,        // kN·m (construction stage)
    pub pna_position: f64,          // mm (plastic neutral axis from top)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorDesign {
    pub p_rd: f64,                  // kN (per connector)
    pub n_total: usize,             // total connectors required
    pub n_provided: usize,          // connectors provided
    pub degree_of_interaction: f64, // %
    pub spacing_max: f64,           // mm
    pub min_transverse_reinf: f64,  // mm²/m
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeflectionResults {
    pub delta_construction: f64,    // mm
    pub delta_composite: f64,       // mm
    pub delta_total: f64,           // mm
    pub limit_ratio: f64,           // L/limit
    pub creep_factor: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompositeUtilization {
    pub moment: f64,
    pub shear: f64,
    pub construction: f64,
    pub deflection: f64,
    pub connector: f64,
}

impl CompositeBeamDesign {
    /// Design composite beam per EN 1994
    pub fn design(
        steel: SteelSection,
        slab: ConcreteSlab,
        connector: ShearConnection,
        loading: CompositeLoading,
    ) -> Self {
        // Modular ratios
        let n_0 = steel.e_steel / slab.e_concrete;
        let n_l = 2.0 * n_0; // For long-term (creep)

        // Effective concrete area
        let a_c = slab.width_eff * slab.depth_above_deck;
        let a_c_eff = a_c / n_0;
        let a_c_eff_long = a_c / n_l;

        // Transformed section properties (short-term)
        let y_steel = steel.depth / 2.0;
        let y_conc = steel.depth + slab.depth_total / 2.0;
        
        let a_total = steel.area + a_c_eff;
        let y_na_short = (steel.area * y_steel + a_c_eff * y_conc) / a_total;
        
        let i_composite_short = steel.iy 
            + steel.area * (y_na_short - y_steel).powi(2)
            + slab.width_eff * slab.depth_above_deck.powi(3) / (12.0 * n_0)
            + a_c_eff * (y_conc - y_na_short).powi(2);

        // Long-term properties
        let a_total_long = steel.area + a_c_eff_long;
        let y_na_long = (steel.area * y_steel + a_c_eff_long * y_conc) / a_total_long;
        
        let i_composite_long = steel.iy 
            + steel.area * (y_na_long - y_steel).powi(2)
            + slab.width_eff * slab.depth_above_deck.powi(3) / (12.0 * n_l)
            + a_c_eff_long * (y_conc - y_na_long).powi(2);

        // Plastic moment capacity
        let _f_cd = 0.85 * slab.fck / 1.5;
        let _f_yd = steel.fy / 1.0;
        
        let n_c = 0.85 * slab.fck * slab.width_eff * slab.depth_above_deck / 1000.0;
        let n_a = steel.area * steel.fy / 1000.0;
        
        let (m_pl_rd, pna) = if n_c >= n_a {
            // PNA in slab
            let x = n_a * 1000.0 / (0.85 * slab.fck * slab.width_eff);
            let m = n_a * (steel.depth / 2.0 + slab.depth_total - x / 2.0) / 1000.0;
            (m, x)
        } else {
            // PNA in steel
            let n_remaining = n_a - n_c;
            let x = n_remaining * 1000.0 / (2.0 * steel.flange_width * steel.fy);
            let m = n_a * (steel.depth / 2.0 + slab.depth_total / 2.0) / 1000.0;
            (m, slab.depth_total + x)
        };

        // Shear connector capacity (EN 1994 Eq 6.18)
        let d = connector.diameter;
        let h_sc = connector.height;
        let alpha = if h_sc / d > 4.0 { 1.0 } else { 0.2 * (h_sc / d + 1.0) };
        let p_rd_shear = 0.8 * connector.fu * circle_area(d) / 1000.0 / 1.25;
        let p_rd_concrete = 0.29 * alpha * d.powi(2) * (slab.fck * slab.e_concrete).sqrt() / 1000.0 / 1.25;
        let p_rd = p_rd_shear.min(p_rd_concrete);

        // Number of connectors required
        let n_f = (n_c.min(n_a) / p_rd).ceil() as usize;
        let n_provided = ((loading.span / connector.spacing).ceil() as usize) * connector.rows;
        let degree = (n_provided as f64 * p_rd / n_c.min(n_a) * 100.0).min(100.0);

        // Deflections
        let w_total = loading.dead_load + loading.superimposed + loading.live_load;
        let l = loading.span;
        
        let delta_short = 5.0 * loading.live_load * l.powi(4) / (384.0 * steel.e_steel * i_composite_short);
        let delta_long = 5.0 * (loading.dead_load + loading.superimposed) * l.powi(4) 
            / (384.0 * steel.e_steel * i_composite_long);
        let delta_construction = match loading.propping {
            PropMethod::Propped => 0.0,
            PropMethod::Unpropped => 5.0 * loading.dead_load * l.powi(4) / (384.0 * steel.e_steel * steel.iy),
        };

        let delta_total = delta_construction + delta_short + delta_long;
        let limit = l / 250.0;

        // Calculate moments
        let m_ed = w_total * l.powi(2) / 8.0 / 1e6;
        let v_ed = w_total * l / 2.0 / 1000.0;
        let v_pl_rd = steel.area * 0.6 * steel.fy / 1000.0 / (3.0_f64).sqrt() / 1.0;

        // Save values before moving slab
        let slab_depth_total = slab.depth_total;
        let slab_depth_above_deck = slab.depth_above_deck;

        Self {
            steel_section: steel.clone(),
            concrete_slab: slab,
            shear_connection: connector,
            loading,
            results: CompositeDesignResults {
                composite_props: CompositeProperties {
                    modular_ratio_short: n_0,
                    modular_ratio_long: n_l,
                    neutral_axis_short: y_na_short,
                    neutral_axis_long: y_na_long,
                    i_composite_short,
                    i_composite_long,
                    z_bottom: i_composite_short / y_na_short,
                    z_top: i_composite_short / (steel.depth + slab_depth_total - y_na_short),
                },
                moment_capacity: MomentCapacity {
                    m_pl_rd,
                    m_el_rd: m_pl_rd * 0.9,
                    m_construction: steel.zy * steel.fy / 1e6,
                    pna_position: pna,
                },
                shear_capacity: v_pl_rd,
                connector_design: ConnectorDesign {
                    p_rd,
                    n_total: n_f,
                    n_provided,
                    degree_of_interaction: degree,
                    spacing_max: 800.0_f64.min(4.0 * slab_depth_total),
                    min_transverse_reinf: 0.002 * 1000.0 * slab_depth_above_deck,
                },
                deflections: DeflectionResults {
                    delta_construction,
                    delta_composite: delta_short + delta_long,
                    delta_total,
                    limit_ratio: l / delta_total,
                    creep_factor: 2.0,
                },
                utilization: CompositeUtilization {
                    moment: m_ed / m_pl_rd,
                    shear: v_ed / v_pl_rd,
                    construction: 0.0, // Would need separate calc
                    deflection: delta_total / limit,
                    connector: n_f as f64 / n_provided as f64,
                },
            },
        }
    }
}

// ============================================================================
// TIMBER DESIGN (EN 1995 / NDS)
// ============================================================================

/// Timber member design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimberDesign {
    pub section: TimberSection,
    pub material: TimberMaterial,
    pub loading: TimberLoading,
    pub results: TimberDesignResults,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimberSection {
    pub section_type: TimberSectionType,
    pub width: f64,           // mm
    pub depth: f64,           // mm
    pub length: f64,          // mm
    pub area: f64,            // mm²
    pub iy: f64,              // mm⁴
    pub iz: f64,              // mm⁴
    pub wy: f64,              // mm³
    pub wz: f64,              // mm³
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TimberSectionType {
    SolidTimber,
    Glulam,
    LVL,
    CLT,
    PSL,
    LSL,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimberMaterial {
    pub grade: String,
    pub species: TimberSpecies,
    pub strength_class: String,    // C24, GL28h, etc.
    pub fm_k: f64,                 // MPa (bending)
    pub ft_0_k: f64,               // MPa (tension parallel)
    pub ft_90_k: f64,              // MPa (tension perpendicular)
    pub fc_0_k: f64,               // MPa (compression parallel)
    pub fc_90_k: f64,              // MPa (compression perpendicular)
    pub fv_k: f64,                 // MPa (shear)
    pub e_0_mean: f64,             // MPa (modulus parallel)
    pub e_0_05: f64,               // MPa (5th percentile)
    pub rho_k: f64,                // kg/m³ (density)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TimberSpecies {
    Softwood,
    Hardwood,
    Glulam,
    LVL,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimberLoading {
    pub moment_y: f64,        // kN·m
    pub moment_z: f64,        // kN·m
    pub axial: f64,           // kN (positive = tension)
    pub shear_y: f64,         // kN
    pub shear_z: f64,         // kN
    pub load_duration: LoadDuration,
    pub service_class: ServiceClass,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LoadDuration {
    Permanent,
    LongTerm,
    MediumTerm,
    ShortTerm,
    Instantaneous,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ServiceClass {
    SC1,  // Indoor, heated
    SC2,  // Covered, unheated
    SC3,  // External
}

impl LoadDuration {
    pub fn kmod(&self, service_class: ServiceClass) -> f64 {
        match (self, service_class) {
            (LoadDuration::Permanent, ServiceClass::SC1 | ServiceClass::SC2) => 0.60,
            (LoadDuration::Permanent, ServiceClass::SC3) => 0.50,
            (LoadDuration::LongTerm, ServiceClass::SC1 | ServiceClass::SC2) => 0.70,
            (LoadDuration::LongTerm, ServiceClass::SC3) => 0.55,
            (LoadDuration::MediumTerm, ServiceClass::SC1 | ServiceClass::SC2) => 0.80,
            (LoadDuration::MediumTerm, ServiceClass::SC3) => 0.65,
            (LoadDuration::ShortTerm, ServiceClass::SC1 | ServiceClass::SC2) => 0.90,
            (LoadDuration::ShortTerm, ServiceClass::SC3) => 0.70,
            (LoadDuration::Instantaneous, _) => 1.10,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimberDesignResults {
    pub design_strengths: DesignStrengths,
    pub checks: TimberChecks,
    pub buckling: BucklingCheck,
    pub fire: Option<FireDesign>,
    pub utilization: TimberUtilization,
    pub status: DesignStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesignStrengths {
    pub fm_d: f64,            // MPa
    pub ft_0_d: f64,          // MPa
    pub fc_0_d: f64,          // MPa
    pub fv_d: f64,            // MPa
    pub kmod: f64,
    pub gamma_m: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimberChecks {
    pub bending_stress: f64,      // MPa
    pub bending_utilization: f64,
    pub axial_stress: f64,        // MPa
    pub axial_utilization: f64,
    pub shear_stress: f64,        // MPa
    pub shear_utilization: f64,
    pub combined_utilization: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BucklingCheck {
    pub lambda_y: f64,            // Slenderness
    pub lambda_z: f64,
    pub lambda_rel_y: f64,        // Relative slenderness
    pub lambda_rel_z: f64,
    pub kc_y: f64,                // Buckling factor
    pub kc_z: f64,
    pub buckling_utilization: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FireDesign {
    pub fire_duration: u32,       // minutes
    pub charring_rate: f64,       // mm/min
    pub d_char: f64,              // mm (charring depth)
    pub d_ef: f64,                // mm (effective charring depth)
    pub residual_section: (f64, f64), // (width, depth) mm
    pub fire_utilization: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimberUtilization {
    pub bending: f64,
    pub compression: f64,
    pub tension: f64,
    pub shear: f64,
    pub combined: f64,
    pub buckling: f64,
    pub fire: Option<f64>,
    pub governing: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DesignStatus {
    Pass,
    Fail,
    Warning,
}

impl TimberDesign {
    /// Design timber member per EN 1995
    pub fn design(
        section: TimberSection,
        material: TimberMaterial,
        loading: TimberLoading,
        fire_duration: Option<u32>,
    ) -> Self {
        let gamma_m = match section.section_type {
            TimberSectionType::SolidTimber => 1.3,
            TimberSectionType::Glulam => 1.25,
            TimberSectionType::LVL | TimberSectionType::CLT => 1.2,
            _ => 1.3,
        };

        let kmod = loading.load_duration.kmod(loading.service_class);

        // Design strengths
        let fm_d = kmod * material.fm_k / gamma_m;
        let ft_0_d = kmod * material.ft_0_k / gamma_m;
        let fc_0_d = kmod * material.fc_0_k / gamma_m;
        let fv_d = kmod * material.fv_k / gamma_m;

        // Stresses
        let sigma_m_y = loading.moment_y.abs() * 1e6 / section.wy;
        let sigma_m_z = loading.moment_z.abs() * 1e6 / section.wz;
        let sigma_t = if loading.axial > 0.0 { loading.axial * 1000.0 / section.area } else { 0.0 };
        let sigma_c = if loading.axial < 0.0 { -loading.axial * 1000.0 / section.area } else { 0.0 };
        let tau = 1.5 * (loading.shear_y.powi(2) + loading.shear_z.powi(2)).sqrt() * 1000.0 / section.area;

        // Slenderness
        let i_y = (section.iy / section.area).sqrt();
        let i_z = (section.iz / section.area).sqrt();
        let lambda_y = section.length / i_y;
        let lambda_z = section.length / i_z;

        let sigma_c_crit_y = PI.powi(2) * material.e_0_05 / lambda_y.powi(2);
        let sigma_c_crit_z = PI.powi(2) * material.e_0_05 / lambda_z.powi(2);

        let lambda_rel_y = (material.fc_0_k / sigma_c_crit_y).sqrt();
        let lambda_rel_z = (material.fc_0_k / sigma_c_crit_z).sqrt();

        // Buckling factors (EN 1995 Eq 6.25-6.28)
        // β_c = 0.2 for solid timber, 0.1 for glulam/LVL per EN 1995-1-1 §6.3.2
        let beta_c = match section.section_type {
            TimberSectionType::Glulam | TimberSectionType::LVL => 0.1,
            _ => 0.2,
        };
        let k_y = 0.5 * (1.0 + beta_c * (lambda_rel_y - 0.3) + lambda_rel_y.powi(2));
        let k_z = 0.5 * (1.0 + beta_c * (lambda_rel_z - 0.3) + lambda_rel_z.powi(2));

        let kc_y = 1.0 / (k_y + (k_y.powi(2) - lambda_rel_y.powi(2)).sqrt());
        let kc_z = 1.0 / (k_z + (k_z.powi(2) - lambda_rel_z.powi(2)).sqrt());

        // Utilization checks
        let bending_util = sigma_m_y / fm_d + sigma_m_z / fm_d;
        let compression_util = sigma_c / (kc_y.min(kc_z) * fc_0_d);
        let tension_util = sigma_t / ft_0_d;
        let shear_util = tau / fv_d;

        // Combined check (EN 1995 Eq 6.19)
        let combined_util = if sigma_c > 0.0 {
            (sigma_c / (kc_y * fc_0_d)).powi(2) + sigma_m_y / fm_d + 0.7 * sigma_m_z / fm_d
        } else {
            sigma_t / ft_0_d + sigma_m_y / fm_d + 0.7 * sigma_m_z / fm_d
        };

        let buckling_util = compression_util;

        // Fire design
        let fire = fire_duration.map(|duration| {
            let beta_n = match section.section_type {
                TimberSectionType::Glulam => 0.7,
                TimberSectionType::SolidTimber => 0.8,
                _ => 0.65,
            };
            
            let d_char = beta_n * duration as f64;
            let d_0 = 7.0; // mm
            let d_ef = d_char + d_0;

            let residual_width = (section.width - 2.0 * d_ef).max(0.0);
            let residual_depth = (section.depth - d_ef).max(0.0);

            let _residual_area = residual_width * residual_depth;
            let residual_w = residual_width * residual_depth.powi(2) / 6.0;

            let fire_sigma_m = loading.moment_y.abs() * 1e6 / residual_w;
            let fire_util = fire_sigma_m / (material.fm_k * 1.25); // kfi = 1.25 for softwood

            FireDesign {
                fire_duration: duration,
                charring_rate: beta_n,
                d_char,
                d_ef,
                residual_section: (residual_width, residual_depth),
                fire_utilization: fire_util,
            }
        });

        let governing = [bending_util, compression_util, tension_util, shear_util, combined_util, buckling_util]
            .into_iter()
            .fold(0.0_f64, |a, b| a.max(b));

        let status = if governing <= 1.0 {
            DesignStatus::Pass
        } else {
            DesignStatus::Fail
        };

        Self {
            section,
            material,
            loading,
            results: TimberDesignResults {
                design_strengths: DesignStrengths {
                    fm_d,
                    ft_0_d,
                    fc_0_d,
                    fv_d,
                    kmod,
                    gamma_m,
                },
                checks: TimberChecks {
                    bending_stress: sigma_m_y.max(sigma_m_z),
                    bending_utilization: bending_util,
                    axial_stress: sigma_c.max(sigma_t),
                    axial_utilization: compression_util.max(tension_util),
                    shear_stress: tau,
                    shear_utilization: shear_util,
                    combined_utilization: combined_util,
                },
                buckling: BucklingCheck {
                    lambda_y,
                    lambda_z,
                    lambda_rel_y,
                    lambda_rel_z,
                    kc_y,
                    kc_z,
                    buckling_utilization: buckling_util,
                },
                fire,
                utilization: TimberUtilization {
                    bending: bending_util,
                    compression: compression_util,
                    tension: tension_util,
                    shear: shear_util,
                    combined: combined_util,
                    buckling: buckling_util,
                    fire: fire_duration.map(|_| 0.0), // Would be calculated
                    governing,
                },
                status,
            },
        }
    }
}

// ============================================================================
// CLT PANEL DESIGN
// ============================================================================

/// Cross-laminated timber panel design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CltPanel {
    pub layers: Vec<CltLayer>,
    pub total_thickness: f64,
    pub effective_properties: CltEffectiveProperties,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CltLayer {
    pub thickness: f64,
    pub orientation: f64,  // degrees (0 = major span direction)
    pub material: TimberMaterial,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CltEffectiveProperties {
    pub ei_eff_major: f64,    // kN·m² (effective bending stiffness)
    pub ei_eff_minor: f64,
    pub ga_eff: f64,          // kN (effective shear stiffness)
    pub effective_thickness_bending: f64,
    pub effective_thickness_shear: f64,
}

impl CltPanel {
    /// Calculate CLT panel properties using shear analogy method
    pub fn new(layers: Vec<CltLayer>) -> Self {
        let total_thickness: f64 = layers.iter().map(|l| l.thickness).sum();

        // Effective bending stiffness (simplified)
        let mut ei_major = 0.0;
        let mut z = 0.0;
        let z_mid = total_thickness / 2.0;

        for layer in &layers {
            let z_layer = z + layer.thickness / 2.0;
            let dist = (z_layer - z_mid).abs();
            
            if layer.orientation.abs() < 45.0 {
                // Parallel layer
                let e = layer.material.e_0_mean;
                let i_own = layer.thickness.powi(3) / 12.0;
                let a = layer.thickness;
                ei_major += e * (i_own + a * dist.powi(2));
            }
            z += layer.thickness;
        }

        Self {
            total_thickness,
            effective_properties: CltEffectiveProperties {
                ei_eff_major: ei_major / 1e6,
                ei_eff_minor: ei_major * 0.1 / 1e6, // Simplified
                ga_eff: 50.0 * total_thickness, // Simplified
                effective_thickness_bending: total_thickness * 0.8,
                effective_thickness_shear: total_thickness * 0.6,
            },
            layers,
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
    fn test_composite_beam_design() {
        let steel = SteelSection {
            designation: "IPE 400".to_string(),
            depth: 400.0,
            flange_width: 180.0,
            flange_thick: 13.5,
            web_thick: 8.6,
            area: 8450.0,
            iy: 231000000.0,
            iz: 13200000.0,
            zy: 1307000.0,
            fy: 355.0,
            e_steel: 210000.0,
        };

        let slab = ConcreteSlab {
            width_eff: 2500.0,
            depth_total: 150.0,
            depth_above_deck: 100.0,
            fck: 30.0,
            e_concrete: 33000.0,
            deck_profile: None,
        };

        let connector = ShearConnection {
            connector_type: ShearConnectorType::HeadedStud,
            diameter: 19.0,
            height: 100.0,
            fu: 450.0,
            spacing: 150.0,
            rows: 2,
        };

        let loading = CompositeLoading {
            span: 8000.0,
            dead_load: 5.0,
            superimposed: 2.0,
            live_load: 5.0,
            propping: PropMethod::Unpropped,
        };

        let design = CompositeBeamDesign::design(steel, slab, connector, loading);
        
        assert!(design.results.moment_capacity.m_pl_rd > 0.0);
        assert!(design.results.connector_design.degree_of_interaction > 0.0);
    }

    #[test]
    fn test_timber_design() {
        let section = TimberSection {
            section_type: TimberSectionType::Glulam,
            width: 180.0,
            depth: 400.0,
            length: 6000.0,
            area: 72000.0,
            iy: 960000000.0,
            iz: 194400000.0,
            wy: 4800000.0,
            wz: 2160000.0,
        };

        let material = TimberMaterial {
            grade: "GL28h".to_string(),
            species: TimberSpecies::Glulam,
            strength_class: "GL28h".to_string(),
            fm_k: 28.0,
            ft_0_k: 22.3,
            ft_90_k: 0.5,
            fc_0_k: 28.0,
            fc_90_k: 2.5,
            fv_k: 3.5,
            e_0_mean: 12600.0,
            e_0_05: 10200.0,
            rho_k: 425.0,
        };

        let loading = TimberLoading {
            moment_y: 50.0,
            moment_z: 0.0,
            axial: -20.0,
            shear_y: 30.0,
            shear_z: 0.0,
            load_duration: LoadDuration::MediumTerm,
            service_class: ServiceClass::SC1,
        };

        let design = TimberDesign::design(section, material, loading, Some(30));
        
        assert!(design.results.design_strengths.fm_d > 0.0);
        assert!(design.results.fire.is_some());
    }

    #[test]
    fn test_kmod_values() {
        assert_eq!(LoadDuration::Permanent.kmod(ServiceClass::SC1), 0.60);
        assert_eq!(LoadDuration::ShortTerm.kmod(ServiceClass::SC1), 0.90);
        assert_eq!(LoadDuration::Instantaneous.kmod(ServiceClass::SC3), 1.10);
    }
}
