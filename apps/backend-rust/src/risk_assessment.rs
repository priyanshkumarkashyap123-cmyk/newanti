//! Risk Assessment Module
//! 
//! Comprehensive risk engineering for:
//! - Failure Mode and Effects Analysis (FMEA)
//! - Fault Tree Analysis (FTA)
//! - Event Tree Analysis (ETA)
//! - Risk matrices and quantification
//! 
//! Standards: ISO 31000, IEC 31010, AS/NZS 4360

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Risk consequence severity
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum Severity {
    /// Negligible - No significant impact
    Negligible = 1,
    /// Minor - Small impact, easily recoverable
    Minor = 2,
    /// Moderate - Noticeable impact, recoverable
    Moderate = 3,
    /// Major - Significant impact, difficult recovery
    Major = 4,
    /// Catastrophic - Severe impact, potential loss of life
    Catastrophic = 5,
}

/// Risk likelihood/probability
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum Likelihood {
    /// Rare - Highly unlikely (< 1%)
    Rare = 1,
    /// Unlikely - Not expected (1-10%)
    Unlikely = 2,
    /// Possible - Could occur (10-50%)
    Possible = 3,
    /// Likely - Expected to occur (50-90%)
    Likely = 4,
    /// AlmostCertain - Will occur (> 90%)
    AlmostCertain = 5,
}

/// Risk level (combination of severity and likelihood)
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum RiskLevel {
    /// Low risk - Acceptable
    Low,
    /// Medium risk - Monitor and manage
    Medium,
    /// High risk - Requires mitigation
    High,
    /// Extreme risk - Unacceptable, immediate action
    Extreme,
}

/// Risk matrix evaluator
#[derive(Debug, Clone)]
pub struct RiskMatrix {
    /// Risk matrix values (severity x likelihood -> risk level)
    matrix: [[RiskLevel; 5]; 5],
}

impl Default for RiskMatrix {
    fn default() -> Self {
        use RiskLevel::*;
        Self {
            // Standard 5x5 risk matrix
            // Rows: Severity (Negligible to Catastrophic)
            // Cols: Likelihood (Rare to AlmostCertain)
            matrix: [
                [Low, Low, Low, Medium, Medium],           // Negligible
                [Low, Low, Medium, Medium, High],          // Minor
                [Low, Medium, Medium, High, High],         // Moderate
                [Medium, Medium, High, High, Extreme],     // Major
                [Medium, High, High, Extreme, Extreme],    // Catastrophic
            ],
        }
    }
}

impl RiskMatrix {
    /// Evaluate risk level
    pub fn evaluate(&self, severity: Severity, likelihood: Likelihood) -> RiskLevel {
        let s = (severity as usize) - 1;
        let l = (likelihood as usize) - 1;
        self.matrix[s][l]
    }
    
    /// Get risk score (numeric)
    pub fn score(&self, severity: Severity, likelihood: Likelihood) -> u32 {
        (severity as u32) * (likelihood as u32)
    }
}

/// Identified hazard
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hazard {
    /// Unique identifier
    pub id: String,
    /// Hazard description
    pub description: String,
    /// Category
    pub category: HazardCategory,
    /// Potential causes
    pub causes: Vec<String>,
    /// Potential consequences
    pub consequences: Vec<String>,
    /// Existing controls
    pub existing_controls: Vec<String>,
}

/// Hazard category
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum HazardCategory {
    /// Structural failure
    Structural,
    /// Geotechnical failure
    Geotechnical,
    /// Construction accident
    Construction,
    /// Natural hazard
    Natural,
    /// Operational failure
    Operational,
    /// Environmental impact
    Environmental,
}

/// Risk assessment result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskAssessment {
    /// Hazard being assessed
    pub hazard: Hazard,
    /// Inherent severity (without controls)
    pub inherent_severity: Severity,
    /// Inherent likelihood (without controls)
    pub inherent_likelihood: Likelihood,
    /// Inherent risk level
    pub inherent_risk: RiskLevel,
    /// Inherent risk score
    pub inherent_score: u32,
    /// Residual severity (with controls)
    pub residual_severity: Severity,
    /// Residual likelihood (with controls)
    pub residual_likelihood: Likelihood,
    /// Residual risk level
    pub residual_risk: RiskLevel,
    /// Residual risk score
    pub residual_score: u32,
    /// Recommended mitigations
    pub mitigations: Vec<Mitigation>,
}

/// Risk mitigation measure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Mitigation {
    /// Description of mitigation
    pub description: String,
    /// Mitigation type
    pub mitigation_type: MitigationType,
    /// Estimated effectiveness (0-1)
    pub effectiveness: f64,
    /// Implementation cost estimate
    pub cost_estimate: Option<f64>,
    /// Priority
    pub priority: MitigationPriority,
}

/// Mitigation type (hierarchy of controls)
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum MitigationType {
    /// Eliminate the hazard
    Elimination,
    /// Substitute with less hazardous
    Substitution,
    /// Engineering controls
    Engineering,
    /// Administrative controls
    Administrative,
    /// Personal protective equipment
    PPE,
}

/// Mitigation priority
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum MitigationPriority {
    Critical,
    High,
    Medium,
    Low,
}

/// FMEA (Failure Mode and Effects Analysis)
#[derive(Debug, Clone)]
pub struct FMEAAnalyzer;

/// FMEA Item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FMEAItem {
    /// Component/function
    pub component: String,
    /// Potential failure mode
    pub failure_mode: String,
    /// Potential effects
    pub effects: String,
    /// Severity (1-10)
    pub severity: u8,
    /// Potential causes
    pub causes: String,
    /// Occurrence (1-10)
    pub occurrence: u8,
    /// Current controls
    pub controls: String,
    /// Detection (1-10)
    pub detection: u8,
    /// Risk Priority Number
    pub rpn: u32,
    /// Recommended actions
    pub actions: Vec<String>,
}

impl FMEAAnalyzer {
    /// Calculate Risk Priority Number
    pub fn calculate_rpn(severity: u8, occurrence: u8, detection: u8) -> u32 {
        (severity as u32) * (occurrence as u32) * (detection as u32)
    }
    
    /// Analyze component
    pub fn analyze(&self, item: &mut FMEAItem) {
        item.rpn = Self::calculate_rpn(item.severity, item.occurrence, item.detection);
        
        // Generate recommended actions based on RPN and factors
        if item.rpn > 200 {
            item.actions.push("Critical: Immediate design review required".to_string());
        }
        
        if item.severity >= 8 {
            item.actions.push("Design change to reduce severity".to_string());
        }
        
        if item.occurrence >= 7 {
            item.actions.push("Process improvement to reduce occurrence".to_string());
        }
        
        if item.detection >= 7 {
            item.actions.push("Improve detection methods/testing".to_string());
        }
    }
    
    /// Rank FMEA items by RPN
    pub fn rank_by_rpn(items: &mut [FMEAItem]) {
        items.sort_by(|a, b| b.rpn.cmp(&a.rpn));
    }
}

/// FMEA Result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FMEAResult {
    /// All analyzed items
    pub items: Vec<FMEAItem>,
    /// Items with RPN > threshold requiring action
    pub critical_items: Vec<FMEAItem>,
    /// Total RPN
    pub total_rpn: u32,
    /// Average RPN
    pub average_rpn: f64,
    /// Maximum RPN
    pub max_rpn: u32,
}

/// Fault Tree Analysis
#[derive(Debug, Clone)]
pub struct FaultTreeAnalyzer;

/// Fault tree gate type
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum GateType {
    /// AND gate - all inputs must occur
    And,
    /// OR gate - any input causes output
    Or,
    /// K-out-of-N gate
    KofN { k: usize, n: usize },
}

/// Fault tree node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FaultTreeNode {
    /// Node identifier
    pub id: String,
    /// Node description
    pub description: String,
    /// Node type
    pub node_type: FaultTreeNodeType,
    /// Probability (for basic events)
    pub probability: Option<f64>,
    /// Child nodes
    pub children: Vec<String>,
}

/// Node type in fault tree
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum FaultTreeNodeType {
    /// Top event (system failure)
    TopEvent,
    /// Intermediate event (gate output)
    Intermediate { gate: GateType },
    /// Basic event (failure probability known)
    Basic,
    /// Undeveloped event
    Undeveloped,
    /// House event (always true/false)
    House { state: bool },
}

impl FaultTreeAnalyzer {
    /// Calculate top event probability
    pub fn calculate_probability(&self, nodes: &HashMap<String, FaultTreeNode>, top_id: &str) -> f64 {
        self.calc_node_prob(nodes, top_id)
    }
    
    fn calc_node_prob(&self, nodes: &HashMap<String, FaultTreeNode>, node_id: &str) -> f64 {
        let node = match nodes.get(node_id) {
            Some(n) => n,
            None => return 0.0,
        };
        
        match &node.node_type {
            FaultTreeNodeType::Basic => node.probability.unwrap_or(0.0),
            FaultTreeNodeType::House { state } => if *state { 1.0 } else { 0.0 },
            FaultTreeNodeType::Undeveloped => node.probability.unwrap_or(0.01),
            FaultTreeNodeType::TopEvent | FaultTreeNodeType::Intermediate { .. } => {
                if node.children.is_empty() {
                    return 0.0;
                }
                
                let child_probs: Vec<f64> = node.children
                    .iter()
                    .map(|id| self.calc_node_prob(nodes, id))
                    .collect();
                
                match &node.node_type {
                    FaultTreeNodeType::Intermediate { .. } | 
                    FaultTreeNodeType::TopEvent => {
                        let gate = match &node.node_type {
                            FaultTreeNodeType::Intermediate { gate } => gate,
                            _ => &GateType::Or, // Default for top event
                        };
                        
                        match gate {
                            GateType::And => {
                                // P(A ∩ B) = P(A) * P(B) for independent events
                                child_probs.iter().product()
                            }
                            GateType::Or => {
                                // P(A ∪ B) = 1 - (1-P(A))*(1-P(B)) for independent events
                                1.0 - child_probs.iter().map(|p| 1.0 - p).product::<f64>()
                            }
                            GateType::KofN { k, n: _ } => {
                                // Simplified: use binomial approximation
                                self.k_of_n_probability(&child_probs, *k)
                            }
                        }
                    }
                    _ => 0.0,
                }
            }
        }
    }
    
    fn k_of_n_probability(&self, probs: &[f64], k: usize) -> f64 {
        // Sum of all k-combinations' products
        // Simplified: assumes equal probabilities
        if probs.is_empty() || k > probs.len() {
            return 0.0;
        }
        
        let n = probs.len();
        let avg_p = probs.iter().sum::<f64>() / n as f64;
        
        // Binomial approximation
        let mut prob = 0.0;
        for i in k..=n {
            let combinations = self.binomial_coeff(n, i);
            prob += combinations as f64 * avg_p.powi(i as i32) * (1.0 - avg_p).powi((n - i) as i32);
        }
        prob
    }
    
    fn binomial_coeff(&self, n: usize, k: usize) -> usize {
        if k > n {
            return 0;
        }
        let mut result = 1;
        for i in 0..k {
            result = result * (n - i) / (i + 1);
        }
        result
    }
    
    /// Find minimal cut sets
    pub fn find_minimal_cut_sets(&self, nodes: &HashMap<String, FaultTreeNode>, top_id: &str) -> Vec<Vec<String>> {
        let mut cut_sets = Vec::new();
        self.find_cut_sets(nodes, top_id, &mut vec![], &mut cut_sets);
        
        // Minimize cut sets
        self.minimize_cut_sets(&mut cut_sets);
        cut_sets
    }
    
    fn find_cut_sets(
        &self,
        nodes: &HashMap<String, FaultTreeNode>,
        node_id: &str,
        current: &mut Vec<String>,
        result: &mut Vec<Vec<String>>,
    ) {
        let node = match nodes.get(node_id) {
            Some(n) => n,
            None => return,
        };
        
        match &node.node_type {
            FaultTreeNodeType::Basic | FaultTreeNodeType::Undeveloped => {
                current.push(node_id.to_string());
                result.push(current.clone());
                current.pop();
            }
            FaultTreeNodeType::House { state } => {
                if *state {
                    result.push(current.clone());
                }
            }
            FaultTreeNodeType::TopEvent | FaultTreeNodeType::Intermediate { .. } => {
                let gate = match &node.node_type {
                    FaultTreeNodeType::Intermediate { gate } => gate.clone(),
                    _ => GateType::Or,
                };
                
                match gate {
                    GateType::Or => {
                        // OR: any child failing causes failure
                        for child in &node.children {
                            self.find_cut_sets(nodes, child, current, result);
                        }
                    }
                    GateType::And => {
                        // AND: all children must fail
                        let mut combined_sets: Vec<Vec<String>> = vec![vec![]];
                        
                        for child in &node.children {
                            let mut child_sets = Vec::new();
                            self.find_cut_sets(nodes, child, &mut vec![], &mut child_sets);
                            
                            // Combine with existing sets
                            let mut new_combined = Vec::new();
                            for existing in &combined_sets {
                                for child_set in &child_sets {
                                    let mut merged = existing.clone();
                                    merged.extend(child_set.iter().cloned());
                                    new_combined.push(merged);
                                }
                            }
                            combined_sets = new_combined;
                        }
                        
                        for mut set in combined_sets {
                            set.sort();
                            set.dedup();
                            let mut full_set = current.clone();
                            full_set.extend(set);
                            result.push(full_set);
                        }
                    }
                    GateType::KofN { k, .. } => {
                        // Simplified: treat as AND of first k children
                        let children: Vec<_> = node.children.iter().take(k).cloned().collect();
                        for child in children {
                            self.find_cut_sets(nodes, &child, current, result);
                        }
                    }
                }
            }
        }
    }
    
    fn minimize_cut_sets(&self, cut_sets: &mut Vec<Vec<String>>) {
        // Remove supersets
        cut_sets.sort_by_key(|s| s.len());
        
        let mut minimal = Vec::new();
        for set in cut_sets.iter() {
            let is_superset = minimal.iter().any(|m: &Vec<String>| {
                m.iter().all(|item| set.contains(item))
            });
            
            if !is_superset {
                minimal.push(set.clone());
            }
        }
        
        *cut_sets = minimal;
    }
}

/// Fault Tree Analysis Result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FaultTreeResult {
    /// Top event probability
    pub top_probability: f64,
    /// Minimal cut sets
    pub minimal_cut_sets: Vec<Vec<String>>,
    /// Importance measures
    pub importance_measures: HashMap<String, ImportanceMeasures>,
}

/// Importance measures for basic events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportanceMeasures {
    /// Birnbaum importance
    pub birnbaum: f64,
    /// Fussell-Vesely importance
    pub fussell_vesely: f64,
    /// Risk Achievement Worth
    pub raw: f64,
    /// Risk Reduction Worth
    pub rrw: f64,
}

/// Event Tree Analyzer
#[derive(Debug, Clone)]
pub struct EventTreeAnalyzer;

/// Event tree branch
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventTreeBranch {
    /// Branch name
    pub name: String,
    /// Success probability
    pub success_prob: f64,
    /// Failure probability (1 - success_prob)
    pub failure_prob: f64,
}

/// Event tree sequence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventTreeSequence {
    /// Sequence identifier
    pub id: String,
    /// Branch outcomes (true = success)
    pub outcomes: Vec<bool>,
    /// Sequence probability
    pub probability: f64,
    /// Consequence category
    pub consequence: String,
    /// End state
    pub end_state: EndState,
}

/// End state classification
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum EndState {
    /// Safe state
    Safe,
    /// Minor damage
    MinorDamage,
    /// Major damage
    MajorDamage,
    /// Collapse/catastrophic
    Collapse,
}

impl EventTreeAnalyzer {
    /// Analyze event tree
    pub fn analyze(
        &self,
        initiating_event_prob: f64,
        branches: &[EventTreeBranch],
    ) -> EventTreeResult {
        let num_branches = branches.len();
        let num_sequences = 2_usize.pow(num_branches as u32);
        
        let mut sequences = Vec::new();
        
        for i in 0..num_sequences {
            let outcomes: Vec<bool> = (0..num_branches)
                .map(|j| (i >> j) & 1 == 0) // 0 = success, 1 = failure
                .collect();
            
            // Calculate sequence probability
            let mut prob = initiating_event_prob;
            for (j, &success) in outcomes.iter().enumerate() {
                prob *= if success {
                    branches[j].success_prob
                } else {
                    branches[j].failure_prob
                };
            }
            
            // Determine end state based on number of failures
            let num_failures = outcomes.iter().filter(|&&o| !o).count();
            let end_state = match num_failures {
                0 => EndState::Safe,
                1 => EndState::MinorDamage,
                2 => EndState::MajorDamage,
                _ => EndState::Collapse,
            };
            
            let consequence = match end_state {
                EndState::Safe => "Safe shutdown".to_string(),
                EndState::MinorDamage => "Minor structural damage".to_string(),
                EndState::MajorDamage => "Major structural damage".to_string(),
                EndState::Collapse => "Structural collapse".to_string(),
            };
            
            sequences.push(EventTreeSequence {
                id: format!("SEQ-{:0width$b}", i, width = num_branches),
                outcomes,
                probability: prob,
                consequence,
                end_state,
            });
        }
        
        // Calculate frequencies by end state
        let mut end_state_frequencies = HashMap::new();
        for seq in &sequences {
            *end_state_frequencies.entry(seq.end_state).or_insert(0.0) += seq.probability;
        }
        
        let total_probability: f64 = sequences.iter().map(|s| s.probability).sum();
        
        EventTreeResult {
            initiating_event_prob,
            sequences,
            end_state_frequencies,
            total_probability,
        }
    }
}

/// Event Tree Result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventTreeResult {
    /// Initiating event probability
    pub initiating_event_prob: f64,
    /// All sequences
    pub sequences: Vec<EventTreeSequence>,
    /// Frequency by end state
    pub end_state_frequencies: HashMap<EndState, f64>,
    /// Total probability (should equal initiating event prob)
    pub total_probability: f64,
}

/// Quantitative Risk Assessment
#[derive(Debug, Clone)]
pub struct QRA {
    /// Risk tolerance criteria
    pub tolerability: RiskTolerability,
}

/// Risk tolerability criteria
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskTolerability {
    /// Intolerable individual risk (per year)
    pub intolerable_individual: f64,
    /// Tolerable individual risk (per year)
    pub tolerable_individual: f64,
    /// ALARP upper bound
    pub alarp_upper: f64,
    /// ALARP lower bound
    pub alarp_lower: f64,
}

impl Default for RiskTolerability {
    fn default() -> Self {
        Self {
            intolerable_individual: 1e-4,  // 10^-4 per year
            tolerable_individual: 1e-6,    // 10^-6 per year
            alarp_upper: 1e-4,
            alarp_lower: 1e-6,
        }
    }
}

impl QRA {
    /// Create new QRA with default tolerability
    pub fn new() -> Self {
        Self {
            tolerability: RiskTolerability::default(),
        }
    }
    
    /// Assess individual risk
    pub fn assess_individual_risk(&self, annual_fatality_prob: f64) -> RiskRegion {
        if annual_fatality_prob > self.tolerability.intolerable_individual {
            RiskRegion::Intolerable
        } else if annual_fatality_prob > self.tolerability.alarp_lower {
            RiskRegion::ALARP
        } else {
            RiskRegion::Acceptable
        }
    }
    
    /// Calculate societal risk (F-N curve point)
    pub fn societal_risk_point(&self, frequency: f64, fatalities: u32) -> FNPoint {
        FNPoint {
            n: fatalities,
            f: frequency,
            fn_value: frequency * (fatalities as f64),
        }
    }
    
    /// Check F-N criterion
    pub fn check_fn_criterion(&self, points: &[FNPoint]) -> FNCriterionResult {
        // Typical F-N criterion: F < k/N^a where a ≈ 1-2, k ≈ 0.1-0.01
        let a = 1.5; // Risk aversion factor
        let k = 0.1; // Anchor point
        
        let mut violations = Vec::new();
        
        for point in points {
            let criterion_f = k / (point.n as f64).powf(a);
            if point.f > criterion_f {
                violations.push(point.clone());
            }
        }
        
        FNCriterionResult {
            compliant: violations.is_empty(),
            violations,
            anchor_k: k,
            aversion_a: a,
        }
    }
}

/// Risk region
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum RiskRegion {
    /// Risk is acceptable without further action
    Acceptable,
    /// As Low As Reasonably Practicable
    ALARP,
    /// Risk is intolerable
    Intolerable,
}

/// F-N curve point
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FNPoint {
    /// Number of fatalities
    pub n: u32,
    /// Frequency (per year)
    pub f: f64,
    /// F×N value
    pub fn_value: f64,
}

/// F-N criterion result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FNCriterionResult {
    /// Is compliant with criterion
    pub compliant: bool,
    /// Points violating criterion
    pub violations: Vec<FNPoint>,
    /// Anchor point k
    pub anchor_k: f64,
    /// Aversion factor a
    pub aversion_a: f64,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_risk_matrix() {
        let matrix = RiskMatrix::default();
        
        // Low severity, low likelihood = Low risk
        assert_eq!(matrix.evaluate(Severity::Negligible, Likelihood::Rare), RiskLevel::Low);
        
        // High severity, high likelihood = Extreme risk
        assert_eq!(matrix.evaluate(Severity::Catastrophic, Likelihood::AlmostCertain), RiskLevel::Extreme);
        
        // Score calculation
        assert_eq!(matrix.score(Severity::Major, Likelihood::Possible), 4 * 3);
    }
    
    #[test]
    fn test_fmea_rpn() {
        let rpn = FMEAAnalyzer::calculate_rpn(8, 5, 4);
        assert_eq!(rpn, 160);
        
        // Max RPN
        let max_rpn = FMEAAnalyzer::calculate_rpn(10, 10, 10);
        assert_eq!(max_rpn, 1000);
    }
    
    #[test]
    fn test_fmea_analysis() {
        let analyzer = FMEAAnalyzer;
        
        let mut item = FMEAItem {
            component: "Beam-Column Connection".to_string(),
            failure_mode: "Weld fracture".to_string(),
            effects: "Loss of moment capacity".to_string(),
            severity: 9,
            causes: "Poor weld quality".to_string(),
            occurrence: 4,
            controls: "Visual inspection".to_string(),
            detection: 6,
            rpn: 0,
            actions: vec![],
        };
        
        analyzer.analyze(&mut item);
        
        assert_eq!(item.rpn, 9 * 4 * 6);
        assert!(item.rpn > 200); // Should trigger critical action
        assert!(!item.actions.is_empty());
    }
    
    #[test]
    fn test_fault_tree_or_gate() {
        let analyzer = FaultTreeAnalyzer;
        
        let mut nodes = HashMap::new();
        
        nodes.insert("TOP".to_string(), FaultTreeNode {
            id: "TOP".to_string(),
            description: "System Failure".to_string(),
            node_type: FaultTreeNodeType::Intermediate { gate: GateType::Or },
            probability: None,
            children: vec!["A".to_string(), "B".to_string()],
        });
        
        nodes.insert("A".to_string(), FaultTreeNode {
            id: "A".to_string(),
            description: "Event A".to_string(),
            node_type: FaultTreeNodeType::Basic,
            probability: Some(0.1),
            children: vec![],
        });
        
        nodes.insert("B".to_string(), FaultTreeNode {
            id: "B".to_string(),
            description: "Event B".to_string(),
            node_type: FaultTreeNodeType::Basic,
            probability: Some(0.2),
            children: vec![],
        });
        
        let prob = analyzer.calculate_probability(&nodes, "TOP");
        // P(A ∪ B) = 1 - (1-0.1)(1-0.2) = 1 - 0.72 = 0.28
        assert!((prob - 0.28).abs() < 0.01);
    }
    
    #[test]
    fn test_fault_tree_and_gate() {
        let analyzer = FaultTreeAnalyzer;
        
        let mut nodes = HashMap::new();
        
        nodes.insert("TOP".to_string(), FaultTreeNode {
            id: "TOP".to_string(),
            description: "System Failure".to_string(),
            node_type: FaultTreeNodeType::Intermediate { gate: GateType::And },
            probability: None,
            children: vec!["A".to_string(), "B".to_string()],
        });
        
        nodes.insert("A".to_string(), FaultTreeNode {
            id: "A".to_string(),
            description: "Event A".to_string(),
            node_type: FaultTreeNodeType::Basic,
            probability: Some(0.1),
            children: vec![],
        });
        
        nodes.insert("B".to_string(), FaultTreeNode {
            id: "B".to_string(),
            description: "Event B".to_string(),
            node_type: FaultTreeNodeType::Basic,
            probability: Some(0.2),
            children: vec![],
        });
        
        let prob = analyzer.calculate_probability(&nodes, "TOP");
        // P(A ∩ B) = 0.1 * 0.2 = 0.02
        assert!((prob - 0.02).abs() < 0.01);
    }
    
    #[test]
    fn test_minimal_cut_sets() {
        let analyzer = FaultTreeAnalyzer;
        
        let mut nodes = HashMap::new();
        
        // TOP = A OR B (parallel redundancy)
        nodes.insert("TOP".to_string(), FaultTreeNode {
            id: "TOP".to_string(),
            description: "System Failure".to_string(),
            node_type: FaultTreeNodeType::Intermediate { gate: GateType::Or },
            probability: None,
            children: vec!["A".to_string(), "B".to_string()],
        });
        
        nodes.insert("A".to_string(), FaultTreeNode {
            id: "A".to_string(),
            description: "Event A".to_string(),
            node_type: FaultTreeNodeType::Basic,
            probability: Some(0.1),
            children: vec![],
        });
        
        nodes.insert("B".to_string(), FaultTreeNode {
            id: "B".to_string(),
            description: "Event B".to_string(),
            node_type: FaultTreeNodeType::Basic,
            probability: Some(0.2),
            children: vec![],
        });
        
        let cut_sets = analyzer.find_minimal_cut_sets(&nodes, "TOP");
        
        // Should have two single-element cut sets
        assert_eq!(cut_sets.len(), 2);
    }
    
    #[test]
    fn test_event_tree() {
        let analyzer = EventTreeAnalyzer;
        
        let branches = vec![
            EventTreeBranch {
                name: "Detection".to_string(),
                success_prob: 0.9,
                failure_prob: 0.1,
            },
            EventTreeBranch {
                name: "Mitigation".to_string(),
                success_prob: 0.8,
                failure_prob: 0.2,
            },
        ];
        
        let result = analyzer.analyze(0.01, &branches);
        
        // Should have 2^2 = 4 sequences
        assert_eq!(result.sequences.len(), 4);
        
        // Total probability should equal initiating event
        assert!((result.total_probability - 0.01).abs() < 0.0001);
    }
    
    #[test]
    fn test_qra_individual_risk() {
        let qra = QRA::new();
        
        assert_eq!(qra.assess_individual_risk(1e-3), RiskRegion::Intolerable);
        assert_eq!(qra.assess_individual_risk(1e-5), RiskRegion::ALARP);
        assert_eq!(qra.assess_individual_risk(1e-7), RiskRegion::Acceptable);
    }
    
    #[test]
    fn test_fn_criterion() {
        let qra = QRA::new();
        
        let points = vec![
            qra.societal_risk_point(1e-4, 10),
            qra.societal_risk_point(1e-5, 100),
        ];
        
        let result = qra.check_fn_criterion(&points);
        
        // Should have result (compliance depends on criterion)
        assert!(result.anchor_k > 0.0);
        assert!(result.aversion_a > 0.0);
    }
    
    #[test]
    fn test_mitigation_types() {
        // Hierarchy of controls
        let mitigations = vec![
            MitigationType::Elimination,
            MitigationType::Substitution,
            MitigationType::Engineering,
            MitigationType::Administrative,
            MitigationType::PPE,
        ];
        
        // Elimination should be most effective
        assert_eq!(mitigations[0], MitigationType::Elimination);
    }
    
    #[test]
    fn test_hazard_categories() {
        let hazard = Hazard {
            id: "H001".to_string(),
            description: "Foundation settlement".to_string(),
            category: HazardCategory::Geotechnical,
            causes: vec!["Poor soil investigation".to_string()],
            consequences: vec!["Building tilt".to_string()],
            existing_controls: vec!["Site investigation".to_string()],
        };
        
        assert_eq!(hazard.category, HazardCategory::Geotechnical);
    }
    
    #[test]
    fn test_risk_assessment() {
        let matrix = RiskMatrix::default();
        
        let hazard = Hazard {
            id: "H001".to_string(),
            description: "Column buckling".to_string(),
            category: HazardCategory::Structural,
            causes: vec!["Overload".to_string()],
            consequences: vec!["Progressive collapse".to_string()],
            existing_controls: vec!["Design code compliance".to_string()],
        };
        
        let assessment = RiskAssessment {
            hazard,
            inherent_severity: Severity::Catastrophic,
            inherent_likelihood: Likelihood::Unlikely,
            inherent_risk: matrix.evaluate(Severity::Catastrophic, Likelihood::Unlikely),
            inherent_score: matrix.score(Severity::Catastrophic, Likelihood::Unlikely),
            residual_severity: Severity::Catastrophic,
            residual_likelihood: Likelihood::Rare,
            residual_risk: matrix.evaluate(Severity::Catastrophic, Likelihood::Rare),
            residual_score: matrix.score(Severity::Catastrophic, Likelihood::Rare),
            mitigations: vec![],
        };
        
        // Residual risk should be lower than inherent
        assert!(assessment.residual_score < assessment.inherent_score);
    }
}
