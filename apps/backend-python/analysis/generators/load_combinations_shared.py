"""
Shared models and enums for load combinations.

This module is intended to be the single source of truth for load
combination data structures used by both the generator package and
solver-facing code. Keeping these in one place prevents drift between
similar implementations.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Dict, List


class DesignCode(Enum):
    """Supported design codes"""

    IS875 = "IS875"
    ASCE7 = "ASCE7"
    ASCE7_LRFD = "ASCE7_LRFD"
    ASCE7_ASD = "ASCE7_ASD"
    IS456_LSM = "IS456_LSM"
    IS456_WSM = "IS456_WSM"
    IS1893 = "IS1893"
    IS800_LSM = "IS800_LSM"
    ACI318 = "ACI318"
    AISC360_LRFD = "AISC360_LRFD"
    AISC360_ASD = "AISC360_ASD"
    EUROCODE = "EUROCODE"
    USER_DEFINED = "USER"


class LoadType(Enum):
    """Standard load types"""

    DEAD = "D"
    D = "D"  # Dead load
    LIVE = "L"
    L = "L"  # Live load
    ROOF_LIVE = "Lr"
    Lr = "Lr"  # Roof live load
    SNOW = "S"
    S = "S"  # Snow load
    R = "R"  # Rain load
    WIND = "W"
    W = "W"  # Wind load
    Wx = "Wx"  # Wind +X
    Wy = "Wy"  # Wind +Y
    SEISMIC = "E"
    E = "E"  # Earthquake load (generic)
    Ex = "Ex"  # Earthquake +X
    Ey = "Ey"  # Earthquake +Y
    TEMPERATURE = "T"
    T = "T"  # Temperature
    SOIL_PRESSURE = "EP"
    H = "H"  # Lateral earth pressure
    F = "F"  # Fluid pressure
    UNIFORM = "UNIFORM"
    POINT = "POINT"
    TRIANGULAR = "TRIANGULAR"
    PARABOLIC = "PARABOLIC"

    # User-defined placeholders
    UDL1 = "UDL1"
    UDL2 = "UDL2"
    UDL3 = "UDL3"


@dataclass
class LoadFactor:
    """Load factor for a specific load type"""

    load_type: str  # Load type name (e.g., D, L, E)
    factor: float


@dataclass
class LoadCombination:
    """A single load combination"""

    id: str
    name: str
    code: str
    factors: List[LoadFactor]
    description: str = ""
    limit_state: str = ""
    is_active: bool = True
    is_user_defined: bool = False

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "name": self.name,
            "code": self.code,
            "factors": [{"type": f.load_type, "factor": f.factor} for f in self.factors],
            "description": self.description,
            "limit_state": self.limit_state,
            "is_active": self.is_active,
            "is_user_defined": self.is_user_defined,
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "LoadCombination":
        factors = [LoadFactor(f["type"], f["factor"]) for f in data.get("factors", [])]
        return cls(
            id=data.get("id", ""),
            name=data.get("name", ""),
            code=data.get("code", DesignCode.USER_DEFINED.value),
            factors=factors,
            description=data.get("description", ""),
            limit_state=data.get("limit_state", ""),
            is_active=data.get("is_active", True),
            is_user_defined=data.get("is_user_defined", False),
        )

    def get_factor(self, load_type: str) -> float:
        for f in self.factors:
            if f.load_type == load_type:
                return f.factor
        return 0.0

    def format_expression(self) -> str:
        terms = []
        for f in self.factors:
            if f.factor == 0:
                continue
            if f.factor == 1.0:
                terms.append(f.load_type)
            elif f.factor == -1.0:
                terms.append(f"-{f.load_type}")
            else:
                terms.append(f"{f.factor}{f.load_type}")
        return " + ".join(terms) if terms else "0"


@dataclass
class CombinationResult:
    """Result of combining loads"""

    combination_id: str
    combination_name: str
    nodal_loads: Dict[str, Dict[str, float]]  # node_id -> {fx, fy, fz, mx, my, mz}
    member_loads: Dict[str, Dict]
    total_reactions: Dict[str, float]
