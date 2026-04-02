from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

from layout_solver_v2_core import (
    Rectangle,
    RoomNode,
    PartitionDirection,
)
from layout_solver_v2 import (
    Rectangle,
    RoomNode,
    PartitionDirection,
)


@dataclass
class RoomPlacement:
    """A room assigned to a rectangle in the layout."""

    room: RoomNode
    rectangle: Rectangle

    @property
    def area_deviation(self) -> float:
        if self.room.target_area_sqm <= 0:
            return 0.0
        return abs(self.rectangle.area - self.room.target_area_sqm) / self.room.target_area_sqm

    @property
    def width_valid(self) -> bool:
        return self.rectangle.min_dim >= self.room.min_width_m

    @property
    def aspect_ratio_valid(self) -> bool:
        ar = self.rectangle.aspect_ratio
        return self.room.min_aspect_ratio <= ar <= self.room.max_aspect_ratio


@dataclass
class LayoutSolutionV2:
    placements: List[RoomPlacement] = field(default_factory=list)
    total_penalty: float = 0.0
    iteration: int = 0
    constraints_satisfied: Dict[str, bool] = field(default_factory=dict)
    diagnostics: Dict[str, Any] = field(default_factory=dict)

    @property
    def placement_map(self) -> Dict[str, RoomPlacement]:
        return {p.room.id: p for p in self.placements}

    def clone(self) -> "LayoutSolutionV2":
        from copy import deepcopy
        return deepcopy(self)


@dataclass
class PartitionNode:
    rectangle: Rectangle
    left: Optional["PartitionNode"] = None
    right: Optional["PartitionNode"] = None
    split_direction: Optional[PartitionDirection] = None
    split_position: Optional[float] = None
    assigned_room: Optional[RoomNode] = None

    def is_leaf(self) -> bool:
        return self.left is None and self.right is None

    def get_leaves(self) -> List["PartitionNode"]:
        if self.is_leaf():
            return [self]
        leaves: List[PartitionNode] = []
        if self.left:
            leaves.extend(self.left.get_leaves())
        if self.right:
            leaves.extend(self.right.get_leaves())
        return leaves


@dataclass
class GlobalConstraints:
    """Thresholds that apply across the entire layout."""

    max_unsupported_span_m: float
    min_ceiling_height_m: float
    structural_grid_module_m: float
    max_riser_height_m: float
    min_tread_depth_m: float
    floor_to_floor_height_m: float
    max_circulation_ratio: float
    max_egress_distance_m: float
    min_fenestration_ratio: float
    door_swing_clearance_m: float


@dataclass
class PenaltyWeightsV2:
    """Per-domain penalty weights. Higher => harder constraint."""

    area_deviation: float = 100.0
    min_width_violation: float = 500.0
    aspect_ratio_violation: float = 50.0
    adjacency_violation: float = 10.0
    exterior_wall_violation: float = 300.0
    overlap_collision: float = 1000.0
    fsi_violation: float = 2000.0
    plumbing_cluster_penalty: float = 80.0
    acoustic_zone_violation: float = 100.0
    clearance_violation: float = 400.0
    grid_snap_deviation: float = 30.0
    circulation_excess: float = 150.0
    span_violation: float = 800.0
    beam_headroom_violation: float = 600.0
    solar_thermal_penalty: float = 40.0
    fenestration_violation: float = 200.0
    egress_distance_violation: float = 1500.0


__all__ = [
    "RoomPlacement",
    "LayoutSolutionV2",
    "PartitionNode",
    "GlobalConstraints",
    "PenaltyWeightsV2",
]
