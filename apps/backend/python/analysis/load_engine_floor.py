"""Floor load distribution helpers for the static loading engine."""

from __future__ import annotations

from collections import defaultdict
from typing import Dict, List

from .load_models import FloorLoad, TrapezoidalLoad
from .load_case import LoadCase


def process_floor_loads(
    load_cases: Dict[str, LoadCase],
    beams: List[Dict],
    nodes: Dict[str, Dict],
) -> Dict[str, List[TrapezoidalLoad]]:
    """Process floor loads and distribute them to beams."""
    result = defaultdict(list)

    for case in load_cases.values():
        for floor_load in case.floor_loads:
            panels = FloorLoad.detect_panels(beams, nodes, floor_load.y_level)
            filtered_panels = [
                p
                for p in panels
                if (
                    p["x_min"] >= floor_load.x_min
                    and p["x_max"] <= floor_load.x_max
                    and p["z_min"] >= floor_load.z_min
                    and p["z_max"] <= floor_load.z_max
                )
            ]
            member_loads = floor_load.distribute_to_beams(filtered_panels, beams, nodes)
            result[case.name].extend(member_loads)

    return dict(result)


__all__ = ["process_floor_loads"]
