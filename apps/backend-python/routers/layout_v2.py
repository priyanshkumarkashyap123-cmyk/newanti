"""
Deprecated monolithic layout v2 router. Delegates to split routers.
"""

from fastapi import APIRouter

try:
	from .layout_v2_router_bundle import router as _bundle_router
except ImportError:
	# Tests may import this module directly via importlib without package context.
	from routers.layout_v2_router_bundle import router as _bundle_router

router = APIRouter(tags=["Layout Optimization v2"])

# Include new split routers for backward compatibility
router.include_router(_bundle_router)

