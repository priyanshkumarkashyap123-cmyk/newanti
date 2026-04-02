"""Load solver basic types and enums."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from numpy import float64


class LoadType(Enum):
    """Load type enumeration."""

    POINT_FORCE = "point_force"
    MOMENT = "moment"
    UDL = "udl"
    TRAPEZOIDAL = "trapezoidal"


@dataclass
class PointLoad:
    """Point load at a node (kN, kN·m)."""

    node_id: str
    Px: float64 = float64(0)
    Py: float64 = float64(0)
    Pz: float64 = float64(0)
    Mx: float64 = float64(0)
    My: float64 = float64(0)
    Mz: float64 = float64(0)

    # Frontend compatibility aliases
    fx: float64 = float64(0)
    fy: float64 = float64(0)
    fz: float64 = float64(0)
    mx: float64 = float64(0)
    my: float64 = float64(0)
    mz: float64 = float64(0)


@dataclass
class UniformLoad:
    """Uniformly distributed load on a member (kN/m)."""

    member_id: str
    w_y: float64 = float64(0)
    w_z: float64 = float64(0)
    w_x: float64 = float64(0)
    a: float64 = float64(0)
    b: float64 = float64(0)


@dataclass
class TrapezoidalLoad:
    """Linearly varying load on a member (kN/m)."""

    member_id: str
    w1_y: float64 = float64(0)
    w2_y: float64 = float64(0)
    w1_z: float64 = float64(0)
    w2_z: float64 = float64(0)
    a: float64 = float64(0)
    b: float64 = float64(0)


__all__ = [
    "LoadType",
    "PointLoad",
    "UniformLoad",
    "TrapezoidalLoad",
]
