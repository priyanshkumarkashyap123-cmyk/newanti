"""
auto_loads.py - Automated Lateral Load Generators

Implements:
1. Seismic Load Generator (IS 1893 / ASCE 7 Static Method)
2. Wind Load Generator (IS 875 Part 3 / ASCE 7)

Reference Codes:
- IS 1893:2016 (Part 1) - Earthquake Design
- IS 875:2015 (Part 3) - Wind Loads
- ASCE 7-22 - Minimum Design Loads
"""

from typing import List, Dict, Tuple

# ============================================
# TYPE EXPORTS (from auto_loads_types)
# ============================================
from .auto_loads_types import (
    SeismicZone,
    SoilType,
    BuildingType,
    ImportanceCategory,
    TerrainCategory,
    SeismicParameters,
    FloorMass,
    WindParameters,
)

# ============================================
# GENERATOR EXPORTS (from auto_loads_seismic)
# ============================================
from .auto_loads_seismic import SeismicLoadGenerator

# ============================================
# GENERATOR EXPORTS (from auto_loads_wind)
# ============================================
from .auto_loads_wind import WindLoadGenerator


# ============================================
# CONVENIENCE FUNCTIONS
# ============================================

def generate_seismic_loads(
    nodes: Dict[str, Dict],
    dead_loads: Dict[str, float],
    live_loads: Dict[str, float],
    zone: int = 3,
    soil: int = 2,
    building_type: str = "SMRF",
    importance: int = 1,
    direction: str = "X"
) -> Tuple[List[Dict], Dict]:
    """
    Quick function to generate seismic loads.
    
    Returns: (nodal_loads, summary)
    """
    params = SeismicParameters(
        zone=SeismicZone(zone),
        soil_type=SoilType(soil),
        building_type=BuildingType(building_type),
        importance=ImportanceCategory(importance),
        direction=direction
    )
    
    generator = SeismicLoadGenerator(params)
    generator.compute_floor_masses(nodes, dead_loads, live_loads)
    generator.calculate_base_shear()
    generator.distribute_lateral_forces()
    
    loads = generator.generate_nodal_loads()
    summary = generator.get_summary()
    
    return loads, summary


def generate_wind_loads(
    nodes: Dict[str, Dict],
    basic_wind_speed: float = 39.0,
    terrain: int = 2,
    building_width: float = 20.0,
    direction: str = "X"
) -> Tuple[List[Dict], Dict]:
    """
    Quick function to generate wind loads.
    
    Returns: (nodal_loads, summary)
    """
    params = WindParameters(
        basic_wind_speed=basic_wind_speed,
        terrain_category=TerrainCategory(terrain),
        direction=direction
    )
    
    generator = WindLoadGenerator(params)
    generator.compute_floor_pressures(nodes, building_width)
    
    loads = generator.generate_nodal_loads(apply_to="both")
    summary = generator.get_summary()
    
    return loads, summary


# ============================================
# EXPORTS
# ============================================

__all__ = [
    'SeismicZone',
    'SoilType',
    'BuildingType',
    'ImportanceCategory',
    'TerrainCategory',
    'SeismicParameters',
    'FloorMass',
    'SeismicLoadGenerator',
    'WindParameters',
    'WindLoadGenerator',
    'generate_seismic_loads',
    'generate_wind_loads'
]
