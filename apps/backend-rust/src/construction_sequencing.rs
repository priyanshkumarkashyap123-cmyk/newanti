//! Construction Sequencing and Temporary Works Analysis
//! 
//! Comprehensive construction engineering module for:
//! - Construction sequence optimization
//! - Temporary works design
//! - Stage-by-stage structural analysis
//! - Load path verification during construction
//! 
//! Standards: BS 5975, ASCE 37, Eurocode 1991-1-6

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Construction stage definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConstructionStage {
    /// Stage identifier
    pub id: String,
    /// Stage description
    pub description: String,
    /// Duration in days
    pub duration_days: f64,
    /// Elements added in this stage
    pub elements_added: Vec<String>,
    /// Elements removed in this stage
    pub elements_removed: Vec<String>,
    /// Loads applied in this stage
    pub loads_applied: Vec<ConstructionLoad>,
    /// Prerequisites (stage IDs)
    pub prerequisites: Vec<String>,
    /// Concrete age considerations
    pub concrete_age: Option<ConcreteAgeEffect>,
}

/// Construction load types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConstructionLoadType {
    /// Self-weight of new elements
    SelfWeight,
    /// Formwork and falsework
    Formwork,
    /// Construction equipment
    Equipment,
    /// Material storage
    MaterialStorage,
    /// Personnel
    Personnel,
    /// Concrete placement
    ConcretePlacement,
    /// Post-tensioning
    PostTensioning,
    /// Temporary bracing
    TemporaryBracing,
}

/// Construction load
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConstructionLoad {
    /// Load type
    pub load_type: ConstructionLoadType,
    /// Load magnitude (kN or kN/m²)
    pub magnitude: f64,
    /// Load location
    pub location: LoadLocation,
    /// Duration category
    pub duration: LoadDuration,
}

/// Load location
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LoadLocation {
    /// Point load at coordinates
    Point { x: f64, y: f64, z: f64 },
    /// Distributed over area
    Area { x1: f64, y1: f64, x2: f64, y2: f64, z: f64 },
    /// Along member
    Member { member_id: String },
}

/// Load duration category per BS 5975
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LoadDuration {
    /// Very short (< 1 day)
    VeryShort,
    /// Short (1-7 days)
    Short,
    /// Medium (7-30 days)
    Medium,
    /// Long (> 30 days)
    Long,
}

/// Concrete age effect on properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConcreteAgeEffect {
    /// Concrete age in days
    pub age_days: f64,
    /// Strength development factor (0-1)
    pub strength_factor: f64,
    /// Modulus development factor (0-1)
    pub modulus_factor: f64,
    /// Creep coefficient at this age
    pub creep_coefficient: f64,
    /// Shrinkage strain at this age
    pub shrinkage_strain: f64,
}

impl ConcreteAgeEffect {
    /// Calculate strength development per EC2
    /// f_cm(t) = β_cc(t) * f_cm
    pub fn strength_development_ec2(age_days: f64, cement_type: CementType) -> f64 {
        let s = match cement_type {
            CementType::SlowHardening => 0.38,
            CementType::Normal => 0.25,
            CementType::RapidHardening => 0.20,
        };
        
        let beta_cc = (s * (1.0 - (28.0 / age_days).sqrt())).exp();
        beta_cc.min(1.0)
    }
    
    /// Calculate modulus development per EC2
    /// E_cm(t) = (f_cm(t) / f_cm)^0.3 * E_cm
    pub fn modulus_development_ec2(strength_factor: f64) -> f64 {
        strength_factor.powf(0.3)
    }
    
    /// Calculate creep coefficient per EC2
    pub fn creep_coefficient_ec2(
        t: f64,           // Current time (days)
        t0: f64,          // Loading age (days)
        h0: f64,          // Notional size (mm)
        rh: f64,          // Relative humidity (%)
        fcm: f64,         // Mean compressive strength (MPa)
        cement_type: CementType,
    ) -> f64 {
        // φ(t,t0) = φ_0 * β_c(t,t0)
        
        // Notional creep coefficient φ_0
        let phi_rh = if fcm <= 35.0 {
            1.0 + (1.0 - rh / 100.0) / (0.1 * h0.powf(1.0/3.0))
        } else {
            (1.0 + (1.0 - rh / 100.0) / (0.1 * h0.powf(1.0/3.0)) * (35.0 / fcm).powf(0.7)) *
            (35.0 / fcm).powf(0.2)
        };
        
        let beta_fcm = 16.8 / fcm.sqrt();
        
        let alpha: f64 = match cement_type {
            CementType::SlowHardening => -1.0,
            CementType::Normal => 0.0,
            CementType::RapidHardening => 1.0,
        };
        let beta_t0 = 1.0 / (0.1 + t0.powf(0.2 + 0.1 * alpha.abs()));
        
        let phi_0 = phi_rh * beta_fcm * beta_t0;
        
        // Development coefficient β_c(t,t0)
        let beta_h = 1.5 * h0 * (1.0 + (0.012 * rh).powi(18)).min(1500.0);
        let beta_c = ((t - t0) / (beta_h + t - t0)).powf(0.3);
        
        phi_0 * beta_c
    }
}

/// Cement type for concrete development
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum CementType {
    SlowHardening,
    Normal,
    RapidHardening,
}

/// Construction sequence analyzer
#[derive(Debug, Clone)]
pub struct ConstructionSequenceAnalyzer {
    /// All construction stages
    pub stages: Vec<ConstructionStage>,
    /// Stage analysis results
    pub stage_results: HashMap<String, StageAnalysisResult>,
    /// Critical path
    pub critical_path: Vec<String>,
}

/// Stage analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StageAnalysisResult {
    /// Stage ID
    pub stage_id: String,
    /// Maximum deflection (mm)
    pub max_deflection: f64,
    /// Maximum stress ratio
    pub max_stress_ratio: f64,
    /// Stability status
    pub is_stable: bool,
    /// Critical members
    pub critical_members: Vec<CriticalMember>,
    /// Cumulative time (days)
    pub cumulative_time: f64,
}

/// Critical member information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CriticalMember {
    /// Member ID
    pub member_id: String,
    /// Utilization ratio
    pub utilization: f64,
    /// Governing condition
    pub governing_condition: String,
}

impl ConstructionSequenceAnalyzer {
    /// Create new analyzer
    pub fn new() -> Self {
        Self {
            stages: Vec::new(),
            stage_results: HashMap::new(),
            critical_path: Vec::new(),
        }
    }
    
    /// Add construction stage
    pub fn add_stage(&mut self, stage: ConstructionStage) {
        self.stages.push(stage);
    }
    
    /// Analyze construction sequence
    pub fn analyze_sequence(&mut self) -> SequenceAnalysisResult {
        // Sort stages by prerequisites (topological sort)
        let ordered_stages = self.topological_sort();
        
        let mut cumulative_time: f64 = 0.0;
        let mut max_deflection: f64 = 0.0;
        let mut max_utilization: f64 = 0.0;
        let mut all_stable = true;
        
        for stage_id in &ordered_stages {
            if let Some(stage) = self.stages.iter().find(|s| &s.id == stage_id) {
                cumulative_time += stage.duration_days;
                
                // Simplified stage analysis (actual implementation would use FEM)
                let result = self.analyze_stage(stage, cumulative_time);
                
                max_deflection = max_deflection.max(result.max_deflection);
                max_utilization = max_utilization.max(result.max_stress_ratio);
                all_stable = all_stable && result.is_stable;
                
                self.stage_results.insert(stage_id.clone(), result);
            }
        }
        
        // Calculate critical path
        self.calculate_critical_path();
        
        SequenceAnalysisResult {
            total_duration: cumulative_time,
            max_deflection,
            max_utilization,
            is_feasible: all_stable && max_utilization <= 1.0,
            critical_stage: self.find_critical_stage(),
            stage_count: self.stages.len(),
        }
    }
    
    /// Topological sort of stages
    fn topological_sort(&self) -> Vec<String> {
        let mut result = Vec::new();
        let mut visited = HashMap::new();
        
        for stage in &self.stages {
            visited.insert(stage.id.clone(), false);
        }
        
        for stage in &self.stages {
            if !visited[&stage.id] {
                self.dfs_sort(&stage.id, &mut visited, &mut result);
            }
        }
        
        result
    }
    
    fn dfs_sort(&self, stage_id: &str, visited: &mut HashMap<String, bool>, result: &mut Vec<String>) {
        visited.insert(stage_id.to_string(), true);
        
        if let Some(stage) = self.stages.iter().find(|s| s.id == stage_id) {
            for prereq in &stage.prerequisites {
                if !visited.get(prereq).unwrap_or(&true) {
                    self.dfs_sort(prereq, visited, result);
                }
            }
        }
        
        result.push(stage_id.to_string());
    }
    
    /// Analyze single stage
    fn analyze_stage(&self, stage: &ConstructionStage, cumulative_time: f64) -> StageAnalysisResult {
        // Simplified analysis - actual implementation would use FEM
        let total_load: f64 = stage.loads_applied.iter().map(|l| l.magnitude).sum();
        
        // Estimate deflection based on load (simplified)
        let deflection = total_load * 0.1; // mm per kN (simplified)
        
        // Estimate stress ratio
        let stress_ratio = total_load / 1000.0; // Simplified
        
        // Apply concrete age effect if applicable
        let age_factor = stage.concrete_age
            .as_ref()
            .map(|c| c.strength_factor)
            .unwrap_or(1.0);
        
        let adjusted_stress_ratio = stress_ratio / age_factor;
        
        StageAnalysisResult {
            stage_id: stage.id.clone(),
            max_deflection: deflection,
            max_stress_ratio: adjusted_stress_ratio.min(0.95),
            is_stable: adjusted_stress_ratio < 1.0,
            critical_members: Vec::new(),
            cumulative_time,
        }
    }
    
    /// Calculate critical path
    fn calculate_critical_path(&mut self) {
        // Simple critical path: longest duration path
        self.critical_path = self.stages.iter().map(|s| s.id.clone()).collect();
    }
    
    /// Find most critical stage
    fn find_critical_stage(&self) -> Option<String> {
        self.stage_results.iter()
            .max_by(|a, b| a.1.max_stress_ratio.partial_cmp(&b.1.max_stress_ratio).unwrap_or(std::cmp::Ordering::Equal))
            .map(|(id, _)| id.clone())
    }
}

/// Sequence analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SequenceAnalysisResult {
    /// Total construction duration (days)
    pub total_duration: f64,
    /// Maximum deflection across all stages (mm)
    pub max_deflection: f64,
    /// Maximum utilization ratio
    pub max_utilization: f64,
    /// Is sequence feasible
    pub is_feasible: bool,
    /// Most critical stage
    pub critical_stage: Option<String>,
    /// Number of stages
    pub stage_count: usize,
}

/// Temporary works designer
#[derive(Debug, Clone)]
pub struct TemporaryWorksDesigner {
    /// Design standard
    pub standard: TemporaryWorksStandard,
}

/// Temporary works design standard
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum TemporaryWorksStandard {
    /// BS 5975:2019
    BS5975,
    /// ASCE 37-14
    ASCE37,
    /// Eurocode 1991-1-6
    EC1991_1_6,
}

impl TemporaryWorksDesigner {
    /// Create new designer
    pub fn new(standard: TemporaryWorksStandard) -> Self {
        Self { standard }
    }
    
    /// Design temporary bracing
    pub fn design_temporary_bracing(&self, params: &BracingParams) -> BracingDesign {
        match self.standard {
            TemporaryWorksStandard::BS5975 => self.design_bracing_bs5975(params),
            TemporaryWorksStandard::ASCE37 => self.design_bracing_asce37(params),
            TemporaryWorksStandard::EC1991_1_6 => self.design_bracing_ec(params),
        }
    }
    
    fn design_bracing_bs5975(&self, params: &BracingParams) -> BracingDesign {
        // BS 5975 bracing design
        // Minimum horizontal force = 2.5% of vertical load
        let horizontal_force = params.vertical_load * 0.025;
        
        // Bracing capacity required
        let bracing_force = (horizontal_force.powi(2) + 
            (params.vertical_load * params.eccentricity / params.height).powi(2)).sqrt();
        
        // Select bracing size (simplified)
        let area_required = bracing_force / params.allowable_stress;
        
        BracingDesign {
            horizontal_force,
            bracing_force,
            area_required,
            recommended_section: self.select_bracing_section(area_required),
            standard: self.standard,
        }
    }
    
    fn design_bracing_asce37(&self, params: &BracingParams) -> BracingDesign {
        // ASCE 37 - minimum 2% of gravity load
        let horizontal_force = params.vertical_load * 0.02;
        let bracing_force = horizontal_force * 1.2; // Factor
        let area_required = bracing_force / params.allowable_stress;
        
        BracingDesign {
            horizontal_force,
            bracing_force,
            area_required,
            recommended_section: self.select_bracing_section(area_required),
            standard: self.standard,
        }
    }
    
    fn design_bracing_ec(&self, params: &BracingParams) -> BracingDesign {
        // EC 1991-1-6 - notional horizontal force
        let horizontal_force = params.vertical_load * 0.03;
        let bracing_force = horizontal_force * 1.35; // γ_Q
        let area_required = bracing_force / params.allowable_stress;
        
        BracingDesign {
            horizontal_force,
            bracing_force,
            area_required,
            recommended_section: self.select_bracing_section(area_required),
            standard: self.standard,
        }
    }
    
    fn select_bracing_section(&self, area_required: f64) -> String {
        // Simplified section selection
        if area_required < 500.0 {
            "L50x50x5".to_string()
        } else if area_required < 1000.0 {
            "L75x75x6".to_string()
        } else if area_required < 2000.0 {
            "L100x100x8".to_string()
        } else {
            "L150x150x10".to_string()
        }
    }
}

/// Bracing design parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BracingParams {
    /// Total vertical load (kN)
    pub vertical_load: f64,
    /// Height of structure (m)
    pub height: f64,
    /// Load eccentricity (m)
    pub eccentricity: f64,
    /// Allowable stress (MPa)
    pub allowable_stress: f64,
}

/// Bracing design result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BracingDesign {
    /// Horizontal force to resist (kN)
    pub horizontal_force: f64,
    /// Total bracing force (kN)
    pub bracing_force: f64,
    /// Required cross-sectional area (mm²)
    pub area_required: f64,
    /// Recommended section
    pub recommended_section: String,
    /// Design standard used
    pub standard: TemporaryWorksStandard,
}

/// Propping and shoring designer
#[derive(Debug, Clone)]
pub struct ProppingDesigner;

impl ProppingDesigner {
    /// Design propping system
    pub fn design_propping(&self, params: &ProppingParams) -> ProppingDesign {
        // Calculate load per prop
        let load_per_prop = params.total_load / params.num_props as f64;
        
        // Add contingency per BS 5975
        let design_load = load_per_prop * 1.5;
        
        // Check prop capacity
        let prop_type = self.select_prop_type(design_load);
        
        // Calculate buckling capacity
        let buckling_load = self.calculate_buckling_capacity(&prop_type, params.prop_height);
        
        // Calculate bearing pressure
        let bearing_pressure = design_load / params.bearing_area;
        
        ProppingDesign {
            load_per_prop,
            design_load,
            prop_type,
            buckling_capacity: buckling_load,
            bearing_pressure,
            is_adequate: buckling_load > design_load && bearing_pressure < params.allowable_bearing,
        }
    }
    
    fn select_prop_type(&self, load: f64) -> PropType {
        if load < 20.0 {
            PropType::Acrow { capacity_kn: 25.0 }
        } else if load < 50.0 {
            PropType::Heavy { capacity_kn: 60.0 }
        } else if load < 150.0 {
            PropType::SuperHeavy { capacity_kn: 200.0 }
        } else {
            PropType::Tower { capacity_kn: 500.0 }
        }
    }
    
    fn calculate_buckling_capacity(&self, prop_type: &PropType, height: f64) -> f64 {
        let base_capacity = match prop_type {
            PropType::Acrow { capacity_kn } => *capacity_kn,
            PropType::Heavy { capacity_kn } => *capacity_kn,
            PropType::SuperHeavy { capacity_kn } => *capacity_kn,
            PropType::Tower { capacity_kn } => *capacity_kn,
        };
        
        // Reduce capacity for height (simplified buckling reduction)
        let height_factor = (1.0 - 0.1 * (height - 3.0).max(0.0)).max(0.5);
        base_capacity * height_factor
    }
}

/// Propping parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProppingParams {
    /// Total load to support (kN)
    pub total_load: f64,
    /// Number of props
    pub num_props: usize,
    /// Prop height (m)
    pub prop_height: f64,
    /// Bearing area per prop (m²)
    pub bearing_area: f64,
    /// Allowable bearing pressure (kPa)
    pub allowable_bearing: f64,
}

/// Prop type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PropType {
    Acrow { capacity_kn: f64 },
    Heavy { capacity_kn: f64 },
    SuperHeavy { capacity_kn: f64 },
    Tower { capacity_kn: f64 },
}

/// Propping design result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProppingDesign {
    /// Load per prop (kN)
    pub load_per_prop: f64,
    /// Design load with factors (kN)
    pub design_load: f64,
    /// Selected prop type
    pub prop_type: PropType,
    /// Buckling capacity (kN)
    pub buckling_capacity: f64,
    /// Bearing pressure (kPa)
    pub bearing_pressure: f64,
    /// Is design adequate
    pub is_adequate: bool,
}

/// Back-propping analyzer for multi-story construction
#[derive(Debug, Clone)]
pub struct BackProppingAnalyzer;

impl BackProppingAnalyzer {
    /// Analyze back-propping requirements
    /// Based on Grundy & Kabaila method
    pub fn analyze_backpropping(&self, params: &BackProppingParams) -> BackProppingResult {
        let mut floor_loads = Vec::new();
        let mut max_load_ratio = 0.0_f64;
        
        // Grundy & Kabaila simplified method
        // Load distribution factors for each floor
        for floor in 0..params.num_floors_propped {
            let load_factor = self.calculate_load_factor(
                floor,
                params.num_floors_propped,
                params.num_reshores,
            );
            
            let floor_load = params.slab_self_weight * load_factor + 
                params.construction_load * (if floor == 0 { 1.0 } else { 0.5 });
            
            max_load_ratio = max_load_ratio.max(floor_load / params.slab_capacity);
            
            floor_loads.push(FloorLoad {
                floor_number: floor,
                load_factor,
                total_load: floor_load,
                utilization: floor_load / params.slab_capacity,
            });
        }
        
        BackProppingResult {
            floor_loads,
            max_load_ratio,
            recommended_propped_floors: self.recommend_propped_floors(max_load_ratio),
            is_safe: max_load_ratio <= 1.0,
        }
    }
    
    fn calculate_load_factor(&self, floor: usize, total_floors: usize, reshores: usize) -> f64 {
        // Simplified Grundy & Kabaila distribution
        let n = total_floors as f64;
        let k = (reshores + 1) as f64;
        
        let base_factor = 1.0 / k;
        let floor_factor = (n - floor as f64) / n;
        
        base_factor * floor_factor + 0.5
    }
    
    fn recommend_propped_floors(&self, max_ratio: f64) -> usize {
        if max_ratio <= 0.7 {
            2
        } else if max_ratio <= 0.85 {
            3
        } else {
            4
        }
    }
}

/// Back-propping parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackProppingParams {
    /// Number of floors being propped
    pub num_floors_propped: usize,
    /// Number of reshore levels
    pub num_reshores: usize,
    /// Slab self-weight (kN/m²)
    pub slab_self_weight: f64,
    /// Construction live load (kN/m²)
    pub construction_load: f64,
    /// Slab load capacity (kN/m²)
    pub slab_capacity: f64,
}

/// Floor load result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FloorLoad {
    /// Floor number (0 = lowest)
    pub floor_number: usize,
    /// Load distribution factor
    pub load_factor: f64,
    /// Total load on floor (kN/m²)
    pub total_load: f64,
    /// Utilization ratio
    pub utilization: f64,
}

/// Back-propping result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackProppingResult {
    /// Load on each floor
    pub floor_loads: Vec<FloorLoad>,
    /// Maximum load ratio
    pub max_load_ratio: f64,
    /// Recommended propped floors
    pub recommended_propped_floors: usize,
    /// Is configuration safe
    pub is_safe: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_concrete_strength_development() {
        // Test 7-day strength
        let beta_7 = ConcreteAgeEffect::strength_development_ec2(7.0, CementType::Normal);
        assert!(beta_7 > 0.6 && beta_7 < 0.8);
        
        // Test 28-day strength
        let beta_28 = ConcreteAgeEffect::strength_development_ec2(28.0, CementType::Normal);
        assert!((beta_28 - 1.0).abs() < 0.01);
        
        // Test rapid hardening
        let beta_rapid = ConcreteAgeEffect::strength_development_ec2(7.0, CementType::RapidHardening);
        assert!(beta_rapid > beta_7);
    }
    
    #[test]
    fn test_modulus_development() {
        let modulus_factor = ConcreteAgeEffect::modulus_development_ec2(0.7);
        assert!(modulus_factor > 0.8 && modulus_factor < 1.0);
    }
    
    #[test]
    fn test_creep_coefficient() {
        let phi = ConcreteAgeEffect::creep_coefficient_ec2(
            365.0,  // 1 year
            28.0,   // Loaded at 28 days
            200.0,  // Notional size
            70.0,   // RH
            38.0,   // fcm
            CementType::Normal,
        );
        assert!(phi > 1.0 && phi < 4.0);
    }
    
    #[test]
    fn test_construction_sequence() {
        let mut analyzer = ConstructionSequenceAnalyzer::new();
        
        analyzer.add_stage(ConstructionStage {
            id: "S1".to_string(),
            description: "Foundation".to_string(),
            duration_days: 14.0,
            elements_added: vec!["Foundation".to_string()],
            elements_removed: vec![],
            loads_applied: vec![ConstructionLoad {
                load_type: ConstructionLoadType::SelfWeight,
                magnitude: 100.0,
                location: LoadLocation::Area { x1: 0.0, y1: 0.0, x2: 10.0, y2: 10.0, z: 0.0 },
                duration: LoadDuration::Long,
            }],
            prerequisites: vec![],
            concrete_age: Some(ConcreteAgeEffect {
                age_days: 7.0,
                strength_factor: 0.7,
                modulus_factor: 0.85,
                creep_coefficient: 1.5,
                shrinkage_strain: 0.0002,
            }),
        });
        
        analyzer.add_stage(ConstructionStage {
            id: "S2".to_string(),
            description: "Columns".to_string(),
            duration_days: 7.0,
            elements_added: vec!["Columns".to_string()],
            elements_removed: vec![],
            loads_applied: vec![],
            prerequisites: vec!["S1".to_string()],
            concrete_age: None,
        });
        
        let result = analyzer.analyze_sequence();
        
        assert_eq!(result.stage_count, 2);
        assert_eq!(result.total_duration, 21.0);
        assert!(result.is_feasible);
    }
    
    #[test]
    fn test_temporary_bracing_bs5975() {
        let designer = TemporaryWorksDesigner::new(TemporaryWorksStandard::BS5975);
        
        let params = BracingParams {
            vertical_load: 1000.0,
            height: 5.0,
            eccentricity: 0.1,
            allowable_stress: 165.0,
        };
        
        let design = designer.design_temporary_bracing(&params);
        
        assert!((design.horizontal_force - 25.0).abs() < 0.1); // 2.5%
        assert!(design.area_required > 0.0);
    }
    
    #[test]
    fn test_temporary_bracing_asce37() {
        let designer = TemporaryWorksDesigner::new(TemporaryWorksStandard::ASCE37);
        
        let params = BracingParams {
            vertical_load: 1000.0,
            height: 5.0,
            eccentricity: 0.1,
            allowable_stress: 165.0,
        };
        
        let design = designer.design_temporary_bracing(&params);
        
        assert!((design.horizontal_force - 20.0).abs() < 0.1); // 2%
    }
    
    #[test]
    fn test_propping_design() {
        let designer = ProppingDesigner;
        
        let params = ProppingParams {
            total_load: 200.0,
            num_props: 10,
            prop_height: 3.5,
            bearing_area: 0.04,
            allowable_bearing: 200.0,
        };
        
        let design = designer.design_propping(&params);
        
        assert!((design.load_per_prop - 20.0).abs() < 0.1);
        assert!(design.buckling_capacity > design.design_load);
    }
    
    #[test]
    fn test_back_propping() {
        let analyzer = BackProppingAnalyzer;
        
        let params = BackProppingParams {
            num_floors_propped: 3,
            num_reshores: 1,
            slab_self_weight: 5.0,
            construction_load: 2.5,
            slab_capacity: 15.0,
        };
        
        let result = analyzer.analyze_backpropping(&params);
        
        assert_eq!(result.floor_loads.len(), 3);
        assert!(result.max_load_ratio > 0.0);
    }
    
    #[test]
    fn test_prop_type_selection() {
        let designer = ProppingDesigner;
        
        // Light load - design_load = (total/num) * 1.5 = (50/10) * 1.5 = 7.5 < 20 -> Acrow
        let params_light = ProppingParams {
            total_load: 50.0,   // Lower load
            num_props: 10,
            prop_height: 3.0,
            bearing_area: 0.04,
            allowable_bearing: 200.0,
        };
        let design_light = designer.design_propping(&params_light);
        assert!(matches!(design_light.prop_type, PropType::Acrow { .. }), 
            "Expected Acrow for light load, got {:?}", design_light.prop_type);
        
        // Heavy load - design_load = (2000/10) * 1.5 = 300 > 150 -> Tower
        let params_heavy = ProppingParams {
            total_load: 2000.0,  // Higher load for Tower type
            num_props: 10,
            prop_height: 3.0,
            bearing_area: 0.1,
            allowable_bearing: 5000.0,
        };
        let design_heavy = designer.design_propping(&params_heavy);
        assert!(matches!(design_heavy.prop_type, PropType::Tower { .. }),
            "Expected Tower for heavy load, got {:?}", design_heavy.prop_type);
    }
    
    #[test]
    fn test_load_duration() {
        let load = ConstructionLoad {
            load_type: ConstructionLoadType::ConcretePlacement,
            magnitude: 50.0,
            location: LoadLocation::Point { x: 5.0, y: 5.0, z: 3.0 },
            duration: LoadDuration::VeryShort,
        };
        
        assert!(matches!(load.duration, LoadDuration::VeryShort));
    }
    
    #[test]
    fn test_stage_prerequisites() {
        let mut analyzer = ConstructionSequenceAnalyzer::new();
        
        analyzer.add_stage(ConstructionStage {
            id: "A".to_string(),
            description: "First".to_string(),
            duration_days: 5.0,
            elements_added: vec![],
            elements_removed: vec![],
            loads_applied: vec![],
            prerequisites: vec![],
            concrete_age: None,
        });
        
        analyzer.add_stage(ConstructionStage {
            id: "B".to_string(),
            description: "Second".to_string(),
            duration_days: 5.0,
            elements_added: vec![],
            elements_removed: vec![],
            loads_applied: vec![],
            prerequisites: vec!["A".to_string()],
            concrete_age: None,
        });
        
        let result = analyzer.analyze_sequence();
        assert_eq!(result.total_duration, 10.0);
    }
}
