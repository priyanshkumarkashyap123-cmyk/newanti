"""
advanced_solver.py  –  Extended DSM Solver with Advanced Element Support
=========================================================================

Extends the production DirectStiffnessMethod3D to handle:
  • Plate/shell elements (Mindlin-Reissner thick, Kirchhoff thin)
  • Solid brick elements (Hex8, Hex20)
  • Non-linear link elements (Gap, Hook, Friction Pendulum, Viscous Damper, Multi-Linear)
  • Tension/compression-only frame members (iterative)
  • Rigid/semi-rigid diaphragm constraints
  • Physical-to-analytical auto-meshing

Integrates with the existing SparseAssembler COO → CSR pipeline.
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
from scipy.sparse import coo_matrix, csr_matrix
from scipy.sparse import linalg as sp_linalg

from .dsm_3d_frame import (
    DOFS_PER_NODE,
    DOF_NAMES,
    AnalysisResult,
    BoundaryConditions,
    DirectStiffnessMethod3D,
    Element3D,
    FixedEndForces,
    MemberLoad,
    Node3D,
    SparseAssembler,
    StructuralModel,
    TimoshenkoBeam3D,
    Transform3D,
    apply_releases_static_condensation,
)

from ..elements.advanced_elements import (
    CompressionOnlyMember,
    DiaphragmConstraint,
    FrictionPendulumElement,
    GapElement,
    Hex20Element,
    Hex8Element,
    HookElement,
    KirchhoffPlate,
    MultiLinearSpring,
    PhysicalMember,
    PhysicalToAnalyticalMesher,
    SolidMaterial,
    TensionOnlyMember,
    ViscousDamperElement,
)

from ..elements.plate import MindlinPlate, PlateSection

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
#  EXTENDED DATA STRUCTURES
# ---------------------------------------------------------------------------

@dataclass
class PlateElement3D:
    """4-node plate/shell element for inclusion in the structural model."""

    id: str
    nodes: List[str]             # 4 node IDs
    thickness: float64 = float64(0.2)
    E: float64 = float64(30e6)  # Concrete-like default
    nu: float64 = float64(0.2)
    rho: float64 = float64(2400.0)
    formulation: str = "thick"   # "thick" (Mindlin-Reissner) | "thin" (Kirchhoff)


@dataclass
class SolidElement3D:
    """8-node or 20-node solid (brick) element."""

    id: str
    nodes: List[str]             # 8 or 20 node IDs
    E: float64 = float64(200e6)
    nu: float64 = float64(0.3)
    rho: float64 = float64(7850.0)
    element_type: str = "hex8"   # "hex8" | "hex20"
    use_bbar: bool = False       # B-bar for volumetric locking


@dataclass
class LinkElement3D:
    """Non-linear link element (zero-length or short connector)."""

    id: str
    node_i: str
    node_j: str
    link_type: str = "gap"       # gap | hook | friction_pendulum | viscous_damper | multilinear
    direction: int = 0           # 0=X, 1=Y, 2=Z
    properties: Dict[str, float64] = field(default_factory=dict)
    # Properties by type:
    #   gap:               k_comp, gap_open
    #   hook:              k_tens, slack
    #   friction_pendulum: R, mu, W, D_design
    #   viscous_damper:    C, alpha
    #   multilinear:       backbone (list of [d, f] pairs)


@dataclass
class AdvancedModel(StructuralModel):
    """
    Extended structural model with plate, solid, link, and diaphragm support.
    Inherits all base-class fields (nodes, elements, nodal_loads, etc.).
    """

    plate_elements: Dict[str, PlateElement3D] = field(default_factory=dict)
    solid_elements: Dict[str, SolidElement3D] = field(default_factory=dict)
    link_elements: Dict[str, LinkElement3D] = field(default_factory=dict)
    diaphragms: List[DiaphragmConstraint] = field(default_factory=list)

    # Tension/compression-only member tracking
    tension_only_ids: List[str] = field(default_factory=list)
    compression_only_ids: List[str] = field(default_factory=list)

    @property
    def n_nodes(self) -> int:
        return len(self.nodes)

    @property
    def n_dofs(self) -> int:
        return self.n_nodes * DOFS_PER_NODE


# ---------------------------------------------------------------------------
#  ADVANCED ASSEMBLER – dispatch by element type
# ---------------------------------------------------------------------------

class AdvancedAssembler:
    """
    Extended assembler that handles frame, plate, solid, and link elements
    in one unified COO → CSR pass.
    """

    @staticmethod
    def assemble(
        model: AdvancedModel,
        tc_states: Optional[Dict[str, float64]] = None,
    ) -> Tuple[csr_matrix, ndarray, Dict[str, int], Dict[int, str], Dict[str, Dict]]:
        """
        Full assembly with multi-element dispatch.

        Parameters
        ----------
        model : AdvancedModel
        tc_states : dict, optional
            {element_id: axial_force} for tension/compression-only iteration.

        Returns
        -------
        K, F, nmap, dmap, element_data
        """
        n_dofs = model.n_dofs
        node_ids = sorted(model.nodes.keys())
        nmap: Dict[str, int] = {nid: idx for idx, nid in enumerate(node_ids)}

        dmap: Dict[int, str] = {}
        for nid, idx in nmap.items():
            for off, name in enumerate(DOF_NAMES):
                dmap[idx * 6 + off] = f"{nid}_{name}"

        # Pre-allocate COO arrays (generous upper-bound)
        n_frame = len(model.elements)
        n_plate = len(model.plate_elements)
        n_solid = len(model.solid_elements)
        n_link = len(model.link_elements)

        # Frame: 144 per element, Plate: 576 (24×24), Solid: 576 (24×24) or 3600 (60×60)
        # Link: up to 144 (12×12)
        max_entries = (
            n_frame * 144 +
            n_plate * 576 +
            n_solid * 3600 +
            n_link * 144 +
            100000  # headroom for diaphragm penalties
        )

        rows = np.zeros(max_entries, dtype=np.intp)
        cols = np.zeros(max_entries, dtype=np.intp)
        vals = np.zeros(max_entries, dtype=float64)
        ptr = 0

        F = np.zeros(n_dofs, dtype=float64)
        _element_data: Dict[str, Dict] = {}

        # ── 1. FRAME ELEMENTS ──────────────────────────────────────

        for el in model.elements.values():
            ni = model.nodes[el.node_i]
            nj = model.nodes[el.node_j]

            dx = float64(nj.x - ni.x)
            dy = float64(nj.y - ni.y)
            dz = float64(nj.z - ni.z)
            L = math.sqrt(dx * dx + dy * dy + dz * dz)
            el.length = float64(L)

            k_local = TimoshenkoBeam3D.local_stiffness(el, L)

            if el.releases:
                k_local = apply_releases_static_condensation(k_local, el.releases)

            lam = Transform3D.direction_cosine_matrix(
                ni.x, ni.y, ni.z, nj.x, nj.y, nj.z, el.beta_angle,
            )
            T = Transform3D.build_T12(lam)
            k_global = Transform3D.transform(k_local, T)

            # Tension/compression-only scaling
            if tc_states and el.id in tc_states:
                axial = tc_states[el.id]
                if el.id in model.tension_only_ids and axial <= 0:
                    k_global *= 1e-6
                elif el.id in model.compression_only_ids and axial >= 0:
                    k_global *= 1e-6

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
                "type": "frame",
            }

            # Self-weight
            if model.include_self_weight:
                w_self = el.rho * el.A * model.gravity_magnitude / 1000.0
                half_w = w_self * L / 2.0
                mom_w = w_self * L * L / 12.0
                fef_global = np.zeros(12, dtype=float64)
                fef_global[1] = -half_w
                fef_global[5] = -mom_w
                fef_global[7] = -half_w
                fef_global[11] = mom_w
                for li in range(12):
                    F[dofs[li]] -= fef_global[li]

        # ── 2. PLATE / SHELL ELEMENTS ──────────────────────────────

        for pe in model.plate_elements.values():
            node_objs = [model.nodes[nid] for nid in pe.nodes]
            node_indices = [nmap[nid] for nid in pe.nodes]

            # Get node coordinates
            coords_2d = [(float(n.x), float(n.y)) for n in node_objs]
            coords_3d = [(float(n.x), float(n.y), float(n.z)) for n in node_objs]

            # Compute local stiffness (12 × 12, 3 DOF/node: w, θx, θy)
            if pe.formulation == "thick":
                section = PlateSection(
                    thickness=float(pe.thickness),
                    E=float(pe.E),
                    nu=float(pe.nu),
                    rho=float(pe.rho),
                )
                plate = MindlinPlate(
                    nodes=coords_2d,
                    section=section,
                )
                k_plate = plate.get_stiffness_matrix()
            else:
                # Kirchhoff (thin) formulation
                plate = KirchhoffPlate(
                    nodes=coords_2d,
                    thickness=float(pe.thickness),
                    E=float(pe.E),
                    nu=float(pe.nu),
                )
                k_plate = plate.stiffness_matrix()

            # Map plate DOFs (3/node: w, θx, θy) → global 6-DOF system
            # Plate local DOFs per node:  [w, θx, θy]
            # Global DOFs per node:       [ux, uy, uz, rx, ry, rz]
            # Mapping:  w → uz (2), θx → rx (3), θy → ry (4)
            plate_to_global = [2, 3, 4]  # local plate DOF → global offset

            # Build global DOF map for plate (4 nodes × 3 DOF each = 12 entries)
            plate_global_dofs = []
            for ni_idx in node_indices:
                base = ni_idx * 6
                for pd in plate_to_global:
                    plate_global_dofs.append(base + pd)

            # Assemble 12×12 plate stiffness into global
            assert k_plate.shape == (12, 12)
            for li in range(12):
                gi = plate_global_dofs[li]
                for lj in range(12):
                    gj = plate_global_dofs[lj]
                    if ptr < max_entries:
                        rows[ptr] = gi
                        cols[ptr] = gj
                        vals[ptr] = k_plate[li, lj]
                        ptr += 1

            _element_data[pe.id] = {
                "k_local": k_plate,
                "dofs": np.array(plate_global_dofs, dtype=np.intp),
                "type": pe.formulation + "_plate",
                "node_ids": pe.nodes,
            }

        # ── 3. SOLID (BRICK) ELEMENTS ──────────────────────────────

        for se in model.solid_elements.values():
            node_objs = [model.nodes[nid] for nid in se.nodes]
            node_indices = [nmap[nid] for nid in se.nodes]
            n_nodes_elem = len(se.nodes)

            coords = np.array(
                [[float(n.x), float(n.y), float(n.z)] for n in node_objs],
                dtype=float64,
            )

            mat = SolidMaterial(E=se.E, nu=se.nu, rho=se.rho)

            if se.element_type == "hex8":
                brick = Hex8Element(coords, mat, use_bbar=se.use_bbar)
                k_solid = brick.stiffness_matrix()       # 24 × 24
                dofs_per_node = 3
            elif se.element_type == "hex20":
                brick = Hex20Element(coords, mat)
                k_solid = brick.stiffness_matrix()       # 60 × 60
                dofs_per_node = 3
            else:
                logger.warning(f"Unknown solid type: {se.element_type}")
                continue

            # Map solid DOFs (3/node: ux, uy, uz) → global 6-DOF system
            # Solid local DOFs:  [u, v, w] per node
            # Global DOFs:       [ux(0), uy(1), uz(2), rx(3), ry(4), rz(5)]
            solid_to_global = [0, 1, 2]

            solid_global_dofs = []
            for ni_idx in node_indices:
                base = ni_idx * 6
                for sd in solid_to_global:
                    solid_global_dofs.append(base + sd)

            n_local = dofs_per_node * n_nodes_elem
            for li in range(n_local):
                gi = solid_global_dofs[li]
                for lj in range(n_local):
                    gj = solid_global_dofs[lj]
                    if ptr < max_entries:
                        rows[ptr] = gi
                        cols[ptr] = gj
                        vals[ptr] = k_solid[li, lj]
                        ptr += 1

            _element_data[se.id] = {
                "k_local": k_solid,
                "dofs": np.array(solid_global_dofs, dtype=np.intp),
                "type": se.element_type,
                "node_ids": se.nodes,
            }

        # ── 4. LINK ELEMENTS ──────────────────────────────────────

        for le in model.link_elements.values():
            i_idx = nmap[le.node_i]
            j_idx = nmap[le.node_j]

            if le.link_type == "gap":
                gap = GapElement(
                    id=le.id, node_i=le.node_i, node_j=le.node_j,
                    k_comp=float64(le.properties.get("k_comp", 1e6)),
                    gap_open=float64(le.properties.get("gap_open", 0.0)),
                    direction=le.direction,
                )
                k_link = gap.local_stiffness()       # 2 × 2
                dof_indices = gap.dof_map(i_idx, j_idx)

            elif le.link_type == "hook":
                hook = HookElement(
                    id=le.id, node_i=le.node_i, node_j=le.node_j,
                    k_tens=float64(le.properties.get("k_tens", 1e6)),
                    slack=float64(le.properties.get("slack", 0.0)),
                    direction=le.direction,
                )
                k_link = hook.local_stiffness()
                dof_indices = hook.dof_map(i_idx, j_idx)

            elif le.link_type == "friction_pendulum":
                fpe = FrictionPendulumElement(
                    id=le.id, node_i=le.node_i, node_j=le.node_j,
                    R=float64(le.properties.get("R", 2.0)),
                    mu=float64(le.properties.get("mu", 0.05)),
                    W=float64(le.properties.get("W", 500.0)),
                    D_design=float64(le.properties.get("D_design", 0.15)),
                )
                k_link = fpe.local_stiffness()       # 12 × 12
                dof_indices = fpe.dof_map(i_idx, j_idx)

            elif le.link_type == "viscous_damper":
                vd = ViscousDamperElement(
                    id=le.id, node_i=le.node_i, node_j=le.node_j,
                    C=float64(le.properties.get("C", 100.0)),
                    alpha=float64(le.properties.get("alpha", 1.0)),
                    direction=le.direction,
                )
                k_link = vd.local_stiffness()        # 2 × 2
                dof_indices = vd.dof_map(i_idx, j_idx)

            elif le.link_type == "multilinear":
                bb_raw = le.properties.get("backbone", [])
                backbone = [(float64(p[0]), float64(p[1])) for p in bb_raw] if bb_raw else \
                    [(-0.05, -100.0), (0.0, 0.0), (0.05, 100.0)]
                mls = MultiLinearSpring(
                    id=le.id, node_i=le.node_i, node_j=le.node_j,
                    backbone=backbone,
                    direction=le.direction,
                )
                k_link = mls.local_stiffness()       # 2 × 2
                dof_indices = mls.dof_map(i_idx, j_idx)

            else:
                logger.warning(f"Unknown link type: {le.link_type}")
                continue

            n_link_dof = len(dof_indices)
            for li in range(n_link_dof):
                gi = dof_indices[li]
                for lj in range(n_link_dof):
                    gj = dof_indices[lj]
                    if ptr < max_entries:
                        rows[ptr] = gi
                        cols[ptr] = gj
                        vals[ptr] = k_link[li, lj]
                        ptr += 1

            _element_data[le.id] = {
                "k_local": k_link,
                "dofs": np.array(dof_indices, dtype=np.intp),
                "type": le.link_type,
            }

        # Trim COO arrays
        rows = rows[:ptr]
        cols = cols[:ptr]
        vals = vals[:ptr]

        K = coo_matrix((vals, (rows, cols)), shape=(n_dofs, n_dofs)).tocsr()

        # ── 5. DIAPHRAGM CONSTRAINTS ──────────────────────────────

        for dia in model.diaphragms:
            dia.node_coords = {
                nid: (float64(n.x), float64(n.y), float64(n.z))
                for nid, n in model.nodes.items()
            }
            d_rows, d_cols, d_vals = dia.build_penalty_stiffness(nmap)
            if len(d_rows) > 0:
                K_dia = coo_matrix(
                    (d_vals, (d_rows, d_cols)), shape=(n_dofs, n_dofs)
                ).tocsr()
                K = K + K_dia

        # ── 6. NODAL LOADS ─────────────────────────────────────────

        for node_id, load_dict in model.nodal_loads.items():
            if node_id not in nmap:
                continue
            idx = nmap[node_id]
            for dof_name, value in load_dict.items():
                if dof_name in DOF_NAMES:
                    off = DOF_NAMES.index(dof_name)
                    F[idx * 6 + off] += float64(value)

        # ── 7. MEMBER LOADS ────────────────────────────────────────

        for ml in model.member_loads:
            if ml.element_id not in _element_data:
                logger.warning(f"Member load references unknown element: {ml.element_id}")
                continue

            ed = _element_data[ml.element_id]
            if ed["type"] != "frame":
                continue

            el = model.elements[ml.element_id]
            L = ed["L"]
            T = ed["T"]
            dofs = ed["dofs"]

            if ml.load_type == "udl":
                fef_local = FixedEndForces.udl_local(float64(ml.w1), L, ml.direction)
            elif ml.load_type == "trapez":
                fef_local = FixedEndForces.trapez_local(
                    float64(ml.w1), float64(ml.w2), L, ml.direction,
                )
            elif ml.load_type == "point":
                a = float64(ml.a) if ml.a > 0 else L / 2.0
                fef_local = FixedEndForces.point_load_local(
                    float64(ml.w1), a, L, ml.direction,
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
#  ADVANCED SOLVER – with iterative tension/compression-only capability
# ---------------------------------------------------------------------------

class AdvancedDirectStiffnessMethod(DirectStiffnessMethod3D):
    """
    Extended DSM solver that supports:
      • All element types (frame, plate, solid, link)
      • Tension/compression-only iterative analysis
      • Diaphragm constraints
      • Physical-to-analytical pre-meshing
    """

    def __init__(
        self,
        *,
        solver: str = "direct",
        check_conditioning: bool = True,
        max_tc_iterations: int = 30,
        tc_tolerance: float64 = float64(1e-4),
    ):
        super().__init__(solver=solver, check_conditioning=check_conditioning)
        self.max_tc_iter = max_tc_iterations
        self.tc_tol = tc_tolerance

    def analyze(self, model: Union[StructuralModel, AdvancedModel]) -> AnalysisResult:
        """
        Main entry:
        - If base StructuralModel → delegates to parent (frame-only).
        - If AdvancedModel → uses extended assembly + optional iteration.
        """
        if not isinstance(model, AdvancedModel):
            return super().analyze(model)

        t0 = time.perf_counter()
        self._model = model
        logger.info(
            f"Advanced Model: {model.n_nodes} nodes, "
            f"{len(model.elements)} frames, "
            f"{len(model.plate_elements)} plates, "
            f"{len(model.solid_elements)} solids, "
            f"{len(model.link_elements)} links, "
            f"{len(model.diaphragms)} diaphragms, "
            f"{model.n_dofs} DOFs"
        )

        has_tc = bool(model.tension_only_ids or model.compression_only_ids)

        if has_tc:
            result = self._iterative_tc_solve(model)
        else:
            result = self._single_pass_solve(model)

        elapsed = (time.perf_counter() - t0) * 1000.0
        result.solve_time_ms = float64(elapsed)
        self.result = result
        logger.info(f"Analysis complete: {model.n_dofs} DOFs in {elapsed:.1f} ms")
        return result

    def _single_pass_solve(self, model: AdvancedModel) -> AnalysisResult:
        """Standard single-pass analysis with advanced element types."""
        K, F, nmap, dmap, edata = AdvancedAssembler.assemble(model)
        self._K = K
        self._F = F
        self._nmap = nmap
        self._dmap = dmap
        self._edata = edata

        K_bc, F_bc = BoundaryConditions.apply_penalty(K, F, model, nmap)
        self._K = K_bc
        self._F = F_bc

        U = self._solve_system()
        self._U = U

        result = self._build_result(model, U, nmap, dmap, edata)
        return result

    def _iterative_tc_solve(self, model: AdvancedModel) -> AnalysisResult:
        """
        Newton-Raphson–style iteration for tension/compression-only members.

        Algorithm:
        1. Linear solve with all members active.
        2. Extract axial forces for T/C-only members.
        3. If any T-only member has N ≤ 0 → mark inactive.
           If any C-only member has N ≥ 0 → mark inactive.
        4. Re-assemble with inactive members scaled to near-zero stiffness.
        5. Repeat until convergence or max iterations.
        """
        tc_states: Dict[str, float64] = {}
        converged = False
        iteration = 0

        while iteration < self.max_tc_iter:
            iteration += 1
            logger.info(f"T/C iteration {iteration}")

            K, F, nmap, dmap, edata = AdvancedAssembler.assemble(
                model, tc_states=tc_states if tc_states else None,
            )

            K_bc, F_bc = BoundaryConditions.apply_penalty(K, F, model, nmap)

            try:
                U = sp_linalg.spsolve(K_bc, F_bc)
                U = np.asarray(U, dtype=float64).flatten()
            except Exception as e:
                raise RuntimeError(
                    f"Solver failed at T/C iteration {iteration}: {e}"
                ) from e

            # Extract axial forces for T/C members
            new_states: Dict[str, float64] = {}
            state_changed = False

            all_tc_ids = set(model.tension_only_ids) | set(model.compression_only_ids)

            for el_id in all_tc_ids:
                if el_id not in edata:
                    continue
                ed = edata[el_id]
                if ed["type"] != "frame":
                    continue

                dofs = ed["dofs"]
                T_mat = ed["T"]
                k_local = ed["k_local"]

                u_global = U[dofs]
                u_local = T_mat @ u_global
                f_local = k_local @ u_local

                axial_force = float64(f_local[6])  # Fx at node j = axial
                new_states[el_id] = axial_force

                old_axial = tc_states.get(el_id, float64(1.0))
                if el_id in model.tension_only_ids:
                    was_active = old_axial > 0
                    is_active = axial_force > 0
                else:
                    was_active = old_axial < 0
                    is_active = axial_force < 0

                if was_active != is_active:
                    state_changed = True

            tc_states = new_states

            if not state_changed:
                converged = True
                logger.info(f"T/C converged in {iteration} iterations")
                break

        self._nmap = nmap
        self._dmap = dmap
        self._edata = edata
        self._U = U
        self._K = K_bc
        self._F = F_bc

        result = self._build_result(model, U, nmap, dmap, edata)

        if not converged:
            result.warnings.append(
                f"Tension/compression-only analysis did not converge "
                f"in {self.max_tc_iter} iterations"
            )

        # Tag inactive members
        for el_id, axial in tc_states.items():
            if el_id in model.tension_only_ids and axial <= 0:
                result.warnings.append(f"Member {el_id}: SLACK (tension-only, N={axial:.2f})")
            elif el_id in model.compression_only_ids and axial >= 0:
                result.warnings.append(f"Member {el_id}: BUCKLED (compression-only, N={axial:.2f})")

        return result

    def _solve_system(self) -> ndarray:
        """Solve K·U = F using configured solver."""
        warnings: List[str] = []
        try:
            if self.solver_type == "iterative":
                U, info = sp_linalg.cg(self._K, self._F, tol=1e-10, maxiter=5000)
                if info != 0:
                    U = sp_linalg.spsolve(self._K, self._F)
            else:
                U = sp_linalg.spsolve(self._K, self._F)
        except Exception as e:
            raise RuntimeError(f"Solver failed: {e}") from e
        return np.asarray(U, dtype=float64).flatten()

    def _build_result(
        self,
        model: AdvancedModel,
        U: ndarray,
        nmap: Dict[str, int],
        dmap: Dict[int, str],
        edata: Dict[str, Dict],
    ) -> AnalysisResult:
        """Build AnalysisResult from displacement vector."""
        result = AnalysisResult(
            displacements=U,
            reactions={},
            element_forces={},
            node_displacements={},
            max_displacement=float64(np.max(np.abs(U))),
            n_dofs=len(U),
            warnings=[],
        )

        # Node displacements
        for nid in sorted(model.nodes.keys()):
            idx = nmap[nid]
            disp = {}
            for off, dname in enumerate(DOF_NAMES):
                disp[dname] = float(U[idx * 6 + off])
            result.node_displacements[nid] = disp

        # Reactions
        for nid, node in model.nodes.items():
            idx = nmap[nid]
            has_restraint = False
            rxn = {}
            for off, dname in enumerate(DOF_NAMES):
                if node.restraints.get(dname, False):
                    has_restraint = True
                    g = idx * 6 + off
                    r_val = self._K[g, :].dot(U) - self._F[g]
                    rxn[dname] = float(np.asarray(r_val).flat[0])
            if has_restraint:
                result.reactions[nid] = rxn

        # Element end-forces (frame elements only)
        for el_id, ed in edata.items():
            if ed["type"] != "frame":
                continue
            dofs = ed["dofs"]
            T_mat = ed["T"]
            k_local = ed["k_local"]

            u_global = U[dofs]
            u_local = T_mat @ u_global
            f_local = k_local @ u_local

            # Add fixed-end forces
            for ml in model.member_loads:
                if ml.element_id != el_id:
                    continue
                el = model.elements[el_id]
                L = ed["L"]
                if ml.load_type == "udl":
                    fef = FixedEndForces.udl_local(float64(ml.w1), L, ml.direction)
                elif ml.load_type == "trapez":
                    fef = FixedEndForces.trapez_local(
                        float64(ml.w1), float64(ml.w2), L, ml.direction,
                    )
                elif ml.load_type == "point":
                    a = float64(ml.a) if ml.a > 0 else L / 2.0
                    fef = FixedEndForces.point_load_local(
                        float64(ml.w1), a, L, ml.direction,
                    )
                elif ml.load_type == "temperature":
                    fef = FixedEndForces.temperature_local(
                        el, L, float64(ml.delta_T), float64(ml.delta_T_gradient),
                    )
                else:
                    continue
                f_local += fef

            force_names = [
                "Fx_i", "Fy_i", "Fz_i", "Mx_i", "My_i", "Mz_i",
                "Fx_j", "Fy_j", "Fz_j", "Mx_j", "My_j", "Mz_j",
            ]
            result.element_forces[el_id] = {
                name: float(f_local[k]) for k, name in enumerate(force_names)
            }

        return result


# ---------------------------------------------------------------------------
#  CONVENIENCE: build advanced model from dicts (JSON API)
# ---------------------------------------------------------------------------

def build_advanced_model_from_dicts(
    nodes: Dict[str, Dict],
    elements: Optional[List[Dict]] = None,
    supports: Optional[Dict[str, List[int]]] = None,
    nodal_loads: Optional[Dict[str, Dict[str, float]]] = None,
    member_loads: Optional[List[Dict]] = None,
    plate_elements: Optional[List[Dict]] = None,
    solid_elements: Optional[List[Dict]] = None,
    link_elements: Optional[List[Dict]] = None,
    diaphragms: Optional[List[Dict]] = None,
    tension_only: Optional[List[str]] = None,
    compression_only: Optional[List[str]] = None,
    include_self_weight: bool = False,
    auto_mesh: bool = False,
    mesh_divisions: int = 1,
) -> AdvancedModel:
    """Build AdvancedModel from JSON-friendly dicts."""

    model = AdvancedModel(include_self_weight=include_self_weight)

    # Nodes
    for nid, coords in nodes.items():
        model.nodes[str(nid)] = Node3D(
            id=str(nid),
            x=float64(coords.get("x", 0)),
            y=float64(coords.get("y", 0)),
            z=float64(coords.get("z", 0)),
        )

    # Supports
    if supports:
        for nid_str, dof_list in supports.items():
            nid = str(nid_str)
            if nid in model.nodes:
                for dof_idx in dof_list:
                    if 0 <= dof_idx < 6:
                        model.nodes[nid].restraints[DOF_NAMES[dof_idx]] = True

    # Frame elements
    if elements:
        for edef in elements:
            eid = str(edef.get("id", f"E{len(model.elements) + 1}"))
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

    # Plate elements
    if plate_elements:
        for pdef in plate_elements:
            pid = str(pdef.get("id", f"P{len(model.plate_elements) + 1}"))
            pe = PlateElement3D(
                id=pid,
                nodes=[str(n) for n in pdef["nodes"]],
                thickness=float64(pdef.get("thickness", 0.2)),
                E=float64(pdef.get("E", 30e6)),
                nu=float64(pdef.get("nu", 0.2)),
                rho=float64(pdef.get("rho", 2400)),
                formulation=pdef.get("formulation", "thick"),
            )
            model.plate_elements[pid] = pe

    # Solid elements
    if solid_elements:
        for sdef in solid_elements:
            sid = str(sdef.get("id", f"S{len(model.solid_elements) + 1}"))
            se = SolidElement3D(
                id=sid,
                nodes=[str(n) for n in sdef["nodes"]],
                E=float64(sdef.get("E", 200e6)),
                nu=float64(sdef.get("nu", 0.3)),
                rho=float64(sdef.get("rho", 7850)),
                element_type=sdef.get("element_type", "hex8"),
                use_bbar=sdef.get("use_bbar", False),
            )
            model.solid_elements[sid] = se

    # Link elements
    if link_elements:
        for ldef in link_elements:
            lid = str(ldef.get("id", f"L{len(model.link_elements) + 1}"))
            le = LinkElement3D(
                id=lid,
                node_i=str(ldef["node_i"]),
                node_j=str(ldef["node_j"]),
                link_type=ldef.get("link_type", "gap"),
                direction=int(ldef.get("direction", 0)),
                properties={
                    k: float64(v) if isinstance(v, (int, float)) else v
                    for k, v in ldef.get("properties", {}).items()
                },
            )
            model.link_elements[lid] = le

    # Diaphragms
    if diaphragms:
        for ddef in diaphragms:
            dia = DiaphragmConstraint(
                floor_z=float64(ddef.get("floor_z", 0)),
                master_node=str(ddef.get("master_node", "")),
                slave_nodes=[str(n) for n in ddef.get("slave_nodes", [])],
                node_coords={},  # Filled during assembly
                k_membrane=float64(ddef["k_membrane"]) if ddef.get("k_membrane") else None,
                mass=float64(ddef.get("mass", 0)),
                mmoi=float64(ddef.get("mmoi", 0)),
            )
            model.diaphragms.append(dia)

    # Nodal loads
    if nodal_loads:
        for nid_str, loads in nodal_loads.items():
            nid = str(nid_str)
            model.nodal_loads[nid] = {k: float64(v) for k, v in loads.items()}

    # Member loads
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

    # Tension/compression-only IDs
    if tension_only:
        model.tension_only_ids = [str(x) for x in tension_only]
    if compression_only:
        model.compression_only_ids = [str(x) for x in compression_only]

    return model


def analyze_advanced(
    nodes: Dict[str, Dict],
    elements: Optional[List[Dict]] = None,
    supports: Optional[Dict[str, List[int]]] = None,
    nodal_loads: Optional[Dict[str, Dict[str, float]]] = None,
    member_loads: Optional[List[Dict]] = None,
    plate_elements: Optional[List[Dict]] = None,
    solid_elements: Optional[List[Dict]] = None,
    link_elements: Optional[List[Dict]] = None,
    diaphragms: Optional[List[Dict]] = None,
    tension_only: Optional[List[str]] = None,
    compression_only: Optional[List[str]] = None,
    include_self_weight: bool = False,
    solver: str = "direct",
) -> Dict[str, Any]:
    """One-call JSON-in / JSON-out advanced analysis."""

    model = build_advanced_model_from_dicts(
        nodes=nodes,
        elements=elements,
        supports=supports,
        nodal_loads=nodal_loads,
        member_loads=member_loads,
        plate_elements=plate_elements,
        solid_elements=solid_elements,
        link_elements=link_elements,
        diaphragms=diaphragms,
        tension_only=tension_only,
        compression_only=compression_only,
        include_self_weight=include_self_weight,
    )

    dsm = AdvancedDirectStiffnessMethod(solver=solver)
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
