"""
Type definitions for ASCE 7 Wind Load Generator

Includes:
- Risk/Exposure/Enclosure enumerations (ASCE 7-22)
- Wind parameter dataclasses
- Result/pressure/force dataclasses
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional
from enum import Enum


# ============================================
# ENUMERATIONS
# ============================================

class RiskCategory(Enum):
    """ASCE 7 Risk Categories (Table 1.5-1)"""
    I = 1    # Low hazard
    II = 2   # Standard
    III = 3  # Substantial hazard
    IV = 4   # Essential facilities


class ExposureCategory(Enum):
    """ASCE 7 Exposure Categories (Section 26.7)"""
    B = "B"  # Urban and suburban
    C = "C"  # Open terrain (default)
    D = "D"  # Flat, unobstructed coastal


class BuildingEnclosure(Enum):
    """Building enclosure classification"""
    ENCLOSED = "enclosed"
    PARTIALLY_ENCLOSED = "partially_enclosed"
    OPEN = "open"


class RoofType(Enum):
    """Roof types for pressure coefficients"""
    FLAT = "flat"           # θ <= 10°
    GABLE = "gable"         # Two slopes meeting at ridge
    HIP = "hip"             # Four slopes
    MONOSLOPE = "monoslope"  # Single slope


# ============================================
# DATA STRUCTURES
# ============================================

@dataclass
class ASCE7WindParams:
    """Input parameters for ASCE 7 wind analysis"""
    # Basic wind speed (mph) - from ASCE 7 maps
    V: float = 115.0
    
    # Risk and exposure
    risk_category: RiskCategory = RiskCategory.II
    exposure: ExposureCategory = ExposureCategory.C
    enclosure: BuildingEnclosure = BuildingEnclosure.ENCLOSED
    
    # Building geometry (meters)
    height: float = 30.0
    width: float = 20.0      # Perpendicular to wind
    length: float = 30.0     # Parallel to wind
    
    # Roof
    roof_type: RoofType = RoofType.FLAT
    roof_angle: float = 0.0  # degrees
    
    # Topography
    is_on_hill: bool = False
    hill_height: float = 0.0      # H
    hill_half_length: float = 0.0  # Lh
    distance_from_crest: float = 0.0  # x
    
    # Elevation
    ground_elevation: float = 0.0  # meters above sea level
    
    # Internal pressure
    GCpi: Optional[float] = None  # Override internal pressure coefficient
    
    # Direction
    direction: str = "X"


@dataclass
class WindPressure:
    """Wind pressure at a specific height"""
    height: float       # meters
    qz: float          # Velocity pressure (kN/m²)
    Kz: float          # Exposure coefficient
    Kzt: float         # Topographic factor
    p_windward: float  # Windward pressure (kN/m²)
    p_leeward: float   # Leeward pressure (kN/m²)
    p_net: float       # Net pressure (kN/m²)


@dataclass
class WindForce:
    """Wind force on a member or surface"""
    member_id: str
    height: float
    area: float        # m²
    force: float       # kN
    direction: str     # "X", "Y", or "Z"


@dataclass
class ASCE7WindResult:
    """Complete ASCE 7 wind analysis result"""
    success: bool = True
    
    # Basic parameters
    V: float = 115.0          # Basic wind speed (mph)
    Kd: float = 0.85          # Directionality factor
    Ke: float = 1.0           # Ground elevation factor
    
    # Height-based values
    Kz: float = 0.0           # At mean roof height
    Kzt: float = 1.0          # Topographic factor
    qh: float = 0.0           # Velocity pressure at roof height (kN/m²)
    
    # Pressure coefficients
    GCpi: float = 0.18        # Internal pressure coefficient
    Cp_windward: float = 0.8  # Windward wall
    Cp_leeward: float = -0.5  # Leeward wall (suction)
    Cp_side: float = -0.7     # Side walls (suction)
    Cp_roof: float = -0.9     # Roof (suction/pressure varies)
    
    # Forces
    total_base_shear: float = 0.0
    total_overturning_moment: float = 0.0
    
    # Detailed results
    pressures: List[WindPressure] = field(default_factory=list)
    member_forces: List[WindForce] = field(default_factory=list)
    nodal_loads: List[Dict] = field(default_factory=list)
    
    # Error
    error_message: Optional[str] = None


__all__ = [
    "RiskCategory",
    "ExposureCategory",
    "BuildingEnclosure",
    "RoofType",
    "ASCE7WindParams",
    "WindPressure",
    "WindForce",
    "ASCE7WindResult",
]
