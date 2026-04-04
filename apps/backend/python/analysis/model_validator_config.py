"""Configuration loader for model validator thresholds."""

from __future__ import annotations

import os
from typing import Dict, Any


def _parse_float(value: str, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _parse_int(value: str, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def load_validator_config() -> Dict[str, Any]:
    """Load validator thresholds with env overrides and safe defaults."""
    return {
        "MIN_NODE_DISTANCE": _parse_float(os.getenv("VALIDATOR_MIN_NODE_DISTANCE"), 0.001),
        "MAX_STIFFNESS_RATIO": _parse_float(os.getenv("VALIDATOR_MAX_STIFFNESS_RATIO"), 1e8),
        "MIN_MEMBER_LENGTH": _parse_float(os.getenv("VALIDATOR_MIN_MEMBER_LENGTH"), 0.01),
        "MIN_SUPPORTS_2D": _parse_int(os.getenv("VALIDATOR_MIN_SUPPORTS_2D"), 3),
        "MIN_SUPPORTS_3D": _parse_int(os.getenv("VALIDATOR_MIN_SUPPORTS_3D"), 6),
    }


__all__ = ["load_validator_config"]