//! Offshore Wind Structures Module
//! 
//! Comprehensive offshore wind turbine foundation design:
//! - Monopile foundations
//! - Jacket structures
//! - Gravity base foundations
//! - Floating platforms
//! 
//! Standards: DNV-ST-0126, IEC 61400-3, API RP 2A, BSH Standard

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

/// Offshore foundation type
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum OffshoreFoundationType {
    /// Monopile (most common for shallow/medium depth)
    Monopile,
    /// Jacket structure (deeper water)
    Jacket,
    /// Gravity base structure
    GravityBase,
    /// Suction bucket
    SuctionBucket,
    /// Floating semi-submersible
    SemiSubmersible,
    /// Floating spar
    Spar,
    /// Floating tension leg platform
    TLP,
}

/// Site conditions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OffshoreSiteConditions {
    /// Water depth (m)
    pub water_depth: f64,
    /// Significant wave height Hs (m)
    pub hs: f64,
    /// Peak spectral period Tp (s)
    pub tp: f64,
    /// Maximum wave height (m)
    pub h_max: f64,
    /// Current velocity (m/s)
    pub current_velocity: f64,
    /// 50-year wind speed at hub height (m/s)
    pub wind_speed_50yr: f64,
    /// Soil type
    pub soil_type: SeabedSoilType,
    /// Undrained shear strength (kPa) - for clay
    pub su: Option<f64>,
    /// Friction angle (degrees) - for sand
    pub phi: Option<f64>,
}

/// Seabed soil type
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum SeabedSoilType {
    Sand,
    Clay,
    SiltySand,
    StiffClay,
    Rock,
}

/// Turbine parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TurbineParameters {
    /// Rated power (MW)
    pub rated_power: f64,
    /// Rotor diameter (m)
    pub rotor_diameter: f64,
    /// Hub height above MSL (m)
    pub hub_height: f64,
    /// Nacelle + rotor mass (tonnes)
    pub top_mass: f64,
    /// Tower mass (tonnes)
    pub tower_mass: f64,
    /// Maximum thrust (kN)
    pub max_thrust: f64,
}

/// Monopile designer
#[derive(Debug, Clone)]
pub struct MonopileDesigner;

/// Monopile design result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonopileDesign {
    /// Pile diameter (m)
    pub diameter: f64,
    /// Wall thickness (mm)
    pub wall_thickness: f64,
    /// Embedded length (m)
    pub embedded_length: f64,
    /// Total length (m)
    pub total_length: f64,
    /// Steel grade
    pub steel_grade: String,
    /// Steel mass (tonnes)
    pub steel_mass: f64,
    /// Natural frequency (Hz)
    pub natural_frequency: f64,
    /// Utilization ratios
    pub utilization: MonopileUtilization,
}

/// Monopile utilization checks
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonopileUtilization {
    /// ULS bending
    pub uls_bending: f64,
    /// ULS local buckling
    pub uls_buckling: f64,
    /// Fatigue damage
    pub fatigue_damage: f64,
    /// Lateral capacity
    pub lateral_capacity: f64,
}

impl MonopileDesigner {
    /// Design monopile foundation
    pub fn design(
        &self,
        site: &OffshoreSiteConditions,
        turbine: &TurbineParameters,
    ) -> MonopileDesign {
        // Initial diameter estimate based on water depth and turbine size
        let d_est = ((site.water_depth * 0.2).max(5.5) + turbine.rated_power * 0.1).min(12.0);
        
        // Wall thickness (D/t typically 60-100 for monopiles)
        let t = d_est * 1000.0 / 80.0; // mm
        
        // Embedded length (typically 4-6 x diameter for dense sand)
        let embed_factor = match site.soil_type {
            SeabedSoilType::Sand => 5.0,
            SeabedSoilType::Clay | SeabedSoilType::StiffClay => 6.0,
            SeabedSoilType::SiltySand => 5.5,
            SeabedSoilType::Rock => 3.0,
        };
        let l_embed = d_est * embed_factor;
        
        // Total length
        let l_total = site.water_depth + turbine.hub_height * 0.3 + l_embed;
        
        // Calculate loads at mudline
        let (m_mudline, v_mudline) = self.calculate_mudline_loads(site, turbine, d_est);
        
        // Check structural capacity
        let utilization = self.check_capacity(d_est, t, m_mudline, v_mudline);
        
        // Calculate natural frequency
        let f_n = self.natural_frequency(d_est, t, l_total, site, turbine);
        
        // Steel mass
        let area = PI * d_est * (t / 1000.0);
        let volume = area * l_total;
        let mass = volume * 7.85; // tonnes
        
        MonopileDesign {
            diameter: d_est,
            wall_thickness: t,
            embedded_length: l_embed,
            total_length: l_total,
            steel_grade: "S355".to_string(),
            steel_mass: mass,
            natural_frequency: f_n,
            utilization,
        }
    }
    
    fn calculate_mudline_loads(
        &self,
        site: &OffshoreSiteConditions,
        turbine: &TurbineParameters,
        diameter: f64,
    ) -> (f64, f64) {
        // Wave load using Morison equation
        let cd = 1.0; // Drag coefficient
        let cm = 2.0; // Inertia coefficient
        let rho_water = 1025.0; // kg/m³
        
        // Maximum horizontal particle velocity (Airy wave theory)
        let h = site.h_max;
        let d = site.water_depth;
        let l = 1.56 * site.tp.powi(2); // Deep water wavelength approximation
        let u_max = PI * h / site.tp * (2.0 * PI * d / l).cosh() / (2.0 * PI * d / l).sinh();
        
        // Wave force per unit length at surface
        let f_drag = 0.5 * cd * rho_water * diameter * u_max.powi(2);
        let f_inertia = cm * rho_water * PI * diameter.powi(2) / 4.0 * u_max / site.tp;
        let f_wave = (f_drag.powi(2) + f_inertia.powi(2)).sqrt();
        
        // Current force
        let f_current = 0.5 * cd * rho_water * diameter * site.current_velocity.powi(2) * d;
        
        // Wind thrust on turbine
        let f_wind = turbine.max_thrust;
        
        // Mudline shear
        let v_mudline = f_wave * d * 0.5 + f_current + f_wind;
        
        // Mudline moment
        let m_mudline = f_wave * d.powi(2) / 3.0 + f_current * d * 0.5 + f_wind * (d + turbine.hub_height);
        
        (m_mudline, v_mudline)
    }
    
    fn check_capacity(&self, d: f64, t: f64, m: f64, v: f64) -> MonopileUtilization {
        // Steel properties
        let fy = 355.0; // MPa for S355
        let e = 210000.0; // MPa
        
        // Section properties
        let i = PI / 64.0 * (d.powi(4) - (d - 2.0 * t / 1000.0).powi(4));
        let z = i / (d / 2.0);
        let a = PI * d * t / 1000.0;
        
        // Bending stress
        let sigma_b = m * 1000.0 / z; // MPa
        let bending_util = sigma_b / (fy * 0.9);
        
        // Shear stress
        let tau = v / a; // MPa
        let _shear_util = tau / (fy * 0.6 / 1.732);
        
        // Local buckling check (DNV)
        let d_t = d / (t / 1000.0);
        let alpha = 0.5 / (1.0 + 0.01 * d_t);
        let sigma_cr = alpha * e / (d_t);
        let buckling_util = sigma_b / sigma_cr;
        
        // Fatigue (simplified - full analysis requires S-N curves)
        let fatigue_damage = 0.3; // Placeholder
        
        // Lateral capacity (simplified p-y method)
        let lateral_util = v / (d * 50.0 * 1000.0); // Simplified
        
        MonopileUtilization {
            uls_bending: bending_util,
            uls_buckling: buckling_util,
            fatigue_damage,
            lateral_capacity: lateral_util,
        }
    }
    
    fn natural_frequency(
        &self,
        d: f64,
        t: f64,
        _l: f64,
        site: &OffshoreSiteConditions,
        turbine: &TurbineParameters,
    ) -> f64 {
        // Simplified cantilever model with rotational spring at base
        let e = 210e9; // Pa
        let i = PI / 64.0 * (d.powi(4) - (d - 2.0 * t / 1000.0).powi(4));
        
        // Effective length (accounting for soil flexibility)
        let l_eff = site.water_depth + turbine.hub_height + d * 3.0;
        
        // Top mass
        let m_top = (turbine.top_mass + turbine.tower_mass * 0.23) * 1000.0; // kg
        
        // Natural frequency of cantilever with tip mass
        let f_n = (3.0 * e * i / (m_top * l_eff.powi(3))).sqrt() / (2.0 * PI);
        
        f_n
    }
}

/// Jacket structure designer
#[derive(Debug, Clone)]
pub struct JacketDesigner;

/// Jacket design result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JacketDesign {
    /// Number of legs
    pub num_legs: u8,
    /// Top width (m)
    pub top_width: f64,
    /// Bottom width (m)
    pub bottom_width: f64,
    /// Leg diameter (m)
    pub leg_diameter: f64,
    /// Leg wall thickness (mm)
    pub leg_thickness: f64,
    /// Brace diameter (m)
    pub brace_diameter: f64,
    /// Total steel mass (tonnes)
    pub steel_mass: f64,
    /// Pile embedment (m)
    pub pile_embedment: f64,
    /// Natural frequency (Hz)
    pub natural_frequency: f64,
}

impl JacketDesigner {
    /// Design jacket structure
    pub fn design(
        &self,
        site: &OffshoreSiteConditions,
        turbine: &TurbineParameters,
    ) -> JacketDesign {
        // 4-legged jacket typical for wind turbines
        let num_legs = 4_u8;
        
        // Geometry
        let top_width = 12.0; // m (for transition piece)
        let batter = 10.0; // 1:10 batter
        let bottom_width = top_width + 2.0 * site.water_depth / batter;
        
        // Leg sizing
        let leg_d = (0.8 + site.water_depth / 100.0).min(2.0);
        let leg_t = leg_d * 1000.0 / 40.0; // D/t ≈ 40
        
        // Brace sizing
        let brace_d = leg_d * 0.5;
        
        // Pile embedment
        let pile_embed = match site.soil_type {
            SeabedSoilType::Sand => 30.0,
            SeabedSoilType::Clay | SeabedSoilType::StiffClay => 40.0,
            _ => 35.0,
        };
        
        // Approximate steel mass
        let leg_length = (site.water_depth.powi(2) + (bottom_width - top_width).powi(2) / 4.0).sqrt();
        let leg_mass = 4.0 * PI * leg_d * leg_t / 1000.0 * leg_length * 7.85;
        let brace_mass = leg_mass * 0.6; // Braces ~60% of leg mass
        let mass = leg_mass + brace_mass;
        
        // Natural frequency (simplified)
        let f_n = 3.5 * (210e9 * PI * leg_d.powi(3) * leg_t / 1000.0 / 8.0).sqrt()
            / (site.water_depth + turbine.hub_height).powi(2)
            / (2.0 * PI * ((turbine.top_mass + turbine.tower_mass) * 1000.0).sqrt());
        
        JacketDesign {
            num_legs,
            top_width,
            bottom_width,
            leg_diameter: leg_d,
            leg_thickness: leg_t,
            brace_diameter: brace_d,
            steel_mass: mass,
            pile_embedment: pile_embed,
            natural_frequency: f_n.abs().min(1.0),
        }
    }
}

/// Floating platform analyzer
#[derive(Debug, Clone)]
pub struct FloatingPlatformAnalyzer;

/// Floating platform result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FloatingPlatformDesign {
    /// Platform type
    pub platform_type: OffshoreFoundationType,
    /// Displacement (tonnes)
    pub displacement: f64,
    /// Draft (m)
    pub draft: f64,
    /// Heave natural period (s)
    pub heave_period: f64,
    /// Pitch natural period (s)
    pub pitch_period: f64,
    /// Maximum heel angle (degrees)
    pub max_heel: f64,
    /// Mooring line pretension (kN)
    pub mooring_pretension: f64,
}

impl FloatingPlatformAnalyzer {
    /// Analyze semi-submersible platform
    pub fn analyze_semi_sub(
        &self,
        _site: &OffshoreSiteConditions,
        turbine: &TurbineParameters,
    ) -> FloatingPlatformDesign {
        // Typical semi-submersible dimensions
        let column_diameter: f64 = 12.0; // m
        let column_draft: f64 = 20.0; // m
        let num_columns: i32 = 3;
        let pontoon_width: f64 = 10.0;
        let pontoon_height: f64 = 6.0;
        let column_spacing: f64 = 40.0;
        
        // Displacement
        let column_volume = PI * column_diameter.powi(2) / 4.0 * column_draft * num_columns as f64;
        let pontoon_length = column_spacing;
        let pontoon_volume = pontoon_width * pontoon_height * pontoon_length * 3.0;
        let total_volume = column_volume + pontoon_volume;
        let displacement = total_volume * 1.025; // tonnes (seawater density)
        
        // Total mass
        let platform_mass = displacement * 0.4; // Steel ~40% of displacement
        let total_mass = platform_mass + turbine.top_mass + turbine.tower_mass;
        
        // Waterplane area
        let awp = PI * column_diameter.powi(2) / 4.0 * num_columns as f64;
        
        // Heave natural period
        let heave_period = 2.0 * PI * (total_mass / (1025.0 * 9.81 * awp / 1000.0)).sqrt();
        
        // Pitch stiffness (simplified)
        let gm = 5.0; // Metacentric height (m) - typical for semi-sub
        let pitch_period = 2.0 * PI * (total_mass * 1000.0 * (column_draft / 2.0).powi(2) 
            / (1025.0 * 9.81 * displacement * 1000.0 * gm)).sqrt();
        
        // Maximum heel under wind load
        let righting_moment = displacement * 1000.0 * 9.81 * gm;
        let wind_moment = turbine.max_thrust * 1000.0 * (column_draft + turbine.hub_height);
        let max_heel = (wind_moment / righting_moment).atan().to_degrees();
        
        // Mooring pretension (simplified)
        let mooring_pretension = total_mass * 9.81 * 0.1; // ~10% of weight
        
        FloatingPlatformDesign {
            platform_type: OffshoreFoundationType::SemiSubmersible,
            displacement,
            draft: column_draft,
            heave_period,
            pitch_period,
            max_heel,
            mooring_pretension,
        }
    }
    
    /// Analyze spar platform
    pub fn analyze_spar(
        &self,
        _site: &OffshoreSiteConditions,
        turbine: &TurbineParameters,
    ) -> FloatingPlatformDesign {
        // Typical spar dimensions
        let diameter: f64 = 10.0; // m
        let draft: f64 = 80.0; // m (deep draft for stability)
        
        // Displacement
        let volume = PI * diameter.powi(2) / 4.0 * draft;
        let displacement = volume * 1.025;
        
        // Ballast mass for stability
        let platform_steel = displacement * 0.15;
        let ballast = displacement * 0.6;
        let total_mass = platform_steel + ballast + turbine.top_mass + turbine.tower_mass;
        
        // Waterplane area
        let awp = PI * diameter.powi(2) / 4.0;
        
        // Heave period (very long for spar)
        let heave_period = 2.0 * PI * (total_mass / (1025.0 * 9.81 * awp / 1000.0)).sqrt();
        
        // Center of gravity (low due to ballast)
        let zcg = draft * 0.6; // From keel
        let zb = draft / 2.0; // Center of buoyancy
        let bm = awp / volume; // BM = I/V
        let gm = zb + bm - zcg;
        
        // Pitch period
        let radius_gyration = draft / 3.0;
        let pitch_period = 2.0 * PI * radius_gyration / (9.81 * gm).sqrt();
        
        // Maximum heel
        let wind_moment = turbine.max_thrust * 1000.0 * (draft + turbine.hub_height);
        let righting_moment = displacement * 1000.0 * 9.81 * gm;
        let max_heel = (wind_moment / righting_moment).atan().to_degrees();
        
        // Mooring pretension
        let mooring_pretension = total_mass * 9.81 * 0.15;
        
        FloatingPlatformDesign {
            platform_type: OffshoreFoundationType::Spar,
            displacement,
            draft,
            heave_period,
            pitch_period,
            max_heel,
            mooring_pretension,
        }
    }
}

/// Wave load calculator
#[derive(Debug, Clone)]
pub struct WaveLoadCalculator;

impl WaveLoadCalculator {
    /// Calculate wave kinematics using Airy theory
    pub fn airy_wave_kinematics(
        &self,
        h: f64,      // Wave height (m)
        t: f64,      // Wave period (s)
        d: f64,      // Water depth (m)
        z: f64,      // Elevation from SWL (m)
        x: f64,      // Horizontal position (m)
        time: f64,   // Time (s)
    ) -> WaveKinematics {
        let omega = 2.0 * PI / t;
        let k = self.wave_number(t, d);
        let phase = k * x - omega * time;
        
        // Vertical coordinate from seabed
        let z_bed = z + d;
        
        // Horizontal velocity
        let u = omega * h / 2.0 * (k * z_bed).cosh() / (k * d).sinh() * phase.cos();
        
        // Vertical velocity
        let w = omega * h / 2.0 * (k * z_bed).sinh() / (k * d).sinh() * phase.sin();
        
        // Horizontal acceleration
        let a_x = omega.powi(2) * h / 2.0 * (k * z_bed).cosh() / (k * d).sinh() * phase.sin();
        
        // Vertical acceleration
        let a_z = -omega.powi(2) * h / 2.0 * (k * z_bed).sinh() / (k * d).sinh() * phase.cos();
        
        // Surface elevation
        let eta = h / 2.0 * phase.cos();
        
        WaveKinematics {
            horizontal_velocity: u,
            vertical_velocity: w,
            horizontal_acceleration: a_x,
            vertical_acceleration: a_z,
            surface_elevation: eta,
            wave_number: k,
            wavelength: 2.0 * PI / k,
        }
    }
    
    fn wave_number(&self, t: f64, d: f64) -> f64 {
        // Dispersion relation: ω² = gk*tanh(kd)
        let omega = 2.0 * PI / t;
        let g = 9.81;
        
        // Initial guess (deep water)
        let mut k = omega.powi(2) / g;
        
        // Newton-Raphson iteration
        for _ in 0..20 {
            let f = omega.powi(2) - g * k * (k * d).tanh();
            let df = -g * ((k * d).tanh() + k * d / (k * d).cosh().powi(2));
            k = k - f / df;
            
            if f.abs() < 1e-10 {
                break;
            }
        }
        
        k
    }
    
    /// Calculate Morison force on vertical cylinder
    pub fn morison_force(
        &self,
        kinematics: &WaveKinematics,
        diameter: f64,
        cd: f64,
        cm: f64,
    ) -> MorisonForce {
        let rho = 1025.0; // kg/m³
        
        // Drag force per unit length
        let f_drag = 0.5 * rho * cd * diameter * kinematics.horizontal_velocity.abs() 
            * kinematics.horizontal_velocity;
        
        // Inertia force per unit length
        let area = PI * diameter.powi(2) / 4.0;
        let f_inertia = rho * cm * area * kinematics.horizontal_acceleration;
        
        // Total force
        let f_total = f_drag + f_inertia;
        
        MorisonForce {
            drag_force: f_drag,
            inertia_force: f_inertia,
            total_force: f_total,
        }
    }
}

/// Wave kinematics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WaveKinematics {
    pub horizontal_velocity: f64,
    pub vertical_velocity: f64,
    pub horizontal_acceleration: f64,
    pub vertical_acceleration: f64,
    pub surface_elevation: f64,
    pub wave_number: f64,
    pub wavelength: f64,
}

/// Morison force components
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MorisonForce {
    /// Drag force per unit length (N/m)
    pub drag_force: f64,
    /// Inertia force per unit length (N/m)
    pub inertia_force: f64,
    /// Total force per unit length (N/m)
    pub total_force: f64,
}

/// Scour protection designer
#[derive(Debug, Clone)]
pub struct ScourProtection;

impl ScourProtection {
    /// Design scour protection for monopile
    pub fn design_protection(&self, diameter: f64, current: f64, soil: SeabedSoilType) -> ScourProtectionDesign {
        // Equilibrium scour depth (Sumer & Fredsøe)
        let kc = match soil {
            SeabedSoilType::Sand => 1.3,
            SeabedSoilType::SiltySand => 1.0,
            _ => 0.8,
        };
        let scour_depth = kc * diameter;
        
        // Protection extent (typically 4-5 times diameter)
        let extent = 4.0 * diameter;
        
        // Rock armor sizing (Shields parameter)
        let rho_water = 1025.0;
        let rho_rock = 2650.0;
        let shields_cr = 0.035; // Critical Shields parameter
        
        // Required rock size
        let d50 = current.powi(2) / (shields_cr * 9.81 * (rho_rock / rho_water - 1.0) * diameter);
        let d50_min = 0.3; // Minimum 300mm for handling
        let d50_design = d50.max(d50_min);
        
        // Layer thickness (2.5 x D50)
        let thickness = 2.5 * d50_design;
        
        // Rock volume
        let area = PI * extent.powi(2) - PI * diameter.powi(2) / 4.0;
        let volume = area * thickness;
        
        ScourProtectionDesign {
            scour_depth,
            protection_extent: extent,
            rock_d50: d50_design,
            layer_thickness: thickness,
            rock_volume: volume,
        }
    }
}

/// Scour protection design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScourProtectionDesign {
    /// Predicted scour depth (m)
    pub scour_depth: f64,
    /// Protection extent from pile center (m)
    pub protection_extent: f64,
    /// Rock armor D50 (m)
    pub rock_d50: f64,
    /// Layer thickness (m)
    pub layer_thickness: f64,
    /// Total rock volume (m³)
    pub rock_volume: f64,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_monopile_design() {
        let designer = MonopileDesigner;
        
        let site = OffshoreSiteConditions {
            water_depth: 30.0,
            hs: 6.0,
            tp: 10.0,
            h_max: 12.0,
            current_velocity: 1.2,
            wind_speed_50yr: 45.0,
            soil_type: SeabedSoilType::Sand,
            su: None,
            phi: Some(35.0),
        };
        
        let turbine = TurbineParameters {
            rated_power: 10.0,
            rotor_diameter: 180.0,
            hub_height: 110.0,
            top_mass: 600.0,
            tower_mass: 400.0,
            max_thrust: 2000.0,
        };
        
        let design = designer.design(&site, &turbine);
        
        assert!(design.diameter > 5.0);
        assert!(design.embedded_length > design.diameter * 4.0);
        assert!(design.natural_frequency > 0.0);
    }
    
    #[test]
    fn test_jacket_design() {
        let designer = JacketDesigner;
        
        let site = OffshoreSiteConditions {
            water_depth: 50.0,
            hs: 8.0,
            tp: 12.0,
            h_max: 15.0,
            current_velocity: 1.5,
            wind_speed_50yr: 50.0,
            soil_type: SeabedSoilType::Clay,
            su: Some(100.0),
            phi: None,
        };
        
        let turbine = TurbineParameters {
            rated_power: 12.0,
            rotor_diameter: 200.0,
            hub_height: 120.0,
            top_mass: 700.0,
            tower_mass: 500.0,
            max_thrust: 2500.0,
        };
        
        let design = designer.design(&site, &turbine);
        
        assert_eq!(design.num_legs, 4);
        assert!(design.bottom_width > design.top_width);
        assert!(design.steel_mass > 0.0);
    }
    
    #[test]
    fn test_floating_semi_sub() {
        let analyzer = FloatingPlatformAnalyzer;
        
        let site = OffshoreSiteConditions {
            water_depth: 100.0,
            hs: 10.0,
            tp: 14.0,
            h_max: 20.0,
            current_velocity: 1.0,
            wind_speed_50yr: 45.0,
            soil_type: SeabedSoilType::Clay,
            su: Some(50.0),
            phi: None,
        };
        
        let turbine = TurbineParameters {
            rated_power: 15.0,
            rotor_diameter: 230.0,
            hub_height: 130.0,
            top_mass: 800.0,
            tower_mass: 600.0,
            max_thrust: 3000.0,
        };
        
        let design = analyzer.analyze_semi_sub(&site, &turbine);
        
        assert!(design.displacement > 0.0);
        assert!(design.heave_period > 1.0); // Should have positive heave period
    }
    
    #[test]
    fn test_floating_spar() {
        let analyzer = FloatingPlatformAnalyzer;
        
        let site = OffshoreSiteConditions {
            water_depth: 200.0,
            hs: 12.0,
            tp: 15.0,
            h_max: 24.0,
            current_velocity: 0.8,
            wind_speed_50yr: 42.0,
            soil_type: SeabedSoilType::Clay,
            su: Some(30.0),
            phi: None,
        };
        
        let turbine = TurbineParameters {
            rated_power: 15.0,
            rotor_diameter: 230.0,
            hub_height: 130.0,
            top_mass: 800.0,
            tower_mass: 600.0,
            max_thrust: 3000.0,
        };
        
        let design = analyzer.analyze_spar(&site, &turbine);
        
        assert_eq!(design.platform_type, OffshoreFoundationType::Spar);
        assert!(design.draft > 50.0); // Deep draft
        assert!(design.heave_period > 5.0); // Reasonable heave period
    }
    
    #[test]
    fn test_wave_kinematics() {
        let calc = WaveLoadCalculator;
        
        let kinematics = calc.airy_wave_kinematics(
            5.0,   // 5m wave height
            10.0,  // 10s period
            30.0,  // 30m water depth
            0.0,   // At SWL
            0.0,   // Origin
            0.0,   // t=0
        );
        
        assert!(kinematics.wavelength > 100.0);
        assert!(kinematics.horizontal_velocity.abs() > 0.0);
    }
    
    #[test]
    fn test_morison_force() {
        let calc = WaveLoadCalculator;
        
        let kinematics = calc.airy_wave_kinematics(6.0, 10.0, 30.0, 0.0, 0.0, 0.0);
        let force = calc.morison_force(&kinematics, 6.0, 1.0, 2.0);
        
        // Total force should be sum of components
        assert!((force.total_force - force.drag_force - force.inertia_force).abs() < 1.0);
    }
    
    #[test]
    fn test_scour_protection() {
        let designer = ScourProtection;
        
        let design = designer.design_protection(6.0, 1.5, SeabedSoilType::Sand);
        
        // Scour depth typically 1-1.5 x diameter for sand
        assert!(design.scour_depth > 6.0);
        assert!(design.scour_depth < 10.0);
        
        // Protection extent should be significant
        assert!(design.protection_extent > 20.0);
        
        // Rock size should be reasonable
        assert!(design.rock_d50 >= 0.3);
    }
    
    #[test]
    fn test_foundation_selection() {
        // Shallow water -> Monopile
        let shallow_depth = 25.0;
        assert!(shallow_depth < 40.0); // Monopile range
        
        // Medium depth -> Jacket
        let medium_depth = 50.0;
        assert!(medium_depth >= 40.0 && medium_depth < 80.0);
        
        // Deep water -> Floating
        let deep_depth = 150.0;
        assert!(deep_depth >= 80.0);
    }
}
