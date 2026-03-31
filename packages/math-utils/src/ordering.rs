use nalgebra::{DMatrix, DVector};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphOrdering {
    pub node_count: usize,
    pub adjacency: Vec<Vec<usize>>,
}

impl GraphOrdering {
    pub fn from_csr(n: usize, col_ptr: &[usize], row_ind: &[usize]) -> Self {
        let mut adjacency = vec![Vec::new(); n];
        for i in 0..n {
            for j in col_ptr[i]..col_ptr[i + 1] {
                adjacency[i].push(row_ind[j]);
            }
        }
        Self { node_count: n, adjacency }
    }

    pub fn degrees(&self) -> Vec<usize> {
        self.adjacency.iter().map(Vec::len).collect()
    }

    pub fn as_matrix(&self) -> DMatrix<f64> {
        let mut m = DMatrix::<f64>::zeros(self.node_count, self.node_count);
        for (i, nbrs) in self.adjacency.iter().enumerate() {
            for &j in nbrs {
                if i < self.node_count && j < self.node_count {
                    m[(i, j)] = 1.0;
                }
            }
        }
        m
    }
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
    let mut queue = VecDeque::new();

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

pub fn apply_permutation(vec: &DVector<f64>, perm: &[usize]) -> DVector<f64> {
    let mut out = DVector::zeros(vec.len());
    for (i, &p) in perm.iter().enumerate() {
        if p < vec.len() {
            out[i] = vec[p];
        }
    }
    out
}
