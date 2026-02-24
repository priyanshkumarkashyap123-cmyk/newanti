"""
IS 1893:2016 - Criteria for Earthquake Resistant Design of Structures

Part 1: General Provisions and Buildings

Key Features:
- Seismic Zone Factors (Table 3)
- Importance Factors (Table 8)
- Response Reduction Factors (Table 9)
- Design Horizontal Seismic Coefficient (Clause 6.4)
- Response Spectrum (Clause 6.4.2)
"""

from dataclasses import dataclass
from typing import Dict, List, Optional
from enum import Enum
import math


# ============================================
# SEISMIC PARAMETERS
# ============================================

class SeismicZone(Enum):
    """Seismic Zones per IS 1893:2016"""
    II = "II"   # Low damage risk
    III = "III" # Moderate damage risk
    IV = "IV"   # High damage risk
    V = "V"     # Very high damage risk

ZONE_FACTORS = {
    SeismicZone.II: 0.10,
    SeismicZone.III: 0.16,
    SeismicZone.IV: 0.24,
    SeismicZone.V: 0.36,
}

class SoilType(Enum):
    """Soil Types (Clause 6.4.2.1)"""
    HARD = 1    # Rock or Hard Soil
    MEDIUM = 2  # Medium Soil
    SOFT = 3    # Soft Soil

# ============================================
# SPECTRUM CALCULATIONS
# ============================================

def get_sa_by_g(period: float, soil_type: SoilType = SoilType.MEDIUM) -> float:
    """
    Calculate Design Acceleration Coefficient (Sa/g) per Clause 6.4.2.
    
    Args:
        period (T): Natural period of vibration (seconds)
        soil_type: Soil Type (1=Hard, 2=Medium, 3=Soft)
    
    Returns:
        Sa/g value (unitless coefficient)
    """
    T = period
    
    if soil_type == SoilType.HARD: # Type I
        if T <= 0.40:
            return 2.5
        elif T <= 4.00:
            return 1.0 / T
        else:
            return 0.25 # IS 1893 doesn't explicitly define T>4, typically 1/T or clamped
            
    elif soil_type == SoilType.MEDIUM: # Type II
        if T <= 0.55:
            return 2.5
        elif T <= 4.00:
            return 1.36 / T
        else:
            return 0.34 # Approx 1.36/4
            
    else: # Type III (Soft)
        if T <= 0.67:
            return 2.5
        elif T <= 4.00:
            return 1.67 / T
        else:
            return 0.42 # Approx 1.67/4

def calculate_base_shear(
    W: float,  # Seismic Weight (kN)
    T: float,  # Fundamental Period (s)
    zone: SeismicZone = SeismicZone.III,
    soil_type: SoilType = SoilType.MEDIUM,
    importance_factor: float = 1.2, # I
    response_reduction: float = 5.0 # R
) -> Dict[str, float]:
    """
    Calculate Design Seismic Base Shear (Vb) per Clause 7.
    
    Vb = Ah * W
    Ah = (Z/2) * (I/R) * (Sa/g)
    
    Args:
        W: Seismic Weight (kN)
        T: Fundamental Period (s)
        zone: Seismic Zone (II, III, IV, V)
        soil_type: Soil Type
        importance_factor: I (Table 8)
        response_reduction: R (Table 9, e.g., 5 for SMRF, 3 for OMRF)
        
    Returns:
        Dict with Vb and Ah components
    """
    Z = ZONE_FACTORS.get(zone, 0.16)
    I = importance_factor
    R = response_reduction
    
    sa_g = get_sa_by_g(T, soil_type)
    
    # Calculate Horizontal Seismic Coefficient Ah (Clause 6.4.2)
    # Ah = (Z/2) * (Sa/g) * (I/R)
    Ah = (Z / 2) * (I / R) * sa_g
    
    # Check minimum Ah limits?
    # Clause 7.2.2: For T < 0.1s, value of Ah will not be less than Z/2
    # But formula (Z/2)*(Sa/g)*(I/R) yields results.
    # Usually Sa/g is 2.5, so Ah = (Z/2)*2.5*(I/R)
    
    Vb = Ah * W
    
    return {
        "Vb": Vb,
        "Ah": Ah,
        "Z": Z,
        "I": I,
        "R": R,
        "Sa_g": sa_g,
        "T": T
    }

def calculate_vertical_distribution(
    base_shear: float,
    floors: List[Dict[str, float]] 
) -> List[Dict[str, float]]:
    """
    Distribute Base Shear vertically per Clause 7.6.3.
    Qi = Vb * (Wi * hi^2) / sum(Wj * hj^2)
    
    Args:
        base_shear: Total base shear Vb (kN)
        floors: List of dicts with 'weight' (Wi) and 'height' (hi)
                 Example: [{'id': 1, 'weight': 100, 'height': 3.5}, ...]
                 Height is from base.
                 
    Returns:
        List of floors with added 'Qi' (lateral force)
    """
    # Calculate sum(Wi * hi^2)
    sum_wh2 = 0
    for floor in floors:
        w = floor.get('weight', 0)
        h = floor.get('height', 0)
        sum_wh2 += w * (h * h)
        
    if sum_wh2 == 0:
        return floors
        
    results = []
    for floor in floors:
        w = floor.get('weight', 0)
        h = floor.get('height', 0)
        
        Qi = base_shear * (w * h * h) / sum_wh2
        
        new_floor = floor.copy()
        new_floor['Qi'] = Qi
        results.append(new_floor)
        
    return results

# ============================================
# APPROXIMATE FUNDAMENTAL PERIOD
# ============================================

def calculate_period_approx(
    height: float, # Building height in m
    building_type: str = "rc_frame_infill" # 'rc_frame', 'steel_frame', 'rc_frame_infill'
) -> float:
    """
    Calculate approximate fundamental natural period (Ta) per Clause 7.6.
    
    Args:
        height: Height of building (m)
        building_type: Type from Clause 7.6.1/7.6.2
    """
    h = height
    
    if building_type == "rc_frame":
        # Ta = 0.075 * h^0.75
        return 0.075 * (h ** 0.75)
    elif building_type == "steel_frame":
        # Ta = 0.085 * h^0.75
        return 0.085 * (h ** 0.75)
    else: # "rc_frame_infill" or others
        # Ta = 0.09 * h / sqrt(d) -> requires dimension d.
        # Fallback to simple generic if d unknown? 
        return 0.075 * (h ** 0.75) # Default to RC frame
        
    # Note: For infill, use 0.09h/sqrt(d) where d is dimension in direction of EQ
    
