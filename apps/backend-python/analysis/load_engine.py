"""
load_engine.py - Comprehensive Static Loading Engine

Features:
- Trapezoidal/Triangular distributed loads
- Floor/Area load with automatic panel detection
- Temperature loads
- Prestress loads with cable profiles
- Fixed End Actions conversion for solver

Based on standard beam theory and structural mechanics.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Set
from enum import Enum
import numpy as np
from collections import defaultdict
import math


# ============================================
# ENUMERATIONS
# ============================================

class LoadDirection(Enum):
    """Load direction options"""
    LOCAL_X = "local_x"      # Along member axis
    LOCAL_Y = "local_y"      # Perpendicular in local Y
    LOCAL_Z = "local_z"      # Perpendicular in local Z
    GLOBAL_X = "global_x"
    GLOBAL_Y = "global_y"    # Vertical (typically gravity)
    GLOBAL_Z = "global_z"


class DistributionType(Enum):
    """Floor load distribution method"""
    ONE_WAY = "one_way"
    TWO_WAY_TRIANGULAR = "two_way_triangular"
    TWO_WAY_TRAPEZOIDAL = "two_way_trapezoidal"


# ============================================
# NODAL LOAD
# ============================================

@dataclass
class NodalLoad:
    """Direct load applied at a node"""
    id: str
    node_id: str
    fx: float = 0.0  # Force X (kN)
    fy: float = 0.0  # Force Y (kN)
    fz: float = 0.0  # Force Z (kN)
    mx: float = 0.0  # Moment X (kN·m)
    my: float = 0.0  # Moment Y (kN·m)
    mz: float = 0.0  # Moment Z (kN·m)
    load_case: str = "DEAD"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "node_id": self.node_id,
            "fx": self.fx, "fy": self.fy, "fz": self.fz,
            "mx": self.mx, "my": self.my, "mz": self.mz,
            "load_case": self.load_case
        }


# ============================================
# MEMBER DISTRIBUTED LOADS
# ============================================

@dataclass
class UniformLoad:
    """Uniform Distributed Load (UDL) on member"""
    id: str
    member_id: str
    w: float                            # Intensity (kN/m)
    direction: LoadDirection = LoadDirection.GLOBAL_Y
    start_pos: float = 0.0              # Start position ratio (0-1)
    end_pos: float = 1.0                # End position ratio (0-1)
    is_projected: bool = False          # Project based on member angle
    load_case: str = "DEAD"
    
    def get_fixed_end_actions(self, length: float, angle: float = 0.0) -> Dict[str, float]:
        """
        Calculate fixed end forces and moments for a partial UDL.
        
        For a UDL on a simply supported beam:
        - Shear at each end: wL/2
        - Fixed End Moment: wL²/12
        
        For partial UDL from 'a' to 'b' on span L:
        Uses superposition and beam formulas.
        """
        w = self.w
        
        # Apply projection factor for inclined members (e.g., wind on roof)
        if self.is_projected:
            w = w * math.cos(angle)
        
        a = self.start_pos * length
        b = self.end_pos * length
        load_length = b - a
        
        if load_length <= 0:
            return {"Fy_start": 0, "Fy_end": 0, "Mz_start": 0, "Mz_end": 0}
        
        # Total load
        W = w * load_length
        
        # Centroid location from start
        x_bar = (a + b) / 2
        
        # Reactions using statics (simply supported)
        R_end = W * x_bar / length
        R_start = W - R_end
        
        # Fixed end moments (for fixed-fixed beam)
        # Using integration for partial UDL
        # FEM = w * load_length * (centroid_from_support) / ...
        # Simplified using shape functions
        
        # For uniform load from a to b:
        # FEM_A = w * (b-a) * [(L-a-b/2)² / L² + (a² + ab + b²) / (6L)] -- approximate
        # Using standard formulas:
        
        # Simplified FEM for partial UDL (approximate)
        c = (a + b) / 2  # Centroid location
        M_start = -W * c * (length - c) ** 2 / (length ** 2)
        M_end = W * c ** 2 * (length - c) / (length ** 2)
        
        return {
            "Fy_start": R_start,
            "Fy_end": R_end,
            "Mz_start": M_start,
            "Mz_end": M_end
        }


@dataclass  
class TrapezoidalLoad:
    """
    Trapezoidal/Triangular Distributed Load
    
    w1 at start_pos, w2 at end_pos
    If w1 == w2: UDL
    If w1 == 0 or w2 == 0: Triangular
    """
    id: str
    member_id: str
    w1: float                           # Intensity at start (kN/m)
    w2: float                           # Intensity at end (kN/m)
    direction: LoadDirection = LoadDirection.GLOBAL_Y
    start_pos: float = 0.0              # Start position ratio (0-1)
    end_pos: float = 1.0                # End position ratio (0-1)
    is_projected: bool = False
    load_case: str = "DEAD"
    
    def get_fixed_end_actions(self, length: float, angle: float = 0.0) -> Dict[str, float]:
        """
        Calculate fixed end actions for trapezoidal load.
        
        Decomposes into uniform + triangular components.
        
        Triangular load (w increasing from 0 to w_max over length L):
        - R_start = wL/6
        - R_end = wL/3
        - FEM_start = -wL²/30
        - FEM_end = wL²/20
        """
        w1, w2 = self.w1, self.w2
        
        if self.is_projected:
            proj_factor = math.cos(angle)
            w1 *= proj_factor
            w2 *= proj_factor
        
        a = self.start_pos * length
        b = self.end_pos * length
        L = b - a  # Load span
        
        if L <= 0:
            return {"Fy_start": 0, "Fy_end": 0, "Mz_start": 0, "Mz_end": 0}
        
        # Decompose: Trapezoidal = Uniform (min) + Triangular (difference)
        w_min = min(w1, w2)
        w_diff = abs(w2 - w1)
        triangle_points_end = w2 > w1  # True if triangle increases toward end
        
        # Uniform component
        W_uniform = w_min * L
        c_uniform = (a + b) / 2
        
        # Triangular component
        W_triangle = 0.5 * w_diff * L
        if triangle_points_end:
            c_triangle = a + (2 * L / 3)  # Centroid at 2/3 from narrow end
        else:
            c_triangle = a + (L / 3)  # Centroid at 1/3 from narrow end
        
        # Total load and centroid
        W_total = W_uniform + W_triangle
        if W_total > 0:
            c_total = (W_uniform * c_uniform + W_triangle * c_triangle) / W_total
        else:
            c_total = c_uniform
        
        # Reactions (simply supported)
        R_end = W_total * c_total / length
        R_start = W_total - R_end
        
        # Fixed end moments (approximate using equivalent concentrated load)
        M_start = -W_total * c_total * (length - c_total) ** 2 / (length ** 2)
        M_end = W_total * c_total ** 2 * (length - c_total) / (length ** 2)
        
        return {
            "Fy_start": R_start,
            "Fy_end": R_end,
            "Mz_start": M_start,
            "Mz_end": M_end
        }


@dataclass
class PointLoadOnMember:
    """Point load at specific location on member"""
    id: str
    member_id: str
    P: float                            # Load magnitude (kN)
    a: float                            # Distance from start (ratio 0-1)
    direction: LoadDirection = LoadDirection.GLOBAL_Y
    load_case: str = "DEAD"
    
    def get_fixed_end_actions(self, length: float) -> Dict[str, float]:
        """
        Fixed end actions for point load P at distance 'a' from start.
        
        For fixed-fixed beam:
        - R_A = P * b²(3a + b) / L³
        - R_B = P * a²(a + 3b) / L³
        - M_A = -P*a*b² / L²
        - M_B = P*a²*b / L²
        
        Where b = L - a
        """
        a_dist = self.a * length
        b_dist = length - a_dist
        L = length
        P = self.P
        
        if L <= 0:
            return {"Fy_start": 0, "Fy_end": 0, "Mz_start": 0, "Mz_end": 0}
        
        # Reactions
        R_start = P * b_dist / L
        R_end = P * a_dist / L
        
        # Fixed end moments (for fixed-fixed case)
        M_start = -P * a_dist * b_dist ** 2 / (L ** 2)
        M_end = P * a_dist ** 2 * b_dist / (L ** 2)
        
        return {
            "Fy_start": R_start,
            "Fy_end": R_end,
            "Mz_start": M_start,
            "Mz_end": M_end
        }


@dataclass
class MomentOnMember:
    """Applied moment at specific location on member"""
    id: str
    member_id: str
    M: float                            # Moment magnitude (kN·m)
    a: float                            # Distance from start (ratio 0-1)
    about_axis: str = "z"               # 'y' or 'z' (local axes)
    load_case: str = "DEAD"
    
    def get_fixed_end_actions(self, length: float) -> Dict[str, float]:
        """
        Fixed end actions for applied moment M at distance 'a'.
        
        For fixed-fixed beam with moment M at location 'a':
        - FEM_A = M * b * (2a - b) / L²
        - FEM_B = M * a * (2b - a) / L²
        - Shear = ±6M*a*b / L³
        """
        a_dist = self.a * length
        b_dist = length - a_dist
        L = length
        M = self.M
        
        if L <= 0:
            return {"Fy_start": 0, "Fy_end": 0, "Mz_start": 0, "Mz_end": 0}
        
        # Fixed end shears due to moment
        V = 6 * M * a_dist * b_dist / (L ** 3)
        
        # Fixed end moments
        M_start = M * b_dist * (2 * a_dist - b_dist) / (L ** 2)
        M_end = M * a_dist * (2 * b_dist - a_dist) / (L ** 2)
        
        return {
            "Fy_start": V,
            "Fy_end": -V,
            "Mz_start": M_start,
            "Mz_end": M_end
        }


# ============================================
# TEMPERATURE LOAD
# ============================================

@dataclass
class TemperatureLoad:
    """
    Temperature change load on member.
    
    Uniform: Causes axial strain/force
    Gradient: Causes bending (differential temperature across section)
    """
    id: str
    member_id: str
    delta_T: float                      # Temperature change (°C)
    alpha: float = 12e-6                # Thermal expansion coefficient (1/°C)
    gradient_T: Optional[float] = None  # Temperature gradient across depth (°C)
    section_depth: Optional[float] = None  # Section depth for gradient (m)
    load_case: str = "TEMPERATURE"
    
    def get_thermal_strain(self) -> float:
        """Calculate thermal strain ε = α × ΔT"""
        return self.alpha * self.delta_T
    
    def get_thermal_force(self, E: float, A: float) -> float:
        """
        Calculate thermal axial force for restrained member.
        F = E × A × ε = E × A × α × ΔT
        
        Args:
            E: Young's modulus (kN/m²)
            A: Cross-sectional area (m²)
        Returns:
            Axial force (kN) - positive = compression for +ΔT
        """
        epsilon = self.get_thermal_strain()
        return E * A * epsilon
    
    def get_thermal_moment(self, E: float, I: float) -> float:
        """
        Calculate moment due to temperature gradient.
        M = E × I × α × (ΔT_gradient / h)
        
        Args:
            E: Young's modulus (kN/m²)
            I: Moment of inertia (m⁴)
        Returns:
            Bending moment (kN·m)
        """
        if self.gradient_T is None or self.section_depth is None:
            return 0.0
        
        curvature = self.alpha * self.gradient_T / self.section_depth
        return E * I * curvature


# ============================================
# PRESTRESS LOAD
# ============================================

@dataclass
class PrestressLoad:
    """
    Prestress load with cable profile.
    
    Parabolic profile defined by eccentricities at start, mid, and end.
    Calculates equivalent upward forces.
    """
    id: str
    member_id: str
    P: float                            # Prestress force (kN)
    e_start: float                      # Eccentricity at start (m, +ve below centroid)
    e_mid: float                        # Eccentricity at mid-span (m)
    e_end: float                        # Eccentricity at end (m)
    load_case: str = "PRESTRESS"
    
    def get_equivalent_loads(self, length: float) -> Dict[str, float]:
        """
        Calculate equivalent loads for parabolic prestress profile.
        
        For parabolic profile with sag 'e':
        Equivalent UDL = 8 × P × e / L²
        
        End moments = P × eccentricity at ends
        """
        L = length
        P = self.P
        
        # Calculate effective sag (difference from straight line)
        e_straight_mid = (self.e_start + self.e_end) / 2
        sag = self.e_mid - e_straight_mid
        
        # Equivalent upward UDL (if sag is downward, UDL is upward)
        w_eq = -8 * P * sag / (L ** 2) if L > 0 else 0
        
        # End moments due to eccentricity
        M_start = -P * self.e_start  # Negative because hogging
        M_end = -P * self.e_end
        
        return {
            "equivalent_udl": w_eq,
            "moment_start": M_start,
            "moment_end": M_end,
            "prestress_force": P
        }


# ============================================
# FLOOR / AREA LOAD
# ============================================

@dataclass
class FloorLoad:
    """
    Floor/Area load that auto-distributes to supporting beams.
    
    Uses yield line theory for distribution:
    - One-way for aspect ratio > 2
    - Two-way (triangular/trapezoidal) for aspect ratio ≤ 2
    """
    id: str
    pressure: float                     # Load intensity (kN/m²)
    y_level: float                      # Floor Y coordinate
    x_min: float = -float('inf')
    x_max: float = float('inf')
    z_min: float = -float('inf')
    z_max: float = float('inf')
    load_case: str = "LIVE"
    
    @staticmethod
    def detect_panels(
        beams: List[Dict],
        nodes: Dict[str, Dict],
        y_level: float,
        tolerance: float = 0.1
    ) -> List[Dict]:
        """
        Detect closed rectangular panels at given Y level.
        
        Uses cycle detection in beam graph to find closed loops.
        
        Args:
            beams: List of beam dicts with start_node_id, end_node_id
            nodes: Dict of node_id -> {x, y, z}
            y_level: Y coordinate to search at
            tolerance: Y tolerance for beam selection
            
        Returns:
            List of panel dicts with corners and aspect ratio
        """
        # 1. Filter beams at this Y level
        level_beams = []
        for beam in beams:
            start = nodes.get(beam['start_node_id'])
            end = nodes.get(beam['end_node_id'])
            if not start or not end:
                continue
            
            # Check if beam is at this level (horizontal beams at y_level)
            if (abs(start['y'] - y_level) < tolerance and 
                abs(end['y'] - y_level) < tolerance):
                level_beams.append(beam)
        
        if len(level_beams) < 4:
            return []  # Need at least 4 beams for a panel
        
        # 2. Build adjacency graph
        graph = defaultdict(set)
        for beam in level_beams:
            graph[beam['start_node_id']].add(beam['end_node_id'])
            graph[beam['end_node_id']].add(beam['start_node_id'])
        
        # 3. Find rectangular cycles (simplified: look for 4-node cycles)
        panels = []
        visited_cycles = set()
        
        for start_node in graph:
            # BFS to find 4-node rectangular cycles
            panels.extend(
                FloorLoad._find_rectangular_panels(
                    start_node, graph, nodes, visited_cycles
                )
            )
        
        return panels
    
    @staticmethod
    def _find_rectangular_panels(
        start: str,
        graph: Dict[str, Set[str]],
        nodes: Dict[str, Dict],
        visited: Set[frozenset]
    ) -> List[Dict]:
        """Find rectangular 4-node panels starting from a node."""
        panels = []
        
        # Get neighbors
        n1_list = list(graph[start])
        
        for n1 in n1_list:
            for n2 in graph[n1]:
                if n2 == start:
                    continue
                for n3 in graph[n2]:
                    if n3 == start or n3 == n1:
                        continue
                    # Check if n3 connects back to start
                    if start in graph[n3]:
                        # Found a 4-node cycle
                        cycle = frozenset([start, n1, n2, n3])
                        if cycle in visited:
                            continue
                        visited.add(cycle)
                        
                        # Verify it's rectangular
                        corners = [
                            (nodes[start]['x'], nodes[start]['z']),
                            (nodes[n1]['x'], nodes[n1]['z']),
                            (nodes[n2]['x'], nodes[n2]['z']),
                            (nodes[n3]['x'], nodes[n3]['z']),
                        ]
                        
                        # Check rectangularity
                        xs = [c[0] for c in corners]
                        zs = [c[1] for c in corners]
                        
                        x_min, x_max = min(xs), max(xs)
                        z_min, z_max = min(zs), max(zs)
                        
                        Lx = x_max - x_min
                        Lz = z_max - z_min
                        
                        if Lx > 0.1 and Lz > 0.1:  # Valid panel
                            aspect_ratio = max(Lx, Lz) / min(Lx, Lz)
                            
                            panels.append({
                                'nodes': [start, n1, n2, n3],
                                'x_min': x_min, 'x_max': x_max,
                                'z_min': z_min, 'z_max': z_max,
                                'Lx': Lx, 'Lz': Lz,
                                'aspect_ratio': aspect_ratio,
                                'area': Lx * Lz
                            })
        
        return panels
    
    def distribute_to_beams(
        self,
        panels: List[Dict],
        beams: List[Dict],
        nodes: Dict[str, Dict]
    ) -> List[TrapezoidalLoad]:
        """
        Distribute floor load to beams using yield line method.
        
        One-way: Uniform load on long beams only
        Two-way: Triangular/trapezoidal on all beams
        """
        distributed_loads = []
        
        for panel in panels:
            Lx = panel['Lx']
            Lz = panel['Lz']
            ratio = panel['aspect_ratio']
            
            # Identify beams bounding this panel
            panel_beams = self._get_panel_beams(panel, beams, nodes)
            
            if ratio >= 2.0:
                # One-way distribution
                distributed_loads.extend(
                    self._one_way_distribution(panel, panel_beams, Lx, Lz)
                )
            else:
                # Two-way distribution
                distributed_loads.extend(
                    self._two_way_distribution(panel, panel_beams, Lx, Lz)
                )
        
        return distributed_loads
    
    def _get_panel_beams(
        self,
        panel: Dict,
        beams: List[Dict],
        nodes: Dict[str, Dict]
    ) -> Dict[str, List[Dict]]:
        """Identify beams on each edge of the panel."""
        tol = 0.1
        edges = {
            'bottom': [],  # z = z_min
            'top': [],     # z = z_max
            'left': [],    # x = x_min
            'right': []    # x = x_max
        }
        
        for beam in beams:
            start = nodes.get(beam['start_node_id'])
            end = nodes.get(beam['end_node_id'])
            if not start or not end:
                continue
            
            # Check each edge
            x1, x2 = sorted([start['x'], end['x']])
            z1, z2 = sorted([start['z'], end['z']])
            
            # Horizontal beams (along X)
            if abs(z1 - z2) < tol:
                z_pos = (z1 + z2) / 2
                if abs(z_pos - panel['z_min']) < tol:
                    edges['bottom'].append(beam)
                elif abs(z_pos - panel['z_max']) < tol:
                    edges['top'].append(beam)
            
            # Beams along Z
            if abs(x1 - x2) < tol:
                x_pos = (x1 + x2) / 2
                if abs(x_pos - panel['x_min']) < tol:
                    edges['left'].append(beam)
                elif abs(x_pos - panel['x_max']) < tol:
                    edges['right'].append(beam)
        
        return edges
    
    def _one_way_distribution(
        self,
        panel: Dict,
        panel_beams: Dict,
        Lx: float,
        Lz: float
    ) -> List[TrapezoidalLoad]:
        """
        One-way slab distribution (aspect ratio ≥ 2).
        Load goes to short-span beams only.
        """
        loads = []
        
        # Determine short span direction
        if Lx > Lz:
            # Short span in Z direction - load on bottom/top beams
            tributary_width = Lz / 2
            target_beams = panel_beams['bottom'] + panel_beams['top']
        else:
            # Short span in X direction - load on left/right beams
            tributary_width = Lx / 2
            target_beams = panel_beams['left'] + panel_beams['right']
        
        w = self.pressure * tributary_width
        
        for beam in target_beams:
            loads.append(TrapezoidalLoad(
                id=f"floor_{self.id}_{beam['id']}",
                member_id=beam['id'],
                w1=w,
                w2=w,
                direction=LoadDirection.GLOBAL_Y,
                load_case=self.load_case
            ))
        
        return loads
    
    def _two_way_distribution(
        self,
        panel: Dict,
        panel_beams: Dict,
        Lx: float,
        Lz: float
    ) -> List[TrapezoidalLoad]:
        """
        Two-way slab distribution using yield line pattern.
        
        Creates triangular loads on short sides and trapezoidal on long sides.
        45° yield lines from corners.
        """
        loads = []
        
        # Short dimension determines triangular portion
        L_short = min(Lx, Lz)
        L_long = max(Lx, Lz)
        
        # Maximum intensity at 45° yield line intersection
        w_max = self.pressure * L_short / 2
        
        # Triangular portion length (from corner)
        tri_length = L_short / 2
        
        if Lx <= Lz:
            # X is short - triangular on left/right, trapezoidal on bottom/top
            # Left/Right edges - triangular (0 to w_max to 0)
            for beam in panel_beams['left'] + panel_beams['right']:
                loads.append(TrapezoidalLoad(
                    id=f"floor_{self.id}_{beam['id']}",
                    member_id=beam['id'],
                    w1=0,
                    w2=w_max,  # Peak at middle
                    direction=LoadDirection.GLOBAL_Y,
                    start_pos=0.0,
                    end_pos=0.5,
                    load_case=self.load_case
                ))
                loads.append(TrapezoidalLoad(
                    id=f"floor_{self.id}_{beam['id']}_2",
                    member_id=beam['id'],
                    w1=w_max,
                    w2=0,
                    direction=LoadDirection.GLOBAL_Y,
                    start_pos=0.5,
                    end_pos=1.0,
                    load_case=self.load_case
                ))
            
            # Bottom/Top edges - trapezoidal
            trap_ratio = tri_length / L_long if L_long > 0 else 0.5
            for beam in panel_beams['bottom'] + panel_beams['top']:
                loads.append(TrapezoidalLoad(
                    id=f"floor_{self.id}_{beam['id']}",
                    member_id=beam['id'],
                    w1=0,
                    w2=w_max,
                    direction=LoadDirection.GLOBAL_Y,
                    start_pos=0.0,
                    end_pos=trap_ratio,
                    load_case=self.load_case
                ))
                loads.append(TrapezoidalLoad(
                    id=f"floor_{self.id}_{beam['id']}_mid",
                    member_id=beam['id'],
                    w1=w_max,
                    w2=w_max,
                    direction=LoadDirection.GLOBAL_Y,
                    start_pos=trap_ratio,
                    end_pos=1 - trap_ratio,
                    load_case=self.load_case
                ))
                loads.append(TrapezoidalLoad(
                    id=f"floor_{self.id}_{beam['id']}_end",
                    member_id=beam['id'],
                    w1=w_max,
                    w2=0,
                    direction=LoadDirection.GLOBAL_Y,
                    start_pos=1 - trap_ratio,
                    end_pos=1.0,
                    load_case=self.load_case
                ))
        else:
            # Z is short - swap logic
            for beam in panel_beams['bottom'] + panel_beams['top']:
                loads.append(TrapezoidalLoad(
                    id=f"floor_{self.id}_{beam['id']}",
                    member_id=beam['id'],
                    w1=0,
                    w2=w_max,
                    direction=LoadDirection.GLOBAL_Y,
                    start_pos=0.0,
                    end_pos=0.5,
                    load_case=self.load_case
                ))
                loads.append(TrapezoidalLoad(
                    id=f"floor_{self.id}_{beam['id']}_2",
                    member_id=beam['id'],
                    w1=w_max,
                    w2=0,
                    direction=LoadDirection.GLOBAL_Y,
                    start_pos=0.5,
                    end_pos=1.0,
                    load_case=self.load_case
                ))
            
            trap_ratio = tri_length / L_long if L_long > 0 else 0.5
            for beam in panel_beams['left'] + panel_beams['right']:
                loads.append(TrapezoidalLoad(
                    id=f"floor_{self.id}_{beam['id']}",
                    member_id=beam['id'],
                    w1=0,
                    w2=w_max,
                    direction=LoadDirection.GLOBAL_Y,
                    start_pos=0.0,
                    end_pos=trap_ratio,
                    load_case=self.load_case
                ))
                loads.append(TrapezoidalLoad(
                    id=f"floor_{self.id}_{beam['id']}_mid",
                    member_id=beam['id'],
                    w1=w_max,
                    w2=w_max,
                    direction=LoadDirection.GLOBAL_Y,
                    start_pos=trap_ratio,
                    end_pos=1 - trap_ratio,
                    load_case=self.load_case
                ))
                loads.append(TrapezoidalLoad(
                    id=f"floor_{self.id}_{beam['id']}_end",
                    member_id=beam['id'],
                    w1=w_max,
                    w2=0,
                    direction=LoadDirection.GLOBAL_Y,
                    start_pos=1 - trap_ratio,
                    end_pos=1.0,
                    load_case=self.load_case
                ))
        
        return loads


# ============================================
# LOAD CASE & COMBINATION MANAGER
# ============================================

@dataclass
class LoadCase:
    """A named collection of loads"""
    name: str
    description: str = ""
    load_type: str = "DEAD"  # DEAD, LIVE, WIND, SEISMIC, etc.
    nodal_loads: List[NodalLoad] = field(default_factory=list)
    member_loads: List = field(default_factory=list)  # Union of load types
    floor_loads: List[FloorLoad] = field(default_factory=list)
    temperature_loads: List[TemperatureLoad] = field(default_factory=list)
    prestress_loads: List[PrestressLoad] = field(default_factory=list)


@dataclass
class LoadCombination:
    """Load combination with factors"""
    name: str
    description: str = ""
    factors: Dict[str, float] = field(default_factory=dict)  # load_case_name -> factor
    
    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "factors": self.factors
        }


# ============================================
# LOAD ENGINE (Main Class)
# ============================================

class LoadEngine:
    """
    Main class for managing structural loads.
    
    Handles:
    - Load case management
    - Floor load panel detection and distribution
    - Conversion to fixed-end actions for solver
    - Load combination generation
    """
    
    def __init__(self):
        self.load_cases: Dict[str, LoadCase] = {}
        self.combinations: Dict[str, LoadCombination] = {}
        self._init_default_combinations()
    
    def _init_default_combinations(self):
        """Initialize standard load combinations per IS 456 / ASCE 7"""
        # IS 456 combinations
        self.add_combination(LoadCombination(
            name="1.5DL+1.5LL",
            description="IS 456 - Dead + Live",
            factors={"DEAD": 1.5, "LIVE": 1.5}
        ))
        self.add_combination(LoadCombination(
            name="1.2DL+1.2LL+1.2WL",
            description="IS 456 - Dead + Live + Wind",
            factors={"DEAD": 1.2, "LIVE": 1.2, "WIND": 1.2}
        ))
        self.add_combination(LoadCombination(
            name="0.9DL+1.5WL",
            description="IS 456 - Overturning check",
            factors={"DEAD": 0.9, "WIND": 1.5}
        ))
        self.add_combination(LoadCombination(
            name="1.5DL+1.5EQ",
            description="IS 456 - Dead + Seismic",
            factors={"DEAD": 1.5, "SEISMIC": 1.5}
        ))
        
        # Serviceability (unfactored)
        self.add_combination(LoadCombination(
            name="DL+LL",
            description="Serviceability - Deflection check",
            factors={"DEAD": 1.0, "LIVE": 1.0}
        ))
    
    def add_load_case(self, load_case: LoadCase) -> None:
        """Add a load case"""
        self.load_cases[load_case.name] = load_case
    
    def add_combination(self, combo: LoadCombination) -> None:
        """Add a load combination"""
        self.combinations[combo.name] = combo
    
    def process_floor_loads(
        self,
        beams: List[Dict],
        nodes: Dict[str, Dict]
    ) -> Dict[str, List[TrapezoidalLoad]]:
        """
        Process all floor loads and distribute to beams.
        
        Returns dict of load_case_name -> list of member loads
        """
        result = defaultdict(list)
        
        for case in self.load_cases.values():
            for floor_load in case.floor_loads:
                # Detect panels
                panels = FloorLoad.detect_panels(
                    beams, nodes, floor_load.y_level
                )
                
                # Filter panels within bounds
                filtered_panels = [
                    p for p in panels
                    if (p['x_min'] >= floor_load.x_min and 
                        p['x_max'] <= floor_load.x_max and
                        p['z_min'] >= floor_load.z_min and 
                        p['z_max'] <= floor_load.z_max)
                ]
                
                # Distribute to beams
                member_loads = floor_load.distribute_to_beams(
                    filtered_panels, beams, nodes
                )
                
                result[case.name].extend(member_loads)
        
        return dict(result)
    
    def get_fixed_end_actions_for_member(
        self,
        member_id: str,
        length: float,
        load_case: str = None
    ) -> Dict[str, Dict[str, float]]:
        """
        Calculate total fixed end actions for a member from all loads.
        
        Returns dict of direction -> {Fy_start, Fy_end, Mz_start, Mz_end}
        """
        actions = {
            'Fy': {'start': 0, 'end': 0},
            'Mz': {'start': 0, 'end': 0}
        }
        
        cases = [self.load_cases[load_case]] if load_case else self.load_cases.values()
        
        for case in cases:
            for load in case.member_loads:
                if hasattr(load, 'member_id') and load.member_id == member_id:
                    fea = load.get_fixed_end_actions(length)
                    actions['Fy']['start'] += fea.get('Fy_start', 0)
                    actions['Fy']['end'] += fea.get('Fy_end', 0)
                    actions['Mz']['start'] += fea.get('Mz_start', 0)
                    actions['Mz']['end'] += fea.get('Mz_end', 0)
        
        return actions
    
    def export_for_solver(
        self,
        combination_name: str,
        beams: List[Dict],
        nodes: Dict[str, Dict]
    ) -> Dict:
        """
        Export all loads for a combination in solver-ready format.
        
        Returns dict with nodal_loads, member_distributed_loads, etc.
        """
        combo = self.combinations.get(combination_name)
        if not combo:
            return {"error": f"Combination '{combination_name}' not found"}
        
        # Process floor loads first
        floor_member_loads = self.process_floor_loads(beams, nodes)
        
        result = {
            "combination": combination_name,
            "nodal_loads": [],
            "member_loads": [],
            "temperature_loads": [],
            "prestress_loads": []
        }
        
        for case_name, factor in combo.factors.items():
            case = self.load_cases.get(case_name)
            if not case:
                continue
            
            # Nodal loads
            for nl in case.nodal_loads:
                result["nodal_loads"].append({
                    "node_id": nl.node_id,
                    "fx": nl.fx * factor,
                    "fy": nl.fy * factor,
                    "fz": nl.fz * factor,
                    "mx": nl.mx * factor,
                    "my": nl.my * factor,
                    "mz": nl.mz * factor
                })
            
            # Member loads
            for ml in case.member_loads:
                if isinstance(ml, TrapezoidalLoad):
                    result["member_loads"].append({
                        "type": "trapezoidal",
                        "member_id": ml.member_id,
                        "w1": ml.w1 * factor,
                        "w2": ml.w2 * factor,
                        "start_pos": ml.start_pos,
                        "end_pos": ml.end_pos,
                        "direction": ml.direction.value
                    })
                elif isinstance(ml, UniformLoad):
                    result["member_loads"].append({
                        "type": "uniform",
                        "member_id": ml.member_id,
                        "w": ml.w * factor,
                        "start_pos": ml.start_pos,
                        "end_pos": ml.end_pos,
                        "direction": ml.direction.value
                    })
                elif isinstance(ml, PointLoadOnMember):
                    result["member_loads"].append({
                        "type": "point",
                        "member_id": ml.member_id,
                        "P": ml.P * factor,
                        "a": ml.a,
                        "direction": ml.direction.value
                    })
            
            # Add floor loads converted to member loads
            if case_name in floor_member_loads:
                for fl in floor_member_loads[case_name]:
                    result["member_loads"].append({
                        "type": "trapezoidal",
                        "member_id": fl.member_id,
                        "w1": fl.w1 * factor,
                        "w2": fl.w2 * factor,
                        "start_pos": fl.start_pos,
                        "end_pos": fl.end_pos,
                        "direction": fl.direction.value
                    })
            
            # Temperature loads
            for tl in case.temperature_loads:
                result["temperature_loads"].append({
                    "member_id": tl.member_id,
                    "delta_T": tl.delta_T * factor,
                    "alpha": tl.alpha,
                    "gradient_T": tl.gradient_T * factor if tl.gradient_T else None,
                    "section_depth": tl.section_depth
                })
            
            # Prestress loads
            for pl in case.prestress_loads:
                result["prestress_loads"].append({
                    "member_id": pl.member_id,
                    "P": pl.P * factor,
                    "e_start": pl.e_start,
                    "e_mid": pl.e_mid,
                    "e_end": pl.e_end
                })
        
        return result


# ============================================
# UTILITY FUNCTIONS
# ============================================

def create_self_weight_loads(
    members: List[Dict],
    nodes: Dict[str, Dict],
    density: float = 78.5,  # kN/m³ for steel
    gravity: float = 9.81
) -> List[UniformLoad]:
    """
    Generate self-weight loads for all members.
    
    Args:
        members: List of member dicts with 'id', 'start_node_id', 'end_node_id', 'A'
        nodes: Node coordinate dict
        density: Material density (kN/m³)
        
    Returns:
        List of UDL loads representing self-weight
    """
    loads = []
    
    for member in members:
        A = member.get('A', 0.01)  # Cross-sectional area (m²)
        w_self = density * A  # kN/m
        
        loads.append(UniformLoad(
            id=f"sw_{member['id']}",
            member_id=member['id'],
            w=-w_self,  # Negative for downward
            direction=LoadDirection.GLOBAL_Y,
            is_projected=False,
            load_case="DEAD"
        ))
    
    return loads


# ============================================
# EXAMPLE USAGE
# ============================================

if __name__ == "__main__":
    # Create load engine
    engine = LoadEngine()
    
    # Create a load case
    dead_load = LoadCase(
        name="DEAD",
        description="Dead load including self-weight",
        load_type="DEAD"
    )
    
    # Add a trapezoidal load
    dead_load.member_loads.append(TrapezoidalLoad(
        id="trap1",
        member_id="M1",
        w1=10.0,  # 10 kN/m at start
        w2=20.0,  # 20 kN/m at end
        direction=LoadDirection.GLOBAL_Y
    ))
    
    # Add floor load
    dead_load.floor_loads.append(FloorLoad(
        id="floor1",
        pressure=5.0,  # 5 kN/m²
        y_level=3.0    # At Y = 3m
    ))
    
    engine.add_load_case(dead_load)
    
    # Live load case
    live_load = LoadCase(
        name="LIVE",
        description="Imposed load",
        load_type="LIVE"
    )
    
    live_load.floor_loads.append(FloorLoad(
        id="live_floor1",
        pressure=3.0,  # 3 kN/m²
        y_level=3.0
    ))
    
    engine.add_load_case(live_load)
    
    # Test fixed end actions
    trap = TrapezoidalLoad(
        id="test",
        member_id="M1",
        w1=10.0,
        w2=10.0,  # Uniform
        direction=LoadDirection.GLOBAL_Y
    )
    
    fea = trap.get_fixed_end_actions(length=6.0)
    print(f"Fixed End Actions for UDL 10 kN/m on 6m span:")
    print(f"  Fy_start: {fea['Fy_start']:.2f} kN")
    print(f"  Fy_end: {fea['Fy_end']:.2f} kN")
    print(f"  Mz_start: {fea['Mz_start']:.2f} kN·m")
    print(f"  Mz_end: {fea['Mz_end']:.2f} kN·m")
