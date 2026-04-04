"""Shared Rust API proxy helpers for analysis router."""

import os

import httpx
from fastapi import HTTPException

from logging_config import get_logger

logger = get_logger(__name__)

RUST_API_URL = os.environ.get("RUST_API_URL", "http://localhost:8080")


async def proxy_to_rust(endpoint: str, payload: dict) -> dict:
    """Forward a request to the Rust API and return JSON response."""
    url = f"{RUST_API_URL}/api/advanced/{endpoint}"
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        logger.error("Rust API error (%s): %s – %s", endpoint, e.response.status_code, e.response.text)
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Rust solver error: {e.response.text}",
        )
    except httpx.ConnectError:
        logger.warning("Rust API unreachable at %s, falling back to stub", url)
        raise HTTPException(
            status_code=503,
            detail="Rust analysis backend unavailable. Deploy rust-api or use direct Rust endpoint.",
        )
