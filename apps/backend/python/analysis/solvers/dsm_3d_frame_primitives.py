"""
Foundational data structures and element-level mechanics for the 3D DSM solver.

This module holds the reusable structural model, element stiffness/mass,
coordinate transformation, release condensation, and fixed-end force helpers.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Dict, List

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
    load_type: str
    direction: str
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
    member_loads: List[MemberLoad] = field(default_factory=list)
    include_self_weight: bool = False
    gravity_direction: str = "y"
    gravity_magnitude: float64 = float64(9.81)

    @property
    def n_nodes(self) -> int:
        return len(self.nodes)

    @property
    def n_dofs(self) -> int:
        return self.n_nodes * DOFS_PER_NODE


class TimoshenkoBeam3D:
    """
    Generates the 12x12 local stiffness matrix including Timoshenko
    shear-deformation correction.

    Local DOF order:
        Node i: [ux_i, uy_i, uz_i, rx_i, ry_i, rz_i]
        Node j: [ux_j, uy_j, uz_j, rx_j, ry_j, rz_j]

    Shear parameters (Przemieniecki S5.6):
        phi_y = 12 E Iz / (G Ay L^2)
        phi_z = 12 E Iy / (G Az L^2)

    When G*As -> inf => phi -> 0 => Euler-Bernoulli limit.
    """

    @staticmethod
    def local_stiffness(el: Element3D, L: float64) -> ndarray:
        """Return 12x12 Float64 local stiffness matrix."""

        E = float64(el.E)
        G = float64(el.G)
        A = float64(el.A)
        Iy = float64(el.Iy)
        Iz = float64(el.Iz)
        J = float64(el.J)
        Ay = float64(el.Ay)
        Az = float64(el.Az)
        L = float64(L)
        L2 = L * L
        L3 = L2 * L

        if Ay > 1e-20 and G > 1e-10:
            phi_y = 12.0 * E * Iz / (G * Ay * L2)
        else:
            phi_y = 0.0

        if Az > 1e-20 and G > 1e-10:
            phi_z = 12.0 * E * Iy / (G * Az * L2)
        else:
            phi_z = 0.0

        a1 = E * A / L
        t1 = G * J / L

        ky = 12.0 * E * Iz / (L3 * (1.0 + phi_y))
        ky2 = 6.0 * E * Iz / (L2 * (1.0 + phi_y))
        ky3 = (4.0 + phi_y) * E * Iz / (L * (1.0 + phi_y))
        ky4 = (2.0 - phi_y) * E * Iz / (L * (1.0 + phi_y))

        kz = 12.0 * E * Iy / (L3 * (1.0 + phi_z))
        kz2 = 6.0 * E * Iy / (L2 * (1.0 + phi_z))
        kz3 = (4.0 + phi_z) * E * Iy / (L * (1.0 + phi_z))
        kz4 = (2.0 - phi_z) * E * Iy / (L * (1.0 + phi_z))

        k = np.zeros((12, 12), dtype=float64)

        k[0, 0] = a1
        k[0, 6] = -a1
        k[6, 0] = -a1
        k[6, 6] = a1

        k[3, 3] = t1
        k[3, 9] = -t1
        k[9, 3] = -t1
        k[9, 9] = t1

        k[1, 1] = ky
        k[1, 5] = ky2
        k[1, 7] = -ky
        k[1, 11] = ky2
        k[5, 1] = ky2
        k[5, 5] = ky3
        k[5, 7] = -ky2
        k[5, 11] = ky4
        k[7, 1] = -ky
        k[7, 5] = -ky2
        k[7, 7] = ky
        k[7, 11] = -ky2
        k[11, 1] = ky2
        k[11, 5] = ky4
        k[11, 7] = -ky2
        k[11, 11] = ky3

        k[2, 2] = kz
        k[2, 4] = -kz2
        k[2, 8] = -kz
        k[2, 10] = -kz2
        k[4, 2] = -kz2
        k[4, 4] = kz3
        k[4, 8] = kz2
        k[4, 10] = kz4
        k[8, 2] = -kz
        k[8, 4] = kz2
        k[8, 8] = kz
        k[8, 10] = kz2
        k[10, 2] = -kz2
        k[10, 4] = kz4
        k[10, 8] = kz2
        k[10, 10] = kz3

        return k

    @staticmethod
    def consistent_mass(el: Element3D, L: float64) -> ndarray:
        """12x12 consistent mass matrix for dynamics / self-weight."""
        rho = float64(el.rho)
        A = float64(el.A)
        L = float64(L)
        m = rho * A * L
        c = m / 420.0

        M = np.zeros((12, 12), dtype=float64)

        M[0, 0] = 140.0
        M[0, 6] = 70.0
        M[6, 0] = 70.0
        M[6, 6] = 140.0

        Jx = el.J
        rx = Jx / A if A > 0 else 0
        M[3, 3] = 140.0 * rx
        M[3, 9] = 70.0 * rx
        M[9, 3] = 70.0 * rx
        M[9, 9] = 140.0 * rx

        M[1, 1] = 156.0
        M[1, 5] = 22.0 * L
        M[1, 7] = 54.0
        M[1, 11] = -13.0 * L
        M[5, 1] = 22.0 * L
        M[5, 5] = 4.0 * L * L
        M[5, 7] = 13.0 * L
        M[5, 11] = -3.0 * L * L
        M[7, 1] = 54.0
        M[7, 5] = 13.0 * L
        M[7, 7] = 156.0
        M[7, 11] = -22.0 * L
        M[11, 1] = -13.0 * L
        M[11, 5] = -3.0 * L * L
        M[11, 7] = -22.0 * L
        M[11, 11] = 4.0 * L * L

        M[2, 2] = 156.0
        M[2, 4] = -22.0 * L
        M[2, 8] = 54.0
        M[2, 10] = 13.0 * L
        M[4, 2] = -22.0 * L
        M[4, 4] = 4.0 * L * L
        M[4, 8] = -13.0 * L
        M[4, 10] = -3.0 * L * L
        M[8, 2] = 54.0
        M[8, 4] = -13.0 * L
        M[8, 8] = 156.0
        M[8, 10] = 22.0 * L
        M[10, 2] = 13.0 * L
        M[10, 4] = -3.0 * L * L
        M[10, 8] = 22.0 * L
        M[10, 10] = 4.0 * L * L

        M *= c
        return M


class Transform3D:
    """
    Build [T] (12x12) to rotate local element matrices into global coords.
    [K_global] = [T]^T [K_local] [T]
    Handles vertical members (columns) and arbitrary beta-angle roll.
    """

    @staticmethod
    def direction_cosine_matrix(
        xi: float64,
        yi: float64,
        zi: float64,
        xj: float64,
        yj: float64,
        zj: float64,
        beta_deg: float64 = 0.0,
    ) -> ndarray:
        """3x3 direction-cosine matrix Lambda mapping local -> global axes."""
        dx = float64(xj - xi)
        dy = float64(yj - yi)
        dz = float64(zj - zi)
        L = math.sqrt(dx * dx + dy * dy + dz * dz)

        if L < 1e-12:
            raise ValueError("Zero-length element detected")

        ex = np.array([dx / L, dy / L, dz / L], dtype=float64)
        horizontal_proj = math.sqrt(dx * dx + dz * dz)

        if horizontal_proj / L < 1e-3:
            ref = np.array([1.0, 0.0, 0.0], dtype=float64)
        else:
            ref = np.array([0.0, 1.0, 0.0], dtype=float64)

        ez = np.cross(ex, ref)
        norm_ez = np.linalg.norm(ez)
        if norm_ez < 1e-12:
            ref = np.array([0.0, 0.0, 1.0], dtype=float64)
            ez = np.cross(ex, ref)
            norm_ez = np.linalg.norm(ez)
        ez /= norm_ez

        ey = np.cross(ez, ex)
        ey /= np.linalg.norm(ey)

        if abs(beta_deg) > 1e-10:
            beta = math.radians(beta_deg)
            cb = math.cos(beta)
            sb = math.sin(beta)
            ey_new = cb * ey + sb * ez
            ez_new = -sb * ey + cb * ez
            ey = ey_new
            ez = ez_new

        return np.array([ex, ey, ez], dtype=float64)

    @staticmethod
    def build_T12(lam: ndarray) -> ndarray:
        """Expand 3x3 direction-cosine matrix into 12x12 transformation."""
        T = np.zeros((12, 12), dtype=float64)
        for b in range(4):
            s = b * 3
            T[s : s + 3, s : s + 3] = lam
        return T

    @staticmethod
    def transform(k_local: ndarray, T: ndarray) -> ndarray:
        """[K_global] = T^T . K_local . T"""
        with np.errstate(divide="ignore", over="ignore", invalid="ignore"):
            result = T.T @ k_local @ T
        return np.nan_to_num(result, nan=0.0, posinf=0.0, neginf=0.0)


def apply_releases_static_condensation(
    k: ndarray,
    releases: Dict[str, bool],
) -> ndarray:
    """
    Modify element stiffness via static condensation for released DOFs.
    Mathematically superior to zeroing rows/columns because it
    preserves the coupling between retained DOFs.
    """
    _map = {
        "fx_i": 0,
        "fy_i": 1,
        "fz_i": 2,
        "mx_i": 3,
        "my_i": 4,
        "mz_i": 5,
        "fx_j": 6,
        "fy_j": 7,
        "fz_j": 8,
        "mx_j": 9,
        "my_j": 10,
        "mz_j": 11,
    }

    released_dofs = sorted(
        _map[name] for name, free in releases.items() if free and name in _map
    )

    if not released_dofs:
        return k

    all_dofs = list(range(12))
    retained = [d for d in all_dofs if d not in released_dofs]
    r = released_dofs

    K_rr = k[np.ix_(retained, retained)]
    K_rc = k[np.ix_(retained, r)]
    K_cr = k[np.ix_(r, retained)]
    K_cc = k[np.ix_(r, r)]

    try:
        K_cc_inv = np.linalg.inv(K_cc)
    except np.linalg.LinAlgError:
        K_cc_inv = np.linalg.pinv(K_cc)

    K_condensed_rr = K_rr - K_rc @ K_cc_inv @ K_cr

    k_out = np.zeros((12, 12), dtype=float64)
    for i_loc, i_glob in enumerate(retained):
        for j_loc, j_glob in enumerate(retained):
            k_out[i_glob, j_glob] = K_condensed_rr[i_loc, j_loc]

    return k_out


class FixedEndForces:
    """
    Compute 12x1 fixed-end force vectors for common member loads,
    then transform to global coordinates and negate to get equivalent
    joint loads.
    """

    @staticmethod
    def udl_local(w: float64, L: float64, direction: str = "local_y") -> ndarray:
        """Fixed-end forces for Uniformly Distributed Load on a beam."""
        f = np.zeros(12, dtype=float64)

        if direction == "local_x":
            f[0] = -w * L / 2.0
            f[6] = -w * L / 2.0
        elif direction == "local_y":
            f[1] = w * L / 2.0
            f[7] = w * L / 2.0
            f[5] = w * L * L / 12.0
            f[11] = -w * L * L / 12.0
        elif direction == "local_z":
            f[2] = w * L / 2.0
            f[8] = w * L / 2.0
            f[4] = -w * L * L / 12.0
            f[10] = w * L * L / 12.0

        return f

    @staticmethod
    def trapez_local(
        w1: float64,
        w2: float64,
        L: float64,
        direction: str = "local_y",
    ) -> ndarray:
        """Fixed-end forces for linearly-varying (trapezoidal) load."""
        w_min = min(w1, w2)
        dw = w2 - w1

        f = FixedEndForces.udl_local(w_min, L, direction)

        ft = np.zeros(12, dtype=float64)
        if direction == "local_y":
            ft[1] = 3.0 * dw * L / 20.0
            ft[7] = 7.0 * dw * L / 20.0
            ft[5] = dw * L * L / 30.0
            ft[11] = -dw * L * L / 20.0
        elif direction == "local_z":
            ft[2] = 3.0 * dw * L / 20.0
            ft[8] = 7.0 * dw * L / 20.0
            ft[4] = -dw * L * L / 30.0
            ft[10] = dw * L * L / 20.0
        elif direction == "local_x":
            ft[0] = -3.0 * dw * L / 20.0
            ft[6] = -7.0 * dw * L / 20.0

        f += ft
        return f

    @staticmethod
    def point_load_local(
        P: float64,
        a: float64,
        L: float64,
        direction: str = "local_y",
    ) -> ndarray:
        """Fixed-end forces for concentrated load P at distance a from node i."""
        b = L - a
        f = np.zeros(12, dtype=float64)

        if L < 1e-12:
            return f

        L2 = L * L
        L3 = L2 * L

        if direction == "local_y":
            f[1] = P * b * b * (3.0 * a + b) / L3
            f[7] = P * a * a * (a + 3.0 * b) / L3
            f[5] = P * a * b * b / L2
            f[11] = -P * a * a * b / L2
        elif direction == "local_z":
            f[2] = P * b * b * (3.0 * a + b) / L3
            f[8] = P * a * a * (a + 3.0 * b) / L3
            f[4] = -P * a * b * b / L2
            f[10] = P * a * a * b / L2
        elif direction == "local_x":
            f[0] = -P * b / L
            f[6] = -P * a / L

        return f

    @staticmethod
    def temperature_local(
        el: Element3D,
        L: float64,
        delta_T: float64,
        delta_T_grad: float64 = 0.0,
        alpha: float64 = float64(12e-6),
    ) -> ndarray:
        """Fixed-end forces due to temperature change."""
        f = np.zeros(12, dtype=float64)

        E = float64(el.E)
        A = float64(el.A)
        Iz = float64(el.Iz)

        if abs(delta_T) > 1e-15:
            N_T = E * A * alpha * delta_T
            f[0] = -N_T
            f[6] = N_T

        if abs(delta_T_grad) > 1e-15:
            d_approx = math.sqrt(12.0 * Iz / A) if A > 1e-15 else 1.0
            M_T = E * Iz * alpha * delta_T_grad / d_approx
            f[5] = -M_T
            f[11] = M_T

        return f


__all__ = [
    "DOF_NAMES",
    "DOFS_PER_NODE",
    "Node3D",
    "Element3D",
    "MemberLoad",
    "StructuralModel",
    "TimoshenkoBeam3D",
    "Transform3D",
    "apply_releases_static_condensation",
    "FixedEndForces",
]
