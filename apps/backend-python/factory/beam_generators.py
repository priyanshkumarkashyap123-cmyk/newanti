"""
beam_generators.py - Beam and portal frame generation

Generators for:
- Continuous beams with multiple spans
- Simple/cantilever beams
- Single-bay portal frames
"""

from typing import List
from models import Node, Member, StructuralModel, SupportType, MemberType
from .constants import (
    SECTION_ISMB_300, SECTION_ISMB_400,
    COORDINATE_PRECISION, DEFAULT_INTERMEDIATE_NODES
)


class BeamGenerator:
    """Generator for beam-type structures."""

    @staticmethod
    def generate_continuous_beam(
        spans: List[float],
        intermediate_nodes: int = DEFAULT_INTERMEDIATE_NODES
    ) -> StructuralModel:
        """
        Generate a continuous beam with multiple spans.
        
        Creates intermediate nodes per span for smooth deflection rendering.
        
        Args:
            spans: List of span lengths in meters [span1, span2, span3, ...]
            intermediate_nodes: Number of intermediate nodes per span
        
        Returns:
            StructuralModel with continuous beam
        """
        nodes: List[Node] = []
        members: List[Member] = []
        
        x_position = 0.0
        node_counter = 1
        member_counter = 1
        prev_node_id = None
        
        for span_idx, span_length in enumerate(spans):
            # Calculate node spacing for this span
            total_nodes_in_span = intermediate_nodes + 1
            spacing = span_length / total_nodes_in_span
            
            # Create nodes for this span
            for i in range(total_nodes_in_span + 1):
                # Skip first node of subsequent spans (shared with previous)
                if span_idx > 0 and i == 0:
                    continue
                
                node_id = f"N{node_counter}"
                x = x_position + (i * spacing)
                
                # Determine support type
                is_span_start = (i == 0)
                is_span_end = (i == total_nodes_in_span)
                is_first_span = (span_idx == 0)
                is_last_span = (span_idx == len(spans) - 1)
                
                if is_span_start and is_first_span:
                    support = SupportType.PINNED
                elif is_span_end:
                    support = SupportType.ROLLER
                else:
                    support = SupportType.NONE
                
                nodes.append(Node(
                    id=node_id,
                    x=round(x, COORDINATE_PRECISION),
                    y=0.0,
                    z=0.0,
                    support=support
                ))
                
                # Create member from previous node
                if prev_node_id:
                    members.append(Member(
                        id=f"M{member_counter}",
                        start_node=prev_node_id,
                        end_node=node_id,
                        section_profile=SECTION_ISMB_300,
                        member_type=MemberType.BEAM
                    ))
                    member_counter += 1
                
                prev_node_id = node_id
                node_counter += 1
            
            # Move x_position to end of this span
            x_position += span_length
        
        return StructuralModel(
            nodes=nodes,
            members=members,
            metadata={
                "name": f"Continuous Beam ({len(spans)} spans)",
                "total_length": str(sum(spans)),
                "spans": ",".join(map(str, spans)),
                "units": "kN, m"
            }
        )

    @staticmethod
    def generate_simple_beam(
        span: float,
        support_type: str = "simple"
    ) -> StructuralModel:
        """
        Generate a simple beam with various support conditions.
        
        Args:
            span: Beam length in meters
            support_type: "simple", "cantilever", or "fixed"
        
        Returns:
            StructuralModel with simple beam
        """
        if support_type == "cantilever":
            left_support = SupportType.FIXED
            right_support = SupportType.NONE
        elif support_type == "fixed":
            left_support = SupportType.FIXED
            right_support = SupportType.FIXED
        else:  # simple
            left_support = SupportType.PINNED
            right_support = SupportType.ROLLER
        
        nodes = [
            Node(id="N1", x=0, y=0, z=0, support=left_support),
            Node(id="N2", x=round(span/2, COORDINATE_PRECISION), y=0, z=0, support=SupportType.NONE),
            Node(id="N3", x=span, y=0, z=0, support=right_support),
        ]
        
        members = [
            Member(id="M1", start_node="N1", end_node="N2", section_profile=SECTION_ISMB_300, member_type=MemberType.BEAM),
            Member(id="M2", start_node="N2", end_node="N3", section_profile=SECTION_ISMB_300, member_type=MemberType.BEAM),
        ]
        
        return StructuralModel(
            nodes=nodes,
            members=members,
            metadata={
                "name": f"{support_type.capitalize()} Beam ({span}m)",
                "span": str(span),
                "support_type": support_type,
                "units": "kN, m"
            }
        )

    @staticmethod
    def generate_portal_frame(
        width: float,
        eave_height: float,
        roof_angle: float = 15.0
    ) -> StructuralModel:
        """
        Generate a simple portal frame with pitched roof.
        
        Args:
            width: Width of portal in meters
            eave_height: Height to eave in meters
            roof_angle: Roof slope angle in degrees
        
        Returns:
            StructuralModel with portal frame
        """
        import math
        
        nodes: List[Node] = []
        members: List[Member] = []
        
        half_width = width / 2
        ridge_rise = half_width * math.tan(math.radians(roof_angle))
        ridge_height = eave_height + ridge_rise
        
        # Nodes
        nodes.extend([
            Node(id="N1", x=0, y=0, z=0, support=SupportType.FIXED),
            Node(id="N2", x=0, y=eave_height, z=0, support=SupportType.NONE),
            Node(id="N3", x=half_width, y=ridge_height, z=0, support=SupportType.NONE),
            Node(id="N4", x=width, y=eave_height, z=0, support=SupportType.NONE),
            Node(id="N5", x=width, y=0, z=0, support=SupportType.FIXED),
        ])
        
        # Members
        members.extend([
            Member(id="M1", start_node="N1", end_node="N2", section_profile=SECTION_ISMB_400, member_type=MemberType.COLUMN),
            Member(id="M2", start_node="N2", end_node="N3", section_profile=SECTION_ISMB_300, member_type=MemberType.BEAM),
            Member(id="M3", start_node="N3", end_node="N4", section_profile=SECTION_ISMB_300, member_type=MemberType.BEAM),
            Member(id="M4", start_node="N4", end_node="N5", section_profile=SECTION_ISMB_400, member_type=MemberType.COLUMN),
        ])
        
        return StructuralModel(
            nodes=nodes,
            members=members,
            metadata={
                "name": f"Portal Frame ({width}m x {eave_height}m)",
                "width": str(width),
                "eave_height": str(eave_height),
                "roof_angle": str(roof_angle),
                "units": "kN, m"
            }
        )
