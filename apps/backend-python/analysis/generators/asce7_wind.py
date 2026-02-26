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

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from enum import Enum
import numpy as np
import math


# ============================================
# ENUMERATIONS
# ============================================

class RiskCategory(Enum):
    """ASCE 7 Risk Categories (Table 1.5-1)"""
    I = 1    # Low hazard
    II = 2   # Standard
    III = 3  # Substantial hazard
    IV = 4   # Essential facilities


class ExposureCategory(Enum):
    """ASCE 7 Exposure Categories (Section 26.7)"""
    B = "B"  # Urban and suburban
    C = "C"  # Open terrain (default)
    D = "D"  # Flat, unobstructed coastal


class BuildingEnclosure(Enum):
    """Building enclosure classification"""
    ENCLOSED = "enclosed"
    PARTIALLY_ENCLOSED = "partially_enclosed"
    OPEN = "open"


class RoofType(Enum):
    """Roof types for pressure coefficients"""
    FLAT = "flat"           # θ <= 10°
    GABLE = "gable"         # Two slopes meeting at ridge
    HIP = "hip"             # Four slopes
    MONOSLOPE = "monoslope"  # Single slope


# ============================================
# DATA STRUCTURES
# ============================================

@dataclass
class ASCE7WindParams:
    """Input parameters for ASCE 7 wind analysis"""
    # Basic wind speed (mph) - from ASCE 7 maps
    V: float = 115.0
    
    # Risk and exposure
    risk_category: RiskCategory = RiskCategory.II
    exposure: ExposureCategory = ExposureCategory.C
    enclosure: BuildingEnclosure = BuildingEnclosure.ENCLOSED
    
    # Building geometry (meters)
    height: float = 30.0
    width: float = 20.0      # Perpendicular to wind
    length: float = 30.0     # Parallel to wind
    
    # Roof
    roof_type: RoofType = RoofType.FLAT
    roof_angle: float = 0.0  # degrees
    
    # Topography
    is_on_hill: bool = False
    hill_height: float = 0.0      # H
    hill_half_length: float = 0.0  # Lh
    distance_from_crest: float = 0.0  # x
    
    # Elevation
    ground_elevation: float = 0.0  # meters above sea level
    
    # Internal pressure
    GCpi: Optional[float] = None  # Override internal pressure coefficient
    
    # Direction
    direction: str = "X"


@dataclass
class WindPressure:
    """Wind pressure at a specific height"""
    height: float       # meters
    qz: float          # Velocity pressure (kN/m²)
    Kz: float          # Exposure coefficient
    Kzt: float         # Topographic factor
    p_windward: float  # Windward pressure (kN/m²)
    p_leeward: float   # Leeward pressure (kN/m²)
    p_net: float       # Net pressure (kN/m²)


@dataclass
class WindForce:
    """Wind force on a member or surface"""
    member_id: str
    height: float
    area: float        # m²
    force: float       # kN
    direction: str     # "X", "Y", or "Z"


@dataclass
class ASCE7WindResult:
    """Complete ASCE 7 wind analysis result"""
    success: bool = True
    
    # Basic parameters
    V: float = 115.0          # Basic wind speed (mph)
    Kd: float = 0.85          # Directionality factor
    Ke: float = 1.0           # Ground elevation factor
    
    # Height-based values
    Kz: float = 0.0           # At mean roof height
    Kzt: float = 1.0          # Topographic factor
    qh: float = 0.0           # Velocity pressure at roof height (kN/m²)
    
    # Pressure coefficients
    GCpi: float = 0.18        # Internal pressure coefficient
    Cp_windward: float = 0.8  # Windward wall
    Cp_leeward: float = -0.5  # Leeward wall (suction)
    Cp_side: float = -0.7     # Side walls (suction)
    Cp_roof: float = -0.9     # Roof (suction/pressure varies)
    
    # Forces
    total_base_shear: float = 0.0
    total_overturning_moment: float = 0.0
    
    # Detailed results
    pressures: List[WindPressure] = field(default_factory=list)
    member_forces: List[WindForce] = field(default_factory=list)
    nodal_loads: List[Dict] = field(default_factory=list)
    
    # Error
    error_message: Optional[str] = None


# ============================================
# ASCE 7 WIND LOAD GENERATOR
# ============================================

class ASCE7WindGenerator:
    """
    ASCE 7-22 Directional Procedure for Wind Loads
    
    Implements Chapter 27 MWFRS requirements.
    """
    
    def __init__(self, params: ASCE7WindParams):
        self.params = params
        self.result = ASCE7WindResult()
        self.result.V = params.V
    
    # ----------------------------------------
    # Wind Directionality Factor (Table 26.6-1)
    # ----------------------------------------
    
    def get_Kd(self) -> float:
        """
        Wind directionality factor Kd
        For buildings: Kd = 0.85
        """
        self.result.Kd = 0.85
        return 0.85
    
    # ----------------------------------------
    # Ground Elevation Factor (Table 26.9-1)
    # ----------------------------------------
    
    def get_Ke(self) -> float:
        """
        Ground elevation factor Ke
        
        Ke = e^(-0.0000362 × zg)
        where zg = ground elevation in feet
        """
        zg_ft = self.params.ground_elevation * 3.281  # Convert m to ft
        Ke = math.exp(-0.0000362 * zg_ft)
        self.result.Ke = Ke
        return Ke
    
    # ----------------------------------------
    # Exposure Coefficient (Table 26.10-1)
    # ----------------------------------------
    
    def get_Kz(self, z: float) -> float:
        """
        Velocity pressure exposure coefficient Kz
        
        Eq. 26.10-1:
        For z >= zg: Kz = 2.01 × (z/zg)^(2/α)
        For z < 15 ft (4.57m): Kz = 2.01 × (15/zg)^(2/α)
        
        α and zg from Table 26.11-1
        """
        z_ft = z * 3.281  # Convert to feet
        
        # Table 26.11-1: Terrain exposure constants
        exposure = self.params.exposure
        
        if exposure == ExposureCategory.B:
            alpha = 7.0
            zg = 1200  # feet
        elif exposure == ExposureCategory.C:
            alpha = 9.5
            zg = 900
        else:  # D
            alpha = 11.5
            zg = 700
        
        # Minimum height is 15 ft
        z_calc = max(z_ft, 15)
        
        Kz = 2.01 * (z_calc / zg) ** (2 / alpha)
        return Kz
    
    # ----------------------------------------
    # Topographic Factor (Section 26.8)
    # ----------------------------------------
    
    def get_Kzt(self, z: float) -> float:
        """
        Topographic factor Kzt
        
        Eq. 26.8-1: Kzt = (1 + K1 × K2 × K3)²
        
        For flat terrain: Kzt = 1.0
        """
        if not self.params.is_on_hill:
            return 1.0
        
        H = self.params.hill_height
        Lh = self.params.hill_half_length
        x = self.params.distance_from_crest
        
        if H == 0 or Lh == 0:
            return 1.0
        
        # K1 from Figure 26.8-1 (simplified)
        H_Lh = H / Lh
        if H_Lh <= 0.2:
            K1 = 0.29
        elif H_Lh <= 0.25:
            K1 = 0.36
        elif H_Lh <= 0.3:
            K1 = 0.43
        elif H_Lh <= 0.35:
            K1 = 0.51
        elif H_Lh <= 0.4:
            K1 = 0.58
        elif H_Lh <= 0.45:
            K1 = 0.65
        else:
            K1 = 0.72
        
        # K2: Height attenuation
        mu = 3.0  # For 2D ridges
        K2 = (1 - abs(x) / (mu * Lh))
        K2 = max(K2, 0)
        
        # K3: Height attenuation
        gamma = 3.0
        z_Lh = z / Lh
        K3 = math.exp(-gamma * z_Lh)
        
        Kzt = (1 + K1 * K2 * K3) ** 2
        self.result.Kzt = Kzt
        return Kzt
    
    # ----------------------------------------
    # Velocity Pressure (Eq. 27.3-1)
    # ----------------------------------------
    
    def calculate_qz(self, z: float) -> float:
        """
        Calculate velocity pressure qz at height z
        
        Eq. 27.3-1: qz = 0.00256 × Kz × Kzt × Kd × Ke × V² (psf)
        
        Returns in kN/m² (multiply psf by 0.04788)
        """
        Kz = self.get_Kz(z)
        Kzt = self.get_Kzt(z)
        Kd = self.result.Kd
        Ke = self.result.Ke
        V = self.params.V
        
        # In psf
        qz_psf = 0.00256 * Kz * Kzt * Kd * Ke * (V ** 2)
        
        # Convert to kN/m²
        qz_kpa = qz_psf * 0.04788
        
        return qz_kpa
    
    # ----------------------------------------
    # Internal Pressure Coefficient
    # ----------------------------------------
    
    def get_GCpi(self) -> float:
        """
        Internal pressure coefficient GCpi (Table 26.13-1)
        """
        if self.params.GCpi is not None:
            return self.params.GCpi
        
        if self.params.enclosure == BuildingEnclosure.ENCLOSED:
            return 0.18  # ±0.18
        elif self.params.enclosure == BuildingEnclosure.PARTIALLY_ENCLOSED:
            return 0.55  # ±0.55
        else:  # OPEN
            return 0.0
    
    # ----------------------------------------
    # External Pressure Coefficients
    # ----------------------------------------
    
    def get_wall_Cp(self) -> Dict[str, float]:
        """
        External pressure coefficients for walls (Figure 27.3-1)
        """
        L = self.params.length  # Parallel to wind
        B = self.params.width   # Perpendicular to wind
        
        L_B = L / B if B > 0 else 1.0
        
        # Windward wall: Cp = 0.8
        Cp_windward = 0.8
        
        # Leeward wall: depends on L/B
        if L_B <= 1.0:
            Cp_leeward = -0.5
        elif L_B >= 4.0:
            Cp_leeward = -0.2
        else:
            # Interpolate
            Cp_leeward = -0.5 + (0.3 / 3.0) * (L_B - 1.0)
        
        # Side walls: Cp = -0.7
        Cp_side = -0.7
        
        self.result.Cp_windward = Cp_windward
        self.result.Cp_leeward = Cp_leeward
        self.result.Cp_side = Cp_side
        
        return {
            "windward": Cp_windward,
            "leeward": Cp_leeward,
            "side": Cp_side
        }
    
    def get_roof_Cp(self) -> Dict[str, float]:
        """
        External pressure coefficients for roof (Figure 27.3-1)
        """
        theta = self.params.roof_angle
        h = self.params.height
        L = self.params.length
        
        h_L = h / L if L > 0 else 0.5
        
        if self.params.roof_type == RoofType.FLAT or theta <= 10:
            # Flat roof: varies with h/L
            if h_L <= 0.25:
                Cp = -0.9
            elif h_L <= 0.5:
                Cp = -0.9
            elif h_L >= 1.0:
                Cp = -1.3
            else:
                Cp = -0.9 - 0.4 * (h_L - 0.5) / 0.5
        else:
            # Sloped roof: varies with angle and wind direction
            if theta <= 20:
                Cp = -0.7
            elif theta <= 27:
                Cp = -0.3
            elif theta <= 45:
                Cp = 0.2
            else:
                Cp = 0.4
        
        self.result.Cp_roof = Cp
        return {"roof": Cp}
    
    # ----------------------------------------
    # Calculate Pressures
    # ----------------------------------------
    
    def calculate_pressures(self) -> List[WindPressure]:
        """
        Calculate wind pressures at various heights.
        """
        h = self.params.height
        GCpi = self.get_GCpi()
        self.result.GCpi = GCpi
        Cp = self.get_wall_Cp()
        
        # Calculate at multiple heights
        num_levels = max(int(h / 3.0), 5)  # Every 3m or minimum 5 levels
        heights = np.linspace(0, h, num_levels + 1)[1:]  # Exclude ground
        
        pressures = []
        
        for z in heights:
            qz = self.calculate_qz(z)
            Kz = self.get_Kz(z)
            Kzt = self.get_Kzt(z)
            
            # Windward pressure: p = qz × G × Cp - qh × (±GCpi)
            # Using G = 0.85 for rigid buildings
            G = 0.85
            
            # At roof height for leeward
            qh = self.calculate_qz(h)
            self.result.qh = qh
            
            p_windward = qz * G * Cp["windward"] - qh * (-GCpi)
            p_leeward = qh * G * Cp["leeward"] - qh * (+GCpi)
            p_net = p_windward - p_leeward  # Total horizontal pressure
            
            pressure = WindPressure(
                height=z,
                qz=qz,
                Kz=Kz,
                Kzt=Kzt,
                p_windward=p_windward,
                p_leeward=p_leeward,
                p_net=p_net
            )
            pressures.append(pressure)
        
        self.result.pressures = pressures
        self.result.Kz = self.get_Kz(h)  # At roof height
        
        return pressures
    
    # ----------------------------------------
    # Calculate Story Forces
    # ----------------------------------------
    
    def calculate_forces(
        self,
        story_heights: List[float]
    ) -> List[WindForce]:
        """
        Calculate wind forces at each story level.
        
        Args:
            story_heights: Heights of each story (m)
        """
        pressures = self.result.pressures
        if not pressures:
            self.calculate_pressures()
            pressures = self.result.pressures
        
        forces = []
        B = self.params.width  # Tributary width
        
        for i, z in enumerate(story_heights):
            # Get pressure at this height
            p_net = 0
            for pressure in pressures:
                if abs(pressure.height - z) < self.params.height / len(pressures):
                    p_net = pressure.p_net
                    break
            
            # Tributary height (story height)
            if i == 0:
                trib_height = story_heights[0]
            else:
                trib_height = story_heights[i] - story_heights[i-1]
            
            # Area
            area = B * trib_height
            
            # Force
            force = p_net * area
            
            forces.append(WindForce(
                member_id=f"story_{i+1}",
                height=z,
                area=area,
                force=force,
                direction=self.params.direction
            ))
        
        self.result.member_forces = forces
        
        # Calculate totals
        self.result.total_base_shear = sum(f.force for f in forces)
        self.result.total_overturning_moment = sum(
            f.force * f.height for f in forces
        )
        
        return forces
    
    # ----------------------------------------
    # Generate Nodal Loads
    # ----------------------------------------
    
    def generate_nodal_loads(
        self,
        nodes: Dict[str, Dict],
    ) -> List[Dict]:
        """
        Generate nodal loads for structural analysis.
        
        Args:
            nodes: Node dictionary with coordinates
        """
        pressures = self.result.pressures
        if not pressures:
            self.calculate_pressures()
            pressures = self.result.pressures
        
        nodal_loads = []
        direction = self.params.direction.upper()
        B = self.params.width
        
        # Group nodes by height
        height_tolerance = 0.5
        levels: Dict[float, List[str]] = {}
        
        for node_id, node in nodes.items():
            y = node.get('y', node.get('z', 0))
            matched = False
            for level_y in levels:
                if abs(y - level_y) < height_tolerance:
                    levels[level_y].append(node_id)
                    matched = True
                    break
            if not matched:
                levels[y] = [node_id]
        
        sorted_heights = sorted(levels.keys())
        
        for i, z in enumerate(sorted_heights):
            if z == 0:
                continue  # Skip ground level
            
            # Get pressure at this height
            p_net = 0
            for pressure in pressures:
                if pressure.height >= z:
                    p_net = pressure.p_net
                    break
            
            # Tributary height
            if i == 0:
                trib_height = z
            else:
                trib_height = z - sorted_heights[i-1]
            
            # Total force at this level
            area = B * trib_height
            total_force = p_net * area
            
            # Distribute to nodes
            node_ids = levels[z]
            force_per_node = total_force / len(node_ids) if node_ids else 0
            
            for node_id in node_ids:
                load = {
                    "node_id": node_id,
                    "fx": force_per_node if direction == "X" else 0,
                    "fy": 0,
                    "fz": force_per_node if direction == "Z" else 0,
                    "source": "ASCE7_WIND",
                    "load_case": f"W{direction}"
                }
                nodal_loads.append(load)
        
        self.result.nodal_loads = nodal_loads
        return nodal_loads
    
    # ----------------------------------------
    # Main Analysis
    # ----------------------------------------
    
    def analyze(
        self,
        nodes: Optional[Dict[str, Dict]] = None,
        story_heights: Optional[List[float]] = None
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
    direction: str = "X"
) -> ASCE7WindGenerator:
    """
    Factory function to create ASCE 7 wind generator.
    """
    params = ASCE7WindParams(
        V=V,
        exposure=ExposureCategory(exposure),
        height=height,
        width=width,
        length=length,
        direction=direction
    )
    return ASCE7WindGenerator(params)
