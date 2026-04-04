// ============================================================================
// TRANSMISSION LINE STRUCTURES MODULE
// ASCE 10, IEC 60826, transmission tower design
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// CONDUCTOR & WIRE PROPERTIES
// ============================================================================

/// Conductor type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ConductorType {
    /// ACSR - Aluminum Conductor Steel Reinforced
    ACSR,
    /// AAAC - All Aluminum Alloy Conductor
    AAAC,
    /// AAC - All Aluminum Conductor
    AAC,
    /// HTLS - High Temperature Low Sag
    HTLS,
    /// OPGW - Optical Ground Wire
    OPGW,
}

/// Conductor specification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conductor {
    /// Conductor type
    pub conductor_type: ConductorType,
    /// Name/code word
    pub name: String,
    /// Total diameter (mm)
    pub diameter: f64,
    /// Total area (mm²)
    pub area: f64,
    /// Unit weight (kg/m)
    pub unit_weight: f64,
    /// Ultimate tensile strength (kN)
    pub uts: f64,
    /// Modulus of elasticity (MPa)
    pub modulus: f64,
    /// Coefficient of thermal expansion (/°C)
    pub alpha: f64,
}

impl Conductor {
    /// ACSR Drake
    pub fn acsr_drake() -> Self {
        Self {
            conductor_type: ConductorType::ACSR,
            name: "Drake".to_string(),
            diameter: 28.14,
            area: 468.0,
            unit_weight: 1.628,
            uts: 140.0,
            modulus: 69000.0,
            alpha: 18.9e-6,
        }
    }
    
    /// ACSR Cardinal
    pub fn acsr_cardinal() -> Self {
        Self {
            conductor_type: ConductorType::ACSR,
            name: "Cardinal".to_string(),
            diameter: 30.38,
            area: 546.0,
            unit_weight: 1.828,
            uts: 144.0,
            modulus: 62000.0,
            alpha: 19.3e-6,
        }
    }
    
    /// AAAC Flint
    pub fn aaac_flint() -> Self {
        Self {
            conductor_type: ConductorType::AAAC,
            name: "Flint".to_string(),
            diameter: 25.4,
            area: 402.0,
            unit_weight: 1.11,
            uts: 110.0,
            modulus: 55000.0,
            alpha: 23.0e-6,
        }
    }
    
    /// Weight per span length (kN)
    pub fn span_weight(&self, span: f64) -> f64 {
        self.unit_weight * 9.81 / 1000.0 * span
    }
    
    /// Rated breaking strength (kN) at EDS
    pub fn eds_tension(&self) -> f64 {
        // Every Day Stress - typically 18-22% UTS
        self.uts * 0.20
    }
    
    /// Maximum working tension (kN)
    pub fn max_tension(&self) -> f64 {
        // Maximum - typically 35-40% UTS
        self.uts * 0.40
    }
}

// ============================================================================
// SAG-TENSION CALCULATIONS
// ============================================================================

/// Sag-tension analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SagTension {
    /// Conductor
    pub conductor: Conductor,
    /// Span length (m)
    pub span: f64,
    /// Wind pressure (Pa)
    pub wind_pressure: f64,
    /// Ice thickness (mm)
    pub ice_thickness: f64,
    /// Temperature (°C)
    pub temperature: f64,
}

impl SagTension {
    pub fn new(conductor: Conductor, span: f64) -> Self {
        Self {
            conductor,
            span,
            wind_pressure: 0.0,
            ice_thickness: 0.0,
            temperature: 15.0,
        }
    }
    
    /// Total conductor weight with ice (kN/m)
    pub fn total_weight(&self) -> f64 {
        let w_conductor = self.conductor.unit_weight * 9.81 / 1000.0;
        
        // Ice weight (density 900 kg/m³)
        let d_ice = self.conductor.diameter + 2.0 * self.ice_thickness;
        let ice_area = PI * (d_ice.powi(2) - self.conductor.diameter.powi(2)) / 4.0 / 1e6;
        let w_ice = ice_area * 900.0 * 9.81 / 1000.0;
        
        w_conductor + w_ice
    }
    
    /// Wind load on conductor (kN/m)
    pub fn wind_load(&self) -> f64 {
        let d = self.conductor.diameter + 2.0 * self.ice_thickness;
        
        self.wind_pressure * d / 1000.0 / 1000.0 // kN/m
    }
    
    /// Resultant load (kN/m)
    pub fn resultant_load(&self) -> f64 {
        let w = self.total_weight();
        let p = self.wind_load();
        
        (w.powi(2) + p.powi(2)).sqrt()
    }
    
    /// Catenary parameter (m)
    pub fn catenary_parameter(&self, tension: f64) -> f64 {
        tension / self.total_weight()
    }
    
    /// Sag at mid-span using parabolic approximation (m)
    pub fn parabolic_sag(&self, tension: f64) -> f64 {
        let w = self.resultant_load();
        let l = self.span;
        
        w * l.powi(2) / (8.0 * tension)
    }
    
    /// Conductor length for parabolic approximation (m)
    pub fn conductor_length(&self, tension: f64) -> f64 {
        let d = self.parabolic_sag(tension);
        let l = self.span;
        
        l + 8.0 * d.powi(2) / (3.0 * l)
    }
    
    /// Initial tension at temperature (kN) - simplified
    pub fn tension_at_temp(&self, initial_tension: f64, initial_temp: f64) -> f64 {
        let delta_t = self.temperature - initial_temp;
        let e = self.conductor.modulus;
        let a = self.conductor.area;
        let alpha = self.conductor.alpha;
        
        // Simplified - actual requires iterative solution
        let strain_thermal = alpha * delta_t;
        let delta_t_force = e * a * strain_thermal / 1000.0; // kN
        
        initial_tension - delta_t_force
    }
    
    /// Stringing sag table
    pub fn sag_table(&self, eds_tension: f64) -> Vec<(f64, f64)> {
        let temps = vec![-10.0, 0.0, 10.0, 20.0, 30.0, 40.0];
        
        temps.iter().map(|&t| {
            let mut calc = self.clone();
            calc.temperature = t;
            let tension = calc.tension_at_temp(eds_tension, 15.0);
            let sag = calc.parabolic_sag(tension.max(10.0));
            (t, sag)
        }).collect()
    }
    
    /// Swing angle under wind (degrees)
    pub fn swing_angle(&self) -> f64 {
        let w = self.total_weight();
        let p = self.wind_load();
        
        (p / w).atan().to_degrees()
    }
}

// ============================================================================
// TRANSMISSION TOWER
// ============================================================================

/// Tower type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TowerType {
    /// Suspension/tangent tower
    Suspension,
    /// Light angle (0-5°)
    LightAngle,
    /// Medium angle (5-30°)
    MediumAngle,
    /// Heavy angle (30-60°)
    HeavyAngle,
    /// Dead end/terminal
    DeadEnd,
    /// Transposition
    Transposition,
}

/// Tower body type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TowerBodyType {
    /// Self-supporting lattice
    SelfSupporting,
    /// Guyed V
    GuyedV,
    /// Guyed mast
    GuyedMast,
    /// Tubular steel pole
    TubularPole,
    /// H-frame wood
    HFrame,
}

/// Transmission tower
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransmissionTower {
    /// Tower type
    pub tower_type: TowerType,
    /// Body type
    pub body_type: TowerBodyType,
    /// Total height (m)
    pub height: f64,
    /// Base width (m)
    pub base_width: f64,
    /// Top width (m)
    pub top_width: f64,
    /// Number of circuits
    pub circuits: u32,
    /// Voltage level (kV)
    pub voltage: f64,
    /// Conductor attachment height (m)
    pub conductor_height: f64,
    /// Ground wire height (m)
    pub ground_wire_height: f64,
    /// Weight factor for type
    pub weight_factor: f64,
}

impl TransmissionTower {
    pub fn new(voltage: f64, tower_type: TowerType, height: f64) -> Self {
        // Typical proportions
        let base_width = height * 0.15;
        let top_width = height * 0.05;
        
        let weight_factor = match tower_type {
            TowerType::Suspension => 1.0,
            TowerType::LightAngle => 1.3,
            TowerType::MediumAngle => 1.6,
            TowerType::HeavyAngle => 2.2,
            TowerType::DeadEnd => 2.8,
            TowerType::Transposition => 1.5,
        };
        
        Self {
            tower_type,
            body_type: TowerBodyType::SelfSupporting,
            height,
            base_width,
            top_width,
            circuits: 1,
            voltage,
            conductor_height: height * 0.7,
            ground_wire_height: height * 0.95,
            weight_factor,
        }
    }
    
    /// Estimated tower weight (kg)
    pub fn estimated_weight(&self) -> f64 {
        // Empirical formula based on voltage and height
        let base_weight = 0.5 * self.voltage.powf(1.3) * self.height;
        
        base_weight * self.weight_factor * self.circuits as f64
    }
    
    /// Foundation reaction zone (m²)
    pub fn foundation_area(&self) -> f64 {
        self.base_width.powi(2)
    }
    
    /// Minimum ground clearance (m)
    pub fn ground_clearance(&self) -> f64 {
        // Based on voltage
        if self.voltage <= 66.0 {
            6.1
        } else if self.voltage <= 132.0 {
            6.7
        } else if self.voltage <= 220.0 {
            7.0
        } else if self.voltage <= 400.0 {
            8.8
        } else {
            10.0
        }
    }
    
    /// Phase spacing (m)
    pub fn phase_spacing(&self) -> f64 {
        // Approximate based on voltage
        self.voltage / 150.0 + 3.0
    }
    
    /// Shield angle (degrees)
    pub fn shield_angle(&self) -> f64 {
        // Typical protective angle
        if self.voltage >= 220.0 {
            20.0
        } else {
            30.0
        }
    }
    
    /// Right of way width (m)
    pub fn row_width(&self) -> f64 {
        // Approximate ROW
        let swing_allowance = 5.0;
        
        2.0 * (self.phase_spacing() * 1.5 + swing_allowance)
    }
}

// ============================================================================
// TOWER LOADING
// ============================================================================

/// Load case type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LoadCase {
    /// Normal condition
    Normal,
    /// Wind on bare conductor
    WindBare,
    /// Wind with ice
    WindIce,
    /// Broken wire
    BrokenWire,
    /// Construction/stringing
    Construction,
    /// Seismic
    Seismic,
}

/// Tower loading
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TowerLoading {
    /// Tower
    pub tower: TransmissionTower,
    /// Conductor
    pub conductor: Conductor,
    /// Span length (m)
    pub span: f64,
    /// Wind span (m) - for wind load
    pub wind_span: f64,
    /// Weight span (m) - for vertical load
    pub weight_span: f64,
    /// Line angle (degrees)
    pub line_angle: f64,
}

impl TowerLoading {
    pub fn new(tower: TransmissionTower, conductor: Conductor, span: f64) -> Self {
        Self {
            tower,
            conductor,
            span,
            wind_span: span,
            weight_span: span,
            line_angle: 0.0,
        }
    }
    
    /// Vertical load per phase (kN)
    pub fn vertical_load(&self) -> f64 {
        let w = self.conductor.unit_weight * 9.81 / 1000.0;
        
        w * self.weight_span
    }
    
    /// Transverse load from wind (kN/phase)
    pub fn transverse_wind(&self, wind_pressure: f64) -> f64 {
        let d = self.conductor.diameter / 1000.0;
        
        wind_pressure * d * self.wind_span / 1000.0
    }
    
    /// Transverse load from line angle (kN/phase)
    pub fn transverse_angle(&self) -> f64 {
        let angle_rad = self.line_angle.to_radians();
        let tension = self.conductor.max_tension();
        
        2.0 * tension * (angle_rad / 2.0).sin()
    }
    
    /// Total transverse load (kN/phase)
    pub fn total_transverse(&self, wind_pressure: f64) -> f64 {
        self.transverse_wind(wind_pressure) + self.transverse_angle()
    }
    
    /// Longitudinal load - broken wire (kN)
    pub fn longitudinal_broken_wire(&self) -> f64 {
        // Residual tension after break
        self.conductor.max_tension() * 0.5
    }
    
    /// Tower wind load (kN)
    pub fn tower_wind_load(&self, wind_pressure: f64) -> f64 {
        // Approximate tower projected area
        let area = self.tower.height * (self.tower.base_width + self.tower.top_width) / 4.0;
        let solidity = 0.3; // Typical for lattice
        
        wind_pressure * area * solidity / 1000.0
    }
    
    /// Foundation uplift (kN)
    pub fn foundation_uplift(&self, wind_pressure: f64) -> f64 {
        let h = self.tower.conductor_height;
        let b = self.tower.base_width;
        
        let transverse = self.total_transverse(wind_pressure) * 3.0; // 3 phases
        let tower_wind = self.tower_wind_load(wind_pressure);
        
        // Overturning moment / base width
        (transverse * h + tower_wind * self.tower.height / 2.0) / b
    }
    
    /// Foundation compression (kN)
    pub fn foundation_compression(&self) -> f64 {
        let vertical = self.vertical_load() * 3.0 * 2.0; // 3 phases, 2 conductors
        let tower_weight = self.tower.estimated_weight() * 9.81 / 1000.0;
        
        (vertical + tower_weight) / 4.0 // 4 legs
    }
    
    /// Load case factors
    pub fn load_factors(&self, case: LoadCase) -> (f64, f64, f64) {
        // (vertical, transverse, longitudinal)
        match case {
            LoadCase::Normal => (1.0, 1.0, 0.0),
            LoadCase::WindBare => (1.0, 1.0, 0.0),
            LoadCase::WindIce => (1.3, 1.1, 0.0),
            LoadCase::BrokenWire => (1.0, 0.5, 1.0),
            LoadCase::Construction => (1.5, 0.0, 0.0),
            LoadCase::Seismic => (1.0, 0.3, 0.3),
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
    fn test_conductor() {
        let drake = Conductor::acsr_drake();
        
        assert!(drake.diameter > 25.0 && drake.diameter < 35.0);
        assert!(drake.uts > 100.0);
    }

    #[test]
    fn test_eds_tension() {
        let conductor = Conductor::acsr_cardinal();
        
        let eds = conductor.eds_tension();
        let max = conductor.max_tension();
        
        assert!(eds < max);
        assert!(eds > 20.0);
    }

    #[test]
    fn test_sag_tension() {
        let conductor = Conductor::acsr_drake();
        let st = SagTension::new(conductor, 400.0);
        
        let sag = st.parabolic_sag(50.0);
        assert!(sag > 5.0 && sag < 50.0);
    }

    #[test]
    fn test_conductor_length() {
        let conductor = Conductor::acsr_drake();
        let st = SagTension::new(conductor, 400.0);
        
        let length = st.conductor_length(50.0);
        assert!(length > st.span);
    }

    #[test]
    fn test_swing_angle() {
        let conductor = Conductor::acsr_drake();
        let mut st = SagTension::new(conductor, 400.0);
        st.wind_pressure = 400.0; // Pa
        
        let angle = st.swing_angle();
        assert!(angle > 0.0 && angle < 90.0);
    }

    #[test]
    fn test_tower() {
        let tower = TransmissionTower::new(220.0, TowerType::Suspension, 40.0);
        
        assert!(tower.ground_clearance() >= 7.0);
        assert!(tower.estimated_weight() > 1000.0);
    }

    #[test]
    fn test_tower_types() {
        let suspension = TransmissionTower::new(132.0, TowerType::Suspension, 35.0);
        let dead_end = TransmissionTower::new(132.0, TowerType::DeadEnd, 35.0);
        
        assert!(dead_end.weight_factor > suspension.weight_factor);
    }

    #[test]
    fn test_loading() {
        let tower = TransmissionTower::new(132.0, TowerType::Suspension, 35.0);
        let conductor = Conductor::acsr_drake();
        let loading = TowerLoading::new(tower, conductor, 350.0);
        
        let v = loading.vertical_load();
        assert!(v > 5.0);
    }

    #[test]
    fn test_transverse_angle() {
        let tower = TransmissionTower::new(220.0, TowerType::MediumAngle, 40.0);
        let conductor = Conductor::acsr_cardinal();
        let mut loading = TowerLoading::new(tower, conductor, 400.0);
        loading.line_angle = 15.0;
        
        let t = loading.transverse_angle();
        assert!(t > 10.0);
    }

    #[test]
    fn test_foundation_loads() {
        let tower = TransmissionTower::new(400.0, TowerType::Suspension, 50.0);
        let conductor = Conductor::acsr_cardinal();
        let loading = TowerLoading::new(tower, conductor, 450.0);
        
        let uplift = loading.foundation_uplift(600.0);
        let compression = loading.foundation_compression();
        
        assert!(uplift > 0.0);
        assert!(compression > 0.0);
    }

    #[test]
    fn test_sag_table() {
        let conductor = Conductor::acsr_drake();
        let st = SagTension::new(conductor.clone(), 400.0);
        
        let table = st.sag_table(conductor.eds_tension());
        assert_eq!(table.len(), 6);
        
        // Higher temp = more sag
        let (_, sag_cold) = table[0];
        let (_, sag_hot) = table[5];
        assert!(sag_hot > sag_cold);
    }
}
