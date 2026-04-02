from __future__ import annotations

from typing import Any, Dict, List

from layout_solver_v2 import Rectangle, RoomType, rectangles_adjacent, rectangles_overlap, snap_to_grid
from rules.compliance_schemas import DOOR_SWING_ARC_M, MIN_CLEARANCES
from rules.layout_solver_defaults import (
    DEFAULT_FENESTRATION_CEILING_HEIGHT_M,
    DEFAULT_MIN_CLEARANCE_FALLBACK_M,
    DEFAULT_MIN_FENESTRATION_RATIO,
    DEFAULT_NBC_OPENABLE_RATIO,
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
            f"{room.id}: min dimension {rect.min_dim:.2f}m < {min_req:.2f}m required clearance"
        )
    door_area = room.num_doors * DOOR_SWING_ARC_M ** 2
    if rect.area < door_area + room.target_area_sqm * 0.3:
        violations.append(
            f"{room.id}: insufficient area for {room.num_doors} door swing(s) ({door_area:.2f} m² needed)"
        )
    return violations


def check_fenestration(
    placement: Any,
    boundary: Rectangle,
    min_ratio: float = DEFAULT_MIN_FENESTRATION_RATIO,
) -> Dict[str, Any]:
    facades = placement.rectangle.exterior_facades(boundary)
    applicable = bool(facades) and placement.room.type in (RoomType.HABITABLE, RoomType.UTILITY)
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
            sum(rect.height if f in ("left", "right") else rect.width for f in facades),
            2,
        ),
    }


__all__ = [
    "check_anthropometric",
    "check_fenestration",
]
