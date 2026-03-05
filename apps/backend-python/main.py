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

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Optional, List, Dict
import os
import asyncio
import importlib
import importlib.util
from contextlib import asynccontextmanager
from request_logging import RequestLoggingMiddleware

# Security middleware — rate limiting, auth verification, security headers
try:
    from security_middleware import RateLimitMiddleware, AuthMiddleware, SecurityHeadersMiddleware
    HAS_SECURITY_MW = True
except ImportError as e:
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
# ENVIRONMENT CONFIGURATION WITH FALLBACKS
# ============================================

def get_env(key: str, default: str = "") -> str:
    """Get environment variable with intelligent fallback"""
    value = os.getenv(key, "").strip()
    
    # If not set in environment, use defaults
    if not value:
        if key == 'USE_MOCK_AI':
            value = 'true'  # Default to mock AI
            logger.info("ENV %s: Using default (MOCK AI MODE)", key)
        elif key == 'GEMINI_API_KEY':
            value = 'mock-key-local-dev'
            logger.info("ENV %s: Not configured, using mock mode", key)
        elif key == 'FRONTEND_URL':
            value = 'http://localhost:5173'
            logger.info("ENV %s: Not configured, defaulting to %s", key, value)
        elif key == 'ALLOWED_ORIGINS':
            value = 'http://localhost:5173,http://localhost:3001,http://127.0.0.1:5173'
            logger.info("ENV %s: Not configured, using localhost origins", key)
    
    return value or default


# ============================================
# FASTAPI APP INITIALIZATION
# ============================================

# ============================================
# LIFESPAN (replaces deprecated on_event)
# ============================================

@asynccontextmanager
async def lifespan(application: FastAPI):
    """Startup/shutdown lifecycle for FastAPI."""
    # ── Startup ──
    try:
        from analysis.worker_pool import get_worker_pool
        pool = await get_worker_pool()
        logger.info("Worker pool started", extra={"max_workers": pool.max_workers})
    except Exception as e:
        logger.warning("Worker pool not available: %s", e)

    yield  # ── App is running ──

    # ── Shutdown ──
    try:
        from analysis.worker_pool import shutdown_worker_pool as _shutdown
        await _shutdown()
        logger.info("Worker pool stopped")
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
GEMINI_API_KEY = get_env('GEMINI_API_KEY', 'mock-key-local-dev')
USE_MOCK_AI = get_env('USE_MOCK_AI', 'true').lower() in ('true', '1', 'yes')
FRONTEND_URL = get_env('FRONTEND_URL', 'http://localhost:5173')
ALLOWED_ORIGINS_ENV = get_env('ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:3001')
NODE_API_URL = get_env('NODE_API_URL', 'http://localhost:3001')
RUST_API_URL = get_env('RUST_API_URL', 'http://localhost:3002')

# Structured startup log
logger.info(
    "BeamLab Backend initializing",
    extra={
        "gemini_configured": bool(GEMINI_API_KEY and GEMINI_API_KEY != 'mock-key-local-dev'),
        "use_mock_ai": USE_MOCK_AI,
        "frontend_url": FRONTEND_URL,
        "environment": 'LOCAL/MOCK' if USE_MOCK_AI else 'PRODUCTION',
        "components": {
            "models": HAS_MODELS,
            "factory": HAS_FACTORY,
            "ai_routes": HAS_AI_ROUTES,
            "report_generator": HAS_REPORT_GEN,
        },
    },
)

# ============================================
# CORS CONFIGURATION
# ============================================

# Build allowed origins list
allow_origins = [
    # Production
    "https://beamlabultimate.tech",
    "https://beamlabultimate.tech/",
    "https://www.beamlabultimate.tech",
    "https://www.beamlabultimate.tech/",
    "https://brave-mushroom-0eae8ec00.4.azurestaticapps.net",
    "https://brave-mushroom-0eae8ec00.4.azurestaticapps.net/",
    "https://beamlab-backend-python.azurewebsites.net",
    "https://beamlab-backend-node.azurewebsites.net",
    # Local development
    "http://localhost:3001",
    "http://localhost:5173",
    "http://localhost:8000",
    "http://localhost:8081",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8081",
]

# Add origins from environment variables
if ALLOWED_ORIGINS_ENV:
    env_origins = [origin.strip() for origin in ALLOWED_ORIGINS_ENV.split(",") if origin.strip()]
    allow_origins.extend(env_origins)

if FRONTEND_URL:
    allow_origins.append(FRONTEND_URL)

# Remove duplicates
allow_origins = sorted({origin.strip().rstrip("/") for origin in allow_origins if origin and origin.strip()})

logger.info(
    "CORS configured",
    extra={"allowed_origin_count": len(allow_origins), "origins": sorted(allow_origins)},
)

# Request logging middleware (added BEFORE CORS so it wraps everything)
app.add_middleware(RequestLoggingMiddleware)

# CORS Middleware - use configured origins for security
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,  # Use the curated allow list
    allow_credentials=True,  # Allow credentials with specific origins
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
    expose_headers=["X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
)

# Security middleware stack (order matters — outermost middleware runs first)
if HAS_SECURITY_MW:
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(AuthMiddleware)
    app.add_middleware(RateLimitMiddleware)
    logger.info("Security middleware active: rate limiting, auth verification, security headers")


# ============================================
# REQUEST BODY SIZE LIMIT
# ============================================
# Prevent memory exhaustion from oversized payloads.
# Default: 10 MB. Analysis endpoints that genuinely need larger
# payloads should use streaming or chunked uploads instead.
MAX_BODY_SIZE_BYTES = int(os.getenv("MAX_REQUEST_BODY_MB", "10")) * 1024 * 1024

class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    """Reject requests with Content-Length exceeding the configured limit."""

    async def dispatch(self, request, call_next):
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > MAX_BODY_SIZE_BYTES:
                    return JSONResponse(
                        status_code=413,
                        content={"success": False, "error": f"Request body too large (max {MAX_BODY_SIZE_BYTES // (1024*1024)} MB)"},
                    )
            except (ValueError, TypeError):
                pass  # Non-numeric Content-Length — let downstream handle it
        return await call_next(request)

app.add_middleware(BodySizeLimitMiddleware)


# ============================================
# PRODUCTION ERROR SANITIZATION
# ============================================

IS_PRODUCTION = os.getenv("ENVIRONMENT", "development").lower() in ("production", "prod")

from starlette.requests import Request

@app.exception_handler(HTTPException)
async def sanitized_http_exception_handler(request: Request, exc: HTTPException):
    """Strip internal error details from 500 responses in production."""
    if IS_PRODUCTION and exc.status_code >= 500:
        logger.error("Internal error on %s %s: %s", request.method, request.url.path, exc.detail)
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": "Internal server error. Please try again later."},
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Catch-all for unhandled exceptions — never leak stack traces."""
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    if IS_PRODUCTION:
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error. Please try again later."},
        )
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
    )


# ============================================
# HEALTH CHECK ENDPOINTS
# ============================================

@app.get("/", tags=["Health"])
async def root():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "BeamLab Structural Engine",
        "version": "2.1.0",
        "components": {
            "models": "ok" if HAS_MODELS else "degraded",
            "factory": "ok" if HAS_FACTORY else "degraded",
            "ai_routes": "ok" if HAS_AI_ROUTES else "degraded",
            "report_generator": "ok" if HAS_REPORT_GEN else "degraded"
        }
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Detailed health check."""
    return {
        "status": "ok",
        "templates_available": [
            "beam", "continuous_beam", "truss", "pratt_truss", 
            "frame", "3d_frame", "portal"
        ]
    }


@app.get("/health/dependencies", tags=["Health"])
async def health_dependencies():
    """Check connectivity to dependent backend services (Node + Rust)."""
    if importlib.util.find_spec("httpx") is None:
        return {
            "status": "degraded",
            "python": "ok",
            "node": "unknown",
            "rust": "unknown",
            "error": "httpx not installed"
        }

    httpx = importlib.import_module("httpx")

    async def check_service(name: str, base_url: str):
        url = f"{base_url.rstrip('/')}/health"
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                response = await client.get(url)
                return {
                    "name": name,
                    "url": url,
                    "ok": response.status_code == 200,
                    "status_code": response.status_code,
                }
        except Exception as e:
            return {
                "name": name,
                "url": url,
                "ok": False,
                "error": str(e),
            }

    node_result, rust_result = await asyncio.gather(
        check_service("node", NODE_API_URL),
        check_service("rust", RUST_API_URL),
    )

    overall_ok = node_result.get("ok") and rust_result.get("ok")
    return {
        "status": "ok" if overall_ok else "degraded",
        "python": "ok",
        "node": "ok" if node_result.get("ok") else "unhealthy",
        "rust": "ok" if rust_result.get("ok") else "unhealthy",
        "services": {
            "node": node_result,
            "rust": rust_result,
        }
    }


# ============================================
# ROUTER REGISTRATION
# ============================================

if HAS_AI_ROUTES:
    app.include_router(ai_router)
    logger.info("AI routes registered")
else:
    logger.warning("AI routes NOT available (import failed)")

# Analysis Routes (Spectrum, Buckling, Time-History, Dynamic Analysis)
try:
    from analysis_routes import router as analysis_router
    app.include_router(analysis_router, prefix="/analyze", tags=["Analysis"])
    logger.info("Analysis routes registered at /analyze/*")
except ImportError as e:
    logger.warning("Analysis routes not available: %s", e)

# Design Routes (Concrete, Steel, Connections, Foundations)
try:
    from design_routes import router as design_router
    app.include_router(design_router, prefix="/design", tags=["Design"])
    logger.info("Design routes registered at /design/*")
except ImportError as e:
    logger.warning("Design routes not available: %s", e)

# PINN Solver Routes (Physics-Informed Neural Networks)
try:
    from pinn_routes import router as pinn_router
    app.include_router(pinn_router, prefix="/pinn", tags=["PINN Solver"])
    logger.info("PINN solver routes registered at /pinn/*")
except ImportError as e:
    logger.warning("PINN solver not available (install jax): %s", e)

# Project Persistence → CANONICAL OWNER: Node.js API + MongoDB
# Removed: JSON flat-file project storage (duplicated Node.js MongoDB project CRUD)
# All project CRUD now lives in apps/api/src/routes/ backed by MongoDB

# Real-time Collaboration Routes (Phase 4.2)
try:
    from ws_routes import router as ws_router
    app.include_router(ws_router, tags=["Collaboration"])
    logger.info("WebSocket routes registered at /ws/*")
except ImportError as e:
    logger.warning("WebSocket routes not available: %s", e)

# Database Persistence Routes (Critical Analysis Fix)
try:
    from db_routes import router as db_router
    app.include_router(db_router, prefix="/db", tags=["Database"])
    logger.info("Database routes registered at /db/*")
except ImportError as e:
    logger.warning("Database routes not available: %s", e)


# ============================================
# INTERNAL ROUTER MODULES (split from monolith)
# ============================================

from routers.jobs import router as jobs_router
from routers.meshing import router as meshing_router
from routers.analysis import router as analysis_router_internal
from routers.stress_dynamic import router as stress_dynamic_router
from routers.sections import router as sections_router
from routers.reports import router as reports_router
from routers.ai_endpoints import router as ai_gen_router
from routers.design import router as design_int_router
from routers.load_gen import router as load_gen_router
from routers.is_code_checks import router as is_code_router
from routers.layout import router as layout_router
from routers.layout_v2 import router as layout_v2_router

app.include_router(jobs_router)
app.include_router(meshing_router)
app.include_router(analysis_router_internal)
app.include_router(stress_dynamic_router)
app.include_router(sections_router)
app.include_router(reports_router)
app.include_router(ai_gen_router)
app.include_router(design_int_router)
app.include_router(load_gen_router)
app.include_router(is_code_router)
app.include_router(layout_router)
app.include_router(layout_v2_router)

logger.info("Internal routers registered: jobs, meshing, analysis, stress_dynamic, sections, reports, ai, design, load_gen, is_codes, layout, layout_v2")


# ── Model validation (uses StructuralModel from models.py) ──

@app.post("/validate", tags=["Validation"])
async def validate_model_endpoint(model: "StructuralModel"):
    """Validate a structural model for common issues."""
    issues = []
    node_ids = {n.id for n in model.nodes}
    for member in model.members:
        if member.start_node not in node_ids:
            issues.append(f"Member {member.id}: Invalid start node {member.start_node}")
        if member.end_node not in node_ids:
            issues.append(f"Member {member.id}: Invalid end node {member.end_node}")
    supports = [n for n in model.nodes if n.support and n.support.value != "NONE"]
    if len(supports) == 0:
        issues.append("No supports defined - structure is unstable")
    return {
        "valid": len(issues) == 0, "issues": issues,
        "node_count": len(model.nodes), "member_count": len(model.members),
        "support_count": len(supports)
    }


# ============================================
# MAIN ENTRY POINT
# ============================================

if __name__ == "__main__":
    import uvicorn
    print(f"\n🚀 Starting BeamLab Structural Engine")
    print(f"📋 USE_MOCK_AI: {os.getenv('USE_MOCK_AI', 'not set')}")
    print(f"🔑 GEMINI_API_KEY: {'SET' if os.getenv('GEMINI_API_KEY') else 'NOT SET'}\n")

    # Azure App Service sets PORT env var (default 8000)
    port = int(os.getenv("PORT", 8000))
    print(f"🔌 Binding to port: {port}")

    uvicorn.run(app, host="0.0.0.0", port=port)
