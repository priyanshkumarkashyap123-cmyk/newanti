"""Async Worker System for Long-Running Analysis (facade)."""

from __future__ import annotations

# Re-export the core pool for backward compatibility
from .worker_pool_core import AnalysisWorkerPool, get_worker_pool, shutdown_worker_pool


__all__ = ["AnalysisWorkerPool", "get_worker_pool", "shutdown_worker_pool"]
