// ============================================================================
// CONSTRUCTION SIMULATION - Phase 22
// 4D BIM, construction sequencing, temporary works analysis
// Standards: OSHA, BS 5975, EN 12812
// ============================================================================

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// CONSTRUCTION PHASES
// ============================================================================

/// Construction activity types
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ActivityType {
    Excavation,
    Foundation,
    Substructure,
    Superstructure,
    SteelErection,
    ConcretePouring,
    Formwork,
    Curing,
    Backfill,
    Waterproofing,
    MEP,
    Finishing,
    Demolition,
}

/// Construction activity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConstructionActivity {
    /// Activity ID
    pub id: String,
    /// Activity name
    pub name: String,
    /// Activity type
    pub activity_type: ActivityType,
    /// Duration (days)
    pub duration: f64,
    /// Start day (from project start)
    pub start_day: f64,
    /// Predecessor activity IDs
    pub predecessors: Vec<String>,
    /// Resource requirements
    pub resources: HashMap<String, f64>,
    /// Associated structural elements
    pub elements: Vec<String>,
    /// Safety criticality (1-5)
    pub safety_rating: u8,
}

impl ConstructionActivity {
    pub fn new(id: &str, name: &str, activity_type: ActivityType, duration: f64) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            activity_type,
            duration,
            start_day: 0.0,
            predecessors: Vec::new(),
            resources: HashMap::new(),
            elements: Vec::new(),
            safety_rating: 3,
        }
    }
    
    /// End day
    pub fn end_day(&self) -> f64 {
        self.start_day + self.duration
    }
    
    /// Add predecessor
    pub fn add_predecessor(&mut self, pred_id: &str) {
        self.predecessors.push(pred_id.to_string());
    }
    
    /// Add resource requirement
    pub fn add_resource(&mut self, resource: &str, quantity: f64) {
        self.resources.insert(resource.to_string(), quantity);
    }
    
    /// Add structural element
    pub fn add_element(&mut self, element_id: &str) {
        self.elements.push(element_id.to_string());
    }
    
    /// Is critical activity?
    pub fn is_critical(&self) -> bool {
        self.safety_rating >= 4 || 
        matches!(self.activity_type, 
            ActivityType::Foundation | 
            ActivityType::SteelErection |
            ActivityType::Demolition)
    }
}

// ============================================================================
// CONSTRUCTION SCHEDULE
// ============================================================================

/// Construction schedule / 4D simulation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConstructionSchedule {
    /// Project name
    pub project_name: String,
    /// Activities
    pub activities: Vec<ConstructionActivity>,
    /// Project start date (string format)
    pub start_date: String,
    /// Working days per week
    pub work_days_per_week: u8,
}

impl ConstructionSchedule {
    pub fn new(project_name: &str, start_date: &str) -> Self {
        Self {
            project_name: project_name.to_string(),
            activities: Vec::new(),
            start_date: start_date.to_string(),
            work_days_per_week: 5,
        }
    }
    
    /// Add activity
    pub fn add_activity(&mut self, activity: ConstructionActivity) {
        self.activities.push(activity);
    }
    
    /// Calculate schedule (CPM forward pass)
    pub fn calculate_schedule(&mut self) {
        // Create activity map for quick lookup
        let mut activity_map: HashMap<String, usize> = HashMap::new();
        for (i, act) in self.activities.iter().enumerate() {
            activity_map.insert(act.id.clone(), i);
        }
        
        // Forward pass - calculate early start times
        let mut changed = true;
        while changed {
            changed = false;
            
            for i in 0..self.activities.len() {
                let mut max_pred_end = 0.0;
                
                for pred_id in &self.activities[i].predecessors.clone() {
                    if let Some(&pred_idx) = activity_map.get(pred_id) {
                        let pred_end = self.activities[pred_idx].end_day();
                        if pred_end > max_pred_end {
                            max_pred_end = pred_end;
                        }
                    }
                }
                
                if max_pred_end > self.activities[i].start_day {
                    self.activities[i].start_day = max_pred_end;
                    changed = true;
                }
            }
        }
    }
    
    /// Project duration (days)
    pub fn project_duration(&self) -> f64 {
        self.activities.iter()
            .map(|a| a.end_day())
            .fold(0.0, f64::max)
    }
    
    /// Get activities at given day
    pub fn activities_at_day(&self, day: f64) -> Vec<&ConstructionActivity> {
        self.activities.iter()
            .filter(|a| a.start_day <= day && day < a.end_day())
            .collect()
    }
    
    /// Get elements visible at given day
    pub fn elements_at_day(&self, day: f64) -> Vec<&str> {
        let mut elements = Vec::new();
        
        for activity in &self.activities {
            if activity.end_day() <= day {
                for elem in &activity.elements {
                    elements.push(elem.as_str());
                }
            }
        }
        
        elements
    }
    
    /// Resource usage at day
    pub fn resource_usage_at_day(&self, day: f64) -> HashMap<String, f64> {
        let mut usage: HashMap<String, f64> = HashMap::new();
        
        for activity in self.activities_at_day(day) {
            for (resource, quantity) in &activity.resources {
                *usage.entry(resource.clone()).or_insert(0.0) += quantity;
            }
        }
        
        usage
    }
    
    /// Peak resource usage
    pub fn peak_resource_usage(&self, resource: &str) -> (f64, f64) {
        let mut peak_day = 0.0;
        let mut peak_value = 0.0;
        
        let duration = self.project_duration();
        let mut day = 0.0;
        
        while day <= duration {
            let usage = self.resource_usage_at_day(day);
            if let Some(&value) = usage.get(resource) {
                if value > peak_value {
                    peak_value = value;
                    peak_day = day;
                }
            }
            day += 1.0;
        }
        
        (peak_day, peak_value)
    }
    
    /// Critical path activities
    pub fn critical_activities(&self) -> Vec<&ConstructionActivity> {
        self.activities.iter()
            .filter(|a| a.is_critical())
            .collect()
    }
}

// ============================================================================
// TEMPORARY WORKS
// ============================================================================

/// Temporary structure types
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum TemporaryStructureType {
    Shoring,
    Scaffolding,
    Formwork,
    FalseWork,
    Cofferdam,
    TrenchSupport,
    CraneFoundation,
    AccessBridge,
    ProtectionDeck,
}

/// Temporary structure load factors
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemporaryLoads {
    /// Dead load (kN/m²)
    pub dead_load: f64,
    /// Live load (kN/m²)
    pub live_load: f64,
    /// Concrete pressure (kN/m²)
    pub concrete_pressure: f64,
    /// Wind load (kN/m²)
    pub wind_load: f64,
    /// Impact factor
    pub impact_factor: f64,
}

impl TemporaryLoads {
    /// Formwork loads
    pub fn formwork_slab(slab_thickness: f64) -> Self {
        let concrete_weight = 25.0 * slab_thickness; // kN/m²
        
        Self {
            dead_load: concrete_weight + 0.5, // Formwork self-weight
            live_load: 2.5, // Workers, equipment
            concrete_pressure: 0.0,
            wind_load: 0.0,
            impact_factor: 1.25,
        }
    }
    
    /// Wall formwork loads
    pub fn formwork_wall(wall_height: f64, pour_rate: f64) -> Self {
        // Concrete pressure per ACI 347
        let r = pour_rate; // m/hr
        let t = 20.0; // Temperature °C
        
        let p_max = (7.2 + 785.0 * r / (t + 17.8)).min(wall_height * 25.0);
        
        Self {
            dead_load: 0.5,
            live_load: 1.5,
            concrete_pressure: p_max,
            wind_load: 0.5,
            impact_factor: 1.2,
        }
    }
    
    /// Scaffolding loads
    pub fn scaffolding(duty_class: u8) -> Self {
        let live_load = match duty_class {
            1 => 0.75, // Inspection
            2 => 1.5,  // Light duty
            3 => 2.0,  // General purpose
            4 => 3.0,  // Heavy duty
            5 => 4.5,  // Masonry
            _ => 2.0,
        };
        
        Self {
            dead_load: 0.3,
            live_load,
            concrete_pressure: 0.0,
            wind_load: 0.6,
            impact_factor: 1.0,
        }
    }
    
    /// Total design load
    pub fn total_design_load(&self) -> f64 {
        (self.dead_load * 1.4 + self.live_load * 1.6 + self.wind_load * 1.0) * self.impact_factor
    }
}

// ============================================================================
// SHORING DESIGN
// ============================================================================

/// Shore post design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShorePost {
    /// Post type
    pub post_type: String,
    /// Unbraced length (m)
    pub length: f64,
    /// Section area (mm²)
    pub area: f64,
    /// Moment of inertia (mm⁴)
    pub moment_of_inertia: f64,
    /// Radius of gyration (mm)
    pub radius_of_gyration: f64,
    /// Yield strength (MPa)
    pub fy: f64,
    /// Elastic modulus (GPa)
    pub e: f64,
}

impl ShorePost {
    /// Standard steel shore post
    pub fn steel_post(diameter: f64, thickness: f64, length: f64) -> Self {
        let r_outer = diameter / 2.0;
        let r_inner = r_outer - thickness;
        
        let area = PI * (r_outer.powi(2) - r_inner.powi(2));
        let i = PI / 4.0 * (r_outer.powi(4) - r_inner.powi(4));
        let r = (i / area).sqrt();
        
        Self {
            post_type: "steel_tube".to_string(),
            length,
            area,
            moment_of_inertia: i,
            radius_of_gyration: r,
            fy: 250.0,
            e: 200.0,
        }
    }
    
    /// Timber shore post
    pub fn timber_post(width: f64, depth: f64, length: f64) -> Self {
        let area = width * depth;
        let i = width * depth.powi(3) / 12.0;
        let r = (i / area).sqrt();
        
        Self {
            post_type: "timber".to_string(),
            length,
            area,
            moment_of_inertia: i,
            radius_of_gyration: r,
            fy: 10.0, // Compression parallel to grain
            e: 10.0,
        }
    }
    
    /// Slenderness ratio
    pub fn slenderness(&self) -> f64 {
        self.length * 1000.0 / self.radius_of_gyration
    }
    
    /// Euler buckling load (kN)
    pub fn euler_load(&self) -> f64 {
        let l = self.length * 1000.0; // mm
        let e = self.e * 1000.0; // MPa
        
        PI.powi(2) * e * self.moment_of_inertia / l.powi(2) / 1000.0
    }
    
    /// Allowable axial load (kN)
    pub fn allowable_load(&self, k: f64, safety_factor: f64) -> f64 {
        let lambda = k * self.slenderness();
        let lambda_c = PI * (self.e * 1000.0 / self.fy).sqrt();
        
        let phi = if lambda <= lambda_c {
            // Inelastic buckling
            1.0 - lambda.powi(2) / (2.0 * lambda_c.powi(2))
        } else {
            // Elastic buckling
            lambda_c.powi(2) / (2.0 * lambda.powi(2))
        };
        
        phi * self.fy * self.area / (1000.0 * safety_factor)
    }
    
    /// Check post capacity
    pub fn check_capacity(&self, applied_load: f64, k: f64, safety_factor: f64) -> bool {
        applied_load <= self.allowable_load(k, safety_factor)
    }
}

use std::f64::consts::PI;

/// Reshoring analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReshoringAnalysis {
    /// Number of levels
    pub n_levels: usize,
    /// Slab thickness (mm)
    pub slab_thickness: f64,
    /// Shore spacing X (m)
    pub spacing_x: f64,
    /// Shore spacing Y (m)
    pub spacing_y: f64,
    /// Floor-to-floor height (m)
    pub floor_height: f64,
    /// Shore stiffness (kN/mm)
    pub shore_stiffness: f64,
    /// Slab stiffness (kN/m per m width)
    pub slab_stiffness: f64,
}

impl ReshoringAnalysis {
    pub fn new(
        n_levels: usize,
        slab_thickness: f64,
        spacing_x: f64, spacing_y: f64,
        floor_height: f64,
    ) -> Self {
        // Estimate stiffnesses
        let shore_stiffness = 50.0; // Typical adjustable shore
        let slab_stiffness = 30.0 * 1000.0 * (slab_thickness / 1000.0).powi(3) / 12.0 * 1e-6;
        
        Self {
            n_levels,
            slab_thickness,
            spacing_x, spacing_y,
            floor_height,
            shore_stiffness,
            slab_stiffness,
        }
    }
    
    /// Tributary area per shore (m²)
    pub fn tributary_area(&self) -> f64 {
        self.spacing_x * self.spacing_y
    }
    
    /// Fresh concrete load (kN)
    pub fn fresh_concrete_load(&self) -> f64 {
        25.0 * self.slab_thickness / 1000.0 * self.tributary_area()
    }
    
    /// Shore load distribution factor for level
    pub fn load_factor(&self, level: usize) -> f64 {
        // Simplified Grundy-Kabaila method
        let total_levels = self.n_levels as f64;
        let current = (level + 1) as f64;
        
        current / (total_levels * (total_levels + 1.0) / 2.0)
    }
    
    /// Shore load at level (kN)
    pub fn shore_load_at_level(&self, level: usize) -> f64 {
        self.fresh_concrete_load() * self.load_factor(level)
    }
    
    /// Maximum shore load (kN)
    pub fn max_shore_load(&self) -> f64 {
        (0..self.n_levels)
            .map(|l| self.shore_load_at_level(l))
            .fold(0.0, f64::max)
    }
    
    /// Slab load at level (kN/m²)
    pub fn slab_load_at_level(&self, level: usize) -> f64 {
        let concrete_weight = 25.0 * self.slab_thickness / 1000.0;
        concrete_weight * (1.0 + self.load_factor(level))
    }
    
    /// Minimum stripping time (days) for given strength ratio
    pub fn stripping_time(&self, required_strength_ratio: f64, strength_gain_rate: f64) -> f64 {
        // Days to achieve required_strength_ratio of 28-day strength
        // Using simplified strength gain: f(t) = f28 * t / (a + bt)
        let a = 4.0;
        let b = 0.85;
        
        a * required_strength_ratio / (1.0 - b * required_strength_ratio) / strength_gain_rate
    }
}

// ============================================================================
// CRANE OPERATIONS
// ============================================================================

/// Crane lift analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CraneLift {
    /// Crane capacity at radius (tonnes)
    pub crane_capacity: f64,
    /// Lift weight (tonnes)
    pub lift_weight: f64,
    /// Rigging weight (tonnes)
    pub rigging_weight: f64,
    /// Operating radius (m)
    pub radius: f64,
    /// Boom length (m)
    pub boom_length: f64,
    /// Wind speed limit (m/s)
    pub wind_limit: f64,
}

impl CraneLift {
    pub fn new(crane_capacity: f64, lift_weight: f64, radius: f64) -> Self {
        Self {
            crane_capacity,
            lift_weight,
            rigging_weight: lift_weight * 0.05, // 5% estimate
            radius,
            boom_length: radius * 1.1,
            wind_limit: 12.0,
        }
    }
    
    /// Total lift load (tonnes)
    pub fn total_load(&self) -> f64 {
        self.lift_weight + self.rigging_weight
    }
    
    /// Capacity utilization (%)
    pub fn utilization(&self) -> f64 {
        self.total_load() / self.crane_capacity * 100.0
    }
    
    /// Is lift within capacity?
    pub fn is_safe(&self) -> bool {
        self.utilization() <= 85.0 // 85% max typical
    }
    
    /// Dynamic factor for lift
    pub fn dynamic_factor(&self, lift_speed: f64) -> f64 {
        1.0 + 0.1 * lift_speed // Simplified
    }
    
    /// Required crane capacity with factors
    pub fn required_capacity(&self, lift_speed: f64) -> f64 {
        self.total_load() * self.dynamic_factor(lift_speed) / 0.85
    }
    
    /// Ground bearing pressure under outrigger (kPa)
    pub fn outrigger_pressure(&self, crane_weight: f64, pad_area: f64) -> f64 {
        // Simplified - worst case outrigger
        let total = (crane_weight + self.total_load()) * 9.81; // kN
        let reaction = total * 0.7; // 70% on one outrigger
        
        reaction / pad_area
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_construction_activity() {
        let mut act = ConstructionActivity::new(
            "ACT001", "Foundation Excavation",
            ActivityType::Excavation, 10.0
        );
        
        act.start_day = 5.0;
        assert_eq!(act.end_day(), 15.0);
    }

    #[test]
    fn test_schedule_calculation() {
        let mut schedule = ConstructionSchedule::new("Test Project", "2024-01-01");
        
        let mut act1 = ConstructionActivity::new("A1", "Excavation", ActivityType::Excavation, 5.0);
        let mut act2 = ConstructionActivity::new("A2", "Foundation", ActivityType::Foundation, 10.0);
        act2.add_predecessor("A1");
        
        schedule.add_activity(act1);
        schedule.add_activity(act2);
        schedule.calculate_schedule();
        
        assert_eq!(schedule.project_duration(), 15.0);
    }

    #[test]
    fn test_formwork_loads() {
        let loads = TemporaryLoads::formwork_slab(0.2);
        
        assert!(loads.dead_load > 5.0);
        assert!(loads.live_load > 0.0);
    }

    #[test]
    fn test_wall_formwork() {
        let loads = TemporaryLoads::formwork_wall(4.0, 1.0);
        
        assert!(loads.concrete_pressure > 20.0);
        assert!(loads.concrete_pressure < 100.0);
    }

    #[test]
    fn test_shore_post() {
        let post = ShorePost::steel_post(89.0, 4.0, 3.0);
        
        let slenderness = post.slenderness();
        assert!(slenderness > 50.0);
        
        let euler = post.euler_load();
        assert!(euler > 50.0);
    }

    #[test]
    fn test_shore_capacity() {
        let post = ShorePost::steel_post(100.0, 5.0, 3.0);
        
        let allowable = post.allowable_load(1.0, 2.0);
        assert!(allowable > 20.0);
        
        assert!(post.check_capacity(allowable * 0.9, 1.0, 2.0));
        assert!(!post.check_capacity(allowable * 1.1, 1.0, 2.0));
    }

    #[test]
    fn test_reshoring() {
        let reshore = ReshoringAnalysis::new(3, 200.0, 1.5, 1.5, 3.0);
        
        let max_load = reshore.max_shore_load();
        assert!(max_load > 5.0);
        
        let strip_time = reshore.stripping_time(0.7, 1.0);
        assert!(strip_time > 3.0);
    }

    #[test]
    fn test_crane_lift() {
        let lift = CraneLift::new(50.0, 10.0, 20.0);
        
        let util = lift.utilization();
        assert!(util < 30.0);
        assert!(lift.is_safe());
    }

    #[test]
    fn test_crane_capacity() {
        let lift = CraneLift::new(20.0, 18.0, 25.0);
        
        let required = lift.required_capacity(0.5);
        assert!(required > lift.total_load());
        
        assert!(!lift.is_safe()); // Over 85%
    }

    #[test]
    fn test_scaffolding_loads() {
        let light = TemporaryLoads::scaffolding(2);
        let heavy = TemporaryLoads::scaffolding(4);
        
        assert!(heavy.live_load > light.live_load);
    }
}
