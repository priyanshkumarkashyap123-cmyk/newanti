"""
truss_generators.py - Truss and lattice structure generation

Generators for:
- Pratt truss (diagonals in tension)
- Warren truss (triangular pattern)
- Howe truss (diagonals in compression)
- Bridge trusses (deck-type)
- Space trusses (double-layer roof systems)
"""

from typing import List
from models import Node, Member, StructuralModel, SupportType, MemberType
from .constants import (
    SECTION_ISA_100x100x10, SECTION_ISA_75x75x8, SECTION_ISA_50x50x6,
    SECTION_ISMB_400, SECTION_ISMB_350, SECTION_ISMB_300,
    COORDINATE_PRECISION
)


class TrussGenerator:
    """Generator for truss-type structures."""

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
        
        # Generate Nodes
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
                x=round(x, COORDINATE_PRECISION),
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
                x=round(x, COORDINATE_PRECISION),
                y=height,
                z=0.0,
                support=SupportType.NONE
            ))
            top_nodes.append(top_id)
            node_counter += 1
        
        # Bottom Chord Members
        for i in range(bays):
            members.append(Member(
                id=f"M{member_counter}",
                start_node=bottom_nodes[i],
                end_node=bottom_nodes[i + 1],
                section_profile=SECTION_ISA_100x100x10,
                member_type=MemberType.CHORD
            ))
            member_counter += 1
        
        # Top Chord Members
        for i in range(bays):
            members.append(Member(
                id=f"M{member_counter}",
                start_node=top_nodes[i],
                end_node=top_nodes[i + 1],
                section_profile=SECTION_ISA_100x100x10,
                member_type=MemberType.CHORD
            ))
            member_counter += 1
        
        # Vertical Members
        for i in range(bays + 1):
            members.append(Member(
                id=f"M{member_counter}",
                start_node=bottom_nodes[i],
                end_node=top_nodes[i],
                section_profile=SECTION_ISA_75x75x8,
                member_type=MemberType.VERTICAL
            ))
            member_counter += 1
        
        # Diagonal Members (Pratt Pattern - slope towards center)
        mid_bay = bays // 2
        for i in range(bays):
            if i < mid_bay:
                # Left half: diagonal from bottom-left to top-right
                members.append(Member(
                    id=f"M{member_counter}",
                    start_node=bottom_nodes[i],
                    end_node=top_nodes[i + 1],
                    section_profile=SECTION_ISA_75x75x8,
                    member_type=MemberType.DIAGONAL
                ))
            else:
                # Right half: diagonal from bottom-right to top-left
                members.append(Member(
                    id=f"M{member_counter}",
                    start_node=bottom_nodes[i + 1],
                    end_node=top_nodes[i],
                    section_profile=SECTION_ISA_75x75x8,
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
            
            nodes.append(Node(id=node_id, x=round(x, COORDINATE_PRECISION), y=0, z=0, support=support))
            bottom_nodes.append(node_id)
            node_counter += 1
        
        # Generate top chord nodes (offset by half bay width)
        for i in range(bays):
            x = (i + 0.5) * bay_width
            node_id = f"N{node_counter}"
            nodes.append(Node(id=node_id, x=round(x, COORDINATE_PRECISION), y=height, z=0, support=SupportType.NONE))
            top_nodes.append(node_id)
            node_counter += 1
        
        # Bottom chord members
        for i in range(bays):
            members.append(Member(
                id=f"M{member_counter}",
                start_node=bottom_nodes[i],
                end_node=bottom_nodes[i + 1],
                section_profile=SECTION_ISA_100x100x10,
                member_type=MemberType.CHORD
            ))
            member_counter += 1
        
        # Top chord members
        for i in range(bays - 1):
            members.append(Member(
                id=f"M{member_counter}",
                start_node=top_nodes[i],
                end_node=top_nodes[i + 1],
                section_profile=SECTION_ISA_100x100x10,
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
                section_profile=SECTION_ISA_75x75x8,
                member_type=MemberType.DIAGONAL
            ))
            member_counter += 1
            
            # Falling diagonal (top to bottom right)
            members.append(Member(
                id=f"M{member_counter}",
                start_node=top_nodes[i],
                end_node=bottom_nodes[i + 1],
                section_profile=SECTION_ISA_75x75x8,
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
            nodes.append(Node(id=bottom_id, x=round(x, COORDINATE_PRECISION), y=0, z=0, support=support))
            bottom_nodes.append(bottom_id)
            node_counter += 1
            
            top_id = f"N{node_counter}"
            nodes.append(Node(id=top_id, x=round(x, COORDINATE_PRECISION), y=height, z=0, support=SupportType.NONE))
            top_nodes.append(top_id)
            node_counter += 1
        
        # Chords
        for i in range(bays):
            members.append(Member(id=f"M{member_counter}", start_node=bottom_nodes[i], end_node=bottom_nodes[i + 1], section_profile=SECTION_ISA_100x100x10, member_type=MemberType.CHORD))
            member_counter += 1
            members.append(Member(id=f"M{member_counter}", start_node=top_nodes[i], end_node=top_nodes[i + 1], section_profile=SECTION_ISA_100x100x10, member_type=MemberType.CHORD))
            member_counter += 1
        
        # Verticals
        for i in range(bays + 1):
            members.append(Member(id=f"M{member_counter}", start_node=bottom_nodes[i], end_node=top_nodes[i], section_profile=SECTION_ISA_75x75x8, member_type=MemberType.VERTICAL))
            member_counter += 1
        
        # Diagonals (opposite of Pratt - slope away from center)
        mid_bay = bays // 2
        for i in range(bays):
            if i < mid_bay:
                members.append(Member(id=f"M{member_counter}", start_node=top_nodes[i], end_node=bottom_nodes[i + 1], section_profile=SECTION_ISA_75x75x8, member_type=MemberType.DIAGONAL))
            else:
                members.append(Member(id=f"M{member_counter}", start_node=top_nodes[i + 1], end_node=bottom_nodes[i], section_profile=SECTION_ISA_75x75x8, member_type=MemberType.DIAGONAL))
            member_counter += 1
        
        return StructuralModel(nodes=nodes, members=members, metadata={"name": f"Howe Truss ({span}m)", "span": str(span), "height": str(height), "bays": str(bays), "units": "kN, m"})

    @staticmethod
    def generate_bridge(
        span: float,
        deck_width: float,
        truss_height: float,
        panels: int = 6
    ) -> StructuralModel:
        """
        Generate a deck-type truss bridge with two parallel trusses.
        
        Args:
            span: Bridge span in meters
            deck_width: Width between trusses in meters
            truss_height: Height of truss in meters
            panels: Number of panels per truss
        
        Returns:
            StructuralModel with bridge structure
        """
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
                nodes.append(Node(id=bot_id, x=round(x, COORDINATE_PRECISION), y=0, z=round(z_pos, COORDINATE_PRECISION), support=support))
                bottom_nodes.append(bot_id)
                node_counter += 1
                
                # Top node
                top_id = f"N{node_counter}"
                nodes.append(Node(id=top_id, x=round(x, COORDINATE_PRECISION), y=truss_height, z=round(z_pos, COORDINATE_PRECISION), support=SupportType.NONE))
                top_nodes.append(top_id)
                node_counter += 1
            
            # Bottom chord
            for i in range(panels):
                members.append(Member(id=f"M{member_counter}", start_node=bottom_nodes[i], end_node=bottom_nodes[i + 1], section_profile=SECTION_ISMB_400, member_type=MemberType.CHORD))
                member_counter += 1
            
            # Top chord
            for i in range(panels):
                members.append(Member(id=f"M{member_counter}", start_node=top_nodes[i], end_node=top_nodes[i + 1], section_profile=SECTION_ISMB_400, member_type=MemberType.CHORD))
                member_counter += 1
            
            # Verticals
            for i in range(panels + 1):
                members.append(Member(id=f"M{member_counter}", start_node=bottom_nodes[i], end_node=top_nodes[i], section_profile=SECTION_ISMB_300, member_type=MemberType.VERTICAL))
                member_counter += 1
            
            # Diagonals (Pratt pattern)
            mid_panel = panels // 2
            for i in range(panels):
                if i < mid_panel:
                    members.append(Member(id=f"M{member_counter}", start_node=bottom_nodes[i], end_node=top_nodes[i + 1], section_profile=SECTION_ISMB_300, member_type=MemberType.DIAGONAL))
                else:
                    members.append(Member(id=f"M{member_counter}", start_node=bottom_nodes[i + 1], end_node=top_nodes[i], section_profile=SECTION_ISMB_300, member_type=MemberType.DIAGONAL))
                member_counter += 1
        
        # Cross bracing between trusses (floor beams at bottom chord)
        for i in range(panels + 1):
            bot_left = f"N{1 + i * 2}"
            bot_right = f"N{1 + i * 2 + (panels + 1) * 2}"
            members.append(Member(id=f"M{member_counter}", start_node=bot_left, end_node=bot_right, section_profile=SECTION_ISMB_350, member_type=MemberType.BEAM))
            member_counter += 1
        
        return StructuralModel(nodes=nodes, members=members, metadata={"name": f"Bridge ({span}m span)", "span": str(span), "deck_width": str(deck_width), "truss_height": str(truss_height), "panels": str(panels), "units": "kN, m"})

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
        
        Returns:
            StructuralModel with space truss
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
                
                nodes.append(Node(id=node_id, x=round(x, COORDINATE_PRECISION), y=depth, z=round(z, COORDINATE_PRECISION), support=support))
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
                nodes.append(Node(id=node_id, x=round(x, COORDINATE_PRECISION), y=0, z=round(z, COORDINATE_PRECISION), support=SupportType.NONE))
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
                    section_profile=SECTION_ISA_75x75x8,
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
                    section_profile=SECTION_ISA_75x75x8,
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
                    section_profile=SECTION_ISA_50x50x6,
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
                    section_profile=SECTION_ISA_50x50x6,
                    member_type=MemberType.CHORD
                ))
                member_counter += 1
        
        # Vertical struts (connecting top to bottom)
        for j in range(bays_z):
            for i in range(bays_x):
                members.append(Member(
                    id=f"M{member_counter}",
                    start_node=bottom_nodes[j][i],
                    end_node=top_nodes[j + 1][i + 1],
                    section_profile=SECTION_ISA_75x75x8,
                    member_type=MemberType.VERTICAL
                ))
                member_counter += 1
        
        return StructuralModel(
            nodes=nodes,
            members=members,
            metadata={
                "name": f"Space Truss ({width}m x {length}m x {depth}m)",
                "width": str(width),
                "length": str(length),
                "depth": str(depth),
                "bays_x": str(bays_x),
                "bays_z": str(bays_z),
                "units": "kN, m"
            }
        )
