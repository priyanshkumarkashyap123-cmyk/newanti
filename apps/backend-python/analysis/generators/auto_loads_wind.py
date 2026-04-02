"""
Wind load generator for IS 875:2015 Part 3 and ASCE 7-22
"""

from typing import Dict, List, Optional

from .auto_loads_types import (
    TerrainCategory,
    WindParameters,
)


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


__all__ = [
    "WindLoadGenerator",
]
