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


def _is_enabled(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _v1_prefix(prefix: str) -> str:
    normalized = prefix if prefix.startswith("/") else f"/{prefix}"
    if normalized.startswith("/api/"):
        return normalized.replace("/api/", "/api/v1/", 1)
    if normalized == "/api":
        return "/api/v1"
    return f"/api/v1{normalized}"


def _include_router_with_optional_v1(
    app: FastAPI,
    router,
    *,
    enable_v1: bool,
    prefix: str = "",
    tags=None,
):
    kwargs = {}
    if prefix:
        kwargs["prefix"] = prefix
    if tags:
        kwargs["tags"] = tags
    app.include_router(router, **kwargs)

    if not enable_v1:
        return

    if prefix:
        app.include_router(router, prefix=_v1_prefix(prefix), tags=tags)
    else:
        app.include_router(router, prefix="/api/v1", tags=tags)


def register_routers(app: FastAPI, has_ai_routes: bool):
    """
    Register all API routers with the FastAPI application.
    
    Args:
        app: FastAPI application instance.
        has_ai_routes: Whether AI routes module is available.
    """

    enable_v1_routes = _is_enabled(os.getenv("ENABLE_V1_ROUTES", "false"))
    if enable_v1_routes:
        logger.info("Versioned routes enabled: mounting /api/v1 alongside legacy routes")

    # ── AI Routes ──
    if has_ai_routes:
        try:
            from ai_routes import router as ai_router
            _include_router_with_optional_v1(app, ai_router, enable_v1=enable_v1_routes)
            logger.info("AI routes registered")
        except ImportError as e:
            logger.warning("AI routes NOT available (import failed): %s", e)
    else:
        logger.warning("AI routes NOT available (import failed)")

    # ── PINN Solver Routes (Physics-Informed Neural Networks) ──
    try:
        from pinn_routes import router as pinn_router
        _include_router_with_optional_v1(
            app,
            pinn_router,
            enable_v1=enable_v1_routes,
            prefix="/pinn",
            tags=["PINN Solver"],
        )
        logger.info("PINN solver routes registered at /pinn/*")
    except ImportError as e:
        logger.warning("PINN solver not available (install jax): %s", e)

    # ── WebSocket Routes (Real-time Collaboration) ──
    try:
        from ws_routes import router as ws_router
        _include_router_with_optional_v1(
            app,
            ws_router,
            enable_v1=enable_v1_routes,
            tags=["Collaboration"],
        )
        logger.info("WebSocket routes registered at /ws/*")
    except ImportError as e:
        logger.warning("WebSocket routes not available: %s", e)

    # ── Database Routes ──
    is_production = os.getenv("ENVIRONMENT", "development").lower() == "production"
    default_flag = "false" if is_production else "true"
    sqlite_routes_enabled = _is_enabled(os.getenv("ENABLE_SQLITE_DB_ROUTES", default_flag))

    if sqlite_routes_enabled:
        try:
            from db_routes import router as db_router

            _include_router_with_optional_v1(
                app,
                db_router,
                enable_v1=enable_v1_routes,
                prefix="/db",
                tags=["Database"],
            )
            logger.info("Database routes registered at /db/*")
        except ImportError as e:
            logger.warning("Database routes not available: %s", e)
    else:
        logger.warning(
            "SQLite-backed database routes are disabled (ENABLE_SQLITE_DB_ROUTES=false)",
        )

    # ── Internal Router Modules (split from monolith) ──
    try:
        from design_routes import router as legacy_design_router
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

        # Legacy concrete endpoint compatibility used by existing tests/clients.
        _include_router_with_optional_v1(app, legacy_design_router, enable_v1=enable_v1_routes)
        _include_router_with_optional_v1(app, jobs_router, enable_v1=enable_v1_routes)
        _include_router_with_optional_v1(app, meshing_router, enable_v1=enable_v1_routes)
        _include_router_with_optional_v1(app, analysis_router_internal, enable_v1=enable_v1_routes)
        _include_router_with_optional_v1(app, stress_router, enable_v1=enable_v1_routes)
        _include_router_with_optional_v1(app, sections_router, enable_v1=enable_v1_routes)
        _include_router_with_optional_v1(app, reports_router, enable_v1=enable_v1_routes)
        _include_router_with_optional_v1(app, ai_gen_router, enable_v1=enable_v1_routes)
        _include_router_with_optional_v1(app, design_router, enable_v1=enable_v1_routes)
        _include_router_with_optional_v1(app, load_gen_router, enable_v1=enable_v1_routes)
        _include_router_with_optional_v1(app, is_code_router, enable_v1=enable_v1_routes)
        _include_router_with_optional_v1(app, layout_router, enable_v1=enable_v1_routes)
        _include_router_with_optional_v1(app, layout_v2_router, enable_v1=enable_v1_routes)
        _include_router_with_optional_v1(app, validation_router, enable_v1=enable_v1_routes)

        logger.info(
            "Internal routers registered: legacy_design, jobs, meshing, analysis, stress, sections, reports, "
            "ai, design, load_gen, is_codes, layout, layout_v2, validation"
        )
    except ImportError as e:
        logger.error("Failed to load internal routers: %s", e)
        raise
