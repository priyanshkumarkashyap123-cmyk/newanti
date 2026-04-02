"""
Distributed and floor load models.

Contains trapezoidal load and floor load types. TrapezoidalLoad is defined
in load_models_distributed_types. FloorLoad is in load_models_distributed_floor.
"""

from __future__ import annotations

# Re-export for backward compatibility
from .load_models_distributed_types import TrapezoidalLoad
from .load_models_distributed_floor import FloorLoad


__all__ = ["TrapezoidalLoad", "FloorLoad"]
