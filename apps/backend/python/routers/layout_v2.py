"""
Deprecated monolithic layout v2 router. Delegates to split routers.
"""

from fastapi import APIRouter

import routers.layout_v2_optimize_router as _optimize_router_mod
from layout_solver_v2 import LayoutSolverV2
from routers.layout_v2_schemas import MinimalAutoOptimizeRequest, SiteRequest
from routers.layout_v2_auto_router import optimize_layout_v2_auto as _optimize_layout_v2_auto
from routers.layout_v2_utils import (
    build_auto_program_adjacency as _build_auto_program_adjacency,
    build_auto_program_nodes as _build_auto_program_nodes,
)

try:
    from .layout_v2_router_bundle import router as _bundle_router
except ImportError:
    # Tests may import this module directly via importlib without package context.
    from routers.layout_v2_router_bundle import router as _bundle_router

router = APIRouter(tags=["Layout Optimization v2"])

# Include new split routers for backward compatibility
router.include_router(_bundle_router)


async def optimize_layout_v2_auto(request: MinimalAutoOptimizeRequest):
    """Compatibility wrapper so tests can monkeypatch LayoutSolverV2 on this module."""
    previous_solver_cls = _optimize_router_mod.LayoutSolverV2
    _optimize_router_mod.LayoutSolverV2 = LayoutSolverV2
    try:
        return await _optimize_layout_v2_auto(request)
    finally:
        _optimize_router_mod.LayoutSolverV2 = previous_solver_cls

__all__ = [
    "router",
    "LayoutSolverV2",
    "MinimalAutoOptimizeRequest",
    "SiteRequest",
    "optimize_layout_v2_auto",
    "_build_auto_program_nodes",
    "_build_auto_program_adjacency",
]

