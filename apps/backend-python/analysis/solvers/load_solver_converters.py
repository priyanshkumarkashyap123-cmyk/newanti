"""Load conversion utilities for load_solver."""

from __future__ import annotations

from typing import Dict, Optional, Tuple
from numpy import float64


class LoadConverter:
    """Convert member distributed loads to equivalent nodal actions."""

    @staticmethod
    def udl_to_ejl_2d(
        w: float64,
        L: float64,
        a: float64 = float64(0),
        b: Optional[float64] = None,
        element_type: str = "timoshenko",
    ) -> Tuple[Dict, Dict]:
        """Equivalent forces/moments for a 2D UDL segment on span L."""
        _ = element_type
        if b is None:
            b = L
        if a > b:
            a, b = b, a

        if abs(a) < 1e-10 and abs(b - L) < 1e-10:
            R_i = float64(w * L / 2.0)
            R_j = float64(w * L / 2.0)
            M_i = float64((w * L * L) / 12.0)
            M_j = float64(-(w * L * L) / 12.0)
        else:
            c = b - a
            x1 = a
            x2 = b
            R_i = float64((w * c / L) * (1 - (x1 + x2) / (2 * L)))
            R_j = float64(w * c - R_i)
            M_i = float64(-(w / (6 * L)) * (x2**3 - x1**3 - 3 * x1 * x2 * (x2 - x1)))
            M_j = float64(
                (w / (6 * L)) * (x2**3 - x1**3 - 3 * x1 * x2 * (x2 - x1)) + w * c * (L - x2)
            )

        return {"node_i": float64(R_i), "node_j": float64(R_j)}, {
            "node_i": float64(M_i),
            "node_j": float64(M_j),
        }

    @staticmethod
    def trapezoidal_load_to_ejl(
        w1: float64,
        w2: float64,
        L: float64,
        a: float64 = float64(0),
        b: Optional[float64] = None,
    ) -> Tuple[Dict, Dict]:
        """Equivalent forces/moments for trapezoidal load over [a, b]."""
        if b is None:
            b = L

        c = b - a
        w_avg = (w1 + w2) / 2.0
        total_load = w_avg * c
        R_i = float64(total_load * (L - (a + b) / 2.0) / L)
        R_j = float64(total_load - R_i)

        w_diff = w2 - w1
        if abs(w_diff) < 1e-10:
            M_i = float64((w1 * c * c) / 12.0)
        else:
            M_i = float64(w1 * c * c * (2 * L - a - b) / 12 + w_diff * c * c * (3 * L - 2 * a - 2 * b) / 36)

        M_j = float64(-M_i - c * (w1 + w2) / 2.0 * (L - (a + b) / 2.0))

        return {"node_i": float64(R_i), "node_j": float64(R_j)}, {
            "node_i": float64(M_i),
            "node_j": float64(M_j),
        }


__all__ = ["LoadConverter"]
