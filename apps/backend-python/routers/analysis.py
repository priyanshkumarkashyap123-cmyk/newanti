"""
Deprecated stub kept for import compatibility. All analysis endpoints are
implemented in Rust via `analysis_routes.py` / Rust interop. This file only
re-exports the active router to prevent legacy imports from re-enabling Python
solver code.
"""

from fastapi import APIRouter

from routers.analysis_router import router as _router


router = APIRouter(tags=["Analysis"])
router.include_router(_router)

