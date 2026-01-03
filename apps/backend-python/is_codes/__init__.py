"""
IS Codes Package

Indian Standard codes for structural design:
- IS 800:2007 - Steel Design (Limit State Method)
- IS 875 - Design Loads (Parts 1-5)
- IS 456:2000 - Concrete Design (planned)
- IS 1893:2016 - Seismic Design (planned)
"""

from .is_800 import (
    check_member_is800,
    design_tension_member,
    design_compression_member,
    design_flexure_member,
    design_combined_forces,
    classify_section,
    ISMB_SECTIONS,
    STEEL_GRADES,
    SteelSection,
    SteelGrade,
    SectionClass,
)

from .is_875 import (
    calculate_dead_load,
    get_live_load,
    reduce_live_load,
    calculate_wind_pressure,
    calculate_wind_force,
    get_load_combinations,
    calculate_combined_load,
    calculate_floor_loads,
    OccupancyType,
    TerrainCategory,
    DesignMethod,
    MATERIAL_DENSITIES,
    LIVE_LOADS,
)

from .is_456 import (
    design_beam_flexure,
    design_shear,
    check_column_capacity,
    design_beam_flexure_capacity,
    CONCRETE_GRADES,
    REBAR_GRADES,
)

from .is_1893 import (
    calculate_base_shear,
    get_sa_by_g,
    calculate_vertical_distribution,
    calculate_period_approx,
    SeismicZone,
    SoilType,
)

__all__ = [
    # IS 800 - Steel Design
    "check_member_is800",
    "design_tension_member",
    "design_compression_member",
    "design_flexure_member",
    "design_combined_forces",
    "classify_section",
    "ISMB_SECTIONS",
    "STEEL_GRADES",
    "SteelSection",
    "SteelGrade",
    "SectionClass",
    
    # IS 875 - Loads
    "calculate_dead_load",
    "get_live_load",
    "reduce_live_load",
    "calculate_wind_pressure",
    "calculate_wind_force",
    "get_load_combinations",
    "calculate_combined_load",
    "calculate_floor_loads",
    "OccupancyType",
    "TerrainCategory",
    "DesignMethod",
    "MATERIAL_DENSITIES",
    "LIVE_LOADS",

    # IS 456 - Concrete Design
    "design_beam_flexure",
    "design_shear",
    "check_column_capacity",
    "design_beam_flexure_capacity",
    "CONCRETE_GRADES",
    "REBAR_GRADES",
    
    # IS 1893 - Seismic
    "calculate_base_shear",
    "get_sa_by_g",
    "calculate_vertical_distribution",
    "calculate_period_approx",
    "SeismicZone",
    "SoilType",
]
