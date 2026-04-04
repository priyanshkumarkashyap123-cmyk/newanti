from __future__ import annotations

import heapq
import math
from typing import Any, Dict, List, Set, Tuple

from layout_solver_v2 import Rectangle, rectangles_adjacent
from rules.layout_solver_defaults import DEFAULT_MAX_CIRCULATION_RATIO, DEFAULT_MAX_EGRESS_DISTANCE_M


def build_room_graph(placements: List[Any]) -> Dict[str, Set[str]]:
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

    graph = build_room_graph(placements)
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

    graph = build_room_graph(placements)
    pmap = {p.room.id: p for p in placements}

    exit_rooms = {p.room.id for p in placements if p.rectangle.exterior_facades(boundary)}
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
            violations.append(f"{rid}: travel distance {d:.2f}m exceeds {max_travel_m}m limit")
        max_dist = max(max_dist, d if d != float("inf") else 0.0)

    return {
        "compliant": len(violations) == 0,
        "max_travel_distance_m": round(max_dist, 2),
        "room_distances_m": {r: round(d, 2) for r, d in dist.items()},
        "violations": violations,
    }


__all__ = [
    "build_room_graph",
    "analyze_circulation",
    "analyze_egress",
]
