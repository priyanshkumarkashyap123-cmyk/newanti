"""
Aggregated router for layout v2 endpoints (optimize, auto-optimize, variants, GA).
"""

from fastapi import APIRouter

from .layout_v2_auto_router import router as _auto_router
from .layout_v2_ga_router import router as _ga_router
from .layout_v2_optimize_router import router as _optimize_router
from .layout_v2_variants_router import router as _variants_router

router = APIRouter(tags=["Layout Optimization v2"])

router.include_router(_optimize_router)
router.include_router(_auto_router)
router.include_router(_variants_router)
router.include_router(_ga_router)
