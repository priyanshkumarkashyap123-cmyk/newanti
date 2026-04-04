from __future__ import annotations

import heapq
import math
from dataclasses import dataclass, field
from enum import IntEnum
from typing import Any, Dict, List, Tuple

import numpy as np

from layout_solver_v2 import Rectangle, rectangles_adjacent
from rules.layout_solver_defaults import (
    DEFAULT_FLOORGRID_CELL_SIZE_M,
    DEFAULT_FLOORGRID_WALL_THICKNESS_M,
)


class CellType(IntEnum):
    """Grid cell classification for discretised floor plan."""

    EMPTY = 0
    ROOM = 1
    WALL = 2
    CORRIDOR = 3
    DOOR = 4
    EXIT = 5


@dataclass
class FloorGrid:
    """Rasterised representation of a floor plan for A* pathfinding."""

    boundary: Rectangle
    cell_size: float = DEFAULT_FLOORGRID_CELL_SIZE_M
    _grid: np.ndarray | None = field(default=None, repr=False)

    def __post_init__(self) -> None:
        cols = max(1, int(math.ceil(self.boundary.width / self.cell_size)))
        rows = max(1, int(math.ceil(self.boundary.height / self.cell_size)))
        self._grid = np.full((rows, cols), CellType.EMPTY, dtype=np.int8)

    @property
    def rows(self) -> int:
        return self._grid.shape[0]

    @property
    def cols(self) -> int:
        return self._grid.shape[1]

    def _to_rc(self, x: float, y: float) -> Tuple[int, int]:
        c = int((x - self.boundary.x) / self.cell_size)
        r = int((y - self.boundary.y) / self.cell_size)
        return (
            max(0, min(r, self.rows - 1)),
            max(0, min(c, self.cols - 1)),
        )

    def _to_xy(self, r: int, c: int) -> Tuple[float, float]:
        x = self.boundary.x + (c + 0.5) * self.cell_size
        y = self.boundary.y + (r + 0.5) * self.cell_size
        return x, y

    def rasterise(
        self,
        placements: List[Any],
        wall_thickness: float = DEFAULT_FLOORGRID_WALL_THICKNESS_M,
    ) -> None:
        self._grid[:] = CellType.CORRIDOR

        for p in placements:
            rect = p.rectangle
            r0, c0 = self._to_rc(rect.x, rect.y)
            r1, c1 = self._to_rc(rect.x + rect.width, rect.y + rect.height)
            self._grid[r0:r1, c0:c1] = CellType.ROOM

        for p in placements:
            rect = p.rectangle
            r0, c0 = self._to_rc(rect.x, rect.y)
            r1, c1 = self._to_rc(rect.x + rect.width, rect.y + rect.height)
            if r0 < self.rows:
                self._grid[r0, c0:c1] = CellType.WALL
            if r1 > 0 and r1 - 1 < self.rows:
                self._grid[r1 - 1, c0:c1] = CellType.WALL
            if c0 < self.cols:
                self._grid[r0:r1, c0] = CellType.WALL
            if c1 > 0 and c1 - 1 < self.cols:
                self._grid[r0:r1, c1 - 1] = CellType.WALL

        for i, p1 in enumerate(placements):
            for p2 in placements[i + 1 :]:
                if rectangles_adjacent(p1.rectangle, p2.rectangle, tol=0.5):
                    cx = (p1.rectangle.center[0] + p2.rectangle.center[0]) / 2
                    cy = (p1.rectangle.center[1] + p2.rectangle.center[1]) / 2
                    dr, dc = self._to_rc(cx, cy)
                    if 0 <= dr < self.rows and 0 <= dc < self.cols:
                        self._grid[dr, dc] = CellType.DOOR
                        for dr2, dc2 in [
                            (dr - 1, dc),
                            (dr + 1, dc),
                            (dr, dc - 1),
                            (dr, dc + 1),
                        ]:
                            if 0 <= dr2 < self.rows and 0 <= dc2 < self.cols:
                                if self._grid[dr2, dc2] == CellType.WALL:
                                    self._grid[dr2, dc2] = CellType.DOOR
                                    break

        for p in placements:
            if p.rectangle.shares_edge_with(self.boundary):
                rect = p.rectangle
                r0, c0 = self._to_rc(rect.x, rect.y)
                r1, c1 = self._to_rc(rect.x + rect.width, rect.y + rect.height)
                if abs(rect.x - self.boundary.x) < 0.1 and c0 < self.cols:
                    self._grid[r0:r1, c0] = CellType.EXIT
                if abs(rect.x + rect.width - self.boundary.x - self.boundary.width) < 0.1 and c1 > 0:
                    self._grid[r0:r1, c1 - 1] = CellType.EXIT
                if abs(rect.y - self.boundary.y) < 0.1 and r0 < self.rows:
                    self._grid[r0, c0:c1] = CellType.EXIT
                if abs(rect.y + rect.height - self.boundary.y - self.boundary.height) < 0.1 and r1 > 0:
                    self._grid[r1 - 1, c0:c1] = CellType.EXIT

    @property
    def corridor_ratio(self) -> float:
        total = self._grid.size
        if total == 0:
            return 0.0
        corridor_cells = int(np.sum(self._grid == CellType.CORRIDOR))
        return corridor_cells / total

    def cell_is_walkable(self, r: int, c: int) -> bool:
        ct = self._grid[r, c]
        return ct in (CellType.ROOM, CellType.CORRIDOR, CellType.DOOR, CellType.EXIT)


def astar_pathfind(
    grid: FloorGrid,
    start_xy: Tuple[float, float],
    goal_xy: Tuple[float, float],
) -> Tuple[float, List[Tuple[int, int]]]:
    """A* pathfinding on the discretised floor grid."""

    sr, sc = grid._to_rc(*start_xy)
    gr, gc = grid._to_rc(*goal_xy)

    if not grid.cell_is_walkable(sr, sc) or not grid.cell_is_walkable(gr, gc):
        return float("inf"), []

    diag_cost = 1.414
    straight_cost = 1.0
    neighbours = [
        (-1, 0, straight_cost),
        (1, 0, straight_cost),
        (0, -1, straight_cost),
        (0, 1, straight_cost),
        (-1, -1, diag_cost),
        (-1, 1, diag_cost),
        (1, -1, diag_cost),
        (1, 1, diag_cost),
    ]

    def heuristic(r: int, c: int) -> float:
        dr = abs(r - gr)
        dc = abs(c - gc)
        return straight_cost * max(dr, dc) + (diag_cost - straight_cost) * min(dr, dc)

    open_set: List[Tuple[float, int, int]] = []
    heapq.heappush(open_set, (heuristic(sr, sc), sr, sc))
    g_score: Dict[Tuple[int, int], float] = {(sr, sc): 0.0}
    came_from: Dict[Tuple[int, int], Tuple[int, int]] = {}
    rows, cols = grid.rows, grid.cols

    while open_set:
        _, cr, cc = heapq.heappop(open_set)
        if cr == gr and cc == gc:
            path = [(cr, cc)]
            while (cr, cc) in came_from:
                cr, cc = came_from[(cr, cc)]
                path.append((cr, cc))
            path.reverse()
            distance_m = g_score[(gr, gc)] * grid.cell_size
            return distance_m, path

        current_g = g_score.get((cr, cc), float("inf"))

        for dr, dc, step_cost in neighbours:
            nr, nc = cr + dr, cc + dc
            if 0 <= nr < rows and 0 <= nc < cols and grid.cell_is_walkable(nr, nc):
                new_g = current_g + step_cost
                if new_g < g_score.get((nr, nc), float("inf")):
                    g_score[(nr, nc)] = new_g
                    came_from[(nr, nc)] = (cr, cc)
                    f = new_g + heuristic(nr, nc)
                    heapq.heappush(open_set, (f, nr, nc))

    return float("inf"), []


def compute_travel_distances(
    grid: FloorGrid,
    placements: List[Any],
    entry_xy: Tuple[float, float] | None = None,
) -> Dict[str, Any]:
    """Run A* from entry (or first room) to every room centroid."""

    if not placements:
        return {"distances": {}, "corridor_ratio": 0.0, "max_travel_m": 0.0}

    if entry_xy is None:
        entry_rooms = [p for p in placements if p.room.is_entry]
        entry_p = entry_rooms[0] if entry_rooms else placements[0]
        entry_xy = entry_p.rectangle.center

    distances: Dict[str, float] = {}
    for p in placements:
        dist, _ = astar_pathfind(grid, entry_xy, p.rectangle.center)
        distances[p.room.id] = round(dist, 2)

    max_travel = max(distances.values()) if distances else 0.0

    return {
        "entry_xy": [round(entry_xy[0], 2), round(entry_xy[1], 2)],
        "distances_m": distances,
        "corridor_ratio": round(grid.corridor_ratio, 4),
        "max_travel_m": round(max_travel, 2),
    }
