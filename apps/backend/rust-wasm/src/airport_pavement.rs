// ============================================================================
// AIRPORT PAVEMENT MODULE
// FAA AC 150/5320-6, ICAO Annex 14, asphalt & concrete airfield pavement design
// ============================================================================

use serde::{Deserialize, Serialize};

// ============================================================================
// AIRCRAFT CLASSIFICATION
// ============================================================================

/// Aircraft design group (wingspan based)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AircraftDesignGroup {
    /// Group I: < 15m wingspan
    I,
    /// Group II: 15m - 24m
    II,
    /// Group III: 24m - 36m  
    III,
    /// Group IV: 36m - 52m
    IV,
    /// Group V: 52m - 65m
    V,
    /// Group VI: 65m - 80m
    VI,
}

impl AircraftDesignGroup {
    /// Maximum wingspan (m)
    pub fn max_wingspan(&self) -> f64 {
        match self {
            AircraftDesignGroup::I => 15.0,
            AircraftDesignGroup::II => 24.0,
            AircraftDesignGroup::III => 36.0,
            AircraftDesignGroup::IV => 52.0,
            AircraftDesignGroup::V => 65.0,
            AircraftDesignGroup::VI => 80.0,
        }
    }
}

/// Aircraft approach speed category
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ApproachCategory {
    /// A: < 91 knots
    A,
    /// B: 91-120 knots
    B,
    /// C: 121-140 knots
    C,
    /// D: 141-165 knots
    D,
    /// E: 166-210 knots
    E,
}

/// Reference aircraft for pavement design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesignAircraft {
    /// Aircraft name
    pub name: String,
    /// Maximum takeoff weight (kg)
    pub mtow: f64,
    /// Maximum landing weight (kg)
    pub mlw: f64,
    /// Main gear configuration
    pub gear_config: GearConfiguration,
    /// Tire pressure (kPa)
    pub tire_pressure: f64,
    /// Annual departures
    pub annual_departures: u32,
}

/// Main landing gear configuration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum GearConfiguration {
    /// Single wheel (S)
    Single,
    /// Dual wheel (D)
    Dual,
    /// Dual tandem (2D)
    DualTandem,
    /// Triple dual tandem (3D - B747)
    TripleDualTandem,
    /// Dual dual tandem (2D/2D - A380)
    DoubleDualTandem,
}

impl GearConfiguration {
    /// Number of main gear wheels
    pub fn wheel_count(&self) -> u32 {
        match self {
            GearConfiguration::Single => 2,
            GearConfiguration::Dual => 4,
            GearConfiguration::DualTandem => 8,
            GearConfiguration::TripleDualTandem => 16,
            GearConfiguration::DoubleDualTandem => 20,
        }
    }
    
    /// Gear code for ACN calculation
    pub fn gear_code(&self) -> &str {
        match self {
            GearConfiguration::Single => "S",
            GearConfiguration::Dual => "D",
            GearConfiguration::DualTandem => "2D",
            GearConfiguration::TripleDualTandem => "3D",
            GearConfiguration::DoubleDualTandem => "2D/2D",
        }
    }
}

// ============================================================================
// PCN/ACN SYSTEM
// ============================================================================

/// Pavement type for PCN
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PavementType {
    /// Rigid (concrete)
    Rigid,
    /// Flexible (asphalt)
    Flexible,
}

/// Subgrade strength category
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SubgradeCategory {
    /// High: K > 120 MN/m³ or CBR > 13
    A,
    /// Medium: K = 60-120 MN/m³ or CBR = 8-13
    B,
    /// Low: K = 25-60 MN/m³ or CBR = 4-8
    C,
    /// Ultra-low: K < 25 MN/m³ or CBR < 4
    D,
}

impl SubgradeCategory {
    /// Representative CBR (%)
    pub fn cbr(&self) -> f64 {
        match self {
            SubgradeCategory::A => 15.0,
            SubgradeCategory::B => 10.0,
            SubgradeCategory::C => 6.0,
            SubgradeCategory::D => 3.0,
        }
    }
    
    /// Representative modulus of subgrade reaction (MN/m³)
    pub fn k_value(&self) -> f64 {
        match self {
            SubgradeCategory::A => 150.0,
            SubgradeCategory::B => 80.0,
            SubgradeCategory::C => 40.0,
            SubgradeCategory::D => 20.0,
        }
    }
}

/// Tire pressure category
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TirePressureCategory {
    /// W: Unlimited
    W,
    /// X: 1.5 MPa max
    X,
    /// Y: 1.0 MPa max
    Y,
    /// Z: 0.5 MPa max
    Z,
}

impl TirePressureCategory {
    /// Maximum tire pressure (kPa)
    pub fn max_pressure(&self) -> f64 {
        match self {
            TirePressureCategory::W => 2000.0,
            TirePressureCategory::X => 1500.0,
            TirePressureCategory::Y => 1000.0,
            TirePressureCategory::Z => 500.0,
        }
    }
}

/// Pavement Classification Number
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PCN {
    /// PCN value
    pub value: f64,
    /// Pavement type
    pub pavement_type: PavementType,
    /// Subgrade category
    pub subgrade: SubgradeCategory,
    /// Tire pressure category
    pub tire_pressure: TirePressureCategory,
    /// Evaluation method: T=Technical, U=Using aircraft
    pub evaluation: char,
}

impl PCN {
    /// Create new PCN
    pub fn new(value: f64, pavement_type: PavementType, subgrade: SubgradeCategory) -> Self {
        Self {
            value,
            pavement_type,
            subgrade,
            tire_pressure: TirePressureCategory::W,
            evaluation: 'T',
        }
    }
    
    /// PCN string notation
    pub fn notation(&self) -> String {
        let p = match self.pavement_type {
            PavementType::Rigid => 'R',
            PavementType::Flexible => 'F',
        };
        let s = match self.subgrade {
            SubgradeCategory::A => 'A',
            SubgradeCategory::B => 'B',
            SubgradeCategory::C => 'C',
            SubgradeCategory::D => 'D',
        };
        let t = match self.tire_pressure {
            TirePressureCategory::W => 'W',
            TirePressureCategory::X => 'X',
            TirePressureCategory::Y => 'Y',
            TirePressureCategory::Z => 'Z',
        };
        
        format!("{:.0}/{}/{}/{}/{}", self.value, p, s, t, self.evaluation)
    }
}

/// Aircraft Classification Number calculation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ACNCalculator {
    /// Aircraft weight (kg)
    pub weight: f64,
    /// Gear configuration
    pub gear_config: GearConfiguration,
    /// Tire pressure (kPa)
    pub tire_pressure: f64,
}

impl ACNCalculator {
    pub fn new(weight: f64, gear_config: GearConfiguration, tire_pressure: f64) -> Self {
        Self {
            weight,
            gear_config,
            tire_pressure,
        }
    }
    
    /// Single wheel load (kg)
    pub fn single_wheel_load(&self) -> f64 {
        // Main gear carries 95% of weight
        0.95 * self.weight / self.gear_config.wheel_count() as f64
    }
    
    /// ACN on rigid pavement
    pub fn acn_rigid(&self, subgrade: SubgradeCategory) -> f64 {
        let swl = self.single_wheel_load();
        let k = subgrade.k_value();
        
        // Simplified ACN formula (approximate)
        let base_acn = swl / 500.0; // Base scaling
        
        // Adjust for subgrade and gear type
        let k_factor = (150.0 / k).powf(0.3);
        let gear_factor = match self.gear_config {
            GearConfiguration::Single => 1.0,
            GearConfiguration::Dual => 0.8,
            GearConfiguration::DualTandem => 0.65,
            GearConfiguration::TripleDualTandem => 0.55,
            GearConfiguration::DoubleDualTandem => 0.50,
        };
        
        base_acn * k_factor * gear_factor
    }
    
    /// ACN on flexible pavement
    pub fn acn_flexible(&self, subgrade: SubgradeCategory) -> f64 {
        let swl = self.single_wheel_load();
        let cbr = subgrade.cbr();
        
        // Simplified ACN formula (approximate)
        let base_acn = swl / 500.0;
        
        // Adjust for CBR and gear type
        let cbr_factor = (15.0 / cbr).powf(0.4);
        let gear_factor = match self.gear_config {
            GearConfiguration::Single => 1.0,
            GearConfiguration::Dual => 0.85,
            GearConfiguration::DualTandem => 0.70,
            GearConfiguration::TripleDualTandem => 0.60,
            GearConfiguration::DoubleDualTandem => 0.55,
        };
        
        base_acn * cbr_factor * gear_factor
    }
}

// ============================================================================
// FLEXIBLE PAVEMENT DESIGN (CBR Method)
// ============================================================================

/// Flexible pavement design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlexiblePavement {
    /// Subgrade CBR (%)
    pub cbr: f64,
    /// Design aircraft weight (kg)
    pub aircraft_weight: f64,
    /// Gear configuration
    pub gear_config: GearConfiguration,
    /// Tire pressure (kPa)
    pub tire_pressure: f64,
    /// Annual departures
    pub annual_departures: u32,
    /// Design life (years)
    pub design_life: u32,
}

impl FlexiblePavement {
    pub fn new(cbr: f64, aircraft_weight: f64, gear_config: GearConfiguration) -> Self {
        Self {
            cbr,
            aircraft_weight,
            gear_config,
            tire_pressure: 1400.0,
            annual_departures: 10000,
            design_life: 20,
        }
    }
    
    /// Total coverages over design life
    pub fn design_coverages(&self) -> f64 {
        let pass_to_coverage = match self.gear_config {
            GearConfiguration::Single => 1.0,
            GearConfiguration::Dual => 0.6,
            GearConfiguration::DualTandem => 0.4,
            GearConfiguration::TripleDualTandem => 0.3,
            GearConfiguration::DoubleDualTandem => 0.25,
        };
        
        self.annual_departures as f64 * self.design_life as f64 * pass_to_coverage
    }
    
    /// Total pavement thickness required (mm) - CBR method
    pub fn total_thickness(&self) -> f64 {
        let swl = 0.95 * self.aircraft_weight / self.gear_config.wheel_count() as f64 * 9.81 / 1000.0; // kN
        let c = self.design_coverages();
        
        // FAA CBR design equation (simplified)
        let alpha = 1.0 + 0.5 * (c / 10000.0).log10().max(0.0);
        
        // More realistic FAA formula
        let t = alpha * (swl).sqrt() * (1.0 / self.cbr).sqrt() * 50.0;
        
        t.max(150.0) // Minimum 150mm
    }
    
    /// Asphalt surface course thickness (mm)
    pub fn asphalt_thickness(&self) -> f64 {
        // Based on tire pressure
        if self.tire_pressure > 1500.0 {
            150.0
        } else if self.tire_pressure > 1000.0 {
            100.0
        } else {
            75.0
        }
    }
    
    /// Base course thickness (mm)
    pub fn base_thickness(&self) -> f64 {
        let total = self.total_thickness();
        let asphalt = self.asphalt_thickness();
        
        // Base is typically 30-40% of total
        (total * 0.35).max(150.0).min(total - asphalt - 150.0)
    }
    
    /// Subbase thickness (mm)
    pub fn subbase_thickness(&self) -> f64 {
        let total = self.total_thickness();
        let asphalt = self.asphalt_thickness();
        let base = self.base_thickness();
        
        (total - asphalt - base).max(0.0)
    }
}

// ============================================================================
// RIGID PAVEMENT DESIGN (Westergaard)
// ============================================================================

/// Rigid pavement design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RigidPavement {
    /// Modulus of subgrade reaction (MN/m³)
    pub k: f64,
    /// Concrete flexural strength (MPa)
    pub mr: f64,
    /// Design aircraft weight (kg)
    pub aircraft_weight: f64,
    /// Gear configuration
    pub gear_config: GearConfiguration,
    /// Annual departures
    pub annual_departures: u32,
    /// Design life (years)
    pub design_life: u32,
}

impl RigidPavement {
    pub fn new(k: f64, mr: f64, aircraft_weight: f64, gear_config: GearConfiguration) -> Self {
        Self {
            k,
            mr,
            aircraft_weight,
            gear_config,
            annual_departures: 10000,
            design_life: 20,
        }
    }
    
    /// Allowable concrete stress (MPa)
    pub fn allowable_stress(&self) -> f64 {
        // 75% of flexural strength for interior loading
        0.75 * self.mr
    }
    
    /// Design stress repetitions factor
    pub fn stress_repetitions_factor(&self) -> f64 {
        let cov = self.annual_departures as f64 * self.design_life as f64;
        
        // Fatigue factor
        0.9 * (cov / 1000.0).log10().max(1.0).min(1.5)
    }
    
    /// Slab thickness required (mm) - FAA method
    pub fn slab_thickness(&self) -> f64 {
        let swl = 0.95 * self.aircraft_weight / self.gear_config.wheel_count() as f64 * 9.81 / 1000.0; // kN
        let sigma_all = self.allowable_stress() / self.stress_repetitions_factor();
        
        // Westergaard interior loading (simplified)
        // σ = (3P / h²) * (1 + log(l/b)) approximately
        // Solving for h
        
        let l_b_factor = 2.5; // Typical for airport loading
        
        let h = (3.0 * swl * 1000.0 * l_b_factor / sigma_all).sqrt();
        
        // Adjust for subgrade
        let k_factor = (80.0 / self.k).powf(0.15);
        
        (h * k_factor).max(200.0) // Minimum 200mm
    }
    
    /// Radius of relative stiffness (mm)
    pub fn radius_of_stiffness(&self) -> f64 {
        let e: f64 = 28000.0; // Concrete modulus MPa
        let h = self.slab_thickness();
        let nu: f64 = 0.15;
        let k = self.k / 1000.0; // MPa/mm
        
        (e * h.powi(3) / (12.0 * (1.0 - nu.powi(2)) * k)).powf(0.25)
    }
    
    /// Joint spacing (mm)
    pub fn joint_spacing(&self) -> f64 {
        // 4-5 times slab thickness for transverse joints
        self.slab_thickness() * 4.5
    }
    
    /// Dowel bar diameter (mm)
    pub fn dowel_diameter(&self) -> f64 {
        let h = self.slab_thickness();
        
        if h < 250.0 {
            25.0
        } else if h < 350.0 {
            32.0
        } else {
            38.0
        }
    }
}

// ============================================================================
// RUNWAY GEOMETRY
// ============================================================================

/// Runway length design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunwayDesign {
    /// Reference code number (1-4)
    pub code_number: u8,
    /// Reference code letter (A-F)
    pub code_letter: char,
    /// Runway basic length (m)
    pub basic_length: f64,
    /// Elevation above MSL (m)
    pub elevation: f64,
    /// Reference temperature (°C)
    pub temperature: f64,
    /// Effective gradient (%)
    pub gradient: f64,
}

impl RunwayDesign {
    pub fn new(basic_length: f64, elevation: f64, temperature: f64) -> Self {
        Self {
            code_number: 4,
            code_letter: 'D',
            basic_length,
            elevation,
            temperature,
            gradient: 0.0,
        }
    }
    
    /// Elevation correction factor
    pub fn elevation_factor(&self) -> f64 {
        1.0 + 0.07 * (self.elevation / 300.0)
    }
    
    /// Temperature correction factor
    pub fn temperature_factor(&self) -> f64 {
        let isa_temp = 15.0 - 0.0065 * self.elevation;
        let delta_t = self.temperature - isa_temp;
        
        1.0 + 0.01 * delta_t.max(0.0)
    }
    
    /// Slope correction factor
    pub fn slope_factor(&self) -> f64 {
        1.0 + 0.10 * self.gradient
    }
    
    /// Corrected runway length (m)
    pub fn corrected_length(&self) -> f64 {
        self.basic_length * 
            self.elevation_factor() * 
            self.temperature_factor() * 
            self.slope_factor()
    }
    
    /// Runway width (m)
    pub fn runway_width(&self) -> f64 {
        match (self.code_number, self.code_letter) {
            (4, 'D') | (4, 'E') | (4, 'F') => 45.0,
            (4, 'C') => 45.0,
            (3, _) => 30.0,
            (2, _) => 23.0,
            (1, _) => 18.0,
            _ => 45.0,
        }
    }
    
    /// Runway strip width (m)
    pub fn strip_width(&self) -> f64 {
        match self.code_number {
            4 | 3 => 300.0,
            2 => 150.0,
            1 => 60.0,
            _ => 300.0,
        }
    }
    
    /// Runway end safety area length (m)
    pub fn resa_length(&self) -> f64 {
        match self.code_number {
            4 | 3 => 240.0,
            _ => 120.0,
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
    fn test_gear_config() {
        assert_eq!(GearConfiguration::Dual.wheel_count(), 4);
        assert_eq!(GearConfiguration::DualTandem.wheel_count(), 8);
    }

    #[test]
    fn test_subgrade_category() {
        assert!(SubgradeCategory::A.cbr() > SubgradeCategory::D.cbr());
    }

    #[test]
    fn test_pcn_notation() {
        let pcn = PCN::new(60.0, PavementType::Rigid, SubgradeCategory::B);
        
        assert!(pcn.notation().contains("R/B"));
    }

    #[test]
    fn test_acn_calculation() {
        let calc = ACNCalculator::new(300000.0, GearConfiguration::DualTandem, 1400.0);
        
        let acn = calc.acn_rigid(SubgradeCategory::B);
        assert!(acn > 30.0 && acn < 100.0);
    }

    #[test]
    fn test_acn_flexible() {
        let calc = ACNCalculator::new(200000.0, GearConfiguration::Dual, 1200.0);
        
        let acn = calc.acn_flexible(SubgradeCategory::C);
        assert!(acn > 20.0);
    }

    #[test]
    fn test_flexible_pavement() {
        let pav = FlexiblePavement::new(6.0, 250000.0, GearConfiguration::DualTandem);
        
        let total = pav.total_thickness();
        assert!(total > 150.0); // At least minimum
    }

    #[test]
    fn test_pavement_layers() {
        let pav = FlexiblePavement::new(8.0, 200000.0, GearConfiguration::DualTandem);
        
        let asphalt = pav.asphalt_thickness();
        let base = pav.base_thickness();
        let subbase = pav.subbase_thickness();
        
        assert!(asphalt > 0.0);
        assert!(base >= 0.0); // May be 0 for thin pavements
    }

    #[test]
    fn test_rigid_pavement() {
        let pav = RigidPavement::new(80.0, 4.5, 300000.0, GearConfiguration::DualTandem);
        
        let h = pav.slab_thickness();
        assert!(h > 200.0); // At least minimum
    }

    #[test]
    fn test_joint_spacing() {
        let pav = RigidPavement::new(80.0, 4.5, 200000.0, GearConfiguration::DualTandem);
        
        let spacing = pav.joint_spacing();
        assert!(spacing > 900.0 && spacing < 4000.0); // 4.5 * slab thickness
    }

    #[test]
    fn test_runway_correction() {
        let rwy = RunwayDesign::new(2500.0, 1000.0, 35.0);
        
        let corrected = rwy.corrected_length();
        assert!(corrected > 2500.0);
    }

    #[test]
    fn test_elevation_factor() {
        let rwy = RunwayDesign::new(2500.0, 2000.0, 25.0);
        
        let ef = rwy.elevation_factor();
        assert!(ef > 1.4);
    }

    #[test]
    fn test_runway_width() {
        let rwy = RunwayDesign::new(3000.0, 0.0, 15.0);
        
        assert!((rwy.runway_width() - 45.0).abs() < 1.0);
    }

    #[test]
    fn test_resa_length() {
        let rwy = RunwayDesign::new(3000.0, 0.0, 15.0);
        
        assert!(rwy.resa_length() >= 240.0);
    }
}
