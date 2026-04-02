"""
Nonlinear and P-Delta endpoints are retired in favor of the Rust solver.
"""

from fastapi import APIRouter, HTTPException

from logging_config import get_logger
from routers.analysis_schemas import NonlinearAnalysisRequest, PDeltaAnalysisRequest

logger = get_logger(__name__)

router = APIRouter(tags=["Analysis"])


@router.post("/analysis/nonlinear/run")
async def run_nonlinear_analysis(_: NonlinearAnalysisRequest):
    """Deprecated: nonlinear analysis now served by Rust backend only."""
    logger.warning("Python nonlinear endpoint called; Rust backend is authoritative")
    raise HTTPException(
        status_code=410,
        detail="Python nonlinear solver has been removed. Use the Rust backend endpoint instead."
    )


@router.post("/analysis/pdelta/run")
async def run_pdelta_analysis(_: PDeltaAnalysisRequest):
    """Deprecated: P-Delta analysis now served by Rust backend only."""
    logger.warning("Python P-Delta endpoint called; Rust backend is authoritative")
    raise HTTPException(
        status_code=410,
        detail="Python P-Delta solver has been removed. Use the Rust backend endpoint instead."
    )
