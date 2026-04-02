"""Health and readiness routes for the FastAPI app."""

import importlib
import importlib.util
import time
from datetime import datetime

from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(tags=["Health"])


@router.get("/")
async def root(app_version: str = "2.1.0"):
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "BeamLab Structural Engine",
        "version": app_version,
        "components": {
            "models": "ok",
            "factory": "ok",
            "ai_routes": "ok",
            "report_generator": "ok",
        },
    }


@router.get("/health")
async def health_check(app_version: str = "2.1.0"):
    """Detailed health check."""
    try:
        from analysis.rust_interop import RustInteropClient

        client = RustInteropClient()
        circuit_open = client._circuit_open()
        failures = client._cb_failures
        reset_in = max(0.0, client._cb_open_until - time.time())
    except Exception:
        circuit_open = False
        failures = 0
        reset_in = 0.0

    return {
        "status": "ok",
        "version": app_version,
        "rust_circuit": {
            "open": circuit_open,
            "failures": failures,
            "reset_in_sec": round(reset_in, 2),
        },
    }


@router.get("/api/health")
async def api_health_alias():
    return await health_check()


@router.get("/api/health/ready")
async def api_health_ready_alias():
    return await health_ready()


@router.get("/health/ready")
async def health_ready():
    """Readiness probe."""
    return {
        "status": "ready",
        "timestamp": datetime.now().isoformat(),
    }


@router.get("/health/dependencies")
async def health_dependencies(node_api_url: str, rust_api_url: str):
    """Check connectivity to dependent backend services (Node + Rust)."""
    if importlib.util.find_spec("httpx") is None:
        return {
            "status": "degraded",
            "python": "ok",
            "node": "unknown",
            "rust": "unknown",
            "error": "httpx not installed",
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

    node_result, rust_result = await importlib.import_module("asyncio").gather(
        check_service("node", node_api_url),
        check_service("rust", rust_api_url),
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
        },
    }
