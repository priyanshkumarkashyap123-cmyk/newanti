//! Resilience Engineering Module
//! 
//! Comprehensive resilience assessment for:
//! - Community resilience metrics
//! - Recovery modeling
//! - Functionality restoration curves
//! - Resilience quantification
//! 
//! Standards: NIST Community Resilience Planning Guide, REDi, FEMA P-58

use serde::{Deserialize, Serialize};

/// Resilience metric type
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum ResilienceMetric {
    /// Recovery time (days to reach target functionality)
    RecoveryTime,
    /// Resilience integral (area under recovery curve)
    ResilienceIntegral,
    /// Expected annual loss
    ExpectedAnnualLoss,
    /// Downtime (time with functionality below threshold)
    Downtime,
}

/// Functionality state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionalityState {
    /// Time from event (days)
    pub time: f64,
    /// Functionality level (0-1)
    pub functionality: f64,
    /// Recovery phase
    pub phase: RecoveryPhase,
}

/// Recovery phase
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum RecoveryPhase {
    /// Initial response and assessment
    Response,
    /// Short-term stabilization
    ShortTerm,
    /// Intermediate recovery
    Intermediate,
    /// Long-term recovery/reconstruction
    LongTerm,
    /// Fully recovered
    Recovered,
}

/// Recovery curve model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryCurve {
    /// Initial functionality immediately after event (0-1)
    pub initial_functionality: f64,
    /// Target functionality (typically 1.0)
    pub target_functionality: f64,
    /// Recovery model type
    pub model: RecoveryModel,
    /// Recovery time parameters
    pub parameters: RecoveryParameters,
}

/// Recovery model type
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum RecoveryModel {
    /// Linear recovery
    Linear,
    /// Exponential recovery
    Exponential,
    /// S-curve (logistic) recovery
    SCurve,
    /// Step function recovery
    Step,
    /// Trigonometric recovery
    Trigonometric,
}

/// Recovery time parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryParameters {
    /// Inspection time (days)
    pub inspection_time: f64,
    /// Engineering/mobilization time (days)
    pub mobilization_time: f64,
    /// Repair time (days)
    pub repair_time: f64,
    /// Total recovery time (days)
    pub total_time: f64,
}

impl RecoveryCurve {
    /// Create new recovery curve
    pub fn new(initial: f64, model: RecoveryModel, total_days: f64) -> Self {
        Self {
            initial_functionality: initial,
            target_functionality: 1.0,
            model,
            parameters: RecoveryParameters {
                inspection_time: total_days * 0.05,
                mobilization_time: total_days * 0.15,
                repair_time: total_days * 0.80,
                total_time: total_days,
            },
        }
    }
    
    /// Calculate functionality at time t (days)
    pub fn functionality_at(&self, t: f64) -> f64 {
        if t <= 0.0 {
            return self.initial_functionality;
        }
        if t >= self.parameters.total_time {
            return self.target_functionality;
        }
        
        let q0 = self.initial_functionality;
        let q_target = self.target_functionality;
        let t_total = self.parameters.total_time;
        
        match self.model {
            RecoveryModel::Linear => {
                q0 + (q_target - q0) * (t / t_total)
            }
            RecoveryModel::Exponential => {
                // Q(t) = Q_target - (Q_target - Q0) * exp(-k*t)
                let k = 3.0 / t_total; // 95% recovery at t_total
                q_target - (q_target - q0) * (-k * t).exp()
            }
            RecoveryModel::SCurve => {
                // Logistic function
                let k = 6.0 / t_total;
                let t_mid = t_total / 2.0;
                q0 + (q_target - q0) / (1.0 + (-k * (t - t_mid)).exp())
            }
            RecoveryModel::Step => {
                // Step at mobilization time
                if t < self.parameters.inspection_time + self.parameters.mobilization_time {
                    q0
                } else {
                    q_target
                }
            }
            RecoveryModel::Trigonometric => {
                // Sine-based smooth recovery
                let phase = std::f64::consts::PI * t / t_total;
                q0 + (q_target - q0) * 0.5 * (1.0 - phase.cos())
            }
        }
    }
    
    /// Get state at time t
    pub fn state_at(&self, t: f64) -> FunctionalityState {
        let functionality = self.functionality_at(t);
        
        let phase = if t <= self.parameters.inspection_time {
            RecoveryPhase::Response
        } else if t <= self.parameters.inspection_time + self.parameters.mobilization_time {
            RecoveryPhase::ShortTerm
        } else if t <= 0.5 * self.parameters.total_time {
            RecoveryPhase::Intermediate
        } else if functionality < self.target_functionality - 0.01 {
            RecoveryPhase::LongTerm
        } else {
            RecoveryPhase::Recovered
        };
        
        FunctionalityState {
            time: t,
            functionality,
            phase,
        }
    }
    
    /// Calculate resilience integral (area under recovery curve / total area)
    pub fn resilience_integral(&self, duration: f64) -> f64 {
        // Numerical integration using trapezoidal rule
        let n = 100;
        let dt = duration / n as f64;
        
        let mut area = 0.0;
        let mut prev_q = self.functionality_at(0.0);
        
        for i in 1..=n {
            let t = i as f64 * dt;
            let q = self.functionality_at(t);
            area += (prev_q + q) * dt / 2.0;
            prev_q = q;
        }
        
        // Normalize by perfect recovery area
        area / (self.target_functionality * duration)
    }
    
    /// Calculate downtime below threshold
    pub fn downtime_below(&self, threshold: f64) -> f64 {
        // Find time when functionality reaches threshold
        if self.initial_functionality >= threshold {
            return 0.0;
        }
        
        // Binary search for crossing time
        let mut low = 0.0;
        let mut high = self.parameters.total_time;
        
        while high - low > 0.01 {
            let mid = (low + high) / 2.0;
            if self.functionality_at(mid) < threshold {
                low = mid;
            } else {
                high = mid;
            }
        }
        
        (low + high) / 2.0
    }
}

/// Building recovery analyzer (REDi methodology)
#[derive(Debug, Clone)]
pub struct REDiAnalyzer;

/// REDi recovery category
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum REDiCategory {
    /// Functional recovery - building can be occupied
    Functional,
    /// Full recovery - pre-earthquake condition
    Full,
    /// Immediate occupancy
    ImmediateOccupancy,
}

/// REDi downtime components
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct REDiDowntime {
    /// Inspection delay (days)
    pub inspection_delay: f64,
    /// Engineering mobilization (days)
    pub engineering_mobilization: f64,
    /// Contractor mobilization (days)
    pub contractor_mobilization: f64,
    /// Financing delay (days)
    pub financing_delay: f64,
    /// Permitting delay (days)
    pub permitting_delay: f64,
    /// Repair time (days)
    pub repair_time: f64,
    /// Utility availability delay (days)
    pub utility_delay: f64,
    /// Total downtime (days)
    pub total_downtime: f64,
}

impl REDiAnalyzer {
    /// Estimate downtime using REDi methodology
    pub fn estimate_downtime(
        &self,
        damage_ratio: f64,
        building_height: f64,
        occupancy: OccupancyType,
        impeding_factors: &ImpedingFactors,
    ) -> REDiDowntime {
        // Base repair time from damage ratio
        let base_repair_days = self.repair_days_from_damage(damage_ratio, building_height);
        
        // Impeding factor delays
        let inspection = impeding_factors.inspection_delay;
        let engineering = if damage_ratio > 0.1 {
            impeding_factors.engineering_mobilization
        } else {
            0.0
        };
        let contractor = impeding_factors.contractor_mobilization;
        let financing = if damage_ratio > 0.2 {
            impeding_factors.financing_delay
        } else {
            0.0
        };
        let permitting = if damage_ratio > 0.15 {
            impeding_factors.permitting_delay
        } else {
            0.0
        };
        
        // Utility delay based on occupancy
        let utility = match occupancy {
            OccupancyType::Hospital | OccupancyType::EmergencyResponse => {
                impeding_factors.utility_delay * 0.5 // Priority restoration
            }
            _ => impeding_factors.utility_delay,
        };
        
        // Parallel vs serial delays
        let max_impeding = inspection
            .max(engineering)
            .max(contractor)
            .max(financing)
            .max(permitting)
            .max(utility);
        
        let total = max_impeding + base_repair_days;
        
        REDiDowntime {
            inspection_delay: inspection,
            engineering_mobilization: engineering,
            contractor_mobilization: contractor,
            financing_delay: financing,
            permitting_delay: permitting,
            repair_time: base_repair_days,
            utility_delay: utility,
            total_downtime: total,
        }
    }
    
    fn repair_days_from_damage(&self, damage_ratio: f64, building_height: f64) -> f64 {
        // Approximate repair rate: 1-2% per day for typical buildings
        let floors = (building_height / 3.5).ceil();
        let base_days = damage_ratio * 365.0; // 1 year for 100% damage
        
        // Adjust for building size (larger buildings take longer)
        base_days * (1.0 + 0.05 * floors)
    }
}

/// Occupancy type for recovery
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum OccupancyType {
    Residential,
    Commercial,
    Industrial,
    Hospital,
    School,
    EmergencyResponse,
    Infrastructure,
}

/// Impeding factors for recovery
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImpedingFactors {
    /// Post-earthquake inspection delay (days)
    pub inspection_delay: f64,
    /// Engineering/design mobilization (days)
    pub engineering_mobilization: f64,
    /// Contractor mobilization (days)
    pub contractor_mobilization: f64,
    /// Financing delay (days)
    pub financing_delay: f64,
    /// Permitting delay (days)
    pub permitting_delay: f64,
    /// Utility restoration delay (days)
    pub utility_delay: f64,
}

impl Default for ImpedingFactors {
    fn default() -> Self {
        Self {
            inspection_delay: 5.0,
            engineering_mobilization: 30.0,
            contractor_mobilization: 20.0,
            financing_delay: 60.0,
            permitting_delay: 45.0,
            utility_delay: 14.0,
        }
    }
}

/// Community resilience analyzer
#[derive(Debug, Clone)]
pub struct CommunityResilience {
    /// Building inventory
    pub buildings: Vec<CommunityBuilding>,
    /// Infrastructure systems
    pub infrastructure: Vec<InfrastructureSystem>,
}

/// Building in community inventory
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommunityBuilding {
    /// Building ID
    pub id: String,
    /// Occupancy type
    pub occupancy: OccupancyType,
    /// Building value
    pub value: f64,
    /// Population served
    pub population: u32,
    /// Recovery curve
    pub recovery_curve: Option<RecoveryCurve>,
}

/// Infrastructure system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InfrastructureSystem {
    /// System ID
    pub id: String,
    /// System type
    pub system_type: InfrastructureType,
    /// Criticality (0-1)
    pub criticality: f64,
    /// Dependent buildings
    pub dependent_buildings: Vec<String>,
    /// Recovery curve
    pub recovery_curve: Option<RecoveryCurve>,
}

/// Infrastructure system type
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum InfrastructureType {
    ElectricPower,
    Water,
    Wastewater,
    NaturalGas,
    Communications,
    Transportation,
}

impl CommunityResilience {
    /// Create new community resilience model
    pub fn new() -> Self {
        Self {
            buildings: Vec::new(),
            infrastructure: Vec::new(),
        }
    }
    
    /// Add building to inventory
    pub fn add_building(&mut self, building: CommunityBuilding) {
        self.buildings.push(building);
    }
    
    /// Add infrastructure system
    pub fn add_infrastructure(&mut self, system: InfrastructureSystem) {
        self.infrastructure.push(system);
    }
    
    /// Calculate community functionality at time t
    pub fn community_functionality_at(&self, t: f64) -> f64 {
        if self.buildings.is_empty() {
            return 1.0;
        }
        
        let mut total_value = 0.0;
        let mut weighted_functionality = 0.0;
        
        for building in &self.buildings {
            total_value += building.value;
            
            let building_func = building.recovery_curve
                .as_ref()
                .map(|rc| rc.functionality_at(t))
                .unwrap_or(1.0);
            
            // Check infrastructure dependencies
            let infra_func = self.infrastructure_functionality_for_building(&building.id, t);
            
            // Building functionality limited by infrastructure
            let actual_func = building_func.min(infra_func);
            
            weighted_functionality += actual_func * building.value;
        }
        
        if total_value > 0.0 {
            weighted_functionality / total_value
        } else {
            1.0
        }
    }
    
    fn infrastructure_functionality_for_building(&self, building_id: &str, t: f64) -> f64 {
        let mut min_func: f64 = 1.0;
        
        for system in &self.infrastructure {
            if system.dependent_buildings.contains(&building_id.to_string()) {
                let sys_func = system.recovery_curve
                    .as_ref()
                    .map(|rc| rc.functionality_at(t))
                    .unwrap_or(1.0);
                
                // Critical systems have higher impact
                let effective_func = 1.0 - system.criticality * (1.0 - sys_func);
                min_func = min_func.min(effective_func);
            }
        }
        
        min_func
    }
    
    /// Calculate community resilience metrics
    pub fn calculate_metrics(&self, duration_days: f64) -> CommunityResilienceMetrics {
        // Generate recovery curve
        let n_points: i32 = 100;
        let dt = duration_days / n_points as f64;
        
        let mut recovery_trajectory = Vec::new();
        let mut area_under_curve = 0.0;
        let mut prev_func = self.community_functionality_at(0.0);
        
        for i in 0..=n_points {
            let t = i as f64 * dt;
            let func = self.community_functionality_at(t);
            
            recovery_trajectory.push(FunctionalityState {
                time: t,
                functionality: func,
                phase: self.determine_phase(func),
            });
            
            area_under_curve += (prev_func + func) * dt / 2.0;
            prev_func = func;
        }
        
        // Find 90% recovery time
        let recovery_90 = self.time_to_functionality(0.90, duration_days);
        
        // Find 50% recovery time
        let recovery_50 = self.time_to_functionality(0.50, duration_days);
        
        // Resilience index
        let resilience_index = area_under_curve / duration_days;
        
        // Population affected
        let initial_func = self.community_functionality_at(0.0);
        let total_pop: u32 = self.buildings.iter().map(|b| b.population).sum();
        let pop_displaced = ((1.0 - initial_func) * total_pop as f64) as u32;
        
        CommunityResilienceMetrics {
            initial_functionality: initial_func,
            resilience_index,
            time_to_90_percent: recovery_90,
            time_to_50_percent: recovery_50,
            population_displaced: pop_displaced,
            recovery_trajectory,
        }
    }
    
    fn time_to_functionality(&self, target: f64, max_time: f64) -> f64 {
        // Binary search for time to reach target functionality
        let mut low = 0.0;
        let mut high = max_time;
        
        while high - low > 0.1 {
            let mid = (low + high) / 2.0;
            if self.community_functionality_at(mid) < target {
                low = mid;
            } else {
                high = mid;
            }
        }
        
        (low + high) / 2.0
    }
    
    fn determine_phase(&self, functionality: f64) -> RecoveryPhase {
        if functionality < 0.3 {
            RecoveryPhase::Response
        } else if functionality < 0.5 {
            RecoveryPhase::ShortTerm
        } else if functionality < 0.8 {
            RecoveryPhase::Intermediate
        } else if functionality < 0.95 {
            RecoveryPhase::LongTerm
        } else {
            RecoveryPhase::Recovered
        }
    }
}

/// Community resilience metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommunityResilienceMetrics {
    /// Initial functionality after event
    pub initial_functionality: f64,
    /// Resilience index (area under curve / perfect area)
    pub resilience_index: f64,
    /// Time to 90% functionality (days)
    pub time_to_90_percent: f64,
    /// Time to 50% functionality (days)
    pub time_to_50_percent: f64,
    /// Population displaced
    pub population_displaced: u32,
    /// Recovery trajectory
    pub recovery_trajectory: Vec<FunctionalityState>,
}

/// Expected annual loss calculator
#[derive(Debug, Clone)]
pub struct ExpectedAnnualLoss;

impl ExpectedAnnualLoss {
    /// Calculate EAL from loss exceedance curve
    pub fn calculate(&self, loss_curve: &[(f64, f64)]) -> f64 {
        // loss_curve: [(annual_frequency, loss)]
        // EAL = integral of lambda(L) dL
        
        if loss_curve.len() < 2 {
            return 0.0;
        }
        
        let mut eal = 0.0;
        
        for i in 1..loss_curve.len() {
            let (freq1, loss1) = loss_curve[i - 1];
            let (freq2, loss2) = loss_curve[i];
            
            // Trapezoidal integration
            let d_loss = loss2 - loss1;
            let avg_freq = (freq1 + freq2) / 2.0;
            eal += avg_freq * d_loss;
        }
        
        eal.abs()
    }
    
    /// Calculate EAL from discrete scenarios
    pub fn calculate_from_scenarios(&self, scenarios: &[LossScenario]) -> f64 {
        let mut eal = 0.0;
        
        for scenario in scenarios {
            eal += scenario.annual_frequency * scenario.expected_loss;
        }
        
        eal
    }
}

/// Loss scenario for EAL calculation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LossScenario {
    /// Scenario description
    pub description: String,
    /// Annual frequency of occurrence
    pub annual_frequency: f64,
    /// Expected loss given occurrence
    pub expected_loss: f64,
    /// Loss uncertainty (CoV)
    pub loss_cov: f64,
}

/// Resilience investment analyzer
#[derive(Debug, Clone)]
pub struct ResilienceInvestment;

impl ResilienceInvestment {
    /// Calculate benefit-cost ratio for resilience investment
    pub fn benefit_cost_ratio(
        &self,
        investment_cost: f64,
        reduced_eal: f64,
        analysis_period: f64,
        discount_rate: f64,
    ) -> f64 {
        // Present value of reduced losses
        let pv_benefits = self.present_value_annuity(reduced_eal, discount_rate, analysis_period);
        
        pv_benefits / investment_cost
    }
    
    fn present_value_annuity(&self, annual_amount: f64, rate: f64, years: f64) -> f64 {
        if rate.abs() < 0.001 {
            return annual_amount * years;
        }
        
        annual_amount * (1.0 - (1.0 + rate).powf(-years)) / rate
    }
    
    /// Recommend resilience measures
    pub fn recommend_measures(
        &self,
        _current_eal: f64,
        budget: f64,
        options: &[ResilienceOption],
    ) -> Vec<ResilienceOption> {
        // Sort by benefit-cost ratio
        let mut sorted_options: Vec<_> = options.iter()
            .map(|opt| {
                let bcr = self.benefit_cost_ratio(opt.cost, opt.eal_reduction, 50.0, 0.03);
                (opt.clone(), bcr)
            })
            .collect();
        
        sorted_options.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        
        // Greedy selection within budget
        let mut selected = Vec::new();
        let mut remaining_budget = budget;
        
        for (option, _bcr) in sorted_options {
            if option.cost <= remaining_budget {
                remaining_budget -= option.cost;
                selected.push(option);
            }
        }
        
        selected
    }
}

/// Resilience improvement option
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResilienceOption {
    /// Option description
    pub description: String,
    /// Implementation cost
    pub cost: f64,
    /// Reduction in EAL
    pub eal_reduction: f64,
    /// Improvement in resilience index
    pub resilience_improvement: f64,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_linear_recovery() {
        let curve = RecoveryCurve::new(0.5, RecoveryModel::Linear, 100.0);
        
        // At t=0, should be initial
        assert!((curve.functionality_at(0.0) - 0.5).abs() < 0.01);
        
        // At t=50 (midpoint), should be 0.75
        assert!((curve.functionality_at(50.0) - 0.75).abs() < 0.01);
        
        // At t=100, should be 1.0
        assert!((curve.functionality_at(100.0) - 1.0).abs() < 0.01);
    }
    
    #[test]
    fn test_exponential_recovery() {
        let curve = RecoveryCurve::new(0.3, RecoveryModel::Exponential, 100.0);
        
        // Should start at initial
        assert!((curve.functionality_at(0.0) - 0.3).abs() < 0.01);
        
        // Should increase monotonically
        let q1 = curve.functionality_at(25.0);
        let q2 = curve.functionality_at(50.0);
        let q3 = curve.functionality_at(75.0);
        
        assert!(q1 > 0.3);
        assert!(q2 > q1);
        assert!(q3 > q2);
        
        // Should approach target
        assert!(curve.functionality_at(100.0) > 0.95);
    }
    
    #[test]
    fn test_s_curve_recovery() {
        let curve = RecoveryCurve::new(0.2, RecoveryModel::SCurve, 100.0);
        
        // S-curve should be slow at start and end, fast in middle
        let q_early = curve.functionality_at(20.0) - curve.functionality_at(10.0);
        let q_mid = curve.functionality_at(55.0) - curve.functionality_at(45.0);
        let q_late = curve.functionality_at(90.0) - curve.functionality_at(80.0);
        
        // Mid-period should have highest rate
        assert!(q_mid > q_early);
        assert!(q_mid > q_late);
    }
    
    #[test]
    fn test_resilience_integral() {
        // Perfect recovery (instant) should have integral = 1.0
        let instant = RecoveryCurve::new(1.0, RecoveryModel::Linear, 100.0);
        assert!((instant.resilience_integral(100.0) - 1.0).abs() < 0.01);
        
        // Total loss with no recovery should be 0
        let no_recovery = RecoveryCurve::new(0.0, RecoveryModel::Linear, 100.0);
        assert!(no_recovery.resilience_integral(100.0) < 0.55); // Linear from 0 to 1 = 0.5
    }
    
    #[test]
    fn test_downtime_calculation() {
        let curve = RecoveryCurve::new(0.3, RecoveryModel::Linear, 100.0);
        
        // Time to reach 50% functionality
        let downtime = curve.downtime_below(0.5);
        
        // For linear recovery from 0.3 to 1.0 over 100 days:
        // 0.3 + (1-0.3) * t/100 = 0.5
        // t = (0.5-0.3)/(0.7) * 100 ≈ 28.6 days
        assert!(downtime > 25.0 && downtime < 35.0);
    }
    
    #[test]
    fn test_recovery_phase() {
        let curve = RecoveryCurve::new(0.2, RecoveryModel::Linear, 100.0);
        
        let state_early = curve.state_at(3.0);
        assert_eq!(state_early.phase, RecoveryPhase::Response);
        
        let state_mid = curve.state_at(50.0);
        assert_eq!(state_mid.phase, RecoveryPhase::Intermediate);
        
        let state_late = curve.state_at(100.0);
        assert_eq!(state_late.phase, RecoveryPhase::Recovered);
    }
    
    #[test]
    fn test_redi_downtime() {
        let analyzer = REDiAnalyzer;
        let factors = ImpedingFactors::default();
        
        let downtime = analyzer.estimate_downtime(
            0.15, // 15% damage
            30.0, // 30m building
            OccupancyType::Commercial,
            &factors,
        );
        
        assert!(downtime.total_downtime > 0.0);
        assert!(downtime.repair_time > 0.0);
        
        // Hospital should have faster utility restoration
        let hospital_downtime = analyzer.estimate_downtime(
            0.15,
            30.0,
            OccupancyType::Hospital,
            &factors,
        );
        
        assert!(hospital_downtime.utility_delay < downtime.utility_delay);
    }
    
    #[test]
    fn test_community_resilience() {
        let mut community = CommunityResilience::new();
        
        community.add_building(CommunityBuilding {
            id: "B1".to_string(),
            occupancy: OccupancyType::Residential,
            value: 1_000_000.0,
            population: 100,
            recovery_curve: Some(RecoveryCurve::new(0.5, RecoveryModel::Linear, 60.0)),
        });
        
        community.add_building(CommunityBuilding {
            id: "B2".to_string(),
            occupancy: OccupancyType::Commercial,
            value: 2_000_000.0,
            population: 50,
            recovery_curve: Some(RecoveryCurve::new(0.3, RecoveryModel::Linear, 90.0)),
        });
        
        // Initial functionality should be weighted average
        let initial = community.community_functionality_at(0.0);
        // (0.5*1M + 0.3*2M) / 3M = (0.5M + 0.6M) / 3M = 0.367
        assert!(initial > 0.3 && initial < 0.5);
        
        // Should increase over time
        let mid = community.community_functionality_at(45.0);
        let final_func = community.community_functionality_at(100.0);
        
        assert!(mid > initial);
        assert!(final_func > mid);
    }
    
    #[test]
    fn test_infrastructure_dependency() {
        let mut community = CommunityResilience::new();
        
        community.add_building(CommunityBuilding {
            id: "B1".to_string(),
            occupancy: OccupancyType::Residential,
            value: 1_000_000.0,
            population: 100,
            recovery_curve: Some(RecoveryCurve::new(0.8, RecoveryModel::Linear, 30.0)),
        });
        
        community.add_infrastructure(InfrastructureSystem {
            id: "Power".to_string(),
            system_type: InfrastructureType::ElectricPower,
            criticality: 0.9,
            dependent_buildings: vec!["B1".to_string()],
            recovery_curve: Some(RecoveryCurve::new(0.2, RecoveryModel::Linear, 14.0)),
        });
        
        // Building functionality should be limited by power
        let func = community.community_functionality_at(0.0);
        assert!(func < 0.8); // Limited by power outage
    }
    
    #[test]
    fn test_expected_annual_loss() {
        let eal_calc = ExpectedAnnualLoss;
        
        let scenarios = vec![
            LossScenario {
                description: "Small event".to_string(),
                annual_frequency: 0.1,
                expected_loss: 100_000.0,
                loss_cov: 0.3,
            },
            LossScenario {
                description: "Large event".to_string(),
                annual_frequency: 0.01,
                expected_loss: 1_000_000.0,
                loss_cov: 0.5,
            },
        ];
        
        let eal = eal_calc.calculate_from_scenarios(&scenarios);
        
        // EAL = 0.1 * 100k + 0.01 * 1M = 10k + 10k = 20k
        assert!((eal - 20_000.0).abs() < 100.0);
    }
    
    #[test]
    fn test_resilience_investment() {
        let investment = ResilienceInvestment;
        
        let bcr = investment.benefit_cost_ratio(
            100_000.0,  // Investment cost
            5_000.0,    // Annual EAL reduction
            50.0,       // 50 year period
            0.03,       // 3% discount rate
        );
        
        // BCR should be reasonable
        assert!(bcr > 0.5);
        assert!(bcr < 10.0);
    }
    
    #[test]
    fn test_community_metrics() {
        let mut community = CommunityResilience::new();
        
        community.add_building(CommunityBuilding {
            id: "B1".to_string(),
            occupancy: OccupancyType::Residential,
            value: 1_000_000.0,
            population: 100,
            recovery_curve: Some(RecoveryCurve::new(0.4, RecoveryModel::Linear, 60.0)),
        });
        
        let metrics = community.calculate_metrics(90.0);
        
        assert!(metrics.initial_functionality < 0.5);
        assert!(metrics.resilience_index > 0.5);
        assert!(metrics.time_to_90_percent > 0.0);
        assert!(metrics.population_displaced > 0);
    }
}
