//! Lifecycle Assessment (LCA) Module
//! 
//! Comprehensive lifecycle analysis for:
//! - Embodied carbon calculations
//! - Environmental impact assessment
//! - Material life cycle analysis
//! - Carbon footprint optimization
//! 
//! Standards: EN 15978, ISO 14040/14044, PAS 2080, RICS guidance

#![allow(non_camel_case_types)]  // EN 15978 lifecycle stages like A1_RawMaterial

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Lifecycle stage per EN 15978
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum LifecycleStage {
    // Product stage
    A1_RawMaterial,
    A2_Transport,
    A3_Manufacturing,
    // Construction stage
    A4_TransportToSite,
    A5_Construction,
    // Use stage
    B1_Use,
    B2_Maintenance,
    B3_Repair,
    B4_Replacement,
    B5_Refurbishment,
    B6_OperationalEnergy,
    B7_OperationalWater,
    // End of life stage
    C1_Demolition,
    C2_TransportWaste,
    C3_WasteProcessing,
    C4_Disposal,
    // Beyond system boundary
    D_RecyclingPotential,
}

impl LifecycleStage {
    /// Get stage group
    pub fn group(&self) -> &str {
        match self {
            LifecycleStage::A1_RawMaterial |
            LifecycleStage::A2_Transport |
            LifecycleStage::A3_Manufacturing => "A1-A3 Product",
            LifecycleStage::A4_TransportToSite |
            LifecycleStage::A5_Construction => "A4-A5 Construction",
            LifecycleStage::B1_Use |
            LifecycleStage::B2_Maintenance |
            LifecycleStage::B3_Repair |
            LifecycleStage::B4_Replacement |
            LifecycleStage::B5_Refurbishment => "B1-B5 Use",
            LifecycleStage::B6_OperationalEnergy |
            LifecycleStage::B7_OperationalWater => "B6-B7 Operational",
            LifecycleStage::C1_Demolition |
            LifecycleStage::C2_TransportWaste |
            LifecycleStage::C3_WasteProcessing |
            LifecycleStage::C4_Disposal => "C1-C4 End of Life",
            LifecycleStage::D_RecyclingPotential => "D Beyond Boundary",
        }
    }
}

/// Material type for embodied carbon
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum MaterialType {
    // Concrete
    ConcreteCEM_I_C30,
    ConcreteCEM_I_C40,
    ConcreteCEM_II_C30,
    ConcreteCEM_III_C30,
    ConcreteGGBS50,
    ConcretePFA30,
    // Steel
    SteelSection,
    SteelRebar,
    SteelPlate,
    SteelRecycled,
    // Timber
    TimberSoftwood,
    TimberHardwood,
    TimberGlulam,
    TimberCLT,
    // Masonry
    Brick,
    BlockConcrete,
    BlockAAC,
    Stone,
    // Other
    Aluminium,
    AluminiumRecycled,
    Glass,
    Insulation,
    PlasterboardGypsum,
}

/// Embodied carbon factors database (kgCO2e/kg)
#[derive(Debug, Clone)]
pub struct CarbonFactors {
    /// Carbon factors per material (kgCO2e/kg)
    factors: HashMap<MaterialType, f64>,
}

impl Default for CarbonFactors {
    fn default() -> Self {
        let mut factors = HashMap::new();
        
        // ICE Database v3.0 values (simplified)
        // Concrete
        factors.insert(MaterialType::ConcreteCEM_I_C30, 0.103);
        factors.insert(MaterialType::ConcreteCEM_I_C40, 0.132);
        factors.insert(MaterialType::ConcreteCEM_II_C30, 0.089);
        factors.insert(MaterialType::ConcreteCEM_III_C30, 0.072);
        factors.insert(MaterialType::ConcreteGGBS50, 0.076);
        factors.insert(MaterialType::ConcretePFA30, 0.084);
        
        // Steel
        factors.insert(MaterialType::SteelSection, 1.55);
        factors.insert(MaterialType::SteelRebar, 1.99);
        factors.insert(MaterialType::SteelPlate, 2.89);
        factors.insert(MaterialType::SteelRecycled, 0.47);
        
        // Timber (biogenic carbon excluded)
        factors.insert(MaterialType::TimberSoftwood, 0.31);
        factors.insert(MaterialType::TimberHardwood, 0.48);
        factors.insert(MaterialType::TimberGlulam, 0.42);
        factors.insert(MaterialType::TimberCLT, 0.38);
        
        // Masonry
        factors.insert(MaterialType::Brick, 0.21);
        factors.insert(MaterialType::BlockConcrete, 0.10);
        factors.insert(MaterialType::BlockAAC, 0.28);
        factors.insert(MaterialType::Stone, 0.06);
        
        // Other
        factors.insert(MaterialType::Aluminium, 6.67);
        factors.insert(MaterialType::AluminiumRecycled, 0.84);
        factors.insert(MaterialType::Glass, 1.44);
        factors.insert(MaterialType::Insulation, 1.86);
        factors.insert(MaterialType::PlasterboardGypsum, 0.39);
        
        Self { factors }
    }
}

impl CarbonFactors {
    /// Get carbon factor for material
    pub fn get_factor(&self, material: MaterialType) -> f64 {
        *self.factors.get(&material).unwrap_or(&0.0)
    }
    
    /// Add custom material factor
    pub fn add_custom(&mut self, material: MaterialType, factor: f64) {
        self.factors.insert(material, factor);
    }
}

/// Building element for LCA
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildingElement {
    /// Element ID
    pub id: String,
    /// Element description
    pub description: String,
    /// Material type
    pub material: MaterialType,
    /// Quantity (kg or m³)
    pub quantity: f64,
    /// Unit (kg, m³, m², etc.)
    pub unit: String,
    /// Material density (kg/m³) if volume
    pub density: Option<f64>,
    /// Service life (years)
    pub service_life: f64,
    /// Recyclability (0-1)
    pub recyclability: f64,
}

impl BuildingElement {
    /// Calculate mass in kg
    pub fn mass_kg(&self) -> f64 {
        if self.unit == "kg" {
            self.quantity
        } else if self.unit == "m³" || self.unit == "m3" {
            self.quantity * self.density.unwrap_or(2400.0)
        } else {
            self.quantity // Assume already kg
        }
    }
}

/// LCA Calculator
#[derive(Debug, Clone)]
pub struct LCACalculator {
    /// Carbon factors database
    pub carbon_factors: CarbonFactors,
    /// Building design life (years)
    pub design_life: f64,
    /// Include biogenic carbon
    pub include_biogenic: bool,
}

impl LCACalculator {
    /// Create new calculator
    pub fn new(design_life: f64) -> Self {
        Self {
            carbon_factors: CarbonFactors::default(),
            design_life,
            include_biogenic: false,
        }
    }
    
    /// Calculate embodied carbon for element
    pub fn calculate_element_carbon(&self, element: &BuildingElement) -> ElementCarbonResult {
        let mass = element.mass_kg();
        let factor = self.carbon_factors.get_factor(element.material);
        
        // A1-A3: Product stage embodied carbon
        let a1_a3 = mass * factor;
        
        // A4: Transport to site (estimate 50km, 0.1 kg CO2e/kg/100km)
        let a4 = mass * 0.05 * 0.1;
        
        // A5: Construction (estimate 5% of A1-A3)
        let a5 = a1_a3 * 0.05;
        
        // B4: Replacements during building life
        let num_replacements = (self.design_life / element.service_life).ceil() as u32 - 1;
        let b4 = a1_a3 * num_replacements as f64;
        
        // C1-C4: End of life (estimate 3% of A1-A3)
        let c1_c4 = a1_a3 * 0.03;
        
        // D: Recycling credit
        let d = -a1_a3 * element.recyclability * 0.5; // 50% credit for recycled material
        
        // Biogenic carbon for timber
        let biogenic = if self.include_biogenic && is_timber(element.material) {
            -mass * 1.64 // CO2 sequestered per kg timber
        } else {
            0.0
        };
        
        ElementCarbonResult {
            element_id: element.id.clone(),
            mass_kg: mass,
            a1_a3,
            a4,
            a5,
            b4,
            c1_c4,
            d,
            biogenic,
            total: a1_a3 + a4 + a5 + b4 + c1_c4 + d + biogenic,
        }
    }
    
    /// Calculate whole building carbon
    pub fn calculate_building_carbon(&self, elements: &[BuildingElement], gfa: f64) -> BuildingCarbonResult {
        let mut stage_totals: HashMap<String, f64> = HashMap::new();
        let mut element_results = Vec::new();
        let mut total = 0.0;
        
        for element in elements {
            let result = self.calculate_element_carbon(element);
            
            // Accumulate by stage
            *stage_totals.entry("A1-A3".to_string()).or_insert(0.0) += result.a1_a3;
            *stage_totals.entry("A4".to_string()).or_insert(0.0) += result.a4;
            *stage_totals.entry("A5".to_string()).or_insert(0.0) += result.a5;
            *stage_totals.entry("B4".to_string()).or_insert(0.0) += result.b4;
            *stage_totals.entry("C1-C4".to_string()).or_insert(0.0) += result.c1_c4;
            *stage_totals.entry("D".to_string()).or_insert(0.0) += result.d;
            
            total += result.total;
            element_results.push(result);
        }
        
        // Carbon intensity per m²
        let intensity = total / gfa;
        
        // Benchmark comparison (typical office: 500-800 kgCO2e/m²)
        let benchmark_rating = self.get_benchmark_rating(intensity);
        
        BuildingCarbonResult {
            total_carbon: total,
            carbon_intensity: intensity,
            stage_breakdown: stage_totals,
            element_results,
            benchmark_rating,
            gfa,
        }
    }
    
    fn get_benchmark_rating(&self, intensity: f64) -> BenchmarkRating {
        // Based on LETI / RIBA 2030 targets for offices
        if intensity < 300.0 {
            BenchmarkRating::Excellent
        } else if intensity < 500.0 {
            BenchmarkRating::Good
        } else if intensity < 800.0 {
            BenchmarkRating::Typical
        } else if intensity < 1200.0 {
            BenchmarkRating::Poor
        } else {
            BenchmarkRating::VeryPoor
        }
    }
}

fn is_timber(material: MaterialType) -> bool {
    matches!(material,
        MaterialType::TimberSoftwood |
        MaterialType::TimberHardwood |
        MaterialType::TimberGlulam |
        MaterialType::TimberCLT
    )
}

/// Element carbon result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElementCarbonResult {
    pub element_id: String,
    pub mass_kg: f64,
    pub a1_a3: f64,
    pub a4: f64,
    pub a5: f64,
    pub b4: f64,
    pub c1_c4: f64,
    pub d: f64,
    pub biogenic: f64,
    pub total: f64,
}

/// Building carbon result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildingCarbonResult {
    pub total_carbon: f64,
    pub carbon_intensity: f64,
    pub stage_breakdown: HashMap<String, f64>,
    pub element_results: Vec<ElementCarbonResult>,
    pub benchmark_rating: BenchmarkRating,
    pub gfa: f64,
}

/// Benchmark rating
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum BenchmarkRating {
    Excellent,
    Good,
    Typical,
    Poor,
    VeryPoor,
}

/// Material optimization for carbon reduction
#[derive(Debug, Clone)]
pub struct CarbonOptimizer;

impl CarbonOptimizer {
    /// Suggest lower carbon alternatives
    pub fn suggest_alternatives(&self, element: &BuildingElement) -> Vec<AlternativeSuggestion> {
        let mut suggestions = Vec::new();
        let factors = CarbonFactors::default();
        let current_factor = factors.get_factor(element.material);
        
        // Find lower carbon alternatives
        let alternatives: Vec<(MaterialType, &str)> = match element.material {
            MaterialType::ConcreteCEM_I_C30 => vec![
                (MaterialType::ConcreteGGBS50, "Use 50% GGBS replacement"),
                (MaterialType::ConcretePFA30, "Use 30% PFA replacement"),
                (MaterialType::ConcreteCEM_III_C30, "Use CEM III cement"),
            ],
            MaterialType::ConcreteCEM_I_C40 => vec![
                (MaterialType::ConcreteCEM_II_C30, "Reduce strength if possible"),
                (MaterialType::ConcreteGGBS50, "Use 50% GGBS with C40"),
            ],
            MaterialType::SteelSection => vec![
                (MaterialType::SteelRecycled, "Use recycled steel sections"),
                (MaterialType::TimberGlulam, "Consider timber alternative"),
            ],
            MaterialType::SteelRebar => vec![
                (MaterialType::SteelRecycled, "Use recycled rebar"),
            ],
            MaterialType::Aluminium => vec![
                (MaterialType::AluminiumRecycled, "Use recycled aluminium"),
                (MaterialType::TimberHardwood, "Consider timber cladding"),
            ],
            MaterialType::Brick => vec![
                (MaterialType::Stone, "Use local stone if available"),
                (MaterialType::BlockConcrete, "Use concrete blocks"),
            ],
            _ => vec![],
        };
        
        for (alt_material, description) in alternatives {
            let alt_factor = factors.get_factor(alt_material);
            let savings = (current_factor - alt_factor) / current_factor * 100.0;
            
            if savings > 0.0 {
                suggestions.push(AlternativeSuggestion {
                    current_material: element.material,
                    alternative_material: alt_material,
                    description: description.to_string(),
                    carbon_savings_percent: savings,
                    current_factor,
                    alternative_factor: alt_factor,
                });
            }
        }
        
        // Sort by savings
        suggestions.sort_by(|a, b| b.carbon_savings_percent.partial_cmp(&a.carbon_savings_percent).unwrap());
        
        suggestions
    }
    
    /// Calculate optimal mix for structural elements
    pub fn optimize_structural_mix(&self, target_strength: f64, max_carbon: f64) -> OptimalMixResult {
        // Simplified concrete mix optimization
        // In reality, this would involve detailed mix design calculations
        
        let mixes: [(&str, f64, f64, f64); 5] = [
            ("CEM I", 0.0, 0.103, 1.0),       // GGBS%, factor, strength factor
            ("30% GGBS", 30.0, 0.085, 0.95),
            ("50% GGBS", 50.0, 0.076, 0.90),
            ("70% GGBS", 70.0, 0.065, 0.85),
            ("30% PFA", 30.0, 0.084, 0.92),
        ];
        
        let mut best_mix: Option<(String, f64, f64, f64)> = None;
        
        for (name, ggbs_percent, factor, strength_factor) in mixes.iter() {
            let achieved_strength = 30.0 * strength_factor; // Assume C30 base
            
            if achieved_strength >= target_strength && *factor <= max_carbon {
                if best_mix.is_none() || *factor < best_mix.as_ref().unwrap().1 {
                    best_mix = Some((name.to_string(), *factor, *ggbs_percent, achieved_strength));
                }
            }
        }
        
        if let Some((name, factor, replacement, strength)) = best_mix {
            OptimalMixResult {
                recommended_mix: name,
                carbon_factor: factor,
                cement_replacement: replacement,
                achieved_strength: strength,
                is_feasible: true,
            }
        } else {
            OptimalMixResult {
                recommended_mix: "CEM I (no feasible low-carbon mix)".to_string(),
                carbon_factor: 0.103,
                cement_replacement: 0.0,
                achieved_strength: target_strength,
                is_feasible: false,
            }
        }
    }
}

/// Alternative material suggestion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlternativeSuggestion {
    pub current_material: MaterialType,
    pub alternative_material: MaterialType,
    pub description: String,
    pub carbon_savings_percent: f64,
    pub current_factor: f64,
    pub alternative_factor: f64,
}

/// Optimal mix result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimalMixResult {
    pub recommended_mix: String,
    pub carbon_factor: f64,
    pub cement_replacement: f64,
    pub achieved_strength: f64,
    pub is_feasible: bool,
}

/// Whole life carbon calculator
#[derive(Debug, Clone)]
pub struct WholeLifeCarbonCalculator {
    /// Design life (years)
    pub design_life: f64,
    /// Discount rate for future carbon
    pub discount_rate: f64,
}

impl WholeLifeCarbonCalculator {
    /// Create new calculator
    pub fn new(design_life: f64, discount_rate: f64) -> Self {
        Self {
            design_life,
            discount_rate,
        }
    }
    
    /// Calculate whole life carbon including operational
    pub fn calculate_whole_life(
        &self,
        embodied_carbon: f64,
        annual_operational_carbon: f64,
        gfa: f64,
    ) -> WholeLifeResult {
        // Embodied carbon (upfront)
        let upfront = embodied_carbon;
        
        // Operational carbon over design life
        let mut operational_total = 0.0;
        let mut discounted_operational = 0.0;
        
        for year in 1..=self.design_life as u32 {
            let annual = annual_operational_carbon;
            operational_total += annual;
            
            // Apply discount rate
            let discount_factor = 1.0 / (1.0 + self.discount_rate).powi(year as i32);
            discounted_operational += annual * discount_factor;
        }
        
        // End of life (estimate 5% of embodied)
        let end_of_life = embodied_carbon * 0.05;
        
        let total = upfront + operational_total + end_of_life;
        let total_discounted = upfront + discounted_operational + end_of_life;
        
        WholeLifeResult {
            upfront_carbon: upfront,
            operational_carbon: operational_total,
            end_of_life_carbon: end_of_life,
            total_carbon: total,
            total_discounted: total_discounted,
            intensity_per_m2: total / gfa,
            intensity_per_m2_year: total / gfa / self.design_life,
            embodied_percentage: upfront / total * 100.0,
            operational_percentage: operational_total / total * 100.0,
        }
    }
}

/// Whole life result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WholeLifeResult {
    pub upfront_carbon: f64,
    pub operational_carbon: f64,
    pub end_of_life_carbon: f64,
    pub total_carbon: f64,
    pub total_discounted: f64,
    pub intensity_per_m2: f64,
    pub intensity_per_m2_year: f64,
    pub embodied_percentage: f64,
    pub operational_percentage: f64,
}

/// Environmental impact calculator (beyond carbon)
#[derive(Debug, Clone)]
pub struct EnvironmentalImpactCalculator;

impl EnvironmentalImpactCalculator {
    /// Calculate multiple environmental impact categories
    pub fn calculate_impacts(&self, element: &BuildingElement) -> EnvironmentalImpacts {
        let mass = element.mass_kg();
        
        // Impact factors per kg (simplified values)
        let (gwp, ap, ep, pocp, adp, wp) = match element.material {
            MaterialType::ConcreteCEM_I_C30 => (0.103, 0.0003, 0.00015, 0.00005, 0.001, 0.5),
            MaterialType::ConcreteCEM_I_C40 => (0.132, 0.0004, 0.0002, 0.00006, 0.0012, 0.6),
            MaterialType::SteelSection => (1.55, 0.005, 0.001, 0.0008, 0.02, 5.0),
            MaterialType::SteelRebar => (1.99, 0.006, 0.0012, 0.001, 0.025, 6.0),
            MaterialType::TimberSoftwood => (0.31, 0.001, 0.0005, 0.0003, 0.005, 2.0),
            MaterialType::TimberCLT => (0.38, 0.0012, 0.0006, 0.00035, 0.006, 2.5),
            MaterialType::Aluminium => (6.67, 0.03, 0.008, 0.005, 0.1, 50.0),
            MaterialType::Glass => (1.44, 0.006, 0.002, 0.001, 0.015, 10.0),
            _ => (0.1, 0.0003, 0.00015, 0.00005, 0.001, 0.5),
        };
        
        EnvironmentalImpacts {
            global_warming_potential: mass * gwp,
            acidification_potential: mass * ap,
            eutrophication_potential: mass * ep,
            photochemical_ozone_creation: mass * pocp,
            abiotic_depletion_potential: mass * adp,
            water_pollution: mass * wp,
        }
    }
}

/// Environmental impact categories
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentalImpacts {
    /// Global Warming Potential (kgCO2e)
    pub global_warming_potential: f64,
    /// Acidification Potential (kgSO2e)
    pub acidification_potential: f64,
    /// Eutrophication Potential (kgPO4e)
    pub eutrophication_potential: f64,
    /// Photochemical Ozone Creation Potential (kgC2H4e)
    pub photochemical_ozone_creation: f64,
    /// Abiotic Depletion Potential (kgSbe)
    pub abiotic_depletion_potential: f64,
    /// Water Pollution (kg)
    pub water_pollution: f64,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_carbon_factors() {
        let factors = CarbonFactors::default();
        
        assert!((factors.get_factor(MaterialType::ConcreteCEM_I_C30) - 0.103).abs() < 0.001);
        assert!((factors.get_factor(MaterialType::SteelSection) - 1.55).abs() < 0.01);
        assert!((factors.get_factor(MaterialType::TimberCLT) - 0.38).abs() < 0.01);
    }
    
    #[test]
    fn test_element_carbon_calculation() {
        let calc = LCACalculator::new(60.0);
        
        let element = BuildingElement {
            id: "SLAB-01".to_string(),
            description: "Ground floor slab".to_string(),
            material: MaterialType::ConcreteCEM_I_C30,
            quantity: 100.0,
            unit: "m³".to_string(),
            density: Some(2400.0),
            service_life: 60.0,
            recyclability: 0.3,
        };
        
        let result = calc.calculate_element_carbon(&element);
        
        // 100 m³ * 2400 kg/m³ * 0.103 kgCO2e/kg = 24,720 kgCO2e for A1-A3
        assert!((result.a1_a3 - 24720.0).abs() < 100.0);
        // Total includes recycling credits (D stage), so can be less than a1_a3
        assert!(result.total > 0.0);
    }
    
    #[test]
    fn test_building_carbon() {
        let calc = LCACalculator::new(60.0);
        
        let elements = vec![
            BuildingElement {
                id: "SLAB".to_string(),
                description: "Slabs".to_string(),
                material: MaterialType::ConcreteCEM_I_C30,
                quantity: 200.0,
                unit: "m³".to_string(),
                density: Some(2400.0),
                service_life: 60.0,
                recyclability: 0.3,
            },
            BuildingElement {
                id: "STEEL".to_string(),
                description: "Steel frame".to_string(),
                material: MaterialType::SteelSection,
                quantity: 50000.0,
                unit: "kg".to_string(),
                density: None,
                service_life: 60.0,
                recyclability: 0.9,
            },
        ];
        
        let result = calc.calculate_building_carbon(&elements, 1000.0);
        
        assert!(result.total_carbon > 0.0);
        assert!(result.carbon_intensity > 0.0);
        assert_eq!(result.element_results.len(), 2);
    }
    
    #[test]
    fn test_benchmark_rating() {
        let calc = LCACalculator::new(60.0);
        
        // Create elements that give different intensities
        let excellent_elements = vec![
            BuildingElement {
                id: "TIMBER".to_string(),
                description: "CLT structure".to_string(),
                material: MaterialType::TimberCLT,
                quantity: 50000.0,
                unit: "kg".to_string(),
                density: None,
                service_life: 60.0,
                recyclability: 0.5,
            },
        ];
        
        let result = calc.calculate_building_carbon(&excellent_elements, 1000.0);
        // Low carbon timber building should be rated well
        assert!(matches!(result.benchmark_rating, 
            BenchmarkRating::Excellent | BenchmarkRating::Good));
    }
    
    #[test]
    fn test_carbon_optimizer_suggestions() {
        let optimizer = CarbonOptimizer;
        
        let element = BuildingElement {
            id: "COL".to_string(),
            description: "Columns".to_string(),
            material: MaterialType::ConcreteCEM_I_C30,
            quantity: 50.0,
            unit: "m³".to_string(),
            density: Some(2400.0),
            service_life: 60.0,
            recyclability: 0.3,
        };
        
        let suggestions = optimizer.suggest_alternatives(&element);
        
        assert!(!suggestions.is_empty());
        assert!(suggestions[0].carbon_savings_percent > 0.0);
    }
    
    #[test]
    fn test_optimal_mix() {
        let optimizer = CarbonOptimizer;
        
        // Low carbon target
        let result = optimizer.optimize_structural_mix(25.0, 0.08);
        
        assert!(result.is_feasible);
        assert!(result.carbon_factor <= 0.08);
    }
    
    #[test]
    fn test_whole_life_carbon() {
        let calc = WholeLifeCarbonCalculator::new(60.0, 0.035);
        
        let result = calc.calculate_whole_life(
            500000.0,  // Embodied carbon kgCO2e
            50000.0,   // Annual operational kgCO2e
            1000.0,    // GFA m²
        );
        
        assert!(result.total_carbon > result.upfront_carbon);
        assert!(result.operational_percentage > 0.0);
        assert!(result.embodied_percentage > 0.0);
        assert!((result.embodied_percentage + result.operational_percentage + 
                result.end_of_life_carbon / result.total_carbon * 100.0 - 100.0).abs() < 1.0);
    }
    
    #[test]
    fn test_environmental_impacts() {
        let calc = EnvironmentalImpactCalculator;
        
        let element = BuildingElement {
            id: "STEEL".to_string(),
            description: "Steel beams".to_string(),
            material: MaterialType::SteelSection,
            quantity: 10000.0,
            unit: "kg".to_string(),
            density: None,
            service_life: 60.0,
            recyclability: 0.9,
        };
        
        let impacts = calc.calculate_impacts(&element);
        
        // Steel should have high GWP
        assert!(impacts.global_warming_potential > 10000.0);
        assert!(impacts.acidification_potential > 0.0);
    }
    
    #[test]
    fn test_lifecycle_stage_groups() {
        assert_eq!(LifecycleStage::A1_RawMaterial.group(), "A1-A3 Product");
        assert_eq!(LifecycleStage::A5_Construction.group(), "A4-A5 Construction");
        assert_eq!(LifecycleStage::B6_OperationalEnergy.group(), "B6-B7 Operational");
        assert_eq!(LifecycleStage::C4_Disposal.group(), "C1-C4 End of Life");
    }
    
    #[test]
    fn test_timber_biogenic_carbon() {
        let mut calc = LCACalculator::new(60.0);
        calc.include_biogenic = true;
        
        let element = BuildingElement {
            id: "CLT".to_string(),
            description: "CLT panel".to_string(),
            material: MaterialType::TimberCLT,
            quantity: 1000.0,
            unit: "kg".to_string(),
            density: None,
            service_life: 60.0,
            recyclability: 0.5,
        };
        
        let result = calc.calculate_element_carbon(&element);
        
        // Biogenic carbon should be negative (sequestration)
        assert!(result.biogenic < 0.0);
    }
    
    #[test]
    fn test_replacement_cycles() {
        let calc = LCACalculator::new(60.0);
        
        // Element with short service life - needs replacement
        let element_short = BuildingElement {
            id: "FINISH".to_string(),
            description: "Finishes".to_string(),
            material: MaterialType::PlasterboardGypsum,
            quantity: 1000.0,
            unit: "kg".to_string(),
            density: None,
            service_life: 15.0, // Replaced 3 times in 60 years
            recyclability: 0.2,
        };
        
        let result = calc.calculate_element_carbon(&element_short);
        
        // B4 should be significant due to replacements
        assert!(result.b4 > 0.0);
        assert!(result.b4 >= result.a1_a3 * 2.0); // At least 3 replacements
    }
}
