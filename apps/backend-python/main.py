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

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
import os
from datetime import datetime
import asyncio
import importlib
import importlib.util
import traceback
import json
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

import base64



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

# CORS Middleware - use specific origins to allow credentials
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,  # Specific origins, not wildcard
    allow_origin_regex=r"https://([a-z0-9-]+\.)*beamlabultimate\.tech",
    allow_credentials=True,  # Allow cookies/auth headers
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Request-ID", "X-CSRF-Token", "Cache-Control", "sentry-trace", "baggage"],
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
# JOB QUEUE API ENDPOINTS
# ============================================

class JobSubmitRequest(BaseModel):
    job_type: str  # "static", "modal", "pdelta", "buckling", "spectrum"
    priority: Optional[str] = "normal"
    user_id: Optional[str] = None
    input: Dict

@app.post("/api/jobs/submit", tags=["Jobs"])
async def submit_analysis_job(req: JobSubmitRequest):
    """Submit a long-running analysis job to the worker pool"""
    try:
        from analysis.worker_pool import get_worker_pool, JobPriority
        pool = await get_worker_pool()
        priority_map = {
            "urgent": JobPriority.URGENT,
            "high": JobPriority.HIGH,
            "normal": JobPriority.NORMAL,
            "low": JobPriority.LOW,
            "batch": JobPriority.BATCH,
        }
        priority = priority_map.get(req.priority or "normal", JobPriority.NORMAL)
        job_id = await pool.submit(req.job_type, req.input, priority, req.user_id)
        return {"success": True, "job_id": job_id, "message": f"Job queued as {req.priority}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/jobs/{job_id}", tags=["Jobs"])
async def get_job_status(job_id: str):
    """Get status of an analysis job"""
    try:
        from analysis.worker_pool import get_worker_pool
        pool = await get_worker_pool()
        job = pool.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return {
            "job_id": job.id,
            "status": job.status.value,
            "job_type": job.job_type,
            "progress": {
                "percent": job.progress.percent,
                "stage": job.progress.stage,
                "message": job.progress.message,
            },
            "result": job.result,
            "error": job.error,
            "created_at": job.created_at,
            "started_at": job.started_at,
            "completed_at": job.completed_at,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/jobs/{job_id}", tags=["Jobs"])
async def cancel_analysis_job(job_id: str):
    """Cancel a queued analysis job"""
    try:
        from analysis.worker_pool import get_worker_pool
        pool = await get_worker_pool()
        cancelled = pool.cancel_job(job_id)
        return {"success": cancelled, "job_id": job_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/jobs/queue/status", tags=["Jobs"])
async def get_queue_status():
    """Get worker queue statistics"""
    try:
        from analysis.worker_pool import get_worker_pool
        pool = await get_worker_pool()
        return pool.get_queue_status()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class MeshPlateRequest(BaseModel):
    corners: List[Dict[str, float]]  # [{x, y, z}, ...]
    nx: int
    ny: int
    hard_points: Optional[List[Dict[str, float]]] = None

class TriangulateRequest(BaseModel):
    boundary: List[Dict[str, float]]  # [{x, y}, ...]
    holes: Optional[List[List[Dict[str, float]]]] = None

@app.post("/mesh/plate", tags=["Meshing"])
async def mesh_plate_endpoint(request: MeshPlateRequest):
    """
    Mesh a quadrilateral plate into N×M elements.
    
    Supports hard point constraints for beam node snapping.
    """
    try:
        from meshing import mesh_plate
        
        corners = [(c["x"], c["y"], c.get("z", 0)) for c in request.corners]
        hard_pts = None
        if request.hard_points:
            hard_pts = [(p["x"], p["y"], p.get("z", 0)) for p in request.hard_points]
        
        result = mesh_plate(corners, request.nx, request.ny, hard_pts)
        return {"success": True, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/mesh/triangulate", tags=["Meshing"])
async def triangulate_endpoint(request: TriangulateRequest):
    """
    Constrained Delaunay Triangulation with hole support.
    
    - boundary: CCW polygon vertices
    - holes: List of CW hole polygons
    """
    try:
        from meshing import triangulate_with_holes
        
        boundary = [(p["x"], p["y"]) for p in request.boundary]
        holes = None
        if request.holes:
            holes = [[(p["x"], p["y"]) for p in hole] for hole in request.holes]
        
        result = triangulate_with_holes(boundary, holes)
        return {"success": True, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# BEAM ANALYSIS ENDPOINT (with hand calculations)
# ============================================

from pydantic import BaseModel
from typing import List as ListType, Dict, Any

class BeamLoadInput(BaseModel):
    type: str  # "point", "udl", "uvl"
    magnitude: float
    position: float
    end_position: Optional[float] = None
    end_magnitude: Optional[float] = None

class BeamAnalysisRequest(BaseModel):
    length: float
    loads: ListType[BeamLoadInput]
    E: Optional[float] = 200e6
    I: Optional[float] = 1e-4

@app.post("/analyze/beam", tags=["Analysis"])
async def analyze_beam(request: BeamAnalysisRequest):
    """
    Analyze a simply supported beam with various loads.
    
    Returns:
    - Hand calculation steps (for educational display)
    - 100 data points for SFD/BMD diagrams
    - Maximum values and their locations
    """
    try:
        from analysis.solver import (
            BeamSolver, BeamAnalysisInput, Load, LoadType, Support
        )
        
        # Convert request loads to solver format
        loads = []
        for load in request.loads:
            load_type = {
                "point": LoadType.POINT,
                "udl": LoadType.UDL,
                "uvl": LoadType.UVL
            }.get(load.type.lower(), LoadType.POINT)
            
            loads.append(Load(
                type=load_type,
                magnitude=load.magnitude,
                position=load.position,
                end_position=load.end_position,
                end_magnitude=load.end_magnitude
            ))
        
        # Create beam input
        beam_input = BeamAnalysisInput(
            length=request.length,
            loads=loads,
            supports=[
                Support(position=0, type="pinned"),
                Support(position=request.length, type="roller")
            ],
            E=request.E or 200e6,
            I=request.I or 1e-4
        )
        
        # Solve
        solver = BeamSolver(beam_input)
        result = solver.solve()
        
        return {
            "success": result.success,
            "result": {
                "max_moment": result.max_moment,
                "max_shear": result.max_shear,
                "max_deflection": result.max_deflection,
                "max_moment_location": result.max_moment_location,
                "max_shear_location": result.max_shear_location,
                "reactions": result.reactions
            },
            "steps": result.steps,
            "diagram": {
                "x_values": result.diagram.x_values,
                "shear_values": result.diagram.shear_values,
                "moment_values": result.diagram.moment_values,
                "deflection_values": result.diagram.deflection_values
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# 3D FRAME ANALYSIS ENDPOINT (PyNite FEA)
# ============================================

class FrameNodeInput(BaseModel):
    id: str
    x: float
    y: float
    z: float
    support: Optional[str] = "none"

class FrameMemberInput(BaseModel):
    id: str
    startNodeId: str
    endNodeId: str
    E: Optional[float] = 200e6
    G: Optional[float] = 77e6
    Iy: Optional[float] = 1e-4
    Iz: Optional[float] = 1e-4
    J: Optional[float] = 1e-5
    A: Optional[float] = 0.01

class NodeLoadInput(BaseModel):
    nodeId: str
    fx: Optional[float] = 0
    fy: Optional[float] = 0
    fz: Optional[float] = 0
    mx: Optional[float] = 0
    my: Optional[float] = 0
    mz: Optional[float] = 0


class FramePlateInput(BaseModel):
    id: str
    nodeIds: ListType[str]
    thickness: float
    E: Optional[float] = 200e6
    nu: Optional[float] = 0.3
    pressure: Optional[float] = 0.0

class MemberDistLoadInput(BaseModel):
    """Distributed load on a frame member"""
    memberId: str
    direction: str = "Fy"  # Fx, Fy, Fz for local axes
    w1: float = 0  # Start value (kN/m)
    w2: Optional[float] = None  # End value for trapezoidal (defaults to w1)
    x1: Optional[float] = 0  # Start position (0-1 fraction)
    x2: Optional[float] = 1  # End position (0-1 fraction)
    isRatio: Optional[bool] = True  # True if x1/x2 are ratios (0-1), False if absolute positions
    case: str = "D"  # Load case

class FrameAnalysisRequest(BaseModel):
    nodes: ListType[FrameNodeInput]
    members: ListType[FrameMemberInput]
    plates: Optional[ListType[FramePlateInput]] = []
    node_loads: Optional[ListType[NodeLoadInput]] = []
    distributed_loads: Optional[ListType[MemberDistLoadInput]] = []

@app.post("/analyze/frame", tags=["Analysis"])
async def analyze_3d_frame(request: FrameAnalysisRequest):
    """
    Analyze a 3D frame structure using PyNite FEA.
    
    Returns:
    - Node displacements and reactions
    - Member forces at 100 points (shear, moment, axial, torsion)
    - Deflection arrays
    """
    import traceback
    
    try:
        from analysis.fea_engine import analyze_frame
        
        logger.info(
            "FEA analysis request received",
            extra={"nodes": len(request.nodes), "members": len(request.members), "plates": len(request.plates)},
        )
        
        # Convert to dict format
        model_dict = {
            "nodes": [
                {
                    "id": n.id,
                    "x": n.x,
                    "y": n.y,
                    "z": n.z,
                    "support": n.support or "none"
                }
                for n in request.nodes
            ],
            "members": [
                {
                    "id": m.id,
                    "startNodeId": m.startNodeId,
                    "endNodeId": m.endNodeId,
                    "E": m.E or 200e6,
                    "G": m.G or 77e6,
                    "Iy": m.Iy or 1e-4,
                    "Iz": m.Iz or 1e-4,
                    "J": m.J or 1e-5,
                    "A": m.A or 0.01
                }
                for m in request.members
            ],
            "plates": [
                {
                    "id": p.id,
                    "node_ids": p.nodeIds,
                    "thickness": p.thickness,
                    "E": p.E or 200e6,
                    "nu": p.nu or 0.3,
                    "pressure": p.pressure or 0.0
                }
                for p in (request.plates or [])
            ],
            "node_loads": [
                {
                    "nodeId": l.nodeId,
                    "fx": l.fx or 0,
                    "fy": l.fy or 0,
                    "fz": l.fz or 0,
                    "mx": l.mx or 0,
                    "my": l.my or 0,
                    "mz": l.mz or 0
                }
                for l in (request.node_loads or [])
            ],
            "distributed_loads": [
                {
                    "memberId": l.memberId,
                    "direction": l.direction or "Fy",
                    "w1": l.w1,
                    "w2": l.w2 if l.w2 is not None else l.w1,
                    "startPos": l.x1 or 0,
                    "endPos": l.x2 or 1,
                    "isRatio": l.isRatio if l.isRatio is not None else True
                }
                for l in (request.distributed_loads or [])
            ]
        }
        
        logger.info("FEA running analysis")
        
        # Run analysis
        result = analyze_frame(model_dict)
        
        if not result['success']:
            error_msg = result.get('error', 'Analysis failed')
            logger.warning("FEA analysis returned error", extra={"error": error_msg})
            raise HTTPException(status_code=400, detail=error_msg)
        
        logger.info("FEA analysis successful", extra={"max_moment": result.get('max_moment', 0)})
        return result
        
    except ImportError as e:
        logger.error("FEA ImportError: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"PyNiteFEA import error: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("FEA Exception: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")


# ============================================
# LARGE MODEL ANALYSIS ENDPOINT (High-Performance Sparse)
# ============================================

class LargeFrameAnalysisRequest(BaseModel):
    """Request for large model analysis using sparse solvers"""
    nodes: ListType[FrameNodeInput]
    members: ListType[FrameMemberInput]
    node_loads: Optional[ListType[NodeLoadInput]] = []
    method: Optional[str] = "auto"  # "auto", "superlu", "cg", "gmres"

@app.post("/analyze/large-frame", tags=["Analysis"])
async def analyze_large_frame(request: LargeFrameAnalysisRequest):
    """
    High-performance analysis for large structural models (5k-100k+ nodes).
    
    Uses SciPy sparse matrix solvers:
    - SuperLU direct solver for models up to ~50k DOF
    - Preconditioned Conjugate Gradient for larger models
    
    **Performance targets:**
    - 10k nodes: ~100-500ms
    - 50k nodes: ~1-5s
    - 100k nodes: ~5-15s
    
    Returns:
    - Node displacements
    - Solve time and method used
    - Residual norm for verification
    """
    import traceback
    import time
    
    start_time = time.perf_counter()
    
    try:
        # Validate request first
        n_nodes = len(request.nodes) if request.nodes else 0
        n_members = len(request.members) if request.members else 0
        n_loads = len(request.node_loads) if request.node_loads else 0
        
        print(f"[SPARSE] Received request: {n_nodes} nodes, {n_members} members, {n_loads} loads")
        
        # Validate model has required data
        if n_nodes == 0:
            raise HTTPException(status_code=400, detail="No nodes provided in request")
        if n_members == 0:
            raise HTTPException(status_code=400, detail="No members provided in request")
        
        # Limit model size for Azure free tier (prevent timeout/memory issues)
        MAX_NODES = 100000
        if n_nodes > MAX_NODES:
            raise HTTPException(
                status_code=400, 
                detail=f"Model too large: {n_nodes} nodes exceeds limit of {MAX_NODES}"
            )
        
        n_dof = n_nodes * 6
        print(f"[SPARSE] Total DOF: {n_dof}")
        
        # Import solver after validation passes
        from analysis.sparse_solver import analyze_large_frame as solve_large
        
        print(f"[SPARSE] Large model analysis: {n_nodes} nodes ({n_dof} DOF), {n_members} members")
        
        # Convert to dict format
        nodes = [
            {"id": n.id, "x": n.x, "y": n.y, "z": n.z, "support": n.support or "none"}
            for n in request.nodes
        ]
        
        members = [
            {
                "id": m.id,
                "start_node_id": m.startNodeId,
                "end_node_id": m.endNodeId,
                "E": m.E or 200e9,
                "G": m.G or 77e9,
                "Iy": m.Iy or 1e-4,
                "Iz": m.Iz or 1e-4,
                "J": m.J or 1e-5,
                "A": m.A or 0.01
            }
            for m in request.members
        ]
        
        loads = [
            {
                "node_id": l.nodeId,
                "fx": l.fx or 0,
                "fy": l.fy or 0,
                "fz": l.fz or 0,
                "mx": l.mx or 0,
                "my": l.my or 0,
                "mz": l.mz or 0
            }
            for l in (request.node_loads or [])
        ]
        
        # Get fixed DOFs from supports
        fixed_dofs = []
        node_map = {n.id: i for i, n in enumerate(request.nodes)}
        for n in request.nodes:
            if n.support and n.support.lower() != "none":
                base_dof = node_map[n.id] * 6
                support = n.support.lower()
                if support == "fixed":
                    fixed_dofs.extend(range(base_dof, base_dof + 6))
                elif support in ("pinned", "pin"):
                    fixed_dofs.extend([base_dof, base_dof + 1, base_dof + 2])
                elif support == "roller":
                    fixed_dofs.append(base_dof + 1)  # Y only
        
        # Run sparse analysis
        result = solve_large(
            nodes=nodes,
            members=members,
            loads=loads,
            fixed_dofs=fixed_dofs,
            method=request.method or "auto"
        )
        
        total_time = (time.perf_counter() - start_time) * 1000
        
        if not result['success']:
            print(f"[SPARSE] Analysis failed: {result.get('error')}")
            raise HTTPException(status_code=400, detail=result.get('error', 'Sparse solver failed'))
        
        print(f"[SPARSE] Analysis complete in {result.get('solve_time_ms', 0):.1f}ms (total: {total_time:.1f}ms)")
        print(f"[SPARSE] Method: {result.get('method')}, Max disp: {result.get('max_displacement_mm', 0):.3f}mm")
        
        # Return results - already sanitized by solve_large
        return {
            "success": True,
            "displacements": result['displacements'],
            "reactions": result.get('reactions', {}),
            "member_forces": result.get('member_forces', {}),
            "stats": {
                "solve_time_ms": result.get('solve_time_ms', 0),
                "total_time_ms": total_time,
                "method": result.get('method'),
                "iterations": result.get('iterations', 0),
                "residual_norm": result.get('residual_norm', 0),
                "n_nodes": n_nodes,
                "n_members": n_members,
                "n_dof": n_dof,
                "max_displacement_mm": result.get('max_displacement_mm', 0)
            }
        }
        
    except ImportError as e:
        print(f"[SPARSE] ImportError: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Sparse solver import error: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        print(f"[SPARSE] Exception: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Large model analysis error: {str(e)}")


# ============================================
# TEMPLATE GENERATION — MOVED TO RUST API
# Canonical owner: Rust API /api/templates/*
# (beam, continuous-beam, truss, frame, portal)
# Removed to eliminate duplication. Use Rust API directly.
# ============================================


# ============================================
# REPORT GENERATION ENDPOINT
# ============================================

class ReportRequest(BaseModel):
    settings: Dict[str, Any]
    analysis_data: Dict[str, Any]

@app.post("/reports/generate-simple", tags=["Reports"])
async def generate_report_endpoint(request: ReportRequest):
    """
    Generate simple PDF report using ReportLab.
    Returns base64 encoded PDF string.
    For the full-featured report with customization, use POST /reports/generate.
    """
    try:
        import tempfile
        import os
        
        # Create settings
        settings_dict = request.settings
        settings = ReportSettings(
            company_name=settings_dict.get('company_name', 'BeamLab Ultimate'),
            project_name=settings_dict.get('project_name', 'Structural Analysis'),
            engineer_name=settings_dict.get('engineer_name', ''),
            job_number=settings_dict.get('job_number', '')  # Note: report_generator uses project_number, let's fix in adapter if needed
        )
        
        # Override any other settings
        for k, v in settings_dict.items():
            if hasattr(settings, k):
                setattr(settings, k, v)
        
        # Initialize generator
        generator = ReportGenerator(settings)
        
        # Generate to temp file
        output_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
                output_path = tmp.name
                
            generator.generate_report(request.analysis_data, output_path)
            
            # Read back as base64
            with open(output_path, "rb") as f:
                pdf_bytes = f.read()
                pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
                
            return {
                "success": True,
                "pdf_base64": pdf_base64,
                "filename": f"{settings.project_name.replace(' ', '_')}_Report.pdf"
            }
        finally:
            if output_path and os.path.exists(output_path):
                os.unlink(output_path)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Report generation failed")


# ============================================
# MODEL VALIDATION
# ============================================

@app.post("/validate", tags=["Validation"])
async def validate_model(model: StructuralModel):
    """Validate a structural model for common issues."""
    issues = []
    
    node_ids = {n.id for n in model.nodes}
    
    # Check member references
    for member in model.members:
        if member.start_node not in node_ids:
            issues.append(f"Member {member.id}: Invalid start node {member.start_node}")
        if member.end_node not in node_ids:
            issues.append(f"Member {member.id}: Invalid end node {member.end_node}")
    
    # Check for supports
    supports = [n for n in model.nodes if n.support and n.support.value != "NONE"]
    if len(supports) == 0:
        issues.append("No supports defined - structure is unstable")
    
    return {
        "valid": len(issues) == 0,
        "issues": issues,
        "node_count": len(model.nodes),
        "member_count": len(model.members),
        "support_count": len(supports)
    }


# ============================================
# SECTION RECOMMENDATION ENDPOINT
# ============================================

class SectionRecommendationRequest(BaseModel):
    """Request for section recommendation"""
    member_type: str  # "beam" or "column"
    required_Mx: float = 0.0  # Required moment capacity x-axis (kN·m)
    required_My: float = 0.0  # Required moment capacity y-axis (kN·m)
    required_P: float = 0.0   # Required axial capacity (kN)
    required_V: float = 0.0   # Required shear capacity (kN)
    length: float = 5000.0    # Member length (mm)
    section_type: str = "ISMB"  # "ISMB", "ISMC", "ISA"
    safety_factor: float = 1.5
    max_deflection: Optional[float] = None  # mm (L/360 etc)


@app.post("/sections/recommend", tags=["Design"])
async def recommend_section(request: SectionRecommendationRequest):
    """
    Recommend suitable structural sections based on demands.
    
    Uses IS 800 Indian Standard sections (ISMB, ISMC, ISA).
    Returns top 5 most efficient sections that meet requirements.
    
    Args:
        member_type: "beam" or "column"
        required_Mx: Bending moment about major axis (kN·m)
        required_My: Bending moment about minor axis (kN·m)
        required_P: Axial force (kN, positive for compression)
        length: Member length (mm)
        section_type: Type of section (ISMB, ISMC, ISA)
        safety_factor: Safety factor to apply (default 1.5)
    
    Returns:
        List of recommended sections with properties and capacities
    """
    try:
        from analysis.section_database import SectionRecommender
        
        recommender = SectionRecommender()
        
        if request.member_type.lower() == "beam":
            sections = recommender.recommend_for_beam(
                required_Mx=request.required_Mx,
                required_My=request.required_My,
                length=request.length,
                section_type=request.section_type,
                safety_factor=request.safety_factor
            )
        elif request.member_type.lower() == "column":
            sections = recommender.recommend_for_column(
                required_P=request.required_P,
                length=request.length,
                section_type=request.section_type,
                safety_factor=request.safety_factor
            )
        else:
            raise HTTPException(status_code=400, detail="member_type must be 'beam' or 'column'")
        
        # Convert to response format
        recommendations = []
        for section in sections:
            capacity = section.get_capacity_info()
            recommendations.append({
                "designation": section.designation,
                "section_type": section.section_type,
                "properties": {
                    "area": section.area,
                    "depth": section.depth,
                    "width": section.width,
                    "tw": section.tw,
                    "tf": section.tf,
                    "ixx": section.ixx,
                    "iyy": section.iyy,
                    "zxx": section.zxx,
                    "zyy": section.zyy,
                    "rxx": section.rxx,
                    "ryy": section.ryy,
                    "weight_per_meter": section.weight_per_meter
                },
                "capacity": capacity,
                "material": {
                    "fy": section.fy,
                    "fu": section.fu,
                    "E": section.E
                }
            })
        
        return {
            "success": True,
            "recommendations": recommendations,
            "count": len(recommendations),
            "criteria": {
                "member_type": request.member_type,
                "required_Mx": request.required_Mx,
                "required_My": request.required_My,
                "required_P": request.required_P,
                "length": request.length,
                "section_type": request.section_type,
                "safety_factor": request.safety_factor
            }
        }
        
    except Exception as e:
        print(f"[SECTION] Recommendation error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Recommendation error: {str(e)}")


# ============================================
# CUSTOM SECTION DESIGNER ENDPOINTS
# ============================================

class CustomSectionRequest(BaseModel):
    """Request for custom section property calculation"""
    points: List[Dict[str, float]]  # List of {x, y} coordinates
    name: Optional[str] = "Custom Section"
    material_density: Optional[float] = 7850.0  # kg/m³ (default: steel)


class StandardSectionRequest(BaseModel):
    """Request for standard shape creation"""
    shape_type: str  # "i_beam", "channel", "angle", "rectangular", "circular", "tee"
    dimensions: Dict[str, float]  # Dimension parameters
    name: Optional[str] = None


@app.post("/sections/custom/calculate", tags=["Section Design"])
async def calculate_custom_section(request: CustomSectionRequest):
    """
    Calculate properties of a custom section defined by points.
    
    Args:
        points: List of {x, y} coordinates defining section boundary (CCW)
        name: Section designation
        material_density: Material density in kg/m³ (default: 7850 for steel)
    
    Returns:
        Complete section properties:
        - Area, centroid
        - Second moments (Ixx, Iyy, Ixy)
        - Elastic moduli (Zxx, Zyy)
        - Plastic moduli (Zpxx, Zpyy)
        - Radii of gyration (rxx, ryy)
        - Principal axes (I1, I2, angle)
        - Weight per meter
    
    Example:
        ```json
        {
          "points": [
            {"x": -75, "y": -150},
            {"x": 75, "y": -150},
            {"x": 75, "y": 150},
            {"x": -75, "y": 150}
          ],
          "name": "Custom 150x300",
          "material_density": 7850
        }
        ```
    """
    try:
        from analysis.section_designer import CustomSection, Point
        
        # Convert to Point objects
        section_points = [Point(p['x'], p['y']) for p in request.points]
        
        # Create custom section
        section = CustomSection(section_points, request.name or "Custom Section")
        
        # Calculate all properties
        properties = section.get_all_properties(request.material_density or 7850.0)
        
        return {
            "success": True,
            "section": {
                "name": section.name,
                "points": [{"x": p.x, "y": p.y} for p in section.points],
                "properties": properties
            }
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        print(f"[SECTION DESIGNER] Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Section calculation error: {str(e)}")


@app.post("/sections/standard/create", tags=["Section Design"])
async def create_standard_section(request: StandardSectionRequest):
    """
    Create a standard section shape with automatic property calculation.
    
    Args:
        shape_type: Type of standard shape
        dimensions: Dictionary of dimension parameters
        name: Optional section designation
    
    Shape Types and Required Dimensions:
    
    **i_beam**:
    - depth: Total depth (mm)
    - width: Flange width (mm)
    - web_thickness: Web thickness (mm)
    - flange_thickness: Flange thickness (mm)
    
    **channel**:
    - depth: Total depth (mm)
    - width: Flange width (mm)
    - web_thickness: Web thickness (mm)
    - flange_thickness: Flange thickness (mm)
    
    **angle**:
    - leg1: First leg length (mm)
    - leg2: Second leg length (mm)
    - thickness: Thickness (mm)
    
    **rectangular**:
    - width: Width (mm)
    - depth: Depth (mm)
    
    **circular**:
    - diameter: Diameter (mm)
    - segments: Number of polygon segments (default:32)
    
    **tee**:
    - width: Flange width (mm)
    - depth: Total depth (mm)
    - web_thickness: Web thickness (mm)
    - flange_thickness: Flange thickness (mm)
    
    Returns:
        Section properties and point coordinates
    
    Example:
        ```json
        {
          "shape_type": "i_beam",
          "dimensions": {
            "depth": 300,
            "width": 150,
            "web_thickness": 7.5,
            "flange_thickness": 10.8
          },
          "name": "ISMB 300"
        }
        ```
    """
    try:
        from analysis.section_designer import StandardShapes, CustomSection
        
        shape_type = request.shape_type.lower()
        dims = request.dimensions
        
        # Create standard shape
        if shape_type == "i_beam" or shape_type == "ibeam":
            section = StandardShapes.i_beam(
                depth=dims['depth'],
                width=dims['width'],
                web_thick=dims['web_thickness'],
                flange_thick=dims['flange_thickness'],
                name=request.name or f"I-Beam {dims['depth']}x{dims['width']}"
            )
        
        elif shape_type == "channel":
            section = StandardShapes.channel(
                depth=dims['depth'],
                width=dims['width'],
                web_thick=dims['web_thickness'],
                flange_thick=dims['flange_thickness'],
                name=request.name or f"Channel {dims['depth']}x{dims['width']}"
            )
        
        elif shape_type == "angle":
            section = StandardShapes.angle(
                leg1=dims['leg1'],
                leg2=dims['leg2'],
                thickness=dims['thickness'],
                name=request.name or f"Angle {dims['leg1']}x{dims['leg2']}x{dims['thickness']}"
            )
        
        elif shape_type == "rectangular" or shape_type == "rectangle":
            section = StandardShapes.rectangular(
                width=dims['width'],
                depth=dims['depth'],
                name=request.name or f"Rect {dims['width']}x{dims['depth']}"
            )
        
        elif shape_type == "circular" or shape_type == "circle":
            segments = dims.get('segments', 32)
            section = StandardShapes.circular(
                diameter=dims['diameter'],
                segments=int(segments),
                name=request.name or f"Circle D{dims['diameter']}"
            )
        
        elif shape_type == "tee":
            section = StandardShapes.tee(
                width=dims['width'],
                depth=dims['depth'],
                web_thick=dims['web_thickness'],
                flange_thick=dims['flange_thickness'],
                name=request.name or f"Tee {dims['width']}x{dims['depth']}"
            )
            
        elif shape_type == "built_up_i":
            section = StandardShapes.built_up_i(
                depth=dims['depth'],
                top_width=dims['top_width'],
                bot_width=dims['bot_width'],
                web_thick=dims['web_thickness'],
                top_thick=dims['top_thickness'],
                bot_thick=dims['bot_thickness'],
                name=request.name or "Built-up I-Section"
            )

        elif shape_type == "composite_beam":
            section = StandardShapes.composite_beam(
                depth=dims['depth'],
                width=dims['width'],
                web_thick=dims['web_thickness'],
                flange_thick=dims['flange_thickness'],
                slab_width=dims['slab_width'],
                slab_thick=dims['slab_thickness'],
                modular_ratio=dims.get('modular_ratio', 8.0),
                name=request.name or "Composite Beam"
            )

        elif shape_type == "lipped_channel":
            section = StandardShapes.lipped_channel(
                depth=dims['depth'],
                width=dims['width'],
                thickness=dims['thickness'],
                lip=dims['lip'],
                name=request.name or "Lipped Channel"
            )
        
        else:
            raise HTTPException(
                status_code=400, 
                detail=f"Unknown shape type: {shape_type}. "
                       f"Available: i_beam, channel, angle, rectangular, circular, tee, built_up_i, composite_beam, lipped_channel"
            )
        
        # Get all properties
        properties = section.get_all_properties(request.material_density or 7850.0)
        
        return {
            "success": True,
            "section": {
                "name": section.name,
                "shape_type": request.shape_type,
                "points": [{"x": round(p.x, 2), "y": round(p.y, 2)} for p in section.points],
                "properties": properties
            }
        }
    
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Missing dimension: {str(e)}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[SECTION DESIGNER] Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Section creation error: {str(e)}")


@app.get("/sections/shapes/list", tags=["Section Design"])
async def list_standard_shapes():
    """
    List all available standard shapes with their required dimensions.
    
    Returns:
        Dictionary of shape types and their dimension requirements
    """
    return {
        "success": True,
        "shapes": {
            "i_beam": {
                "description": "I-beam (W-shape)",
                "dimensions": ["depth", "width", "web_thickness", "flange_thickness"]
            },
            "channel": {
                "description": "Channel (C-shape)",
                "dimensions": ["depth", "width", "web_thickness", "flange_thickness"]
            },
            "angle": {
                "description": "Angle (L-shape)",
                "dimensions": ["leg1", "leg2", "thickness"]
            },
            "rectangular": {
                "description": "Solid rectangle",
                "dimensions": ["width", "depth"]
            },
            "circular": {
                "description": "Solid circle",
                "dimensions": ["diameter", "segments (optional)"]
            },
            "tee": {
                "description": "T-section",
                "dimensions": ["width", "depth", "web_thickness", "flange_thickness"]
            }
        }
    }



# ============================================
# MATERIAL & PLATE ELEMENT ENDPOINTS
# ============================================

class CreateMaterialRequest(BaseModel):
    type: str  # "steel" or "concrete"
    fy: float = 250.0
    E: float = 200000.0
    plastic_modulus: float = 2000.0
    fck: float = 30.0
    density: float = 7850.0

@app.post("/materials/create", tags=["Materials"])
async def create_material(request: CreateMaterialRequest):
    """
    Create a material model for non‑linear analysis.
    Expected JSON payload:
    {
        "type": "steel" | "concrete",
        "fy": 250.0,          # for steel (MPa)
        "E": 200000.0,       # optional, default for steel
        "plastic_modulus": 2000.0,  # optional for steel
        "fck": 30.0,         # for concrete (MPa)
        "density": 7850.0    # optional
    }
    Returns a material ID that can be referenced when creating plates.
    """
    try:
        from analysis.material_models import create_material_from_dict
        material = create_material_from_dict(request.model_dump())
        # Store material in a simple in‑memory registry for this session
        # Note: In production this should go to DB
        material_id = f"mat_{len(getattr(app.state, 'materials', {})) + 1}"
        
        if not hasattr(app.state, "materials"):
            app.state.materials = {}
        app.state.materials[material_id] = material
        
        return {"success": True, "material_id": material_id}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

class CreatePlateRequest(BaseModel):
    node_ids: list
    thickness: float
    material_id: str = ""

@app.post("/elements/plate/create", tags=["Elements"])
async def create_plate(request: CreatePlateRequest):
    """
    Create a quadrilateral plate element.
    Expected JSON payload:
    {
        "node_ids": [1,2,3,4],
        "thickness": 12.0,
        "material_id": "mat_1"
    }
    Returns an element ID for later analysis.
    """
    try:
        from analysis.plate_element import PlateElement
        
        node_ids = request.node_ids
        thickness = request.thickness
        material_id = request.material_id
        
        # Access materials from app state
        if not hasattr(app.state, "materials"):
            app.state.materials = {}
            
        material = app.state.materials.get(material_id)
        
        # Create a default material if none provided or found
        if material is None:
            if material_id:
                print(f"Warning: Material ID {material_id} not found, using default steel.")
            from analysis.material_models import ElasticPlasticSteel
            material = ElasticPlasticSteel(fy=250.0)
            
        plate = PlateElement(node_ids=node_ids, thickness=thickness, material=material)
        
        # Store plate
        plate_id = f"plate_{len(getattr(app.state, 'plates', {})) + 1}"
        if not hasattr(app.state, "plates"):
            app.state.plates = {}
        app.state.plates[plate_id] = plate
        
        return {"success": True, "element_id": plate_id}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))


# ============================================
# INPUT VALIDATION MODELS FOR CRITICAL ENDPOINTS
# ============================================
# SECURITY: These Pydantic models enforce bounds on all user input
# to prevent memory exhaustion and DoS attacks.

from pydantic import Field
from typing import Literal

class NonlinearAnalysisRequest(BaseModel):
    nodes: List[Dict] = Field(default_factory=list, max_length=100_000)
    members: List[Dict] = Field(default_factory=list, max_length=100_000)
    node_loads: List[Dict] = Field(default_factory=list, max_length=100_000)
    settings: Dict = Field(default_factory=lambda: {"method": "newton-raphson", "steps": 10})

class DesignCheckMemberInput(BaseModel):
    member_id: str = Field(max_length=128)
    section_name: str = Field(default="Unknown", max_length=128)
    section_properties: Dict = Field(default_factory=dict)
    length: float = Field(default=0.0, ge=0)
    material: Dict = Field(default_factory=dict)
    forces: Dict = Field(default_factory=dict)
    unbraced_length_major: Optional[float] = None
    unbraced_length_minor: Optional[float] = None
    unbraced_length_ltb: Optional[float] = None
    Kx: float = Field(default=1.0, ge=0, le=10)
    Ky: float = Field(default=1.0, ge=0, le=10)
    Cb: float = Field(default=1.0, ge=0, le=10)

class DesignCheckRequest(BaseModel):
    code: str = Field(default="AISC360-16", max_length=64)
    method: str = Field(default="LRFD", max_length=32)
    members: List[DesignCheckMemberInput] = Field(default_factory=list, max_length=10_000)

class StressMemberForces(BaseModel):
    axial: List[float] = Field(default_factory=list, max_length=10_000)
    moment_x: List[float] = Field(default_factory=list, max_length=10_000)
    moment_y: List[float] = Field(default_factory=list, max_length=10_000)
    shear_y: List[float] = Field(default_factory=list, max_length=10_000)
    shear_z: List[float] = Field(default_factory=list, max_length=10_000)

class StressMemberSection(BaseModel):
    area: float = Field(gt=0, le=1e6)
    Ixx: float = Field(gt=0, le=1e6)
    Iyy: float = Field(gt=0, le=1e6)
    depth: float = Field(gt=0, le=1e4)
    width: float = Field(gt=0, le=1e4)

class StressMemberInput(BaseModel):
    id: str = Field(max_length=128)
    forces: StressMemberForces = Field(default_factory=StressMemberForces)
    section: StressMemberSection
    length: float = Field(default=1.0, gt=0, le=1e6)

class StressCalculateRequest(BaseModel):
    members: List[StressMemberInput] = Field(default_factory=list, max_length=10_000)
    stress_type: str = Field(default="von_mises", max_length=32)
    fy: float = Field(default=250.0, gt=0, le=5000)
    safety_factor: float = Field(default=1.5, gt=0, le=10)

class TimeHistoryGroundMotion(BaseModel):
    name: str = Field(default="el_centro_1940", max_length=128)
    scale_factor: float = Field(default=1.0, ge=0, le=100)

class TimeHistoryRequest(BaseModel):
    mass_matrix: List[List[float]] = Field(max_length=1000)
    stiffness_matrix: List[List[float]] = Field(max_length=1000)
    damping_ratio: float = Field(default=0.05, ge=0.0, le=1.0)
    analysis_type: Literal["modal", "newmark", "spectrum"] = Field(default="modal")
    ground_motion: Optional[TimeHistoryGroundMotion] = None
    num_modes: int = Field(default=10, ge=1, le=200)
    periods: List[float] = Field(default_factory=list, max_length=1000)


@app.post("/analysis/nonlinear/run", tags=["Analysis"])
async def run_nonlinear_analysis(request: NonlinearAnalysisRequest):
    """
    Run non-linear structural analysis (Material & Geometric).
    Supports frames and plate elements.
    """
    try:
        from analysis.optimized_solver import OptimizedFrameSolver
        
        # Parse request (already validated by Pydantic)
        nodes = request.nodes
        elements = request.members
        loads = request.node_loads
        settings = request.settings
        
        # Prepare model dict for solver
        model = {
            'nodes': nodes,
            'members': elements,
            'node_loads': loads
        }
        
        # Initialize solver
        solver = OptimizedFrameSolver(use_iterative=True)
        
        # Run analysis (currently linear, to be upgraded to non-linear loop)
        # For Phase 2 Demo, we run linear analysis with the new Plate elements.
        # True non-linear loop requires updating Stiffness at each step.
        result = solver.solve(model)
        
        return result

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))



# ============================================
# STRUCTURAL DESIGN ENDPOINTS
# ============================================

@app.post("/design/check", tags=["Design"])
async def check_design(request: DesignCheckRequest):
    """
    Perform code checking (AISC, Eurocode, etc.) on structure.
    
    Expected JSON payload:
    {
        "code": "AISC360-16",
        "method": "LRFD",
        "members": [
            {
               "member_id": 1,
               "section_name": "ISMB300",
               "section_properties": { ... },
               "length": 5000,
               "material": { "Fy": 250, "E": 200000 },
               "forces": {"P": -500, "Mz": 45, "My": 0},
               "unbraced_length_major": 5000,
               "unbraced_length_minor": 5000,
               "unbraced_length_ltb": 5000
            }
        ]
    }
    """
    try:
        from design import DesignFactory, DesignMember
        
        code_name = request.code
        code = DesignFactory.get_code(code_name)
        
        if not code:
            raise HTTPException(status_code=400, detail=f"Design code '{code_name}' not supported")
            
        results = {}
        
        for m_data in request.members:
            try:
                # Create DesignMember
                member = DesignMember(
                    id=m_data.member_id,
                    section_name=m_data.section_name,
                    section_properties=m_data.section_properties,
                    length=m_data.length,
                    material=m_data.material,
                    forces=m_data.forces,
                    unbraced_length_major=m_data.unbraced_length_major if m_data.unbraced_length_major is not None else m_data.length,
                    unbraced_length_minor=m_data.unbraced_length_minor if m_data.unbraced_length_minor is not None else m_data.length,
                    unbraced_length_ltb=m_data.unbraced_length_ltb if m_data.unbraced_length_ltb is not None else m_data.length,
                    effective_length_factor_major=m_data.Kx,
                    effective_length_factor_minor=m_data.Ky,
                    cb=m_data.Cb
                )
                
                # Run Check
                res = code.check_member(member)
                
                # Simplify result for JSON response
                results[member.id] = {
                    "ratio": res.ratio,
                    "status": res.status,
                    "governing": res.governing_check,
                    "capacity": res.capacity,
                    "log": res.calculation_log
                }
                
            except Exception as item_err:
                print(f"Error checking member {m_data.member_id}: {item_err}")
                results[m_data.member_id] = {"error": str(item_err), "status": "ERROR"}
        
        return {
            "success": True, 
            "code": code.code_name,
            "results": results
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# PDF REPORT GENERATION ENDPOINT
# ============================================

class ReportCustomization(BaseModel):
    """Report customization settings"""
    # Company branding
    company_name: str = "Engineering Consultancy"
    company_address: str = ""
    company_phone: str = ""
    company_email: str = ""
    
    # Project information
    project_name: str = "Structural Analysis"
    project_number: str = ""
    project_location: str = ""
    client_name: str = ""
    engineer_name: str = ""
    checked_by: str = ""
    
    # Report sections
    include_cover_page: bool = True
    include_input_summary: bool = True
    include_analysis_results: bool = True
    include_design_checks: bool = True
    include_diagrams: bool = True
    
    # Styling
    primary_color: List[float] = [0.0, 0.4, 0.8]  # RGB 0-1
    page_size: str = "A4"  # "A4" or "Letter"


class GenerateReportRequest(BaseModel):
    """Request to generate PDF report"""
    analysis_data: Dict[str, Any]
    customization: Optional[ReportCustomization] = None


@app.post("/reports/generate", tags=["Reports"])
async def generate_pdf_report(request: GenerateReportRequest):
    """
    Generate professional PDF report from analysis results.
    
    Creates a customizable report with:
    - Cover page with project details
    - Input summary (geometry, loads, supports)
    - Analysis results (displacements, forces)
    - Design checks (IS 800 compliance)
    - Charts and diagrams
    
    Returns PDF file as downloadable response.
    """
    try:
        from analysis.report_generator import ReportGenerator, ReportSettings
        import tempfile
        import os
        from fastapi.responses import FileResponse
        
        # Create settings from customization
        customization = request.customization or ReportCustomization()
        
        settings = ReportSettings(
            company_name=customization.company_name,
            company_address=customization.company_address,
            company_phone=customization.company_phone,
            company_email=customization.company_email,
            project_name=customization.project_name,
            project_number=customization.project_number,
            project_location=customization.project_location,
            client_name=customization.client_name,
            engineer_name=customization.engineer_name,
            checked_by=customization.checked_by,
            include_cover_page=customization.include_cover_page,
            include_input_summary=customization.include_input_summary,
            include_analysis_results=customization.include_analysis_results,
            include_design_checks=customization.include_design_checks,
            include_diagrams=customization.include_diagrams,
            primary_color=tuple(customization.primary_color),
            page_size=customization.page_size
        )
        
        # Generate report
        generator = ReportGenerator(settings)
        
        # Create temporary file
        output_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
                output_path = tmp.name
            
            # Generate PDF
            generator.generate_report(request.analysis_data, output_path)
            
            # Return as downloadable file — use BackgroundTask to clean up after response
            from starlette.background import BackgroundTask
            filename = f"{customization.project_name.replace(' ', '_')}_Report_{datetime.now().strftime('%Y%m%d')}.pdf"
            
            return FileResponse(
                output_path,
                media_type='application/pdf',
                filename=filename,
                headers={
                    "Content-Disposition": f"attachment; filename={filename}"
                },
                background=BackgroundTask(os.unlink, output_path),
            )
        except Exception:
            # Clean up on generation failure
            if output_path and os.path.exists(output_path):
                os.unlink(output_path)
            raise
        
    except Exception as e:
        print(f"[REPORT] Generation error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Report generation failed")


@app.post("/stress/calculate")
async def calculate_stress(request: StressCalculateRequest):
    """
    Calculate stresses for structural members
    
    Request body:
    {
        "members": [
            {
                "id": "M1",
                "forces": {
                    "axial": [...],
                    "moment_x": [...],
                    "moment_y": [...],
                    "shear_y": [...],
                    "shear_z": [...]
                },
                "section": {
                    "area": 0.01,
                    "Ixx": 1e-4,
                    "Iyy": 1e-4,
                    "depth": 0.3,
                    "width": 0.15
                },
                "length": 5.0
            }
        ],
        "stress_type": "von_mises",  # or "principal_1", "sigma_x", etc.
        "fy": 250.0,  # Yield strength (MPa)
        "safety_factor": 1.5
    }
    """
    try:
        from analysis.stress_calculator import StressCalculator
        
        print("[STRESS] Calculating stresses...")
        
        calculator = StressCalculator()
        members_data = request.members
        stress_type = request.stress_type
        fy = request.fy
        safety_factor = request.safety_factor
        
        results = []
        
        for member in members_data:
            member_id = member.id
            
            # Calculate stress points
            stress_points = calculator.calculate_member_stresses(
                member_id=member_id,
                member_forces=member.forces.model_dump(),
                section_properties=member.section.model_dump(),
                member_length=member.length,
                num_points=20
            )
            
            # Get contour data
            contours = calculator.get_stress_contours(stress_points, stress_type)
            
            # Check stress limits
            check = calculator.check_stress_limits(stress_points, fy, safety_factor)
            
            results.append({
                'member_id': member_id,
                'stress_points': [
                    {
                        'x': p.x,
                        'y': p.y,
                        'z': p.z,
                        'sigma_x': p.sigma_x,
                        'sigma_y': p.sigma_y,
                        'sigma_z': p.sigma_z,
                        'tau_xy': p.tau_xy,
                        'tau_yz': p.tau_yz,
                        'tau_zx': p.tau_zx,
                        'von_mises': p.von_mises,
                        'principal_1': p.principal_1,
                        'principal_2': p.principal_2,
                        'principal_3': p.principal_3,
                        'max_shear': p.max_shear
                    }
                    for p in stress_points
                ],
                'contours': contours,
                'check': check
            })
        
        print(f"[STRESS] Calculated stresses for {len(results)} members")
        
        return {
            'success': True,
            'results': results,
            'stress_type': stress_type
        }
        
    except Exception as e:
        print(f"[STRESS] Calculation error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Stress calculation error: {str(e)}")


@app.post("/analysis/time-history")
async def time_history_analysis(request: TimeHistoryRequest):
    """
    Perform dynamic time history analysis
    
    Request body:
    {
        "mass_matrix": [[...], [...]], // Global mass matrix
        "stiffness_matrix": [[...], [...]], // Global stiffness matrix
        "damping_ratio": 0.05,
        "analysis_type": "modal" | "newmark" | "spectrum",
        "ground_motion": {
            "name": "el_centro_1940",
            "scale_factor": 1.0
        },
        "num_modes": 10,
        "periods": [0.1, 0.2, ..., 4.0] // For response spectrum
    }
    """
    try:
        from analysis.time_history_analysis import TimeHistoryAnalyzer, load_ground_motion
        import numpy as np
        
        print("[TIME-HISTORY] Starting dynamic analysis...")
        
        analysis_type = request.analysis_type
        damping_ratio = request.damping_ratio
        
        # Parse matrices (validated: max 1000x1000)
        M = np.array(request.mass_matrix)
        K = np.array(request.stiffness_matrix)
        
        if M.size == 0 or K.size == 0:
            raise ValueError("Mass and stiffness matrices are required")
        
        analyzer = TimeHistoryAnalyzer()
        analyzer.damping_ratio = damping_ratio
        
        results = {}
        
        if analysis_type == 'modal':
            # Modal analysis only
            num_modes = request.num_modes
            modes = analyzer.modal_analysis(M, K, num_modes)
            
            results = {
                'success': True,
                'analysis_type': 'modal',
                'modes': [
                    {
                        'mode_number': m.mode_number,
                        'frequency': m.frequency,
                        'period': m.period,
                        'omega': m.omega,
                        'participation_factor': m.participation_factor,
                        'mass_participation': m.mass_participation,
                        'mode_shape': m.mode_shape.tolist()
                    }
                    for m in modes
                ],
                'total_mass_participation': sum(m.mass_participation for m in modes)
            }
            
        elif analysis_type == 'newmark':
            # Time history integration
            gm_config = request.ground_motion or TimeHistoryGroundMotion()
            gm_name = gm_config.name
            scale_factor = gm_config.scale_factor
            
            ground_motion = load_ground_motion(gm_name, scale_factor)
            
            # Rayleigh damping matrix: C = α*M + β*K
            # For 5% damping at two frequencies
            omega1 = 2 * np.pi * 1.0  # 1 Hz
            omega2 = 2 * np.pi * 10.0  # 10 Hz
            alpha = damping_ratio * 2 * omega1 * omega2 / (omega1 + omega2)
            beta = damping_ratio * 2 / (omega1 + omega2)
            C = alpha * M + beta * K
            
            response = analyzer.newmark_beta_integration(M, K, C, ground_motion)
            
            results = {
                'success': True,
                'analysis_type': 'newmark',
                'ground_motion': {
                    'name': ground_motion.name,
                    'pga': float(ground_motion.pga),
                    'duration': float(ground_motion.duration),
                    'dt': float(ground_motion.dt)
                },
                'time': response['time'].tolist(),
                'displacement': response['displacement'].tolist(),
                'velocity': response['velocity'].tolist(),
                'acceleration': response['acceleration'].tolist(),
                'max_displacement': float(np.max(np.abs(response['displacement']))),
                'max_velocity': float(np.max(np.abs(response['velocity']))),
                'max_acceleration': float(np.max(np.abs(response['acceleration'])))
            }
            
        elif analysis_type == 'spectrum':
            # Response spectrum
            gm_config = request.ground_motion or TimeHistoryGroundMotion()
            gm_name = gm_config.name
            scale_factor = gm_config.scale_factor
            
            ground_motion = load_ground_motion(gm_name, scale_factor)
            
            periods = np.array(request.periods if request.periods else np.linspace(0.1, 4.0, 40))
            spectrum = analyzer.get_response_spectrum(ground_motion, periods, damping_ratio)
            
            results = {
                'success': True,
                'analysis_type': 'spectrum',
                'ground_motion': {
                    'name': ground_motion.name,
                    'pga': float(ground_motion.pga)
                },
                'periods': spectrum['periods'].tolist(),
                'Sd': spectrum['Sd'].tolist(),
                'Sv': spectrum['Sv'].tolist(),
                'Sa': spectrum['Sa'].tolist(),
                'max_Sa': float(np.max(spectrum['Sa']))
            }
        
        print(f"[TIME-HISTORY] {analysis_type} analysis complete")
        return results
        
    except Exception as e:
        print(f"[TIME-HISTORY] Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Time history analysis error: {str(e)}")


# ============================================
# AI GENERATION ENDPOINT (HARDENED)
# ============================================

class AIGenerateRequest(BaseModel):
    prompt: str

class AIChatRequest(BaseModel):
    message: str
    context: Optional[str] = None
    history: Optional[List[dict]] = None

class AIChatResponse(BaseModel):
    success: bool
    response: Optional[str] = None
    error: Optional[str] = None

# Mock response for testing
MOCK_BEAM_RESPONSE = {
    "nodes": [
        {"id": "N1", "x": 0.0, "y": 0.0, "z": 0.0, "support": "PINNED"},
        {"id": "N2", "x": 3.0, "y": 0.0, "z": 0.0, "support": "NONE"},
        {"id": "N3", "x": 6.0, "y": 0.0, "z": 0.0, "support": "ROLLER"}
    ],
    "members": [
        {"id": "M1", "start_node": "N1", "end_node": "N2", "section_profile": "ISMB300"},
        {"id": "M2", "start_node": "N2", "end_node": "N3", "section_profile": "ISMB300"}
    ],
    "metadata": {"name": "Simple Beam (Mock)", "generated_by": "mock_ai"}
}

def clean_llm_json(raw_text: str) -> str:
    """
    Clean JSON from LLM response.
    LLMs often wrap JSON in markdown code blocks or add commentary.
    """
    # Remove markdown code blocks
    cleaned = raw_text.replace("```json", "").replace("```", "").strip()
    
    # Try to extract JSON if there's text before/after
    # Find the first { and last }
    start_idx = cleaned.find("{")
    end_idx = cleaned.rfind("}")
    
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        cleaned = cleaned[start_idx:end_idx + 1]
    
    return cleaned.strip()



@app.post("/generate/ai", tags=["AI Generation"])
async def generate_from_ai(request: AIGenerateRequest):
    """
    Generate a structural model from natural language prompt using Enhanced AI Architect.
    
    The Enhanced AI Architect uses a hybrid approach:
    1. Parameter extraction from natural language
    2. Deterministic factory generation for known structure types
    3. LLM fallback for complex or unusual requests
    """
    prompt = request.prompt
    print(f"\n{'='*60}")
    print(f"[AI ARCHITECT] Received prompt: {prompt}")
    print(f"[AI ARCHITECT] USE_MOCK_AI: {USE_MOCK_AI}")
    print(f"[AI ARCHITECT] API Key Present: {bool(GEMINI_API_KEY)}")
    
    try:
        from ai_architect import EnhancedAIArchitect, PromptAnalyzer
        
        # Step 1: Analyze the prompt
        params = PromptAnalyzer.analyze(prompt)
        print(f"[AI ARCHITECT] Detected structure type: {params.structure_type.value}")
        print(f"[AI ARCHITECT] Extracted params: span={params.span}, height={params.height}, bays={params.bays}, stories={params.stories}")
        
        # Step 2: Initialize architect (with or without API key)
        api_key = None if USE_MOCK_AI else GEMINI_API_KEY
        architect = EnhancedAIArchitect(gemini_api_key=api_key)
        
        # Step 3: Generate the model
        await asyncio.sleep(0.5)  # Small delay for UX
        model_dict, generation_method = architect.generate(prompt)
        
        print(f"[AI ARCHITECT] Generation method: {generation_method}")
        print(f"[AI ARCHITECT] Generated {len(model_dict.get('nodes', []))} nodes, {len(model_dict.get('members', []))} members")
        
        # Step 4: Convert to StructuralModel
        from models import Node, Member, SupportType
        
        nodes = []
        for n in model_dict.get("nodes", []):
            sup_str = str(n.get("support", "NONE")).upper().replace("SUPPORTTYPE.", "")
            valid_sups = ["PINNED", "FIXED", "ROLLER", "NONE"]
            support = SupportType(sup_str) if sup_str in valid_sups else SupportType.NONE
            
            nodes.append(Node(
                id=n["id"],
                x=float(n["x"]),
                y=float(n["y"]),
                z=float(n.get("z", 0.0)),
                support=support
            ))
        
        members = []
        for m in model_dict.get("members", []):
            members.append(Member(
                id=m["id"],
                start_node=m["start_node"],
                end_node=m["end_node"],
                section_profile=m.get("section_profile", "ISMB300")
            ))
        
        metadata = model_dict.get("metadata", {})
        metadata["generation_method"] = generation_method
        metadata["original_prompt"] = prompt[:100]
        
        result_model = StructuralModel(
            nodes=nodes,
            members=members,
            metadata=metadata
        )
        
        print(f"[AI ARCHITECT] ✅ SUCCESS - Returning model: {metadata.get('name', 'unnamed')}")
        return GenerateResponse(success=True, model=result_model)

    except Exception as e:
        import traceback
        print(f"[AI ARCHITECT] ❌ ERROR: {str(e)}")
        traceback.print_exc()
        
        # Enhanced fallback - try factory based on keywords
        prompt_lower = prompt.lower()
        try:
            if "truss" in prompt_lower:
                if "warren" in prompt_lower:
                    fallback = StructuralFactory.generate_warren_truss(span=12, height=3, bays=6)
                elif "howe" in prompt_lower:
                    fallback = StructuralFactory.generate_howe_truss(span=12, height=3, bays=6)
                else:
                    fallback = StructuralFactory.generate_pratt_truss(span=12, height=3, bays=6)
            elif "bridge" in prompt_lower:
                fallback = StructuralFactory.generate_bridge(span=24, deck_width=6, truss_height=4, panels=6)
            elif "tower" in prompt_lower:
                fallback = StructuralFactory.generate_tower(base_width=8, top_width=2, height=30, levels=5)
            elif "portal" in prompt_lower or "shed" in prompt_lower or "warehouse" in prompt_lower:
                fallback = StructuralFactory.generate_portal_frame(width=20, eave_height=8, roof_angle=15)
            elif "frame" in prompt_lower or "building" in prompt_lower:
                fallback = StructuralFactory.generate_3d_frame(width=12, length=12, height=3.5, stories=3)
            elif "cantilever" in prompt_lower:
                fallback = StructuralFactory.generate_simple_beam(span=5, support_type="cantilever")
            elif "continuous" in prompt_lower:
                fallback = StructuralFactory.generate_continuous_beam(spans=[5, 6, 5])
            else:
                fallback = StructuralFactory.generate_simple_beam(span=6, support_type="simple")
        except Exception:
            fallback = StructuralFactory.generate_simple_beam(span=6, support_type="simple")
        
        fallback.metadata = {
            "name": "AI Fallback Structure", 
            "error": str(e),
            "original_prompt": prompt[:50]
        }
        return GenerateResponse(success=True, model=fallback)


# ============================================
# AI CHAT ASSISTANT ENDPOINT (Gemini-powered)
# ============================================

@app.post("/ai/chat", tags=["AI Chat"])
async def ai_chat(request: AIChatRequest):
    """
    Chat with the AI assistant about structural engineering.
    Uses Google Gemini to provide intelligent responses.
    Falls back to comprehensive rule-based responses.
    """
    message = request.message
    context = request.context or ""
    history = request.history or []
    
    print(f"\n{'='*60}")
    print(f"[AI CHAT] Message: {message[:100]}...")
    print(f"[AI CHAT] Context provided: {bool(context)}")
    print(f"[AI CHAT] API Key Present: {bool(GEMINI_API_KEY)}")
    
    try:
        if not GEMINI_API_KEY:
            # Enhanced rule-based responses for structural engineering
            response_text = _get_engineering_response(message, context)
            return AIChatResponse(
                success=True,
                response=response_text
            )
        
        # Use Gemini for real AI chat
        import google.generativeai as genai
        
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        # Build the chat prompt with richer engineering context
        system_context = """You are an expert Structural Engineering AI assistant for BeamLab Ultimate, 
a professional-grade structural analysis software. You help users:

1. Understand structural analysis concepts (beams, trusses, frames, shells, plates, etc.)
2. Interpret analysis results (stresses, deflections, reactions, bending moments, shear forces)
3. Suggest design improvements and optimizations
4. Explain Indian Standard (IS) codes and specifications (IS 800, IS 456, IS 875, IS 1893)
5. Answer questions about finite element analysis
6. Help with load calculations and combinations
7. Explain UDL (Uniformly Distributed Load), UVL, point loads, moment loads
8. Discuss support conditions (fixed, pinned, roller, spring)
9. Cover steel, concrete, timber, masonry structure design
10. Help with 2D and 3D structural modeling

IMPORTANT: If the user describes a structure they want to create (beam with UDL, frame, truss, etc.),
tell them to use the 'Generate' tab and suggest the exact prompt they should type.
For example: "To create this, switch to the Generate tab and type: 'Create a simply supported beam of 8m span with 20 kN/m UDL'"

Keep responses concise but informative. Use engineering terminology appropriately.
For numerical data, provide realistic engineering estimates.
Always mention relevant IS code clauses when applicable.
"""
        
        # Build conversation
        full_prompt = f"{system_context}\n\n"
        
        if context:
            full_prompt += f"CURRENT MODEL CONTEXT:\n{context}\n\n"
        
        # Add conversation history
        for entry in history[-5:]:  # Keep last 5 messages for context
            role = entry.get("role", "user")
            content = entry.get("content", "")
            full_prompt += f"{role.upper()}: {content}\n"
        
        full_prompt += f"\nUSER: {message}\n\nASSISTANT:"
        
        response = model.generate_content(full_prompt)
        ai_response = response.text.strip()
        
        print(f"[AI CHAT] Response generated: {len(ai_response)} chars")
        
        return AIChatResponse(
            success=True,
            response=ai_response
        )
        
    except Exception as e:
        print(f"[AI CHAT] Error: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # Fallback to rule-based instead of returning error
        fallback_response = _get_engineering_response(message, context)
        return AIChatResponse(
            success=True,
            response=fallback_response
        )


def _get_engineering_response(message: str, context: str = "") -> str:
    """Generate comprehensive rule-based engineering responses when AI is unavailable."""
    msg = message.lower().strip()
    
    # Structure creation intents -> redirect to Generate tab
    creation_keywords = [
        'create', 'make', 'build', 'design', 'generate', 'model',
        'draw', 'construct', 'i want', 'i need', 'can you make',
    ]
    structure_keywords = [
        'beam', 'truss', 'frame', 'bridge', 'building', 'tower',
        'portal', 'cantilever', 'slab', 'shell', 'plate', 'column',
        'warehouse', 'shed', 'arch', 'staircase', 'bheem',
    ]
    
    is_creation = any(k in msg for k in creation_keywords)
    has_structure = any(k in msg for k in structure_keywords)
    
    if is_creation and has_structure:
        suggested_prompt = message.strip()
        if not any(msg.startswith(k) for k in ['create', 'design', 'generate', 'make', 'build']):
            suggested_prompt = f"Create a {suggested_prompt}"
        return (
            f"Great idea! To generate this structure, please switch to the **Generate** tab and type:\n\n"
            f"**\"{suggested_prompt}\"**\n\n"
            f"The AI Architect will create the nodes, members, supports, and loads for you automatically. "
            f"You can then modify it using the **Modify** tab."
        )
    
    # UDL / Load explanations
    if 'udl' in msg or 'uniformly distributed' in msg:
        return (
            "**UDL (Uniformly Distributed Load)** is a load that is evenly spread across the entire length of a member.\n\n"
            "- Symbol: w (kN/m)\n"
            "- Total load = w x L\n"
            "- For simply supported beam: Max BM = wL^2/8, Max Deflection = 5wL^4/(384EI)\n"
            "- IS 875 Part 2 gives live loads: Residential = 2 kN/m^2, Office = 3 kN/m^2\n\n"
            "To add UDL to your model, use the Load panel or type in Generate: "
            "'Create a beam of 8m span with 20 kN/m UDL'"
        )
    
    # Beam topics
    if 'beam' in msg or 'bheem' in msg:
        if 'deflection' in msg:
            return (
                "**Beam Deflection Formulas:**\n\n"
                "- Simply Supported + UDL: d = 5wL^4/(384EI)\n"
                "- Simply Supported + Point Load at center: d = PL^3/(48EI)\n"
                "- Cantilever + UDL: d = wL^4/(8EI)\n"
                "- Cantilever + Point Load: d = PL^3/(3EI)\n\n"
                "IS 800:2007 limits deflection to L/300 for beams and L/150 for cantilevers."
            )
        if 'moment' in msg or 'bending' in msg:
            return (
                "**Bending Moment Formulas:**\n\n"
                "- SS Beam + UDL: M_max = wL^2/8 (at mid-span)\n"
                "- SS Beam + Point Load: M_max = PL/4 (at mid-span)\n"
                "- Cantilever + UDL: M_max = wL^2/2 (at fixed end)\n"
                "- Fixed Beam + UDL: M_support = wL^2/12, M_mid = wL^2/24\n\n"
                "Run analysis to see the BMD for your specific model."
            )
        return (
            "**Beams** are horizontal structural members that resist loads primarily through bending.\n\n"
            "Types: Simply Supported, Cantilever, Fixed, Continuous, Propped Cantilever\n\n"
            "To create a beam, use the Generate tab: 'Create a simply supported beam of 8m span with 20 kN/m UDL'\n\n"
            "Key checks: Bending stress <= 0.66fy, Shear stress <= 0.4fy, Deflection <= L/300"
        )
    
    # Truss topics
    if 'truss' in msg:
        return (
            "**Trusses** are triangulated structures where members carry only axial forces.\n\n"
            "Common types:\n"
            "- **Pratt Truss**: Diagonals in tension under gravity loads\n"
            "- **Howe Truss**: Diagonals in compression\n"
            "- **Warren Truss**: Alternating diagonal directions\n"
            "- **K-Truss**: For longer spans\n\n"
            "Create one: 'Generate a Pratt truss of 24m span with 6 panels'"
        )
    
    # Frame topics
    if 'frame' in msg or 'portal' in msg:
        return (
            "**Frames** are structures with rigid connections between beams and columns.\n\n"
            "- **Portal Frame**: Simple gable frame for warehouses/sheds\n"
            "- **Multi-story Frame**: Building frames with columns and beams\n"
            "- Rigid connections transfer moment, shear, and axial forces\n\n"
            "Design per IS 800:2007 (steel) or IS 456:2000 (concrete)\n\n"
            "Try: 'Create a 3-story building frame with 5m bays'"
        )
    
    # Moment of inertia
    if 'moment of inertia' in msg or 'second moment' in msg:
        return (
            "**Moment of Inertia (I)** measures a cross-section's resistance to bending.\n\n"
            "- Rectangle: I = bd^3/12\n"
            "- Circle: I = pi*d^4/64\n"
            "- I-beam: Use IS section tables (e.g., ISMB 300: Ix = 8603 cm^4)\n\n"
            "Higher I means less deflection and lower bending stress (sigma = My/I)"
        )
    
    # P-Delta
    if 'p-delta' in msg or 'pdelta' in msg or 'p delta' in msg:
        return (
            "**P-Delta Analysis** accounts for the additional moments caused by gravity loads "
            "acting on the laterally displaced structure.\n\n"
            "- P-delta: Member-level (individual element buckling)\n"
            "- P-Delta: Structure-level (global sway effect)\n\n"
            "Important for: Tall buildings, slender columns, seismic analysis.\n"
            "IS 800:2007 Cl. 4.4.2 requires P-Delta for all frames > 5 stories."
        )
    
    # Shear
    if 'shear' in msg:
        return (
            "**Shear Force** is the transverse force at a section of a beam.\n\n"
            "- SS Beam + UDL: V_max = wL/2 (at supports)\n"
            "- SS Beam + Point Load: V_max = P/2\n"
            "- Shear stress check: tau = V/(d*tw) <= 0.4fy (IS 800:2007)\n\n"
            "Run analysis to see the SFD (Shear Force Diagram) for your model."
        )
    
    # IS code references
    if 'is 800' in msg or 'is800' in msg:
        return (
            "**IS 800:2007** - Code of Practice for General Construction in Steel\n\n"
            "Key clauses:\n"
            "- Cl. 5: Members in Tension\n"
            "- Cl. 7: Members in Compression\n"
            "- Cl. 8: Members in Bending\n"
            "- Cl. 10: Connections\n"
            "- Cl. 12: Fatigue\n\n"
            "Uses Limit State Method (LSM) with partial safety factors."
        )
    
    if 'is 456' in msg or 'is456' in msg:
        return (
            "**IS 456:2000** - Code of Practice for Plain and Reinforced Concrete\n\n"
            "Key clauses:\n"
            "- Cl. 26: Development length of bars\n"
            "- Cl. 34: Slabs (one-way/two-way)\n"
            "- Cl. 38: Columns (short/long)\n"
            "- Cl. 40: Footings\n\n"
            "Minimum grade of concrete for RCC: M20"
        )
    
    # Deflection
    if 'deflection' in msg or 'displacement' in msg:
        return (
            "**Deflection** is the displacement of a structural member under load.\n\n"
            "Limits (IS 800:2007):\n"
            "- Beams: L/300 (general), L/240 (crane runway)\n"
            "- Cantilever: L/150\n"
            "- Columns: H/300 (sway)\n\n"
            "To reduce deflection: increase I (use heavier section), reduce span, add supports."
        )
    
    # Load combinations
    if 'load combination' in msg or 'load combo' in msg:
        return (
            "**Load Combinations** per IS 875 Part 5:\n\n"
            "- 1.5(DL + LL)\n"
            "- 1.2(DL + LL + WL)\n"
            "- 1.5(DL + WL)\n"
            "- 0.9DL + 1.5WL\n\n"
            "For seismic (IS 1893): 1.2(DL + LL + EL) and 1.5(DL + EL)"
        )
    
    # Help / generic
    if any(w in msg for w in ['help', 'what can', 'how to', 'guide', 'tutorial']):
        return (
            "I can help you with structural engineering! Here's what I can do:\n\n"
            "**Generate Structures**: Switch to Generate tab and describe your structure\n"
            "   Example: 'Create a simply supported beam of 8m span with 20 kN/m UDL'\n\n"
            "**Modify Models**: Switch to Modify tab to change sections, add loads, etc.\n\n"
            "**Engineering Knowledge**: Ask me about beams, trusses, frames, IS codes, etc.\n\n"
            "Some things to try:\n"
            "- 'What is UDL?'\n"
            "- 'Explain moment of inertia'\n"
            "- 'How to reduce deflection?'\n"
            "- 'IS 800 steel design basics'"
        )
    
    # Default - still helpful
    return (
        f"I understand you're asking about: **{message[:80]}**\n\n"
        "I can help with structural engineering concepts, IS code references, and analysis guidance. "
        "Try asking about specific topics like:\n"
        "- Beam design, UDL, bending moments\n"
        "- Truss types and analysis\n"
        "- Frame design, P-Delta effects\n"
        "- IS 800, IS 456, IS 875 code provisions\n\n"
        "Or use the **Generate** tab to create structures from natural language descriptions!"
    )


@app.get("/ai/status", tags=["AI Chat"])
async def ai_chat_status():
    """Check the status of AI chat capabilities (supplementary to ai_routes.py /ai/status)"""
    return {
        "gemini_configured": bool(GEMINI_API_KEY),
        "mock_mode": USE_MOCK_AI,
        "capabilities": [
            "structure_generation",
            "chat_assistant",
            "model_diagnosis",
            "design_suggestions"
        ] if GEMINI_API_KEY else [
            "structure_generation_basic",
            "mock_responses"
        ],
        "model": "gemini-2.0-flash" if GEMINI_API_KEY else "mock"
    }


# ============================================
# AI MODEL ASSISTANT ENDPOINTS
# NOTE: /ai/diagnose, /ai/fix, /ai/modify, /ai/smart-modify
# are served by ai_routes.py (included via include_router above).
# ============================================


# ============================================
# CONCRETE DESIGN ENDPOINTS
# ============================================

class BeamDesignRequest(BaseModel):
    """Request model for beam design"""
    width: float            # mm
    depth: float            # mm
    cover: float = 40       # mm
    Mu: float               # kNm - Design moment
    Vu: float               # kN - Design shear
    fck: float = 25         # MPa - Concrete grade
    fy: float = 500         # MPa - Steel grade


class ColumnDesignRequest(BaseModel):
    """Request model for column design"""
    width: float            # mm
    depth: float            # mm
    cover: float = 40       # mm
    Pu: float               # kN - Axial load
    Mux: float = 0          # kNm - Moment about x-axis
    Muy: float = 0          # kNm - Moment about y-axis
    unsupported_length: float  # mm
    effective_length_factor: float = 1.0
    fck: float = 25
    fy: float = 500


class SlabDesignRequest(BaseModel):
    """Request model for slab design"""
    lx: float               # m - Shorter span
    ly: float = 0           # m - Longer span (0 for one-way)
    live_load: float        # kN/m²
    floor_finish: float = 1.0  # kN/m²
    support_type: str = 'simple'  # simple, continuous, cantilever
    edge_conditions: str = 'all_simple'  # For two-way slabs
    fck: float = 25
    fy: float = 500


@app.post("/design/beam", tags=["Design"])
async def design_beam(request: BeamDesignRequest):
    """
    Design RC beam per IS 456:2000
    
    Returns reinforcement details for flexure and shear
    """
    try:
        from design.concrete.is456 import IS456Designer, BeamSection
        
        designer = IS456Designer(fck=request.fck, fy=request.fy)
        section = BeamSection(
            width=request.width,
            depth=request.depth,
            effective_depth=request.depth - request.cover - 10,
            cover=request.cover
        )
        
        result = designer.design_beam(section, request.Mu, request.Vu)
        
        return {
            "success": True,
            "tension_steel": {
                "diameter": result.tension_steel.diameter,
                "count": result.tension_steel.count,
                "area": round(result.tension_steel.area, 1)
            },
            "compression_steel": {
                "diameter": result.compression_steel.diameter,
                "count": result.compression_steel.count,
                "area": round(result.compression_steel.area, 1)
            } if result.compression_steel else None,
            "stirrups": {
                "diameter": result.stirrups.diameter,
                "legs": result.stirrups.count,
                "spacing": result.stirrups.spacing
            },
            "Mu_capacity": round(result.Mu_capacity, 2),
            "Vu_capacity": round(result.Vu_capacity, 2),
            "status": result.status,
            "checks": result.checks
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/design/column", tags=["Design"])
async def design_column(request: ColumnDesignRequest):
    """
    Design RC column per IS 456:2000
    
    Handles axial load with biaxial bending
    """
    try:
        from design.concrete.is456 import IS456Designer, ColumnSection
        
        designer = IS456Designer(fck=request.fck, fy=request.fy)
        section = ColumnSection(
            width=request.width,
            depth=request.depth,
            cover=request.cover
        )
        
        result = designer.design_column(
            section,
            Pu=request.Pu,
            Mux=request.Mux,
            Muy=request.Muy,
            unsupported_length=request.unsupported_length,
            effective_length_factor=request.effective_length_factor
        )
        
        return {
            "success": True,
            "longitudinal_steel": [
                {
                    "diameter": bar.diameter,
                    "count": bar.count,
                    "area": round(bar.area, 1)
                }
                for bar in result.longitudinal_steel
            ],
            "ties": {
                "diameter": result.ties.diameter,
                "spacing": result.ties.spacing
            },
            "Pu_capacity": round(result.Pu_capacity, 2),
            "Mux_capacity": round(result.Mux_capacity, 2),
            "Muy_capacity": round(result.Muy_capacity, 2),
            "interaction_ratio": round(result.interaction_ratio, 3),
            "status": result.status,
            "checks": result.checks
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/design/slab", tags=["Design"])
async def design_slab(request: SlabDesignRequest):
    """
    Design RC slab per IS 456:2000
    
    Supports one-way and two-way slabs
    """
    try:
        from design.concrete.slab import (
            SlabDesigner, SlabLoading, SlabPanel, EdgeCondition,
            design_simply_supported_slab, design_two_way_floor_slab
        )
        
        # Determine slab type
        if request.ly == 0 or request.ly / request.lx > 2:
            # One-way slab
            result = design_simply_supported_slab(
                span=request.lx,
                live_load=request.live_load,
                fck=request.fck,
                fy=request.fy,
                floor_finish=request.floor_finish
            )
        else:
            # Two-way slab
            result = design_two_way_floor_slab(
                lx=request.lx,
                ly=request.ly,
                live_load=request.live_load,
                edge_conditions=request.edge_conditions,
                fck=request.fck,
                fy=request.fy
            )
        
        return {
            "success": True,
            "thickness": result.thickness,
            "main_reinforcement": {
                "diameter": result.main_reinforcement.diameter,
                "spacing": result.main_reinforcement.spacing,
                "area_per_m": round(result.main_reinforcement.area_per_m, 1),
                "direction": result.main_reinforcement.direction
            },
            "distribution_reinforcement": {
                "diameter": result.distribution_reinforcement.diameter,
                "spacing": result.distribution_reinforcement.spacing,
                "area_per_m": round(result.distribution_reinforcement.area_per_m, 1),
                "direction": result.distribution_reinforcement.direction
            },
            "top_reinforcement": {
                "diameter": result.top_reinforcement.diameter,
                "spacing": result.top_reinforcement.spacing,
                "area_per_m": round(result.top_reinforcement.area_per_m, 1)
            } if result.top_reinforcement else None,
            "Mu_capacity": round(result.Mu_capacity, 2),
            "Mu_demand": round(result.Mu_demand, 2),
            "deflection_check": round(result.deflection_check, 1),
            "deflection_limit": round(result.deflection_limit, 1),
            "status": result.status,
            "checks": result.checks
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================
# LOAD GENERATION ENDPOINTS (ASCE 7, IS 1893, IS 875)
# ============================================

class ASCE7SeismicRequest(BaseModel):
    """ASCE 7 Seismic Load Request"""
    Ss: float = 1.0  # Short-period spectral acceleration
    S1: float = 0.4  # 1-second spectral acceleration
    site_class: str = "D"  # A-F
    risk_category: int = 2  # I-IV
    structural_system: str = "SMF_S"  # See StructuralSystem enum
    height: float = 30.0  # meters
    direction: str = "X"
    nodes: Optional[Dict[str, Dict]] = None
    dead_loads: Optional[Dict[str, float]] = None
    live_loads: Optional[Dict[str, float]] = None


class ASCE7WindRequest(BaseModel):
    """ASCE 7 Wind Load Request"""
    V: float = 115.0  # Basic wind speed (mph)
    exposure: str = "C"  # B, C, D
    height: float = 30.0  # meters
    width: float = 20.0  # meters
    length: float = 30.0  # meters
    direction: str = "X"
    nodes: Optional[Dict[str, Dict]] = None


class IS1893SeismicRequest(BaseModel):
    """IS 1893 Seismic Load Request"""
    zone: int = 3  # II-V
    soil_type: str = "MEDIUM"  # ROCK, MEDIUM, SOFT
    building_type: str = "SMRF"  # OMRF, SMRF, etc.
    importance: str = "ORDINARY"  # ORDINARY, IMPORTANT, CRITICAL
    height: float = 30.0
    direction: str = "X"
    nodes: Optional[Dict[str, Dict]] = None
    dead_loads: Optional[Dict[str, float]] = None
    live_loads: Optional[Dict[str, float]] = None


class LoadCombinationRequest(BaseModel):
    """Load Combinations Request"""
    codes: List[str] = ["ASCE7_LRFD", "IS456_LSM"]  # Design codes to include
    custom_combinations: Optional[List[Dict]] = None  # User-defined


@app.post("/load-generation/asce7-seismic", tags=["Load Generation"])
async def generate_asce7_seismic_loads(request: ASCE7SeismicRequest):
    """
    Generate seismic loads per ASCE 7-22 Equivalent Lateral Force procedure.
    
    Returns base shear, story forces, and nodal loads.
    """
    try:
        from analysis.generators.asce7_seismic import (
            ASCE7SeismicGenerator, ASCE7SeismicParams,
            SiteClass, RiskCategory, StructuralSystem
        )
        
        params = ASCE7SeismicParams(
            Ss=request.Ss,
            S1=request.S1,
            site_class=SiteClass(request.site_class),
            risk_category=RiskCategory(request.risk_category),
            structural_system=StructuralSystem(request.structural_system),
            height=request.height,
            direction=request.direction
        )
        
        generator = ASCE7SeismicGenerator(params)
        
        nodes = request.nodes or {}
        dead_loads = request.dead_loads or {}
        live_loads = request.live_loads or {}
        
        result = generator.analyze(nodes, dead_loads, live_loads)
        
        return {
            "success": result.success,
            "code": "ASCE 7-22",
            "method": "Equivalent Lateral Force",
            "parameters": {
                "Ss": request.Ss,
                "S1": request.S1,
                "Fa": round(result.Fa, 3),
                "Fv": round(result.Fv, 3),
                "SDS": round(result.SDS, 3),
                "SD1": round(result.SD1, 3),
            },
            "period": {
                "Ta": round(result.Ta, 3),
                "T_used": round(result.T, 3),
                "Cu": round(result.Cu, 2)
            },
            "design": {
                "SDC": result.SDC,
                "R": result.R,
                "Ie": result.Ie,
                "Cs": round(result.Cs, 4)
            },
            "forces": {
                "W": round(result.W, 2),
                "V": round(result.V, 2),
                "V_percent_W": round(result.Cs * 100, 2)
            },
            "story_forces": [
                {
                    "level": s.level,
                    "height": round(s.height, 2),
                    "weight": round(s.seismic_weight, 2),
                    "force": round(s.lateral_force, 2),
                    "shear": round(s.shear, 2)
                }
                for s in result.story_forces
            ],
            "nodal_loads": result.nodal_loads
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/load-generation/asce7-wind", tags=["Load Generation"])
async def generate_asce7_wind_loads(request: ASCE7WindRequest):
    """
    Generate wind loads per ASCE 7-22 Directional Procedure.
    
    Returns velocity pressures and nodal loads.
    """
    try:
        from analysis.generators.asce7_wind import (
            ASCE7WindGenerator, ASCE7WindParams, ExposureCategory
        )
        
        params = ASCE7WindParams(
            V=request.V,
            exposure=ExposureCategory(request.exposure),
            height=request.height,
            width=request.width,
            length=request.length,
            direction=request.direction
        )
        
        generator = ASCE7WindGenerator(params)
        
        nodes = request.nodes or {}
        result = generator.analyze(nodes)
        
        return {
            "success": result.success,
            "code": "ASCE 7-22",
            "method": "Directional Procedure",
            "parameters": {
                "V": request.V,
                "exposure": request.exposure,
                "Kd": round(result.Kd, 2),
                "Ke": round(result.Ke, 3),
                "Kz": round(result.Kz, 3),
                "Kzt": round(result.Kzt, 3)
            },
            "pressures": {
                "qh": round(result.qh, 3),
                "GCpi": round(result.GCpi, 2),
                "Cp_windward": result.Cp_windward,
                "Cp_leeward": result.Cp_leeward,
                "Cp_side": result.Cp_side,
                "Cp_roof": result.Cp_roof
            },
            "forces": {
                "base_shear_kN": round(result.total_base_shear, 2),
                "overturning_moment_kNm": round(result.total_overturning_moment, 2)
            },
            "pressure_at_heights": [
                {
                    "height": round(p.height, 2),
                    "qz": round(p.qz, 3),
                    "Kz": round(p.Kz, 3),
                    "p_windward": round(p.p_windward, 3),
                    "p_leeward": round(p.p_leeward, 3),
                    "p_net": round(p.p_net, 3)
                }
                for p in result.pressures
            ],
            "nodal_loads": result.nodal_loads
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/load-generation/is1893-seismic", tags=["Load Generation"])
async def generate_is1893_seismic_loads(request: IS1893SeismicRequest):
    """
    Generate seismic loads per IS 1893:2016 Static Method.
    
    Indian seismic code implementation.
    """
    try:
        from analysis.generators.auto_loads import (
            SeismicLoadGenerator, SeismicParameters,
            SeismicZone, SoilType, BuildingType, ImportanceCategory
        )
        
        # Map inputs to enums
        zone_map = {2: SeismicZone.II, 3: SeismicZone.III, 4: SeismicZone.IV, 5: SeismicZone.V}
        soil_map = {"ROCK": SoilType.ROCK, "MEDIUM": SoilType.MEDIUM, "SOFT": SoilType.SOFT}
        building_map = {
            "OMRF": BuildingType.ORDINARY_RC_MRF,
            "SMRF": BuildingType.SPECIAL_RC_MRF,
            "OSMRF": BuildingType.ORDINARY_STEEL_MRF,
            "SSMRF": BuildingType.SPECIAL_STEEL_MRF,
            "BF": BuildingType.BRACED_FRAME,
            "SW": BuildingType.SHEAR_WALL,
            "DUAL": BuildingType.DUAL_SYSTEM
        }
        importance_map = {
            "ORDINARY": ImportanceCategory.ORDINARY,
            "IMPORTANT": ImportanceCategory.IMPORTANT,
            "CRITICAL": ImportanceCategory.CRITICAL
        }
        
        params = SeismicParameters(
            zone=zone_map.get(request.zone, SeismicZone.III),
            soil_type=soil_map.get(request.soil_type.upper(), SoilType.MEDIUM),
            building_type=building_map.get(request.building_type.upper(), BuildingType.SPECIAL_RC_MRF),
            importance=importance_map.get(request.importance.upper(), ImportanceCategory.ORDINARY),
            height=request.height,
            direction=request.direction
        )
        
        generator = SeismicLoadGenerator(params)
        
        # Compute
        nodes = request.nodes or {}
        dead_loads = request.dead_loads or {}
        live_loads = request.live_loads or {}
        
        if nodes and dead_loads:
            generator.compute_floor_masses(nodes, dead_loads, live_loads)
            generator.calculate_base_shear()
            generator.distribute_lateral_forces()
            generator.generate_nodal_loads()
        
        return {
            "success": True,
            "code": "IS 1893:2016",
            "method": "Equivalent Static Method",
            "parameters": {
                "zone": f"Zone {request.zone}",
                "Z": round(params.zone.factor(), 2),
                "soil_type": request.soil_type,
                "I": round(params.importance.factor(), 2),
                "R": round(params.building_type.R(), 2)
            },
            "analysis": {
                "Ta": round(generator.calculate_period(), 3),
                "Sa_g": round(generator.calculate_Sa_g(generator.calculate_period()), 3),
                "Ah": round(generator.calculate_Ah(), 4)
            },
            "forces": {
                "W": round(generator.total_weight, 2) if hasattr(generator, 'total_weight') else 0,
                "Vb": round(generator.base_shear, 2) if hasattr(generator, 'base_shear') else 0
            },
            "story_forces": generator.get_summary() if hasattr(generator, 'get_summary') else {},
            "nodal_loads": generator.nodal_loads if hasattr(generator, 'nodal_loads') else []
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/load-combinations/generate", tags=["Load Generation"])
async def generate_load_combinations(request: LoadCombinationRequest):
    """
    Generate load combinations per specified design codes.
    
    Supports:
    - ASCE 7 LRFD/ASD
    - IS 456 LSM
    - ACI 318
    - User-defined combinations
    """
    try:
        from analysis.generators.load_combinations import (
            LoadCombinationsManager, LoadCombination, LoadFactor, DesignCode
        )
        
        manager = LoadCombinationsManager()
        
        # Load predefined combinations
        code_map = {
            "ASCE7_LRFD": DesignCode.ASCE7_LRFD,
            "ASCE7_ASD": DesignCode.ASCE7_ASD,
            "IS456_LSM": DesignCode.IS456_LSM,
            "ACI318": DesignCode.ACI318
        }
        
        for code_name in request.codes:
            code = code_map.get(code_name.upper())
            if code:
                manager.load_predefined(code)
        
        # Add custom combinations
        if request.custom_combinations:
            for custom in request.custom_combinations:
                manager.add_user_combination(
                    name=custom.get("name", "Custom"),
                    factors=custom.get("factors", {}),
                    description=custom.get("description", "")
                )
        
        summary = manager.get_summary()
        
        return {
            "success": True,
            "total_combinations": summary["total_combinations"],
            "active_combinations": summary["active_combinations"],
            "user_defined": summary["user_defined"],
            "codes_included": list(set(request.codes)),
            "combinations": [
                {
                    "id": c.id,
                    "name": c.name,
                    "code": c.code,
                    "expression": c.format_expression(),
                    "factors": [{"type": f.load_type, "factor": f.factor} for f in c.factors],
                    "is_user_defined": c.is_user_defined
                }
                for c in manager.combinations
            ]
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/load-combinations/available", tags=["Load Generation"])
async def get_available_combinations():
    """
    Get all available predefined load combinations organized by code.
    """
    try:
        from analysis.generators.load_combinations import get_all_available_combinations
        
        all_combos = get_all_available_combinations()
        
        return {
            "codes": list(all_combos.keys()),
            "combinations": {
                code: [
                    {
                        "id": c.id,
                        "name": c.name,
                        "expression": c.format_expression()
                    }
                    for c in combos
                ]
                for code, combos in all_combos.items()
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================
# ADVANCED STRUCTURAL ANALYSIS & DESIGN ENDPOINTS
# ============================================

from analysis.model_validator import validate_model
from is_codes import (
    check_member_is800, calculate_floor_loads, 
    calculate_wind_pressure, design_beam_flexure,
    calculate_base_shear
)

class SteelDesignRequest(BaseModel):
    section: str = "ISMB300"
    grade: str = "E250"
    Pu: float = 0
    Mux: float = 0
    Muy: float = 0
    Lx: float = 3000
    Ly: float = 3000
    Lb: float = 3000

class FloorLoadRequest(BaseModel):
    occupancy: str = "residential"
    slabThickness: float = 150
    floorFinish: str = "tiles"
    area: float = 20
    floors: int = 1

class WindLoadRequest(BaseModel):
    city: str = "Mumbai"
    windSpeed: float = 44
    height: float = 10
    terrainCategory: int = 2


class ValidateModelRequest(BaseModel):
    """Constrained model for structural validation requests."""
    nodes: List[Dict[str, Any]] = Field(..., max_length=50000, description="List of node definitions")
    members: List[Dict[str, Any]] = Field(default=[], max_length=50000, description="List of member definitions")
    loads: List[Dict[str, Any]] = Field(default=[], max_length=50000, description="Load definitions")
    node_loads: List[Dict[str, Any]] = Field(default=[], max_length=50000)
    distributed_loads: List[Dict[str, Any]] = Field(default=[], max_length=50000)
    supports: List[Dict[str, Any]] = Field(default=[], max_length=50000)

    class Config:
        extra = "allow"


@app.post("/analyze/validate", tags=["Advanced Analysis"])
async def validate_structure_model(request: ValidateModelRequest):
    """
    Validate structural model before analysis.
    Checks for stability, connectivity, and geometry issues.
    """
    try:
        return validate_model(request.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/design/steel/check", tags=["IS Codes Design"])
async def check_steel_member(request: SteelDesignRequest):
    """
    Check steel member capacity per IS 800:2007.
    """
    try:
        return check_member_is800(
            section_name=request.section,
            steel_grade=request.grade,
            Pu=request.Pu,
            Mux=request.Mux,
            Muy=request.Muy,
            Lx=request.Lx,
            Ly=request.Ly,
            Lb=request.Lb
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/design/loads/floor", tags=["IS Codes Design"])
async def generate_floor_loads(request: FloorLoadRequest):
    """
    Calculate floor loads per IS 875 Part 1 & 2.
    """
    try:
        return calculate_floor_loads(
            occupancy=request.occupancy,
            slab_thickness_mm=request.slabThickness,
            floor_finish=request.floorFinish,
            tributary_area=request.area,
            num_floors=request.floors
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/design/loads/wind", tags=["IS Codes Design"])
async def generate_wind_loads(request: WindLoadRequest):
    """
    Calculate wind loads per IS 875 Part 3.
    """
    try:
        # Map terrain integer to enum if needed, or handle in service
        from is_codes import TerrainCategory
        terrain_map = {1: TerrainCategory.CATEGORY_1, 2: TerrainCategory.CATEGORY_2, 
                       3: TerrainCategory.CATEGORY_3, 4: TerrainCategory.CATEGORY_4}
        
        return calculate_wind_pressure(
            Vb=request.windSpeed,
            height=request.height,
            terrain=terrain_map.get(request.terrainCategory, TerrainCategory.CATEGORY_2)
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class ConcreteDesignRequest(BaseModel):
    b: float = 230
    D: float = 450
    cover: float = 25
    fck: str = "M20"
    fy: str = "Fe415"
    Mu: float = 50 # kN·m

@app.post("/design/concrete/beam", tags=["IS Codes Design"])
async def design_concrete_beam(request: ConcreteDesignRequest):
    """
    Design concrete beam reinforcement per IS 456:2000.
    """
    try:
        return design_beam_flexure(
            b=request.b,
            D=request.D,
            cover=request.cover,
            fck=request.fck,
            fy=request.fy,
            Mu=request.Mu
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class SeismicLoadRequest(BaseModel):
    weight: float = 1000 # kN
    height: float = 12 # m
    zone: str = "III"
    soilType: int = 2 # Medium

@app.post("/design/loads/seismic", tags=["IS Codes Design"])
async def calculate_seismic_loads(request: SeismicLoadRequest):
    """
    Calculate seismic base shear per IS 1893:2016.
    """
    try:
        from is_codes import SeismicZone, SoilType, calculate_period_approx
        
        # Approximate period if not provided
        T = calculate_period_approx(request.height)
        
        zone_map = {"II": SeismicZone.II, "III": SeismicZone.III, "IV": SeismicZone.IV, "V": SeismicZone.V}
        soil_map = {1: SoilType.HARD, 2: SoilType.MEDIUM, 3: SoilType.SOFT}
        
        return calculate_base_shear(
            W=request.weight,
            T=T,
            zone=zone_map.get(request.zone, SeismicZone.III),
            soil_type=soil_map.get(request.soilType, SoilType.MEDIUM)
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))



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
