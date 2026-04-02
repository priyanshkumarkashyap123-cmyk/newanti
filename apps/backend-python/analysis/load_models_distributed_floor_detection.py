"""Panel detection helpers for floor load distribution."""

from __future__ import annotations

from collections import defaultdict
from typing import Dict, List, Set


class FloorPanelDetectionMixin:
    """Detection routines for rectangular floor panels."""

    @staticmethod
    def detect_panels(
        beams: List[Dict],
        nodes: Dict[str, Dict],
        y_level: float,
        tolerance: float = 0.1,
    ) -> List[Dict]:
        """Detect closed rectangular panels at a given Y level."""
        level_beams = []
        for beam in beams:
            start = nodes.get(beam['start_node_id'])
            end = nodes.get(beam['end_node_id'])
            if not start or not end:
                continue
            if abs(start['y'] - y_level) < tolerance and abs(end['y'] - y_level) < tolerance:
                level_beams.append(beam)

        if len(level_beams) < 4:
            return []

        graph = defaultdict(set)
        for beam in level_beams:
            graph[beam['start_node_id']].add(beam['end_node_id'])
            graph[beam['end_node_id']].add(beam['start_node_id'])

        panels = []
        visited_cycles = set()
        for start_node in graph:
            panels.extend(FloorPanelDetectionMixin._find_rectangular_panels(start_node, graph, nodes, visited_cycles))
        return panels

    @staticmethod
    def _find_rectangular_panels(
        start: str,
        graph: Dict[str, Set[str]],
        nodes: Dict[str, Dict],
        visited: Set[frozenset],
    ) -> List[Dict]:
        panels = []
        n1_list = list(graph[start])

        for n1 in n1_list:
            for n2 in graph[n1]:
                if n2 == start:
                    continue
                for n3 in graph[n2]:
                    if n3 == start or n3 == n1:
                        continue
                    if start in graph[n3]:
                        cycle = frozenset([start, n1, n2, n3])
                        if cycle in visited:
                            continue
                        visited.add(cycle)

                        corners = [
                            (nodes[start]['x'], nodes[start]['z']),
                            (nodes[n1]['x'], nodes[n1]['z']),
                            (nodes[n2]['x'], nodes[n2]['z']),
                            (nodes[n3]['x'], nodes[n3]['z']),
                        ]

                        xs = [c[0] for c in corners]
                        zs = [c[1] for c in corners]
                        x_min, x_max = min(xs), max(xs)
                        z_min, z_max = min(zs), max(zs)
                        lx = x_max - x_min
                        lz = z_max - z_min

                        if lx > 0.1 and lz > 0.1:
                            aspect_ratio = max(lx, lz) / min(lx, lz)
                            panels.append({
                                'nodes': [start, n1, n2, n3],
                                'x_min': x_min,
                                'x_max': x_max,
                                'z_min': z_min,
                                'z_max': z_max,
                                'Lx': lx,
                                'Lz': lz,
                                'aspect_ratio': aspect_ratio,
                                'area': lx * lz,
                            })

        return panels


__all__ = ["FloorPanelDetectionMixin"]
