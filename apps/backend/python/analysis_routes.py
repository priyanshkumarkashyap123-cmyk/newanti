from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from analysis.rust_interop import analyze_with_best_backend

router = APIRouter()


def _build_rust_model_payload(
    nodes: List[Dict[str, Any]],
    members: List[Dict[str, Any]],
    node_loads: List[Dict[str, Any]],
    distributed_loads: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Normalize request payload for Rust solver endpoints."""
    supports = []
    for node in nodes:
        restraints = node.get("restraints")
        if restraints:
            supports.append({"node_id": node.get("id"), "restraints": restraints})

    loads: List[Dict[str, Any]] = []
    for load in node_loads:
        loads.append({
            "node_id": load.get("nodeId") or load.get("node_id"),
            "fx": load.get("fx", 0.0),
            "fy": load.get("fy", 0.0),
            "fz": load.get("fz", 0.0),
            "mx": load.get("mx", 0.0),
            "my": load.get("my", 0.0),
            "mz": load.get("mz", 0.0),
        })

    for load in distributed_loads:
        loads.append({
            "member_id": load.get("memberId") or load.get("member_id"),
            "direction": load.get("direction", "Fy"),
            "w1": load.get("w1", 0.0),
            "w2": load.get("w2", load.get("w1", 0.0)),
            "start_pos": load.get("startPos", load.get("start_pos", 0.0)),
            "end_pos": load.get("endPos", load.get("end_pos", 1.0)),
        })

    return {
        "nodes": nodes,
        "members": members,
        "supports": supports,
        "loads": loads,
    }

# ============================================
# REQUEST MODELS
# ============================================

class SpectrumAnalysisRequest(BaseModel):
    """
    Request for Response Spectrum Analysis
    """
    # Structural Model (same as FrameAnalysisRequest essentially)
    nodes: List[Dict[str, Any]]
    members: List[Dict[str, Any]]
    node_loads: List[Dict[str, Any]] = []
    distributed_loads: List[Dict[str, Any]] = []
    
    # Spectrum Parameters
    zone: str = "V"  # II, III, IV, V
    soil_type: str = "II"  # I, II, III
    importance_factor: float = 1.0  # I
    response_reduction: float = 5.0  # R
    damping: float = 0.05
    direction: str = "X"  # Direction of excitation
    
    # Analysis Settings
    num_modes: int = 12
    combination_method: str = "CQC"  # CQC or SRSS

class BucklingAnalysisRequest(BaseModel):
    """
    Request for Linear Buckling Analysis
    """
    nodes: List[Dict[str, Any]]
    members: List[Dict[str, Any]]
    node_loads: List[Dict[str, Any]] = []
    distributed_loads: List[Dict[str, Any]] = []
    num_modes: int = 5
    load_case: str = "LC1"

class TimeHistoryAnalysisRequest(BaseModel):
    """
    Request for Dynamic Time History Analysis
    """
    nodes: List[Dict[str, Any]]
    members: List[Dict[str, Any]]
    node_loads: List[Dict[str, Any]] = []
    distributed_loads: List[Dict[str, Any]] = []
    
    # Dynamics Parameters
    earthquake: str = "el_centro_1940"  # el_centro_1940, synthetic_pulse
    scale_factor: float = 1.0
    damping_ratio: float = 0.05
    method: str = "modal"  # "direct" (Newmark) or "modal" (Superposition)
    num_modes: int = 12    # For modal superposition

# ============================================
# ENDPOINTS
# ============================================

@router.post("/time-history", tags=["Analysis"])
async def analyze_timehistory(request: TimeHistoryAnalysisRequest):
    """
    Perform Dynamic Time History Analysis
    """
    try:
        model = _build_rust_model_payload(
            request.nodes,
            request.members,
            request.node_loads,
            request.distributed_loads,
        )
        result = await analyze_with_best_backend(
            model,
            analysis_type="time_history",
            force_backend="rust",
            earthquake=request.earthquake,
            scale_factor=request.scale_factor,
            damping_ratio=request.damping_ratio,
            method=request.method,
            num_modes=request.num_modes,
        )

        if not result.success:
            raise HTTPException(status_code=502, detail=result.error or "Rust time-history analysis failed")

        return {
            "success": True,
            "backend_used": result.backend_used,
            "solve_time_ms": result.solve_time_ms,
            "displacements": result.displacements,
            "reactions": result.reactions,
            "member_forces": result.member_forces,
            "modes": result.modes,
            "metadata": result.metadata,
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze/buckling", tags=["Analysis"])
async def analyze_buckling(request: BucklingAnalysisRequest):
    """
    Perform Linear Buckling (Eigenvalue) Analysis
    """
    try:
        model = _build_rust_model_payload(
            request.nodes,
            request.members,
            request.node_loads,
            request.distributed_loads,
        )
        result = await analyze_with_best_backend(
            model,
            analysis_type="buckling",
            force_backend="rust",
            num_modes=request.num_modes,
            load_case=request.load_case,
        )

        if not result.success:
            raise HTTPException(status_code=502, detail=result.error or "Rust buckling analysis failed")

        return {
            "success": True,
            "backend_used": result.backend_used,
            "solve_time_ms": result.solve_time_ms,
            "modes": result.modes,
            "metadata": result.metadata,
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze/spectrum", tags=["Analysis"])
async def analyze_spectrum(request: SpectrumAnalysisRequest):
    """Perform response spectrum analysis via Rust solver backend."""
    try:
        model = _build_rust_model_payload(
            request.nodes,
            request.members,
            request.node_loads,
            request.distributed_loads,
        )

        result = await analyze_with_best_backend(
            model,
            analysis_type="spectrum",
            force_backend="rust",
            zone=request.zone,
            soil_type=request.soil_type,
            importance_factor=request.importance_factor,
            response_reduction=request.response_reduction,
            damping=request.damping,
            direction=request.direction,
            num_modes=request.num_modes,
            combination_method=request.combination_method,
        )

        if not result.success:
            raise HTTPException(status_code=502, detail=result.error or "Rust spectrum analysis failed")

        return {
            "success": True,
            "backend_used": result.backend_used,
            "solve_time_ms": result.solve_time_ms,
            "displacements": result.displacements,
            "member_forces": result.member_forces,
            "modes": result.modes,
            "metadata": result.metadata,
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
