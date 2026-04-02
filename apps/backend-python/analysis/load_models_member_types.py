"""Member-applied load dataclasses (UDL, point, moment)."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Dict

from .load_types import LoadDirection


@dataclass
class UniformLoad:
    """Uniform Distributed Load (UDL) on member."""

    id: str
    member_id: str
    w: float  # Intensity (kN/m)
    direction: LoadDirection = LoadDirection.GLOBAL_Y
    start_pos: float = 0.0  # Start position ratio (0-1)
    end_pos: float = 1.0  # End position ratio (0-1)
    is_projected: bool = False  # Project based on member angle
    load_case: str = "DEAD"

    def get_fixed_end_actions(self, length: float, angle: float = 0.0) -> Dict[str, float]:
        """Fixed-end actions for a (possibly partial) UDL on a fixed-fixed beam."""

        w = self.w
        if self.is_projected:
            w = w * math.cos(angle)

        a = self.start_pos * length
        b = self.end_pos * length
        load_length = b - a

        if load_length <= 0 or length <= 0:
            return {"Fy_start": 0.0, "Fy_end": 0.0, "Mz_start": 0.0, "Mz_end": 0.0}

        W = w * load_length
        x_bar = (a + b) / 2

        R_end = W * x_bar / length
        R_start = W - R_end

        c = (a + b) / 2
        M_start = -W * c * (length - c) ** 2 / (length**2)
        M_end = W * c**2 * (length - c) / (length**2)

        return {
            "Fy_start": R_start,
            "Fy_end": R_end,
            "Mz_start": M_start,
            "Mz_end": M_end,
        }


@dataclass
class PointLoadOnMember:
    """Point load at specific location on member."""

    id: str
    member_id: str
    P: float  # Load magnitude (kN)
    a: float  # Distance from start (ratio 0-1)
    direction: LoadDirection = LoadDirection.GLOBAL_Y
    load_case: str = "DEAD"

    def get_fixed_end_actions(self, length: float) -> Dict[str, float]:
        """Fixed-end actions for a point load on a fixed-fixed beam."""

        a_dist = self.a * length
        b_dist = length - a_dist
        L = length
        P = self.P

        if L <= 0:
            return {"Fy_start": 0.0, "Fy_end": 0.0, "Mz_start": 0.0, "Mz_end": 0.0}

        R_start = P * b_dist / L
        R_end = P * a_dist / L

        M_start = -P * a_dist * b_dist**2 / (L**2)
        M_end = P * a_dist**2 * b_dist / (L**2)

        return {
            "Fy_start": R_start,
            "Fy_end": R_end,
            "Mz_start": M_start,
            "Mz_end": M_end,
        }


@dataclass
class MomentOnMember:
    """Applied moment at specific location on member."""

    id: str
    member_id: str
    M: float  # Moment magnitude (kN·m)
    a: float  # Distance from start (ratio 0-1)
    about_axis: str = "z"  # 'y' or 'z' (local axes)
    load_case: str = "DEAD"

    def get_fixed_end_actions(self, length: float) -> Dict[str, float]:
        """Fixed-end actions for an applied moment on a fixed-fixed member."""

        if length <= 0:
            return {"Fy_start": 0.0, "Fy_end": 0.0, "Mz_start": 0.0, "Mz_end": 0.0}

        if self.about_axis.lower() == "z":
            return {"Fy_start": 0.0, "Fy_end": 0.0, "Mz_start": -self.M, "Mz_end": self.M}
        if self.about_axis.lower() == "y":
            return {"Fy_start": 0.0, "Fy_end": 0.0, "My_start": -self.M, "My_end": self.M}

        return {"Fy_start": 0.0, "Fy_end": 0.0, "Mz_start": 0.0, "Mz_end": 0.0}


__all__ = [
    "UniformLoad",
    "PointLoadOnMember",
    "MomentOnMember",
]
