"""
advanced_elements.py  –  Advanced Finite Element Library
==========================================================

Production implementations of elements missing from a conventional
1-D frame + basic-plate solver.  Every class follows the Direct
Stiffness Method convention: it returns a **local** stiffness matrix
and the caller's assembler transforms and inserts it into the global
system.

Contents
--------
1. Non-linear Link Elements
    • GapElement               – compression-only spring (contact)
    • HookElement              – tension-only spring
    • FrictionPendulumElement  – single-concave sliding isolator
    • ViscousDamperElement     – linearised viscous dashpot
    • MultiLinearSpring        – piecewise-linear plastic spring

2. Tension / Compression-Only Frame Members
    • TensionOnlyMember        – slackens when axial ≤ 0
    • CompressionOnlyMember    – buckles when axial > 0

3. 3-D Solid (Brick) Elements
    • Hex8Element              – 8-node linear hexahedron (B-bar optional)
    • Hex20Element             – 20-node serendipity hexahedron

4. Kirchhoff–Love Thin Plate (DKQ)
    • KirchhoffPlate           – 4-node, 12 DOF, no shear

5. Rigid / Semi-Rigid Diaphragm Constraint
    • DiaphragmConstraint      – master-slave DOF coupling

Units – consistent with caller (kN-m, N-mm, … solver agnostic).

References
----------
[1] Bathe K-J, Finite Element Procedures, 2nd ed., 2014.
[2] Cook R D et al., Concepts & Applications of FEA, 4th ed., 2001.
[3] Chopra A K, Dynamics of Structures, 5th ed., 2017.
[4] Przemieniecki J S, Theory of Matrix Structural Analysis, 1968.
[5] CSI Analysis Reference Manual (SAP2000 / ETABS), 2023.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Tuple

import numpy as np
from numpy import float64, ndarray

###############################################################################
#  1.  NON-LINEAR  LINK  ELEMENTS
###############################################################################

# ─── Gap (compression-only) ────────────────────────────────────────────────

@dataclass
class GapElement:
    """
    Zero-length compression-only link (soil spring, contact, gap closure).

    Active when the local deformation is **negative** (closing the gap):
        F  =  k_eff · δ   if δ < -gap_open
        F  =  0            otherwise

    DOFs:  2 translational – one per node along the link axis.
    Stiffness: 2 × 2 matrix  [ k  -k ]
                              [-k   k ]
    In non-linear analysis the stiffness is toggled per iteration.
    """

    id: str
    node_i: str
    node_j: str
    k_comp: float64 = float64(1e6)      # Spring stiffness when active
    gap_open: float64 = float64(0.0)     # Initial gap opening (≥ 0)
    direction: int = 0                   # 0=X, 1=Y, 2=Z in global
    _active: bool = True                 # Current iteration state

    @property
    def ndof(self) -> int:
        return 2

    def local_stiffness(self) -> ndarray:
        k = float64(self.k_comp) if self._active else float64(0.0)
        return np.array([[k, -k], [-k, k]], dtype=float64)

    def update_state(self, displacement_i: float64, displacement_j: float64) -> bool:
        """Return True if state changed → needs re-solve."""
        delta = displacement_j - displacement_i
        was = self._active
        self._active = delta < -self.gap_open   # closing
        return was != self._active

    def dof_map(self, ni: int, nj: int) -> List[int]:
        return [ni * 6 + self.direction, nj * 6 + self.direction]


# ─── Hook (tension-only) ───────────────────────────────────────────────────

@dataclass
class HookElement:
    """
    Tension-only link (cable attachment, one-way restraint).
    Active when local elongation > 0.
    """

    id: str
    node_i: str
    node_j: str
    k_tens: float64 = float64(1e6)
    slack: float64 = float64(0.0)        # Initial slack before engaging
    direction: int = 0
    _active: bool = False

    @property
    def ndof(self) -> int:
        return 2

    def local_stiffness(self) -> ndarray:
        k = float64(self.k_tens) if self._active else float64(0.0)
        return np.array([[k, -k], [-k, k]], dtype=float64)

    def update_state(self, d_i: float64, d_j: float64) -> bool:
        delta = d_j - d_i
        was = self._active
        self._active = delta > self.slack   # stretching
        return was != self._active

    def dof_map(self, ni: int, nj: int) -> List[int]:
        return [ni * 6 + self.direction, nj * 6 + self.direction]


# ─── Friction Pendulum Bearing ─────────────────────────────────────────────

@dataclass
class FrictionPendulumElement:
    """
    Single-concave friction pendulum isolator linearised to
    effective stiffness + effective damping (for response-spectrum).

    k_eff  =  W / R  +  μ W / D_design
    β_eff  =  (2/π) · μ / (μ + D_design / R)

    In time-history, use the bi-linear hysteresis loop:
    - Pre-slip:  k1  =  W / R  +  μ W / Dy   (Dy ≈ 1 mm)
    - Post-slip: k2  =  W / R
    - Characteristic strength  Qd = μ W

    DOFs: 6 per node (full link) – but the meaningful stiffnesses are
    the two horizontal translations.  Vertical and rotational DOFs
    carry tributary dead-load stiffness only.
    """

    id: str
    node_i: str
    node_j: str
    R: float64 = float64(2.0)           # Radius of curvature (m)
    mu: float64 = float64(0.05)         # Friction coefficient
    W: float64 = float64(500.0)         # Tributary dead weight (kN)
    D_design: float64 = float64(0.15)   # Design displacement (m)
    Dy: float64 = float64(0.001)        # Yield displacement (m)

    def k_eff(self) -> float64:
        """Effective stiffness for RSA / equivalent-linear method."""
        return self.W / self.R + self.mu * self.W / self.D_design

    def beta_eff(self) -> float64:
        """Effective viscous damping ratio."""
        return (2.0 / math.pi) * self.mu / (self.mu + self.D_design / self.R)

    def k_initial(self) -> float64:
        """Pre-slip stiffness."""
        return self.W / self.R + self.mu * self.W / self.Dy

    def k_post_yield(self) -> float64:
        """Post-slip stiffness."""
        return self.W / self.R

    def Qd(self) -> float64:
        """Characteristic strength."""
        return self.mu * self.W

    def local_stiffness(self, linearised: bool = True) -> ndarray:
        """
        12 × 12 link element stiffness (6 DOF per node).
        Horizontal translations use k_eff; vertical and rotational are stiff.
        """
        k = np.zeros((12, 12), dtype=float64)

        k_h = float64(self.k_eff() if linearised else self.k_initial())
        k_v = float64(self.W * 100.0)       # very stiff vertically
        k_r = float64(1e-3)                 # soft rotation

        stiffnesses = [k_h, k_h, k_v, k_r, k_r, k_r]  # x, y, z, rx, ry, rz
        for d, kd in enumerate(stiffnesses):
            k[d, d]       =  kd
            k[d, d + 6]   = -kd
            k[d + 6, d]   = -kd
            k[d + 6, d + 6] = kd
        return k

    def dof_map(self, ni: int, nj: int) -> List[int]:
        return list(range(ni * 6, ni * 6 + 6)) + list(range(nj * 6, nj * 6 + 6))


# ─── Viscous Damper ────────────────────────────────────────────────────────

@dataclass
class ViscousDamperElement:
    """
    Linearised viscous damper link.

    F = C · v^α    (α = 1 → linear, α < 1 → non-linear)

    For frequency-domain or RSA we linearise:
        C_eff  =  C · ω^(α-1) · λ(α)
    where  λ(α) = 2^(1+α) · [Γ(1+α/2)]² / [π · Γ(2+α)]

    Stiffness matrix:  for modal superposition we model as an
    equivalent viscous element contributing to the damping matrix [C].
    In the stiffness matrix we inject only a negligible k ~ 0 to
    keep the element connected.

    For time-history (Newmark-β), the damper contributes to K_eff:
        K_eff += (γ / β / Δt) · C_eff
    """

    id: str
    node_i: str
    node_j: str
    C: float64 = float64(100.0)          # Damping coefficient (kN·s/m)
    alpha: float64 = float64(1.0)        # Velocity exponent
    direction: int = 0                   # 0=X, 1=Y, 2=Z

    def c_eff(self, omega: float64 = float64(1.0)) -> float64:
        if abs(self.alpha - 1.0) < 1e-10:
            return self.C
        lam = self._lambda_alpha()
        return self.C * omega ** (self.alpha - 1.0) * lam

    def _lambda_alpha(self) -> float64:
        a = float(self.alpha)
        from math import gamma
        num = 2 ** (1 + a) * (gamma(1 + a / 2)) ** 2
        den = math.pi * gamma(2 + a)
        return float64(num / den)

    def local_stiffness(self) -> ndarray:
        """Near-zero stiffness to maintain connectivity."""
        k = float64(1e-3)
        return np.array([[k, -k], [-k, k]], dtype=float64)

    def local_damping_matrix(self, omega: float64 = float64(1.0)) -> ndarray:
        c = self.c_eff(omega)
        return np.array([[c, -c], [-c, c]], dtype=float64)

    def dof_map(self, ni: int, nj: int) -> List[int]:
        return [ni * 6 + self.direction, nj * 6 + self.direction]


# ─── Multi-Linear Plastic Spring ───────────────────────────────────────────

@dataclass
class MultiLinearSpring:
    """
    Piecewise-linear (multi-linear) plastic hinge / soil spring.

    The backbone curve is given as a list of (displacement, force) pairs
    sorted by displacement.  Unloading follows the initial slope (k0).

    Used for:
    - Lumped plasticity hinges (FEMA 356 / ASCE 41)
    - Non-linear soil springs (API p-y, t-z)
    - Bolted-connection moment-rotation

    DOFs:  2 (one per node, along direction).
    """

    id: str
    node_i: str
    node_j: str
    backbone: List[Tuple[float64, float64]] = field(
        default_factory=lambda: [(-0.05, -100.0), (0.0, 0.0), (0.05, 100.0)]
    )
    direction: int = 0

    # Internal state
    _d_plastic: float64 = float64(0.0)
    _current_seg: int = 1

    @property
    def k0(self) -> float64:
        """Initial stiffness (slope of segment through origin)."""
        if len(self.backbone) >= 2:
            d0, f0 = self.backbone[0]
            d1, f1 = self.backbone[1]
            dd = d1 - d0
            return float64((f1 - f0) / dd) if abs(dd) > 1e-20 else float64(1e6)
        return float64(1e6)

    def tangent_stiffness(self, delta: float64) -> float64:
        """Current tangent stiffness from backbone."""
        bb = self.backbone
        for i in range(len(bb) - 1):
            if bb[i][0] <= delta <= bb[i + 1][0]:
                dd = bb[i + 1][0] - bb[i][0]
                if abs(dd) < 1e-20:
                    continue
                return float64((bb[i + 1][1] - bb[i][1]) / dd)
        # Beyond backbone → last segment slope or zero
        if delta <= bb[0][0]:
            return float64(0.0)
        return float64(0.0)

    def local_stiffness(self, delta: float64 = float64(0.0)) -> ndarray:
        k = self.tangent_stiffness(delta)
        return np.array([[k, -k], [-k, k]], dtype=float64)

    def dof_map(self, ni: int, nj: int) -> List[int]:
        return [ni * 6 + self.direction, nj * 6 + self.direction]


###############################################################################
#  2.  TENSION / COMPRESSION-ONLY  FRAME  MEMBERS
###############################################################################

class TensionCompressionState(Enum):
    ACTIVE = "active"
    SLACK = "slack"
    BUCKLED = "buckled"


@dataclass
class TensionOnlyMember:
    """
    Frame/truss member that carries **tension only**.

    During non-linear iteration:
        • If axial force N < 0 (compression) → stiffness drops to near-zero.
        • Re-checked each Newton–Raphson iteration until convergence.

    Implementation: the caller supplies the standard 12 × 12 or 6 × 6
    stiffness of the underlying element.  This wrapper scales it.

    Usage in the assembler:
        k = TensionOnlyMember(original_k).get_current_stiffness(N)
    """

    element_id: str
    k_full: ndarray                   # Underlying element stiffness
    min_fraction: float64 = float64(1e-6)  # Residual stiffness factor
    _state: TensionCompressionState = TensionCompressionState.ACTIVE

    def get_current_stiffness(self, axial_force: float64) -> ndarray:
        """Return full K if tension (N > 0), near-zero if compression."""
        if axial_force > 0:
            self._state = TensionCompressionState.ACTIVE
            return self.k_full.copy()
        else:
            self._state = TensionCompressionState.SLACK
            return self.k_full * self.min_fraction

    @property
    def is_active(self) -> bool:
        return self._state == TensionCompressionState.ACTIVE


@dataclass
class CompressionOnlyMember:
    """
    Frame/truss member that carries **compression only** (bracing, strut).

    If axial N > 0 (tension) → stiffness drops to near-zero.
    """

    element_id: str
    k_full: ndarray
    min_fraction: float64 = float64(1e-6)
    _state: TensionCompressionState = TensionCompressionState.ACTIVE

    def get_current_stiffness(self, axial_force: float64) -> ndarray:
        if axial_force < 0:
            self._state = TensionCompressionState.ACTIVE
            return self.k_full.copy()
        else:
            self._state = TensionCompressionState.BUCKLED
            return self.k_full * self.min_fraction

    @property
    def is_active(self) -> bool:
        return self._state == TensionCompressionState.ACTIVE


###############################################################################
#  3.  8-NODE  AND  20-NODE  3-D  SOLID  (BRICK)  ELEMENTS
###############################################################################

@dataclass
class SolidMaterial:
    E: float64 = float64(200e6)       # kN/m² (or Pa, …)
    nu: float64 = float64(0.3)
    rho: float64 = float64(7850.0)

    def D_matrix(self) -> ndarray:
        """6 × 6 constitutive matrix (3-D isotropic elasticity).

        σ = D · ε   with  ε = [εxx, εyy, εzz, γxy, γyz, γxz]
        """
        E, nu = float(self.E), float(self.nu)
        c = E / ((1 + nu) * (1 - 2 * nu))
        D = np.zeros((6, 6), dtype=float64)
        D[0, 0] = D[1, 1] = D[2, 2] = c * (1 - nu)
        D[0, 1] = D[0, 2] = D[1, 0] = D[1, 2] = D[2, 0] = D[2, 1] = c * nu
        D[3, 3] = D[4, 4] = D[5, 5] = c * (1 - 2 * nu) / 2.0
        return D


class Hex8Element:
    """
    8-node tri-linear hexahedral (brick) element.

    3 DOF/node → 24 DOF total.
    DOF order:  [u1, v1, w1,  u2, v2, w2, … u8, v8, w8]

    Isoparametric mapping with natural coords (ξ, η, ζ) ∈ [-1, 1]³.
    Full 2 × 2 × 2 Gauss integration  (exact for trilinear).

    For nearly-incompressible materials, use B-bar selective integration
    (`use_bbar = True`) to prevent volumetric locking.

    Reference
    ---------
    [1] Bathe §5.3, [2] Cook §7.3
    """

    # Natural coords of the 8 vertices (right-hand convention)
    _NODE_NAT = np.array([
        [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
        [-1, -1,  1], [1, -1,  1], [1, 1,  1], [-1, 1,  1],
    ], dtype=float64)

    # 2 × 2 × 2 Gauss points and weights
    _GP = 1.0 / math.sqrt(3)
    _GAUSS_PTS = np.array([
        [-_GP, -_GP, -_GP], [_GP, -_GP, -_GP],
        [_GP,  _GP, -_GP], [-_GP, _GP, -_GP],
        [-_GP, -_GP, _GP], [_GP, -_GP,  _GP],
        [_GP,  _GP,  _GP], [-_GP, _GP,  _GP],
    ], dtype=float64)
    _GAUSS_W = np.ones(8, dtype=float64)  # all weights = 1

    def __init__(self, node_coords: ndarray, material: SolidMaterial,
                 use_bbar: bool = False):
        """
        node_coords:  (8, 3) array of physical coordinates.
        material:     SolidMaterial instance.
        use_bbar:     Activates B-bar (selective deviatoric/volumetric).
        """
        assert node_coords.shape == (8, 3), "Hex8 requires 8 nodes × 3 coords"
        self.coords = node_coords.astype(float64)
        self.mat = material
        self.use_bbar = use_bbar

    # ── Shape functions ────────────────────────────────────────────

    @staticmethod
    def _shape(xi: float64, eta: float64, zeta: float64) -> ndarray:
        """8 shape functions N_i at (ξ, η, ζ)."""
        N = np.empty(8, dtype=float64)
        for i in range(8):
            xi_i, eta_i, zeta_i = Hex8Element._NODE_NAT[i]
            N[i] = 0.125 * (1 + xi_i * xi) * (1 + eta_i * eta) * (1 + zeta_i * zeta)
        return N

    @staticmethod
    def _dshape(xi: float64, eta: float64, zeta: float64) -> ndarray:
        """Derivatives dN/dξ, dN/dη, dN/dζ  →  (3, 8) array."""
        dN = np.empty((3, 8), dtype=float64)
        for i in range(8):
            xi_i, eta_i, zeta_i = Hex8Element._NODE_NAT[i]
            dN[0, i] = 0.125 * xi_i * (1 + eta_i * eta) * (1 + zeta_i * zeta)
            dN[1, i] = 0.125 * (1 + xi_i * xi) * eta_i * (1 + zeta_i * zeta)
            dN[2, i] = 0.125 * (1 + xi_i * xi) * (1 + eta_i * eta) * zeta_i
        return dN

    # ── Jacobian ───────────────────────────────────────────────────

    def _jacobian(self, dN_dnat: ndarray) -> Tuple[ndarray, float64]:
        """J = dN/dξ · x   →  (3, 3).   Returns (J, det(J))."""
        J = dN_dnat @ self.coords                   # (3, 8) @ (8, 3) → (3, 3)
        return J, float64(np.linalg.det(J))

    # ── B-matrix (strain–displacement) ─────────────────────────────

    @staticmethod
    def _B_from_dN(dN_dx: ndarray) -> ndarray:
        """
        B matrix (6 × 24) from dN/dx  (3, 8).

        ε = [εxx, εyy, εzz, γxy, γyz, γxz]^T
        """
        B = np.zeros((6, 24), dtype=float64)
        for i in range(8):
            c = i * 3
            dNx, dNy, dNz = dN_dx[0, i], dN_dx[1, i], dN_dx[2, i]
            B[0, c]     = dNx       # εxx
            B[1, c + 1] = dNy       # εyy
            B[2, c + 2] = dNz       # εzz
            B[3, c]     = dNy       # γxy
            B[3, c + 1] = dNx
            B[4, c + 1] = dNz       # γyz
            B[4, c + 2] = dNy
            B[5, c]     = dNz       # γxz
            B[5, c + 2] = dNx
        return B

    # ── Stiffness ──────────────────────────────────────────────────

    def stiffness_matrix(self) -> ndarray:
        """24 × 24 element stiffness matrix via 2 × 2 × 2 Gauss integration."""
        D = self.mat.D_matrix()
        K = np.zeros((24, 24), dtype=float64)

        B_bar_vol: Optional[ndarray] = None
        V_total = float64(0.0)

        if self.use_bbar:
            # Pre-compute volume-averaged dN/dx for B-bar
            B_bar_vol = np.zeros((6, 24), dtype=float64)
            for gp in range(8):
                xi, eta, zeta = self._GAUSS_PTS[gp]
                dN = self._dshape(xi, eta, zeta)
                J, detJ = self._jacobian(dN)
                dN_dx = np.linalg.solve(J, dN)
                B = self._B_from_dN(dN_dx)
                w = self._GAUSS_W[gp]
                V_total += detJ * w
                # Volume part of B (mean dilatation)
                B_vol = np.zeros_like(B)
                for col in range(24):
                    avg = (B[0, col] + B[1, col] + B[2, col]) / 3.0
                    B_vol[0, col] = avg
                    B_vol[1, col] = avg
                    B_vol[2, col] = avg
                B_bar_vol += B_vol * detJ * w
            if abs(V_total) > 1e-30:
                B_bar_vol /= V_total

        with np.errstate(divide='ignore', over='ignore', invalid='ignore'):
            for gp in range(8):
                xi, eta, zeta = self._GAUSS_PTS[gp]
                dN = self._dshape(xi, eta, zeta)
                J, detJ = self._jacobian(dN)
                if detJ <= 0:
                    raise ValueError(f"Hex8: non-positive Jacobian ({detJ}) at GP {gp}")
                dN_dx = np.linalg.solve(J, dN)        # (3,3)^-1 · (3,8)
                B = self._B_from_dN(dN_dx)
                w = self._GAUSS_W[gp]

                if self.use_bbar and B_bar_vol is not None:
                    B_dev = B.copy()
                    for col in range(24):
                        avg = (B[0, col] + B[1, col] + B[2, col]) / 3.0
                        B_dev[0, col] -= avg
                        B_dev[1, col] -= avg
                        B_dev[2, col] -= avg
                    B_eff = B_dev + B_bar_vol
                else:
                    B_eff = B

                K += (B_eff.T @ D @ B_eff) * detJ * w

        K = np.nan_to_num(K, nan=0.0, posinf=0.0, neginf=0.0)
        return K

    def consistent_mass(self) -> ndarray:
        """24 × 24 consistent mass matrix."""
        rho = float(self.mat.rho)
        M = np.zeros((24, 24), dtype=float64)
        for gp in range(8):
            xi, eta, zeta = self._GAUSS_PTS[gp]
            N = self._shape(xi, eta, zeta)
            dN = self._dshape(xi, eta, zeta)
            _, detJ = self._jacobian(dN)
            w = self._GAUSS_W[gp]
            # N_mat (3 × 24): Ni · I_{3×3}
            Nm = np.zeros((3, 24), dtype=float64)
            for i in range(8):
                Nm[0, i * 3]     = N[i]
                Nm[1, i * 3 + 1] = N[i]
                Nm[2, i * 3 + 2] = N[i]
            M += rho * (Nm.T @ Nm) * detJ * w
        return M


class Hex20Element:
    """
    20-node serendipity hexahedron (quadratic).

    3 DOF/node → 60 DOF total.
    Full 3 × 3 × 3 (27-point) Gauss integration.

    Better accuracy than Hex8 for bending-dominated problems
    without the locking issues of the linear brick.
    """

    # 20-node natural coordinates (8 corners + 12 midside)
    _NODE_NAT = np.array([
        # Corners
        [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
        [-1, -1,  1], [1, -1,  1], [1, 1,  1], [-1, 1,  1],
        # Midside (bottom face)
        [0, -1, -1], [1, 0, -1], [0, 1, -1], [-1, 0, -1],
        # Midside (top face)
        [0, -1,  1], [1, 0,  1], [0, 1,  1], [-1, 0,  1],
        # Midside (vertical edges)
        [-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0],
    ], dtype=float64)

    # 3 × 3 × 3 Gauss quadrature (27 points)
    _GP_1D = np.array([-math.sqrt(3 / 5), 0.0, math.sqrt(3 / 5)], dtype=float64)
    _GW_1D = np.array([5 / 9, 8 / 9, 5 / 9], dtype=float64)

    def __init__(self, node_coords: ndarray, material: SolidMaterial):
        assert node_coords.shape == (20, 3), "Hex20 requires 20 nodes × 3 coords"
        self.coords = node_coords.astype(float64)
        self.mat = material

    @staticmethod
    def _shape(xi: float64, eta: float64, zeta: float64) -> ndarray:
        """20 serendipity shape functions."""
        N = np.empty(20, dtype=float64)
        nn = Hex20Element._NODE_NAT
        # Corner nodes 0-7
        for i in range(8):
            xi_i, eta_i, zeta_i = nn[i]
            xp = 1 + xi_i * xi
            ep = 1 + eta_i * eta
            zp = 1 + zeta_i * zeta
            N[i] = 0.125 * xp * ep * zp * (xi_i * xi + eta_i * eta + zeta_i * zeta - 2)
        # Midside nodes 8-19
        for i in range(8, 20):
            xi_i, eta_i, zeta_i = nn[i]
            if abs(xi_i) < 1e-10:
                N[i] = 0.25 * (1 - xi ** 2) * (1 + eta_i * eta) * (1 + zeta_i * zeta)
            elif abs(eta_i) < 1e-10:
                N[i] = 0.25 * (1 + xi_i * xi) * (1 - eta ** 2) * (1 + zeta_i * zeta)
            else:
                N[i] = 0.25 * (1 + xi_i * xi) * (1 + eta_i * eta) * (1 - zeta ** 2)
        return N

    @staticmethod
    def _dshape(xi: float64, eta: float64, zeta: float64) -> ndarray:
        """Derivatives (3 × 20) of serendipity shape functions."""
        dN = np.zeros((3, 20), dtype=float64)
        nn = Hex20Element._NODE_NAT

        # Numerical derivatives with central difference (robust)
        h = 1e-7
        N_p = [Hex20Element._shape(xi + h, eta, zeta),
               Hex20Element._shape(xi, eta + h, zeta),
               Hex20Element._shape(xi, eta, zeta + h)]
        N_m = [Hex20Element._shape(xi - h, eta, zeta),
               Hex20Element._shape(xi, eta - h, zeta),
               Hex20Element._shape(xi, eta, zeta - h)]
        for d in range(3):
            dN[d, :] = (N_p[d] - N_m[d]) / (2 * h)
        return dN

    def stiffness_matrix(self) -> ndarray:
        """60 × 60 stiffness via 27-point Gauss quadrature."""
        D = self.mat.D_matrix()
        K = np.zeros((60, 60), dtype=float64)

        with np.errstate(divide='ignore', over='ignore', invalid='ignore'):
            for i, xi in enumerate(self._GP_1D):
                for j, eta in enumerate(self._GP_1D):
                    for k, zeta in enumerate(self._GP_1D):
                        w = self._GW_1D[i] * self._GW_1D[j] * self._GW_1D[k]
                        dN = self._dshape(xi, eta, zeta)
                        J = dN @ self.coords
                        detJ = float64(np.linalg.det(J))
                        if detJ <= 0:
                            raise ValueError(f"Hex20: non-positive Jacobian at GP ({i},{j},{k})")
                        dN_dx = np.linalg.solve(J, dN)

                        # Build B (6 × 60)
                        B = np.zeros((6, 60), dtype=float64)
                        for n in range(20):
                            c = n * 3
                            dx, dy, dz = dN_dx[0, n], dN_dx[1, n], dN_dx[2, n]
                            B[0, c]     = dx
                            B[1, c + 1] = dy
                            B[2, c + 2] = dz
                            B[3, c]     = dy;  B[3, c + 1] = dx
                            B[4, c + 1] = dz;  B[4, c + 2] = dy
                            B[5, c]     = dz;  B[5, c + 2] = dx

                        K += (B.T @ D @ B) * detJ * w

        K = np.nan_to_num(K, nan=0.0, posinf=0.0, neginf=0.0)
        return K


###############################################################################
#  4.  KIRCHHOFF–LOVE  THIN  PLATE  (DKQ)
###############################################################################

class KirchhoffPlate:
    """
    4-node Kirchhoff (thin) plate element — Discrete Kirchhoff Quadrilateral.

    3 DOF/node:  w, θx, θy  →  12 DOF total.

    No transverse-shear deformation (Kirchhoff constraint: γ_xz = γ_yz = 0).
    Valid when  h / L < 1/20  (span-to-thickness > 20).

    The element uses Kirchhoff-constraint enforcement at discrete points
    (DKQ methodology) to avoid C¹-continuity requirements.

    Implementation: since this is the thin-plate limit, we assemble
    the bending stiffness only (no shear contribution) using 2 × 2
    Gauss quadrature on the standard Q4 shape functions.

    Reference: Batoz J-L, Tahar M B, "Evaluation of a New Quadrilateral
    Thin Plate Bending Element," IJNME 1982.
    """

    def __init__(self, nodes: List[Tuple[float, float]], thickness: float,
                 E: float = 200e6, nu: float = 0.3):
        assert len(nodes) == 4
        self.nodes = np.array(nodes, dtype=float64)
        self.h = float64(thickness)
        self.E = float64(E)
        self.nu = float64(nu)

    @property
    def D_bending(self) -> ndarray:
        """Flexural rigidity matrix  D = Eh³ / 12(1-ν²) · [...]"""
        D = self.E * self.h ** 3 / (12.0 * (1.0 - self.nu ** 2))
        return D * np.array([
            [1.0,     self.nu, 0.0],
            [self.nu, 1.0,     0.0],
            [0.0,     0.0,     (1.0 - self.nu) / 2.0],
        ], dtype=float64)

    def _shape_derivs(self, r: float, s: float):
        ri = np.array([-1, 1, 1, -1], dtype=float64)
        si = np.array([-1, -1, 1, 1], dtype=float64)
        dN_dr = 0.25 * ri * (1 + si * s)
        dN_ds = 0.25 * si * (1 + ri * r)
        return dN_dr, dN_ds

    def stiffness_matrix(self) -> ndarray:
        """12 × 12 thin-plate bending stiffness matrix."""
        Db = self.D_bending
        K = np.zeros((12, 12), dtype=float64)
        gp = [-1 / math.sqrt(3), 1 / math.sqrt(3)]
        for r in gp:
            for s in gp:
                dN_dr, dN_ds = self._shape_derivs(r, s)
                J = np.array([
                    [dN_dr @ self.nodes[:, 0], dN_dr @ self.nodes[:, 1]],
                    [dN_ds @ self.nodes[:, 0], dN_ds @ self.nodes[:, 1]],
                ], dtype=float64)
                detJ = abs(np.linalg.det(J))
                Ji = np.linalg.inv(J)
                dN_dx = Ji[0, 0] * dN_dr + Ji[0, 1] * dN_ds
                dN_dy = Ji[1, 0] * dN_dr + Ji[1, 1] * dN_ds

                Bb = np.zeros((3, 12), dtype=float64)
                for i in range(4):
                    c = i * 3
                    Bb[0, c + 2] = dN_dx[i]   # κx  = ∂θy/∂x
                    Bb[1, c + 1] = -dN_dy[i]  # κy  = -∂θx/∂y
                    Bb[2, c + 1] = -dN_dx[i]  # κxy
                    Bb[2, c + 2] = dN_dy[i]
                K += Bb.T @ Db @ Bb * detJ
        return K


###############################################################################
#  5.  RIGID  /  SEMI-RIGID  DIAPHRAGM  CONSTRAINT
###############################################################################

@dataclass
class DiaphragmConstraint:
    """
    Rigid-diaphragm constraint for a floor level.

    Slaves the in-plane translational DOFs (X, Y) and the rotation
    about the vertical axis (RZ) of every slave node to a master
    Centre-of-Mass (CM) node.

    For semi-rigid diaphragms, provide a finite `k_membrane`
    that adds the membrane stiffness of the slab; for rigid
    diaphragms, set `k_membrane = None` (penalty / MPC approach).

    Implementation
    --------------
    For rigid:  u_sx  =  u_mx  −  Rz_m · (y_s − y_cm)
                u_sy  =  u_my  +  Rz_m · (x_s − x_cm)
                Rz_s  =  Rz_m

    This gives a 3 × 3 transformation per slave node mapping
    [u_sx, u_sy, Rz_s]  →  [u_mx, u_my, Rz_m].

    The assembler uses the penalty method or direct MPC elimination
    to enforce these constraints.

    Parameters
    ----------
    floor_z : float
        Elevation of this diaphragm level (m).
    master_node : str
        Node ID of the CM (will be created if not in model).
    slave_nodes : list of str
        All floor-node IDs to be slaved.
    node_coords : dict
        {node_id: (x, y, z)} for computing eccentricities.
    k_membrane : float or None
        If None → rigid.  If float → semi-rigid membrane stiffness (kN/m).
    mass : float
        Lumped floor mass at CM (for seismic mass source).
    mmoi : float
        Mass moment of inertia about CM (for rotational DOF).
    """

    floor_z: float64
    master_node: str
    slave_nodes: List[str]
    node_coords: Dict[str, Tuple[float64, float64, float64]]
    k_membrane: Optional[float64] = None   # None = rigid
    mass: float64 = float64(0.0)
    mmoi: float64 = float64(0.0)

    def compute_cm(self) -> Tuple[float64, float64]:
        """Compute centre of mass from slave node positions (equal mass assumed)."""
        xs = [self.node_coords[n][0] for n in self.slave_nodes if n in self.node_coords]
        ys = [self.node_coords[n][1] for n in self.slave_nodes if n in self.node_coords]
        if not xs:
            return float64(0), float64(0)
        return float64(np.mean(xs)), float64(np.mean(ys))

    def slave_transform(self, slave_id: str) -> ndarray:
        """
        3 × 3 transformation T such that:
            [u_sx, u_sy, Rz_s] = T · [u_mx, u_my, Rz_m]

        T = [[1,  0, -(y_s - y_cm)],
             [0,  1,  (x_s - x_cm)],
             [0,  0,  1           ]]
        """
        cm_x, cm_y = self.compute_cm()
        sx, sy, _ = self.node_coords[slave_id]
        dx = sx - cm_x
        dy = sy - cm_y
        return np.array([
            [1.0, 0.0, -dy],
            [0.0, 1.0,  dx],
            [0.0, 0.0,  1.0],
        ], dtype=float64)

    def build_penalty_stiffness(self,
                                nmap: Dict[str, int],
                                penalty: float64 = float64(1e10)
                                ) -> Tuple[ndarray, ndarray, ndarray]:
        """
        Return COO triplets (rows, cols, vals) that enforce the diaphragm
        constraint via the penalty method.

        For each slave node s, adds penalty springs:
            k_penalty · (u_s - T · u_m)² / 2

        which gives stiffness contributions between slave DOFs and master DOFs.

        Returns (rows, cols, vals) arrays for global assembly.
        """
        cm_x, cm_y = self.compute_cm()
        mi = nmap.get(self.master_node)
        if mi is None:
            return np.array([], dtype=np.intp), np.array([], dtype=np.intp), np.array([], dtype=float64)

        master_dofs = [mi * 6, mi * 6 + 1, mi * 6 + 5]   # ux, uy, rz

        rows_list, cols_list, vals_list = [], [], []

        kp = penalty if self.k_membrane is None else self.k_membrane

        for sid in self.slave_nodes:
            si = nmap.get(sid)
            if si is None or sid == self.master_node:
                continue
            slave_dofs = [si * 6, si * 6 + 1, si * 6 + 5]
            T = self.slave_transform(sid)

            # Penalty approach:  K_c = kp · A^T · A
            # where  A · d = 0  →  A = [I_slave  |  -T_slave_master]
            # d = [u_s, u_m]
            # So we add:
            #   kp on slave diagonal   (A^T A → I)
            #  -kp·T on slave-master cross  (A^T A → -T)
            #   kp·T^T·T on master diagonal (A^T A → T^T T)

            for a in range(3):
                sd = slave_dofs[a]
                # Slave-slave diagonal
                rows_list.append(sd)
                cols_list.append(sd)
                vals_list.append(kp)

                for b in range(3):
                    md = master_dofs[b]
                    t_ab = T[a, b]

                    # Slave-master cross term
                    rows_list.append(sd)
                    cols_list.append(md)
                    vals_list.append(-kp * t_ab)

                    rows_list.append(md)
                    cols_list.append(sd)
                    vals_list.append(-kp * t_ab)

                    # Master-master (T^T T contribution)
                    for c in range(3):
                        md2 = master_dofs[c]
                        rows_list.append(md)
                        cols_list.append(md2)
                        vals_list.append(kp * T[a, b] * T[a, c])

        return (
            np.array(rows_list, dtype=np.intp),
            np.array(cols_list, dtype=np.intp),
            np.array(vals_list, dtype=float64),
        )

    def build_mass_contributions(self, nmap: Dict[str, int]) -> Tuple[ndarray, ndarray, ndarray]:
        """Mass matrix contributions at CM node for seismic analysis."""
        mi = nmap.get(self.master_node)
        if mi is None:
            return np.array([], dtype=np.intp), np.array([], dtype=np.intp), np.array([], dtype=float64)

        rows, cols, vals = [], [], []
        dofs = [mi * 6, mi * 6 + 1, mi * 6 + 5]  # ux, uy, rz
        masses = [float(self.mass), float(self.mass), float(self.mmoi)]
        for d, m in zip(dofs, masses):
            if m > 0:
                rows.append(d)
                cols.append(d)
                vals.append(m)
        return (
            np.array(rows, dtype=np.intp),
            np.array(cols, dtype=np.intp),
            np.array(vals, dtype=float64),
        )


###############################################################################
#  6.  PHYSICAL-TO-ANALYTICAL  MESHING  ENGINE
###############################################################################

@dataclass
class PhysicalMember:
    """
    A physical member as drawn by the user (e.g. a 10 m column from
    ground to roof).  Beams may frame in at arbitrary heights creating
    intersection points.  The meshing engine splits this into analytical
    sub-elements automatically.
    """

    id: str
    node_i: str                  # Start-node id (physical)
    node_j: str                  # End-node id (physical)
    section_properties: Dict     # E, A, Iz, Iy, J, G, …
    element_type: str = "frame"  # "frame" | "truss" | "cable"


class PhysicalToAnalyticalMesher:
    """
    Converts a physical model (user-drawn) into an analytical model
    (node-to-node elements) suitable for the DSM solver.

    Similar to ETABS/STAAD auto-meshing:
    1.  Detect intersection points where physical members cross.
    2.  Insert internal nodes at intersection + user-specified split points.
    3.  Create sub-elements between consecutive nodes.
    4.  Optionally subdivide members for more accuracy (n-divisions).
    5.  Merge coincident nodes within a tolerance.

    The output is a `StructuralModel` (nodes + elements) ready for assembly.
    """

    def __init__(self, tolerance: float = 0.001):
        """tolerance: minimum distance to consider two points coincident (m)."""
        self.tol = tolerance

    @staticmethod
    def _point_on_segment(p: ndarray, a: ndarray, b: ndarray, tol: float = 1e-4) -> bool:
        """True if point p lies on segment a→b within tolerance."""
        ab = b - a
        ap = p - a
        L = np.linalg.norm(ab)
        if L < tol:
            return np.linalg.norm(ap) < tol
        t = np.dot(ap, ab) / (L * L)
        if t < -tol / L or t > 1 + tol / L:
            return False
        proj = a + t * ab
        return np.linalg.norm(p - proj) < tol

    @staticmethod
    def _segment_intersect_3d(
        a1: ndarray, a2: ndarray, b1: ndarray, b2: ndarray, tol: float = 1e-4
    ) -> Optional[ndarray]:
        """
        Find intersection point of two 3-D line segments (if they intersect
        within tolerance).  Uses closest-approach algorithm.

        Returns the midpoint of closest approach if distance < tol, else None.
        """
        d1 = a2 - a1
        d2 = b2 - b1
        r = a1 - b1

        a = np.dot(d1, d1)
        b = np.dot(d1, d2)
        c = np.dot(d2, d2)
        d = np.dot(d1, r)
        e = np.dot(d2, r)

        det = a * c - b * b
        if abs(det) < 1e-15:
            return None      # parallel

        s = (b * e - c * d) / det
        t = (a * e - b * d) / det

        if s < -tol or s > 1 + tol or t < -tol or t > 1 + tol:
            return None      # outside segments

        p1 = a1 + s * d1
        p2 = b1 + t * d2
        dist = np.linalg.norm(p1 - p2)

        if dist > tol:
            return None

        return (p1 + p2) / 2.0

    def mesh(
        self,
        nodes: Dict[str, Tuple[float, float, float]],
        physical_members: List[PhysicalMember],
        min_divisions: int = 1,
    ) -> Tuple[Dict[str, Tuple[float, float, float]], List[Dict]]:
        """
        Convert physical model to analytical model.

        Parameters
        ----------
        nodes : dict
            {node_id: (x, y, z)} – user-defined nodes.
        physical_members : list of PhysicalMember
            Physical members as drawn by the user.
        min_divisions : int
            Minimum number of sub-elements per physical member.

        Returns
        -------
        analytical_nodes : dict
            {node_id: (x, y, z)} including all original + internal nodes.
        analytical_elements : list of dict
            Each dict has keys: id, node_i, node_j, parent_id, and
            all section properties from the parent physical member.
        """
        all_nodes: Dict[str, ndarray] = {
            nid: np.array(coords, dtype=float64) for nid, coords in nodes.items()
        }

        # Step 1: Find all intersection points between physical members
        n_members = len(physical_members)
        member_splits: Dict[str, List[ndarray]] = {
            m.id: [] for m in physical_members
        }

        for i in range(n_members):
            mi = physical_members[i]
            ai = all_nodes[mi.node_i]
            aj = all_nodes[mi.node_j]
            for j in range(i + 1, n_members):
                mj = physical_members[j]
                bi = all_nodes[mj.node_i]
                bj = all_nodes[mj.node_j]
                pt = self._segment_intersect_3d(ai, aj, bi, bj, self.tol)
                if pt is not None:
                    # Check if this is an endpoint (skip if so)
                    is_ep = any(np.linalg.norm(pt - ep) < self.tol
                               for ep in [ai, aj, bi, bj])
                    if not is_ep:
                        member_splits[mi.id].append(pt)
                        member_splits[mj.id].append(pt)

        # Step 2: Check where existing nodes lie on physical members
        for m in physical_members:
            a = all_nodes[m.node_i]
            b = all_nodes[m.node_j]
            for nid, ncoord in all_nodes.items():
                if nid in (m.node_i, m.node_j):
                    continue
                if self._point_on_segment(ncoord, a, b, self.tol):
                    member_splits[m.id].append(ncoord)

        # Step 3: Create internal nodes (merge within tolerance)
        node_counter = 0
        analytical_nodes: Dict[str, Tuple[float, float, float]] = dict(nodes)

        def _find_or_create_node(pt: ndarray) -> str:
            nonlocal node_counter
            for nid, nc in analytical_nodes.items():
                if np.linalg.norm(pt - np.array(nc)) < self.tol:
                    return nid
            node_counter += 1
            nid = f"_auto_{node_counter}"
            analytical_nodes[nid] = (float(pt[0]), float(pt[1]), float(pt[2]))
            return nid

        # Step 4: Split physical members into sub-elements
        analytical_elements: List[Dict] = []
        elem_counter = 0

        for m in physical_members:
            a = np.array(analytical_nodes[m.node_i], dtype=float64)
            b = np.array(analytical_nodes[m.node_j], dtype=float64)
            ab = b - a
            L = np.linalg.norm(ab)
            if L < self.tol:
                continue

            # Collect all split points along this member
            splits: List[Tuple[float, str]] = [(0.0, m.node_i), (1.0, m.node_j)]
            for sp in member_splits[m.id]:
                t = np.dot(sp - a, ab) / (L * L) if L > 1e-12 else 0
                nid = _find_or_create_node(sp)
                splits.append((t, nid))

            # Add uniform subdivision points
            if min_divisions > 1:
                for k in range(1, min_divisions):
                    t = k / min_divisions
                    pt = a + t * ab
                    nid = _find_or_create_node(pt)
                    splits.append((t, nid))

            # Sort by parametric coordinate and remove duplicates
            splits.sort(key=lambda x: x[0])
            unique_splits: List[Tuple[float, str]] = [splits[0]]
            for sp in splits[1:]:
                if abs(sp[0] - unique_splits[-1][0]) > self.tol / L:
                    unique_splits.append(sp)

            # Create sub-elements
            for idx in range(len(unique_splits) - 1):
                _, ni = unique_splits[idx]
                _, nj = unique_splits[idx + 1]
                elem_counter += 1
                analytical_elements.append({
                    "id": f"_ae_{elem_counter}",
                    "node_i": ni,
                    "node_j": nj,
                    "parent_id": m.id,
                    "element_type": m.element_type,
                    **m.section_properties,
                })

        return analytical_nodes, analytical_elements


###############################################################################
#  ELEMENT REGISTRY – single place to look up constructors by type
###############################################################################

ELEMENT_REGISTRY = {
    "gap":                GapElement,
    "hook":               HookElement,
    "friction_pendulum":  FrictionPendulumElement,
    "viscous_damper":     ViscousDamperElement,
    "multilinear_spring": MultiLinearSpring,
    "tension_only":       TensionOnlyMember,
    "compression_only":   CompressionOnlyMember,
    "hex8":               Hex8Element,
    "hex20":              Hex20Element,
    "kirchhoff_plate":    KirchhoffPlate,
    "diaphragm":          DiaphragmConstraint,
    "physical_mesher":    PhysicalToAnalyticalMesher,
}
