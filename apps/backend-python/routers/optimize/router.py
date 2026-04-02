"""
Section optimization endpoints (modularized).
"""

import logging
from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from analysis import worker_pool
from design.optimizer import SectionOptimizer

router = APIRouter(prefix="/optimize")
logger = logging.getLogger(__name__)


@router.post("/section")
async def optimize_section(request: Dict[str, Any]) -> Dict[str, Any]:
    """Select the optimal section based on design code and forces."""
    code = request.get("code")
    shape = request.get("shape")
    member_params = request.get("member_params")
    forces = request.get("forces")

    if not all([code, shape, member_params, forces]):
        logger.error("Missing fields in optimize_section request: %s", request)
        raise HTTPException(status_code=400, detail="Missing required fields: code, shape, member_params, forces")

    # Optionally initialize worker pool if needed
    try:
        await worker_pool.get_worker_pool()
    except Exception as e:  # noqa: BLE001
        logger.warning("Worker pool unavailable: %s", e)

    result = SectionOptimizer.find_optimal_section(
        code_name=code,
        shape_type=shape,
        member_params=member_params,
        forces=forces,
    )

    if not result:
        raise HTTPException(status_code=404, detail="No valid section found")

    return {"success": True, "data": result}
