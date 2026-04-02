"""Rust backend interop facade (Rust-first).

This module provides a stable import surface for routers/services while
delegating implementation to analysis.adapters.rust.client.
"""

from __future__ import annotations

import hashlib
import json
from typing import Dict, Optional

from analysis.adapters.rust.client import (
    RustInteropClient,
    RustSolverResult,
    SolverBackend,
    always_use_rust,
)

__all__ = [
    "RustInteropClient",
    "RustSolverResult",
    "SolverBackend",
    "always_use_rust",
    "get_rust_client",
    "analyze_with_best_backend",
    "compute_model_hash",
]

_client: Optional[RustInteropClient] = None


def get_rust_client() -> RustInteropClient:
    """Get or create a process-level Rust interop client."""
    global _client
    if _client is None:
        _client = RustInteropClient()
    return _client


async def analyze_with_best_backend(
    model: Dict,
    analysis_type: str = "static",
    force_backend: Optional[str] = None,
    **kwargs,
) -> RustSolverResult:
    """Run analysis using Rust backend (default) with optional explicit override.

    Python solvers are deprecated for structural analysis; we pin to Rust unless
    explicitly overridden (tests or future hybrid cases).
    """
    client = get_rust_client()
    backend = SolverBackend.RUST
    if force_backend:
        backend = SolverBackend(force_backend)

    options = kwargs or None
    return await client.analyze(model, analysis_type, backend, options)


def compute_model_hash(model: Dict) -> str:
    """Deterministic model hash for cache keys."""
    canonical = json.dumps(model, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()[:16]
