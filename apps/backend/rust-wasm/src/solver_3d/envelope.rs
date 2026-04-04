use std::collections::HashMap;

use super::types::{AnalysisResult3D, EnvelopeResult, LoadCombination, MemberForces};

pub fn combine_load_cases(
	cases: &HashMap<String, AnalysisResult3D>,
	combination: &LoadCombination,
) -> Result<AnalysisResult3D, String> {
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

		for (node_id, disp) in &result.displacements {
			let entry: &mut Vec<f64> = combined_disp
				.entry(node_id.clone())
				.or_insert_with(|| vec![0.0_f64; 6]);
			for i in 0..std::cmp::min(6usize, disp.len()) {
				entry[i] += factor * disp[i];
			}
		}

		for (node_id, rxn) in &result.reactions {
			let entry: &mut Vec<f64> = combined_rxn
				.entry(node_id.clone())
				.or_insert_with(|| vec![0.0_f64; 6]);
			for i in 0..std::cmp::min(6usize, rxn.len()) {
				entry[i] += factor * rxn[i];
			}
		}

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
			for i in 0..6.min(mf.forces_i.len()) {
				entry.forces_i[i] += factor * mf.forces_i[i];
				entry.forces_j[i] += factor * mf.forces_j[i];
			}
		}
	}

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
		equilibrium_check: None,
		condition_number: None,
	})
}

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

		for (elem_id, mf) in &result.member_forces {
			let demand = mf.max_moment_z.max(mf.max_moment_y).max(mf.max_axial);
			let entry: std::collections::hash_map::Entry<'_, String, MemberForces> =
				max_forces.entry(elem_id.clone());
			match entry {
				std::collections::hash_map::Entry::Vacant(e) => {
					e.insert(mf.clone());
					governing.insert(elem_id.clone(), combo_name.clone());
				}
				std::collections::hash_map::Entry::Occupied(mut e) => {
					let existing = e.get();
					let existing_demand = existing.max_moment_z.max(existing.max_moment_y).max(existing.max_axial);
					if demand > existing_demand {
						e.insert(mf.clone());
						governing.insert(elem_id.clone(), combo_name.clone());
					}
				}
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
