"""
Middleware setup and configuration.

CORS, security middleware, body-size limits, and request logging.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from logging_config import get_logger

logger = get_logger(__name__)


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    """Reject requests with Content-Length exceeding the configured limit."""

    def __init__(self, app, max_body_size_bytes: int):
        super().__init__(app)
        self.max_body_size_bytes = max_body_size_bytes

    async def dispatch(self, request, call_next):
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > self.max_body_size_bytes:
                    return JSONResponse(
                        status_code=413,
                        content={
                            "success": False,
                            "error": f"Request body too large (max {self.max_body_size_bytes // (1024*1024)} MB)",
                            "code": 413,
                        },
                    )
            except (ValueError, TypeError):
                pass  # Non-numeric Content-Length — let downstream handle it
        return await call_next(request)


def setup_middleware(app: FastAPI, config: dict, has_security_middleware: bool):
    """
    Configure all middleware for the FastAPI application.
    
    Middleware order (applied in reverse registration order):
    1. CORS (executes last, closest to route handlers)
    2. Request logging
    3. Security headers
    4. Auth verification
    5. Rate limiting (executes first, furthest from handlers)
    
    Args:
        app: FastAPI application instance.
        config: Configuration dict from load_app_config().
        has_security_middleware: Whether security_middleware module is available.
    """
    # CORS Middleware - registered first (executes last in chain)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config["allow_origins"],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
    )
    
    # Request logging middleware
    from request_logging import RequestLoggingMiddleware
    app.add_middleware(RequestLoggingMiddleware)
    
    # Security middleware stack
    if has_security_middleware:
        try:
            from security_middleware import OriginValidationMiddleware, RateLimitMiddleware, AuthMiddleware, SecurityHeadersMiddleware
            app.add_middleware(SecurityHeadersMiddleware)
            app.add_middleware(AuthMiddleware)
            app.add_middleware(RateLimitMiddleware)
            app.add_middleware(OriginValidationMiddleware, allowed_origins=config["allow_origins"])
            logger.info("Security middleware active: origin validation, rate limiting, auth verification, security headers")
        except ImportError as e:
            logger.warning("Could not load security middleware components: %s", e)
    
    # Deprecation headers middleware — signals unversioned route sunset
    try:
        from middleware_deprecation import DeprecationHeaderMiddleware
        app.add_middleware(DeprecationHeaderMiddleware)
        logger.info("Deprecation headers middleware active (sunset: 2026-09-30)")
    except ImportError as e:
        logger.warning("Could not load deprecation middleware: %s", e)
    
    # Body size limit middleware (registered last, executes second — before CORS)
    max_body_size_bytes = config["max_body_size_mb"] * 1024 * 1024
    app.add_middleware(BodySizeLimitMiddleware, max_body_size_bytes=max_body_size_bytes)
    logger.info("Body size limit configured: %d MB", config["max_body_size_mb"])
