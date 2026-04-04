"""
Public façade for layout_solver_v2.

Re-exports core types, solver entry points, and key utilities.
Prefer importing from this package path instead of sibling modules.
"""

from layout_solver_v2_core import (
    AcousticZone,
    RoomType,
    AdjacencyEdge,
    PartitionDirection,
    Rectangle,
    RoomNode,
    Setbacks,
    SiteConfig,
    rectangles_adjacent,
    rectangles_overlap,
    snap_to_grid,
    validate_fsi,
)

from .types import RoomPlacement, LayoutSolutionV2, GlobalConstraints, PenaltyWeightsV2, PartitionNode
from .bsp import partition_space_gridaware, build_partition_tree_v2, extract_placements
from .constraints import (
    check_anthropometric,
    check_fenestration,
    check_span_limits,
    calculate_staircase_footprint,
    wall_bearing,
    thermal_load_factor,
    score_solar,
    build_room_graph,
    analyze_circulation,
    analyze_egress,
    calculate_penalty_v2,
    infer_acoustic_zone,
)
from .solver import LayoutSolverV2, SimulatedAnnealingSolver
from .reporting import build_full_report, build_compliance_items
from .helpers import (
    generate_structural_grid,
    generate_structural_handoff,
    generate_mep_schedule,
    insert_acoustic_buffers,
)

__all__ = [
    # Core types
    "AcousticZone",
    "RoomType",
    "AdjacencyEdge",
    "PartitionDirection",
    "Rectangle",
    "RoomNode",
    "Setbacks",
    "SiteConfig",
    "rectangles_adjacent",
    "rectangles_overlap",
    "snap_to_grid",
    "validate_fsi",
    # Solutions / constraints
    "RoomPlacement",
    "LayoutSolutionV2",
    "GlobalConstraints",
    "PenaltyWeightsV2",
    "PartitionNode",
    # BSP / generation
    "partition_space_gridaware",
    "build_partition_tree_v2",
    "extract_placements",
    # Constraints / penalties
    "check_anthropometric",
    "check_fenestration",
    "check_span_limits",
    "calculate_staircase_footprint",
    "wall_bearing",
    "thermal_load_factor",
    "score_solar",
    "build_room_graph",
    "analyze_circulation",
    "analyze_egress",
    "calculate_penalty_v2",
    "infer_acoustic_zone",
    # Solver façade
    "LayoutSolverV2",
    "SimulatedAnnealingSolver",
    # Reporting / helpers
    "build_full_report",
    "build_compliance_items",
    "generate_structural_grid",
    "generate_structural_handoff",
    "generate_mep_schedule",
    "insert_acoustic_buffers",
]
