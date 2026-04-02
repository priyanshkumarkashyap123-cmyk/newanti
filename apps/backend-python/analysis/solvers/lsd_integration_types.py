"""
lsd_integration_types.py - Type definitions and data structures for RC beam LSD design

Defines the primary input data structure for the LSD design workflow.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class DesignInput:
    """Complete input for RC beam LSD design"""
    
    # Structural analysis results
    Mu: float           # Ultimate moment (kN·m)
    Vu: float           # Ultimate shear (kN)
    
    # Section geometry
    beam_width: float   # mm
    beam_depth: float   # mm
    
    # Material properties
    concrete_grade: str  # 'M20', 'M25', 'M30', 'M35', 'M40'
    steel_grade: str     # 'Fe415', 'Fe500', 'Fe500S'
    
    # Optional overrides with defaults
    cover_tension: float = 50  # mm (to centroid of main steel)
    cover_compression: float = 50  # mm
    
    @property
    def effective_depth(self) -> float:
        """Calculate effective depth (d = D - cover - dia/2)"""
        # Assuming average main rebar diameter ~16mm
        d = self.beam_depth - self.cover_tension - 8  # 8 = dia/2 approx
        return d
    
    @property
    def compression_steel_depth(self) -> float:
        """Calculate compression steel depth (d' = cover + dia/2)"""
        return self.cover_compression + 10  # Assuming ~10mm stirrup


__all__ = [
    "DesignInput",
]
