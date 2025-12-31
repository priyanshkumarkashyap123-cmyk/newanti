"""
Generators Module - Automated Load Generators

Includes:
- Wind Load Generator (IS 875 Part 3 / ASCE 7)
- Seismic Load Generator (IS 1893 / ASCE 7)
- Moving Load Generator (IRC / AASHTO)
- Load Combinations Generator (ASCE 7 / IS 456 / ACI 318)
"""

from .auto_loads import (
    # Seismic (IS 1893)
    SeismicZone,
    SoilType,
    BuildingType,
    ImportanceCategory,
    SeismicParameters,
    FloorMass,
    SeismicLoadGenerator,
    # Wind (IS 875)
    TerrainCategory,
    WindParameters,
    WindLoadGenerator,
    # Convenience functions
    generate_seismic_loads,
    generate_wind_loads
)

# ASCE 7 Seismic
from .asce7_seismic import (
    ASCE7SeismicParams,
    ASCE7SeismicResult,
    ASCE7SeismicGenerator,
    SiteClass,
    RiskCategory as ASCE7RiskCategory,
    StructuralSystem,
    SeismicDesignCategory,
    create_asce7_seismic_generator
)

# ASCE 7 Wind
from .asce7_wind import (
    ASCE7WindParams,
    ASCE7WindResult,
    ASCE7WindGenerator,
    ExposureCategory,
    BuildingEnclosure,
    RoofType,
    create_asce7_wind_generator
)

# Load Combinations
from .load_combinations import (
    LoadCombination,
    LoadFactor,
    LoadCombinationsManager,
    DesignCode,
    LoadType,
    create_combinations_manager,
    get_all_available_combinations,
    get_asce7_lrfd_combinations,
    get_asce7_asd_combinations,
    get_is456_lsm_combinations,
    get_aci318_combinations
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
    # Seismic (IS 1893)
    "SeismicZone",
    "SoilType",
    "BuildingType",
    "ImportanceCategory",
    "SeismicParameters",
    "FloorMass",
    "SeismicLoadGenerator",
    "generate_seismic_loads",
    # Wind (IS 875)
    "TerrainCategory",
    "WindParameters",
    "WindLoadGenerator",
    "generate_wind_loads",
    # ASCE 7 Seismic
    "ASCE7SeismicParams",
    "ASCE7SeismicResult",
    "ASCE7SeismicGenerator",
    "SiteClass",
    "ASCE7RiskCategory",
    "StructuralSystem",
    "SeismicDesignCategory",
    "create_asce7_seismic_generator",
    # ASCE 7 Wind
    "ASCE7WindParams",
    "ASCE7WindResult",
    "ASCE7WindGenerator",
    "ExposureCategory",
    "BuildingEnclosure",
    "RoofType",
    "create_asce7_wind_generator",
    # Load Combinations
    "LoadCombination",
    "LoadFactor",
    "LoadCombinationsManager",
    "DesignCode",
    "LoadType",
    "create_combinations_manager",
    "get_all_available_combinations",
    "get_asce7_lrfd_combinations",
    "get_asce7_asd_combinations",
    "get_is456_lsm_combinations",
    "get_aci318_combinations",
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

