"""
Lane definitions and influence line analysis for moving loads

Provides:
- Lane path definitions for vehicle movement
- Simple beam influence line functions
- Quick moving load analysis using influence lines
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
import numpy as np
import math

from .moving_load_vehicles import Vehicle


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


__all__ = [
    "LanePoint",
    "Lane",
    "influence_line_moment",
    "influence_line_shear",
    "influence_line_reaction_left",
    "influence_line_reaction_right",
    "analyze_simple_beam_moving_load",
]
