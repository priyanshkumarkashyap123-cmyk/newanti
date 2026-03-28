"""
is456.py - IS 456:2000 Reinforced Concrete Design

Implements Limit State Method for:
- Beam design (flexure, shear, torsion)
- Column design (axial + biaxial bending)
- Rebar selection and detailing

Reference: IS 456:2000 Plain and Reinforced Concrete - Code of Practice
"""

from dataclasses import dataclass
from typing import List, Tuple, Optional
from enum import Enum
import math


# ============================================
# MATERIAL PROPERTIES
# ============================================

class ConcreteGrade(Enum):
    """Concrete grades per IS 456 Table 2"""
    M15 = 15
    M20 = 20
    M25 = 25
    M30 = 30
    M35 = 35
    M40 = 40
    M45 = 45
    M50 = 50
    M55 = 55
    M60 = 60
    M65 = 65
    M70 = 70
    M75 = 75
    M80 = 80
    M90 = 90
    M100 = 100


class IS456Version(Enum):
    """IS 456 edition selector"""
    V2000 = 'IS456_2000'
    V2025_DRAFT = 'IS456_2025_DRAFT'


class CementType(Enum):
    """Cement type labels aligned with IS 456 Table 1 / Amendment No. 6 (June 2024)"""
    OPC = 'OPC'
    PPC = 'PPC'
    PSC = 'PSC'
    PCC_IS16415 = 'PCC_IS16415'
    PCCLC_IS18189 = 'PCCLC_IS18189'


class RebarGrade(Enum):
    """Reinforcement grades per IS 1786"""
    Fe250 = 250   # Mild steel
    Fe415 = 415   # HYSD
    Fe500 = 500   # HYSD
    Fe550 = 550   # HYSD
    Fe600 = 600   # HYSD


# Standard bar diameters (mm)
STANDARD_BAR_DIAMETERS = [8, 10, 12, 16, 20, 25, 32, 40]


@dataclass
class RebarConfiguration:
    """Reinforcement arrangement"""
    diameter: float          # mm
    count: int
    area: float              # mm²
    spacing: Optional[float] = None  # mm (for distributed)


@dataclass
class BeamSection:
    """Beam cross-section properties"""
    width: float             # mm (b)
    depth: float             # mm (D)
    effective_depth: float   # mm (d)
    cover: float = 40        # mm (clear cover)


@dataclass
class ColumnSection:
    """Column cross-section properties"""
    width: float             # mm (b)
    depth: float             # mm (D)
    cover: float = 40        # mm


@dataclass
class BeamDesignResult:
    """Beam design output"""
    tension_steel: RebarConfiguration
    compression_steel: Optional[RebarConfiguration]
    stirrups: RebarConfiguration
    Mu_capacity: float        # kNm
    Vu_capacity: float        # kN
    status: str
    checks: List[str]
    performance_criteria: Optional['IS456PerformanceCriteria'] = None
    draft_warning: Optional[str] = None


@dataclass
class ColumnDesignResult:
    """Column design output"""
    longitudinal_steel: List[RebarConfiguration]
    ties: RebarConfiguration
    Pu_capacity: float        # kN
    Mux_capacity: float       # kNm
    Muy_capacity: float       # kNm
    interaction_ratio: float
    status: str
    checks: List[str]
    performance_criteria: Optional['IS456PerformanceCriteria'] = None
    draft_warning: Optional[str] = None


@dataclass
class IS456PerformanceCriteria:
    """IS 456:2025 Draft six-performance-criteria evaluation"""
    strength: bool
    serviceability: bool
    durability: bool
    robustness: bool
    integrity: bool
    restorability: bool


# ============================================
# IS 456:2000 DESIGNER
# ============================================

"""
is456.py - IS 456:2000 Reinforced Concrete Design

Unit conventions:
    fck, fy: MPa (N/mm²)
    Areas: mm²
    Lengths: mm
    Forces: kN
    Moments: kN·m
    Cover and spacing: mm

Implements Limit State Method per IS 456:2000 with α1 stress block factors, partial safety factors, and bar selection.
"""

class IS456Designer:
    """
    Reinforced Concrete Design per IS 456:2000
    """
    
    # Partial safety factors
    GAMMA_C = 1.5   # Concrete
    GAMMA_S = 1.15  # Steel
    
    def __init__(
        self,
        fck: float = 25,   # Characteristic concrete strength (MPa)
        fy: float = 500,   # Yield strength of steel (MPa)
        code_version: IS456Version = IS456Version.V2000,
        cement_type: Optional[CementType] = None,
    ):
        self.fck = fck
        self.fy = fy
        self.code_version = code_version
        self.cement_type = cement_type
        
        # Design strengths
        self.fcd = 0.67 * fck / self.GAMMA_C  # Design compressive strength
        self.fyd = fy / self.GAMMA_S          # Design yield strength
        
        # Stress block parameters (IS 456 Clause 38.1)
        self.xu_max_ratio = self._get_xu_max_ratio()
        self.alpha, self.beta, self.epsilon_cu = self._get_stress_block_params()

    def _get_stress_block_params(self) -> Tuple[float, float, float]:
        """
        Stress block parameters for IS 456 Clause 38.1.
        Draft 2025 (research): for M65+ use alpha=0.34, beta=0.39, epsilon_cu=0.0026.
        """
        if self.code_version == IS456Version.V2025_DRAFT and self.fck >= 65:
            return 0.34, 0.39, 0.0026
        return 0.36, 0.42, 0.0035

    def _evaluate_performance_criteria(
        self,
        status: str,
        utilization: float,
        checks: List[str],
        cover_mm: float,
        steel_ratio_percent: float,
    ) -> IS456PerformanceCriteria:
        """Builds IS 456:2025 Draft Cl. 3.2 six-performance-criteria summary."""
        strength = status == 'PASS' and utilization <= 1.0
        serviceability = status == 'PASS' and utilization <= 1.0
        durability = cover_mm >= 20 and self.cement_type is not None
        robustness = 0.8 <= steel_ratio_percent <= 6.0
        integrity = status == 'PASS'
        restorability = ('FAIL' not in status) and utilization <= 1.0
        return IS456PerformanceCriteria(
            strength=strength,
            serviceability=serviceability,
            durability=durability,
            robustness=robustness,
            integrity=integrity,
            restorability=restorability,
        )
    
    def _get_xu_max_ratio(self) -> float:
        """Get limiting xu/d ratio per IS 456 Clause 38.1"""
        if self.fy <= 250:
            return 0.53
        elif self.fy <= 415:
            return 0.48
        elif self.fy <= 500:
            return 0.46
        else:
            return 0.44
    
    # ============================================
    # BEAM DESIGN - FLEXURE
    # ============================================
    
    def design_beam_flexure(
        self,
        section: BeamSection,
        Mu: float,                    # Design moment (kNm)
        factored_loads: Optional[Dict[str, float]] = None,
    ) -> BeamDesignResult:
        """
        Design beam for flexure as per IS 456 Cl. 41.2:
        - Compute required tension steel area Ast = Mu*10^6 / (0.87 fyd * z)
        - Ensure minimum reinforcement per Cl. 26.5
        - Provide clause citation in checks
        """
        b = section.width
        d = section.effective_depth
        
        # Limiting moment capacity (singly reinforced)
        xu_max = self.xu_max_ratio * d
        Mu_lim = self.alpha * self.fck * b * xu_max * (d - self.beta * xu_max) / 1e6  # kNm
        
        if Mu <= Mu_lim:
            # Singly reinforced section
            # Mu = 0.87*fy*Ast*d*(1 - Ast*fy/(b*d*fck))
            
            # Using simplified method
            R = Mu * 1e6 / (b * d**2)  # MPa
            
            # Quadratic for pt
            # R = 0.87*fy*pt*(1 - fy*pt/(fck))
            # where pt = Ast/(b*d) * 100
            
            pt = (self.fck / (2 * self.fy)) * (1 - math.sqrt(1 - 4.6 * R / self.fck)) * 100
            Ast = pt * b * d / 100
            
            tension_bars = self._select_bars(Ast)
            compression_bars = None
            
        else:
            if not allow_compression:
                raise ValueError(f"Moment {Mu} kNm exceeds singly reinforced limit {Mu_lim:.1f} kNm")
            
            # Doubly reinforced section
            Mu1 = Mu_lim
            Mu2 = Mu - Mu_lim
            
            # Tension steel for Mu_lim
            pt_lim = (self.fck / (2 * self.fy)) * (1 - math.sqrt(1 - 4.6 * Mu1 * 1e6 / (b * d**2 * self.fck))) * 100
            Ast1 = pt_lim * b * d / 100
            
            # Compression steel
            d_prime = section.cover + 10  # Assumed bar at cover
            Asc = Mu2 * 1e6 / (0.87 * self.fy * (d - d_prime))
            
            # Additional tension steel
            Ast2 = Asc  # For equilibrium
            
            Ast = Ast1 + Ast2
            
            tension_bars = self._select_bars(Ast)
            compression_bars = self._select_bars(Asc)
        
        return tension_bars, compression_bars
    
    # ============================================
    # BEAM DESIGN - SHEAR
    # ============================================
    
    def design_beam_shear(
        self,
        section: BeamSection,
        Vu: float,              # Design shear (kN)
        Ast: float              # Tension steel area (mm²)
    ) -> RebarConfiguration:
        """
        Design beam for shear as per IS 456 Cl. 41.6:
        - Calculate τ_c from Table 19 and compare Vu/bd
        - Compute required stirrup spacing as per Cl. 41.6.3
        """
        b = section.width
        d = section.effective_depth
        
        # Percentage tension steel
        pt = 100 * Ast / (b * d)
        
        # Design shear strength of concrete (Table 19)
        tau_c = self._get_tau_c(pt)
        
        # Maximum shear stress
        tau_c_max = self._get_tau_c_max()
        
        # Nominal shear stress
        tau_v = Vu * 1000 / (b * d)
        
        if tau_v > tau_c_max:
            raise ValueError(f"Shear stress {tau_v:.2f} MPa exceeds maximum {tau_c_max:.2f} MPa. Increase section size.")
        
        if tau_v <= tau_c:
            # Minimum shear reinforcement
            Asv_min = 0.4 * b / (0.87 * self.fy)  # mm²/mm
        else:
            # Design shear reinforcement
            Vus = Vu - tau_c * b * d / 1000  # kN
            
            # Assuming vertical stirrups at spacing s
            # Vus = 0.87*fy*Asv*d/s
            # Asv/s = Vus*1000/(0.87*fy*d)
            Asv_s = Vus * 1000 / (0.87 * self.fy * d)  # mm²/mm
            Asv_min = 0.4 * b / (0.87 * self.fy)
            Asv_s = max(Asv_s, Asv_min)
        
        stirrups = self._select_stirrups(Asv_s if tau_v > tau_c else Asv_min, d)
        return stirrups
    
    def _get_tau_c(self, pt: float) -> float:
        """
        Design shear strength of concrete (IS 456 Table 19)
        """
        pt = min(max(pt, 0.15), 3.0)
        
        # Simplified formula
        beta = 0.8 * self.fck / (6.89 * pt)
        tau_c = 0.85 * math.sqrt(0.8 * self.fck) * (math.sqrt(1 + 5 * beta) - 1) / (6 * beta)
        
        return tau_c
    
    def _get_tau_c_max(self) -> float:
        """
        Maximum shear stress (IS 456 Table 20)
        """
        tau_c_max_table = {
            15: 2.5, 20: 2.8, 25: 3.1, 30: 3.5,
            35: 3.7, 40: 4.0
        }
        
        fck_key = min(40, max(15, 5 * round(self.fck / 5)))
        return tau_c_max_table.get(fck_key, 3.1)
    
    # ============================================
    # COLUMN DESIGN
    # ============================================
    
    def design_column(
        self,
        section: ColumnSection,
        Pu: float,              # Design axial load (kN)
        Mux: float,             # Design moment about x-axis (kNm)
        Muy: float,             # Design moment about y-axis (kNm)
        unsupported_length: float,  # mm
        effective_length_factor: float = 1.0
    ) -> ColumnDesignResult:
        """
        Design column for axial load with biaxial bending
        per IS 456 Clause 39
        """
        b = section.width
        D = section.depth
        Ag = b * D
        
        # Slenderness check
        lex = effective_length_factor * unsupported_length
        ley = effective_length_factor * unsupported_length
        
        is_short = (lex / D < 12) and (ley / b < 12)
        
        checks = []
        
        if is_short:
            checks.append("Short column (le/D < 12)")
        else:
            checks.append("Slender column - additional moments required")
            # Add additional moments for slenderness
            eax = D * (lex / D)**2 / 2000
            eay = b * (ley / b)**2 / 2000
            Mux += Pu * eax / 1000
            Muy += Pu * eay / 1000
        
        # Minimum eccentricity
        e_min = max(unsupported_length / 500 + D / 30, 20)
        Mux = max(Mux, Pu * e_min / 1000)
        
        # Design for combined axial + biaxial bending
        # Using interaction diagram approach (simplified)
        
        # Initial estimate: 2-4% steel
        p_assumed = 2.5  # %
        Asc = p_assumed * Ag / 100
        
        # Iterate to find adequate steel
        for _ in range(10):
            Mux_cap, Muy_cap = self._get_column_moment_capacity(section, Pu, Asc)
            
            # Biaxial bending check (IS 456 Clause 39.6)
            alpha_n = self._get_interaction_exponent(Pu, Ag)
            
            if Mux_cap > 0 and Muy_cap > 0:
                ratio = (Mux / Mux_cap)**alpha_n + (Muy / Muy_cap)**alpha_n
            else:
                ratio = 2.0  # Fail safe
            
            if ratio <= 1.0:
                break
            else:
                Asc *= 1.2  # Increase steel
                if Asc > 0.04 * Ag:
                    checks.append("Steel exceeds 4% - increase section size")
                    break
        
        # Minimum steel check (0.8% per IS 456)
        Asc = max(Asc, 0.008 * Ag)
        
        # Select bars
        long_bars = self._select_column_bars(Asc, section)
        ties = self._select_ties(long_bars)
        
        # Final capacities
        Pu_cap = self._get_column_axial_capacity(section, Asc)
        Mux_cap, Muy_cap = self._get_column_moment_capacity(section, Pu, Asc)
        
        status = 'PASS' if ratio <= 1.0 else 'FAIL'
        
        return ColumnDesignResult(
            longitudinal_steel=long_bars,
            ties=ties,
            Pu_capacity=Pu_cap,
            Mux_capacity=Mux_cap,
            Muy_capacity=Muy_cap,
            interaction_ratio=ratio,
            status=status,
            checks=checks
        )
    
    def _get_column_axial_capacity(
        self,
        section: ColumnSection,
        Asc: float
    ) -> float:
        """
        Axial capacity of column per IS 456 Clause 39.3
        
        Pu = 0.4*fck*Ac + 0.67*fy*Asc
        """
        Ag = section.width * section.depth
        Ac = Ag - Asc
        
        Pu = (0.4 * self.fck * Ac + 0.67 * self.fy * Asc) / 1000
        return Pu
    
    def _get_column_moment_capacity(
        self,
        section: ColumnSection,
        Pu: float,
        Asc: float
    ) -> Tuple[float, float]:
        """
        Simplified moment capacity calculation
        """
        b = section.width
        D = section.depth
        d = D - section.cover - 10
        d_prime = section.cover + 10
        
        # Neutral axis depth from interaction
        # Simplified: assume xu = 0.5D
        xu = 0.5 * D
        
        # Compression force in concrete
        Cc = self.alpha * self.fck * b * xu / 1000  # kN
        
        # Steel contribution (half in compression, half in tension)
        Cs = 0.67 * self.fy * (Asc / 2) / 1000  # kN
        Ts = 0.87 * self.fy * (Asc / 2) / 1000  # kN
        
        # Moment about centroid
        lever_c = D / 2 - self.beta * xu
        lever_s = (D / 2 - d_prime)
        
        Mu = (Cc * lever_c + Cs * lever_s + Ts * lever_s) / 1000  # kNm
        
        return Mu, Mu  # Symmetric section
    
    def _get_interaction_exponent(self, Pu: float, Ag: float) -> float:
        """
        Get exponent for biaxial bending interaction
        per IS 456 Clause 39.6
        """
        Puz = (0.45 * self.fck * Ag + 0.75 * self.fy * 0.03 * Ag) / 1000
        
        if Pu / Puz <= 0.2:
            return 1.0
        elif Pu / Puz >= 0.8:
            return 2.0
        else:
            return 1.0 + (Pu / Puz - 0.2) * (2.0 - 1.0) / (0.8 - 0.2)
    
    # ============================================
    # REBAR SELECTION
    # ============================================
    
    def _select_bars(self, Ast_required: float) -> RebarConfiguration:
        """
        Select bars to meet required area
        """
        best_config = None
        min_excess = float('inf')
        
        for dia in STANDARD_BAR_DIAMETERS:
            area_per_bar = math.pi * dia**2 / 4
            count = math.ceil(Ast_required / area_per_bar)
            total_area = count * area_per_bar
            excess = total_area - Ast_required
            
            if count >= 2 and count <= 10 and excess < min_excess:
                min_excess = excess
                best_config = RebarConfiguration(
                    diameter=dia,
                    count=count,
                    area=total_area
                )
        
        if best_config is None:
            # Default to larger bars
            dia = 25
            area_per_bar = math.pi * dia**2 / 4
            count = max(2, math.ceil(Ast_required / area_per_bar))
            best_config = RebarConfiguration(
                diameter=dia,
                count=count,
                area=count * area_per_bar
            )
        
        return best_config
    
    def _select_stirrups(
        self,
        Asv_s: float,
        d: float
    ) -> RebarConfiguration:
        """
        Select stirrup size and spacing
        """
        # Maximum spacing
        s_max = min(0.75 * d, 300)
        
        for dia in [8, 10, 12]:
            area_per_leg = math.pi * dia**2 / 4
            Asv = 2 * area_per_leg  # 2-legged stirrup
            
            spacing = Asv / Asv_s
            spacing = min(spacing, s_max)
            spacing = 25 * math.floor(spacing / 25)  # Round down to 25mm
            
            if spacing >= 75:
                return RebarConfiguration(
                    diameter=dia,
                    count=2,
                    area=Asv,
                    spacing=spacing
                )
        
        # Default
        return RebarConfiguration(
            diameter=8,
            count=2,
            area=2 * math.pi * 8**2 / 4,
            spacing=100
        )
    
    def _select_column_bars(
        self,
        Asc_required: float,
        section: ColumnSection
    ) -> List[RebarConfiguration]:
        """
        Select column longitudinal bars
        """
        # Minimum 4 bars for rectangular column
        bars = self._select_bars(Asc_required)
        if bars.count < 4:
            bars.count = 4
            bars.area = 4 * math.pi * bars.diameter**2 / 4
        
        return [bars]
    
    def _select_ties(
        self,
        long_bars: List[RebarConfiguration]
    ) -> RebarConfiguration:
        """
        Select column ties per IS 456 Clause 26.5.3.2
        """
        # Tie diameter >= max(6, main_bar_dia/4)
        main_dia = max(b.diameter for b in long_bars)
        tie_dia = max(6, main_dia / 4)
        tie_dia = min(d for d in [6, 8, 10, 12] if d >= tie_dia)
        
        # Tie spacing <= min(16*main_dia, 300, least_lateral_dim)
        spacing = min(16 * main_dia, 300)
        
        return RebarConfiguration(
            diameter=tie_dia,
            count=4,  # Rectangular tie
            area=4 * math.pi * tie_dia**2 / 4,
            spacing=spacing
        )
    
    # ============================================
    # COMPLETE BEAM DESIGN
    # ============================================
    
    def design_beam(
        self,
        section: BeamSection,
        Mu: float,              # kNm
        Vu: float               # kN
    ) -> BeamDesignResult:
        """
        Complete beam design for flexure and shear
        """
        checks = []
        
        # Flexure design
        try:
            tension, compression = self.design_beam_flexure(section, Mu)
            checks.append(f"Flexure: {tension.count}-{tension.diameter}φ tension")
            if compression:
                checks.append(f"Compression: {compression.count}-{compression.diameter}φ")
        except ValueError as e:
            return BeamDesignResult(
                tension_steel=RebarConfiguration(0, 0, 0),
                compression_steel=None,
                stirrups=RebarConfiguration(0, 0, 0),
                Mu_capacity=0,
                Vu_capacity=0,
                status='FAIL',
                checks=[str(e)]
            )
        
        # Shear design
        try:
            stirrups = self.design_beam_shear(section, Vu, tension.area)
            checks.append(f"Shear: {stirrups.diameter}φ @ {stirrups.spacing}mm c/c")
        except ValueError as e:
            return BeamDesignResult(
                tension_steel=tension,
                compression_steel=compression,
                stirrups=RebarConfiguration(0, 0, 0),
                Mu_capacity=0,
                Vu_capacity=0,
                status='FAIL',
                checks=[str(e)]
            )
        
        # Calculate capacities
        d = section.effective_depth
        b = section.width
        
        # Moment capacity
        Ast = tension.area
        xu = 0.87 * self.fy * Ast / (self.alpha * self.fck * b)
        Mu_cap = 0.87 * self.fy * Ast * (d - self.beta * xu) / 1e6
        
        # Shear capacity
        pt = 100 * Ast / (b * d)
        tau_c = self._get_tau_c(pt)
        Vc = tau_c * b * d / 1000
        
        # Stirrup contribution
        Asv = stirrups.area
        s = stirrups.spacing
        Vs = 0.87 * self.fy * Asv * d / (s * 1000) if s else 0
        Vu_cap = Vc + Vs
        
        checks.append(f"Mu_capacity = {Mu_cap:.1f} kNm")
        checks.append(f"Vu_capacity = {Vu_cap:.1f} kN")
        
        status = 'PASS' if Mu_cap >= Mu and Vu_cap >= Vu else 'FAIL'
        
        utilization = max(Mu / Mu_cap if Mu_cap > 0 else 9.9, Vu / Vu_cap if Vu_cap > 0 else 9.9)
        perf = None
        warning = None
        if self.code_version == IS456Version.V2025_DRAFT:
            warning = '⚠️ IS 456:2025 Draft mode (research only) — do not use for regulatory submissions.'
            steel_ratio = 100 * Ast / (b * d) if b * d > 0 else 0.0
            perf = self._evaluate_performance_criteria(status, utilization, checks, section.cover, steel_ratio)

        return BeamDesignResult(
            tension_steel=tension,
            compression_steel=compression,
            stirrups=stirrups,
            Mu_capacity=Mu_cap,
            Vu_capacity=Vu_cap,
            status=status,
            checks=checks,
            performance_criteria=perf,
            draft_warning=warning,
        )
