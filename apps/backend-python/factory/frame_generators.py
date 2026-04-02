"""
frame_generators.py - Frame and tower structure generation

Generators for:
- 3D building frames (multiple stories, multiple bays)
- Transmission towers (lattice)
- Multi-bay industrial portal frames
"""

from typing import List
from models import Node, Member, StructuralModel, SupportType, MemberType
from .constants import (
    SECTION_ISMB_400, SECTION_ISMB_350, SECTION_ISMB_300,
    SECTION_ISA_75x75x8, SECTION_ISA_50x50x6,
    COORDINATE_PRECISION
)


class FrameGenerator:
    """Generator for frame-type structures."""

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
        
        # Generate Nodes (Nested loops for X, Y, Z)
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
                        x=round(x, COORDINATE_PRECISION),
                        y=round(y, COORDINATE_PRECISION),
                        z=round(z, COORDINATE_PRECISION),
                        support=support
                    ))
                    
                    row_nodes.append(node_id)
                    node_counter += 1
                
                story_nodes.append(row_nodes)
            node_grid.append(story_nodes)
        
        # Generate Columns (Vertical members)
        for story in range(stories):
            for row_z in range(bays_z + 1):
                for col_x in range(bays_x + 1):
                    bottom_node = node_grid[story][row_z][col_x]
                    top_node = node_grid[story + 1][row_z][col_x]
                    
                    # Larger sections for lower stories
                    section = SECTION_ISMB_400 if story < stories // 2 else SECTION_ISMB_350
                    
                    members.append(Member(
                        id=f"M{member_counter}",
                        start_node=bottom_node,
                        end_node=top_node,
                        section_profile=section,
                        member_type=MemberType.COLUMN
                    ))
                    member_counter += 1
        
        # Generate Beams in X direction
        for story in range(1, stories + 1):
            for row_z in range(bays_z + 1):
                for col_x in range(bays_x):
                    left_node = node_grid[story][row_z][col_x]
                    right_node = node_grid[story][row_z][col_x + 1]
                    
                    members.append(Member(
                        id=f"M{member_counter}",
                        start_node=left_node,
                        end_node=right_node,
                        section_profile=SECTION_ISMB_300,
                        member_type=MemberType.BEAM
                    ))
                    member_counter += 1
        
        # Generate Beams in Z direction
        for story in range(1, stories + 1):
            for row_z in range(bays_z):
                for col_x in range(bays_x + 1):
                    front_node = node_grid[story][row_z][col_x]
                    back_node = node_grid[story][row_z + 1][col_x]
                    
                    members.append(Member(
                        id=f"M{member_counter}",
                        start_node=front_node,
                        end_node=back_node,
                        section_profile=SECTION_ISMB_300,
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

    @staticmethod
    def generate_tower(
        base_width: float,
        top_width: float,
        height: float,
        levels: int = 4
    ) -> StructuralModel:
        """
        Generate a tapered lattice tower (like transmission towers).
        
        Args:
            base_width: Base width in meters
            top_width: Top width in meters
            height: Total height in meters
            levels: Number of levels
        
        Returns:
            StructuralModel with tower
        """
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
                nodes.append(Node(id=node_id, x=round(x, COORDINATE_PRECISION), y=round(y, COORDINATE_PRECISION), z=round(z, COORDINATE_PRECISION), support=support))
                level_node_ids.append(node_id)
                node_counter += 1
            
            level_nodes.append(level_node_ids)
        
        # Horizontal bracing at each level
        for level in range(levels + 1):
            ln = level_nodes[level]
            for i in range(4):
                members.append(Member(id=f"M{member_counter}", start_node=ln[i], end_node=ln[(i + 1) % 4], section_profile=SECTION_ISA_50x50x6, member_type=MemberType.BRACE))
                member_counter += 1
            # Cross bracing on each face
            members.append(Member(id=f"M{member_counter}", start_node=ln[0], end_node=ln[2], section_profile=SECTION_ISA_50x50x6, member_type=MemberType.BRACE))
            member_counter += 1
            members.append(Member(id=f"M{member_counter}", start_node=ln[1], end_node=ln[3], section_profile=SECTION_ISA_50x50x6, member_type=MemberType.BRACE))
            member_counter += 1
        
        # Vertical legs and X-bracing between levels
        for level in range(levels):
            lower = level_nodes[level]
            upper = level_nodes[level + 1]
            
            for i in range(4):
                # Vertical leg
                members.append(Member(id=f"M{member_counter}", start_node=lower[i], end_node=upper[i], section_profile=SECTION_ISA_75x75x8, member_type=MemberType.COLUMN))
                member_counter += 1
                # X-bracing on face
                members.append(Member(id=f"M{member_counter}", start_node=lower[i], end_node=upper[(i + 1) % 4], section_profile=SECTION_ISA_50x50x6, member_type=MemberType.DIAGONAL))
                member_counter += 1
        
        return StructuralModel(nodes=nodes, members=members, metadata={"name": f"Lattice Tower ({height}m)", "height": str(height), "base_width": str(base_width), "top_width": str(top_width), "units": "kN, m"})

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
        
        Returns:
            StructuralModel with multi-bay portal
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
                nodes.append(Node(id=base_id, x=round(x, COORDINATE_PRECISION), y=0, z=round(z, COORDINATE_PRECISION), support=SupportType.FIXED))
                frame_nodes["base"].append(base_id)
                node_counter += 1
                
                # Eave node
                eave_id = f"N{node_counter}"
                nodes.append(Node(id=eave_id, x=round(x, COORDINATE_PRECISION), y=eave_height, z=round(z, COORDINATE_PRECISION), support=SupportType.NONE))
                frame_nodes["eave"].append(eave_id)
                node_counter += 1
            
            # Ridge nodes (at center of each bay)
            for bay in range(bays):
                x = bay * bay_width + half_bay
                ridge_id = f"N{node_counter}"
                nodes.append(Node(id=ridge_id, x=round(x, COORDINATE_PRECISION), y=eave_height + ridge_rise, z=round(z, COORDINATE_PRECISION), support=SupportType.NONE))
                frame_nodes["ridge"].append(ridge_id)
                node_counter += 1
            
            # Columns
            for i in range(bays + 1):
                members.append(Member(
                    id=f"M{member_counter}",
                    start_node=frame_nodes["base"][i],
                    end_node=frame_nodes["eave"][i],
                    section_profile=SECTION_ISMB_400,
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
                    section_profile=SECTION_ISMB_300,
                    member_type=MemberType.BEAM
                ))
                member_counter += 1
                # Right rafter
                members.append(Member(
                    id=f"M{member_counter}",
                    start_node=frame_nodes["ridge"][bay],
                    end_node=frame_nodes["eave"][bay + 1],
                    section_profile=SECTION_ISMB_300,
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
