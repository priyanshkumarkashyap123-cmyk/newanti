//! Adaptive Facades Module
//! 
//! Implements adaptive and responsive building envelope systems:
//! - Climate-responsive facades
//! - Kinetic architecture
//! - Dynamic shading systems
//! - Smart glazing control
//! - Thermal performance optimization

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// FACADE TYPES
// ============================================================================

/// Adaptive facade type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum FacadeType {
    /// Double-skin facade
    DoubleSkin,
    /// Kinetic louvers
    KineticLouvers,
    /// Electrochromic glazing
    ElectrochromicGlazing,
    /// Thermochromic glazing
    ThermochromicGlazing,
    /// Photochromic glazing
    PhotochromicGlazing,
    /// Deployable shading
    DeployableShading,
    /// Rotating panels
    RotatingPanels,
    /// Pneumatic ETFE
    PneumaticETFE,
    /// Phase change material (PCM)
    PhaseChangeMaterial,
    /// Green/living wall
    GreenWall,
}

impl FacadeType {
    /// Typical U-value range (W/m²K)
    pub fn u_value_range(&self) -> (f64, f64) {
        match self {
            Self::DoubleSkin => (0.8, 1.5),
            Self::KineticLouvers => (1.5, 3.0),
            Self::ElectrochromicGlazing => (1.0, 1.6),
            Self::ThermochromicGlazing => (1.0, 1.8),
            Self::PhotochromicGlazing => (1.0, 1.6),
            Self::DeployableShading => (1.2, 2.5),
            Self::RotatingPanels => (0.6, 1.2),
            Self::PneumaticETFE => (1.5, 2.5),
            Self::PhaseChangeMaterial => (0.15, 0.3),
            Self::GreenWall => (0.3, 0.6),
        }
    }
    
    /// Typical SHGC range (Solar Heat Gain Coefficient)
    pub fn shgc_range(&self) -> (f64, f64) {
        match self {
            Self::DoubleSkin => (0.2, 0.5),
            Self::KineticLouvers => (0.05, 0.6),
            Self::ElectrochromicGlazing => (0.09, 0.50),
            Self::ThermochromicGlazing => (0.15, 0.45),
            Self::PhotochromicGlazing => (0.15, 0.50),
            Self::DeployableShading => (0.1, 0.7),
            Self::RotatingPanels => (0.0, 0.8),
            Self::PneumaticETFE => (0.3, 0.8),
            Self::PhaseChangeMaterial => (0.2, 0.4),
            Self::GreenWall => (0.1, 0.3),
        }
    }
    
    /// Response time (seconds)
    pub fn response_time(&self) -> f64 {
        match self {
            Self::DoubleSkin => 60.0,     // Mechanical ventilation
            Self::KineticLouvers => 30.0,
            Self::ElectrochromicGlazing => 300.0,  // 5 minutes
            Self::ThermochromicGlazing => 600.0,   // Passive
            Self::PhotochromicGlazing => 60.0,     // Passive
            Self::DeployableShading => 60.0,
            Self::RotatingPanels => 120.0,
            Self::PneumaticETFE => 300.0,
            Self::PhaseChangeMaterial => 3600.0,   // Thermal mass
            Self::GreenWall => 86400.0,            // Daily/seasonal
        }
    }
}

// ============================================================================
// GLAZING SYSTEMS
// ============================================================================

/// Electrochromic glazing parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElectrochromicGlazing {
    /// Clear state visible transmittance
    pub vt_clear: f64,
    /// Tinted state visible transmittance
    pub vt_tinted: f64,
    /// Clear state SHGC
    pub shgc_clear: f64,
    /// Tinted state SHGC
    pub shgc_tinted: f64,
    /// Current tint level (0-1)
    pub tint_level: f64,
    /// Transition time (s)
    pub transition_time: f64,
    /// Power consumption (W/m²)
    pub power_consumption: f64,
    /// Cycle life (cycles)
    pub cycle_life: usize,
}

impl ElectrochromicGlazing {
    /// Create typical electrochromic glazing
    pub fn typical() -> Self {
        Self {
            vt_clear: 0.60,
            vt_tinted: 0.02,
            shgc_clear: 0.41,
            shgc_tinted: 0.09,
            tint_level: 0.0,
            transition_time: 300.0,
            power_consumption: 0.5,
            cycle_life: 100_000,
        }
    }
    
    /// Current visible transmittance
    pub fn current_vt(&self) -> f64 {
        self.vt_clear + self.tint_level * (self.vt_tinted - self.vt_clear)
    }
    
    /// Current SHGC
    pub fn current_shgc(&self) -> f64 {
        self.shgc_clear + self.tint_level * (self.shgc_tinted - self.shgc_clear)
    }
    
    /// Set tint level
    pub fn set_tint(&mut self, level: f64) {
        self.tint_level = level.clamp(0.0, 1.0);
    }
    
    /// Automatic tint control based on solar radiation
    pub fn auto_control(&mut self, solar_radiation: f64, target_illuminance: f64) -> f64 {
        // Simple control: higher radiation = more tinting
        let target_vt = if solar_radiation > 0.0 {
            target_illuminance / (solar_radiation * 100.0) // Approximate
        } else {
            1.0
        };
        
        // Find tint level for target VT
        if target_vt >= self.vt_clear {
            self.tint_level = 0.0;
        } else if target_vt <= self.vt_tinted {
            self.tint_level = 1.0;
        } else {
            self.tint_level = (self.vt_clear - target_vt) / (self.vt_clear - self.vt_tinted);
        }
        
        self.tint_level
    }
}

/// Thermochromic glazing parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThermochromicGlazing {
    /// Transition temperature (°C)
    pub transition_temp: f64,
    /// Transition width (°C)
    pub transition_width: f64,
    /// Cold state visible transmittance
    pub vt_cold: f64,
    /// Hot state visible transmittance
    pub vt_hot: f64,
    /// Cold state SHGC
    pub shgc_cold: f64,
    /// Hot state SHGC
    pub shgc_hot: f64,
}

impl ThermochromicGlazing {
    /// Create vanadium dioxide based glazing
    pub fn vo2_based() -> Self {
        Self {
            transition_temp: 68.0, // °C
            transition_width: 10.0,
            vt_cold: 0.55,
            vt_hot: 0.40,
            shgc_cold: 0.45,
            shgc_hot: 0.25,
        }
    }
    
    /// Current state based on temperature
    pub fn state_at_temp(&self, temp: f64) -> f64 {
        // Sigmoid transition
        let x = (temp - self.transition_temp) / self.transition_width;
        1.0 / (1.0 + (-x * 5.0).exp())
    }
    
    /// Current visible transmittance
    pub fn vt_at_temp(&self, temp: f64) -> f64 {
        let state = self.state_at_temp(temp);
        self.vt_cold + state * (self.vt_hot - self.vt_cold)
    }
    
    /// Current SHGC
    pub fn shgc_at_temp(&self, temp: f64) -> f64 {
        let state = self.state_at_temp(temp);
        self.shgc_cold + state * (self.shgc_hot - self.shgc_cold)
    }
}

// ============================================================================
// KINETIC SYSTEMS
// ============================================================================

/// Louver orientation
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum LouverOrientation {
    /// Horizontal slats
    Horizontal,
    /// Vertical slats
    Vertical,
    /// Diagonal
    Diagonal,
}

/// Kinetic louver system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KineticLouvers {
    /// Louver orientation
    pub orientation: LouverOrientation,
    /// Louver width (mm)
    pub width: f64,
    /// Louver spacing (mm)
    pub spacing: f64,
    /// Current angle (degrees, 0 = closed, 90 = open)
    pub angle: f64,
    /// Maximum angle
    pub max_angle: f64,
    /// Rotation speed (degrees/s)
    pub rotation_speed: f64,
    /// Reflectivity
    pub reflectivity: f64,
}

impl KineticLouvers {
    /// Create typical horizontal louvers
    pub fn horizontal(width: f64, spacing: f64) -> Self {
        Self {
            orientation: LouverOrientation::Horizontal,
            width,
            spacing,
            angle: 45.0,
            max_angle: 90.0,
            rotation_speed: 5.0,
            reflectivity: 0.7,
        }
    }
    
    /// Calculate shading coefficient
    pub fn shading_coefficient(&self) -> f64 {
        let angle_rad = self.angle * PI / 180.0;
        
        // Simplified: more closed = more shading
        let open_fraction = angle_rad.sin();
        
        // Account for louver geometry
        let coverage = self.width / self.spacing;
        let effective_open = open_fraction * (1.0 - coverage * (1.0 - angle_rad.cos()));
        
        effective_open.clamp(0.0, 1.0)
    }
    
    /// Calculate SHGC with louvers
    pub fn effective_shgc(&self, glass_shgc: f64) -> f64 {
        let sc = self.shading_coefficient();
        glass_shgc * sc
    }
    
    /// Solar tracking - optimal angle for sun position
    pub fn solar_tracking(&mut self, solar_altitude: f64, solar_azimuth: f64, facade_azimuth: f64) {
        match self.orientation {
            LouverOrientation::Horizontal => {
                // Track solar altitude
                self.angle = (90.0 - solar_altitude).clamp(0.0, self.max_angle);
            }
            LouverOrientation::Vertical => {
                // Track solar azimuth relative to facade
                let relative_azimuth = (solar_azimuth - facade_azimuth).abs();
                self.angle = (90.0 - relative_azimuth).clamp(0.0, self.max_angle);
            }
            LouverOrientation::Diagonal => {
                // Combination
                let alt_factor = (90.0 - solar_altitude) / 90.0;
                let azm_factor = ((solar_azimuth - facade_azimuth).abs() / 90.0).min(1.0);
                self.angle = (alt_factor * 0.5 + azm_factor * 0.5) * self.max_angle;
            }
        }
    }
    
    /// Set angle with speed limit
    pub fn set_angle(&mut self, target: f64, dt: f64) {
        let target = target.clamp(0.0, self.max_angle);
        let max_change = self.rotation_speed * dt;
        let change = (target - self.angle).clamp(-max_change, max_change);
        self.angle += change;
    }
    
    /// Daylight transmission
    pub fn daylight_factor(&self) -> f64 {
        self.shading_coefficient() * 0.9 // Account for frame and reflections
    }
}

// ============================================================================
// DOUBLE-SKIN FACADE
// ============================================================================

/// Double-skin facade ventilation mode
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum VentilationMode {
    /// Closed (buffer zone)
    Closed,
    /// Natural ventilation
    Natural,
    /// Mechanical ventilation
    Mechanical,
    /// Exhaust air
    ExhaustAir,
    /// Supply air
    SupplyAir,
}

/// Double-skin facade
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DoubleSkinFacade {
    /// Outer skin U-value (W/m²K)
    pub outer_u: f64,
    /// Inner skin U-value (W/m²K)
    pub inner_u: f64,
    /// Cavity width (mm)
    pub cavity_width: f64,
    /// Current ventilation mode
    pub ventilation_mode: VentilationMode,
    /// Cavity air temperature (°C)
    pub cavity_temp: f64,
    /// Air flow rate (m³/s per m width)
    pub air_flow: f64,
    /// Has blinds in cavity
    pub has_blinds: bool,
    /// Blind position (0 = up, 1 = down)
    pub blind_position: f64,
}

impl DoubleSkinFacade {
    /// Create typical DSF
    pub fn typical() -> Self {
        Self {
            outer_u: 5.7, // Single glazing
            inner_u: 1.1, // Double glazing
            cavity_width: 600.0,
            ventilation_mode: VentilationMode::Natural,
            cavity_temp: 20.0,
            air_flow: 0.01,
            has_blinds: true,
            blind_position: 0.0,
        }
    }
    
    /// Effective U-value
    pub fn effective_u(&self) -> f64 {
        match self.ventilation_mode {
            VentilationMode::Closed => {
                // Series resistance
                1.0 / (1.0 / self.outer_u + 0.15 + 1.0 / self.inner_u)
            }
            VentilationMode::Natural | VentilationMode::Mechanical => {
                // Ventilated cavity reduces thermal resistance
                let ventilation_factor = 1.0 + self.air_flow * 10.0;
                (1.0 / (1.0 / self.outer_u + 0.1 + 1.0 / self.inner_u)) * ventilation_factor
            }
            VentilationMode::ExhaustAir => {
                // Heat recovery benefit
                self.inner_u * 0.7
            }
            VentilationMode::SupplyAir => {
                // Preheating benefit
                self.inner_u * 0.8
            }
        }
    }
    
    /// Effective SHGC
    pub fn effective_shgc(&self, outer_shgc: f64, inner_shgc: f64) -> f64 {
        let blind_factor = if self.has_blinds {
            1.0 - 0.7 * self.blind_position
        } else {
            1.0
        };
        
        let vent_factor = match self.ventilation_mode {
            VentilationMode::Closed => 1.0,
            VentilationMode::Natural => 0.9,
            VentilationMode::Mechanical => 0.85,
            _ => 0.9,
        };
        
        outer_shgc * inner_shgc * blind_factor * vent_factor
    }
    
    /// Calculate cavity temperature
    pub fn calculate_cavity_temp(
        &mut self,
        outdoor_temp: f64,
        indoor_temp: f64,
        solar_radiation: f64,
    ) {
        // Simplified cavity temperature model
        let absorbed_solar = solar_radiation * 0.1; // 10% absorbed
        
        let avg_temp = (outdoor_temp + indoor_temp) / 2.0;
        let solar_rise = absorbed_solar / 10.0; // Approximate
        
        let vent_cooling = match self.ventilation_mode {
            VentilationMode::Closed => 0.0,
            VentilationMode::Natural => self.air_flow * 1000.0 * (self.cavity_temp - outdoor_temp).max(0.0),
            VentilationMode::Mechanical => self.air_flow * 2000.0 * (self.cavity_temp - outdoor_temp).max(0.0),
            _ => self.air_flow * 1500.0 * (self.cavity_temp - outdoor_temp).max(0.0),
        };
        
        self.cavity_temp = avg_temp + solar_rise - vent_cooling / 100.0;
    }
    
    /// Automatic mode selection
    pub fn auto_control(
        &mut self,
        outdoor_temp: f64,
        indoor_temp: f64,
        solar_radiation: f64,
        heating_mode: bool,
    ) {
        if heating_mode {
            if solar_radiation > 200.0 && outdoor_temp > 0.0 {
                self.ventilation_mode = VentilationMode::SupplyAir;
                self.blind_position = 0.0; // Open blinds
            } else {
                self.ventilation_mode = VentilationMode::Closed;
                self.blind_position = 0.0;
            }
        } else {
            // Cooling mode
            if solar_radiation > 300.0 {
                self.ventilation_mode = VentilationMode::Natural;
                self.blind_position = 0.8; // Mostly closed
            } else if outdoor_temp > indoor_temp {
                self.ventilation_mode = VentilationMode::Closed;
                self.blind_position = 0.5;
            } else {
                self.ventilation_mode = VentilationMode::Natural;
                self.blind_position = 0.3;
            }
        }
    }
}

// ============================================================================
// THERMAL PERFORMANCE
// ============================================================================

/// Facade thermal analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThermalAnalysis {
    /// Heat gain through facade (W/m²)
    pub heat_gain: f64,
    /// Heat loss through facade (W/m²)
    pub heat_loss: f64,
    /// Solar heat gain (W/m²)
    pub solar_gain: f64,
    /// Surface temperature (°C)
    pub surface_temp: f64,
    /// Condensation risk
    pub condensation_risk: bool,
}

impl ThermalAnalysis {
    /// Calculate facade thermal performance
    pub fn calculate(
        u_value: f64,
        shgc: f64,
        indoor_temp: f64,
        outdoor_temp: f64,
        solar_radiation: f64,
        indoor_humidity: f64,
    ) -> Self {
        // Conduction heat transfer
        let temp_diff = indoor_temp - outdoor_temp;
        let conduction = u_value * temp_diff;
        
        let (heat_gain, heat_loss) = if temp_diff > 0.0 {
            (0.0, conduction)
        } else {
            (-conduction, 0.0)
        };
        
        // Solar heat gain
        let solar_gain = shgc * solar_radiation;
        
        // Interior surface temperature
        let hi = 8.0; // Interior heat transfer coefficient
        let surface_temp = indoor_temp - (indoor_temp - outdoor_temp) * u_value / hi;
        
        // Condensation risk (simplified)
        let dew_point = indoor_temp - (100.0 - indoor_humidity) / 5.0;
        let condensation_risk = surface_temp < dew_point;
        
        Self {
            heat_gain: heat_gain + solar_gain,
            heat_loss,
            solar_gain,
            surface_temp,
            condensation_risk,
        }
    }
    
    /// Net heat flow (positive = gain)
    pub fn net_heat_flow(&self) -> f64 {
        self.heat_gain - self.heat_loss
    }
    
    /// Cooling load contribution (W/m²)
    pub fn cooling_load(&self) -> f64 {
        (self.heat_gain - self.heat_loss).max(0.0)
    }
    
    /// Heating load contribution (W/m²)
    pub fn heating_load(&self) -> f64 {
        (self.heat_loss - self.heat_gain).max(0.0)
    }
}

// ============================================================================
// DAYLIGHTING
// ============================================================================

/// Daylighting analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaylightingAnalysis {
    /// Work plane illuminance (lux)
    pub illuminance: f64,
    /// Daylight factor (%)
    pub daylight_factor: f64,
    /// Glare index
    pub glare_index: f64,
    /// Visual comfort satisfied
    pub visual_comfort: bool,
    /// Electric lighting supplement needed (%)
    pub lighting_supplement: f64,
}

impl DaylightingAnalysis {
    /// Simple daylight calculation
    pub fn calculate(
        window_area: f64,
        floor_area: f64,
        visible_transmittance: f64,
        external_illuminance: f64,
        room_depth: f64,
        target_illuminance: f64,
    ) -> Self {
        // Window to floor ratio
        let wfr = window_area / floor_area;
        
        // Daylight factor (simplified CIE formula)
        let df = wfr * visible_transmittance * 100.0 * 0.5; // 50% efficiency factor
        
        // Illuminance at work plane
        let illuminance = external_illuminance * df / 100.0;
        
        // Depth factor (illuminance drops with distance)
        let depth_factor = 1.0 - 0.05 * room_depth;
        let avg_illuminance = illuminance * depth_factor.max(0.2);
        
        // Glare index (simplified)
        let luminance_ratio = external_illuminance / avg_illuminance.max(1.0);
        let glare_index = (luminance_ratio / 100.0).log10() * 10.0 + 20.0;
        
        // Visual comfort
        let visual_comfort = avg_illuminance >= target_illuminance * 0.8 && glare_index < 22.0;
        
        // Electric lighting supplement
        let lighting_supplement = if avg_illuminance >= target_illuminance {
            0.0
        } else {
            ((target_illuminance - avg_illuminance) / target_illuminance * 100.0).min(100.0)
        };
        
        Self {
            illuminance: avg_illuminance,
            daylight_factor: df,
            glare_index,
            visual_comfort,
            lighting_supplement,
        }
    }
}

// ============================================================================
// FACADE CONTROL SYSTEM
// ============================================================================

/// Facade control strategy
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ControlStrategy {
    /// Maximize daylight
    MaximizeDaylight,
    /// Minimize solar gain
    MinimizeSolarGain,
    /// Optimize thermal comfort
    ThermalComfort,
    /// Minimize energy
    MinimizeEnergy,
    /// Balanced
    Balanced,
}

/// Facade control system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FacadeController {
    /// Control strategy
    pub strategy: ControlStrategy,
    /// Target illuminance (lux)
    pub target_illuminance: f64,
    /// Target temperature (°C)
    pub target_temperature: f64,
    /// Glare threshold
    pub glare_threshold: f64,
    /// Override active
    pub override_active: bool,
}

impl FacadeController {
    pub fn new(strategy: ControlStrategy) -> Self {
        Self {
            strategy,
            target_illuminance: 500.0,
            target_temperature: 22.0,
            glare_threshold: 22.0,
            override_active: false,
        }
    }
    
    /// Calculate optimal louver angle
    pub fn optimal_louver_angle(
        &self,
        solar_radiation: f64,
        solar_altitude: f64,
        indoor_temp: f64,
        current_illuminance: f64,
    ) -> f64 {
        if self.override_active {
            return 45.0; // Default
        }
        
        match self.strategy {
            ControlStrategy::MaximizeDaylight => {
                // Open as much as possible while avoiding glare
                if solar_altitude > 60.0 {
                    30.0 // Partially close for high sun
                } else {
                    80.0 // Mostly open
                }
            }
            ControlStrategy::MinimizeSolarGain => {
                // Track sun to block direct radiation
                (90.0 - solar_altitude).clamp(10.0, 80.0)
            }
            ControlStrategy::ThermalComfort => {
                let temp_error = indoor_temp - self.target_temperature;
                if temp_error > 1.0 {
                    // Too warm, increase shading
                    (90.0 - solar_altitude).clamp(10.0, 60.0)
                } else if temp_error < -1.0 {
                    // Too cold, allow solar gain
                    70.0
                } else {
                    45.0
                }
            }
            ControlStrategy::MinimizeEnergy => {
                // Balance heating/cooling loads
                let cooling_potential = solar_radiation * 0.5;
                let heating_need = (self.target_temperature - indoor_temp).max(0.0) * 10.0;
                
                if cooling_potential > heating_need {
                    30.0 // More shading
                } else {
                    60.0 // Less shading
                }
            }
            ControlStrategy::Balanced => {
                // Multi-objective optimization
                let daylight_factor = (self.target_illuminance - current_illuminance) / self.target_illuminance;
                let thermal_factor = (indoor_temp - self.target_temperature) / 5.0;
                
                let base_angle = 45.0;
                let adjustment = daylight_factor * 20.0 - thermal_factor * 15.0;
                
                (base_angle + adjustment).clamp(10.0, 80.0)
            }
        }
    }
    
    /// Calculate optimal tint level for electrochromic glazing
    pub fn optimal_tint_level(
        &self,
        solar_radiation: f64,
        current_illuminance: f64,
        indoor_temp: f64,
    ) -> f64 {
        if self.override_active {
            return 0.5;
        }
        
        match self.strategy {
            ControlStrategy::MaximizeDaylight => {
                if current_illuminance > 3000.0 {
                    0.3 // Some tinting to prevent glare
                } else {
                    0.0 // Clear
                }
            }
            ControlStrategy::MinimizeSolarGain => {
                (solar_radiation / 1000.0).clamp(0.0, 1.0)
            }
            ControlStrategy::ThermalComfort => {
                let temp_error = indoor_temp - self.target_temperature;
                ((temp_error / 3.0) + solar_radiation / 2000.0).clamp(0.0, 1.0)
            }
            ControlStrategy::MinimizeEnergy => {
                // Optimize based on HVAC status
                if indoor_temp > self.target_temperature + 1.0 {
                    (solar_radiation / 800.0).clamp(0.0, 1.0)
                } else if indoor_temp < self.target_temperature - 1.0 {
                    0.0
                } else {
                    0.3
                }
            }
            ControlStrategy::Balanced => {
                let illuminance_factor = (current_illuminance / self.target_illuminance - 1.0).max(0.0);
                let thermal_factor = (indoor_temp - self.target_temperature).max(0.0) / 3.0;
                
                (illuminance_factor * 0.5 + thermal_factor * 0.5).clamp(0.0, 1.0)
            }
        }
    }
}

// ============================================================================
// ENERGY PERFORMANCE
// ============================================================================

/// Annual facade energy analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnergyPerformance {
    /// Annual heating load (kWh/m²)
    pub heating_load: f64,
    /// Annual cooling load (kWh/m²)
    pub cooling_load: f64,
    /// Annual lighting energy (kWh/m²)
    pub lighting_energy: f64,
    /// Total energy (kWh/m²)
    pub total_energy: f64,
    /// Energy savings vs baseline (%)
    pub savings: f64,
}

impl EnergyPerformance {
    /// Estimate annual performance
    pub fn estimate(
        u_value: f64,
        shgc: f64,
        daylight_factor: f64,
        hdd: f64,  // Heating degree days
        cdd: f64,  // Cooling degree days
        baseline_u: f64,
        baseline_shgc: f64,
    ) -> Self {
        // Heating load
        let heating_load = u_value * hdd * 24.0 / 1000.0;
        
        // Cooling load (simplified)
        let solar_gain = shgc * 200.0 * cdd / 1000.0; // Approximate
        let conduction_gain = u_value * cdd * 24.0 / 1000.0;
        let cooling_load = (solar_gain + conduction_gain) * 0.5;
        
        // Lighting energy (reduced by daylight)
        let base_lighting = 30.0; // kWh/m² baseline
        let lighting_savings = (daylight_factor / 100.0 * 0.5).min(0.7);
        let lighting_energy = base_lighting * (1.0 - lighting_savings);
        
        let total_energy = heating_load + cooling_load + lighting_energy;
        
        // Baseline comparison
        let baseline_heating = baseline_u * hdd * 24.0 / 1000.0;
        let baseline_cooling = (baseline_shgc * 200.0 * cdd / 1000.0 + baseline_u * cdd * 24.0 / 1000.0) * 0.5;
        let baseline_total = baseline_heating + baseline_cooling + base_lighting;
        
        let savings = (baseline_total - total_energy) / baseline_total * 100.0;
        
        Self {
            heating_load,
            cooling_load,
            lighting_energy,
            total_energy,
            savings,
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
    fn test_facade_type() {
        let ec = FacadeType::ElectrochromicGlazing;
        
        let (shgc_min, shgc_max) = ec.shgc_range();
        assert!(shgc_min < shgc_max);
    }

    #[test]
    fn test_electrochromic_glazing() {
        let mut ec = ElectrochromicGlazing::typical();
        
        assert!(ec.current_vt() == ec.vt_clear);
        
        ec.set_tint(1.0);
        assert!((ec.current_vt() - ec.vt_tinted).abs() < 0.01);
    }

    #[test]
    fn test_electrochromic_auto() {
        let mut ec = ElectrochromicGlazing::typical();
        
        let tint = ec.auto_control(1000.0, 500.0);
        assert!(tint >= 0.0 && tint <= 1.0);
    }

    #[test]
    fn test_thermochromic_glazing() {
        let tc = ThermochromicGlazing::vo2_based();
        
        let vt_cold = tc.vt_at_temp(20.0);
        let vt_hot = tc.vt_at_temp(80.0);
        
        assert!(vt_cold > vt_hot);
    }

    #[test]
    fn test_kinetic_louvers() {
        let mut louvers = KineticLouvers::horizontal(100.0, 150.0);
        
        louvers.angle = 0.0;
        let sc_closed = louvers.shading_coefficient();
        
        louvers.angle = 90.0;
        let sc_open = louvers.shading_coefficient();
        
        assert!(sc_open > sc_closed);
    }

    #[test]
    fn test_louver_tracking() {
        let mut louvers = KineticLouvers::horizontal(100.0, 150.0);
        
        louvers.solar_tracking(60.0, 180.0, 180.0);
        assert!(louvers.angle >= 0.0 && louvers.angle <= 90.0);
    }

    #[test]
    fn test_double_skin_facade() {
        let dsf = DoubleSkinFacade::typical();
        
        let u_eff = dsf.effective_u();
        assert!(u_eff > 0.0);
        assert!(u_eff < dsf.outer_u);
    }

    #[test]
    fn test_dsf_auto_control() {
        let mut dsf = DoubleSkinFacade::typical();
        
        dsf.auto_control(30.0, 24.0, 500.0, false);
        assert!(dsf.blind_position > 0.0);
    }

    #[test]
    fn test_thermal_analysis() {
        let analysis = ThermalAnalysis::calculate(
            1.5,    // U-value
            0.4,    // SHGC
            22.0,   // Indoor temp
            5.0,    // Outdoor temp
            300.0,  // Solar radiation
            50.0,   // Humidity
        );
        
        assert!(analysis.heat_loss > 0.0);
        assert!(analysis.solar_gain > 0.0);
    }

    #[test]
    fn test_daylighting() {
        let daylight = DaylightingAnalysis::calculate(
            4.0,      // Window area
            20.0,     // Floor area
            0.5,      // VT
            10000.0,  // External illuminance
            5.0,      // Room depth
            500.0,    // Target illuminance
        );
        
        assert!(daylight.daylight_factor > 0.0);
        assert!(daylight.illuminance > 0.0);
    }

    #[test]
    fn test_facade_controller() {
        let controller = FacadeController::new(ControlStrategy::Balanced);
        
        let angle = controller.optimal_louver_angle(500.0, 45.0, 24.0, 800.0);
        assert!(angle >= 10.0 && angle <= 80.0);
    }

    #[test]
    fn test_optimal_tint() {
        let controller = FacadeController::new(ControlStrategy::ThermalComfort);
        
        let tint = controller.optimal_tint_level(800.0, 1000.0, 26.0);
        assert!(tint >= 0.0 && tint <= 1.0);
    }

    #[test]
    fn test_energy_performance() {
        let perf = EnergyPerformance::estimate(
            1.0,   // U-value
            0.3,   // SHGC
            3.0,   // Daylight factor
            3000.0, // HDD
            1000.0, // CDD
            2.0,   // Baseline U
            0.5,   // Baseline SHGC
        );
        
        assert!(perf.total_energy > 0.0);
        assert!(perf.savings > 0.0); // Should be better than baseline
    }

    #[test]
    fn test_condensation_risk() {
        let analysis = ThermalAnalysis::calculate(
            3.0,    // Poor U-value
            0.5,    // SHGC
            22.0,   // Indoor temp
            -10.0,  // Cold outdoor
            0.0,    // No sun
            70.0,   // High humidity
        );
        
        // With poor insulation and high humidity, condensation is likely
        assert!(analysis.surface_temp < 22.0);
    }
}
