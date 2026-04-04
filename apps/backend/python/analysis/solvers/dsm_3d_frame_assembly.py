"""
dsm_3d_frame_assembly.py - Global assembly for DSM 3D frame solver

Implements global stiffness matrix and load vector assembly from model definition.
Handles element contributions, member loads, and self-weight.
"""

import logging
import math
from typing import Dict, List, Tuple

import numpy as np
from numpy import float64, ndarray
from scipy.sparse import coo_matrix, csr_matrix

from analysis.solvers.dsm.types import (
    DOF_NAMES,
    StructuralModel,
)
from .dsm_3d_frame_primitives import (
    FixedEndForces,
    TimoshenkoBeam3D,
    Transform3D,
    apply_releases_static_condensation,
)

logger = logging.getLogger(__name__)


# ============================================
# GLOBAL ASSEMBLY (COO -> CSR Sparse)
# ============================================

class SparseAssembler:
    """Global assembly: build sparse K and F from model definition."""

    @staticmethod
    def assemble(model: StructuralModel) -> Tuple[csr_matrix, ndarray, Dict[str, int], Dict[int, str], Dict[str, Dict]]:
        """
        Assemble global stiffness matrix and load vector.
        
        Args:
            model: Structural model with nodes, elements, loads
        
        Returns:
            (K_sparse, F_vector, node_map, dof_map, element_data)
        """
        _element_data: Dict[str, Dict] = {}
        nmap: Dict[str, int] = {}
        dmap: Dict[int, str] = {}

        # Node indexing
        for i, nid in enumerate(model.nodes.keys()):
            nmap[nid] = i
            for off, dname in enumerate(DOF_NAMES):
                dmap[i * 6 + off] = f"{nid}:{dname}"

        n_dofs = model.n_dofs
        rows: List[int] = []
        cols: List[int] = []
        vals: List[float64] = []
        F = np.zeros(n_dofs, dtype=float64)

        # Elements
        for el_id, el in model.elements.items():
            if el.node_i not in model.nodes or el.node_j not in model.nodes:
                logger.warning(f"Element {el_id} references missing nodes")
                continue

            ni = model.nodes[el.node_i]
            nj = model.nodes[el.node_j]
            Li, Lj = ni.dof_indices(nmap[el.node_i]), nj.dof_indices(nmap[el.node_j])
            dofs = np.concatenate([Li, Lj])

            dx = nj.x - ni.x
            dy = nj.y - ni.y
            dz = nj.z - ni.z
            L = float64(math.sqrt(dx * dx + dy * dy + dz * dz))
            if L <= 0:
                logger.warning(f"Element {el_id} has zero length; skipped")
                continue
            el.length = L

            # Local stiffness and transform
            k_local = TimoshenkoBeam3D.local_stiffness(el, L)
            T = Transform3D.direction_cosines(dx, dy, dz, el.beta_angle)
            k_global = T.T @ k_local @ T

            # Static condensation for releases
            k_local, T_sc = apply_releases_static_condensation(el.releases, k_local)
            k_global = T.T @ k_local @ T_sc

            # Accumulate COO entries
            for a in range(12):
                for b in range(12):
                    rows.append(int(dofs[a]))
                    cols.append(int(dofs[b]))
                    vals.append(float64(k_global[a, b]))
            
            # Store element data for later back-substitution
            _element_data[el_id] = {
                "dofs": dofs,
                "L": L,
                "T": T,
                "k_local": k_local,
            }

        # Apply nodal loads
        for nid, loads in model.nodal_loads.items():
            if nid not in nmap:
                continue
            idx = nmap[nid]
            for off, dname in enumerate(DOF_NAMES):
                load_val = loads.get(dname, 0.0)
                if load_val != 0.0:
                    F[idx * 6 + off] += float64(load_val)

        # Apply self-weight (nodal contributions from element gravity)
        if model.include_self_weight:
            for el_id, el in model.elements.items():
                if el_id not in _element_data:
                    continue
                ni = model.nodes[el.node_i]
                nj = model.nodes[el.node_j]
                
                # Weight per unit length
                w_line = el.rho * el.A * model.gravity_magnitude / 1000.0  # kN/m
                
                # Distribute to nodes (half to each)
                wl_half = w_line * _element_data[el_id]["L"] / 2.0
                
                idx_i = nmap[el.node_i]
                idx_j = nmap[el.node_j]
                
                # Global Y (Z for vertical in some conventions, here we use Y)
                F[idx_i * 6 + 1] -= float64(wl_half)  # Uy (or UZ for gravity)
                F[idx_j * 6 + 1] -= float64(wl_half)

        # Apply member loads (fixed-end forces)
        for ml in model.member_loads:
            if ml.element_id not in model.elements or ml.element_id not in _element_data:
                continue
            
            el = model.elements[ml.element_id]
            el_data = _element_data[ml.element_id]
            L = el_data["L"]
            T = el_data["T"]
            dofs = el_data["dofs"]
            
            # Calculate fixed-end forces in local coordinates
            if ml.load_type == "udl":
                fef_local = FixedEndForces.udl_local(float64(ml.w1), L, ml.direction)
            elif ml.load_type == "trapez":
                fef_local = FixedEndForces.trapez_local(
                    float64(ml.w1), float64(ml.w2), L, ml.direction
                )
            elif ml.load_type == "point":
                a = float64(ml.a) if ml.a > 0 else L / 2.0
                fef_local = FixedEndForces.point_load_local(
                    float64(ml.w1), a, L, ml.direction
                )
            elif ml.load_type == "temperature":
                fef_local = FixedEndForces.temperature_local(
                    el, L, float64(ml.delta_T), float64(ml.delta_T_gradient),
                )
            else:
                continue
            
            # Transform to global coordinates
            fef_global = T.T @ fef_local if ml.direction.startswith("local") else fef_local
            for li in range(12):
                F[dofs[li]] -= fef_global[li]

        # Assemble sparse matrix from COO format
        K_coo = coo_matrix(
            (vals, (rows, cols)),
            shape=(n_dofs, n_dofs),
            dtype=float64
        )
        K = K_coo.tocsr()

        logger.info(
            f"Assembly complete: K shape={K.shape}, nnz={K.nnz}, "
            f"density={K.nnz / (K.shape[0]**2):.6f}"
        )

        return K, F, nmap, dmap, _element_data


__all__ = [
    "SparseAssembler",
]
