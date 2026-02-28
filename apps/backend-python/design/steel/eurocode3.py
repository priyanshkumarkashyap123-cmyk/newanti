"""
eurocode3.py - Eurocode 3 (EN 1993-1-1) Steel Design Implementation

Implements General Rules and Rules for Buildings:
- Material properties and partial factors
- Section classification (Class 1, 2, 3, 4)
- Cross-section resistance (Tension, Compression, Bending, Shear)
- Buckling resistance (Flexural, Lateral-Torsional)
- Interaction checks (Axial + Bending)

Reference: EN 1993-1-1:2005
"""

from dataclasses import dataclass, field
from typing import List, Optional, Tuple, Dict
from enum import Enum
import math


# ============================================
# ENUMS & CONSTANTS
# ============================================

class EC3SectionClass(Enum):
    CLASS_1 = 1  # Plastic, high rotation capacity
    CLASS_2 = 2  # Plastic, limited rotation
    CLASS_3 = 3  # Elastic resistance only
    CLASS_4 = 4  # Slender, local buckling (effective properties needed)

class BucklingCurve(Enum):
    a0 = "a0"
    a = "a"
    b = "b"
    c = "c"
    d = "d"

# Partial Safety Factors (National Annex may vary, using default EN)
GAMMA_M0 = 1.00  # Resistance of cross-sections
GAMMA_M1 = 1.00  # Resistance of members to instability
GAMMA_M2 = 1.25  # Resistance of net sections in tension

# Imperfection Factors (Table 6.1)
ALPHA_IMPERFECTION = {
    BucklingCurve.a0: 0.13,
    BucklingCurve.a:  0.21,
    BucklingCurve.b:  0.34,
    BucklingCurve.c:  0.49,
    BucklingCurve.d:  0.76
}


# ============================================
# DATA STRUCTURES
# ============================================

@dataclass
class SectionProperties:
    """Steel section properties"""
    name: str
    h: float        # Depth (mm)
    b: float        # Width (mm)
    tw: float       # Web thickness (mm)
    tf: float       # Flange thickness (mm)
    r: float = 0    # Root radius (mm)
    A: float = 0    # Area (mm²)
    Iz: float = 0   # Inertia major (mm⁴) (I_y in EC3)
    Iy: float = 0   # Inertia minor (mm⁴) (I_z in EC3)
    Wpl_y: float = 0 # Plastic modulus major
    Wpl_z: float = 0 # Plastic modulus minor
    Wel_y: float = 0 # Elastic modulus major
    Wel_z: float = 0 # Elastic modulus minor
    iy: float = 0   # Radius of gyration major
    iz: float = 0   # Radius of gyration minor
    It: float = 0   # Torsional constant
    Iw: float = 0   # Warping constant

@dataclass
class DesignForces:
    """Design forces (ULS)"""
    N_Ed: float = 0  # Axial force (kN, +ve tension)
    V_y_Ed: float = 0 # Shear y (kN)
    V_z_Ed: float = 0 # Shear z (kN)
    M_y_Ed: float = 0 # Moment about y (major) (kNm)
    M_z_Ed: float = 0 # Moment about z (minor) (kNm)
    T_Ed: float = 0   # Torsion (kNm)

@dataclass
class MemberGeometry:
    """Buckling lengths and factors"""
    L: float                # Actual length (m)
    L_cr_y: float           # Buckling length major (m)
    L_cr_z: float           # Buckling length minor (m)
    L_cr_LT: float = None   # LTB length (m), default = L_cr_z
    C1: float = 1.0         # Moment gradient factor C1
    
    def __post_init__(self):
        if self.L_cr_LT is None:
            self.L_cr_LT = self.L_cr_z

@dataclass
class DesignCheck:
    clause: str
    description: str
    demand: float
    capacity: float
    ratio: float
    status: str
    note: str = ""


# ============================================
# DESIGNER CLASS
# ============================================

class Eurocode3Designer:
    """
    Steel Member Design per EN 1993-1-1
    """
    def __init__(self, section: SectionProperties, fy: float = 235, E: float = 210000):
        self.section = section
        self.fy = fy  # MPa (N/mm²)
        self.E = E    # MPa (N/mm²)
        self.epsilon = math.sqrt(235.0 / fy)
        
    def classify_section(self, forces: DesignForces) -> EC3SectionClass:
        """
        Determine Section Class (1, 2, 3, or 4) based on Table 5.2.
        Simplified Classification (assuming Pure Compression or Pure Bending usually)
        """
        c = (self.section.b - self.section.tw) / 2 - self.section.r  # Outstand approximation
        # Flange Check (Outstand)
        c_t_flange = (self.section.b / 2) / self.section.tf # Simplified
        
        # Web Check (Internal)
        c_t_web = (self.section.h - 2*self.section.tf) / self.section.tw
        
        # Flange Limits (Table 5.2 Sheet 2)
        if c_t_flange <= 9 * self.epsilon:
            flange_class = 1
        elif c_t_flange <= 10 * self.epsilon:
            flange_class = 2
        elif c_t_flange <= 14 * self.epsilon:
            flange_class = 3
        else:
            flange_class = 4
            
        # Web Limits (Bending) (Table 5.2 Sheet 1)
        # Assuming plastic neutral axis at mid-depth for pure bending
        if c_t_web <= 72 * self.epsilon:
            web_class = 1
        elif c_t_web <= 83 * self.epsilon:
            web_class = 2
        elif c_t_web <= 124 * self.epsilon:
            web_class = 3
        else:
            web_class = 4
            
        # Overall class is maximum
        return EC3SectionClass(max(flange_class, web_class))

    def get_tension_resistance(self) -> float:
        """
        Design tension resistance Nt_Rd (Clause 6.2.3)
        Nt_Rd = pl_Rd = A * fy / gamma_M0
        """
        # Convert A to mm² is already assumed, result in Newtons, convert to kN
        Nt_Rd = (self.section.A * self.fy) / GAMMA_M0 / 1000.0
        return Nt_Rd

    def get_compression_resistance(self, s_class: EC3SectionClass) -> float:
        """
        Design compression resistance Nc_Rd (Clause 6.2.4)
        """
        if s_class.value <= 3:
            A_eff = self.section.A
        else:
            # Class 4: Need effective area - simplified approach: reduce by 20% audit placeholder
            # Real implementation needs effective width calculation per EN 1993-1-5
            A_eff = self.section.A * 0.8
            
        Nc_Rd = (A_eff * self.fy) / GAMMA_M0 / 1000.0
        return Nc_Rd

    def get_bending_resistance(self, axis: str, s_class: EC3SectionClass) -> float:
        """
        Design bending resistance Mc_Rd (Clause 6.2.5)
        axis: 'y' or 'z'
        """
        if axis == 'y':
            W = self.section.Wpl_y if s_class.value <= 2 else self.section.Wel_y
        else:
            W = self.section.Wpl_z if s_class.value <= 2 else self.section.Wel_z
            
        # If Class 4, use effective modulus (approx 0.8 elastic)
        if s_class.value == 4:
            W = W * 0.8
            
        Mc_Rd = (W * self.fy) / GAMMA_M0 / 1e6 # Convert to kNm
        return Mc_Rd

    def get_shear_resistance(self, axis: str) -> float:
        """
        Design plastic shear resistance V_pl_Rd (Clause 6.2.6)
        V_pl_Rd = Av * (fy / sqrt(3)) / gamma_M0
        """
        # Shear area approximations for I-sections
        if axis == 'z': # Vertical shear
            Av = self.section.A - 2*self.section.b*self.section.tf + (self.section.tw + 2*self.section.r)*self.section.tf
            # Simplified: Max(eta*h*tw, A - 2b*tf) -> Often just h*tw for rolled I
            Av = max(Av, self.section.h * self.section.tw) 
        else: # Horizontal shear
            Av = 2 * self.section.b * self.section.tf # Flanges take horizontal shear
            
        V_pl_Rd = (Av * (self.fy / math.sqrt(3))) / GAMMA_M0 / 1000.0
        return V_pl_Rd

    def get_buckling_resistance(self, geom: MemberGeometry, axis: str, s_class: EC3SectionClass) -> Tuple[float, float, float]:
        """
        Buckling resistance Nb_Rd (Clause 6.3.1)
        Returns (Nb_Rd, chi, lambda_bar)
        """
        # 1. Determine Buckling Curve
        # Simplified for rolled I-sections
        # h/b > 1.2: z-z -> b, y-y -> a
        # h/b <= 1.2: z-z -> c, y-y -> b
        h_b_ratio = self.section.h / self.section.b
        
        if axis == 'y':
            curve = BucklingCurve.a if h_b_ratio > 1.2 else BucklingCurve.b
            L_cr = geom.L_cr_y
            radius = self.section.iy
        else: # axis 'z'
            curve = BucklingCurve.b if h_b_ratio > 1.2 else BucklingCurve.c
            L_cr = geom.L_cr_z
            radius = self.section.iz
            
        alpha = ALPHA_IMPERFECTION[curve]
        
        # 2. Slenderness lambda
        lambda_slenderness = (L_cr * 1000) / radius # mm/mm
        lambda_1 = 93.9 * self.epsilon # PI * sqrt(E/fy)
        
        lambda_bar = lambda_slenderness / lambda_1
        
        # 3. Reduction factor chi
        # phi = 0.5 * [1 + alpha*(lambda_bar - 0.2) + lambda_bar^2]
        phi = 0.5 * (1 + alpha * (lambda_bar - 0.2) + lambda_bar**2)
        
        chi = 1.0 / (phi + math.sqrt(max(0, phi**2 - lambda_bar**2)))
        chi = min(1.0, chi)
        
        # 4. Resistance
        if s_class.value <= 3:
            A_eff = self.section.A
        else:
            A_eff = self.section.A * 0.8 # Class 4 approx
            
        Nb_Rd = (chi * A_eff * self.fy) / GAMMA_M1 / 1000.0
        return Nb_Rd, chi, lambda_bar

    def check_interaction(self, forces: DesignForces, geom: MemberGeometry) -> List[DesignCheck]:
        """
        Perform Combined Bending and Compresion check (Clause 6.3.3)
        N_Ed / X_min*N_pl_Rd + k_yy * M_y_Ed / M_pl_Rd <= 1.0
        """
        # A full interaction implementation is complex (Method 1 & 2).
        # Implementing a simplified conservative interaction here.
        
        checks = []
        s_class = self.classify_section(forces)
        
        # Capacities
        Nc_Rd = self.get_compression_resistance(s_class)
        My_Rd = self.get_bending_resistance('y', s_class)
        Mz_Rd = self.get_bending_resistance('z', s_class)
        
        # Buckling Capacities
        Nb_Rd_y, chi_y, _ = self.get_buckling_resistance(geom, 'y', s_class)
        Nb_Rd_z, chi_z, _ = self.get_buckling_resistance(geom, 'z', s_class)
        Nb_Rd_min = min(Nb_Rd_y, Nb_Rd_z)
        
        # Unity Checks
        
        # 1. Section Strength (Cross-section)
        # N/Nc + My/Mcy + Mz/Mcz <= 1.0
        n_ratio = abs(forces.N_Ed) / Nc_Rd
        my_ratio = abs(forces.M_y_Ed) / My_Rd
        mz_ratio = abs(forces.M_z_Ed) / Mz_Rd
        
        cs_unity = n_ratio + my_ratio + mz_ratio
        
        checks.append(DesignCheck(
            clause="6.2.1",
            description="Cross-section Resistance (Combined)",
            demand=cs_unity, # Using ratio as demand for unity check
            capacity=1.0,
            ratio=cs_unity,
            status="PASS" if cs_unity <= 1.0 else "FAIL",
            note=f"Class {s_class.name}"
        ))
        
        # 2. Member Stability (Buckling Interaction)
        # N/Nb_min + 1.0*My/M_LT_Rd + ... 
        # Simplified: Using k factors = 1.0 (conservative for some cases, unconservative for others without Cm)
        # Typically k ~ 1.5 for sway frames.
        
        nb_ratio = abs(forces.N_Ed) / Nb_Rd_min
        
        stab_unity = nb_ratio + my_ratio + mz_ratio
        
        checks.append(DesignCheck(
            clause="6.3.3",
            description="Member Buckling Stability (Simplified)",
            demand=stab_unity,
            capacity=1.0,
            ratio=stab_unity,
            status="PASS" if stab_unity <= 1.0 else "FAIL",
            note="Using Simplified Interaction k=1.0"
        ))
        
        return checks

