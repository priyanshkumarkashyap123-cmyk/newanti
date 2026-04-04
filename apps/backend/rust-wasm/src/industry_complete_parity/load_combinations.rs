use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CombinationEvaluationResult {
    pub passed: bool,
    pub utilization: f64,
    pub message: String,
    pub clause: String,
    pub combined_factor: f64,
}

/// Automatic Load Combination Generator
/// Industry standard: SAP2000, ETABS, STAAD.Pro
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadCombinationGenerator {
    pub design_code: DesignCode,
    pub load_cases: Vec<LoadCase>,
    pub combinations: Vec<LoadCombination>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum DesignCode {
    IS456,      // Indian Standard concrete
    IS800,      // Indian Standard steel
    ACI318,     // ACI concrete
    AISC360,    // AISC steel
    EN1992,     // Eurocode 2 (concrete)
    EN1993,     // Eurocode 3 (steel)
    ASCE7,      // ASCE 7 load combinations
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadCase {
    pub id: String,
    pub name: String,
    pub load_type: LoadType,
    pub self_weight_factor: f64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum LoadType {
    Dead,
    SuperDead,  // Superimposed dead
    Live,
    LiveRoof,
    Snow,
    Wind,
    Seismic,
    Temperature,
    Settlement,
    Pattern,
    Notional,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadCombination {
    pub id: String,
    pub name: String,
    pub combination_type: CombinationType,
    pub factors: Vec<(String, f64)>,  // (load_case_id, factor)
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum CombinationType {
    Strength,      // Ultimate limit state
    Service,       // Serviceability limit state
    Envelope,      // Envelope of multiple combinations
}

impl LoadCombinationGenerator {
    pub fn new(design_code: DesignCode) -> Self {
        LoadCombinationGenerator {
            design_code,
            load_cases: Vec::new(),
            combinations: Vec::new(),
        }
    }
    
    pub fn add_load_case(&mut self, id: &str, name: &str, load_type: LoadType) {
        self.load_cases.push(LoadCase {
            id: id.to_string(),
            name: name.to_string(),
            load_type,
            self_weight_factor: if load_type == LoadType::Dead { 1.0 } else { 0.0 },
        });
    }
    
    /// Generate all code-required combinations
    pub fn generate_combinations(&mut self) {
        self.combinations.clear();
        
        match self.design_code {
            DesignCode::IS456 | DesignCode::IS800 => self.generate_is_combinations(),
            DesignCode::ACI318 | DesignCode::AISC360 | DesignCode::ASCE7 => {
                self.generate_asce7_combinations()
            }
            DesignCode::EN1992 | DesignCode::EN1993 => self.generate_eurocode_combinations(),
        }
    }
    
    fn generate_is_combinations(&mut self) {
        // IS 456:2000 / IS 800:2007 load combinations
        let dl = self.find_load_case(LoadType::Dead);
        let ll = self.find_load_case(LoadType::Live);
        let wl = self.find_load_case(LoadType::Wind);
        let eq = self.find_load_case(LoadType::Seismic);
        
        // 1.5(DL + LL)
        if let (Some(d), Some(l)) = (&dl, &ll) {
            self.combinations.push(LoadCombination {
                id: "COMB1".to_string(),
                name: "1.5(DL + LL)".to_string(),
                combination_type: CombinationType::Strength,
                factors: vec![(d.clone(), 1.5), (l.clone(), 1.5)],
            });
        }
        
        // 1.2(DL + LL ± WL)
        if let (Some(d), Some(l), Some(w)) = (&dl, &ll, &wl) {
            self.combinations.push(LoadCombination {
                id: "COMB2a".to_string(),
                name: "1.2(DL + LL + WL)".to_string(),
                combination_type: CombinationType::Strength,
                factors: vec![(d.clone(), 1.2), (l.clone(), 1.2), (w.clone(), 1.2)],
            });
            self.combinations.push(LoadCombination {
                id: "COMB2b".to_string(),
                name: "1.2(DL + LL - WL)".to_string(),
                combination_type: CombinationType::Strength,
                factors: vec![(d.clone(), 1.2), (l.clone(), 1.2), (w.clone(), -1.2)],
            });
        }
        
        // 1.5(DL ± WL)
        if let (Some(d), Some(w)) = (&dl, &wl) {
            self.combinations.push(LoadCombination {
                id: "COMB3a".to_string(),
                name: "1.5(DL + WL)".to_string(),
                combination_type: CombinationType::Strength,
                factors: vec![(d.clone(), 1.5), (w.clone(), 1.5)],
            });
            self.combinations.push(LoadCombination {
                id: "COMB3b".to_string(),
                name: "1.5(DL - WL)".to_string(),
                combination_type: CombinationType::Strength,
                factors: vec![(d.clone(), 1.5), (w.clone(), -1.5)],
            });
        }
        
        // 0.9DL ± 1.5WL
        if let (Some(d), Some(w)) = (&dl, &wl) {
            self.combinations.push(LoadCombination {
                id: "COMB4a".to_string(),
                name: "0.9DL + 1.5WL".to_string(),
                combination_type: CombinationType::Strength,
                factors: vec![(d.clone(), 0.9), (w.clone(), 1.5)],
            });
            self.combinations.push(LoadCombination {
                id: "COMB4b".to_string(),
                name: "0.9DL - 1.5WL".to_string(),
                combination_type: CombinationType::Strength,
                factors: vec![(d.clone(), 0.9), (w.clone(), -1.5)],
            });
        }
        
        // Seismic combinations per IS 1893
        if let (Some(d), Some(l), Some(e)) = (&dl, &ll, &eq) {
            self.combinations.push(LoadCombination {
                id: "COMB5a".to_string(),
                name: "1.2(DL + LL + EQ)".to_string(),
                combination_type: CombinationType::Strength,
                factors: vec![(d.clone(), 1.2), (l.clone(), 1.2), (e.clone(), 1.2)],
            });
            self.combinations.push(LoadCombination {
                id: "COMB5b".to_string(),
                name: "1.2(DL + LL - EQ)".to_string(),
                combination_type: CombinationType::Strength,
                factors: vec![(d.clone(), 1.2), (l.clone(), 1.2), (e.clone(), -1.2)],
            });
        }
        
        // Service combinations
        if let (Some(d), Some(l)) = (&dl, &ll) {
            self.combinations.push(LoadCombination {
                id: "SLS1".to_string(),
                name: "DL + LL".to_string(),
                combination_type: CombinationType::Service,
                factors: vec![(d.clone(), 1.0), (l.clone(), 1.0)],
            });
        }
    }
    
    fn generate_asce7_combinations(&mut self) {
        // ASCE 7-22 Load Combinations
        let d = self.find_load_case(LoadType::Dead);
        let l = self.find_load_case(LoadType::Live);
        let lr = self.find_load_case(LoadType::LiveRoof);
        let s = self.find_load_case(LoadType::Snow);
        let w = self.find_load_case(LoadType::Wind);
        let e = self.find_load_case(LoadType::Seismic);
        
        // 1.4D
        if let Some(d) = &d {
            self.combinations.push(LoadCombination {
                id: "LC1".to_string(),
                name: "1.4D".to_string(),
                combination_type: CombinationType::Strength,
                factors: vec![(d.clone(), 1.4)],
            });
        }
        
        // 1.2D + 1.6L + 0.5(Lr or S)
        if let Some(d) = &d {
            let mut factors = vec![(d.clone(), 1.2)];
            if let Some(l) = &l {
                factors.push((l.clone(), 1.6));
            }
            if let Some(lr) = &lr {
                factors.push((lr.clone(), 0.5));
            } else if let Some(s) = &s {
                factors.push((s.clone(), 0.5));
            }
            
            self.combinations.push(LoadCombination {
                id: "LC2".to_string(),
                name: "1.2D + 1.6L + 0.5(Lr or S)".to_string(),
                combination_type: CombinationType::Strength,
                factors,
            });
        }
        
        // 1.2D + 1.0W + L + 0.5(Lr or S)
        if let (Some(d), Some(w)) = (&d, &w) {
            let mut factors = vec![(d.clone(), 1.2), (w.clone(), 1.0)];
            if let Some(l) = &l {
                factors.push((l.clone(), 1.0));
            }
            if let Some(lr) = &lr {
                factors.push((lr.clone(), 0.5));
            }
            
            self.combinations.push(LoadCombination {
                id: "LC4a".to_string(),
                name: "1.2D + 1.0W + L + 0.5Lr".to_string(),
                combination_type: CombinationType::Strength,
                factors: factors.clone(),
            });
            
            // With -W
            factors[1] = (w.clone(), -1.0);
            self.combinations.push(LoadCombination {
                id: "LC4b".to_string(),
                name: "1.2D - 1.0W + L + 0.5Lr".to_string(),
                combination_type: CombinationType::Strength,
                factors,
            });
        }
        
        // 1.2D + 1.0E + L
        if let (Some(d), Some(e)) = (&d, &e) {
            let mut factors = vec![(d.clone(), 1.2), (e.clone(), 1.0)];
            if let Some(l) = &l {
                factors.push((l.clone(), 1.0));
            }
            
            self.combinations.push(LoadCombination {
                id: "LC5a".to_string(),
                name: "1.2D + 1.0E + L".to_string(),
                combination_type: CombinationType::Strength,
                factors: factors.clone(),
            });
            
            factors[1] = (e.clone(), -1.0);
            self.combinations.push(LoadCombination {
                id: "LC5b".to_string(),
                name: "1.2D - 1.0E + L".to_string(),
                combination_type: CombinationType::Strength,
                factors,
            });
        }
        
        // 0.9D + 1.0W
        if let (Some(d), Some(w)) = (&d, &w) {
            self.combinations.push(LoadCombination {
                id: "LC6a".to_string(),
                name: "0.9D + 1.0W".to_string(),
                combination_type: CombinationType::Strength,
                factors: vec![(d.clone(), 0.9), (w.clone(), 1.0)],
            });
            self.combinations.push(LoadCombination {
                id: "LC6b".to_string(),
                name: "0.9D - 1.0W".to_string(),
                combination_type: CombinationType::Strength,
                factors: vec![(d.clone(), 0.9), (w.clone(), -1.0)],
            });
        }
        
        // 0.9D + 1.0E
        if let (Some(d), Some(e)) = (&d, &e) {
            self.combinations.push(LoadCombination {
                id: "LC7a".to_string(),
                name: "0.9D + 1.0E".to_string(),
                combination_type: CombinationType::Strength,
                factors: vec![(d.clone(), 0.9), (e.clone(), 1.0)],
            });
            self.combinations.push(LoadCombination {
                id: "LC7b".to_string(),
                name: "0.9D - 1.0E".to_string(),
                combination_type: CombinationType::Strength,
                factors: vec![(d.clone(), 0.9), (e.clone(), -1.0)],
            });
        }
    }
    
    fn generate_eurocode_combinations(&mut self) {
        // EN 1990 - STR/GEO limit state combinations
        let g = self.find_load_case(LoadType::Dead);
        let q = self.find_load_case(LoadType::Live);
        let w = self.find_load_case(LoadType::Wind);
        let _s = self.find_load_case(LoadType::Snow);
        
        // Combination factors per EN 1990 Table A1.2(B)
        let psi_0_q = 0.7;  // Office buildings
        let psi_0_w = 0.6;
        let _psi_0_s = 0.5;
        
        // Fundamental: 1.35G + 1.5Q_leading + 1.5*ψ0*Q_accompanying
        if let Some(g) = &g {
            if let Some(q) = &q {
                // Q leading, W accompanying
                let mut factors = vec![(g.clone(), 1.35), (q.clone(), 1.5)];
                if let Some(w) = &w {
                    factors.push((w.clone(), 1.5 * psi_0_w));
                }
                self.combinations.push(LoadCombination {
                    id: "EC1".to_string(),
                    name: "1.35G + 1.5Q + 1.5ψ0W".to_string(),
                    combination_type: CombinationType::Strength,
                    factors,
                });
            }
            
            if let Some(w) = &w {
                // W leading, Q accompanying
                let mut factors = vec![(g.clone(), 1.35), (w.clone(), 1.5)];
                if let Some(q) = &q {
                    factors.push((q.clone(), 1.5 * psi_0_q));
                }
                self.combinations.push(LoadCombination {
                    id: "EC2a".to_string(),
                    name: "1.35G + 1.5W + 1.5ψ0Q".to_string(),
                    combination_type: CombinationType::Strength,
                    factors: factors.clone(),
                });
                
                factors[1] = (w.clone(), -1.5);
                self.combinations.push(LoadCombination {
                    id: "EC2b".to_string(),
                    name: "1.35G - 1.5W + 1.5ψ0Q".to_string(),
                    combination_type: CombinationType::Strength,
                    factors,
                });
            }
        }
        
        // Characteristic SLS: G + Q + ψ0*W
        if let (Some(g), Some(q)) = (&g, &q) {
            let mut factors = vec![(g.clone(), 1.0), (q.clone(), 1.0)];
            if let Some(w) = &w {
                factors.push((w.clone(), psi_0_w));
            }
            self.combinations.push(LoadCombination {
                id: "SLS1".to_string(),
                name: "G + Q + ψ0W".to_string(),
                combination_type: CombinationType::Service,
                factors,
            });
        }
    }
    
    fn find_load_case(&self, load_type: LoadType) -> Option<String> {
        self.load_cases.iter()
            .find(|lc| lc.load_type == load_type)
            .map(|lc| lc.id.clone())
    }

    /// Count generated combinations.
    pub fn combination_count(&self) -> usize {
        self.combinations.len()
    }

    /// Build a lookup map of load case ids to factor vectors for each combination.
    pub fn combination_factor_map(&self) -> Vec<(String, HashMap<String, f64>)> {
        self.combinations
            .iter()
            .map(|comb| {
                let mut factors = HashMap::new();
                for (case_id, factor) in &comb.factors {
                    factors.insert(case_id.clone(), *factor);
                }
                (comb.id.clone(), factors)
            })
            .collect()
    }

    /// Return the strongest combination by absolute combined factor.
    pub fn governing_combination(&self) -> Option<&LoadCombination> {
        self.combinations.iter().max_by(|a, b| {
            let a_sum = a.factors.iter().map(|(_, f)| f.abs()).sum::<f64>();
            let b_sum = b.factors.iter().map(|(_, f)| f.abs()).sum::<f64>();
            a_sum.partial_cmp(&b_sum).unwrap_or(std::cmp::Ordering::Equal)
        })
    }
    
    /// Get all combinations as factor matrices
    pub fn get_combination_matrix(&self) -> Vec<(String, Vec<f64>)> {
        let num_cases = self.load_cases.len();
        
        self.combinations.iter().map(|comb| {
            let mut factors = vec![0.0; num_cases];
            for (case_id, factor) in &comb.factors {
                if let Some(idx) = self.load_cases.iter().position(|lc| &lc.id == case_id) {
                    factors[idx] = *factor;
                }
            }
            (comb.id.clone(), factors)
        }).collect()
    }

    /// Evaluate a combined effect against scalar capacity for quick checks.
    pub fn evaluate_combination(&self, combined_factor: f64, capacity: f64) -> CombinationEvaluationResult {
        let utilization = if capacity.abs() > f64::EPSILON {
            combined_factor.abs() / capacity.abs()
        } else {
            f64::INFINITY
        };
        let passed = utilization <= 1.0;
        CombinationEvaluationResult {
            passed,
            utilization,
            message: if passed {
                format!("Combination OK; effect = {:.3}, capacity = {:.3}", combined_factor, capacity)
            } else {
                format!("Combination NG; effect = {:.3}, capacity = {:.3}", combined_factor, capacity)
            },
            clause: match self.design_code {
                DesignCode::IS456 | DesignCode::IS800 => "IS 456 / IS 800 load combination checks".to_string(),
                DesignCode::ACI318 | DesignCode::AISC360 | DesignCode::ASCE7 => "ASCE 7 load combination checks".to_string(),
                DesignCode::EN1992 | DesignCode::EN1993 => "EN 1990 load combination checks".to_string(),
            },
            combined_factor,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generates_is_basic_combination() {
        let mut g = LoadCombinationGenerator::new(DesignCode::IS456);
        g.add_load_case("DL", "Dead", LoadType::Dead);
        g.add_load_case("LL", "Live", LoadType::Live);
        g.generate_combinations();
        assert!(g.combination_count() > 0);
        assert!(g.combinations.iter().any(|c| c.id == "COMB1"));
    }

    #[test]
    fn evaluate_combination_reports_failure() {
        let g = LoadCombinationGenerator::new(DesignCode::ASCE7);
        let out = g.evaluate_combination(120.0, 100.0);
        assert!(!out.passed);
        assert!(out.utilization > 1.0);
    }
}

