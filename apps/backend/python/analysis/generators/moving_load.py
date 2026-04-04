"""
moving_load.py - Moving Vehicle Load Analysis for Bridges

Lightweight façade re-exporting extracted components:
- Vehicle and axle definitions → moving_load_vehicles
- Lane and influence line analysis → moving_load_influence

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

from typing import Dict, Optional, List, Tuple
import math

# Re-export vehicle definitions
from .moving_load_vehicles import (
    Axle,
    Vehicle,
    IRC_CLASS_A,
    IRC_CLASS_AA,
    IRC_70R,
    AASHTO_HL93,
    EC_LM1_TANDEM,
    STANDARD_VEHICLES,
)

# Re-export lane and influence line functions
from .moving_load_influence import (
    LanePoint,
    Lane,
    influence_line_moment,
    influence_line_shear,
    influence_line_reaction_left,
    influence_line_reaction_right,
    analyze_simple_beam_moving_load,
)

import numpy as np
from dataclasses import dataclass, field


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


__all__ = [
    # Vehicle definitions (re-exported)
    "Axle",
    "Vehicle",
    "IRC_CLASS_A",
    "IRC_CLASS_AA",
    "IRC_70R",
    "AASHTO_HL93",
    "EC_LM1_TANDEM",
    "STANDARD_VEHICLES",
    # Lane and influence (re-exported)
    "LanePoint",
    "Lane",
    "influence_line_moment",
    "influence_line_shear",
    "influence_line_reaction_left",
    "influence_line_reaction_right",
    "analyze_simple_beam_moving_load",
    # Envelope and generator (this module)
    "InfluenceEnvelope",
    "MovingLoadGenerator",
]
