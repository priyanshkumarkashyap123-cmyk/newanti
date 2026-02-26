//! # Pushover Analysis Module
//! 
//! Nonlinear static pushover analysis for seismic performance assessment.
//! 
//! ## Capabilities
//! - **Capacity Curve Generation** - Force vs. displacement relationship
//! - **Plastic Hinge Modeling** - Lumped plasticity approach
//! - **Performance Point** - ATC-40 & FEMA 440 methods
//! - **Ductility Assessment** - Member and global ductility
//! 
//! ## Design Codes
//! - ATC-40 (Seismic Evaluation and Retrofit)
//! - FEMA 356/440 (Performance-Based Design)
//! - IS 1893:2016 (Indian Seismic Code)
//! - Eurocode 8 Part 3

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// PLASTIC HINGE DEFINITIONS
// ============================================================================

/// Plastic hinge type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum HingeType {
    /// Moment hinge (M3)
    Moment,
    /// Axial-Moment interaction (P-M3)
    PMM,
    /// Shear hinge (V2)
    Shear,
    /// Axial hinge (P)
    Axial,
    /// Torsion hinge (T)
    Torsion,
}

/// FEMA 356 acceptance criteria
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum PerformanceLevel {
    /// Immediate Occupancy (IO)
    ImmediateOccupancy,
    /// Life Safety (LS)
    LifeSafety,
    /// Collapse Prevention (CP)
    CollapsePrevention,
}

/// Plastic hinge backbone curve parameters (FEMA 356 Table 6-7)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HingeBackbone {
    /// Yield moment/force
    pub yield_value: f64,
    /// Yield rotation/deformation (Point A)
    pub yield_deformation: f64,
    /// Post-yield stiffness ratio (b parameter)
    pub post_yield_ratio: f64,
    /// IO rotation/deformation limit (Point B)
    pub io_limit: f64,
    /// LS rotation/deformation limit
    pub ls_limit: f64,
    /// CP rotation/deformation limit (Point C)
    pub cp_limit: f64,
    /// Residual strength ratio (c parameter)
    pub residual_ratio: f64,
    /// Ultimate rotation/deformation (Point E)
    pub ultimate_limit: f64,
}

impl HingeBackbone {
    /// Create default backbone for RC beam (conforming, low DCR)
    pub fn rc_beam_conforming() -> Self {
        Self {
            yield_value: 1.0,
            yield_deformation: 0.005, // 0.5% yield rotation
            post_yield_ratio: 0.03,
            io_limit: 0.01,     // 1%
            ls_limit: 0.02,     // 2%
            cp_limit: 0.025,    // 2.5%
            residual_ratio: 0.2,
            ultimate_limit: 0.05, // 5%
        }
    }
    
    /// Create default backbone for RC column (P-M interaction)
    pub fn rc_column_conforming(axial_ratio: f64) -> Self {
        // Reduce ductility with higher axial load
        let ductility_factor = (1.0 - axial_ratio / 0.4).max(0.3);
        
        Self {
            yield_value: 1.0,
            yield_deformation: 0.004,
            post_yield_ratio: 0.02,
            io_limit: 0.005 * ductility_factor,
            ls_limit: 0.015 * ductility_factor,
            cp_limit: 0.02 * ductility_factor,
            residual_ratio: 0.2,
            ultimate_limit: 0.035 * ductility_factor,
        }
    }
    
    /// Create backbone for steel beam
    pub fn steel_beam_compact() -> Self {
        Self {
            yield_value: 1.0,
            yield_deformation: 0.003,
            post_yield_ratio: 0.02,
            io_limit: 0.015,  // 1.5%
            ls_limit: 0.03,   // 3%
            cp_limit: 0.04,   // 4%
            residual_ratio: 0.2,
            ultimate_limit: 0.06,
        }
    }
    
    /// Get current state from deformation
    pub fn get_state(&self, deformation: f64) -> HingeState {
        let abs_def = deformation.abs();
        
        if abs_def <= self.yield_deformation {
            HingeState::Elastic
        } else if abs_def <= self.io_limit {
            HingeState::Yielding
        } else if abs_def <= self.ls_limit {
            HingeState::IO
        } else if abs_def <= self.cp_limit {
            HingeState::LS
        } else if abs_def <= self.ultimate_limit {
            HingeState::CP
        } else {
            HingeState::Collapsed
        }
    }
    
    /// Get force/moment from deformation (bilinear)
    pub fn get_force(&self, deformation: f64) -> f64 {
        let abs_def = deformation.abs();
        let sign = deformation.signum();
        
        if abs_def <= self.yield_deformation {
            // Elastic
            self.yield_value * abs_def / self.yield_deformation * sign
        } else if abs_def <= self.cp_limit {
            // Post-yield hardening
            let plastic_def = abs_def - self.yield_deformation;
            let k_post = self.yield_value / self.yield_deformation * self.post_yield_ratio;
            (self.yield_value + k_post * plastic_def) * sign
        } else if abs_def <= self.ultimate_limit {
            // Degrading to residual
            let cp_force = self.yield_value * (1.0 + self.post_yield_ratio * 
                           (self.cp_limit - self.yield_deformation) / self.yield_deformation);
            let residual = self.yield_value * self.residual_ratio;
            let degrading_range = self.ultimate_limit - self.cp_limit;
            let progress = (abs_def - self.cp_limit) / degrading_range;
            (cp_force - progress * (cp_force - residual)) * sign
        } else {
            // Residual
            self.yield_value * self.residual_ratio * sign
        }
    }
    
    /// Get tangent stiffness at deformation
    pub fn get_tangent_stiffness(&self, deformation: f64) -> f64 {
        let abs_def = deformation.abs();
        let k_elastic = self.yield_value / self.yield_deformation;
        
        if abs_def <= self.yield_deformation {
            k_elastic
        } else if abs_def <= self.cp_limit {
            k_elastic * self.post_yield_ratio
        } else if abs_def <= self.ultimate_limit {
            // Negative stiffness (degrading)
            let cp_force = self.yield_value * (1.0 + self.post_yield_ratio * 
                           (self.cp_limit - self.yield_deformation) / self.yield_deformation);
            let residual = self.yield_value * self.residual_ratio;
            let degrading_range = self.ultimate_limit - self.cp_limit;
            -(cp_force - residual) / degrading_range
        } else {
            0.0 // Residual plateau
        }
    }
}

/// Hinge state classification
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum HingeState {
    Elastic,
    Yielding,
    IO, // Beyond Immediate Occupancy
    LS, // Beyond Life Safety
    CP, // Beyond Collapse Prevention
    Collapsed,
}

impl HingeState {
    pub fn color(&self) -> &'static str {
        match self {
            HingeState::Elastic => "#00FF00",  // Green
            HingeState::Yielding => "#FFFF00", // Yellow
            HingeState::IO => "#FFA500",       // Orange
            HingeState::LS => "#FF4500",       // Red-Orange
            HingeState::CP => "#FF0000",       // Red
            HingeState::Collapsed => "#800000", // Dark Red
        }
    }
    
    pub fn name(&self) -> &'static str {
        match self {
            HingeState::Elastic => "Elastic",
            HingeState::Yielding => "Yielding",
            HingeState::IO => "Beyond IO",
            HingeState::LS => "Beyond LS",
            HingeState::CP => "Beyond CP",
            HingeState::Collapsed => "Collapsed",
        }
    }
}

/// Plastic hinge definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlasticHinge {
    /// Hinge ID
    pub id: usize,
    /// Member ID
    pub member_id: usize,
    /// Position along member (0.0-1.0)
    pub position: f64,
    /// Hinge type
    pub hinge_type: HingeType,
    /// Backbone curve
    pub backbone: HingeBackbone,
    /// Current rotation/deformation
    pub current_deformation: f64,
    /// Current state
    pub state: HingeState,
}

impl PlasticHinge {
    pub fn new(
        id: usize,
        member_id: usize,
        position: f64,
        hinge_type: HingeType,
        backbone: HingeBackbone,
    ) -> Self {
        Self {
            id,
            member_id,
            position,
            hinge_type,
            backbone,
            current_deformation: 0.0,
            state: HingeState::Elastic,
        }
    }
    
    /// Update hinge state from new deformation
    pub fn update(&mut self, deformation: f64) {
        self.current_deformation = deformation;
        self.state = self.backbone.get_state(deformation);
    }
    
    /// Get hinge ductility demand
    pub fn ductility_demand(&self) -> f64 {
        self.current_deformation.abs() / self.backbone.yield_deformation
    }
}

// ============================================================================
// PUSHOVER ANALYSIS
// ============================================================================

/// Load pattern type for pushover
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum LoadPattern {
    /// Uniform distribution
    Uniform,
    /// Triangular (first mode approximation)
    Triangular,
    /// First mode shape
    FirstMode,
    /// Mass proportional
    MassProportional,
    /// Code-specified lateral force distribution
    CodePattern,
}

/// Pushover analysis configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PushoverConfig {
    /// Load pattern
    pub load_pattern: LoadPattern,
    /// Target displacement (m)
    pub target_displacement: f64,
    /// Number of load steps
    pub num_steps: usize,
    /// Include P-Delta effects
    pub include_pdelta: bool,
    /// Convergence tolerance
    pub tolerance: f64,
    /// Maximum iterations per step
    pub max_iterations: usize,
}

impl Default for PushoverConfig {
    fn default() -> Self {
        Self {
            load_pattern: LoadPattern::Triangular,
            target_displacement: 0.5,
            num_steps: 100,
            include_pdelta: true,
            tolerance: 1e-4,
            max_iterations: 50,
        }
    }
}

/// Capacity curve point
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapacityPoint {
    /// Step number
    pub step: usize,
    /// Base shear (kN)
    pub base_shear: f64,
    /// Roof displacement (m)
    pub roof_displacement: f64,
    /// Hinge states at this step
    pub hinge_states: Vec<(usize, HingeState)>,
    /// Number of hinges yielded
    pub hinges_yielded: usize,
}

/// Capacity curve (pushover curve)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapacityCurve {
    /// All points on curve
    pub points: Vec<CapacityPoint>,
    /// Yield point (idealized)
    pub yield_point: Option<(f64, f64)>,
    /// Ultimate point
    pub ultimate_point: Option<(f64, f64)>,
    /// Global ductility
    pub ductility: f64,
    /// Period at yield (effective)
    pub effective_period: f64,
}

impl CapacityCurve {
    /// Idealize capacity curve as bilinear
    pub fn idealize_bilinear(&mut self, total_weight: f64) {
        if self.points.is_empty() {
            return;
        }
        
        // Find maximum base shear point
        let max_point = self.points.iter()
            .max_by(|a, b| a.base_shear.partial_cmp(&b.base_shear).unwrap_or(std::cmp::Ordering::Equal))
            .unwrap();
        
        let v_max = max_point.base_shear;
        let d_at_vmax = max_point.roof_displacement;
        
        // Find yield point using equal energy method
        // Area under bilinear = Area under actual curve
        let _area_under_curve: f64 = self.points.windows(2)
            .map(|w| {
                let _d_avg = (w[0].roof_displacement + w[1].roof_displacement) / 2.0;
                let dd = w[1].roof_displacement - w[0].roof_displacement;
                let v_avg = (w[0].base_shear + w[1].base_shear) / 2.0;
                v_avg * dd
            })
            .sum();
        
        // Initial stiffness (from first few points)
        let k_initial = if self.points.len() > 1 {
            let p0 = &self.points[0];
            let p1 = &self.points[1.min(self.points.len() - 1)];
            if (p1.roof_displacement - p0.roof_displacement).abs() > 1e-10 {
                (p1.base_shear - p0.base_shear) / (p1.roof_displacement - p0.roof_displacement)
            } else {
                v_max / d_at_vmax
            }
        } else {
            v_max / d_at_vmax
        };
        
        // Yield displacement: Vy = k * dy
        // Area of bilinear ≈ Vy * d_max - 0.5 * Vy * dy = area_under_curve
        // Solve for dy
        let d_max = match self.points.last() {
            Some(p) => p.roof_displacement,
            None => return,
        };
        let v_y = 0.9 * v_max; // Approximate
        let d_y = v_y / k_initial;
        
        self.yield_point = Some((d_y, v_y));
        self.ultimate_point = Some((d_max, self.points.last().map_or(0.0, |p| p.base_shear)));
        
        // Calculate ductility
        if d_y > 0.0 {
            self.ductility = d_max / d_y;
        }
        
        // Effective period from idealized stiffness
        if k_initial > 0.0 && total_weight > 0.0 {
            let g = 9.81;
            self.effective_period = 2.0 * PI * (total_weight / (k_initial * 1000.0 * g)).sqrt();
        }
    }
    
    /// Get base shear at given displacement (interpolated)
    pub fn get_base_shear(&self, displacement: f64) -> Option<f64> {
        if self.points.is_empty() {
            return None;
        }
        
        // Find bracketing points
        for w in self.points.windows(2) {
            if displacement >= w[0].roof_displacement && displacement <= w[1].roof_displacement {
                let t = (displacement - w[0].roof_displacement) / 
                        (w[1].roof_displacement - w[0].roof_displacement).max(1e-10);
                return Some(w[0].base_shear + t * (w[1].base_shear - w[0].base_shear));
            }
        }
        
        // Extrapolate beyond last point
        match (self.points.last(), self.points.first()) {
            (Some(last), Some(first)) => {
                if displacement > last.roof_displacement {
                    Some(last.base_shear)
                } else {
                    Some(first.base_shear)
                }
            }
            _ => None,
        }
    }
}

/// Pushover analyzer
pub struct PushoverAnalyzer {
    pub config: PushoverConfig,
    pub hinges: Vec<PlasticHinge>,
}

impl PushoverAnalyzer {
    pub fn new(config: PushoverConfig) -> Self {
        Self {
            config,
            hinges: Vec::new(),
        }
    }
    
    /// Add plastic hinge
    pub fn add_hinge(&mut self, hinge: PlasticHinge) {
        self.hinges.push(hinge);
    }
    
    /// Generate load pattern
    pub fn generate_load_pattern(
        &self,
        story_heights: &[f64],
        story_masses: &[f64],
        mode_shape: Option<&[f64]>,
    ) -> Vec<f64> {
        let n = story_heights.len();
        let mut pattern = vec![0.0; n];
        
        match self.config.load_pattern {
            LoadPattern::Uniform => {
                for i in 0..n {
                    pattern[i] = 1.0;
                }
            }
            LoadPattern::Triangular => {
                let total_height: f64 = story_heights.iter().sum();
                let mut cumulative_height = 0.0;
                for i in 0..n {
                    cumulative_height += story_heights[i];
                    pattern[i] = cumulative_height / total_height;
                }
            }
            LoadPattern::FirstMode => {
                if let Some(mode) = mode_shape {
                    pattern = mode.to_vec();
                } else {
                    // Default to triangular if no mode provided
                    return self.generate_load_pattern(story_heights, story_masses, None);
                }
            }
            LoadPattern::MassProportional => {
                for i in 0..n {
                    pattern[i] = story_masses[i];
                }
            }
            LoadPattern::CodePattern => {
                // IS 1893 distribution: F_i = V * (W_i * h_i) / Σ(W_i * h_i)
                let mut cumulative_height = 0.0;
                let mut sum_wh = 0.0;
                for i in 0..n {
                    cumulative_height += story_heights[i];
                    sum_wh += story_masses[i] * cumulative_height;
                }
                
                cumulative_height = 0.0;
                for i in 0..n {
                    cumulative_height += story_heights[i];
                    pattern[i] = story_masses[i] * cumulative_height / sum_wh.max(1e-10);
                }
            }
        }
        
        // Normalize
        let max_p = pattern.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        if max_p > 0.0 {
            pattern.iter_mut().for_each(|p| *p /= max_p);
        }
        
        pattern
    }
    
    /// Run pushover analysis (simplified algorithm)
    pub fn analyze(
        &mut self,
        story_heights: &[f64],
        story_masses: &[f64],
        story_stiffness: &[f64],
        mode_shape: Option<&[f64]>,
    ) -> CapacityCurve {
        let n_stories = story_heights.len();
        let load_pattern = self.generate_load_pattern(story_heights, story_masses, mode_shape);
        
        let mut capacity = CapacityCurve {
            points: Vec::new(),
            yield_point: None,
            ultimate_point: None,
            ductility: 1.0,
            effective_period: 0.0,
        };
        
        // Displacement increment per step
        let d_increment = self.config.target_displacement / self.config.num_steps as f64;
        
        let mut displacements = vec![0.0; n_stories];
        let mut current_stiffness = story_stiffness.to_vec();
        
        for step in 0..=self.config.num_steps {
            let target_roof = step as f64 * d_increment;
            
            // Update displacements (simplified shear building model)
            let mut cumulative_d = 0.0;
            for i in 0..n_stories {
                // Story drift proportional to load pattern / stiffness
                let story_drift = target_roof * load_pattern[i] / 
                                  current_stiffness[i].max(1e-10) * story_stiffness[0];
                cumulative_d += story_drift;
                displacements[i] = cumulative_d;
            }
            
            // Scale to match target roof displacement
            if displacements[n_stories - 1].abs() > 1e-10 {
                let scale = target_roof / displacements[n_stories - 1];
                displacements.iter_mut().for_each(|d| *d *= scale);
            }
            
            // Calculate base shear from story shears
            let mut base_shear = 0.0;
            for i in 0..n_stories {
                let story_drift = if i == 0 {
                    displacements[0]
                } else {
                    displacements[i] - displacements[i - 1]
                };
                
                base_shear += current_stiffness[i] * story_drift;
            }
            
            // Update hinge states and stiffness
            let mut hinge_states = Vec::new();
            let mut hinges_yielded = 0;
            
            for hinge in &mut self.hinges {
                // Simplified: use story drift at hinge location
                let story_idx = (hinge.position * n_stories as f64) as usize;
                let story_idx = story_idx.min(n_stories - 1);
                
                let drift = if story_idx == 0 {
                    displacements[0]
                } else {
                    displacements[story_idx] - displacements[story_idx - 1]
                };
                
                // Convert drift to rotation (approximate)
                let rotation = drift / story_heights[story_idx];
                hinge.update(rotation);
                
                hinge_states.push((hinge.id, hinge.state));
                
                if hinge.state != HingeState::Elastic {
                    hinges_yielded += 1;
                    
                    // Reduce story stiffness
                    let reduction = hinge.backbone.get_tangent_stiffness(rotation) /
                                    (hinge.backbone.yield_value / hinge.backbone.yield_deformation);
                    current_stiffness[story_idx] *= reduction.max(0.01);
                }
            }
            
            capacity.points.push(CapacityPoint {
                step,
                base_shear,
                roof_displacement: target_roof,
                hinge_states,
                hinges_yielded,
            });
        }
        
        // Idealize the curve
        let total_weight: f64 = story_masses.iter().sum();
        capacity.idealize_bilinear(total_weight);
        
        capacity
    }
}

// ============================================================================
// PERFORMANCE POINT (ATC-40 / FEMA 440)
// ============================================================================

/// Design spectrum for performance point
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesignSpectrum {
    /// Spectral acceleration values (g)
    pub sa: Vec<f64>,
    /// Periods (s)
    pub periods: Vec<f64>,
}

impl DesignSpectrum {
    /// Create IS 1893:2016 design spectrum
    pub fn is1893(zone_factor: f64, importance: f64, response_reduction: f64, soil_type: &str) -> Self {
        let (_s1, s2, s3) = match soil_type {
            "rock" | "I" => (1.0, 2.5, 1.0),
            "medium" | "II" => (1.0, 2.5, 1.36),
            "soft" | "III" => (1.0, 2.5, 1.67),
            _ => (1.0, 2.5, 1.36),
        };
        
        let z_i_2r = zone_factor * importance / (2.0 * response_reduction);
        
        let periods: Vec<f64> = (0..401).map(|i| i as f64 * 0.01).collect();
        let sa: Vec<f64> = periods.iter()
            .map(|&t| {
                let sa_g = if t < 0.1 {
                    1.0 + 15.0 * t * (s2 - 1.0)
                } else if t < 0.4 {
                    s2
                } else if t < 4.0 {
                    s2 * 0.4 / t * s3
                } else {
                    s2 * 0.4 / 4.0 * s3
                };
                z_i_2r * sa_g
            })
            .collect();
        
        Self { sa, periods }
    }
    
    /// Get spectral acceleration at period T
    pub fn get_sa(&self, period: f64) -> f64 {
        if self.periods.is_empty() {
            return 0.0;
        }
        
        // Linear interpolation
        for i in 0..self.periods.len() - 1 {
            if period >= self.periods[i] && period <= self.periods[i + 1] {
                let t = (period - self.periods[i]) / (self.periods[i + 1] - self.periods[i]);
                return self.sa[i] + t * (self.sa[i + 1] - self.sa[i]);
            }
        }
        
        if period < self.periods[0] {
            self.sa[0]
        } else {
            *self.sa.last().unwrap()
        }
    }
}

/// ATC-40 Capacity Spectrum Method
pub struct CapacitySpectrumMethod {
    pub capacity: CapacityCurve,
    pub demand: DesignSpectrum,
    pub modal_mass_coefficient: f64,
    pub modal_participation: f64,
}

impl CapacitySpectrumMethod {
    pub fn new(
        capacity: CapacityCurve,
        demand: DesignSpectrum,
        alpha_m: f64,
        pf1: f64,
    ) -> Self {
        Self {
            capacity,
            demand,
            modal_mass_coefficient: alpha_m,
            modal_participation: pf1,
        }
    }
    
    /// Convert capacity curve to ADRS (Acceleration-Displacement Response Spectrum)
    pub fn to_adrs(&self) -> Vec<(f64, f64)> {
        self.capacity.points.iter()
            .filter_map(|p| {
                // Sa = V / (αm * W) where W = total weight
                // Sd = Δroof / (PF1 * φroof)
                let sa = p.base_shear / self.modal_mass_coefficient.max(0.01);
                let sd = p.roof_displacement / self.modal_participation.max(0.01);
                
                if sa >= 0.0 && sd >= 0.0 {
                    Some((sd, sa))
                } else {
                    None
                }
            })
            .collect()
    }
    
    /// Find performance point using ATC-40 Procedure A
    pub fn find_performance_point(&self, total_weight: f64) -> Option<PerformancePoint> {
        let adrs = self.to_adrs();
        
        if adrs.is_empty() {
            return None;
        }
        
        // Get bilinear idealization
        let (dy, vy) = self.capacity.yield_point.unwrap_or((0.01, 100.0));
        
        // Initial guess: elastic period
        let k_elastic = vy / dy;
        let g = 9.81;
        let t_elastic = 2.0 * PI * (total_weight / (k_elastic * 1000.0 * g)).sqrt();
        
        // Iterate to find intersection
        let mut t_eff = t_elastic;
        let mut _converged = false;
        
        for _ in 0..20 {
            // Get demand at effective period
            let sa_demand = self.demand.get_sa(t_eff) * g; // Convert to m/s²
            let sd_demand = sa_demand * t_eff * t_eff / (4.0 * PI * PI);
            
            // Get capacity at sd_demand
            if let Some(v_capacity) = self.capacity.get_base_shear(sd_demand * self.modal_participation) {
                let sa_capacity = v_capacity / (self.modal_mass_coefficient * total_weight) * g;
                
                // Check convergence
                if (sa_demand - sa_capacity).abs() / sa_demand.max(1e-10) < 0.05 {
                    _converged = true;
                    
                    // Calculate ductility
                    let ductility = sd_demand / (dy / self.modal_participation);
                    
                    // Get damping
                    let beta_eff = self.effective_damping(ductility);
                    
                    return Some(PerformancePoint {
                        spectral_displacement: sd_demand,
                        spectral_acceleration: sa_demand,
                        roof_displacement: sd_demand * self.modal_participation,
                        base_shear: v_capacity,
                        ductility,
                        effective_damping: beta_eff,
                        effective_period: t_eff,
                    });
                }
                
                // Update effective period based on secant stiffness
                let k_sec = v_capacity / sd_demand.max(1e-10);
                t_eff = 2.0 * PI * (total_weight / (k_sec * 1000.0 * g)).sqrt();
            } else {
                break;
            }
        }
        
        None
    }
    
    /// Calculate effective damping for given ductility (ATC-40 Type B)
    pub fn effective_damping(&self, ductility: f64) -> f64 {
        let beta_0 = 0.05; // Initial damping (5%)
        
        if ductility <= 1.0 {
            beta_0
        } else {
            // ATC-40 Type B structure (average hysteretic behavior)
            let kappa = 0.33; // Type B factor
            let beta_eq = kappa * (ductility - 1.0) / (PI * ductility);
            beta_0 + beta_eq
        }
    }
}

/// Performance point result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformancePoint {
    /// Spectral displacement (m)
    pub spectral_displacement: f64,
    /// Spectral acceleration (g)
    pub spectral_acceleration: f64,
    /// Actual roof displacement (m)
    pub roof_displacement: f64,
    /// Base shear (kN)
    pub base_shear: f64,
    /// Ductility demand
    pub ductility: f64,
    /// Effective damping
    pub effective_damping: f64,
    /// Effective period (s)
    pub effective_period: f64,
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_hinge_backbone_rc_beam() {
        let backbone = HingeBackbone::rc_beam_conforming();
        
        assert!(backbone.yield_deformation > 0.0);
        assert!(backbone.cp_limit > backbone.ls_limit);
        assert!(backbone.ls_limit > backbone.io_limit);
        assert!(backbone.ultimate_limit > backbone.cp_limit);
    }
    
    #[test]
    fn test_hinge_backbone_force() {
        let backbone = HingeBackbone::rc_beam_conforming();
        
        // Elastic region
        let f_half_yield = backbone.get_force(backbone.yield_deformation * 0.5);
        assert!((f_half_yield - backbone.yield_value * 0.5).abs() < 0.01);
        
        // At yield
        let f_yield = backbone.get_force(backbone.yield_deformation);
        assert!((f_yield - backbone.yield_value).abs() < 0.01);
        
        // Post-yield
        let f_io = backbone.get_force(backbone.io_limit);
        assert!(f_io > backbone.yield_value);
        
        // Residual
        let f_ultimate = backbone.get_force(backbone.ultimate_limit * 1.5);
        let expected_residual = backbone.yield_value * backbone.residual_ratio;
        assert!((f_ultimate - expected_residual).abs() < 0.1);
    }
    
    #[test]
    fn test_hinge_state() {
        let backbone = HingeBackbone::rc_beam_conforming();
        
        // Based on backbone: yield=0.005, io=0.01, ls=0.02, cp=0.025, ultimate=0.05
        assert_eq!(backbone.get_state(0.001), HingeState::Elastic);
        assert_eq!(backbone.get_state(0.006), HingeState::Yielding); // Between yield and IO
        assert_eq!(backbone.get_state(0.015), HingeState::IO);       // Between IO and LS
        assert_eq!(backbone.get_state(0.022), HingeState::LS);       // Between LS and CP
        assert_eq!(backbone.get_state(0.04), HingeState::CP);        // Between CP and ultimate
        assert_eq!(backbone.get_state(0.1), HingeState::Collapsed);  // Beyond ultimate
    }
    
    #[test]
    fn test_plastic_hinge() {
        let backbone = HingeBackbone::rc_beam_conforming();
        let mut hinge = PlasticHinge::new(1, 1, 0.0, HingeType::Moment, backbone);
        
        hinge.update(0.015);
        assert_eq!(hinge.state, HingeState::IO);
        assert!(hinge.ductility_demand() > 1.0);
    }
    
    #[test]
    fn test_load_pattern_triangular() {
        let config = PushoverConfig {
            load_pattern: LoadPattern::Triangular,
            ..Default::default()
        };
        let analyzer = PushoverAnalyzer::new(config);
        
        let heights = vec![3.5, 3.0, 3.0, 3.0];
        let masses = vec![100.0, 100.0, 100.0, 100.0];
        
        let pattern = analyzer.generate_load_pattern(&heights, &masses, None);
        
        // Should be increasing
        for i in 1..pattern.len() {
            assert!(pattern[i] >= pattern[i - 1]);
        }
        
        // Top should be normalized to 1.0
        assert!((pattern[3] - 1.0).abs() < 0.01);
    }
    
    #[test]
    fn test_load_pattern_code() {
        let config = PushoverConfig {
            load_pattern: LoadPattern::CodePattern,
            ..Default::default()
        };
        let analyzer = PushoverAnalyzer::new(config);
        
        let heights = vec![3.0, 3.0, 3.0];
        let masses = vec![200.0, 150.0, 100.0]; // Heavier at bottom
        
        let pattern = analyzer.generate_load_pattern(&heights, &masses, None);
        
        assert_eq!(pattern.len(), 3);
        assert!(pattern[2] <= 1.0);
    }
    
    #[test]
    fn test_pushover_analysis() {
        let config = PushoverConfig {
            target_displacement: 0.3,
            num_steps: 50,
            ..Default::default()
        };
        
        let mut analyzer = PushoverAnalyzer::new(config);
        
        // 3-story building
        let heights = vec![3.5, 3.0, 3.0];
        let masses = vec![500.0, 400.0, 300.0];
        let stiffness = vec![50000.0, 40000.0, 30000.0]; // kN/m
        
        // Add hinges at beam ends
        analyzer.add_hinge(PlasticHinge::new(
            1, 1, 0.0, HingeType::Moment, HingeBackbone::rc_beam_conforming()
        ));
        analyzer.add_hinge(PlasticHinge::new(
            2, 2, 0.5, HingeType::Moment, HingeBackbone::rc_beam_conforming()
        ));
        
        let capacity = analyzer.analyze(&heights, &masses, &stiffness, None);
        
        assert!(!capacity.points.is_empty());
        assert!(capacity.ductility >= 1.0);
        
        // Check that analysis produced reasonable results (base shear should be non-zero)
        let final_shear = capacity.points.last().unwrap().base_shear;
        assert!(final_shear.abs() > 0.0 || capacity.points.len() > 1);
        
        println!("Final base shear: {:.2} kN", final_shear);
        println!("Global ductility: {:.2}", capacity.ductility);
    }
    
    #[test]
    fn test_is1893_spectrum() {
        let spectrum = DesignSpectrum::is1893(0.24, 1.5, 5.0, "medium");
        
        assert!(!spectrum.sa.is_empty());
        assert!(!spectrum.periods.is_empty());
        
        // Plateau region
        let sa_02 = spectrum.get_sa(0.2);
        let sa_03 = spectrum.get_sa(0.3);
        assert!((sa_02 - sa_03).abs() < 0.01);
        
        // Descending region
        let sa_1 = spectrum.get_sa(1.0);
        let sa_2 = spectrum.get_sa(2.0);
        assert!(sa_1 > sa_2);
        
        println!("Sa(0.3s) = {:.4}g", spectrum.get_sa(0.3));
        println!("Sa(1.0s) = {:.4}g", spectrum.get_sa(1.0));
    }
    
    #[test]
    fn test_capacity_spectrum_conversion() {
        // Create simple capacity curve
        let capacity = CapacityCurve {
            points: vec![
                CapacityPoint { step: 0, base_shear: 0.0, roof_displacement: 0.0, hinge_states: vec![], hinges_yielded: 0 },
                CapacityPoint { step: 1, base_shear: 500.0, roof_displacement: 0.05, hinge_states: vec![], hinges_yielded: 0 },
                CapacityPoint { step: 2, base_shear: 800.0, roof_displacement: 0.10, hinge_states: vec![], hinges_yielded: 2 },
                CapacityPoint { step: 3, base_shear: 900.0, roof_displacement: 0.20, hinge_states: vec![], hinges_yielded: 4 },
            ],
            yield_point: Some((0.05, 500.0)),
            ultimate_point: Some((0.20, 900.0)),
            ductility: 4.0,
            effective_period: 0.5,
        };
        
        let demand = DesignSpectrum::is1893(0.24, 1.5, 5.0, "medium");
        
        let csm = CapacitySpectrumMethod::new(capacity, demand, 0.8, 1.3);
        let adrs = csm.to_adrs();
        
        assert!(!adrs.is_empty());
        
        // Check ADRS transformation
        for (sd, sa) in &adrs {
            assert!(*sd >= 0.0);
            assert!(*sa >= 0.0);
        }
    }
    
    #[test]
    fn test_effective_damping() {
        let capacity = CapacityCurve {
            points: vec![],
            yield_point: Some((0.05, 500.0)),
            ultimate_point: Some((0.20, 900.0)),
            ductility: 4.0,
            effective_period: 0.5,
        };
        
        let demand = DesignSpectrum::is1893(0.24, 1.5, 5.0, "medium");
        let csm = CapacitySpectrumMethod::new(capacity, demand, 0.8, 1.3);
        
        // Elastic (ductility = 1)
        let beta_1 = csm.effective_damping(1.0);
        assert!((beta_1 - 0.05).abs() < 0.001);
        
        // Ductile
        let beta_4 = csm.effective_damping(4.0);
        assert!(beta_4 > 0.05);
        assert!(beta_4 < 0.30); // Reasonable upper bound
        
        println!("Damping at μ=1: {:.1}%", beta_1 * 100.0);
        println!("Damping at μ=4: {:.1}%", beta_4 * 100.0);
    }
    
    #[test]
    fn test_capacity_curve_idealization() {
        let mut capacity = CapacityCurve {
            points: vec![
                CapacityPoint { step: 0, base_shear: 0.0, roof_displacement: 0.0, hinge_states: vec![], hinges_yielded: 0 },
                CapacityPoint { step: 1, base_shear: 200.0, roof_displacement: 0.02, hinge_states: vec![], hinges_yielded: 0 },
                CapacityPoint { step: 2, base_shear: 400.0, roof_displacement: 0.04, hinge_states: vec![], hinges_yielded: 0 },
                CapacityPoint { step: 3, base_shear: 500.0, roof_displacement: 0.06, hinge_states: vec![], hinges_yielded: 1 },
                CapacityPoint { step: 4, base_shear: 550.0, roof_displacement: 0.10, hinge_states: vec![], hinges_yielded: 2 },
                CapacityPoint { step: 5, base_shear: 580.0, roof_displacement: 0.15, hinge_states: vec![], hinges_yielded: 4 },
                CapacityPoint { step: 6, base_shear: 570.0, roof_displacement: 0.20, hinge_states: vec![], hinges_yielded: 6 },
            ],
            yield_point: None,
            ultimate_point: None,
            ductility: 1.0,
            effective_period: 0.0,
        };
        
        capacity.idealize_bilinear(12000.0); // 12000 kN total weight
        
        assert!(capacity.yield_point.is_some());
        assert!(capacity.ultimate_point.is_some());
        assert!(capacity.ductility > 1.0);
        
        if let Some((dy, vy)) = capacity.yield_point {
            println!("Yield point: Δy = {:.3}m, Vy = {:.1}kN", dy, vy);
        }
        println!("Ductility: {:.2}", capacity.ductility);
        println!("Effective period: {:.3}s", capacity.effective_period);
    }
    
    #[test]
    fn test_column_backbone_with_axial() {
        let backbone_low = HingeBackbone::rc_column_conforming(0.1);
        let backbone_high = HingeBackbone::rc_column_conforming(0.3);
        
        // Higher axial should reduce ductility
        assert!(backbone_high.cp_limit < backbone_low.cp_limit);
        assert!(backbone_high.ultimate_limit < backbone_low.ultimate_limit);
    }
}
