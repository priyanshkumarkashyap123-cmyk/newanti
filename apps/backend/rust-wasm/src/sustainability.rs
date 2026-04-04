// ============================================================================
// SUSTAINABILITY ANALYSIS - LCA, Carbon Footprint, Embodied Energy
// Life Cycle Assessment, Circular Economy, Green Building Metrics
// ============================================================================

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// MATERIAL ENVIRONMENTAL DATA
// ============================================================================

/// Material environmental impact factors
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaterialEnvironment {
    pub name: String,
    /// Embodied carbon (kg CO2e/kg)
    pub embodied_carbon: f64,
    /// Embodied energy (MJ/kg)
    pub embodied_energy: f64,
    /// Water footprint (L/kg)
    pub water_footprint: f64,
    /// Recyclability (0-1)
    pub recyclability: f64,
    /// Recycled content (0-1)
    pub recycled_content: f64,
    /// Service life (years)
    pub service_life: f64,
    /// End-of-life credit (kg CO2e/kg)
    pub eol_credit: f64,
}

impl MaterialEnvironment {
    /// Steel (typical)
    pub fn steel() -> Self {
        Self {
            name: "Steel".to_string(),
            embodied_carbon: 1.46,
            embodied_energy: 20.1,
            water_footprint: 24.0,
            recyclability: 0.95,
            recycled_content: 0.30,
            service_life: 75.0,
            eol_credit: -0.8,
        }
    }
    
    /// Concrete (typical)
    pub fn concrete() -> Self {
        Self {
            name: "Concrete".to_string(),
            embodied_carbon: 0.15,
            embodied_energy: 1.2,
            water_footprint: 170.0,
            recyclability: 0.80,
            recycled_content: 0.05,
            service_life: 60.0,
            eol_credit: -0.02,
        }
    }
    
    /// Timber (softwood)
    pub fn timber_softwood() -> Self {
        Self {
            name: "Timber (Softwood)".to_string(),
            embodied_carbon: -1.64, // Carbon sequestration
            embodied_energy: 2.0,
            water_footprint: 650.0,
            recyclability: 0.70,
            recycled_content: 0.0,
            service_life: 50.0,
            eol_credit: 0.0,
        }
    }
    
    /// Aluminum
    pub fn aluminum() -> Self {
        Self {
            name: "Aluminum".to_string(),
            embodied_carbon: 8.24,
            embodied_energy: 155.0,
            water_footprint: 85.0,
            recyclability: 0.95,
            recycled_content: 0.35,
            service_life: 75.0,
            eol_credit: -7.0,
        }
    }
    
    /// Glass
    pub fn glass() -> Self {
        Self {
            name: "Glass".to_string(),
            embodied_carbon: 0.85,
            embodied_energy: 15.0,
            water_footprint: 5.0,
            recyclability: 0.90,
            recycled_content: 0.25,
            service_life: 40.0,
            eol_credit: -0.5,
        }
    }
    
    /// Cross-laminated timber (CLT)
    pub fn clt() -> Self {
        Self {
            name: "CLT".to_string(),
            embodied_carbon: -0.72,
            embodied_energy: 3.5,
            water_footprint: 450.0,
            recyclability: 0.65,
            recycled_content: 0.0,
            service_life: 60.0,
            eol_credit: 0.0,
        }
    }
    
    /// Low-carbon concrete (with SCMs)
    pub fn low_carbon_concrete() -> Self {
        Self {
            name: "Low-Carbon Concrete".to_string(),
            embodied_carbon: 0.08,
            embodied_energy: 0.9,
            water_footprint: 150.0,
            recyclability: 0.80,
            recycled_content: 0.40,
            service_life: 60.0,
            eol_credit: -0.02,
        }
    }
}

// ============================================================================
// LIFE CYCLE ASSESSMENT
// ============================================================================

/// LCA stages (EN 15978)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LcaStage {
    /// A1-A3: Product stage (raw material, transport, manufacturing)
    ProductStage,
    /// A4-A5: Construction stage
    ConstructionStage,
    /// B1-B7: Use stage
    UseStage,
    /// C1-C4: End of life
    EndOfLife,
    /// D: Benefits beyond system boundary
    BeyondLifeCycle,
}

/// LCA result for single material
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LcaMaterialResult {
    pub material: MaterialEnvironment,
    pub quantity_kg: f64,
    pub a1_a3_carbon: f64,
    pub a4_a5_carbon: f64,
    pub b_carbon: f64,
    pub c_carbon: f64,
    pub d_carbon: f64,
    pub total_carbon: f64,
}

impl LcaMaterialResult {
    pub fn calculate(material: &MaterialEnvironment, quantity_kg: f64) -> Self {
        let a1_a3 = quantity_kg * material.embodied_carbon;
        let a4_a5 = quantity_kg * 0.02; // Simplified construction impact
        let b = 0.0; // Simplified - depends on maintenance
        let c = quantity_kg * 0.01; // End of life processing
        let d = quantity_kg * material.eol_credit * material.recyclability;
        
        Self {
            material: material.clone(),
            quantity_kg,
            a1_a3_carbon: a1_a3,
            a4_a5_carbon: a4_a5,
            b_carbon: b,
            c_carbon: c,
            d_carbon: d,
            total_carbon: a1_a3 + a4_a5 + b + c + d,
        }
    }
}

/// Complete LCA analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LifeCycleAssessment {
    pub project_name: String,
    pub reference_study_period: f64, // years
    pub gross_floor_area: f64,       // m²
    pub material_results: Vec<LcaMaterialResult>,
}

impl LifeCycleAssessment {
    pub fn new(name: &str, study_period: f64, gfa: f64) -> Self {
        Self {
            project_name: name.to_string(),
            reference_study_period: study_period,
            gross_floor_area: gfa,
            material_results: Vec::new(),
        }
    }
    
    /// Add material
    pub fn add_material(&mut self, material: &MaterialEnvironment, quantity_kg: f64) {
        let result = LcaMaterialResult::calculate(material, quantity_kg);
        self.material_results.push(result);
    }
    
    /// Total embodied carbon (kg CO2e)
    pub fn total_embodied_carbon(&self) -> f64 {
        self.material_results.iter()
            .map(|r| r.total_carbon)
            .sum()
    }
    
    /// Embodied carbon intensity (kg CO2e/m²)
    pub fn carbon_intensity(&self) -> f64 {
        if self.gross_floor_area > 0.0 {
            self.total_embodied_carbon() / self.gross_floor_area
        } else {
            0.0
        }
    }
    
    /// Annualized carbon (kg CO2e/m²/year)
    pub fn annualized_carbon(&self) -> f64 {
        if self.reference_study_period > 0.0 {
            self.carbon_intensity() / self.reference_study_period
        } else {
            0.0
        }
    }
    
    /// Total embodied energy (MJ)
    pub fn total_embodied_energy(&self) -> f64 {
        self.material_results.iter()
            .map(|r| r.quantity_kg * r.material.embodied_energy)
            .sum()
    }
    
    /// Stage breakdown
    pub fn stage_breakdown(&self) -> HashMap<String, f64> {
        let mut stages = HashMap::new();
        
        let a1_a3: f64 = self.material_results.iter().map(|r| r.a1_a3_carbon).sum();
        let a4_a5: f64 = self.material_results.iter().map(|r| r.a4_a5_carbon).sum();
        let b: f64 = self.material_results.iter().map(|r| r.b_carbon).sum();
        let c: f64 = self.material_results.iter().map(|r| r.c_carbon).sum();
        let d: f64 = self.material_results.iter().map(|r| r.d_carbon).sum();
        
        stages.insert("A1-A3 (Product)".to_string(), a1_a3);
        stages.insert("A4-A5 (Construction)".to_string(), a4_a5);
        stages.insert("B (Use)".to_string(), b);
        stages.insert("C (End of Life)".to_string(), c);
        stages.insert("D (Beyond Lifecycle)".to_string(), d);
        
        stages
    }
    
    /// Material contribution
    pub fn material_contribution(&self) -> Vec<(String, f64, f64)> {
        let total = self.total_embodied_carbon();
        
        self.material_results.iter()
            .map(|r| (
                r.material.name.clone(),
                r.total_carbon,
                if total > 0.0 { r.total_carbon / total * 100.0 } else { 0.0 },
            ))
            .collect()
    }
}

// ============================================================================
// CARBON FOOTPRINT CALCULATION
// ============================================================================

/// Building carbon footprint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CarbonFootprint {
    /// Gross floor area (m²)
    pub gfa: f64,
    /// Building service life (years)
    pub service_life: f64,
    /// Upfront embodied carbon (kg CO2e)
    pub upfront_carbon: f64,
    /// Operational carbon per year (kg CO2e/year)
    pub operational_carbon_annual: f64,
    /// Maintenance carbon per year (kg CO2e/year)
    pub maintenance_carbon_annual: f64,
    /// End of life carbon (kg CO2e)
    pub eol_carbon: f64,
}

impl CarbonFootprint {
    pub fn new(gfa: f64, service_life: f64) -> Self {
        Self {
            gfa,
            service_life,
            upfront_carbon: 0.0,
            operational_carbon_annual: 0.0,
            maintenance_carbon_annual: 0.0,
            eol_carbon: 0.0,
        }
    }
    
    /// Set upfront carbon from LCA
    pub fn set_upfront(&mut self, carbon: f64) {
        self.upfront_carbon = carbon;
    }
    
    /// Set operational carbon from energy use
    pub fn set_operational(&mut self, energy_kwh_per_year: f64, carbon_factor: f64) {
        self.operational_carbon_annual = energy_kwh_per_year * carbon_factor;
    }
    
    /// Whole life carbon
    pub fn whole_life_carbon(&self) -> f64 {
        self.upfront_carbon
            + self.operational_carbon_annual * self.service_life
            + self.maintenance_carbon_annual * self.service_life
            + self.eol_carbon
    }
    
    /// Whole life carbon intensity (kg CO2e/m²)
    pub fn wlc_intensity(&self) -> f64 {
        if self.gfa > 0.0 {
            self.whole_life_carbon() / self.gfa
        } else {
            0.0
        }
    }
    
    /// Upfront carbon intensity
    pub fn upfront_intensity(&self) -> f64 {
        if self.gfa > 0.0 {
            self.upfront_carbon / self.gfa
        } else {
            0.0
        }
    }
    
    /// Embodied vs operational split
    pub fn embodied_operational_ratio(&self) -> f64 {
        let embodied = self.upfront_carbon + self.eol_carbon;
        let operational = self.operational_carbon_annual * self.service_life;
        
        if operational > 0.0 {
            embodied / operational
        } else {
            f64::INFINITY
        }
    }
    
    /// LETI benchmark check
    pub fn check_leti_benchmark(&self, benchmark_kg_per_m2: f64) -> bool {
        self.upfront_intensity() <= benchmark_kg_per_m2
    }
    
    /// Carbon budget for net zero by year
    pub fn carbon_budget_annual(&self, target_year: f64, current_year: f64) -> f64 {
        let years_remaining = (target_year - current_year).max(1.0);
        self.whole_life_carbon() / years_remaining / self.gfa
    }
}

// ============================================================================
// CIRCULAR ECONOMY METRICS
// ============================================================================

/// Circular economy indicators
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CircularEconomyMetrics {
    /// Material circularity indicator (0-1)
    pub mci: f64,
    /// Recycled input rate (0-1)
    pub recycled_input: f64,
    /// End-of-life recycling rate (0-1)
    pub eol_recycling: f64,
    /// Design for disassembly score (0-1)
    pub dfd_score: f64,
    /// Material passport available
    pub has_material_passport: bool,
}

impl CircularEconomyMetrics {
    /// Calculate MCI (simplified Ellen MacArthur method)
    pub fn calculate_mci(
        recycled_input: f64,
        eol_recycling: f64,
        utility_factor: f64, // L/L_avg
    ) -> f64 {
        let v = recycled_input; // Virgin material avoided
        let w = 1.0 - eol_recycling; // Unrecoverable waste
        
        let lfv = v + w;
        let f_lfv = 0.9 / lfv; // Linear flow factor
        
        let mci = 1.0 - lfv * f_lfv / utility_factor;
        
        mci.clamp(0.0, 1.0)
    }
    
    /// New metrics
    pub fn new(
        recycled_input: f64,
        eol_recycling: f64,
        utility_factor: f64,
        dfd_score: f64,
    ) -> Self {
        Self {
            mci: Self::calculate_mci(recycled_input, eol_recycling, utility_factor),
            recycled_input,
            eol_recycling,
            dfd_score,
            has_material_passport: false,
        }
    }
    
    /// Circularity grade
    pub fn grade(&self) -> &'static str {
        match self.mci {
            x if x >= 0.8 => "Excellent",
            x if x >= 0.6 => "Good",
            x if x >= 0.4 => "Moderate",
            x if x >= 0.2 => "Low",
            _ => "Very Low",
        }
    }
}

// ============================================================================
// GREEN BUILDING CERTIFICATION
// ============================================================================

/// Green building certification types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CertificationType {
    Leed,
    Breeam,
    Well,
    LivingBuilding,
    PassiveHouse,
}

/// LEED categories
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeedScoring {
    pub location_transportation: f64,  // max 16
    pub sustainable_sites: f64,        // max 10
    pub water_efficiency: f64,         // max 11
    pub energy_atmosphere: f64,        // max 33
    pub materials_resources: f64,      // max 13
    pub indoor_environmental_quality: f64, // max 16
    pub innovation: f64,               // max 6
    pub regional_priority: f64,        // max 4
}

impl LeedScoring {
    pub fn new() -> Self {
        Self {
            location_transportation: 0.0,
            sustainable_sites: 0.0,
            water_efficiency: 0.0,
            energy_atmosphere: 0.0,
            materials_resources: 0.0,
            indoor_environmental_quality: 0.0,
            innovation: 0.0,
            regional_priority: 0.0,
        }
    }
    
    /// Total points
    pub fn total(&self) -> f64 {
        self.location_transportation
            + self.sustainable_sites
            + self.water_efficiency
            + self.energy_atmosphere
            + self.materials_resources
            + self.indoor_environmental_quality
            + self.innovation
            + self.regional_priority
    }
    
    /// Certification level
    pub fn level(&self) -> &'static str {
        match self.total() as i32 {
            80..=110 => "Platinum",
            60..=79 => "Gold",
            50..=59 => "Silver",
            40..=49 => "Certified",
            _ => "Not Certified",
        }
    }
}

// ============================================================================
// EMBODIED ENERGY OPTIMIZATION
// ============================================================================

/// Material alternative for optimization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaterialAlternative {
    pub name: String,
    pub material: MaterialEnvironment,
    pub cost_per_kg: f64,
    pub structural_factor: f64, // Relative strength
}

/// Optimization result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationResult {
    pub selected_materials: Vec<(String, f64)>, // (name, quantity)
    pub total_carbon: f64,
    pub total_cost: f64,
    pub carbon_reduction_percent: f64,
}

/// Embodied energy optimizer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbodiedEnergyOptimizer {
    pub alternatives: Vec<MaterialAlternative>,
    pub baseline_carbon: f64,
    pub budget_constraint: f64,
}

impl EmbodiedEnergyOptimizer {
    pub fn new(budget: f64) -> Self {
        Self {
            alternatives: Vec::new(),
            baseline_carbon: 0.0,
            budget_constraint: budget,
        }
    }
    
    /// Add alternative
    pub fn add_alternative(&mut self, alt: MaterialAlternative) {
        self.alternatives.push(alt);
    }
    
    /// Simple optimization (lowest carbon within budget)
    pub fn optimize(&self, required_quantity: f64) -> OptimizationResult {
        let mut best = None;
        let mut best_carbon = f64::MAX;
        
        for alt in &self.alternatives {
            let qty = required_quantity / alt.structural_factor;
            let cost = qty * alt.cost_per_kg;
            let carbon = qty * alt.material.embodied_carbon;
            
            if cost <= self.budget_constraint && carbon < best_carbon {
                best = Some((alt.name.clone(), qty, cost, carbon));
                best_carbon = carbon;
            }
        }
        
        match best {
            Some((name, qty, cost, carbon)) => OptimizationResult {
                selected_materials: vec![(name, qty)],
                total_carbon: carbon,
                total_cost: cost,
                carbon_reduction_percent: if self.baseline_carbon > 0.0 {
                    (1.0 - carbon / self.baseline_carbon) * 100.0
                } else {
                    0.0
                },
            },
            None => OptimizationResult {
                selected_materials: Vec::new(),
                total_carbon: 0.0,
                total_cost: 0.0,
                carbon_reduction_percent: 0.0,
            },
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
    fn test_material_environment() {
        let steel = MaterialEnvironment::steel();
        let concrete = MaterialEnvironment::concrete();
        
        assert!(steel.embodied_carbon > concrete.embodied_carbon);
        assert!(steel.recyclability > concrete.recyclability);
    }

    #[test]
    fn test_timber_carbon_negative() {
        let timber = MaterialEnvironment::timber_softwood();
        
        assert!(timber.embodied_carbon < 0.0); // Carbon sequestration
    }

    #[test]
    fn test_lca_material_result() {
        let steel = MaterialEnvironment::steel();
        let result = LcaMaterialResult::calculate(&steel, 1000.0);
        
        assert!(result.a1_a3_carbon > 0.0);
        assert!(result.d_carbon < 0.0); // Recycling credit
    }

    #[test]
    fn test_lca_analysis() {
        let mut lca = LifeCycleAssessment::new("Test Building", 60.0, 1000.0);
        
        lca.add_material(&MaterialEnvironment::concrete(), 500000.0);
        lca.add_material(&MaterialEnvironment::steel(), 20000.0);
        
        let total = lca.total_embodied_carbon();
        let intensity = lca.carbon_intensity();
        
        assert!(total > 0.0);
        assert!(intensity > 0.0);
    }

    #[test]
    fn test_carbon_footprint() {
        let mut cf = CarbonFootprint::new(1000.0, 60.0);
        
        cf.set_upfront(300000.0);
        cf.set_operational(100000.0, 0.5);
        
        let wlc = cf.whole_life_carbon();
        assert!(wlc > cf.upfront_carbon);
    }

    #[test]
    fn test_carbon_intensity() {
        let mut cf = CarbonFootprint::new(1000.0, 60.0);
        cf.set_upfront(500000.0);
        
        let intensity = cf.upfront_intensity();
        assert!((intensity - 500.0).abs() < 0.1);
    }

    #[test]
    fn test_mci_calculation() {
        let mci = CircularEconomyMetrics::calculate_mci(0.3, 0.8, 1.0);
        
        assert!(mci >= 0.0 && mci <= 1.0);
    }

    #[test]
    fn test_circular_metrics() {
        let metrics = CircularEconomyMetrics::new(0.4, 0.85, 1.2, 0.7);
        
        assert!(metrics.mci > 0.0);
        assert!(!metrics.grade().is_empty());
    }

    #[test]
    fn test_leed_scoring() {
        let mut leed = LeedScoring::new();
        
        leed.energy_atmosphere = 25.0;
        leed.materials_resources = 10.0;
        leed.water_efficiency = 8.0;
        leed.location_transportation = 12.0;
        
        assert_eq!(leed.total(), 55.0);
        assert_eq!(leed.level(), "Silver");
    }

    #[test]
    fn test_stage_breakdown() {
        let mut lca = LifeCycleAssessment::new("Test", 50.0, 500.0);
        lca.add_material(&MaterialEnvironment::steel(), 10000.0);
        
        let stages = lca.stage_breakdown();
        
        assert!(stages.contains_key("A1-A3 (Product)"));
        assert!(*stages.get("A1-A3 (Product)").unwrap() > 0.0);
    }

    #[test]
    fn test_leti_benchmark() {
        let mut cf = CarbonFootprint::new(1000.0, 60.0);
        cf.set_upfront(300000.0);
        
        assert!(!cf.check_leti_benchmark(250.0)); // 300 kg/m² > 250 benchmark
        assert!(cf.check_leti_benchmark(350.0));
    }

    #[test]
    fn test_optimizer() {
        let mut opt = EmbodiedEnergyOptimizer::new(100000.0);
        opt.baseline_carbon = 50000.0;
        
        opt.add_alternative(MaterialAlternative {
            name: "Standard Steel".to_string(),
            material: MaterialEnvironment::steel(),
            cost_per_kg: 1.5,
            structural_factor: 1.0,
        });
        
        opt.add_alternative(MaterialAlternative {
            name: "Low-Carbon Concrete".to_string(),
            material: MaterialEnvironment::low_carbon_concrete(),
            cost_per_kg: 0.15,
            structural_factor: 0.1, // Much more needed
        });
        
        let result = opt.optimize(10000.0);
        
        assert!(!result.selected_materials.is_empty());
    }
}
