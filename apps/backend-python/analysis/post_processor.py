"""
post_processor.py - Advanced Post-Processing Module

Provides comprehensive result extraction and visualization:
- Force/moment envelope generation
- Deflection animation data
- Mode shape visualization
- Stress contour mapping
- Design ratio summary
- Result comparison across load cases

Reference: STAAD.Pro post-processor capabilities
"""

from dataclasses import dataclass
from typing import List, Dict, Tuple, Optional, Any
from enum import Enum
import math
import json


# ============================================
# ENUMS AND DATA STRUCTURES
# ============================================

class ResultType(Enum):
    """Types of analysis results"""
    DISPLACEMENT = 'displacement'
    REACTION = 'reaction'
    MEMBER_FORCE = 'member_force'
    STRESS = 'stress'
    MODE_SHAPE = 'mode_shape'
    BUCKLING_MODE = 'buckling_mode'


class ForceComponent(Enum):
    """Member force components"""
    AXIAL = 'Fx'
    SHEAR_Y = 'Fy'
    SHEAR_Z = 'Fz'
    TORSION = 'Mx'
    MOMENT_Y = 'My'
    MOMENT_Z = 'Mz'


class EnvelopeType(Enum):
    """Envelope types for multiple load cases"""
    MAXIMUM = 'max'
    MINIMUM = 'min'
    ABSOLUTE_MAX = 'abs_max'


@dataclass
class NodeResult:
    """Results at a node"""
    node_id: int
    load_case: str
    ux: float = 0      # Translation X (mm)
    uy: float = 0      # Translation Y (mm)
    uz: float = 0      # Translation Z (mm)
    rx: float = 0      # Rotation X (rad)
    ry: float = 0      # Rotation Y (rad)
    rz: float = 0      # Rotation Z (rad)


@dataclass
class ReactionResult:
    """Support reaction at a node"""
    node_id: int
    load_case: str
    Fx: float = 0      # kN
    Fy: float = 0      # kN
    Fz: float = 0      # kN
    Mx: float = 0      # kNm
    My: float = 0      # kNm
    Mz: float = 0      # kNm


@dataclass
class MemberForceResult:
    """Member forces at a section"""
    member_id: int
    load_case: str
    position: float    # 0 to 1 along member
    Fx: float = 0      # Axial (kN)
    Fy: float = 0      # Shear Y (kN)
    Fz: float = 0      # Shear Z (kN)
    Mx: float = 0      # Torsion (kNm)
    My: float = 0      # Moment Y (kNm)
    Mz: float = 0      # Moment Z (kNm)


@dataclass
class StressResult:
    """Stress at a member section"""
    member_id: int
    load_case: str
    position: float
    sigma_axial: float = 0      # MPa
    sigma_bending_y: float = 0  # MPa
    sigma_bending_z: float = 0  # MPa
    tau_shear: float = 0        # MPa
    tau_torsion: float = 0      # MPa
    von_mises: float = 0        # MPa


@dataclass
class EnvelopeResult:
    """Envelope result across load cases"""
    member_id: int
    position: float
    max_value: float
    min_value: float
    abs_max: float
    max_case: str
    min_case: str


@dataclass
class DesignSummary:
    """Design check summary for a member"""
    member_id: int
    section_name: str
    max_axial_ratio: float
    max_shear_ratio: float
    max_moment_ratio: float
    max_interaction_ratio: float
    governing_case: str
    status: str


@dataclass
class AnimationFrame:
    """Single frame of deflection animation"""
    frame_index: int
    scale_factor: float
    node_positions: Dict[int, Tuple[float, float, float]]


# ============================================
# POST PROCESSOR
# ============================================

class PostProcessor:
    """
    Advanced post-processing for structural analysis results
    """
    
    def __init__(self):
        self.node_results: Dict[str, List[NodeResult]] = {}
        self.reactions: Dict[str, List[ReactionResult]] = {}
        self.member_forces: Dict[str, List[MemberForceResult]] = {}
        self.stresses: Dict[str, List[StressResult]] = {}
        self.load_cases: List[str] = []
    
    # ============================================
    # RESULT LOADING
    # ============================================
    
    def add_load_case_results(
        self,
        load_case: str,
        displacements: List[NodeResult],
        reactions: List[ReactionResult],
        member_forces: List[MemberForceResult]
    ):
        """Add results for a load case"""
        if load_case not in self.load_cases:
            self.load_cases.append(load_case)
        
        self.node_results[load_case] = displacements
        self.reactions[load_case] = reactions
        self.member_forces[load_case] = member_forces
    
    def load_from_analysis(self, analysis_results: Dict[str, Any]):
        """Load results from analysis output dictionary"""
        for case_name, case_results in analysis_results.items():
            displacements = []
            reactions = []
            forces = []
            
            # Parse displacements
            if 'displacements' in case_results:
                for node_id, disp in case_results['displacements'].items():
                    displacements.append(NodeResult(
                        node_id=int(node_id),
                        load_case=case_name,
                        ux=disp.get('ux', 0),
                        uy=disp.get('uy', 0),
                        uz=disp.get('uz', 0),
                        rx=disp.get('rx', 0),
                        ry=disp.get('ry', 0),
                        rz=disp.get('rz', 0)
                    ))
            
            # Parse reactions
            if 'reactions' in case_results:
                for node_id, react in case_results['reactions'].items():
                    reactions.append(ReactionResult(
                        node_id=int(node_id),
                        load_case=case_name,
                        Fx=react.get('Fx', 0),
                        Fy=react.get('Fy', 0),
                        Fz=react.get('Fz', 0),
                        Mx=react.get('Mx', 0),
                        My=react.get('My', 0),
                        Mz=react.get('Mz', 0)
                    ))
            
            # Parse member forces
            if 'member_forces' in case_results:
                for member_id, sections in case_results['member_forces'].items():
                    for section in sections:
                        forces.append(MemberForceResult(
                            member_id=int(member_id),
                            load_case=case_name,
                            position=section.get('position', 0),
                            Fx=section.get('Fx', 0),
                            Fy=section.get('Fy', 0),
                            Fz=section.get('Fz', 0),
                            Mx=section.get('Mx', 0),
                            My=section.get('My', 0),
                            Mz=section.get('Mz', 0)
                        ))
            
            self.add_load_case_results(case_name, displacements, reactions, forces)
    
    # ============================================
    # ENVELOPE GENERATION
    # ============================================
    
    def generate_force_envelope(
        self,
        member_id: int,
        component: ForceComponent,
        load_cases: Optional[List[str]] = None,
        num_sections: int = 11
    ) -> List[EnvelopeResult]:
        """
        Generate force envelope for a member across load cases
        """
        cases = load_cases or self.load_cases
        positions = [i / (num_sections - 1) for i in range(num_sections)]
        
        envelopes = []
        
        for pos in positions:
            values = {}
            
            for case in cases:
                if case in self.member_forces:
                    forces = [f for f in self.member_forces[case] 
                             if f.member_id == member_id]
                    
                    # Find forces at this position (interpolate if needed)
                    value = self._interpolate_force(forces, pos, component)
                    values[case] = value
            
            if values:
                max_val = max(values.values())
                min_val = min(values.values())
                max_case = max(values.keys(), key=lambda k: values[k])
                min_case = min(values.keys(), key=lambda k: values[k])
                
                envelopes.append(EnvelopeResult(
                    member_id=member_id,
                    position=pos,
                    max_value=max_val,
                    min_value=min_val,
                    abs_max=max(abs(max_val), abs(min_val)),
                    max_case=max_case,
                    min_case=min_case
                ))
        
        return envelopes
    
    def generate_global_envelope(
        self,
        component: ForceComponent,
        load_cases: Optional[List[str]] = None
    ) -> Dict[int, EnvelopeResult]:
        """
        Generate envelope for all members
        """
        cases = load_cases or self.load_cases
        
        # Get all member IDs
        member_ids = set()
        for case in cases:
            if case in self.member_forces:
                for force in self.member_forces[case]:
                    member_ids.add(force.member_id)
        
        global_envelope = {}
        
        for member_id in member_ids:
            envelope = self.generate_force_envelope(member_id, component, cases)
            
            # Get max envelope
            if envelope:
                max_env = max(envelope, key=lambda e: e.abs_max)
                global_envelope[member_id] = max_env
        
        return global_envelope
    
    def _interpolate_force(
        self,
        forces: List[MemberForceResult],
        position: float,
        component: ForceComponent
    ) -> float:
        """Interpolate force at a position"""
        if not forces:
            return 0
        
        # Sort by position
        sorted_forces = sorted(forces, key=lambda f: f.position)
        
        # Get component value
        def get_value(f: MemberForceResult) -> float:
            return getattr(f, component.value)
        
        # Find bounding positions
        for i, f in enumerate(sorted_forces[:-1]):
            next_f = sorted_forces[i + 1]
            if f.position <= position <= next_f.position:
                # Linear interpolation
                t = (position - f.position) / (next_f.position - f.position)
                return get_value(f) + t * (get_value(next_f) - get_value(f))
        
        # Extrapolate or use nearest
        if position <= sorted_forces[0].position:
            return get_value(sorted_forces[0])
        else:
            return get_value(sorted_forces[-1])
    
    # ============================================
    # STRESS CALCULATION
    # ============================================
    
    def calculate_stresses(
        self,
        load_case: str,
        section_properties: Dict[int, Dict]
    ) -> List[StressResult]:
        """
        Calculate stresses from member forces
        
        section_properties: {member_id: {'area': A, 'Iy': Iy, 'Iz': Iz, 
                            'Zy': Zy, 'Zz': Zz, 'depth': d, 'tw': tw}}
        """
        stresses = []
        
        if load_case not in self.member_forces:
            return stresses
        
        for force in self.member_forces[load_case]:
            member_id = force.member_id
            
            if member_id not in section_properties:
                continue
            
            props = section_properties[member_id]
            A = props['area']
            Zy = props.get('Zy', 1e6)
            Zz = props.get('Zz', 1e6)
            depth = props.get('depth', 100)
            tw = props.get('tw', 10)
            
            # Axial stress
            sigma_axial = force.Fx * 1000 / A  # MPa
            
            # Bending stresses
            sigma_bending_y = force.My * 1e6 / Zy  # MPa
            sigma_bending_z = force.Mz * 1e6 / Zz  # MPa
            
            # Shear stress (approximate)
            Av = depth * tw  # Shear area
            tau_shear = max(abs(force.Fy), abs(force.Fz)) * 1000 / Av
            
            # Von Mises stress
            sigma_total = sigma_axial + sigma_bending_y + sigma_bending_z
            von_mises = math.sqrt(sigma_total**2 + 3 * tau_shear**2)
            
            stresses.append(StressResult(
                member_id=member_id,
                load_case=load_case,
                position=force.position,
                sigma_axial=sigma_axial,
                sigma_bending_y=sigma_bending_y,
                sigma_bending_z=sigma_bending_z,
                tau_shear=tau_shear,
                von_mises=von_mises
            ))
        
        self.stresses[load_case] = stresses
        return stresses
    
    # ============================================
    # DEFLECTION ANIMATION
    # ============================================
    
    def generate_deflection_animation(
        self,
        load_case: str,
        original_positions: Dict[int, Tuple[float, float, float]],
        num_frames: int = 30,
        max_scale: float = 100,
        oscillate: bool = True
    ) -> List[AnimationFrame]:
        """
        Generate frames for deflection animation
        """
        frames = []
        
        if load_case not in self.node_results:
            return frames
        
        # Get displacements
        displacements = {r.node_id: (r.ux, r.uy, r.uz) 
                        for r in self.node_results[load_case]}
        
        for i in range(num_frames):
            if oscillate:
                # Sinusoidal oscillation
                t = i / (num_frames - 1)
                scale = max_scale * math.sin(math.pi * t)
            else:
                # Linear scaling
                scale = max_scale * i / (num_frames - 1)
            
            node_positions = {}
            
            for node_id, orig_pos in original_positions.items():
                if node_id in displacements:
                    dx, dy, dz = displacements[node_id]
                    # Scale displacements (convert mm to same units as positions)
                    node_positions[node_id] = (
                        orig_pos[0] + dx * scale / 1000,
                        orig_pos[1] + dy * scale / 1000,
                        orig_pos[2] + dz * scale / 1000
                    )
                else:
                    node_positions[node_id] = orig_pos
            
            frames.append(AnimationFrame(
                frame_index=i,
                scale_factor=scale,
                node_positions=node_positions
            ))
        
        return frames
    
    # ============================================
    # MODE SHAPE ANIMATION
    # ============================================
    
    def generate_mode_shape_animation(
        self,
        mode_shapes: List[Dict[int, Tuple[float, float, float]]],
        original_positions: Dict[int, Tuple[float, float, float]],
        mode_index: int,
        num_frames: int = 60,
        max_scale: float = 50
    ) -> List[AnimationFrame]:
        """
        Generate animation for vibration mode shape
        """
        if mode_index >= len(mode_shapes):
            return []
        
        mode_shape = mode_shapes[mode_index]
        frames = []
        
        for i in range(num_frames):
            # Full sinusoidal cycle
            t = 2 * math.pi * i / (num_frames - 1)
            scale = max_scale * math.sin(t)
            
            node_positions = {}
            
            for node_id, orig_pos in original_positions.items():
                if node_id in mode_shape:
                    phi_x, phi_y, phi_z = mode_shape[node_id]
                    node_positions[node_id] = (
                        orig_pos[0] + phi_x * scale,
                        orig_pos[1] + phi_y * scale,
                        orig_pos[2] + phi_z * scale
                    )
                else:
                    node_positions[node_id] = orig_pos
            
            frames.append(AnimationFrame(
                frame_index=i,
                scale_factor=scale,
                node_positions=node_positions
            ))
        
        return frames
    
    # ============================================
    # STRESS CONTOUR MAPPING
    # ============================================
    
    def generate_stress_contours(
        self,
        load_case: str,
        stress_type: str = 'von_mises',
        num_levels: int = 10
    ) -> Dict[int, List[Dict]]:
        """
        Generate stress contour data for visualization
        
        Returns: {member_id: [{'position': p, 'value': v, 'color': rgb}]}
        """
        if load_case not in self.stresses:
            return {}
        
        stresses = self.stresses[load_case]
        
        # Get stress range
        all_values = [getattr(s, stress_type) for s in stresses]
        if not all_values:
            return {}
        
        min_val = min(all_values)
        max_val = max(all_values)
        
        # Generate color map (blue -> green -> yellow -> red)
        def value_to_color(v: float) -> Tuple[int, int, int]:
            if max_val == min_val:
                t = 0.5
            else:
                t = (v - min_val) / (max_val - min_val)
            
            if t < 0.25:
                r, g, b = 0, int(255 * 4 * t), 255
            elif t < 0.5:
                r, g, b = 0, 255, int(255 * (2 - 4 * t))
            elif t < 0.75:
                r, g, b = int(255 * (4 * t - 2)), 255, 0
            else:
                r, g, b = 255, int(255 * (4 - 4 * t)), 0
            
            return (r, g, b)
        
        # Group by member
        contours = {}
        
        for stress in stresses:
            member_id = stress.member_id
            value = getattr(stress, stress_type)
            color = value_to_color(value)
            
            if member_id not in contours:
                contours[member_id] = []
            
            contours[member_id].append({
                'position': stress.position,
                'value': value,
                'color': color,
                'color_hex': f'#{color[0]:02x}{color[1]:02x}{color[2]:02x}'
            })
        
        return contours
    
    # ============================================
    # DESIGN SUMMARY
    # ============================================
    
    def generate_design_summary(
        self,
        design_results: Dict[int, Dict]
    ) -> List[DesignSummary]:
        """
        Generate design summary table
        
        design_results: {member_id: {
            'section': name,
            'axial_ratio': r,
            'shear_ratio': r,
            'moment_ratio': r,
            'interaction_ratio': r,
            'governing_case': case,
            'status': 'PASS'/'FAIL'
        }}
        """
        summaries = []
        
        for member_id, result in design_results.items():
            summaries.append(DesignSummary(
                member_id=member_id,
                section_name=result.get('section', 'Unknown'),
                max_axial_ratio=result.get('axial_ratio', 0),
                max_shear_ratio=result.get('shear_ratio', 0),
                max_moment_ratio=result.get('moment_ratio', 0),
                max_interaction_ratio=result.get('interaction_ratio', 0),
                governing_case=result.get('governing_case', ''),
                status=result.get('status', 'UNKNOWN')
            ))
        
        # Sort by interaction ratio (most critical first)
        summaries.sort(key=lambda s: s.max_interaction_ratio, reverse=True)
        
        return summaries
    
    # ============================================
    # EXPORT FUNCTIONS
    # ============================================
    
    def export_to_json(self, file_path: str):
        """Export all results to JSON"""
        data = {
            'load_cases': self.load_cases,
            'node_results': {},
            'reactions': {},
            'member_forces': {},
            'stresses': {}
        }
        
        for case in self.load_cases:
            if case in self.node_results:
                data['node_results'][case] = [
                    {
                        'node_id': r.node_id,
                        'ux': r.ux, 'uy': r.uy, 'uz': r.uz,
                        'rx': r.rx, 'ry': r.ry, 'rz': r.rz
                    }
                    for r in self.node_results[case]
                ]
            
            if case in self.reactions:
                data['reactions'][case] = [
                    {
                        'node_id': r.node_id,
                        'Fx': r.Fx, 'Fy': r.Fy, 'Fz': r.Fz,
                        'Mx': r.Mx, 'My': r.My, 'Mz': r.Mz
                    }
                    for r in self.reactions[case]
                ]
            
            if case in self.member_forces:
                data['member_forces'][case] = [
                    {
                        'member_id': f.member_id,
                        'position': f.position,
                        'Fx': f.Fx, 'Fy': f.Fy, 'Fz': f.Fz,
                        'Mx': f.Mx, 'My': f.My, 'Mz': f.Mz
                    }
                    for f in self.member_forces[case]
                ]
        
        with open(file_path, 'w') as f:
            json.dump(data, f, indent=2)
    
    def export_to_excel_format(self) -> Dict[str, List[Dict]]:
        """
        Export results in format suitable for Excel/CSV export
        """
        sheets = {
            'Displacements': [],
            'Reactions': [],
            'Member Forces': [],
            'Stresses': []
        }
        
        for case in self.load_cases:
            if case in self.node_results:
                for r in self.node_results[case]:
                    sheets['Displacements'].append({
                        'Load Case': case,
                        'Node': r.node_id,
                        'UX (mm)': r.ux,
                        'UY (mm)': r.uy,
                        'UZ (mm)': r.uz,
                        'RX (rad)': r.rx,
                        'RY (rad)': r.ry,
                        'RZ (rad)': r.rz
                    })
            
            if case in self.reactions:
                for r in self.reactions[case]:
                    sheets['Reactions'].append({
                        'Load Case': case,
                        'Node': r.node_id,
                        'FX (kN)': r.Fx,
                        'FY (kN)': r.Fy,
                        'FZ (kN)': r.Fz,
                        'MX (kNm)': r.Mx,
                        'MY (kNm)': r.My,
                        'MZ (kNm)': r.Mz
                    })
            
            if case in self.member_forces:
                for f in self.member_forces[case]:
                    sheets['Member Forces'].append({
                        'Load Case': case,
                        'Member': f.member_id,
                        'Position': f.position,
                        'Axial (kN)': f.Fx,
                        'Shear Y (kN)': f.Fy,
                        'Shear Z (kN)': f.Fz,
                        'Torsion (kNm)': f.Mx,
                        'Moment Y (kNm)': f.My,
                        'Moment Z (kNm)': f.Mz
                    })
        
        return sheets
    
    # ============================================
    # RESULT COMPARISON
    # ============================================
    
    def compare_load_cases(
        self,
        case1: str,
        case2: str,
        tolerance: float = 0.01
    ) -> Dict[str, List[Dict]]:
        """
        Compare results between two load cases
        """
        comparison = {
            'displacements': [],
            'reactions': [],
            'member_forces': []
        }
        
        # Compare displacements
        if case1 in self.node_results and case2 in self.node_results:
            results1 = {r.node_id: r for r in self.node_results[case1]}
            results2 = {r.node_id: r for r in self.node_results[case2]}
            
            for node_id in set(results1.keys()) | set(results2.keys()):
                r1 = results1.get(node_id)
                r2 = results2.get(node_id)
                
                if r1 and r2:
                    diff_ux = abs(r1.ux - r2.ux)
                    diff_uy = abs(r1.uy - r2.uy)
                    diff_uz = abs(r1.uz - r2.uz)
                    
                    if diff_ux > tolerance or diff_uy > tolerance or diff_uz > tolerance:
                        comparison['displacements'].append({
                            'node': node_id,
                            f'{case1}_ux': r1.ux, f'{case2}_ux': r2.ux,
                            f'{case1}_uy': r1.uy, f'{case2}_uy': r2.uy,
                            f'{case1}_uz': r1.uz, f'{case2}_uz': r2.uz
                        })
        
        return comparison
