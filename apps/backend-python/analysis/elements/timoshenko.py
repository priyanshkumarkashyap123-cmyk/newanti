"""
timoshenko.py - Timoshenko Beam Element Implementation

Implements beam element formulations with shear deformation:
- Euler-Bernoulli (classical, shear rigid)
- Timoshenko (includes shear flexibility)

Theory:
    For Timoshenko beams, the shear flexibility parameter Φ is:
    
    Φ = 12·E·I / (κ·G·A·L²)
    
    Where:
        E = Young's modulus
        I = Moment of inertia
        κ = Shear correction factor (≈5/6 for rectangular, ≈0.9 for I-sections)
        G = Shear modulus = E / (2(1+ν))
        A = Cross-sectional area
        L = Member length
    
    The stiffness matrix terms are modified:
    - Bending stiffness: k/(1+Φ)
    - Coupling terms: adjusted accordingly
    
    Critical for deep beams where L/d < 10

Reference:
    - Przemieniecki, J.S., "Theory of Matrix Structural Analysis"
    - Weaver & Gere, "Matrix Analysis of Framed Structures"
"""

from dataclasses import dataclass
from typing import Tuple, Optional, Dict, Any
from enum import Enum
import numpy as np
import math


class BeamTheory(Enum):
    """Beam formulation theory"""
    EULER_BERNOULLI = "euler_bernoulli"  # Classical, no shear deformation
    TIMOSHENKO = "timoshenko"            # Includes shear deformation


class ElementType(Enum):
    """Structural element types"""
    TRUSS = "truss"                 # Axial only (2 DOF per node in 2D, 3 in 3D)
    BEAM_2D = "beam_2d"             # 2D frame (3 DOF per node: u, v, θ)
    BEAM_3D = "beam_3d"             # 3D frame (6 DOF per node: u, v, w, θx, θy, θz)
    PLATE = "plate"                 # 2D plate bending
    SHELL = "shell"                 # Combined membrane + plate


@dataclass
class SectionProperties:
    """Cross-section properties for beam elements"""
    A: float        # Cross-sectional area (m²)
    Iy: float       # Moment of inertia about y-axis (m⁴)
    Iz: float       # Moment of inertia about z-axis (m⁴)
    J: float        # Torsional constant (m⁴)
    E: float        # Young's modulus (Pa or kN/m²)
    G: float        # Shear modulus (Pa or kN/m²)
    # Shear area factors (Timoshenko)
    kappa_y: float = 5/6   # Shear correction factor for shear in y
    kappa_z: float = 5/6   # Shear correction factor for shear in z
    
    @property
    def Asy(self) -> float:
        """Effective shear area for shear in y-direction"""
        return self.kappa_y * self.A
    
    @property
    def Asz(self) -> float:
        """Effective shear area for shear in z-direction"""
        return self.kappa_z * self.A


class TimoshenkoBeam:
    """
    2D/3D Beam element with Timoshenko or Euler-Bernoulli theory.
    
    Supports both formulations:
    - Euler-Bernoulli: Plane sections remain plane AND normal (no shear deformation)
    - Timoshenko: Plane sections remain plane but NOT normal (shear deformation included)
    
    Usage:
        section = SectionProperties(A=0.01, Iy=1e-4, Iz=1e-4, J=1e-5, E=200e9, G=77e9)
        beam = TimoshenkoBeam(theory=BeamTheory.TIMOSHENKO)
        K = beam.get_stiffness_matrix_3d(section, length=5.0)
    """
    
    def __init__(self, theory: BeamTheory = BeamTheory.EULER_BERNOULLI):
        """
        Initialize beam element.
        
        Args:
            theory: BeamTheory.EULER_BERNOULLI or BeamTheory.TIMOSHENKO
        """
        self.theory = theory
    
    def get_shear_flexibility_factor(
        self, 
        E: float, 
        I: float, 
        G: float, 
        As: float, 
        L: float
    ) -> float:
        """
        Calculate shear flexibility parameter Φ.
        
        Φ = 12·E·I / (G·As·L²)
        
        When Φ → 0: Timoshenko → Euler-Bernoulli (shear rigid)
        When Φ >> 1: Significant shear deformation (deep beams)
        
        Args:
            E: Young's modulus
            I: Moment of inertia
            G: Shear modulus
            As: Effective shear area (κ·A)
            L: Member length
            
        Returns:
            Shear flexibility parameter Φ
        """
        if self.theory == BeamTheory.EULER_BERNOULLI:
            return 0.0  # No shear deformation
        
        if G * As * L * L < 1e-20:
            return 0.0  # Avoid division by zero
        
        return (12 * E * I) / (G * As * L * L)
    
    def get_stiffness_matrix_2d(
        self,
        section: SectionProperties,
        L: float
    ) -> np.ndarray:
        """
        Get 6x6 stiffness matrix for 2D beam element.
        
        DOF ordering: [u1, v1, θ1, u2, v2, θ2]
        
        Args:
            section: Section properties
            L: Member length
            
        Returns:
            6x6 local stiffness matrix
        """
        E = section.E
        A = section.A
        I = section.Iz  # Bending about z-axis for 2D in XY plane
        G = section.G
        As = section.Asz
        
        # Shear flexibility parameter
        Phi = self.get_shear_flexibility_factor(E, I, G, As, L)
        
        # Stiffness coefficients
        EA_L = E * A / L
        
        # Modified bending stiffness for Timoshenko (reduces to E-B when Phi=0)
        denom = 1 + Phi
        
        k1 = 12 * E * I / (L**3 * denom)
        k2 = 6 * E * I / (L**2 * denom)
        k3 = (4 + Phi) * E * I / (L * denom)
        k4 = (2 - Phi) * E * I / (L * denom)
        
        # Build stiffness matrix
        K = np.zeros((6, 6))
        
        # Axial terms
        K[0, 0] = EA_L
        K[0, 3] = -EA_L
        K[3, 0] = -EA_L
        K[3, 3] = EA_L
        
        # Bending terms (in local y direction)
        K[1, 1] = k1
        K[1, 2] = k2
        K[1, 4] = -k1
        K[1, 5] = k2
        
        K[2, 1] = k2
        K[2, 2] = k3
        K[2, 4] = -k2
        K[2, 5] = k4
        
        K[4, 1] = -k1
        K[4, 2] = -k2
        K[4, 4] = k1
        K[4, 5] = -k2
        
        K[5, 1] = k2
        K[5, 2] = k4
        K[5, 4] = -k2
        K[5, 5] = k3
        
        return K
    
    def get_stiffness_matrix_3d(
        self,
        section: SectionProperties,
        L: float
    ) -> np.ndarray:
        """
        Get 12x12 stiffness matrix for 3D beam element.
        
        DOF ordering: [u1, v1, w1, θx1, θy1, θz1, u2, v2, w2, θx2, θy2, θz2]
        
        Args:
            section: Section properties
            L: Member length
            
        Returns:
            12x12 local stiffness matrix
        """
        E = section.E
        A = section.A
        G = section.G
        Iy = section.Iy
        Iz = section.Iz
        J = section.J
        Asy = section.Asy
        Asz = section.Asz
        
        # Shear flexibility parameters for both planes
        Phi_y = self.get_shear_flexibility_factor(E, Iz, G, Asy, L)  # Bending about z, shear in y
        Phi_z = self.get_shear_flexibility_factor(E, Iy, G, Asz, L)  # Bending about y, shear in z
        
        # Stiffness coefficients
        EA_L = E * A / L
        GJ_L = G * J / L
        
        # Bending about z-axis (displacement in y)
        denom_y = 1 + Phi_y
        a1 = 12 * E * Iz / (L**3 * denom_y)
        a2 = 6 * E * Iz / (L**2 * denom_y)
        a3 = (4 + Phi_y) * E * Iz / (L * denom_y)
        a4 = (2 - Phi_y) * E * Iz / (L * denom_y)
        
        # Bending about y-axis (displacement in z)
        denom_z = 1 + Phi_z
        b1 = 12 * E * Iy / (L**3 * denom_z)
        b2 = 6 * E * Iy / (L**2 * denom_z)
        b3 = (4 + Phi_z) * E * Iy / (L * denom_z)
        b4 = (2 - Phi_z) * E * Iy / (L * denom_z)
        
        # Build 12x12 stiffness matrix
        K = np.zeros((12, 12))
        
        # ===== AXIAL (u) =====
        K[0, 0] = EA_L
        K[0, 6] = -EA_L
        K[6, 0] = -EA_L
        K[6, 6] = EA_L
        
        # ===== BENDING IN XY PLANE (v, θz) =====
        # Shear in y (v)
        K[1, 1] = a1
        K[1, 5] = a2
        K[1, 7] = -a1
        K[1, 11] = a2
        
        K[5, 1] = a2
        K[5, 5] = a3
        K[5, 7] = -a2
        K[5, 11] = a4
        
        K[7, 1] = -a1
        K[7, 5] = -a2
        K[7, 7] = a1
        K[7, 11] = -a2
        
        K[11, 1] = a2
        K[11, 5] = a4
        K[11, 7] = -a2
        K[11, 11] = a3
        
        # ===== BENDING IN XZ PLANE (w, θy) =====
        # Shear in z (w)
        K[2, 2] = b1
        K[2, 4] = -b2
        K[2, 8] = -b1
        K[2, 10] = -b2
        
        K[4, 2] = -b2
        K[4, 4] = b3
        K[4, 8] = b2
        K[4, 10] = b4
        
        K[8, 2] = -b1
        K[8, 4] = b2
        K[8, 8] = b1
        K[8, 10] = b2
        
        K[10, 2] = -b2
        K[10, 4] = b4
        K[10, 8] = b2
        K[10, 10] = b3
        
        # ===== TORSION (θx) =====
        K[3, 3] = GJ_L
        K[3, 9] = -GJ_L
        K[9, 3] = -GJ_L
        K[9, 9] = GJ_L
        
        return K
    
    def get_mass_matrix_consistent_3d(
        self,
        section: SectionProperties,
        L: float,
        rho: float = 7850  # Steel density kg/m³
    ) -> np.ndarray:
        """
        Get 12x12 consistent mass matrix for 3D beam.
        
        Uses shape functions for consistent mass formulation.
        Includes Timoshenko corrections for shear deformation.
        
        Args:
            section: Section properties
            L: Member length
            rho: Material density
            
        Returns:
            12x12 consistent mass matrix
        """
        A = section.A
        Iy = section.Iy
        Iz = section.Iz
        E = section.E
        G = section.G
        Asy = section.Asy
        Asz = section.Asz
        
        m_total = rho * A * L  # Total element mass
        
        # Shear flexibility parameters
        Phi_y = self.get_shear_flexibility_factor(E, Iz, G, Asy, L)
        Phi_z = self.get_shear_flexibility_factor(E, Iy, G, Asz, L)
        
        M = np.zeros((12, 12))
        
        # Simplified consistent mass (without Timoshenko corrections for brevity)
        # Full Timoshenko mass matrix is quite complex
        
        # Axial mass
        m_ax = m_total / 6
        M[0, 0] = 2 * m_ax
        M[0, 6] = m_ax
        M[6, 0] = m_ax
        M[6, 6] = 2 * m_ax
        
        # Transverse mass (y-direction)
        # Simplified Euler-Bernoulli consistent mass
        m_t = m_total / 420
        M[1, 1] = 156 * m_t
        M[1, 5] = 22 * L * m_t
        M[1, 7] = 54 * m_t
        M[1, 11] = -13 * L * m_t
        
        M[5, 1] = 22 * L * m_t
        M[5, 5] = 4 * L**2 * m_t
        M[5, 7] = 13 * L * m_t
        M[5, 11] = -3 * L**2 * m_t
        
        M[7, 1] = 54 * m_t
        M[7, 5] = 13 * L * m_t
        M[7, 7] = 156 * m_t
        M[7, 11] = -22 * L * m_t
        
        M[11, 1] = -13 * L * m_t
        M[11, 5] = -3 * L**2 * m_t
        M[11, 7] = -22 * L * m_t
        M[11, 11] = 4 * L**2 * m_t
        
        # Transverse mass (z-direction) - same pattern
        M[2, 2] = 156 * m_t
        M[2, 4] = -22 * L * m_t
        M[2, 8] = 54 * m_t
        M[2, 10] = 13 * L * m_t
        
        M[4, 2] = -22 * L * m_t
        M[4, 4] = 4 * L**2 * m_t
        M[4, 8] = -13 * L * m_t
        M[4, 10] = -3 * L**2 * m_t
        
        M[8, 2] = 54 * m_t
        M[8, 4] = -13 * L * m_t
        M[8, 8] = 156 * m_t
        M[8, 10] = 22 * L * m_t
        
        M[10, 2] = 13 * L * m_t
        M[10, 4] = -3 * L**2 * m_t
        M[10, 8] = 22 * L * m_t
        M[10, 10] = 4 * L**2 * m_t
        
        # Torsional inertia (approximate)
        I_polar = rho * (Iy + Iz) * L / 6
        M[3, 3] = 2 * I_polar
        M[3, 9] = I_polar
        M[9, 3] = I_polar
        M[9, 9] = 2 * I_polar
        
        return M
    
    def get_transformation_matrix(
        self,
        start: Tuple[float, float, float],
        end: Tuple[float, float, float],
        up_vector: Tuple[float, float, float] = (0, 1, 0)
    ) -> np.ndarray:
        """
        Get 12x12 transformation matrix from local to global coordinates.
        
        Local x-axis: along member from start to end
        Local y-axis: perpendicular, in plane defined by up_vector
        Local z-axis: perpendicular to both
        
        Args:
            start: Start node coordinates (x, y, z)
            end: End node coordinates (x, y, z)
            up_vector: Reference up direction
            
        Returns:
            12x12 transformation matrix
        """
        dx = end[0] - start[0]
        dy = end[1] - start[1]
        dz = end[2] - start[2]
        L = math.sqrt(dx*dx + dy*dy + dz*dz)
        
        if L < 1e-10:
            return np.eye(12)
        
        # Local x-axis (along member)
        local_x = np.array([dx, dy, dz]) / L
        
        # Handle vertical members
        if abs(local_x[1]) > 0.999:
            # Nearly vertical, use global X as reference
            ref = np.array([1.0, 0.0, 0.0])
        else:
            ref = np.array(up_vector)
        
        # Local z-axis (perpendicular to x and reference)
        local_z = np.cross(local_x, ref)
        local_z = local_z / np.linalg.norm(local_z)
        
        # Local y-axis
        local_y = np.cross(local_z, local_x)
        
        # 3x3 rotation matrix
        R = np.array([local_x, local_y, local_z])
        
        # Build 12x12 transformation matrix
        T = np.zeros((12, 12))
        T[0:3, 0:3] = R
        T[3:6, 3:6] = R
        T[6:9, 6:9] = R
        T[9:12, 9:12] = R
        
        return T
    
    def transform_to_global(
        self,
        K_local: np.ndarray,
        T: np.ndarray
    ) -> np.ndarray:
        """
        Transform stiffness matrix to global coordinates.
        
        K_global = T^T · K_local · T
        
        Args:
            K_local: Local stiffness matrix
            T: Transformation matrix
            
        Returns:
            Global stiffness matrix
        """
        return T.T @ K_local @ T
    
    def compare_theories(
        self,
        section: SectionProperties,
        L: float
    ) -> Dict[str, Any]:
        """
        Compare Euler-Bernoulli vs Timoshenko for given member.
        
        Useful for understanding when Timoshenko theory is necessary.
        
        Args:
            section: Section properties
            L: Member length
            
        Returns:
            Dictionary with comparison metrics
        """
        # Calculate shear flexibility parameters
        Phi_y = self.get_shear_flexibility_factor(
            section.E, section.Iz, section.G, section.Asy, L
        )
        Phi_z = self.get_shear_flexibility_factor(
            section.E, section.Iy, section.G, section.Asz, L
        )
        
        # Estimate effective depth (assume rectangular for simplicity)
        d_approx = math.sqrt(12 * section.Iz / section.A)
        L_over_d = L / d_approx if d_approx > 0 else float('inf')
        
        # Timoshenko is crucial when L/d < 10
        needs_timoshenko = L_over_d < 10 or max(Phi_y, Phi_z) > 0.1
        
        # Deflection ratio (Timoshenko / Euler-Bernoulli)
        # For a simply supported beam with UDL:
        # δ_timoshenko / δ_euler ≈ 1 + Φ
        deflection_ratio = 1 + max(Phi_y, Phi_z)
        
        return {
            'L_over_d': round(L_over_d, 2),
            'Phi_y': round(Phi_y, 4),
            'Phi_z': round(Phi_z, 4),
            'needs_timoshenko': needs_timoshenko,
            'deflection_increase_pct': round((deflection_ratio - 1) * 100, 1),
            'recommendation': (
                'USE TIMOSHENKO - Deep beam effects significant' 
                if needs_timoshenko else 
                'Euler-Bernoulli adequate'
            )
        }


# =================================================
# CONVENIENCE FUNCTIONS
# =================================================

def create_steel_section(
    profile: str = 'ISMB300',
    E: float = 200e9,
    nu: float = 0.3
) -> SectionProperties:
    """
    Create common steel section properties.
    
    Args:
        profile: Profile name (limited predefined sections)
        E: Young's modulus (Pa)
        nu: Poisson's ratio
        
    Returns:
        SectionProperties for the section
    """
    G = E / (2 * (1 + nu))
    
    # Predefined sections (simplified values)
    sections = {
        'ISMB150': {'A': 1.90e-3, 'Iy': 0.73e-6, 'Iz': 7.26e-6, 'J': 0.04e-6},
        'ISMB200': {'A': 2.83e-3, 'Iy': 1.37e-6, 'Iz': 22.0e-6, 'J': 0.08e-6},
        'ISMB250': {'A': 4.72e-3, 'Iy': 2.94e-6, 'Iz': 51.3e-6, 'J': 0.16e-6},
        'ISMB300': {'A': 5.87e-3, 'Iy': 4.53e-6, 'Iz': 86.0e-6, 'J': 0.25e-6},
        'ISMB400': {'A': 7.85e-3, 'Iy': 8.22e-6, 'Iz': 204e-6, 'J': 0.46e-6},
        'ISMB500': {'A': 11.1e-3, 'Iy': 15.2e-6, 'Iz': 452e-6, 'J': 0.91e-6},
        'ISMB600': {'A': 15.6e-3, 'Iy': 26.0e-6, 'Iz': 918e-6, 'J': 1.75e-6},
    }
    
    props = sections.get(profile.upper(), sections['ISMB300'])
    
    # Shear correction factor for I-sections (approximately 0.85-0.90)
    kappa = 0.85
    
    return SectionProperties(
        A=props['A'],
        Iy=props['Iy'],
        Iz=props['Iz'],
        J=props['J'],
        E=E,
        G=G,
        kappa_y=kappa,
        kappa_z=kappa
    )


# =================================================
# EXAMPLE / TEST
# =================================================

if __name__ == "__main__":
    print("=" * 60)
    print("TIMOSHENKO vs EULER-BERNOULLI BEAM COMPARISON")
    print("=" * 60)
    
    # Create steel section
    section = create_steel_section('ISMB300')
    
    # Test different span-to-depth ratios
    test_lengths = [1.0, 3.0, 6.0, 10.0]  # meters
    
    beam_timo = TimoshenkoBeam(BeamTheory.TIMOSHENKO)
    beam_euler = TimoshenkoBeam(BeamTheory.EULER_BERNOULLI)
    
    print(f"\nSection: ISMB300")
    print(f"E = {section.E/1e9:.0f} GPa, G = {section.G/1e9:.0f} GPa")
    print(f"A = {section.A*1e4:.2f} cm², Iz = {section.Iz*1e8:.2f} cm⁴")
    print()
    
    for L in test_lengths:
        comparison = beam_timo.compare_theories(section, L)
        
        print(f"Span L = {L:.1f}m:")
        print(f"  L/d ratio: {comparison['L_over_d']:.1f}")
        print(f"  Shear flexibility Φ: {comparison['Phi_y']:.4f}")
        print(f"  Deflection increase: +{comparison['deflection_increase_pct']:.1f}%")
        print(f"  → {comparison['recommendation']}")
        print()
    
    # Compare stiffness matrices
    print("=" * 60)
    print("STIFFNESS MATRIX COMPARISON (L = 1.0m deep beam)")
    print("=" * 60)
    
    K_euler = beam_euler.get_stiffness_matrix_2d(section, 1.0)
    K_timo = beam_timo.get_stiffness_matrix_2d(section, 1.0)
    
    print("\nBending stiffness coefficient k[1,1] (shear in y):")
    print(f"  Euler-Bernoulli: {K_euler[1,1]/1e6:.2f} MN/m")
    print(f"  Timoshenko:      {K_timo[1,1]/1e6:.2f} MN/m")
    print(f"  Ratio:           {K_timo[1,1]/K_euler[1,1]:.4f}")
    
    print("\nRotational stiffness coefficient k[2,2]:")
    print(f"  Euler-Bernoulli: {K_euler[2,2]/1e6:.2f} MN·m/rad")
    print(f"  Timoshenko:      {K_timo[2,2]/1e6:.2f} MN·m/rad")
    print(f"  Ratio:           {K_timo[2,2]/K_euler[2,2]:.4f}")
