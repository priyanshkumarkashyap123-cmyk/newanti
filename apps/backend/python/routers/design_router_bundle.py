"""
Aggregated router for design endpoints (checks, RC design, steel design).
"""

from fastapi import APIRouter

from .design_check_router import router as design_check_router
from .design_rc_router import router as design_rc_router
from .design_steel_router import router as design_steel_router

router = APIRouter(tags=["Design"])

router.include_router(design_check_router)
router.include_router(design_rc_router)
router.include_router(design_steel_router)
