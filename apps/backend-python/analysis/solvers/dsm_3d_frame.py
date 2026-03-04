"""
dsm_3d_frame.py - Production-Grade Direct Stiffness Method for 3D Frame Analysis
=================================================================================

Strictly mathematical, highly modular 3D frame solver using the Direct Stiffness
Method with Timoshenko beam theory.  Handles thousands of DOFs via sparse matrices
(scipy CSR / SuperLU) and Float64 arithmetic throughout.

Phase 1 - Analysis Engine
    1.  Topological Discretization (Nodes, 6 DOF/node)
    2.  12x12 Local Timoshenko Stiffness Matrix
    3.  3D Coordinate Transformation with member roll (beta)
    4.  Global Stiffness Matrix Assembly (COO -> CSR)
    5.  Boundary Conditions (Penalty + Partitioning)
    6.  Load Vector Assembly (nodal, member UDL/point/trapez, self-weight, FEFs)
    7.  Sparse Direct Solve (SuperLU) + condition-number guard
    8.  Back-substitution for member end forces

References
----------
[1]  Bathe, K-J., Finite Element Procedures, 2nd ed., 2014.
[2]  Cook, R. D. et al., Concepts and Applications of FEA, 4th ed., 2001.
[3]  Przemieniecki, J. S., Theory of Matrix Structural Analysis, 1968.

Units convention (caller chooses consistent set; solver is unit-agnostic):
    Recommended: kN, m, kN/m2, kN.m, rad
"""

from __future__ import annotations

import logging
import math
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
from numpy import float64, ndarray
from scipy import sparse
from scipy.sparse import coo_matrix, csr_matrix, lil_matrix
from scipy.sparse import linalg as sp_linalg

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
#  1. DATA STRUCTURES
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
#  2. 12x12 LOCAL STIFFNESS MATRIX - 3-D TIMOSHENKO BEAM
# ---------------------------------------------------------------------------

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

        E  = float64(el.E)
        G  = float64(el.G)
        A  = float64(el.A)
        Iy = float64(el.Iy)
        Iz = float64(el.Iz)
        J  = float64(el.J)
        Ay = float64(el.Ay)
        Az = float64(el.Az)
        L  = float64(L)
        L2 = L * L
        L3 = L2 * L

        # Shear deformation parameters
        if Ay > 1e-20 and G > 1e-10:
            phi_y = 12.0 * E * Iz / (G * Ay * L2)
        else:
            phi_y = 0.0

        if Az > 1e-20 and G > 1e-10:
            phi_z = 12.0 * E * Iy / (G * Az * L2)
        else:
            phi_z = 0.0

        # Axial & torsion
        a1 = E * A / L
        t1 = G * J / L

        # Bending about LOCAL Z (transverse Y):  DOFs uy (1,7), rz (5,11)
        ky  = 12.0 * E * Iz / (L3 * (1.0 + phi_y))
        ky2 =  6.0 * E * Iz / (L2 * (1.0 + phi_y))
        ky3 = (4.0 + phi_y) * E * Iz / (L * (1.0 + phi_y))
        ky4 = (2.0 - phi_y) * E * Iz / (L * (1.0 + phi_y))

        # Bending about LOCAL Y (transverse Z):  DOFs uz (2,8), ry (4,10)
        kz  = 12.0 * E * Iy / (L3 * (1.0 + phi_z))
        kz2 =  6.0 * E * Iy / (L2 * (1.0 + phi_z))
        kz3 = (4.0 + phi_z) * E * Iy / (L * (1.0 + phi_z))
        kz4 = (2.0 - phi_z) * E * Iy / (L * (1.0 + phi_z))

        # Build 12x12
        k = np.zeros((12, 12), dtype=float64)

        # Axial (0,6)
        k[0, 0] =  a1;  k[0, 6] = -a1
        k[6, 0] = -a1;  k[6, 6] =  a1

        # Torsion (3,9)
        k[3, 3] =  t1;  k[3, 9] = -t1
        k[9, 3] = -t1;  k[9, 9] =  t1

        # Bending in XY plane (uy, rz) - DOFs: 1, 5, 7, 11
        k[1, 1]  =  ky;   k[1, 5]  =  ky2;  k[1, 7]  = -ky;   k[1, 11] =  ky2
        k[5, 1]  =  ky2;  k[5, 5]  =  ky3;  k[5, 7]  = -ky2;  k[5, 11] =  ky4
        k[7, 1]  = -ky;   k[7, 5]  = -ky2;  k[7, 7]  =  ky;   k[7, 11] = -ky2
        k[11, 1] =  ky2;  k[11, 5] =  ky4;  k[11, 7] = -ky2;  k[11, 11] = ky3

        # Bending in XZ plane (uz, ry) - DOFs: 2, 4, 8, 10
        k[2, 2]  =  kz;   k[2, 4]  = -kz2;  k[2, 8]  = -kz;   k[2, 10] = -kz2
        k[4, 2]  = -kz2;  k[4, 4]  =  kz3;  k[4, 8]  =  kz2;  k[4, 10] =  kz4
        k[8, 2]  = -kz;   k[8, 4]  =  kz2;  k[8, 8]  =  kz;   k[8, 10] =  kz2
        k[10, 2] = -kz2;  k[10, 4] =  kz4;  k[10, 8] =  kz2;  k[10, 10] = kz3

        return k

    @staticmethod
    def consistent_mass(el: Element3D, L: float64) -> ndarray:
        """12x12 consistent mass matrix for dynamics / self-weight."""
        rho = float64(el.rho)
        A   = float64(el.A)
        L   = float64(L)
        m   = rho * A * L
        c = m / 420.0

        M = np.zeros((12, 12), dtype=float64)

        # Axial
        M[0, 0] = 140.0; M[0, 6] = 70.0
        M[6, 0] = 70.0;  M[6, 6] = 140.0

        # Torsion
        Jx = el.J
        rx = Jx / A if A > 0 else 0
        M[3, 3] = 140.0 * rx; M[3, 9] = 70.0 * rx
        M[9, 3] = 70.0 * rx;  M[9, 9] = 140.0 * rx

        # Transverse Y (DOFs 1, 5, 7, 11)
        M[1, 1] = 156.0;    M[1, 5] = 22.0*L;   M[1, 7] = 54.0;    M[1, 11] = -13.0*L
        M[5, 1] = 22.0*L;   M[5, 5] = 4.0*L*L;  M[5, 7] = 13.0*L;  M[5, 11] = -3.0*L*L
        M[7, 1] = 54.0;     M[7, 5] = 13.0*L;   M[7, 7] = 156.0;   M[7, 11] = -22.0*L
        M[11, 1] = -13.0*L; M[11, 5] = -3.0*L*L; M[11, 7] = -22.0*L; M[11, 11] = 4.0*L*L

        # Transverse Z (DOFs 2, 4, 8, 10)
        M[2, 2] = 156.0;    M[2, 4] = -22.0*L;  M[2, 8] = 54.0;    M[2, 10] = 13.0*L
        M[4, 2] = -22.0*L;  M[4, 4] = 4.0*L*L;  M[4, 8] = -13.0*L; M[4, 10] = -3.0*L*L
        M[8, 2] = 54.0;     M[8, 4] = -13.0*L;  M[8, 8] = 156.0;   M[8, 10] = 22.0*L
        M[10, 2] = 13.0*L;  M[10, 4] = -3.0*L*L; M[10, 8] = 22.0*L; M[10, 10] = 4.0*L*L

        M *= c
        return M


# ---------------------------------------------------------------------------
#  3. COORDINATE TRANSFORMATION (including beta roll angle)
# ---------------------------------------------------------------------------

class Transform3D:
    """
    Build [T] (12x12) to rotate local element matrices into global coords.
        [K_global] = [T]^T [K_local] [T]
    Handles vertical members (columns) and arbitrary beta-angle roll.
    """

    @staticmethod
    def direction_cosine_matrix(
        xi: float64, yi: float64, zi: float64,
        xj: float64, yj: float64, zj: float64,
        beta_deg: float64 = 0.0,
    ) -> ndarray:
        """3x3 direction-cosine matrix Lambda mapping local -> global axes."""
        dx = float64(xj - xi)
        dy = float64(yj - yi)
        dz = float64(zj - zi)
        L  = math.sqrt(dx*dx + dy*dy + dz*dz)

        if L < 1e-12:
            raise ValueError("Zero-length element detected")

        ex = np.array([dx/L, dy/L, dz/L], dtype=float64)

        # Choose reference vector
        horizontal_proj = math.sqrt(dx*dx + dz*dz)

        if horizontal_proj / L < 1e-3:
            # Vertical member (parallel to global Y)
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

        # Apply beta-angle roll about local x
        if abs(beta_deg) > 1e-10:
            beta = math.radians(beta_deg)
            cb = math.cos(beta)
            sb = math.sin(beta)
            ey_new =  cb * ey + sb * ez
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
            T[s:s+3, s:s+3] = lam
        return T

    @staticmethod
    def transform(k_local: ndarray, T: ndarray) -> ndarray:
        """[K_global] = T^T . K_local . T"""
        with np.errstate(divide='ignore', over='ignore', invalid='ignore'):
            result = T.T @ k_local @ T
        # Replace any NaN/inf from numerical issues with 0
        result = np.nan_to_num(result, nan=0.0, posinf=0.0, neginf=0.0)
        return result


# ---------------------------------------------------------------------------
#  4. MEMBER END RELEASES - Static Condensation
# ---------------------------------------------------------------------------

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
        "fx_i": 0, "fy_i": 1, "fz_i": 2,
        "mx_i": 3, "my_i": 4, "mz_i": 5,
        "fx_j": 6, "fy_j": 7, "fz_j": 8,
        "mx_j": 9, "my_j": 10, "mz_j": 11,
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


# ---------------------------------------------------------------------------
#  5. FIXED-END FORCES (Member Load -> Equivalent Joint Loads)
# ---------------------------------------------------------------------------

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
            f[1]  =  w * L / 2.0
            f[7]  =  w * L / 2.0
            f[5]  =  w * L * L / 12.0
            f[11] = -w * L * L / 12.0
        elif direction == "local_z":
            f[2]  =  w * L / 2.0
            f[8]  =  w * L / 2.0
            f[4]  = -w * L * L / 12.0
            f[10] =  w * L * L / 12.0

        return f

    @staticmethod
    def trapez_local(w1: float64, w2: float64, L: float64,
                     direction: str = "local_y") -> ndarray:
        """Fixed-end forces for linearly-varying (trapezoidal) load."""
        w_min = min(w1, w2)
        dw = w2 - w1

        f = FixedEndForces.udl_local(w_min, L, direction)

        ft = np.zeros(12, dtype=float64)
        if direction == "local_y":
            ft[1]  =  3.0 * dw * L / 20.0
            ft[7]  =  7.0 * dw * L / 20.0
            ft[5]  =  dw * L * L / 30.0
            ft[11] = -dw * L * L / 20.0
        elif direction == "local_z":
            ft[2]  =  3.0 * dw * L / 20.0
            ft[8]  =  7.0 * dw * L / 20.0
            ft[4]  = -dw * L * L / 30.0
            ft[10] =  dw * L * L / 20.0
        elif direction == "local_x":
            ft[0] = -3.0 * dw * L / 20.0
            ft[6] = -7.0 * dw * L / 20.0

        f += ft
        return f

    @staticmethod
    def point_load_local(P: float64, a: float64, L: float64,
                         direction: str = "local_y") -> ndarray:
        """Fixed-end forces for concentrated load P at distance a from node i."""
        b = L - a
        f = np.zeros(12, dtype=float64)

        if L < 1e-12:
            return f

        L2 = L * L
        L3 = L2 * L

        if direction == "local_y":
            f[1]  =  P * b * b * (3.0 * a + b) / L3
            f[7]  =  P * a * a * (a + 3.0 * b) / L3
            f[5]  =  P * a * b * b / L2
            f[11] = -P * a * a * b / L2
        elif direction == "local_z":
            f[2]  =  P * b * b * (3.0 * a + b) / L3
            f[8]  =  P * a * a * (a + 3.0 * b) / L3
            f[4]  = -P * a * b * b / L2
            f[10] =  P * a * a * b / L2
        elif direction == "local_x":
            f[0] = -P * b / L
            f[6] = -P * a / L

        return f

    @staticmethod
    def temperature_local(
        el: Element3D, L: float64,
        delta_T: float64, delta_T_grad: float64 = 0.0,
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
            f[6] =  N_T

        if abs(delta_T_grad) > 1e-15:
            d_approx = math.sqrt(12.0 * Iz / A) if A > 1e-15 else 1.0
            M_T = E * Iz * alpha * delta_T_grad / d_approx
            f[5]  = -M_T
            f[11] =  M_T

        return f


# ---------------------------------------------------------------------------
#  6. GLOBAL ASSEMBLY (COO -> CSR Sparse)
# ---------------------------------------------------------------------------

class SparseAssembler:
    """
    Assemble global [K] using COO triplets then compress to CSR.
    Memory for COO triplets: 24 bytes x 144 x n_elements.
    """

    @staticmethod
    def assemble(
        model: StructuralModel,
    ) -> Tuple[csr_matrix, ndarray, Dict[str, int], Dict[int, str], Dict[str, Dict]]:
        """
        Full assembly: global K, global F, node-index map, DOF map, element data.
        """
        n_dofs = model.n_dofs

        node_ids = sorted(model.nodes.keys())
        nmap: Dict[str, int] = {nid: idx for idx, nid in enumerate(node_ids)}

        dmap: Dict[int, str] = {}
        for nid, idx in nmap.items():
            for off, name in enumerate(DOF_NAMES):
                dmap[idx * 6 + off] = f"{nid}_{name}"

        n_el = len(model.elements)
        max_entries = n_el * 144
        rows = np.zeros(max_entries, dtype=np.intp)
        cols = np.zeros(max_entries, dtype=np.intp)
        vals = np.zeros(max_entries, dtype=float64)
        ptr = 0

        F = np.zeros(n_dofs, dtype=float64)
        _element_data: Dict[str, Dict] = {}

        for el in model.elements.values():
            ni = model.nodes[el.node_i]
            nj = model.nodes[el.node_j]

            dx = float64(nj.x - ni.x)
            dy = float64(nj.y - ni.y)
            dz = float64(nj.z - ni.z)
            L = math.sqrt(dx*dx + dy*dy + dz*dz)
            el.length = float64(L)

            k_local = TimoshenkoBeam3D.local_stiffness(el, L)

            if el.releases:
                k_local = apply_releases_static_condensation(k_local, el.releases)

            lam = Transform3D.direction_cosine_matrix(
                ni.x, ni.y, ni.z, nj.x, nj.y, nj.z, el.beta_angle,
            )
            T = Transform3D.build_T12(lam)
            k_global = Transform3D.transform(k_local, T)

            i_idx = nmap[el.node_i]
            j_idx = nmap[el.node_j]
            dofs_i = np.arange(i_idx * 6, i_idx * 6 + 6, dtype=np.intp)
            dofs_j = np.arange(j_idx * 6, j_idx * 6 + 6, dtype=np.intp)
            dofs = np.concatenate([dofs_i, dofs_j])

            for li in range(12):
                gi = dofs[li]
                for lj in range(12):
                    gj = dofs[lj]
                    rows[ptr] = gi
                    cols[ptr] = gj
                    vals[ptr] = k_global[li, lj]
                    ptr += 1

            _element_data[el.id] = {
                "T": T, "L": L, "lam": lam,
                "k_local": TimoshenkoBeam3D.local_stiffness(el, L),
                "dofs": dofs,
            }

            if model.include_self_weight:
                w_self = el.rho * el.A * model.gravity_magnitude / 1000.0
                half_w = w_self * L / 2.0
                mom_w = w_self * L * L / 12.0
                fef_global = np.zeros(12, dtype=float64)
                fef_global[1]  = -half_w
                fef_global[5]  = -mom_w
                fef_global[7]  = -half_w
                fef_global[11] =  mom_w
                for li in range(12):
                    F[dofs[li]] -= fef_global[li]

        rows = rows[:ptr]
        cols = cols[:ptr]
        vals = vals[:ptr]

        K = coo_matrix((vals, (rows, cols)), shape=(n_dofs, n_dofs)).tocsr()

        # Nodal loads
        for node_id, load_dict in model.nodal_loads.items():
            if node_id not in nmap:
                continue
            idx = nmap[node_id]
            for dof_name, value in load_dict.items():
                if dof_name in DOF_NAMES:
                    off = DOF_NAMES.index(dof_name)
                    F[idx * 6 + off] += float64(value)

        # Member loads
        for ml in model.member_loads:
            if ml.element_id not in _element_data:
                logger.warning(f"Member load references unknown element: {ml.element_id}")
                continue

            ed = _element_data[ml.element_id]
            el = model.elements[ml.element_id]
            L  = ed["L"]
            T  = ed["T"]
            dofs = ed["dofs"]

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

            if ml.direction.startswith("local"):
                fef_global = T.T @ fef_local
            else:
                fef_global = fef_local

            for li in range(12):
                F[dofs[li]] -= fef_global[li]

        return K, F, nmap, dmap, _element_data


# ---------------------------------------------------------------------------
#  7. BOUNDARY CONDITIONS (Penalty + Partitioning)
# ---------------------------------------------------------------------------

class BoundaryConditions:
    """Apply supports via penalty method or DOF partitioning."""

    @staticmethod
    def _penalty_value(K: csr_matrix) -> float64:
        diag = K.diagonal()
        max_diag = np.max(np.abs(diag))
        return float64(max(max_diag * 1e8, 1e14))

    @staticmethod
    def apply_penalty(
        K: csr_matrix, F: ndarray,
        model: StructuralModel,
        nmap: Dict[str, int],
    ) -> Tuple[csr_matrix, ndarray]:
        """Penalty method: K[i,i] += alpha, F[i] = alpha * prescribed_value."""
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
        """DOF partitioning: separate free (f) and restrained (s) DOFs."""
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


# ---------------------------------------------------------------------------
#  8. SOLVER + BACK-SUBSTITUTION
# ---------------------------------------------------------------------------

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


class DirectStiffnessMethod3D:
    """
    Production-grade orchestrator for 3D frame analysis.

    Usage:
        dsm = DirectStiffnessMethod3D()
        result = dsm.analyze(model)
    """

    def __init__(self, *, solver: str = "direct", check_conditioning: bool = True):
        self.solver_type = solver
        self.check_conditioning = check_conditioning
        self._model: Optional[StructuralModel] = None
        self._K: Optional[csr_matrix] = None
        self._F: Optional[ndarray] = None
        self._nmap: Dict[str, int] = {}
        self._dmap: Dict[int, str] = {}
        self._edata: Dict[str, Dict] = {}
        self._U: Optional[ndarray] = None
        self.result: Optional[AnalysisResult] = None

    def analyze(self, model: StructuralModel) -> AnalysisResult:
        """One-call analysis: assemble -> apply BC -> solve -> back-substitute."""
        t0 = time.perf_counter()
        self.build(model)
        self.assemble()
        self.apply_bc()
        self.solve()
        self.back_substitute()
        elapsed = (time.perf_counter() - t0) * 1000.0
        self.result.solve_time_ms = float64(elapsed)
        logger.info(f"Analysis complete: {model.n_dofs} DOFs in {elapsed:.1f} ms")
        return self.result

    def build(self, model: StructuralModel) -> None:
        self._model = model
        logger.info(
            f"Model: {model.n_nodes} nodes, {len(model.elements)} elements, "
            f"{model.n_dofs} DOFs"
        )

    def assemble(self) -> None:
        if self._model is None:
            raise RuntimeError("Call build() first.")
        K, F, nmap, dmap, edata = SparseAssembler.assemble(self._model)
        self._K = K
        self._F = F
        self._nmap = nmap
        self._dmap = dmap
        self._edata = edata
        logger.info(
            f"Assembly: K shape={K.shape}, nnz={K.nnz}, "
            f"density={K.nnz / (K.shape[0]**2):.6f}"
        )

    def apply_bc(self) -> None:
        if self._K is None:
            raise RuntimeError("Call assemble() first.")
        K_bc, F_bc = BoundaryConditions.apply_penalty(
            self._K, self._F, self._model, self._nmap,
        )
        self._K = K_bc
        self._F = F_bc

    def solve(self) -> ndarray:
        if self._K is None or self._F is None:
            raise RuntimeError("Call apply_bc() first.")

        warnings: List[str] = []
        cond = None

        # Conditioning check
        if self.check_conditioning and self._model.n_dofs < 3000:
            try:
                diag = self._K.diagonal()
                nonzero_diag = diag[diag != 0]
                if len(nonzero_diag) > 0:
                    min_d = np.min(np.abs(nonzero_diag))
                    max_d = np.max(np.abs(diag))
                    cond_est = max_d / min_d if min_d > 0 else float("inf")
                    cond = float64(cond_est)
                    if cond_est > 1e12:
                        zero_diags = np.where(np.abs(diag) < 1e-6)[0]
                        if len(zero_diags) > 0:
                            dof_names = [
                                self._dmap.get(int(d), f"DOF_{d}")
                                for d in zero_diags[:5]
                            ]
                            msg = (
                                f"Ill-conditioned matrix (kappa ~ {cond_est:.2e}). "
                                f"Possible instability at: {', '.join(dof_names)}"
                            )
                        else:
                            msg = f"Ill-conditioned matrix (kappa ~ {cond_est:.2e})"
                        warnings.append(msg)
                        logger.warning(msg)
            except Exception:
                pass

        # Solve
        try:
            if self.solver_type == "iterative":
                U, info = sp_linalg.cg(self._K, self._F, tol=1e-10, maxiter=5000)
                if info != 0:
                    warnings.append(f"CG solver did not converge (info={info})")
                    logger.warning(f"CG solver info={info}, falling back to direct")
                    U = sp_linalg.spsolve(self._K, self._F)
            else:
                U = sp_linalg.spsolve(self._K, self._F)
        except Exception as e:
            raise RuntimeError(
                f"Solver failed: {e}. Check supports and model connectivity."
            ) from e

        U = np.asarray(U, dtype=float64).flatten()
        self._U = U

        self.result = AnalysisResult(
            displacements=U,
            reactions={},
            element_forces={},
            node_displacements={},
            max_displacement=float64(np.max(np.abs(U))),
            condition_number=cond,
            n_dofs=len(U),
            warnings=warnings,
        )

        return U

    def back_substitute(self) -> None:
        """Compute per-node displacements, reactions, and member end forces."""
        if self._U is None or self.result is None:
            raise RuntimeError("Call solve() first.")

        model = self._model
        U = self._U

        # Node displacements
        node_ids = sorted(model.nodes.keys())
        for nid in node_ids:
            idx = self._nmap[nid]
            disp = {}
            for off, dname in enumerate(DOF_NAMES):
                disp[dname] = float(U[idx * 6 + off])
            self.result.node_displacements[nid] = disp

        # Reactions
        for nid, node in model.nodes.items():
            idx = self._nmap[nid]
            has_restraint = False
            rxn = {}
            for off, dname in enumerate(DOF_NAMES):
                if node.restraints.get(dname, False):
                    has_restraint = True
                    g = idx * 6 + off
                    r_val = self._K[g, :].dot(U) - self._F[g]
                    rxn[dname] = float(np.asarray(r_val).flat[0])
            if has_restraint:
                self.result.reactions[nid] = rxn

        # Element end forces
        for el_id, ed in self._edata.items():
            dofs = ed["dofs"]
            T = ed["T"]
            k_local = ed["k_local"]

            u_global = U[dofs]
            u_local = T @ u_global
            f_local = k_local @ u_local

            # Add fixed-end forces from member loads
            for ml in model.member_loads:
                if ml.element_id != el_id:
                    continue
                el = model.elements[el_id]
                L = ed["L"]
                if ml.load_type == "udl":
                    fef = FixedEndForces.udl_local(float64(ml.w1), L, ml.direction)
                elif ml.load_type == "trapez":
                    fef = FixedEndForces.trapez_local(
                        float64(ml.w1), float64(ml.w2), L, ml.direction
                    )
                elif ml.load_type == "point":
                    a = float64(ml.a) if ml.a > 0 else L / 2.0
                    fef = FixedEndForces.point_load_local(
                        float64(ml.w1), a, L, ml.direction
                    )
                elif ml.load_type == "temperature":
                    fef = FixedEndForces.temperature_local(
                        el, L, float64(ml.delta_T), float64(ml.delta_T_gradient),
                    )
                else:
                    continue
                f_local += fef

            # Add self-weight FEF
            if model.include_self_weight:
                el = model.elements[el_id]
                L = ed["L"]
                w_self = el.rho * el.A * model.gravity_magnitude / 1000.0
                fef_sw = FixedEndForces.udl_local(-w_self, L, "local_y")
                f_local += fef_sw

            force_names = [
                "Fx_i", "Fy_i", "Fz_i", "Mx_i", "My_i", "Mz_i",
                "Fx_j", "Fy_j", "Fz_j", "Mx_j", "My_j", "Mz_j",
            ]
            self.result.element_forces[el_id] = {
                name: float(f_local[k]) for k, name in enumerate(force_names)
            }

    def get_internal_forces(
        self, element_id: str, n_points: int = 21
    ) -> Dict[str, ndarray]:
        """Evaluate shear, moment, axial along member at n_points stations."""
        if self.result is None or element_id not in self.result.element_forces:
            raise RuntimeError("Solve first, then call get_internal_forces()")

        ef = self.result.element_forces[element_id]
        L  = self._edata[element_id]["L"]

        xs = np.linspace(0, L, n_points, dtype=float64)
        Fx = np.zeros(n_points, dtype=float64)
        Fy = np.zeros(n_points, dtype=float64)
        Fz = np.zeros(n_points, dtype=float64)
        Mx = np.zeros(n_points, dtype=float64)
        My = np.zeros(n_points, dtype=float64)
        Mz = np.zeros(n_points, dtype=float64)

        Fx_i = ef["Fx_i"]; Fy_i = ef["Fy_i"]; Fz_i = ef["Fz_i"]
        Mx_i = ef["Mx_i"]; My_i = ef["My_i"]; Mz_i = ef["Mz_i"]

        for p, x in enumerate(xs):
            Fx[p] = -Fx_i
            Fy[p] = -Fy_i
            Fz[p] = -Fz_i
            Mx[p] = -Mx_i
            My[p] = -My_i + Fz_i * x
            Mz[p] = -Mz_i - Fy_i * x

        # Superimpose member loads
        for ml in self._model.member_loads:
            if ml.element_id != element_id:
                continue
            if ml.load_type == "udl" and ml.direction == "local_y":
                w = float64(ml.w1)
                for p, x in enumerate(xs):
                    Fy[p] += -w * x
                    Mz[p] += w * x * x / 2.0
            elif ml.load_type == "udl" and ml.direction == "local_z":
                w = float64(ml.w1)
                for p, x in enumerate(xs):
                    Fz[p] += -w * x
                    My[p] += -w * x * x / 2.0
            elif ml.load_type == "point" and ml.direction == "local_y":
                P = float64(ml.w1)
                a = float64(ml.a) if ml.a > 0 else L / 2.0
                for p, x in enumerate(xs):
                    if x >= a:
                        Fy[p] += -P
                        Mz[p] += P * (x - a)

        return {"x": xs, "Fx": Fx, "Fy": Fy, "Fz": Fz, "Mx": Mx, "My": My, "Mz": Mz}


# ---------------------------------------------------------------------------
#  CONVENIENCE: build model from plain dicts (JSON-friendly API)
# ---------------------------------------------------------------------------

def build_model_from_dicts(
    nodes: Dict[str, Dict],
    elements: List[Dict],
    supports: Dict[str, List[int]],
    nodal_loads: Dict[str, Dict[str, float]],
    member_loads: Optional[List[Dict]] = None,
    include_self_weight: bool = False,
) -> StructuralModel:
    """Build StructuralModel from plain Python dicts (as received from JSON API)."""
    model = StructuralModel(include_self_weight=include_self_weight)

    for nid, coords in nodes.items():
        model.nodes[str(nid)] = Node3D(
            id=str(nid),
            x=float64(coords.get("x", 0)),
            y=float64(coords.get("y", 0)),
            z=float64(coords.get("z", 0)),
        )

    for nid_str, dof_list in supports.items():
        nid = str(nid_str)
        if nid in model.nodes:
            for dof_idx in dof_list:
                if 0 <= dof_idx < 6:
                    model.nodes[nid].restraints[DOF_NAMES[dof_idx]] = True

    for edef in elements:
        eid = str(edef.get("id", f"E{len(model.elements)+1}"))
        el = Element3D(
            id=eid,
            node_i=str(edef["node_i"]),
            node_j=str(edef["node_j"]),
            E=float64(edef.get("E", 200e6)),
            G=float64(edef.get("G", 77e6)),
            A=float64(edef.get("A", 0.015)),
            Iy=float64(edef.get("Iy", 8e-5)),
            Iz=float64(edef.get("Iz", 1.2e-4)),
            J=float64(edef.get("J", 1e-4)),
            Ay=float64(edef.get("Ay", edef.get("A", 0.015) * 0.83)),
            Az=float64(edef.get("Az", edef.get("A", 0.015) * 0.83)),
            rho=float64(edef.get("rho", 7850)),
            beta_angle=float64(edef.get("beta_angle", 0)),
            element_type=edef.get("element_type", "frame"),
        )
        releases = edef.get("releases", {})
        el.releases = {k: bool(v) for k, v in releases.items()}
        model.elements[eid] = el

    for nid_str, loads in nodal_loads.items():
        nid = str(nid_str)
        model.nodal_loads[nid] = {k: float64(v) for k, v in loads.items()}

    if member_loads:
        for mldef in member_loads:
            model.member_loads.append(MemberLoad(
                element_id=str(mldef["element_id"]),
                load_type=mldef.get("load_type", "udl"),
                direction=mldef.get("direction", "local_y"),
                w1=float64(mldef.get("w1", 0)),
                w2=float64(mldef.get("w2", 0)),
                a=float64(mldef.get("a", 0)),
                delta_T=float64(mldef.get("delta_T", 0)),
                delta_T_gradient=float64(mldef.get("delta_T_gradient", 0)),
            ))

    return model


def analyze_frame(
    nodes: Dict[str, Dict],
    elements: List[Dict],
    supports: Dict[str, List[int]],
    nodal_loads: Dict[str, Dict[str, float]],
    member_loads: Optional[List[Dict]] = None,
    include_self_weight: bool = False,
    solver: str = "direct",
) -> Dict[str, Any]:
    """One-call JSON-in / JSON-out frame analysis."""
    model = build_model_from_dicts(
        nodes, elements, supports, nodal_loads, member_loads, include_self_weight,
    )
    dsm = DirectStiffnessMethod3D(solver=solver)
    result = dsm.analyze(model)

    return {
        "displacements": {
            nid: disp for nid, disp in result.node_displacements.items()
        },
        "reactions": result.reactions,
        "element_forces": result.element_forces,
        "max_displacement": float(result.max_displacement),
        "condition_number": float(result.condition_number) if result.condition_number else None,
        "solve_time_ms": float(result.solve_time_ms),
        "n_dofs": result.n_dofs,
        "warnings": result.warnings,
    }


# ---------------------------------------------------------------------------
#  SELF-TEST (simple cantilever verification)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    result = analyze_frame(
        nodes={
            "1": {"x": 0, "y": 0, "z": 0},
            "2": {"x": 5, "y": 0, "z": 0},
        },
        elements=[{
            "id": "B1",
            "node_i": "1", "node_j": "2",
            "E": 200e6, "G": 77e6,
            "A": 5.69e-3, "Iy": 5.13e-6, "Iz": 98.22e-6,
            "J": 1.0e-7,
            "Ay": 4.72e-3, "Az": 4.72e-3,
        }],
        supports={"1": [0, 1, 2, 3, 4, 5]},
        nodal_loads={"2": {"uy": -100.0}},
    )

    print("\n" + "=" * 60)
    print("  CANTILEVER VERIFICATION")
    print("=" * 60)
    disp_y = result["displacements"]["2"]["uy"]
    analytical = -100 * 5**3 / (3 * 200e6 * 98.22e-6)
    print(f"  Tip displacement UY = {disp_y:.6f} m")
    print(f"  Analytical PL3/3EI  = {analytical:.6f} m")
    print(f"  Max displacement    = {result['max_displacement']:.6f} m")
    print(f"  Solve time          = {result['solve_time_ms']:.1f} ms")
    print(f"  Warnings            = {result['warnings']}")
    print(f"\n  Reactions at node 1:")
    for k, v in result["reactions"]["1"].items():
        print(f"    {k:4s} = {v:12.4f}")
    print(f"\n  Element forces (B1):")
    for k, v in result["element_forces"]["B1"].items():
        print(f"    {k:6s} = {v:12.4f}")
    print("=" * 60)
