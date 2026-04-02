"""ASCE 7 seismic enums and data structures."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional


class SiteClass(Enum):
    """ASCE 7 Site Classification (Table 20.3-1)."""

    A = "A"  # Hard rock
    B = "B"  # Rock
    C = "C"  # Very dense soil/soft rock
    D = "D"  # Stiff soil (default)
    E = "E"  # Soft clay soil
    F = "F"  # Special study required


class RiskCategory(Enum):
    """ASCE 7 Risk Categories (Table 1.5-1)."""

    I = 1
    II = 2
    III = 3
    IV = 4


class SeismicDesignCategory(Enum):
    """ASCE 7 Seismic Design Categories."""

    A = "A"
    B = "B"
    C = "C"
    D = "D"
    E = "E"
    F = "F"


class StructuralSystem(Enum):
    """ASCE 7 Seismic Force-Resisting Systems (Table 12.2-1)."""

    SPECIAL_MOMENT_FRAME_STEEL = "SMF_S"
    SPECIAL_MOMENT_FRAME_RC = "SMF_RC"
    SPECIAL_CONCENTRIC_BRACED = "SCBF"
    SPECIAL_SHEAR_WALL = "SSW"

    INTERMEDIATE_MOMENT_FRAME = "IMF"
    INTERMEDIATE_SHEAR_WALL = "ISW"

    ORDINARY_MOMENT_FRAME_STEEL = "OMF_S"
    ORDINARY_MOMENT_FRAME_RC = "OMF_RC"
    ORDINARY_CONCENTRIC_BRACED = "OCBF"
    ORDINARY_SHEAR_WALL = "OSW"

    DUAL_SYSTEM = "DUAL"
    CANTILEVERED_COLUMN = "CC"

    def get_R(self) -> float:
        """Response Modification Factor R (Table 12.2-1)."""
        r_values = {
            "SMF_S": 8.0,
            "SMF_RC": 8.0,
            "SCBF": 6.0,
            "SSW": 6.0,
            "IMF": 5.0,
            "ISW": 5.0,
            "OMF_S": 3.5,
            "OMF_RC": 3.0,
            "OCBF": 3.25,
            "OSW": 5.0,
            "DUAL": 7.0,
            "CC": 2.5,
        }
        return r_values.get(self.value, 5.0)

    def get_Cd(self) -> float:
        """Deflection Amplification Factor Cd (Table 12.2-1)."""
        cd_values = {
            "SMF_S": 5.5,
            "SMF_RC": 5.5,
            "SCBF": 5.0,
            "SSW": 5.0,
            "IMF": 4.5,
            "ISW": 4.5,
            "OMF_S": 3.0,
            "OMF_RC": 2.5,
            "OCBF": 3.25,
            "OSW": 4.5,
            "DUAL": 5.5,
            "CC": 2.5,
        }
        return cd_values.get(self.value, 4.5)

    def get_Omega0(self) -> float:
        """Overstrength Factor Ω₀ (Table 12.2-1)."""
        omega_values = {
            "SMF_S": 3.0,
            "SMF_RC": 3.0,
            "SCBF": 2.0,
            "SSW": 2.5,
            "IMF": 3.0,
            "ISW": 2.5,
            "OMF_S": 3.0,
            "OMF_RC": 3.0,
            "OCBF": 2.0,
            "OSW": 2.5,
            "DUAL": 2.5,
            "CC": 2.0,
        }
        return omega_values.get(self.value, 2.5)


@dataclass
class ASCE7SeismicParams:
    """Input parameters for ASCE 7 seismic analysis."""

    Ss: float = 1.0
    S1: float = 0.4
    TL: float = 8.0

    site_class: SiteClass = SiteClass.D
    risk_category: RiskCategory = RiskCategory.II
    structural_system: StructuralSystem = StructuralSystem.SPECIAL_MOMENT_FRAME_STEEL

    height: float = 30.0
    num_stories: int = 10
    base_dimension_x: float = 20.0
    base_dimension_y: float = 15.0

    user_period: Optional[float] = None
    use_Cu_limit: bool = True

    direction: str = "X"


@dataclass
class StoryMass:
    """Mass data for a single story."""

    level: int
    height: float
    story_height: float
    dead_load: float
    live_load: float
    seismic_weight: float = 0.0
    lateral_force: float = 0.0
    shear: float = 0.0
    moment: float = 0.0
    node_ids: List[str] = field(default_factory=list)


@dataclass
class ASCE7SeismicResult:
    """Complete ASCE 7 seismic analysis result."""

    success: bool = True

    Fa: float = 1.0
    Fv: float = 1.0
    SDS: float = 0.0
    SD1: float = 0.0

    Ta: float = 0.0
    T: float = 0.0
    Cu: float = 1.0

    Cs: float = 0.0
    Ie: float = 1.0
    R: float = 8.0

    W: float = 0.0
    V: float = 0.0

    story_forces: List[StoryMass] = field(default_factory=list)
    nodal_loads: List[Dict] = field(default_factory=list)

    SDC: str = "D"
    error_message: Optional[str] = None


__all__ = [
    "SiteClass",
    "RiskCategory",
    "SeismicDesignCategory",
    "StructuralSystem",
    "ASCE7SeismicParams",
    "StoryMass",
    "ASCE7SeismicResult",
]
