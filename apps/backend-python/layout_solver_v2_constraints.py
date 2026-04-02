from __future__ import annotations

import heapq
import math
from typing import Any, Dict, List, Set, Tuple

from rules.compliance_schemas import (
    DOOR_SWING_ARC_M,
    MIN_CLEARANCES,
)
from layout_solver_v2 import (
    AcousticZone,
    Rectangle,
    RoomType,
    rectangles_adjacent,
    rectangles_overlap,
    snap_to_grid,
    validate_fsi,
)
from rules.layout_solver_defaults import (
    DEFAULT_BASE_OVERHANG_DEPTH_M,
    DEFAULT_BEAM_DEPTH_DIVISOR,
    DEFAULT_DOOR_SWING_CLEARANCE_M,
    DEFAULT_FENESTRATION_CEILING_HEIGHT_M,
    DEFAULT_FLOOR_TO_FLOOR_HEIGHT_M,
    DEFAULT_MAX_CIRCULATION_RATIO,
    DEFAULT_MAX_EGRESS_DISTANCE_M,
    DEFAULT_MAX_RISER_HEIGHT_M,
    DEFAULT_MAX_UNSUPPORTED_SPAN_M,
    DEFAULT_MIN_CEILING_HEIGHT_M,
    DEFAULT_MIN_CLEARANCE_FALLBACK_M,
    DEFAULT_MIN_FENESTRATION_RATIO,
    DEFAULT_MIN_HEADROOM_UNDER_BEAM_M,
    DEFAULT_MIN_TREAD_DEPTH_M,
    DEFAULT_NBC_OPENABLE_RATIO,
    DEFAULT_OVERHANG_DEPTH_FACTOR_M,
    DEFAULT_PLUMBING_ADJ_WEIGHT,
    DEFAULT_SHADING_REDUCTION_FACTOR,
    DEFAULT_SOLAR_HIGH_PENALTY_THRESHOLD,
    DEFAULT_SOLAR_LATITUDE_DIVISOR,
    DEFAULT_SOLAR_LATITUDE_MIN_FACTOR,
    DEFAULT_SOLAR_LATITUDE_REFERENCE_DEG,
    DEFAULT_STAIR_FLIGHT_GAP_M,
    DEFAULT_STAIR_WIDTH_M,
    DEFAULT_WWR_MAX,
    DEFAULT_WINDOW_AREA_PER_SQM_DIVISOR,
)


def check_anthropometric(placement: Any) -> List[str]:
    """Return list of human-factor violations."""
    violations: List[str] = []
    rect = placement.rectangle
    room = placement.room
    min_req = max(MIN_CLEARANCES.get(room.type, DEFAULT_MIN_CLEARANCE_FALLBACK_M), room.min_width_m)
    if rect.min_dim < min_req:
        violations.append(
            f"{room.id}: min dimension {rect.min_dim:.2f}m < "
            f"{min_req:.2f}m required clearance"
        )
    door_area = room.num_doors * DOOR_SWING_ARC_M ** 2
    if rect.area < door_area + room.target_area_sqm * 0.3:
        violations.append(
            f"{room.id}: insufficient area for {room.num_doors} "
            f"door swing(s) ({door_area:.2f} m² needed)"
        )
    return violations


def check_span_limits(
    placement: Any,
    max_span: float,
    min_ceiling_height: float,
) -> Dict[str, Any]:
    """Flag rooms whose clear span exceeds the slab limit."""
    rect = placement.rectangle
    needs_column = rect.max_dim > max_span
    beam_depth = rect.max_dim / DEFAULT_BEAM_DEPTH_DIVISOR
    clear_height = min_ceiling_height - beam_depth
    return {
        "room_id": placement.room.id,
        "max_dimension_m": round(rect.max_dim, 3),
        "max_span_limit_m": max_span,
        "needs_intermediate_column": needs_column,
        "beam_depth_estimate_m": round(beam_depth, 3),
        "clear_height_under_beam_m": round(clear_height, 3),
        "headroom_ok": clear_height >= DEFAULT_MIN_HEADROOM_UNDER_BEAM_M,
    }


def calculate_staircase_footprint(
    floor_to_floor_height: float = DEFAULT_FLOOR_TO_FLOOR_HEIGHT_M,
    max_riser_height: float = DEFAULT_MAX_RISER_HEIGHT_M,
    min_tread_depth: float = DEFAULT_MIN_TREAD_DEPTH_M,
    stair_width: float = DEFAULT_STAIR_WIDTH_M,
    num_flights: int = 2,
) -> Tuple[float, float, Dict[str, Any]]:
    """Calculate exact rectangular footprint for a code-compliant staircase."""
    num_risers = math.ceil(floor_to_floor_height / max_riser_height)
    actual_riser = floor_to_floor_height / num_risers
    total_run = (num_risers - 1) * min_tread_depth

    if num_flights >= 2:
        risers_per_flight = num_risers // num_flights
        run_per_flight = (risers_per_flight - 1) * min_tread_depth
        landing_depth = stair_width
        fp_width = num_flights * stair_width + DEFAULT_STAIR_FLIGHT_GAP_M * (num_flights - 1)
        fp_length = run_per_flight + landing_depth
    else:
        fp_width = stair_width
        fp_length = total_run

    meta = {
        "num_risers": num_risers,
        "actual_riser_height_m": round(actual_riser, 4),
        "actual_tread_depth_m": min_tread_depth,
        "total_run_m": round(total_run, 3),
        "num_flights": num_flights,
        "footprint_width_m": round(fp_width, 3),
        "footprint_length_m": round(fp_length, 3),
        "footprint_area_sqm": round(fp_width * fp_length, 3),
    }
    return fp_width, fp_length, meta


def wall_bearing(facade: str, north_angle_deg: float) -> float:
    local_bearings = {"top": 0.0, "right": 90.0, "bottom": 180.0, "left": 270.0}
    local = local_bearings.get(facade, 0.0)
    return (local + north_angle_deg) % 360.0


def thermal_load_factor(bearing: float) -> float:
    def _proximity(target: float) -> float:
        diff = abs(bearing - target)
        return max(0.0, 1.0 - min(diff, 360.0 - diff) / 90.0)

    return max(
        _proximity(270.0) * 1.0,
        _proximity(225.0) * 0.8,
        _proximity(180.0) * 0.5,
    )


def score_solar(
    placement: Any,
    boundary: Rectangle,
    north_angle_deg: float,
    latitude_deg: float = 20.0,
) -> Dict[str, Any]:
    facades = placement.rectangle.exterior_facades(boundary)
    if not facades:
        return {
            "thermal_penalty": 0.0,
            "facades": [],
            "bearings": {},
            "thermal_loads": {},
            "shading_spec": None,
        }

    bearings = {f: wall_bearing(f, north_angle_deg) for f in facades}
    lat_factor = max(
        DEFAULT_SOLAR_LATITUDE_MIN_FACTOR,
        1.0 - abs(latitude_deg - DEFAULT_SOLAR_LATITUDE_REFERENCE_DEG) / DEFAULT_SOLAR_LATITUDE_DIVISOR,
    )
    loads = {f: thermal_load_factor(b) * lat_factor for f, b in bearings.items()}
    max_load = max(loads.values()) if loads else 0.0

    is_high_occ = placement.room.type == RoomType.HABITABLE
    penalty = max_load * (1.0 if is_high_occ else 0.3)

    shading_spec = None
    if is_high_occ and penalty > DEFAULT_SOLAR_HIGH_PENALTY_THRESHOLD:
        worst_facade = max(loads, key=loads.get)
        worst_bearing = bearings[worst_facade]
        depth = DEFAULT_BASE_OVERHANG_DEPTH_M + DEFAULT_OVERHANG_DEPTH_FACTOR_M * thermal_load_factor(worst_bearing)
        facade_length = (
            placement.rectangle.height
            if worst_facade in ("left", "right")
            else placement.rectangle.width
        )
        shading_spec = {
            "facade": worst_facade,
            "bearing_deg": round(worst_bearing, 1),
            "overhang_depth_m": round(depth, 2),
            "overhang_length_m": round(facade_length, 2),
            "type": "chajja",
            "reduces_penalty_by": round(penalty * DEFAULT_SHADING_REDUCTION_FACTOR, 3),
        }

    return {
        "thermal_penalty": round(penalty, 4),
        "facades": facades,
        "bearings": {f: round(b, 1) for f, b in bearings.items()},
        "thermal_loads": {f: round(v, 3) for f, v in loads.items()},
        "shading_spec": shading_spec,
    }


def check_fenestration(
    placement: Any,
    boundary: Rectangle,
    min_ratio: float = DEFAULT_MIN_FENESTRATION_RATIO,
) -> Dict[str, Any]:
    facades = placement.rectangle.exterior_facades(boundary)
    applicable = bool(facades) and placement.room.type in (
        RoomType.HABITABLE,
        RoomType.UTILITY,
    )
    if not applicable:
        return {"applicable": False, "compliant": True, "wwr": None}

    rect = placement.rectangle
    ceiling_h = DEFAULT_FENESTRATION_CEILING_HEIGHT_M
    total_wall_area = 0.0
    for f in facades:
        wall_len = rect.height if f in ("left", "right") else rect.width
        total_wall_area += wall_len * ceiling_h

    num_windows = max(1, round(rect.area / DEFAULT_WINDOW_AREA_PER_SQM_DIVISOR))
    window_w, window_h = 1.2, 1.5
    total_window_area = num_windows * window_w * window_h
    total_window_area = min(total_window_area, total_wall_area * DEFAULT_WWR_MAX)

    wwr = total_window_area / total_wall_area if total_wall_area > 0 else 0.0
    floor_ratio = total_window_area / rect.area if rect.area > 0 else 0.0

    compliant = wwr >= min_ratio and wwr <= DEFAULT_WWR_MAX
    nbc_compliant = floor_ratio >= DEFAULT_NBC_OPENABLE_RATIO

    return {
        "applicable": True,
        "floor_area_sqm": round(rect.area, 2),
        "total_wall_area_sqm": round(total_wall_area, 2),
        "total_window_area_sqm": round(total_window_area, 2),
        "num_windows": num_windows,
        "wwr": round(wwr, 4),
        "wwr_min": min_ratio,
        "wwr_max": DEFAULT_WWR_MAX,
        "compliant": compliant,
        "nbc_floor_ratio": round(floor_ratio, 4),
        "nbc_floor_ratio_compliant": nbc_compliant,
        "available_wall_length_m": round(
            sum(
                rect.height if f in ("left", "right") else rect.width
                for f in facades
            ),
            2,
        ),
    }


def _build_room_graph(placements: List[Any]) -> Dict[str, Set[str]]:
    graph: Dict[str, Set[str]] = {p.room.id: set() for p in placements}
    for i, p1 in enumerate(placements):
        for p2 in placements[i + 1 :]:
            if rectangles_adjacent(p1.rectangle, p2.rectangle):
                graph[p1.room.id].add(p2.room.id)
                graph[p2.room.id].add(p1.room.id)
    return graph


def analyze_circulation(
    placements: List[Any],
    usable_area: float,
    max_ratio: float = DEFAULT_MAX_CIRCULATION_RATIO,
) -> Dict[str, Any]:
    total_room_area = sum(p.rectangle.area for p in placements)
    corridor_area = max(0.0, usable_area - total_room_area)
    corridor_ratio = corridor_area / usable_area if usable_area > 0 else 0.0

    graph = _build_room_graph(placements)
    visited: Set[str] = set()
    if placements:
        queue = [placements[0].room.id]
        visited.add(queue[0])
        while queue:
            cur = queue.pop(0)
            for nbr in graph.get(cur, set()):
                if nbr not in visited:
                    visited.add(nbr)
                    queue.append(nbr)

    all_ids = {p.room.id for p in placements}
    disconnected = all_ids - visited

    return {
        "usable_area_sqm": round(usable_area, 2),
        "total_room_area_sqm": round(total_room_area, 2),
        "corridor_area_sqm": round(corridor_area, 2),
        "corridor_ratio": round(corridor_ratio, 4),
        "corridor_budget_ok": corridor_ratio <= max_ratio,
        "all_rooms_connected": len(disconnected) == 0,
        "disconnected_rooms": sorted(disconnected),
    }


def analyze_egress(
    placements: List[Any],
    boundary: Rectangle,
    max_travel_m: float = DEFAULT_MAX_EGRESS_DISTANCE_M,
) -> Dict[str, Any]:
    if not placements:
        return {"compliant": True, "max_travel_distance_m": 0.0, "violations": []}

    graph = _build_room_graph(placements)
    pmap = {p.room.id: p for p in placements}

    exit_rooms = {
        p.room.id
        for p in placements
        if p.rectangle.exterior_facades(boundary)
    }
    if not exit_rooms:
        return {
            "compliant": False,
            "max_travel_distance_m": float("inf"),
            "violations": ["No rooms have exterior wall access — no viable exits"],
        }

    dist: Dict[str, float] = {rid: float("inf") for rid in pmap}
    heap: List[Tuple[float, str]] = []
    for eid in exit_rooms:
        dist[eid] = 0.0
        heapq.heappush(heap, (0.0, eid))

    while heap:
        d, u = heapq.heappop(heap)
        if d > dist[u]:
            continue
        for v in graph.get(u, set()):
            cu = pmap[u].rectangle.center
            cv = pmap[v].rectangle.center
            edge_cost = math.hypot(cu[0] - cv[0], cu[1] - cv[1])
            new_d = d + edge_cost
            if new_d < dist[v]:
                dist[v] = new_d
                heapq.heappush(heap, (new_d, v))

    violations: List[str] = []
    max_dist = 0.0
    for rid, d in dist.items():
        if d > max_travel_m:
            violations.append(
                f"{rid}: travel distance {d:.2f}m exceeds {max_travel_m}m limit"
            )
        max_dist = max(max_dist, d if d != float("inf") else 0.0)

    return {
        "compliant": len(violations) == 0,
        "max_travel_distance_m": round(max_dist, 2),
        "room_distances_m": {r: round(d, 2) for r, d in dist.items()},
        "violations": violations,
    }


def calculate_penalty_v2(
    placements: List[Any],
    boundary: Rectangle,
    site: Any,
    constraints: Any,
    adjacency_map: Dict[Tuple[str, str], float],
    weights: Any,
) -> Tuple[float, Dict[str, bool], Dict[str, Any]]:
    total = 0.0
    sat: Dict[str, bool] = {}
    diag: Dict[str, Any] = {}

    total_room_area = sum(p.rectangle.area for p in placements)
    fsi_info = validate_fsi(total_room_area, site)
    diag["fsi"] = fsi_info
    if not fsi_info["compliant"]:
        overshoot = fsi_info["fsi_actual"] - fsi_info["fsi_limit"]
        total += overshoot * weights.fsi_violation
        sat["fsi_compliance"] = False
    else:
        sat["fsi_compliance"] = True

    structural_checks: List[Dict[str, Any]] = []
    solar_scores: List[Dict[str, Any]] = []
    fenestration_checks: List[Dict[str, Any]] = []
    anthropometric_issues: List[str] = []

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
            anthropometric_issues.extend(anthro)
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

        span_info = check_span_limits(
            p, constraints.max_unsupported_span_m, constraints.min_ceiling_height_m
        )
        structural_checks.append(span_info)
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
        solar_scores.append({"room_id": rid, **solar})
        if solar["thermal_penalty"] > 0.5:
            total += solar["thermal_penalty"] * weights.solar_thermal_penalty
            sat[f"{rid}_solar"] = False
        else:
            sat[f"{rid}_solar"] = True

        fen = check_fenestration(p, boundary, constraints.min_fenestration_ratio)
        fenestration_checks.append({"room_id": rid, **fen})
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

    for i, p1 in enumerate(placements):
        for p2 in placements[i + 1 :]:
            if rectangles_overlap(p1.rectangle, p2.rectangle):
                total += weights.overlap_collision

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

    circ = analyze_circulation(
        placements,
        boundary.area,
        constraints.max_circulation_ratio,
    )
    diag["circulation"] = circ
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

    egress = analyze_egress(
        placements,
        boundary,
        constraints.max_egress_distance_m,
    )
    diag["egress"] = egress
    if not egress["compliant"]:
        total += weights.egress_distance_violation * len(egress["violations"])
        sat["egress_compliance"] = False
    else:
        sat["egress_compliance"] = True

    diag["structural_checks"] = structural_checks
    diag["solar_scores"] = solar_scores
    diag["fenestration_checks"] = fenestration_checks
    diag["anthropometric_issues"] = anthropometric_issues

    return total, sat, diag
