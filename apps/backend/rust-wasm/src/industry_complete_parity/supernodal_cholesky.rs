#[derive(Debug, Clone)]
pub struct FactorizationResult {
    pub passed: bool,
    pub utilization: f64,
    pub message: String,
    pub clause: String,
}

#[derive(Debug, Clone)]
pub struct SupernodalCholesky {
    pub etree: Vec<i32>,
    pub supernodes: Vec<Supernode>,
    pub symbolic_done: bool,
    pub numeric_done: bool,
    pub ordering: ReorderingMethod,
}

#[derive(Debug, Clone)]
pub struct Supernode {
    pub first_col: usize,
    pub last_col: usize,
    pub row_indices: Vec<usize>,
    pub l_values: Vec<f64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReorderingMethod {
    None,
    MinimumDegree,
    NestedDissection,
    COLAMD,
    RCM,
}

impl Default for SupernodalCholesky {
    fn default() -> Self {
        Self {
            etree: Vec::new(),
            supernodes: Vec::new(),
            symbolic_done: false,
            numeric_done: false,
            ordering: ReorderingMethod::MinimumDegree,
        }
    }
}

#[derive(Debug, Clone)]
pub enum CholeskyError {
    NotPositiveDefinite(usize),
    ZeroPivot(usize),
    NumericalInstability(f64),
}

impl SupernodalCholesky {
    pub fn new(ordering: ReorderingMethod) -> Self {
        Self { ordering, ..Default::default() }
    }

    pub fn compute_amd_ordering(n: usize, col_ptr: &[usize], row_ind: &[usize]) -> Vec<usize> {
        let mut degree: Vec<usize> = vec![0; n];
        let mut perm: Vec<usize> = (0..n).collect();
        let mut eliminated = vec![false; n];

        for i in 0..n {
            degree[i] = col_ptr[i + 1] - col_ptr[i];
        }

        for step in 0..n {
            let mut min_deg = usize::MAX;
            let mut pivot = 0;
            for i in 0..n {
                if !eliminated[i] && degree[i] < min_deg {
                    min_deg = degree[i];
                    pivot = i;
                }
            }
            perm[step] = pivot;
            eliminated[pivot] = true;

            for j in col_ptr[pivot]..col_ptr[pivot + 1] {
                let neighbor = row_ind[j];
                if !eliminated[neighbor] && degree[neighbor] > 0 {
                    degree[neighbor] -= 1;
                }
            }
        }

        perm
    }

    pub fn compute_rcm_ordering(n: usize, col_ptr: &[usize], row_ind: &[usize]) -> Vec<usize> {
        if n == 0 {
            return Vec::new();
        }

        let mut perm = Vec::with_capacity(n);
        let mut visited = vec![false; n];
        let mut queue = std::collections::VecDeque::new();

        let mut start = 0;
        let mut min_degree = usize::MAX;
        for i in 0..n {
            let deg = col_ptr[i + 1] - col_ptr[i];
            if deg < min_degree {
                min_degree = deg;
                start = i;
            }
        }

        queue.push_back(start);
        visited[start] = true;

        while let Some(node) = queue.pop_front() {
            perm.push(node);

            let mut neighbors: Vec<(usize, usize)> = Vec::new();
            for j in col_ptr[node]..col_ptr[node + 1] {
                let neighbor = row_ind[j];
                if !visited[neighbor] {
                    let deg = col_ptr[neighbor + 1] - col_ptr[neighbor];
                    neighbors.push((neighbor, deg));
                }
            }

            neighbors.sort_by_key(|&(_, deg)| deg);

            for (neighbor, _) in neighbors {
                if !visited[neighbor] {
                    visited[neighbor] = true;
                    queue.push_back(neighbor);
                }
            }
        }

        for i in 0..n {
            if !visited[i] {
                perm.push(i);
            }
        }

        perm.reverse();
        perm
    }

    pub fn compute_etree(&mut self, n: usize, col_ptr: &[usize], row_ind: &[usize]) {
        self.etree = vec![-1; n];
        let mut ancestor = vec![0i32; n];

        for k in 0..n {
            ancestor[k] = k as i32;

            for p in col_ptr[k]..col_ptr[k + 1] {
                let i = row_ind[p];
                if i < k {
                    let mut j = i;
                    while ancestor[j] != k as i32 && j != k {
                        if self.etree[j] == -1 {
                            self.etree[j] = k as i32;
                        }
                        let next = ancestor[j] as usize;
                        ancestor[j] = k as i32;
                        j = next;
                    }
                }
            }
        }
    }

    pub fn compute_supernodes(&mut self, n: usize) {
        self.supernodes.clear();
        if n == 0 || self.etree.is_empty() {
            return;
        }

        let mut child_count = vec![0usize; n];
        for i in 0..n {
            if self.etree[i] >= 0 && (self.etree[i] as usize) < n {
                child_count[self.etree[i] as usize] += 1;
            }
        }

        let mut snode_start = vec![0usize];
        for i in 1..n {
            let parent = self.etree[i - 1];
            if parent != i as i32 || child_count[i] > 1 {
                snode_start.push(i);
            }
        }
        snode_start.push(n);

        for w in snode_start.windows(2) {
            self.supernodes.push(Supernode {
                first_col: w[0],
                last_col: w[1] - 1,
                row_indices: Vec::new(),
                l_values: Vec::new(),
            });
        }

        self.symbolic_done = true;
    }

    pub fn factorize(
        &mut self,
        n: usize,
        col_ptr: &[usize],
        row_ind: &[usize],
        values: &[f64],
    ) -> Result<(), CholeskyError> {
        if !self.symbolic_done {
            self.compute_etree(n, col_ptr, row_ind);
            self.compute_supernodes(n);
        }

        let mut l_col_ptr = vec![0usize; n + 1];
        let mut l_row_ind = Vec::new();
        let mut l_values = Vec::new();
        let mut diag = vec![0.0; n];

        for j in 0..n {
            diag[j] = 0.0;
            for p in col_ptr[j]..col_ptr[j + 1] {
                if row_ind[p] == j {
                    diag[j] = values[p];
                    break;
                }
            }

            let l_start = l_col_ptr[j];
            for p in l_start..l_row_ind.len() {
                if l_row_ind[p] == j {
                    diag[j] -= l_values[p] * l_values[p];
                }
            }

            if diag[j] <= 1e-14 {
                return Err(CholeskyError::NotPositiveDefinite(j));
            }

            let ljj = diag[j].sqrt();
            l_col_ptr[j + 1] = l_row_ind.len() + 1;
            l_row_ind.push(j);
            l_values.push(ljj);

            for p in col_ptr[j]..col_ptr[j + 1] {
                let i = row_ind[p];
                if i > j {
                    let mut lij = values[p];
                    lij /= ljj;
                    l_row_ind.push(i);
                    l_values.push(lij);
                }
            }
            l_col_ptr[j + 1] = l_row_ind.len();
        }

        self.numeric_done = true;
        Ok(())
    }

    /// Sparse SPD factorization status check aligned with industry solver precheck workflows.
    pub fn factorization_outcome(&self, matrix_order: usize) -> FactorizationResult {
        let done_count = usize::from(self.symbolic_done) + usize::from(self.numeric_done);
        let utilization = if matrix_order > 0 {
            self.supernodes.len() as f64 / matrix_order as f64
        } else {
            0.0
        };
        let passed = self.symbolic_done && self.numeric_done;
        FactorizationResult {
            passed,
            utilization,
            message: if passed {
                format!("Factorization complete with {} supernodes", self.supernodes.len())
            } else {
                format!("Factorization incomplete ({} of 2 stages)", done_count)
            },
            clause: "Sparse Cholesky solver precheck workflow".to_string(),
        }
    }

    pub fn solve(&self, l_col_ptr: &[usize], l_row_ind: &[usize], l_values: &[f64], b: &[f64]) -> Vec<f64> {
        if b.is_empty() || l_col_ptr.len() < b.len() + 1 || l_values.is_empty() {
            return b.to_vec();
        }

        let n = b.len();
        let mut x = b.to_vec();

        for j in 0..n {
            let dj = l_col_ptr[j];
            if dj >= l_values.len() || l_values[dj].abs() <= f64::EPSILON {
                continue;
            }
            x[j] /= l_values[dj];
            for p in l_col_ptr[j] + 1..l_col_ptr[j + 1] {
                if p >= l_row_ind.len() || p >= l_values.len() {
                    break;
                }
                let i = l_row_ind[p];
                if i < n {
                    x[i] -= l_values[p] * x[j];
                }
            }
        }

        for j in (0..n).rev() {
            for p in l_col_ptr[j] + 1..l_col_ptr[j + 1] {
                if p >= l_row_ind.len() || p >= l_values.len() {
                    break;
                }
                let i = l_row_ind[p];
                if i < n {
                    x[j] -= l_values[p] * x[i];
                }
            }
            let dj = l_col_ptr[j];
            if dj >= l_values.len() || l_values[dj].abs() <= f64::EPSILON {
                continue;
            }
            x[j] /= l_values[dj];
        }

        x
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn factorization_outcome_reports_incomplete_by_default() {
        let solver = SupernodalCholesky::default();
        let out = solver.factorization_outcome(10);
        assert!(!out.passed);
        assert_eq!(out.utilization, 0.0);
    }

    #[test]
    fn solve_returns_rhs_for_invalid_factor_data() {
        let solver = SupernodalCholesky::default();
        let b = vec![1.0, 2.0];
        let x = solver.solve(&[], &[], &[], &b);
        assert_eq!(x, b);
    }
}
