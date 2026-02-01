//! Impact Analysis Module
//! 
//! Implements vehicle, vessel, and object impact analysis per:
//! - EN 1991-1-7 (Accidental Actions)
//! - AASHTO LRFD Bridge Design
//! - Eurocode 1 Part 2-7
//! - Progressive damage assessment

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// IMPACT SOURCE DEFINITIONS
// ============================================================================

/// Impact source type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ImpactType {
    /// Vehicle impact (cars, trucks)
    Vehicle,
    /// Ship/vessel impact
    Ship,
    /// Train/rail vehicle
    Train,
    /// Forklift/industrial vehicle
    Forklift,
    /// Aircraft impact
    Aircraft,
    /// Dropped object
    DroppedObject,
    /// Crane load drop
    CraneDrop,
    /// Debris/projectile
    Debris,
    /// Rockfall
    Rockfall,
}

/// Vehicle category per EN 1991-1-7
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum VehicleCategory {
    /// Passenger car
    PassengerCar,
    /// Light goods vehicle
    LightGoods,
    /// Heavy goods vehicle
    HeavyGoods,
    /// Bus/coach
    Bus,
    /// Tanker
    Tanker,
    /// Abnormal load
    AbnormalLoad,
}

impl VehicleCategory {
    /// Mass (kg)
    pub fn mass(&self) -> f64 {
        match self {
            Self::PassengerCar => 1500.0,
            Self::LightGoods => 3500.0,
            Self::HeavyGoods => 40000.0,
            Self::Bus => 18000.0,
            Self::Tanker => 40000.0,
            Self::AbnormalLoad => 80000.0,
        }
    }
    
    /// Design speed (m/s)
    pub fn design_speed(&self) -> f64 {
        match self {
            Self::PassengerCar => 30.0, // 110 km/h
            Self::LightGoods => 25.0,
            Self::HeavyGoods => 20.0,
            Self::Bus => 20.0,
            Self::Tanker => 15.0,
            Self::AbnormalLoad => 10.0,
        }
    }
    
    /// Contact height (m)
    pub fn contact_height(&self) -> f64 {
        match self {
            Self::PassengerCar => 0.5,
            Self::LightGoods => 0.5,
            Self::HeavyGoods => 1.25,
            Self::Bus => 0.5,
            Self::Tanker => 1.25,
            Self::AbnormalLoad => 1.25,
        }
    }
    
    /// Frontal deformation (m) - crush depth
    pub fn deformation_depth(&self) -> f64 {
        match self {
            Self::PassengerCar => 0.6,
            Self::LightGoods => 0.5,
            Self::HeavyGoods => 0.4,
            Self::Bus => 0.5,
            Self::Tanker => 0.4,
            Self::AbnormalLoad => 0.3,
        }
    }
}

/// Ship category
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ShipCategory {
    /// Small craft
    SmallCraft,
    /// Inland waterway vessel
    InlandVessel,
    /// Coastal vessel
    CoastalVessel,
    /// Ocean-going vessel
    OceanVessel,
    /// VLCC/ULCC tanker
    Tanker,
    /// Container ship
    Container,
}

impl ShipCategory {
    /// Displacement (tonnes)
    pub fn displacement(&self) -> f64 {
        match self {
            Self::SmallCraft => 50.0,
            Self::InlandVessel => 3000.0,
            Self::CoastalVessel => 15000.0,
            Self::OceanVessel => 50000.0,
            Self::Tanker => 200000.0,
            Self::Container => 100000.0,
        }
    }
    
    /// Design speed (m/s)
    pub fn design_speed(&self) -> f64 {
        match self {
            Self::SmallCraft => 8.0,
            Self::InlandVessel => 4.0,
            Self::CoastalVessel => 5.0,
            Self::OceanVessel => 7.0,
            Self::Tanker => 6.0,
            Self::Container => 8.0,
        }
    }
    
    /// Bow height (m)
    pub fn bow_height(&self) -> f64 {
        match self {
            Self::SmallCraft => 2.0,
            Self::InlandVessel => 3.0,
            Self::CoastalVessel => 6.0,
            Self::OceanVessel => 10.0,
            Self::Tanker => 15.0,
            Self::Container => 12.0,
        }
    }
}

// ============================================================================
// IMPACT LOADING
// ============================================================================

/// Impact force calculation parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImpactParameters {
    /// Impact type
    pub impact_type: ImpactType,
    /// Impacting mass (kg)
    pub mass: f64,
    /// Impact velocity (m/s)
    pub velocity: f64,
    /// Impact angle (degrees from normal)
    pub angle: f64,
    /// Contact area (m²)
    pub contact_area: f64,
    /// Deformation depth (m)
    pub deformation: f64,
    /// Dynamic factor
    pub dynamic_factor: f64,
}

impl ImpactParameters {
    /// Create vehicle impact parameters
    pub fn vehicle(category: VehicleCategory, angle: f64) -> Self {
        Self {
            impact_type: ImpactType::Vehicle,
            mass: category.mass(),
            velocity: category.design_speed(),
            angle,
            contact_area: 0.5, // Typical frontal area
            deformation: category.deformation_depth(),
            dynamic_factor: 1.4,
        }
    }
    
    /// Create ship impact parameters
    pub fn ship(category: ShipCategory, angle: f64) -> Self {
        Self {
            impact_type: ImpactType::Ship,
            mass: category.displacement() * 1000.0, // tonnes to kg
            velocity: category.design_speed(),
            angle,
            contact_area: 10.0, // Bow contact area
            deformation: 1.0,
            dynamic_factor: 1.25,
        }
    }
    
    /// Create dropped object parameters
    pub fn dropped_object(mass: f64, drop_height: f64) -> Self {
        let velocity = (2.0 * 9.81 * drop_height).sqrt();
        
        Self {
            impact_type: ImpactType::DroppedObject,
            mass,
            velocity,
            angle: 0.0,
            contact_area: 0.1,
            deformation: 0.05,
            dynamic_factor: 2.0,
        }
    }
    
    /// Kinetic energy (kJ)
    pub fn kinetic_energy(&self) -> f64 {
        0.5 * self.mass * self.velocity.powi(2) / 1000.0
    }
    
    /// Normal component of velocity
    pub fn normal_velocity(&self) -> f64 {
        self.velocity * (self.angle * PI / 180.0).cos()
    }
    
    /// Momentum (kN·s)
    pub fn momentum(&self) -> f64 {
        self.mass * self.velocity / 1000.0
    }
}

/// Impact force calculation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImpactForce {
    /// Peak force (kN)
    pub peak_force: f64,
    /// Static equivalent force (kN)
    pub static_equivalent: f64,
    /// Impact duration (ms)
    pub duration: f64,
    /// Force per unit width (kN/m)
    pub force_per_width: f64,
    /// Contact pressure (MPa)
    pub contact_pressure: f64,
    /// Impulse (kN·s)
    pub impulse: f64,
}

impl ImpactForce {
    /// Calculate using energy method (EN 1991-1-7)
    pub fn energy_method(params: &ImpactParameters, structure_stiffness: f64) -> Self {
        let ke = params.kinetic_energy();
        let _vn = params.normal_velocity();
        
        // Equivalent static force from energy balance
        // F_eq = sqrt(2 * k * KE) where k is structure stiffness
        let f_eq = (2.0 * structure_stiffness * ke).sqrt();
        
        // Peak force with dynamic amplification
        let f_peak = f_eq * params.dynamic_factor;
        
        // Duration from momentum conservation
        let duration = params.momentum() / f_peak * 1000.0; // ms
        
        // Contact width estimate
        let width = params.contact_area.sqrt();
        
        // Contact pressure
        let pressure = f_peak / params.contact_area * 1000.0; // kPa to MPa
        
        Self {
            peak_force: f_peak,
            static_equivalent: f_eq,
            duration,
            force_per_width: f_peak / width,
            contact_pressure: pressure / 1000.0,
            impulse: params.momentum(),
        }
    }
    
    /// Calculate using force-deformation method
    pub fn deformation_method(params: &ImpactParameters, object_stiffness: f64) -> Self {
        let vn = params.normal_velocity();
        let m = params.mass;
        let k = object_stiffness;
        
        // Peak force = v * sqrt(m * k)
        let f_peak = vn * (m * k).sqrt() / 1000.0;
        
        // Duration = pi * sqrt(m/k)
        let duration = PI * (m / k).sqrt() * 1000.0;
        
        let width = params.contact_area.sqrt();
        
        Self {
            peak_force: f_peak,
            static_equivalent: f_peak / params.dynamic_factor,
            duration,
            force_per_width: f_peak / width,
            contact_pressure: f_peak / params.contact_area,
            impulse: params.momentum(),
        }
    }
    
    /// EN 1991-1-7 vehicle impact forces
    pub fn en_vehicle(category: VehicleCategory, hard_impact: bool) -> Self {
        // Annex C forces (kN)
        let (f_dx, _f_dy) = match category {
            VehicleCategory::PassengerCar => {
                if hard_impact { (500.0, 250.0) } else { (80.0, 40.0) }
            }
            VehicleCategory::LightGoods => {
                if hard_impact { (750.0, 375.0) } else { (150.0, 75.0) }
            }
            VehicleCategory::HeavyGoods => {
                if hard_impact { (1500.0, 750.0) } else { (500.0, 250.0) }
            }
            VehicleCategory::Bus => {
                if hard_impact { (1000.0, 500.0) } else { (300.0, 150.0) }
            }
            VehicleCategory::Tanker => {
                if hard_impact { (1500.0, 750.0) } else { (500.0, 250.0) }
            }
            VehicleCategory::AbnormalLoad => {
                if hard_impact { (2000.0, 1000.0) } else { (600.0, 300.0) }
            }
        };
        
        Self {
            peak_force: f_dx,
            static_equivalent: f_dx,
            duration: if hard_impact { 50.0 } else { 200.0 },
            force_per_width: f_dx / 0.5,
            contact_pressure: f_dx / 0.25, // Approximate contact area 0.5 x 0.5
            impulse: f_dx * if hard_impact { 0.05 } else { 0.2 },
        }
    }
    
    /// AASHTO vehicle collision force
    pub fn aashto_vehicle(structure_type: &str) -> Self {
        let f = match structure_type {
            "bridge_pier" => 2670.0, // 600 kips
            "bridge_abutment" => 1780.0, // 400 kips
            "sign_structure" => 1780.0,
            _ => 1780.0,
        };
        
        Self {
            peak_force: f,
            static_equivalent: f,
            duration: 100.0,
            force_per_width: f / 1.2,
            contact_pressure: f / 1.0,
            impulse: f * 0.1,
        }
    }
}

// ============================================================================
// SHIP IMPACT (EN 1991-1-7 ANNEX C)
// ============================================================================

/// Ship impact analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShipImpact {
    /// Ship category
    pub category: ShipCategory,
    /// Ship displacement (tonnes)
    pub displacement: f64,
    /// Impact velocity (m/s)
    pub velocity: f64,
    /// Impact angle (degrees)
    pub angle: f64,
    /// Bow shape factor
    pub bow_factor: f64,
    /// Added mass coefficient
    pub added_mass: f64,
}

impl ShipImpact {
    pub fn new(category: ShipCategory, velocity: f64, angle: f64) -> Self {
        Self {
            category,
            displacement: category.displacement(),
            velocity,
            angle,
            bow_factor: 1.0,
            added_mass: 1.1, // Typically 5-20% added mass
        }
    }
    
    /// Effective mass including added mass (tonnes)
    pub fn effective_mass(&self) -> f64 {
        self.displacement * self.added_mass
    }
    
    /// Impact force - head-on collision (MN)
    pub fn head_on_force(&self) -> f64 {
        // EN 1991-1-7 Eq. C.4
        let _m = self.effective_mass();
        let v = self.velocity;
        
        // F = 0.88 * sqrt(DWT) * v + 0.02 * DWT for head-on
        let dwt = self.displacement * 0.7; // Approximate DWT from displacement
        
        0.88 * dwt.sqrt() * v + 0.02 * dwt
    }
    
    /// Impact force - bow collision (MN)
    pub fn bow_force(&self) -> f64 {
        // Bow crushing force
        let dwt = self.displacement * 0.7;
        
        // Simplified Pedersen formula
        0.5 * dwt.powf(0.7) * self.velocity.powf(0.6)
    }
    
    /// Impact force - side collision (MN)
    pub fn side_force(&self) -> f64 {
        // Typically 50-70% of head-on force
        0.6 * self.head_on_force()
    }
    
    /// Glancing blow force (MN)
    pub fn glancing_force(&self) -> f64 {
        let angle_rad = self.angle * PI / 180.0;
        self.head_on_force() * angle_rad.cos().powi(2)
    }
    
    /// Crushing depth (m)
    pub fn crushing_depth(&self) -> f64 {
        let force = self.bow_force();
        
        // Approximate from force-penetration curve
        // F = k * δ^n where n ≈ 1.5-2.0
        let k = 100.0; // MN/m^1.5
        
        (force / k).powf(1.0 / 1.5)
    }
    
    /// Duration of impact (s)
    pub fn duration(&self) -> f64 {
        let crush = self.crushing_depth();
        let v = self.velocity;
        
        // t ≈ 2 * δ / v for constant deceleration
        2.0 * crush / v
    }
    
    /// Impulse (MN·s)
    pub fn impulse(&self) -> f64 {
        self.effective_mass() * 1000.0 * self.velocity / 1e6
    }
}

// ============================================================================
// PROGRESSIVE DAMAGE
// ============================================================================

/// Damage state
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum DamageState {
    /// No damage
    None,
    /// Minor cracking/yielding
    Minor,
    /// Moderate damage, repairable
    Moderate,
    /// Severe damage, major repair needed
    Severe,
    /// Collapse/failure
    Collapse,
}

/// Progressive damage model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressiveDamage {
    /// Element identification
    pub element_id: usize,
    /// Current damage state
    pub state: DamageState,
    /// Damage index (0-1)
    pub damage_index: f64,
    /// Residual capacity ratio
    pub residual_capacity: f64,
    /// Energy absorbed (kJ)
    pub absorbed_energy: f64,
    /// Deformation (mm)
    pub deformation: f64,
}

impl ProgressiveDamage {
    pub fn new(element_id: usize) -> Self {
        Self {
            element_id,
            state: DamageState::None,
            damage_index: 0.0,
            residual_capacity: 1.0,
            absorbed_energy: 0.0,
            deformation: 0.0,
        }
    }
    
    /// Update damage from applied load
    pub fn update(&mut self, load: f64, capacity: f64, stiffness: f64) {
        let ratio = load / capacity;
        
        if ratio > 1.0 {
            // Beyond capacity - accumulate damage
            let damage_increment = (ratio - 1.0) * 0.1;
            self.damage_index = (self.damage_index + damage_increment).min(1.0);
            
            // Energy absorbed
            let deformation = load / stiffness;
            self.absorbed_energy += 0.5 * load * deformation;
            self.deformation = deformation;
        } else if ratio > 0.8 {
            // Near yield - minor damage
            self.damage_index = (self.damage_index + (ratio - 0.8) * 0.02).min(1.0);
        }
        
        // Update residual capacity
        self.residual_capacity = (1.0 - self.damage_index).max(0.0);
        
        // Update damage state
        self.state = self.determine_state();
    }
    
    fn determine_state(&self) -> DamageState {
        match self.damage_index {
            d if d < 0.05 => DamageState::None,
            d if d < 0.2 => DamageState::Minor,
            d if d < 0.5 => DamageState::Moderate,
            d if d < 0.9 => DamageState::Severe,
            _ => DamageState::Collapse,
        }
    }
    
    /// Check if element has failed
    pub fn has_failed(&self) -> bool {
        self.state == DamageState::Collapse || self.damage_index >= 0.95
    }
}

/// Structural damage assessment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DamageAssessment {
    /// Element damage states
    pub elements: Vec<ProgressiveDamage>,
    /// Total absorbed energy (kJ)
    pub total_energy: f64,
    /// Number of failed elements
    pub failed_count: usize,
    /// Overall damage index
    pub overall_damage: f64,
    /// Collapse mechanism formed
    pub collapse_mechanism: bool,
}

impl DamageAssessment {
    pub fn new(n_elements: usize) -> Self {
        Self {
            elements: (0..n_elements).map(|i| ProgressiveDamage::new(i)).collect(),
            total_energy: 0.0,
            failed_count: 0,
            overall_damage: 0.0,
            collapse_mechanism: false,
        }
    }
    
    /// Update damage from impact
    pub fn apply_impact(&mut self, _impact_force: &ImpactForce, element_loads: &[(usize, f64, f64, f64)]) {
        // element_loads: [(element_id, load, capacity, stiffness), ...]
        
        for &(elem_id, load, capacity, stiffness) in element_loads {
            if elem_id < self.elements.len() {
                self.elements[elem_id].update(load, capacity, stiffness);
            }
        }
        
        // Update totals
        self.total_energy = self.elements.iter().map(|e| e.absorbed_energy).sum();
        self.failed_count = self.elements.iter().filter(|e| e.has_failed()).count();
        self.overall_damage = self.elements.iter().map(|e| e.damage_index).sum::<f64>() 
            / self.elements.len() as f64;
        
        // Check for collapse mechanism (simplified)
        self.collapse_mechanism = self.failed_count > self.elements.len() / 3;
    }
    
    /// Get elements by damage state
    pub fn elements_by_state(&self, state: DamageState) -> Vec<usize> {
        self.elements.iter()
            .filter(|e| e.state == state)
            .map(|e| e.element_id)
            .collect()
    }
    
    /// Repair cost estimate (normalized 0-1)
    pub fn repair_cost_ratio(&self) -> f64 {
        let weights = self.elements.iter()
            .map(|e| match e.state {
                DamageState::None => 0.0,
                DamageState::Minor => 0.1,
                DamageState::Moderate => 0.3,
                DamageState::Severe => 0.7,
                DamageState::Collapse => 1.0,
            })
            .sum::<f64>();
        
        weights / self.elements.len() as f64
    }
}

// ============================================================================
// PROTECTION MEASURES
// ============================================================================

/// Impact protection type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ProtectionType {
    /// Concrete barrier (rigid)
    ConcreteBarrier,
    /// Steel guardrail (flexible)
    SteelGuardrail,
    /// Energy-absorbing device
    EnergyAbsorber,
    /// Fender system (marine)
    FenderSystem,
    /// Dolphins (marine)
    Dolphins,
    /// Sacrificial structure
    Sacrificial,
    /// Earth berm
    EarthBerm,
}

/// Impact protection system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtectionSystem {
    /// Protection type
    pub protection_type: ProtectionType,
    /// Design impact energy (kJ)
    pub design_energy: f64,
    /// Maximum force transmitted (kN)
    pub max_transmitted_force: f64,
    /// Deformation capacity (m)
    pub deformation_capacity: f64,
    /// Stiffness (kN/m)
    pub stiffness: f64,
}

impl ProtectionSystem {
    /// Concrete barrier per MASH/EN 1317
    pub fn concrete_barrier(test_level: usize) -> Self {
        let (energy, force) = match test_level {
            1 => (20.0, 100.0),
            2 => (80.0, 250.0),
            3 => (250.0, 500.0),
            4 => (500.0, 750.0),
            5 => (750.0, 1000.0),
            6 => (1000.0, 1500.0),
            _ => (500.0, 750.0),
        };
        
        Self {
            protection_type: ProtectionType::ConcreteBarrier,
            design_energy: energy,
            max_transmitted_force: force,
            deformation_capacity: 0.3,
            stiffness: force / 0.15,
        }
    }
    
    /// Marine fender system
    pub fn fender_system(vessel_displacement: f64, approach_velocity: f64) -> Self {
        // Kinetic energy to absorb
        let energy = 0.5 * vessel_displacement * 1000.0 * approach_velocity.powi(2) / 1000.0; // kJ
        
        // Fender reaction force (typically 1.5-2.5 times berthing load)
        let reaction = (energy * 100.0).sqrt(); // Simplified correlation
        
        Self {
            protection_type: ProtectionType::FenderSystem,
            design_energy: energy,
            max_transmitted_force: reaction,
            deformation_capacity: 2.0 * energy / reaction,
            stiffness: reaction / 1.0,
        }
    }
    
    /// Energy absorber (crashworthy device)
    pub fn energy_absorber(design_force: f64, stroke: f64) -> Self {
        Self {
            protection_type: ProtectionType::EnergyAbsorber,
            design_energy: design_force * stroke,
            max_transmitted_force: design_force * 1.1,
            deformation_capacity: stroke,
            stiffness: design_force / (stroke * 0.1),
        }
    }
    
    /// Check if impact is within capacity
    pub fn can_absorb(&self, impact_energy: f64) -> bool {
        impact_energy <= self.design_energy
    }
    
    /// Force transmitted to structure
    pub fn transmitted_force(&self, impact_force: f64) -> f64 {
        impact_force.min(self.max_transmitted_force)
    }
    
    /// Residual energy after protection
    pub fn residual_energy(&self, impact_energy: f64) -> f64 {
        (impact_energy - self.design_energy).max(0.0)
    }
}

// ============================================================================
// ROBUSTNESS ASSESSMENT
// ============================================================================

/// Impact robustness index
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RobustnessIndex {
    /// Energy absorption capacity
    pub energy_capacity: f64,
    /// Ductility ratio
    pub ductility: f64,
    /// Redundancy factor
    pub redundancy: f64,
    /// Overall robustness index
    pub index: f64,
    /// Rating
    pub rating: RobustnessRating,
}

/// Robustness rating
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum RobustnessRating {
    /// Poor robustness
    Poor,
    /// Fair robustness
    Fair,
    /// Good robustness
    Good,
    /// Excellent robustness
    Excellent,
}

impl RobustnessIndex {
    /// Calculate robustness index
    pub fn calculate(
        energy_capacity: f64,
        design_energy: f64,
        ductility: f64,
        n_load_paths: usize,
    ) -> Self {
        // Energy ratio
        let energy_ratio = (energy_capacity / design_energy).min(2.0);
        
        // Ductility factor (normalized to 1 at µ=4)
        let ductility_factor = (ductility / 4.0).min(1.5);
        
        // Redundancy factor
        let redundancy = match n_load_paths {
            1 => 0.5,
            2 => 0.75,
            3 => 1.0,
            _ => 1.0 + 0.1 * (n_load_paths - 3) as f64,
        };
        
        // Combined index
        let index = 0.4 * energy_ratio + 0.3 * ductility_factor + 0.3 * redundancy;
        
        let rating = if index < 0.5 {
            RobustnessRating::Poor
        } else if index < 0.75 {
            RobustnessRating::Fair
        } else if index < 1.0 {
            RobustnessRating::Good
        } else {
            RobustnessRating::Excellent
        };
        
        Self {
            energy_capacity,
            ductility,
            redundancy,
            index,
            rating,
        }
    }
}

// ============================================================================
// TIME HISTORY RESPONSE
// ============================================================================

/// Impact time history response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImpactResponse {
    /// Time (ms)
    pub time: Vec<f64>,
    /// Force (kN)
    pub force: Vec<f64>,
    /// Displacement (mm)
    pub displacement: Vec<f64>,
    /// Velocity (m/s)
    pub velocity: Vec<f64>,
    /// Acceleration (g)
    pub acceleration: Vec<f64>,
}

impl ImpactResponse {
    /// Generate SDOF response to impact
    pub fn sdof_response(
        mass: f64,
        stiffness: f64,
        damping: f64,
        impact_force: &ImpactForce,
        dt: f64,
        duration: f64,
    ) -> Self {
        let n_steps = (duration / dt).ceil() as usize;
        let omega = (stiffness * 1000.0 / mass).sqrt();
        let _omega_d = omega * (1.0 - damping.powi(2)).sqrt();
        
        let mut time = Vec::with_capacity(n_steps);
        let mut force = Vec::with_capacity(n_steps);
        let mut displacement = Vec::with_capacity(n_steps);
        let mut velocity = Vec::with_capacity(n_steps);
        let mut acceleration = Vec::with_capacity(n_steps);
        
        let mut x = 0.0_f64;
        let mut v = 0.0_f64;
        
        for i in 0..n_steps {
            let t = i as f64 * dt;
            time.push(t);
            
            // Force pulse (triangular)
            let f = if t < impact_force.duration {
                impact_force.peak_force * (1.0 - t / impact_force.duration)
            } else {
                0.0
            };
            force.push(f);
            
            // Newmark integration
            let a = (f * 1000.0 - damping * 2.0 * mass * omega * v - stiffness * 1000.0 * x) / mass;
            
            v += a * dt / 1000.0;
            x += v * dt;
            
            displacement.push(x * 1000.0); // m to mm
            velocity.push(v);
            acceleration.push(a / 9.81); // m/s² to g
        }
        
        Self {
            time,
            force,
            displacement,
            velocity,
            acceleration,
        }
    }
    
    /// Maximum displacement
    pub fn max_displacement(&self) -> f64 {
        self.displacement.iter().cloned().fold(0.0, f64::max)
    }
    
    /// Maximum acceleration
    pub fn max_acceleration(&self) -> f64 {
        self.acceleration.iter().map(|a| a.abs()).fold(0.0, f64::max)
    }
    
    /// Time to peak displacement
    pub fn time_to_peak(&self) -> f64 {
        let max_d = self.max_displacement();
        self.time.iter()
            .zip(self.displacement.iter())
            .find(|(_, &d)| (d - max_d).abs() < 0.01)
            .map(|(&t, _)| t)
            .unwrap_or(0.0)
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vehicle_category() {
        let car = VehicleCategory::PassengerCar;
        let truck = VehicleCategory::HeavyGoods;
        
        assert!(truck.mass() > car.mass());
        assert!(car.design_speed() > truck.design_speed());
    }

    #[test]
    fn test_impact_parameters() {
        let params = ImpactParameters::vehicle(VehicleCategory::HeavyGoods, 0.0);
        
        assert!(params.kinetic_energy() > 0.0);
        assert!(params.momentum() > 0.0);
    }

    #[test]
    fn test_impact_force_energy() {
        let params = ImpactParameters::vehicle(VehicleCategory::PassengerCar, 0.0);
        let force = ImpactForce::energy_method(&params, 50000.0);
        
        assert!(force.peak_force > 0.0);
        assert!(force.duration > 0.0);
    }

    #[test]
    fn test_en_vehicle_forces() {
        let hard = ImpactForce::en_vehicle(VehicleCategory::HeavyGoods, true);
        let soft = ImpactForce::en_vehicle(VehicleCategory::HeavyGoods, false);
        
        assert!(hard.peak_force > soft.peak_force);
    }

    #[test]
    fn test_ship_impact() {
        let ship = ShipImpact::new(ShipCategory::InlandVessel, 3.0, 0.0);
        
        let force = ship.head_on_force();
        assert!(force > 0.0);
        
        let duration = ship.duration();
        assert!(duration > 0.0);
    }

    #[test]
    fn test_progressive_damage() {
        let mut damage = ProgressiveDamage::new(0);
        
        // Apply load below capacity
        damage.update(80.0, 100.0, 1000.0);
        assert!(damage.damage_index < 0.1);
        
        // Apply load exceeding capacity
        damage.update(150.0, 100.0, 1000.0);
        assert!(damage.damage_index > 0.0);
    }

    #[test]
    fn test_damage_assessment() {
        let mut assessment = DamageAssessment::new(10);
        
        assert_eq!(assessment.failed_count, 0);
        assert!(assessment.overall_damage < 0.01);
    }

    #[test]
    fn test_protection_system() {
        let barrier = ProtectionSystem::concrete_barrier(4);
        
        assert!(barrier.can_absorb(400.0));
        assert!(!barrier.can_absorb(600.0));
    }

    #[test]
    fn test_robustness_index() {
        let robust = RobustnessIndex::calculate(500.0, 400.0, 4.0, 3);
        
        assert!(robust.index > 0.0);
        assert!(matches!(robust.rating, RobustnessRating::Good | RobustnessRating::Excellent));
    }

    #[test]
    fn test_impact_response() {
        let force = ImpactForce {
            peak_force: 500.0,
            static_equivalent: 400.0,
            duration: 50.0,
            force_per_width: 1000.0,
            contact_pressure: 2.0,
            impulse: 25.0,
        };
        
        let response = ImpactResponse::sdof_response(
            1000.0,  // mass (kg)
            100.0,   // stiffness (kN/m)
            0.05,    // damping
            &force,
            0.1,     // dt (ms)
            200.0,   // duration (ms)
        );
        
        assert!(response.max_displacement() > 0.0);
    }

    #[test]
    fn test_dropped_object() {
        let params = ImpactParameters::dropped_object(100.0, 10.0);
        
        let expected_v: f64 = (2.0_f64 * 9.81 * 10.0).sqrt();
        assert!((params.velocity - expected_v).abs() < 0.1);
    }

    #[test]
    fn test_aashto_vehicle() {
        let force = ImpactForce::aashto_vehicle("bridge_pier");
        
        assert!(force.peak_force > 2000.0);
    }

    #[test]
    fn test_fender_system() {
        let fender = ProtectionSystem::fender_system(5000.0, 1.0);
        
        assert!(fender.design_energy > 0.0);
        assert!(fender.deformation_capacity > 0.0);
    }
}
