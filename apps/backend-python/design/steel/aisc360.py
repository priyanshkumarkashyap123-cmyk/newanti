"""
aisc360.py - AISC 360-16 Steel Design Code Implementation

Implements LRFD and ASD methods per AISC 360-16
- Tension members (Chapter D)
- Compression members (Chapter E)
- Flexural members (Chapter F)
- Combined forces (Chapter H)

Reference: ANSI/AISC 360-16 Specification for Structural Steel Buildings
"""

from dataclasses import dataclass
from typing import Optional, Tuple, List
from enum import Enum
import math

from .is800 import SectionProperties, MemberGeometry, DesignForces, DesignCheck


# ============================================
# CONSTANTS
# ============================================

# Resistance factors (LRFD)
PHI_T = 0.90   # Tension yielding
PHI_TN = 0.75  # Tension rupture
PHI_C = 0.90   # Compression
PHI_B = 0.90   # Flexure
PHI_V = 0.90   # Shear

# Safety factors (ASD)
OMEGA_T = 1.67  # Tension yielding
OMEGA_TN = 2.00 # Tension rupture
OMEGA_C = 1.67  # Compression
OMEGA_B = 1.67  # Flexure
OMEGA_V = 1.67  # Shear


class DesignMethod(Enum):
    LRFD = 'LRFD'
    ASD = 'ASD'


# ============================================
# AISC 360-16 DESIGNER
# ============================================

class AISC360Designer:
    """
    Steel member design per AISC 360-16
    """
    
    def __init__(
        self,
        section: SectionProperties,
        Fy: float = 345,    # MPa (50 ksi)
        Fu: float = 450,    # MPa (65 ksi)
        E: float = 200000,  # MPa
        method: DesignMethod = DesignMethod.LRFD
    ):
        self.section = section
        self.Fy = Fy
        self.Fu = Fu
        self.E = E
        self.method = method
    
    def _get_phi_omega(self, phi: float, omega: float) -> float:
        """Get appropriate factor based on design method"""
        if self.method == DesignMethod.LRFD:
            return phi
        else:
            return 1 / omega
    
    # ============================================
    # TENSION (Chapter D)
    # ============================================
    
    def get_tension_capacity(
        self,
        An: Optional[float] = None,  # Net area (mm²)
        U: float = 1.0               # Shear lag factor
    ) -> Tuple[float, DesignCheck]:
        """
        Calculate tension capacity per Chapter D
        
        Pn = min(Fy*Ag, Fu*Ae)
        """
        s = self.section
        Ag = s.area
        Ae = (An or Ag) * U  # Effective net area
        
        # Yielding in gross section
        Pn_y = self.Fy * Ag / 1000  # kN
        
        # Rupture in net section
        Pn_r = self.Fu * Ae / 1000  # kN
        
        if self.method == DesignMethod.LRFD:
            Pt = min(PHI_T * Pn_y, PHI_TN * Pn_r)
        else:
            Pt = min(Pn_y / OMEGA_T, Pn_r / OMEGA_TN)
        
        check = DesignCheck(
            check_name="Tension Capacity",
            clause="AISC 360, Ch. D",
            demand=0,
            capacity=Pt,
            ratio=0,
            status='PASS',
            formula=f"Pt = min(φ×Fy×Ag, φ×Fu×Ae) = {Pt:.1f} kN"
        )
        
        return Pt, check
    
    # ============================================
    # COMPRESSION (Chapter E)
    # ============================================
    
    def get_compression_capacity(
        self,
        geometry: MemberGeometry
    ) -> Tuple[float, DesignCheck]:
        """
        Calculate compression capacity per Chapter E
        
        Pn = Fcr * Ag
        """
        s = self.section
        
        # Slenderness
        Lc_y = geometry.effective_length_y or geometry.length
        Lc_z = geometry.effective_length_z or geometry.length
        
        lambda_y = Lc_y / s.ry if s.ry > 0 else 0
        lambda_z = Lc_z / s.rz if s.rz > 0 else 0
        
        # Elastic buckling stress
        Fe_y = math.pi**2 * self.E / lambda_y**2 if lambda_y > 0 else float('inf')
        Fe_z = math.pi**2 * self.E / lambda_z**2 if lambda_z > 0 else float('inf')
        Fe = min(Fe_y, Fe_z)
        
        # Critical stress Fcr
        if self.Fy / Fe <= 2.25:
            Fcr = 0.658**(self.Fy / Fe) * self.Fy
        else:
            Fcr = 0.877 * Fe
        
        Pn = Fcr * s.area / 1000  # kN
        
        factor = self._get_phi_omega(PHI_C, OMEGA_C)
        Pc = factor * Pn
        
        check = DesignCheck(
            check_name="Compression Capacity",
            clause="AISC 360, Ch. E",
            demand=0,
            capacity=Pc,
            ratio=0,
            status='PASS',
            formula=f"Pc = φ×Fcr×Ag = {factor:.2f}×{Fcr:.1f}×{s.area:.0f} = {Pc:.1f} kN"
        )
        
        return Pc, check
    
    # ============================================
    # FLEXURE (Chapter F)
    # ============================================
    
    def get_moment_capacity(
        self,
        geometry: MemberGeometry,
        axis: str = 'z'
    ) -> Tuple[float, DesignCheck]:
        """
        Calculate flexural capacity per Chapter F
        """
        s = self.section
        
        if axis == 'z':
            Zx = s.Zpz
            Sx = s.Zz
        else:
            Zx = s.Zpy
            Sx = s.Zy
        
        # Plastic moment
        Mp = self.Fy * Zx / 1e6  # kNm
        
        # Check LTB for major axis
        if axis == 'z':
            Lb = geometry.unbraced_length or geometry.length
            
            # Limiting lengths (simplified)
            ry = s.ry
            Lp = 1.76 * ry * math.sqrt(self.E / self.Fy)
            
            # Approximate Lr
            rts = math.sqrt(math.sqrt(s.Iy * s.Iz) / s.Zz) if s.Zz > 0 else ry
            c = 1.0  # For doubly symmetric I-shapes
            Lr = 1.95 * rts * (self.E / (0.7 * self.Fy)) * \
                 math.sqrt(1 + math.sqrt(1 + 6.76 * (0.7 * self.Fy / self.E)**2))
            
            if Lb <= Lp:
                Mn = Mp
            elif Lb <= Lr:
                Mr = 0.7 * self.Fy * Sx / 1e6
                Mn = Mp - (Mp - Mr) * (Lb - Lp) / (Lr - Lp)
            else:
                # Elastic LTB
                Fcr = geometry.Cb * math.pi**2 * self.E / (Lb / rts)**2
                Mn = Fcr * Sx / 1e6
            
            Mn = min(Mn, Mp)
        else:
            Mn = Mp
        
        factor = self._get_phi_omega(PHI_B, OMEGA_B)
        Mc = factor * Mn
        
        check = DesignCheck(
            check_name=f"Moment Capacity ({axis}-axis)",
            clause="AISC 360, Ch. F",
            demand=0,
            capacity=Mc,
            ratio=0,
            status='PASS',
            formula=f"Mc = φ×Mn = {factor:.2f}×{Mn:.1f} = {Mc:.1f} kNm"
        )
        
        return Mc, check
    
    # ============================================
    # SHEAR (Chapter G)
    # ============================================
    
    def get_shear_capacity(self) -> Tuple[float, DesignCheck]:
        """
        Calculate shear capacity per Chapter G
        """
        s = self.section
        
        # Web area
        Aw = s.depth * s.web_thickness
        
        # Web slenderness
        h = s.depth - 2 * s.flange_thickness
        lambda_w = h / s.web_thickness if s.web_thickness > 0 else 0
        
        # Critical web shear coefficient
        kv = 5.34  # No transverse stiffeners
        
        limit1 = 1.1 * math.sqrt(kv * self.E / self.Fy)
        limit2 = 1.37 * math.sqrt(kv * self.E / self.Fy)
        
        if lambda_w <= limit1:
            Cv1 = 1.0
        elif lambda_w <= limit2:
            Cv1 = limit1 / lambda_w
        else:
            Cv1 = 1.51 * kv * self.E / (lambda_w**2 * self.Fy)
        
        Vn = 0.6 * self.Fy * Aw * Cv1 / 1000  # kN
        
        factor = self._get_phi_omega(PHI_V, OMEGA_V)
        Vc = factor * Vn
        
        check = DesignCheck(
            check_name="Shear Capacity",
            clause="AISC 360, Ch. G",
            demand=0,
            capacity=Vc,
            ratio=0,
            status='PASS',
            formula=f"Vc = φ×0.6×Fy×Aw×Cv = {Vc:.1f} kN"
        )
        
        return Vc, check
    
    # ============================================
    # COMBINED FORCES (Chapter H)
    # ============================================
    
    def check_interaction(
        self,
        forces: DesignForces,
        geometry: MemberGeometry
    ) -> DesignCheck:
        """
        Check combined forces per Chapter H (H1-1a/b)
        
        Pr/Pc + 8/9(Mrx/Mcx + Mry/Mcy) ≤ 1.0  when Pr/Pc ≥ 0.2
        Pr/(2Pc) + (Mrx/Mcx + Mry/Mcy) ≤ 1.0  when Pr/Pc < 0.2
        """
        Pr = abs(forces.N)
        Mrx = abs(forces.Mz)
        Mry = abs(forces.My)
        
        if forces.N < 0:
            Pc, _ = self.get_compression_capacity(geometry)
        else:
            Pc, _ = self.get_tension_capacity()
        
        Mcx, _ = self.get_moment_capacity(geometry, 'z')
        Mcy, _ = self.get_moment_capacity(geometry, 'y')
        
        ratio_P = Pr / Pc if Pc > 0 else 0
        ratio_Mx = Mrx / Mcx if Mcx > 0 else 0
        ratio_My = Mry / Mcy if Mcy > 0 else 0
        
        if ratio_P >= 0.2:
            # Equation H1-1a
            ratio = ratio_P + (8/9) * (ratio_Mx + ratio_My)
            formula = f"Pr/Pc + 8/9(Mrx/Mcx + Mry/Mcy) = {ratio:.3f}"
        else:
            # Equation H1-1b
            ratio = ratio_P / 2 + ratio_Mx + ratio_My
            formula = f"Pr/(2Pc) + Mrx/Mcx + Mry/Mcy = {ratio:.3f}"
        
        status = 'PASS' if ratio <= 1.0 else 'FAIL'
        
        return DesignCheck(
            check_name="Combined Forces Interaction",
            clause="AISC 360, H1-1",
            demand=ratio,
            capacity=1.0,
            ratio=ratio,
            status=status,
            formula=formula
        )
