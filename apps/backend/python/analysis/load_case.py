"""
Load case and combination management.

Defines LoadCase (collection of loads) and LoadCombination (factored combinations).
"""

from dataclasses import dataclass, field
from typing import List, Dict

from .load_models import (
    NodalLoad, UniformLoad, TrapezoidalLoad, PointLoadOnMember,
    MomentOnMember, TemperatureLoad, PrestressLoad, FloorLoad
)


@dataclass
class LoadCase:
    """A named collection of loads"""
    name: str
    description: str = ""
    load_type: str = "DEAD"  # DEAD, LIVE, WIND, SEISMIC, etc.
    nodal_loads: List[NodalLoad] = field(default_factory=list)
    member_loads: List = field(default_factory=list)  # Union of load types
    floor_loads: List[FloorLoad] = field(default_factory=list)
    temperature_loads: List[TemperatureLoad] = field(default_factory=list)
    prestress_loads: List[PrestressLoad] = field(default_factory=list)


@dataclass
class LoadCombination:
    """Load combination with factors"""
    name: str
    description: str = ""
    factors: Dict[str, float] = field(default_factory=dict)  # load_case_name -> factor
    
    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "factors": self.factors
        }
