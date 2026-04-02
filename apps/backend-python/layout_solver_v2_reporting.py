from __future__ import annotations

from typing import Any, Callable, Dict, List

from layout_solver_v2 import (
    RoomType,
    Rectangle,
    rectangles_adjacent,
)
from layout_solver_v2_pathfinding import FloorGrid, compute_travel_distances
from layout_solver_v2_helpers import (
    generate_mep_schedule,
    generate_structural_grid,
    generate_structural_handoff,
    insert_acoustic_buffers,
)
from rules.layout_solver_defaults import (
    DEFAULT_ACOUSTIC_BUFFER_WIDTH_M,
    DEFAULT_ACOUSTIC_MIN_BUFFER_WIDTH_M,
    DEFAULT_FLOORGRID_CELL_SIZE_M,
    DEFAULT_STRUCTURAL_OUTPUT_MAX_SPAN_REPORT_M,
)


def build_compliance_items(solver: Any, sol: Any) -> List[Dict[str, Any]]:
    """Build clause-traceable compliance items from diagnostic data."""
    items: List[Dict[str, Any]] = []
    diag = sol.diagnostics
    sat = sol.constraints_satisfied

    fsi = solver._fsi_precheck
    fsi_passed = fsi.get("compliant", True)
    fsi_actual = fsi.get("fsi_actual", 0.0)
    fsi_limit = fsi.get("fsi_limit", 1.5)
    items.append({
        "domain": "fsi",
        "label": "Floor Space Index (FSI / FAR)",
        "passed": fsi_passed,
        "severity": "critical" if not fsi_passed else "info",
        "clause": "NBC 2016 Cl. 4.8 / IS 875 Part 5 Cl. 3.2",
        "measured_value": round(fsi_actual, 3),
        "limit_value": fsi_limit,
        "units": "ratio",
        "affected_rooms": [],
        "remediation": (
            f"FSI {fsi_actual:.3f} exceeds permitted limit {fsi_limit}. "
            f"Currently {fsi.get('num_floors', 1)} floor(s); need "
            f"{fsi.get('floors_required', 1)} floors to fit requested area within FSI. "
            "Options: (a) ADD a floor, (b) REDUCE total room area, "
            "(c) REQUEST FSI relaxation from local authority."
        ) if not fsi_passed else "FSI within permitted limits — no action required.",
        "evidence_level": "hard_code_rule",
    })

    any_overlap = any(
        not v
        for k, v in sat.items()
        if k == "overlap" or "overlap" in k
    )
    overlap_passed = not any_overlap
    items.append({
        "domain": "overlap",
        "label": "Room Overlap (Collision Check)",
        "passed": overlap_passed,
        "severity": "critical" if not overlap_passed else "info",
        "clause": "N/A — computational hard constraint (rooms must not overlap)",
        "measured_value": None,
        "limit_value": None,
        "units": "",
        "affected_rooms": [],
        "remediation": (
            "Solver did not find a collision-free layout. "
            "Try: (a) Increase max_iterations, (b) Reduce total requested area, "
            "(c) Relax min_width_m for secondary rooms."
        ) if not overlap_passed else "No room overlaps detected.",
        "evidence_level": "hard_code_rule",
    })

    width_failures = [k for k, v in sat.items() if k.endswith("_width") and not v]
    min_width_passed = len(width_failures) == 0
    items.append({
        "domain": "min_width",
        "label": "Minimum Room Width",
        "passed": min_width_passed,
        "severity": "warning" if not min_width_passed else "info",
        "clause": "NBC 2016 Part 3 Cl. 4.1 (habitable ≥ 2.8 m, wet ≥ 1.8 m, circ ≥ 1.2 m)",
        "measured_value": None,
        "limit_value": None,
        "units": "m",
        "affected_rooms": [k.replace("_width", "") for k in width_failures],
        "remediation": (
            f"{len(width_failures)} room(s) placed narrower than minimum. "
            "IS 962 / NBC Cl. 4.1 minimums: habitable 2.8 m, wet 1.8 m, corridor 1.2 m. "
            "Increase usable area or reduce room count."
        ) if not min_width_passed else "All rooms meet minimum width requirements.",
        "evidence_level": "hard_code_rule",
    })

    ar_failures = [k for k, v in sat.items() if k.endswith("_aspect") and not v]
    ar_passed = len(ar_failures) == 0
    items.append({
        "domain": "aspect_ratio",
        "label": "Room Aspect Ratio (L/W)",
        "passed": ar_passed,
        "severity": "warning" if not ar_passed else "info",
        "clause": "NBC 2016 Part 3 Cl. 4.1 (habitable rooms: 1.0 ≤ L/W ≤ 1.5)",
        "measured_value": None,
        "limit_value": 1.5,
        "units": "ratio",
        "affected_rooms": [k.replace("_aspect", "") for k in ar_failures],
        "remediation": (
            f"{len(ar_failures)} room(s) have aspect ratio outside 1.0–1.5 range. "
            "Extreme proportions reduce furniture options and natural light penetration. "
            "Reshape rooms to approach a square-ish plan."
        ) if not ar_passed else "Room aspect ratios within acceptable range.",
        "evidence_level": "hard_code_rule",
    })

    ext_failures = [k for k, v in sat.items() if k.endswith("_exterior") and not v]
    ext_passed = len(ext_failures) == 0
    items.append({
        "domain": "exterior_wall",
        "label": "Exterior Wall Access (Natural Ventilation)",
        "passed": ext_passed,
        "severity": "warning" if not ext_passed else "info",
        "clause": "NBC 2016 Cl. 4.11 / SP 7(Part 8):2005 (habitable rooms require natural ventilation)",
        "measured_value": None,
        "limit_value": None,
        "units": "",
        "affected_rooms": [k.replace("_exterior", "") for k in ext_failures],
        "remediation": (
            f"{len(ext_failures)} habitable room(s) are landlocked (no exterior wall). "
            "NBC Cl. 4.11 mandates at least one exterior wall for natural ventilation. "
            "Options: (a) Rearrange layout, (b) Add interior courtyard/lightwell, "
            "(c) Use mechanical ventilation with fresh-air intake per SP 7."
        ) if not ext_passed else "All habitable rooms have exterior wall access.",
        "evidence_level": "hard_code_rule",
    })

    plumb_failures = [k for k, v in sat.items() if k.startswith("plumbing_") and not v]
    plumb_passed = len(plumb_failures) == 0
    items.append({
        "domain": "plumbing_cluster",
        "label": "Wet-Wall Clustering (Plumbing Economy)",
        "passed": plumb_passed,
        "severity": "info" if not plumb_passed else "info",
        "clause": "IS 1172:1993 Cl. 6.1 (shared drain stacks — wet rooms on common wall)",
        "measured_value": None,
        "limit_value": None,
        "units": "",
        "affected_rooms": [],
        "remediation": (
            "Wet rooms (bathrooms/kitchen) are not sharing walls, creating long plumbing runs. "
            "IS 1172 Cl. 6.1 recommends grouping wet rooms on a shared drain stack wall. "
            "Each metre of dispersed pipework increases cost and leak risk."
        ) if not plumb_passed else "Wet rooms correctly clustered — shared drain stack possible.",
        "evidence_level": "engineering_heuristic",
    })

    acoustic_failures = [k for k, v in sat.items() if k.startswith("acoustic_") and not v]
    acoustic_passed = len(acoustic_failures) == 0
    items.append({
        "domain": "acoustic_zones",
        "label": "Acoustic Zone Separation",
        "passed": acoustic_passed,
        "severity": "warning" if not acoustic_passed else "info",
        "clause": "NBC 2016 Part 8 Cl. 4 / IS 1950 (noise isolation: ≥ 45 dB STC between active-passive zones)",
        "measured_value": None,
        "limit_value": None,
        "units": "",
        "affected_rooms": [],
        "remediation": (
            f"{len(acoustic_failures)} active/passive room pair(s) are directly adjacent. "
            "NBC Part 8 Cl. 4 requires STC ≥ 45 dB between living zones and bedrooms. "
            "Insert 1.2 m closet/corridor buffer, or use double-leaf wall with 50 mm air gap."
        ) if not acoustic_passed else "Active/passive acoustic zones correctly separated.",
        "evidence_level": "engineering_heuristic",
    })

    anthro = diag.get("anthropometric_issues", [])
    anthro_passed = len(anthro) == 0
    items.append({
        "domain": "clearance",
        "label": "Anthropometric Clearances (Door Swing + Min Dim)",
        "passed": anthro_passed,
        "severity": "warning" if not anthro_passed else "info",
        "clause": "NBC 2016 Part 3 Cl. 4.1 / IS 962:1989 (ergonomic dimensional standards)",
        "measured_value": None,
        "limit_value": None,
        "units": "m",
        "affected_rooms": [a.split(":")[0].strip() for a in anthro if ":" in a],
        "remediation": (
            f"{len(anthro)} clearance issue(s) detected. "
            "Min clear dimensions per NBC Part 3 Cl. 4.1: habitable 2.8 m, wet 1.8 m, corridor 1.2 m. "
            "Door swing arc requires 0.9 m × 0.9 m clear zone per door per IS 962."
        ) if not anthro_passed else "All rooms meet anthropometric clearance requirements.",
        "evidence_level": "hard_code_rule",
    })

    grid_failures = [k for k, v in sat.items() if k.endswith("_grid") and not v]
    grid_passed = len(grid_failures) == 0
    items.append({
        "domain": "grid_snap",
        "label": "Structural Grid Coordination",
        "passed": grid_passed,
        "severity": "info" if not grid_passed else "info",
        "clause": "IS 456:2000 Cl. 5.3 / IS 800:2007 (modular coordination for structural members)",
        "measured_value": None,
        "limit_value": solver.constraints.structural_grid_module_m,
        "units": "m modular offset",
        "affected_rooms": [k.replace("_grid", "") for k in grid_failures],
        "remediation": (
            f"{len(grid_failures)} room(s) are off the {solver.constraints.structural_grid_module_m} m structural grid. "
            "Misalignment forces non-standard structural member sizes and increases fabrication cost. "
            "Adjust room positions to snap to the grid module."
        ) if not grid_passed else f"All rooms snap to {solver.constraints.structural_grid_module_m} m structural grid.",
        "evidence_level": "engineering_heuristic",
    })

    circ = diag.get("circulation", {})
    circ_budget_ok = circ.get("corridor_budget_ok", True)
    all_connected = circ.get("all_rooms_connected", True)
    circ_ratio = circ.get("corridor_ratio", 0.0)
    circ_limit = solver.constraints.max_circulation_ratio
    disconnected = circ.get("disconnected_rooms", [])

    if not all_connected:
        items.append({
            "domain": "circulation",
            "label": "Room Connectivity (BFS Graph Check)",
            "passed": False,
            "severity": "critical",
            "clause": "NBC 2016 Cl. 6.4 / NBC Part 4 (every occupied room reachable from entry)",
            "measured_value": None,
            "limit_value": None,
            "units": "",
            "affected_rooms": disconnected,
            "remediation": (
                f"Room(s) {', '.join(disconnected)} are unreachable from the entry point. "
                "Add a shared-wall adjacency or corridor connecting isolated rooms. "
                "NBC Cl. 6.4 requires all occupied spaces to be accessible from the main entry."
            ),
            "evidence_level": "engineering_heuristic",
        })

    items.append({
        "domain": "circulation",
        "label": "Circulation Area Ratio",
        "passed": circ_budget_ok,
        "severity": "warning" if not circ_budget_ok else "info",
        "clause": "NBC 2016 Cl. 6.4 (corridor / circulation ≤ 15% of usable floor area)",
        "measured_value": round(circ_ratio * 100, 1),
        "limit_value": round(circ_limit * 100, 1),
        "units": "%",
        "affected_rooms": [],
        "remediation": (
            f"Circulation area {circ_ratio * 100:.1f}% exceeds {circ_limit * 100:.0f}% ceiling. "
            "Merge small corridor fragments, widen rooms into corridors, or add pocket doors "
            "to convert corridors into room-to-room throughways."
        ) if not circ_budget_ok else f"Circulation ratio {circ_ratio * 100:.1f}% within {circ_limit * 100:.0f}% limit.",
        "evidence_level": "engineering_heuristic",
    })

    str_checks = diag.get("structural_checks", [])
    span_failing = [s for s in str_checks if s.get("needs_intermediate_column")]
    headroom_failing = [s for s in str_checks if not s.get("headroom_ok", True)]
    span_passed = len(span_failing) == 0
    max_span_measured = max((s.get("max_dimension_m", 0) for s in span_failing), default=None)
    items.append({
        "domain": "span_limits",
        "label": "Structural Span Limits",
        "passed": span_passed,
        "severity": "warning" if not span_passed else "info",
        "clause": "IS 456:2000 Cl. 23.2 / NBC 2016 Cl. 5.1.1 (max unsupported slab span)",
        "measured_value": round(max_span_measured, 2) if max_span_measured is not None else None,
        "limit_value": solver.constraints.max_unsupported_span_m,
        "units": "m",
        "affected_rooms": [s["room_id"] for s in span_failing],
        "remediation": (
            f"{len(span_failing)} room(s) exceed {solver.constraints.max_unsupported_span_m} m span limit. "
            "Options: (a) Add intermediate column (IS 456 Cl. 23.2: verify L/d ≥ 12 for beam), "
            "(b) Use post-tensioned flat slab (IS 1343), "
            "(c) Split room with internal partition beam."
        ) if not span_passed else "All clear spans within structural limit.",
        "evidence_level": "hard_code_rule",
    })

    if headroom_failing:
        items.append({
            "domain": "span_limits",
            "label": "Beam Headroom (Clear Height Under Soffite)",
            "passed": False,
            "severity": "warning",
            "clause": "NBC 2016 Cl. 5.1 (min 2.4 m clear height under beams in habitable spaces)",
            "measured_value": min(s.get("clear_height_under_beam_m", 0) for s in headroom_failing),
            "limit_value": 2.4,
            "units": "m",
            "affected_rooms": [s["room_id"] for s in headroom_failing],
            "remediation": (
                "Clear height under downstand beam < 2.4 m. "
                "Options: (a) Increase floor-to-floor height, "
                "(b) Use flat slab with drop panels (IS 456 Cl. 31) to eliminate downstand, "
                "(c) Recess beam within floor zone."
            ),
            "evidence_level": "engineering_heuristic",
        })

    stair_rooms = [r for r in solver.rooms if r.type.value == "staircase"]
    if stair_rooms:
        stair_sat = all(sat.get(f"{r.id}_width", True) and sat.get(f"{r.id}_area", True) for r in stair_rooms)
        items.append({
            "domain": "staircase",
            "label": "Staircase Geometry Compliance",
            "passed": stair_sat,
            "severity": "critical" if not stair_sat else "info",
            "clause": "NBC 2016 Part 4 Cl. 3 / IS 456 (riser ≤ 190 mm, tread ≥ 250 mm, width ≥ 1.0 m)",
            "measured_value": solver.constraints.max_riser_height_m * 1000,
            "limit_value": 190.0,
            "units": "mm (riser height)",
            "affected_rooms": [r.id for r in stair_rooms],
            "remediation": (
                "Staircase footprint does not match code-derived geometry. "
                f"NBC Cl. 3: riser ≤ {solver.constraints.max_riser_height_m * 1000:.0f} mm, "
                f"tread ≥ {solver.constraints.min_tread_depth_m * 1000:.0f} mm, "
                "clear width ≥ 1.0 m (residential), 1.5 m (commercial)."
            ) if not stair_sat else "Staircase geometry is code-compliant.",
            "evidence_level": "hard_code_rule",
        })

    fen_checks = diag.get("fenestration_checks", [])
    wwr_failing = [f for f in fen_checks if f.get("applicable") and not f.get("compliant", True)]
    nbc_failing = [f for f in fen_checks if f.get("applicable") and not f.get("nbc_floor_ratio_compliant", True)]
    fen_passed = len(wwr_failing) == 0
    items.append({
        "domain": "fenestration",
        "label": "Window-to-Wall Ratio (WWR)",
        "passed": fen_passed,
        "severity": "warning" if not fen_passed else "info",
        "clause": "NBC 2016 Cl. 4.9 (WWR 10–60%) / ECBC 2017 Cl. 3.3.1",
        "measured_value": round(min(f.get("wwr", 1.0) for f in wwr_failing), 3) if wwr_failing else None,
        "limit_value": solver.constraints.min_fenestration_ratio if wwr_failing else None,
        "units": "ratio (0–1)",
        "affected_rooms": [f["room_id"] for f in wwr_failing],
        "remediation": (
            f"{len(wwr_failing)} room(s) have WWR outside 10–60% range. "
            f"Current minimum: {solver.constraints.min_fenestration_ratio * 100:.0f}% (NBC Cl. 4.9). "
            "Add or enlarge windows. For deep rooms, consider clerestory strips or solar tubes."
        ) if not fen_passed else "All rooms meet window-to-wall ratio requirements.",
        "evidence_level": "hard_code_rule",
    })

    if nbc_failing:
        items.append({
            "domain": "fenestration",
            "label": "NBC Minimum Openable Window Area (1/8 Floor Area)",
            "passed": False,
            "severity": "critical",
            "clause": "NBC 2016 Cl. 4.9 (openable window ≥ 1/8 of floor area for habitable rooms)",
            "measured_value": round(min(f.get("nbc_floor_ratio", 0.0) for f in nbc_failing), 3),
            "limit_value": 0.125,
            "units": "ratio (window / floor area)",
            "affected_rooms": [f["room_id"] for f in nbc_failing],
            "remediation": (
                f"{len(nbc_failing)} habitable room(s) have openable window area < 1/8 (12.5%) of floor area. "
                "NBC 2016 Cl. 4.9 is a mandatory provision for habitable rooms. "
                "Increase openable sash width/height or add louvred transom panels."
            ),
            "evidence_level": "hard_code_rule",
        })

    egress = diag.get("egress", {})
    egress_passed = egress.get("compliant", True)
    max_travel = egress.get("max_travel_distance_m", 0.0)
    egress_limit = solver.constraints.max_egress_distance_m
    egress_violations = egress.get("violations", [])
    egress_rooms = [v.split(":")[0].strip() for v in egress_violations if ":" in v]
    items.append({
        "domain": "egress",
        "label": "Egress Travel Distance (Life Safety)",
        "passed": egress_passed,
        "severity": "critical" if not egress_passed else "info",
        "clause": "NBC 2016 Cl. 5.3 / IS 456:2000 Cl. 8.1 (max travel distance to exit)",
        "measured_value": round(max_travel, 2),
        "limit_value": egress_limit,
        "units": "m",
        "affected_rooms": egress_rooms,
        "remediation": (
            f"Max travel distance {max_travel:.1f} m exceeds {egress_limit} m NBC limit. "
            f"{len(egress_rooms)} room(s) affected. "
            "Options: (a) Add a second staircase/exit closer to affected rooms, "
            "(b) Relocate staircase to a more central position, "
            "(c) Redesign room adjacencies to reduce the longest travel path."
        ) if not egress_passed else f"All rooms within {egress_limit} m egress travel limit.",
        "evidence_level": "hard_code_rule",
    })

    solar_scores = diag.get("solar_scores", [])
    high_thermal = [s for s in solar_scores if s.get("thermal_penalty", 0) > 0.5]
    solar_passed = len(high_thermal) == 0
    items.append({
        "domain": "solar",
        "label": "Solar Thermal Exposure (Passive Design)",
        "passed": solar_passed,
        "severity": "warning" if not solar_passed else "info",
        "clause": "ECBC 2017 Cl. 3.1 / NBC 2016 Cl. 4.8 (passive solar design, shading coefficient ≤ 0.4)",
        "measured_value": round(max((s.get("thermal_penalty", 0) for s in high_thermal), default=0.0), 3) if high_thermal else None,
        "limit_value": 0.5 if high_thermal else None,
        "units": "thermal penalty (0–1)",
        "affected_rooms": [s.get("room_id", "") for s in high_thermal],
        "remediation": (
            f"{len(high_thermal)} habitable room(s) face high west/SW solar load. "
            "ECBC 2017 requires shading coefficient SC ≤ 0.4 for west facades (Climate Zone 4A). "
            "Install chajja/overhang (depth = 0.6–1.0 m) or external louvre on worst facade. "
            "Alternatively reorient room to north/north-east."
        ) if not solar_passed else "All rooms have acceptable solar orientation.",
        "evidence_level": "engineering_heuristic",
    })

    return items


def build_full_report(solver: Any, staircase_footprint_fn: Callable[..., Any]) -> Dict[str, Any]:
    """Comprehensive JSON-serialisable report with all domain analyses."""
    if not solver.best_solution:
        return {"error": "No solution generated"}

    sol = solver.best_solution
    met = sum(1 for v in sol.constraints_satisfied.values() if v)
    total_c = max(1, len(sol.constraints_satisfied))

    stair_info = None
    for r in solver.rooms:
        if r.type == RoomType.STAIRCASE:
            _, _, stair_info = staircase_footprint_fn(
                solver.constraints.floor_to_floor_height_m,
                solver.constraints.max_riser_height_m,
                solver.constraints.min_tread_depth_m,
            )
            break

    grid = FloorGrid(solver.usable_boundary, cell_size=DEFAULT_FLOORGRID_CELL_SIZE_M)
    grid.rasterise(sol.placements)
    travel = compute_travel_distances(grid, sol.placements)

    _, acoustic_buffers = insert_acoustic_buffers(
        sol.placements,
        buffer_width_m=DEFAULT_ACOUSTIC_BUFFER_WIDTH_M,
        min_buffer_width_m=DEFAULT_ACOUSTIC_MIN_BUFFER_WIDTH_M,
    )

    structural = generate_structural_grid(
        sol.placements,
        solver.usable_boundary,
        grid_module_m=solver.constraints.structural_grid_module_m,
        max_span_m=DEFAULT_STRUCTURAL_OUTPUT_MAX_SPAN_REPORT_M,
    )

    compliance_items = build_compliance_items(solver, sol)

    space_syntax_data = None
    try:
        from space_syntax import SpaceSyntaxAnalyzer

        ss = SpaceSyntaxAnalyzer()
        ss_result = ss.analyze(
            sol.placements,
            solver.usable_boundary,
            solver.adjacency_map,
        )
        space_syntax_data = ss_result.to_dict()
    except ImportError:
        pass

    structural_handoff = generate_structural_handoff(
        sol.placements,
        solver.usable_boundary,
        solver.constraints,
    )

    mep_schedule = generate_mep_schedule(sol.placements)

    return {
        "total_penalty": round(sol.total_penalty, 4),
        "iteration_found": sol.iteration,
        "total_iterations": len(solver.iteration_history),
        "constraints_met_ratio": round(met / total_c, 4),
        "constraints_detail": sol.constraints_satisfied,
        "compliance_items": compliance_items,
        "fsi_analysis": solver._fsi_precheck,
        "usable_boundary": {
            "x": round(solver.usable_boundary.x, 3),
            "y": round(solver.usable_boundary.y, 3),
            "width": round(solver.usable_boundary.width, 3),
            "height": round(solver.usable_boundary.height, 3),
            "area_sqm": round(solver.usable_boundary.area, 2),
        },
        "staircase": stair_info,
        "diagnostics": sol.diagnostics,
        "travel_distances": travel,
        "acoustic_buffers": acoustic_buffers,
        "structural_grid": structural,
        "space_syntax": space_syntax_data,
        "structural_handoff": structural_handoff,
        "mep_schedule": mep_schedule,
        "placements": [
            {
                "room_id": p.room.id,
                "name": p.room.name,
                "type": p.room.type.value,
                "acoustic_zone": p.room.acoustic_zone.value
                if p.room.acoustic_zone
                else None,
                "target_area_sqm": p.room.target_area_sqm,
                "actual_area_sqm": round(p.rectangle.area, 2),
                "area_deviation_pct": round(p.area_deviation * 100, 2),
                "position": {
                    "x": round(p.rectangle.x, 3),
                    "y": round(p.rectangle.y, 3),
                },
                "dimensions": {
                    "width": round(p.rectangle.width, 3),
                    "height": round(p.rectangle.height, 3),
                },
                "aspect_ratio": round(p.rectangle.aspect_ratio, 3),
                "min_dimension_m": round(p.rectangle.min_dim, 3),
                "width_valid": p.width_valid,
                "aspect_ratio_valid": p.aspect_ratio_valid,
                "plumbing_required": p.room.plumbing_required,
                "requires_exterior_wall": p.room.requires_exterior_wall,
            }
            for p in sol.placements
        ],
    }
