//! Ground Improvement Module
//! 
//! Implements ground improvement techniques per:
//! - FHWA Ground Improvement Methods
//! - Eurocode 7 (EN 1997)
//! - AASHTO LRFD Bridge Design
//! - Various industry guidelines

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// IMPROVEMENT METHOD TYPES
// ============================================================================

/// Ground improvement category
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ImprovementCategory {
    /// Densification methods
    Densification,
    /// Reinforcement methods
    Reinforcement,
    /// Drainage methods
    Drainage,
    /// Grouting methods
    Grouting,
    /// Stabilization methods
    Stabilization,
    /// Replacement methods
    Replacement,
}

/// Specific improvement method
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ImprovementMethod {
    // Densification
    /// Vibro-compaction (sand)
    VibroCompaction,
    /// Dynamic compaction
    DynamicCompaction,
    /// Compaction grouting
    CompactionGrouting,
    /// Rapid impact compaction
    RapidImpactCompaction,
    
    // Reinforcement
    /// Stone columns
    StoneColumns,
    /// Vibro-replacement
    VibroReplacement,
    /// Rigid inclusions
    RigidInclusions,
    /// Soil nails
    SoilNails,
    /// Micropiles
    Micropiles,
    
    // Drainage
    /// Prefabricated vertical drains (PVDs)
    VerticalDrains,
    /// Sand drains
    SandDrains,
    /// Vacuum preloading
    VacuumPreloading,
    /// Surcharge preloading
    SurchargePreloading,
    
    // Grouting
    /// Permeation grouting
    PermeationGrouting,
    /// Jet grouting
    JetGrouting,
    /// Deep soil mixing (wet)
    DeepSoilMixingWet,
    /// Deep soil mixing (dry)
    DeepSoilMixingDry,
    
    // Stabilization
    /// Lime stabilization
    LimeStabilization,
    /// Cement stabilization
    CementStabilization,
    /// Geosynthetic reinforcement
    GeosyntheticReinforcement,
}

impl ImprovementMethod {
    /// Get category
    pub fn category(&self) -> ImprovementCategory {
        match self {
            Self::VibroCompaction | Self::DynamicCompaction | 
            Self::CompactionGrouting | Self::RapidImpactCompaction => ImprovementCategory::Densification,
            
            Self::StoneColumns | Self::VibroReplacement |
            Self::RigidInclusions | Self::SoilNails | Self::Micropiles => ImprovementCategory::Reinforcement,
            
            Self::VerticalDrains | Self::SandDrains |
            Self::VacuumPreloading | Self::SurchargePreloading => ImprovementCategory::Drainage,
            
            Self::PermeationGrouting | Self::JetGrouting |
            Self::DeepSoilMixingWet | Self::DeepSoilMixingDry => ImprovementCategory::Grouting,
            
            Self::LimeStabilization | Self::CementStabilization |
            Self::GeosyntheticReinforcement => ImprovementCategory::Stabilization,
        }
    }
    
    /// Suitable soil types
    pub fn suitable_soils(&self) -> Vec<&'static str> {
        match self {
            Self::VibroCompaction => vec!["Clean sand", "Sand with <15% fines"],
            Self::DynamicCompaction => vec!["Granular soils", "Loose fills", "Collapsible soils"],
            Self::StoneColumns => vec!["Soft clay", "Silt", "Loose sand"],
            Self::JetGrouting => vec!["All soils", "Soft rock"],
            Self::DeepSoilMixingWet => vec!["Soft clay", "Organic soil", "Silt"],
            Self::VerticalDrains => vec!["Soft clay", "Compressible soil"],
            _ => vec!["Various soils"],
        }
    }
    
    /// Typical depth range (m)
    pub fn depth_range(&self) -> (f64, f64) {
        match self {
            Self::VibroCompaction => (3.0, 20.0),
            Self::DynamicCompaction => (2.0, 10.0),
            Self::StoneColumns => (3.0, 25.0),
            Self::JetGrouting => (3.0, 50.0),
            Self::DeepSoilMixingWet => (3.0, 40.0),
            Self::DeepSoilMixingDry => (3.0, 30.0),
            Self::VerticalDrains => (3.0, 40.0),
            Self::RigidInclusions => (3.0, 20.0),
            Self::Micropiles => (3.0, 30.0),
            Self::SoilNails => (3.0, 20.0),
            _ => (1.0, 15.0),
        }
    }
}

// ============================================================================
// STONE COLUMNS
// ============================================================================

/// Stone column parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoneColumnParams {
    /// Column diameter (m)
    pub diameter: f64,
    /// Column spacing (m)
    pub spacing: f64,
    /// Column length (m)
    pub length: f64,
    /// Stone friction angle (degrees)
    pub phi_stone: f64,
    /// Stone unit weight (kN/m³)
    pub gamma_stone: f64,
    /// Installation method
    pub method: StoneColumnMethod,
}

/// Stone column installation method
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum StoneColumnMethod {
    /// Vibro-replacement (wet)
    VibroReplacementWet,
    /// Vibro-replacement (dry)
    VibroReplacementDry,
    /// Vibro-displacement
    VibroDisplacement,
    /// Rammed aggregate pier
    RammedAggregate,
}

/// Stone column design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoneColumnDesign {
    /// Area replacement ratio
    pub area_ratio: f64,
    /// Stress concentration ratio
    pub stress_ratio: f64,
    /// Settlement improvement factor
    pub improvement_factor: f64,
    /// Ultimate column capacity (kN)
    pub ultimate_capacity: f64,
    /// Allowable column load (kN)
    pub allowable_load: f64,
    /// Composite friction angle (degrees)
    pub composite_phi: f64,
    /// Composite modulus (MPa)
    pub composite_modulus: f64,
}

impl StoneColumnDesign {
    /// Design stone columns per Priebe (1995)
    pub fn design_priebe(
        params: &StoneColumnParams,
        soil_phi: f64,
        soil_modulus: f64,
        stone_modulus: f64,
        surcharge: f64,
    ) -> Self {
        let d = params.diameter;
        let s = params.spacing;
        
        // Area replacement ratio (triangular pattern)
        let a_c = PI * d.powi(2) / 4.0;
        let a_u = s.powi(2) * 3.0_f64.sqrt() / 2.0;
        let area_ratio = a_c / a_u;
        
        // Stress concentration ratio (n)
        let phi_s = params.phi_stone * PI / 180.0;
        let phi_g = soil_phi * PI / 180.0;
        
        // Priebe basic improvement factor
        let kp_s = (PI / 4.0 + phi_s / 2.0).tan().powi(2);
        let n0 = 1.0 + area_ratio * (kp_s - 1.0);
        
        // Depth correction factor (simplified)
        let depth_factor = 1.0 + 0.1 * (params.length / d).sqrt();
        
        let improvement_factor = n0 * depth_factor;
        
        // Stress concentration ratio
        let modulus_ratio = stone_modulus / soil_modulus;
        let stress_ratio = 1.0 + (modulus_ratio - 1.0) * area_ratio / 
            (1.0 + (modulus_ratio - 1.0) * area_ratio * 0.5);
        
        // Ultimate capacity - bulging failure (Hughes & Withers 1974)
        let k0 = 1.0 - phi_g.sin(); // At-rest earth pressure coefficient
        let sigma_3 = k0 * surcharge; // Lateral confining stress
        let qu_bulging = sigma_3 * kp_s;
        let ultimate_capacity = qu_bulging * a_c; // kPa × m² = kN
        
        // Allowable load (FoS = 3)
        let allowable_load = ultimate_capacity / 3.0;
        
        // Composite properties
        let composite_phi = (area_ratio * phi_s.tan() + (1.0 - area_ratio) * phi_g.tan()).atan()
            * 180.0 / PI;
        let composite_modulus = area_ratio * stone_modulus + (1.0 - area_ratio) * soil_modulus;
        
        Self {
            area_ratio,
            stress_ratio,
            improvement_factor,
            ultimate_capacity,
            allowable_load,
            composite_phi,
            composite_modulus,
        }
    }
    
    /// Calculate settlement reduction
    pub fn settlement_reduction(&self, untreated_settlement: f64) -> f64 {
        untreated_settlement / self.improvement_factor
    }
    
    /// Check bearing capacity improvement
    pub fn improved_bearing_capacity(&self, untreated_qu: f64) -> f64 {
        // Composite bearing capacity weighted by area replacement ratio
        untreated_qu * (self.area_ratio * self.stress_ratio + (1.0 - self.area_ratio))
    }
}

// ============================================================================
// DYNAMIC COMPACTION
// ============================================================================

/// Dynamic compaction parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DynamicCompactionParams {
    /// Tamper weight (tonnes)
    pub tamper_weight: f64,
    /// Drop height (m)
    pub drop_height: f64,
    /// Grid spacing (m)
    pub grid_spacing: f64,
    /// Number of passes
    pub passes: usize,
    /// Drops per point per pass
    pub drops_per_point: usize,
}

/// Dynamic compaction design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DynamicCompactionDesign {
    /// Effective depth of improvement (m)
    pub effective_depth: f64,
    /// Energy per unit area (t·m/m²)
    pub applied_energy: f64,
    /// Crater depth (m)
    pub crater_depth: f64,
    /// Heave height (m)
    pub heave_height: f64,
    /// Pre-treatment SPT N-value
    pub pre_n_value: f64,
    /// Post-treatment SPT N-value (estimated)
    pub post_n_value: f64,
}

impl DynamicCompactionDesign {
    /// Design per Mayne et al. (1984)
    pub fn design(
        params: &DynamicCompactionParams,
        soil_type: &str,
        pre_n_value: f64,
        groundwater_depth: f64,
    ) -> Self {
        let w = params.tamper_weight;
        let h = params.drop_height;
        
        // Effective depth (Menard formula)
        // D = n * sqrt(W * H) where n = 0.3-0.7 depending on soil
        let n = match soil_type {
            "Pervious fill" | "Sand" => 0.5,
            "Silty sand" => 0.4,
            "Clay fill" | "Debris" => 0.35,
            _ => 0.4,
        };
        
        let effective_depth = n * (w * h).sqrt();
        
        // Limit by groundwater (typically 2m above GWT)
        let effective_depth = effective_depth.min(groundwater_depth - 2.0);
        
        // Applied energy
        let s = params.grid_spacing;
        let total_drops = params.passes * params.drops_per_point;
        let energy_per_drop = w * h; // t·m
        let applied_energy = total_drops as f64 * energy_per_drop / s.powi(2);
        
        // Crater depth (empirical)
        let crater_depth = 0.05 * (w * h).sqrt() * (total_drops as f64).sqrt();
        
        // Heave (typically 3-8% of crater volume)
        let heave_height = crater_depth * 0.05;
        
        // Post-treatment N-value (empirical correlation)
        let delta_n = 5.0 * (applied_energy / 100.0).ln().max(0.0);
        let post_n_value = (pre_n_value + delta_n).min(50.0);
        
        Self {
            effective_depth,
            applied_energy,
            crater_depth,
            heave_height,
            pre_n_value,
            post_n_value,
        }
    }
    
    /// Relative density improvement
    pub fn relative_density_improvement(&self) -> f64 {
        // Empirical: Dr ≈ 21 * sqrt(N) for sands
        let dr_pre = 21.0 * self.pre_n_value.sqrt();
        let dr_post = 21.0 * self.post_n_value.sqrt();
        
        dr_post - dr_pre
    }
    
    /// Check minimum energy requirement
    pub fn meets_energy_requirement(&self, required_energy: f64) -> bool {
        self.applied_energy >= required_energy
    }
}

// ============================================================================
// JET GROUTING
// ============================================================================

/// Jet grouting system
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum JetGroutingSystem {
    /// Single fluid (grout only)
    SingleFluid,
    /// Double fluid (grout + air)
    DoubleFluid,
    /// Triple fluid (water + air + grout)
    TripleFluid,
}

impl JetGroutingSystem {
    /// Typical column diameter range (m) by soil type
    pub fn diameter_range(&self, soil_type: &str) -> (f64, f64) {
        match (self, soil_type) {
            (Self::SingleFluid, "Clay") => (0.4, 0.6),
            (Self::SingleFluid, "Silt") => (0.5, 0.8),
            (Self::SingleFluid, "Sand") => (0.6, 1.0),
            (Self::DoubleFluid, "Clay") => (0.6, 1.0),
            (Self::DoubleFluid, "Silt") => (0.8, 1.2),
            (Self::DoubleFluid, "Sand") => (1.0, 1.5),
            (Self::TripleFluid, "Clay") => (0.8, 1.5),
            (Self::TripleFluid, "Silt") => (1.0, 2.0),
            (Self::TripleFluid, "Sand") => (1.5, 2.5),
            _ => (0.6, 1.2),
        }
    }
}

/// Jet grouting parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JetGroutingParams {
    /// Grouting system
    pub system: JetGroutingSystem,
    /// Column diameter (m)
    pub diameter: f64,
    /// Column spacing (m)
    pub spacing: f64,
    /// Treatment depth (m)
    pub depth: f64,
    /// Grout pressure (MPa)
    pub pressure: f64,
    /// Water-cement ratio
    pub w_c_ratio: f64,
    /// Rotation speed (rpm)
    pub rotation_speed: f64,
    /// Withdrawal rate (m/min)
    pub withdrawal_rate: f64,
}

/// Jet grouting design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JetGroutingDesign {
    /// Estimated column strength (MPa)
    pub column_strength: f64,
    /// Column modulus (MPa)
    pub column_modulus: f64,
    /// Grout volume per column (m³)
    pub grout_volume: f64,
    /// Cement consumption (kg/m)
    pub cement_per_meter: f64,
    /// Spoil volume (m³)
    pub spoil_volume: f64,
    /// Area replacement ratio
    pub area_ratio: f64,
}

impl JetGroutingDesign {
    /// Design jet grout columns
    pub fn design(
        params: &JetGroutingParams,
        _soil_strength: f64,
        soil_type: &str,
    ) -> Self {
        let d = params.diameter;
        let s = params.spacing;
        let depth = params.depth;
        
        // Column strength estimation
        // Depends on soil type and cement content
        let base_strength = match soil_type {
            "Clay" => 1.0,
            "Silt" => 2.0,
            "Sand" => 5.0,
            "Gravel" => 8.0,
            _ => 2.0,
        };
        
        // Adjustment for w/c ratio (lower w/c = higher strength)
        let wc_factor = (0.6 / params.w_c_ratio).powf(0.5);
        let column_strength = base_strength * wc_factor;
        
        // Column modulus (typically 200-500 * qu)
        let column_modulus = 300.0 * column_strength;
        
        // Grout volume per column
        let column_area = PI * d.powi(2) / 4.0;
        let column_volume = column_area * depth;
        
        // Cement consumption (assume specific gravity 3.15, cement content ~30%)
        let cement_volume_fraction = 1.0 / (1.0 + params.w_c_ratio * 3.15);
        let grout_volume = column_volume * 1.3; // 30% extra for waste
        let cement_per_meter = cement_volume_fraction * 3150.0 * column_area;
        
        // Spoil volume (approximately 100-200% of column volume)
        let spoil_ratio = match params.system {
            JetGroutingSystem::SingleFluid => 1.2,
            JetGroutingSystem::DoubleFluid => 1.5,
            JetGroutingSystem::TripleFluid => 2.0,
        };
        let spoil_volume = column_volume * spoil_ratio;
        
        // Area replacement ratio
        let area_ratio = column_area / s.powi(2);
        
        Self {
            column_strength,
            column_modulus,
            grout_volume,
            cement_per_meter,
            spoil_volume,
            area_ratio,
        }
    }
    
    /// Calculate composite ground properties
    pub fn composite_strength(&self, soil_strength: f64) -> f64 {
        self.area_ratio * self.column_strength + (1.0 - self.area_ratio) * soil_strength
    }
    
    /// Calculate permeability reduction
    pub fn permeability_reduction(&self, soil_k: f64) -> f64 {
        // Jet grout column permeability typically 10^-8 to 10^-9 m/s
        let column_k = 1e-8;
        
        // Composite permeability
        let kh = (1.0 - self.area_ratio) * soil_k + self.area_ratio * column_k;
        
        soil_k / kh
    }
}

// ============================================================================
// VERTICAL DRAINS (PVDs)
// ============================================================================

/// Vertical drain parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerticalDrainParams {
    /// Drain width (mm)
    pub width: f64,
    /// Drain thickness (mm)
    pub thickness: f64,
    /// Drain spacing (m)
    pub spacing: f64,
    /// Drain length (m)
    pub length: f64,
    /// Installation pattern
    pub pattern: DrainPattern,
    /// Discharge capacity (m³/year)
    pub discharge_capacity: f64,
}

/// Drain installation pattern
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum DrainPattern {
    /// Square grid
    Square,
    /// Triangular grid
    Triangular,
}

impl DrainPattern {
    /// Influence area factor
    pub fn influence_factor(&self) -> f64 {
        match self {
            Self::Square => 1.128, // sqrt(4/π)
            Self::Triangular => 1.05, // sqrt(2√3/π)
        }
    }
}

/// Vertical drain design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerticalDrainDesign {
    /// Equivalent drain diameter (m)
    pub equivalent_diameter: f64,
    /// Influence zone diameter (m)
    pub influence_diameter: f64,
    /// Spacing ratio n = de/dw
    pub spacing_ratio: f64,
    /// Time factor for 90% consolidation
    pub time_factor_90: f64,
    /// Estimated time for 90% consolidation (days)
    pub time_90_percent: f64,
    /// Well resistance factor
    pub well_resistance: f64,
    /// Smear zone effect
    pub smear_factor: f64,
}

impl VerticalDrainDesign {
    /// Design PVDs using Hansbo (1981) method
    pub fn design_hansbo(
        params: &VerticalDrainParams,
        ch: f64,      // Horizontal consolidation coefficient (m²/year)
        kh_ks: f64,   // Permeability ratio (undisturbed/smeared)
        smear_ratio: f64, // ds/dw ratio
    ) -> Self {
        // Equivalent drain diameter
        // dw = 2(a + b) / π for band drain
        let dw = 2.0 * (params.width + params.thickness) / 1000.0 / PI;
        
        // Influence diameter
        let de = params.spacing * params.pattern.influence_factor();
        
        // Spacing ratio
        let n = de / dw;
        
        // Smear zone diameter
        let ds = dw * smear_ratio;
        let s = ds / dw;
        
        // Well resistance parameter (Hansbo 1981) — uses kh not ch
        // Approximate kh from ch: kh ≈ ch * mv * γw, but since we don't have mv,
        // use dimensional correction: Fr = 2π·kh·l²/(3·qw)
        // For now use ch/qw ratio with correct factor
        let qw = params.discharge_capacity;
        let l = params.length;
        let fr = 2.0 * PI * l.powi(2) * ch / (3.0 * qw);
        
        // Combined parameter μ
        let fn_n = n.powi(2) / (n.powi(2) - 1.0) * (n.ln() - 0.75);
        let fs = (kh_ks - 1.0) * s.ln();
        let mu = fn_n + fs + fr;
        
        // Time factor for target consolidation
        let u_target: f64 = 0.90; // 90% consolidation
        let th90 = -mu * (1.0 - u_target).ln();
        
        // Time for 90% consolidation (Barron/Hansbo: divisor is 8ch)
        let time_90 = th90 * de.powi(2) / (8.0 * ch) * 365.0; // days
        
        Self {
            equivalent_diameter: dw,
            influence_diameter: de,
            spacing_ratio: n,
            time_factor_90: th90,
            time_90_percent: time_90,
            well_resistance: fr,
            smear_factor: fs,
        }
    }
    
    /// Calculate degree of consolidation at time t
    pub fn consolidation_at_time(&self, ch: f64, time_days: f64) -> f64 {
        let time_years = time_days / 365.0;
        let th = 8.0 * ch * time_years / self.influence_diameter.powi(2);
        
        let mu = self.time_factor_90 / (-(1.0 - 0.9_f64).ln());
        
        1.0 - (-th / mu).exp()
    }
    
    /// Estimate settlement progress
    pub fn settlement_at_time(&self, total_settlement: f64, ch: f64, time_days: f64) -> f64 {
        let u = self.consolidation_at_time(ch, time_days);
        total_settlement * u
    }
}

// ============================================================================
// DEEP SOIL MIXING
// ============================================================================

/// Deep soil mixing parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeepSoilMixingParams {
    /// Column diameter (m)
    pub diameter: f64,
    /// Column spacing (m)
    pub spacing: f64,
    /// Treatment depth (m)
    pub depth: f64,
    /// Binder type
    pub binder: BinderType,
    /// Binder content (kg/m³)
    pub binder_content: f64,
    /// Water-binder ratio
    pub w_b_ratio: f64,
    /// Mixing method
    pub method: MixingMethod,
}

/// Binder type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum BinderType {
    /// Portland cement
    Cement,
    /// Lime
    Lime,
    /// Cement-lime blend
    CementLime,
    /// Cement-slag blend
    CementSlag,
    /// Cement-flyash blend
    CementFlyash,
}

impl BinderType {
    /// Typical strength development factor at 28 days
    pub fn strength_factor(&self) -> f64 {
        match self {
            Self::Cement => 1.0,
            Self::Lime => 0.6,
            Self::CementLime => 0.8,
            Self::CementSlag => 1.2,
            Self::CementFlyash => 0.9,
        }
    }
}

/// Mixing method
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum MixingMethod {
    /// Wet mixing (slurry)
    Wet,
    /// Dry mixing (powder)
    Dry,
}

/// Deep soil mixing design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeepSoilMixingDesign {
    /// Estimated 28-day strength (kPa)
    pub strength_28day: f64,
    /// Design strength (kPa)
    pub design_strength: f64,
    /// Column modulus (MPa)
    pub column_modulus: f64,
    /// Area replacement ratio
    pub area_ratio: f64,
    /// Improvement factor
    pub improvement_factor: f64,
    /// Binder consumption (kg/column)
    pub binder_per_column: f64,
}

impl DeepSoilMixingDesign {
    /// Design DSM columns
    pub fn design(
        params: &DeepSoilMixingParams,
        _soil_water_content: f64,
        organic_content: f64,
    ) -> Self {
        let d = params.diameter;
        let s = params.spacing;
        let depth = params.depth;
        let alpha = params.binder_content;
        
        // Strength estimation (empirical)
        // qu = α × β × γ
        // α = binder content factor, β = soil factor, γ = mixing efficiency
        
        // Binder content factor (strength increase per kg/m³)
        let alpha_factor = (alpha / 100.0).powf(0.8) * 500.0;
        
        // Soil factor (organic content reduction)
        let beta = 1.0 - 0.03 * organic_content;
        
        // Mixing efficiency
        let gamma = match params.method {
            MixingMethod::Wet => 0.85,
            MixingMethod::Dry => 0.75,
        };
        
        // 28-day strength
        let strength_28day = alpha_factor * beta * gamma * params.binder.strength_factor();
        
        // Design strength (with variability factor)
        let design_strength = strength_28day * 0.5; // 50% for variability
        
        // Modulus (typically 100-500 × qu)
        let column_modulus = 200.0 * design_strength / 1000.0;
        
        // Area replacement ratio
        let column_area = PI * d.powi(2) / 4.0;
        let area_ratio = column_area / s.powi(2);
        
        // Improvement factor (modular ratio method)
        // Use column_modulus (MPa) and a representative soil modulus
        let soil_e = 5.0; // Representative soil modulus (MPa) for soft clay
        let improvement_factor = 1.0 + area_ratio * (column_modulus / soil_e - 1.0);
        
        // Binder consumption
        let column_volume = column_area * depth;
        let binder_per_column = alpha * column_volume;
        
        Self {
            strength_28day,
            design_strength,
            column_modulus,
            area_ratio,
            improvement_factor,
            binder_per_column,
        }
    }
    
    /// Calculate settlement reduction
    pub fn settlement_reduction(&self, untreated_settlement: f64) -> f64 {
        untreated_settlement / self.improvement_factor
    }
    
    /// Calculate bearing capacity increase
    pub fn bearing_capacity_increase(&self, untreated_qu: f64) -> f64 {
        // Composite bearing capacity
        let qu_composite = self.area_ratio * self.design_strength + 
            (1.0 - self.area_ratio) * untreated_qu;
        
        qu_composite / untreated_qu
    }
}

// ============================================================================
// RIGID INCLUSIONS
// ============================================================================

/// Rigid inclusion parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RigidInclusionParams {
    /// Inclusion diameter (m)
    pub diameter: f64,
    /// Inclusion spacing (m)
    pub spacing: f64,
    /// Inclusion length (m)
    pub length: f64,
    /// Inclusion type
    pub inclusion_type: InclusionType,
    /// Load transfer platform thickness (m)
    pub ltp_thickness: f64,
}

/// Rigid inclusion type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum InclusionType {
    /// Controlled modulus columns (CMC)
    CMC,
    /// Concrete piles
    ConcretePiles,
    /// Grout columns
    GroutColumns,
    /// Timber piles
    TimberPiles,
}

impl InclusionType {
    /// Typical modulus (MPa)
    pub fn modulus(&self) -> f64 {
        match self {
            Self::CMC => 10_000.0,
            Self::ConcretePiles => 25_000.0,
            Self::GroutColumns => 5_000.0,
            Self::TimberPiles => 10_000.0,
        }
    }
}

/// Rigid inclusion design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RigidInclusionDesign {
    /// Area replacement ratio
    pub area_ratio: f64,
    /// Load transfer efficiency
    pub efficiency: f64,
    /// Stress concentration factor
    pub stress_concentration: f64,
    /// Settlement reduction factor
    pub settlement_reduction: f64,
    /// Inclusion load (kN)
    pub inclusion_load: f64,
    /// Soil load (kPa)
    pub soil_stress: f64,
}

impl RigidInclusionDesign {
    /// Design rigid inclusions per ASIRI (2012)
    pub fn design_asiri(
        params: &RigidInclusionParams,
        applied_load: f64,    // kPa
        soil_modulus: f64,    // MPa
        _pile_capacity: f64,   // kN
    ) -> Self {
        let d = params.diameter;
        let s = params.spacing;
        
        // Area replacement ratio
        let a_p = PI * d.powi(2) / 4.0;
        let a_s = s.powi(2);
        let area_ratio = a_p / a_s;
        
        // Modulus ratio
        let e_p = params.inclusion_type.modulus();
        let e_s = soil_modulus;
        let n = e_p / e_s;
        
        // Stress concentration ratio: SCR = n / (1 + (n-1)*as) per ASIRI
        let src = n / (1.0 + (n - 1.0) * area_ratio);
        
        // Load transfer efficiency (depends on LTP design)
        let h = params.ltp_thickness;
        let s_net = s - d;
        let efficiency = if h > 0.0 {
            // Arching in LTP
            let k = 1.0; // Earth pressure coefficient
            let phi = 35.0 * PI / 180.0; // LTP friction angle
            let ratio = (1.0 - (-2.0 * k * phi.tan() * h / s_net).exp()) 
                * a_s / a_p;
            ratio.min(0.95)
        } else {
            area_ratio
        };
        
        // Load distribution
        let q_total = applied_load * a_s;
        let inclusion_load = efficiency * q_total;
        let soil_stress = (1.0 - efficiency) * applied_load / (1.0 - area_ratio);
        
        // Settlement reduction
        let settlement_reduction = 1.0 / (area_ratio * n + (1.0 - area_ratio));
        
        Self {
            area_ratio,
            efficiency,
            stress_concentration: src,
            settlement_reduction,
            inclusion_load,
            soil_stress,
        }
    }
    
    /// Check inclusion capacity
    pub fn check_capacity(&self, allowable_capacity: f64) -> bool {
        self.inclusion_load <= allowable_capacity
    }
}

// ============================================================================
// SOIL NAILING
// ============================================================================

/// Soil nail parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoilNailParams {
    /// Nail diameter (mm)
    pub diameter: f64,
    /// Nail length (m)
    pub length: f64,
    /// Horizontal spacing (m)
    pub h_spacing: f64,
    /// Vertical spacing (m)
    pub v_spacing: f64,
    /// Nail inclination (degrees below horizontal)
    pub inclination: f64,
    /// Nail type
    pub nail_type: NailType,
    /// Grout hole diameter (mm)
    pub hole_diameter: f64,
}

/// Nail type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum NailType {
    /// Solid bar (grouted)
    SolidBar,
    /// Hollow bar (self-drilling)
    HollowBar,
    /// Driven nail
    Driven,
    /// Launched nail
    Launched,
}

impl NailType {
    /// Typical yield strength (MPa)
    pub fn yield_strength(&self) -> f64 {
        match self {
            Self::SolidBar => 500.0,
            Self::HollowBar => 550.0,
            Self::Driven => 400.0,
            Self::Launched => 450.0,
        }
    }
}

/// Soil nail design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoilNailDesign {
    /// Nail tensile capacity (kN)
    pub tensile_capacity: f64,
    /// Nail pullout capacity (kN)
    pub pullout_capacity: f64,
    /// Design load per nail (kN)
    pub design_load: f64,
    /// Factor of safety (pullout)
    pub fos_pullout: f64,
    /// Factor of safety (tensile)
    pub fos_tensile: f64,
    /// Bond length required (m)
    pub bond_length: f64,
}

impl SoilNailDesign {
    /// Design soil nail per FHWA-IF-03-017
    pub fn design_fhwa(
        params: &SoilNailParams,
        ultimate_bond: f64,   // Ultimate bond stress (kPa)
        active_load: f64,     // Active earth pressure load per nail (kN)
        fos_required: f64,
    ) -> Self {
        let d_bar = params.diameter / 1000.0; // m
        let d_hole = params.hole_diameter / 1000.0; // m
        
        // Tensile capacity
        let area = PI * d_bar.powi(2) / 4.0;
        let fy = params.nail_type.yield_strength() * 1000.0; // kPa
        let tensile_capacity = area * fy;
        
        // Pullout capacity
        let perimeter = PI * d_hole;
        let bond_length = params.length * 0.8; // Effective bond length
        let pullout_capacity = perimeter * bond_length * ultimate_bond;
        
        // Design load
        let design_load = active_load;
        
        // Factors of safety
        let fos_pullout = pullout_capacity / design_load;
        let fos_tensile = tensile_capacity / design_load;
        
        // Required bond length for target FoS
        let required_bond = design_load * fos_required / (perimeter * ultimate_bond);
        
        Self {
            tensile_capacity,
            pullout_capacity,
            design_load,
            fos_pullout,
            fos_tensile,
            bond_length: required_bond,
        }
    }
    
    /// Check if design is adequate
    pub fn is_adequate(&self, required_fos: f64) -> bool {
        self.fos_pullout >= required_fos && self.fos_tensile >= required_fos
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stone_column_design() {
        let params = StoneColumnParams {
            diameter: 0.8,
            spacing: 2.0,
            length: 10.0,
            phi_stone: 42.0,
            gamma_stone: 20.0,
            method: StoneColumnMethod::VibroReplacementWet,
        };
        
        let design = StoneColumnDesign::design_priebe(&params, 28.0, 5.0, 80.0, 50.0);
        
        assert!(design.area_ratio > 0.0 && design.area_ratio < 1.0);
        assert!(design.improvement_factor > 1.0);
    }

    #[test]
    fn test_dynamic_compaction() {
        let params = DynamicCompactionParams {
            tamper_weight: 15.0,
            drop_height: 20.0,
            grid_spacing: 6.0,
            passes: 3,
            drops_per_point: 10,
        };
        
        let design = DynamicCompactionDesign::design(&params, "Sand", 8.0, 8.0);
        
        assert!(design.effective_depth > 0.0);
        assert!(design.post_n_value > design.pre_n_value);
    }

    #[test]
    fn test_jet_grouting() {
        let params = JetGroutingParams {
            system: JetGroutingSystem::DoubleFluid,
            diameter: 1.0,
            spacing: 1.5,
            depth: 15.0,
            pressure: 40.0,
            w_c_ratio: 1.0,
            rotation_speed: 10.0,
            withdrawal_rate: 0.3,
        };
        
        let design = JetGroutingDesign::design(&params, 30.0, "Silt");
        
        assert!(design.column_strength > 0.0);
        assert!(design.area_ratio > 0.0);
    }

    #[test]
    fn test_vertical_drains() {
        let params = VerticalDrainParams {
            width: 100.0,
            thickness: 4.0,
            spacing: 1.5,
            length: 15.0,
            pattern: DrainPattern::Triangular,
            discharge_capacity: 100.0,
        };
        
        let design = VerticalDrainDesign::design_hansbo(&params, 3.0, 3.0, 2.0);
        
        assert!(design.time_90_percent > 0.0);
        assert!(design.spacing_ratio > 1.0);
    }

    #[test]
    fn test_consolidation_progress() {
        let params = VerticalDrainParams {
            width: 100.0,
            thickness: 4.0,
            spacing: 1.2,
            length: 12.0,
            pattern: DrainPattern::Square,
            discharge_capacity: 80.0,
        };
        
        let design = VerticalDrainDesign::design_hansbo(&params, 2.0, 2.5, 2.5);
        
        let u_30 = design.consolidation_at_time(2.0, 30.0);
        let u_90 = design.consolidation_at_time(2.0, design.time_90_percent);
        
        assert!(u_30 < u_90);
        assert!((u_90 - 0.90).abs() < 0.05);
    }

    #[test]
    fn test_deep_soil_mixing() {
        let params = DeepSoilMixingParams {
            diameter: 0.8,
            spacing: 1.5,
            depth: 12.0,
            binder: BinderType::Cement,
            binder_content: 200.0,
            w_b_ratio: 1.0,
            method: MixingMethod::Wet,
        };
        
        let design = DeepSoilMixingDesign::design(&params, 50.0, 5.0);
        
        assert!(design.strength_28day > 0.0);
        assert!(design.improvement_factor > 1.0);
    }

    #[test]
    fn test_rigid_inclusions() {
        let params = RigidInclusionParams {
            diameter: 0.4,
            spacing: 2.0,
            length: 12.0,
            inclusion_type: InclusionType::CMC,
            ltp_thickness: 0.5,
        };
        
        let design = RigidInclusionDesign::design_asiri(&params, 100.0, 10.0, 800.0);
        
        assert!(design.efficiency > 0.0 && design.efficiency <= 1.0);
        assert!(design.settlement_reduction < 1.0);
    }

    #[test]
    fn test_soil_nailing() {
        let params = SoilNailParams {
            diameter: 25.0,
            length: 8.0,
            h_spacing: 1.5,
            v_spacing: 1.5,
            inclination: 15.0,
            nail_type: NailType::SolidBar,
            hole_diameter: 100.0,
        };
        
        let design = SoilNailDesign::design_fhwa(&params, 100.0, 50.0, 2.0);
        
        assert!(design.tensile_capacity > 0.0);
        assert!(design.pullout_capacity > 0.0);
    }

    #[test]
    fn test_improvement_methods() {
        let method = ImprovementMethod::StoneColumns;
        
        assert_eq!(method.category(), ImprovementCategory::Reinforcement);
        
        let (min_d, max_d) = method.depth_range();
        assert!(min_d < max_d);
    }

    #[test]
    fn test_jet_grout_system() {
        let system = JetGroutingSystem::TripleFluid;
        let (min_d, max_d) = system.diameter_range("Sand");
        
        assert!(max_d > min_d);
        assert!(max_d >= 1.5);
    }

    #[test]
    fn test_drain_pattern() {
        let square = DrainPattern::Square;
        let tri = DrainPattern::Triangular;
        
        assert!(square.influence_factor() > tri.influence_factor());
    }

    #[test]
    fn test_binder_strength() {
        let cement = BinderType::Cement;
        let slag = BinderType::CementSlag;
        
        assert!(slag.strength_factor() > cement.strength_factor());
    }
}
