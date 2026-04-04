from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict

import numpy as np
from numpy import float64, ndarray

DOF_NAMES = ("ux", "uy", "uz", "rx", "ry", "rz")
DOFS_PER_NODE = 6


@dataclass
class Node3D:
    """A node in 3-D space with 6 DOFs: Ux, Uy, Uz, Rx, Ry, Rz."""

    id: str
    x: float64
    y: float64
    z: float64
    restraints: Dict[str, bool] = field(default_factory=dict)
    prescribed: Dict[str, float64] = field(default_factory=dict)

    def dof_indices(self, node_index: int) -> ndarray:
        base = node_index * DOFS_PER_NODE
        return np.arange(base, base + DOFS_PER_NODE, dtype=np.intp)


@dataclass
class Element3D:
    """3-D beam/column element connecting two nodes (Timoshenko formulation)."""

    id: str
    node_i: str
    node_j: str

    # Material
    E: float64 = float64(200e6)
    G: float64 = float64(77e6)
    rho: float64 = float64(7850)

    # Section
    A: float64 = float64(0.015)
    Iy: float64 = float64(8e-5)
    Iz: float64 = float64(1.2e-4)
    J: float64 = float64(1e-4)
    Ay: float64 = float64(0.012)
    Az: float64 = float64(0.012)

    # Orientation
    beta_angle: float64 = float64(0.0)

    # Member-end releases
    releases: Dict[str, bool] = field(default_factory=dict)

    # Computed by solver
    length: float64 = float64(0.0)

    # Element type flag
    element_type: str = "frame"


@dataclass
class MemberLoad:
    """Load applied along a member (between nodes)."""

    element_id: str
    load_type: str   # "udl" | "point" | "trapez" | "temperature"
    direction: str   # "local_y" | "local_z" | "local_x" | "global_y" etc.
    w1: float64 = float64(0.0)
    w2: float64 = float64(0.0)
    a: float64 = float64(0.0)
    delta_T: float64 = float64(0.0)
    delta_T_gradient: float64 = float64(0.0)


@dataclass
class StructuralModel:
    """Complete 3-D structural model ready for analysis."""

    nodes: Dict[str, Node3D] = field(default_factory=dict)
    elements: Dict[str, Element3D] = field(default_factory=dict)
    nodal_loads: Dict[str, Dict[str, float64]] = field(default_factory=dict)
    member_loads: list[MemberLoad] = field(default_factory=list)
    include_self_weight: bool = False
    gravity_direction: str = "y"
    gravity_magnitude: float64 = float64(9.81)

    @property
    def n_nodes(self) -> int:
        return len(self.nodes)

    @property
    def n_dofs(self) -> int:
        return self.n_nodes * DOFS_PER_NODE


__all__ = [
    "DOF_NAMES",
    "DOFS_PER_NODE",
    "Node3D",
    "Element3D",
    "MemberLoad",
    "StructuralModel",
]
