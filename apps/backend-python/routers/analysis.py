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

        result = await asyncio.to_thread(
            solve_large,
            nodes=nodes, members=members, loads=loads,
            fixed_dofs=fixed_dofs, method=request.method or "auto"
        )

        total_time = (time.perf_counter() - start_time) * 1000

        if not result['success']:
            logger.warning("Sparse solver failed", extra={"error": result.get('error')})
            raise HTTPException(status_code=400, detail=result.get('error', 'Sparse solver failed'))

        logger.info("Sparse solver complete", extra={
            "solve_ms": result.get('solve_time_ms', 0), "total_ms": total_time,
            "method": result.get('method'), "max_disp_mm": result.get('max_displacement_mm', 0)
        })

        return {
            "success": True,
            "displacements": result['displacements'],
            "reactions": result.get('reactions', {}),
            "member_forces": result.get('member_forces', {}),
            "stats": {
                "solve_time_ms": result.get('solve_time_ms', 0),
                "total_time_ms": total_time,
                "method": result.get('method'),
                "iterations": result.get('iterations', 0),
                "residual_norm": result.get('residual_norm', 0),
                "n_nodes": n_nodes, "n_members": n_members, "n_dof": n_dof,
                "max_displacement_mm": result.get('max_displacement_mm', 0)
            }
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
