"""
Deprecated monolithic reports router. Delegates to bundle.
"""

from fastapi import APIRouter

from .reports_router_bundle import router as _reports_router
from .reports_schemas import ReportCustomization
from .reports_utils import apply_profile_to_customization

router = APIRouter(tags=["Reports"])

# Backward compatibility include
router.include_router(_reports_router)

__all__ = ["router", "ReportCustomization", "apply_profile_to_customization"]
