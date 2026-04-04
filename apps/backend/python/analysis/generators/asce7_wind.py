"""
asce7_wind.py - ASCE 7 Wind Load Generator

Implements the Directional Procedure per ASCE 7-22 Chapter 27.

Reference: ASCE/SEI 7-22 "Minimum Design Loads and Associated Criteria for Buildings"

Formulas Implemented:
- Velocity pressure (qz) - Eq. 27.3-1
- Exposure coefficients (Kz) - Table 26.10-1
- Topographic factor (Kzt) - Eq. 26.8-1
- Wind directionality factor (Kd) - Table 26.6-1
- External pressure coefficients (Cp) - Figure 27.3-1
- Design wind pressures
"""

from typing import Dict, List, Optional

from .asce7_wind_calculations import ASCE7WindCalculations
from .asce7_wind_types import (
    ASCE7WindParams,
    ASCE7WindResult,
    BuildingEnclosure,
    ExposureCategory,
    RiskCategory,
    RoofType,
    WindForce,
    WindPressure,
)


# ============================================
# ASCE 7 WIND LOAD GENERATOR
# ============================================


class ASCE7WindGenerator(ASCE7WindCalculations):
    """
    ASCE 7-22 Directional Procedure for Wind Loads

    Implements Chapter 27 MWFRS requirements.
    """

    def __init__(self, params: ASCE7WindParams):
        self.params = params
        self.result = ASCE7WindResult()
        self.result.V = params.V

    # ----------------------------------------
    # Main Analysis
    # ----------------------------------------

    def analyze(
        self, nodes: Optional[Dict[str, Dict]] = None, story_heights: Optional[List[float]] = None
    ) -> ASCE7WindResult:
        """
        Perform complete ASCE 7 wind analysis.
        """
        try:
            # Initialize factors
            self.get_Kd()
            self.get_Ke()

            # Calculate pressures
            self.calculate_pressures()

            # Get wall and roof coefficients
            self.get_wall_Cp()
            self.get_roof_Cp()

            # Calculate forces if story heights provided
            if story_heights:
                self.calculate_forces(story_heights)

            # Generate nodal loads if nodes provided
            if nodes:
                self.generate_nodal_loads(nodes)

            self.result.success = True

        except Exception as e:
            self.result.success = False
            self.result.error_message = str(e)

        return self.result

    def get_summary(self) -> Dict:
        """Get analysis summary"""
        return {
            "code": "ASCE 7-22",
            "method": "Directional Procedure",
            "V": self.params.V,
            "exposure": self.params.exposure.value,
            "Kd": round(self.result.Kd, 2),
            "Ke": round(self.result.Ke, 3),
            "Kz": round(self.result.Kz, 3),
            "Kzt": round(self.result.Kzt, 3),
            "qh": round(self.result.qh, 3),
            "GCpi": round(self.result.GCpi, 2),
            "Cp_windward": self.result.Cp_windward,
            "Cp_leeward": self.result.Cp_leeward,
            "base_shear_kN": round(self.result.total_base_shear, 2),
            "moment_kN_m": round(self.result.total_overturning_moment, 2),
        }


# ============================================
# HELPER FUNCTIONS
# ============================================


def create_asce7_wind_generator(
    V: float = 115.0,
    exposure: str = "C",
    height: float = 30.0,
    width: float = 20.0,
    length: float = 30.0,
    direction: str = "X",
) -> ASCE7WindGenerator:
    """
    Factory function to create ASCE 7 wind generator.
    """
    params = ASCE7WindParams(
        V=V, exposure=ExposureCategory(exposure), height=height, width=width, length=length, direction=direction
    )
    return ASCE7WindGenerator(params)


# ============================================
# EXPORTS
# ============================================

__all__ = [
    "RiskCategory",
    "ExposureCategory",
    "BuildingEnclosure",
    "RoofType",
    "ASCE7WindParams",
    "WindPressure",
    "WindForce",
    "ASCE7WindResult",
    "ASCE7WindGenerator",
    "create_asce7_wind_generator",
]
