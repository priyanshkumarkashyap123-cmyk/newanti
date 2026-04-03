from __future__ import annotations
from typing import Any, Dict, List, Set, Tuple

from layout_solver_v2_core import Rectangle, RoomNode, infer_acoustic_zone
from .types import GlobalConstraints, RoomPlacement, PenaltyWeightsV2
from .constraints_anthro import (
    check_anthropometric as _check_anthropometric_impl,
    check_fenestration as _check_fenestration_impl,
)
from .constraints_structure import (
    check_span_limits as _check_span_limits_impl,
)
from layout_solver_v2_constraints import calculate_staircase_footprint as _calculate_staircase_footprint_impl
from .constraints_env import (
    wall_bearing as _wall_bearing_impl,
    thermal_load_factor as _thermal_load_factor_impl,
    score_solar as _score_solar_impl,
)
from .constraints_pathfinding import (
    build_room_graph as _build_room_graph_impl,
    analyze_circulation as _analyze_circulation_impl,
    analyze_egress as _analyze_egress_impl,
)
from .penalty_aggregator import calculate_penalty_v2 as _calculate_penalty_v2_impl


# Domain 4 — Anthropometric limits

def check_anthropometric(placement: RoomPlacement) -> List[str]:
    return _check_anthropometric_impl(placement)


# Domain 7 — Structural mechanics & span limits

def check_span_limits(
    placement: RoomPlacement,
    max_span: float,
    min_ceiling_height: float,
) -> Dict[str, Any]:
    return _check_span_limits_impl(placement, max_span, min_ceiling_height)


def check_fenestration(
    placement: RoomPlacement,
    boundary: Rectangle,
    min_ratio: float,
) -> Dict[str, Any]:
    return _check_fenestration_impl(placement, boundary, min_ratio)


# Domain 8 — Vertical circulation / staircase

def calculate_staircase_footprint(
    floor_to_floor_height: float,
    max_riser_height: float,
    min_tread_depth: float = 0.25,
    stair_width: float = 1.0,
    num_flights: int = 2,
) -> Tuple[float, float, Dict[str, Any]]:
    return _calculate_staircase_footprint_impl(
        floor_to_floor_height=floor_to_floor_height,
        max_riser_height=max_riser_height,
        min_tread_depth=min_tread_depth,
        stair_width=stair_width,
        num_flights=num_flights,
    )


# Domain 9 — Environmental physics & orientation

def wall_bearing(facade: str, north_angle_deg: float) -> float:
    return _wall_bearing_impl(facade, north_angle_deg)


def thermal_load_factor(bearing: float) -> float:
    return _thermal_load_factor_impl(bearing)


def score_solar(
    placement: RoomPlacement,
    boundary: Rectangle,
    north_angle_deg: float,
    latitude_deg: float,
) -> Dict[str, Any]:
    return _score_solar_impl(placement, boundary, north_angle_deg, latitude_deg)


# Domain 6 & 10 — Pathfinding (circulation & egress)

def build_room_graph(placements: List[RoomPlacement]) -> Dict[str, Set[str]]:
    return _build_room_graph_impl(placements)


def analyze_circulation(
    placements: List[RoomPlacement],
    usable_area: float,
    max_ratio: float,
) -> Dict[str, Any]:
    return _analyze_circulation_impl(placements, usable_area, max_ratio)


def analyze_egress(
    placements: List[RoomPlacement],
    boundary: Rectangle,
    max_travel_m: float,
) -> Dict[str, Any]:
    return _analyze_egress_impl(placements, boundary, max_travel_m)


# Penalty aggregation

def calculate_penalty_v2(
    placements: List[RoomPlacement],
    boundary: Rectangle,
    site: RoomNode,
    constraints: GlobalConstraints,
    adjacency_map: Dict[Tuple[str, str], float],
    weights: PenaltyWeightsV2,
) -> Tuple[float, Dict[str, bool], Dict[str, Any]]:
    return _calculate_penalty_v2_impl(
        placements,
        boundary,
        site,
        constraints,
        adjacency_map,
        weights,
    )


__all__ = [
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
]
