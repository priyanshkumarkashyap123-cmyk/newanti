from __future__ import annotations
from typing import List, Tuple

from layout_solver_v2 import Rectangle, RoomNode, PartitionDirection, snap_to_grid
from .types import PartitionNode, RoomPlacement


def partition_space_gridaware(
    rect: Rectangle,
    direction: PartitionDirection,
    ratio: float,
    grid: float = 0.0,
) -> Tuple[Rectangle, Rectangle]:
    """Partition a rectangle with optional grid-snapped cut position."""

    if direction == PartitionDirection.VERTICAL:
        raw = rect.x + rect.width * ratio
        cut = snap_to_grid(raw, grid) if grid > 0 else raw
        margin = max(grid, 0.5) if grid > 0 else 0.5
        cut = max(rect.x + margin, min(cut, rect.x + rect.width - margin))
        left = Rectangle(rect.x, rect.y, cut - rect.x, rect.height)
        right = Rectangle(cut, rect.y, rect.x + rect.width - cut, rect.height)
        return left, right

    raw = rect.y + rect.height * ratio
    cut = snap_to_grid(raw, grid) if grid > 0 else raw
    margin = max(grid, 0.5) if grid > 0 else 0.5
    cut = max(rect.y + margin, min(cut, rect.y + rect.height - margin))
    top = Rectangle(rect.x, rect.y, rect.width, cut - rect.y)
    bottom = Rectangle(rect.x, cut, rect.width, rect.y + rect.height - cut)
    return top, bottom


def build_partition_tree_v2(
    rect: Rectangle,
    rooms: List[RoomNode],
    grid: float = 0.0,
    max_depth: int = 10,
    depth: int = 0,
) -> PartitionNode:
    """Recursive BSP with grid snapping and priority-aware room ordering."""

    node = PartitionNode(rectangle=rect)
    if len(rooms) <= 1 or depth >= max_depth:
        if rooms:
            node.assigned_room = rooms[0]
        return node

    direction = (
        PartitionDirection.VERTICAL if rect.width >= rect.height else PartitionDirection.HORIZONTAL
    )

    sorted_rooms = sorted(rooms, key=lambda r: (-r.priority, -r.target_area_sqm))
    total_area = sum(r.target_area_sqm for r in sorted_rooms)

    cumulative = 0.0
    split_idx = 0
    target_half = total_area / 2
    for i, room in enumerate(sorted_rooms):
        cumulative += room.target_area_sqm
        split_idx = i + 1
        if cumulative >= target_half:
            break
    split_idx = max(1, min(split_idx, len(sorted_rooms) - 1))

    left_area = sum(r.target_area_sqm for r in sorted_rooms[:split_idx])
    ratio = (left_area / total_area) if total_area > 0 else 0.5
    ratio = max(0.2, min(0.8, ratio))

    left_rect, right_rect = partition_space_gridaware(rect, direction, ratio, grid)
    node.left = build_partition_tree_v2(left_rect, sorted_rooms[:split_idx], grid, max_depth, depth + 1)
    node.right = build_partition_tree_v2(right_rect, sorted_rooms[split_idx:], grid, max_depth, depth + 1)
    node.split_direction = direction
    node.split_position = ratio
    return node


def extract_placements(node: PartitionNode) -> List[RoomPlacement]:
    out: List[RoomPlacement] = []
    for leaf in node.get_leaves():
        if leaf.assigned_room:
            out.append(RoomPlacement(room=leaf.assigned_room, rectangle=leaf.rectangle))
    return out


__all__ = [
    "partition_space_gridaware",
    "build_partition_tree_v2",
    "extract_placements",
]
