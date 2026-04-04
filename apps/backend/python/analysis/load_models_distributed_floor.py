"""
Floor/Area load distribution using yield line theory.

This module handles floor loads that auto-distribute to supporting beams
based on yield line theory: one-way for aspect ratio > 2, two-way for ≤ 2.
"""

from __future__ import annotations

from dataclasses import dataclass
from .load_models_distributed_floor_detection import FloorPanelDetectionMixin
from .load_models_distributed_floor_distribution import FloorLoadDistributionMixin


@dataclass
class FloorLoad(FloorPanelDetectionMixin, FloorLoadDistributionMixin):
    """
    Floor/Area load that auto-distributes to supporting beams.

    Uses yield line theory for distribution:
    - One-way for aspect ratio > 2
    - Two-way (triangular/trapezoidal) for aspect ratio ≤ 2
    """

    id: str
    pressure: float
    y_level: float
    x_min: float = -float("inf")
    x_max: float = float("inf")
    z_min: float = -float("inf")
    z_max: float = float("inf")
    load_case: str = "LIVE"

    pass


__all__ = ["FloorLoad"]
