"""
main.py - FastAPI Entry Point

REST API for structural model generation.
"""

# Structured logging — must be imported FIRST so all modules get the config
from logging_config import setup_logging, get_logger
setup_logging()
logger = get_logger(__name__)

# Load environment variables from .env file (if it exists - for local dev only)
try:
    from dotenv import load_dotenv
    load_dotenv(override=False)  # Don't override Azure app settings
except Exception as e:
    logger.warning("dotenv not available or failed: %s", e)

from fastapi import FastAPI
from contextlib import asynccontextmanager
import os

# ── Sentry Error Monitoring ──────────────────────────────────────────────────
try:
    import sentry_sdk
    _sentry_dsn = os.getenv("SENTRY_DSN", "").strip().strip('"').strip("'")
    if _sentry_dsn:
        try:
            sentry_sdk.init(
                dsn=_sentry_dsn,
                environment=os.getenv("ENVIRONMENT", "development"),
                traces_sample_rate=0.2,
                send_default_pii=False,
            )
            logger.info("Sentry initialized for Python backend")
        except Exception as sentry_error:
            logger.warning("Sentry disabled due to invalid SENTRY_DSN/config: %s", sentry_error)
    else:
        logger.info("SENTRY_DSN not set — Sentry disabled")
except ImportError:
    logger.info("sentry-sdk not installed — Sentry disabled")

# ── Application Configuration ──
from app_configuration import load_app_config, build_cors_origins

# Security middleware — rate limiting, auth verification, security headers
try:
    from security_middleware import RateLimitMiddleware, AuthMiddleware, SecurityHeadersMiddleware
    HAS_SECURITY_MW = True
except ImportError as e:
    IS_PRODUCTION = os.getenv("ENVIRONMENT", "development").lower() == "production"
    if IS_PRODUCTION:
        raise RuntimeError(f"FATAL: security_middleware must load in production: {e}") from e
    logger.warning("Could not import security_middleware: %s", e)
    HAS_SECURITY_MW = False

# Wrap imports in try-except to handle missing packages gracefully
try:
    from models import (
        StructuralModel, GenerateResponse,
        ContinuousBeamRequest, TrussRequest, FrameRequest
    )
    HAS_MODELS = True
except ImportError as e:
    logger.warning("Could not import models: %s", e)
    HAS_MODELS = False

try:
    from factory import StructuralFactory
    HAS_FACTORY = True
except ImportError as e:
    logger.warning("Could not import factory: %s", e)
    HAS_FACTORY = False

try:
    from ai_routes import router as ai_router
    HAS_AI_ROUTES = True
except ImportError as e:
    logger.warning("Could not import ai_routes: %s", e)
    HAS_AI_ROUTES = False

try:
    from analysis.report_generator import ReportGenerator, ReportSettings
    HAS_REPORT_GEN = True
except ImportError as e:
    logger.warning("Could not import report_generator: %s", e)
    HAS_REPORT_GEN = False





# ============================================
# FASTAPI APP INITIALIZATION
# ============================================

# ============================================
# LIFESPAN (replaces deprecated on_event)
# ============================================

@asynccontextmanager
async def lifespan(application: FastAPI):
    """Startup/shutdown lifecycle for FastAPI."""
    from lifecycle import startup_event as _startup_event, shutdown_event as _shutdown_event

    # ── Module validation ──
    missing_critical = []
    if not HAS_MODELS:
        missing_critical.append("models")
    if not HAS_FACTORY:
        missing_critical.append("factory")
    if not HAS_SECURITY_MW:
        logger.warning("Security middleware not loaded — running without auth/rate-limiting")
    if missing_critical:
        logger.error("Critical modules failed to load: %s — API will have reduced functionality", missing_critical)

    # ── Startup ──
    try:
        await _startup_event(logger)

        # TEMPORARY DISABLE: Worker pool startup hangs on production
        # from analysis.worker_pool import get_worker_pool
        # pool = await get_worker_pool()
        # logger.info("Worker pool started", extra={"max_workers": pool.max_workers})
        logger.info("Worker pool initialization DISABLED for diagnostics")
    except Exception as e:
        logger.warning("Startup error: %s", e)

    yield  # ── App is running ──

    # ── Shutdown ──
    try:
        from analysis.worker_pool import shutdown_worker_pool as _shutdown
        await _shutdown()
        logger.info("Worker pool stopped")

        await _shutdown_event(logger)
    except Exception as e:
        logger.error("Worker pool shutdown error: %s", e)


app = FastAPI(
    title="BeamLab Structural Engine",
    description="Python backend for mathematical structural model generation",
    version="2.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Get configuration with fallbacks
config = load_app_config()
config["allow_origins"] = build_cors_origins(config)


# ============================================
# MIDDLEWARE & ERROR HANDLING SETUP
# ============================================

from middleware_setup import setup_middleware
from error_handlers import setup_error_handlers
from health_endpoints import register_health_endpoints
from routers_setup import register_routers

setup_middleware(app, config, HAS_SECURITY_MW)
setup_error_handlers(app, config["is_production"])
register_health_endpoints(
    app,
    has_models=HAS_MODELS,
    has_factory=HAS_FACTORY,
    has_ai_routes=HAS_AI_ROUTES,
    has_report_gen=HAS_REPORT_GEN,
    node_api_url=config["node_api_url"],
    rust_api_url=config["rust_api_url"],
)

# ============================================
# ROUTER REGISTRATION
# ============================================

register_routers(app, has_ai_routes=HAS_AI_ROUTES)



if __name__ == "__main__":
    import uvicorn
    print(f"\n🚀 Starting BeamLab Structural Engine")
    print(f"📋 USE_MOCK_AI: {os.getenv('USE_MOCK_AI', 'not set')}")
    print(f"🔑 GEMINI_API_KEY: {'SET' if os.getenv('GEMINI_API_KEY') else 'NOT SET'}\n")

    # Azure App Service sets PORT env var (default 8000)
    port = int(os.getenv("PORT", 8000))
    print(f"🔌 Binding to port: {port}")

    uvicorn.run(app, host="0.0.0.0", port=port)
