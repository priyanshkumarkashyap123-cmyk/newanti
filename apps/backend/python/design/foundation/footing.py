"""
footing.py - Foundation Design Module

Implements foundation design per IS 456:2000 and IS 1904:
- Isolated footings (square, rectangular)
- Combined footings
- Strap footings
- Mat/Raft foundations

Reference: 
- IS 456:2000 Plain and Reinforced Concrete
- IS 1904:1986 Code of Practice for Structural Safety of Buildings
"""

from dataclasses import dataclass
from typing import List, Tuple, Optional
from enum import Enum
import math


# ============================================
# SOIL PROPERTIES
# ============================================

class SoilType(Enum):
    """Soil classification for bearing capacity"""
    SOFT_CLAY = ('Soft Clay', 50, 0, 18)           # (name, c kPa, phi deg, gamma kN/m³)
    MEDIUM_CLAY = ('Medium Clay', 75, 0, 19)
    STIFF_CLAY = ('Stiff Clay', 100, 0, 20)
    LOOSE_SAND = ('Loose Sand', 0, 28, 16)
    MEDIUM_SAND = ('Medium Sand', 0, 32, 18)
    DENSE_SAND = ('Dense Sand', 0, 38, 20)
    GRAVEL = ('Gravel', 0, 40, 21)
    ROCK = ('Rock', 500, 45, 25)
    
    @property
    def cohesion(self) -> float:
        return self.value[1]
    
    @property
    def friction_angle(self) -> float:
        return self.value[2]
    
    @property
    def unit_weight(self) -> float:
        return self.value[3]


@dataclass
class SoilProfile:
    """Soil profile for foundation design"""
    bearing_capacity: float    # Safe bearing capacity (kPa)
    soil_type: SoilType
    depth_to_water: float      # m (from ground level)
    subgrade_modulus: float    # kN/m³ (modulus of subgrade reaction)


# ============================================
# FOUNDATION DATA STRUCTURES
# ============================================

@dataclass
class ColumnLoad:
    """Column load for foundation design"""
    P: float           # Axial load (kN)
    Mx: float = 0      # Moment about X-axis (kNm)
    My: float = 0      # Moment about Y-axis (kNm)
    Vx: float = 0      # Shear in X direction (kN)
    Vy: float = 0      # Shear in Y direction (kN)
    x: float = 0       # X coordinate (m)
    y: float = 0       # Y coordinate (m)


@dataclass
class IsolatedFooting:
    """Isolated footing dimensions"""
    length: float          # m (L)
    width: float           # m (B)
    depth: float           # m (D)
    cover: float = 0.075   # m (clear cover)
    fck: float = 25        # MPa
    fy: float = 500        # MPa
    
    @property
    def area(self) -> float:
        return self.length * self.width
    
    @property
    def section_modulus_x(self) -> float:
        return self.width * self.length**2 / 6
    
    @property
    def section_modulus_y(self) -> float:
        return self.length * self.width**2 / 6


@dataclass
class CombinedFooting:
    """Combined footing for two or more columns"""
    length: float          # m
    width: float           # m
    depth: float           # m
    column_positions: List[float]  # x coordinates of columns from left edge
    fck: float = 25
    fy: float = 500


@dataclass
class MatFoundation:
    """Mat/Raft foundation"""
    length: float          # m
    width: float           # m
    thickness: float       # m
    column_grid: List[Tuple[float, float]]  # (x, y) coordinates
    fck: float = 30
    fy: float = 500


@dataclass
class FootingDesignResult:
    """Foundation design output"""
    dimensions: dict
    reinforcement: dict
    bearing_check: float      # Ratio of pressure to capacity
    punching_check: float     # Punching shear ratio
    one_way_shear: float      # One-way shear ratio
    flexure_check: float      # Flexure ratio
    status: str
    checks: List[str]


# ============================================
# FOUNDATION DESIGNER
# ============================================

class FoundationDesigner:
    """
    Foundation design per IS 456:2000
    """
    
    GAMMA_C = 1.5   # Partial safety factor for concrete
    GAMMA_S = 1.15  # Partial safety factor for steel
    
    def __init__(self, soil: SoilProfile):
        self.soil = soil
    
    # ============================================
    # ISOLATED FOOTING DESIGN
    # ============================================
    
    def size_isolated_footing(
        self,
        load: ColumnLoad,
        column_size: Tuple[float, float] = (0.4, 0.4),  # m
        min_depth: float = 0.45
    ) -> IsolatedFooting:
        """
        Size isolated footing for given column load
        """
        P = load.P
        Mx = load.Mx
        My = load.My
        
        sbc = self.soil.bearing_capacity
        
        # Initial size based on axial load only (with 10% self-weight)
        A_req = 1.1 * P / sbc
        
        if Mx == 0 and My == 0:
            # Square footing
            L = B = math.sqrt(A_req)
        else:
            # Rectangular footing - iterate
            # Start with square
            L = B = math.sqrt(A_req)
            
            for _ in range(10):
                Zx = B * L**2 / 6
                Zy = L * B**2 / 6
                
                q_max = P / (L * B) + abs(Mx) / Zx + abs(My) / Zy
                
                if q_max <= sbc:
                    break
                else:
                    # Increase size
                    factor = math.sqrt(q_max / sbc)
                    L *= factor
                    B *= factor
        
        # Round up to nearest 50mm
        L = math.ceil(L * 20) / 20
        B = math.ceil(B * 20) / 20
        
        # Depth for punching shear (approximate)
        d = max(min_depth, column_size[0] / 4 + 0.3)
        
        return IsolatedFooting(
            length=L,
            width=B,
            depth=d
        )
    
    def design_isolated_footing(
        self,
        footing: IsolatedFooting,
        load: ColumnLoad,
        column_size: Tuple[float, float] = (0.4, 0.4)
    ) -> FootingDesignResult:
        """
        Complete design of isolated footing
        """
        checks = []
        
        L = footing.length
        B = footing.width
        D = footing.depth
        d = D - footing.cover - 0.01  # Effective depth (m)
        
        P = load.P
        Mx = load.Mx
        My = load.My
        
        col_a, col_b = column_size
        fck = footing.fck
        fy = footing.fy
        sbc = self.soil.bearing_capacity
        
        # ============================================
        # 1. BEARING PRESSURE CHECK
        # ============================================
        
        Zx = B * L**2 / 6
        Zy = L * B**2 / 6
        
        # Self-weight of footing
        W_footing = L * B * D * 25  # kN (concrete = 25 kN/m³)
        P_total = P + W_footing
        
        q_max = P_total / (L * B) + abs(Mx) / Zx + abs(My) / Zy
        q_min = P_total / (L * B) - abs(Mx) / Zx - abs(My) / Zy
        
        bearing_ratio = q_max / sbc
        
        checks.append(f"Max bearing pressure = {q_max:.1f} kPa")
        checks.append(f"Safe bearing capacity = {sbc:.1f} kPa")
        checks.append(f"Bearing ratio = {bearing_ratio:.2f}")
        
        if q_min < 0:
            checks.append("WARNING: Tension at footing base - increase size or eccentricity")
        
        # ============================================
        # 2. PUNCHING SHEAR CHECK (IS 456 Cl. 31.6)
        # ============================================
        
        # Critical perimeter at d/2 from column face
        b0 = 2 * ((col_a + d) + (col_b + d))  # m
        
        # Area within critical perimeter
        A_punch = (col_a + d) * (col_b + d)
        
        # Punching shear force
        V_punch = P * (1 - A_punch / (L * B)) * 1000  # N
        
        # Punching shear stress
        tau_v = V_punch / (b0 * 1000 * d * 1000)  # MPa
        
        # Design punching shear strength (IS 456 Cl. 31.6.3)
        tau_c = 0.25 * math.sqrt(fck)
        ks = min(1, 0.5 + col_b / col_a)
        tau_c = ks * tau_c
        
        punching_ratio = tau_v / tau_c
        
        checks.append(f"Punching shear stress = {tau_v:.3f} MPa")
        checks.append(f"Punching shear capacity = {tau_c:.3f} MPa")
        checks.append(f"Punching shear ratio = {punching_ratio:.2f}")
        
        # ============================================
        # 3. ONE-WAY SHEAR CHECK
        # ============================================
        
        # Critical section at d from column face
        # In longer direction
        overhang = (L - col_a) / 2 - d
        
        if overhang > 0:
            # Shear at critical section
            V_one = q_max * B * overhang * 1000  # N
            tau_v_one = V_one / (B * 1000 * d * 1000)  # MPa
            
            # Design shear strength (IS 456 Table 19, assume 0.5% steel)
            tau_c_one = 0.36  # MPa for fck=25, pt=0.5%
            
            one_way_ratio = tau_v_one / tau_c_one
        else:
            one_way_ratio = 0
            tau_v_one = 0
        
        checks.append(f"One-way shear ratio = {one_way_ratio:.2f}")
        
        # ============================================
        # 4. FLEXURE DESIGN
        # ============================================
        
        # Critical section at face of column
        # Cantilever moment in longer direction
        overhang_x = (L - col_a) / 2
        M_x = 0.5 * q_max * B * overhang_x**2  # kNm
        
        overhang_y = (B - col_b) / 2
        M_y = 0.5 * q_max * L * overhang_y**2  # kNm
        
        checks.append(f"Moment per m width (X) = {M_x/B:.1f} kNm/m")
        checks.append(f"Moment per m width (Y) = {M_y/L:.1f} kNm/m")
        
        # Required steel area (per meter width)
        fyd = fy / self.GAMMA_S
        
        # Using simplified flexure formula
        Ast_x = self._calc_flexure_steel(M_x / B, d, fck, fy)  # mm²/m
        Ast_y = self._calc_flexure_steel(M_y / L, d, fck, fy)  # mm²/m
        
        # Minimum steel (0.12% of gross area per IS 456)
        Ast_min = 0.0012 * D * 1000 * 1000  # mm²/m
        
        Ast_x = max(Ast_x, Ast_min)
        Ast_y = max(Ast_y, Ast_min)
        
        # Select bars
        bar_dia = 12  # mm
        bar_area = math.pi * bar_dia**2 / 4
        
        spacing_x = 1000 * bar_area / Ast_x
        spacing_y = 1000 * bar_area / Ast_y
        
        # Round down to nearest 25mm
        spacing_x = 25 * math.floor(spacing_x / 25)
        spacing_y = 25 * math.floor(spacing_y / 25)
        
        spacing_x = max(100, min(spacing_x, 300))
        spacing_y = max(100, min(spacing_y, 300))
        
        checks.append(f"Bottom reinforcement X: {bar_dia}φ @ {spacing_x}mm c/c")
        checks.append(f"Bottom reinforcement Y: {bar_dia}φ @ {spacing_y}mm c/c")
        
        # Flexure ratio (approximate)
        Mu_cap = 0.138 * fck * 1000 * d**2  # kNm/m (balanced section)
        flexure_ratio = max(M_x / B, M_y / L) / Mu_cap
        
        # ============================================
        # 5. DEVELOPMENT LENGTH CHECK
        # ============================================
        
        Ld = bar_dia * fy / (4 * 1.4 * 1.6)  # Approximate Ld
        available = min(overhang_x, overhang_y) * 1000 - 75  # mm
        
        if Ld > available:
            checks.append(f"WARNING: Ld = {Ld:.0f}mm > available = {available:.0f}mm")
            checks.append("Consider using smaller diameter bars or bent-up bars")
        
        # ============================================
        # COMPILE RESULTS
        # ============================================
        
        max_ratio = max(bearing_ratio, punching_ratio, one_way_ratio, flexure_ratio)
        status = 'PASS' if max_ratio <= 1.0 else 'FAIL'
        
        return FootingDesignResult(
            dimensions={
                'length': L,
                'width': B,
                'depth': D,
                'effective_depth': d
            },
            reinforcement={
                'bottom_x': f"{bar_dia}φ @ {spacing_x}mm",
                'bottom_y': f"{bar_dia}φ @ {spacing_y}mm",
                'Ast_x': Ast_x,
                'Ast_y': Ast_y
            },
            bearing_check=bearing_ratio,
            punching_check=punching_ratio,
            one_way_shear=one_way_ratio,
            flexure_check=flexure_ratio,
            status=status,
            checks=checks
        )
    
    # ============================================
    # COMBINED FOOTING DESIGN
    # ============================================
    
    def design_combined_footing(
        self,
        loads: List[ColumnLoad],
        column_sizes: List[Tuple[float, float]],
        min_depth: float = 0.6
    ) -> FootingDesignResult:
        """
        Design combined footing for two columns
        """
        checks = []
        
        if len(loads) != 2:
            raise ValueError("Combined footing requires exactly 2 columns")
        
        P1 = loads[0].P
        P2 = loads[1].P
        x1 = loads[0].x
        x2 = loads[1].x
        
        # Total load
        P_total = P1 + P2
        
        # Location of resultant from P1
        x_resultant = (P1 * 0 + P2 * (x2 - x1)) / P_total
        
        # CG should be at center of footing for uniform pressure
        # L/2 should coincide with x_resultant
        
        # If columns are at edges
        L = 2 * (x_resultant + x1) if x1 > 0 else 2 * (x2 - x_resultant + x1)
        
        # Ensure footing covers both columns with overhang
        L = max(L, x2 - x1 + 0.5)
        
        # Width from bearing capacity
        sbc = self.soil.bearing_capacity
        B = P_total * 1.1 / (sbc * L)
        
        # Round up
        L = math.ceil(L * 20) / 20
        B = math.ceil(B * 20) / 20
        
        checks.append(f"Footing size: {L:.2f}m x {B:.2f}m")
        
        # Pressure
        A = L * B
        q = P_total * 1.1 / A
        
        checks.append(f"Bearing pressure = {q:.1f} kPa")
        checks.append(f"Safe bearing capacity = {sbc:.1f} kPa")
        
        bearing_ratio = q / sbc
        
        # Depth for shear (approximate)
        D = max(min_depth, B / 5)
        d = D - 0.075 - 0.01
        
        # Check punching at each column (simplified)
        col1 = column_sizes[0]
        V_punch1 = P1 - q * (col1[0] + d) * (col1[1] + d)
        
        b0 = 2 * ((col1[0] + d) + (col1[1] + d))
        tau_v = V_punch1 * 1000 / (b0 * 1000 * d * 1000)
        tau_c = 0.25 * math.sqrt(25)
        
        punching_ratio = tau_v / tau_c
        checks.append(f"Punching shear ratio = {punching_ratio:.2f}")
        
        # Flexure - analyze as beam
        # Maximum moment occurs between columns or at columns
        
        # Moment at P1 location
        overhang_left = x1
        M_max = 0.5 * q * B * overhang_left**2
        
        # At midspan (simplified)
        span = x2 - x1
        w = q * B  # kN/m
        M_mid = P1 * span / 2 - w * span**2 / 8
        
        M_design = max(M_max, abs(M_mid))
        
        checks.append(f"Design moment = {M_design:.1f} kNm")
        
        # Steel in longitudinal direction
        Ast_long = self._calc_flexure_steel(M_design, d, 25, 500) * B * 1000 / 1000
        
        # Transverse moment (cantilever from column)
        col_width = max(c[1] for c in column_sizes)
        overhang_trans = (B - col_width) / 2
        M_trans = 0.5 * q * 1.0 * overhang_trans**2  # per m length
        
        Ast_trans = self._calc_flexure_steel(M_trans, d, 25, 500)
        
        # Bar selection
        bar_dia = 16
        bar_area = math.pi * bar_dia**2 / 4
        n_bars_long = math.ceil(Ast_long / bar_area)
        
        checks.append(f"Longitudinal steel: {n_bars_long} nos of {bar_dia}φ")
        
        flexure_ratio = M_design / (0.138 * 25 * B * 1000 * d**2)
        
        status = 'PASS' if max(bearing_ratio, punching_ratio, flexure_ratio) <= 1.0 else 'FAIL'
        
        return FootingDesignResult(
            dimensions={'length': L, 'width': B, 'depth': D},
            reinforcement={
                'longitudinal': f"{n_bars_long}-{bar_dia}φ",
                'transverse': f"12φ @ 150mm c/c"
            },
            bearing_check=bearing_ratio,
            punching_check=punching_ratio,
            one_way_shear=0,
            flexure_check=flexure_ratio,
            status=status,
            checks=checks
        )
    
    # ============================================
    # MAT FOUNDATION
    # ============================================
    
    def design_mat_foundation(
        self,
        loads: List[ColumnLoad],
        column_sizes: List[Tuple[float, float]],
        min_thickness: float = 0.6
    ) -> FootingDesignResult:
        """
        Preliminary design of mat foundation
        """
        checks = []
        
        # Total load
        P_total = sum(load.P for load in loads)
        Mx_total = sum(load.Mx for load in loads)
        My_total = sum(load.My for load in loads)
        
        # Find extent of columns
        x_coords = [load.x for load in loads]
        y_coords = [load.y for load in loads]
        
        x_min, x_max = min(x_coords), max(x_coords)
        y_min, y_max = min(y_coords), max(y_coords)
        
        # Add overhang (typically 1m beyond edge columns)
        overhang = 1.0
        
        L = (x_max - x_min) + 2 * overhang
        B = (y_max - y_min) + 2 * overhang
        
        A = L * B
        
        checks.append(f"Mat size: {L:.1f}m x {B:.1f}m")
        
        # CG of loads
        x_cg = sum(load.P * load.x for load in loads) / P_total
        y_cg = sum(load.P * load.y for load in loads) / P_total
        
        # Eccentricity from mat center
        mat_cx = (x_min + x_max) / 2
        mat_cy = (y_min + y_max) / 2
        
        ex = x_cg - mat_cx
        ey = y_cg - mat_cy
        
        checks.append(f"Eccentricity: ex = {ex:.2f}m, ey = {ey:.2f}m")
        
        # Moments about mat center
        Mx_total += P_total * ey
        My_total += P_total * ex
        
        # Section moduli
        Zx = B * L**2 / 6
        Zy = L * B**2 / 6
        
        # Bearing pressure
        sbc = self.soil.bearing_capacity
        
        q_avg = P_total / A
        q_max = P_total / A + abs(Mx_total) / Zx + abs(My_total) / Zy
        q_min = P_total / A - abs(Mx_total) / Zx - abs(My_total) / Zy
        
        checks.append(f"Average pressure = {q_avg:.1f} kPa")
        checks.append(f"Max pressure = {q_max:.1f} kPa")
        checks.append(f"Min pressure = {q_min:.1f} kPa")
        
        bearing_ratio = q_max / sbc
        
        if q_min < 0:
            checks.append("WARNING: Tension at base - increase mat size")
        
        # Thickness for punching shear
        # Check critical column
        max_P = max(load.P for load in loads)
        col_size = column_sizes[0]
        
        D = min_thickness
        d = D - 0.1
        
        # Iterate for punching
        for _ in range(10):
            b0 = 2 * ((col_size[0] + d) + (col_size[1] + d))
            A_punch = (col_size[0] + d) * (col_size[1] + d)
            
            V_punch = max_P - q_max * A_punch
            tau_v = V_punch * 1000 / (b0 * 1000 * d * 1000)
            
            tau_c = 0.25 * math.sqrt(30)  # fck = 30 for mat
            
            if tau_v <= tau_c:
                break
            else:
                D += 0.1
                d = D - 0.1
        
        punching_ratio = tau_v / tau_c
        checks.append(f"Mat thickness = {D:.2f}m")
        checks.append(f"Punching shear ratio = {punching_ratio:.2f}")
        
        # Simplified flexure check (analyze as flat slab)
        # Panel moments (coefficient method)
        span_x = (x_coords[1] - x_coords[0]) if len(x_coords) > 1 else L / 2
        span_y = (y_coords[1] - y_coords[0]) if len(y_coords) > 1 else B / 2
        
        # Average column load per panel
        n_panels = max(1, (len(loads) - 1))
        P_panel = P_total / n_panels
        
        # Negative moment at support (approximate)
        M_neg = 0.65 * P_panel * span_x / 8  # kNm per m width
        
        Ast = self._calc_flexure_steel(M_neg, d, 30, 500)
        
        bar_dia = 16
        spacing = 1000 * math.pi * bar_dia**2 / 4 / Ast
        spacing = 25 * math.floor(spacing / 25)
        spacing = max(100, min(spacing, 200))
        
        checks.append(f"Top steel at columns: {bar_dia}φ @ {spacing}mm c/c both ways")
        checks.append(f"Bottom steel at midspan: {bar_dia}φ @ {spacing}mm c/c both ways")
        
        flexure_ratio = M_neg / (0.138 * 30 * 1000 * d**2)
        
        status = 'PASS' if max(bearing_ratio, punching_ratio, flexure_ratio) <= 1.0 else 'FAIL'
        
        return FootingDesignResult(
            dimensions={'length': L, 'width': B, 'thickness': D},
            reinforcement={
                'top_both_ways': f"{bar_dia}φ @ {spacing}mm",
                'bottom_both_ways': f"{bar_dia}φ @ {spacing}mm"
            },
            bearing_check=bearing_ratio,
            punching_check=punching_ratio,
            one_way_shear=0,
            flexure_check=flexure_ratio,
            status=status,
            checks=checks
        )
    
    # ============================================
    # HELPER METHODS
    # ============================================
    
    def _calc_flexure_steel(
        self,
        Mu: float,          # kNm per m width
        d: float,           # m
        fck: float,
        fy: float
    ) -> float:
        """
        Calculate required steel area for flexure (mm²/m)
        """
        # Using IS 456 simplified method
        # Mu = 0.87*fy*Ast*d*(1 - Ast*fy/(b*d*fck))
        
        # Solve for Ast
        b = 1.0  # m = 1000mm
        d_mm = d * 1000
        Mu_Nm = Mu * 1e6
        
        # Quadratic: a*Ast² + b*Ast + c = 0
        # where Mu = 0.87*fy*Ast*d - 0.87*fy²*Ast²/(b*fck)
        
        a = -0.87 * fy**2 / (1000 * fck)
        b_coef = 0.87 * fy * d_mm
        c = -Mu_Nm
        
        discriminant = b_coef**2 - 4 * a * c
        
        if discriminant < 0:
            # Doubly reinforced required - return large value
            return 2000
        
        Ast = (-b_coef + math.sqrt(discriminant)) / (2 * a)
        
        if Ast < 0:
            Ast = (-b_coef - math.sqrt(discriminant)) / (2 * a)
        
        return max(Ast, 0)
    
    # ============================================
    # BEARING CAPACITY CALCULATION
    # ============================================
    
    def calculate_bearing_capacity(
        self,
        B: float,           # Foundation width (m)
        D: float,           # Depth of foundation (m)
        factor_of_safety: float = 3.0
    ) -> float:
        """
        Calculate safe bearing capacity using Terzaghi's equation
        """
        c = self.soil.soil_type.cohesion
        phi = self.soil.soil_type.friction_angle
        gamma = self.soil.soil_type.unit_weight
        
        phi_rad = math.radians(phi)
        
        # Bearing capacity factors (Terzaghi)
        if phi == 0:
            Nc = 5.7
            Nq = 1.0
            Ngamma = 0
        else:
            Nq = math.exp(math.pi * math.tan(phi_rad)) * \
                 math.tan(math.radians(45 + phi / 2))**2
            Nc = (Nq - 1) / math.tan(phi_rad)
            Ngamma = 2 * (Nq + 1) * math.tan(phi_rad)
        
        # Ultimate bearing capacity (strip footing)
        q_ult = c * Nc + gamma * D * Nq + 0.5 * gamma * B * Ngamma
        
        # Safe bearing capacity
        q_safe = q_ult / factor_of_safety
        
        return q_safe
