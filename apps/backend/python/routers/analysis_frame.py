"""
Frame analysis endpoint - Rust-only backend enforcement
"""

from fastapi import APIRouter, HTTPException

from logging_config import get_logger
from routers.analysis_defaults import (
    DEFAULT_FRAME_E,
    DEFAULT_MEMBER_A,
    DEFAULT_MEMBER_I,
    DEFAULT_MEMBER_J,
)
from routers.analysis_schemas import FrameAnalysisRequest
from routers.support_mapping import build_rust_supports

logger = get_logger(__name__)

router = APIRouter(tags=["Analysis"])


@router.post("/analyze/frame")
async def analyze_3d_frame(request: FrameAnalysisRequest):
    """
    Enforced Rust backend for 3D frame analysis.
    
    Plates/distributed loads are not supported here; use Rust advanced endpoints for those.
    """
    from analysis.rust_interop import analyze_with_best_backend

    if request.plates:
        raise HTTPException(
            status_code=400,
            detail="Rust frame proxy does not handle plates. Use Rust advanced plate analysis endpoints.",
        )
    if request.distributed_loads:
        raise HTTPException(
            status_code=400,
            detail="Rust frame proxy expects lumped node loads. Use Rust analysis with member load support.",
        )

    supports_for_rust = build_rust_supports(request.nodes)

    rust_model = {
        "nodes": [{"id": n.id, "x": n.x, "y": n.y, "z": n.z} for n in request.nodes],
        "members": [
            {
                "id": m.id,
                "startNodeId": m.startNodeId,
                "endNodeId": m.endNodeId,
                "E": m.E or DEFAULT_FRAME_E,
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
        raise HTTPException(status_code=502, detail=result.error or "Rust frame analysis failed")

    rust_nodes = []
    for d in (result.displacements or []):
        if not isinstance(d, dict) or not d.get("nodeId"):
            continue
        rust_nodes.append(
            {
                "nodeId": d.get("nodeId"),
                "displacement": {
                    "dx": float(d.get("dx", 0.0)) * 1000.0,
                    "dy": float(d.get("dy", 0.0)) * 1000.0,
                    "dz": float(d.get("dz", 0.0)) * 1000.0,
                    "rx": float(d.get("rx", 0.0)),
                    "ry": float(d.get("ry", 0.0)),
                    "rz": float(d.get("rz", 0.0)),
                },
                "reaction": {},
            }
        )

    reactions_map = {
        r.get("nodeId"): r
        for r in (result.reactions or [])
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

    return {
        "success": True,
        "nodes": rust_nodes,
        "reactions": list(reactions_map.values()),
        "stats": {"backend_used": "rust"},
        "metadata": result.metadata,
        "solve_time_ms": result.solve_time_ms,
    }
