"""Shared configuration helpers for the Python backend."""

import os

from logging_config import get_logger

logger = get_logger(__name__)


def get_env(key: str, default: str = "") -> str:
    """Get environment variable with intelligent fallback."""
    value = os.getenv(key, "").strip()

    if value:
        return value

    if key == 'USE_MOCK_AI':
        logger.info("ENV %s: Using default (MOCK AI MODE)", key)
        return 'true'
    if key == 'GEMINI_API_KEY':
        logger.info("ENV %s: Not configured, using mock mode", key)
        return 'mock-key-local-dev'
    if key == 'FRONTEND_URL':
        logger.info("ENV %s: Not configured, defaulting to https://beamlabultimate.tech", key)
        return 'https://beamlabultimate.tech'
    if key == 'ALLOWED_ORIGINS':
        logger.info("ENV %s: Not configured, using production origins", key)
        return 'https://beamlabultimate.tech,https://www.beamlabultimate.tech'
    if key == 'NODE_API_URL':
        logger.info("ENV %s: Not configured, defaulting to https://beamlab-backend-node-prod.azurewebsites.net", key)
        return 'https://beamlab-backend-node-prod.azurewebsites.net'
    if key == 'RUST_API_URL':
        logger.info("ENV %s: Not configured, defaulting to https://beamlab-rust-api-prod.azurewebsites.net", key)
        return 'https://beamlab-rust-api-prod.azurewebsites.net'

    return default
