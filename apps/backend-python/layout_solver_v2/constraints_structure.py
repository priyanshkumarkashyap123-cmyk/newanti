from __future__ import annotations

from typing import Any, Dict

from rules.layout_solver_defaults import (
    DEFAULT_BEAM_DEPTH_DIVISOR,
    DEFAULT_MIN_HEADROOM_UNDER_BEAM_M,
)


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


__all__ = [
    "check_span_limits",
]
