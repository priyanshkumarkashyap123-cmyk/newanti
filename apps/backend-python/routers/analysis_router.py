"""
Aggregator router for analysis endpoints.
"""

from fastapi import APIRouter

from routers.analysis_beam import router as beam_router
from routers.analysis_frame import router as frame_router
from routers.analysis_large_frame import router as large_frame_router
from routers.analysis_proxy_endpoints import router as proxy_router

router = APIRouter(tags=["Analysis"])

router.include_router(proxy_router)
router.include_router(beam_router)
router.include_router(frame_router)
router.include_router(large_frame_router)
# Deprecated Python routes removed; Rust proxy routes are authoritative.
