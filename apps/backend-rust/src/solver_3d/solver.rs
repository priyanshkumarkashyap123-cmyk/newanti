use nalgebra::{DMatrix, DVector};

pub fn solve_linear_system(
	k_reduced: &DMatrix<f64>,
	f_reduced: &DVector<f64>,
) -> Result<(DVector<f64>, Option<f64>), String> {
	if k_reduced.nrows() == 0 || k_reduced.ncols() == 0 {
		return Err("Singular stiffness matrix — no free degrees of freedom".to_string());
	}

	let condition_number = estimate_condition_number(k_reduced);

	if let Some(cholesky) = k_reduced.clone().cholesky() {
		let solution = cholesky.solve(f_reduced);
		return Ok((solution, condition_number));
	}

	if let Some(solution) = k_reduced.clone().lu().solve(f_reduced) {
		return Ok((solution, condition_number));
	}

	Err("Singular stiffness matrix — solve failed".to_string())
}

pub fn estimate_condition_number(matrix: &DMatrix<f64>) -> Option<f64> {
	if matrix.nrows() == 0 || matrix.ncols() == 0 {
		return None;
	}

	let svd = matrix.clone().svd(true, true);
	let max_sv = svd.singular_values.iter().cloned().fold(0.0_f64, f64::max);
	let min_sv = svd
		.singular_values
		.iter()
		.cloned()
		.filter(|v| *v > 1e-15)
		.fold(f64::INFINITY, f64::min);

	if !max_sv.is_finite() || !min_sv.is_finite() || min_sv == f64::INFINITY {
		None
	} else {
		Some(max_sv / min_sv)
	}
}
