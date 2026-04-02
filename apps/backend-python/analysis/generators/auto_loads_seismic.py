"""
Seismic load generator for IS 1893:2016 Static Equivalent Lateral Force Method
"""

import math
from typing import Dict, List

from .auto_loads_types import (
    SeismicZone,
    SoilType,
    BuildingType,
    ImportanceCategory,
    SeismicParameters,
    FloorMass,
)


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


__all__ = [
    "SeismicLoadGenerator",
]
