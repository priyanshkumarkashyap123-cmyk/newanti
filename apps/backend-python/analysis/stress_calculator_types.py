"""
Data types for stress analysis.
"""

from dataclasses import dataclass


@dataclass
class StressPoint:
    """Stress state at a specific point"""
    x: float  # Location along member (m)
    y: float  # Distance from neutral axis (m)
    z: float  # Out-of-plane distance (m)
    
    # Normal stresses
    sigma_x: float  # Axial + bending stress (MPa)
    sigma_y: float  # Transverse normal stress (MPa)
    sigma_z: float  # Out-of-plane normal stress (MPa)
    
    # Shear stresses
    tau_xy: float  # In-plane shear (MPa)
    tau_yz: float  # Transverse shear (MPa)
    tau_zx: float  # Out-of-plane shear (MPa)
    
    # Derived stresses
    von_mises: float = 0.0  # Von Mises equivalent stress (MPa)
    principal_1: float = 0.0  # Maximum principal stress (MPa)
    principal_2: float = 0.0  # Intermediate principal stress (MPa)
    principal_3: float = 0.0  # Minimum principal stress (MPa)
    max_shear: float = 0.0  # Maximum shear stress (MPa)


__all__ = ["StressPoint"]
