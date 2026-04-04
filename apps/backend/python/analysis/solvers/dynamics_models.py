"""
Response Spectrum Analysis data models

Data structures for modal and response spectrum analysis results.
"""
from dataclasses import dataclass, field
from typing import List, Optional, Dict
import numpy as np


@dataclass
class SpectrumCurve:
    """Response Spectrum Curve (Period vs Sa/g)"""
    periods: List[float]      # Time periods (s)
    accelerations: List[float] # Sa/g values
    
    def get_acceleration(self, T: float) -> float:
        """Interpolate acceleration for given period"""
        if T <= self.periods[0]:
            return self.accelerations[0]
        if T >= self.periods[-1]:
            return self.accelerations[-1]
        
        # Linear interpolation
        for i in range(len(self.periods) - 1):
            if self.periods[i] <= T <= self.periods[i + 1]:
                t = (T - self.periods[i]) / (self.periods[i + 1] - self.periods[i])
                return self.accelerations[i] + t * (self.accelerations[i + 1] - self.accelerations[i])
        
        return self.accelerations[-1]


@dataclass
class ModeShape:
    """Single mode shape result"""
    mode_number: int
    frequency: float          # Natural frequency (Hz)
    period: float            # Period (s)
    omega: float             # Angular frequency (rad/s)
    shape: np.ndarray        # Mode shape vector (normalized)
    participation_factor_x: float = 0  # Modal participation X
    participation_factor_y: float = 0  # Modal participation Y
    participation_factor_z: float = 0  # Modal participation Z
    effective_mass_x: float = 0  # Effective modal mass X
    effective_mass_y: float = 0  # Effective modal mass Y
    effective_mass_z: float = 0  # Effective modal mass Z


@dataclass
class ModalResult:
    """Complete modal analysis result"""
    success: bool
    modes: List[ModeShape]
    total_mass: float
    cumulative_mass_x: List[float]  # Cumulative mass participation X
    cumulative_mass_y: List[float]  # Cumulative mass participation Y
    cumulative_mass_z: List[float]  # Cumulative mass participation Z
    error_message: Optional[str] = None


@dataclass
class ResponseSpectrumResult:
    """Response Spectrum Analysis result"""
    success: bool
    # Nodal results (combined from all modes)
    displacements: Dict[str, Dict[str, float]]
    velocities: Dict[str, Dict[str, float]]
    accelerations: Dict[str, Dict[str, float]]
    # Member forces (combined)
    member_forces: Dict[str, Dict[str, float]]
    # Base shear
    base_shear_x: float
    base_shear_y: float
    base_shear_z: float
    # Modal contributions
    modal_contributions: List[Dict[str, float]]
    combination_method: str  # 'CQC' or 'SRSS'
    error_message: Optional[str] = None


__all__ = [
    "SpectrumCurve",
    "ModeShape",
    "ModalResult",
    "ResponseSpectrumResult",
]
