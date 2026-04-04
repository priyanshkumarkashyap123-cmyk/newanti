"""
Load engine utility functions.

Helper functions for load generation and processing.
"""

from typing import List, Dict

from .load_models import UniformLoad
from .load_types import LoadDirection


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
        gravity: Gravitational acceleration (m/s²) - not used in simple calculation
        
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
