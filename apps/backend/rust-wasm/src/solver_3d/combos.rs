//! Load combination helpers and envelopes.

use std::collections::HashMap;

use super::types::{AnalysisResult3D, EnvelopeResult, LoadCombination, MemberForces};

/// Linearly combine multiple load case results using factored superposition.
/// `cases`: map of case_name → analysis result for that isolated load case.
/// `combination`: load factors to apply.
///
/// Combined result: u_combined = Σ(factor_i × u_i), R_combined = Σ(factor_i × R_i), etc.
pub fn combine_load_cases(
	cases: &HashMap<String, AnalysisResult3D>,
	combination: &LoadCombination,
) -> Result<AnalysisResult3D, String> {
	// Validate all referenced cases exist
	for (case_name, _factor) in &combination.factors {
		if !cases.contains_key(case_name) {
			return Err(format!(
				"Load combination '{}' references case '{}' which has no results",
				combination.name, case_name
			));
		}
	}

	let mut combined_disp: HashMap<String, Vec<f64>> = HashMap::new();
	let mut combined_rxn: HashMap<String, Vec<f64>> = HashMap::new();
	let mut combined_forces: HashMap<String, MemberForces> = HashMap::new();

	for (case_name, factor) in &combination.factors {
		let result = &cases[case_name];

		// Combine displacements
		for (node_id, disp) in &result.displacements {
			let entry: &mut Vec<f64> = combined_disp
				.entry(node_id.clone())
				.or_insert_with(|| vec![0.0_f64; 6]);
			for i in 0..std::cmp::min(6usize, disp.len()) {
				entry[i] += factor * disp[i];
			}
		}

		// Combine reactions
		for (node_id, rxn) in &result.reactions {
			let entry: &mut Vec<f64> = combined_rxn
				.entry(node_id.clone())
				.or_insert_with(|| vec![0.0_f64; 6]);
			for i in 0..std::cmp::min(6usize, rxn.len()) {
				entry[i] += factor * rxn[i];
			}
		}

		// Combine member forces
		for (elem_id, mf) in &result.member_forces {
			let entry: &mut MemberForces = combined_forces
				.entry(elem_id.clone())
				.or_insert_with(|| MemberForces {
				forces_i: vec![0.0_f64; 6],
				forces_j: vec![0.0_f64; 6],
				max_shear_y: 0.0,
				max_shear_z: 0.0,
				max_moment_y: 0.0,
				max_moment_z: 0.0,
				max_axial: 0.0,
				max_torsion: 0.0,
			});
			for i in 0..std::cmp::min(6usize, mf.forces_i.len()) {
				entry.forces_i[i] += factor * mf.forces_i[i];
				entry.forces_j[i] += factor * mf.forces_j[i];
			}
		}
	}

	// Recompute max values from combined member forces
	for (_elem_id, mf) in combined_forces.iter_mut() {
		mf.max_axial = mf.forces_i[0].abs().max(mf.forces_j[0].abs());
		mf.max_shear_y = mf.forces_i[1].abs().max(mf.forces_j[1].abs());
		mf.max_shear_z = mf.forces_i[2].abs().max(mf.forces_j[2].abs());
		mf.max_torsion = mf.forces_i[3].abs().max(mf.forces_j[3].abs());
		mf.max_moment_y = mf.forces_i[4].abs().max(mf.forces_j[4].abs());
		mf.max_moment_z = mf.forces_i[5].abs().max(mf.forces_j[5].abs());
	}

	Ok(AnalysisResult3D {
		success: true,
		error: None,
		displacements: combined_disp,
		reactions: combined_rxn,
		member_forces: combined_forces,
		plate_results: HashMap::new(),
		equilibrium_check: None, // Not meaningful for combined results
		condition_number: None,
	})
}

/// Compute envelope (max/min) across multiple load combinations.
/// Takes individual load case results and a list of combinations.
/// Returns the governing max/min for every node and member.
pub fn compute_envelope(
	cases: &HashMap<String, AnalysisResult3D>,
	combinations: &[LoadCombination],
) -> Result<EnvelopeResult, String> {
	let mut combo_results: Vec<(String, AnalysisResult3D)> = Vec::new();

	for combo in combinations {
		let result = combine_load_cases(cases, combo)?;
		combo_results.push((combo.name.clone(), result));
	}

	let mut max_disp: HashMap<String, Vec<f64>> = HashMap::new();
	let mut min_disp: HashMap<String, Vec<f64>> = HashMap::new();
	let mut max_rxn: HashMap<String, Vec<f64>> = HashMap::new();
	let mut min_rxn: HashMap<String, Vec<f64>> = HashMap::new();
	let mut max_forces: HashMap<String, MemberForces> = HashMap::new();
	let mut governing: HashMap<String, String> = HashMap::new();

	for (combo_name, result) in &combo_results {
		// Envelope displacements
		for (node_id, disp) in &result.displacements {
			let max_entry: &mut Vec<f64> = max_disp
				.entry(node_id.clone())
				.or_insert_with(|| vec![f64::NEG_INFINITY; 6]);
			let min_entry: &mut Vec<f64> = min_disp
				.entry(node_id.clone())
				.or_insert_with(|| vec![f64::INFINITY; 6]);
			for i in 0..std::cmp::min(6usize, disp.len()) {
				max_entry[i] = max_entry[i].max(disp[i]);
				min_entry[i] = min_entry[i].min(disp[i]);
			}
		}

		// Envelope reactions
		for (node_id, rxn) in &result.reactions {
			let max_entry: &mut Vec<f64> = max_rxn
				.entry(node_id.clone())
				.or_insert_with(|| vec![f64::NEG_INFINITY; 6]);
			let min_entry: &mut Vec<f64> = min_rxn
				.entry(node_id.clone())
				.or_insert_with(|| vec![f64::INFINITY; 6]);
			for i in 0..std::cmp::min(6usize, rxn.len()) {
				max_entry[i] = max_entry[i].max(rxn[i]);
				min_entry[i] = min_entry[i].min(rxn[i]);
			}
		}

		// Envelope member forces → governs on max absolute moment or axial
		for (elem_id, mf) in &result.member_forces {
			let demand = mf.max_moment_z.max(mf.max_moment_y).max(mf.max_axial);
			let entry: std::collections::hash_map::Entry<'_, String, MemberForces> =
				max_forces.entry(elem_id.clone());
			match entry {
				std::collections::hash_map::Entry::Vacant(e) => {
					e.insert(mf.clone());
					governing.insert(elem_id.clone(), combo_name.clone());
				},
				std::collections::hash_map::Entry::Occupied(mut e) => {
					let existing = e.get();
					let existing_demand = existing.max_moment_z.max(existing.max_moment_y).max(existing.max_axial);
					if demand > existing_demand {
						e.insert(mf.clone());
						governing.insert(elem_id.clone(), combo_name.clone());
					}
				},
			}
		}
	}

	Ok(EnvelopeResult {
		max_displacements: max_disp,
		min_displacements: min_disp,
		max_reactions: max_rxn,
		min_reactions: min_rxn,
		max_member_forces: max_forces,
		governing_combo: governing,
		combination_results: combo_results,
	})
}

/// Standard load combinations per IS 800:2007 (Indian Standard)
/// Table 4: Partial safety factors for loads
pub fn standard_combinations_is800() -> Vec<LoadCombination> {
	vec![
		// Ultimate Limit State (ULS)
		LoadCombination { name: "IS800-1: 1.5DL + 1.5LL".into(),
			factors: vec![("DL".into(), 1.5), ("LL".into(), 1.5)] },
		LoadCombination { name: "IS800-2: 1.5DL + 1.5WL".into(),
			factors: vec![("DL".into(), 1.5), ("WL".into(), 1.5)] },
		LoadCombination { name: "IS800-3: 1.2DL + 1.2LL + 1.2WL".into(),
			factors: vec![("DL".into(), 1.2), ("LL".into(), 1.2), ("WL".into(), 1.2)] },
		LoadCombination { name: "IS800-4: 1.5DL + 1.5EQ".into(),
			factors: vec![("DL".into(), 1.5), ("EQ".into(), 1.5)] },
		LoadCombination { name: "IS800-5: 1.2DL + 1.2LL + 1.2EQ".into(),
			factors: vec![("DL".into(), 1.2), ("LL".into(), 1.2), ("EQ".into(), 1.2)] },
		LoadCombination { name: "IS800-6: 0.9DL + 1.5WL".into(),
			factors: vec![("DL".into(), 0.9), ("WL".into(), 1.5)] },
		LoadCombination { name: "IS800-7: 0.9DL + 1.5EQ".into(),
			factors: vec![("DL".into(), 0.9), ("EQ".into(), 1.5)] },
		// Serviceability Limit State (SLS)
		LoadCombination { name: "IS800-SLS1: 1.0DL + 1.0LL".into(),
			factors: vec![("DL".into(), 1.0), ("LL".into(), 1.0)] },
		LoadCombination { name: "IS800-SLS2: 1.0DL + 1.0WL".into(),
			factors: vec![("DL".into(), 1.0), ("WL".into(), 1.0)] },
		LoadCombination { name: "IS800-SLS3: 1.0DL + 0.8LL + 0.8WL".into(),
			factors: vec![("DL".into(), 1.0), ("LL".into(), 0.8), ("WL".into(), 0.8)] },
	]
}

/// Standard load combinations per EN 1990/Eurocode 0
/// Eq. 6.10a/b with ψ factors from EN 1990 Table A1.1
pub fn standard_combinations_eurocode() -> Vec<LoadCombination> {
	vec![
		// ULS STR/GEO (Set B)
		LoadCombination { name: "EC-1: 1.35G + 1.5Q".into(),
			factors: vec![("DL".into(), 1.35), ("LL".into(), 1.5)] },
		LoadCombination { name: "EC-2: 1.35G + 1.5Q + 0.9W".into(),
			factors: vec![("DL".into(), 1.35), ("LL".into(), 1.5), ("WL".into(), 0.9)] },
		LoadCombination { name: "EC-3: 1.35G + 1.5W + 1.05Q".into(),
			factors: vec![("DL".into(), 1.35), ("WL".into(), 1.5), ("LL".into(), 1.05)] },
		LoadCombination { name: "EC-4: 1.0G + 1.5W".into(),
			factors: vec![("DL".into(), 1.0), ("WL".into(), 1.5)] },
		// ULS Accidental (seismic)
		LoadCombination { name: "EC-5: 1.0G + 0.3Q + 1.0E".into(),
			factors: vec![("DL".into(), 1.0), ("LL".into(), 0.3), ("EQ".into(), 1.0)] },
		// SLS Characteristic
		LoadCombination { name: "EC-SLS1: 1.0G + 1.0Q".into(),
			factors: vec![("DL".into(), 1.0), ("LL".into(), 1.0)] },
		LoadCombination { name: "EC-SLS2: 1.0G + 1.0Q + 0.6W".into(),
			factors: vec![("DL".into(), 1.0), ("LL".into(), 1.0), ("WL".into(), 0.6)] },
		// SLS Frequent
		LoadCombination { name: "EC-SLS3: 1.0G + 0.5Q".into(),
			factors: vec![("DL".into(), 1.0), ("LL".into(), 0.5)] },
	]
}

/// Standard load combinations per AISC 360 / ASCE 7 (LRFD)
/// Chapter 2: Combinations for Strength Design
pub fn standard_combinations_aisc_lrfd() -> Vec<LoadCombination> {
	vec![
		// ASCE 7-22 Section 2.3.1
		LoadCombination { name: "LRFD-1: 1.4D".into(),
			factors: vec![("DL".into(), 1.4)] },
		LoadCombination { name: "LRFD-2: 1.2D + 1.6L + 0.5S".into(),
			factors: vec![("DL".into(), 1.2), ("LL".into(), 1.6), ("SL".into(), 0.5)] },
		LoadCombination { name: "LRFD-3: 1.2D + 1.6S + 0.5L".into(),
			factors: vec![("DL".into(), 1.2), ("SL".into(), 1.6), ("LL".into(), 0.5)] },
		LoadCombination { name: "LRFD-4: 1.2D + 1.0W + 0.5L + 0.5S".into(),
			factors: vec![("DL".into(), 1.2), ("WL".into(), 1.0), ("LL".into(), 0.5), ("SL".into(), 0.5)] },
		LoadCombination { name: "LRFD-5: 1.2D + 1.0E + 0.5L + 0.2S".into(),
			factors: vec![("DL".into(), 1.2), ("EQ".into(), 1.0), ("LL".into(), 0.5), ("SL".into(), 0.2)] },
		LoadCombination { name: "LRFD-6: 0.9D + 1.0W".into(),
			factors: vec![("DL".into(), 0.9), ("WL".into(), 1.0)] },
		LoadCombination { name: "LRFD-7: 0.9D + 1.0E".into(),
			factors: vec![("DL".into(), 0.9), ("EQ".into(), 1.0)] },
		// ASD combinations
		LoadCombination { name: "ASD-1: 1.0D".into(),
			factors: vec![("DL".into(), 1.0)] },
		LoadCombination { name: "ASD-2: 1.0D + 1.0L".into(),
			factors: vec![("DL".into(), 1.0), ("LL".into(), 1.0)] },
		LoadCombination { name: "ASD-3: 1.0D + 0.75L + 0.75S".into(),
			factors: vec![("DL".into(), 1.0), ("LL".into(), 0.75), ("SL".into(), 0.75)] },
		LoadCombination { name: "ASD-4: 1.0D + 0.6W".into(),
			factors: vec![("DL".into(), 1.0), ("WL".into(), 0.6)] },
	]
}
