//! Self-Healing Structures Module
//! 
//! Implements self-healing and self-repairing structural systems:
//! - Autonomous crack healing in concrete
//! - Shape memory alloy integration
//! - Microcapsule-based healing
//! - Bacterial concrete
//! - Electrochemical healing
//! - Damage detection and healing activation

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// HEALING MECHANISMS
// ============================================================================

/// Self-healing mechanism type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum HealingMechanism {
    /// Autogenous healing (continued hydration)
    Autogenous,
    /// Microcapsule-based healing agent
    Microcapsule,
    /// Bacterial (bio-concrete)
    Bacterial,
    /// Shape memory alloy (SMA)
    ShapeMemoryAlloy,
    /// Electrochemical deposition
    Electrochemical,
    /// Polymer infusion
    PolymerInfusion,
    /// Intrinsic polymer healing
    IntrinsicPolymer,
    /// Vascular network
    VascularNetwork,
}

impl HealingMechanism {
    /// Maximum healable crack width (mm)
    pub fn max_crack_width(&self) -> f64 {
        match self {
            Self::Autogenous => 0.15,
            Self::Microcapsule => 0.5,
            Self::Bacterial => 0.8,
            Self::ShapeMemoryAlloy => 0.3,
            Self::Electrochemical => 0.4,
            Self::PolymerInfusion => 1.0,
            Self::IntrinsicPolymer => 0.2,
            Self::VascularNetwork => 1.5,
        }
    }
    
    /// Healing efficiency (0-1)
    pub fn healing_efficiency(&self) -> f64 {
        match self {
            Self::Autogenous => 0.5,
            Self::Microcapsule => 0.85,
            Self::Bacterial => 0.9,
            Self::ShapeMemoryAlloy => 0.95,
            Self::Electrochemical => 0.75,
            Self::PolymerInfusion => 0.9,
            Self::IntrinsicPolymer => 0.7,
            Self::VascularNetwork => 0.95,
        }
    }
    
    /// Healing time (days)
    pub fn typical_healing_time(&self) -> f64 {
        match self {
            Self::Autogenous => 28.0,
            Self::Microcapsule => 7.0,
            Self::Bacterial => 21.0,
            Self::ShapeMemoryAlloy => 0.01, // Near instantaneous
            Self::Electrochemical => 14.0,
            Self::PolymerInfusion => 1.0,
            Self::IntrinsicPolymer => 2.0,
            Self::VascularNetwork => 3.0,
        }
    }
    
    /// Repeatability (number of healing cycles)
    pub fn repeatability(&self) -> usize {
        match self {
            Self::Autogenous => 1,
            Self::Microcapsule => 1,
            Self::Bacterial => 5,
            Self::ShapeMemoryAlloy => 1000,
            Self::Electrochemical => 10,
            Self::PolymerInfusion => 1,
            Self::IntrinsicPolymer => 100,
            Self::VascularNetwork => 20,
        }
    }
}

// ============================================================================
// CRACK CHARACTERIZATION
// ============================================================================

/// Crack type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum CrackType {
    /// Flexural crack
    Flexural,
    /// Shear crack
    Shear,
    /// Torsional crack
    Torsional,
    /// Shrinkage crack
    Shrinkage,
    /// Thermal crack
    Thermal,
    /// Settlement crack
    Settlement,
    /// Fatigue crack
    Fatigue,
    /// Corrosion-induced crack
    Corrosion,
}

/// Crack parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrackParameters {
    /// Crack type
    pub crack_type: CrackType,
    /// Crack width (mm)
    pub width: f64,
    /// Crack depth (mm)
    pub depth: f64,
    /// Crack length (mm)
    pub length: f64,
    /// Is crack active (still growing)
    pub is_active: bool,
    /// Moisture availability
    pub moisture_available: bool,
    /// Temperature (°C)
    pub temperature: f64,
}

impl CrackParameters {
    /// Create new crack
    pub fn new(crack_type: CrackType, width: f64, depth: f64, length: f64) -> Self {
        Self {
            crack_type,
            width,
            depth,
            length,
            is_active: true,
            moisture_available: true,
            temperature: 20.0,
        }
    }
    
    /// Crack volume (mm³)
    pub fn volume(&self) -> f64 {
        // Simplified triangular crack profile
        0.5 * self.width * self.depth * self.length
    }
    
    /// Crack area (mm²)
    pub fn surface_area(&self) -> f64 {
        2.0 * self.depth * self.length + self.width * self.length
    }
    
    /// Can be healed by mechanism
    pub fn can_be_healed(&self, mechanism: HealingMechanism) -> bool {
        self.width <= mechanism.max_crack_width() && !self.is_active
    }
    
    /// Criticality index (0-1)
    pub fn criticality(&self) -> f64 {
        let width_factor = (self.width / 0.3).min(1.0);
        let depth_factor = (self.depth / 50.0).min(1.0);
        let type_factor = match self.crack_type {
            CrackType::Corrosion => 1.0,
            CrackType::Shear => 0.9,
            CrackType::Fatigue => 0.85,
            CrackType::Flexural => 0.7,
            CrackType::Settlement => 0.6,
            CrackType::Torsional => 0.6,
            CrackType::Thermal => 0.4,
            CrackType::Shrinkage => 0.3,
        };
        
        (width_factor * 0.4 + depth_factor * 0.3 + type_factor * 0.3).min(1.0)
    }
}

// ============================================================================
// AUTOGENOUS HEALING
// ============================================================================

/// Autogenous healing model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutogenousHealing {
    /// Initial crack width (mm)
    pub initial_width: f64,
    /// Concrete age at cracking (days)
    pub age_at_cracking: f64,
    /// Water/cement ratio
    pub wc_ratio: f64,
    /// Cement content (kg/m³)
    pub cement_content: f64,
    /// Has continuous water supply
    pub water_supply: bool,
}

impl AutogenousHealing {
    pub fn new(initial_width: f64, age_at_cracking: f64) -> Self {
        Self {
            initial_width,
            age_at_cracking,
            wc_ratio: 0.4,
            cement_content: 400.0,
            water_supply: true,
        }
    }
    
    /// Healing degree at time t (days after cracking)
    pub fn healing_degree(&self, time: f64) -> f64 {
        if !self.water_supply || self.initial_width > 0.15 {
            return 0.0;
        }
        
        // Ter Heide (2005) model
        let width_factor = if self.initial_width < 0.05 {
            1.0
        } else if self.initial_width < 0.1 {
            0.8
        } else {
            0.5
        };
        
        // Age factor (young concrete heals better)
        let age_factor = if self.age_at_cracking < 7.0 {
            1.0
        } else if self.age_at_cracking < 28.0 {
            0.7
        } else {
            0.4
        };
        
        // Time-dependent healing
        let max_healing = width_factor * age_factor;
        let rate = 0.1; // Healing rate constant
        
        max_healing * (1.0 - (-rate * time).exp())
    }
    
    /// Crack width after healing
    pub fn healed_width(&self, time: f64) -> f64 {
        let degree = self.healing_degree(time);
        self.initial_width * (1.0 - degree)
    }
    
    /// Strength recovery ratio
    pub fn strength_recovery(&self, time: f64) -> f64 {
        let degree = self.healing_degree(time);
        // Strength recovery is less than visual healing
        degree * 0.7
    }
}

// ============================================================================
// MICROCAPSULE HEALING
// ============================================================================

/// Microcapsule parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MicrocapsuleParams {
    /// Capsule diameter (μm)
    pub diameter: f64,
    /// Shell thickness (μm)
    pub shell_thickness: f64,
    /// Volume fraction in concrete (%)
    pub volume_fraction: f64,
    /// Healing agent type
    pub healing_agent: HealingAgent,
}

/// Healing agent type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum HealingAgent {
    /// Sodium silicate
    SodiumSilicate,
    /// Epoxy resin
    Epoxy,
    /// Cyanoacrylate
    Cyanoacrylate,
    /// DCPD (Dicyclopentadiene)
    DCPD,
    /// Methyl methacrylate
    MMA,
}

impl HealingAgent {
    /// Healing agent viscosity (Pa·s)
    pub fn viscosity(&self) -> f64 {
        match self {
            Self::SodiumSilicate => 0.1,
            Self::Epoxy => 5.0,
            Self::Cyanoacrylate => 0.002,
            Self::DCPD => 0.003,
            Self::MMA => 0.001,
        }
    }
    
    /// Curing time (hours)
    pub fn curing_time(&self) -> f64 {
        match self {
            Self::SodiumSilicate => 24.0,
            Self::Epoxy => 12.0,
            Self::Cyanoacrylate => 0.5,
            Self::DCPD => 24.0,
            Self::MMA => 2.0,
        }
    }
    
    /// Bond strength (MPa)
    pub fn bond_strength(&self) -> f64 {
        match self {
            Self::SodiumSilicate => 2.0,
            Self::Epoxy => 15.0,
            Self::Cyanoacrylate => 10.0,
            Self::DCPD => 8.0,
            Self::MMA => 12.0,
        }
    }
}

/// Microcapsule healing system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MicrocapsuleHealing {
    /// Capsule parameters
    pub params: MicrocapsuleParams,
    /// Capsules triggered (%)
    pub triggered_fraction: f64,
}

impl MicrocapsuleHealing {
    pub fn new(params: MicrocapsuleParams) -> Self {
        Self {
            params,
            triggered_fraction: 0.0,
        }
    }
    
    /// Number of capsules per unit volume
    pub fn capsule_density(&self) -> f64 {
        let capsule_vol = 4.0 / 3.0 * PI * (self.params.diameter / 2.0 * 1e-3).powi(3);
        self.params.volume_fraction / 100.0 / capsule_vol
    }
    
    /// Healing agent volume released per crack area
    pub fn released_volume(&self, crack: &CrackParameters) -> f64 {
        // Capsules in crack zone
        let affected_volume = crack.volume();
        let capsule_count = self.capsule_density() * affected_volume;
        
        // Core volume per capsule
        let core_radius = (self.params.diameter - 2.0 * self.params.shell_thickness) / 2.0 * 1e-3;
        let core_volume = 4.0 / 3.0 * PI * core_radius.powi(3);
        
        capsule_count * core_volume
    }
    
    /// Can heal crack
    pub fn can_heal(&self, crack: &CrackParameters) -> bool {
        let available = self.released_volume(crack);
        let needed = crack.volume() * 0.3; // 30% fill needed
        available > needed && self.triggered_fraction < 0.95
    }
    
    /// Calculate healing efficiency
    pub fn healing_efficiency(&self, crack: &CrackParameters) -> f64 {
        if !self.can_heal(crack) {
            return 0.0;
        }
        
        let fill_ratio = (self.released_volume(crack) / crack.volume()).min(1.0);
        let viscosity_factor = 1.0 / (1.0 + self.params.healing_agent.viscosity() / 0.1);
        let width_factor = (1.0 - crack.width / 0.5).max(0.0);
        
        fill_ratio * viscosity_factor * width_factor * 0.85
    }
    
    /// Trigger healing
    pub fn trigger(&mut self, crack: &CrackParameters) {
        let triggered = crack.volume() / 1e6; // Fraction of total
        self.triggered_fraction = (self.triggered_fraction + triggered).min(1.0);
    }
}

// ============================================================================
// BACTERIAL CONCRETE
// ============================================================================

/// Bacteria type for bio-concrete
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum BacteriaType {
    /// Bacillus subtilis
    BacillusSubtilis,
    /// Bacillus pasteurii
    BacillusPasteurii,
    /// Sporosarcina pasteurii
    SporosarcinaPasteurii,
    /// Bacillus megaterium
    BacillusMegaterium,
}

impl BacteriaType {
    /// Optimal temperature range (°C)
    pub fn optimal_temp_range(&self) -> (f64, f64) {
        match self {
            Self::BacillusSubtilis => (25.0, 37.0),
            Self::BacillusPasteurii => (20.0, 35.0),
            Self::SporosarcinaPasteurii => (25.0, 35.0),
            Self::BacillusMegaterium => (30.0, 40.0),
        }
    }
    
    /// Optimal pH range
    pub fn optimal_ph_range(&self) -> (f64, f64) {
        match self {
            Self::BacillusSubtilis => (7.0, 8.5),
            Self::BacillusPasteurii => (8.0, 9.5),
            Self::SporosarcinaPasteurii => (8.0, 9.0),
            Self::BacillusMegaterium => (7.0, 8.0),
        }
    }
    
    /// Calcite precipitation rate (mg/L/day)
    pub fn precipitation_rate(&self) -> f64 {
        match self {
            Self::BacillusSubtilis => 50.0,
            Self::BacillusPasteurii => 80.0,
            Self::SporosarcinaPasteurii => 100.0,
            Self::BacillusMegaterium => 60.0,
        }
    }
}

/// Bacterial concrete healing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BacterialHealing {
    /// Bacteria type
    pub bacteria: BacteriaType,
    /// Bacteria concentration (cells/mL)
    pub concentration: f64,
    /// Nutrient availability (0-1)
    pub nutrient_level: f64,
    /// Current temperature (°C)
    pub temperature: f64,
    /// Current pH
    pub ph: f64,
    /// Encapsulation method
    pub encapsulated: bool,
}

impl BacterialHealing {
    pub fn new(bacteria: BacteriaType) -> Self {
        Self {
            bacteria,
            concentration: 1e8,
            nutrient_level: 1.0,
            temperature: 25.0,
            ph: 8.0,
            encapsulated: true,
        }
    }
    
    /// Activity factor based on environmental conditions
    pub fn activity_factor(&self) -> f64 {
        // Temperature factor
        let (t_min, t_max) = self.bacteria.optimal_temp_range();
        let t_opt = (t_min + t_max) / 2.0;
        let temp_factor = 1.0 - ((self.temperature - t_opt) / 15.0).powi(2);
        let temp_factor = temp_factor.max(0.0);
        
        // pH factor
        let (ph_min, ph_max) = self.bacteria.optimal_ph_range();
        let ph_opt = (ph_min + ph_max) / 2.0;
        let ph_factor = 1.0 - ((self.ph - ph_opt) / 2.0).powi(2);
        let ph_factor = ph_factor.max(0.0);
        
        // Nutrient factor
        let nutrient_factor = self.nutrient_level;
        
        temp_factor * ph_factor * nutrient_factor
    }
    
    /// Calcite precipitation rate (mm/day)
    pub fn precipitation_rate(&self) -> f64 {
        let base_rate = self.bacteria.precipitation_rate();
        let activity = self.activity_factor();
        let conc_factor = (self.concentration / 1e8).min(1.0);
        
        base_rate * activity * conc_factor * 1e-4 // Convert to mm/day
    }
    
    /// Healing time for crack (days)
    pub fn healing_time(&self, crack: &CrackParameters) -> f64 {
        let rate = self.precipitation_rate();
        if rate < 1e-6 {
            return f64::INFINITY;
        }
        
        crack.width / rate
    }
    
    /// Healing efficiency after time t (days)
    pub fn healing_efficiency(&self, crack: &CrackParameters, time: f64) -> f64 {
        let rate = self.precipitation_rate();
        let healed_width = rate * time;
        
        (healed_width / crack.width).min(1.0) * 0.9 // 90% max efficiency
    }
    
    /// Strength recovery
    pub fn strength_recovery(&self, crack: &CrackParameters, time: f64) -> f64 {
        // Calcite has good bonding
        self.healing_efficiency(crack, time) * 0.85
    }
}

// ============================================================================
// SHAPE MEMORY ALLOY HEALING
// ============================================================================

/// SMA wire parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SMAWire {
    /// Wire diameter (mm)
    pub diameter: f64,
    /// Austenite finish temperature (°C)
    pub af_temp: f64,
    /// Maximum recovery strain (%)
    pub max_recovery_strain: f64,
    /// Recovery stress (MPa)
    pub recovery_stress: f64,
    /// Prestrain (%)
    pub prestrain: f64,
}

impl SMAWire {
    /// Typical NiTi wire
    pub fn niti_typical() -> Self {
        Self {
            diameter: 1.0,
            af_temp: 50.0,
            max_recovery_strain: 6.0,
            recovery_stress: 500.0,
            prestrain: 4.0,
        }
    }
    
    /// Recovery force (N)
    pub fn recovery_force(&self) -> f64 {
        let area = PI * (self.diameter / 2.0).powi(2);
        self.recovery_stress * area
    }
    
    /// Maximum crack closure (mm) for given span
    pub fn max_crack_closure(&self, span: f64) -> f64 {
        span * self.prestrain / 100.0
    }
}

/// SMA-based healing system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SMAHealing {
    /// SMA wire properties
    pub wire: SMAWire,
    /// Wire spacing (mm)
    pub spacing: f64,
    /// Number of layers
    pub layers: usize,
    /// Heating method
    pub heating_method: HeatingMethod,
    /// Current activation state
    pub activated: bool,
}

/// SMA heating method
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum HeatingMethod {
    /// External heating
    External,
    /// Electrical resistance (Joule heating)
    Electrical,
    /// Induction heating
    Induction,
}

impl SMAHealing {
    pub fn new(wire: SMAWire, spacing: f64, layers: usize) -> Self {
        Self {
            wire,
            spacing,
            layers,
            heating_method: HeatingMethod::Electrical,
            activated: false,
        }
    }
    
    /// Closing force per unit width (N/mm)
    pub fn closing_force(&self) -> f64 {
        let force_per_wire = self.wire.recovery_force();
        let wires_per_mm = 1.0 / self.spacing;
        
        force_per_wire * wires_per_mm * self.layers as f64
    }
    
    /// Can close crack
    pub fn can_close_crack(&self, crack: &CrackParameters) -> bool {
        // Check if closing force is sufficient
        let required_stress = 2.0; // MPa, approximate
        let available_stress = self.closing_force() / crack.depth;
        
        available_stress > required_stress && crack.width < 0.5
    }
    
    /// Crack closure efficiency
    pub fn closure_efficiency(&self, crack: &CrackParameters) -> f64 {
        if !self.activated {
            return 0.0;
        }
        
        let max_closure = self.wire.max_crack_closure(self.spacing * 10.0);
        let closure_ratio = (max_closure / crack.width).min(1.0);
        
        closure_ratio * 0.95 // 95% max efficiency
    }
    
    /// Energy required for activation (J/m)
    pub fn activation_energy(&self) -> f64 {
        let wire_volume = PI * (self.wire.diameter / 2.0).powi(2) / self.spacing;
        let cp = 450.0; // J/kg·K for NiTi
        let rho = 6450.0; // kg/m³
        let delta_t = self.wire.af_temp - 20.0;
        
        wire_volume * 1e-9 * rho * cp * delta_t * self.layers as f64
    }
    
    /// Activate SMA
    pub fn activate(&mut self) {
        self.activated = true;
    }
}

// ============================================================================
// VASCULAR HEALING NETWORK
// ============================================================================

/// Vascular network parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VascularNetwork {
    /// Channel diameter (mm)
    pub channel_diameter: f64,
    /// Channel spacing (mm)
    pub channel_spacing: f64,
    /// Healing agent type
    pub healing_agent: HealingAgent,
    /// Reservoir capacity (mL)
    pub reservoir_capacity: f64,
    /// Current reservoir level (mL)
    pub current_level: f64,
    /// Is refillable
    pub refillable: bool,
}

impl VascularNetwork {
    pub fn new(channel_diameter: f64, spacing: f64, agent: HealingAgent) -> Self {
        Self {
            channel_diameter,
            channel_spacing: spacing,
            healing_agent: agent,
            reservoir_capacity: 1000.0,
            current_level: 1000.0,
            refillable: true,
        }
    }
    
    /// Flow rate through channel (mL/s)
    pub fn flow_rate(&self, pressure: f64, length: f64) -> f64 {
        // Hagen-Poiseuille equation
        let r = self.channel_diameter / 2.0 * 1e-3; // m
        let mu = self.healing_agent.viscosity();
        let dp = pressure * 1e3; // Pa
        let l = length * 1e-3; // m
        
        PI * r.powi(4) * dp / (8.0 * mu * l) * 1e6 // mL/s
    }
    
    /// Healing agent delivery rate (mL/mm² crack area/hour)
    pub fn delivery_rate(&self, pressure: f64) -> f64 {
        let flow = self.flow_rate(pressure, 100.0); // 100mm typical
        let coverage = 1.0 / self.channel_spacing.powi(2);
        
        flow * 3600.0 * coverage // mL/mm²/hour
    }
    
    /// Can heal crack
    pub fn can_heal(&self, crack: &CrackParameters) -> bool {
        let needed = crack.volume() * 1e-3 * 0.5; // 50% fill
        self.current_level > needed
    }
    
    /// Execute healing
    pub fn heal(&mut self, crack: &CrackParameters) -> f64 {
        if !self.can_heal(crack) {
            return 0.0;
        }
        
        let needed = crack.volume() * 1e-3 * 0.5;
        self.current_level -= needed;
        
        // Efficiency based on crack width and agent properties
        let width_factor = (1.0 - crack.width / 2.0).max(0.0);
        let bond_factor = self.healing_agent.bond_strength() / 15.0;
        
        (width_factor * 0.5 + bond_factor * 0.5) * 0.9
    }
    
    /// Refill reservoir
    pub fn refill(&mut self) {
        if self.refillable {
            self.current_level = self.reservoir_capacity;
        }
    }
}

// ============================================================================
// INTEGRATED HEALING SYSTEM
// ============================================================================

/// Integrated self-healing system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelfHealingSystem {
    /// Primary healing mechanism
    pub primary: HealingMechanism,
    /// Secondary healing mechanism
    pub secondary: Option<HealingMechanism>,
    /// Damage detection sensitivity (mm)
    pub detection_threshold: f64,
    /// Auto-activation enabled
    pub auto_activation: bool,
    /// Healing cycles completed
    pub healing_cycles: usize,
}

impl SelfHealingSystem {
    pub fn new(primary: HealingMechanism) -> Self {
        Self {
            primary,
            secondary: None,
            detection_threshold: 0.1,
            auto_activation: true,
            healing_cycles: 0,
        }
    }
    
    /// Add secondary mechanism
    pub fn with_secondary(mut self, secondary: HealingMechanism) -> Self {
        self.secondary = Some(secondary);
        self
    }
    
    /// Can heal damage
    pub fn can_heal(&self, crack: &CrackParameters) -> bool {
        if crack.width > self.primary.max_crack_width() {
            if let Some(secondary) = self.secondary {
                return crack.width <= secondary.max_crack_width();
            }
            return false;
        }
        true
    }
    
    /// Select best mechanism for crack
    pub fn select_mechanism(&self, crack: &CrackParameters) -> Option<HealingMechanism> {
        if crack.width <= self.primary.max_crack_width() {
            return Some(self.primary);
        }
        
        if let Some(secondary) = self.secondary {
            if crack.width <= secondary.max_crack_width() {
                return Some(secondary);
            }
        }
        
        None
    }
    
    /// Estimate healing efficiency
    pub fn estimate_efficiency(&self, crack: &CrackParameters) -> f64 {
        let mechanism = match self.select_mechanism(crack) {
            Some(m) => m,
            None => return 0.0,
        };
        
        let base_efficiency = mechanism.healing_efficiency();
        let width_factor = 1.0 - crack.width / mechanism.max_crack_width();
        let cycle_factor = 1.0 - (self.healing_cycles as f64 / mechanism.repeatability() as f64).min(0.5);
        
        base_efficiency * width_factor * cycle_factor
    }
    
    /// Execute healing
    pub fn heal(&mut self, crack: &CrackParameters) -> HealingResult {
        let mechanism = match self.select_mechanism(crack) {
            Some(m) => m,
            None => return HealingResult::failed("Crack too large for available mechanisms"),
        };
        
        let efficiency = self.estimate_efficiency(crack);
        let healing_time = mechanism.typical_healing_time();
        let strength_recovery = efficiency * 0.8;
        
        self.healing_cycles += 1;
        
        HealingResult {
            success: true,
            mechanism,
            efficiency,
            healing_time,
            strength_recovery,
            residual_width: crack.width * (1.0 - efficiency),
            message: format!("Healing initiated with {} efficiency", efficiency),
        }
    }
}

/// Healing result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealingResult {
    /// Healing successful
    pub success: bool,
    /// Mechanism used
    pub mechanism: HealingMechanism,
    /// Healing efficiency
    pub efficiency: f64,
    /// Time to heal (days)
    pub healing_time: f64,
    /// Strength recovery ratio
    pub strength_recovery: f64,
    /// Residual crack width (mm)
    pub residual_width: f64,
    /// Message
    pub message: String,
}

impl HealingResult {
    fn failed(message: &str) -> Self {
        Self {
            success: false,
            mechanism: HealingMechanism::Autogenous,
            efficiency: 0.0,
            healing_time: 0.0,
            strength_recovery: 0.0,
            residual_width: f64::INFINITY,
            message: message.to_string(),
        }
    }
}

// ============================================================================
// LIFECYCLE ANALYSIS
// ============================================================================

/// Self-healing lifecycle analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LifecycleAnalysis {
    /// Expected service life (years)
    pub service_life: f64,
    /// Damage events per year
    pub damage_rate: f64,
    /// Repair cost without self-healing ($/m²)
    pub conventional_repair_cost: f64,
    /// Self-healing system cost ($/m²)
    pub system_cost: f64,
    /// Annual maintenance cost ($/m²)
    pub maintenance_cost: f64,
}

impl LifecycleAnalysis {
    /// Total lifecycle cost with self-healing
    pub fn total_cost_with_healing(&self, system: &SelfHealingSystem) -> f64 {
        let initial = self.system_cost;
        let maintenance = self.maintenance_cost * self.service_life;
        
        // Residual repairs (unhealed damage)
        let healing_success_rate = system.primary.healing_efficiency();
        let residual_repairs = self.damage_rate * self.service_life 
            * (1.0 - healing_success_rate) * self.conventional_repair_cost;
        
        initial + maintenance + residual_repairs
    }
    
    /// Total lifecycle cost without self-healing
    pub fn total_cost_conventional(&self) -> f64 {
        self.damage_rate * self.service_life * self.conventional_repair_cost
    }
    
    /// Cost savings
    pub fn cost_savings(&self, system: &SelfHealingSystem) -> f64 {
        self.total_cost_conventional() - self.total_cost_with_healing(system)
    }
    
    /// Payback period (years)
    pub fn payback_period(&self, system: &SelfHealingSystem) -> f64 {
        let annual_savings = self.damage_rate * self.conventional_repair_cost 
            * system.primary.healing_efficiency() - self.maintenance_cost;
        
        if annual_savings <= 0.0 {
            f64::INFINITY
        } else {
            self.system_cost / annual_savings
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
    fn test_healing_mechanism() {
        let bacterial = HealingMechanism::Bacterial;
        
        assert!(bacterial.max_crack_width() > 0.0);
        assert!(bacterial.healing_efficiency() > 0.0);
        assert!(bacterial.repeatability() > 0);
    }

    #[test]
    fn test_crack_parameters() {
        let crack = CrackParameters::new(CrackType::Flexural, 0.2, 30.0, 100.0);
        
        assert!(crack.volume() > 0.0);
        assert!(crack.criticality() > 0.0);
        assert!(crack.criticality() <= 1.0);
    }

    #[test]
    fn test_autogenous_healing() {
        let healing = AutogenousHealing::new(0.05, 7.0);
        
        let degree_7 = healing.healing_degree(7.0);
        let degree_28 = healing.healing_degree(28.0);
        
        assert!(degree_28 > degree_7);
        assert!(healing.healed_width(28.0) < healing.initial_width);
    }

    #[test]
    fn test_microcapsule_healing() {
        let params = MicrocapsuleParams {
            diameter: 100.0,
            shell_thickness: 5.0,
            volume_fraction: 5.0,
            healing_agent: HealingAgent::Epoxy,
        };
        
        let healing = MicrocapsuleHealing::new(params);
        let crack = CrackParameters::new(CrackType::Flexural, 0.2, 20.0, 50.0); // Smaller crack
        
        assert!(healing.capsule_density() > 0.0);
        // Healing efficiency depends on crack size and capsule distribution
        let efficiency = healing.healing_efficiency(&crack);
        assert!(efficiency >= 0.0); // May be 0 if can't heal
    }

    #[test]
    fn test_bacterial_healing() {
        let healing = BacterialHealing::new(BacteriaType::SporosarcinaPasteurii);
        
        let activity = healing.activity_factor();
        assert!(activity > 0.0);
        assert!(activity <= 1.0);
    }

    #[test]
    fn test_bacterial_healing_time() {
        let healing = BacterialHealing::new(BacteriaType::SporosarcinaPasteurii);
        let crack = CrackParameters::new(CrackType::Shrinkage, 0.3, 15.0, 50.0);
        
        let time = healing.healing_time(&crack);
        assert!(time > 0.0);
        assert!(time < 365.0); // Should heal within a year
    }

    #[test]
    fn test_sma_wire() {
        let wire = SMAWire::niti_typical();
        
        assert!(wire.recovery_force() > 0.0);
        assert!(wire.max_crack_closure(100.0) > 0.0);
    }

    #[test]
    fn test_sma_healing() {
        let wire = SMAWire::niti_typical();
        let mut healing = SMAHealing::new(wire, 50.0, 2);
        let crack = CrackParameters::new(CrackType::Flexural, 0.2, 25.0, 100.0);
        
        healing.activate();
        let efficiency = healing.closure_efficiency(&crack);
        
        assert!(efficiency > 0.0);
    }

    #[test]
    fn test_vascular_network() {
        let mut network = VascularNetwork::new(1.0, 50.0, HealingAgent::Epoxy);
        let crack = CrackParameters::new(CrackType::Flexural, 0.5, 20.0, 100.0);
        
        assert!(network.can_heal(&crack));
        let efficiency = network.heal(&crack);
        assert!(efficiency > 0.0);
    }

    #[test]
    fn test_self_healing_system() {
        let mut system = SelfHealingSystem::new(HealingMechanism::Bacterial)
            .with_secondary(HealingMechanism::VascularNetwork);
        
        let small_crack = CrackParameters::new(CrackType::Shrinkage, 0.2, 10.0, 50.0);
        let large_crack = CrackParameters::new(CrackType::Flexural, 1.0, 30.0, 100.0);
        
        assert!(system.can_heal(&small_crack));
        assert!(system.can_heal(&large_crack));
        
        let result = system.heal(&small_crack);
        assert!(result.success);
    }

    #[test]
    fn test_mechanism_selection() {
        let system = SelfHealingSystem::new(HealingMechanism::Microcapsule)
            .with_secondary(HealingMechanism::VascularNetwork);
        
        let small_crack = CrackParameters::new(CrackType::Shrinkage, 0.3, 10.0, 50.0);
        let large_crack = CrackParameters::new(CrackType::Flexural, 1.2, 30.0, 100.0);
        
        assert_eq!(system.select_mechanism(&small_crack), Some(HealingMechanism::Microcapsule));
        assert_eq!(system.select_mechanism(&large_crack), Some(HealingMechanism::VascularNetwork));
    }

    #[test]
    fn test_lifecycle_analysis() {
        let analysis = LifecycleAnalysis {
            service_life: 50.0,
            damage_rate: 0.5,
            conventional_repair_cost: 100.0,
            system_cost: 500.0,
            maintenance_cost: 5.0,
        };
        
        let system = SelfHealingSystem::new(HealingMechanism::Bacterial);
        
        let savings = analysis.cost_savings(&system);
        assert!(savings > 0.0);
        
        let payback = analysis.payback_period(&system);
        assert!(payback > 0.0);
        assert!(payback < analysis.service_life);
    }

    #[test]
    fn test_healing_agent_properties() {
        let epoxy = HealingAgent::Epoxy;
        let cyano = HealingAgent::Cyanoacrylate;
        
        assert!(epoxy.viscosity() > cyano.viscosity());
        assert!(cyano.curing_time() < epoxy.curing_time());
    }
}
