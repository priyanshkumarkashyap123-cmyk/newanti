"""
Space Syntax & Topological Graph Analysis Engine

Computes graph-theoretic quality metrics for architectural floor plans:
  - Justified graph from entry point
  - Mean depth (average step count from entry to all rooms)
  - Integration (reciprocal of Relative Asymmetry — higher = more accessible)
  - Control value (degree-weighted centrality)
  - Connectivity (number of direct neighbours)
  - Graph planarity check (planar = no crossing corridors)
  - Visibility penalty (rooms with no exterior wall and no direct line to window)
  - Circulation depth histogram

Reuses adjacency primitives from layout_solver_v2.py and zone patterns
from workflow_analyzer.py.

Reference: B. Hillier & J. Hanson, *The Social Logic of Space*, 1984.
"""

from __future__ import annotations

import math
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

try:
    from layout_solver_v2 import (
        AcousticZone,
        Rectangle,
        RoomNode,
        RoomPlacement,
        RoomType,
        rectangles_adjacent,
    )
except ImportError:
    RoomNode = Any  # type: ignore
    RoomPlacement = Any  # type: ignore
    Rectangle = Any  # type: ignore


# =====================================================================
#  DATA MODELS
# =====================================================================

@dataclass
class GraphNode:
    """Node in the room adjacency / space-syntax graph."""
    room_id: str
    room_type: str  # RoomType value
    acoustic_zone: str  # AcousticZone value
    is_entry: bool = False
    is_circulation: bool = False
    connectivity: int = 0       # number of direct neighbours
    depth: int = 0              # BFS depth from entry
    integration: float = 0.0   # higher = more accessible
    control_value: float = 0.0  # local centrality measure


@dataclass
class GraphEdge:
    """Edge in the room adjacency graph."""
    source: str
    target: str
    weight: float = 1.0
    is_required_adjacency: bool = False


@dataclass
class SpaceSyntaxResult:
    """Full space-syntax analysis output."""
    nodes: List[GraphNode] = field(default_factory=list)
    edges: List[GraphEdge] = field(default_factory=list)
    entry_room_id: str = ""
    mean_depth: float = 0.0
    max_depth: int = 0
    total_depth: int = 0
    integration_mean: float = 0.0   # average integration across all rooms
    integration_variance: float = 0.0
    is_planar: bool = True
    depth_histogram: Dict[int, int] = field(default_factory=dict)
    visibility_penalties: List[Dict[str, Any]] = field(default_factory=list)
    circulation_depth_rooms: List[str] = field(default_factory=list)  # rooms > 3 steps from entry

    def to_dict(self) -> Dict[str, Any]:
        """Serialisable output for API response / frontend."""
        return {
            "entry_room_id": self.entry_room_id,
            "mean_depth": round(self.mean_depth, 3),
            "max_depth": self.max_depth,
            "total_depth": self.total_depth,
            "integration_mean": round(self.integration_mean, 4),
            "integration_variance": round(self.integration_variance, 4),
            "is_planar": self.is_planar,
            "depth_histogram": self.depth_histogram,
            "deep_rooms": self.circulation_depth_rooms,
            "visibility_penalties": self.visibility_penalties,
            "nodes": [
                {
                    "room_id": n.room_id,
                    "room_type": n.room_type,
                    "acoustic_zone": n.acoustic_zone,
                    "is_entry": n.is_entry,
                    "connectivity": n.connectivity,
                    "depth": n.depth,
                    "integration": round(n.integration, 4),
                    "control_value": round(n.control_value, 3),
                }
                for n in self.nodes
            ],
            "edges": [
                {
                    "source": e.source,
                    "target": e.target,
                    "weight": round(e.weight, 2),
                    "is_required": e.is_required_adjacency,
                }
                for e in self.edges
            ],
        }


# =====================================================================
#  SPACE SYNTAX ANALYZER
# =====================================================================

class SpaceSyntaxAnalyzer:
    """Compute space-syntax metrics from a set of room placements.

    Usage:
        analyzer = SpaceSyntaxAnalyzer()
        result = analyzer.analyze(placements, boundary, adjacency_map)
    """

    def analyze(
        self,
        placements: List[RoomPlacement],
        boundary: Rectangle,
        adjacency_map: Optional[Dict[Tuple[str, str], float]] = None,
        adjacency_tolerance: float = 0.4,
    ) -> SpaceSyntaxResult:
        """Run full space-syntax analysis on finalised room placements."""
        if not placements:
            return SpaceSyntaxResult()

        result = SpaceSyntaxResult()

        # 1. Build adjacency graph from geometric proximity
        adj_graph, node_map = self._build_adjacency_graph(
            placements, adjacency_tolerance
        )

        # 2. Create graph nodes
        entry_id = self._find_entry(placements)
        result.entry_room_id = entry_id

        for p in placements:
            rid = p.room.id
            neighbours = adj_graph.get(rid, set())
            gn = GraphNode(
                room_id=rid,
                room_type=p.room.type.value if hasattr(p.room.type, 'value') else str(p.room.type),
                acoustic_zone=(
                    p.room.acoustic_zone.value
                    if p.room.acoustic_zone and hasattr(p.room.acoustic_zone, 'value')
                    else ""
                ),
                is_entry=(rid == entry_id),
                is_circulation=(
                    p.room.type == RoomType.CIRCULATION
                    if hasattr(RoomType, 'CIRCULATION') else False
                ),
                connectivity=len(neighbours),
            )
            result.nodes.append(gn)

        # 3. Create graph edges
        seen_edges: Set[Tuple[str, str]] = set()
        for rid, neighbours in adj_graph.items():
            for nbr in neighbours:
                edge_key = tuple(sorted((rid, nbr)))
                if edge_key not in seen_edges:
                    seen_edges.add(edge_key)
                    weight = 1.0
                    if adjacency_map:
                        w = adjacency_map.get(edge_key, adjacency_map.get((edge_key[1], edge_key[0]), 0.0))
                        weight = max(0.1, abs(w)) if w != 0 else 1.0
                    result.edges.append(GraphEdge(
                        source=edge_key[0],
                        target=edge_key[1],
                        weight=weight,
                        is_required_adjacency=(
                            adjacency_map.get(edge_key, 0) > 5.0 if adjacency_map else False
                        ),
                    ))

        # 4. BFS depth from entry
        depths = self._bfs_depth(adj_graph, entry_id)
        depth_map = {}
        for gn in result.nodes:
            d = depths.get(gn.room_id, -1)
            gn.depth = d
            depth_map[gn.room_id] = d

        # 5. Depth statistics
        valid_depths = [d for d in depths.values() if d >= 0]
        if valid_depths:
            result.total_depth = sum(valid_depths)
            result.max_depth = max(valid_depths)
            result.mean_depth = sum(valid_depths) / len(valid_depths)

        # 6. Depth histogram
        hist: Dict[int, int] = {}
        for d in valid_depths:
            hist[d] = hist.get(d, 0) + 1
        result.depth_histogram = hist

        # 7. Deep rooms (> 3 steps from entry)
        result.circulation_depth_rooms = [
            rid for rid, d in depths.items() if d > 3
        ]

        # 8. Integration (Hillier & Hanson)
        n = len(placements)
        if n >= 3:
            for gn in result.nodes:
                td = self._total_depth_from(adj_graph, gn.room_id)
                ra = self._relative_asymmetry(td, n)
                gn.integration = 1.0 / max(ra, 0.001)  # reciprocal of RA

            integrations = [gn.integration for gn in result.nodes]
            result.integration_mean = sum(integrations) / len(integrations)
            mean_i = result.integration_mean
            result.integration_variance = sum(
                (i - mean_i) ** 2 for i in integrations
            ) / len(integrations)

        # 9. Control value (local centrality)
        for gn in result.nodes:
            neighbours = adj_graph.get(gn.room_id, set())
            cv = 0.0
            for nbr in neighbours:
                nbr_degree = len(adj_graph.get(nbr, set()))
                if nbr_degree > 0:
                    cv += 1.0 / nbr_degree
            gn.control_value = cv

        # 10. Planarity check (Euler criterion: E ≤ 3V - 6 for planar graphs)
        v = len(result.nodes)
        e = len(result.edges)
        if v >= 3:
            result.is_planar = e <= 3 * v - 6
        else:
            result.is_planar = True

        # 11. Visibility penalties (rooms needing exterior wall but not having it)
        result.visibility_penalties = self._check_visibility(placements, boundary)

        return result

    # -- helpers -------------------------------------------------------

    def _build_adjacency_graph(
        self,
        placements: List[RoomPlacement],
        tol: float,
    ) -> Tuple[Dict[str, Set[str]], Dict[str, RoomPlacement]]:
        """Build undirected adjacency graph from spatial proximity."""
        graph: Dict[str, Set[str]] = {p.room.id: set() for p in placements}
        node_map = {p.room.id: p for p in placements}

        for i, p1 in enumerate(placements):
            for p2 in placements[i + 1:]:
                if rectangles_adjacent(p1.rectangle, p2.rectangle, tol=tol):
                    graph[p1.room.id].add(p2.room.id)
                    graph[p2.room.id].add(p1.room.id)

        return graph, node_map

    def _find_entry(self, placements: List[RoomPlacement]) -> str:
        """Find the entry room (is_entry flag, or first room)."""
        for p in placements:
            if p.room.is_entry:
                return p.room.id
        return placements[0].room.id if placements else ""

    def _bfs_depth(
        self, graph: Dict[str, Set[str]], start: str
    ) -> Dict[str, int]:
        """BFS from start node, return depth of each reached node."""
        if start not in graph:
            return {}
        visited: Dict[str, int] = {start: 0}
        queue: deque = deque([start])
        while queue:
            node = queue.popleft()
            for nbr in graph.get(node, set()):
                if nbr not in visited:
                    visited[nbr] = visited[node] + 1
                    queue.append(nbr)
        return visited

    def _total_depth_from(
        self, graph: Dict[str, Set[str]], start: str
    ) -> int:
        """Sum of all BFS depths from a given node."""
        depths = self._bfs_depth(graph, start)
        return sum(depths.values())

    @staticmethod
    def _relative_asymmetry(total_depth: int, n: int) -> float:
        """Hillier & Hanson Relative Asymmetry (RA).

        RA = 2(MD - 1) / (n - 2)
        where MD = total_depth / (n - 1)
        """
        if n <= 2:
            return 0.0
        md = total_depth / max(n - 1, 1)
        return 2.0 * (md - 1.0) / max(n - 2, 1)

    def _check_visibility(
        self,
        placements: List[RoomPlacement],
        boundary: Rectangle,
    ) -> List[Dict[str, Any]]:
        """Rooms needing exterior wall but without it get a visibility penalty."""
        penalties = []
        for p in placements:
            if not p.room.requires_exterior_wall:
                continue
            has_ext = p.rectangle.shares_edge_with(boundary)
            if not has_ext:
                penalties.append({
                    "room_id": p.room.id,
                    "issue": "no_exterior_wall",
                    "penalty": 1.0,
                    "recommendation": (
                        f"{p.room.name} requires exterior wall for natural light/ventilation "
                        "but is landlocked. Reposition toward site perimeter or add lightwell."
                    ),
                })
        return penalties
