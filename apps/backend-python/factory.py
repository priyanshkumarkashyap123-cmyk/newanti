"""
factory.py - Structural Model Factory

Mathematical generation of structural models using loops and trigonometry.
"""

from typing import List
from models import (
    Node, Member, StructuralModel,
    SupportType, MemberType
)


class StructuralFactory:
    """
    Factory class for mathematically generating structural models.
    All coordinates are in meters. Y-axis is vertical.
    """

    # ============================================
    # CONTINUOUS BEAM GENERATOR
    # ============================================

    @staticmethod
    def generate_continuous_beam(
        spans: List[float],
        intermediate_nodes: int = 10
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
            # Total nodes = intermediate_nodes + 1 (for end node, start is shared)
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
                    support = SupportType.ROLLER if not is_last_span else SupportType.ROLLER
                else:
                    support = SupportType.NONE
                
                nodes.append(Node(
                    id=node_id,
                    x=round(x, 4),
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
                        section_profile="ISMB300",
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

    # ============================================
    # PRATT TRUSS GENERATOR
    # ============================================

    @staticmethod
    def generate_pratt_truss(
        span: float,
        height: float,
        bays: int
    ) -> StructuralModel:
        """
        Generate a Pratt truss with proper diagonal orientation.
        
        Pratt truss characteristics:
        - Verticals in compression
        - Diagonals in tension (sloping towards center)
        
        Args:
            span: Total span in meters
            height: Truss height in meters
            bays: Number of bays/panels
        
        Returns:
            StructuralModel with Pratt truss
        """
        nodes: List[Node] = []
        members: List[Member] = []
        
        bay_width = span / bays
        node_counter = 1
        member_counter = 1
        
        bottom_nodes: List[str] = []
        top_nodes: List[str] = []
        
        # ----------------------------------------
        # Generate Nodes
        # ----------------------------------------
        for i in range(bays + 1):
            x = i * bay_width
            
            # Bottom chord node
            bottom_id = f"N{node_counter}"
            bottom_support = SupportType.NONE
            if i == 0:
                bottom_support = SupportType.PINNED
            elif i == bays:
                bottom_support = SupportType.ROLLER
            
            nodes.append(Node(
                id=bottom_id,
                x=round(x, 4),
                y=0.0,
                z=0.0,
                support=bottom_support
            ))
            bottom_nodes.append(bottom_id)
            node_counter += 1
            
            # Top chord node
            top_id = f"N{node_counter}"
            nodes.append(Node(
                id=top_id,
                x=round(x, 4),
                y=height,
                z=0.0,
                support=SupportType.NONE
            ))
            top_nodes.append(top_id)
            node_counter += 1
        
        # ----------------------------------------
        # Generate Bottom Chord Members
        # ----------------------------------------
        for i in range(bays):
            members.append(Member(
                id=f"M{member_counter}",
                start_node=bottom_nodes[i],
                end_node=bottom_nodes[i + 1],
                section_profile="ISA100x100x10",
                member_type=MemberType.CHORD
            ))
            member_counter += 1
        
        # ----------------------------------------
        # Generate Top Chord Members
        # ----------------------------------------
        for i in range(bays):
            members.append(Member(
                id=f"M{member_counter}",
                start_node=top_nodes[i],
                end_node=top_nodes[i + 1],
                section_profile="ISA100x100x10",
                member_type=MemberType.CHORD
            ))
            member_counter += 1
        
        # ----------------------------------------
        # Generate Vertical Members
        # ----------------------------------------
        for i in range(bays + 1):
            members.append(Member(
                id=f"M{member_counter}",
                start_node=bottom_nodes[i],
                end_node=top_nodes[i],
                section_profile="ISA75x75x8",
                member_type=MemberType.VERTICAL
            ))
            member_counter += 1
        
        # ----------------------------------------
        # Generate Diagonal Members (Pratt Pattern)
        # Diagonals slope towards the center
        # ----------------------------------------
        mid_bay = bays // 2
        
        for i in range(bays):
            if i < mid_bay:
                # Left half: diagonal from bottom-left to top-right
                members.append(Member(
                    id=f"M{member_counter}",
                    start_node=bottom_nodes[i],
                    end_node=top_nodes[i + 1],
                    section_profile="ISA75x75x8",
                    member_type=MemberType.DIAGONAL
                ))
            else:
                # Right half: diagonal from bottom-right to top-left
                members.append(Member(
                    id=f"M{member_counter}",
                    start_node=bottom_nodes[i + 1],
                    end_node=top_nodes[i],
                    section_profile="ISA75x75x8",
                    member_type=MemberType.DIAGONAL
                ))
            member_counter += 1
        
        return StructuralModel(
            nodes=nodes,
            members=members,
            metadata={
                "name": f"Pratt Truss ({span}m span, {bays} bays)",
                "span": str(span),
                "height": str(height),
                "bays": str(bays),
                "units": "kN, m"
            }
        )

    # ============================================
    # 3D FRAME GENERATOR
    # ============================================

    @staticmethod
    def generate_3d_frame(
        width: float,
        length: float,
        height: float,
        stories: int,
        bays_x: int = 2,
        bays_z: int = 2
    ) -> StructuralModel:
        """
        Generate a 3D building frame with columns and beams.
        
        Creates a grid of columns at each story with connecting beams.
        
        Args:
            width: Frame width in X direction (meters)
            length: Frame length in Z direction (meters)
            height: Story height (meters)
            stories: Number of stories
            bays_x: Number of bays in X direction
            bays_z: Number of bays in Z direction
        
        Returns:
            StructuralModel with 3D frame
        """
        nodes: List[Node] = []
        members: List[Member] = []
        
        # Calculate spacings
        spacing_x = width / bays_x if bays_x > 0 else width
        spacing_z = length / bays_z if bays_z > 0 else length
        
        node_counter = 1
        member_counter = 1
        
        # Node grid: [story][row_z][col_x]
        node_grid: List[List[List[str]]] = []
        
        # ----------------------------------------
        # Generate Nodes (Nested loops for X, Y, Z)
        # ----------------------------------------
        for story in range(stories + 1):
            story_nodes: List[List[str]] = []
            y = story * height
            
            for row_z in range(bays_z + 1):
                row_nodes: List[str] = []
                z = row_z * spacing_z
                
                for col_x in range(bays_x + 1):
                    x = col_x * spacing_x
                    
                    node_id = f"N{node_counter}"
                    
                    # Assign FIXED supports at ground level (Y=0)
                    support = SupportType.FIXED if story == 0 else SupportType.NONE
                    
                    nodes.append(Node(
                        id=node_id,
                        x=round(x, 4),
                        y=round(y, 4),
                        z=round(z, 4),
                        support=support
                    ))
                    
                    row_nodes.append(node_id)
                    node_counter += 1
                
                story_nodes.append(row_nodes)
            node_grid.append(story_nodes)
        
        # ----------------------------------------
        # Generate Columns (Vertical members)
        # ----------------------------------------
        for story in range(stories):
            for row_z in range(bays_z + 1):
                for col_x in range(bays_x + 1):
                    bottom_node = node_grid[story][row_z][col_x]
                    top_node = node_grid[story + 1][row_z][col_x]
                    
                    # Larger sections for lower stories
                    section = "ISMB400" if story < stories // 2 else "ISMB350"
                    
                    members.append(Member(
                        id=f"M{member_counter}",
                        start_node=bottom_node,
                        end_node=top_node,
                        section_profile=section,
                        member_type=MemberType.COLUMN
                    ))
                    member_counter += 1
        
        # ----------------------------------------
        # Generate Beams in X direction
        # ----------------------------------------
        for story in range(1, stories + 1):
            for row_z in range(bays_z + 1):
                for col_x in range(bays_x):
                    left_node = node_grid[story][row_z][col_x]
                    right_node = node_grid[story][row_z][col_x + 1]
                    
                    members.append(Member(
                        id=f"M{member_counter}",
                        start_node=left_node,
                        end_node=right_node,
                        section_profile="ISMB300",
                        member_type=MemberType.BEAM
                    ))
                    member_counter += 1
        
        # ----------------------------------------
        # Generate Beams in Z direction
        # ----------------------------------------
        for story in range(1, stories + 1):
            for row_z in range(bays_z):
                for col_x in range(bays_x + 1):
                    front_node = node_grid[story][row_z][col_x]
                    back_node = node_grid[story][row_z + 1][col_x]
                    
                    members.append(Member(
                        id=f"M{member_counter}",
                        start_node=front_node,
                        end_node=back_node,
                        section_profile="ISMB300",
                        member_type=MemberType.BEAM
                    ))
                    member_counter += 1
        
        return StructuralModel(
            nodes=nodes,
            members=members,
            metadata={
                "name": f"3D Frame (G+{stories-1}, {bays_x}x{bays_z} bays)",
                "width": str(width),
                "length": str(length),
                "height": str(height),
                "stories": str(stories),
                "bays_x": str(bays_x),
                "bays_z": str(bays_z),
                "units": "kN, m"
            }
        )

    # ============================================
    # ADDITIONAL GENERATORS
    # ============================================

    @staticmethod
    def generate_portal_frame(
        width: float,
        eave_height: float,
        roof_angle: float = 15.0
    ) -> StructuralModel:
        """Generate a simple portal frame with pitched roof."""
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
            Member(id="M1", start_node="N1", end_node="N2", section_profile="ISMB400", member_type=MemberType.COLUMN),
            Member(id="M2", start_node="N2", end_node="N3", section_profile="ISMB300", member_type=MemberType.BEAM),
            Member(id="M3", start_node="N3", end_node="N4", section_profile="ISMB300", member_type=MemberType.BEAM),
            Member(id="M4", start_node="N4", end_node="N5", section_profile="ISMB400", member_type=MemberType.COLUMN),
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

    @staticmethod
    def generate_simple_beam(
        span: float,
        support_type: str = "simple"
    ) -> StructuralModel:
        """Generate a simple beam with various support conditions."""
        
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
            Node(id="N2", x=span/2, y=0, z=0, support=SupportType.NONE),
            Node(id="N3", x=span, y=0, z=0, support=right_support),
        ]
        
        members = [
            Member(id="M1", start_node="N1", end_node="N2", section_profile="ISMB300", member_type=MemberType.BEAM),
            Member(id="M2", start_node="N2", end_node="N3", section_profile="ISMB300", member_type=MemberType.BEAM),
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
