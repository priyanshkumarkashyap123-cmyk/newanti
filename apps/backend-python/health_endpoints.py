"""
Health check and status endpoints.

Provides /health, /api/health, /health/ready, /health/dependencies, and root endpoints.
"""

import asyncio
import importlib
import importlib.util
import time
from datetime import datetime
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from logging_config import get_logger

logger = get_logger(__name__)


def register_health_endpoints(
    app: FastAPI,
    has_models: bool,
    has_factory: bool,
    has_ai_routes: bool,
    has_report_gen: bool,
    node_api_url: str,
    rust_api_url: str,
):
    """
    Register all health check and status endpoints.
    
    Args:
        app: FastAPI application instance.
        has_models: Whether models module loaded successfully.
        has_factory: Whether factory module loaded successfully.
        has_ai_routes: Whether AI routes module loaded successfully.
        has_report_gen: Whether report generator module loaded successfully.
        node_api_url: URL of Node.js backend service.
        rust_api_url: URL of Rust backend service.
    """

    @app.get("/", tags=["Health"])
    async def root():
        """Health check endpoint."""
        return {
            "status": "healthy",
            "service": "BeamLab Structural Engine",
            "version": app.version,
            "components": {
                "models": "ok" if has_models else "degraded",
                "factory": "ok" if has_factory else "degraded",
                "ai_routes": "ok" if has_ai_routes else "degraded",
                "report_generator": "ok" if has_report_gen else "degraded",
            },
        }

    @app.get("/health", tags=["Health"])
    async def health_check():
        """Detailed health check. Returns { status: 'ok', version: '<semver>' }"""
        try:
            from analysis.rust_interop import RustInteropClient

            client = RustInteropClient()
            circuit_open = client._circuit_open()  # introspection for health payload
            failures = client._cb_failures
            reset_in = max(0.0, client._cb_open_until - time.time())
        except Exception:
            circuit_open = False
            failures = 0
            reset_in = 0.0

        return {
            "status": "ok",
            "version": app.version,
            "rust_circuit": {
                "open": circuit_open,
                "failures": failures,
                "reset_in_sec": round(reset_in, 2),
            },
        }

    @app.get("/api/health", tags=["Health"])
    async def api_health_alias():
        """Compatibility alias for deployments that probe /api/health."""
        return await health_check()

    @app.get("/api/health/ready", tags=["Health"])
    async def api_health_ready_alias():
        """Compatibility alias for deployments that probe /api/health/ready."""
        return await health_ready()

    @app.get("/health/ready", tags=["Health"])
    async def health_ready():
        """
        Kubernetes readiness probe: only returns 200 after full initialization.

        Used by Azure orchestration to determine when container is ready to accept traffic.
        Unlike /health which responds immediately, this endpoint confirms:
        - All modules loaded successfully
        - Worker pools initialized
        - Database connectivity established

        Returns 503 if critical services not yet ready (during startup).
        """
        if not all([has_models, has_factory, has_ai_routes, has_report_gen]):
            return JSONResponse(
                status_code=503,
                content={
                    "status": "not_ready",
                    "models": "ok" if has_models else "initializing",
                    "factory": "ok" if has_factory else "initializing",
                    "ai_routes": "ok" if has_ai_routes else "initializing",
                    "report_generator": "ok" if has_report_gen else "initializing",
                },
            )

        return {
            "status": "ready",
            "timestamp": datetime.now().isoformat(),
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

        node_result, rust_result = await asyncio.gather(
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

    logger.info("Health check endpoints registered")
