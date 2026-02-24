"""
cable.py - Non-Linear Member Analysis

Implements special member behaviors:
- Tension-only members (cables, bracing)
- Compression-only members (struts)
- Cable elements with catenary sag
- Iterative solving for member activation/deactivation

Theory:
    Tension-only members cannot carry compression. When analysis
    shows compression in such a member, its stiffness is reduced
    to effectively zero and the system is re-solved iteratively.
    
    For cables, the equivalent modulus accounts for sag:
    E_eq = E / (1 + (wL)²AE / 12T³)
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Set
import numpy as np
import math


# ============================================
# DATA STRUCTURES
# ============================================

class MemberBehavior:
    """Member behavior type"""
    NORMAL = 'normal'
    TENSION_ONLY = 'tension_only'
    COMPRESSION_ONLY = 'compression_only'
    CABLE = 'cable'


@dataclass
class NonLinearMember:
    """Member with non-linear behavior"""
    id: str
    start_node_id: str
    end_node_id: str
    behavior: str = MemberBehavior.NORMAL
    # Properties
    E: float = 200e9      # Young's modulus (Pa)
    A: float = 0.001      # Cross-sectional area (m²)
    # Cable properties
    self_weight: float = 0  # kN/m (for catenary calculation)
    pretension: float = 0   # Initial tension (kN)
    # State
    is_active: bool = True
    current_force: float = 0  # Current axial force (kN)


@dataclass
class CableSagResult:
    """Result of cable catenary analysis"""
    horizontal_tension: float    # Horizontal component of tension (kN)
    max_tension: float           # Maximum cable tension (kN)
    sag: float                   # Maximum sag (m)
    cable_length: float          # Actual cable length (m)
    chord_length: float          # Straight-line distance (m)
    equivalent_modulus: float    # E_eq for linear analysis (Pa)


@dataclass
class NonLinearAnalysisResult:
    """Result of tension/compression-only analysis"""
    success: bool
    iterations: int
    converged: bool
    active_members: Set[str]      # IDs of active members
    inactive_members: Set[str]    # IDs of deactivated members
    member_forces: Dict[str, float]  # member_id -> axial force (kN)
    displacements: Dict[str, Dict[str, float]]  # node_id -> {dx, dy, dz}
    error_message: Optional[str] = None


# ============================================
# NON-LINEAR MEMBER ANALYZER
# ============================================

class NonLinearMemberAnalyzer:
    """
    Iterative analysis for tension/compression-only members
    
    Algorithm:
    1. Start with all members active
    2. Solve linear system
    3. Check member forces against behavior type
    4. Deactivate members with wrong-sign forces
    5. Repeat until no status changes
    """
    
    def __init__(
        self,
        members: List[NonLinearMember],
        nodes: Dict[str, dict],
        stiffness_builder: callable,  # Function to build K matrix
        max_iterations: int = 20,
        force_tolerance: float = 0.1  # kN
    ):
        self.members = {m.id: m for m in members}
        self.nodes = nodes
        self.stiffness_builder = stiffness_builder
        self.max_iterations = max_iterations
        self.force_tolerance = force_tolerance
    
    def analyze(
        self,
        force_vector: np.ndarray,
        free_dof: List[int]
    ) -> NonLinearAnalysisResult:
        """
        Perform iterative analysis with tension/compression-only members
        """
        # Initialize all members as active
        active_members = set(m.id for m in self.members.values())
        inactive_members = set()
        
        converged = False
        iteration = 0
        member_forces = {}
        displacements = {}
        
        while iteration < self.max_iterations:
            iteration += 1
            
            # Update member stiffnesses
            for member in self.members.values():
                if member.id in inactive_members:
                    member.is_active = False
                else:
                    member.is_active = True
            
            # Build stiffness matrix with current active members
            K = self.stiffness_builder(self.members, self.nodes)
            
            # Extract free DOF
            K_ff = K[np.ix_(free_dof, free_dof)]
            F_f = force_vector[free_dof]
            
            # Solve
            try:
                d_f = np.linalg.solve(K_ff, F_f)
            except np.linalg.LinAlgError:
                return NonLinearAnalysisResult(
                    success=False,
                    iterations=iteration,
                    converged=False,
                    active_members=active_members,
                    inactive_members=inactive_members,
                    member_forces=member_forces,
                    displacements=displacements,
                    error_message="Linear solve failed - structure may be unstable"
                )
            
            # Full displacement vector
            d = np.zeros(len(K))
            d[free_dof] = d_f
            
            # Calculate member forces
            member_forces = self._calculate_member_forces(d)
            
            # Check for members that need status change
            status_changed = False
            new_inactive = set()
            new_active = set()
            
            for member in self.members.values():
                force = member_forces.get(member.id, 0)
                
                if member.behavior == MemberBehavior.TENSION_ONLY:
                    # Tension-only: deactivate if compression
                    if force < -self.force_tolerance and member.id in active_members:
                        new_inactive.add(member.id)
                        status_changed = True
                    elif force >= 0 and member.id in inactive_members:
                        new_active.add(member.id)
                        status_changed = True
                        
                elif member.behavior == MemberBehavior.COMPRESSION_ONLY:
                    # Compression-only: deactivate if tension
                    if force > self.force_tolerance and member.id in active_members:
                        new_inactive.add(member.id)
                        status_changed = True
                    elif force <= 0 and member.id in inactive_members:
                        new_active.add(member.id)
                        status_changed = True
            
            # Update sets
            active_members = active_members - new_inactive | new_active
            inactive_members = inactive_members | new_inactive - new_active
            
            if not status_changed:
                converged = True
                break
        
        # Build displacement dictionary
        n_nodes = len(d) // 6
        for i, (node_id, node) in enumerate(self.nodes.items()):
            dof = node.get('dof_indices', list(range(i*6, (i+1)*6)))
            if len(dof) >= 3:
                displacements[node_id] = {
                    'dx': d[dof[0]] * 1000,  # mm
                    'dy': d[dof[1]] * 1000,
                    'dz': d[dof[2]] * 1000,
                }
        
        return NonLinearAnalysisResult(
            success=True,
            iterations=iteration,
            converged=converged,
            active_members=active_members,
            inactive_members=inactive_members,
            member_forces=member_forces,
            displacements=displacements
        )
    
    def _calculate_member_forces(
        self,
        displacements: np.ndarray
    ) -> Dict[str, float]:
        """Calculate axial forces in all members"""
        forces = {}
        
        for member in self.members.values():
            if not member.is_active:
                forces[member.id] = 0
                continue
            
            start = self.nodes[member.start_node_id]
            end = self.nodes[member.end_node_id]
            
            # Calculate length
            dx = end['x'] - start['x']
            dy = end['y'] - start['y']
            dz = end['z'] - start['z']
            L = math.sqrt(dx*dx + dy*dy + dz*dz)
            
            if L < 1e-10:
                forces[member.id] = 0
                continue
            
            # Direction cosines
            cx = dx / L
            cy = dy / L
            cz = dz / L
            
            # Get nodal displacements
            start_dof = start.get('dof_indices', [0, 1, 2, 3, 4, 5])
            end_dof = end.get('dof_indices', [6, 7, 8, 9, 10, 11])
            
            u1 = displacements[start_dof[0]] if start_dof[0] < len(displacements) else 0
            v1 = displacements[start_dof[1]] if start_dof[1] < len(displacements) else 0
            w1 = displacements[start_dof[2]] if start_dof[2] < len(displacements) else 0
            u2 = displacements[end_dof[0]] if end_dof[0] < len(displacements) else 0
            v2 = displacements[end_dof[1]] if end_dof[1] < len(displacements) else 0
            w2 = displacements[end_dof[2]] if end_dof[2] < len(displacements) else 0
            
            # Axial elongation
            delta_L = (u2 - u1) * cx + (v2 - v1) * cy + (w2 - w1) * cz
            
            # Axial force (tension positive)
            strain = delta_L / L
            force = member.E * member.A * strain / 1000  # Convert to kN
            
            forces[member.id] = force
            member.current_force = force
        
        return forces


# ============================================
# CABLE ANALYZER
# ============================================

class CableAnalyzer:
    """
    Cable analysis with catenary sag effects
    
    For cables under self-weight, the shape is a catenary.
    The equivalent modulus accounts for the geometric stiffness
    reduction due to sag.
    """
    
    @staticmethod
    def calculate_catenary(
        chord_length: float,    # m
        self_weight: float,     # kN/m
        horizontal_tension: float  # kN
    ) -> CableSagResult:
        """
        Calculate catenary cable properties
        
        Args:
            chord_length: Horizontal span (m)
            self_weight: Weight per unit length (kN/m)
            horizontal_tension: Horizontal component of tension (kN)
            
        Returns:
            CableSagResult with sag, tensions, and equivalent modulus
        """
        L = chord_length
        w = self_weight
        H = horizontal_tension
        
        if w <= 0 or H <= 0:
            return CableSagResult(
                horizontal_tension=H,
                max_tension=H,
                sag=0,
                cable_length=L,
                chord_length=L,
                equivalent_modulus=float('inf')
            )
        
        # Catenary parameter
        c = H / w
        
        # Cable length (arc length of catenary)
        # S = 2c * sinh(L / (2c))
        try:
            S = 2 * c * math.sinh(L / (2 * c))
        except OverflowError:
            S = L
        
        # Maximum sag at midspan
        # f = c * (cosh(L/(2c)) - 1)
        try:
            f = c * (math.cosh(L / (2 * c)) - 1)
        except OverflowError:
            f = w * L**2 / (8 * H)  # Parabolic approximation
        
        # Maximum tension (at supports)
        T_max = math.sqrt(H**2 + (w * S / 2)**2)
        
        # Equivalent modulus for linear analysis
        # E_eq = E / (1 + (wL)²AE / (12T³))
        # We'll return a factor instead since we don't have E, A here
        # The equivalent modulus factor is: 1 / (1 + (wL)²/(12T³) * stiffness_factor)
        
        return CableSagResult(
            horizontal_tension=H,
            max_tension=T_max,
            sag=f,
            cable_length=S,
            chord_length=L,
            equivalent_modulus=0  # Caller should use get_equivalent_modulus
        )
    
    @staticmethod
    def get_equivalent_modulus(
        E: float,           # Young's modulus (Pa)
        A: float,           # Cross-sectional area (m²)
        L: float,           # Span (m)
        w: float,           # Weight per length (kN/m)
        T: float            # Tension in cable (kN)
    ) -> float:
        """
        Calculate equivalent modulus for cable element
        
        E_eq = E / (1 + (wL)²AE / (12T³))
        
        This accounts for the "sag effect" - as tension decreases,
        the cable sags more and becomes less stiff.
        """
        if T <= 0:
            return E * 0.01  # Very low stiffness for slack cable
        
        # Convert units: w is kN/m, T is kN
        # Formula expects consistent units
        w_N = w * 1000  # Convert to N/m
        T_N = T * 1000  # Convert to N
        
        sag_factor = (w_N * L)**2 * A * E / (12 * T_N**3)
        
        E_eq = E / (1 + sag_factor)
        
        return max(E_eq, E * 0.001)  # Minimum stiffness
    
    @staticmethod
    def solve_cable_tension(
        chord_length: float,    # m
        vertical_load: float,   # Total vertical load (kN)
        sag_ratio: float = 0.05  # Sag / Span ratio
    ) -> Tuple[float, float]:
        """
        Calculate cable tension for given sag ratio
        
        For parabolic approximation:
        H = wL² / (8f) where f = sag
        
        Args:
            chord_length: Horizontal span (m)
            vertical_load: Total vertical load (kN)
            sag_ratio: Desired sag/span ratio
            
        Returns:
            Tuple of (horizontal_tension, max_tension) in kN
        """
        L = chord_length
        W = vertical_load
        f = sag_ratio * L
        
        if f <= 0:
            return (float('inf'), float('inf'))
        
        # Horizontal tension (parabolic approximation)
        H = W * L / (8 * f)
        
        # Maximum tension at supports
        T_max = math.sqrt(H**2 + (W / 2)**2)
        
        return (H, T_max)
    
    @staticmethod
    def design_cable(
        span: float,           # m
        total_load: float,     # kN
        max_sag: float,        # m (maximum allowable sag)
        allowable_stress: float = 1000e6,  # Pa
        E: float = 200e9       # Pa
    ) -> Dict[str, float]:
        """
        Design a cable for given conditions
        
        Returns required area, diameter, and tensions
        """
        H, T_max = CableAnalyzer.solve_cable_tension(
            span, total_load, max_sag / span
        )
        
        # Required area
        A_required = T_max * 1000 / allowable_stress  # m²
        
        # Equivalent diameter
        D = 2 * math.sqrt(A_required / math.pi)
        
        # Weight of cable (steel)
        density = 7850  # kg/m³
        g = 9.81
        
        # Iterative solution including self-weight
        for _ in range(5):
            cable_weight = density * A_required * span * g / 1000  # kN
            total_with_self = total_load + cable_weight
            H, T_max = CableAnalyzer.solve_cable_tension(
                span, total_with_self, max_sag / span
            )
            A_required = T_max * 1000 / allowable_stress
        
        return {
            'area_required': A_required * 1e6,  # mm²
            'diameter': D * 1000,               # mm
            'horizontal_tension': H,            # kN
            'max_tension': T_max,               # kN
            'sag': max_sag,                     # m
            'cable_length': span * (1 + 8/3 * (max_sag/span)**2)  # Approximate
        }
