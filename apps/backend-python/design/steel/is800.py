"""
is800.py - IS 800:2007 Steel Design Code Implementation

Implements Limit State Method (LSM) for steel design per IS 800:2007
- Section classification (Plastic, Compact, Semi-compact, Slender)
- Tension member design (Clause 6)
- Compression member design with buckling (Clause 7)
- Flexural member design (Clause 8)
- Combined axial + bending interaction (Clause 9)
- Shear design (Clause 8.4)

Reference: IS 800:2007 - General construction in steel - Code of Practice
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from enum import Enum
import math


# ============================================
# ENUMS & CONSTANTS
# ============================================

class SectionClass(Enum):
    """Section classification per Table 2 of IS 800:2007"""
    PLASTIC = 1      # Class 1 - Can form plastic hinge
    COMPACT = 2      # Class 2 - Can reach yield but limited rotation
    SEMI_COMPACT = 3 # Class 3 - Local buckling before yield
    SLENDER = 4      # Class 4 - Local buckling dominates


class BucklingClass(Enum):
    """Column buckling curves per Table 10 of IS 800:2007"""
    a = 'a'
    b = 'b'
    c = 'c'
    d = 'd'


class SteelGrade(Enum):
    """Standard steel grades"""
    FE250 = ('Fe250', 250, 410)
    E250 = ('E250', 250, 410)
    E275 = ('E275', 275, 430)
    E300 = ('E300', 300, 440)
    E350 = ('E350', 350, 490)
    E410 = ('E410', 410, 540)
    E450 = ('E450', 450, 570)
    
    def __init__(self, name: str, fy: float, fu: float):
        self.grade_name = name
        self.fy = fy  # Yield strength (MPa)
        self.fu = fu  # Ultimate strength (MPa)


# Partial safety factors (Table 5 of IS 800:2007)
GAMMA_M0 = 1.10  # Resistance governed by yielding
GAMMA_M1 = 1.25  # Resistance governed by buckling
GAMMA_M2 = 1.25  # Resistance of net section


# ============================================
# DATA STRUCTURES
# ============================================

@dataclass
class SectionProperties:
    """Steel section properties"""
    name: str
    # Dimensions (mm)
    depth: float         # D - Overall depth
    width: float         # bf - Flange width
    web_thickness: float # tw
    flange_thickness: float # tf
    root_radius: float = 0   # r
    # Computed properties
    area: float = 0          # mm²
    Iz: float = 0            # mm⁴ - Major axis moment of inertia
    Iy: float = 0            # mm⁴ - Minor axis moment of inertia
    Zz: float = 0            # mm³ - Major axis elastic section modulus
    Zy: float = 0            # mm³ - Minor axis elastic section modulus
    Zpz: float = 0           # mm³ - Major axis plastic section modulus
    Zpy: float = 0           # mm³ - Minor axis plastic section modulus
    rz: float = 0            # mm - Radius of gyration (major)
    ry: float = 0            # mm - Radius of gyration (minor)


@dataclass
class MemberGeometry:
    """Member geometric properties for design"""
    length: float            # Actual length (mm)
    effective_length_y: float = None  # Ley for buckling about y-y
    effective_length_z: float = None  # Lez for buckling about z-z
    unbraced_length: float = None     # Lu for lateral torsional buckling
    Cb: float = 1.0          # Moment gradient factor


@dataclass
class DesignForces:
    """Design forces from analysis"""
    N: float = 0       # Axial force (kN), tension positive
    Vy: float = 0      # Shear force y-axis (kN)
    Vz: float = 0      # Shear force z-axis (kN)
    T: float = 0       # Torsion (kNm)
    My: float = 0      # Bending moment about y-y (kNm)
    Mz: float = 0      # Bending moment about z-z (kNm)


@dataclass
class DesignCheck:
    """Result of a single design check"""
    check_name: str
    clause: str           # IS 800 clause reference
    demand: float         # Applied value
    capacity: float       # Design capacity
    ratio: float          # Demand/Capacity
    status: str           # 'PASS' or 'FAIL'
    formula: str = ""     # Formula used
    notes: str = ""       # Additional notes


@dataclass
class SteelDesignResult:
    """Complete design result for a steel member"""
    member_id: str
    section: SectionProperties
    section_class: SectionClass
    # Individual checks
    checks: List[DesignCheck]
    # Summary
    governing_check: str
    governing_ratio: float
    overall_status: str    # 'PASS' or 'FAIL'
    # Capacities
    Nd_tension: float = 0   # Tension capacity (kN)
    Nd_compression: float = 0  # Compression capacity (kN)
    Md_z: float = 0         # Major axis moment capacity (kNm)
    Md_y: float = 0         # Minor axis moment capacity (kNm)
    Vd: float = 0           # Shear capacity (kN)


# ============================================
# IS 800:2007 DESIGNER
# ============================================

class IS800Designer:
    """
    Steel member design per IS 800:2007 (Limit State Method)
    """
    
    def __init__(
        self,
        section: SectionProperties,
        steel_grade: SteelGrade = SteelGrade.E250,
        E: float = 200000  # MPa
    ):
        self.section = section
        self.fy = steel_grade.fy
        self.fu = steel_grade.fu
        self.E = E
        
        # Epsilon for section classification
        self.epsilon = math.sqrt(250 / self.fy)
    
    # ============================================
    # SECTION CLASSIFICATION (Table 2)
    # ============================================
    
    def classify_section(self) -> SectionClass:
        """
        Classify section as Plastic, Compact, Semi-compact, or Slender
        per Table 2 of IS 800:2007
        """
        s = self.section
        eps = self.epsilon
        
        # Flange outstand: b/tf
        b = (s.width - s.web_thickness) / 2  # Outstand width
        flange_ratio = b / s.flange_thickness if s.flange_thickness > 0 else float('inf')
        
        # Web: d/tw (clear depth between fillets)
        d = s.depth - 2 * s.flange_thickness - 2 * s.root_radius
        web_ratio = d / s.web_thickness if s.web_thickness > 0 else float('inf')
        
        # Flange limits (compression flange of I-section)
        flange_plastic = 9.4 * eps
        flange_compact = 10.5 * eps
        flange_semi = 15.7 * eps
        
        # Web limits (plastic neutral axis at mid-depth)
        web_plastic = 84 * eps
        web_compact = 105 * eps
        web_semi = 126 * eps
        
        # Classify based on most critical element
        if flange_ratio <= flange_plastic and web_ratio <= web_plastic:
            return SectionClass.PLASTIC
        elif flange_ratio <= flange_compact and web_ratio <= web_compact:
            return SectionClass.COMPACT
        elif flange_ratio <= flange_semi and web_ratio <= web_semi:
            return SectionClass.SEMI_COMPACT
        else:
            return SectionClass.SLENDER
    
    # ============================================
    # TENSION DESIGN (Clause 6)
    # ============================================
    
    def get_tension_capacity(
        self,
        An: Optional[float] = None,  # Net area (mm²)
        holes: int = 0,               # Number of bolt holes
        hole_dia: float = 0           # Bolt hole diameter (mm)
    ) -> Tuple[float, DesignCheck]:
        """
        Calculate tension capacity per Clause 6
        
        Td = min(Tdy, Tdn, Tdb)
        - Tdy = Ag * fy / γm0 (yielding of gross section)
        - Tdn = 0.9 * An * fu / γm1 (rupture of net section)
        """
        Ag = self.section.area
        
        # Calculate net area if not provided
        if An is None:
            An = Ag - holes * hole_dia * self.section.flange_thickness * 2
        An = max(An, 0.85 * Ag)  # Minimum net area
        
        # Yielding of gross section
        Tdy = Ag * self.fy / GAMMA_M0 / 1000  # kN
        
        # Rupture of net section
        Tdn = 0.9 * An * self.fu / GAMMA_M1 / 1000  # kN
        
        Td = min(Tdy, Tdn)
        
        check = DesignCheck(
            check_name="Tension Capacity",
            clause="IS 800, Cl. 6.2",
            demand=0,
            capacity=Td,
            ratio=0,
            status='PASS',
            formula=f"Td = min(Ag*fy/γm0, 0.9*An*fu/γm1) = min({Tdy:.1f}, {Tdn:.1f}) = {Td:.1f} kN"
        )
        
        return Td, check
    
    # ============================================
    # COMPRESSION DESIGN (Clause 7)
    # ============================================
    
    def get_buckling_class(self, axis: str = 'z') -> BucklingClass:
        """
        Determine buckling class per Table 10 of IS 800:2007
        Based on section type and axis of buckling
        """
        s = self.section
        h = s.depth
        b = s.width
        tf = s.flange_thickness
        
        ratio = h / b if b > 0 else 1.0
        
        # For rolled I-sections
        if ratio > 1.2:
            # Deep sections
            if tf <= 40:
                return BucklingClass.a if axis == 'z' else BucklingClass.b
            else:
                return BucklingClass.b if axis == 'z' else BucklingClass.c
        else:
            # Broad flange sections
            if tf <= 40:
                return BucklingClass.b if axis == 'z' else BucklingClass.c
            else:
                return BucklingClass.c if axis == 'z' else BucklingClass.d
    
    def get_imperfection_factor(self, buckling_class: BucklingClass) -> float:
        """
        Imperfection factor α per Table 7 of IS 800:2007
        """
        alpha_values = {
            BucklingClass.a: 0.21,
            BucklingClass.b: 0.34,
            BucklingClass.c: 0.49,
            BucklingClass.d: 0.76
        }
        return alpha_values[buckling_class]
    
    def get_compression_capacity(
        self,
        geometry: MemberGeometry
    ) -> Tuple[float, DesignCheck]:
        """
        Calculate compression capacity per Clause 7
        
        Pd = Ae * fcd
        fcd = (fy/γm0) / (φ + √(φ² - λ²))
        
        where:
        φ = 0.5[1 + α(λ - 0.2) + λ²]
        λ = √(fy/fcr) = (KL/r) / (π√(E/fy))
        """
        s = self.section
        
        # Effective lengths
        Ley = geometry.effective_length_y or geometry.length
        Lez = geometry.effective_length_z or geometry.length
        
        # Slenderness ratios
        lambda_y = Ley / s.ry if s.ry > 0 else 0
        lambda_z = Lez / s.rz if s.rz > 0 else 0
        
        # Non-dimensional slenderness
        lambda_1 = math.pi * math.sqrt(self.E / self.fy)
        
        lambda_bar_y = lambda_y / lambda_1
        lambda_bar_z = lambda_z / lambda_1
        
        # Design stress for each axis
        fcd_y = self._calculate_fcd(lambda_bar_y, 'y')
        fcd_z = self._calculate_fcd(lambda_bar_z, 'z')
        
        fcd = min(fcd_y, fcd_z)
        
        # Design compression capacity
        Pd = s.area * fcd / 1000  # kN
        
        governing_axis = 'y' if fcd_y < fcd_z else 'z'
        governing_lambda = lambda_y if fcd_y < fcd_z else lambda_z
        
        check = DesignCheck(
            check_name="Compression Capacity",
            clause="IS 800, Cl. 7.1",
            demand=0,
            capacity=Pd,
            ratio=0,
            status='PASS',
            formula=f"Pd = A * fcd = {s.area:.0f} × {fcd:.1f} / 1000 = {Pd:.1f} kN",
            notes=f"Governing: {governing_axis}-axis, λ = {governing_lambda:.1f}"
        )
        
        return Pd, check
    
    def _calculate_fcd(self, lambda_bar: float, axis: str) -> float:
        """Calculate design compressive stress fcd"""
        if lambda_bar <= 0.2:
            return self.fy / GAMMA_M0
        
        buckling_class = self.get_buckling_class(axis)
        alpha = self.get_imperfection_factor(buckling_class)
        
        phi = 0.5 * (1 + alpha * (lambda_bar - 0.2) + lambda_bar**2)
        
        chi = 1 / (phi + math.sqrt(phi**2 - lambda_bar**2))
        chi = min(chi, 1.0)
        
        fcd = chi * self.fy / GAMMA_M0
        
        return fcd
    
    # ============================================
    # FLEXURAL DESIGN (Clause 8)
    # ============================================
    
    def get_moment_capacity(
        self,
        geometry: MemberGeometry,
        axis: str = 'z'  # 'z' for major axis, 'y' for minor
    ) -> Tuple[float, DesignCheck]:
        """
        Calculate bending moment capacity per Clause 8
        
        For laterally supported beams:
        Md = βb × Zp × fy / γm0
        
        For laterally unsupported beams:
        Md = βb × Zp × fbd
        """
        s = self.section
        sec_class = self.classify_section()
        
        if axis == 'z':
            Ze = s.Zz
            Zp = s.Zpz
        else:
            Ze = s.Zy
            Zp = s.Zpy
        
        # Shape factor βb based on section class
        if sec_class == SectionClass.PLASTIC:
            beta_b = 1.0
            Z_eff = Zp
        elif sec_class == SectionClass.COMPACT:
            beta_b = 1.0
            Z_eff = Zp
        elif sec_class == SectionClass.SEMI_COMPACT:
            beta_b = Ze / Zp if Zp > 0 else 1.0
            Z_eff = Ze
        else:
            # Slender - use effective section properties
            beta_b = Ze / Zp if Zp > 0 else 1.0
            Z_eff = Ze * 0.8  # Simplified reduction
        
        # Check for lateral torsional buckling
        Lu = geometry.unbraced_length or geometry.length
        
        if axis == 'z' and Lu > 0:
            # Calculate LTB reduction
            Mcr = self._calculate_elastic_critical_moment(geometry)
            lambda_LT = math.sqrt(beta_b * Zp * self.fy / Mcr) if Mcr > 0 else 0
            
            if lambda_LT > 0.4:
                # Apply LTB reduction
                alpha_LT = 0.21  # For rolled sections
                phi_LT = 0.5 * (1 + alpha_LT * (lambda_LT - 0.2) + lambda_LT**2)
                chi_LT = 1 / (phi_LT + math.sqrt(phi_LT**2 - lambda_LT**2))
                chi_LT = min(chi_LT, 1.0)
                fbd = chi_LT * self.fy / GAMMA_M0
            else:
                fbd = self.fy / GAMMA_M0
        else:
            fbd = self.fy / GAMMA_M0
        
        Md = beta_b * Z_eff * fbd / 1e6  # kNm
        
        # Limit to plastic moment capacity
        Md = min(Md, 1.2 * Ze * self.fy / GAMMA_M0 / 1e6)
        
        check = DesignCheck(
            check_name=f"Moment Capacity ({axis}-axis)",
            clause="IS 800, Cl. 8.2",
            demand=0,
            capacity=Md,
            ratio=0,
            status='PASS',
            formula=f"Md = βb × Z × fbd = {beta_b:.2f} × {Z_eff:.0f} × {fbd:.1f} = {Md:.1f} kNm",
            notes=f"Section class: {sec_class.name}"
        )
        
        return Md, check
    
    def _calculate_elastic_critical_moment(
        self,
        geometry: MemberGeometry
    ) -> float:
        """
        Calculate elastic critical moment Mcr for LTB
        per Clause 8.2.2.1
        """
        s = self.section
        E = self.E
        # Shear modulus: G = E / (2(1+ν))
        # Use ν = 0.30 for structural steel unless project-specific value is provided.
        G = E / (2.0 * (1.0 + 0.30))
        
        Lu = geometry.unbraced_length or geometry.length
        Cb = geometry.Cb
        
        # Section properties
        Iy = s.Iy
        h = s.depth
        tf = s.flange_thickness
        
        # Warping constant (approximate for I-section)
        Iw = Iy * (h - tf)**2 / 4
        
        # Torsional constant (approximate)
        tw = s.web_thickness
        d = h - 2 * tf
        It = (2 * s.width * tf**3 + d * tw**3) / 3
        
        # Elastic critical moment
        term1 = math.pi**2 * E * Iy / Lu**2
        term2 = Iw / Iy + Lu**2 * G * It / (math.pi**2 * E * Iy)
        
        Mcr = Cb * math.sqrt(term1 * term2) if term2 > 0 else 0
        
        return Mcr * 1e-6  # Convert to kNm consistent units
    
    # ============================================
    # SHEAR DESIGN (Clause 8.4)
    # ============================================
    
    def get_shear_capacity(self, axis: str = 'y') -> Tuple[float, DesignCheck]:
        """
        Calculate shear capacity per Clause 8.4
        
        Vd = Av × fyw / (√3 × γm0)
        """
        s = self.section
        
        if axis == 'y':
            # Shear in plane of web (major axis bending)
            Av = s.depth * s.web_thickness
        else:
            # Shear in plane of flanges
            Av = 2 * s.width * s.flange_thickness
        
        # Design shear strength
        tau_yw = self.fy / math.sqrt(3)
        Vd = Av * tau_yw / GAMMA_M0 / 1000  # kN
        
        check = DesignCheck(
            check_name=f"Shear Capacity ({axis}-axis)",
            clause="IS 800, Cl. 8.4",
            demand=0,
            capacity=Vd,
            ratio=0,
            status='PASS',
            formula=f"Vd = Av × fy / (√3 × γm0) = {Av:.0f} × {tau_yw:.1f} / {GAMMA_M0} = {Vd:.1f} kN"
        )
        
        return Vd, check
    
    # ============================================
    # COMBINED FORCES (Clause 9)
    # ============================================
    
    def check_interaction(
        self,
        forces: DesignForces,
        geometry: MemberGeometry
    ) -> DesignCheck:
        """
        Check combined axial + bending per Clause 9
        
        For tension + bending:
        N/Nd + My/Mdy + Mz/Mdz ≤ 1.0
        
        For compression + bending (amplified moments):
        N/Nd + Cmy×My/(Mdy(1-N/Ncry)) + Cmz×Mz/(Mdz(1-N/Ncrz)) ≤ 1.0
        """
        s = self.section
        N = abs(forces.N)
        My = abs(forces.My)
        Mz = abs(forces.Mz)
        
        is_tension = forces.N > 0
        
        if is_tension:
            # Tension + bending
            Nd, _ = self.get_tension_capacity()
            Mdy, _ = self.get_moment_capacity(geometry, 'y')
            Mdz, _ = self.get_moment_capacity(geometry, 'z')
            
            ratio = N / Nd + My / max(Mdy, 0.001) + Mz / max(Mdz, 0.001)
            
            formula = f"N/Nd + My/Mdy + Mz/Mdz = {N:.1f}/{Nd:.1f} + {My:.1f}/{Mdy:.1f} + {Mz:.1f}/{Mdz:.1f} = {ratio:.3f}"
            clause = "IS 800, Cl. 9.3.1"
        else:
            # Compression + bending
            Nd, _ = self.get_compression_capacity(geometry)
            Mdy, _ = self.get_moment_capacity(geometry, 'y')
            Mdz, _ = self.get_moment_capacity(geometry, 'z')
            
            # Euler buckling loads
            Ley = geometry.effective_length_y or geometry.length
            Lez = geometry.effective_length_z or geometry.length
            
            Ncry = math.pi**2 * self.E * s.Iy / (Ley**2) / 1000  # kN
            Ncrz = math.pi**2 * self.E * s.Iz / (Lez**2) / 1000  # kN
            
            # Moment amplification factors
            Cmy = Cmz = 0.9  # Conservative for uniform moment
            
            # Avoid division by zero
            amp_y = 1 / (1 - N / max(Ncry, N + 1))
            amp_z = 1 / (1 - N / max(Ncrz, N + 1))
            
            term1 = N / Nd
            term2 = Cmy * My * amp_y / max(Mdy, 0.001)
            term3 = Cmz * Mz * amp_z / max(Mdz, 0.001)
            
            ratio = term1 + term2 + term3
            
            formula = f"N/Nd + Cm×M/(Md×(1-N/Ncr)) = {term1:.3f} + {term2:.3f} + {term3:.3f} = {ratio:.3f}"
            clause = "IS 800, Cl. 9.3.2"
        
        status = 'PASS' if ratio <= 1.0 else 'FAIL'
        
        return DesignCheck(
            check_name="Combined Axial + Bending",
            clause=clause,
            demand=ratio,
            capacity=1.0,
            ratio=ratio,
            status=status,
            formula=formula
        )
    
    # ============================================
    # COMPLETE DESIGN CHECK
    # ============================================
    
    def design_member(
        self,
        member_id: str,
        forces: DesignForces,
        geometry: MemberGeometry
    ) -> SteelDesignResult:
        """
        Perform complete design check for a steel member
        """
        checks = []
        
        # Section classification
        sec_class = self.classify_section()
        
        # Tension capacity
        Td, tension_check = self.get_tension_capacity()
        
        # Compression capacity
        Pd, compression_check = self.get_compression_capacity(geometry)
        
        # Moment capacities
        Mdz, moment_z_check = self.get_moment_capacity(geometry, 'z')
        Mdy, moment_y_check = self.get_moment_capacity(geometry, 'y')
        
        # Shear capacity
        Vd, shear_check = self.get_shear_capacity()
        
        # Update checks with actual demands
        if forces.N > 0:
            tension_check.demand = forces.N
            tension_check.ratio = forces.N / Td if Td > 0 else 0
            tension_check.status = 'PASS' if tension_check.ratio <= 1.0 else 'FAIL'
            checks.append(tension_check)
        elif forces.N < 0:
            compression_check.demand = abs(forces.N)
            compression_check.ratio = abs(forces.N) / Pd if Pd > 0 else 0
            compression_check.status = 'PASS' if compression_check.ratio <= 1.0 else 'FAIL'
            checks.append(compression_check)
        
        if abs(forces.Mz) > 0.01:
            moment_z_check.demand = abs(forces.Mz)
            moment_z_check.ratio = abs(forces.Mz) / Mdz if Mdz > 0 else 0
            moment_z_check.status = 'PASS' if moment_z_check.ratio <= 1.0 else 'FAIL'
            checks.append(moment_z_check)
        
        if abs(forces.My) > 0.01:
            moment_y_check.demand = abs(forces.My)
            moment_y_check.ratio = abs(forces.My) / Mdy if Mdy > 0 else 0
            moment_y_check.status = 'PASS' if moment_y_check.ratio <= 1.0 else 'FAIL'
            checks.append(moment_y_check)
        
        if abs(forces.Vy) > 0.01:
            shear_check.demand = abs(forces.Vy)
            shear_check.ratio = abs(forces.Vy) / Vd if Vd > 0 else 0
            shear_check.status = 'PASS' if shear_check.ratio <= 1.0 else 'FAIL'
            checks.append(shear_check)
        
        # Interaction check
        if (abs(forces.N) > 0.01) and (abs(forces.Mz) > 0.01 or abs(forces.My) > 0.01):
            interaction_check = self.check_interaction(forces, geometry)
            checks.append(interaction_check)
        
        # Find governing check
        if checks:
            governing = max(checks, key=lambda c: c.ratio)
            governing_ratio = governing.ratio
            governing_check = governing.check_name
            overall_status = 'FAIL' if any(c.status == 'FAIL' for c in checks) else 'PASS'
        else:
            governing_ratio = 0
            governing_check = "None"
            overall_status = 'PASS'
        
        return SteelDesignResult(
            member_id=member_id,
            section=self.section,
            section_class=sec_class,
            checks=checks,
            governing_check=governing_check,
            governing_ratio=governing_ratio,
            overall_status=overall_status,
            Nd_tension=Td,
            Nd_compression=Pd,
            Md_z=Mdz,
            Md_y=Mdy,
            Vd=Vd
        )
    
    # ============================================
    # OPTIMIZATION (MEMBER SELECTION)
    # ============================================
    
    @staticmethod
    def select_optimum_section(
        forces: DesignForces,
        geometry: MemberGeometry,
        available_sections: List[SectionProperties],
        steel_grade: SteelGrade = SteelGrade.E250
    ) -> Optional[SteelDesignResult]:
        """
        Select the lightest section that satisfies all design checks
        
        Args:
            forces: Design forces
            geometry: Member geometry
            available_sections: List of available sections (sorted by weight)
            steel_grade: Steel grade
            
        Returns:
            SteelDesignResult for the selected section, or None if no section works
        """
        # Sort sections by area (weight proxy)
        sorted_sections = sorted(available_sections, key=lambda s: s.area)
        
        for section in sorted_sections:
            designer = IS800Designer(section, steel_grade)
            result = designer.design_member("SELECT", forces, geometry)
            
            if result.overall_status == 'PASS':
                return result
        
        return None
