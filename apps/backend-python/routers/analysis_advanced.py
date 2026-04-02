"""
Advanced FEM analysis endpoint is deprecated; use the Rust backend.
"""

from fastapi import APIRouter, HTTPException

from logging_config import get_logger
from routers.analysis_schemas import AdvancedAnalysisRequest

logger = get_logger(__name__)

router = APIRouter(tags=["Analysis"])


@router.post("/analyze/advanced")
async def analyze_advanced_fem(_: AdvancedAnalysisRequest):
    """Deprecated: advanced FEM analysis is Rust-only."""
    logger.warning("Python advanced FEM endpoint called; Rust backend is authoritative")
    raise HTTPException(
        status_code=410,
        detail="Python advanced FEM solver has been removed. Use the Rust backend endpoint instead.",
    )
