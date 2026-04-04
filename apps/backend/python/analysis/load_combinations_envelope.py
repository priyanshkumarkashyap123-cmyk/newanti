"""Envelope utilities for load combination result post-processing."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass
class EnvelopeResult:
    """Stores max/min force components with governing combination IDs."""

    element_id: str
    station: float
    max_forces: Dict[str, float]
    min_forces: Dict[str, float]
    governing_max: Dict[str, str]
    governing_min: Dict[str, str]


def compute_envelope(
    combo_results: Dict[str, Dict[str, List[Dict[str, float]]]],
    element_ids: Optional[List[str]] = None,
) -> Dict[str, List[EnvelopeResult]]:
    """Compute force envelope across all load combinations."""
    import math

    force_keys = ("Fx", "Vy", "Vz", "Mx", "My", "Mz")

    all_eids: set = set()
    for combo_data in combo_results.values():
        all_eids.update(combo_data.keys())
    if element_ids is not None:
        all_eids &= set(element_ids)

    envelope: Dict[str, List[EnvelopeResult]] = {}

    for eid in sorted(all_eids):
        stations = None
        for combo_data in combo_results.values():
            if eid in combo_data:
                stations = combo_data[eid]
                break
        if stations is None:
            continue

        n_stations = len(stations)
        env_list: List[EnvelopeResult] = []

        for si in range(n_stations):
            max_f = {k: -math.inf for k in force_keys}
            min_f = {k: math.inf for k in force_keys}
            gov_max = {k: "" for k in force_keys}
            gov_min = {k: "" for k in force_keys}
            station_val = 0.0

            for combo_id, combo_data in combo_results.items():
                if eid not in combo_data or si >= len(combo_data[eid]):
                    continue
                pt = combo_data[eid][si]
                station_val = pt.get("station", si / max(n_stations - 1, 1))

                for k in force_keys:
                    val = pt.get(k, 0.0)
                    if val > max_f[k]:
                        max_f[k] = val
                        gov_max[k] = combo_id
                    if val < min_f[k]:
                        min_f[k] = val
                        gov_min[k] = combo_id

            for k in force_keys:
                if max_f[k] == -math.inf:
                    max_f[k] = 0.0
                if min_f[k] == math.inf:
                    min_f[k] = 0.0

            env_list.append(
                EnvelopeResult(
                    element_id=eid,
                    station=station_val,
                    max_forces=max_f,
                    min_forces=min_f,
                    governing_max=gov_max,
                    governing_min=gov_min,
                )
            )

        envelope[eid] = env_list

    return envelope


__all__ = ["EnvelopeResult", "compute_envelope"]
