"""
Buckling analysis endpoint has been removed in favor of the Rust solver.
"""

from fastapi import APIRouter, HTTPException

from logging_config import get_logger
from routers.analysis_schemas import BucklingAnalysisRequest

logger = get_logger(__name__)

router = APIRouter(tags=["Analysis"])


@router.post("/analysis/buckling/run")
async def run_buckling_analysis(_: BucklingAnalysisRequest):
    """Deprecated: buckling analysis is Rust-only."""
    logger.warning("Python buckling endpoint called; Rust backend is authoritative")
    raise HTTPException(
        status_code=410,
        detail="Python buckling solver has been removed. Use the Rust backend endpoint instead."
    )
