"""
Large-frame analysis endpoint - Rust-only backend
"""

from fastapi import APIRouter, HTTPException

from logging_config import get_logger
from routers.analysis_defaults import (
    DEFAULT_MEMBER_A,
    DEFAULT_MEMBER_I,
    DEFAULT_MEMBER_J,
    DEFAULT_RUST_E,
    MAX_ANALYSIS_NODES,
)
from routers.analysis_schemas import LargeFrameAnalysisRequest
from routers.support_mapping import build_rust_supports

logger = get_logger(__name__)

router = APIRouter(tags=["Analysis"])


@router.post("/analyze/large-frame")
async def analyze_large_frame(request: LargeFrameAnalysisRequest):
    """
    Rust-only high-performance analysis for large models. Plates/member-loads not
    supported in this proxy; use Rust advanced endpoints for those cases.
    """
    from analysis.rust_interop import analyze_with_best_backend

    n_nodes = len(request.nodes) if request.nodes else 0
    if n_nodes == 0:
        raise HTTPException(status_code=400, detail="No nodes provided in request")
    if len(request.members or []) == 0:
        raise HTTPException(status_code=400, detail="No members provided in request")
    if n_nodes > MAX_ANALYSIS_NODES:
        raise HTTPException(
            status_code=400,
            detail=f"Model too large: {n_nodes} nodes exceeds limit of {MAX_ANALYSIS_NODES}",
        )

    supports_for_rust = build_rust_supports(request.nodes)

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
                "E": m.E or DEFAULT_RUST_E,
                "A": m.A or DEFAULT_MEMBER_A,
                "I": m.Iy or m.Iz or DEFAULT_MEMBER_I,
                "J": m.J or DEFAULT_MEMBER_J,
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

    result = await analyze_with_best_backend(
        rust_model,
        analysis_type="static",
        force_backend="rust",
    )

    if not result.success:
        raise HTTPException(status_code=502, detail=result.error or "Rust large-frame analysis failed")

    rust_displacements = {
        d.get("nodeId"): {
            "dx": d.get("dx", 0.0),
            "dy": d.get("dy", 0.0),
            "dz": d.get("dz", 0.0),
            "rx": d.get("rx", 0.0),
            "ry": d.get("ry", 0.0),
            "rz": d.get("rz", 0.0),
        }
        for d in (result.displacements or [])
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
        for r in (result.reactions or [])
        if isinstance(r, dict) and r.get("nodeId")
    }

    return {
        "backend": result.backend_used or "rust",
        "displacements": rust_displacements,
        "reactions": rust_reactions,
        "member_forces": result.member_forces or [],
        "solve_time_ms": result.solve_time_ms,
        "stats": {"rust_metadata": result.metadata},
    }
