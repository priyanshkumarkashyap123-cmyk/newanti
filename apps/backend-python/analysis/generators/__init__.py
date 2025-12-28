"""
Generators Module - Automated Load Generators

Includes:
- Wind Load Generator (IS 875 Part 3 / ASCE 7)
- Seismic Load Generator (IS 1893 / ASCE 7)
- Moving Load Generator (IRC / AASHTO)
"""

from .auto_loads import (
    # Seismic
    SeismicZone,
    SoilType,
    BuildingType,
    ImportanceCategory,
    SeismicParameters,
    FloorMass,
    SeismicLoadGenerator,
    # Wind
    TerrainCategory,
    WindParameters,
    WindLoadGenerator,
    # Convenience functions
    generate_seismic_loads,
    generate_wind_loads
)

# Try importing moving_load if it exists
try:
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
    _has_moving_load = True
except ImportError:
    _has_moving_load = False

__all__ = [
    # Seismic
    "SeismicZone",
    "SoilType",
    "BuildingType",
    "ImportanceCategory",
    "SeismicParameters",
    "FloorMass",
    "SeismicLoadGenerator",
    "generate_seismic_loads",
    # Wind
    "TerrainCategory",
    "WindParameters",
    "WindLoadGenerator",
    "generate_wind_loads",
]

# Add moving load exports if available
if _has_moving_load:
    __all__.extend([
        "MovingLoadGenerator",
        "Vehicle",
        "Lane",
        "IRC_CLASS_A",
        "IRC_CLASS_AA",
        "IRC_70R",
        "AASHTO_HL93",
        "InfluenceEnvelope"
    ])
