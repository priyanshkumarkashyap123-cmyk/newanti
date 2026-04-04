"""
Aggregated router for report templates and generation endpoints.
"""

from fastapi import APIRouter

from .reports_templates_router import router as templates_router
from .reports_generate_router import router as generate_router
from .reports_jobs_router import router as jobs_router
from .tasks_router import router as tasks_router

router = APIRouter(tags=["Reports"])

router.include_router(templates_router)
router.include_router(generate_router)
router.include_router(jobs_router)
router.include_router(tasks_router)
