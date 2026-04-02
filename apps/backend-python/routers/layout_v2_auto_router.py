"""
Auto-optimize layout v2 endpoint (minimal inputs -> default program -> optimize).
"""

from fastapi import APIRouter, HTTPException

from routers.layout_v2_schemas import LayoutV2Request, LayoutV2Response, MinimalAutoOptimizeRequest
from .layout_v2_utils import build_auto_program_nodes, build_auto_program_adjacency, validate_layout_v2_request
from .layout_v2_optimize_router import optimize_layout_v2

router = APIRouter(tags=["Layout Optimization v2"])


@router.post("/api/layout/v2/auto-optimize", response_model=LayoutV2Response)
async def optimize_layout_v2_auto(request: MinimalAutoOptimizeRequest):
    try:
        nodes = build_auto_program_nodes(request)
        adjacency = build_auto_program_adjacency(nodes)

        full_request = LayoutV2Request(
            site=request.site,
            global_constraints=request.global_constraints,
            nodes=nodes,
            adjacency_matrix=adjacency,
            max_iterations=request.max_iterations,
            random_seed=request.random_seed,
            penalty_weights=request.penalty_weights,
            sa_params=request.sa_params,
        )

        validate_layout_v2_request(full_request)
        return await optimize_layout_v2(full_request)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Auto layout optimization failed: {exc}") from exc
