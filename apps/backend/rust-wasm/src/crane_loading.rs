//! Crane and Lifting Operations Analysis
//! 
//! Comprehensive module for:
//! - Tower crane loads on structures
//! - Mobile crane outrigger loads
//! - Lifting lug design
//! - Load dynamics during lifting
//! 
//! Standards: BS 7121, ASME B30, EN 13001, CIRIA C703

use serde::{Deserialize, Serialize};

/// Tower crane load calculator
#[derive(Debug, Clone)]
pub struct TowerCraneAnalyzer {
    /// Crane specification
    pub crane: TowerCraneSpec,
}

/// Tower crane specification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TowerCraneSpec {
    /// Crane model/type
    pub model: String,
    /// Maximum jib radius (m)
    pub max_radius: f64,
    /// Minimum jib radius (m)
    pub min_radius: f64,
    /// Maximum capacity at min radius (tonnes)
    pub max_capacity: f64,
    /// Tip capacity at max radius (tonnes)
    pub tip_capacity: f64,
    /// Hook height (m)
    pub hook_height: f64,
    /// Tower height (m)
    pub tower_height: f64,
    /// Base type
    pub base_type: CraneBaseType,
    /// Self-weight (tonnes)
    pub self_weight: f64,
}

/// Crane base type
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum CraneBaseType {
    /// Fixed base (bolted to foundation)
    Fixed,
    /// Traveling on rails
    Traveling,
    /// Climbing crane (internal)
    ClimbingInternal,
    /// Climbing crane (external)
    ClimbingExternal,
}

impl TowerCraneAnalyzer {
    /// Create new analyzer
    pub fn new(crane: TowerCraneSpec) -> Self {
        Self { crane }
    }
    
    /// Calculate foundation loads
    pub fn calculate_foundation_loads(&self, operation: &LiftingOperation) -> FoundationLoads {
        // Vertical load
        let vertical = self.crane.self_weight * 9.81 + operation.lifted_weight * 9.81;
        
        // Overturning moment from lifted load
        let moment_load = operation.lifted_weight * 9.81 * operation.radius;
        
        // Counter-jib moment (approximately balanced)
        let moment_counter = moment_load * 0.8; // Simplification
        
        // Net overturning moment
        let net_moment = moment_load - moment_counter;
        
        // Wind loads
        let wind_load = self.calculate_wind_load(operation.wind_speed);
        let moment_wind = wind_load * self.crane.tower_height / 2.0;
        
        // Total moment
        let total_moment = (net_moment.powi(2) + moment_wind.powi(2)).sqrt();
        
        // Base reactions (assuming 4-point support)
        let base_size: f64 = 6.0; // m - typical base size
        let max_reaction = vertical / 4.0 + total_moment / (base_size * 2.0_f64.sqrt());
        let min_reaction = vertical / 4.0 - total_moment / (base_size * 2.0_f64.sqrt());
        
        FoundationLoads {
            vertical_load: vertical,
            overturning_moment: total_moment,
            max_leg_reaction: max_reaction,
            min_leg_reaction: min_reaction,
            horizontal_shear: wind_load,
            is_stable: min_reaction > 0.0,
        }
    }
    
    /// Calculate wind load on crane
    fn calculate_wind_load(&self, wind_speed: f64) -> f64 {
        // Simplified wind load calculation
        // F = 0.5 * ρ * Cd * A * V²
        let rho = 1.225; // kg/m³
        let cd = 1.2; // Drag coefficient
        
        // Approximate projected area
        let tower_area = self.crane.tower_height * 2.0; // m²
        let jib_area = self.crane.max_radius * 0.8; // m²
        
        0.5 * rho * cd * (tower_area + jib_area) * wind_speed.powi(2) / 1000.0 // kN
    }
    
    /// Calculate loads on climbing frame/structure
    pub fn calculate_climbing_loads(&self, floor_height: f64) -> ClimbingLoads {
        // Collar loads for external climbing crane
        let vertical_per_collar = self.crane.self_weight * 9.81 / 2.0; // Simplified
        
        // Horizontal load from overturning
        let typical_moment = self.crane.max_capacity * 9.81 * self.crane.max_radius * 0.5;
        let horizontal_load = typical_moment / floor_height;
        
        ClimbingLoads {
            collar_vertical: vertical_per_collar,
            collar_horizontal: horizontal_load,
            tie_force: horizontal_load * 1.5, // Safety factor
            floor_spacing: floor_height,
        }
    }
    
    /// Check lift capacity at radius
    pub fn check_capacity(&self, radius: f64, load_weight: f64) -> CapacityCheck {
        // Interpolate capacity based on radius
        let capacity = if radius <= self.crane.min_radius {
            self.crane.max_capacity
        } else if radius >= self.crane.max_radius {
            self.crane.tip_capacity
        } else {
            // Linear interpolation (simplified - actual charts are non-linear)
            let ratio = (radius - self.crane.min_radius) / 
                       (self.crane.max_radius - self.crane.min_radius);
            self.crane.max_capacity - ratio * (self.crane.max_capacity - self.crane.tip_capacity)
        };
        
        let utilization = load_weight / capacity;
        
        CapacityCheck {
            radius,
            load_weight,
            capacity_at_radius: capacity,
            utilization,
            is_within_capacity: utilization <= 1.0,
        }
    }
}

/// Foundation loads result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FoundationLoads {
    /// Total vertical load (kN)
    pub vertical_load: f64,
    /// Overturning moment (kN.m)
    pub overturning_moment: f64,
    /// Maximum leg reaction (kN)
    pub max_leg_reaction: f64,
    /// Minimum leg reaction (kN)
    pub min_leg_reaction: f64,
    /// Horizontal shear (kN)
    pub horizontal_shear: f64,
    /// Is crane stable (no uplift)
    pub is_stable: bool,
}

/// Climbing crane loads
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClimbingLoads {
    /// Vertical load per collar (kN)
    pub collar_vertical: f64,
    /// Horizontal load per collar (kN)
    pub collar_horizontal: f64,
    /// Tie force to structure (kN)
    pub tie_force: f64,
    /// Floor spacing (m)
    pub floor_spacing: f64,
}

/// Lifting operation parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiftingOperation {
    /// Weight being lifted (tonnes)
    pub lifted_weight: f64,
    /// Operating radius (m)
    pub radius: f64,
    /// Wind speed during operation (m/s)
    pub wind_speed: f64,
    /// Dynamic factor
    pub dynamic_factor: f64,
}

/// Capacity check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapacityCheck {
    pub radius: f64,
    pub load_weight: f64,
    pub capacity_at_radius: f64,
    pub utilization: f64,
    pub is_within_capacity: bool,
}

/// Mobile crane analyzer
#[derive(Debug, Clone)]
pub struct MobileCraneAnalyzer {
    /// Crane specification
    pub crane: MobileCraneSpec,
}

/// Mobile crane specification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MobileCraneSpec {
    /// Crane model
    pub model: String,
    /// Maximum capacity (tonnes)
    pub max_capacity: f64,
    /// Boom length (m)
    pub boom_length: f64,
    /// Number of outriggers
    pub num_outriggers: usize,
    /// Outrigger span (m)
    pub outrigger_span: f64,
    /// Self-weight (tonnes)
    pub self_weight: f64,
    /// Counterweight (tonnes)
    pub counterweight: f64,
}

impl MobileCraneAnalyzer {
    /// Create new analyzer
    pub fn new(crane: MobileCraneSpec) -> Self {
        Self { crane }
    }
    
    /// Calculate outrigger reactions
    pub fn calculate_outrigger_loads(&self, operation: &MobileLiftOperation) -> OutriggerLoads {
        // Total vertical load
        let total_vertical = (self.crane.self_weight + self.crane.counterweight + 
                             operation.lifted_weight) * 9.81;
        
        // Moment about CG
        let lift_moment = operation.lifted_weight * 9.81 * operation.radius;
        let counterweight_moment = self.crane.counterweight * 9.81 * 2.0; // Approximate offset
        
        let net_moment = lift_moment - counterweight_moment;
        
        // Outrigger reactions (assuming 4 outriggers in rectangle)
        let span = self.crane.outrigger_span;
        let base_reaction = total_vertical / 4.0;
        
        // Adjust for moment (simplified for swing direction)
        let moment_reaction = net_moment / (span * 2.0_f64.sqrt());
        
        let max_reaction = base_reaction + moment_reaction;
        let min_reaction = base_reaction - moment_reaction;
        
        // Ground bearing pressure
        let pad_size = 1.0; // m - typical pad size
        let max_pressure = max_reaction / (pad_size * pad_size);
        
        OutriggerLoads {
            max_reaction,
            min_reaction,
            ground_pressure: max_pressure,
            is_stable: min_reaction >= 0.0,
            reactions: vec![
                max_reaction,
                base_reaction + moment_reaction * 0.5,
                base_reaction - moment_reaction * 0.5,
                min_reaction,
            ],
        }
    }
    
    /// Calculate pick and carry loads (crane on wheels)
    pub fn calculate_pick_carry_loads(&self, operation: &MobileLiftOperation) -> WheelLoads {
        // Axle loads during travel
        let total_weight = (self.crane.self_weight + operation.lifted_weight) * 9.81;
        
        // Front/rear distribution based on CG shift
        let cg_shift = operation.lifted_weight * operation.radius / 
                       (self.crane.self_weight + operation.lifted_weight);
        
        // Approximate axle loads
        let wheelbase = 5.0; // m - typical
        let front_load = total_weight * (wheelbase / 2.0 + cg_shift) / wheelbase;
        let rear_load = total_weight - front_load;
        
        WheelLoads {
            front_axle: front_load,
            rear_axle: rear_load,
            total: total_weight,
            per_wheel_max: front_load.max(rear_load) / 2.0,
        }
    }
}

/// Mobile lift operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MobileLiftOperation {
    /// Lifted weight (tonnes)
    pub lifted_weight: f64,
    /// Operating radius (m)
    pub radius: f64,
    /// Boom angle (degrees)
    pub boom_angle: f64,
    /// Swing angle (degrees from front)
    pub swing_angle: f64,
}

/// Outrigger loads result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutriggerLoads {
    /// Maximum outrigger reaction (kN)
    pub max_reaction: f64,
    /// Minimum outrigger reaction (kN)
    pub min_reaction: f64,
    /// Ground bearing pressure (kPa)
    pub ground_pressure: f64,
    /// Is crane stable
    pub is_stable: bool,
    /// Individual reactions
    pub reactions: Vec<f64>,
}

/// Wheel loads for pick and carry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WheelLoads {
    pub front_axle: f64,
    pub rear_axle: f64,
    pub total: f64,
    pub per_wheel_max: f64,
}

/// Lifting lug designer per ASME BTH-1
#[derive(Debug, Clone)]
pub struct LiftingLugDesigner;

impl LiftingLugDesigner {
    /// Design lifting lug
    pub fn design_lug(&self, params: &LugParams) -> LugDesign {
        let design_load = params.lifted_weight * params.dynamic_factor * 9.81 / 
                         params.num_lugs as f64;
        
        // Add inclination effect
        let _vertical_load = design_load * params.sling_angle.to_radians().cos();
        let horizontal_load = design_load * params.sling_angle.to_radians().sin();
        
        // Required hole diameter (shackle pin)
        let pin_diameter = self.select_pin_diameter(design_load);
        
        // Lug dimensions based on ASME BTH-1
        let lug = self.size_lug(design_load, pin_diameter, params.material_fy);
        
        // Check all failure modes
        let checks = self.check_all_modes(&lug, design_load, horizontal_load, params.material_fy);
        
        // Check if adequate before moving checks
        let is_adequate = checks.all_pass();
        
        LugDesign {
            design_load,
            pin_diameter,
            hole_diameter: pin_diameter + 2.0, // 2mm clearance
            lug_width: lug.width,
            lug_thickness: lug.thickness,
            edge_distance: lug.edge_distance,
            weld_size: self.calculate_weld_size(design_load, lug.thickness, params.material_fy),
            checks,
            is_adequate,
        }
    }
    
    fn select_pin_diameter(&self, load_kn: f64) -> f64 {
        // Select shackle based on load
        if load_kn < 50.0 {
            19.0  // 3/4" shackle
        } else if load_kn < 100.0 {
            25.0  // 1" shackle
        } else if load_kn < 200.0 {
            32.0  // 1-1/4" shackle
        } else if load_kn < 400.0 {
            44.0  // 1-3/4" shackle
        } else {
            57.0  // 2-1/4" shackle
        }
    }
    
    fn size_lug(&self, load_kn: f64, pin_dia: f64, fy: f64) -> LugDimensions {
        // ASME BTH-1 minimum dimensions
        
        // Width = 2 * edge distance
        // Edge distance >= 0.67 * d_hole + t (simplified)
        let hole_dia = pin_dia + 2.0;
        
        // Thickness based on bearing stress
        // σ_bearing = P / (d * t) < 1.25 * Fy
        let t_min_bearing = load_kn * 1000.0 / (pin_dia * 1.25 * fy);
        
        // Round up to standard thickness
        let thickness = self.round_to_standard_thickness(t_min_bearing);
        
        // Edge distance per BTH-1
        let edge_distance = (0.67 * hole_dia + thickness).max(hole_dia);
        
        // Width
        let width = 2.0 * edge_distance;
        
        LugDimensions {
            width,
            thickness,
            edge_distance,
        }
    }
    
    fn round_to_standard_thickness(&self, t: f64) -> f64 {
        let standards = [10.0, 12.0, 16.0, 20.0, 25.0, 32.0, 40.0, 50.0];
        for &std in &standards {
            if std >= t {
                return std;
            }
        }
        50.0
    }
    
    fn check_all_modes(&self, lug: &LugDimensions, load: f64, _h_load: f64, fy: f64) -> LugChecks {
        let hole_dia = lug.edge_distance; // Approximate
        
        // Tensile stress at net section
        let net_area = (lug.width - hole_dia) * lug.thickness;
        let tensile_stress = load * 1000.0 / net_area;
        let tensile_ratio = tensile_stress / (0.6 * fy);
        
        // Bearing stress
        let bearing_area = hole_dia * lug.thickness;
        let bearing_stress = load * 1000.0 / bearing_area;
        let bearing_ratio = bearing_stress / (1.25 * fy);
        
        // Shear at pin hole (double shear path)
        let shear_area = 2.0 * (lug.edge_distance - hole_dia / 2.0) * lug.thickness;
        let shear_stress = load * 1000.0 / shear_area;
        let shear_ratio = shear_stress / (0.4 * fy);
        
        // Combined stress (simplified)
        let combined_ratio = (tensile_ratio.powi(2) + shear_ratio.powi(2)).sqrt();
        
        LugChecks {
            tensile_ratio,
            bearing_ratio,
            shear_ratio,
            combined_ratio,
        }
    }
    
    fn calculate_weld_size(&self, load: f64, plate_thickness: f64, fy: f64) -> f64 {
        // Fillet weld to base plate
        let weld_strength = 0.6 * 0.707 * 0.6 * fy; // kN/mm²
        let weld_length = plate_thickness * 2.0; // Approximate
        
        let required_size = load / (weld_length * weld_strength);
        
        // Round up to standard size
        let standards = [5.0, 6.0, 8.0, 10.0, 12.0];
        for &std in &standards {
            if std >= required_size {
                return std;
            }
        }
        12.0
    }
}

/// Lug design parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LugParams {
    /// Lifted weight (tonnes)
    pub lifted_weight: f64,
    /// Number of lifting points
    pub num_lugs: usize,
    /// Sling angle from vertical (degrees)
    pub sling_angle: f64,
    /// Dynamic amplification factor
    pub dynamic_factor: f64,
    /// Material yield strength (MPa)
    pub material_fy: f64,
}

/// Lug dimensions
#[derive(Debug, Clone)]
struct LugDimensions {
    width: f64,
    thickness: f64,
    edge_distance: f64,
}

/// Lug design result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LugDesign {
    /// Design load per lug (kN)
    pub design_load: f64,
    /// Shackle pin diameter (mm)
    pub pin_diameter: f64,
    /// Hole diameter (mm)
    pub hole_diameter: f64,
    /// Lug width (mm)
    pub lug_width: f64,
    /// Lug thickness (mm)
    pub lug_thickness: f64,
    /// Edge distance (mm)
    pub edge_distance: f64,
    /// Weld size (mm)
    pub weld_size: f64,
    /// Design checks
    pub checks: LugChecks,
    /// Is design adequate
    pub is_adequate: bool,
}

/// Lug design checks
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LugChecks {
    /// Tensile stress ratio
    pub tensile_ratio: f64,
    /// Bearing stress ratio
    pub bearing_ratio: f64,
    /// Shear stress ratio
    pub shear_ratio: f64,
    /// Combined stress ratio
    pub combined_ratio: f64,
}

impl LugChecks {
    pub fn all_pass(&self) -> bool {
        self.tensile_ratio <= 1.0 &&
        self.bearing_ratio <= 1.0 &&
        self.shear_ratio <= 1.0 &&
        self.combined_ratio <= 1.0
    }
}

/// Lift dynamics analyzer
#[derive(Debug, Clone)]
pub struct LiftDynamicsAnalyzer;

impl LiftDynamicsAnalyzer {
    /// Calculate dynamic amplification factor
    pub fn calculate_daf(&self, params: &LiftDynamicParams) -> DynamicAmplification {
        // Based on BS 7121 / EN 13001
        
        // Hoisting factor φ2
        let vh = params.hoist_speed; // m/min
        let phi_2 = match params.hoist_class {
            HoistClass::HC1 => 1.05 + 0.005 * vh,
            HoistClass::HC2 => 1.10 + 0.005 * vh,
            HoistClass::HC3 => 1.15 + 0.010 * vh,
            HoistClass::HC4 => 1.20 + 0.010 * vh,
        };
        
        // Dynamic factor for sudden release φ4
        let phi_4 = if params.sudden_release {
            1.3
        } else {
            1.0
        };
        
        // Travel/slewing dynamics φ5
        let phi_5 = if params.travel_speed > 0.0 {
            1.0 + 0.1 * params.travel_speed / 100.0
        } else {
            1.0
        };
        
        // Combined DAF
        let total_daf = phi_2 * phi_4 * phi_5;
        
        DynamicAmplification {
            phi_2_hoist: phi_2,
            phi_4_release: phi_4,
            phi_5_travel: phi_5,
            total_daf,
            design_factor: total_daf.max(1.1), // Minimum 1.1
        }
    }
    
    /// Calculate sling forces
    pub fn calculate_sling_forces(&self, params: &SlingParams) -> SlingForces {
        let total_weight = params.lifted_weight * 9.81; // kN
        
        // Force per leg
        let num_legs = params.num_legs as f64;
        let angle_rad = params.angle_from_vertical.to_radians();
        
        // Tension in each sling
        let tension_per_leg = total_weight / (num_legs * angle_rad.cos());
        
        // Horizontal component (spreads load)
        let horizontal_per_leg = tension_per_leg * angle_rad.sin();
        
        // Effective width reduction factor
        let efficiency = if params.num_legs > 2 {
            0.75 // 4-leg sling efficiency
        } else {
            1.0
        };
        
        SlingForces {
            tension_per_leg: tension_per_leg / efficiency,
            horizontal_per_leg,
            total_tension: tension_per_leg * num_legs / efficiency,
            required_swl: tension_per_leg / efficiency / 9.81, // tonnes
            sling_angle: params.angle_from_vertical,
        }
    }
}

/// Lift dynamic parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiftDynamicParams {
    /// Hoist speed (m/min)
    pub hoist_speed: f64,
    /// Hoist class
    pub hoist_class: HoistClass,
    /// Sudden release possible
    pub sudden_release: bool,
    /// Travel speed (m/min)
    pub travel_speed: f64,
}

/// Hoist class per EN 13001
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum HoistClass {
    HC1, // Slow
    HC2, // Medium
    HC3, // Medium-fast
    HC4, // Fast
}

/// Dynamic amplification result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DynamicAmplification {
    pub phi_2_hoist: f64,
    pub phi_4_release: f64,
    pub phi_5_travel: f64,
    pub total_daf: f64,
    pub design_factor: f64,
}

/// Sling configuration parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlingParams {
    /// Lifted weight (tonnes)
    pub lifted_weight: f64,
    /// Number of sling legs
    pub num_legs: usize,
    /// Angle from vertical (degrees)
    pub angle_from_vertical: f64,
}

/// Sling forces result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlingForces {
    /// Tension per sling leg (kN)
    pub tension_per_leg: f64,
    /// Horizontal force per leg (kN)
    pub horizontal_per_leg: f64,
    /// Total tension in all legs (kN)
    pub total_tension: f64,
    /// Required Safe Working Load (tonnes)
    pub required_swl: f64,
    /// Sling angle used
    pub sling_angle: f64,
}

/// Tandem lift analyzer
#[derive(Debug, Clone)]
pub struct TandemLiftAnalyzer;

impl TandemLiftAnalyzer {
    /// Analyze tandem lift configuration
    pub fn analyze_tandem_lift(&self, params: &TandemLiftParams) -> TandemLiftResult {
        let total_weight = params.lifted_weight * 9.81;
        
        // Load sharing based on geometry
        let total_distance = params.crane_positions.1 - params.crane_positions.0;
        let cg_offset = params.cg_position - params.crane_positions.0;
        
        // Load on each crane (simple beam analogy)
        let load_crane_2 = total_weight * cg_offset / total_distance;
        let load_crane_1 = total_weight - load_crane_2;
        
        // Add tolerance for load shifting
        let tolerance = 0.1; // 10% tolerance
        let max_load_1 = load_crane_1 * (1.0 + tolerance);
        let max_load_2 = load_crane_2 * (1.0 + tolerance);
        
        // Check crane capacities
        let crane_1_ok = max_load_1 / 9.81 <= params.crane_1_capacity;
        let crane_2_ok = max_load_2 / 9.81 <= params.crane_2_capacity;
        
        TandemLiftResult {
            load_crane_1: load_crane_1 / 9.81, // tonnes
            load_crane_2: load_crane_2 / 9.81,
            max_load_crane_1: max_load_1 / 9.81,
            max_load_crane_2: max_load_2 / 9.81,
            load_share_ratio: load_crane_1 / load_crane_2,
            is_feasible: crane_1_ok && crane_2_ok,
            coordination_critical: true,
        }
    }
}

/// Tandem lift parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TandemLiftParams {
    /// Lifted weight (tonnes)
    pub lifted_weight: f64,
    /// Crane positions along load (m)
    pub crane_positions: (f64, f64),
    /// CG position (m)
    pub cg_position: f64,
    /// Crane 1 capacity (tonnes)
    pub crane_1_capacity: f64,
    /// Crane 2 capacity (tonnes)
    pub crane_2_capacity: f64,
}

/// Tandem lift result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TandemLiftResult {
    /// Load on crane 1 (tonnes)
    pub load_crane_1: f64,
    /// Load on crane 2 (tonnes)
    pub load_crane_2: f64,
    /// Maximum load on crane 1 with tolerance (tonnes)
    pub max_load_crane_1: f64,
    /// Maximum load on crane 2 with tolerance (tonnes)
    pub max_load_crane_2: f64,
    /// Load sharing ratio
    pub load_share_ratio: f64,
    /// Is lift feasible
    pub is_feasible: bool,
    /// Is coordination critical
    pub coordination_critical: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_tower_crane_foundation_loads() {
        let crane = TowerCraneSpec {
            model: "Liebherr 280 EC-H".to_string(),
            max_radius: 70.0,
            min_radius: 10.0,
            max_capacity: 12.0,
            tip_capacity: 2.8,
            hook_height: 60.0,
            tower_height: 50.0,
            base_type: CraneBaseType::Fixed,
            self_weight: 150.0,
        };
        
        let analyzer = TowerCraneAnalyzer::new(crane);
        
        let operation = LiftingOperation {
            lifted_weight: 5.0,
            radius: 40.0,
            wind_speed: 10.0,
            dynamic_factor: 1.2,
        };
        
        let loads = analyzer.calculate_foundation_loads(&operation);
        
        assert!(loads.vertical_load > 0.0);
        assert!(loads.is_stable);
    }
    
    #[test]
    fn test_crane_capacity_check() {
        let crane = TowerCraneSpec {
            model: "Test Crane".to_string(),
            max_radius: 50.0,
            min_radius: 10.0,
            max_capacity: 10.0,
            tip_capacity: 2.0,
            hook_height: 40.0,
            tower_height: 35.0,
            base_type: CraneBaseType::Fixed,
            self_weight: 100.0,
        };
        
        let analyzer = TowerCraneAnalyzer::new(crane);
        
        // Check at mid radius
        let check = analyzer.check_capacity(30.0, 5.0);
        assert!(check.is_within_capacity);
        
        // Check overload at tip
        let check_overload = analyzer.check_capacity(50.0, 3.0);
        assert!(!check_overload.is_within_capacity);
    }
    
    #[test]
    fn test_mobile_crane_outrigger_loads() {
        let crane = MobileCraneSpec {
            model: "Grove GMK5250L".to_string(),
            max_capacity: 250.0,
            boom_length: 70.0,
            num_outriggers: 4,
            outrigger_span: 8.5,
            self_weight: 60.0,
            counterweight: 100.0,
        };
        
        let analyzer = MobileCraneAnalyzer::new(crane);
        
        let operation = MobileLiftOperation {
            lifted_weight: 50.0,
            radius: 20.0,
            boom_angle: 70.0,
            swing_angle: 0.0,
        };
        
        let loads = analyzer.calculate_outrigger_loads(&operation);
        
        assert!(loads.max_reaction > 0.0);
        assert_eq!(loads.reactions.len(), 4);
    }
    
    #[test]
    fn test_lifting_lug_design() {
        let designer = LiftingLugDesigner;
        
        let params = LugParams {
            lifted_weight: 5.0,  // Lighter load for reliable design
            num_lugs: 4,
            sling_angle: 30.0,
            dynamic_factor: 1.2,
            material_fy: 250.0,
        };
        
        let design = designer.design_lug(&params);
        
        assert!(design.lug_thickness > 0.0, "Lug thickness should be positive");
        assert!(design.design_load > 0.0, "Design load should be positive");
    }
    
    #[test]
    fn test_dynamic_amplification() {
        let analyzer = LiftDynamicsAnalyzer;
        
        let params = LiftDynamicParams {
            hoist_speed: 20.0,
            hoist_class: HoistClass::HC2,
            sudden_release: false,
            travel_speed: 0.0,
        };
        
        let daf = analyzer.calculate_daf(&params);
        
        assert!(daf.total_daf >= 1.0);
        assert!(daf.design_factor >= 1.1);
    }
    
    #[test]
    fn test_sling_forces() {
        let analyzer = LiftDynamicsAnalyzer;
        
        let params = SlingParams {
            lifted_weight: 10.0,
            num_legs: 4,
            angle_from_vertical: 45.0,
        };
        
        let forces = analyzer.calculate_sling_forces(&params);
        
        assert!(forces.tension_per_leg > 0.0);
        assert!(forces.required_swl > 0.0);
        // Tension should be greater than weight/4 due to angle
        assert!(forces.tension_per_leg > 10.0 * 9.81 / 4.0);
    }
    
    #[test]
    fn test_tandem_lift() {
        let analyzer = TandemLiftAnalyzer;
        
        let params = TandemLiftParams {
            lifted_weight: 100.0,
            crane_positions: (0.0, 20.0),
            cg_position: 10.0, // Centered
            crane_1_capacity: 60.0,
            crane_2_capacity: 60.0,
        };
        
        let result = analyzer.analyze_tandem_lift(&params);
        
        // Should be roughly equal split
        assert!((result.load_crane_1 - result.load_crane_2).abs() < 1.0);
        assert!(result.is_feasible);
    }
    
    #[test]
    fn test_tandem_lift_asymmetric() {
        let analyzer = TandemLiftAnalyzer;
        
        let params = TandemLiftParams {
            lifted_weight: 100.0,
            crane_positions: (0.0, 20.0),
            cg_position: 5.0, // Offset toward crane 1
            crane_1_capacity: 80.0,
            crane_2_capacity: 40.0,
        };
        
        let result = analyzer.analyze_tandem_lift(&params);
        
        // Crane 1 should carry more
        assert!(result.load_crane_1 > result.load_crane_2);
    }
    
    #[test]
    fn test_climbing_crane_loads() {
        let crane = TowerCraneSpec {
            model: "Climbing Crane".to_string(),
            max_radius: 60.0,
            min_radius: 8.0,
            max_capacity: 8.0,
            tip_capacity: 1.8,
            hook_height: 80.0,
            tower_height: 80.0,
            base_type: CraneBaseType::ClimbingExternal,
            self_weight: 120.0,
        };
        
        let analyzer = TowerCraneAnalyzer::new(crane);
        let loads = analyzer.calculate_climbing_loads(4.0);
        
        assert!(loads.collar_vertical > 0.0);
        assert!(loads.tie_force > 0.0);
    }
    
    #[test]
    fn test_pick_and_carry() {
        let crane = MobileCraneSpec {
            model: "Pick Carry".to_string(),
            max_capacity: 50.0,
            boom_length: 30.0,
            num_outriggers: 4,
            outrigger_span: 6.0,
            self_weight: 40.0,
            counterweight: 20.0,
        };
        
        let analyzer = MobileCraneAnalyzer::new(crane);
        
        let operation = MobileLiftOperation {
            lifted_weight: 10.0,
            radius: 8.0,
            boom_angle: 60.0,
            swing_angle: 0.0,
        };
        
        let wheel_loads = analyzer.calculate_pick_carry_loads(&operation);
        
        assert!(wheel_loads.total > 0.0);
        assert!((wheel_loads.front_axle + wheel_loads.rear_axle - wheel_loads.total).abs() < 0.1);
    }
    
    #[test]
    fn test_lug_check_combined() {
        let checks = LugChecks {
            tensile_ratio: 0.7,
            bearing_ratio: 0.8,
            shear_ratio: 0.6,
            combined_ratio: 0.85,
        };
        
        assert!(checks.all_pass());
        
        let failing_checks = LugChecks {
            tensile_ratio: 1.1,
            bearing_ratio: 0.8,
            shear_ratio: 0.6,
            combined_ratio: 0.9,
        };
        
        assert!(!failing_checks.all_pass());
    }
}
