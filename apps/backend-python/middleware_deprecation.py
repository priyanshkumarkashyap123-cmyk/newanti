"""
Deprecation headers middleware for signaling API versioning sunsets.

Adds Deprecation, Sunset, and Link headers to responses to guide clients
toward versioned endpoints or alternative representations.
"""

from datetime import datetime, timedelta, timezone
from starlette.middleware.base import BaseHTTPMiddleware
from logging_config import get_logger

logger = get_logger(__name__)


class DeprecationHeaderMiddleware(BaseHTTPMiddleware):
    """
    Inject deprecation headers into all responses.
    
    This signals to clients that unversioned routes will be phased out.
    Sunset date: 2026-09-30 (6 months from current implementation).
    """

    # Sunset date (6 months from now)
    SUNSET_DATE = (datetime.now(timezone.utc) + timedelta(days=180)).strftime("%a, %d %b %Y %H:%M:%S GMT")

    async def dispatch(self, request, call_next):
        response = await call_next(request)
        
        # Add deprecation headers to all responses
        # (In the future, these can be condition-based if versioned routes exist)
        response.headers["Deprecation"] = "true"
        response.headers["Sunset"] = self.SUNSET_DATE
        response.headers["Link"] = '<https://docs.beamlabultimate.tech/api-versioning>; rel="successor-version", <https://docs.beamlabultimate.tech/migration-guide>; rel="migration"'
        
        return response
