#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReorderingMethod {
    None,
    MinimumDegree,
    NestedDissection,
    COLAMD,
    RCM,
}

#[derive(Debug, Clone)]
pub struct Supernode {
    pub first_col: usize,
    pub last_col: usize,
    pub row_indices: Vec<usize>,
    pub l_values: Vec<f64>,
}

#[derive(Debug, Clone)]
pub struct SupernodalCholesky {
    pub etree: Vec<i32>,
    pub supernodes: Vec<Supernode>,
    pub symbolic_done: bool,
    pub numeric_done: bool,
    pub ordering: ReorderingMethod,
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

        let mut snode_start = Vec::new();
        snode_start.push(0);
        for i in 1..n {
            if child_count[i - 1] != child_count[i] || self.etree[i - 1] != self.etree[i] {
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
    }
}