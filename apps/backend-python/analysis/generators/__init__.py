"""
Generators Module - Automated Load Generators

Includes:
- Wind Load Generator (IS 875 Part 3 / ASCE 7)
- Seismic Load Generator (IS 1893 / ASCE 7)
- Moving Load Generator (IRC / AASHTO)
"""

from .auto_loads import (
    WindLoadGenerator,
    SeismicLoadGenerator,
    WindLoadInput,
    SeismicLoadInput,
    TerrainCategory,
    SeismicZone,
    SoilType,
    calculate_wind_pressure,
    calculate_seismic_coefficient
)

from .moving_load import (
    MovingLoadGenerator,
    Vehicle,
    Lane,
    IRC_CLASS_A,
    IRC_CLASS_AA,
    IRC_70R,
    AASHTO_HL93,
    InfluenceEnvelope
)

__all__ = [
    # Wind
    "WindLoadGenerator",
    "WindLoadInput",
    "TerrainCategory",
    "calculate_wind_pressure",
    # Seismic
    "SeismicLoadGenerator",
    "SeismicLoadInput",
    "SeismicZone",
    "SoilType",
    "calculate_seismic_coefficient",
    # Moving Load
    "MovingLoadGenerator",
    "Vehicle",
    "Lane",
    "IRC_CLASS_A",
    "IRC_CLASS_AA",
    "IRC_70R",
    "AASHTO_HL93",
    "InfluenceEnvelope"
]
