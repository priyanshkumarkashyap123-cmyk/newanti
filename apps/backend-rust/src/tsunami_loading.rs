//! Tsunami Loading Module
//! 
//! Implements tsunami and coastal flood loading per:
//! - ASCE 7-22 Chapter 6 (Tsunami Loads and Effects)
//! - FEMA P-646 (Tsunami Vertical Evacuation)
//! - FEMA P-55 (Coastal Construction Manual)
//! - Japanese Guidelines (2020)

use serde::{Deserialize, Serialize};

// ============================================================================
// TSUNAMI PARAMETERS
// ============================================================================

/// Tsunami risk category
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum TsunamiRiskCategory {
    /// Risk Category II
    II,
    /// Risk Category III
    III,
    /// Risk Category IV (essential facilities)
    IV,
}

impl TsunamiRiskCategory {
    /// Importance factor
    pub fn importance_factor(&self) -> f64 {
        match self {
            Self::II => 1.0,
            Self::III => 1.25,
            Self::IV => 1.5,
        }
    }
}

/// Tsunami design zone
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum TsunamiDesignZone {
    /// Zone I - Shallow water
    ZoneI,
    /// Zone II - Moderate inundation
    ZoneII,
    /// Zone III - Deep inundation
    ZoneIII,
    /// Zone IV - Runup zone
    ZoneIV,
}

/// Tsunami parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TsunamiParameters {
    /// Risk category
    pub risk_category: TsunamiRiskCategory,
    /// Design zone
    pub zone: TsunamiDesignZone,
    /// Maximum inundation depth (m)
    pub inundation_depth: f64,
    /// Flow velocity (m/s)
    pub flow_velocity: f64,
    /// Momentum flux (m³/s²)
    pub momentum_flux: f64,
    /// Ground elevation (m above MSL)
    pub ground_elevation: f64,
    /// Runup elevation (m above MSL)
    pub runup_elevation: f64,
    /// Water density (kg/m³)
    pub water_density: f64,
}

impl TsunamiParameters {
    /// Create from ASCE 7-22 maps
    pub fn from_asce7(
        inundation_depth: f64,
        runup_elevation: f64,
        ground_elevation: f64,
        risk_category: TsunamiRiskCategory,
    ) -> Self {
        // ASCE 7-22 Section 6.6.1 - Velocity
        // u = g * h_max in Froude regime 1
        let h_max = inundation_depth;
        let velocity = (9.81 * h_max).sqrt();
        
        // Momentum flux
        let momentum = h_max * velocity.powi(2);
        
        // Determine zone
        let zone = if h_max < 1.0 {
            TsunamiDesignZone::ZoneI
        } else if h_max < 3.0 {
            TsunamiDesignZone::ZoneII
        } else if h_max < 6.0 {
            TsunamiDesignZone::ZoneIII
        } else {
            TsunamiDesignZone::ZoneIV
        };
        
        Self {
            risk_category,
            zone,
            inundation_depth: h_max,
            flow_velocity: velocity,
            momentum_flux: momentum,
            ground_elevation,
            runup_elevation,
            water_density: 1025.0, // Seawater
        }
    }
    
    /// Calculate using Energy Grade Line Analysis (ASCE 7-22 6.6.2)
    pub fn energy_grade_line_velocity(&self, distance_from_shore: f64, energy_head: f64) -> f64 {
        // Simplified EGL analysis
        let _manning_n = 0.03; // Typical urban/suburban
        let friction_slope = 0.02; // Assumed
        
        // Energy head at location
        let local_energy = energy_head - friction_slope * distance_from_shore;
        
        // Velocity from energy head
        let h = self.inundation_depth;
        let u_squared = (local_energy - h) * 2.0 * 9.81;
        
        u_squared.max(0.0).sqrt()
    }
    
    /// Froude number
    pub fn froude_number(&self) -> f64 {
        self.flow_velocity / (9.81 * self.inundation_depth).sqrt()
    }
    
    /// Modified momentum flux (ASCE 7-22 Eq. 6.10-1)
    pub fn design_momentum_flux(&self) -> f64 {
        let h_max = self.inundation_depth;
        let i_tsu = self.risk_category.importance_factor();
        
        // (hu²)max from Eq. 6.10-1
        1.125 * 9.81 * h_max.powi(2) * i_tsu
    }
}

// ============================================================================
// STRUCTURAL LOADING
// ============================================================================

/// Tsunami load type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum TsunamiLoadType {
    /// Hydrostatic pressure
    Hydrostatic,
    /// Buoyancy
    Buoyancy,
    /// Hydrodynamic (drag)
    Hydrodynamic,
    /// Impulsive (bore impact)
    Impulsive,
    /// Debris impact
    DebrisImpact,
    /// Damming
    Damming,
    /// Uplift
    Uplift,
    /// Wave breaking
    WaveBreaking,
}

/// Building occupancy for closure ratio
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum BuildingOccupancy {
    /// Open structure (parking garage)
    Open,
    /// Residential
    Residential,
    /// Commercial
    Commercial,
    /// Industrial
    Industrial,
    /// Critical facility
    Critical,
}

impl BuildingOccupancy {
    /// Closure coefficient (Ccx)
    pub fn closure_coefficient(&self) -> f64 {
        match self {
            Self::Open => 0.7,
            Self::Residential => 0.8,
            Self::Commercial => 0.8,
            Self::Industrial => 0.85,
            Self::Critical => 0.9,
        }
    }
}

/// Tsunami structural loads
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TsunamiLoads {
    /// Building width (m)
    pub width: f64,
    /// Building depth (m)
    pub depth: f64,
    /// Number of stories
    pub stories: usize,
    /// Story height (m)
    pub story_height: f64,
    /// Occupancy type
    pub occupancy: BuildingOccupancy,
    /// Closure ratio
    pub closure_ratio: f64,
    /// Breakaway wall ratio
    pub breakaway_ratio: f64,
}

impl TsunamiLoads {
    pub fn new(
        width: f64,
        depth: f64,
        stories: usize,
        story_height: f64,
        occupancy: BuildingOccupancy,
    ) -> Self {
        Self {
            width,
            depth,
            stories,
            story_height,
            occupancy,
            closure_ratio: occupancy.closure_coefficient(),
            breakaway_ratio: 0.0,
        }
    }
    
    /// Hydrostatic force (kN/m)
    pub fn hydrostatic_force(&self, params: &TsunamiParameters) -> f64 {
        // ASCE 7-22 Eq. 6.10-2
        let rho = params.water_density;
        let g = 9.81;
        let h = params.inundation_depth;
        
        0.5 * rho * g * h.powi(2) / 1000.0
    }
    
    /// Buoyancy force (kN)
    pub fn buoyancy_force(&self, params: &TsunamiParameters, flooded_volume: f64) -> f64 {
        // ASCE 7-22 Section 6.10.2
        let rho = params.water_density;
        let g = 9.81;
        let h = params.inundation_depth;
        
        // Displaced volume
        let displaced_vol = self.width * self.depth * h.min(self.story_height * self.stories as f64);
        
        // Net buoyancy (displaced - flooded)
        let net_vol = displaced_vol - flooded_volume;
        
        rho * g * net_vol / 1000.0
    }
    
    /// Hydrodynamic force (drag) (kN)
    pub fn hydrodynamic_force(&self, params: &TsunamiParameters) -> f64 {
        // ASCE 7-22 Eq. 6.10-5
        let rho = params.water_density;
        let h = params.inundation_depth;
        let b = self.width;
        let ccx = self.closure_ratio;
        let hu_sq = params.design_momentum_flux();
        
        // Drag coefficient
        let cd = self.drag_coefficient(params);
        
        // Area exposed
        let _a_exp = b * h.min(self.story_height);
        
        0.5 * rho * cd * ccx * b * hu_sq / 1000.0
    }
    
    /// Drag coefficient per ASCE 7-22 Table 6.10-1
    fn drag_coefficient(&self, params: &TsunamiParameters) -> f64 {
        let _fr = params.froude_number();
        let ratio = self.width / self.depth;
        
        // Simplified from Table 6.10-1
        if ratio >= 12.0 {
            2.0
        } else if ratio >= 6.0 {
            1.75
        } else if ratio >= 3.0 {
            1.5
        } else if ratio >= 2.0 {
            1.3
        } else {
            1.25
        }
    }
    
    /// Impulsive bore force (kN)
    pub fn impulsive_force(&self, params: &TsunamiParameters) -> f64 {
        // ASCE 7-22 Eq. 6.10-6
        let rho = params.water_density;
        let g = 9.81;
        let h = params.inundation_depth;
        let _u = params.flow_velocity;
        let b = self.width;
        let ccx = self.closure_ratio;
        
        // Bore height
        let h_bore = h * 0.7; // Approximate
        
        // Impulsive coefficient
        let c_i = 1.5;
        
        c_i * rho * g * ccx * b * h_bore.powi(2) / 1000.0
    }
    
    /// Debris impact force (kN)
    pub fn debris_impact_force(&self, params: &TsunamiParameters, debris_type: DebrisType) -> f64 {
        // ASCE 7-22 Section 6.11
        let i_tsu = params.risk_category.importance_factor();
        let u = params.flow_velocity;
        let co = debris_type.orientation_factor();
        let (md, _cd, _bd) = debris_type.properties();
        
        // Maximum debris force
        // Fi = 1.3 * u_max * sqrt(md * k_eff)
        let k_eff = debris_type.stiffness(); // kN/m
        
        i_tsu * co * 1.3 * u * (md * k_eff).sqrt()
    }
    
    /// Damming force (kN)
    pub fn damming_force(&self, params: &TsunamiParameters, debris_depth: f64) -> f64 {
        // ASCE 7-22 Eq. 6.10-9
        let rho = params.water_density;
        let ccx = self.closure_ratio;
        let b = self.width;
        let hu_sq = params.design_momentum_flux();
        
        // Closure ratio adjusted for debris dam
        let ccx_dam = (ccx + debris_depth / params.inundation_depth).min(1.0);
        
        0.5 * rho * ccx_dam * b * hu_sq / 1000.0
    }
    
    /// Uplift force on elevated floor (kN/m²)
    pub fn uplift_force(&self, params: &TsunamiParameters, floor_elevation: f64) -> f64 {
        let rho = params.water_density;
        let g = 9.81;
        
        let h = params.inundation_depth;
        let elev = floor_elevation - params.ground_elevation;
        
        if h > elev {
            // Hydrostatic uplift
            rho * g * (h - elev) / 1000.0
        } else {
            0.0
        }
    }
    
    /// Wave breaking force (kN/m)
    pub fn wave_breaking_force(&self, wave_height: f64) -> f64 {
        // FEMA P-55 breaking wave formula
        let rho = 1025.0;
        let g = 9.81;
        let cp = 2.8; // Breaking wave coefficient
        
        cp * rho * g * wave_height.powi(2) / 1000.0
    }
    
    /// Total lateral force envelope (kN)
    pub fn total_lateral_force(&self, params: &TsunamiParameters) -> TsunamiForceEnvelope {
        let hydro = self.hydrostatic_force(params) * self.depth;
        let drag = self.hydrodynamic_force(params);
        let impulsive = self.impulsive_force(params);
        
        // ASCE 7-22 6.12 - force combinations
        let debris = self.debris_impact_force(params, DebrisType::WoodLog);
        
        TsunamiForceEnvelope {
            hydrostatic: hydro,
            hydrodynamic: drag,
            impulsive,
            debris_impact: debris,
            governing: hydro.max(drag).max(impulsive),
        }
    }
}

/// Debris type for impact
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum DebrisType {
    /// Wood log
    WoodLog,
    /// Shipping container (empty)
    ContainerEmpty,
    /// Shipping container (loaded)
    ContainerLoaded,
    /// Small vessel
    SmallVessel,
    /// Vehicle
    Vehicle,
    /// Building debris
    BuildingDebris,
}

impl DebrisType {
    /// Mass, drag coefficient, breadth (kg, -, m)
    pub fn properties(&self) -> (f64, f64, f64) {
        match self {
            Self::WoodLog => (450.0, 1.2, 0.3),
            Self::ContainerEmpty => (2000.0, 1.5, 2.44),
            Self::ContainerLoaded => (20000.0, 1.5, 2.44),
            Self::SmallVessel => (2000.0, 1.3, 3.0),
            Self::Vehicle => (1500.0, 1.2, 1.8),
            Self::BuildingDebris => (1000.0, 2.0, 2.0),
        }
    }
    
    /// Orientation factor
    pub fn orientation_factor(&self) -> f64 {
        match self {
            Self::WoodLog => 0.65,
            Self::ContainerEmpty | Self::ContainerLoaded => 0.85,
            _ => 1.0,
        }
    }
    
    /// Effective stiffness (kN/m)
    pub fn stiffness(&self) -> f64 {
        match self {
            Self::WoodLog => 2500.0,
            Self::ContainerEmpty => 1500.0,
            Self::ContainerLoaded => 3000.0,
            Self::SmallVessel => 1000.0,
            Self::Vehicle => 1200.0,
            Self::BuildingDebris => 2000.0,
        }
    }
}

/// Tsunami force envelope
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TsunamiForceEnvelope {
    /// Hydrostatic force (kN)
    pub hydrostatic: f64,
    /// Hydrodynamic force (kN)
    pub hydrodynamic: f64,
    /// Impulsive force (kN)
    pub impulsive: f64,
    /// Debris impact force (kN)
    pub debris_impact: f64,
    /// Governing force (kN)
    pub governing: f64,
}

// ============================================================================
// VERTICAL EVACUATION STRUCTURES
// ============================================================================

/// Vertical evacuation structure requirements
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerticalEvacuation {
    /// Refuge floor elevation (m above grade)
    pub refuge_elevation: f64,
    /// Required capacity (persons)
    pub capacity: usize,
    /// Area per person (m²)
    pub area_per_person: f64,
    /// Ingress time (minutes)
    pub ingress_time: f64,
    /// Warning time (minutes)
    pub warning_time: f64,
}

impl VerticalEvacuation {
    /// Calculate required refuge elevation (FEMA P-646)
    pub fn required_elevation(
        runup_elevation: f64,
        ground_elevation: f64,
        freeboard: f64,
    ) -> f64 {
        // Refuge elevation = runup + freeboard
        let inundation = runup_elevation - ground_elevation;
        
        // Minimum freeboard of 3m or 30% of inundation
        let min_freeboard = (0.3 * inundation).max(3.0);
        let design_freeboard = freeboard.max(min_freeboard);
        
        inundation + design_freeboard
    }
    
    /// Calculate required floor area
    pub fn required_area(&self) -> f64 {
        self.capacity as f64 * self.area_per_person
    }
    
    /// Check warning time adequacy
    pub fn adequate_warning(&self, travel_distance: f64, walking_speed: f64) -> bool {
        let travel_time = travel_distance / walking_speed / 60.0; // minutes
        let total_time = travel_time + self.ingress_time;
        
        total_time <= self.warning_time
    }
    
    /// Capacity per stairwell
    pub fn stairwell_capacity(stair_width: f64, _n_floors: usize, evacuation_time: f64) -> usize {
        // Flow rate approximately 60 persons/meter/minute for stairs
        let flow_rate = 40.0; // Conservative for descent
        let total_flow = flow_rate * stair_width * evacuation_time;
        
        total_flow as usize
    }
}

// ============================================================================
// SCOUR
// ============================================================================

/// Tsunami scour analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TsunamiScour {
    /// Maximum scour depth (m)
    pub max_scour: f64,
    /// Scour extent (m from foundation)
    pub extent: f64,
    /// Soil type
    pub soil_type: ScourSoilType,
}

/// Soil type for scour
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ScourSoilType {
    /// Fine sand
    FineSand,
    /// Medium sand
    MediumSand,
    /// Coarse sand
    CoarseSand,
    /// Gravel
    Gravel,
    /// Stiff clay
    StiffClay,
    /// Soft clay
    SoftClay,
}

impl ScourSoilType {
    /// Critical velocity (m/s)
    pub fn critical_velocity(&self) -> f64 {
        match self {
            Self::FineSand => 0.3,
            Self::MediumSand => 0.5,
            Self::CoarseSand => 0.8,
            Self::Gravel => 1.5,
            Self::StiffClay => 2.0,
            Self::SoftClay => 0.5,
        }
    }
    
    /// Erodibility factor
    pub fn erodibility(&self) -> f64 {
        match self {
            Self::FineSand => 1.5,
            Self::MediumSand => 1.0,
            Self::CoarseSand => 0.8,
            Self::Gravel => 0.5,
            Self::StiffClay => 0.3,
            Self::SoftClay => 1.2,
        }
    }
}

impl TsunamiScour {
    /// Calculate scour depth (simplified)
    pub fn calculate(
        params: &TsunamiParameters,
        soil_type: ScourSoilType,
        foundation_width: f64,
        duration: f64,
    ) -> Self {
        let u = params.flow_velocity;
        let h = params.inundation_depth;
        let u_cr = soil_type.critical_velocity();
        
        // Scour occurs if velocity exceeds critical
        let max_scour = if u > u_cr {
            let excess = (u - u_cr) / u_cr;
            let base_scour = 0.5 * h; // Base scour depth
            
            // Modified by duration and soil
            let time_factor = (duration / 600.0).min(1.0); // Normalized to 10 min
            
            base_scour * excess * soil_type.erodibility() * time_factor
        } else {
            0.0
        };
        
        // Scour extent
        let extent = 2.0 * max_scour + foundation_width;
        
        Self {
            max_scour,
            extent,
            soil_type,
        }
    }
    
    /// Required foundation embedment
    pub fn required_embedment(&self, factor_of_safety: f64) -> f64 {
        self.max_scour * factor_of_safety + 1.0 // Minimum 1m below scour
    }
}

// ============================================================================
// LOAD CASES AND COMBINATIONS
// ============================================================================

/// Tsunami load case
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum TsunamiLoadCase {
    /// Inflow (incoming wave)
    Inflow,
    /// Maximum inundation
    MaxInundation,
    /// Outflow (return flow)
    Outflow,
}

/// Tsunami load combinations per ASCE 7-22 Section 6.8
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TsunamiLoadCombinations {
    /// Load case 1: D + Ftsu + 0.25L
    pub case1: f64,
    /// Load case 2: 0.9D + Ftsu + 1.6Fb
    pub case2: f64,
    /// Load case 3: D + Ftsu + 0.5Fs
    pub case3: f64,
    /// Governing combination
    pub governing: usize,
}

impl TsunamiLoadCombinations {
    /// Calculate LRFD combinations
    pub fn calculate(
        dead_load: f64,
        live_load: f64,
        tsunami_lateral: f64,
        buoyancy: f64,
        scour_effect: f64,
    ) -> Self {
        let case1 = dead_load + tsunami_lateral + 0.25 * live_load;
        let case2 = 0.9 * dead_load + tsunami_lateral + 1.6 * buoyancy;
        let case3 = dead_load + tsunami_lateral + 0.5 * scour_effect;
        
        let max_case = case1.max(case2).max(case3);
        let governing = if (case1 - max_case).abs() < 0.01 {
            1
        } else if (case2 - max_case).abs() < 0.01 {
            2
        } else {
            3
        };
        
        Self {
            case1,
            case2,
            case3,
            governing,
        }
    }
}

// ============================================================================
// FOUNDATION REQUIREMENTS
// ============================================================================

/// Tsunami-resistant foundation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TsunamiFoundation {
    /// Foundation type
    pub foundation_type: FoundationType,
    /// Embedment depth (m)
    pub embedment: f64,
    /// Scour protection provided
    pub scour_protection: bool,
    /// Liquefaction potential
    pub liquefaction_potential: bool,
}

/// Foundation type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum FoundationType {
    /// Shallow spread footing
    ShallowFooting,
    /// Mat foundation
    MatFoundation,
    /// Deep piles
    DeepPiles,
    /// Drilled shafts
    DrilledShafts,
    /// Combined system
    Combined,
}

impl TsunamiFoundation {
    /// Check foundation adequacy
    pub fn check_adequacy(
        &self,
        scour: &TsunamiScour,
        lateral_force: f64,
        overturning_moment: f64,
    ) -> FoundationCheck {
        let scour_ok = self.embedment >= scour.required_embedment(1.5);
        
        // Simplified stability checks
        let sliding_ok = lateral_force < 500.0; // Placeholder
        let overturning_ok = overturning_moment < 1000.0; // Placeholder
        
        FoundationCheck {
            scour_adequate: scour_ok || self.scour_protection,
            sliding_stable: sliding_ok,
            overturning_stable: overturning_ok,
            overall_adequate: scour_ok && sliding_ok && overturning_ok,
        }
    }
}

/// Foundation check results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FoundationCheck {
    pub scour_adequate: bool,
    pub sliding_stable: bool,
    pub overturning_stable: bool,
    pub overall_adequate: bool,
}

// ============================================================================
// TIME HISTORY
// ============================================================================

/// Tsunami inundation time history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TsunamiTimeHistory {
    /// Time (minutes from warning)
    pub time: Vec<f64>,
    /// Water depth (m)
    pub depth: Vec<f64>,
    /// Flow velocity (m/s)
    pub velocity: Vec<f64>,
    /// Momentum flux (m³/s²)
    pub momentum: Vec<f64>,
}

impl TsunamiTimeHistory {
    /// Generate idealized time history
    pub fn generate_idealized(
        arrival_time: f64,
        max_depth: f64,
        max_velocity: f64,
        duration: f64,
    ) -> Self {
        let dt = 0.5; // 30 seconds
        let n_steps = ((arrival_time + duration + 30.0) / dt) as usize;
        
        let mut time = Vec::with_capacity(n_steps);
        let mut depth = Vec::with_capacity(n_steps);
        let mut velocity = Vec::with_capacity(n_steps);
        let mut momentum = Vec::with_capacity(n_steps);
        
        for i in 0..n_steps {
            let t = i as f64 * dt;
            time.push(t);
            
            // Before arrival
            if t < arrival_time {
                depth.push(0.0);
                velocity.push(0.0);
                momentum.push(0.0);
                continue;
            }
            
            // During inundation
            let t_rel = t - arrival_time;
            let phase = t_rel / duration;
            
            let (h, u) = if phase < 0.3 {
                // Rising limb (rapid rise)
                let rise = phase / 0.3;
                (max_depth * rise.powi(2), max_velocity * rise)
            } else if phase < 0.5 {
                // Peak
                (max_depth, max_velocity * (1.0 - 0.5 * (phase - 0.3) / 0.2))
            } else if phase < 1.0 {
                // Falling limb
                let fall = (phase - 0.5) / 0.5;
                let h_fall = max_depth * (1.0 - fall.sqrt());
                let u_fall = -max_velocity * 0.7 * fall.sqrt(); // Return flow
                (h_fall, u_fall)
            } else {
                (0.0, 0.0)
            };
            
            depth.push(h);
            velocity.push(u);
            momentum.push(h * u.powi(2));
        }
        
        Self {
            time,
            depth,
            velocity,
            momentum,
        }
    }
    
    /// Maximum values
    pub fn maxima(&self) -> (f64, f64, f64) {
        let max_depth = self.depth.iter().cloned().fold(0.0, f64::max);
        let max_velocity = self.velocity.iter().map(|v| v.abs()).fold(0.0, f64::max);
        let max_momentum = self.momentum.iter().cloned().fold(0.0, f64::max);
        
        (max_depth, max_velocity, max_momentum)
    }
    
    /// Duration of inundation (minutes)
    pub fn inundation_duration(&self) -> f64 {
        let wet_count = self.depth.iter().filter(|&&d| d > 0.1).count();
        wet_count as f64 * 0.5 // dt = 0.5 min
    }
}

// ============================================================================
// STRUCTURAL REQUIREMENTS
// ============================================================================

/// Tsunami structural requirements check
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TsunamiRequirements {
    /// Open first floor required
    pub open_first_floor: bool,
    /// Breakaway walls required
    pub breakaway_walls: bool,
    /// Deep foundation required
    pub deep_foundation: bool,
    /// Scour protection required
    pub scour_protection: bool,
    /// Flood-resistant materials below BFE
    pub flood_resistant_materials: bool,
    /// Structural connectivity adequate
    pub structural_connectivity: bool,
}

impl TsunamiRequirements {
    /// Determine requirements based on parameters
    pub fn determine(params: &TsunamiParameters, n_stories: usize) -> Self {
        let h = params.inundation_depth;
        
        Self {
            open_first_floor: h > 3.0,
            breakaway_walls: h > 1.5 && h <= 3.0,
            deep_foundation: h > 2.0,
            scour_protection: params.flow_velocity > 2.0,
            flood_resistant_materials: h > 0.0,
            structural_connectivity: n_stories > 3,
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
    fn test_tsunami_parameters() {
        let params = TsunamiParameters::from_asce7(
            5.0, // inundation depth
            10.0, // runup elevation
            2.0, // ground elevation
            TsunamiRiskCategory::III,
        );
        
        assert!(params.flow_velocity > 0.0);
        assert!(params.momentum_flux > 0.0);
    }

    #[test]
    fn test_froude_number() {
        let params = TsunamiParameters::from_asce7(4.0, 8.0, 2.0, TsunamiRiskCategory::II);
        
        let fr = params.froude_number();
        assert!(fr > 0.0 && fr < 3.0); // Subcritical to supercritical range
    }

    #[test]
    fn test_hydrostatic_force() {
        let params = TsunamiParameters::from_asce7(3.0, 6.0, 1.0, TsunamiRiskCategory::II);
        let loads = TsunamiLoads::new(10.0, 20.0, 3, 3.5, BuildingOccupancy::Commercial);
        
        let f_h = loads.hydrostatic_force(&params);
        assert!(f_h > 0.0);
    }

    #[test]
    fn test_hydrodynamic_force() {
        let params = TsunamiParameters::from_asce7(4.0, 8.0, 2.0, TsunamiRiskCategory::III);
        let loads = TsunamiLoads::new(15.0, 25.0, 4, 3.5, BuildingOccupancy::Critical);
        
        let f_d = loads.hydrodynamic_force(&params);
        assert!(f_d > 0.0);
    }

    #[test]
    fn test_debris_impact() {
        let params = TsunamiParameters::from_asce7(3.0, 6.0, 1.0, TsunamiRiskCategory::IV);
        let loads = TsunamiLoads::new(10.0, 15.0, 2, 4.0, BuildingOccupancy::Residential);
        
        let f_debris = loads.debris_impact_force(&params, DebrisType::ContainerEmpty);
        assert!(f_debris > 0.0);
    }

    #[test]
    fn test_vertical_evacuation() {
        let refuge_elev = VerticalEvacuation::required_elevation(10.0, 2.0, 3.0);
        
        assert!(refuge_elev > 10.0);
    }

    #[test]
    fn test_scour() {
        let params = TsunamiParameters::from_asce7(4.0, 8.0, 2.0, TsunamiRiskCategory::II);
        let scour = TsunamiScour::calculate(&params, ScourSoilType::MediumSand, 2.0, 300.0);
        
        assert!(scour.max_scour >= 0.0);
    }

    #[test]
    fn test_load_combinations() {
        let combos = TsunamiLoadCombinations::calculate(
            500.0,  // dead load
            100.0,  // live load
            800.0,  // tsunami lateral
            200.0,  // buoyancy
            50.0,   // scour effect
        );
        
        assert!(combos.governing >= 1 && combos.governing <= 3);
    }

    #[test]
    fn test_time_history() {
        let th = TsunamiTimeHistory::generate_idealized(
            15.0,  // arrival time (min)
            5.0,   // max depth
            8.0,   // max velocity
            30.0,  // duration
        );
        
        let (max_d, max_v, _) = th.maxima();
        assert!((max_d - 5.0).abs() < 0.1);
        assert!(max_v > 0.0);
    }

    #[test]
    fn test_tsunami_requirements() {
        let params = TsunamiParameters::from_asce7(5.0, 10.0, 2.0, TsunamiRiskCategory::III);
        let req = TsunamiRequirements::determine(&params, 4);
        
        assert!(req.open_first_floor);
        assert!(req.deep_foundation);
    }

    #[test]
    fn test_force_envelope() {
        let params = TsunamiParameters::from_asce7(4.0, 8.0, 2.0, TsunamiRiskCategory::III);
        let loads = TsunamiLoads::new(12.0, 20.0, 3, 3.5, BuildingOccupancy::Commercial);
        
        let envelope = loads.total_lateral_force(&params);
        
        assert!(envelope.governing > 0.0);
    }

    #[test]
    fn test_buoyancy() {
        let params = TsunamiParameters::from_asce7(3.0, 6.0, 1.0, TsunamiRiskCategory::II);
        let loads = TsunamiLoads::new(10.0, 15.0, 2, 3.5, BuildingOccupancy::Residential);
        
        let buoyancy = loads.buoyancy_force(&params, 50.0);
        assert!(buoyancy > 0.0);
    }

    #[test]
    fn test_uplift() {
        let params = TsunamiParameters::from_asce7(5.0, 10.0, 2.0, TsunamiRiskCategory::III);
        let loads = TsunamiLoads::new(10.0, 15.0, 2, 3.5, BuildingOccupancy::Commercial);
        
        let uplift = loads.uplift_force(&params, 3.5); // Floor at 3.5m
        assert!(uplift > 0.0);
    }

    #[test]
    fn test_foundation_check() {
        let foundation = TsunamiFoundation {
            foundation_type: FoundationType::DeepPiles,
            embedment: 10.0,
            scour_protection: true,
            liquefaction_potential: false,
        };
        
        let scour = TsunamiScour {
            max_scour: 2.0,
            extent: 6.0,
            soil_type: ScourSoilType::MediumSand,
        };
        
        let check = foundation.check_adequacy(&scour, 400.0, 800.0);
        assert!(check.scour_adequate);
    }
}
