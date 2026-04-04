//! Building Physics Module
//! 
//! Thermal, hygric, and acoustic analysis for buildings:
//! - Heat transfer (steady-state and transient)
//! - Moisture transport
//! - Thermal bridging
//! - HVAC interaction with structure
//! - Energy performance

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

const PI: f64 = std::f64::consts::PI;

/// Building physics analyzer
#[derive(Debug, Clone)]
pub struct BuildingPhysicsAnalyzer {
    /// Building envelope components
    pub components: Vec<EnvelopeComponent>,
    /// Climate data
    pub climate: ClimateData,
    /// Indoor conditions
    pub indoor: IndoorConditions,
    /// Analysis results
    pub results: Option<PhysicsResults>,
}

/// Envelope component (wall, roof, floor, etc.)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvelopeComponent {
    /// Component ID
    pub id: String,
    /// Component type
    pub component_type: ComponentType,
    /// Area (m²)
    pub area: f64,
    /// Material layers (outside to inside)
    pub layers: Vec<MaterialLayer>,
    /// Thermal bridges
    pub thermal_bridges: Vec<ThermalBridge>,
    /// Orientation (degrees from north, clockwise)
    pub orientation: f64,
    /// Tilt angle from horizontal (degrees)
    pub tilt: f64,
}

/// Component type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ComponentType {
    /// External wall
    ExternalWall,
    /// Internal wall
    InternalWall,
    /// Roof
    Roof,
    /// Ground floor
    GroundFloor,
    /// Intermediate floor
    IntermediateFloor,
    /// Window/Glazing
    Window,
    /// Door
    Door,
}

/// Material layer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaterialLayer {
    /// Material name
    pub name: String,
    /// Thickness (m)
    pub thickness: f64,
    /// Thermal conductivity (W/m·K)
    pub conductivity: f64,
    /// Density (kg/m³)
    pub density: f64,
    /// Specific heat capacity (J/kg·K)
    pub specific_heat: f64,
    /// Water vapor resistance factor (µ)
    pub vapor_resistance_factor: f64,
}

impl MaterialLayer {
    /// Create common material layer
    pub fn concrete(thickness: f64) -> Self {
        Self {
            name: "Concrete".to_string(),
            thickness,
            conductivity: 1.8,
            density: 2400.0,
            specific_heat: 1000.0,
            vapor_resistance_factor: 80.0,
        }
    }
    
    pub fn brick(thickness: f64) -> Self {
        Self {
            name: "Brick".to_string(),
            thickness,
            conductivity: 0.72,
            density: 1800.0,
            specific_heat: 920.0,
            vapor_resistance_factor: 10.0,
        }
    }
    
    pub fn insulation_mineral_wool(thickness: f64) -> Self {
        Self {
            name: "Mineral Wool".to_string(),
            thickness,
            conductivity: 0.035,
            density: 30.0,
            specific_heat: 1030.0,
            vapor_resistance_factor: 1.0,
        }
    }
    
    pub fn insulation_eps(thickness: f64) -> Self {
        Self {
            name: "EPS".to_string(),
            thickness,
            conductivity: 0.038,
            density: 20.0,
            specific_heat: 1450.0,
            vapor_resistance_factor: 50.0,
        }
    }
    
    pub fn gypsum_board(thickness: f64) -> Self {
        Self {
            name: "Gypsum Board".to_string(),
            thickness,
            conductivity: 0.25,
            density: 900.0,
            specific_heat: 1000.0,
            vapor_resistance_factor: 8.0,
        }
    }
    
    pub fn air_gap(thickness: f64) -> Self {
        Self {
            name: "Air Gap".to_string(),
            thickness,
            conductivity: 0.025, // Effective conductivity
            density: 1.2,
            specific_heat: 1005.0,
            vapor_resistance_factor: 1.0,
        }
    }
    
    /// Calculate thermal resistance (m²·K/W)
    pub fn thermal_resistance(&self) -> f64 {
        self.thickness / self.conductivity
    }
    
    /// Calculate vapor resistance (m²·s·Pa/kg)
    pub fn vapor_resistance(&self) -> f64 {
        self.thickness * self.vapor_resistance_factor * 5e9 / 1e12
    }
    
    /// Calculate thermal mass (J/m²·K)
    pub fn thermal_mass(&self) -> f64 {
        self.density * self.specific_heat * self.thickness
    }
}

/// Thermal bridge
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThermalBridge {
    /// Bridge type
    pub bridge_type: ThermalBridgeType,
    /// Linear thermal transmittance (W/m·K)
    pub psi: f64,
    /// Length (m)
    pub length: f64,
    /// Point thermal transmittance (W/K) for point bridges
    pub chi: Option<f64>,
}

/// Thermal bridge type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ThermalBridgeType {
    /// Wall/roof junction
    WallRoof,
    /// Wall/floor junction
    WallFloor,
    /// Wall/wall corner (external)
    CornerExternal,
    /// Wall/wall corner (internal)
    CornerInternal,
    /// Window perimeter
    WindowPerimeter,
    /// Window reveal
    WindowReveal,
    /// Balcony connection
    Balcony,
    /// Column penetration
    Column,
}

/// Climate data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClimateData {
    /// Location name
    pub location: String,
    /// External design temperature (°C)
    pub design_temp_winter: f64,
    /// Summer design temperature (°C)
    pub design_temp_summer: f64,
    /// Monthly mean temperatures (°C)
    pub monthly_temps: [f64; 12],
    /// Monthly mean relative humidity (%)
    pub monthly_rh: [f64; 12],
    /// Heating degree days (K·d)
    pub hdd: f64,
    /// Cooling degree days (K·d)
    pub cdd: f64,
    /// Annual solar radiation (kWh/m²)
    pub solar_radiation: f64,
}

impl Default for ClimateData {
    fn default() -> Self {
        // Default: Central Europe climate
        Self {
            location: "Central Europe".to_string(),
            design_temp_winter: -10.0,
            design_temp_summer: 32.0,
            monthly_temps: [-2.0, 0.0, 4.0, 9.0, 14.0, 17.0, 19.0, 19.0, 15.0, 10.0, 4.0, 0.0],
            monthly_rh: [80.0, 78.0, 70.0, 65.0, 65.0, 68.0, 70.0, 72.0, 75.0, 80.0, 82.0, 82.0],
            hdd: 3000.0,
            cdd: 200.0,
            solar_radiation: 1100.0,
        }
    }
}

/// Indoor conditions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndoorConditions {
    /// Design temperature winter (°C)
    pub temp_winter: f64,
    /// Design temperature summer (°C)
    pub temp_summer: f64,
    /// Relative humidity (%)
    pub relative_humidity: f64,
    /// Internal heat gains (W/m²)
    pub internal_gains: f64,
    /// Ventilation rate (1/h)
    pub ventilation_rate: f64,
}

impl Default for IndoorConditions {
    fn default() -> Self {
        Self {
            temp_winter: 20.0,
            temp_summer: 26.0,
            relative_humidity: 50.0,
            internal_gains: 5.0,
            ventilation_rate: 0.5,
        }
    }
}

/// Physics analysis results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhysicsResults {
    /// Component U-values (W/m²·K)
    pub u_values: HashMap<String, f64>,
    /// Average U-value (W/m²·K)
    pub u_average: f64,
    /// Total heat loss coefficient (W/K)
    pub heat_loss_coefficient: f64,
    /// Transmission heat loss (kWh/year)
    pub transmission_loss: f64,
    /// Ventilation heat loss (kWh/year)
    pub ventilation_loss: f64,
    /// Total heat demand (kWh/year)
    pub heating_demand: f64,
    /// Cooling demand (kWh/year)
    pub cooling_demand: f64,
    /// Condensation risk assessments
    pub condensation_risks: HashMap<String, CondensationRisk>,
    /// Surface temperature factors
    pub f_rsi_values: HashMap<String, f64>,
}

/// Condensation risk assessment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CondensationRisk {
    /// Component ID
    pub component_id: String,
    /// Internal surface condensation risk
    pub surface_risk: bool,
    /// Interstitial condensation risk
    pub interstitial_risk: bool,
    /// Minimum surface temperature (°C)
    pub min_surface_temp: f64,
    /// Dew point at surface (°C)
    pub dew_point: f64,
    /// Temperature factor (f_Rsi)
    pub f_rsi: f64,
    /// Condensation zones (layer indices)
    pub condensation_zones: Vec<usize>,
}

impl EnvelopeComponent {
    /// Create external wall component
    pub fn external_wall(id: &str, area: f64, layers: Vec<MaterialLayer>) -> Self {
        Self {
            id: id.to_string(),
            component_type: ComponentType::ExternalWall,
            area,
            layers,
            thermal_bridges: Vec::new(),
            orientation: 0.0,
            tilt: 90.0,
        }
    }
    
    /// Create roof component
    pub fn roof(id: &str, area: f64, layers: Vec<MaterialLayer>) -> Self {
        Self {
            id: id.to_string(),
            component_type: ComponentType::Roof,
            area,
            layers,
            thermal_bridges: Vec::new(),
            orientation: 0.0,
            tilt: 0.0,
        }
    }
    
    /// Calculate total thermal resistance (m²·K/W)
    pub fn total_resistance(&self) -> f64 {
        // Surface resistances
        let r_si = match self.component_type {
            ComponentType::Roof => 0.10,
            ComponentType::GroundFloor => 0.17,
            _ => 0.13, // Vertical surfaces
        };
        
        let r_se = match self.component_type {
            ComponentType::GroundFloor => 0.0, // Ground
            _ => 0.04,
        };
        
        let r_layers: f64 = self.layers.iter()
            .map(|l| l.thermal_resistance())
            .sum();
        
        r_si + r_layers + r_se
    }
    
    /// Calculate U-value (W/m²·K)
    pub fn u_value(&self) -> f64 {
        1.0 / self.total_resistance()
    }
    
    /// Calculate thermal mass (J/m²·K)
    pub fn thermal_mass(&self) -> f64 {
        self.layers.iter()
            .map(|l| l.thermal_mass())
            .sum()
    }
    
    /// Calculate effective U-value including thermal bridges
    pub fn effective_u_value(&self) -> f64 {
        let base_u = self.u_value();
        
        // Linear thermal bridges
        let psi_sum: f64 = self.thermal_bridges.iter()
            .map(|tb| tb.psi * tb.length / self.area)
            .sum();
        
        // Point thermal bridges
        let chi_sum: f64 = self.thermal_bridges.iter()
            .filter_map(|tb| tb.chi.map(|c| c / self.area))
            .sum();
        
        base_u + psi_sum + chi_sum
    }
    
    /// Calculate temperature profile through layers
    pub fn temperature_profile(&self, t_int: f64, t_ext: f64) -> Vec<(f64, f64)> {
        let mut profile = Vec::new();
        let total_r = self.total_resistance();
        let q = (t_int - t_ext) / total_r; // Heat flux (W/m²)
        
        // Internal surface
        let r_si = 0.13;
        let mut t = t_int - q * r_si;
        profile.push((0.0, t_int)); // Indoor air
        
        let mut x = 0.0;
        for layer in &self.layers {
            let r = layer.thermal_resistance();
            let dt = q * r;
            
            profile.push((x, t));
            x += layer.thickness * 1000.0; // Convert to mm
            t -= dt;
            profile.push((x, t));
        }
        
        profile.push((x, t_ext)); // Outdoor air
        
        profile
    }
    
    /// Check for surface condensation risk
    pub fn check_surface_condensation(&self, t_int: f64, rh_int: f64, t_ext: f64) -> CondensationRisk {
        let r_si = 0.13;
        let total_r = self.total_resistance();
        
        // Surface temperature
        let t_surface = t_int - (t_int - t_ext) * r_si / total_r;
        
        // Dew point temperature
        let dew_point = self.calculate_dew_point(t_int, rh_int);
        
        // Temperature factor f_Rsi
        let f_rsi = (t_surface - t_ext) / (t_int - t_ext);
        
        // Required f_Rsi (EN ISO 13788, typically > 0.7)
        let surface_risk = t_surface < dew_point;
        
        // Check interstitial condensation (Glaser method simplified)
        let interstitial_risk = self.check_interstitial_condensation(t_int, rh_int, t_ext);
        
        CondensationRisk {
            component_id: self.id.clone(),
            surface_risk,
            interstitial_risk: !interstitial_risk.is_empty(),
            min_surface_temp: t_surface,
            dew_point,
            f_rsi,
            condensation_zones: interstitial_risk,
        }
    }
    
    /// Calculate dew point temperature (Magnus formula)
    fn calculate_dew_point(&self, temp: f64, rh: f64) -> f64 {
        let a = 17.27;
        let b = 237.7;
        let gamma = a * temp / (b + temp) + (rh / 100.0).ln();
        b * gamma / (a - gamma)
    }
    
    /// Check interstitial condensation (simplified Glaser)
    fn check_interstitial_condensation(&self, t_int: f64, rh_int: f64, t_ext: f64) -> Vec<usize> {
        let mut condensation_zones = Vec::new();
        let profile = self.temperature_profile(t_int, t_ext);
        
        // Calculate saturation pressure at each interface
        let rh_ext = 90.0; // Typical external RH
        let p_int = self.saturation_pressure(t_int) * rh_int / 100.0;
        let p_ext = self.saturation_pressure(t_ext) * rh_ext / 100.0;
        
        // Vapor pressure gradient (simplified)
        let total_rv: f64 = self.layers.iter()
            .map(|l| l.vapor_resistance())
            .sum();
        
        let g = (p_int - p_ext) / total_rv.max(1e-10); // Vapor flow
        
        let mut rv_cumulative = 0.0;
        for (i, layer) in self.layers.iter().enumerate() {
            rv_cumulative += layer.vapor_resistance();
            
            // Vapor pressure at this interface
            let p_vapor = p_int - g * rv_cumulative;
            
            // Get temperature at this interface
            let temp = if i * 2 + 2 < profile.len() {
                profile[i * 2 + 2].1
            } else {
                t_ext
            };
            
            let p_sat = self.saturation_pressure(temp);
            
            if p_vapor > p_sat {
                condensation_zones.push(i);
            }
        }
        
        condensation_zones
    }
    
    /// Calculate saturation vapor pressure (Pa)
    fn saturation_pressure(&self, temp: f64) -> f64 {
        610.78 * (17.08085 * temp / (234.175 + temp)).exp()
    }
}

impl BuildingPhysicsAnalyzer {
    /// Create new analyzer
    pub fn new() -> Self {
        Self {
            components: Vec::new(),
            climate: ClimateData::default(),
            indoor: IndoorConditions::default(),
            results: None,
        }
    }
    
    /// Add envelope component
    pub fn add_component(&mut self, component: EnvelopeComponent) {
        self.components.push(component);
    }
    
    /// Set climate data
    pub fn set_climate(&mut self, climate: ClimateData) {
        self.climate = climate;
    }
    
    /// Calculate total envelope area
    pub fn total_area(&self) -> f64 {
        self.components.iter().map(|c| c.area).sum()
    }
    
    /// Calculate average U-value
    pub fn average_u_value(&self) -> f64 {
        let weighted_sum: f64 = self.components.iter()
            .map(|c| c.effective_u_value() * c.area)
            .sum();
        
        weighted_sum / self.total_area().max(1.0)
    }
    
    /// Calculate heat loss coefficient (W/K)
    pub fn heat_loss_coefficient(&self) -> f64 {
        // Transmission heat loss coefficient
        let h_t: f64 = self.components.iter()
            .map(|c| c.effective_u_value() * c.area)
            .sum();
        
        // Ventilation heat loss coefficient (simplified)
        let volume = self.estimate_volume();
        let h_v = 0.34 * self.indoor.ventilation_rate * volume;
        
        h_t + h_v
    }
    
    /// Estimate building volume from envelope area
    fn estimate_volume(&self) -> f64 {
        let total_area = self.total_area();
        // Approximate: cube with given surface area
        (total_area / 6.0).powf(1.5) * 6.0_f64.sqrt()
    }
    
    /// Calculate annual heating demand (kWh)
    pub fn heating_demand(&self) -> f64 {
        let h_loss = self.heat_loss_coefficient();
        let hdd = self.climate.hdd;
        
        // Q = H × HDD × 24 / 1000
        h_loss * hdd * 24.0 / 1000.0
    }
    
    /// Calculate annual cooling demand (kWh)
    pub fn cooling_demand(&self) -> f64 {
        let h_loss = self.heat_loss_coefficient();
        let cdd = self.climate.cdd;
        
        // Simplified cooling demand
        h_loss * cdd * 24.0 / 1000.0 * 0.5 // Factor for cooling
    }
    
    /// Run complete analysis
    pub fn analyze(&mut self) -> &PhysicsResults {
        let mut u_values = HashMap::new();
        let mut condensation_risks = HashMap::new();
        let mut f_rsi_values = HashMap::new();
        
        for component in &self.components {
            u_values.insert(component.id.clone(), component.effective_u_value());
            
            let risk = component.check_surface_condensation(
                self.indoor.temp_winter,
                self.indoor.relative_humidity,
                self.climate.design_temp_winter,
            );
            
            f_rsi_values.insert(component.id.clone(), risk.f_rsi);
            condensation_risks.insert(component.id.clone(), risk);
        }
        
        let u_average = self.average_u_value();
        let heat_loss_coefficient = self.heat_loss_coefficient();
        
        // Annual energy demands
        let volume = self.estimate_volume();
        let h_v = 0.34 * self.indoor.ventilation_rate * volume;
        let transmission_loss = (heat_loss_coefficient - h_v) * self.climate.hdd * 24.0 / 1000.0;
        let ventilation_loss = h_v * self.climate.hdd * 24.0 / 1000.0;
        
        let heating_demand = self.heating_demand();
        let cooling_demand = self.cooling_demand();
        
        self.results = Some(PhysicsResults {
            u_values,
            u_average,
            heat_loss_coefficient,
            transmission_loss,
            ventilation_loss,
            heating_demand,
            cooling_demand,
            condensation_risks,
            f_rsi_values,
        });
        
        self.results.as_ref().expect("results were just set")
    }
}

/// Window thermal calculator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowCalculator {
    /// Window U-value (Uw, W/m²·K)
    pub u_window: f64,
    /// Frame U-value (Uf, W/m²·K)
    pub u_frame: f64,
    /// Glazing U-value (Ug, W/m²·K)
    pub u_glazing: f64,
    /// Frame fraction
    pub frame_fraction: f64,
    /// Linear thermal transmittance at glazing edge (W/m·K)
    pub psi_g: f64,
    /// Solar heat gain coefficient
    pub shgc: f64,
    /// Visible transmittance
    pub vt: f64,
}

impl WindowCalculator {
    /// Create double glazing window
    pub fn double_glazing(frame_u: f64, frame_fraction: f64) -> Self {
        let u_glazing = 1.1; // Low-E double glazing
        
        Self {
            u_window: 0.0, // Calculated
            u_frame: frame_u,
            u_glazing,
            frame_fraction,
            psi_g: 0.06, // Warm edge spacer
            shgc: 0.6,
            vt: 0.7,
        }
    }
    
    /// Create triple glazing window
    pub fn triple_glazing(frame_u: f64, frame_fraction: f64) -> Self {
        let u_glazing = 0.6; // Triple glazing with argon
        
        Self {
            u_window: 0.0,
            u_frame: frame_u,
            u_glazing,
            frame_fraction,
            psi_g: 0.04,
            shgc: 0.5,
            vt: 0.6,
        }
    }
    
    /// Calculate window U-value per EN ISO 10077
    pub fn calculate_u_value(&mut self, width: f64, height: f64) {
        let ag = width * height * (1.0 - self.frame_fraction);
        let af = width * height * self.frame_fraction;
        let lg = 2.0 * (width + height); // Glazing perimeter
        
        let a_total = width * height;
        
        self.u_window = (ag * self.u_glazing + af * self.u_frame + lg * self.psi_g) / a_total;
    }
    
    /// Calculate solar gains through window
    pub fn solar_gain(&self, area: f64, irradiance: f64, shading_factor: f64) -> f64 {
        area * (1.0 - self.frame_fraction) * self.shgc * irradiance * shading_factor
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_material_layer_resistance() {
        let concrete = MaterialLayer::concrete(0.2);
        let r = concrete.thermal_resistance();
        
        assert!((r - 0.111).abs() < 0.01);
    }
    
    #[test]
    fn test_insulation_layer() {
        let insulation = MaterialLayer::insulation_mineral_wool(0.1);
        let r = insulation.thermal_resistance();
        
        // R = 0.1 / 0.035 = 2.86
        assert!((r - 2.86).abs() < 0.1);
    }
    
    #[test]
    fn test_component_u_value() {
        let layers = vec![
            MaterialLayer::brick(0.1),
            MaterialLayer::insulation_eps(0.1),
            MaterialLayer::concrete(0.2),
            MaterialLayer::gypsum_board(0.0125),
        ];
        
        let wall = EnvelopeComponent::external_wall("wall1", 20.0, layers);
        let u = wall.u_value();
        
        // Should be around 0.3 W/m²·K
        assert!(u > 0.2 && u < 0.5);
    }
    
    #[test]
    fn test_temperature_profile() {
        let layers = vec![
            MaterialLayer::brick(0.1),
            MaterialLayer::insulation_eps(0.1),
        ];
        
        let wall = EnvelopeComponent::external_wall("wall1", 10.0, layers);
        let profile = wall.temperature_profile(20.0, 0.0);
        
        assert!(!profile.is_empty());
        assert!(profile.first().unwrap().1 > 15.0); // Indoor surface
    }
    
    #[test]
    fn test_condensation_check() {
        let layers = vec![
            MaterialLayer::concrete(0.2),
            MaterialLayer::insulation_mineral_wool(0.1),
        ];
        
        let wall = EnvelopeComponent::external_wall("wall1", 10.0, layers);
        let risk = wall.check_surface_condensation(20.0, 50.0, -10.0);
        
        assert!(risk.f_rsi > 0.5);
    }
    
    #[test]
    fn test_analyzer_creation() {
        let analyzer = BuildingPhysicsAnalyzer::new();
        assert!(analyzer.components.is_empty());
    }
    
    #[test]
    fn test_heating_demand() {
        let mut analyzer = BuildingPhysicsAnalyzer::new();
        
        let layers = vec![
            MaterialLayer::brick(0.1),
            MaterialLayer::insulation_eps(0.1),
            MaterialLayer::concrete(0.2),
        ];
        
        analyzer.add_component(EnvelopeComponent::external_wall("wall", 100.0, layers));
        
        let demand = analyzer.heating_demand();
        assert!(demand > 0.0);
    }
    
    #[test]
    fn test_full_analysis() {
        let mut analyzer = BuildingPhysicsAnalyzer::new();
        
        let wall_layers = vec![
            MaterialLayer::brick(0.1),
            MaterialLayer::insulation_eps(0.1),
            MaterialLayer::concrete(0.2),
        ];
        
        analyzer.add_component(EnvelopeComponent::external_wall("wall", 100.0, wall_layers));
        
        let roof_layers = vec![
            MaterialLayer::concrete(0.15),
            MaterialLayer::insulation_mineral_wool(0.2),
        ];
        
        analyzer.add_component(EnvelopeComponent::roof("roof", 50.0, roof_layers));
        
        let results = analyzer.analyze();
        
        assert!(results.u_average > 0.0);
        assert!(results.heating_demand > 0.0);
    }
    
    #[test]
    fn test_window_calculator() {
        let mut window = WindowCalculator::double_glazing(1.4, 0.2);
        window.calculate_u_value(1.2, 1.5);
        
        assert!(window.u_window > 1.0 && window.u_window < 2.0);
    }
    
    #[test]
    fn test_triple_glazing() {
        let mut window = WindowCalculator::triple_glazing(1.0, 0.15);
        window.calculate_u_value(1.5, 2.0);
        
        assert!(window.u_window < 1.0);
    }
    
    #[test]
    fn test_solar_gain() {
        let window = WindowCalculator::double_glazing(1.4, 0.2);
        let gain = window.solar_gain(3.0, 500.0, 0.8);
        
        assert!(gain > 0.0);
    }
    
    #[test]
    fn test_component_types() {
        assert_ne!(ComponentType::ExternalWall, ComponentType::Roof);
    }
    
    #[test]
    fn test_thermal_bridge_types() {
        assert_ne!(ThermalBridgeType::Balcony, ThermalBridgeType::Column);
    }
    
    #[test]
    fn test_climate_data_default() {
        let climate = ClimateData::default();
        assert!(climate.hdd > 0.0);
    }
    
    #[test]
    fn test_indoor_conditions_default() {
        let indoor = IndoorConditions::default();
        assert_eq!(indoor.temp_winter, 20.0);
    }
}
