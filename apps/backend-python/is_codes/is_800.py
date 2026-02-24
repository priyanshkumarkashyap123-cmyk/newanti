"""
IS 800:2007 - Indian Standard for Steel Design

Implements steel member design checks per IS 800:2007 (Third Revision)
Limit State Method

Key Clauses:
- Clause 5: Materials
- Clause 6: Tension Members
- Clause 7: Design of Compression Members
- Clause 8: Design of Members in Bending
- Clause 9: Members Subjected to Combined Forces

Units: All in SI (N, mm, MPa)
"""

from dataclasses import dataclass
from typing import Dict, Optional, Tuple, List, Any
from enum import Enum
import math


# ============================================
# SECTION CLASSIFICATION (Clause 3.7)
# ============================================

class SectionClass(Enum):
    """Section classification per IS 800:2007 Table 2"""
    PLASTIC = "plastic"         # Class 1 - Can form plastic hinge
    COMPACT = "compact"         # Class 2 - Can develop plastic moment but limited rotation
    SEMI_COMPACT = "semi_compact"  # Class 3 - Elastic limit governs
    SLENDER = "slender"         # Class 4 - Local buckling governs


# ============================================
# MATERIAL GRADES (Clause 5 & Table 1)
# ============================================

@dataclass
class SteelGrade:
    """Steel material properties per IS 2062"""
    name: str
    fy: float   # Yield stress (MPa)
    fu: float   # Ultimate stress (MPa)
    E: float = 200000.0   # Young's modulus (MPa)
    G: float = 77000.0    # Shear modulus (MPa)
    

# Standard Indian steel grades (IS 2062:2011)
STEEL_GRADES = {
    "E250": SteelGrade("E250", fy=250, fu=410),
    "E300": SteelGrade("E300", fy=300, fu=440),
    "E350": SteelGrade("E350", fy=350, fu=490),
    "E410": SteelGrade("E410", fy=410, fu=540),
    "E450": SteelGrade("E450", fy=450, fu=570),
    "Fe250": SteelGrade("Fe250", fy=250, fu=410),  # Legacy name
    "Fe410": SteelGrade("Fe410", fy=250, fu=410),  # Legacy - fy for thickness <= 20mm
    "Fe490": SteelGrade("Fe490", fy=350, fu=490),
}


# ============================================
# SECTION DATABASE (ISMB, ISMC, ISA)
# ============================================

@dataclass
class SteelSection:
    """Steel section properties"""
    name: str
    A: float        # Area (mm²)
    Ix: float       # Moment of inertia about major axis (mm⁴)
    Iy: float       # Moment of inertia about minor axis (mm⁴)
    Zx: float       # Elastic section modulus major (mm³)
    Zy: float       # Elastic section modulus minor (mm³)
    Zpx: float      # Plastic section modulus major (mm³)
    Zpy: float      # Plastic section modulus minor (mm³)
    rx: float       # Radius of gyration major (mm)
    ry: float       # Radius of gyration minor (mm)
    d: float        # Overall depth (mm)
    bf: float       # Flange width (mm)
    tf: float       # Flange thickness (mm)
    tw: float       # Web thickness (mm)


# ISMB Sections (Indian Standard Medium Weight Beams)
ISMB_SECTIONS: Dict[str, SteelSection] = {
    "ISMB100": SteelSection("ISMB100", A=1160, Ix=2.57e6, Iy=0.254e6, 
                            Zx=51.4e3, Zy=7.62e3, Zpx=59.5e3, Zpy=12.0e3,
                            rx=47.1, ry=14.8, d=100, bf=75, tf=7.2, tw=4.0),
    "ISMB150": SteelSection("ISMB150", A=1760, Ix=7.26e6, Iy=0.67e6,
                            Zx=96.8e3, Zy=17.2e3, Zpx=112e3, Zpy=27.0e3,
                            rx=64.2, ry=19.5, d=150, bf=80, tf=7.6, tw=4.8),
    "ISMB200": SteelSection("ISMB200", A=2540, Ix=22.15e6, Iy=1.37e6,
                            Zx=221.5e3, Zy=30.4e3, Zpx=255e3, Zpy=47.5e3,
                            rx=93.3, ry=23.2, d=200, bf=100, tf=10.8, tw=5.7),
    "ISMB250": SteelSection("ISMB250", A=4260, Ix=51.31e6, Iy=3.34e6,
                            Zx=410.5e3, Zy=53.4e3, Zpx=476e3, Zpy=83.5e3,
                            rx=109.7, ry=28.0, d=250, bf=125, tf=12.5, tw=6.9),
    "ISMB300": SteelSection("ISMB300", A=5690, Ix=98.22e6, Iy=5.13e6,
                            Zx=654.8e3, Zy=76.1e3, Zpx=764e3, Zpy=119e3,
                            rx=131.4, ry=30.0, d=300, bf=140, tf=12.4, tw=7.5),
    "ISMB350": SteelSection("ISMB350", A=6760, Ix=142.9e6, Iy=6.30e6,
                            Zx=816.5e3, Zy=87.5e3, Zpx=960e3, Zpy=137e3,
                            rx=145.4, ry=30.5, d=350, bf=140, tf=14.2, tw=8.1),
    "ISMB400": SteelSection("ISMB400", A=7880, Ix=204.5e6, Iy=7.86e6,
                            Zx=1022.5e3, Zy=103.9e3, Zpx=1202e3, Zpy=163e3,
                            rx=161.1, ry=31.6, d=400, bf=140, tf=16.0, tw=8.9),
    "ISMB450": SteelSection("ISMB450", A=9050, Ix=303.9e6, Iy=13.5e6,
                            Zx=1351.0e3, Zy=150e3, Zpx=1584e3, Zpy=234e3,
                            rx=183.3, ry=38.6, d=450, bf=150, tf=17.4, tw=9.4),
    "ISMB500": SteelSection("ISMB500", A=11100, Ix=452.2e6, Iy=15.2e6,
                            Zx=1808.8e3, Zy=169e3, Zpx=2130e3, Zpy=264e3,
                            rx=201.9, ry=37.0, d=500, bf=180, tf=17.2, tw=10.2),
    "ISMB550": SteelSection("ISMB550", A=13200, Ix=649.0e6, Iy=18.3e6,
                            Zx=2360e3, Zy=192e3, Zpx=2795e3, Zpy=300e3,
                            rx=221.5, ry=37.2, d=550, bf=190, tf=19.3, tw=11.2),
    "ISMB600": SteelSection("ISMB600", A=15600, Ix=918.0e6, Iy=26.5e6,
                            Zx=3060e3, Zy=265e3, Zpx=3625e3, Zpy=414e3,
                            rx=242.5, ry=41.2, d=600, bf=210, tf=23.6, tw=12.0),
}


# ============================================
# DESIGN RESULT
# ============================================

@dataclass
class DesignResult:
    """Result of a design check"""
    passed: bool
    utilization: float  # Demand/Capacity ratio
    capacity: float     # Design capacity
    demand: float       # Applied force/moment
    clause: str         # IS 800 clause reference
    message: str        # Detailed message
    details: Dict = None  # Additional calculation details


# ============================================
# PARTIAL SAFETY FACTORS (Clause 5.4.1)
# ============================================

GAMMA_M0 = 1.10  # Resistance governed by yielding
GAMMA_M1 = 1.25  # Resistance governed by buckling
GAMMA_MW = 1.25  # Resistance of welds
GAMMA_MB = 1.25  # Resistance of bolts


# ============================================
# TENSION MEMBER DESIGN (Clause 6)
# ============================================

def design_tension_member(
    section: SteelSection,
    steel: SteelGrade,
    Tu: float,  # Factored tensile force (kN)
    An: Optional[float] = None,  # Net area (mm²), defaults to gross area
    connection_type: str = "welded"  # "welded", "bolted_one_leg", "bolted_two_legs"
) -> DesignResult:
    """
    Design check for tension member per IS 800:2007 Clause 6
    
    Args:
        section: Steel section properties
        steel: Steel grade
        Tu: Factored tensile force (kN)
        An: Net area at critical section (mm²)
        connection_type: Type of connection
    
    Returns:
        DesignResult with capacity check
    """
    Tu_N = Tu * 1000  # Convert to N
    Ag = section.A
    An = An or Ag
    
    # Design strength (Clause 6.2)
    # Tdg = Ag × fy / γm0 (Yielding of gross section)
    Tdg = (Ag * steel.fy) / GAMMA_M0
    
    # Tdn = 0.9 × An × fu / γm1 (Rupture of net section)
    Tdn = (0.9 * An * steel.fu) / GAMMA_M1
    
    # Block shear - simplified (full calculation needs connection geometry)
    # For now, use minimum of Tdg and Tdn
    Td = min(Tdg, Tdn) / 1000  # Convert back to kN
    
    utilization = Tu / Td
    passed = utilization <= 1.0
    
    return DesignResult(
        passed=passed,
        utilization=utilization,
        capacity=Td,
        demand=Tu,
        clause="IS 800:2007 Clause 6.2",
        message=f"Tension: {Tu:.1f} kN / {Td:.1f} kN = {utilization:.2f}",
        details={
            "Tdg_kN": Tdg / 1000,
            "Tdn_kN": Tdn / 1000,
            "governing": "yielding" if Tdg < Tdn else "rupture"
        }
    )


# ============================================
# COMPRESSION MEMBER DESIGN (Clause 7)
# ============================================

def get_buckling_class(section_type: str, axis: str, tf: float) -> str:
    """
    Get buckling class per IS 800:2007 Table 10
    
    Args:
        section_type: "rolled_i", "welded_i", "hollow"
        axis: "major" (z-z) or "minor" (y-y)
        tf: Flange thickness (mm)
    """
    if section_type == "rolled_i":
        if tf <= 40:
            return "a" if axis == "major" else "b"
        else:
            return "b" if axis == "major" else "c"
    elif section_type == "welded_i":
        if tf <= 40:
            return "b" if axis == "major" else "c"
        else:
            return "c" if axis == "major" else "d"
    elif section_type == "hollow":
        return "a"
    else:
        return "c"  # Conservative default


def get_imperfection_factor(buckling_class: str) -> float:
    """Get imperfection factor α per IS 800:2007 Table 7"""
    factors = {
        "a": 0.21,
        "b": 0.34,
        "c": 0.49,
        "d": 0.76
    }
    return factors.get(buckling_class, 0.49)


def design_compression_member(
    section: SteelSection,
    steel: SteelGrade,
    Pu: float,  # Factored compressive force (kN)
    Lx: float,  # Effective length about major axis (mm)
    Ly: float,  # Effective length about minor axis (mm)
    section_type: str = "rolled_i"
) -> DesignResult:
    """
    Design check for compression member per IS 800:2007 Clause 7
    
    Args:
        section: Steel section properties
        steel: Steel grade
        Pu: Factored compressive force (kN)
        Lx: Effective length about major axis (mm)
        Ly: Effective length about minor axis (mm)
        section_type: "rolled_i", "welded_i", or "hollow"
    
    Returns:
        DesignResult with capacity check
    """
    Pu_N = Pu * 1000  # Convert to N
    
    # Slenderness ratios (Clause 7.1.2)
    lambda_x = Lx / section.rx
    lambda_y = Ly / section.ry
    
    # Maximum slenderness limit check (Clause 3.8)
    lambda_max = max(lambda_x, lambda_y)
    if lambda_max > 180:
        return DesignResult(
            passed=False,
            utilization=float('inf'),
            capacity=0,
            demand=Pu,
            clause="IS 800:2007 Clause 3.8",
            message=f"Slenderness {lambda_max:.0f} exceeds limit of 180",
            details={"lambda_x": lambda_x, "lambda_y": lambda_y}
        )
    
    # Calculate design compressive stress for each axis
    results = []
    for axis, lambda_val, r, L in [("major", lambda_x, section.rx, Lx), 
                                    ("minor", lambda_y, section.ry, Ly)]:
        
        # Euler buckling stress (Clause 7.1.2.1)
        fcc = (math.pi ** 2 * steel.E) / (lambda_val ** 2) if lambda_val > 0 else float('inf')
        
        # Non-dimensional slenderness (Clause 7.1.2.1)
        lambda_nd = math.sqrt(steel.fy / fcc) if fcc > 0 else 0
        
        # Buckling class and imperfection factor
        bc = get_buckling_class(section_type, axis, section.tf)
        alpha = get_imperfection_factor(bc)
        
        # Design compressive stress (Clause 7.1.2.1)
        phi = 0.5 * (1 + alpha * (lambda_nd - 0.2) + lambda_nd ** 2)
        chi = 1.0 / (phi + math.sqrt(phi ** 2 - lambda_nd ** 2))
        chi = min(chi, 1.0)  # Cannot exceed 1
        
        fcd = chi * steel.fy / GAMMA_M0
        
        results.append({
            "axis": axis,
            "lambda": lambda_val,
            "lambda_nd": lambda_nd,
            "buckling_class": bc,
            "chi": chi,
            "fcd_MPa": fcd
        })
    
    # Governing axis (lower capacity)
    governing = min(results, key=lambda r: r["fcd_MPa"])
    fcd = governing["fcd_MPa"]
    
    # Design compressive strength
    Pd = (section.A * fcd) / 1000  # kN
    
    utilization = Pu / Pd
    passed = utilization <= 1.0
    
    return DesignResult(
        passed=passed,
        utilization=utilization,
        capacity=Pd,
        demand=Pu,
        clause="IS 800:2007 Clause 7.1.2",
        message=f"Compression ({governing['axis']} axis): {Pu:.1f} kN / {Pd:.1f} kN = {utilization:.2f}",
        details={
            "lambda_x": lambda_x,
            "lambda_y": lambda_y,
            "governing_axis": governing["axis"],
            "fcd_MPa": fcd,
            "chi": governing["chi"]
        }
    )


# ============================================
# FLEXURE DESIGN (Clause 8)
# ============================================

def design_flexure_member(
    section: SteelSection,
    steel: SteelGrade,
    Mu: float,  # Factored bending moment (kN·m)
    Lb: float,  # Laterally unbraced length (mm)
    section_class: SectionClass = SectionClass.COMPACT
) -> DesignResult:
    """
    Design check for flexure per IS 800:2007 Clause 8
    
    Args:
        section: Steel section properties
        steel: Steel grade
        Mu: Factored bending moment (kN·m)
        Lb: Laterally unbraced length (mm)
        section_class: Section classification
    
    Returns:
        DesignResult with capacity check
    """
    Mu_Nmm = Mu * 1e6  # Convert to N·mm
    
    # Plastic moment capacity (Clause 8.2.1.2)
    if section_class in [SectionClass.PLASTIC, SectionClass.COMPACT]:
        Md_yielding = (section.Zpx * steel.fy) / GAMMA_M0  # N·mm
    else:
        Md_yielding = (section.Zx * steel.fy) / GAMMA_M0  # N·mm
    
    # Lateral torsional buckling check (Clause 8.2.2)
    # Elastic critical moment (Clause 8.2.2.1)
    # Simplified formula for doubly symmetric I-sections
    hf = section.d - section.tf  # Distance between flange centroids
    
    # Torsional constant (approximate)
    It = (2 * section.bf * section.tf**3 + (section.d - 2*section.tf) * section.tw**3) / 3
    
    # Warping constant (approximate for I-section)
    Iw = section.Iy * hf**2 / 4
    
    # Elastic critical moment
    Mcr_term1 = (math.pi**2 * steel.E * section.Iy) / (Lb**2)
    Mcr_term2 = steel.G * It + (math.pi**2 * steel.E * Iw) / (Lb**2)
    Mcr = math.sqrt(Mcr_term1 * Mcr_term2) if Mcr_term2 > 0 else float('inf')
    
    # Non-dimensional slenderness for LTB
    beta_b = 1.0 if section_class in [SectionClass.PLASTIC, SectionClass.COMPACT] else section.Zx / section.Zpx
    Mp = beta_b * section.Zpx * steel.fy
    lambda_LT = math.sqrt(Mp / Mcr) if Mcr > 0 else 0
    
    # LTB reduction factor (Clause 8.2.2)
    if lambda_LT <= 0.4:
        chi_LT = 1.0
    else:
        alpha_LT = 0.21  # Rolled sections
        phi_LT = 0.5 * (1 + alpha_LT * (lambda_LT - 0.2) + lambda_LT**2)
        chi_LT = 1.0 / (phi_LT + math.sqrt(phi_LT**2 - lambda_LT**2))
        chi_LT = min(chi_LT, 1.0)
    
    Md_LTB = chi_LT * Mp / GAMMA_M0  # N·mm
    
    # Design moment capacity (lower of yielding and LTB)
    Md = min(Md_yielding, Md_LTB) / 1e6  # kN·m
    
    utilization = Mu / Md
    passed = utilization <= 1.0
    
    governing = "yielding" if Md_yielding < Md_LTB else "lateral_torsional_buckling"
    
    return DesignResult(
        passed=passed,
        utilization=utilization,
        capacity=Md,
        demand=Mu,
        clause="IS 800:2007 Clause 8.2",
        message=f"Flexure ({governing}): {Mu:.1f} kN·m / {Md:.1f} kN·m = {utilization:.2f}",
        details={
            "Md_yielding_kNm": Md_yielding / 1e6,
            "Md_LTB_kNm": Md_LTB / 1e6,
            "lambda_LT": lambda_LT,
            "chi_LT": chi_LT,
            "governing": governing,
            "Mcr_Nmm": Mcr
        }
    )


# ============================================
# COMBINED FORCES (Clause 9.3)
# ============================================

def design_combined_forces(
    section: SteelSection,
    steel: SteelGrade,
    Pu: float,   # Factored axial force (kN), positive = compression
    Mux: float,  # Factored moment about major axis (kN·m)
    Muy: float,  # Factored moment about minor axis (kN·m)
    Lx: float,   # Effective length about major axis (mm)
    Ly: float,   # Effective length about minor axis (mm)
    Lb: float,   # Laterally unbraced length (mm)
    section_class: SectionClass = SectionClass.COMPACT
) -> DesignResult:
    """
    Design check for combined axial + bending per IS 800:2007 Clause 9.3
    
    Uses interaction equation:
    P/Pd + CMx*Mx/Mdx + CMy*My/Mdy ≤ 1.0
    
    Args:
        section: Steel section properties
        steel: Steel grade
        Pu: Factored axial force (kN)
        Mux: Factored moment about major axis (kN·m)
        Muy: Factored moment about minor axis (kN·m)
        Lx: Effective length about major axis (mm)
        Ly: Effective length about minor axis (mm)
        Lb: Laterally unbraced length (mm)
    
    Returns:
        DesignResult with interaction check
    """
    # Get individual capacities
    compression_result = design_compression_member(section, steel, abs(Pu), Lx, Ly)
    Pd = compression_result.capacity
    
    flexure_result_x = design_flexure_member(section, steel, abs(Mux), Lb, section_class)
    Mdx = flexure_result_x.capacity
    
    # For minor axis bending, no LTB
    if section_class in [SectionClass.PLASTIC, SectionClass.COMPACT]:
        Mdy = (section.Zpy * steel.fy) / (GAMMA_M0 * 1e6)  # kN·m
    else:
        Mdy = (section.Zy * steel.fy) / (GAMMA_M0 * 1e6)  # kN·m
    
    # Moment amplification factors (simplified - assumes no sway)
    # Cm = 1.0 for uniform moment, 0.6 for gradient
    Cmx = 0.85
    Cmy = 0.85
    
    # Interaction equation (Clause 9.3.2.2)
    term1 = abs(Pu) / Pd if Pd > 0 else 0
    term2 = Cmx * abs(Mux) / Mdx if Mdx > 0 else 0
    term3 = Cmy * abs(Muy) / Mdy if Mdy > 0 else 0
    
    utilization = term1 + term2 + term3
    passed = utilization <= 1.0
    
    return DesignResult(
        passed=passed,
        utilization=utilization,
        capacity=1.0,  # Interaction limit
        demand=utilization,
        clause="IS 800:2007 Clause 9.3.2.2",
        message=f"Combined: P/Pd={term1:.2f} + Mx/Mdx={term2:.2f} + My/Mdy={term3:.2f} = {utilization:.2f}",
        details={
            "Pd_kN": Pd,
            "Mdx_kNm": Mdx,
            "Mdy_kNm": Mdy,
            "P_ratio": term1,
            "Mx_ratio": term2,
            "My_ratio": term3
        }
    )


# ============================================
# SECTION CLASSIFICATION (Clause 3.7)
# ============================================

def classify_section(section: SteelSection, steel: SteelGrade) -> SectionClass:
    """
    Classify section per IS 800:2007 Table 2
    
    Based on b/tf ratio for flanges and d/tw for web
    """
    epsilon = math.sqrt(250 / steel.fy)
    
    # Flange b/tf ratio (outstand element)
    b_outstand = (section.bf - section.tw) / 2
    flange_ratio = b_outstand / section.tf
    
    # Web d/tw ratio
    web_depth = section.d - 2 * section.tf
    web_ratio = web_depth / section.tw
    
    # Flange limits from Table 2 (rolled I-sections, compression flange)
    if flange_ratio <= 9.4 * epsilon:
        flange_class = SectionClass.PLASTIC
    elif flange_ratio <= 10.5 * epsilon:
        flange_class = SectionClass.COMPACT
    elif flange_ratio <= 15.7 * epsilon:
        flange_class = SectionClass.SEMI_COMPACT
    else:
        flange_class = SectionClass.SLENDER
    
    # Web limits (assuming bending, webs in bending)
    if web_ratio <= 84 * epsilon:
        web_class = SectionClass.PLASTIC
    elif web_ratio <= 105 * epsilon:
        web_class = SectionClass.COMPACT
    elif web_ratio <= 126 * epsilon:
        web_class = SectionClass.SEMI_COMPACT
    else:
        web_class = SectionClass.SLENDER
    
    # Section class is the worst of flange and web
    classes = [SectionClass.PLASTIC, SectionClass.COMPACT, 
               SectionClass.SEMI_COMPACT, SectionClass.SLENDER]
    
    return max([flange_class, web_class], key=lambda c: classes.index(c))


# ============================================
# CONVENIENCE FUNCTION
# ============================================

def check_member_is800(
    section_name: str,
    steel_grade: str,
    Pu: float = 0,       # Axial force (kN), positive = compression
    Mux: float = 0,      # Major axis moment (kN·m)
    Muy: float = 0,      # Minor axis moment (kN·m)
    Lx: float = 3000,    # Major axis effective length (mm)
    Ly: float = 3000,    # Minor axis effective length (mm)
    Lb: float = 3000,    # Laterally unbraced length (mm)
) -> Dict[str, Any]:
    """
    Complete IS 800 design check for a member.
    
    Args:
        section_name: ISMB section name (e.g., "ISMB300")
        steel_grade: Steel grade (e.g., "E250", "E350")
        Pu: Factored axial force (kN)
        Mux: Factored major axis moment (kN·m)
        Muy: Factored minor axis moment (kN·m)
        Lx: Major axis effective length (mm)
        Ly: Minor axis effective length (mm)
        Lb: Laterally unbraced length (mm)
    
    Returns:
        Dict with all design check results
    """
    # Get section and steel grade
    section = ISMB_SECTIONS.get(section_name.upper())
    if not section:
        return {"error": f"Unknown section: {section_name}"}
    
    steel = STEEL_GRADES.get(steel_grade)
    if not steel:
        return {"error": f"Unknown steel grade: {steel_grade}"}
    
    # Classify section
    section_class = classify_section(section, steel)
    
    results = {
        "section": section_name,
        "steel": steel_grade,
        "section_class": section_class.value,
        "checks": []
    }
    
    # Individual checks based on loading
    if Pu > 0 and Mux == 0 and Muy == 0:
        # Pure compression
        check = design_compression_member(section, steel, Pu, Lx, Ly)
        results["checks"].append(check.__dict__)
        
    elif Pu < 0 and Mux == 0 and Muy == 0:
        # Pure tension
        check = design_tension_member(section, steel, abs(Pu))
        results["checks"].append(check.__dict__)
        
    elif Pu == 0 and (Mux != 0 or Muy != 0):
        # Pure bending
        if Mux != 0:
            check = design_flexure_member(section, steel, abs(Mux), Lb, section_class)
            results["checks"].append(check.__dict__)
        # Add minor axis check if needed
        
    else:
        # Combined forces
        check = design_combined_forces(
            section, steel, Pu, Mux, Muy, Lx, Ly, Lb, section_class
        )
        results["checks"].append(check.__dict__)
    
    # Overall result
    all_passed = all(c.get("passed", True) for c in results["checks"])
    max_utilization = max((c.get("utilization", 0) for c in results["checks"]), default=0)
    
    results["passed"] = all_passed
    results["max_utilization"] = max_utilization
    
    return results


# ============================================
# EXAMPLE USAGE
# ============================================

if __name__ == "__main__":
    # Example: Check ISMB300 column with axial load and moment
    result = check_member_is800(
        section_name="ISMB300",
        steel_grade="E250",
        Pu=500,      # 500 kN compression
        Mux=100,     # 100 kN·m moment
        Muy=20,      # 20 kN·m minor moment
        Lx=4000,     # 4m effective length
        Ly=4000,
        Lb=4000
    )
    
    print(f"Section: {result['section']}")
    print(f"Steel: {result['steel']}")
    print(f"Class: {result['section_class']}")
    print(f"Passed: {result['passed']}")
    print(f"Max Utilization: {result['max_utilization']:.2%}")
    
    for check in result['checks']:
        print(f"  {check['clause']}: {check['message']}")
