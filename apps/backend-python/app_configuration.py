"""
Application configuration module.

Environment loading, config validation, and production safety checks.
"""

import os
import sys
from logging_config import get_logger

logger = get_logger(__name__)


def load_app_config():
    """
    Load and validate all application configuration from environment variables.
    
    Returns:
        dict: Configuration dict with all required settings.
    
    Raises:
        SystemExit: If production environment has invalid/missing critical settings.
    """
    from configuration import get_env
    
    IS_PRODUCTION = os.getenv("ENVIRONMENT", "development").lower() in ("production", "prod")
    
    # AI Configuration
    gemini_api_key = get_env("GEMINI_API_KEY", "mock-key-local-dev")
    use_mock_ai = get_env("USE_MOCK_AI", "true").lower() in ("true", "1", "yes")
    
    # Service URLs
    frontend_url = get_env("FRONTEND_URL", "https://beamlabultimate.tech")
    allowed_origins_env = get_env("ALLOWED_ORIGINS", "https://beamlabultimate.tech,https://www.beamlabultimate.tech")
    node_api_url = get_env("NODE_API_URL", "https://beamlab-backend-node-prod.azurewebsites.net")
    rust_api_url = get_env("RUST_API_URL", "https://beamlab-rust-api-prod.azurewebsites.net")
    
    # Database Configuration
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        logger.warning(
            "DATABASE_URL env var is missing%s",
            " in production" if IS_PRODUCTION else " — defaulting to in-memory or mock DB for development/tests",
        )
    
    # JWT Secret (Critical)
    jwt_secret = os.getenv("JWT_SECRET", "").strip()
    if not jwt_secret:
        logger.warning(
            "JWT_SECRET env var is missing%s",
            " in production" if IS_PRODUCTION else " — using default mock secret for development/tests",
        )
        jwt_secret = "mock-jwt-secret"
    
    if IS_PRODUCTION and jwt_secret == "mock-jwt-secret":
        logger.error("FATAL: JWT_SECRET must be configured in production and cannot use mock fallback.")
        sys.exit(1)
    
    # ── Production localhost guard ──
    if IS_PRODUCTION:
        localhost_vars = {
            name: val
            for name, val in [
                ("FRONTEND_URL", frontend_url),
                ("NODE_API_URL", node_api_url),
                ("RUST_API_URL", rust_api_url),
            ]
            if "localhost" in val.lower() or "127.0.0.1" in val
        }
        if localhost_vars:
            logger.error(
                "FATAL: localhost URLs detected in PRODUCTION for: %s. "
                "Set the correct production URLs via environment variables.",
                ", ".join(localhost_vars.keys()),
            )
            sys.exit(1)
    
    # Structured startup log
    logger.info(
        "BeamLab Backend initializing",
        extra={
            "gemini_configured": bool(gemini_api_key and gemini_api_key != "mock-key-local-dev"),
            "use_mock_ai": use_mock_ai,
            "frontend_url": frontend_url,
            "environment": "LOCAL/MOCK" if use_mock_ai else "PRODUCTION",
        },
    )
    
    if IS_PRODUCTION:
        logger.info(
            "Production service endpoints configured",
            extra={
                "frontend_url": frontend_url,
                "node_api_url": node_api_url,
                "rust_api_url": rust_api_url,
                "cors_allowed_origins": allowed_origins_env,
            },
        )
    
    return {
        "is_production": IS_PRODUCTION,
        "gemini_api_key": gemini_api_key,
        "use_mock_ai": use_mock_ai,
        "frontend_url": frontend_url,
        "allowed_origins_env": allowed_origins_env,
        "node_api_url": node_api_url,
        "rust_api_url": rust_api_url,
        "database_url": database_url,
        "jwt_secret": jwt_secret,
        "max_body_size_mb": int(os.getenv("MAX_REQUEST_BODY_MB", "5")),
    }


def build_cors_origins(config: dict) -> list:
    """
    Build the CORS allowed origins list from config and environment.
    
    Args:
        config: Configuration dict from load_app_config()
    
    Returns:
        list: Sorted, deduplicated list of allowed CORS origins.
    """
    production_origins = [
        "https://beamlabultimate.tech",
        "https://www.beamlabultimate.tech",
        "https://thankful-ocean-0b8794000.6.azurestaticapps.net",
        "https://beamlab-backend-python-prod.azurewebsites.net",
        "https://beamlab-backend-node-prod.azurewebsites.net",
    ]
    
    dev_origins = [
        "http://localhost:3001",
        "http://localhost:5173",
        "http://localhost:8000",
        "http://localhost:8081",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8081",
    ]
    
    allow_origins = list(production_origins)
    if not config["is_production"]:
        allow_origins.extend(dev_origins)
    
    # Add origins from environment variables
    if config["allowed_origins_env"]:
        env_origins = [origin.strip() for origin in config["allowed_origins_env"].split(",") if origin.strip()]
        allow_origins.extend(env_origins)
    
    # Add service URLs
    if config["frontend_url"]:
        allow_origins.append(config["frontend_url"])
    
    # Allow Node backend to call Python backend from server-side
    if config["node_api_url"]:
        allow_origins.append(config["node_api_url"])
    
    # Remove duplicates and clean up
    allow_origins = sorted({origin.strip().rstrip("/") for origin in allow_origins if origin and origin.strip()})
    
    logger.info(
        "CORS configured",
        extra={"allowed_origin_count": len(allow_origins), "origins": sorted(allow_origins)},
    )
    
    return allow_origins
