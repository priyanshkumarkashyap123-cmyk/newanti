"""
moving_load.py - Moving Vehicle Load Analysis for Bridges

Features:
- Standard vehicle definitions (IRC, AASHTO, Eurocode)
- Lane/runway path definition
- Moving load envelope generation
- Influence line analysis

Code Compliance:
- IRC 6: 2017 - Standard Specifications for Road Bridges
- IRC 112: 2020 - Code of Practice for Concrete Road Bridges
- AASHTO LRFD Bridge Design Specifications
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Callable
from enum import Enum
import numpy as np
import math


# ============================================
# VEHICLE DEFINITIONS
# ============================================

@dataclass
class Axle:
    """Single axle definition"""
    load: float          # Axle load (kN)
    spacing: float       # Distance from previous axle (m), 0 for first axle
    width: float = 1.8   # Transverse width (m)


@dataclass
class Vehicle:
    """
    Vehicle definition with axle loads and spacings.
    
    The vehicle is defined as a train of axles with:
    - Axle loads in kN
    - Spacing between consecutive axles in m
    - Optional transverse load width for lane distribution
    """
    name: str
    axles: List[Axle]
    total_length: float = 0.0  # Auto-calculated
    total_load: float = 0.0    # Auto-calculated
    impact_factor: float = 1.0  # Dynamic amplification
    lane_factor: float = 1.0    # Multi-lane reduction
    
    def __post_init__(self):
        """Calculate total length and load"""
        self.total_length = sum(a.spacing for a in self.axles)
        self.total_load = sum(a.load for a in self.axles)
    
    def get_axle_positions(self, front_position: float = 0.0) -> List[Tuple[float, float]]:
        """
        Get positions of all axles given front axle position.
        
        Returns:
            List of (position, load) tuples
        """
        positions = []
        current_pos = front_position
        
        for axle in self.axles:
            current_pos += axle.spacing
            positions.append((current_pos, axle.load))
        
        # Adjust so first axle is at front_position
        if positions:
            offset = positions[0][0] - front_position
            positions = [(p - offset, load) for p, load in positions]
        
        return positions


# ============================================
# STANDARD VEHICLE LIBRARY
# ============================================

# IRC Class A Loading (IRC 6:2017)
IRC_CLASS_A = Vehicle(
    name="IRC Class A",
    axles=[
        Axle(load=27, spacing=0.0),     # Front axle
        Axle(load=27, spacing=1.1),     # 
        Axle(load=114, spacing=3.2),    # First bogie
        Axle(load=114, spacing=1.2),    #
        Axle(load=68, spacing=4.3),     # Second bogie
        Axle(load=68, spacing=1.2),     #
        Axle(load=68, spacing=3.0),     # Third bogie
        Axle(load=68, spacing=1.2),     #
    ],
    impact_factor=1.0  # Calculated separately based on span
)

# IRC Class AA Loading (Tracked Vehicle) - IRC 6:2017
IRC_CLASS_AA = Vehicle(
    name="IRC Class AA (Tracked)",
    axles=[
        Axle(load=350, spacing=0.0, width=0.85),   # Track 1 (700kN total, 2 tracks)
        Axle(load=350, spacing=3.6, width=0.85),   # Track 2
    ],
    impact_factor=1.10  # 10% impact for tracked
)

# IRC 70R Loading (Wheeled) - IRC 6:2017
IRC_70R = Vehicle(
    name="IRC 70R (Wheeled)",
    axles=[
        Axle(load=80, spacing=0.0),
        Axle(load=120, spacing=1.37),
        Axle(load=120, spacing=2.13),
        Axle(load=170, spacing=1.52),
        Axle(load=170, spacing=3.05),
        Axle(load=170, spacing=1.52),
        Axle(load=170, spacing=1.52),
    ],
    impact_factor=1.0
)

# AASHTO HL-93 Design Truck
AASHTO_HL93 = Vehicle(
    name="AASHTO HL-93 Truck",
    axles=[
        Axle(load=35, spacing=0.0),     # 8 kips = 35 kN
        Axle(load=145, spacing=4.3),    # 32 kips = 145 kN
        Axle(load=145, spacing=4.3),    # 32 kips = 145 kN (variable 4.3-9.0m)
    ],
    impact_factor=1.33  # IM = 33%
)

# Eurocode LM1 Tandem System
EC_LM1_TANDEM = Vehicle(
    name="Eurocode LM1 Tandem",
    axles=[
        Axle(load=300, spacing=0.0),    # αQ × 300 kN per lane
        Axle(load=300, spacing=1.2),
    ],
    impact_factor=1.0  # Already factored in load
)

# Standard Vehicles Dictionary
STANDARD_VEHICLES = {
    'IRC_CLASS_A': IRC_CLASS_A,
    'IRC_CLASS_AA': IRC_CLASS_AA,
    'IRC_70R': IRC_70R,
    'AASHTO_HL93': AASHTO_HL93,
    'EC_LM1': EC_LM1_TANDEM
}


# ============================================
# LANE / RUNWAY DEFINITION
# ============================================

@dataclass
class LanePoint:
    """Point along the lane path"""
    x: float
    y: float
    z: float
    member_id: Optional[str] = None  # Associated member if on a beam
    position_ratio: float = 0.0      # 0-1 position on member


@dataclass
class Lane:
    """
    Lane definition for vehicle movement.
    
    A lane is a path of connected members/beams that the vehicle traverses.
    """
    name: str
    points: List[LanePoint]          # Ordered points along lane
    member_sequence: List[str]       # Ordered member IDs forming the lane
    total_length: float = 0.0        # Auto-calculated
    width: float = 3.5               # Lane width (m)
    
    def __post_init__(self):
        """Calculate total lane length"""
        if len(self.points) > 1:
            total = 0.0
            for i in range(1, len(self.points)):
                p1, p2 = self.points[i-1], self.points[i]
                dist = math.sqrt((p2.x - p1.x)**2 + (p2.y - p1.y)**2 + (p2.z - p1.z)**2)
                total += dist
            self.total_length = total
    
    @classmethod
    def from_members(cls, members: List[Dict], nodes: Dict[str, Dict], name: str = "Lane 1") -> 'Lane':
        """
        Create lane from sequence of member dicts.
        
        Args:
            members: List of member dicts with start_node_id, end_node_id
            nodes: Dict of node_id -> {x, y, z}
        """
        points = []
        member_ids = []
        
        for member in members:
            start = nodes.get(member['start_node_id'])
            end = nodes.get(member['end_node_id'])
            
            if start and end:
                # Add start point if first or not already added
                if not points or (points[-1].x != start['x'] or 
                                  points[-1].y != start['y'] or 
                                  points[-1].z != start['z']):
                    points.append(LanePoint(
                        x=start['x'], y=start['y'], z=start['z'],
                        member_id=member['id'], position_ratio=0.0
                    ))
                
                # Add end point
                points.append(LanePoint(
                    x=end['x'], y=end['y'], z=end['z'],
                    member_id=member['id'], position_ratio=1.0
                ))
                
                member_ids.append(member['id'])
        
        return cls(name=name, points=points, member_sequence=member_ids)


# ============================================
# INFLUENCE ENVELOPE
# ============================================

@dataclass
class InfluenceEnvelope:
    """
    Envelope of maximum effects from moving load analysis.
    """
    member_id: str
    num_points: int = 100
    
    # Position array
    x_positions: np.ndarray = field(default_factory=lambda: np.array([]))
    
    # Maximum positive and negative values at each position
    max_shear_positive: np.ndarray = field(default_factory=lambda: np.array([]))
    max_shear_negative: np.ndarray = field(default_factory=lambda: np.array([]))
    max_moment_positive: np.ndarray = field(default_factory=lambda: np.array([]))
    max_moment_negative: np.ndarray = field(default_factory=lambda: np.array([]))
    max_reaction_positive: np.ndarray = field(default_factory=lambda: np.array([]))
    max_reaction_negative: np.ndarray = field(default_factory=lambda: np.array([]))
    
    # Critical positions (where vehicle front axle was when max occurred)
    critical_position_moment: float = 0.0
    critical_position_shear: float = 0.0
    
    # Absolute maximums
    absolute_max_moment: float = 0.0
    absolute_max_shear: float = 0.0
    absolute_max_reaction: float = 0.0
    
    def initialize(self, length: float):
        """Initialize arrays for given member length"""
        self.x_positions = np.linspace(0, length, self.num_points)
        self.max_shear_positive = np.zeros(self.num_points)
        self.max_shear_negative = np.zeros(self.num_points)
        self.max_moment_positive = np.zeros(self.num_points)
        self.max_moment_negative = np.zeros(self.num_points)
        self.max_reaction_positive = np.zeros(self.num_points)
        self.max_reaction_negative = np.zeros(self.num_points)
    
    def update_envelope(
        self,
        shear: np.ndarray,
        moment: np.ndarray,
        vehicle_position: float
    ):
        """Update envelope with new analysis results"""
        # Update positive maximums
        self.max_shear_positive = np.maximum(self.max_shear_positive, shear)
        self.max_moment_positive = np.maximum(self.max_moment_positive, moment)
        
        # Update negative maximums
        self.max_shear_negative = np.minimum(self.max_shear_negative, shear)
        self.max_moment_negative = np.minimum(self.max_moment_negative, moment)
        
        # Update absolute maximums and critical positions
        max_moment = np.max(np.abs(moment))
        max_shear = np.max(np.abs(shear))
        
        if max_moment > self.absolute_max_moment:
            self.absolute_max_moment = max_moment
            self.critical_position_moment = vehicle_position
        
        if max_shear > self.absolute_max_shear:
            self.absolute_max_shear = max_shear
            self.critical_position_shear = vehicle_position
    
    def to_dict(self) -> Dict:
        """Export envelope data"""
        return {
            'member_id': self.member_id,
            'x_positions': self.x_positions.tolist(),
            'max_shear_positive': self.max_shear_positive.tolist(),
            'max_shear_negative': self.max_shear_negative.tolist(),
            'max_moment_positive': self.max_moment_positive.tolist(),
            'max_moment_negative': self.max_moment_negative.tolist(),
            'absolute_max_moment': self.absolute_max_moment,
            'absolute_max_shear': self.absolute_max_shear,
            'critical_position_moment': self.critical_position_moment,
            'critical_position_shear': self.critical_position_shear
        }


# ============================================
# MOVING LOAD GENERATOR
# ============================================

class MovingLoadGenerator:
    """
    Moving Load Analysis Engine
    
    Features:
    - Places vehicle at incremental positions along lane
    - Converts axle loads to member point loads
    - Runs analysis at each position (or uses influence lines)
    - Records envelope of maximum effects
    
    Usage:
    1. Define vehicle and lane
    2. Call generate_load_positions() to get all load cases
    3. Run analysis for each position
    4. Call update_envelope() with results
    5. Get final envelope
    """
    
    def __init__(
        self,
        vehicle: Vehicle,
        lane: Lane,
        step_size: float = 0.5,  # Position increment (m)
        impact_factor: Optional[float] = None
    ):
        self.vehicle = vehicle
        self.lane = lane
        self.step_size = step_size
        self.impact_factor = impact_factor or vehicle.impact_factor
        
        # Results
        self.envelopes: Dict[str, InfluenceEnvelope] = {}
        self.load_positions: List[List[Dict]] = []
    
    @staticmethod
    def calculate_irc_impact_factor(span: float, loading_type: str = 'CLASS_A') -> float:
        """
        Calculate impact factor per IRC 6:2017 Clause 208.
        
        For Class A/B:
        - Span ≤ 3m: IA = 0.5
        - Span 3-45m: IA = 4.5/(6+L) but ≥ 0.088
        - Span > 45m: IA = 0.088
        
        For Class AA/70R:
        - Span ≤ 5m: IA = 0.25 (wheeled), 0.10 (tracked)
        - Span > 5m: Reduces linearly
        """
        if loading_type in ['CLASS_A', 'CLASS_B']:
            if span <= 3:
                return 0.5
            elif span <= 45:
                return max(4.5 / (6 + span), 0.088)
            else:
                return 0.088
        elif loading_type == 'CLASS_AA':
            if span <= 5:
                return 0.10  # Tracked
            else:
                # Linear reduction
                return max(0.10 * (1 - (span - 5) / 40), 0.0)
        elif loading_type == '70R':
            if span <= 5:
                return 0.25  # Wheeled
            else:
                return max(0.25 * (1 - (span - 5) / 40), 0.0)
        
        return 0.1  # Default
    
    def get_lane_position_at_distance(self, distance: float) -> Tuple[float, float, float, str, float]:
        """
        Get 3D position and member info at given distance along lane.
        
        Returns:
            (x, y, z, member_id, position_ratio)
        """
        if distance <= 0:
            p = self.lane.points[0]
            return p.x, p.y, p.z, p.member_id or '', 0.0
        
        cumulative = 0.0
        for i in range(1, len(self.lane.points)):
            p1 = self.lane.points[i - 1]
            p2 = self.lane.points[i]
            
            segment_length = math.sqrt(
                (p2.x - p1.x)**2 + (p2.y - p1.y)**2 + (p2.z - p1.z)**2
            )
            
            if cumulative + segment_length >= distance:
                # Position is in this segment
                t = (distance - cumulative) / segment_length if segment_length > 0 else 0
                x = p1.x + t * (p2.x - p1.x)
                y = p1.y + t * (p2.y - p1.y)
                z = p1.z + t * (p2.z - p1.z)
                
                member_id = p2.member_id or p1.member_id or ''
                return x, y, z, member_id, t
            
            cumulative += segment_length
        
        # Beyond lane end
        p = self.lane.points[-1]
        return p.x, p.y, p.z, p.member_id or '', 1.0
    
    def generate_load_positions(self) -> List[List[Dict]]:
        """
        Generate load cases for each vehicle position.
        
        Returns:
            List of load cases, each containing point loads for that position
        """
        self.load_positions = []
        
        # Range: from vehicle entirely off to entirely past
        start_pos = -self.vehicle.total_length
        end_pos = self.lane.total_length + self.vehicle.total_length
        
        num_steps = int((end_pos - start_pos) / self.step_size) + 1
        
        for step in range(num_steps):
            front_pos = start_pos + step * self.step_size
            axle_positions = self.vehicle.get_axle_positions(front_pos)
            
            load_case = []
            for axle_pos, axle_load in axle_positions:
                # Only include if on the lane
                if 0 <= axle_pos <= self.lane.total_length:
                    x, y, z, member_id, ratio = self.get_lane_position_at_distance(axle_pos)
                    
                    # Apply impact factor
                    factored_load = axle_load * self.impact_factor
                    
                    load_case.append({
                        'position': axle_pos,
                        'x': x, 'y': y, 'z': z,
                        'member_id': member_id,
                        'position_ratio': ratio,
                        'load': factored_load,
                        'direction': 'global_y'  # Gravity direction
                    })
            
            if load_case:  # Only add if vehicle has loads on bridge
                self.load_positions.append(load_case)
        
        return self.load_positions
    
    def convert_to_member_point_loads(
        self,
        load_case: List[Dict],
        members: Dict[str, Dict],
        nodes: Dict[str, Dict]
    ) -> List[Dict]:
        """
        Convert lane loads to member point loads for solver.
        
        Args:
            load_case: Single position load case
            members: Dict of member_id -> member data
            nodes: Dict of node_id -> coordinates
            
        Returns:
            List of member point loads for solver
        """
        member_loads = []
        
        for load in load_case:
            member_id = load['member_id']
            if not member_id or member_id not in members:
                continue
            
            member = members[member_id]
            start = nodes.get(member['start_node_id'])
            end = nodes.get(member['end_node_id'])
            
            if not start or not end:
                continue
            
            # Calculate member length
            length = math.sqrt(
                (end['x'] - start['x'])**2 +
                (end['y'] - start['y'])**2 +
                (end['z'] - start['z'])**2
            )
            
            # Calculate position along member
            if length > 0:
                # Project load position onto member
                # Using the lane position ratio directly
                a_ratio = load['position_ratio']
            else:
                a_ratio = 0.5
            
            member_loads.append({
                'type': 'point',
                'member_id': member_id,
                'P': -load['load'],  # Negative for downward
                'a': a_ratio,
                'direction': 'global_y'
            })
        
        return member_loads
    
    def initialize_envelopes(self, members: Dict[str, Dict], nodes: Dict[str, Dict]):
        """Initialize influence envelopes for all members in lane"""
        for member_id in self.lane.member_sequence:
            if member_id not in members:
                continue
            
            member = members[member_id]
            start = nodes.get(member['start_node_id'])
            end = nodes.get(member['end_node_id'])
            
            if start and end:
                length = math.sqrt(
                    (end['x'] - start['x'])**2 +
                    (end['y'] - start['y'])**2 +
                    (end['z'] - start['z'])**2
                )
                
                envelope = InfluenceEnvelope(member_id=member_id)
                envelope.initialize(length)
                self.envelopes[member_id] = envelope
    
    def get_envelopes(self) -> Dict[str, Dict]:
        """Get all envelopes as dicts"""
        return {mid: env.to_dict() for mid, env in self.envelopes.items()}
    
    def get_critical_loading(self) -> Dict:
        """
        Get the critical (maximum effect) loading configuration.
        
        Returns dict with critical position and loads.
        """
        max_moment = 0.0
        critical_position = 0.0
        
        for envelope in self.envelopes.values():
            if envelope.absolute_max_moment > max_moment:
                max_moment = envelope.absolute_max_moment
                critical_position = envelope.critical_position_moment
        
        # Generate loads for critical position
        for i, load_case in enumerate(self.load_positions):
            if load_case:
                pos = load_case[0]['position'] - self.load_positions[0][0]['position'] if self.load_positions[0] else 0
                # Approximate match
                if abs(pos - critical_position) < self.step_size:
                    return {
                        'position': critical_position,
                        'max_moment': max_moment,
                        'loads': load_case
                    }
        
        return {
            'position': critical_position,
            'max_moment': max_moment,
            'loads': []
        }


# ============================================
# SIMPLE BEAM INFLUENCE LINES (For quick analysis)
# ============================================

def influence_line_moment(L: float, a: float, x: float) -> float:
    """
    Influence line ordinate for moment at position x due to unit load at a.
    For simply supported beam of span L.
    
    IL_M(a,x) = x(L-a)/L  for a > x
              = a(L-x)/L  for a ≤ x
    """
    if a > x:
        return x * (L - a) / L
    else:
        return a * (L - x) / L


def influence_line_shear(L: float, a: float, x: float) -> float:
    """
    Influence line ordinate for shear at position x due to unit load at a.
    For simply supported beam of span L.
    
    IL_V(a,x) = -(L-a)/L  for a > x (negative shear)
              = a/L       for a < x (positive shear)
    """
    if a > x:
        return -(L - a) / L
    else:
        return a / L


def influence_line_reaction_left(L: float, a: float) -> float:
    """Influence line for left reaction due to unit load at a"""
    return (L - a) / L


def influence_line_reaction_right(L: float, a: float) -> float:
    """Influence line for right reaction due to unit load at a"""
    return a / L


def analyze_simple_beam_moving_load(
    span: float,
    vehicle: Vehicle,
    step: float = 0.1
) -> Dict:
    """
    Quick moving load analysis for simply supported beam using influence lines.
    
    Args:
        span: Beam span (m)
        vehicle: Vehicle to analyze
        step: Position step for analysis
        
    Returns:
        Dict with max moment, shear, reactions and critical positions
    """
    max_moment = 0.0
    max_moment_pos = 0.0
    max_shear = 0.0
    max_reaction_left = 0.0
    max_reaction_right = 0.0
    
    # Move vehicle across beam
    for front_pos in np.arange(-vehicle.total_length, span + step, step):
        axle_positions = vehicle.get_axle_positions(front_pos)
        
        # Calculate moment at midspan
        M_mid = 0.0
        V_quarter = 0.0
        R_left = 0.0
        R_right = 0.0
        
        for axle_pos, load in axle_positions:
            if 0 <= axle_pos <= span:
                M_mid += load * influence_line_moment(span, axle_pos, span / 2)
                V_quarter += load * influence_line_shear(span, axle_pos, span / 4)
                R_left += load * influence_line_reaction_left(span, axle_pos)
                R_right += load * influence_line_reaction_right(span, axle_pos)
        
        # Apply impact factor
        M_mid *= vehicle.impact_factor
        V_quarter *= vehicle.impact_factor
        R_left *= vehicle.impact_factor
        R_right *= vehicle.impact_factor
        
        if M_mid > max_moment:
            max_moment = M_mid
            max_moment_pos = front_pos
        
        max_shear = max(max_shear, abs(V_quarter))
        max_reaction_left = max(max_reaction_left, R_left)
        max_reaction_right = max(max_reaction_right, R_right)
    
    return {
        'span': span,
        'vehicle': vehicle.name,
        'max_moment': max_moment,
        'max_moment_position': max_moment_pos,
        'max_shear': max_shear,
        'max_reaction_left': max_reaction_left,
        'max_reaction_right': max_reaction_right,
        'impact_factor': vehicle.impact_factor
    }


# ============================================
# EXAMPLE USAGE
# ============================================

if __name__ == "__main__":
    print("=" * 60)
    print("MOVING LOAD ANALYSIS - IRC Class A on 30m Span")
    print("=" * 60)
    
    # Analyze IRC Class A on simple beam
    span = 30.0  # meters
    
    # Calculate IRC impact factor
    impact = MovingLoadGenerator.calculate_irc_impact_factor(span, 'CLASS_A')
    print(f"\nIRC Impact Factor for {span}m span: {impact:.3f}")
    
    # Update vehicle with calculated impact
    vehicle = Vehicle(
        name="IRC Class A",
        axles=IRC_CLASS_A.axles,
        impact_factor=1 + impact  # Total factor
    )
    
    # Quick analysis using influence lines
    result = analyze_simple_beam_moving_load(span, vehicle)
    
    print(f"\nVehicle: {result['vehicle']}")
    print(f"Total Impact Factor: {result['impact_factor']:.3f}")
    print(f"\nMaximum Bending Moment: {result['max_moment']:.2f} kN·m")
    print(f"  at vehicle position: {result['max_moment_position']:.2f} m")
    print(f"\nMaximum Shear Force: {result['max_shear']:.2f} kN")
    print(f"Maximum Reaction (Left): {result['max_reaction_left']:.2f} kN")
    print(f"Maximum Reaction (Right): {result['max_reaction_right']:.2f} kN")
    
    # Compare with other vehicles
    print("\n" + "=" * 60)
    print("COMPARISON OF STANDARD VEHICLES")
    print("=" * 60)
    
    vehicles = [IRC_CLASS_A, IRC_70R, AASHTO_HL93]
    
    print(f"\n{'Vehicle':<25} {'Total Load':>12} {'Max Moment':>15} {'Max Shear':>12}")
    print("-" * 70)
    
    for v in vehicles:
        result = analyze_simple_beam_moving_load(span, v)
        print(f"{v.name:<25} {v.total_load:>10.0f} kN {result['max_moment']:>12.1f} kN·m {result['max_shear']:>10.1f} kN")
