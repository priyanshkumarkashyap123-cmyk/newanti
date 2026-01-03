"""
IS 875 - Indian Standard for Design Loads

Implements load calculation per IS 875 (Parts 1-5)
- Part 1: Dead Loads (1987)
- Part 2: Imposed Loads (1987, reaffirmed 2018)
- Part 3: Wind Loads (2015)
- Part 5: Special Loads & Combinations

All units in SI (kN, m, kN/m², etc.)
"""

from dataclasses import dataclass
from typing import Dict, List, Tuple, Optional
from enum import Enum
import math


# ============================================
# IS 875 PART 1: DEAD LOADS (MATERIAL DENSITIES)
# ============================================

# Material unit weights (kN/m³) per IS 875 Part 1
MATERIAL_DENSITIES = {
    # Concrete
    "plain_concrete": 24.0,
    "reinforced_concrete": 25.0,
    "lightweight_concrete": 18.0,
    "screed": 22.0,
    
    # Masonry
    "brick_masonry": 20.0,
    "stone_masonry": 24.0,
    "aac_block": 8.0,  # Autoclaved Aerated Concrete
    "fly_ash_brick": 18.0,
    
    # Steel
    "steel": 78.5,
    "cast_iron": 72.0,
    
    # Timber
    "teak": 8.5,
    "sal": 9.0,
    "deodar": 5.5,
    "plywood": 6.0,
    
    # Floor finishes
    "cement_mortar": 20.0,
    "tiles_ceramic": 22.0,
    "marble": 27.0,
    "granite": 28.0,
    
    # Roofing
    "clay_tiles": 20.0,
    "asbestos_sheets": 17.5,
    "gc_sheets": 78.5,  # Per mm thickness
    "bitumen_felt": 10.0,
    
    # Insulation
    "thermocol": 0.15,
    "glass_wool": 0.5,
    
    # Glass
    "glass": 25.0,
    
    # Water
    "water": 10.0,
}

# Common slab configurations (kN/m²)
SLAB_DEAD_LOADS = {
    "100mm_rcc_slab": 2.5,
    "125mm_rcc_slab": 3.125,
    "150mm_rcc_slab": 3.75,
    "200mm_rcc_slab": 5.0,
    "floor_finish_tiles": 1.0,  # 40mm screed + tiles
    "floor_finish_marble": 1.5,
    "plaster_ceiling": 0.5,
    "false_ceiling": 0.2,
    "waterproofing": 0.3,
}


def calculate_dead_load(
    slab_thickness_mm: float = 150,
    floor_finish: str = "tiles",
    has_ceiling: bool = True,
    has_waterproofing: bool = False,
    additional_services: float = 0.0
) -> Dict[str, float]:
    """
    Calculate dead load for a floor slab.
    
    Args:
        slab_thickness_mm: RCC slab thickness in mm
        floor_finish: Type of floor finish
        has_ceiling: Whether false ceiling is present
        has_waterproofing: Whether waterproofing is present
        additional_services: Additional services load (HVAC, plumbing etc.)
    
    Returns:
        Dict with component-wise dead loads (kN/m²)
    """
    loads = {}
    
    # Slab self-weight
    loads["slab_self_weight"] = (slab_thickness_mm / 1000) * 25.0
    
    # Floor finish
    finish_loads = {
        "tiles": 1.0,
        "marble": 1.5,
        "granite": 1.6,
        "vitrified": 0.9,
        "none": 0.0
    }
    loads["floor_finish"] = finish_loads.get(floor_finish, 1.0)
    
    # Ceiling
    if has_ceiling:
        loads["ceiling"] = 0.2
    
    # Waterproofing (typically for terrace)
    if has_waterproofing:
        loads["waterproofing"] = 0.3
    
    # Services
    if additional_services > 0:
        loads["services"] = additional_services
    
    # Total
    loads["total"] = sum(loads.values())
    
    return loads


# ============================================
# IS 875 PART 2: IMPOSED/LIVE LOADS
# ============================================

class OccupancyType(Enum):
    """Occupancy types per IS 875 Part 2 Table 1"""
    RESIDENTIAL = "residential"
    OFFICE = "office"
    RETAIL = "retail"
    ASSEMBLY = "assembly"
    STORAGE = "storage"
    INDUSTRIAL = "industrial"
    HOSPITAL = "hospital"
    EDUCATIONAL = "educational"
    LIBRARY_STACK = "library_stack"
    PARKING = "parking"
    BALCONY = "balcony"
    STAIRCASE = "staircase"
    TERRACE = "terrace"


# Live loads per IS 875 Part 2 Table 1 (kN/m²)
LIVE_LOADS = {
    OccupancyType.RESIDENTIAL: {
        "living_rooms": 2.0,
        "bedrooms": 2.0,
        "corridors": 3.0,
        "store_rooms": 3.0,
    },
    OccupancyType.OFFICE: {
        "general": 3.0,
        "with_equipment": 4.0,
        "filing_rooms": 5.0,
        "computer_rooms": 3.5,
    },
    OccupancyType.RETAIL: {
        "shops": 4.0,
        "department_store": 5.0,
        "wholesale": 6.0,
    },
    OccupancyType.ASSEMBLY: {
        "with_fixed_seats": 4.0,
        "without_fixed_seats": 5.0,
        "stage": 5.0,
    },
    OccupancyType.STORAGE: {
        "light": 6.0,
        "medium": 8.0,
        "heavy": 12.0,
        "godown": 10.0,
    },
    OccupancyType.INDUSTRIAL: {
        "light": 5.0,
        "medium": 7.5,
        "heavy": 10.0,
    },
    OccupancyType.HOSPITAL: {
        "wards": 2.0,
        "operating_rooms": 3.0,
        "corridors": 4.0,
    },
    OccupancyType.EDUCATIONAL: {
        "classrooms": 3.0,
        "laboratories": 4.0,
        "corridors": 4.0,
    },
    OccupancyType.LIBRARY_STACK: {
        "reading_rooms": 4.0,
        "stack_rooms": 10.0,
    },
    OccupancyType.PARKING: {
        "light_vehicles": 2.5,
        "heavy_vehicles": 5.0,
    },
    OccupancyType.BALCONY: {
        "residential": 3.0,
        "assembly": 5.0,
    },
    OccupancyType.STAIRCASE: {
        "residential": 3.0,
        "assembly": 5.0,
    },
    OccupancyType.TERRACE: {
        "accessible": 1.5,
        "non_accessible": 0.75,
    },
}


def get_live_load(
    occupancy: OccupancyType,
    sub_type: str = "general"
) -> float:
    """
    Get live load for given occupancy type.
    
    Args:
        occupancy: Occupancy type enum
        sub_type: Specific sub-type within occupancy
    
    Returns:
        Live load in kN/m²
    """
    loads = LIVE_LOADS.get(occupancy, {})
    
    # Try to find matching sub-type
    if sub_type in loads:
        return loads[sub_type]
    
    # Return first available or default
    if loads:
        return list(loads.values())[0]
    
    return 2.0  # Default residential


# Live load reduction for large areas (Clause 3.2)
def reduce_live_load(
    live_load: float,
    area_supported: float,  # m²
    num_floors: int = 1
) -> float:
    """
    Apply live load reduction for large tributary areas.
    
    Per IS 875 Part 2 Clause 3.2:
    - For A > 50m²: reduction allowed
    - For multi-story: additional reduction
    
    Args:
        live_load: Characteristic live load (kN/m²)
        area_supported: Tributary area (m²)
        num_floors: Number of floors supported
    
    Returns:
        Reduced live load (kN/m²)
    """
    if area_supported <= 50:
        reduction = 1.0
    else:
        # Reduction factor = 100 / (A + 100)
        reduction = 100 / (area_supported + 100)
        reduction = max(reduction, 0.5)  # Minimum 50%
    
    # Multi-floor reduction (simplified)
    if num_floors > 1:
        floor_reduction = 0.9 ** (num_floors - 1)
        reduction *= max(floor_reduction, 0.6)
    
    return live_load * reduction


# ============================================
# IS 875 PART 3: WIND LOADS (2015)
# ============================================

class TerrainCategory(Enum):
    """Terrain categories per IS 875 Part 3"""
    CATEGORY_1 = 1  # Exposed open terrain (sea coast, deserts)
    CATEGORY_2 = 2  # Open terrain with scattered obstructions
    CATEGORY_3 = 3  # Terrain with numerous closely spaced obstructions
    CATEGORY_4 = 4  # Terrain with large closely spaced obstructions (city centers)


# Basic wind speed map (m/s) - representative values
BASIC_WIND_SPEEDS = {
    # Major cities (approximate zones)
    "Mumbai": 44,
    "Delhi": 47,
    "Kolkata": 50,
    "Chennai": 50,
    "Bangalore": 33,
    "Hyderabad": 44,
    "Ahmedabad": 39,
    "Pune": 39,
    "Jaipur": 47,
    "Lucknow": 47,
    "Bhopal": 47,
    "Chandigarh": 47,
    "Kochi": 39,
    "Vizag": 50,
    "Guwahati": 50,
    # Cyclone prone areas
    "Odisha_coast": 55,
    "Gujarat_coast": 50,
    "Andhra_coast": 55,
}


@dataclass
class WindLoadParams:
    """Parameters for wind load calculation"""
    Vb: float  # Basic wind speed (m/s)
    terrain: TerrainCategory
    k1: float = 1.0  # Risk coefficient (1.0 for normal structures)
    k3: float = 1.0  # Topography factor
    height: float = 10.0  # Building height (m)
    

def calculate_wind_pressure(
    Vb: float,  # Basic wind speed (m/s)
    height: float = 10.0,  # Height above ground (m)
    terrain: TerrainCategory = TerrainCategory.CATEGORY_2,
    k1: float = 1.0,  # Risk coefficient
    k3: float = 1.0,  # Topography factor
) -> Dict[str, float]:
    """
    Calculate design wind pressure per IS 875 Part 3.
    
    Args:
        Vb: Basic wind speed from wind map (m/s)
        height: Height above ground level (m)
        terrain: Terrain category
        k1: Risk coefficient (Table 1)
        k3: Topography factor (k3 = 1 for flat terrain)
    
    Returns:
        Dict with wind velocities and pressures
    """
    # k2 - Terrain and height factor (Table 2, simplified)
    k2_values = {
        TerrainCategory.CATEGORY_1: [1.05, 1.12, 1.18, 1.24, 1.28],
        TerrainCategory.CATEGORY_2: [0.91, 1.00, 1.06, 1.12, 1.17],
        TerrainCategory.CATEGORY_3: [0.80, 0.88, 0.93, 0.98, 1.03],
        TerrainCategory.CATEGORY_4: [0.71, 0.78, 0.82, 0.86, 0.90],
    }
    
    heights = [10, 15, 20, 30, 50]
    k2_for_terrain = k2_values[terrain]
    
    # Interpolate k2 for height
    if height <= heights[0]:
        k2 = k2_for_terrain[0]
    elif height >= heights[-1]:
        k2 = k2_for_terrain[-1]
    else:
        for i in range(len(heights) - 1):
            if heights[i] <= height < heights[i + 1]:
                ratio = (height - heights[i]) / (heights[i + 1] - heights[i])
                k2 = k2_for_terrain[i] + ratio * (k2_for_terrain[i + 1] - k2_for_terrain[i])
                break
    
    # Design wind speed (Clause 6.3)
    Vz = Vb * k1 * k2 * k3
    
    # Design wind pressure (Clause 7.2)
    # pz = 0.6 * Vz² (N/m² or Pa)
    pz = 0.6 * Vz ** 2
    
    return {
        "Vb_m_s": Vb,
        "k1": k1,
        "k2": k2,
        "k3": k3,
        "Vz_m_s": Vz,
        "pz_N_m2": pz,
        "pz_kN_m2": pz / 1000
    }


def calculate_wind_force(
    pz: float,  # Wind pressure (kN/m²)
    Ae: float,  # Effective frontal area (m²)
    Cf: float = 1.0,  # Force coefficient
    Kd: float = 0.9,  # Wind directionality factor
    Ka: float = 1.0,  # Area averaging factor
) -> float:
    """
    Calculate wind force on a surface.
    
    F = Cf × pz × Ae × Kd × Ka
    
    Args:
        pz: Design wind pressure (kN/m²)
        Ae: Effective frontal area (m²)
        Cf: Force coefficient (Table 21-27)
        Kd: Directionality factor (0.9 for rectangular buildings)
        Ka: Area averaging factor
    
    Returns:
        Wind force (kN)
    """
    return Cf * pz * Ae * Kd * Ka


# ============================================
# IS 875 PART 5: LOAD COMBINATIONS
# ============================================

class DesignMethod(Enum):
    """Design method for load factors"""
    LSM = "limit_state_method"  # IS 456, IS 800
    WSM = "working_stress_method"  # Legacy


# Load combination factors per IS 875 Part 5 (Table 1)
LOAD_COMBINATIONS_LSM = {
    "DL_LL": {"DL": 1.5, "LL": 1.5},
    "DL_LL_WL": {"DL": 1.2, "LL": 1.2, "WL": 1.2},
    "DL_WL": {"DL": 1.5, "WL": 1.5},
    "DL_LL_EQ": {"DL": 1.2, "LL": 1.2, "EQ": 1.2},
    "DL_EQ": {"DL": 1.5, "EQ": 1.5},
    "DL_LL_REDUCED": {"DL": 1.5, "LL": 1.05},  # Pattern loading
    "0.9DL_WL": {"DL": 0.9, "WL": 1.5},  # For uplift
    "0.9DL_EQ": {"DL": 0.9, "EQ": 1.5},  # For overturning
}

LOAD_COMBINATIONS_WSM = {
    "DL_LL": {"DL": 1.0, "LL": 1.0},
    "DL_LL_WL": {"DL": 1.0, "LL": 1.0, "WL": 1.0},
    "DL_WL": {"DL": 1.0, "WL": 1.0},
}


def get_load_combinations(
    method: DesignMethod = DesignMethod.LSM,
    include_earthquake: bool = True,
    include_wind: bool = True
) -> Dict[str, Dict[str, float]]:
    """
    Get applicable load combinations.
    
    Args:
        method: Design method (LSM or WSM)
        include_earthquake: Whether to include EQ combinations
        include_wind: Whether to include wind combinations
    
    Returns:
        Dict of combination_name -> {load_type: factor}
    """
    if method == DesignMethod.LSM:
        combos = dict(LOAD_COMBINATIONS_LSM)
    else:
        combos = dict(LOAD_COMBINATIONS_WSM)
    
    # Filter based on requirements
    if not include_wind:
        combos = {k: v for k, v in combos.items() if "WL" not in k}
    
    if not include_earthquake:
        combos = {k: v for k, v in combos.items() if "EQ" not in k}
    
    return combos


def calculate_combined_load(
    DL: float = 0,  # Dead load (kN/m² or kN)
    LL: float = 0,  # Live load
    WL: float = 0,  # Wind load
    EQ: float = 0,  # Earthquake load
    combination: str = "DL_LL",
    method: DesignMethod = DesignMethod.LSM
) -> Dict[str, float]:
    """
    Calculate combined factored load.
    
    Args:
        DL: Dead load
        LL: Live load
        WL: Wind load
        EQ: Earthquake load
        combination: Name of load combination
        method: Design method
    
    Returns:
        Dict with factored and total loads
    """
    combos = LOAD_COMBINATIONS_LSM if method == DesignMethod.LSM else LOAD_COMBINATIONS_WSM
    
    if combination not in combos:
        combination = "DL_LL"
    
    factors = combos[combination]
    
    factored = {
        "DL_factored": DL * factors.get("DL", 0),
        "LL_factored": LL * factors.get("LL", 0),
        "WL_factored": WL * factors.get("WL", 0),
        "EQ_factored": EQ * factors.get("EQ", 0),
    }
    
    factored["total"] = sum(factored.values())
    factored["combination"] = combination
    factored["factors"] = factors
    
    return factored


# ============================================
# CONVENIENCE FUNCTION FOR FLOOR LOADS
# ============================================

def calculate_floor_loads(
    occupancy: str = "residential",
    slab_thickness_mm: float = 150,
    floor_finish: str = "tiles",
    tributary_area: float = 20,  # m²
    num_floors: int = 1
) -> Dict[str, any]:
    """
    Calculate total floor loads for design.
    
    Args:
        occupancy: Occupancy type string
        slab_thickness_mm: RCC slab thickness
        floor_finish: Type of floor finish
        tributary_area: Tributary area (m²)
        num_floors: Number of floors supported
    
    Returns:
        Dict with dead load, live load, and combinations
    """
    # Dead load
    dead = calculate_dead_load(
        slab_thickness_mm=slab_thickness_mm,
        floor_finish=floor_finish
    )
    
    # Live load
    try:
        occ_type = OccupancyType(occupancy.lower())
    except ValueError:
        occ_type = OccupancyType.RESIDENTIAL
    
    live = get_live_load(occ_type)
    
    # Apply reduction if area is large
    live_reduced = reduce_live_load(live, tributary_area, num_floors)
    
    # Load combinations
    combos = {}
    for combo_name in ["DL_LL", "DL_LL_REDUCED"]:
        combos[combo_name] = calculate_combined_load(
            DL=dead["total"],
            LL=live_reduced,
            combination=combo_name
        )
    
    return {
        "dead_load": dead,
        "live_load_characteristic": live,
        "live_load_reduced": live_reduced,
        "reduction_factor": live_reduced / live if live > 0 else 1.0,
        "combinations": combos
    }


# ============================================
# EXAMPLE USAGE
# ============================================

if __name__ == "__main__":
    # Example: Calculate loads for an office floor
    result = calculate_floor_loads(
        occupancy="office",
        slab_thickness_mm=150,
        floor_finish="tiles",
        tributary_area=50,
        num_floors=5
    )
    
    print("=== Floor Load Calculation (IS 875) ===")
    print(f"\nDead Load Components:")
    for key, val in result["dead_load"].items():
        print(f"  {key}: {val:.2f} kN/m²")
    
    print(f"\nLive Load:")
    print(f"  Characteristic: {result['live_load_characteristic']:.2f} kN/m²")
    print(f"  Reduced: {result['live_load_reduced']:.2f} kN/m²")
    print(f"  Reduction: {result['reduction_factor']:.2%}")
    
    print(f"\nLoad Combinations (LSM):")
    for combo, data in result["combinations"].items():
        print(f"  {combo}: {data['total']:.2f} kN/m²")
    
    # Wind load example
    print("\n=== Wind Load Calculation ===")
    wind = calculate_wind_pressure(
        Vb=44,  # Mumbai
        height=30,
        terrain=TerrainCategory.CATEGORY_3
    )
    print(f"Design wind speed: {wind['Vz_m_s']:.1f} m/s")
    print(f"Design wind pressure: {wind['pz_kN_m2']:.3f} kN/m²")
