"""Core load dataclasses facade.

This module keeps backward-compatible imports while delegating concrete
dataclass implementations to focused modules.
"""

from .load_models_member_types import MomentOnMember, PointLoadOnMember, UniformLoad
from .load_models_nodal_types import NodalLoad
from .load_models_special_types import PrestressLoad, TemperatureLoad


__all__ = [
    "NodalLoad",
    "UniformLoad",
    "PointLoadOnMember",
    "MomentOnMember",
    "TemperatureLoad",
    "PrestressLoad",
]
