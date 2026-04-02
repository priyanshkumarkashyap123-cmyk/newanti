from __future__ import annotations

import math
from typing import Any, Dict, List, Set, Tuple

from layout_solver_v2 import AcousticZone, Rectangle, RoomNode, RoomType, rectangles_adjacent, snap_to_grid
from rules.compliance_schemas import DEFAULT_HVAC_TR_PER_SQM, ELECTRICAL_POINT_ESTIMATES
from rules.layout_solver_defaults import (
    DEFAULT_ACOUSTIC_ADJACENCY_TOL_M,
    DEFAULT_BUFFER_MIN_AREA_SQM,
    DEFAULT_BUFFER_OVERLAP_MIN_M,
    DEFAULT_BUFFER_ROOM_MAX_ASPECT_RATIO,
    DEFAULT_BUFFER_ROOM_MIN_WIDTH_M,
    DEFAULT_CANTILEVER_MIN_OVERHANG_M,
    DEFAULT_HVAC_SPLIT_THRESHOLD_TR,
    DEFAULT_LIGHTING_AREA_DIVISOR,
    DEFAULT_MEP_STACK_PROXIMITY_M,
    DEFAULT_SLAB_ONE_WAY_RATIO,
    DEFAULT_STRUCTURAL_GRID_DEDUP_FACTOR,
    DEFAULT_STRUCTURAL_OUTPUT_GRID_MODULE_M,
    DEFAULT_STRUCTURAL_OUTPUT_MAX_SPAN_M,
    DEFAULT_STRUCTURAL_TRIVIAL_SPAN_M,
    DEFAULT_WALL_SHARED_MIN_OVERLAP_M,
    DEFAULT_WALL_SHARED_TOL_M,
)


def insert_acoustic_buffers(
    placements: List[Any],
    buffer_width_m: float,
    min_buffer_width_m: float,
) -> Tuple[List[Any], List[Dict[str, Any]]]:
    buffers_inserted: List[Dict[str, Any]] = []
    new_placements = list(placements)
    buffer_id = 0

    pairs_to_buffer: List[Tuple[int, int]] = []
    for i, p1 in enumerate(new_placements):
        for j in range(i + 1, len(new_placements)):
            p2 = new_placements[j]
            if not rectangles_adjacent(p1.rectangle, p2.rectangle, tol=DEFAULT_ACOUSTIC_ADJACENCY_TOL_M):
                continue
            z1 = p1.room.acoustic_zone
            z2 = p2.room.acoustic_zone
            if {z1, z2} == {AcousticZone.ACTIVE, AcousticZone.PASSIVE}:
                pairs_to_buffer.append((i, j))

    for idx_a, idx_b in pairs_to_buffer:
        p_active = new_placements[idx_a]
        p_passive = new_placements[idx_b]
        ra, rb = p_active.rectangle, p_passive.rectangle
        a_bounds = ra.bounds
        b_bounds = rb.bounds

        buf_width = max(min_buffer_width_m, min(buffer_width_m, ra.min_dim * 0.2, rb.min_dim * 0.2))
        half = buf_width / 2.0

        buf_rect = None
        if abs(a_bounds[2] - b_bounds[0]) < DEFAULT_ACOUSTIC_ADJACENCY_TOL_M:
            edge_x = a_bounds[2]
            overlap_y0 = max(a_bounds[1], b_bounds[1])
            overlap_y1 = min(a_bounds[3], b_bounds[3])
            if overlap_y1 - overlap_y0 > DEFAULT_BUFFER_OVERLAP_MIN_M:
                buf_rect = Rectangle(edge_x - half, overlap_y0, buf_width, overlap_y1 - overlap_y0)
                ra.width -= half
                rb.x += half
                rb.width -= half
        elif abs(b_bounds[2] - a_bounds[0]) < DEFAULT_ACOUSTIC_ADJACENCY_TOL_M:
            edge_x = b_bounds[2]
            overlap_y0 = max(a_bounds[1], b_bounds[1])
            overlap_y1 = min(a_bounds[3], b_bounds[3])
            if overlap_y1 - overlap_y0 > DEFAULT_BUFFER_OVERLAP_MIN_M:
                buf_rect = Rectangle(edge_x - half, overlap_y0, buf_width, overlap_y1 - overlap_y0)
                rb.width -= half
                ra.x += half
                ra.width -= half
        elif abs(a_bounds[3] - b_bounds[1]) < DEFAULT_ACOUSTIC_ADJACENCY_TOL_M:
            edge_y = a_bounds[3]
            overlap_x0 = max(a_bounds[0], b_bounds[0])
            overlap_x1 = min(a_bounds[2], b_bounds[2])
            if overlap_x1 - overlap_x0 > DEFAULT_BUFFER_OVERLAP_MIN_M:
                buf_rect = Rectangle(overlap_x0, edge_y - half, overlap_x1 - overlap_x0, buf_width)
                ra.height -= half
                rb.y += half
                rb.height -= half
        elif abs(b_bounds[3] - a_bounds[1]) < DEFAULT_ACOUSTIC_ADJACENCY_TOL_M:
            edge_y = b_bounds[3]
            overlap_x0 = max(a_bounds[0], b_bounds[0])
            overlap_x1 = min(a_bounds[2], b_bounds[2])
            if overlap_x1 - overlap_x0 > DEFAULT_BUFFER_OVERLAP_MIN_M:
                buf_rect = Rectangle(overlap_x0, edge_y - half, overlap_x1 - overlap_x0, buf_width)
                rb.height -= half
                ra.y += half
                ra.height -= half

        if buf_rect is not None and buf_rect.area > DEFAULT_BUFFER_MIN_AREA_SQM:
            buffer_room = RoomNode(
                id=f"buffer_{buffer_id}",
                name="Buffer (closet/corridor)",
                type=RoomType.CIRCULATION,
                acoustic_zone=AcousticZone.BUFFER,
                target_area_sqm=buf_rect.area,
                min_width_m=DEFAULT_BUFFER_ROOM_MIN_WIDTH_M,
                max_aspect_ratio=DEFAULT_BUFFER_ROOM_MAX_ASPECT_RATIO,
                priority=0,
            )
            new_placements.append(type(p_active)(room=buffer_room, rectangle=buf_rect))
            buffers_inserted.append({
                "buffer_id": f"buffer_{buffer_id}",
                "between": [p_active.room.id, p_passive.room.id],
                "width_m": round(buf_width, 2),
                "area_sqm": round(buf_rect.area, 2),
            })
            buffer_id += 1

    return new_placements, buffers_inserted


def generate_structural_grid(
    placements: List[Any],
    boundary: Rectangle,
    grid_module_m: float = DEFAULT_STRUCTURAL_OUTPUT_GRID_MODULE_M,
    max_span_m: float = DEFAULT_STRUCTURAL_OUTPUT_MAX_SPAN_M,
) -> Dict[str, Any]:
    raw_points: Set[Tuple[float, float]] = set()
    for p in placements:
        r = p.rectangle
        for cx, cy in [(r.x, r.y), (r.x + r.width, r.y), (r.x, r.y + r.height), (r.x + r.width, r.y + r.height)]:
            raw_points.add((round(snap_to_grid(cx, grid_module_m), 3), round(snap_to_grid(cy, grid_module_m), 3)))

    raw_points.add((round(boundary.x, 3), round(boundary.y, 3)))
    raw_points.add((round(boundary.x + boundary.width, 3), round(boundary.y, 3)))
    raw_points.add((round(boundary.x, 3), round(boundary.y + boundary.height, 3)))
    raw_points.add((round(boundary.x + boundary.width, 3), round(boundary.y + boundary.height, 3)))

    tol = grid_module_m * DEFAULT_STRUCTURAL_GRID_DEDUP_FACTOR
    columns: List[Tuple[float, float]] = []
    for pt in sorted(raw_points):
        if not any(math.hypot(pt[0] - e[0], pt[1] - e[1]) < tol for e in columns):
            columns.append(pt)

    x_lines = sorted(set(c[0] for c in columns))
    y_lines = sorted(set(c[1] for c in columns))

    beams: List[Dict[str, Any]] = []
    beam_id = 0
    for xi in range(len(x_lines)):
        for yi in range(len(y_lines) - 1):
            span = y_lines[yi + 1] - y_lines[yi]
            if span > DEFAULT_STRUCTURAL_TRIVIAL_SPAN_M:
                beams.append({"id": f"B{beam_id}", "start": [x_lines[xi], y_lines[yi]], "end": [x_lines[xi], y_lines[yi + 1]], "span_m": round(span, 3), "direction": "Y", "needs_deep_beam": span > max_span_m})
                beam_id += 1
    for yi in range(len(y_lines)):
        for xi in range(len(x_lines) - 1):
            span = x_lines[xi + 1] - x_lines[xi]
            if span > DEFAULT_STRUCTURAL_TRIVIAL_SPAN_M:
                beams.append({"id": f"B{beam_id}", "start": [x_lines[xi], y_lines[yi]], "end": [x_lines[xi + 1], y_lines[yi]], "span_m": round(span, 3), "direction": "X", "needs_deep_beam": span > max_span_m})
                beam_id += 1

    span_warnings = [{"room_id": p.room.id, "max_span_m": round(p.rectangle.max_dim, 2), "limit_m": max_span_m, "action": "Add intermediate column or use deeper beam"} for p in placements if p.rectangle.max_dim > max_span_m]

    return {
        "columns": [{"x": c[0], "y": c[1]} for c in columns],
        "x_grid_lines": x_lines,
        "y_grid_lines": y_lines,
        "beams": beams,
        "span_warnings": span_warnings,
        "grid_module_m": grid_module_m,
        "total_columns": len(columns),
        "total_beams": len(beams),
    }


def generate_structural_handoff(placements: List[Any], boundary: Rectangle, constraints: Any) -> Dict[str, Any]:
    grid_mod = constraints.structural_grid_module_m

    wall_segments: List[Dict[str, Any]] = []
    for i, p1 in enumerate(placements):
        r1 = p1.rectangle
        for j, p2 in enumerate(placements):
            if j <= i:
                continue
            r2 = p2.rectangle
            if abs(r1.x + r1.width - r2.x) < DEFAULT_WALL_SHARED_TOL_M or abs(r2.x + r2.width - r1.x) < DEFAULT_WALL_SHARED_TOL_M:
                y_lo = max(r1.y, r2.y)
                y_hi = min(r1.y + r1.height, r2.y + r2.height)
                if y_hi - y_lo > DEFAULT_WALL_SHARED_MIN_OVERLAP_M:
                    shared_x = r1.x + r1.width if abs(r1.x + r1.width - r2.x) < DEFAULT_WALL_SHARED_TOL_M else r2.x + r2.width
                    wall_segments.append({"type": "vertical", "x": round(shared_x, 3), "y_start": round(y_lo, 3), "y_end": round(y_hi, 3), "length_m": round(y_hi - y_lo, 3), "rooms": [p1.room.id, p2.room.id], "load_bearing": True})
            if abs(r1.y + r1.height - r2.y) < DEFAULT_WALL_SHARED_TOL_M or abs(r2.y + r2.height - r1.y) < DEFAULT_WALL_SHARED_TOL_M:
                x_lo = max(r1.x, r2.x)
                x_hi = min(r1.x + r1.width, r2.x + r2.width)
                if x_hi - x_lo > DEFAULT_WALL_SHARED_MIN_OVERLAP_M:
                    shared_y = r1.y + r1.height if abs(r1.y + r1.height - r2.y) < DEFAULT_WALL_SHARED_TOL_M else r2.y + r2.height
                    wall_segments.append({"type": "horizontal", "y": round(shared_y, 3), "x_start": round(x_lo, 3), "x_end": round(x_hi, 3), "length_m": round(x_hi - x_lo, 3), "rooms": [p1.room.id, p2.room.id], "load_bearing": True})

    cantilever_rooms: List[Dict[str, Any]] = []
    for p in placements:
        r = p.rectangle
        overhang_left = max(0, boundary.x - r.x)
        overhang_right = max(0, (r.x + r.width) - (boundary.x + boundary.width))
        overhang_bottom = max(0, boundary.y - r.y)
        overhang_top = max(0, (r.y + r.height) - (boundary.y + boundary.height))
        max_oh = max(overhang_left, overhang_right, overhang_bottom, overhang_top)
        if max_oh > DEFAULT_CANTILEVER_MIN_OVERHANG_M:
            cantilever_rooms.append({"room_id": p.room.id, "max_overhang_m": round(max_oh, 3), "direction": "left" if overhang_left == max_oh else "right" if overhang_right == max_oh else "bottom" if overhang_bottom == max_oh else "top", "action": "Verify cantilever slab design per IS 456 Cl. 24.1"})

    slab_panels: List[Dict[str, Any]] = []
    for p in placements:
        r = p.rectangle
        ly = max(r.width, r.height)
        lx = min(r.width, r.height)
        ratio = ly / max(lx, 0.01)
        slab_panels.append({"room_id": p.room.id, "lx_m": round(lx, 3), "ly_m": round(ly, 3), "ly_lx_ratio": round(ratio, 3), "slab_type": "one_way" if ratio > DEFAULT_SLAB_ONE_WAY_RATIO else "two_way"})

    return {"wall_segments": wall_segments, "total_shared_walls": len(wall_segments), "cantilever_rooms": cantilever_rooms, "slab_panels": slab_panels, "grid_module_m": grid_mod}


def generate_mep_schedule(placements: List[Any]) -> Dict[str, Any]:
    wet_rooms: List[Dict[str, Any]] = []
    power_schedule: List[Dict[str, Any]] = []
    hvac_loads: List[Dict[str, Any]] = []

    for p in placements:
        area = p.rectangle.area
        rtype = p.room.type.value
        if p.room.plumbing_required:
            wet_rooms.append({"room_id": p.room.id, "room_type": rtype, "position": {"x": round(p.rectangle.x, 3), "y": round(p.rectangle.y, 3)}, "needs_floor_drain": rtype in ("bathroom", "toilet", "kitchen", "utility"), "needs_water_supply": True})

        est_points = ELECTRICAL_POINT_ESTIMATES.get(rtype, 3)
        power_schedule.append({"room_id": p.room.id, "room_type": rtype, "estimated_power_points": est_points, "estimated_lighting_points": max(1, int(area / DEFAULT_LIGHTING_AREA_DIVISOR))})

        if rtype not in ("balcony", "staircase", "parking", "garage", "passage", "store_room", "utility"):
            hvac_loads.append({"room_id": p.room.id, "room_type": rtype, "area_sqm": round(area, 2), "estimated_tonnage_tr": round(area * DEFAULT_HVAC_TR_PER_SQM, 2)})

    stacks: List[List[str]] = []
    visited: set[str] = set()
    for wr in wet_rooms:
        if wr["room_id"] in visited:
            continue
        stack = [wr["room_id"]]
        visited.add(wr["room_id"])
        for wr2 in wet_rooms:
            if wr2["room_id"] in visited:
                continue
            dx = abs(wr["position"]["x"] - wr2["position"]["x"])
            dy = abs(wr["position"]["y"] - wr2["position"]["y"])
            if dx < DEFAULT_MEP_STACK_PROXIMITY_M and dy < DEFAULT_MEP_STACK_PROXIMITY_M:
                stack.append(wr2["room_id"])
                visited.add(wr2["room_id"])
        stacks.append(stack)

    total_tonnage = sum(h["estimated_tonnage_tr"] for h in hvac_loads)
    total_power_pts = sum(ps["estimated_power_points"] for ps in power_schedule)

    return {
        "plumbing": {"wet_rooms": wet_rooms, "plumbing_stacks": stacks, "total_stacks": len(stacks)},
        "electrical": {"power_schedule": power_schedule, "total_power_points": total_power_pts, "total_lighting_points": sum(ps["estimated_lighting_points"] for ps in power_schedule)},
        "hvac": {"room_loads": hvac_loads, "total_tonnage_tr": round(total_tonnage, 2), "recommended_system": "split" if total_tonnage < DEFAULT_HVAC_SPLIT_THRESHOLD_TR else "centralised"},
    }
