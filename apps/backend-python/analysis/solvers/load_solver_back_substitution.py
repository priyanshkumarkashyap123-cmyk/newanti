"""Back-substitution and force recovery for load_solver."""

from __future__ import annotations

from typing import Dict

import numpy as np
from numpy import float64, ndarray

from dsm_3d_frame import (
    CoordinateTransformations3D,
    Element3D,
    FixedEndForces,
    StructuralModel,
    TimoshenkoBeamElement3D,
)


class BackSubstitution:
    """Recover local member end forces from nodal displacements."""

    @staticmethod
    def calculate_member_end_forces(model: StructuralModel, displacements: ndarray) -> Dict[str, Dict]:
        member_forces: Dict[str, Dict] = {}

        node_list = sorted(model.nodes.keys())
        node_to_index = {nid: idx for idx, nid in enumerate(node_list)}

        for elem_id, element in model.elements.items():
            node_i = model.nodes[element.node_i]
            node_j = model.nodes[element.node_j]

            L = float64(np.sqrt((node_j.x - node_i.x) ** 2 + (node_j.y - node_i.y) ** 2 + (node_j.z - node_i.z) ** 2))

            i_idx = node_to_index[element.node_i]
            j_idx = node_to_index[element.node_j]
            dofs = np.array([
                i_idx * 6,
                i_idx * 6 + 1,
                i_idx * 6 + 2,
                i_idx * 6 + 3,
                i_idx * 6 + 4,
                i_idx * 6 + 5,
                j_idx * 6,
                j_idx * 6 + 1,
                j_idx * 6 + 2,
                j_idx * 6 + 3,
                j_idx * 6 + 4,
                j_idx * 6 + 5,
            ])

            U_global = displacements[dofs].reshape(12, 1)
            cos_mat = CoordinateTransformations3D.direction_cosines(node_i, node_j)
            T = CoordinateTransformations3D.transformation_matrix_12x12(cos_mat)
            U_local = (T @ U_global).flatten()

            k_local = TimoshenkoBeamElement3D.local_stiffness_matrix(element, L)
            f_local = k_local @ U_local

            for ml in getattr(model, "member_loads", []):
                if getattr(ml, "element_id", None) != elem_id:
                    continue

                load_type = str(getattr(ml, "load_type", "")).lower()