"""
elements.py - Finite Element Formulations

Defines core element types and beam theories.
"""

from enum import Enum, auto
from dataclasses import dataclass
from typing import Optional, Tuple
import numpy as np

class ElementType(Enum):
    BEAM = auto()
    TRUSS = auto()
    PLATE = auto()
    SHELL = auto()
    SOLID = auto()

class BeamTheory(Enum):
    EULER_BERNOULLI = auto()
    TIMOSHENKO = auto()

@dataclass
class TimoshenkoBeam:
    """
    Timoshenko beam element formulation.
    Accounts for shear deformation via shear areas Asy, Asz.
    """
    length: float
    E: float  # Young's Modulus
    G: float  # Shear Modulus
    A: float  # Area
    Iy: float # Moment of Inertia (local y)
    Iz: float # Moment of Inertia (local z)
    J: float  # Torsional Constant
    Asy: Optional[float] = None
    Asz: Optional[float] = None
    
    def get_stiffness_matrix(self) -> np.ndarray:
        """
        Compute 12x12 elastic stiffness matrix including shear deformation effects.
        """
        L = self.length
        E = self.E
        G = self.G
        A = self.A
        Iy = self.Iy
        Iz = self.Iz
        J = self.J
        
        # Calculate shear deformation parameters (phi)
        # φ = 12EI / (G*As*L²)
        
        # For bending about Z (shear in Y)
        phi_z = 0.0
        if self.Asy and self.Asy > 0:
            phi_z = 12 * E * Iz / (G * self.Asy * L**2)
            
        # For bending about Y (shear in Z)
        phi_y = 0.0
        if self.Asz and self.Asz > 0:
            phi_y = 12 * E * Iy / (G * self.Asz * L**2)
            
        # Stiffness coefficients
        k1 = E * A / L
        k10 = G * J / L
        
        # Bending about Z (shear in Y)
        dz = 1 + phi_z
        k2_z = 12 * E * Iz / (L**3 * dz)
        k3_z = 6 * E * Iz / (L**2 * dz)
        k4_z = (4 + phi_z) * E * Iz / (L * dz)
        k5_z = (2 - phi_z) * E * Iz / (L * dz)
        
        # Bending about Y (shear in Z)
        dy = 1 + phi_y
        k2_y = 12 * E * Iy / (L**3 * dy)
        k3_y = 6 * E * Iy / (L**2 * dy)
        k4_y = (4 + phi_y) * E * Iy / (L * dy)
        k5_y = (2 - phi_y) * E * Iy / (L * dy)
        
        Ke = np.zeros((12, 12))
        
        # Axial
        Ke[0, 0] = k1;  Ke[0, 6] = -k1
        Ke[6, 0] = -k1; Ke[6, 6] = k1
        
        # Torsion
        Ke[3, 3] = k10; Ke[3, 9] = -k10
        Ke[9, 3] = -k10; Ke[9, 9] = k10
        
        # Bending Z (v, theta_z?) - Actually w, theta_y usually?
        # Standard DOF: u, v, w, tx, ty, tz
        # Index: 0, 1, 2, 3, 4, 5
        
        # Bending about Z-axis corresponds to displacement in Y (v) and rotation theta_z (rz)
        # Wait, usually for frame:
        # Local y is minor axis?
        # Let's stick to standard internal mapping:
        # v is disp in y.
        # rz is rot about z.
        
        # Indices for v, rz: 1, 5
        Ke[1, 1] = k2_z;  Ke[1, 5] = k3_z;   Ke[1, 7] = -k2_z;  Ke[1, 11] = k3_z
        Ke[5, 1] = k3_z;  Ke[5, 5] = k4_z;   Ke[5, 7] = -k3_z;  Ke[5, 11] = k5_z
        Ke[7, 1] = -k2_z; Ke[7, 5] = -k3_z;  Ke[7, 7] = k2_z;   Ke[7, 11] = -k3_z
        Ke[11, 1] = k3_z; Ke[11, 5] = k5_z;  Ke[11, 7] = -k3_z; Ke[11, 11] = k4_z
        
        # Bending about Y-axis corresponds to displacement in Z (w) and rotation theta_y (ry)
        # Indices for w, ry: 2, 4
        # Note signs for ry often flip depending on convention.
        # Standard:
        Ke[2, 2] = k2_y;  Ke[2, 4] = -k3_y;  Ke[2, 8] = -k2_y;  Ke[2, 10] = -k3_y
        Ke[4, 2] = -k3_y; Ke[4, 4] = k4_y;   Ke[4, 8] = k3_y;   Ke[4, 10] = k5_y
        Ke[8, 2] = -k2_y; Ke[8, 4] = k3_y;   Ke[8, 8] = k2_y;   Ke[8, 10] = k3_y
        Ke[10, 2] = -k3_y; Ke[10, 4] = k5_y; Ke[10, 8] = k3_y;  Ke[10, 10] = k4_y
        
        return Ke
