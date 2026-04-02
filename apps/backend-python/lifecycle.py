"""Application lifecycle hooks extracted from main.py."""

from __future__ import annotations

import os


async def startup_event(logger):
    """Log application startup for monitoring."""
    logger.info("✓ FastAPI backend started successfully")
    logger.info("  Environment: %s", os.getenv("ENVIRONMENT", "development"))
    logger.info("  Analysis Workers: %s", os.getenv("ANALYSIS_WORKERS", "4"))
    logger.info("  Max Request Size: %sMB", os.getenv("MAX_REQUEST_BODY_MB", "10"))


async def shutdown_event(logger):
    """Log graceful shutdown for monitoring."""
    logger.info("⛔ Python API shutting down gracefully")
