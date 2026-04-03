use crate::solver::load_combinations::types::*;
use rayon::prelude::*;
use std::collections::HashMap;

impl LoadCombinationEngine {
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
