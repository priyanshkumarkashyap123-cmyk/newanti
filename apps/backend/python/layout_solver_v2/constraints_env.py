from __future__ import annotations

from typing import Any, Dict

from layout_solver_v2 import Rectangle, RoomType
from rules.layout_solver_defaults import (
    DEFAULT_BASE_OVERHANG_DEPTH_M,
    DEFAULT_OVERHANG_DEPTH_FACTOR_M,
    DEFAULT_SHADING_REDUCTION_FACTOR,
    DEFAULT_SOLAR_HIGH_PENALTY_THRESHOLD,
    DEFAULT_SOLAR_LATITUDE_DIVISOR,
    DEFAULT_SOLAR_LATITUDE_MIN_FACTOR,
    DEFAULT_SOLAR_LATITUDE_REFERENCE_DEG,
)


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
        facade_length = placement.rectangle.height if worst_facade in ("left", "right") else placement.rectangle.width
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


__all__ = [
    "wall_bearing",
    "thermal_load_factor",
    "score_solar",
]
