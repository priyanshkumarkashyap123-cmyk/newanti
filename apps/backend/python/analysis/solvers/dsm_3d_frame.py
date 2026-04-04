"""
Production-grade Direct Stiffness Method solver for 3D frames.

Unit conventions (unit-agnostic solver):
    Forces: kN
    Lengths: m
    Load intensities: kN/m or kN/m²
    Moments: kN·m
    Deflections: mm (converted externally)
    Angles: radians
"""

from __future__ import annotations

import logging
import math
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from numpy import float64, ndarray
from scipy.sparse import coo_matrix, csr_matrix
from scipy.sparse import linalg as sp_linalg

from analysis.solvers.dsm.types import (
    DOF_NAMES,
    DOFS_PER_NODE,
    Element3D,
    MemberLoad,
    Node3D,
    StructuralModel,
)
from .dsm_3d_frame_primitives import (
    FixedEndForces,
    TimoshenkoBeam3D,
    Transform3D,
    apply_releases_static_condensation,
)
from .dsm_3d_frame_types import (
    AnalysisResult,
    BoundaryConditions,
)
from .dsm_3d_frame_assembly import (
    SparseAssembler,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
#  IMPORTED EXTRACTED CLASSES
# ---------------------------------------------------------------------------
#
#  Classes SparseAssembler, BoundaryConditions, AnalysisResult are imported from:
#    - dsm_3d_frame_assembly.py  (SparseAssembler)
#    - dsm_3d_frame_types.py     (BoundaryConditions, AnalysisResult)
#
# ---------------------------------------------------------------------------
#  6. SOLVER + BACK-SUBSTITUTION
# ---------------------------------------------------------------------------


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
        """
        Assemble the global stiffness matrix and load vector from the model definition.

        Populates self._K (CSR matrix) and self._F (force vector) based on elements, loads, and self-weight.
        """
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
        """
        Apply boundary conditions using the penalty method.

        Transforms the stiffness matrix and load vector to enforce supports and prescribed DOFs.
        """
        if self._K is None:
            raise RuntimeError("Call assemble() first.")
        K_bc, F_bc = BoundaryConditions.apply_penalty(
            self._K, self._F, self._model, self._nmap,
        )
        self._K = K_bc
        self._F = F_bc

    def solve(self) -> ndarray:
        """
        Solve the linear system K * U = F and return the displacement vector U.

        Checks matrix conditioning and logs warnings for ill-conditioned systems.
        Raises RuntimeError if boundary conditions have not been applied.
        """
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
