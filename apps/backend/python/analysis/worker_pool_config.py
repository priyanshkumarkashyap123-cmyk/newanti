"""Configuration helpers for the analysis worker pool."""

from __future__ import annotations

import os
from typing import Dict, Any


def _parse_bool(value: str, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def load_worker_pool_config() -> Dict[str, Any]:
    """Load worker pool configuration from environment with sane defaults."""
    return {
        "max_workers": int(os.getenv("ANALYSIS_WORKERS", "4")),
        "max_queue_size": int(os.getenv("ANALYSIS_QUEUE_SIZE", "1000")),
        "enable_cache": _parse_bool(os.getenv("ANALYSIS_CACHE_ENABLED"), True),
        "cache_ttl": int(os.getenv("ANALYSIS_CACHE_TTL", "3600")),
        "job_retention_ttl": int(os.getenv("ANALYSIS_JOB_RETENTION_TTL", "1800")),
        "max_job_records": int(os.getenv("ANALYSIS_MAX_JOB_RECORDS", "5000")),
    }


__all__ = ["load_worker_pool_config"]