"""
slab.py - IS 456:2000 Slab Design Module

Implements design of:
- One-way slabs
- Two-way slabs (using coefficient method)
- Continuous slabs
- Flat slabs (with drop panels)

Reference: IS 456:2000 Clauses 22, 24, 31
"""

from dataclasses import dataclass
from typing import List, Tuple, Optional, Dict
from enum import Enum
import math


# ============================================
# SLAB TYPES AND CONSTANTS
# ============================================

class SlabType(Enum):
    """Classification of slab by support conditions"""
    ONE_WAY = "One-Way Slab"
    TWO_WAY_SIMPLY_SUPPORTED = "Two-Way Simply Supported"
    TWO_WAY_CONTINUOUS = "Two-Way Continuous"
    CANTILEVER = "Cantilever Slab"
    FLAT_SLAB = "Flat Slab"


class EdgeCondition(Enum):
    """Edge support condition per IS 456"""
    DISCONTINUOUS = 0    # Free or simply supported
    CONTINUOUS = 1       # Continuous with adjacent slab


@dataclass
class SlabPanel:
    """Individual slab panel dimensions and conditions"""
    lx: float                    # Shorter span (m)
    ly: float                    # Longer span (m)
    edge_x1: EdgeCondition = EdgeCondition.DISCONTINUOUS  # Edge at x=0
    edge_x2: EdgeCondition = EdgeCondition.DISCONTINUOUS  # Edge at x=lx
    edge_y1: EdgeCondition = EdgeCondition.DISCONTINUOUS  # Edge at y=0
    edge_y2: EdgeCondition = EdgeCondition.DISCONTINUOUS  # Edge at y=ly
    
    @property
    def aspect_ratio(self) -> float:
        """ly/lx ratio - determines one-way or two-way behavior"""
        return self.ly / self.lx if self.lx > 0 else 0
    
    @property
    def slab_type(self) -> SlabType:
        """Determine slab type based on aspect ratio"""
        if self.aspect_ratio > 2:
            return SlabType.ONE_WAY
        else:
            # Check continuity for two-way type
            has_continuity = any([
                self.edge_x1 == EdgeCondition.CONTINUOUS,
                self.edge_x2 == EdgeCondition.CONTINUOUS,
                self.edge_y1 == EdgeCondition.CONTINUOUS,
                self.edge_y2 == EdgeCondition.CONTINUOUS
            ])
            if has_continuity:
                return SlabType.TWO_WAY_CONTINUOUS
            return SlabType.TWO_WAY_SIMPLY_SUPPORTED


@dataclass
class SlabLoading:
    """Loading on slab"""
    dead_load: float      # kN/m² (self-weight calculated separately)
    live_load: float      # kN/m²
    floor_finish: float   # kN/m²
    partition_load: float = 1.0  # kN/m² (for residential)
    
    @property
    def characteristic_load(self) -> float:
        """Total characteristic load"""
        return self.dead_load + self.live_load + self.floor_finish + self.partition_load
    
    def factored_load(self, gamma_d: float = 1.5, gamma_l: float = 1.5) -> float:
        """Ultimate factored load per IS 456"""
        dl = self.dead_load + self.floor_finish + self.partition_load
        return gamma_d * dl + gamma_l * self.live_load


@dataclass
class RebarConfig:
    """Reinforcement configuration for slab"""
    diameter: int         # mm
    spacing: float        # mm c/c
    area_per_m: float     # mm²/m
    direction: str        # 'short' or 'long'


@dataclass
class SlabDesignResult:
    """Complete slab design output"""
    thickness: float              # mm
    main_reinforcement: RebarConfig
    distribution_reinforcement: RebarConfig
    top_reinforcement: Optional[RebarConfig]  # At supports for continuous slabs
    Mu_capacity: float            # kNm/m
    Mu_demand: float              # kNm/m
    deflection_check: float       # Actual L/d ratio
    deflection_limit: float       # Allowable L/d ratio
    status: str
    checks: List[str]


# ============================================
# BENDING MOMENT COEFFICIENTS (IS 456 TABLE 26)
# ============================================

# Coefficients for two-way slabs - αx and αy for different edge conditions
# Format: (αx_neg_edge, αx_pos_mid, αy_neg_edge, αy_pos_mid)
# Case number corresponds to IS 456 Table 26

MOMENT_COEFFICIENTS = {
    # Case 1: All edges simply supported
    1: {
        1.0: (0.000, 0.032, 0.000, 0.032),
        1.1: (0.000, 0.037, 0.000, 0.028),
        1.2: (0.000, 0.043, 0.000, 0.025),
        1.3: (0.000, 0.047, 0.000, 0.022),
        1.4: (0.000, 0.051, 0.000, 0.020),
        1.5: (0.000, 0.053, 0.000, 0.018),
        2.0: (0.000, 0.056, 0.000, 0.014),
    },
    # Case 2: One short edge discontinuous
    2: {
        1.0: (0.000, 0.037, 0.047, 0.028),
        1.1: (0.000, 0.043, 0.052, 0.025),
        1.2: (0.000, 0.048, 0.057, 0.022),
        1.3: (0.000, 0.051, 0.060, 0.020),
        1.4: (0.000, 0.055, 0.063, 0.018),
        1.5: (0.000, 0.057, 0.064, 0.016),
        2.0: (0.000, 0.062, 0.067, 0.012),
    },
    # Case 4: All edges continuous
    4: {
        1.0: (0.032, 0.024, 0.032, 0.024),
        1.1: (0.037, 0.028, 0.028, 0.021),
        1.2: (0.043, 0.032, 0.025, 0.019),
        1.3: (0.047, 0.035, 0.022, 0.017),
        1.4: (0.051, 0.037, 0.020, 0.015),
        1.5: (0.053, 0.039, 0.018, 0.013),
        2.0: (0.056, 0.041, 0.014, 0.011),
    },
    # Case 9: All edges fixed (approx)
    9: {
        1.0: (0.047, 0.024, 0.047, 0.024),
        1.1: (0.053, 0.027, 0.041, 0.021),
        1.2: (0.060, 0.030, 0.037, 0.019),
        1.3: (0.065, 0.032, 0.033, 0.017),
        1.4: (0.068, 0.034, 0.030, 0.015),
        1.5: (0.070, 0.035, 0.027, 0.014),
        2.0: (0.074, 0.037, 0.022, 0.011),
    },
}


# ============================================
# SLAB DESIGNER CLASS
# ============================================

class SlabDesigner:
    """
    RC Slab Design per IS 456:2000
    """
    
    GAMMA_C = 1.5    # Partial safety factor for concrete
    GAMMA_S = 1.15   # Partial safety factor for steel
    
    # Standard bar diameters for slabs (mm)
    SLAB_BAR_DIAMETERS = [8, 10, 12, 16]
    
    def __init__(
        self,
        fck: float = 25,    # Characteristic concrete strength (MPa)
        fy: float = 500     # Yield strength of steel (MPa)
    ):
        self.fck = fck
        self.fy = fy
        self.fcd = 0.67 * fck / self.GAMMA_C
        self.fyd = fy / self.GAMMA_S
    
    # ============================================
    # MAIN DESIGN METHODS
    # ============================================
    
    def design_one_way_slab(
        self,
        span: float,                    # Effective span (m)
        loading: SlabLoading,
        support_type: str = 'simple'    # 'simple', 'continuous', 'cantilever'
    ) -> SlabDesignResult:
        """
        Design one-way spanning slab
        """
        checks = []
        
        # 1. Estimate thickness based on span/depth ratio
        basic_ld = self._get_basic_span_depth_ratio(support_type)
        d_assumed = span * 1000 / basic_ld  # mm
        D = d_assumed + 20 + 5              # Cover + half bar dia
        D = max(100, math.ceil(D / 5) * 5)  # Round up to 5mm, min 100mm
        d = D - 25                           # Effective depth
        
        checks.append(f"Assumed thickness: {D}mm, effective depth: {d}mm")
        
        # 2. Calculate self-weight
        self_weight = 25 * D / 1000         # kN/m²
        total_dl = loading.dead_load + self_weight
        
        # Update loading with self-weight
        total_loading = SlabLoading(
            dead_load=total_dl,
            live_load=loading.live_load,
            floor_finish=loading.floor_finish,
            partition_load=loading.partition_load
        )
        
        wu = total_loading.factored_load()
        checks.append(f"Factored load: {wu:.2f} kN/m²")
        
        # 3. Calculate design moment
        if support_type == 'simple':
            Mu = wu * span**2 / 8       # kNm/m
            alpha_factor = 1.0
        elif support_type == 'continuous':
            # Interior span
            Mu = wu * span**2 / 12      # Positive moment
            checks.append("Using continuous slab moment coefficient")
            alpha_factor = 0.8
        elif support_type == 'cantilever':
            Mu = wu * span**2 / 2       # kNm/m
            alpha_factor = 0.7
        else:
            Mu = wu * span**2 / 8
            alpha_factor = 1.0
        
        checks.append(f"Design moment: {Mu:.2f} kNm/m")
        
        # 4. Check depth for flexure
        Mu_lim = 0.138 * self.fck * 1000 * d**2 / 1e6  # kNm/m
        if Mu > Mu_lim:
            # Increase depth
            d = math.sqrt(Mu * 1e6 / (0.138 * self.fck * 1000))
            D = d + 25
            D = math.ceil(D / 5) * 5
            d = D - 25
            checks.append(f"Depth increased for flexure: D={D}mm")
        
        # 5. Calculate reinforcement
        R = Mu * 1e6 / (1000 * d**2)    # MPa
        pt = (self.fck / (2 * self.fy)) * (1 - math.sqrt(1 - 4.6 * R / self.fck)) * 100
        
        # Minimum steel (IS 456 Clause 26.5.2.1)
        pt_min = 0.12 if self.fy > 415 else 0.15
        pt = max(pt, pt_min)
        
        Ast = pt * 1000 * d / 100       # mm²/m
        
        main_rebar = self._select_slab_reinforcement(Ast, d)
        checks.append(f"Main steel: {main_rebar.diameter}φ @ {main_rebar.spacing}mm c/c")
        
        # 6. Distribution steel (min 0.12% for HYSD)
        Ast_dist = pt_min * 1000 * d / 100
        dist_rebar = self._select_slab_reinforcement(Ast_dist, d, direction='long')
        checks.append(f"Distribution steel: {dist_rebar.diameter}φ @ {dist_rebar.spacing}mm c/c")
        
        # 7. Check deflection (IS 456 Clause 23.2)
        pt_provided = main_rebar.area_per_m * 100 / (1000 * d)
        mod_factor = self._get_modification_factor(pt_provided)
        allowable_ld = basic_ld * mod_factor * alpha_factor
        actual_ld = span * 1000 / d
        
        deflection_ok = actual_ld <= allowable_ld
        checks.append(f"Deflection: L/d = {actual_ld:.1f}, Limit = {allowable_ld:.1f} {'✓' if deflection_ok else '✗'}")
        
        # 8. Capacity check
        Ast_provided = main_rebar.area_per_m
        xu = 0.87 * self.fy * Ast_provided / (0.36 * self.fck * 1000)
        Mu_capacity = 0.87 * self.fy * Ast_provided * (d - 0.42 * xu) / 1e6
        
        status = 'PASS' if Mu_capacity >= Mu and deflection_ok else 'FAIL'
        
        return SlabDesignResult(
            thickness=D,
            main_reinforcement=main_rebar,
            distribution_reinforcement=dist_rebar,
            top_reinforcement=None,
            Mu_capacity=Mu_capacity,
            Mu_demand=Mu,
            deflection_check=actual_ld,
            deflection_limit=allowable_ld,
            status=status,
            checks=checks
        )
    
    def design_two_way_slab(
        self,
        panel: SlabPanel,
        loading: SlabLoading,
        case_number: int = 1            # IS 456 Table 26 case number
    ) -> SlabDesignResult:
        """
        Design two-way spanning slab using coefficient method
        """
        checks = []
        lx, ly = panel.lx, panel.ly
        ratio = panel.aspect_ratio
        
        checks.append(f"Span ratio ly/lx = {ratio:.2f}")
        
        # 1. Estimate thickness
        basic_ld = 26 if any([
            panel.edge_x1 == EdgeCondition.CONTINUOUS,
            panel.edge_x2 == EdgeCondition.CONTINUOUS
        ]) else 20
        
        d_assumed = lx * 1000 / basic_ld
        D = d_assumed + 20 + 5
        D = max(120, math.ceil(D / 5) * 5)
        d = D - 25
        
        checks.append(f"Assumed thickness: {D}mm")
        
        # 2. Self-weight and factored load
        self_weight = 25 * D / 1000
        total_loading = SlabLoading(
            dead_load=loading.dead_load + self_weight,
            live_load=loading.live_load,
            floor_finish=loading.floor_finish,
            partition_load=loading.partition_load
        )
        wu = total_loading.factored_load()
        checks.append(f"Factored load: {wu:.2f} kN/m²")
        
        # 3. Get moment coefficients
        coeffs = self._get_moment_coefficients(ratio, case_number)
        alpha_x_neg, alpha_x_pos, alpha_y_neg, alpha_y_pos = coeffs
        
        # 4. Calculate design moments
        Mx_neg = alpha_x_neg * wu * lx**2 if alpha_x_neg > 0 else 0
        Mx_pos = alpha_x_pos * wu * lx**2
        My_neg = alpha_y_neg * wu * lx**2 if alpha_y_neg > 0 else 0
        My_pos = alpha_y_pos * wu * lx**2
        
        checks.append(f"Moments: Mx+ = {Mx_pos:.2f}, My+ = {My_pos:.2f} kNm/m")
        
        # 5. Design main reinforcement (short span)
        Ast_x = self._steel_for_moment(Mx_pos, d)
        pt_min = 0.12 if self.fy > 415 else 0.15
        Ast_x = max(Ast_x, pt_min * 1000 * d / 100)
        
        main_rebar = self._select_slab_reinforcement(Ast_x, d, direction='short')
        checks.append(f"Short span: {main_rebar.diameter}φ @ {main_rebar.spacing}mm c/c")
        
        # 6. Design secondary reinforcement (long span)
        # Account for reduced effective depth
        d_y = d - main_rebar.diameter
        Ast_y = self._steel_for_moment(My_pos, d_y)
        Ast_y = max(Ast_y, pt_min * 1000 * d_y / 100)
        
        dist_rebar = self._select_slab_reinforcement(Ast_y, d_y, direction='long')
        checks.append(f"Long span: {dist_rebar.diameter}φ @ {dist_rebar.spacing}mm c/c")
        
        # 7. Top steel at continuous edges
        top_rebar = None
        if alpha_x_neg > 0 or alpha_y_neg > 0:
            Ast_top = max(
                self._steel_for_moment(Mx_neg, d) if Mx_neg > 0 else 0,
                self._steel_for_moment(My_neg, d_y) if My_neg > 0 else 0
            )
            if Ast_top > 0:
                top_rebar = self._select_slab_reinforcement(Ast_top, d, direction='short')
                checks.append(f"Top steel at support: {top_rebar.diameter}φ @ {top_rebar.spacing}mm c/c")
        
        # 8. Deflection check
        pt_prov = main_rebar.area_per_m * 100 / (1000 * d)
        mod_factor = self._get_modification_factor(pt_prov)
        allowable_ld = basic_ld * mod_factor * 0.8  # 0.8 for two-way
        actual_ld = lx * 1000 / d
        
        deflection_ok = actual_ld <= allowable_ld
        checks.append(f"Deflection: L/d = {actual_ld:.1f}, Limit = {allowable_ld:.1f}")
        
        # 9. Capacity
        Ast_provided = main_rebar.area_per_m
        xu = 0.87 * self.fy * Ast_provided / (0.36 * self.fck * 1000)
        Mu_capacity = 0.87 * self.fy * Ast_provided * (d - 0.42 * xu) / 1e6
        
        status = 'PASS' if Mu_capacity >= Mx_pos and deflection_ok else 'FAIL'
        
        return SlabDesignResult(
            thickness=D,
            main_reinforcement=main_rebar,
            distribution_reinforcement=dist_rebar,
            top_reinforcement=top_rebar,
            Mu_capacity=Mu_capacity,
            Mu_demand=Mx_pos,
            deflection_check=actual_ld,
            deflection_limit=allowable_ld,
            status=status,
            checks=checks
        )
    
    # ============================================
    # HELPER METHODS
    # ============================================
    
    def _get_basic_span_depth_ratio(self, support_type: str) -> float:
        """Basic L/d ratio per IS 456 Clause 23.2"""
        ratios = {
            'cantilever': 7,
            'simple': 20,
            'continuous': 26
        }
        return ratios.get(support_type, 20)
    
    def _get_modification_factor(self, pt: float) -> float:
        """
        Modification factor for tension reinforcement per IS 456 Fig 4
        """
        if pt <= 0.25:
            return 2.0
        elif pt <= 0.5:
            return 2.0 - (pt - 0.25) * (2.0 - 1.5) / 0.25
        elif pt <= 0.75:
            return 1.5 - (pt - 0.5) * (1.5 - 1.28) / 0.25
        elif pt <= 1.0:
            return 1.28 - (pt - 0.75) * (1.28 - 1.13) / 0.25
        elif pt <= 1.5:
            return 1.13 - (pt - 1.0) * (1.13 - 0.98) / 0.5
        elif pt <= 2.0:
            return 0.98 - (pt - 1.5) * (0.98 - 0.89) / 0.5
        else:
            return 0.89 - (pt - 2.0) * 0.05
    
    def _get_moment_coefficients(
        self, 
        ratio: float, 
        case_number: int
    ) -> Tuple[float, float, float, float]:
        """
        Interpolate moment coefficients from IS 456 Table 26
        """
        if case_number not in MOMENT_COEFFICIENTS:
            case_number = 1  # Default to simply supported
        
        table = MOMENT_COEFFICIENTS[case_number]
        ratios = sorted(table.keys())
        
        # Clamp ratio
        ratio = min(max(ratio, ratios[0]), ratios[-1])
        
        # Find bracketing ratios
        lower = max(r for r in ratios if r <= ratio)
        upper = min(r for r in ratios if r >= ratio)
        
        if lower == upper:
            return table[lower]
        
        # Linear interpolation
        t = (ratio - lower) / (upper - lower)
        coeffs_lower = table[lower]
        coeffs_upper = table[upper]
        
        return tuple(
            coeffs_lower[i] + t * (coeffs_upper[i] - coeffs_lower[i])
            for i in range(4)
        )
    
    def _steel_for_moment(self, Mu: float, d: float) -> float:
        """
        Calculate required steel area for given moment
        """
        if Mu <= 0:
            return 0
        
        R = Mu * 1e6 / (1000 * d**2)
        
        # Check if moment exceeds singly reinforced limit
        R_lim = 0.138 * self.fck
        if R > R_lim:
            R = R_lim
        
        pt = (self.fck / (2 * self.fy)) * (1 - math.sqrt(1 - 4.6 * R / self.fck)) * 100
        Ast = pt * 1000 * d / 100
        
        return Ast
    
    def _select_slab_reinforcement(
        self, 
        Ast_required: float,
        d: float,
        direction: str = 'short'
    ) -> RebarConfig:
        """
        Select reinforcement for slab (bar diameter and spacing)
        """
        # Maximum spacing: 3d or 300mm
        max_spacing = min(3 * d, 300)
        
        best_config = None
        min_excess = float('inf')
        
        for dia in self.SLAB_BAR_DIAMETERS:
            area_per_bar = math.pi * dia**2 / 4
            spacing = 1000 * area_per_bar / Ast_required  # mm
            
            # Round down to nearest 5mm
            spacing = 5 * math.floor(spacing / 5)
            spacing = min(spacing, max_spacing)
            spacing = max(spacing, 75)  # Minimum spacing
            
            area_provided = 1000 * area_per_bar / spacing
            excess = area_provided - Ast_required
            
            if excess >= 0 and excess < min_excess:
                min_excess = excess
                best_config = RebarConfig(
                    diameter=dia,
                    spacing=spacing,
                    area_per_m=area_provided,
                    direction=direction
                )
        
        if best_config is None:
            # Fallback to 12mm @ 150mm
            best_config = RebarConfig(
                diameter=12,
                spacing=150,
                area_per_m=754,
                direction=direction
            )
        
        return best_config


# ============================================
# QUICK DESIGN FUNCTIONS
# ============================================

def design_simply_supported_slab(
    span: float,
    live_load: float,
    fck: float = 25,
    fy: float = 500,
    floor_finish: float = 1.0
) -> SlabDesignResult:
    """
    Quick design for simply supported one-way slab
    """
    designer = SlabDesigner(fck=fck, fy=fy)
    loading = SlabLoading(
        dead_load=0,  # Self-weight calculated internally
        live_load=live_load,
        floor_finish=floor_finish
    )
    return designer.design_one_way_slab(span, loading, 'simple')


def design_continuous_slab(
    span: float,
    live_load: float,
    fck: float = 25,
    fy: float = 500
) -> SlabDesignResult:
    """
    Quick design for continuous one-way slab
    """
    designer = SlabDesigner(fck=fck, fy=fy)
    loading = SlabLoading(
        dead_load=0,
        live_load=live_load,
        floor_finish=1.0
    )
    return designer.design_one_way_slab(span, loading, 'continuous')


def design_two_way_floor_slab(
    lx: float,
    ly: float,
    live_load: float,
    edge_conditions: str = 'all_simple',
    fck: float = 25,
    fy: float = 500
) -> SlabDesignResult:
    """
    Quick design for two-way slab
    
    edge_conditions:
        'all_simple' - All edges simply supported
        'all_continuous' - All edges continuous
        'interior' - Interior panel (all continuous)
        'corner' - Corner panel (two adj edges discontinuous)
    """
    edge_map = {
        'all_simple': (EdgeCondition.DISCONTINUOUS, EdgeCondition.DISCONTINUOUS,
                       EdgeCondition.DISCONTINUOUS, EdgeCondition.DISCONTINUOUS),
        'all_continuous': (EdgeCondition.CONTINUOUS, EdgeCondition.CONTINUOUS,
                          EdgeCondition.CONTINUOUS, EdgeCondition.CONTINUOUS),
        'interior': (EdgeCondition.CONTINUOUS, EdgeCondition.CONTINUOUS,
                    EdgeCondition.CONTINUOUS, EdgeCondition.CONTINUOUS),
        'corner': (EdgeCondition.DISCONTINUOUS, EdgeCondition.CONTINUOUS,
                  EdgeCondition.DISCONTINUOUS, EdgeCondition.CONTINUOUS),
    }
    
    case_map = {
        'all_simple': 1,
        'all_continuous': 4,
        'interior': 4,
        'corner': 2
    }
    
    ex1, ex2, ey1, ey2 = edge_map.get(edge_conditions, edge_map['all_simple'])
    case_num = case_map.get(edge_conditions, 1)
    
    panel = SlabPanel(
        lx=lx, ly=ly,
        edge_x1=ex1, edge_x2=ex2,
        edge_y1=ey1, edge_y2=ey2
    )
    
    designer = SlabDesigner(fck=fck, fy=fy)
    loading = SlabLoading(
        dead_load=0,
        live_load=live_load,
        floor_finish=1.0
    )
    
    return designer.design_two_way_slab(panel, loading, case_num)
