"""
dsm_3d_frame_types.py - Type definitions and utility classes for DSM 3D solver

Includes:
- AnalysisResult: Complete result data structure
- BoundaryConditions: Constraint and support handling (penalty method, partitioning)
"""

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from numpy import float64, ndarray
from scipy.sparse import csr_matrix

from analysis.solvers.dsm.types import DOF_NAMES, StructuralModel

logger = logging.getLogger(__name__)


# ============================================
# ANALYSIS RESULT
# ============================================

@dataclass
class AnalysisResult:
    """Complete result of a DSM analysis."""

    displacements: ndarray
    reactions: Dict[str, Dict[str, float64]]
    element_forces: Dict[str, Dict[str, float64]]
    node_displacements: Dict[str, Dict[str, float64]]
    max_displacement: float64
    condition_number: Optional[float64] = None
    solve_time_ms: float64 = float64(0.0)
    n_dofs: int = 0
    warnings: List[str] = field(default_factory=list)


# ============================================
# BOUNDARY CONDITIONS
# ============================================

class BoundaryConditions:
    """Apply supports via penalty method or DOF partitioning."""

    @staticmethod
    def _penalty_value(K: csr_matrix) -> float64:
        """Calculate suitable penalty parameter from matrix diagonal."""
        diag = K.diagonal()
        max_diag = np.max(np.abs(diag))
        return float64(max(max_diag * 1e8, 1e14))

    @staticmethod
    def apply_penalty(
        K: csr_matrix, F: ndarray,
        model: StructuralModel,
        nmap: Dict[str, int],
    ) -> Tuple[csr_matrix, ndarray]:
        """
        Penalty method: K[i,i] += alpha, F[i] = alpha * prescribed_value.
        
        Args:
            K: Global stiffness matrix (CSR format)
            F: Global load vector
            model: Structural model with nodes and restraints
            nmap: Node ID to index mapping
        
        Returns:
            Modified (K, F) with boundary conditions enforced
        """
        penalty = BoundaryConditions._penalty_value(K)
        K_lil = K.tolil()
        F_mod = F.copy()

        for nid, node in model.nodes.items():
            idx = nmap[nid]
            for off, dname in enumerate(DOF_NAMES):
                if node.restraints.get(dname, False):
                    g = idx * 6 + off
                    K_lil[g, g] += penalty
                    prescribed = node.prescribed.get(dname, 0.0)
                    F_mod[g] = penalty * float64(prescribed)

        return K_lil.tocsr(), F_mod

    @staticmethod
    def apply_partitioning(
        K: csr_matrix, F: ndarray,
        model: StructuralModel,
        nmap: Dict[str, int],
    ) -> Tuple[ndarray, ndarray, ndarray]:
        """
        DOF partitioning: separate free (f) and restrained (s) DOFs.
        
        Args:
            K: Global stiffness matrix
            F: Global load vector
            model: Structural model
            nmap: Node ID to index mapping
        
        Returns:
            (free_dofs_array, restrained_dofs_array, prescribed_values)
        """
        rest_dofs = []
        prescribed = []
        for nid, node in model.nodes.items():
            idx = nmap[nid]
            for off, dname in enumerate(DOF_NAMES):
                if node.restraints.get(dname, False):
                    g = idx * 6 + off
                    rest_dofs.append(g)
                    prescribed.append(float64(node.prescribed.get(dname, 0.0)))

        rest_dofs_arr = np.array(rest_dofs, dtype=np.intp)
        prescribed_arr = np.array(prescribed, dtype=float64)
        all_dofs = np.arange(model.n_dofs, dtype=np.intp)
        free_dofs_arr = np.setdiff1d(all_dofs, rest_dofs_arr)

        return free_dofs_arr, rest_dofs_arr, prescribed_arr


__all__ = [
    "AnalysisResult",
    "BoundaryConditions",
]
