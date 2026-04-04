"""Deprecated design router shim.

This module existed as a monolithic design endpoint. All design routes now live in
`design_router_bundle` (design_check, RC, steel). This shim keeps import compatibility
but returns HTTP 410 Gone for any direct use.
"""

from fastapi import APIRouter, HTTPException

from .design_router_bundle import router as _design_router

router = APIRouter(tags=["Design"], prefix="/design-legacy")


@router.get("/")
@router.post("/")
@router.api_route("/{path:path}")
async def deprecated_design_router(*_args, **_kwargs):
    # Explicitly signal deprecation to callers hitting the old module path.
    raise HTTPException(status_code=410, detail="design.py deprecated; use design_router_bundle routes")


# Backward-compatibility inclusion of the real bundle
router.include_router(_design_router)