"""Solver executor for load_solver."""

from __future__ import annotations

import numpy as np
from numpy import float64, ndarray
from scipy.sparse import csr_matrix
from scipy.sparse.linalg import spsolve


class SolverExecutor:
    """Solve [K]{D}={P}."""

    @staticmethod
    def solve_system(K: csr_matrix, P: ndarray, solver_type: str = "spsolve") -> ndarray:
        if solver_type != "spsolve":
            raise ValueError(f"Unknown solver: {solver_type}")
        D = spsolve(K, P, permc_spec="COLAMD")
        return np.asarray(D, dtype=float64).flatten()


__all__ = ["SolverExecutor"]
