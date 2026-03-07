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
    PlateElementInput, SolidElementInput, LinkElementInput, DiaphragmInput,
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
    backend: Optional[str] = "python"  # "python", "rust", "auto"
    debug_compare: Optional[bool] = False
    debug_compare_tolerance: Optional[float] = 1e-2


class FrameAnalysisRequest(BaseModel):
    nodes: List[FrameNodeInput]
    members: List[FrameMemberInput]
    plates: Optional[List[FramePlateInput]] = []
    node_loads: Optional[List[NodeLoadInput]] = []
    distributed_loads: Optional[List[MemberDistLoadInput]] = []
    backend: Optional[str] = "python"  # "python", "rust", "auto"
    debug_compare: Optional[bool] = False
    debug_compare_tolerance: Optional[float] = 1e-2


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
    backend: Optional[str] = "python"  # "python", "rust", "auto"
    debug_compare: Optional[bool] = False
    debug_compare_tolerance: Optional[float] = 1e-2


class PDeltaAnalysisRequest(BaseModel):
    """P-Delta (geometric nonlinear) analysis request"""
    nodes: List[FrameNodeInput]
    members: List[FrameMemberInput]
    node_loads: Optional[List[NodeLoadInput]] = []
    max_iterations: Optional[int] = 10
    tolerance: Optional[float] = 1e-6
    backend: Optional[str] = "python"  # "python", "rust", "auto"
    debug_compare: Optional[bool] = False
    debug_compare_tolerance: Optional[float] = 1e-4


class BucklingAnalysisRequest(BaseModel):
    """Buckling (stability) analysis request"""
    nodes: List[FrameNodeInput]
    members: List[FrameMemberInput]
    node_loads: Optional[List[NodeLoadInput]] = []
    num_modes: Optional[int] = 5  # Number of buckling modes to extract
    backend: Optional[str] = "rust"  # "python", "rust", "auto"
    debug_compare: Optional[bool] = False
    debug_compare_tolerance: Optional[float] = 1e-3


class AdvancedAnalysisRequest(BaseModel):
    """
    Advanced FEM analysis supporting plates, solids, links, diaphragms,
    and tension/compression-only members.
    """
    nodes: List[FrameNodeInput]
    members: Optional[List[FrameMemberInput]] = []
    node_loads: Optional[List[NodeLoadInput]] = []
    distributed_loads: Optional[List[MemberDistLoadInput]] = []

    # Advanced element types
    plate_elements: Optional[List[PlateElementInput]] = []
    solid_elements: Optional[List[SolidElementInput]] = []
    link_elements: Optional[List[LinkElementInput]] = []
    diaphragms: Optional[List[DiaphragmInput]] = []

    # Tension/compression-only member IDs
    tension_only: Optional[List[str]] = []
    compression_only: Optional[List[str]] = []

    include_self_weight: Optional[bool] = False
    solver: Optional[str] = "direct"  # "direct" | "iterative"


# ── Endpoints ──

@router.post("/analyze/beam")
async def analyze_beam(request: BeamAnalysisRequest):
    """
    Analyze a simply supported beam with various loads.
    
    Migration-ready mode:
    - Python remains authoritative (hand-calc steps, SFD/BMD diagrams).
    - Rust can run in parallel debug_compare mode for validation.
    - Returns max moment, shear, deflection, reactions, engineering steps, diagrams.
    """
    start_time = time.perf_counter()
    
    try:
        from analysis.solver import (
            BeamSolver, BeamAnalysisInput, Load, LoadType, Support
        )
        from analysis.rust_interop import analyze_with_best_backend
        
        # Validate input
        if request.length <= 0:
            raise HTTPException(status_code=400, detail="Beam length must be positive")
        if not request.loads:
            raise HTTPException(status_code=400, detail="At least one load required")
        
        # Determine backend
        forced_backend = (request.backend or "python").lower()
        if forced_backend not in {"auto", "rust", "python"}:
            raise HTTPException(status_code=400, detail="backend must be one of: auto, rust, python")
        
        logger.info(
            "Beam analysis request",
            extra={"length": request.length, "n_loads": len(request.loads), "backend": forced_backend}
        )
        
        # ── Python Solver (Authoritative) ──
        async def solve_via_python() -> Dict[str, Any]:
            loads_py = []
            for load in request.loads:
                load_type = {
                    "point": LoadType.POINT,
                    "udl": LoadType.UDL,
                    "uvl": LoadType.UVL
                }.get(load.type.lower(), LoadType.POINT)
                
                loads_py.append(Load(
                    type=load_type,
                    magnitude=load.magnitude,
                    position=load.position,
                    end_position=load.end_position,
                    end_magnitude=load.end_magnitude
                ))
            
            beam_input = BeamAnalysisInput(
                length=request.length,
                loads=loads_py,
                supports=[
                    Support(position=0, type="pinned"),
                    Support(position=request.length, type="roller")
                ],
                E=request.E or 200e6,
                I=request.I or 1e-4
            )
            
            solver = BeamSolver(beam_input)
            result = await asyncio.to_thread(solver.solve)
            
            if not result.success:
                raise HTTPException(status_code=400, detail="Beam solver failed")
            
            return {
                "backend": "python",
                "max_moment": result.max_moment,
                "max_shear": result.max_shear,
                "max_deflection": result.max_deflection,
                "max_moment_location": result.max_moment_location,
                "max_shear_location": result.max_shear_location,
                "reactions": result.reactions,
                "steps": result.steps,
                "diagram": {
                    "x_values": result.diagram.x_values,
                    "shear_values": result.diagram.shear_values,
                    "moment_values": result.diagram.moment_values,
                    "deflection_values": result.diagram.deflection_values
                },
                "solve_time_ms": (time.perf_counter() - start_time) * 1000
            }
        
        # ── Rust Solver (Optional debug mode) ──
        async def solve_via_rust() -> Dict[str, Any]:
            """
            Model a simply-supported beam as a 2-node 1D frame structure.
            Node 0: left support (pinned), Node 1: right support (roller)
            
            Limitation: Rust solver currently doesn't support distributed loads,
            so we can only compare point loads. UDL/UVL loads are skipped.
            """
            
            # Check if all loads are compatible with Rust
            rust_compatible_loads = [
                l for l in request.loads 
                if l.type.lower() == "point"
            ]
            
            if len(rust_compatible_loads) < len(request.loads):
                skipped = len(request.loads) - len(rust_compatible_loads)
                logger.warning(
                    f"Skipping Rust comparison: {skipped} non-point load(s) incompatible with Rust solver"
                )
                raise RuntimeError(f"Beam has {skipped} UDL/UVL loads; Rust solver only supports point loads")
            
            # Create simple 2-node frame model
            rust_model = {
                "nodes": [
                    {"id": 0, "x": 0.0, "y": 0.0, "z": 0.0},
                    {"id": 1, "x": request.length, "y": 0.0, "z": 0.0}
                ],
                "members": [
                    {
                        "id": 1,
                        "startNodeId": 0,
                        "endNodeId": 1,
                        "E": request.E or 200e9,  # Convert to Pa (note: Python uses lower values)
                        "A": 0.01,  # Dummy cross-section
                        "I": request.I or 1e-4,
                        "J": 1e-5
                    }
                ],
                "supports": [
                    {"nodeId": 0, "fx": True, "fy": True, "fz": False, "mx": False, "my": True, "mz": False},  # pinned
                    {"nodeId": 1, "fx": False, "fy": True, "fz": False, "mx": False, "my": False, "mz": False}  # roller
                ],
                "loads": [
                    {
                        "nodeId": 1 if l.position >= request.length * 0.99 else 0,  # Approximate node if near support
                        "fx": 0.0,
                        "fy": -abs(l.magnitude),  # Downward load
                        "fz": 0.0,
                        "mx": 0.0,
                        "my": 0.0,
                        "mz": 0.0
                    }
                    for l in rust_compatible_loads
                ]
            }
            
            rust_result = await analyze_with_best_backend(
                rust_model,
                analysis_type="static",
                force_backend="rust"
            )
            
            if not rust_result.success:
                raise RuntimeError(rust_result.error or "Rust backend failed")
            
            # Extract key results from Rust
            displacements = {
                d.get("nodeId"): d.get("dy", 0.0) * 1000.0  # Convert to mm
                for d in (rust_result.displacements or [])
                if isinstance(d, dict)
            }
            
            reactions = {
                r.get("nodeId"): {"fy": r.get("fy", 0.0), "my": r.get("my", 0.0)}
                for r in (rust_result.reactions or [])
                if isinstance(r, dict)
            }
            
            return {
                "backend": "rust",
                "max_deflection": min(displacements.values()) if displacements else 0.0,  # Most negative
                "reactions": reactions,
                "displacements": displacements,
                "solve_time_ms": rust_result.solve_time_ms if hasattr(rust_result, 'solve_time_ms') else 0
            }
        
        # ── Execution Logic ──
        if request.debug_compare:
            # Run both solvers in parallel
            py_task = solve_via_python()
            rust_task = solve_via_rust()
            
            py_result, rust_result = await asyncio.gather(py_task, rust_task, return_exceptions=True)
            
            # Check for exceptions
            py_exception = None if not isinstance(py_result, Exception) else py_result
            rust_exception = None if not isinstance(rust_result, Exception) else rust_result
            
            if py_exception:
                logger.error(f"Python solver exception: {py_exception}")
                raise py_exception
            
            if rust_exception:
                logger.warning(f"Rust comparison failed (non-fatal): {rust_exception}")
                rust_result = None
            
            # Return Python result with comparison metadata
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            
            py_data = {
                "success": True,
                "result": {
                    "max_moment": py_result["max_moment"],
                    "max_shear": py_result["max_shear"],
                    "max_deflection": py_result["max_deflection"],
                    "max_moment_location": py_result["max_moment_location"],
                    "max_shear_location": py_result["max_shear_location"],
                    "reactions": py_result["reactions"]
                },
                "steps": py_result["steps"],
                "diagram": py_result["diagram"],
                "stats": {
                    "backend_used": "python",
                    "total_solve_time_ms": elapsed_ms,
                    "python_solve_time_ms": py_result.get("solve_time_ms", 0)
                }
            }
            
            # Add Rust comparison if successful
            if rust_result is not None:
                deflection_delta_mm = abs(
                    (py_result["max_deflection"] - rust_result.get("max_deflection", 0.0))
                )
                
                py_data["stats"]["debug_comparison"] = {
                    "enabled": True,
                    "rust_available": True,
                    "max_deflection_delta_mm": deflection_delta_mm,
                    "within_tolerance": deflection_delta_mm <= (request.debug_compare_tolerance or 1e-2),
                    "rust_solve_time_ms": rust_result.get("solve_time_ms", 0)
                }
            else:
                py_data["stats"]["debug_comparison"] = {
                    "enabled": True,
                    "rust_available": False,
                    "reason": "Rust solver incompatible (UDL/UVL loads, or other limitation)"
                }
            
            return py_data
        
        else:
            # Default: Python authoritative (safe path)
            if forced_backend == "rust":
                try:
                    py_result = await solve_via_python()
                    logger.info("Beam analysis completed via Python (fallback from Rust request)")
                    return {
                        "success": True,
                        "result": {
                            "max_moment": py_result["max_moment"],
                            "max_shear": py_result["max_shear"],
                            "max_deflection": py_result["max_deflection"],
                            "max_moment_location": py_result["max_moment_location"],
                            "max_shear_location": py_result["max_shear_location"],
                            "reactions": py_result["reactions"]
                        },
                        "steps": py_result["steps"],
                        "diagram": py_result["diagram"],
                        "stats": {
                            "backend_used": "python",
                            "total_solve_time_ms": (time.perf_counter() - start_time) * 1000,
                            "note": "Rust not available for beam analysis; using Python"
                        }
                    }
                except Exception as e:
                    logger.error(f"Rust-requested beam analysis failed: {e}")
                    raise
            else:
                # forced_backend is "python" or "auto"
                py_result = await solve_via_python()
                return {
                    "success": True,
                    "result": {
                        "max_moment": py_result["max_moment"],
                        "max_shear": py_result["max_shear"],
                        "max_deflection": py_result["max_deflection"],
                        "max_moment_location": py_result["max_moment_location"],
                        "max_shear_location": py_result["max_shear_location"],
                        "reactions": py_result["reactions"]
                    },
                    "steps": py_result["steps"],
                    "diagram": py_result["diagram"],
                    "stats": {
                        "backend_used": "python",
                        "total_solve_time_ms": (time.perf_counter() - start_time) * 1000
                    }
                }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Beam analysis error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Beam analysis failed: {str(e)}")


@router.post("/analyze/frame")
async def analyze_3d_frame(request: FrameAnalysisRequest):
    """
    Analyze a 3D frame structure using PyNite FEA.

    Migration-safe mode:
    - Python remains authoritative (rich member diagrams, plate/distributed-load support).
    - Rust can run in parallel debug compare mode for validation.
    - Rust-only execution is available for compatible requests.
    """
    try:
        from analysis.fea_engine import analyze_frame
        from analysis.rust_interop import analyze_with_best_backend

        logger.info(
            "FEA analysis request received",
            extra={"nodes": len(request.nodes), "members": len(request.members), "plates": len(request.plates)},
        )

        forced_backend = (request.backend or "python").lower()
        if forced_backend not in {"auto", "rust", "python"}:
            raise HTTPException(status_code=400, detail="backend must be one of: auto, rust, python")

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

        rust_compatible = len(request.plates or []) == 0 and len(request.distributed_loads or []) == 0
        rust_incompatibility_reason = None
        if not rust_compatible:
            rust_incompatibility_reason = "Rust frame path currently supports nodes/members/node_loads only (no plates/distributed_loads)"

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
            "nodes": [{"id": n.id, "x": n.x, "y": n.y, "z": n.z} for n in request.nodes],
            "members": [
                {
                    "id": m.id,
                    "startNodeId": m.startNodeId,
                    "endNodeId": m.endNodeId,
                    "E": m.E or 200e6,
                    "A": m.A or 0.01,
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

        def build_node_disp_map_from_python(py_result: Dict[str, Any]) -> Dict[str, Dict[str, float]]:
            disp_map = {}
            for node in py_result.get("nodes", []):
                node_id = node.get("nodeId")
                disp = node.get("displacement", {})
                if node_id:
                    disp_map[node_id] = {
                        "dx": float(disp.get("dx", 0.0)),
                        "dy": float(disp.get("dy", 0.0)),
                        "dz": float(disp.get("dz", 0.0)),
                    }
            return disp_map

        def build_node_disp_map_from_rust_nodes(rust_nodes: List[Dict[str, Any]]) -> Dict[str, Dict[str, float]]:
            disp_map = {}
            for node in rust_nodes:
                node_id = node.get("nodeId")
                disp = node.get("displacement", {})
                if node_id:
                    disp_map[node_id] = {
                        "dx": float(disp.get("dx", 0.0)),
                        "dy": float(disp.get("dy", 0.0)),
                        "dz": float(disp.get("dz", 0.0)),
                    }
            return disp_map

        async def solve_via_python() -> Dict[str, Any]:
            result = await asyncio.to_thread(analyze_frame, model_dict)
            if not result.get("success"):
                error_msg = result.get("error", "Analysis failed")
                raise HTTPException(status_code=400, detail=error_msg)

            result.setdefault("stats", {})
            result["stats"]["backend_used"] = "python"
            return result

        async def solve_via_rust() -> Dict[str, Any]:
            if not rust_compatible:
                raise RuntimeError(rust_incompatibility_reason or "Request is not Rust-compatible")

            rust_result = await analyze_with_best_backend(
                rust_model,
                analysis_type="static",
                force_backend="rust",
            )
            if not rust_result.success:
                raise RuntimeError(rust_result.error or "Rust backend analysis failed")

            rust_nodes = []
            for d in (rust_result.displacements or []):
                if not isinstance(d, dict) or not d.get("nodeId"):
                    continue
                rust_nodes.append({
                    "nodeId": d.get("nodeId"),
                    "displacement": {
                        # Convert to mm for consistency with Python analyze_frame output.
                        "dx": float(d.get("dx", 0.0)) * 1000.0,
                        "dy": float(d.get("dy", 0.0)) * 1000.0,
                        "dz": float(d.get("dz", 0.0)) * 1000.0,
                        "rx": float(d.get("rx", 0.0)),
                        "ry": float(d.get("ry", 0.0)),
                        "rz": float(d.get("rz", 0.0)),
                    },
                    "reaction": {},
                })

            reactions_map = {
                r.get("nodeId"): r
                for r in (rust_result.reactions or [])
                if isinstance(r, dict) and r.get("nodeId")
            }
            for n in rust_nodes:
                reaction = reactions_map.get(n.get("nodeId"), {})
                n["reaction"] = {
                    "fx": float(reaction.get("fx", 0.0)),
                    "fy": float(reaction.get("fy", 0.0)),
                    "fz": float(reaction.get("fz", 0.0)),
                    "mx": float(reaction.get("mx", 0.0)),
                    "my": float(reaction.get("my", 0.0)),
                    "mz": float(reaction.get("mz", 0.0)),
                }

            max_disp_mm = 0.0
            for n in rust_nodes:
                d = n.get("displacement", {})
                node_max = max(abs(float(d.get("dx", 0.0))), abs(float(d.get("dy", 0.0))), abs(float(d.get("dz", 0.0))))
                max_disp_mm = max(max_disp_mm, node_max)

            return {
                "success": True,
                "max_displacement": max_disp_mm,
                "max_moment": 0.0,
                "max_shear": 0.0,
                "nodes": rust_nodes,
                "members": [],
                "stats": {
                    "backend_used": rust_result.backend_used,
                    "solve_time_ms": rust_result.solve_time_ms,
                    "rust_metadata": rust_result.metadata,
                    "member_diagrams_unavailable": True,
                },
            }

        async def compare_solutions(py: Dict[str, Any], rs: Dict[str, Any]) -> Dict[str, Any]:
            py_disp = build_node_disp_map_from_python(py)
            rs_disp = build_node_disp_map_from_rust_nodes(rs.get("nodes", []))
            common_nodes = set(py_disp.keys()) & set(rs_disp.keys())
            max_abs_delta_mm = 0.0

            for node_id in common_nodes:
                p = py_disp.get(node_id, {})
                r = rs_disp.get(node_id, {})
                for key in ("dx", "dy", "dz"):
                    delta_mm = abs(float(p.get(key, 0.0)) - float(r.get(key, 0.0)))
                    if delta_mm > max_abs_delta_mm:
                        max_abs_delta_mm = delta_mm

            tolerance_mm = max(request.debug_compare_tolerance or 1e-2, 0.0)
            return {
                "enabled": True,
                "common_nodes": len(common_nodes),
                "max_abs_displacement_delta_mm": max_abs_delta_mm,
                "tolerance_mm": tolerance_mm,
                "within_tolerance": max_abs_delta_mm <= tolerance_mm,
            }

        selected_result: Dict[str, Any]
        debug_comparison: Optional[Dict[str, Any]] = None

        # Rust-only mode (explicit migration test)
        if forced_backend == "rust":
            if request.debug_compare:
                py_task = solve_via_python()
                rust_task = solve_via_rust()
                py_out, rust_out = await asyncio.gather(py_task, rust_task, return_exceptions=True)

                if isinstance(rust_out, Exception):
                    logger.error("Forced Rust backend failed", extra={"error": str(rust_out)})
                    raise HTTPException(status_code=500, detail=f"Rust backend failed: {str(rust_out)}")

                selected_result = rust_out
                if isinstance(py_out, Exception):
                    debug_comparison = {
                        "enabled": True,
                        "python_error": str(py_out),
                    }
                else:
                    debug_comparison = await compare_solutions(py_out, rust_out)
            else:
                selected_result = await solve_via_rust()

        # Python-authoritative mode (default & safe)
        else:
            if request.debug_compare:
                if rust_compatible:
                    py_task = solve_via_python()
                    rust_task = solve_via_rust()
                    py_out, rust_out = await asyncio.gather(py_task, rust_task, return_exceptions=True)

                    if isinstance(py_out, Exception):
                        raise py_out

                    selected_result = py_out
                    if isinstance(rust_out, Exception):
                        debug_comparison = {
                            "enabled": True,
                            "rust_error": str(rust_out),
                            "fallback_backend": "python",
                        }
                    else:
                        debug_comparison = await compare_solutions(py_out, rust_out)
                else:
                    selected_result = await solve_via_python()
                    debug_comparison = {
                        "enabled": True,
                        "skipped": True,
                        "reason": rust_incompatibility_reason,
                    }
            else:
                selected_result = await solve_via_python()

        selected_result.setdefault("stats", {})
        selected_result["stats"]["debug_comparison"] = debug_comparison

        logger.info(
            "FEA analysis successful",
            extra={
                "max_moment": selected_result.get("max_moment", 0),
                "backend": (selected_result.get("stats") or {}).get("backend_used", "python"),
                "debug_compare": bool(request.debug_compare),
            },
        )
        return selected_result

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
    Run nonlinear structural analysis (material & geometric).
    
    Migration-ready mode:
    - Python remains authoritative (iterative solver, Newton-Raphson).
    - Rust can run in parallel debug_compare mode.
    - Returns converged displacements, reactions, member forces, iteration count.
    """
    start_time = time.perf_counter()
    
    try:
        from analysis.optimized_solver import OptimizedFrameSolver
        from analysis.rust_interop import analyze_with_best_backend
        
        forced_backend = (request.backend or "python").lower()
        if forced_backend not in {"auto", "rust", "python"}:
            raise HTTPException(status_code=400, detail="backend must be one of: auto, rust, python")
        
        logger.info(
            "Nonlinear analysis request",
            extra={"n_nodes": len(request.nodes), "n_members": len(request.members), "backend": forced_backend}
        )
        
        # ── Python Solver (Authoritative) ──
        async def solve_nonlinear_python() -> Dict[str, Any]:
            model = {
                'nodes': request.nodes,
                'members': request.members,
                'node_loads': request.node_loads
            }
            
            solver = OptimizedFrameSolver(use_iterative=True)
            result = await asyncio.to_thread(solver.solve, model)
            
            if not result.get('success'):
                raise HTTPException(status_code=400, detail=result.get('error', 'Nonlinear solver failed'))
            
            return {
                'backend': 'python',
                'converged': result.get('converged', True),
                'iterations': result.get('iterations', 0),
                'displacements': result.get('displacements', {}),
                'reactions': result.get('reactions', {}),
                'member_forces': result.get('member_forces', {}),
                'solve_time_ms': (time.perf_counter() - start_time) * 1000,
                'raw_result': result
            }
        
        # ── Rust Solver (Optional debug mode) ──
        async def solve_nonlinear_rust() -> Dict[str, Any]:
            """
            Run nonlinear analysis via Rust backend.
            Note: Rust nonlinear solver has limitations; may fallback to linear.
            """
            rust_model = {
                "nodes": [
                    {"id": str(n.get('id', i)), "x": n.get('x', 0), "y": n.get('y', 0), "z": n.get('z', 0)}
                    for i, n in enumerate(request.nodes)
                ],
                "members": [
                    {
                        "id": str(m.get('id', i)),
                        "startNodeId": str(m.get('start_node_id', m.get('startNodeId', 0))),
                        "endNodeId": str(m.get('end_node_id', m.get('endNodeId', 1))),
                        "E": m.get('E', 200e9),
                        "A": m.get('A', 0.01),
                        "I": m.get('I', m.get('Iy', 1e-4)),
                        "J": m.get('J', 1e-5)
                    }
                    for i, m in enumerate(request.members)
                ],
                "supports": [],  # Would need to extract from nodes
                "loads": [
                    {
                        "nodeId": str(l.get('node_id', l.get('nodeId', 0))),
                        "fx": l.get('fx', 0),
                        "fy": l.get('fy', 0),
                        "fz": l.get('fz', 0),
                        "mx": l.get('mx', 0),
                        "my": l.get('my', 0),
                        "mz": l.get('mz', 0)
                    }
                    for l in (request.node_loads or [])
                ]
            }
            
            rust_result = await analyze_with_best_backend(
                rust_model,
                analysis_type="nonlinear",
                force_backend="rust"
            )
            
            if not rust_result.success:
                raise RuntimeError(rust_result.error or "Rust nonlinear solver failed")
            
            return {
                'backend': 'rust',
                'displacements': {d.get('nodeId'): d.get('dy', 0.0) for d in (rust_result.displacements or [])},
                'solve_time_ms': (time.perf_counter() - start_time) * 1000
            }
        
        # ── Execution logic ──
        if request.debug_compare:
            py_result, rust_result = await asyncio.gather(
                solve_nonlinear_python(),
                solve_nonlinear_rust(),
                return_exceptions=True
            )
            
            py_exception = None if not isinstance(py_result, Exception) else py_result
            rust_exception = None if not isinstance(rust_result, Exception) else rust_result
            
            if py_exception:
                logger.error(f"Python nonlinear solver exception: {py_exception}")
                raise py_exception
            
            if rust_exception:
                logger.warning(f"Rust nonlinear comparison failed (non-fatal): {rust_exception}")
                rust_result = None
            
            # Build response with comparison metadata
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            
            py_data = {
                'success': True,
                'converged': py_result.get('converged', True),
                'iterations': py_result.get('iterations', 0),
                'displacements': py_result.get('displacements', {}),
                'reactions': py_result.get('reactions', {}),
                'member_forces': py_result.get('member_forces', {}),
                'stats': {
                    'backend_used': 'python',
                    'total_solve_time_ms': elapsed_ms,
                    'python_solve_time_ms': py_result.get('solve_time_ms', 0)
                }
            }
            
            if rust_result is not None:
                # Compute displacement delta
                py_disps = py_result.get('displacements', {})
                rust_disps = rust_result.get('displacements', {})
                
                deltas = []
                for node_id in py_disps:
                    py_val = py_disps.get(node_id, 0.0)
                    rust_val = rust_disps.get(node_id, 0.0)
                    deltas.append(abs(py_val - rust_val))
                
                max_delta = max(deltas) if deltas else 0.0
                
                py_data['stats']['debug_comparison'] = {
                    'enabled': True,
                    'rust_available': True,
                    'max_displacement_delta_mm': max_delta,
                    'within_tolerance': max_delta <= (request.debug_compare_tolerance or 1e-2),
                    'rust_solve_time_ms': rust_result.get('solve_time_ms', 0)
                }
            else:
                py_data['stats']['debug_comparison'] = {
                    'enabled': True,
                    'rust_available': False,
                    'reason': 'Rust nonlinear solver unavailable or incompatible'
                }
            
            return py_data
        else:
            # Default: Python authoritative
            py_result = await solve_nonlinear_python()
            return {
                'success': True,
                'converged': py_result.get('converged', True),
                'iterations': py_result.get('iterations', 0),
                'displacements': py_result.get('displacements', {}),
                'reactions': py_result.get('reactions', {}),
                'member_forces': py_result.get('member_forces', {}),
                'stats': {
                    'backend_used': 'python',
                    'total_solve_time_ms': (time.perf_counter() - start_time) * 1000
                }
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Nonlinear analysis error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Nonlinear analysis failed: {str(e)}")


@router.post("/analysis/pdelta/run")
async def run_pdelta_analysis(request: PDeltaAnalysisRequest):
    """
    Run P-Delta (geometric nonlinear) structural analysis.
    
    Migration-ready mode:
    - Python: Custom iterative solver (if available)
    - Rust: Dedicated PDeltaSolver with convergence tracking
    - Returns amplification factor, converged displacements, iterations.
    """
    start_time = time.perf_counter()
    
    try:
        from analysis.rust_interop import analyze_with_best_backend
        
        forced_backend = (request.backend or "rust").lower()  # Favor Rust for P-Delta
        if forced_backend not in {"auto", "rust", "python"}:
            raise HTTPException(status_code=400, detail="backend must be one of: auto, rust, python")
        
        logger.info(
            "P-Delta analysis request",
            extra={
                "n_nodes": len(request.nodes),
                "n_members": len(request.members),
                "max_iterations": request.max_iterations,
                "backend": forced_backend
            }
        )
        
        # Build Rust model for P-Delta
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
            "max_iterations": request.max_iterations or 10,
            "tolerance": request.tolerance or 1e-6,
        }
        
        # ── Rust P-Delta Solver (Native implementation) ──
        async def solve_pdelta_rust() -> Dict[str, Any]:
            """Run P-Delta analysis via Rust backend."""
            rust_result = await analyze_with_best_backend(
                rust_model,
                analysis_type="pdelta",
                force_backend="rust"
            )
            
            if not rust_result.success:
                raise RuntimeError(rust_result.error or "Rust P-Delta solver failed")
            
            return {
                'backend': 'rust',
                'converged': rust_result.metadata.get('converged', False),
                'iterations': rust_result.metadata.get('iterations', 0),
                'amplification_factor': rust_result.metadata.get('amplification_factor', 1.0),
                'displacements': {d.get('nodeId'): d.get('dy', 0) for d in (rust_result.displacements or [])},
                'solve_time_ms': (time.perf_counter() - start_time) * 1000
            }
        
        # ── Execution logic ──
        # P-Delta is better served by Rust, so default to Rust with Python fallback
        if forced_backend == "python":
            logger.warning("P-Delta analysis requested with Python backend; Rust is recommended")
            # Placeholder: would implement Python P-Delta if OptimizedFrameSolver supports it
            raise HTTPException(
                status_code=501,
                detail="Python P-Delta solver not yet implemented; use backend='rust'"
            )
        elif forced_backend == "rust" or forced_backend == "auto":
            try:
                rust_result = await solve_pdelta_rust()
                return {
                    'success': True,
                    'converged': rust_result['converged'],
                    'iterations': rust_result['iterations'],
                    'amplification_factor': rust_result['amplification_factor'],
                    'displacements': rust_result['displacements'],
                    'stats': {
                        'backend_used': 'rust',
                        'total_solve_time_ms': (time.perf_counter() - start_time) * 1000,
                        'rust_solve_time_ms': rust_result['solve_time_ms']
                    }
                }
            except Exception as e:
                logger.error(f"Rust P-Delta analysis failed: {e}")
                if forced_backend == "auto":
                    logger.warning("Falling back to Python P-Delta (not implemented)")
                raise HTTPException(status_code=500, detail=f"P-Delta analysis failed: {str(e)}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"P-Delta analysis error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"P-Delta analysis failed: {str(e)}")


@router.post("/analysis/buckling/run")
async def run_buckling_analysis(request: BucklingAnalysisRequest):
    """
    Run buckling (stability) analysis to find critical loads and mode shapes.
    
    Rust-native implementation:
    - Solves generalized eigenvalue problem: K*φ = λ*Kg*φ
    - Returns buckling factors, critical loads, mode shapes
    - Debug mode available for validation
    """
    start_time = time.perf_counter()
    
    try:
        from analysis.rust_interop import analyze_with_best_backend
        
        forced_backend = (request.backend or "rust").lower()  # Favor Rust for buckling
        if forced_backend not in {"auto", "rust", "python"}:
            raise HTTPException(status_code=400, detail="backend must be one of: auto, rust, python")
        
        logger.info(
            "Buckling analysis request",
            extra={
                "n_nodes": len(request.nodes),
                "n_members": len(request.members),
                "num_modes": request.num_modes,
                "backend": forced_backend
            }
        )
        
        # Build Rust model
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
            "num_modes": request.num_modes or 5,
        }
        
        # ── Rust Buckling Solver ──
        async def solve_buckling_rust() -> Dict[str, Any]:
            """Run buckling analysis via Rust backend."""
            rust_result = await analyze_with_best_backend(
                rust_model,
                analysis_type="buckling",
                force_backend="rust"
            )
            
            if not rust_result.success:
                raise RuntimeError(rust_result.error or "Rust buckling solver failed")
            
            return {
                'backend': 'rust',
                'buckling_factors': rust_result.metadata.get('buckling_factors', []),
                'critical_loads': [
                    bf * sum(abs(l.fy or 0) for l in request.node_loads or [])
                    for bf in rust_result.metadata.get('buckling_factors', [])
                ],
                'mode_shapes': rust_result.metadata.get('mode_shapes', []),
                'n_modes': rust_result.metadata.get('n_modes', 0),
                'solve_time_ms': (time.perf_counter() - start_time) * 1000
            }
        
        # ── Execution logic ──
        if forced_backend == "python":
            logger.warning("Buckling analysis requested with Python backend; Rust is native implementation")
            raise HTTPException(
                status_code=501,
                detail="Python buckling solver not implemented; use backend='rust'"
            )
        elif forced_backend == "rust" or forced_backend == "auto":
            try:
                rust_result = await solve_buckling_rust()
                
                response = {
                    'success': True,
                    'buckling_factors': rust_result['buckling_factors'],
                    'critical_loads': rust_result['critical_loads'],
                    'mode_shapes': rust_result['mode_shapes'],
                    'n_modes': rust_result['n_modes'],
                    'stats': {
                        'backend_used': 'rust',
                        'total_solve_time_ms': (time.perf_counter() - start_time) * 1000,
                        'rust_solve_time_ms': rust_result['solve_time_ms']
                    }
                }
                
                # Add interpretation
                if rust_result['buckling_factors']:
                    response['interpretation'] = {
                        'lowest_buckling_factor': rust_result['buckling_factors'][0],
                        'critical_load': rust_result['critical_loads'][0] if rust_result['critical_loads'] else 0,
                        'safety_level': 'stable' if rust_result['buckling_factors'][0] > 1.5 else (
                            'warning' if rust_result['buckling_factors'][0] > 1.0 else 'unstable'
                        )
                    }
                
                return response
                
            except Exception as e:
                logger.error(f"Rust buckling analysis failed: {e}")
                if forced_backend == "auto":
                    logger.warning("Python buckling solver not available; analysis failed")
                raise HTTPException(status_code=500, detail=f"Buckling analysis failed: {str(e)}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Buckling analysis error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Buckling analysis failed: {str(e)}")


# ── Advanced FEM Analysis ──

@router.post("/analyze/advanced")
async def analyze_advanced_fem(request: AdvancedAnalysisRequest):
    """
    Advanced Finite Element Analysis supporting:
    - Frame (Timoshenko beam) elements
    - Thick (Mindlin-Reissner) and thin (Kirchhoff) plate/shell elements
    - 3-D solid (Hex8 / Hex20) brick elements
    - Non-linear link elements (gap, hook, friction pendulum, viscous damper, multi-linear)
    - Rigid / semi-rigid diaphragm constraints
    - Tension-only and compression-only frame members (iterative NR solver)
    """
    try:
        from analysis.solvers.advanced_solver import analyze_advanced
        start_time = time.perf_counter()

        logger.info(
            "Advanced FEM request received",
            extra={
                "nodes": len(request.nodes),
                "members": len(request.members or []),
                "plates": len(request.plate_elements or []),
                "solids": len(request.solid_elements or []),
                "links": len(request.link_elements or []),
                "diaphragms": len(request.diaphragms or []),
                "t_only": len(request.tension_only or []),
                "c_only": len(request.compression_only or []),
            },
        )

        # Build node dict
        nodes_dict = {}
        for n in request.nodes:
            nodes_dict[n.id] = {"x": n.x, "y": n.y, "z": n.z}

        # Build supports
        supports_dict: Dict[str, List[int]] = {}
        for n in request.nodes:
            if not n.support or n.support.lower() == "none":
                continue
            support = n.support.lower()
            dofs: List[int] = []
            if support == "fixed":
                dofs = [0, 1, 2, 3, 4, 5]
            elif support in ("pinned", "pin"):
                dofs = [0, 1, 2]
            elif support == "roller":
                dofs = [1]
            elif support == "roller_x":
                dofs = [0]
            elif support == "roller_z":
                dofs = [2]
            if dofs:
                supports_dict[n.id] = dofs

        # Build frame elements
        frame_elements = []
        for m in (request.members or []):
            frame_elements.append({
                "id": m.id,
                "node_i": m.startNodeId,
                "node_j": m.endNodeId,
                "E": m.E or 200e6,
                "G": m.G or 77e6,
                "Iy": m.Iy or 1e-4,
                "Iz": m.Iz or 1e-4,
                "J": m.J or 1e-5,
                "A": m.A or 0.01,
            })

        # Build nodal loads
        nodal_loads_dict: Dict[str, Dict[str, float]] = {}
        for l in (request.node_loads or []):
            nodal_loads_dict[l.nodeId] = {
                "ux": l.fx or 0, "uy": l.fy or 0, "uz": l.fz or 0,
                "rx": l.mx or 0, "ry": l.my or 0, "rz": l.mz or 0,
            }

        # Build member loads
        member_loads_list = []
        for dl in (request.distributed_loads or []):
            direction_map = {
                "Fx": "local_x", "Fy": "local_y", "Fz": "local_z",
                "fx": "local_x", "fy": "local_y", "fz": "local_z",
            }
            member_loads_list.append({
                "element_id": dl.memberId,
                "load_type": "trapez" if dl.w2 is not None and dl.w2 != dl.w1 else "udl",
                "direction": direction_map.get(dl.direction, "local_y"),
                "w1": dl.w1,
                "w2": dl.w2 if dl.w2 is not None else dl.w1,
            })

        # Build plate elements
        plate_list = None
        if request.plate_elements:
            plate_list = [pe.model_dump() for pe in request.plate_elements]

        # Build solid elements
        solid_list = None
        if request.solid_elements:
            solid_list = [se.model_dump() for se in request.solid_elements]

        # Build link elements
        link_list = None
        if request.link_elements:
            link_list = [le.model_dump() for le in request.link_elements]

        # Build diaphragm constraints
        diaphragm_list = None
        if request.diaphragms:
            diaphragm_list = [d.model_dump() for d in request.diaphragms]

        # Run advanced solver
        result = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: analyze_advanced(
                nodes=nodes_dict,
                elements=frame_elements or None,
                supports=supports_dict or None,
                nodal_loads=nodal_loads_dict or None,
                member_loads=member_loads_list or None,
                plate_elements=plate_list,
                solid_elements=solid_list,
                link_elements=link_list,
                diaphragms=diaphragm_list,
                tension_only=request.tension_only or None,
                compression_only=request.compression_only or None,
                include_self_weight=request.include_self_weight or False,
                solver=request.solver or "direct",
            ),
        )

        total_time = (time.perf_counter() - start_time) * 1000

        logger.info(
            "Advanced FEM analysis complete",
            extra={
                "n_dofs": result.get("n_dofs", 0),
                "solve_time_ms": result.get("solve_time_ms", 0),
                "max_displacement": result.get("max_displacement", 0),
            },
        )

        return {
            "success": True,
            **result,
            "stats": {
                "backend_used": "python_advanced_dsm",
                "total_ms": round(total_time, 2),
                "solve_ms": round(result.get("solve_time_ms", 0), 2),
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Advanced FEM analysis error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Advanced analysis failed: {str(e)}"
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# RIGOROUS SOLVER MECHANICS — Proxies to Rust API
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import httpx
import os

RUST_API_URL = os.environ.get("RUST_API_URL", "http://localhost:8080")


async def _proxy_to_rust(endpoint: str, payload: dict) -> dict:
    """Forward a request to the Rust API and return the JSON response."""
    url = f"{RUST_API_URL}/api/advanced/{endpoint}"
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        logger.error(f"Rust API error ({endpoint}): {e.response.status_code} – {e.response.text}")
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Rust solver error: {e.response.text}",
        )
    except httpx.ConnectError:
        logger.warning(f"Rust API unreachable at {url}, falling back to stub")
        raise HTTPException(
            status_code=503,
            detail="Rust analysis backend unavailable. Deploy rust-api or use direct Rust endpoint.",
        )


# ── 1. Staged Construction ──

class StageInput(BaseModel):
    stage_id: str
    label: str
    activate_elements: List[str] = []
    remove_elements: List[str] = []
    loads: Dict[str, float] = {}
    boundary_changes: Dict[str, str] = {}
    duration_days: float = 28.0
    concrete_age_days: Optional[float] = None


class ConcreteTimeInput(BaseModel):
    fc28: float
    ec28: float
    cement_type: int = 1
    creep_ultimate: float = 2.35
    shrinkage_ultimate: float = 780e-6
    humidity: float = 60.0
    vs_ratio: float = 38.0


class StagedConstructionRequest(BaseModel):
    nodes: List[FrameNodeInput]
    members: List[FrameMemberInput]
    stages: List[StageInput]
    concrete_config: Optional[ConcreteTimeInput] = None
    time_dependent: bool = False
    node_loads: Optional[List[NodeLoadInput]] = []


@router.post("/analysis/staged-construction")
async def staged_construction(req: StagedConstructionRequest):
    """Construction Sequence Analysis – proxy to Rust solver."""
    payload = req.model_dump(mode="json")
    return await _proxy_to_rust("staged-construction", payload)


# ── 2. Direct Analysis Method (DAM) ──

class DAMLevelInput(BaseModel):
    height: float
    gravity_load: float


class DAMMemberInput(BaseModel):
    member_id: str
    length: float
    e: float
    i: float
    a: float
    fy: float
    pr: float
    k: float
    cm: float
    sway: bool = False


class DAMAnalysisRequest(BaseModel):
    nodes: List[FrameNodeInput]
    members: List[FrameMemberInput]
    levels: List[DAMLevelInput]
    dam_members: List[DAMMemberInput]
    alpha: float = 0.002
    run_pdelta: bool = True
    pdelta_tolerance: float = 1e-6
    pdelta_max_iter: int = 10
    node_loads: Optional[List[NodeLoadInput]] = []


@router.post("/analysis/dam")
async def dam_analysis(req: DAMAnalysisRequest):
    """Direct Analysis Method (AISC 360-22) – proxy to Rust solver."""
    payload = req.model_dump(mode="json")
    return await _proxy_to_rust("dam", payload)


# ── 3. Newton-Raphson / Arc-Length Nonlinear Solve ──

class NonlinearSolveRequest(BaseModel):
    nodes: List[FrameNodeInput]
    members: List[FrameMemberInput]
    method: str = "newton_raphson"  # newton_raphson | modified_newton_raphson | arc_length | displacement_control
    load_steps: int = 10
    target_load_factor: float = 1.0
    force_tolerance: float = 1e-6
    displacement_tolerance: float = 1e-6
    max_iterations: int = 10
    line_search: bool = False
    line_search_tolerance: float = 0.5
    initial_arc_length: float = 1.0
    geometric_nonlinearity: bool = True
    control_dof: Optional[int] = None
    control_increment: Optional[float] = None
    node_loads: Optional[List[NodeLoadInput]] = []


@router.post("/analysis/nonlinear-solve")
async def nonlinear_solve(req: NonlinearSolveRequest):
    """Newton-Raphson / Arc-Length nonlinear solve – proxy to Rust solver."""
    payload = req.model_dump(mode="json")
    return await _proxy_to_rust("nonlinear", payload)


# ── 4. Mass Source Definition ──

class MassContributionInput(BaseModel):
    case_id: str
    factor: float


class NodalGravityInput(BaseModel):
    node_id: str
    force_kn: float


class MassSourceRequest(BaseModel):
    contributions: List[MassContributionInput]
    load_cases: Dict[str, List[NodalGravityInput]]
    include_self_weight: bool = True
    self_weight_factor: float = 1.0
    element_masses: Dict[str, float] = {}
    additional_masses: Dict[str, float] = {}
    mass_type: str = "lumped"
    gravity: float = 9.80665
    dofs_per_node: int = 6
    code_preset: Optional[str] = None
    ll_fraction: Optional[float] = None


@router.post("/analysis/mass-source")
async def mass_source(req: MassSourceRequest):
    """Mass Source Definition for seismic analysis – proxy to Rust solver."""
    payload = req.model_dump(mode="json")
    return await _proxy_to_rust("mass-source", payload)
