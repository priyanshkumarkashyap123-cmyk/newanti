"""
V1 Router Factory

Wraps existing routers and mounts them under /api/v1 prefix
during Phase 2 of versioning migration (ADR-009).

This allows backward compatibility while signaling v1 as the stable path.
Unversioned routes are deprecated but still served during the 6-month transition.
"""

from fastapi import APIRouter, FastAPI
from typing import List


def create_v1_routers(
    ai_router,
    analyze_router,
    factory_router,
    code_router,
    compliance_router,
    concrete_router,
    jobs_router,
    reports_router,
    health_router,
) -> List[tuple]:
    """
    Create v1 versions of all routers by prefixing with /api/v1.
    
    Returns list of (prefix, router) tuples for app.include_router() calls.
    Each router is wrapped to execute the same handlers but under /api/v1/* path.
    
    Example:
        v1_routes = create_v1_routers(ai_router, analyze_router, ...)
        for prefix, router in v1_routes:
            app.include_router(router, prefix=prefix)
    """
    
    routes = [
        ("/api/v1/ai", ai_router),
        ("/api/v1", analyze_router),  # /api/v1/analyze, /api/v1/jobs, etc.
        ("/api/v1/factory", factory_router),
        ("/api/v1/design", code_router),
        ("/api/v1/compliance", compliance_router),
        ("/api/v1/concrete", concrete_router),
        ("/api/v1/jobs", jobs_router),
        ("/api/v1/reports", reports_router),
        ("/api/v1/health", health_router),  # /api/v1/health/* endpoints
    ]
    
    return routes
