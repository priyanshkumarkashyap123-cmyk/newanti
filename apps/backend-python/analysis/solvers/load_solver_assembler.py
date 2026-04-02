"""Load vector assembly for load_solver."""

from __future__ import annotations

import logging
from typing import Dict, List, Optional

import numpy as np
from numpy import float64, ndarray

from .load_solver_types import PointLoad, TrapezoidalLoad, UniformLoad
from .load_solver_converters import LoadConverter
from dsm_3d_frame import Element3D, StructuralModel

logger = logging.getLogger(__name__)


class LoadAssembler:
    """Assemble point and converted distributed loads into global vector."""

    @staticmethod
    def assemble_load_vector(
        model: StructuralModel,
        point_loads: List[PointLoad],
        udl_loads: Optional[List[UniformLoad]] = None,
        trap_loads: Optional[List[TrapezoidalLoad]] = None,
    ) -> ndarray:
        n_dofs = model.n_dofs
        P = np.zeros(n_dofs, dtype=float64)

        node_list = sorted(model.nodes.keys())
        node_to_index = {nid: idx for idx, nid in enumerate(node_list)}

        for pload in point_loads:
            if pload.node_id not in model.nodes:
                logger.warning("Point load on unknown node: %s", pload.node_id)
                continue

            node_idx = node_to_index[pload.node_id]
            dof_base = node_idx * 6

            px = float64(pload.Px if abs(float64(pload.Px)) > 1e-12 else pload.fx)
            py = float64(pload.Py if abs(float64(pload.Py)) > 1e-12 else pload.fy)
            pz = float64(pload.Pz if abs(float64(pload.Pz)) > 1e-12 else pload.fz)
            mx = float64(pload.Mx if abs(float64(pload.Mx)) > 1e-12 else pload.mx)
            my = float64(pload.My if abs(float64(pload.My)) > 1e-12 else pload.my)
            mz = float64(pload.Mz if abs(float64(pload.Mz)) > 1e-12 else pload.mz)

            P[dof_base + 0] += px
            P[dof_base + 1] += py
            P[dof_base + 2] += pz
            P[dof_base + 3] += mx
            P[dof_base + 4] += my
            P[dof_base + 5] += mz

        udl_loads = udl_loads or []
        for udl in udl_loads:
            if udl.member_id not in model.elements:
                logger.warning("UDL on unknown member: %s", udl.member_id)
                continue

            element = model.elements[udl.member_id]
            node_i = model.nodes[element.node_i]
            node_j = model.nodes[element.node_j]
            L = float64(np.sqrt((node_j.x - node_i.x) ** 2 + (node_j.y - node_i.y) ** 2 + (node_j.z - node_i.z) ** 2))

            a = float64(udl.a)
            b = float64(udl.b if udl.b > 0 else L)

            if abs(udl.w_y) > 1e-10:
                forces_y, moments_y = LoadConverter.udl_to_ejl_2d(udl.w_y, L, a, b)
                LoadAssembler._add_ejl_to_vector(P, element, node_to_index, forces_y, moments_y, direction="y")

            if abs(udl.w_z) > 1e-10:
                forces_z, moments_z = LoadConverter.udl_to_ejl_2d(udl.w_z, L, a, b)
                LoadAssembler._add_ejl_to_vector(P, element, node_to_index, forces_z, moments_z, direction="z")

        trap_loads = trap_loads or []
        for tload in trap_loads:
            if tload.member_id not in model.elements:
                logger.warning("Trapezoidal load on unknown member: %s", tload.member_id)
                continue

            element = model.elements[tload.member_id]
            node_i = model.nodes[element.node_i]
            node_j = model.nodes[element.node_j]
            L = float64(np.sqrt((node_j.x - node_i.x) ** 2 + (node_j.y - node_i.y) ** 2 + (node_j.z - node_i.z) ** 2))

            a = float64(tload.a)
            b = float64(tload.b if tload.b > 0 else L)

            if abs(tload.w1_y) > 1e-10 or abs(tload.w2_y) > 1e-10:
                forces_y, moments_y = LoadConverter.trapezoidal_load_to_ejl(tload.w1_y, tload.w2_y, L, a, b)
                LoadAssembler._add_ejl_to_vector(P, element, node_to_index, forces_y, moments_y, direction="y")

            if abs(tload.w1_z) > 1e-10 or abs(tload.w2_z) > 1e-10:
                forces_z, moments_z = LoadConverter.trapezoidal_load_to_ejl(tload.w1_z, tload.w2_z, L, a, b)
                LoadAssembler._add_ejl_to_vector(P, element, node_to_index, forces_z, moments_z, direction="z")

        return P

    @staticmethod
    def _add_ejl_to_vector(
        P: ndarray,
        element: Element3D,
        node_to_index: Dict[str, int],
        forces: Dict,
        moments: Dict,
        direction: str = "y",
    ) -> None:
        idx_i = node_to_index[element.node_i]
        idx_j = node_to_index[element.node_j]

        dof_base_i = idx_i * 6
        dof_base_j = idx_j * 6

        if direction == "y":
            P[dof_base_i + 1] += float64(forces["node_i"])
            P[dof_base_j + 1] += float64(forces["node_j"])
            P[dof_base_i + 5] += float64(moments["node_i"])
            P[dof_base_j + 5] += float64(moments["node_j"])
        elif direction == "z":
            P[dof_base_i + 2] += float64(forces["node_i"])
            P[dof_base_j + 2] += float64(forces["node_j"])
            P[dof_base_i + 4] -= float64(moments["node_i"])
            P[dof_base_j + 4] -= float64(moments["node_j"])


__all__ = ["LoadAssembler"]
