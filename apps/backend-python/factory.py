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

    # ============================================
    # WARREN TRUSS GENERATOR
    # ============================================

    @staticmethod
    def generate_warren_truss(
        span: float,
        height: float,
        bays: int
    ) -> StructuralModel:
        """
        Generate a Warren truss (triangular pattern without verticals).
        
        Warren truss characteristics:
        - Equilateral or isosceles triangles
        - No vertical members
        - Alternating tension/compression in diagonals
        """
        nodes: List[Node] = []
        members: List[Member] = []
        
        bay_width = span / bays
        node_counter = 1
        member_counter = 1
        
        bottom_nodes: List[str] = []
        top_nodes: List[str] = []
        
        # Generate bottom chord nodes
        for i in range(bays + 1):
            x = i * bay_width
            node_id = f"N{node_counter}"
            
            support = SupportType.NONE
            if i == 0:
                support = SupportType.PINNED
            elif i == bays:
                support = SupportType.ROLLER
            
            nodes.append(Node(id=node_id, x=round(x, 4), y=0, z=0, support=support))
            bottom_nodes.append(node_id)
            node_counter += 1
        
        # Generate top chord nodes (offset by half bay width)
        for i in range(bays):
            x = (i + 0.5) * bay_width
            node_id = f"N{node_counter}"
            nodes.append(Node(id=node_id, x=round(x, 4), y=height, z=0, support=SupportType.NONE))
            top_nodes.append(node_id)
            node_counter += 1
        
        # Bottom chord members
        for i in range(bays):
            members.append(Member(
                id=f"M{member_counter}",
                start_node=bottom_nodes[i],
                end_node=bottom_nodes[i + 1],
                section_profile="ISA100x100x10",
                member_type=MemberType.CHORD
            ))
            member_counter += 1
        
        # Top chord members
        for i in range(bays - 1):
            members.append(Member(
                id=f"M{member_counter}",
                start_node=top_nodes[i],
                end_node=top_nodes[i + 1],
                section_profile="ISA100x100x10",
                member_type=MemberType.CHORD
            ))
            member_counter += 1
        
        # Diagonal members (zigzag pattern)
        for i in range(bays):
            # Rising diagonal (bottom left to top)
            members.append(Member(
                id=f"M{member_counter}",
                start_node=bottom_nodes[i],
                end_node=top_nodes[i],
                section_profile="ISA75x75x8",
                member_type=MemberType.DIAGONAL
            ))
            member_counter += 1
            
            # Falling diagonal (top to bottom right)
            members.append(Member(
                id=f"M{member_counter}",
                start_node=top_nodes[i],
                end_node=bottom_nodes[i + 1],
                section_profile="ISA75x75x8",
                member_type=MemberType.DIAGONAL
            ))
            member_counter += 1
        
        return StructuralModel(
            nodes=nodes,
            members=members,
            metadata={
                "name": f"Warren Truss ({span}m span, {bays} bays)",
                "span": str(span),
                "height": str(height),
                "bays": str(bays),
                "units": "kN, m"
            }
        )

    # ============================================
    # HOWE TRUSS GENERATOR
    # ============================================

    @staticmethod
    def generate_howe_truss(
        span: float,
        height: float,
        bays: int
    ) -> StructuralModel:
        """
        Generate a Howe truss (opposite of Pratt).
        
        Howe truss characteristics:
        - Verticals in tension
        - Diagonals in compression (sloping away from center)
        """
        nodes: List[Node] = []
        members: List[Member] = []
        
        bay_width = span / bays
        node_counter = 1
        member_counter = 1
        
        bottom_nodes: List[str] = []
        top_nodes: List[str] = []
        
        # Generate nodes (same as Pratt)
        for i in range(bays + 1):
            x = i * bay_width
            
            bottom_id = f"N{node_counter}"
            support = SupportType.PINNED if i == 0 else (SupportType.ROLLER if i == bays else SupportType.NONE)
            nodes.append(Node(id=bottom_id, x=round(x, 4), y=0, z=0, support=support))
            bottom_nodes.append(bottom_id)
            node_counter += 1
            
            top_id = f"N{node_counter}"
            nodes.append(Node(id=top_id, x=round(x, 4), y=height, z=0, support=SupportType.NONE))
            top_nodes.append(top_id)
            node_counter += 1
        
        # Chords
        for i in range(bays):
            members.append(Member(id=f"M{member_counter}", start_node=bottom_nodes[i], end_node=bottom_nodes[i + 1], section_profile="ISA100x100x10", member_type=MemberType.CHORD))
            member_counter += 1
            members.append(Member(id=f"M{member_counter}", start_node=top_nodes[i], end_node=top_nodes[i + 1], section_profile="ISA100x100x10", member_type=MemberType.CHORD))
            member_counter += 1
        
        # Verticals
        for i in range(bays + 1):
            members.append(Member(id=f"M{member_counter}", start_node=bottom_nodes[i], end_node=top_nodes[i], section_profile="ISA75x75x8", member_type=MemberType.VERTICAL))
            member_counter += 1
        
        # Diagonals (opposite of Pratt - slope away from center)
        mid_bay = bays // 2
        for i in range(bays):
            if i < mid_bay:
                members.append(Member(id=f"M{member_counter}", start_node=top_nodes[i], end_node=bottom_nodes[i + 1], section_profile="ISA75x75x8", member_type=MemberType.DIAGONAL))
            else:
                members.append(Member(id=f"M{member_counter}", start_node=top_nodes[i + 1], end_node=bottom_nodes[i], section_profile="ISA75x75x8", member_type=MemberType.DIAGONAL))
            member_counter += 1
        
        return StructuralModel(nodes=nodes, members=members, metadata={"name": f"Howe Truss ({span}m)", "span": str(span), "height": str(height), "bays": str(bays), "units": "kN, m"})

    # ============================================
    # TRANSMISSION TOWER GENERATOR
    # ============================================

    @staticmethod
    def generate_tower(
        base_width: float,
        top_width: float,
        height: float,
        levels: int = 4
    ) -> StructuralModel:
        """Generate a tapered lattice tower (like transmission towers)."""
        import math
        
        nodes: List[Node] = []
        members: List[Member] = []
        
        node_counter = 1
        member_counter = 1
        
        level_nodes: List[List[str]] = []
        level_height = height / levels
        
        # Generate nodes at each level (4 corners)
        for level in range(levels + 1):
            y = level * level_height
            t = level / levels
            current_width = base_width * (1 - t) + top_width * t
            half_w = current_width / 2
            
            level_node_ids = []
            corners = [(-half_w, -half_w), (half_w, -half_w), (half_w, half_w), (-half_w, half_w)]
            
            for x, z in corners:
                node_id = f"N{node_counter}"
                support = SupportType.FIXED if level == 0 else SupportType.NONE
                nodes.append(Node(id=node_id, x=round(x, 4), y=round(y, 4), z=round(z, 4), support=support))
                level_node_ids.append(node_id)
                node_counter += 1
            
            level_nodes.append(level_node_ids)
        
        # Horizontal bracing at each level
        for level in range(levels + 1):
            ln = level_nodes[level]
            for i in range(4):
                members.append(Member(id=f"M{member_counter}", start_node=ln[i], end_node=ln[(i + 1) % 4], section_profile="ISA50x50x6", member_type=MemberType.BRACE))
                member_counter += 1
            # Cross bracing on each face
            members.append(Member(id=f"M{member_counter}", start_node=ln[0], end_node=ln[2], section_profile="ISA50x50x6", member_type=MemberType.BRACE))
            member_counter += 1
            members.append(Member(id=f"M{member_counter}", start_node=ln[1], end_node=ln[3], section_profile="ISA50x50x6", member_type=MemberType.BRACE))
            member_counter += 1
        
        # Vertical legs and X-bracing between levels
        for level in range(levels):
            lower = level_nodes[level]
            upper = level_nodes[level + 1]
            
            for i in range(4):
                # Vertical leg
                members.append(Member(id=f"M{member_counter}", start_node=lower[i], end_node=upper[i], section_profile="ISA75x75x8", member_type=MemberType.COLUMN))
                member_counter += 1
                # X-bracing on face
                members.append(Member(id=f"M{member_counter}", start_node=lower[i], end_node=upper[(i + 1) % 4], section_profile="ISA50x50x6", member_type=MemberType.DIAGONAL))
                member_counter += 1
        
        return StructuralModel(nodes=nodes, members=members, metadata={"name": f"Lattice Tower ({height}m)", "height": str(height), "base_width": str(base_width), "top_width": str(top_width), "units": "kN, m"})

    # ============================================
    # BRIDGE TRUSS GENERATOR (Deck Bridge)
    # ============================================

    @staticmethod
    def generate_bridge(
        span: float,
        deck_width: float,
        truss_height: float,
        panels: int = 6
    ) -> StructuralModel:
        """Generate a deck-type truss bridge with two parallel trusses."""
        nodes: List[Node] = []
        members: List[Member] = []
        
        panel_length = span / panels
        node_counter = 1
        member_counter = 1
        
        # Two parallel trusses at z=0 and z=deck_width
        for z_pos in [0, deck_width]:
            bottom_nodes = []
            top_nodes = []
            
            # Create nodes for this truss
            for i in range(panels + 1):
                x = i * panel_length
                
                # Bottom node (deck level)
                bot_id = f"N{node_counter}"
                support = SupportType.PINNED if i == 0 and z_pos == 0 else (SupportType.ROLLER if i in [0, panels] else SupportType.NONE)
                if i == panels and z_pos == 0:
                    support = SupportType.ROLLER
                nodes.append(Node(id=bot_id, x=round(x, 4), y=0, z=round(z_pos, 4), support=support))
                bottom_nodes.append(bot_id)
                node_counter += 1
                
                # Top node
                top_id = f"N{node_counter}"
                nodes.append(Node(id=top_id, x=round(x, 4), y=truss_height, z=round(z_pos, 4), support=SupportType.NONE))
                top_nodes.append(top_id)
                node_counter += 1
            
            # Bottom chord
            for i in range(panels):
                members.append(Member(id=f"M{member_counter}", start_node=bottom_nodes[i], end_node=bottom_nodes[i + 1], section_profile="ISMB400", member_type=MemberType.CHORD))
                member_counter += 1
            
            # Top chord
            for i in range(panels):
                members.append(Member(id=f"M{member_counter}", start_node=top_nodes[i], end_node=top_nodes[i + 1], section_profile="ISMB400", member_type=MemberType.CHORD))
                member_counter += 1
            
            # Verticals
            for i in range(panels + 1):
                members.append(Member(id=f"M{member_counter}", start_node=bottom_nodes[i], end_node=top_nodes[i], section_profile="ISMB300", member_type=MemberType.VERTICAL))
                member_counter += 1
            
            # Diagonals (Pratt pattern)
            mid_panel = panels // 2
            for i in range(panels):
                if i < mid_panel:
                    members.append(Member(id=f"M{member_counter}", start_node=bottom_nodes[i], end_node=top_nodes[i + 1], section_profile="ISMB300", member_type=MemberType.DIAGONAL))
                else:
                    members.append(Member(id=f"M{member_counter}", start_node=bottom_nodes[i + 1], end_node=top_nodes[i], section_profile="ISMB300", member_type=MemberType.DIAGONAL))
                member_counter += 1
        
        # Cross bracing between trusses (floor beams at bottom chord)
        for i in range(panels + 1):
            bot_left = f"N{1 + i * 2}"
            bot_right = f"N{1 + i * 2 + (panels + 1) * 2}"
            members.append(Member(id=f"M{member_counter}", start_node=bot_left, end_node=bot_right, section_profile="ISMB350", member_type=MemberType.BEAM))
            member_counter += 1
        
        return StructuralModel(nodes=nodes, members=members, metadata={"name": f"Bridge ({span}m span)", "span": str(span), "deck_width": str(deck_width), "truss_height": str(truss_height), "panels": str(panels), "units": "kN, m"})

    # ============================================
    # MULTI-BAY PORTAL FRAME (Industrial Shed)
    # ============================================

    @staticmethod
    def generate_multi_bay_portal(
        total_width: float,
        eave_height: float,
        bays: int = 3,
        roof_angle: float = 10.0,
        length: float = 0,
        frames: int = 1
    ) -> StructuralModel:
        """
        Generate a multi-bay industrial portal frame.
        
        Args:
            total_width: Total width of the shed
            eave_height: Column height at eave
            bays: Number of bays (spans)
            roof_angle: Roof pitch in degrees
            length: Length in Z direction (for 3D)
            frames: Number of frames in Z direction
        """
        import math
        
        nodes: List[Node] = []
        members: List[Member] = []
        
        bay_width = total_width / bays
        half_bay = bay_width / 2
        ridge_rise = half_bay * math.tan(math.radians(roof_angle))
        
        node_counter = 1
        member_counter = 1
        
        frame_spacing = length / (frames - 1) if frames > 1 and length > 0 else 0
        
        for frame_idx in range(max(1, frames)):
            z = frame_idx * frame_spacing if frames > 1 else 0
            frame_nodes = {"base": [], "eave": [], "ridge": []}
            
            # Generate nodes for this frame
            for bay in range(bays + 1):
                x = bay * bay_width
                
                # Base node
                base_id = f"N{node_counter}"
                nodes.append(Node(id=base_id, x=round(x, 4), y=0, z=round(z, 4), support=SupportType.FIXED))
                frame_nodes["base"].append(base_id)
                node_counter += 1
                
                # Eave node
                eave_id = f"N{node_counter}"
                nodes.append(Node(id=eave_id, x=round(x, 4), y=eave_height, z=round(z, 4), support=SupportType.NONE))
                frame_nodes["eave"].append(eave_id)
                node_counter += 1
            
            # Ridge nodes (at center of each bay)
            for bay in range(bays):
                x = bay * bay_width + half_bay
                ridge_id = f"N{node_counter}"
                nodes.append(Node(id=ridge_id, x=round(x, 4), y=eave_height + ridge_rise, z=round(z, 4), support=SupportType.NONE))
                frame_nodes["ridge"].append(ridge_id)
                node_counter += 1
            
            # Columns
            for i in range(bays + 1):
                members.append(Member(
                    id=f"M{member_counter}",
                    start_node=frame_nodes["base"][i],
                    end_node=frame_nodes["eave"][i],
                    section_profile="ISMB400",
                    member_type=MemberType.COLUMN
                ))
                member_counter += 1
            
            # Rafters
            for bay in range(bays):
                # Left rafter
                members.append(Member(
                    id=f"M{member_counter}",
                    start_node=frame_nodes["eave"][bay],
                    end_node=frame_nodes["ridge"][bay],
                    section_profile="ISMB300",
                    member_type=MemberType.BEAM
                ))
                member_counter += 1
                # Right rafter
                members.append(Member(
                    id=f"M{member_counter}",
                    start_node=frame_nodes["ridge"][bay],
                    end_node=frame_nodes["eave"][bay + 1],
                    section_profile="ISMB300",
                    member_type=MemberType.BEAM
                ))
                member_counter += 1
        
        return StructuralModel(
            nodes=nodes,
            members=members,
            metadata={
                "name": f"Multi-Bay Portal ({bays} bays, {total_width}m)",
                "total_width": str(total_width),
                "bays": str(bays),
                "eave_height": str(eave_height),
                "roof_angle": str(roof_angle),
                "units": "kN, m"
            }
        )

    # ============================================
    # PARABOLIC ARCH GENERATOR
    # ============================================

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
                x=round(x, 4),
                y=round(max(0, y), 4),
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
                section_profile="ISMB400",
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

    # ============================================
    # SPACE TRUSS (ROOF) GENERATOR
    # ============================================

    @staticmethod
    def generate_space_truss(
        width: float,
        length: float,
        depth: float,
        bays_x: int = 4,
        bays_z: int = 4
    ) -> StructuralModel:
        """
        Generate a double-layer space truss (flat roof system).
        
        Args:
            width: Width in X direction
            length: Length in Z direction
            depth: Vertical distance between layers
            bays_x: Number of bays in X
            bays_z: Number of bays in Z
        """
        nodes: List[Node] = []
        members: List[Member] = []
        
        spacing_x = width / bays_x
        spacing_z = length / bays_z
        offset = spacing_x / 2  # Offset for bottom layer
        
        node_counter = 1
        member_counter = 1
        
        top_nodes: List[List[str]] = []
        bottom_nodes: List[List[str]] = []
        
        # Top layer nodes
        for j in range(bays_z + 1):
            row = []
            for i in range(bays_x + 1):
                x = i * spacing_x
                z = j * spacing_z
                node_id = f"N{node_counter}"
                
                # Supports at corners
                is_corner = (i in [0, bays_x]) and (j in [0, bays_z])
                support = SupportType.PINNED if is_corner else SupportType.NONE
                
                nodes.append(Node(id=node_id, x=round(x, 4), y=depth, z=round(z, 4), support=support))
                row.append(node_id)
                node_counter += 1
            top_nodes.append(row)
        
        # Bottom layer nodes (offset grid)
        for j in range(bays_z):
            row = []
            for i in range(bays_x):
                x = offset + i * spacing_x
                z = offset + j * spacing_z
                node_id = f"N{node_counter}"
                nodes.append(Node(id=node_id, x=round(x, 4), y=0, z=round(z, 4), support=SupportType.NONE))
                row.append(node_id)
                node_counter += 1
            bottom_nodes.append(row)
        
        # Top layer grid members (X direction)
        for j in range(bays_z + 1):
            for i in range(bays_x):
                members.append(Member(
                    id=f"M{member_counter}",
                    start_node=top_nodes[j][i],
                    end_node=top_nodes[j][i + 1],
                    section_profile="ISA75x75x8",
                    member_type=MemberType.CHORD
                ))
                member_counter += 1
        
        # Top layer grid members (Z direction)
        for j in range(bays_z):
            for i in range(bays_x + 1):
                members.append(Member(
                    id=f"M{member_counter}",
                    start_node=top_nodes[j][i],
                    end_node=top_nodes[j + 1][i],
                    section_profile="ISA75x75x8",
                    member_type=MemberType.CHORD
                ))
                member_counter += 1
        
        # Bottom layer grid members (X direction)
        for j in range(bays_z):
            for i in range(bays_x - 1):
                members.append(Member(
                    id=f"M{member_counter}",
                    start_node=bottom_nodes[j][i],
                    end_node=bottom_nodes[j][i + 1],
                    section_profile="ISA75x75x8",
                    member_type=MemberType.CHORD
                ))
                member_counter += 1
        
        # Bottom layer grid members (Z direction)
        for j in range(bays_z - 1):
            for i in range(bays_x):
                members.append(Member(
                    id=f"M{member_counter}",
                    start_node=bottom_nodes[j][i],
                    end_node=bottom_nodes[j + 1][i],
                    section_profile="ISA75x75x8",
                    member_type=MemberType.CHORD
                ))
                member_counter += 1
        
        # Diagonal web members (connect top and bottom layers)
        for j in range(bays_z):
            for i in range(bays_x):
                bottom_node = bottom_nodes[j][i]
                # Connect to 4 surrounding top nodes
                for di, dj in [(0, 0), (0, 1), (1, 0), (1, 1)]:
                    if j + dj <= bays_z and i + di <= bays_x:
                        top_node = top_nodes[j + dj][i + di]
                        members.append(Member(
                            id=f"M{member_counter}",
                            start_node=bottom_node,
                            end_node=top_node,
                            section_profile="ISA50x50x6",
                            member_type=MemberType.DIAGONAL
                        ))
                        member_counter += 1
        
        return StructuralModel(
            nodes=nodes,
            members=members,
            metadata={
                "name": f"Space Truss ({width}m x {length}m)",
                "width": str(width),
                "length": str(length),
                "depth": str(depth),
                "units": "kN, m"
            }
        )

    # ============================================
    # CANTILEVER STRUCTURE (Canopy/Balcony)
    # ============================================

    @staticmethod
    def generate_cantilever_structure(
        cantilever_length: float,
        height: float,
        width: float = 0,
        structure_type: str = "canopy"
    ) -> StructuralModel:
        """
        Generate a cantilever structure (canopy, balcony, awning).
        
        Args:
            cantilever_length: Projection length
            height: Height of support column
            width: Width (for 3D structures)
            structure_type: "canopy", "balcony", "awning"
        """
        nodes: List[Node] = []
        members: List[Member] = []
        
        node_counter = 1
        member_counter = 1
        
        if width > 0:
            # 3D cantilever (like a covered walkway)
            for z in [0, width]:
                # Column base
                base_id = f"N{node_counter}"
                nodes.append(Node(id=base_id, x=0, y=0, z=z, support=SupportType.FIXED))
                node_counter += 1
                
                # Column top
                top_id = f"N{node_counter}"
                nodes.append(Node(id=top_id, x=0, y=height, z=z, support=SupportType.NONE))
                node_counter += 1
                
                # Cantilever tip
                tip_id = f"N{node_counter}"
                nodes.append(Node(id=tip_id, x=cantilever_length, y=height, z=z, support=SupportType.NONE))
                node_counter += 1
                
                # Column
                members.append(Member(
                    id=f"M{member_counter}",
                    start_node=base_id,
                    end_node=top_id,
                    section_profile="ISMB400",
                    member_type=MemberType.COLUMN
                ))
                member_counter += 1
                
                # Cantilever beam
                members.append(Member(
                    id=f"M{member_counter}",
                    start_node=top_id,
                    end_node=tip_id,
                    section_profile="ISMB350",
                    member_type=MemberType.BEAM
                ))
                member_counter += 1
            
            # Cross beams
            members.append(Member(id=f"M{member_counter}", start_node="N2", end_node="N5", section_profile="ISMB300", member_type=MemberType.BEAM))
            member_counter += 1
            members.append(Member(id=f"M{member_counter}", start_node="N3", end_node="N6", section_profile="ISMB300", member_type=MemberType.BEAM))
            
        else:
            # 2D cantilever
            nodes = [
                Node(id="N1", x=0, y=0, z=0, support=SupportType.FIXED),
                Node(id="N2", x=0, y=height, z=0, support=SupportType.NONE),
                Node(id="N3", x=cantilever_length, y=height, z=0, support=SupportType.NONE),
            ]
            
            members = [
                Member(id="M1", start_node="N1", end_node="N2", section_profile="ISMB400", member_type=MemberType.COLUMN),
                Member(id="M2", start_node="N2", end_node="N3", section_profile="ISMB350", member_type=MemberType.BEAM),
            ]
            
            # Add diagonal brace for stability
            nodes.append(Node(id="N4", x=cantilever_length * 0.3, y=height - cantilever_length * 0.3, z=0, support=SupportType.NONE))
            members.append(Member(id="M3", start_node="N2", end_node="N4", section_profile="ISA75x75x8", member_type=MemberType.DIAGONAL))
            members.append(Member(id="M4", start_node="N4", end_node="N3", section_profile="ISA75x75x8", member_type=MemberType.DIAGONAL))
        
        return StructuralModel(
            nodes=nodes,
            members=members,
            metadata={
                "name": f"{structure_type.capitalize()} ({cantilever_length}m projection)",
                "cantilever_length": str(cantilever_length),
                "height": str(height),
                "structure_type": structure_type,
                "units": "kN, m"
            }
        )

    # ============================================
    # STAIRCASE GENERATOR
    # ============================================

    @staticmethod
    def generate_staircase(
        total_rise: float,
        total_run: float,
        width: float = 1.2,
        num_steps: int = 0,
        landing_length: float = 0
    ) -> StructuralModel:
        """
        Generate a structural staircase (dog-leg or straight).
        
        Args:
            total_rise: Total vertical height
            total_run: Total horizontal run
            width: Width of staircase
            num_steps: Number of steps (auto if 0)
            landing_length: Mid-landing length (0 for straight)
        """
        nodes: List[Node] = []
        members: List[Member] = []
        
        # Auto-calculate steps if not provided
        if num_steps == 0:
            riser_height = 0.15  # Standard 150mm riser
            num_steps = int(total_rise / riser_height)
        
        riser = total_rise / num_steps
        tread = total_run / num_steps
        
        node_counter = 1
        member_counter = 1
        
        # Generate stringer nodes (two parallel stringers)
        for z in [0, width]:
            stringer_nodes = []
            
            # Bottom support
            base_id = f"N{node_counter}"
            nodes.append(Node(id=base_id, x=0, y=0, z=z, support=SupportType.PINNED))
            stringer_nodes.append(base_id)
            node_counter += 1
            
            # Step nodes along stringer
            for step in range(1, num_steps):
                x = step * tread
                y = step * riser
                step_id = f"N{node_counter}"
                nodes.append(Node(id=step_id, x=round(x, 4), y=round(y, 4), z=z, support=SupportType.NONE))
                stringer_nodes.append(step_id)
                node_counter += 1
            
            # Top support
            top_id = f"N{node_counter}"
            nodes.append(Node(id=top_id, x=total_run, y=total_rise, z=z, support=SupportType.ROLLER))
            stringer_nodes.append(top_id)
            node_counter += 1
            
            # Stringer members
            for i in range(len(stringer_nodes) - 1):
                members.append(Member(
                    id=f"M{member_counter}",
                    start_node=stringer_nodes[i],
                    end_node=stringer_nodes[i + 1],
                    section_profile="ISMC200",
                    member_type=MemberType.BEAM
                ))
                member_counter += 1
        
        # Cross beams (treads) connecting stringers
        nodes_per_stringer = num_steps + 1
        for i in range(nodes_per_stringer):
            left_node = f"N{i + 1}"
            right_node = f"N{i + 1 + nodes_per_stringer}"
            members.append(Member(
                id=f"M{member_counter}",
                start_node=left_node,
                end_node=right_node,
                section_profile="ISA75x75x8",
                member_type=MemberType.BRACE
            ))
            member_counter += 1
        
        return StructuralModel(
            nodes=nodes,
            members=members,
            metadata={
                "name": f"Staircase ({num_steps} steps, {total_rise}m rise)",
                "total_rise": str(total_rise),
                "total_run": str(total_run),
                "num_steps": str(num_steps),
                "riser": str(round(riser, 4)),
                "tread": str(round(tread, 4)),
                "units": "kN, m"
            }
        )

    # ============================================
    # K-TRUSS (For Towers)
    # ============================================

    @staticmethod
    def generate_k_truss(
        span: float,
        height: float,
        bays: int
    ) -> StructuralModel:
        """
        Generate a K-truss pattern (K-bracing at each panel).
        
        K-truss characteristics:
        - Diagonals meet at mid-height of verticals
        - Good for lateral load resistance
        """
        nodes: List[Node] = []
        members: List[Member] = []
        
        bay_width = span / bays
        mid_height = height / 2
        
        node_counter = 1
        member_counter = 1
        
        bottom_nodes = []
        mid_nodes = []
        top_nodes = []
        
        # Generate nodes at three levels
        for i in range(bays + 1):
            x = i * bay_width
            
            # Bottom node
            bot_id = f"N{node_counter}"
            support = SupportType.PINNED if i == 0 else (SupportType.ROLLER if i == bays else SupportType.NONE)
            nodes.append(Node(id=bot_id, x=round(x, 4), y=0, z=0, support=support))
            bottom_nodes.append(bot_id)
            node_counter += 1
            
            # Mid node (for K-pattern)
            mid_id = f"N{node_counter}"
            nodes.append(Node(id=mid_id, x=round(x, 4), y=mid_height, z=0, support=SupportType.NONE))
            mid_nodes.append(mid_id)
            node_counter += 1
            
            # Top node
            top_id = f"N{node_counter}"
            nodes.append(Node(id=top_id, x=round(x, 4), y=height, z=0, support=SupportType.NONE))
            top_nodes.append(top_id)
            node_counter += 1
        
        # Chords
        for i in range(bays):
            # Bottom chord
            members.append(Member(id=f"M{member_counter}", start_node=bottom_nodes[i], end_node=bottom_nodes[i + 1], section_profile="ISA100x100x10", member_type=MemberType.CHORD))
            member_counter += 1
            # Top chord
            members.append(Member(id=f"M{member_counter}", start_node=top_nodes[i], end_node=top_nodes[i + 1], section_profile="ISA100x100x10", member_type=MemberType.CHORD))
            member_counter += 1
        
        # Verticals (two segments per vertical)
        for i in range(bays + 1):
            # Bottom to mid
            members.append(Member(id=f"M{member_counter}", start_node=bottom_nodes[i], end_node=mid_nodes[i], section_profile="ISA75x75x8", member_type=MemberType.VERTICAL))
            member_counter += 1
            # Mid to top
            members.append(Member(id=f"M{member_counter}", start_node=mid_nodes[i], end_node=top_nodes[i], section_profile="ISA75x75x8", member_type=MemberType.VERTICAL))
            member_counter += 1
        
        # K-pattern diagonals
        for i in range(bays):
            # Bottom left to mid right
            members.append(Member(id=f"M{member_counter}", start_node=bottom_nodes[i], end_node=mid_nodes[i + 1], section_profile="ISA75x75x8", member_type=MemberType.DIAGONAL))
            member_counter += 1
            # Mid left to top right
            members.append(Member(id=f"M{member_counter}", start_node=mid_nodes[i], end_node=top_nodes[i + 1], section_profile="ISA75x75x8", member_type=MemberType.DIAGONAL))
            member_counter += 1
        
        return StructuralModel(
            nodes=nodes,
            members=members,
            metadata={
                "name": f"K-Truss ({span}m span, {bays} bays)",
                "span": str(span),
                "height": str(height),
                "bays": str(bays),
                "units": "kN, m"
            }
        )
