"""
Router registration and setup.

Registers all API routers (internal, AI, PINN, WebSocket, database).

Phase 1 (Current): All routes are unversioned (deprecated via HTTP headers, see ADR-009)
Phase 2 (Week 5–12): Routes will also be registered under /api/v1/* prefix
Phase 3 (June 30): Unversioned routes will be removed; only /api/v1/* will remain

To enable /api/v1 routes during Phase 2:
- Set environment variable ENABLE_V1_ROUTES=true
- Each include_router() call will also register the router under /api/v1/ prefix
- Unversioned routes will remain active during the 6-month deprecation window
"""

from fastapi import FastAPI
from logging_config import get_logger
import os

logger = get_logger(__name__)


def register_routers(app: FastAPI, has_ai_routes: bool):
    """
    Register all API routers with the FastAPI application.
    
    Args:
        app: FastAPI application instance.
        has_ai_routes: Whether AI routes module is available.
    """

    # ── AI Routes ──
    if has_ai_routes:
        try:
            from ai_routes import router as ai_router
            app.include_router(ai_router)
            logger.info("AI routes registered")
        except ImportError as e:
            logger.warning("AI routes NOT available (import failed): %s", e)
    else:
        logger.warning("AI routes NOT available (import failed)")

    # ── PINN Solver Routes (Physics-Informed Neural Networks) ──
    try:
        from pinn_routes import router as pinn_router
        app.include_router(pinn_router, prefix="/pinn", tags=["PINN Solver"])
        logger.info("PINN solver routes registered at /pinn/*")
    except ImportError as e:
        logger.warning("PINN solver not available (install jax): %s", e)

    # ── WebSocket Routes (Real-time Collaboration) ──
    try:
        from ws_routes import router as ws_router
        app.include_router(ws_router, tags=["Collaboration"])
        logger.info("WebSocket routes registered at /ws/*")
    except ImportError as e:
        logger.warning("WebSocket routes not available: %s", e)

    # ── Database Routes ──
    try:
        from db_routes import router as db_router
        app.include_router(db_router, prefix="/db", tags=["Database"])
        logger.info("Database routes registered at /db/*")
    except ImportError as e:
        logger.warning("Database routes not available: %s", e)

    # ── Internal Router Modules (split from monolith) ──
    try:
        from routers.jobs import router as jobs_router
        from routers.meshing import router as meshing_router
        from routers.analysis_router import router as analysis_router_internal
        from routers.stress_router_bundle import router as stress_router
        from routers.sections import router as sections_router
        from routers.reports_router_bundle import router as reports_router
        from routers.ai_endpoints import router as ai_gen_router
        from routers.design_router_bundle import router as design_router
        from routers.load_gen import router as load_gen_router
        from routers.is_code_checks import router as is_code_router
        from routers.layout import router as layout_router
        from routers.layout_v2_router_bundle import router as layout_v2_router
        from routers.validation_router import router as validation_router

        app.include_router(jobs_router)
        app.include_router(meshing_router)
        app.include_router(analysis_router_internal)
        app.include_router(stress_router)
        app.include_router(sections_router)
        app.include_router(reports_router)
        app.include_router(ai_gen_router)
        app.include_router(design_router)
        app.include_router(load_gen_router)
        app.include_router(is_code_router)
        app.include_router(layout_router)
        app.include_router(layout_v2_router)
        app.include_router(validation_router)

        logger.info(
            "Internal routers registered: jobs, meshing, analysis, stress, sections, reports, "
            "ai, design, load_gen, is_codes, layout, layout_v2, validation"
        )
    except ImportError as e:
        logger.error("Failed to load internal routers: %s", e)
        raise
