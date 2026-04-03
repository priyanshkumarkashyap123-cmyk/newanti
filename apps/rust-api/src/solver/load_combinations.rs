//! Load Combination Engine — STAAD-Grade
//!
//! Implements load combination generation per:
//! - IS 456:2000 / IS 875 (Indian Standard)
//! - ASCE 7-22 (US LRFD & ASD)
//! - Eurocode EN 1990 (European)
//!
//! Features:
//! - Automatic combination generation from code provisions
//! - Envelope extraction (max/min for each DOF)
//! - Pattern loading support  
//! - Load case management with factored superposition
//! - Parallel envelope computation with Rayon

pub mod types;
pub mod generator;
// compute module removed (functions remain here for now)

use crate::solver::load_combinations::types::*;
use std::collections::HashMap;
use rayon::prelude::*;

/// Load Combination Engine
impl LoadCombinationEngine {
    /// Add a load case
    pub fn add_load_case(&mut self, case: LoadCase) {
        self.load_cases.push(case);
    }

    /// Validate that no combination mixes wind and seismic loads.
    /// Per IS 1893 Cl. 6.3.2: "Wind load and earthquake load shall not be
    /// considered to act simultaneously."
    pub fn validate_wind_seismic_exclusion(&self) -> Vec<String> {
        let mut violations = Vec::new();
        let case_type_map: HashMap<&str, LoadCaseType> = self
            .load_cases
            .iter()
            .map(|lc| (lc.id.as_str(), lc.case_type))
            .collect();

        for combo in &self.combinations {
            let mut has_wind = false;
            let mut has_seismic = false;
            for f in &combo.factors {
                if f.factor.abs() < 1e-15 {
                    continue;
                }
                if let Some(&ct) = case_type_map.get(f.load_case_id.as_str()) {
                    match ct {
                        LoadCaseType::Wind => has_wind = true,
                        LoadCaseType::Seismic => has_seismic = true,
                        _ => {}
                    }
                }
            }
            if has_wind && has_seismic {
                violations.push(format!(
                    "Combination '{}' ({}) mixes wind and seismic loads — violates IS 1893 Cl. 6.3.2",
                    combo.name, combo.id
                ));
            }
        }
        violations
    }

    /// Add a user-defined combination, rejecting it if it mixes wind + seismic.
    /// Returns Err with violation message if the combo fails IS 1893 Cl. 6.3.2.
    pub fn add_combination_checked(&mut self, combo: LoadCombination) -> Result<(), String> {
        let case_type_map: HashMap<&str, LoadCaseType> = self
            .load_cases
            .iter()
            .map(|lc| (lc.id.as_str(), lc.case_type))
            .collect();

        let mut has_wind = false;
        let mut has_seismic = false;
        for f in &combo.factors {
            if f.factor.abs() < 1e-15 {
                continue;
            }
            if let Some(&ct) = case_type_map.get(f.load_case_id.as_str()) {
                match ct {
                    LoadCaseType::Wind => has_wind = true,
                    LoadCaseType::Seismic => has_seismic = true,
                    _ => {}
                }
            }
        }
        if has_wind && has_seismic {
            return Err(format!(
                "Combination '{}' mixes wind and seismic loads — IS 1893 Cl. 6.3.2 prohibits simultaneous WL+EQ",
                combo.name
            ));
        }
        self.combinations.push(combo);
        Ok(())
    }

    /// Generate combinations automatically from design code
    pub fn generate_combinations(&mut self, code: CombinationCode) {
        let case_types: HashMap<LoadCaseType, Vec<String>> = {
            let mut map: HashMap<LoadCaseType, Vec<String>> = HashMap::new();
            for lc in &self.load_cases {
                map.entry(lc.case_type).or_default().push(lc.id.clone());
            }
            map
        };

        let dead = case_types
            .get(&LoadCaseType::Dead)
            .cloned()
            .unwrap_or_default();
        let live = case_types
            .get(&LoadCaseType::Live)
            .cloned()
            .unwrap_or_default();
        let wind = case_types
            .get(&LoadCaseType::Wind)
            .cloned()
            .unwrap_or_default();
        let seismic = case_types
            .get(&LoadCaseType::Seismic)
            .cloned()
            .unwrap_or_default();
        let snow = case_types
            .get(&LoadCaseType::Snow)
            .cloned()
            .unwrap_or_default();

        match code {
            CombinationCode::IS456 => self.generate_is456(&dead, &live, &wind, &seismic),
            CombinationCode::ASCE7_LRFD => {
                self.generate_asce7_lrfd(&dead, &live, &wind, &seismic, &snow)
            }
            CombinationCode::ASCE7_ASD => {
                self.generate_asce7_asd(&dead, &live, &wind, &seismic, &snow)
            }
            CombinationCode::Eurocode => {
                self.generate_eurocode(&dead, &live, &wind, &seismic, &snow)
            }
            CombinationCode::Custom => {} // User defines manually
        }
    }

    /// IS 456:2000 / IS 875 load combinations
    fn generate_is456(
        &mut self,
        dead: &[String],
        live: &[String],
        wind: &[String],
        seismic: &[String],
    ) {
        let mut combo_id = 1;

        // 1.5(DL + LL)
        {
            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor { load_case_id: d.clone(), factor: 1.5 });
            }
            for l in live {
                factors.push(LoadFactor { load_case_id: l.clone(), factor: 1.5 });
            }
            self.combinations.push(LoadCombination {
                id: format!("C{}", combo_id),
                name: "1.5(DL+LL)".into(),
                code: CombinationCode::IS456,
                factors,
                is_service: false,
            });
            combo_id += 1;
        }

        // 1.2(DL + LL + EQ)
        {
            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor { load_case_id: d.clone(), factor: 1.2 });
            }
            for l in live {
                factors.push(LoadFactor { load_case_id: l.clone(), factor: 1.2 });
            }
            for s in seismic {
                factors.push(LoadFactor { load_case_id: s.clone(), factor: 1.2 });
            }
            self.combinations.push(LoadCombination {
                id: format!("C{}", combo_id),
                name: "1.2(DL+LL+EQ)".into(),
                code: CombinationCode::IS456,
                factors,
                is_service: false,
            });
            combo_id += 1;
        }
        {
            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor {
                    load_case_id: d.clone(),
                    factor: 1.5,
                });
            }
            for l in live {
                factors.push(LoadFactor {
                    load_case_id: l.clone(),
                    factor: 1.5,
                });
            }
            self.combinations.push(LoadCombination {
                id: format!("C{}", combo_id),
                name: "1.5(DL+LL)".into(),
                code: CombinationCode::IS456,
                factors,
                is_service: false,
            });
            combo_id += 1;
        }

        // 1.5(DL + WL) and 0.9DL + 1.5WL
        for w in wind {
            // 1.5(DL + WL)
            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor { load_case_id: d.clone(), factor: 1.5 });
            }
            factors.push(LoadFactor { load_case_id: w.clone(), factor: 1.5 });
            self.combinations.push(LoadCombination {
                id: format!("C{}", combo_id),
                name: format!("1.5(DL+WL_{})", w),
                code: CombinationCode::IS456,
                factors,
                is_service: false,
            });
            combo_id += 1;

            // 0.9DL + 1.5WL (overturning check)
            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor { load_case_id: d.clone(), factor: 0.9 });
            }
            factors.push(LoadFactor { load_case_id: w.clone(), factor: 1.5 });
            self.combinations.push(LoadCombination {
                id: format!("C{}", combo_id),
                name: format!("0.9DL+1.5WL_{}", w),
                code: CombinationCode::IS456,
                factors,
                is_service: false,
            });
            combo_id += 1;
        }

        // 1.5(DL + EQ) and 0.9DL + 1.5EQ
        for s in seismic {
            // 1.5(DL + EQ)
            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor { load_case_id: d.clone(), factor: 1.5 });
            }
            factors.push(LoadFactor { load_case_id: s.clone(), factor: 1.5 });
            self.combinations.push(LoadCombination {
                id: format!("C{}", combo_id),
                name: format!("1.5(DL+EQ_{})", s),
                code: CombinationCode::IS456,
                factors,
                is_service: false,
            });
            combo_id += 1;

            // 0.9DL + 1.5EQ (overturning check)
            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor { load_case_id: d.clone(), factor: 0.9 });
            }
            factors.push(LoadFactor { load_case_id: s.clone(), factor: 1.5 });
            self.combinations.push(LoadCombination {
                id: format!("C{}", combo_id),
                name: format!("0.9DL+1.5EQ_{}", s),
                code: CombinationCode::IS456,
                factors,
                is_service: false,
            });
            combo_id += 1;
        }
        for w in wind {
            // 1.5(DL + WL)
            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor {
                    load_case_id: d.clone(),
                    factor: 1.5,
                });
            }
            factors.push(LoadFactor {
                load_case_id: w.clone(),
                factor: 1.5,
            });
            self.combinations.push(LoadCombination {
                id: format!("C{}", combo_id),
                name: format!("1.5(DL+WL_{})", w),
                code: CombinationCode::IS456,
                factors,
                is_service: false,
            });
            combo_id += 1;

            // 0.9DL + 1.5WL (overturning check)
            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor {
                    load_case_id: d.clone(),
                    factor: 0.9,
                });
            }
            factors.push(LoadFactor {
                load_case_id: w.clone(),
                factor: 1.5,
            });
            self.combinations.push(LoadCombination {
                id: format!("C{}", combo_id),
                name: format!("0.9DL+1.5WL_{}", w),
                code: CombinationCode::IS456,
                factors,
                is_service: false,
            });
            combo_id += 1;
        }

        // 1.2(DL + LL + WL)
        for w in wind {
            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor {
                    load_case_id: d.clone(),
                    factor: 1.2,
                });
            }
            for l in live {
                factors.push(LoadFactor {
                    load_case_id: l.clone(),
                    factor: 1.2,
                });
            }
            factors.push(LoadFactor {
                load_case_id: w.clone(),
                factor: 1.2,
            });
            self.combinations.push(LoadCombination {
                id: format!("C{}", combo_id),
                name: format!("1.2(DL+LL+WL_{})", w),
                code: CombinationCode::IS456,
                factors,
                is_service: false,
            });
            combo_id += 1;
        }

        // 1.5(DL + EQ) and 0.9DL + 1.5EQ
        for eq in seismic {
            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor {
                    load_case_id: d.clone(),
                    factor: 1.5,
                });
            }
            factors.push(LoadFactor {
                load_case_id: eq.clone(),
                factor: 1.5,
            });
            self.combinations.push(LoadCombination {
                id: format!("C{}", combo_id),
                name: format!("1.5(DL+EQ_{})", eq),
                code: CombinationCode::IS456,
                factors,
                is_service: false,
            });
            combo_id += 1;

            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor {
                    load_case_id: d.clone(),
                    factor: 0.9,
                });
            }
            factors.push(LoadFactor {
                load_case_id: eq.clone(),
                factor: 1.5,
            });
            self.combinations.push(LoadCombination {
                id: format!("C{}", combo_id),
                name: format!("0.9DL+1.5EQ_{}", eq),
                code: CombinationCode::IS456,
                factors,
                is_service: false,
            });
            combo_id += 1;
        }

        // 1.2(DL + LL + EQ)
        for eq in seismic {
            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor {
                    load_case_id: d.clone(),
                    factor: 1.2,
                });
            }
            for l in live {
                factors.push(LoadFactor {
                    load_case_id: l.clone(),
                    factor: 1.2,
                });
            }
            factors.push(LoadFactor {
                load_case_id: eq.clone(),
                factor: 1.2,
            });
            self.combinations.push(LoadCombination {
                id: format!("C{}", combo_id),
                name: format!("1.2(DL+LL+EQ_{})", eq),
                code: CombinationCode::IS456,
                factors,
                is_service: false,
            });
            combo_id += 1;
        }

        // Service combinations
        // DL + LL
        {
            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor {
                    load_case_id: d.clone(),
                    factor: 1.0,
                });
            }
            for l in live {
                factors.push(LoadFactor {
                    load_case_id: l.clone(),
                    factor: 1.0,
                });
            }
            self.combinations.push(LoadCombination {
                id: format!("C{}", combo_id),
                name: "DL+LL (Service)".into(),
                code: CombinationCode::IS456,
                factors,
                is_service: true,
            });
            combo_id += 1;
        }

        // DL + 0.8LL
        {
            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor {
                    load_case_id: d.clone(),
                    factor: 1.0,
                });
            }
            for l in live {
                factors.push(LoadFactor {
                    load_case_id: l.clone(),
                    factor: 0.8,
                });
            }
            self.combinations.push(LoadCombination {
                id: format!("C{}", combo_id),
                name: "DL+0.8LL (Service)".into(),
                code: CombinationCode::IS456,
                factors,
                is_service: true,
            });
            combo_id += 1;
        }

        // DL only (serviceability)
        {
            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor {
                    load_case_id: d.clone(),
                    factor: 1.0,
                });
            }
            self.combinations.push(LoadCombination {
                id: format!("C{}", combo_id),
                name: "DL (Service)".into(),
                code: CombinationCode::IS456,
                factors,
                is_service: true,
            });
        }
    }

    /// ASCE 7-22 LRFD combinations
    fn generate_asce7_lrfd(
        &mut self,
        dead: &[String],
        live: &[String],
        wind: &[String],
        seismic: &[String],
        snow: &[String],
    ) {
        let mut combo_id = 1;

        // 1.4D
        {
            let factors: Vec<_> = dead
                .iter()
                .map(|d| LoadFactor {
                    load_case_id: d.clone(),
                    factor: 1.4,
                })
                .collect();
            self.combinations.push(LoadCombination {
                id: format!("LRFD-{}", combo_id),
                name: "1.4D".into(),
                code: CombinationCode::ASCE7_LRFD,
                factors,
                is_service: false,
            });
            combo_id += 1;
        }

        // 1.2D + 1.6L + 0.5S
        {
            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor {
                    load_case_id: d.clone(),
                    factor: 1.2,
                });
            }
            for l in live {
                factors.push(LoadFactor {
                    load_case_id: l.clone(),
                    factor: 1.6,
                });
            }
            for s in snow {
                factors.push(LoadFactor {
                    load_case_id: s.clone(),
                    factor: 0.5,
                });
            }
            self.combinations.push(LoadCombination {
                id: format!("LRFD-{}", combo_id),
                name: "1.2D+1.6L+0.5S".into(),
                code: CombinationCode::ASCE7_LRFD,
                factors,
                is_service: false,
            });
            combo_id += 1;
        }

        // 1.2D + 1.0W + L + 0.5S
        for w in wind {
            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor {
                    load_case_id: d.clone(),
                    factor: 1.2,
                });
            }
            factors.push(LoadFactor {
                load_case_id: w.clone(),
                factor: 1.0,
            });
            for l in live {
                factors.push(LoadFactor {
                    load_case_id: l.clone(),
                    factor: 1.0,
                });
            }
            for s in snow {
                factors.push(LoadFactor {
                    load_case_id: s.clone(),
                    factor: 0.5,
                });
            }
            self.combinations.push(LoadCombination {
                id: format!("LRFD-{}", combo_id),
                name: format!("1.2D+W+L+0.5S (W={})", w),
                code: CombinationCode::ASCE7_LRFD,
                factors,
                is_service: false,
            });
            combo_id += 1;
        }

        // 0.9D + 1.0W (overturning)
        for w in wind {
            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor {
                    load_case_id: d.clone(),
                    factor: 0.9,
                });
            }
            factors.push(LoadFactor {
                load_case_id: w.clone(),
                factor: 1.0,
            });
            self.combinations.push(LoadCombination {
                id: format!("LRFD-{}", combo_id),
                name: format!("0.9D+W (W={})", w),
                code: CombinationCode::ASCE7_LRFD,
                factors,
                is_service: false,
            });
            combo_id += 1;
        }

        // 1.2D + Ev + Eh + L
        for eq in seismic {
            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor {
                    load_case_id: d.clone(),
                    factor: 1.2,
                });
            }
            factors.push(LoadFactor {
                load_case_id: eq.clone(),
                factor: 1.0,
            });
            for l in live {
                factors.push(LoadFactor {
                    load_case_id: l.clone(),
                    factor: 1.0,
                });
            }
            self.combinations.push(LoadCombination {
                id: format!("LRFD-{}", combo_id),
                name: format!("1.2D+E+L (E={})", eq),
                code: CombinationCode::ASCE7_LRFD,
                factors,
                is_service: false,
            });
            combo_id += 1;
        }

        // 0.9D - Ev + Eh
        for eq in seismic {
            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor {
                    load_case_id: d.clone(),
                    factor: 0.9,
                });
            }
            factors.push(LoadFactor {
                load_case_id: eq.clone(),
                factor: 1.0,
            });
            self.combinations.push(LoadCombination {
                id: format!("LRFD-{}", combo_id),
                name: format!("0.9D+E (E={})", eq),
                code: CombinationCode::ASCE7_LRFD,
                factors,
                is_service: false,
            });
            combo_id += 1;
        }
    }

    /// ASCE 7-22 ASD combinations
    fn generate_asce7_asd(
        &mut self,
        dead: &[String],
        live: &[String],
        wind: &[String],
        seismic: &[String],
        snow: &[String],
    ) {
        let mut combo_id = 1;

        // D
        {
            let factors: Vec<_> = dead
                .iter()
                .map(|d| LoadFactor {
                    load_case_id: d.clone(),
                    factor: 1.0,
                })
                .collect();
            self.combinations.push(LoadCombination {
                id: format!("ASD-{}", combo_id),
                name: "D".into(),
                code: CombinationCode::ASCE7_ASD,
                factors,
                is_service: true,
            });
            combo_id += 1;
        }

        // D + L
        {
            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor {
                    load_case_id: d.clone(),
                    factor: 1.0,
                });
            }
            for l in live {
                factors.push(LoadFactor {
                    load_case_id: l.clone(),
                    factor: 1.0,
                });
            }
            self.combinations.push(LoadCombination {
                id: format!("ASD-{}", combo_id),
                name: "D+L".into(),
                code: CombinationCode::ASCE7_ASD,
                factors,
                is_service: true,
            });
            combo_id += 1;
        }

        // D + 0.75L + 0.75S
        {
            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor {
                    load_case_id: d.clone(),
                    factor: 1.0,
                });
            }
            for l in live {
                factors.push(LoadFactor {
                    load_case_id: l.clone(),
                    factor: 0.75,
                });
            }
            for s in snow {
                factors.push(LoadFactor {
                    load_case_id: s.clone(),
                    factor: 0.75,
                });
            }
            self.combinations.push(LoadCombination {
                id: format!("ASD-{}", combo_id),
                name: "D+0.75L+0.75S".into(),
                code: CombinationCode::ASCE7_ASD,
                factors,
                is_service: true,
            });
            combo_id += 1;
        }

        // D + 0.6W
        for w in wind {
            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor {
                    load_case_id: d.clone(),
                    factor: 1.0,
                });
            }
            factors.push(LoadFactor {
                load_case_id: w.clone(),
                factor: 0.6,
            });
            self.combinations.push(LoadCombination {
                id: format!("ASD-{}", combo_id),
                name: format!("D+0.6W (W={})", w),
                code: CombinationCode::ASCE7_ASD,
                factors,
                is_service: true,
            });
            combo_id += 1;
        }

        // 0.6D + 0.6W
        for w in wind {
            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor {
                    load_case_id: d.clone(),
                    factor: 0.6,
                });
            }
            factors.push(LoadFactor {
                load_case_id: w.clone(),
                factor: 0.6,
            });
            self.combinations.push(LoadCombination {
                id: format!("ASD-{}", combo_id),
                name: format!("0.6D+0.6W (W={})", w),
                code: CombinationCode::ASCE7_ASD,
                factors,
                is_service: true,
            });
            combo_id += 1;
        }

        // D + 0.7E
        for eq in seismic {
            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor {
                    load_case_id: d.clone(),
                    factor: 1.0,
                });
            }
            factors.push(LoadFactor {
                load_case_id: eq.clone(),
                factor: 0.7,
            });
            self.combinations.push(LoadCombination {
                id: format!("ASD-{}", combo_id),
                name: format!("D+0.7E (E={})", eq),
                code: CombinationCode::ASCE7_ASD,
                factors,
                is_service: true,
            });
            combo_id += 1;
        }
    }

    /// Eurocode EN 1990 combinations
    fn generate_eurocode(
        &mut self,
        dead: &[String],
        live: &[String],
        wind: &[String],
        seismic: &[String],
        snow: &[String],
    ) {
        let mut combo_id = 1;

        // STR/GEO: 1.35G + 1.5Q
        {
            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor {
                    load_case_id: d.clone(),
                    factor: 1.35,
                });
            }
            for l in live {
                factors.push(LoadFactor {
                    load_case_id: l.clone(),
                    factor: 1.5,
                });
            }
            self.combinations.push(LoadCombination {
                id: format!("EC-{}", combo_id),
                name: "1.35G+1.5Q".into(),
                code: CombinationCode::Eurocode,
                factors,
                is_service: false,
            });
            combo_id += 1;
        }

        // 1.35G + 1.5Q + 0.9W
        for w in wind {
            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor {
                    load_case_id: d.clone(),
                    factor: 1.35,
                });
            }
            for l in live {
                factors.push(LoadFactor {
                    load_case_id: l.clone(),
                    factor: 1.5,
                });
            }
            factors.push(LoadFactor {
                load_case_id: w.clone(),
                factor: 0.9,
            });
            self.combinations.push(LoadCombination {
                id: format!("EC-{}", combo_id),
                name: format!("1.35G+1.5Q+0.9W_{}", w),
                code: CombinationCode::Eurocode,
                factors,
                is_service: false,
            });
            combo_id += 1;
        }

        // 1.35G + 1.5W + 1.05Q
        for w in wind {
            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor {
                    load_case_id: d.clone(),
                    factor: 1.35,
                });
            }
            factors.push(LoadFactor {
                load_case_id: w.clone(),
                factor: 1.5,
            });
            for l in live {
                factors.push(LoadFactor {
                    load_case_id: l.clone(),
                    factor: 1.05,
                });
            }
            self.combinations.push(LoadCombination {
                id: format!("EC-{}", combo_id),
                name: format!("1.35G+1.5W+1.05Q_{}", w),
                code: CombinationCode::Eurocode,
                factors,
                is_service: false,
            });
            combo_id += 1;
        }

        // 1.0G + 1.5W (uplift)
        for w in wind {
            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor {
                    load_case_id: d.clone(),
                    factor: 1.0,
                });
            }
            factors.push(LoadFactor {
                load_case_id: w.clone(),
                factor: 1.5,
            });
            self.combinations.push(LoadCombination {
                id: format!("EC-{}", combo_id),
                name: format!("1.0G+1.5W_{} (uplift)", w),
                code: CombinationCode::Eurocode,
                factors,
                is_service: false,
            });
            combo_id += 1;
        }

        // 1.35G + 1.5S + 0.9W
        for s in snow {
            for w in wind {
                let mut factors = Vec::new();
                for d in dead {
                    factors.push(LoadFactor {
                        load_case_id: d.clone(),
                        factor: 1.35,
                    });
                }
                factors.push(LoadFactor {
                    load_case_id: s.clone(),
                    factor: 1.5,
                });
                factors.push(LoadFactor {
                    load_case_id: w.clone(),
                    factor: 0.9,
                });
                self.combinations.push(LoadCombination {
                    id: format!("EC-{}", combo_id),
                    name: format!("1.35G+1.5S+0.9W_{}", w),
                    code: CombinationCode::Eurocode,
                    factors,
                    is_service: false,
                });
                combo_id += 1;
            }
        }

        // Seismic: G + 0.3Q + E
        for eq in seismic {
            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor {
                    load_case_id: d.clone(),
                    factor: 1.0,
                });
            }
            for l in live {
                factors.push(LoadFactor {
                    load_case_id: l.clone(),
                    factor: 0.3,
                });
            }
            factors.push(LoadFactor {
                load_case_id: eq.clone(),
                factor: 1.0,
            });
            self.combinations.push(LoadCombination {
                id: format!("EC-{}", combo_id),
                name: format!("G+0.3Q+E_{}", eq),
                code: CombinationCode::Eurocode,
                factors,
                is_service: false,
            });
            combo_id += 1;
        }

        // SLS: G + Q (characteristic)
        {
            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor {
                    load_case_id: d.clone(),
                    factor: 1.0,
                });
            }
            for l in live {
                factors.push(LoadFactor {
                    load_case_id: l.clone(),
                    factor: 1.0,
                });
            }
            self.combinations.push(LoadCombination {
                id: format!("EC-{}", combo_id),
                name: "G+Q (SLS char)".into(),
                code: CombinationCode::Eurocode,
                factors,
                is_service: true,
            });
            combo_id += 1;
        }

        // SLS: G + 0.7Q (quasi-permanent)
        {
            let mut factors = Vec::new();
            for d in dead {
                factors.push(LoadFactor {
                    load_case_id: d.clone(),
                    factor: 1.0,
                });
            }
            for l in live {
                factors.push(LoadFactor {
                    load_case_id: l.clone(),
                    factor: 0.7,
                });
            }
            self.combinations.push(LoadCombination {
                id: format!("EC-{}", combo_id),
                name: "G+0.7Q (SLS quasi)".into(),
                code: CombinationCode::Eurocode,
                factors,
                is_service: true,
            });
            let _ = combo_id;
        }
    }

    /// Compute results for all combinations by linear superposition  
    pub fn compute_all(&self) -> Vec<CombinationResult> {
        let case_map: HashMap<&str, &LoadCase> = self
            .load_cases
            .iter()
            .map(|lc| (lc.id.as_str(), lc))
            .collect();

        self.combinations
            .par_iter()
            .map(|combo| {
                let mut displacements: HashMap<String, [f64; 6]> = HashMap::new();
                let mut member_forces: HashMap<String, [f64; 12]> = HashMap::new();
                let mut reactions: HashMap<String, [f64; 6]> = HashMap::new();

                for factor in &combo.factors {
                    if let Some(lc) = case_map.get(factor.load_case_id.as_str()) {
                        // Superpose displacements
                        for (node_id, vals) in &lc.displacements {
                            let entry = displacements.entry(node_id.clone()).or_insert([0.0; 6]);
                            for i in 0..6 {
                                entry[i] += factor.factor * vals[i];
                            }
                        }
                        // Superpose member forces
                        for (mem_id, vals) in &lc.member_forces {
                            let entry = member_forces.entry(mem_id.clone()).or_insert([0.0; 12]);
                            for i in 0..12 {
                                entry[i] += factor.factor * vals[i];
                            }
                        }
                        // Superpose reactions
                        for (node_id, vals) in &lc.reactions {
                            let entry = reactions.entry(node_id.clone()).or_insert([0.0; 6]);
                            for i in 0..6 {
                                entry[i] += factor.factor * vals[i];
                            }
                        }
                    }
                }

                CombinationResult {
                    combination_id: combo.id.clone(),
                    combination_name: combo.name.clone(),
                    displacements,
                    member_forces,
                    reactions,
                }
            })
            .collect()
    }

    /// Compute envelope (max/min) across all combinations
    pub fn compute_envelope(&self) -> EnvelopeResult {
        let results = self.compute_all();

        let mut node_env: HashMap<String, EnvelopeValues6> = HashMap::new();
        let mut mem_env: HashMap<String, EnvelopeValues12> = HashMap::new();
        let mut react_env: HashMap<String, EnvelopeValues6> = HashMap::new();
        let mut governing: HashMap<String, String> = HashMap::new();

        for result in &results {
            // Envelope displacements
            for (node_id, vals) in &result.displacements {
                let entry = node_env
                    .entry(node_id.clone())
                    .or_insert_with(|| EnvelopeValues6 {
                        max: [f64::NEG_INFINITY; 6],
                        min: [f64::INFINITY; 6],
                        max_combo: std::array::from_fn(|_| String::new()),
                        min_combo: std::array::from_fn(|_| String::new()),
                    });
                for i in 0..6 {
                    if vals[i] > entry.max[i] {
                        entry.max[i] = vals[i];
                        entry.max_combo[i] = result.combination_name.clone();
                    }
                    if vals[i] < entry.min[i] {
                        entry.min[i] = vals[i];
                        entry.min_combo[i] = result.combination_name.clone();
                    }
                }
            }

            // Envelope member forces
            for (mem_id, vals) in &result.member_forces {
                let entry = mem_env
                    .entry(mem_id.clone())
                    .or_insert_with(|| EnvelopeValues12 {
                        max: [f64::NEG_INFINITY; 12],
                        min: [f64::INFINITY; 12],
                        max_combo: std::array::from_fn(|_| String::new()),
                        min_combo: std::array::from_fn(|_| String::new()),
                    });
                for i in 0..12 {
                    if vals[i] > entry.max[i] {
                        entry.max[i] = vals[i];
                        entry.max_combo[i] = result.combination_name.clone();
                    }
                    if vals[i] < entry.min[i] {
                        entry.min[i] = vals[i];
                        entry.min_combo[i] = result.combination_name.clone();
                    }
                }

                // Track governing combination (max absolute moment)
                let max_abs_moment = vals[4]
                    .abs()
                    .max(vals[5].abs())
                    .max(vals[10].abs())
                    .max(vals[11].abs());
                let current = governing
                    .entry(mem_id.clone())
                    .or_insert_with(|| result.combination_name.clone());
                if let Some(existing_vals) = result.member_forces.get(mem_id) {
                    let existing_max = existing_vals[4].abs().max(existing_vals[5].abs());
                    if max_abs_moment > existing_max {
                        *current = result.combination_name.clone();
                    }
                }
            }

            // Envelope reactions
            for (node_id, vals) in &result.reactions {
                let entry = react_env
                    .entry(node_id.clone())
                    .or_insert_with(|| EnvelopeValues6 {
                        max: [f64::NEG_INFINITY; 6],
                        min: [f64::INFINITY; 6],
                        max_combo: std::array::from_fn(|_| String::new()),
                        min_combo: std::array::from_fn(|_| String::new()),
                    });
                for i in 0..6 {
                    if vals[i] > entry.max[i] {
                        entry.max[i] = vals[i];
                        entry.max_combo[i] = result.combination_name.clone();
                    }
                    if vals[i] < entry.min[i] {
                        entry.min[i] = vals[i];
                        entry.min_combo[i] = result.combination_name.clone();
                    }
                }
            }
        }

        EnvelopeResult {
            node_displacements: node_env,
            member_forces: mem_env,
            reactions: react_env,
            governing_combinations: governing,
        }
    }
}

impl Default for LoadCombinationEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_test_load_case(id: &str, case_type: LoadCaseType, disp_val: f64) -> LoadCase {
        let mut displacements = HashMap::new();
        displacements.insert(
            "N1".to_string(),
            [disp_val, -disp_val * 2.0, 0.0, 0.0, 0.0, 0.0],
        );
        let mut member_forces = HashMap::new();
        member_forces.insert(
            "M1".to_string(),
            [
                disp_val * 10.0,
                -disp_val * 5.0,
                0.0,
                0.0,
                0.0,
                disp_val * 100.0,
                -disp_val * 10.0,
                disp_val * 5.0,
                0.0,
                0.0,
                0.0,
                -disp_val * 100.0,
            ],
        );
        let reactions = HashMap::new();

        LoadCase {
            id: id.to_string(),
            name: format!("Load Case {}", id),
            case_type,
            displacements,
            member_forces,
            reactions,
        }
    }

    #[test]
    fn test_is456_generation() {
        let mut engine = LoadCombinationEngine::new();
        engine.add_load_case(make_test_load_case("DL1", LoadCaseType::Dead, 1.0));
        engine.add_load_case(make_test_load_case("LL1", LoadCaseType::Live, 0.5));
        engine.add_load_case(make_test_load_case("WL1", LoadCaseType::Wind, 0.3));

        engine.generate_combinations(CombinationCode::IS456);
        assert!(engine.combinations.len() >= 5);

        let results = engine.compute_all();
        assert_eq!(results.len(), engine.combinations.len());
    }

    #[test]
    fn test_envelope() {
        let mut engine = LoadCombinationEngine::new();
        engine.add_load_case(make_test_load_case("DL1", LoadCaseType::Dead, 1.0));
        engine.add_load_case(make_test_load_case("LL1", LoadCaseType::Live, 2.0));

        engine.generate_combinations(CombinationCode::IS456);
        let envelope = engine.compute_envelope();
        assert!(!envelope.member_forces.is_empty());
    }

    #[test]
    fn test_asce7_lrfd() {
        let mut engine = LoadCombinationEngine::new();
        engine.add_load_case(make_test_load_case("DL", LoadCaseType::Dead, 1.0));
        engine.add_load_case(make_test_load_case("LL", LoadCaseType::Live, 0.5));
        engine.add_load_case(make_test_load_case("WL", LoadCaseType::Wind, 0.4));
        engine.add_load_case(make_test_load_case("EQ", LoadCaseType::Seismic, 0.6));

        engine.generate_combinations(CombinationCode::ASCE7_LRFD);
        assert!(engine.combinations.len() >= 6);
    }

    #[test]
    fn test_wind_seismic_exclusion_valid() {
        // IS 456 auto-generated combos should never mix wind + seismic
        let mut engine = LoadCombinationEngine::new();
        engine.add_load_case(make_test_load_case("DL", LoadCaseType::Dead, 1.0));
        engine.add_load_case(make_test_load_case("LL", LoadCaseType::Live, 0.5));
        engine.add_load_case(make_test_load_case("WL", LoadCaseType::Wind, 0.3));
        engine.add_load_case(make_test_load_case("EQ", LoadCaseType::Seismic, 0.6));

        engine.generate_combinations(CombinationCode::IS456);
        let violations = engine.validate_wind_seismic_exclusion();
        assert!(
            violations.is_empty(),
            "IS 456 auto-combos should not mix WL+EQ: {:?}",
            violations
        );
    }

    #[test]
    fn test_wind_seismic_exclusion_rejects_user_combo() {
        // User-defined combo that mixes WL + EQ should be rejected
        let mut engine = LoadCombinationEngine::new();
        engine.add_load_case(make_test_load_case("DL", LoadCaseType::Dead, 1.0));
        engine.add_load_case(make_test_load_case("WL", LoadCaseType::Wind, 0.3));
        engine.add_load_case(make_test_load_case("EQ", LoadCaseType::Seismic, 0.6));

        let bad_combo = LoadCombination {
            id: "BAD-1".to_string(),
            name: "1.2DL+1.5WL+1.5EQ (ILLEGAL)".to_string(),
            code: CombinationCode::Custom,
            factors: vec![
                LoadFactor {
                    load_case_id: "DL".to_string(),
                    factor: 1.2,
                },
                LoadFactor {
                    load_case_id: "WL".to_string(),
                    factor: 1.5,
                },
                LoadFactor {
                    load_case_id: "EQ".to_string(),
                    factor: 1.5,
                },
            ],
            is_service: false,
        };

        let result = engine.add_combination_checked(bad_combo);
        assert!(result.is_err(), "Should reject wind+seismic combo");
        assert!(result.unwrap_err().contains("IS 1893"));
    }
}
