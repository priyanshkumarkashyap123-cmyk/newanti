"""
rc_limit_state_design.py - Limit State Design (LSD) for Reinforced Concrete Beams

Implements IS 456:2000 Limit State Design methodology for:
1. Bending Design (Moment Resistance)
   - Singly Reinforced Sections (Mu < Mu,lim)
   - Doubly Reinforced Sections (Mu > Mu,lim)
2. Shear Design
   - Nominal Shear Stress (τv)
   - Design Shear Strength of Concrete (τc)
   - Vertical Shear Stirrup Spacing

Output: Exact rebar configurations
  e.g., "3-16φ bottom, 2-12φ top, 8φ stirrups @ 150 c/c"

Author: BeamLab Ultimate Development Team
Code Standard: IS 456:2000
Date: March 2026
"""

import numpy as np
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum
import logging

logger = logging.getLogger(__name__)


# ============================================================================
# MATERIAL GRADES AND CONSTANTS (IS 456:2000)
# ============================================================================

class ConcreteGrade(Enum):
    """Indian Standard Concrete Grades"""
    M20 = 20
    M25 = 25
    M30 = 30
    M35 = 35
    M40 = 40
    M45 = 45
    M50 = 50


class RebarGrade(Enum):
    """Indian Standard Steel Reinforcement Grades"""
    Fe415 = 415  # Mild steel / HYSD
    Fe500 = 500  # High strength
    Fe500S = 500  # Seismic grade


# IS 456:2000 Design Constants
LIMIT_STATE_DESIGN_CONSTANTS = {
    # Partial Safety Factors
    'gamma_m_concrete': 1.5,    # For concrete (Cl. 36.4.2)
    'gamma_m_steel': 1.15,      # For steel (Cl. 36.4.2)
    
    # Material Stress Reduction
    'fcd_factor': 0.67,         # fcd = 0.67 * fck (Cl. 36.4.2)
    'fyd_factor': 0.87,         # fyd = 0.87 * fy (Cl. 36.4.2) - for bars
    
    # Limit State Parameters
    'xu_max_factor': 0.48,      # xu/d_ratio for M20-M40 (Table 2, Cl. 38.1)
    'lever_arm_factor': 0.95,   # z/d minimum for ductility (Cl. 38.1)
    
    # Shear Design (Cl. 40.1)
    'tau_c_base': 0.48,         # Base τc for M20 (N/mm²)
    'tau_c_pt_factor': 0.5,     # Factor for pt influence
    'tau_c_max': 4.0,           # Maximum τc for singly reinforced
    'tau_c_max_doubly': 4.8,    # Maximum τc for doubly reinforced
    
    # Rebar Spacing Limits
    'min_stirrup_dia': 8,       # mm (Cl. 26.5.1.5)
    'max_stirrup_spacing': 300, # mm (Cl. 40.4)
    'min_stirrup_spacing': 100, # mm (Cl. 40.4)
}

# Standard rebar diameters (mm) - IS 1786
STANDARD_REBAR_DIAMETERS = [8, 10, 12, 16, 20, 25, 28, 32]

# Standard stirrup diameters (mm)
STANDARD_STIRRUP_DIAMETERS = [6, 8, 10, 12]


# ============================================================================
# DATA CLASSES
# ============================================================================

@dataclass
class BeamSection:
    """Reinforced concrete beam cross-section"""
    b: float        # Width (mm)
    d: float        # Effective depth (mm)
    d_prime: float  # Depth to compression steel (mm), optional
    
    def __post_init__(self):
        if self.b <= 0 or self.d <= 0:
            raise ValueError("Width and depth must be positive")
        if self.d_prime is None:
            self.d_prime = 50  # Default cover + dia


@dataclass
class ConcreteProperties:
    """Concrete material properties"""
    grade: ConcreteGrade
    fck: float      # Characteristic compressive strength (N/mm²)
    
    @property
    def fcd(self) -> float:
        """Design compressive strength (Clause 36.4.2)"""
        return (self.fck * LIMIT_STATE_DESIGN_CONSTANTS['fcd_factor'] /
                LIMIT_STATE_DESIGN_CONSTANTS['gamma_m_concrete'])
    
    @property
    def Ec(self) -> float:
        """Modulus of elasticity (Cl. 30.2)"""
        return 5000 * np.sqrt(self.fck)


@dataclass
class RebarProperties:
    """Steel reinforcement properties"""
    grade: RebarGrade
    fy: float       # Characteristic yield strength (N/mm²)
    
    @property
    def fyd(self) -> float:
        """Design yield strength (Clause 36.4.2)"""
        return (self.fy * LIMIT_STATE_DESIGN_CONSTANTS['fyd_factor'] /
                LIMIT_STATE_DESIGN_CONSTANTS['gamma_m_steel'])
    
    @property
    def Es(self) -> float:
        """Modulus of elasticity for steel"""
        return 200000  # N/mm²


@dataclass
class LimitingMomentResult:
    """Result of limiting moment calculation"""
    Mu_lim: float   # Limiting moment (kN·m)
    xu_lim: float   # Limiting neutral axis depth (mm)
    z_lim: float    # Limiting lever arm (mm)
    r_lim: float    # Limiting moment of resistance coefficient
    is_ductile: bool


@dataclass
class BendingDesignResult:
    """Result of bending design"""
    design_type: str  # 'singly_reinforced' or 'doubly_reinforced'
    Ast_required: float  # Required tension steel (mm²)
    Asc_required: float  # Required compression steel (mm²) - zero for singly
    xu: float  # Neutral axis depth (mm)
    z: float   # Lever arm (mm)
    Mu_provided: float  # Design moment capacity (kN·m)
    pt: float  # Percentage of tension steel (%)
    
    # Rebar details
    main_rebar_size: int      # Diameter (mm)
    main_rebar_count: int     # Number of bars
    main_rebar_desc: str      # e.g., "3-16φ" (count-diameterφ)
    
    comp_rebar_size: int      # Compression diameter (mm)
    comp_rebar_count: int     # Compression bar count
    comp_rebar_desc: str      # e.g., "2-12φ"
    
    # Ductility and checks
    pt_balance: float  # Balanced percentage (%)
    mu_ratio: float    # Mu/Mu_lim ratio


@dataclass
class ShearDesignResult:
    """Result of shear design"""
    Vu: float                   # Ultimate shear (kN)
    tau_v: float                # Nominal shear stress (N/mm²)
    tau_c: float                # Design shear strength of concrete (N/mm²)
    requires_stirrups: bool     # If tau_v > tau_c
    
    # Stirrup details
    stirrup_dia: int            # Diameter (mm)
    stirrup_spacing: float      # Spacing c/c (mm)
    stirrup_desc: str           # e.g., "8φ @ 150 c/c"
    
    # Additional info
    pt_main: float              # Tension steel percentage (%)
    two_leg_area: float         # 2 * π * (d/2)² for stirrup (mm²/m)


@dataclass
class LSDDesignResult:
    """Complete LSD design result"""
    beam_section: BeamSection
    concrete: ConcreteProperties
    rebar: RebarProperties
    
    # Loads
    Mu: float       # Ultimate factored moment (kN·m)
    Vu: float       # Ultimate factored shear (kN)
    
    # Limiting moment
    limiting_moment: LimitingMomentResult
    
    # Design results
    bending: BendingDesignResult
    shear: ShearDesignResult
    
    # Summary
    rebar_summary: str  # e.g., "Bottom: 3-16φ, Top: 2-12φ, Shear: 8φ @ 150"
    design_status: str  # 'PASS' or 'FAIL'
    design_ratio: float # Max(Mu/Mu_lim, tau_v/tau_c)
    messages: List[str]


# ============================================================================
# LIMITING MOMENT CALCULATION (IS 456:2000, Clause 38.1)
# ============================================================================

class LimitingMomentCalculator:
    """
    Calculate limiting moment of resistance for ductility requirement.
    
    IS 456:2000 Clause 38.1 specifies that neutral axis depth is limited to
    maintain ductile failure. xu/d ≤ 0.48 for M20-M40 concrete.
    """
    
    @staticmethod
    def calculate(
        beam: BeamSection,
        concrete: ConcreteProperties,
        rebar: RebarProperties
    ) -> LimitingMomentResult:
        """
        Calculate limiting moment of resistance.
        
        At limiting condition:
        - xu/d = xu_max (0.48 for M20-M40)
        - Neutral axis from concrete: 0.36*fck*xu*b = 0.87*fy*Ast
        - Strain in steel = 0.0035*(d-xu)/xu (should be 0.002 minimum for ductility)
        
        Parameters
        ----------
        beam : BeamSection
            Beam cross-section dimensions
        concrete : ConcreteProperties
            Concrete grade and strength
        rebar : RebarProperties
            Steel grade and strength
        
        Returns
        -------
        result : LimitingMomentResult
            Limiting moment and related parameters
        """
        b = beam.b
        d = beam.d
        fck = concrete.fck
        fyd = rebar.fyd
        
        # Clause 38.1 - Limit on neutral axis depth for ductility
        xu_max_ratio = LIMIT_STATE_DESIGN_CONSTANTS['xu_max_factor']
        xu_lim = xu_max_ratio * d
        
        logger.debug(f"xu_lim = {xu_lim:.2f} mm (xu/d = {xu_max_ratio})")
        
        # Stress block factor for rectangular stress distribution
        # (Cl. 36.4.3 - effective stressed block 0.4*fck)
        K = 0.36 * fck  # Concrete stress block factor
        
        # Compression force: Cc = K * b * xu
        Cc = K * b * xu_lim
        
        # For equilibrium: T = Cc
        # T = 0.87*fy*Ast_lim
        Ast_lim = Cc / fyd
        
        # Lever arm: z = d - 0.42*xu (Cl. 38.2)
        z_lim = d - 0.42 * xu_lim
        
        # Ensure z_lim ≥ lever_arm_factor * d (ductility)
        z_min = LIMIT_STATE_DESIGN_CONSTANTS['lever_arm_factor'] * d
        if z_lim < z_min:
            logger.warning(
                f"Lever arm {z_lim:.2f} < minimum {z_min:.2f}. "
                f"Using z_min."
            )
            z_lim = z_min
        
        # Limiting moment: Mu_lim = Cc * z = K*b*xu*z
        Mu_lim = (K * b * xu_lim * z_lim) / 1e6  # Convert N·mm to kN·m
        
        logger.debug(f"Ast_lim = {Ast_lim:.2f} mm²")
        logger.debug(f"z_lim = {z_lim:.2f} mm")
        logger.debug(f"Mu_lim = {Mu_lim:.3f} kN·m")
        
        # Moment of resistance coefficient: r = Mu_lim / (b*d²)
        # Used for design charts
        r_lim = (Mu_lim * 1e6) / (b * d * d)
        
        return LimitingMomentResult(
            Mu_lim=Mu_lim,
            xu_lim=xu_lim,
            z_lim=z_lim,
            r_lim=r_lim,
            is_ductile=True  # By definition
        )


# ============================================================================
# SINGLY REINFORCED SECTION DESIGN (Mu < Mu_lim)
# ============================================================================

class SinglelyReinforcedDesign:
    """
    Design singly reinforced rectangular section.
    
    Procedure (IS 456:2000, Cl. 38.1-38.2):
    1. Calculate Mu / (fck*b*d²) = K
    2. Find xu/d ratio from design chart or iteration
    3. Calculate lever arm: z = d - 0.42*xu
    4. Calculate Ast = Mu / (0.87*fy*z)
    5. Select appropriate bars
    """
    
    @staticmethod
    def calculate_moment_coefficient(
        Mu: float,
        fck: float,
        b: float,
        d: float
    ) -> float:
        """
        Calculate moment coefficient K = Mu / (fck*b*d²)
        
        Used to find xu/d from design charts (IS 456 Table 2)
        """
        K = (Mu * 1e6) / (fck * b * d * d)
        return K
    
    @staticmethod
    def find_neutral_axis_ratio(
        K: float,
        fck: float
    ) -> float:
        """
        Find xu/d ratio from moment coefficient K.
        
        Uses quadratic solution or chart interpolation.
        From IS 456 Table 2, relationship between K and xu/d.
        
        For rectangular section:
        Mu = 0.36*fck*xu*b*(d - 0.42*xu)
        K = 0.36*xu/d*(1 - 0.42*xu/d)
        
        Let m = xu/d:
        K = 0.36*m - 0.1512*m²
        0.1512*m² - 0.36*m + K = 0
        
        Solving quadratic: m = (0.36 ± √(0.36² - 4*0.1512*K)) / (2*0.1512)
        """
        a = 0.1512
        b_coeff = -0.36
        c = K
        
        discriminant = b_coeff**2 - 4*a*c
        
        if discriminant < 0:
            logger.error(
                f"Invalid moment coefficient K={K:.4f}. "
                f"Section cannot resist applied moment."
            )
            return None
        
        m1 = (-b_coeff + np.sqrt(discriminant)) / (2*a)
        m2 = (-b_coeff - np.sqrt(discriminant)) / (2*a)
        
        # Choose the smaller root (xu < d limit)
        m = min(m1, m2)
        
        return m
    
    @staticmethod
    def design(
        Mu: float,
        beam: BeamSection,
        concrete: ConcreteProperties,
        rebar: RebarProperties
    ) -> BendingDesignResult:
        """
        Design singly reinforced rectangular section.
        
        Parameters
        ----------
        Mu : float
            Ultimate factored moment (kN·m)
        beam : BeamSection
            Beam section properties
        concrete : ConcreteProperties
            Concrete grade
        rebar : RebarProperties
            Steel grade
        
        Returns
        -------
        result : BendingDesignResult
        """
        b = beam.b
        d = beam.d
        fck = concrete.fck
        fyd = rebar.fyd
        fy = rebar.fy
        
        # Step 1: Calculate moment coefficient
        K = SinglelyReinforcedDesign.calculate_moment_coefficient(
            Mu, fck, b, d
        )
        
        logger.info(f"Moment coefficient K = {K:.4f}")
        
        # Step 2: Find neutral axis ratio
        m = SinglelyReinforcedDesign.find_neutral_axis_ratio(K, fck)
        
        if m is None:
            raise ValueError("Section undersized for applied moment")
        
        if m > LIMIT_STATE_DESIGN_CONSTANTS['xu_max_factor']:
            logger.warning(
                f"xu/d = {m:.3f} exceeds limit {LIMIT_STATE_DESIGN_CONSTANTS['xu_max_factor']}. "
                f"Section is under-reinforced. Consider increasing depth."
            )
        
        xu = m * d
        
        # Step 3: Calculate lever arm
        z = d - 0.42 * xu
        
        # Ensure z ≥ 0.95*d (ductility limit)
        z_min = LIMIT_STATE_DESIGN_CONSTANTS['lever_arm_factor'] * d
        if z < z_min:
            logger.warning(f"Lever arm {z:.2f} < {z_min:.2f}. Using z_min.")
            z = z_min
        
        # Step 4: Calculate required tension steel
        # Mu = T * z = 0.87*fy*Ast*z
        Ast_required = (Mu * 1e6) / (fyd * z)
        
        logger.info(f"xu = {xu:.2f} mm, z = {z:.2f} mm")
        logger.info(f"Ast required = {Ast_required:.2f} mm²")
        
        # Step 5: Select bars
        (main_rebar_size, main_rebar_count,
         Ast_provided, main_rebar_desc) = _select_reinforcement(
            Ast_required, b, d
        )
        
        # Design moment capacity
        Mu_provided = (fyd * Ast_provided * z) / 1e6
        
        # Tension steel percentage
        pt = (Ast_provided / (b * d)) * 100
        
        # Balanced steel percentage (for ductility reference)
        # pt_b = 0.36*fck / (0.87*fy) * (xu/d) at limiting
        pt_balance = (0.36 * fck / (0.87 * fy)) * LIMIT_STATE_DESIGN_CONSTANTS['xu_max_factor'] * 100
        
        return BendingDesignResult(
            design_type='singly_reinforced',
            Ast_required=Ast_required,
            Asc_required=0.0,
            xu=xu,
            z=z,
            Mu_provided=Mu_provided,
            pt=pt,
            main_rebar_size=main_rebar_size,
            main_rebar_count=main_rebar_count,
            main_rebar_desc=main_rebar_desc,
            comp_rebar_size=0,
            comp_rebar_count=0,
            comp_rebar_desc="",
            pt_balance=pt_balance,
            mu_ratio=Mu / Mu_provided  # Should be ≤ 1.0
        )


# ============================================================================
# DOUBLY REINFORCED SECTION DESIGN (Mu > Mu_lim)
# ============================================================================

class DoublyReinforcedDesign:
    """
    Design doubly reinforced rectangular section (with compression steel).
    
    Procedure (IS 456:2000, Cl. 38.3):
    1. Calculate Mu,lim using singly reinforced approach at xu/d = 0.48
    2. For Mu > Mu,lim: Design as superposition
       - Part 1: Singly reinforced section for Mu_lim
       - Part 2: Additional moment (Mu - Mu_lim) carried by Asc + additional Ast
    3. Compression steel Asc = (Mu - Mu_lim) / (0.87*fy*(d - d'))
    4. Additional tension steel for same moment
    5. Total Ast = Ast1 + Ast2
    """
    
    @staticmethod
    def design(
        Mu: float,
        Mu_lim: float,
        beam: BeamSection,
        concrete: ConcreteProperties,
        rebar: RebarProperties
    ) -> BendingDesignResult:
        """
        Design doubly reinforced rectangular section.
        
        Parameters
        ----------
        Mu : float
            Ultimate factored moment (kN·m)
        Mu_lim : float
            Limiting moment of resistance (kN·m)
        beam : BeamSection
            Beam section
        concrete : ConcreteProperties
            Concrete grade
        rebar : RebarProperties
            Steel grade
        
        Returns
        -------
        result : BendingDesignResult
        """
        b = beam.b
        d = beam.d
        d_prime = beam.d_prime
        fck = concrete.fck
        fyd = rebar.fyd
        fy = rebar.fy
        Es = rebar.Es
        Ec = concrete.Ec
        
        if Mu <= Mu_lim:
            raise ValueError(
                f"Use singly reinforced design if Mu ({Mu:.2f}) ≤ Mu_lim ({Mu_lim:.2f})"
            )
        
        logger.info(f"Designing doubly reinforced section: Mu={Mu:.2f}, Mu_lim={Mu_lim:.2f}")
        
        # Part 1: Moment to be resisted by compression steel
        Mu_excess = Mu - Mu_lim
        
        logger.info(f"Excess moment = {Mu_excess:.2f} kN·m")
        
        # Part 2: Compression steel area
        # Asc = Mu_excess / (0.87*fy*(d - d'))
        Asc_required = (Mu_excess * 1e6) / (fyd * (d - d_prime))
        
        logger.info(f"Asc required = {Asc_required:.2f} mm²")
        
        # Maximum compression steel is 4% of gross section (Cl. 26.5.1.1)
        Asc_max = 0.04 * b * d
        
        if Asc_required > Asc_max:
            logger.warning(
                f"Asc {Asc_required:.2f} > max {Asc_max:.2f}. Limiting to max."
            )
            Asc_required = Asc_max
        
        # Select compression bars
        (comp_rebar_size, comp_rebar_count,
         Asc_provided, comp_rebar_desc) = _select_reinforcement(
            Asc_required, b, d_prime
        )
        
        # Part 3: Tension steel
        # Stage 1: For Mu_lim at xu/d = 0.48
        xu_lim = LIMIT_STATE_DESIGN_CONSTANTS['xu_max_factor'] * d
        z_lim = d - 0.42 * xu_lim
        
        Ast1 = (Mu_lim * 1e6) / (fyd * z_lim)
        
        # Stage 2: Additional tension for excess moment
        # Asc provides moment = Asc * 0.87*fy * (d - d')
        # This is equivalent to moment from Asc as additional tension
        # Ast2 = Asc (moment couple at d and d')
        Ast2 = Asc_provided
        
        Ast_required = Ast1 + Ast2
        
        logger.info(f"Ast1 (for Mu_lim) = {Ast1:.2f} mm²")
        logger.info(f"Ast2 (for excess moment) = {Ast2:.2f} mm²")
        logger.info(f"Total Ast required = {Ast_required:.2f} mm²")
        
        # Select main tension bars
        (main_rebar_size, main_rebar_count,
         Ast_provided, main_rebar_desc) = _select_reinforcement(
            Ast_required, b, d
        )
        
        # Verify design moment capacity
        # Mu_provided = Ast * 0.87*fy * z + Asc * 0.87*fy * (d - d')
        z = d - 0.42 * xu_lim  # Use limiting xu
        
        Mu_from_Ast = (Ast_provided * fyd * z) / 1e6
        Mu_from_Asc = (Asc_provided * fyd * (d - d_prime)) / 1e6
        Mu_provided = Mu_from_Ast + Mu_from_Asc
        
        logger.info(
            f"Design capacity: Mu_Ast={Mu_from_Ast:.2f}, "
            f"Mu_Asc={Mu_from_Asc:.2f}, Total={Mu_provided:.2f} kN·m"
        )
        
        # Steel percentage
        pt = (Ast_provided / (b * d)) * 100
        pt_comp = (Asc_provided / (b * d)) * 100
        
        return BendingDesignResult(
            design_type='doubly_reinforced',
            Ast_required=Ast_required,
            Asc_required=Asc_required,
            xu=xu_lim,
            z=z_lim,
            Mu_provided=Mu_provided,
            pt=pt,
            main_rebar_size=main_rebar_size,
            main_rebar_count=main_rebar_count,
            main_rebar_desc=main_rebar_desc,
            comp_rebar_size=comp_rebar_size,
            comp_rebar_count=comp_rebar_count,
            comp_rebar_desc=comp_rebar_desc,
            pt_balance=(0.36 * fck / (0.87 * fy)) * LIMIT_STATE_DESIGN_CONSTANTS['xu_max_factor'] * 100,
            mu_ratio=Mu / Mu_provided
        )


# ============================================================================
# SHEAR DESIGN (IS 456:2000, Clause 40)
# ============================================================================

class ShearDesign:
    """
    Design shear reinforcement for reinforced concrete beams.
    
    Procedure (IS 456:2000, Clause 40):
    1. Calculate nominal shear stress τv = Vu / (b*d) [N/mm²]
    2. Calculate design shear strength τc based on:
       - Concrete grade (fck)
       - Tension steel percentage (pt)
       - No shear reinforcement if τv < τc_concrete
    3. If τv > τc:
       - Calculate required stirrup spacing: s = (Asv*0.87*fy*d) / (Vu)
       where Asv = 2-leg area of stirrup
    4. Select standard stirrup dia and spacing
    """
    
    @staticmethod
    def calculate_nominal_shear_stress(
        Vu: float,
        b: float,
        d: float
    ) -> float:
        """
        Calculate nominal shear stress τv = Vu / (b*d)
        
        Parameters
        ----------
        Vu : float
            Ultimate shear force (kN)
        b : float
            Beam width (mm)
        d : float
            Effective depth (mm)
        
        Returns
        -------
        tau_v : float
            Nominal shear stress (N/mm²)
        """
        tau_v = (Vu * 1e3) / (b * d)  # Vu in N, b*d in mm²
        return tau_v
    
    @staticmethod
    def calculate_design_shear_strength(
        fck: float,
        pt: float,
        doubly_reinforced: bool = False
    ) -> float:
        """
        Calculate design shear strength τc of concrete.
        
        IS 456:2000 Table 19 (Clause 40.2.1.1)
        
        Formula (as per IS 456 Table 19):
        τc = 0.85 * √(0.8*fck) * (√(1 + 5*β) - 1) / (6*β)
        where β = max(0.8*fck / (6.89*pt), 1.0)
        
        Maximum τc values (Table 20):
        M20: 2.8, M25: 3.1, M30: 3.5, M35: 3.7, M40: 4.0
        
        Parameters
        ----------
        fck : float
            Concrete characteristic strength (N/mm²)
        pt : float
            Tension steel percentage (%)
        doubly_reinforced : bool
            If True, use higher limit for doubly reinforced
        
        Returns
        -------
        tau_c : float
            Design shear strength (N/mm²)
        """
        # Table 20: Maximum shear stress τc,max (N/mm²) for different grades
        tau_c_max_table = {
            20: 2.8, 25: 3.1, 30: 3.5, 35: 3.7, 40: 4.0,
            45: 4.0, 50: 4.0
        }
        
        # Ensure pt is within valid range
        pt = max(pt, 0.15)  # Minimum 0.15% for Table 19
        pt = min(pt, 3.0)   # Maximum 3.0% for Table 19
        
        # IS 456 Table 19 formula
        beta = max(0.8 * fck / (6.89 * pt), 1.0)
        tau_c = 0.85 * np.sqrt(0.8 * fck) * (np.sqrt(1 + 5 * beta) - 1) / (6 * beta)
        
        # Apply maximum limit from Table 20
        fck_rounded = min(int(5 * round(fck / 5)), 50)  # Round to nearest grade
        fck_rounded = max(fck_rounded, 20)
        tau_c_max = tau_c_max_table.get(fck_rounded, 4.0)
        
        tau_c = min(tau_c, tau_c_max)
        
        return tau_c
    
    @staticmethod
    def design(
        Vu: float,
        beam: BeamSection,
        bending_result: BendingDesignResult,
        concrete: ConcreteProperties,
        rebar: RebarProperties
    ) -> ShearDesignResult:
        """
        Design shear reinforcement for beam.
        
        Parameters
        ----------
        Vu : float
            Ultimate shear force (kN)
        beam : BeamSection
            Beam section
        bending_result : BendingDesignResult
            Results from bending design (for steel percentage)
        concrete : ConcreteProperties
            Concrete grade and properties
        rebar : RebarProperties
            Steel grade
        
        Returns
        -------
        result : ShearDesignResult
        """
        b = beam.b
        d = beam.d
        fyd = rebar.fyd
        fy = rebar.fy
        fck = concrete.fck
        
        # Step 1: Calculate nominal shear stress
        tau_v = ShearDesign.calculate_nominal_shear_stress(Vu, b, d)
        
        logger.info(f"Nominal shear stress τv = {tau_v:.2f} N/mm²")
        
        # Step 2: Calculate design shear strength of concrete
        is_doubly = bending_result.design_type == 'doubly_reinforced'
        tau_c = ShearDesign.calculate_design_shear_strength(
            fck=fck,
            pt=bending_result.pt,
            doubly_reinforced=is_doubly
        )
        
        logger.info(
            f"Design shear strength τc = {tau_c:.2f} N/mm² "
            f"(pt={bending_result.pt:.2f}%)"
        )
        
        # Step 3: Check if shear reinforcement required
        requires_stirrups = tau_v > tau_c
        
        logger.info(
            f"Shear reinforcement: "
            f"{'REQUIRED' if requires_stirrups else 'NOT REQUIRED'} "
            f"(τv={tau_v:.2f} {'>' if requires_stirrups else '<='} τc={tau_c:.2f})"
        )
        
        # Step 4: Design stirrups if required
        if requires_stirrups:
            # Shear to be carried by stirrups
            Vu_stirrups = Vu - (tau_c * b * d) / 1e3  # kN
            
            # Required stirrup spacing: s = (Asv * 0.87*fy*d) / Vu
            # where Asv = 2-leg area for 2-legged stirrup
            
            stirrup_dia, stirrup_spacing, Asv = _design_stirrup_spacing(
                Vu_stirrups, b, d, fyd, fy
            )
            
            stirrup_desc = f"{stirrup_dia}φ @ {stirrup_spacing:.0f} c/c"
            
            logger.info(f"Stirrup design: {stirrup_desc}")
        else:
            # No stirrups required, use minimum spacing
            stirrup_dia = LIMIT_STATE_DESIGN_CONSTANTS['min_stirrup_dia']
            stirrup_spacing = LIMIT_STATE_DESIGN_CONSTANTS['max_stirrup_spacing']
            stirrup_desc = f"Minimum: {stirrup_dia}φ @ {stirrup_spacing:.0f} c/c"
            Asv = (np.pi * (stirrup_dia/2)**2) * 2  # 2-leg area
        
        # Two-leg area per meter
        two_leg_area = Asv  # mm² per stirrup
        
        return ShearDesignResult(
            Vu=Vu,
            tau_v=tau_v,
            tau_c=tau_c,
            requires_stirrups=requires_stirrups,
            stirrup_dia=stirrup_dia,
            stirrup_spacing=stirrup_spacing,
            stirrup_desc=stirrup_desc,
            pt_main=bending_result.pt,
            two_leg_area=two_leg_area
        )


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def _select_reinforcement(
    Ast_required: float,
    b: float,
    effective_region: float
) -> Tuple[int, int, float, str]:
    """
    Select standard reinforcement from available diameters.
    
    Tries to fit required steel area with minimum number of bars.
    
    Parameters
    ----------
    Ast_required : float
        Required steel area (mm²)
    b : float
        Width available (mm)
    effective_region : float
        Effective depth or spacing region (mm)
    
    Returns
    -------
    (diameter, count, provided_area, description)
    """
    best_config = None
    best_excess = float('inf')
    
    for dia in sorted(STANDARD_REBAR_DIAMETERS, reverse=True):
        bar_area = np.pi * (dia / 2)**2
        
        # Minimum bars based on spacing: 200 mm clear spacing
        min_spacing = 20  # mm minimum clear spacing
        max_bars = max(2, int((b - 40) / (dia + min_spacing)))
        
        for count in range(2, max_bars + 1):
            provided_area = count * bar_area
            excess = provided_area - Ast_required
            
            if excess >= 0 and excess < best_excess:
                best_excess = excess
                best_config = (dia, count, provided_area)
    
    if not best_config:
        # Fallback: use smallest dia with many bars
        dia = STANDARD_REBAR_DIAMETERS[-1]  # 8 mm
        bar_area = np.pi * (dia / 2)**2
        count = int(np.ceil(Ast_required / bar_area))
        provided_area = count * bar_area
        best_config = (dia, count, provided_area)
    
    dia, count, provided = best_config
    desc = f"{count}-{dia}φ"
    
    logger.debug(f"Selected: {desc} (Required: {Ast_required:.0f}, Provided: {provided:.0f})")
    
    return dia, count, provided, desc


def _design_stirrup_spacing(
    Vu: float,
    b: float,
    d: float,
    fyd: float,
    fy: float
) -> Tuple[int, float, float]:
    """
    Design stirrup spacing for given shear force.
    
    Formula: s = (Asv * 0.87*fy*d) / Vu
    where Asv = 2-leg stirrup area
    
    Returns
    -------
    (stirrup_dia, spacing_mm, asv_area)
    """
    # Try different stirrup diameters and find appropriate spacing
    for stirrup_dia in sorted(STANDARD_STIRRUP_DIAMETERS, reverse=True):
        # 2-leg stirrup area (2 × π(d/2)²)
        Asv = 2 * np.pi * (stirrup_dia / 2)**2
        
        # Required spacing: s = (Asv * 0.87*fy*d) / Vu
        required_spacing = (Asv * fyd * d) / (Vu * 1e3)  # Vu in N
        
        # Round to standard spacing (50 mm increments)
        spacing = int(required_spacing / 50) * 50
        spacing = max(spacing, LIMIT_STATE_DESIGN_CONSTANTS['min_stirrup_spacing'])
        spacing = min(spacing, LIMIT_STATE_DESIGN_CONSTANTS['max_stirrup_spacing'])
        
        if spacing >= LIMIT_STATE_DESIGN_CONSTANTS['min_stirrup_spacing']:
            return stirrup_dia, float(spacing), Asv
    
    # Fallback: use minimum dia with tighter spacing
    stirrup_dia = STANDARD_STIRRUP_DIAMETERS[0]  # 6 mm
    Asv = 2 * np.pi * (stirrup_dia / 2)**2
    spacing = LIMIT_STATE_DESIGN_CONSTANTS['min_stirrup_spacing']
    
    return stirrup_dia, float(spacing), Asv


# ============================================================================
# MASTER LSD ALGORITHM
# ============================================================================

class LimitStateDesignBeam:
    """
    Master LSD Algorithm for Reinforced Concrete Beams (IS 456:2000)
    
    Complete workflow:
    1. Calculate limiting moment
    2. Design bending (singly or doubly reinforced)
    3. Design shear
    4. Return comprehensive rebar layout
    """
    
    def __init__(
        self,
        Mu: float,
        Vu: float,
        beam: BeamSection,
        concrete: ConcreteProperties,
        rebar: RebarProperties
    ):
        """
        Initialize LSD design.
        
        Parameters
        ----------
        Mu : float
            Ultimate factored moment (kN·m)
        Vu : float
            Ultimate factored shear (kN)
        beam : BeamSection
            Beam cross-section
        concrete : ConcreteProperties
            Concrete grade
        rebar : RebarProperties
            Steel grade
        """
        self.Mu = Mu
        self.Vu = Vu
        self.beam = beam
        self.concrete = concrete
        self.rebar = rebar
        self.messages = []
    
    def design(self) -> LSDDesignResult:
        """
        Execute complete LSD design algorithm.
        
        Returns
        -------
        result : LSDDesignResult
            Complete design with rebar specifications
        """
        logger.info("=" * 70)
        logger.info("LIMIT STATE DESIGN - REINFORCED CONCRETE BEAM")
        logger.info(f"IS 456:2000")
        logger.info("=" * 70)
        logger.info(
            f"Section: {self.beam.b}×{self.beam.d} mm, "
            f"Concrete: {self.concrete.grade.name}, "
            f"Steel: {self.rebar.grade.name}"
        )
        logger.info(
            f"Applied: Mu = {self.Mu:.2f} kN·m, "
            f"Vu = {self.Vu:.2f} kN"
        )
        logger.info("-" * 70)
        
        # ====================================================================
        # STEP 1: Calculate Limiting Moment (Clause 38.1)
        # ====================================================================
        logger.info("\nSTEP 1: Limiting Moment of Resistance")
        limiting_moment = LimitingMomentCalculator.calculate(
            self.beam, self.concrete, self.rebar
        )
        
        logger.info(f"Mu_lim = {limiting_moment.Mu_lim:.3f} kN·m")
        logger.info(f"xu/d = {limiting_moment.xu_lim / self.beam.d:.3f}")
        
        self.messages.append(
            f"Limiting moment: {limiting_moment.Mu_lim:.2f} kN·m"
        )
        
        # ====================================================================
        # STEP 2: Bending Design (Clause 38.2 or 38.3)
        # ====================================================================
        logger.info("\nSTEP 2: Bending Design")
        
        if self.Mu <= limiting_moment.Mu_lim:
            logger.info("→ Singly Reinforced Section (Mu < Mu_lim)")
            bending_result = SinglelyReinforcedDesign.design(
                self.Mu, self.beam, self.concrete, self.rebar
            )
            self.messages.append("Design Type: Singly Reinforced")
        else:
            logger.info(
                f"→ Doubly Reinforced Section (Mu > Mu_lim) "
                f"[{self.Mu:.2f} > {limiting_moment.Mu_lim:.2f}]"
            )
            bending_result = DoublyReinforcedDesign.design(
                self.Mu, limiting_moment.Mu_lim,
                self.beam, self.concrete, self.rebar
            )
            self.messages.append("Design Type: Doubly Reinforced")
        
        logger.info(
            f"Main Rebar: {bending_result.main_rebar_desc} "
            f"(Area = {bending_result.Ast_required:.0f} mm²)"
        )
        if bending_result.Asc_required > 0:
            logger.info(
                f"Comp Rebar: {bending_result.comp_rebar_desc} "
                f"(Area = {bending_result.Asc_required:.0f} mm²)"
            )
        
        logger.info(f"Design Capacity: Mu = {bending_result.Mu_provided:.3f} kN·m")
        logger.info(f"Design Ratio: Mu/Mu_lim = {bending_result.mu_ratio:.3f}")
        
        # ====================================================================
        # STEP 3: Shear Design (Clause 40)
        # ====================================================================
        logger.info("\nSTEP 3: Shear Design")
        
        shear_result = ShearDesign.design(
            self.Vu, self.beam, bending_result, self.concrete, self.rebar
        )
        
        logger.info(f"Nominal Shear Stress: τv = {shear_result.tau_v:.2f} N/mm²")
        logger.info(f"Design Shear Strength: τc = {shear_result.tau_c:.2f} N/mm²")
        logger.info(f"Stirrup Design: {shear_result.stirrup_desc}")
        
        # ====================================================================
        # STEP 4: Summary and Status
        # ====================================================================
        logger.info("\n" + "=" * 70)
        logger.info("DESIGN SUMMARY")
        logger.info("=" * 70)
        
        # Rebar summary
        rebar_summary = self._format_rebar_summary(bending_result, shear_result)
        logger.info(f"Rebar Layout: {rebar_summary}")
        
        # Overall status
        # Design ratio for bending: Mu / Mu_capacity (should be ≤ 1.0)
        # For shear: τv ≤ τc_max (Table 20) is the real limit, NOT τv ≤ τc.
        # When τv > τc, stirrups carry the excess — that's normal LSD design.
        # Failure only occurs if τv > τc_max (Table 20: M20=2.8, M25=3.1, etc.)
        tau_c_max_table = {20: 2.8, 25: 3.1, 30: 3.5, 35: 3.7, 40: 4.0}
        fck_key = min(int(5 * round(self.concrete.fck / 5)), 40)
        fck_key = max(fck_key, 20)
        tau_c_max = tau_c_max_table.get(fck_key, 4.0)
        
        shear_ratio = shear_result.tau_v / tau_c_max if tau_c_max > 0 else 0.0
        bending_ratio = abs(bending_result.mu_ratio)
        
        design_ratio = max(bending_ratio, shear_ratio)
        
        if design_ratio <= 1.0:
            design_status = "✓ PASS"
            logger.info(f"✓ DESIGN PASSES (Ratio = {design_ratio:.3f})")
        else:
            design_status = "✗ FAIL"
            logger.error(f"✗ DESIGN FAILS (Ratio = {design_ratio:.3f})")
            self.messages.append(f"WARNING: Design ratio = {design_ratio:.2f} > 1.0")
        
        logger.info("=" * 70)
        
        return LSDDesignResult(
            beam_section=self.beam,
            concrete=self.concrete,
            rebar=self.rebar,
            Mu=self.Mu,
            Vu=self.Vu,
            limiting_moment=limiting_moment,
            bending=bending_result,
            shear=shear_result,
            rebar_summary=rebar_summary,
            design_status=design_status,
            design_ratio=design_ratio,
            messages=self.messages
        )
    
    @staticmethod
    def _format_rebar_summary(
        bending: BendingDesignResult,
        shear: ShearDesignResult
    ) -> str:
        """Format rebar specification as engineering string."""
        specs = []
        
        # Main tension
        specs.append(f"Bottom: {bending.main_rebar_desc}")
        
        # Compression (if present)
        if bending.comp_rebar_count > 0:
            specs.append(f"Top: {bending.comp_rebar_desc}")
        else:
            specs.append("Top: 2-10φ (minimum distribution)")
        
        # Shear
        specs.append(f"Shear: {shear.stirrup_desc}")
        
        return " | ".join(specs)


# ============================================================================
# MAIN - EXAMPLE USAGE
# ============================================================================

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(levelname)-8s | %(message)s'
    )
    
    # Example: Design a beam
    print("\n" + "="*70)
    print("EXAMPLE: Reinforced Concrete Beam LSD Design")
    print("="*70 + "\n")
    
    # Section: 300×600 mm, M30 concrete, Fe500 steel
    beam = BeamSection(b=300, d=600, d_prime=80)
    concrete = ConcreteProperties(
        grade=ConcreteGrade.M30,
        fck=30.0
    )
    rebar = RebarProperties(
        grade=RebarGrade.Fe500,
        fy=500.0
    )
    
    # Applied loads
    Mu = 350.0  # Ultimate moment (kN·m)
    Vu = 200.0  # Ultimate shear (kN)
    
    # Execute design
    designer = LimitStateDesignBeam(Mu, Vu, beam, concrete, rebar)
    result = designer.design()
    
    # Print final summary
    print("\n" + "="*70)
    print("FINAL REBAR SPECIFICATION (IS 456:2000)")
    print("="*70)
    print(f"\n{result.rebar_summary}")
    print(f"\nDesign Status: {result.design_status}")
    print(f"Design Ratio: {result.design_ratio:.3f}")
    
    # Messages
    if result.messages:
        print("\nNotes:")
        for msg in result.messages:
            print(f"  • {msg}")
