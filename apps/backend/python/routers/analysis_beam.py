"""
Beam analysis endpoint (legacy). Python solver is disabled; enforced Rust proxy.
"""

from fastapi import APIRouter, HTTPException

from logging_config import get_logger
from routers.analysis_defaults import (
    DEFAULT_MEMBER_A,
    DEFAULT_MEMBER_I,
    DEFAULT_MEMBER_J,
    DEFAULT_RUST_E,
)
from routers.analysis_schemas import BeamAnalysisRequest

logger = get_logger(__name__)

router = APIRouter(tags=["Analysis"])


@router.post("/analyze/beam")
async def analyze_beam(request: BeamAnalysisRequest):
    """
    Beam analysis now enforced via Rust backend. Python beam solver is retired.
    """
    if request.length <= 0:
        raise HTTPException(status_code=400, detail="Beam length must be positive")
    if not request.loads:
        raise HTTPException(status_code=400, detail="At least one load required")

    from analysis.rust_interop import analyze_with_best_backend

    rust_model = {
        "nodes": [
            {"id": 0, "x": 0.0, "y": 0.0, "z": 0.0},
            {"id": 1, "x": request.length, "y": 0.0, "z": 0.0},
        ],
        "members": [
            {
                "id": 1,
                "startNodeId": 0,
                "endNodeId": 1,
                "E": request.E or DEFAULT_RUST_E,
                "A": DEFAULT_MEMBER_A,
                "I": request.I or DEFAULT_MEMBER_I,
                "J": DEFAULT_MEMBER_J,
            }
        ],
        "supports": [
            {"nodeId": 0, "fx": True, "fy": True, "fz": False, "mx": False, "my": True, "mz": False},
            {"nodeId": 1, "fx": False, "fy": True, "fz": False, "mx": False, "my": False, "mz": False},
        ],
        "loads": [],
    }

    for load in request.loads:
        # Map point loads only; distributed loads should use frame endpoints
        if load.type.lower() != "point":
            raise HTTPException(
                status_code=400,
                detail="Rust beam proxy supports point loads only. Use Rust frame endpoint for distributed loads.",
            )
        rust_model["loads"].append(
            {
                "nodeId": 1 if load.position >= request.length * 0.99 else 0,
                "fx": 0.0,
                "fy": -abs(load.magnitude),
                "fz": 0.0,
                "mx": 0.0,
                "my": 0.0,
                "mz": 0.0,
            }
        )

    result = await analyze_with_best_backend(
        rust_model,
        analysis_type="static",
        force_backend="rust",
    )

    if not result.success:
        raise HTTPException(status_code=502, detail=result.error or "Rust beam analysis failed")

    displacements = {
        d.get("nodeId"): d.get("dy", 0.0) * 1000.0
        for d in (result.displacements or [])
        if isinstance(d, dict)
    }

    reactions = {
        r.get("nodeId"): {"fy": r.get("fy", 0.0), "my": r.get("my", 0.0)}
        for r in (result.reactions or [])
        if isinstance(r, dict)
    }

    return {
        "backend": result.backend_used or "rust",
        "max_deflection": min(displacements.values()) if displacements else 0.0,
        "reactions": reactions,
        "solve_time_ms": result.solve_time_ms,
        "metadata": result.metadata,
    }
