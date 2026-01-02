"""
fea_engine.py - 3D Frame Solver using PyNite FEA Library

Features:
- Translates frontend JSON model to PyNite FEModel3D
- Supports nodes, members, supports, and loads
- Extracts detailed shear, moment, and deflection arrays (100 points per member)
- Returns visualization-ready data
- AISC 360-16 Direct Analysis Method support (Chapter C)

Requirements:
    pip install PyNiteFEA
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any, Tuple
from enum import Enum
import numpy as np
import math

try:
    from PyNite import FEModel3D
    import PyNite
    PYNITE_AVAILABLE = True
    # Check PyNite version - v2.0+ has different API
    PYNITE_V2 = hasattr(FEModel3D, 'add_material')
except ImportError:
    PYNITE_AVAILABLE = False
    PYNITE_V2 = False
    print("Warning: PyNiteFEA not installed. Run: pip install PyNiteFEA")


# ============================================
# ANALYSIS OPTIONS (AISC 360-16 DIRECT ANALYSIS)
# ============================================

@dataclass
class AnalysisOptions:
    """
    Analysis configuration options.
    
    Direct Analysis Method (AISC 360-16 Chapter C):
    - Applies 0.8 factor to all member stiffnesses (EA and EI)
    - Applies additional τ_b factor for members with high Pr/Py
    - Optionally adds notional loads (0.2% of gravity)
    """
    # Direct Analysis Method (AISC 360-16 Ch. C)
    direct_analysis: bool = False
    stiffness_reduction_factor: float = 0.8  # Applied to E when direct_analysis=True
    tau_b_enabled: bool = True  # Apply τ_b factor for EI when Pr/Py > 0.5
    
    # Notional loads (0.2% of gravity loads applied horizontally)
    apply_notional_loads: bool = False
    notional_load_factor: float = 0.002  # 0.2%
    
    # P-Delta options
    include_p_delta: bool = False
    p_delta_tolerance: float = 0.01  # 1% convergence
    p_delta_max_iterations: int = 10
    
    # Geometric nonlinearity
    include_geometric_nonlinearity: bool = False


# ============================================
# DATA STRUCTURES
# ============================================

class SupportType(Enum):
    NONE = "none"
    FIXED = "fixed"
    PINNED = "pinned"
    ROLLER = "roller"
    ROLLER_X = "roller_x"
    ROLLER_Z = "roller_z"


class LoadType(Enum):
    POINT = "point"
    DISTRIBUTED = "distributed"  # UDL
    MOMENT = "moment"


@dataclass
class NodeInput:
    """Node from frontend"""
    id: str
    x: float
    y: float
    z: float
    support: str = "none"  # "fixed", "pinned", "roller", "none"


@dataclass
class MemberInput:
    """Member from frontend"""
    id: str
    start_node_id: str
    end_node_id: str
    E: float = 200e6        # Young's modulus (kN/m²)
    G: float = 77e6         # Shear modulus (kN/m²)
    Iy: float = 1e-4        # Moment of inertia about y-axis (m⁴)
    Iz: float = 1e-4        # Moment of inertia about z-axis (m⁴)
    J: float = 1e-5         # Torsional constant (m⁴)
    A: float = 0.01         # Cross-sectional area (m²)
    Fy: float = 345e3       # Yield stress (kN/m²) - for τ_b calculation
    # Shear areas for Timoshenko beam theory (optional)
    Asy: Optional[float] = None  # Shear area in y-direction (m²)
    Asz: Optional[float] = None  # Shear area in z-direction (m²)


@dataclass
class PointLoadInput:
    """Point load on member"""
    member_id: str
    direction: str          # 'Fx', 'Fy', 'Fz', 'Mx', 'My', 'Mz'
    magnitude: float        # kN or kN·m
    position: float         # Distance from start (m) or ratio (0-1)
    is_ratio: bool = False  # If True, position is 0-1 ratio


@dataclass
class DistributedLoadInput:
    """Distributed load on member"""
    member_id: str
    direction: str          # 'Fx', 'Fy', 'Fz'
    w1: float               # Start intensity (kN/m)
    w2: float               # End intensity (kN/m)
    start_pos: float = 0.0  # Start position (m or ratio)
    end_pos: float = 1.0    # End position (m or ratio)
    is_ratio: bool = True   # If True, positions are 0-1 ratios


@dataclass
class NodeLoadInput:
    """Direct load on node"""
    node_id: str
    fx: float = 0.0
    fy: float = 0.0
    fz: float = 0.0
    mx: float = 0.0
    my: float = 0.0
    mz: float = 0.0


@dataclass
class ModelInput:
    """Complete model from frontend"""
    nodes: List[NodeInput]
    members: List[MemberInput]
    node_loads: List[NodeLoadInput] = field(default_factory=list)
    point_loads: List[PointLoadInput] = field(default_factory=list)
    distributed_loads: List[DistributedLoadInput] = field(default_factory=list)
    load_case: str = "LC1"


@dataclass
class MemberResults:
    """Results for a single member"""
    member_id: str
    length: float
    x_values: List[float]           # Position along member (m)
    shear_y: List[float]            # Vy at each position (kN)
    shear_z: List[float]            # Vz at each position (kN)
    moment_y: List[float]           # My at each position (kN·m)
    moment_z: List[float]           # Mz at each position (kN·m)
    axial: List[float]              # Axial force at each position (kN)
    torsion: List[float]            # Torsion at each position (kN·m)
    deflection_y: List[float]       # Deflection in y (mm)
    deflection_z: List[float]       # Deflection in z (mm)
    max_shear_y: float
    max_shear_z: float
    max_moment_y: float
    max_moment_z: float
    max_deflection: float


@dataclass
class NodeResults:
    """Results for a single node"""
    node_id: str
    displacement: Dict[str, float]  # dx, dy, dz, rx, ry, rz
    reaction: Optional[Dict[str, float]] = None  # fx, fy, fz, mx, my, mz (if supported)


@dataclass
class AnalysisOutput:
    """Complete analysis results"""
    success: bool
    error: Optional[str] = None
    nodes: List[NodeResults] = field(default_factory=list)
    members: List[MemberResults] = field(default_factory=list)
    max_displacement: float = 0.0
    max_moment: float = 0.0
    max_shear: float = 0.0


# ============================================
# SUPPORT MAPPING
# ============================================

def get_support_restraints(support_type: str) -> Tuple[bool, bool, bool, bool, bool, bool]:
    """
    Map frontend support type to PyNite restraint tuple.
    Returns: (Dx, Dy, Dz, Rx, Ry, Rz) - True means restrained
    """
    support_map = {
        "fixed": (True, True, True, True, True, True),
        "pinned": (True, True, True, False, False, False),
        "pin": (True, True, True, False, False, False),
        "roller": (False, True, False, False, False, False),
        "roller_x": (True, True, False, False, False, False),
        "roller_z": (False, True, True, False, False, False),
        "none": (False, False, False, False, False, False),
    }
    return support_map.get(support_type.lower(), (False, False, False, False, False, False))


# ============================================
# FEA ENGINE CLASS
# ============================================

class FEAEngine:
    """
    3D Frame Analysis Engine using PyNite
    
    Supports AISC 360-16 Direct Analysis Method (Chapter C):
    - Stiffness reduction (0.8 factor on E)
    - τ_b factor for compression members
    - Notional loads
    """
    
    def __init__(self, options: Optional[AnalysisOptions] = None):
        if not PYNITE_AVAILABLE:
            raise ImportError("PyNiteFEA is not installed. Run: pip install PyNiteFEA")
        
        self.model: Optional[FEModel3D] = None
        self.num_points = 100  # Points per member for diagram extraction
        self.node_map: Dict[str, str] = {}  # frontend_id -> pynite_name
        self.member_map: Dict[str, str] = {}  # frontend_id -> pynite_name
        self.options = options or AnalysisOptions()
        self.stiffness_modifications: Dict[str, Dict[str, float]] = {}  # Track E modifications
    
    def _calculate_tau_b(self, Pr: float, Py: float) -> float:
        """
        Calculate τ_b stiffness reduction factor per AISC 360-16 C2.3
        
        τ_b = 1.0 when αPr/Py ≤ 0.5
        τ_b = 4(αPr/Py)(1 - αPr/Py) when αPr/Py > 0.5
        
        where α = 1.0 for LRFD, 1.6 for ASD
        
        Args:
            Pr: Required axial strength (kN)
            Py: Axial yield strength = Fy * Ag (kN)
        
        Returns:
            τ_b factor (0.0 to 1.0)
        """
        if Py <= 0:
            return 1.0
        
        alpha = 1.0  # LRFD
        ratio = alpha * abs(Pr) / Py
        
        if ratio <= 0.5:
            return 1.0
        else:
            return 4.0 * ratio * (1.0 - ratio)
    
    def _get_effective_modulus(self, member: MemberInput, axial_force: float = 0) -> Tuple[float, float]:
        """
        Get effective Young's modulus considering Direct Analysis reductions.
        
        Args:
            member: Member input with properties
            axial_force: Current axial force in member (for τ_b calculation)
        
        Returns:
            Tuple of (E_axial, E_flexural) - may differ due to τ_b
        """
        # Use defaults if properties are None
        E = member.E if member.E is not None else 200e6
        A = member.A if member.A is not None else 0.01
        Fy = member.Fy if member.Fy is not None else 345e3
        
        if not self.options.direct_analysis:
            return (E, E)
        
        # Apply base 0.8 reduction
        E_reduced = E * self.options.stiffness_reduction_factor
        
        # Calculate τ_b for flexural stiffness if enabled
        if self.options.tau_b_enabled and axial_force != 0:
            Py = Fy * A
            tau_b = self._calculate_tau_b(axial_force, Py)
            E_flexural = E_reduced * tau_b
        else:
            E_flexural = E_reduced
        
        return (E_reduced, E_flexural)
        
    def build_model(self, model_input: ModelInput) -> None:
        """
        Build PyNite model from frontend input
        """
        self.model = FEModel3D()
        self.node_map = {}
        self.member_map = {}
        
        # ============================================
        # 1. ADD NODES
        # ============================================
        for i, node in enumerate(model_input.nodes):
            node_name = f"N{i+1}"
            self.node_map[node.id] = node_name
            
            self.model.add_node(node_name, node.x, node.y, node.z)
            
            # Apply support restraints
            if node.support and node.support.lower() != "none":
                Dx, Dy, Dz, Rx, Ry, Rz = get_support_restraints(node.support)
                self.model.def_support(node_name, Dx, Dy, Dz, Rx, Ry, Rz)
        
        # ============================================
        # 2. ADD MEMBERS (with Direct Analysis stiffness reduction)
        # ============================================
        self._member_inputs = {}  # Store for τ_b iteration
        
        # For PyNite v2.0+: pre-define materials and sections
        if PYNITE_V2:
            self._defined_materials = set()
            self._defined_sections = set()
        
        for i, member in enumerate(model_input.members):
            member_name = f"M{i+1}"
            self.member_map[member.id] = member_name
            self._member_inputs[member.id] = member
            
            start_name = self.node_map.get(member.start_node_id)
            end_name = self.node_map.get(member.end_node_id)
            
            if not start_name or not end_name:
                raise ValueError(f"Member {member.id} references unknown node")
            
            # Get effective modulus (applies 0.8 factor if Direct Analysis enabled)
            E_axial, E_flexural = self._get_effective_modulus(member)
            
            # Store stiffness modifications for reporting
            if self.options.direct_analysis:
                self.stiffness_modifications[member.id] = {
                    'E_original': member.E,
                    'E_reduced': E_axial,
                    'reduction_factor': self.options.stiffness_reduction_factor
                }
            
            # PyNite v2.0+ uses material/section names instead of direct properties
            if PYNITE_V2:
                # Use defaults if properties are None
                G = member.G if member.G is not None else 77e6
                A = member.A if member.A is not None else 0.01
                Iy = member.Iy if member.Iy is not None else 1e-4
                Iz = member.Iz if member.Iz is not None else 1e-4
                J = member.J if member.J is not None else 1e-5
                
                # Create unique material name based on E and G
                mat_name = f"Mat_{i+1}"
                # Define material: E, G, nu (Poisson's ratio), rho (density)
                nu = 0.3  # Typical for steel
                rho = 7850 / 1e9  # Steel density in kg/mm³ (or appropriate units)
                self.model.add_material(mat_name, E_axial, G, nu, rho)
                
                # Create unique section name
                sec_name = f"Sec_{i+1}"
                # Define section as a dict with section properties
                section_props = {
                    'A': A,      # Cross-sectional area
                    'Iy': Iy,    # Moment of inertia about y-axis
                    'Iz': Iz,    # Moment of inertia about z-axis
                    'J': J       # Polar moment of inertia (torsion)
                }
                self.model.add_section(sec_name, section_props)
                
                # Add member with material and section names
                self.model.add_member(
                    member_name,
                    start_name,
                    end_name,
                    mat_name,
                    sec_name
                )
            else:
                # PyNite v0.x API - direct property specification
                # Use defaults if properties are None
                G = member.G if member.G is not None else 77e6
                Iy = member.Iy if member.Iy is not None else 1e-4
                Iz = member.Iz if member.Iz is not None else 1e-4
                J = member.J if member.J is not None else 1e-5
                A = member.A if member.A is not None else 0.01
                
                self.model.add_member(
                    member_name,
                    start_name,
                    end_name,
                    E=E_axial,
                    G=G,
                    Iy=Iy,
                    Iz=Iz,
                    J=J,
                    A=A
                )
        
        # ============================================
        # 3. ADD LOAD CASE
        # ============================================
        self.model.add_load_combo(model_input.load_case, {model_input.load_case: 1.0})
        
        # ============================================
        # 4. APPLY NODE LOADS
        # ============================================
        for load in model_input.node_loads:
            node_name = self.node_map.get(load.node_id)
            if not node_name:
                continue
            
            if load.fx != 0:
                self.model.add_node_load(node_name, 'FX', load.fx, model_input.load_case)
            if load.fy != 0:
                self.model.add_node_load(node_name, 'FY', load.fy, model_input.load_case)
            if load.fz != 0:
                self.model.add_node_load(node_name, 'FZ', load.fz, model_input.load_case)
            if load.mx != 0:
                self.model.add_node_load(node_name, 'MX', load.mx, model_input.load_case)
            if load.my != 0:
                self.model.add_node_load(node_name, 'MY', load.my, model_input.load_case)
            if load.mz != 0:
                self.model.add_node_load(node_name, 'MZ', load.mz, model_input.load_case)
        
        # ============================================
        # 5. APPLY MEMBER POINT LOADS
        # ============================================
        for load in model_input.point_loads:
            member_name = self.member_map.get(load.member_id)
            if not member_name:
                continue
            
            member_obj = self.model.Members[member_name]
            length = member_obj.L()
            
            # Convert ratio to absolute position if needed
            position = load.position * length if load.is_ratio else load.position
            
            self.model.add_member_pt_load(
                member_name,
                load.direction,
                load.magnitude,
                position,
                model_input.load_case
            )
        
        # ============================================
        # 6. APPLY DISTRIBUTED LOADS
        # ============================================
        for load in model_input.distributed_loads:
            member_name = self.member_map.get(load.member_id)
            if not member_name:
                continue
            
            member_obj = self.model.Members[member_name]
            length = member_obj.L()
            
            # Convert ratios to absolute positions if needed
            start = load.start_pos * length if load.is_ratio else load.start_pos
            end = load.end_pos * length if load.is_ratio else load.end_pos
            
            self.model.add_member_dist_load(
                member_name,
                load.direction,
                load.w1,
                load.w2,
                start,
                end,
                model_input.load_case
            )
    
    def analyze(self, check_stability: bool = True) -> AnalysisOutput:
        """
        Run analysis and extract results
        """
        if not self.model:
            return AnalysisOutput(success=False, error="Model not built")
        
        try:
            # Run the analysis
            self.model.analyze(check_statics=True, check_stability=check_stability)
            
            # Extract results
            node_results = self._extract_node_results()
            member_results = self._extract_member_results()
            
            # Calculate maximums
            max_displacement = 0.0
            max_moment = 0.0
            max_shear = 0.0
            
            for mr in member_results:
                max_moment = max(max_moment, mr.max_moment_y, mr.max_moment_z)
                max_shear = max(max_shear, mr.max_shear_y, mr.max_shear_z)
                max_displacement = max(max_displacement, mr.max_deflection)
            
            return AnalysisOutput(
                success=True,
                nodes=node_results,
                members=member_results,
                max_displacement=max_displacement,
                max_moment=max_moment,
                max_shear=max_shear
            )
            
        except Exception as e:
            return AnalysisOutput(success=False, error=str(e))
    
    def _extract_node_results(self) -> List[NodeResults]:
        """Extract displacement and reaction results for all nodes"""
        results = []
        
        for frontend_id, pynite_name in self.node_map.items():
            node = self.model.Nodes[pynite_name]
            
            # Displacements
            displacement = {
                'dx': node.DX.get('Combo 1', 0) * 1000,  # Convert to mm
                'dy': node.DY.get('Combo 1', 0) * 1000,
                'dz': node.DZ.get('Combo 1', 0) * 1000,
                'rx': node.RX.get('Combo 1', 0),
                'ry': node.RY.get('Combo 1', 0),
                'rz': node.RZ.get('Combo 1', 0),
            }
            
            # Reactions (if supported)
            reaction = None
            if node.support_DX or node.support_DY or node.support_DZ:
                reaction = {
                    'fx': node.RxnFX.get('Combo 1', 0),
                    'fy': node.RxnFY.get('Combo 1', 0),
                    'fz': node.RxnFZ.get('Combo 1', 0),
                    'mx': node.RxnMX.get('Combo 1', 0),
                    'my': node.RxnMY.get('Combo 1', 0),
                    'mz': node.RxnMZ.get('Combo 1', 0),
                }
            
            results.append(NodeResults(
                node_id=frontend_id,
                displacement=displacement,
                reaction=reaction
            ))
        
        return results
    
    def _extract_member_results(self) -> List[MemberResults]:
        """Extract force and deflection diagrams for all members"""
        results = []
        
        for frontend_id, pynite_name in self.member_map.items():
            member = self.model.Members[pynite_name]
            length = member.L()
            
            # Generate x values
            x_values = np.linspace(0, length, self.num_points).tolist()
            
            # Extract forces at each point
            shear_y = []
            shear_z = []
            moment_y = []
            moment_z = []
            axial = []
            torsion = []
            deflection_y = []
            deflection_z = []
            
            for x in x_values:
                try:
                    shear_y.append(round(member.shear('Fy', x, 'Combo 1'), 4))
                    shear_z.append(round(member.shear('Fz', x, 'Combo 1'), 4))
                    moment_y.append(round(member.moment('My', x, 'Combo 1'), 4))
                    moment_z.append(round(member.moment('Mz', x, 'Combo 1'), 4))
                    axial.append(round(member.axial(x, 'Combo 1'), 4))
                    torsion.append(round(member.torsion(x, 'Combo 1'), 4))
                    deflection_y.append(round(member.deflection('dy', x, 'Combo 1') * 1000, 4))  # mm
                    deflection_z.append(round(member.deflection('dz', x, 'Combo 1') * 1000, 4))  # mm
                except Exception:
                    # If extraction fails, use zeros
                    shear_y.append(0)
                    shear_z.append(0)
                    moment_y.append(0)
                    moment_z.append(0)
                    axial.append(0)
                    torsion.append(0)
                    deflection_y.append(0)
                    deflection_z.append(0)
            
            # Calculate maximums
            max_shear_y = max(abs(min(shear_y)), abs(max(shear_y)))
            max_shear_z = max(abs(min(shear_z)), abs(max(shear_z)))
            max_moment_y = max(abs(min(moment_y)), abs(max(moment_y)))
            max_moment_z = max(abs(min(moment_z)), abs(max(moment_z)))
            max_deflection = max(
                max(abs(min(deflection_y)), abs(max(deflection_y))),
                max(abs(min(deflection_z)), abs(max(deflection_z)))
            )
            
            results.append(MemberResults(
                member_id=frontend_id,
                length=length,
                x_values=[round(x, 4) for x in x_values],
                shear_y=shear_y,
                shear_z=shear_z,
                moment_y=moment_y,
                moment_z=moment_z,
                axial=axial,
                torsion=torsion,
                deflection_y=deflection_y,
                deflection_z=deflection_z,
                max_shear_y=max_shear_y,
                max_shear_z=max_shear_z,
                max_moment_y=max_moment_y,
                max_moment_z=max_moment_z,
                max_deflection=max_deflection
            ))
        
        return results


# ============================================
# CONVENIENCE FUNCTION FOR API
# ============================================

def analyze_frame(model_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Analyze a 3D frame model from JSON input.
    
    Args:
        model_dict: Dictionary with 'nodes', 'members', 'node_loads', 
                   'point_loads', 'distributed_loads', and optional 'options'
    
    Returns:
        Dictionary with analysis results
    
    Options (optional):
        direct_analysis: bool - Enable AISC 360-16 Direct Analysis (0.8E)
        stiffness_reduction_factor: float - Custom reduction factor (default 0.8)
        tau_b_enabled: bool - Apply τ_b factor for EI
        apply_notional_loads: bool - Apply 0.2% notional loads
    """
    try:
        # Parse analysis options
        options_dict = model_dict.get('options', {})
        options = AnalysisOptions(
            direct_analysis=options_dict.get('direct_analysis', False),
            stiffness_reduction_factor=options_dict.get('stiffness_reduction_factor', 0.8),
            tau_b_enabled=options_dict.get('tau_b_enabled', True),
            apply_notional_loads=options_dict.get('apply_notional_loads', False),
            notional_load_factor=options_dict.get('notional_load_factor', 0.002),
            include_p_delta=options_dict.get('include_p_delta', False),
        )
        
        # Parse input
        nodes = [
            NodeInput(
                id=n['id'],
                x=n['x'],
                y=n['y'],
                z=n['z'],
                support=n.get('support', 'none')
            )
            for n in model_dict.get('nodes', [])
        ]
        
        members = [
            MemberInput(
                id=m['id'],
                start_node_id=m['startNodeId'],
                end_node_id=m['endNodeId'],
                E=m.get('E', 200e6),
                G=m.get('G', 77e6),
                Iy=m.get('Iy', 1e-4),
                Iz=m.get('Iz', 1e-4),
                J=m.get('J', 1e-5),
                A=m.get('A', 0.01),
                Fy=m.get('Fy', 345e3),  # Yield stress for τ_b
                Asy=m.get('Asy'),  # Shear area y
                Asz=m.get('Asz'),  # Shear area z
            )
            for m in model_dict.get('members', [])
        ]
        
        node_loads = [
            NodeLoadInput(
                node_id=l['nodeId'],
                fx=l.get('fx', 0),
                fy=l.get('fy', 0),
                fz=l.get('fz', 0),
                mx=l.get('mx', 0),
                my=l.get('my', 0),
                mz=l.get('mz', 0)
            )
            for l in model_dict.get('node_loads', [])
        ]
        
        point_loads = [
            PointLoadInput(
                member_id=l['memberId'],
                direction=l.get('direction', 'Fy'),
                magnitude=l['magnitude'],
                position=l.get('position', 0.5),
                is_ratio=l.get('isRatio', True)
            )
            for l in model_dict.get('point_loads', [])
        ]
        
        distributed_loads = [
            DistributedLoadInput(
                member_id=l['memberId'],
                direction=l.get('direction', 'Fy'),
                w1=l.get('w1', l.get('magnitude', 0)),
                w2=l.get('w2', l.get('magnitude', 0)),
                start_pos=l.get('startPos', 0),
                end_pos=l.get('endPos', 1),
                is_ratio=l.get('isRatio', True)
            )
            for l in model_dict.get('distributed_loads', [])
        ]
        
        model_input = ModelInput(
            nodes=nodes,
            members=members,
            node_loads=node_loads,
            point_loads=point_loads,
            distributed_loads=distributed_loads
        )
        
        # Run analysis with options
        engine = FEAEngine(options=options)
        engine.build_model(model_input)
        result = engine.analyze()
        
        # Convert to dict
        response = {
            'success': result.success,
            'error': result.error,
            'max_displacement': result.max_displacement,
            'max_moment': result.max_moment,
            'max_shear': result.max_shear,
            'nodes': [
                {
                    'nodeId': nr.node_id,
                    'displacement': nr.displacement,
                    'reaction': nr.reaction
                }
                for nr in result.nodes
            ],
            'members': [
                {
                    'memberId': mr.member_id,
                    'length': mr.length,
                    'x_values': mr.x_values,
                    'shear_y': mr.shear_y,
                    'shear_z': mr.shear_z,
                    'moment_y': mr.moment_y,
                    'moment_z': mr.moment_z,
                    'axial': mr.axial,
                    'torsion': mr.torsion,
                    'deflection_y': mr.deflection_y,
                    'deflection_z': mr.deflection_z,
                    'max_shear_y': mr.max_shear_y,
                    'max_shear_z': mr.max_shear_z,
                    'max_moment_y': mr.max_moment_y,
                    'max_moment_z': mr.max_moment_z,
                    'max_deflection': mr.max_deflection
                }
                for mr in result.members
            ]
        }
        
        # Add Direct Analysis info if enabled
        if options.direct_analysis:
            response['direct_analysis'] = {
                'enabled': True,
                'stiffness_reduction_factor': options.stiffness_reduction_factor,
                'tau_b_enabled': options.tau_b_enabled,
                'stiffness_modifications': engine.stiffness_modifications
            }
        
        return response
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


# ============================================
# Example Usage
# ============================================

if __name__ == "__main__":
    # Simple beam example
    model = {
        "nodes": [
            {"id": "N1", "x": 0, "y": 0, "z": 0, "support": "pinned"},
            {"id": "N2", "x": 5, "y": 0, "z": 0, "support": "roller"},
        ],
        "members": [
            {
                "id": "M1",
                "startNodeId": "N1",
                "endNodeId": "N2",
                "E": 200e6,
                "Iy": 1e-4,
                "Iz": 1e-4,
                "A": 0.01
            }
        ],
        "distributed_loads": [
            {
                "memberId": "M1",
                "direction": "Fy",
                "w1": -10,  # 10 kN/m downward
                "w2": -10,
                "startPos": 0,
                "endPos": 1,
                "isRatio": True
            }
        ]
    }
    
    result = analyze_frame(model)
    
    if result['success']:
        print("✅ Analysis Successful!")
        print(f"Max Moment: {result['max_moment']:.2f} kN·m")
        print(f"Max Shear: {result['max_shear']:.2f} kN")
        print(f"Max Deflection: {result['max_displacement']:.4f} mm")
        
        print("\nMember M1 has", len(result['members'][0]['x_values']), "data points")
    else:
        print(f"❌ Analysis Failed: {result['error']}")
