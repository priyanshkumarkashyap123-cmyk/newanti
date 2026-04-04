"""
Load enumeration types.

Defines load directions and distribution methods for structural loads.
"""

from enum import Enum


class LoadDirection(Enum):
    """Load direction options"""
    LOCAL_X = "local_x"      # Along member axis
    LOCAL_Y = "local_y"      # Perpendicular in local Y
    LOCAL_Z = "local_z"      # Perpendicular in local Z
    GLOBAL_X = "global_x"
    GLOBAL_Y = "global_y"    # Vertical (typically gravity)
    GLOBAL_Z = "global_z"


class DistributionType(Enum):
    """Floor load distribution method"""
    ONE_WAY = "one_way"
    TWO_WAY_TRIANGULAR = "two_way_triangular"
    TWO_WAY_TRAPEZOIDAL = "two_way_trapezoidal"
