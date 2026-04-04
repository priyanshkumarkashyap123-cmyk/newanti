"""Fixed-end action aggregation helpers for LoadEngine."""

from typing import Dict, Iterable

from .load_models import TrapezoidalLoad, UniformLoad, PointLoadOnMember


def aggregate_fixed_end_actions(
    member_id: str,
    length: float,
    member_loads: Iterable,
) -> Dict[str, Dict[str, float]]:
    """Aggregate fixed-end actions for a member across provided loads."""
    actions = {
        "Fy": {"start": 0.0, "end": 0.0},
        "Mz": {"start": 0.0, "end": 0.0},
    }

    for load in member_loads:
        if not hasattr(load, "member_id") or load.member_id != member_id:
            continue

        if not hasattr(load, "get_fixed_end_actions"):
            continue

        fea = load.get_fixed_end_actions(length)
        actions["Fy"]["start"] += fea.get("Fy_start", 0.0)
        actions["Fy"]["end"] += fea.get("Fy_end", 0.0)
        actions["Mz"]["start"] += fea.get("Mz_start", 0.0)
        actions["Mz"]["end"] += fea.get("Mz_end", 0.0)

    return actions


__all__ = ["aggregate_fixed_end_actions"]
