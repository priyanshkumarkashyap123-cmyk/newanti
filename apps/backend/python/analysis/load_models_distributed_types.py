"""
Data types for distributed and trapezoidal loads.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Dict

from .load_types import LoadDirection


@dataclass
class TrapezoidalLoad:
    """
    Trapezoidal/Triangular Distributed Load

    w1 at start_pos, w2 at end_pos
    If w1 == w2: UDL
    If w1 == 0 or w2 == 0: Triangular
    """

    id: str
    member_id: str
    w1: float
    w2: float
    direction: LoadDirection = LoadDirection.GLOBAL_Y
    start_pos: float = 0.0
    end_pos: float = 1.0
    is_projected: bool = False
    load_case: str = "DEAD"

    def get_fixed_end_actions(self, length: float, angle: float = 0.0) -> Dict[str, float]:
        """Calculate fixed end actions for trapezoidal load."""
        w1, w2 = self.w1, self.w2

        if self.is_projected:
            proj_factor = math.cos(angle)
            w1 *= proj_factor
            w2 *= proj_factor

        a = self.start_pos * length
        b = self.end_pos * length
        L = b - a

        if L <= 0:
            return {"Fy_start": 0, "Fy_end": 0, "Mz_start": 0, "Mz_end": 0}

        w_min = min(w1, w2)
        w_diff = abs(w2 - w1)
        triangle_points_end = w2 > w1

        W_uniform = w_min * L
        c_uniform = (a + b) / 2

        W_triangle = 0.5 * w_diff * L
        if triangle_points_end:
            c_triangle = a + (2 * L / 3)
        else:
            c_triangle = a + (L / 3)

        W_total = W_uniform + W_triangle
        if W_total > 0:
            c_total = (W_uniform * c_uniform + W_triangle * c_triangle) / W_total
        else:
            c_total = c_uniform

        R_end = W_total * c_total / length
        R_start = W_total - R_end

        M_start = -W_total * c_total * (length - c_total) ** 2 / (length ** 2)
        M_end = W_total * c_total ** 2 * (length - c_total) / (length ** 2)

        return {
            "Fy_start": R_start,
            "Fy_end": R_end,
            "Mz_start": M_start,
            "Mz_end": M_end,
        }


__all__ = ["TrapezoidalLoad"]
