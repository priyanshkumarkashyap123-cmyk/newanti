"""
request_logging.py - FastAPI middleware for structured request/response logging.

Logs every request with:
- method, path, status_code, duration_ms, client_ip, request_id
- Errors include exception type and stack trace
"""

import time
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from logging_config import get_logger

logger = get_logger("http")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware that logs every HTTP request with timing and metadata."""

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("x-request-id", str(uuid.uuid4())[:8])
        start = time.perf_counter()

        # Attach request_id to request state for downstream use
        request.state.request_id = request_id

        try:
            response = await call_next(request)
        except Exception as exc:
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            logger.error(
                f"{request.method} {request.url.path} 500 ({duration_ms}ms)",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": 500,
                    "duration_ms": duration_ms,
                    "client_ip": request.client.host if request.client else "unknown",
                    "error": str(exc),
                    "error_type": type(exc).__name__,
                },
                exc_info=True,
            )
            raise

        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        status = response.status_code

        log_extra = {
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": status,
            "duration_ms": duration_ms,
            "client_ip": request.client.host if request.client else "unknown",
        }

        if status >= 500:
            logger.error(f"{request.method} {request.url.path} {status} ({duration_ms}ms)", extra=log_extra)
        elif status >= 400:
            logger.warning(f"{request.method} {request.url.path} {status} ({duration_ms}ms)", extra=log_extra)
        else:
            # Skip health check noise
            if request.url.path not in ("/", "/health", "/docs", "/openapi.json", "/redoc"):
                logger.info(f"{request.method} {request.url.path} {status} ({duration_ms}ms)", extra=log_extra)

        # Pass request_id downstream in response headers
        response.headers["X-Request-Id"] = request_id
        return response
