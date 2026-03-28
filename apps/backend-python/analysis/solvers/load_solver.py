"""
load_solver.py - Load application and solver execution module

Handles:
1. Load application (point loads, moments, UDLs)
2. UDL/trapezoidal to equivalent nodal actions conversion
3. Linear sparse solve
4. Local member end-force recovery (with FEF correction)
5. Result formatting for frontend consumption

Unit conventions:
    Forces: kN
    Lengths: m
    Loads: kN/m or kN/m²
    Moments: kN·m
    Displacements: mm (converted downstream)

Sign conventions:
    Positive shear/moment per right-hand rule convention
    Positive axial tension, negative compression
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional, Tuple

import numpy as np
from numpy import float64, ndarray
from scipy.sparse import csr_matrix
from scipy.sparse.linalg import spsolve

from dsm_3d_frame import (
    BoundaryConditionHandler,
    CoordinateTransformations3D,
    Element3D,
    FixedEndForces,
    GlobalAssembly,
    Node3D,
    StructuralModel,
    TimoshenkoBeamElement3D,
)

logger = logging.getLogger(__name__)


class LoadType(Enum):
    """Load type enumeration."""

    POINT_FORCE = "point_force"
    MOMENT = "moment"
    UDL = "udl"
    TRAPEZOIDAL = "trapezoidal"


@dataclass
class PointLoad:
    """Point load at a node (kN, kN·m)."""

    node_id: str
    Px: float64 = float64(0)
    Py: float64 = float64(0)
    Pz: float64 = float64(0)
    Mx: float64 = float64(0)
    My: float64 = float64(0)
    Mz: float64 = float64(0)

    # Frontend compatibility aliases
    fx: float64 = float64(0)
    fy: float64 = float64(0)
    fz: float64 = float64(0)
    mx: float64 = float64(0)
    my: float64 = float64(0)
    mz: float64 = float64(0)


@dataclass
class UniformLoad:
    """Uniformly distributed load on a member (kN/m)."""

    member_id: str
    w_y: float64 = float64(0)
    w_z: float64 = float64(0)
    w_x: float64 = float64(0)
    a: float64 = float64(0)
    b: float64 = float64(0)


@dataclass
class TrapezoidalLoad:
    """Linearly varying load on a member (kN/m)."""

    member_id: str
    w1_y: float64 = float64(0)
    w2_y: float64 = float64(0)
    w1_z: float64 = float64(0)
    w2_z: float64 = float64(0)
    a: float64 = float64(0)
    b: float64 = float64(0)


class LoadConverter:
    """Convert member distributed loads to equivalent nodal actions."""

    @staticmethod
    def udl_to_ejl_2d(
        w: float64,
        L: float64,
        a: float64 = float64(0),
        b: Optional[float64] = None,
        element_type: str = "timoshenko",
    ) -> Tuple[Dict, Dict]:
        """Equivalent forces/moments for a 2D UDL segment on span L."""
        _ = element_type
        if b is None:
            b = L
        if a > b:
            a, b = b, a

        if abs(a) < 1e-10 and abs(b - L) < 1e-10:
            R_i = float64(w * L / 2.0)
            R_j = float64(w * L / 2.0)
            M_i = float64((w * L * L) / 12.0)
            M_j = float64(-(w * L * L) / 12.0)
        else:
            c = b - a
            x1 = a
            x2 = b
            R_i = float64((w * c / L) * (1 - (x1 + x2) / (2 * L)))
            R_j = float64(w * c - R_i)
            M_i = float64(-(w / (6 * L)) * (x2**3 - x1**3 - 3 * x1 * x2 * (x2 - x1)))
            M_j = float64(
                (w / (6 * L)) * (x2**3 - x1**3 - 3 * x1 * x2 * (x2 - x1)) + w * c * (L - x2)
            )

        return {"node_i": float64(R_i), "node_j": float64(R_j)}, {
            "node_i": float64(M_i),
            "node_j": float64(M_j),
        }

    @staticmethod
    def trapezoidal_load_to_ejl(
        w1: float64,
        w2: float64,
        L: float64,
        a: float64 = float64(0),
        b: Optional[float64] = None,
    ) -> Tuple[Dict, Dict]:
        """Equivalent forces/moments for trapezoidal load over [a, b]."""
        if b is None:
            b = L

        c = b - a
        w_avg = (w1 + w2) / 2.0
        total_load = w_avg * c
        R_i = float64(total_load * (L - (a + b) / 2.0) / L)
        R_j = float64(total_load - R_i)

        w_diff = w2 - w1
        if abs(w_diff) < 1e-10:
            M_i = float64((w1 * c * c) / 12.0)
        else:
            M_i = float64(w1 * c * c * (2 * L - a - b) / 12 + w_diff * c * c * (3 * L - 2 * a - 2 * b) / 36)

        M_j = float64(-M_i - c * (w1 + w2) / 2.0 * (L - (a + b) / 2.0))

        return {"node_i": float64(R_i), "node_j": float64(R_j)}, {
            "node_i": float64(M_i),
            "node_j": float64(M_j),
        }


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


class SolverExecutor:
    """Solve [K]{D}={P}."""

    @staticmethod
    def solve_system(K: csr_matrix, P: ndarray, solver_type: str = "spsolve") -> ndarray:
        if solver_type != "spsolve":
            raise ValueError(f"Unknown solver: {solver_type}")
        D = spsolve(K, P, permc_spec="COLAMD")
        return np.asarray(D, dtype=float64).flatten()


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
                direction = getattr(ml, "direction", "local_y")

                if load_type == "udl":
                    fef = FixedEndForces.udl_local(float64(getattr(ml, "w1", 0.0)), L, direction)
                elif load_type == "trapez":
                    fef = FixedEndForces.trapez_local(
                        float64(getattr(ml, "w1", 0.0)),
                        float64(getattr(ml, "w2", getattr(ml, "w1", 0.0))),
                        L,
                        direction,
                    )
                elif load_type == "point":
                    a = float64(getattr(ml, "a", 0.0))
                    if a <= 0:
                        a = L / 2.0
                    fef = FixedEndForces.point_load_local(float64(getattr(ml, "w1", 0.0)), a, L, direction)
                elif load_type == "temperature":
                    fef = FixedEndForces.temperature_local(
                        element,
                        L,
                        float64(getattr(ml, "delta_T", 0.0)),
                        float64(getattr(ml, "delta_T_gradient", 0.0)),
                    )
                else:
                    continue

                # f_member = k*u - FEF
                f_local = f_local - fef

            member_forces[elem_id] = {
                "axial_i": float64(f_local[0]),
                "shear_y_i": float64(f_local[1]),
                "shear_z_i": float64(f_local[2]),
                "moment_x_i": float64(f_local[3]),
                "moment_y_i": float64(f_local[4]),
                "moment_z_i": float64(f_local[5]),
                "axial_j": float64(f_local[6]),
                "shear_y_j": float64(f_local[7]),
                "shear_z_j": float64(f_local[8]),
                "moment_x_j": float64(f_local[9]),
                "moment_y_j": float64(f_local[10]),
                "moment_z_j": float64(f_local[11]),
                "length": float64(L),
                "element_type": "3d_timoshenko",
            }

        return member_forces


class AnalysisResultFormatter:
    """Format analysis results as JSON-serializable dicts."""

    @staticmethod
    def format_complete_results(
        model: StructuralModel,
        displacements: ndarray,
        member_forces: Dict[str, Dict],
        diagrams: Dict[str, Dict],
        execution_time: float,
        job_id: str = "default",
    ) -> Dict:
        node_list = sorted(model.nodes.keys())

        displacements_formatted = {}
        for i, node_id in enumerate(node_list):
            dof_base = i * 6
            displacements_formatted[node_id] = {
                "ux_mm": float(displacements[dof_base + 0] * 1000),
                "uy_mm": float(displacements[dof_base + 1] * 1000),
                "uz_mm": float(displacements[dof_base + 2] * 1000),
                "rx_rad": float(displacements[dof_base + 3]),
                "ry_rad": float(displacements[dof_base + 4]),
                "rz_rad": float(displacements[dof_base + 5]),
            }

        member_forces_formatted = {}
        for melem_id, forces in member_forces.items():
            member_forces_formatted[melem_id] = {
                "node_i": {
                    "axial_kn": float(forces["axial_i"]),
                    "shear_y_kn": float(forces["shear_y_i"]),
                    "shear_z_kn": float(forces["shear_z_i"]),
                    "torsion_knm": float(forces["moment_x_i"]),
                    "moment_y_knm": float(forces["moment_y_i"]),
                    "moment_z_knm": float(forces["moment_z_i"]),
                },
                "node_j": {
                    "axial_kn": float(forces["axial_j"]),
                    "shear_y_kn": float(forces["shear_y_j"]),
                    "shear_z_kn": float(forces["shear_z_j"]),
                    "torsion_knm": float(forces["moment_x_j"]),
                    "moment_y_knm": float(forces["moment_y_j"]),
                    "moment_z_knm": float(forces["moment_z_j"]),
                },
            }

        return {
            "status": "success",
            "execution_time_seconds": float(execution_time),
            "job_id": job_id,
            "model": {
                "n_nodes": model.n_nodes,
                "n_elements": model.n_elements,
                "n_dofs": model.n_dofs,
            },
            "displacements": displacements_formatted,
            "member_forces": member_forces_formatted,
            "diagrams": diagrams,
        }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print("load_solver module imported successfully")
