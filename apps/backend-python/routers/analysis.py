"""
Structural Analysis Endpoints — Beam, Frame, Large-Frame, Nonlinear
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import asyncio
import traceback
import time

from logging_config import get_logger
from routers.schemas import (
    FrameNodeInput, FrameMemberInput, NodeLoadInput,
    FramePlateInput, MemberDistLoadInput,
)

logger = get_logger(__name__)

router = APIRouter(tags=["Analysis"])


# ── Request Models ──

class BeamLoadInput(BaseModel):
    type: str  # "point", "udl", "uvl"
    magnitude: float
    position: float
    end_position: Optional[float] = None
    end_magnitude: Optional[float] = None


class BeamAnalysisRequest(BaseModel):
    length: float
    loads: List[BeamLoadInput]
    E: Optional[float] = 200e6
    I: Optional[float] = 1e-4


class FrameAnalysisRequest(BaseModel):
    nodes: List[FrameNodeInput]
    members: List[FrameMemberInput]
    plates: Optional[List[FramePlateInput]] = []
    node_loads: Optional[List[NodeLoadInput]] = []
    distributed_loads: Optional[List[MemberDistLoadInput]] = []


class LargeFrameAnalysisRequest(BaseModel):
    """Request for large model analysis using sparse solvers"""
    nodes: List[FrameNodeInput]
    members: List[FrameMemberInput]
    node_loads: Optional[List[NodeLoadInput]] = []
    method: Optional[str] = "auto"  # "auto", "superlu", "cg", "gmres"
    backend: Optional[str] = "auto"  # "auto", "rust", "python"
    debug_compare: Optional[bool] = False
    debug_compare_tolerance: Optional[float] = 1e-2


class NonlinearAnalysisRequest(BaseModel):
    nodes: List[Dict] = Field(default_factory=list, max_length=100_000)
    members: List[Dict] = Field(default_factory=list, max_length=100_000)
    node_loads: List[Dict] = Field(default_factory=list, max_length=100_000)
    settings: Dict = Field(default_factory=lambda: {"method": "newton-raphson", "steps": 10})


# ── Endpoints ──

@router.post("/analyze/beam")
async def analyze_beam(request: BeamAnalysisRequest):
    """
    Analyze a simply supported beam with various loads.
    Returns hand calculation steps, 100 data points for SFD/BMD, max values.
    """
    try:
        from analysis.solver import (
            BeamSolver, BeamAnalysisInput, Load, LoadType, Support
        )

        loads = []
        for load in request.loads:
            load_type = {
                "point": LoadType.POINT,
                "udl": LoadType.UDL,
                "uvl": LoadType.UVL
            }.get(load.type.lower(), LoadType.POINT)

            loads.append(Load(
                type=load_type,
                magnitude=load.magnitude,
                position=load.position,
                end_position=load.end_position,
                end_magnitude=load.end_magnitude
            ))

        beam_input = BeamAnalysisInput(
            length=request.length,
            loads=loads,
            supports=[
                Support(position=0, type="pinned"),
                Support(position=request.length, type="roller")
            ],
            E=request.E or 200e6,
            I=request.I or 1e-4
        )

        solver = BeamSolver(beam_input)
        result = await asyncio.to_thread(solver.solve)

        return {
            "success": result.success,
            "result": {
                "max_moment": result.max_moment,
                "max_shear": result.max_shear,
                "max_deflection": result.max_deflection,
                "max_moment_location": result.max_moment_location,
                "max_shear_location": result.max_shear_location,
                "reactions": result.reactions
            },
            "steps": result.steps,
            "diagram": {
                "x_values": result.diagram.x_values,
                "shear_values": result.diagram.shear_values,
                "moment_values": result.diagram.moment_values,
                "deflection_values": result.diagram.deflection_values
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze/frame")
async def analyze_3d_frame(request: FrameAnalysisRequest):
    """
    Analyze a 3D frame structure using PyNite FEA.
    Returns node displacements, reactions, member forces at 100 points.
    """
    try:
        from analysis.fea_engine import analyze_frame

        logger.info(
            "FEA analysis request received",
            extra={"nodes": len(request.nodes), "members": len(request.members), "plates": len(request.plates)},
        )

        model_dict = {
            "nodes": [
                {"id": n.id, "x": n.x, "y": n.y, "z": n.z, "support": n.support or "none"}
                for n in request.nodes
            ],
            "members": [
                {
                    "id": m.id, "startNodeId": m.startNodeId, "endNodeId": m.endNodeId,
                    "E": m.E or 200e6, "G": m.G or 77e6, "Iy": m.Iy or 1e-4,
                    "Iz": m.Iz or 1e-4, "J": m.J or 1e-5, "A": m.A or 0.01
                }
                for m in request.members
            ],
            "plates": [
                {
                    "id": p.id, "node_ids": p.nodeIds, "thickness": p.thickness,
                    "E": p.E or 200e6, "nu": p.nu or 0.3, "pressure": p.pressure or 0.0
                }
                for p in (request.plates or [])
            ],
            "node_loads": [
                {
                    "nodeId": l.nodeId, "fx": l.fx or 0, "fy": l.fy or 0, "fz": l.fz or 0,
                    "mx": l.mx or 0, "my": l.my or 0, "mz": l.mz or 0
                }
                for l in (request.node_loads or [])
            ],
            "distributed_loads": [
                {
                    "memberId": l.memberId, "direction": l.direction or "Fy",
                    "w1": l.w1, "w2": l.w2 if l.w2 is not None else l.w1,
                    "startPos": l.x1 or 0, "endPos": l.x2 or 1,
                    "isRatio": l.isRatio if l.isRatio is not None else True
                }
                for l in (request.distributed_loads or [])
            ]
        }

        logger.info("FEA running analysis")
        result = await asyncio.to_thread(analyze_frame, model_dict)

        if not result['success']:
            error_msg = result.get('error', 'Analysis failed')
            logger.warning("FEA analysis returned error", extra={"error": error_msg})
            raise HTTPException(status_code=400, detail=error_msg)

        logger.info("FEA analysis successful", extra={"max_moment": result.get('max_moment', 0)})
        return result

    except ImportError as e:
        logger.error("FEA ImportError: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"PyNiteFEA import error: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("FEA Exception: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")


@router.post("/analyze/large-frame")
async def analyze_large_frame(request: LargeFrameAnalysisRequest):
    """
    High-performance analysis for large structural models (5k-100k+ nodes).
    Uses SciPy sparse matrix solvers.
    """
    start_time = time.perf_counter()

    try:
        n_nodes = len(request.nodes) if request.nodes else 0
        n_members = len(request.members) if request.members else 0
        n_loads = len(request.node_loads) if request.node_loads else 0

        logger.info("Sparse solver request", extra={"nodes": n_nodes, "members": n_members, "loads": n_loads})

        if n_nodes == 0:
            raise HTTPException(status_code=400, detail="No nodes provided in request")
        if n_members == 0:
            raise HTTPException(status_code=400, detail="No members provided in request")

        MAX_NODES = 100000
        if n_nodes > MAX_NODES:
            raise HTTPException(
                status_code=400,
                detail=f"Model too large: {n_nodes} nodes exceeds limit of {MAX_NODES}"
            )

        n_dof = n_nodes * 6
        logger.info("Sparse solver DOF", extra={"n_dof": n_dof})

        from analysis.sparse_solver import analyze_large_frame as solve_large
        from analysis.rust_interop import analyze_with_best_backend

        nodes = [
            {"id": n.id, "x": n.x, "y": n.y, "z": n.z, "support": n.support or "none"}
            for n in request.nodes
        ]
        members = [
            {
                "id": m.id, "start_node_id": m.startNodeId, "end_node_id": m.endNodeId,
                "E": m.E or 200e9, "G": m.G or 77e9, "Iy": m.Iy or 1e-4,
                "Iz": m.Iz or 1e-4, "J": m.J or 1e-5, "A": m.A or 0.01
            }
            for m in request.members
        ]
        loads = [
            {
                "node_id": l.nodeId, "fx": l.fx or 0, "fy": l.fy or 0, "fz": l.fz or 0,
                "mx": l.mx or 0, "my": l.my or 0, "mz": l.mz or 0
            }
            for l in (request.node_loads or [])
        ]

        fixed_dofs = []
        node_map = {n.id: i for i, n in enumerate(request.nodes)}
        for n in request.nodes:
            if n.support and n.support.lower() != "none":
                base_dof = node_map[n.id] * 6
                support = n.support.lower()
                if support == "fixed":
                    fixed_dofs.extend(range(base_dof, base_dof + 6))
                elif support in ("pinned", "pin"):
                    fixed_dofs.extend([base_dof, base_dof + 1, base_dof + 2])
                elif support == "roller":
                    fixed_dofs.append(base_dof + 1)

        supports_for_rust = []
        for n in request.nodes:
            if not n.support or n.support.lower() == "none":
                continue

            support = n.support.lower()
            support_obj = {
                "nodeId": n.id,
                "fx": False,
                "fy": False,
                "fz": False,
                "mx": False,
                "my": False,
                "mz": False,
            }

            if support == "fixed":
                support_obj.update({"fx": True, "fy": True, "fz": True, "mx": True, "my": True, "mz": True})
            elif support in ("pinned", "pin"):
                support_obj.update({"fx": True, "fy": True, "fz": True})
            elif support == "roller":
                support_obj.update({"fy": True})

            supports_for_rust.append(support_obj)

        rust_model = {
            "nodes": [
                {"id": n.id, "x": n.x, "y": n.y, "z": n.z}
                for n in request.nodes
            ],
            "members": [
                {
                    "id": m.id,
                    "startNodeId": m.startNodeId,
                    "endNodeId": m.endNodeId,
                    "E": m.E or 200e9,
                    "A": m.A or 0.01,
                    # Rust solver currently consumes a single I value in AnalysisInput
                    "I": m.Iy or m.Iz or 1e-4,
                    "J": m.J or 1e-5,
                }
                for m in request.members
            ],
            "supports": supports_for_rust,
            "loads": [
                {
                    "nodeId": l.nodeId,
                    "fx": l.fx or 0,
                    "fy": l.fy or 0,
                    "fz": l.fz or 0,
                    "mx": l.mx or 0,
                    "my": l.my or 0,
                    "mz": l.mz or 0,
                }
                for l in (request.node_loads or [])
            ],
        }

        forced_backend = (request.backend or "auto").lower()
        if forced_backend not in {"auto", "rust", "python"}:
            raise HTTPException(status_code=400, detail="backend must be one of: auto, rust, python")

        async def solve_via_python() -> Dict[str, Any]:
            py_result = await asyncio.to_thread(
                solve_large,
                nodes=nodes, members=members, loads=loads,
                fixed_dofs=fixed_dofs, method=request.method or "auto"
            )

            if not py_result.get('success'):
                raise HTTPException(status_code=400, detail=py_result.get('error', 'Sparse solver failed'))

            return {
                "backend": "python",
                "displacements": py_result.get('displacements', {}),
                "reactions": py_result.get('reactions', {}),
                "member_forces": py_result.get('member_forces', {}),
                "solve_time_ms": py_result.get('solve_time_ms', 0),
                "stats": {
                    "method": py_result.get('method'),
                    "iterations": py_result.get('iterations', 0),
                    "residual_norm": py_result.get('residual_norm', 0),
                    "max_displacement_mm": py_result.get('max_displacement_mm', 0),
                },
                "raw": py_result,
            }

        async def solve_via_rust() -> Dict[str, Any]:
            rust_result = await analyze_with_best_backend(
                rust_model,
                analysis_type="static",
                force_backend=forced_backend if forced_backend in {"rust", "python"} else None,
            )

            if not rust_result.success:
                raise RuntimeError(rust_result.error or "Rust backend analysis failed")

            rust_displacements = {
                d.get("nodeId"): {
                    "dx": d.get("dx", 0.0),
                    "dy": d.get("dy", 0.0),
                    "dz": d.get("dz", 0.0),
                    "rx": d.get("rx", 0.0),
                    "ry": d.get("ry", 0.0),
                    "rz": d.get("rz", 0.0),
                }
                for d in (rust_result.displacements or [])
                if isinstance(d, dict) and d.get("nodeId")
            }

            rust_reactions = {
                r.get("nodeId"): {
                    "fx": r.get("fx", 0.0),
                    "fy": r.get("fy", 0.0),
                    "fz": r.get("fz", 0.0),
                    "mx": r.get("mx", 0.0),
                    "my": r.get("my", 0.0),
                    "mz": r.get("mz", 0.0),
                }
                for r in (rust_result.reactions or [])
                if isinstance(r, dict) and r.get("nodeId")
            }

            return {
                "backend": rust_result.backend_used,
                "displacements": rust_displacements,
                "reactions": rust_reactions,
                "member_forces": rust_result.member_forces or [],
                "solve_time_ms": rust_result.solve_time_ms,
                "stats": {
                    "rust_metadata": rust_result.metadata,
                },
                "raw": rust_result,
            }

        async def compare_solutions(py: Dict[str, Any], rs: Dict[str, Any]) -> Dict[str, Any]:
            py_disp = py.get("displacements", {})
            rs_disp = rs.get("displacements", {})
            common_nodes = set(py_disp.keys()) & set(rs_disp.keys())
            max_abs_delta_mm = 0.0

            for node_id in common_nodes:
                p = py_disp.get(node_id, {})
                r = rs_disp.get(node_id, {})
                for key in ("dx", "dy", "dz"):
                    delta_mm = abs((p.get(key, 0.0) - r.get(key, 0.0)) * 1000.0)
                    if delta_mm > max_abs_delta_mm:
                        max_abs_delta_mm = delta_mm

            tolerance_mm = max(request.debug_compare_tolerance or 1e-2, 0.0)
            within_tolerance = max_abs_delta_mm <= tolerance_mm
            return {
                "enabled": True,
                "common_nodes": len(common_nodes),
                "max_abs_displacement_delta_mm": max_abs_delta_mm,
                "tolerance_mm": tolerance_mm,
                "within_tolerance": within_tolerance,
            }

        chosen_backend = "python"
        selected_result: Dict[str, Any]
        debug_comparison: Optional[Dict[str, Any]] = None

        if request.debug_compare:
            py_task = solve_via_python()
            rust_task = solve_via_rust()
            py_out, rust_out = await asyncio.gather(py_task, rust_task, return_exceptions=True)

            if isinstance(py_out, Exception):
                logger.error("Python compare run failed", extra={"error": str(py_out)})
                raise HTTPException(status_code=500, detail=f"Python compare run failed: {str(py_out)}")

            if isinstance(rust_out, Exception):
                logger.warning("Rust compare run failed; using Python", extra={"error": str(rust_out)})
                selected_result = py_out
                chosen_backend = "python"
                debug_comparison = {
                    "enabled": True,
                    "rust_error": str(rust_out),
                    "fallback_backend": "python",
                }
            else:
                selected_result = rust_out
                chosen_backend = rust_out.get("backend", "rust")
                debug_comparison = await compare_solutions(py_out, rust_out)
        else:
            try:
                if forced_backend == "python":
                    selected_result = await solve_via_python()
                else:
                    selected_result = await solve_via_rust()
            except Exception as rust_error:
                if forced_backend == "rust":
                    logger.error("Forced rust backend failed", extra={"error": str(rust_error)})
                    raise HTTPException(status_code=500, detail=f"Rust backend failed: {str(rust_error)}")
                logger.warning("Rust path failed; falling back to Python", extra={"error": str(rust_error)})
                selected_result = await solve_via_python()

            chosen_backend = selected_result.get("backend", "python")

        total_time = (time.perf_counter() - start_time) * 1000

        logger.info("Large-frame analysis complete", extra={
            "solve_ms": selected_result.get('solve_time_ms', 0),
            "total_ms": total_time,
            "backend": chosen_backend,
            "nodes": n_nodes,
            "members": n_members,
        })

        return {
            "success": True,
            "displacements": selected_result.get('displacements', {}),
            "reactions": selected_result.get('reactions', {}),
            "member_forces": selected_result.get('member_forces', {}),
            "stats": {
                "solve_time_ms": selected_result.get('solve_time_ms', 0),
                "total_time_ms": total_time,
                "method": (selected_result.get('stats') or {}).get('method'),
                "iterations": (selected_result.get('stats') or {}).get('iterations', 0),
                "residual_norm": (selected_result.get('stats') or {}).get('residual_norm', 0),
                "n_nodes": n_nodes, "n_members": n_members, "n_dof": n_dof,
                "max_displacement_mm": (selected_result.get('stats') or {}).get('max_displacement_mm', 0),
                "backend_used": chosen_backend,
                "debug_comparison": debug_comparison,
            },
        }

    except ImportError as e:
        logger.error("Sparse solver ImportError: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Sparse solver import error: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Sparse solver exception: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Large model analysis error: {str(e)}")


@router.post("/analysis/nonlinear/run")
async def run_nonlinear_analysis(request: NonlinearAnalysisRequest):
    """
    Run non-linear structural analysis (Material & Geometric).
    """
    try:
        from analysis.optimized_solver import OptimizedFrameSolver

        model = {
            'nodes': request.nodes,
            'members': request.members,
            'node_loads': request.node_loads
        }

        solver = OptimizedFrameSolver(use_iterative=True)
        result = await asyncio.to_thread(solver.solve, model)
        return result

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
