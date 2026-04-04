"""
health.py — Health check route for Python API.

GET /health — Returns service status and version.
No authentication required.

Requirements: 18.2, 18.4
"""

from fastapi import APIRouter
import importlib.metadata

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    """
    Health check endpoint.
    Returns HTTP 200 with service status and version.
    No authentication required.
    """
    try:
        version = importlib.metadata.version("beamlab-python")
    except importlib.metadata.PackageNotFoundError:
        version = "2.1.0"  # fallback

    return {
        "status": "ok",
        "version": version,
    }
