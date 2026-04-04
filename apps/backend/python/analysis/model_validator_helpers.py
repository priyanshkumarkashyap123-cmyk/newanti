"""Shared helper functions for model validation utilities."""

from __future__ import annotations

import math
from typing import Dict, List, Set


def distance_between_nodes(n1: Dict, n2: Dict) -> float:
    dx = n2.get("x", 0) - n1.get("x", 0)
    dy = n2.get("y", 0) - n1.get("y", 0)
    dz = n2.get("z", 0) - n1.get("z", 0)
    return math.sqrt(dx * dx + dy * dy + dz * dz)


def node_has_support(node: Dict) -> bool:
    support_type = str(node.get("support", "")).lower()
    if support_type in ["fixed", "pinned", "roller", "pin", "roller_x", "roller_z"]:
        return True

    restraints = node.get("restraints", {})
    if any(restraints.get(r, False) for r in ["fx", "fy", "fz", "Dx", "Dy", "Dz"]):
        return True

    return False


def count_restraints(node: Dict) -> int:
    support_type = str(node.get("support", "")).lower()

    support_dofs = {
        "fixed": 6,
        "pinned": 3,
        "pin": 3,
        "roller": 1,
        "roller_x": 2,
        "roller_z": 2,
    }

    if support_type in support_dofs:
        return support_dofs[support_type]

    restraints = node.get("restraints", {})
    count = 0
    for restraint in ["fx", "fy", "fz", "mx", "my", "mz", "Dx", "Dy", "Dz", "Rx", "Ry", "Rz"]:
        if restraints.get(restraint, False):
            count += 1
    return min(count, 6)


def connected_components(adjacency: Dict[str, Set[str]]) -> List[Set[str]]:
    visited = set()
    components = []

    for start_node in adjacency:
        if start_node in visited:
            continue

        component = set()
        queue = [start_node]

        while queue:
            node = queue.pop(0)
            if node in visited:
                continue

            visited.add(node)
            component.add(node)

            for neighbor in adjacency.get(node, []):
                if neighbor not in visited:
                    queue.append(neighbor)

        if component:
            components.append(component)

    return components


__all__ = [
    "distance_between_nodes",
    "node_has_support",
    "count_restraints",
    "connected_components",
]