"""Penalty strategies for layout_solver_v2.

Each penalty function returns a tuple of:
    (penalty_score, constraints_satisfied_updates, diagnostics_updates)

The main solver can aggregate these strategies without holding the entire
procedural rule set in one function.
"""

from __future__ import annotations

import math
from typing import Any, Callable, Dict, List, Tuple

from ..layout_solver_v2 import (
    AcousticZone,
    GlobalConstraints,
    PenaltyWeightsV2,
    Rectangle,
    RoomPlacement,
    SiteConfig,
    analyze_circulation,
    analyze_egress,
    check_anthropometric,
    check_fenestration,
    check_span_limits,
    rectangles_adjacent,
    rectangles_overlap,
    score_solar,
    snap_to_grid,
    validate_fsi,
)

PenaltyResult = Tuple[float, Dict[str, bool], Dict[str, Any]]
PenaltyStrategy = Callable[
    [List[RoomPlacement], Rectangle, SiteConfig, GlobalConstraints, Dict[Tuple[str, str], float], PenaltyWeightsV2],
    PenaltyResult,
]


def fsi_penalty(
    placements: List[RoomPlacement],
    boundary: Rectangle,
    site: SiteConfig,
    constraints: GlobalConstraints,
    adjacency_map: Dict[Tuple[str, str], float],
    weights: PenaltyWeightsV2,
) -> PenaltyResult:
    total_room_area = sum(p.rectangle.area for p in placements)
    fsi_info = validate_fsi(total_room_area, site)
    if fsi_info["compliant"]:
        return 0.0, {"fsi_compliance": True}, {"fsi": fsi_info}
    overshoot = fsi_info["fsi_actual"] - fsi_info["fsi_limit"]
    return overshoot * weights.fsi_violation, {"fsi_compliance": False}, {"fsi": fsi_info}


def room_geometry_penalties(
    placements: List[RoomPlacement],
    boundary: Rectangle,
    site: SiteConfig,
    constraints: GlobalConstraints,
    adjacency_map: Dict[Tuple[str, str], float],
    weights: PenaltyWeightsV2,
) -> PenaltyResult:
    total = 0.0
    sat: Dict[str, bool] = {}
    diag: Dict[str, Any] = {"structural_checks": [], "solar_scores": [], "fenestration_checks": [], "anthropometric_issues": []}

    for p in placements:
        rid = p.room.id

        if p.area_deviation > 0.10:
            total += p.area_deviation * weights.area_deviation * p.room.priority
            sat[f"{rid}_area"] = False
        else:
            sat[f"{rid}_area"] = True

        if not p.width_valid:
            shortfall = p.room.min_width_m - p.rectangle.min_dim
            total += shortfall ** 2 * weights.min_width_violation * p.room.priority
            sat[f"{rid}_width"] = False
        else:
            sat[f"{rid}_width"] = True

        anthro = check_anthropometric(p)
        if anthro:
            total += weights.clearance_violation * len(anthro)
            sat[f"{rid}_clearance"] = False
            diag["anthropometric_issues"].extend(anthro)
        else:
            sat[f"{rid}_clearance"] = True

        if not p.aspect_ratio_valid:
            ar = p.rectangle.aspect_ratio
            deviation = max(0, ar - p.room.max_aspect_ratio, p.room.min_aspect_ratio - ar)
            total += deviation * weights.aspect_ratio_violation * p.room.priority
            sat[f"{rid}_aspect"] = False
        else:
            sat[f"{rid}_aspect"] = True

        if p.room.requires_exterior_wall:
            has_ext = p.rectangle.shares_edge_with(boundary)
            if not has_ext:
                total += weights.exterior_wall_violation * p.room.priority
                sat[f"{rid}_exterior"] = False
            else:
                sat[f"{rid}_exterior"] = True

        span_info = check_span_limits(p, constraints.max_unsupported_span_m, constraints.min_ceiling_height_m)
        diag["structural_checks"].append(span_info)
        if span_info["needs_intermediate_column"]:
            overshoot = p.rectangle.max_dim - constraints.max_unsupported_span_m
            total += overshoot * weights.span_violation
            sat[f"{rid}_span"] = False
        else:
            sat[f"{rid}_span"] = True
        if not span_info["headroom_ok"]:
            total += weights.beam_headroom_violation
            sat[f"{rid}_headroom"] = False
        else:
            sat[f"{rid}_headroom"] = True

        solar = score_solar(p, boundary, site.north_angle_deg, site.latitude_deg)
        diag["solar_scores"].append({"room_id": rid, **solar})
        if solar["thermal_penalty"] > 0.5:
            total += solar["thermal_penalty"] * weights.solar_thermal_penalty
            sat[f"{rid}_solar"] = False
        else:
            sat[f"{rid}_solar"] = True

        fen = check_fenestration(p, boundary, constraints.min_fenestration_ratio)
        diag["fenestration_checks"].append({"room_id": rid, **fen})
        if fen.get("applicable") and not fen.get("compliant", True):
            total += weights.fenestration_violation
            sat[f"{rid}_fenestration"] = False
        elif fen.get("applicable"):
            sat[f"{rid}_fenestration"] = True

        grid = constraints.structural_grid_module_m
        if grid > 0:
            x_err = abs(p.rectangle.x - snap_to_grid(p.rectangle.x, grid))
            w_err = abs(p.rectangle.width - snap_to_grid(p.rectangle.width, grid))
            snap_err = x_err + w_err
            if snap_err > grid * 0.1:
                total += snap_err * weights.grid_snap_deviation
                sat[f"{rid}_grid"] = False
            else:
                sat[f"{rid}_grid"] = True

    return total, sat, diag


def adjacency_penalty(
    placements: List[RoomPlacement],
    boundary: Rectangle,
    site: SiteConfig,
    constraints: GlobalConstraints,
    adjacency_map: Dict[Tuple[str, str], float],
    weights: PenaltyWeightsV2,
) -> PenaltyResult:
    total = 0.0
    sat: Dict[str, bool] = {}
    pmap = {p.room.id: p for p in placements}

    for (id1, id2), score in adjacency_map.items():
        if id1 not in pmap or id2 not in pmap:
            continue
        p1_r, p2_r = pmap[id1], pmap[id2]
        adj = rectangles_adjacent(p1_r.rectangle, p2_r.rectangle)
        if score > 0 and not adj:
            dist = p1_r.rectangle.distance_to(p2_r.rectangle)
            total += dist * score * weights.adjacency_violation
        elif score < 0 and adj:
            total += abs(score) * weights.adjacency_violation

    plumbing_rooms = [p for p in placements if p.room.plumbing_required]
    for i, pr1 in enumerate(plumbing_rooms):
        for pr2 in plumbing_rooms[i + 1 :]:
            key = f"plumbing_{pr1.room.id}_{pr2.room.id}"
            if not rectangles_adjacent(pr1.rectangle, pr2.rectangle):
                dist = pr1.rectangle.distance_to(pr2.rectangle)
                total += dist * weights.plumbing_cluster_penalty
                sat[key] = False
            else:
                sat[key] = True

    for i, p1 in enumerate(placements):
        for p2 in placements[i + 1 :]:
            if rectangles_adjacent(p1.rectangle, p2.rectangle):
                z1 = p1.room.acoustic_zone
                z2 = p2.room.acoustic_zone
                if {z1, z2} == {AcousticZone.ACTIVE, AcousticZone.PASSIVE}:
                    total += weights.acoustic_zone_violation
                    sat[f"acoustic_{p1.room.id}_{p2.room.id}"] = False

    return total, sat, {}


def spatial_penalty(
    placements: List[RoomPlacement],
    boundary: Rectangle,
    site: SiteConfig,
    constraints: GlobalConstraints,
    adjacency_map: Dict[Tuple[str, str], float],
    weights: PenaltyWeightsV2,
) -> PenaltyResult:
    total = 0.0
    sat: Dict[str, bool] = {}

    for i, p1 in enumerate(placements):
        for p2 in placements[i + 1 :]:
            if rectangles_overlap(p1.rectangle, p2.rectangle):
                total += weights.overlap_collision

    circ = analyze_circulation(placements, boundary.area, constraints.max_circulation_ratio)
    diag = {"circulation": circ}
    if not circ["corridor_budget_ok"]:
        excess = circ["corridor_ratio"] - constraints.max_circulation_ratio
        total += excess * weights.circulation_excess * 100
        sat["circulation_budget"] = False
    else:
        sat["circulation_budget"] = True
    if not circ["all_rooms_connected"]:
        total += weights.circulation_excess * len(circ["disconnected_rooms"])
        sat["room_connectivity"] = False
    else:
        sat["room_connectivity"] = True

    egress = analyze_egress(placements, boundary, constraints.max_egress_distance_m)
    diag["egress"] = egress
    if not egress["compliant"]:
        total += weights.egress_distance_violation * len(egress["violations"])
        sat["egress_compliance"] = False
    else:
        sat["egress_compliance"] = True

    return total, sat, diag


DEFAULT_PENALTY_STRATEGIES: List[PenaltyStrategy] = [
    fsi_penalty,
    room_geometry_penalties,
    adjacency_penalty,
    spatial_penalty,
]
