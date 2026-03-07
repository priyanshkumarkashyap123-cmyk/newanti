"""
section_wise_design.py - Section-Wise Design Engine

STRUCTURAL ENGINEERING PHILOSOPHY:
──────────────────────────────────
"Designing for maximum values at a single critical section is SAFE but not
always ECONOMICAL. The applied stress at ANY section must be less than the
strength of that section — it may or may not be at the maximum values."

This module implements section-by-section checking and design:

1. Divides the member into discrete sections along its length
2. Computes demand (M, V) at each section from the load/force envelope
3. Designs reinforcement required at each section independently
4. Determines curtailment points where bars can be terminated
5. Provides development length checks at curtailment locations
6. Produces a complete rebar schedule that is SAFE at every section
   and ECONOMICAL by not over-reinforcing low-demand regions

Reference Codes:
- IS 456:2000 Clause 26.2.3  (Development Length)
- IS 456:2000 Clause 26.2.3.2 (Bar Curtailment)
- IS 456:2000 Clause 22.4     (Shear at sections)
- ACI 318-19 Section 9.7.3    (Development & curtailment)
"""

from dataclasses import dataclass, field
from typing import List, Tuple, Optional, Dict
import math


# ============================================
# DATA MODELS
# ============================================

@dataclass
class SectionLocation:
    """A discrete section along the member length"""
    x: float              # Distance from left support (mm)
    x_ratio: float        # x / L (0.0 to 1.0)
    label: str = ""       # e.g. "Left Support", "Midspan", "L/4"


@dataclass
class SectionDemand:
    """Force demands at a specific section"""
    location: SectionLocation
    Mu: float             # Bending moment at this section (kNm) — SIGNED
    Vu: float             # Shear force at this section (kN) — SIGNED
    moment_type: str      # 'sagging', 'hogging', 'neutral'


@dataclass
class SectionCapacity:
    """Capacity provided at a specific section"""
    location: SectionLocation
    Mu_capacity: float    # Moment capacity at this section (kNm)
    Vu_capacity: float    # Shear capacity at this section (kN)
    Ast_bottom: float     # Bottom steel area at this section (mm²)
    Ast_top: float        # Top steel area at this section (mm²)
    stirrup_spacing: float  # Stirrup spacing at this section (mm)
    utilization_M: float  # Moment utilization ratio (demand/capacity)
    utilization_V: float  # Shear utilization ratio (demand/capacity)
    status: str           # 'PASS' or 'FAIL'


@dataclass
class CurtailmentPoint:
    """Point where reinforcement can be terminated"""
    x: float              # Distance from left support (mm)
    bar_description: str  # Which bars are curtailed
    Ld_required: float    # Development length required (mm)
    Ld_available: float   # Development length available (mm)
    is_valid: bool        # True if Ld_available >= Ld_required
    clause: str           # Code reference clause


@dataclass
class RebarZone:
    """A region of the member with specific reinforcement"""
    x_start: float        # Start position (mm)
    x_end: float          # End position (mm)
    bottom_bars: str      # e.g. "4-16φ" or "2-16φ"
    top_bars: str         # e.g. "2-12φ" or "2-16φ"
    stirrup_spec: str     # e.g. "8φ @ 150 c/c"
    Ast_bottom: float     # mm²
    Ast_top: float        # mm²
    note: str = ""


@dataclass
class SectionWiseResult:
    """Complete section-wise design output"""
    n_sections: int
    section_checks: List[SectionCapacity]
    curtailment_points: List[CurtailmentPoint]
    rebar_zones: List[RebarZone]
    max_section: SectionCapacity        # Critical (governing) section
    is_safe_everywhere: bool            # True if ALL sections pass
    economy_ratio: float                # Max-steel / Avg-steel (>1 = savings from curtailment)
    summary: str                        # Human-readable summary
    engineering_notes: List[str]        # Design philosophy notes
    checks: List[str]                   # All code checks performed


# ============================================
# DEMAND ENVELOPE GENERATORS
# ============================================

def generate_simply_supported_demands(
    L: float,           # Span (mm)
    w: float,            # UDL intensity (kN/m) — factored
    n_sections: int = 11  # Number of discrete sections (must be >= 3)
) -> List[SectionDemand]:
    """
    Generate M and V at discrete sections for a simply-supported beam with UDL.
    
    M(x) = (w*x/2) * (L - x)   [parabolic]
    V(x) = w*(L/2 - x)          [linear]
    
    Sign convention: Sagging(+), Hogging(-)
    At supports: M = 0, V = ±wL/2
    At midspan:  M = wL²/8, V = 0
    """
    L_m = L / 1000  # Convert to m for load calc
    sections = []
    
    for i in range(n_sections):
        x = i * L / (n_sections - 1)
        x_ratio = x / L if L > 0 else 0
        x_m = x / 1000
        
        # Bending moment (kNm) — parabolic distribution
        Mu = (w * x_m / 2) * (L_m - x_m)
        
        # Shear force (kN) — linear distribution
        Vu = w * (L_m / 2 - x_m)
        
        # Label
        if x_ratio < 0.01:
            label = "Left Support"
        elif x_ratio > 0.99:
            label = "Right Support"
        elif abs(x_ratio - 0.5) < 0.01:
            label = "Midspan"
        elif abs(x_ratio - 0.25) < 0.01:
            label = "L/4"
        elif abs(x_ratio - 0.75) < 0.01:
            label = "3L/4"
        else:
            label = f"x={x_ratio:.2f}L"
        
        moment_type = "sagging" if Mu > 0.001 else ("hogging" if Mu < -0.001 else "neutral")
        
        sections.append(SectionDemand(
            location=SectionLocation(x=x, x_ratio=x_ratio, label=label),
            Mu=Mu,
            Vu=Vu,
            moment_type=moment_type
        ))
    
    return sections


def generate_continuous_beam_demands(
    L: float,            # Span (mm)
    w: float,             # UDL intensity (kN/m) — factored
    end_condition: str = 'propped',  # 'propped', 'fixed-fixed', 'cantilever'
    n_sections: int = 11
) -> List[SectionDemand]:
    """
    Generate M and V at discrete sections for continuous/restrained beams.
    
    For propped cantilever:
        M(x) = (w*L²/8)*(4*ξ - 4*ξ² - ξ) where ξ = x/L (approx.)
        Hogging at fixed end, sagging at ~0.375L
    
    For fixed-fixed:
        M(x) = w*L²/12 * (6*ξ - 6*ξ² - 1)
        Hogging at both supports: wL²/12
        Sagging at midspan: wL²/24
    """
    L_m = L / 1000
    sections = []
    
    for i in range(n_sections):
        x = i * L / (n_sections - 1)
        x_ratio = x / L if L > 0 else 0
        xi = x_ratio
        
        if end_condition == 'fixed-fixed':
            # Fixed-Fixed: M = wL²(6ξ - 6ξ² - 1)/12
            Mu = w * L_m**2 * (6*xi - 6*xi**2 - 1) / 12
            # V = wL(1 - 2ξ)/2
            Vu = w * L_m * (1 - 2*xi) / 2
            
        elif end_condition == 'propped':
            # Propped Cantilever: Fixed left, pinned right
            # R_right = 3wL/8, R_left = 5wL/8
            R_left = 5 * w * L_m / 8
            # M(x) = R_left*x - w*x²/2  , with sign that hogging at left support
            Mu = R_left * (x/1000) - w * (x/1000)**2 / 2
            # Subtract fixed-end moment at x=0
            M_fixed = -w * L_m**2 / 8  # Hogging
            Mu = Mu + M_fixed
            Vu = R_left - w * (x/1000)
            
        elif end_condition == 'cantilever':
            # Cantilever: Fixed left, free right
            # M(x) = -w*(L-x)²/2  (hogging everywhere)
            x_m = x / 1000
            Mu = -w * (L_m - x_m)**2 / 2
            Vu = w * (L_m - x_m)
            
        else:
            # Default simply supported
            x_m = x / 1000
            Mu = (w * x_m / 2) * (L_m - x_m)
            Vu = w * (L_m / 2 - x_m)
        
        if x_ratio < 0.01:
            label = "Left Support"
        elif x_ratio > 0.99:
            label = "Right Support"
        elif abs(x_ratio - 0.5) < 0.01:
            label = "Midspan"
        else:
            label = f"x={x_ratio:.2f}L"
        
        moment_type = "sagging" if Mu > 0.001 else ("hogging" if Mu < -0.001 else "neutral")
        
        sections.append(SectionDemand(
            location=SectionLocation(x=x, x_ratio=x_ratio, label=label),
            Mu=Mu,
            Vu=Vu,
            moment_type=moment_type
        ))
    
    return sections


def generate_demands_from_forces(
    L: float,
    section_forces: List[Dict],
    n_sections: int = 11
) -> List[SectionDemand]:
    """
    Generate demands from user-supplied force arrays.
    
    section_forces: list of dicts with keys:
      - x: distance from left (mm)
      - Mu: moment (kNm)
      - Vu: shear (kN)
      
    If section_forces has different resolution than n_sections,
    we interpolate to match the requested number of sections.
    """
    if not section_forces:
        return []
    
    # Sort by x position
    sf = sorted(section_forces, key=lambda s: s.get('x', 0))
    
    # If user provided exactly what we need
    if len(sf) == n_sections:
        sections = []
        for s in sf:
            x = s['x']
            x_ratio = x / L if L > 0 else 0
            Mu = s.get('Mu', 0)
            Vu = s.get('Vu', 0)
            moment_type = "sagging" if Mu > 0.001 else ("hogging" if Mu < -0.001 else "neutral")
            
            if x_ratio < 0.01:
                label = "Left Support"
            elif x_ratio > 0.99:
                label = "Right Support"
            elif abs(x_ratio - 0.5) < 0.01:
                label = "Midspan"
            else:
                label = f"x={x_ratio:.2f}L"
            
            sections.append(SectionDemand(
                location=SectionLocation(x=x, x_ratio=x_ratio, label=label),
                Mu=Mu, Vu=Vu, moment_type=moment_type
            ))
        return sections
    
    # Otherwise, interpolate
    xs_user = [s['x'] for s in sf]
    Ms_user = [s.get('Mu', 0) for s in sf]
    Vs_user = [s.get('Vu', 0) for s in sf]
    
    sections = []
    for i in range(n_sections):
        x = i * L / (n_sections - 1)
        x_ratio = x / L if L > 0 else 0
        
        # Linear interpolation
        Mu = _interpolate(x, xs_user, Ms_user)
        Vu = _interpolate(x, xs_user, Vs_user)
        
        moment_type = "sagging" if Mu > 0.001 else ("hogging" if Mu < -0.001 else "neutral")
        
        if x_ratio < 0.01:
            label = "Left Support"
        elif x_ratio > 0.99:
            label = "Right Support"
        elif abs(x_ratio - 0.5) < 0.01:
            label = "Midspan"
        else:
            label = f"x={x_ratio:.2f}L"
        
        sections.append(SectionDemand(
            location=SectionLocation(x=x, x_ratio=x_ratio, label=label),
            Mu=Mu, Vu=Vu, moment_type=moment_type
        ))
    
    return sections


def _interpolate(x: float, xs: List[float], ys: List[float]) -> float:
    """Simple linear interpolation"""
    if x <= xs[0]:
        return ys[0]
    if x >= xs[-1]:
        return ys[-1]
    for i in range(len(xs) - 1):
        if xs[i] <= x <= xs[i + 1]:
            t = (x - xs[i]) / (xs[i + 1] - xs[i]) if xs[i + 1] != xs[i] else 0
            return ys[i] + t * (ys[i + 1] - ys[i])
    return ys[-1]


# ============================================
# SECTION-WISE DESIGN ENGINE
# ============================================

class SectionWiseDesigner:
    """
    Designs reinforcement at multiple sections along a member.
    
    Engineering Philosophy:
    ━━━━━━━━━━━━━━━━━━━━━━
    • Maximum values govern the critical section design
    • BUT every other section must also satisfy: demand ≤ capacity
    • Bars can be curtailed where no longer needed → economical
    • Development length must be provided beyond curtailment points
    • Stirrup spacing can be relaxed where shear demand reduces
    """
    
    # Partial safety factors (IS 456)
    GAMMA_C = 1.5
    GAMMA_S = 1.15
    
    # Standard bar diameters
    STANDARD_DIAMETERS = [8, 10, 12, 16, 20, 25, 32]
    
    def __init__(self, fck: float = 25, fy: float = 500, code: str = "IS456"):
        self.fck = fck
        self.fy = fy
        self.code = code
        self.fcd = 0.67 * fck / self.GAMMA_C
        self.fyd = fy / self.GAMMA_S
        
        # xu_max/d ratio
        if fy <= 250:
            self.xu_max_ratio = 0.53
        elif fy <= 415:
            self.xu_max_ratio = 0.48
        elif fy <= 500:
            self.xu_max_ratio = 0.46
        else:
            self.xu_max_ratio = 0.44
    
    def design_member_sectionwise(
        self,
        width: float,              # mm (beam width)
        depth: float,              # mm (overall depth)
        cover: float,              # mm (clear cover)
        span: float,               # mm (member span)
        demands: List[SectionDemand],
        n_sections: int = 11
    ) -> SectionWiseResult:
        """
        Perform section-by-section design.
        
        Steps:
        1. Compute required reinforcement at each section
        2. Design critical section first (max demand)
        3. Check every section: demand ≤ capacity
        4. Determine curtailment points
        5. Check development lengths
        6. Generate rebar schedule/zones
        """
        d = depth - cover - 10       # Effective depth (assuming 10mm dia/2)
        b = width
        
        engineering_notes = [
            "SECTION-WISE DESIGN (Safe + Economical)",
            f"Member divided into {len(demands)} sections for checking",
            "At each section: Applied force ≤ Section capacity",
            "Reinforcement curtailed where demand reduces → economy",
            "Development length checked at all curtailment points"
        ]
        all_checks = []
        
        # ── STEP 1: Compute required Ast at each section ──
        section_results: List[SectionCapacity] = []
        max_Ast_bottom = 0.0
        max_Ast_top = 0.0
        max_utilization = 0.0
        max_section_idx = 0
        
        for i, demand in enumerate(demands):
            Mu_abs = abs(demand.Mu)
            Vu_abs = abs(demand.Vu)
            
            # ── Flexure at this section ──
            Ast_required = self._compute_Ast_required(b, d, Mu_abs)
            Ast_min = max(0.85 * b * d / self.fy, 0.0012 * b * depth)
            Ast_required = max(Ast_required, Ast_min)
            
            # Assign to top or bottom based on moment type
            if demand.moment_type == 'hogging':
                Ast_top = Ast_required
                Ast_bottom = Ast_min  # Minimum on tension face
            else:
                Ast_bottom = Ast_required
                Ast_top = Ast_min * 0.5  # Nominal/holding bars
            
            # ── Moment capacity at this section (using Ast provided) ──
            Mu_cap = self._compute_Mu_capacity(b, d, max(Ast_bottom, Ast_top))
            
            # ── Shear at this section ──
            pt = 100 * Ast_bottom / (b * d) if (b * d) > 0 else 0
            tau_c = self._get_tau_c(pt)
            Vc = tau_c * b * d / 1000  # kN
            
            # Required stirrup contribution
            Vus = max(0, Vu_abs - Vc)
            stirrup_spacing = self._compute_stirrup_spacing(b, d, Vus)
            
            # Stirrup shear capacity
            Asv = 2 * math.pi * 8**2 / 4  # 8mm 2-legged
            Vs = 0.87 * self.fy * Asv * d / (stirrup_spacing * 1000) if stirrup_spacing > 0 else 0
            Vu_cap = Vc + Vs
            
            # Utilization ratios
            util_M = Mu_abs / Mu_cap if Mu_cap > 0 else (999 if Mu_abs > 0 else 0)
            util_V = Vu_abs / Vu_cap if Vu_cap > 0 else (999 if Vu_abs > 0 else 0)
            
            status = "PASS" if util_M <= 1.0 and util_V <= 1.0 else "FAIL"
            
            sc = SectionCapacity(
                location=demand.location,
                Mu_capacity=round(Mu_cap, 2),
                Vu_capacity=round(Vu_cap, 2),
                Ast_bottom=round(Ast_bottom, 1),
                Ast_top=round(Ast_top, 1),
                stirrup_spacing=round(stirrup_spacing, 0),
                utilization_M=round(util_M, 3),
                utilization_V=round(util_V, 3),
                status=status
            )
            section_results.append(sc)
            
            # Track maximums
            if Ast_bottom > max_Ast_bottom:
                max_Ast_bottom = Ast_bottom
            if Ast_top > max_Ast_top:
                max_Ast_top = Ast_top
            if max(util_M, util_V) > max_utilization:
                max_utilization = max(util_M, util_V)
                max_section_idx = i
            
            all_checks.append(
                f"Section {demand.location.label} (x={demand.location.x_ratio:.2f}L): "
                f"Mu={demand.Mu:.1f} kNm ({demand.moment_type}) ≤ Mu,cap={Mu_cap:.1f} kNm | "
                f"Vu={demand.Vu:.1f} kN ≤ Vu,cap={Vu_cap:.1f} kN → {status}"
            )
        
        # ── STEP 2: Determine rebar zones for curtailment ──
        rebar_zones, curtailment_points = self._compute_curtailment(
            section_results, demands, span, b, d, depth, cover
        )
        
        # ── STEP 3: Economy ratio ──
        avg_Ast = sum(sc.Ast_bottom for sc in section_results) / len(section_results) if section_results else 1
        economy_ratio = max_Ast_bottom / avg_Ast if avg_Ast > 0 else 1.0
        
        is_safe = all(sc.status == "PASS" for sc in section_results)
        
        # Summary
        n_pass = sum(1 for sc in section_results if sc.status == "PASS")
        n_total = len(section_results)
        critical = section_results[max_section_idx] if section_results else None
        
        economy_pct = (1 - 1/economy_ratio) * 100 if economy_ratio > 1 else 0
        
        summary = (
            f"Section-wise design: {n_pass}/{n_total} sections PASS. "
            f"Critical section at {critical.location.label if critical else 'N/A'} "
            f"(utilization {critical.utilization_M:.1%} flexure, {critical.utilization_V:.1%} shear). "
            f"Economy ratio: {economy_ratio:.2f} — curtailment saves ~{economy_pct:.0f}% steel vs uniform max design."
        )
        
        if not is_safe:
            summary += f" ⚠ {n_total - n_pass} section(s) FAIL — increase section size or reinforcement."
        
        engineering_notes.extend([
            f"Critical section: {critical.location.label if critical else 'N/A'} "
            f"with Ast_bottom={critical.Ast_bottom:.0f} mm²" if critical else "",
            f"Minimum Ast at low-demand sections: {min(sc.Ast_bottom for sc in section_results):.0f} mm²"
            if section_results else "",
            f"Potential steel saving by curtailment: ~{economy_pct:.0f}%",
            "All curtailment points checked for development length (Ld)"
        ])
        
        return SectionWiseResult(
            n_sections=n_total,
            section_checks=section_results,
            curtailment_points=curtailment_points,
            rebar_zones=rebar_zones,
            max_section=section_results[max_section_idx] if section_results else section_results[0],
            is_safe_everywhere=is_safe,
            economy_ratio=round(economy_ratio, 2),
            summary=summary,
            engineering_notes=engineering_notes,
            checks=all_checks
        )
    
    # ─────────────────────────────────
    # INTERNAL CALCULATION METHODS
    # ─────────────────────────────────
    
    def _compute_Ast_required(self, b: float, d: float, Mu_abs: float) -> float:
        """
        Required Ast for given Mu, using IS 456 flexure formula.
        Mu = 0.87*fy*Ast*d*(1 - Ast*fy/(b*d*fck))
        """
        if Mu_abs <= 0:
            return 0.0
        
        R = Mu_abs * 1e6 / (b * d**2)  # MPa
        
        disc = 1 - 4.6 * Mu_abs * 1e6 / (self.fck * b * d**2)
        if disc < 0:
            # Section is over-reinforced or requires compression steel
            xu_max = self.xu_max_ratio * d
            Mu_lim = 0.36 * self.fck * b * xu_max * (d - 0.42 * xu_max) / 1e6
            Ast_lim = 0.36 * self.fck * b * xu_max / (0.87 * self.fy)
            # Additional Ast for excess moment
            Mu_excess = Mu_abs - Mu_lim
            d_prime = 40 + 10  # Compression steel depth
            fsc = 0.87 * self.fy  # Simplified
            Ast_extra = Mu_excess * 1e6 / (fsc * (d - d_prime)) if (d - d_prime) > 0 else 0
            return Ast_lim + max(Ast_extra, 0)
        
        pt = 0.5 * self.fck / self.fy * (1 - math.sqrt(disc))
        Ast = pt * b * d
        return max(Ast, 0)
    
    def _compute_Mu_capacity(self, b: float, d: float, Ast: float) -> float:
        """Moment capacity for given Ast"""
        if Ast <= 0:
            return 0.0
        xu = 0.87 * self.fy * Ast / (0.36 * self.fck * b)
        xu = min(xu, self.xu_max_ratio * d)  # Limit to xu_max
        Mu_cap = 0.87 * self.fy * Ast * (d - 0.42 * xu) / 1e6
        return max(Mu_cap, 0)
    
    def _get_tau_c(self, pt: float) -> float:
        """
        Design shear strength of concrete per IS 456 Table 19
        """
        pt = max(0.15, min(pt, 3.0))
        
        # Approximate curve fit for M25 concrete
        tau_c_table = [
            (0.15, 0.28), (0.25, 0.36), (0.50, 0.48),
            (0.75, 0.56), (1.00, 0.62), (1.25, 0.67),
            (1.50, 0.72), (1.75, 0.75), (2.00, 0.79),
            (2.25, 0.81), (2.50, 0.82), (2.75, 0.84),
            (3.00, 0.85)
        ]
        
        # Scale for concrete grade
        grade_factor = min(max(self.fck / 25, 0.8), 1.3)
        
        # Linear interpolation
        for i in range(len(tau_c_table) - 1):
            p1, t1 = tau_c_table[i]
            p2, t2 = tau_c_table[i + 1]
            if p1 <= pt <= p2:
                t = (pt - p1) / (p2 - p1)
                return (t1 + t * (t2 - t1)) * grade_factor
        
        return tau_c_table[-1][1] * grade_factor
    
    def _compute_stirrup_spacing(self, b: float, d: float, Vus: float) -> float:
        """
        Compute stirrup spacing for given shear demand.
        Asv/sv ≥ Vus / (0.87 * fy * d)
        """
        s_max = min(0.75 * d, 300)
        
        if Vus <= 0.01:
            return s_max   # Only minimum stirrups needed
        
        # 8mm 2-legged stirrups
        Asv = 2 * math.pi * 8**2 / 4  # ~100.5 mm²
        Asv_s_required = Vus * 1000 / (0.87 * self.fy * d)
        
        if Asv_s_required <= 0:
            return s_max
        
        spacing = Asv / Asv_s_required
        spacing = min(spacing, s_max)
        spacing = max(25 * math.floor(spacing / 25), 75)  # Round down to 25mm, min 75mm
        
        return spacing
    
    def _get_development_length(self, bar_dia: float) -> float:
        """
        Development length per IS 456 Clause 26.2.1
        Ld = φ * σs / (4 * τbd)
        """
        tau_bd_table = {
            15: 1.6, 20: 1.92, 25: 2.24, 30: 2.4,
            35: 2.72, 40: 3.04, 45: 3.2, 50: 3.36
        }
        
        # Find closest fck
        fck_key = min(tau_bd_table.keys(), key=lambda k: abs(k - self.fck))
        tau_bd = tau_bd_table[fck_key]
        
        # For deformed bars, increase by 60%
        if self.fy > 250:
            tau_bd *= 1.6
        
        sigma_s = 0.87 * self.fy
        Ld = bar_dia * sigma_s / (4 * tau_bd)
        
        return Ld
    
    def _compute_curtailment(
        self,
        section_results: List[SectionCapacity],
        demands: List[SectionDemand],
        span: float,
        b: float,
        d: float,
        D: float,
        cover: float
    ) -> Tuple[List[RebarZone], List[CurtailmentPoint]]:
        """
        Determine where reinforcement can be curtailed and create zones.
        
        Engineering Rule:
        - Bars can be cut where demand drops to ≤ capacity of remaining bars
        - Must extend Ld beyond the theoretical cutoff point
        - At least 1/3 of max bottom steel must continue to support (IS 456 Cl. 26.2.3.3)
        """
        if len(section_results) < 3:
            # Too few sections, return single zone
            max_sc = max(section_results, key=lambda s: s.Ast_bottom)
            bar_dia, bar_count = self._select_bars_for_area(max_sc.Ast_bottom)
            return [RebarZone(
                x_start=0, x_end=span,
                bottom_bars=f"{bar_count}-{bar_dia}φ",
                top_bars="2-10φ nominal",
                stirrup_spec=f"8φ @ {max_sc.stirrup_spacing:.0f} c/c",
                Ast_bottom=max_sc.Ast_bottom,
                Ast_top=max_sc.Ast_top,
                note="Single zone — too few sections for curtailment"
            )], []
        
        # Find maximum Ast
        max_bottom = max(sc.Ast_bottom for sc in section_results)
        bar_dia_max, bar_count_max = self._select_bars_for_area(max_bottom)
        area_per_bar = math.pi * bar_dia_max**2 / 4
        
        # At least 1/3 must continue to support: floor(count/3) but ≥ 2
        min_continuing = max(2, math.ceil(bar_count_max / 3))
        curtailable_count = bar_count_max - min_continuing
        
        if curtailable_count <= 0:
            # Cannot curtail, single zone
            return [RebarZone(
                x_start=0, x_end=span,
                bottom_bars=f"{bar_count_max}-{bar_dia_max}φ",
                top_bars="2-10φ nominal",
                stirrup_spec=f"8φ @ {min(sc.stirrup_spacing for sc in section_results):.0f} c/c",
                Ast_bottom=max_bottom,
                Ast_top=section_results[0].Ast_top,
                note="Cannot curtail — minimum bars required everywhere"
            )], []
        
        # Determine Ld for this bar diameter
        Ld = self._get_development_length(bar_dia_max)
        
        # Find curtailment points: where demand drops enough
        # that remaining bars can carry the moment
        Ast_reduced = min_continuing * area_per_bar
        Mu_cap_reduced = self._compute_Mu_capacity(b, d, Ast_reduced)
        
        curtailment_points = []
        zones = []
        
        # Find from left side where moment exceeds reduced capacity
        left_cutoff = 0
        right_cutoff = span
        
        for i, (sc, dem) in enumerate(zip(section_results, demands)):
            if abs(dem.Mu) > Mu_cap_reduced and dem.moment_type == 'sagging':
                left_cutoff = sc.location.x
                break
        
        for i in range(len(section_results) - 1, -1, -1):
            sc = section_results[i]
            dem = demands[i]
            if abs(dem.Mu) > Mu_cap_reduced and dem.moment_type == 'sagging':
                right_cutoff = sc.location.x
                break
        
        # Theoretical cutoff adjusted by Ld + d (IS 456 Cl. 26.2.3.2(c))
        actual_left_cutoff = max(0, left_cutoff - Ld - d)
        actual_right_cutoff = min(span, right_cutoff + Ld + d)
        
        # Validate development length availability
        Ld_avail_left = left_cutoff
        Ld_avail_right = span - right_cutoff
        
        if curtailable_count > 0:
            curtailment_points.append(CurtailmentPoint(
                x=actual_left_cutoff,
                bar_description=f"{curtailable_count}-{bar_dia_max}φ start here (from left)",
                Ld_required=round(Ld, 0),
                Ld_available=round(Ld_avail_left, 0),
                is_valid=Ld_avail_left >= Ld,
                clause="IS 456 Cl. 26.2.3.2"
            ))
            
            curtailment_points.append(CurtailmentPoint(
                x=actual_right_cutoff,
                bar_description=f"{curtailable_count}-{bar_dia_max}φ end here (from right)",
                Ld_required=round(Ld, 0),
                Ld_available=round(Ld_avail_right, 0),
                is_valid=Ld_avail_right >= Ld,
                clause="IS 456 Cl. 26.2.3.2"
            ))
        
        # Create 3 zones: support-left, middle, support-right
        # Zone 1: Left support to curtailment start (fewer bars)
        if actual_left_cutoff > 0:
            zones.append(RebarZone(
                x_start=0,
                x_end=round(actual_left_cutoff, 0),
                bottom_bars=f"{min_continuing}-{bar_dia_max}φ",
                top_bars="2-10φ nominal",
                stirrup_spec=self._zone_stirrup_spec(section_results, 0, actual_left_cutoff),
                Ast_bottom=round(min_continuing * area_per_bar, 1),
                Ast_top=section_results[0].Ast_top if section_results else 0,
                note=f"Reduced zone (low demand near support)"
            ))
        
        # Zone 2: Middle zone (full bars — high demand)
        zones.append(RebarZone(
            x_start=round(actual_left_cutoff, 0),
            x_end=round(actual_right_cutoff, 0),
            bottom_bars=f"{bar_count_max}-{bar_dia_max}φ",
            top_bars="2-10φ nominal",
            stirrup_spec=self._zone_stirrup_spec(section_results, actual_left_cutoff, actual_right_cutoff),
            Ast_bottom=round(max_bottom, 1),
            Ast_top=section_results[len(section_results)//2].Ast_top if section_results else 0,
            note=f"Full reinforcement zone (critical demand region)"
        ))
        
        # Zone 3: Right support to curtailment end (fewer bars)
        if actual_right_cutoff < span:
            zones.append(RebarZone(
                x_start=round(actual_right_cutoff, 0),
                x_end=span,
                bottom_bars=f"{min_continuing}-{bar_dia_max}φ",
                top_bars="2-10φ nominal",
                stirrup_spec=self._zone_stirrup_spec(section_results, actual_right_cutoff, span),
                Ast_bottom=round(min_continuing * area_per_bar, 1),
                Ast_top=section_results[-1].Ast_top if section_results else 0,
                note=f"Reduced zone (low demand near support)"
            ))
        
        return zones, curtailment_points
    
    def _select_bars_for_area(self, Ast: float) -> Tuple[float, int]:
        """Returns (diameter, count) for a given area"""
        best_dia = 16
        best_count = 2
        min_excess = float('inf')
        
        for dia in self.STANDARD_DIAMETERS:
            area = math.pi * dia**2 / 4
            count = max(2, math.ceil(Ast / area))
            if count <= 10:
                excess = count * area - Ast
                if 0 <= excess < min_excess:
                    min_excess = excess
                    best_dia = dia
                    best_count = count
        
        return best_dia, best_count
    
    def _zone_stirrup_spec(
        self,
        section_results: List[SectionCapacity],
        x_start: float,
        x_end: float
    ) -> str:
        """Get the tightest stirrup spacing within a zone"""
        spacings = [
            sc.stirrup_spacing
            for sc in section_results
            if x_start <= sc.location.x <= x_end and sc.stirrup_spacing > 0
        ]
        if not spacings:
            return "8φ @ 200 c/c"
        min_spacing = min(spacings)
        return f"8φ @ {min_spacing:.0f} c/c"


# ============================================
# CONVENIENCE: COLUMN SECTION-WISE CHECK
# ============================================

def check_column_at_sections(
    width: float,
    depth: float,
    cover: float,
    height: float,
    Pu: float,
    Mux_top: float,
    Mux_bottom: float,
    Muy_top: float = 0,
    Muy_bottom: float = 0,
    fck: float = 25,
    fy: float = 500,
    n_sections: int = 5
) -> Dict:
    """
    Check column capacity at multiple sections along height.
    
    Moments vary linearly from top to bottom for a column under
    end moments. The critical section may be at:
    - Top (max moment end)
    - Bottom (if bottom moment is larger)
    - Middle (if P-delta effects are significant / slender column)
    
    This checks all sections and identifies the governing one.
    """
    from design.concrete.is456 import IS456Designer, ColumnSection
    
    designer = IS456Designer(fck=fck, fy=fy)
    section = ColumnSection(width=width, depth=depth, cover=cover)
    
    results = []
    governing_idx = 0
    max_ratio = 0
    
    for i in range(n_sections):
        t = i / (n_sections - 1) if n_sections > 1 else 0
        
        # Interpolate moments from top (t=0) to bottom (t=1)
        Mux_at = Mux_top + t * (Mux_bottom - Mux_top)
        Muy_at = Muy_top + t * (Muy_bottom - Muy_top)
        
        # For slender columns, add P-delta additional moment at mid-height
        # IS 456 Cl. 39.7.1: Additional moment Mac = (Pu * e_a)
        slenderness_x = height / depth
        slenderness_y = height / width
        e_ax = 0
        e_ay = 0
        if slenderness_x > 12:
            lex = height  # Simplified: effective length = height
            e_ax = depth * (lex / depth)**2 / 2000
        if slenderness_y > 12:
            ley = height
            e_ay = width * (ley / width)**2 / 2000
        
        # P-delta effect is maximum at mid-height
        pdelta_factor = 4 * t * (1 - t)  # Parabolic: 0 at top/bottom, 1 at mid
        Mux_at += Pu * e_ax * pdelta_factor / 1000
        Muy_at += Pu * e_ay * pdelta_factor / 1000
        
        # Design at this section
        res = designer.design_column(
            section=section,
            Pu=abs(Pu),
            Mux=abs(Mux_at),
            Muy=abs(Muy_at),
            unsupported_length=height,
            effective_length_factor=1.0
        )
        
        # Location label
        if t < 0.01:
            label = "Top"
        elif t > 0.99:
            label = "Bottom"
        elif abs(t - 0.5) < 0.05:
            label = "Mid-height"
        else:
            label = f"h={t:.2f}H"
        
        section_data = {
            "location": label,
            "height_ratio": round(t, 2),
            "Mux": round(Mux_at, 2),
            "Muy": round(Muy_at, 2),
            "Pu": round(Pu, 2),
            "interaction_ratio": round(res.interaction_ratio, 3),
            "status": res.status,
            "Ast_required": round(sum(b.area for b in res.longitudinal_steel), 0),
            "checks": res.checks
        }
        results.append(section_data)
        
        if res.interaction_ratio > max_ratio:
            max_ratio = res.interaction_ratio
            governing_idx = i
    
    governing = results[governing_idx]
    all_pass = all(r["status"] == "PASS" for r in results)
    
    return {
        "n_sections": n_sections,
        "section_checks": results,
        "governing_section": governing,
        "is_safe_everywhere": all_pass,
        "summary": (
            f"Column checked at {n_sections} sections along height. "
            f"Governing section: {governing['location']} "
            f"(interaction ratio: {governing['interaction_ratio']:.3f}). "
            f"{'ALL sections PASS' if all_pass else 'SOME sections FAIL — increase reinforcement or section size'}."
        ),
        "engineering_notes": [
            "Column moment varies along height — checking at multiple sections",
            f"Slenderness: λx={height/depth:.1f}, λy={height/width:.1f}",
            "P-delta additional moments included for slender columns (IS 456 Cl. 39.7.1)",
            f"Critical section at {governing['location']} governs the design",
        ]
    }
