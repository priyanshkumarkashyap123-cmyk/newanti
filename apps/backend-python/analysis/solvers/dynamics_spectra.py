"""
IS 1893:2016 Response Spectrum Generation

Unit conventions:
    Stiffness matrix K: consistent units (kN/m, kN·m/rad)
    Periods: seconds
    Accelerations in Sa/g: g units
"""
import math
import numpy as np

from .dynamics_models import SpectrumCurve


def get_is1893_spectrum(
    zone: str,
    soil_type: str,
    importance_factor: float = 1.0,
    response_reduction: float = 5.0,
    damping: float = 0.05
) -> SpectrumCurve:
    """
    Generate IS 1893:2016 design response spectrum
    
    Args:
        zone: Seismic zone ('II', 'III', 'IV', 'V')
        soil_type: Soil type ('I', 'II', 'III')
        importance_factor: Importance factor I
        response_reduction: Response reduction factor R
        damping: Damping ratio (default 5%)
    
    Returns:
        SpectrumCurve: Response spectrum (Period vs Sa/g)
    """
    # Zone factors
    Z_factors = {'II': 0.10, 'III': 0.16, 'IV': 0.24, 'V': 0.36}
    Z = Z_factors.get(zone, 0.16)
    
    # Damping correction
    if damping != 0.05:
        beta = math.sqrt(10 / (5 + 100 * damping))
    else:
        beta = 1.0
    
    # Spectral acceleration coefficient
    # Sa/g = 1 + 15T for T < 0.1s (Type I)
    # Sa/g = 2.5 for 0.1 <= T <= Tc
    # Sa/g = 2.5 * (Tc/T) for T > Tc (descending)
    
    # Tc values based on soil type
    Tc_values = {'I': 0.4, 'II': 0.55, 'III': 0.67}
    Tc = Tc_values.get(soil_type, 0.55)
    Td = 4.0  # End of spectrum
    
    periods = []
    accelerations = []
    
    # Generate spectrum points
    T_values = [0.0, 0.05, 0.1] + list(np.linspace(0.1, Tc, 10)[1:]) + \
               list(np.linspace(Tc, Td, 30)[1:])
    
    for T in T_values:
        if T <= 0.1:
            Sa_g = 1.0 + 15 * T
        elif T <= Tc:
            Sa_g = 2.5
        else:
            Sa_g = 2.5 * (Tc / T)
        
        # Apply design factors
        Ah = (Z / 2) * (importance_factor / response_reduction) * Sa_g * beta
        
        periods.append(T)
        accelerations.append(Ah)
    
    return SpectrumCurve(periods=periods, accelerations=accelerations)


__all__ = [
    "get_is1893_spectrum",
]
