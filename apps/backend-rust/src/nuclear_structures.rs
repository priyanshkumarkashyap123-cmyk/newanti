// ============================================================================
// NUCLEAR & POWER PLANT STRUCTURES MODULE
// ACI 349, ASCE 4, NRC RG - Safety-critical facility design
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// SAFETY CLASSIFICATION
// ============================================================================

/// Nuclear safety class
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SafetyClass {
    /// Safety Class 1 - Components essential for safe shutdown
    SC1,
    /// Safety Class 2 - Components important to safety
    SC2,
    /// Safety Class 3 - Components required for safe operation
    SC3,
    /// Non-nuclear safety (NNS)
    NNS,
}

impl SafetyClass {
    /// Load factor multiplier
    pub fn load_factor(&self) -> f64 {
        match self {
            SafetyClass::SC1 => 1.0,
            SafetyClass::SC2 => 0.95,
            SafetyClass::SC3 => 0.90,
            SafetyClass::NNS => 0.85,
        }
    }
    
    /// Required design margin
    pub fn design_margin(&self) -> f64 {
        match self {
            SafetyClass::SC1 => 2.0,
            SafetyClass::SC2 => 1.67,
            SafetyClass::SC3 => 1.5,
            SafetyClass::NNS => 1.33,
        }
    }
}

/// Seismic category
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SeismicCategory {
    /// Category I - Must remain functional during/after SSE
    CategoryI,
    /// Category II - Must not fail so as to damage Cat I
    CategoryII,
    /// Non-seismic
    NonSeismic,
}

// ============================================================================
// DESIGN BASIS EVENTS
// ============================================================================

/// Design basis earthquake parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesignBasisEarthquake {
    /// Operating basis earthquake PGA (g)
    pub obe_pga: f64,
    /// Safe shutdown earthquake PGA (g)
    pub sse_pga: f64,
    /// Site amplification factor
    pub site_factor: f64,
    /// Damping ratio for OBE (%)
    pub obe_damping: f64,
    /// Damping ratio for SSE (%)
    pub sse_damping: f64,
}

impl DesignBasisEarthquake {
    pub fn new(sse_pga: f64) -> Self {
        Self {
            obe_pga: sse_pga / 3.0, // Typically OBE = SSE/3
            sse_pga,
            site_factor: 1.0,
            obe_damping: 2.0,
            sse_damping: 5.0,
        }
    }
    
    /// Effective SSE acceleration
    pub fn effective_sse(&self) -> f64 {
        self.sse_pga * self.site_factor
    }
    
    /// Spectral acceleration at period T (simplified RG 1.60)
    pub fn spectral_acceleration(&self, period: f64, damping: f64) -> f64 {
        let pga = self.effective_sse();
        
        // Damping correction factor
        let beta = damping / 100.0;
        let damping_factor = (0.05 / beta).sqrt().min(1.5);
        
        // Simplified response spectrum shape (RG 1.60)
        let sa = if period < 0.03 {
            pga
        } else if period < 0.1 {
            pga * (1.0 + (period - 0.03) / 0.07 * 1.5)
        } else if period < 0.3 {
            pga * 2.5
        } else if period < 1.0 {
            pga * 2.5 * 0.3 / period
        } else {
            pga * 2.5 * 0.3 / period.powi(2)
        };
        
        sa * damping_factor
    }
}

/// Design basis accident thermal load
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThermalAccident {
    /// Normal operating temperature (°C)
    pub normal_temp: f64,
    /// Accident peak temperature (°C)
    pub accident_temp: f64,
    /// Time to peak (hours)
    pub time_to_peak: f64,
    /// Duration at peak (hours)
    pub peak_duration: f64,
}

impl ThermalAccident {
    /// LOCA (Loss of Coolant Accident) profile
    pub fn loca() -> Self {
        Self {
            normal_temp: 50.0,
            accident_temp: 150.0,
            time_to_peak: 0.5,
            peak_duration: 3.0,
        }
    }
    
    /// Temperature at time t (hours)
    pub fn temperature_at(&self, t: f64) -> f64 {
        if t < self.time_to_peak {
            let ratio = t / self.time_to_peak;
            self.normal_temp + (self.accident_temp - self.normal_temp) * ratio
        } else if t < self.time_to_peak + self.peak_duration {
            self.accident_temp
        } else {
            // Cooldown phase
            let cooldown_time = t - self.time_to_peak - self.peak_duration;
            let decay = (-cooldown_time / 10.0).exp();
            self.normal_temp + (self.accident_temp - self.normal_temp) * decay
        }
    }
    
    /// Thermal gradient through wall thickness (°C/m)
    pub fn thermal_gradient(&self, wall_thickness: f64) -> f64 {
        (self.accident_temp - self.normal_temp) / wall_thickness
    }
}

// ============================================================================
// CONTAINMENT STRUCTURE
// ============================================================================

/// Containment structure type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ContainmentType {
    /// Reinforced concrete (single wall)
    SingleRC,
    /// Prestressed concrete
    Prestressed,
    /// Steel containment
    Steel,
    /// Double containment (inner steel, outer RC)
    DoubleWall,
    /// Ice condenser
    IceCondenser,
}

/// Containment structure design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Containment {
    /// Inner radius (m)
    pub inner_radius: f64,
    /// Wall thickness (m)
    pub wall_thickness: f64,
    /// Total height (m)
    pub height: f64,
    /// Dome thickness (m)
    pub dome_thickness: f64,
    /// Basemat thickness (m)
    pub basemat_thickness: f64,
    /// Containment type
    pub containment_type: ContainmentType,
    /// Design pressure (kPa gauge)
    pub design_pressure: f64,
    /// Design temperature (°C)
    pub design_temperature: f64,
}

impl Containment {
    pub fn new_pwr(power_mw: f64) -> Self {
        // Sizing based on power level
        let volume = power_mw * 50.0; // m³/MW typical
        let radius = (volume / (2.0 * PI)).powf(1.0 / 3.0);
        
        Self {
            inner_radius: radius,
            wall_thickness: 1.2,
            height: radius * 2.5,
            dome_thickness: 0.9,
            basemat_thickness: 3.0,
            containment_type: ContainmentType::Prestressed,
            design_pressure: 350.0, // kPa gauge
            design_temperature: 150.0,
        }
    }
    
    /// Free volume (m³)
    pub fn free_volume(&self) -> f64 {
        let cylinder = PI * self.inner_radius.powi(2) * (self.height - self.inner_radius);
        let dome = 2.0 * PI * self.inner_radius.powi(3) / 3.0;
        cylinder + dome
    }
    
    /// Hoop stress from internal pressure (MPa)
    pub fn hoop_stress(&self, pressure_kpa: f64) -> f64 {
        pressure_kpa * self.inner_radius / self.wall_thickness / 1000.0
    }
    
    /// Meridional stress from internal pressure (MPa)
    pub fn meridional_stress(&self, pressure_kpa: f64) -> f64 {
        self.hoop_stress(pressure_kpa) / 2.0
    }
    
    /// Required prestress force (kN/m) for zero tension
    pub fn required_prestress(&self) -> f64 {
        if matches!(self.containment_type, ContainmentType::Prestressed) {
            let sigma = self.hoop_stress(self.design_pressure);
            sigma * self.wall_thickness * 1000.0 * 1.5 // 1.5 factor for load combinations
        } else {
            0.0
        }
    }
    
    /// Minimum rebar ratio per ACI 349
    pub fn min_rebar_ratio(&self) -> f64 {
        0.0025 // Each direction, each face
    }
    
    /// Concrete volume (m³)
    pub fn concrete_volume(&self) -> f64 {
        let outer_r = self.inner_radius + self.wall_thickness;
        
        // Cylinder wall
        let cylinder = PI * (outer_r.powi(2) - self.inner_radius.powi(2)) * 
                       (self.height - self.inner_radius);
        
        // Dome
        let dome_outer = self.inner_radius + self.dome_thickness;
        let dome = 2.0 * PI * (dome_outer.powi(3) - self.inner_radius.powi(3)) / 3.0;
        
        // Basemat
        let basemat = PI * outer_r.powi(2) * self.basemat_thickness;
        
        cylinder + dome + basemat
    }
}

/// Containment designer per ACI 349
pub struct ContainmentDesigner {
    pub containment: Containment,
    pub fck: f64,
    pub fy: f64,
    pub fpu: f64, // Prestressing steel ultimate strength
}

impl ContainmentDesigner {
    pub fn new(containment: Containment) -> Self {
        Self {
            containment,
            fck: 40.0,
            fy: 500.0,
            fpu: 1860.0,
        }
    }
    
    /// Check wall thickness adequacy
    pub fn check_wall(&self) -> WallCheckResult {
        let p = self.containment.design_pressure;
        let sigma_h = self.containment.hoop_stress(p);
        let sigma_m = self.containment.meridional_stress(p);
        
        // Allowable concrete stress (0.45 f'c for sustained)
        let fc_allow = 0.45 * self.fck;
        
        // Required steel
        let as_hoop = if sigma_h > fc_allow {
            (sigma_h - fc_allow) * self.containment.wall_thickness * 1000.0 / (0.9 * self.fy)
        } else {
            self.containment.min_rebar_ratio() * self.containment.wall_thickness * 1000.0
        };
        
        WallCheckResult {
            hoop_stress: sigma_h,
            meridional_stress: sigma_m,
            allowable_stress: fc_allow,
            hoop_steel: as_hoop,
            meridional_steel: as_hoop / 2.0,
            thickness_adequate: sigma_h < fc_allow * 2.0,
        }
    }
    
    /// Design liner plate (if steel lined)
    pub fn liner_design(&self) -> LinerDesign {
        let p = self.containment.design_pressure;
        
        // Minimum liner thickness
        let t_min = 6.35; // 1/4 inch minimum per ASME
        
        // Stress check
        let sigma = p * self.containment.inner_radius / t_min;
        let sigma_allow = 345.0 * 0.6; // SA-516 Gr 70
        
        let t_required = if sigma > sigma_allow {
            t_min * sigma / sigma_allow
        } else {
            t_min
        };
        
        LinerDesign {
            thickness: t_required.max(t_min),
            material: "SA-516 Gr 70".to_string(),
            allowable_stress: sigma_allow,
            actual_stress: p * self.containment.inner_radius / t_required,
        }
    }
    
    /// Penetration reinforcement design
    pub fn penetration_reinforcement(&self, opening_diameter: f64) -> PenetrationDesign {
        let t = self.containment.wall_thickness;
        let d = opening_diameter;
        
        // Area replacement method
        let area_removed = d * t;
        
        // Reinforcement within 2.5t or 2.5d (whichever smaller)
        let reinf_zone = (2.5 * t).min(2.5 * d);
        
        // Additional bars required
        let as_additional = area_removed * 0.01; // 1% of removed area
        
        // Sleeve thickness
        let sleeve_t = (t / 3.0).max(0.02);
        
        PenetrationDesign {
            opening_diameter: d,
            reinforcement_zone: reinf_zone,
            additional_rebar: as_additional,
            sleeve_thickness: sleeve_t,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WallCheckResult {
    pub hoop_stress: f64,
    pub meridional_stress: f64,
    pub allowable_stress: f64,
    pub hoop_steel: f64,
    pub meridional_steel: f64,
    pub thickness_adequate: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinerDesign {
    pub thickness: f64,
    pub material: String,
    pub allowable_stress: f64,
    pub actual_stress: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PenetrationDesign {
    pub opening_diameter: f64,
    pub reinforcement_zone: f64,
    pub additional_rebar: f64,
    pub sleeve_thickness: f64,
}

// ============================================================================
// SPENT FUEL POOL
// ============================================================================

/// Spent fuel pool design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpentFuelPool {
    /// Length (m)
    pub length: f64,
    /// Width (m)
    pub width: f64,
    /// Depth (m)
    pub depth: f64,
    /// Wall thickness (m)
    pub wall_thickness: f64,
    /// Floor thickness (m)
    pub floor_thickness: f64,
    /// Water depth (m)
    pub water_depth: f64,
    /// Liner thickness (mm)
    pub liner_thickness: f64,
}

impl SpentFuelPool {
    pub fn new(length: f64, width: f64, depth: f64) -> Self {
        Self {
            length,
            width,
            depth,
            wall_thickness: 1.5,
            floor_thickness: 2.0,
            water_depth: depth - 0.5,
            liner_thickness: 6.35,
        }
    }
    
    /// Hydrostatic pressure at depth z (kPa)
    pub fn hydrostatic_pressure(&self, z: f64) -> f64 {
        9.81 * z // kN/m² = kPa
    }
    
    /// Maximum wall moment from hydrostatic (kN·m/m)
    pub fn wall_moment(&self) -> f64 {
        // Triangular pressure on cantilever wall
        let p_base = self.hydrostatic_pressure(self.water_depth);
        p_base * self.water_depth.powi(2) / 6.0
    }
    
    /// Required wall reinforcement (mm²/m)
    pub fn wall_reinforcement(&self, fy: f64) -> f64 {
        let m = self.wall_moment();
        let d = self.wall_thickness * 1000.0 - 75.0; // Effective depth
        
        m * 1e6 / (0.87 * fy * 0.9 * d)
    }
    
    /// Sloshing wave height for SSE (m)
    pub fn sloshing_height(&self, sse_pga: f64) -> f64 {
        // Housner's equation simplified
        let l = self.length.max(self.width);
        let h = self.water_depth;
        
        let omega = (PI * 9.81 / l * (PI * h / l).tanh()).sqrt();
        let _period = 2.0 * PI / omega;
        
        // Spectral acceleration at sloshing period (capped)
        let sa = sse_pga * 2.5; // Simplified
        
        // Sloshing height (limited to reasonable range)
        (0.42 * l * sa).min(3.0)
    }
    
    /// Pool concrete volume (m³)
    pub fn concrete_volume(&self) -> f64 {
        let l = self.length;
        let w = self.width;
        let d = self.depth;
        let tw = self.wall_thickness;
        let tf = self.floor_thickness;
        
        // Floor
        let floor = (l + 2.0 * tw) * (w + 2.0 * tw) * tf;
        
        // Walls
        let walls = 2.0 * ((l + 2.0 * tw) * d * tw + w * d * tw);
        
        floor + walls
    }
}

// ============================================================================
// TURBINE BUILDING
// ============================================================================

/// Turbine pedestal design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TurbinePedestal {
    /// Turbine weight (kN)
    pub turbine_weight: f64,
    /// Generator weight (kN)
    pub generator_weight: f64,
    /// Operating speed (rpm)
    pub speed_rpm: f64,
    /// Condenser vacuum load (kN)
    pub vacuum_load: f64,
    /// Blade loss load (kN)
    pub blade_loss: f64,
    /// Pedestal length (m)
    pub length: f64,
    /// Pedestal width (m)
    pub width: f64,
}

impl TurbinePedestal {
    pub fn new(power_mw: f64) -> Self {
        // Empirical sizing
        let turbine_weight = power_mw * 8.0;
        let generator_weight = power_mw * 5.0;
        
        Self {
            turbine_weight,
            generator_weight,
            speed_rpm: 3000.0,
            vacuum_load: power_mw * 2.0,
            blade_loss: power_mw * 15.0,
            length: (power_mw / 50.0).sqrt() * 20.0,
            width: (power_mw / 50.0).sqrt() * 10.0,
        }
    }
    
    /// Operating frequency (Hz)
    pub fn operating_frequency(&self) -> f64 {
        self.speed_rpm / 60.0
    }
    
    /// Natural frequency requirement (Hz)
    /// Must be outside ±20% of operating frequency
    pub fn frequency_exclusion_range(&self) -> (f64, f64) {
        let f_op = self.operating_frequency();
        (0.8 * f_op, 1.2 * f_op)
    }
    
    /// Total vertical load (kN)
    pub fn total_vertical(&self) -> f64 {
        self.turbine_weight + self.generator_weight + self.vacuum_load
    }
    
    /// Design horizontal load (kN)
    pub fn design_horizontal(&self) -> f64 {
        // Blade loss is worst case
        self.blade_loss
    }
    
    /// Required table-top thickness for frequency (m)
    pub fn table_thickness(&self, target_frequency: f64) -> f64 {
        // Simplified relationship
        let mass = self.total_vertical() / 9.81;
        let k = (2.0 * PI * target_frequency).powi(2) * mass;
        
        // Thickness based on required stiffness
        let e = 30000.0; // MPa concrete
        let i_required = k * self.length.powi(3) / (48.0 * e * 1e6);
        
        (12.0 * i_required / self.width).powf(1.0 / 3.0)
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_safety_class() {
        assert!(SafetyClass::SC1.design_margin() > SafetyClass::SC3.design_margin());
    }

    #[test]
    fn test_dbe() {
        let dbe = DesignBasisEarthquake::new(0.3);
        
        assert!((dbe.obe_pga - 0.1).abs() < 0.01);
    }

    #[test]
    fn test_spectral_acceleration() {
        let dbe = DesignBasisEarthquake::new(0.3);
        
        let sa_short = dbe.spectral_acceleration(0.2, 5.0);
        let sa_long = dbe.spectral_acceleration(2.0, 5.0);
        
        assert!(sa_short > sa_long);
    }

    #[test]
    fn test_thermal_accident() {
        let loca = ThermalAccident::loca();
        
        let t0 = loca.temperature_at(0.0);
        let t_peak = loca.temperature_at(0.5);
        
        assert!((t0 - 50.0).abs() < 1.0);
        assert!((t_peak - 150.0).abs() < 1.0);
    }

    #[test]
    fn test_containment() {
        let cont = Containment::new_pwr(1000.0);
        
        assert!(cont.free_volume() > 50000.0);
    }

    #[test]
    fn test_hoop_stress() {
        let cont = Containment::new_pwr(1000.0);
        let sigma = cont.hoop_stress(350.0);
        
        assert!(sigma > 0.0 && sigma < 20.0);
    }

    #[test]
    fn test_containment_designer() {
        let cont = Containment::new_pwr(1000.0);
        let designer = ContainmentDesigner::new(cont);
        
        let result = designer.check_wall();
        
        assert!(result.hoop_steel > 0.0);
    }

    #[test]
    fn test_liner_design() {
        let cont = Containment::new_pwr(1000.0);
        let designer = ContainmentDesigner::new(cont);
        
        let liner = designer.liner_design();
        
        assert!(liner.thickness >= 6.35);
    }

    #[test]
    fn test_penetration() {
        let cont = Containment::new_pwr(1000.0);
        let designer = ContainmentDesigner::new(cont);
        
        let pen = designer.penetration_reinforcement(3.0);
        
        assert!(pen.additional_rebar > 0.0);
    }

    #[test]
    fn test_sfp() {
        let pool = SpentFuelPool::new(12.0, 8.0, 12.0);
        
        assert!(pool.water_depth < pool.depth);
    }

    #[test]
    fn test_sfp_pressure() {
        let pool = SpentFuelPool::new(12.0, 8.0, 12.0);
        let p = pool.hydrostatic_pressure(10.0);
        
        assert!((p - 98.1).abs() < 1.0);
    }

    #[test]
    fn test_sfp_sloshing() {
        let pool = SpentFuelPool::new(12.0, 8.0, 12.0);
        let h = pool.sloshing_height(0.3);
        
        assert!(h > 0.0 && h < 5.0);
    }

    #[test]
    fn test_turbine_pedestal() {
        let ped = TurbinePedestal::new(1000.0);
        
        assert!((ped.operating_frequency() - 50.0).abs() < 0.1);
    }

    #[test]
    fn test_frequency_exclusion() {
        let ped = TurbinePedestal::new(1000.0);
        let (low, high) = ped.frequency_exclusion_range();
        
        assert!(low < 50.0 && high > 50.0);
    }

    #[test]
    fn test_table_thickness() {
        let ped = TurbinePedestal::new(1000.0);
        let t = ped.table_thickness(70.0);
        
        assert!(t > 0.5 && t < 5.0);
    }
}
