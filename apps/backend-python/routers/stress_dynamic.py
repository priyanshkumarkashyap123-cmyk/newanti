"""
Deprecated monolithic stress/time-history router. Delegates to new modules.
"""

from fastapi import APIRouter

from .stress_router_bundle import router as _bundle_router

router = APIRouter(tags=["Analysis"])


# Include new split routers for backward compatibility
router.include_router(_bundle_router)
