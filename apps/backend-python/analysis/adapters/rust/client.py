"""
Rust backend adapter (HTTP client) — Python solver deprecated.
"""

import asyncio
import os
import time
import random
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

import httpx

RUST_API_URL = os.getenv("RUST_API_URL", "http://localhost:3002")
RUST_API_TIMEOUT = int(os.getenv("RUST_API_TIMEOUT", "120"))
NODE_THRESHOLD_FOR_RUST = int(os.getenv("RUST_NODE_THRESHOLD", "500"))
ENABLE_RUST_BACKEND = os.getenv("ENABLE_RUST_BACKEND", "true").lower() == "true"
RUST_STRICT_MODE = os.getenv("RUST_STRICT_MODE", "true").lower() == "true"
RUST_CB_THRESHOLD = int(os.getenv("RUST_CB_THRESHOLD", "5"))
RUST_CB_RESET_SEC = float(os.getenv("RUST_CB_RESET_SEC", "30"))
RUST_BASE_BACKOFF_MS = int(os.getenv("RUST_BASE_BACKOFF_MS", "300"))
RUST_MAX_BACKOFF_MS = int(os.getenv("RUST_MAX_BACKOFF_MS", "5000"))


class SolverBackend(str, Enum):
    PYTHON = "python"  # Deprecated
    RUST = "rust"
    AUTO = "auto"


def always_use_rust(_: Dict, backend: SolverBackend = SolverBackend.AUTO) -> bool:
    """Decide whether analysis should run on Rust backend.

    Rust is the default and only supported compute path. If a caller explicitly
    requests the deprecated PYTHON backend, return False so the caller gets a
    clear deprecation/runtime error from the orchestrator.
    """
    return backend != SolverBackend.PYTHON


@dataclass
class RustSolverResult:
    success: bool
    backend_used: str
    solve_time_ms: float
    displacements: Optional[Dict[str, List[float]]] = None
    reactions: Optional[Dict[str, List[float]]] = None
    member_forces: Optional[List[Dict]] = None
    modes: Optional[List[Dict]] = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class RustInteropClient:
    """HTTP client for Rust structural analysis backend (Rust-only)."""

    def __init__(
        self,
        base_url: str = RUST_API_URL,
        timeout: int = RUST_API_TIMEOUT,
        enable_rust: bool = ENABLE_RUST_BACKEND,
        strict_mode: bool = RUST_STRICT_MODE,
    ):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.enable_rust = enable_rust
        self.strict_mode = strict_mode
        self._client: Optional[httpx.AsyncClient] = None
        self._rust_available: Optional[bool] = None
        self._last_health_check = 0.0
        self._health_check_interval = 30.0
        self._cb_failures = 0
        self._cb_open_until = 0.0

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=httpx.Timeout(connect=5.0, read=self.timeout, write=30.0, pool=10.0),
                limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
                headers={"Content-Type": "application/json"},
            )
        return self._client

    async def _get_json(self, path: str) -> httpx.Response:
        client = await self._get_client()
        return await client.get(path)

    async def _post_json(self, path: str, payload: Dict[str, Any]) -> httpx.Response:
        client = await self._get_client()
        return await client.post(path, json=payload)

    async def check_health(self) -> bool:
        now = time.time()
        if self._rust_available is not None and now - self._last_health_check < self._health_check_interval:
            return self._rust_available
        try:
            resp = await self._get_json("/health")
            self._rust_available = resp.status_code == 200
        except Exception:
            self._rust_available = False
        self._last_health_check = now
        return self._rust_available

    def _circuit_open(self) -> bool:
        return time.time() < self._cb_open_until

    def _record_failure(self):
        self._cb_failures += 1
        if self._cb_failures >= RUST_CB_THRESHOLD:
            self._cb_open_until = time.time() + RUST_CB_RESET_SEC
            self._cb_failures = 0

    def _record_success(self):
        self._cb_failures = 0
        self._cb_open_until = 0.0

    def _backoff_ms(self, attempt: int) -> float:
        exp = min(RUST_BASE_BACKOFF_MS * (2 ** attempt), RUST_MAX_BACKOFF_MS)
        jitter = random.random() * 0.3 * exp
        return exp + jitter

    async def analyze(
        self,
        model: Dict,
        analysis_type: str = "static",
        backend: SolverBackend = SolverBackend.AUTO,
        options: Optional[Dict] = None,
    ) -> RustSolverResult:
        use_rust = self.enable_rust and always_use_rust(model, backend)

        if not use_rust:
            raise RuntimeError("Rust backend disabled; Python backend is deprecated")

        if self._circuit_open():
            raise RuntimeError("Rust backend circuit open due to failures")

        attempt = 0
        last_error = None
        while True:
            try:
                resp = await self._post_json(f"/analysis/{analysis_type}", payload=model)
                data = resp.json()
                if resp.status_code != 200:
                    raise RuntimeError(data.get("error") or f"Rust backend HTTP {resp.status_code}")
                self._record_success()
                return RustSolverResult(
                    success=data.get("success", False),
                    backend_used="rust",
                    solve_time_ms=data.get("solve_time_ms", 0.0),
                    displacements=data.get("displacements"),
                    reactions=data.get("reactions"),
                    member_forces=data.get("member_forces"),
                    modes=data.get("modes"),
                    error=data.get("error"),
                    metadata=data.get("metadata", {}),
                )
            except Exception as exc:  # broad on purpose to include httpx
                last_error = str(exc)
                self._record_failure()
                attempt += 1
                backoff = self._backoff_ms(attempt) / 1000.0
                await asyncio.sleep(backoff)
                if attempt >= 3:
                    raise RuntimeError(f"Rust backend failed after retries: {last_error}")


def get_rust_client() -> RustInteropClient:
    return RustInteropClient()
