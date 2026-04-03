"""
security_middleware.py — Rate limiting and authentication for the Python API.

Provides:
  1. In-memory sliding-window rate limiter
  2. JWT/Clerk token verification middleware
  3. Security headers middleware
"""

import time
import os
import hashlib
import hmac
from collections import defaultdict
from urllib.parse import urlsplit
from typing import Optional, Dict, Tuple
from functools import lru_cache

from fastapi import Request, Response, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from logging_config import get_logger

logger = get_logger(__name__)

# ─────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────

RATE_LIMIT_GENERAL = int(os.getenv("RATE_LIMIT_GENERAL", "200"))  # req/min
RATE_LIMIT_ANALYSIS = int(os.getenv("RATE_LIMIT_ANALYSIS", "30"))  # req/min
RATE_LIMIT_AI = int(os.getenv("RATE_LIMIT_AI", "30"))  # req/min
RATE_WINDOW_SEC = 60

# Public paths that skip authentication
# Only expose API docs publicly in dev; require auth in production
_DOC_PATHS = frozenset({"/docs", "/redoc", "/openapi.json"})
_BASE_PUBLIC = frozenset({
    "/", "/health", "/health/dependencies",
    # SECURITY: /stress/calculate removed from public paths — it's a
    # compute-heavy endpoint that must require auth to prevent DoS abuse.
    "/design/codes",  # Read-only catalog of supported design codes
})
PUBLIC_PATHS = _BASE_PUBLIC | (_DOC_PATHS if os.getenv("ENVIRONMENT", "development") != "production" else frozenset())
# Public design check endpoints should be unauthenticated
design_public = {"/concrete/check"}
PUBLIC_PATHS |= design_public
# Allow design endpoints publicly
PUBLIC_PATHS = PUBLIC_PATHS | {"/concrete/check"}

# Paths that get the stricter analysis rate limit
ANALYSIS_PATHS = ("/analyze", "/ai/", "/jobs/", "/generate/")

JWT_SECRET = os.getenv("JWT_SECRET", "")
INTERNAL_SIGNATURE_MAX_SKEW_SEC = int(os.getenv("INTERNAL_SIGNATURE_MAX_SKEW_SEC", "120"))
INTERNAL_NONCE_TTL_SEC = int(os.getenv("INTERNAL_NONCE_TTL_SEC", "180"))

_internal_nonce_cache: Dict[str, int] = {}
_internal_nonce_last_cleanup = 0.0


def _cleanup_internal_nonce_cache(now_sec: int) -> None:
    global _internal_nonce_last_cleanup
    # Cleanup at most once every 30s to keep overhead low.
    if now_sec - _internal_nonce_last_cleanup < 30:
        return
    expired = [nonce for nonce, expiry in _internal_nonce_cache.items() if expiry <= now_sec]
    for nonce in expired:
        _internal_nonce_cache.pop(nonce, None)
    _internal_nonce_last_cleanup = float(now_sec)


def _reserve_internal_nonce(nonce: str, now_sec: int) -> bool:
    _cleanup_internal_nonce_cache(now_sec)
    if nonce in _internal_nonce_cache:
        return False
    _internal_nonce_cache[nonce] = now_sec + INTERNAL_NONCE_TTL_SEC
    return True


# ─────────────────────────────────────────────────
# Rate Limiter (sliding-window counter)
# ─────────────────────────────────────────────────

class _RateLimiter:
    """Thread-safe in-memory sliding-window rate limiter."""

    def __init__(self) -> None:
        # { key: [(timestamp, ...), ...] }
        self._store: Dict[str, list] = defaultdict(list)
        self._last_cleanup = time.monotonic()

    def _cleanup(self) -> None:
        """Evict expired entries every 2 minutes."""
        now = time.monotonic()
        if now - self._last_cleanup < 120:
            return
        cutoff = now - RATE_WINDOW_SEC
        keys_to_delete = []
        for key, timestamps in self._store.items():
            self._store[key] = [t for t in timestamps if t > cutoff]
            if not self._store[key]:
                keys_to_delete.append(key)
        for k in keys_to_delete:
            del self._store[k]
        self._last_cleanup = now

    def is_limited(self, key: str, limit: int) -> Tuple[bool, int, int]:
        """
        Check whether `key` exceeds `limit` requests in the current window.
        Returns (is_limited, remaining, reset_seconds).
        """
        self._cleanup()
        now = time.monotonic()
        cutoff = now - RATE_WINDOW_SEC
        self._store[key] = [t for t in self._store[key] if t > cutoff]
        count = len(self._store[key])

        if count >= limit:
            reset_at = self._store[key][0] + RATE_WINDOW_SEC
            return True, 0, max(1, int(reset_at - now))

        self._store[key].append(now)
        return False, limit - count - 1, RATE_WINDOW_SEC


_limiter = _RateLimiter()


def _rate_limit_key(request: Request) -> str:
    """Build a rate-limit key from the client IP."""
    forwarded = request.headers.get("x-forwarded-for")
    ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
    return f"rl:{ip}"


# ─────────────────────────────────────────────────
# Rate Limit Middleware
# ─────────────────────────────────────────────────

class RateLimitMiddleware(BaseHTTPMiddleware):
    """Apply per-IP sliding-window rate limiting."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Skip rate limiting for health/docs
        path = request.url.path
        if path in PUBLIC_PATHS or request.method == "OPTIONS":
            return await call_next(request)

        # Choose limit tier
        limit = RATE_LIMIT_GENERAL
        for prefix in ANALYSIS_PATHS:
            if path.startswith(prefix):
                limit = RATE_LIMIT_ANALYSIS
                break

        key = _rate_limit_key(request)
        is_limited, remaining, reset_sec = _limiter.is_limited(key, limit)

        if is_limited:
            logger.warning("Rate limited: %s on %s", key, path)
            return Response(
                content='{"success":false,"error":"Too many requests. Please try again later."}',
                status_code=429,
                media_type="application/json",
                headers={
                    "Retry-After": str(reset_sec),
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(reset_sec),
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset_sec)
        return response


# ─────────────────────────────────────────────────
# Origin / Referer Validation Middleware
# ─────────────────────────────────────────────────

class OriginValidationMiddleware(BaseHTTPMiddleware):
    """Reject unsafe browser-originated requests from untrusted origins."""

    def __init__(self, app, allowed_origins: Optional[list[str]] = None):
        super().__init__(app)
        self.allowed_origins = {self._normalize_origin(origin) for origin in (allowed_origins or []) if origin}

    @staticmethod
    def _normalize_origin(value: str) -> str:
        cleaned = value.strip().rstrip("/")
        if not cleaned:
            return ""
        parts = urlsplit(cleaned)
        if parts.scheme and parts.netloc:
            return f"{parts.scheme}://{parts.netloc}"
        return cleaned

    def _is_allowed(self, origin_value: str) -> bool:
        return self._normalize_origin(origin_value) in self.allowed_origins

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            return await call_next(request)

        origin = request.headers.get("origin")
        referer = request.headers.get("referer")

        if not origin and not referer:
            return await call_next(request)

        candidate = origin
        if not candidate and referer:
            candidate = referer
            parsed = urlsplit(referer)
            if parsed.scheme and parsed.netloc:
                candidate = f"{parsed.scheme}://{parsed.netloc}"

        if not candidate or not self._is_allowed(candidate):
            logger.warning("Blocked unsafe origin: %s %s origin=%s referer=%s", request.method, request.url.path, origin, referer)
            return Response(
                content='{"success":false,"error":"Origin not allowed"}',
                status_code=403,
                media_type="application/json",
            )

        return await call_next(request)


# ─────────────────────────────────────────────────
# Authentication Middleware
# ─────────────────────────────────────────────────

def _verify_jwt_simple(token: str) -> Optional[dict]:
    """
    Minimal JWT verification (HS256) without external dependencies.
    For production with Clerk, the Node API acts as the auth gateway.
    This is a defense-in-depth check for direct-to-Python requests.
    """
    if not JWT_SECRET:
        if os.getenv("ENVIRONMENT", "development").lower() == "production":
            raise RuntimeError("FATAL: JWT_SECRET must be configured in production")
        return None  # JWT_SECRET not configured in dev — skip verification
    try:
        import base64, json
        parts = token.split(".")
        if len(parts) != 3:
            return None
        # Decode payload
        payload_b64 = parts[1] + "=" * (-len(parts[1]) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        # Check expiry
        exp = payload.get("exp")
        if exp and time.time() > exp:
            return None
        # Verify signature (HS256)
        msg = f"{parts[0]}.{parts[1]}".encode()
        sig = base64.urlsafe_b64decode(parts[2] + "=" * (-len(parts[2]) % 4))
        expected_sig = hmac.new(JWT_SECRET.encode(), msg, hashlib.sha256).digest()
        if not hmac.compare_digest(sig, expected_sig):
            return None
        return payload
    except Exception:
        return None


def _verify_internal_service_request(request: Request) -> bool:
    """Verify Node->service internal call with timestamped HMAC signature."""
    internal_secret = os.getenv("INTERNAL_SERVICE_SECRET", "")
    if not internal_secret or len(internal_secret) < 16:
        return False

    caller = request.headers.get("x-internal-caller", "")
    timestamp_raw = request.headers.get("x-internal-timestamp", "")
    nonce = request.headers.get("x-internal-nonce", "")
    signature = request.headers.get("x-internal-signature", "")
    request_id = request.headers.get("x-request-id", "")

    if caller and timestamp_raw and nonce and signature:
        try:
            timestamp = int(timestamp_raw)
        except (ValueError, TypeError):
            return False

        now = int(time.time())
        if abs(now - timestamp) > INTERNAL_SIGNATURE_MAX_SKEW_SEC:
            return False

        message = f"{caller}:{timestamp}:{nonce}:{request_id}"
        expected = hmac.new(
            internal_secret.encode(),
            message.encode(),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, signature):
            return False

        return _reserve_internal_nonce(nonce, now)

    # Backward compatibility while rolling out signed headers in non-production.
    if os.getenv("ENVIRONMENT", "development").lower() != "production":
        legacy = request.headers.get("x-internal-service")
        if legacy and hmac.compare_digest(internal_secret, legacy):
            return True

    return False


class AuthMiddleware(BaseHTTPMiddleware):
    """
    Verify Authorization header on protected routes.
    Public paths (health, docs) are excluded.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        path = request.url.path
        method = request.method

        # Skip auth for public paths and preflight
        if path in PUBLIC_PATHS or method == "OPTIONS":
            return await call_next(request)

        # Extract token
        auth_header = request.headers.get("authorization", "")
        if not auth_header.startswith("Bearer "):
            # Allow requests forwarded from Node only when internal service signature is valid.
            if _verify_internal_service_request(request):
                return await call_next(request)

            logger.warning("Missing or invalid Authorization header on %s %s", method, path)
            return Response(
                content='{"success":false,"error":"Authentication required"}',
                status_code=401,
                media_type="application/json",
            )

        token = auth_header[7:]

        # Verify token
        payload = _verify_jwt_simple(token)
        if payload is None:
            # If JWT_SECRET is not configured, we still reject — defense in depth.
            # The only way through without a valid JWT is via INTERNAL_SERVICE_SECRET.
            logger.warning("Invalid JWT on %s %s (JWT_SECRET configured: %s)", method, path, bool(JWT_SECRET))
            return Response(
                content='{"success":false,"error":"Invalid or expired token"}',
                status_code=401,
                media_type="application/json",
            )

        # Attach user info to request state for downstream use
        request.state.user = payload
        return await call_next(request)


# ─────────────────────────────────────────────────
# Security Headers Middleware
# ─────────────────────────────────────────────────

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to every response from the Python API."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["X-XSS-Protection"] = "0"
        if os.getenv("PYTHON_ENV", "development") == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        return response
