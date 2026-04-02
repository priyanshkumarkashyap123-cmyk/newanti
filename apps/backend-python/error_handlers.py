"""
Global exception handlers and error responses.

Unified error response format: { success: false, error: str, code: int }
"""

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.requests import Request
from logging_config import get_logger

logger = get_logger(__name__)


def setup_error_handlers(app: FastAPI, is_production: bool):
    """
    Register all global exception handlers for the FastAPI application.
    
    Args:
        app: FastAPI application instance.
        is_production: Whether running in production environment.
    """

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """Return Pydantic validation errors in the shared { success, error, code } format."""
        messages = [f"{e.get('loc', ['?'])[-1]}: {e.get('msg', 'invalid')}" for e in exc.errors()]
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "error": "; ".join(messages),
                "code": 422,
                "detail": "; ".join(messages),
            },
        )

    @app.exception_handler(HTTPException)
    async def sanitized_http_exception_handler(request: Request, exc: HTTPException):
        """Return errors in the shared { success, error, code } format used by Node/Rust APIs."""
        error_message = exc.detail
        if is_production and exc.status_code >= 500:
            logger.error("Internal error on %s %s: %s", request.method, request.url.path, exc.detail)
            error_message = "Internal server error. Please try again later."
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": error_message,
                "code": exc.status_code,
                "detail": error_message,
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        """Catch-all for unhandled exceptions — never leak stack traces."""
        logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
        error_message = "Internal server error. Please try again later." if is_production else str(exc)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": error_message,
                "code": 500,
                "detail": error_message,
            },
        )

    logger.info("Global exception handlers registered")
