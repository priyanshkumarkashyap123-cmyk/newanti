"""
Aggregated router for stress and time-history endpoints.
"""

from fastapi import APIRouter

from .stress_router import router as stress_router
from .time_history_router import router as time_history_router

router = APIRouter(tags=["Analysis"])

router.include_router(stress_router)
router.include_router(time_history_router)
