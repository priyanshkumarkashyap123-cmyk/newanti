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

import math
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from enum import Enum
import numpy as np


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


# ============================================
# WIND ENUMERATIONS
# ============================================

class TerrainCategory(Enum):
    """IS 875 Terrain Categories"""
    CAT_1 = 1  # Open terrain (coastal, desert)
    CAT_2 = 2  # Open terrain with scattered obstructions
    CAT_3 = 3  # Built-up areas (suburban)
    CAT_4 = 4  # Built-up areas (urban, city centers)


# ============================================
# SEISMIC LOAD GENERATOR
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


class SeismicLoadGenerator:
    """
    Static Equivalent Lateral Force Method
    
    As per IS 1893:2016 (Part 1) / ASCE 7-22
    """
    
    def __init__(self, params: SeismicParameters):
        self.params = params
        self.floor_masses: List[FloorMass] = []
        self.total_seismic_weight = 0
        self.base_shear = 0
        self.Ah = 0  # Design horizontal acceleration coefficient
        self.Ta = 0  # Fundamental period
    
    def calculate_period(self) -> float:
        """
        Calculate fundamental period Ta.
        
        IS 1893 Clause 7.6.1:
        - For RC MRF: Ta = 0.075 × h^0.75
        - For Steel MRF: Ta = 0.085 × h^0.75
        - For All others: Ta = 0.09 × h / √d
        
        h = height in meters
        d = base dimension in direction of vibration
        """
        h = self.params.height
        
        if self.params.fundamental_period:
            return self.params.fundamental_period
        
        if self.params.building_type in [BuildingType.SPECIAL_RC_MRF, BuildingType.ORDINARY_RC_MRF]:
            Ta = 0.075 * (h ** 0.75)
        elif self.params.building_type in [BuildingType.SPECIAL_STEEL_MRF, BuildingType.ORDINARY_STEEL_MRF]:
            Ta = 0.085 * (h ** 0.75)
        else:
            # Assume base dimension ~ 0.6 × height
            d = 0.6 * h
            Ta = 0.09 * h / math.sqrt(d)
        
        self.Ta = Ta
        return Ta
    
    def calculate_Sa_g(self, T: float) -> float:
        """
        Calculate spectral acceleration coefficient Sa/g.
        
        IS 1893 Figure 2 (Response Spectrum):
        - T ≤ 0.10s: Sa/g = 1 + 15×T
        - 0.10 < T ≤ 0.40s: Sa/g = 2.5 (plateau)
        - 0.40 < T ≤ 4.0s: Sa/g = 1.0/T (for medium soil)
        
        Adjusted for soil type.
        """
        soil = self.params.soil_type
        
        # Soil period boundaries
        if soil == SoilType.ROCK:
            T1, T2 = 0.10, 0.40
        elif soil == SoilType.MEDIUM:
            T1, T2 = 0.10, 0.55
        else:  # Soft
            T1, T2 = 0.10, 0.67
        
        if T <= 0:
            Sa_g = 1.0
        elif T <= T1:
            Sa_g = 1.0 + 15 * T
        elif T <= T2:
            Sa_g = 2.5
        elif T <= 4.0:
            if soil == SoilType.ROCK:
                Sa_g = 1.0 / T
            elif soil == SoilType.MEDIUM:
                Sa_g = 1.36 / T
            else:
                Sa_g = 1.67 / T
        else:
            Sa_g = 0.25  # Beyond 4 seconds
        
        return Sa_g
    
    def calculate_Ah(self) -> float:
        """
        Calculate design horizontal acceleration coefficient Ah.
        
        IS 1893 Clause 6.4.2:
        Ah = (Z/2) × (I/R) × (Sa/g)
        
        Where:
        Z = Zone factor
        I = Importance factor
        R = Response reduction factor
        Sa/g = Spectral acceleration coefficient
        """
        Z = self.params.zone.factor
        I = self.params.importance.factor
        R = self.params.building_type.R
        
        T = self.calculate_period()
        Sa_g = self.calculate_Sa_g(T)
        
        Ah = (Z / 2) * (I / R) * Sa_g
        
        # Minimum Ah as per code
        Ah = max(Ah, Z * I / (2 * R) * 0.12)  # Minimum 0.12 × Z/2 × I/R
        
        self.Ah = Ah
        return Ah
    
    def compute_floor_masses(
        self,
        nodes: Dict[str, Dict],
        dead_loads: Dict[str, float],  # node_id -> load (kN)
        live_loads: Dict[str, float]   # node_id -> load (kN)
    ) -> List[FloorMass]:
        """
        Group loads by floor level and calculate seismic weights.
        
        Seismic Weight W = DL + (factor × LL)
        factor = 0.25 typically (25% of LL considered)
        """
        # Group nodes by Y-level (floor)
        y_levels: Dict[float, List[str]] = {}
        tolerance = 0.1  # m
        
        for nid, node in nodes.items():
            y = round(node['y'] / tolerance) * tolerance
            if y not in y_levels:
                y_levels[y] = []
            y_levels[y].append(nid)
        
        # Sort levels
        sorted_levels = sorted(y_levels.keys())
        
        self.floor_masses = []
        for i, y in enumerate(sorted_levels):
            node_ids = y_levels[y]
            
            dl = sum(dead_loads.get(nid, 0) for nid in node_ids)
            ll = sum(live_loads.get(nid, 0) for nid in node_ids)
            
            seismic_wt = dl + self.params.live_load_factor * ll
            
            self.floor_masses.append(FloorMass(
                level=i,
                y_height=y,
                dead_load=dl,
                live_load=ll,
                seismic_weight=seismic_wt,
                node_ids=node_ids
            ))
        
        self.total_seismic_weight = sum(fm.seismic_weight for fm in self.floor_masses)
        return self.floor_masses
    
    def calculate_base_shear(self) -> float:
        """
        Calculate design base shear Vb.
        
        Vb = Ah × W
        
        Where:
        Ah = Design horizontal acceleration coefficient
        W = Total seismic weight
        """
        Ah = self.calculate_Ah()
        self.base_shear = Ah * self.total_seismic_weight
        return self.base_shear
    
    def distribute_lateral_forces(self) -> List[FloorMass]:
        """
        Distribute base shear to floor levels.
        
        IS 1893 Clause 7.7:
        Qi = Vb × (Wi × hi²) / Σ(Wj × hj²)
        
        Where:
        Qi = Lateral force at floor i
        Wi = Seismic weight at floor i
        hi = Height of floor i from base
        """
        Vb = self.base_shear
        if Vb == 0:
            Vb = self.calculate_base_shear()
        
        # Calculate denominator
        sum_Wh2 = sum(
            fm.seismic_weight * (fm.y_height ** 2) 
            for fm in self.floor_masses
        )
        
        if sum_Wh2 == 0:
            return self.floor_masses
        
        # Distribute forces
        for fm in self.floor_masses:
            Wh2 = fm.seismic_weight * (fm.y_height ** 2)
            fm.lateral_force = Vb * Wh2 / sum_Wh2
        
        return self.floor_masses
    
    def generate_nodal_loads(self) -> List[Dict]:
        """
        Generate nodal load list for solver.
        
        Returns list of {node_id, fx, fy, fz} dicts.
        """
        loads = []
        direction = self.params.direction.upper()
        
        for fm in self.floor_masses:
            if len(fm.node_ids) == 0:
                continue
            
            # Distribute floor force equally to all nodes at that level
            force_per_node = fm.lateral_force / len(fm.node_ids)
            
            for nid in fm.node_ids:
                load = {"node_id": nid, "fx": 0, "fy": 0, "fz": 0}
                
                if direction == "X":
                    load["fx"] = force_per_node
                else:
                    load["fz"] = force_per_node
                
                loads.append(load)
        
        return loads
    
    def get_summary(self) -> Dict:
        """Get analysis summary"""
        return {
            "zone": self.params.zone.name,
            "zone_factor": self.params.zone.factor,
            "soil_type": self.params.soil_type.name,
            "building_type": self.params.building_type.name,
            "R_factor": self.params.building_type.R,
            "importance_factor": self.params.importance.factor,
            "fundamental_period": self.Ta,
            "Ah": self.Ah,
            "total_seismic_weight": self.total_seismic_weight,
            "base_shear": self.base_shear,
            "base_shear_ratio": self.base_shear / self.total_seismic_weight if self.total_seismic_weight > 0 else 0,
            "floor_forces": [
                {"level": fm.level, "height": fm.y_height, "Qi": fm.lateral_force}
                for fm in self.floor_masses
            ]
        }


# ============================================
# WIND LOAD GENERATOR
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


class WindLoadGenerator:
    """
    Wind Load Generator as per IS 875 (Part 3) : 2015 / ASCE 7-22
    """
    
    # Terrain multipliers k2 at different heights
    # Format: height (m) -> [Cat1, Cat2, Cat3, Cat4]
    K2_TABLE = {
        10: [1.05, 1.00, 0.91, 0.80],
        15: [1.09, 1.05, 0.97, 0.80],
        20: [1.12, 1.07, 1.01, 0.80],
        30: [1.15, 1.12, 1.06, 0.88],
        50: [1.20, 1.17, 1.12, 0.98],
        100: [1.26, 1.24, 1.20, 1.10],
        150: [1.30, 1.28, 1.24, 1.16],
        200: [1.32, 1.30, 1.27, 1.20],
    }
    
    def __init__(self, params: WindParameters):
        self.params = params
        self.floor_pressures: List[Dict] = []
    
    def get_k2(self, height: float) -> float:
        """
        Get terrain factor k2 at given height.
        Interpolates from IS 875 Table 2.
        """
        cat_idx = self.params.terrain_category.value - 1
        
        heights = sorted(self.K2_TABLE.keys())
        
        # Below minimum height
        if height <= heights[0]:
            return self.K2_TABLE[heights[0]][cat_idx]
        
        # Above maximum height
        if height >= heights[-1]:
            return self.K2_TABLE[heights[-1]][cat_idx]
        
        # Interpolate
        for i in range(len(heights) - 1):
            if heights[i] <= height <= heights[i + 1]:
                h1, h2 = heights[i], heights[i + 1]
                k1 = self.K2_TABLE[h1][cat_idx]
                k2 = self.K2_TABLE[h2][cat_idx]
                
                # Linear interpolation
                t = (height - h1) / (h2 - h1)
                return k1 + t * (k2 - k1)
        
        return 1.0
    
    def calculate_design_wind_speed(self, height: float) -> float:
        """
        Calculate design wind speed Vz at height z.
        
        Vz = Vb × k1 × k2 × k3 × k4
        
        Where:
        k1 = Risk coefficient (1.0 for 50-year return)
        k2 = Terrain/height factor
        k3 = Topography factor
        k4 = Importance factor
        """
        Vb = self.params.basic_wind_speed
        k1 = 1.0  # 50-year return period
        k2 = self.get_k2(height)
        k3 = self.params.topography_factor
        k4 = self.params.importance_factor
        
        Vz = Vb * k1 * k2 * k3 * k4
        return Vz
    
    def calculate_design_pressure(self, height: float) -> float:
        """
        Calculate design wind pressure Pz at height z.
        
        Pz = 0.6 × Vz²
        
        Returns pressure in N/m² (Pa)
        """
        Vz = self.calculate_design_wind_speed(height)
        Pz = 0.6 * Vz ** 2
        return Pz  # N/m²
    
    def calculate_wind_force(
        self,
        height: float,
        tributary_area: float,
        is_windward: bool = True
    ) -> float:
        """
        Calculate wind force on a surface.
        
        F = Pz × Cp × A
        
        Where:
        Pz = Design pressure at height z
        Cp = Pressure coefficient (+ windward, - leeward)
        A = Tributary area
        
        Returns force in kN
        """
        Pz = self.calculate_design_pressure(height)
        Cp = self.params.Cpe_windward if is_windward else self.params.Cpe_leeward
        
        F_N = Pz * abs(Cp) * tributary_area  # in N
        F_kN = F_N / 1000  # Convert to kN
        
        return F_kN
    
    def compute_floor_pressures(
        self,
        nodes: Dict[str, Dict],
        building_width: float,  # Width perpendicular to wind
        floor_heights: Optional[List[float]] = None
    ) -> List[Dict]:
        """
        Calculate wind pressure at each floor level.
        
        Groups nodes by Y-level and calculates tributary area.
        """
        # Group nodes by Y-level
        y_levels: Dict[float, List[str]] = {}
        tolerance = 0.1
        
        for nid, node in nodes.items():
            y = round(node['y'] / tolerance) * tolerance
            if y not in y_levels:
                y_levels[y] = []
            y_levels[y].append(nid)
        
        sorted_levels = sorted(y_levels.keys())
        n_levels = len(sorted_levels)
        
        self.floor_pressures = []
        
        for i, y in enumerate(sorted_levels):
            # Calculate tributary height
            if i == 0:
                # Ground level
                h_trib = (sorted_levels[1] - y) / 2 if n_levels > 1 else 3.0
            elif i == n_levels - 1:
                # Top level
                h_trib = (y - sorted_levels[i - 1]) / 2
            else:
                # Intermediate levels
                h_trib = ((y - sorted_levels[i - 1]) + (sorted_levels[i + 1] - y)) / 2
            
            tributary_area = h_trib * building_width
            
            Pz = self.calculate_design_pressure(y)
            Vz = self.calculate_design_wind_speed(y)
            k2 = self.get_k2(y)
            
            F_windward = self.calculate_wind_force(y, tributary_area, is_windward=True)
            F_leeward = self.calculate_wind_force(y, tributary_area, is_windward=False)
            
            self.floor_pressures.append({
                "level": i,
                "height": y,
                "k2": k2,
                "Vz": Vz,
                "Pz": Pz,
                "tributary_height": h_trib,
                "tributary_area": tributary_area,
                "F_windward": F_windward,
                "F_leeward": F_leeward,
                "F_total": F_windward + F_leeward,
                "node_ids": y_levels[y]
            })
        
        return self.floor_pressures
    
    def generate_nodal_loads(self, apply_to: str = "windward") -> List[Dict]:
        """
        Generate nodal load list for solver.
        
        apply_to: "windward", "leeward", or "both"
        """
        loads = []
        direction = self.params.direction.upper()
        
        for fp in self.floor_pressures:
            node_ids = fp["node_ids"]
            if len(node_ids) == 0:
                continue
            
            if apply_to == "windward":
                total_force = fp["F_windward"]
            elif apply_to == "leeward":
                total_force = fp["F_leeward"]
            else:
                total_force = fp["F_total"]
            
            force_per_node = total_force / len(node_ids)
            
            for nid in node_ids:
                load = {"node_id": nid, "fx": 0, "fy": 0, "fz": 0}
                
                if direction == "X":
                    load["fx"] = force_per_node
                else:
                    load["fz"] = force_per_node
                
                loads.append(load)
        
        return loads
    
    def get_summary(self) -> Dict:
        """Get analysis summary"""
        total_force = sum(fp["F_total"] for fp in self.floor_pressures)
        
        return {
            "basic_wind_speed": self.params.basic_wind_speed,
            "terrain_category": self.params.terrain_category.name,
            "topography_factor": self.params.topography_factor,
            "importance_factor": self.params.importance_factor,
            "total_wind_force": total_force,
            "floor_forces": [
                {
                    "level": fp["level"],
                    "height": fp["height"],
                    "k2": fp["k2"],
                    "Vz": fp["Vz"],
                    "Pz_Pa": fp["Pz"],
                    "F_total_kN": fp["F_total"]
                }
                for fp in self.floor_pressures
            ]
        }


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
