"""
arch_generators.py - Arch structure generation

Generators for:
- Parabolic arches
- Circular arches
"""

from typing import List
from models import Node, Member, StructuralModel, SupportType, MemberType
from .constants import (
    SECTION_ISMB_400,
    COORDINATE_PRECISION
)


class ArchGenerator:
    """Generator for arch-type structures."""

    @staticmethod
    def generate_arch(
        span: float,
        rise: float,
        segments: int = 10,
        arch_type: str = "parabolic"
    ) -> StructuralModel:
        """
        Generate a parabolic or circular arch.
        
        Args:
            span: Total span of the arch
            rise: Height at crown
            segments: Number of segments
            arch_type: "parabolic" or "circular"
        
        Returns:
            StructuralModel with arch
        """
        import math
        
        nodes: List[Node] = []
        members: List[Member] = []
        
        node_counter = 1
        member_counter = 1
        
        # Generate arch nodes
        for i in range(segments + 1):
            t = i / segments
            x = t * span
            
            if arch_type == "circular":
                # Circular arch
                R = (span**2 + 4*rise**2) / (8*rise)
                angle = math.asin((x - span/2) / R)
                y = math.sqrt(R**2 - (x - span/2)**2) - (R - rise)
            else:
                # Parabolic arch: y = 4*rise*x*(span-x) / span^2
                y = 4 * rise * x * (span - x) / (span ** 2)
            
            node_id = f"N{node_counter}"
            
            # Supports at ends
            if i == 0:
                support = SupportType.PINNED
            elif i == segments:
                support = SupportType.ROLLER
            else:
                support = SupportType.NONE
            
            nodes.append(Node(
                id=node_id,
                x=round(x, COORDINATE_PRECISION),
                y=round(max(0, y), COORDINATE_PRECISION),
                z=0,
                support=support
            ))
            node_counter += 1
        
        # Arch members
        for i in range(segments):
            members.append(Member(
                id=f"M{member_counter}",
                start_node=f"N{i + 1}",
                end_node=f"N{i + 2}",
                section_profile=SECTION_ISMB_400,
                member_type=MemberType.BEAM
            ))
            member_counter += 1
        
        return StructuralModel(
            nodes=nodes,
            members=members,
            metadata={
                "name": f"{arch_type.capitalize()} Arch ({span}m span, {rise}m rise)",
                "span": str(span),
                "rise": str(rise),
                "segments": str(segments),
                "arch_type": arch_type,
                "units": "kN, m"
            }
        )
