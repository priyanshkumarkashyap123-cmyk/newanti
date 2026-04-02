"""
Auto-load type definitions for lateral load generators

Enumerations and dataclasses for seismic and wind analysis.
"""

from dataclasses import dataclass, field
from typing import List, Optional
from enum import Enum


# ============================================
# SEISMIC ENUMERATIONS
# ============================================

class SeismicZone(Enum):
    """IS 1893 Seismic Zones"""
    II = 2      # Z = 0.10
    III = 3    # Z = 0.16
    IV = 4     # Z = 0.24
    V = 5      # Z = 0.36
    
    @property
    def factor(self) -> float:
        """Zone factor Z"""
        return {2: 0.10, 3: 0.16, 4: 0.24, 5: 0.36}[self.value]


class SoilType(Enum):
    """IS 1893 Soil Classification"""
    ROCK = 1        # Type I - Rock or Hard Soil
    MEDIUM = 2      # Type II - Medium Soil
    SOFT = 3        # Type III - Soft Soil
    
    @property
    def site_factor(self) -> float:
        """Site amplification factor"""
        return {1: 1.0, 2: 1.2, 3: 1.5}[self.value]


class BuildingType(Enum):
    """Building frame types for response reduction factor"""
    ORDINARY_RC_MRF = "OMRF"           # R = 3.0
    SPECIAL_RC_MRF = "SMRF"            # R = 5.0
    ORDINARY_STEEL_MRF = "OSMRF"       # R = 4.0
    SPECIAL_STEEL_MRF = "SSMRF"        # R = 5.0
    BRACED_FRAME = "BF"                # R = 4.0
    DUAL_SYSTEM = "DUAL"               # R = 5.0
    SHEAR_WALL = "SW"                  # R = 4.0
    
    @property
    def R(self) -> float:
        """Response Reduction Factor"""
        return {
            "OMRF": 3.0, "SMRF": 5.0, "OSMRF": 4.0,
            "SSMRF": 5.0, "BF": 4.0, "DUAL": 5.0, "SW": 4.0
        }[self.value]


class ImportanceCategory(Enum):
    """Building importance categories"""
    ORDINARY = 1       # I = 1.0
    IMPORTANT = 2      # I = 1.2 (Schools, Hospitals)
    CRITICAL = 3       # I = 1.5 (Nuclear plants, etc.)
    
    @property
    def factor(self) -> float:
        return {1: 1.0, 2: 1.2, 3: 1.5}[self.value]


class TerrainCategory(Enum):
    """IS 875 Terrain Categories"""
    CAT_1 = 1  # Open terrain (coastal, desert)
    CAT_2 = 2  # Open terrain with scattered obstructions
    CAT_3 = 3  # Built-up areas (suburban)
    CAT_4 = 4  # Built-up areas (urban, city centers)


# ============================================
# SEISMIC DATA MODELS
# ============================================

@dataclass
class SeismicParameters:
    """Input parameters for seismic analysis"""
    zone: SeismicZone = SeismicZone.III
    soil_type: SoilType = SoilType.MEDIUM
    building_type: BuildingType = BuildingType.SPECIAL_RC_MRF
    importance: ImportanceCategory = ImportanceCategory.ORDINARY
    height: float = 30.0  # Building height in meters
    num_stories: int = 10
    fundamental_period: Optional[float] = None  # If None, calculated
    live_load_factor: float = 0.25  # Fraction of live load for seismic weight
    direction: str = "X"  # X or Z for lateral direction


@dataclass 
class FloorMass:
    """Mass at a floor level"""
    level: int
    y_height: float  # Height from base
    dead_load: float  # kN
    live_load: float  # kN
    seismic_weight: float = 0  # Calculated
    lateral_force: float = 0  # Calculated (Qi)
    node_ids: List[str] = field(default_factory=list)


# ============================================
# WIND DATA MODELS
# ============================================

@dataclass
class WindParameters:
    """Input parameters for wind load calculation"""
    basic_wind_speed: float = 39.0  # Vb in m/s
    terrain_category: TerrainCategory = TerrainCategory.CAT_2
    structure_class: str = "B"  # A, B, or C
    topography_factor: float = 1.0  # k3
    importance_factor: float = 1.0  # k4
    direction: str = "X"  # Wind direction
    Cpe_windward: float = 0.8  # External pressure coefficient windward
    Cpe_leeward: float = -0.5  # External pressure coefficient leeward


__all__ = [
    "SeismicZone",
    "SoilType",
    "BuildingType",
    "ImportanceCategory",
    "TerrainCategory",
    "SeismicParameters",
    "FloorMass",
    "WindParameters",
]
